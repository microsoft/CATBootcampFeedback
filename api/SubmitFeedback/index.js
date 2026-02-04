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

        // Validate eventModuleId is provided
        if (!data.eventModuleId) {
            context.res = error(400, 'Event Module ID is required', 'INVALID_DATA');
            return;
        }

        // Verify that eventModuleId belongs to this event
        const eventModuleResult = await query(
            `SELECT EventModuleId FROM EventModules WHERE EventModuleId = @eventModuleId AND EventId = @eventId`,
            { eventModuleId: data.eventModuleId, eventId }
        );

        if (!eventModuleResult || eventModuleResult.length === 0) {
            context.res = error(404, 'Event module not found or does not belong to this event', 'INVALID_EVENT_MODULE');
            return;
        }

        // Sanitize comments
        const sanitizedComments = data.additionalComments ? sanitize(data.additionalComments) : null;

        // Insert feedback
        const result = await query(
            `INSERT INTO Feedback (EventId, EventCode, EventModuleId, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, IpAddress, UserAgent, SubmittedAt)
             OUTPUT INSERTED.FeedbackId
             VALUES (@eventId, @eventCode, @eventModuleId, @speakerKnowledge, @contentDepth, @moduleSatisfaction, @additionalComments, @ipAddress, @userAgent, GETDATE())`,
            {
                eventId,
                eventCode: data.eventCode,
                eventModuleId: data.eventModuleId,
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
