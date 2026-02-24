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
    10:  'First 10! Great start!',
    25:  '25 responses! Momentum building!',
    50:  '50! Halfway to a hundred!',
    75:  '75! Keep them coming!',
    100: 'Triple digits! Amazing!',
    150: '150! Incredible engagement!',
    200: '200! Outstanding participation!',
    300: '300! You\'re on fire!',
    500: '500! Legendary feedback!'
};

const ENCOURAGING_MESSAGES = [
    'Every response helps us improve!',
    'Your feedback matters!',
    'Keep the feedback flowing!',
    'Help us make it even better!',
    'Share your thoughts!',
    'We\'re listening to every response!',
    'Great participation so far!',
    'Your voice counts!'
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

    confettiParticles = confettiParticles.filter(p => p.opacity > 0 && p.y < confettiCanvas.height + 50);

    if (confettiParticles.length === 0) {
        confettiAnimationId = null;
        return;
    }

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

    confettiAnimationId = requestAnimationFrame(animateConfetti);
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
            burstConfetti(120);
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

            // Confetti and milestones only after initial load
            if (!isFirstLoad && count > oldCount) {
                burstConfetti(30 + Math.min(70, (count - oldCount) * 15));
                checkMilestone(count, oldCount);
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
