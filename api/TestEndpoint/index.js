module.exports = async function (context, req) {
    context.res = {
        status: 200,
        body: { success: true, message: "Test endpoint works!", timestamp: new Date().toISOString() }
    };
};
