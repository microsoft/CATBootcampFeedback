/**
 * Update Module API
 * PUT /api/modules/{moduleId} (REQUIRES AUTH)
 *
 * Updates module details (name, description, active status)
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { audit } = require('../shared/audit');

app.http('updateModule', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'modules/{moduleId}',
    handler: async (request, context) => {
        // GlobalAdmin or ModuleManager can edit modules
        const roleError = requireRole(request, 'ModuleManager');
        if (roleError) return roleError;

        try {
            const moduleId = request.params.moduleId;

            if (!moduleId) {
                const errorResponse = error(400, 'Module ID is required', 'INVALID_REQUEST');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Parse request body
            const bodyText = await request.text();
            const body = JSON.parse(bodyText);
            const { moduleName, description, isActive } = body;

            // Validate required fields
            if (!moduleName) {
                const errorResponse = error(400, 'Module name is required', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Validate lengths
            if (moduleName.length < 5 || moduleName.length > 200) {
                const errorResponse = error(400, 'Module name must be between 5 and 200 characters', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Check if module exists
            const moduleCheck = await query(
                'SELECT ModuleId FROM Modules WHERE ModuleId = @moduleId',
                { moduleId: parseInt(moduleId) }
            );

            if (moduleCheck.length === 0) {
                const errorResponse = error(404, 'Module not found', 'NOT_FOUND');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Check if module name is already used by another module
            const nameCheck = await query(
                'SELECT ModuleId FROM Modules WHERE ModuleName = @moduleName AND ModuleId != @moduleId',
                { moduleName: moduleName.trim(), moduleId: parseInt(moduleId) }
            );

            if (nameCheck.length > 0) {
                const errorResponse = error(400, 'Module name already exists', 'DUPLICATE_NAME');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Update module
            await query(`
                UPDATE Modules
                SET ModuleName = @moduleName,
                    Description = @description,
                    IsActive = @isActive,
                    UpdatedAt = GETDATE(),
                    UpdatedBy = @updatedBy
                WHERE ModuleId = @moduleId
            `, {
                moduleId: parseInt(moduleId),
                moduleName: moduleName.trim(),
                description: description ? description.trim() : null,
                isActive: isActive ? 1 : 0,
                updatedBy: (getAuthenticatedUser(request) || {}).username || 'admin'
            });

            context.log(`Module ${moduleId} updated successfully`);
            await audit(request, 'UPDATE', 'Module', parseInt(moduleId), `Updated module "${moduleName.trim()}"`, { moduleId: parseInt(moduleId), moduleName: moduleName.trim(), description, isActive });

            const response = success({
                message: 'Module updated successfully',
                moduleId: parseInt(moduleId)
            });

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error updating module:', err);
            const errorResponse = error(500, `Error updating module: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});
