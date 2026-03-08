# Celebration Levels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 3 selectable celebration intensity levels (Chill, Party, Chaos) to the live counter page with emoji character animations and cat-themed encouragement messages.

**Architecture:** Extend the existing confetti canvas system to also render walking/floating emoji characters. Add a `celebrationLevel` global (1-3) that controls which effects fire when `updateCount()` detects new submissions. A new dropdown in the footer (matching the refresh-interval pattern) persists the choice to sessionStorage.

**Tech Stack:** Vanilla JS, Canvas 2D API, CSS keyframe animations, no new dependencies.

---

### Task 1: Add celebration level selector to HTML footer

**Files:**
- Modify: `count.html:524-541` (footer section)

**Step 1: Add the celebration dropdown next to the refresh dropdown**

In `count.html`, inside the footer `<div style="display: flex; gap: 15px; align-items: center;">`, add a new `.refresh-controls` div after the existing refresh dropdown:

```html
<div class="refresh-controls">
    <label for="celebrationLevel">Celebrations:</label>
    <select id="celebrationLevel">
        <option value="1" selected>Chill</option>
        <option value="2">Party</option>
        <option value="3">Chaos</option>
    </select>
</div>
```

**Step 2: Verify visually**

Open `count.html` locally, confirm the new dropdown appears in the footer next to "Refresh:" and matches the same styling.

**Step 3: Commit**

```bash
git add count.html
git commit -m "feat(counter): add celebration level selector to footer"
```

---

### Task 2: Add celebration level state and selector initialization to count.js

**Files:**
- Modify: `count.js:16-25` (global state section)
- Modify: `count.js:726-743` (add `initializeCelebrationLevelSelector` function)
- Modify: `count.js:386-399` (call it from `initialize()`)

**Step 1: Add global state variable**

After line 25 (`let isFirstLoad = true;`), add:

```javascript
let celebrationLevel = 1; // 1=Chill, 2=Party, 3=Chaos
```

**Step 2: Add initialization function**

After the `initializeRefreshIntervalSelector` function, add:

```javascript
function initializeCelebrationLevelSelector() {
    const celebrationSelect = document.getElementById('celebrationLevel');
    if (!celebrationSelect) return;

    const saved = sessionStorage.getItem('celebrationLevel');
    if (saved) {
        celebrationLevel = parseInt(saved);
        celebrationSelect.value = saved;
    }

    celebrationSelect.addEventListener('change', (e) => {
        celebrationLevel = parseInt(e.target.value);
        sessionStorage.setItem('celebrationLevel', e.target.value);
    });
}
```

**Step 3: Call from initialize()**

In the `initialize()` function, after the `initializeRefreshIntervalSelector()` call, add:

```javascript
initializeCelebrationLevelSelector();
```

**Step 4: Commit**

```bash
git add count.js
git commit -m "feat(counter): wire up celebration level state and persistence"
```

---

### Task 3: Replace encouragement messages with cat-themed versions and increase visibility

**Files:**
- Modify: `count.js:55-64` (ENCOURAGING_MESSAGES array)
- Modify: `count.html` (`.encouraging-message` CSS)

**Step 1: Replace the ENCOURAGING_MESSAGES array with cat-themed messages**

```javascript
const ENCOURAGING_MESSAGES = [
    'Paws up if you submitted feedback! 🐾',
    'You\'re the cat\'s meow! Keep it coming! 😺',
    'Purr-fect participation so far! 🐱',
    'Every response is the cat\'s pajamas! 🎩🐈',
    'Feline good about this feedback! 😸',
    'Don\'t be a scaredy-cat — share your thoughts! 🐾',
    'We\'re not kitten around — your voice matters! 🐱',
    'Cat-ch us if you can — submit your feedback! 😼',
    'This feedback is claw-some! Keep going! 🐾',
    'Meow is the time to share your thoughts! 😺'
];
```

**Step 2: Update the `.encouraging-message` CSS to be larger and more visible**

In `count.html`, change the existing `.encouraging-message` rule:

```css
.encouraging-message {
    margin-top: 8px;
    font-size: 1.6rem;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
    min-height: 1.8em;
    transition: opacity 0.5s ease;
    font-weight: 600;
    text-shadow: 0 0 10px rgba(102, 126, 234, 0.3);
}
```

Key changes: `font-size` from `1.05rem` → `1.6rem`, `color` opacity from `0.55` → `0.8`, added `font-weight: 600` and `text-shadow` for legibility in a room.

**Step 3: Also update MILESTONE_MESSAGES with cat flair**

```javascript
const MILESTONE_MESSAGES = {
    10:  'First 10! The cats approve! 😺',
    25:  '25 responses! A whole litter! 🐱🐱🐱',
    50:  '50! The cats are purring! 😸',
    75:  '75! Cat-astrophically good! 🎩🐈',
    100: 'Triple digits! Legendary cats! 🐾🏆',
    150: '150! The tuxedo cats are dancing! 🕺🐱',
    200: '200! Cat-tastic participation! 😻',
    300: '300! The cats have taken over! 🐱🐱🐱🐱🐱',
    500: '500! You\'ve unleashed the mega cats! 👑🐈‍⬛'
};
```

**Step 4: Commit**

```bash
git add count.js count.html
git commit -m "feat(counter): cat-themed messages with larger font for room visibility"
```

---

### Task 4: Create the emoji character animation system

**Files:**
- Modify: `count.js` — add new section after the CONFETTI SYSTEM section

**Step 1: Add the character animation system**

After the `animateConfetti()` function (~line 155), add a new section:

```javascript
// ══════════════════════════════════════════════════════════════════════════════
// EMOJI CHARACTER ANIMATION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

const CHARACTER_POOL = {
    cats: ['🐱', '😺', '😸', '😻', '🐈', '🐈‍⬛'],
    ducks: ['🦆'],
    bonus: ['🦜', '🚀', '⭐', '🎉', '🎊', '✨', '💫', '🌟']
};

let activeCharacters = [];
let characterAnimationId = null;

/**
 * Spawn a character that walks/floats across the screen
 * @param {string} emoji - The emoji to display
 * @param {object} options - Animation options
 */
function spawnCharacter(emoji, options = {}) {
    const {
        fromRight = Math.random() > 0.5,
        y = null,
        speed = 1.5 + Math.random() * 1.5,
        size = 36 + Math.random() * 16,
        bobAmount = 6,
        bobSpeed = 0.05 + Math.random() * 0.03,
        fadeIn = true,
        walk = true
    } = options;

    const startX = fromRight ? confettiCanvas.width + 30 : -30;
    const endX = fromRight ? -60 : confettiCanvas.width + 60;
    const baseY = y || (confettiCanvas.height * (0.6 + Math.random() * 0.3));

    activeCharacters.push({
        emoji,
        x: startX,
        y: baseY,
        baseY,
        targetX: endX,
        speed: fromRight ? -speed : speed,
        size,
        bobAmount,
        bobSpeed,
        bobPhase: Math.random() * Math.PI * 2,
        opacity: fadeIn ? 0 : 1,
        fadeIn,
        walk,
        flipX: fromRight,
        alive: true
    });

    if (!characterAnimationId) {
        animateCharacters();
    }
}

function animateCharacters() {
    // Characters share the confetti canvas — drawn after confetti
    activeCharacters = activeCharacters.filter(c => c.alive);

    if (activeCharacters.length === 0) {
        characterAnimationId = null;
        return;
    }

    activeCharacters.forEach(c => {
        // Move
        c.x += c.speed;
        c.bobPhase += c.bobSpeed;
        c.y = c.baseY + Math.sin(c.bobPhase) * c.bobAmount;

        // Fade in
        if (c.fadeIn && c.opacity < 1) {
            c.opacity = Math.min(1, c.opacity + 0.03);
        }

        // Check if off-screen
        if ((c.speed > 0 && c.x > confettiCanvas.width + 60) ||
            (c.speed < 0 && c.x < -60)) {
            c.alive = false;
            return;
        }

        // Draw
        confettiCtx.save();
        confettiCtx.globalAlpha = c.opacity;
        confettiCtx.font = `${c.size}px serif`;
        confettiCtx.textAlign = 'center';
        confettiCtx.textBaseline = 'middle';

        if (c.flipX) {
            confettiCtx.translate(c.x, c.y);
            confettiCtx.scale(-1, 1);
            confettiCtx.fillText(c.emoji, 0, 0);
        } else {
            confettiCtx.fillText(c.emoji, c.x, c.y);
        }

        confettiCtx.restore();
    });

    characterAnimationId = requestAnimationFrame(animateCharacters);
}

/**
 * Spawn a floating character that rises and fades (Level 1 style)
 */
function spawnFloatingCat() {
    const emoji = CHARACTER_POOL.cats[Math.floor(Math.random() * CHARACTER_POOL.cats.length)];
    const leftSection = document.querySelector('.left-section');
    if (!leftSection) return;

    const rect = leftSection.getBoundingClientRect();
    const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const startY = rect.bottom - 20;

    activeCharacters.push({
        emoji,
        x,
        y: startY,
        baseY: startY,
        targetX: x,
        speed: 0,
        size: 40 + Math.random() * 12,
        bobAmount: 8,
        bobSpeed: 0.04,
        bobPhase: 0,
        opacity: 0,
        fadeIn: true,
        walk: false,
        flipX: false,
        alive: true,
        float: true,
        floatSpeed: -1.2 - Math.random() * 0.8,
        fadeAfter: 60  // frames before fading out
    });

    if (!characterAnimationId) {
        animateCharacters();
    }
}

// Extend animateCharacters to handle floating characters
const _originalAnimateCharacters = animateCharacters;
animateCharacters = function() {
    activeCharacters = activeCharacters.filter(c => c.alive);

    if (activeCharacters.length === 0) {
        characterAnimationId = null;
        return;
    }

    activeCharacters.forEach(c => {
        if (c.float) {
            // Floating upward
            c.y += c.floatSpeed;
            c.bobPhase += c.bobSpeed;
            c.x = c.targetX + Math.sin(c.bobPhase) * c.bobAmount;

            if (c.fadeIn && c.opacity < 1) {
                c.opacity = Math.min(1, c.opacity + 0.05);
            }

            if (c.fadeAfter !== undefined) {
                c.fadeAfter--;
                if (c.fadeAfter <= 0) {
                    c.opacity -= 0.02;
                    if (c.opacity <= 0) {
                        c.alive = false;
                        return;
                    }
                }
            }
        } else {
            // Walking across
            c.x += c.speed;
            c.bobPhase += c.bobSpeed;
            c.y = c.baseY + Math.sin(c.bobPhase) * c.bobAmount;

            if (c.fadeIn && c.opacity < 1) {
                c.opacity = Math.min(1, c.opacity + 0.03);
            }

            if ((c.speed > 0 && c.x > confettiCanvas.width + 60) ||
                (c.speed < 0 && c.x < -60)) {
                c.alive = false;
                return;
            }
        }

        // Draw
        confettiCtx.save();
        confettiCtx.globalAlpha = Math.max(0, c.opacity);
        confettiCtx.font = `${c.size}px serif`;
        confettiCtx.textAlign = 'center';
        confettiCtx.textBaseline = 'middle';

        if (c.flipX) {
            confettiCtx.translate(c.x, c.y);
            confettiCtx.scale(-1, 1);
            confettiCtx.fillText(c.emoji, 0, 0);
        } else {
            confettiCtx.fillText(c.emoji, c.x, c.y);
        }

        confettiCtx.restore();
    });

    characterAnimationId = requestAnimationFrame(animateCharacters);
};

/**
 * Screen effects for higher levels
 */
function screenGlow() {
    const container = document.querySelector('.count-container');
    container.style.transition = 'box-shadow 0.3s ease';
    container.style.boxShadow = 'inset 0 0 80px rgba(102, 126, 234, 0.3)';
    setTimeout(() => {
        container.style.boxShadow = 'none';
    }, 600);
}

function screenShake() {
    const container = document.querySelector('.count-container');
    container.style.transition = 'none';
    container.style.transform = 'translate(3px, 2px)';
    setTimeout(() => { container.style.transform = 'translate(-2px, -3px)'; }, 50);
    setTimeout(() => { container.style.transform = 'translate(2px, 1px)'; }, 100);
    setTimeout(() => { container.style.transform = 'translate(-1px, 2px)'; }, 150);
    setTimeout(() => { container.style.transform = 'translate(0, 0)'; }, 200);
}
```

**Step 2: Commit**

```bash
git add count.js
git commit -m "feat(counter): add emoji character animation system with float/walk/effects"
```

---

### Task 5: Wire celebration levels into the existing updateCount flow

**Files:**
- Modify: `count.js` — the `updateCount()` function and `checkMilestone()` function

**Step 1: Replace the celebration trigger block inside `updateCount()`**

Find the block starting at approximately line 633 (`if (!isFirstLoad && count > oldCount) {`). Replace it with level-aware celebration logic:

```javascript
if (!isFirstLoad && count > oldCount) {
    triggerCelebration(count, oldCount);
}
```

**Step 2: Add the `triggerCelebration` function**

```javascript
function triggerCelebration(newCount, oldCount) {
    const delta = newCount - oldCount;

    if (celebrationLevel === 1) {
        // CHILL: small confetti + one floating cat
        burstConfetti(20);
        spawnFloatingCat();

    } else if (celebrationLevel === 2) {
        // PARTY: medium confetti + cat parade + duck + glow
        burstConfetti(60);
        screenGlow();

        // 2-3 tuxedo cats parade across bottom
        const catCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < catCount; i++) {
            setTimeout(() => {
                spawnCharacter(CHARACTER_POOL.cats[Math.floor(Math.random() * CHARACTER_POOL.cats.length)], {
                    fromRight: false,
                    y: confettiCanvas.height * (0.78 + Math.random() * 0.1),
                    speed: 2 + Math.random(),
                    size: 38 + Math.random() * 10
                });
            }, i * 400);
        }

        // One duck waddles across
        setTimeout(() => {
            spawnCharacter('🦆', {
                fromRight: true,
                y: confettiCanvas.height * 0.82,
                speed: 1.5,
                size: 36,
                bobAmount: 4,
                bobSpeed: 0.08
            });
        }, 200);

    } else if (celebrationLevel === 3) {
        // CHAOS: massive confetti + cat army + duck squad + bonus characters + shake
        burstConfetti(150);
        screenShake();
        screenGlow();

        // 5-8 tuxedo cats march across (different sizes!)
        const catCount = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < catCount; i++) {
            setTimeout(() => {
                spawnCharacter(CHARACTER_POOL.cats[Math.floor(Math.random() * CHARACTER_POOL.cats.length)], {
                    fromRight: Math.random() > 0.3,
                    y: confettiCanvas.height * (0.65 + Math.random() * 0.25),
                    speed: 2 + Math.random() * 2,
                    size: 28 + Math.random() * 30
                });
            }, i * 200);
        }

        // Multiple ducks in formation
        const duckCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < duckCount; i++) {
            setTimeout(() => {
                spawnCharacter('🦆', {
                    fromRight: false,
                    y: confettiCanvas.height * (0.75 + i * 0.04),
                    speed: 1.8 + i * 0.3,
                    size: 32 + Math.random() * 8,
                    bobAmount: 3,
                    bobSpeed: 0.07
                });
            }, 300 + i * 250);
        }

        // Random bonus characters
        const bonusCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bonusCount; i++) {
            setTimeout(() => {
                const emoji = CHARACTER_POOL.bonus[Math.floor(Math.random() * CHARACTER_POOL.bonus.length)];
                spawnCharacter(emoji, {
                    fromRight: Math.random() > 0.5,
                    y: confettiCanvas.height * (0.3 + Math.random() * 0.5),
                    speed: 2.5 + Math.random() * 2,
                    size: 30 + Math.random() * 20
                });
            }, 500 + i * 300);
        }
    }

    // Milestones at all levels (scaled intensity)
    checkMilestone(newCount, oldCount);
}
```

**Step 3: Update `checkMilestone` to be level-aware**

Replace the existing `checkMilestone` function:

```javascript
function checkMilestone(newCount, oldCount) {
    for (const m of MILESTONES) {
        if (newCount >= m && oldCount < m) {
            showMilestone(m);

            // Scale milestone celebration by level
            if (celebrationLevel === 1) {
                burstConfetti(60);
                spawnFloatingCat();
            } else if (celebrationLevel === 2) {
                burstConfetti(120);
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => spawnFloatingCat(), i * 300);
                }
            } else {
                // Chaos milestone: fireworks + synchronized parade
                burstConfetti(250);
                screenShake();
                for (let i = 0; i < 8; i++) {
                    setTimeout(() => {
                        spawnCharacter(CHARACTER_POOL.cats[Math.floor(Math.random() * CHARACTER_POOL.cats.length)], {
                            fromRight: i % 2 === 0,
                            y: confettiCanvas.height * (0.6 + Math.random() * 0.25),
                            speed: 3 + Math.random() * 2,
                            size: 35 + Math.random() * 25
                        });
                    }, i * 150);
                }
                // Bonus firework bursts
                setTimeout(() => burstConfetti(100), 500);
                setTimeout(() => burstConfetti(100), 1000);
            }
            return;
        }
    }
}
```

**Step 4: Commit**

```bash
git add count.js
git commit -m "feat(counter): wire celebration levels into feedback update flow"
```

---

### Task 6: Integrate character rendering into the confetti animation loop

**Files:**
- Modify: `count.js` — `animateConfetti()` function

**Step 1: Merge character drawing into the confetti loop**

The character system currently has its own `requestAnimationFrame` loop, but both systems draw to the same canvas. To prevent clearing conflicts, merge them into one loop.

Replace the existing `animateConfetti` function to also draw characters at the end:

```javascript
function animateConfetti() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    // --- Draw confetti particles ---
    confettiParticles = confettiParticles.filter(p => p.opacity > 0 && p.y < confettiCanvas.height + 50);

    confettiParticles.forEach(p => {
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.fadeRate;
        p.vx *= 0.99;

        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rotation * Math.PI / 180);
        confettiCtx.globalAlpha = Math.max(0, p.opacity);
        confettiCtx.fillStyle = p.color;

        if (p.shape === 'rect') {
            confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
            confettiCtx.beginPath();
            confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            confettiCtx.fill();
        }

        confettiCtx.restore();
    });

    // --- Draw emoji characters ---
    activeCharacters = activeCharacters.filter(c => c.alive);

    activeCharacters.forEach(c => {
        if (c.float) {
            c.y += c.floatSpeed;
            c.bobPhase += c.bobSpeed;
            c.x = c.targetX + Math.sin(c.bobPhase) * c.bobAmount;
            if (c.fadeIn && c.opacity < 1) c.opacity = Math.min(1, c.opacity + 0.05);
            if (c.fadeAfter !== undefined) {
                c.fadeAfter--;
                if (c.fadeAfter <= 0) {
                    c.opacity -= 0.02;
                    if (c.opacity <= 0) { c.alive = false; return; }
                }
            }
        } else {
            c.x += c.speed;
            c.bobPhase += c.bobSpeed;
            c.y = c.baseY + Math.sin(c.bobPhase) * c.bobAmount;
            if (c.fadeIn && c.opacity < 1) c.opacity = Math.min(1, c.opacity + 0.03);
            if ((c.speed > 0 && c.x > confettiCanvas.width + 60) ||
                (c.speed < 0 && c.x < -60)) {
                c.alive = false;
                return;
            }
        }

        confettiCtx.save();
        confettiCtx.globalAlpha = Math.max(0, c.opacity);
        confettiCtx.font = `${c.size}px serif`;
        confettiCtx.textAlign = 'center';
        confettiCtx.textBaseline = 'middle';

        if (c.flipX) {
            confettiCtx.translate(c.x, c.y);
            confettiCtx.scale(-1, 1);
            confettiCtx.fillText(c.emoji, 0, 0);
        } else {
            confettiCtx.fillText(c.emoji, c.x, c.y);
        }

        confettiCtx.restore();
    });

    // Keep loop alive if either system has active elements
    if (confettiParticles.length > 0 || activeCharacters.length > 0) {
        confettiAnimationId = requestAnimationFrame(animateConfetti);
    } else {
        confettiAnimationId = null;
    }
}
```

Then remove the separate `animateCharacters` function and its `characterAnimationId` — everything runs through the unified `animateConfetti` loop. Update `spawnCharacter` and `spawnFloatingCat` to start the loop via `animateConfetti` instead of `animateCharacters`:

```javascript
// In spawnCharacter() and spawnFloatingCat(), replace:
//   if (!characterAnimationId) { animateCharacters(); }
// with:
    if (!confettiAnimationId) { animateConfetti(); }
```

**Step 2: Commit**

```bash
git add count.js
git commit -m "feat(counter): merge character and confetti into single animation loop"
```

---

### Task 7: Test all 3 levels end-to-end and deploy

**Step 1: Test locally with mock data**

```bash
cd /c/Users/dewainr/CATBootcampFeedback
npx http-server -p 8000
```

Open `http://localhost:8000/count.html?code=CSA1B2C3` — the mock data will auto-increment counts. Switch between Chill/Party/Chaos in the footer dropdown and verify:

- **Chill:** Small confetti + one floating cat emoji rising and fading
- **Party:** Medium confetti + 2-3 cats parading + duck waddling + screen glow
- **Chaos:** Massive confetti + cat army + duck squad + bonus emojis + screen shake

**Step 2: Verify cat-themed messages are visible**

Confirm the encouraging messages are large enough to read from across a room (1.6rem, bold, with glow).

**Step 3: Push and deploy**

```bash
git push
cd api && func azure functionapp publish catbootcamp-api-qa --javascript
```

**Step 4: Verify on QA**

Open `https://ashy-rock-0b254600f.4.azurestaticapps.net/count.html`, select an event, test all 3 celebration levels.
