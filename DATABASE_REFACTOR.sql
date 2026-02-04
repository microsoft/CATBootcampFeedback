-- CAT Bootcamp Feedback Application - Data Model Refactor
-- Separating Modules and Events

-- ============================================
-- 1. MODULES TABLE (Training Content)
-- ============================================
CREATE TABLE Modules (
    ModuleId INT PRIMARY KEY IDENTITY(1,1),
    ModuleName NVARCHAR(200) NOT NULL,
    ModuleDate DATE NOT NULL,
    SpeakerName NVARCHAR(100) NOT NULL,
    CohortId NVARCHAR(50) NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME NULL,
    UpdatedBy NVARCHAR(100) NULL
);

-- ============================================
-- 2. EVENTS TABLE (Feedback Collection Instances)
-- ============================================
CREATE TABLE Events (
    EventId INT PRIMARY KEY IDENTITY(1,1),
    EventCode NVARCHAR(8) NOT NULL UNIQUE,  -- Admin-provided, e.g., CSA1B2C3
    ModuleId INT NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    CONSTRAINT FK_Events_Modules FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId) ON DELETE CASCADE
);

-- Index for fast event code lookups
CREATE INDEX IX_Events_EventCode ON Events(EventCode);
CREATE INDEX IX_Events_ModuleId ON Events(ModuleId);

-- ============================================
-- 3. FEEDBACK TABLE (Updated to reference Events)
-- ============================================
-- Note: If existing Feedback table, this would be ALTER TABLE
CREATE TABLE Feedback (
    FeedbackId INT PRIMARY KEY IDENTITY(1,1),
    EventId INT NOT NULL,
    EventCode NVARCHAR(8) NOT NULL,  -- Captured from URL for reference
    SpeakerKnowledge INT NOT NULL CHECK (SpeakerKnowledge BETWEEN 1 AND 5),
    ContentDepth NVARCHAR(20) NOT NULL CHECK (ContentDepth IN ('Too Basic', 'Just Right', 'Too Advanced')),
    ModuleSatisfaction INT NOT NULL CHECK (ModuleSatisfaction BETWEEN 1 AND 5),
    AdditionalComments NVARCHAR(1000) NULL,
    IpAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    SubmittedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Feedback_Events FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE
);

-- Index for querying feedback by event
CREATE INDEX IX_Feedback_EventId ON Feedback(EventId);
CREATE INDEX IX_Feedback_EventCode ON Feedback(EventCode);
CREATE INDEX IX_Feedback_SubmittedAt ON Feedback(SubmittedAt DESC);

-- ============================================
-- 4. VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Event with Module Details
CREATE VIEW vw_EventsWithModules AS
SELECT
    e.EventId,
    e.EventCode,
    e.ModuleId,
    m.ModuleName,
    m.ModuleDate,
    m.SpeakerName,
    m.CohortId,
    m.Description AS ModuleDescription,
    e.IsActive AS EventIsActive,
    m.IsActive AS ModuleIsActive,
    e.CreatedAt AS EventCreatedAt,
    m.CreatedAt AS ModuleCreatedAt,
    -- Generate feedback URL
    CONCAT('https://yourdomain.com/feedback.html?code=', e.EventCode) AS FeedbackUrl
FROM Events e
INNER JOIN Modules m ON e.ModuleId = m.ModuleId;

-- View: Feedback with Event and Module Details
CREATE VIEW vw_FeedbackWithDetails AS
SELECT
    f.FeedbackId,
    f.EventId,
    f.EventCode,
    e.ModuleId,
    m.ModuleName,
    m.ModuleDate,
    m.SpeakerName,
    m.CohortId,
    f.SpeakerKnowledge,
    f.ContentDepth,
    f.ModuleSatisfaction,
    f.AdditionalComments,
    f.SubmittedAt,
    f.IpAddress
FROM Feedback f
INNER JOIN Events e ON f.EventId = e.EventId
INNER JOIN Modules m ON e.ModuleId = m.ModuleId;

-- View: Event Feedback Count
CREATE VIEW vw_EventFeedbackCounts AS
SELECT
    e.EventId,
    e.EventCode,
    e.ModuleId,
    m.ModuleName,
    COUNT(f.FeedbackId) AS FeedbackCount,
    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction
FROM Events e
INNER JOIN Modules m ON e.ModuleId = m.ModuleId
LEFT JOIN Feedback f ON e.EventId = f.EventId
GROUP BY e.EventId, e.EventCode, e.ModuleId, m.ModuleName;

-- ============================================
-- 5. MIGRATION FROM OLD SCHEMA (If applicable)
-- ============================================

-- If you have an existing Events table that combined module + event data:
/*
-- Step 1: Create Modules from existing Events
INSERT INTO Modules (ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive, CreatedAt)
SELECT DISTINCT
    ModuleName,
    ModuleDate,
    SpeakerName,
    CohortId,
    Description,
    IsActive,
    CreatedAt
FROM OldEvents;

-- Step 2: Create new Events table referencing Modules
INSERT INTO Events (EventCode, ModuleId, IsActive, CreatedAt)
SELECT
    oe.EventCode,
    m.ModuleId,
    oe.IsActive,
    oe.CreatedAt
FROM OldEvents oe
INNER JOIN Modules m ON
    oe.ModuleName = m.ModuleName AND
    oe.ModuleDate = m.ModuleDate AND
    oe.SpeakerName = m.SpeakerName;

-- Step 3: Update Feedback table to reference new Events
-- (Feedback.EventId should already match if using same IDs)

-- Step 4: Rename old table and verify
EXEC sp_rename 'Events', 'Events_OLD';
*/

-- ============================================
-- 6. SAMPLE DATA
-- ============================================

-- Insert sample modules
INSERT INTO Modules (ModuleName, ModuleDate, SpeakerName, CohortId, Description)
VALUES
    ('Introduction to Copilot Studio', '2026-02-15', 'John Doe', 'Q1-2026', 'Getting started with Copilot Studio basics'),
    ('Building Your First Copilot', '2026-02-16', 'Jane Smith', 'Q1-2026', 'Hands-on copilot development'),
    ('Advanced Copilot Techniques', '2026-02-17', 'Mike Johnson', 'Q1-2026', 'Advanced features and best practices');

-- Insert sample events for the modules
INSERT INTO Events (EventCode, ModuleId, IsActive)
VALUES
    ('CSA1B2C3', 1, 1),  -- Event for Module 1
    ('CSXYZ789', 2, 1),  -- Event for Module 2
    ('CSABC456', 3, 1);  -- Event for Module 3

-- You can create multiple events for the same module:
-- INSERT INTO Events (EventCode, ModuleId, IsActive)
-- VALUES ('CSA1B2C4', 1, 1);  -- Another event for Module 1 (e.g., different cohort)

-- ============================================
-- 7. STORED PROCEDURES
-- ============================================

-- Get Event with Module Details by Event Code
CREATE PROCEDURE sp_GetEventByCode
    @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT
        e.EventId,
        e.EventCode,
        e.ModuleId,
        m.ModuleName,
        m.ModuleDate,
        m.SpeakerName,
        m.CohortId,
        m.Description,
        e.IsActive,
        e.CreatedAt
    FROM Events e
    INNER JOIN Modules m ON e.ModuleId = m.ModuleId
    WHERE e.EventCode = @EventCode AND e.IsActive = 1 AND m.IsActive = 1;
END;
GO

-- Get all Events with Module Details
CREATE PROCEDURE sp_GetAllEvents
AS
BEGIN
    SELECT * FROM vw_EventsWithModules
    ORDER BY ModuleDate DESC, ModuleName;
END;
GO

-- Get Feedback for an Event
CREATE PROCEDURE sp_GetFeedbackByEventCode
    @EventCode NVARCHAR(8)
AS
BEGIN
    SELECT * FROM vw_FeedbackWithDetails
    WHERE EventCode = @EventCode
    ORDER BY SubmittedAt DESC;
END;
GO

-- Create Module and Event
CREATE PROCEDURE sp_CreateModuleWithEvent
    @ModuleName NVARCHAR(200),
    @ModuleDate DATE,
    @SpeakerName NVARCHAR(100),
    @CohortId NVARCHAR(50),
    @Description NVARCHAR(MAX),
    @EventCode NVARCHAR(8),
    @CreatedBy NVARCHAR(100)
AS
BEGIN
    DECLARE @ModuleId INT;

    BEGIN TRANSACTION;

    -- Insert Module
    INSERT INTO Modules (ModuleName, ModuleDate, SpeakerName, CohortId, Description, CreatedBy)
    VALUES (@ModuleName, @ModuleDate, @SpeakerName, @CohortId, @Description, @CreatedBy);

    SET @ModuleId = SCOPE_IDENTITY();

    -- Insert Event
    INSERT INTO Events (EventCode, ModuleId, CreatedBy)
    VALUES (@EventCode, @ModuleId, @CreatedBy);

    COMMIT TRANSACTION;

    -- Return the created event with module details
    SELECT
        e.EventId,
        e.EventCode,
        e.ModuleId,
        m.ModuleName,
        m.ModuleDate,
        m.SpeakerName,
        m.CohortId,
        m.Description,
        e.IsActive,
        e.CreatedAt
    FROM Events e
    INNER JOIN Modules m ON e.ModuleId = m.ModuleId
    WHERE e.EventCode = @EventCode;
END;
GO
