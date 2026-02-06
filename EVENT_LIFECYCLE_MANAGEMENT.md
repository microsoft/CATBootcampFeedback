# Event Lifecycle Management - Implementation Summary

## Requirements Implemented ✅

### 1. New Modules Default to Active ✅
**Status:** Already working
**Implementation:** Database and API level defaults

```sql
-- Database Schema
CREATE TABLE Modules (
    ...
    IsActive BIT NOT NULL DEFAULT 1,  -- Defaults to active
    ...
);
```

```javascript
// API Default (CreateModule)
const { isActive = true } = req.body;  // Defaults to true
```

### 2. New Events Default to Active ✅
**Status:** Already working
**Implementation:** Database and API level defaults

```sql
-- Database Schema
CREATE TABLE Events (
    ...
    IsActive BIT DEFAULT 1,  -- Defaults to active
    ...
);
```

```javascript
// API Default (CreateEvent)
const { isActive = true } = req.body;  // Defaults to true
```

### 3. Auto-Archive Old Events ✅
**Status:** NEW - Just implemented
**Implementation:** GetEvents API auto-archives on each call

```javascript
// Auto-archives events 14 days after EndDate
await query(`
    UPDATE Events
    SET IsActive = 0,
        UpdatedAt = GETDATE(),
        UpdatedBy = 'system-auto-archive'
    WHERE IsActive = 1
      AND EndDate IS NOT NULL
      AND DATEDIFF(DAY, EndDate, GETDATE()) > 14
`);
```

### 4. Specification Updated ✅
**Status:** Complete
**Location:** SPECIFICATION.md - New section "Event and Module Lifecycle Management"

## How It Works

### Creating Events/Modules
When creating new events or modules:
1. **Default Behavior**: IsActive = 1 (active) automatically
2. **Can Override**: Pass `isActive: false` to create inactive
3. **Database Level**: DEFAULT 1 constraint ensures safety
4. **API Level**: Default parameter `isActive = true`

### Auto-Archival Process
Every time the admin panel loads events:
1. **Check Age**: Find events with EndDate + 14 days < today
2. **Update Status**: Set IsActive = 0 for old events
3. **Audit Trail**: Record UpdatedBy = 'system-auto-archive'
4. **Then Fetch**: Return only active events

### Timeline Example
```
Event Created: Jan 1, 2026
Event Ends: Jan 15, 2026
  ↓
14 Days Pass...
  ↓
Jan 29, 2026: Still active (exactly 14 days)
Jan 30, 2026: Auto-archived (15 days = more than 14)
  ↓
Event becomes inactive, no longer shows in admin
QR codes for this event stop working
```

### Manual Reactivation
Admins can manually reactivate archived events:
1. Update Events table: `SET IsActive = 1`
2. Event becomes active again
3. QR codes work again
4. Appears in admin panel

## Business Rules

### Auto-Archive Rules
- ✅ **Trigger**: 14 days after EndDate
- ✅ **Scope**: Only events with EndDate set
- ✅ **Timing**: When GetEvents API is called
- ✅ **Reversible**: Admins can reactivate manually
- ✅ **Data Safe**: All feedback data is retained

### Status Filter Rules
- ✅ **GetEvents**: Returns only active events
- ✅ **GetEventModule**: Requires both event AND module active
- ✅ **Admin Panel**: Only shows active modules
- ✅ **QR Codes**: Only generated for active modules
- ✅ **Feedback Form**: Only accepts feedback for active events

### Special Cases
1. **No EndDate**: Never auto-archived
2. **Future EndDate**: Not archived until 14 days after
3. **Manual Deactivation**: Can deactivate anytime, regardless of date
4. **Module Deactivation**: Hides module from ALL events
5. **Reactivation**: Can be done manually anytime

## API Behavior Changes

### Before This Update
```javascript
// GetEvents returned ALL events and modules
// No filtering by IsActive
// Old/inactive modules appeared in admin panel
// QR codes generated for inactive modules
```

### After This Update
```javascript
// GetEvents auto-archives old events first
// Then returns only active events
// Only active modules shown in admin panel
// QR codes only for active modules
// No invalid QR codes generated
```

## Testing

### Test Auto-Archival
1. **Create Test Event:**
   ```sql
   INSERT INTO Events (EventCode, ..., EndDate, IsActive)
   VALUES ('TEST001', ..., '2026-01-01', 1);
   ```

2. **Wait or Simulate:**
   ```sql
   -- Simulate old event
   UPDATE Events
   SET EndDate = DATEADD(DAY, -20, GETDATE())
   WHERE EventCode = 'TEST001';
   ```

3. **Load Admin Panel:**
   - Opens admin panel
   - GetEvents API runs
   - Auto-archives TEST001
   - Event disappears from list

4. **Verify:**
   ```sql
   SELECT EventCode, EndDate, IsActive, UpdatedBy
   FROM Events
   WHERE EventCode = 'TEST001';
   -- Should show: IsActive = 0, UpdatedBy = 'system-auto-archive'
   ```

### Test Manual Reactivation
1. **Reactivate Event:**
   ```sql
   UPDATE Events
   SET IsActive = 1
   WHERE EventCode = 'TEST001';
   ```

2. **Refresh Admin Panel:**
   - Event reappears
   - QR codes work again

## Deployment Status

✅ **Committed:** Commit 1ba7636
✅ **Pushed:** To microsoft/CATBootcampFeedback
✅ **Deployed:** Completed in 1m 37s
✅ **Live:** https://blue-sea-0b9be530f.1.azurestaticapps.net/

## Files Changed

1. **api/GetEvents/index.js**
   - Added auto-archive query before fetching events
   - Runs UPDATE to mark old events inactive
   - Sets audit trail (UpdatedBy, UpdatedAt)

2. **SPECIFICATION.md**
   - Added "Event and Module Lifecycle Management" section
   - Documents default active status
   - Documents auto-archive rules
   - Documents manual status management
   - Documents business rules

## Monitoring & Maintenance

### Check Auto-Archive Activity
```sql
-- See recently archived events
SELECT EventCode, EventName, EndDate, UpdatedAt, UpdatedBy
FROM Events
WHERE UpdatedBy = 'system-auto-archive'
ORDER BY UpdatedAt DESC;
```

### Count Active vs Archived
```sql
-- Event status summary
SELECT
    CASE WHEN IsActive = 1 THEN 'Active' ELSE 'Archived' END AS Status,
    COUNT(*) AS Count
FROM Events
GROUP BY IsActive;
```

### Find Events About to Archive
```sql
-- Events that will archive in next 7 days
SELECT EventCode, EventName, EndDate,
       DATEDIFF(DAY, EndDate, GETDATE()) AS DaysSinceEnd
FROM Events
WHERE IsActive = 1
  AND EndDate IS NOT NULL
  AND DATEDIFF(DAY, EndDate, GETDATE()) BETWEEN 8 AND 14
ORDER BY EndDate DESC;
```

## Benefits

1. **No Invalid QR Codes**: Only active modules generate QR codes
2. **Clean Admin Panel**: Old events automatically hidden
3. **Data Retention**: Archived events keep all feedback
4. **Reversible**: Manual reactivation always possible
5. **Audit Trail**: Know when and why events were archived
6. **Default Safety**: New items default to active

## Future Enhancements

Potential improvements (not implemented yet):
1. **Scheduled Job**: Use Azure Function timer trigger instead of on-demand
2. **Notification**: Email admins when events are archived
3. **Batch Archival**: Archive in batches with logging
4. **Configurable Period**: Make 14-day period configurable
5. **Archive UI**: Show archived events in separate tab
6. **Bulk Reactivation**: UI to reactivate multiple events

---
**Implemented:** February 6, 2026
**Status:** ✅ COMPLETE AND DEPLOYED
**All requirements met and live in production**
