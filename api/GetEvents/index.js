/**
 * Get All Events with Module Details
 * GET /api/events
 *
 * Returns all events with their associated modules and feedback counts
 * Used by admin panel to list events
 */

const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        // Get all events
        const events = await query(`
            SELECT
                e.EventId,
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
                e.EventId, e.EventCode, e.StartDate, e.EndDate, e.CohortId,
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

        context.res = success(eventsWithModules);
    } catch (err) {
        context.log.error('Error in GetEvents:', err);
        context.log.error('Error details:', err.message, err.stack);
        context.res = error(500, `Error retrieving events: ${err.message}`, 'SERVER_ERROR');
    }
};
