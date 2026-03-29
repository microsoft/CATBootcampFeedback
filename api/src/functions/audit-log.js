/**
 * Audit Log API
 * GET /api/audit-log — Query audit logs with filtering, search, and pagination
 * Requires GlobalAdmin role.
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { requireRole } = require('../shared/auth');
const { addSecurityHeaders } = require('../shared/utils');

app.http('getAuditLog', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'audit-log',
    handler: async (request, context) => {
        // Only GlobalAdmin can view audit logs
        const roleError = requireRole(request);
        if (roleError) return roleError;

        try {
            const url = new URL(request.url);
            const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
            const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize')) || 50));
            const search = url.searchParams.get('search') || '';
            const action = url.searchParams.get('action') || '';
            const resourceType = url.searchParams.get('resourceType') || '';
            const username = url.searchParams.get('username') || '';
            const dateFrom = url.searchParams.get('dateFrom') || '';
            const dateTo = url.searchParams.get('dateTo') || '';

            // Build WHERE clauses
            const conditions = [];
            const params = {};

            if (search) {
                conditions.push(`(a.Summary LIKE @search OR a.Username LIKE @search OR a.Details LIKE @search OR a.Action LIKE @search)`);
                params.search = `%${search}%`;
            }
            if (action) {
                conditions.push('a.Action = @action');
                params.action = action;
            }
            if (resourceType) {
                conditions.push('a.ResourceType = @resourceType');
                params.resourceType = resourceType;
            }
            if (username) {
                conditions.push('a.Username = @username');
                params.username = username;
            }
            if (dateFrom) {
                conditions.push('a.Timestamp >= @dateFrom');
                params.dateFrom = dateFrom;
            }
            if (dateTo) {
                conditions.push('a.Timestamp <= @dateTo');
                params.dateTo = dateTo + 'T23:59:59';
            }

            const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            // Get total count for pagination
            const countResult = await query(
                `SELECT COUNT(*) AS total FROM AuditLog a ${where}`,
                params
            );
            const total = countResult[0].total;

            // Get paginated results
            const offset = (page - 1) * pageSize;
            const logs = await query(
                `SELECT a.AuditLogId, a.UserId, a.Username, a.Action, a.ResourceType,
                        a.ResourceId, a.Summary, a.Details, a.IpAddress, a.Timestamp
                 FROM AuditLog a
                 ${where}
                 ORDER BY a.Timestamp DESC
                 OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
                { ...params, offset, pageSize }
            );

            // Get distinct values for filter dropdowns
            const [actions, resourceTypes, usernames] = await Promise.all([
                query('SELECT DISTINCT Action FROM AuditLog ORDER BY Action'),
                query('SELECT DISTINCT ResourceType FROM AuditLog ORDER BY ResourceType'),
                query('SELECT DISTINCT Username FROM AuditLog ORDER BY Username')
            ]);

            return addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        logs: logs.map(l => ({
                            ...l,
                            Details: l.Details ? JSON.parse(l.Details) : null
                        })),
                        pagination: {
                            page,
                            pageSize,
                            total,
                            totalPages: Math.ceil(total / pageSize)
                        },
                        filters: {
                            actions: actions.map(a => a.Action),
                            resourceTypes: resourceTypes.map(r => r.ResourceType),
                            usernames: usernames.map(u => u.Username)
                        }
                    }
                }
            });

        } catch (err) {
            context.log('Audit log query error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Failed to query audit logs' }
            });
        }
    }
});
