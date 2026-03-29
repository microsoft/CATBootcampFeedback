/**
 * Audit Logging
 *
 * Records all authenticated user actions. Never tracks anonymous feedback submissions.
 * Usage: await audit(req, 'CREATE', 'User', userId, 'Created user jdoe', { email, roles });
 */

const { mutate } = require('./database');
const { getAuthenticatedUser } = require('./auth');

/**
 * Log an audit event.
 *
 * @param {Object} req - The HTTP request (used to extract user and IP)
 * @param {string} action - Action verb: CREATE, UPDATE, DELETE, LOGIN, RESET_PASSWORD, etc.
 * @param {string} resourceType - What was acted on: User, Event, Module, EventModule, Feedback, Role, EventAccess, Password, System
 * @param {string|number|null} resourceId - ID of the affected resource
 * @param {string} summary - Human-readable one-line summary of what happened
 * @param {Object} [details] - Optional JSON-serializable details
 */
async function audit(req, action, resourceType, resourceId, summary, details) {
    try {
        const user = getAuthenticatedUser(req);
        if (!user) return; // Don't log unauthenticated actions

        const ip = req.headers?.get
            ? (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown')
            : (req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown');

        await mutate(
            `INSERT INTO AuditLog (UserId, Username, Action, ResourceType, ResourceId, Summary, Details, IpAddress)
             VALUES (@userId, @username, @action, @resourceType, @resourceId, @summary, @details, @ip)`,
            {
                userId: user.userId || 0,
                username: user.username || 'unknown',
                action: action.toUpperCase(),
                resourceType,
                resourceId: resourceId != null ? String(resourceId) : null,
                summary: summary.substring(0, 500),
                details: details ? JSON.stringify(details) : null,
                ip: typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown'
            }
        );
    } catch (err) {
        // Never let audit logging failures break the main flow
        console.error('Audit log write failed:', err.message);
    }
}

module.exports = { audit };
