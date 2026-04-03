# CAT Bootcamp Feedback - Deployment Guide

**Last Updated:** April 2, 2026
**Architecture:** Separate Azure Functions App (v5.0)

## Overview

This application uses a **separate Azure Functions app** architecture to enable full RESTful routing with path parameters. Azure Static Web Apps' managed functions have limited support for custom routes, which prevented endpoints like `/api/events/{code}/modules/{id}` from working.

## Architecture Components

```
┌──────────────────────────────┐
│ Azure Static Web App         │ Frontend hosting
│ ashy-rock-0b254600f          │ HTML/CSS/JS files
└──────────────────────────────┘
           │
           │ HTTPS + CORS
           ↓
┌──────────────────────────────┐
│ Azure Functions App          │ Backend API
│ catbootcamp-api-qa           │ Node.js 20 runtime
│ Consumption Plan (Linux)     │ Full routing support
└──────────────────────────────┘
           │
           ↓
┌──────────────────────────────┐
│ Azure SQL Database           │ Data storage
│ cat-bootcamp-sql-qa2         │ Many-to-many schema
└──────────────────────────────┘
```

## Current Deployment Status

### Frontend (Azure Static Web App)
- **Name:** cat-bootcamp-feedback
- **URL:** https://ashy-rock-0b254600f.4.azurestaticapps.net
- **Resource Group:** cat-bootcamp-qa-rg
- **Region:** East US 2
- **GitHub Integration:** Auto-deploy from `main` branch
- **Workflow:** `.github/workflows/deploy-qa.yml`

### Backend (Azure Functions App)
- **Name:** catbootcamp-api-qa
- **URL:** https://catbootcamp-api-qa.azurewebsites.net
- **Resource Group:** cat-bootcamp-qa-rg
- **Region:** East US 2
- **Runtime:** Node.js 20 (Linux)
- **Plan:** Consumption (serverless, pay-per-execution)
- **Application Insights:** Enabled

### Database (Azure SQL)
- **Server:** cat-bootcamp-sql-qa2.database.windows.net
- **Database:** CATBootcampFeedback-QA
- **Schema Version:** V2 (many-to-many Events ↔ Modules)
- **Collation:** SQL_Latin1_General_CP1_CI_AS

### Database Migrations for User Management

After deploying the schema, run these migrations in order:
1. `migrations/002-add-user-management.sql` — Creates Users, Roles, UserRoles, UserEventAccess tables
2. `migrations/003-add-profile-image.sql` — Adds ProfileImage column to Users
3. `migrations/004-add-audit-log.sql` — Creates AuditLog table
4. `migrations/005-widen-event-code.sql` — Widens EventCode to NVARCHAR(50)

Then run the user migration script to move existing users from ADMIN_USERS_JSON to the database:
```bash
cd scripts
node migrate-users-from-env.js --global-admin=admin
```

## Deployment Workflows

### Frontend Deployment (Automatic)

**Trigger:** Push to `main` branch
**Workflow:** `.github/workflows/deploy-qa.yml`

```yaml
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]
```

**Process:**
1. GitHub Actions detects push to `main`
2. Checks out code
3. Builds static assets (none required - vanilla HTML/CSS/JS)
4. Deploys to Azure Static Web Apps
5. Updates live site (~90 seconds total)

**Manual Trigger:**
Not usually needed - pushes auto-deploy. To manually redeploy:
```bash
gh workflow run deploy-qa.yml
```

### Backend Deployment

**Workflow:** `.github/workflows/deploy-functions-app-qa.yml`

```bash
# Navigate to API directory
cd feedbackapp/api

# Install dependencies (if not already done)
npm install

# Deploy to Azure
func azure functionapp publish catbootcamp-api-qa --javascript
```

**Expected Output:**
```
Getting site publishing info...
[timestamp] Starting the function app deployment...
Uploading package...
Upload completed successfully.
Deployment completed successfully.
[timestamp] Syncing triggers...
Functions in catbootcamp-api-qa:
    events - [httpTrigger]
        Invoke url: https://catbootcamp-api-qa.azurewebsites.net/api/events
    feedback - [httpTrigger]
        Invoke url: https://catbootcamp-api-qa.azurewebsites.net/api/feedback
    [... other functions ...]
```

**Deployment Time:** ~90-120 seconds

## Configuration

### Frontend Configuration

**File:** `config.js`

```javascript
export const CONFIG = {
    API_BASE_URL: 'https://catbootcamp-api-qa.azurewebsites.net/api',
    USE_MOCK_DATA: false, // Set to true for localhost development
    API_TIMEOUT: 30000,
    // ... other settings
};
```

### Backend Configuration

**Application Settings** (Azure Portal or CLI):

Secrets are managed via Azure Key Vault references. The QA Function App (`catbootcamp-api-qa`) uses Key Vault `cat-bootcamp-kv-qa`:

```bash
# QA environment settings use Key Vault references:
SQL_SERVER=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-SERVER)
SQL_DATABASE=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-DATABASE)
SQL_USER=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-USER)
SQL_PASSWORD=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-PASSWORD)
JWT_SECRET=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=JWT-SECRET)
ADMIN_USERS_JSON=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=ADMIN-USERS-JSON)
# Note: ADMIN_USERS_JSON is now a fallback only. Users are managed in the database
# via the Users, Roles, UserRoles, and UserEventAccess tables.
# The env var is used for initial bootstrap and as a fallback if no DB users exist.

# Email Notifications (Azure Communication Services)
# Connection string stored in Key Vault as ACS-CONNECTION-STRING
AZURE_COMM_CONNECTION_STRING=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=ACS-CONNECTION-STRING)
EMAIL_SENDER_ADDRESS=DoNotReply@{your-domain}.azurecomm.net

# Note: The ACS resource, Email Communication Service, and Azure-managed
# domain must be created first. See docs/infrastructure/ for setup details.

NODE_ENV=production
FUNCTIONS_WORKER_RUNTIME=node
```

To update a secret value, update it in Key Vault and restart the Function App:
```bash
az keyvault secret set --vault-name cat-bootcamp-kv-qa --name SECRET-NAME --value "new-value"
az functionapp restart --name catbootcamp-api-qa --resource-group cat-bootcamp-qa-rg
```

### CORS Configuration

The Functions app must allow requests from the Static Web App:

```bash
az functionapp cors add \
  --name catbootcamp-api-qa \
  --resource-group cat-bootcamp-qa-rg \
  --allowed-origins "https://ashy-rock-0b254600f.4.azurestaticapps.net"
```

## Local Development

### Frontend

```bash
# Serve files locally
npx http-server

# Or with Python
python -m http.server 8000

# Access at http://localhost:8000
```

Config automatically switches to mock data on localhost.

### Backend

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Navigate to API folder
cd api

# Install dependencies
npm install

# Create local.settings.json
cat > local.settings.json << EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SQL_SERVER": "cat-bootcamp-sql-qa2.database.windows.net",
    "SQL_DATABASE": "CATBootcampFeedback-QA",
    "SQL_USER": "sqladmin",
    "SQL_PASSWORD": "***",
    "JWT_SECRET": "***",
    "ADMIN_USERS_JSON": "[{\"username\":\"admin\",\"passwordHash\":\"...\",\"fullName\":\"CAT Admin\",\"email\":\"admin@microsoft.com\"}]"
  }
}
EOF

# Start Functions locally
func start

# Functions available at http://localhost:7071/api
```

Update `config.js` to point to local backend:
```javascript
API_BASE_URL: 'http://localhost:7071/api'
```

## Troubleshooting

### Functions Not Deploying

**Symptom:** `func azure functionapp publish` fails or times out

**Solutions:**
1. Check network connectivity
2. Verify Azure CLI is authenticated: `az login`
3. Ensure Functions app exists: `az functionapp list -o table`
4. Check for syntax errors in function code
5. Verify `package.json` dependencies are correct

### CORS Errors

**Symptom:** Frontend gets CORS errors when calling API

**Solution:**
```bash
# Add Static Web App to allowed origins
az functionapp cors add --name catbootcamp-api-qa \
  --resource-group cat-bootcamp-qa-rg \
  --allowed-origins "https://ashy-rock-0b254600f.4.azurestaticapps.net"

# Verify CORS settings
az functionapp cors show --name catbootcamp-api-qa \
  --resource-group cat-bootcamp-qa-rg
```

### API Returning 404

**Symptom:** All API calls return 404

**Causes & Solutions:**
1. **Functions not deployed:** Run `func azure functionapp publish catbootcamp-api-qa --javascript`
2. **Wrong API URL in config:** Check `config.js` points to correct URL
3. **Functions app not running:** Check Azure Portal → Functions App → Overview

### Feedback Form Shows Error

**Symptom:** "allEvents.find is not a function"

**Cause:** API response structure mismatch

**Solution:** Ensure `feedback.js` accesses `response.data`:
```javascript
const response = await apiGet(`/events`);
const allEvents = response.data || response;
```

### Static Web App Deployment Fails

**Symptom:** GitHub Actions workflow fails with validation error

**Common Issues:**
1. **Duplicate routes in staticwebapp.config.json:** Remove redundant `/api/events/*` if `/api/*` exists
2. **Invalid API token:** Regenerate deployment token:
   ```bash
   az staticwebapp secrets list --name cat-bootcamp-feedback \
     --resource-group cat-bootcamp-qa-rg --query "properties.apiKey"
   ```

## Monitoring

### Application Insights

View logs and performance:
```bash
# View live logs
az functionapp log tail --name catbootcamp-api-qa \
  --resource-group cat-bootcamp-qa-rg
```

Or in Azure Portal:
- Functions App → Application Insights → Logs
- Query example:
  ```kusto
  traces
  | where timestamp > ago(1h)
  | order by timestamp desc
  ```

### Health Checks

```bash
# Test frontend
curl https://ashy-rock-0b254600f.4.azurestaticapps.net/

# Test backend
curl https://catbootcamp-api-qa.azurewebsites.net/api/events

# Test specific endpoint
curl https://catbootcamp-api-qa.azurewebsites.net/api/health
```

## Security Checklist

- [x] SQL credentials stored in Azure Key Vault (`cat-bootcamp-kv-qa`)
- [ ] CORS configured to allow only Static Web App URL
- [ ] HTTPS enforced (automatic in Azure)
- [ ] SQL firewall rules configured
- [ ] Application Insights enabled for monitoring
- [ ] Database backups configured

## Cost Optimization

### Current Configuration Costs (Approximate)

- **Azure Static Web Apps:** Free tier (first 100GB bandwidth/month)
- **Azure Functions:** Consumption plan
  - First 1M executions free
  - After: $0.20 per million executions
  - Expected: ~$0-5/month for typical usage
- **Azure SQL Database:** ~$5-15/month (depends on tier)
- **Storage Account:** ~$0.50/month
- **Application Insights:** First 5GB free/month

**Total Estimated Cost:** $5-20/month

### Optimization Tips

1. Use Azure SQL Basic tier for QA
2. Enable Application Insights sampling
3. Implement caching in frontend to reduce API calls
4. Consider Azure Functions Premium plan only if needed for always-on

## Backup & Recovery

### Database Backups

Automatic backups are enabled in Azure SQL:
- Point-in-time restore up to 7 days
- Long-term retention can be configured

**Manual Backup:**
```bash
# Export database
az sql db export \
  --resource-group cat-bootcamp-qa-rg \
  --server cat-bootcamp-sql-qa2 \
  --name CATBootcampFeedback-QA \
  --admin-user sqladmin \
  --admin-password "***" \
  --storage-key-type StorageAccessKey \
  --storage-key "***" \
  --storage-uri "https://yourstorage.blob.core.windows.net/backups/backup.bacpac"
```

### Code Backups

- **Source Code:** GitHub repository (main backup)
- **Functions App Code:** Can be retrieved from Azure
- **Configuration:** Document all settings in this guide

## Scaling Considerations

### Current Limits

- **Static Web App:** Unlimited page views (Free tier)
- **Functions App:**
  - Consumption plan: Auto-scales to demand
  - Max concurrent instances: 200 (default)
  - Timeout: 5 minutes per execution
- **Database:**
  - Max connections based on tier
  - Consider connection pooling for high load

### When to Scale Up

- Functions taking >30 seconds: Consider Premium plan
- Database DTU >80%: Upgrade to higher tier
- API calls >10,000/hour: Monitor Application Insights
- Storage >5GB: Review blob storage options

## Disaster Recovery

### Recovery Time Objective (RTO): 1 hour
### Recovery Point Objective (RPO): 1 hour

**Recovery Steps:**
1. Restore database from point-in-time backup
2. Redeploy Functions app: `func azure functionapp publish catbootcamp-api-qa --javascript`
3. Redeploy Static Web App: Push to GitHub `main` branch
4. Verify all endpoints
5. Test feedback submission

## References

- **Azure Static Web Apps Docs:** https://docs.microsoft.com/azure/static-web-apps/
- **Azure Functions Docs:** https://docs.microsoft.com/azure/azure-functions/
- **Azure SQL Docs:** https://docs.microsoft.com/azure/azure-sql/
- **GitHub Actions:** https://docs.github.com/actions

## Support Contacts

- **Azure Support:** Submit ticket through Azure Portal
- **GitHub Issues:** Use repository Issues tab
- **Database Issues:** Check Azure SQL Database blade in Portal

---

**Document Version:** 2.0
**Last Reviewed:** April 2, 2026
**Next Review:** May 2026 (or when making architectural changes)
