/**
 * Get Specific Event Module Delivery Details
 * GET /api/events/{code}/modules/{moduleId}
 *
 * Returns details for a specific module delivery within an event.
 * Used by feedback form to auto-populate event and module information.
 */

const { query } = require('../src/shared/database');
const { success, error, validateEventCode, cacheGet, cacheSet } = require('../src/shared/utils');

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

        // Check cache first
        const cacheKey = `event_module_${eventCode}_${eventModuleId}`;
        const cachedData = cacheGet(cacheKey);

        if (cachedData) {
            context.log('Returning cached event module:', eventCode, eventModuleId);
            context.res = success(cachedData);
            return;
        }

        // Query database - get event and module delivery details in one query
        const result = await query(`
            SELECT
                e.EventId,
                e.EventCode,
                e.EventName,
                e.StartDate,
                e.EndDate,
                e.CohortId,
                e.IsActive AS EventIsActive,
                em.EventModuleId,
                em.ModuleId,
                m.ModuleName,
                m.Description AS ModuleDescription,
                em.SpeakerName,
                em.DeliveryOrder,
                em.DeliveryDate,
                em.Notes,
                m.IsActive AS ModuleIsActive
            FROM Events e
            INNER JOIN EventModules em ON e.EventId = em.EventId
            INNER JOIN Modules m ON em.ModuleId = m.ModuleId
            WHERE e.EventCode = @eventCode
              AND em.EventModuleId = @eventModuleId
              AND e.IsActive = 1
              AND m.IsActive = 1
        `, { eventCode, eventModuleId });

        if (!result || result.length === 0) {
            context.res = error(404, 'Event or module not found or inactive', 'NOT_FOUND');
            return;
        }

        const data = result[0];

        // Format response with camelCase
        const moduleData = {
            eventId: data.EventId,
            eventCode: data.EventCode,
            eventName: data.EventName,
            startDate: data.StartDate,
            endDate: data.EndDate,
            cohortId: data.CohortId,
            isActive: data.EventIsActive,
            eventModuleId: data.EventModuleId,
            moduleId: data.ModuleId,
            moduleName: data.ModuleName,
            moduleDescription: data.ModuleDescription,
            speakerName: data.SpeakerName,
            deliveryOrder: data.DeliveryOrder,
            deliveryDate: data.DeliveryDate,
            notes: data.Notes
        };

        // Cache the result for 5 minutes
        cacheSet(cacheKey, moduleData, 300);

        context.res = success(moduleData);
    } catch (err) {
        context.log.error('Error in GetEventModule:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
