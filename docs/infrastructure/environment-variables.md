# Environment Variables Configuration

## Development Environment

### Static Web App (cat-bootcamp-feedback)
No environment variables needed - configuration in `config.js`

### Functions App (cat-bootcamp-api-win)

**App Settings (Key Vault References):**

All secrets are stored in Azure Key Vault (`cat-bootcamp-kv-dev`) and referenced via Key Vault references. The Function App's system-assigned managed identity (PrincipalId: `40f89a16-1607-4443-8653-63bbdc020113`) has `get` and `list` secret permissions.

```bash
SQL_SERVER=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-dev;SecretName=SQL-SERVER)
SQL_DATABASE=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-dev;SecretName=SQL-DATABASE)
SQL_USER=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-dev;SecretName=SQL-USER)
SQL_PASSWORD=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-dev;SecretName=SQL-PASSWORD)
JWT_SECRET=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-dev;SecretName=JWT-SECRET)
ADMIN_USERS_JSON=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-dev;SecretName=ADMIN-USERS-JSON)  # Fallback — users now in DB
NODE_ENV=development
FUNCTIONS_WORKER_RUNTIME=node
WEBSITE_NODE_DEFAULT_VERSION=~20
```

**Key Vault Secrets (`cat-bootcamp-kv-dev`):**

| Secret Name | Description |
|---|---|
| `SQL-SERVER` | Azure SQL server hostname |
| `SQL-DATABASE` | Database name |
| `SQL-USER` | SQL login username |
| `SQL-PASSWORD` | SQL login password |
| `JWT-SECRET` | JWT signing secret for admin auth |
| `ADMIN-USERS-JSON` | JSON array of admin users with bcrypt password hashes (**fallback** -- users are now managed in the database Users table; this env var is still read during the migration period) |

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

## Optional Environment Variables

The following environment variables are optional and may be added when those features are enabled:

| Variable | Description |
|---|---|
| `SENDGRID_API_KEY` | Optional. API key for SendGrid email notifications (e.g., password reset emails) |
| `AZURE_COMM_CONNECTION_STRING` | Optional. Connection string for Azure Communication Services email integration |

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
