# Production Database Initialization

## Status
- **Resource Group**: `cat-bootcamp-prod-rg` (Created)
- **SQL Server**: `cat-bootcamp-sql-prod.database.windows.net` (Created)
- **SQL Database**: `CATBootcampFeedback-Prod` (Created)
- **Schema**: Pending initialization

## Database Connection Details
- **Server**: `cat-bootcamp-sql-prod.database.windows.net`
- **Database**: `CATBootcampFeedback-Prod`
- **Admin User**: `sqladmin`
- **Admin Password**: Stored securely (see credentials)
- **Tier**: Basic (5 DTU, 2GB)

## Schema Initialization

The database schema needs to be initialized using `database-init.sql`. This can be done using one of the following methods:

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

### Method 2: SQL Server Management Studio (SSMS)
1. Open SSMS
2. Connect to server: `cat-bootcamp-sql-prod.database.windows.net`
3. Authentication: SQL Server Authentication
4. Login: `sqladmin`
5. Password: (use the provided password)
6. Once connected, open `database-init.sql`
7. Execute the script against `CATBootcampFeedback-Prod` database

### Method 3: sqlcmd (if available)
```bash
sqlcmd -S cat-bootcamp-sql-prod.database.windows.net -d CATBootcampFeedback-Prod -U sqladmin -P "<password>" -i database-init.sql
```

### Method 4: Visual Studio Code with SQL Server Extension
1. Install the "SQL Server (mssql)" extension
2. Create a new connection:
   - Server: `cat-bootcamp-sql-prod.database.windows.net`
   - Database: `CATBootcampFeedback-Prod`
   - Authentication Type: SQL Login
   - User: `sqladmin`
   - Password: (use the provided password)
3. Open `database-init.sql`
4. Right-click and select "Execute Query"

## Schema Components

The `database-init.sql` script creates:

### Tables
- **Events**: Stores bootcamp event information
  - EventId (PK, Identity)
  - EventCode (Unique, for QR codes)
  - ModuleName, ModuleDate, SpeakerName
  - Soft delete support (IsDeleted, DeletedAt, DeletedBy)

- **Feedback**: Stores participant feedback
  - FeedbackId (PK, Identity)
  - EventId (FK to Events)
  - SpeakerKnowledge, ContentDepth, ModuleSatisfaction
  - IP address and User Agent for rate limiting

### Indexes
- Performance indexes for analytics queries
- Event-specific analytics indexes
- Speaker performance tracking indexes
- IP-based rate limiting indexes

### Stored Procedures
- `sp_RestoreEvent`: Restore soft-deleted events
- `sp_GetEventWithCount`: Get event with feedback count
- `sp_GetFeedbackStatistics`: Get feedback statistics by event/date
- `sp_GetSpeakerPerformance`: Get speaker performance summary
- `sp_ArchiveOldFeedback`: Archive old feedback data

### Views
- `vw_ActiveEventsWithCounts`: Active events with feedback counts and averages

### Sample Data
- 3 sample events for testing (can be removed in production)

## Verification

After running the initialization script, verify the schema was created:

```sql
-- Check tables were created
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';

-- Check sample events exist
SELECT * FROM Events;

-- Check stored procedures were created
SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE';

-- Check views were created
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS;
```

## Next Steps

1. Initialize the database schema using one of the methods above
2. Verify the schema was created successfully
3. Optionally remove sample data if not needed for production
4. Continue with Task 3: Create Production Functions App
5. Add connection string to GitHub Secrets for deployment

## Security Notes

- The firewall is currently configured to allow:
  - Azure services (0.0.0.0)
  - Your current IP address (107.194.87.63)
- Additional IP addresses can be added via Azure Portal or Azure CLI
- Consider restricting access further once Functions App is deployed
- Store the SQL password in GitHub Secrets as `PROD_SQL_PASSWORD`
