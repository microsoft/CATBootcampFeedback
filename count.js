/**
 * Live Feedback Count Display
 * Integrated with utility modules
 */

import { CONFIG } from './config.js';
import { getUrlParameter, formatDate, escapeHtml } from './utils.js';
import { apiGet } from './api.js';
import { getUserFriendlyErrorMessage } from './errors.js';

// Determine base URLs
const FEEDBACK_BASE_URL = window.location.origin + '/feedback.html';

// Global state
let eventCode = null;
let moduleId = null;
let currentEvent = null;
let currentModule = null;
let refreshTimer = null;
let isModuleMode = false;

// DOM elements
const loadingState = document.getElementById('loadingState');
const countDisplay = document.getElementById('countDisplay');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const eventCodeDisplay = document.getElementById('eventCodeDisplay');
const totalCount = document.getElementById('totalCount');
const modulesContainer = document.getElementById('modulesContainer');
const lastUpdated = document.getElementById('lastUpdated');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initialize();
});

// Initialize the count display
async function initialize() {
    // Get event code and optional module ID from URL parameters
    eventCode = getUrlParameter('code');
    moduleId = getUrlParameter('module');
    isModuleMode = !!moduleId;

    console.log('Count page initializing with event code:', eventCode, 'module:', moduleId || 'none');
    console.log('Using mock data:', CONFIG.USE_MOCK_DATA);

    if (!eventCode) {
        showError('No event code provided. Please access this page from the admin panel.');
        return;
    }

    try {
        if (isModuleMode) {
            // Module-specific mode: load specific module details
            console.log('Loading module details from API...');
            const moduleData = await loadModuleDetails(eventCode, moduleId);
            console.log('Module data received:', moduleData);

            if (!moduleData) {
                console.error('Module is null or undefined');
                showError('Module not found or invalid module ID.');
                return;
            }

            currentModule = moduleData;
            currentEvent = {
                eventId: moduleData.eventId,
                eventCode: moduleData.eventCode,
                eventName: moduleData.eventName,
                cohortId: moduleData.cohortId
            };
            console.log('Module mode - current module set:', currentModule);
        } else {
            // Event-level mode: load event with all modules
            console.log('Loading event details from API...');
            const event = await loadEventDetails(eventCode);
            console.log('Event data received:', event);

            if (!event) {
                console.error('Event is null or undefined');
                showError('Event not found or invalid event code.');
                return;
            }

            currentEvent = event;
            console.log('Event mode - current event set:', currentEvent);
        }

        showCountDisplay();

        // Generate QR code
        console.log('Generating QR code...');
        generateQRCode();

        // Start live updates
        console.log('Starting live count updates...');
        await updateCount();
        startLiveUpdates();
        console.log('Count page fully initialized');

    } catch (error) {
        console.error('Error initializing count page:', error);
        console.error('Error stack:', error.stack);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showError(friendlyError.message);
    }
}

// Load event details
async function loadEventDetails(code) {
    if (CONFIG.USE_MOCK_DATA) {
        console.log('Using mock data');
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

// Load module details (module-specific mode)
async function loadModuleDetails(code, modId) {
    if (CONFIG.USE_MOCK_DATA) {
        console.log('Using mock module data');
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

// Mock load module details
function mockLoadModuleDetails(code, modId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockModules = {
                'CSA1B2C3_1': {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    eventName: 'CAT Bootcamp Q1-2026',
                    cohortId: 'Q1-2026',
                    eventModuleId: 1,
                    moduleId: 1,
                    moduleName: 'Introduction to CAT Bootcamp',
                    speakerName: 'John Doe',
                    deliveryOrder: 1,
                    deliveryDate: '2026-02-15T09:00:00',
                    count: Math.floor(Math.random() * 10)
                },
                'TEST123_2': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    eventName: 'Test Event',
                    cohortId: 'Q1-2026',
                    eventModuleId: 2,
                    moduleId: 2,
                    moduleName: 'Building Your First Copilot',
                    speakerName: 'Jane Smith',
                    deliveryOrder: 1,
                    deliveryDate: '2026-02-16T09:00:00',
                    count: Math.floor(Math.random() * 8)
                }
            };

            const key = `${code}_${modId}`;
            resolve(mockModules[key] || null);
        }, CONFIG.MOCK_API_DELAY);
    });
}

// Mock load event details
function mockLoadEventDetails(code) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockEvents = {
                'CSA1B2C3': {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    startDate: '2026-02-15',
                    cohortId: 'Q1-2026',
                    totalCount: 5,
                    modules: [
                        {
                            eventModuleId: 1,
                            moduleId: 1,
                            moduleName: 'Introduction to CAT Bootcamp',
                            speakerName: 'John Doe',
                            deliveryOrder: 1,
                            feedbackCount: 5
                        }
                    ]
                },
                'TEST123': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    startDate: '2026-02-16',
                    cohortId: 'Q1-2026',
                    totalCount: 8,
                    modules: [
                        {
                            eventModuleId: 2,
                            moduleId: 2,
                            moduleName: 'Building Your First Copilot',
                            speakerName: 'Jane Smith',
                            deliveryOrder: 1,
                            feedbackCount: 5
                        },
                        {
                            eventModuleId: 3,
                            moduleId: 3,
                            moduleName: 'Advanced Copilot Features',
                            speakerName: 'Bob Johnson',
                            deliveryOrder: 2,
                            feedbackCount: 3
                        }
                    ]
                }
            };

            resolve(mockEvents[code] || null);
        }, CONFIG.MOCK_API_DELAY);
    });
}

// Update feedback count
async function updateCount() {
    try {
        if (isModuleMode) {
            // Module-specific mode: update single module count
            const data = await getModuleFeedbackCount(eventCode, moduleId);
            const currentTotal = parseInt(totalCount.textContent);
            if (data.count !== currentTotal) {
                animateCount(totalCount, currentTotal, data.count);
            }
        } else {
            // Event-level mode: update total and per-module counts
            const data = await getFeedbackCount(eventCode);

            // Update total count with animation
            const currentTotal = parseInt(totalCount.textContent);
            if (data.totalCount !== currentTotal) {
                animateCount(totalCount, currentTotal, data.totalCount);
            }

            // Update module counts
            if (data.modules && data.modules.length > 0) {
                data.modules.forEach(module => {
                    const moduleCountEl = document.getElementById(`module-count-${module.eventModuleId}`);
                    if (moduleCountEl) {
                        const currentModuleCount = parseInt(moduleCountEl.textContent);
                        if (module.feedbackCount !== currentModuleCount) {
                            animateCount(moduleCountEl, currentModuleCount, module.feedbackCount);
                        }
                    }
                });
            }
        }

        // Update last updated time
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

// Get feedback count from API (event-level)
async function getFeedbackCount(code) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockGetFeedbackCount(code);
    }

    try {
        const response = await apiGet(`/events/${code}/count`);
        return response.data || response;
    } catch (error) {
        console.error('Error fetching count:', error);
        return { totalCount: 0, modules: [] };
    }
}

// Get module feedback count from API (module-specific)
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

// Mock get module feedback count
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

// Mock get feedback count
function mockGetFeedbackCount(code) {
    return new Promise((resolve) => {
        // Get feedback from localStorage (for demo)
        const allFeedback = JSON.parse(localStorage.getItem('bootcampFeedback')) || [];
        const eventFeedback = allFeedback.filter(fb => fb.eventCode === code);

        // Use the mock event data structure
        const mockEvents = {
            'CSA1B2C3': {
                totalCount: eventFeedback.length,
                modules: [
                    {
                        eventModuleId: 1,
                        moduleName: 'Introduction to CAT Bootcamp',
                        speakerName: 'John Doe',
                        feedbackCount: eventFeedback.length
                    }
                ]
            },
            'TEST123': {
                totalCount: eventFeedback.length,
                modules: [
                    {
                        eventModuleId: 2,
                        moduleName: 'Building Your First Copilot',
                        speakerName: 'Jane Smith',
                        feedbackCount: Math.floor(eventFeedback.length * 0.6)
                    },
                    {
                        eventModuleId: 3,
                        moduleName: 'Advanced Copilot Features',
                        speakerName: 'Bob Johnson',
                        feedbackCount: Math.ceil(eventFeedback.length * 0.4)
                    }
                ]
            }
        };

        resolve(mockEvents[code] || { totalCount: 0, modules: [] });
    });
}

// Animate count change
function animateCount(element, from, to) {
    const duration = CONFIG.COUNT_ANIMATION_DURATION;
    const steps = 20;
    const stepDuration = duration / steps;
    const increment = (to - from) / steps;

    let current = from;
    let step = 0;

    const animation = setInterval(() => {
        step++;
        current += increment;

        if (step >= steps) {
            element.textContent = to;
            clearInterval(animation);
        } else {
            element.textContent = Math.round(current);
        }
    }, stepDuration);
}

// Start live updates
function startLiveUpdates() {
    refreshTimer = setInterval(() => {
        updateCount();
    }, CONFIG.COUNT_REFRESH_INTERVAL);
}

// Stop live updates
function stopLiveUpdates() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

// Generate QR code
function generateQRCode() {
    const feedbackUrl = `${FEEDBACK_BASE_URL}?code=${eventCode}`;
    const canvas = document.getElementById('qrCode');

    if (typeof QRCode !== 'undefined') {
        QRCode.toCanvas(canvas, feedbackUrl, {
            width: 200,
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

// Show count display
function showCountDisplay() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    countDisplay.style.display = 'block';

    // Display event code
    const eventCodeText = currentEvent.EventCode || currentEvent.eventCode || eventCode;
    eventCodeDisplay.textContent = `Event: ${escapeHtml(eventCodeText)}`;

    // Display initial counts
    totalCount.textContent = currentEvent.totalCount || 0;

    // Render module cards
    const modules = currentEvent.modules || [];
    if (modules.length > 0) {
        modulesContainer.innerHTML = modules.map(module => `
            <div class="module-card">
                <div class="module-info">
                    <div class="module-name">${escapeHtml(module.moduleName)}</div>
                    <div class="module-speaker">👤 ${escapeHtml(module.speakerName)}</div>
                </div>
                <div class="module-count" id="module-count-${module.eventModuleId}">${module.feedbackCount || 0}</div>
            </div>
        `).join('');
    } else {
        modulesContainer.innerHTML = '<p style="color: #666;">No modules for this event yet.</p>';
    }
}

// Show error
function showError(message) {
    loadingState.style.display = 'none';
    countDisplay.style.display = 'none';
    errorState.style.display = 'block';
    errorMessage.textContent = message;
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Make toggleFullscreen available globally
window.toggleFullscreen = toggleFullscreen;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopLiveUpdates();
});

console.log('Feedback Count Display Loaded');
console.log('Event Code:', eventCode);
console.log('Using Mock Data:', CONFIG.USE_MOCK_DATA);
console.log('Auto-refresh every', CONFIG.COUNT_REFRESH_INTERVAL / 1000, 'seconds');
