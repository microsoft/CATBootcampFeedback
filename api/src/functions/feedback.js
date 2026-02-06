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
