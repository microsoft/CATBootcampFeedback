# Production Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying the CATBootcampFeedback application to production. Follow these procedures carefully to ensure a safe and successful deployment.

## Pre-Deployment Checklist

Before initiating any production deployment:

- [ ] All changes tested and verified in development environment
- [ ] Code reviewed and approved
- [ ] Database changes (if any) documented and tested
- [ ] Backup procedures confirmed
- [ ] Rollback plan prepared
- [ ] Stakeholders notified of deployment window
- [ ] Approvers identified and available

## Deployment Methods

### Method 1: Automated GitHub Actions Deployment (Recommended)

**Use when:** Deploying code changes to production

**Time Required:** 10-15 minutes + approval time

**Prerequisites:**
- Changes merged to `main` branch
- All automated tests passing
- Designated approvers available

**Steps:**

1. **Navigate to GitHub Actions**
   - Go to https://github.com/[your-username]/CATBootcampFeedback
   - Click "Actions" tab
   - Select "Deploy to Production" workflow

2. **Initiate Workflow**
   - Click "Run workflow" button (top right)
   - Ensure `main` branch is selected
   - Click green "Run workflow" button
   - Note the workflow run number for tracking

3. **Monitor Build Phase**
   - Watch "Build and Test" job
   - Verify all steps complete successfully
   - Check for any warnings or errors
   - **Time:** ~3-5 minutes

4. **Approval Gate**
   - Workflow will pause at "Deploy Frontend and API to Production" stage
   - Designated approvers will receive notification
   - Review deployment details:
     - Commit SHA
     - Changed files
     - Build artifacts
   - **Approver Action Required:** Click "Review deployments" → Approve or Reject
   - **Time:** Variable (human approval required)

5. **Monitor Deployment Phase**
   - After approval, deployment proceeds automatically
   - Watch both deployment jobs:
     - **Deploy Frontend:** Azure Static Web App deployment
     - **Deploy API:** Azure Functions App deployment
   - **Time:** ~5-10 minutes

6. **Post-Deployment Validation**
   - Workflow automatically validates:
     - Frontend accessibility
     - API health endpoint
     - Database connectivity
   - Review validation results
   - **Time:** ~1 minute

7. **Verify Production**
   - Open https://cat-bootcamp-feedback.azurestaticapps.net
   - Test key functionality:
     - [ ] Feedback form loads
     - [ ] Admin login works
     - [ ] Events API returns data
     - [ ] QR code generation works
     - [ ] Live counter displays

8. **Document Deployment**
   - Record in deployment log (see template below)
   - Notify stakeholders of completion
   - Update status page (if applicable)

### Method 2: Manual Deployment

**Use when:** Emergency fixes, workflow issues, or initial setup

**Time Required:** 20-30 minutes

**Prerequisites:**
- Azure CLI installed and authenticated
- Node.js 20+ installed
- Azure Functions Core Tools installed
- Correct Azure permissions

#### Step 2A: Manual Frontend Deployment

> **Note (live counter module switcher):** The module switcher feature is delivered entirely via `count.html` and `count.js` — pure client-side. No backend or DB changes accompany it. Cache-busting on those two files is sufficient for the rollout.

```bash
# 1. Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# 2. Build frontend (if needed)
# No build step required for static HTML/JS

# 3. Deploy to production Static Web App
# Note: Deployment token required from Azure Portal
swa deploy \
  --app-location . \
  --deployment-token <DEPLOYMENT_TOKEN>

# Alternative: Use Azure CLI
az staticwebapp create \
  --name cat-bootcamp-feedback \
  --resource-group cat-bootcamp-prod-rg \
  --source https://github.com/[your-username]/CATBootcampFeedback \
  --location eastus \
  --branch main \
  --app-location / \
  --token <GITHUB_TOKEN>
```

#### Step 2B: Manual API Deployment

```bash
# 1. Navigate to API directory
cd api

# 2. Install dependencies
npm install

# 3. Run tests (optional but recommended)
npm test

# 4. Deploy to production Functions App
func azure functionapp publish cat-bootcamp-api-prod --javascript

# 5. Verify deployment
curl https://cat-bootcamp-api-prod.azurewebsites.net/api/health
```

#### Step 2C: Manual Configuration Update

**Development** (uses Key Vault references - update secrets in Key Vault, not app settings):
```bash
# Update a secret in dev Key Vault
az keyvault secret set --vault-name cat-bootcamp-kv-dev --name SECRET-NAME --value "new-value"

# Restart to pick up new secret values
az functionapp restart --name cat-bootcamp-api-win --resource-group cat-bootcamp-rg
```

**Production** (still uses plain-text settings - TODO: migrate to Key Vault):
```bash
# Update production Functions App settings
az functionapp config appsettings set \
  --name cat-bootcamp-api-prod \
  --resource-group cat-bootcamp-prod-rg \
  --settings \
    SQL_SERVER="cat-bootcamp-sql-prod.database.windows.net" \
    SQL_DATABASE="CATBootcampFeedback-Prod" \
    SQL_USER="sqladmin" \
    SQL_PASSWORD="<prod-password>" \
    NODE_ENV="production"
```

## Database Deployment

**Use when:** Schema changes or new database setup

See [`database-migration-strategy.md`](database-migration-strategy.md) for detailed procedures.

### Quick Reference: Schema Update

```bash
# 1. Backup production database
az sql db export \
  --resource-group cat-bootcamp-prod-rg \
  --server cat-bootcamp-sql-prod \
  --name CATBootcampFeedback-Prod \
  --admin-user sqladmin \
  --admin-password <password> \
  --storage-key-type SharedAccessKey \
  --storage-key <storage-key> \
  --storage-uri https://<storage-account>.blob.core.windows.net/<container>/backup-$(date +%Y%m%d).bacpac

# 2. Test migration script in dev first
# Run in Azure Portal Query Editor on CATBootcampFeedback (dev)

# 3. Apply to production
# Run in Azure Portal Query Editor on CATBootcampFeedback-Prod

# 4. Verify schema
# Query: SELECT * FROM INFORMATION_SCHEMA.TABLES
```

## Rollback Procedures

### Scenario 1: Bad Frontend Deployment

**Symptoms:** UI broken, JavaScript errors, features not working

**Rollback Steps:**

1. **Revert via GitHub Actions**
   ```bash
   # Find previous successful deployment commit
   git log --oneline

   # Create rollback branch
   git checkout -b rollback-to-<commit-sha> <commit-sha>
   git push origin rollback-to-<commit-sha>

   # Run deployment workflow from rollback branch
   # (Select rollback branch in workflow dispatch)
   ```

2. **Or revert via Azure Portal**
   - Navigate to Azure Portal → cat-bootcamp-feedback Static Web App
   - Go to "Deployment History"
   - Select previous working deployment
   - Click "Revert"

3. **Verify rollback**
   - Test production URL
   - Confirm previous functionality restored

### Scenario 2: Bad API Deployment

**Symptoms:** API errors, 500 responses, database connection failures

**Rollback Steps:**

1. **Redeploy previous version**
   ```bash
   # Checkout previous working commit
   git checkout <previous-commit-sha>

   # Deploy
   cd api
   func azure functionapp publish cat-bootcamp-api-prod --javascript
   ```

2. **Or restore from Azure Portal**
   - Navigate to Azure Portal → cat-bootcamp-api-prod Functions App
   - Go to "Deployment Center"
   - Select "Deployments" tab
   - Choose previous deployment
   - Click "Redeploy"

3. **Verify API health**
   ```bash
   curl https://cat-bootcamp-api-prod.azurewebsites.net/api/health
   ```

### Scenario 3: Database Schema Issue

**Symptoms:** SQL errors, missing tables/columns, data integrity issues

**Rollback Steps:**

1. **Point-in-time restore**
   - Navigate to Azure Portal → CATBootcampFeedback-Prod
   - Click "Restore" from top menu
   - Select restore point (before schema change)
   - Restore to new database name: `CATBootcampFeedback-Prod-Restored`
   - Verify restored database

2. **Swap database connection**
   ```bash
   # Update API to use restored database
   az functionapp config appsettings set \
     --name cat-bootcamp-api-prod \
     --resource-group cat-bootcamp-prod-rg \
     --settings SQL_DATABASE="CATBootcampFeedback-Prod-Restored"
   ```

3. **Or rerun previous schema script**
   - Run `database-cleanup.sql` in Query Editor
   - Run previous working `database-init-PORTAL-ALL-IN-ONE.sql`
   - Restore data from backup

## Monitoring and Validation

### Post-Deployment Health Checks

**Automated (via GitHub Actions):**
- Frontend accessibility test
- API health endpoint check
- Database connectivity validation

**Manual Verification:**

1. **Frontend Smoke Test**
   ```bash
   # Homepage loads
   curl -I https://cat-bootcamp-feedback.azurestaticapps.net/feedback.html
   # Expected: HTTP 200

   # Admin panel loads
   curl -I https://cat-bootcamp-feedback.azurestaticapps.net/admin.html
   # Expected: HTTP 200
   ```

2. **API Smoke Test**
   ```bash
   # Health check
   curl https://cat-bootcamp-api-prod.azurewebsites.net/api/health
   # Expected: {"status":"OK","timestamp":"...","message":"Azure Functions V4 are working!"}

   # Events endpoint
   curl https://cat-bootcamp-api-prod.azurewebsites.net/api/events
   # Expected: {"success":true,"message":"Success","data":[...]}
   ```

3. **Database Connectivity Test**
   ```bash
   # Via Azure Portal Query Editor
   SELECT COUNT(*) AS EventCount FROM Events;
   SELECT COUNT(*) AS FeedbackCount FROM Feedback;
   # Expected: Valid counts returned
   ```

4. **End-to-End Test**
   - Open feedback form with test event code
   - Submit test feedback
   - Verify in admin panel
   - Delete test feedback

### Monitoring Logs

**View API Logs:**
```bash
# Real-time log streaming
az functionapp logs tail \
  --name cat-bootcamp-api-prod \
  --resource-group cat-bootcamp-prod-rg

# Or via Azure Portal:
# Functions App → Monitoring → Log stream
```

**Check Application Insights:**
- Navigate to Azure Portal → cat-bootcamp-api-prod
- Select "Application Insights" from left menu
- Review:
  - Failed requests
  - Response times
  - Exceptions
  - Dependencies

## Deployment Schedule

**Recommended Windows:**
- **Weekdays:** 9 AM - 11 AM or 2 PM - 4 PM (local time)
- **Avoid:** Fridays after 2 PM, weekends, holidays
- **Exception:** Critical security patches (deploy immediately)

**Maintenance Windows:**
- Standard deployments: 15-minute window
- Database migrations: 30-minute window
- Major upgrades: 1-hour window

## Communication Templates

### Pre-Deployment Notification

```
Subject: Scheduled Production Deployment - [Date] at [Time]

The CATBootcampFeedback application will be deployed to production:

Date: [Date]
Time: [Start Time] - [End Time]
Duration: ~15 minutes
Impact: Brief interruption possible

Changes:
- [List major changes]
- [List bug fixes]
- [List new features]

Rollback Plan: Automated revert available if issues detected

Contact: [Your Name/Team] if issues occur
```

### Post-Deployment Notification

```
Subject: Production Deployment Complete - [Date]

The CATBootcampFeedback production deployment has completed successfully.

Deployment Summary:
- Start Time: [Time]
- End Time: [Time]
- Duration: [X minutes]
- Status: ✅ Success

Changes Deployed:
- [List changes]

Verification:
- ✅ Frontend: Accessible
- ✅ API: Healthy
- ✅ Database: Connected
- ✅ Smoke Tests: Passed

Production URL: https://cat-bootcamp-feedback.azurestaticapps.net

Thank you for your patience.
```

## Deployment Log Template

Record all production deployments:

| Date | Time | Deployer | Method | Commit SHA | Changes | Status | Issues | Rollback |
|------|------|----------|--------|------------|---------|--------|--------|----------|
| 2026-02-06 | 14:30 | System Admin | GitHub Actions | abc1234 | Initial prod setup | ✅ Success | None | N/A |
| | | | | | | | | |

## Troubleshooting

### Deployment Fails at Build Stage

**Symptoms:** GitHub Actions fails during npm install or tests

**Resolution:**
1. Check build logs for specific error
2. Verify package.json dependencies
3. Run `npm install` and `npm test` locally
4. Fix errors and commit
5. Re-run deployment workflow

### Deployment Fails at Approval Stage

**Symptoms:** No approvers available or approval denied

**Resolution:**
1. If denied: Review feedback from approver, fix issues, redeploy
2. If no approvers: Contact alternate approver or use manual deployment
3. For emergencies: Use manual deployment method

### Deployment Succeeds But Site Not Working

**Symptoms:** Deployment shows success but production site has errors

**Resolution:**
1. Check browser console for errors
2. Verify API URL in config.prod.js
3. Check Azure Functions App logs
4. Verify database connectivity
5. Run manual health checks
6. If unresolved: Initiate rollback

### Database Connection Fails

**Symptoms:** API returns "Database connection failed" errors

**Resolution:**
1. Verify SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD settings
2. Check Azure SQL firewall rules
3. Verify database is online (not paused)
4. Test connection from Azure Portal Query Editor
5. Check connection string format

## Security Considerations

- **Never commit secrets** to version control
- **Rotate passwords** quarterly
- **Use different credentials** for dev and prod
- **Enable audit logging** on production database
- **Monitor access logs** via Application Insights
- **Review CORS settings** regularly
- **Keep dependencies updated** for security patches

## Support Contacts

**For deployment issues:**
- Primary: [Your Name/Email]
- Secondary: [Backup Contact]
- After Hours: [On-call Contact]

**For Azure resource issues:**
- Azure Support Portal
- Priority: High for production issues

**For GitHub Actions issues:**
- GitHub Support
- Check GitHub Status: https://www.githubstatus.com

## Quick Reference Commands

```bash
# Check production API health
curl https://cat-bootcamp-api-prod.azurewebsites.net/api/health

# View API logs
az functionapp logs tail --name cat-bootcamp-api-prod --resource-group cat-bootcamp-prod-rg

# Update API setting
az functionapp config appsettings set --name cat-bootcamp-api-prod --resource-group cat-bootcamp-prod-rg --settings KEY=VALUE

# Manual API deployment
func azure functionapp publish cat-bootcamp-api-prod --javascript

# Backup database
az sql db export --resource-group cat-bootcamp-prod-rg --server cat-bootcamp-sql-prod --name CATBootcampFeedback-Prod --admin-user sqladmin --admin-password <password> --storage-key-type SharedAccessKey --storage-key <key> --storage-uri <uri>

# List recent deployments
az functionapp deployment list --name cat-bootcamp-api-prod --resource-group cat-bootcamp-prod-rg
```

---

**Last Updated:** February 6, 2026
**Version:** 1.0
**Owner:** System Administrator
