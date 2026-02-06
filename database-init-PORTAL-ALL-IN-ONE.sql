-- ============================================
-- ALL-IN-ONE Database Initialization for Azure Portal Query Editor
-- Run this ONCE in CATBootcampFeedback-Prod database
-- ============================================

-- Drop existing objects if they exist
IF OBJECT_ID('sp_GetFeedbackCountByEventCode', 'P') IS NOT NULL DROP PROCEDURE sp_GetFeedbackCountByEventCode;
IF OBJECT_ID('sp_GetEventByCode', 'P') IS NOT NULL DROP PROCEDURE sp_GetEventByCode;
IF OBJECT_ID('vw_EventFeedbackCounts', 'V') IS NOT NULL DROP VIEW vw_EventFeedbackCounts;
IF OBJECT_ID('vw_FeedbackWithDetails', 'V') IS NOT NULL DROP VIEW vw_FeedbackWithDetails;
IF OBJECT_ID('vw_EventsWithModules', 'V') IS NOT NULL DROP VIEW vw_EventsWithModules;
IF OBJECT_ID('Feedback', 'U') IS NOT NULL DROP TABLE Feedback;
IF OBJECT_ID('EventModules', 'U') IS NOT NULL DROP TABLE EventModules;
IF OBJECT_ID('Modules', 'U') IS NOT NULL DROP TABLE Modules;
IF OBJECT_ID('Events', 'U') IS NOT NULL DROP TABLE Events;

-- Create Events table
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

-- Create Modules table
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

-- Create EventModules junction table
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

-- Create Feedback table
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

-- Views and procedures must be created with EXEC due to Portal Query Editor limitations
EXEC('
CREATE VIEW vw_EventsWithModules AS
SELECT
    e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.CohortId,
    e.IsActive AS EventIsActive, e.CreatedAt AS EventCreatedAt, e.IsDeleted,
    em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName,
    m.Description AS ModuleDescription, em.DeliveryOrder, em.DeliveryDate,
    m.IsActive AS ModuleIsActive
FROM Events e
INNER JOIN EventModules em ON e.EventId = em.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
WHERE e.IsDeleted = 0;
');

EXEC('
CREATE VIEW vw_FeedbackWithDetails AS
SELECT
    f.FeedbackId, f.EventId, f.EventCode, f.EventModuleId, em.ModuleId,
    m.ModuleName, em.SpeakerName, e.EventName, e.StartDate, e.EndDate,
    e.CohortId, em.DeliveryOrder, f.SpeakerKnowledge, f.ContentDepth,
    f.ModuleSatisfaction, f.AdditionalComments, f.SubmittedAt, f.IpAddress
FROM Feedback f
INNER JOIN EventModules em ON f.EventModuleId = em.EventModuleId
INNER JOIN Events e ON em.EventId = e.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId;
');

EXEC('
CREATE VIEW vw_EventFeedbackCounts AS
SELECT
    e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.CohortId,
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

EXEC('
CREATE PROCEDURE sp_GetEventByCode @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.CohortId,
           e.IsActive AS EventIsActive, e.CreatedAt
    FROM Events e
    WHERE e.EventCode = @EventCode AND e.IsActive = 1 AND e.IsDeleted = 0;

    SELECT em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName,
           m.Description, em.DeliveryOrder, em.DeliveryDate, m.IsActive AS ModuleIsActive
    FROM EventModules em
    INNER JOIN Modules m ON em.ModuleId = m.ModuleId
    INNER JOIN Events e ON em.EventId = e.EventId
    WHERE e.EventCode = @EventCode AND e.IsActive = 1 AND e.IsDeleted = 0 AND m.IsActive = 1
    ORDER BY em.DeliveryOrder;
END;
');

EXEC('
CREATE PROCEDURE sp_GetFeedbackCountByEventCode @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT EventId, EventName, EventCode, StartDate, EndDate, CohortId,
           ModuleCount, TotalFeedbackCount, AvgSpeakerKnowledge,
           AvgModuleSatisfaction, LastSubmittedAt
    FROM vw_EventFeedbackCounts
    WHERE EventCode = @EventCode;

    SELECT em.EventModuleId, em.ModuleId, m.ModuleName, em.SpeakerName, em.DeliveryOrder,
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

-- Verification query
SELECT 'Tables' AS ObjectType, COUNT(*) AS Count
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
UNION ALL
SELECT 'Views', COUNT(*)
FROM INFORMATION_SCHEMA.VIEWS
UNION ALL
SELECT 'Stored Procedures', COUNT(*)
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'PROCEDURE';

-- Expected result: Tables=4, Views=3, Stored Procedures=2
