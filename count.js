// Configuration
const API_BASE_URL = '/api';
// Auto-detect environment - use real API in production
const USE_MOCK_DATA = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const FEEDBACK_BASE_URL = window.location.origin + '/feedback.html';
const REFRESH_INTERVAL = 5000; // 5 seconds

// Global state
let eventCode = null;
let currentEvent = null;
let refreshTimer = null;

// DOM elements
const loadingState = document.getElementById('loadingState');
const countDisplay = document.getElementById('countDisplay');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const feedbackCount = document.getElementById('feedbackCount');
const moduleName = document.getElementById('moduleName');
const lastUpdated = document.getElementById('lastUpdated');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initialize();
});

// Initialize the count display
async function initialize() {
    // Get event code from URL parameter
    eventCode = getUrlParameter('code');

    if (!eventCode) {
        showError('No event code provided. Please access this page from the admin panel.');
        return;
    }

    try {
        // Load event details
        const event = await loadEventDetails(eventCode);

        if (!event) {
            showError('Event not found or invalid event code.');
            return;
        }

        currentEvent = event;
        showCountDisplay();

        // Generate QR code
        generateQRCode();

        // Start live updates
        await updateCount();
        startLiveUpdates();

    } catch (error) {
        console.error('Error initializing:', error);
        showError('Unable to load event information. Please try again later.');
    }
}

// Get URL parameter
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Load event details
async function loadEventDetails(code) {
    if (USE_MOCK_DATA) {
        return mockLoadEventDetails(code);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/events/${code}`);

        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        return result.data || result; // Handle API response format
    } catch (error) {
        console.error('Error loading event:', error);
        throw error;
    }
}

// Mock load event details
function mockLoadEventDetails(code) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockEvents = {
                'CSA1B2C3': {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    moduleName: 'Introduction to Copilot Studio',
                    moduleDate: '2026-02-15',
                    speakerName: 'John Doe',
                    cohortId: 'Q1-2026',
                    isActive: true
                },
                'TEST123': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    moduleName: 'Building Your First Copilot',
                    moduleDate: '2026-02-16',
                    speakerName: 'Jane Smith',
                    cohortId: 'Q1-2026',
                    isActive: true
                }
            };

            resolve(mockEvents[code] || null);
        }, 500);
    });
}

// Update feedback count
async function updateCount() {
    try {
        const count = await getFeedbackCount(eventCode);

        // Animate count change
        const currentCount = parseInt(feedbackCount.textContent);
        if (count !== currentCount) {
            animateCount(currentCount, count);
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

// Get feedback count from API
async function getFeedbackCount(code) {
    if (USE_MOCK_DATA) {
        return mockGetFeedbackCount(code);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/events/${code}/count`);
        const data = await response.json();
        return data.data?.count || 0;
    } catch (error) {
        console.error('Error fetching count:', error);
        return 0;
    }
}

// Mock get feedback count
function mockGetFeedbackCount(code) {
    return new Promise((resolve) => {
        // Get feedback from localStorage (for demo)
        const allFeedback = JSON.parse(localStorage.getItem('bootcampFeedback')) || [];
        const eventFeedback = allFeedback.filter(fb => fb.eventCode === code);
        resolve(eventFeedback.length);
    });
}

// Animate count change
function animateCount(from, to) {
    const duration = 1000; // 1 second
    const steps = 20;
    const stepDuration = duration / steps;
    const increment = (to - from) / steps;

    let current = from;
    let step = 0;

    const animation = setInterval(() => {
        step++;
        current += increment;

        if (step >= steps) {
            feedbackCount.textContent = to;
            clearInterval(animation);
        } else {
            feedbackCount.textContent = Math.round(current);
        }
    }, stepDuration);
}

// Start live updates
function startLiveUpdates() {
    refreshTimer = setInterval(() => {
        updateCount();
    }, REFRESH_INTERVAL);
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

    QRCode.toCanvas(canvas, feedbackUrl, {
        width: 200,
        margin: 2,
        color: {
            dark: '#667eea',
            light: '#ffffff'
        }
    }, function(error) {
        if (error) {
            console.error('QR Code generation error:', error);
        }
    });
}

// Show count display
function showCountDisplay() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    countDisplay.style.display = 'block';

    moduleName.textContent = currentEvent.moduleName;
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopLiveUpdates();
});

console.log('Feedback Count Display Loaded');
console.log('Event Code:', eventCode);
console.log('Using Mock Data:', USE_MOCK_DATA);
console.log('Auto-refresh every', REFRESH_INTERVAL / 1000, 'seconds');
