-- ============================================
-- Part 6: Create Stored Procedure - Get Feedback Count
-- Run this sixth (final) in Azure Portal Query Editor
-- ============================================

-- Drop if exists
IF OBJECT_ID('sp_GetFeedbackCountByEventCode', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetFeedbackCountByEventCode;

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
