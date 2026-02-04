const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    context.log('DeleteEvent function triggered');

    try {
        const eventId = context.bindingData.id;

        if (!eventId) {
            return error(400, 'Event ID is required', 'INVALID_REQUEST');
        }

        // Check if event exists
        const checkResult = await query(
            'SELECT EventId, EventCode FROM Events WHERE EventId = @eventId',
            { eventId }
        );

        if (checkResult.recordset.length === 0) {
            context.res = error(404, 'Event not found', 'EVENT_NOT_FOUND');
            return;
        }

        // Check if there's any feedback for this event
        const feedbackCheck = await query(
            'SELECT COUNT(*) as count FROM Feedback WHERE EventId = @eventId',
            { eventId }
        );

        const feedbackCount = feedbackCheck.recordset[0].count;

        // Delete feedback first (cascade delete)
        if (feedbackCount > 0) {
            context.log(`Deleting ${feedbackCount} feedback entries for event ${eventId}`);
            await query('DELETE FROM Feedback WHERE EventId = @eventId', { eventId });
        }

        // Delete the event
        await query('DELETE FROM Events WHERE EventId = @eventId', { eventId });

        context.log(`Event ${eventId} deleted successfully`);
        context.res = success({
            message: 'Event deleted successfully',
            eventId: parseInt(eventId),
            feedbackDeleted: feedbackCount
        });

    } catch (err) {
        context.log.error('Error deleting event:', err);
        context.res = error(500, 'Failed to delete event', 'SERVER_ERROR');
    }
};
