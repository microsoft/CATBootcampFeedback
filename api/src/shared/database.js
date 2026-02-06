/**
 * Azure SQL Database connection and utilities
 */

const sql = require('mssql');

// Connection pool
let pool = null;

/**
 * Get database configuration from environment variables
 */
function getDbConfig() {
    return {
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        options: {
            encrypt: true,
            trustServerCertificate: false,
            enableArithAbort: true
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

/**
 * Get or create database connection pool
 */
async function getPool() {
    if (!pool) {
        const config = getDbConfig();
        pool = await sql.connect(config);
    }
    return pool;
}

/**
 * Execute a query
 */
async function query(queryString, params = {}) {
    try {
        const pool = await getPool();
        const request = pool.request();

        // Add parameters
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }

        const result = await request.query(queryString);
        return result.recordset;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

/**
 * Execute a stored procedure
 */
async function execute(procedureName, params = {}) {
    try {
        const pool = await getPool();
        const request = pool.request();

        // Add parameters
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }

        const result = await request.execute(procedureName);
        return result.recordset;
    } catch (error) {
        console.error('Stored procedure execution error:', error);
        throw error;
    }
}

/**
 * Close database connection
 */
async function close() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}

module.exports = {
    query,
    execute,
    close,
    sql
};
