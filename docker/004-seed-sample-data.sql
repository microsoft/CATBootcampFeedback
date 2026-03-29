-- ============================================
-- Seed sample modules, events, event-modules, and feedback
-- for local development and testing
-- ============================================

-- ────────────────────────────────────────────
-- MODULES (training content catalog)
-- ────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleName = 'Introduction to Copilot Studio')
BEGIN
    INSERT INTO Modules (ModuleName, Description, IsActive, CreatedBy) VALUES
    ('Introduction to Copilot Studio',       'Overview of Copilot Studio capabilities, architecture, and use cases for building AI-powered agents.', 1, 'admin'),
    ('Building Custom Copilots',             'Hands-on lab: creating custom copilots with topics, entities, and generative AI features.', 1, 'admin'),
    ('Azure OpenAI Fundamentals',            'Understanding Azure OpenAI Service, model selection, prompt engineering, and responsible AI.', 1, 'admin'),
    ('Prompt Engineering Best Practices',    'Advanced techniques for crafting effective prompts, chain-of-thought reasoning, and few-shot examples.', 1, 'admin'),
    ('RAG Architecture Patterns',            'Retrieval-Augmented Generation design patterns using Azure AI Search and vector databases.', 1, 'admin'),
    ('Power Platform Governance',            'Establishing governance policies, DLP, environment strategies, and CoE toolkit for Power Platform.', 1, 'admin'),
    ('Azure Infrastructure as Code',         'Deploying Azure resources with Bicep and Terraform, CI/CD pipelines, and infrastructure best practices.', 1, 'admin'),
    ('Microsoft Fabric for Data Engineers',  'Lakehouse architecture, data pipelines, and analytics with Microsoft Fabric.', 1, 'admin'),
    ('Teams App Development',               'Building Teams tabs, bots, and message extensions using Teams Toolkit and Adaptive Cards.', 1, 'admin'),
    ('Security & Compliance in M365',        'Zero Trust architecture, Defender for Cloud, Purview, and compliance management.', 1, 'admin'),
    ('DevOps with GitHub Actions',           'CI/CD workflows, GitHub Actions, automated testing, and deployment strategies.', 1, 'admin'),
    ('Kubernetes on Azure (AKS)',            'Container orchestration with Azure Kubernetes Service, Helm charts, and service mesh.', 1, 'admin');

    PRINT 'Inserted 12 sample modules';
END;

-- ────────────────────────────────────────────
-- EVENTS (training bootcamps)
-- ────────────────────────────────────────────

-- Event 2: AI Bootcamp (March)
IF NOT EXISTS (SELECT 1 FROM Events WHERE EventCode = 'AI-MAR26')
BEGIN
    INSERT INTO Events (EventName, EventCode, StartDate, EndDate, TrainingTrack, IsActive, CreatedBy)
    VALUES ('AI & Copilot Bootcamp - March 2026', 'AI-MAR26', '2026-03-10', '2026-03-14', 'AI & Copilot', 1, 'eventcreator');
END;

-- Event 3: Azure Infra Bootcamp (April)
IF NOT EXISTS (SELECT 1 FROM Events WHERE EventCode = 'AZ-APR26')
BEGIN
    INSERT INTO Events (EventName, EventCode, StartDate, EndDate, TrainingTrack, IsActive, CreatedBy)
    VALUES ('Azure Infrastructure Bootcamp - April 2026', 'AZ-APR26', '2026-04-07', '2026-04-11', 'Azure Infrastructure', 1, 'eventcreator');
END;

-- Event 4: Data & Analytics (May)
IF NOT EXISTS (SELECT 1 FROM Events WHERE EventCode = 'DATA-MAY')
BEGIN
    INSERT INTO Events (EventName, EventCode, StartDate, EndDate, TrainingTrack, IsActive, CreatedBy)
    VALUES ('Data & Analytics Bootcamp - May 2026', 'DATA-MAY', '2026-05-05', '2026-05-09', 'Data & Analytics', 1, 'admin');
END;

-- Event 5: Security Bootcamp (completed/inactive)
IF NOT EXISTS (SELECT 1 FROM Events WHERE EventCode = 'SECJAN26')
BEGIN
    INSERT INTO Events (EventName, EventCode, StartDate, EndDate, TrainingTrack, IsActive, CreatedBy)
    VALUES ('Security Bootcamp - January 2026', 'SECJAN26', '2026-01-13', '2026-01-17', 'Security', 0, 'admin');
END;

-- ────────────────────────────────────────────
-- EVENT-MODULE ASSIGNMENTS (with speakers)
-- ────────────────────────────────────────────

-- TEST001: Test Bootcamp Event — 3 modules
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Sarah Chen', 1, '2026-03-28 09:00:00', 'admin'
FROM Events e, Modules m WHERE e.EventCode = 'TEST001' AND m.ModuleName = 'Introduction to Copilot Studio'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Marcus Johnson', 2, '2026-03-28 13:00:00', 'admin'
FROM Events e, Modules m WHERE e.EventCode = 'TEST001' AND m.ModuleName = 'Azure OpenAI Fundamentals'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Priya Patel', 3, '2026-03-29 09:00:00', 'admin'
FROM Events e, Modules m WHERE e.EventCode = 'TEST001' AND m.ModuleName = 'Prompt Engineering Best Practices'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

-- AI-MAR26: AI & Copilot Bootcamp — 5 modules
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Sarah Chen', 1, '2026-03-10 09:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'Introduction to Copilot Studio'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Sarah Chen', 2, '2026-03-10 13:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'Building Custom Copilots'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Marcus Johnson', 3, '2026-03-11 09:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'Azure OpenAI Fundamentals'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Priya Patel', 4, '2026-03-12 09:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'Prompt Engineering Best Practices'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'David Kim', 5, '2026-03-13 09:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'RAG Architecture Patterns'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

-- AZ-APR26: Azure Infra Bootcamp — 4 modules
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Alex Torres', 1, '2026-04-07 09:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AZ-APR26' AND m.ModuleName = 'Azure Infrastructure as Code'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Jordan Lee', 2, '2026-04-08 09:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AZ-APR26' AND m.ModuleName = 'Kubernetes on Azure (AKS)'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Alex Torres', 3, '2026-04-09 09:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AZ-APR26' AND m.ModuleName = 'DevOps with GitHub Actions'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Emma Wilson', 4, '2026-04-10 09:00:00', 'eventcreator'
FROM Events e, Modules m WHERE e.EventCode = 'AZ-APR26' AND m.ModuleName = 'Security & Compliance in M365'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

-- DATA-MAY: Data & Analytics — 3 modules
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Raj Gupta', 1, '2026-05-05 09:00:00', 'admin'
FROM Events e, Modules m WHERE e.EventCode = 'DATA-MAY' AND m.ModuleName = 'Microsoft Fabric for Data Engineers'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Marcus Johnson', 2, '2026-05-06 09:00:00', 'admin'
FROM Events e, Modules m WHERE e.EventCode = 'DATA-MAY' AND m.ModuleName = 'Azure OpenAI Fundamentals'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'David Kim', 3, '2026-05-07 09:00:00', 'admin'
FROM Events e, Modules m WHERE e.EventCode = 'DATA-MAY' AND m.ModuleName = 'RAG Architecture Patterns'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

-- SECJAN26: Security Bootcamp (past) — 2 modules
INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Emma Wilson', 1, '2026-01-13 09:00:00', 'admin'
FROM Events e, Modules m WHERE e.EventCode = 'SECJAN26' AND m.ModuleName = 'Security & Compliance in M365'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, CreatedBy)
SELECT e.EventId, m.ModuleId, 'Lisa Park', 2, '2026-01-14 09:00:00', 'admin'
FROM Events e, Modules m WHERE e.EventCode = 'SECJAN26' AND m.ModuleName = 'Power Platform Governance'
AND NOT EXISTS (SELECT 1 FROM EventModules em WHERE em.EventId = e.EventId AND em.ModuleId = m.ModuleId);

-- ────────────────────────────────────────────
-- GRANT EVENT ACCESS to test users
-- ────────────────────────────────────────────

-- eventcreator gets access to the events they created
INSERT INTO UserEventAccess (UserId, EventId, GrantedBy)
SELECT u.UserId, e.EventId, 'seed-script'
FROM Users u, Events e
WHERE u.Username = 'eventcreator' AND e.EventCode IN ('AI-MAR26', 'AZ-APR26')
AND NOT EXISTS (SELECT 1 FROM UserEventAccess uea WHERE uea.UserId = u.UserId AND uea.EventId = e.EventId);

-- feedbackmgr gets access to AI bootcamp and test event
INSERT INTO UserEventAccess (UserId, EventId, GrantedBy)
SELECT u.UserId, e.EventId, 'seed-script'
FROM Users u, Events e
WHERE u.Username = 'feedbackmgr' AND e.EventCode IN ('AI-MAR26', 'TEST001', 'DATA-MAY')
AND NOT EXISTS (SELECT 1 FROM UserEventAccess uea WHERE uea.UserId = u.UserId AND uea.EventId = e.EventId);

-- reporter gets access to all events for reporting
INSERT INTO UserEventAccess (UserId, EventId, GrantedBy)
SELECT u.UserId, e.EventId, 'seed-script'
FROM Users u, Events e
WHERE u.Username = 'reporter' AND e.IsDeleted = 0
AND NOT EXISTS (SELECT 1 FROM UserEventAccess uea WHERE uea.UserId = u.UserId AND uea.EventId = e.EventId);

-- ────────────────────────────────────────────
-- FEEDBACK (realistic sample submissions)
-- ────────────────────────────────────────────

-- Helper: insert feedback only if the event-module exists and feedback count is low
-- We generate ~60 feedback entries across events

-- TEST001 feedback (3 modules x ~5 each = 15)
INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'TEST001', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 10000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Excellent introduction! Sarah really knows her stuff.'),
    (4, 'Just Right',      4, 'Good overview, would have liked more hands-on time.'),
    (5, 'Just Right',      5, NULL),
    (4, 'Too Technical',   3, 'A bit fast-paced for beginners.'),
    (5, 'Just Right',      4, 'Great session, very informative.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'TEST001' AND m.ModuleName = 'Introduction to Copilot Studio'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'TEST001', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 10000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Marcus is an incredible speaker. Learned so much!'),
    (4, 'Just Right',      4, 'Clear explanations of complex topics.'),
    (3, 'Too Technical',   3, 'I struggled to follow some of the API examples.'),
    (5, 'Just Right',      5, NULL),
    (4, 'Just Right',      4, 'Would love a follow-up deep dive session.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'TEST001' AND m.ModuleName = 'Azure OpenAI Fundamentals'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'TEST001', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 10000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Priya made prompt engineering so approachable.'),
    (5, 'Just Right',      5, 'Best session of the bootcamp!'),
    (4, 'Too Low Level',   3, 'I already knew most of this. Need more advanced content.'),
    (4, 'Just Right',      4, NULL),
    (3, 'Just Right',      4, 'Good content but ran out of time for the exercises.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'TEST001' AND m.ModuleName = 'Prompt Engineering Best Practices'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

-- AI-MAR26 feedback (5 modules x ~6 each = 30)
INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AI-MAR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 20000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Perfect kickoff session for the bootcamp.'),
    (4, 'Just Right',      4, NULL),
    (5, 'Just Right',      5, 'Sarah is always fantastic.'),
    (3, 'Too Low Level',   3, 'Too basic for me, but good for newcomers.'),
    (4, 'Just Right',      4, 'Well-structured and easy to follow.'),
    (5, 'Just Right',      5, 'The live demos were really helpful!')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'Introduction to Copilot Studio'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AI-MAR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 20000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Hands-on was the highlight. Built my first copilot!'),
    (4, 'Too Technical',   3, 'Got stuck on the deployment step, needed more guidance.'),
    (5, 'Just Right',      5, NULL),
    (4, 'Just Right',      4, 'Great lab, wish we had more time.'),
    (5, 'Just Right',      5, 'This should be a full-day session.'),
    (3, 'Too Technical',   3, 'Need more prerequisite knowledge listed upfront.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'Building Custom Copilots'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AI-MAR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 20000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Marcus is one of the best speakers at CAT.'),
    (5, 'Just Right',      4, 'Solid fundamentals session.'),
    (4, 'Just Right',      4, NULL),
    (4, 'Too Technical',   3, 'The token pricing section was confusing.'),
    (5, 'Just Right',      5, 'Finally understand the difference between GPT-4 variants!'),
    (4, 'Just Right',      4, 'Good real-world examples.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'Azure OpenAI Fundamentals'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AI-MAR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 20000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Priya is amazing. Chain-of-thought section was eye-opening.'),
    (4, 'Just Right',      4, 'Practical tips I can use immediately.'),
    (5, 'Just Right',      5, NULL),
    (5, 'Just Right',      5, 'The prompt template library she shared is gold.'),
    (4, 'Too Low Level',   3, 'Needed more advanced patterns.'),
    (4, 'Just Right',      4, 'Really enjoyed the interactive prompt workshop.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'Prompt Engineering Best Practices'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AI-MAR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 20000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Too Technical',   4, 'Very deep content. David clearly knows this inside out.'),
    (4, 'Too Technical',   3, 'Hard to follow without vector DB experience.'),
    (5, 'Just Right',      5, 'Exactly what I needed for our upcoming project.'),
    (3, 'Too Technical',   2, 'Way over my head. Needs a prerequisites warning.'),
    (4, 'Just Right',      4, NULL),
    (5, 'Just Right',      5, 'The architecture diagrams were incredibly clear.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AI-MAR26' AND m.ModuleName = 'RAG Architecture Patterns'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

-- AZ-APR26 feedback (4 modules x ~4 each = 16)
INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AZ-APR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 15000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Alex made Bicep look easy. Great templates provided.'),
    (4, 'Just Right',      4, 'Good comparison between Bicep and Terraform.'),
    (4, 'Too Technical',   3, 'ARM template concepts were hard to grasp.'),
    (5, 'Just Right',      5, NULL)
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AZ-APR26' AND m.ModuleName = 'Azure Infrastructure as Code'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AZ-APR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 15000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (4, 'Too Technical',   3, 'Kubernetes is complex. More beginner-friendly examples needed.'),
    (5, 'Just Right',      5, 'Jordan is a K8s wizard. Learned a ton.'),
    (3, 'Too Technical',   2, 'Lost me at service mesh configuration.'),
    (4, 'Just Right',      4, 'Good hands-on with AKS cluster setup.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AZ-APR26' AND m.ModuleName = 'Kubernetes on Azure (AKS)'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AZ-APR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 15000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'GitHub Actions workflow examples were spot on.'),
    (5, 'Just Right',      5, NULL),
    (4, 'Just Right',      4, 'Already using what I learned in my project.'),
    (4, 'Just Right',      4, 'Could use more on testing strategies.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AZ-APR26' AND m.ModuleName = 'DevOps with GitHub Actions'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

INSERT INTO Feedback (EventModuleId, EventId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt)
SELECT em.EventModuleId, em.EventId, 'AZ-APR26', sk, cd, ms, cmt, DATEADD(minute, -(ABS(CHECKSUM(NEWID())) % 15000), GETDATE())
FROM EventModules em
JOIN Events e ON em.EventId = e.EventId
JOIN Modules m ON em.ModuleId = m.ModuleId
CROSS APPLY (VALUES
    (5, 'Just Right',      5, 'Emma presented compliance in an engaging way. Not easy!'),
    (4, 'Just Right',      4, 'Good overview of Defender for Cloud.'),
    (4, 'Too Low Level',   3, 'Already certified in this area, wanted more depth.'),
    (5, 'Just Right',      5, 'The Zero Trust walkthrough was excellent.')
) AS v(sk, cd, ms, cmt)
WHERE e.EventCode = 'AZ-APR26' AND m.ModuleName = 'Security & Compliance in M365'
AND NOT EXISTS (SELECT 1 FROM Feedback f WHERE f.EventModuleId = em.EventModuleId AND f.AdditionalComments = cmt);

PRINT 'Sample data seeded: modules, events, event-modules, event access, and feedback';
