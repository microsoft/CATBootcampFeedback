/**
 * Feedback Count APIs for Live Counter
 * GET /api/events/{code}/count - Event-level count with analytics
 * GET /api/events/{code}/modules/{moduleId}/count - Module-specific count with analytics
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');

// Event-level count endpoint
app.http('getEventCount', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'events/{code}/count',
    handler: async (request, context) => {
        try {
            const eventCode = request.params.code;

            // Validate event code length
            if (!eventCode || eventCode.trim().length < 3 || eventCode.trim().length > 50) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Invalid event code format',
                        error: 'INVALID_EVENT_CODE'
                    }
                };
            }

            // Get event details
            const eventResult = await query(`
                SELECT
                    e.EventId,
                    e.EventCode,
                    e.EventName,
                    e.StartDate,
                    e.EndDate,
                    e.TrainingTrack
                FROM Events e
                WHERE e.EventCode = @eventCode AND e.IsActive = 1
            `, { eventCode });

            if (!eventResult || eventResult.length === 0) {
                return {
                    status: 404,
                    jsonBody: {
                        success: false,
                        message: 'Event not found or inactive',
                        error: 'EVENT_NOT_FOUND'
                    }
                };
            }

            const event = eventResult[0];

            // Get per-module feedback counts
            const modulesResult = await query(`
                SELECT
                    em.EventModuleId,
                    em.ModuleId,
                    m.ModuleName,
                    em.SpeakerName,
                    em.DeliveryOrder,
                    em.DeliveryDate,
                    COUNT(f.FeedbackId) AS FeedbackCount,
                    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
                    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction,
                    MAX(f.SubmittedAt) AS LastSubmittedAt
                FROM EventModules em
                INNER JOIN Modules m ON em.ModuleId = m.ModuleId
                LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
                WHERE em.EventId = @eventId AND m.IsActive = 1
                GROUP BY em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName,
                         em.DeliveryOrder, em.DeliveryDate
                ORDER BY em.DeliveryOrder ASC
            `, { eventId: event.EventId });

            // Calculate total feedback count
            const totalCount = modulesResult.reduce((sum, m) => sum + (m.FeedbackCount || 0), 0);

            // Get content depth distribution for the event
            const depthResult = await query(`
                SELECT
                    f.ContentDepth,
                    COUNT(*) AS Count
                FROM Feedback f
                INNER JOIN EventModules em ON f.EventModuleId = em.EventModuleId
                WHERE em.EventId = @eventId
                GROUP BY f.ContentDepth
            `, { eventId: event.EventId });

            const contentDepth = {
                'Too Technical': 0,
                'Just Right': 0,
                'Too Low Level': 0
            };

            depthResult.forEach(d => {
                if (contentDepth.hasOwnProperty(d.ContentDepth)) {
                    contentDepth[d.ContentDepth] = d.Count;
                }
            });

            // Format module data
            const modules = modulesResult.map(m => ({
                eventModuleId: m.EventModuleId,
                moduleId: m.ModuleId,
                moduleName: m.ModuleName,
                speakerName: m.SpeakerName,
                deliveryOrder: m.DeliveryOrder,
                deliveryDate: m.DeliveryDate,
                feedbackCount: m.FeedbackCount || 0,
                averages: {
                    speakerKnowledge: m.AvgSpeakerKnowledge ? parseFloat(m.AvgSpeakerKnowledge.toFixed(2)) : null,
                    moduleSatisfaction: m.AvgModuleSatisfaction ? parseFloat(m.AvgModuleSatisfaction.toFixed(2)) : null
                },
                lastSubmittedAt: m.LastSubmittedAt
            }));

            // Calculate event-level averages
            const validModules = modules.filter(m => m.feedbackCount > 0);
            const totalFeedback = validModules.reduce((sum, m) => sum + m.feedbackCount, 0);

            let avgSpeakerKnowledge = null;
            let avgModuleSatisfaction = null;

            if (totalFeedback > 0) {
                // Weighted average based on feedback count
                const sumSpeakerKnowledge = validModules.reduce((sum, m) =>
                    sum + (m.averages.speakerKnowledge || 0) * m.feedbackCount, 0);
                const sumModuleSatisfaction = validModules.reduce((sum, m) =>
                    sum + (m.averages.moduleSatisfaction || 0) * m.feedbackCount, 0);

                avgSpeakerKnowledge = parseFloat((sumSpeakerKnowledge / totalFeedback).toFixed(2));
                avgModuleSatisfaction = parseFloat((sumModuleSatisfaction / totalFeedback).toFixed(2));
            }

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Event count retrieved successfully',
                    data: {
                        eventCode: event.EventCode,
                        eventId: event.EventId,
                        eventName: event.EventName,
                        startDate: event.StartDate,
                        endDate: event.EndDate,
                        trainingTrack: event.TrainingTrack,
                        totalCount: totalCount,
                        averages: {
                            speakerKnowledge: avgSpeakerKnowledge,
                            moduleSatisfaction: avgModuleSatisfaction
                        },
                        contentDepth: contentDepth,
                        modules: modules
                    }
                }
            };
        } catch (err) {
            context.error('Error in getEventCount:', err);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    message: 'Internal server error',
                    error: 'SERVER_ERROR'
                }
            };
        }
    }
});

// Module-specific count endpoint
app.http('getModuleCount', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'events/{code}/modules/{moduleId}/count',
    handler: async (request, context) => {
        try {
            const eventCode = request.params.code;
            const eventModuleId = parseInt(request.params.moduleId);

            // Validate event code length
            if (!eventCode || eventCode.trim().length < 3 || eventCode.trim().length > 50) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Invalid event code format',
                        error: 'INVALID_EVENT_CODE'
                    }
                };
            }

            // Validate eventModuleId
            if (!eventModuleId || isNaN(eventModuleId)) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Invalid module ID',
                        error: 'INVALID_MODULE_ID'
                    }
                };
            }

            // Get module details and feedback count in one query
            const result = await query(`
                SELECT
                    e.EventId,
                    e.EventCode,
                    e.EventName,
                    e.TrainingTrack,
                    em.EventModuleId,
                    em.ModuleId,
                    m.ModuleName,
                    em.SpeakerName,
                    em.DeliveryOrder,
                    em.DeliveryDate,
                    COUNT(f.FeedbackId) AS FeedbackCount,
                    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
                    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction,
                    MAX(f.SubmittedAt) AS LastSubmittedAt
                FROM Events e
                INNER JOIN EventModules em ON e.EventId = em.EventId
                INNER JOIN Modules m ON em.ModuleId = m.ModuleId
                LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
                WHERE e.EventCode = @eventCode
                  AND em.EventModuleId = @eventModuleId
                  AND e.IsActive = 1
                  AND m.IsActive = 1
                GROUP BY e.EventId, e.EventCode, e.EventName, e.TrainingTrack,
                         em.EventModuleId, em.ModuleId, m.ModuleName,
                         em.SpeakerName, em.DeliveryOrder, em.DeliveryDate
            `, { eventCode, eventModuleId });

            if (!result || result.length === 0) {
                return {
                    status: 404,
                    jsonBody: {
                        success: false,
                        message: 'Event or module not found or inactive',
                        error: 'NOT_FOUND'
                    }
                };
            }

            const data = result[0];

            // Get content depth distribution for this specific module
            const depthResult = await query(`
                SELECT
                    ContentDepth,
                    COUNT(*) AS Count
                FROM Feedback
                WHERE EventModuleId = @eventModuleId
                GROUP BY ContentDepth
            `, { eventModuleId });

            const contentDepth = {
                'Too Technical': 0,
                'Just Right': 0,
                'Too Low Level': 0
            };

            depthResult.forEach(d => {
                if (contentDepth.hasOwnProperty(d.ContentDepth)) {
                    contentDepth[d.ContentDepth] = d.Count;
                }
            });

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Module count retrieved successfully',
                    data: {
                        eventCode: data.EventCode,
                        eventId: data.EventId,
                        eventName: data.EventName,
                        trainingTrack: data.TrainingTrack,
                        eventModuleId: data.EventModuleId,
                        moduleId: data.ModuleId,
                        moduleName: data.ModuleName,
                        speakerName: data.SpeakerName,
                        deliveryOrder: data.DeliveryOrder,
                        deliveryDate: data.DeliveryDate,
                        count: data.FeedbackCount || 0,
                        averages: {
                            speakerKnowledge: data.AvgSpeakerKnowledge ? parseFloat(data.AvgSpeakerKnowledge.toFixed(2)) : null,
                            moduleSatisfaction: data.AvgModuleSatisfaction ? parseFloat(data.AvgModuleSatisfaction.toFixed(2)) : null
                        },
                        contentDepth: contentDepth,
                        lastSubmittedAt: data.LastSubmittedAt
                    }
                }
            };
        } catch (err) {
            context.error('Error in getModuleCount:', err);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    message: 'Internal server error',
                    error: 'SERVER_ERROR'
                }
            };
        }
    }
});
