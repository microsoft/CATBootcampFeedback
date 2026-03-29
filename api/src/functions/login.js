/**
 * Login API
 * POST /api/login
 *
 * JWT-based authentication for the admin panel.
 * Authenticates against the database Users table (with fallback to ADMIN_USERS_JSON
 * env var during the migration period).
 *
 * Returns a signed JWT token containing userId, username, roles[], and isProtected.
 */

const { app } = require('@azure/functions');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../shared/auth');
const { rateLimit } = require('../shared/rate-limiter');
const { addSecurityHeaders } = require('../shared/utils');
const { query, mutate } = require('../shared/database');
const { audit } = require('../shared/audit');

/**
 * Attempt to authenticate from the database Users table.
 * Returns { user, roles } on success, or null if the Users table is empty or user not found.
 */
async function authenticateFromDatabase(username) {
    try {
        // Check if the Users table has any rows (migration may not have run yet)
        const countResult = await query('SELECT COUNT(*) AS cnt FROM Users');
        if (countResult[0].cnt === 0) {
            return null; // Fall back to env var
        }

        // Look up user by username (case-insensitive)
        const users = await query(
            `SELECT UserId, Username, PasswordHash, FullName, Email, IsActive, IsProtected, MustChangePassword
             FROM Users
             WHERE LOWER(Username) = LOWER(@username)`,
            { username }
        );

        if (users.length === 0) return null;

        const user = users[0];

        if (!user.IsActive) {
            return { user: null, inactive: true };
        }

        // Load roles
        const roles = await query(
            `SELECT r.RoleName
             FROM UserRoles ur
             JOIN Roles r ON ur.RoleId = r.RoleId
             WHERE ur.UserId = @userId`,
            { userId: user.UserId }
        );

        return {
            user: {
                userId: user.UserId,
                username: user.Username,
                passwordHash: user.PasswordHash,
                fullName: user.FullName,
                email: user.Email,
                isProtected: user.IsProtected,
                mustChangePassword: user.MustChangePassword
            },
            roles: roles.map(r => r.RoleName)
        };
    } catch (err) {
        // If the Users table doesn't exist yet, fall back to env var
        if (err.message && err.message.includes('Invalid object name')) {
            return null;
        }
        throw err;
    }
}

/**
 * Legacy fallback: authenticate from ADMIN_USERS_JSON environment variable.
 */
function authenticateFromEnvVar(username) {
    const adminUsersJson = process.env.ADMIN_USERS_JSON;
    if (!adminUsersJson) return null;

    try {
        const adminUsers = JSON.parse(adminUsersJson);
        const user = adminUsers.find(u =>
            u.username.toLowerCase() === username.toLowerCase()
        );

        if (!user) return null;

        return {
            user: {
                userId: 0,
                username: user.username,
                passwordHash: user.passwordHash,
                fullName: user.fullName,
                email: user.email,
                isProtected: true,
                mustChangePassword: false
            },
            roles: ['GlobalAdmin'] // Env-var users get full admin during transition
        };
    } catch {
        return null;
    }
}

app.http('login', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'login',
    handler: async (request, context) => {
        try {
            context.log('JWT Login request received');

            const rateLimitError = rateLimit(request, 'login');
            if (rateLimitError) {
                context.log('Rate limit exceeded for login');
                return rateLimitError;
            }

            const bodyText = await request.text();
            const body = JSON.parse(bodyText);
            const { username, password } = body;

            if (!username || !password) {
                context.log('Missing credentials');
                return addSecurityHeaders({
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Username and password are required'
                    }
                });
            }

            // Try database first, fall back to env var
            let authResult = await authenticateFromDatabase(username);
            let source = 'database';

            if (!authResult) {
                authResult = authenticateFromEnvVar(username);
                source = 'env-var';
            }

            if (!authResult || !authResult.user) {
                const message = authResult && authResult.inactive
                    ? 'Account is deactivated'
                    : 'Invalid username or password';
                context.log('Login failed for:', username, `(source: ${source})`);
                return addSecurityHeaders({
                    status: 401,
                    jsonBody: {
                        success: false,
                        message
                    }
                });
            }

            const { user, roles } = authResult;

            // Verify password with bcrypt
            const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                context.log('Invalid password for user:', username);
                return addSecurityHeaders({
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'Invalid username or password'
                    }
                });
            }

            // Update LastLoginAt if authenticating from database
            if (source === 'database' && user.userId > 0) {
                try {
                    await mutate(
                        'UPDATE Users SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @userId',
                        { userId: user.userId }
                    );
                } catch (err) {
                    context.log('Warning: Failed to update LastLoginAt:', err.message);
                }
            }

            // Generate JWT token with roles
            const token = generateToken({
                userId: user.userId,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                roles,
                isProtected: user.isProtected
            });

            context.log(`JWT Login successful for: ${username} (source: ${source}, roles: ${roles.join(', ')})`);

            // Audit log (use a fake req with the user info since the real request has no auth header yet)
            try {
                const fakeReq = { headers: request.headers };
                // Manually insert since we don't have the token on the request
                await mutate(
                    `INSERT INTO AuditLog (UserId, Username, Action, ResourceType, ResourceId, Summary, IpAddress)
                     VALUES (@userId, @username, 'LOGIN', 'System', NULL, @summary, @ip)`,
                    {
                        userId: user.userId,
                        username: user.username,
                        summary: `Signed in (${source}, roles: ${roles.join(', ')})`,
                        ip: (request.headers.get ? request.headers.get('x-forwarded-for') : request.headers?.['x-forwarded-for']) || 'unknown'
                    }
                );
            } catch (auditErr) { /* never break login */ }

            return addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    token,
                    user: {
                        userId: user.userId,
                        username: user.username,
                        fullName: user.fullName,
                        email: user.email,
                        roles,
                        isProtected: user.isProtected,
                        mustChangePassword: user.mustChangePassword || false
                    },
                    expiresIn: '8h'
                }
            });

        } catch (err) {
            context.log('Login error:', err.message);
            context.log('Error stack:', err.stack);
            return addSecurityHeaders({
                status: 500,
                jsonBody: {
                    success: false,
                    message: 'Login failed: ' + err.message
                }
            });
        }
    }
});
