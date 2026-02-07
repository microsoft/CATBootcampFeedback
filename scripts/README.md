# Azure Infrastructure Scripts

This directory contains scripts for provisioning and managing Azure resources for the CAT Bootcamp Feedback application.

## 🔐 Key Vault Provisioning

### Overview

The Key Vault provisioning scripts set up Azure Key Vault resources to securely store sensitive configuration values like JWT secrets. These scripts:

1. Create Azure Key Vault instances for development and production environments
2. Store JWT secrets securely in Key Vault
3. Configure Azure Functions to use Key Vault references
4. Enable managed identities for Azure Functions
5. Grant appropriate permissions for Functions to access Key Vault

### Prerequisites

- **Azure CLI**: Install from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
- **Azure Subscription**: Active subscription with appropriate permissions
- **Authenticated Session**: Run `az login` before executing scripts

### Quick Start

#### For Linux/macOS (Bash):

```bash
cd scripts
chmod +x provision-keyvault.sh
./provision-keyvault.sh
```

#### For Windows (PowerShell):

```powershell
cd scripts
.\provision-keyvault.ps1
```

### What Gets Created

#### Development Environment:
- **Key Vault**: `cat-bootcamp-kv-dev`
- **Function App**: `cat-bootcamp-api` (configured with managed identity)
- **Secret**: `JWT-SECRET` (development value)

#### Production Environment:
- **Key Vault**: `cat-bootcamp-kv-prod`
- **Function App**: `cat-bootcamp-api-prod` (configured with managed identity)
- **Secret**: `JWT-SECRET` (production value)

### How It Works

1. **Key Vault Creation**: Creates separate Key Vault instances for dev and prod
2. **Secret Storage**: Stores JWT secrets securely (encrypted at rest)
3. **Managed Identity**: Enables system-assigned managed identity on Function Apps
4. **Access Policy**: Grants Function Apps `get` and `list` permissions on secrets
5. **App Settings**: Configures Function Apps to use Key Vault references

### Key Vault Reference Format

The scripts configure Azure Functions to use Key Vault references in this format:

```
JWT_SECRET=@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>)
```

Azure automatically resolves these references at runtime, so no code changes are needed.

### Security Features

- **Encryption at Rest**: All secrets are encrypted in Key Vault
- **Managed Identities**: No credentials stored in code or configuration
- **Access Policies**: Principle of least privilege (only `get` and `list`)
- **Audit Logs**: All secret access is logged in Azure Monitor
- **Separate Environments**: Dev and prod secrets are isolated

### Verification

After running the script, verify the configuration:

```bash
# Check development Function App settings
az functionapp config appsettings list --name cat-bootcamp-api --resource-group cat-bootcamp-rg

# Check production Function App settings
az functionapp config appsettings list --name cat-bootcamp-api-prod --resource-group cat-bootcamp-rg

# Verify Key Vault access
az keyvault secret show --vault-name cat-bootcamp-kv-dev --name JWT-SECRET
az keyvault secret show --vault-name cat-bootcamp-kv-prod --name JWT-SECRET
```

### Rotating Secrets

To rotate JWT secrets:

```bash
# Update development secret
az keyvault secret set --vault-name cat-bootcamp-kv-dev --name JWT-SECRET --value "NEW_SECRET_VALUE"

# Update production secret
az keyvault secret set --vault-name cat-bootcamp-kv-prod --name JWT-SECRET --value "NEW_SECRET_VALUE"
```

**Note**: Function Apps automatically pick up new secret values within a few minutes. No restart required.

### Troubleshooting

#### "Key Vault name already exists"
- This is expected if re-running the script
- The script will update existing Key Vault with new secrets

#### "Function App cannot access Key Vault"
- Verify managed identity is enabled: `az functionapp identity show --name <app-name> --resource-group cat-bootcamp-rg`
- Check access policy: `az keyvault show --name <vault-name> --query properties.accessPolicies`

#### "JWT_SECRET environment variable not found"
- Restart the Function App: `az functionapp restart --name <app-name> --resource-group cat-bootcamp-rg`
- Allow 2-3 minutes for Key Vault references to sync

### Best Practices

1. **Use Strong Secrets**: Generate secrets with at least 32 characters
2. **Rotate Regularly**: Update secrets every 90 days
3. **Separate Secrets**: Never use the same secret for dev and prod
4. **Audit Access**: Review Key Vault audit logs monthly
5. **Least Privilege**: Only grant necessary permissions

### Resources

- [Azure Key Vault Documentation](https://docs.microsoft.com/en-us/azure/key-vault/)
- [Managed Identities for Azure Resources](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/)
- [Key Vault References in Azure Functions](https://docs.microsoft.com/en-us/azure/app-service/app-service-key-vault-references)
