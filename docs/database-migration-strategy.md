# Database Migration Strategy

## Overview

This document outlines the strategy for managing database schema changes and data migrations for the CATBootcampFeedback application.

## Environment Details

### QA Environment
- **Server:** cat-bootcamp-sql-qa2.database.windows.net
- **Database:** CATBootcampFeedback-QA
- **Resource Group:** cat-bootcamp-qa-rg
- **Key Vault:** cat-bootcamp-kv-qa
- **Purpose:** Application environment for testing and live use
- **Data:** Event and feedback data

## Database Schema Management

### Schema Initialization

**Database Setup:**
1. Navigate to Azure Portal (https://portal.azure.com)
2. Open **CATBootcampFeedback-QA** database
3. Open **Query editor (preview)**
4. Login with SQL authentication:
   - Username: `sqladmin`
   - Password: (stored in Azure Key Vault `cat-bootcamp-kv-qa`)
5. Run: `database-init-PORTAL-ALL-IN-ONE.sql`

**What gets created:**
- **9 Tables:** Events, Modules, EventModules, Feedback, Users, Roles, UserRoles, UserEventAccess, AuditLog
- **4 Views:** vw_EventsWithModules, vw_FeedbackWithDetails, vw_EventFeedbackCounts, vw_UsersWithRoles
- **2 Stored Procedures:** sp_GetEventByCode, sp_GetFeedbackCountByEventCode

### Schema Version Control

All database schema files are version-controlled in the repository:

```
CATBootcampFeedback/
├── database-init-PORTAL-ALL-IN-ONE.sql  (Complete schema initialization)
├── database-init-part1-tables.sql       (Individual parts if needed)
├── database-init-part2-views1.sql
├── database-init-part3-views2.sql
├── database-init-part4-views3.sql
├── database-init-part5-sp1.sql
├── database-init-part6-sp2.sql
├── restore-dev-sample-data-v2.sql       (Sample data)
├── database-cleanup.sql                 (Drop all objects)
├── migrations/
│   ├── rename-cohort-to-training-track.sql
│   ├── 002-add-user-management.sql     (Users, Roles, UserRoles, UserEventAccess)
│   ├── 003-add-profile-image.sql       (ProfileImage column)
│   ├── 004-add-audit-log.sql           (AuditLog table)
│   └── 005-widen-event-code.sql        (EventCode NVARCHAR(8) -> (50))
```

### Schema Changes Process

**Making Schema Changes:**

1. **Create Migration Script:**
   - Create new migration script with clear naming: `migration-YYYY-MM-DD-description.sql`
   - Include DROP IF EXISTS for modified objects
   - Use EXEC() wrapper for CREATE VIEW/PROCEDURE statements

2. **Test Migration:**
   - Test on QA database
   - Verify existing data remains intact
   - Verify API functions correctly

3. **Apply Migration:**
   - Schedule maintenance window (if needed)
   - Backup database first
   - Run migration script via Azure Portal Query Editor
   - Verify API functionality
   - Document completion in deployment log

## Data Migration Strategy

### Data Seeding

Use `restore-dev-sample-data-v2.sql` to populate sample data for testing.

Real data comes from:
- Admin UI for creating events and modules
- Public feedback form submissions
- Manual SQL scripts for specific scenarios (approved by admin)

## Backup and Recovery

### Automated Backups

Azure SQL Database provides automatic backups:
- **Point-in-time restore:** Last 7-35 days (depending on tier)
- **Long-term retention:** Configure if needed

### Manual Backup Before Changes

Before any schema migration:

```bash
# Via Azure CLI
az sql db export \
  --resource-group cat-bootcamp-qa-rg \
  --server cat-bootcamp-sql-qa2 \
  --name CATBootcampFeedback-QA \
  --admin-user sqladmin \
  --admin-password <password> \
  --storage-key-type SharedAccessKey \
  --storage-key <storage-key> \
  --storage-uri https://<storage-account>.blob.core.windows.net/<container>/backup-YYYY-MM-DD.bacpac
```

### Rollback Procedures

**Schema Rollback:**

1. **If migration fails mid-execution:**
   - Run `database-cleanup.sql` to drop all objects
   - Run previous working `database-init-PORTAL-ALL-IN-ONE.sql`
   - Restore data from backup if needed

2. **If migration succeeds but causes issues:**
   - Point-in-time restore from Azure Portal
   - Or restore from manual backup (`.bacpac` file)

**Data Rollback:**

1. Navigate to Azure Portal -> CATBootcampFeedback-QA
2. Select **Restore** from top menu
3. Choose point-in-time or manual backup
4. Restore to new database name first, verify, then swap

## Connection String Management

### Environment Variables

**Functions App (catbootcamp-api-qa) -- resolved from Key Vault:**
```
SQL_SERVER=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-SERVER)
SQL_DATABASE=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-DATABASE)
SQL_USER=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-USER)
SQL_PASSWORD=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-PASSWORD)
```

### Security Best Practices

1. **Never commit passwords** to version control
2. **Rotate passwords** quarterly
3. **Use Azure Key Vault** for all secrets (`cat-bootcamp-kv-qa`)
4. **Enable SQL auditing**

## Azure Portal Query Editor Limitations

**Known Limitations:**
- No support for `GO` batch separator
- `CREATE VIEW` and `CREATE PROCEDURE` must be first statement in batch
- External SQL authentication blocked by security policy

**Workarounds:**
- Split scripts into separate files OR use all-in-one script
- Wrap CREATE statements in `EXEC()` for dynamic execution
- Always use Azure Portal Query Editor (not external tools)

**Example:**
```sql
-- Drop if exists
IF OBJECT_ID('vw_MyView', 'V') IS NOT NULL DROP VIEW vw_MyView;

-- Create in EXEC() wrapper
EXEC('
CREATE VIEW vw_MyView AS
SELECT * FROM MyTable;
');
```

## Monitoring and Validation

### Post-Migration Validation

After any schema change, verify:

1. **API Health:**
   ```bash
   curl https://catbootcamp-api-qa.azurewebsites.net/api/health
   ```

2. **Event Retrieval:**
   ```bash
   curl https://catbootcamp-api-qa.azurewebsites.net/api/events
   ```

3. **Database Objects:**
   ```sql
   SELECT 'Tables' AS ObjectType, COUNT(*) AS Count
   FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
   UNION ALL
   SELECT 'Views', COUNT(*) FROM INFORMATION_SCHEMA.VIEWS
   UNION ALL
   SELECT 'Stored Procedures', COUNT(*)
   FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE';

   -- Expected: Tables=12, Views=4, Stored Procedures=2
   ```

4. **Sample Query:**
   ```sql
   SELECT COUNT(*) AS EventCount FROM Events;
   SELECT COUNT(*) AS FeedbackCount FROM Feedback;
   ```

### Error Monitoring

Monitor Azure Functions logs for database errors:

```bash
az functionapp logs tail \
  --name catbootcamp-api-qa \
  --resource-group cat-bootcamp-qa-rg
```

## Change Log

| Date | Change Description | Script Used | Applied By |
|------|-------------------|-------------|------------|
| 2026-02-06 | Initial schema setup | database-init-PORTAL-ALL-IN-ONE.sql | System Admin |
| 2026-02-06 | Sample data restoration | restore-dev-sample-data-v2.sql | System Admin |
| 2026-03 | User management & RBAC tables | migrations/002-add-user-management.sql | System Admin |
| 2026-03 | ProfileImage column on Users | migrations/003-add-profile-image.sql | System Admin |
| 2026-03 | AuditLog table | migrations/004-add-audit-log.sql | System Admin |
| 2026-03 | Widen EventCode to NVARCHAR(50) | migrations/005-widen-event-code.sql | System Admin |

---

## Quick Reference

**Initialize Schema:**
```sql
-- Run in Azure Portal Query Editor on CATBootcampFeedback-QA
-- Use: database-init-PORTAL-ALL-IN-ONE.sql
```

**Restore Sample Data:**
```sql
-- Run in Azure Portal Query Editor on CATBootcampFeedback-QA
-- Use: restore-dev-sample-data-v2.sql
```

**Backup Before Changes:**
```bash
az sql db export --resource-group cat-bootcamp-qa-rg --server cat-bootcamp-sql-qa2 --name CATBootcampFeedback-QA ...
```

**Verify Schema:**
```sql
SELECT 'Tables' AS ObjectType, COUNT(*) AS Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
UNION ALL SELECT 'Views', COUNT(*) FROM INFORMATION_SCHEMA.VIEWS
UNION ALL SELECT 'Stored Procedures', COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE';
```
