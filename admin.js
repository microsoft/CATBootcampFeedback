/**
 * Admin Panel - Main Application
 * Integrated with utility modules, security fixes, and optimizations
 */

import { CONFIG } from './config.js';
import {
    escapeHtml,
    formatDate,
    formatDateTime,
    getStars,
    debounce,
    generateEventCode
} from './utils.js';
import { getUserFriendlyErrorMessage } from './errors.js';
import { apiGet, apiPost, apiPut } from './api.js';
import { createLoginRateLimiter } from './RateLimiter.js';

// Global state
let currentUser = null;
let allEvents = [];
let allFeedback = [];
let currentEventId = null;
let loginRateLimiter = null;

// Determine base URLs
const FEEDBACK_BASE_URL = window.location.origin + '/feedback.html';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const adminUser = document.getElementById('adminUser');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loginRateLimiter = createLoginRateLimiter();
    checkAuthentication();
    setupEventListeners();
});

// Check if user is already authenticated
function checkAuthentication() {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
        // Validate token (in real app, verify with server)
        const userStr = sessionStorage.getItem('adminUser');
        if (userStr) {
            currentUser = JSON.parse(userStr);
            showMainContent();
        } else {
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // Tabs
    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    // Events tab
    document.getElementById('createEventBtn').addEventListener('click', () => openEventModal());

    // Debounced search
    const debouncedFilterEvents = debounce(filterEvents, 300);
    document.getElementById('eventSearch').addEventListener('input', debouncedFilterEvents);

    // Event modal
    document.getElementById('closeModal').addEventListener('click', closeEventModal);
    document.getElementById('cancelEventBtn').addEventListener('click', closeEventModal);
    document.getElementById('eventForm').addEventListener('submit', handleSaveEvent);

    // Event details modal
    document.getElementById('closeDetailsModal').addEventListener('click', closeEventDetailsModal);

    // Feedback tab
    document.getElementById('exportFeedbackBtn').addEventListener('click', exportFeedbackToCSV);
    document.getElementById('filterEvent').addEventListener('change', filterFeedback);
    document.getElementById('filterRating').addEventListener('change', filterFeedback);
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    loginError.textContent = '';

    // Check rate limiting
    if (!loginRateLimiter.canAttempt()) {
        const waitTime = loginRateLimiter.getFormattedTimeUntilNextAttempt();
        loginError.textContent = `Too many login attempts. Please wait ${waitTime}.`;
        return;
    }

    try {
        const result = await authenticateUser(username, password);
        if (result.success) {
            currentUser = result.user;
            sessionStorage.setItem('adminToken', result.token);
            sessionStorage.setItem('adminUser', JSON.stringify(result.user));

            // Reset rate limiter on successful login
            loginRateLimiter.reset();

            showMainContent();
        } else {
            loginRateLimiter.recordAttempt();
            loginError.textContent = 'Invalid username or password';
        }
    } catch (error) {
        console.error('Login error:', error);
        loginRateLimiter.recordAttempt();
        const friendlyError = getUserFriendlyErrorMessage(error);
        loginError.textContent = friendlyError.message;
    }
}

// Authenticate user
async function authenticateUser(username, password) {
    if (CONFIG.USE_MOCK_DATA) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (username === 'admin' && password === 'CATBootcamp2026!') {
                    resolve({
                        success: true,
                        token: 'mock-token-' + Date.now(),
                        user: { username: 'admin', fullName: 'Admin User' }
                    });
                } else {
                    resolve({ success: false });
                }
            }, 500);
        });
    }

    // Real API call
    try {
        const result = await apiPost('/login', { username, password });
        return result;
    } catch (error) {
        throw error;
    }
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminUser');
        currentUser = null;
        showLoginScreen();
    }
}

// Show login screen
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    mainContent.classList.add('hidden');
}

// Show main content
async function showMainContent() {
    loginScreen.classList.add('hidden');
    mainContent.classList.remove('hidden');
    if (currentUser) {
        adminUser.textContent = escapeHtml(currentUser.fullName || currentUser.username);
    }

    // Load data in parallel (optimization)
    try {
        const [events, feedback] = await Promise.all([
            fetchEvents(),
            fetchFeedback()
        ]);

        allEvents = events;
        allFeedback = feedback;

        renderEvents(events);
        populateEventFilter(events);
        renderFeedback(feedback);
        updateAnalyticsUI();
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error', 'Failed to load data. Please refresh the page.', 'error');
    }
}

// Switch tabs
function switchTab(tabName) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}Tab`);

    if (activeButton && activeContent) {
        activeButton.classList.add('active');
        activeContent.classList.add('active');
    }
}

// Load events
async function loadEvents() {
    try {
        const events = await fetchEvents();
        allEvents = events;
        renderEvents(events);
        populateEventFilter(events);
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

// Fetch events from API
async function fetchEvents() {
    if (CONFIG.USE_MOCK_DATA) {
        return mockFetchEvents();
    }

    try {
        const events = await apiGet('/admin/events');
        return events;
    } catch (error) {
        throw error;
    }
}

// Mock fetch events
function mockFetchEvents() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockEvents = [
                {
                    eventId: 1,
                    eventCode: 'CSA1B2C3',
                    moduleName: 'Introduction to Copilot Studio',
                    moduleDate: '2026-02-15',
                    speakerName: 'John Doe',
                    cohortId: 'Q1-2026',
                    isActive: true,
                    createdAt: '2026-02-01T10:00:00Z',
                    feedbackCount: 5
                },
                {
                    eventId: 2,
                    eventCode: 'TEST123',
                    moduleName: 'Building Your First Copilot',
                    moduleDate: '2026-02-16',
                    speakerName: 'Jane Smith',
                    cohortId: 'Q1-2026',
                    isActive: true,
                    createdAt: '2026-02-01T11:00:00Z',
                    feedbackCount: 3
                }
            ];
            resolve(mockEvents);
        }, 500);
    });
}

// Render events
function renderEvents(events) {
    const eventsList = document.getElementById('eventsList');

    if (events.length === 0) {
        eventsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <p>No events found. Create your first event to get started.</p>
            </div>
        `;
        return;
    }

    eventsList.innerHTML = events.map(event => `
        <div class="event-card" data-event-id="${event.eventId}">
            <div class="event-card-header">
                <div>
                    <div class="event-title">${escapeHtml(event.moduleName)}</div>
                    <span class="event-code">${escapeHtml(event.eventCode)}</span>
                </div>
                <div class="event-status">
                    <span class="status-badge ${event.isActive ? 'active' : 'inactive'}">
                        ${event.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            <div class="event-meta">
                <div class="event-meta-item">
                    <span>📅</span>
                    <span>${formatDate(event.moduleDate)}</span>
                </div>
                <div class="event-meta-item">
                    <span>👤</span>
                    <span>${escapeHtml(event.speakerName)}</span>
                </div>
                <div class="event-meta-item">
                    <span>💬</span>
                    <span>${event.feedbackCount || 0} feedback</span>
                </div>
            </div>
            <div class="event-actions">
                <button class="btn btn-primary btn-icon" onclick="viewEventDetails(${event.eventId})">
                    📋 View Details & QR
                </button>
                <button class="btn btn-secondary btn-icon" onclick="editEvent(${event.eventId})">
                    ✏️ Edit
                </button>
                <button class="btn btn-secondary btn-icon" onclick="toggleEventStatus(${event.eventId})">
                    ${event.isActive ? '🚫 Deactivate' : '✅ Activate'}
                </button>
            </div>
        </div>
    `).join('');
}

// Filter events
function filterEvents() {
    const searchTerm = document.getElementById('eventSearch').value.toLowerCase();
    const filteredEvents = allEvents.filter(event =>
        event.moduleName.toLowerCase().includes(searchTerm) ||
        event.speakerName.toLowerCase().includes(searchTerm) ||
        event.eventCode.toLowerCase().includes(searchTerm)
    );
    renderEvents(filteredEvents);
}

// Open event modal
function openEventModal(eventId = null) {
    const modal = document.getElementById('eventModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('eventForm');

    form.reset();

    if (eventId) {
        const event = allEvents.find(e => e.eventId === eventId);
        if (event) {
            modalTitle.textContent = 'Edit Event';
            document.getElementById('eventId').value = event.eventId;
            document.getElementById('eventCode').value = event.eventCode;
            document.getElementById('moduleName').value = event.moduleName;
            document.getElementById('moduleDate').value = event.moduleDate;
            document.getElementById('speakerName').value = event.speakerName;
            document.getElementById('cohortId').value = event.cohortId || '';
            document.getElementById('description').value = event.description || '';
            document.getElementById('isActive').checked = event.isActive;
        }
    } else {
        modalTitle.textContent = 'Create New Event';
        document.getElementById('eventId').value = '';
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('moduleDate').value = today;
        document.getElementById('isActive').checked = true;
    }

    modal.classList.remove('hidden');
}

// Close event modal
function closeEventModal() {
    document.getElementById('eventModal').classList.add('hidden');
}

// Handle save event
async function handleSaveEvent(e) {
    e.preventDefault();

    const formData = {
        eventId: document.getElementById('eventId').value || null,
        eventCode: document.getElementById('eventCode').value,
        moduleName: document.getElementById('moduleName').value,
        moduleDate: document.getElementById('moduleDate').value,
        speakerName: document.getElementById('speakerName').value,
        cohortId: document.getElementById('cohortId').value || null,
        description: document.getElementById('description').value || null,
        isActive: document.getElementById('isActive').checked
    };

    try {
        const result = await saveEvent(formData);
        if (result.success) {
            closeEventModal();
            await loadEvents();
            showNotification(
                'Success',
                formData.eventId ? 'Event updated successfully!' : 'Event created successfully!',
                'success'
            );
        } else {
            showNotification('Error', 'Error saving event. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error saving event:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

// Save event
async function saveEvent(data) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockSaveEvent(data);
    }

    try {
        if (data.eventId) {
            const result = await apiPut(`/admin/events/${data.eventId}`, data);
            return result;
        } else {
            const result = await apiPost('/admin/events', data);
            return result;
        }
    } catch (error) {
        throw error;
    }
}

// Mock save event
function mockSaveEvent(data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (data.eventId) {
                // Update existing
                const index = allEvents.findIndex(e => e.eventId == data.eventId);
                if (index !== -1) {
                    allEvents[index] = { ...allEvents[index], ...data };
                }
            } else {
                // Create new - use admin-provided event code
                const newEvent = {
                    ...data,
                    eventId: Date.now(),
                    eventCode: data.eventCode,  // Use admin-provided code, not generated
                    createdAt: new Date().toISOString(),
                    feedbackCount: 0
                };
                allEvents.push(newEvent);
            }
            resolve({ success: true });
        }, 500);
    });
}

// View event details
window.viewEventDetails = function(eventId) {
    const event = allEvents.find(e => e.eventId === eventId);
    if (!event) return;

    const modal = document.getElementById('eventDetailsModal');
    const content = document.getElementById('eventDetailsContent');
    const feedbackUrl = `${FEEDBACK_BASE_URL}?code=${event.eventCode}`;

    content.innerHTML = `
        <div class="detail-section">
            <h4>Event Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Module Name</span>
                    <span class="detail-value">${escapeHtml(event.moduleName)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Event Code</span>
                    <span class="detail-value">${escapeHtml(event.eventCode)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Date</span>
                    <span class="detail-value">${formatDate(event.moduleDate)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Speaker</span>
                    <span class="detail-value">${escapeHtml(event.speakerName)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cohort</span>
                    <span class="detail-value">${escapeHtml(event.cohortId || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">${event.isActive ? 'Active' : 'Inactive'}</span>
                </div>
            </div>
        </div>

        <div class="detail-section qr-code-section">
            <h4>Feedback URL & QR Code</h4>
            <div class="url-display">${escapeHtml(feedbackUrl)}</div>
            <canvas id="qrCanvas"></canvas>
            <div class="qr-actions">
                <button class="btn btn-primary" onclick="copyFeedbackUrl('${feedbackUrl.replace(/'/g, "\\'")}')">📋 Copy URL</button>
                <button class="btn btn-secondary" onclick="downloadQRCode()">💾 Download QR Code</button>
                <button class="btn btn-secondary" onclick="window.open('/count.html?code=${event.eventCode}', '_blank')">
                    📊 Open Count Display
                </button>
            </div>
        </div>
    `;

    // Generate QR code
    setTimeout(() => {
        const canvas = document.getElementById('qrCanvas');
        if (typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, feedbackUrl, {
                width: CONFIG.QR_CODE_SIZE,
                margin: CONFIG.QR_CODE_MARGIN,
                color: {
                    dark: CONFIG.QR_CODE_COLOR_DARK,
                    light: CONFIG.QR_CODE_COLOR_LIGHT
                }
            });
        }
    }, 100);

    document.getElementById('eventDetailsTitle').textContent = escapeHtml(event.moduleName);
    modal.classList.remove('hidden');
};

// Close event details modal
function closeEventDetailsModal() {
    document.getElementById('eventDetailsModal').classList.add('hidden');
}

// Copy feedback URL
window.copyFeedbackUrl = async function(url) {
    try {
        await navigator.clipboard.writeText(url);
        showNotification('Success', 'URL copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy:', err);
        showNotification('Error', 'Failed to copy URL', 'error');
    }
};

// Download QR code
window.downloadQRCode = function() {
    const canvas = document.getElementById('qrCanvas');
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'feedback-qr-code.png';
    link.href = url;
    link.click();
};

// Edit event
window.editEvent = function(eventId) {
    openEventModal(eventId);
};

// Toggle event status
window.toggleEventStatus = async function(eventId) {
    const event = allEvents.find(e => e.eventId === eventId);
    if (!event) return;

    const newStatus = !event.isActive;
    const action = newStatus ? 'activate' : 'deactivate';

    if (confirm(`Are you sure you want to ${action} this event?`)) {
        try {
            const result = await saveEvent({
                ...event,
                isActive: newStatus
            });

            if (result.success) {
                await loadEvents();
                showNotification('Success', `Event ${action}d successfully!`, 'success');
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            showNotification('Error', 'Error updating event status.', 'error');
        }
    }
};

// Load feedback
async function loadFeedback() {
    try {
        const feedback = await fetchFeedback();
        allFeedback = feedback;
        renderFeedback(feedback);
    } catch (error) {
        console.error('Error loading feedback:', error);
    }
}

// Fetch feedback
async function fetchFeedback() {
    if (CONFIG.USE_MOCK_DATA) {
        return mockFetchFeedback();
    }

    try {
        const feedback = await apiGet('/admin/feedback');
        return feedback;
    } catch (error) {
        throw error;
    }
}

// Mock fetch feedback
function mockFetchFeedback() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const feedback = JSON.parse(localStorage.getItem('bootcampFeedback')) || [];
            resolve(feedback);
        }, 500);
    });
}

// Render feedback (with XSS protection)
function renderFeedback(feedback) {
    const feedbackList = document.getElementById('feedbackList');

    if (feedback.length === 0) {
        feedbackList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <p>No feedback submissions yet.</p>
            </div>
        `;
        return;
    }

    feedbackList.innerHTML = feedback.map(fb => `
        <div class="feedback-card">
            <div class="feedback-header">
                <div class="feedback-event">${escapeHtml(fb.moduleName || 'Unknown Module')}</div>
                <div class="feedback-date">${formatDateTime(fb.submittedAt)}</div>
            </div>
            <div class="feedback-ratings">
                <div class="rating-item">
                    <span class="rating-label">Speaker Knowledge</span>
                    <span class="rating-value">${getStars(fb.speakerKnowledge)}</span>
                </div>
                <div class="rating-item">
                    <span class="rating-label">Content Depth</span>
                    <span class="rating-value">${escapeHtml(fb.contentDepth)}</span>
                </div>
                <div class="rating-item">
                    <span class="rating-label">Overall Satisfaction</span>
                    <span class="rating-value">${getStars(fb.moduleSatisfaction)}</span>
                </div>
            </div>
            ${fb.additionalComments ? `
                <div class="feedback-comments">
                    <span class="feedback-comments-label">Additional Comments:</span>
                    <div class="feedback-comments-text">${escapeHtml(fb.additionalComments)}</div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Filter feedback
function filterFeedback() {
    const eventFilter = document.getElementById('filterEvent').value;
    const ratingFilter = document.getElementById('filterRating').value;

    let filtered = allFeedback;

    if (eventFilter) {
        filtered = filtered.filter(fb => fb.eventCode === eventFilter);
    }

    if (ratingFilter) {
        filtered = filtered.filter(fb => fb.moduleSatisfaction == ratingFilter);
    }

    renderFeedback(filtered);
}

// Populate event filter
function populateEventFilter(events) {
    const filterEvent = document.getElementById('filterEvent');
    filterEvent.innerHTML = '<option value="">All Events</option>' +
        events.map(e => `<option value="${escapeHtml(e.eventCode)}">${escapeHtml(e.moduleName)}</option>`).join('');
}

// Update analytics UI (optimized - doesn't reload data)
function updateAnalyticsUI() {
    const totalEvents = allEvents.length;
    const totalFeedback = allFeedback.length;
    const avgSatisfaction = allFeedback.length > 0
        ? (allFeedback.reduce((sum, fb) => sum + fb.moduleSatisfaction, 0) / allFeedback.length).toFixed(1)
        : 0;
    const avgSpeakerKnowledge = allFeedback.length > 0
        ? (allFeedback.reduce((sum, fb) => sum + fb.speakerKnowledge, 0) / allFeedback.length).toFixed(1)
        : 0;

    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('totalFeedback').textContent = totalFeedback;
    document.getElementById('avgSatisfaction').textContent = avgSatisfaction;
    document.getElementById('avgSpeakerKnowledge').textContent = avgSpeakerKnowledge;

    // Content depth chart
    const depthCounts = {
        'Too Technical': 0,
        'Just Right': 0,
        'Too Low Level': 0
    };

    allFeedback.forEach(fb => {
        if (depthCounts.hasOwnProperty(fb.contentDepth)) {
            depthCounts[fb.contentDepth]++;
        }
    });

    const total = allFeedback.length || 1;
    const depthChart = document.getElementById('depthChart');
    depthChart.innerHTML = Object.entries(depthCounts).map(([label, count]) => {
        const percentage = ((count / total) * 100).toFixed(0);
        return `
            <div class="depth-bar">
                <div class="depth-label">${escapeHtml(label)}</div>
                <div class="depth-bar-container">
                    <div class="depth-bar-fill" style="width: ${percentage}%">
                        ${count} (${percentage}%)
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Export feedback to CSV (with proper escaping)
function exportFeedbackToCSV() {
    if (allFeedback.length === 0) {
        showNotification('Info', 'No feedback to export.', 'info');
        return;
    }

    // Helper to properly escape CSV values
    const escapeCsvValue = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // If contains comma, newline, or quote, wrap in quotes and escape quotes
        if (/[",\n\r]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headers = ['Module Name', 'Event Code', 'Speaker Name', 'Date',
                    'Speaker Knowledge', 'Content Depth', 'Module Satisfaction',
                    'Additional Comments', 'Submitted At'];

    const rows = allFeedback.map(fb => [
        escapeCsvValue(fb.moduleName),
        escapeCsvValue(fb.eventCode),
        escapeCsvValue(fb.speakerName),
        escapeCsvValue(fb.moduleDate),
        fb.speakerKnowledge,
        escapeCsvValue(fb.contentDepth),
        fb.moduleSatisfaction,
        escapeCsvValue(fb.additionalComments),
        fb.submittedAt
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showNotification('Success', 'Feedback exported successfully!', 'success');
}

// Show notification
function showNotification(title, message, type = 'info') {
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

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, CONFIG.TOAST_DURATION);
}

console.log('Admin Panel Loaded');
console.log('Using Mock Data:', CONFIG.USE_MOCK_DATA);
