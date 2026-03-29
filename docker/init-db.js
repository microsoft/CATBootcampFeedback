/**
 * Database initialization script for Docker.
 * Creates the database, runs schema + migration scripts, seeds test users.
 */

const sql = require('mssql');
const fs = require('fs');

const SA_PASSWORD = process.env.SA_PASSWORD;
const DB_HOST = process.env.DB_HOST || 'db';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForSql() {
    console.log('=== Waiting for SQL Server to be ready ===');
    for (let i = 0; i < 30; i++) {
        try {
            const pool = await sql.connect({
                server: DB_HOST,
                user: 'sa',
                password: SA_PASSWORD,
                options: { encrypt: false, trustServerCertificate: true }
            });
            await pool.request().query('SELECT 1');
            await pool.close();
            console.log('  SQL Server is ready!');
            return;
        } catch (err) {
            console.log(`  Attempt ${i + 1}/30 — ${err.message.substring(0, 60)}...`);
            await sleep(3000);
        }
    }
    throw new Error('SQL Server did not become ready in time');
}

async function runScript(pool, filePath, label) {
    console.log(`\n=== Running ${label} ===`);
    const script = fs.readFileSync(filePath, 'utf8');

    // Normalize line endings, then split on GO at line boundaries
    const normalized = script.replace(/\r\n/g, '\n');
    let batches = normalized.split(/^\s*GO\s*$/im).filter(b => b.trim());

    // Further split any batch that contains CREATE VIEW/PROCEDURE not at the start
    const expanded = [];
    for (const batch of batches) {
        // Split on CREATE VIEW or CREATE PROCEDURE boundaries
        const parts = batch.split(/(?=\bCREATE\s+(?:VIEW|PROCEDURE)\b)/i);
        for (const part of parts) {
            if (part.trim()) expanded.push(part.trim());
        }
    }
    batches = expanded;

    for (const batch of batches) {
        if (!batch.trim()) continue;
        try {
            await pool.request().query(batch);
        } catch (err) {
            // Ignore "already exists" errors for idempotent scripts
            if (err.message.includes('already exists') || err.message.includes('There is already')) {
                console.log(`  (skipped — already exists)`);
            } else {
                console.error(`  Error in batch: ${err.message.substring(0, 120)}`);
            }
        }
    }
    console.log(`  ${label} complete`);
}

async function main() {
    await waitForSql();

    // Connect as sa to master to create database
    console.log('\n=== Creating database ===');
    let pool = await sql.connect({
        server: DB_HOST,
        user: 'sa',
        password: SA_PASSWORD,
        database: 'master',
        options: { encrypt: false, trustServerCertificate: true }
    });

    await pool.request().query(`
        IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CATBootcampFeedback')
        BEGIN
            CREATE DATABASE CATBootcampFeedback;
        END
    `);
    console.log('  Database ready');
    await pool.close();

    // Reconnect to the app database
    pool = await sql.connect({
        server: DB_HOST,
        user: 'sa',
        password: SA_PASSWORD,
        database: 'CATBootcampFeedback',
        options: { encrypt: false, trustServerCertificate: true }
    });

    // Run scripts in order
    await runScript(pool, '/scripts/001-schema.sql', 'Schema (001)');
    await runScript(pool, '/scripts/002-user-management.sql', 'User Management (002)');
    await runScript(pool, '/scripts/003-seed-test-admin.sql', 'Test Users (003)');
    await runScript(pool, '/scripts/003b-profile-image.sql', 'Profile Image Column (003b)');
    await runScript(pool, '/scripts/003c-audit-log.sql', 'Audit Log Table (004)');
    await runScript(pool, '/scripts/003d-widen-event-code.sql', 'Widen EventCode (005)');
    await runScript(pool, '/scripts/004-seed-sample-data.sql', 'Sample Data (006)');

    await pool.close();

    console.log('\n============================================');
    console.log('  Database initialization complete!');
    console.log('');
    console.log('  Test accounts (password: Admin123!)');
    console.log('  admin         — GlobalAdmin (protected)');
    console.log('  useradmin     — UserAdmin');
    console.log('  modulemanager — ModuleManager');
    console.log('  eventcreator  — EventCreator');
    console.log('  feedbackmgr   — FeedbackManager');
    console.log('  reporter      — FeedbackViewer');
    console.log('============================================');
}

main().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
});
