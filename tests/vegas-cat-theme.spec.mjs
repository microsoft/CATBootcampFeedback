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
        for (const [n, stage] of [[0, 0], [9, 0], [10, 10], [25, 25], [50, 50], [75, 75], [100, 100], [129, 100], [130, 130], [400, 130]]) {
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
        await expect(page.locator('#progressBarLabelVegas')).toHaveText('42 / 50 to next milestone');

        await setMockCount(page, 135);
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
        expect(await page.evaluate(() => window._activeMilestoneMessageForTest?.(75))).toMatch(/JACKPOT/);
        expect(await page.evaluate(() => window._activeMilestoneMessageForTest?.(100))).toMatch(/High roller/i);
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
        for (const stage of [0, 10, 25, 50, 75, 100, 130]) {
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
