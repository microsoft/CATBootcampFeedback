/**
 * Diagnostic Test API
 * GET /api/diagnostic
 * Tests environment variables and database connection
 */

const sql = require('mssql');

module.exports = async function (context, req) {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        environmentVariables: {
            SQL_SERVER: process.env.SQL_SERVER ? 'SET' : 'NOT SET',
            SQL_DATABASE: process.env.SQL_DATABASE ? 'SET' : 'NOT SET',
            SQL_USER: process.env.SQL_USER ? 'SET' : 'NOT SET',
            SQL_PASSWORD: process.env.SQL_PASSWORD ? 'SET (length: ' + (process.env.SQL_PASSWORD?.length || 0) + ')' : 'NOT SET'
        },
        databaseTest: null
    };

    // Test database connection
    if (process.env.SQL_SERVER && process.env.SQL_DATABASE && process.env.SQL_USER && process.env.SQL_PASSWORD) {
        try {
            const config = {
                server: process.env.SQL_SERVER,
                database: process.env.SQL_DATABASE,
                user: process.env.SQL_USER,
                password: process.env.SQL_PASSWORD,
                options: {
                    encrypt: true,
                    trustServerCertificate: false,
                    enableArithAbort: true,
                    connectTimeout: 30000
                }
            };

            context.log('Attempting database connection...');
            const pool = await sql.connect(config);
            context.log('Database connected successfully');

            const result = await pool.request().query('SELECT @@VERSION AS Version, DB_NAME() AS Database');
            diagnostics.databaseTest = {
                status: 'SUCCESS',
                database: result.recordset[0].Database,
                version: result.recordset[0].Version.substring(0, 100) + '...'
            };

            await pool.close();
        } catch (error) {
            context.log.error('Database connection error:', error);
            diagnostics.databaseTest = {
                status: 'FAILED',
                error: error.message,
                code: error.code,
                stack: error.stack?.substring(0, 500)
            };
        }
    } else {
        diagnostics.databaseTest = {
            status: 'SKIPPED',
            reason: 'Missing environment variables'
        };
    }

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: diagnostics
    };
};
