# Modules vs Events - Clear Separation Guide

## 📚 Architecture Overview

The CAT Bootcamp Feedback system now has a **truly separated** Modules and Events architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    MODULES (Content)                        │
│  Timeless training content - reusable across events        │
├─────────────────────────────────────────────────────────────┤
│ • Module Name: "Introduction to Copilot Studio"            │
│ • Speaker: "John Doe"                                       │
│ • Description: "Getting started with basics"               │
│ • IsActive: Yes/No                                          │
│ • NO DATES - content is timeless                           │
└─────────────────────────────────────────────────────────────┘
                              ▼
                       (One module can have
                        multiple events)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              EVENTS (Delivery Instances)                    │
│  Specific deliveries of modules with dates                 │
├─────────────────────────────────────────────────────────────┤
│ Event 1:                                                    │
│ • Links to: Module "Introduction to Copilot Studio"        │
│ • Event Code: CSA1B2C3                                      │
│ • Start Date: 2026-02-15 09:00                             │
│ • End Date: 2026-02-15 17:00                               │
│ • Cohort: Q1-2026                                           │
│                                                             │
│ Event 2:                                                    │
│ • Links to: SAME Module "Introduction to Copilot Studio"   │
│ • Event Code: CSA2B2C3                                      │
│ • Start Date: 2026-03-20 09:00                             │
│ • End Date: 2026-03-20 17:00                               │
│ • Cohort: Q2-2026                                           │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 FEEDBACK (Submissions)                      │
│  Linked to specific events                                  │
├─────────────────────────────────────────────────────────────┤
│ • Links to: Event CSA1B2C3                                  │
│ • Ratings: Speaker Knowledge, Content Depth, Satisfaction  │
│ • Comments                                                   │
│ • Shows: Module name + Event date through the relationship │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Admin Panel - How Separation Works

### **Modules Tab** (First Tab)
- **Purpose**: Manage training content (modules)
- **What you create**: Reusable training modules
- **Fields**:
  - ✅ Module Name
  - ✅ Speaker Name
  - ✅ Description
  - ✅ Active/Inactive
  - ❌ NO dates
  - ❌ NO event codes

**Actions**:
- ➕ **Create New Module** - Add new training content
- ✏️ **Edit Module** - Update module details
- ➕ **Create Event** button - Quick create event for this module
- 🚫 **Deactivate** - Hide module from selection

### **Events Tab** (Second Tab)
- **Purpose**: Schedule deliveries of modules
- **What you create**: Delivery instances with dates
- **Fields**:
  - ✅ **Select Module** (dropdown) - Choose which module this event delivers
  - ✅ Event Code (admin-provided)
  - ✅ Start Date & Time
  - ✅ End Date & Time
  - ✅ Cohort ID
  - ❌ NO module name field (selected from dropdown)
  - ❌ NO speaker field (comes from module)

**Display shows**:
- Module Name (from linked module)
- Speaker Name (from linked module)
- Event Code
- Start/End Dates
- Cohort
- Feedback Count

## 📊 Database Schema (Separated)

### Modules Table
```sql
Modules
├── ModuleId (PK)
├── ModuleName
├── SpeakerName
├── Description
├── IsActive
├── CreatedAt
└── CreatedBy
```

### Events Table
```sql
Events
├── EventId (PK)
├── EventCode (UNIQUE)
├── ModuleId (FK → Modules)  ← Links to module
├── StartDate
├── EndDate
├── CohortId
├── IsActive
└── CreatedAt
```

### Feedback Table
```sql
Feedback
├── FeedbackId (PK)
├── EventId (FK → Events)  ← Links to event
├── EventCode
├── SpeakerKnowledge
├── ContentDepth
├── ModuleSatisfaction
├── AdditionalComments
└── SubmittedAt
```

## 🔄 Workflow Examples

### Scenario 1: Single Module, Multiple Events
1. **Admin creates module**: "Introduction to Copilot Studio" (John Doe)
2. **Admin creates Event 1**: Code: CSA1B2C3, Date: Feb 15, Cohort: Q1-2026
3. **Admin creates Event 2**: Code: CSA2B2C3, Date: Mar 20, Cohort: Q2-2026
4. **Result**: Same content delivered twice at different times

### Scenario 2: Multiple Modules, Single Cohort
1. **Admin creates modules**:
   - Module A: "Intro to Copilot"
   - Module B: "Advanced Copilot"
   - Module C: "Copilot Best Practices"
2. **Admin creates events for Q1-2026**:
   - Event 1: Module A, Feb 15
   - Event 2: Module B, Feb 16
   - Event 3: Module C, Feb 17
3. **Result**: Three different modules for same cohort

## ✅ How to Verify Separation

### In Admin Panel:

**Modules Tab Should Show**:
- List of training content only
- No dates visible
- No event codes
- Event count per module
- "Create Event" button for each module

**Events Tab Should Show**:
- Module selection dropdown (not text fields)
- Event-specific fields only (code, dates, cohort)
- Display shows module name but it's from the relationship
- Each event linked to a module

**Create Event Form Should Have**:
- ✅ Dropdown to select module
- ✅ Event code input
- ✅ Start/End date inputs
- ✅ Cohort input
- ❌ NO module name input field
- ❌ NO speaker name input field
- ❌ NO description input field

## 🔍 Testing the Separation

1. **Open Admin Panel**: `https://blue-sea-0b9be530f.1.azurestaticapps.net/admin.html`
2. **Go to Modules Tab**: Should see 3 modules
3. **Click "Create New Module"**: Form should have module-specific fields only
4. **Go to Events Tab**: Should see 3 events
5. **Click "Create New Event"**: Form should have **dropdown to select module**
6. **Verify**: Event form does NOT have module name/speaker fields

## 🎨 Visual Difference

### ❌ OLD WAY (Not Separated):
```
Create Event Form:
- Module Name: [ text input ]
- Speaker Name: [ text input ]
- Event Code: [ text input ]
- Date: [ date input ]
```

### ✅ NEW WAY (Separated):
```
Modules Tab → Create Module Form:
- Module Name: [ text input ]
- Speaker Name: [ text input ]
- Description: [ textarea ]

Events Tab → Create Event Form:
- Module: [ dropdown: Introduction to Copilot | Building Copilot | ... ]
- Event Code: [ text input ]
- Start Date: [ datetime input ]
- End Date: [ datetime input ]
- Cohort: [ text input ]
```

## 📈 Benefits of Separation

1. **Reusability**: Create module once, schedule many events
2. **Consistency**: Module details (name, speaker) stay consistent across events
3. **Flexibility**: Same module for different dates/cohorts
4. **Maintenance**: Update module details in one place
5. **Reporting**: Track feedback by module (aggregated) or by event (specific)
6. **Scalability**: Easy to add new events without duplicating module info

## 🚀 Next Steps

1. **Test locally**: Open admin.html in browser
2. **Verify tabs**: Check Modules and Events tabs load correctly
3. **Test creation**: Create a module, then create event for that module
4. **Check dropdown**: Event form should show module dropdown
5. **Deploy**: Push changes to Azure Static Web Apps

---

**Key Point**: Events now **reference** modules instead of **containing** module data. This is true separation!
