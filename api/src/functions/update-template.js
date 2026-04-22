/**
 * Update Template API
 * PUT /api/templates/{templateId} (REQUIRES AUTH)
 *
 * Updates template details and replaces its module list.
 */

const { app } = require('@azure/functions');
const { query, withTransaction } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { audit } = require('../shared/audit');

app.http('updateTemplate', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'templates/{templateId}',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'ModuleManager');
        if (roleError) return roleError;

        try {
            const templateId = request.params.templateId;

            if (!templateId) {
                const errorResponse = error(400, 'Template ID is required', 'INVALID_REQUEST');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const bodyText = await request.text();
            const body = JSON.parse(bodyText);
            const { templateName, description, trainingTrack, isActive, modules = [] } = body;

            if (!templateName) {
                const errorResponse = error(400, 'Template name is required', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const trimmedName = templateName.trim();

            if (trimmedName.length < 3 || trimmedName.length > 200) {
                const errorResponse = error(400, 'Template name must be between 3 and 200 characters', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Check if template exists
            const templateCheck = await query(
                'SELECT TemplateId FROM EventTemplates WHERE TemplateId = @templateId',
                { templateId: parseInt(templateId) }
            );

            if (templateCheck.length === 0) {
                const errorResponse = error(404, 'Template not found', 'NOT_FOUND');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const username = (getAuthenticatedUser(request) || {}).username || 'admin';

            // Update metadata and replace module list atomically so a mid-flight
            // failure can't leave the template with its old modules wiped.
            await withTransaction(async (tx) => {
                await tx.query(`
                    UPDATE EventTemplates
                    SET TemplateName = @templateName,
                        Description = @description,
                        TrainingTrack = @trainingTrack,
                        IsActive = @isActive,
                        UpdatedAt = SYSUTCDATETIME(),
                        UpdatedBy = @updatedBy
                    WHERE TemplateId = @templateId
                `, {
                    templateId: parseInt(templateId),
                    templateName: trimmedName,
                    description: description ? description.trim() : null,
                    trainingTrack: trainingTrack ? trainingTrack.trim() : null,
                    isActive: isActive !== undefined ? (isActive ? 1 : 0) : 1,
                    updatedBy: username
                });

                await tx.mutate(
                    'DELETE FROM EventTemplateModules WHERE TemplateId = @templateId',
                    { templateId: parseInt(templateId) }
                );

                for (const mod of modules) {
                    if (!mod.moduleId) continue;
                    await tx.mutate(`
                        INSERT INTO EventTemplateModules (TemplateId, ModuleId, DeliveryOrder, Notes)
                        VALUES (@templateId, @moduleId, @deliveryOrder, @notes)
                    `, {
                        templateId: parseInt(templateId),
                        moduleId: mod.moduleId,
                        deliveryOrder: mod.deliveryOrder || 1,
                        notes: mod.notes ? mod.notes.trim() : null
                    });
                }
            });

            context.log(`Template ${templateId} updated successfully`);

            await audit(request, 'UPDATE', 'Template', parseInt(templateId),
                `Updated template "${trimmedName}" with ${modules.length} module(s)`,
                { templateId: parseInt(templateId), templateName: trimmedName, moduleCount: modules.length }
            );

            const response = success({
                message: 'Template updated successfully',
                templateId: parseInt(templateId)
            });

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error updating template:', err);
            const errorResponse = error(500, `Error updating template: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});
