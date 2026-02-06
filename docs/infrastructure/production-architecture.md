# Production Infrastructure Architecture

## Resource Groups

### Development Environment
- **Resource Group:** `cat-bootcamp-rg`
- **Region:** East US 2
- **Purpose:** Development/testing environment, auto-deploys from main branch

**Resources:**
- Static Web App: `cat-bootcamp-feedback` (blue-moss-01913f80f.1.azurestaticapps.net)
- Functions App: `cat-bootcamp-api`
- SQL Server: `cat-bootcamp-sql-89082`
- SQL Database: `CATBootcampFeedback`
- Storage Account: `catbootcampapi890`

### Production Environment
- **Resource Group:** `cat-bootcamp-prod-rg`
- **Region:** East US 2 (same as dev for consistency)
- **Purpose:** Production environment, manual approval required for deployments

**Resources:**
- Static Web App: `cat-bootcamp-feedback-prod` (custom domain: catbootcamp.azurefd.net)
- Functions App: `cat-bootcamp-api-prod`
- SQL Server: `cat-bootcamp-sql-prod`
- SQL Database: `CATBootcampFeedback-Prod`
- Storage Account: `catbootcampprodapi`

## Naming Convention

| Resource Type | Dev Name | Prod Name |
|---------------|----------|-----------|
| Resource Group | cat-bootcamp-rg | cat-bootcamp-prod-rg |
| Static Web App | cat-bootcamp-feedback | cat-bootcamp-feedback-prod |
| Functions App | cat-bootcamp-api | cat-bootcamp-api-prod |
| SQL Server | cat-bootcamp-sql-89082 | cat-bootcamp-sql-prod |
| SQL Database | CATBootcampFeedback | CATBootcampFeedback-Prod |
| Storage Account | catbootcampapi890 | catbootcampprodapi |

## Deployment Pipeline

```
Developer Push → main branch
         ↓
   Auto-deploy to DEV
         ↓
   Manual Testing in DEV
         ↓
   Create Release Tag (v1.0.0)
         ↓
   Trigger Production Workflow
         ↓
   Manual Approval Required
         ↓
   Deploy to PROD
```

## Environment Configuration

### Development (auto-deploy from main)
- Frontend URL: https://blue-moss-01913f80f.1.azurestaticapps.net
- API URL: https://cat-bootcamp-api.azurewebsites.net/api
- Database: cat-bootcamp-sql-89082.database.windows.net

### Production (approval-gated)
- Frontend URL: https://catbootcamp.yourdomain.com (custom domain)
- API URL: https://cat-bootcamp-api-prod.azurewebsites.net/api
- Database: cat-bootcamp-sql-prod.database.windows.net

## Cost Estimates

### Per Environment (Monthly)
- Azure Static Web Apps: Free tier (0-100GB bandwidth)
- Azure Functions: Consumption Plan (~$0-5 for typical usage)
- Azure SQL Database: Basic tier (~$5) or Standard S0 (~$15)
- Storage Account: ~$0.50
- Application Insights: First 5GB free

**Total per environment:** $5-20/month
**Both environments:** $10-40/month
