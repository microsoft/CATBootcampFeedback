# CAT Bootcamp Feedback Application

A comprehensive web-based feedback collection system for CAT Bootcamp modules with admin management, QR code generation, and live feedback counting.

## Overview

This application provides a complete solution for collecting and managing feedback on training modules. It consists of three main components:

1. **Public Feedback Form** - URL-based feedback collection (no authentication required)
2. **Admin Interface** - Manage events, view feedback, generate QR codes, and access analytics
3. **Live Count Display** - Real-time feedback submission count for presenters

## System Architecture

```
┌─────────────────────┐
│  Feedback Form      │  feedback.html?code=ABC123
│  (Public Access)    │  Collects participant feedback
└─────────────────────┘
           │
           ↓
┌─────────────────────┐
│    REST API         │  Handles data operations
│  (Azure Backend)    │  Validates and stores feedback
└─────────────────────┘
           │
           ↓
┌─────────────────────┐
│   Azure SQL         │  Persistent data storage
│   Database          │  Events & Feedback tables
└─────────────────────┘
           ↑
           │
┌─────────────────────┐      ┌─────────────────────┐
│  Admin Interface    │      │  Live Count Display │
│  (Authenticated)    │      │  (Public Access)    │
└─────────────────────┘      └─────────────────────┘
```

## Files Included

### Frontend Files
- **feedback.html** - Public feedback form
- **feedback.js** - Feedback form logic and URL parameter handling
- **admin.html** - Admin interface
- **admin.js** - Admin functionality (events, QR codes, analytics)
- **admin.css** - Admin interface styling
- **count.html** - Live feedback count display
- **count.js** - Count display logic with auto-refresh
- **styles.css** - Shared styling for all pages

### Documentation
- **SPECIFICATION.md** - Complete technical specification with Azure SQL schema
- **README.md** - This file

## Features

### Public Feedback Form (feedback.html)

#### Access Method
- Each event has a unique URL: `feedback.html?code=EVENT_CODE`
- Event code passed as URL parameter (hidden from user)
- Module information auto-loaded from event code

#### Collected Data
- ✅ **Speaker Knowledge** (1-5 scale, 5 = Excellent) - Required
- ✅ **Content Depth** (Too Technical / Just Right / Too Low Level) - Required
- ✅ **Module Satisfaction** (1-5 scale, 5 = Very Satisfactory) - Required
- ✅ **Additional Comments** (up to 1000 characters) - Optional

#### User Experience
- URL parameter validation and error handling
- Loading state while fetching event details
- Real-time form validation
- Visual feedback for selected ratings
- Character counter for comments
- Success confirmation after submission
- Fully responsive design
- No authentication required

### Admin Interface (admin.html)

#### Authentication
- Username/password login required
- Demo credentials: `admin` / `CATBootcamp2026!`
- Session management with local storage

#### Event Management
- Create new events with auto-generated codes
- Edit existing events
- Activate/deactivate events
- View event details
- Search and filter events
- Event code format: CS + 6 random characters (e.g., CSA1B2C3)

#### QR Code Generation
- Automatic QR code generation for each event
- Downloadable as PNG image
- Includes full feedback URL
- Optimized for mobile scanning

#### Feedback Viewing
- View all feedback submissions
- Filter by event or rating
- See detailed responses with comments
- Export all feedback to CSV

#### Analytics Dashboard
- Total events count
- Total feedback submissions
- Average satisfaction rating
- Average speaker knowledge rating
- Content depth distribution chart

### Live Count Display (count.html)

#### Features
- Shows real-time count of feedback submissions
- Auto-refreshes every 5 seconds
- Displays module name and QR code
- Fullscreen mode for projection
- Animated count updates
- Status indicator for live updates

#### Usage
- Access from admin panel or directly via URL
- URL format: `count.html?code=EVENT_CODE`
- Perfect for displaying during presentations
- No authentication required

## Getting Started

### Quick Start (Demo Mode)

1. **View Feedback Form**
   ```
   Open: feedback.html?code=CSA1B2C3
   ```
   - Test with codes: `CSA1B2C3` or `TEST123`
   - Submit feedback (stored in browser localStorage)

2. **Access Admin Panel**
   ```
   Open: admin.html
   Login: admin / CATBootcamp2026!
   ```
   - Create/manage events
   - View submitted feedback
   - Generate QR codes
   - View analytics

3. **View Live Count**
   ```
   Open: count.html?code=CSA1B2C3
   ```
   - See real-time feedback count
   - Display during presentations

### Running with Local Web Server

For full functionality, serve files through a web server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Then access:
http://localhost:8000/admin.html
```

## Configuration

### Mock Data vs Real API

All JavaScript files have configuration at the top:

```javascript
const API_BASE_URL = '/api';
const USE_MOCK_DATA = true; // Set to false for production
```

**Mock Mode** (USE_MOCK_DATA = true):
- Works without backend
- Data stored in localStorage
- Perfect for testing and demos
- Includes sample events

**Production Mode** (USE_MOCK_DATA = false):
- Connects to real REST API
- Data saved to Azure SQL
- Requires backend setup

### Switching to Production

1. **Set up Azure SQL Database**
   - See SPECIFICATION.md for schema
   - Create tables: Events, Feedback, AdminUsers

2. **Deploy Backend API**
   - Implement REST endpoints (see SPECIFICATION.md)
   - Deploy to Azure App Service or Functions
   - Configure database connection

3. **Update Configuration**
   ```javascript
   const API_BASE_URL = 'https://your-api.azurewebsites.net/api';
   const USE_MOCK_DATA = false;
   ```

4. **Update Feedback Base URL**
   ```javascript
   const FEEDBACK_BASE_URL = 'https://your-domain.com/feedback.html';
   ```

## Typical Workflow

### For Admins

1. **Before Bootcamp**
   - Log into admin panel
   - Create events for all modules
   - Download/print QR codes
   - Test feedback URLs

2. **During Each Module**
   - Share feedback URL or QR code with attendees
   - Open count display on second screen
   - Monitor live feedback submissions

3. **After Bootcamp**
   - Review all feedback
   - Export data to CSV
   - Analyze results in analytics tab
   - Share reports with speakers

### For Attendees

1. Scan QR code or click feedback link
2. Verify module information is correct
3. Answer three required questions
4. Optionally add comments
5. Submit feedback
6. See confirmation message

### For Presenters

1. Display count page during presentation
2. Use fullscreen mode for better visibility
3. Watch live feedback count increase
4. Share feedback URL or show QR code

## API Endpoints

See SPECIFICATION.md for complete API documentation.

### Public Endpoints (No Auth)
```
GET  /api/events/{eventCode}       - Get event details
POST /api/feedback                 - Submit feedback
GET  /api/events/{eventCode}/count - Get feedback count
```

### Admin Endpoints (Auth Required)
```
POST   /api/admin/auth/login        - Admin login
GET    /api/admin/events            - List all events
POST   /api/admin/events            - Create event
PUT    /api/admin/events/{id}       - Update event
GET    /api/admin/feedback          - Get all feedback
GET    /api/admin/analytics         - Get statistics
```

## Database Schema

### Events Table
```sql
CREATE TABLE Events (
    EventId INT IDENTITY PRIMARY KEY,
    EventCode NVARCHAR(20) UNIQUE NOT NULL,
    ModuleName NVARCHAR(200) NOT NULL,
    ModuleDate DATE NOT NULL,
    SpeakerName NVARCHAR(100) NOT NULL,
    CohortId NVARCHAR(50) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE()
);
```

### Feedback Table
```sql
CREATE TABLE Feedback (
    FeedbackId INT IDENTITY PRIMARY KEY,
    EventId INT NOT NULL,
    EventCode NVARCHAR(20) NOT NULL,
    SpeakerKnowledge INT NOT NULL,
    ContentDepth NVARCHAR(20) NOT NULL,
    ModuleSatisfaction INT NOT NULL,
    AdditionalComments NVARCHAR(MAX) NULL,
    SubmittedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (EventId) REFERENCES Events(EventId)
);
```

See SPECIFICATION.md for complete schema.

## Development Tools

### Browser Console Commands

**Feedback Form:**
```javascript
viewAllFeedback()     // View all stored feedback
clearAllFeedback()    // Clear localStorage
```

**Admin Panel:**
```javascript
// Console logs show current state
// Mock data automatically generated for testing
```

## Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Modern mobile browsers
- ❌ IE11 (not supported)

## Responsive Design

- **Desktop** (1024px+): Full layout with all features
- **Tablet** (768px-1023px): Optimized touch targets
- **Mobile** (320px-767px): Stacked layout, large buttons

## Security Considerations

### Public Feedback Form
- No authentication required (by design)
- Event code validation prevents unauthorized access
- Input sanitization on all text fields
- Rate limiting recommended (5 submissions per IP/hour)
- No PII collected

### Admin Interface
- Authentication required
- Session tokens with expiration
- HTTPS enforced in production
- CORS configuration required
- Audit logging recommended

### Database
- Parameterized queries prevent SQL injection
- Azure SQL firewall rules
- Encrypted connections
- Regular backups
- Data retention policy

## Deployment Options

### Option 1: Azure Static Web Apps + Functions
```
Frontend: Azure Static Web Apps
Backend: Azure Functions (serverless)
Database: Azure SQL Database
```

### Option 2: Azure App Service
```
Frontend + Backend: Single Azure App Service
Database: Azure SQL Database
```

### Option 3: Container-based
```
Frontend + Backend: Docker containers
Hosting: Azure Container Apps
Database: Azure SQL Database
```

## Customization

### Branding
- Update gradient colors in `styles.css` and `admin.css`
- Change logo/header text in HTML files
- Modify color scheme to match organization

### Event Code Format
- Edit `generateEventCode()` in `admin.js`
- Default: CS + 6 random chars
- Can use sequential, prefixed, or UUID-based codes

### Refresh Interval
- Change `REFRESH_INTERVAL` in `count.js`
- Default: 5000ms (5 seconds)

### Form Fields
- Add/remove questions in HTML
- Update validation in JavaScript
- Modify database schema accordingly

## Troubleshooting

### Feedback Form Won't Load
- Check if event code is in URL
- Verify event exists and is active
- Check browser console for errors
- Try with test code: CSA1B2C3

### Admin Login Fails
- Use demo credentials: admin/CATBootcamp2026!
- Clear browser cache and localStorage
- Check browser console for errors

### Count Not Updating
- Verify event code is correct
- Check if feedback is being submitted
- Look at browser console for errors
- Ensure mock data mode matches feedback form

### QR Code Not Generating
- Check if QRCode.js library loaded
- Verify internet connection (CDN)
- Check browser console for errors

## Future Enhancements

- [ ] Email notifications for new feedback
- [ ] Multi-language support
- [ ] Anonymous vs identified submissions toggle
- [ ] Custom questions per event
- [ ] Sentiment analysis on comments
- [ ] Integration with Teams/Slack
- [ ] Mobile app version
- [ ] Automated reports
- [ ] Comparison across cohorts
- [ ] Real-time dashboard with WebSockets

## Support

For questions or issues:
1. Check SPECIFICATION.md for technical details
2. Review browser console for error messages
3. Verify configuration settings
4. Test with mock data first

## License

This is a demonstration project for the CAT Bootcamp.

---

**Version:** 2.0
**Last Updated:** 2026-02-03
**Author:** Claude Code Assistant
