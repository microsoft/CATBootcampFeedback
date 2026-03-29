/**
 * Update Speaker API
 * PUT /api/speakers/{speakerId} (REQUIRES AUTH)
 *
 * Updates speaker details (name, bio, profile image, active status).
 * When name changes, also updates the denormalized SpeakerName in EventModules.
 */

const { app } = require('@azure/functions');
const { query, mutate } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { audit } = require('../shared/audit');

app.http('updateSpeaker', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'speakers/{speakerId}',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'ModuleManager');
        if (roleError) return roleError;

        try {
            const speakerId = request.params.speakerId;

            if (!speakerId) {
                const errorResponse = error(400, 'Speaker ID is required', 'INVALID_REQUEST');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const bodyText = await request.text();
            const body = JSON.parse(bodyText);
            const { speakerName, bio, profileImage, isActive } = body;

            if (!speakerName) {
                const errorResponse = error(400, 'Speaker name is required', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const trimmedName = speakerName.trim();

            if (trimmedName.length < 2 || trimmedName.length > 100) {
                const errorResponse = error(400, 'Speaker name must be between 2 and 100 characters', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Check if speaker exists
            const speakerCheck = await query(
                'SELECT SpeakerId, SpeakerName FROM Speakers WHERE SpeakerId = @speakerId',
                { speakerId: parseInt(speakerId) }
            );

            if (speakerCheck.length === 0) {
                const errorResponse = error(404, 'Speaker not found', 'NOT_FOUND');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const oldName = speakerCheck[0].SpeakerName;

            // Check for duplicate name (excluding current speaker)
            const nameCheck = await query(
                'SELECT SpeakerId FROM Speakers WHERE SpeakerName = @name AND SpeakerId != @speakerId',
                { name: trimmedName, speakerId: parseInt(speakerId) }
            );

            if (nameCheck.length > 0) {
                const errorResponse = error(400, 'A speaker with this name already exists', 'DUPLICATE_NAME');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Validate profile image if provided
            if (profileImage && !profileImage.startsWith('data:image/')) {
                const errorResponse = error(400, 'Invalid image format. Must be a base64 data URL', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const username = (getAuthenticatedUser(request) || {}).username || 'admin';

            // Update speaker record
            await query(`
                UPDATE Speakers
                SET SpeakerName = @speakerName,
                    Bio = @bio,
                    ProfileImage = @profileImage,
                    IsActive = @isActive,
                    UpdatedAt = SYSUTCDATETIME(),
                    UpdatedBy = @updatedBy
                WHERE SpeakerId = @speakerId
            `, {
                speakerId: parseInt(speakerId),
                speakerName: trimmedName,
                bio: bio ? bio.trim() : null,
                profileImage: profileImage || null,
                isActive: isActive ? 1 : 0,
                updatedBy: username
            });

            // If name changed, update the denormalized SpeakerName in EventModules
            if (oldName !== trimmedName) {
                await mutate(`
                    UPDATE EventModules
                    SET SpeakerName = @newName
                    WHERE SpeakerId = @speakerId
                `, {
                    newName: trimmedName,
                    speakerId: parseInt(speakerId)
                });
            }

            context.log(`Speaker ${speakerId} updated successfully`);

            await audit(request, 'UPDATE', 'Speaker', parseInt(speakerId),
                `Updated speaker "${trimmedName}"`,
                {
                    speakerId: parseInt(speakerId),
                    speakerName: trimmedName,
                    nameChanged: oldName !== trimmedName,
                    oldName: oldName !== trimmedName ? oldName : undefined,
                    hasBio: !!bio,
                    hasImage: !!profileImage,
                    isActive
                }
            );

            const response = success({
                message: 'Speaker updated successfully',
                speakerId: parseInt(speakerId)
            });

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error updating speaker:', err);
            const errorResponse = error(500, `Error updating speaker: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});
