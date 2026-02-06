# Live Counter Analytics Dashboard - Design Document

**Version:** 3.1
**Created:** February 6, 2026
**Purpose:** Real-time feedback analytics display for presentations

## Overview

The Live Counter page (`count.html`) provides a real-time analytics dashboard for displaying feedback metrics during presentations. Designed for projection on a second screen, it encourages participation and provides instant quality indicators to presenters.

## Design Goals

1. **Real-time visibility** - Show live feedback metrics as submissions come in
2. **Presentation-optimized** - Clean, high-contrast design for projection displays
3. **Actionable insights** - Display meaningful statistics, not just counts
4. **Engagement driver** - Visual feedback encourages more attendee participation
5. **Flexible viewing** - Support both module-specific and event-level analytics

## Display Modes

### Module-Specific Mode
**URL Pattern:** `count.html?code={EVENT_CODE}&module={MODULE_ID}`

**Purpose:** Display analytics for a single module delivery during its presentation

**Data Displayed:**
- Module name and speaker
- Event name and code
- Total feedback submissions for this module
- Average satisfaction rating (1-5 scale)
- Average speaker knowledge rating (1-5 scale)
- Content depth distribution chart
- Last updated timestamp

**Use Case:** Presenter opens this on second screen during their module presentation to see real-time feedback.

### Event-Level Mode
**URL Pattern:** `count.html?code={EVENT_CODE}`

**Purpose:** Display aggregate analytics across all modules in an event

**Data Displayed:**
- Event name and code
- Total feedback submissions across all modules
- Average satisfaction rating across all modules
- Average speaker knowledge rating across all modules
- Content depth distribution chart (aggregate)
- Last updated timestamp

**Use Case:** Event organizers monitor overall feedback quality during multi-day bootcamp.

## Analytics Components

### 1. Total Feedback Count
- **Display:** Large, prominent number at top of screen
- **Animation:** Smooth count-up animation when number changes
- **Purpose:** Primary engagement metric - shows participation level

### 2. Average Satisfaction Rating
- **Scale:** 1-5 stars
- **Display:** Numeric average (e.g., "4.2") with visual star rating
- **Calculation:** Mean of all `moduleSatisfaction` values
- **Color coding:**
  - 4.0-5.0: Green (excellent)
  - 3.0-3.9: Yellow (good)
  - 1.0-2.9: Red (needs attention)

### 3. Average Speaker Knowledge Rating
- **Scale:** 1-5 scale
- **Display:** Numeric average (e.g., "4.5") with visual indicator
- **Calculation:** Mean of all `speakerKnowledge` values
- **Color coding:** Same as satisfaction rating

### 4. Content Depth Breakdown
- **Purpose:** Show if content is hitting the right technical level
- **Display:** Horizontal bar chart with three categories:
  - Too Technical
  - Just Right
  - Too Low Level
- **Format:** Each bar shows count and percentage
- **Example:**
  ```
  Too Technical    ████░░░░░░ 15 (25%)
  Just Right       ██████████ 40 (67%)
  Too Low Level    ██░░░░░░░░  5 (8%)
  ```
- **Calculation:** Count of each `contentDepth` value, percentage of total

### 5. QR Code
- **Purpose:** Allow attendees to quickly scan and submit feedback
- **Display:** Medium-sized QR code in corner of screen
- **URL Encoded:** Full feedback form URL with event code and module ID
- **Position:** Bottom-right corner, doesn't interfere with analytics

### 6. Status Indicators
- **Live Update Indicator:** Pulsing dot showing auto-refresh is active
- **Last Updated Time:** "Last updated at 2:45:30 PM" below main content
- **Connection Status:** Show warning if API calls fail

## Layout Design

```
┌─────────────────────────────────────────────────────────────┐
│  [Event Name - Module Name]                    [Fullscreen] │
│  Speaker: John Doe                                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                    Total Feedback                             │
│                         42                                    │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ Satisfaction │  │   Speaker    │                         │
│  │              │  │   Knowledge  │            ┌────────┐   │
│  │     4.2      │  │     4.5      │            │        │   │
│  │   ★★★★☆     │  │   ★★★★★     │            │ [QR]   │   │
│  └──────────────┘  └──────────────┘            │        │   │
│                                                 │        │   │
│  Content Depth Distribution                    └────────┘   │
│  ┌─────────────────────────────────────────┐                │
│  │ Too Technical    ████░░░░░░  15 (25%)   │                │
│  │ Just Right       ██████████  40 (67%)   │                │
│  │ Too Low Level    ██░░░░░░░░   5 (8%)    │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
│  ● Live   Last updated: 2:45:30 PM                          │
└─────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Data Fetching
- **Endpoint:** `GET /api/events`
- **Client-side filtering:** Filter by event code and module ID
- **Response format:** Extract counts from `feedbackCount` fields
- **Analytics calculation:** Must fetch and analyze actual feedback data

### New API Requirement
To support live analytics, we need actual feedback data, not just counts:

**Option A:** Extend existing endpoint
- `GET /api/events/{code}/feedback` - Return all feedback for event
- Filter client-side for specific module if needed

**Option B:** Create dedicated analytics endpoint
- `GET /api/events/{code}/modules/{id}/analytics` - Return pre-calculated stats
- More efficient, less client-side processing

**Recommendation:** Option A for now (simpler), migrate to Option B if performance becomes an issue

### Auto-Refresh Strategy
- **Interval:** 30 seconds (configurable in `config.js`)
- **Method:** `setInterval()` calling fetch function
- **Animation:** Smooth transitions when numbers change
- **Error handling:** Continue refreshing even if one request fails
- **Optimization:** Only update DOM elements that changed

### Fullscreen Mode
- **Trigger:** Button in top-right corner
- **Implementation:** `requestFullscreen()` API
- **Exit:** ESC key or button toggle
- **Layout:** Optimized for 16:9 presentation displays

## Visual Design Specifications

### Colors
- **Background:** `#1a1a1a` (dark) for better projection
- **Text:** `#ffffff` (white) high contrast
- **Primary accent:** `#4CAF50` (green) for positive metrics
- **Warning accent:** `#FFC107` (amber) for moderate metrics
- **Alert accent:** `#f44336` (red) for low metrics
- **Bars:** `#2196F3` (blue) for chart fills

### Typography
- **Title:** 32px bold, sans-serif
- **Count:** 96px bold (large and prominent)
- **Metrics:** 48px for averages
- **Labels:** 18px regular
- **Timestamp:** 14px regular

### Spacing
- **Padding:** Generous whitespace for readability
- **Cards:** Rounded corners, subtle shadows
- **Margins:** Consistent 24px grid system

## User Interactions

### Opening Live Counter
1. Admin opens admin panel
2. Clicks "Show QR Code" for module
3. Clicks "📊 Live Counter" button
4. New window/tab opens with counter URL
5. Counter auto-loads module data and starts refreshing

### Fullscreen for Presentation
1. Click fullscreen button (or F11)
2. Display enters fullscreen mode
3. Optimized layout for projection
4. Press ESC or click button to exit

### Event Selection (Fallback)
1. If URL has no parameters, show event selector
2. User selects event from dropdown
3. Option to select specific module or view event-level
4. Click "Continue" to load analytics
5. URL updates with parameters

## Performance Considerations

### Caching Strategy
- Cache event/module metadata (doesn't change during presentation)
- Fetch fresh feedback data on each refresh
- Store last known values to show during network issues

### Network Resilience
- Show cached/last-known data if API call fails
- Display warning indicator when offline
- Auto-resume when connection restored
- Timeout after 10 seconds, retry on next interval

### Browser Compatibility
- Modern browsers only (Chrome, Firefox, Safari, Edge)
- No IE11 support
- Mobile responsive (though primarily for desktop projection)

## Accessibility

- High contrast for visibility in bright rooms
- Large text sizes for readability from distance
- Color + text labels (not color-only indicators)
- Keyboard navigation support
- Screen reader friendly (though not primary use case)

## Configuration Options

All configurable via `config.js`:

```javascript
COUNT_REFRESH_INTERVAL: 30000,        // 30 seconds
COUNT_ANIMATION_DURATION: 1000,       // 1 second
SATISFACTION_THRESHOLD_HIGH: 4.0,     // Green zone
SATISFACTION_THRESHOLD_LOW: 3.0,      // Red zone
SHOW_QR_CODE: true,                   // Toggle QR display
FULLSCREEN_BY_DEFAULT: false,         // Auto-enter fullscreen
```

## Testing Scenarios

1. **Module-specific mode**
   - Load with valid event code and module ID
   - Verify module name, speaker, event details display
   - Submit feedback via form, verify count increments
   - Check analytics update within 30 seconds

2. **Event-level mode**
   - Load with valid event code (no module ID)
   - Verify aggregate counts across all modules
   - Submit feedback to multiple modules
   - Verify aggregated analytics update

3. **Auto-refresh**
   - Load counter page
   - Submit new feedback
   - Wait 30 seconds
   - Verify count and analytics update automatically

4. **Network resilience**
   - Load counter page successfully
   - Disconnect network
   - Verify last-known data still displays
   - Reconnect network
   - Verify updates resume

5. **Fullscreen mode**
   - Click fullscreen button
   - Verify layout optimizes for fullscreen
   - Press ESC to exit
   - Verify return to normal layout

## Future Enhancements

- **Trend charts:** Show feedback count over time (line graph)
- **Comment preview:** Scroll recent comments across bottom
- **Speaker alerts:** Flash/sound when satisfaction drops below threshold
- **Comparison mode:** Side-by-side stats for multiple modules
- **Export screenshot:** Save current analytics view as image
- **Custom branding:** Logo and color scheme customization
- **Presentation templates:** Different layouts for different screen sizes

## Migration from Previous Design

### What's Being Removed
- ❌ Per-module breakdown cards in event-level view
- ❌ Module count badges
- ❌ 5-second refresh interval (too aggressive)

### What's Being Added
- ✅ Average satisfaction rating
- ✅ Average speaker knowledge rating
- ✅ Content depth breakdown chart
- ✅ Visual color-coded indicators
- ✅ Better fullscreen layout
- ✅ 30-second refresh interval (more reasonable)

### What's Being Kept
- ✅ Module-specific and event-level modes
- ✅ Total feedback count display
- ✅ QR code for attendee access
- ✅ Auto-refresh functionality
- ✅ Fullscreen mode
- ✅ Last updated timestamp
- ✅ Event selector fallback

## Implementation Checklist

- [ ] Update documentation (README, SPECIFICATION)
- [ ] Design new analytics layout (this document)
- [ ] Modify count.html structure
- [ ] Update count.js to fetch and calculate analytics
- [ ] Add content depth chart rendering
- [ ] Implement color-coded satisfaction/knowledge displays
- [ ] Update styles.css for new layout
- [ ] Test module-specific mode
- [ ] Test event-level mode
- [ ] Test auto-refresh with live data
- [ ] Test fullscreen mode
- [ ] Verify responsive design
- [ ] Deploy to production
- [ ] Update user training materials

---

**Document Version:** 1.0
**Last Updated:** February 6, 2026
**Status:** Design Complete - Ready for Implementation
