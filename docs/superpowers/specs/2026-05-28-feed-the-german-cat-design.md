# Feed the German Cat — Design Spec

**Date:** 2026-05-28
**Status:** Approved, ready for implementation plan
**Branch:** `feature/feed-the-german-cat` (branched off `main`, independent of all in-progress work)

## Goal

Add a Bavarian-themed variant of the existing "Feed the Cat" counter theme on `count.html`. Same charming orange tabby kitten, dressed in lederhosen, progressing through German foods (pretzel → bratwurst → schnitzel → feast → beer stein → Oktoberfest apex) as feedback responses come in. Selectable from the existing theme dropdown as a third option; existing themes remain untouched.

## Non-Goals

- Replacing or modifying the existing Classic or Feed the Cat themes.
- Touching any of the in-progress AI feedback summary work on `feature/bulk-and-inline-speaker-assignment`.
- Adding any Docker dev environment files to source control.
- Adding any inline `<script>` or `onclick=` (CSP forbids `'unsafe-inline'` in this app).

## User-facing behavior

### Theme picker

`count.html` footer theme dropdown gains a third option:

```
Classic | Feed the Cat | Feed the Cat (German)
```

The new option's value is `cat-de`. Selection persists across reloads via the existing `sessionStorage` key `counterTheme`. The existing `'classic'` and `'cat'` values continue to work unchanged.

### 7 stage progression

The German cat advances through **seven** stages tied to feedback count thresholds. (The existing Classic Feed the Cat theme keeps its 6 stages — the 7th apex is exclusive to the German variant.)

| Stage | Count | Outfit & state | Food |
|---|---|---|---|
| 0 | 0 | Lederhosen + Tirolerhut, paws clasped, single tear, sad | (empty wooden table) |
| 10 | ≥ 10 | Same outfit, small smile, mustard nose | Warm soft pretzel |
| 25 | ≥ 25 | Plumper, big grin | Bratwurst on fork, mustard squiggle |
| 50 | ≥ 50 | Suspenders straining, full grin | Golden schnitzel + lemon + parsley |
| 75 | ≥ 75 | Suspenders popping, eyes-closed bliss | Mini-feast platter (pretzel + sausage + sauerkraut) |
| 100 | ≥ 100 | Chonky, alpine hat with feather, contented — **PROST!** | Oversized foamy beer stein |
| **130** | **≥ 130** | **MEGA-OKTOBERFEST APEX:** cat enthroned on a wooden beer keg, golden-embroidered lederhosen with edelweiss trim, pretzel necklace, sausage crown, alphorn slung over shoulder, magnificent foam mustache, **two** oversized steins held aloft with foam cascading, tiny dirndl-clad mouse companions on the shoulders raising matching tiny steins, oompah-band silhouette behind, Bavarian flag rosettes + fireworks bursting, sparkles, confetti — sheer Bavarian glory | **Everything. All of it.** |

Stage 130 is a **visual progression only** — it does **not** trigger a milestone celebration. The existing global `MILESTONES` array (`[10, 25, 50, 75, 100, 150, 200, 300, 500]`) is unchanged. This keeps milestone celebration cadence consistent across all three themes.

### Content (full immersion when `cat-de` is active)

**Rotating encouraging messages (`GERMAN_CAT_MESSAGES`):**

```
'Füttere die Katze! Submit your feedback! 🥨'
'Sehr gut! Keep them coming! 🐱'
'The Katze wants more pretzels! 🥨'
'Wunderbar! Every response feeds the cat! 😺'
"Don't be a Stubentiger — share your thoughts! 🐾"
'Mehr, bitte! The cat is still hungry! 😻'
'Prost to your feedback! 🍺'
'Schnitzel-tastic participation! 🥩'
'The Bayerische Katze approves! 🇩🇪'
'Oktober-purrfect responses! 🥨'
```

**Milestone override map (`GERMAN_MILESTONE_MESSAGES`):**

```
10:  'Zehn! First pretzel earned! 🥨'
25:  'Fünfundzwanzig! Bratwurst time! 🌭'
50:  'Fünfzig! Schnitzel achieved! 🥩'
75:  'Fünfundsiebzig! Full Bavarian feast! 🍻'
100: 'PROST! Hundert responses — raise the stein! 🍺👑'
150: '150! Oktoberfest legend! 🎪'
200: '200! Die Katze ist sehr happy! 😻'
300: '300! Schnitzel-pocalypse! 🌟'
500: '500! Mega-Katzen-König! 👑'
```

**Food-drop emojis (`GERMAN_FOOD_EMOJIS` — used by `dropFood()` when this theme is active):**

```
🥨 🌭 🍺 🥖 🧀 🍻
```

**Background tint + Bavarian corner accent (only when `cat-de` is active):**

A warm wooden beer-garden gradient is layered over the existing dark gradient. A small (~64px) Bavarian blue-white repeating-stripe accent is placed in the top-right of `.left-section`. Implementation is pure CSS keyed to a `.theme-cat-de` class on the `.count-container` element — no inline styles.

## Architecture

### Files touched

| File | Change |
|---|---|
| `count.html` | Add `<option value="cat-de">Feed the Cat (German)</option>` to `#themeSelect`. Add `<div id="themeCatDE" class="theme-view" style="display:none">` mirroring `#themeCat` structure but with **7** `<img class="cat-img" data-stage="N">` elements (stages 0/10/25/50/75/100/130) pointing at `cat-stage-de-N.png`. Add CSS rules for `.count-container.theme-cat-de` (warm tint overlay) and `.count-container.theme-cat-de .left-section::before` (Bavarian corner accent). |
| `count.js` | Add 4 new constants (`GERMAN_CAT_STAGES`, `GERMAN_CAT_MESSAGES`, `GERMAN_MILESTONE_MESSAGES`, `GERMAN_FOOD_EMOJIS`). Add a `THEME_CONTENT` registry. Refactor 4 functions to consume the registry: `getEncouragingMessages()`, `updateCatState()`, `showMilestone()` (look up the milestone message via the active theme's override map, falling back to the global `MILESTONE_MESSAGES`), `dropFood()` (consult the active theme's emoji list). Update `setTheme()` to handle `'cat-de'`: toggles `.theme-cat-de` class on `.count-container`, shows `#themeCatDE`, hides the others. Update the sessionStorage validator to accept `'cat-de'`. |
| `cat-stage-de-0.png` | New 1024×1024 PNG, dark-navy backplate, sad lederhosen kitten. |
| `cat-stage-de-10.png` | New 1024×1024 PNG, pretzel stage. |
| `cat-stage-de-25.png` | New 1024×1024 PNG, bratwurst stage. |
| `cat-stage-de-50.png` | New 1024×1024 PNG, schnitzel stage. |
| `cat-stage-de-75.png` | New 1024×1024 PNG, feast platter stage. |
| `cat-stage-de-100.png` | New 1024×1024 PNG, beer stein PROST stage. |
| `cat-stage-de-130.png` | New 1024×1024 PNG, MEGA-OKTOBERFEST APEX stage. |
| `scripts/generate-german-cat-stages.mjs` | New Playwright helper that drives image-gen prompt submissions and downloads results. |
| `scripts/german-cat-prompts.json` | The 7 stage prompts, checked in for reproducibility. |

### Theme-aware refactor pattern (`THEME_CONTENT` registry)

Rather than scatter `if (theme === 'cat-de')` branches across the file, introduce a single registry near the top of `count.js`:

```js
const THEME_CONTENT = {
    'classic':  { stages: null, encouragingMessages: CLASSIC_MESSAGES,
                  milestoneMessages: MILESTONE_MESSAGES, foodEmojis: FOOD_EMOJIS },
    'cat':      { stages: CAT_STAGES, encouragingMessages: CAT_MESSAGES,
                  milestoneMessages: MILESTONE_MESSAGES, foodEmojis: FOOD_EMOJIS },
    'cat-de':   { stages: GERMAN_CAT_STAGES, encouragingMessages: GERMAN_CAT_MESSAGES,
                  milestoneMessages: GERMAN_MILESTONE_MESSAGES, foodEmojis: GERMAN_FOOD_EMOJIS }
};
function getCurrentThemeContent() { return THEME_CONTENT[currentTheme] || THEME_CONTENT.classic; }
```

The four call sites become `getCurrentThemeContent().foodEmojis` (etc.), and the German theme slots in as a data entry rather than a code branch. This keeps the diff small and the surface for regression contained.

### Background tint and corner accent (CSP-safe)

All styling is scoped via a class toggle on `.count-container`:

```css
.count-container.theme-cat-de {
    background:
        linear-gradient(135deg, rgba(101,67,33,0.18) 0%, rgba(212,179,107,0.10) 100%),
        linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
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
}
```

No inline styles, no inline scripts — keeps the SWA CSP (`'unsafe-inline'` forbidden) intact.

## Image generation workflow

`scripts/generate-german-cat-stages.mjs` is a Playwright helper that reuses the same authenticated-browser pattern used last time to generate the original cat stages.

Behavior:
- Launches Playwright with a **persistent context** at `~/.cache/cat-image-gen-profile/` so authentication survives between runs (log in once, every future run is silent).
- On first run with no saved auth: opens the image-gen site headed; user logs in and presses Enter in the terminal to continue.
- Reads `scripts/german-cat-prompts.json` (array of `{ stage, filename, prompt }`).
- For each entry: submits the prompt, waits for the generated image, downloads it to repo root as `cat-stage-de-<stage>.png`.
- Supports `--stages 130,75` to regenerate only specific stages without re-running the whole batch.
- The image-gen service URL is a CLI flag or `IMAGE_GEN_URL` env var (NOT hardcoded). User specifies at implementation time which service was used last time.

Each prompt in `german-cat-prompts.json` is structured as: shared style preamble (cute chibi orange tabby kitten, big anime eyes, white belly + chest, dark navy backplate, soft drop shadow, painterly digital illustration, square 1024×1024) + per-stage clause (the specific outfit/food/expression from the stage table above). This consistency preamble is what guarantees the 7 stages read as the same character across the arc.

## Branching & commit plan

**Branch off `main`, not off the current `feature/bulk-and-inline-speaker-assignment` branch.** The in-progress AI summary work stays on its existing branch untouched.

```
git stash push -u -m "summary-feature-wip"     # set aside summary work cleanly
git checkout main && git pull
git checkout -b feature/feed-the-german-cat
```

Commits (small and reviewable):

1. `feat: add 'cat-de' theme option and view scaffolding` — `count.html` dropdown + empty `#themeCatDE` div + CSS tint/corner rules (no JS wiring yet, no images yet).
2. `refactor: introduce THEME_CONTENT registry for cat themes` — pure refactor; Classic + Feed the Cat behavior must be byte-identical post-refactor.
3. `feat: wire German cat theme (messages, food, milestones)` — adds the `cat-de` entry in `THEME_CONTENT`, the `setTheme` branch, and the sessionStorage validator.
4. `chore: add Playwright image-gen helper + prompt file` — `scripts/generate-german-cat-stages.mjs` + `scripts/german-cat-prompts.json`.
5. `feat: add German cat stage artwork` — the 7 PNGs in a dedicated commit so reviewers can preview them inline on the GitHub PR.

Commits will NOT include Claude co-author lines.

## Verification

Automated Playwright verification is **BLOCKING** before any push or local Docker test. Each row below must pass.

| Check | How |
|---|---|
| Dropdown shows 3 themes; selecting each switches view + persists across reload | Playwright: select option, reload, assert active view + sessionStorage |
| Existing Classic theme unchanged | Playwright snapshot of progress ring + counter at counts 0, 50, 130 — must match pre-refactor snapshots |
| Existing Feed the Cat theme unchanged | Playwright snapshot of all 6 stages at counts 0/10/25/50/75/100; verify food drops still come from original `FOOD_EMOJIS` list |
| Feed the Cat (German) theme — all 7 stages render correctly | Playwright drives count to 0, 10, 25, 50, 75, 100, **130**; assert correct `.cat-img.active` at each |
| Background tint + Bavarian corner appear only when `cat-de` is active | Assert `.theme-cat-de` class on container; computed background contains the warm-tint gradient; corner pseudo-element present |
| Food drops use German emoji list when `cat-de` active | Spy on `dropFood()`; assert emoji is in `GERMAN_FOOD_EMOJIS` only when theme is `cat-de` |
| Encouraging + milestone messages German-flavored when `cat-de` active | Assert text content includes expected German tokens (e.g., 'Prost', 'Sehr gut', 'Wunderbar', 'Zehn') |
| Milestone at 130 does NOT trigger fanfare | Confirm stage swap but no milestone message displayed, no `playMilestoneSound()` call |
| CSP-safe | Grep new code for inline `onclick=` or `<script>` blocks — must return zero |
| Image dimensions + file sizes sane | All 7 PNGs ≤ 500KB, 1024×1024 |
| No regressions in Classic/Cat theme food drops | Playwright spy: Classic + Cat themes still draw from original `FOOD_EMOJIS` list |

If any `cat-stage-de-N.png` looks off after visual inspection, regenerate via `node scripts/generate-german-cat-stages.mjs --stages N` and re-verify.

## Ship sequence

1. **Automated Playwright verification** — every row above must pass. BLOCKING.
2. **Local Docker container smoke test** — the user brings up their existing local Docker stack (the working-tree files are picked up via volume mount). User exercises:
   - All 3 themes from the dropdown.
   - Drive a real feedback count up via a test event and watch the German cat progress through all 7 stages (including 130 for the apex).
   - Confirm dropdown persistence across reload, theme tint, Bavarian corner accent, food-drop emojis, milestone messages.
   - Anything that feels off in the containerized environment.
   User gives a thumbs-up or a list of tweaks. Iterate until satisfied.
3. **Open the PR** only after the local Docker smoke test passes.
   - Title: `feat: Add Bavarian variant to Feed the Cat counter theme`
   - Body: explains the third theme option and includes the 7 PNGs inline as stage-by-stage previews.
   - Targets `main`. No mention of Claude.

## Explicit non-touches

This work will NOT:

- Touch any in-progress AI summary files (`api/src/shared/summary-*.js`, `api/src/functions/feedback-summary.js`, `migrations/007-add-event-summaries.sql`, the summary UI panels in `admin.html`/`admin.js`, the stale-marking change in `feedback.js`, the prewarm hook in `update-event-status.js`, `permissions.js`/`rate-limiter.js` changes).
- Push to `feature/bulk-and-inline-speaker-assignment` or any merged PR's branch.
- Replace or modify any of the existing 6 `cat-stage-*.png` files (Classic Feed the Cat stays identical).
- Add, commit, or modify any Docker dev environment files (`docker/`, `docker-compose.yml`, `Dockerfile`, `.dockerignore`).
- Add inline styles or inline `<script>` blocks (CSP forbids them).
- Include Claude co-author lines in commits.

## Open question for implementation phase

Which image-gen service to point `IMAGE_GEN_URL` at — the user will specify at implementation time which service was used last time so the Playwright helper can target it correctly.
