#!/bin/bash

# Create Production Static Web App
# This script creates the production Azure Static Web App for the CAT Bootcamp Feedback application

set -e

# Configuration
RESOURCE_GROUP="cat-bootcamp-prod-rg"
STATIC_APP_NAME="cat-bootcamp-feedback-prod"
LOCATION="eastus2"
SKU="Standard"

echo "Creating Production Static Web App..."
echo "Resource Group: $RESOURCE_GROUP"
echo "Static App Name: $STATIC_APP_NAME"
echo "Location: $LOCATION"
echo "SKU: $SKU"
echo ""

# Check if resource group exists
echo "Checking if resource group exists..."
if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo "Error: Resource group $RESOURCE_GROUP does not exist"
    exit 1
fi
echo "Resource group exists."
echo ""

# Check if Static Web App already exists
echo "Checking if Static Web App already exists..."
if az staticwebapp show --name "$STATIC_APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "Static Web App $STATIC_APP_NAME already exists."
    echo "Retrieving deployment token..."
    DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
        --name "$STATIC_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "properties.apiKey" -o tsv)
    echo ""
    echo "Static Web App: $STATIC_APP_NAME (already exists)"
    echo "Deployment Token: $DEPLOYMENT_TOKEN"
    exit 0
fi

# Create Static Web App
echo "Creating Static Web App..."
az staticwebapp create \
    --name "$STATIC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku "$SKU"

echo ""
echo "Static Web App created successfully!"
echo ""

# Get deployment token
echo "Retrieving deployment token..."
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
    --name "$STATIC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.apiKey" -o tsv)

# Get default hostname
DEFAULT_HOSTNAME=$(az staticwebapp show \
    --name "$STATIC_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "defaultHostname" -o tsv)

echo ""
echo "=========================================="
echo "Production Static Web App Created"
echo "=========================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "Static App Name: $STATIC_APP_NAME"
echo "Default Hostname: $DEFAULT_HOSTNAME"
echo "Default URL: https://$DEFAULT_HOSTNAME"
echo ""
echo "Deployment Token (save this for GitHub Secrets):"
echo "$DEPLOYMENT_TOKEN"
echo ""
echo "=========================================="
