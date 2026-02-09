# Database Migration: Cohort → Training Track

**Date:** February 9, 2026
**Migration Script:** `migrations/rename-cohort-to-training-track.sql`
**Status:** ✅ Completed on Development

---

## Overview

Renamed the field "Cohort/Batch ID" to "Training Track" throughout the application to better reflect its purpose. The field stores information about which training track or program an event belongs to.

## Changes Made

### Database Schema
- **Column Rename:** `Events.CohortId` → `Events.TrainingTrack`
- **Data Type:** `NVARCHAR(50) NULL` (unchanged)
- **Purpose:** Optional string field with no format requirements

### Database Objects Updated
1. **Column:**
   - `Events.TrainingTrack` (renamed from `CohortId`)

2. **Views:**
   - `vw_EventsWithModules` - Updated to use `TrainingTrack`
   - `vw_FeedbackWithDetails` - Updated to use `TrainingTrack`
   - `vw_EventFeedbackCounts` - Updated to use `TrainingTrack`

3. **Stored Procedures:**
   - `sp_GetEventByCode` - Updated to return `TrainingTrack`
   - `sp_GetFeedbackCountByEventCode` - Updated to return `TrainingTrack`

### Application Code
- **Frontend (admin.html):**
  - Form label: "Cohort/Batch ID" → "Training Track"
  - Input ID: `cohortId` → `trainingTrack`
  - Placeholder: "e.g., Q1-2026" → "e.g., Azure Developer"

- **Frontend (admin.js):**
  - All JavaScript references updated from `cohortId` to `trainingTrack`
  - Display label: "Cohort:" → "Training Track:"
  - Search functionality updated

- **API Functions:**
  - `api/src/functions/events.js` - Updated request/response fields
  - `api/src/functions/update-event.js` - Updated request fields
  - All SQL queries updated to use `TrainingTrack`

- **Database Init Script:**
  - `database-init-v2.sql` - Updated for future deployments

## Migration Details

### Development Environment
- **Executed:** February 9, 2026
- **Database:** cat-bootcamp-sql-89082.database.windows.net / CATBootcampFeedback
- **Method:** PowerShell with Invoke-Sqlcmd
- **Result:** ✅ Successfully completed
- **Verification:** Column `TrainingTrack` exists with correct data type

### Production Environment
- **Status:** ⏳ Pending
- **Database:** cat-bootcamp-sql-prod.database.windows.net / CATBootcampFeedback-Prod
- **Migration Script:** `migrations/rename-cohort-to-training-track.sql`
- **Action Required:** Run migration script before deploying application changes

## Deployment Checklist

### For Production Deployment:

- [ ] **Step 1:** Run migration script on production database
  ```powershell
  # Use migrations/rename-cohort-to-training-track.sql
  # Via Azure Portal Query Editor or PowerShell Invoke-Sqlcmd
  ```

- [ ] **Step 2:** Verify migration completed
  ```sql
  SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Events' AND COLUMN_NAME = 'TrainingTrack';
  ```

- [ ] **Step 3:** Deploy application code (already in main branch)
  - Frontend changes will auto-deploy
  - Backend changes will auto-deploy

- [ ] **Step 4:** Verify application functionality
  - Create new event with Training Track field
  - Verify existing events display Training Track correctly
  - Check analytics views include Training Track

## Backward Compatibility

⚠️ **Breaking Change:** This migration renames a database column, which means:
- Old application code expecting `CohortId` will fail after migration
- Database migration MUST be run before deploying new application code
- No rollback path without data loss (column renamed, not added)

## Testing

### Tested Scenarios
- ✅ Event creation with Training Track
- ✅ Event editing with Training Track
- ✅ Event search by Training Track
- ✅ Analytics views showing Training Track
- ✅ API responses include `trainingTrack` field
- ✅ Existing data preserved during migration

### Known Issues
None

## Rollback Plan

If rollback is needed (NOT RECOMMENDED):
1. Run reverse migration to rename `TrainingTrack` back to `CohortId`
2. Revert application code to previous version
3. Redeploy previous version

**Note:** This should only be done if critical issues are discovered immediately after deployment.

## Related Pull Requests

- PR #22: "Rename Cohort to Training Track throughout application"
- Commit: b161575

## Contact

For questions or issues related to this migration:
- Database Team: [Contact Info]
- Development Team: [Contact Info]

---

**Migration Verified By:** Claude (Automated)
**Documentation Updated:** February 9, 2026
