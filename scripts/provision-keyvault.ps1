# Azure Key Vault Provisioning Script (PowerShell)
# This script provisions Azure Key Vault resources for both dev and prod environments
# and configures Azure Functions to use Key Vault references

$ErrorActionPreference = "Stop"

Write-Host "🔐 CAT Bootcamp - Azure Key Vault Provisioning" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Azure CLI is installed
if (!(Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI is not installed" -ForegroundColor Red
    Write-Host "Please install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
}

# Check if logged in
try {
    az account show 2>$null | Out-Null
} catch {
    Write-Host "❌ Not logged in to Azure" -ForegroundColor Red
    Write-Host "Please run: az login"
    exit 1
}

# Configuration
$RESOURCE_GROUP = "cat-bootcamp-rg"
$LOCATION = "centralus"
$DEV_KEYVAULT_NAME = "cat-bootcamp-kv-dev"
$PROD_KEYVAULT_NAME = "cat-bootcamp-kv-prod"
$DEV_FUNCTION_APP = "cat-bootcamp-api"
$PROD_FUNCTION_APP = "cat-bootcamp-api-prod"
$SECRET_NAME = "JWT-SECRET"

Write-Host "📋 Configuration:"
Write-Host "  Resource Group: $RESOURCE_GROUP"
Write-Host "  Location: $LOCATION"
Write-Host "  Dev Key Vault: $DEV_KEYVAULT_NAME"
Write-Host "  Prod Key Vault: $PROD_KEYVAULT_NAME"
Write-Host ""

# Prompt for JWT secret
Write-Host "🔑 JWT Secret Configuration" -ForegroundColor Yellow
Write-Host "⚠️  You will be prompted to enter the JWT secret for both environments" -ForegroundColor Yellow
Write-Host ""

$DEV_JWT_SECRET = Read-Host "Enter JWT secret for DEVELOPMENT environment" -AsSecureString
$DEV_JWT_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DEV_JWT_SECRET))

$PROD_JWT_SECRET = Read-Host "Enter JWT secret for PRODUCTION environment" -AsSecureString
$PROD_JWT_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($PROD_JWT_SECRET))

Write-Host ""

if ([string]::IsNullOrWhiteSpace($DEV_JWT_SECRET_PLAIN) -or [string]::IsNullOrWhiteSpace($PROD_JWT_SECRET_PLAIN)) {
    Write-Host "❌ JWT secrets cannot be empty" -ForegroundColor Red
    exit 1
}

# Create resource group if it doesn't exist
Write-Host "📦 Checking resource group..."
try {
    az group show --name $RESOURCE_GROUP 2>$null | Out-Null
    Write-Host "✅ Resource group exists" -ForegroundColor Green
} catch {
    Write-Host "Creating resource group $RESOURCE_GROUP..."
    az group create --name $RESOURCE_GROUP --location $LOCATION
    Write-Host "✅ Resource group created" -ForegroundColor Green
}
Write-Host ""

# Function to provision Key Vault
function Provision-KeyVault {
    param(
        [string]$Env,
        [string]$KeyVaultName,
        [string]$FunctionApp,
        [string]$JWTSecret
    )

    Write-Host "🏗️  Provisioning Key Vault for $Env environment..." -ForegroundColor Cyan
    Write-Host "  Key Vault: $KeyVaultName"
    Write-Host ""

    # Create Key Vault
    Write-Host "  Creating Key Vault..."
    try {
        az keyvault show --name $KeyVaultName 2>$null | Out-Null
        Write-Host "  ⚠️  Key Vault already exists" -ForegroundColor Yellow
    } catch {
        az keyvault create `
            --name $KeyVaultName `
            --resource-group $RESOURCE_GROUP `
            --location $LOCATION `
            --enable-rbac-authorization false `
            --enabled-for-deployment true `
            --enabled-for-template-deployment true
        Write-Host "  ✅ Key Vault created" -ForegroundColor Green
    }

    # Store JWT secret
    Write-Host "  Storing JWT secret..."
    az keyvault secret set `
        --vault-name $KeyVaultName `
        --name $SECRET_NAME `
        --value $JWTSecret `
        --output none
    Write-Host "  ✅ JWT secret stored" -ForegroundColor Green

    # Get Function App Managed Identity
    Write-Host "  Configuring Function App managed identity..."

    # Enable system-assigned managed identity
    $PRINCIPAL_ID = az functionapp identity assign `
        --name $FunctionApp `
        --resource-group $RESOURCE_GROUP `
        --query principalId `
        --output tsv

    Write-Host "  Function App Principal ID: $PRINCIPAL_ID"

    # Grant Function App access to Key Vault
    Write-Host "  Granting Key Vault access to Function App..."
    az keyvault set-policy `
        --name $KeyVaultName `
        --object-id $PRINCIPAL_ID `
        --secret-permissions get list `
        --output none
    Write-Host "  ✅ Access granted" -ForegroundColor Green

    # Get secret URI
    $SECRET_URI = az keyvault secret show `
        --vault-name $KeyVaultName `
        --name $SECRET_NAME `
        --query id `
        --output tsv

    Write-Host "  Secret URI: $SECRET_URI"

    # Configure Function App to use Key Vault reference
    Write-Host "  Configuring Function App settings..."
    az functionapp config appsettings set `
        --name $FunctionApp `
        --resource-group $RESOURCE_GROUP `
        --settings "JWT_SECRET=@Microsoft.KeyVault(SecretUri=$SECRET_URI)" `
        --output none
    Write-Host "  ✅ Function App configured" -ForegroundColor Green
    Write-Host ""
}

# Provision Development environment
Provision-KeyVault -Env "DEVELOPMENT" -KeyVaultName $DEV_KEYVAULT_NAME -FunctionApp $DEV_FUNCTION_APP -JWTSecret $DEV_JWT_SECRET_PLAIN

# Provision Production environment
Provision-KeyVault -Env "PRODUCTION" -KeyVaultName $PROD_KEYVAULT_NAME -FunctionApp $PROD_FUNCTION_APP -JWTSecret $PROD_JWT_SECRET_PLAIN

# Clear sensitive variables
$DEV_JWT_SECRET_PLAIN = $null
$PROD_JWT_SECRET_PLAIN = $null

Write-Host "🎉 Provisioning Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Summary:"
Write-Host "  ✅ Development Key Vault: $DEV_KEYVAULT_NAME"
Write-Host "  ✅ Production Key Vault: $PROD_KEYVAULT_NAME"
Write-Host "  ✅ JWT secrets stored securely"
Write-Host "  ✅ Function Apps configured with Key Vault references"
Write-Host ""
Write-Host "🔍 Verification:"
Write-Host "  You can verify the configuration with:"
Write-Host "  az functionapp config appsettings list --name $DEV_FUNCTION_APP --resource-group $RESOURCE_GROUP"
Write-Host "  az functionapp config appsettings list --name $PROD_FUNCTION_APP --resource-group $RESOURCE_GROUP"
Write-Host ""
Write-Host "⚠️  Important: The Function Apps will restart automatically to apply the new settings" -ForegroundColor Yellow
