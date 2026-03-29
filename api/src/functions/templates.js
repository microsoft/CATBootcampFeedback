/**
 * Templates API
 * GET    /api/templates              - Get all templates with modules (REQUIRES AUTH)
 * POST   /api/templates              - Create new template (blank) (REQUIRES AUTH)
 * POST   /api/templates/from-event   - Create template from existing event (REQUIRES AUTH)
 * DELETE /api/templates/{templateId}  - Delete template (REQUIRES AUTH)
 */

const { app } = require('@azure/functions');
const { query, mutate } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { audit } = require('../shared/audit');

app.http('templates', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'templates',
    handler: async (request, context) => {
        if (request.method === 'GET') {
            const roleError = requireRole(request, 'ModuleManager', 'EventCreator');
            if (roleError) return roleError;
        } else {
            const roleError = requireRole(request, 'ModuleManager');
            if (roleError) return roleError;
        }

        try {
            if (request.method === 'GET') {
                const templates = await query(`
                    SELECT
                        t.TemplateId,
                        t.TemplateName,
                        t.Description,
                        t.TrainingTrack,
                        t.IsActive,
                        t.CreatedAt,
                        t.CreatedBy,
                        t.UpdatedAt,
                        t.UpdatedBy
                    FROM EventTemplates t
                    ORDER BY t.TemplateName ASC
                `);

                const templatesWithModules = await Promise.all(
                    templates.map(async (template) => {
                        const modules = await query(`
                            SELECT
                                etm.TemplateModuleId,
                                etm.ModuleId,
                                m.ModuleName,
                                m.Description AS ModuleDescription,
                                etm.DeliveryOrder,
                                etm.Notes
                            FROM EventTemplateModules etm
                            INNER JOIN Modules m ON etm.ModuleId = m.ModuleId
                            WHERE etm.TemplateId = @templateId
                            ORDER BY etm.DeliveryOrder ASC
                        `, { templateId: template.TemplateId });

                        return {
                            templateId: template.TemplateId,
                            templateName: template.TemplateName,
                            description: template.Description,
                            trainingTrack: template.TrainingTrack,
                            isActive: template.IsActive,
                            createdAt: template.CreatedAt,
                            createdBy: template.CreatedBy,
                            updatedAt: template.UpdatedAt,
                            updatedBy: template.UpdatedBy,
                            moduleCount: modules.length,
                            modules: modules.map(m => ({
                                templateModuleId: m.TemplateModuleId,
                                moduleId: m.ModuleId,
                                moduleName: m.ModuleName,
                                moduleDescription: m.ModuleDescription,
                                deliveryOrder: m.DeliveryOrder,
                                notes: m.Notes
                            }))
                        };
                    })
                );

                const response = success(templatesWithModules);
                return {
                    status: response.status,
                    headers: response.headers,
                    body: response.body
                };

            } else if (request.method === 'POST') {
                // Create blank template
                const bodyText = await request.text();
                const body = JSON.parse(bodyText);

                const { templateName, description, trainingTrack, modules = [] } = body;

                if (!templateName) {
                    const errorResponse = error(400, 'Template name is required', 'INVALID_DATA');
                    return {
                        status: errorResponse.status,
                        headers: errorResponse.headers,
                        body: errorResponse.body
                    };
                }

                const trimmedName = templateName.trim();

                if (trimmedName.length < 3 || trimmedName.length > 200) {
                    const errorResponse = error(400, 'Template name must be between 3 and 200 characters', 'INVALID_DATA');
                    return {
                        status: errorResponse.status,
                        headers: errorResponse.headers,
                        body: errorResponse.body
                    };
                }

                const username = (getAuthenticatedUser(request) || {}).username || 'admin';

                // Create the template
                const result = await query(`
                    INSERT INTO EventTemplates (TemplateName, Description, TrainingTrack, CreatedBy)
                    OUTPUT INSERTED.TemplateId, INSERTED.TemplateName,
                           INSERTED.Description, INSERTED.TrainingTrack,
                           INSERTED.IsActive, INSERTED.CreatedAt
                    VALUES (@templateName, @description, @trainingTrack, @createdBy)
                `, {
                    templateName: trimmedName,
                    description: description ? description.trim() : null,
                    trainingTrack: trainingTrack ? trainingTrack.trim() : null,
                    createdBy: username
                });

                const created = result[0];

                // Add modules if provided
                for (const mod of modules) {
                    if (!mod.moduleId) continue;
                    await mutate(`
                        INSERT INTO EventTemplateModules (TemplateId, ModuleId, DeliveryOrder, Notes)
                        VALUES (@templateId, @moduleId, @deliveryOrder, @notes)
                    `, {
                        templateId: created.TemplateId,
                        moduleId: mod.moduleId,
                        deliveryOrder: mod.deliveryOrder || 1,
                        notes: mod.notes ? mod.notes.trim() : null
                    });
                }

                await audit(request, 'CREATE', 'Template', created.TemplateId,
                    `Created template "${trimmedName}" with ${modules.length} module(s)`,
                    { templateName: trimmedName, moduleCount: modules.length }
                );

                const response = success({
                    message: 'Template created successfully',
                    template: {
                        templateId: created.TemplateId,
                        templateName: created.TemplateName,
                        description: created.Description,
                        trainingTrack: created.TrainingTrack,
                        isActive: created.IsActive,
                        createdAt: created.CreatedAt,
                        moduleCount: modules.length
                    }
                }, 201);

                return {
                    status: response.status,
                    headers: response.headers,
                    body: response.body
                };
            }

        } catch (err) {
            context.log('Error in templates API:', err);
            const errorResponse = error(500, 'Error processing request', 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});

// POST /api/templates/from-event — Create template from an existing event
app.http('createTemplateFromEvent', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'templates/from-event',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'ModuleManager');
        if (roleError) return roleError;

        try {
            const bodyText = await request.text();
            const body = JSON.parse(bodyText);

            const { eventId, templateName, description } = body;

            if (!eventId) {
                const errorResponse = error(400, 'Event ID is required', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            if (!templateName) {
                const errorResponse = error(400, 'Template name is required', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const trimmedName = templateName.trim();

            if (trimmedName.length < 3 || trimmedName.length > 200) {
                const errorResponse = error(400, 'Template name must be between 3 and 200 characters', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Verify event exists
            const eventCheck = await query(
                'SELECT EventId, EventName, TrainingTrack FROM Events WHERE EventId = @eventId AND IsDeleted = 0',
                { eventId: parseInt(eventId) }
            );

            if (eventCheck.length === 0) {
                const errorResponse = error(404, 'Event not found', 'NOT_FOUND');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const event = eventCheck[0];

            // Get event modules (ordered by delivery order)
            const eventModules = await query(`
                SELECT em.ModuleId, em.DeliveryOrder, em.Notes
                FROM EventModules em
                WHERE em.EventId = @eventId
                ORDER BY em.DeliveryOrder ASC
            `, { eventId: parseInt(eventId) });

            const username = (getAuthenticatedUser(request) || {}).username || 'admin';

            // Create the template with event's training track
            const result = await query(`
                INSERT INTO EventTemplates (TemplateName, Description, TrainingTrack, CreatedBy)
                OUTPUT INSERTED.TemplateId, INSERTED.TemplateName,
                       INSERTED.Description, INSERTED.TrainingTrack,
                       INSERTED.IsActive, INSERTED.CreatedAt
                VALUES (@templateName, @description, @trainingTrack, @createdBy)
            `, {
                templateName: trimmedName,
                description: description ? description.trim() : null,
                trainingTrack: event.TrainingTrack,
                createdBy: username
            });

            const created = result[0];

            // Copy modules from event (without speakers)
            for (const mod of eventModules) {
                await mutate(`
                    INSERT INTO EventTemplateModules (TemplateId, ModuleId, DeliveryOrder, Notes)
                    VALUES (@templateId, @moduleId, @deliveryOrder, @notes)
                `, {
                    templateId: created.TemplateId,
                    moduleId: mod.ModuleId,
                    deliveryOrder: mod.DeliveryOrder,
                    notes: mod.Notes
                });
            }

            await audit(request, 'CREATE', 'Template', created.TemplateId,
                `Created template "${trimmedName}" from event "${event.EventName}" with ${eventModules.length} module(s)`,
                { templateName: trimmedName, sourceEventId: parseInt(eventId), sourceEventName: event.EventName, moduleCount: eventModules.length }
            );

            // Fetch the created template with module details for response
            const templateModules = await query(`
                SELECT
                    etm.TemplateModuleId,
                    etm.ModuleId,
                    m.ModuleName,
                    etm.DeliveryOrder,
                    etm.Notes
                FROM EventTemplateModules etm
                INNER JOIN Modules m ON etm.ModuleId = m.ModuleId
                WHERE etm.TemplateId = @templateId
                ORDER BY etm.DeliveryOrder ASC
            `, { templateId: created.TemplateId });

            const response = success({
                message: 'Template created from event successfully',
                template: {
                    templateId: created.TemplateId,
                    templateName: created.TemplateName,
                    description: created.Description,
                    trainingTrack: created.TrainingTrack,
                    isActive: created.IsActive,
                    createdAt: created.CreatedAt,
                    sourceEventId: parseInt(eventId),
                    sourceEventName: event.EventName,
                    moduleCount: templateModules.length,
                    modules: templateModules.map(m => ({
                        templateModuleId: m.TemplateModuleId,
                        moduleId: m.ModuleId,
                        moduleName: m.ModuleName,
                        deliveryOrder: m.DeliveryOrder,
                        notes: m.Notes
                    }))
                }
            }, 201);

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error creating template from event:', err);
            const errorResponse = error(500, 'Error creating template from event', 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});

// DELETE single template
app.http('deleteTemplate', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'templates/{templateId}',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'ModuleManager');
        if (roleError) return roleError;

        try {
            const templateId = parseInt(request.params.templateId);

            if (!templateId || isNaN(templateId)) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid template ID', error: 'INVALID_ID' } };
            }

            // Get template info for audit log
            const templateInfo = await query('SELECT TemplateName FROM EventTemplates WHERE TemplateId = @templateId', { templateId });

            // CASCADE delete handles EventTemplateModules automatically
            const result = await mutate('DELETE FROM EventTemplates WHERE TemplateId = @templateId', { templateId });

            if (result.rowsAffected[0] === 0) {
                return { status: 404, jsonBody: { success: false, message: 'Template not found', error: 'NOT_FOUND' } };
            }

            await audit(request, 'DELETE', 'Template', templateId,
                `Deleted template "${templateInfo[0]?.TemplateName || 'Unknown'}"`,
                { templateId }
            );

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Template deleted successfully',
                    data: { templateId }
                }
            };

        } catch (err) {
            context.error('Error deleting template:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});
