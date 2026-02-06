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
let currentRefreshInterval = CONFIG.COUNT_REFRESH_INTERVAL;

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
        // Show event selector instead of error
        await showEventSelector();
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

        // Initialize refresh interval selector
        initializeRefreshIntervalSelector();

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
                    count: Math.floor(Math.random() * 10) + 5,
                    averages: {
                        speakerKnowledge: 4.2,
                        moduleSatisfaction: 4.5
                    },
                    contentDepth: {
                        'Too Technical': 2,
                        'Just Right': 8,
                        'Too Low Level': 1
                    }
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
                    count: Math.floor(Math.random() * 8) + 3,
                    averages: {
                        speakerKnowledge: 3.8,
                        moduleSatisfaction: 4.0
                    },
                    contentDepth: {
                        'Too Technical': 3,
                        'Just Right': 5,
                        'Too Low Level': 2
                    }
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
                    eventName: 'CAT Bootcamp Q1-2026',
                    startDate: '2026-02-15',
                    cohortId: 'Q1-2026',
                    totalCount: 12,
                    averages: {
                        speakerKnowledge: 4.3,
                        moduleSatisfaction: 4.1
                    },
                    contentDepth: {
                        'Too Technical': 3,
                        'Just Right': 8,
                        'Too Low Level': 1
                    },
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
                    cohortId: 'Q1-2026',
                    totalCount: 18,
                    averages: {
                        speakerKnowledge: 3.9,
                        moduleSatisfaction: 4.2
                    },
                    contentDepth: {
                        'Too Technical': 5,
                        'Just Right': 10,
                        'Too Low Level': 3
                    },
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

// Show event selector (fallback when no event code in URL)
async function showEventSelector() {
    const eventSelectionView = document.getElementById('eventSelectionView');
    const eventSelect = document.getElementById('eventSelect');
    const continueBtn = document.getElementById('continueBtn');
    const viewModeSelection = document.getElementById('viewModeSelection');
    const moduleSelect = document.getElementById('moduleSelect');

    loadingState.style.display = 'none';
    eventSelectionView.style.display = 'block';

    try {
        // Load events list
        const response = await apiGet('/events');
        const events = response.data || response;

        if (!events || events.length === 0) {
            showError('No active events found.');
            return;
        }

        // Populate event selector
        eventSelect.innerHTML = '<option value="">-- Select an Event --</option>' +
            events.filter(e => e.isActive).map(e =>
                `<option value="${e.eventCode}" data-event-id="${e.eventId}">${escapeHtml(e.eventName || e.eventCode)} - ${formatDate(e.startDate)}</option>`
            ).join('');

        // Handle event selection
        eventSelect.addEventListener('change', async function() {
            const selectedCode = this.value;
            if (selectedCode) {
                viewModeSelection.style.display = 'block';
                continueBtn.disabled = false;

                // Load modules for selected event
                const selectedEvent = events.find(e => e.eventCode === selectedCode);
                if (selectedEvent && selectedEvent.modules) {
                    // DEFENSIVE: Filter out inactive modules
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

        // Handle view mode selection
        document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
            radio.addEventListener('change', function() {
                moduleSelect.style.display = this.value === 'module' ? 'block' : 'none';
            });
        });

        // Handle continue button
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

// Update feedback count
async function updateCount() {
    try {
        let data;
        let count;

        if (isModuleMode) {
            // Module-specific mode: update single module analytics
            data = await getModuleFeedbackCount(eventCode, moduleId);
            count = data.count || 0;
        } else {
            // Event-level mode: update aggregate analytics
            data = await getFeedbackCount(eventCode);
            count = data.totalCount || 0;
        }

        // Update total count with animation
        const currentTotal = parseInt(totalCount.textContent);
        if (count !== currentTotal) {
            animateCount(totalCount, currentTotal, count);
        }

        // Update analytics
        updateAnalytics(data);

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

// Update analytics display
function updateAnalytics(data) {
    const avgSatisfactionEl = document.getElementById('avgSatisfaction');
    const avgSpeakerKnowledgeEl = document.getElementById('avgSpeakerKnowledge');
    const satisfactionStarsEl = document.getElementById('satisfactionStars');
    const knowledgeStarsEl = document.getElementById('knowledgeStars');
    const depthChartEl = document.getElementById('depthChart');

    // Update satisfaction
    if (data.averages && data.averages.moduleSatisfaction !== null) {
        const satisfaction = data.averages.moduleSatisfaction;
        avgSatisfactionEl.textContent = satisfaction.toFixed(1);
        avgSatisfactionEl.className = 'metric-value ' + getRatingClass(satisfaction);
        satisfactionStarsEl.innerHTML = renderStars(satisfaction);
    } else {
        avgSatisfactionEl.textContent = '-';
        avgSatisfactionEl.className = 'metric-value';
        satisfactionStarsEl.innerHTML = '';
    }

    // Update speaker knowledge
    if (data.averages && data.averages.speakerKnowledge !== null) {
        const knowledge = data.averages.speakerKnowledge;
        avgSpeakerKnowledgeEl.textContent = knowledge.toFixed(1);
        avgSpeakerKnowledgeEl.className = 'metric-value ' + getRatingClass(knowledge);
        knowledgeStarsEl.innerHTML = renderStars(knowledge);
    } else {
        avgSpeakerKnowledgeEl.textContent = '-';
        avgSpeakerKnowledgeEl.className = 'metric-value';
        knowledgeStarsEl.innerHTML = '';
    }

    // Update content depth chart
    if (data.contentDepth) {
        renderContentDepthChart(data.contentDepth, depthChartEl);
    }
}

// Render star rating
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '★';
    }
    if (hasHalfStar) {
        stars += '⯪';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '☆';
    }

    return stars;
}

// Get rating class for color coding
function getRatingClass(rating) {
    if (rating >= 4.0) return 'excellent';
    if (rating >= 3.0) return 'good';
    return 'poor';
}

// Render content depth chart
function renderContentDepthChart(depthData, container) {
    const total = depthData['Too Technical'] + depthData['Just Right'] + depthData['Too Low Level'];

    if (total === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No feedback data yet</p>';
        return;
    }

    const items = [
        { label: 'Too Technical', count: depthData['Too Technical'] },
        { label: 'Just Right', count: depthData['Just Right'] },
        { label: 'Too Low Level', count: depthData['Too Low Level'] }
    ];

    container.innerHTML = items.map(item => {
        const percentage = ((item.count / total) * 100).toFixed(0);
        return `
            <div class="depth-bar">
                <div class="depth-label">${escapeHtml(item.label)}</div>
                <div class="depth-bar-container">
                    <div class="depth-bar-fill" style="width: ${percentage}%">
                        ${item.count} (${percentage}%)
                    </div>
                </div>
            </div>
        `;
    }).join('');
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
        return {
            totalCount: 0,
            averages: { speakerKnowledge: null, moduleSatisfaction: null },
            contentDepth: { 'Too Technical': 0, 'Just Right': 0, 'Too Low Level': 0 }
        };
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
        return {
            count: 0,
            averages: { speakerKnowledge: null, moduleSatisfaction: null },
            contentDepth: { 'Too Technical': 0, 'Just Right': 0, 'Too Low Level': 0 }
        };
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

            const count = moduleFeedback.length;
            let avgSpeakerKnowledge = null;
            let avgModuleSatisfaction = null;
            const contentDepth = { 'Too Technical': 0, 'Just Right': 0, 'Too Low Level': 0 };

            if (count > 0) {
                avgSpeakerKnowledge = moduleFeedback.reduce((sum, fb) => sum + fb.speakerKnowledge, 0) / count;
                avgModuleSatisfaction = moduleFeedback.reduce((sum, fb) => sum + fb.moduleSatisfaction, 0) / count;

                moduleFeedback.forEach(fb => {
                    if (contentDepth.hasOwnProperty(fb.contentDepth)) {
                        contentDepth[fb.contentDepth]++;
                    }
                });
            }

            resolve({
                count: count,
                averages: {
                    speakerKnowledge: avgSpeakerKnowledge,
                    moduleSatisfaction: avgModuleSatisfaction
                },
                contentDepth: contentDepth
            });
        }, CONFIG.MOCK_API_DELAY);
    });
}

// Mock get feedback count
function mockGetFeedbackCount(code) {
    return new Promise((resolve) => {
        // Get feedback from localStorage (for demo)
        const allFeedback = JSON.parse(localStorage.getItem('bootcampFeedback')) || [];
        const eventFeedback = allFeedback.filter(fb => fb.eventCode === code);

        const count = eventFeedback.length;
        let avgSpeakerKnowledge = null;
        let avgModuleSatisfaction = null;
        const contentDepth = { 'Too Technical': 0, 'Just Right': 0, 'Too Low Level': 0 };

        if (count > 0) {
            avgSpeakerKnowledge = eventFeedback.reduce((sum, fb) => sum + fb.speakerKnowledge, 0) / count;
            avgModuleSatisfaction = eventFeedback.reduce((sum, fb) => sum + fb.moduleSatisfaction, 0) / count;

            eventFeedback.forEach(fb => {
                if (contentDepth.hasOwnProperty(fb.contentDepth)) {
                    contentDepth[fb.contentDepth]++;
                }
            });
        }

        resolve({
            totalCount: count,
            averages: {
                speakerKnowledge: avgSpeakerKnowledge,
                moduleSatisfaction: avgModuleSatisfaction
            },
            contentDepth: contentDepth
        });
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
    }, currentRefreshInterval);
}

// Stop live updates
function stopLiveUpdates() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

// Restart live updates with new interval
function restartLiveUpdates() {
    stopLiveUpdates();
    startLiveUpdates();
    console.log(`Refresh interval changed to ${currentRefreshInterval}ms`);
}

// Initialize refresh interval selector
function initializeRefreshIntervalSelector() {
    const refreshIntervalSelect = document.getElementById('refreshInterval');

    if (!refreshIntervalSelect) {
        console.warn('Refresh interval selector not found');
        return;
    }

    // Load saved preference from sessionStorage
    const savedInterval = sessionStorage.getItem('countRefreshInterval');
    if (savedInterval) {
        currentRefreshInterval = parseInt(savedInterval);
        refreshIntervalSelect.value = savedInterval;
        console.log(`Loaded saved refresh interval: ${currentRefreshInterval}ms`);
    }

    // Handle interval changes
    refreshIntervalSelect.addEventListener('change', (e) => {
        const newInterval = parseInt(e.target.value);
        currentRefreshInterval = newInterval;

        // Save preference
        sessionStorage.setItem('countRefreshInterval', newInterval.toString());

        // Restart timer with new interval
        restartLiveUpdates();

        // Update immediately to show responsiveness
        updateCount();
    });
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

    // Display event and module information
    if (isModuleMode) {
        // Module-specific mode
        const moduleName = currentModule.moduleName || 'Module';
        const speakerName = currentModule.speakerName || 'Unknown Speaker';
        const eventName = currentModule.eventName || currentModule.eventCode || eventCode;
        eventCodeDisplay.textContent = `${escapeHtml(moduleName)} - ${escapeHtml(speakerName)}`;
        eventCodeDisplay.insertAdjacentHTML('afterend',
            `<div style="font-size: 1.2rem; color: #666; margin-top: 5px;">Event: ${escapeHtml(eventName)}</div>`
        );
        totalCount.textContent = currentModule.count || 0;
    } else {
        // Event-level mode
        const eventCodeText = currentEvent.eventCode || eventCode;
        const eventName = currentEvent.eventName || eventCodeText;
        eventCodeDisplay.textContent = `Event: ${escapeHtml(eventName)}`;
        totalCount.textContent = currentEvent.totalCount || 0;
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
console.log('Default auto-refresh interval:', CONFIG.COUNT_REFRESH_INTERVAL / 1000, 'seconds (user-configurable)');
