/**
 * Speakers API
 * GET  /api/speakers              - Get all speakers (REQUIRES AUTH)
 * POST /api/speakers              - Create new speaker (REQUIRES AUTH)
 * DELETE /api/speakers/{speakerId} - Delete speaker (REQUIRES AUTH)
 * POST /api/speakers/bulk-delete  - Bulk delete speakers (REQUIRES AUTH)
 */

const { app } = require('@azure/functions');
const { query, mutate } = require('../shared/database');
const { success, error } = require('../shared/utils');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { audit } = require('../shared/audit');

app.http('speakers', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'speakers',
    handler: async (request, context) => {
        if (request.method === 'GET') {
            const roleError = requireRole(request, 'ModuleManager', 'EventCreator');
            if (roleError) return roleError;
        } else {
            const roleError = requireRole(request, 'ModuleManager');
            if (roleError) return roleError;
        }

        try {
            if (request.method === 'GET') {
                const speakers = await query(`
                    SELECT
                        SpeakerId,
                        SpeakerName,
                        Bio,
                        ProfileImage,
                        IsActive,
                        CreatedAt,
                        CreatedBy,
                        UpdatedAt,
                        UpdatedBy
                    FROM Speakers
                    ORDER BY SpeakerName ASC
                `);

                const speakersWithCounts = await Promise.all(
                    speakers.map(async (speaker) => {
                        const eventCount = await query(
                            `SELECT COUNT(DISTINCT EventId) AS EventCount FROM EventModules WHERE SpeakerId = @speakerId`,
                            { speakerId: speaker.SpeakerId }
                        );

                        return {
                            speakerId: speaker.SpeakerId,
                            speakerName: speaker.SpeakerName,
                            bio: speaker.Bio,
                            profileImage: speaker.ProfileImage,
                            isActive: speaker.IsActive,
                            createdAt: speaker.CreatedAt,
                            createdBy: speaker.CreatedBy,
                            updatedAt: speaker.UpdatedAt,
                            updatedBy: speaker.UpdatedBy,
                            eventCount: eventCount[0]?.EventCount || 0
                        };
                    })
                );

                const response = success(speakersWithCounts);
                return {
                    status: response.status,
                    headers: response.headers,
                    body: response.body
                };

            } else if (request.method === 'POST') {
                const bodyText = await request.text();
                const body = JSON.parse(bodyText);

                const { speakerName, bio, profileImage, isActive = true } = body;

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

                // Check for duplicate name
                const existing = await query(
                    'SELECT SpeakerId FROM Speakers WHERE SpeakerName = @name',
                    { name: trimmedName }
                );

                if (existing.length > 0) {
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

                const result = await query(`
                    INSERT INTO Speakers (SpeakerName, Bio, ProfileImage, IsActive, CreatedBy)
                    OUTPUT INSERTED.SpeakerId, INSERTED.SpeakerName,
                           INSERTED.Bio, INSERTED.ProfileImage, INSERTED.IsActive, INSERTED.CreatedAt
                    VALUES (@speakerName, @bio, @profileImage, @isActive, @createdBy)
                `, {
                    speakerName: trimmedName,
                    bio: bio ? bio.trim() : null,
                    profileImage: profileImage || null,
                    isActive: isActive ? 1 : 0,
                    createdBy: username
                });

                const created = result[0];

                await audit(request, 'CREATE', 'Speaker', created.SpeakerId,
                    `Created speaker "${trimmedName}"`,
                    { speakerName: trimmedName, hasBio: !!bio, hasImage: !!profileImage }
                );

                const response = success({
                    message: 'Speaker created successfully',
                    speaker: {
                        speakerId: created.SpeakerId,
                        speakerName: created.SpeakerName,
                        bio: created.Bio,
                        profileImage: created.ProfileImage,
                        isActive: created.IsActive,
                        createdAt: created.CreatedAt
                    }
                }, 201);

                return {
                    status: response.status,
                    headers: response.headers,
                    body: response.body
                };
            }

        } catch (err) {
            context.log('Error in speakers API:', err);
            const errorResponse = error(500, 'Error processing request', 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});

// GET speaker details with events/modules history
app.http('getSpeakerEvents', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'speakers/{speakerId}/events',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'ModuleManager', 'EventCreator');
        if (roleError) return roleError;

        try {
            const speakerId = parseInt(request.params.speakerId);

            if (!speakerId || isNaN(speakerId)) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid speaker ID', error: 'INVALID_ID' } };
            }

            // Get speaker info
            const speakerResult = await query(
                'SELECT SpeakerId, SpeakerName, Bio, ProfileImage, IsActive, CreatedAt FROM Speakers WHERE SpeakerId = @speakerId',
                { speakerId }
            );

            if (speakerResult.length === 0) {
                return { status: 404, jsonBody: { success: false, message: 'Speaker not found', error: 'NOT_FOUND' } };
            }

            const speaker = speakerResult[0];

            // Get all events/modules this speaker has presented
            const events = await query(`
                SELECT
                    e.EventId,
                    e.EventCode,
                    e.EventName,
                    e.StartDate,
                    e.EndDate,
                    e.TrainingTrack,
                    e.IsActive AS EventIsActive,
                    em.EventModuleId,
                    em.ModuleId,
                    m.ModuleName,
                    em.DeliveryOrder,
                    em.DeliveryDate,
                    em.Notes,
                    (SELECT COUNT(*) FROM Feedback f WHERE f.EventModuleId = em.EventModuleId) AS FeedbackCount,
                    (SELECT AVG(CAST(f.SpeakerKnowledge AS FLOAT)) FROM Feedback f WHERE f.EventModuleId = em.EventModuleId) AS AvgSpeakerRating,
                    (SELECT AVG(CAST(f.ModuleSatisfaction AS FLOAT)) FROM Feedback f WHERE f.EventModuleId = em.EventModuleId) AS AvgModuleSatisfaction
                FROM EventModules em
                INNER JOIN Events e ON em.EventId = e.EventId
                INNER JOIN Modules m ON em.ModuleId = m.ModuleId
                WHERE em.SpeakerId = @speakerId
                  AND e.IsDeleted = 0
                ORDER BY e.StartDate DESC, em.DeliveryOrder ASC
            `, { speakerId });

            // Group by event
            const eventMap = new Map();
            for (const row of events) {
                if (!eventMap.has(row.EventId)) {
                    eventMap.set(row.EventId, {
                        eventId: row.EventId,
                        eventCode: row.EventCode,
                        eventName: row.EventName,
                        startDate: row.StartDate,
                        endDate: row.EndDate,
                        trainingTrack: row.TrainingTrack,
                        isActive: row.EventIsActive,
                        modules: []
                    });
                }
                eventMap.get(row.EventId).modules.push({
                    eventModuleId: row.EventModuleId,
                    moduleId: row.ModuleId,
                    moduleName: row.ModuleName,
                    deliveryOrder: row.DeliveryOrder,
                    deliveryDate: row.DeliveryDate,
                    notes: row.Notes,
                    feedbackCount: row.FeedbackCount || 0,
                    avgSpeakerRating: row.AvgSpeakerRating ? parseFloat(row.AvgSpeakerRating.toFixed(2)) : null,
                    avgModuleSatisfaction: row.AvgModuleSatisfaction ? parseFloat(row.AvgModuleSatisfaction.toFixed(2)) : null
                });
            }

            const response = success({
                speaker: {
                    speakerId: speaker.SpeakerId,
                    speakerName: speaker.SpeakerName,
                    bio: speaker.Bio,
                    profileImage: speaker.ProfileImage,
                    isActive: speaker.IsActive,
                    createdAt: speaker.CreatedAt
                },
                totalEvents: eventMap.size,
                totalModules: events.length,
                events: Array.from(eventMap.values())
            });

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error getting speaker events:', err);
            const errorResponse = error(500, 'Error getting speaker events', 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});

// DELETE single speaker
app.http('deleteSpeaker', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'speakers/{speakerId}',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'ModuleManager');
        if (roleError) return roleError;

        try {
            const speakerId = parseInt(request.params.speakerId);

            if (!speakerId || isNaN(speakerId)) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid speaker ID', error: 'INVALID_ID' } };
            }

            // Check if speaker is used in any active events
            const activeEventUsage = await query(`
                SELECT COUNT(*) AS Count
                FROM EventModules em
                INNER JOIN Events e ON em.EventId = e.EventId
                WHERE em.SpeakerId = @speakerId AND e.IsActive = 1 AND e.IsDeleted = 0
            `, { speakerId });

            if (activeEventUsage[0].Count > 0) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: `Cannot delete speaker: assigned to ${activeEventUsage[0].Count} module(s) in active event(s)`,
                        error: 'SPEAKER_IN_USE'
                    }
                };
            }

            // Get speaker name for audit log before deleting
            const speakerInfo = await query('SELECT SpeakerName FROM Speakers WHERE SpeakerId = @speakerId', { speakerId });

            const result = await mutate('DELETE FROM Speakers WHERE SpeakerId = @speakerId', { speakerId });

            if (result.rowsAffected[0] === 0) {
                return { status: 404, jsonBody: { success: false, message: 'Speaker not found', error: 'NOT_FOUND' } };
            }

            await audit(request, 'DELETE', 'Speaker', speakerId,
                `Deleted speaker "${speakerInfo[0]?.SpeakerName || 'Unknown'}"`,
                { speakerId }
            );

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Speaker deleted successfully',
                    data: { speakerId }
                }
            };

        } catch (err) {
            context.error('Error deleting speaker:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});

// Bulk delete speakers
app.http('deleteSpeakersBulk', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'speakers/bulk-delete',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'ModuleManager');
        if (roleError) return roleError;

        try {
            const data = await request.json();
            const { speakerIds } = data;

            if (!speakerIds || !Array.isArray(speakerIds) || speakerIds.length === 0) {
                return { status: 400, jsonBody: { success: false, message: 'Invalid speaker IDs array', error: 'INVALID_DATA' } };
            }

            let deletedCount = 0;
            let skippedCount = 0;
            const skippedSpeakers = [];

            for (const speakerId of speakerIds) {
                const activeEventUsage = await query(`
                    SELECT COUNT(*) AS Count
                    FROM EventModules em
                    INNER JOIN Events e ON em.EventId = e.EventId
                    WHERE em.SpeakerId = @speakerId AND e.IsActive = 1 AND e.IsDeleted = 0
                `, { speakerId });

                if (activeEventUsage[0].Count > 0) {
                    const speakerInfo = await query('SELECT SpeakerName FROM Speakers WHERE SpeakerId = @speakerId', { speakerId });
                    skippedSpeakers.push({
                        speakerId,
                        speakerName: speakerInfo[0]?.SpeakerName || 'Unknown',
                        reason: `Assigned to ${activeEventUsage[0].Count} module(s) in active event(s)`
                    });
                    skippedCount++;
                    continue;
                }

                const result = await mutate('DELETE FROM Speakers WHERE SpeakerId = @speakerId', { speakerId });
                if (result.rowsAffected[0] > 0) {
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                await audit(request, 'BULK_DELETE', 'Speaker', null,
                    `Bulk deleted ${deletedCount} speaker(s), skipped ${skippedCount}`,
                    { deletedCount, skippedCount, speakerIds }
                );
            }

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `Deleted ${deletedCount} speaker(s), skipped ${skippedCount}`,
                    data: {
                        deletedCount,
                        skippedCount,
                        skippedSpeakers
                    }
                }
            };

        } catch (err) {
            context.error('Error in bulk delete speakers:', err);
            return { status: 500, jsonBody: { success: false, message: 'Server error', error: 'SERVER_ERROR' } };
        }
    }
});
