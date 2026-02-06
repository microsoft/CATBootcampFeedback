# GitHub Secrets Configuration

## Development Secrets
- AZURE_STATIC_WEB_APPS_API_TOKEN_BLUE_MOSS_01913F80F - Dev Static Web App deployment token
- AZURE_FUNCTIONAPP_PUBLISH_PROFILE - Dev Functions App publish profile

## Production Secrets
- AZURE_STATIC_WEB_APPS_API_TOKEN_PROD - Prod Static Web App deployment token
- AZURE_FUNCTIONAPP_PUBLISH_PROFILE_PROD - Prod Functions App publish profile
- PROD_SQL_PASSWORD - Production database password (for migrations)

## Security Notes
- Never commit these values to version control
- Rotate deployment tokens if compromised
- SQL password should be rotated every 90 days
- Only authorized team members should have access to secrets

## How to Update Secrets

### Update Static Web App Token
```bash
# Get new token from Azure Portal or CLI
az staticwebapp secrets list --name <app-name> --query "properties.apiKey" -o tsv > token.txt

# Update secret
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_PROD < token.txt

# Clean up
rm token.txt
```

### Update Functions App Publish Profile
```bash
# Download new publish profile
az functionapp deployment list-publishing-profiles --name <app-name> --resource-group <rg-name> --xml > profile.xml

# Update secret
gh secret set AZURE_FUNCTIONAPP_PUBLISH_PROFILE_PROD < profile.xml

# Clean up
rm profile.xml
```

### Update SQL Password
```bash
# Set new password
echo 'new-password' | gh secret set PROD_SQL_PASSWORD
```

## Verification
To verify all secrets are configured:
```bash
gh secret list
```

## Troubleshooting
If deployment fails due to secret issues:
1. Verify the secret name matches exactly what the workflow expects
2. Check the secret was set recently (check timestamp in `gh secret list`)
3. Re-download the credential from Azure and update the secret
4. Ensure there are no trailing spaces or newlines in the secret value
