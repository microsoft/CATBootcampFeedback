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
let allModules = [];
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

    // Modules tab
    document.getElementById('createModuleBtn').addEventListener('click', () => openModuleModal());
    const debouncedFilterModules = debounce(filterModules, 300);
    document.getElementById('moduleSearch').addEventListener('input', debouncedFilterModules);

    // Module modal
    document.getElementById('closeModuleModal').addEventListener('click', closeModuleModal);
    document.getElementById('cancelModuleBtn').addEventListener('click', closeModuleModal);
    document.getElementById('moduleForm').addEventListener('submit', handleSaveModule);

    // Events tab
    document.getElementById('createEventBtn').addEventListener('click', () => openEventModal());

    // Debounced search
    const debouncedFilterEvents = debounce(filterEvents, 300);
    document.getElementById('eventSearch').addEventListener('input', debouncedFilterEvents);

    // Event modal
    document.getElementById('closeModal').addEventListener('click', closeEventModal);
    document.getElementById('cancelEventBtn').addEventListener('click', closeEventModal);
    document.getElementById('eventForm').addEventListener('submit', handleSaveEvent);
    document.getElementById('addModuleBtn').addEventListener('click', openAddModuleModal);

    // Add module modal
    document.getElementById('closeAddModuleModal').addEventListener('click', closeAddModuleModal);
    document.getElementById('cancelAddModuleBtn').addEventListener('click', closeAddModuleModal);
    document.getElementById('addModuleForm').addEventListener('submit', handleAddModule);

    // Event details modal
    document.getElementById('closeDetailsModal').addEventListener('click', closeEventDetailsModal);

    // Module and Event action buttons (using event delegation)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // Handle module buttons
        const moduleId = parseInt(target.dataset.moduleId);
        if (moduleId) {
            if (target.classList.contains('btn-add-module-to-event')) {
                addModuleToEvent(moduleId);
            } else if (target.classList.contains('btn-edit-module')) {
                editModule(moduleId);
            } else if (target.classList.contains('btn-toggle-module-status')) {
                toggleModuleStatus(moduleId);
            }
            return;
        }

        // Handle event buttons
        const eventId = parseInt(target.dataset.eventId);
        if (eventId) {
            if (target.classList.contains('btn-view-details')) {
                viewEventDetails(eventId);
            } else if (target.classList.contains('btn-edit-event')) {
                editEvent(eventId);
            } else if (target.classList.contains('btn-toggle-status')) {
                toggleEventStatus(eventId);
            }
            return;
        }

        // Handle module reorder and remove buttons
        const eventModuleId = parseInt(target.dataset.eventModuleId);
        if (eventModuleId) {
            // Don't handle disabled buttons
            if (target.disabled || target.hasAttribute('disabled')) {
                return;
            }

            const currentOrder = parseInt(target.dataset.currentOrder);
            if (target.classList.contains('btn-reorder-up')) {
                reorderModule(eventModuleId, currentOrder - 1);
            } else if (target.classList.contains('btn-reorder-down')) {
                reorderModule(eventModuleId, currentOrder + 1);
            } else if (target.classList.contains('btn-remove-event-module')) {
                window.removeEventModule(eventModuleId);
            }
        }
    });

    // Feedback tab
    document.getElementById('exportFeedbackBtn').addEventListener('click', exportFeedbackToCSV);
    document.getElementById('filterEvent').addEventListener('change', filterAndSortFeedback);
    document.getElementById('filterModule').addEventListener('change', filterAndSortFeedback);
    document.getElementById('filterSpeaker').addEventListener('change', filterAndSortFeedback);
    document.getElementById('filterRating').addEventListener('change', filterAndSortFeedback);
    document.getElementById('sortFeedback').addEventListener('change', filterAndSortFeedback);

    // Analytics tab
    document.getElementById('analyticsFilterEvent').addEventListener('change', updateAnalyticsWithFilters);
    document.getElementById('analyticsFilterModule').addEventListener('change', updateAnalyticsWithFilters);
    document.getElementById('analyticsFilterSpeaker').addEventListener('change', updateAnalyticsWithFilters);
    document.getElementById('resetAnalyticsFilters').addEventListener('click', resetAnalyticsFilters);
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
        console.log('Loading data with config:', { useMockData: CONFIG.USE_MOCK_DATA, apiBaseUrl: CONFIG.API_BASE_URL });

        const [modules, events, feedback] = await Promise.all([
            fetchModules().catch(err => { console.error('fetchModules failed:', err); throw err; }),
            fetchEvents().catch(err => { console.error('fetchEvents failed:', err); throw err; }),
            fetchFeedback().catch(err => { console.error('fetchFeedback failed:', err); throw err; })
        ]);

        console.log('Data loaded successfully:', { modules: modules.length, events: events.length, feedback: feedback.length });

        allModules = modules;
        allEvents = events;
        allFeedback = feedback;

        renderModules(modules);
        renderEvents(events);
        populateEventFilter(events);
        populateModuleFilter(feedback);
        populateSpeakerFilter(feedback);
        populateAnalyticsFilters(events, feedback);
        renderFeedback(feedback);
        updateAnalyticsUI();
    } catch (error) {
        console.error('Error loading data:', error);
        console.error('Error details:', error.message, error.stack);
        showNotification('Error', `Failed to load data: ${error.message}. Please refresh the page.`, 'error');
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

    // Load content based on tab
    if (tabName === 'modules') {
        loadModules();
    }
}

// ====================================
// MODULES MANAGEMENT
// ====================================

// Load modules
async function loadModules() {
    try {
        const modules = await fetchModules();
        allModules = modules;
        renderModules(modules);
    } catch (error) {
        console.error('Error loading modules:', error);
    }
}

// Fetch modules from API
async function fetchModules() {
    if (CONFIG.USE_MOCK_DATA) {
        return mockFetchModules();
    }

    try {
        const response = await apiGet('/modules');
        console.log('fetchModules raw response:', response);
        console.log('fetchModules response type:', typeof response);
        console.log('fetchModules response.data type:', typeof response?.data);
        console.log('fetchModules is response array?', Array.isArray(response));
        console.log('fetchModules is response.data array?', Array.isArray(response?.data));

        // Handle different response formats
        if (Array.isArray(response)) {
            console.log('fetchModules: returning direct array, length:', response.length);
            return response;
        }
        if (response.data && Array.isArray(response.data)) {
            console.log('fetchModules: returning response.data array, length:', response.data.length);
            return response.data;
        }
        if (response.success && Array.isArray(response.data)) {
            console.log('fetchModules: returning response.data via success check, length:', response.data.length);
            return response.data;
        }

        console.error('Unexpected response format:', response);
        console.error('Response keys:', Object.keys(response || {}));
        return [];
    } catch (error) {
        console.error('fetchModules error:', error);
        throw error;
    }
}

// Mock fetch modules
function mockFetchModules() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockModules = [
                {
                    moduleId: 1,
                    moduleName: 'Introduction to Copilot Studio',
                    description: 'Getting started with Copilot Studio basics',
                    isActive: true,
                    eventCount: 2,
                    feedbackCount: 5
                },
                {
                    moduleId: 2,
                    moduleName: 'Building Your First Copilot',
                    description: 'Hands-on copilot development',
                    isActive: true,
                    eventCount: 1,
                    feedbackCount: 3
                },
                {
                    moduleId: 3,
                    moduleName: 'Advanced Copilot Techniques',
                    description: 'Advanced features and best practices',
                    isActive: true,
                    eventCount: 0,
                    feedbackCount: 0
                }
            ];
            resolve(mockModules);
        }, 500);
    });
}

// Render modules
function renderModules(modules) {
    const modulesList = document.getElementById('modulesList');

    if (modules.length === 0) {
        modulesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <p>No modules found. Create your first module to get started.</p>
            </div>
        `;
        return;
    }

    modulesList.innerHTML = modules.map(module => `
        <div class="event-card" data-module-id="${module.moduleId}">
            <div class="event-card-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" class="module-checkbox" data-module-id="${module.moduleId}" style="cursor: pointer; width: 18px; height: 18px;">
                    <div class="event-title">${escapeHtml(module.moduleName)}</div>
                </div>
                <div class="event-status">
                    <span class="status-badge ${module.isActive ? 'active' : 'inactive'}">
                        ${module.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            ${module.description ? `
                <div class="event-meta">
                    <p>${escapeHtml(module.description)}</p>
                </div>
            ` : ''}
            <div class="event-meta">
                <div class="event-meta-item">
                    <span>📅</span>
                    <span>${module.eventCount || 0} event${module.eventCount === 1 ? '' : 's'}</span>
                </div>
                <div class="event-meta-item">
                    <span>💬</span>
                    <span>${module.feedbackCount || 0} feedback</span>
                </div>
            </div>
            <div class="event-actions">
                <button class="btn btn-primary btn-icon btn-add-module-to-event" data-module-id="${module.moduleId}">
                    ➕ Add to Event
                </button>
                <button class="btn btn-secondary btn-icon btn-edit-module" data-module-id="${module.moduleId}">
                    ✏️ Edit
                </button>
                <button class="btn btn-secondary btn-icon btn-toggle-module-status" data-module-id="${module.moduleId}" data-is-active="${module.isActive}">
                    ${module.isActive ? '🚫 Deactivate' : '✅ Activate'}
                </button>
            </div>
        </div>
    `).join('');
}

// Filter modules
function filterModules() {
    const searchTerm = document.getElementById('moduleSearch').value.toLowerCase();
    const filteredModules = allModules.filter(module =>
        module.moduleName.toLowerCase().includes(searchTerm) ||
        (module.description && module.description.toLowerCase().includes(searchTerm))
    );
    renderModules(filteredModules);
}

// Open module modal
function openModuleModal(moduleId = null) {
    const modal = document.getElementById('moduleModal');
    const modalTitle = document.getElementById('moduleModalTitle');
    const form = document.getElementById('moduleForm');

    form.reset();

    if (moduleId) {
        const module = allModules.find(m => m.moduleId === moduleId);
        if (module) {
            modalTitle.textContent = 'Edit Module';
            document.getElementById('moduleId').value = module.moduleId;
            document.getElementById('moduleNameInput').value = module.moduleName;
            document.getElementById('moduleDescription').value = module.description || '';
            document.getElementById('moduleIsActive').checked = module.isActive;
        }
    } else {
        modalTitle.textContent = 'Create New Module';
        document.getElementById('moduleId').value = '';
        document.getElementById('moduleIsActive').checked = true;
    }

    modal.classList.remove('hidden');
}

// Close module modal
function closeModuleModal() {
    document.getElementById('moduleModal').classList.add('hidden');
}

// Handle save module
async function handleSaveModule(e) {
    e.preventDefault();

    const formData = {
        moduleId: document.getElementById('moduleId').value || null,
        moduleName: document.getElementById('moduleNameInput').value,
        description: document.getElementById('moduleDescription').value || null,
        isActive: document.getElementById('moduleIsActive').checked
    };

    try {
        const result = await saveModule(formData);
        if (result.success) {
            closeModuleModal();
            await loadModules();
            showNotification(
                'Success',
                formData.moduleId ? 'Module updated successfully!' : 'Module created successfully!',
                'success'
            );
        } else {
            showNotification('Error', 'Error saving module. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error saving module:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

// Save module
async function saveModule(data) {
    if (CONFIG.USE_MOCK_DATA) {
        return mockSaveModule(data);
    }

    try {
        if (data.moduleId) {
            const result = await apiPut(`/modules/${data.moduleId}`, data);
            return result;
        } else {
            const result = await apiPost('/modules', data);
            return result;
        }
    } catch (error) {
        throw error;
    }
}

// Mock save module
function mockSaveModule(data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (data.moduleId) {
                // Update existing
                const index = allModules.findIndex(m => m.moduleId == data.moduleId);
                if (index !== -1) {
                    allModules[index] = { ...allModules[index], ...data };
                }
            } else {
                // Create new
                const newModule = {
                    ...data,
                    moduleId: Date.now(),
                    eventCount: 0,
                    feedbackCount: 0
                };
                allModules.push(newModule);
            }
            resolve({ success: true });
        }, 500);
    });
}

// Edit module
window.editModule = function(moduleId) {
    openModuleModal(moduleId);
};

// Toggle module status
window.toggleModuleStatus = async function(moduleId) {
    const module = allModules.find(m => m.moduleId === moduleId);
    if (!module) return;

    const newStatus = !module.isActive;
    const action = newStatus ? 'activate' : 'deactivate';

    if (confirm(`Are you sure you want to ${action} this module?`)) {
        try {
            const result = await saveModule({
                ...module,
                isActive: newStatus
            });

            if (result.success) {
                await loadModules();
                showNotification('Success', `Module ${action}d successfully!`, 'success');
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            showNotification('Error', 'Error updating module status.', 'error');
        }
    }
};

// Add module to existing event (from modules tab)
window.addModuleToEvent = async function(moduleId) {
    const module = allModules.find(m => m.moduleId === moduleId);
    if (!module) {
        showNotification('Error', 'Module not found', 'error');
        return;
    }

    // Get active events
    const activeEvents = allEvents.filter(e => e.isActive);
    if (activeEvents.length === 0) {
        showNotification('Info', 'No active events available. Please create an event first.', 'info');
        return;
    }

    // Create a simple event selection modal
    const eventOptions = activeEvents.map(e =>
        `<option value="${e.eventId}">${e.eventName} (${e.eventCode}) - ${new Date(e.startDate).toLocaleDateString()}</option>`
    ).join('');

    const modalHtml = `
        <div id="quickAddModuleModal" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add "${module.moduleName}" to Event</h3>
                    <button class="modal-close" id="quickAddModalClose">&times;</button>
                </div>
                <form id="quickAddModuleForm">
                    <div class="form-group">
                        <label for="quickEventSelect">Select Event <span class="required">*</span></label>
                        <select id="quickEventSelect" required>
                            <option value="">-- Choose an event --</option>
                            ${eventOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quickSpeakerName">Speaker Name <span class="required">*</span></label>
                        <input type="text" id="quickSpeakerName" required placeholder="e.g., John Doe">
                    </div>
                    <div class="form-group">
                        <label for="quickDeliveryOrder">Delivery Order</label>
                        <input type="number" id="quickDeliveryOrder" value="1" min="1">
                        <small class="form-help">Order in which this module is delivered</small>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" id="quickAddModalCancel">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Module</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Helper function to close modal
    const closeModal = () => {
        const modal = document.getElementById('quickAddModuleModal');
        if (modal) {
            modal.remove();
        }
    };

    // Handle close button (X)
    document.getElementById('quickAddModalClose').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });

    // Handle cancel button
    document.getElementById('quickAddModalCancel').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });

    // Handle clicking outside the modal (on backdrop)
    document.getElementById('quickAddModuleModal').addEventListener('click', (e) => {
        if (e.target.id === 'quickAddModuleModal') {
            closeModal();
        }
    });

    // Handle form submission
    document.getElementById('quickAddModuleForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const eventId = document.getElementById('quickEventSelect').value;
        const speakerName = document.getElementById('quickSpeakerName').value;
        const deliveryOrder = document.getElementById('quickDeliveryOrder').value;

        try {
            const result = await apiPost('/event-modules', {
                eventId: parseInt(eventId),
                moduleId: moduleId,
                speakerName: speakerName,
                deliveryOrder: parseInt(deliveryOrder) || 1,
                deliveryDate: null,
                notes: null
            });

            if (result.success) {
                closeModal();
                showNotification('Success', `Module added to event successfully!`, 'success');
                await loadModules(); // Refresh to update event count
                await loadEvents(); // Refresh events list
            } else {
                showNotification('Error', 'Error adding module to event', 'error');
            }
        } catch (error) {
            console.error('Error adding module to event:', error);
            const friendlyError = getUserFriendlyErrorMessage(error);
            showNotification('Error', friendlyError.message, 'error');
        }
    });
};

// ====================================
// EVENT MANAGEMENT
// ====================================

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
        // This endpoint should return events joined with module details
        const response = await apiGet('/events');
        console.log('fetchEvents raw response:', response);
        console.log('fetchEvents is response.data array?', Array.isArray(response?.data));

        // Handle different response formats
        if (Array.isArray(response)) {
            console.log('fetchEvents: returning direct array, length:', response.length);
            return response;
        }
        if (response.data && Array.isArray(response.data)) {
            console.log('fetchEvents: returning response.data array, length:', response.data.length);
            return response.data;
        }
        if (response.success && Array.isArray(response.data)) {
            console.log('fetchEvents: returning response.data via success check, length:', response.data.length);
            return response.data;
        }

        console.error('Unexpected events response format:', response);
        console.error('Response keys:', Object.keys(response || {}));
        return [];
    } catch (error) {
        console.error('fetchEvents error:', error);
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
                    startDate: '2026-02-15T09:00:00',
                    endDate: '2026-02-15T17:00:00',
                    cohortId: 'Q1-2026',
                    isActive: true,
                    createdAt: '2026-02-01T10:00:00Z',
                    feedbackCount: 5,
                    modules: [
                        { moduleName: 'Introduction to Copilot Studio', speakerName: 'John Doe', deliveryOrder: 1 }
                    ]
                },
                {
                    eventId: 2,
                    eventCode: 'CSXYZ789',
                    startDate: '2026-02-16T09:00:00',
                    endDate: '2026-02-16T17:00:00',
                    cohortId: 'Q1-2026',
                    isActive: true,
                    createdAt: '2026-02-01T11:00:00Z',
                    feedbackCount: 3,
                    modules: [
                        { moduleName: 'Building Your First Copilot', speakerName: 'Jane Smith', deliveryOrder: 1 }
                    ]
                },
                {
                    eventId: 3,
                    eventCode: 'CSABC456',
                    startDate: '2026-02-17T09:00:00',
                    endDate: '2026-02-17T17:00:00',
                    cohortId: 'Q1-2026',
                    isActive: true,
                    createdAt: '2026-02-01T12:00:00Z',
                    feedbackCount: 0,
                    modules: [
                        { moduleName: 'Intro to Copilot', speakerName: 'Alice Brown', deliveryOrder: 1 },
                        { moduleName: 'Advanced Techniques', speakerName: 'Bob Green', deliveryOrder: 2 }
                    ]
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
        const startDate = event.startDate || event.moduleDate; // Fallback for backwards compatibility
        const displayDate = startDate ? formatDate(startDate) : 'No date';

        // Generate modules summary
        const modules = event.modules || [];
        const modulesDisplay = modules.length > 0
            ? modules.map(m => `${escapeHtml(m.moduleName)} (${escapeHtml(m.speakerName)})`).join(', ')
            : 'No modules assigned';

        return `
        <div class="event-card" data-event-id="${event.eventId}">
            <div class="event-card-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" class="event-checkbox" data-event-id="${event.eventId}" style="cursor: pointer; width: 18px; height: 18px;">
                    <div>
                        <div class="event-title">Event: ${escapeHtml(event.eventCode)}</div>
                        <span class="event-code" style="font-size: 0.85em; color: #333; font-weight: 500; background: #e3e8ff; padding: 2px 8px; border-radius: 12px;">${modules.length} module${modules.length !== 1 ? 's' : ''}</span>
                    </div>
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
                    <span>${displayDate}</span>
                </div>
                ${event.cohortId ? `
                <div class="event-meta-item">
                    <span>🎓</span>
                    <span>${escapeHtml(event.cohortId)}</span>
                </div>
                ` : ''}
                <div class="event-meta-item">
                    <span>💬</span>
                    <span>${event.feedbackCount || 0} feedback</span>
                </div>
            </div>
            ${modules.length > 0 ? `
            <div class="event-meta" style="font-size: 0.9em; color: #555; border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px;">
                <strong>Modules:</strong> ${modulesDisplay}
            </div>
            ` : ''}
            <div class="event-actions">
                <button class="btn btn-primary btn-icon btn-view-details" data-event-id="${event.eventId}">
                    📋 View Details & QR
                </button>
                <button class="btn btn-secondary btn-icon btn-edit-event" data-event-id="${event.eventId}">
                    ✏️ Edit
                </button>
                <button class="btn btn-secondary btn-icon btn-toggle-status" data-event-id="${event.eventId}" data-is-active="${event.isActive}">
                    ${event.isActive ? '🚫 Deactivate' : '✅ Activate'}
                </button>
            </div>
        </div>
    `;
    }).join('');
}

// Filter events
function filterEvents() {
    const searchTerm = document.getElementById('eventSearch').value.toLowerCase();
    const filteredEvents = allEvents.filter(event => {
        // Search in event code
        if (event.eventCode.toLowerCase().includes(searchTerm)) return true;

        // Search in cohort ID
        if (event.cohortId && event.cohortId.toLowerCase().includes(searchTerm)) return true;

        // Search in modules
        if (event.modules && event.modules.some(m =>
            m.moduleName.toLowerCase().includes(searchTerm) ||
            m.speakerName.toLowerCase().includes(searchTerm)
        )) return true;

        return false;
    });
    renderEvents(filteredEvents);
}

// View event details with QR code
async function viewEventDetails(eventId) {
    const event = allEvents.find(e => e.eventId === eventId);
    if (!event) {
        showNotification('Error', 'Event not found', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'eventDetailsModal';
    modal.dataset.eventId = eventId;

    const modules = event.modules || [];
    // DEFENSIVE: Filter out modules that are inactive or missing required fields
    // This ensures we NEVER display QR codes for modules that won't work
    const validModules = modules.filter(m =>
        m.eventModuleId &&
        m.moduleName &&
        m.isActive === true
    );
    // Sort modules by delivery order
    const sortedModules = [...validModules].sort((a, b) => (a.deliveryOrder || 0) - (b.deliveryOrder || 0));

    const modulesHTML = sortedModules.length > 0
        ? sortedModules.map((m, index) => {
            const moduleUrl = `${window.location.origin}/feedback.html?code=${event.eventCode}&module=${m.eventModuleId}`;
            return `
            <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e3e8ff;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <strong style="font-size: 1.1em;">${escapeHtml(m.moduleName)}</strong><br>
                        <span style="color: #666;">Speaker: ${escapeHtml(m.speakerName)}</span><br>
                        <span style="color: #666; font-size: 0.9em;">Delivery: ${formatDate(m.deliveryDate)}</span>
                        <span style="color: #999; font-size: 0.85em; margin-left: 10px;">Order: ${m.deliveryOrder || index + 1}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <button class="btn btn-icon btn-reorder-up"
                                data-event-module-id="${m.eventModuleId}"
                                data-current-order="${m.deliveryOrder || index + 1}"
                                ${index === 0 ? 'disabled' : ''}
                                style="padding: 2px 8px; font-size: 0.8em; min-width: 32px;">
                            ▲
                        </button>
                        <button class="btn btn-icon btn-reorder-down"
                                data-event-module-id="${m.eventModuleId}"
                                data-current-order="${m.deliveryOrder || index + 1}"
                                ${index === sortedModules.length - 1 ? 'disabled' : ''}
                                style="padding: 2px 8px; font-size: 0.8em; min-width: 32px;">
                            ▼
                        </button>
                    </div>
                </div>
                <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #e3e8ff;">
                    <div style="text-align: center; margin-bottom: 8px;">
                        <div id="qrCodeModule_${m.eventModuleId}"></div>
                    </div>
                    <div style="font-family: monospace; font-size: 0.75em; word-break: break-all; background: #f8f9fa; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                        ${moduleUrl}
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-primary btn-download-module-qr"
                                data-event-code="${event.eventCode}"
                                data-module-id="${m.eventModuleId}"
                                data-module-name="${escapeHtml(m.moduleName)}"
                                style="font-size: 0.85em; padding: 6px 12px;">
                            📥 Download
                        </button>
                        <button class="btn btn-sm btn-secondary btn-copy-module-url"
                                data-feedback-url="${escapeHtml(moduleUrl)}"
                                style="font-size: 0.85em; padding: 6px 12px;">
                            📋 Copy URL
                        </button>
                        <button class="btn btn-sm btn-success btn-open-live-counter"
                                data-event-code="${event.eventCode}"
                                data-module-id="${m.eventModuleId}"
                                style="font-size: 0.85em; padding: 6px 12px;">
                            📊 Live Counter
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('')
        : '<p style="color: #666;">No modules assigned to this event yet.</p>';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>Event Details: ${escapeHtml(event.eventCode)}</h2>
                <button class="modal-close" id="closeEventDetailsBtn">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <strong>Status:</strong>
                        <span class="status-badge ${event.isActive ? 'active' : 'inactive'}">
                            ${event.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Start Date:</strong> ${formatDate(event.startDate)}
                    </div>
                    ${event.endDate ? `
                    <div style="margin-bottom: 8px;">
                        <strong>End Date:</strong> ${formatDate(event.endDate)}
                    </div>
                    ` : ''}
                    ${event.cohortId ? `
                    <div style="margin-bottom: 8px;">
                        <strong>Cohort:</strong> ${escapeHtml(event.cohortId)}
                    </div>
                    ` : ''}
                    <div style="margin-bottom: 8px;">
                        <strong>Feedback Count:</strong> ${event.feedbackCount || 0}
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="margin-bottom: 12px; color: #333;">Module Feedback QR Codes (${modules.length})</h3>
                    <p style="color: #666; margin-bottom: 12px; font-size: 0.9em;">
                        Each module has its own QR code. Participants scan the specific module's QR code to provide targeted feedback.
                    </p>
                    ${modulesHTML}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Add event listeners for modal buttons
    document.getElementById('closeEventDetailsBtn').addEventListener('click', closeEventDetailsModal);

    // Add event listeners for module QR download and copy buttons
    document.querySelectorAll('.btn-download-module-qr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const eventCode = e.target.dataset.eventCode;
            const moduleId = e.target.dataset.moduleId;
            const moduleName = e.target.dataset.moduleName;
            downloadModuleQRCode(eventCode, moduleId, moduleName);
        });
    });

    document.querySelectorAll('.btn-copy-module-url').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.target.dataset.feedbackUrl;
            copyFeedbackUrl(url);
        });
    });

    // Open live counter for module
    document.querySelectorAll('.btn-open-live-counter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const eventCode = e.target.dataset.eventCode;
            const moduleId = e.target.dataset.moduleId;
            const counterUrl = `${window.location.origin}/count.html?code=${eventCode}&module=${moduleId}`;
            window.open(counterUrl, '_blank');
        });
    });

    // Generate QR codes for each module
    setTimeout(() => {
        sortedModules.forEach(m => {
            const container = document.getElementById(`qrCodeModule_${m.eventModuleId}`);
            if (container) {
                const canvas = document.createElement('canvas');
                container.appendChild(canvas);

                const moduleUrl = `${window.location.origin}/feedback.html?code=${event.eventCode}&module=${m.eventModuleId}`;

                if (typeof window.QRCode !== 'undefined') {
                    window.QRCode.toCanvas(
                        canvas,
                        moduleUrl,
                        {
                            width: 200,
                            margin: 2,
                            color: {
                                dark: CONFIG.QR_CODE_COLOR_DARK || '#667eea',
                                light: CONFIG.QR_CODE_COLOR_LIGHT || '#ffffff'
                            },
                            errorCorrectionLevel: CONFIG.QR_CODE_ERROR_CORRECTION || 'M'
                        },
                        (error) => {
                            if (error) {
                                console.error(`QR Code generation error for module ${m.eventModuleId}:`, error);
                                container.innerHTML = '<p style="color: #dc3545; font-size: 0.85em;">QR code failed</p>';
                            }
                        }
                    );
                } else {
                    console.error('QRCode library not loaded');
                    container.innerHTML = '<p style="color: #dc3545; font-size: 0.85em;">QR library not loaded</p>';
                }
            }
        });
    }, 100);
}

// Close event details modal
function closeEventDetailsModal() {
    const modal = document.getElementById('eventDetailsModal');
    if (modal) {
        modal.remove();
    }
}

// Download QR code as image (legacy - for event-level QR codes)
function downloadQRCode(eventCode) {
    const canvas = document.querySelector('#qrCodeContainer canvas');
    if (!canvas) {
        showNotification('Error', 'QR code not found', 'error');
        return;
    }

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${eventCode}-feedback-qr-code.png`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification('Success', 'QR code downloaded successfully', 'success');
    });
}

// Download module-specific QR code as image
function downloadModuleQRCode(eventCode, moduleId, moduleName) {
    const canvas = document.querySelector(`#qrCodeModule_${moduleId} canvas`);
    if (!canvas) {
        showNotification('Error', 'QR code not found for this module', 'error');
        return;
    }

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // Sanitize module name for filename
        const safeModuleName = moduleName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        link.download = `${eventCode}-${safeModuleName}-qr-code.png`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification('Success', `QR code for "${moduleName}" downloaded successfully`, 'success');
    });
}

// Copy feedback URL to clipboard
async function copyFeedbackUrl(url) {
    try {
        await navigator.clipboard.writeText(url);
        showNotification('Success', 'Feedback URL copied to clipboard', 'success');
    } catch (error) {
        console.error('Failed to copy URL:', error);
        showNotification('Error', 'Failed to copy URL', 'error');
    }
}

// Edit event - reuse existing modal
function editEvent(eventId) {
    openEventModal(eventId);
}

// Toggle event active status
async function toggleEventStatus(eventId) {
    const event = allEvents.find(e => e.eventId === eventId);
    if (!event) {
        showNotification('Error', 'Event not found', 'error');
        return;
    }

    const action = event.isActive ? 'deactivate' : 'activate';
    const confirmMessage = event.isActive
        ? 'Are you sure you want to deactivate this event? Participants will no longer be able to submit feedback using this event code.'
        : 'Are you sure you want to activate this event? Participants will be able to submit feedback using this event code.';

    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const response = await apiPut(`/events/${eventId}/status`, {
            isActive: !event.isActive
        });

        showNotification('Success', `Event ${action}d successfully`, 'success');

        // Update local data
        event.isActive = !event.isActive;
        renderEvents(allEvents);

    } catch (error) {
        console.error(`Error ${action}ing event:`, error);
        showNotification('Error', `Failed to ${action} event: ${error.message}`, 'error');
    }
}

// Reorder module within an event
async function reorderModule(eventModuleId, newOrder) {
    try {
        console.log(`Reordering module ${eventModuleId} to order ${newOrder}`);

        if (!eventModuleId || eventModuleId < 1) {
            console.error('Invalid eventModuleId:', eventModuleId);
            showNotification('Error', 'Invalid module ID', 'error');
            return;
        }

        if (!newOrder || newOrder < 1) {
            console.error('Invalid newOrder: cannot be less than 1', newOrder);
            showNotification('Error', 'Invalid order position', 'error');
            return;
        }

        const response = await apiPut(`/event-modules/${eventModuleId}/order`, {
            newOrder: newOrder
        });

        console.log('Reorder response:', response);

        // Check if we're in the event details modal (View Details & QR)
        const detailsModal = document.getElementById('eventDetailsModal');
        if (detailsModal && detailsModal.style.display !== 'none') {
            const eventId = parseInt(detailsModal.dataset.eventId);
            closeEventDetailsModal();
            // Reload events to get fresh data
            await loadEvents();
            // Reopen the modal with updated data
            setTimeout(() => {
                viewEventDetails(eventId);
                showNotification('Success', 'Module order updated successfully', 'success');
            }, 100);
            return;
        }

        // Check if we're in the event edit modal
        const editModal = document.getElementById('eventModal');
        const eventIdField = document.getElementById('eventId');
        if (editModal && !editModal.classList.contains('hidden') && eventIdField && eventIdField.value) {
            const eventId = parseInt(eventIdField.value);
            console.log('Refreshing event modules for event:', eventId);
            // Reload the modules list in the edit modal
            await loadEventModules(eventId);
            // Show success notification after refresh
            showNotification('Success', 'Module order updated successfully', 'success');
        }

    } catch (error) {
        console.error('Error reordering module:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Unknown error occurred';
        showNotification('Error', `Failed to reorder module: ${errorMsg}`, 'error');
    }
}

// Open event modal
async function openEventModal(eventId = null, preSelectedModuleId = null) {
    const modal = document.getElementById('eventModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('eventForm');
    const modulesSection = document.getElementById('eventModulesSection');

    form.reset();

    if (eventId) {
        const event = allEvents.find(e => e.eventId === eventId);
        if (event) {
            modalTitle.textContent = 'Edit Event';
            document.getElementById('eventId').value = event.eventId;
            document.getElementById('eventName').value = event.eventName || '';
            document.getElementById('eventCode').value = event.eventCode;
            document.getElementById('startDate').value = formatDateForInput(event.startDate);
            document.getElementById('endDate').value = event.endDate ? formatDateForInput(event.endDate) : '';
            document.getElementById('cohortId').value = event.cohortId || '';
            document.getElementById('eventIsActive').checked = event.isActive;

            // Show modules section and load modules for this event
            modulesSection.style.display = 'block';
            await loadEventModules(eventId);
        }
    } else {
        modalTitle.textContent = 'Create New Event';
        document.getElementById('eventId').value = '';

        // Hide modules section for new events
        modulesSection.style.display = 'none';

        // Set default start date to today
        const now = new Date();
        const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        document.getElementById('startDate').value = localDate;
        document.getElementById('eventIsActive').checked = true;
    }

    modal.classList.remove('hidden');
}

// Populate module select dropdown for add module modal
async function populateModuleSelectForEvent() {
    if (allModules.length === 0) {
        await loadModules();
    }

    const moduleSelect = document.getElementById('moduleSelectForEvent');
    const activeModules = allModules.filter(m => m.isActive);

    moduleSelect.innerHTML = '<option value="">-- Select a Module --</option>' +
        activeModules.map(m =>
            `<option value="${m.moduleId}">${escapeHtml(m.moduleName)}</option>`
        ).join('');
}

// Format datetime for input (datetime-local)
function formatDateTimeForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Format date for input (date type, YYYY-MM-DD)
function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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
        eventName: document.getElementById('eventName').value,
        eventCode: document.getElementById('eventCode').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value || null,
        cohortId: document.getElementById('cohortId').value || null,
        isActive: document.getElementById('eventIsActive').checked
    };

    try {
        const result = await saveEvent(formData);
        if (result.success) {
            const isNew = !formData.eventId;
            if (isNew) {
                // For new events, show message and allow adding modules
                showNotification(
                    'Success',
                    'Event created! Now add modules to this event.',
                    'success'
                );
                // Reload events and reopen the modal in edit mode
                await loadEvents();
                const createdEventId = result.data?.eventId || result.eventId;
                if (createdEventId) {
                    await openEventModal(createdEventId);
                } else {
                    closeEventModal();
                }
            } else {
                closeEventModal();
                await loadEvents();
                showNotification('Success', 'Event updated successfully!', 'success');
            }
            await loadModules(); // Refresh modules to update event counts
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
            const result = await apiPut(`/events/${data.eventId}`, data);
            return result;
        } else {
            const result = await apiPost('/events', data);
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
                    allEvents[index] = {
                        ...allEvents[index],
                        ...data
                    };
                }
                resolve({ success: true, data: { eventId: data.eventId } });
            } else {
                // Create new - use admin-provided event code
                const newEventId = Date.now();
                const newEvent = {
                    ...data,
                    eventId: newEventId,
                    createdAt: new Date().toISOString(),
                    feedbackCount: 0,
                    modules: []
                };
                allEvents.push(newEvent);
                resolve({ success: true, data: { eventId: newEventId } });
            }
        }, 500);
    });
}

// Load event modules
let currentEventModules = [];
async function loadEventModules(eventId) {
    try {
        const response = await apiGet(`/events/${eventId}/modules`);
        currentEventModules = response.data || response || [];
        renderEventModules();
    } catch (error) {
        console.error('Error loading event modules:', error);
        currentEventModules = [];
        renderEventModules();
    }
}

// Render event modules list
function renderEventModules() {
    const container = document.getElementById('eventModulesList');

    if (currentEventModules.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No modules added yet. Click "Add Module" to get started.</p>';
        return;
    }

    const sortedModules = currentEventModules.sort((a, b) => a.deliveryOrder - b.deliveryOrder);

    container.innerHTML = sortedModules
        .map((em, index) => `
            <div class="event-module-item" style="border: 1px solid #ddd; padding: 12px; margin-bottom: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div style="flex: 1;">
                    <strong>${em.deliveryOrder}. ${escapeHtml(em.moduleName)}</strong><br>
                    <span style="color: #666;">👤 Speaker: ${escapeHtml(em.speakerName)}</span>
                    ${em.deliveryDate ? `<br><span style="color: #666;">📅 ${new Date(em.deliveryDate).toLocaleString()}</span>` : ''}
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <button type="button"
                                class="btn btn-icon btn-reorder-up"
                                data-event-module-id="${em.eventModuleId}"
                                data-current-order="${em.deliveryOrder}"
                                ${index === 0 ? 'disabled' : ''}
                                style="padding: 4px 10px; font-size: 0.85em; min-width: 36px; background: #6c63ff; color: white; border: none; border-radius: 4px; cursor: ${index === 0 ? 'not-allowed' : 'pointer'}; opacity: ${index === 0 ? '0.5' : '1'};"
                                title="Move up">
                            ▲
                        </button>
                        <button type="button"
                                class="btn btn-icon btn-reorder-down"
                                data-event-module-id="${em.eventModuleId}"
                                data-current-order="${em.deliveryOrder}"
                                ${index === sortedModules.length - 1 ? 'disabled' : ''}
                                style="padding: 4px 10px; font-size: 0.85em; min-width: 36px; background: #6c63ff; color: white; border: none; border-radius: 4px; cursor: ${index === sortedModules.length - 1 ? 'not-allowed' : 'pointer'}; opacity: ${index === sortedModules.length - 1 ? '0.5' : '1'};"
                                title="Move down">
                            ▼
                        </button>
                    </div>
                    <button type="button"
                            class="btn btn-secondary btn-sm btn-remove-event-module"
                            data-event-module-id="${em.eventModuleId}"
                            style="padding: 8px 16px;">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
}

// Open add module modal
let currentEventIdForModule = null;
window.openAddModuleModal = async function() {
    const eventId = document.getElementById('eventId').value;
    if (!eventId) return;

    currentEventIdForModule = eventId;

    const modal = document.getElementById('addModuleModal');
    const form = document.getElementById('addModuleForm');
    form.reset();

    // Populate module dropdown
    await populateModuleSelectForEvent();

    // Set default delivery order to next available
    document.getElementById('deliveryOrder').value = currentEventModules.length + 1;

    modal.classList.remove('hidden');
};

// Close add module modal
function closeAddModuleModal() {
    document.getElementById('addModuleModal').classList.add('hidden');
}

// Handle add module to event
async function handleAddModule(e) {
    e.preventDefault();

    const moduleId = document.getElementById('moduleSelectForEvent').value;
    const speakerName = document.getElementById('speakerNameForModule').value;
    const deliveryOrder = document.getElementById('deliveryOrder').value;
    const deliveryDate = document.getElementById('deliveryDate').value;
    const notes = document.getElementById('moduleNotes').value;

    if (!moduleId || !speakerName) {
        showNotification('Error', 'Please select a module and enter speaker name', 'error');
        return;
    }

    try {
        const result = await apiPost('/event-modules', {
            eventId: parseInt(currentEventIdForModule),
            moduleId: parseInt(moduleId),
            speakerName: speakerName,
            deliveryOrder: parseInt(deliveryOrder) || 1,
            deliveryDate: deliveryDate || null,
            notes: notes || null
        });

        if (result.success) {
            closeAddModuleModal();
            await loadEventModules(currentEventIdForModule);
            showNotification('Success', 'Module added to event successfully!', 'success');
        } else {
            showNotification('Error', result.message || 'Error adding module', 'error');
        }
    } catch (error) {
        console.error('Error adding module to event:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

// Remove module from event
window.removeEventModule = async function(eventModuleId) {
    if (!confirm('Are you sure you want to remove this module from the event?')) {
        return;
    }

    try {
        const result = await apiDelete(`/event-modules/${eventModuleId}`);
        if (result.success) {
            const eventId = document.getElementById('eventId').value;
            await loadEventModules(eventId);
            showNotification('Success', 'Module removed from event', 'success');
        } else {
            showNotification('Error', 'Error removing module', 'error');
        }
    } catch (error) {
        console.error('Error removing module:', error);
        showNotification('Error', 'Error removing module', 'error');
    }
};

// Export viewEventDetails to window (already defined above as async function, reusing it)
window.viewEventDetails = viewEventDetails;

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
        populateModuleFilter(feedback);
        populateSpeakerFilter(feedback);
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
        const response = await apiGet('/feedback');
        console.log('fetchFeedback raw response:', response);
        console.log('fetchFeedback is response.data array?', Array.isArray(response?.data));

        // Handle different response formats
        if (Array.isArray(response)) {
            console.log('fetchFeedback: returning direct array, length:', response.length);
            return response;
        }
        if (response.data && Array.isArray(response.data)) {
            console.log('fetchFeedback: returning response.data array, length:', response.data.length);
            return response.data;
        }
        if (response.success && Array.isArray(response.data)) {
            console.log('fetchFeedback: returning response.data via success check, length:', response.data.length);
            return response.data;
        }

        console.error('Unexpected feedback response format:', response);
        console.error('Response keys:', Object.keys(response || {}));
        return [];
    } catch (error) {
        console.error('fetchFeedback error:', error);
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
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" class="feedback-checkbox" data-feedback-id="${fb.feedbackId}" style="cursor: pointer; width: 18px; height: 18px;">
                    <div>
                        <div class="feedback-event">${escapeHtml(fb.moduleName || 'Unknown Module')}</div>
                        <div style="font-size: 0.85rem; color: #666; margin-top: 2px;">
                            Speaker: ${escapeHtml(fb.speakerName || 'Unknown')} • Event: ${escapeHtml(fb.eventCode || 'N/A')}
                        </div>
                    </div>
                </div>
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

// Filter and sort feedback
function filterAndSortFeedback() {
    const eventFilter = document.getElementById('filterEvent').value;
    const moduleFilter = document.getElementById('filterModule').value;
    const speakerFilter = document.getElementById('filterSpeaker').value;
    const ratingFilter = document.getElementById('filterRating').value;
    const sortOption = document.getElementById('sortFeedback').value;

    let filtered = allFeedback;

    // Apply filters
    if (eventFilter) {
        filtered = filtered.filter(fb => fb.eventCode === eventFilter);
    }

    if (moduleFilter) {
        filtered = filtered.filter(fb => fb.moduleName === moduleFilter);
    }

    if (speakerFilter) {
        filtered = filtered.filter(fb => fb.speakerName === speakerFilter);
    }

    if (ratingFilter) {
        filtered = filtered.filter(fb => fb.moduleSatisfaction == ratingFilter);
    }

    // Apply sorting
    const sorted = sortFeedback(filtered, sortOption);

    renderFeedback(sorted);
}

// Sort feedback based on selected option
function sortFeedback(feedback, sortOption) {
    const sorted = [...feedback]; // Create a copy to avoid mutating original

    switch(sortOption) {
        case 'date-desc':
            return sorted.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        case 'date-asc':
            return sorted.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
        case 'rating-desc':
            return sorted.sort((a, b) => b.moduleSatisfaction - a.moduleSatisfaction);
        case 'rating-asc':
            return sorted.sort((a, b) => a.moduleSatisfaction - b.moduleSatisfaction);
        case 'module-asc':
            return sorted.sort((a, b) => (a.moduleName || '').localeCompare(b.moduleName || ''));
        case 'module-desc':
            return sorted.sort((a, b) => (b.moduleName || '').localeCompare(a.moduleName || ''));
        case 'speaker-asc':
            return sorted.sort((a, b) => (a.speakerName || '').localeCompare(b.speakerName || ''));
        case 'speaker-desc':
            return sorted.sort((a, b) => (b.speakerName || '').localeCompare(a.speakerName || ''));
        case 'event-asc':
            return sorted.sort((a, b) => (a.eventCode || '').localeCompare(b.eventCode || ''));
        case 'event-desc':
            return sorted.sort((a, b) => (b.eventCode || '').localeCompare(a.eventCode || ''));
        default:
            return sorted;
    }
}

// Populate event filter
function populateEventFilter(events) {
    const filterEvent = document.getElementById('filterEvent');
    const uniqueEvents = [...new Set(events.map(e => JSON.stringify({ code: e.eventCode, name: e.eventName })))].map(e => JSON.parse(e));
    filterEvent.innerHTML = '<option value="">All Events</option>' +
        uniqueEvents.map(e => `<option value="${escapeHtml(e.code)}">${escapeHtml(e.name)} (${escapeHtml(e.code)})</option>`).join('');
}

// Populate module filter
function populateModuleFilter(feedback) {
    const filterModule = document.getElementById('filterModule');
    const uniqueModules = [...new Set(feedback.map(fb => fb.moduleName))].filter(Boolean).sort();
    filterModule.innerHTML = '<option value="">All Modules</option>' +
        uniqueModules.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
}

// Populate speaker filter
function populateSpeakerFilter(feedback) {
    const filterSpeaker = document.getElementById('filterSpeaker');
    const uniqueSpeakers = [...new Set(feedback.map(fb => fb.speakerName))].filter(Boolean).sort();
    filterSpeaker.innerHTML = '<option value="">All Speakers</option>' +
        uniqueSpeakers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

// Update analytics UI (optimized - doesn't reload data)
function updateAnalyticsUI(feedbackData = null, eventsData = null) {
    // Use filtered data if provided, otherwise use all data
    const feedback = feedbackData !== null ? feedbackData : allFeedback;
    const events = eventsData !== null ? eventsData : allEvents;

    const totalEvents = events.length;
    const totalFeedback = feedback.length;
    const avgSatisfaction = feedback.length > 0
        ? (feedback.reduce((sum, fb) => sum + fb.moduleSatisfaction, 0) / feedback.length).toFixed(1)
        : 0;
    const avgSpeakerKnowledge = feedback.length > 0
        ? (feedback.reduce((sum, fb) => sum + fb.speakerKnowledge, 0) / feedback.length).toFixed(1)
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

    feedback.forEach(fb => {
        if (depthCounts.hasOwnProperty(fb.contentDepth)) {
            depthCounts[fb.contentDepth]++;
        }
    });

    const total = feedback.length || 1;
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

// Populate analytics filters
function populateAnalyticsFilters(events, feedback) {
    // Populate event filter
    const analyticsFilterEvent = document.getElementById('analyticsFilterEvent');
    const uniqueEvents = [...new Set(events.map(e => JSON.stringify({ code: e.eventCode, name: e.eventName })))].map(e => JSON.parse(e));
    analyticsFilterEvent.innerHTML = '<option value="">All Events</option>' +
        uniqueEvents.map(e => `<option value="${escapeHtml(e.code)}">${escapeHtml(e.name)} (${escapeHtml(e.code)})</option>`).join('');

    // Populate module filter
    const analyticsFilterModule = document.getElementById('analyticsFilterModule');
    const uniqueModules = [...new Set(feedback.map(fb => fb.moduleName))].filter(Boolean).sort();
    analyticsFilterModule.innerHTML = '<option value="">All Modules</option>' +
        uniqueModules.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');

    // Populate speaker filter
    const analyticsFilterSpeaker = document.getElementById('analyticsFilterSpeaker');
    const uniqueSpeakers = [...new Set(feedback.map(fb => fb.speakerName))].filter(Boolean).sort();
    analyticsFilterSpeaker.innerHTML = '<option value="">All Speakers</option>' +
        uniqueSpeakers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

// Update analytics with filters applied
function updateAnalyticsWithFilters() {
    const eventFilter = document.getElementById('analyticsFilterEvent').value;
    const moduleFilter = document.getElementById('analyticsFilterModule').value;
    const speakerFilter = document.getElementById('analyticsFilterSpeaker').value;

    let filteredFeedback = allFeedback;
    let filteredEvents = allEvents;

    // Apply feedback filters
    if (eventFilter) {
        filteredFeedback = filteredFeedback.filter(fb => fb.eventCode === eventFilter);
        filteredEvents = filteredEvents.filter(e => e.eventCode === eventFilter);
    }

    if (moduleFilter) {
        filteredFeedback = filteredFeedback.filter(fb => fb.moduleName === moduleFilter);
    }

    if (speakerFilter) {
        filteredFeedback = filteredFeedback.filter(fb => fb.speakerName === speakerFilter);
    }

    // Update analytics with filtered data
    updateAnalyticsUI(filteredFeedback, filteredEvents);
}

// Reset analytics filters
function resetAnalyticsFilters() {
    document.getElementById('analyticsFilterEvent').value = '';
    document.getElementById('analyticsFilterModule').value = '';
    document.getElementById('analyticsFilterSpeaker').value = '';
    updateAnalyticsUI();
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

// ============================================
// BULK DELETE FUNCTIONALITY
// ============================================

// Track selected items
let selectedModules = new Set();
let selectedEvents = new Set();
let selectedFeedback = new Set();

// Initialize bulk delete listeners
function initBulkDeleteListeners() {
    // Module checkboxes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('module-checkbox')) {
            const moduleId = parseInt(e.target.dataset.moduleId);
            if (e.target.checked) {
                selectedModules.add(moduleId);
            } else {
                selectedModules.delete(moduleId);
            }
            updateDeleteButtonVisibility('modules');
        }
    });

    // Event checkboxes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('event-checkbox')) {
            const eventId = parseInt(e.target.dataset.eventId);
            if (e.target.checked) {
                selectedEvents.add(eventId);
            } else {
                selectedEvents.delete(eventId);
            }
            updateDeleteButtonVisibility('events');
        }
    });

    // Feedback checkboxes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('feedback-checkbox')) {
            const feedbackId = parseInt(e.target.dataset.feedbackId);
            if (e.target.checked) {
                selectedFeedback.add(feedbackId);
            } else {
                selectedFeedback.delete(feedbackId);
            }
            updateDeleteButtonVisibility('feedback');
        }
    });

    // Select All checkboxes
    document.getElementById('selectAllModules').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.module-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const moduleId = parseInt(cb.dataset.moduleId);
            if (e.target.checked) {
                selectedModules.add(moduleId);
            } else {
                selectedModules.delete(moduleId);
            }
        });
        updateDeleteButtonVisibility('modules');
    });

    document.getElementById('selectAllEvents').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.event-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const eventId = parseInt(cb.dataset.eventId);
            if (e.target.checked) {
                selectedEvents.add(eventId);
            } else {
                selectedEvents.delete(eventId);
            }
        });
        updateDeleteButtonVisibility('events');
    });

    document.getElementById('selectAllFeedback').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.feedback-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const feedbackId = parseInt(cb.dataset.feedbackId);
            if (e.target.checked) {
                selectedFeedback.add(feedbackId);
            } else {
                selectedFeedback.delete(feedbackId);
            }
        });
        updateDeleteButtonVisibility('feedback');
    });

    // Delete buttons
    document.getElementById('deleteModulesBtn').addEventListener('click', () => confirmBulkDelete('modules'));
    document.getElementById('deleteEventsBtn').addEventListener('click', () => confirmBulkDelete('events'));
    document.getElementById('deleteFeedbackBtn').addEventListener('click', () => confirmBulkDelete('feedback'));
}

// Update delete button visibility
function updateDeleteButtonVisibility(type) {
    const counts = {
        'modules': selectedModules.size,
        'events': selectedEvents.size,
        'feedback': selectedFeedback.size
    };

    const buttons = {
        'modules': document.getElementById('deleteModulesBtn'),
        'events': document.getElementById('deleteEventsBtn'),
        'feedback': document.getElementById('deleteFeedbackBtn')
    };

    const button = buttons[type];
    const count = counts[type];

    if (count > 0) {
        button.style.display = 'inline-block';
        button.querySelector('span').textContent = `🗑️ Delete Selected (${count})`;
    } else {
        button.style.display = 'none';
    }
}

// Confirm bulk delete with dialog
async function confirmBulkDelete(type) {
    const counts = {
        'modules': selectedModules.size,
        'events': selectedEvents.size,
        'feedback': selectedFeedback.size
    };

    const count = counts[type];
    if (count === 0) return;

    const typeNames = {
        'modules': 'module',
        'events': 'event',
        'feedback': 'feedback submission'
    };

    let message = `⚠️ DELETE ${count} ${typeNames[type].toUpperCase()}${count > 1 ? 'S' : ''}?\n\n`;
    message += `You are about to permanently delete ${count} ${typeNames[type]}${count > 1 ? 's' : ''}.\n\n`;

    if (type === 'events') {
        message += `This will also delete ALL associated modules and feedback submissions.\n\n`;
    } else if (type === 'modules') {
        message += `Note: Modules used in active events cannot be deleted.\n\n`;
    }

    message += `This action CANNOT be undone!\n\nAre you sure you want to continue?`;

    if (!confirm(message)) return;

    // Perform bulk delete
    await performBulkDelete(type);
}

// Perform bulk delete API call
async function performBulkDelete(type) {
    try {
        const ids = {
            'modules': Array.from(selectedModules),
            'events': Array.from(selectedEvents),
            'feedback': Array.from(selectedFeedback)
        };

        const endpoints = {
            'modules': `${CONFIG.API_BASE_URL}/modules/bulk-delete`,
            'events': `${CONFIG.API_BASE_URL}/events/bulk-delete`,
            'feedback': `${CONFIG.API_BASE_URL}/feedback/bulk-delete`
        };

        const bodies = {
            'modules': { moduleIds: ids.modules },
            'events': { eventIds: ids.events },
            'feedback': { feedbackIds: ids.feedback }
        };

        const response = await fetch(endpoints[type], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodies[type])
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Success', data.message, 'success');

            // Clear selections
            if (type === 'modules') selectedModules.clear();
            if (type === 'events') selectedEvents.clear();
            if (type === 'feedback') selectedFeedback.clear();

            // Uncheck select-all
            document.getElementById(`selectAll${type.charAt(0).toUpperCase() + type.slice(0, -1)}`).checked = false;

            // Reload data
            if (type === 'modules') await loadModules();
            if (type === 'events') await loadEvents();
            if (type === 'feedback') await loadFeedback();

            // Hide delete button
            updateDeleteButtonVisibility(type);
        } else {
            showNotification('Error', data.message || 'Failed to delete items', 'error');
        }

    } catch (error) {
        console.error(`Error deleting ${type}:`, error);
        showNotification('Error', `Failed to delete ${type}. Please try again.`, 'error');
    }
}

// Initialize bulk delete on page load
setTimeout(() => {
    initBulkDeleteListeners();
}, 1000);

console.log('Admin Panel Loaded');
console.log('Using Mock Data:', CONFIG.USE_MOCK_DATA);
