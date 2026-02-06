/**
 * Update Event Status API
 * PUT /api/events/{eventId}/status
 *
 * Updates the IsActive status of an event
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

app.http('updateEventStatus', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'events/{eventId}/status',
    handler: async (request, context) => {
        try {
            const eventId = request.params.eventId;

            if (!eventId) {
                const errorResponse = error(400, 'Event ID is required', 'INVALID_REQUEST');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Parse request body
            const bodyText = await request.text();
            const body = JSON.parse(bodyText);
            const { isActive } = body;

            if (typeof isActive !== 'boolean') {
                const errorResponse = error(400, 'isActive must be a boolean value', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Check if event exists
            const eventCheck = await query(
                'SELECT EventId FROM Events WHERE EventId = @eventId',
                { eventId: parseInt(eventId) }
            );

            if (eventCheck.length === 0) {
                const errorResponse = error(404, 'Event not found', 'NOT_FOUND');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Update event status
            await query(`
                UPDATE Events
                SET IsActive = @isActive
                WHERE EventId = @eventId
            `, {
                eventId: parseInt(eventId),
                isActive: isActive ? 1 : 0
            });

            context.log(`Event ${eventId} status updated to ${isActive ? 'active' : 'inactive'}`);

            const response = success({
                message: `Event ${isActive ? 'activated' : 'deactivated'} successfully`,
                eventId: parseInt(eventId),
                isActive: isActive
            });

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error updating event status:', err);
            const errorResponse = error(500, `Error updating event status: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});
