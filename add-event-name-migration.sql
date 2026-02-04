-- ============================================
-- Add EventName field to Events table
-- ============================================
-- Date: 2026-02-04
-- Changes:
-- - Add EventName column to Events table
-- - Make EventName required (NOT NULL)
-- - Populate existing events with default names
-- ============================================

PRINT 'Adding EventName column to Events table...';
GO

-- Check if EventName column already exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'EventName')
BEGIN
    -- Add EventName column (initially nullable)
    ALTER TABLE Events ADD EventName NVARCHAR(200) NULL;
    PRINT '✓ EventName column added';

    -- Update existing events with a default name based on EventCode
    UPDATE Events
    SET EventName = 'Event ' + EventCode
    WHERE EventName IS NULL;
    PRINT '✓ Existing events updated with default names';

    -- Make EventName NOT NULL
    ALTER TABLE Events ALTER COLUMN EventName NVARCHAR(200) NOT NULL;
    PRINT '✓ EventName column set to NOT NULL';
END
ELSE
BEGIN
    PRINT '⚠ EventName column already exists';
END
GO

PRINT 'Migration completed successfully!';
GO
