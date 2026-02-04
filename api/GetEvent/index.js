/**
 * Get Event Details by Code
 * GET /api/events/{code}
 */

const { query } = require('../shared/database');
const { success, error, validateEventCode, cacheGet, cacheSet } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const eventCode = context.bindingData.code;

        // Validate event code format
        if (!validateEventCode(eventCode)) {
            context.res = error(400, 'Invalid event code format', 'INVALID_EVENT_CODE');
            return;
        }

        // Check cache first
        const cacheKey = `event_${eventCode}`;
        const cachedEvent = cacheGet(cacheKey);

        if (cachedEvent) {
            context.log('Returning cached event:', eventCode);
            context.res = success(cachedEvent);
            return;
        }

        // Query database - get event details
        const eventResult = await query(`
            SELECT
                e.EventId,
                e.EventCode,
                e.StartDate,
                e.EndDate,
                e.CohortId,
                e.IsActive,
                e.CreatedAt
            FROM Events e
            WHERE e.EventCode = @eventCode AND e.IsActive = 1
        `, { eventCode });

        if (!eventResult || eventResult.length === 0) {
            context.res = error(404, 'Event not found or inactive', 'EVENT_NOT_FOUND');
            return;
        }

        const event = eventResult[0];

        // Get all modules for this event
        const modulesResult = await query(`
            SELECT
                em.EventModuleId,
                em.ModuleId,
                m.ModuleName,
                em.SpeakerName,
                m.Description,
                em.DeliveryOrder,
                em.DeliveryDate,
                em.Notes,
                m.IsActive
            FROM EventModules em
            INNER JOIN Modules m ON em.ModuleId = m.ModuleId
            WHERE em.EventId = @eventId AND m.IsActive = 1
            ORDER BY em.DeliveryOrder ASC
        `, { eventId: event.EventId });

        // Format response with camelCase
        const eventData = {
            eventId: event.EventId,
            eventCode: event.EventCode,
            startDate: event.StartDate,
            endDate: event.EndDate,
            cohortId: event.CohortId,
            isActive: event.IsActive,
            createdAt: event.CreatedAt,
            modules: modulesResult.map(m => ({
                eventModuleId: m.EventModuleId,
                moduleId: m.ModuleId,
                moduleName: m.ModuleName,
                speakerName: m.SpeakerName,
                description: m.Description,
                deliveryOrder: m.DeliveryOrder,
                deliveryDate: m.DeliveryDate,
                notes: m.Notes,
                isActive: m.IsActive
            }))
        };

        // Cache the result
        cacheSet(cacheKey, eventData, 300); // 5 minutes

        context.res = success(eventData);
    } catch (err) {
        context.log.error('Error in GetEvent:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
