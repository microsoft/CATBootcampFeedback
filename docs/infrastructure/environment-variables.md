# Environment Variables Configuration

## QA Environment

### Static Web App (ashy-rock-0b254600f)
No environment variables needed - configuration in `config.js`

### Functions App (catbootcamp-api-qa)

**App Settings (Key Vault References):**

All secrets are stored in Azure Key Vault (`cat-bootcamp-kv-qa`) and referenced via Key Vault references. The Function App's system-assigned managed identity has `get` and `list` secret permissions.

```bash
SQL_SERVER=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-SERVER)
SQL_DATABASE=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-DATABASE)
SQL_USER=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-USER)
SQL_PASSWORD=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=SQL-PASSWORD)
JWT_SECRET=@Microsoft.KeyVault(VaultName=cat-bootcamp-kv-qa;SecretName=JWT-SECRET)
NODE_ENV=production
FUNCTIONS_WORKER_RUNTIME=node
WEBSITE_NODE_DEFAULT_VERSION=~20
```

> **Note:** `ADMIN_USERS_JSON` is no longer used for authentication. All users are managed in the database Users table via the People & Permissions UI.

**Key Vault Secrets (`cat-bootcamp-kv-qa`):**

| Secret Name | Description |
|---|---|
| `SQL-SERVER` | Azure SQL server hostname |
| `SQL-DATABASE` | Database name |
| `SQL-USER` | SQL login username |
| `SQL-PASSWORD` | SQL login password |
| `JWT-SECRET` | JWT signing secret for admin auth |
| `ACS-CONNECTION-STRING` | Azure Communication Services connection string for email |

All database connection details and secrets must be stored in Key Vault -- no plain text credentials in Function App settings.

## GitHub Secrets Required

### Repository Secrets
- `AZURE_CREDENTIALS` - Service principal for Azure CLI actions
- `AZURE_SUBSCRIPTION_ID` - Azure subscription ID

### QA Secrets
- `AZURE_STATIC_WEB_APPS_API_TOKEN` - QA Static Web App deployment token
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` - QA Functions App publish profile

## Email Environment Variables

| Variable | Description |
|---|---|
| `AZURE_COMM_CONNECTION_STRING` | **Required for email.** Connection string for Azure Communication Services. Stored in Key Vault as `ACS-CONNECTION-STRING`. |
| `EMAIL_SENDER_ADDRESS` | Sender email address for notifications. Default: `DoNotReply@{azure-managed-domain}.azurecomm.net` |

## Configuration Files

### config.js Environment Detection

```javascript
// QA
if (hostname === 'ashy-rock-0b254600f.4.azurestaticapps.net') {
    CONFIG.API_BASE_URL = 'https://catbootcamp-api-qa.azurewebsites.net/api';
}
```
