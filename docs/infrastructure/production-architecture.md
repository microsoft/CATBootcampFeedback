# Production Infrastructure Architecture

## Status

✅ **Operational** - Both development and production environments are fully deployed and functional.

Last Updated: 2026-03-29

## Resource Groups

### Development Environment
- **Resource Group:** `cat-bootcamp-rg`
- **Region:** East US 2
- **Purpose:** Development/testing environment, auto-deploys from main branch
- **Status:** ✅ Operational

**Resources:**
- Static Web App: `cat-bootcamp-feedback` (blue-moss-01913f80f.1.azurestaticapps.net)
- Functions App: `cat-bootcamp-api` (cat-bootcamp-api.azurewebsites.net)
- SQL Server: `cat-bootcamp-sql-89082` (cat-bootcamp-sql-89082.database.windows.net)
- SQL Database: `CATBootcampFeedback` (Initialized with sample data)
- Storage Account: `catbootcampapi890`

### QA Environment
- **Resource Group:** `cat-bootcamp-qa-rg`
- **Region:** East US 2
- **Purpose:** QA/staging environment, auto-deploys on push to main
- **Status:** ✅ Operational

**Resources:**
- Static Web App: `ashy-rock-0b254600f` (ashy-rock-0b254600f.4.azurestaticapps.net)
- Functions App: `catbootcamp-api-qa` (catbootcamp-api-qa.azurewebsites.net)
- SQL Server: `cat-bootcamp-sql-qa2` (cat-bootcamp-sql-qa2.database.windows.net)
- SQL Database: `CATBootcampFeedback-QA`
- Key Vault: `cat-bootcamp-kv-qa`
- Storage Account: associated storage account

### Production Environment
- **Resource Group:** `cat-bootcamp-prod-rg`
- **Region:** East US 2 (same as dev for consistency)
- **Purpose:** Production environment, manual approval required for deployments
- **Status:** ✅ Operational

**Resources:**
- Static Web App: `cat-bootcamp-feedback-prod` (lively-ocean-076d52c0f-2.azurestaticapps.net)
  - Custom domain placeholder: `catbootcamp.yourdomain.com` (not yet configured)
- Functions App: `cat-bootcamp-api-prod` (cat-bootcamp-api-prod.azurewebsites.net)
- SQL Server: `cat-bootcamp-sql-prod` (cat-bootcamp-sql-prod.database.windows.net)
- SQL Database: `CATBootcampFeedback-Prod` (Initialized with sample data)
  - 7 Modules
  - 3 Events
  - 13 Event-Module mappings
  - 19+ Feedback entries
- Storage Account: `catbootcampprodapi`

## Naming Convention

| Resource Type | Dev Name | QA Name | Prod Name |
|---------------|----------|---------|-----------|
| Resource Group | cat-bootcamp-rg | cat-bootcamp-qa-rg | cat-bootcamp-prod-rg |
| Static Web App | cat-bootcamp-feedback | ashy-rock-0b254600f | cat-bootcamp-feedback-prod |
| Functions App | cat-bootcamp-api | catbootcamp-api-qa | cat-bootcamp-api-prod |
| SQL Server | cat-bootcamp-sql-89082 | cat-bootcamp-sql-qa2 | cat-bootcamp-sql-prod |
| SQL Database | CATBootcampFeedback | CATBootcampFeedback-QA | CATBootcampFeedback-Prod |
| Key Vault | — | cat-bootcamp-kv-qa | — |
| Storage Account | catbootcampapi890 | (associated) | catbootcampprodapi |

## Deployment Pipeline

```
Developer Push → main branch
         ↓
   Auto-deploy to DEV
   (GitHub Actions: azure-static-web-apps-blue-moss-01913f80f.yml)
         ↓
   Manual Testing in DEV
   - Test all features
   - Verify no console errors
   - Check API functionality
         ↓
   Trigger Production Workflow
   (Two methods available)
   ├─ Method 1: Manual workflow dispatch
   │  └─ Type "deploy-to-production" to confirm
   └─ Method 2: Create release tag (v*.*.*)
         ↓
   Validation Step
   - Confirm deployment request
   - Run automated tests
   - Verify build succeeds
         ↓
   GitHub Environment Gate
   - Environment: production
   - Optional: Required reviewers
   - Optional: Deployment branch restriction
         ↓
   Deploy to PROD
   ├─ Deploy Frontend (Static Web App)
   └─ Deploy Backend (Functions App)
         ↓
   Deployment Summary
   - Environment URLs
   - Commit SHA
   - Triggered by user
```

### Workflow Files

- **Development:** `.github/workflows/azure-static-web-apps-blue-moss-01913f80f.yml`
  - Trigger: Push to main branch
  - Auto-deploy: Yes
  - Approval: None required

- **Production:** `.github/workflows/deploy-production.yml`
  - Trigger: Manual dispatch or release tag
  - Auto-deploy: No
  - Approval: Optional via GitHub Environments
  - Validation: Confirmation input required

## Environment Configuration

### Development (auto-deploy from main)
- **Frontend URL:** https://blue-moss-01913f80f.1.azurestaticapps.net
- **API Base URL:** https://cat-bootcamp-api.azurewebsites.net/api
- **Database Server:** cat-bootcamp-sql-89082.database.windows.net
- **Database Name:** CATBootcampFeedback
- **Admin User:** sqladmin
- **Environment Detection:** `window.location.hostname.includes('blue-moss')`

### Production (approval-gated)
- **Frontend URL:** https://lively-ocean-076d52c0f-2.azurestaticapps.net
- **Custom Domain:** Not yet configured (placeholder: catbootcamp.yourdomain.com)
- **API Base URL:** https://cat-bootcamp-api-prod.azurewebsites.net/api
- **Database Server:** cat-bootcamp-sql-prod.database.windows.net
- **Database Name:** CATBootcampFeedback-Prod
- **Admin User:** sqladmin
- **Environment Detection:** `window.location.hostname.includes('lively-ocean-076d52c0f')`

### Environment Detection Logic

The application automatically detects the environment based on hostname patterns in `config.js`:

```javascript
// Development
const isDevHostname = window.location.hostname.includes('blue-moss');

// Production (pattern-based to handle URL format variations)
const isProdHostname = window.location.hostname.includes('lively-ocean-076d52c0f') &&
                       !window.location.hostname.includes('blue-moss');
const isCustomDomain = window.location.hostname === 'catbootcamp.yourdomain.com';
```

This pattern-based approach handles Azure Static Web App URL variations (e.g., periods vs. hyphens) automatically.

## Validation & Testing

### Automated Validation

Use the validation script to verify production health:

```powershell
# Basic validation (API endpoints)
pwsh scripts/validate-production.ps1

# Full validation including database
$password = Read-Host -AsSecureString "Enter prod database password"
pwsh scripts/validate-production.ps1 -DatabasePassword $password
```

**Tests performed:**
- ✅ Frontend availability (HTTP 200)
- ✅ Backend API endpoints (Events, Modules, Feedback)
- ✅ Database connectivity (optional with password)
- ✅ Response data validation

### Manual Testing Checklist

After deployment, verify:
- [ ] Frontend loads without errors
- [ ] Browser console shows "Environment: PRODUCTION"
- [ ] No CORS errors in console
- [ ] Admin login works
- [ ] Events tab displays correctly
- [ ] Modules tab displays correctly
- [ ] Feedback tab displays correctly
- [ ] Analytics tab displays correctly
- [ ] Speakers tab displays correctly
- [ ] Templates tab displays correctly
- [ ] Can create speakers with bio and photo
- [ ] Can create templates (blank and from event)
- [ ] Can create events from templates
- [ ] Speaker dropdown works in module assignment
- [ ] Can create new events
- [ ] Can submit feedback

### Monitoring

**Azure Portal Monitoring:**
- Static Web App → Metrics (Requests, Bandwidth)
- Functions App → Monitor → Logs (Function execution logs)
- SQL Database → Query Performance Insight

**Application Insights:** (Optional, not currently configured)
- Performance monitoring
- Error tracking
- User analytics

## Cost Estimates

### Per Environment (Monthly)
- Azure Static Web Apps: Free tier (0-100GB bandwidth, sufficient for feedback app)
- Azure Functions: Consumption Plan (~$0-5 for typical bootcamp usage)
- Azure SQL Database: Basic tier (~$5) - currently in use
- Storage Account: ~$0.50
- Application Insights: First 5GB free (if enabled)

**Total per environment:** $5-10/month
**Both environments:** $10-20/month

### Scaling Considerations

Current tier is suitable for:
- Up to 100 concurrent users
- 10-20 events per month
- 1000+ feedback submissions per month

For higher load:
- Upgrade SQL to Standard S0 (~$15/month)
- Consider Azure Static Web Apps Standard tier for SLA
- Enable Application Insights for detailed monitoring

## GitHub Secrets

Required secrets for CI/CD (already configured):

**Development:**
- `AZURE_STATIC_WEB_APPS_API_TOKEN_BLUE_MOSS_01913F80F` - Dev Static Web App deployment token

**Production:**
- `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` - Prod Static Web App deployment token
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE_PROD` - Prod Functions App publish profile

## Security Configuration

### Database Security
- ✅ SQL Server firewall: Azure Services allowed
- ✅ SQL authentication with strong password
- ✅ TLS/SSL encryption enabled
- ⚠️ Consider: Azure Key Vault for credentials (future enhancement)

### Application Security
- ✅ HTTPS enforced on all endpoints
- ✅ CORS configured for allowed origins
- ✅ Client-side rate limiting enabled
- ✅ SQL injection prevention via parameterized queries
- ✅ XSS protection via proper escaping

### Access Control
- ✅ RBAC with 6 roles: GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer
- ✅ Resource-level security (users only see events they have access to)
- ✅ Comprehensive audit logging of all authenticated actions
- ✅ Key Vault for secrets (QA environment)
- ✅ Admin panel requires authentication
- ✅ Password hashing for admin credentials
- ✅ Session timeout (8 hours)

## Support & Troubleshooting

### Common Issues

**Issue:** API calls return CORS errors
**Solution:** Verify CORS settings in Functions App allow Static Web App URL

**Issue:** Environment shows "DEVELOPMENT" in production
**Solution:** Check hostname detection in `config.js`, clear browser cache

**Issue:** Database connection fails
**Solution:** Verify firewall rules allow Azure Services, check connection string

**Issue:** Deployment workflow fails
**Solution:** Check GitHub secrets are configured, verify Azure resources exist

### Useful Commands

```bash
# Check deployment status
gh run list --workflow="Deploy to Production" --limit 5

# View specific deployment logs
gh run view [run-id] --log

# Trigger production deployment
gh workflow run deploy-production.yml

# Check Azure resources
az group show --name cat-bootcamp-prod-rg
az staticwebapp show --name cat-bootcamp-feedback-prod --resource-group cat-bootcamp-prod-rg
az functionapp show --name cat-bootcamp-api-prod --resource-group cat-bootcamp-prod-rg
```

## Related Documentation

- [Custom Domain Setup](./custom-domain-setup.md) - Configure custom domain for production
- [Database Initialization](./database-initialization.md) - Database schema and sample data
- [Environment Variables](./environment-variables.md) - Environment-specific configurations
- [GitHub Secrets](./github-secrets.md) - CI/CD secret management
- [Domain Registration Steps](./domain-registration-steps.md) - Custom domain registration guide
- [Deployment Runbook](../DEPLOYMENT-RUNBOOK.md) - Operational deployment procedures
- [Database Migration Strategy](../database-migration-strategy.md) - Data migration approach
- [Production Setup Summary](../PRODUCTION-SETUP-SUMMARY.md) - Setup completion checklist
