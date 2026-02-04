/**
 * Health Check API
 * GET /api/health
 * Simple endpoint to test if Azure Functions are working
 */

const { app } = require('@azure/functions');

app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',
    handler: async (request, context) => {
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            jsonBody: {
                status: 'OK',
                timestamp: new Date().toISOString(),
                message: 'Azure Functions V4 are working!'
            }
        };
    }
});
