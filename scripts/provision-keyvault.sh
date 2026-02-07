#!/bin/bash

# Azure Key Vault Provisioning Script
# This script provisions Azure Key Vault resources for both dev and prod environments
# and configures Azure Functions to use Key Vault references

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 CAT Bootcamp - Azure Key Vault Provisioning"
echo "=============================================="
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed${NC}"
    echo "Please install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Azure${NC}"
    echo "Please run: az login"
    exit 1
fi

# Configuration
RESOURCE_GROUP="cat-bootcamp-rg"
LOCATION="centralus"
DEV_KEYVAULT_NAME="cat-bootcamp-kv-dev"
PROD_KEYVAULT_NAME="cat-bootcamp-kv-prod"
DEV_FUNCTION_APP="cat-bootcamp-api"
PROD_FUNCTION_APP="cat-bootcamp-api-prod"
SECRET_NAME="JWT-SECRET"

echo "📋 Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Dev Key Vault: $DEV_KEYVAULT_NAME"
echo "  Prod Key Vault: $PROD_KEYVAULT_NAME"
echo ""

# Prompt for JWT secret
echo "🔑 JWT Secret Configuration"
echo -e "${YELLOW}⚠️  You will be prompted to enter the JWT secret for both environments${NC}"
echo ""

read -s -p "Enter JWT secret for DEVELOPMENT environment: " DEV_JWT_SECRET
echo ""
read -s -p "Enter JWT secret for PRODUCTION environment: " PROD_JWT_SECRET
echo ""
echo ""

if [ -z "$DEV_JWT_SECRET" ] || [ -z "$PROD_JWT_SECRET" ]; then
    echo -e "${RED}❌ JWT secrets cannot be empty${NC}"
    exit 1
fi

# Create resource group if it doesn't exist
echo "📦 Checking resource group..."
if ! az group show --name $RESOURCE_GROUP &> /dev/null; then
    echo "Creating resource group $RESOURCE_GROUP..."
    az group create --name $RESOURCE_GROUP --location $LOCATION
    echo -e "${GREEN}✅ Resource group created${NC}"
else
    echo -e "${GREEN}✅ Resource group exists${NC}"
fi
echo ""

# Function to provision Key Vault
provision_keyvault() {
    local ENV=$1
    local KEYVAULT_NAME=$2
    local FUNCTION_APP=$3
    local JWT_SECRET=$4

    echo "🏗️  Provisioning Key Vault for $ENV environment..."
    echo "  Key Vault: $KEYVAULT_NAME"
    echo ""

    # Create Key Vault
    echo "  Creating Key Vault..."
    if az keyvault show --name $KEYVAULT_NAME &> /dev/null; then
        echo -e "  ${YELLOW}⚠️  Key Vault already exists${NC}"
    else
        az keyvault create \
            --name $KEYVAULT_NAME \
            --resource-group $RESOURCE_GROUP \
            --location $LOCATION \
            --enable-rbac-authorization false \
            --enabled-for-deployment true \
            --enabled-for-template-deployment true
        echo -e "  ${GREEN}✅ Key Vault created${NC}"
    fi

    # Store JWT secret
    echo "  Storing JWT secret..."
    az keyvault secret set \
        --vault-name $KEYVAULT_NAME \
        --name $SECRET_NAME \
        --value "$JWT_SECRET" \
        --output none
    echo -e "  ${GREEN}✅ JWT secret stored${NC}"

    # Get Function App Managed Identity
    echo "  Configuring Function App managed identity..."

    # Enable system-assigned managed identity
    PRINCIPAL_ID=$(az functionapp identity assign \
        --name $FUNCTION_APP \
        --resource-group $RESOURCE_GROUP \
        --query principalId \
        --output tsv)

    echo "  Function App Principal ID: $PRINCIPAL_ID"

    # Grant Function App access to Key Vault
    echo "  Granting Key Vault access to Function App..."
    az keyvault set-policy \
        --name $KEYVAULT_NAME \
        --object-id $PRINCIPAL_ID \
        --secret-permissions get list \
        --output none
    echo -e "  ${GREEN}✅ Access granted${NC}"

    # Get secret URI
    SECRET_URI=$(az keyvault secret show \
        --vault-name $KEYVAULT_NAME \
        --name $SECRET_NAME \
        --query id \
        --output tsv)

    echo "  Secret URI: $SECRET_URI"

    # Configure Function App to use Key Vault reference
    echo "  Configuring Function App settings..."
    az functionapp config appsettings set \
        --name $FUNCTION_APP \
        --resource-group $RESOURCE_GROUP \
        --settings "JWT_SECRET=@Microsoft.KeyVault(SecretUri=$SECRET_URI)" \
        --output none
    echo -e "  ${GREEN}✅ Function App configured${NC}"
    echo ""
}

# Provision Development environment
provision_keyvault "DEVELOPMENT" "$DEV_KEYVAULT_NAME" "$DEV_FUNCTION_APP" "$DEV_JWT_SECRET"

# Provision Production environment
provision_keyvault "PRODUCTION" "$PROD_KEYVAULT_NAME" "$PROD_FUNCTION_APP" "$PROD_JWT_SECRET"

echo -e "${GREEN}🎉 Provisioning Complete!${NC}"
echo ""
echo "📝 Summary:"
echo "  ✅ Development Key Vault: $DEV_KEYVAULT_NAME"
echo "  ✅ Production Key Vault: $PROD_KEYVAULT_NAME"
echo "  ✅ JWT secrets stored securely"
echo "  ✅ Function Apps configured with Key Vault references"
echo ""
echo "🔍 Verification:"
echo "  You can verify the configuration with:"
echo "  az functionapp config appsettings list --name $DEV_FUNCTION_APP --resource-group $RESOURCE_GROUP"
echo "  az functionapp config appsettings list --name $PROD_FUNCTION_APP --resource-group $RESOURCE_GROUP"
echo ""
echo -e "${YELLOW}⚠️  Important: The Function Apps will restart automatically to apply the new settings${NC}"
