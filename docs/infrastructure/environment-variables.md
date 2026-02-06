# Environment Variables Configuration

## Development Environment

### Static Web App (cat-bootcamp-feedback)
No environment variables needed - configuration in `config.js`

### Functions App (cat-bootcamp-api)

**App Settings:**
```bash
SQL_SERVER=cat-bootcamp-sql-89082.database.windows.net
SQL_DATABASE=CATBootcampFeedback
SQL_USER=sqladmin
SQL_PASSWORD=<dev-password>
NODE_ENV=development
FUNCTIONS_WORKER_RUNTIME=node
WEBSITE_NODE_DEFAULT_VERSION=~20
```

## Production Environment

### Static Web App (cat-bootcamp-feedback-prod)
No environment variables needed - configuration in `config.js`

### Functions App (cat-bootcamp-api-prod)

**App Settings:**
```bash
SQL_SERVER=cat-bootcamp-sql-prod.database.windows.net
SQL_DATABASE=CATBootcampFeedback-Prod
SQL_USER=sqladmin
SQL_PASSWORD=<prod-password>
NODE_ENV=production
FUNCTIONS_WORKER_RUNTIME=node
WEBSITE_NODE_DEFAULT_VERSION=~20
```

## GitHub Secrets Required

### Repository Secrets
- `AZURE_CREDENTIALS` - Service principal for Azure CLI actions
- `AZURE_SUBSCRIPTION_ID` - Azure subscription ID

### Development Secrets
- `AZURE_STATIC_WEB_APPS_API_TOKEN_BLUE_MOSS_01913F80F` - Already exists
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` - Dev functions publish profile

### Production Secrets
- `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` - Prod static web app token
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE_PROD` - Prod functions publish profile
- `PROD_SQL_PASSWORD` - Production database password

## Configuration Files by Environment

### config.js Environment Detection

```javascript
// Development
if (hostname === 'blue-moss-01913f80f.1.azurestaticapps.net') {
    CONFIG.API_BASE_URL = 'https://cat-bootcamp-api.azurewebsites.net/api';
}

// Production
if (hostname === 'catbootcamp.yourdomain.com' || hostname.includes('cat-bootcamp-feedback-prod')) {
    CONFIG.API_BASE_URL = 'https://cat-bootcamp-api-prod.azurewebsites.net/api';
}
```
