targetScope = 'resourceGroup'

param location string
param computeLocation string
param swaLocation string
param baseName string
param swaName string
param sqlDatabaseName string
param sqlAdminUser string
param acsDataLocation string
@secure()
param sqlAdminPassword string

var uniq = take(uniqueString(resourceGroup().id), 6)
var sqlServerName = 'sql-${baseName}-${uniq}'
var storageAccountName = take(toLower(replace('st${baseName}${uniq}', '-', '')), 24)
var keyVaultName = 'kv-${baseName}-${uniq}'

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    storageAccountName: storageAccountName
  }
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
  params: {
    location: location
    keyVaultName: keyVaultName
    tenantId: tenant().tenantId
  }
}

module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    location: computeLocation
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

// Static Web App hosts both the frontend and the API (managed functions).
module swa 'modules/swa.bicep' = {
  name: 'swa'
  params: {
    swaLocation: swaLocation
    swaName: swaName
  }
}

// Grant the SWA managed identity 'Key Vault Secrets User' so its managed
// functions can resolve Key Vault references in application settings.
module kvRole 'modules/kv-role.bicep' = {
  name: 'kvRole'
  params: {
    keyVaultName: kv.outputs.name
    principalId: swa.outputs.principalId
  }
}

output keyVaultName string = kv.outputs.name
output appInsightsConnectionString string = monitoring.outputs.connectionString
output sqlServerFqdn string = sql.outputs.serverFqdn
output sqlServerName string = sql.outputs.serverName
output swaName string = swa.outputs.name
output swaHostname string = swa.outputs.defaultHostname
output swaPrincipalId string = swa.outputs.principalId
output acsName string = acs.outputs.acsName
output storageAccountName string = storage.outputs.name
