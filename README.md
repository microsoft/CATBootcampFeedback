# CAT Bootcamp Feedback Application

A comprehensive web-based feedback collection system for CAT Bootcamp modules with admin management, QR code generation, and live feedback counting.

## Overview

This application provides a complete solution for collecting and managing feedback on training modules. It consists of three main components:

1. **Public Feedback Form** - Module-specific feedback collection via QR codes
2. **Admin Interface** - Manage events, modules, view feedback, and generate QR codes
3. **Live Count Display** - Real-time feedback submission count for presenters
4. **User Management & RBAC** - Role-based access control with 6 roles and audit logging

## System Architecture

```
┌─────────────────────────────────┐
│   Azure Static Web App          │
│   (Frontend Hosting)             │
│   - feedback.html                │
│   - admin.html                   │
│   - count.html                   │
└─────────────────────────────────┘
            │
            │ HTTPS/CORS
            ↓
┌─────────────────────────────────┐
│  Azure Functions App             │
│  (Separate Backend)              │
│  - Full custom routing support   │
│  - Node.js 20 runtime            │
│  - RESTful API endpoints         │
└─────────────────────────────────┘
            │
            ↓
┌─────────────────────────────────┐
│    Azure SQL Database            │
│    - Events table                │
│    - Modules table               │
│    - EventModules table          │
│    - Feedback table              │
│    - Users table                 │
│    - Roles table                 │
│    - UserRoles table             │
│    - UserEventAccess table       │
│    - AuditLog table              │
└─────────────────────────────────┘
```

### Why Separate Azure Functions App?

Azure Static Web Apps' managed functions have **limited support for custom routes** with path parameters. To enable full RESTful routing (e.g., `/api/events/{code}/modules/{id}`), we use a separate Azure Functions app with complete routing flexibility.

## Features

### Public Feedback Form (feedback.html)

#### Access Method
- Each module has a unique URL: `feedback.html?code=EVENT_CODE&module=MODULE_ID`
- QR codes generated in admin panel contain these URLs
- Module information auto-loaded from parameters

#### Collected Data
- ✅ **Speaker Knowledge** (1-5 scale) - Required
- ✅ **Content Depth** (Too Technical / Just Right / Too Low Level) - Required
- ✅ **Module Satisfaction** (1-5 scale) - Required
- ✅ **Additional Comments** (up to 1000 characters) - Optional

### Admin Interface (admin.html)

#### Event & Module Management
- Create events with multiple modules
- Manage module deliveries and speakers
- Activate/deactivate events
- Reorder modules within events
- **Delete events** - Single or bulk deletion with confirmation
- **Delete modules** - Single or bulk deletion with confirmation
- Search and filter

#### QR Code Generation
- Individual QR code for each module
- Downloadable as PNG
- Includes full feedback URL with event code and module ID
- Optimized for mobile scanning
- Quick access to live counter for tracking submissions in real-time

#### Feedback Viewing & Analytics
- **Advanced filtering** by Event, Module, Speaker, and Rating
- **Flexible sorting** by Date, Rating, Module, Speaker, or Event
- View all submissions with multi-criteria filtering
- Export filtered results to CSV
- **Delete feedback** - Single or bulk deletion with confirmation
- **Analytics dashboard** with filterable statistics by Event, Module, and Speaker
- Real-time feedback counts

#### User Management & RBAC
- **6 roles:** GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer
- **People & Permissions tab** for managing users
- **Resource-level security** — users only see events they have access to
- Profile image upload
- Password reset and forgot password/username flows
- Protected Global Admin account (cannot be deleted or demoted)

#### Audit Log
- Comprehensive logging of all authenticated actions
- Expandable detail view for each log entry
- Search, filter by action/resource/user, and date range
- CSV export
- Visible only to GlobalAdmin

### Live Count Display (count.html)

- **Dual theme system** — selectable from the footer:
  - **Classic** (default): Progress ring counter with confetti celebrations
  - **Feed the Cat**: Cute cartoon cat progresses through 6 stages as feedback grows — from a skinny hungry cat (0%) to an extremely full cat on the couch (100%). Includes food drop animation, "nom nom" munching sound, progress bar, and milestone bounce animation
- **Theme persistence** — selected theme saved to sessionStorage across page refreshes
- **Real-time feedback count** with configurable auto-refresh (5, 10, 15, or 30 seconds; default: 5 seconds)
- **3 Celebration Levels** — selectable from the footer:
  - **Chill** (default): Small confetti burst + floating cat emoji + gentle chime
  - **Party**: Medium confetti + cat parade + duck waddling across screen + screen glow + fanfare
  - **Chaos**: Massive confetti + cat army + duck squad + bonus emojis + screen shake + wild sounds
- **Fireworks at milestones** (10, 25, 50, 75, 100, 150, 200, 300, 500) — scaled by celebration level
- **Cat-themed encouragement messages** — each theme has its own rotating puns displayed in large, room-readable font
- **Cat-themed milestone messages** — celebratory cat puns at each threshold
- **Sound effects** — toggle on/off from footer; Classic theme uses chimes, fanfares, and firework sounds; Feed the Cat theme uses "nom nom" munching sounds
- **Module or Event view modes:**
  - Module-specific: Stats for a single module delivery
  - Event-level: Aggregate stats across all modules in an event
- **Configurable refresh interval** - Select update frequency from dropdown (default: 5 seconds)
- **Fullscreen mode** for projection during presentations — all celebration visuals (confetti, glow, sound banner) render correctly inside fullscreen
- **Visual indicators** for live update status
- **QR code display** for easy attendee access (fireworks constrained to left panel to keep QR scannable)

## Database Schema (V2 - Many-to-Many)

The application uses a many-to-many relationship between Events and Modules:

```sql
-- Events can have multiple modules
Events (EventId, EventCode, EventName, StartDate, EndDate, ...)

-- Reusable modules
Modules (ModuleId, ModuleName, Description, IsActive, ...)

-- Module deliveries within specific events
EventModules (EventModuleId, EventId, ModuleId, SpeakerName, DeliveryOrder, ...)

-- Feedback tied to specific module deliveries
Feedback (FeedbackId, EventModuleId, EventCode, SpeakerKnowledge, ...)

-- User Management (RBAC)
Users (UserId, Username, PasswordHash, FullName, Email, IsProtected, ProfileImage, ...)
Roles (RoleId, RoleName, Description, IsSystem)
UserRoles (UserRoleId, UserId, RoleId, ...)
UserEventAccess (UserEventAccessId, UserId, EventId, ...)

-- Audit Logging
AuditLog (AuditLogId, UserId, Username, Action, ResourceType, ResourceId, Summary, Details, IpAddress, Timestamp)
```

See `DATABASE-REFERENCE.md` for complete schema.

## API Endpoints

### Base URL
```
Production: https://cat-bootcamp-api.azurewebsites.net/api
Local Dev:  http://localhost:7071/api
```

### Public Endpoints (No Auth Required)

```
GET  /api/events                              # List all events with modules
GET  /api/events/{code}/modules               # Get modules for event
POST /api/feedback                            # Submit feedback
```

### Admin Endpoints (Authentication Required)

```
POST   /api/login                             # Admin authentication
GET    /api/modules                           # List all modules
POST   /api/modules                           # Create module
PUT    /api/modules/{id}                      # Update module
GET    /api/events                            # List events (admin view)
POST   /api/events                            # Create event
PUT    /api/events/{id}                       # Update event
POST   /api/event-modules                     # Add module to event
DELETE /api/event-modules/{id}                # Remove module from event
GET    /api/feedback/all                      # Get all feedback (admin)

# User Management (GlobalAdmin/UserAdmin)
GET    /api/users                              # List all users
POST   /api/users                              # Create user
GET    /api/users/{id}                         # Get user details
PUT    /api/users/{id}                         # Update user
DELETE /api/users/{id}                         # Delete user
POST   /api/users/{id}/roles                   # Assign role
DELETE /api/users/{id}/roles/{roleId}          # Remove role
GET    /api/users/{id}/events                  # List event access
POST   /api/users/{id}/events                  # Grant event access
DELETE /api/users/{id}/events/{eventId}        # Revoke event access
PUT    /api/users/{id}/avatar                  # Upload profile image
GET    /api/roles                              # List available roles

# Self-Service (Any authenticated user)
GET    /api/users/me                           # Get own profile
PUT    /api/users/me                           # Update own profile
PUT    /api/users/me/password                  # Change own password

# Password Recovery (Public, rate-limited)
POST   /api/password-reset/request             # Request password reset
POST   /api/username-recovery                  # Recover username by email

# Audit Log (GlobalAdmin only)
GET    /api/audit-log                          # Query audit logs

# Notifications (via Azure Communication Services)
POST   /api/notify/welcome                     # Send welcome email via ACS
```

## Deployment

### Prerequisites
- Azure subscription
- GitHub account
- Node.js 20+ installed locally
- Azure CLI installed
- Azure Functions Core Tools installed

### Environments

#### Development Environment
- **Resource Group:** `cat-bootcamp-rg`
- **Frontend:** `https://blue-moss-01913f80f.1.azurestaticapps.net`
- **API:** `https://cat-bootcamp-api.azurewebsites.net`
- **Database:** `cat-bootcamp-sql-89082.database.windows.net/CATBootcampFeedback`
- **Deployment:** Auto-deploy from `main` branch push

#### Production Environment
- **Resource Group:** `cat-bootcamp-prod-rg`
- **Frontend:** `https://cat-bootcamp-feedback.azurestaticapps.net`
- **API:** `https://cat-bootcamp-api-prod.azurewebsites.net`
- **Database:** `cat-bootcamp-sql-prod.database.windows.net/CATBootcampFeedback-Prod`
- **Deployment:** Manual workflow dispatch with approval

### Frontend Deployment (Azure Static Web Apps)

#### Development
- URL: `https://blue-moss-01913f80f.1.azurestaticapps.net`
- Auto-deploys from GitHub `main` branch
- Workflow: `.github/workflows/azure-static-web-apps-blue-moss-01913f80f.yml`

#### Production
- URL: `https://cat-bootcamp-feedback.azurestaticapps.net`
- Manual deployment with approval gate
- Workflow: `.github/workflows/deploy-production.yml`

**To deploy to production:**
1. Go to GitHub Actions tab
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Select `main` branch
5. Click "Run workflow"
6. Wait for approval from designated approvers
7. Once approved, deployment proceeds automatically

### Backend Deployment (Azure Functions App)

#### Development
- Functions App: `cat-bootcamp-api`
- URL: `https://cat-bootcamp-api.azurewebsites.net`
- Runtime: Node.js 20, Linux Consumption Plan
- Database: `cat-bootcamp-sql-89082.database.windows.net`

#### Production
- Functions App: `cat-bootcamp-api-prod`
- URL: `https://cat-bootcamp-api-prod.azurewebsites.net`
- Runtime: Node.js 20, Linux Consumption Plan
- Database: `cat-bootcamp-sql-prod.database.windows.net`

#### Deploy Functions Manually

**Development:**
```bash
cd api
npm install
func azure functionapp publish cat-bootcamp-api --javascript
```

**Production:**
```bash
cd api
npm install
func azure functionapp publish cat-bootcamp-api-prod --javascript
```

#### Deploy via GitHub Actions

Production deployment is automated through the "Deploy to Production" workflow:
- Frontend and API deploy together
- Requires manual approval before deployment
- Uses environment-specific configurations
- Validates health endpoints after deployment

### Configuration

#### Development Frontend Config (`config.js`)
```javascript
API_BASE_URL: 'https://cat-bootcamp-api.azurewebsites.net/api'
```

#### Production Frontend Config (`config.prod.js`)
```javascript
API_BASE_URL: 'https://cat-bootcamp-api-prod.azurewebsites.net/api'
```

#### Development Backend Settings (Azure Portal)
```
SQL_SERVER=cat-bootcamp-sql-89082.database.windows.net
SQL_DATABASE=CATBootcampFeedback
SQL_USER=sqladmin
SQL_PASSWORD=*** (configured in Azure)
NODE_ENV=development
```

#### Production Backend Settings (Azure Portal)
```
SQL_SERVER=cat-bootcamp-sql-prod.database.windows.net
SQL_DATABASE=CATBootcampFeedback-Prod
SQL_USER=sqladmin
SQL_PASSWORD=*** (configured in Azure)
NODE_ENV=production
```

### 🔐 Azure Key Vault Integration

The application uses **Azure Key Vault** to securely store sensitive configuration values like JWT secrets.

#### Key Vault Resources

**Development:**
- Key Vault: `cat-bootcamp-kv-dev`
- Function App: `cat-bootcamp-api`
- Secret: `JWT-SECRET` (development value)

**Production:**
- Key Vault: `cat-bootcamp-kv-prod`
- Function App: `cat-bootcamp-api-prod`
- Secret: `JWT-SECRET` (production value)

#### Setup Key Vault

Run the provisioning script to create and configure Key Vault:

**Linux/macOS:**
```bash
cd scripts
chmod +x provision-keyvault.sh
./provision-keyvault.sh
```

**Windows PowerShell:**
```powershell
cd scripts
.\provision-keyvault.ps1
```

The script will:
1. Create Azure Key Vault instances for dev and prod
2. Store JWT secrets securely in Key Vault
3. Enable managed identities on Function Apps
4. Grant Function Apps access to Key Vault
5. Configure Function Apps to use Key Vault references

#### How It Works

Azure Functions automatically resolves Key Vault references at runtime:

```
JWT_SECRET=@Microsoft.KeyVault(SecretUri=https://cat-bootcamp-kv-prod.vault.azure.net/secrets/JWT-SECRET)
```

No code changes required - the application reads from `process.env.JWT_SECRET` as usual, and Azure transparently fetches the value from Key Vault.

#### Security Benefits

- ✅ **Encryption at Rest** - All secrets encrypted in Key Vault
- ✅ **Managed Identities** - No credentials stored in code or config
- ✅ **Least Privilege** - Function Apps only have `get` and `list` permissions
- ✅ **Audit Logs** - All secret access logged in Azure Monitor
- ✅ **Separate Secrets** - Dev and prod environments fully isolated

See [`scripts/README.md`](scripts/README.md) for complete Key Vault documentation.

### Database Initialization

See [`docs/database-migration-strategy.md`](docs/database-migration-strategy.md) for complete database setup and migration procedures.

**Initialize Production Database:**
1. Navigate to Azure Portal → CATBootcampFeedback-Prod database
2. Open Query editor (preview)
3. Login with sqladmin credentials
4. Run `database-init-PORTAL-ALL-IN-ONE.sql`

**Restore Dev Sample Data:**
1. Navigate to Azure Portal → CATBootcampFeedback database
2. Open Query editor (preview)
3. Login with sqladmin credentials
4. Run `restore-dev-sample-data-v2.sql`

## Development Setup

### Local Frontend Development

```bash
# Serve frontend files
npx http-server

# Or use Python
python -m http.server 8000

# Access at http://localhost:8000
```

Frontend will use mock data when running on localhost.

### Local Backend Development

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Navigate to api folder
cd api
npm install

# Create local.settings.json with database credentials
# (See api/local.settings.json.example)

# Start Functions locally
func start

# Functions available at http://localhost:7071/api
```

Update `config.js` to point to local backend:
```javascript
API_BASE_URL: 'http://localhost:7071/api'
```

## Typical Workflow

### For Admins

1. **Before Event**
   - Log into admin panel
   - Create event with modules
   - Download QR codes for each module
   - Test feedback URLs

2. **During Each Module**
   - Display QR code or share link for attendees
   - Open live counter on second screen (click "📊 Live Counter" in admin)
   - Monitor real-time statistics:
     - Live feedback count
     - Average satisfaction and speaker knowledge ratings
     - Content depth distribution
   - Use fullscreen mode for better visibility during presentation

3. **After Event**
   - Review all feedback
   - Export data to CSV
   - Analyze results
   - Share with speakers

### For Attendees

1. Scan module-specific QR code
2. Verify event and module information
3. Answer required questions
4. Submit feedback
5. See confirmation

## Troubleshooting

### Feedback Form Shows Error

**Error: "allEvents.find is not a function"**
- API response structure issue
- Check `config.js` points to correct API URL
- Verify Functions app is running

**Error: "Unable to Load Feedback Form"**
- Invalid event code or module ID
- Event or module may be inactive
- Check admin panel to verify module exists

### Admin Panel Issues

**Cannot Login**
- Demo credentials: `admin` / `[REDACTED - See Desktop/Secure_CAT_Files/CREDENTIALS_MASTER.md]`
- Check that Functions app is accessible
- Verify CORS is configured correctly
- **Note:** Actual credentials stored in secure location, not in repository

**QR Codes Not Generating**
- Check browser console for errors
- Ensure QRCode.js library loaded
- Verify internet connection

### Deployment Issues

**Functions Not Deploying**
- Run `func azure functionapp publish cat-bootcamp-api --javascript`
- Check for syntax errors in function code
- Verify all dependencies in package.json

**CORS Errors**
- Add Static Web App URL to Functions app CORS settings:
  ```bash
  az functionapp cors add --name cat-bootcamp-api \
    --resource-group cat-bootcamp-rg \
    --allowed-origins "https://blue-moss-01913f80f.1.azurestaticapps.net"
  ```

## Project Structure

```
feedbackapp/
├── api/                          # Azure Functions backend
│   ├── GetEvents/               # List events endpoint
│   ├── GetEventModules/         # List modules for event
│   ├── SubmitFeedback/          # Submit feedback endpoint
│   ├── Login/                   # Admin authentication
│   ├── src/functions/
│   │   ├── users.js              # User CRUD, roles, event access
│   │   ├── password.js           # Password change/reset/recovery
│   │   ├── audit-log.js          # Audit log query API
│   │   ├── notifications.js      # Welcome email notifications (Azure Communication Services)
│   │   └── ...
│   ├── src/shared/              # Shared utilities
│   │   ├── auth.js               # JWT auth + RBAC middleware
│   │   ├── permissions.js        # Centralized permission logic
│   │   ├── audit.js              # Audit logging helper
│   │   ├── database.js          # SQL connection
│   │   └── utils.js             # Helper functions
│   ├── host.json                # Functions runtime config
│   └── package.json             # Node dependencies
├── migrations/
│   ├── 002-add-user-management.sql
│   ├── 003-add-profile-image.sql
│   ├── 004-add-audit-log.sql
│   └── 005-widen-event-code.sql
├── scripts/
│   └── migrate-users-from-env.js # Migrate users from env var to DB
├── feedback.html                # Public feedback form
├── feedback.js                  # Feedback form logic
├── admin.html                   # Admin interface
├── admin.js                     # Admin functionality
├── count.html                   # Live analytics dashboard (Classic + Feed the Cat themes)
├── count.js                     # Real-time analytics, count logic, and theme management
├── cat-stage-*.png              # Cat mascot images for Feed the Cat theme (6 stages: 0–100%)
├── config.js                    # Centralized configuration
├── api.js                       # API client with retry logic and token expiry handling
├── styles.css                   # Shared styling
├── staticwebapp.config.json     # Static Web App config
├── README.md                    # This file
└── DATABASE-REFERENCE.md        # Complete database schema
```

## Key Files

- **`config.js`** - Central configuration (API URLs, validation rules)
- **`api.js`** - API client with error handling, retry logic, and auto-redirect on token expiry
- **`staticwebapp.config.json`** - Routing, CORS, security headers
- **`api/host.json`** - Azure Functions runtime settings
- **`api/src/shared/database.js`** - SQL connection and query helper
- **`api/src/shared/utils.js`** - Response formatters and validation
- **`PRIVACY.md`** - Privacy policy and data collection details
- **`api/src/shared/permissions.js`** - RBAC permission definitions and helpers
- **`api/src/shared/audit.js`** - Audit logging for all authenticated actions
- **`api/src/functions/users.js`** - User management API (CRUD, roles, access)

## Privacy & Security

### 🔒 Privacy-First Design

**No Personally Identifiable Information (PII) Collected**

This application is designed with privacy as a core principle:
- ❌ **No names, emails, or contact information** collected
- ❌ **No IP addresses or device identifiers** stored
- ❌ **No user tracking or analytics cookies** used
- ✅ **100% anonymous feedback** - responses cannot be traced to individuals
- ✅ **Privacy notice** displayed on feedback form

**For complete privacy details, see:** [`PRIVACY.md`](PRIVACY.md)

### Public Endpoints
- Event code validation prevents unauthorized access
- Input sanitization on all fields
- Rate limiting recommended
- Anonymous feedback only

### Admin Endpoints
- **JWT Authentication** required (bcrypt + HS256)
- **Azure Key Vault** stores JWT secrets securely
- Managed identities for Key Vault access (no credentials in code)
- **Role-based access control (RBAC)** with 6 granular roles
- **Resource-level security filtering** — users only see events/feedback they have access to
- **Comprehensive audit logging** of all admin actions
- **Per-email rate limiting** on password/username recovery
- **Protected Global Admin account** (cannot be deleted or demoted)
- Session tokens with 8-hour expiration (auto-redirect to login on expiry)
- HTTPS enforced
- CORS configured for Static Web App only

### Database
- Parameterized queries (SQL injection prevention)
- Azure SQL firewall rules
- Encrypted connections (TLS)
- Encryption at rest enabled
- Regular automated backups
- No PII stored in any table

## Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Modern mobile browsers
- ❌ IE11 (not supported)

## Version History

**Version 5.1** (Apr 2, 2026)
- **Feed the Cat Counter Theme**
- New "Feed the Cat" theme for the live counter page with a cartoon cat that progresses through 6 stages (0%, 10%, 25%, 50%, 75%, 100%) as feedback count grows
- Theme selector in footer to switch between Classic (progress ring) and Feed the Cat
- Each theme has its own encouraging messages and sound effects
- "Nom nom" munching sound, food drop animation, progress bar, and milestone cat bounce animation
- Cat images fill available vertical space via responsive flex layout
- Theme choice persists via sessionStorage
- **Auto-redirect on token expiry** — expired JWT sessions now automatically clear and redirect to login instead of showing broken admin panel
- **Fullscreen celebration fix** — confetti, screen glow, and sound banner now render correctly inside fullscreen mode

**Version 5.0** (Mar 29, 2026)
- **RBAC User Management System**
- 6 roles with granular permissions: GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer
- Database-backed user accounts replacing ADMIN_USERS_JSON environment variable
- Resource-level security — users only see events/feedback they have access to
- Protected Global Admin account (cannot be deleted or demoted)
- People & Permissions UI with card-based user management
- Self-service profile editing (name, email, photo, password)
- Auto-generated passwords with override option for new users
- Welcome email notifications with login details (sent via Azure Communication Services)
- Forgot password and forgot username flows on login page
- Per-email rate limiting (2 per 15 minutes)
- Profile image upload with client-side cropping
- **Comprehensive Audit Logging**
- Every authenticated action logged with extensive JSON details
- Audit Log viewer tab (GlobalAdmin only) with search, filters, pagination
- Expandable detail rows with raw JSON inspection
- CSV export of filtered audit entries
- EventCode column widened from NVARCHAR(8) to NVARCHAR(50)

**Version 4.1** (Mar 8, 2026)
- **Gamified Celebration Levels for Live Counter**
- 3 selectable celebration levels: Chill, Party, and Chaos
- Emoji character animations: tuxedo cats, ducks, bonus characters walking across screen
- Fireworks system with rockets, explosions, and colored sparks at milestones
- Sound effects: chimes, fanfares, firework launch/boom sounds (toggleable)
- Cat-themed encouragement messages and milestone messages
- Larger message font for room-projected presentations
- Default refresh interval changed to 5 seconds
- Fireworks constrained to left panel to keep QR code scannable

**Version 4.0** (Mar 1, 2026)
- **Security Phase 1 Hardening**
- Deleted legacy login endpoint with hardcoded password hashes
- Added authentication to 9 previously unprotected admin endpoints
- Replaced wildcard CORS with configurable ALLOWED_ORIGINS environment variable
- Removed JWT_SECRET from module exports
- Removed unauthenticated test data endpoint
- Removed hardcoded mock credentials from client-side code
- Added HSTS security header
- Removed unused express-rate-limit dependency

**Version 3.5** (Feb 6, 2026)
- **Azure Key Vault Integration for JWT Secrets**
- Migrated JWT secrets from hardcoded values to Azure Key Vault
- Added provisioning scripts (Bash and PowerShell) for Key Vault setup
- Enabled managed identities on Azure Functions for secure Key Vault access
- Separate Key Vaults for development and production environments
- Enhanced security documentation with Key Vault best practices
- No code changes required - secrets now managed infrastructure-side

**Version 3.4** (Feb 6, 2026)
- **Privacy Compliance - Backend Implementation Complete**
- Successfully deployed backend API with PII collection removed
- Backend no longer stores IP addresses or User-Agent strings in database
- Rate limiting still uses IP temporarily for abuse prevention (not persisted)
- All feedback is now truly anonymous per PRIVACY.md policy
- Verified deployment using Azure Functions Core Tools
- Application fully operational and GDPR/CCPA compliant

**Version 3.3** (Feb 6, 2026)
- **Privacy Compliance Enhancements - Documentation & Frontend**
- Added PRIVACY.md comprehensive privacy policy document
- Added privacy notice to feedback form with Microsoft Privacy link
- Privacy banner positioned at bottom of feedback form
- Enhanced security documentation
- Prepared for 100% anonymous feedback collection

**Version 3.2** (Feb 6, 2026)
- Enhanced Feedback Viewing with advanced filtering
- Added Module and Speaker filter dropdowns to Feedback tab
- Implemented flexible sorting (by Date, Rating, Module, Speaker, Event)
- **Enhanced Analytics Dashboard** with Event, Module, and Speaker filtering
- Filter analytics statistics by any combination of Event, Module, or Speaker
- Improved feedback management with multi-criteria filtering
- Consistent UI layout across all admin tabs

**Version 3.1** (Feb 6, 2026)
- Enhanced Live Counter with real-time analytics dashboard
- Added live statistics: average satisfaction, speaker knowledge, content depth breakdown
- Removed per-module breakdown in favor of comprehensive analytics view
- Improved presentation mode with better visual indicators
- Configurable auto-refresh (5, 10, 15, or 30 seconds; default: 15 seconds)
- User-selectable refresh interval dropdown for flexibility

**Version 3.0** (Feb 6, 2026)
- Migrated to separate Azure Functions app for full routing support
- Resolved dynamic route issues with managed functions
- Updated frontend to use external Functions app
- Improved error handling and API client
- Added Live Counter button in admin QR code modal

**Version 2.0** (Feb 4, 2026)
- Migrated to many-to-many Events ↔ Modules relationship
- Added module reusability across events
- Enhanced admin panel with module management
- Updated database schema to V2

**Version 1.0** (Feb 3, 2026)
- Initial release with single Events table
- Basic feedback collection
- QR code generation

## Support & Documentation

- **Privacy Policy:** See [`PRIVACY.md`](PRIVACY.md) - Data collection and privacy details
- **Database Migration:** See [`docs/database-migration-strategy.md`](docs/database-migration-strategy.md) - Schema management and data migration
- **Production Architecture:** See [`docs/infrastructure/production-architecture.md`](docs/infrastructure/production-architecture.md) - Production environment design
- **Environment Variables:** See [`docs/infrastructure/environment-variables.md`](docs/infrastructure/environment-variables.md) - Configuration reference
- **GitHub Secrets:** See [`docs/infrastructure/github-secrets.md`](docs/infrastructure/github-secrets.md) - CI/CD configuration
- **Complete Schema:** See `DATABASE-REFERENCE.md`
- **Deployment Guide:** See `DEPLOYMENT_CONFIGURATION.md`
- **Architecture:** See `DATABASE_ARCHITECTURE_V2.md`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

This is a demonstration project for the CAT Bootcamp.

---

**Version:** 5.0
**Last Updated:** March 29, 2026
**Status:** Production - Privacy-Compliant + RBAC + Audit Logging
