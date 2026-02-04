/**
 * Create Module
 * POST /api/modules
 *
 * Creates a new training module (timeless content)
 * Modules don't have dates - they are reusable training content
 */

const { query } = require('../shared/database');
const { success, error, sanitize } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const { moduleName, speakerName, description, isActive = true } = req.body;

        // Validate required fields
        if (!moduleName || !speakerName) {
            context.res = error(400, 'Module name and speaker name are required', 'INVALID_DATA');
            return;
        }

        // Sanitize inputs
        const sanitizedModuleName = sanitize(moduleName);
        const sanitizedSpeakerName = sanitize(speakerName);
        const sanitizedDescription = description ? sanitize(description) : null;

        // Validate lengths
        if (sanitizedModuleName.length < 5 || sanitizedModuleName.length > 200) {
            context.res = error(400, 'Module name must be between 5 and 200 characters', 'INVALID_DATA');
            return;
        }

        if (sanitizedSpeakerName.length < 2 || sanitizedSpeakerName.length > 100) {
            context.res = error(400, 'Speaker name must be between 2 and 100 characters', 'INVALID_DATA');
            return;
        }

        // Insert module
        const result = await query(`
            INSERT INTO Modules (ModuleName, SpeakerName, Description, IsActive, CreatedBy)
            OUTPUT INSERTED.ModuleId, INSERTED.ModuleName, INSERTED.SpeakerName,
                   INSERTED.Description, INSERTED.IsActive, INSERTED.CreatedAt
            VALUES (@moduleName, @speakerName, @description, @isActive, @createdBy)
        `, {
            moduleName: sanitizedModuleName,
            speakerName: sanitizedSpeakerName,
            description: sanitizedDescription,
            isActive: isActive ? 1 : 0,
            createdBy: 'admin' // TODO: Get from auth context
        });

        const createdModule = result[0];

        context.res = success({
            message: 'Module created successfully',
            module: {
                moduleId: createdModule.ModuleId,
                moduleName: createdModule.ModuleName,
                speakerName: createdModule.SpeakerName,
                description: createdModule.Description,
                isActive: createdModule.IsActive,
                createdAt: createdModule.CreatedAt
            }
        }, 201);

    } catch (err) {
        context.log.error('Error creating module:', err);
        context.res = error(500, 'Error creating module', 'SERVER_ERROR');
    }
};
