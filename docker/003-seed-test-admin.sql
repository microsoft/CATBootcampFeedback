-- ============================================
-- Seed test admin user for local development
-- All passwords: Admin123!
-- bcrypt hash: $2b$10$LAz3S.Q2v6gqKkJHHGdY9.KSYt797fzivAFLv.6lJcbrBKGjVRZcm
-- ============================================

-- Create protected Global Admin
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'admin')
BEGIN
    INSERT INTO Users (Username, PasswordHash, FullName, Email, IsActive, IsProtected, MustChangePassword, CreatedBy)
    VALUES ('admin', '$2b$10$LAz3S.Q2v6gqKkJHHGdY9.KSYt797fzivAFLv.6lJcbrBKGjVRZcm', 'Global Admin', 'admin@catbootcamp.local', 1, 1, 0, 'seed-script');

    INSERT INTO UserRoles (UserId, RoleId, AssignedBy)
    SELECT u.UserId, r.RoleId, 'seed-script'
    FROM Users u, Roles r WHERE u.Username = 'admin' AND r.RoleName = 'GlobalAdmin';
END;

-- UserAdmin test user
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'useradmin')
BEGIN
    INSERT INTO Users (Username, PasswordHash, FullName, Email, IsActive, MustChangePassword, CreatedBy)
    VALUES ('useradmin', '$2b$10$LAz3S.Q2v6gqKkJHHGdY9.KSYt797fzivAFLv.6lJcbrBKGjVRZcm', 'User Admin Tester', 'useradmin@catbootcamp.local', 1, 0, 'seed-script');

    INSERT INTO UserRoles (UserId, RoleId, AssignedBy)
    SELECT u.UserId, r.RoleId, 'seed-script'
    FROM Users u, Roles r WHERE u.Username = 'useradmin' AND r.RoleName = 'UserAdmin';
END;

-- ModuleManager test user
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'modulemanager')
BEGIN
    INSERT INTO Users (Username, PasswordHash, FullName, Email, IsActive, MustChangePassword, CreatedBy)
    VALUES ('modulemanager', '$2b$10$LAz3S.Q2v6gqKkJHHGdY9.KSYt797fzivAFLv.6lJcbrBKGjVRZcm', 'Module Manager Tester', 'modulemanager@catbootcamp.local', 1, 0, 'seed-script');

    INSERT INTO UserRoles (UserId, RoleId, AssignedBy)
    SELECT u.UserId, r.RoleId, 'seed-script'
    FROM Users u, Roles r WHERE u.Username = 'modulemanager' AND r.RoleName = 'ModuleManager';
END;

-- EventCreator test user
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'eventcreator')
BEGIN
    INSERT INTO Users (Username, PasswordHash, FullName, Email, IsActive, MustChangePassword, CreatedBy)
    VALUES ('eventcreator', '$2b$10$LAz3S.Q2v6gqKkJHHGdY9.KSYt797fzivAFLv.6lJcbrBKGjVRZcm', 'Event Creator Tester', 'eventcreator@catbootcamp.local', 1, 0, 'seed-script');

    INSERT INTO UserRoles (UserId, RoleId, AssignedBy)
    SELECT u.UserId, r.RoleId, 'seed-script'
    FROM Users u, Roles r WHERE u.Username = 'eventcreator' AND r.RoleName = 'EventCreator';
END;

-- FeedbackManager test user
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'feedbackmgr')
BEGIN
    INSERT INTO Users (Username, PasswordHash, FullName, Email, IsActive, MustChangePassword, CreatedBy)
    VALUES ('feedbackmgr', '$2b$10$LAz3S.Q2v6gqKkJHHGdY9.KSYt797fzivAFLv.6lJcbrBKGjVRZcm', 'Feedback Manager Tester', 'feedbackmgr@catbootcamp.local', 1, 0, 'seed-script');

    INSERT INTO UserRoles (UserId, RoleId, AssignedBy)
    SELECT u.UserId, r.RoleId, 'seed-script'
    FROM Users u, Roles r WHERE u.Username = 'feedbackmgr' AND r.RoleName = 'FeedbackManager';
END;

-- FeedbackViewer test user (reporting role)
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'reporter')
BEGIN
    INSERT INTO Users (Username, PasswordHash, FullName, Email, IsActive, MustChangePassword, CreatedBy)
    VALUES ('reporter', '$2b$10$LAz3S.Q2v6gqKkJHHGdY9.KSYt797fzivAFLv.6lJcbrBKGjVRZcm', 'Feedback Viewer / Reporter', 'reporter@catbootcamp.local', 1, 0, 'seed-script');

    INSERT INTO UserRoles (UserId, RoleId, AssignedBy)
    SELECT u.UserId, r.RoleId, 'seed-script'
    FROM Users u, Roles r WHERE u.Username = 'reporter' AND r.RoleName = 'FeedbackViewer';
END;

-- Create a sample event
IF NOT EXISTS (SELECT 1 FROM Events WHERE EventCode = 'TEST001')
BEGIN
    INSERT INTO Events (EventName, EventCode, StartDate, EndDate, TrainingTrack, IsActive, CreatedBy)
    VALUES ('Test Bootcamp Event', 'TEST001', GETDATE(), DATEADD(day, 5, GETDATE()), 'Azure Developer', 1, 'admin');

    -- Grant event access to relevant test users
    INSERT INTO UserEventAccess (UserId, EventId, GrantedBy)
    SELECT u.UserId, e.EventId, 'seed-script'
    FROM Users u, Events e
    WHERE e.EventCode = 'TEST001' AND u.Username IN ('feedbackmgr', 'reporter', 'eventcreator');
END;
