-- ============================================
-- Part 4: Create Event Feedback Counts View
-- Run this fourth in Azure Portal Query Editor
-- ============================================

-- View: Event feedback counts
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
