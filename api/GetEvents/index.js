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
        // Auto-archive events that are 2 weeks past their end date
        await query(`
            UPDATE Events
            SET IsActive = 0,
                UpdatedAt = GETDATE(),
                UpdatedBy = 'system-auto-archive'
            WHERE IsActive = 1
              AND EndDate IS NOT NULL
              AND DATEDIFF(DAY, EndDate, GETDATE()) > 14
        `);

        // Get all active events with their modules in a single query
        // Using the same join pattern as GetEventModule to ensure consistency
        const eventsWithModules = await query(`
            SELECT
                e.EventId,
                e.EventName,
                e.EventCode,
                e.StartDate,
                e.EndDate,
                e.CohortId,
                e.IsActive,
                e.CreatedAt,
                e.CreatedBy,
                em.EventModuleId,
                em.ModuleId,
                m.ModuleName,
                em.SpeakerName,
                m.Description AS ModuleDescription,
                em.DeliveryOrder,
                em.DeliveryDate,
                m.IsActive AS ModuleIsActive,
                (SELECT COUNT(*) FROM Feedback f WHERE f.EventId = e.EventId) AS FeedbackCount
            FROM Events e
            LEFT JOIN EventModules em ON e.EventId = em.EventId AND e.IsActive = 1
            LEFT JOIN Modules m ON em.ModuleId = m.ModuleId AND m.IsActive = 1
            WHERE e.IsActive = 1
            ORDER BY e.CreatedAt DESC, em.DeliveryOrder ASC
        `);

        // Group results by event
        const eventMap = new Map();
        for (const row of eventsWithModules) {
            if (!eventMap.has(row.EventId)) {
                eventMap.set(row.EventId, {
                    eventId: row.EventId,
                    eventName: row.EventName,
                    eventCode: row.EventCode,
                    startDate: row.StartDate,
                    endDate: row.EndDate,
                    cohortId: row.CohortId,
                    isActive: row.IsActive,
                    createdAt: row.CreatedAt,
                    createdBy: row.CreatedBy,
                    feedbackCount: row.FeedbackCount || 0,
                    modules: []
                });
            }

            // Only add module if EventModuleId exists (handles events with no modules)
            // CRITICAL: Only include modules where BOTH event AND module are active
            // This ensures GetEventModule will also find these modules
            if (row.EventModuleId && row.ModuleIsActive === true) {
                eventMap.get(row.EventId).modules.push({
                    eventModuleId: row.EventModuleId,
                    moduleId: row.ModuleId,
                    moduleName: row.ModuleName,
                    speakerName: row.SpeakerName,
                    description: row.ModuleDescription,
                    deliveryOrder: row.DeliveryOrder,
                    deliveryDate: row.DeliveryDate,
                    isActive: row.ModuleIsActive
                });
            }
        }

        const result = Array.from(eventMap.values());

        context.res = success(result);
    } catch (err) {
        context.log.error('Error in GetEvents:', err);
        context.log.error('Error details:', err.message, err.stack);
        context.res = error(500, `Error retrieving events: ${err.message}`, 'SERVER_ERROR');
    }
};
