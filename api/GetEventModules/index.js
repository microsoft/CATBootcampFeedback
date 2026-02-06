/**
 * Get Event Modules
 * GET /api/events/{eventId}/modules
 *
 * Returns all modules associated with an event, including speakers and delivery info
 */

const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const eventId = req.params.eventId;

        if (!eventId) {
            context.res = error(400, 'Event ID is required', 'INVALID_DATA');
            return;
        }

        // Check if event exists
        const eventExists = await query(
            `SELECT EventId FROM Events WHERE EventId = @eventId`,
            { eventId }
        );
        if (eventExists.length === 0) {
            context.res = error(404, 'Event not found', 'NOT_FOUND');
            return;
        }

        // Get all modules for this event
        const modules = await query(`
            SELECT
                em.EventModuleId,
                em.EventId,
                em.ModuleId,
                m.ModuleName,
                em.SpeakerName,
                m.Description,
                em.DeliveryOrder,
                em.DeliveryDate,
                em.Notes,
                m.IsActive,
                em.CreatedAt,
                em.CreatedBy
            FROM EventModules em
            INNER JOIN Modules m ON em.ModuleId = m.ModuleId
            WHERE em.EventId = @eventId
            ORDER BY em.DeliveryOrder ASC
        `, { eventId });

        const formattedModules = modules.map(m => ({
            eventModuleId: m.EventModuleId,
            eventId: m.EventId,
            moduleId: m.ModuleId,
            moduleName: m.ModuleName,
            speakerName: m.SpeakerName,
            description: m.Description,
            deliveryOrder: m.DeliveryOrder,
            deliveryDate: m.DeliveryDate,
            notes: m.Notes,
            isActive: m.IsActive,
            createdAt: m.CreatedAt,
            createdBy: m.CreatedBy
        }));

        context.res = success(formattedModules);

    } catch (err) {
        context.log.error('Error getting event modules:', err);
        context.res = error(500, 'Error retrieving event modules', 'SERVER_ERROR');
    }
};
