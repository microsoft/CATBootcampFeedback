# CAT Bootcamp Feedback Application - Specification

**Version:** 5.1
**Last Updated:** April 2, 2026
**Status:** Production (Deployed)

## Production Deployment

**Frontend:** https://blue-moss-01913f80f.1.azurestaticapps.net
**Backend API:** https://cat-bootcamp-api.azurewebsites.net/api
**Architecture:** Azure Static Web App + Separate Azure Functions App
**Database:** Azure SQL (V2 Schema - Many-to-Many)

## Project Overview
A web application to collect structured feedback on modules delivered during the CAT Bootcamp. The application gathers quantitative ratings and qualitative feedback to assess module effectiveness and instructor performance.

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
- Generate and manage QR codes for each module:
  - View QR code in modal dialog
  - Download QR code as PNG image
  - Copy feedback URL to clipboard
  - Open live counter page to track submissions in real-time
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
- **Event Code** (transparently passed via URL parameter `code`, not visible as form field)
- **EventModuleId** (transparently passed via URL parameter `module`, not visible as form field)
- Module name/title (auto-populated from EventModuleId lookup)
- Module delivery date (auto-populated from EventModuleId lookup)
- Speaker name (auto-populated from EventModuleId lookup - specific to this delivery)
- Event name and cohort (auto-populated from Event lookup)

**URL Parameter Transparency**:
- **Primary Flow**: URL parameters (`code` and `module`) transparently provide event and module identification
  - Parameters are embedded in QR codes and shared links
  - Users never see or need to know about these technical identifiers
  - Information flows through the URL without user interaction
- **Fallback Flow**: If URL parameters are missing, users are presented with user-friendly selection interfaces
  - Event selector: Shows event names, dates, and descriptions (not technical codes)
  - Module selector: Shows module names, speakers, and delivery dates (not technical IDs)
  - After selection, URL is updated with appropriate parameters for future sharing

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
  - `code` parameter: Event code identifying the training event
  - `module` parameter: EventModuleId identifying the specific module delivery
- **Transparent URL Parameter Flow** (Primary):
  - When both `code` and `module` parameters are provided in URL
  - Event and module details loaded automatically from URL parameters
  - Module name, speaker name, and delivery date pre-populated
  - No selection dropdowns needed - information transparently passed through URL
  - User proceeds directly to providing feedback ratings
- **Manual Selection Fallback** (When URL Parameters Missing):
  - If `code` parameter is missing or invalid: Display user-friendly event selector
    - Show list of active events with event names and dates
    - User selects event from dropdown or search interface
  - If `module` parameter is missing (but code is present): Display module selector
    - Show list of modules for the selected event
    - Display module name, speaker, and delivery date for each option
    - User selects which module to provide feedback for
  - After selections are made, proceed to feedback form with information populated
  - URL is updated to include selected parameters for sharing
- **No Authentication Required**: Participants can submit feedback without logging in
- **Clean UI**: Intuitive form with clear labels and validation
- **Form Validation**: Prevent submission until all required fields are completed
- **Error Handling**: Display friendly error messages for invalid parameters or selections
- **Confirmation**: Display success message after submission
- **Responsive Design**: Work on desktop, tablet, and mobile devices
- **Accessibility**: WCAG 2.1 AA compliant

#### Admin Interface
- **Module Management**: Create, edit, and manage bootcamp modules (training sessions)
  - Module details: name, date, speaker, cohort
  - Admin provides a unique event code for each module
- **Event Code Input**: Admin specifies event code when creating a module (e.g., "CSA1B2C3", "CAT-2024-Spring")
  - Format validation: 3-50 characters, any format accepted (unique codes are required)
  - Event codes are admin-provided or can be auto-generated with "CS" prefix
  - Common formats: "CS" prefix codes, date-based codes, or custom identifiers
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
- **Event Deletion**: Delete single events or bulk delete multiple events with cascade deletion of all associated feedback (requires confirmation)
- **Module Deletion**: Delete single modules or bulk delete multiple modules (requires confirmation, checks for dependencies)
- **Feedback Deletion**: Delete single feedback submissions or bulk delete multiple feedback entries (requires confirmation)
- **Feedback Viewing**: View all submitted feedback for each module, filtered by event code
- **Analytics Dashboard**: View summary statistics and trends per module
- **Export Capabilities**: Export feedback data to CSV/Excel
- **Authentication Required**: Secure access for administrators only (database-backed users with env-var fallback)
- **RBAC User Management (People & Permissions Tab)**:
  - Database-backed user accounts with bcrypt password hashing
  - 6 roles with permission matrix:
    | Role | Description | Key Permissions |
    |------|-------------|-----------------|
    | GlobalAdmin | Full system access | All permissions, manage users and roles |
    | UserAdmin | User management | Create/edit/delete users, assign roles |
    | ModuleManager | Module library management | Create/edit/delete modules |
    | EventCreator | Event management | Create/edit/delete events, assign modules |
    | FeedbackManager | Feedback administration | View/delete/export feedback |
    | FeedbackViewer | Read-only feedback access | View feedback and analytics |
  - People & Permissions tab in the admin interface:
    - View all users with their roles and event access
    - Create, edit, and deactivate user accounts
    - Assign and revoke roles per user
    - Grant or revoke per-event access
    - Protected accounts (GlobalAdmin) cannot be deleted or demoted
    - Force password change on next login
    - Profile image upload (base64)
  - Audit log viewer:
    - View all admin actions (CREATE, UPDATE, DELETE, LOGIN, etc.)
    - Filter by user, action type, resource type, and date range
    - Each entry includes timestamp, username, action summary, and client IP
    - JSON details available for drill-down
- **Count Display**: Dedicated page for displaying live feedback counts with auto-refresh
- **Responsive Design**: Fully responsive interface that works on desktop, tablet, and mobile devices
- **Visual Accessibility**: High contrast module count badges for better readability

### Count Display Page
- **Access Patterns**:
  - Module-specific: `count.html?code={EVENT_CODE}&module={EVENT_MODULE_ID}` (shows stats for specific module delivery)
  - Event-level: `count.html?code={EVENT_CODE}` (shows aggregate stats across all modules)
- **Purpose**: Live analytics dashboard displayed during presentations to show real-time feedback metrics
- **Transparent URL Parameter Flow** (Primary):
  - When `code` parameter is provided: Display event-level or module-specific analytics
  - Information automatically loaded from URL parameters
  - QR code generated with parameters included for attendee access
  - Auto-refresh with configurable interval (5, 10, 15, or 30 seconds; default: 15 seconds)
- **Manual Selection Fallback** (When URL Parameters Missing):
  - If `code` parameter is missing: Display user-friendly event selector
    - Show list of active events with names and dates
    - User selects event to display stats for
    - Option to further select specific module or view event-level stats
  - If `code` is present but `module` is missing:
    - Default to event-level view (aggregate across all modules)
    - Provide option to select specific module for module-specific view
  - After selection, URL is updated with parameters and display begins
- **Live Analytics Dashboard**:
  - **Total Feedback Count**: Large, prominent display with animated transitions
  - **Average Module Satisfaction**: 1-5 scale rating with visual indicator
  - **Average Speaker Knowledge**: 1-5 scale rating with visual indicator
  - **Content Depth Breakdown**: Visual chart showing distribution:
    - Too Technical (percentage and count)
    - Just Right (percentage and count)
    - Too Low Level (percentage and count)
  - **Auto-refresh**: Updates every 30 seconds with smooth animations
  - **Last Updated**: Timestamp showing when data was last refreshed
- **Theme System**:
  - **Classic** (default): Progress ring counter with confetti-based celebrations
  - **Feed the Cat**: Cartoon cat progresses through 6 visual stages as feedback count grows:
    - Stage 0%: Skinny sad cat begging for food
    - Stage 10%: Cat with food bowl, hopeful
    - Stage 25%: Smiling chubby cat, content
    - Stage 50%: Happy dancing cat celebrating
    - Stage 75%: Tuxedo cat holding platter of gourmet food
    - Stage 100%: Extremely fat cat on couch eating cheetos
  - Theme selector in footer to switch between themes
  - Each theme has its own set of encouraging messages
  - Theme choice persists via sessionStorage
  - Cat theme includes: food drop animation, "nom nom" munching sound, progress bar, and milestone cat bounce animation
  - Cat images fill available vertical space via responsive flex layout
  - Image assets: `cat-stage-0.png`, `cat-stage-10.png`, `cat-stage-25.png`, `cat-stage-50.png`, `cat-stage-75.png`, `cat-stage-100.png`
- **In-place Module Switcher** (module mode only):
  - When the live counter is opened with a `module` URL parameter, the header renders a `<select>` dropdown of every active module of the current event, sorted by delivery order, prefixed with `#<order>:` (e.g. `#1: Intro to CAT — John Doe`)
  - Selecting a different module triggers an in-place transition: the counter, QR code, and feedback submission URL switch to the new module, the URL bar updates via `history.replaceState`, and the refresh timer continues against the new module's count endpoint
  - Settings preserved across the switch: theme, sound, refresh interval, celebration level, fullscreen state
  - Celebrations are suppressed on the swap itself (`isFirstLoad` reset) and resume for real count deltas after
  - A translucent overlay with spinner (`Loading <module label>…`) covers the counter + QR area during the switch and disappears once the QR canvas redraw completes
  - Dropdown is disabled while a switch is in flight (race guard); rapid double-clicks are coalesced via the `session.isApplying` flag
  - On fetch failure, the dropdown reverts to the previous selection and an inline error appears in the header (`Couldn't load that module. Please try again.`); the previous module's count remains displayed
  - Cross-event switching is intentionally not supported on the live screen
  - State is held in a single `session` object inside `count.js`; `applySession({ eventCode, moduleId })` is the single entry point used by both the initial URL load and the dropdown
- **Display Features**:
  - QR code for attendees to quickly access feedback form
  - Event and module information header
    - Module-specific: Shows module dropdown (see above), speaker, and event details
    - Event-level: Shows event name and date range
  - **Refresh interval selector** - Dropdown to choose update frequency:
    - 5 seconds (fast updates)
    - 10 seconds (moderate)
    - 15 seconds (default, balanced)
    - 30 seconds (conserves bandwidth)
  - Fullscreen mode toggle for projection — all celebration visuals (confetti, screen glow, sound banner) render inside the fullscreen container
  - Visual status indicator showing live update status
  - Responsive layout optimized for projection displays
  - High-contrast design for visibility in presentation environments
- **Use Case**: Displayed on projector/second screen during presentations
  - Module-specific: Show real-time feedback metrics during individual module delivery
  - Event-level: Show aggregate feedback metrics across entire event
  - Encourages participation by showing live response counts
  - Provides instant feedback quality indicators to presenters

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

**Architecture:** The system uses a many-to-many relationship between Events and Modules through the EventModules junction table.

```
Events (1) ←→ (many) EventModules (many) ←→ (1) Modules
                        ↓
                  Feedback (many)
```

### Event Object

**Note:** An "Event" represents a training session or bootcamp instance with a unique event code. Events can contain multiple modules.

```json
{
  "eventId": 1,
  "eventCode": "CSA1B2C3",
  "eventName": "Cloud Adoption Training - Q1 2026",
  "startDate": "2026-02-15",
  "endDate": "2026-02-20",
  "cohortId": "Q1-2026",
  "isActive": true,
  "createdAt": "2026-02-01T10:00:00Z",
  "createdBy": "admin@company.com",
  "modules": [
    {
      "eventModuleId": 5,
      "moduleId": 1,
      "moduleName": "Introduction to Copilot Studio",
      "speakerName": "John Doe",
      "deliveryOrder": 1,
      "deliveryDate": "2026-02-15T09:00:00Z",
      "feedbackUrl": "https://feedbackapp.azurewebsites.net/feedback.html?code=CSA1B2C3&module=5"
    }
  ]
}
```

**Key Fields:**
- `eventCode`: Unique identifier for the event (e.g., "CSA1B2C3")
  - NVARCHAR(20), UNIQUE, NOT NULL
  - Admin-provided when creating events
  - Used in feedback URLs and QR codes
- `eventName`: Descriptive name for the event (e.g., "CAT Bootcamp Q1-2026")
- `modules`: Array of module deliveries associated with this event

### Module Object

**Note:** Modules are reusable training content that can be delivered at multiple events.

```json
{
  "moduleId": 1,
  "moduleName": "Introduction to Copilot Studio",
  "description": "Getting started with Copilot Studio basics",
  "isActive": true,
  "createdAt": "2026-01-15T10:00:00Z"
}
```

### Event Module Delivery Object

**Note:** Links a module to an event with delivery-specific details (speaker, order, date).

```json
{
  "eventModuleId": 5,
  "eventId": 1,
  "moduleId": 1,
  "speakerName": "John Doe",
  "deliveryOrder": 1,
  "deliveryDate": "2026-02-15T09:00:00Z",
  "notes": "Morning session",
  "feedbackUrl": "https://feedbackapp.azurewebsites.net/feedback.html?code=CSA1B2C3&module=5"
}
```

**Key Fields:**
- `eventModuleId`: Unique identifier for this specific module delivery
  - Used in feedback URLs as the `module` parameter
  - Links feedback to specific module delivery at specific event
- `speakerName`: Who is delivering this module at this event
- `deliveryOrder`: Sequence of this module within the event

### Feedback Submission Object

**Note:** Feedback is collected for specific module deliveries. Both `eventId` and `eventModuleId` link feedback to the exact module delivery instance.

```json
{
  "feedbackId": 123,
  "eventId": 1,
  "eventModuleId": 5,
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

**Key Fields:**
- `eventCode`: Captured from URL parameter `code`
- `eventModuleId`: Captured from URL parameter `module`
- Links feedback to specific module delivery at specific event

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
  - `code` - Unique event identifier (e.g., CSA1B2C3)
  - `module` - EventModuleId identifying the specific module delivery
  - Both parameters are optional; fallback UI shown if missing
- **Client-Side Operations**:
  - **Primary Flow (URL parameters present)**:
    - Parse URL parameters for event code and module ID
    - Fetch event and module details from API using both parameters
    - Display error if invalid/expired event code or module ID
    - Auto-populate form with module name, speaker, and delivery date
    - Show feedback form directly without selection screens
  - **Fallback Flow (URL parameters missing)**:
    - If `code` missing: Fetch list of active events, display event selector
    - If `code` present but `module` missing: Fetch modules for event, display module selector
    - User selects event and/or module from user-friendly dropdown/list
    - Update URL with selected parameters (enables sharing)
    - Fetch details and display form
  - **Common Operations**:
    - Client-side validation before submission
    - POST feedback to API with EventModuleId
    - Display success confirmation or error messages
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
- **Platform**: **Separate Azure Functions App** (cat-bootcamp-api)
  - **Why Separate?** Azure Static Web Apps' managed functions have limited support for custom routes with path parameters. A separate Functions app provides full RESTful routing capabilities.
- **Runtime**: Node.js 20 (Linux Consumption Plan)
- **URL**: https://cat-bootcamp-api.azurewebsites.net/api
- **Database**: Azure SQL Database (cat-bootcamp-sql-89082)
- **Authentication**: Simple token-based for admin endpoints

#### API Endpoints

**Base URL:** https://cat-bootcamp-api.azurewebsites.net/api

**Note:** The frontend calls `/api/events` and filters client-side to get specific event/module data. This approach works around the limitation that some custom route parameters didn't deploy properly with the separate Functions app.

##### Public Endpoints (No Authentication)
```
GET  /api/events
     - List all active events with their modules
     - Returns: { success: true, message: "Success", data: [ array of events ] }
     - Each event includes nested modules array
     - Frontend filters this data client-side for specific events/modules
     - Example response:
       {
         "success": true,
         "data": [{
           "eventId": 4,
           "eventCode": "CSADEW12",
           "eventName": "Test Event 1",
           "modules": [
             { "eventModuleId": 7, "moduleId": 2, "moduleName": "CAT Best Practices", ... }
           ]
         }]
       }

GET  /api/modules
     - List all active modules in the library
     - Returns: { success: true, data: [ array of modules ] }
     - Used by admin to select modules when creating events

POST /api/feedback
     - Submit feedback for a specific module delivery
     - Body: {
         eventCode: string,
         eventModuleId: number,
         speakerKnowledge: number (1-5),
         contentDepth: 'Too Technical' | 'Just Right' | 'Too Low Level',
         moduleSatisfaction: number (1-5),
         additionalComments?: string
       }
     - Returns: { success: true, data: { feedbackId } }
     - Validates rating ranges and event/module existence
```

##### Admin Endpoints (Authentication Required)
```
POST   /api/login
       - Admin authentication (database-backed users with ADMIN_USERS_JSON env-var fallback)
       - Body: { username: string, password: string }
       - Returns: { success: true, token: string, user: { userId, username, fullName, roles: [...] } }
       - Users are now stored in the database Users table with bcrypt hashes
       - Falls back to ADMIN_USERS_JSON environment variable if no database users exist
       - Demo credentials: username=admin, password=[REDACTED - See Desktop/Secure_CAT_Files/CREDENTIALS_MASTER.md]

POST   /api/events
       - Create new event
       - Body: { eventName, eventCode, startDate, endDate?, cohortId?, isActive }
       - Returns: { success: true, data: { eventId, eventCode } }
       - Event code can be provided or auto-generated

PUT    /api/events/{eventId}
       - Update event details
       - Body: { eventName?, startDate?, endDate?, cohortId?, isActive? }
       - Returns: { success: true, data: { eventId } }

PUT    /api/events/{eventId}/status
       - Activate/deactivate event
       - Body: { isActive: boolean }
       - Returns: { success: true, data: { message, eventId, isActive } }

POST   /api/modules
       - Create new reusable module
       - Body: { moduleName, description?, isActive }
       - Returns: { success: true, data: { moduleId } }

PUT    /api/modules/{moduleId}
       - Update module details
       - Body: { moduleName?, description?, isActive? }
       - Returns: { success: true, data: { moduleId } }

POST   /api/event-modules
       - Add a module to an event
       - Body: { eventId, moduleId, speakerName, deliveryOrder?, deliveryDate? }
       - Returns: { success: true, data: { eventModuleId } }

DELETE /api/event-modules/{eventModuleId}
       - Remove a module from an event
       - Returns: { success: true, data: { message } }

GET    /api/feedback/all
       - Get all feedback submissions (admin view)
       - Query params: ?eventCode=XXX&limit=100&offset=0
       - Returns: { success: true, data: { feedback: [...], total: number } }

DELETE /api/feedback/{feedbackId}
       - Delete a single feedback submission
       - Returns: { success: true, data: { message } }

DELETE /api/feedback/bulk
       - Delete multiple feedback submissions
       - Body: { feedbackIds: [1, 2, 3, ...] }
       - Returns: { success: true, data: { deletedCount: number, message } }

DELETE /api/events/{eventId}
       - Delete a single event and all associated feedback (cascade)
       - Returns: { success: true, data: { message, feedbackDeleted: number } }

DELETE /api/events/bulk
       - Delete multiple events and all associated feedback (cascade)
       - Body: { eventIds: [1, 2, 3, ...] }
       - Returns: { success: true, data: { deletedCount: number, feedbackDeleted: number, message } }

DELETE /api/modules/{moduleId}
       - Delete a single module (checks for dependencies first)
       - Returns: { success: true, data: { message } }
       - Error if module is used in active events

DELETE /api/modules/bulk
       - Delete multiple modules (checks for dependencies first)
       - Body: { moduleIds: [1, 2, 3, ...] }
       - Returns: { success: true, data: { deletedCount: number, skipped: number, message } }
       - Skips modules that are used in active events
```

##### User Management Endpoints (Authentication Required, UserAdmin+ role)
```
GET    /api/users
       - List all users with roles and event access
       - Returns: { success: true, data: [ array of user objects ] }

POST   /api/users
       - Create a new user
       - Body: { username, password, fullName, email, roles?: string[], eventIds?: number[] }
       - Returns: { success: true, data: { userId } }

GET    /api/users/{userId}
       - Get a single user with roles and event access
       - Returns: { success: true, data: { user object } }

PUT    /api/users/{userId}
       - Update user details
       - Body: { fullName?, email?, isActive?, roles?, eventIds?, mustChangePassword? }
       - Returns: { success: true, data: { userId } }

DELETE /api/users/{userId}
       - Delete a user (protected users cannot be deleted)
       - Returns: { success: true, data: { message } }

PUT    /api/users/{userId}/profile-image
       - Upload or update profile image (base64)
       - Body: { profileImage: string }
       - Returns: { success: true, data: { message } }
```

##### Password Management Endpoints (Authentication Required)
```
PUT    /api/users/{userId}/password
       - Change user password (self or admin)
       - Body: { currentPassword?, newPassword }
       - Returns: { success: true, data: { message } }

POST   /api/users/password-reset
       - Request password reset token
       - Body: { email }
       - Returns: { success: true, data: { message } }

POST   /api/users/password-reset/confirm
       - Confirm password reset with token
       - Body: { token, newPassword }
       - Returns: { success: true, data: { message } }
```

##### Audit Log Endpoints (Authentication Required, GlobalAdmin role)
```
GET    /api/audit-log
       - Get audit log entries
       - Query params: ?userId=X&action=CREATE&resourceType=USER&from=DATE&to=DATE&limit=100&offset=0
       - Returns: { success: true, data: { entries: [...], total: number } }
```

##### Notification Endpoints (Authentication Required, GlobalAdmin role)

Email notifications are sent via **Azure Communication Services (ACS)**. The ACS connection string is stored in Key Vault as `ACS-CONNECTION-STRING`, and emails are sent from an Azure-managed domain.

```
POST   /api/notifications/test-email
       - Send a test email notification via Azure Communication Services
       - Body: { to: string, subject?: string }
       - Returns: { success: true, data: { message } }

POST   /api/notifications/feedback-summary
       - Send feedback summary email for an event via Azure Communication Services
       - Body: { eventId: number, recipients: string[] }
       - Returns: { success: true, data: { message } }
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

### Database Schema (Azure SQL) - V2 Architecture

**Schema Version:** V2 (Many-to-Many Events ↔ Modules)

**Key Change:** Moved from single Events table to a many-to-many relationship where Events can have multiple Modules, and Modules can be reused across Events.

#### Table: Events
```sql
CREATE TABLE Events (
    EventId INT IDENTITY(1,1) PRIMARY KEY,
    EventCode NVARCHAR(20) UNIQUE NOT NULL,
    EventName NVARCHAR(200) NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NULL,
    CohortId NVARCHAR(50) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL,
    INDEX IX_EventCode (EventCode),
    INDEX IX_IsActive_StartDate (IsActive, StartDate)
);
```

#### Table: Modules
```sql
CREATE TABLE Modules (
    ModuleId INT IDENTITY(1,1) PRIMARY KEY,
    ModuleName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL,
    INDEX IX_ModuleName (ModuleName),
    INDEX IX_IsActive (IsActive)
);
```

**Purpose:** Reusable training modules that can be delivered at multiple events.

#### Table: EventModules
```sql
CREATE TABLE EventModules (
    EventModuleId INT IDENTITY(1,1) PRIMARY KEY,
    EventId INT NOT NULL,
    ModuleId INT NOT NULL,
    SpeakerName NVARCHAR(100) NOT NULL,
    DeliveryOrder INT NULL,
    DeliveryDate DATETIME2 NULL,
    Notes NVARCHAR(MAX) NULL,
    FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE,
    FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId),
    INDEX IX_EventId_DeliveryOrder (EventId, DeliveryOrder),
    INDEX IX_ModuleId (ModuleId)
);
```

**Purpose:** Junction table linking Events to Modules with delivery-specific details (speaker, order, date).

#### Table: Feedback
```sql
CREATE TABLE Feedback (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    EventModuleId INT NOT NULL,
    EventCode NVARCHAR(20) NOT NULL,
    SpeakerKnowledge INT NOT NULL CHECK (SpeakerKnowledge BETWEEN 1 AND 5),
    ContentDepth NVARCHAR(20) NOT NULL CHECK (ContentDepth IN ('Too Technical', 'Just Right', 'Too Low Level')),
    ModuleSatisfaction INT NOT NULL CHECK (ModuleSatisfaction BETWEEN 1 AND 5),
    AdditionalComments NVARCHAR(MAX) NULL,
    SubmittedAt DATETIME2 DEFAULT GETDATE(),
    IpAddress NVARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    FOREIGN KEY (EventModuleId) REFERENCES EventModules(EventModuleId) ON DELETE CASCADE,
    INDEX IX_EventModuleId_SubmittedAt (EventModuleId, SubmittedAt),
    INDEX IX_EventCode (EventCode),
    INDEX IX_SubmittedAt (SubmittedAt)
);
```

**Purpose:** Stores feedback submissions tied to specific module deliveries (EventModuleId).

#### Table: Users (RBAC - replaces AdminUsers)
```sql
CREATE TABLE Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(200) NULL,
    Email NVARCHAR(255) UNIQUE NULL,
    IsActive BIT DEFAULT 1,
    IsProtected BIT DEFAULT 0,
    MustChangePassword BIT DEFAULT 0,
    ProfileImage NVARCHAR(MAX) NULL,
    PasswordResetToken NVARCHAR(255) NULL,
    PasswordResetExpiry DATETIME2 NULL,
    LastLoginAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy NVARCHAR(100) NULL
);
```

#### Table: Roles
```sql
CREATE TABLE Roles (
    RoleId INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) UNIQUE NOT NULL,
    Description NVARCHAR(500) NULL,
    IsSystem BIT DEFAULT 0
);
-- Seeded: GlobalAdmin, UserAdmin, ModuleManager, EventCreator, FeedbackManager, FeedbackViewer
```

#### Table: UserRoles (Junction)
```sql
CREATE TABLE UserRoles (
    UserRoleId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL REFERENCES Users(UserId) ON DELETE CASCADE,
    RoleId INT NOT NULL REFERENCES Roles(RoleId),
    AssignedAt DATETIME2 DEFAULT GETDATE(),
    AssignedBy NVARCHAR(100) NULL
);
```

#### Table: UserEventAccess
```sql
CREATE TABLE UserEventAccess (
    UserEventAccessId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL REFERENCES Users(UserId) ON DELETE CASCADE,
    EventId INT NOT NULL REFERENCES Events(EventId) ON DELETE CASCADE,
    GrantedAt DATETIME2 DEFAULT GETDATE(),
    GrantedBy NVARCHAR(100) NULL
);
```

#### Table: AuditLog
```sql
CREATE TABLE AuditLog (
    AuditLogId BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    Username NVARCHAR(100) NULL,
    Action NVARCHAR(50) NOT NULL,
    ResourceType NVARCHAR(50) NULL,
    ResourceId NVARCHAR(100) NULL,
    Summary NVARCHAR(500) NULL,
    Details NVARCHAR(MAX) NULL,
    IpAddress NVARCHAR(45) NULL,
    Timestamp DATETIME2 DEFAULT GETDATE()
);
```

**Note:** Users are now database-backed. The ADMIN_USERS_JSON environment variable serves as a fallback for bootstrap and recovery scenarios only.

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

### Event and Module Lifecycle Management

#### Default Active Status
All new events and modules are created with active status by default:
- **New Events**: `IsActive = 1` (active) by default
- **New Modules**: `IsActive = 1` (active) by default
- **Database Default**: Both Events and Modules tables have `IsActive BIT DEFAULT 1`
- **API Default**: CreateEvent and CreateModule APIs default `isActive = true` if not specified

#### Automatic Event Archival
Events are automatically archived (marked inactive) based on age:
- **Trigger**: Events with EndDate more than 14 days in the past
- **Action**: `IsActive` set to 0 automatically
- **Timing**: Checked when GetEvents API is called (admin panel loads)
- **Audit Trail**: UpdatedBy set to 'system-auto-archive', UpdatedAt set to current timestamp

**Auto-Archive Logic:**
```sql
UPDATE Events
SET IsActive = 0,
    UpdatedAt = GETDATE(),
    UpdatedBy = 'system-auto-archive'
WHERE IsActive = 1
  AND EndDate IS NOT NULL
  AND DATEDIFF(DAY, EndDate, GETDATE()) > 14
```

#### Manual Status Management
Administrators can manually change status:
- **Deactivate Early**: Mark events inactive before auto-archive period
- **Reactivate**: Manually set IsActive = 1 to reactivate archived events
- **Module Deactivation**: Mark modules inactive to hide from all events
- **Cascading Effect**: Inactive modules are filtered from all API responses

#### Status Filter Behavior
- **GetEvents**: Returns only active events (`WHERE e.IsActive = 1`)
- **GetEventModule**: Returns only if both event AND module are active
- **Admin Panel**: Only shows and generates QR codes for active modules
- **Feedback Form**: Only accepts feedback for active event-module combinations

#### Business Rules
1. **Archive Period**: 14 days after event EndDate
2. **Null EndDate**: Events without EndDate are never auto-archived
3. **Manual Override**: Admins can reactivate archived events if needed
4. **Module Reuse**: Inactive modules can be reactivated for new events
5. **Data Retention**: Archived events retain all feedback data

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
  - Database-backed user accounts (Users table) with bcrypt password hashing (primary)
  - ADMIN_USERS_JSON environment variable (fallback for bootstrap/recovery)
  - Azure AD integration (optional, future enhancement)
- **Rate Limiting**:
  - Max 5 login attempts per 5 minutes (client-side)
  - Prevents brute force attacks
  - User-friendly lockout duration
- **Authorization**: Role-based access control (RBAC)
- **Session Management**:
  - JWT tokens with expiration
  - Secure, httpOnly cookies
  - Session stored in sessionStorage (not localStorage)
  - Auto-redirect to login on token expiry — `apiRequest` detects 401 expired-token responses, clears session, and redirects to login page
- **HTTPS Only**: Force SSL/TLS
- **Audit Logging**: Track all admin actions

#### Azure SQL Security
- **Connection Security**: Use encrypted connections
- **Firewall Rules**: Restrict to Azure services and admin IPs
- **Managed Identity**: Use Azure Managed Identity for API-to-DB auth
- **Backup & Recovery**: Automated backups enabled
- **SQL Injection Prevention**: Use parameterized queries only

### Deployment Architecture

#### Current Deployment (Production)

**Architecture:** Azure Static Web App + Separate Azure Functions App

```
┌──────────────────────────────────┐
│ Azure Static Web App             │
│ (Frontend Hosting)               │
│ - Name: cat-bootcamp-feedback    │
│ - URL: blue-moss-01913f80f       │
│   .1.azurestaticapps.net         │
│ - Auto-deploy from GitHub        │
└──────────────────────────────────┘
            │
            │ HTTPS + CORS
            ↓
┌──────────────────────────────────┐
│ Azure Functions App              │
│ (Separate Backend)               │
│ - Name: cat-bootcamp-api         │
│ - URL: cat-bootcamp-api          │
│   .azurewebsites.net             │
│ - Runtime: Node.js 20 (Linux)    │
│ - Plan: Consumption (Serverless) │
│ - Deploy: func CLI or GitHub     │
└──────────────────────────────────┘
            │
            ↓
┌──────────────────────────────────┐
│ Azure SQL Database               │
│ - Server: cat-bootcamp-sql-89082 │
│ - Database: CATBootcampFeedback  │
│ - Schema: V2 (Many-to-Many)      │
└──────────────────────────────────┘
```

**Why Separate Functions App?**

Azure Static Web Apps' managed functions have **limited support for custom routes** with path parameters. Endpoints like `/api/events/{code}/modules/{id}` don't work reliably with managed functions. A separate Functions app provides:
- Full custom routing support
- More control over runtime configuration
- Better scalability and monitoring
- Independent deployment lifecycle

**Alternative Architectures (Not Implemented):**

#### Option 2: Container-based
```
- Frontend + Backend: Docker containers
- Hosting: Azure Container Apps
- Database: Azure SQL Database
- Pros: Full control, easier local development
- Cons: More complex, higher cost
```

#### Option 3: Single Azure App Service
```
- Frontend + Backend: Combined in one App Service
- Database: Azure SQL Database
- Pros: Simpler infrastructure
- Cons: Less scalable, always-on costs
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
- [ ] **URL Parameter Flow (Primary)**:
  - [ ] Form loads with event code AND module ID from URL parameters
  - [ ] Module information auto-populated from URL parameters (module name, speaker, date)
  - [ ] Event code and module ID not visible as form fields (transparently passed)
  - [ ] No selection dropdowns shown when parameters are present
  - [ ] Invalid event code or module ID shows user-friendly error
- [ ] **Fallback Selection Flow (When Parameters Missing)**:
  - [ ] If no `code` parameter: Show event selector with active events
  - [ ] Event selector displays user-friendly names and dates (not technical codes)
  - [ ] If `code` present but no `module`: Show module selector for that event
  - [ ] Module selector displays module names, speakers, delivery dates
  - [ ] After selection, URL updates to include parameters
  - [ ] Form proceeds with selected event/module information populated
- [ ] **General Form Behavior**:
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
- [x] **Bulk Delete Events**: Select multiple events and delete them at once
  - [x] Checkboxes for selecting individual events
  - [x] "Select All" checkbox for selecting all visible events
  - [x] "Delete Selected" button appears when events are selected
  - [x] Confirmation dialog shows count and warns about cascade deletion
  - [x] All associated feedback deleted automatically (cascade)
- [x] **Bulk Delete Modules**: Select multiple modules and delete them at once
  - [x] Checkboxes for selecting individual modules
  - [x] "Select All" checkbox for selecting all visible modules
  - [x] "Delete Selected" button appears when modules are selected
  - [x] Confirmation dialog shows count and warns about dependencies
  - [x] Prevents deletion of modules used in active events
- [x] **Bulk Delete Feedback**: Select multiple feedback submissions and delete them at once
  - [x] Checkboxes for selecting individual feedback entries
  - [x] "Select All" checkbox for selecting all visible feedback
  - [x] "Delete Selected" button appears when feedback is selected
  - [x] Confirmation dialog shows count and warns about permanent deletion
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
- [ ] **URL Parameter Flow (Primary)**:
  - [x] Display live feedback count when URL parameters provided
  - [x] Event-level: `code` parameter shows total count for all modules
  - [ ] Module-level: `code` and `module` parameters show count for specific module
  - [x] Auto-refresh count every 5 seconds
  - [x] Display event/module information (name, date, speaker)
  - [x] Generate and display QR code with URL parameters included
- [ ] **Fallback Selection Flow (When Parameters Missing)**:
  - [ ] If no `code` parameter: Show event selector interface
  - [ ] Display list of active events for selection
  - [ ] After event selection, show option for event-level or module-level view
  - [ ] If module-level selected, show module selector
  - [ ] Update URL with selected parameters after selection
  - [ ] Hide selection interface after setup for clean presentation view
- [x] **Theme System**:
  - [x] Classic theme with progress ring (default)
  - [x] Feed the Cat theme with 6-stage cat progression
  - [x] Theme selector in footer
  - [x] Theme-specific encouraging messages
  - [x] Theme persistence via sessionStorage
  - [x] Cat theme: food drop animation, "nom nom" sound, progress bar, milestone bounce
  - [x] Cat images scale responsively via flex layout
- [ ] **General Display Behavior**:
  - [x] Handle zero feedback gracefully (display 0)
  - [x] Fullscreen mode toggle for presentations
  - [x] Celebration visuals (confetti, glow, sound banner) render inside fullscreen container
  - [x] Last updated timestamp display
  - [x] Animated count transitions when numbers change
  - [ ] Responsive design for various screen sizes

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
- SMS notifications
- Integration with Teams/Slack
- Automated reports sent to speakers
- Comparison reports across cohorts
- Sentiment analysis on comments
- Mobile app version
- Historical trend analysis and time-series charts
- Speaker performance comparison dashboards

## Implementation Notes

### URL Parameter Handling and Fallback Flows

The application implements a transparent URL parameter system with intelligent fallback behavior.

#### Primary Flow: Transparent URL Parameters
When users access feedback or count pages via QR codes or shared links, parameters are transparently passed through the URL:
- **Feedback Form**: `feedback.html?code=CSA1B2C3&module=5`
- **Count Display**: `count.html?code=CSA1B2C3&module=5` or `count.html?code=CSA1B2C3`

**User Experience:**
- Users never see or interact with technical identifiers (event codes, module IDs)
- Information is automatically loaded and displayed in user-friendly format
- Module name, speaker, date, and event details are shown clearly
- Users proceed directly to providing feedback or viewing live analytics
- No selection screens or dropdowns required

#### Fallback Flow: Manual Selection
When users access pages without URL parameters (bookmarked base URL, direct navigation, etc.):

**Feedback Form Fallback:**
1. **No `code` parameter**: Display event selector
   - Show active events with readable names, dates, descriptions
   - User selects event from dropdown or list interface
   - Fetch modules for selected event
2. **`code` present, no `module`**: Display module selector
   - Show modules for the event with names, speakers, delivery dates
   - User selects specific module to provide feedback for
3. **After selection**:
   - URL updates to include parameters: `?code=CSA1B2C3&module=5`
   - Form proceeds with selected information pre-populated
   - URL can be bookmarked or shared for future direct access

**Count Display Fallback:**
1. **No `code` parameter**: Display event selector
   - Show active events with names and dates
   - User selects event
   - Option to view event-level (all modules) or select specific module
2. **`code` present, no `module`**: Default to event-level view
   - Display total count for all modules in event
   - Provide option to switch to module-specific view
   - Show module selector if user requests module-level view
3. **After selection**:
   - URL updates with parameters
   - Selection interface can be hidden for clean presentation view
   - Counts refresh automatically every 5 seconds

#### Implementation Considerations
- **API Requirements**: Need endpoints to list active events and modules
  - `GET /api/events` - List all active events
  - `GET /api/events/{eventCode}/modules` - List modules for an event (already exists)
- **User-Friendly Display**: Show business-readable information, not technical IDs
  - Event names, not event codes
  - Module names with speakers, not module IDs
- **URL Updates**: Use `history.pushState()` to update URL without page reload
- **Session Persistence**: Consider storing last selection in sessionStorage
- **Error Handling**: Gracefully handle cases where no events or modules exist
- **Accessibility**: Ensure selection interfaces are keyboard navigable and screen reader friendly

### Delete Functionality

The application supports both single and bulk deletion for feedback, events, and modules with comprehensive safeguards:

#### Bulk Delete Features
- **Selection System**: Checkboxes next to each item allow individual selection
- **Select All**: Master checkbox to select/deselect all visible items at once
- **Delete Button**: "Delete Selected" button appears only when items are selected
- **Count Indicator**: Shows how many items are currently selected (e.g., "3 selected")
- **Confirmation Dialog**: Multi-line confirmation showing item count and warning about permanent deletion
- **UI Feedback**: Buttons styled with danger color (red) and hover effects
- **No Undo**: Clearly communicates that deletion is permanent and cannot be undone

#### Delete Events (Single or Bulk)
- **Cascade Delete**: Automatically removes all associated feedback when event(s) deleted
- **Feedback Count**: Shows user how many feedback entries will be deleted
- **Associated Data**: Shows count of affected modules and feedback submissions

Example confirmation message:
```
⚠️ DELETE 3 EVENTS?

You are about to delete 3 events and ALL associated data:
- Event modules: 12 total
- Feedback submissions: 45 total

This will permanently delete these events and ALL associated feedback.

This action CANNOT be undone!

Are you sure you want to continue?
```

#### Delete Modules (Single or Bulk)
- **Dependency Check**: Prevents deletion of modules used in active events
- **Warning Message**: Shows which events are using the module if deletion fails
- **Safe Deletion**: Only allows deletion of unused modules or modules in inactive events

Example confirmation message:
```
⚠️ DELETE 2 MODULES?

You are about to delete 2 modules:
- Introduction to Copilot Studio
- Advanced Best Practices

Note: Modules used in active events cannot be deleted.

This action CANNOT be undone!

Are you sure you want to continue?
```

#### Delete Feedback (Single or Bulk)
- **No Cascade**: Only deletes feedback entries, does not affect events or modules
- **Permanent Removal**: Removes feedback records from database
- **Count Indicator**: Shows how many feedback entries will be deleted

Example confirmation message:
```
⚠️ DELETE 15 FEEDBACK SUBMISSIONS?

You are about to permanently delete 15 feedback submissions.

This action CANNOT be undone!

Are you sure you want to continue?
```

#### Implementation Details
- **API Endpoints**: Separate endpoints for single and bulk delete operations
- **Transaction Safety**: All bulk deletes wrapped in database transactions
- **Error Handling**: If any deletion fails, entire operation rolls back
- **Success Messages**: Toast notifications showing count of deleted items
- **Immediate UI Update**: Deleted items removed from display without page reload

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
