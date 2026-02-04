/**
 * Login API
 * POST /api/login
 *
 * Simple authentication for admin panel
 * NOTE: This is a basic implementation for demo purposes
 * In production, use proper authentication (Azure AD, JWT, etc.)
 */

const { app } = require('@azure/functions');
const { success, error } = require('../shared/utils');

// Hardcoded credentials for demo
// In production, validate against database or Azure AD
const VALID_CREDENTIALS = [
    {
        username: 'admin',
        password: 'CATBootcamp2026!',
        fullName: 'Admin User',
        role: 'admin'
    }
];

app.http('login', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'login',
    handler: async (request, context) => {
        try {
            // Parse request body
            let body;
            try {
                const text = await request.text();
                body = text ? JSON.parse(text) : {};
            } catch (parseError) {
                context.log('Error parsing request body:', parseError);
                body = {};
            }

            const { username, password } = body;

            if (!username || !password) {
                const errorResponse = error(400, 'Username and password are required', 'INVALID_INPUT');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    jsonBody: errorResponse.body
                };
            }

            // Find matching user
            const user = VALID_CREDENTIALS.find(
                cred => cred.username === username && cred.password === password
            );

            if (user) {
                // Generate simple token (in production, use JWT)
                const token = 'token-' + Date.now() + '-' + Math.random().toString(36).substring(7);

                const response = success({
                    success: true,
                    token: token,
                    user: {
                        username: user.username,
                        fullName: user.fullName,
                        role: user.role
                    }
                });

                return {
                    status: response.status,
                    headers: response.headers,
                    jsonBody: response.body
                };
            } else {
                const errorResponse = error(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    jsonBody: errorResponse.body
                };
            }
        } catch (err) {
            context.log('Login error:', err);
            const errorResponse = error(500, 'Login failed', 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                jsonBody: errorResponse.body
            };
        }
    }
});
