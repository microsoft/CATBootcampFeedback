# Admin Setup Guide - CAT Bootcamp Feedback Application

**Date:** 2026-02-04
**Status:** ✅ Admin Login API Deployed

---

## 🎉 Good News!

The admin login functionality has been created and deployed. You can now log into the admin panel!

---

## 🔑 Admin Login Credentials

⚠️ **SECURITY NOTE:** Admin credentials have been moved to a secure location.
See `CATBOOTCAMP_CREDENTIALS_SECURE.md` on your local machine (NOT in repo).

### Default Admin Account
- **Username:** `admin`
- **Password:** `[REDACTED - See secure credentials file]`

### Alternative Account (Dewain)
- **Username:** `dewainr`
- **Password:** `[REDACTED - See secure credentials file]`

### Login URL
https://blue-sea-0b9be530f.1.azurestaticapps.net/admin.html

---

## 📊 Sample Data Setup

Sample data has been prepared but needs to be loaded into your Azure SQL Database.

### Option 1: Azure Portal (Recommended - Easiest)

1. **Open Azure Portal**
   - Go to: https://portal.azure.com
   - Navigate to: SQL databases → CATBootcampFeedback

2. **Open Query Editor**
   - Click "Query editor" in the left menu
   - Authenticate (it should use your Azure AD credentials automatically)

3. **Execute Sample Data Script**
   - Copy the entire contents of `load-sample-data.sql`
   - Paste into the query editor
   - Click "Run"

4. **Verify Data Loaded**
   - You should see messages confirming the data was added
   - Check tables: Events and Feedback should have records

### Option 2: Azure Data Studio

1. **Open Azure Data Studio**
   - Connect to: `cat-bootcamp-sql-89082.database.windows.net`
   - Database: `CATBootcampFeedback`
   - Authentication: Azure Active Directory

2. **Open Script File**
   - File → Open → Select `load-sample-data.sql`

3. **Execute Script**
   - Click "Run" or press F5

### Option 3: Visual Studio Code with SQL Extension

1. **Install Extension**
   - Install "SQL Server (mssql)" extension

2. **Connect to Database**
   - Server: `cat-bootcamp-sql-89082.database.windows.net`
   - Database: `CATBootcampFeedback`
   - Auth: Azure Active Directory

3. **Execute Script**
   - Open `load-sample-data.sql`
   - Right-click → Execute Query

---

## 📝 Sample Event Codes (After Loading Data)

Once you've loaded the sample data, you can test with these event codes:

### Event 1: Introduction to CAT Bootcamp
- **Event Code:** `CSA1B2C3`
- **Module Name:** Introduction to CAT Bootcamp
- **Speaker:** John Doe
- **Date:** 2026-02-15
- **Test URL:** https://blue-sea-0b9be530f.1.azurestaticapps.net/feedback.html?code=CSA1B2C3

### Event 2: Advanced Topics in CAT
- **Event Code:** `CSXYZ789`
- **Module Name:** Advanced Topics in CAT
- **Speaker:** Jane Smith
- **Date:** 2026-02-20
- **Test URL:** https://blue-sea-0b9be530f.1.azurestaticapps.net/feedback.html?code=CSXYZ789

### Event 3: CAT Best Practices
- **Event Code:** `CSABC456`
- **Module Name:** CAT Best Practices
- **Speaker:** Mike Johnson
- **Date:** 2026-02-25
- **Test URL:** https://blue-sea-0b9be530f.1.azurestaticapps.net/feedback.html?code=CSABC456

---

## ✅ Step-by-Step Testing Guide

### Step 1: Load Sample Data
1. Follow one of the options above to load `load-sample-data.sql`
2. Verify events and feedback were created

### Step 2: Test Admin Login
1. Navigate to: https://blue-sea-0b9be530f.1.azurestaticapps.net/admin.html
2. Enter credentials:
   - Username: `admin`
   - Password: `[REDACTED]`
3. Click "Login"
4. You should see the admin dashboard with events and feedback

### Step 3: Test Feedback Submission
1. Navigate to: https://blue-sea-0b9be530f.1.azurestaticapps.net/feedback.html?code=CSA1B2C3
2. Fill out the feedback form:
   - Speaker Knowledge: 5/5
   - Content Depth: Just Right
   - Module Satisfaction: 5/5
   - Comments: "Test feedback submission"
3. Click "Submit Feedback"
4. You should see a success message

### Step 4: Verify Feedback in Admin Panel
1. Go back to admin panel (refresh if needed)
2. You should see the new feedback you just submitted
3. Check the analytics for the event

### Step 5: Test Other Features
- ✅ Create a new event
- ✅ Generate QR code
- ✅ Export feedback to CSV
- ✅ View live count display
- ✅ Search and filter events
- ✅ Test user creation and role assignment (People & Permissions tab)
- ✅ Test RBAC restrictions (login as different roles to verify access limits)
- ✅ View audit log (GlobalAdmin only)

---

## 🔧 Troubleshooting

### Issue: Can't log into admin panel

**Solution 1: Verify deployment**
- The admin login API was just deployed
- Wait 2-3 minutes for deployment to complete
- Try clearing your browser cache (Ctrl+Shift+Delete)
- Try in an incognito/private window

**Solution 2: Check credentials**
- Username: `admin` (lowercase)
- Password: `[REDACTED]` (case-sensitive, with exclamation mark)

**Solution 3: Check browser console**
- Press F12 to open Developer Tools
- Go to Console tab
- Look for any error messages
- If you see "404 Not Found" for `/api/admin/auth/login`, the deployment may still be in progress

### Issue: No sample data showing

**Solution:**
You need to manually load the sample data:
1. Open Azure Portal
2. Navigate to SQL database: CATBootcampFeedback
3. Use Query editor to run `load-sample-data.sql`
4. Refresh admin panel

### Issue: Feedback submission fails

**Possible causes:**
1. Event code doesn't exist in database (load sample data)
2. Database connection issue (check Azure SQL firewall rules)
3. API not deployed properly (check deployment logs)

**Solution:**
- Verify sample data is loaded
- Check browser console for error messages
- Try with event code: `CSA1B2C3`

### Issue: Admin panel shows "No events found"

**Cause:** Database is empty

**Solution:**
1. Load sample data using `load-sample-data.sql`
2. OR create events manually through admin panel:
   - Click "Create New Event"
   - Fill in event details
   - Event code will be auto-generated

---

## 🔒 Security Notes

### Admin Credentials
- Admin credentials are stored in **Azure Key Vault** (`cat-bootcamp-kv-dev`) as the `ADMIN-USERS-JSON` secret
- Passwords are bcrypt-hashed (not stored in plaintext)
- JWT signing secret is also stored in Key Vault (`JWT-SECRET`)
- All SQL connection details are Key Vault references
- No secrets are hardcoded in the application code

### To Update Admin Users
Users are now managed in the database via the **People & Permissions** tab in the admin UI. From there you can create users, assign roles (GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer), and grant event-level access.

> **Legacy fallback:** The `ADMIN-USERS-JSON` secret in Key Vault is still read during the migration period. To update it manually: update the secret in `cat-bootcamp-kv-dev` Key Vault and restart the Function App.

### Production Recommendations
1. ~~**Use Azure Key Vault** for storing credentials~~ ✅ Done (dev environment)
2. ~~**Implement proper password hashing** (bcrypt, scrypt)~~ ✅ Done
3. **Add Azure AD authentication** for enterprise security
4. **Enable MFA** for admin accounts
5. ~~**Use proper JWT tokens** instead of simple base64~~ ✅ Done
6. ~~**Implement session timeout** and token expiration~~ ✅ Done (8h expiry)
7. ~~**Add audit logging** for admin actions~~ ✅ Done (AuditLog table tracks all authenticated actions)

---

## 📊 Database Schema

If you want to verify the database structure:

```sql
-- List all tables
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE';

-- Check Events table structure
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Events'
ORDER BY ORDINAL_POSITION;

-- Check Feedback table structure
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Feedback'
ORDER BY ORDINAL_POSITION;

-- Count records
SELECT 'Events' AS TableName, COUNT(*) AS RecordCount FROM Events
UNION ALL
SELECT 'Feedback', COUNT(*) FROM Feedback;
```

---

## 🎯 Next Steps

1. ✅ **Load Sample Data** (Most Important)
   - Run `load-sample-data.sql` in Azure Portal Query Editor

2. ✅ **Test Admin Login**
   - Use credentials above to log in

3. ✅ **Test Feedback Submission**
   - Submit feedback for event CSA1B2C3

4. ✅ **Run Security Tests**
   - Follow tests from TESTING_REPORT.md

5. ⚠️ **Change Admin Passwords**
   - Update `api/AdminLogin/index.js` with secure passwords
   - Redeploy application

6. 📊 **Apply Database Migrations**
   - Run remaining parts of `database-init.sql`:
     - Performance indexes
     - Stored procedures
     - Views

---

## 📞 Need Help?

If you're still having issues:

1. **Check deployment status:**
   ```bash
   az staticwebapp show --name cat-bootcamp-feedback --resource-group cat-bootcamp-rg
   ```

2. **View deployment logs:**
   - Azure Portal → Static Web Apps → cat-bootcamp-feedback → Deployment History

3. **Check database connectivity:**
   - Azure Portal → SQL databases → CATBootcampFeedback → Query editor

4. **Review documentation:**
   - DEPLOYMENT_SUCCESS_FINAL.md
   - TESTING_REPORT.md
   - FIXES_APPLIED.md

---

## ✅ Quick Start Checklist

- [ ] Load sample data using Azure Portal Query Editor
- [ ] Log into admin panel with credentials above
- [ ] Verify events show in admin dashboard
- [ ] Submit test feedback for event CSA1B2C3
- [ ] Verify feedback appears in admin panel
- [ ] Test QR code generation
- [ ] Test CSV export
- [ ] Change admin passwords for production
- [ ] Create additional users with appropriate roles via People & Permissions tab
- [ ] Verify RBAC by logging in with different role accounts
- [ ] Check audit log captures actions

---

**Created:** 2026-02-04
**Status:** ✅ Admin API Deployed - Ready for Testing

🎉 **You can now log into the admin panel and start using the application!**
