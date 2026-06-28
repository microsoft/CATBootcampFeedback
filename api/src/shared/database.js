/**
 * Azure SQL Database connection and utilities
 */

const sql = require('mssql');

// Singleton promise for the connection pool.
// Using a promise (rather than the resolved pool) ensures that concurrent
// cold-start requests all await the same connection attempt instead of each
// racing to open their own TCP connection — which caused mass 15-second
// timeouts when the Azure Functions host scaled from zero.
let poolPromise = null;

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
            trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true' || process.env.NODE_ENV === 'development',
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
 * Get or create the shared database connection pool.
 * All concurrent callers share the same promise so only one TCP handshake
 * is attempted at a time. If the connection fails the promise is cleared so
 * the next request can try again.
 */
async function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(getDbConfig()).catch(err => {
            poolPromise = null; // reset so the next request retries
            throw err;
        });
    }
    return poolPromise;
}

/**
 * Execute a query (returns recordset — use for SELECT)
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
 * Execute a write operation (returns full result with rowsAffected — use for INSERT/UPDATE/DELETE)
 */
async function mutate(queryString, params = {}) {
    try {
        const pool = await getPool();
        const request = pool.request();

        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }

        return await request.query(queryString);
    } catch (error) {
        console.error('Database mutate error:', error);
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
 * Run `fn` inside a SQL transaction. `fn` receives a tx object exposing
 * `query` and `mutate` that execute against the transaction. If `fn` throws,
 * the transaction is rolled back and the original error is re-thrown; if
 * `fn` returns, the transaction is committed and its return value forwarded.
 *
 * Use this for multi-statement writes that must be atomic — e.g., inserting
 * an Event and its EventModules together so a mid-flight failure can't leave
 * an orphaned parent row behind.
 */
async function withTransaction(fn) {
    const connectedPool = await getPool();
    const transaction = new sql.Transaction(connectedPool);
    await transaction.begin();

    const txQuery = async (queryString, params = {}) => {
        const request = new sql.Request(transaction);
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }
        const result = await request.query(queryString);
        return result.recordset;
    };

    const txMutate = async (queryString, params = {}) => {
        const request = new sql.Request(transaction);
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }
        return await request.query(queryString);
    };

    try {
        const result = await fn({ query: txQuery, mutate: txMutate });
        await transaction.commit();
        return result;
    } catch (err) {
        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error('Transaction rollback failed:', rollbackErr);
        }
        throw err;
    }
}

/**
 * Close database connection
 */
async function close() {
    if (poolPromise) {
        try {
            const pool = await poolPromise;
            await pool.close();
        } catch {
            // ignore errors during close
        }
        poolPromise = null;
    }
}

module.exports = {
    query,
    mutate,
    execute,
    withTransaction,
    close,
    sql
};