-- ============================================
-- Migration 006: Add Speakers, Event Templates
-- 1. Creates Speakers table (standardized speaker catalog)
-- 2. Creates EventTemplates + EventTemplateModules tables
-- 3. Migrates existing free-text speakers to Speakers table
-- 4. Adds SpeakerId FK to EventModules (dual-column approach)
-- 5. Updates views to include speaker details
-- ============================================

-- ============================================
-- PART 1: Create Speakers table
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Speakers')
BEGIN
    CREATE TABLE Speakers (
        SpeakerId       INT PRIMARY KEY IDENTITY(1,1),
        SpeakerName     NVARCHAR(100) NOT NULL,
        Bio             NVARCHAR(MAX) NULL,
        ProfileImage    NVARCHAR(MAX) NULL,
        IsActive        BIT NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy       NVARCHAR(100) NULL,
        UpdatedAt       DATETIME2 NULL,
        UpdatedBy       NVARCHAR(100) NULL
    );

    CREATE UNIQUE INDEX UQ_Speakers_Name ON Speakers(SpeakerName);
    CREATE INDEX IX_Speakers_IsActive ON Speakers(IsActive);

    PRINT 'Speakers table created';
END
ELSE
    PRINT 'Speakers table already exists -- skipping';
GO

-- ============================================
-- PART 2: Migrate existing speaker names
-- ============================================

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Speakers')
   AND NOT EXISTS (SELECT 1 FROM Speakers)
   AND EXISTS (SELECT 1 FROM EventModules WHERE SpeakerName IS NOT NULL AND LTRIM(RTRIM(SpeakerName)) <> '')
BEGIN
    INSERT INTO Speakers (SpeakerName, CreatedBy)
    SELECT DISTINCT LTRIM(RTRIM(SpeakerName)), 'MIGRATION-006'
    FROM EventModules
    WHERE SpeakerName IS NOT NULL AND LTRIM(RTRIM(SpeakerName)) <> '';

    PRINT 'Migrated existing speaker names to Speakers table';
END
ELSE
    PRINT 'Speaker migration skipped (already done or no data)';
GO

-- ============================================
-- PART 3: Add SpeakerId column to EventModules
-- ============================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventModules') AND name = 'SpeakerId')
BEGIN
    ALTER TABLE EventModules ADD SpeakerId INT NULL;
    PRINT 'Added SpeakerId column to EventModules';
END
ELSE
    PRINT 'SpeakerId column already exists -- skipping';
GO

-- Backfill SpeakerId from existing SpeakerName values
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventModules') AND name = 'SpeakerId')
   AND EXISTS (SELECT 1 FROM EventModules WHERE SpeakerId IS NULL AND SpeakerName IS NOT NULL)
BEGIN
    UPDATE em
    SET em.SpeakerId = s.SpeakerId
    FROM EventModules em
    INNER JOIN Speakers s ON LTRIM(RTRIM(em.SpeakerName)) = s.SpeakerName
    WHERE em.SpeakerId IS NULL;

    PRINT 'Backfilled SpeakerId in EventModules';
END
ELSE
    PRINT 'SpeakerId backfill skipped (already done or no data)';
GO

-- Add FK constraint (only if not already present)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventModules_Speaker')
BEGIN
    ALTER TABLE EventModules ADD CONSTRAINT FK_EventModules_Speaker
        FOREIGN KEY (SpeakerId) REFERENCES Speakers(SpeakerId);
    PRINT 'Added FK_EventModules_Speaker constraint';
END
ELSE
    PRINT 'FK_EventModules_Speaker already exists -- skipping';
GO

-- Add index on SpeakerId
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventModules_SpeakerId' AND object_id = OBJECT_ID('EventModules'))
BEGIN
    CREATE INDEX IX_EventModules_SpeakerId ON EventModules(SpeakerId);
    PRINT 'Added IX_EventModules_SpeakerId index';
END
ELSE
    PRINT 'IX_EventModules_SpeakerId already exists -- skipping';
GO

-- ============================================
-- PART 4: Create EventTemplates table
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventTemplates')
BEGIN
    CREATE TABLE EventTemplates (
        TemplateId      INT PRIMARY KEY IDENTITY(1,1),
        TemplateName    NVARCHAR(200) NOT NULL,
        Description     NVARCHAR(MAX) NULL,
        TrainingTrack   NVARCHAR(100) NULL,
        IsActive        BIT NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy       NVARCHAR(100) NULL,
        UpdatedAt       DATETIME2 NULL,
        UpdatedBy       NVARCHAR(100) NULL
    );

    CREATE INDEX IX_EventTemplates_IsActive ON EventTemplates(IsActive);

    PRINT 'EventTemplates table created';
END
ELSE
    PRINT 'EventTemplates table already exists -- skipping';
GO

-- ============================================
-- PART 5: Create EventTemplateModules junction table
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventTemplateModules')
BEGIN
    CREATE TABLE EventTemplateModules (
        TemplateModuleId INT PRIMARY KEY IDENTITY(1,1),
        TemplateId       INT NOT NULL,
        ModuleId         INT NOT NULL,
        DeliveryOrder    INT NOT NULL DEFAULT 1,
        Notes            NVARCHAR(MAX) NULL,
        CONSTRAINT FK_ETM_Template FOREIGN KEY (TemplateId) REFERENCES EventTemplates(TemplateId) ON DELETE CASCADE,
        CONSTRAINT FK_ETM_Module FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId) ON DELETE CASCADE,
        CONSTRAINT UQ_ETM_TemplateModule UNIQUE (TemplateId, ModuleId)
    );

    CREATE INDEX IX_ETM_TemplateId ON EventTemplateModules(TemplateId);
    CREATE INDEX IX_ETM_ModuleId ON EventTemplateModules(ModuleId);

    PRINT 'EventTemplateModules table created';
END
ELSE
    PRINT 'EventTemplateModules table already exists -- skipping';
GO

-- ============================================
-- PART 6: Update views to include speaker details
-- ============================================

-- Recreate vw_EventsWithModules with speaker join
DROP VIEW IF EXISTS vw_EventsWithModules;
GO

CREATE VIEW vw_EventsWithModules AS
SELECT
    e.EventId,
    e.EventName,
    e.EventCode,
    e.StartDate,
    e.EndDate,
    e.TrainingTrack,
    e.IsActive AS EventIsActive,
    e.CreatedAt AS EventCreatedAt,
    e.IsDeleted,
    em.EventModuleId,
    em.ModuleId,
    m.ModuleName,
    em.SpeakerName,
    em.SpeakerId,
    s.Bio AS SpeakerBio,
    s.ProfileImage AS SpeakerImage,
    m.Description AS ModuleDescription,
    em.DeliveryOrder,
    em.DeliveryDate,
    m.IsActive AS ModuleIsActive
FROM Events e
INNER JOIN EventModules em ON e.EventId = em.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
LEFT JOIN Speakers s ON em.SpeakerId = s.SpeakerId
WHERE e.IsDeleted = 0;
GO

PRINT 'vw_EventsWithModules updated with speaker details';

-- Recreate vw_FeedbackWithDetails with speaker join
DROP VIEW IF EXISTS vw_FeedbackWithDetails;
GO

CREATE VIEW vw_FeedbackWithDetails AS
SELECT
    f.FeedbackId,
    f.EventId,
    f.EventCode,
    f.EventModuleId,
    em.ModuleId,
    m.ModuleName,
    em.SpeakerName,
    em.SpeakerId,
    s.Bio AS SpeakerBio,
    s.ProfileImage AS SpeakerImage,
    e.EventName,
    e.StartDate,
    e.EndDate,
    e.TrainingTrack,
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
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
LEFT JOIN Speakers s ON em.SpeakerId = s.SpeakerId;
GO

PRINT 'vw_FeedbackWithDetails updated with speaker details';

-- vw_EventFeedbackCounts does not need speaker columns (aggregate only)
-- Stored procedures read SpeakerName from EventModules directly, no changes needed

PRINT '';
PRINT '========================================';
PRINT 'Migration 006 completed successfully';
PRINT '  - Speakers table created';
PRINT '  - EventTemplates table created';
PRINT '  - EventTemplateModules table created';
PRINT '  - EventModules.SpeakerId column added';
PRINT '  - Existing speakers migrated';
PRINT '  - Views updated';
PRINT '========================================';
