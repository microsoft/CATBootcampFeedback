-- ============================================
-- Load Sample Data to Production Database
-- Run this in Azure Portal Query Editor AFTER running init-production-database.sql
-- ============================================

-- Reseed identity columns to start from 1
DBCC CHECKIDENT ('Modules', RESEED, 0);
DBCC CHECKIDENT ('Events', RESEED, 0);
DBCC CHECKIDENT ('EventModules', RESEED, 0);
DBCC CHECKIDENT ('Feedback', RESEED, 0);

-- Insert Sample Modules and capture IDs
DECLARE @ModuleIds TABLE (Idx INT IDENTITY(1,1), ModuleId INT);

INSERT INTO Modules (ModuleName, Description, IsActive, CreatedAt, CreatedBy)
OUTPUT INSERTED.ModuleId INTO @ModuleIds(ModuleId)
VALUES
('Introduction to Azure', 'Overview of Microsoft Azure cloud platform and core services', 1, GETDATE(), 'system'),
('Azure Functions', 'Building serverless applications with Azure Functions', 1, GETDATE(), 'system'),
('Azure SQL Database', 'Working with Azure SQL Database and best practices', 1, GETDATE(), 'system'),
('Azure Static Web Apps', 'Hosting modern web applications with Azure Static Web Apps', 1, GETDATE(), 'system'),
('CI/CD with GitHub Actions', 'Continuous Integration and Deployment using GitHub Actions', 1, GETDATE(), 'system'),
('Azure Security Best Practices', 'Security fundamentals and best practices in Azure', 1, GETDATE(), 'system'),
('Monitoring and Diagnostics', 'Application Insights and Azure Monitor', 1, GETDATE(), 'system');

-- Insert Sample Events and capture IDs
DECLARE @EventIds TABLE (Idx INT IDENTITY(1,1), EventId INT);

INSERT INTO Events (EventName, EventCode, StartDate, EndDate, CohortId, IsActive, CreatedAt, CreatedBy, IsDeleted)
OUTPUT INSERTED.EventId INTO @EventIds(EventId)
VALUES
('CAT Bootcamp January 2026', 'CAT0126', '2026-01-15', '2026-01-17', 'COHORT-2026-01', 1, GETDATE(), 'system', 0),
('CAT Bootcamp February 2026', 'CAT0226', '2026-02-10', '2026-02-14', 'COHORT-2026-02', 1, GETDATE(), 'system', 0),
('CAT Advanced Workshop', 'CATADV01', '2026-03-01', '2026-03-03', 'COHORT-ADV-01', 1, GETDATE(), 'system', 0);

-- Link Modules to Events (EventModules) and capture IDs
DECLARE @EventModuleIds TABLE (Idx INT IDENTITY(1,1), EventModuleId INT);

-- Event 1: CAT Bootcamp January 2026
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedAt, CreatedBy)
OUTPUT INSERTED.EventModuleId INTO @EventModuleIds(EventModuleId)
SELECT e.EventId, m.ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, GETDATE(), 'system'
FROM @EventIds e, @ModuleIds m
CROSS APPLY (VALUES
    (1, 1, 'Sarah Johnson', 1, '2026-01-15 09:00'),
    (1, 2, 'Michael Chen', 2, '2026-01-15 13:00'),
    (1, 3, 'Emily Rodriguez', 3, '2026-01-16 09:00'),
    (1, 4, 'David Kim', 4, '2026-01-16 13:00'),
    (1, 5, 'Alex Thompson', 5, '2026-01-17 09:00'),
    (2, 1, 'Sarah Johnson', 1, '2026-02-10 09:00'),
    (2, 2, 'James Wilson', 2, '2026-02-10 14:00'),
    (2, 3, 'Emily Rodriguez', 3, '2026-02-11 09:00'),
    (2, 6, 'Rachel Martinez', 4, '2026-02-12 09:00'),
    (2, 7, 'Kevin Patel', 5, '2026-02-13 09:00'),
    (3, 5, 'Alex Thompson', 1, '2026-03-01 09:00'),
    (3, 6, 'Rachel Martinez', 2, '2026-03-01 14:00'),
    (3, 7, 'Kevin Patel', 3, '2026-03-02 09:00')
) AS Links(EventIdx, ModuleIdx, SpeakerName, DeliveryOrder, DeliveryDate)
WHERE e.Idx = Links.EventIdx AND m.Idx = Links.ModuleIdx;

-- Insert Sample Feedback
INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, IpAddress, SubmittedAt)
SELECT em.EventModuleId, e.EventId, ev.EventCode, f.SpeakerKnowledge, f.ContentDepth, f.ModuleSatisfaction, f.AdditionalComments, f.IpAddress, f.SubmittedAt
FROM @EventModuleIds em, @EventIds e
CROSS APPLY (VALUES
    -- Feedback for Event 1 modules (EventModuleIdx 1-5)
    (1, 1, 5, 'Just Right', 5, 'Excellent introduction to Azure! Very clear explanations.', '192.168.1.100', '2026-01-15 12:00'),
    (1, 1, 4, 'Just Right', 4, 'Good overview but would like more hands-on examples.', '192.168.1.101', '2026-01-15 12:15'),
    (1, 1, 5, 'Too Low Level', 5, 'Great session! Already familiar with basics though.', '192.168.1.102', '2026-01-15 12:30'),
    (2, 1, 5, 'Just Right', 5, 'Azure Functions made easy! Loved the demos.', '192.168.1.100', '2026-01-15 16:00'),
    (2, 1, 4, 'Too Technical', 3, 'Moved a bit fast for me, needed more background.', '192.168.1.103', '2026-01-15 16:15'),
    (3, 1, 5, 'Just Right', 5, 'Perfect depth for SQL Database. Very practical.', '192.168.1.101', '2026-01-16 12:00'),
    (3, 1, 4, 'Just Right', 4, 'Good content, would appreciate more troubleshooting tips.', '192.168.1.104', '2026-01-16 12:10'),
    (4, 1, 5, 'Just Right', 5, 'Static Web Apps are amazing! Great walkthrough.', '192.168.1.102', '2026-01-16 16:00'),
    (5, 1, 4, 'Just Right', 4, 'CI/CD concepts explained well. Helpful for our projects.', '192.168.1.100', '2026-01-17 12:00'),
    -- Feedback for Event 2 modules (EventModuleIdx 6-10)
    (6, 2, 5, 'Just Right', 5, 'Sarah is an excellent instructor!', '192.168.1.105', '2026-02-10 12:00'),
    (6, 2, 4, 'Too Low Level', 4, 'Good intro but I already knew most of this.', '192.168.1.106', '2026-02-10 12:05'),
    (7, 2, 5, 'Just Right', 5, 'James explained Functions perfectly with great examples.', '192.168.1.105', '2026-02-10 17:00'),
    (8, 2, 5, 'Just Right', 5, 'Database session was incredibly helpful!', '192.168.1.107', '2026-02-11 12:00'),
    (9, 2, 4, 'Just Right', 4, 'Security best practices well covered.', '192.168.1.106', '2026-02-12 12:00'),
    (10, 2, 5, 'Too Technical', 4, 'Monitoring tools are powerful but complex. Need more time.', '192.168.1.108', '2026-02-13 12:00'),
    -- Feedback for Event 3 modules (EventModuleIdx 11-13)
    (11, 3, 5, 'Just Right', 5, 'Advanced CI/CD techniques were eye-opening!', '192.168.1.109', '2026-03-01 12:00'),
    (11, 3, 5, 'Just Right', 5, 'Exactly what we needed for our enterprise deployments.', '192.168.1.110', '2026-03-01 12:10'),
    (12, 3, 5, 'Just Right', 5, 'Security deep dive was fantastic!', '192.168.1.109', '2026-03-01 17:00'),
    (13, 3, 4, 'Too Technical', 4, 'Great content but very dense. Hard to absorb everything.', '192.168.1.111', '2026-03-02 12:00')
) AS f(EventModuleIdx, EventIdx, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, IpAddress, SubmittedAt)
INNER JOIN Events ev ON e.EventId = ev.EventId
WHERE em.Idx = f.EventModuleIdx AND e.Idx = f.EventIdx;

PRINT '';
PRINT '========================================';
PRINT '✓ Sample data loaded successfully!';
PRINT '========================================';
PRINT '';

-- Verification queries
SELECT 'Modules' AS TableName, COUNT(*) AS RecordCount FROM Modules
UNION ALL
SELECT 'Events', COUNT(*) FROM Events
UNION ALL
SELECT 'EventModules', COUNT(*) FROM EventModules
UNION ALL
SELECT 'Feedback', COUNT(*) FROM Feedback;

PRINT '';
PRINT 'Expected counts:';
PRINT '  Modules: 7';
PRINT '  Events: 3';
PRINT '  EventModules: 13';
PRINT '  Feedback: 20';
PRINT '';

-- Verify Event Details
SELECT
    e.EventId,
    e.EventCode,
    e.EventName,
    COUNT(DISTINCT em.EventModuleId) AS ModuleCount,
    COUNT(f.FeedbackId) AS FeedbackCount
FROM Events e
LEFT JOIN EventModules em ON e.EventId = em.EventId
LEFT JOIN Feedback f ON em.EventModuleId = f.EventModuleId
GROUP BY e.EventId, e.EventCode, e.EventName
ORDER BY e.EventId;

PRINT '';
PRINT 'Expected event details:';
PRINT '  Event 1 (CAT0126): 5 modules, 9 feedback';
PRINT '  Event 2 (CAT0226): 5 modules, 6 feedback';
PRINT '  Event 3 (CATADV01): 3 modules, 4 feedback';
