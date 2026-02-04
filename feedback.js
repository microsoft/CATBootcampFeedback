// Configuration
const API_BASE_URL = '/api'; // Change this to your actual API URL in production
// For local development with mock data, set to 'mock'
const USE_MOCK_DATA = true; // Set to false when connecting to real API

// Global state
let currentEvent = null;
let eventCode = null;

// DOM elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const feedbackForm = document.getElementById('feedbackForm');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const submitAnotherBtn = document.getElementById('submitAnotherBtn');
const successMessage = document.getElementById('successMessage');
const additionalComments = document.getElementById('additionalComments');
const charCount = document.getElementById('charCount');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
});

// Initialize form
async function initializeForm() {
    // Get event code from URL parameter
    eventCode = getUrlParameter('code');

    if (!eventCode) {
        showError('No event code provided. Please use the correct feedback link.');
        return;
    }

    // Load event details
    try {
        const event = await loadEventDetails(eventCode);
        if (event) {
            currentEvent = event;
            displayEventInfo(event);
            showForm();
            setupFormListeners();
        } else {
            showError('The feedback link appears to be invalid or expired.');
        }
    } catch (error) {
        console.error('Error loading event:', error);
        showError('Unable to load event information. Please try again later.');
    }
}

// Get URL parameter
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Load event details from API
async function loadEventDetails(code) {
    if (USE_MOCK_DATA) {
        // Mock data for testing
        return mockLoadEventDetails(code);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/events/${code}`);

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const event = await response.json();
        return event;
    } catch (error) {
        console.error('Error fetching event:', error);
        throw error;
    }
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

            const event = mockEvents[code];
            resolve(event || null);
        }, 1000); // Simulate network delay
    });
}

// Display event information
function displayEventInfo(event) {
    document.getElementById('displayModuleName').textContent = event.moduleName;
    document.getElementById('displayModuleDate').textContent = formatDate(event.moduleDate);
    document.getElementById('displaySpeakerName').textContent = event.speakerName;
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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
    submitAnotherBtn.addEventListener('click', handleSubmitAnother);
    additionalComments.addEventListener('input', updateCharCount);
    addRealTimeValidation();
}

// Character counter for comments
function updateCharCount() {
    const count = additionalComments.value.length;
    charCount.textContent = count;

    if (count > 900) {
        charCount.style.color = '#e74c3c';
        charCount.style.fontWeight = 'bold';
    } else if (count > 800) {
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

    // Collect form data
    const formData = collectFormData();

    // Show loading state on button
    setButtonLoading(true);

    try {
        // Submit feedback
        const result = await submitFeedback(formData);

        if (result.success) {
            showSuccess();
        } else {
            alert('There was an error submitting your feedback. Please try again.');
            setButtonLoading(false);
        }
    } catch (error) {
        console.error('Error submitting feedback:', error);
        alert('There was an error submitting your feedback. Please try again.');
        setButtonLoading(false);
    }
}

// Validate form
function validateForm() {
    let isValid = true;

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
    formGroup.classList.add('error');
}

// Clear all errors
function clearErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => error.textContent = '');

    const errorGroups = document.querySelectorAll('.form-group.error');
    errorGroups.forEach(group => group.classList.remove('error'));
}

// Collect form data
function collectFormData() {
    return {
        eventCode: eventCode,
        eventId: currentEvent.eventId,
        speakerKnowledge: parseInt(document.querySelector('input[name="speakerKnowledge"]:checked').value),
        contentDepth: document.querySelector('input[name="contentDepth"]:checked').value,
        moduleSatisfaction: parseInt(document.querySelector('input[name="moduleSatisfaction"]:checked').value),
        additionalComments: document.getElementById('additionalComments').value.trim()
    };
}

// Submit feedback to API
async function submitFeedback(data) {
    if (USE_MOCK_DATA) {
        return mockSubmitFeedback(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error submitting feedback:', error);
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
        }, 1000); // Simulate network delay
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
function handleSubmitAnother() {
    successMessage.classList.add('hidden');
    feedbackForm.style.display = 'block';

    // Clear feedback fields
    document.querySelectorAll('input[name="speakerKnowledge"]').forEach(input => input.checked = false);
    document.querySelectorAll('input[name="contentDepth"]').forEach(input => input.checked = false);
    document.querySelectorAll('input[name="moduleSatisfaction"]').forEach(input => input.checked = false);
    document.getElementById('additionalComments').value = '';

    clearErrors();
    charCount.textContent = '0';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
                }
            }
        });
    });
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

console.log('Copilot Studio Bootcamp Feedback Form Loaded');
console.log('Event Code:', eventCode);
console.log('Using Mock Data:', USE_MOCK_DATA);
if (USE_MOCK_DATA) {
    console.log('Try these event codes: CSA1B2C3, TEST123');
    console.log('Developer tools: viewAllFeedback(), clearAllFeedback()');
}
