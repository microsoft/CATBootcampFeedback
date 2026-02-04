/**
 * Get Feedback Count for Event (Live Counter)
 * GET /api/events/{code}/count
 *
 * Returns event details, module info, and feedback count
 * Used by the live counter display
 */

const { query } = require('../shared/database');
const { success, error, validateEventCode } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const eventCode = context.bindingData.code;

        // Validate event code format
        if (!validateEventCode(eventCode)) {
            context.res = error(400, 'Invalid event code format', 'INVALID_EVENT_CODE');
            return;
        }

        // Get event, module details, and feedback count
        const result = await query(`
            SELECT
                e.EventId,
                e.EventCode,
                e.ModuleId,
                m.ModuleName,
                m.SpeakerName,
                e.StartDate,
                e.EndDate,
                e.CohortId,
                COUNT(f.FeedbackId) AS FeedbackCount,
                AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
                AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction,
                MAX(f.SubmittedAt) AS LastSubmittedAt
            FROM Events e
            INNER JOIN Modules m ON e.ModuleId = m.ModuleId
            LEFT JOIN Feedback f ON e.EventId = f.EventId
            WHERE e.EventCode = @eventCode AND e.IsActive = 1 AND m.IsActive = 1
            GROUP BY e.EventId, e.EventCode, e.ModuleId, m.ModuleName, m.SpeakerName,
                     e.StartDate, e.EndDate, e.CohortId
        `, { eventCode });

        if (!result || result.length === 0) {
            context.res = error(404, 'Event not found or inactive', 'EVENT_NOT_FOUND');
            return;
        }

        const data = result[0];

        // Format response for live counter
        context.res = success({
            eventCode: data.EventCode,
            eventId: data.EventId,
            moduleId: data.ModuleId,
            moduleName: data.ModuleName,
            speakerName: data.SpeakerName,
            startDate: data.StartDate,
            endDate: data.EndDate,
            cohortId: data.CohortId,
            count: data.FeedbackCount || 0,
            averages: {
                speakerKnowledge: data.AvgSpeakerKnowledge ? parseFloat(data.AvgSpeakerKnowledge.toFixed(2)) : null,
                moduleSatisfaction: data.AvgModuleSatisfaction ? parseFloat(data.AvgModuleSatisfaction.toFixed(2)) : null
            },
            lastSubmittedAt: data.LastSubmittedAt
        });
    } catch (err) {
        context.log.error('Error in GetFeedbackCount:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
