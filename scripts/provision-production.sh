#!/bin/bash
set -e

echo "====================================="
echo "Production Environment Provisioning"
echo "====================================="

# Configuration
SUBSCRIPTION_ID="a64ee975-1813-434c-9ea3-942b382b6cb0"
PROD_RG="cat-bootcamp-prod-rg"
LOCATION="eastus2"
SQL_SERVER_NAME="cat-bootcamp-sql-prod"
SQL_DB_NAME="CATBootcampFeedback-Prod"
SQL_ADMIN_USER="sqladmin"
SQL_ADMIN_PASSWORD="${SQL_ADMIN_PASSWORD:?Set the SQL_ADMIN_PASSWORD env var before running; never hardcode credentials}"

echo "Step 1: Creating production resource group..."
az group create \
  --name $PROD_RG \
  --location $LOCATION \
  --subscription $SUBSCRIPTION_ID \
  --tags Environment=Production Application=CATBootcamp

echo "Step 2: Creating production SQL Server..."
az sql server create \
  --name $SQL_SERVER_NAME \
  --resource-group $PROD_RG \
  --location $LOCATION \
  --admin-user $SQL_ADMIN_USER \
  --admin-password $SQL_ADMIN_PASSWORD

echo "Step 3: Configuring SQL Server firewall..."
# Allow Azure services
az sql server firewall-rule create \
  --resource-group $PROD_RG \
  --server $SQL_SERVER_NAME \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Add your IP for initial setup
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --resource-group $PROD_RG \
  --server $SQL_SERVER_NAME \
  --name AllowMyIP \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP

echo "Step 4: Creating production SQL Database..."
az sql db create \
  --resource-group $PROD_RG \
  --server $SQL_SERVER_NAME \
  --name $SQL_DB_NAME \
  --service-objective Basic \
  --collation SQL_Latin1_General_CP1_CI_AS \
  --tags Environment=Production

echo ""
echo "Production SQL Database created successfully!"
echo "Server: $SQL_SERVER_NAME.database.windows.net"
echo "Database: $SQL_DB_NAME"
echo "Admin User: $SQL_ADMIN_USER"
echo ""
echo "Next Steps:"
echo "1. Save the SQL password securely in GitHub Secrets as PROD_SQL_PASSWORD"
echo "2. Run database initialization script: database-init.sql"
echo "3. Continue with Task 3 to create Functions App"
