-- Create Events table
CREATE TABLE Events (
    EventId INT IDENTITY(1,1) PRIMARY KEY,
    EventCode NVARCHAR(20) UNIQUE NOT NULL,
    ModuleName NVARCHAR(200) NOT NULL,
    ModuleDate DATE NOT NULL,
    SpeakerName NVARCHAR(100) NOT NULL,
    CohortId NVARCHAR(50) NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL
);

-- Create indexes for Events
CREATE NONCLUSTERED INDEX IX_Events_EventCode ON Events(EventCode);
CREATE NONCLUSTERED INDEX IX_Events_IsActive_ModuleDate ON Events(IsActive, ModuleDate DESC);

-- Create Feedback table
CREATE TABLE Feedback (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    EventId INT NOT NULL,
    EventCode NVARCHAR(20) NOT NULL,
    SpeakerKnowledge INT NOT NULL CHECK (SpeakerKnowledge BETWEEN 1 AND 5),
    ContentDepth NVARCHAR(20) NOT NULL CHECK (ContentDepth IN ('Too Technical', 'Just Right', 'Too Low Level')),
    ModuleSatisfaction INT NOT NULL CHECK (ModuleSatisfaction BETWEEN 1 AND 5),
    AdditionalComments NVARCHAR(MAX) NULL,
    SubmittedAt DATETIME2 DEFAULT GETDATE(),
    IpAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    FOREIGN KEY (EventId) REFERENCES Events(EventId)
);

-- Create indexes for Feedback
CREATE NONCLUSTERED INDEX IX_Feedback_EventId_SubmittedAt ON Feedback(EventId, SubmittedAt DESC);
CREATE NONCLUSTERED INDEX IX_Feedback_SubmittedAt ON Feedback(SubmittedAt DESC);

-- Insert sample event for testing
INSERT INTO Events (EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive)
VALUES ('CSA1B2C3', 'Introduction to CAT Bootcamp', '2026-02-15', 'John Doe', 'Q1-2026', 'Getting started with CAT', 1);

-- Insert additional sample events
INSERT INTO Events (EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive)
VALUES
    ('CSXYZ789', 'Advanced Topics in CAT', '2026-02-20', 'Jane Smith', 'Q1-2026', 'Deep dive into advanced concepts', 1),
    ('CSABC456', 'CAT Best Practices', '2026-02-25', 'Mike Johnson', 'Q1-2026', 'Industry best practices', 1);

-- ====================================================================
-- PERFORMANCE INDEXES
-- ====================================================================

-- Index for analytics queries by date range
CREATE NONCLUSTERED INDEX IX_Feedback_SubmittedAt_Ratings
    ON Feedback(SubmittedAt DESC)
    INCLUDE (SpeakerKnowledge, ModuleSatisfaction, ContentDepth)
    WHERE SpeakerKnowledge IS NOT NULL;

-- Index for event-specific analytics
CREATE NONCLUSTERED INDEX IX_Feedback_EventId_Analytics
    ON Feedback(EventId)
    INCLUDE (SpeakerKnowledge, ContentDepth, ModuleSatisfaction, SubmittedAt);

-- Index for speaker performance tracking
CREATE NONCLUSTERED INDEX IX_Events_SpeakerName_Active
    ON Events(SpeakerName, IsActive)
    INCLUDE (EventId, ModuleName, ModuleDate);

-- Index for IP-based rate limiting queries
CREATE NONCLUSTERED INDEX IX_Feedback_IpAddress_SubmittedAt
    ON Feedback(IpAddress, SubmittedAt DESC)
    WHERE IpAddress IS NOT NULL;

-- ====================================================================
-- SOFT DELETE SUPPORT
-- ====================================================================

-- Add soft delete columns to Events table
ALTER TABLE Events ADD IsDeleted BIT DEFAULT 0;
ALTER TABLE Events ADD DeletedAt DATETIME2 NULL;
ALTER TABLE Events ADD DeletedBy NVARCHAR(100) NULL;

-- Update existing queries to filter out deleted items
-- Note: Application code should add "WHERE IsDeleted = 0" to all queries

-- Create stored procedure to restore deleted events
CREATE PROCEDURE sp_RestoreEvent
    @EventId INT
AS
BEGIN
    UPDATE Events
    SET IsDeleted = 0,
        DeletedAt = NULL,
        DeletedBy = NULL
    WHERE EventId = @EventId;
END;
GO

-- ====================================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- ====================================================================

-- Get event with feedback count
CREATE PROCEDURE sp_GetEventWithCount
    @EventCode NVARCHAR(20)
AS
BEGIN
    SELECT
        e.*,
        COUNT(f.FeedbackId) as FeedbackCount
    FROM Events e
    LEFT JOIN Feedback f ON e.EventId = f.EventId
    WHERE e.EventCode = @EventCode
        AND e.IsActive = 1
        AND e.IsDeleted = 0
    GROUP BY e.EventId, e.EventCode, e.ModuleName,
             e.ModuleDate, e.SpeakerName, e.CohortId,
             e.Description, e.IsActive, e.CreatedAt,
             e.CreatedBy, e.UpdatedAt, e.UpdatedBy,
             e.IsDeleted, e.DeletedAt, e.DeletedBy;
END;
GO

-- Get feedback statistics
CREATE PROCEDURE sp_GetFeedbackStatistics
    @EventId INT = NULL,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL
AS
BEGIN
    SELECT
        COUNT(*) as TotalFeedback,
        AVG(CAST(SpeakerKnowledge AS FLOAT)) as AvgSpeakerKnowledge,
        AVG(CAST(ModuleSatisfaction AS FLOAT)) as AvgModuleSatisfaction,
        SUM(CASE WHEN ContentDepth = 'Too Technical' THEN 1 ELSE 0 END) as TooTechnicalCount,
        SUM(CASE WHEN ContentDepth = 'Just Right' THEN 1 ELSE 0 END) as JustRightCount,
        SUM(CASE WHEN ContentDepth = 'Too Low Level' THEN 1 ELSE 0 END) as TooLowLevelCount,
        MIN(SubmittedAt) as FirstSubmission,
        MAX(SubmittedAt) as LastSubmission
    FROM Feedback
    WHERE (@EventId IS NULL OR EventId = @EventId)
        AND (@FromDate IS NULL OR CAST(SubmittedAt AS DATE) >= @FromDate)
        AND (@ToDate IS NULL OR CAST(SubmittedAt AS DATE) <= @ToDate);
END;
GO

-- Get speaker performance summary
CREATE PROCEDURE sp_GetSpeakerPerformance
    @SpeakerName NVARCHAR(100) = NULL,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL
AS
BEGIN
    SELECT
        e.SpeakerName,
        COUNT(DISTINCT e.EventId) as TotalEvents,
        COUNT(f.FeedbackId) as TotalFeedback,
        AVG(CAST(f.SpeakerKnowledge AS FLOAT)) as AvgSpeakerKnowledge,
        AVG(CAST(f.ModuleSatisfaction AS FLOAT)) as AvgModuleSatisfaction,
        SUM(CASE WHEN f.ContentDepth = 'Too Technical' THEN 1 ELSE 0 END) as TooTechnicalCount,
        SUM(CASE WHEN f.ContentDepth = 'Just Right' THEN 1 ELSE 0 END) as JustRightCount,
        SUM(CASE WHEN f.ContentDepth = 'Too Low Level' THEN 1 ELSE 0 END) as TooLowLevelCount
    FROM Events e
    LEFT JOIN Feedback f ON e.EventId = f.EventId
    WHERE e.IsDeleted = 0
        AND (@SpeakerName IS NULL OR e.SpeakerName = @SpeakerName)
        AND (@FromDate IS NULL OR e.ModuleDate >= @FromDate)
        AND (@ToDate IS NULL OR e.ModuleDate <= @ToDate)
    GROUP BY e.SpeakerName
    ORDER BY AvgModuleSatisfaction DESC;
END;
GO

-- ====================================================================
-- DATA RETENTION AND CLEANUP
-- ====================================================================

-- Create procedure to archive old feedback (optional)
CREATE PROCEDURE sp_ArchiveOldFeedback
    @DaysToKeep INT = 365
AS
BEGIN
    DECLARE @CutoffDate DATETIME2 = DATEADD(DAY, -@DaysToKeep, GETDATE());

    -- Log what will be archived
    SELECT
        COUNT(*) as FeedbackToArchive,
        MIN(SubmittedAt) as OldestFeedback,
        MAX(SubmittedAt) as NewestToArchive
    FROM Feedback
    WHERE SubmittedAt < @CutoffDate;

    -- Uncomment the following to actually archive
    -- DELETE FROM Feedback WHERE SubmittedAt < @CutoffDate;
END;
GO

-- ====================================================================
-- VIEWS FOR COMMON QUERIES
-- ====================================================================

-- View for active events with feedback counts
CREATE VIEW vw_ActiveEventsWithCounts AS
SELECT
    e.EventId,
    e.EventCode,
    e.ModuleName,
    e.ModuleDate,
    e.SpeakerName,
    e.CohortId,
    e.Description,
    e.IsActive,
    e.CreatedAt,
    COUNT(f.FeedbackId) as FeedbackCount,
    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) as AvgSpeakerKnowledge,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) as AvgModuleSatisfaction
FROM Events e
LEFT JOIN Feedback f ON e.EventId = f.EventId
WHERE e.IsDeleted = 0
GROUP BY
    e.EventId, e.EventCode, e.ModuleName, e.ModuleDate,
    e.SpeakerName, e.CohortId, e.Description, e.IsActive, e.CreatedAt;
GO
