# CAT Bootcamp Feedback - Database Reference Guide

⚠️ **SECURITY NOTE:** Database credentials have been redacted from this file for security.
See `CATBOOTCAMP_CREDENTIALS_SECURE.md` on your local machine (NOT in repo) for actual credentials.

## Table of Contents
- [Connection Information](#connection-information)
- [Connection Examples](#connection-examples)
- [Data Model Overview](#data-model-overview)
- [Table Schemas](#table-schemas)
- [Relationships](#relationships)
- [Common Queries](#common-queries)

---

## Connection Information

### Azure SQL Database Details

| Property | Value |
|----------|-------|
| **Server** | `cat-bootcamp-sql-89082.database.windows.net` |
| **Database** | `CATBootcampFeedback` |
| **Username** | `sqladmin` |
| **Password** | `[REDACTED]` |
| **Port** | `1433` (default) |
| **Resource Group** | `cat-bootcamp-rg` |
| **Region** | East US 2 |

### Connection Strings

#### ADO.NET
```
Server=tcp:cat-bootcamp-sql-89082.database.windows.net,1433;Initial Catalog=CATBootcampFeedback;Persist Security Info=False;User ID=sqladmin;Password=[REDACTED];MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

#### ODBC
```
Driver={ODBC Driver 17 for SQL Server};Server=tcp:cat-bootcamp-sql-89082.database.windows.net,1433;Database=CATBootcampFeedback;Uid=sqladmin;Pwd=[REDACTED];Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
```

#### JDBC
```
jdbc:sqlserver://cat-bootcamp-sql-89082.database.windows.net:1433;database=CATBootcampFeedback;user=sqladmin;password=[REDACTED];encrypt=true;trustServerCertificate=false;loginTimeout=30;
```

#### Node.js (mssql package)
```javascript
const config = {
    server: 'cat-bootcamp-sql-89082.database.windows.net',
    database: 'CATBootcampFeedback',
    user: 'sqladmin',
    password: '[REDACTED]',
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};
```

---

## Connection Examples

### 1. SQL Server Management Studio (SSMS)

1. Open SQL Server Management Studio
2. In the "Connect to Server" dialog:
   - **Server type**: Database Engine
   - **Server name**: `cat-bootcamp-sql-89082.database.windows.net`
   - **Authentication**: SQL Server Authentication
   - **Login**: `sqladmin`
   - **Password**: `[REDACTED]`
3. Click **Connect**

### 2. Azure Data Studio

1. Open Azure Data Studio
2. Click **New Connection**
3. Fill in the connection details:
   - **Connection type**: Microsoft SQL Server
   - **Server**: `cat-bootcamp-sql-89082.database.windows.net`
   - **Authentication type**: SQL Login
   - **User name**: `sqladmin`
   - **Password**: `[REDACTED]`
   - **Database**: `CATBootcampFeedback`
   - **Encrypt**: True
4. Click **Connect**

### 3. sqlcmd (Command Line)

```bash
sqlcmd -S cat-bootcamp-sql-89082.database.windows.net -d CATBootcampFeedback -U sqladmin -P "[REDACTED]"
```

### 4. PowerShell (SqlServer Module)

```powershell
# Install SqlServer module if needed
Install-Module -Name SqlServer -Force

# Import module
Import-Module SqlServer

# Execute query
$ServerName = 'cat-bootcamp-sql-89082.database.windows.net'
$DatabaseName = 'CATBootcampFeedback'
$Username = 'sqladmin'
$Password = '[REDACTED]'

$Query = "SELECT TOP 10 * FROM Events"

Invoke-Sqlcmd -ServerInstance $ServerName -Database $DatabaseName `
              -Username $Username -Password $Password -Query $Query
```

### 5. Azure CLI

```bash
# Add firewall rule for your IP (if needed)
az sql server firewall-rule create \
  --resource-group cat-bootcamp-rg \
  --server cat-bootcamp-sql-89082 \
  --name "MyIPAddress" \
  --start-ip-address YOUR_IP \
  --end-ip-address YOUR_IP

# Connect using Azure Cloud Shell or local sqlcmd
az sql db show \
  --name CATBootcampFeedback \
  --server cat-bootcamp-sql-89082 \
  --resource-group cat-bootcamp-rg
```

### 6. Python (pyodbc)

```python
import pyodbc

server = 'cat-bootcamp-sql-89082.database.windows.net'
database = 'CATBootcampFeedback'
username = 'sqladmin'
password = '[REDACTED]'

# Connection string
conn_str = (
    f'DRIVER={{ODBC Driver 17 for SQL Server}};'
    f'SERVER={server};'
    f'DATABASE={database};'
    f'UID={username};'
    f'PWD={password}'
)

# Connect and execute query
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()
cursor.execute("SELECT TOP 10 * FROM Events")

for row in cursor:
    print(row)

conn.close()
```

---

## Data Model Overview

### Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Events    │         │  EventModules    │         │   Modules   │
│             │         │  (Junction)      │         │             │
├─────────────┤         ├──────────────────┤         ├─────────────┤
│ EventId PK  │────┐    │ EventModuleId PK │    ┌───│ ModuleId PK │
│ EventName   │    │    │ EventId FK       │    │   │ ModuleName  │
│ EventCode   │    └───→│ ModuleId FK      │←───┘   │ Description │
│ StartDate   │         │ SpeakerName      │         │ IsActive    │
│ EndDate     │         │ DeliveryOrder    │         │ CreatedAt   │
│ CohortId    │         │ DeliveryDate     │         │ CreatedBy   │
│ IsActive    │         │ Notes            │         │ UpdatedAt   │
│ CreatedAt   │         │ CreatedAt        │         │ UpdatedBy   │
│ CreatedBy   │         │ CreatedBy        │         └─────────────┘
│ IsDeleted   │         └──────────────────┘
│ DeletedAt   │                   │
│ DeletedBy   │                   │
└─────────────┘                   │
       │                          │
       │                          │
       │         ┌────────────────┘
       │         │
       │         ▼
       │  ┌──────────────┐
       │  │  Feedback    │
       │  ├──────────────┤
       │  │ FeedbackId PK│
       └─→│ EventId FK   │
          │ EventModuleId│ (FK to EventModules)
          │ EventCode    │
          │ SpeakerKnow. │
          │ ContentDepth │
          │ ModuleSatis. │
          │ Additional...│
          │ SubmittedAt  │
          │ IpAddress    │
          │ UserAgent    │
          └──────────────┘
```

### Database Schema Summary

The CAT Bootcamp Feedback system uses a **many-to-many** relationship between Events and Modules through the EventModules junction table:

- **Events**: Training events/sessions with date ranges
- **Modules**: Reusable training content modules
- **EventModules**: Links modules to events with delivery-specific details (speaker, order, date)
- **Feedback**: Participant feedback on module deliveries

---

## Table Schemas

### 1. Events Table

Stores information about training events/bootcamps.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `EventId` | INT | PRIMARY KEY, IDENTITY | Unique event identifier |
| `EventName` | NVARCHAR(200) | NOT NULL | Descriptive name for the event |
| `EventCode` | NVARCHAR(20) | UNIQUE, NOT NULL | Unique code (e.g., CSA1B2C3, CAT-2024-Spring, etc.) |
| `StartDate` | DATE | NOT NULL | Event start date |
| `EndDate` | DATE | NULL | Event end date (optional) |
| `CohortId` | NVARCHAR(50) | NULL | Cohort/batch identifier |
| `IsActive` | BIT | DEFAULT 1 | Whether event is active |
| `CreatedAt` | DATETIME2 | DEFAULT GETDATE() | Creation timestamp |
| `CreatedBy` | NVARCHAR(100) | NULL | User who created the event |
| `IsDeleted` | BIT | DEFAULT 0 | Soft delete flag |
| `DeletedAt` | DATETIME2 | NULL | Deletion timestamp |
| `DeletedBy` | NVARCHAR(100) | NULL | User who deleted the event |

**Indexes:**
- `IX_Events_EventCode` (NONCLUSTERED)
- `IX_Events_IsActive_StartDate` (NONCLUSTERED)

**Sample Data:**
```sql
INSERT INTO Events (EventName, EventCode, StartDate, EndDate, CohortId, IsActive)
VALUES ('Cloud Adoption Training - Q1 2026', 'CSA1B2C3', '2026-02-15', '2026-02-20', 'Q1-2026', 1);
```

---

### 2. Modules Table

Stores reusable training content modules.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `ModuleId` | INT | PRIMARY KEY, IDENTITY | Unique module identifier |
| `ModuleName` | NVARCHAR(200) | NOT NULL | Name of the module |
| `Description` | NVARCHAR(MAX) | NULL | Detailed description |
| `IsActive` | BIT | DEFAULT 1 | Whether module is active |
| `CreatedAt` | DATETIME2 | DEFAULT GETDATE() | Creation timestamp |
| `CreatedBy` | NVARCHAR(100) | NULL | User who created the module |
| `UpdatedAt` | DATETIME2 | NULL | Last update timestamp |
| `UpdatedBy` | NVARCHAR(100) | NULL | User who updated the module |

**Sample Data:**
```sql
INSERT INTO Modules (ModuleName, Description, IsActive)
VALUES ('Advanced Topics in CAT', 'Deep dive into advanced concepts', 1);
```

---

### 3. EventModules Table (Junction)

Links modules to events with delivery-specific information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `EventModuleId` | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| `EventId` | INT | FOREIGN KEY, NOT NULL | Reference to Events |
| `ModuleId` | INT | FOREIGN KEY, NOT NULL | Reference to Modules |
| `SpeakerName` | NVARCHAR(100) | NOT NULL | Speaker for this delivery |
| `DeliveryOrder` | INT | NOT NULL, DEFAULT 1 | Order in event sequence |
| `DeliveryDate` | DATETIME | NULL | When module is delivered |
| `Notes` | NVARCHAR(MAX) | NULL | Additional notes |
| `CreatedAt` | DATETIME | DEFAULT GETDATE() | Creation timestamp |
| `CreatedBy` | NVARCHAR(100) | NULL | User who created the link |

**Constraints:**
- `FK_EventModules_Events` (EventId → Events.EventId, CASCADE DELETE)
- `FK_EventModules_Modules` (ModuleId → Modules.ModuleId, CASCADE DELETE)
- `UQ_EventModules_EventModule` (UNIQUE on EventId, ModuleId)

**Indexes:**
- `IX_EventModules_EventId` (NONCLUSTERED)
- `IX_EventModules_ModuleId` (NONCLUSTERED)

**Sample Data:**
```sql
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate)
VALUES (1, 1, 'Dr. Sarah Chen', 1, '2026-02-15 09:00:00');
```

---

### 4. Feedback Table

Stores participant feedback submissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `FeedbackId` | INT | PRIMARY KEY, IDENTITY | Unique feedback identifier |
| `EventId` | INT | FOREIGN KEY, NOT NULL | Reference to Events |
| `EventModuleId` | INT | FOREIGN KEY, NULL | Reference to EventModules |
| `EventCode` | NVARCHAR(20) | NOT NULL | Event code (denormalized) |
| `SpeakerKnowledge` | INT | NOT NULL, CHECK (1-5) | Rating 1-5 |
| `ContentDepth` | NVARCHAR(20) | NOT NULL | 'Too Technical', 'Just Right', 'Too Low Level' |
| `ModuleSatisfaction` | INT | NOT NULL, CHECK (1-5) | Rating 1-5 |
| `AdditionalComments` | NVARCHAR(MAX) | NULL | Free-form feedback |
| `SubmittedAt` | DATETIME2 | DEFAULT GETDATE() | Submission timestamp |
| `IpAddress` | NVARCHAR(45) | NULL | IP address of submitter |
| `UserAgent` | NVARCHAR(500) | NULL | Browser user agent |

**Constraints:**
- `FK_Feedback_Events` (EventId → Events.EventId)
- `FK_Feedback_EventModules` (EventModuleId → EventModules.EventModuleId)
- CHECK constraints on rating values

**Indexes:**
- `IX_Feedback_EventId_SubmittedAt` (NONCLUSTERED)
- `IX_Feedback_SubmittedAt` (NONCLUSTERED)
- `IX_Feedback_EventId_Analytics` (with INCLUDE columns)
- `IX_Feedback_IpAddress_SubmittedAt` (filtered, for rate limiting)

**Sample Data:**
```sql
INSERT INTO Feedback (EventId, EventModuleId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments)
VALUES (1, 1, 'CSA1B2C3', 5, 'Just Right', 5, 'Excellent presentation!');
```

---

### 5. Users Table

Stores authenticated user accounts (replaces ADMIN_USERS_JSON as primary auth source).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `UserId` | INT | PRIMARY KEY, IDENTITY | Auto-increment primary key |
| `Username` | NVARCHAR(100) | UNIQUE, NOT NULL | Unique username |
| `PasswordHash` | NVARCHAR(255) | NOT NULL | bcrypt hash |
| `FullName` | NVARCHAR(200) | NULL | Display name |
| `Email` | NVARCHAR(255) | UNIQUE, NULL | Unique email |
| `IsActive` | BIT | DEFAULT 1 | Account status |
| `IsProtected` | BIT | DEFAULT 0 | Cannot be deleted/demoted |
| `MustChangePassword` | BIT | DEFAULT 0 | Force password change on next login |
| `ProfileImage` | NVARCHAR(MAX) | NULL | Base64 profile image |
| `PasswordResetToken` | NVARCHAR(255) | NULL | Reset token |
| `PasswordResetExpiry` | DATETIME2 | NULL | Token expiration |
| `LastLoginAt` | DATETIME2 | NULL | Last login timestamp |
| `CreatedAt` | DATETIME2 | DEFAULT GETDATE() | Creation timestamp |
| `CreatedBy` | NVARCHAR(100) | NULL | User who created the account |
| `UpdatedAt` | DATETIME2 | NULL | Last update timestamp |
| `UpdatedBy` | NVARCHAR(100) | NULL | User who last updated the account |

---

### 6. Roles Table

Stores available roles for RBAC.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `RoleId` | INT | PRIMARY KEY, IDENTITY | Auto-increment |
| `RoleName` | NVARCHAR(50) | UNIQUE, NOT NULL | Unique role name |
| `Description` | NVARCHAR(500) | NULL | Role description |
| `IsSystem` | BIT | DEFAULT 0 | System roles cannot be deleted |

**Seeded Roles:**
- GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer

---

### 7. UserRoles Table (Junction)

Links users to roles (many-to-many).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `UserRoleId` | INT | PRIMARY KEY, IDENTITY | Auto-increment |
| `UserId` | INT | FOREIGN KEY, NOT NULL | References Users |
| `RoleId` | INT | FOREIGN KEY, NOT NULL | References Roles |
| `AssignedAt` | DATETIME2 | DEFAULT GETDATE() | When assigned |
| `AssignedBy` | NVARCHAR(100) | NULL | Who assigned |

**Constraints:**
- `FK_UserRoles_Users` (UserId -> Users.UserId, CASCADE DELETE)
- `FK_UserRoles_Roles` (RoleId -> Roles.RoleId)
- `UQ_UserRoles_UserRole` (UNIQUE on UserId, RoleId)

---

### 8. UserEventAccess Table

Controls per-event access for users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `UserEventAccessId` | INT | PRIMARY KEY, IDENTITY | Auto-increment |
| `UserId` | INT | FOREIGN KEY, NOT NULL | References Users |
| `EventId` | INT | FOREIGN KEY, NOT NULL | References Events |
| `GrantedAt` | DATETIME2 | DEFAULT GETDATE() | When granted |
| `GrantedBy` | NVARCHAR(100) | NULL | Who granted |

**Constraints:**
- `FK_UserEventAccess_Users` (UserId -> Users.UserId, CASCADE DELETE)
- `FK_UserEventAccess_Events` (EventId -> Events.EventId, CASCADE DELETE)
- `UQ_UserEventAccess_UserEvent` (UNIQUE on UserId, EventId)

---

### 9. AuditLog Table

Records all administrative actions for auditing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `AuditLogId` | BIGINT | PRIMARY KEY, IDENTITY | Auto-increment |
| `UserId` | INT | NULL | Who performed the action |
| `Username` | NVARCHAR(100) | NULL | Denormalized username |
| `Action` | NVARCHAR(50) | NOT NULL | Action verb (CREATE, DELETE, etc.) |
| `ResourceType` | NVARCHAR(50) | NULL | What was acted on |
| `ResourceId` | NVARCHAR(100) | NULL | ID of affected resource |
| `Summary` | NVARCHAR(500) | NULL | Human-readable summary |
| `Details` | NVARCHAR(MAX) | NULL | JSON details |
| `IpAddress` | NVARCHAR(45) | NULL | Client IP |
| `Timestamp` | DATETIME2 | DEFAULT GETDATE() | When it happened |

**Indexes:**
- `IX_AuditLog_Timestamp` (NONCLUSTERED)
- `IX_AuditLog_UserId` (NONCLUSTERED)
- `IX_AuditLog_Action_ResourceType` (NONCLUSTERED)

---

## Relationships

### Primary Relationships

1. **Events ↔ Modules (Many-to-Many)**
   - Via `EventModules` junction table
   - One event can have multiple modules
   - One module can be delivered in multiple events
   - Each delivery has unique speaker, order, and date

2. **Events → Feedback (One-to-Many)**
   - One event can have many feedback submissions
   - Foreign key: `Feedback.EventId → Events.EventId`

3. **EventModules → Feedback (One-to-Many)**
   - One module delivery can have many feedback submissions
   - Foreign key: `Feedback.EventModuleId → EventModules.EventModuleId`

4. **Users -> UserRoles (One-to-Many)**
   - One user can have multiple roles
   - Foreign key: `UserRoles.UserId -> Users.UserId`
   - CASCADE DELETE: Deleting a user removes all role assignments

5. **Roles -> UserRoles (One-to-Many)**
   - One role can be assigned to multiple users
   - Foreign key: `UserRoles.RoleId -> Roles.RoleId`

6. **Users -> UserEventAccess (One-to-Many)**
   - One user can have access to multiple events
   - Foreign key: `UserEventAccess.UserId -> Users.UserId`
   - CASCADE DELETE: Deleting a user removes all event access grants

7. **Events -> UserEventAccess (One-to-Many)**
   - One event can be accessible by multiple users
   - Foreign key: `UserEventAccess.EventId -> Events.EventId`
   - CASCADE DELETE: Deleting an event removes all user access grants for it

### Cascade Rules

- **EventModules**: CASCADE DELETE on both Events and Modules
  - Deleting an Event removes all its EventModules entries
  - Deleting a Module removes all its EventModules entries

- **Feedback**: No CASCADE (protected)
  - Feedback is preserved even if referenced entities are deleted
  - EventModuleId can be NULL to support historical data

- **UserRoles**: CASCADE DELETE on Users
  - Deleting a User removes all their role assignments

- **UserEventAccess**: CASCADE DELETE on both Users and Events
  - Deleting a User removes all their event access grants
  - Deleting an Event removes all user access grants for it

---

## Common Queries

### 1. Get All Active Events with Module Count

```sql
SELECT
    e.EventId,
    e.EventName,
    e.EventCode,
    e.StartDate,
    e.EndDate,
    e.CohortId,
    e.IsActive,
    COUNT(DISTINCT em.EventModuleId) AS ModuleCount,
    COUNT(DISTINCT f.FeedbackId) AS FeedbackCount
FROM Events e
LEFT JOIN EventModules em ON e.EventId = em.EventId
LEFT JOIN Feedback f ON e.EventId = f.EventId
WHERE e.IsActive = 1 AND e.IsDeleted = 0
GROUP BY e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.CohortId, e.IsActive
ORDER BY e.StartDate DESC;
```

### 2. Get Event Details with Modules and Feedback

```sql
SELECT
    e.EventName,
    e.EventCode,
    e.StartDate,
    m.ModuleName,
    em.SpeakerName,
    em.DeliveryOrder,
    em.DeliveryDate,
    COUNT(f.FeedbackId) AS FeedbackCount,
    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction
FROM Events e
INNER JOIN EventModules em ON e.EventId = em.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
WHERE e.EventCode = 'CSA1B2C3'
GROUP BY e.EventName, e.EventCode, e.StartDate, m.ModuleName, em.SpeakerName, em.DeliveryOrder, em.DeliveryDate
ORDER BY em.DeliveryOrder;
```

### 3. Get Feedback Statistics by Event

```sql
SELECT
    e.EventName,
    e.EventCode,
    COUNT(f.FeedbackId) AS TotalFeedback,
    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction,
    SUM(CASE WHEN f.ContentDepth = 'Too Technical' THEN 1 ELSE 0 END) AS TooTechnicalCount,
    SUM(CASE WHEN f.ContentDepth = 'Just Right' THEN 1 ELSE 0 END) AS JustRightCount,
    SUM(CASE WHEN f.ContentDepth = 'Too Low Level' THEN 1 ELSE 0 END) AS TooLowLevelCount
FROM Events e
LEFT JOIN Feedback f ON e.EventId = f.EventId
WHERE e.IsActive = 1 AND e.IsDeleted = 0
GROUP BY e.EventName, e.EventCode
ORDER BY TotalFeedback DESC;
```

### 4. Get Module Usage Across Events

```sql
SELECT
    m.ModuleName,
    m.Description,
    COUNT(DISTINCT em.EventId) AS TimesDelivered,
    COUNT(DISTINCT f.FeedbackId) AS TotalFeedback,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgSatisfaction
FROM Modules m
LEFT JOIN EventModules em ON m.ModuleId = em.ModuleId
LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
WHERE m.IsActive = 1
GROUP BY m.ModuleName, m.Description
ORDER BY TimesDelivered DESC;
```

### 5. Reorder Modules in an Event

```sql
-- Move module to a new position
DECLARE @EventModuleId INT = 1;
DECLARE @NewOrder INT = 2;

-- Get current order
DECLARE @CurrentOrder INT;
DECLARE @EventId INT;

SELECT @CurrentOrder = DeliveryOrder, @EventId = EventId
FROM EventModules
WHERE EventModuleId = @EventModuleId;

-- Shift other modules
IF @NewOrder < @CurrentOrder
BEGIN
    -- Moving up: shift modules down
    UPDATE EventModules
    SET DeliveryOrder = DeliveryOrder + 1
    WHERE EventId = @EventId
      AND DeliveryOrder >= @NewOrder
      AND DeliveryOrder < @CurrentOrder;
END
ELSE
BEGIN
    -- Moving down: shift modules up
    UPDATE EventModules
    SET DeliveryOrder = DeliveryOrder - 1
    WHERE EventId = @EventId
      AND DeliveryOrder > @CurrentOrder
      AND DeliveryOrder <= @NewOrder;
END

-- Update target module
UPDATE EventModules
SET DeliveryOrder = @NewOrder
WHERE EventModuleId = @EventModuleId;
```

---

## Security Considerations

### Firewall Rules

Azure SQL Database requires firewall rules to allow connections. Add your IP address:

```bash
az sql server firewall-rule create \
  --resource-group cat-bootcamp-rg \
  --server cat-bootcamp-sql-89082 \
  --name "MyWorkstation" \
  --start-ip-address YOUR_IP_ADDRESS \
  --end-ip-address YOUR_IP_ADDRESS
```

### Best Practices

1. **Use Application Settings**: Store connection strings in Azure App Settings, not in code
2. **Managed Identity**: Consider using Azure Managed Identity for passwordless connections
3. **Least Privilege**: Create application-specific users with minimal required permissions
4. **Encryption**: Always use encrypted connections (`Encrypt=True`)
5. **Connection Pooling**: Enable connection pooling for better performance
6. **Parameterized Queries**: Always use parameterized queries to prevent SQL injection

### Creating Application User

```sql
-- Connect to the database and create a read-only user
CREATE USER [AppReadOnly] WITH PASSWORD = 'SecurePassword123!';
ALTER ROLE db_datareader ADD MEMBER [AppReadOnly];

-- Create a read-write user for the application
CREATE USER [AppReadWrite] WITH PASSWORD = 'SecurePassword456!';
ALTER ROLE db_datareader ADD MEMBER [AppReadWrite];
ALTER ROLE db_datawriter ADD MEMBER [AppReadWrite];
```

---

## Backup and Maintenance

### Automated Backups

Azure SQL Database provides automated backups:
- **Full backups**: Weekly
- **Differential backups**: Every 12-24 hours
- **Transaction log backups**: Every 5-10 minutes
- **Retention**: 7-35 days (configurable)

### Point-in-Time Restore

```bash
# Restore database to a point in time
az sql db restore \
  --dest-name CATBootcampFeedback_Restored \
  --edition Standard \
  --service-objective S1 \
  --resource-group cat-bootcamp-rg \
  --server cat-bootcamp-sql-89082 \
  --name CATBootcampFeedback \
  --time "2026-02-04T12:00:00Z"
```

### Manual Backup

```sql
-- Export database (requires Azure Storage account)
-- Use Azure Portal > Export or use SqlPackage.exe tool
```

---

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check firewall rules
   - Verify IP address is allowed
   - Check network connectivity

2. **Login Failed**
   - Verify username and password
   - Check if user has access to specific database
   - Ensure using SQL authentication, not Windows auth

3. **Slow Queries**
   - Check execution plans
   - Review indexes
   - Consider query optimization

4. **Permission Denied**
   - Verify user has appropriate role membership
   - Check object-level permissions

### Diagnostic Queries

```sql
-- Check database size
SELECT
    DB_NAME() AS DatabaseName,
    SUM(size * 8 / 1024) AS SizeMB
FROM sys.database_files;

-- Check table sizes
SELECT
    t.NAME AS TableName,
    p.rows AS RowCounts,
    SUM(a.total_pages) * 8 / 1024 AS TotalSpaceMB
FROM sys.tables t
INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
GROUP BY t.Name, p.Rows
ORDER BY TotalSpaceMB DESC;

-- Check for missing indexes
SELECT
    migs.avg_user_impact,
    migs.user_seeks,
    mid.statement,
    mid.equality_columns,
    mid.inequality_columns,
    mid.included_columns
FROM sys.dm_db_missing_index_groups mig
INNER JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
INNER JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
ORDER BY migs.avg_user_impact DESC;
```

---

## Additional Resources

- [Azure SQL Database Documentation](https://docs.microsoft.com/en-us/azure/sql-database/)
- [T-SQL Reference](https://docs.microsoft.com/en-us/sql/t-sql/)
- [SQL Server Management Studio Download](https://docs.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms)
- [Azure Data Studio Download](https://docs.microsoft.com/en-us/sql/azure-data-studio/download-azure-data-studio)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-29 | 3.0 | Added Users, Roles, UserRoles, UserEventAccess, AuditLog tables for RBAC |
| 2026-02-04 | 2.0 | Added EventName field to Events table |
| 2026-02-04 | 1.1 | Migrated to many-to-many relationship with EventModules |
| 2026-01-15 | 1.0 | Initial database schema |

---

**Document Version:** 3.0
**Last Updated:** 2026-03-29
**Maintained By:** Development Team
