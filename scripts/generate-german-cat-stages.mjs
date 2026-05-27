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
    await input.pressSequentially(fullPrompt, { delay: 5 });

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
