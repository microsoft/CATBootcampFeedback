/**
 * Update Event API
 * PUT /api/events/{eventId}
 *
 * Updates event details (code, dates, cohort, active status)
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

app.http('updateEvent', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'events/{eventId}',
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
            const { eventCode, startDate, endDate, cohortId, isActive } = body;

            // Validate required fields
            if (!eventCode || !startDate) {
                const errorResponse = error(400, 'Event code and start date are required', 'INVALID_DATA');
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

            // Check if event code is already used by another event
            const codeCheck = await query(
                'SELECT EventId FROM Events WHERE EventCode = @eventCode AND EventId != @eventId',
                { eventCode, eventId: parseInt(eventId) }
            );

            if (codeCheck.length > 0) {
                const errorResponse = error(400, 'Event code already exists', 'DUPLICATE_CODE');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Update event
            await query(`
                UPDATE Events
                SET EventCode = @eventCode,
                    StartDate = @startDate,
                    EndDate = @endDate,
                    CohortId = @cohortId,
                    IsActive = @isActive
                WHERE EventId = @eventId
            `, {
                eventId: parseInt(eventId),
                eventCode: eventCode.trim(),
                startDate: startDate,
                endDate: endDate || null,
                cohortId: cohortId ? cohortId.trim() : null,
                isActive: isActive ? 1 : 0
            });

            context.log(`Event ${eventId} updated successfully`);

            const response = success({
                message: 'Event updated successfully',
                eventId: parseInt(eventId)
            });

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error updating event:', err);
            const errorResponse = error(500, `Error updating event: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});
