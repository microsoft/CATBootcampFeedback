// Configuration
const API_BASE_URL = '/api';
// Auto-detect environment - use real API in production
const USE_MOCK_DATA = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const FEEDBACK_BASE_URL = window.location.origin + '/feedback.html';

// Global state
let currentUser = null;
let allEvents = [];
let allFeedback = [];
let currentEventId = null;

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
    checkAuthentication();
    setupEventListeners();
});

// Check if user is already authenticated
function checkAuthentication() {
    const token = localStorage.getItem('adminToken');
    if (token) {
        // Validate token (in real app, verify with server)
        currentUser = JSON.parse(localStorage.getItem('adminUser'));
        showMainContent();
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
    document.getElementById('eventSearch').addEventListener('input', filterEvents);

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

    try {
        const result = await authenticateUser(username, password);
        if (result.success) {
            currentUser = result.user;
            localStorage.setItem('adminToken', result.token);
            localStorage.setItem('adminUser', JSON.stringify(result.user));
            showMainContent();
        } else {
            loginError.textContent = 'Invalid username or password';
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'An error occurred. Please try again.';
    }
}

// Authenticate user
async function authenticateUser(username, password) {
    if (USE_MOCK_DATA) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (username === 'admin' && password === 'admin123') {
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
    const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    return await response.json();
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
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
function showMainContent() {
    loginScreen.classList.add('hidden');
    mainContent.classList.remove('hidden');
    if (currentUser) {
        adminUser.textContent = currentUser.fullName || currentUser.username;
    }
    loadEvents();
    loadFeedback();
    updateAnalytics();
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
    if (USE_MOCK_DATA) {
        return mockFetchEvents();
    }

    try {
        const response = await fetch(`${API_BASE_URL}/events`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        // Handle API response format - data.events contains the array
        return result.data?.events || result.events || result;
    } catch (error) {
        console.error('Error fetching events:', error);
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

    eventsList.innerHTML = events.map(event => {
        // Handle both PascalCase (from API) and camelCase (from mock data)
        const eventId = event.EventId || event.eventId;
        const eventCode = event.EventCode || event.eventCode;
        const moduleName = event.ModuleName || event.moduleName;
        const moduleDate = event.ModuleDate || event.moduleDate;
        const speakerName = event.SpeakerName || event.speakerName;
        const isActive = event.IsActive !== undefined ? event.IsActive : event.isActive;
        const feedbackCount = event.FeedbackCount || event.feedbackCount || 0;

        return `
        <div class="event-card" data-event-id="${eventId}">
            <div class="event-card-header">
                <div>
                    <div class="event-title">${moduleName}</div>
                    <span class="event-code">${eventCode}</span>
                </div>
                <div class="event-status">
                    <span class="status-badge ${isActive ? 'active' : 'inactive'}">
                        ${isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            <div class="event-meta">
                <div class="event-meta-item">
                    <span>📅</span>
                    <span>${formatDate(moduleDate)}</span>
                </div>
                <div class="event-meta-item">
                    <span>👤</span>
                    <span>${speakerName}</span>
                </div>
                <div class="event-meta-item">
                    <span>💬</span>
                    <span>${feedbackCount} feedback</span>
                </div>
            </div>
            <div class="event-actions">
                <button class="btn btn-primary btn-icon" onclick="viewEventDetails(${eventId})">
                    📋 View Details & QR
                </button>
                <button class="btn btn-secondary btn-icon" onclick="editEvent(${eventId})">
                    ✏️ Edit
                </button>
                <button class="btn btn-secondary btn-icon" onclick="toggleEventStatus(${eventId})">
                    ${isActive ? '🚫 Deactivate' : '✅ Activate'}
                </button>
                <button class="btn btn-danger btn-icon" onclick="deleteEvent(${eventId}, '${eventCode}', '${moduleName.replace(/'/g, "\\'")}')">
                    🗑️ Delete
                </button>
            </div>
        </div>
        `;
    }).join('');
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
            loadEvents();
            alert(formData.eventId ? 'Event updated successfully!' : 'Event created successfully!');
        } else {
            alert('Error saving event. Please try again.');
        }
    } catch (error) {
        console.error('Error saving event:', error);
        alert('Error saving event. Please try again.');
    }
}

// Save event
async function saveEvent(data) {
    if (USE_MOCK_DATA) {
        return mockSaveEvent(data);
    }

    const url = data.eventId
        ? `${API_BASE_URL}/admin/events/${data.eventId}`
        : `${API_BASE_URL}/admin/events`;

    const method = data.eventId ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(data)
    });

    return await response.json();
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
                // Create new
                const newEvent = {
                    ...data,
                    eventId: Date.now(),
                    eventCode: generateEventCode(),
                    createdAt: new Date().toISOString(),
                    feedbackCount: 0
                };
                allEvents.push(newEvent);
            }
            resolve({ success: true });
        }, 500);
    });
}

// Generate event code
function generateEventCode() {
    const prefix = 'CS';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = prefix;
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// View event details
window.viewEventDetails = function(eventId) {
    const event = allEvents.find(e => (e.EventId || e.eventId) === eventId);
    if (!event) return;

    const modal = document.getElementById('eventDetailsModal');
    const content = document.getElementById('eventDetailsContent');

    // Get event code (handle both PascalCase and camelCase)
    const eventCode = event.EventCode || event.eventCode;

    // Generate clean feedback URL (only code parameter, no extras)
    const feedbackUrl = `${FEEDBACK_BASE_URL}?code=${encodeURIComponent(eventCode)}`;

    content.innerHTML = `
        <div class="detail-section">
            <h4>Event Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Module Name</span>
                    <span class="detail-value">${event.moduleName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Event Code</span>
                    <span class="detail-value">${event.eventCode}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Date</span>
                    <span class="detail-value">${formatDate(event.moduleDate)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Speaker</span>
                    <span class="detail-value">${event.speakerName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cohort</span>
                    <span class="detail-value">${event.cohortId || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">${event.isActive ? 'Active' : 'Inactive'}</span>
                </div>
            </div>
        </div>

        <div class="detail-section qr-code-section">
            <h4>Feedback URL & QR Code</h4>
            <div class="url-display">${feedbackUrl}</div>
            <canvas id="qrCanvas"></canvas>
            <div class="qr-actions">
                <button class="btn btn-primary" onclick="copyFeedbackUrl('${feedbackUrl}')">📋 Copy URL</button>
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
        QRCode.toCanvas(canvas, feedbackUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#667eea',
                light: '#ffffff'
            }
        });
    }, 100);

    document.getElementById('eventDetailsTitle').textContent = event.moduleName;
    modal.classList.remove('hidden');
};

// Close event details modal
function closeEventDetailsModal() {
    document.getElementById('eventDetailsModal').classList.add('hidden');
}

// Copy feedback URL
window.copyFeedbackUrl = function(url) {
    navigator.clipboard.writeText(url).then(() => {
        alert('URL copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
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
                loadEvents();
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            alert('Error updating event status.');
        }
    }
};

// Delete event
window.deleteEvent = async function(eventId, eventCode, moduleName) {
    const confirmed = confirm(
        `⚠️ DELETE EVENT?\n\n` +
        `Event: ${moduleName}\n` +
        `Code: ${eventCode}\n\n` +
        `This will permanently delete the event and ALL associated feedback.\n\n` +
        `This action CANNOT be undone!\n\n` +
        `Are you sure you want to continue?`
    );

    if (!confirmed) {
        return;
    }

    try {
        if (USE_MOCK_DATA) {
            // Mock delete
            allEvents = allEvents.filter(e => (e.EventId || e.eventId) !== eventId);
            allFeedback = allFeedback.filter(fb => (fb.EventId || fb.eventId) !== eventId);
            alert('Event deleted successfully!');
            loadEvents();
            return;
        }

        // Real API call
        const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            alert(`Event deleted successfully!\n${result.data.feedbackDeleted || 0} feedback entries were also removed.`);
            loadEvents();
            loadFeedback();
            updateAnalytics();
        } else {
            throw new Error(result.message || 'Failed to delete event');
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error deleting event. Please try again.');
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
    if (USE_MOCK_DATA) {
        return mockFetchFeedback();
    }

    try {
        const response = await fetch(`${API_BASE_URL}/feedback`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        // Handle API response format - data.feedback contains the array
        return result.data?.feedback || result.feedback || result;
    } catch (error) {
        console.error('Error fetching feedback:', error);
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

// Render feedback
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
                <div class="feedback-event">${fb.moduleName || 'Unknown Module'}</div>
                <div class="feedback-date">${formatDateTime(fb.submittedAt)}</div>
            </div>
            <div class="feedback-ratings">
                <div class="rating-item">
                    <span class="rating-label">Speaker Knowledge</span>
                    <span class="rating-value">${getStars(fb.speakerKnowledge)}</span>
                </div>
                <div class="rating-item">
                    <span class="rating-label">Content Depth</span>
                    <span class="rating-value">${fb.contentDepth}</span>
                </div>
                <div class="rating-item">
                    <span class="rating-label">Overall Satisfaction</span>
                    <span class="rating-value">${getStars(fb.moduleSatisfaction)}</span>
                </div>
            </div>
            ${fb.additionalComments ? `
                <div class="feedback-comments">
                    <span class="feedback-comments-label">Additional Comments:</span>
                    <div class="feedback-comments-text">${fb.additionalComments}</div>
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
        events.map(e => `<option value="${e.eventCode}">${e.moduleName}</option>`).join('');
}

// Update analytics
async function updateAnalytics() {
    await loadFeedback();

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
                <div class="depth-label">${label}</div>
                <div class="depth-bar-container">
                    <div class="depth-bar-fill" style="width: ${percentage}%">
                        ${count} (${percentage}%)
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Export feedback to CSV
function exportFeedbackToCSV() {
    if (allFeedback.length === 0) {
        alert('No feedback to export.');
        return;
    }

    const headers = ['Module Name', 'Event Code', 'Speaker Name', 'Date', 'Speaker Knowledge', 'Content Depth', 'Module Satisfaction', 'Additional Comments', 'Submitted At'];
    const rows = allFeedback.map(fb => [
        fb.moduleName || '',
        fb.eventCode || '',
        fb.speakerName || '',
        fb.moduleDate || '',
        fb.speakerKnowledge,
        fb.contentDepth,
        fb.moduleSatisfaction,
        (fb.additionalComments || '').replace(/"/g, '""'),
        fb.submittedAt
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStars(rating) {
    return '⭐'.repeat(rating);
}

console.log('Admin Panel Loaded');
console.log('Using Mock Data:', USE_MOCK_DATA);
