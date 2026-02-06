const { app } = require('@azure/functions');

app.http('testCount', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'test/count',
    handler: async (request, context) => {
        return {
            status: 200,
            jsonBody: {
                success: true,
                message: 'Test count endpoint working!'
            }
        };
    }
});
