# Celebration Levels for Counter Page

**Date:** March 8, 2026
**Status:** Implemented (v4.1)

> **Note (Apr 2, 2026):** This celebration levels system coexists with the newer "Feed the Cat" counter theme (added in v5.1). Celebration levels control reaction intensity (Chill/Party/Chaos) while the theme system controls the visual indicator style (Classic progress ring vs. Feed the Cat progression). Both selectors appear in the counter footer.

## Summary

Add 3 selectable celebration intensity levels to the live counter page (`count.html` / `count.js`). Each level increases the visual spectacle when new feedback submissions arrive. Cat-themed encouragement messages are present at all levels.

## Celebration Levels

### Level 1: "Chill" (Default)

**On new feedback:**
- Small confetti burst (~20 particles)
- A single tuxedo cat emoji gently floats up from the bottom, tips its hat, fades out
- Pulse animation on counter digits
- Milestone messages at thresholds (10, 25, 50, 75, 100, etc.)

**Cat-themed encouragement messages rotate at all times.**

### Level 2: "Party"

**On new feedback:**
- Medium confetti burst (~60 particles)
- 2-3 tuxedo cats parade across the bottom of the left panel
- A duck waddles across the screen from one side to the other
- Counter digits do an exaggerated slot-machine spin
- Screen gets a brief subtle glow/flash
- At milestones: bigger burst + celebratory text with bounce animation

**Cat-themed encouragement messages rotate at all times.**

### Level 3: "Chaos" (Maximum)

**On new feedback:**
- Massive confetti explosion (~150 particles, more colors)
- A whole parade of tuxedo cats marches across the screen (5-8, different sizes)
- Multiple ducks waddle in formation
- Random bonus characters: party parrots, rockets, stars
- Screen does a brief shake/wobble animation
- Counter does a dramatic spin with a glowing trail
- At milestones: full-screen fireworks + characters do a synchronized dance
- Rapid submissions cause animations to stack and overlap

**Cat-themed encouragement messages rotate at all times.**

## UI Integration

- Dropdown selector in the footer bar, next to the existing "Refresh" dropdown
- Label: "Celebrations:"
- Options: "Chill" (default), "Party", "Chaos"
- Persisted to sessionStorage (same pattern as refresh interval)

## Technical Approach

- All animations are CSS + canvas-based (no external libraries)
- Emoji characters rendered as text on the confetti canvas or as absolutely-positioned DOM elements
- A `celebrationLevel` global variable (1, 2, or 3) controls which effects fire
- The existing `burstConfetti()` and `checkMilestone()` functions are extended with level-aware logic
- New functions: `spawnCat()`, `spawnDuck()`, `spawnBonusCharacter()`, `screenShake()`, `screenGlow()`
- Walking characters use CSS `@keyframes` for cross-screen traversal with slight bobbing motion

## Unchanged

- Overall dark theme layout (two-panel: counter left, QR right)
- Progress ring, slot-machine digits, milestone messages
- Cat-themed encouragement messages (present at all levels)
- Fullscreen mode, refresh interval selector
