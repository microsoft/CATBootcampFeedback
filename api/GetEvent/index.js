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

        // Query database
        const result = await query(
            `SELECT EventId, EventCode, ModuleName, ModuleDate, SpeakerName, CohortId,
                    Description, IsActive, CreatedAt
             FROM Events
             WHERE EventCode = @eventCode AND IsActive = 1`,
            { eventCode }
        );

        if (!result || result.length === 0) {
            context.res = error(404, 'Event not found or inactive', 'EVENT_NOT_FOUND');
            return;
        }

        const event = result[0];

        // Cache the result
        cacheSet(cacheKey, event, 300); // 5 minutes

        context.res = success(event);
    } catch (err) {
        context.log.error('Error in GetEvent:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
