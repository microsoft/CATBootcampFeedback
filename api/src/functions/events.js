/**
 * Get All Events with Module Details
 * GET /api/events - Public (used by feedback form)
 * POST /api/events - Create event (REQUIRES AUTH)
 *
 * Returns all events with their associated modules and feedback counts
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { requireAuth } = require('../shared/auth');

app.http('events', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'events',
    handler: async (request, context) => {
        try {
            if (request.method === 'POST') {
                // Verify authentication for POST (create event)
                const authError = requireAuth(request);
                if (authError) {
                    return {
                        status: authError.status,
                        headers: authError.headers,
                        body: authError.body
                    };
                }
                // Create new event
                const bodyText = await request.text();
                const body = JSON.parse(bodyText);
                const { eventName, eventCode, startDate, endDate, trainingTrack, isActive = true } = body;

                // Validate required fields
                if (!eventName || !eventCode || !startDate) {
                    const errorResponse = error(400, 'Event name, event code, and start date are required', 'INVALID_DATA');
                    return {
                        status: errorResponse.status,
                        headers: errorResponse.headers,
                        body: errorResponse.body
                    };
                }

                // Validate event code is not empty and has reasonable length
                if (eventCode.trim().length < 3 || eventCode.trim().length > 50) {
                    const errorResponse = error(400, 'Event code must be between 3 and 50 characters', 'INVALID_DATA');
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
                    INSERT INTO Events (EventName, EventCode, StartDate, EndDate, TrainingTrack, IsActive, CreatedAt, CreatedBy)
                    OUTPUT INSERTED.EventId, INSERTED.EventName, INSERTED.EventCode,
                           INSERTED.StartDate, INSERTED.EndDate, INSERTED.TrainingTrack,
                           INSERTED.IsActive, INSERTED.CreatedAt
                    VALUES (@eventName, @eventCode, @startDate, @endDate, @trainingTrack, @isActive, GETDATE(), @createdBy)
                `, {
                    eventName: eventName.trim(),
                    eventCode: eventCode.trim().toUpperCase(),
                    startDate: startDate,
                    endDate: endDate || null,
                    trainingTrack: trainingTrack ? trainingTrack.trim() : null,
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
                    trainingTrack: createdEvent.TrainingTrack,
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
                    e.TrainingTrack,
                    e.IsActive,
                    e.CreatedAt,
                    e.CreatedBy,
                    COUNT(DISTINCT f.FeedbackId) AS FeedbackCount
                FROM Events e
                LEFT JOIN Feedback f ON e.EventId = f.EventId
                GROUP BY
                    e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.TrainingTrack,
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
                        trainingTrack: event.TrainingTrack,
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

// Event-level count endpoint for live counter
app.http('getEventCount', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'events/{code}/count',
    handler: async (request, context) => {
        try {
            const eventCode = request.params.code;

            if (!eventCode || eventCode.trim().length < 3 || eventCode.trim().length > 50) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid event code', error: 'INVALID_EVENT_CODE' } };
            }

            const eventResult = await query(`SELECT EventId, EventCode, EventName, StartDate, EndDate, TrainingTrack FROM Events WHERE EventCode = @eventCode AND IsActive = 1`, { eventCode });
            if (!eventResult || eventResult.length === 0) {
                return { status: 404, jsonBody: { success: false, message: 'Event not found', error: 'EVENT_NOT_FOUND' } };
            }

            const event = eventResult[0];
            const modulesResult = await query(`SELECT em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName, em.DeliveryOrder, em.DeliveryDate, COUNT(f.FeedbackId) AS FeedbackCount, AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge, AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction, MAX(f.SubmittedAt) AS LastSubmittedAt FROM EventModules em INNER JOIN Modules m ON em.ModuleId = m.ModuleId LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId WHERE em.EventId = @eventId AND m.IsActive = 1 GROUP BY em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName, em.DeliveryOrder, em.DeliveryDate ORDER BY em.DeliveryOrder ASC`, { eventId: event.EventId });

            const totalCount = modulesResult.reduce((sum, m) => sum + (m.FeedbackCount || 0), 0);
            const depthResult = await query(`SELECT f.ContentDepth, COUNT(*) AS Count FROM Feedback f INNER JOIN EventModules em ON f.EventModuleId = em.EventModuleId WHERE em.EventId = @eventId GROUP BY f.ContentDepth`, { eventId: event.EventId });
            const contentDepth = { 'Too Technical': 0, 'Just Right': 0, 'Too Low Level': 0 };
            depthResult.forEach(d => { if (contentDepth.hasOwnProperty(d.ContentDepth)) contentDepth[d.ContentDepth] = d.Count; });

            const modules = modulesResult.map(m => ({ eventModuleId: m.EventModuleId, moduleId: m.ModuleId, moduleName: m.ModuleName, speakerName: m.SpeakerName, deliveryOrder: m.DeliveryOrder, deliveryDate: m.DeliveryDate, feedbackCount: m.FeedbackCount || 0, averages: { speakerKnowledge: m.AvgSpeakerKnowledge ? parseFloat(m.AvgSpeakerKnowledge.toFixed(2)) : null, moduleSatisfaction: m.AvgModuleSatisfaction ? parseFloat(m.AvgModuleSatisfaction.toFixed(2)) : null }, lastSubmittedAt: m.LastSubmittedAt }));

            const validModules = modules.filter(m => m.feedbackCount > 0);
            const totalFeedback = validModules.reduce((sum, m) => sum + m.feedbackCount, 0);
            let avgSpeakerKnowledge = null, avgModuleSatisfaction = null;
            if (totalFeedback > 0) {
                avgSpeakerKnowledge = parseFloat((validModules.reduce((sum, m) => sum + (m.averages.speakerKnowledge || 0) * m.feedbackCount, 0) / totalFeedback).toFixed(2));
                avgModuleSatisfaction = parseFloat((validModules.reduce((sum, m) => sum + (m.averages.moduleSatisfaction || 0) * m.feedbackCount, 0) / totalFeedback).toFixed(2));
            }

            return { status: 200, jsonBody: { success: true, message: 'Event count retrieved', data: { eventCode: event.EventCode, eventId: event.EventId, eventName: event.EventName, startDate: event.StartDate, endDate: event.EndDate, trainingTrack: event.TrainingTrack, totalCount, averages: { speakerKnowledge: avgSpeakerKnowledge, moduleSatisfaction: avgModuleSatisfaction }, contentDepth, modules } } };
        } catch (err) {
            context.error('Error in getEventCount:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});

// Module-specific count endpoint for live counter
app.http('getModuleCount', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'events/{code}/modules/{moduleId}/count',
    handler: async (request, context) => {
        try {
            const eventCode = request.params.code;
            const eventModuleId = parseInt(request.params.moduleId);

            if (!eventCode || eventCode.trim().length < 3 || eventCode.trim().length > 50) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid event code', error: 'INVALID_EVENT_CODE' } };
            }
            if (!eventModuleId || isNaN(eventModuleId)) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid module ID', error: 'INVALID_MODULE_ID' } };
            }

            const result = await query(`SELECT e.EventId, e.EventCode, e.EventName, e.TrainingTrack, em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName, em.DeliveryOrder, em.DeliveryDate, COUNT(f.FeedbackId) AS FeedbackCount, AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge, AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction, MAX(f.SubmittedAt) AS LastSubmittedAt FROM Events e INNER JOIN EventModules em ON e.EventId = em.EventId INNER JOIN Modules m ON em.ModuleId = m.ModuleId LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId WHERE e.EventCode = @eventCode AND em.EventModuleId = @eventModuleId AND e.IsActive = 1 AND m.IsActive = 1 GROUP BY e.EventId, e.EventCode, e.EventName, e.TrainingTrack, em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName, em.DeliveryOrder, em.DeliveryDate`, { eventCode, eventModuleId });

            if (!result || result.length === 0) {
                return { status: 404, jsonBody: { success: false, message: 'Not found', error: 'NOT_FOUND' } };
            }

            const data = result[0];
            const depthResult = await query(`SELECT ContentDepth, COUNT(*) AS Count FROM Feedback WHERE EventModuleId = @eventModuleId GROUP BY ContentDepth`, { eventModuleId });
            const contentDepth = { 'Too Technical': 0, 'Just Right': 0, 'Too Low Level': 0 };
            depthResult.forEach(d => { if (contentDepth.hasOwnProperty(d.ContentDepth)) contentDepth[d.ContentDepth] = d.Count; });

            return { status: 200, jsonBody: { success: true, message: 'Module count retrieved', data: { eventCode: data.EventCode, eventId: data.EventId, eventName: data.EventName, trainingTrack: data.TrainingTrack, eventModuleId: data.EventModuleId, moduleId: data.ModuleId, moduleName: data.ModuleName, speakerName: data.SpeakerName, deliveryOrder: data.DeliveryOrder, deliveryDate: data.DeliveryDate, count: data.FeedbackCount || 0, averages: { speakerKnowledge: data.AvgSpeakerKnowledge ? parseFloat(data.AvgSpeakerKnowledge.toFixed(2)) : null, moduleSatisfaction: data.AvgModuleSatisfaction ? parseFloat(data.AvgModuleSatisfaction.toFixed(2)) : null }, contentDepth, lastSubmittedAt: data.LastSubmittedAt } } };
        } catch (err) {
            context.error('Error in getModuleCount:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});

// DELETE single event (with cascade deletion of feedback)
app.http('deleteEvent', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'events/{eventId}',
    handler: async (request, context) => {
        // Verify authentication
        const authError = requireAuth(request);
        if (authError) {
            return {
                status: authError.status,
                headers: authError.headers,
                body: authError.body
            };
        }

        try {
            const eventId = parseInt(request.params.eventId);

            if (!eventId || isNaN(eventId)) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid event ID', error: 'INVALID_ID' } };
            }

            // Check if event exists
            const eventCheck = await query('SELECT EventId FROM Events WHERE EventId = @eventId', { eventId });
            if (eventCheck.length === 0) {
                return { status: 404, jsonBody: { success: false, message: 'Event not found', error: 'NOT_FOUND' } };
            }

            // Count feedback that will be deleted (for reporting)
            const feedbackCount = await query(`
                SELECT COUNT(*) AS Count FROM Feedback WHERE EventId = @eventId
            `, { eventId });

            // Delete event (cascade will delete EventModules and Feedback)
            await query('DELETE FROM Events WHERE EventId = @eventId', { eventId });

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Event deleted successfully',
                    data: {
                        eventId,
                        feedbackDeleted: feedbackCount[0].Count
                    }
                }
            };

        } catch (err) {
            context.error('Error deleting event:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});

// DELETE multiple events (bulk delete with cascade)
app.http('deleteEventsBulk', {
    methods: ['POST'],  // Using POST for bulk delete to send body
    authLevel: 'anonymous',
    route: 'events/bulk-delete',
    handler: async (request, context) => {
        // Verify authentication
        const authError = requireAuth(request);
        if (authError) {
            return {
                status: authError.status,
                headers: authError.headers,
                body: authError.body
            };
        }

        try {
            const data = await request.json();
            const { eventIds } = data;

            if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid event IDs array', error: 'INVALID_DATA' } };
            }

            let deletedCount = 0;
            let totalFeedbackDeleted = 0;

            for (const eventId of eventIds) {
                // Count feedback that will be deleted
                const feedbackCount = await query(`
                    SELECT COUNT(*) AS Count FROM Feedback WHERE EventId = @eventId
                `, { eventId });

                // Delete event (cascade will delete EventModules and Feedback)
                const result = await query('DELETE FROM Events WHERE EventId = @eventId', { eventId });

                if (result.rowsAffected[0] > 0) {
                    deletedCount++;
                    totalFeedbackDeleted += feedbackCount[0].Count;
                }
            }

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `Deleted ${deletedCount} event(s) and ${totalFeedbackDeleted} feedback submission(s)`,
                    data: {
                        deletedCount,
                        feedbackDeleted: totalFeedbackDeleted
                    }
                }
            };

        } catch (err) {
            context.error('Error in bulk delete events:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});
