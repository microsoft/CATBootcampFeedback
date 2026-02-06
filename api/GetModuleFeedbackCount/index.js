/**
 * Get Feedback Count for Specific Module Delivery
 * GET /api/events/{code}/modules/{moduleId}/count
 *
 * Returns feedback count and statistics for a specific module delivery
 * Used by the live counter display in module-specific mode
 */

const { query } = require('../src/shared/database');
const { success, error, validateEventCode } = require('../src/shared/utils');

module.exports = async function (context, req) {
    try {
        const eventCode = context.bindingData.code;
        const eventModuleId = parseInt(context.bindingData.moduleId);

        // Validate event code format
        if (!validateEventCode(eventCode)) {
            context.res = error(400, 'Invalid event code format', 'INVALID_EVENT_CODE');
            return;
        }

        // Validate eventModuleId
        if (!eventModuleId || isNaN(eventModuleId)) {
            context.res = error(400, 'Invalid module ID', 'INVALID_MODULE_ID');
            return;
        }

        // Get module details and feedback count in one query
        const result = await query(`
            SELECT
                e.EventId,
                e.EventCode,
                e.EventName,
                e.CohortId,
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
            GROUP BY e.EventId, e.EventCode, e.EventName, e.CohortId,
                     em.EventModuleId, em.ModuleId, m.ModuleName,
                     em.SpeakerName, em.DeliveryOrder, em.DeliveryDate
        `, { eventCode, eventModuleId });

        if (!result || result.length === 0) {
            context.res = error(404, 'Event or module not found or inactive', 'NOT_FOUND');
            return;
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

        // Format response for live counter
        context.res = success({
            eventCode: data.EventCode,
            eventId: data.EventId,
            eventName: data.EventName,
            cohortId: data.CohortId,
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
        });
    } catch (err) {
        context.log.error('Error in GetModuleFeedbackCount:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
