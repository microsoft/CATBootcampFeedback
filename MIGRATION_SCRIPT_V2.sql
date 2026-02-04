-- ============================================
-- CAT Bootcamp Feedback - Database Migration V2
-- From: Events (1) → (1) Modules
-- To: Events (1) → (many) EventModules (many) → (1) Modules
-- ============================================
-- Date: 2026-02-04
-- Changes:
-- - Remove SpeakerName from Modules (speaker is per delivery)
-- - Create EventModules junction table
-- - Migrate existing event-module links to junction table
-- - Update views and stored procedures
-- ============================================

PRINT 'Starting database migration V2...'
GO

-- ============================================
-- STEP 1: Backup current data
-- ============================================
PRINT 'Step 1: Creating backup tables...';
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Modules_Backup_V1')
BEGIN
    SELECT * INTO Modules_Backup_V1 FROM Modules;
    PRINT '✓ Modules backed up to Modules_Backup_V1';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Events_Backup_V1')
BEGIN
    SELECT * INTO Events_Backup_V1 FROM Events;
    PRINT '✓ Events backed up to Events_Backup_V1';
END
GO

-- ============================================
-- STEP 2: Create EventModules junction table
-- ============================================
PRINT 'Step 2: Creating EventModules junction table...';
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventModules')
BEGIN
    CREATE TABLE EventModules (
        EventModuleId INT PRIMARY KEY IDENTITY(1,1),
        EventId INT NOT NULL,
        ModuleId INT NOT NULL,
        SpeakerName NVARCHAR(100) NOT NULL,
        DeliveryOrder INT NOT NULL DEFAULT 1,
        DeliveryDate DATETIME NULL,
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy NVARCHAR(100) NULL,
        CONSTRAINT FK_EventModules_Events FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE,
        CONSTRAINT FK_EventModules_Modules FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId) ON DELETE CASCADE,
        CONSTRAINT UQ_EventModules_EventModule UNIQUE (EventId, ModuleId)
    );

    CREATE INDEX IX_EventModules_EventId ON EventModules(EventId);
    CREATE INDEX IX_EventModules_ModuleId ON EventModules(ModuleId);

    PRINT '✓ EventModules table created';
END
ELSE
BEGIN
    PRINT '⚠ EventModules table already exists';
END
GO

-- ============================================
-- STEP 3: Migrate existing event-module relationships
-- ============================================
PRINT 'Step 3: Migrating existing event-module relationships...';
GO

-- Migrate data from Events (which have ModuleId) to EventModules
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'ModuleId')
   AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Modules') AND name = 'SpeakerName')
BEGIN
    INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedAt, CreatedBy)
    SELECT
        e.EventId,
        e.ModuleId,
        m.SpeakerName,
        1 AS DeliveryOrder,
        e.StartDate AS DeliveryDate,
        e.CreatedAt,
        e.CreatedBy
    FROM Events e
    INNER JOIN Modules m ON e.ModuleId = m.ModuleId
    WHERE NOT EXISTS (
        SELECT 1 FROM EventModules em
        WHERE em.EventId = e.EventId AND em.ModuleId = e.ModuleId
    );

    PRINT '✓ Migrated ' + CAST(@@ROWCOUNT AS VARCHAR) + ' event-module relationships';
END
ELSE
BEGIN
    PRINT 'ℹ Migration already completed or not needed';
END
GO

-- ============================================
-- STEP 4: Remove ModuleId from Events table
-- ============================================
PRINT 'Step 4: Removing ModuleId from Events table...';
GO

-- Drop foreign key constraint first
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Events_Modules')
BEGIN
    ALTER TABLE Events DROP CONSTRAINT FK_Events_Modules;
    PRINT '✓ Dropped FK_Events_Modules constraint';
END
GO

-- Drop the column
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'ModuleId')
BEGIN
    ALTER TABLE Events DROP COLUMN ModuleId;
    PRINT '✓ Removed ModuleId column from Events';
END
GO

-- ============================================
-- STEP 5: Remove SpeakerName from Modules table
-- ============================================
PRINT 'Step 5: Removing SpeakerName from Modules table...';
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Modules') AND name = 'SpeakerName')
BEGIN
    ALTER TABLE Modules DROP COLUMN SpeakerName;
    PRINT '✓ Removed SpeakerName column from Modules';
END
GO

-- ============================================
-- STEP 6: Update Feedback table to link to EventModules
-- ============================================
PRINT 'Step 6: Updating Feedback table...';
GO

-- Add EventModuleId column if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Feedback') AND name = 'EventModuleId')
BEGIN
    ALTER TABLE Feedback ADD EventModuleId INT NULL;
    PRINT '✓ Added EventModuleId column to Feedback';
END
GO

-- Populate EventModuleId based on existing EventId (link to first module of event for now)
UPDATE f
SET f.EventModuleId = (
    SELECT TOP 1 em.EventModuleId
    FROM EventModules em
    WHERE em.EventId = f.EventId
    ORDER BY em.DeliveryOrder
)
FROM Feedback f
WHERE f.EventModuleId IS NULL AND f.EventId IS NOT NULL;
GO

PRINT '✓ Populated EventModuleId for existing feedback';
GO

-- Make EventModuleId required after population
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Feedback') AND name = 'EventModuleId' AND is_nullable = 1)
BEGIN
    -- Only set NOT NULL if all rows have values
    DECLARE @NullCount INT;
    SELECT @NullCount = COUNT(*) FROM Feedback WHERE EventModuleId IS NULL;

    IF @NullCount = 0
    BEGIN
        ALTER TABLE Feedback ALTER COLUMN EventModuleId INT NOT NULL;
        PRINT '✓ Made EventModuleId required in Feedback';
    END
    ELSE
    BEGIN
        PRINT '⚠ Cannot make EventModuleId required - ' + CAST(@NullCount AS VARCHAR) + ' rows have NULL values';
    END
END
GO

-- Add foreign key to EventModules
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Feedback_EventModules')
BEGIN
    ALTER TABLE Feedback
    ADD CONSTRAINT FK_Feedback_EventModules
    FOREIGN KEY (EventModuleId) REFERENCES EventModules(EventModuleId) ON DELETE CASCADE;
    PRINT '✓ Added FK_Feedback_EventModules constraint';
END
GO

-- ============================================
-- STEP 7: Update Views
-- ============================================
PRINT 'Step 7: Updating views...';
GO

-- Drop old views
IF OBJECT_ID('vw_EventsWithModules', 'V') IS NOT NULL DROP VIEW vw_EventsWithModules;
IF OBJECT_ID('vw_FeedbackWithDetails', 'V') IS NOT NULL DROP VIEW vw_FeedbackWithDetails;
IF OBJECT_ID('vw_EventFeedbackCounts', 'V') IS NOT NULL DROP VIEW vw_EventFeedbackCounts;
GO

-- View: Events with all their modules
CREATE VIEW vw_EventsWithModules AS
SELECT
    e.EventId,
    e.EventCode,
    e.StartDate,
    e.EndDate,
    e.CohortId,
    e.IsActive AS EventIsActive,
    e.CreatedAt AS EventCreatedAt,
    em.EventModuleId,
    em.ModuleId,
    m.ModuleName,
    em.SpeakerName,
    m.Description AS ModuleDescription,
    em.DeliveryOrder,
    em.DeliveryDate,
    m.IsActive AS ModuleIsActive
FROM Events e
INNER JOIN EventModules em ON e.EventId = em.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId;
GO

PRINT '✓ Created vw_EventsWithModules';
GO

-- View: Feedback with full event and module details
CREATE VIEW vw_FeedbackWithDetails AS
SELECT
    f.FeedbackId,
    f.EventId,
    f.EventCode,
    f.EventModuleId,
    em.ModuleId,
    m.ModuleName,
    em.SpeakerName,
    e.StartDate,
    e.EndDate,
    e.CohortId,
    em.DeliveryOrder,
    f.SpeakerKnowledge,
    f.ContentDepth,
    f.ModuleSatisfaction,
    f.AdditionalComments,
    f.SubmittedAt,
    f.IpAddress
FROM Feedback f
INNER JOIN EventModules em ON f.EventModuleId = em.EventModuleId
INNER JOIN Events e ON em.EventId = e.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId;
GO

PRINT '✓ Created vw_FeedbackWithDetails';
GO

-- View: Event feedback counts (aggregated across all modules)
CREATE VIEW vw_EventFeedbackCounts AS
SELECT
    e.EventId,
    e.EventCode,
    e.StartDate,
    e.EndDate,
    e.CohortId,
    COUNT(DISTINCT em.EventModuleId) AS ModuleCount,
    COUNT(f.FeedbackId) AS TotalFeedbackCount,
    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction,
    MAX(f.SubmittedAt) AS LastSubmittedAt
FROM Events e
LEFT JOIN EventModules em ON e.EventId = em.EventId
LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
GROUP BY e.EventId, e.EventCode, e.StartDate, e.EndDate, e.CohortId;
GO

PRINT '✓ Created vw_EventFeedbackCounts';
GO

-- ============================================
-- STEP 8: Update Stored Procedures
-- ============================================
PRINT 'Step 8: Updating stored procedures...';
GO

-- Drop old procedures
IF OBJECT_ID('sp_GetEventByCode', 'P') IS NOT NULL DROP PROCEDURE sp_GetEventByCode;
IF OBJECT_ID('sp_GetFeedbackCountByEventCode', 'P') IS NOT NULL DROP PROCEDURE sp_GetFeedbackCountByEventCode;
GO

-- Get Event with all modules
CREATE PROCEDURE sp_GetEventByCode
    @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT
        e.EventId,
        e.EventCode,
        e.StartDate,
        e.EndDate,
        e.CohortId,
        e.IsActive AS EventIsActive,
        e.CreatedAt
    FROM Events e
    WHERE e.EventCode = @EventCode AND e.IsActive = 1;

    -- Also return all modules for this event
    SELECT
        em.EventModuleId,
        em.ModuleId,
        m.ModuleName,
        em.SpeakerName,
        m.Description,
        em.DeliveryOrder,
        em.DeliveryDate,
        m.IsActive AS ModuleIsActive
    FROM EventModules em
    INNER JOIN Modules m ON em.ModuleId = m.ModuleId
    INNER JOIN Events e ON em.EventId = e.EventId
    WHERE e.EventCode = @EventCode AND e.IsActive = 1 AND m.IsActive = 1
    ORDER BY em.DeliveryOrder;
END;
GO

PRINT '✓ Created sp_GetEventByCode';
GO

-- Get feedback count by event
CREATE PROCEDURE sp_GetFeedbackCountByEventCode
    @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT
        EventId,
        EventCode,
        StartDate,
        EndDate,
        CohortId,
        ModuleCount,
        TotalFeedbackCount,
        AvgSpeakerKnowledge,
        AvgModuleSatisfaction,
        LastSubmittedAt
    FROM vw_EventFeedbackCounts
    WHERE EventCode = @EventCode;

    -- Also return per-module feedback counts
    SELECT
        em.EventModuleId,
        em.ModuleId,
        m.ModuleName,
        em.SpeakerName,
        em.DeliveryOrder,
        COUNT(f.FeedbackId) AS FeedbackCount,
        AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
        AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction
    FROM EventModules em
    INNER JOIN Modules m ON em.ModuleId = m.ModuleId
    INNER JOIN Events e ON em.EventId = e.EventId
    LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
    WHERE e.EventCode = @EventCode
    GROUP BY em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName, em.DeliveryOrder
    ORDER BY em.DeliveryOrder;
END;
GO

PRINT '✓ Created sp_GetFeedbackCountByEventCode';
GO

-- ============================================
-- STEP 9: Verification
-- ============================================
PRINT 'Step 9: Verifying migration...';
GO

DECLARE @ModuleCount INT, @EventCount INT, @EventModuleCount INT, @FeedbackCount INT;

SELECT @ModuleCount = COUNT(*) FROM Modules;
SELECT @EventCount = COUNT(*) FROM Events;
SELECT @EventModuleCount = COUNT(*) FROM EventModules;
SELECT @FeedbackCount = COUNT(*) FROM Feedback;

PRINT 'Migration Summary:';
PRINT '  Modules: ' + CAST(@ModuleCount AS VARCHAR);
PRINT '  Events: ' + CAST(@EventCount AS VARCHAR);
PRINT '  Event-Module Links: ' + CAST(@EventModuleCount AS VARCHAR);
PRINT '  Feedback: ' + CAST(@FeedbackCount AS VARCHAR);
GO

-- ============================================
-- COMPLETION
-- ============================================
PRINT '';
PRINT '============================================';
PRINT '✓ Migration V2 completed successfully!';
PRINT '============================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Test: SELECT * FROM vw_EventsWithModules';
PRINT '2. Test: EXEC sp_GetEventByCode ''CSA1B2C3''';
PRINT '3. Update API endpoints to use EventModules';
PRINT '4. Update admin interface for multi-module events';
PRINT '';
PRINT 'Note: Backups saved as Modules_Backup_V1 and Events_Backup_V1';
PRINT '============================================';
GO
