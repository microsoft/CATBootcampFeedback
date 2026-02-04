# Database Architecture V2

## Overview

The CAT Bootcamp Feedback application uses a normalized Azure SQL Database with a many-to-many relationship between Events and Modules through an EventModules junction table.

## Schema Version

**Current Version:** V2 (February 2026)
**Previous Version:** V1 (deprecated)

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

## Entity Relationship Diagram

```
┌─────────────────┐
│     Events      │
│─────────────────│
│ EventId (PK)    │
│ EventCode       │
│ StartDate       │
│ EndDate         │
│ CohortId        │
│ IsActive        │
└────────┬────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────────┐
│   EventModules      │
│─────────────────────│
│ EventModuleId (PK)  │
│ EventId (FK)        │──┐
│ ModuleId (FK)       │  │
│ SpeakerName         │  │
│ DeliveryOrder       │  │
│ DeliveryDate        │  │
└──────────┬──────────┘  │
           │             │
           │ 1:N         │ N:1
           │             │
           ▼             ▼
    ┌──────────┐   ┌──────────┐
    │ Feedback │   │ Modules  │
    │──────────│   │──────────│
    │(links to │   │ ModuleId │
    │EventModu │   │ModuleName│
    │leId)     │   │Descripti │
    └──────────┘   └──────────┘
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
  --resource-group cat-bootcamp-rg \
  --server cat-bootcamp-sql-89082 \
  --name CATBootcampFeedback \
  --dest-name CATBootcampFeedback_Backup_$(date +%Y%m%d)

# Restore from backup
az sql db restore \
  --resource-group cat-bootcamp-rg \
  --server cat-bootcamp-sql-89082 \
  --name CATBootcampFeedback \
  --dest-name CATBootcampFeedback_Restored \
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
- Audit logging table
- Module categories/tags
- Module prerequisites
- Speaker profiles table
- Event templates
- Bulk import/export capabilities

---

**Schema Version:** V2
**Last Updated:** 2026-02-04
**Status:** ✅ Production Ready
**Next Review:** After 1000 feedback submissions
