# Production Database Initialization

## Status
- **Resource Group**: `cat-bootcamp-prod-rg` (Created)
- **SQL Server**: `<prod-sql-server>.database.windows.net` (Created)
- **SQL Database**: `CATBootcampFeedback-Prod` (Created)
- **Schema**: Initialized (current through migration 006)
- **QA Database**: `<qa-sql-server>.database.windows.net` / `CATBootcampFeedback-QA`
- **Last Updated**: March 29, 2026

## Database Connection Details
- **Server**: `<prod-sql-server>.database.windows.net`
- **Database**: `CATBootcampFeedback-Prod`
- **Admin User**: `sqladmin`
- **Admin Password**: Stored in Azure Key Vault
- **Tier**: Basic (5 DTU, 2GB)

## Schema Initialization

The database schema is initialized using `database-init.sql` and then kept current by applying migrations from the `migrations/` folder. This can be done using one of the following methods:

### Method 1: Azure Portal Query Editor
1. Navigate to the Azure Portal
2. Go to Resource Groups > `cat-bootcamp-prod-rg`
3. Select the SQL Database `CATBootcampFeedback-Prod`
4. Click on "Query editor (preview)" in the left menu
5. Login with:
   - Username: `sqladmin`
   - Password: (use the provided password)
6. Copy and paste the contents of `database-init.sql`
7. Click "Run" to execute the script
8. Apply each migration script from the `migrations/` folder in order

### Method 2: SQL Server Management Studio (SSMS)
1. Open SSMS
2. Connect to server: `<prod-sql-server>.database.windows.net`
3. Authentication: SQL Server Authentication
4. Login: `sqladmin`
5. Password: (use the provided password)
6. Once connected, open `database-init.sql`
7. Execute the script against `CATBootcampFeedback-Prod` database
8. Apply each migration script from the `migrations/` folder in order

### Method 3: sqlcmd (if available)
```bash
sqlcmd -S <prod-sql-server>.database.windows.net -d CATBootcampFeedback-Prod -U sqladmin -P "<password>" -i database-init.sql
```

### Method 4: Visual Studio Code with SQL Server Extension
1. Install the "SQL Server (mssql)" extension
2. Create a new connection:
   - Server: `<prod-sql-server>.database.windows.net`
   - Database: `CATBootcampFeedback-Prod`
   - Authentication Type: SQL Login
   - User: `sqladmin`
   - Password: (use the provided password)
3. Open `database-init.sql`
4. Right-click and select "Execute Query"
5. Apply each migration script from the `migrations/` folder in order

## Schema Components

### Tables

1. **Events** — Stores bootcamp event information
   - EventId (PK, Identity), EventName, EventCode (unique), StartDate, EndDate, TrainingTrack, IsActive
   - CreatedAt, CreatedBy
   - Soft delete support: IsDeleted, DeletedAt, DeletedBy

2. **Modules** — Stores reusable training module definitions
   - ModuleId (PK, Identity), ModuleName, Description, IsActive
   - CreatedAt, CreatedBy, UpdatedAt, UpdatedBy

3. **EventModules** — Links modules to events with delivery details
   - EventModuleId (PK, Identity), EventId (FK to Events), ModuleId (FK to Modules)
   - SpeakerName, SpeakerId (FK to Speakers), DeliveryOrder, DeliveryDate, Notes
   - CreatedAt, CreatedBy
   - UNIQUE constraint on (EventId, ModuleId)

4. **Feedback** — Stores participant feedback for event modules
   - FeedbackId (PK, Identity), EventModuleId (FK to EventModules), EventId, EventCode
   - SpeakerKnowledge (1-5), ContentDepth (enum), ModuleSatisfaction (1-5), AdditionalComments
   - IpAddress, UserAgent (for rate limiting), SubmittedAt

5. **Users** — Application user accounts
   - UserId (PK, Identity), Username, PasswordHash, FullName, Email, IsActive, IsProtected
   - MustChangePassword, PasswordResetToken, PasswordResetTokenExpiry, LastLoginAt, ProfileImage
   - CreatedAt, CreatedBy, UpdatedAt, UpdatedBy

6. **Roles** — RBAC role definitions
   - RoleId (PK, Identity), RoleName, Description, IsSystem
   - Seeded roles: GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer

7. **UserRoles** — Maps users to roles
   - UserRoleId (PK, Identity), UserId (FK to Users), RoleId (FK to Roles)
   - AssignedAt, AssignedBy

8. **UserEventAccess** — Per-event access grants for users
   - UserEventAccessId (PK, Identity), UserId (FK to Users), EventId (FK to Events)
   - GrantedAt, GrantedBy

9. **AuditLog** — Records security and data-change audit events
   - AuditLogId (PK, BIGINT Identity), UserId, Username, Action, ResourceType, ResourceId
   - Summary, Details, IpAddress, Timestamp

10. **Speakers** — Speaker directory
    - SpeakerId (PK, Identity), SpeakerName (unique), Bio, ProfileImage, IsActive
    - CreatedAt, CreatedBy, UpdatedAt, UpdatedBy

11. **EventTemplates** — Reusable event templates
    - TemplateId (PK, Identity), TemplateName, Description, TrainingTrack, IsActive
    - CreatedAt, CreatedBy, UpdatedAt, UpdatedBy

12. **EventTemplateModules** — Modules assigned to an event template
    - TemplateModuleId (PK, Identity), TemplateId (FK to EventTemplates), ModuleId (FK to Modules)
    - DeliveryOrder, Notes
    - UNIQUE constraint on (TemplateId, ModuleId)

### Views

- **vw_EventsWithModules** — Events joined with their modules and speaker information
- **vw_FeedbackWithDetails** — Feedback joined with event module and speaker details
- **vw_EventFeedbackCounts** — Aggregated feedback counts per event
- **vw_UsersWithRoles** — Users joined with their assigned roles

### Stored Procedures

- **sp_GetEventByCode** — Retrieve an event and its modules by event code
- **sp_GetFeedbackCountByEventCode** — Get feedback count for a given event code

### Indexes
- Performance indexes for analytics queries
- Event-specific analytics indexes
- Speaker performance tracking indexes
- IP-based rate limiting indexes

## Migrations

Migrations are stored in the `migrations/` folder and should be applied in order after the base `database-init.sql` script:

| Migration | Description |
|-----------|-------------|
| `002-add-user-management.sql` | Adds Users, Roles, UserRoles, and UserEventAccess tables; seeds RBAC roles |
| `003-add-profile-image.sql` | Adds ProfileImage column to Users |
| `004-add-audit-log.sql` | Adds AuditLog table for security and change tracking |
| `005-widen-event-code.sql` | Widens the EventCode column |
| `006-add-speakers-and-templates.sql` | Adds Speakers, EventTemplates, and EventTemplateModules tables; adds SpeakerId FK to EventModules |
| `rename-cohort-to-training-track.sql` | Renames Cohort column to TrainingTrack in Events |

## Verification

After running the initialization script and all migrations, verify the schema was created:

```sql
-- Check tables were created (should return 12 tables)
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';

-- Check views were created (should return 4 views)
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS;

-- Check stored procedures were created (should return 2 procedures)
SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE';

-- Check seeded roles exist
SELECT * FROM Roles;
```

## Next Steps

1. Initialize the database schema using one of the methods above
2. Apply all migrations in order
3. Verify the schema was created successfully
4. Continue with deployment pipeline configuration
5. Add connection string to GitHub Secrets for deployment

## Security Notes

- The firewall is currently configured to allow:
  - Azure services (0.0.0.0)
  - Your current IP address (107.194.87.63)
- Additional IP addresses can be added via Azure Portal or Azure CLI
- Consider restricting access further once Functions App is deployed
- All database secrets must be stored in Azure Key Vault, never in plain text
