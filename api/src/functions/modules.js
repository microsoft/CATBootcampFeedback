/**
 * Get All Modules
 * GET /api/modules
 *
 * Returns all training modules (timeless content)
 * Modules don't have dates - they are reusable training content
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

app.http('modules', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'modules',
    handler: async (request, context) => {
        try {
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
                jsonBody: response.body
            };
        } catch (err) {
            context.log('Error getting modules:', err);
            const errorResponse = error(500, 'Error retrieving modules', 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                jsonBody: errorResponse.body
            };
        }
    }
});
