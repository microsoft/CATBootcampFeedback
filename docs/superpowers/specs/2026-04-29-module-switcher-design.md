# Module Switcher on Live Counter — Design

**Date:** 2026-04-29
**Scope:** `count.html` (organizer's live feedback counter)
**Approach:** C — Reactive state container

## Problem

When running a live event, the organizer displays the per-module feedback counter on a screen (often fullscreen). Switching to a different module currently requires closing the browser/tab and reopening with a new URL, which:

- Drops fullscreen state
- Re-flashes the loading spinner and QR code
- Loses the user's place if multiple sessions are open

Goal: switch modules in place without leaving the page or disturbing display settings.

## Constraints

1. **Privacy / GDPR:** No new data collection. Change touches the organizer view only — `feedback.html` (submitter form) is not modified. No PII, no IP logging, no fingerprinting.
2. **No cookies, ever:** Repo currently has zero `document.cookie` usage. Maintain this. Settings persist via `sessionStorage` only.
3. **Local Docker verification required:** All scenarios pass in a Docker container locally before any commit lands on a PR branch.
4. **Documentation must be updated** in the same PR.
5. **Branch + PR workflow:** Work in a new branch. User merges the PR.

## Decisions (from brainstorming)

| Q | Choice |
|---|--------|
| Dropdown contents | Modules of current event only (no event-level option, no cross-event switching) |
| Visibility | Dropdown shown **only** in module mode. Event-level view stays as-is. |
| Placement | In the header — current module name + speaker becomes a styled dropdown |
| Celebration on swap | Suppressed — count change from a switch is not a real delta |
| Implementation | Reactive state container (single `session` object, `applySession()` re-renders) |

## Architecture

A single mutable state object owns the counter session. All current free-floating module-scope variables collapse into it:

```js
const session = {
    eventCode, event,           // event-level context
    moduleId, module,           // module-level context (null in event mode)
    count, isFirstLoad,         // count + celebration baseline
    refreshTimer,               // active interval id
    isApplying,                 // race guard for applySession()
    settings: { theme, refreshInterval, celebrationLevel, soundEnabled }
};
```

Variables collapsed into `session`: `eventCode`, `moduleId`, `currentEvent`, `currentModule`, `currentCount`, `isFirstLoad`, `refreshTimer`, `currentRefreshInterval`, `celebrationLevel`, `soundEnabled`, `currentTheme`.

`applySession({ eventCode, moduleId })` becomes the single entry point for "show this event/module." Used by initial load and dropdown switch alike.

```
applySession({eventCode, moduleId}):
  1. Guard with session.isApplying flag
  2. Fetch event data (/events/{code}/count)
  3. If moduleId, fetch module data (/events/{code}/modules/{moduleId}/count)
  4. Update session (event/module/count atomically)
  5. renderHeader() — module title becomes dropdown if moduleId set
  6. generateQRCode() — feedback URL with current code/module
  7. session.isFirstLoad = true (suppresses celebrations on this load)
  8. await updateCount() — first display draw
  9. Restart refresh timer (stopLiveUpdates → startLiveUpdates)
  10. history.replaceState(URL with current code+module)
  11. Clear isApplying
```

## Components

### 1. Module switcher dropdown

In header, replaces the static `#eventCodeDisplay` text in module mode:

```html
<div class="event-info">
  <select id="moduleSwitcher" class="module-title-select"
          aria-label="Switch module">
    <option value="1" selected>Intro to CAT Bootcamp — John Doe</option>
    <option value="2">Building Your First Copilot — Jane Smith</option>
  </select>
  <div class="event-subtext">Event: CAT Bootcamp Q1-2026</div>
</div>
```

Styled to look like the current title (transparent background, large font), with a subtle chevron on hover so it reads as interactive. Populated from `session.event.modules` filtered to `isActive === true` and sorted by `deliveryOrder`.

In event mode, the existing plain text is rendered. Switcher absent.

### 2. State container (`session`)

Defined once at module top. JavaScript is single-threaded — direct mutation is fine. `applySession()` is the explicit re-render trigger after mutation. No observer pattern needed.

### 3. Functions refactored to read from `session`

- `updateCount()` — reads `session.eventCode/moduleId/isFirstLoad`
- `generateQRCode()` — reads `session.eventCode/moduleId`
- `showCountDisplay()` / new `renderHeader()` — reads `session.event/module`
- Theme/celebration/sound/refresh interval functions — read `session.settings`

### 4. URL sync

`applySession()` calls `history.replaceState(null, '', url)`. Refresh / share-link / back-button produce the correct view. No new history entries — back button goes to wherever the user came from, not through every dropdown change.

### 5. No cookies

Settings continue to use `sessionStorage` only. Verified zero `document.cookie` usage in repo today; rule maintained.

### 6. Switching overlay (added during implementation)

Because the QR `toCanvas()` API is callback-based and fires after `applySession()` returns, a translucent overlay with a spinner is shown over the main content (counter + QR) the moment the user picks a new module. Text reads `Loading <module label>…` where the label includes the order prefix (e.g. `#2: Advanced Copilot Features — Bob Johnson`). The dropdown is disabled while the overlay is visible. `generateQRCode()` was wrapped to return a Promise so `applySession()` can `await` it; the overlay is dismissed only after both data and QR redraw have completed. The header (with the dropdown) remains visible throughout so the user can see their selection is staged.

## Data flow

```
Initial load:
  URL ?code=X&module=Y
    → initialize() → applySession({eventCode:X, moduleId:Y})
       → fetch event + module
       → renderHeader() (dropdown populated)
       → generateQRCode() (?code=X&module=Y)
       → updateCount() (isFirstLoad=true → no celebrations)
       → startLiveUpdates()

Dropdown change:
  User selects module Z
    → applySession({eventCode:X, moduleId:Z})
       → same path: fetch, render, updateCount with isFirstLoad=true
       → history.replaceState(?code=X&module=Z)
       → settings (theme/sound/refresh/celebration/fullscreen) untouched

Subsequent poll after switch:
  refreshTimer fires updateCount()
    → if count changed AND !isFirstLoad → celebrations fire on real delta
```

## Error handling

| Failure | Handling |
|---------|----------|
| Module fetch fails after dropdown change | Inline error in header, revert dropdown to previous selection, keep previous module displayed. No reload. |
| Module deactivated mid-session (404 or `isActive=false`) | Same as above, plus refresh dropdown options from fresh `/events/X/count` |
| Network blip on poll | Existing `updateCount()` swallows + logs. No change. |
| Rapid double-click on dropdown | `session.isApplying` flag — second call waits or cancels. |
| `history.replaceState` fails (rare) | Log warning, do not block the switch. `session` is source of truth, not URL. |

### State invariants

- `session.moduleId !== null` ⟺ `session.module !== null` (set together inside `applySession`, never partially)
- `session.refreshTimer` is always either valid or `null` — never stale
- Only one `applySession()` runs at a time (`isApplying` guard)

## Testing

### Local Docker testing (Phase A — required before commit)

**New files:**

- `Dockerfile` — node base, installs `@azure/static-web-apps-cli` and Azure Functions Core Tools
- `docker-compose.yml` — single service, volume-mounts project, exposes port 4280
- `.dockerignore`
- `docs/DOCKER-LOCAL-TESTING.md` — start, verify, tear down

Container runs `swa start . --api-location ./api`. With `CONFIG.USE_MOCK_DATA = true`, no SQL backend needed for switcher testing. Production-DB testing is a separate flow.

**Test plan (all run inside Docker container before any push):**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open `?code=CSA1B2C3&module=1` | Module 1 view, switcher dropdown visible with all active modules of event |
| 2 | Switch to Module 2 via dropdown | Count + QR + header update; no confetti/sound on swap; URL becomes `?code=...&module=2` |
| 3 | Refresh browser after switch | Module 2 view persists |
| 4 | Open `?code=CSA1B2C3` (no module) | Event-level view; switcher dropdown **absent** |
| 5 | Toggle theme/sound/celebrations, then switch module | Settings preserved across switch |
| 6 | Toggle fullscreen, switch module | Stays in fullscreen, no flicker exit |
| 7 | New feedback arrives via mock data after switch | Confetti fires for delta *after* swap, not the swap itself |
| 8 | DevTools → Application → Cookies | Empty for app origin |
| 9 | Switch module rapidly 5x | No race, no orphaned timers, final state matches last selection |
| 10 | Disable network → switch module | Error message shown, previous module still displayed |
| 11 | `feedback.html` for switched module's QR | Form loads correctly with `&module=Z` |

### PR CI (Phase B)

Existing CI runs unchanged. Optional: lint check that fails the build if `document.cookie` appears in repo source.

### Post-merge (Phase C)

User's existing production verification flow.

## Documentation updates

| File | Update |
|------|--------|
| `README.md` | Add module switcher to feature list; link Docker local-testing doc |
| `QUICK_START_GUIDE.md` | Add "Switching modules during a live event" |
| `ADMIN_SETUP_GUIDE.md` | Operator note about the dropdown |
| `SPECIFICATION.md` | Update count-screen behavior section + state container note |
| `PRIVACY.md` | Note: feature is on organizer view only, no submitter data, no cookies introduced |
| `docs/DEPLOYMENT-RUNBOOK.md` | Note the new client-side capability if relevant |
| `docs/DOCKER-LOCAL-TESTING.md` | **New** — how to run/test locally |

## Out of scope

- Cross-event switching from the live screen
- Switching to event-level view from module mode (or vice versa) via the dropdown
- Authentication / authorization changes
- Any change to `feedback.html`, the API surface, or the database
- Changing how settings persist (still `sessionStorage`)
- Adding cookies for any reason

## Workflow

- Create new branch `feature/live-counter-module-switcher` (or similar)
- All work + Docker verification on local clone first
- No commits pushed until full local test pass
- Open PR; user merges when ready
