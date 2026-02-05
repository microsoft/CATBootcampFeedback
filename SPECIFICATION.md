# CAT Bootcamp Feedback Application - Specification

## Project Overview
A web application to collect structured feedback on modules delivered during the CAT Bootcamp. The application will gather quantitative ratings and qualitative feedback to assess module effectiveness and instructor performance.

The system consists of two main components:
1. **Public Feedback Form** - Unauthenticated forms accessed via unique URLs with embedded event codes AND module IDs
2. **Admin Interface** - Authenticated portal for managing modules and generating feedback collection URLs

## Key Architecture Decision: Module-Specific QR Codes

**Each module delivery within an event gets its own unique QR code and feedback URL.**

- **Previous approach**: One QR code per event → users select which module → submit feedback
- **New approach**: One QR code per module → users scan specific module QR → feedback form auto-loaded → submit feedback

**Benefits:**
- **Targeted feedback collection**: Each module's QR code links directly to its feedback form
- **No user selection needed**: Module, speaker, and date are pre-populated
- **Better tracking**: Feedback is directly tied to specific module deliveries
- **Clearer user experience**: Scan QR code → see module info → provide ratings → done

**URL Format:**
```
https://yourdomain.com/feedback.html?code=CSA1B2C3&module=5
```
- `code`: Event code (e.g., CSA1B2C3)
- `module`: EventModuleId (unique identifier for this module's delivery in this event)

## Terminology

**Important:** This application collects feedback on **modules** delivered at **events**.

- **Module**: Reusable training content (e.g., "Introduction to Copilot Studio")
  - Timeless training material/curriculum
  - Has a name and description
  - **Does NOT have speaker** - speakers vary by delivery
  - Can be delivered multiple times at different events by different speakers

- **Event**: A training session or bootcamp instance
  - Has a unique event code (admin-provided, e.g., "CSA1B2C3")
  - Has start/end dates and cohort ID
  - **Can include MULTIPLE modules** delivered as part of the event
  - Each module at the event has a designated speaker
  - Example: "CAT Bootcamp Q1-2026" event includes:
    - Module 1: "Intro to Copilot" delivered by John Doe
    - Module 2: "Advanced Copilot" delivered by Jane Smith
    - Module 3: "Best Practices" delivered by Mike Johnson

- **Event Module Delivery**: The junction between events and modules
  - Links a specific module to a specific event
  - Specifies WHO is delivering the module at this event
  - Specifies WHEN the module is delivered (order/date)
  - Each delivery has a unique speaker assigned

**Architecture:**
```
Events (1) ←→ (many) EventModules (many) ←→ (1) Modules
                          ↓
                    SpeakerName (per delivery)
                    DeliveryOrder
```

**Flow:**
1. Admin creates **modules** (reusable training content)
2. Admin creates an **event** with event code, dates, cohort
3. Admin adds **multiple modules** to the event, specifying:
   - Which module
   - Who's delivering it (speaker name)
   - When it's delivered (order/sequence)
4. System generates **unique feedback URL for each module delivery**: `feedback.html?code=CSA1B2C3&module=5`
   - `code` parameter = event code
   - `module` parameter = EventModuleId (unique identifier for this specific module delivery)
5. Participants scan QR code or access URL with both event and module pre-selected
6. Feedback form auto-loads with the specific event and module information
7. Feedback is captured for the specific module delivery at that event
8. If event code or module is invalid, user sees error: "Not a valid event code or module"

**In the Admin Interface:**
- Create and manage **modules** (reusable training content)
- Create **events** with unique event codes
- Add multiple modules to each event with delivery details:
  - Select module from library
  - Assign speaker for this delivery
  - Set delivery order/sequence
- View event details and associated modules
  - See all modules included in an event
  - View speaker assignments and delivery dates
  - Check feedback count per event
- Generate and manage QR codes for events:
  - View QR code in modal dialog
  - Download QR code as PNG image
  - Copy feedback URL to clipboard
- Edit existing events:
  - Modify event details (dates, cohort)
  - Update module assignments
  - Change speaker names
  - Reorder modules within event:
    - Move modules up/down in delivery sequence
    - Visual indicators for current order
    - Automatic order number updates
    - Changes saved immediately to database
- Activate/Deactivate events:
  - Toggle event active status
  - Confirmation dialog before status change
  - Deactivated events cannot receive new feedback
- View feedback per event or per module delivery

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
- **Event Code** (passed via URL parameter `code`, not visible to user)
- **EventModuleId** (passed via URL parameter `module`, not visible to user)
- Module name/title (auto-populated from EventModuleId lookup)
- Module delivery date (auto-populated from EventModuleId lookup)
- Speaker name (auto-populated from EventModuleId lookup - specific to this delivery)
- Event name and cohort (auto-populated from Event lookup)

**Key Change**: The feedback form now receives BOTH event code AND module ID via URL parameters, eliminating the need for users to select which module they're providing feedback for.

## Functional Requirements

### User Stories
1. As a bootcamp participant, I want to scan a QR code for a specific module and immediately provide feedback without selecting from a list
   - QR code takes me directly to the feedback form for that specific module
   - Module name, speaker, and date are already shown - no selection needed
   - I can quickly provide my ratings and submit
2. As a bootcamp organizer, I want to collect standardized feedback so that I can measure module effectiveness
   - Each module delivery gets its own unique QR code
   - Participants scan the relevant QR code during or after each module
3. As an instructor, I want to receive constructive feedback so that I can improve my delivery
   - Feedback is tied directly to my specific module delivery
   - Can track feedback across multiple events where I deliver the same module
4. As an admin, I want to create events with multiple modules and generate unique QR codes for each module
   - Create an event with event code (e.g., "CSA1B2C3")
   - Add multiple modules to the event, each with a speaker and delivery order
   - System generates a unique feedback URL for each module: `feedback.html?code=CSA1B2C3&module=5`
   - System generates a unique QR code for each module delivery
   - Download and print individual QR codes for each module
   - Invalid event codes or module IDs show error: "Not a valid event code or module"
5. As an admin, I want to view and manage all feedback submissions for each module delivery
   - View feedback aggregated by module across all events
   - View feedback for a specific module delivery at a specific event

### Key Features

#### Public Feedback Form
- **URL-Based Access**: Each module delivery has unique URL with event code AND module ID (e.g., `feedback.html?code=CSA1B2C3&module=5`)
  - `code` parameter (required): Event code identifying the training event
  - `module` parameter (required): EventModuleId identifying the specific module delivery
- **No Authentication Required**: Participants can submit feedback without logging in
- **Auto-Population**: Event and module details loaded automatically based on URL parameters
  - Module name, speaker name, and delivery date pre-populated
  - No module selection dropdown needed
- **Clean UI**: Intuitive form with clear labels and validation
- **Form Validation**: Prevent submission until all required fields are completed
- **Error Handling**: Display friendly error if event code or module ID is invalid
- **Confirmation**: Display success message after submission
- **Responsive Design**: Work on desktop, tablet, and mobile devices
- **Accessibility**: WCAG 2.1 AA compliant

#### Admin Interface
- **Module Management**: Create, edit, and manage bootcamp modules (training sessions)
  - Module details: name, date, speaker, cohort
  - Admin provides a unique event code for each module
- **Event Code Input**: Admin specifies event code when creating a module (e.g., "CSA1B2C3")
  - Format validation: Typically 8 characters, starts with "CS"
  - Event codes are admin-provided, not auto-generated
- **Event Actions**: Each event card provides action buttons:
  - **View Details & QR**: Opens modal showing:
    - Complete event information (dates, cohort, status)
    - List of all modules in the event with speaker names
    - Feedback count and submission statistics
    - QR code for feedback form (scannable)
    - Download QR code button (saves as PNG)
    - Copy feedback URL button (copies to clipboard)
  - **Edit**: Opens event editing modal
    - Modify event details (dates, cohort ID)
    - Update module assignments and speakers
    - Reuses existing event management modal
  - **Activate/Deactivate**: Toggle event active status
    - Confirmation dialog before status change
    - Updates database via API
    - Real-time UI update after change
    - Deactivated events cannot receive new feedback
- **Feedback URL Creation**: System generates URLs with the admin-provided event codes (e.g., `feedback.html?code=CSA1B2C3`)
- **QR Code Generation**: System automatically generates **unique QR codes for each module delivery**
  - Each QR code links to feedback form with both event code AND module ID
  - URL format: `feedback.html?code={EVENT_CODE}&module={EVENT_MODULE_ID}`
  - Participants scan to provide feedback about the specific module
  - No module selection needed - pre-populated from URL parameters
  - Customizable QR code colors (purple theme)
  - Each module in an event has its own downloadable QR code
- **Error Handling**: Invalid event codes in feedback URLs display: "Not a valid event code"
- **Event Deletion**: Delete modules/events with cascade deletion of all associated feedback (requires confirmation)
- **Feedback Viewing**: View all submitted feedback for each module, filtered by event code
- **Analytics Dashboard**: View summary statistics and trends per module
- **Export Capabilities**: Export feedback data to CSV/Excel
- **Authentication Required**: Secure access for administrators only (client-side authentication)
- **Count Display**: Dedicated page for displaying live feedback counts with auto-refresh
- **Responsive Design**: Fully responsive interface that works on desktop, tablet, and mobile devices
- **Visual Accessibility**: High contrast module count badges for better readability

### Count Display Page
- **Access Patterns**:
  - Event-level: `count.html?code={EVENT_CODE}` (shows total feedback for all modules)
  - Module-level: `count.html?code={EVENT_CODE}&module={EVENT_MODULE_ID}` (shows feedback for specific module)
- **Purpose**: Live display of feedback count during presentations
- **Features**:
  - Real-time feedback count with auto-refresh (5 second intervals)
  - Animated count transitions when numbers change
  - QR code display for attendees to scan (includes module parameter if module-specific)
  - Event and module information display
    - Event-level: Shows event name and total module count
    - Module-level: Shows specific module name and speaker
  - Last updated timestamp
  - Fullscreen mode toggle for presentations
  - Error handling for invalid/missing event codes or module IDs
- **Use Case**: Displayed on projector/screen during bootcamp sessions to encourage participation
  - Module-level display shown during individual module presentations
  - Event-level display shown for overall event feedback tracking

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

### Event Object (Module with Feedback Collection)

**Note:** An "Event" represents a **module** (training session) along with its feedback collection mechanism. The event object contains:
- Module information (name, date, speaker)
- Event code for feedback collection
- Generated feedback URL and QR code

The event code is captured from the URL when participants submit feedback about the module.
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

**Note:** Feedback is collected **about modules**. The `eventCode` field captures the code from the feedback URL, linking the feedback to the specific module.

```json
{
  "feedbackId": 123,
  "eventId": 1,
  "eventCode": "CSA1B2C3",  // Captured from URL parameter
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
- **Access Pattern**: `feedback.html?code={EVENT_CODE}&module={EVENT_MODULE_ID}`
- **URL Parameters**:
  - `code` (required) - Unique event identifier (e.g., CSA1B2C3)
  - `module` (required) - EventModuleId identifying the specific module delivery
- **Client-Side Operations**:
  - Parse URL parameters for event code and module ID
  - Fetch event and module details from API using both parameters
  - Display error if invalid/expired event code or module ID
  - Auto-populate form with module name, speaker, and delivery date
  - Client-side validation before submission
  - POST feedback to API with EventModuleId
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
GET  /api/events/{eventCode}/modules/{eventModuleId}
     - Get specific module delivery details for feedback form
     - Parameters:
       - eventCode: Event code (e.g., CSA1B2C3)
       - eventModuleId: EventModuleId from URL parameter
     - Returns: { success: true, data: { EventId, EventCode, EventModuleId, ModuleName, SpeakerName, DeliveryDate, DeliveryOrder, EventName, CohortId, IsActive } }
     - Returns 404 if event or module not found or inactive
     - Used by feedback form to load event and module details
     - Note: Returns PascalCase field names from database

GET  /api/events/{eventCode}
     - Get event details with all modules (legacy support)
     - Returns: { success: true, data: { EventId, EventCode, EventName, StartDate, EndDate, CohortId, IsActive, Modules: [...] } }
     - Returns 404 if not found or inactive
     - Note: Returns PascalCase field names from database

GET  /api/events/{eventCode}/modules/{eventModuleId}/count
     - Get feedback count for a specific module delivery
     - Returns: { success: true, data: { count: number } }
     - Used by count display page for live updates per module

GET  /api/events/{eventCode}/count
     - Get total feedback count for an event (all modules)
     - Returns: { success: true, data: { count: number } }
     - Used by count display page for event-level updates

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
     - Submit feedback for a specific module delivery
     - Body: { eventCode, eventModuleId, speakerKnowledge, contentDepth, moduleSatisfaction, additionalComments }
     - Parameters:
       - eventCode: Event code from URL
       - eventModuleId: EventModuleId from URL (identifies specific module delivery)
       - speakerKnowledge: Rating 1-5
       - contentDepth: 'Too Technical' | 'Just Right' | 'Too Low Level'
       - moduleSatisfaction: Rating 1-5
       - additionalComments: Optional text
     - Returns: { success: true, data: { feedbackId } }
     - Validates rating ranges (1-5) and content depth options
     - Links feedback to specific module delivery via EventModuleId
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

PUT    /api/events/{eventId}/status
       - Update event active status
       - Body: { isActive: boolean }
       - Returns: { success: true, data: { message, eventId, isActive } }
       - Used by Activate/Deactivate button in admin interface
       - Validates eventId exists before updating
       - Updates IsActive flag and UpdatedAt timestamp

DELETE /api/events/{eventId}
       - Delete event with cascade delete of feedback
       - Returns: { success: true, data: { message, eventId, feedbackDeleted } }
       - Permanently deletes event and all associated feedback
       - Requires confirmation in admin interface

POST   /api/admin/auth/login
       - Admin authentication (mock data in development)
       - Body: { username, password }
       - Returns: { success: true, token: string, user: { username, fullName } }
       - Demo credentials: username=admin, password=CATBootcamp2026!
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

### Rate Limiting Configuration

The application implements client-side rate limiting to prevent abuse and enhance security:

#### Admin Login Rate Limiting
- **Maximum Attempts**: 5 failed login attempts
- **Time Window**: 5 minutes (300,000 ms)
- **Behavior**: After 5 failed attempts, user must wait until the oldest attempt expires from the 5-minute window
- **Storage**: Uses localStorage with key `rateLimiter_login`
- **Configuration**: `MAX_LOGIN_ATTEMPTS: 5`, `LOGIN_COOLDOWN_MS: 300000`

#### Feedback Submission Rate Limiting
- **Maximum Submissions**: **UNLIMITED** (disabled for high-volume events)
- **Rationale**: Events may have hundreds of participants submitting feedback simultaneously
- **Behavior**: No rate limiting applied to feedback submissions
- **Storage**: Not applicable (rate limiting disabled)
- **Configuration**: `MAX_SUBMISSIONS_PER_EVENT: 0` (0 = unlimited)
- **Note**: Set to 0 to support large-scale events with many participants
- **Server-side Protection**: Should be implemented at API/database level if spam becomes an issue

#### Implementation Details
- **Client-Side Only**: Current implementation is client-side (can be bypassed)
- **Server-Side Recommendation**: Should be complemented with server-side rate limiting
- **Azure SQL Rate Limiting**: IP-based rate limiting can be tracked in database using `IX_Feedback_IpAddress_SubmittedAt` index
- **User Experience**: Shows friendly messages with time remaining (e.g., "Please wait 2 minutes")

### Security Considerations

#### Public Feedback Form
- **No PII Collection**: Don't require names, emails, or identifying information
- **Rate Limiting**: Client-side rate limiting disabled (set MAX_SUBMISSIONS_PER_EVENT = 0)
  - **Reason**: Events may have hundreds of participants
  - **Recommendation**: Implement server-side IP-based rate limiting if spam becomes an issue
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
- **Rate Limiting**:
  - Max 5 login attempts per 5 minutes (client-side)
  - Prevents brute force attacks
  - User-friendly lockout duration
- **Authorization**: Role-based access control (RBAC)
- **Session Management**:
  - JWT tokens with expiration
  - Secure, httpOnly cookies
  - Session stored in sessionStorage (not localStorage)
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
- **Content**: Full feedback URL with event code AND module ID
- **Format**: PNG or SVG
- **Size**: 300x300px minimum for print
- **Error Correction**: Level M or H for reliability
- **Storage**:
  - Option 1: Generate on-the-fly in admin interface (per module)
  - Option 2: Generate and store in Azure Blob Storage
  - Option 3: Both (cache in blob, regenerate if missing)
- **Generation Scope**: One unique QR code per module delivery
  - Each module in an event gets its own QR code
  - QR codes embed both event code and EventModuleId
  - Allows targeted feedback collection per module

Example URL in QR Code:
```
https://feedbackapp.azurewebsites.net/feedback.html?code=CSA1B2C3&module=5
```

Where:
- `code=CSA1B2C3` identifies the event
- `module=5` identifies the specific EventModuleId (this module's delivery in this event)

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
- [ ] Form loads with event code AND module ID from URL parameters
- [ ] Invalid/missing event code or module ID shows user-friendly error
- [ ] Module information auto-populated from URL parameters (module name, speaker, date)
- [ ] Event code and module ID not visible anywhere on the form (pre-populated behind the scenes)
- [ ] No module selection dropdown needed - module is pre-selected via URL
- [ ] All required fields must be filled before submission
- [ ] Rating scales clearly indicate 5 as the best score
- [ ] Form provides immediate validation feedback
- [ ] Successful submission shows confirmation message
- [ ] Form is responsive on mobile devices
- [ ] Form is accessible to users with disabilities
- [ ] Feedback is saved to Azure SQL database with EventModuleId
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
- [x] Deactivate/activate events with confirmation
- [x] Delete events with confirmation dialog and cascade deletion
- [x] View feedback submissions for each event
- [x] View aggregate statistics (averages, counts)
- [x] Export feedback data to CSV
- [x] Responsive design for admin interface
- [x] Login form with consistent input styling
- [ ] **View Details & QR button**: Display event details modal
  - [ ] Show complete event information (dates, cohort, status)
  - [ ] List all modules with speaker names and delivery dates
  - [ ] Display feedback count per module
  - [ ] **Generate and display unique QR code for EACH module delivery**
    - [ ] Each module row shows its own QR code
    - [ ] QR code includes both event code and EventModuleId
    - [ ] Download individual QR code as PNG per module
    - [ ] Copy module-specific feedback URL to clipboard
  - [ ] Optional: Show event-level QR code for all modules (if needed)
- [x] **Edit button**: Open event editing modal
- [x] **Activate/Deactivate button**: Toggle event status
  - [x] Confirmation dialog before status change
  - [x] API endpoint for status updates
  - [x] Real-time UI update after change
- [x] High contrast module count badges for accessibility
- [x] **Module Reordering**: Reorder modules within an event
  - [x] Up/down arrow buttons for each module
  - [x] API endpoint for updating delivery order
  - [x] Automatic reordering of other modules
  - [x] Real-time UI update after reordering

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
- **Feedback form**: `https://yourdomain.com/feedback.html?code=CSA1B2C3&module=5`
  - `code` parameter: Event code (e.g., CSA1B2C3)
  - `module` parameter: EventModuleId (e.g., 5)
- **Each module delivery gets its own unique URL**
  - Event code identifies which event
  - Module ID identifies which specific module within that event
- **QR codes encode the full URL** with both parameters for easy scanning
- **Count display**: `https://yourdomain.com/count.html?code=CSA1B2C3&module=5`
  - Can omit `module` parameter for event-level count
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
