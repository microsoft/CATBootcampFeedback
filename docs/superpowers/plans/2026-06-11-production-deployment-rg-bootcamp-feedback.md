# Production Deployment to rg-bootcamp-feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is an infrastructure/ops plan: "tests" are verification commands with expected output; commit after each file-producing task.

**Goal:** Provision a secure production instance of CATBootcampFeedback in `rg-bootcamp-feedback`, migrate all QA data into it, and enable push-to-`main` auto-deploy — with zero secrets committed to the repo.

**Architecture:** Bicep IaC provisions SQL DB, Function App (Node 20 Consumption), Static Web App, Key Vault, Storage, App Insights, and ACS Email into the new RG. Secrets are generated at deploy time and stored only in Key Vault; the Function App reads them via Key Vault references through its managed identity. GitHub Actions deploys frontend + API on push to `main`. QA data is copied via BACPAC export/import (cross-tenant).

**Tech Stack:** Azure CLI, Bicep, Azure Functions Core Tools, GitHub Actions, gh CLI, SqlPackage/az sql import-export.

**Known environment facts (verified 2026-06-11):**
- Target subscription: `d922eeb1-ad31-4f25-89cf-1042176de302` (`bootcamp-infra-prod`)
- Target tenant: `efb073bb-283b-4757-a252-22af963721bc` (copilotstudiotraining)
- RG: `rg-bootcamp-feedback`, location `eastus`, currently empty
- QA lives in a **different tenant** (export deferred to Phase 6)
- Repo branch in use: `prod-deploy/rg-bootcamp-feedback`

**Naming (final):**
| Resource | Name | Region |
|---|---|---|
| SQL Server | `sql-catbootcamp-fb-<uniq>` | eastus |
| SQL DB | `CATBootcampFeedback` | eastus |
| Function App | `catbootcamp-feedback-api` | eastus |
| Storage | `stcatbootcampfb<uniq>` | eastus |
| Key Vault | `kv-catbootcamp-fb-<uniq>` | eastus |
| App Insights | `appi-catbootcamp-feedback` | eastus |
| Log Analytics | `log-catbootcamp-feedback` | eastus |
| ACS | `acs-catbootcamp-feedback` | global (data: United States) |
| Email Comm Svc | `email-catbootcamp-feedback` | global |
| Static Web App | `swa-catbootcamp-feedback` | **eastus2** |

`<uniq>` = `uniqueString(resourceGroup().id)` (6 chars appended in Bicep).

---

## Phase 0 — Prerequisites & verification (target tenant)

### Task 0: Confirm context and register resource providers

**Files:** none

- [ ] **Step 1: Confirm active subscription**

Run:
```bash
az account show --query "{name:name, sub:id, tenant:tenantId}" -o json
```
Expected: `sub` = `d922eeb1-ad31-4f25-89cf-1042176de302`. If not: `az account set --subscription d922eeb1-ad31-4f25-89cf-1042176de302`.

- [ ] **Step 2: Register required resource providers**

Run:
```bash
for p in Microsoft.Web Microsoft.Sql Microsoft.Storage Microsoft.KeyVault Microsoft.Insights Microsoft.OperationalInsights Microsoft.Communication; do az provider register --namespace $p; done
```
Expected: no error (registration is async).

- [ ] **Step 3: Verify registration state**

Run:
```bash
for p in Microsoft.Web Microsoft.Sql Microsoft.Storage Microsoft.KeyVault Microsoft.Insights Microsoft.OperationalInsights Microsoft.Communication; do echo "$p: $(az provider show -n $p --query registrationState -o tsv)"; done
```
Expected: all `Registered` (re-run after a minute if any show `Registering`).

- [ ] **Step 4: Confirm SqlPackage availability for later (informational)**

Run:
```bash
which sqlpackage || echo "sqlpackage not found — Phase 6 will use 'az sql db import/export' instead"
```
Expected: either a path or the fallback note. No action now.

---

## Phase 1 — Author Bicep IaC

### Task 1: Scaffold infra directory and parameters

**Files:**
- Create: `infra/main.bicepparam`

- [ ] **Step 1: Create the parameters file (NO SECRETS)**

```bicep
using './main.bicep'

param location = 'eastus'
param swaLocation = 'eastus2'
param baseName = 'catbootcamp-fb'
param functionAppName = 'catbootcamp-feedback-api'
param swaName = 'swa-catbootcamp-feedback'
param sqlDatabaseName = 'CATBootcampFeedback'
param sqlAdminUser = 'sqladmin'
param acsDataLocation = 'United States'
// sqlAdminPassword and jwtSecret are passed at deploy time via --parameters, never stored here.
```

- [ ] **Step 2: Commit**

```bash
git add infra/main.bicepparam
git commit -m "infra: add bicep parameters (no secrets)"
```

### Task 2: Author storage, monitoring, and Key Vault modules

**Files:**
- Create: `infra/modules/storage.bicep`
- Create: `infra/modules/monitoring.bicep`
- Create: `infra/modules/keyvault.bicep`

- [ ] **Step 1: storage.bicep**

```bicep
param location string
param storageAccountName string

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

output id string = storage.id
output name string = storage.name
```

- [ ] **Step 2: monitoring.bicep**

```bicep
param location string
param workspaceName string
param appInsightsName string

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: workspace.id }
}

output connectionString string = appInsights.properties.ConnectionString
```

- [ ] **Step 3: keyvault.bicep (RBAC-based)**

```bicep
param location string
param keyVaultName string
param tenantId string

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

output id string = kv.id
output name string = kv.name
output uri string = kv.properties.vaultUri
```

- [ ] **Step 4: Commit**

```bash
git add infra/modules/storage.bicep infra/modules/monitoring.bicep infra/modules/keyvault.bicep
git commit -m "infra: add storage, monitoring, key vault modules"
```

### Task 3: Author SQL module

**Files:**
- Create: `infra/modules/sql.bicep`

- [ ] **Step 1: sql.bicep**

```bicep
param location string
param sqlServerName string
param sqlDatabaseName string
param sqlAdminUser string
@secure()
param sqlAdminPassword string

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminUser
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource allowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllAzureIps'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource db 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  sku: { name: 'Basic', tier: 'Basic' }
  properties: { collation: 'SQL_Latin1_General_CP1_CI_AS' }
}

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output serverName string = sqlServer.name
output databaseName string = db.name
```

- [ ] **Step 2: Commit**

```bash
git add infra/modules/sql.bicep
git commit -m "infra: add azure sql module"
```

### Task 4: Author ACS Email module

**Files:**
- Create: `infra/modules/acs.bicep`

- [ ] **Step 1: acs.bicep (Communication Services + Email + Azure-managed domain)**

```bicep
param acsName string
param emailServiceName string
param dataLocation string

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: emailServiceName
  location: 'global'
  properties: { dataLocation: dataLocation }
}

resource managedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: { domainManagement: 'AzureManaged' }
}

resource acs 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: acsName
  location: 'global'
  properties: {
    dataLocation: dataLocation
    linkedDomains: [ managedDomain.id ]
  }
}

output acsName string = acs.name
output senderDomain string = managedDomain.properties.mailFromSenderDomain
```

- [ ] **Step 2: Commit**

```bash
git add infra/modules/acs.bicep
git commit -m "infra: add ACS email module with azure-managed domain"
```

### Task 5: Author Function App and Static Web App modules

**Files:**
- Create: `infra/modules/functions.bicep`
- Create: `infra/modules/swa.bicep`

- [ ] **Step 1: functions.bicep (Linux Consumption, Node 20, system-assigned MI, KV-reference app settings)**

```bicep
param location string
param functionAppName string
param storageAccountName string
param appInsightsConnectionString string
param keyVaultName string

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${functionAppName}-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'functionapp'
  properties: { reserved: true }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'SQL_SERVER', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=SQL-SERVER)' }
        { name: 'SQL_DATABASE', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=SQL-DATABASE)' }
        { name: 'SQL_USER', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=SQL-USER)' }
        { name: 'SQL_PASSWORD', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=SQL-PASSWORD)' }
        { name: 'JWT_SECRET', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=JWT-SECRET)' }
        { name: 'AZURE_COMM_CONNECTION_STRING', value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ACS-CONNECTION-STRING)' }
      ]
    }
  }
}

output principalId string = functionApp.identity.principalId
output defaultHostName string = functionApp.properties.defaultHostName
output name string = functionApp.name
```

- [ ] **Step 2: swa.bicep (Free tier, eastus2)**

```bicep
param swaLocation string
param swaName string

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: swaLocation
  sku: { name: 'Free', tier: 'Free' }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

output defaultHostname string = swa.properties.defaultHostname
output name string = swa.name
```

- [ ] **Step 3: Commit**

```bash
git add infra/modules/functions.bicep infra/modules/swa.bicep
git commit -m "infra: add function app and static web app modules"
```

### Task 6: Author main.bicep orchestration + Key Vault RBAC role assignment

**Files:**
- Create: `infra/main.bicep`

- [ ] **Step 1: main.bicep**

```bicep
targetScope = 'resourceGroup'

param location string
param swaLocation string
param baseName string
param functionAppName string
param swaName string
param sqlDatabaseName string
param sqlAdminUser string
param acsDataLocation string
@secure()
param sqlAdminPassword string
@secure()
param jwtSecret string

var uniq = take(uniqueString(resourceGroup().id), 6)
var sqlServerName = 'sql-${baseName}-${uniq}'
var storageAccountName = take(toLower(replace('st${baseName}${uniq}', '-', '')), 24)
var keyVaultName = 'kv-${baseName}-${uniq}'

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: { location: location, storageAccountName: storageAccountName }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    workspaceName: 'log-catbootcamp-feedback'
    appInsightsName: 'appi-catbootcamp-feedback'
  }
}

module kv 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: { location: location, keyVaultName: keyVaultName, tenantId: tenant().tenantId }
}

module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    location: location
    sqlServerName: sqlServerName
    sqlDatabaseName: sqlDatabaseName
    sqlAdminUser: sqlAdminUser
    sqlAdminPassword: sqlAdminPassword
  }
}

module acs 'modules/acs.bicep' = {
  name: 'acs'
  params: {
    acsName: 'acs-catbootcamp-feedback'
    emailServiceName: 'email-catbootcamp-feedback'
    dataLocation: acsDataLocation
  }
}

module functions 'modules/functions.bicep' = {
  name: 'functions'
  params: {
    location: location
    functionAppName: functionAppName
    storageAccountName: storage.outputs.name
    appInsightsConnectionString: monitoring.outputs.connectionString
    keyVaultName: kv.outputs.name
  }
}

module swa 'modules/swa.bicep' = {
  name: 'swa'
  params: { swaLocation: swaLocation, swaName: swaName }
}

// Grant Function App MI 'Key Vault Secrets User' on the vault
resource kvRef 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: kv.outputs.name
}
var secretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
resource kvRoleAssign 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kvRef
  name: guid(kv.outputs.id, functions.outputs.principalId, secretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsUserRoleId)
    principalId: functions.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultName string = kv.outputs.name
output sqlServerFqdn string = sql.outputs.serverFqdn
output sqlServerName string = sql.outputs.serverName
output functionAppName string = functions.outputs.name
output functionDefaultHostName string = functions.outputs.defaultHostName
output swaName string = swa.outputs.name
output swaHostname string = swa.outputs.defaultHostname
output acsName string = acs.outputs.acsName
output storageAccountName string = storage.outputs.name
```

- [ ] **Step 2: Lint/build the Bicep**

Run:
```bash
az bicep build --file infra/main.bicep
```
Expected: exits 0, no errors (warnings about listKeys are acceptable).

- [ ] **Step 3: Commit**

```bash
git add infra/main.bicep
git commit -m "infra: add main bicep orchestration with KV RBAC for function MI"
```

### Task 7: Validate the deployment with what-if

**Files:** none

- [ ] **Step 1: Generate secrets in-memory and run what-if**

Run (PowerShell — does NOT persist secrets to disk):
```powershell
$sqlpw = -join ((48..57)+(65..90)+(97..122)+(33,35,37,42) | Get-Random -Count 24 | ForEach-Object {[char]$_})
$jwt = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
az deployment group what-if `
  --resource-group rg-bootcamp-feedback `
  --template-file infra/main.bicep `
  --parameters infra/main.bicepparam `
  --parameters sqlAdminPassword=$sqlpw
```
(`$jwt` is not a Bicep parameter — it is generated here only for the Key Vault `JWT-SECRET` secret written in Task 8.)
Expected: what-if prints a set of resources to **Create** (storage, sql server+db, kv, function app+plan, swa, acs, email domain, app insights, workspace, role assignment) and no errors. Keep this PowerShell session open for Task 8 (reuses `$sqlpw`/`$jwt`).

---

## Phase 2 — Provision & seed secrets

### Task 8: Deploy infrastructure and store secrets in Key Vault

**Files:** none

- [ ] **Step 1: Deploy the Bicep** (same PowerShell session as Task 7)

Run:
```powershell
$env:SQL_ADMIN_PASSWORD = $sqlpw   # main.bicepparam reads this via readEnvironmentVariable
$dep = az deployment group create `
  --resource-group rg-bootcamp-feedback `
  --name catbootcamp-prod `
  --template-file infra/main.bicep `
  --parameters infra/main.bicepparam `
  --query properties.outputs -o json | ConvertFrom-Json
$dep | ConvertTo-Json
```
Expected: completes with `provisioningState=Succeeded`; `$dep` contains `keyVaultName`, `sqlServerFqdn`, `functionAppName`, `swaHostname`, `acsName`, `storageAccountName`.

- [ ] **Step 2: Grant yourself Key Vault Secrets Officer (to write secrets)**

Run:
```powershell
$me = az ad signed-in-user show --query id -o tsv
$kvid = az keyvault show -n $dep.keyVaultName.value --query id -o tsv
az role assignment create --assignee $me --role "Key Vault Secrets Officer" --scope $kvid
Start-Sleep -Seconds 30  # allow RBAC propagation
```
Expected: role assignment created.

- [ ] **Step 3: Write secrets to Key Vault (values never written to disk)**

Run:
```powershell
$kv = $dep.keyVaultName.value
az keyvault secret set --vault-name $kv --name SQL-SERVER   --value $dep.sqlServerFqdn.value | Out-Null
az keyvault secret set --vault-name $kv --name SQL-DATABASE --value "CATBootcampFeedback" | Out-Null
az keyvault secret set --vault-name $kv --name SQL-USER     --value "sqladmin" | Out-Null
az keyvault secret set --vault-name $kv --name SQL-PASSWORD --value $sqlpw | Out-Null
az keyvault secret set --vault-name $kv --name JWT-SECRET   --value $jwt | Out-Null
$acsConn = az communication list-key --name $dep.acsName.value --resource-group rg-bootcamp-feedback --query primaryConnectionString -o tsv
az keyvault secret set --vault-name $kv --name ACS-CONNECTION-STRING --value $acsConn | Out-Null
Write-Host "Secrets written:"; az keyvault secret list --vault-name $kv --query "[].name" -o tsv
```
Expected: lists `ACS-CONNECTION-STRING JWT-SECRET SQL-DATABASE SQL-PASSWORD SQL-SERVER SQL-USER`. (After this step, clear the session vars: `Remove-Variable sqlpw,jwt,acsConn`.)

- [ ] **Step 4: Restart Function App so KV references resolve**

Run:
```bash
az functionapp restart -n catbootcamp-feedback-api -g rg-bootcamp-feedback
```
Expected: no error.

### Task 9: Verify provisioning and Key Vault reference resolution

**Files:** none

- [ ] **Step 1: List resources in the RG**

Run:
```bash
az resource list -g rg-bootcamp-feedback --query "[].{name:name, type:type}" -o table
```
Expected: storage, SQL server + database, key vault, function app + plan, static web app, communication service, email service (+domain), app insights, log analytics workspace.

- [ ] **Step 2: Verify Key Vault references resolved (no errors)**

Run:
```bash
az functionapp config appsettings list -n catbootcamp-feedback-api -g rg-bootcamp-feedback --query "[?name=='SQL_PASSWORD' || name=='ACS_CONNECTION_STRING'].{n:name,v:value}" -o table
```
Then in the Portal (or `az rest`) confirm the app setting reference status shows "Resolved". Expected: SQL_PASSWORD shows the KV reference string; runtime resolves it (verified via health check in Phase 5).

---

## Phase 3 — Application code & CI/CD

### Task 10: Add new-prod hostname routing to config.js

**Files:**
- Modify: `config.js` (the `if (typeof window !== 'undefined')` block, ~lines 102-117)

- [ ] **Step 1: Capture the SWA hostname token**

Run:
```bash
az staticwebapp show -n swa-catbootcamp-feedback -g rg-bootcamp-feedback --query defaultHostname -o tsv
```
Expected: e.g. `<word>-<word>-<hex>.<n>.azurestaticapps.net`. Note the leading `<word>-<word>-<hex>` token (call it `SWA_TOKEN`).

- [ ] **Step 2: Add a production branch BEFORE the QA branch**

In `config.js`, insert this block immediately after the `isCustomDomain` declaration and before `const isQAHostname`:

```javascript
    // New production environment (rg-bootcamp-feedback)
    const isBootcampProdHostname = window.location.hostname.includes('SWA_TOKEN');
    if (isBootcampProdHostname) {
        CONFIG.USE_MOCK_DATA = false;
        CONFIG.API_BASE_URL = 'https://catbootcamp-feedback-api.azurewebsites.net/api';
        console.log('Environment: PRODUCTION (bootcamp-feedback)');
    } else if (isQAHostname) {
```

Replace `SWA_TOKEN` with the real token from Step 1, and note the `else if (isQAHostname)` merges into the existing chain (delete the now-duplicate `if (isQAHostname) {` line it replaces).

- [ ] **Step 3: Sanity-check the file parses**

Run:
```bash
node --check config.js
```
Expected: no output (valid JS).

- [ ] **Step 4: Commit**

```bash
git add config.js
git commit -m "config: route new production SWA hostname to prod API"
```

### Task 11: Harden .gitignore and add gitleaks secret-scan gate

**Files:**
- Modify: `.gitignore`
- Create: `.github/workflows/secret-scan.yml`

- [ ] **Step 1: Append patterns to .gitignore**

Append:
```
# Secrets / deploy artifacts — never commit
*.bacpac
*.publishsettings
*.publishprofile
*.bicepparam.local
.env
token.txt
profile.xml
```

- [ ] **Step 2: Add gitleaks workflow**

```yaml
name: Secret Scan
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Run gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore .github/workflows/secret-scan.yml
git commit -m "ci: gitignore secret artifacts and add gitleaks scan gate"
```

### Task 12: Add production auto-deploy workflows

**Files:**
- Create: `.github/workflows/deploy-prod-swa.yml`
- Create: `.github/workflows/deploy-prod-functions.yml`

- [ ] **Step 1: deploy-prod-swa.yml**

```yaml
name: Deploy Production Frontend (bootcamp-feedback)
on:
  push:
    branches: [ main ]
  workflow_dispatch:
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    name: Deploy to Production Static Web App
    steps:
      - uses: actions/checkout@v4
        with: { submodules: true, lfs: false }
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_NEWPROD }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: ""
          output_location: ""
```

- [ ] **Step 2: deploy-prod-functions.yml**

```yaml
name: Deploy Production API (bootcamp-feedback)
on:
  push:
    branches: [ main ]
    paths: [ 'api/**' ]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy API to Production Function App
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Install Azure Functions Core Tools
        run: npm install -g azure-functions-core-tools@4 --unsafe-perm true
      - name: Install dependencies
        run: cd api && npm install --production
      - name: Azure Login
        uses: Azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS_NEWPROD }}
      - name: Deploy to Azure Functions
        run: cd api && func azure functionapp publish catbootcamp-feedback-api --javascript
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-prod-swa.yml .github/workflows/deploy-prod-functions.yml
git commit -m "ci: add push-to-main auto-deploy workflows for new production"
```

### Task 13: Create GitHub secrets (no values in repo)

**Files:** none

- [ ] **Step 1: Ensure gh is authenticated to the repo**

Run:
```bash
gh auth status || gh auth login
gh repo set-default microsoft/CATBootcampFeedback
```
Expected: authenticated; default repo set. (If `gh auth login` is needed, the user runs `! gh auth login` in the session.)

- [ ] **Step 2: Create a deploy service principal scoped to the RG**

Run (PowerShell):
```powershell
$creds = az ad sp create-for-rbac --name "sp-catbootcamp-feedback-deploy" --role contributor `
  --scopes /subscriptions/d922eeb1-ad31-4f25-89cf-1042176de302/resourceGroups/rg-bootcamp-feedback `
  --sdk-auth
$creds | gh secret set AZURE_CREDENTIALS_NEWPROD --repo microsoft/CATBootcampFeedback
Remove-Variable creds
```
Expected: `✓ Set secret AZURE_CREDENTIALS_NEWPROD`.

- [ ] **Step 3: Set the SWA deploy token secret**

Run:
```bash
az staticwebapp secrets list --name swa-catbootcamp-feedback --query "properties.apiKey" -o tsv \
  | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_NEWPROD --repo microsoft/CATBootcampFeedback
```
Expected: `✓ Set secret AZURE_STATIC_WEB_APPS_API_TOKEN_NEWPROD`.

- [ ] **Step 4: Verify secrets exist (names only)**

Run:
```bash
gh secret list --repo microsoft/CATBootcampFeedback | grep -E "NEWPROD"
```
Expected: both `AZURE_CREDENTIALS_NEWPROD` and `AZURE_STATIC_WEB_APPS_API_TOKEN_NEWPROD` listed.

---

## Phase 4 — Remediate existing committed leak

### Task 14: Remove plaintext credentials from repo files

**Files:**
- Modify: `scripts/provision-production.sh:15`
- Modify: `scripts/create-prod-functions.sh:21`
- Modify: `SECURE_DOCUMENTATION_NOTICE.md:101`

- [ ] **Step 1: Replace hardcoded SQL password in provision-production.sh**

Change line 15 from the hardcoded literal to:
```bash
SQL_ADMIN_PASSWORD="${SQL_ADMIN_PASSWORD:?Set SQL_ADMIN_PASSWORD env var; do not hardcode}"
```

- [ ] **Step 2: Replace hardcoded SQL password in create-prod-functions.sh**

Change line 21 from the hardcoded literal to:
```bash
SQL_ADMIN_PASSWORD="${SQL_ADMIN_PASSWORD:?Set SQL_ADMIN_PASSWORD env var; do not hardcode}"
```

- [ ] **Step 3: Redact the password in SECURE_DOCUMENTATION_NOTICE.md**

Change line 101 to:
```
Password: [REDACTED - stored in Azure Key Vault; rotated 2026-06-11]
```

- [ ] **Step 4: Verify no plaintext secrets remain**

Run:
```bash
grep -rEn 'SQL_ADMIN_PASSWORD="[^$"]' --include='*.sh' . || echo "CLEAN: no hardcoded SQL passwords found"
```
Expected: `CLEAN: no known plaintext secrets found`.

- [ ] **Step 5: Commit**

```bash
git add scripts/provision-production.sh scripts/create-prod-functions.sh SECURE_DOCUMENTATION_NOTICE.md
git commit -m "security: remove hardcoded credentials from repo files"
```

- [ ] **Step 6: Rotate the legacy credentials (manual, if legacy env still owned)**

Action: In the legacy subscription (`a64ee975-1813-434c-9ea3-942b382b6cb0`), reset the SQL admin password on the affected server(s) and any account using the now-removed legacy plaintext password, so the leaked values become worthless. Record completion in `docs/database-migration-strategy.md` change log. If legacy env is not accessible, note that in the PR description.

---

## Phase 5 — Initial deploy & smoke test (target tenant)

### Task 15: Open PR and trigger auto-deploy

**Files:** none

- [ ] **Step 1: Push branch and open PR**

Run:
```bash
git push -u origin prod-deploy/rg-bootcamp-feedback
gh pr create --repo microsoft/CATBootcampFeedback --base main --title "Production deployment to rg-bootcamp-feedback" --body "Provisions secure production env, adds auto-deploy workflows, removes committed secrets. See docs/superpowers/plans/2026-06-11-production-deployment-rg-bootcamp-feedback.md"
```
Expected: PR URL printed.

- [ ] **Step 2: After merge to main, confirm workflows run**

Run:
```bash
gh run list --repo microsoft/CATBootcampFeedback --limit 5
```
Expected: "Deploy Production Frontend" and "Deploy Production API" runs triggered and succeed.

- [ ] **Step 3: Smoke-test frontend + API health**

Run:
```bash
SWA=$(az staticwebapp show -n swa-catbootcamp-feedback -g rg-bootcamp-feedback --query defaultHostname -o tsv)
curl -s -o /dev/null -w "frontend:%{http_code}\n" "https://$SWA"
curl -s -o /dev/null -w "api-health:%{http_code}\n" "https://catbootcamp-feedback-api.azurewebsites.net/api/health"
```
Expected: `frontend:200`. `api-health` may be `200` if the health endpoint doesn't query tables, or `500` until Phase 6 populates the DB — note which; full functionality verified after Phase 6.

---

## Phase 6 — Data migration (QA → prod, cross-tenant)

> Requires authenticating to the **QA tenant** (different from target). The user performs the interactive QA login via `! az login --tenant <QA_TENANT>`.

### Task 16: Export QA database to BACPAC

**Files:** none

- [ ] **Step 1: Authenticate to QA tenant and select QA subscription**

Run (user runs the login interactively):
```bash
az login --tenant <QA_TENANT_DOMAIN_OR_ID>
az account set --subscription <QA_SUBSCRIPTION_ID>
az account show --query "{name:name,sub:id,tenant:tenantId}" -o json
```
Expected: active sub is the QA subscription. (Capture QA SQL server name `cat-bootcamp-sql-qa2`, RG `cat-bootcamp-qa-rg`, DB `CATBootcampFeedback-QA`.)

- [ ] **Step 2: Add current client IP to QA SQL firewall**

Run:
```bash
MYIP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create -g cat-bootcamp-qa-rg -s cat-bootcamp-sql-qa2 -n tmp-export-ip --start-ip-address $MYIP --end-ip-address $MYIP
```
Expected: rule created.

- [ ] **Step 3: Export the QA DB to a BACPAC in QA storage**

Run (PowerShell — prompt for QA SQL admin password, do not hardcode):
```powershell
$qapw = Read-Host -AsSecureString "QA SQL admin password"
$qapwPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($qapw))
$qaStorage = az storage account list -g cat-bootcamp-qa-rg --query "[0].name" -o tsv
az storage container create --account-name $qaStorage --name bacpac --auth-mode login | Out-Null
$qaKey = az storage account keys list -g cat-bootcamp-qa-rg -n $qaStorage --query "[0].value" -o tsv
az sql db export -g cat-bootcamp-qa-rg -s cat-bootcamp-sql-qa2 -n CATBootcampFeedback-QA `
  --admin-user sqladmin --admin-password $qapwPlain `
  --storage-key-type StorageAccessKey --storage-key $qaKey `
  --storage-uri "https://$qaStorage.blob.core.windows.net/bacpac/catbootcamp-qa-2026-06-11.bacpac"
```
Expected: export completes (can take several minutes for Basic tier).

- [ ] **Step 4: Download the BACPAC locally (transient)**

Run:
```bash
az storage blob download --account-name $qaStorage --account-key "$qaKey" -c bacpac -n catbootcamp-qa-2026-06-11.bacpac -f ./catbootcamp-qa-2026-06-11.bacpac
```
Expected: local file present (it is gitignored via `*.bacpac`).

- [ ] **Step 5: Remove the temporary QA firewall rule**

Run:
```bash
az sql server firewall-rule delete -g cat-bootcamp-qa-rg -s cat-bootcamp-sql-qa2 -n tmp-export-ip
```
Expected: deleted.

### Task 17: Import BACPAC into the new production database

**Files:** none

- [ ] **Step 1: Switch back to the target subscription**

Run:
```bash
az account set --subscription d922eeb1-ad31-4f25-89cf-1042176de302
az account show --query id -o tsv
```
Expected: `d922eeb1-ad31-4f25-89cf-1042176de302`.

- [ ] **Step 2: Upload the BACPAC to prod storage**

Run (PowerShell):
```powershell
$prodStorage = az storage account list -g rg-bootcamp-feedback --query "[?starts_with(name,'stcatbootcampfb')].name | [0]" -o tsv
$prodKey = az storage account keys list -g rg-bootcamp-feedback -n $prodStorage --query "[0].value" -o tsv
az storage container create --account-name $prodStorage --name bacpac --account-key $prodKey | Out-Null
az storage blob upload --account-name $prodStorage --account-key $prodKey -c bacpac `
  -n catbootcamp-qa-2026-06-11.bacpac -f ./catbootcamp-qa-2026-06-11.bacpac
```
Expected: upload succeeds.

- [ ] **Step 3: Drop the empty prod DB and import the BACPAC into a fresh one**

> `az sql db import` requires the target DB to exist OR creates per parameters; the Bicep already created an empty `CATBootcampFeedback`. To import cleanly, delete then import (import recreates).

Run (PowerShell — reuse the prod SQL admin password from Key Vault):
```powershell
$kv = az keyvault list -g rg-bootcamp-feedback --query "[?starts_with(name,'kv-catbootcamp-fb')].name | [0]" -o tsv
$prodSqlServer = az sql server list -g rg-bootcamp-feedback --query "[0].name" -o tsv
$prodPw = az keyvault secret show --vault-name $kv --name SQL-PASSWORD --query value -o tsv
az sql db delete -g rg-bootcamp-feedback -s $prodSqlServer -n CATBootcampFeedback --yes
az sql db import -g rg-bootcamp-feedback -s $prodSqlServer -n CATBootcampFeedback `
  --admin-user sqladmin --admin-password $prodPw `
  --storage-key-type StorageAccessKey --storage-key $prodKey `
  --storage-uri "https://$prodStorage.blob.core.windows.net/bacpac/catbootcamp-qa-2026-06-11.bacpac"
Remove-Variable prodPw
```
Expected: import completes; DB `CATBootcampFeedback` recreated with QA schema + data.

### Task 18: Validate migrated data and clean up

**Files:** none

- [ ] **Step 1: Add your IP to prod SQL firewall and verify object/row counts**

Run (PowerShell):
```powershell
$myip = (curl -s https://api.ipify.org)
az sql server firewall-rule create -g rg-bootcamp-feedback -s $prodSqlServer -n tmp-verify-ip --start-ip-address $myip --end-ip-address $myip
$prodPw = az keyvault secret show --vault-name $kv --name SQL-PASSWORD --query value -o tsv
$q = "SELECT (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE') AS Tables, (SELECT COUNT(*) FROM INFORMATION_SCHEMA.VIEWS) AS Views, (SELECT COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE='PROCEDURE') AS Procs, (SELECT COUNT(*) FROM Events) AS Events, (SELECT COUNT(*) FROM Feedback) AS Feedback, (SELECT COUNT(*) FROM Users) AS Users;"
sqlcmd -S "$prodSqlServer.database.windows.net" -d CATBootcampFeedback -U sqladmin -P $prodPw -Q $q
Remove-Variable prodPw
```
Expected: `Tables=9, Views=4, Procs=2`, and Events/Feedback/Users counts matching QA. (If `sqlcmd` is unavailable, run the query in the Portal Query Editor.)

- [ ] **Step 2: Remove the temporary prod firewall rule**

Run:
```bash
az sql server firewall-rule delete -g rg-bootcamp-feedback -s $prodSqlServer -n tmp-verify-ip
```
Expected: deleted.

- [ ] **Step 3: Delete BACPAC artifacts (local + both storage containers)**

Run (PowerShell):
```powershell
Remove-Item ./catbootcamp-qa-2026-06-11.bacpac -ErrorAction SilentlyContinue
az storage blob delete --account-name $prodStorage --account-key $prodKey -c bacpac -n catbootcamp-qa-2026-06-11.bacpac
# (Optionally delete the QA-side blob after switching back to QA sub.)
```
Expected: artifacts removed.

- [ ] **Step 4: Restart Function App and confirm it reads the populated DB**

Run:
```bash
az functionapp restart -n catbootcamp-feedback-api -g rg-bootcamp-feedback
sleep 30
curl -s -o /dev/null -w "api-health:%{http_code}\n" "https://catbootcamp-feedback-api.azurewebsites.net/api/health"
curl -s -w "\nevents:%{http_code}\n" "https://catbootcamp-feedback-api.azurewebsites.net/api/events" | tail -2
```
Expected: `api-health:200`; `/api/events` returns `200` with the migrated events JSON.

---

## Phase 7 — Final end-to-end validation

### Task 19: Full production validation

**Files:** none

- [ ] **Step 1: Run the repo's production validator (adapt URLs)**

Run:
```powershell
pwsh scripts/validate-production.ps1
```
If the script hardcodes old URLs, pass/override the new SWA + API URLs, or perform the manual checklist below.

- [ ] **Step 2: Manual end-to-end checklist**

Verify in a browser at `https://<new-SWA-hostname>`:
- [ ] Frontend loads; console shows `Environment: PRODUCTION (bootcamp-feedback)`
- [ ] No CORS errors
- [ ] Admin login works (existing migrated admin credentials)
- [ ] Events / Modules / Feedback / Analytics / Speakers / Templates tabs display migrated data
- [ ] Can submit feedback; new row appears

- [ ] **Step 3: Confirm CORS allows the new SWA origin**

If the API rejects the SWA origin, add it to the Function App CORS allowed origins:
```bash
az functionapp cors add -n catbootcamp-feedback-api -g rg-bootcamp-feedback --allowed-origins "https://<new-SWA-hostname>"
```
Expected: subsequent browser calls succeed.

- [ ] **Step 4: Record completion**

Append a row to the change log in `docs/database-migration-strategy.md` noting the production cutover date, source (QA), and verified counts. Commit.

---

## Self-review notes (coverage vs. spec)

- Bicep IaC for all resources → Tasks 1-8 ✓
- Zero secrets in repo (KV refs, generated secrets to KV, GH secrets, gitignore, gitleaks) → Tasks 1,7,8,11,13 ✓
- Full QA→prod data copy via BACPAC → Tasks 16-18 ✓
- Push-to-main auto-deploy mirroring QA → Tasks 12-13,15 ✓
- config.js hostname routing fix → Task 10 ✓
- ACS email + App Insights → Tasks 2,4,6,8 ✓
- Existing leak remediation (rotate+remove, no history rewrite) → Task 14 ✓
- Out of scope (custom domain, legacy decommission, history rewrite) → respected ✓

## Execution prerequisites & risks

- `az` must be on the target subscription (Phase 0). Phase 6 requires QA-tenant login (user-interactive).
- `gh auth login` required before Task 13 (user-interactive if not already authenticated).
- RBAC propagation delays (Key Vault role assignments) — the plan includes sleeps; re-run a step if a transient `Forbidden` occurs.
- ACS Azure-managed domain provisioning can take a few minutes; if `az communication list-key` fails immediately after deploy, retry.
- SWA region forced to `eastus2` (eastus unsupported for SWA).
