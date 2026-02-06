# Custom Domain Setup for Production

## Prerequisites
- Custom domain registered (e.g., catbootcamp.example.com)
- Access to domain DNS management
- Azure Static Web App in Standard tier (already configured: cat-bootcamp-feedback-prod)

## Overview

This guide walks through configuring a custom domain for the production CAT Bootcamp Feedback application. The default production URL is:
- **Current**: https://lively-ocean-076d52c0f.2.azurestaticapps.net
- **Target**: https://catbootcamp.yourdomain.com (replace with your actual domain)

## Step 1: Add Custom Domain to Static Web App

```bash
az staticwebapp hostname set \
  --name cat-bootcamp-feedback-prod \
  --resource-group cat-bootcamp-prod-rg \
  --hostname catbootcamp.example.com
```

Replace `catbootcamp.example.com` with your actual custom domain.

## Step 2: Get DNS Validation Information

```bash
az staticwebapp hostname show \
  --name cat-bootcamp-feedback-prod \
  --resource-group cat-bootcamp-prod-rg \
  --hostname catbootcamp.example.com
```

This command outputs the DNS records you need to add to your domain registrar.

**Example Output:**
```json
{
  "hostname": "catbootcamp.example.com",
  "validationToken": "1234567890abcdef...",
  "domainName": "lively-ocean-076d52c0f.2.azurestaticapps.net"
}
```

## Step 3: Add DNS Records

Log in to your domain registrar's DNS management portal and add the following records:

### CNAME Record (for domain resolution)
- **Type:** CNAME
- **Name:** catbootcamp (or @ for root domain, or www for www subdomain)
- **Value:** lively-ocean-076d52c0f.2.azurestaticapps.net
- **TTL:** 3600 (or your registrar's default)

### TXT Record (for domain validation)
- **Type:** TXT
- **Name:** _dnsauth.catbootcamp (or _dnsauth for root domain)
- **Value:** [validation token from step 2 output]
- **TTL:** 3600 (or your registrar's default)

**Important Notes:**
- If using a root domain (example.com), some registrars require ALIAS or ANAME records instead of CNAME
- The TXT record name must start with `_dnsauth.`
- Keep the validation token - you may need it if re-validating

## Step 4: Wait for DNS Propagation

DNS changes can take anywhere from 5 minutes to 48 hours to propagate globally.

**Check DNS propagation:**
```bash
# Check if CNAME is propagated
nslookup catbootcamp.example.com

# Use online tools for global propagation
# Visit: https://www.whatsmydns.net/
```

**Verify SSL certificate status:**
```bash
az staticwebapp hostname show \
  --name cat-bootcamp-feedback-prod \
  --resource-group cat-bootcamp-prod-rg \
  --hostname catbootcamp.example.com \
  --query "status"
```

Expected status progression:
- **Validating**: DNS records being verified
- **Ready**: Domain is configured and SSL certificate issued

## Step 5: Update Frontend Configuration

After the custom domain is active and SSL certificate is issued, update `config.js` to recognize the custom domain:

**Edit:** `config.js` (around line 95)

```javascript
// Get production Static Web App hostname
const PROD_HOSTNAME = 'lively-ocean-076d52c0f.2.azurestaticapps.net';
const CUSTOM_DOMAIN = 'catbootcamp.example.com'; // Your custom domain

if (window.location.hostname === PROD_HOSTNAME ||
    window.location.hostname === CUSTOM_DOMAIN) {
    // Production environment
    CONFIG.USE_MOCK_DATA = false;
    CONFIG.API_BASE_URL = 'https://cat-bootcamp-api-prod.azurewebsites.net/api';
    console.log('Environment: PRODUCTION');
} else if (isProduction || isAzure) {
    // Development environment
    CONFIG.USE_MOCK_DATA = false;
    CONFIG.API_BASE_URL = 'https://cat-bootcamp-api.azurewebsites.net/api';
    console.log('Environment: DEVELOPMENT');
}
```

**Commit and deploy:**
```bash
git add config.js
git commit -m "feat: add custom domain support to production config"
git push origin main

# Trigger production deployment
gh workflow run "Deploy to Production" --field confirmation="deploy-to-production"
```

## Step 6: Update Functions CORS

Add the custom domain to the Functions App CORS allowed origins:

```bash
az functionapp cors add \
  --name cat-bootcamp-api-prod \
  --resource-group cat-bootcamp-prod-rg \
  --allowed-origins "https://catbootcamp.example.com"
```

**Verify CORS settings:**
```bash
az functionapp cors show \
  --name cat-bootcamp-api-prod \
  --resource-group cat-bootcamp-prod-rg
```

Expected output should include:
- https://portal.azure.com
- https://lively-ocean-076d52c0f.2.azurestaticapps.net
- https://catbootcamp.example.com

## Step 7: Test Custom Domain

### Test HTTPS Access
```bash
curl -I https://catbootcamp.example.com/
```

Expected: `200 OK` with valid SSL certificate

### Test Frontend Load
```bash
curl -s https://catbootcamp.example.com/ | grep -i "CAT Bootcamp"
```

Expected: HTML content with application title

### Test API Connectivity
Open browser console on your custom domain and verify:
1. No CORS errors
2. API calls to `https://cat-bootcamp-api-prod.azurewebsites.net/api` succeed
3. Console shows: "Environment: PRODUCTION"

## Troubleshooting

### DNS Not Propagating
**Symptoms:**
- Domain not resolving
- "DNS_PROBE_FINISHED_NXDOMAIN" error

**Solutions:**
- Use https://www.whatsmydns.net/ to check global propagation
- Verify DNS records in your registrar's portal
- Wait 24-48 hours for full propagation
- Clear browser DNS cache:
  - Chrome: `chrome://net-internals/#dns` → Clear host cache
  - Firefox: Restart browser
  - Windows: `ipconfig /flushdns`
  - macOS: `sudo dscacheutil -flushcache`

### SSL Certificate Not Issued
**Symptoms:**
- Domain validation status stuck on "Validating"
- HTTPS not working after 24 hours

**Solutions:**
- Verify TXT record is exactly as provided by Azure
- Ensure TXT record name starts with `_dnsauth.`
- Check Azure Portal → Static Web Apps → Custom domains for validation status
- If validation fails after 48 hours, remove and re-add the custom domain
- Contact Azure support if issue persists

### CORS Errors with Custom Domain
**Symptoms:**
- Browser console shows CORS errors
- API calls failing with "No 'Access-Control-Allow-Origin' header"

**Solutions:**
- Verify custom domain is in Functions CORS list (Step 6)
- Check exact domain spelling (include/exclude www if applicable)
- Ensure HTTPS is used (not HTTP)
- Clear browser cache and cookies
- Test in incognito/private browsing mode

### Mixed Content Warnings
**Symptoms:**
- Browser shows "Not Secure" icon
- Console warnings about mixed content

**Solutions:**
- Ensure all resources (images, scripts, API calls) use HTTPS
- Check config.js API_BASE_URL is using HTTPS
- Verify Static Web App hostname binding uses HTTPS only

### Custom Domain Shows Old Content
**Symptoms:**
- Custom domain shows outdated version of site
- Changes not reflected after deployment

**Solutions:**
- Clear browser cache (Ctrl+Shift+Delete)
- Use incognito/private mode to test
- Wait for CDN cache to expire (usually 5-15 minutes)
- Force refresh with Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

## Post-Configuration Checklist

After custom domain is configured and tested:

- [ ] Custom domain resolves to Static Web App
- [ ] HTTPS certificate is valid and issued by Azure
- [ ] Frontend loads without errors
- [ ] API calls work without CORS errors
- [ ] Console shows "Environment: PRODUCTION"
- [ ] All interactive features work (form submission, data loading, etc.)
- [ ] Database connectivity is verified
- [ ] DNS records are documented
- [ ] Custom domain added to deployment documentation
- [ ] Team members notified of new production URL

## Rollback Procedure

If issues arise with the custom domain:

1. **Temporarily revert to default URL:**
   - Users can access: https://lively-ocean-076d52c0f.2.azurestaticapps.net
   - All functionality will work normally

2. **Remove custom domain binding:**
   ```bash
   az staticwebapp hostname delete \
     --name cat-bootcamp-feedback-prod \
     --resource-group cat-bootcamp-prod-rg \
     --hostname catbootcamp.example.com
   ```

3. **Remove DNS records:**
   - Delete CNAME record from domain registrar
   - Delete TXT validation record
   - Wait for DNS propagation (1-48 hours)

4. **Update documentation:**
   - Document the issue encountered
   - Update team on status and timeline

## Security Considerations

- **SSL/TLS**: Azure automatically provisions and manages SSL certificates via Let's Encrypt
- **Certificate Renewal**: Automatic - no manual intervention required
- **HTTPS Enforcement**: Azure Static Web Apps enforces HTTPS by default
- **CORS Configuration**: Only allow specific origins, never use "*" in production
- **Domain Validation**: Keep validation tokens secure and don't share publicly

## Cost Implications

- **Custom Domains**: Free on Azure Static Web Apps Standard tier (already configured)
- **SSL Certificates**: Free (Let's Encrypt via Azure)
- **DNS Hosting**: Depends on domain registrar (typically $0-2/month)
- **No Additional Azure Costs**: Custom domain feature is included in Standard tier

## Additional Resources

- [Azure Static Web Apps Custom Domains Documentation](https://learn.microsoft.com/en-us/azure/static-web-apps/custom-domain)
- [DNS Record Types Explained](https://www.cloudflare.com/learning/dns/dns-records/)
- [SSL/TLS Certificate Management](https://learn.microsoft.com/en-us/azure/static-web-apps/custom-domain-external)
- [CORS Configuration Best Practices](https://learn.microsoft.com/en-us/azure/azure-functions/functions-how-to-use-azure-function-app-settings)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Azure Portal logs and diagnostics
3. Consult Azure Static Web Apps documentation
4. Contact Azure Support for platform-level issues
5. Review deployment logs in GitHub Actions
