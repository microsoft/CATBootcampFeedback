/**
 * Create Module with Event
 * POST /api/modules-with-event
 *
 * Creates a new module AND an event in one transaction
 * Convenience endpoint for quick module + event creation
 */

const { query } = require('../shared/database');
const { success, error, sanitize } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const {
            moduleName,
            speakerName,
            description,
            eventCode,
            startDate,
            endDate,
            cohortId,
            isActive = true
        } = req.body;

        // Validate required fields
        if (!moduleName || !speakerName || !eventCode || !startDate) {
            context.res = error(400, 'Module name, speaker name, event code, and start date are required', 'INVALID_DATA');
            return;
        }

        // Validate event code length
        if (eventCode.trim().length < 3 || eventCode.trim().length > 50) {
            context.res = error(400, 'Event code must be between 3 and 50 characters', 'INVALID_DATA');
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

        // Sanitize inputs
        const sanitizedModuleName = sanitize(moduleName);
        const sanitizedSpeakerName = sanitize(speakerName);
        const sanitizedDescription = description ? sanitize(description) : null;
        const sanitizedCohortId = cohortId ? sanitize(cohortId) : null;

        // Validate lengths
        if (sanitizedModuleName.length < 5 || sanitizedModuleName.length > 200) {
            context.res = error(400, 'Module name must be between 5 and 200 characters', 'INVALID_DATA');
            return;
        }

        if (sanitizedSpeakerName.length < 2 || sanitizedSpeakerName.length > 100) {
            context.res = error(400, 'Speaker name must be between 2 and 100 characters', 'INVALID_DATA');
            return;
        }

        // Begin transaction - create module
        const moduleResult = await query(`
            INSERT INTO Modules (ModuleName, SpeakerName, Description, IsActive, CreatedBy)
            OUTPUT INSERTED.ModuleId
            VALUES (@moduleName, @speakerName, @description, @isActive, @createdBy)
        `, {
            moduleName: sanitizedModuleName,
            speakerName: sanitizedSpeakerName,
            description: sanitizedDescription,
            isActive: isActive ? 1 : 0,
            createdBy: 'admin' // TODO: Get from auth context
        });

        const moduleId = moduleResult[0].ModuleId;

        // Create event for the module
        await query(`
            INSERT INTO Events (EventCode, ModuleId, StartDate, EndDate, CohortId, IsActive, CreatedBy)
            VALUES (@eventCode, @moduleId, @startDate, @endDate, @cohortId, @isActive, @createdBy)
        `, {
            eventCode,
            moduleId,
            startDate,
            endDate: endDate || null,
            cohortId: sanitizedCohortId,
            isActive: isActive ? 1 : 0,
            createdBy: 'admin'
        });

        // Get complete event with module details
        const result = await query(`
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
                e.IsActive AS EventIsActive,
                m.IsActive AS ModuleIsActive,
                e.CreatedAt
            FROM Events e
            INNER JOIN Modules m ON e.ModuleId = m.ModuleId
            WHERE e.EventCode = @eventCode
        `, { eventCode });

        context.res = success({
            message: 'Module and event created successfully',
            module: {
                moduleId,
                moduleName: sanitizedModuleName,
                speakerName: sanitizedSpeakerName,
                description: sanitizedDescription
            },
            event: result[0],
            feedbackUrl: `https://yoursite.com/feedback.html?code=${eventCode}`
        }, 201);

    } catch (err) {
        context.log.error('Error creating module with event:', err);
        context.res = error(500, 'Error creating module and event', 'SERVER_ERROR');
    }
};
