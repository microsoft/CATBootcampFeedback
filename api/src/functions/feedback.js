/**
 * Get All Feedback
 * GET /api/feedback
 *
 * Returns all feedback submissions with event details
 * Used by admin panel to view and analyze feedback
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

app.http('feedback', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'feedback',
    handler: async (request, context) => {
        try {
            // Get all feedback with event details
            const feedback = await query(`
                SELECT
                    f.FeedbackId,
                    f.EventId,
                    f.EventCode,
                    f.EventModuleId,
                    f.SpeakerKnowledge,
                    f.ContentDepth,
                    f.ModuleSatisfaction,
                    f.AdditionalComments,
                    f.SubmittedAt,
                    e.EventCode AS EventCodeFromEvent,
                    e.StartDate,
                    e.CohortId,
                    em.ModuleId,
                    m.ModuleName,
                    em.SpeakerName
                FROM Feedback f
                LEFT JOIN Events e ON f.EventId = e.EventId
                LEFT JOIN EventModules em ON f.EventModuleId = em.EventModuleId
                LEFT JOIN Modules m ON em.ModuleId = m.ModuleId
                ORDER BY f.SubmittedAt DESC
            `);

            // Transform to camelCase
            const transformedFeedback = feedback.map(fb => ({
                feedbackId: fb.FeedbackId,
                eventId: fb.EventId,
                eventCode: fb.EventCode,
                eventModuleId: fb.EventModuleId,
                speakerKnowledge: fb.SpeakerKnowledge,
                contentDepth: fb.ContentDepth,
                moduleSatisfaction: fb.ModuleSatisfaction,
                additionalComments: fb.AdditionalComments,
                submittedAt: fb.SubmittedAt,
                startDate: fb.StartDate,
                cohortId: fb.CohortId,
                moduleId: fb.ModuleId,
                moduleName: fb.ModuleName,
                speakerName: fb.SpeakerName
            }));

            const response = success(transformedFeedback);
            return {
                status: response.status,
                headers: response.headers,
                body: response.body  // Use 'body' not 'jsonBody' since response.body is already stringified
            };
        } catch (err) {
            context.log('Error getting feedback:', err);
            const errorResponse = error(500, 'Error retrieving feedback', 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body  // Use 'body' not 'jsonBody' since errorResponse.body is already stringified
            };
        }
    }
});

// Submit feedback endpoint (POST)
app.http('submitFeedback', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'feedback',
    handler: async (request, context) => {
        try {
            const data = await request.json();

            // Import required utilities
            const { sanitize, getClientIP, checkRateLimit } = require('../shared/utils');

            // Rate limiting
            const clientIP = getClientIP(request);
            const rateLimitKey = `feedback_${clientIP}_${data.eventCode}`;
            const rateLimit = checkRateLimit(rateLimitKey, 5, 3600000); // 5 per hour

            if (!rateLimit.allowed) {
                return {
                    status: 429,
                    jsonBody: {
                        success: false,
                        message: `Too many submissions. Please try again in ${Math.ceil(rateLimit.retryAfter / 60)} minutes.`,
                        error: 'RATE_LIMIT_EXCEEDED'
                    }
                };
            }

            // Validate required fields
            if (!data.eventCode || !data.eventModuleId || !data.speakerKnowledge || !data.contentDepth || !data.moduleSatisfaction) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Missing required fields',
                        error: 'INVALID_DATA'
                    }
                };
            }

            // Validate ranges
            if (data.speakerKnowledge < 1 || data.speakerKnowledge > 5 || data.moduleSatisfaction < 1 || data.moduleSatisfaction > 5) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Ratings must be between 1 and 5',
                        error: 'INVALID_DATA'
                    }
                };
            }

            // Validate content depth
            const validDepths = ['Too Technical', 'Just Right', 'Too Low Level'];
            if (!validDepths.includes(data.contentDepth)) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Invalid content depth value',
                        error: 'INVALID_DATA'
                    }
                };
            }

            // Check if event exists and is active
            const eventResult = await query(`SELECT EventId FROM Events WHERE EventCode = @eventCode AND IsActive = 1`, { eventCode: data.eventCode });

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

            const eventId = eventResult[0].EventId;

            // Verify that eventModuleId belongs to this event
            const eventModuleResult = await query(`SELECT EventModuleId FROM EventModules WHERE EventModuleId = @eventModuleId AND EventId = @eventId`, { eventModuleId: data.eventModuleId, eventId });

            if (!eventModuleResult || eventModuleResult.length === 0) {
                return {
                    status: 404,
                    jsonBody: {
                        success: false,
                        message: 'Event module not found or does not belong to this event',
                        error: 'INVALID_EVENT_MODULE'
                    }
                };
            }

            // Sanitize comments
            const sanitizedComments = data.additionalComments ? sanitize(data.additionalComments) : null;

            // Insert feedback
            const result = await query(`INSERT INTO Feedback (EventId, EventCode, EventModuleId, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, IpAddress, UserAgent, SubmittedAt) OUTPUT INSERTED.FeedbackId VALUES (@eventId, @eventCode, @eventModuleId, @speakerKnowledge, @contentDepth, @moduleSatisfaction, @additionalComments, @ipAddress, @userAgent, GETDATE())`, {
                eventId,
                eventCode: data.eventCode,
                eventModuleId: data.eventModuleId,
                speakerKnowledge: data.speakerKnowledge,
                contentDepth: data.contentDepth,
                moduleSatisfaction: data.moduleSatisfaction,
                additionalComments: sanitizedComments,
                ipAddress: clientIP,
                userAgent: request.headers.get('user-agent') || 'unknown'
            });

            const feedbackId = result[0].FeedbackId;

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Feedback submitted successfully',
                    data: { feedbackId }
                }
            };
        } catch (err) {
            context.error('Error in submitFeedback:', err);
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
