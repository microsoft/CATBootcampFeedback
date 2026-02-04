/**
 * Get All Events with Module Details
 * GET /api/events
 *
 * Returns all events with their associated module information and feedback counts
 * Used by admin panel to list events
 */

const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        // Get all events with module details and feedback counts
        const events = await query(`
            SELECT
                e.EventId,
                e.EventCode,
                e.ModuleId,
                m.ModuleName,
                m.SpeakerName,
                m.Description AS ModuleDescription,
                e.StartDate,
                e.EndDate,
                e.CohortId,
                e.IsActive AS EventIsActive,
                m.IsActive AS ModuleIsActive,
                e.CreatedAt,
                e.CreatedBy,
                COUNT(f.FeedbackId) AS FeedbackCount
            FROM Events e
            INNER JOIN Modules m ON e.ModuleId = m.ModuleId
            LEFT JOIN Feedback f ON e.EventId = f.EventId
            GROUP BY
                e.EventId, e.EventCode, e.ModuleId, m.ModuleName, m.SpeakerName,
                m.Description, e.StartDate, e.EndDate, e.CohortId,
                e.IsActive, m.IsActive, e.CreatedAt, e.CreatedBy
            ORDER BY e.CreatedAt DESC
        `);

        // Format response to match frontend expectations
        const formattedEvents = events.map(event => ({
            eventId: event.EventId,
            eventCode: event.EventCode,
            moduleId: event.ModuleId,
            moduleName: event.ModuleName,
            speakerName: event.SpeakerName,
            moduleDescription: event.ModuleDescription,
            startDate: event.StartDate,
            endDate: event.EndDate,
            cohortId: event.CohortId,
            isActive: event.EventIsActive,
            moduleIsActive: event.ModuleIsActive,
            createdAt: event.CreatedAt,
            createdBy: event.CreatedBy,
            feedbackCount: event.FeedbackCount || 0
        }));

        context.res = success(formattedEvents);
    } catch (err) {
        context.log.error('Error in GetEvents:', err);
        context.log.error('Error details:', err.message, err.stack);
        context.res = error(500, `Error retrieving events: ${err.message}`, 'SERVER_ERROR');
    }
};
