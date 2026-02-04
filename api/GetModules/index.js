/**
 * Get All Modules
 * GET /api/modules
 *
 * Returns all training modules (timeless content)
 * Modules don't have dates - they are reusable training content
 */

const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        // Get all modules
        const modules = await query(`
            SELECT
                ModuleId,
                ModuleName,
                SpeakerName,
                Description,
                IsActive,
                CreatedAt,
                CreatedBy,
                UpdatedAt,
                UpdatedBy
            FROM Modules
            ORDER BY ModuleName ASC
        `);

        // Get event counts for each module
        const modulesWithCounts = await Promise.all(
            modules.map(async (module) => {
                const eventCount = await query(
                    `SELECT COUNT(*) AS EventCount FROM Events WHERE ModuleId = @moduleId`,
                    { moduleId: module.ModuleId }
                );

                const feedbackCount = await query(`
                    SELECT COUNT(*) AS FeedbackCount
                    FROM Feedback f
                    INNER JOIN Events e ON f.EventId = e.EventId
                    WHERE e.ModuleId = @moduleId
                `, { moduleId: module.ModuleId });

                return {
                    moduleId: module.ModuleId,
                    moduleName: module.ModuleName,
                    speakerName: module.SpeakerName,
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

        context.res = success(modulesWithCounts);
    } catch (err) {
        context.log.error('Error getting modules:', err);
        context.res = error(500, 'Error retrieving modules', 'SERVER_ERROR');
    }
};
