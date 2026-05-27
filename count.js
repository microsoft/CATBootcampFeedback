/**
 * Live Feedback Count Display — Gamified Celebration Edition
 * Two-panel layout: animated counter (left) + QR code (right)
 * Features: slot-machine digits, confetti bursts, milestone celebrations,
 *           progress ring, and rotating encouraging messages
 */

import { CONFIG } from './config.js';
import { getUrlParameter, formatDate, escapeHtml } from './utils.js';
import { apiGet } from './api.js';
import { getUserFriendlyErrorMessage } from './errors.js';

// Determine base URLs
const FEEDBACK_BASE_URL = window.location.origin + '/feedback.html';

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

// ── DOM elements ──────────────────────────────────────────────────────────────
const loadingState = document.getElementById('loadingState');
const countDisplay = document.getElementById('countDisplay');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const eventCodeDisplay = document.getElementById('eventCodeDisplay');
const lastUpdated = document.getElementById('lastUpdated');
const counterNumber = document.getElementById('counterNumber');
const milestoneMessageEl = document.getElementById('milestoneMessage');
const encouragingMessageEl = document.getElementById('encouragingMessage');
const confettiCanvas = document.getElementById('confettiCanvas');
const confettiCtx = confettiCanvas.getContext('2d');

// ── Milestones & Messages ─────────────────────────────────────────────────────
const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 300, 500];

const MILESTONE_MESSAGES = {
    10:  'First 10! The cats approve! \u{1F63A}',
    25:  '25 responses! A whole litter! \u{1F431}\u{1F431}\u{1F431}',
    50:  '50! The cats are purring! \u{1F638}',
    75:  '75! Cat-astrophically good! \u{1F3A9}\u{1F408}',
    100: 'Triple digits! Legendary cats! \u{1F43E}\u{1F3C6}',
    150: '150! The tuxedo cats are dancing! \u{1F57A}\u{1F431}',
    200: '200! Cat-tastic participation! \u{1F63B}',
    300: '300! The cats have taken over! \u{1F431}\u{1F431}\u{1F431}\u{1F431}\u{1F431}',
    500: '500! You\'ve unleashed the mega cats! \u{1F451}\u{1F408}\u200D\u2B1B'
};

const CLASSIC_MESSAGES = [
    'Paws up if you submitted feedback! \u{1F43E}',
    'You\'re the cat\'s meow! Keep it coming! \u{1F63A}',
    'Purr-fect participation so far! \u{1F431}',
    'Every response is the cat\'s pajamas! \u{1F3A9}\u{1F408}',
    'Feline good about this feedback! \u{1F638}',
    'Don\'t be a scaredy-cat \u2014 share your thoughts! \u{1F43E}',
    'We\'re not kitten around \u2014 your voice matters! \u{1F431}',
    'Cat-ch us if you can \u2014 submit your feedback! \u{1F63C}',
    'This feedback is claw-some! Keep going! \u{1F43E}',
    'Meow is the time to share your thoughts! \u{1F63A}'
];

const CAT_MESSAGES = [
    'Feed the cat! Submit your feedback! \u{1F431}',
    'The cat is hungry for your thoughts! \u{1F63F}',
    'Every response makes the cat purr-ier! \u{1F63A}',
    'Don\'t let the cat go hungry \u2014 share feedback! \u{1F43E}',
    'Look how happy you\'re making the cat! \u{1F638}',
    'Keep feeding \u2014 the cat wants more! \u{1F63B}',
    'Your feedback is the cat\'s favorite treat! \u{1F36A}',
    'A well-fed cat is a happy cat! \u{1F431}',
    'The cat says: More feedback, please! \u{1F63A}',
    'Fatten up the cat with your responses! \u{1F43E}'
];

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

// ══════════════════════════════════════════════════════════════════════════════
// SOUND SYSTEM (generates WAV in memory — no external files, no autoplay issues)
// ══════════════════════════════════════════════════════════════════════════════

let soundEnabled = true;
let audioUnlocked = false;

// Browsers block programmatic audio until a user gesture occurs on the page.
// We unlock by playing a silent buffer on the first click/touch/keydown,
// which grants the page permission for all future Audio.play() calls.
function unlockAudio() {
    if (audioUnlocked) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        // Also warm up an Audio element so the browser marks this page as audio-allowed
        const silence = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
        silence.volume = 0;
        silence.play().catch(() => {});
        audioUnlocked = true;
        console.log('Audio unlocked via user gesture');
    } catch (e) {
        console.warn('Audio unlock failed:', e);
    }
}

['click', 'touchstart', 'keydown'].forEach(evt => {
    document.addEventListener(evt, unlockAudio, { capture: true });
});

/**
 * Generate a WAV blob from an array of {freq, start, duration, type, volume} notes
 */
function generateWav(notes, totalDuration, sampleRate = 22050) {
    const numSamples = Math.floor(sampleRate * totalDuration);
    const buffer = new Float32Array(numSamples);

    notes.forEach(({ freq, start, duration, type = 'sine', volume = 0.15 }) => {
        const startSample = Math.floor(start * sampleRate);
        const endSample = Math.min(numSamples, Math.floor((start + duration) * sampleRate));

        for (let i = startSample; i < endSample; i++) {
            const t = (i - startSample) / sampleRate;
            const phase = 2 * Math.PI * freq * t;

            // Oscillator waveform
            let sample;
            if (type === 'sine') {
                sample = Math.sin(phase);
            } else if (type === 'triangle') {
                sample = 2 * Math.abs(2 * (t * freq - Math.floor(t * freq + 0.5))) - 1;
            } else if (type === 'square') {
                sample = Math.sin(phase) >= 0 ? 1 : -1;
            } else {
                sample = 2 * (t * freq - Math.floor(t * freq + 0.5)); // sawtooth
            }

            // Envelope: quick attack, sustain, then fade in last 30%
            const progress = (i - startSample) / (endSample - startSample);
            const attack = Math.min(1, progress * 20);  // fast attack
            const release = progress > 0.7 ? 1 - ((progress - 0.7) / 0.3) : 1;
            const envelope = attack * release;

            buffer[i] += sample * volume * envelope;
        }
    });

    // Clamp
    for (let i = 0; i < numSamples; i++) {
        buffer[i] = Math.max(-1, Math.min(1, buffer[i]));
    }

    // Encode to 16-bit PCM WAV
    const dataLength = numSamples * 2;
    const wavBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(wavBuffer);

    // WAV header
    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);       // PCM
    view.setUint16(22, 1, true);       // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataLength, true);

    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]));
        view.setInt16(44 + i * 2, s * 0x7FFF, true);
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
}

// Pre-generate all sound effects as blob URLs on load
const SOUNDS = {};

function initSounds() {
    // Munching: "nom nom nom" — short low pops with crunchy overlay
    SOUNDS.chime = URL.createObjectURL(generateWav([
        // Nom 1
        { freq: 120, start: 0, duration: 0.08, type: 'square', volume: 0.18 },
        { freq: 180, start: 0.01, duration: 0.06, type: 'sawtooth', volume: 0.12 },
        { freq: 600, start: 0.01, duration: 0.04, type: 'square', volume: 0.06 },
        // Nom 2
        { freq: 140, start: 0.13, duration: 0.08, type: 'square', volume: 0.20 },
        { freq: 200, start: 0.14, duration: 0.06, type: 'sawtooth', volume: 0.12 },
        { freq: 700, start: 0.14, duration: 0.04, type: 'square', volume: 0.06 },
        // Nom 3
        { freq: 160, start: 0.26, duration: 0.08, type: 'square', volume: 0.18 },
        { freq: 220, start: 0.27, duration: 0.06, type: 'sawtooth', volume: 0.12 },
        { freq: 800, start: 0.27, duration: 0.04, type: 'square', volume: 0.06 },
        // Satisfied purr tail
        { freq: 90, start: 0.35, duration: 0.15, type: 'sine', volume: 0.10 }
    ], 0.55));

    // Fanfare: C-E-G-C ascending
    SOUNDS.fanfare = URL.createObjectURL(generateWav([
        { freq: 523, start: 0, duration: 0.25, type: 'triangle', volume: 0.22 },
        { freq: 659, start: 0.12, duration: 0.25, type: 'triangle', volume: 0.22 },
        { freq: 784, start: 0.24, duration: 0.25, type: 'triangle', volume: 0.22 },
        { freq: 1047, start: 0.36, duration: 0.35, type: 'triangle', volume: 0.2 }
    ], 0.75));

    // Chaos: rapid ascending arpeggio with mixed tones
    SOUNDS.chaos = URL.createObjectURL(generateWav([
        { freq: 262, start: 0, duration: 0.15, type: 'square', volume: 0.12 },
        { freq: 330, start: 0.06, duration: 0.15, type: 'sawtooth', volume: 0.12 },
        { freq: 392, start: 0.12, duration: 0.15, type: 'square', volume: 0.12 },
        { freq: 523, start: 0.18, duration: 0.15, type: 'sawtooth', volume: 0.12 },
        { freq: 659, start: 0.24, duration: 0.15, type: 'square', volume: 0.12 },
        { freq: 784, start: 0.30, duration: 0.15, type: 'sawtooth', volume: 0.12 },
        { freq: 1047, start: 0.36, duration: 0.2, type: 'sine', volume: 0.15 },
        { freq: 1319, start: 0.42, duration: 0.25, type: 'sine', volume: 0.15 }
    ], 0.7));

    // Milestone: sustained major chord
    SOUNDS.milestone = URL.createObjectURL(generateWav([
        { freq: 523, start: 0, duration: 1.0, type: 'sine', volume: 0.15 },
        { freq: 659, start: 0, duration: 1.0, type: 'sine', volume: 0.12 },
        { freq: 784, start: 0, duration: 1.0, type: 'sine', volume: 0.12 },
        { freq: 1047, start: 0.1, duration: 0.9, type: 'sine', volume: 0.1 }
    ], 1.1));

    // Firework launch: rising whoosh (white noise filtered to rising pitch)
    SOUNDS.fireworkLaunch = URL.createObjectURL(generateWav([
        { freq: 200, start: 0, duration: 0.15, type: 'sawtooth', volume: 0.06 },
        { freq: 400, start: 0.05, duration: 0.15, type: 'sawtooth', volume: 0.08 },
        { freq: 800, start: 0.10, duration: 0.15, type: 'sawtooth', volume: 0.10 },
        { freq: 1600, start: 0.15, duration: 0.15, type: 'sawtooth', volume: 0.08 },
        { freq: 3000, start: 0.20, duration: 0.10, type: 'sine', volume: 0.05 }
    ], 0.35));

    // Firework explosion: crackling burst (multiple short high-freq pops)
    const explosionNotes = [];
    for (let i = 0; i < 20; i++) {
        explosionNotes.push({
            freq: 1000 + Math.random() * 4000,
            start: Math.random() * 0.15,
            duration: 0.03 + Math.random() * 0.06,
            type: i % 2 === 0 ? 'square' : 'sawtooth',
            volume: 0.06 + Math.random() * 0.06
        });
    }
    // Add a deep boom underneath
    explosionNotes.push({ freq: 80, start: 0, duration: 0.3, type: 'sine', volume: 0.2 });
    explosionNotes.push({ freq: 120, start: 0, duration: 0.2, type: 'sine', volume: 0.15 });
    SOUNDS.fireworkBoom = URL.createObjectURL(generateWav(explosionNotes, 0.4));

    console.log('Sound effects initialized');
}

function playSound(name) {
    if (!soundEnabled) return;
    const url = SOUNDS[name];
    if (!url) return;
    try {
        const audio = new Audio(url);
        audio.volume = 1.0;
        const playPromise = audio.play();
        if (playPromise) {
            playPromise.catch(err => {
                console.warn('Sound play blocked:', err.message);
                // If blocked, it means user hasn't interacted with page yet.
                // Sound will work after next user click.
            });
        }
    } catch (e) {
        console.warn('Sound error:', e);
    }
}

function playChime() { playSound('chime'); }
function playFanfare() { playSound('fanfare'); }
function playChaosSound() { playSound('chaos'); }
function playMilestoneSound() { playSound('milestone'); }

function initializeSoundToggle() {
    const soundToggle = document.getElementById('soundToggle');
    if (!soundToggle) return;

    const saved = sessionStorage.getItem('soundEnabled');
    if (saved !== null) {
        soundEnabled = saved === 'true';
        session.settings.soundEnabled = soundEnabled;
        soundToggle.value = soundEnabled ? 'on' : 'off';
    }

    soundToggle.addEventListener('change', (e) => {
        soundEnabled = e.target.value === 'on';
        session.settings.soundEnabled = soundEnabled;
        sessionStorage.setItem('soundEnabled', soundEnabled.toString());
        if (soundEnabled) playChime();
    });

    // Show a brief "click to enable sound" banner if sound is on
    if (soundEnabled && !audioUnlocked) {
        const banner = document.createElement('div');
        banner.id = 'soundBanner';
        banner.textContent = '🔊 Click anywhere to enable celebration sounds';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-align:center;font-size:1.1rem;font-weight:600;cursor:pointer;z-index:2000;';
        const bannerTarget = document.querySelector('.count-container') || document.body;
        bannerTarget.appendChild(banner);

        const dismissBanner = () => {
            unlockAudio();
            if (banner.parentNode) {
                banner.style.transition = 'opacity 0.3s';
                banner.style.opacity = '0';
                setTimeout(() => banner.remove(), 300);
            }
            // Play a confirmation chime after a tiny delay
            setTimeout(() => playChime(), 100);
        };

        banner.addEventListener('click', dismissBanner);
        // Also dismiss on any page click
        document.addEventListener('click', dismissBanner, { once: true });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFETTI SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

let confettiParticles = [];
let confettiAnimationId = null;
const CONFETTI_COLORS = ['#667eea', '#764ba2', '#f093fb', '#ffd700', '#ff6b6b', '#4cdf7f', '#00d2ff', '#ff9a9e'];

function initConfettiCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    });
}

function createConfettiParticle(x, y) {
    return {
        x, y,
        vx: (Math.random() - 0.5) * 14,
        vy: Math.random() * -16 - 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        gravity: 0.35,
        opacity: 1,
        fadeRate: 0.006 + Math.random() * 0.004,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
    };
}

function burstConfetti(count) {
    const counterEl = document.querySelector('.left-section');
    if (!counterEl) return;

    const rect = counterEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < count; i++) {
        confettiParticles.push(createConfettiParticle(
            centerX + (Math.random() - 0.5) * 120,
            centerY + (Math.random() - 0.5) * 60
        ));
    }

    if (!confettiAnimationId) {
        animateConfetti();
    }
}

function animateConfetti() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    // Filter out dead confetti particles
    confettiParticles = confettiParticles.filter(p => p.opacity > 0 && p.y < confettiCanvas.height + 50);

    // Filter out finished characters
    activeCharacters = activeCharacters.filter(c => c.opacity > 0 && c.x > -80 && c.x < confettiCanvas.width + 80 && c.y > -80 && c.y < confettiCanvas.height + 80);

    // Filter out finished fireworks
    fireworks = fireworks.filter(fw => fw.alive);
    fireworkSparks = fireworkSparks.filter(s => s.opacity > 0.05);

    // If nothing left to draw, do a final clear and stop the loop
    if (confettiParticles.length === 0 && activeCharacters.length === 0 && fireworks.length === 0 && fireworkSparks.length === 0) {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiAnimationId = null;
        return;
    }

    // Draw confetti particles
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

    // Draw emoji characters
    activeCharacters.forEach(c => {
        c.x += c.vx;
        c.y += c.vy;
        if (c.gravity) c.vy += c.gravity;
        c.opacity -= c.fadeRate;
        c.age = (c.age || 0) + 1;

        // Bobbing motion for walking characters
        const bobOffset = c.bob ? Math.sin(c.age * c.bobSpeed) * c.bobAmount : 0;

        confettiCtx.save();
        confettiCtx.globalAlpha = Math.max(0, c.opacity);
        confettiCtx.font = `${c.size}px serif`;
        confettiCtx.textAlign = 'center';
        confettiCtx.textBaseline = 'middle';

        // Flip horizontally if moving left
        if (c.vx < 0) {
            confettiCtx.scale(-1, 1);
            confettiCtx.fillText(c.emoji, -c.x, c.y + bobOffset);
        } else {
            confettiCtx.fillText(c.emoji, c.x, c.y + bobOffset);
        }

        confettiCtx.restore();
    });

    // Draw fireworks (rockets + sparks)
    drawFireworks();

    confettiAnimationId = requestAnimationFrame(animateConfetti);
}

// ══════════════════════════════════════════════════════════════════════════════
// FIREWORKS SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

const FIREWORK_COLORS = [
    ['#ff6b6b', '#ffd700', '#ff9a9e'],          // warm red/gold
    ['#667eea', '#00d2ff', '#4cdf7f'],           // cool blue/green
    ['#f093fb', '#764ba2', '#ffd700'],           // purple/pink/gold
    ['#4cdf7f', '#ffd700', '#ff6b6b'],           // green/gold/red
    ['#00d2ff', '#667eea', '#f093fb'],           // cyan/blue/pink
];

let fireworks = [];      // Active rockets
let fireworkSparks = []; // Explosion sparks

/**
 * Launch a firework rocket from the bottom of the screen
 */
function launchFirework(x) {
    // Keep fireworks on the left half so they don't cover the QR code
    const startX = x || confettiCanvas.width * (0.05 + Math.random() * 0.4);
    const targetY = confettiCanvas.height * (0.1 + Math.random() * 0.3);
    const palette = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];

    fireworks.push({
        x: startX,
        y: confettiCanvas.height + 10,
        targetY,
        vy: -(8 + Math.random() * 4),
        size: 3,
        color: palette[0],
        palette,
        trail: [],
        alive: true
    });

    playSound('fireworkLaunch');

    if (!confettiAnimationId) {
        animateConfetti();
    }
}

/**
 * Explode a firework into sparks at its position
 */
function explodeFirework(fw) {
    const sparkCount = 40 + Math.floor(Math.random() * 30);
    for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.3;
        const speed = 2 + Math.random() * 5;
        fireworkSparks.push({
            x: fw.x,
            y: fw.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: fw.palette[Math.floor(Math.random() * fw.palette.length)],
            size: 2 + Math.random() * 3,
            gravity: 0.06,
            opacity: 1,
            fadeRate: 0.015 + Math.random() * 0.015,
            trail: Math.random() > 0.5
        });
    }

    playSound('fireworkBoom');
}

/**
 * Draw firework rockets and sparks — called from animateConfetti loop
 */
function drawFireworks() {
    // Update and draw rockets
    fireworks = fireworks.filter(fw => fw.alive);
    fireworks.forEach(fw => {
        fw.age = (fw.age || 0) + 1;

        // Trail
        fw.trail.push({ x: fw.x, y: fw.y });
        if (fw.trail.length > 8) fw.trail.shift();

        fw.y += fw.vy;
        fw.vy *= 0.98;
        fw.x += (Math.random() - 0.5) * 0.5; // slight wobble

        // Draw trail
        fw.trail.forEach((t, i) => {
            const trailOpacity = (i / fw.trail.length) * 0.5;
            confettiCtx.save();
            confettiCtx.globalAlpha = trailOpacity;
            confettiCtx.fillStyle = fw.color;
            confettiCtx.beginPath();
            confettiCtx.arc(t.x, t.y, fw.size * 0.6, 0, Math.PI * 2);
            confettiCtx.fill();
            confettiCtx.restore();
        });

        // Draw rocket head (bright dot)
        confettiCtx.save();
        confettiCtx.globalAlpha = 1;
        confettiCtx.fillStyle = '#ffffff';
        confettiCtx.shadowColor = fw.color;
        confettiCtx.shadowBlur = 15;
        confettiCtx.beginPath();
        confettiCtx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
        confettiCtx.fill();
        confettiCtx.restore();

        // Explode when: reached target, lost upward momentum, off-screen, or too old
        if (fw.y <= fw.targetY || fw.vy > -1 || fw.y < -20 || fw.age > 120) {
            explodeFirework(fw);
            fw.alive = false;
        }
    });

    // Update and draw sparks — kill sparks below 0.05 opacity to prevent ghost dots
    fireworkSparks = fireworkSparks.filter(s => s.opacity > 0.05);
    fireworkSparks.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += s.gravity;
        s.vx *= 0.98;
        s.opacity -= s.fadeRate;

        if (s.opacity <= 0.05) return; // skip drawing nearly-dead sparks

        confettiCtx.save();
        confettiCtx.globalAlpha = s.opacity;
        confettiCtx.fillStyle = s.color;

        // Only apply glow when spark is bright enough
        if (s.opacity > 0.3) {
            confettiCtx.shadowColor = s.color;
            confettiCtx.shadowBlur = 6;
        }

        confettiCtx.beginPath();
        confettiCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        confettiCtx.fill();

        // Spark trail
        if (s.trail && s.opacity > 0.2) {
            confettiCtx.globalAlpha = s.opacity * 0.4;
            confettiCtx.shadowBlur = 0;
            confettiCtx.beginPath();
            confettiCtx.arc(s.x - s.vx, s.y - s.vy, s.size * 0.5, 0, Math.PI * 2);
            confettiCtx.fill();
        }

        confettiCtx.restore();
    });
}

/**
 * Launch a volley of fireworks staggered over time
 */
function fireworkVolley(count) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => launchFirework(), i * 300 + Math.random() * 200);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// EMOJI CHARACTER ANIMATION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

const CHARACTER_POOL = {
    cats: ['\u{1F431}', '\u{1F408}', '\u{1F63A}', '\u{1F638}', '\u{1F63B}', '\u{1F63C}', '\u{1F640}', '\u{1F408}\u200D\u2B1B'],
    ducks: ['\u{1F986}', '\u{1F425}', '\u{1F424}'],
    bonus: ['\u{1F984}', '\u{1F419}', '\u{1F420}', '\u{1F98B}', '\u{1F38A}', '\u{2B50}', '\u{1F31F}', '\u{1F680}', '\u{1F389}', '\u{1F4AB}']
};

let activeCharacters = [];

function spawnCharacter(emoji, options = {}) {
    const defaults = {
        x: options.x !== undefined ? options.x : (Math.random() < 0.5 ? -40 : confettiCanvas.width + 40),
        y: options.y !== undefined ? options.y : confettiCanvas.height * (0.5 + Math.random() * 0.4),
        vx: options.vx !== undefined ? options.vx : 0,
        vy: options.vy !== undefined ? options.vy : 0,
        size: options.size || 40,
        opacity: 1,
        fadeRate: options.fadeRate || 0.003,
        gravity: options.gravity || 0,
        bob: options.bob !== undefined ? options.bob : true,
        bobSpeed: options.bobSpeed || 0.08 + Math.random() * 0.04,
        bobAmount: options.bobAmount || 3 + Math.random() * 3,
        age: 0
    };

    // If spawning from left, move right; if from right, move left
    if (defaults.vx === 0 && options.vx === undefined) {
        defaults.vx = defaults.x < confettiCanvas.width / 2 ? (1.5 + Math.random() * 2) : -(1.5 + Math.random() * 2);
    }

    const character = { emoji, ...defaults };
    activeCharacters.push(character);

    // Start the unified animation loop if not already running
    if (!confettiAnimationId) {
        animateConfetti();
    }
}

function spawnFloatingCat() {
    const cats = CHARACTER_POOL.cats;
    const emoji = cats[Math.floor(Math.random() * cats.length)];

    // Float up from center area
    const counterEl = document.querySelector('.left-section');
    let startX = confettiCanvas.width / 2;
    let startY = confettiCanvas.height / 2;

    if (counterEl) {
        const rect = counterEl.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
    }

    spawnCharacter(emoji, {
        x: startX + (Math.random() - 0.5) * 100,
        y: startY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1.5 - Math.random() * 1.5,
        size: 50 + Math.random() * 20,
        fadeRate: 0.005,
        gravity: -0.02,
        bob: false
    });
}

function screenGlow() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: radial-gradient(ellipse at center, rgba(102,126,234,0.3) 0%, transparent 70%);
        pointer-events: none; z-index: 999; opacity: 1;
        transition: opacity 1.5s ease-out;
    `;
    const container = document.querySelector('.count-container') || document.body;
    container.appendChild(overlay);
    requestAnimationFrame(() => {
        overlay.style.opacity = '0';
    });
    setTimeout(() => overlay.remove(), 1600);
}

function screenShake() {
    const container = document.querySelector('.count-container');
    if (!container) return;
    let shakeCount = 0;
    const maxShakes = 6;
    const shakeInterval = setInterval(() => {
        const x = (Math.random() - 0.5) * 8;
        const y = (Math.random() - 0.5) * 8;
        container.style.transform = `translate(${x}px, ${y}px)`;
        shakeCount++;
        if (shakeCount >= maxShakes) {
            clearInterval(shakeInterval);
            container.style.transform = '';
        }
    }, 50);
}

// ══════════════════════════════════════════════════════════════════════════════
// CELEBRATION TRIGGERS
// ══════════════════════════════════════════════════════════════════════════════

function triggerCelebration(count, oldCount) {
    const level = celebrationLevel;

    // Drop food to the cat on every celebration
    dropFood();

    if (level === 1) {
        // Chill: small confetti + floating cat + chime
        burstConfetti(20);
        spawnFloatingCat();
        playChime();
    } else if (level === 2) {
        // Party: medium confetti + screen glow + walking cats + duck + fanfare
        burstConfetti(60);
        screenGlow();
        playFanfare();
        // Spawn 2-3 walking cats
        const catCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < catCount; i++) {
            setTimeout(() => {
                const cats = CHARACTER_POOL.cats;
                spawnCharacter(cats[Math.floor(Math.random() * cats.length)], {
                    size: 35 + Math.random() * 15
                });
            }, i * 300);
        }
        // Spawn 1 duck
        setTimeout(() => {
            const ducks = CHARACTER_POOL.ducks;
            spawnCharacter(ducks[Math.floor(Math.random() * ducks.length)], {
                size: 30 + Math.random() * 10
            });
        }, 500);
    } else if (level === 3) {
        // Chaos: massive confetti + shake + glow + cat army + duck squad + bonus + wild sound
        burstConfetti(150);
        screenShake();
        screenGlow();
        playChaosSound();
        // Spawn 5-8 cats
        const catCount = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < catCount; i++) {
            setTimeout(() => {
                const cats = CHARACTER_POOL.cats;
                spawnCharacter(cats[Math.floor(Math.random() * cats.length)], {
                    size: 30 + Math.random() * 30
                });
            }, i * 200);
        }
        // Spawn 2-4 ducks
        const duckCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < duckCount; i++) {
            setTimeout(() => {
                const ducks = CHARACTER_POOL.ducks;
                spawnCharacter(ducks[Math.floor(Math.random() * ducks.length)], {
                    size: 25 + Math.random() * 15
                });
            }, 300 + i * 250);
        }
        // Spawn 2-4 bonus characters
        const bonusCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bonusCount; i++) {
            setTimeout(() => {
                const bonus = CHARACTER_POOL.bonus;
                spawnCharacter(bonus[Math.floor(Math.random() * bonus.length)], {
                    size: 30 + Math.random() * 20
                });
            }, 600 + i * 200);
        }
    }

    // Always check milestones
    checkMilestone(count, oldCount);
}

// ══════════════════════════════════════════════════════════════════════════════
// MILESTONE SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

function getNextMilestone(count) {
    for (const m of MILESTONES) {
        if (count < m) return m;
    }
    return Math.ceil((count + 1) / 100) * 100;
}

function getPrevMilestone(count) {
    let prev = 0;
    for (const m of MILESTONES) {
        if (count >= m) prev = m;
        else break;
    }
    return prev;
}

function checkMilestone(newCount, oldCount) {
    for (const m of MILESTONES) {
        if (newCount >= m && oldCount < m) {
            showMilestone(m);
            playMilestoneSound();

            // Scale milestone celebration by level — fireworks at all levels!
            const level = celebrationLevel;
            if (level === 1) {
                // Chill milestone: 1 firework + confetti + floating cat
                burstConfetti(60);
                spawnFloatingCat();
                fireworkVolley(1);
            } else if (level === 2) {
                // Party milestone: 3 fireworks + confetti + glow + cats
                burstConfetti(150);
                screenGlow();
                fireworkVolley(3);
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => spawnFloatingCat(), i * 200);
                }
            } else if (level === 3) {
                // Chaos milestone: 6-8 fireworks + confetti + shake + full parade
                burstConfetti(300);
                screenShake();
                screenGlow();
                fireworkVolley(6 + Math.floor(Math.random() * 3));
                // Staggered second wave of fireworks
                setTimeout(() => fireworkVolley(4), 1500);
                for (let i = 0; i < 8; i++) {
                    setTimeout(() => spawnFloatingCat(), i * 150);
                }
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => {
                        const bonus = CHARACTER_POOL.bonus;
                        spawnCharacter(bonus[Math.floor(Math.random() * bonus.length)], {
                            size: 40 + Math.random() * 25,
                            fadeRate: 0.003
                        });
                    }, 500 + i * 200);
                }
            }
            return;
        }
    }
}

if (typeof window !== 'undefined') {
    window.checkMilestone = checkMilestone;
    window.playMilestoneSound = playMilestoneSound;
}

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

// ══════════════════════════════════════════════════════════════════════════════
// ENCOURAGING MESSAGES
// ══════════════════════════════════════════════════════════════════════════════

let encouragingIndex = 0;

function startEncouragingMessages() {
    updateEncouragingMessage();
    setInterval(updateEncouragingMessage, 6000);
}

function updateEncouragingMessage() {
    encouragingMessageEl.style.opacity = '0';
    setTimeout(() => {
        const messages = getEncouragingMessages();
        encouragingMessageEl.textContent = messages[encouragingIndex % messages.length];
        encouragingMessageEl.style.opacity = '1';
        encouragingIndex = (encouragingIndex + 1) % messages.length;
    }, 500);
}

// ══════════════════════════════════════════════════════════════════════════════
// THEME SYSTEM & PROGRESS DISPLAY
// ══════════════════════════════════════════════════════════════════════════════

let currentTheme = 'classic'; // 'classic' or 'cat'

function initProgressRing() {
    sizeProgressRing();
    window.addEventListener('resize', () => {
        clearTimeout(window._ringResizeTimer);
        window._ringResizeTimer = setTimeout(sizeProgressRing, 200);
    });
    document.addEventListener('fullscreenchange', () => {
        setTimeout(sizeProgressRing, 300);
    });
}

function sizeProgressRing() {
    const leftSection = document.querySelector('.left-section');
    if (!leftSection) return;

    if (currentTheme === 'classic') {
        // Classic: size the SVG ring
        const availableW = leftSection.clientWidth - 40;
        const availableH = leftSection.clientHeight * 0.62;
        const size = Math.max(200, Math.min(availableW, availableH, 550));
        const strokeWidth = Math.max(8, size * 0.028);
        const radius = (size - strokeWidth * 2) / 2;
        const circumference = 2 * Math.PI * radius;

        const svg = document.getElementById('progressRing');
        if (svg) {
            svg.setAttribute('width', size);
            svg.setAttribute('height', size);
            const ringBg = document.getElementById('ringBg');
            const ringFill = document.getElementById('ringFill');
            [ringBg, ringFill].forEach(circle => {
                circle.setAttribute('cx', size / 2);
                circle.setAttribute('cy', size / 2);
                circle.setAttribute('r', radius);
                circle.setAttribute('stroke-width', strokeWidth);
            });
            ringFill.setAttribute('stroke-dasharray', circumference);
            ringFill.dataset.circumference = circumference;
            updateProgressRing(session.count);
        }

        const counterEl = document.getElementById('counterNumber');
        if (counterEl) counterEl.style.fontSize = Math.max(32, size * 0.22) + 'px';
    } else {
        // Cat themes: scale counter font for whichever cat counter is active
        const availableW = leftSection.clientWidth - 40;
        const counterId = currentTheme === 'cat-de' ? 'catCounterDENumber' : 'catCounterNumber';
        const catCounter = document.getElementById(counterId);
        if (catCounter) catCounter.style.fontSize = Math.max(32, Math.min(availableW * 0.14, 64)) + 'px';
    }
    sizeCat();
}

function updateProgressRing(count) {
    if (currentTheme === 'classic') {
        // Classic: update SVG ring stroke-dashoffset
        const ringFill = document.getElementById('ringFill');
        if (!ringFill) return;
        const circumference = parseFloat(ringFill.dataset.circumference);
        if (!circumference) return;

        const nextMilestone = getNextMilestone(count);
        const prevMilestone = getPrevMilestone(count);
        const range = nextMilestone - prevMilestone;
        const progress = range > 0 ? Math.min(1, (count - prevMilestone) / range) : 0;
        ringFill.style.strokeDashoffset = circumference * (1 - progress);
    }

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
}

function setTheme(theme) {
    currentTheme = theme;
    session.settings.theme = currentTheme;
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
    updateDigitDisplay(session.count);
    updateProgressRing(session.count);
    updateCatState(session.count);
    // Update encouraging message for new theme
    updateEncouragingMessage();
}

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

// ══════════════════════════════════════════════════════════════════════════════
// CAT MASCOT SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

const CAT_STAGES = [0, 10, 25, 50, 75, 100];
THEME_CONTENT.cat.stages = CAT_STAGES;

function initCat() {
    const imgs = document.querySelectorAll('#themeCat .cat-img, #themeCatDE .cat-img');
    if (!imgs.length) return;

    sizeCat();

    // Set initial state without animation
    imgs.forEach(img => { img.style.transition = 'none'; });
    updateCatState(session.count);
    imgs[0].getBoundingClientRect(); // force reflow
    imgs.forEach(img => { img.style.transition = 'opacity 0.8s ease-out'; });
}

function getCatStateParam(count) {
    // Returns 0.0 (skinniest/saddest) to 1.0 (fattest/happiest)
    if (count <= 0) return 0;

    const prevM = getPrevMilestone(count);
    const nextM = getNextMilestone(count);
    const tierIndex = MILESTONES.indexOf(prevM);
    const baseTier = tierIndex >= 0 ? (tierIndex + 1) / MILESTONES.length : 0;

    const range = nextM - prevM;
    const intraProgress = range > 0 ? (count - prevM) / range : 0;
    const intraContribution = intraProgress / MILESTONES.length;

    // 0.05 base bump for any count > 0, plus tier + intra progress
    return Math.min(1, 0.05 + baseTier * 0.85 + intraContribution * 0.85);
}

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

function sizeCat() {
    // Cat container uses flex: 1 and sizes itself via CSS
    // No explicit JS sizing needed — the flex layout handles it
}

function celebrateCatMilestone() {
    const containerId = currentTheme === 'cat-de' ? 'catContainerDE' : 'catContainer';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.style.transform = 'scale(1.2) translateY(-10px)';
    setTimeout(() => {
        container.style.transform = 'scale(1)';
    }, 400);
}

const FOOD_EMOJIS = ['\u{1F41F}', '\u{1F969}', '\u{1F357}', '\u{1F356}', '\u{1F36A}', '\u{1F363}', '\u{1F35B}'];
THEME_CONTENT.cat.foodEmojis = FOOD_EMOJIS;

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

function dropFood() {
    const counter = document.getElementById('counterNumber');
    const cat = document.getElementById(currentTheme === 'cat-de' ? 'catContainerDE' : 'catContainer');
    if (!counter || !cat) return;

    const counterRect = counter.getBoundingClientRect();
    const catRect = cat.getBoundingClientRect();
    const leftSection = document.querySelector('.left-section');
    if (!leftSection) return;
    const sectionRect = leftSection.getBoundingClientRect();

    const food = document.createElement('div');
    const emojis = getCurrentThemeContent().foodEmojis;
    if (!emojis || !emojis.length) return;     // Classic theme: no food drops
    food.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    food.style.cssText = `
        position: absolute;
        font-size: 1.8rem;
        pointer-events: none;
        z-index: 100;
        transition: none;
        left: ${counterRect.left - sectionRect.left + counterRect.width / 2 - 14}px;
        top: ${counterRect.bottom - sectionRect.top}px;
        opacity: 1;
    `;
    leftSection.appendChild(food);

    // Animate drop to cat
    const targetY = catRect.top - sectionRect.top + catRect.height * 0.3;
    requestAnimationFrame(() => {
        food.style.transition = 'top 0.5s cubic-bezier(0.34, 0, 0.64, 1), opacity 0.2s ease';
        food.style.top = targetY + 'px';
        setTimeout(() => {
            food.style.opacity = '0';
            food.style.transform = 'scale(0.3)';
            food.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            setTimeout(() => food.remove(), 250);
        }, 450);
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLOT-MACHINE DIGIT DISPLAY
// ══════════════════════════════════════════════════════════════════════════════

function createDigitReel() {
    const reel = document.createElement('div');
    reel.className = 'counter-digit';
    reel.dataset.digit = '0';

    const column = document.createElement('div');
    column.className = 'digit-column';

    for (let i = 0; i <= 9; i++) {
        const span = document.createElement('span');
        span.textContent = i;
        column.appendChild(span);
    }

    reel.appendChild(column);
    return reel;
}

function updateDigitDisplay(newCount) {
    const digits = String(newCount).split('');

    // Update all three counter elements (classic + cat + cat-de)
    ['counterNumber', 'catCounterNumber', 'catCounterDENumber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) updateDigitContainer(el, digits);
    });
}

function updateDigitContainer(container, digits) {
    const currentReels = container.querySelectorAll('.counter-digit');

    // Rebuild reels if digit count changed
    if (currentReels.length !== digits.length) {
        const oldValues = Array.from(currentReels).map(r => parseInt(r.dataset.digit) || 0);
        container.innerHTML = '';

        digits.forEach((d, i) => {
            const reel = createDigitReel();
            container.appendChild(reel);

            // Preserve position of digits that existed before (right-aligned)
            const oldIndex = i - (digits.length - oldValues.length);
            if (oldIndex >= 0 && oldIndex < oldValues.length) {
                const column = reel.querySelector('.digit-column');
                column.style.transition = 'none';
                column.style.transform = `translateY(-${oldValues[oldIndex]}em)`;
                // Force reflow then re-enable transition
                void column.offsetWidth;
                column.style.transition = '';
            }
        });
    }

    // Animate each reel to its target digit with staggered delay
    const reels = container.querySelectorAll('.counter-digit');
    digits.forEach((d, i) => {
        const digit = parseInt(d);
        const column = reels[i].querySelector('.digit-column');
        setTimeout(() => {
            column.style.transform = `translateY(-${digit}em)`;
            reels[i].dataset.digit = digit;
        }, i * 80);
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    initConfettiCanvas();
    initSounds();
    initialize();
});

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
        await generateQRCode();

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

// ══════════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ══════════════════════════════════════════════════════════════════════════════

async function loadEventDetails(code) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockLoadEventDetails(code);
    }
    try {
        const response = await apiGet(`/events/${code}/count`);
        return response.data || response;
    } catch (error) {
        console.error('Error loading event:', error);
        throw error;
    }
}

async function loadModuleDetails(code, modId) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockLoadModuleDetails(code, modId);
    }
    try {
        const response = await apiGet(`/events/${code}/modules/${modId}/count`);
        return response.data || response;
    } catch (error) {
        console.error('Error loading module:', error);
        throw error;
    }
}

function mockLoadModuleDetails(code, modId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockModules = {
                'CSA1B2C3_1': {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    eventName: 'CAT Bootcamp Q1-2026',
                    trainingTrack: 'Q1-2026',
                    eventModuleId: 1,
                    moduleId: 1,
                    moduleName: 'Introduction to CAT Bootcamp',
                    speakerName: 'John Doe',
                    deliveryOrder: 1,
                    deliveryDate: '2026-02-15T09:00:00',
                    count: Math.floor(Math.random() * 10) + 5
                },
                'TEST123_2': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    eventName: 'Test Event',
                    trainingTrack: 'Q1-2026',
                    eventModuleId: 2,
                    moduleId: 2,
                    moduleName: 'Building Your First Copilot',
                    speakerName: 'Jane Smith',
                    deliveryOrder: 1,
                    deliveryDate: '2026-02-16T09:00:00',
                    count: Math.floor(Math.random() * 8) + 3
                },
                'TEST123_3': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    eventName: 'Test Event',
                    trainingTrack: 'Q1-2026',
                    eventModuleId: 3,
                    moduleId: 3,
                    moduleName: 'Advanced Copilot Features',
                    speakerName: 'Bob Johnson',
                    deliveryOrder: 2,
                    deliveryDate: '2026-02-16T10:00:00',
                    count: Math.floor(Math.random() * 6) + 2
                }
            };

            const key = `${code}_${modId}`;
            resolve(mockModules[key] || null);
        }, CONFIG.MOCK_API_DELAY);
    });
}

function mockLoadEventDetails(code) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockEvents = {
                'CSA1B2C3': {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    eventName: 'CAT Bootcamp Q1-2026',
                    startDate: '2026-02-15',
                    trainingTrack: 'Q1-2026',
                    totalCount: 0,
                    modules: [
                        {
                            eventModuleId: 1,
                            moduleId: 1,
                            moduleName: 'Introduction to CAT Bootcamp',
                            speakerName: 'John Doe',
                            deliveryOrder: 1,
                            feedbackCount: 0
                        }
                    ]
                },
                'TEST123': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    eventName: 'Test Event',
                    startDate: '2026-02-16',
                    trainingTrack: 'Q1-2026',
                    totalCount: 0,
                    modules: [
                        {
                            eventModuleId: 2,
                            moduleId: 2,
                            moduleName: 'Building Your First Copilot',
                            speakerName: 'Jane Smith',
                            deliveryOrder: 1,
                            feedbackCount: 10
                        },
                        {
                            eventModuleId: 3,
                            moduleId: 3,
                            moduleName: 'Advanced Copilot Features',
                            speakerName: 'Bob Johnson',
                            deliveryOrder: 2,
                            feedbackCount: 8
                        }
                    ]
                }
            };

            resolve(mockEvents[code] || null);
        }, CONFIG.MOCK_API_DELAY);
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENT SELECTOR (fallback when no event code in URL)
// ══════════════════════════════════════════════════════════════════════════════

async function showEventSelector() {
    const eventSelectionView = document.getElementById('eventSelectionView');
    const eventSelect = document.getElementById('eventSelect');
    const continueBtn = document.getElementById('continueBtn');
    const viewModeSelection = document.getElementById('viewModeSelection');
    const moduleSelect = document.getElementById('moduleSelect');

    loadingState.style.display = 'none';
    eventSelectionView.style.display = 'block';

    try {
        const response = await apiGet('/events');
        const events = response.data || response;

        if (!events || events.length === 0) {
            showError('No active events found.');
            return;
        }

        eventSelect.innerHTML = '<option value="">-- Select an Event --</option>' +
            events.filter(e => e.isActive).map(e =>
                `<option value="${e.eventCode}" data-event-id="${e.eventId}">${escapeHtml(e.eventName || e.eventCode)} - ${formatDate(e.startDate)}</option>`
            ).join('');

        eventSelect.addEventListener('change', async function() {
            const selectedCode = this.value;
            if (selectedCode) {
                viewModeSelection.style.display = 'block';
                continueBtn.disabled = false;

                const selectedEvent = events.find(e => e.eventCode === selectedCode);
                if (selectedEvent && selectedEvent.modules) {
                    const activeModules = selectedEvent.modules.filter(m =>
                        m.eventModuleId && m.moduleName && m.isActive === true
                    );
                    moduleSelect.innerHTML = '<option value="">-- Select a Module --</option>' +
                        activeModules.map(m =>
                            `<option value="${m.eventModuleId}">${escapeHtml(m.moduleName)} - ${escapeHtml(m.speakerName)}</option>`
                        ).join('');
                }
            } else {
                viewModeSelection.style.display = 'none';
                continueBtn.disabled = true;
            }
        });

        document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
            radio.addEventListener('change', function() {
                moduleSelect.style.display = this.value === 'module' ? 'block' : 'none';
            });
        });

        continueBtn.addEventListener('click', function() {
            const selectedCode = eventSelect.value;
            const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
            const selectedModuleId = moduleSelect.value;

            if (selectedCode) {
                const url = new URL(window.location);
                url.searchParams.set('code', selectedCode);

                if (viewMode === 'module' && selectedModuleId) {
                    url.searchParams.set('module', selectedModuleId);
                }

                window.history.pushState({}, '', url);
                window.location.reload();
            }
        });
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Unable to load events.');
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// COUNT UPDATES
// ══════════════════════════════════════════════════════════════════════════════

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
            // Update slot-machine digit display
            updateDigitDisplay(count);

            // Pulse animation on active counter
            const activeCounter =
                currentTheme === 'classic' ? document.getElementById('counterNumber')
              : currentTheme === 'cat-de'  ? document.getElementById('catCounterDENumber')
              :                              document.getElementById('catCounterNumber');
            if (activeCounter) {
                activeCounter.classList.remove('pulse');
                void activeCounter.offsetWidth;
                activeCounter.classList.add('pulse');
            }

            // Celebrations only after initial load
            if (!session.isFirstLoad && count > oldCount) {
                triggerCelebration(count, oldCount);
            }

            // Update progress ring and cat
            updateProgressRing(count);
            updateCatState(count);

            session.count = count;
            session.isFirstLoad = false;
        }

        // Always update timestamp
        const now = new Date();
        lastUpdated.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

    } catch (error) {
        console.error('Error updating count:', error);
    }
}

async function getFeedbackCount(code) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockGetFeedbackCount(code);
    }
    try {
        const response = await apiGet(`/events/${code}/count`);
        return response.data || response;
    } catch (error) {
        console.error('Error fetching count:', error);
        return { totalCount: 0 };
    }
}

async function getModuleFeedbackCount(code, modId) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockGetModuleFeedbackCount(code, modId);
    }
    try {
        const response = await apiGet(`/events/${code}/modules/${modId}/count`);
        return response.data || response;
    } catch (error) {
        console.error('Error fetching module count:', error);
        return { count: 0 };
    }
}

function mockGetModuleFeedbackCount(code, modId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const allFeedback = JSON.parse(localStorage.getItem('bootcampFeedback')) || [];
            const moduleFeedback = allFeedback.filter(
                fb => fb.eventCode === code && fb.eventModuleId === parseInt(modId)
            );
            resolve({ count: moduleFeedback.length });
        }, CONFIG.MOCK_API_DELAY);
    });
}

function mockGetFeedbackCount(code) {
    return new Promise((resolve) => {
        const allFeedback = JSON.parse(localStorage.getItem('bootcampFeedback')) || [];
        const eventFeedback = allFeedback.filter(fb => fb.eventCode === code);
        resolve({ totalCount: eventFeedback.length });
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// LIVE UPDATES
// ══════════════════════════════════════════════════════════════════════════════

function startLiveUpdates() {
    refreshTimer = setInterval(() => {
        updateCount();
    }, currentRefreshInterval);
}

function stopLiveUpdates() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

function restartLiveUpdates() {
    stopLiveUpdates();
    startLiveUpdates();
}

function initializeRefreshIntervalSelector() {
    const refreshIntervalSelect = document.getElementById('refreshInterval');
    if (!refreshIntervalSelect) return;

    const savedInterval = sessionStorage.getItem('countRefreshInterval');
    if (savedInterval) {
        currentRefreshInterval = parseInt(savedInterval);
        session.settings.refreshInterval = currentRefreshInterval;
        refreshIntervalSelect.value = savedInterval;
    }

    refreshIntervalSelect.addEventListener('change', (e) => {
        const newInterval = parseInt(e.target.value);
        currentRefreshInterval = newInterval;
        session.settings.refreshInterval = currentRefreshInterval;
        sessionStorage.setItem('countRefreshInterval', newInterval.toString());
        restartLiveUpdates();
        updateCount();
    });
}

function initializeCelebrationLevelSelector() {
    const celebrationLevelSelect = document.getElementById('celebrationLevel');
    if (!celebrationLevelSelect) return;

    const savedLevel = sessionStorage.getItem('celebrationLevel');
    if (savedLevel) {
        celebrationLevel = parseInt(savedLevel);
        session.settings.celebrationLevel = celebrationLevel;
        celebrationLevelSelect.value = savedLevel;
    }

    celebrationLevelSelect.addEventListener('change', (e) => {
        const newLevel = parseInt(e.target.value);
        celebrationLevel = newLevel;
        session.settings.celebrationLevel = celebrationLevel;
        sessionStorage.setItem('celebrationLevel', newLevel.toString());
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// QR CODE
// ══════════════════════════════════════════════════════════════════════════════

function generateQRCode() {
    return new Promise((resolve) => {
        let feedbackUrl = `${FEEDBACK_BASE_URL}?code=${session.eventCode}`;
        if (session.moduleId) {
            feedbackUrl += `&module=${session.moduleId}`;
        }

        const canvas = document.getElementById('qrCode');
        const rightSection = canvas.closest('.right-section');

        const availableWidth = rightSection.clientWidth - 100;
        const availableHeight = rightSection.clientHeight - 160;
        const qrSize = Math.max(200, Math.min(availableWidth, availableHeight));

        if (typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, feedbackUrl, {
                width: qrSize,
                margin: CONFIG.QR_CODE_MARGIN,
                color: {
                    dark: CONFIG.QR_CODE_COLOR_DARK,
                    light: CONFIG.QR_CODE_COLOR_LIGHT
                }
            }, function(error) {
                if (error) {
                    console.error('QR Code generation error:', error);
                }
                resolve();
            });
        } else {
            console.error('QRCode library not loaded');
            resolve();
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ══════════════════════════════════════════════════════════════════════════════

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

    if (session.moduleId && session.module) {
        // Module mode: render dropdown of all modules in the event
        const modules = (session.event?.modules || [])
            .filter(m => m.eventModuleId && m.moduleName)
            .sort((a, b) => (a.deliveryOrder || 0) - (b.deliveryOrder || 0));

        const options = modules.map(m => {
            const selected = String(m.eventModuleId) === String(session.moduleId) ? ' selected' : '';
            const orderPrefix = m.deliveryOrder ? `#${m.deliveryOrder}: ` : '';
            const label = `${orderPrefix}${escapeHtml(m.moduleName)} — ${escapeHtml(m.speakerName || 'Unknown Speaker')}`;
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

    // Show overlay covering the count + QR area so the user knows the swap is in progress.
    // Stays visible until applySession() resolves (which now awaits QR canvas redraw).
    const newLabel = select.options[select.selectedIndex]?.text || 'new module';
    showSwitchingOverlay(`Loading ${newLabel}…`);
    select.disabled = true;

    try {
        await applySession({ eventCode: session.eventCode, moduleId: newModuleId });
    } catch (err) {
        console.error('Module switch failed:', err);
        showHeaderError('Couldn\'t load that module. Please try again.');
        // Revert dropdown to last-known-good module so user can retry
        select.value = String(previousModuleId);
    } finally {
        hideSwitchingOverlay();
        select.disabled = false;
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

function showSwitchingOverlay(text) {
    const overlay = document.getElementById('switchingOverlay');
    const textEl = document.getElementById('switchingOverlayText');
    if (!overlay) return;
    if (textEl && text) textEl.textContent = text;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
}

function hideSwitchingOverlay() {
    const overlay = document.getElementById('switchingOverlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
}

function showError(message) {
    loadingState.style.display = 'none';
    countDisplay.style.display = 'none';
    errorState.style.display = 'block';
    errorMessage.textContent = message;
}

// ══════════════════════════════════════════════════════════════════════════════
// FULLSCREEN
// ══════════════════════════════════════════════════════════════════════════════

function initializeFullscreenButton() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (!fullscreenBtn) return;

    fullscreenBtn.addEventListener('click', () => {
        toggleFullscreen();
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenBtn.textContent = 'Exit Fullscreen';
        } else {
            fullscreenBtn.textContent = 'Fullscreen';
        }
        setTimeout(() => {
            generateQRCode();
            sizeProgressRing();
        }, 300);
    });

    window.addEventListener('resize', () => {
        clearTimeout(window._qrResizeTimer);
        window._qrResizeTimer = setTimeout(generateQRCode, 300);
    });
}

function toggleFullscreen() {
    const container = document.querySelector('.count-container');

    if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
            container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopLiveUpdates();
});
