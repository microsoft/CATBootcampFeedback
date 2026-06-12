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
