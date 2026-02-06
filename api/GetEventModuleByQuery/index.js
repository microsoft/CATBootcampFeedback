/**
 * Get Event Module using query parameters instead of path parameters
 * GET /api/module?code={eventCode}&id={eventModuleId}
 */

const { query } = require('../src/shared/database');
const { success, error, validateEventCode } = require('../src/shared/utils');

module.exports = async function (context, req) {
    try {
        const eventCode = req.query.code;
        const eventModuleId = parseInt(req.query.id);

        context.log('GetEventModuleByQuery called:', { eventCode, eventModuleId });

        if (!eventCode || !validateEventCode(eventCode)) {
            context.res = error(400, 'Missing or invalid event code', 'INVALID_EVENT_CODE');
            return;
        }

        if (!eventModuleId || isNaN(eventModuleId)) {
            context.res = error(400, 'Missing or invalid module ID', 'INVALID_MODULE_ID');
            return;
        }

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
            context.res = error(404, `Module not found: code=${eventCode}, id=${eventModuleId}`, 'NOT_FOUND');
            return;
        }

        const data = result[0];

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

        context.res = success(moduleData);
    } catch (err) {
        context.log.error('Error:', err);
        context.res = error(500, err.message, 'SERVER_ERROR');
    }
};
