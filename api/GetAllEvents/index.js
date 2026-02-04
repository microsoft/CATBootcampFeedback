const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

module.exports = async function (context, req) {
    context.log('GetAllEvents function triggered');

    try {
        // Get query parameters for filtering
        const isActive = req.query.isActive;
        const sortBy = req.query.sortBy || 'ModuleDate';
        const sortOrder = req.query.sortOrder || 'DESC';

        // Build query based on filters
        let sqlQuery = 'SELECT * FROM Events';
        const params = {};

        if (isActive !== undefined) {
            sqlQuery += ' WHERE IsActive = @isActive';
            params.isActive = isActive === 'true' || isActive === '1';
        }

        // Add sorting
        const validSortColumns = ['ModuleDate', 'CreatedAt', 'ModuleName', 'EventCode'];
        const validSortOrders = ['ASC', 'DESC'];

        if (validSortColumns.includes(sortBy) && validSortOrders.includes(sortOrder.toUpperCase())) {
            sqlQuery += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
        }

        context.log('Executing query:', sqlQuery);
        const result = await query(sqlQuery, params);

        context.res = success({
            events: result.recordset,
            count: result.recordset.length
        });

    } catch (err) {
        context.log.error('Error fetching events:', err);
        context.res = error(500, 'Failed to fetch events', 'SERVER_ERROR');
    }
};
