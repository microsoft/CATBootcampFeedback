# Azure Deployment Guide

Complete guide for deploying the CAT Bootcamp Feedback Application to Azure.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Azure Static Web Apps                 │
│  ┌─────────────┐                ┌──────────────────┐   │
│  │   Frontend  │                │  Azure Functions │   │
│  │   (HTML/    │   Calls API    │    (Node.js)     │   │
│  │    JS/CSS)  │─────────────▶  │                  │   │
│  └─────────────┘                └──────────────────┘   │
└─────────────────────────────────────┬───────────────────┘
                                      │
                                      │ Queries
                                      ▼
                          ┌───────────────────────┐
                          │   Azure SQL Database  │
                          │  (Events & Feedback)  │
                          └───────────────────────┘
                                      │
                                      │ Logs to
                                      ▼
                          ┌───────────────────────┐
                          │ Application Insights  │
                          │   (Monitoring)        │
                          └───────────────────────┘
```

## 📋 Prerequisites

- Azure subscription
- Azure CLI installed
- GitHub account with repository access
- Node.js 18+ installed locally (for testing)

## 🚀 Deployment Options

### Option 1: Azure Static Web Apps (Recommended)

**Benefits:**
- ✅ Integrated hosting for frontend + API
- ✅ Automatic CI/CD from GitHub
- ✅ Free SSL certificates
- ✅ Global CDN distribution
- ✅ Staging environments for PRs
- ✅ Built-in authentication

#### Step 1: Create Azure SQL Database

```bash
# Login to Azure
az login

# Create resource group
az group create \
  --name cat-bootcamp-rg \
  --location eastus2

# Create SQL Server
az sql server create \
  --name cat-bootcamp-sql \
  --resource-group cat-bootcamp-rg \
  --location eastus2 \
  --admin-user sqladmin \
  --admin-password 'YourSecurePassword123!'

# Configure firewall to allow Azure services
az sql server firewall-rule create \
  --resource-group cat-bootcamp-rg \
  --server cat-bootcamp-sql \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az sql db create \
  --resource-group cat-bootcamp-rg \
  --server cat-bootcamp-sql \
  --name CATBootcampFeedback \
  --service-objective S0 \
  --backup-storage-redundancy Local
```

#### Step 2: Initialize Database Schema

Connect to your database using Azure Data Studio or SQL Server Management Studio and run:

```sql
-- Create Events table
CREATE TABLE Events (
    EventId INT IDENTITY(1,1) PRIMARY KEY,
    EventCode NVARCHAR(20) UNIQUE NOT NULL,
    ModuleName NVARCHAR(200) NOT NULL,
    ModuleDate DATE NOT NULL,
    SpeakerName NVARCHAR(100) NOT NULL,
    CohortId NVARCHAR(50) NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL
);

-- Create indexes
CREATE NONCLUSTERED INDEX IX_Events_EventCode ON Events(EventCode);
CREATE NONCLUSTERED INDEX IX_Events_IsActive_ModuleDate ON Events(IsActive, ModuleDate DESC);

-- Create Feedback table
CREATE TABLE Feedback (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    EventId INT NOT NULL,
    EventCode NVARCHAR(20) NOT NULL,
    SpeakerKnowledge INT NOT NULL CHECK (SpeakerKnowledge BETWEEN 1 AND 5),
    ContentDepth NVARCHAR(20) NOT NULL CHECK (ContentDepth IN ('Too Technical', 'Just Right', 'Too Low Level')),
    ModuleSatisfaction INT NOT NULL CHECK (ModuleSatisfaction BETWEEN 1 AND 5),
    AdditionalComments NVARCHAR(MAX) NULL,
    SubmittedAt DATETIME2 DEFAULT GETDATE(),
    IpAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    FOREIGN KEY (EventId) REFERENCES Events(EventId)
);

-- Create indexes
CREATE NONCLUSTERED INDEX IX_Feedback_EventId_SubmittedAt ON Feedback(EventId, SubmittedAt DESC);
CREATE NONCLUSTERED INDEX IX_Feedback_SubmittedAt ON Feedback(SubmittedAt DESC);

-- Insert sample event for testing
INSERT INTO Events (EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive)
VALUES ('CSA1B2C3', 'Introduction to CAT Bootcamp', '2026-02-15', 'John Doe', 'Q1-2026', 'Getting started with CAT', 1);
```

#### Step 3: Create Static Web App

```bash
# Install Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Create Static Web App
az staticwebapp create \
  --name cat-bootcamp-feedback \
  --resource-group cat-bootcamp-rg \
  --source https://github.com/microsoft/CATBootcampFeedback \
  --location "East US 2" \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --login-with-github
```

#### Step 4: Configure Application Settings

Get the API token and add environment variables:

```bash
# Get deployment token
az staticwebapp secrets list \
  --name cat-bootcamp-feedback \
  --resource-group cat-bootcamp-rg \
  --query "properties.apiKey" -o tsv

# Add to GitHub Secrets:
# Go to: https://github.com/microsoft/CATBootcampFeedback/settings/secrets/actions
# Add new secret: AZURE_STATIC_WEB_APPS_API_TOKEN
# Value: (paste the token from above)
```

Configure environment variables in Azure Portal:

1. Go to your Static Web App in Azure Portal
2. Navigate to **Configuration** → **Application settings**
3. Add these settings:

```
SQL_SERVER=cat-bootcamp-sql.database.windows.net
SQL_DATABASE=CATBootcampFeedback
SQL_USER=sqladmin
SQL_PASSWORD=YourSecurePassword123!
NODE_ENV=production
```

#### Step 5: Deploy

Push to GitHub to trigger automatic deployment:

```bash
cd C:\Users\dewainr\feedbackapp
git add .
git commit -m "Add Azure deployment configuration"
git push origin main
```

GitHub Actions will automatically:
- ✅ Build the application
- ✅ Deploy frontend files
- ✅ Deploy Azure Functions API
- ✅ Provide a preview URL

#### Step 6: Verify Deployment

1. **Check GitHub Actions**
   - Go to: https://github.com/microsoft/CATBootcampFeedback/actions
   - Verify the workflow completed successfully

2. **Get your app URL**
   ```bash
   az staticwebapp show \
     --name cat-bootcamp-feedback \
     --resource-group cat-bootcamp-rg \
     --query "defaultHostname" -o tsv
   ```

3. **Test the application**
   - Visit: `https://<your-app>.azurestaticapps.net/feedback.html?code=CSA1B2C3`
   - Submit test feedback
   - Check admin panel: `https://<your-app>.azurestaticapps.net/admin.html`

## 🔧 Local Development with Azure Resources

### Setup Local Environment

1. **Install Azure Functions Core Tools**
   ```bash
   npm install -g azure-functions-core-tools@4 --unsafe-perm true
   ```

2. **Install Dependencies**
   ```bash
   cd api
   npm install
   cd ..
   ```

3. **Create local.settings.json**
   ```bash
   cd api
   cat > local.settings.json << 'EOF'
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "SQL_SERVER": "cat-bootcamp-sql.database.windows.net",
       "SQL_DATABASE": "CATBootcampFeedback",
       "SQL_USER": "sqladmin",
       "SQL_PASSWORD": "YourSecurePassword123!"
     }
   }
   EOF
   ```

4. **Run Locally**
   ```bash
   # Start Static Web Apps CLI (includes both frontend and API)
   swa start . --api-location ./api
   ```

   Access at: http://localhost:4280

### Update Frontend Configuration for Production

Update `config.js` to use environment-aware API URL:

```javascript
// Auto-detect environment
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    CONFIG.USE_MOCK_DATA = false;
    CONFIG.API_BASE_URL = '/api'; // Relative path for Static Web Apps
}
```

## 📊 Monitoring & Application Insights

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app cat-bootcamp-insights \
  --location eastus2 \
  --resource-group cat-bootcamp-rg \
  --application-type web

# Get instrumentation key
az monitor app-insights component show \
  --app cat-bootcamp-insights \
  --resource-group cat-bootcamp-rg \
  --query "instrumentationKey" -o tsv
```

Add to Static Web App settings:
```
APPINSIGHTS_INSTRUMENTATIONKEY=<your-key>
```

### View Logs and Metrics

1. **Azure Portal**
   - Navigate to Application Insights
   - View: Live Metrics, Failures, Performance, Users

2. **Query Logs**
   ```kusto
   traces
   | where timestamp > ago(1h)
   | order by timestamp desc
   | take 100
   ```

## 🔒 Security Configuration

### Configure Custom Domain & SSL

```bash
# Add custom domain
az staticwebapp hostname set \
  --name cat-bootcamp-feedback \
  --resource-group cat-bootcamp-rg \
  --hostname feedback.catbootcamp.com
```

### Enable Authentication (Optional)

Static Web Apps supports built-in authentication:

1. Go to: Portal → Static Web App → Configuration → Authentication
2. Add provider (Azure AD, GitHub, etc.)
3. Update `staticwebapp.config.json` routes with authentication requirements

### Configure CORS (if needed)

Update `staticwebapp.config.json`:
```json
{
  "globalHeaders": {
    "Access-Control-Allow-Origin": "https://catbootcamp.com",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE"
  }
}
```

## 💰 Cost Estimation

**Monthly costs (approximate):**

| Service | Tier | Cost |
|---------|------|------|
| Static Web Apps | Standard | $9/month |
| Azure SQL Database | S0 (10 DTU) | $15/month |
| Application Insights | Pay-as-you-go | $2-5/month |
| **Total** | | **~$26-29/month** |

**Free tier option:**
- Static Web Apps Free tier: $0 (100 GB bandwidth/month)
- Azure SQL Database: Serverless tier $5/month
- Total: **~$5/month**

## 🔄 CI/CD Pipeline

The GitHub Actions workflow automatically:

1. ✅ Triggers on push to `main` branch
2. ✅ Builds frontend and API
3. ✅ Runs tests (if configured)
4. ✅ Deploys to Azure Static Web Apps
5. ✅ Creates staging environment for PRs
6. ✅ Provides deployment URL in PR comments

## 📦 Deployment Checklist

Before going to production:

- [ ] Database schema created
- [ ] Sample events added
- [ ] Environment variables configured
- [ ] GitHub Actions secrets added
- [ ] SSL certificate configured
- [ ] Custom domain configured (optional)
- [ ] Application Insights enabled
- [ ] Backup policy configured
- [ ] Rate limiting tested
- [ ] Security headers verified
- [ ] CORS configured correctly
- [ ] Admin access tested
- [ ] QR codes generated and tested
- [ ] Mobile responsiveness verified
- [ ] Load testing performed

## 🆘 Troubleshooting

### API Functions Not Working

1. Check logs:
   ```bash
   az monitor app-insights query \
     --app cat-bootcamp-insights \
     --analytics-query "traces | where timestamp > ago(1h) | order by timestamp desc"
   ```

2. Verify database connection:
   ```bash
   # Test connection from Azure Cloud Shell
   sqlcmd -S cat-bootcamp-sql.database.windows.net -d CATBootcampFeedback -U sqladmin -P 'YourPassword'
   ```

3. Check function logs in Azure Portal:
   - Static Web App → Functions → Specific function → Monitor

### Deployment Failures

1. Check GitHub Actions logs
2. Verify API token is correct
3. Ensure all required secrets are set
4. Check resource group permissions

### Database Connection Issues

1. Verify firewall rules:
   ```bash
   az sql server firewall-rule list \
     --resource-group cat-bootcamp-rg \
     --server cat-bootcamp-sql
   ```

2. Test connectivity from Azure Functions
3. Check connection string format

## 📚 Additional Resources

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Azure SQL Database Documentation](https://docs.microsoft.com/azure/azure-sql/)
- [Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/)

## 🎯 Next Steps

1. **Test thoroughly** - Submit feedback, test admin panel, verify QR codes
2. **Configure monitoring alerts** - Set up alerts for errors and performance
3. **Optimize performance** - Enable caching, optimize queries
4. **Document processes** - Create runbook for common operations
5. **Train users** - Provide documentation for admins

---

**Need Help?**
- Azure Support: https://azure.microsoft.com/support/
- GitHub Issues: https://github.com/microsoft/CATBootcampFeedback/issues
