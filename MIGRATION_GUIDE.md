# Database Migration Guide

**Date:** 2026-02-04
**Migration:** Events-only → Modules + Events separated schema

---

## ⚠️ Before You Start

### Prerequisites
1. ✅ Backup your Azure SQL Database
2. ✅ Have Azure Portal access
3. ✅ Review `MIGRATION_SCRIPT.sql`
4. ✅ Schedule maintenance window (estimated: 5-10 minutes)

### What This Migration Does

**Creates:**
- `Modules` table (timeless training content)
- New `Events` table structure (delivery instances with dates)
- Views: `vw_EventsWithModules`, `vw_FeedbackWithDetails`, `vw_EventFeedbackCounts`
- Stored procedures: `sp_GetEventByCode`, `sp_GetFeedbackCountByEventCode`

**Migrates:**
- Module data from old Events table → new Modules table
- Event codes → new Events table (linked to modules)
- Preserves all feedback data

**Backs Up:**
- Old Events table → `Events_Backup_Old`

---

## 🚀 Migration Steps

### Option 1: Azure Portal Query Editor (Recommended)

1. **Open Azure Portal**
   - Go to: https://portal.azure.com
   - Navigate to: SQL databases → `catbootcamp-feedback-db`

2. **Open Query Editor**
   - Click "Query editor" in left menu
   - Login with SQL authentication or Azure AD

3. **Backup Database (IMPORTANT)**
   ```sql
   -- Verify current data
   SELECT COUNT(*) AS EventCount FROM Events;
   SELECT COUNT(*) AS FeedbackCount FROM Feedback;
   ```
   - Take note of counts
   - Consider creating a database backup through Azure Portal

4. **Execute Migration Script**
   - Open `MIGRATION_SCRIPT.sql` from your local files
   - Copy entire contents
   - Paste into Query Editor
   - Click "Run"
   - Wait for completion (watch for success messages)

5. **Verify Migration**
   ```sql
   -- Check modules
   SELECT * FROM Modules;

   -- Check events with modules
   SELECT * FROM vw_EventsWithModules;

   -- Check feedback counts
   SELECT * FROM vw_EventFeedbackCounts;

   -- Verify feedback still linked
   SELECT COUNT(*) FROM Feedback f
   INNER JOIN Events e ON f.EventId = e.EventId
   INNER JOIN Modules m ON e.ModuleId = m.ModuleId;
   ```

6. **Test Stored Procedures**
   ```sql
   -- Test getting event by code
   EXEC sp_GetEventByCode 'CSA1B2C3';

   -- Test getting feedback count
   EXEC sp_GetFeedbackCountByEventCode 'CSA1B2C3';
   ```

### Option 2: Azure CLI / sqlcmd

```bash
# Install Azure CLI if needed
# https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

# Login to Azure
az login

# Get connection string
az sql db show-connection-string \
  --server catbootcamp-feedback-server \
  --name catbootcamp-feedback-db \
  --client sqlcmd

# Execute migration
sqlcmd -S catbootcamp-feedback-server.database.windows.net \
  -d catbootcamp-feedback-db \
  -U sqladmin \
  -P <password> \
  -i MIGRATION_SCRIPT.sql \
  -o migration_output.txt

# Check output
cat migration_output.txt
```

### Option 3: SQL Server Management Studio (SSMS)

1. **Connect to Azure SQL**
   - Server: `catbootcamp-feedback-server.database.windows.net`
   - Database: `catbootcamp-feedback-db`
   - Authentication: SQL or Azure AD

2. **Open Migration Script**
   - File → Open → `MIGRATION_SCRIPT.sql`

3. **Execute**
   - Ensure correct database is selected
   - Click Execute or press F5
   - Monitor Messages tab for progress

4. **Verify Results**
   - Refresh Object Explorer
   - Check tables, views, stored procedures

---

## ✅ Verification Checklist

After migration, verify:

- [ ] `Modules` table exists and has data
- [ ] `Events` table has new structure (EventCode, ModuleId, StartDate, EndDate, CohortId)
- [ ] `Events_Backup_Old` table exists (backup of old structure)
- [ ] `Feedback` table still has all records
- [ ] `vw_EventsWithModules` view returns data
- [ ] `vw_FeedbackWithDetails` view returns data
- [ ] `vw_EventFeedbackCounts` view returns data
- [ ] `sp_GetEventByCode` procedure works
- [ ] `sp_GetFeedbackCountByEventCode` procedure works
- [ ] Foreign key constraints exist
- [ ] Indexes created on Events table

**Verification Queries:**
```sql
-- Count check
SELECT
    (SELECT COUNT(*) FROM Modules) AS ModuleCount,
    (SELECT COUNT(*) FROM Events) AS EventCount,
    (SELECT COUNT(*) FROM Feedback) AS FeedbackCount,
    (SELECT COUNT(*) FROM Events_Backup_Old) AS OldEventsCount;

-- Data integrity check
SELECT
    m.ModuleName,
    COUNT(DISTINCT e.EventId) AS EventCount,
    COUNT(f.FeedbackId) AS FeedbackCount
FROM Modules m
LEFT JOIN Events e ON m.ModuleId = e.ModuleId
LEFT JOIN Feedback f ON e.EventId = f.EventId
GROUP BY m.ModuleName;

-- View check
SELECT * FROM vw_EventsWithModules;
SELECT * FROM vw_FeedbackWithDetails;
SELECT * FROM vw_EventFeedbackCounts;
```

---

## 🔄 Rollback Plan (If Needed)

If migration fails or issues are found:

```sql
-- Step 1: Drop new tables
DROP TABLE IF EXISTS Events;  -- New structure
DROP TABLE IF EXISTS Modules;

-- Step 2: Restore old Events table
SELECT * INTO Events FROM Events_Backup_Old;

-- Step 3: Recreate indexes on Events
CREATE INDEX IX_Events_EventCode ON Events(EventCode);

-- Step 4: Verify
SELECT COUNT(*) FROM Events;
SELECT COUNT(*) FROM Feedback;
```

---

## 📊 Expected Results

### Before Migration
```
Events table:
├── EventId
├── EventCode
├── ModuleName     ← Will move to Modules
├── ModuleDate     ← Will become StartDate in Events
├── SpeakerName    ← Will move to Modules
├── CohortId       ← Will stay in Events
└── Description    ← Will move to Modules
```

### After Migration
```
Modules table:
├── ModuleId
├── ModuleName
├── SpeakerName
├── Description
└── IsActive

Events table:
├── EventId
├── EventCode
├── ModuleId (FK → Modules)
├── StartDate
├── EndDate
├── CohortId
└── IsActive
```

---

## 🐛 Troubleshooting

### Issue: Foreign Key Constraint Error
**Symptom:** Error creating FK_Events_Modules
**Solution:**
```sql
-- Check for orphaned event records
SELECT * FROM Events e
WHERE NOT EXISTS (SELECT 1 FROM Modules m WHERE m.ModuleId = e.ModuleId);

-- Delete or fix orphaned records before adding constraint
```

### Issue: Duplicate Event Codes
**Symptom:** Error inserting into Events (duplicate EventCode)
**Solution:**
```sql
-- Find duplicates in old data
SELECT EventCode, COUNT(*) AS Count
FROM Events_Backup_Old
GROUP BY EventCode
HAVING COUNT(*) > 1;

-- Handle duplicates manually or modify migration script
```

### Issue: Missing Columns in Old Events
**Symptom:** Error selecting ModuleName or other columns
**Solution:**
- Old schema might be different than expected
- Check actual structure: `EXEC sp_columns 'Events_Backup_Old'`
- Adjust migration script accordingly

---

## 📞 Support

If migration fails:
1. Check `migration_output.txt` or Messages tab for specific errors
2. Review troubleshooting section above
3. Don't panic - old data is backed up in `Events_Backup_Old`
4. Can rollback using rollback plan above

---

## ⏭️ After Migration

Once migration is successful:

1. **Deploy Updated API Endpoints**
   - New endpoints are already in code
   - Azure Static Web Apps will pick them up on next deployment

2. **Test API Endpoints**
   ```bash
   # Test get event
   curl https://yoursite.azurestaticapps.net/api/events/CSA1B2C3

   # Test feedback count
   curl https://yoursite.azurestaticapps.net/api/events/CSA1B2C3/count

   # Test get modules
   curl https://yoursite.azurestaticapps.net/api/modules
   ```

3. **Update Frontend**
   - Admin interface updates coming next
   - Will support Modules and Events management

4. **Monitor**
   - Watch Application Insights for errors
   - Verify feedback submissions still working
   - Check live counter displays correctly

---

## 🎯 Success Criteria

Migration is successful when:
- ✅ All old data preserved
- ✅ No feedback records lost
- ✅ Views return correct data
- ✅ Stored procedures execute without errors
- ✅ Foreign key relationships intact
- ✅ Sample data available for testing (if database was empty)

---

**Ready to migrate? Follow Option 1 (Azure Portal) for easiest execution!**
