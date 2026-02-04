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
    console.log('Count page initializing with event code:', eventCode);
    console.log('Using mock data:', USE_MOCK_DATA);

    if (!eventCode) {
        showError('No event code provided. Please access this page from the admin panel.');
        return;
    }

    try {
        // Load event details
        console.log('Loading event details from API...');
        const event = await loadEventDetails(eventCode);
        console.log('Event data received:', event);

        if (!event) {
            console.error('Event is null or undefined');
            showError('Event not found or invalid event code.');
            return;
        }

        currentEvent = event;
        console.log('Current event set:', currentEvent);
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
        console.log('Using mock data');
        return mockLoadEventDetails(code);
    }

    try {
        const url = `${API_BASE_URL}/events/${code}`;
        console.log('Fetching event from:', url);
        const response = await fetch(url);
        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
            console.error('API returned error status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return null;
        }

        const result = await response.json();
        console.log('API response:', result);
        return result.data || result; // Handle API response format
    } catch (error) {
        console.error('Error loading event:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        throw error;
    }
}

// Mock load event details
function mockLoadEventDetails(code) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockEvents = {
                'CSA1B2C3': {
                    EventId: 1,
                    EventCode: 'CSA1B2C3',
                    ModuleName: 'Introduction to CAT Bootcamp',
                    ModuleDate: '2026-02-15',
                    SpeakerName: 'John Doe',
                    CohortId: 'Q1-2026',
                    IsActive: true
                },
                'TEST123': {
                    EventId: 2,
                    EventCode: 'TEST123',
                    ModuleName: 'Building Your First Copilot',
                    ModuleDate: '2026-02-16',
                    SpeakerName: 'Jane Smith',
                    CohortId: 'Q1-2026',
                    IsActive: true
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

    // API returns PascalCase (ModuleName), handle both cases for compatibility
    moduleName.textContent = currentEvent.ModuleName || currentEvent.moduleName || 'Unknown Module';
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
