/**
 * Feedback Form - Main Application
 * Integrated with utility modules for better security, error handling, and maintainability
 */

import { CONFIG } from './config.js';
import {
    InputSanitizer,
    escapeHtml,
    getUrlParameter,
    formatDate,
    validateFeedbackData
} from './utils.js';
import {
    getUserFriendlyErrorMessage,
    FeedbackError,
    EventError,
    NetworkError
} from './errors.js';
import { apiGet, apiPost } from './api.js';
import { createFeedbackRateLimiter } from './RateLimiter.js';
import { eventCache } from './Cache.js';

// Global state
let currentEvent = null;
let selectedEventModule = null;
let eventCode = null;
let rateLimiter = null;

// DOM elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const feedbackForm = document.getElementById('feedbackForm');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const successMessage = document.getElementById('successMessage');
const additionalComments = document.getElementById('additionalComments');
const charCount = document.getElementById('charCount');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
});

// Initialize form
async function initializeForm() {
    // Get event code and module ID from URL parameters
    eventCode = getUrlParameter('code');
    const moduleId = getUrlParameter('module');

    try {
        // Case 1: No event code - show event selector
        if (!eventCode) {
            await showEventSelector();
            return;
        }

        // Validate event code format
        if (!InputSanitizer.validateEventCode(eventCode)) {
            showError('Not a valid event code.');
            return;
        }

        // Initialize rate limiter for this event
        rateLimiter = createFeedbackRateLimiter(eventCode);

        // Case 2: Event code present, module ID present - direct to feedback
        if (moduleId) {
            const moduleData = await loadModuleDetails(eventCode, moduleId);
            if (moduleData) {
                currentEvent = {
                    eventId: moduleData.eventId,
                    eventCode: moduleData.eventCode,
                    eventName: moduleData.eventName,
                    startDate: moduleData.startDate,
                    endDate: moduleData.endDate,
                    trainingTrack: moduleData.trainingTrack,
                    isActive: moduleData.isActive
                };
                selectedEventModule = {
                    eventModuleId: moduleData.eventModuleId,
                    moduleId: moduleData.moduleId,
                    moduleName: moduleData.moduleName,
                    speakerName: moduleData.speakerName,
                    deliveryDate: moduleData.deliveryDate,
                    deliveryOrder: moduleData.deliveryOrder
                };
                displayModuleInfo(selectedEventModule);
                showForm();
                setupFormListeners();
            } else {
                showError('Not a valid event code or module.');
            }
        } else {
            // Case 3: Event code present, no module ID - show module selector
            const event = await loadEventDetails(eventCode);
            if (event) {
                currentEvent = event;
                displayEventInfo(event);
                showForm();
                setupFormListeners();
            } else {
                showError('Not a valid event code.');
            }
        }
    } catch (error) {
        console.error('Error loading event:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showError(friendlyError.message);
    }
}

// Load event details from API
async function loadEventDetails(code) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockLoadEventDetails(code);
    }

    // Check cache first
    const cached = eventCache.get(code);
    if (cached) {
        console.log('Using cached event data');
        return cached;
    }

    try {
        const event = await apiGet(`/events/${code}`);

        // Cache the result
        if (event) {
            eventCache.set(code, event);
        }

        return event;
    } catch (error) {
        if (error instanceof EventError) {
            return null;
        }
        throw error;
    }
}

// Load specific module delivery details from API
async function loadModuleDetails(code, moduleId) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockLoadModuleDetails(code, moduleId);
    }

    // Check cache first
    const cacheKey = `${code}_${moduleId}`;
    const cached = eventCache.get(cacheKey);
    if (cached) {
        console.log('Using cached module data');
        return cached;
    }

    try {
        // Fetch all events and filter for the specific event and module
        const response = await apiGet(`/events`);
        const allEvents = response.data || response; // Handle both {data: [...]} and [...] formats

        // Find the event with matching code
        const event = allEvents.find(e => e.eventCode === code);
        if (!event) {
            return null;
        }

        // Find the module within the event
        const module = event.modules.find(m => m.eventModuleId === parseInt(moduleId));
        if (!module) {
            return null;
        }

        // Construct the module data in the expected format
        const moduleData = {
            eventId: event.eventId,
            eventCode: event.eventCode,
            eventName: event.eventName,
            startDate: event.startDate,
            endDate: event.endDate,
            trainingTrack: event.trainingTrack,
            isActive: event.isActive,
            eventModuleId: module.eventModuleId,
            moduleId: module.moduleId,
            moduleName: module.moduleName,
            moduleDescription: module.description,
            speakerName: module.speakerName,
            deliveryOrder: module.deliveryOrder,
            deliveryDate: module.deliveryDate,
            notes: module.notes
        };

        // Cache the result
        if (moduleData) {
            eventCache.set(cacheKey, moduleData);
        }

        return moduleData;
    } catch (error) {
        if (error instanceof EventError) {
            return null;
        }
        throw error;
    }
}

// Mock function for loading specific module details
function mockLoadModuleDetails(code, moduleId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockModules = {
                'CSA1B2C3_1': {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    eventName: 'CAT Bootcamp Q1-2026',
                    startDate: '2026-02-15',
                    endDate: '2026-02-20',
                    trainingTrack: 'Q1-2026',
                    isActive: true,
                    eventModuleId: 1,
                    moduleId: 1,
                    moduleName: 'Introduction to Copilot Studio',
                    speakerName: 'John Doe',
                    deliveryOrder: 1,
                    deliveryDate: '2026-02-15T09:00:00'
                },
                'TEST123_2': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    eventName: 'Test Event',
                    startDate: '2026-02-16',
                    endDate: '2026-02-17',
                    trainingTrack: 'Q1-2026',
                    isActive: true,
                    eventModuleId: 2,
                    moduleId: 2,
                    moduleName: 'Building Your First Copilot',
                    speakerName: 'Jane Smith',
                    deliveryOrder: 1,
                    deliveryDate: '2026-02-16T09:00:00'
                }
            };

            const key = `${code}_${moduleId}`;
            const moduleData = mockModules[key];
            resolve(moduleData || null);
        }, CONFIG.MOCK_API_DELAY);
    });
}

// Mock function for testing without backend
function mockLoadEventDetails(code) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate valid codes
            const mockEvents = {
                'CSA1B2C3': {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    startDate: '2026-02-15',
                    trainingTrack: 'Q1-2026',
                    isActive: true,
                    modules: [
                        {
                            eventModuleId: 1,
                            moduleId: 1,
                            moduleName: 'Introduction to Copilot Studio',
                            speakerName: 'John Doe',
                            deliveryOrder: 1,
                            deliveryDate: '2026-02-15T09:00:00'
                        }
                    ]
                },
                'TEST123': {
                    eventId: 2,
                    eventCode: 'TEST123',
                    startDate: '2026-02-16',
                    trainingTrack: 'Q1-2026',
                    isActive: true,
                    modules: [
                        {
                            eventModuleId: 2,
                            moduleId: 2,
                            moduleName: 'Building Your First Copilot',
                            speakerName: 'Jane Smith',
                            deliveryOrder: 1,
                            deliveryDate: '2026-02-16T09:00:00'
                        },
                        {
                            eventModuleId: 3,
                            moduleId: 3,
                            moduleName: 'Advanced Copilot Features',
                            speakerName: 'Bob Johnson',
                            deliveryOrder: 2,
                            deliveryDate: '2026-02-16T13:00:00'
                        }
                    ]
                }
            };

            const event = mockEvents[code];
            resolve(event || null);
        }, CONFIG.MOCK_API_DELAY);
    });
}

// Show event selector (fallback when no event code in URL)
async function showEventSelector() {
    const eventSelectionView = document.getElementById('eventSelectionView');
    const eventSelect = document.getElementById('eventSelect');
    const continueBtn = document.getElementById('continueWithEventBtn');

    loadingState.classList.add('hidden');
    eventSelectionView.classList.remove('hidden');

    try {
        // Load list of active events
        const events = await loadEventsList();

        if (!events || events.length === 0) {
            showError('No active events found. Please contact the event organizer.');
            return;
        }

        // Populate event selector
        eventSelect.innerHTML = '<option value="">-- Select an Event --</option>' +
            events.filter(e => e.isActive).map(e =>
                `<option value="${e.eventCode}">${escapeHtml(e.eventName || e.eventCode)} - ${formatDate(e.startDate)}</option>`
            ).join('');

        // Enable continue button when event is selected
        eventSelect.addEventListener('change', function() {
            continueBtn.disabled = !this.value;
        });

        // Handle continue button click
        continueBtn.addEventListener('click', function() {
            const selectedEventCode = eventSelect.value;
            if (selectedEventCode) {
                // Update URL and reinitialize
                const url = new URL(window.location);
                url.searchParams.set('code', selectedEventCode);
                window.history.pushState({}, '', url);

                // Reload with event code
                eventCode = selectedEventCode;
                eventSelectionView.classList.add('hidden');
                loadingState.classList.remove('hidden');
                initializeForm();
            }
        });
    } catch (error) {
        console.error('Error loading events list:', error);
        showError('Unable to load events. Please try again later.');
    }
}

// Load list of all active events
async function loadEventsList() {
    if (CONFIG.USE_MOCK_DATA) {
        return mockLoadEventsList();
    }

    try {
        const response = await apiGet('/events');
        return response.data || response;
    } catch (error) {
        console.error('Error fetching events list:', error);
        throw error;
    }
}

// Mock load events list
function mockLoadEventsList() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    eventName: 'CAT Bootcamp Q1-2026',
                    startDate: '2026-02-15',
                    isActive: true
                },
                {
                    eventId: 2,
                    eventCode: 'TEST123',
                    eventName: 'Test Event',
                    startDate: '2026-02-16',
                    isActive: true
                }
            ]);
        }, CONFIG.MOCK_API_DELAY);
    });
}

// Display event information
function displayEventInfo(event) {
    const modules = event.modules || [];

    if (modules.length === 0) {
        showError('This event has no modules assigned.');
        return;
    }

    if (modules.length === 1) {
        // Single module - display directly
        selectedEventModule = modules[0];
        document.getElementById('moduleSelector').style.display = 'none';
        document.getElementById('moduleInfoDisplay').style.display = 'block';
        updateModuleDisplay(modules[0]);
    } else {
        // Multiple modules - show selector
        document.getElementById('moduleSelector').style.display = 'block';
        document.getElementById('moduleInfoDisplay').style.display = 'none';

        const moduleSelect = document.getElementById('moduleSelect');
        moduleSelect.innerHTML = '<option value="">-- Select a Module --</option>' +
            modules.map(m =>
                `<option value="${m.eventModuleId}">${escapeHtml(m.moduleName)} - ${escapeHtml(m.speakerName)}</option>`
            ).join('');

        // Listen for module selection
        moduleSelect.addEventListener('change', function() {
            const selectedId = parseInt(this.value);
            const module = modules.find(m => m.eventModuleId === selectedId);
            if (module) {
                selectedEventModule = module;
                document.getElementById('moduleInfoDisplay').style.display = 'block';
                updateModuleDisplay(module);
            } else {
                selectedEventModule = null;
                document.getElementById('moduleInfoDisplay').style.display = 'none';
            }
        });
    }
}

// Display module information (for module-specific URLs)
function displayModuleInfo(module) {
    // Hide module selector (not needed when module is pre-selected from URL)
    document.getElementById('moduleSelector').style.display = 'none';

    // Show module info display
    document.getElementById('moduleInfoDisplay').style.display = 'block';
    updateModuleDisplay(module);
}

// Update module display with selected module info
function updateModuleDisplay(module) {
    document.getElementById('displayModuleName').textContent = escapeHtml(module.moduleName);
    document.getElementById('displayModuleDate').textContent = formatDate(module.deliveryDate || currentEvent.startDate);
    document.getElementById('displaySpeakerName').textContent = escapeHtml(module.speakerName);
}

// Show form
function showForm() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    feedbackForm.classList.remove('hidden');
}

// Show error
function showError(message) {
    loadingState.classList.add('hidden');
    feedbackForm.classList.add('hidden');
    errorMessage.textContent = message;
    errorState.classList.remove('hidden');
}

// Setup form listeners
function setupFormListeners() {
    feedbackForm.addEventListener('submit', handleSubmit);
    clearBtn.addEventListener('click', handleClear);
    additionalComments.addEventListener('input', updateCharCount);
    addRealTimeValidation();
}

// Character counter for comments
function updateCharCount() {
    const count = additionalComments.value.length;
    charCount.textContent = count;

    const warningThreshold = CONFIG.COMMENTS_MAX_LENGTH * 0.9;
    const dangerThreshold = CONFIG.COMMENTS_MAX_LENGTH * 0.8;

    if (count > warningThreshold) {
        charCount.style.color = '#e74c3c';
        charCount.style.fontWeight = 'bold';
    } else if (count > dangerThreshold) {
        charCount.style.color = '#f39c12';
    } else {
        charCount.style.color = '#666';
        charCount.style.fontWeight = 'normal';
    }
}

// Form submission handler
async function handleSubmit(e) {
    e.preventDefault();

    // Clear previous errors
    clearErrors();

    // Validate form
    if (!validateForm()) {
        const firstError = document.querySelector('.form-group.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    // Check rate limiting (skip if MAX_SUBMISSIONS_PER_EVENT is 0)
    if (CONFIG.FEATURES.ENABLE_CLIENT_RATE_LIMITING &&
        CONFIG.MAX_SUBMISSIONS_PER_EVENT > 0 &&
        !rateLimiter.canAttempt()) {
        const waitTime = rateLimiter.getFormattedTimeUntilNextAttempt();
        showNotification(
            'Rate Limit Exceeded',
            `You've submitted feedback recently. Please wait ${waitTime} before submitting again.`,
            'error',
            false
        );
        return;
    }

    // Collect form data
    let formData;
    try {
        formData = collectFormData();
    } catch (error) {
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification(friendlyError.title, friendlyError.message, 'error', true);
        return;
    }

    // Show loading state on button
    setButtonLoading(true);

    try {
        // Submit feedback
        const result = await submitFeedback(formData);

        if (result.success || result.feedbackId) {
            // Record attempt for rate limiting (skip if limit is 0)
            if (CONFIG.FEATURES.ENABLE_CLIENT_RATE_LIMITING && CONFIG.MAX_SUBMISSIONS_PER_EVENT > 0) {
                rateLimiter.recordAttempt();
            }
            showSuccess();
        } else {
            showNotification(
                'Submission Failed',
                'There was an error submitting your feedback. Please try again.',
                'error',
                true
            );
            setButtonLoading(false);
        }
    } catch (error) {
        console.error('Error submitting feedback:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification(
            friendlyError.title,
            friendlyError.message,
            'error',
            friendlyError.canRetry
        );
        setButtonLoading(false);
    }
}

// Validate form
function validateForm() {
    let isValid = true;

    // Validate module selection (if multiple modules)
    if (currentEvent.modules && currentEvent.modules.length > 1 && !selectedEventModule) {
        showValidationError('moduleSelect', 'Please select a module');
        isValid = false;
    }

    // Validate speaker knowledge rating
    const speakerKnowledge = document.querySelector('input[name="speakerKnowledge"]:checked');
    if (!speakerKnowledge) {
        showValidationError('speakerKnowledge', 'Please rate the speaker\'s knowledge');
        isValid = false;
    }

    // Validate content depth
    const contentDepth = document.querySelector('input[name="contentDepth"]:checked');
    if (!contentDepth) {
        showValidationError('contentDepth', 'Please select the content depth rating');
        isValid = false;
    }

    // Validate module satisfaction
    const moduleSatisfaction = document.querySelector('input[name="moduleSatisfaction"]:checked');
    if (!moduleSatisfaction) {
        showValidationError('moduleSatisfaction', 'Please rate your overall satisfaction');
        isValid = false;
    }

    return isValid;
}

// Show validation error
function showValidationError(fieldName, message) {
    const errorElement = document.getElementById(fieldName + 'Error');
    const formGroup = errorElement.closest('.form-group');

    errorElement.textContent = message;
    errorElement.setAttribute('role', 'alert');
    errorElement.setAttribute('aria-live', 'assertive');
    formGroup.classList.add('error');
}

// Clear all errors
function clearErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => {
        error.textContent = '';
        error.removeAttribute('role');
        error.removeAttribute('aria-live');
    });

    const errorGroups = document.querySelectorAll('.form-group.error');
    errorGroups.forEach(group => group.classList.remove('error'));
}

// Collect form data
function collectFormData() {
    if (!selectedEventModule) {
        throw new FeedbackError('Please select a module before submitting feedback');
    }

    const data = {
        eventCode: eventCode,
        eventId: currentEvent.eventId,
        eventModuleId: selectedEventModule.eventModuleId,
        speakerKnowledge: parseInt(document.querySelector('input[name="speakerKnowledge"]:checked').value),
        contentDepth: document.querySelector('input[name="contentDepth"]:checked').value,
        moduleSatisfaction: parseInt(document.querySelector('input[name="moduleSatisfaction"]:checked').value),
        additionalComments: InputSanitizer.sanitizeText(
            document.getElementById('additionalComments').value.trim(),
            CONFIG.COMMENTS_MAX_LENGTH
        )
    };

    // Validate data
    validateFeedbackData(data);

    return data;
}

// Submit feedback to API
async function submitFeedback(data) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockSubmitFeedback(data);
    }

    try {
        const result = await apiPost('/feedback', data);
        return result;
    } catch (error) {
        throw error;
    }
}

// Mock submit for testing
function mockSubmitFeedback(data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log('Mock feedback submission:', data);

            // Store in localStorage for demo purposes
            const allFeedback = JSON.parse(localStorage.getItem('bootcampFeedback')) || [];
            const feedbackWithMetadata = {
                ...data,
                feedbackId: Date.now(),
                submittedAt: new Date().toISOString(),
                moduleName: currentEvent.moduleName,
                moduleDate: currentEvent.moduleDate,
                speakerName: currentEvent.speakerName
            };
            allFeedback.push(feedbackWithMetadata);
            localStorage.setItem('bootcampFeedback', JSON.stringify(allFeedback));

            resolve({ success: true, feedbackId: Date.now() });
        }, CONFIG.MOCK_API_DELAY);
    });
}

// Set button loading state
function setButtonLoading(loading) {
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');

    if (loading) {
        submitBtn.disabled = true;
        btnText.textContent = 'Submitting...';
        btnSpinner.classList.remove('hidden');
    } else {
        submitBtn.disabled = false;
        btnText.textContent = 'Submit Feedback';
        btnSpinner.classList.add('hidden');
    }
}

// Show success message
function showSuccess() {
    feedbackForm.style.display = 'none';
    successMessage.classList.remove('hidden');
    setButtonLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Clear form
function handleClear() {
    if (confirm('Are you sure you want to clear all fields?')) {
        // Clear only feedback fields, not event info
        document.querySelectorAll('input[name="speakerKnowledge"]').forEach(input => input.checked = false);
        document.querySelectorAll('input[name="contentDepth"]').forEach(input => input.checked = false);
        document.querySelectorAll('input[name="moduleSatisfaction"]').forEach(input => input.checked = false);
        document.getElementById('additionalComments').value = '';

        clearErrors();
        charCount.textContent = '0';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Submit another response
// Add real-time validation
function addRealTimeValidation() {
    const inputs = document.querySelectorAll('input, textarea');

    inputs.forEach(input => {
        input.addEventListener('input', function() {
            const formGroup = this.closest('.form-group');
            if (formGroup && formGroup.classList.contains('error')) {
                formGroup.classList.remove('error');
                const errorElement = formGroup.querySelector('.error-message');
                if (errorElement) {
                    errorElement.textContent = '';
                    errorElement.removeAttribute('role');
                    errorElement.removeAttribute('aria-live');
                }
            }
        });

        input.addEventListener('change', function() {
            const formGroup = this.closest('.form-group');
            if (formGroup && formGroup.classList.contains('error')) {
                formGroup.classList.remove('error');
                const errorElement = formGroup.querySelector('.error-message');
                if (errorElement) {
                    errorElement.textContent = '';
                    errorElement.removeAttribute('role');
                    errorElement.removeAttribute('aria-live');
                }
            }
        });
    });
}

// Show notification
function showNotification(title, message, type = 'error', canRetry = false) {
    // Remove any existing notifications
    const existing = document.querySelector('.error-notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `error-notification ${type}`;
    notification.innerHTML = `
        <div class="error-content">
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(message)}</p>
            <button class="notification-close" onclick="this.closest('.error-notification').remove()">Close</button>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
}

// Utility function to view all stored feedback (for debugging)
window.viewAllFeedback = function() {
    const allFeedback = JSON.parse(localStorage.getItem('bootcampFeedback')) || [];
    console.log('All Feedback Submissions:', allFeedback);
    console.log('Total submissions:', allFeedback.length);
    return allFeedback;
};

// Utility function to clear all feedback (for debugging)
window.clearAllFeedback = function() {
    if (confirm('Are you sure you want to delete all stored feedback?')) {
        localStorage.removeItem('bootcampFeedback');
        console.log('All feedback cleared');
    }
};

console.log('CAT Bootcamp Feedback Form Loaded');
console.log('Event Code:', eventCode);
console.log('Using Mock Data:', CONFIG.USE_MOCK_DATA);
if (CONFIG.USE_MOCK_DATA) {
    console.log('Try these event codes: CSA1B2C3, TEST123');
    console.log('Developer tools: viewAllFeedback(), clearAllFeedback()');
}
