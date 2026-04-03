# Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying the CATBootcampFeedback application to the QA environment. Follow these procedures carefully to ensure a safe and successful deployment.

## Pre-Deployment Checklist

Before initiating any deployment:

- [ ] All changes tested locally
- [ ] Code reviewed and approved
- [ ] Database changes (if any) documented and tested
- [ ] Backup procedures confirmed
- [ ] Rollback plan prepared

## Deployment Methods

### Method 1: Automated GitHub Actions Deployment (Recommended)

**Use when:** Deploying code changes (this is the default flow -- pushes to main auto-deploy)

**Time Required:** 5-10 minutes

**Prerequisites:**
- Changes merged to `main` branch
- All automated tests passing

**Steps:**

1. **Push to main branch**
   - Merge your PR or push directly to main
   - GitHub Actions automatically triggers deployment

2. **Monitor Deployment**
   - Go to https://github.com/[your-username]/CATBootcampFeedback
   - Click "Actions" tab
   - Watch the deployment workflow:
     - **Deploy Frontend:** Azure Static Web App deployment
     - **Deploy API:** Azure Functions App deployment
   - **Time:** ~5-10 minutes

3. **Post-Deployment Validation**
   - Workflow automatically validates:
     - Frontend accessibility
     - API health endpoint
     - Database connectivity
   - Review validation results

4. **Verify QA Environment**
   - Open https://ashy-rock-0b254600f.4.azurestaticapps.net
   - Test key functionality:
     - [ ] Feedback form loads
     - [ ] Admin login works
     - [ ] Events API returns data
     - [ ] QR code generation works
     - [ ] Live counter displays

5. **Document Deployment**
   - Record in deployment log (see template below)

### Method 2: Manual Deployment

**Use when:** Emergency fixes or workflow issues

**Time Required:** 20-30 minutes

**Prerequisites:**
- Azure CLI installed and authenticated
- Node.js 20+ installed
- Azure Functions Core Tools installed
- Correct Azure permissions

#### Step 2A: Manual Frontend Deployment

```bash
# 1. Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# 2. Deploy to QA Static Web App
swa deploy \
  --app-location . \
  --deployment-token <DEPLOYMENT_TOKEN>
```

#### Step 2B: Manual API Deployment

```bash
# 1. Navigate to API directory
cd api

# 2. Install dependencies
npm install

# 3. Run tests (optional but recommended)
npm test

# 4. Deploy to QA Functions App
func azure functionapp publish catbootcamp-api-qa --javascript

# 5. Verify deployment
curl https://catbootcamp-api-qa.azurewebsites.net/api/health
```

#### Step 2C: Manual Configuration Update

```bash
# Update a secret in Key Vault
az keyvault secret set --vault-name cat-bootcamp-kv-qa --name SECRET-NAME --value "new-value"

# Restart to pick up new secret values
az functionapp restart --name catbootcamp-api-qa --resource-group cat-bootcamp-qa-rg
```

## Database Deployment

**Use when:** Schema changes or new database setup

See [`database-migration-strategy.md`](database-migration-strategy.md) for detailed procedures.

### Quick Reference: Schema Update

```bash
# 1. Backup database
az sql db export \
  --resource-group cat-bootcamp-qa-rg \
  --server cat-bootcamp-sql-qa2 \
  --name CATBootcampFeedback-QA \
  --admin-user sqladmin \
  --admin-password <password> \
  --storage-key-type SharedAccessKey \
  --storage-key <storage-key> \
  --storage-uri https://<storage-account>.blob.core.windows.net/<container>/backup-$(date +%Y%m%d).bacpac

# 2. Apply migration script
# Run in Azure Portal Query Editor on CATBootcampFeedback-QA

# 3. Verify schema
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
   ```

2. **Or revert via Azure Portal**
   - Navigate to Azure Portal -> Static Web App
   - Go to "Deployment History"
   - Select previous working deployment
   - Click "Revert"

3. **Verify rollback**
   - Test QA URL
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
   func azure functionapp publish catbootcamp-api-qa --javascript
   ```

2. **Or restore from Azure Portal**
   - Navigate to Azure Portal -> catbootcamp-api-qa Functions App
   - Go to "Deployment Center"
   - Select "Deployments" tab
   - Choose previous deployment
   - Click "Redeploy"

3. **Verify API health**
   ```bash
   curl https://catbootcamp-api-qa.azurewebsites.net/api/health
   ```

### Scenario 3: Database Schema Issue

**Symptoms:** SQL errors, missing tables/columns, data integrity issues

**Rollback Steps:**

1. **Point-in-time restore**
   - Navigate to Azure Portal -> CATBootcampFeedback-QA
   - Click "Restore" from top menu
   - Select restore point (before schema change)
   - Restore to new database name: `CATBootcampFeedback-QA-Restored`
   - Verify restored database

2. **Swap database connection**
   ```bash
   # Update Key Vault secret to point to restored database
   az keyvault secret set --vault-name cat-bootcamp-kv-qa \
     --name SQL-DATABASE --value "CATBootcampFeedback-QA-Restored"

   # Restart to pick up new value
   az functionapp restart --name catbootcamp-api-qa --resource-group cat-bootcamp-qa-rg
   ```

3. **Or rerun previous schema script**
   - Run `database-cleanup.sql` in Query Editor
   - Run previous working `database-init-PORTAL-ALL-IN-ONE.sql`
   - Restore data from backup

## Monitoring and Validation

### Post-Deployment Health Checks

**Manual Verification:**

1. **Frontend Smoke Test**
   ```bash
   # Homepage loads
   curl -I https://ashy-rock-0b254600f.4.azurestaticapps.net/feedback.html
   # Expected: HTTP 200

   # Admin panel loads
   curl -I https://ashy-rock-0b254600f.4.azurestaticapps.net/admin.html
   # Expected: HTTP 200
   ```

2. **API Smoke Test**
   ```bash
   # Health check
   curl https://catbootcamp-api-qa.azurewebsites.net/api/health
   # Expected: {"status":"OK","timestamp":"...","message":"Azure Functions V4 are working!"}

   # Events endpoint
   curl https://catbootcamp-api-qa.azurewebsites.net/api/events
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
  --name catbootcamp-api-qa \
  --resource-group cat-bootcamp-qa-rg

# Or via Azure Portal:
# Functions App -> Monitoring -> Log stream
```

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
Subject: Scheduled Deployment - [Date] at [Time]

The CATBootcampFeedback application will be deployed:

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
Subject: Deployment Complete - [Date]

The CATBootcampFeedback deployment has completed successfully.

Deployment Summary:
- Start Time: [Time]
- End Time: [Time]
- Duration: [X minutes]
- Status: Success

Changes Deployed:
- [List changes]

Verification:
- Frontend: Accessible
- API: Healthy
- Database: Connected
- Smoke Tests: Passed

QA URL: https://ashy-rock-0b254600f.4.azurestaticapps.net

Thank you for your patience.
```

## Deployment Log Template

Record all deployments:

| Date | Time | Deployer | Method | Commit SHA | Changes | Status | Issues | Rollback |
|------|------|----------|--------|------------|---------|--------|--------|----------|
| 2026-02-06 | 14:30 | System Admin | GitHub Actions | abc1234 | Initial setup | Success | None | N/A |
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

### Deployment Succeeds But Site Not Working

**Symptoms:** Deployment shows success but site has errors

**Resolution:**
1. Check browser console for errors
2. Verify API URL in config.js
3. Check Azure Functions App logs
4. Verify database connectivity
5. Run manual health checks
6. If unresolved: Initiate rollback

### Database Connection Fails

**Symptoms:** API returns "Database connection failed" errors

**Resolution:**
1. Verify Key Vault secrets (SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD)
2. Check Azure SQL firewall rules
3. Verify database is online (not paused)
4. Test connection from Azure Portal Query Editor
5. Check connection string format

## Security Considerations

- **Never commit secrets** to version control
- **Rotate passwords** quarterly
- **All credentials** stored in Key Vault (`cat-bootcamp-kv-qa`)
- **Enable audit logging** on database
- **Monitor access logs** via Application Insights
- **Review CORS settings** regularly
- **Keep dependencies updated** for security patches

## Quick Reference Commands

```bash
# Check QA API health
curl https://catbootcamp-api-qa.azurewebsites.net/api/health

# View API logs
az functionapp logs tail --name catbootcamp-api-qa --resource-group cat-bootcamp-qa-rg

# Update Key Vault secret
az keyvault secret set --vault-name cat-bootcamp-kv-qa --name SECRET-NAME --value "new-value"

# Restart Functions App
az functionapp restart --name catbootcamp-api-qa --resource-group cat-bootcamp-qa-rg

# Manual API deployment
func azure functionapp publish catbootcamp-api-qa --javascript

# Backup database
az sql db export --resource-group cat-bootcamp-qa-rg --server cat-bootcamp-sql-qa2 --name CATBootcampFeedback-QA --admin-user sqladmin --admin-password <password> --storage-key-type SharedAccessKey --storage-key <key> --storage-uri <uri>

# List recent deployments
az functionapp deployment list --name catbootcamp-api-qa --resource-group cat-bootcamp-qa-rg
```

---

**Last Updated:** April 2, 2026
**Version:** 2.0
**Owner:** System Administrator
