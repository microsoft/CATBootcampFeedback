-- ============================================
-- Production Database Initialization
-- Run this in Azure Portal Query Editor on production SQL database
-- ============================================

-- ============================================
-- PART 1: CREATE TABLES
-- ============================================

-- 1. EVENTS TABLE
CREATE TABLE Events (
    EventId INT PRIMARY KEY IDENTITY(1,1),
    EventName NVARCHAR(200) NOT NULL,
    EventCode NVARCHAR(8) NOT NULL UNIQUE,
    StartDate DATETIME NOT NULL,
    EndDate DATETIME NULL,
    CohortId NVARCHAR(50) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    IsDeleted BIT DEFAULT 0,
    DeletedAt DATETIME2 NULL,
    DeletedBy NVARCHAR(100) NULL
);

CREATE INDEX IX_Events_EventCode ON Events(EventCode);
CREATE INDEX IX_Events_IsActive ON Events(IsActive);

-- 2. MODULES TABLE
CREATE TABLE Modules (
    ModuleId INT PRIMARY KEY IDENTITY(1,1),
    ModuleName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME NULL,
    UpdatedBy NVARCHAR(100) NULL
);

CREATE INDEX IX_Modules_IsActive ON Modules(IsActive);

-- 3. EVENTMODULES JUNCTION TABLE
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

-- 4. FEEDBACK TABLE
CREATE TABLE Feedback (
    FeedbackId INT PRIMARY KEY IDENTITY(1,1),
    EventModuleId INT NOT NULL,
    EventId INT NOT NULL,
    EventCode NVARCHAR(8) NOT NULL,
    SpeakerKnowledge INT NOT NULL CHECK (SpeakerKnowledge BETWEEN 1 AND 5),
    ContentDepth NVARCHAR(20) NOT NULL CHECK (ContentDepth IN ('Too Technical', 'Just Right', 'Too Low Level')),
    ModuleSatisfaction INT NOT NULL CHECK (ModuleSatisfaction BETWEEN 1 AND 5),
    AdditionalComments NVARCHAR(1000) NULL,
    IpAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    SubmittedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Feedback_EventModules FOREIGN KEY (EventModuleId) REFERENCES EventModules(EventModuleId) ON DELETE CASCADE
);

CREATE INDEX IX_Feedback_EventModuleId ON Feedback(EventModuleId);
CREATE INDEX IX_Feedback_EventId ON Feedback(EventId);
CREATE INDEX IX_Feedback_EventCode ON Feedback(EventCode);
CREATE INDEX IX_Feedback_SubmittedAt ON Feedback(SubmittedAt DESC);

PRINT '✓ Tables created successfully';

-- ============================================
-- PART 2: CREATE VIEWS (wrapped in EXEC for Azure Portal compatibility)
-- ============================================

-- View: Events with all their modules
EXEC('
CREATE VIEW vw_EventsWithModules AS
SELECT
    e.EventId,
    e.EventName,
    e.EventCode,
    e.StartDate,
    e.EndDate,
    e.CohortId,
    e.IsActive AS EventIsActive,
    e.CreatedAt AS EventCreatedAt,
    e.IsDeleted,
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
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
WHERE e.IsDeleted = 0;
');

-- View: Feedback with full details
EXEC('
CREATE VIEW vw_FeedbackWithDetails AS
SELECT
    f.FeedbackId,
    f.EventId,
    f.EventCode,
    f.EventModuleId,
    em.ModuleId,
    m.ModuleName,
    em.SpeakerName,
    e.EventName,
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
');

-- View: Event feedback counts
EXEC('
CREATE VIEW vw_EventFeedbackCounts AS
SELECT
    e.EventId,
    e.EventName,
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
WHERE e.IsDeleted = 0
GROUP BY e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.CohortId;
');

PRINT '✓ Views created successfully';

-- ============================================
-- PART 3: CREATE STORED PROCEDURES (wrapped in EXEC for Azure Portal compatibility)
-- ============================================

-- Get Event with all modules
EXEC('
CREATE PROCEDURE sp_GetEventByCode
    @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT
        e.EventId,
        e.EventName,
        e.EventCode,
        e.StartDate,
        e.EndDate,
        e.CohortId,
        e.IsActive AS EventIsActive,
        e.CreatedAt
    FROM Events e
    WHERE e.EventCode = @EventCode AND e.IsActive = 1 AND e.IsDeleted = 0;

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
    WHERE e.EventCode = @EventCode AND e.IsActive = 1 AND e.IsDeleted = 0 AND m.IsActive = 1
    ORDER BY em.DeliveryOrder;
END;
');

-- Get feedback count by event
EXEC('
CREATE PROCEDURE sp_GetFeedbackCountByEventCode
    @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT
        EventId,
        EventName,
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
');

PRINT '✓ Stored Procedures created successfully';
PRINT '';
PRINT '========================================';
PRINT '✓ Production database schema initialized!';
PRINT '========================================';
PRINT 'Tables: Events, Modules, EventModules, Feedback';
PRINT 'Views: 3';
PRINT 'Stored Procedures: 2';
PRINT '';
PRINT 'Next step: Run the sample data script to populate the database.';
