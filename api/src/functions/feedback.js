/**
 * Get All Feedback
 * GET /api/feedback
 *
 * Returns all feedback submissions with event details
 * Used by admin panel to view and analyze feedback
 */

const { app } = require('@azure/functions');
const { query, mutate } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { rateLimit } = require('../shared/rate-limiter');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { getAccessibleEventIds } = require('../shared/permissions');
const { audit } = require('../shared/audit');

app.http('feedback', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'feedback',
    handler: async (request, context) => {
        try {
            // Require: GlobalAdmin, EventCreator, FeedbackManager, or FeedbackViewer
            const roleError = requireRole(request, 'EventCreator', 'FeedbackManager', 'FeedbackViewer');
            if (roleError) return roleError;

            // Resource-level filtering
            const caller = getAuthenticatedUser(request);
            let eventFilter = '';
            if (caller && caller.roles) {
                const accessibleIds = await getAccessibleEventIds(caller.userId, caller.username, caller.roles);
                if (accessibleIds !== null) {
                    if (accessibleIds.length === 0) {
                        eventFilter = 'AND 1=0';
                    } else {
                        eventFilter = `AND f.EventId IN (${accessibleIds.join(',')})`;
                    }
                }
            }

            // Get feedback filtered by accessible events
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
                    e.TrainingTrack,
                    em.ModuleId,
                    m.ModuleName,
                    em.SpeakerName
                FROM Feedback f
                LEFT JOIN Events e ON f.EventId = e.EventId
                LEFT JOIN EventModules em ON f.EventModuleId = em.EventModuleId
                LEFT JOIN Modules m ON em.ModuleId = m.ModuleId
                WHERE 1=1 ${eventFilter}
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
                trainingTrack: fb.TrainingTrack,
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
            // Apply rate limiting (3 submissions per minute)
            const rateLimitError = rateLimit(request, 'feedback');
            if (rateLimitError) {
                context.log('Rate limit exceeded for feedback submission');
                return rateLimitError;
            }

            const data = await request.json();

            // Import required utilities
            const { sanitize } = require('../shared/utils');

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

            // Insert feedback (no IP or UserAgent collected - PII policy)
            const result = await query(`INSERT INTO Feedback (EventId, EventCode, EventModuleId, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt) OUTPUT INSERTED.FeedbackId VALUES (@eventId, @eventCode, @eventModuleId, @speakerKnowledge, @contentDepth, @moduleSatisfaction, @additionalComments, GETDATE())`, {
                eventId,
                eventCode: data.eventCode,
                eventModuleId: data.eventModuleId,
                speakerKnowledge: data.speakerKnowledge,
                contentDepth: data.contentDepth,
                moduleSatisfaction: data.moduleSatisfaction,
                additionalComments: sanitizedComments
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

// DELETE single feedback — GlobalAdmin or FeedbackManager (with resource access)
app.http('deleteFeedback', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'feedback/{feedbackId}',
    handler: async (request, context) => {
        try {
            const roleError = requireRole(request, 'FeedbackManager');
            if (roleError) return roleError;

            const feedbackId = parseInt(request.params.feedbackId);

            if (!feedbackId || isNaN(feedbackId)) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid feedback ID', error: 'INVALID_ID' } };
            }

            // Delete feedback
            const result = await mutate('DELETE FROM Feedback WHERE FeedbackId = @feedbackId', { feedbackId });

            if (result.rowsAffected[0] === 0) {
                return { status: 404, jsonBody: { success: false, message: 'Feedback not found', error: 'NOT_FOUND' } };
            }

            await audit(request, 'DELETE', 'Feedback', feedbackId, `Deleted feedback FeedbackId=${feedbackId}`);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Feedback deleted successfully',
                    data: { feedbackId }
                }
            };

        } catch (err) {
            context.error('Error deleting feedback:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});

// DELETE multiple feedback (bulk) — GlobalAdmin or FeedbackManager
app.http('deleteFeedbackBulk', {
    methods: ['POST'],  // Using POST for bulk delete to send body
    authLevel: 'anonymous',
    route: 'feedback/bulk-delete',
    handler: async (request, context) => {
        try {
            const roleError = requireRole(request, 'FeedbackManager');
            if (roleError) return roleError;

            const data = await request.json();
            const { feedbackIds } = data;

            if (!feedbackIds || !Array.isArray(feedbackIds) || feedbackIds.length === 0) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid feedback IDs array', error: 'INVALID_DATA' } };
            }

            let deletedCount = 0;

            for (const feedbackId of feedbackIds) {
                const result = await mutate('DELETE FROM Feedback WHERE FeedbackId = @feedbackId', { feedbackId });
                if (result.rowsAffected[0] > 0) {
                    deletedCount++;
                }
            }

            if (deletedCount > 0) await audit(request, 'BULK_DELETE', 'Feedback', null, `Bulk deleted ${deletedCount} feedback submission(s)`, { deletedCount, feedbackIds });

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `Deleted ${deletedCount} feedback submission(s)`,
                    data: { deletedCount }
                }
            };

        } catch (err) {
            context.error('Error in bulk delete feedback:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});
