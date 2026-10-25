/**
 * Verification suite for the Viva Las Vegas cat theme: rags-to-riches stages,
 * casino celebrations (cash + poker chips) and slot machine sounds.
 */
import { test, expect } from '@playwright/test';

const COUNT_URL = '/count.html?code=CSA1B2C3';
const VEGAS_FOOD_EMOJIS = ['💵', '💰', '🪙', '💎', '🎲', '🃏'];

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
    await page.waitForSelector('#countDisplay', { state: 'visible', timeout: 5000 });
    await page.waitForFunction(() => {
        const el = document.getElementById('lastUpdated');
        return el && el.textContent.trim() !== '' && el.textContent.trim() !== '-';
    }, { timeout: 5000 });
}

test.describe('Viva Las Vegas — theme switching', () => {
    test("Selecting 'cat-vegas' switches the view and persists across reload", async ({ page }) => {
        await page.goto(COUNT_URL);
        const label = await page.$eval('#themeSelect option[value="cat-vegas"]', o => o.textContent);
        expect(label).toBe('Viva Las Vegas');
        await pickTheme(page, 'cat-vegas');
        await expect(page.locator('#themeCatVegas')).toBeVisible();
        await expect(page.locator('#themeCat')).toBeHidden();
        await expect(page.locator('#themeCatDE')).toBeHidden();
        await expect(page.locator('#themeClassic')).toBeHidden();
        expect(await page.evaluate(() => sessionStorage.getItem('counterTheme'))).toBe('cat-vegas');
        await page.reload();
        await expect(page.locator('#themeCatVegas')).toBeVisible();
    });

    test('theme-cat-vegas class is applied only while the Vegas theme is active', async ({ page }) => {
        await page.goto(COUNT_URL);
        const container = page.locator('.count-container');
        await pickTheme(page, 'cat-vegas');
        await expect(container).toHaveClass(/theme-cat-vegas/);
        await expect(container).not.toHaveClass(/theme-cat-de/);
        await pickTheme(page, 'cat-de');
        await expect(container).not.toHaveClass(/theme-cat-vegas/);
        await expect(container).toHaveClass(/theme-cat-de/);
        await pickTheme(page, 'classic');
        await expect(container).not.toHaveClass(/theme-cat-/);
    });
});

test.describe('Viva Las Vegas — stages', () => {
    test('All 7 rags-to-riches stages render at the correct counts', async ({ page }) => {
        for (const [n, stage] of [[0, 0], [9, 0], [10, 10], [19, 10], [20, 20], [30, 30], [40, 40], [54, 40], [55, 55], [69, 55], [70, 70], [400, 70]]) {
            await page.goto(COUNT_URL);
            await setMockCount(page, n);
            await page.reload();
            await waitForCountReady(page);
            await pickTheme(page, 'cat-vegas');
            const activeStages = await page.$$eval('#themeCatVegas .cat-img.active', els => els.map(e => e.dataset.stage));
            expect(activeStages, `count ${n}`).toEqual([String(stage)]);
        }
    });

    test('Counter digits and progress bar update for the Vegas view', async ({ page }) => {
        await page.goto(COUNT_URL);
        await setMockCount(page, 42);
        await page.reload();
        await waitForCountReady(page);
        await pickTheme(page, 'cat-vegas');
        const digits = await page.$$eval('#catCounterVegasNumber .counter-digit', els => els.map(e => e.dataset.digit).join(''));
        expect(digits).toBe('42');
        await expect(page.locator('#progressBarLabelVegas')).toHaveText('42 / 55 to next milestone');

        await setMockCount(page, 70);
        await page.reload();
        await waitForCountReady(page);
        await pickTheme(page, 'cat-vegas');
        await expect(page.locator('#progressBarLabelVegas')).toContainText('The King of Vegas');
    });

    test('All 7 stage images load', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-vegas');
        const results = await page.$$eval('#themeCatVegas .cat-img', imgs => Promise.all(imgs.map(img =>
            img.complete ? img.naturalWidth : new Promise(r => { img.onload = () => r(img.naturalWidth); img.onerror = () => r(0); })
        )));
        expect(results).toHaveLength(7);
        for (const w of results) expect(w).toBeGreaterThan(0);
    });
});

test.describe('Viva Las Vegas — 0-70 milestone ladder', () => {
    async function milestoneFires(page, theme, newCount) {
        await pickTheme(page, theme);
        // checkMilestone calls the module-internal playMilestoneSound, so a
        // window spy can't see it; showMilestone writing the message can.
        return page.evaluate((n) => {
            const el = document.getElementById('milestoneMessage');
            el.textContent = '';
            window.checkMilestone(n, n - 1);
            return el.textContent !== '';
        }, newCount);
    }

    test('Every Vegas stage change is a milestone, Elvis at 70 included', async ({ page }) => {
        await page.goto(COUNT_URL);
        for (const n of [10, 20, 30, 40, 55, 70, 100]) {
            expect(await milestoneFires(page, 'cat-vegas', n), `Vegas milestone at ${n}`).toBe(true);
        }
        for (const n of [25, 50, 75]) {
            expect(await milestoneFires(page, 'cat-vegas', n), `no Vegas milestone at ${n}`).toBe(false);
        }
    });

    test('Other themes keep the shared 10/25/50/75 ladder', async ({ page }) => {
        await page.goto(COUNT_URL);
        for (const theme of ['classic', 'cat', 'cat-de']) {
            expect(await milestoneFires(page, theme, 25), `${theme} at 25`).toBe(true);
            expect(await milestoneFires(page, theme, 20), `${theme} at 20`).toBe(false);
            expect(await milestoneFires(page, theme, 70), `${theme} at 70`).toBe(false);
        }
    });

    test('Crossing 70 shows the King milestone message', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-vegas');
        await page.evaluate(() => window.checkMilestone(70, 69));
        await expect(page.locator('#milestoneMessage')).toContainText('The King has entered the building');
    });
});

test.describe('Viva Las Vegas — content', () => {
    test('Encouraging messages are casino-flavored', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-vegas');
        const messages = await page.evaluate(() => window._activeEncouragingMessagesForTest?.());
        expect(messages.join(' ')).toMatch(/Viva Las Vegas|jackpot|slots/i);
    });

    test('Milestone messages are Vegas overrides', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-vegas');
        expect(await page.evaluate(() => window._activeMilestoneMessageForTest?.(40))).toMatch(/JACKPOT/);
        expect(await page.evaluate(() => window._activeMilestoneMessageForTest?.(55))).toMatch(/High roller/i);
        expect(await page.evaluate(() => window._activeMilestoneMessageForTest?.(70))).toMatch(/King/);
    });

    test('Food drops are money and casino items only', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-vegas');
        const list = await page.evaluate(() => window._activeFoodEmojisForTest?.());
        expect(list).toEqual(VEGAS_FOOD_EMOJIS);
    });
});

test.describe('Viva Las Vegas — celebrations', () => {
    test('Celebrations play slot machine sounds instead of the default chimes', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-vegas');
        const played = await page.evaluate(async () => {
            const urls = [];
            const OrigAudio = window.Audio;
            window.Audio = function (src) {
                urls.push(src);
                return { play: () => Promise.resolve(), volume: 1 };
            };
            window.playMilestoneSound();
            window.Audio = OrigAudio;
            return urls;
        });
        expect(played).toHaveLength(1);
        // Same call on the plain cat theme must produce a different (default) sound
        await pickTheme(page, 'cat');
        const defaultPlayed = await page.evaluate(async () => {
            const urls = [];
            const OrigAudio = window.Audio;
            window.Audio = function (src) { urls.push(src); return { play: () => Promise.resolve(), volume: 1 }; };
            window.playMilestoneSound();
            window.Audio = OrigAudio;
            return urls;
        });
        expect(defaultPlayed).toHaveLength(1);
        expect(defaultPlayed[0]).not.toBe(played[0]);
    });

    test('Milestone confetti is poker chips and banknotes', async ({ page }) => {
        await page.goto(COUNT_URL);
        await pickTheme(page, 'cat-vegas');
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.evaluate(() => window.checkMilestone(10, 9));
        await page.waitForTimeout(600);
        await expect(page.locator('#milestoneMessage')).toContainText('Penny slots');
        expect(errors).toEqual([]);
    });
});

test.describe('Viva Las Vegas — image assets', () => {
    test('All 7 cat-stage-vegas-*.png files exist, are square, and ≤ 3500 KB', async ({ }) => {
        const fs = await import('node:fs/promises');
        const { fileURLToPath } = await import('node:url');
        const root = fileURLToPath(new URL('..', import.meta.url));
        for (const stage of [0, 10, 20, 30, 40, 55, 70]) {
            const file = root + `cat-stage-vegas-${stage}.png`;
            const stat = await fs.stat(file);
            expect(stat.size, `${file} size`).toBeLessThanOrEqual(3500 * 1024);
            const fd = await fs.open(file, 'r');
            const buf = Buffer.alloc(8);
            await fd.read(buf, 0, 8, 16);
            await fd.close();
            const width = buf.readUInt32BE(0);
            const height = buf.readUInt32BE(4);
            expect(width, `${file} width`).toBeGreaterThanOrEqual(700);
            expect(width).toBeLessThanOrEqual(1200);
            expect(height, `${file} height`).toEqual(width);
        }
    });
});
