-- ============================================
-- Migration 003: Add ProfileImage column to Users
-- Stores base64-encoded profile images
-- ============================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ProfileImage')
BEGIN
    ALTER TABLE Users ADD ProfileImage NVARCHAR(MAX) NULL;
    PRINT 'Added ProfileImage column to Users table';
END
ELSE
    PRINT 'ProfileImage column already exists — skipping';
