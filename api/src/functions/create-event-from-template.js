/**
 * Create Event from Template API
 * POST /api/events/from-template (REQUIRES AUTH)
 *
 * Creates a new event and populates its modules from a template.
 * The caller provides event metadata and speaker assignments for each module.
 */

const { app } = require('@azure/functions');
const { query, withTransaction } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { audit } = require('../shared/audit');

app.http('createEventFromTemplate', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'events/from-template',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'EventCreator');
        if (roleError) return roleError;

        try {
            const bodyText = await request.text();
            const body = JSON.parse(bodyText);

            const {
                templateId,
                eventName,
                eventCode,
                startDate,
                endDate,
                trainingTrack,
                isActive = true,
                modules = []
            } = body;

            // Validate required fields
            if (!templateId) {
                const errorResponse = error(400, 'Template ID is required', 'INVALID_DATA');
                return { status: errorResponse.status, headers: errorResponse.headers, body: errorResponse.body };
            }

            if (!eventName || !eventCode || !startDate) {
                const errorResponse = error(400, 'Event name, event code, and start date are required', 'INVALID_DATA');
                return { status: errorResponse.status, headers: errorResponse.headers, body: errorResponse.body };
            }

            if (eventCode.trim().length < 3 || eventCode.trim().length > 50) {
                const errorResponse = error(400, 'Event code must be between 3 and 50 characters', 'INVALID_DATA');
                return { status: errorResponse.status, headers: errorResponse.headers, body: errorResponse.body };
            }

            // Verify template exists
            const templateCheck = await query(
                'SELECT TemplateId, TemplateName FROM EventTemplates WHERE TemplateId = @templateId',
                { templateId: parseInt(templateId) }
            );

            if (templateCheck.length === 0) {
                const errorResponse = error(404, 'Template not found', 'NOT_FOUND');
                return { status: errorResponse.status, headers: errorResponse.headers, body: errorResponse.body };
            }

            // Check for duplicate event code
            const existingEvent = await query(
                'SELECT EventId FROM Events WHERE EventCode = @eventCode',
                { eventCode: eventCode.trim().toUpperCase() }
            );

            if (existingEvent.length > 0) {
                const errorResponse = error(400, 'Event code already exists', 'DUPLICATE_CODE');
                return { status: errorResponse.status, headers: errorResponse.headers, body: errorResponse.body };
            }

            // Validate each module has a speakerId
            for (const mod of modules) {
                if (!mod.moduleId || !mod.speakerId) {
                    const errorResponse = error(400, 'Each module must have a moduleId and speakerId', 'INVALID_DATA');
                    return { status: errorResponse.status, headers: errorResponse.headers, body: errorResponse.body };
                }
            }

            const caller = getAuthenticatedUser(request);
            const username = (caller || {}).username || 'admin';

            // Pre-resolve speaker names outside the transaction so a bad
            // speakerId fails fast with a 400 instead of aborting mid-commit.
            const moduleSpeakerNames = new Map();
            for (const mod of modules) {
                const speakerResult = await query(
                    'SELECT SpeakerName FROM Speakers WHERE SpeakerId = @speakerId',
                    { speakerId: parseInt(mod.speakerId) }
                );

                if (speakerResult.length === 0) {
                    const errorResponse = error(400, `Speaker with ID ${mod.speakerId} not found`, 'INVALID_SPEAKER');
                    return { status: errorResponse.status, headers: errorResponse.headers, body: errorResponse.body };
                }

                moduleSpeakerNames.set(parseInt(mod.moduleId), speakerResult[0].SpeakerName);
            }

            // Create event, grant access, and add modules atomically.
            const { createdEvent, createdModules } = await withTransaction(async (tx) => {
                const eventResult = await tx.query(`
                    INSERT INTO Events (EventName, EventCode, StartDate, EndDate, TrainingTrack, IsActive, CreatedAt, CreatedBy)
                    OUTPUT INSERTED.EventId, INSERTED.EventName, INSERTED.EventCode,
                           INSERTED.StartDate, INSERTED.EndDate, INSERTED.TrainingTrack,
                           INSERTED.IsActive, INSERTED.CreatedAt
                    VALUES (@eventName, @eventCode, @startDate, @endDate, @trainingTrack, @isActive, GETDATE(), @createdBy)
                `, {
                    eventName: eventName.trim(),
                    eventCode: eventCode.trim().toUpperCase(),
                    startDate,
                    endDate: endDate || null,
                    trainingTrack: trainingTrack ? trainingTrack.trim() : null,
                    isActive: isActive ? 1 : 0,
                    createdBy: username
                });

                const newEvent = eventResult[0];

                if (caller && caller.userId) {
                    await tx.mutate(
                        `INSERT INTO UserEventAccess (UserId, EventId, GrantedBy)
                         VALUES (@userId, @eventId, @grantedBy)`,
                        { userId: caller.userId, eventId: newEvent.EventId, grantedBy: username }
                    );
                }

                const newModules = [];
                for (const mod of modules) {
                    const moduleId = parseInt(mod.moduleId);
                    const speakerName = moduleSpeakerNames.get(moduleId);

                    const emResult = await tx.query(`
                        INSERT INTO EventModules (EventId, ModuleId, SpeakerName, SpeakerId, DeliveryOrder, DeliveryDate, Notes, CreatedBy)
                        OUTPUT INSERTED.EventModuleId, INSERTED.ModuleId, INSERTED.SpeakerName,
                               INSERTED.SpeakerId, INSERTED.DeliveryOrder, INSERTED.DeliveryDate
                        VALUES (@eventId, @moduleId, @speakerName, @speakerId, @deliveryOrder, @deliveryDate, @notes, @createdBy)
                    `, {
                        eventId: newEvent.EventId,
                        moduleId,
                        speakerName,
                        speakerId: parseInt(mod.speakerId),
                        deliveryOrder: mod.deliveryOrder || 1,
                        deliveryDate: mod.deliveryDate || null,
                        notes: mod.notes || null,
                        createdBy: username
                    });

                    if (emResult.length > 0) {
                        newModules.push({
                            eventModuleId: emResult[0].EventModuleId,
                            moduleId: emResult[0].ModuleId,
                            speakerName: emResult[0].SpeakerName,
                            speakerId: emResult[0].SpeakerId,
                            deliveryOrder: emResult[0].DeliveryOrder,
                            deliveryDate: emResult[0].DeliveryDate
                        });
                    }
                }

                return { createdEvent: newEvent, createdModules: newModules };
            });

            await audit(request, 'CREATE', 'Event', createdEvent.EventId,
                `Created event "${eventName.trim()}" (${eventCode.trim().toUpperCase()}) from template "${templateCheck[0].TemplateName}" with ${createdModules.length} module(s)`,
                {
                    eventId: createdEvent.EventId,
                    eventName: eventName.trim(),
                    eventCode: eventCode.trim().toUpperCase(),
                    templateId: parseInt(templateId),
                    templateName: templateCheck[0].TemplateName,
                    moduleCount: createdModules.length
                }
            );

            const response = success({
                message: 'Event created from template successfully',
                eventId: createdEvent.EventId,
                eventName: createdEvent.EventName,
                eventCode: createdEvent.EventCode,
                startDate: createdEvent.StartDate,
                endDate: createdEvent.EndDate,
                trainingTrack: createdEvent.TrainingTrack,
                isActive: createdEvent.IsActive,
                createdAt: createdEvent.CreatedAt,
                templateId: parseInt(templateId),
                templateName: templateCheck[0].TemplateName,
                modules: createdModules
            }, 201);

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error creating event from template:', err);
            const errorResponse = error(500, `Error creating event from template: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});
