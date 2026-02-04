# Refactoring Plan: Separate Modules and Events

**Date:** 2026-02-04
**Goal:** Implement proper separation between Modules (training content) and Events (feedback collection instances)

---

## 🎯 Architecture Overview

### Current (Incorrect)
- **Events table**: Contains both module info AND event code
- Confusion between content and feedback collection mechanism

### New (Correct)
- **Modules table**: Training content (name, date, speaker, cohort)
- **Events table**: Feedback collection instances (event code, module reference)
- **Feedback table**: References events, which reference modules

---

## 📊 Data Model Changes

### 1. Modules Table (NEW)
```sql
Modules
├── ModuleId (PK)
├── ModuleName
├── ModuleDate
├── SpeakerName
├── CohortId
├── Description
├── IsActive
├── CreatedAt
├── CreatedBy
├── UpdatedAt
└── UpdatedBy
```

### 2. Events Table (REFACTORED)
```sql
Events
├── EventId (PK)
├── EventCode (UNIQUE, admin-provided)
├── ModuleId (FK → Modules)
├── IsActive
├── CreatedAt
└── CreatedBy
```

### 3. Feedback Table (UPDATED)
```sql
Feedback
├── FeedbackId (PK)
├── EventId (FK → Events)
├── EventCode (captured from URL)
├── [ratings and comments...]
└── SubmittedAt
```

**Relationships:**
- Module 1:N Events (one module can have multiple events)
- Event 1:N Feedback (one event has many feedback submissions)
- Feedback → Event → Module

---

## 🔧 API Endpoints to Create/Update

### Module Endpoints
```
GET    /api/modules              - List all modules
GET    /api/modules/:id          - Get module by ID
POST   /api/modules              - Create new module
PUT    /api/modules/:id          - Update module
DELETE /api/modules/:id          - Delete module
```

### Event Endpoints
```
GET    /api/events               - List all events with module details
GET    /api/events/:eventCode    - Get event by code (for feedback form)
GET    /api/events/module/:moduleId - Get events for a module
POST   /api/events               - Create event for a module
PUT    /api/events/:id           - Update event
DELETE /api/events/:id           - Delete event
```

### Combined Endpoints (Convenience)
```
POST   /api/modules-with-event   - Create module + event in one call
GET    /api/events/:code/module  - Get event with full module details
GET    /api/modules/:id/feedback - Get all feedback for a module (via its events)
```

### Feedback Endpoints (UPDATED)
```
GET    /api/feedback             - List all feedback
GET    /api/feedback/event/:eventCode - Get feedback for an event
POST   /api/feedback             - Submit feedback (references EventId)
```

---

## 📝 Frontend Changes

### 1. Admin Interface

**Current:**
- Single "Create Event" form with all fields

**New:**
- **Tab 1: Modules** - Manage training content
  - List modules
  - Create/edit module (name, date, speaker, cohort)
  - View module details
  - See events for each module

- **Tab 2: Events** - Manage feedback collection
  - List events with module names
  - Create event: Select module + provide event code
  - View event details and QR code
  - See feedback count per event

**Combined Workflow:**
- Quick create: "Create Module + Event" button
  - Modal with module fields + event code field
  - Creates both in one transaction

### 2. Feedback Form

**Changes:**
- No changes to user-facing form
- Backend: Looks up Event by code → Gets Module details
- Displays module info (name, date, speaker)
- Submits feedback with EventId + EventCode

### 3. Count Display

**Changes:**
- Still accessed via: `count.html?code=CSA1B2C3`
- Backend: Gets Event → Module → Feedback count
- Displays module name and feedback count

---

## 🗂️ File Changes Required

### Database
- ✅ `DATABASE_REFACTOR.sql` - New schema (created)
- `load-sample-data.sql` - Update with new structure

### API Functions
- `api/GetEvent/index.js` - Get event by code with module details
- `api/GetAllEvents/index.js` - Get all events with modules
- `api/SubmitFeedback/index.js` - Update to reference EventId properly
- **NEW:** `api/GetModules/` - List modules
- **NEW:** `api/CreateModule/` - Create module
- **NEW:** `api/CreateEvent/` - Create event for module
- **NEW:** `api/CreateModuleWithEvent/` - Combined endpoint

### Frontend
- `admin.html` - Add Modules tab, update Events UI
- `admin.js` - Separate module and event management
- `feedback.js` - No major changes (already uses event code)
- `count.js` - No major changes

### Configuration
- `config.js` - No changes needed

### Documentation
- ✅ `SPECIFICATION.md` - Already updated
- `ADMIN_SETUP_GUIDE.md` - Update with new workflow
- `README.md` - Update architecture description

---

## 🚀 Implementation Steps

### Phase 1: Database (Do First)
1. ✅ Create `DATABASE_REFACTOR.sql` with new schema
2. Review and test locally
3. Create migration script if needed
4. Deploy to Azure SQL Database
5. Verify with sample data

### Phase 2: API Backend
1. Create Module endpoints
   - GetModules
   - CreateModule
   - UpdateModule
   - DeleteModule

2. Update Event endpoints
   - Modify GetEvent to join with Modules
   - Update to expect ModuleId instead of module fields
   - Add CreateEvent endpoint

3. Create combined endpoint
   - CreateModuleWithEvent (convenience)

4. Update Feedback endpoints
   - Ensure EventId is used correctly
   - Join to Events → Modules for details

### Phase 3: Frontend
1. Update admin.html
   - Add Modules management tab
   - Update Events tab to show module selection
   - Create module + event form

2. Update admin.js
   - Add module management functions
   - Update event creation to select module
   - Update event display to show module names

3. Test feedback form
   - Verify it still works with new backend

4. Test count display
   - Verify it shows module info correctly

### Phase 4: Testing & Deployment
1. Test all workflows
   - Create module
   - Create event for module
   - Submit feedback via event
   - View feedback in admin
   - Generate QR codes

2. Update documentation
3. Deploy to production
4. Verify live

---

## 📋 Admin User Workflows

### Create Module + Event (Combined)
1. Admin clicks "Create Module + Event"
2. Form shows:
   - Module Name*
   - Module Date*
   - Speaker Name*
   - Cohort ID
   - Description
   - Event Code* (for feedback collection)
3. Click "Create"
4. System creates Module → Creates Event → Generates QR code
5. Shows success with feedback URL

### Create Additional Event for Existing Module
1. Admin goes to Modules tab
2. Clicks "Add Event" on a module
3. Enter Event Code
4. System creates event linked to module
5. Generate new QR code for this event

### View Feedback
1. Admin goes to Events tab
2. Sees list of events with module names
3. Clicks "View Feedback" on an event
4. Sees all feedback for that event
5. Can filter/export

---

## ✅ Benefits of This Architecture

1. **Clarity**: Clear separation of concerns
2. **Flexibility**: Multiple events per module (different cohorts, retries)
3. **Data Integrity**: Proper foreign key relationships
4. **Reusability**: Same module content, different feedback collection instances
5. **Reporting**: Easy to aggregate feedback across events for a module

---

## 🔍 Example Scenario

**Module:** "Introduction to Copilot Studio"
- ModuleId: 1
- Speaker: John Doe
- Date: 2026-02-15

**Events for this module:**
- Event 1: Code CSA1B2C3 (Q1-2026 cohort)
- Event 2: Code CSA1B2C4 (Q2-2026 cohort, same content)

**Feedback:**
- 50 feedback submissions for Event 1 (CSA1B2C3)
- 45 feedback submissions for Event 2 (CSA1B2C4)
- **Total: 95 feedback submissions for the module**

**Reporting:**
- View feedback by event (specific cohort)
- View aggregate feedback by module (all cohorts)

---

## 📌 Next Actions

1. **Review `DATABASE_REFACTOR.sql`** - Ensure schema is correct
2. **Create API endpoints** for modules and events
3. **Update admin interface** with Modules and Events tabs
4. **Test thoroughly** before deployment
5. **Deploy database changes** to Azure
6. **Deploy code changes** to production

---

**Status:** 📝 Planning Complete
**Next:** 🔨 Begin Implementation

