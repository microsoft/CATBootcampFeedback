/**
 * Submit Feedback
 * POST /api/feedback
 */

const { query } = require('../shared/database');
const { success, error, validateFeedbackData, sanitize, getClientIP, checkRateLimit } = require('../shared/utils');

module.exports = async function (context, req) {
    try {
        const data = req.body;

        // Rate limiting
        const clientIP = getClientIP(req);
        const rateLimitKey = `feedback_${clientIP}_${data.eventCode}`;
        const rateLimit = checkRateLimit(rateLimitKey, 5, 3600000); // 5 per hour

        if (!rateLimit.allowed) {
            context.res = error(429, `Too many submissions. Please try again in ${Math.ceil(rateLimit.retryAfter / 60)} minutes.`, 'RATE_LIMIT_EXCEEDED');
            return;
        }

        // Validate input
        const validationErrors = validateFeedbackData(data);
        if (validationErrors.length > 0) {
            context.res = error(400, validationErrors.join(', '), 'INVALID_DATA');
            return;
        }

        // Check if event exists and is active
        const eventResult = await query(
            `SELECT EventId FROM Events WHERE EventCode = @eventCode AND IsActive = 1`,
            { eventCode: data.eventCode }
        );

        if (!eventResult || eventResult.length === 0) {
            context.res = error(404, 'Event not found or inactive', 'EVENT_NOT_FOUND');
            return;
        }

        const eventId = eventResult[0].EventId;

        // Sanitize comments
        const sanitizedComments = data.additionalComments ? sanitize(data.additionalComments) : null;

        // Insert feedback
        const result = await query(
            `INSERT INTO Feedback (EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, IpAddress, UserAgent, SubmittedAt)
             OUTPUT INSERTED.FeedbackId
             VALUES (@eventId, @eventCode, @speakerKnowledge, @contentDepth, @moduleSatisfaction, @additionalComments, @ipAddress, @userAgent, GETDATE())`,
            {
                eventId,
                eventCode: data.eventCode,
                speakerKnowledge: data.speakerKnowledge,
                contentDepth: data.contentDepth,
                moduleSatisfaction: data.moduleSatisfaction,
                additionalComments: sanitizedComments,
                ipAddress: clientIP,
                userAgent: req.headers['user-agent'] || 'unknown'
            }
        );

        const feedbackId = result[0].FeedbackId;

        context.res = success({ feedbackId }, 'Feedback submitted successfully');
    } catch (err) {
        context.log.error('Error in SubmitFeedback:', err);
        context.res = error(500, 'Internal server error', 'SERVER_ERROR');
    }
};
