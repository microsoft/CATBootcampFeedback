-- ============================================
-- Migration 002: Add User Management & RBAC
-- Creates: Users, Roles, UserRoles, UserEventAccess
-- Adds role-based access control with resource-level security
-- ============================================

-- ============================================
-- 1. USERS TABLE (replaces ADMIN_USERS_JSON env var)
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        UserId              INT PRIMARY KEY IDENTITY(1,1),
        Username            NVARCHAR(100) NOT NULL,
        PasswordHash        NVARCHAR(255) NOT NULL,
        FullName            NVARCHAR(200) NOT NULL,
        Email               NVARCHAR(255) NOT NULL,
        IsActive            BIT NOT NULL DEFAULT 1,
        IsProtected         BIT NOT NULL DEFAULT 0,
        MustChangePassword  BIT NOT NULL DEFAULT 0,
        PasswordResetToken  NVARCHAR(255) NULL,
        PasswordResetExpiry DATETIME2 NULL,
        LastLoginAt         DATETIME2 NULL,
        CreatedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy           NVARCHAR(100) NULL,
        UpdatedAt           DATETIME2 NULL,
        UpdatedBy           NVARCHAR(100) NULL,
        CONSTRAINT UQ_Users_Username UNIQUE (Username),
        CONSTRAINT UQ_Users_Email UNIQUE (Email)
    );

    CREATE INDEX IX_Users_Username ON Users(Username);
    CREATE INDEX IX_Users_Email ON Users(Email);
    CREATE INDEX IX_Users_IsActive ON Users(IsActive);

    PRINT '✓ Users table created';
END
ELSE
    PRINT '⊘ Users table already exists — skipping';
GO

-- ============================================
-- 2. ROLES TABLE (seeded with 6 system roles)
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles')
BEGIN
    CREATE TABLE Roles (
        RoleId      INT PRIMARY KEY IDENTITY(1,1),
        RoleName    NVARCHAR(50) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsSystem    BIT NOT NULL DEFAULT 0,
        CONSTRAINT UQ_Roles_RoleName UNIQUE (RoleName)
    );

    -- Seed system roles
    INSERT INTO Roles (RoleName, Description, IsSystem) VALUES
        ('GlobalAdmin',     'Full access to everything — sees all events, modules, feedback, and analytics',  1),
        ('UserAdmin',       'Can manage users and their role assignments',                                     1),
        ('ModuleManager',   'Can create, edit, and delete modules in the catalog',                             1),
        ('EventCreator',    'Can create events and manage their event-modules and speakers',                   1),
        ('FeedbackManager', 'Can view and delete feedback for granted events',                                 1),
        ('FeedbackViewer',  'Read-only reporting: view feedback, analytics dashboards, and CSV exports for granted events', 1);

    PRINT '✓ Roles table created and seeded with 6 system roles';
END
ELSE
    PRINT '⊘ Roles table already exists — skipping';
GO

-- ============================================
-- 3. USER-ROLES JUNCTION TABLE
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
BEGIN
    CREATE TABLE UserRoles (
        UserRoleId  INT PRIMARY KEY IDENTITY(1,1),
        UserId      INT NOT NULL,
        RoleId      INT NOT NULL,
        AssignedAt  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        AssignedBy  NVARCHAR(100) NULL,
        CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES Roles(RoleId),
        CONSTRAINT UQ_UserRoles UNIQUE (UserId, RoleId)
    );

    CREATE INDEX IX_UserRoles_UserId ON UserRoles(UserId);
    CREATE INDEX IX_UserRoles_RoleId ON UserRoles(RoleId);

    PRINT '✓ UserRoles table created';
END
ELSE
    PRINT '⊘ UserRoles table already exists — skipping';
GO

-- ============================================
-- 4. USER-EVENT ACCESS TABLE (resource-level security)
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserEventAccess')
BEGIN
    CREATE TABLE UserEventAccess (
        UserEventAccessId   INT PRIMARY KEY IDENTITY(1,1),
        UserId              INT NOT NULL,
        EventId             INT NOT NULL,
        GrantedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        GrantedBy           NVARCHAR(100) NULL,
        CONSTRAINT FK_UserEventAccess_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_UserEventAccess_Events FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE,
        CONSTRAINT UQ_UserEventAccess UNIQUE (UserId, EventId)
    );

    CREATE INDEX IX_UserEventAccess_UserId ON UserEventAccess(UserId);
    CREATE INDEX IX_UserEventAccess_EventId ON UserEventAccess(EventId);

    PRINT '✓ UserEventAccess table created';
END
ELSE
    PRINT '⊘ UserEventAccess table already exists — skipping';
GO

-- ============================================
-- 5. HELPER VIEW: Users with their roles
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_UsersWithRoles')
BEGIN
    EXEC('
    CREATE VIEW vw_UsersWithRoles AS
    SELECT
        u.UserId,
        u.Username,
        u.FullName,
        u.Email,
        u.IsActive,
        u.IsProtected,
        u.MustChangePassword,
        u.LastLoginAt,
        u.CreatedAt,
        u.CreatedBy,
        r.RoleId,
        r.RoleName,
        r.Description AS RoleDescription,
        ur.AssignedAt AS RoleAssignedAt,
        ur.AssignedBy AS RoleAssignedBy
    FROM Users u
    LEFT JOIN UserRoles ur ON u.UserId = ur.UserId
    LEFT JOIN Roles r ON ur.RoleId = r.RoleId;
    ');
    PRINT '✓ vw_UsersWithRoles view created';
END
ELSE
    PRINT '⊘ vw_UsersWithRoles view already exists — skipping';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migration 002 complete';
PRINT '  Tables: Users, Roles, UserRoles, UserEventAccess';
PRINT '  Views: vw_UsersWithRoles';
PRINT '  Roles seeded: GlobalAdmin, UserAdmin, ModuleManager,';
PRINT '                EventCreator, FeedbackManager, FeedbackViewer';
PRINT '============================================';
