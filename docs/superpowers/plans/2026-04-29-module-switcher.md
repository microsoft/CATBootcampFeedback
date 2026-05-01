# Live Counter Module Switcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a header dropdown on `count.html` that lets the organizer switch between modules of the current event in place — without reloading the page or losing fullscreen / theme / sound / refresh / celebration settings. The change is on the organizer view only; `feedback.html` (the submitter form) is not touched, so privacy / GDPR posture is unchanged.

**Architecture:** Replace `count.js`'s free-floating module-scope state with one `session` object. A single async `applySession({ eventCode, moduleId })` handles every "show this view" transition (initial load and dropdown switch alike). Each call atomically updates `session`, re-renders header / QR / counter, suppresses celebrations on the swap, restarts the refresh timer, and syncs the URL via `history.replaceState`.

**Tech Stack:** Vanilla JavaScript ES modules, Azure Static Web Apps, Azure Functions (Node 20). Docker container (added in this PR) running `@azure/static-web-apps-cli` for local manual verification.

**Spec:** `docs/superpowers/specs/2026-04-29-module-switcher-design.md`

---

## Workflow constraints (READ FIRST)

1. **Branch:** All work happens on a new local branch `feature/live-counter-module-switcher`. Do not work on `main`.
2. **No push to GitHub until Task 13 (Docker verification) passes.** Local commits per task are fine — they help with rollback. Only `git push` after the full 11-scenario test plan passes.
3. **No cookies, ever.** Every code task ends with a grep check that no `document.cookie` was introduced.
4. **GDPR posture unchanged.** Tasks must not add data collection on `feedback.html` or in the submission API. The change is scoped to `count.html` and `count.js`.
5. **Update docs in the same PR.** Tasks 9-12 cover this.
6. **Docker setup stays LOCAL — do NOT commit Docker files to GitHub.** The `.gitignore` already excludes `docker-compose.yml` and `docker/`. The new `Dockerfile` and `.dockerignore` are added to `.gitignore` and are intentionally *not* staged in Task 14. The `docs/DOCKER-LOCAL-TESTING.md` file also stays uncommitted. Public-facing docs (README / QUICK_START / DEPLOYMENT-RUNBOOK) do NOT reference the Docker setup.

## Test infrastructure note

This repo has no automated frontend tests. Verification is **manual via Docker** — that's the user's stated approach (Phase A of their A/B/C verification workflow). Each implementation task has a "Verify" step describing what to check in the running container. The full 11-scenario sweep happens in Task 13.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `count.js` | Modify | Session state container + `applySession()` + dropdown wiring + reads from `session` |
| `count.html` | Modify | New `#moduleSwitcher` markup placeholder in header; CSS for title-style select |
| `Dockerfile` | Create (local-only, **not committed**) | Node 20 image with `@azure/static-web-apps-cli` for local serving |
| `docker-compose.yml` | Create (local-only, **not committed** — already gitignored) | One-service compose for `docker compose up` |
| `.dockerignore` | Create (local-only, **not committed**) | Exclude node_modules / .git / docs from image context |
| `docs/DOCKER-LOCAL-TESTING.md` | Create (local-only, **not committed**) | How to run, verify, tear down the local container |
| `.gitignore` | Modify | Add `Dockerfile` and `.dockerignore` to ignored entries |
| `README.md` | Modify | Feature blurb (no Docker reference) |
| `QUICK_START_GUIDE.md` | Modify | "Switching modules during a live event" section |
| `ADMIN_SETUP_GUIDE.md` | Modify | Operator note about the dropdown |
| `SPECIFICATION.md` | Modify | Count-screen behavior + state container note |
| `PRIVACY.md` | Modify | Note: feature is on organizer view only, no submitter data, no cookies |
| `docs/DEPLOYMENT-RUNBOOK.md` | Modify | Note new client-side capability if relevant (no Docker reference) |

The two design documents (`docs/superpowers/specs/...` and `docs/superpowers/plans/...`) are already in the working tree on `main` (uncommitted). They get committed onto the feature branch in Task 14 along with everything else.

---

## Task 1: Create local feature branch and stage existing design docs

**Files:** none modified; branch created.

- [ ] **Step 1.1: Confirm we're on `main` with no unrelated uncommitted changes**

```bash
cd /c/Users/dewainr/projects/CATBootcampFeedback
git status --short
git branch --show-current
```

Expected: Branch shows `main`. Status shows only the two untracked files under `docs/superpowers/` (the spec and this plan). If anything else appears, stop and ask the user before continuing.

- [ ] **Step 1.2: Create and switch to the feature branch**

```bash
git switch -c feature/live-counter-module-switcher
git status --short
```

Expected: branch is `feature/live-counter-module-switcher`. The two `docs/superpowers/` files remain untracked (they carry over with the branch since they're working-tree-only). Do not commit yet — commits batch into logical groups starting Task 14.

---

## Task 2: Add Docker setup for local manual testing

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

The container runs the Azure Static Web Apps CLI which serves static files and proxies the Azure Functions API. With `CONFIG.USE_MOCK_DATA = true` (the default for `localhost` on a non-8080 port — see `config.js`:11-17), no SQL backend is needed for switcher testing.

- [ ] **Step 2.1: Create `Dockerfile`**

Create file `Dockerfile` at repo root:

```dockerfile
# Local-testing image for CAT Bootcamp Feedback.
# Runs Azure Static Web Apps CLI on port 4280 (default).
# Mock mode auto-engages because hostname=localhost and port!=8080 (see config.js).
FROM node:20-alpine

WORKDIR /app

# Install SWA CLI globally (also handles invoking Functions Core Tools)
RUN npm install -g @azure/static-web-apps-cli@latest

# Copy API package files first for better layer caching
COPY api/package.json api/package-lock.json* ./api/
RUN cd api && npm install --omit=dev || true

# Copy the rest of the project
COPY . .

EXPOSE 4280

# `--api-location ./api` tells SWA CLI where the Functions code lives.
# `--host 0.0.0.0` makes the server reachable from the host machine.
CMD ["swa", "start", ".", "--api-location", "./api", "--host", "0.0.0.0", "--port", "4280"]
```

- [ ] **Step 2.2: Create `docker-compose.yml`**

Create file `docker-compose.yml` at repo root:

```yaml
services:
  cat-bootcamp-local:
    build: .
    container_name: cat-bootcamp-local
    ports:
      - "4280:4280"
    # Mount source for live edits — changes to count.html / count.js / *.css
    # take effect on browser refresh, no rebuild needed.
    volumes:
      - ./:/app
      - /app/node_modules
      - /app/api/node_modules
```

- [ ] **Step 2.3: Create `.dockerignore`**

Create file `.dockerignore` at repo root:

```
.git
.github
node_modules
api/node_modules
docs/superpowers
*.log
.env
.env.*
.vscode
.idea
```

- [ ] **Step 2.4: Build and verify the container starts**

```bash
docker compose build
docker compose up -d
docker compose logs --tail=50 cat-bootcamp-local
```

Expected: Logs include `Azure Static Web Apps emulator started ... http://0.0.0.0:4280`. If you see an EADDRINUSE error on 4280, run `docker compose down` and adjust the host port in `docker-compose.yml` (e.g. `4281:4280`) and the verify URL accordingly.

- [ ] **Step 2.5: Verify the unmodified `count.html` renders**

In a browser, open: `http://localhost:4280/count.html`

Expected: The "Select Event" view appears (because no `?code=` is in URL). The page should NOT show errors in DevTools console other than benign 404s for any optional resources.

- [ ] **Step 2.6: Verify mock mode is engaged**

In DevTools console on the page above, run:

```js
import('./config.js').then(m => console.log('USE_MOCK_DATA:', m.CONFIG.USE_MOCK_DATA))
```

Expected: `USE_MOCK_DATA: true`. If false, mock mode isn't on — re-check that you opened `localhost:4280` (not `127.0.0.1:8080` etc.).

- [ ] **Step 2.7: Verify mock event is reachable**

Navigate to `http://localhost:4280/count.html?code=CSA1B2C3&module=1`.

Expected: After the loading spinner clears, the count display appears with header text "Introduction to CAT Bootcamp - John Doe" and a counter number visible. Confetti / sound off is fine — only a visible counter is required.

- [ ] **Step 2.8: Tear down**

```bash
docker compose down
```

Expected: container stops cleanly. Container can be brought back up at any time with `docker compose up -d`.

---

## Task 3: Add `session` state container to `count.js`

**Files:**
- Modify: `count.js` (state declaration block, lines 17-26)

This task only adds the `session` object alongside existing globals. Subsequent tasks migrate code to read from it, then remove the old globals. Splitting the refactor in this order keeps each step verifiable in Docker.

- [ ] **Step 3.1: Insert `session` declaration after the existing globals**

Open `count.js`. Find the existing global state block (around line 16-26):

```js
// ── Global state ──────────────────────────────────────────────────────────────
let eventCode = null;
let moduleId = null;
let currentEvent = null;
let currentModule = null;
let refreshTimer = null;
let isModuleMode = false;
let currentRefreshInterval = CONFIG.COUNT_REFRESH_INTERVAL;
let currentCount = 0;
let isFirstLoad = true;
let celebrationLevel = 1; // 1=Chill, 2=Party, 3=Chaos
```

Add immediately AFTER this block:

```js
// ── Session state container ───────────────────────────────────────────────────
// Single source of truth for the live counter view. All "show this event/module"
// transitions go through applySession(). See docs/superpowers/specs/2026-04-29-module-switcher-design.md
const session = {
    eventCode: null,
    event: null,           // full event object including modules array
    moduleId: null,        // string from URL or null in event mode
    module: null,          // resolved module object or null in event mode
    count: 0,
    isFirstLoad: true,     // suppresses celebrations on next updateCount()
    refreshTimer: null,
    isApplying: false,     // race guard for applySession()
    settings: {
        theme: 'classic',
        refreshInterval: CONFIG.COUNT_REFRESH_INTERVAL,
        celebrationLevel: 1,
        soundEnabled: true
    }
};
```

- [ ] **Step 3.2: Verify nothing broke**

Refresh `http://localhost:4280/count.html?code=CSA1B2C3&module=1` in the browser (container should still be up from Task 2; if not, `docker compose up -d`).

Expected: Same behavior as before. Page loads, counter renders, no new console errors. The `session` object is just sitting there unused — that's fine.

- [ ] **Step 3.3: Cookie check**

```bash
grep -n "document.cookie" count.js count.html || echo "OK no cookies"
```

Expected: `OK no cookies`.

---

## Task 4: Add `applySession()` and refactor `initialize()` (dual-write to session and legacy globals)

**Files:**
- Modify: `count.js` (add `applySession`, `renderHeader` stub, `showCountDisplayShell`; replace `initialize()` body)

This task introduces `session`-driven control flow but keeps writing to the existing legacy globals (`eventCode`, `currentEvent`, etc.) so the existing function bodies (which still read from those globals) keep working. Task 5 then migrates the readers. This dual-write avoids any in-between state where the page is broken.

- [ ] **Step 4.1: Add `applySession()` near the data-loading section**

Find the section header `// DATA LOADING` (around line 1289). Insert ABOVE that block:

```js
// ══════════════════════════════════════════════════════════════════════════════
// SESSION TRANSITIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The single entry point for "show this event/module on the live counter."
 * Used by initialize() on first load and by the module switcher dropdown.
 *
 * Atomically: fetches data, updates session (and legacy globals during transition),
 * re-renders header/QR/count, resets isFirstLoad (suppressing celebrations),
 * restarts the refresh timer, and syncs the URL via history.replaceState.
 *
 * Throws on fetch failure; caller handles UI revert.
 */
async function applySession({ eventCode: ec, moduleId: mid }) {
    if (session.isApplying) return;
    session.isApplying = true;
    try {
        const ev = await loadEventDetails(ec);
        if (!ev) {
            throw new Error('Event not found');
        }

        let mod = null;
        if (mid) {
            mod = await loadModuleDetails(ec, mid);
            if (!mod) {
                throw new Error('Module not found');
            }
        }

        // Write to session (new source of truth)
        session.eventCode = ec;
        session.event = ev;
        session.moduleId = mid ? String(mid) : null;
        session.module = mod;
        session.isFirstLoad = true;

        // Transitional dual-write to legacy globals — removed after Task 5
        eventCode = ec;
        moduleId = mid || null;
        currentEvent = ev;
        currentModule = mod;
        isModuleMode = !!mid;
        isFirstLoad = true;

        renderHeader();
        generateQRCode();

        await updateCount();

        stopLiveUpdates();
        startLiveUpdates();

        const url = new URL(window.location);
        url.searchParams.set('code', ec);
        if (mid) {
            url.searchParams.set('module', String(mid));
        } else {
            url.searchParams.delete('module');
        }
        try {
            history.replaceState(null, '', url);
        } catch (e) {
            console.warn('history.replaceState failed:', e);
        }
    } finally {
        session.isApplying = false;
    }
}
```

- [ ] **Step 4.2: Add `renderHeader()` placeholder + `showCountDisplayShell()` helper**

Insert these two functions next to the existing `showCountDisplay()` (around line 1691):

```js
/**
 * Show the count display container (layout + scaffolding) before any session is applied.
 * The header text and counter are filled in by applySession() → renderHeader() / updateCount().
 */
function showCountDisplayShell() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    countDisplay.style.display = 'flex';
}

/**
 * Render the header for the current session.
 * Stub for Task 4 — replaced with the dropdown version in Task 6.
 */
function renderHeader() {
    const eventInfo = document.querySelector('.event-info');
    if (!eventInfo) return;
    const eventName = session.event?.eventName || session.eventCode;
    if (session.module) {
        const m = session.module;
        eventInfo.innerHTML = `
            <div class="event-code">${escapeHtml(m.moduleName || 'Module')} - ${escapeHtml(m.speakerName || 'Speaker')}</div>
            <div class="event-subtext">Event: ${escapeHtml(eventName)}</div>
        `;
    } else {
        eventInfo.innerHTML = `
            <div class="event-code">Event: ${escapeHtml(eventName)}</div>
        `;
    }
}
```

- [ ] **Step 4.3: Refactor `initialize()` to call `applySession()`**

Find `initialize()` (around line 1234) and replace it entirely:

```js
async function initialize() {
    const urlEventCode = getUrlParameter('code');
    const urlModuleId = getUrlParameter('module');

    if (!urlEventCode) {
        await showEventSelector();
        return;
    }

    try {
        showCountDisplayShell();
        initProgressRing();
        initCat();
        startEncouragingMessages();
        initializeRefreshIntervalSelector();
        initializeCelebrationLevelSelector();
        initializeSoundToggle();
        initializeThemeSelector();
        initializeFullscreenButton();

        await applySession({ eventCode: urlEventCode, moduleId: urlModuleId });
    } catch (error) {
        console.error('Error initializing count page:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showError(friendlyError.message);
    }
}
```

The legacy `showCountDisplay()` function still exists and is no longer called. Don't delete it yet — Task 5 verifies nothing else calls it before removal.

- [ ] **Step 4.4: Verify in Docker**

Refresh `http://localhost:4280/count.html?code=CSA1B2C3&module=1`.

Expected:
- Page loads, header shows `Introduction to CAT Bootcamp - John Doe` + event subtext
- Counter renders with mock count
- DevTools console: no errors
- URL bar still shows the original `?code=CSA1B2C3&module=1`

Try `http://localhost:4280/count.html?code=TEST123` (no module).

Expected: header shows `Event: Test Event`. No errors.

Try `http://localhost:4280/count.html?code=BADCODE`.

Expected: error message displayed via `showError`. No crash.

- [ ] **Step 4.5: Cookie check**

```bash
grep -n "document.cookie" count.js count.html || echo "OK no cookies"
```

Expected: `OK no cookies`.

---

## Task 5: Migrate function reads from legacy globals to `session`

**Files:**
- Modify: `count.js` (functions: `updateCount`, `generateQRCode`, settings initializers, delete legacy `showCountDisplay`)

Now that `session` is populated by `applySession()` (Task 4), migrate the readers one at a time. Each step is independently verifiable in Docker.

- [ ] **Step 5.1: Migrate `updateCount()`**

Find `updateCount()` (around line 1493) and replace its body's reads of `eventCode`, `moduleId`, `isModuleMode`, `currentCount`, `isFirstLoad`, `currentTheme` with `session.eventCode`, `session.moduleId`, `session.module !== null`, `session.count`, `session.isFirstLoad`, `session.settings.theme`. Writes to `currentCount` and `isFirstLoad` become writes to `session.count` and `session.isFirstLoad`.

Specifically the existing function:

```js
async function updateCount() {
    try {
        let data;
        let count;

        if (isModuleMode) {
            data = await getModuleFeedbackCount(eventCode, moduleId);
            count = data.count || 0;
        } else {
            data = await getFeedbackCount(eventCode);
            count = data.totalCount || 0;
        }

        const oldCount = currentCount;

        if (count !== oldCount || isFirstLoad) {
            updateDigitDisplay(count);

            const activeCounter = currentTheme === 'classic'
                ? document.getElementById('counterNumber')
                : document.getElementById('catCounterNumber');
            if (activeCounter) {
                activeCounter.classList.remove('pulse');
                void activeCounter.offsetWidth;
                activeCounter.classList.add('pulse');
            }

            if (!isFirstLoad && count > oldCount) {
                triggerCelebration(count, oldCount);
            }

            updateProgressRing(count);
            updateCatState(count);

            currentCount = count;
            isFirstLoad = false;
        }
        // ... timestamp update unchanged
    } catch (error) {
        console.error('Error updating count:', error);
    }
}
```

becomes:

```js
async function updateCount() {
    try {
        let data;
        let count;

        if (session.module !== null) {
            data = await getModuleFeedbackCount(session.eventCode, session.moduleId);
            count = data.count || 0;
        } else {
            data = await getFeedbackCount(session.eventCode);
            count = data.totalCount || 0;
        }

        const oldCount = session.count;

        if (count !== oldCount || session.isFirstLoad) {
            updateDigitDisplay(count);

            const activeCounter = session.settings.theme === 'classic'
                ? document.getElementById('counterNumber')
                : document.getElementById('catCounterNumber');
            if (activeCounter) {
                activeCounter.classList.remove('pulse');
                void activeCounter.offsetWidth;
                activeCounter.classList.add('pulse');
            }

            if (!session.isFirstLoad && count > oldCount) {
                triggerCelebration(count, oldCount);
            }

            updateProgressRing(count);
            updateCatState(count);

            session.count = count;
            session.isFirstLoad = false;
        }
        // ... timestamp update unchanged
    } catch (error) {
        console.error('Error updating count:', error);
    }
}
```

Keep the timestamp-update block exactly as it was — only the parts shown above change.

Verify in browser: refresh `http://localhost:4280/count.html?code=CSA1B2C3&module=1`. Counter should still render and update on each refresh interval. If broken, revert this step and re-read the diff.

- [ ] **Step 5.2: Migrate `generateQRCode()`**

Find `generateQRCode()` (around line 1656). Change:

```js
function generateQRCode() {
    let feedbackUrl = `${FEEDBACK_BASE_URL}?code=${eventCode}`;
    if (isModuleMode && moduleId) {
        feedbackUrl += `&module=${moduleId}`;
    }
    // ...
}
```

to:

```js
function generateQRCode() {
    let feedbackUrl = `${FEEDBACK_BASE_URL}?code=${session.eventCode}`;
    if (session.moduleId) {
        feedbackUrl += `&module=${session.moduleId}`;
    }
    // ...
}
```

Verify in Docker: refresh `http://localhost:4280/count.html?code=CSA1B2C3&module=1`. Open DevTools → Sources → `qrcode.min.js` is loaded. The QR canvas re-renders. The encoded URL must include `&module=1` — easiest check: in DevTools console run `document.getElementById('qrCode').toDataURL().length` (just confirms it generated; or visually scan with a phone if you have one handy).

- [ ] **Step 5.3: Remove the now-orphaned `showCountDisplay()`**

Task 4 changed `initialize()` to call `showCountDisplayShell()` and `applySession()`. The original `showCountDisplay()` is now unused.

```bash
grep -n "showCountDisplay\b" count.js
```

Expected: matches only the function definition (no callers other than that line). If any other matches appear, halt and inspect — they may need migration too.

If clean, delete the entire `showCountDisplay()` function (the original one near line 1691, before our Task 4 additions). Keep `showCountDisplayShell()`.

Verify in Docker: refresh `http://localhost:4280/count.html?code=CSA1B2C3&module=1`. Page still loads, counter still renders.

- [ ] **Step 5.4: Migrate theme / sound / celebration / refresh-interval state to `session.settings`**

These are written by their respective `initialize…()` handlers (which run inside `initialize()` BEFORE `applySession()`, so `session` exists).

Leave the existing legacy declarations (`let currentTheme = 'classic';` near line 918, `let soundEnabled = true;` near line 90, `let celebrationLevel = 1;` near line 26, `let currentRefreshInterval = CONFIG.COUNT_REFRESH_INTERVAL;` near line 23) alone — other functions still read them. Just mirror writes to `session.settings.*` so future code can rely on session.

In `initializeSoundToggle()` (around line 294) — after BOTH writes to `soundEnabled` (the saved-value branch and the change-listener branch), add:
```js
        session.settings.soundEnabled = soundEnabled;
```

In `initializeCelebrationLevelSelector()` (around line 1635) — after both writes to `celebrationLevel`, add:
```js
        session.settings.celebrationLevel = celebrationLevel;
```

In `initializeRefreshIntervalSelector()` (around line 1616) — after both writes to `currentRefreshInterval`, add:
```js
        session.settings.refreshInterval = currentRefreshInterval;
```

In `initializeThemeSelector()` and any other site that writes `currentTheme = ...` (search `grep -n "currentTheme = " count.js`) — after each write, add:
```js
        session.settings.theme = currentTheme;
```

Verify in Docker: refresh `http://localhost:4280/count.html?code=CSA1B2C3&module=1`. Toggle theme between Classic and Cat in the footer. Toggle sound on/off. Change refresh interval. Each should still work as before. The `session.settings` object is now a parallel mirror — nothing in the app reads from it yet, but Task 6 (renderHeader) and any future code can.

- [ ] **Step 5.5: Cookie check**

```bash
grep -n "document.cookie" count.js count.html || echo "OK no cookies"
```

Expected: `OK no cookies`.

---

## Task 6: Implement the module switcher dropdown UI

**Files:**
- Modify: `count.html` (CSS for title-style select)
- Modify: `count.js` (full `renderHeader()` + `handleModuleSwitch()`)

- [ ] **Step 6.1: Add CSS for the title-style select in `count.html`**

In `count.html`, find the `.event-code` rule (around line 61) and add the following AFTER it (still inside the `<style>` block):

```css
        /* Module switcher: a <select> styled to read like the title */
        .module-title-select {
            font-size: 1.5rem;
            font-weight: 600;
            color: white;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 6px;
            padding: 4px 28px 4px 8px;
            cursor: pointer;
            font-family: inherit;
            max-width: 100%;
            text-overflow: ellipsis;
            appearance: none;
            -webkit-appearance: none;
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'><path fill='white' d='M7 10l5 5 5-5z'/></svg>");
            background-repeat: no-repeat;
            background-position: right 6px center;
        }

        .module-title-select:hover,
        .module-title-select:focus {
            border-color: rgba(255, 255, 255, 0.25);
            background-color: rgba(255, 255, 255, 0.06);
            outline: none;
        }

        .module-title-select option {
            background: #1a1a2e;
            color: white;
            font-size: 1rem;
            font-weight: 500;
        }

        .header-error {
            margin-top: 4px;
            font-size: 0.85rem;
            color: #ff6b6b;
            min-height: 1.1em;
        }
```

- [ ] **Step 6.2: Replace the placeholder `renderHeader()` in `count.js`**

Replace the stub from Task 5.5 with the full implementation:

```js
function renderHeader() {
    const eventInfo = document.querySelector('.event-info');
    if (!eventInfo) return;
    const eventName = session.event?.eventName || session.eventCode;

    if (session.moduleId && session.module) {
        // Module mode: render dropdown of all modules in the event
        const modules = (session.event?.modules || [])
            .filter(m => m.eventModuleId && m.moduleName)
            .sort((a, b) => (a.deliveryOrder || 0) - (b.deliveryOrder || 0));

        const options = modules.map(m => {
            const selected = String(m.eventModuleId) === String(session.moduleId) ? ' selected' : '';
            const label = `${escapeHtml(m.moduleName)} — ${escapeHtml(m.speakerName || 'Unknown Speaker')}`;
            return `<option value="${m.eventModuleId}"${selected}>${label}</option>`;
        }).join('');

        eventInfo.innerHTML = `
            <select id="moduleSwitcher" class="module-title-select" aria-label="Switch module">
                ${options}
            </select>
            <div class="event-subtext">Event: ${escapeHtml(eventName)}</div>
            <div class="header-error" id="headerError" role="alert" aria-live="polite"></div>
        `;
        const switcher = document.getElementById('moduleSwitcher');
        switcher.addEventListener('change', handleModuleSwitch);
    } else {
        // Event mode: plain title, no dropdown
        eventInfo.innerHTML = `
            <div class="event-code">Event: ${escapeHtml(eventName)}</div>
            <div class="header-error" id="headerError" role="alert" aria-live="polite"></div>
        `;
    }
}

async function handleModuleSwitch(event) {
    const select = event.target;
    const newModuleId = select.value;
    const previousModuleId = session.moduleId;

    if (String(newModuleId) === String(previousModuleId)) return;

    clearHeaderError();

    try {
        await applySession({ eventCode: session.eventCode, moduleId: newModuleId });
    } catch (err) {
        console.error('Module switch failed:', err);
        showHeaderError('Couldn\'t load that module. Please try again.');
        // Revert dropdown to last-known-good module so user can retry
        select.value = String(previousModuleId);
    }
}

function showHeaderError(msg) {
    const el = document.getElementById('headerError');
    if (el) el.textContent = msg;
}

function clearHeaderError() {
    const el = document.getElementById('headerError');
    if (el) el.textContent = '';
}
```

- [ ] **Step 6.3: Verify in Docker**

Refresh `http://localhost:4280/count.html?code=CSA1B2C3&module=1`.

Expected: Header shows the module dropdown with `Introduction to CAT Bootcamp — John Doe` selected. The mock event for `CSA1B2C3` only has one module, so the dropdown is single-option (still rendered). Switch URL to `?code=TEST123&module=2`:

Expected: Dropdown shows two options — `Building Your First Copilot — Jane Smith` (selected) and `Advanced Copilot Features — Bob Johnson`. Click and select the other one.

Expected:
- Header dropdown updates to the new selection
- Counter resets and reloads from mock data for that module
- QR code regenerates (looking different)
- URL bar shows `?code=TEST123&module=3`
- No confetti, no celebration sound
- Theme/sound/refresh-interval settings unchanged
- DevTools console: no errors

- [ ] **Step 6.4: Verify event-mode (no dropdown)**

Open `http://localhost:4280/count.html?code=TEST123`.

Expected: Header reads `Event: Test Event` with no dropdown. Counter shows totalCount.

- [ ] **Step 6.5: Cookie check**

```bash
grep -rn "document.cookie" count.js count.html || echo "OK no cookies"
```

Expected: `OK no cookies`.

---

## Task 7: Verify error handling — module fetch failure reverts dropdown

**Files:** none modified — test-only.

- [ ] **Step 7.1: Force a fetch failure in mock mode**

Open `http://localhost:4280/count.html?code=TEST123&module=2`. In DevTools console, monkey-patch `mockLoadModuleDetails` for the next call:

```js
window.__originalLoadModuleDetails = window.loadModuleDetails;
```

(If `loadModuleDetails` is not on `window`, skip the monkey-patch and instead use the network throttling approach below.)

Alternative: use DevTools → Network tab → "Offline" toggle. Then switch the dropdown to the other module.

Expected:
- Dropdown reverts to `Building Your First Copilot — Jane Smith`
- Below the dropdown, an error message appears: `Couldn't load that module. Please try again.`
- Previous module's count is still shown
- No console crash; just `console.error('Module switch failed:', ...)`

Toggle network back to "Online" and switch again — should work and clear the error.

- [ ] **Step 7.2: Verify the rapid-click race guard**

In DevTools console, simulate rapid switches:

```js
const sw = document.getElementById('moduleSwitcher');
sw.value = '3'; sw.dispatchEvent(new Event('change'));
sw.value = '2'; sw.dispatchEvent(new Event('change'));
sw.value = '3'; sw.dispatchEvent(new Event('change'));
```

Expected: Only one in-flight switch at a time (the `isApplying` flag short-circuits subsequent calls). Final state matches whichever switch actually completed; no orphaned timers, no duplicate counters. Confirm `session.refreshTimer` is a single value:

```js
session.refreshTimer
```

(Should be a single timer ID. If you can't access `session` from console because it's module-scoped, skip — manual rapid-click test below covers it visibly.)

Manual rapid-click: with the dropdown open, click rapidly through all options. Final state should match the last selection, no console errors, no double-counters.

---

## Task 8: Consolidate "no cookies" verification

**Files:** none modified.

- [ ] **Step 8.1: Whole-repo cookie check**

```bash
grep -rn "document.cookie\|res\.cookie\|req\.cookies\|cookie-parser\|setCookie\|getCookie" \
  --exclude-dir=node_modules --exclude-dir=.git \
  /c/Users/dewainr/projects/CATBootcampFeedback/ \
  | grep -v -F "docs/superpowers/" \
  || echo "OK: no cookie usage anywhere in repo"
```

Expected: `OK: no cookie usage anywhere in repo`. If any matches appear, halt — investigate and remove unless they are pre-existing in unrelated code.

- [ ] **Step 8.2: Browser DevTools cookie check**

Open `http://localhost:4280/count.html?code=TEST123&module=2` in a fresh incognito window. DevTools → Application → Storage → Cookies → `http://localhost:4280`.

Expected: empty (no cookies). Storage → Session Storage may contain `soundEnabled`, `countRefreshInterval`, `celebrationLevel`, `selectedTheme` — those are fine.

---

## Task 9: Update README and quick-start docs

**Files:**
- Modify: `README.md`
- Modify: `QUICK_START_GUIDE.md`
- Modify: `ADMIN_SETUP_GUIDE.md`

- [ ] **Step 9.1: README — feature list addition**

Open `README.md`. Find the existing feature list (search for "Live counter" or "count.html" or the bulleted features section). Add a bullet to the user-facing feature description:

```markdown
- **Live module switcher on counter screen** — when displaying a per-module live count, switch to another module of the same event in place via a header dropdown. Theme, sound, fullscreen, refresh, and celebration settings are preserved across the switch. No reload required.
```

**Do NOT add a Docker section.** The Docker setup is intentionally local-only and not referenced in committed docs.

- [ ] **Step 9.2: QUICK_START_GUIDE — operator section**

Open `QUICK_START_GUIDE.md`. Find the section about running the live counter (search for "count.html" or "live counter"). Add a subsection:

```markdown
### Switching modules during a live event

If you're displaying a per-module live counter and the speaker hands off to a new module, you no longer need to close the browser and reopen with a new URL.

1. The header above the counter shows the current module name. It's a dropdown.
2. Click the dropdown and pick the next module — only modules of the **current event** are listed.
3. The count, QR code, and submission URL switch to the new module instantly. Fullscreen, theme, sound, and refresh-interval settings stay as you set them.
4. The browser URL updates to reflect the new module, so refresh / share-link / "send to my other monitor" all keep working.

If a module fails to load (network blip, etc.), the dropdown reverts to the previous selection and a message appears in the header. Try again once the network recovers.

The dropdown only appears in module mode (URL contains `?module=...`). In event-level mode (`?code=...` only), the dropdown is hidden.
```

- [ ] **Step 9.3: ADMIN_SETUP_GUIDE — operator note**

Open `ADMIN_SETUP_GUIDE.md`. Add a brief note in the section that explains running the counter (search for "count.html"):

```markdown
**Tip:** When the counter is in per-module mode, the module name in the header is a dropdown. Click it to switch to a different module of the same event without closing the browser. All display settings (theme, fullscreen, etc.) are preserved.
```

- [ ] **Step 9.4: Docs consistency check**

```bash
grep -l "count.html" /c/Users/dewainr/projects/CATBootcampFeedback/*.md /c/Users/dewainr/projects/CATBootcampFeedback/docs/*.md
```

Expected: shows files we've updated (README, QUICK_START_GUIDE, ADMIN_SETUP_GUIDE) + others touched in Task 10.

---

## Task 10: Update SPECIFICATION, PRIVACY, and DEPLOYMENT-RUNBOOK

**Files:**
- Modify: `SPECIFICATION.md`
- Modify: `PRIVACY.md`
- Modify: `docs/DEPLOYMENT-RUNBOOK.md`

- [ ] **Step 10.1: SPECIFICATION — count screen behavior**

Open `SPECIFICATION.md`. Find the count screen section (search for "count.html" or "live counter"). Add or extend a subsection:

```markdown
### Module switcher (count screen)

When the live counter is opened in per-module mode (URL has `?module=<id>`), the header renders a dropdown of all modules of the current event. Selecting a different module triggers an in-place switch:

- Counter, QR code, and feedback submission URL update to the new module
- Refresh timer continues at the user's chosen interval, now polling the new module's count
- Celebrations are suppressed on the swap itself; they resume for real count deltas after
- Browser URL updates via `history.replaceState` (no new history entry, no reload)
- Theme, sound, refresh interval, celebration level, and fullscreen state are preserved

The dropdown is hidden in event-level mode. Cross-event switching is intentionally not supported on the live screen.

State is held in a single `session` object inside `count.js`; `applySession({eventCode, moduleId})` is the single entry point for both initial load and the switcher.
```

- [ ] **Step 10.2: PRIVACY — scope statement**

Open `PRIVACY.md`. After the "What We DO NOT Collect" section (around line 44), add a new section before "How Data is Used":

```markdown
### Live counter — organizer view

The live counter screen (`count.html`) is an **organizer-facing display**. It shows aggregate feedback counts and a QR code that points submitters to the feedback form. The live counter:

- Does not collect any data about the organizer or any submitter
- Does not use cookies of any kind
- Stores user-display preferences (theme, sound on/off, refresh interval, celebration level) in browser `sessionStorage` only — these are erased when the browser session ends and never sent to a server
- Includes a module switcher that allows the organizer to change which module is displayed without reloading the page; this affects display only and does not introduce any new data collection
```

- [ ] **Step 10.3: DEPLOYMENT-RUNBOOK — note client-side change**

Open `docs/DEPLOYMENT-RUNBOOK.md`. Find the section about `count.html` or client-side deployment (if any). Add a note:

```markdown
**Module switcher (live counter):** This is a client-side-only feature delivered via `count.js` and `count.html`. No backend changes accompany it. Cache-busting on these two files is sufficient for the switcher to roll out.
```

If no count-related section exists, append a short note in the "Recent changes" or "Notes" section. **Do NOT mention Docker** — Docker setup is local-only and not part of the deployment surface.

- [ ] **Step 10.4: PRIVACY — verify final**

Re-read `PRIVACY.md`. Confirm:
- "❌ Session cookies (beyond session management)" line is still accurate (we don't introduce any cookies)
- New section about live counter is consistent with rest of doc
- No claim is made that requires code changes

---

## Task 11: Write the Docker local-testing doc (LOCAL-ONLY — NOT committed)

**Files:**
- Create: `docs/DOCKER-LOCAL-TESTING.md` (will be added to `.gitignore` so it stays uncommitted)

This doc is for the user / future-Claude reference when running the local Docker setup. It is not committed to GitHub — Docker setup is intentionally not part of the public repo surface.

- [ ] **Step 11.1: Create the doc**

Create `docs/DOCKER-LOCAL-TESTING.md`:

```markdown
# Local Testing with Docker

This project ships with a Docker setup for local manual testing — run the static frontend + Azure Functions API in a single container without installing Node, the SWA CLI, or Functions Core Tools on your machine.

## Prerequisites

- Docker Desktop running (Windows / macOS) or `docker` + `docker compose` (Linux)
- Port 4280 free on the host

## Start

From the repo root:

```bash
docker compose up -d
```

The container builds (first run only — takes a couple of minutes) and starts the SWA emulator on port 4280.

Verify:

```bash
docker compose logs --tail=30 cat-bootcamp-local
```

Expect a line like `Azure Static Web Apps emulator started ... http://0.0.0.0:4280`.

## Use

| URL | What it shows |
|-----|---------------|
| `http://localhost:4280/feedback.html?code=CSA1B2C3&module=1` | Submitter feedback form for module 1 |
| `http://localhost:4280/count.html?code=CSA1B2C3` | Live counter — event-level view |
| `http://localhost:4280/count.html?code=CSA1B2C3&module=1` | Live counter — module 1 view (with module switcher dropdown) |
| `http://localhost:4280/count.html?code=TEST123&module=2` | Live counter — second mock event with two modules |
| `http://localhost:4280/admin.html` | Admin panel |

The container runs in **mock-data mode** by default (driven by `config.js` — hostname `localhost` on a non-8080 port triggers `USE_MOCK_DATA = true`). No SQL backend is required for the live-counter / module-switcher flow.

To force a different mode add `?mock=true` or `?mock=false` to any URL.

## Live edits

The repo is volume-mounted into the container. Edits to `count.html`, `count.js`, `feedback.*`, CSS, etc. take effect on browser refresh — no rebuild needed.

If you change `Dockerfile`, `docker-compose.yml`, or anything in `api/package.json`, rebuild:

```bash
docker compose build
docker compose up -d
```

## Module switcher manual test plan

Open `http://localhost:4280/count.html?code=TEST123&module=2` and confirm:

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Page loads | Module 2 view, header dropdown visible with both modules of TEST123 |
| 2 | Switch dropdown to Module 3 | Counter, QR, header update; no confetti/sound on the swap; URL becomes `?code=TEST123&module=3` |
| 3 | Refresh browser | Module 3 view persists |
| 4 | Open `?code=TEST123` (no module) | Event-level view; **no** dropdown |
| 5 | Toggle theme/sound/celebrations, then switch module | Settings preserved across switch |
| 6 | Toggle fullscreen, switch module | Stays in fullscreen, no flicker out |
| 7 | New mock count arrives after switch | Confetti fires for delta *after* the swap, not the swap itself |
| 8 | DevTools → Application → Cookies | Empty for `http://localhost:4280` |
| 9 | Switch module rapidly 5x | No race, no orphaned timers, final state matches last selection |
| 10 | DevTools → Network → Offline → switch module | Header error appears, dropdown reverts |
| 11 | Click QR for switched module → opens feedback.html | Form loads with `&module=<id>` of the switched-to module |

## Stop

```bash
docker compose down
```

## Troubleshooting

- **EADDRINUSE on 4280** — change the host port in `docker-compose.yml` (e.g. `4281:4280`) and use that port in URLs.
- **Mock data not loading** — confirm `USE_MOCK_DATA` is `true`: open DevTools console, then `import('./config.js').then(m => console.log(m.CONFIG.USE_MOCK_DATA))`.
- **"Module not found"** — only mock event codes `CSA1B2C3` (module 1) and `TEST123` (modules 2, 3) are recognized. Anything else returns null.
```

- [ ] **Step 11.2: Verify the doc renders**

```bash
ls -la /c/Users/dewainr/projects/CATBootcampFeedback/docs/DOCKER-LOCAL-TESTING.md
```

Expected: file exists.

---

## Task 12: No-op pre-flight for the existing globals (cleanup decision)

**Files:** none modified — decision-only step.

After Tasks 4-5, the original globals (`eventCode`, `moduleId`, `currentEvent`, `currentModule`, `isModuleMode`, `currentCount`, `isFirstLoad`, `currentRefreshInterval`, `currentTheme`, `celebrationLevel`, `soundEnabled`) may still be **declared** but no longer **read** by the rewritten functions. Removing them is technically optional for the feature.

Decision: **leave them in place** for this PR. The mirror writes from Task 4.4 keep them consistent with `session.settings.*`, and removing them would broaden the diff. A separate cleanup PR can remove them later — note this in the PR description.

- [ ] **Step 12.1: Confirm no functional readers of old globals remain**

Spot-check a few:

```bash
grep -n "isModuleMode\b" count.js
```

Expected: only the declaration line (`let isModuleMode = false;`) and possibly an assignment site. No reads in the new control flow. If reads remain, they are bugs — fix by switching to `session.module !== null`.

```bash
grep -n "\bcurrentCount\b" count.js
```

Expected: only assignment sites (now mirrored to `session.count`). If a read remains in `updateCount()` or its helpers, fix it.

---

## Task 13: Full Docker manual test sweep (Phase A verification)

**Files:** none modified — test-only.

This is the user's Phase A. Run all 11 scenarios from `docs/DOCKER-LOCAL-TESTING.md`. Halt and fix on any failure — do not proceed to Task 14 with any scenario red.

- [ ] **Step 13.1: Restart container clean**

```bash
docker compose down
docker compose up -d --build
docker compose logs --tail=30 cat-bootcamp-local
```

Expected: emulator started on 4280.

- [ ] **Step 13.2: Run scenarios 1-11**

Open each URL listed in the test plan above and verify each row. Tick each one off only after observing the expected behavior.

| # | Pass? |
|---|-------|
| 1 | [ ] |
| 2 | [ ] |
| 3 | [ ] |
| 4 | [ ] |
| 5 | [ ] |
| 6 | [ ] |
| 7 | [ ] |
| 8 | [ ] |
| 9 | [ ] |
| 10 | [ ] |
| 11 | [ ] |

- [ ] **Step 13.3: Re-run cookie verification**

```bash
docker compose exec cat-bootcamp-local sh -c "grep -rn 'document.cookie\|res\.cookie\|req\.cookies' /app --include='*.js' --include='*.html' | grep -v node_modules || echo OK no cookies"
```

Expected: `OK no cookies`.

If all 11 scenarios pass and the cookie check is clean, you may proceed to Task 14. Otherwise, return to the relevant earlier task and fix.

---

## Task 14: Commit and push to feature branch

**Files:** all changes from Tasks 1-12.

Per the user's directive, **no commits or pushes happen before this task**. All preceding tasks left changes in the working tree.

- [ ] **Step 14.1: Sanity-check the working tree**

```bash
git status --short
```

Expected: a list of modified and new files matching the file structure table at the top of this plan, plus the two `docs/superpowers/` files.

- [ ] **Step 14.2: Update `.gitignore` so new local-only files stay local**

Add `Dockerfile`, `.dockerignore`, and `docs/DOCKER-LOCAL-TESTING.md` to `.gitignore`. (`docker-compose.yml` and `docker/` are already there.) Open `.gitignore`, find the existing Docker block (around line 55-57):

```
# Docker local development environment (not for source control)
docker-compose.yml
docker/
```

Replace with:

```
# Docker local development environment (not for source control)
Dockerfile
docker-compose.yml
docker/
.dockerignore

# Docker testing notes (local reference, not committed)
docs/DOCKER-LOCAL-TESTING.md
```

After this, run `git status` and confirm the Docker files no longer appear.

- [ ] **Step 14.3: Stage in two logical groups**

Group A — feature implementation + public docs (single feature commit):

```bash
git add count.js count.html .gitignore \
        README.md QUICK_START_GUIDE.md ADMIN_SETUP_GUIDE.md \
        SPECIFICATION.md PRIVACY.md docs/DEPLOYMENT-RUNBOOK.md
```

```bash
git commit -m "feat(count): add live module switcher with session state container"
```

(Per user memory rule: no Co-Authored-By / Claude attribution in commits.)

Group B — design docs (separate commit so diff history is clean):

```bash
git add docs/superpowers/specs/2026-04-29-module-switcher-design.md \
        docs/superpowers/plans/2026-04-29-module-switcher.md
git commit -m "docs(superpowers): module switcher design + implementation plan"
```

- [ ] **Step 14.4: Verify commit graph**

```bash
git log --oneline -5
```

Expected: two new commits at top, then the previous main HEAD. Critical — also verify Docker files are NOT in either commit:

```bash
git show --stat HEAD~1 HEAD | grep -i docker || echo "OK: no docker files committed"
```

Expected: `OK: no docker files committed`.

- [ ] **Step 14.5: Push the feature branch**

```bash
git push -u origin feature/live-counter-module-switcher
```

Expected: push succeeds. Branch is now visible in GitHub.

---

## Task 15: Open PR

**Files:** none.

- [ ] **Step 15.1: Create PR via gh CLI**

```bash
gh pr create --title "feat(count): live module switcher" --body "$(cat <<'EOF'
## Summary

- Adds a header dropdown on `count.html` that switches between modules of the current event in place. Theme, sound, fullscreen, refresh, and celebration settings are preserved across the switch.
- Refactors `count.js` to a single `session` state container with one `applySession({eventCode, moduleId})` entry point used by both initial load and the dropdown.
- Adds a Docker setup for local manual testing (`docker compose up -d`).
- Updates README, QUICK_START_GUIDE, ADMIN_SETUP_GUIDE, SPECIFICATION, PRIVACY, and DEPLOYMENT-RUNBOOK.

## Privacy / GDPR

This change touches the **organizer view** only (`count.html` / `count.js`). The submitter form (`feedback.html`) and the submission API are unchanged. No new data is collected. No cookies introduced (verified via grep). PRIVACY.md is updated with an explicit note.

## Test plan

- [x] All 11 manual scenarios from `docs/DOCKER-LOCAL-TESTING.md` pass in local Docker
- [x] DevTools → Application → Cookies is empty
- [x] `grep -rn 'document.cookie' .` returns nothing
- [ ] PR CI green
- [ ] Post-merge production verification (your existing flow)

## Notes for reviewer

- Old free-floating globals (`isModuleMode`, `currentCount`, etc.) are no longer read but remain declared. A follow-up cleanup PR can remove them; left here to keep the diff focused.
- Spec and plan: `docs/superpowers/specs/2026-04-29-module-switcher-design.md`, `docs/superpowers/plans/2026-04-29-module-switcher.md`
EOF
)"
```

Expected: PR URL printed. Per user preference (memory: "Always update PR notes after changes"), if anything later changes on the branch, update the PR body with `gh pr edit`.

---

## Out of scope (do NOT do in this plan)

- Cross-event switching from the live screen
- Switching to/from event-level via the dropdown
- Auth changes
- Changes to `feedback.html`, the API surface, or DB schema
- Replacing `sessionStorage` with anything else
- Removing the legacy globals declared at the top of `count.js` (decided in Task 12)
- Adding automated tests (the repo has no test framework; manual Docker is the verification path)

---

## Recovery / abort

If at any point Task 13 reveals a regression that can't be fixed in <30 min, the safe abort is:

```bash
git stash --include-untracked
git switch main
docker compose down
```

The local feature branch and stash remain — you can resume later with `git switch feature/live-counter-module-switcher && git stash pop`. Nothing has been pushed.
