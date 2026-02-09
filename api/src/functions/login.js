/**
 * Login API
 * POST /api/login
 *
 * JWT-based authentication for the admin panel
 * Generates a signed JWT token valid for 8 hours
 *
 * TODO: Migrate to Azure AD for enterprise authentication
 */

const { app } = require('@azure/functions');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../shared/auth');
const { rateLimit } = require('../shared/rate-limiter');
const { addSecurityHeaders } = require('../shared/utils');

function getAdminUsers() {
    const adminUsersJson = process.env.ADMIN_USERS_JSON;
    if (!adminUsersJson) {
        throw new Error('ADMIN_USERS_JSON environment variable is not configured');
    }
    return JSON.parse(adminUsersJson);
}

app.http('login', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'login',
    handler: async (request, context) => {
        try {
            context.log('JWT Login request received');

            // Apply rate limiting (5 attempts per 15 minutes)
            const rateLimitError = rateLimit(request, 'login');
            if (rateLimitError) {
                context.log('Rate limit exceeded for login');
                return rateLimitError;
            }

            // Parse request body
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

            // Find user by username
            const adminUsers = getAdminUsers();
            const user = adminUsers.find(u =>
                u.username.toLowerCase() === username.toLowerCase()
            );

            if (!user) {
                context.log('User not found:', username);
                return addSecurityHeaders({
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'Invalid username or password'
                    }
                });
            }

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

            // Generate JWT token
            const token = generateToken({
                username: user.username,
                email: user.email,
                fullName: user.fullName
            });

            context.log('JWT Login successful for:', username);

            return addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    token: token,
                    user: {
                        username: user.username,
                        fullName: user.fullName,
                        email: user.email
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
