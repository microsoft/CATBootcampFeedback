/**
 * Get Feedback Count for Event
 * GET /api/events/{code}/count
 */

const { query } = require('../shared/database');
const { success, error, validateEventCode } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const eventCode = context.bindingData.code;

        // Validate event code format
        if (!validateEventCode(eventCode)) {
            context.res = error(400, 'Invalid event code format', 'INVALID_EVENT_CODE');
            return;
        }

        // Get count from database
        const result = await query(
            `SELECT COUNT(*) as count
             FROM Feedback f
             INNER JOIN Events e ON f.EventId = e.EventId
             WHERE e.EventCode = @eventCode AND e.IsActive = 1`,
            { eventCode }
        );

        const count = result && result.length > 0 ? result[0].count : 0;

        context.res = success({ count, eventCode });
    } catch (err) {
        context.log.error('Error in GetFeedbackCount:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
