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
        const { moduleName, description, isActive = true } = req.body;

        // Validate required fields
        if (!moduleName) {
            context.res = error(400, 'Module name is required', 'INVALID_DATA');
            return;
        }

        // Sanitize inputs
        const sanitizedModuleName = sanitize(moduleName);
        const sanitizedDescription = description ? sanitize(description) : null;

        // Validate lengths
        if (sanitizedModuleName.length < 5 || sanitizedModuleName.length > 200) {
            context.res = error(400, 'Module name must be between 5 and 200 characters', 'INVALID_DATA');
            return;
        }

        // Insert module
        const result = await query(`
            INSERT INTO Modules (ModuleName, Description, IsActive, CreatedBy)
            OUTPUT INSERTED.ModuleId, INSERTED.ModuleName,
                   INSERTED.Description, INSERTED.IsActive, INSERTED.CreatedAt
            VALUES (@moduleName, @description, @isActive, @createdBy)
        `, {
            moduleName: sanitizedModuleName,
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
