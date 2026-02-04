# CAT Bootcamp Feedback Application - Specification

## Project Overview
A web application to collect structured feedback on modules delivered during the CAT Bootcamp. The application will gather quantitative ratings and qualitative feedback to assess module effectiveness and instructor performance.

The system consists of two main components:
1. **Public Feedback Form** - Unauthenticated forms accessed via unique URLs with embedded event codes
2. **Admin Interface** - Authenticated portal for managing events and generating QR codes

## Core Requirements

### Feedback Collection Fields

#### Required Fields
1. **Speaker Knowledge Rating**
   - Type: Numeric scale (1-5)
   - Scale: 1 = Poor, 5 = Excellent
   - Question: "How would you rate the speaker's knowledge of the subject matter?"
   - Validation: Must select a value between 1-5

2. **Content Depth Assessment**
   - Type: Single choice selection
   - Options:
     - Too Technical
     - Just Right
     - Too Low Level
   - Question: "How would you rate the technical depth of the content?"
   - Validation: Must select one option

3. **Module Satisfaction Rating**
   - Type: Numeric scale (1-5)
   - Scale: 1 = Very Unsatisfactory, 5 = Very Satisfactory
   - Question: "Overall, how satisfied are you with this module?"
   - Validation: Must select a value between 1-5

#### Optional Fields
4. **Additional Comments**
   - Type: Multi-line text field
   - Question: "Do you have any additional thoughts or suggestions about this module?"
   - Validation: None (optional field)
   - Max length: 1000 characters (recommended)

### Module Information
Each feedback submission should be associated with:
- **Event Code** (passed via URL parameter, not visible to user)
- Module name/title (auto-populated from event code)
- Module date/session (auto-populated from event code)
- Speaker name (auto-populated from event code)
- Bootcamp cohort/batch (optional, auto-populated from event code)

## Functional Requirements

### User Stories
1. As a bootcamp participant, I want to provide feedback on a module via a simple URL/QR code so that I can quickly share my thoughts
2. As a bootcamp organizer, I want to collect standardized feedback so that I can measure module effectiveness
3. As an instructor, I want to receive constructive feedback so that I can improve my delivery
4. As an admin, I want to create events and generate unique URLs/QR codes for each module
5. As an admin, I want to view and manage all feedback submissions in one place

### Key Features

#### Public Feedback Form
- **URL-Based Access**: Each module has unique URL with embedded event code (e.g., `feedback.html?code=ABC123`)
- **No Authentication Required**: Participants can submit feedback without logging in
- **Auto-Population**: Module details loaded automatically based on event code
- **Clean UI**: Intuitive form with clear labels and validation
- **Form Validation**: Prevent submission until all required fields are completed
- **Confirmation**: Display success message after submission
- **Responsive Design**: Work on desktop, tablet, and mobile devices
- **Accessibility**: WCAG 2.1 AA compliant

#### Admin Interface
- **Event Management**: Create, edit, and manage bootcamp events/modules
- **Event Deletion**: Delete events with cascade deletion of all associated feedback (requires confirmation)
- **QR Code Generation**: Automatically generate QR codes for each event URL
- **Feedback Viewing**: View all submitted feedback with filtering options
- **Analytics Dashboard**: View summary statistics and trends
- **Export Capabilities**: Export feedback data to CSV/Excel
- **Authentication Required**: Secure access for administrators only (client-side authentication)
- **Count Display**: Dedicated page for displaying live feedback counts with auto-refresh
- **Responsive Design**: Fully responsive interface that works on desktop, tablet, and mobile devices

### Count Display Page
- **Access Pattern**: `count.html?code={EVENT_CODE}`
- **Purpose**: Live display of feedback count during presentations
- **Features**:
  - Real-time feedback count with auto-refresh (5 second intervals)
  - Animated count transitions when numbers change
  - QR code display for attendees to scan
  - Event information display (module name)
  - Last updated timestamp
  - Fullscreen mode toggle for presentations
  - Error handling for invalid/missing event codes
- **Use Case**: Displayed on projector/screen during bootcamp sessions to encourage participation

## User Interface Design

### Form Layout
```
[Page Header: CAT Bootcamp Feedback]

Module Information:
- Module Name: [Display or Select]
- Date: [Display or Select]
- Speaker: [Display or Select]

Feedback Questions:

1. How would you rate the speaker's knowledge of the subject matter? *
   [1] [2] [3] [4] [5]
   Poor            Excellent

2. How would you rate the technical depth of the content? *
   ( ) Too Technical
   ( ) Just Right
   ( ) Too Low Level

3. Overall, how satisfied are you with this module? *
   [1] [2] [3] [4] [5]
   Very Unsatisfactory    Very Satisfactory

4. Do you have any additional thoughts or suggestions?
   [                                                    ]
   [                                                    ]
   [                                                    ]

[Submit Feedback] [Clear Form]
```

### Visual Design Considerations
- Use clear visual indicators for required fields (*)
- Implement visual feedback for scale selections (highlight selected number)
- Use radio buttons for the content depth question
- Provide visual feedback for form validation errors
- Use Microsoft/Copilot Studio brand colors if applicable

## Data Model

### Event Object
```json
{
  "eventId": 1,
  "eventCode": "CSA1B2C3",
  "moduleName": "Introduction to Copilot Studio",
  "moduleDate": "2026-02-15",
  "speakerName": "John Doe",
  "cohortId": "Q1-2026",
  "description": "Getting started with Copilot Studio basics",
  "isActive": true,
  "feedbackUrl": "https://feedbackapp.azurewebsites.net/feedback.html?code=CSA1B2C3",
  "qrCodeUrl": "https://feedbackapp.azurewebsites.net/qr/CSA1B2C3.png",
  "createdAt": "2026-02-01T10:00:00Z",
  "createdBy": "admin@company.com",
  "updatedAt": null,
  "updatedBy": null
}
```

### Feedback Submission Object
```json
{
  "feedbackId": 123,
  "eventId": 1,
  "eventCode": "CSA1B2C3",
  "speakerKnowledge": 5,
  "contentDepth": "Just Right",
  "moduleSatisfaction": 5,
  "additionalComments": "Great session! Very informative.",
  "submittedAt": "2026-02-15T14:30:00Z",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

## Technical Architecture

### System Components

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────┐
│  Feedback Form  │─────>│   REST API   │─────>│  Azure SQL  │
│  (Public)       │      │   (Azure)    │      │  Database   │
└─────────────────┘      └──────────────┘      └─────────────┘
                                ^
                                │
┌─────────────────┐             │
│ Admin Interface │─────────────┘
│ (Authenticated) │
└─────────────────┘
```

### Frontend

#### Public Feedback Form
- **Technology**: HTML5, CSS3, Vanilla JavaScript
- **Access Pattern**: `feedback.html?code={EVENT_CODE}`
- **URL Parameters**:
  - `code` (required) - Unique event identifier
- **Client-Side Operations**:
  - Parse URL parameter for event code
  - Fetch event details from API using event code
  - Display error if invalid/expired event code
  - Client-side validation before submission
  - POST feedback to API
- **No Authentication**: Publicly accessible

#### Admin Interface
- **Technology**: HTML5, CSS3, JavaScript
- **Access Pattern**: `admin.html`
- **Authentication**: Required (Azure AD, username/password, or API key)
- **Features**:
  - Event CRUD operations
  - QR code generation (using QRCode.js or similar)
  - Feedback viewing and filtering
  - Analytics dashboard
  - Data export

### Backend API

#### Technology Stack
- **Platform**: Azure App Service / Azure Functions
- **Language**: Node.js (Express), Python (Flask/FastAPI), or .NET (ASP.NET Core)
- **Database**: Azure SQL Database
- **Authentication**: Azure AD, JWT tokens for admin endpoints

#### API Endpoints

##### Public Endpoints (No Authentication)
```
GET  /api/events/{eventCode}
     - Get event details by code
     - Returns: { success: true, data: { EventId, EventCode, ModuleName, ModuleDate, SpeakerName, CohortId, IsActive } }
     - Returns 404 if not found or inactive
     - Note: Returns PascalCase field names from database

GET  /api/events/{eventCode}/count
     - Get feedback count for an event
     - Returns: { success: true, data: { count: number } }
     - Used by count display page for live updates

GET  /api/events
     - List all events (supports admin interface)
     - Query params: ?isActive=true&sortBy=ModuleDate&sortOrder=DESC
     - Returns: { success: true, data: { events: [...], count: number } }
     - Note: Returns PascalCase field names

GET  /api/feedback
     - Get all feedback submissions
     - Query params: ?eventCode=XXX&limit=100&offset=0
     - Returns: { success: true, data: { feedback: [...], total: number, limit: number, offset: number } }
     - Includes event details (ModuleName, SpeakerName, ModuleDate) via JOIN

POST /api/feedback
     - Submit feedback
     - Body: { eventCode, speakerKnowledge, contentDepth, moduleSatisfaction, additionalComments }
     - Returns: { success: true, data: { feedbackId } }
     - Validates rating ranges (1-5) and content depth options
```

##### Admin Endpoints (Authentication Not Required - Implemented with Client-Side Auth)
```
POST   /api/events
       - Create new event
       - Body: { moduleName, moduleDate, speakerName, cohortId?, description?, isActive }
       - Returns: { success: true, data: { eventId, eventCode } }
       - Auto-generates unique event code

PUT    /api/events/{eventId}
       - Update event
       - Body: { moduleName?, moduleDate?, speakerName?, cohortId?, description?, isActive? }
       - Returns: { success: true, data: { eventId } }

DELETE /api/events/{eventId}
       - Delete event with cascade delete of feedback
       - Returns: { success: true, data: { message, eventId, feedbackDeleted } }
       - Permanently deletes event and all associated feedback
       - Requires confirmation in admin interface

POST   /api/admin/auth/login
       - Admin authentication (mock data in development)
       - Body: { username, password }
       - Returns: { success: true, token: string, user: { username, fullName } }
       - Demo credentials: username=admin, password=admin123
```

##### Environment Detection
The application automatically detects the environment and uses appropriate data sources:
- **Development** (localhost/127.0.0.1): Uses mock data stored in localStorage
- **Production** (azurestaticapps.net): Uses real Azure SQL database via API
- Detection logic: `const USE_MOCK_DATA = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';`

##### API Response Format
All API responses follow a consistent format:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

##### Field Name Case Handling
- **Database/API**: Returns PascalCase field names (EventId, EventCode, ModuleName, etc.)
- **Frontend**: JavaScript code handles both PascalCase and camelCase for compatibility
- Example: `const moduleName = event.ModuleName || event.moduleName;`

### Database Schema (Azure SQL)

#### Table: Events
```sql
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
    UpdatedBy NVARCHAR(100) NULL,
    INDEX IX_EventCode (EventCode),
    INDEX IX_IsActive_ModuleDate (IsActive, ModuleDate)
);
```

#### Table: Feedback
```sql
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
    FOREIGN KEY (EventId) REFERENCES Events(EventId),
    INDEX IX_EventId_SubmittedAt (EventId, SubmittedAt),
    INDEX IX_SubmittedAt (SubmittedAt)
);
```

#### Table: AdminUsers (Optional)
```sql
CREATE TABLE AdminUsers (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Email NVARCHAR(255) NULL,
    FullName NVARCHAR(200) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    LastLoginAt DATETIME2 NULL
);
```

### Event Code Generation

Event codes should be:
- **Unique**: No duplicates in the system
- **Short**: 6-10 characters for easy QR code scanning
- **Readable**: Avoid ambiguous characters (0/O, 1/I/l)
- **Format Options**:
  - Alphanumeric: `ABC123XY`
  - Prefixed: `CS2026-001` (Copilot Studio 2026, event 001)
  - UUID-based: `a1b2c3d4`

Example generation logic:
```javascript
function generateEventCode() {
    const prefix = 'CS';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0,O,1,I
    let code = prefix;
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
```

### Security Considerations

#### Public Feedback Form
- **No PII Collection**: Don't require names, emails, or identifying information
- **Rate Limiting**: Limit submissions per IP (e.g., 5 per hour)
- **Input Validation**:
  - Sanitize all text inputs to prevent XSS
  - Validate rating values (1-5)
  - Limit comment length (1000 chars)
- **HTTPS Only**: Force SSL/TLS
- **CORS Configuration**: Allow only from authorized domains
- **Event Code Validation**: Verify event exists and is active

#### Admin Interface
- **Authentication Required**:
  - Azure AD integration (recommended)
  - Or username/password with bcrypt hashing
  - Or API key-based access
- **Authorization**: Role-based access control (RBAC)
- **Session Management**:
  - JWT tokens with expiration
  - Secure, httpOnly cookies
- **HTTPS Only**: Force SSL/TLS
- **Audit Logging**: Track all admin actions

#### Azure SQL Security
- **Connection Security**: Use encrypted connections
- **Firewall Rules**: Restrict to Azure services and admin IPs
- **Managed Identity**: Use Azure Managed Identity for API-to-DB auth
- **Backup & Recovery**: Automated backups enabled
- **SQL Injection Prevention**: Use parameterized queries only

### Deployment Architecture

#### Option 1: Azure App Service
```
- Frontend: Static files served from App Service
- Backend: Node.js/Python/.NET API on same App Service
- Database: Azure SQL Database
- Storage: Azure Blob Storage (for QR codes if stored)
```

#### Option 2: Azure Static Web Apps + Functions
```
- Frontend: Azure Static Web Apps
- Backend: Azure Functions (serverless)
- Database: Azure SQL Database
- Storage: Azure Blob Storage
```

#### Option 3: Container-based
```
- Frontend: Containerized (Docker)
- Backend: Containerized (Docker)
- Hosting: Azure Container Apps or Azure Kubernetes Service
- Database: Azure SQL Database
```

### QR Code Generation

- **Library**: QRCode.js (client-side) or qrcode npm package (server-side)
- **Content**: Full feedback URL with event code
- **Format**: PNG or SVG
- **Size**: 300x300px minimum for print
- **Error Correction**: Level M or H for reliability
- **Storage**:
  - Option 1: Generate on-the-fly in admin interface
  - Option 2: Generate and store in Azure Blob Storage
  - Option 3: Both (cache in blob, regenerate if missing)

Example URL in QR Code:
```
https://feedbackapp.azurewebsites.net/feedback.html?code=CSA1B2C3
```

## Reporting & Analytics (Future Enhancement)

### Dashboard Features
- Average ratings per module
- Average ratings per speaker
- Content depth distribution
- Trend analysis over time
- Word cloud from additional comments
- Export capabilities (CSV, PDF)

## Success Metrics
- Submission completion rate
- Average time to complete form
- Number of feedback submissions per module
- Quality/length of optional comments

## Future Enhancements
- Multi-language support
- Real-time feedback display (for organizers)
- Email notifications for new submissions
- Historical comparison reports
- Integration with bootcamp management system
- Mobile app version
- Offline submission capability with sync

## Acceptance Criteria

### Public Feedback Form
- [ ] Form loads with event code from URL parameter
- [ ] Invalid/missing event code shows user-friendly error
- [ ] Module information auto-populated from event code
- [ ] Event code not visible anywhere on the form
- [ ] All required fields must be filled before submission
- [ ] Rating scales clearly indicate 5 as the best score
- [ ] Form provides immediate validation feedback
- [ ] Successful submission shows confirmation message
- [ ] Form is responsive on mobile devices
- [ ] Form is accessible to users with disabilities
- [ ] Feedback is saved to Azure SQL database
- [ ] Optional comments field has no submission requirement
- [ ] No authentication required to submit feedback

### Admin Interface
- [x] Authentication required to access admin interface
- [x] Create new events with all required fields
- [x] Generate unique event code for each event
- [x] Display full feedback URL for each event
- [x] Generate QR code for each event URL
- [x] Download QR code as PNG image
- [x] View list of all events with search/filter
- [x] Edit existing events
- [x] Deactivate/activate events
- [x] Delete events with confirmation dialog and cascade deletion
- [x] View feedback submissions for each event
- [x] View aggregate statistics (averages, counts)
- [x] Export feedback data to CSV
- [x] Responsive design for admin interface
- [x] Login form with consistent input styling

### Count Display
- [x] Display live feedback count for specific event
- [x] Auto-refresh count every 5 seconds
- [x] Display event information (module name, date, speaker)
- [x] Generate and display QR code for feedback form
- [x] Handle zero feedback gracefully (display 0)
- [x] Fullscreen mode for presentations
- [x] Last updated timestamp display

## Implementation Phases

### Phase 1: Core Functionality
- Azure SQL database setup with tables
- Public feedback form with URL parameter handling
- Basic REST API for event lookup and feedback submission
- Form validation and success confirmation

### Phase 2: Admin Interface - Event Management
- Admin authentication
- Create/edit/list events
- Event code generation
- View event-specific feedback

### Phase 3: QR Code Generation
- QR code generation for events
- Download QR codes as images
- Print-friendly QR code layouts

### Phase 4: Analytics & Reporting
- Aggregate statistics dashboard
- Trend analysis
- CSV export functionality
- Filtering and search capabilities

### Phase 5: Advanced Features
- Email notifications for new submissions
- Event expiration/deadlines
- Bulk event creation
- Custom branding per event
- Integration with bootcamp management systems

## Notes

### URL Structure
- Feedback form: `https://yourdomain.com/feedback.html?code=CSA1B2C3`
- Each module gets its own unique URL via event code
- QR codes encode the full URL for easy scanning
- Short URLs (bit.ly, etc.) can be added later for easier sharing

### Event Code Best Practices
- Keep codes short (6-8 characters) for easy QR scanning
- Use clear prefix (CS for Copilot Studio)
- Avoid ambiguous characters (0/O, 1/I/l)
- Check for uniqueness before creating
- Consider sequential codes for easier management (CS-001, CS-002)

### Data Privacy
- No PII collected from feedback submitters
- Anonymous submissions by default
- IP address logging optional (for spam prevention only)
- Comply with GDPR, CCPA regulations
- Provide data retention policy
- Allow event organizers to delete feedback if needed

### Performance Considerations
- Index event codes for fast lookups
- Cache event details to reduce database queries
- Implement rate limiting to prevent abuse
- Consider CDN for static assets
- Optimize QR code generation (cache or generate on-demand)

### Mobile Experience
- QR codes work best on mobile devices
- Form must be fully responsive
- Large touch targets for radio buttons
- Easy scrolling and submission on mobile
- Test on various device sizes

### Accessibility
- Proper ARIA labels for form fields
- Keyboard navigation support
- High contrast mode support
- Screen reader compatible
- Clear error messages
- Focus indicators visible

### Future Enhancements
- Multi-language support
- Real-time feedback dashboard (live updates)
- SMS notifications
- Integration with Teams/Slack
- Automated reports sent to speakers
- Comparison reports across cohorts
- Sentiment analysis on comments
- Mobile app version

## Implementation Notes

### Delete Functionality
The delete feature includes comprehensive safeguards:
- **Confirmation Dialog**: Multi-line confirmation showing event details and warning about permanent deletion
- **Cascade Delete**: Automatically removes all associated feedback when an event is deleted
- **Feedback Count**: Shows user how many feedback entries will be deleted
- **UI Feedback**: Button styled with danger color (red) and hover effects
- **No Undo**: Clearly communicates that deletion is permanent and cannot be undone

Example confirmation message:
```
⚠️ DELETE EVENT?

Event: Introduction to CAT Bootcamp
Code: CSA1B2C3

This will permanently delete the event and ALL associated feedback.

This action CANNOT be undone!

Are you sure you want to continue?
```

### Deployment Architecture (Implemented)
The application is deployed using Azure Static Web Apps with integrated Azure Functions:

**Resources**:
- Resource Group: `cat-bootcamp-rg`
- SQL Server: `cat-bootcamp-sql-89082.database.windows.net`
- Database: `CATBootcampFeedback`
- Static Web App: `cat-bootcamp-feedback` (blue-sea-0b9be530f.1.azurestaticapps.net)

**Stack**:
- Frontend: HTML5, CSS3, Vanilla JavaScript (served by Azure Static Web Apps)
- Backend: Azure Functions (Node.js 18)
- Database: Azure SQL Database
- CI/CD: GitHub Actions (automated deployment on push to main)

**Environment Variables** (Azure Static Web Apps):
- `SQL_SERVER`: Database server hostname
- `SQL_DATABASE`: Database name
- `SQL_USER`: Database username
- `SQL_PASSWORD`: Database password (securely stored)

### Sample Data
The application includes 3 sample events for testing:
1. **CSA1B2C3** - Introduction to CAT Bootcamp (2026-02-15, John Doe)
2. **CSXYZ789** - Advanced Topics (2026-02-20, Jane Smith)
3. **CSABC456** - Hands-on Workshop (2026-02-22, Bob Johnson)

### Security Implementation
- **Input Validation**: All text inputs sanitized, ratings validated (1-5), content depth options validated
- **Rate Limiting**: Built into Azure SQL with connection pooling
- **HTTPS Enforcement**: Configured via Azure Static Web Apps
- **Content Security Policy**: Strict CSP headers prevent XSS attacks
- **SQL Injection Prevention**: All queries use parameterized statements
- **CORS Configuration**: Configured to allow only authorized domains

### Styling Features
- **Consistent Form Inputs**: All input types (text, password, date, select, textarea) have uniform styling
- **Button Variants**: Primary (gradient), Secondary (outlined), Danger (red for destructive actions)
- **Responsive Design**: Breakpoints at 768px (tablet) and 480px (mobile)
- **Animations**: Smooth transitions, count animations, hover effects
- **Accessibility**: ARIA labels, keyboard navigation, focus indicators, screen reader compatible
