-- Load Sample Data for CAT Bootcamp Feedback Application
-- This script adds sample events for testing

-- Check if sample events already exist
IF NOT EXISTS (SELECT 1 FROM Events WHERE EventCode = 'CSA1B2C3')
BEGIN
    INSERT INTO Events (EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive, CreatedAt)
    VALUES ('CSA1B2C3', 'Introduction to CAT Bootcamp', '2026-02-15', 'John Doe', 'Q1-2026', 'Getting started with CAT', 1, GETDATE());
    PRINT 'Added sample event: CSA1B2C3';
END
ELSE
BEGIN
    PRINT 'Sample event CSA1B2C3 already exists';
END

-- Add more sample events
IF NOT EXISTS (SELECT 1 FROM Events WHERE EventCode = 'CSXYZ789')
BEGIN
    INSERT INTO Events (EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive, CreatedAt)
    VALUES ('CSXYZ789', 'Advanced Topics in CAT', '2026-02-20', 'Jane Smith', 'Q1-2026', 'Deep dive into advanced concepts', 1, GETDATE());
    PRINT 'Added sample event: CSXYZ789';
END
ELSE
BEGIN
    PRINT 'Sample event CSXYZ789 already exists';
END

IF NOT EXISTS (SELECT 1 FROM Events WHERE EventCode = 'CSABC456')
BEGIN
    INSERT INTO Events (EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive, CreatedAt)
    VALUES ('CSABC456', 'CAT Best Practices', '2026-02-25', 'Mike Johnson', 'Q1-2026', 'Industry best practices', 1, GETDATE());
    PRINT 'Added sample event: CSABC456';
END
ELSE
BEGIN
    PRINT 'Sample event CSABC456 already exists';
END

-- Add some sample feedback for testing
DECLARE @EventId1 INT, @EventId2 INT;

SELECT @EventId1 = EventId FROM Events WHERE EventCode = 'CSA1B2C3';
SELECT @EventId2 = EventId FROM Events WHERE EventCode = 'CSXYZ789';

-- Sample feedback for first event
IF @EventId1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Feedback WHERE EventId = @EventId1)
BEGIN
    INSERT INTO Feedback (EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt, IpAddress)
    VALUES
        (@EventId1, 'CSA1B2C3', 5, 'Just Right', 5, 'Excellent presentation! Very informative and well-paced.', GETDATE(), '192.168.1.1'),
        (@EventId1, 'CSA1B2C3', 4, 'Just Right', 4, 'Good content, would like more hands-on examples.', DATEADD(MINUTE, -30, GETDATE()), '192.168.1.2'),
        (@EventId1, 'CSA1B2C3', 5, 'Too Technical', 4, 'Great depth of knowledge, but maybe a bit too technical for beginners.', DATEADD(HOUR, -1, GETDATE()), '192.168.1.3'),
        (@EventId1, 'CSA1B2C3', 3, 'Just Right', 3, 'Decent session, could use better examples.', DATEADD(HOUR, -2, GETDATE()), '192.168.1.4'),
        (@EventId1, 'CSA1B2C3', 5, 'Just Right', 5, 'Best session I''ve attended! Highly recommend.', DATEADD(HOUR, -3, GETDATE()), '192.168.1.5');
    PRINT 'Added 5 sample feedback entries for CSA1B2C3';
END

-- Sample feedback for second event
IF @EventId2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Feedback WHERE EventId = @EventId2)
BEGIN
    INSERT INTO Feedback (EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt, IpAddress)
    VALUES
        (@EventId2, 'CSXYZ789', 5, 'Just Right', 5, 'Advanced topics explained clearly. Very valuable!', GETDATE(), '192.168.1.6'),
        (@EventId2, 'CSXYZ789', 4, 'Too Technical', 3, 'Too advanced for me, but well presented.', DATEADD(MINUTE, -45, GETDATE()), '192.168.1.7'),
        (@EventId2, 'CSXYZ789', 4, 'Just Right', 4, 'Good advanced content. Appreciated the real-world examples.', DATEADD(HOUR, -1, GETDATE()), '192.168.1.8');
    PRINT 'Added 3 sample feedback entries for CSXYZ789';
END

-- Display summary
SELECT
    'Events' AS TableName,
    COUNT(*) AS RecordCount
FROM Events
WHERE IsActive = 1

UNION ALL

SELECT
    'Feedback' AS TableName,
    COUNT(*) AS RecordCount
FROM Feedback;

PRINT 'Sample data loaded successfully!';
PRINT '';
PRINT 'Test Event Codes:';
PRINT '  - CSA1B2C3 (Introduction to CAT Bootcamp)';
PRINT '  - CSXYZ789 (Advanced Topics in CAT)';
PRINT '  - CSABC456 (CAT Best Practices)';
PRINT '';
PRINT 'You can now test the feedback form with these event codes!';
