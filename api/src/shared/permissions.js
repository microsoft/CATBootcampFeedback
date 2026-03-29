/**
 * Centralized Permission Definitions & Helpers
 *
 * All role-to-permission mappings live here so they stay consistent
 * across API endpoints and can be shared with the frontend.
 *
 * GlobalAdmin is NOT listed in PERMISSIONS — it bypasses all checks
 * automatically via requireRole() and hasPermission().
 */

const { query } = require('./database');

/**
 * Permission → allowed roles mapping.
 * GlobalAdmin implicitly has every permission (handled in hasPermission).
 */
const PERMISSIONS = {
    // User management
    MANAGE_USERS:           ['UserAdmin'],

    // Module management
    CREATE_MODULES:         ['ModuleManager'],
    EDIT_MODULES:           ['ModuleManager'],
    DELETE_MODULES:         ['ModuleManager'],
    VIEW_MODULES:           ['ModuleManager', 'EventCreator'],

    // Speaker management
    MANAGE_SPEAKERS:        ['ModuleManager'],
    VIEW_SPEAKERS:          ['ModuleManager', 'EventCreator'],

    // Template management
    MANAGE_TEMPLATES:       ['ModuleManager'],
    VIEW_TEMPLATES:         ['ModuleManager', 'EventCreator'],

    // Event management
    CREATE_EVENTS:          ['EventCreator'],
    EDIT_EVENTS:            ['EventCreator'],      // + resource access check
    DELETE_EVENTS:          [],                     // GlobalAdmin only

    // Event-module management
    MANAGE_EVENT_MODULES:   ['EventCreator'],      // + resource access check

    // Feedback
    VIEW_FEEDBACK:          ['EventCreator', 'FeedbackManager', 'FeedbackViewer'],
    DELETE_FEEDBACK:        ['FeedbackManager'],   // + resource access check
    EXPORT_FEEDBACK:        ['EventCreator', 'FeedbackManager', 'FeedbackViewer'],

    // Analytics
    VIEW_ANALYTICS:         ['EventCreator', 'FeedbackManager', 'FeedbackViewer'],
};

/**
 * Check if a user's roles grant a specific permission.
 * GlobalAdmin always returns true.
 *
 * @param {string[]} userRoles - Array of role names from the JWT
 * @param {string} permission - Key from PERMISSIONS
 * @returns {boolean}
 */
function hasPermission(userRoles, permission) {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    if (userRoles.includes('GlobalAdmin')) return true;

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) return false;

    return allowedRoles.some(role => userRoles.includes(role));
}

/**
 * Get the list of EventIds a user can access.
 * Returns null for GlobalAdmin (meaning "no filter — show everything").
 * For other users, returns an array of EventIds from:
 *   1. Events they created (CreatedBy matches their username)
 *   2. Events explicitly granted via UserEventAccess
 *
 * @param {number} userId
 * @param {string} username
 * @param {string[]} userRoles
 * @returns {Promise<number[]|null>} null = no filter, array = allowed EventIds
 */
async function getAccessibleEventIds(userId, username, userRoles) {
    if (userRoles.includes('GlobalAdmin')) return null;

    const result = await query(
        `SELECT EventId FROM UserEventAccess WHERE UserId = @userId
         UNION
         SELECT EventId FROM Events WHERE CreatedBy = @username AND IsDeleted = 0`,
        { userId, username }
    );

    return result.map(r => r.EventId);
}

/**
 * Check if a user has access to a specific event.
 * GlobalAdmin always returns true.
 *
 * @param {number} userId
 * @param {string} username
 * @param {string[]} userRoles
 * @param {number} eventId
 * @returns {Promise<boolean>}
 */
async function hasEventAccess(userId, username, userRoles, eventId) {
    if (userRoles.includes('GlobalAdmin')) return true;

    const result = await query(
        `SELECT 1 AS hasAccess FROM UserEventAccess WHERE UserId = @userId AND EventId = @eventId
         UNION
         SELECT 1 FROM Events WHERE EventId = @eventId AND CreatedBy = @username AND IsDeleted = 0`,
        { userId, username, eventId }
    );

    return result.length > 0;
}

/**
 * Build a SQL WHERE clause fragment to filter by accessible events.
 * Returns { clause, params } to be merged into a query.
 *
 * @param {number} userId
 * @param {string} username
 * @param {string[]} userRoles
 * @param {string} eventIdColumn - The column name to filter (e.g., 'e.EventId')
 * @returns {Promise<{clause: string, params: Object}>}
 */
async function buildEventAccessFilter(userId, username, userRoles, eventIdColumn) {
    const eventIds = await getAccessibleEventIds(userId, username, userRoles);

    if (eventIds === null) {
        // GlobalAdmin — no filter
        return { clause: '1=1', params: {} };
    }

    if (eventIds.length === 0) {
        // No access to any events
        return { clause: '1=0', params: {} };
    }

    // Build an IN clause with the accessible event IDs
    const idList = eventIds.join(',');
    return { clause: `${eventIdColumn} IN (${idList})`, params: {} };
}

module.exports = {
    PERMISSIONS,
    hasPermission,
    getAccessibleEventIds,
    hasEventAccess,
    buildEventAccessFilter
};
