const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    context.log('GetAllFeedback function triggered');

    try {
        // Get query parameters for filtering
        const eventCode = req.query.eventCode;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        // Build query based on filters
        let sqlQuery = `
            SELECT
                f.FeedbackId,
                f.EventId,
                f.EventCode,
                f.SpeakerKnowledge,
                f.ContentDepth,
                f.ModuleSatisfaction,
                f.AdditionalComments,
                f.SubmittedAt,
                f.IpAddress,
                e.ModuleName,
                e.SpeakerName,
                e.ModuleDate
            FROM Feedback f
            INNER JOIN Events e ON f.EventId = e.EventId
        `;

        const params = { limit, offset };

        if (eventCode) {
            sqlQuery += ' WHERE f.EventCode = @eventCode';
            params.eventCode = eventCode;
        }

        sqlQuery += ' ORDER BY f.SubmittedAt DESC';
        sqlQuery += ' OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';

        context.log('Executing query:', sqlQuery);
        const result = await query(sqlQuery, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM Feedback';
        if (eventCode) {
            countQuery += ' WHERE EventCode = @eventCode';
        }
        const countResult = await query(countQuery, eventCode ? { eventCode } : {});

        context.res = success({
            feedback: result.recordset,
            total: countResult.recordset[0].total,
            limit,
            offset
        });

    } catch (err) {
        context.log.error('Error fetching feedback:', err);
        context.res = error(500, 'Failed to fetch feedback', 'SERVER_ERROR');
    }
};
