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

    // Clean up event code (remove any extra characters/spaces)
    if (eventCode) {
        eventCode = eventCode.trim().toUpperCase();
    }

    console.log('Count page initializing with event code:', eventCode);
    console.log('Using mock data:', USE_MOCK_DATA);

    if (!eventCode) {
        showError(
            'No Event Code Provided',
            'The count display link is missing the event code parameter.',
            'The URL should look like: count.html?code=ABC123'
        );
        return;
    }

    // Load event with the code
    await loadEventByCode(eventCode);
}

// Load event by code (used by both URL and manual entry)
async function loadEventByCode(code) {
    // Clean and validate code
    code = code.trim().toUpperCase();

    if (!code) {
        showError(
            'Invalid Event Code',
            'The event code cannot be empty.',
            null
        );
        return false;
    }

    // Validate format (alphanumeric, 4-20 characters)
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
        showError(
            'Invalid Event Code Format',
            'The event code must be 4-20 alphanumeric characters.',
            `Provided code: "${code}"`
        );
        return false;
    }

    try {
        // Load event details
        console.log('Loading event details from API...');
        const event = await loadEventDetails(code);
        console.log('Event data received:', event);

        if (!event) {
            console.error('Event is null or undefined');
            showError(
                'Event Not Found',
                'No event exists with this code. Please check the code and try again.',
                `Event Code: ${code}`
            );
            return false;
        }

        // Check if event is active
        if (event.isActive === false || event.IsActive === false) {
            showError(
                'Event Inactive',
                'This event is no longer active.',
                `Event Code: ${code}`
            );
            return false;
        }

        currentEvent = event;
        eventCode = code;
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

        return true;

    } catch (error) {
        console.error('Error initializing count page:', error);
        console.error('Error stack:', error.stack);
        showError(
            'Connection Error',
            'Unable to load event information. Please check your internet connection and try again.',
            error.message
        );
        return false;
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
            if (response.status === 404) {
                console.log(`Event not found: ${code}`);
                return null;
            }
            console.error('API returned error status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('API response:', result);

        // Handle API response format - API may return { success: true, data: {...} } or just the event object
        let event = null;
        if (result.success && result.data) {
            event = result.data;
        } else if (result.data) {
            event = result.data;
        } else {
            event = result;
        }

        // Normalize field names (API returns PascalCase, we use camelCase)
        if (event) {
            event.eventId = event.EventId || event.eventId;
            event.eventCode = event.EventCode || event.eventCode;
            event.moduleName = event.ModuleName || event.moduleName;
            event.moduleDate = event.ModuleDate || event.moduleDate;
            event.speakerName = event.SpeakerName || event.speakerName;
            event.cohortId = event.CohortId || event.cohortId;
            event.isActive = event.IsActive !== undefined ? event.IsActive : event.isActive;
        }

        return event;
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
function showError(title, message, details = null) {
    loadingState.style.display = 'none';
    countDisplay.style.display = 'none';

    // Update error content
    const errorTitle = document.getElementById('errorTitle');
    if (errorTitle) errorTitle.textContent = title || 'Unable to Load Count Display';

    errorMessage.textContent = message || 'Unable to load feedback count.';

    // Show details if provided
    const errorDetailsEl = document.getElementById('errorDetails');
    if (errorDetailsEl) {
        if (details) {
            errorDetailsEl.textContent = details;
            errorDetailsEl.style.display = 'block';
        } else {
            errorDetailsEl.textContent = '';
            errorDetailsEl.style.display = 'none';
        }
    }

    // Clear manual entry error
    const manualError = document.getElementById('manualEntryError');
    if (manualError) {
        manualError.style.display = 'none';
        manualError.textContent = '';
    }

    // Clear manual entry input
    const manualInput = document.getElementById('manualEventCode');
    if (manualInput) {
        manualInput.value = '';
    }

    errorState.style.display = 'block';
}

// Load event from manual entry
window.loadManualEventCode = async function() {
    const input = document.getElementById('manualEventCode');
    const btn = document.getElementById('loadCountBtn');
    const errorEl = document.getElementById('manualEntryError');
    const code = input.value.trim().toUpperCase();

    // Clear previous error
    errorEl.style.display = 'none';
    errorEl.textContent = '';

    if (!code) {
        errorEl.textContent = 'Please enter an event code';
        errorEl.style.display = 'block';
        input.focus();
        return;
    }

    // Show loading on button
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = btn.querySelector('.btn-spinner');
    btn.disabled = true;
    btnText.textContent = 'Loading...';
    btnSpinner.style.display = 'inline-block';

    // Try to load event
    const success = await loadEventByCode(code);

    // Reset button
    btn.disabled = false;
    btnText.textContent = 'Load Count';
    btnSpinner.style.display = 'none';

    if (!success) {
        // Error is already shown by loadEventByCode
        input.focus();
    }
};

// Handle Enter key in manual entry input
document.addEventListener('DOMContentLoaded', function() {
    const manualInput = document.getElementById('manualEventCode');
    if (manualInput) {
        manualInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                window.loadManualEventCode();
            }
        });

        // Auto-uppercase as user types
        manualInput.addEventListener('input', function(e) {
            this.value = this.value.toUpperCase();
        });
    }
});

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
