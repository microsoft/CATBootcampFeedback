/**
 * Create Event
 * POST /api/events
 *
 * Creates a new event for a module (delivery instance with dates)
 * Events link to modules and have start/end dates
 */

const { query } = require('../shared/database');
const { success, error, sanitize } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const { eventCode, moduleId, startDate, endDate, cohortId, isActive = true } = req.body;

        // Validate required fields
        if (!eventCode || !moduleId || !startDate) {
            context.res = error(400, 'Event code, module ID, and start date are required', 'INVALID_DATA');
            return;
        }

        // Validate event code length
        if (eventCode.trim().length < 3 || eventCode.trim().length > 50) {
            context.res = error(400, 'Event code must be between 3 and 50 characters', 'INVALID_DATA');
            return;
        }

        // Check if module exists
        const moduleCheck = await query(
            `SELECT ModuleId FROM Modules WHERE ModuleId = @moduleId AND IsActive = 1`,
            { moduleId }
        );

        if (!moduleCheck || moduleCheck.length === 0) {
            context.res = error(404, 'Module not found or inactive', 'MODULE_NOT_FOUND');
            return;
        }

        // Check if event code already exists
        const eventCodeCheck = await query(
            `SELECT EventId FROM Events WHERE EventCode = @eventCode`,
            { eventCode }
        );

        if (eventCodeCheck && eventCodeCheck.length > 0) {
            context.res = error(409, 'Event code already exists', 'DUPLICATE_EVENT_CODE');
            return;
        }

        // Sanitize optional fields
        const sanitizedCohortId = cohortId ? sanitize(cohortId) : null;

        // Insert event
        const result = await query(`
            INSERT INTO Events (EventCode, ModuleId, StartDate, EndDate, CohortId, IsActive, CreatedBy)
            OUTPUT INSERTED.EventId, INSERTED.EventCode, INSERTED.ModuleId,
                   INSERTED.StartDate, INSERTED.EndDate, INSERTED.CohortId,
                   INSERTED.IsActive, INSERTED.CreatedAt
            VALUES (@eventCode, @moduleId, @startDate, @endDate, @cohortId, @isActive, @createdBy)
        `, {
            eventCode,
            moduleId,
            startDate,
            endDate: endDate || null,
            cohortId: sanitizedCohortId,
            isActive: isActive ? 1 : 0,
            createdBy: 'admin' // TODO: Get from auth context
        });

        // Get event with module details
        const eventWithModule = await query(`
            SELECT
                e.EventId,
                e.EventCode,
                e.ModuleId,
                m.ModuleName,
                m.SpeakerName,
                m.Description,
                e.StartDate,
                e.EndDate,
                e.CohortId,
                e.IsActive,
                e.CreatedAt
            FROM Events e
            INNER JOIN Modules m ON e.ModuleId = m.ModuleId
            WHERE e.EventId = @eventId
        `, { eventId: result[0].EventId });

        context.res = success({
            message: 'Event created successfully',
            event: eventWithModule[0]
        }, 201);

    } catch (err) {
        context.log.error('Error creating event:', err);
        context.res = error(500, 'Error creating event', 'SERVER_ERROR');
    }
};
