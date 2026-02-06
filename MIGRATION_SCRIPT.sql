-- ============================================
-- CAT Bootcamp Feedback - Database Migration
-- From: Events-only schema
-- To: Modules + Events separated schema
-- ============================================
-- Date: 2026-02-04
-- IMPORTANT: Backup database before running!
-- ============================================

PRINT 'Starting database migration...'
GO

-- ============================================
-- STEP 1: Create Modules table
-- ============================================
PRINT 'Step 1: Creating Modules table...'
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Modules')
BEGIN
    CREATE TABLE Modules (
        ModuleId INT PRIMARY KEY IDENTITY(1,1),
        ModuleName NVARCHAR(200) NOT NULL,
        SpeakerName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy NVARCHAR(100) NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy NVARCHAR(100) NULL
    );
    PRINT '✓ Modules table created'
END
ELSE
BEGIN
    PRINT '⚠ Modules table already exists'
END
GO

-- ============================================
-- STEP 2: Backup existing Events table
-- ============================================
PRINT 'Step 2: Backing up existing Events table...'
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Events')
   AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Events_Backup_Old')
BEGIN
    SELECT * INTO Events_Backup_Old FROM Events;
    PRINT '✓ Events table backed up to Events_Backup_Old'
END
ELSE
BEGIN
    PRINT '⚠ Events backup already exists or Events table not found'
END
GO

-- ============================================
-- STEP 3: Migrate module data from Events to Modules
-- ============================================
PRINT 'Step 3: Migrating module data...'
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Events_Backup_Old')
   AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events_Backup_Old') AND name = 'ModuleName')
BEGIN
    -- Insert unique modules from old Events table
    INSERT INTO Modules (ModuleName, SpeakerName, Description, IsActive, CreatedAt, CreatedBy)
    SELECT DISTINCT
        ModuleName,
        SpeakerName,
        ISNULL(Description, '') AS Description,
        IsActive,
        MIN(CreatedAt) AS CreatedAt,
        MIN(ISNULL(CreatedBy, 'system')) AS CreatedBy
    FROM Events_Backup_Old
    WHERE ModuleName IS NOT NULL
    GROUP BY ModuleName, SpeakerName, ISNULL(Description, ''), IsActive;

    PRINT '✓ Migrated ' + CAST(@@ROWCOUNT AS VARCHAR) + ' modules'
END
ELSE
BEGIN
    PRINT 'ℹ No old Events data to migrate'
END
GO

-- ============================================
-- STEP 4: Create new Events table structure
-- ============================================
PRINT 'Step 4: Creating new Events table...'
GO

-- Drop old Events table if it still has the old structure
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'ModuleName')
BEGIN
    DROP TABLE IF EXISTS Events;
    PRINT '✓ Dropped old Events table structure'
END
GO

-- Create new Events table with proper structure
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Events')
BEGIN
    CREATE TABLE Events (
        EventId INT PRIMARY KEY IDENTITY(1,1),
        EventCode NVARCHAR(8) NOT NULL UNIQUE,
        ModuleId INT NOT NULL,
        StartDate DATETIME NOT NULL,
        EndDate DATETIME NULL,
        CohortId NVARCHAR(50) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy NVARCHAR(100) NULL,
        CONSTRAINT FK_Events_Modules FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId) ON DELETE CASCADE
    );

    CREATE INDEX IX_Events_EventCode ON Events(EventCode);
    CREATE INDEX IX_Events_ModuleId ON Events(ModuleId);

    PRINT '✓ New Events table created with proper structure'
END
ELSE
BEGIN
    PRINT '⚠ Events table already exists with new structure'
END
GO

-- ============================================
-- STEP 5: Migrate event codes to new Events table
-- ============================================
PRINT 'Step 5: Migrating event codes...'
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Events_Backup_Old')
   AND EXISTS (SELECT * FROM Modules)
BEGIN
    -- Insert events linked to modules
    INSERT INTO Events (EventCode, ModuleId, StartDate, EndDate, CohortId, IsActive, CreatedAt, CreatedBy)
    SELECT
        ebo.EventCode,
        m.ModuleId,
        ISNULL(ebo.ModuleDate, GETDATE()) AS StartDate,
        NULL AS EndDate,  -- Old schema didn't have end date
        ebo.CohortId,
        ebo.IsActive,
        ebo.CreatedAt,
        ebo.CreatedBy
    FROM Events_Backup_Old ebo
    INNER JOIN Modules m ON
        ebo.ModuleName = m.ModuleName AND
        ebo.SpeakerName = m.SpeakerName
    WHERE ebo.EventCode IS NOT NULL;

    PRINT '✓ Migrated ' + CAST(@@ROWCOUNT AS VARCHAR) + ' events'
END
ELSE
BEGIN
    PRINT 'ℹ No old event data to migrate'
END
GO

-- ============================================
-- STEP 6: Update Feedback table if needed
-- ============================================
PRINT 'Step 6: Updating Feedback table...'
GO

-- Feedback table should already have EventId and EventCode
-- Just verify the foreign key constraint exists
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys
    WHERE name = 'FK_Feedback_Events' AND parent_object_id = OBJECT_ID('Feedback')
)
BEGIN
    ALTER TABLE Feedback
    ADD CONSTRAINT FK_Feedback_Events
    FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE;

    PRINT '✓ Added foreign key constraint to Feedback table'
END
ELSE
BEGIN
    PRINT '✓ Feedback table already has proper foreign key'
END
GO

-- ============================================
-- STEP 7: Create Views
-- ============================================
PRINT 'Step 7: Creating views...'
GO

-- View: Events with Module Details
IF OBJECT_ID('vw_EventsWithModules', 'V') IS NOT NULL
    DROP VIEW vw_EventsWithModules;
GO

CREATE VIEW vw_EventsWithModules AS
SELECT
    e.EventId,
    e.EventCode,
    e.ModuleId,
    m.ModuleName,
    m.SpeakerName,
    m.Description AS ModuleDescription,
    e.StartDate,
    e.EndDate,
    e.CohortId,
    e.IsActive AS EventIsActive,
    m.IsActive AS ModuleIsActive,
    e.CreatedAt AS EventCreatedAt,
    m.CreatedAt AS ModuleCreatedAt
FROM Events e
INNER JOIN Modules m ON e.ModuleId = m.ModuleId;
GO

PRINT '✓ Created vw_EventsWithModules'
GO

-- View: Feedback with Event and Module Details
IF OBJECT_ID('vw_FeedbackWithDetails', 'V') IS NOT NULL
    DROP VIEW vw_FeedbackWithDetails;
GO

CREATE VIEW vw_FeedbackWithDetails AS
SELECT
    f.FeedbackId,
    f.EventId,
    f.EventCode,
    e.ModuleId,
    m.ModuleName,
    m.SpeakerName,
    e.StartDate,
    e.EndDate,
    e.CohortId,
    f.SpeakerKnowledge,
    f.ContentDepth,
    f.ModuleSatisfaction,
    f.AdditionalComments,
    f.SubmittedAt,
    f.IpAddress
FROM Feedback f
INNER JOIN Events e ON f.EventId = e.EventId
INNER JOIN Modules m ON e.ModuleId = m.ModuleId;
GO

PRINT '✓ Created vw_FeedbackWithDetails'
GO

-- View: Event Feedback Counts (for live counter)
IF OBJECT_ID('vw_EventFeedbackCounts', 'V') IS NOT NULL
    DROP VIEW vw_EventFeedbackCounts;
GO

CREATE VIEW vw_EventFeedbackCounts AS
SELECT
    e.EventId,
    e.EventCode,
    e.ModuleId,
    m.ModuleName,
    m.SpeakerName,
    e.StartDate,
    e.EndDate,
    e.CohortId,
    COUNT(f.FeedbackId) AS FeedbackCount,
    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction,
    MAX(f.SubmittedAt) AS LastSubmittedAt
FROM Events e
INNER JOIN Modules m ON e.ModuleId = m.ModuleId
LEFT JOIN Feedback f ON e.EventId = f.EventId
GROUP BY e.EventId, e.EventCode, e.ModuleId, m.ModuleName, m.SpeakerName,
         e.StartDate, e.EndDate, e.CohortId;
GO

PRINT '✓ Created vw_EventFeedbackCounts'
GO

-- ============================================
-- STEP 8: Create Stored Procedures
-- ============================================
PRINT 'Step 8: Creating stored procedures...'
GO

-- Get Event by Code
IF OBJECT_ID('sp_GetEventByCode', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetEventByCode;
GO

CREATE PROCEDURE sp_GetEventByCode
    @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT
        e.EventId,
        e.EventCode,
        e.ModuleId,
        m.ModuleName,
        m.SpeakerName,
        e.StartDate,
        e.EndDate,
        e.CohortId,
        m.Description,
        e.IsActive AS EventIsActive,
        m.IsActive AS ModuleIsActive,
        e.CreatedAt
    FROM Events e
    INNER JOIN Modules m ON e.ModuleId = m.ModuleId
    WHERE e.EventCode = @EventCode AND e.IsActive = 1 AND m.IsActive = 1;
END;
GO

PRINT '✓ Created sp_GetEventByCode'
GO

-- Get Feedback Count by Event Code
IF OBJECT_ID('sp_GetFeedbackCountByEventCode', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetFeedbackCountByEventCode;
GO

CREATE PROCEDURE sp_GetFeedbackCountByEventCode
    @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT
        EventId,
        EventCode,
        ModuleId,
        ModuleName,
        SpeakerName,
        StartDate,
        EndDate,
        CohortId,
        FeedbackCount,
        AvgSpeakerKnowledge,
        AvgModuleSatisfaction,
        LastSubmittedAt
    FROM vw_EventFeedbackCounts
    WHERE EventCode = @EventCode;
END;
GO

PRINT '✓ Created sp_GetFeedbackCountByEventCode'
GO

-- ============================================
-- STEP 9: Verification
-- ============================================
PRINT 'Step 9: Verifying migration...'
GO

DECLARE @ModuleCount INT, @EventCount INT, @FeedbackCount INT;

SELECT @ModuleCount = COUNT(*) FROM Modules;
SELECT @EventCount = COUNT(*) FROM Events;
SELECT @FeedbackCount = COUNT(*) FROM Feedback;

PRINT 'Migration Summary:'
PRINT '  Modules: ' + CAST(@ModuleCount AS VARCHAR)
PRINT '  Events: ' + CAST(@EventCount AS VARCHAR)
PRINT '  Feedback: ' + CAST(@FeedbackCount AS VARCHAR)
GO

-- ============================================
-- STEP 10: Insert Sample Data (if tables are empty)
-- ============================================
PRINT 'Step 10: Checking if sample data needed...'
GO

DECLARE @NeedsSampleData BIT = 0;

IF (SELECT COUNT(*) FROM Modules) = 0
BEGIN
    SET @NeedsSampleData = 1;
    PRINT 'Inserting sample data...'

    -- Insert sample modules
    INSERT INTO Modules (ModuleName, SpeakerName, Description)
    VALUES
        ('Introduction to Copilot Studio', 'John Doe', 'Getting started with Copilot Studio basics'),
        ('Building Your First Copilot', 'Jane Smith', 'Hands-on copilot development'),
        ('Advanced Copilot Techniques', 'Mike Johnson', 'Advanced features and best practices');

    -- Insert sample events
    INSERT INTO Events (EventCode, ModuleId, StartDate, EndDate, CohortId, IsActive)
    VALUES
        ('CSA1B2C3', 1, '2026-02-15 09:00:00', '2026-02-15 17:00:00', 'Q1-2026', 1),
        ('CSXYZ789', 2, '2026-02-16 09:00:00', '2026-02-16 17:00:00', 'Q1-2026', 1),
        ('CSABC456', 3, '2026-02-17 09:00:00', '2026-02-17 17:00:00', 'Q1-2026', 1);

    PRINT '✓ Sample data inserted'
END
ELSE
BEGIN
    PRINT 'ℹ Existing data found, skipping sample data'
END
GO

-- ============================================
-- COMPLETION
-- ============================================
PRINT ''
PRINT '============================================'
PRINT '✓ Migration completed successfully!'
PRINT '============================================'
PRINT ''
PRINT 'Next steps:'
PRINT '1. Verify data with: SELECT * FROM vw_EventsWithModules'
PRINT '2. Test feedback count: EXEC sp_GetFeedbackCountByEventCode ''CSA1B2C3'''
PRINT '3. Deploy updated API endpoints'
PRINT '4. Update frontend to use new structure'
PRINT ''
PRINT 'Note: Old Events table backed up as Events_Backup_Old'
PRINT '============================================'
GO
