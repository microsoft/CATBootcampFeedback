# Azure Deployment Configuration

## 🎉 Deployment Status

Your CAT Bootcamp Feedback Application has been deployed to Azure!

---

## 📋 Resource Summary

All resources have been created in the resource group: **cat-bootcamp-rg**

### Azure Static Web App
- **Name**: cat-bootcamp-feedback
- **URL**: https://blue-sea-0b9be530f.1.azurestaticapps.net
- **Resource Group**: cat-bootcamp-rg
- **Location**: East US 2
- **SKU**: Free Tier

### Azure SQL Server
- **Server Name**: cat-bootcamp-sql-89082
- **Fully Qualified Domain Name**: cat-bootcamp-sql-89082.database.windows.net
- **Admin Username**: sqladmin
- **Admin Password**: CATBootcamp2026!SecurePass (⚠️ Store securely!)
- **Resource Group**: cat-bootcamp-rg
- **Location**: East US 2

### Azure SQL Database
- **Database Name**: CATBootcampFeedback
- **Service Tier**: S0 (Standard - 10 DTU)
- **Backup Redundancy**: Local
- **Status**: Online

---

## 🔐 GitHub Configuration Required

### Step 1: Complete GitHub Authentication

The Static Web App deployment is waiting for GitHub authentication:

1. Navigate to: **https://github.com/login/device**
2. Enter the code: **2BE2-424B**
3. Click "Authorize" to allow Azure to access your repository

### Step 2: Add GitHub Secret

Once GitHub is authorized, add the deployment token to your repository secrets:

1. Go to: https://github.com/microsoft/CATBootcampFeedback/settings/secrets/actions
2. Click "New repository secret"
3. Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. Value:
   ```
   f44abd56dc214ccb0a6e2ab1508719cccd252122c698a711d47bdd714e027a3401-aa0139ad-4370-484b-855b-805f50844f4c00f02030b9be530f
   ```
5. Click "Add secret"

---

## 🗄️ Database Initialization Required

The database schema has NOT been initialized yet. You have two options:

### Option 1: Using Azure Portal (Recommended)

1. Go to: https://portal.azure.com
2. Navigate to: SQL databases → CATBootcampFeedback → Query editor
3. Login with:
   - Username: `sqladmin`
   - Password: `CATBootcamp2026!SecurePass`
4. Copy and paste the SQL script from `C:\Users\dewainr\AppData\Local\Temp\claude\C--Users-dewainr\5f379f37-53bd-4f68-8872-f1441347fa15\scratchpad\init-database.sql`
5. Click "Run"

### Option 2: Using Node.js Script (Local)

1. Open a terminal
2. Run:
   ```bash
   cd "C:\Users\dewainr\AppData\Local\Temp\claude\C--Users-dewainr\5f379f37-53bd-4f68-8872-f1441347fa15\scratchpad"
   node init-db.js
   ```

**Note**: The password in the script is already set to `CATBootcamp2026!SecurePass`

---

## ⚙️ Application Settings Configured

The following environment variables have been configured for your Static Web App:

| Setting | Value |
|---------|-------|
| SQL_SERVER | cat-bootcamp-sql-89082.database.windows.net |
| SQL_DATABASE | CATBootcampFeedback |
| SQL_USER | sqladmin |
| SQL_PASSWORD | CATBootcamp2026!SecurePass |
| NODE_ENV | production |

---

## 🚀 Deployment Pipeline

Your GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) will automatically:

1. ✅ Trigger on every push to `main` branch
2. ✅ Build the frontend application
3. ✅ Deploy Azure Functions (API endpoints)
4. ✅ Deploy to Azure Static Web Apps
5. ✅ Create preview environments for Pull Requests

---

## 📊 Testing Your Deployment

### Step 1: Initialize Database

Complete database initialization using one of the methods above.

### Step 2: Verify Event Data

Check that sample events are created:
- CSA1B2C3 - Introduction to CAT Bootcamp
- CSXYZ789 - Advanced Topics in CAT
- CSABC456 - CAT Best Practices

### Step 3: Test Feedback Form

Visit: https://blue-sea-0b9be530f.1.azurestaticapps.net/feedback.html?code=CSA1B2C3

Expected behavior:
- Event details should load automatically
- Form should allow feedback submission
- Submission should save to Azure SQL Database

### Step 4: Test Live Count

Visit: https://blue-sea-0b9be530f.1.azurestaticapps.net/count.html?code=CSA1B2C3

Expected behavior:
- Shows current feedback count
- Auto-refreshes every 5 seconds
- Displays QR code for easy mobile access

### Step 5: Test Admin Panel

Visit: https://blue-sea-0b9be530f.1.azurestaticapps.net/admin.html

Expected behavior:
- Shows login page
- Demo credentials work (admin/CATBootcamp2026!) ⚠️ Change in production!
- Can view/create/manage events
- Can generate QR codes
- Can view feedback submissions

---

## 🔥 Next Steps

1. **Complete GitHub authentication** (if not done already)
2. **Initialize database schema** using Option 1 or 2 above
3. **Trigger deployment**: Push any change to main branch or wait for GitHub Actions
4. **Test all endpoints**: Feedback form, live count, admin panel
5. **Generate QR codes** for your events in the admin panel
6. **Share URLs** with bootcamp participants

---

## 📈 Monitoring

### View Application Insights (Optional - Not Yet Configured)

To add monitoring:
1. Create Application Insights resource
2. Add `APPINSIGHTS_INSTRUMENTATIONKEY` to Static Web App settings
3. View telemetry in Azure Portal

### View Logs

Check deployment logs:
```bash
az monitor app-insights query \
  --app cat-bootcamp-feedback \
  --analytics-query "traces | where timestamp > ago(1h) | order by timestamp desc"
```

---

## 💰 Cost Estimate

**Monthly costs (approximate):**

| Resource | Tier | Monthly Cost |
|----------|------|--------------|
| Static Web Apps | Free | $0 |
| Azure SQL Database | S0 (10 DTU) | ~$15 |
| **Total** | | **~$15/month** |

**Note**: Using the Free tier for Static Web Apps saves $9/month. To add Application Insights, expect +$2-5/month.

---

## 🆘 Troubleshooting

### Database Connection Issues

If API endpoints can't connect to database:
1. Verify firewall rules allow Azure services
2. Check application settings are correct
3. Test connection from Azure Cloud Shell

### Deployment Failures

If GitHub Actions fails:
1. Check that `AZURE_STATIC_WEB_APPS_API_TOKEN` secret is set
2. Verify GitHub authentication completed successfully
3. Check build logs in Actions tab

### API Endpoints Not Working

1. Verify environment variables are set in Static Web App settings
2. Check Function logs in Azure Portal
3. Ensure database is initialized with tables

---

## 📚 Additional Resources

- **Application URL**: https://blue-sea-0b9be530f.1.azurestaticapps.net
- **GitHub Repository**: https://github.com/microsoft/CATBootcampFeedback
- **Azure Portal**: https://portal.azure.com
- **Resource Group**: cat-bootcamp-rg

---

**Status**: ⚠️ **Database initialization required before testing**

Once database is initialized, your application will be fully operational!
