/**
 * Diagnostic endpoint to check EventModule data
 */

const { query } = require('../src/shared/database');
const { success } = require('../src/shared/utils');

module.exports = async function (context, req) {
    try {
        const eventModuleId = parseInt(req.query.id || context.bindingData.id || 7);

        // Get raw EventModule data
        const eventModule = await query(`
            SELECT * FROM EventModules WHERE EventModuleId = @id
        `, { id: eventModuleId });

        // Get event for this module
        const event = eventModule[0] ? await query(`
            SELECT * FROM Events WHERE EventId = @eventId
        `, { eventId: eventModule[0].EventId }) : [];

        // Get module for this module
        const module = eventModule[0] ? await query(`
            SELECT * FROM Modules WHERE ModuleId = @moduleId
        `, { moduleId: eventModule[0].ModuleId }) : [];

        // Try the GetEventModule query
        const getEventModuleResult = event[0] ? await query(`
            SELECT e.EventCode, em.EventModuleId, m.ModuleName,
                   e.IsActive AS EventActive, m.IsActive AS ModuleActive
            FROM Events e
            INNER JOIN EventModules em ON e.EventId = em.EventId
            INNER JOIN Modules m ON em.ModuleId = m.ModuleId
            WHERE e.EventCode = @eventCode
              AND em.EventModuleId = @eventModuleId
              AND e.IsActive = 1
              AND m.IsActive = 1
        `, { eventCode: event[0].EventCode, eventModuleId }) : [];

        context.res = success({
            eventModuleId,
            rawEventModule: eventModule[0] || null,
            relatedEvent: event[0] || null,
            relatedModule: module[0] || null,
            getEventModuleQueryResult: getEventModuleResult[0] || null,
            diagnosis: {
                eventModuleExists: eventModule.length > 0,
                eventExists: event.length > 0,
                moduleExists: module.length > 0,
                getEventModuleWorks: getEventModuleResult.length > 0
            }
        });
    } catch (err) {
        context.log.error('Diagnostic error:', err);
        context.res = {
            status: 500,
            body: { error: err.message, stack: err.stack }
        };
    }
};
