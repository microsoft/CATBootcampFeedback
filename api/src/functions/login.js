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

// Admin credentials with bcrypt-hashed passwords
// Passwords rotated: 2026-02-07 (stored securely on desktop, not in repo)
// TODO: Move to Azure Key Vault or database with proper user management
const ADMIN_USERS = [
    {
        username: 'admin',
        passwordHash: '$2b$10$NNRgGRdeOidgtSPFAZ3nxup221ffdtrF7Yd90h6KjnIDXlUQGJTPK',
        fullName: 'CAT Admin',
        email: 'admin@microsoft.com'
    },
    {
        username: 'dewainr',
        passwordHash: '$2b$10$GtaRhBketPlI2dws2tDbCOjCesPnco.s9c/W.N9LS9f7eV.cufkgW',
        fullName: 'Dewain Robinson',
        email: 'dewainr@microsoft.com'
    }
];

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
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        message: 'Username and password are required'
                    }
                };
            }

            // Find user by username
            const user = ADMIN_USERS.find(u =>
                u.username.toLowerCase() === username.toLowerCase()
            );

            if (!user) {
                context.log('User not found:', username);
                return {
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'Invalid username or password'
                    }
                };
            }

            // Verify password with bcrypt
            const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

            if (!isPasswordValid) {
                context.log('Invalid password for user:', username);
                return {
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'Invalid username or password'
                    }
                };
            }

            // Generate JWT token
            const token = generateToken({
                username: user.username,
                email: user.email,
                fullName: user.fullName
            });

            context.log('JWT Login successful for:', username);

            return {
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
            };

        } catch (err) {
            context.log('Login error:', err.message);
            context.log('Error stack:', err.stack);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    message: 'Login failed: ' + err.message
                }
            };
        }
    }
});
