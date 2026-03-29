/**
 * Update Event API
 * PUT /api/events/{eventId}
 *
 * Updates event details (code, dates, training track, active status)
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { hasEventAccess } = require('../shared/permissions');
const { audit } = require('../shared/audit');

app.http('updateEvent', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'events/{eventId}',
    handler: async (request, context) => {
        try {
            // GlobalAdmin or EventCreator (with resource access) can edit events
            const roleError = requireRole(request, 'EventCreator');
            if (roleError) return roleError;

            // Resource-level access check for non-GlobalAdmin
            const caller = getAuthenticatedUser(request);
            const parsedEventId = parseInt(request.params.eventId);
            if (caller && !caller.roles.includes('GlobalAdmin')) {
                const canAccess = await hasEventAccess(caller.userId, caller.username, caller.roles, parsedEventId);
                if (!canAccess) {
                    const { error: errorFn } = require('../shared/utils');
                    const errorResponse = errorFn(403, 'You do not have access to this event', 'FORBIDDEN');
                    return { status: errorResponse.status, headers: errorResponse.headers, body: errorResponse.body };
                }
            }

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
            const { eventName, eventCode, startDate, endDate, trainingTrack, isActive } = body;

            // Validate required fields
            if (!eventName || !eventCode || !startDate) {
                const errorResponse = error(400, 'Event name, event code, and start date are required', 'INVALID_DATA');
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
                SET EventName = @eventName,
                    EventCode = @eventCode,
                    StartDate = @startDate,
                    EndDate = @endDate,
                    TrainingTrack = @trainingTrack,
                    IsActive = @isActive
                WHERE EventId = @eventId
            `, {
                eventId: parseInt(eventId),
                eventName: eventName.trim(),
                eventCode: eventCode.trim(),
                startDate: startDate,
                endDate: endDate || null,
                trainingTrack: trainingTrack ? trainingTrack.trim() : null,
                isActive: isActive ? 1 : 0
            });

            context.log(`Event ${eventId} updated successfully`);
            await audit(request, 'UPDATE', 'Event', parseInt(eventId), `Updated event "${eventName.trim()}" (${eventCode.trim()})`, { eventId: parseInt(eventId), eventName: eventName.trim(), eventCode: eventCode.trim(), startDate, endDate, trainingTrack, isActive });

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
