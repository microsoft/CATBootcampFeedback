-- Create Events table
CREATE TABLE Events (
    EventId INT IDENTITY(1,1) PRIMARY KEY,
    EventCode NVARCHAR(20) UNIQUE NOT NULL,
    ModuleName NVARCHAR(200) NOT NULL,
    ModuleDate DATE NOT NULL,
    SpeakerName NVARCHAR(100) NOT NULL,
    CohortId NVARCHAR(50) NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL
);

-- Create indexes for Events
CREATE NONCLUSTERED INDEX IX_Events_EventCode ON Events(EventCode);
CREATE NONCLUSTERED INDEX IX_Events_IsActive_ModuleDate ON Events(IsActive, ModuleDate DESC);

-- Create Feedback table
CREATE TABLE Feedback (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    EventId INT NOT NULL,
    EventCode NVARCHAR(20) NOT NULL,
    SpeakerKnowledge INT NOT NULL CHECK (SpeakerKnowledge BETWEEN 1 AND 5),
    ContentDepth NVARCHAR(20) NOT NULL CHECK (ContentDepth IN ('Too Technical', 'Just Right', 'Too Low Level')),
    ModuleSatisfaction INT NOT NULL CHECK (ModuleSatisfaction BETWEEN 1 AND 5),
    AdditionalComments NVARCHAR(MAX) NULL,
    SubmittedAt DATETIME2 DEFAULT GETDATE(),
    IpAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    FOREIGN KEY (EventId) REFERENCES Events(EventId)
);

-- Create indexes for Feedback
CREATE NONCLUSTERED INDEX IX_Feedback_EventId_SubmittedAt ON Feedback(EventId, SubmittedAt DESC);
CREATE NONCLUSTERED INDEX IX_Feedback_SubmittedAt ON Feedback(SubmittedAt DESC);

-- Insert sample event for testing
INSERT INTO Events (EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive)
VALUES ('CSA1B2C3', 'Introduction to CAT Bootcamp', '2026-02-15', 'John Doe', 'Q1-2026', 'Getting started with CAT', 1);

-- Insert additional sample events
INSERT INTO Events (EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, Description, IsActive)
VALUES
    ('CSXYZ789', 'Advanced Topics in CAT', '2026-02-20', 'Jane Smith', 'Q1-2026', 'Deep dive into advanced concepts', 1),
    ('CSABC456', 'CAT Best Practices', '2026-02-25', 'Mike Johnson', 'Q1-2026', 'Industry best practices', 1);
