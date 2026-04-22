/**
 * One-off maintenance: delete orphan Events rows that have zero EventModules.
 *
 * Needed because, prior to the create-event-from-template.js transaction fix,
 * a mid-flight failure could leave an Events row behind with no modules — and
 * because EventCode is unique, the user would hit "Event code already exists"
 * on retry. This script finds those zero-module rows and removes them.
 *
 * Defaults to a DRY RUN. Pass --confirm to actually delete.
 * Pass --code=EVENT_CODE to target a single code. Omit to list all orphans.
 *
 * Usage:
 *   node scripts/cleanup-orphan-events.js                          # list all
 *   node scripts/cleanup-orphan-events.js --code=MCA-VRT-R0T8      # list one
 *   node scripts/cleanup-orphan-events.js --code=MCA-VRT-R0T8 --confirm
 *
 * Environment variables required:
 *   SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD
 *   (Per project policy these must come from Key Vault, not plaintext.)
 *
 * Safety: will refuse to delete any Events row that has one or more
 * EventModules, Feedback, or UserEventAccess rows referencing it. Only
 * pure orphans (zero children) are eligible.
 */

const sql = require('mssql');

const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
const codeArg = args.find(a => a.startsWith('--code='));
const TARGET_CODE = codeArg ? codeArg.split('=')[1].toUpperCase() : null;

function getDbConfig() {
    const required = ['SQL_SERVER', 'SQL_DATABASE', 'SQL_USER', 'SQL_PASSWORD'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.error(`ERROR: Missing required env vars: ${missing.join(', ')}`);
        process.exit(1);
    }
    return {
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
        pool: { max: 2, min: 0, idleTimeoutMillis: 30000 }
    };
}

async function run() {
    console.log(`\n=== Orphan Events cleanup ===`);
    console.log(`Mode: ${CONFIRM ? 'DELETE (confirmed)' : 'DRY RUN (use --confirm to delete)'}`);
    console.log(`Filter: ${TARGET_CODE ? `EventCode = ${TARGET_CODE}` : 'all orphans'}\n`);

    const pool = await sql.connect(getDbConfig());

    const whereCode = TARGET_CODE ? 'AND e.EventCode = @code' : '';
    const listSql = `
        SELECT e.EventId, e.EventCode, e.EventName, e.CreatedAt, e.CreatedBy,
               (SELECT COUNT(*) FROM EventModules em WHERE em.EventId = e.EventId) AS ModuleCount,
               (SELECT COUNT(*) FROM Feedback f WHERE f.EventId = e.EventId) AS FeedbackCount,
               (SELECT COUNT(*) FROM UserEventAccess uea WHERE uea.EventId = e.EventId) AS AccessCount
        FROM Events e
        WHERE 1=1 ${whereCode}
        ORDER BY e.CreatedAt DESC
    `;

    const listReq = pool.request();
    if (TARGET_CODE) listReq.input('code', TARGET_CODE);
    const { recordset: rows } = await listReq.query(listSql);

    if (rows.length === 0) {
        console.log(TARGET_CODE ? `No event found with code ${TARGET_CODE}.` : 'No events in table.');
        await pool.close();
        return;
    }

    const orphans = rows.filter(r => r.ModuleCount === 0 && r.FeedbackCount === 0 && r.AccessCount === 0);
    const nonOrphans = rows.filter(r => !orphans.includes(r));

    if (nonOrphans.length > 0) {
        console.log(`Rows with child data (will NOT be touched):`);
        for (const r of nonOrphans) {
            console.log(`  [${r.EventId}] ${r.EventCode} — modules=${r.ModuleCount} feedback=${r.FeedbackCount} access=${r.AccessCount}`);
        }
        console.log('');
    }

    if (orphans.length === 0) {
        console.log('No pure orphan rows found. Nothing to clean up.');
        await pool.close();
        return;
    }

    console.log(`Pure orphans eligible for deletion:`);
    for (const r of orphans) {
        console.log(`  [${r.EventId}] ${r.EventCode} "${r.EventName}" — created ${r.CreatedAt.toISOString()} by ${r.CreatedBy}`);
    }
    console.log('');

    if (!CONFIRM) {
        console.log('DRY RUN — re-run with --confirm to delete these rows.');
        await pool.close();
        return;
    }

    let deleted = 0;
    for (const r of orphans) {
        const delReq = pool.request();
        delReq.input('id', r.EventId);
        const result = await delReq.query(`
            DELETE FROM Events
            WHERE EventId = @id
              AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = @id)
              AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventId = @id)
              AND NOT EXISTS (SELECT 1 FROM UserEventAccess uea WHERE uea.EventId = @id)
        `);
        if (result.rowsAffected[0] === 1) {
            deleted++;
            console.log(`  deleted [${r.EventId}] ${r.EventCode}`);
        } else {
            console.log(`  skipped [${r.EventId}] ${r.EventCode} (children appeared between list and delete)`);
        }
    }
    console.log(`\nDeleted ${deleted} orphan row(s).`);
    await pool.close();
}

run().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
});
