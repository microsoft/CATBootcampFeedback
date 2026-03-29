/**
 * Users API
 *
 * GET    /api/users                         - List all users with roles
 * POST   /api/users                         - Create new user
 * GET    /api/users/{userId}                - Get single user detail
 * PUT    /api/users/{userId}                - Update user profile
 * DELETE /api/users/{userId}                - Delete user (blocked if IsProtected)
 *
 * GET    /api/roles                         - List available roles
 *
 * POST   /api/users/{userId}/roles          - Assign role
 * DELETE /api/users/{userId}/roles/{roleId} - Remove role
 *
 * GET    /api/users/{userId}/events         - List user's event access
 * POST   /api/users/{userId}/events         - Grant event access
 * DELETE /api/users/{userId}/events/{eventId} - Revoke event access
 *
 * All endpoints require GlobalAdmin or UserAdmin role.
 */

const { app } = require('@azure/functions');
const bcrypt = require('bcryptjs');
const { query, mutate } = require('../shared/database');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { addSecurityHeaders, sanitize } = require('../shared/utils');
const { audit } = require('../shared/audit');

const BCRYPT_SALT_ROUNDS = 10;
const MANAGE_ROLES = ['UserAdmin'];

// ──────────────────────────────────────────────
// GET /api/users  &  POST /api/users
// ──────────────────────────────────────────────
app.http('users', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'users',
    handler: async (request, context) => {
        const roleError = requireRole(request, ...MANAGE_ROLES);
        if (roleError) return roleError;

        try {
            if (request.method === 'GET') {
                return await listUsers();
            }
            return await createUser(request, context);
        } catch (err) {
            context.log('Users API error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Internal server error' }
            });
        }
    }
});

// ──────────────────────────────────────────────
// GET/PUT/DELETE /api/users/{userId}
// ──────────────────────────────────────────────
app.http('userById', {
    methods: ['GET', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    route: 'users/{userId}',
    handler: async (request, context) => {
        const roleError = requireRole(request, ...MANAGE_ROLES);
        if (roleError) return roleError;

        const userId = parseInt(request.params.userId, 10);
        if (isNaN(userId)) {
            return addSecurityHeaders({
                status: 400,
                jsonBody: { success: false, message: 'Invalid user ID' }
            });
        }

        try {
            if (request.method === 'GET') return await getUser(userId);
            if (request.method === 'PUT') return await updateUser(request, userId, context);
            if (request.method === 'DELETE') return await deleteUser(request, userId, context);
        } catch (err) {
            context.log('User by ID error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Internal server error' }
            });
        }
    }
});

// ──────────────────────────────────────────────
// GET /api/roles
// ──────────────────────────────────────────────
app.http('roles', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'roles',
    handler: async (request, context) => {
        // Any authenticated user can list roles
        const { requireAuth } = require('../shared/auth');
        const authError = requireAuth(request);
        if (authError) return authError;

        try {
            const roles = await query('SELECT RoleId, RoleName, Description, IsSystem FROM Roles ORDER BY RoleId');
            return addSecurityHeaders({
                status: 200,
                jsonBody: { success: true, data: roles }
            });
        } catch (err) {
            context.log('Roles API error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Internal server error' }
            });
        }
    }
});

// ──────────────────────────────────────────────
// POST /api/users/{userId}/roles
// DELETE /api/users/{userId}/roles/{roleId}
// ──────────────────────────────────────────────
app.http('userRoles', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'users/{userId}/roles',
    handler: async (request, context) => {
        const roleError = requireRole(request, ...MANAGE_ROLES);
        if (roleError) return roleError;

        const userId = parseInt(request.params.userId, 10);
        if (isNaN(userId)) {
            return addSecurityHeaders({
                status: 400,
                jsonBody: { success: false, message: 'Invalid user ID' }
            });
        }

        try {
            return await assignRole(request, userId, context);
        } catch (err) {
            context.log('Assign role error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Internal server error' }
            });
        }
    }
});

app.http('removeUserRole', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'users/{userId}/roles/{roleId}',
    handler: async (request, context) => {
        const roleError = requireRole(request, ...MANAGE_ROLES);
        if (roleError) return roleError;

        const userId = parseInt(request.params.userId, 10);
        const roleId = parseInt(request.params.roleId, 10);
        if (isNaN(userId) || isNaN(roleId)) {
            return addSecurityHeaders({
                status: 400,
                jsonBody: { success: false, message: 'Invalid user ID or role ID' }
            });
        }

        try {
            return await removeRole(request, userId, roleId, context);
        } catch (err) {
            context.log('Remove role error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Internal server error' }
            });
        }
    }
});

// ──────────────────────────────────────────────
// GET /api/users/{userId}/events
// POST /api/users/{userId}/events
// ──────────────────────────────────────────────
app.http('userEvents', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'users/{userId}/events',
    handler: async (request, context) => {
        const roleError = requireRole(request, ...MANAGE_ROLES);
        if (roleError) return roleError;

        const userId = parseInt(request.params.userId, 10);
        if (isNaN(userId)) {
            return addSecurityHeaders({
                status: 400,
                jsonBody: { success: false, message: 'Invalid user ID' }
            });
        }

        try {
            if (request.method === 'GET') return await listUserEvents(userId);
            return await grantEventAccess(request, userId, context);
        } catch (err) {
            context.log('User events error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Internal server error' }
            });
        }
    }
});

// DELETE /api/users/{userId}/events/{eventId}
app.http('revokeUserEvent', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'users/{userId}/events/{eventId}',
    handler: async (request, context) => {
        const roleError = requireRole(request, ...MANAGE_ROLES);
        if (roleError) return roleError;

        const userId = parseInt(request.params.userId, 10);
        const eventId = parseInt(request.params.eventId, 10);
        if (isNaN(userId) || isNaN(eventId)) {
            return addSecurityHeaders({
                status: 400,
                jsonBody: { success: false, message: 'Invalid user ID or event ID' }
            });
        }

        try {
            return await revokeEventAccess(request, userId, eventId, context);
        } catch (err) {
            context.log('Revoke event error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Internal server error' }
            });
        }
    }
});


// ──────────────────────────────────────────────
// GET /api/users/me — Get own profile (any authenticated user)
// ──────────────────────────────────────────────
app.http('getMyProfile', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'users/me',
    handler: async (request, context) => {
        const { requireAuth } = require('../shared/auth');
        const authError = requireAuth(request);
        if (authError) return authError;

        const caller = getAuthenticatedUser(request);
        if (!caller || !caller.userId) {
            return addSecurityHeaders({
                status: 401,
                jsonBody: { success: false, message: 'Unable to identify user' }
            });
        }

        try {
            const users = await query(
                'SELECT UserId, Username, FullName, Email, IsActive, IsProtected, MustChangePassword, LastLoginAt, CreatedAt, ProfileImage FROM Users WHERE UserId = @userId',
                { userId: caller.userId }
            );

            if (users.length === 0) {
                return addSecurityHeaders({
                    status: 404,
                    jsonBody: { success: false, message: 'User not found' }
                });
            }

            const user = users[0];
            const roles = await query(
                'SELECT r.RoleId, r.RoleName FROM UserRoles ur JOIN Roles r ON ur.RoleId = r.RoleId WHERE ur.UserId = @userId',
                { userId: caller.userId }
            );

            return addSecurityHeaders({
                status: 200,
                jsonBody: { success: true, data: { ...user, roles } }
            });
        } catch (err) {
            context.log('Get my profile error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Failed to load profile' }
            });
        }
    }
});

// ──────────────────────────────────────────────
// PUT /api/users/me — Update own profile (any authenticated user)
// ──────────────────────────────────────────────
app.http('updateMyProfile', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'users/me',
    handler: async (request, context) => {
        const { requireAuth } = require('../shared/auth');
        const authError = requireAuth(request);
        if (authError) return authError;

        const caller = getAuthenticatedUser(request);
        if (!caller || !caller.userId) {
            return addSecurityHeaders({
                status: 401,
                jsonBody: { success: false, message: 'Unable to identify user' }
            });
        }

        try {
            const body = JSON.parse(await request.text());
            const { fullName, email } = body;
            const updates = [];
            const params = { userId: caller.userId, updatedBy: caller.username };

            if (fullName !== undefined) { updates.push('FullName = @fullName'); params.fullName = sanitize(fullName); }
            if (email !== undefined) { updates.push('Email = @email'); params.email = email.trim().toLowerCase(); }

            if (updates.length === 0) {
                return addSecurityHeaders({ status: 400, jsonBody: { success: false, message: 'No fields to update' } });
            }

            updates.push('UpdatedAt = SYSUTCDATETIME()', 'UpdatedBy = @updatedBy');
            await mutate(`UPDATE Users SET ${updates.join(', ')} WHERE UserId = @userId`, params);
            await audit(request, 'UPDATE_PROFILE', 'User', caller.userId, `Updated own profile`, params);

            return addSecurityHeaders({
                status: 200,
                jsonBody: { success: true, message: 'Profile updated' }
            });
        } catch (err) {
            context.log('Update my profile error:', err.message);
            return addSecurityHeaders({ status: 500, jsonBody: { success: false, message: 'Failed to update profile' } });
        }
    }
});

// ──────────────────────────────────────────────
// PUT /api/users/{userId}/avatar
// Upload or remove profile image
// ──────────────────────────────────────────────
app.http('updateUserAvatar', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'users/{userId}/avatar',
    handler: async (request, context) => {
        // Allow users to update their own avatar, or admins to update anyone's
        const { requireAuth } = require('../shared/auth');
        const authError = requireAuth(request);
        if (authError) return authError;

        const userId = parseInt(request.params.userId, 10);
        if (isNaN(userId)) {
            return addSecurityHeaders({
                status: 400,
                jsonBody: { success: false, message: 'Invalid user ID' }
            });
        }

        const caller = getAuthenticatedUser(request);
        const isOwnAvatar = caller && caller.userId === userId;
        const isAdmin = caller && (caller.roles || []).some(r => r === 'GlobalAdmin' || r === 'UserAdmin');

        if (!isOwnAvatar && !isAdmin) {
            return addSecurityHeaders({
                status: 403,
                jsonBody: { success: false, message: 'You can only update your own profile image' }
            });
        }

        try {
            const body = JSON.parse(await request.text());
            const { image } = body; // base64 data URL or null to remove

            // Validate: must be a data URL or null
            if (image !== null && image !== undefined) {
                if (typeof image !== 'string' || !image.startsWith('data:image/')) {
                    return addSecurityHeaders({
                        status: 400,
                        jsonBody: { success: false, message: 'Image must be a base64 data URL (data:image/...)' }
                    });
                }
                // Limit to ~500KB of base64 data
                if (image.length > 700000) {
                    return addSecurityHeaders({
                        status: 400,
                        jsonBody: { success: false, message: 'Image is too large. Maximum size is 500KB.' }
                    });
                }
            }

            await mutate(
                'UPDATE Users SET ProfileImage = @image, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId',
                { image: image || null, userId }
            );

            context.log(`Avatar ${image ? 'updated' : 'removed'} for UserId=${userId}`);
            await audit(request, image ? 'UPDATE' : 'DELETE', 'Avatar', userId, `${image ? 'Updated' : 'Removed'} profile image for UserId=${userId}`);

            return addSecurityHeaders({
                status: 200,
                jsonBody: { success: true, message: image ? 'Profile image updated' : 'Profile image removed' }
            });
        } catch (err) {
            context.log('Avatar update error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Failed to update profile image' }
            });
        }
    }
});

// ========================================================================
// Handler implementations
// ========================================================================

async function listUsers() {
    const users = await query(`
        SELECT
            u.UserId, u.Username, u.FullName, u.Email,
            u.IsActive, u.IsProtected, u.MustChangePassword,
            u.LastLoginAt, u.CreatedAt, u.CreatedBy, u.ProfileImage
        FROM Users u
        ORDER BY u.Username
    `);

    // Load roles for all users in one query
    const allRoles = await query(`
        SELECT ur.UserId, r.RoleId, r.RoleName
        FROM UserRoles ur
        JOIN Roles r ON ur.RoleId = r.RoleId
    `);

    const rolesByUser = {};
    for (const r of allRoles) {
        if (!rolesByUser[r.UserId]) rolesByUser[r.UserId] = [];
        rolesByUser[r.UserId].push({ roleId: r.RoleId, roleName: r.RoleName });
    }

    const result = users.map(u => ({
        ...u,
        roles: rolesByUser[u.UserId] || []
    }));

    return addSecurityHeaders({
        status: 200,
        jsonBody: { success: true, data: result }
    });
}

async function getUser(userId) {
    const users = await query(
        'SELECT UserId, Username, FullName, Email, IsActive, IsProtected, MustChangePassword, LastLoginAt, CreatedAt, CreatedBy, ProfileImage FROM Users WHERE UserId = @userId',
        { userId }
    );

    if (users.length === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'User not found' }
        });
    }

    const user = users[0];

    const roles = await query(
        'SELECT r.RoleId, r.RoleName, ur.AssignedAt, ur.AssignedBy FROM UserRoles ur JOIN Roles r ON ur.RoleId = r.RoleId WHERE ur.UserId = @userId',
        { userId }
    );

    const events = await query(
        `SELECT uea.EventId, e.EventName, e.EventCode, uea.GrantedAt, uea.GrantedBy
         FROM UserEventAccess uea
         JOIN Events e ON uea.EventId = e.EventId
         WHERE uea.UserId = @userId AND e.IsDeleted = 0
         ORDER BY e.EventName`,
        { userId }
    );

    return addSecurityHeaders({
        status: 200,
        jsonBody: {
            success: true,
            data: { ...user, roles, events }
        }
    });
}

async function createUser(request, context) {
    const body = JSON.parse(await request.text());
    const { username, password, fullName, email, roleIds } = body;

    // Validate required fields
    if (!username || !password || !fullName || !email) {
        return addSecurityHeaders({
            status: 400,
            jsonBody: { success: false, message: 'Username, password, fullName, and email are required' }
        });
    }

    if (password.length < 8) {
        return addSecurityHeaders({
            status: 400,
            jsonBody: { success: false, message: 'Password must be at least 8 characters' }
        });
    }

    // Check for existing username/email
    const existing = await query(
        'SELECT UserId FROM Users WHERE LOWER(Username) = LOWER(@username) OR LOWER(Email) = LOWER(@email)',
        { username, email }
    );
    if (existing.length > 0) {
        return addSecurityHeaders({
            status: 409,
            jsonBody: { success: false, message: 'Username or email already exists' }
        });
    }

    const caller = getAuthenticatedUser(request);
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const result = await mutate(
        `INSERT INTO Users (Username, PasswordHash, FullName, Email, IsActive, MustChangePassword, CreatedBy)
         OUTPUT INSERTED.UserId
         VALUES (@username, @passwordHash, @fullName, @email, 1, 1, @createdBy)`,
        {
            username: sanitize(username),
            passwordHash,
            fullName: sanitize(fullName),
            email: email.trim().toLowerCase(),
            createdBy: caller.username
        }
    );

    const newUserId = result.recordset[0].UserId;

    // Assign roles if provided
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
        for (const roleId of roleIds) {
            await mutate(
                'INSERT INTO UserRoles (UserId, RoleId, AssignedBy) VALUES (@userId, @roleId, @assignedBy)',
                { userId: newUserId, roleId, assignedBy: caller.username }
            );
        }
    }

    context.log(`User created: ${username} (UserId=${newUserId}) by ${caller.username}`);
    await audit(request, 'CREATE', 'User', newUserId, `Created user ${username}`, { username, fullName: sanitize(fullName), email, roleIds: selectedRoleIds });

    return addSecurityHeaders({
        status: 201,
        jsonBody: {
            success: true,
            message: 'User created successfully',
            data: { userId: newUserId, username, mustChangePassword: true }
        }
    });
}

async function updateUser(request, userId, context) {
    const users = await query('SELECT UserId, IsProtected FROM Users WHERE UserId = @userId', { userId });
    if (users.length === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'User not found' }
        });
    }

    const targetUser = users[0];
    const body = JSON.parse(await request.text());
    const { fullName, email, isActive } = body;

    // Prevent deactivating a protected user
    if (targetUser.IsProtected && isActive === false) {
        return addSecurityHeaders({
            status: 403,
            jsonBody: { success: false, message: 'Cannot deactivate the protected Global Admin account' }
        });
    }

    const caller = getAuthenticatedUser(request);
    const updates = [];
    const params = { userId, updatedBy: caller.username };

    if (fullName !== undefined) {
        updates.push('FullName = @fullName');
        params.fullName = sanitize(fullName);
    }
    if (email !== undefined) {
        updates.push('Email = @email');
        params.email = email.trim().toLowerCase();
    }
    if (isActive !== undefined) {
        updates.push('IsActive = @isActive');
        params.isActive = isActive ? 1 : 0;
    }

    if (updates.length === 0) {
        return addSecurityHeaders({
            status: 400,
            jsonBody: { success: false, message: 'No fields to update' }
        });
    }

    updates.push('UpdatedAt = SYSUTCDATETIME()', 'UpdatedBy = @updatedBy');

    await mutate(
        `UPDATE Users SET ${updates.join(', ')} WHERE UserId = @userId`,
        params
    );

    context.log(`User updated: UserId=${userId} by ${caller.username}`);
    await audit(request, 'UPDATE', 'User', userId, `Updated user UserId=${userId}`, params);

    return addSecurityHeaders({
        status: 200,
        jsonBody: { success: true, message: 'User updated successfully' }
    });
}

async function deleteUser(request, userId, context) {
    const users = await query('SELECT UserId, Username, IsProtected FROM Users WHERE UserId = @userId', { userId });
    if (users.length === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'User not found' }
        });
    }

    if (users[0].IsProtected) {
        return addSecurityHeaders({
            status: 403,
            jsonBody: { success: false, message: 'Cannot delete the protected Global Admin account' }
        });
    }

    await mutate('DELETE FROM Users WHERE UserId = @userId', { userId });
    context.log(`User deleted: ${users[0].Username} (UserId=${userId})`);
    await audit(request, 'DELETE', 'User', userId, `Deleted user ${users[0].Username}`);

    return addSecurityHeaders({
        status: 200,
        jsonBody: { success: true, message: 'User deleted successfully' }
    });
}

async function assignRole(request, userId, context) {
    const body = JSON.parse(await request.text());
    const { roleId } = body;

    if (!roleId) {
        return addSecurityHeaders({
            status: 400,
            jsonBody: { success: false, message: 'roleId is required' }
        });
    }

    // Verify user exists
    const users = await query('SELECT UserId FROM Users WHERE UserId = @userId', { userId });
    if (users.length === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'User not found' }
        });
    }

    // Verify role exists
    const roles = await query('SELECT RoleId, RoleName FROM Roles WHERE RoleId = @roleId', { roleId });
    if (roles.length === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'Role not found' }
        });
    }

    // Check for duplicate
    const existing = await query(
        'SELECT UserRoleId FROM UserRoles WHERE UserId = @userId AND RoleId = @roleId',
        { userId, roleId }
    );
    if (existing.length > 0) {
        return addSecurityHeaders({
            status: 409,
            jsonBody: { success: false, message: 'User already has this role' }
        });
    }

    const caller = getAuthenticatedUser(request);
    await mutate(
        'INSERT INTO UserRoles (UserId, RoleId, AssignedBy) VALUES (@userId, @roleId, @assignedBy)',
        { userId, roleId, assignedBy: caller.username }
    );

    context.log(`Role ${roles[0].RoleName} assigned to UserId=${userId} by ${caller.username}`);
    await audit(request, 'ASSIGN_ROLE', 'Role', roleId, `Assigned ${roles[0].RoleName} to UserId=${userId}`, { userId, roleName: roles[0].RoleName });

    return addSecurityHeaders({
        status: 201,
        jsonBody: { success: true, message: `Role ${roles[0].RoleName} assigned successfully` }
    });
}

async function removeRole(request, userId, roleId, context) {
    // Verify user exists and check protection
    const users = await query('SELECT UserId, IsProtected FROM Users WHERE UserId = @userId', { userId });
    if (users.length === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'User not found' }
        });
    }

    // Block removing GlobalAdmin from a protected user
    const role = await query('SELECT RoleName FROM Roles WHERE RoleId = @roleId', { roleId });
    if (users[0].IsProtected && role.length > 0 && role[0].RoleName === 'GlobalAdmin') {
        return addSecurityHeaders({
            status: 403,
            jsonBody: { success: false, message: 'Cannot remove GlobalAdmin role from the protected account' }
        });
    }

    const result = await mutate(
        'DELETE FROM UserRoles WHERE UserId = @userId AND RoleId = @roleId',
        { userId, roleId }
    );

    if (result.rowsAffected[0] === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'User does not have this role' }
        });
    }

    context.log(`Role (RoleId=${roleId}) removed from UserId=${userId}`);
    await audit(request, 'REMOVE_ROLE', 'Role', roleId, `Removed role RoleId=${roleId} from UserId=${userId}`, { userId, roleId });

    return addSecurityHeaders({
        status: 200,
        jsonBody: { success: true, message: 'Role removed successfully' }
    });
}

async function listUserEvents(userId) {
    const events = await query(
        `SELECT uea.UserEventAccessId, uea.EventId, e.EventName, e.EventCode, e.IsActive,
                uea.GrantedAt, uea.GrantedBy
         FROM UserEventAccess uea
         JOIN Events e ON uea.EventId = e.EventId
         WHERE uea.UserId = @userId AND e.IsDeleted = 0
         ORDER BY e.EventName`,
        { userId }
    );

    return addSecurityHeaders({
        status: 200,
        jsonBody: { success: true, data: events }
    });
}

async function grantEventAccess(request, userId, context) {
    const body = JSON.parse(await request.text());
    const { eventId } = body;

    if (!eventId) {
        return addSecurityHeaders({
            status: 400,
            jsonBody: { success: false, message: 'eventId is required' }
        });
    }

    // Verify user exists
    const users = await query('SELECT UserId FROM Users WHERE UserId = @userId', { userId });
    if (users.length === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'User not found' }
        });
    }

    // Verify event exists
    const events = await query(
        'SELECT EventId FROM Events WHERE EventId = @eventId AND IsDeleted = 0',
        { eventId }
    );
    if (events.length === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'Event not found' }
        });
    }

    // Check for duplicate
    const existing = await query(
        'SELECT UserEventAccessId FROM UserEventAccess WHERE UserId = @userId AND EventId = @eventId',
        { userId, eventId }
    );
    if (existing.length > 0) {
        return addSecurityHeaders({
            status: 409,
            jsonBody: { success: false, message: 'User already has access to this event' }
        });
    }

    const caller = getAuthenticatedUser(request);
    await mutate(
        'INSERT INTO UserEventAccess (UserId, EventId, GrantedBy) VALUES (@userId, @eventId, @grantedBy)',
        { userId, eventId, grantedBy: caller.username }
    );

    context.log(`Event access granted: UserId=${userId}, EventId=${eventId} by ${caller.username}`);
    await audit(request, 'GRANT_ACCESS', 'EventAccess', eventId, `Granted event access: EventId=${eventId} to UserId=${userId}`, { userId, eventId });

    return addSecurityHeaders({
        status: 201,
        jsonBody: { success: true, message: 'Event access granted successfully' }
    });
}

async function revokeEventAccess(request, userId, eventId, context) {
    const result = await mutate(
        'DELETE FROM UserEventAccess WHERE UserId = @userId AND EventId = @eventId',
        { userId, eventId }
    );

    if (result.rowsAffected[0] === 0) {
        return addSecurityHeaders({
            status: 404,
            jsonBody: { success: false, message: 'Event access not found' }
        });
    }

    context.log(`Event access revoked: UserId=${userId}, EventId=${eventId}`);
    await audit(request, 'REVOKE_ACCESS', 'EventAccess', eventId, `Revoked event access: EventId=${eventId} from UserId=${userId}`, { userId, eventId });

    return addSecurityHeaders({
        status: 200,
        jsonBody: { success: true, message: 'Event access revoked successfully' }
    });
}
