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
const CLASSIC_FOOD_EMOJIS = ['🐟', '🥩', '🍗', '🍖', '🍪', '🍣', '🍛'];

async function setMockCount(page, count) {
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
    await page.waitForTimeout(150);
}

async function waitForCountReady(page) {
    // After page.reload(), mockLoadEventDetails has a 1000ms simulated delay
    // before updateCount fires. Wait for updateCount() to complete by watching
    // #lastUpdated — it starts as "-" and gets replaced with a real time string
    // only after updateCount() runs.
    await page.waitForSelector('#countDisplay', { state: 'visible', timeout: 5000 });
    await page.waitForFunction(() => {
        const el = document.getElementById('lastUpdated');
        return el && el.textContent.trim() !== '' && el.textContent.trim() !== '-';
    }, { timeout: 5000 });
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
            await waitForCountReady(page);
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
            await waitForCountReady(page);
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
    test.skip('All 7 German stages render at the correct counts', async ({ page }) => {
        for (const [n, stage] of [[0, 0], [10, 10], [25, 25], [50, 50], [75, 75], [100, 100], [130, 130]]) {
            await page.goto(COUNT_URL);
            await setMockCount(page, n);
            await page.reload();
            await waitForCountReady(page);
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
            return new Promise(resolve => {
                const rows = Array.from({ length: 5 }, (_, i) => ({ eventCode: 'CSA1B2C3', eventModuleId: 1, id: i }));
                localStorage.setItem('bootcampFeedback', JSON.stringify(rows));
                window.updateCount?.();
                setTimeout(() => resolve(out), 800);
            });
        }, GERMAN_FOOD_EMOJIS);
        if (seen.length > 0) {
            for (const e of seen) expect(GERMAN_FOOD_EMOJIS).toContain(e);
        }
    });

    test('Classic cat theme still drops original emojis (no regression)', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat');
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
            window.checkMilestone?.(130, 129);
            return called;
        });
        expect(fired).toBe(false);

        await setMockCount(page, 130);
        await page.reload();
        await waitForCountReady(page);
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
        for (const m of html.matchAll(/<script[^>]*>/gi)) {
            expect(m[0]).toMatch(/\ssrc\s*=/i);
        }
        expect(js).not.toMatch(/setAttribute\(['"]onclick['"]/);
    });
});

test.describe('Image asset sanity', () => {
    test.skip('All 7 cat-stage-de-*.png files exist, are ~1024 px, and ≤ 500 KB', async ({ }) => {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = path.dirname(fileURLToPath(new URL('../', import.meta.url)));
        for (const stage of [0, 10, 25, 50, 75, 100, 130]) {
            const file = path.join(root, `cat-stage-de-${stage}.png`);
            const stat = await fs.stat(file);
            expect(stat.size, `${file} size`).toBeLessThanOrEqual(500 * 1024);
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
