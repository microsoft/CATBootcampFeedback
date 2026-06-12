param swaLocation string
param swaName string

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: swaLocation
  sku: { name: 'Standard', tier: 'Standard' }
  identity: { type: 'SystemAssigned' }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

output defaultHostname string = swa.properties.defaultHostname
output name string = swa.name
output principalId string = swa.identity.principalId
