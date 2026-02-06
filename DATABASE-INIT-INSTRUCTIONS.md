# Database Initialization Instructions

The SQL script has been split into 6 parts to work with Azure Portal Query Editor.

## Run These Files in Order:

### Part 1: Tables and Indexes (REQUIRED)
**File:** `database-init-part1-tables.sql`

Creates:
- Events table
- Modules table
- EventModules junction table
- Feedback table
- All indexes and foreign keys

**Run this first!**

---

### Part 2: View 1 (REQUIRED)
**File:** `database-init-part2-views.sql`

Creates:
- `vw_EventsWithModules` - Shows events with all their modules

---

### Part 3: View 2 (REQUIRED)
**File:** `database-init-part3-views2.sql`

Creates:
- `vw_FeedbackWithDetails` - Shows feedback with event and module details

---

### Part 4: View 3 (REQUIRED)
**File:** `database-init-part4-views3.sql`

Creates:
- `vw_EventFeedbackCounts` - Shows aggregated feedback counts per event

---

### Part 5: Stored Procedure 1 (REQUIRED)
**File:** `database-init-part5-sp1.sql`

Creates:
- `sp_GetEventByCode` - Retrieves event and its modules by event code

---

### Part 6: Stored Procedure 2 (REQUIRED)
**File:** `database-init-part6-sp2.sql`

Creates:
- `sp_GetFeedbackCountByEventCode` - Gets feedback statistics for an event

---

## How to Run in Azure Portal:

1. **Open Azure Portal Query Editor**
   - Go to https://portal.azure.com
   - Navigate to **CATBootcampFeedback-Prod** database
   - Click **"Query editor (preview)"** in left menu
   - Login with: **sqladmin** / **%jQdtCK#Q8Zk8oKT**

2. **Run Each File in Order**
   - Open **database-init-part1-tables.sql** in a text editor
   - Copy entire contents
   - Paste into Query Editor
   - Click **"Run"** button
   - Wait for "Query succeeded" message
   - **Clear the query window**
   - Repeat for parts 2-6 in order

3. **Verify Success**
   After running all 6 parts, run this query to verify:
   ```sql
   SELECT 'Tables' AS Type, COUNT(*) AS Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
   UNION ALL
   SELECT 'Views', COUNT(*) FROM INFORMATION_SCHEMA.VIEWS
   UNION ALL
   SELECT 'Stored Procedures', COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE';
   ```

   Expected results:
   - Tables: 4
   - Views: 3
   - Stored Procedures: 2

## Why Split into Parts?

Azure Portal Query Editor doesn't support `GO` batch separators. Running the original file causes the error:
```
'CREATE/ALTER PROCEDURE' must be the first statement in a query batch.
```

By splitting into separate files, each CREATE statement is the first (and only) statement in its batch.

## Troubleshooting

**Error: "There is already an object named 'X' in the database"**
- You've already run that part successfully
- Skip to the next part

**Error: "Invalid object name 'Events'"**
- You need to run Part 1 (tables) first
- Tables must exist before creating views

**Error: "Could not find stored procedure 'X'"**
- Stored procedures are optional for basic functionality
- The API uses direct queries, not stored procedures

**Connection timeout:**
- Query Editor times out after 5 minutes of inactivity
- Re-login and continue with the next part

## After Completion

Once all 6 parts are complete:
1. The production database is fully initialized
2. The production application will be functional
3. You can test at: https://lively-ocean-076d52c0f.2.azurestaticapps.net
4. API will connect to database successfully
