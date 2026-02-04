/**
 * Get All Feedback with Module and Event Details
 * GET /api/feedback
 *
 * Returns all feedback with associated event and module information
 * Used by admin panel to display feedback
 */

const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        // Get all feedback with event and module details using the view
        const feedback = await query(`
            SELECT
                FeedbackId,
                EventId,
                EventCode,
                EventModuleId,
                ModuleId,
                ModuleName,
                SpeakerName,
                StartDate,
                EndDate,
                CohortId,
                DeliveryOrder,
                SpeakerKnowledge,
                ContentDepth,
                ModuleSatisfaction,
                AdditionalComments,
                SubmittedAt,
                IpAddress
            FROM vw_FeedbackWithDetails
            ORDER BY SubmittedAt DESC
        `);

        // Format response to match frontend expectations
        const formattedFeedback = feedback.map(fb => ({
            feedbackId: fb.FeedbackId,
            eventId: fb.EventId,
            eventCode: fb.EventCode,
            eventModuleId: fb.EventModuleId,
            moduleId: fb.ModuleId,
            moduleName: fb.ModuleName,
            speakerName: fb.SpeakerName,
            startDate: fb.StartDate,
            moduleDate: fb.StartDate, // For backwards compatibility
            endDate: fb.EndDate,
            cohortId: fb.CohortId,
            deliveryOrder: fb.DeliveryOrder,
            speakerKnowledge: fb.SpeakerKnowledge,
            contentDepth: fb.ContentDepth,
            moduleSatisfaction: fb.ModuleSatisfaction,
            additionalComments: fb.AdditionalComments,
            submittedAt: fb.SubmittedAt
        }));

        context.res = success(formattedFeedback);
    } catch (err) {
        context.log.error('Error in GetAllFeedback:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
