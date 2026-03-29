-- ============================================
-- Migration 005: Widen EventCode columns to match
-- the validation rule (3-50 characters)
-- ============================================

ALTER TABLE Events ALTER COLUMN EventCode NVARCHAR(50) NOT NULL;
ALTER TABLE Feedback ALTER COLUMN EventCode NVARCHAR(50) NOT NULL;

PRINT 'Widened EventCode columns to NVARCHAR(50)';
