/**
 * One-time migration script: ADMIN_USERS_JSON → Users table
 *
 * Reads existing admin users from the ADMIN_USERS_JSON environment variable
 * and inserts them into the database Users table with role assignments.
 *
 * Usage:
 *   node scripts/migrate-users-from-env.js [--global-admin=username]
 *
 * Options:
 *   --global-admin=username   Username to assign as the protected GlobalAdmin
 *                              (defaults to the first user in the JSON array)
 *
 * Environment variables required:
 *   ADMIN_USERS_JSON  JSON array of admin users
 *   SQL_SERVER        Azure SQL Server hostname
 *   SQL_DATABASE      Database name
 *   SQL_USER          Database username
 *   SQL_PASSWORD      Database password
 *
 * Safe to re-run: skips users that already exist by username.
 */

const sql = require('mssql');

// Parse CLI args
const args = process.argv.slice(2);
let globalAdminUsername = null;
for (const arg of args) {
    if (arg.startsWith('--global-admin=')) {
        globalAdminUsername = arg.split('=')[1];
    }
}

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
            max: 5,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

async function migrate() {
    // Validate environment
    const adminUsersJson = process.env.ADMIN_USERS_JSON;
    if (!adminUsersJson) {
        console.error('ERROR: ADMIN_USERS_JSON environment variable is not set.');
        process.exit(1);
    }

    let adminUsers;
    try {
        adminUsers = JSON.parse(adminUsersJson);
    } catch (err) {
        console.error('ERROR: Failed to parse ADMIN_USERS_JSON:', err.message);
        process.exit(1);
    }

    if (!Array.isArray(adminUsers) || adminUsers.length === 0) {
        console.error('ERROR: ADMIN_USERS_JSON must be a non-empty array.');
        process.exit(1);
    }

    // Default the global admin to the first user if not specified
    if (!globalAdminUsername) {
        globalAdminUsername = adminUsers[0].username;
    }

    console.log(`\nMigrating ${adminUsers.length} user(s) from ADMIN_USERS_JSON to database...`);
    console.log(`Global Admin will be: ${globalAdminUsername}\n`);

    let pool;
    try {
        pool = await sql.connect(getDbConfig());
        console.log('Connected to database.\n');

        // Verify the Users table exists
        const tableCheck = await pool.request().query(
            `SELECT COUNT(*) AS cnt FROM sys.tables WHERE name = 'Users'`
        );
        if (tableCheck.recordset[0].cnt === 0) {
            console.error('ERROR: Users table does not exist. Run migration 002 first.');
            process.exit(1);
        }

        // Load role IDs
        const roles = await pool.request().query('SELECT RoleId, RoleName FROM Roles');
        const roleMap = {};
        for (const r of roles.recordset) {
            roleMap[r.RoleName] = r.RoleId;
        }

        if (!roleMap.GlobalAdmin) {
            console.error('ERROR: GlobalAdmin role not found. Run migration 002 first.');
            process.exit(1);
        }

        // Load all existing events for granting access
        const events = await pool.request().query(
            'SELECT EventId FROM Events WHERE IsDeleted = 0'
        );
        const eventIds = events.recordset.map(e => e.EventId);
        console.log(`Found ${eventIds.length} existing event(s) to grant access to.\n`);

        let created = 0;
        let skipped = 0;

        for (const user of adminUsers) {
            const { username, passwordHash, fullName, email } = user;

            if (!username || !passwordHash) {
                console.log(`  SKIP: Invalid user entry (missing username or passwordHash)`);
                skipped++;
                continue;
            }

            // Check if user already exists
            const existing = await pool.request()
                .input('username', sql.NVarChar, username)
                .query('SELECT UserId FROM Users WHERE Username = @username');

            if (existing.recordset.length > 0) {
                console.log(`  SKIP: "${username}" already exists (UserId=${existing.recordset[0].UserId})`);
                skipped++;
                continue;
            }

            const isGlobalAdmin = username.toLowerCase() === globalAdminUsername.toLowerCase();

            // Insert user
            const result = await pool.request()
                .input('username', sql.NVarChar, username)
                .input('passwordHash', sql.NVarChar, passwordHash)
                .input('fullName', sql.NVarChar, fullName || username)
                .input('email', sql.NVarChar, email || `${username}@placeholder.com`)
                .input('isProtected', sql.Bit, isGlobalAdmin ? 1 : 0)
                .input('createdBy', sql.NVarChar, 'migration-script')
                .query(`
                    INSERT INTO Users (Username, PasswordHash, FullName, Email, IsActive, IsProtected, CreatedBy)
                    OUTPUT INSERTED.UserId
                    VALUES (@username, @passwordHash, @fullName, @email, 1, @isProtected, @createdBy)
                `);

            const userId = result.recordset[0].UserId;

            // Assign GlobalAdmin role to the designated admin
            if (isGlobalAdmin) {
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('roleId', sql.Int, roleMap.GlobalAdmin)
                    .input('assignedBy', sql.NVarChar, 'migration-script')
                    .query(`
                        INSERT INTO UserRoles (UserId, RoleId, AssignedBy)
                        VALUES (@userId, @roleId, @assignedBy)
                    `);
                console.log(`  ✓ Created "${username}" (UserId=${userId}) as PROTECTED GlobalAdmin`);
            } else {
                // Assign EventCreator as default role for non-global-admin users
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('roleId', sql.Int, roleMap.EventCreator)
                    .input('assignedBy', sql.NVarChar, 'migration-script')
                    .query(`
                        INSERT INTO UserRoles (UserId, RoleId, AssignedBy)
                        VALUES (@userId, @roleId, @assignedBy)
                    `);
                console.log(`  ✓ Created "${username}" (UserId=${userId}) with EventCreator role`);
            }

            // Grant access to all existing events
            for (const eventId of eventIds) {
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('eventId', sql.Int, eventId)
                    .input('grantedBy', sql.NVarChar, 'migration-script')
                    .query(`
                        IF NOT EXISTS (
                            SELECT 1 FROM UserEventAccess WHERE UserId = @userId AND EventId = @eventId
                        )
                        INSERT INTO UserEventAccess (UserId, EventId, GrantedBy)
                        VALUES (@userId, @eventId, @grantedBy)
                    `);
            }

            created++;
        }

        console.log(`\n============================================`);
        console.log(`  Migration complete`);
        console.log(`  Created: ${created} user(s)`);
        console.log(`  Skipped: ${skipped} user(s)`);
        console.log(`  Event access granted: ${created * eventIds.length} record(s)`);
        console.log(`============================================\n`);

    } catch (err) {
        console.error('Migration failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

migrate();
