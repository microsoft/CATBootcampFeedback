/**
 * Health Check API
 * GET /api/health
 * Simple endpoint to test if Azure Functions are working
 */

module.exports = async function (context, req) {
    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: {
            status: 'OK',
            timestamp: new Date().toISOString(),
            message: 'Azure Functions are working'
        }
    };
};
