# Production Deployment to `rg-bootcamp-feedback` — Design

**Date:** 2026-06-11
**Author:** dewainr@microsoft.com
**Status:** Approved design — implementation plan to follow

## Goal

Stand up a brand-new **production** instance of CATBootcampFeedback in a fresh Azure
resource group, migrate **all** data from the existing QA environment (including the
SQL database contents), and wire **push-to-`main` auto-deploy** that mirrors how QA
deploys today — all while ensuring **no secrets are ever committed to the repo**.

## Target environment

| Property | Value |
|---|---|
| Tenant | `copilotstudiotraining.onmicrosoft.com` |
| Subscription | `d922eeb1-ad31-4f25-89cf-1042176de302` |
| Resource group | `rg-bootcamp-feedback` (already exists) |
| Region | Match the RG's region (confirm at execution; expect East US 2 to match QA) |

This is a **new production home** in a different tenant/subscription from the legacy
`cat-bootcamp-rg` / `cat-bootcamp-qa-rg` / `cat-bootcamp-prod-rg` environments described
in `docs/infrastructure/production-architecture.md`.

## Source of truth (QA)

The QA environment, which auto-deploys on push to `main` today:

- Static Web App: `ashy-rock-0b254600f`
- Function App: `catbootcamp-api-qa` (`catbootcamp-api-qa.azurewebsites.net`)
- SQL Server / DB: `cat-bootcamp-sql-qa2` / `CATBootcampFeedback-QA`
- Key Vault: `cat-bootcamp-kv-qa`

## Application architecture (what we are deploying)

| Layer | Technology | Source |
|---|---|---|
| Frontend | Static HTML/JS/CSS | repo root |
| API | Azure Functions, Node 20, JavaScript (20 functions) | `api/` |
| Database | Azure SQL Database (mssql driver) | `database-init-v2.sql` + `migrations/` |
| Secrets | Azure Key Vault (Key Vault references in Function App) | — |
| Email | Azure Communication Services | connection string in Key Vault |
| Storage | Storage Account (Functions runtime) | — |
| Monitoring | Application Insights | — |

## 1. Target resource inventory (all in `rg-bootcamp-feedback`)

| Resource | Type / SKU | Proposed name |
|---|---|---|
| Static Web App | SWA (Standard) | `swa-catbootcamp-feedback` |
| Function App | Functions, Node 20, Consumption (Linux, Y1) | `catbootcamp-feedback-api` |
| Storage Account | StorageV2 LRS | `stcatbootcampfb<uniq>` |
| SQL Server | Azure SQL logical server | `sql-catbootcamp-fb-<uniq>` |
| SQL Database | Basic (matches QA) | `CATBootcampFeedback` |
| Key Vault | Standard | `kv-catbootcamp-fb` |
| Application Insights | workspace-based | `appi-catbootcamp-feedback` |
| Communication Services | ACS + Email + Azure-managed domain | `acs-catbootcamp-feedback` |

`<uniq>` = `uniqueString(resourceGroup().id)` for globally-unique names. Final names
validated for length/charset and global uniqueness at execution.

## 2. Infrastructure as Code (Bicep)

New `infra/` folder in the repo:

```
infra/
  main.bicep              # resourceGroup-scoped orchestration
  main.bicepparam         # names, region, SKUs — NO SECRETS
  modules/
    storage.bicep
    sql.bicep
    keyvault.bicep
    functions.bicep       # incl. system-assigned identity + KV-reference app settings
    swa.bicep
    monitoring.bicep      # App Insights (+ Log Analytics workspace)
    acs.bicep             # Communication Services + Email + managed domain
```

Wiring done in Bicep:
- Function App gets a **system-assigned managed identity**; Key Vault grants it `get`/`list` on secrets (RBAC or access policy).
- Function App settings use **Key Vault references** only — same pattern as QA/dev.
- SQL firewall: allow Azure services; a temporary client-IP rule is added during data import and removed afterward.
- Parameters file holds only non-secret values. Secret parameters (`sqlAdminPassword`, `jwtSecret`) are generated at deploy time and passed in-memory; never committed.

App settings on the Function App (values are KV references, not secrets):

```
SQL_SERVER=@Microsoft.KeyVault(VaultName=kv-catbootcamp-fb;SecretName=SQL-SERVER)
SQL_DATABASE=@Microsoft.KeyVault(VaultName=kv-catbootcamp-fb;SecretName=SQL-DATABASE)
SQL_USER=@Microsoft.KeyVault(VaultName=kv-catbootcamp-fb;SecretName=SQL-USER)
SQL_PASSWORD=@Microsoft.KeyVault(VaultName=kv-catbootcamp-fb;SecretName=SQL-PASSWORD)
JWT_SECRET=@Microsoft.KeyVault(VaultName=kv-catbootcamp-fb;SecretName=JWT-SECRET)
AZURE_COMM_CONNECTION_STRING=@Microsoft.KeyVault(VaultName=kv-catbootcamp-fb;SecretName=ACS-CONNECTION-STRING)
NODE_ENV=production
FUNCTIONS_WORKER_RUNTIME=node
WEBSITE_NODE_DEFAULT_VERSION=~20
APPLICATIONINSIGHTS_CONNECTION_STRING=<from App Insights resource>
```

## 3. Data migration (QA → new prod, full copy)

Approach: **BACPAC export → import** (captures schema + data + views + stored procs in
one artifact; works cross-tenant).

1. Add executing client IP to the **QA** SQL server firewall.
2. `az sql db export` QA `CATBootcampFeedback-QA` → BACPAC in a QA storage container (private, short-lived SAS).
3. Download the BACPAC, upload to the new prod storage account (private container).
4. `az sql db import` the BACPAC into the new prod `CATBootcampFeedback`.
5. Validate against QA: expect **9 tables, 4 views, 2 stored procedures**; compare row
   counts for `Events`, `Modules`, `EventModules`, `Feedback`, `Users`, `Roles`,
   `UserRoles`, `UserEventAccess`, `AuditLog`.
6. Confirm any repo `migrations/` are already reflected in the imported DB (should be; verified).
7. **Delete** the BACPAC from both storage containers; remove temporary SQL firewall rules.

Notes:
- All data carries over, including admin user rows and password **hashes** — admin logins
  continue to work.
- A **fresh** `JWT_SECRET` is generated for prod (stored only in Key Vault); this simply
  invalidates any pre-existing sessions, which is desirable for a new prod.

## 4. Auto-deploy CI/CD (mirror QA: push-to-`main`)

In `microsoft/CATBootcampFeedback` (admin access confirmed), add two workflows:

- `.github/workflows/deploy-prod-swa.yml` — on push to `main`: `Azure/static-web-apps-deploy@v1` using `AZURE_STATIC_WEB_APPS_API_TOKEN_NEWPROD`.
- `.github/workflows/deploy-prod-functions.yml` — on push to `main` affecting `api/**`: deploy to `catbootcamp-feedback-api` (Core Tools `func ... publish`, mirroring the QA functions workflow).

New **GitHub encrypted secrets** (never in repo):
- `AZURE_STATIC_WEB_APPS_API_TOKEN_NEWPROD` — new SWA deploy token
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE_NEWPROD` — new Function App publish profile (or `AZURE_CREDENTIALS_NEWPROD` SP scoped to the new RG if using `Azure/login` + Core Tools)

Publish profile / SWA token are tenant-agnostic, so cross-tenant deploy from the
Microsoft-tenant repo to the `copilotstudiotraining` tenant works without federated identity.

### Required code change — `config.js`

`config.js` routes API calls by hostname; any `*.azurestaticapps.net` host that doesn't
match the known QA/prod patterns currently **falls through to the DEVELOPMENT API**. We
must add a branch mapping the new SWA hostname → the new prod API:

```javascript
const isNewProdHostname = window.location.hostname.includes('<new-swa-hostname-token>');
if (isNewProdHostname) {
    CONFIG.USE_MOCK_DATA = false;
    CONFIG.API_BASE_URL = 'https://catbootcamp-feedback-api.azurewebsites.net/api';
    console.log('Environment: PRODUCTION (bootcamp-feedback)');
}
```

The exact hostname token is captured after the SWA is created.

## 5. Security requirements (HARD constraint)

**Zero secret material in the repo, ever.**

- Committed Bicep/`.bicepparam` contain only names, regions, SKUs.
- SQL admin password and `JWT_SECRET` generated at provision time, written **straight to Key Vault**, never to a file or log.
- Function App settings contain only Key Vault **references** (pointers), not secrets.
- All real secrets (SQL creds, JWT, ACS connection string) live **only in Key Vault**.
- Deploy tokens / publish profiles / SP creds live **only in GitHub encrypted secrets**.
- Data-migration BACPAC stored in **private** containers via short-lived SAS, **deleted** after import; storage keys/SAS never committed.
- `.gitignore` hardened: `*.bacpac`, `*.publishsettings`, `*.publishprofile`, `*.bicepparam.local`, `.env`, `token.txt`, `profile.xml`.
- CI guardrail: add a **gitleaks** secret-scan gate (extends existing `security-scan.yml`) so any future committed secret fails the build.

### Remediation of the existing committed leak (in scope)

The repo currently contains live plaintext credentials:
- SQL admin password in `scripts/create-prod-functions.sh` and `scripts/provision-production.sh`
- A plaintext prod password in `SECURE_DOCUMENTATION_NOTICE.md`

Scope of remediation (decided: **rotate + remove**):
1. Remove the plaintext values from those files (replace with KV-reference / placeholder guidance).
2. Rotate the corresponding credentials in the legacy environment if still owned, so the leaked values become worthless.
3. Git **history rewrite is out of scope** (disruptive on a shared repo) — rotation neutralizes the exposure.

## 6. Sequencing & cutover

1. **Auth & verify:** `az login --tenant copilotstudiotraining.onmicrosoft.com`; confirm access to the QA subscription; `gh auth login`. Confirm RG region and that `rg-bootcamp-feedback` is empty.
2. **Provision** via Bicep → all resources created.
3. **Seed Key Vault** secrets (generated SQL password, JWT secret, ACS connection string); confirm Function App KV references resolve.
4. **Data migration** (section 3) → prod DB populated and validated.
5. **Code + CI:** update `config.js`; add the two workflows; set GitHub secrets.
6. **Deploy:** push to `main` → auto-deploy fires → frontend + API live.
7. **Validate:** adapt `scripts/validate-production.ps1`; check `/api/health`, admin login, data present, no console/CORS errors.
8. **Security remediation** (section 5) committed alongside.

## Out of scope

- Custom domain configuration (placeholder only).
- Decommissioning the legacy `cat-bootcamp-prod-rg`.
- Git-history rewrite of the legacy leak (rotation handles exposure).
- Ongoing password-rotation policy/automation (note recommended cadence only).

## Open items confirmed at execution time

- RG region and emptiness of `rg-bootcamp-feedback`.
- Exact QA subscription ID and SQL server FQDN for the export.
- Final globally-unique resource names (SQL server, storage, Key Vault).
- New SWA default hostname token for the `config.js` branch.
