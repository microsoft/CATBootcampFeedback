/**
 * Get Feedback Count for Event (Live Counter)
 * GET /api/events/{code}/count
 *
 * Returns event details with per-module feedback counts
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

        // Get event details
        const eventResult = await query(`
            SELECT
                e.EventId,
                e.EventCode,
                e.StartDate,
                e.EndDate,
                e.CohortId
            FROM Events e
            WHERE e.EventCode = @eventCode AND e.IsActive = 1
        `, { eventCode });

        if (!eventResult || eventResult.length === 0) {
            context.res = error(404, 'Event not found or inactive', 'EVENT_NOT_FOUND');
            return;
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

        // Format response for live counter
        context.res = success({
            eventCode: event.EventCode,
            eventId: event.EventId,
            startDate: event.StartDate,
            endDate: event.EndDate,
            cohortId: event.CohortId,
            totalCount: totalCount,
            averages: {
                speakerKnowledge: avgSpeakerKnowledge,
                moduleSatisfaction: avgModuleSatisfaction
            },
            contentDepth: contentDepth,
            modules: modules
        });
    } catch (err) {
        context.log.error('Error in GetFeedbackCount:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
