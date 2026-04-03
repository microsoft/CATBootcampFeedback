# Infrastructure Architecture

## Status

**Operational** - QA environment is fully deployed and functional.

Last Updated: 2026-04-02

## QA Environment

- **Resource Group:** `cat-bootcamp-qa-rg`
- **Region:** East US 2
- **Purpose:** Single application environment, auto-deploys on push to main
- **Status:** Operational

**Resources:**
- Static Web App: `ashy-rock-0b254600f` (ashy-rock-0b254600f.4.azurestaticapps.net)
- Functions App: `catbootcamp-api-qa` (catbootcamp-api-qa.azurewebsites.net)
- SQL Server: `cat-bootcamp-sql-qa2` (cat-bootcamp-sql-qa2.database.windows.net)
- SQL Database: `CATBootcampFeedback-QA`
- Key Vault: `cat-bootcamp-kv-qa`
- Storage Account: associated storage account

## Resource Summary

| Resource Type | Name |
|---------------|------|
| Resource Group | cat-bootcamp-qa-rg |
| Static Web App | ashy-rock-0b254600f |
| Functions App | catbootcamp-api-qa |
| SQL Server | cat-bootcamp-sql-qa2 |
| SQL Database | CATBootcampFeedback-QA |
| Key Vault | cat-bootcamp-kv-qa |

## Deployment Pipeline

```
Developer Push -> main branch
         |
   Auto-deploy to QA
   (GitHub Actions)
         |
   Deploy Frontend (Static Web App)
   Deploy Backend (Functions App)
         |
   Deployment Summary
   - Environment URLs
   - Commit SHA
   - Triggered by user
```

### Workflow Files

- **QA Deployment:** Auto-deploys on push to main branch
  - Trigger: Push to main branch
  - Auto-deploy: Yes
  - Approval: None required

## Environment Configuration

- **Frontend URL:** https://ashy-rock-0b254600f.4.azurestaticapps.net
- **API Base URL:** https://catbootcamp-api-qa.azurewebsites.net/api
- **Database Server:** cat-bootcamp-sql-qa2.database.windows.net
- **Database Name:** CATBootcampFeedback-QA
- **Key Vault:** cat-bootcamp-kv-qa
- **Admin User:** sqladmin (password in Key Vault)

### Environment Detection Logic

The application detects the environment based on hostname in `config.js`:

```javascript
// QA
const isQaHostname = window.location.hostname.includes('ashy-rock');
```

## Validation & Testing

### Manual Testing Checklist

After deployment, verify:
- [ ] Frontend loads without errors
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
- Static Web App -> Metrics (Requests, Bandwidth)
- Functions App -> Monitor -> Logs (Function execution logs)
- SQL Database -> Query Performance Insight

## Cost Estimates

### Monthly
- Azure Static Web Apps: Free tier (0-100GB bandwidth, sufficient for feedback app)
- Azure Functions: Consumption Plan (~$0-5 for typical bootcamp usage)
- Azure SQL Database: Basic tier (~$5) - currently in use
- Storage Account: ~$0.50
- Application Insights: First 5GB free (if enabled)

**Total:** ~$5-10/month

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

Required secrets for CI/CD:

- `AZURE_STATIC_WEB_APPS_API_TOKEN` - QA Static Web App deployment token
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` - QA Functions App publish profile

## Security Configuration

### Database Security
- SQL Server firewall: Azure Services allowed
- SQL authentication with strong password
- TLS/SSL encryption enabled
- All credentials in Key Vault (`cat-bootcamp-kv-qa`)

### Application Security
- HTTPS enforced on all endpoints
- CORS configured for allowed origins
- Client-side rate limiting enabled
- SQL injection prevention via parameterized queries
- XSS protection via proper escaping

### Access Control
- RBAC with 6 roles: GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer
- Resource-level security (users only see events they have access to)
- Comprehensive audit logging of all authenticated actions
- Key Vault for all secrets
- Admin panel requires authentication
- Password hashing for admin credentials
- Session timeout (8 hours)

## Support & Troubleshooting

### Common Issues

**Issue:** API calls return CORS errors
**Solution:** Verify CORS settings in Functions App allow Static Web App URL

**Issue:** Database connection fails
**Solution:** Verify firewall rules allow Azure Services, check Key Vault secret values

**Issue:** Deployment workflow fails
**Solution:** Check GitHub secrets are configured, verify Azure resources exist

### Useful Commands

```bash
# Check QA API health
curl https://catbootcamp-api-qa.azurewebsites.net/api/health

# View API logs
az functionapp logs tail --name catbootcamp-api-qa --resource-group cat-bootcamp-qa-rg

# Check Azure resources
az group show --name cat-bootcamp-qa-rg
az functionapp show --name catbootcamp-api-qa --resource-group cat-bootcamp-qa-rg
```

## Related Documentation

- [Database Initialization](./database-initialization.md) - Database schema and sample data
- [Environment Variables](./environment-variables.md) - Environment-specific configurations
- [GitHub Secrets](./github-secrets.md) - CI/CD secret management
- [Deployment Runbook](../DEPLOYMENT-RUNBOOK.md) - Operational deployment procedures
- [Database Migration Strategy](../database-migration-strategy.md) - Data migration approach
- [Setup Summary](../PRODUCTION-SETUP-SUMMARY.md) - Setup completion checklist
