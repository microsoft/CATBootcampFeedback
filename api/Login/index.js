/**
 * Admin Login
 * POST /api/login
 *
 * JWT-based authentication for the admin panel
 * Generates a signed JWT token valid for 8 hours
 *
 * TODO: Migrate to Azure AD for enterprise authentication
 */

const bcrypt = require('bcryptjs');
const { generateToken } = require('../shared/auth');

// Admin credentials with bcrypt-hashed passwords
// Passwords rotated: 2026-02-07 (stored securely on desktop, not in repo)
// TODO: Move to Azure Key Vault or database with proper user management
const ADMIN_USERS = [
    {
        username: 'admin',
        passwordHash: '$2b$10$uru.CX0QNH8RXgC4uTMvweTBEEHDUZgPCK5.C6i7qLdhGhInZhFKe',
        fullName: 'CAT Admin',
        email: 'admin@microsoft.com'
    },
    {
        username: 'dewainr',
        passwordHash: '$2b$10$T3QtTLVS1rVElKf3IUwDA.P3vl0dz4ELDDNicJ8vHDF.GRE6q3Q6G',
        fullName: 'Dewain Robinson',
        email: 'dewainr@microsoft.com'
    }
];

module.exports = async function (context, req) {
    context.log('Admin login attempt');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        };
        return;
    }

    try {
        // Parse request body - handle both object and string formats
        let body = req.body;

        // If body is a string, parse it as JSON
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                context.log('Failed to parse body as JSON:', e);
                body = {};
            }
        }

        const { username, password } = body || {};

        context.log(`Login attempt for username: ${username}`);

        // Validate input
        if (!username || !password) {
            context.res = {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: {
                    success: false,
                    message: 'Username and password are required'
                }
            };
            return;
        }

        // Find user by username
        const user = ADMIN_USERS.find(u =>
            u.username.toLowerCase() === username.toLowerCase()
        );

        if (!user) {
            context.log(`Login failed - user not found: ${username}`);
            context.res = {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: {
                    success: false,
                    message: 'Invalid username or password'
                }
            };
            return;
        }

        // Verify password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            context.log(`Login failed - invalid password for username: ${username}`);
            context.res = {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: {
                    success: false,
                    message: 'Invalid username or password'
                }
            };
            return;
        }

        // Generate JWT token
        const token = generateToken({
            username: user.username,
            email: user.email,
            fullName: user.fullName
        });

        context.log(`Login successful for username: ${username}`);

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
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

    } catch (error) {
        context.log('Error in admin login:', error);
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: false,
                message: 'Internal server error during authentication',
                error: error.message
            }
        };
    }
};
