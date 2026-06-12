using './main.bicep'

param location = 'eastus'
param computeLocation = 'eastus2'
param swaLocation = 'eastus2'
param baseName = 'catbootcamp-fb'
param swaName = 'swa-catbootcamp-feedback'
param sqlDatabaseName = 'CATBootcampFeedback'
param sqlAdminUser = 'sqladmin'
param acsDataLocation = 'United States'
// Secret read from the environment at deploy time — never stored in the repo.
// Set $env:SQL_ADMIN_PASSWORD before running what-if / deploy.
param sqlAdminPassword = readEnvironmentVariable('SQL_ADMIN_PASSWORD')
