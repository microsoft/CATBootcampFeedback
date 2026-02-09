-- ============================================
-- Migration: Rename CohortId to TrainingTrack
-- Date: 2026-02-06
-- ============================================

-- Rename column in Events table
EXEC sp_rename 'Events.CohortId', 'TrainingTrack', 'COLUMN';
GO

-- Recreate vw_EventsWithModules view with new column name
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
    m.Description AS ModuleDescription,
    em.DeliveryOrder,
    em.DeliveryDate,
    m.IsActive AS ModuleIsActive
FROM Events e
INNER JOIN EventModules em ON e.EventId = em.EventId
INNER JOIN Modules m ON em.ModuleId = m.ModuleId
WHERE e.IsDeleted = 0;
GO

-- Recreate vw_FeedbackWithDetails view with new column name
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
INNER JOIN Modules m ON em.ModuleId = m.ModuleId;
GO

-- Recreate vw_EventFeedbackCounts view with new column name
DROP VIEW IF EXISTS vw_EventFeedbackCounts;
GO

CREATE VIEW vw_EventFeedbackCounts AS
SELECT
    e.EventId,
    e.EventName,
    e.EventCode,
    e.StartDate,
    e.EndDate,
    e.TrainingTrack,
    COUNT(DISTINCT em.EventModuleId) AS ModuleCount,
    COUNT(f.FeedbackId) AS TotalFeedbackCount,
    AVG(CAST(f.SpeakerKnowledge AS FLOAT)) AS AvgSpeakerKnowledge,
    AVG(CAST(f.ModuleSatisfaction AS FLOAT)) AS AvgModuleSatisfaction,
    MAX(f.SubmittedAt) AS LastSubmittedAt
FROM Events e
LEFT JOIN EventModules em ON e.EventId = em.EventId
LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
WHERE e.IsDeleted = 0
GROUP BY e.EventId, e.EventName, e.EventCode, e.StartDate, e.EndDate, e.TrainingTrack;
GO

-- Recreate sp_GetEventByCode stored procedure with new column name
DROP PROCEDURE IF EXISTS sp_GetEventByCode;
GO

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
        e.TrainingTrack,
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
GO

-- Recreate sp_GetFeedbackCountByEventCode stored procedure with new column name
DROP PROCEDURE IF EXISTS sp_GetFeedbackCountByEventCode;
GO

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
        TrainingTrack,
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

PRINT '✓ Migration completed: CohortId renamed to TrainingTrack';
