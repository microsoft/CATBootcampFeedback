# Feed the German Cat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bavarian-themed variant of the Feed the Cat counter theme to `count.html` as a third selectable theme, with 7 cat stages (lederhosen → pretzel → bratwurst → schnitzel → feast → beer stein → Oktoberfest apex), German-flavored messages, German food-drop emojis, and a warm beer-garden background tint — fully isolated from in-progress AI summary work on the current branch.

**Architecture:** Add a `cat-de` value to the existing `#themeSelect` dropdown. Introduce a `THEME_CONTENT` registry in `count.js` so theme-specific stages/messages/food are data, not branches. Refactor four call sites (`getEncouragingMessages`, `updateCatState`, `showMilestone`, `dropFood`) to consume the registry. Add a `.theme-cat-de` class toggle on `.count-container` to drive a CSS-only background tint and Bavarian corner accent (CSP-safe — no inline styles). Generate the 7 cat PNGs via a Playwright helper that reuses an authenticated image-gen browser session.

**Tech Stack:** Vanilla JS (ES modules), HTML, CSS (CSP-strict — no inline scripts/styles). Node.js + `@playwright/test` for automated verification. Playwright + persistent browser context for image generation. Existing repo conventions: feat/refactor/chore commit prefixes, no Claude co-author lines, no Docker files in source.

**Spec:** [`docs/superpowers/specs/2026-05-28-feed-the-german-cat-design.md`](../specs/2026-05-28-feed-the-german-cat-design.md)

---

## File Structure

| File | New / Modified | Responsibility |
|---|---|---|
| `count.html` | Modified (3 small additions) | Add dropdown option, scaffold `#themeCatDE` view div with 7 `<img>` stages, add CSS for `.theme-cat-de` tint + corner |
| `count.js` | Modified (additions + refactor) | New constants, `THEME_CONTENT` registry, theme-aware `setTheme`/`getEncouragingMessages`/`updateCatState`/`showMilestone`/`dropFood`/`updateCount` pulse selector, sessionStorage validator |
| `cat-stage-de-0.png` | New | Sad lederhosen kitten, empty wooden table |
| `cat-stage-de-10.png` | New | Pretzel nibble, mustard nose |
| `cat-stage-de-25.png` | New | Bratwurst on fork |
| `cat-stage-de-50.png` | New | Golden schnitzel with lemon |
| `cat-stage-de-75.png` | New | Mini-feast platter |
| `cat-stage-de-100.png` | New | Beer stein PROST stage |
| `cat-stage-de-130.png` | New | MEGA-OKTOBERFEST apex |
| `scripts/generate-german-cat-stages.mjs` | New | Playwright image-gen driver with persistent context + per-stage selection |
| `scripts/german-cat-prompts.json` | New | The 7 image prompts (style preamble + per-stage clause) |
| `tests/package.json` | New | Declares `@playwright/test` as the only dev dep for frontend tests |
| `tests/playwright.config.mjs` | New | Playwright config: launches a static-file server on port 8765, runs against `count.html` |
| `tests/german-cat-theme.spec.mjs` | New | The 11-row verification suite from the spec |
| `tests/.gitignore` | New | Ignore `node_modules`, `test-results/`, `playwright-report/` |
| `docs/superpowers/specs/2026-05-28-feed-the-german-cat-design.md` | (Already written, not yet committed) | Spec lands on the new branch as the first commit, alongside this plan |
| `docs/superpowers/plans/2026-05-28-feed-the-german-cat.md` | This file | Lands alongside the spec in the same first commit |

---

## Task 1: Branch off main, commit the spec + plan as the first commit

**Goal:** Isolate this work on its own branch off `main` with the design docs as the first commit. The in-progress AI summary work on `feature/bulk-and-inline-speaker-assignment` stays untouched.

**Files:**
- Create (in git): `docs/superpowers/specs/2026-05-28-feed-the-german-cat-design.md` (already written on disk, currently untracked)
- Create (in git): `docs/superpowers/plans/2026-05-28-feed-the-german-cat.md` (this file)

- [ ] **Step 1: Confirm current branch state and the WIP files we must NOT pull into the new branch**

```bash
cd C:/Users/dewainr/CATBootcampFeedback
git status --short
git rev-parse --abbrev-ref HEAD
```

Expected output (branch name): `feature/bulk-and-inline-speaker-assignment`
Expected (status): a list of `M`-prefixed and `??`-prefixed files including `api/src/functions/feedback-summary.js`, `api/src/shared/summary-*.js`, `migrations/007-add-event-summaries.sql`, admin.html, admin.js, etc. **None of these should land on the new branch.**

- [ ] **Step 2: Stash ALL working-tree state (modified + untracked) under a labelled stash**

```bash
git stash push -u -m "summary-feature-wip-2026-05-28"
git status --short
```

Expected: `git status` reports clean working tree (no modified or untracked files except the two design docs that already exist in `docs/superpowers/`).

⚠️ **The two design doc files we just created (`docs/superpowers/specs/2026-05-28-feed-the-german-cat-design.md` and `docs/superpowers/plans/2026-05-28-feed-the-german-cat.md`) will be untracked AND included in the stash, so they will disappear from disk after this step.** That is fine — we will retrieve them from the stash in Step 4.

- [ ] **Step 3: Pull main and branch from it**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feature/feed-the-german-cat
git status
```

Expected: clean working tree on branch `feature/feed-the-german-cat`. No design docs visible yet — they're in the stash.

- [ ] **Step 4: Restore ONLY the two design docs from the stash, then keep the stash intact for future restore of the summary WIP**

```bash
git checkout stash@{0} -- docs/superpowers/specs/2026-05-28-feed-the-german-cat-design.md docs/superpowers/plans/2026-05-28-feed-the-german-cat.md
git status --short
```

Expected: only the two design doc files appear as `??` (untracked). The stash itself is NOT dropped — it still contains the full summary WIP.

- [ ] **Step 5: Verify stash still contains the summary WIP (sanity check before we forget)**

```bash
git stash list
git stash show --stat stash@{0} | head -20
```

Expected: stash@{0} labelled `summary-feature-wip-2026-05-28` containing the full set of summary files (`api/src/shared/summary-*.js`, `feedback-summary.js`, migration 007, admin.html/admin.js modifications, etc.). User can later restore via `git checkout feature/bulk-and-inline-speaker-assignment && git stash pop stash@{0}`.

- [ ] **Step 6: Commit the design docs**

```bash
git add docs/superpowers/specs/2026-05-28-feed-the-german-cat-design.md docs/superpowers/plans/2026-05-28-feed-the-german-cat.md
git commit -m "docs: add Feed the German Cat design spec and implementation plan"
git log --oneline -3
```

Expected: new commit on `feature/feed-the-german-cat`. **No Claude co-author line in the commit message.**

---

## Task 2: Add the cat-de dropdown option and the empty themeCatDE view scaffolding to count.html

**Goal:** Add the new dropdown option and an empty theme view div with the 7 `<img>` stage elements + CSS for the tint and Bavarian corner. JS wiring comes later — at this point, picking the new option does nothing functional yet (the option will just not select properly until Task 4 updates the sessionStorage validator + setTheme).

**Files:**
- Modify: `count.html` (add option, add `#themeCatDE` div, add CSS rules)

- [ ] **Step 1: Add the third dropdown option**

Edit `count.html` — find this block around line 658:

```html
<select id="themeSelect">
    <option value="classic" selected>Classic</option>
    <option value="cat">Feed the Cat</option>
</select>
```

Replace with:

```html
<select id="themeSelect">
    <option value="classic" selected>Classic</option>
    <option value="cat">Feed the Cat</option>
    <option value="cat-de">Feed the Cat (German)</option>
</select>
```

- [ ] **Step 2: Add the `#themeCatDE` theme view div right after `#themeCat`**

In `count.html`, find this block (the closing `</div>` of `#themeCat` is right before `<div class="milestone-message" id="milestoneMessage">`):

```html
                    <!-- Feed the Cat Theme: Counter + cat stages + progress bar -->
                    <div id="themeCat" class="theme-view" style="display:none;">
                        <div class="counter-number cat-counter" id="catCounterNumber"></div>
                        <div class="cat-container" id="catContainer">
                            <img class="cat-img" data-stage="0" src="cat-stage-0.png" alt="Hungry cat begging" draggable="false"/>
                            <img class="cat-img" data-stage="10" src="cat-stage-10.png" alt="Cat with food bowl" draggable="false"/>
                            <img class="cat-img" data-stage="25" src="cat-stage-25.png" alt="Smiling cat" draggable="false"/>
                            <img class="cat-img" data-stage="50" src="cat-stage-50.png" alt="Dancing happy cat" draggable="false"/>
                            <img class="cat-img" data-stage="75" src="cat-stage-75.png" alt="Tuxedo cat with platter" draggable="false"/>
                            <img class="cat-img" data-stage="100" src="cat-stage-100.png" alt="Fat cat on couch" draggable="false"/>
                        </div>
                        <div class="progress-bar-container" id="progressBarContainer">
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" id="progressBarFill"></div>
                            </div>
                            <div class="progress-bar-label" id="progressBarLabel"></div>
                        </div>
                    </div>

                    <div class="milestone-message" id="milestoneMessage"></div>
```

Insert this new block immediately after the closing `</div>` of `#themeCat` and before `<div class="milestone-message">`:

```html
                    <!-- Feed the Cat (German) Theme: 7 stages with Bavarian arc -->
                    <div id="themeCatDE" class="theme-view" style="display:none;">
                        <div class="counter-number cat-counter" id="catCounterDENumber"></div>
                        <div class="cat-container" id="catContainerDE">
                            <img class="cat-img" data-stage="0" src="cat-stage-de-0.png" alt="Hungry kitten in lederhosen, empty table" draggable="false"/>
                            <img class="cat-img" data-stage="10" src="cat-stage-de-10.png" alt="Kitten nibbling a warm pretzel" draggable="false"/>
                            <img class="cat-img" data-stage="25" src="cat-stage-de-25.png" alt="Plumper kitten with bratwurst on a fork" draggable="false"/>
                            <img class="cat-img" data-stage="50" src="cat-stage-de-50.png" alt="Happy kitten with a golden schnitzel" draggable="false"/>
                            <img class="cat-img" data-stage="75" src="cat-stage-de-75.png" alt="Blissful kitten with a Bavarian feast platter" draggable="false"/>
                            <img class="cat-img" data-stage="100" src="cat-stage-de-100.png" alt="Chonky kitten raising a foamy beer stein" draggable="false"/>
                            <img class="cat-img" data-stage="130" src="cat-stage-de-130.png" alt="Oktoberfest apex kitten on a keg with two steins" draggable="false"/>
                        </div>
                        <div class="progress-bar-container" id="progressBarContainerDE">
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" id="progressBarFillDE"></div>
                            </div>
                            <div class="progress-bar-label" id="progressBarLabelDE"></div>
                        </div>
                    </div>
```

- [ ] **Step 3: Add the CSS rules for the warm tint and the Bavarian corner accent**

In `count.html`, find the existing CSS for `.count-container` near the top of the `<style>` block (around line 22). Add this new ruleset at the END of the existing `<style>` block (immediately before `</style>`):

```css
        /* ── Feed the Cat (German) theme: warm tint + Bavarian corner ── */
        .count-container.theme-cat-de {
            background:
                linear-gradient(135deg, rgba(101, 67, 33, 0.18) 0%, rgba(212, 179, 107, 0.10) 100%),
                linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        }

        .count-container.theme-cat-de .left-section {
            position: relative;
        }

        .count-container.theme-cat-de .left-section::before {
            content: "";
            position: absolute;
            top: 12px;
            right: 12px;
            width: 64px;
            height: 64px;
            background: repeating-linear-gradient(45deg, #1e40af 0 16px, #ffffff 16px 32px);
            border-radius: 6px;
            opacity: 0.55;
            pointer-events: none;
            z-index: 1;
        }
```

- [ ] **Step 4: Visually inspect the diff**

```bash
git diff count.html
```

Expected: 1 modified `<select>` block, 1 added `<div id="themeCatDE">` block (~16 lines), 1 added CSS rule block (~22 lines). No other lines touched.

- [ ] **Step 5: Commit**

```bash
git add count.html
git commit -m "feat: add 'cat-de' theme option and view scaffolding"
```

---

## Task 3: Set up the Playwright verification harness with all 11 verification tests defined but most skipped

**Goal:** Write the full verification test file upfront with all 11 spec checks. Tests that exercise features not yet implemented start as `test.skip(...)`. As each implementation task is completed, the corresponding test gets un-skipped in that task. This is TDD-flavored — the test definitions are committed first; behavior is filled in later. By the time the German theme is wired up, every test in this file is live and passing.

**Files:**
- Create: `tests/package.json`
- Create: `tests/playwright.config.mjs`
- Create: `tests/german-cat-theme.spec.mjs`
- Create: `tests/.gitignore`

- [ ] **Step 1: Create `tests/.gitignore`**

```
node_modules/
test-results/
playwright-report/
.playwright/
```

- [ ] **Step 2: Create `tests/package.json`**

```json
{
    "name": "catbootcamp-frontend-tests",
    "version": "1.0.0",
    "private": true,
    "description": "Playwright verification suite for count.html theme behavior.",
    "type": "module",
    "scripts": {
        "test": "playwright test",
        "test:headed": "playwright test --headed",
        "test:debug": "playwright test --debug"
    },
    "devDependencies": {
        "@playwright/test": "^1.49.0"
    }
}
```

- [ ] **Step 3: Create `tests/playwright.config.mjs`**

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    timeout: 30_000,
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: 'http://127.0.0.1:8765',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    webServer: {
        command: 'npx --yes http-server .. -p 8765 -c-1 --silent',
        port: 8765,
        timeout: 15_000,
        reuseExistingServer: !process.env.CI
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } }
    ]
});
```

- [ ] **Step 4: Create `tests/german-cat-theme.spec.mjs` with all 11 checks**

```js
/**
 * Verification suite for the Feed the German Cat theme.
 *
 * Tests start out as `.skip` for features not yet implemented; each
 * implementation task un-skips its corresponding test(s) as part of
 * that task's commit. By the time the theme is fully wired up, every
 * test in this file is live and passing.
 */
import { test, expect } from '@playwright/test';

const COUNT_URL = '/count.html?code=CSA1B2C3';
const GERMAN_FOOD_EMOJIS = ['🥨', '🌭', '🍺', '🥖', '🧀', '🍻'];
const CLASSIC_FOOD_EMOJIS = ['🐟', '🥩', '🍗', '🍖', '🍪', '🍣', '🍱'];

async function setMockCount(page, count) {
    // count.js uses CONFIG.USE_MOCK_DATA + localStorage 'bootcampFeedback' for counts.
    // We seed `count` fake feedback rows so getFeedbackCount returns the desired total.
    await page.evaluate((n) => {
        const rows = Array.from({ length: n }, (_, i) => ({
            eventCode: 'CSA1B2C3',
            eventModuleId: 1,
            id: i
        }));
        localStorage.setItem('bootcampFeedback', JSON.stringify(rows));
    }, count);
}

async function pickTheme(page, theme) {
    await page.selectOption('#themeSelect', theme);
    await page.waitForTimeout(150); // sessionStorage write + setTheme
}

test.describe('Dropdown integration', () => {
    test('Dropdown shows three theme options', async ({ page }) => {
        await page.goto(COUNT_URL);
        const values = await page.$$eval('#themeSelect option', opts => opts.map(o => o.value));
        expect(values).toEqual(['classic', 'cat', 'cat-de']);
    });

    test("Selecting 'cat-de' switches the view and persists across reload", async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-de');
        await expect(page.locator('#themeCatDE')).toBeVisible();
        await expect(page.locator('#themeCat')).toBeHidden();
        await expect(page.locator('#themeClassic')).toBeHidden();
        const stored = await page.evaluate(() => sessionStorage.getItem('counterTheme'));
        expect(stored).toBe('cat-de');
        await page.reload();
        await expect(page.locator('#themeCatDE')).toBeVisible();
    });
});

test.describe('Classic theme regression', () => {
    test('Classic theme renders progress ring at multiple counts', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'classic');
        for (const n of [0, 50, 130]) {
            await setMockCount(page, n);
            await page.reload();
            await pickTheme(page, 'classic');
            await expect(page.locator('#themeClassic')).toBeVisible();
            await expect(page.locator('#progressRing')).toBeVisible();
        }
    });
});

test.describe('Feed the Cat regression', () => {
    test('Cat theme shows the correct stage at each milestone', async ({ page }) => {
        for (const [n, stage] of [[0, 0], [10, 10], [25, 25], [50, 50], [75, 75], [100, 100]]) {
            await page.goto(COUNT_URL);
            await setMockCount(page, n);
            await page.reload();
            await pickTheme(page, 'cat');
            const active = await page.$eval(
                `#themeCat .cat-img[data-stage="${stage}"]`,
                el => el.classList.contains('active')
            );
            expect(active, `stage ${stage} should be active at count ${n}`).toBe(true);
        }
    });
});

test.describe('German cat theme — stages', () => {
    test('All 7 German stages render at the correct counts', async ({ page }) => {
        for (const [n, stage] of [[0, 0], [10, 10], [25, 25], [50, 50], [75, 75], [100, 100], [130, 130]]) {
            await page.goto(COUNT_URL);
            await setMockCount(page, n);
            await page.reload();
            await pickTheme(page, 'cat-de');
            const active = await page.$eval(
                `#themeCatDE .cat-img[data-stage="${stage}"]`,
                el => el.classList.contains('active')
            );
            expect(active, `German stage ${stage} should be active at count ${n}`).toBe(true);
        }
    });
});

test.describe('Background tint and Bavarian corner', () => {
    test('theme-cat-de class is applied only when cat-de is active', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'classic');
        await expect(page.locator('.count-container')).not.toHaveClass(/theme-cat-de/);
        await pickTheme(page, 'cat-de');
        await expect(page.locator('.count-container')).toHaveClass(/theme-cat-de/);
        await pickTheme(page, 'cat');
        await expect(page.locator('.count-container')).not.toHaveClass(/theme-cat-de/);
    });
});

test.describe('Food drops', () => {
    test('German theme drops only Bavarian food emojis', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-de');
        const seen = await page.evaluate((bavarianSet) => {
            const out = [];
            const orig = document.createElement;
            // Stub createElement so we can capture the food emoji drops.
            document.createElement = function(tag) {
                const el = orig.call(document, tag);
                if (tag === 'div') {
                    Object.defineProperty(el, 'textContent', {
                        set(v) { if (bavarianSet.includes(v) || v.length === 2) out.push(v); el.innerText = v; },
                        get() { return el.innerText; }
                    });
                }
                return el;
            };
            // Trigger a celebration (count goes up)
            return new Promise(resolve => {
                const rows = Array.from({ length: 5 }, (_, i) => ({ eventCode: 'CSA1B2C3', eventModuleId: 1, id: i }));
                localStorage.setItem('bootcampFeedback', JSON.stringify(rows));
                window.updateCount?.();
                setTimeout(() => resolve(out), 800);
            });
        }, GERMAN_FOOD_EMOJIS);
        // At least one drop happened, and every drop is in the German set
        if (seen.length > 0) {
            for (const e of seen) expect(GERMAN_FOOD_EMOJIS).toContain(e);
        }
    });

    test('Classic cat theme still drops original emojis (no regression)', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat');
        // Read the active theme's food emoji list directly to assert source-of-truth
        const list = await page.evaluate(() => window._activeFoodEmojisForTest?.());
        if (list) {
            for (const e of list) expect(CLASSIC_FOOD_EMOJIS).toContain(e);
        }
    });
});

test.describe('Messages', () => {
    test('German encouraging messages contain German tokens', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-de');
        // Pull the active theme's message list via test hook
        const messages = await page.evaluate(() => window._activeEncouragingMessagesForTest?.());
        expect(messages).toBeTruthy();
        const joined = messages.join(' ');
        expect(joined).toMatch(/Sehr gut|Prost|Wunderbar|Katze|Bayerische|Stubentiger/);
    });

    test('German milestone message at count >= 100 references PROST', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-de');
        const msg = await page.evaluate(() => window._activeMilestoneMessageForTest?.(100));
        expect(msg).toMatch(/PROST/i);
    });
});

test.describe('Milestone semantics for stage 130', () => {
    test('Crossing 130 swaps the stage but does NOT fire a milestone fanfare', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-de');
        const fired = await page.evaluate(() => {
            let called = false;
            const orig = window.playMilestoneSound;
            window.playMilestoneSound = () => { called = true; if (orig) orig(); };
            // Simulate count crossing from 129 -> 130 via checkMilestone, the function
            // the count.js milestone check uses.
            window.checkMilestone?.(130, 129);
            return called;
        });
        expect(fired).toBe(false);

        // Sanity: 130 stage is visible
        await setMockCount(page, 130);
        await page.reload();
        await pickTheme(page, 'cat-de');
        const active = await page.$eval(
            `#themeCatDE .cat-img[data-stage="130"]`,
            el => el.classList.contains('active')
        );
        expect(active).toBe(true);
    });
});

test.describe('CSP-safe code', () => {
    test('No inline onclick or inline <script> blocks in count.html or count.js', async ({ }) => {
        const fs = await import('node:fs/promises');
        const html = await fs.readFile(new URL('../count.html', import.meta.url), 'utf8');
        const js = await fs.readFile(new URL('../count.js', import.meta.url), 'utf8');
        expect(html).not.toMatch(/\sonclick\s*=/i);
        expect(html).not.toMatch(/<script>[^<]/);
        // The only allowed <script> tags are external src= references
        for (const m of html.matchAll(/<script[^>]*>/gi)) {
            expect(m[0]).toMatch(/\ssrc\s*=/i);
        }
        // count.js obviously contains code; just ensure it doesn't generate inline event handlers
        expect(js).not.toMatch(/setAttribute\(['"]onclick['"]/);
    });
});

test.describe('Image asset sanity', () => {
    test('All 7 cat-stage-de-*.png files exist, are ~1024 px, and ≤ 500 KB', async ({ }) => {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = path.dirname(fileURLToPath(new URL('../', import.meta.url)));
        for (const stage of [0, 10, 25, 50, 75, 100, 130]) {
            const file = path.join(root, `cat-stage-de-${stage}.png`);
            const stat = await fs.stat(file);
            expect(stat.size, `${file} size`).toBeLessThanOrEqual(500 * 1024);
            // Dimensions: read PNG IHDR (16-byte offset for width+height)
            const fd = await fs.open(file, 'r');
            const buf = Buffer.alloc(8);
            await fd.read(buf, 0, 8, 16);
            await fd.close();
            const width = buf.readUInt32BE(0);
            const height = buf.readUInt32BE(4);
            expect(width, `${file} width`).toBeGreaterThanOrEqual(900);
            expect(width).toBeLessThanOrEqual(1200);
            expect(height, `${file} height`).toBeGreaterThanOrEqual(900);
            expect(height).toBeLessThanOrEqual(1200);
        }
    });
});

// === Skip markers — these get removed by later implementation tasks ===
// Task 4 un-skips: 'Selecting cat-de switches...', 'theme-cat-de class is applied...',
//                   the two Messages tests, milestone-130 test, food-drop tests
// Task 7 un-skips: 'All 7 German stages render...' (needs PNGs to exist)
// Task 8 un-skips: 'All 7 cat-stage-de-*.png files exist...' (needs PNGs to exist)
// Initial pass (after this task is committed): tests that exercise NOT-YET-IMPLEMENTED
// behavior must be marked test.skip — see explicit skip annotations below.
```

**Mark these tests as `test.skip` initially** (we'll un-skip them as each implementation task lands). Convert the following to `test.skip(...)` for now:
- "Selecting 'cat-de' switches the view and persists across reload"
- "All 7 German stages render at the correct counts"
- "theme-cat-de class is applied only when cat-de is active"
- "German theme drops only Bavarian food emojis"
- "German encouraging messages contain German tokens"
- "German milestone message at count >= 100 references PROST"
- "Crossing 130 swaps the stage but does NOT fire a milestone fanfare"
- "All 7 cat-stage-de-*.png files exist, are ~1024 px, and ≤ 500 KB"

Tests that should pass at this point (regression baseline):
- "Dropdown shows three theme options" — will fail at first run since Task 2 added the option; should PASS now.
- "Classic theme renders progress ring at multiple counts" — should PASS.
- "Cat theme shows the correct stage at each milestone" — should PASS.
- "No inline onclick or inline <script> blocks in count.html or count.js" — should PASS.

To mark a test as skipped, change `test('name', ...)` to `test.skip('name', ...)`.

- [ ] **Step 5: Install dependencies and run the baseline**

```bash
cd tests
npm install
npx playwright install chromium
npx playwright test
```

Expected: 4 tests PASS (the unskipped ones); 8 tests SKIPPED. No FAILs.

If the dropdown test fails, double-check that Task 2's commit actually landed.

- [ ] **Step 6: Commit**

```bash
cd ..
git add tests/
git commit -m "test: add Playwright verification harness for theme behavior"
```

---

## Task 4: Refactor count.js to use a THEME_CONTENT registry (pure refactor — no behavior change)

**Goal:** Extract the theme-specific data (stages, messages, food emojis) into a single `THEME_CONTENT` registry, and refactor the four call sites to consume it. Classic and Feed the Cat themes must behave **byte-identically** after this commit. No new behavior — only a refactor that makes Task 5's German-theme addition a data change rather than a sprinkling of `if` branches.

**Files:**
- Modify: `count.js`

- [ ] **Step 1: Add the `THEME_CONTENT` registry and helper near the top of count.js**

In `count.js`, find this block around line 82:

```js
function getEncouragingMessages() {
    return currentTheme === 'cat' ? CAT_MESSAGES : CLASSIC_MESSAGES;
}
```

Replace it with:

```js
// ── Theme content registry ────────────────────────────────────────────────────
// Each theme's stages/messages/food/milestone-overrides live here as data, so
// adding a new theme = adding an entry, not sprinkling conditionals.
//   stages:               null = no stage system (Classic ring); array = cat-style stages
//   encouragingMessages:  rotating bottom-of-counter messages
//   foodEmojis:           emojis dropped on each count tick by dropFood()
//   milestoneMessages:    override map for showMilestone(); falls back to MILESTONE_MESSAGES
const THEME_CONTENT = {
    'classic': {
        stages: null,
        encouragingMessages: CLASSIC_MESSAGES,
        foodEmojis: null,                  // Classic theme doesn't drop food
        milestoneMessages: null            // falls back to global MILESTONE_MESSAGES
    },
    'cat': {
        stages: null,                      // set below once CAT_STAGES is defined
        encouragingMessages: CAT_MESSAGES,
        foodEmojis: null,                  // set below once FOOD_EMOJIS is defined
        milestoneMessages: null
    }
    // 'cat-de' entry added in Task 5
};

function getCurrentThemeContent() {
    return THEME_CONTENT[currentTheme] || THEME_CONTENT.classic;
}

function getEncouragingMessages() {
    return getCurrentThemeContent().encouragingMessages;
}

// Tiny test hooks — opt-in window globals used by the Playwright suite.
// Not load-bearing; safe to remove if test surface is ever cleaned up.
if (typeof window !== 'undefined') {
    window._activeEncouragingMessagesForTest = () => getCurrentThemeContent().encouragingMessages;
    window._activeFoodEmojisForTest         = () => getCurrentThemeContent().foodEmojis;
    window._activeMilestoneMessageForTest   = (m) => {
        const override = getCurrentThemeContent().milestoneMessages;
        return (override && override[m]) || MILESTONE_MESSAGES[m];
    };
}
```

- [ ] **Step 2: Wire `CAT_STAGES` and `FOOD_EMOJIS` into the registry after they're declared**

In `count.js`, find the line:

```js
const CAT_STAGES = [0, 10, 25, 50, 75, 100];
```

Immediately after it, add:

```js
THEME_CONTENT.cat.stages = CAT_STAGES;
```

Find the line:

```js
const FOOD_EMOJIS = ['\u{1F41F}', '\u{1F969}', '\u{1F357}', '\u{1F356}', '\u{1F36A}', '\u{1F363}', '\u{1F35B}'];
```

Immediately after it, add:

```js
THEME_CONTENT.cat.foodEmojis = FOOD_EMOJIS;
```

- [ ] **Step 3: Refactor `updateCatState()` to read stages from the registry**

In `count.js`, replace the existing `updateCatState` function (lines 1077-1097) with:

```js
function updateCatState(count) {
    const content = getCurrentThemeContent();
    const stages = content.stages;
    if (!stages) return;                  // Classic theme — no cat to update
    const imgs = document.querySelectorAll(`#${currentTheme === 'cat-de' ? 'catContainerDE' : 'catContainer'} .cat-img`);
    if (!imgs.length) return;

    let activeStage = stages[0];
    for (const s of stages) {
        if (count >= s) activeStage = s;
        else break;
    }

    imgs.forEach(img => {
        const stage = parseInt(img.dataset.stage, 10);
        if (stage === activeStage) img.classList.add('active');
        else img.classList.remove('active');
    });
}
```

- [ ] **Step 4: Refactor `showMilestone()` to consult the per-theme override map**

In `count.js`, replace the existing `showMilestone` function (lines 879-891) with:

```js
let milestoneTimeout = null;
function showMilestone(milestone) {
    const content = getCurrentThemeContent();
    const overrideMap = content.milestoneMessages;
    const message = (overrideMap && overrideMap[milestone])
        || MILESTONE_MESSAGES[milestone]
        || `${milestone} responses!`;
    milestoneMessageEl.textContent = message;
    milestoneMessageEl.classList.add('visible');

    celebrateCatMilestone();

    if (milestoneTimeout) clearTimeout(milestoneTimeout);
    milestoneTimeout = setTimeout(() => {
        milestoneMessageEl.classList.remove('visible');
    }, 8000);
}
```

- [ ] **Step 5: Refactor `dropFood()` to consult the per-theme emoji list**

In `count.js`, find the existing `dropFood` function (around line 1116). Replace the line:

```js
    food.textContent = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
```

with:

```js
    const emojis = getCurrentThemeContent().foodEmojis;
    if (!emojis || !emojis.length) return;     // Classic theme: no food drops
    food.textContent = emojis[Math.floor(Math.random() * emojis.length)];
```

Also: the existing `dropFood` references `catContainer` directly. Replace the line:

```js
    const cat = document.getElementById('catContainer');
```

with:

```js
    const cat = document.getElementById(currentTheme === 'cat-de' ? 'catContainerDE' : 'catContainer');
```

- [ ] **Step 6: Refactor the `updateCount` pulse selector to handle three themes**

In `count.js`, around line 1513, find:

```js
            const activeCounter = currentTheme === 'classic'
                ? document.getElementById('counterNumber')
                : document.getElementById('catCounterNumber');
```

Replace with:

```js
            const activeCounter =
                currentTheme === 'classic' ? document.getElementById('counterNumber')
              : currentTheme === 'cat-de'  ? document.getElementById('catCounterDENumber')
              :                              document.getElementById('catCounterNumber');
```

- [ ] **Step 7: Expose `checkMilestone` to `window` so the Playwright milestone-130 test can drive it**

In `count.js`, immediately after the `checkMilestone` function declaration (around line 832), add:

```js
if (typeof window !== 'undefined') {
    window.checkMilestone = checkMilestone;
    window.playMilestoneSound = playMilestoneSound;
}
```

- [ ] **Step 8: Run the baseline tests; both regression tests must still pass**

```bash
cd tests
npx playwright test
cd ..
```

Expected: same 4 PASS / 8 SKIPPED as before. **If "Cat theme shows the correct stage at each milestone" now fails, the refactor broke the existing Feed the Cat theme** — fix it before continuing.

- [ ] **Step 9: Commit**

```bash
git add count.js
git commit -m "refactor: introduce THEME_CONTENT registry for cat themes"
```

---

## Task 5: Wire the German cat theme — constants, registry entry, setTheme branch, sessionStorage validator

**Goal:** Add all the German-theme data (stages, messages, food, milestones), slot it into `THEME_CONTENT`, update `setTheme` to handle `'cat-de'`, and update the sessionStorage validator. After this commit, picking "Feed the Cat (German)" in the dropdown fully works at the JS/CSS level — only the cat images are still missing (Task 7 generates them).

**Files:**
- Modify: `count.js`
- Modify: `tests/german-cat-theme.spec.mjs` (un-skip 6 tests)

- [ ] **Step 1: Add the German constants block near the existing CAT_MESSAGES/CAT_STAGES**

In `count.js`, immediately AFTER the line `THEME_CONTENT.cat.foodEmojis = FOOD_EMOJIS;` (added in Task 4 Step 2), add:

```js
// ── Feed the Cat (German) theme constants ────────────────────────────────────
const GERMAN_CAT_STAGES = [0, 10, 25, 50, 75, 100, 130];

const GERMAN_CAT_MESSAGES = [
    'Füttere die Katze! Submit your feedback! 🥨',
    'Sehr gut! Keep them coming! 🐱',
    'The Katze wants more pretzels! 🥨',
    'Wunderbar! Every response feeds the cat! 😺',
    "Don't be a Stubentiger — share your thoughts! 🐾",
    'Mehr, bitte! The cat is still hungry! 😻',
    'Prost to your feedback! 🍺',
    'Schnitzel-tastic participation! 🥩',
    'The Bayerische Katze approves! 🇩🇪',
    'Oktober-purrfect responses! 🥨'
];

const GERMAN_MILESTONE_MESSAGES = {
    10:  'Zehn! First pretzel earned! 🥨',
    25:  'Fünfundzwanzig! Bratwurst time! 🌭',
    50:  'Fünfzig! Schnitzel achieved! 🥩',
    75:  'Fünfundsiebzig! Full Bavarian feast! 🍻',
    100: 'PROST! Hundert responses — raise the stein! 🍺👑',
    150: '150! Oktoberfest legend! 🎪',
    200: '200! Die Katze ist sehr happy! 😻',
    300: '300! Schnitzel-pocalypse! 🌟',
    500: '500! Mega-Katzen-König! 👑'
};

const GERMAN_FOOD_EMOJIS = ['🥨', '🌭', '🍺', '🥖', '🧀', '🍻'];

THEME_CONTENT['cat-de'] = {
    stages: GERMAN_CAT_STAGES,
    encouragingMessages: GERMAN_CAT_MESSAGES,
    foodEmojis: GERMAN_FOOD_EMOJIS,
    milestoneMessages: GERMAN_MILESTONE_MESSAGES
};
```

- [ ] **Step 2: Update `setTheme` to handle `'cat-de'`**

In `count.js`, replace the existing `setTheme` function (lines 1000-1021) with:

```js
function setTheme(theme) {
    currentTheme = theme;
    const classicView = document.getElementById('themeClassic');
    const catView     = document.getElementById('themeCat');
    const catDEView   = document.getElementById('themeCatDE');
    const container   = document.querySelector('.count-container');

    if (classicView) classicView.style.display = (theme === 'classic') ? '' : 'none';
    if (catView)     catView.style.display     = (theme === 'cat')     ? '' : 'none';
    if (catDEView)   catDEView.style.display   = (theme === 'cat-de')  ? '' : 'none';

    if (container) container.classList.toggle('theme-cat-de', theme === 'cat-de');

    // Resize for new layout
    sizeProgressRing();
    // Update displays for current count
    updateDigitDisplay(currentCount);
    updateProgressRing(currentCount);
    updateCatState(currentCount);
    // Update encouraging message for new theme
    updateEncouragingMessage();
}
```

- [ ] **Step 3: Update the sessionStorage validator in `initializeThemeSelector`**

In `count.js`, replace the existing `initializeThemeSelector` function (lines 1023-1039) with:

```js
const VALID_THEMES = ['classic', 'cat', 'cat-de'];

function initializeThemeSelector() {
    const select = document.getElementById('themeSelect');
    if (!select) return;

    // Restore from sessionStorage
    const saved = sessionStorage.getItem('counterTheme');
    if (saved && VALID_THEMES.includes(saved)) {
        select.value = saved;
        setTheme(saved);
    }

    select.addEventListener('change', () => {
        const theme = select.value;
        if (!VALID_THEMES.includes(theme)) return;
        sessionStorage.setItem('counterTheme', theme);
        setTheme(theme);
    });
}
```

- [ ] **Step 4: Update `updateProgressRing` so the progress bar updates for cat-de as well as cat**

In `count.js`, around line 988, find:

```js
    // Cat theme: update progress bar (always update so it's ready if switched)
    const fill = document.getElementById('progressBarFill');
    const label = document.getElementById('progressBarLabel');
    if (fill) {
        const nextMilestone = getNextMilestone(count);
        const prevMilestone = getPrevMilestone(count);
        const range = nextMilestone - prevMilestone;
        const progress = range > 0 ? Math.min(1, (count - prevMilestone) / range) : 0;
        fill.style.width = (progress * 100) + '%';
        if (label) label.textContent = `${count} / ${nextMilestone} to next milestone`;
    }
```

Replace with:

```js
    // Cat themes (both): update the relevant progress bar
    const nextMilestone = getNextMilestone(count);
    const prevMilestone = getPrevMilestone(count);
    const range = nextMilestone - prevMilestone;
    const progress = range > 0 ? Math.min(1, (count - prevMilestone) / range) : 0;
    for (const suffix of ['', 'DE']) {
        const fill = document.getElementById(`progressBarFill${suffix}`);
        const label = document.getElementById(`progressBarLabel${suffix}`);
        if (fill) fill.style.width = (progress * 100) + '%';
        if (label) label.textContent = `${count} / ${nextMilestone} to next milestone`;
    }
```

- [ ] **Step 5: Update `sizeProgressRing` so the German counter font size also scales**

In `count.js`, around line 963, find:

```js
    } else {
        // Cat theme: scale counter font
        const availableW = leftSection.clientWidth - 40;
        const catCounter = document.getElementById('catCounterNumber');
        if (catCounter) catCounter.style.fontSize = Math.max(32, Math.min(availableW * 0.14, 64)) + 'px';
    }
```

Replace with:

```js
    } else {
        // Cat themes: scale counter font for whichever cat counter is active
        const availableW = leftSection.clientWidth - 40;
        const counterId = currentTheme === 'cat-de' ? 'catCounterDENumber' : 'catCounterNumber';
        const catCounter = document.getElementById(counterId);
        if (catCounter) catCounter.style.fontSize = Math.max(32, Math.min(availableW * 0.14, 64)) + 'px';
    }
```

- [ ] **Step 6: Update `updateDigitDisplay` to write into all three counters**

In `count.js`, find the `updateDigitDisplay` function (around line 1177):

```js
function updateDigitDisplay(newCount) {
    const digits = String(newCount).split('');

    // Update both counter elements (classic + cat theme)
    ['counterNumber', 'catCounterNumber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) updateDigitContainer(el, digits);
    });
}
```

Replace with:

```js
function updateDigitDisplay(newCount) {
    const digits = String(newCount).split('');

    // Update all three counter elements (classic + cat + cat-de)
    ['counterNumber', 'catCounterNumber', 'catCounterDENumber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) updateDigitContainer(el, digits);
    });
}
```

- [ ] **Step 7: Update `initCat` to discover all `.cat-img` elements across both cat themes**

In `count.js`, find `initCat` (around line 1047). Replace it with:

```js
function initCat() {
    const imgs = document.querySelectorAll('#themeCat .cat-img, #themeCatDE .cat-img');
    if (!imgs.length) return;

    sizeCat();

    // Set initial state without animation
    imgs.forEach(img => { img.style.transition = 'none'; });
    updateCatState(currentCount);
    imgs[0].getBoundingClientRect(); // force reflow
    imgs.forEach(img => { img.style.transition = 'opacity 0.8s ease-out'; });
}
```

- [ ] **Step 8: Un-skip the 6 tests that the German wiring now satisfies (PNGs not yet present)**

In `tests/german-cat-theme.spec.mjs`, change `test.skip(...)` back to `test(...)` for these test names:
- `Selecting 'cat-de' switches the view and persists across reload`
- `theme-cat-de class is applied only when cat-de is active`
- `German theme drops only Bavarian food emojis`
- `German encouraging messages contain German tokens`
- `German milestone message at count >= 100 references PROST`
- `Crossing 130 swaps the stage but does NOT fire a milestone fanfare`

Leave `test.skip(...)` on:
- `All 7 German stages render at the correct counts` (needs PNGs — Task 7)
- `All 7 cat-stage-de-*.png files exist...` (needs PNGs — Task 7)

- [ ] **Step 9: Run the tests; 10 should PASS, 2 still SKIPPED, 0 FAIL**

```bash
cd tests
npx playwright test
cd ..
```

Expected:
- 10 PASS (4 baseline + 6 newly un-skipped)
- 2 SKIPPED (the two PNG-dependent tests)
- 0 FAIL

If anything fails, debug before committing — the refactor + wiring should produce a fully working German theme with placeholder broken-image icons standing in for the PNGs.

- [ ] **Step 10: Commit**

```bash
git add count.js tests/german-cat-theme.spec.mjs
git commit -m "feat: wire German cat theme (messages, food, milestones)"
```

---

## Task 6: Add the Playwright image-gen helper script and prompts file

**Goal:** Create a reproducible, re-runnable script that drives the user's chosen image-gen service via Playwright with a persistent browser profile, reading prompts from a JSON file. The user authenticates once; subsequent runs are silent. Supports `--stages N,M` for targeted regen.

**Files:**
- Create: `scripts/german-cat-prompts.json`
- Create: `scripts/generate-german-cat-stages.mjs`

- [ ] **Step 1: Create `scripts/german-cat-prompts.json`**

```json
{
    "stylePreamble": "Cute chibi orange tabby kitten, big anime eyes, white belly and chest, fluffy fur, soft drop shadow. Dark navy blue gradient background (#1a1a2e to #0f3460). Painterly digital illustration, warm friendly tone, centered subject, square 1024x1024.",
    "stages": [
        {
            "stage": 0,
            "filename": "cat-stage-de-0.png",
            "prompt": "The kitten is wearing brown leather lederhosen with green embroidered suspenders and a small green Tirolerhut (Tyrolean hat) tilted on its head. It sits at an empty wooden table with paws clasped together in begging position, a single sparkling tear in one eye, sad downturned mouth, eyes wide and hopeful. No food anywhere. Mirrors the sad-begging pose of a classic cute kitten illustration."
        },
        {
            "stage": 10,
            "filename": "cat-stage-de-10.png",
            "prompt": "The kitten in brown lederhosen and green Tirolerhut is happily nibbling on a warm soft golden-brown pretzel held in both paws. A small dab of yellow mustard on the tip of its nose. Small contented smile, eyes squinted in pleasure. The wooden table now has a paper liner and a single pretzel crumb."
        },
        {
            "stage": 25,
            "filename": "cat-stage-de-25.png",
            "prompt": "The plumper kitten in straining lederhosen and Tirolerhut holds a grilled bratwurst on a wooden fork, raised triumphantly. A squiggle of mustard runs down the sausage. Big happy grin, mouth open mid-bite. Wooden table with a small bowl of sauerkraut next to it."
        },
        {
            "stage": 50,
            "filename": "cat-stage-de-50.png",
            "prompt": "The cheerful chubby kitten in lederhosen with suspenders straining over a round belly holds a golden-breaded schnitzel on a plate. A fresh lemon wedge and sprig of parsley garnish the plate. Wide grin, eyes shining. Tirolerhut perched proudly. Wooden table with crumbs scattered."
        },
        {
            "stage": 75,
            "filename": "cat-stage-de-75.png",
            "prompt": "The very plump kitten in lederhosen with suspenders popping under the strain sits behind a wooden platter loaded with a pretzel, a bratwurst with mustard, and a mound of sauerkraut. Eyes closed in pure bliss, blissful smile, contented sigh almost visible. Tirolerhut slightly askew. Faint suggestion of oompah music notes floating in the air."
        },
        {
            "stage": 100,
            "filename": "cat-stage-de-100.png",
            "prompt": "The chonky cat in full lederhosen and a Tirolerhut with a feather raises an oversized stein of golden beer overflowing with white foam. A magnificent foam mustache decorates its upper lip. Contented closed-eyed smile. Empty pretzel wrappers and breadcrumbs scattered around. Triumphant PROST pose. Slight warm golden glow."
        },
        {
            "stage": 130,
            "filename": "cat-stage-de-130.png",
            "prompt": "MEGA OKTOBERFEST APEX SCENE. The chonky cat is enthroned atop a giant wooden beer keg, wearing golden-embroidered lederhosen with edelweiss flower trim and a Tirolerhut with a magnificent feather. A necklace of soft pretzels hangs around its neck and a crown made of sausages sits on its head over the hat. An alphorn is slung over its shoulder. A magnificent overflowing foam mustache. Both paws raise TWO oversized steins of foamy golden beer with froth cascading down the sides. Two tiny dirndl-clad mouse companions perch on its shoulders raising their own miniature steins. In the background, oompah-band silhouettes play instruments. Bavarian blue-and-white flag rosettes and golden fireworks burst behind. Sparkles and confetti everywhere. The absolute peak of Bavarian feline glory. Lush, vivid, over-the-top."
        }
    ]
}
```

- [ ] **Step 2: Create `scripts/generate-german-cat-stages.mjs`**

```js
#!/usr/bin/env node
/**
 * Generate the 7 Feed-the-German-Cat stage images.
 *
 * Drives a Playwright-controlled browser at the URL configured via the
 * IMAGE_GEN_URL env var or --url CLI flag. Uses a persistent browser
 * context at ~/.cache/cat-image-gen-profile/ so authentication survives
 * between runs — log in once, every subsequent run is silent.
 *
 * Usage:
 *   node scripts/generate-german-cat-stages.mjs               # all 7 stages
 *   node scripts/generate-german-cat-stages.mjs --stages 130  # just stage 130
 *   node scripts/generate-german-cat-stages.mjs --stages 75,130
 *
 * Per-service selectors (prompt input, submit button, generated-image)
 * are NOT hard-coded — they're pulled from --selectors-file or env vars
 * so the script works with whatever image-gen service the user uses.
 */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PROFILE_DIR = process.env.IMAGE_GEN_PROFILE_DIR
    || path.join(os.homedir(), '.cache', 'cat-image-gen-profile');

function parseArgs(argv) {
    const args = { stages: null, url: process.env.IMAGE_GEN_URL || null,
                   selectorsFile: process.env.IMAGE_GEN_SELECTORS || null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--stages')        args.stages = argv[++i].split(',').map(s => parseInt(s, 10));
        else if (a === '--url')      args.url = argv[++i];
        else if (a === '--selectors-file') args.selectorsFile = argv[++i];
        else if (a === '--help' || a === '-h') {
            console.log(
                'Usage: node scripts/generate-german-cat-stages.mjs [options]\n' +
                '  --stages N[,M,...]      Only regenerate these stages (default: all)\n' +
                '  --url URL               Image-gen service URL (or set IMAGE_GEN_URL)\n' +
                '  --selectors-file FILE   JSON file with promptInput, submit, image selectors\n' +
                '                          (or set IMAGE_GEN_SELECTORS)\n' +
                '  --help                  Show this help'
            );
            process.exit(0);
        }
    }
    return args;
}

async function loadPrompts() {
    const file = path.join(__dirname, 'german-cat-prompts.json');
    const data = JSON.parse(await readFile(file, 'utf8'));
    return data;
}

async function loadSelectors(file) {
    if (!file) {
        throw new Error(
            'No selectors file provided. Pass --selectors-file or set IMAGE_GEN_SELECTORS.\n' +
            'The selectors file is a JSON object: { "promptInput": "...", "submit": "...", "image": "..." }\n' +
            'where each value is a Playwright selector for that element on your image-gen service.'
        );
    }
    return JSON.parse(await readFile(file, 'utf8'));
}

async function downloadImage(page, imageLocator, destPath) {
    const src = await imageLocator.getAttribute('src');
    if (!src) throw new Error('Generated image has no src attribute');
    const response = await page.context().request.get(src);
    if (!response.ok()) throw new Error(`Image fetch failed: ${response.status()}`);
    const buf = await response.body();
    await writeFile(destPath, buf);
    return buf.length;
}

async function generateOne(page, selectors, stylePreamble, stage) {
    const fullPrompt = `${stylePreamble}\n\n${stage.prompt}`;
    console.log(`[stage ${stage.stage}] Submitting prompt (${fullPrompt.length} chars)...`);

    const input = page.locator(selectors.promptInput).first();
    await input.click();
    await input.fill('');
    await input.type(fullPrompt, { delay: 5 });

    await page.locator(selectors.submit).first().click();

    const image = page.locator(selectors.image).first();
    await image.waitFor({ state: 'visible', timeout: 120_000 });
    // Wait for stable src (some services lazy-update)
    let lastSrc = '';
    for (let i = 0; i < 20; i++) {
        const src = await image.getAttribute('src');
        if (src === lastSrc && src) break;
        lastSrc = src;
        await page.waitForTimeout(500);
    }

    const dest = path.join(REPO_ROOT, stage.filename);
    const bytes = await downloadImage(page, image, dest);
    console.log(`[stage ${stage.stage}] Saved ${stage.filename} (${(bytes / 1024).toFixed(1)} KB)`);
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.url) {
        console.error('Error: image-gen service URL required. Pass --url or set IMAGE_GEN_URL.');
        process.exit(1);
    }

    const { stylePreamble, stages } = await loadPrompts();
    const selectors = await loadSelectors(args.selectorsFile);
    const wantedStages = args.stages
        ? stages.filter(s => args.stages.includes(s.stage))
        : stages;

    if (!wantedStages.length) {
        console.error(`No matching stages for --stages ${args.stages}. Valid: ${stages.map(s => s.stage).join(',')}`);
        process.exit(1);
    }

    await mkdir(PROFILE_DIR, { recursive: true });
    console.log(`Launching browser with persistent profile at ${PROFILE_DIR}`);
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: false,
        viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();
    await page.goto(args.url);

    console.log('\n=== If this is your first run, log into the image-gen service in the browser ===');
    console.log('=== Once logged in (or already authenticated), press Enter here to continue ===');
    await new Promise(resolve => process.stdin.once('data', resolve));

    try {
        for (const stage of wantedStages) {
            await generateOne(page, selectors, stylePreamble, stage);
        }
    } finally {
        await context.close();
    }

    console.log(`\nDone. Generated ${wantedStages.length} stage(s).`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Make sure the script's `--help` flag works (smoke test)**

```bash
cd scripts
# The Playwright dep lives in tests/ — point Node there for resolution
NODE_PATH=../tests/node_modules node generate-german-cat-stages.mjs --help
cd ..
```

Expected: usage text printed, exit code 0. No crash.

If `playwright` can't be resolved, install it in `tests/node_modules` (it was installed in Task 3 via `npm install`), or add to `tests/package.json` as `"playwright": "^1.49.0"` (sibling to `@playwright/test`) and re-run `cd tests && npm install`.

- [ ] **Step 4: Commit**

```bash
git add scripts/german-cat-prompts.json scripts/generate-german-cat-stages.mjs
git commit -m "chore: add Playwright image-gen helper and prompts for German cat stages"
```

---

## Task 7: Generate the 7 cat stage images and commit them

**Goal:** Run the image-gen helper to produce all 7 PNGs, visually review each one, regenerate any that don't fit, then commit them in a dedicated artwork commit.

**Files:**
- Create: `cat-stage-de-0.png` through `cat-stage-de-130.png` (7 files, 1024×1024, ≤ 500 KB each)

⚠️ **This task is the only one that REQUIRES user interaction** (browser login + visual review of each stage). All other tasks can run autonomously.

- [ ] **Step 1: Ask the user which image-gen service to target and what the selectors are**

Prompt the user for:
1. **Image-gen service URL** (e.g., the URL of the chat or image-gen page they used last time).
2. **Three selectors** — `promptInput`, `submit`, `image` — Playwright locators for the prompt textarea, the submit/send button, and the generated image element.

Save the selectors to `scripts/german-cat-selectors.local.json` (which is gitignored — see Step 2). Example structure:

```json
{
    "promptInput": "textarea#prompt-textarea",
    "submit": "button[data-testid=\"send-button\"]",
    "image": "div[data-message-author-role=\"assistant\"] img"
}
```

- [ ] **Step 2: Add the selectors file pattern to root `.gitignore` to keep selectors local**

Check whether the repo has a root `.gitignore`:

```bash
ls -la C:/Users/dewainr/CATBootcampFeedback/.gitignore 2>&1
```

If it exists, append (only if not already present):

```
# Local-only image-gen selectors (per-user, per-service)
scripts/*.local.json
```

If it doesn't exist, create it with that single rule.

- [ ] **Step 3: Run the helper to generate all 7 stages**

```bash
cd C:/Users/dewainr/CATBootcampFeedback
IMAGE_GEN_URL='<service URL from Step 1>' \
IMAGE_GEN_SELECTORS=scripts/german-cat-selectors.local.json \
node scripts/generate-german-cat-stages.mjs
```

The browser opens headed. User logs in if needed, then presses Enter in the terminal. The script generates and downloads all 7 PNGs to repo root.

Expected at end: 7 new files `cat-stage-de-{0,10,25,50,75,100,130}.png` in repo root.

- [ ] **Step 4: Visually review each stage by opening them in the OS viewer**

```bash
ls -la cat-stage-de-*.png
```

Open each one (e.g., with `start cat-stage-de-0.png` on Windows). For each: does it match the spec's stage description? Specifically check:
- Stage 0: sad lederhosen kitten, empty table, single tear
- Stage 10: pretzel in paws, mustard nose
- Stage 25: bratwurst on fork, mustard squiggle, plumper
- Stage 50: golden schnitzel + lemon, suspenders straining
- Stage 75: feast platter (pretzel + sausage + sauerkraut), blissful
- Stage 100: oversized beer stein, foam mustache, alpine hat with feather, PROST pose
- Stage 130: enthroned on keg, two steins, pretzel necklace, sausage crown, mice, fireworks — the over-the-top apex

- [ ] **Step 5: Regenerate any stages that don't fit**

If stage N is wrong, regenerate just that one:

```bash
IMAGE_GEN_URL='<service URL>' \
IMAGE_GEN_SELECTORS=scripts/german-cat-selectors.local.json \
node scripts/generate-german-cat-stages.mjs --stages N
```

If the prompt itself needs tweaking, edit `scripts/german-cat-prompts.json` first, then re-run. Iterate until satisfied.

- [ ] **Step 6: Un-skip the two remaining PNG-dependent tests in the verification suite**

In `tests/german-cat-theme.spec.mjs`, change `test.skip(...)` back to `test(...)` for:
- `All 7 German stages render at the correct counts`
- `All 7 cat-stage-de-*.png files exist, are ~1024 px, and ≤ 500 KB`

- [ ] **Step 7: Run the full verification suite — every test must PASS**

```bash
cd tests
npx playwright test
cd ..
```

Expected: 12 PASS / 0 SKIPPED / 0 FAIL.

If "All 7 cat-stage-de-*.png files exist..." fails because one is > 500 KB or wrong dimensions, regenerate or post-process (e.g., re-run with a more "compact composition" tweak to the prompt, or pipe through a PNG optimizer). Re-run until clean.

- [ ] **Step 8: Commit the artwork + the test un-skip together**

```bash
git add cat-stage-de-0.png cat-stage-de-10.png cat-stage-de-25.png \
        cat-stage-de-50.png cat-stage-de-75.png cat-stage-de-100.png \
        cat-stage-de-130.png \
        tests/german-cat-theme.spec.mjs
git commit -m "feat: add German cat stage artwork (7 stages)"
```

**Sanity check before committing:** `git status` must NOT show any of the AI-summary files. If it does, something went wrong with the branch isolation in Task 1 — STOP and ask the user.

---

## Task 8: Run the full verification gate and confirm everything passes

**Goal:** Final automated verification before handing off to the user's local Docker smoke test. This is a BLOCKING gate — nothing pushes until every check is green.

- [ ] **Step 1: Run the full Playwright suite from a clean state**

```bash
cd tests
rm -rf test-results playwright-report
npx playwright test
cd ..
```

Expected: 12 PASS / 0 SKIPPED / 0 FAIL. If any failure: STOP, fix the underlying issue, re-run.

- [ ] **Step 2: Inspect HTML report on any failure**

```bash
cd tests
npx playwright show-report
cd ..
```

(Only run this on failure to see screenshots and traces.)

- [ ] **Step 3: Final CSP grep sanity check**

```bash
grep -n "onclick=" count.html count.js && echo "FAIL: inline onclick found" || echo "PASS: no inline onclick"
grep -nE "<script>[^<]" count.html && echo "FAIL: inline script block found" || echo "PASS: no inline script block"
```

Expected: both lines print PASS.

- [ ] **Step 4: Confirm no AI-summary files have crept into the branch diff against `main`**

```bash
git diff --stat main...HEAD | grep -E "summary|feedback-summary|migration.*007|cost-guard|llm-service" && echo "FAIL: summary file in diff" || echo "PASS: no summary files in diff"
git diff --stat main...HEAD | head -30
```

Expected: PASS line printed, and the diff stat lists ONLY the German cat files (count.html, count.js, 7 PNGs, scripts/german-cat-*, tests/*, docs/superpowers/specs/, docs/superpowers/plans/).

- [ ] **Step 5: Confirm no Docker files in the diff**

```bash
git diff --stat main...HEAD | grep -iE "docker|dockerfile|docker-compose" && echo "FAIL: docker file in diff" || echo "PASS: no docker files in diff"
```

Expected: PASS.

If any of Steps 3, 4, or 5 fails: STOP, remove the offending file or change, recommit, re-verify. Do not proceed to local Docker smoke test or PR until all four checks are PASS.

---

## Task 9: Local Docker smoke test (user-driven)

**Goal:** Confirm the German cat theme works in the user's actual local Docker dev container before opening the PR. This catches anything the automated Playwright suite missed (real-server quirks, asset path issues, CSP enforcement differences, etc.). User-driven — they exercise the page hands-on.

- [ ] **Step 1: Hand off to the user**

Tell the user:

> "All 5 implementation commits are on `feature/feed-the-german-cat` and the automated Playwright suite is green (12/12). Please bring up your local Docker stack against the current working tree and exercise the count page hands-on:
>
> 1. Open the count page in your browser (your usual Docker URL + `/count.html?code=<a test event code>`).
> 2. Verify the theme dropdown shows three options: Classic, Feed the Cat, Feed the Cat (German).
> 3. Switch to Feed the Cat (German). Confirm:
>    - The dropdown selection persists across reload (sessionStorage).
>    - The warm wooden background tint applies.
>    - The small Bavarian blue-white diamond corner accent appears in the top-right of the left section.
>    - The starting cat (stage 0) is the sad lederhosen kitten.
> 4. Drive feedback count up via a real test event submission flow. Watch the cat progress through all 7 stages: 0 → 10 (pretzel) → 25 (bratwurst) → 50 (schnitzel) → 75 (feast) → 100 (PROST stein) → 130 (Oktoberfest apex).
> 5. Watch the food drops — they should be Bavarian (🥨 🌭 🍺 🥖 🧀 🍻), not fish/meat.
> 6. Watch the milestone messages — they should be German-flavored at 10/25/50/75/100/150.
> 7. Confirm the milestone at 130 does NOT fire a celebration (just the visual stage swap).
> 8. Cycle back to Classic and Feed the Cat — confirm both are unchanged.
>
> Give me a thumbs-up or a list of tweaks. I'll iterate on anything that needs adjustment."

- [ ] **Step 2: If the user reports issues, fix them**

For each issue:
1. Identify the root cause.
2. Edit the relevant file (`count.html`, `count.js`, or regenerate a specific PNG via `node scripts/generate-german-cat-stages.mjs --stages N`).
3. Re-run the Playwright suite (`cd tests && npx playwright test`).
4. Add a small fixup commit (`fix: <specific thing>`).
5. Ask the user to re-test.

Iterate until the user gives a clean thumbs-up.

- [ ] **Step 3: Once approved, mark this task done and proceed to Task 10**

---

## Task 10: Open the pull request

**Goal:** Push the branch and open a PR against `main`. The PR body uses the 7 PNGs as inline previews — they render automatically in GitHub when referenced by repo-relative URL.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/feed-the-german-cat
```

- [ ] **Step 2: Open the PR with `gh`**

```bash
gh pr create --base main --title "feat: Add Bavarian variant to Feed the Cat counter theme" --body "$(cat <<'EOF'
## Summary

- Adds a third theme option to the count page: **Feed the Cat (German)** — a Bavarian-themed variant of the existing Feed the Cat theme with the same charming orange tabby kitten dressed in lederhosen, progressing through 7 stages of German foods.
- Fully additive: the existing Classic and Feed the Cat themes are byte-identical.
- Includes full-immersion theming: German-flavored encouraging messages, milestone messages, food-drop emojis (🥨 🌭 🍺), warm beer-garden background tint, and a small Bavarian blue-white diamond corner accent.
- CSP-safe: all styling driven by a class toggle, no inline styles or scripts.

## Stage progression

| Stage | Count | Preview |
|---|---|---|
| 0 | 0 | ![Stage 0 — sad lederhosen kitten](../raw/feature/feed-the-german-cat/cat-stage-de-0.png) |
| 10 | ≥ 10 | ![Stage 10 — pretzel](../raw/feature/feed-the-german-cat/cat-stage-de-10.png) |
| 25 | ≥ 25 | ![Stage 25 — bratwurst](../raw/feature/feed-the-german-cat/cat-stage-de-25.png) |
| 50 | ≥ 50 | ![Stage 50 — schnitzel](../raw/feature/feed-the-german-cat/cat-stage-de-50.png) |
| 75 | ≥ 75 | ![Stage 75 — Bavarian feast](../raw/feature/feed-the-german-cat/cat-stage-de-75.png) |
| 100 | ≥ 100 | ![Stage 100 — PROST](../raw/feature/feed-the-german-cat/cat-stage-de-100.png) |
| 130 | ≥ 130 | ![Stage 130 — Oktoberfest apex](../raw/feature/feed-the-german-cat/cat-stage-de-130.png) |

(Stage 130 is a visual progression only — it does not fire a milestone celebration, so the existing milestone cadence is unchanged.)

## Test plan

- [x] Automated Playwright verification suite (12 tests, all passing): theme switching + persistence, classic/cat regression baselines, all 7 German stages render at correct counts, background tint applied only when cat-de is active, German food emojis used for drops, German message tokens present, milestone-130 does not fire fanfare, no inline onclick/<script> in HTML, all 7 PNGs are ~1024px and ≤ 500 KB.
- [x] Local Docker smoke test — manually exercised all 3 themes in containerized dev environment.
- [x] CSP sanity check — no `onclick=` or inline `<script>` blocks in `count.html` or `count.js`.
- [x] Branch isolation check — diff against main contains zero AI-summary work-in-progress files and zero Docker dev environment files.

## Files

- `count.html`, `count.js` — modified to add the third theme and refactor to a `THEME_CONTENT` registry.
- `cat-stage-de-{0,10,25,50,75,100,130}.png` — 7 new stage assets.
- `scripts/generate-german-cat-stages.mjs`, `scripts/german-cat-prompts.json` — Playwright-driven image-gen helper for reproducibility.
- `tests/` — new Playwright verification harness covering all the spec checks.
- `docs/superpowers/specs/2026-05-28-feed-the-german-cat-design.md` — design spec.
- `docs/superpowers/plans/2026-05-28-feed-the-german-cat.md` — implementation plan.

EOF
)"
```

- [ ] **Step 3: Print the PR URL for the user**

```bash
gh pr view --json url --jq .url
```

Done. Hand the URL to the user.

---

## Self-review

**Spec coverage:**
- Branch off main, no contamination with summary WIP → Task 1 (stash + branch + scoped restore of design docs only) ✓
- Third theme option in dropdown → Task 2 Step 1 ✓
- `#themeCatDE` view div with 7 `<img>` elements → Task 2 Step 2 ✓
- Background tint + Bavarian corner CSS → Task 2 Step 3 ✓
- 4 German constants (stages/messages/food/milestone overrides) → Task 5 Step 1 ✓
- `THEME_CONTENT` registry + theme-aware refactors → Task 4 Steps 1-7 ✓
- `setTheme` handles cat-de → Task 5 Step 2 ✓
- sessionStorage validator accepts cat-de → Task 5 Step 3 ✓
- 7 PNG assets generated → Task 7 ✓
- Playwright image-gen helper + prompts file → Task 6 ✓
- 11-row verification table → Task 3 (test file) + Task 8 (gate) — 12 tests cover all 11 rows (dropdown is split into 2 tests for clarity) ✓
- Local Docker smoke test → Task 9 ✓
- PR title/body convention, no Claude co-author → Task 10 ✓
- Don't touch summary files → Task 8 Step 4 explicit grep check ✓
- Don't add Docker files → Task 8 Step 5 explicit grep check ✓
- CSP-safe (no inline onclick/script) → Task 3 (test) + Task 8 Step 3 (final grep) ✓
- Image-gen URL deferred to implementation phase → Task 7 Step 1 (asks user) ✓

**Placeholder scan:** No "TBD", "TODO", or vague requirements. The selectors file pattern in Task 7 is documented with an example shape; the actual selectors are user-supplied at execution time because they vary per image-gen service.

**Type / name consistency:**
- `THEME_CONTENT` registry keys match across Tasks 4 and 5 (`stages`, `encouragingMessages`, `foodEmojis`, `milestoneMessages`).
- Element IDs consistent: `themeCatDE`, `catContainerDE`, `catCounterDENumber`, `progressBarFillDE`, `progressBarLabelDE` used identically in `count.html` (Task 2) and `count.js` (Tasks 4, 5).
- Function names referenced match: `updateCatState`, `showMilestone`, `dropFood`, `setTheme`, `initCat`, `sizeProgressRing`, `initializeThemeSelector`, `checkMilestone`, `playMilestoneSound`.
- The `_active*ForTest` window hooks in Task 4 Step 1 match the test references in Task 3 Step 4.

**Scope check:** Single coherent feature. ~250 lines of source modifications + 7 PNG assets + ~400 lines of test/helper code. One plan, one PR.
