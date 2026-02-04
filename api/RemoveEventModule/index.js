/**
 * Remove Event Module
 * DELETE /api/event-modules/{eventModuleId}
 *
 * Removes a module from an event (deletes the event-module association)
 */

const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const eventModuleId = req.params.eventModuleId;

        if (!eventModuleId) {
            context.res = error(400, 'Event Module ID is required', 'INVALID_DATA');
            return;
        }

        // Check if event-module association exists
        const existing = await query(
            `SELECT EventModuleId FROM EventModules WHERE EventModuleId = @eventModuleId`,
            { eventModuleId }
        );

        if (existing.length === 0) {
            context.res = error(404, 'Event-module association not found', 'NOT_FOUND');
            return;
        }

        // Delete the association
        await query(
            `DELETE FROM EventModules WHERE EventModuleId = @eventModuleId`,
            { eventModuleId }
        );

        context.res = success({
            message: 'Module removed from event successfully'
        });

    } catch (err) {
        context.log.error('Error removing event module:', err);
        context.res = error(500, 'Error removing module from event', 'SERVER_ERROR');
    }
};
