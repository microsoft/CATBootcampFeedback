# Domain Registration: catbootcampfeedback.com

## Purchase Domain via Azure Portal

Since the Azure CLI `appservice domain` command has issues on Windows PowerShell, please complete the domain registration through the Azure Portal:

### Step 1: Purchase Domain

1. **Navigate to Azure Portal**
   - Go to https://portal.azure.com
   - Search for "App Service Domains" in the top search bar

2. **Create New Domain**
   - Click "+ Create" or "+ Add"
   - Enter domain name: **catbootcampfeedback.com**
   - Select subscription: **(your current subscription)**
   - Resource group: **cat-bootcamp-prod-rg**

3. **Contact Information**
   - Fill in your contact details:
     - Name: Dewain Robinson
     - Organization: Microsoft
     - Email: dewainr@microsoft.com
     - Phone: +1.4258828080
     - Address: One Microsoft Way, Redmond, WA 98052, US

4. **Privacy Protection**
   - ✅ Enable WHOIS privacy protection (Recommended)

5. **Auto-renewal**
   - ✅ Enable auto-renewal (Recommended)

6. **Pricing**
   - **Cost**: $11.99 USD/year
   - Review and accept terms

7. **Review + Create**
   - Review all settings
   - Click "Create" to purchase

**Note**: Domain registration may take 5-15 minutes to complete.

## Step 2: Configure Domain for Static Web App

Once the domain is registered and shows as "Active" in the portal:

### Via Azure Portal

1. **Navigate to Static Web App**
   - Portal → Search "Static Web Apps"
   - Select: **cat-bootcamp-feedback-prod**

2. **Add Custom Domain**
   - Left menu → "Custom domains"
   - Click "+ Add" → "Custom domain on other DNS"

3. **Enter Domain**
   - Domain name: **catbootcampfeedback.com**
   - Click "Next"

4. **DNS Configuration**
   - Azure will display DNS records to add
   - **CNAME Record:**
     - Name: `@` or `catbootcampfeedback.com`
     - Value: `lively-ocean-076d52c0f.2.azurestaticapps.net`
   - **TXT Record** (for validation):
     - Name: `_dnsauth`
     - Value: [shown by Azure]

5. **Add DNS Records to Domain**
   - Portal → Search "App Service Domains"
   - Select: **catbootcampfeedback.com**
   - Left menu → "Manage DNS records"
   - Add the CNAME and TXT records shown by Static Web App

6. **Validate Domain**
   - Return to Static Web App custom domains page
   - Click "Validate"
   - Wait for validation (may take 5-60 minutes)

7. **Wait for SSL Certificate**
   - Azure automatically provisions SSL certificate
   - Certificate issuance: 5 minutes to 24 hours
   - Status will change to "Ready" when complete

### Via Azure CLI (After Portal Registration)

```bash
# Add custom domain to Static Web App
az staticwebapp hostname set \
  --name cat-bootcamp-feedback-prod \
  --resource-group cat-bootcamp-prod-rg \
  --hostname catbootcampfeedback.com

# Check status
az staticwebapp hostname show \
  --name cat-bootcamp-feedback-prod \
  --resource-group cat-bootcamp-prod-rg \
  --hostname catbootcampfeedback.com
```

## Step 3: Update Application Configuration

After domain is active and SSL certificate issued:

### Update config.js

Edit `config.js` (around line 95):

```javascript
// Get production hostnames
const PROD_HOSTNAME = 'lively-ocean-076d52c0f.2.azurestaticapps.net';
const CUSTOM_DOMAIN = 'catbootcampfeedback.com';

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

### Deploy Changes

```bash
git add config.js
git commit -m "feat: add catbootcampfeedback.com custom domain support"
git push origin main

# Trigger production deployment
gh workflow run "Deploy to Production" --field confirmation="deploy-to-production"
```

## Step 4: Update Functions CORS

Add custom domain to API CORS:

```bash
az functionapp cors add \
  --name cat-bootcamp-api-prod \
  --resource-group cat-bootcamp-prod-rg \
  --allowed-origins "https://catbootcampfeedback.com"

# Verify CORS settings
az functionapp cors show \
  --name cat-bootcamp-api-prod \
  --resource-group cat-bootcamp-prod-rg
```

Expected origins:
- https://portal.azure.com
- https://lively-ocean-076d52c0f.2.azurestaticapps.net
- https://catbootcampfeedback.com

## Step 5: Test Custom Domain

### Test DNS Resolution
```bash
nslookup catbootcampfeedback.com
```

Should return IP for Azure Static Web App

### Test HTTPS Access
```bash
curl -I https://catbootcampfeedback.com/
```

Expected: `200 OK` with valid SSL

### Test Application
1. Open https://catbootcampfeedback.com in browser
2. Open browser console (F12)
3. Verify:
   - ✅ Page loads without errors
   - ✅ Console shows "Environment: PRODUCTION"
   - ✅ No CORS errors
   - ✅ SSL certificate is valid (lock icon in address bar)

## Verification Checklist

- [ ] Domain purchased and shows as "Active" in portal
- [ ] Custom domain added to Static Web App
- [ ] DNS records configured (CNAME + TXT)
- [ ] Domain validation completed
- [ ] SSL certificate issued (status: "Ready")
- [ ] config.js updated with custom domain
- [ ] Changes deployed to production
- [ ] Functions CORS includes custom domain
- [ ] https://catbootcampfeedback.com resolves correctly
- [ ] Application loads without errors
- [ ] API calls work without CORS issues
- [ ] Browser console shows correct environment

## Troubleshooting

### Domain Validation Stuck
- Verify DNS records are exactly as shown by Azure
- Check DNS propagation: https://www.whatsmydns.net/
- Wait up to 48 hours for full propagation
- If still failing, remove and re-add custom domain

### SSL Certificate Not Issued
- Ensure TXT validation record is correct
- Wait 24-48 hours
- Check Azure Portal for certificate status
- Contact Azure support if persists

### CORS Errors
- Verify custom domain in Functions CORS list
- Clear browser cache
- Test in incognito mode
- Check exact domain spelling (with/without www)

## Post-Configuration

### Update Documentation
- [ ] Update README.md with new production URL
- [ ] Update deployment documentation
- [ ] Notify team of new production URL
- [ ] Update any external links or bookmarks

### Monitoring
- Set up Application Insights alerts for custom domain
- Monitor SSL certificate expiration (auto-renews via Azure)
- Check domain auto-renewal settings

## Cost Summary

**Domain Registration**: $11.99 USD/year
- First year: $11.99
- Renewal (auto): $11.99/year
- Privacy protection: Included
- SSL certificate: Free (via Azure)
- DNS hosting: Included

**Total Annual Cost**: $11.99 USD

## Support Resources

- [Azure App Service Domains Documentation](https://learn.microsoft.com/en-us/azure/app-service/manage-custom-dns-buy-domain)
- [Azure Static Web Apps Custom Domains](https://learn.microsoft.com/en-us/azure/static-web-apps/custom-domain)
- [Domain Registration Support](https://azure.microsoft.com/support/legal/domain-registration/)

---

**Next Steps After This Guide:**
1. Complete domain registration via Azure Portal (Step 1)
2. Configure domain for Static Web App (Step 2)
3. Update application code (Step 3)
4. Update CORS (Step 4)
5. Test thoroughly (Step 5)
