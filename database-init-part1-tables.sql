-- ============================================
-- Part 1: Create Tables and Indexes
-- Run this first in Azure Portal Query Editor
-- ============================================

-- 1. EVENTS TABLE
CREATE TABLE Events (
    EventId INT PRIMARY KEY IDENTITY(1,1),
    EventName NVARCHAR(200) NOT NULL,
    EventCode NVARCHAR(8) NOT NULL UNIQUE,
    StartDate DATETIME NOT NULL,
    EndDate DATETIME NULL,
    CohortId NVARCHAR(50) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    IsDeleted BIT DEFAULT 0,
    DeletedAt DATETIME2 NULL,
    DeletedBy NVARCHAR(100) NULL
);

CREATE INDEX IX_Events_EventCode ON Events(EventCode);
CREATE INDEX IX_Events_IsActive ON Events(IsActive);

-- 2. MODULES TABLE
CREATE TABLE Modules (
    ModuleId INT PRIMARY KEY IDENTITY(1,1),
    ModuleName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME NULL,
    UpdatedBy NVARCHAR(100) NULL
);

CREATE INDEX IX_Modules_IsActive ON Modules(IsActive);

-- 3. EVENTMODULES JUNCTION TABLE
CREATE TABLE EventModules (
    EventModuleId INT PRIMARY KEY IDENTITY(1,1),
    EventId INT NOT NULL,
    ModuleId INT NOT NULL,
    SpeakerName NVARCHAR(100) NOT NULL,
    DeliveryOrder INT NOT NULL DEFAULT 1,
    DeliveryDate DATETIME NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    CONSTRAINT FK_EventModules_Events FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE,
    CONSTRAINT FK_EventModules_Modules FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId) ON DELETE CASCADE,
    CONSTRAINT UQ_EventModules_EventModule UNIQUE (EventId, ModuleId)
);

CREATE INDEX IX_EventModules_EventId ON EventModules(EventId);
CREATE INDEX IX_EventModules_ModuleId ON EventModules(ModuleId);

-- 4. FEEDBACK TABLE
CREATE TABLE Feedback (
    FeedbackId INT PRIMARY KEY IDENTITY(1,1),
    EventModuleId INT NOT NULL,
    EventId INT NOT NULL,
    EventCode NVARCHAR(8) NOT NULL,
    SpeakerKnowledge INT NOT NULL CHECK (SpeakerKnowledge BETWEEN 1 AND 5),
    ContentDepth NVARCHAR(20) NOT NULL CHECK (ContentDepth IN ('Too Technical', 'Just Right', 'Too Low Level')),
    ModuleSatisfaction INT NOT NULL CHECK (ModuleSatisfaction BETWEEN 1 AND 5),
    AdditionalComments NVARCHAR(1000) NULL,
    IpAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    SubmittedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Feedback_EventModules FOREIGN KEY (EventModuleId) REFERENCES EventModules(EventModuleId) ON DELETE CASCADE
);

CREATE INDEX IX_Feedback_EventModuleId ON Feedback(EventModuleId);
CREATE INDEX IX_Feedback_EventId ON Feedback(EventId);
CREATE INDEX IX_Feedback_EventCode ON Feedback(EventCode);
CREATE INDEX IX_Feedback_SubmittedAt ON Feedback(SubmittedAt DESC);
