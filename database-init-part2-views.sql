-- ============================================
-- Part 2: Create Views
-- Run this second in Azure Portal Query Editor
-- ============================================

-- View: Events with all their modules
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
