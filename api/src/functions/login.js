/**
 * Login API
 * POST /api/login
 *
 * Simple authentication for admin panel
 * NOTE: This is a basic implementation for demo purposes
 * In production, use proper authentication (Azure AD, JWT, etc.)
 */

const { app } = require('@azure/functions');

// Hardcoded credentials for demo
// In production, validate against database or Azure AD
const VALID_CREDENTIALS = [
    {
        username: 'admin',
        password: 'CATBootcamp2026!',
        fullName: 'Admin User',
        role: 'admin'
    },
    {
        username: 'dewainr',
        password: 'CATBootcamp2026!',
        fullName: 'Dewain Robinson',
        role: 'admin'
    }
];

app.http('login', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'login',
    handler: async (request, context) => {
        try {
            context.log('Login request received');

            // Parse request body
            const body = await request.json();
            context.log('Parsed body:', JSON.stringify(body));

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

            // Find matching user
            const user = VALID_CREDENTIALS.find(
                cred => cred.username === username && cred.password === password
            );

            if (user) {
                context.log('Login successful for:', username);

                // Generate simple token (in production, use JWT)
                const token = 'token-' + Date.now() + '-' + Math.random().toString(36).substring(7);

                return {
                    status: 200,
                    jsonBody: {
                        success: true,
                        token: token,
                        user: {
                            username: user.username,
                            fullName: user.fullName,
                            role: user.role
                        }
                    }
                };
            } else {
                context.log('Invalid credentials for:', username);
                return {
                    status: 401,
                    jsonBody: {
                        success: false,
                        message: 'Invalid username or password'
                    }
                };
            }
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
