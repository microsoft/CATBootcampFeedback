/**
 * Get All Events with Module Details
 * GET /api/events
 *
 * Returns all events with their associated modules and feedback counts
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

app.http('events', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'events',
    handler: async (request, context) => {
        try {
            if (request.method === 'POST') {
                // Create new event
                const bodyText = await request.text();
                const body = JSON.parse(bodyText);
                const { eventName, eventCode, startDate, endDate, cohortId, isActive = true } = body;

                // Validate required fields
                if (!eventName || !eventCode || !startDate) {
                    const errorResponse = error(400, 'Event name, event code, and start date are required', 'INVALID_DATA');
                    return {
                        status: errorResponse.status,
                        headers: errorResponse.headers,
                        body: errorResponse.body
                    };
                }

                // Validate event code format
                if (!/^CS[A-Z0-9]{6}$/.test(eventCode)) {
                    const errorResponse = error(400, 'Event code must be 8 characters starting with CS followed by 6 alphanumeric characters', 'INVALID_DATA');
                    return {
                        status: errorResponse.status,
                        headers: errorResponse.headers,
                        body: errorResponse.body
                    };
                }

                // Check if event code already exists
                const existing = await query(
                    'SELECT EventId FROM Events WHERE EventCode = @eventCode',
                    { eventCode }
                );

                if (existing.length > 0) {
                    const errorResponse = error(400, 'Event code already exists', 'DUPLICATE_CODE');
                    return {
                        status: errorResponse.status,
                        headers: errorResponse.headers,
                        body: errorResponse.body
                    };
                }

                // Insert event
                const result = await query(`
                    INSERT INTO Events (EventName, EventCode, StartDate, EndDate, CohortId, IsActive, CreatedAt, CreatedBy)
                    OUTPUT INSERTED.EventId, INSERTED.EventName, INSERTED.EventCode,
                           INSERTED.StartDate, INSERTED.EndDate, INSERTED.CohortId,
                           INSERTED.IsActive, INSERTED.CreatedAt
                    VALUES (@eventName, @eventCode, @startDate, @endDate, @cohortId, @isActive, GETDATE(), @createdBy)
                `, {
                    eventName: eventName.trim(),
                    eventCode: eventCode.trim().toUpperCase(),
                    startDate: startDate,
                    endDate: endDate || null,
                    cohortId: cohortId ? cohortId.trim() : null,
                    isActive: isActive ? 1 : 0,
                    createdBy: 'admin'
                });

                const createdEvent = result[0];

                const response = success({
                    message: 'Event created successfully',
                    eventId: createdEvent.EventId,
                    eventName: createdEvent.EventName,
                    eventCode: createdEvent.EventCode,
                    startDate: createdEvent.StartDate,
                    endDate: createdEvent.EndDate,
                    cohortId: createdEvent.CohortId,
                    isActive: createdEvent.IsActive,
                    createdAt: createdEvent.CreatedAt
                }, 201);

                return {
                    status: response.status,
                    headers: response.headers,
                    body: response.body
                };
            }

            // GET all events
            const events = await query(`
                SELECT
                    e.EventId,
                    e.EventName,
                    e.EventCode,
                    e.StartDate,
                    e.EndDate,
                    e.CohortId,
                    e.IsActive,
                    e.CreatedAt,
                    e.CreatedBy,
                    COUNT(DISTINCT f.FeedbackId) AS FeedbackCount
                FROM Events e
                LEFT JOIN Feedback f ON e.EventId = f.EventId
                GROUP BY
                    e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.CohortId,
                    e.IsActive, e.CreatedAt, e.CreatedBy
                ORDER BY e.CreatedAt DESC
            `);

            // For each event, get its modules
            const eventsWithModules = await Promise.all(
                events.map(async (event) => {
                    const modules = await query(`
                        SELECT
                            em.EventModuleId,
                            em.ModuleId,
                            m.ModuleName,
                            em.SpeakerName,
                            m.Description,
                            em.DeliveryOrder,
                            em.DeliveryDate,
                            m.IsActive
                        FROM EventModules em
                        INNER JOIN Modules m ON em.ModuleId = m.ModuleId
                        WHERE em.EventId = @eventId
                        ORDER BY em.DeliveryOrder ASC
                    `, { eventId: event.EventId });

                    return {
                        eventId: event.EventId,
                        eventName: event.EventName,
                        eventCode: event.EventCode,
                        startDate: event.StartDate,
                        endDate: event.EndDate,
                        cohortId: event.CohortId,
                        isActive: event.IsActive,
                        createdAt: event.CreatedAt,
                        createdBy: event.CreatedBy,
                        feedbackCount: event.FeedbackCount || 0,
                        modules: modules.map(m => ({
                            eventModuleId: m.EventModuleId,
                            moduleId: m.ModuleId,
                            moduleName: m.ModuleName,
                            speakerName: m.SpeakerName,
                            description: m.Description,
                            deliveryOrder: m.DeliveryOrder,
                            deliveryDate: m.DeliveryDate,
                            isActive: m.IsActive
                        }))
                    };
                })
            );

            const response = success(eventsWithModules);
            return {
                status: response.status,
                headers: response.headers,
                body: response.body  // Use 'body' not 'jsonBody' since response.body is already stringified
            };
        } catch (err) {
            context.log('Error in GetEvents:', err);
            context.log('Error details:', err.message, err.stack);
            const errorResponse = error(500, `Error retrieving events: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body  // Use 'body' not 'jsonBody' since errorResponse.body is already stringified
            };
        }
    }
});
