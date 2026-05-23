# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Skills framework** — New `skills/` directory structure for hosting automation tools with conventions for adding future skills
- **Feedback Report Generator** (`skills/feedback-report/`) — Branded PDF report generator that analyzes training feedback CSV exports and produces multi-page reports with speaker/module rankings, content depth analysis, attendee comments, and actionable recommendations
- **Skills documentation** — `docs/SKILLS-REFERENCE.md` and skills index README

## [5.2.0] - 2026-04-22

### Added
- Bulk speaker assignment in event template flow (#48)
- Inline speaker creation within template assignment modal (#48)

### Fixed
- Event creation made atomic — invalid-speaker errors now surfaced properly (#47)

## [5.1.1] - 2026-04-14

### Fixed
- CSV export now respects active feedback filters (#45)

### Security
- Bump lodash from 4.17.23 to 4.18.1 (#43)
- Bump axios from 1.13.4 to 1.15.0 (#44)

## [5.1.0] - 2026-04-01

### Added
- Feed the Cat counter theme with staged cat mascot images (#39, #40)
- Auto-redirect to login when auth token expires

### Fixed
- Celebration visuals now render inside fullscreen container
- Enlarged cat images in Feed the Cat theme

### Changed
- Documentation updated for v5.1 features
- Removed dead code, stale files, and scripts with hardcoded secrets (#41, #42)

## [5.0.0] - 2026-03-20

### Added
- **Speaker management** — dedicated speaker entity with event history and feedback links
- **Event templates** — create events from reusable templates with pre-assigned modules
- Speaker detail view with event history
- Styled HTML email templates for all user notifications
- Email sending via Azure Communication Services
- Loading spinner overlay during user creation
- Notification toasts always clickable to dismiss

### Fixed
- Black border artifacts on rating distribution bar charts
- Y-axis rendering with hundreds of tick marks on bar charts
- Undefined variable in user creation audit call
- Email notification errors no longer mask user creation success

## [4.0.0] - 2026-03-10

### Added
- **RBAC user management** — 6 roles (GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer)
- **Audit logging** — comprehensive logging of all authenticated actions with search, filter, and CSV export
- **Docker dev environment** for local development
- GitHub QA environment with dedicated deployment workflows
- 3-level celebration system (Chill, Party, Chaos) with cat-themed animations and sounds (#33)
- QA environment detection in config.js
- media-src CSP directive for celebration sounds

### Security
- Removed ADMIN_USERS_JSON authentication fallback (#38)
- Migrated all QA database secrets to Key Vault
- Addressed CodeQL security findings

## [3.5.0] - 2026-03-01

### Added
- Gamified counter screen with celebrations and fireworks (#27)
- Edit speaker name on existing event modules (#26)
- Bulk delete functionality improvements

### Fixed
- Bulk delete 500 error caused by query() returning undefined (#28)
- Bulk delete auth failure and JSON serialization error (#29)
- Counter celebration visuals inside fullscreen container

### Security
- Phase 1 hardening: auth, secrets, CORS fixes
- Added HSTS header
- Removed unused express-rate-limit dependency

## [3.4.0] - 2026-02-28

### Added
- Clickable stat cards to navigate to filtered views (#15)
- Priority 1 analytics enhancements (#13)
- Comprehensive analytics enhancement recommendations

### Fixed
- Modal close functionality in add-module-to-event dialog (#11)
- Production hostname detection made more flexible
- HTML validation for flexible event code format (#16)

### Changed
- Removed mandatory event code format restriction (#14)

### Security
- Credentials removed from documentation (#17)
- Production environment validation script added (#18)
- Admin account passwords rotated (#19)
- Content Security Policy headers for API endpoints (#20)
- Credentials removed from docs and moved to secure storage
- Demo credentials removed from admin login screen

## [3.3.0] - 2026-02-25

### Added
- JWT Authentication for admin endpoints (#7)
- Azure Key Vault integration for JWT secret management (#9)
- MIT License (#10)

### Security
- Rate limiting, SQL Key Vault & dependency scanning (#12)

### Removed
- 'Submit Another Response' functionality (#8)

## [3.2.0] - 2026-02-20

### Added
- Configurable refresh interval on count page (5, 10, 15, or 30 seconds)
- Live analytics dashboard for count page
- Live Counter button in QR code modal
- POST endpoint for feedback submission
- Bulk delete functionality for feedback, events, and modules
- Advanced filtering and sorting for feedback view
- Filterable analytics dashboard

### Fixed
- QR code generation on counter page to include module ID
- Grey text visibility on counter page header
- "Create Event" changed to "Add to Event" in Modules tab
- Standardized Select All and search bar layout across admin tabs

### Security
- **CRITICAL: Privacy Compliance** — Removed all PII collection from feedback

## [3.1.0] - 2026-02-17

### Added
- Module-specific QR code architecture
- Fallback selection flows for missing URL parameters
- Event lifecycle management with auto-archival

### Fixed
- QR code CDN blocking — library now hosted locally
- CSP inline script error in feedback form
- QR code URL generation to include module parameter
- Filter inactive modules and events in GetEvents API
- Admin panel never displays invalid module QR codes

## [3.0.0] - 2026-02-14

### Added
- **V2 Many-to-Many architecture** — Events can have multiple modules, modules are reusable across events
- Per-delivery speaker assignment
- Module reordering within events
- Event name field
- Separate Azure Functions App for full RESTful routing
- Azure Functions V4 model migration
- Comprehensive database migration strategy

### Changed
- Date format changed to MM/DD/YYYY
- Clarified modules vs events terminology
- Architecture: Modules timeless, Events have dates

### Fixed
- Various API response handling and field name issues
- CSP violations replaced inline onclick handlers with event delegation
- Login API body parsing for V4

## [2.0.0] - 2026-02-08

### Added
- Admin panel with event and module management
- QR code generation per module
- Delete functionality with confirmation
- Landing page (index.html)
- Rate limiting and security improvements
- Deployment to Azure Static Web Apps + Azure Functions

### Fixed
- CSP header implementation
- API field name case sensitivity
- Count page environment detection

### Security
- Removed Azure auth from admin page — uses built-in login form
- Updated mssql package for security vulnerability

## [1.0.0] - 2026-02-03

### Added
- Initial release of CAT Bootcamp Feedback Application
- Public feedback form with speaker knowledge, content depth, module satisfaction, and comments
- Admin interface for managing events
- Live feedback count display
- Azure Static Web App deployment configuration
