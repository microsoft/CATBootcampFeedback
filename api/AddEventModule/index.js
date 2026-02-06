/**
 * Add Event Module
 * POST /api/event-modules
 *
 * Associates a module with an event, specifying the speaker for this delivery
 */

const { query } = require('../shared/database');
const { success, error, sanitize } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const { eventId, moduleId, speakerName, deliveryOrder = 1, deliveryDate, notes } = req.body;

        // Validate required fields
        if (!eventId || !moduleId || !speakerName) {
            context.res = error(400, 'Event ID, Module ID, and Speaker Name are required', 'INVALID_DATA');
            return;
        }

        // Sanitize inputs
        const sanitizedSpeakerName = sanitize(speakerName);
        const sanitizedNotes = notes ? sanitize(notes) : null;

        // Validate speaker name length
        if (sanitizedSpeakerName.length < 2 || sanitizedSpeakerName.length > 100) {
            context.res = error(400, 'Speaker name must be between 2 and 100 characters', 'INVALID_DATA');
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

        // Check if module exists
        const moduleExists = await query(
            `SELECT ModuleId FROM Modules WHERE ModuleId = @moduleId`,
            { moduleId }
        );
        if (moduleExists.length === 0) {
            context.res = error(404, 'Module not found', 'NOT_FOUND');
            return;
        }

        // Check if this event-module combination already exists
        const existing = await query(
            `SELECT EventModuleId FROM EventModules WHERE EventId = @eventId AND ModuleId = @moduleId`,
            { eventId, moduleId }
        );
        if (existing.length > 0) {
            context.res = error(409, 'This module is already added to this event', 'DUPLICATE');
            return;
        }

        // Insert event-module association
        const result = await query(`
            INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, Notes, CreatedBy)
            OUTPUT INSERTED.EventModuleId, INSERTED.EventId, INSERTED.ModuleId,
                   INSERTED.SpeakerName, INSERTED.DeliveryOrder, INSERTED.DeliveryDate,
                   INSERTED.Notes, INSERTED.CreatedAt
            VALUES (@eventId, @moduleId, @speakerName, @deliveryOrder, @deliveryDate, @notes, @createdBy)
        `, {
            eventId,
            moduleId,
            speakerName: sanitizedSpeakerName,
            deliveryOrder: deliveryOrder || 1,
            deliveryDate: deliveryDate || null,
            notes: sanitizedNotes,
            createdBy: 'admin' // TODO: Get from auth context
        });

        const created = result[0];

        context.res = success({
            message: 'Module added to event successfully',
            eventModule: {
                eventModuleId: created.EventModuleId,
                eventId: created.EventId,
                moduleId: created.ModuleId,
                speakerName: created.SpeakerName,
                deliveryOrder: created.DeliveryOrder,
                deliveryDate: created.DeliveryDate,
                notes: created.Notes,
                createdAt: created.CreatedAt
            }
        }, 201);

    } catch (err) {
        context.log.error('Error adding event module:', err);
        context.res = error(500, 'Error adding module to event', 'SERVER_ERROR');
    }
};
