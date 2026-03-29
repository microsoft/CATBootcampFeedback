-- ============================================
-- Migration 004: Add AuditLog table
-- Tracks all actions by authenticated users
-- Never tracks anonymous feedback submissions
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLog')
BEGIN
    CREATE TABLE AuditLog (
        AuditLogId      BIGINT PRIMARY KEY IDENTITY(1,1),
        UserId          INT NOT NULL,
        Username        NVARCHAR(100) NOT NULL,
        Action          NVARCHAR(50) NOT NULL,
        ResourceType    NVARCHAR(50) NOT NULL,
        ResourceId      NVARCHAR(100) NULL,
        Summary         NVARCHAR(500) NOT NULL,
        Details         NVARCHAR(MAX) NULL,
        IpAddress       NVARCHAR(45) NULL,
        Timestamp       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_AuditLog_Timestamp ON AuditLog(Timestamp DESC);
    CREATE INDEX IX_AuditLog_UserId ON AuditLog(UserId);
    CREATE INDEX IX_AuditLog_Action ON AuditLog(Action);
    CREATE INDEX IX_AuditLog_ResourceType ON AuditLog(ResourceType);

    PRINT 'AuditLog table created';
END
ELSE
    PRINT 'AuditLog table already exists — skipping';
