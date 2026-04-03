# Database Architecture V2

## Overview

The CAT Bootcamp Feedback application uses a normalized Azure SQL Database with a many-to-many relationship between Events and Modules through an EventModules junction table.

## Schema Version

**Current Version:** V2.5 (March 2026)
**Previous Version:** V2 (February 2026), V1 (deprecated)

> **V2.5 Note:** Added RBAC tables (Users, Roles, UserRoles, UserEventAccess), AuditLog table, ProfileImage column, and widened EventCode to NVARCHAR(50).

## V1 to V2 Migration

### What Changed

**V1 Architecture (Deprecated):**
- Direct relationship: Event → Modules (1:1)
- Event table contained module information directly
- Could not reuse modules across events
- Inefficient for multi-module events

**V2 Architecture (Current):**
- Normalized: Event ← EventModules → Modules (Many:Many)
- Events table stores event metadata only
- Modules table stores reusable module definitions
- EventModules junction table links events to modules
- Supports multiple modules per event
- Modules can be reused across events

### Migration Script

The migration from V1 to V2 was performed with the following script:

```sql
-- Step 1: Create Modules table
CREATE TABLE Modules (
    ModuleId INT IDENTITY(1,1) PRIMARY KEY,
    ModuleName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL
);

-- Step 2: Create EventModules junction table
CREATE TABLE EventModules (
    EventModuleId INT IDENTITY(1,1) PRIMARY KEY,
    EventId INT NOT NULL,
    ModuleId INT NOT NULL,
    SpeakerName NVARCHAR(100) NULL,
    DeliveryOrder INT NOT NULL DEFAULT 1,
    DeliveryDate DATE NULL,
    FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE,
    FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId),
    CONSTRAINT UQ_Event_Module_Order UNIQUE (EventId, DeliveryOrder)
);

-- Step 3: Migrate data from V1 Events table
INSERT INTO Modules (ModuleName, Description, IsActive, CreatedAt, CreatedBy)
SELECT DISTINCT
    ModuleName,
    Description,
    1,
    GETDATE(),
    'migration-script'
FROM Events
WHERE ModuleName IS NOT NULL;

-- Step 4: Create EventModules relationships
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate)
SELECT
    e.EventId,
    m.ModuleId,
    e.SpeakerName,
    1,
    e.ModuleDate
FROM Events e
INNER JOIN Modules m ON e.ModuleName = m.ModuleName
WHERE e.ModuleName IS NOT NULL;

-- Step 5: Update Feedback table to link to EventModules
ALTER TABLE Feedback
ADD EventModuleId INT NULL;

UPDATE f
SET f.EventModuleId = (
    SELECT TOP 1 em.EventModuleId
    FROM EventModules em
    WHERE em.EventId = f.EventId
    ORDER BY em.DeliveryOrder
)
FROM Feedback f
WHERE f.EventId IS NOT NULL;

-- Step 6: Add foreign key constraint
ALTER TABLE Feedback
ADD CONSTRAINT FK_Feedback_EventModule
FOREIGN KEY (EventModuleId) REFERENCES EventModules(EventModuleId);

-- Step 7: Drop deprecated columns from Events (optional)
-- Uncomment when ready to fully migrate
-- ALTER TABLE Events DROP COLUMN ModuleName;
-- ALTER TABLE Events DROP COLUMN ModuleDate;
-- ALTER TABLE Events DROP COLUMN SpeakerName;
-- ALTER TABLE Events DROP COLUMN Description;
```

## Current Schema

### Tables

#### Events
Stores event metadata and scheduling information.

```sql
CREATE TABLE Events (
    EventId INT IDENTITY(1,1) PRIMARY KEY,
    EventCode NVARCHAR(20) UNIQUE NOT NULL,
    StartDate DATE NULL,
    EndDate DATE NULL,
    CohortId NVARCHAR(50) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL,

    -- Deprecated V1 columns (kept for backward compatibility)
    ModuleName NVARCHAR(200) NULL,
    ModuleDate DATE NULL,
    SpeakerName NVARCHAR(100) NULL,
    Description NVARCHAR(MAX) NULL
);

CREATE NONCLUSTERED INDEX IX_Events_EventCode ON Events(EventCode);
CREATE NONCLUSTERED INDEX IX_Events_IsActive_StartDate ON Events(IsActive, StartDate DESC);
```

**Fields:**
- `EventId`: Primary key
- `EventCode`: Unique identifier for QR codes and URLs
- `StartDate`: Event start date
- `EndDate`: Optional event end date
- `CohortId`: Cohort/batch identifier
- `IsActive`: Soft delete flag
- Deprecated fields maintained for backward compatibility

#### Modules
Stores reusable module definitions.

```sql
CREATE TABLE Modules (
    ModuleId INT IDENTITY(1,1) PRIMARY KEY,
    ModuleName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL
);

CREATE NONCLUSTERED INDEX IX_Modules_ModuleName ON Modules(ModuleName);
CREATE NONCLUSTERED INDEX IX_Modules_IsActive ON Modules(IsActive);
```

**Fields:**
- `ModuleId`: Primary key
- `ModuleName`: Name of the module (e.g., "Introduction to CAT")
- `Description`: Detailed description
- `IsActive`: Soft delete flag

#### EventModules (Junction Table)
Links events to modules with delivery information.

```sql
CREATE TABLE EventModules (
    EventModuleId INT IDENTITY(1,1) PRIMARY KEY,
    EventId INT NOT NULL,
    ModuleId INT NOT NULL,
    SpeakerName NVARCHAR(100) NULL,
    DeliveryOrder INT NOT NULL DEFAULT 1,
    DeliveryDate DATE NULL,
    FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE,
    FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId),
    CONSTRAINT UQ_Event_Module_Order UNIQUE (EventId, DeliveryOrder)
);

CREATE NONCLUSTERED INDEX IX_EventModules_EventId ON EventModules(EventId);
CREATE NONCLUSTERED INDEX IX_EventModules_ModuleId ON EventModules(ModuleId);
CREATE NONCLUSTERED INDEX IX_EventModules_EventId_Order
    ON EventModules(EventId, DeliveryOrder);
```

**Fields:**
- `EventModuleId`: Primary key
- `EventId`: Foreign key to Events
- `ModuleId`: Foreign key to Modules
- `SpeakerName`: Speaker for this specific module delivery
- `DeliveryOrder`: Order in which modules are delivered (1, 2, 3...)
- `DeliveryDate`: When this module was/will be delivered

**Constraints:**
- Unique constraint on (EventId, DeliveryOrder) ensures no duplicate orders
- Cascade delete: Deleting an event removes its EventModules

#### Feedback
Stores feedback submissions linked to specific module deliveries.

```sql
CREATE TABLE Feedback (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    EventId INT NOT NULL,
    EventCode NVARCHAR(20) NOT NULL,
    EventModuleId INT NULL,
    SpeakerKnowledge INT NOT NULL CHECK (SpeakerKnowledge BETWEEN 1 AND 5),
    ContentDepth NVARCHAR(20) NOT NULL
        CHECK (ContentDepth IN ('Too Technical', 'Just Right', 'Too Low Level')),
    ModuleSatisfaction INT NOT NULL CHECK (ModuleSatisfaction BETWEEN 1 AND 5),
    AdditionalComments NVARCHAR(MAX) NULL,
    SubmittedAt DATETIME2 DEFAULT GETDATE(),
    IpAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    FOREIGN KEY (EventId) REFERENCES Events(EventId),
    FOREIGN KEY (EventModuleId) REFERENCES EventModules(EventModuleId)
);

CREATE NONCLUSTERED INDEX IX_Feedback_EventId_SubmittedAt
    ON Feedback(EventId, SubmittedAt DESC);
CREATE NONCLUSTERED INDEX IX_Feedback_EventModuleId
    ON Feedback(EventModuleId);
CREATE NONCLUSTERED INDEX IX_Feedback_SubmittedAt
    ON Feedback(SubmittedAt DESC);
```

**Fields:**
- `EventModuleId`: Links feedback to specific module delivery (V2 addition)
- `EventId`: Legacy link to event (kept for compatibility)
- All other fields remain unchanged from V1

#### Users
Stores authenticated user accounts (replaces ADMIN_USERS_JSON env var).

```sql
CREATE TABLE Users (
    UserId              INT PRIMARY KEY IDENTITY(1,1),
    Username            NVARCHAR(100) NOT NULL,
    PasswordHash        NVARCHAR(255) NOT NULL,
    FullName            NVARCHAR(200) NOT NULL,
    Email               NVARCHAR(255) NOT NULL,
    IsActive            BIT NOT NULL DEFAULT 1,
    IsProtected         BIT NOT NULL DEFAULT 0,
    MustChangePassword  BIT NOT NULL DEFAULT 0,
    ProfileImage        NVARCHAR(MAX) NULL,
    PasswordResetToken  NVARCHAR(255) NULL,
    PasswordResetExpiry DATETIME2 NULL,
    LastLoginAt         DATETIME2 NULL,
    CreatedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy           NVARCHAR(100) NULL,
    UpdatedAt           DATETIME2 NULL,
    UpdatedBy           NVARCHAR(100) NULL,
    CONSTRAINT UQ_Users_Username UNIQUE (Username),
    CONSTRAINT UQ_Users_Email UNIQUE (Email)
);

CREATE INDEX IX_Users_Username ON Users(Username);
CREATE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_IsActive ON Users(IsActive);
```

**Fields:**
- `UserId`: Primary key
- `Username`: Unique login name
- `PasswordHash`: bcrypt hash of the user's password
- `FullName`: Display name
- `Email`: Unique email address
- `IsActive`: Soft delete / deactivation flag
- `IsProtected`: Prevents deactivation or removal of GlobalAdmin role
- `MustChangePassword`: Forces password change on next login
- `ProfileImage`: Base64-encoded profile image (optional)
- `PasswordResetToken` / `PasswordResetExpiry`: For password recovery flow
- `LastLoginAt`: Timestamp of most recent login

#### Roles
Stores the 6 system-defined RBAC roles.

```sql
CREATE TABLE Roles (
    RoleId      INT PRIMARY KEY IDENTITY(1,1),
    RoleName    NVARCHAR(50) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsSystem    BIT NOT NULL DEFAULT 0,
    CONSTRAINT UQ_Roles_RoleName UNIQUE (RoleName)
);
```

**Seeded Roles:** GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer

#### UserRoles (Junction Table)
Links users to their assigned roles.

```sql
CREATE TABLE UserRoles (
    UserRoleId  INT PRIMARY KEY IDENTITY(1,1),
    UserId      INT NOT NULL,
    RoleId      INT NOT NULL,
    AssignedAt  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    AssignedBy  NVARCHAR(100) NULL,
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES Roles(RoleId),
    CONSTRAINT UQ_UserRoles UNIQUE (UserId, RoleId)
);

CREATE INDEX IX_UserRoles_UserId ON UserRoles(UserId);
CREATE INDEX IX_UserRoles_RoleId ON UserRoles(RoleId);
```

#### UserEventAccess (Resource-Level Security)
Controls which events a non-GlobalAdmin user can access.

```sql
CREATE TABLE UserEventAccess (
    UserEventAccessId   INT PRIMARY KEY IDENTITY(1,1),
    UserId              INT NOT NULL,
    EventId             INT NOT NULL,
    GrantedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    GrantedBy           NVARCHAR(100) NULL,
    CONSTRAINT FK_UserEventAccess_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserEventAccess_Events FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE,
    CONSTRAINT UQ_UserEventAccess UNIQUE (UserId, EventId)
);

CREATE INDEX IX_UserEventAccess_UserId ON UserEventAccess(UserId);
CREATE INDEX IX_UserEventAccess_EventId ON UserEventAccess(EventId);
```

#### AuditLog
Tracks all authenticated user actions. Anonymous feedback is never logged.

```sql
CREATE TABLE AuditLog (
    AuditLogId      BIGINT PRIMARY KEY IDENTITY(1,1),
    UserId          INT NOT NULL,
    Username        NVARCHAR(100) NOT NULL,
    Action          NVARCHAR(50) NOT NULL,
    ResourceType    NVARCHAR(50) NOT NULL,
    ResourceId      NVARCHAR(100) NULL,
    Summary         NVARCHAR(500) NOT NULL,
    Details         NVARCHAR(MAX) NULL,
    IpAddress       NVARCHAR(45) NULL,
    Timestamp       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_AuditLog_Timestamp ON AuditLog(Timestamp DESC);
CREATE INDEX IX_AuditLog_UserId ON AuditLog(UserId);
CREATE INDEX IX_AuditLog_Action ON AuditLog(Action);
CREATE INDEX IX_AuditLog_ResourceType ON AuditLog(ResourceType);
```

**Fields:**
- `AuditLogId`: Primary key (BIGINT for high-volume logging)
- `UserId` / `Username`: The actor
- `Action`: What was done (LOGIN, CREATE, UPDATE, DELETE, etc.)
- `ResourceType`: What type of resource was affected
- `ResourceId`: Identifier of the affected resource
- `Summary`: Human-readable description
- `Details`: JSON payload with full change details
- `IpAddress`: Client IP
- `Timestamp`: UTC timestamp

## Entity Relationship Diagram

```
┌─────────────────┐                    ┌─────────────────┐
│     Events      │                    │     Users       │
│─────────────────│                    │─────────────────│
│ EventId (PK)    │                    │ UserId (PK)     │
│ EventCode       │                    │ Username        │
│ StartDate       │                    │ PasswordHash    │
│ EndDate         │                    │ FullName        │
│ CohortId        │                    │ Email           │
│ IsActive        │                    │ IsActive        │
└────────┬────────┘                    │ IsProtected     │
         │                             │ ProfileImage    │
         │ 1:N                         └───┬─────┬──────┘
         │                                 │     │
         ▼                                 │     │
┌─────────────────────┐                    │     │
│   EventModules      │          ┌─────────┘     │
│─────────────────────│          │               │
│ EventModuleId (PK)  │          ▼               ▼
│ EventId (FK)        │──┐  ┌──────────────┐ ┌──────────────┐
│ ModuleId (FK)       │  │  │  UserRoles   │ │UserEventAcces│
│ SpeakerName         │  │  │──────────────│ │──────────────│
│ DeliveryOrder       │  │  │ UserId (FK)  │ │ UserId (FK)  │
│ DeliveryDate        │  │  │ RoleId (FK)  │ │ EventId (FK) │
└──────────┬──────────┘  │  └──────┬───────┘ └──────────────┘
           │             │         │
           │ 1:N         │ N:1     │ N:1
           │             │         ▼
           ▼             ▼    ┌──────────┐
    ┌──────────┐   ┌──────────┐│  Roles   │
    │ Feedback │   │ Modules  ││──────────│
    │──────────│   │──────────││ RoleId   │
    │(links to │   │ ModuleId ││ RoleName │
    │EventModu │   │ModuleName│└──────────┘
    │leId)     │   │Descripti │
    └──────────┘   └──────────┘    ┌──────────────┐
                                   │   AuditLog   │
                                   │──────────────│
                                   │ UserId       │
                                   │ Username     │
                                   │ Action       │
                                   │ ResourceType │
                                   │ Timestamp    │
                                   └──────────────┘
```

## Query Patterns

### Get Event with All Modules

```sql
SELECT
    e.EventId,
    e.EventCode,
    e.StartDate,
    e.CohortId,
    m.ModuleId,
    m.ModuleName,
    m.Description,
    em.SpeakerName,
    em.DeliveryOrder,
    em.DeliveryDate
FROM Events e
LEFT JOIN EventModules em ON e.EventId = em.EventId
LEFT JOIN Modules m ON em.ModuleId = m.ModuleId
WHERE e.EventCode = @eventCode
ORDER BY em.DeliveryOrder;
```

### Get Module with Events and Feedback Count

```sql
SELECT
    m.ModuleId,
    m.ModuleName,
    m.Description,
    COUNT(DISTINCT em.EventId) AS EventCount,
    COUNT(f.FeedbackId) AS FeedbackCount
FROM Modules m
LEFT JOIN EventModules em ON m.ModuleId = em.ModuleId
LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
WHERE m.IsActive = 1
GROUP BY m.ModuleId, m.ModuleName, m.Description
ORDER BY m.ModuleName;
```

### Get Feedback for Specific Module Delivery

```sql
SELECT
    f.FeedbackId,
    e.EventCode,
    m.ModuleName,
    em.SpeakerName,
    f.SpeakerKnowledge,
    f.ContentDepth,
    f.ModuleSatisfaction,
    f.AdditionalComments,
    f.SubmittedAt
FROM Feedback f
INNER JOIN EventModules em ON f.EventModuleId = em.EventModuleId
INNER JOIN Events e ON f.EventId = e.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
WHERE em.EventModuleId = @eventModuleId
ORDER BY f.SubmittedAt DESC;
```

### Get Per-Module Feedback Counts for Event

```sql
SELECT
    em.EventModuleId,
    m.ModuleName,
    em.SpeakerName,
    em.DeliveryOrder,
    COUNT(f.FeedbackId) AS FeedbackCount,
    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction
FROM EventModules em
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
WHERE em.EventId = @eventId
GROUP BY em.EventModuleId, m.ModuleName, em.SpeakerName, em.DeliveryOrder
ORDER BY em.DeliveryOrder;
```

### Get User with Roles

```sql
SELECT
    u.UserId,
    u.Username,
    u.FullName,
    u.Email,
    u.IsActive,
    u.IsProtected,
    u.LastLoginAt,
    r.RoleName
FROM Users u
LEFT JOIN UserRoles ur ON u.UserId = ur.UserId
LEFT JOIN Roles r ON ur.RoleId = r.RoleId
WHERE u.Username = @username;
```

### Get Accessible Events for User

```sql
SELECT e.*
FROM Events e
INNER JOIN UserEventAccess uea ON e.EventId = uea.EventId
WHERE uea.UserId = @userId
  AND e.IsActive = 1
ORDER BY e.StartDate DESC;
```

### Query Audit Log

```sql
SELECT
    al.AuditLogId,
    al.UserId,
    al.Username,
    al.Action,
    al.ResourceType,
    al.ResourceId,
    al.Summary,
    al.Details,
    al.IpAddress,
    al.Timestamp
FROM AuditLog al
WHERE (@userId IS NULL OR al.UserId = @userId)
  AND (@action IS NULL OR al.Action = @action)
  AND (@resourceType IS NULL OR al.ResourceType = @resourceType)
  AND al.Timestamp BETWEEN @startDate AND @endDate
ORDER BY al.Timestamp DESC;
```

## Data Integrity

### Foreign Key Constraints

1. **EventModules → Events**: ON DELETE CASCADE
   - Deleting an event automatically removes its EventModules

2. **EventModules → Modules**: No cascade
   - Deleting a module fails if it's in use
   - Use soft delete (IsActive = 0) instead

3. **Feedback → Events**: No cascade
   - Feedback preserved even if event deleted (archive)

4. **Feedback → EventModules**: No cascade
   - Feedback preserved for historical analysis

### Check Constraints

1. **SpeakerKnowledge**: Between 1 and 5
2. **ModuleSatisfaction**: Between 1 and 5
3. **ContentDepth**: Must be one of three values

### Unique Constraints

1. **Events.EventCode**: Must be unique
2. **EventModules (EventId, DeliveryOrder)**: No duplicate orders per event

## Performance Optimization

### Indexes

All critical queries have supporting indexes:
- Event lookups by code
- Module lookups by name
- Feedback queries by event/module
- Date range queries
- Active status filters

### Connection Pooling

The API uses connection pooling to reuse database connections:
```javascript
pool: {
    max: 10,        // Maximum connections
    min: 0,         // Minimum connections
    idleTimeoutMillis: 30000
}
```

## Backup and Recovery

### Automated Backups

Azure SQL Database provides:
- Point-in-time restore (7-35 days)
- Geo-redundant backups
- Long-term retention policies

### Backup Commands

```bash
# Create manual backup
az sql db copy \
  --resource-group cat-bootcamp-qa-rg \
  --server cat-bootcamp-sql-qa2 \
  --name CATBootcampFeedback-QA \
  --dest-name CATBootcampFeedback-QA_Backup_$(date +%Y%m%d)

# Restore from backup
az sql db restore \
  --resource-group cat-bootcamp-qa-rg \
  --server cat-bootcamp-sql-qa2 \
  --name CATBootcampFeedback-QA \
  --dest-name CATBootcampFeedback-QA_Restored \
  --time "2026-02-04T12:00:00Z"
```

## Migration Status

- [x] V2 schema created
- [x] EventModules junction table created
- [x] Modules table created
- [x] Data migrated from V1 to V2
- [x] Feedback linked to EventModules
- [x] Indexes created
- [x] Foreign key constraints added
- [x] API updated to use V2 schema
- [x] Migration 002: Users, Roles, UserRoles, UserEventAccess tables (RBAC)
- [x] Migration 003: ProfileImage column added to Users
- [x] Migration 004: AuditLog table
- [x] Migration 005: EventCode widened to NVARCHAR(50)
- [ ] V1 deprecated columns removed (pending)

## Sample Data

```sql
-- Insert sample modules
INSERT INTO Modules (ModuleName, Description, IsActive, CreatedBy)
VALUES
    ('Introduction to CAT', 'Getting started with CAT Bootcamp', 1, 'system'),
    ('Advanced CAT Topics', 'Deep dive into advanced concepts', 1, 'system'),
    ('CAT Best Practices', 'Industry best practices', 1, 'system'),
    ('Hands-on Lab', 'Practical exercises', 1, 'system');

-- Insert sample event
INSERT INTO Events (EventCode, StartDate, EndDate, CohortId, IsActive)
VALUES ('TEST2026', '2026-03-01', '2026-03-05', 'Q1-2026', 1);

-- Link modules to event
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate)
VALUES
    (1, 1, 'John Doe', 1, '2026-03-01'),
    (1, 2, 'Jane Smith', 2, '2026-03-02'),
    (1, 3, 'Bob Johnson', 3, '2026-03-03'),
    (1, 4, 'Alice Williams', 4, '2026-03-04');
```

## Future Enhancements

### Planned V3 Features

- Soft delete tracking (DeletedAt, DeletedBy)
- ~~Audit logging table~~ -- **DONE** (Migration 004)
- Module categories/tags
- Module prerequisites
- Speaker profiles table
- Event templates
- Bulk import/export capabilities
- ~~Email service integration~~ -- **DONE** (Azure Communication Services configured)

---

**Schema Version:** V2.5
**Last Updated:** 2026-03-28
**Status:** ✅ Production Ready
**Next Review:** After 1000 feedback submissions
