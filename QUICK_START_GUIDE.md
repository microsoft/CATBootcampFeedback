# Quick Start Guide - Database Initialization

## Issue
The SQL Server password needs to be reset before we can initialize the database.

## Solution (Choose One)

### Option A: Reset Password via Azure Portal (Easiest)

1. **Open Azure Portal**
   - Navigate to: https://portal.azure.com
   - Search for "SQL servers"
   - Click on: `cat-bootcamp-sql-89082`

2. **Reset Password**
   - In the left menu, click "Reset password"
   - Enter new password: `[REDACTED - See Desktop/Secure_CAT_Files/CREDENTIALS_MASTER.md]`
   - Click "Save"

3. **Initialize Database**
   - Navigate to: SQL databases → CATBootcampFeedback
   - Click "Query editor" in the left menu
   - Login with:
     - Login: `sqladmin`
     - Password: `[REDACTED - See secure documentation]`

4. **Run Initialization Script**
   - Copy the entire contents of: `C:\Users\dewainr\AppData\Local\Temp\claude\C--Users-dewainr\5f379f37-53bd-4f68-8872-f1441347fa15\scratchpad\init-database.sql`
   - Paste into the Query editor
   - Click "Run"
   - Verify tables are created:
     ```sql
     SELECT * FROM Events;
     ```

### Option B: Use Azure Cloud Shell

1. **Open Cloud Shell**
   - Go to: https://portal.azure.com
   - Click the Cloud Shell icon (>_) in the top toolbar

2. **Download and Run Init Script**
   ```bash
   # Download sqlcmd if not available
   curl -o init-db.sql https://raw.githubusercontent.com/microsoft/CATBootcampFeedback/main/database/init-schema.sql

   # Run initialization
   sqlcmd -S <your-sql-server>.database.windows.net -d CATBootcampFeedback -U sqladmin -P 'YOUR_PASSWORD_HERE' -i init-db.sql
   ```

### Option C: Reset Password via CLI (Advanced)

```bash
# This requires Azure CLI to be properly configured
az sql server update \
  --resource-group cat-bootcamp-rg \
  --name cat-bootcamp-sql-89082 \
  --admin-password '[YOUR_SECURE_PASSWORD]'

# See Desktop/Secure_CAT_Files/CREDENTIALS_MASTER.md for actual password
```

---

## After Database Initialization

### Verify Setup

Once database is initialized, test the API endpoints:

1. **Test Event Retrieval**
   ```bash
   curl https://blue-sea-0b9be530f.1.azurestaticapps.net/api/events/CSA1B2C3
   ```

2. **Test Feedback Submission**
   ```bash
   curl -X POST https://blue-sea-0b9be530f.1.azurestaticapps.net/api/feedback \
     -H "Content-Type: application/json" \
     -d '{
       "eventCode": "CSA1B2C3",
       "eventId": 1,
       "speakerKnowledge": 5,
       "contentDepth": "Just Right",
       "moduleSatisfaction": 5,
       "additionalComments": "Great session!"
     }'
   ```

3. **Test Feedback Count**
   ```bash
   curl https://blue-sea-0b9be530f.1.azurestaticapps.net/api/events/CSA1B2C3/count
   ```

### Configure GitHub Secret

Don't forget to add the deployment token to GitHub:

1. Go to: https://github.com/microsoft/CATBootcampFeedback/settings/secrets/actions
2. Add new secret:
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: `[REDACTED - Get from Azure Portal]`

### Trigger Deployment

Push any change to trigger GitHub Actions:

```bash
cd C:\Users\dewainr\feedbackapp
git add DEPLOYMENT_CONFIGURATION.md QUICK_START_GUIDE.md
git commit -m "Add deployment configuration documentation"
git push origin main
```

---

## 🎯 Application URLs

After deployment completes:

- **Feedback Form**: https://blue-sea-0b9be530f.1.azurestaticapps.net/feedback.html?code=CSA1B2C3
- **Live Count Display**: https://blue-sea-0b9be530f.1.azurestaticapps.net/count.html?code=CSA1B2C3 (supports Classic and Feed the Cat themes via footer selector)

### Switching modules during a live event

When the live counter is opened in per-module mode (URL contains `?module=<id>`), the header above the counter shows a **dropdown of every module in the current event**. To switch to a different module mid-event:

1. Click the module name in the header — it's a dropdown.
2. Pick the next module from the list (sorted by delivery order).
3. The counter, QR code, and feedback submission URL switch in place — no need to close the browser or open a new URL.
4. Fullscreen, theme, sound, refresh-interval, and celebration settings stay exactly as you set them.
5. The browser URL updates so refresh / share-link / "send to my other monitor" continue to work.

A brief "Loading…" overlay appears during the switch and disappears once the new QR code finishes rendering. If a module fails to load (network blip, etc.), the dropdown reverts to the previous selection and a message appears in the header. Try again once the network recovers. The dropdown is hidden in event-level mode (`?code=...` only).
- **Admin Panel**: https://blue-sea-0b9be530f.1.azurestaticapps.net/admin.html

---

## ✅ Checklist

- [ ] Complete GitHub device authentication (code: 2BE2-424B)
- [ ] Reset SQL Server password via Azure Portal
- [ ] Initialize database schema using Query editor
- [ ] Add GitHub Secret for deployment token
- [ ] Push changes to trigger deployment
- [ ] Test feedback form
- [ ] Test admin panel
- [ ] Generate QR codes for events

---

**Need Help?**
- All configuration details: `DEPLOYMENT_CONFIGURATION.md`
- SQL initialization script: `C:\Users\dewainr\AppData\Local\Temp\claude\C--Users-dewainr\5f379f37-53bd-4f68-8872-f1441347fa15\scratchpad\init-database.sql`
