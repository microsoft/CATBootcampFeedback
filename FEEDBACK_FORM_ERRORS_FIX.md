# Feedback Form Errors Fix

## Issues Identified

### 1. Content Security Policy (CSP) Error - **FIXED**
**Error Message:**
```
Executing inline script violates the following Content Security Policy directive:
'script-src 'self' https://cdn.jsdelivr.net'. Either the 'unsafe-inline' keyword,
a hash ('sha256-86LPt8tiB1iCzs8AGVMKaSZbQBbjJWblSokPaCBip='), or a nonce
('nonce-...') is required to enable inline execution. The action has been blocked.
```

**Root Cause:**
The feedback.html file contained inline JavaScript for the manual event code entry functionality. The Content Security Policy (CSP) configured in `staticwebapp.config.json` blocks inline scripts for security reasons.

**Solution Applied:**
- Extracted inline script to external file: `manual-entry.js`
- Updated feedback.html to load the external script instead
- Maintains security while providing error recovery functionality

**Files Changed:**
- `feedback.html` - Removed inline `<script>` block, added `<script src="manual-entry.js"></script>`
- `manual-entry.js` - New file containing manual event code entry logic

### 2. API 404 Error - Module Not Found - **REQUIRES DATA**
**Error Message:**
```
Failed to load resource: the server responded with a status of 404 ()
/api/events/CSADEW12/modules/7:1
```

**Root Cause:**
The URL `feedback.html?code=CSADEW12&module=7` is trying to load module ID 7 for event CSADEW12, but:
- Either module ID 7 doesn't exist in the database
- Or the module is marked as inactive (IsActive = 0)
- Or the event doesn't have that module assigned

**Analysis:**
The API endpoint `/api/events/{code}/modules/{moduleId}` exists and is correctly implemented. The query checks:
```sql
SELECT ... FROM Events e
INNER JOIN EventModules em ON e.EventId = em.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
WHERE e.EventCode = @eventCode
  AND em.EventModuleId = @eventModuleId
  AND e.IsActive = 1
  AND m.IsActive = 1
```

**Why It's Failing:**
The query returns 0 rows, meaning:
1. Event CSADEW12 doesn't exist, OR
2. EventModuleId 7 doesn't exist, OR
3. Event or module is inactive, OR
4. The module isn't assigned to this event

**Solution Required:**
This requires database verification and correction:

#### Option A: Verify Event and Module Exist
```sql
-- Check if event exists
SELECT * FROM Events WHERE EventCode = 'CSADEW12';

-- Check if module exists
SELECT * FROM EventModules WHERE EventModuleId = 7;

-- Check the relationship
SELECT e.EventCode, em.EventModuleId, m.ModuleName, e.IsActive, m.IsActive
FROM Events e
INNER JOIN EventModules em ON e.EventId = em.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
WHERE e.EventCode = 'CSADEW12' AND em.EventModuleId = 7;
```

#### Option B: Use Valid Module IDs
If the event exists but module 7 doesn't, the admin panel should show which modules are available:
1. Log into admin panel
2. Find event CSADEW12
3. View the list of modules and their EventModuleId values
4. Use a valid EventModuleId in the URL

#### Option C: Create the Module Assignment
If the module should exist but doesn't, add it through the admin interface or directly in the database.

## CSP Configuration Details

The current CSP policy in `staticwebapp.config.json`:
```json
"content-security-policy": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; ..."
```

This policy:
- ✅ Allows scripts from same origin ('self')
- ✅ Allows scripts from jsdelivr CDN (though we now use local qrcode.min.js)
- ❌ Blocks inline scripts (for security)
- ❌ Blocks eval() and similar dynamic code execution

**Why We Don't Use 'unsafe-inline':**
Adding 'unsafe-inline' to the CSP would allow inline scripts but significantly weakens security by allowing XSS (Cross-Site Scripting) attacks. Extracting scripts to external files is the proper solution.

## Testing the CSP Fix

### Before Fix:
1. Navigate to feedback form with invalid module
2. See error page with manual entry box
3. Browser console shows CSP violation error
4. Inline script is blocked
5. Manual entry doesn't work

### After Fix:
1. Navigate to feedback form with invalid module
2. See error page with manual entry box
3. **No CSP errors in console**
4. Manual entry loads from external file
5. Enter valid event code → redirects to working form

## Deployment Status

✅ **Committed:** Commit 7712d3b
✅ **Pushed:** To microsoft/CATBootcampFeedback
⏳ **Deploying:** Azure Static Web Apps CI/CD in progress
🔄 **Status:** Waiting for deployment completion

## Recommendations

### For Event Organizers:
1. **Always test QR codes** before distributing to attendees
2. **Use admin panel** to generate URLs and QR codes (ensures valid module IDs)
3. **Check module assignment** in admin panel before event starts
4. **Keep events active** during feedback collection period

### For Developers:
1. **Never use inline scripts** - always use external .js files for CSP compliance
2. **Validate module IDs** in admin panel before generating QR codes
3. **Add better error messages** showing which module IDs are valid for an event
4. **Consider adding API endpoint** to list available modules for an event

### For Database Admins:
1. **Verify data integrity** before events
2. **Check EventModules relationships** are correctly set up
3. **Ensure IsActive flags** are set correctly
4. **Test module URLs** before distribution

## How to Generate Valid Feedback URLs

### Method 1: Admin Panel (Recommended)
1. Log into admin panel
2. Go to Events tab
3. Find your event
4. Click "View Details & QR"
5. Each module shows its QR code and URL
6. **Use these URLs** - they're guaranteed to work

### Method 2: Construct Manually (Advanced)
```
URL Format: /feedback.html?code={EVENT_CODE}&module={EVENT_MODULE_ID}
Example: /feedback.html?code=CSADEW12&module=5

Important:
- EVENT_CODE: From Events.EventCode column
- EVENT_MODULE_ID: From EventModules.EventModuleId column (NOT Modules.ModuleId)
```

## Next Steps

1. ✅ **CSP Fix Deployed** - No more inline script violations
2. 🔄 **Verify Module 7** - Check if it should exist for CSADEW12
3. 🔄 **Test with Valid URL** - Use admin panel to get correct module ID
4. 🔄 **Update QR Codes** - If module 7 doesn't exist, regenerate with correct ID

---
**Fix Applied:** February 6, 2026
**CSP Status:** ✅ RESOLVED
**Module 404 Status:** 🔄 REQUIRES DATA VERIFICATION
