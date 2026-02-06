/**
 * Get All Events with Module Details
 * GET /api/events
 *
 * Returns all events with their associated modules and feedback counts
 * Used by admin panel to list events
 */

const { query } = require('../src/shared/database');
const { success, error } = require('../src/shared/utils');

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

        // Get all active events
        const events = await query(`
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
                COUNT(DISTINCT f.FeedbackId) AS FeedbackCount
            FROM Events e
            LEFT JOIN Feedback f ON e.EventId = f.EventId
            WHERE e.IsActive = 1
            GROUP BY
                e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.CohortId,
                e.IsActive, e.CreatedAt, e.CreatedBy
            ORDER BY e.CreatedAt DESC
        `);

        // For each event, get its modules using SAME EXACT query pattern as GetEventModule
        const eventsWithModules = await Promise.all(
            events.map(async (event) => {
                // CRITICAL: Use INNER JOIN like GetEventModule to ensure exact same results
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
                      AND m.IsActive = 1
                    ORDER BY em.DeliveryOrder ASC
                `, { eventId: event.EventId });

                // DEFENSIVE: Verify each module can be found by GetEventModule query
                // This ensures we NEVER return a module that will 404
                const validatedModules = await Promise.all(
                    modules.map(async (m) => {
                        try {
                            // Test if GetEventModule would find this module
                            const testResult = await query(`
                                SELECT 1 AS Found
                                FROM Events e
                                INNER JOIN EventModules em ON e.EventId = em.EventId
                                INNER JOIN Modules mod ON em.ModuleId = mod.ModuleId
                                WHERE e.EventCode = @eventCode
                                  AND em.EventModuleId = @eventModuleId
                                  AND e.IsActive = 1
                                  AND mod.IsActive = 1
                            `, { eventCode: event.EventCode, eventModuleId: m.EventModuleId });

                            // Only include if GetEventModule query would find it
                            if (testResult && testResult.length > 0) {
                                return m;
                            } else {
                                context.log(`WARNING: Module ${m.EventModuleId} for event ${event.EventCode} would return 404 - excluding from results`);
                                return null;
                            }
                        } catch (err) {
                            context.log.error(`Error validating module ${m.EventModuleId}:`, err);
                            return null;
                        }
                    })
                );

                // Filter out null modules
                const workingModules = validatedModules.filter(m => m !== null);

                return {
                    eventId: event.EventId,
                    eventName: event.EventName,
                    eventCode: event.EventCode,
                    startDate: event.StartDate,
                    endDate: event.EndDate,
                    cohortId: event.CohortId,
                    isActive: event.IsActive,
                    createdAt: event.CreatedAt,
                    createdBy: event.CreatedBy,
                    feedbackCount: event.FeedbackCount || 0,
                    modules: workingModules.map(m => ({
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

        const result = eventsWithModules;

        context.res = success(result);
    } catch (err) {
        context.log.error('Error in GetEvents:', err);
        context.log.error('Error details:', err.message, err.stack);
        context.res = error(500, `Error retrieving events: ${err.message}`, 'SERVER_ERROR');
    }
};
