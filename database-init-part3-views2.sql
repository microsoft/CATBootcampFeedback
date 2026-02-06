-- ============================================
-- Part 3: Create Additional Views
-- Run this third in Azure Portal Query Editor
-- ============================================

-- Drop if exists
IF OBJECT_ID('vw_FeedbackWithDetails', 'V') IS NOT NULL
    DROP VIEW vw_FeedbackWithDetails;

-- Use EXEC to create view in separate batch
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
