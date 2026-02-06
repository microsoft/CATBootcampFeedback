-- ============================================
-- Database Cleanup Script
-- Run this FIRST to remove all existing objects
-- ============================================

-- Drop stored procedures if they exist
IF OBJECT_ID('sp_GetFeedbackCountByEventCode', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetFeedbackCountByEventCode;

IF OBJECT_ID('sp_GetEventByCode', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetEventByCode;

-- Drop views if they exist
IF OBJECT_ID('vw_EventFeedbackCounts', 'V') IS NOT NULL
    DROP VIEW vw_EventFeedbackCounts;

IF OBJECT_ID('vw_FeedbackWithDetails', 'V') IS NOT NULL
    DROP VIEW vw_FeedbackWithDetails;

IF OBJECT_ID('vw_EventsWithModules', 'V') IS NOT NULL
    DROP VIEW vw_EventsWithModules;

-- Drop tables if they exist (in reverse order due to foreign keys)
IF OBJECT_ID('Feedback', 'U') IS NOT NULL
    DROP TABLE Feedback;

IF OBJECT_ID('EventModules', 'U') IS NOT NULL
    DROP TABLE EventModules;

IF OBJECT_ID('Modules', 'U') IS NOT NULL
    DROP TABLE Modules;

IF OBJECT_ID('Events', 'U') IS NOT NULL
    DROP TABLE Events;
