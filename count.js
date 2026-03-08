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

const ENCOURAGING_MESSAGES = [
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

    // If nothing left to draw, stop the loop
    if (confettiParticles.length === 0 && activeCharacters.length === 0) {
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

    confettiAnimationId = requestAnimationFrame(animateConfetti);
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
    document.body.appendChild(overlay);
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

    if (level === 1) {
        // Chill: small confetti + floating cat
        burstConfetti(20);
        spawnFloatingCat();
    } else if (level === 2) {
        // Party: medium confetti + screen glow + walking cats + duck
        burstConfetti(60);
        screenGlow();
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
        // Chaos: massive confetti + shake + glow + cat army + duck squad + bonus
        burstConfetti(150);
        screenShake();
        screenGlow();
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

            // Scale milestone celebration by level
            const level = celebrationLevel;
            if (level === 1) {
                burstConfetti(60);
                spawnFloatingCat();
            } else if (level === 2) {
                burstConfetti(150);
                screenGlow();
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => spawnFloatingCat(), i * 200);
                }
            } else if (level === 3) {
                burstConfetti(300);
                screenShake();
                screenGlow();
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

let milestoneTimeout = null;
function showMilestone(milestone) {
    const message = MILESTONE_MESSAGES[milestone] || `${milestone} responses!`;
    milestoneMessageEl.textContent = message;
    milestoneMessageEl.classList.add('visible');

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
        encouragingMessageEl.textContent = ENCOURAGING_MESSAGES[encouragingIndex];
        encouragingMessageEl.style.opacity = '1';
        encouragingIndex = (encouragingIndex + 1) % ENCOURAGING_MESSAGES.length;
    }, 500);
}

// ══════════════════════════════════════════════════════════════════════════════
// PROGRESS RING
// ══════════════════════════════════════════════════════════════════════════════

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

    const availableW = leftSection.clientWidth - 40;
    const availableH = leftSection.clientHeight * 0.62;
    const size = Math.max(200, Math.min(availableW, availableH, 550));
    const strokeWidth = Math.max(8, size * 0.028);
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;

    const svg = document.getElementById('progressRing');
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

    updateProgressRing(currentCount);

    // Scale counter font to fit inside the ring
    const counterEl = document.getElementById('counterNumber');
    counterEl.style.fontSize = Math.max(32, size * 0.22) + 'px';
}

function updateProgressRing(count) {
    const ringFill = document.getElementById('ringFill');
    const circumference = parseFloat(ringFill.dataset.circumference);
    if (!circumference) return;

    const nextMilestone = getNextMilestone(count);
    const prevMilestone = getPrevMilestone(count);
    const range = nextMilestone - prevMilestone;
    const progress = range > 0 ? Math.min(1, (count - prevMilestone) / range) : 0;

    const offset = circumference * (1 - progress);
    ringFill.style.strokeDashoffset = offset;
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
    const container = document.getElementById('counterNumber');
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
    initialize();
});

async function initialize() {
    eventCode = getUrlParameter('code');
    moduleId = getUrlParameter('module');
    isModuleMode = !!moduleId;

    if (!eventCode) {
        await showEventSelector();
        return;
    }

    try {
        if (isModuleMode) {
            const moduleData = await loadModuleDetails(eventCode, moduleId);
            if (!moduleData) {
                showError('Module not found or invalid module ID.');
                return;
            }
            currentModule = moduleData;
            currentEvent = {
                eventId: moduleData.eventId,
                eventCode: moduleData.eventCode,
                eventName: moduleData.eventName,
                trainingTrack: moduleData.trainingTrack
            };
        } else {
            const event = await loadEventDetails(eventCode);
            if (!event) {
                showError('Event not found or invalid event code.');
                return;
            }
            currentEvent = event;
        }

        showCountDisplay();
        initProgressRing();
        generateQRCode();
        startEncouragingMessages();
        await updateCount();
        startLiveUpdates();
        initializeRefreshIntervalSelector();
        initializeCelebrationLevelSelector();
        initializeFullscreenButton();

    } catch (error) {
        console.error('Error initializing count page:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showError(friendlyError.message);
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
                    totalCount: 12,
                    modules: [
                        {
                            eventModuleId: 1,
                            moduleId: 1,
                            moduleName: 'Introduction to CAT Bootcamp',
                            speakerName: 'John Doe',
                            deliveryOrder: 1,
                            feedbackCount: 12
                        }
                    ]
                },
                'TEST123': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    eventName: 'Test Event',
                    startDate: '2026-02-16',
                    trainingTrack: 'Q1-2026',
                    totalCount: 18,
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

        if (isModuleMode) {
            data = await getModuleFeedbackCount(eventCode, moduleId);
            count = data.count || 0;
        } else {
            data = await getFeedbackCount(eventCode);
            count = data.totalCount || 0;
        }

        const oldCount = currentCount;

        if (count !== oldCount || isFirstLoad) {
            // Update slot-machine digit display
            updateDigitDisplay(count);

            // Pulse animation
            counterNumber.classList.remove('pulse');
            void counterNumber.offsetWidth;
            counterNumber.classList.add('pulse');

            // Celebrations only after initial load
            if (!isFirstLoad && count > oldCount) {
                triggerCelebration(count, oldCount);
            }

            // Update progress ring
            updateProgressRing(count);

            currentCount = count;
            isFirstLoad = false;
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
        refreshIntervalSelect.value = savedInterval;
    }

    refreshIntervalSelect.addEventListener('change', (e) => {
        const newInterval = parseInt(e.target.value);
        currentRefreshInterval = newInterval;
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
        celebrationLevelSelect.value = savedLevel;
    }

    celebrationLevelSelect.addEventListener('change', (e) => {
        const newLevel = parseInt(e.target.value);
        celebrationLevel = newLevel;
        sessionStorage.setItem('celebrationLevel', newLevel.toString());
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// QR CODE
// ══════════════════════════════════════════════════════════════════════════════

function generateQRCode() {
    let feedbackUrl = `${FEEDBACK_BASE_URL}?code=${eventCode}`;
    if (isModuleMode && moduleId) {
        feedbackUrl += `&module=${moduleId}`;
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
        });
    } else {
        console.error('QRCode library not loaded');
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function showCountDisplay() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    countDisplay.style.display = 'flex';

    if (isModuleMode) {
        const moduleName = currentModule.moduleName || 'Module';
        const speakerName = currentModule.speakerName || 'Unknown Speaker';
        const eventName = currentModule.eventName || currentModule.eventCode || eventCode;
        eventCodeDisplay.textContent = `${escapeHtml(moduleName)} - ${escapeHtml(speakerName)}`;
        eventCodeDisplay.insertAdjacentHTML('afterend',
            `<div class="event-subtext">Event: ${escapeHtml(eventName)}</div>`
        );
        currentCount = currentModule.count || 0;
    } else {
        const eventCodeText = currentEvent.eventCode || eventCode;
        const eventName = currentEvent.eventName || eventCodeText;
        eventCodeDisplay.textContent = `Event: ${escapeHtml(eventName)}`;
        currentCount = currentEvent.totalCount || 0;
    }

    // Set initial digit display
    updateDigitDisplay(currentCount);
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
