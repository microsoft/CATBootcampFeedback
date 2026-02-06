#!/bin/bash

# Production Functions App Creation Script
# This script creates the Azure Functions App for the production API backend

set -e

echo "=================================================="
echo "Creating Production Functions App"
echo "=================================================="

# Configuration
RESOURCE_GROUP="cat-bootcamp-prod-rg"
LOCATION="eastus2"
STORAGE_ACCOUNT="catbootcampprodapi"
APP_INSIGHTS_NAME="cat-bootcamp-insights-prod"
FUNCTION_APP_NAME="cat-bootcamp-api-prod"
SQL_SERVER_NAME="cat-bootcamp-sql-prod"
SQL_DATABASE_NAME="cat-bootcamp-db-prod"
SQL_ADMIN_USER="catbootcampadmin"
SQL_ADMIN_PASSWORD="kV$#8IFEknG%FK9D"

echo ""
echo "Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  Function App: $FUNCTION_APP_NAME"
echo "  SQL Server: $SQL_SERVER_NAME"
echo "  SQL Database: $SQL_DATABASE_NAME"
echo ""

# Step 1: Create Storage Account
echo "Step 1: Creating Storage Account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true \
  --min-tls-version TLS1_2

if [ $? -eq 0 ]; then
  echo "✓ Storage Account created successfully"
else
  echo "✗ Failed to create Storage Account"
  exit 1
fi

# Step 2: Create Application Insights
echo ""
echo "Step 2: Creating Application Insights..."
az monitor app-insights component create \
  --app $APP_INSIGHTS_NAME \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type web \
  --retention-time 90

if [ $? -eq 0 ]; then
  echo "✓ Application Insights created successfully"
else
  echo "✗ Failed to create Application Insights"
  exit 1
fi

# Get Application Insights instrumentation key
echo "Retrieving Application Insights instrumentation key..."
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app $APP_INSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey \
  --output tsv)

if [ -z "$INSTRUMENTATION_KEY" ]; then
  echo "✗ Failed to retrieve Application Insights instrumentation key"
  exit 1
fi

echo "✓ Instrumentation key retrieved"

# Step 3: Create Functions App
echo ""
echo "Step 3: Creating Functions App..."
az functionapp create \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --storage-account $STORAGE_ACCOUNT \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --os-type Linux \
  --disable-app-insights false \
  --app-insights $APP_INSIGHTS_NAME

if [ $? -eq 0 ]; then
  echo "✓ Functions App created successfully"
else
  echo "✗ Failed to create Functions App"
  exit 1
fi

# Step 4: Configure SQL Database connection string
echo ""
echo "Step 4: Configuring database connection string..."

# Build the SQL connection string
SQL_CONNECTION_STRING="Server=tcp:${SQL_SERVER_NAME}.database.windows.net,1433;Initial Catalog=${SQL_DATABASE_NAME};Persist Security Info=False;User ID=${SQL_ADMIN_USER};Password=${SQL_ADMIN_PASSWORD};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings "SqlConnectionString=$SQL_CONNECTION_STRING"

if [ $? -eq 0 ]; then
  echo "✓ Database connection string configured"
else
  echo "✗ Failed to configure database connection string"
  exit 1
fi

# Step 5: Configure Application Settings
echo ""
echo "Step 5: Configuring application settings..."
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=$INSTRUMENTATION_KEY" \
    "NODE_ENV=production" \
    "WEBSITE_NODE_DEFAULT_VERSION=~20" \
    "FUNCTIONS_WORKER_RUNTIME=node"

if [ $? -eq 0 ]; then
  echo "✓ Application settings configured"
else
  echo "✗ Failed to configure application settings"
  exit 1
fi

# Step 6: Configure CORS (initially for Azure Portal)
echo ""
echo "Step 6: Configuring CORS..."
az functionapp cors add \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "https://portal.azure.com"

if [ $? -eq 0 ]; then
  echo "✓ CORS configured for Azure Portal"
  echo "  (Static Web App origin will be added after SWA is created)"
else
  echo "✗ Failed to configure CORS"
  exit 1
fi

# Step 7: Enable HTTPS only
echo ""
echo "Step 7: Enforcing HTTPS..."
az functionapp update \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set httpsOnly=true

if [ $? -eq 0 ]; then
  echo "✓ HTTPS enforcement enabled"
else
  echo "✗ Failed to enable HTTPS enforcement"
  exit 1
fi

echo ""
echo "=================================================="
echo "Production Functions App Creation Complete!"
echo "=================================================="
echo ""
echo "Function App Details:"
echo "  Name: $FUNCTION_APP_NAME"
echo "  URL: https://${FUNCTION_APP_NAME}.azurewebsites.net"
echo "  State: Running"
echo ""
echo "Next Steps:"
echo "  1. Get publish profile for GitHub Secrets (Task 7)"
echo "  2. Deploy functions via GitHub Actions"
echo "  3. Update CORS after Static Web App is created"
echo ""
