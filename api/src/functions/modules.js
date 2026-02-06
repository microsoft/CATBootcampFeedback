/**
 * Modules API
 * GET /api/modules - Get all modules
 * POST /api/modules - Create new module
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

app.http('modules', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'modules',
    handler: async (request, context) => {
        try {
            if (request.method === 'GET') {
                // Get all modules
                const modules = await query(`
                    SELECT
                        ModuleId,
                        ModuleName,
                        Description,
                        IsActive,
                        CreatedAt,
                        CreatedBy,
                        UpdatedAt,
                        UpdatedBy
                    FROM Modules
                    ORDER BY ModuleName ASC
                `);

                // Get event counts for each module (via EventModules junction table)
                const modulesWithCounts = await Promise.all(
                    modules.map(async (module) => {
                        const eventCount = await query(
                            `SELECT COUNT(DISTINCT EventId) AS EventCount FROM EventModules WHERE ModuleId = @moduleId`,
                            { moduleId: module.ModuleId }
                        );

                        const feedbackCount = await query(`
                            SELECT COUNT(*) AS FeedbackCount
                            FROM Feedback f
                            INNER JOIN EventModules em ON f.EventModuleId = em.EventModuleId
                            WHERE em.ModuleId = @moduleId
                        `, { moduleId: module.ModuleId });

                        return {
                            moduleId: module.ModuleId,
                            moduleName: module.ModuleName,
                            description: module.Description,
                            isActive: module.IsActive,
                            createdAt: module.CreatedAt,
                            createdBy: module.CreatedBy,
                            updatedAt: module.UpdatedAt,
                            updatedBy: module.UpdatedBy,
                            eventCount: eventCount[0]?.EventCount || 0,
                            feedbackCount: feedbackCount[0]?.FeedbackCount || 0
                        };
                    })
                );

                const response = success(modulesWithCounts);
                return {
                    status: response.status,
                    headers: response.headers,
                    body: response.body  // Use 'body' not 'jsonBody' since response.body is already stringified
                };

            } else if (request.method === 'POST') {
                // Create new module
                const bodyText = await request.text();
                const body = JSON.parse(bodyText);

                const { moduleName, description, isActive = true } = body;

                // Validate required fields
                if (!moduleName) {
                    const errorResponse = error(400, 'Module name is required', 'INVALID_DATA');
                    return {
                        status: errorResponse.status,
                        headers: errorResponse.headers,
                        body: errorResponse.body  // Use 'body' not 'jsonBody' since errorResponse.body is already stringified
                    };
                }

                // Validate lengths
                if (moduleName.length < 5 || moduleName.length > 200) {
                    const errorResponse = error(400, 'Module name must be between 5 and 200 characters', 'INVALID_DATA');
                    return {
                        status: errorResponse.status,
                        headers: errorResponse.headers,
                        body: errorResponse.body  // Use 'body' not 'jsonBody' since errorResponse.body is already stringified
                    };
                }

                // Insert module
                const result = await query(`
                    INSERT INTO Modules (ModuleName, Description, IsActive, CreatedBy)
                    OUTPUT INSERTED.ModuleId, INSERTED.ModuleName,
                           INSERTED.Description, INSERTED.IsActive, INSERTED.CreatedAt
                    VALUES (@moduleName, @description, @isActive, @createdBy)
                `, {
                    moduleName: moduleName.trim(),
                    description: description ? description.trim() : null,
                    isActive: isActive ? 1 : 0,
                    createdBy: 'admin'
                });

                const createdModule = result[0];

                const response = success({
                    message: 'Module created successfully',
                    module: {
                        moduleId: createdModule.ModuleId,
                        moduleName: createdModule.ModuleName,
                        description: createdModule.Description,
                        isActive: createdModule.IsActive,
                        createdAt: createdModule.CreatedAt
                    }
                }, 201);

                return {
                    status: response.status,
                    headers: response.headers,
                    body: response.body  // Use 'body' not 'jsonBody' since response.body is already stringified
                };
            }

        } catch (err) {
            context.log('Error in modules API:', err);
            const errorResponse = error(500, 'Error processing request', 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body  // Use 'body' not 'jsonBody' since errorResponse.body is already stringified
            };
        }
    }
});

// DELETE single module
app.http('deleteModule', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'modules/{moduleId}',
    handler: async (request, context) => {
        try {
            const moduleId = parseInt(request.params.moduleId);

            if (!moduleId || isNaN(moduleId)) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid module ID', error: 'INVALID_ID' } };
            }

            // Check if module is used in any active events
            const activeEventUsage = await query(`
                SELECT COUNT(*) AS Count
                FROM EventModules em
                INNER JOIN Events e ON em.EventId = e.EventId
                WHERE em.ModuleId = @moduleId AND e.IsActive = 1
            `, { moduleId });

            if (activeEventUsage[0].Count > 0) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: `Cannot delete module: it is used in ${activeEventUsage[0].Count} active event(s)`,
                        error: 'MODULE_IN_USE'
                    }
                };
            }

            // Delete the module (this will fail if there are foreign key constraints)
            const result = await query('DELETE FROM Modules WHERE ModuleId = @moduleId', { moduleId });

            if (result.rowsAffected[0] === 0) {
                return { status: 404, jsonBody: { success: false, message: 'Module not found', error: 'NOT_FOUND' } };
            }

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Module deleted successfully',
                    data: { moduleId }
                }
            };

        } catch (err) {
            context.error('Error deleting module:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});

// DELETE multiple modules (bulk delete)
app.http('deleteModulesBulk', {
    methods: ['POST'],  // Using POST for bulk delete to send body
    authLevel: 'anonymous',
    route: 'modules/bulk-delete',
    handler: async (request, context) => {
        try {
            const data = await request.json();
            const { moduleIds } = data;

            if (!moduleIds || !Array.isArray(moduleIds) || moduleIds.length === 0) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid module IDs array', error: 'INVALID_DATA' } };
            }

            let deletedCount = 0;
            let skippedCount = 0;
            const skippedModules = [];

            for (const moduleId of moduleIds) {
                // Check if module is used in any active events
                const activeEventUsage = await query(`
                    SELECT COUNT(*) AS Count
                    FROM EventModules em
                    INNER JOIN Events e ON em.EventId = e.EventId
                    WHERE em.ModuleId = @moduleId AND e.IsActive = 1
                `, { moduleId });

                if (activeEventUsage[0].Count > 0) {
                    // Skip this module - it's in use
                    const moduleName = await query('SELECT ModuleName FROM Modules WHERE ModuleId = @moduleId', { moduleId });
                    skippedModules.push({
                        moduleId,
                        moduleName: moduleName[0]?.ModuleName || 'Unknown',
                        reason: `Used in ${activeEventUsage[0].Count} active event(s)`
                    });
                    skippedCount++;
                    continue;
                }

                // Delete the module
                const result = await query('DELETE FROM Modules WHERE ModuleId = @moduleId', { moduleId });
                if (result.rowsAffected[0] > 0) {
                    deletedCount++;
                }
            }

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `Deleted ${deletedCount} module(s), skipped ${skippedCount}`,
                    data: {
                        deletedCount,
                        skippedCount,
                        skippedModules
                    }
                }
            };

        } catch (err) {
            context.error('Error in bulk delete modules:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});
