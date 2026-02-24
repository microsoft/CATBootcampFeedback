# Counter Redesign & Delete Fix Design

## Changes

### 1. Fix Delete Feedback Bug
**File:** `admin.js` ~line 2964
**Bug:** After bulk delete, "Select All" checkbox ID is generated as `selectAllfeedback` (lowercase f) but HTML element is `selectAllFeedback`. The checkbox stays checked after deletion.
**Fix:** Correct ID generation to produce the right casing.

### 2. Simplify Counter Screen
**Files:** `count.html`, `count.js`

Remove from left panel:
- Average Satisfaction metric card
- Speaker Knowledge metric card
- Content Depth Distribution chart
- All supporting JS that fetches/renders these metrics

New layout: two-panel fullscreen — large counter (left), large QR code (right). Both maximized for large-room visibility.

### 3. Gamified Celebration Counter
**Files:** `count.html`, `count.js`

Add to counter screen:
- Animated number counter (slot-machine digit flip on change)
- Confetti burst on each new submission (canvas-based particles)
- Milestone celebrations at 10, 25, 50, 75, 100, 150, 200+ with special messages
- Rotating encouraging messages below counter
- Pulse animation on count change
- Progress ring around the count number

## Layout

```
+--------------------------------------------------+
| [Event Code]              [Fullscreen] |
+------------------------+-------------------------+
|                        |                         |
|     COUNTER            |      QR CODE            |
|     (large, animated)  |      (large, centered)  |
|                        |                         |
|  [Milestone message]   |  "Scan to give feedback"|
|  [Encouraging text]    |                         |
|                        |                         |
+------------------------+-------------------------+
| [Live indicator] [Refresh] [Last updated]        |
+--------------------------------------------------+
```
