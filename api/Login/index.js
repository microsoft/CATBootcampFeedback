/**
 * Admin Login
 * POST /api/login
 *
 * Simple authentication for the admin panel
 * In production, you should use Azure AD, proper password hashing, etc.
 */

// Hardcoded admin credentials (for demo purposes)
// TODO: Move to Azure Key Vault or environment variables
const ADMIN_USERS = [
    {
        username: 'admin',
        password: 'CATBootcamp2026!', // Change this password!
        fullName: 'CAT Admin',
        email: 'admin@microsoft.com'
    },
    {
        username: 'dewainr',
        password: 'Admin123!',
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
        // Debug logging
        context.log('Request method:', req.method);
        context.log('Request body type:', typeof req.body);
        context.log('Request body:', JSON.stringify(req.body));
        context.log('Request rawBody:', req.rawBody);

        // Parse request body
        const { username, password} = req.body || {};

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

        // Find user
        const user = ADMIN_USERS.find(u =>
            u.username.toLowerCase() === username.toLowerCase() &&
            u.password === password
        );

        if (!user) {
            context.log(`Login failed for username: ${username}`);
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

        // Generate a simple token (in production, use proper JWT)
        const token = Buffer.from(`${user.username}:${Date.now()}`).toString('base64');

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
                }
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
