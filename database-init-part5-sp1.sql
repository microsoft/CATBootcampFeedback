-- ============================================
-- Part 5: Create Stored Procedure - Get Event By Code
-- Run this fifth in Azure Portal Query Editor
-- ============================================

-- Drop if exists
IF OBJECT_ID('sp_GetEventByCode', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetEventByCode;

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
