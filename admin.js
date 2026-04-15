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
import { apiGet, apiPost, apiPut, apiDelete } from './api.js';
import { createLoginRateLimiter } from './RateLimiter.js';

// Global state
let currentUser = null;
let currentUserRoles = [];
let allModules = [];
let allEvents = [];
let allFeedback = [];
let allUsers = [];
let allRoles = [];
let currentEventId = null;
let loginRateLimiter = null;
let allSpeakers = [];
let allTemplates = [];
let currentEditingSpeakerId = null;
let currentEditingTemplateId = null;
let templateModulesList = []; // modules being built in the template modal

// ── Permission helper ────────────────────────────
const PERMISSIONS = {
    MANAGE_USERS:         ['GlobalAdmin', 'UserAdmin'],
    CREATE_MODULES:       ['GlobalAdmin', 'ModuleManager'],
    EDIT_MODULES:         ['GlobalAdmin', 'ModuleManager'],
    DELETE_MODULES:       ['GlobalAdmin', 'ModuleManager'],
    VIEW_MODULES:         ['GlobalAdmin', 'ModuleManager', 'EventCreator'],
    CREATE_EVENTS:        ['GlobalAdmin', 'EventCreator'],
    EDIT_EVENTS:          ['GlobalAdmin', 'EventCreator'],
    DELETE_EVENTS:        ['GlobalAdmin'],
    VIEW_FEEDBACK:        ['GlobalAdmin', 'EventCreator', 'FeedbackManager', 'FeedbackViewer'],
    DELETE_FEEDBACK:      ['GlobalAdmin', 'FeedbackManager'],
    MANAGE_EVENT_MODULES: ['GlobalAdmin', 'EventCreator'],
    VIEW_ANALYTICS:       ['GlobalAdmin', 'EventCreator', 'FeedbackManager', 'FeedbackViewer'],
    MANAGE_SPEAKERS:      ['GlobalAdmin', 'ModuleManager'],
    VIEW_SPEAKERS:        ['GlobalAdmin', 'ModuleManager', 'EventCreator'],
    MANAGE_TEMPLATES:     ['GlobalAdmin', 'ModuleManager'],
    VIEW_TEMPLATES:       ['GlobalAdmin', 'ModuleManager', 'EventCreator'],
};

function isAllowed(permission) {
    if (!currentUserRoles || currentUserRoles.length === 0) return false;
    if (currentUserRoles.includes('GlobalAdmin')) return true;
    const allowed = PERMISSIONS[permission];
    if (!allowed) return false;
    return allowed.some(role => currentUserRoles.includes(role));
}

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
        const userStr = sessionStorage.getItem('adminUser');
        if (userStr) {
            currentUser = JSON.parse(userStr);
            currentUserRoles = currentUser.roles || [];
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

    // Edit speaker modal
    document.getElementById('closeEditSpeakerModal').addEventListener('click', closeEditSpeakerModal);
    document.getElementById('cancelEditSpeakerBtn').addEventListener('click', closeEditSpeakerModal);
    document.getElementById('editSpeakerForm').addEventListener('submit', handleEditSpeaker);

    // Event details modal
    document.getElementById('closeDetailsModal').addEventListener('click', closeEventDetailsModal);

    // Module and Event action buttons (using event delegation)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // Handle module buttons
        const moduleId = parseInt(target.dataset.moduleId);
        if (!isNaN(moduleId)) {
            e.preventDefault();
            e.stopPropagation();
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
        if (!isNaN(eventId)) {
            e.preventDefault();
            e.stopPropagation();
            if (target.classList.contains('btn-view-details')) {
                console.log('View details clicked for event:', eventId);
                viewEventDetails(eventId);
            } else if (target.classList.contains('btn-edit-event')) {
                console.log('Edit event clicked for event:', eventId);
                editEvent(eventId);
            } else if (target.classList.contains('btn-toggle-status')) {
                console.log('Toggle status clicked for event:', eventId);
                toggleEventStatus(eventId);
            } else if (target.classList.contains('btn-save-as-template')) {
                openSaveAsTemplateModal(eventId, target.dataset.eventName);
            }
            return;
        }

        // Handle module reorder and remove buttons
        const eventModuleId = parseInt(target.dataset.eventModuleId);
        if (!isNaN(eventModuleId)) {
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
            } else if (target.classList.contains('btn-edit-speaker')) {
                const module = currentEventModules.find(m => m.eventModuleId === eventModuleId);
                openEditSpeakerModal(eventModuleId, module?.speakerName);
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

    // Clickable stat cards
    document.getElementById('totalEventsCard').addEventListener('click', navigateToEventsWithFilters);
    document.getElementById('totalFeedbackCard').addEventListener('click', navigateToFeedbackWithFilters);

    // Speakers tab
    const createSpeakerBtn2 = document.getElementById('createSpeakerBtn');
    if (createSpeakerBtn2) createSpeakerBtn2.addEventListener('click', () => openSpeakerModal());
    const speakerSearch = document.getElementById('speakerSearch');
    if (speakerSearch) speakerSearch.addEventListener('input', debounce(filterSpeakers, 300));
    const closeSpeakerModalBtn = document.getElementById('closeSpeakerModal');
    if (closeSpeakerModalBtn) closeSpeakerModalBtn.addEventListener('click', closeSpeakerModal);
    const cancelSpeakerModalBtn = document.getElementById('cancelSpeakerModal');
    if (cancelSpeakerModalBtn) cancelSpeakerModalBtn.addEventListener('click', closeSpeakerModal);
    const speakerForm = document.getElementById('speakerForm');
    if (speakerForm) speakerForm.addEventListener('submit', handleSaveSpeaker);
    const deleteSpeakersBtn = document.getElementById('deleteSpeakersBtn');
    if (deleteSpeakersBtn) deleteSpeakersBtn.addEventListener('click', handleBulkDeleteSpeakers);
    const selectAllSpeakers = document.getElementById('selectAllSpeakers');
    if (selectAllSpeakers) selectAllSpeakers.addEventListener('change', toggleAllSpeakers);

    // Speaker avatar upload
    setupSpeakerAvatarUpload();

    // Quick add speaker from module modal
    const quickAddSpeakerLink = document.getElementById('quickAddSpeakerFromModule');
    if (quickAddSpeakerLink) quickAddSpeakerLink.addEventListener('click', (e) => {
        e.preventDefault();
        openSpeakerModal();
    });

    // Templates tab
    const createTemplateBtnEl = document.getElementById('createTemplateBtn');
    if (createTemplateBtnEl) createTemplateBtnEl.addEventListener('click', () => openTemplateModal());
    const createTemplateFromEventBtnEl = document.getElementById('createTemplateFromEventBtn');
    if (createTemplateFromEventBtnEl) createTemplateFromEventBtnEl.addEventListener('click', openEventPickerModal);
    const templateSearch = document.getElementById('templateSearch');
    if (templateSearch) templateSearch.addEventListener('input', debounce(filterTemplates, 300));
    const closeTemplateModalBtn = document.getElementById('closeTemplateModal');
    if (closeTemplateModalBtn) closeTemplateModalBtn.addEventListener('click', closeTemplateModal);
    const cancelTemplateModalBtn = document.getElementById('cancelTemplateModal');
    if (cancelTemplateModalBtn) cancelTemplateModalBtn.addEventListener('click', closeTemplateModal);
    const templateForm = document.getElementById('templateForm');
    if (templateForm) templateForm.addEventListener('submit', handleSaveTemplate);
    const addTemplateModuleBtn = document.getElementById('addTemplateModuleBtn');
    if (addTemplateModuleBtn) addTemplateModuleBtn.addEventListener('click', addModuleToTemplate);

    // Event picker modal (for template from event)
    const closeEventPickerModalBtn = document.getElementById('closeEventPickerModal');
    if (closeEventPickerModalBtn) closeEventPickerModalBtn.addEventListener('click', closeEventPickerModal);
    const eventPickerSearch = document.getElementById('eventPickerSearch');
    if (eventPickerSearch) eventPickerSearch.addEventListener('input', debounce(filterEventPicker, 300));

    // Template selection modal (for event from template)
    const createEventFromTemplateBtnEl = document.getElementById('createEventFromTemplateBtn');
    if (createEventFromTemplateBtnEl) createEventFromTemplateBtnEl.addEventListener('click', openTemplateSelectionModal);
    const closeTemplateSelectionModalBtn = document.getElementById('closeTemplateSelectionModal');
    if (closeTemplateSelectionModalBtn) closeTemplateSelectionModalBtn.addEventListener('click', closeTemplateSelectionModal);
    const templateSelectionSearch = document.getElementById('templateSelectionSearch');
    if (templateSelectionSearch) templateSelectionSearch.addEventListener('input', debounce(filterTemplateSelection, 300));

    // Save as template modal
    const closeSaveAsTemplateModalBtn = document.getElementById('closeSaveAsTemplateModal');
    if (closeSaveAsTemplateModalBtn) closeSaveAsTemplateModalBtn.addEventListener('click', closeSaveAsTemplateModal);
    const cancelSaveAsTemplateBtn = document.getElementById('cancelSaveAsTemplate');
    if (cancelSaveAsTemplateBtn) cancelSaveAsTemplateBtn.addEventListener('click', closeSaveAsTemplateModal);
    const saveAsTemplateForm = document.getElementById('saveAsTemplateForm');
    if (saveAsTemplateForm) saveAsTemplateForm.addEventListener('submit', handleSaveAsTemplate);
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
            currentUserRoles = result.user.roles || [];
            sessionStorage.setItem('adminToken', result.token);
            sessionStorage.setItem('adminUser', JSON.stringify(result.user));

            // Reset rate limiter on successful login
            loginRateLimiter.reset();

            // Check if user must change password
            if (result.user.mustChangePassword) {
                showForceChangePassword();
                return;
            }

            showMainContent();
        } else {
            loginRateLimiter.recordAttempt();
            loginError.textContent = result.message || 'Invalid username or password';
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
                // Mock login accepts any non-empty credentials in local dev
                if (username && password) {
                    resolve({
                        success: true,
                        token: 'mock-token-' + Date.now(),
                        user: { username: username, fullName: 'Mock User', roles: ['GlobalAdmin'], isProtected: true, mustChangePassword: false }
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

// Apply permission-based UI visibility
function applyPermissionUI() {
    // Tab visibility
    const modulesTabBtn = document.querySelector('[data-tab="modules"]');
    const eventsTabBtn = document.querySelector('[data-tab="events"]');
    const feedbackTabBtn = document.querySelector('[data-tab="feedback"]');
    const analyticsTabBtn = document.querySelector('[data-tab="analytics"]');
    const usersTabBtn = document.getElementById('usersTabBtn');

    if (modulesTabBtn) modulesTabBtn.style.display = isAllowed('VIEW_MODULES') ? '' : 'none';
    if (eventsTabBtn) eventsTabBtn.style.display = isAllowed('CREATE_EVENTS') || currentUserRoles.includes('GlobalAdmin') ? '' : 'none';
    if (feedbackTabBtn) feedbackTabBtn.style.display = isAllowed('VIEW_FEEDBACK') ? '' : 'none';
    if (analyticsTabBtn) analyticsTabBtn.style.display = isAllowed('VIEW_ANALYTICS') ? '' : 'none';
    if (usersTabBtn) usersTabBtn.style.display = isAllowed('MANAGE_USERS') ? '' : 'none';
    const auditLogTabBtn = document.getElementById('auditLogTabBtn');
    if (auditLogTabBtn) auditLogTabBtn.style.display = currentUserRoles.includes('GlobalAdmin') ? '' : 'none';
    const speakersTabBtn = document.getElementById('speakersTabBtn');
    if (speakersTabBtn) speakersTabBtn.style.display = isAllowed('VIEW_SPEAKERS') ? '' : 'none';
    const templatesTabBtn = document.getElementById('templatesTabBtn');
    if (templatesTabBtn) templatesTabBtn.style.display = isAllowed('VIEW_TEMPLATES') ? '' : 'none';

    // Module action buttons
    const createModuleBtn = document.getElementById('createModuleBtn');
    const deleteModulesBtn = document.getElementById('deleteModulesBtn');
    if (createModuleBtn) createModuleBtn.style.display = isAllowed('CREATE_MODULES') ? '' : 'none';

    // Event action buttons
    const createEventBtn = document.getElementById('createEventBtn');
    const deleteEventsBtn = document.getElementById('deleteEventsBtn');
    if (createEventBtn) createEventBtn.style.display = isAllowed('CREATE_EVENTS') ? '' : 'none';

    // Speaker action buttons
    const createSpeakerBtn = document.getElementById('createSpeakerBtn');
    if (createSpeakerBtn) createSpeakerBtn.style.display = isAllowed('MANAGE_SPEAKERS') ? '' : 'none';

    // Template action buttons
    const createTemplateBtn = document.getElementById('createTemplateBtn');
    const createTemplateFromEventBtn = document.getElementById('createTemplateFromEventBtn');
    if (createTemplateBtn) createTemplateBtn.style.display = isAllowed('MANAGE_TEMPLATES') ? '' : 'none';
    if (createTemplateFromEventBtn) createTemplateFromEventBtn.style.display = isAllowed('MANAGE_TEMPLATES') ? '' : 'none';

    // Create from template button (EventCreator can use)
    const createEventFromTemplateBtn = document.getElementById('createEventFromTemplateBtn');
    if (createEventFromTemplateBtn) createEventFromTemplateBtn.style.display = isAllowed('VIEW_TEMPLATES') ? '' : 'none';

    // Feedback action buttons
    const deleteFeedbackBtn = document.getElementById('deleteFeedbackBtn');

    // Set the default active tab to the first visible one
    const firstVisibleTab = document.querySelector('.tab-button:not([style*="display: none"])');
    if (firstVisibleTab && !document.querySelector('.tab-button.active:not([style*="display: none"])')) {
        switchTab(firstVisibleTab.dataset.tab);
    }
}

// Show forced password change modal
function showForceChangePassword() {
    loginScreen.classList.add('hidden');
    mainContent.classList.add('hidden');
    const modal = document.getElementById('changePasswordModal');
    const title = document.getElementById('changePasswordTitle');
    const currentPwGroup = document.getElementById('currentPasswordGroup');
    if (title) title.textContent = 'You must change your password';
    if (currentPwGroup) currentPwGroup.style.display = 'block';
    // Hide cancel button for forced change
    const cancelBtn = document.getElementById('cancelChangePasswordBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    const closeBtn = document.getElementById('closeChangePasswordModal');
    if (closeBtn) closeBtn.style.display = 'none';
    if (modal) modal.classList.remove('hidden');
}

// Show login screen
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    mainContent.classList.add('hidden');
    // Hide header actions when not logged in
    const headerActions = document.getElementById('headerActions');
    if (headerActions) headerActions.style.display = 'none';
    // Reset to login form view (in case user was on forgot password/username)
    const loginFormView = document.getElementById('loginFormView');
    const forgotPwView = document.getElementById('forgotPasswordView');
    const forgotUnView = document.getElementById('forgotUsernameView');
    if (loginFormView) loginFormView.style.display = '';
    if (forgotPwView) forgotPwView.style.display = 'none';
    if (forgotUnView) forgotUnView.style.display = 'none';
}

// Show main content
async function showMainContent() {
    loginScreen.classList.add('hidden');
    mainContent.classList.remove('hidden');
    // Show header actions when logged in
    const headerActions = document.getElementById('headerActions');
    if (headerActions) headerActions.style.display = 'flex';
    if (currentUser) {
        adminUser.textContent = escapeHtml(currentUser.fullName || currentUser.username);
        // Show roles as badges
        const rolesEl = document.getElementById('adminRoles');
        if (rolesEl && currentUserRoles.length > 0) {
            rolesEl.textContent = '';
            currentUserRoles.forEach(r => {
                const span = document.createElement('span');
                span.className = `role-badge role-badge-${r.toLowerCase()}`;
                span.textContent = r;
                rolesEl.appendChild(span);
            });
        }
        // Set header avatar (fetch profile image from API)
        const headerAvatar = document.getElementById('headerAvatar');
        if (headerAvatar && currentUser.userId) {
            const initials = (currentUser.fullName || currentUser.username || '?')
                .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            headerAvatar.innerHTML = initials;
            // Try to load profile image
            apiGet(`/users/${currentUser.userId}`).then(res => {
                if (res.data && res.data.ProfileImage) {
                    headerAvatar.innerHTML = `<img src="${res.data.ProfileImage}" alt="Me">`;
                }
            }).catch(() => {});
        }
    }

    // Apply permission-based UI visibility
    applyPermissionUI();

    // Load data in parallel (optimization)
    try {
        console.log('Loading data with config:', { useMockData: CONFIG.USE_MOCK_DATA, apiBaseUrl: CONFIG.API_BASE_URL });

        const dataPromises = [];
        // Only fetch data the user has access to
        if (isAllowed('VIEW_MODULES')) {
            dataPromises.push(fetchModules().catch(err => { console.error('fetchModules failed:', err); return []; }));
        } else {
            dataPromises.push(Promise.resolve([]));
        }
        dataPromises.push(fetchEvents().catch(err => { console.error('fetchEvents failed:', err); return []; }));
        if (isAllowed('VIEW_FEEDBACK')) {
            dataPromises.push(fetchFeedback().catch(err => { console.error('fetchFeedback failed:', err); return []; }));
        } else {
            dataPromises.push(Promise.resolve([]));
        }

        if (isAllowed('VIEW_SPEAKERS')) {
            dataPromises.push(fetchSpeakers().catch(err => { console.error('fetchSpeakers failed:', err); return []; }));
        } else {
            dataPromises.push(Promise.resolve([]));
        }
        if (isAllowed('VIEW_TEMPLATES')) {
            dataPromises.push(fetchTemplates().catch(err => { console.error('fetchTemplates failed:', err); return []; }));
        } else {
            dataPromises.push(Promise.resolve([]));
        }

        const [modules, events, feedback, speakers, templates] = await Promise.all(dataPromises);

        console.log('Data loaded successfully:', { modules: modules.length, events: events.length, feedback: feedback.length });

        allModules = modules;
        allEvents = events;
        allFeedback = feedback;
        allSpeakers = speakers || [];
        allTemplates = templates || [];

        renderModules(modules);
        renderEvents(events);
        populateEventFilter(events);
        populateModuleFilter(feedback);
        populateSpeakerFilter(feedback);
        populateAnalyticsFilters(events, feedback);
        renderFeedback(feedback);
        renderSpeakers(allSpeakers);
        renderTemplates(allTemplates);
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
    } else if (tabName === 'users' && isAllowed('MANAGE_USERS')) {
        fetchUsers();
    } else if (tabName === 'auditlog' && currentUserRoles.includes('GlobalAdmin')) {
        fetchAuditLog(1);
    } else if (tabName === 'speakers') {
        loadSpeakers();
    } else if (tabName === 'templates') {
        loadTemplates();
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

    if (moduleId != null) {
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
                    <!-- Current Module Order Display for Quick Add -->
                    <div id="quickCurrentModuleOrderDisplay" class="form-group" style="display: none;">
                        <label>Current Module Order</label>
                        <div id="quickCurrentModuleOrderList" style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; max-height: 200px; overflow-y: auto;">
                            <!-- Populated dynamically -->
                        </div>
                        <small class="form-help">New module will be inserted at your selected position, and existing modules will shift accordingly.</small>
                    </div>
                    <div class="form-group">
                        <label for="quickDeliveryOrder">Insert Position</label>
                        <select id="quickDeliveryOrder">
                            <option value="1">At the beginning (Position 1)</option>
                        </select>
                        <small class="form-help">Choose where to insert this module. Existing modules will shift to make room.</small>
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

    // Update insertion positions when event is selected
    document.getElementById('quickEventSelect').addEventListener('change', async (e) => {
        const eventId = e.target.value;
        if (eventId) {
            await updateQuickInsertionPositions(parseInt(eventId));
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
                    trainingTrack: 'Q1-2026',
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
                    trainingTrack: 'Q1-2026',
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
                    trainingTrack: 'Q1-2026',
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
                ${event.trainingTrack ? `
                <div class="event-meta-item">
                    <span>🎓</span>
                    <span>${escapeHtml(event.trainingTrack)}</span>
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
                ${isAllowed('MANAGE_TEMPLATES') ? `
                <button class="btn btn-secondary btn-icon btn-save-as-template" data-event-id="${event.eventId}" data-event-name="${escapeHtml(event.eventCode)}">
                    📋 Save as Template
                </button>
                ` : ''}
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

        // Search in training track
        if (event.trainingTrack && event.trainingTrack.toLowerCase().includes(searchTerm)) return true;

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
                    ${event.trainingTrack ? `
                    <div style="margin-bottom: 8px;">
                        <strong>Training Track:</strong> ${escapeHtml(event.trainingTrack)}
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

    if (eventId != null) {
        const event = allEvents.find(e => e.eventId === eventId);
        if (event) {
            modalTitle.textContent = 'Edit Event';
            document.getElementById('eventId').value = event.eventId;
            document.getElementById('eventName').value = event.eventName || '';
            document.getElementById('eventCode').value = event.eventCode;
            document.getElementById('startDate').value = formatDateForInput(event.startDate);
            document.getElementById('endDate').value = event.endDate ? formatDateForInput(event.endDate) : '';
            document.getElementById('trainingTrack').value = event.trainingTrack || '';
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
        trainingTrack: document.getElementById('trainingTrack').value || null,
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
                            class="btn btn-secondary btn-sm btn-edit-speaker"
                            data-event-module-id="${em.eventModuleId}"
                            style="padding: 8px 16px;">
                        Edit Speaker
                    </button>
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

    // Populate speaker dropdown
    populateSpeakerDropdowns();

    // Display current module order and populate insertion position dropdown
    displayCurrentModuleOrder();
    populateInsertionPositions();

    modal.classList.remove('hidden');
};

// Display current module order for context
function displayCurrentModuleOrder() {
    const displayContainer = document.getElementById('currentModuleOrderDisplay');
    const listContainer = document.getElementById('currentModuleOrderList');

    if (!displayContainer || !listContainer) return;

    // Sort modules by delivery order
    const sortedModules = [...currentEventModules].sort((a, b) => a.deliveryOrder - b.deliveryOrder);

    if (sortedModules.length === 0) {
        displayContainer.style.display = 'none';
        return;
    }

    displayContainer.style.display = 'block';

    // Create visual list of current modules
    const html = sortedModules.map((module, index) => `
        <div style="display: flex; align-items: center; padding: 8px; margin-bottom: 4px; background: white; border-radius: 3px; border-left: 3px solid #6c63ff;">
            <span style="font-weight: bold; color: #6c63ff; min-width: 30px;">${module.deliveryOrder}.</span>
            <span style="flex: 1; margin-left: 8px;">${escapeHtml(module.moduleName)}</span>
            <span style="color: #666; font-size: 0.85em;">👤 ${escapeHtml(module.speakerName)}</span>
        </div>
    `).join('');

    listContainer.innerHTML = html || '<div style="padding: 8px; color: #666;">No modules yet</div>';
}

// Populate insertion position dropdown with intuitive options
function populateInsertionPositions() {
    const select = document.getElementById('deliveryOrder');
    select.innerHTML = ''; // Clear existing options

    // Sort modules by delivery order
    const sortedModules = [...currentEventModules].sort((a, b) => a.deliveryOrder - b.deliveryOrder);

    if (sortedModules.length === 0) {
        // No modules yet - only option is position 1
        const option = document.createElement('option');
        option.value = '1';
        option.textContent = 'At the beginning (Position 1)';
        option.selected = true;
        select.appendChild(option);
    } else {
        // Add option for beginning
        const beginOption = document.createElement('option');
        beginOption.value = '1';
        beginOption.textContent = 'At the beginning (Position 1)';
        select.appendChild(beginOption);

        // Add "After [Module Name]" options
        sortedModules.forEach((module, index) => {
            const option = document.createElement('option');
            option.value = (index + 2).toString(); // Position after this module
            option.textContent = `After "${module.moduleName}" (Position ${index + 2})`;
            select.appendChild(option);
        });

        // Select the last position (append to end) by default
        select.value = (sortedModules.length + 1).toString();
    }
}

// Display current module order for quick add modal
function displayQuickModuleOrder(modules) {
    const displayContainer = document.getElementById('quickCurrentModuleOrderDisplay');
    const listContainer = document.getElementById('quickCurrentModuleOrderList');

    if (!displayContainer || !listContainer) return;

    if (!modules || modules.length === 0) {
        displayContainer.style.display = 'none';
        return;
    }

    displayContainer.style.display = 'block';

    // Create visual list of current modules
    const html = modules.map((module) => `
        <div style="display: flex; align-items: center; padding: 8px; margin-bottom: 4px; background: white; border-radius: 3px; border-left: 3px solid #6c63ff;">
            <span style="font-weight: bold; color: #6c63ff; min-width: 30px;">${module.deliveryOrder}.</span>
            <span style="flex: 1; margin-left: 8px;">${escapeHtml(module.moduleName)}</span>
            <span style="color: #666; font-size: 0.85em;">👤 ${escapeHtml(module.speakerName)}</span>
        </div>
    `).join('');

    listContainer.innerHTML = html || '<div style="padding: 8px; color: #666;">No modules yet</div>';
}

// Update insertion positions for quick add modal
async function updateQuickInsertionPositions(eventId) {
    const select = document.getElementById('quickDeliveryOrder');
    if (!select) return;

    select.innerHTML = ''; // Clear existing options

    try {
        // Fetch modules for this event
        const response = await apiGet(`/events/${eventId}/modules`);

        if (response.success && response.data) {
            const modules = response.data;
            const sortedModules = [...modules].sort((a, b) => a.deliveryOrder - b.deliveryOrder);

            // Display current module order for context
            displayQuickModuleOrder(sortedModules);

            if (sortedModules.length === 0) {
                // No modules yet
                const option = document.createElement('option');
                option.value = '1';
                option.textContent = 'At the beginning (Position 1)';
                select.appendChild(option);
            } else {
                // Add option for beginning
                const beginOption = document.createElement('option');
                beginOption.value = '1';
                beginOption.textContent = 'At the beginning (Position 1)';
                select.appendChild(beginOption);

                // Add "After [Module Name]" options
                sortedModules.forEach((module, index) => {
                    const option = document.createElement('option');
                    option.value = (index + 2).toString();
                    option.textContent = `After "${module.moduleName}" (Position ${index + 2})`;
                    select.appendChild(option);
                });

                // Select the last position by default
                select.value = (sortedModules.length + 1).toString();
            }
        }
    } catch (error) {
        console.error('Error fetching event modules:', error);
        // Default to position 1 on error
        const option = document.createElement('option');
        option.value = '1';
        option.textContent = 'Position 1';
        select.appendChild(option);

        // Hide display on error
        displayQuickModuleOrder(null);
    }
}

// Close add module modal
function closeAddModuleModal() {
    document.getElementById('addModuleModal').classList.add('hidden');
}

// Open edit speaker modal
function openEditSpeakerModal(eventModuleId, currentSpeakerName) {
    if (!eventModuleId) return;
    document.getElementById('editSpeakerEventModuleId').value = eventModuleId;
    // Populate and pre-select the speaker dropdown
    populateSpeakerDropdowns();
    const select = document.getElementById('editSpeakerId');
    if (select) {
        // Find the speaker by name to pre-select
        const module = currentEventModules.find(m => m.eventModuleId === eventModuleId);
        if (module && module.speakerId) {
            select.value = module.speakerId;
        }
    }
    document.getElementById('editSpeakerModal').classList.remove('hidden');
}

// Close edit speaker modal
function closeEditSpeakerModal() {
    document.getElementById('editSpeakerModal').classList.add('hidden');
}

// Handle edit speaker form submission
async function handleEditSpeaker(e) {
    e.preventDefault();

    const eventModuleId = document.getElementById('editSpeakerEventModuleId').value;
    const speakerId = document.getElementById('editSpeakerId').value;

    if (!speakerId) {
        showNotification('Error', 'Please select a speaker', 'error');
        return;
    }

    try {
        const result = await apiPut(`/event-modules/${eventModuleId}/speaker`, {
            speakerId: parseInt(speakerId)
        });

        if (result.success) {
            closeEditSpeakerModal();

            // Refresh modules in the event edit modal
            const eventIdField = document.getElementById('eventId');
            if (eventIdField && eventIdField.value) {
                await loadEventModules(eventIdField.value);
            }

            showNotification('Success', 'Speaker updated successfully!', 'success');
        } else {
            showNotification('Error', result.message || 'Error updating speaker', 'error');
        }
    } catch (error) {
        console.error('Error updating speaker:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

// Handle add module to event
async function handleAddModule(e) {
    e.preventDefault();

    const moduleId = document.getElementById('moduleSelectForEvent').value;
    const speakerId = document.getElementById('speakerIdForModule').value;
    const deliveryOrder = document.getElementById('deliveryOrder').value;
    const deliveryDate = document.getElementById('deliveryDate').value;
    const notes = document.getElementById('moduleNotes').value;

    if (!moduleId || !speakerId) {
        showNotification('Error', 'Please select a module and a speaker', 'error');
        return;
    }

    try {
        const result = await apiPost('/event-modules', {
            eventId: parseInt(currentEventIdForModule),
            moduleId: parseInt(moduleId),
            speakerId: parseInt(speakerId),
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

// Chart instances for cleanup
// ApexCharts instances
let trendChartInstance = null;
let speakerHistogramInstance = null;
let satisfactionHistogramInstance = null;

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

    // Render new enhanced analytics
    renderTrendChart(feedback, events);
    renderRatingHistograms(feedback);
    renderTopBottomPerformers(feedback);
}

// Render trend analysis chart (ApexCharts)
function renderTrendChart(feedback, events) {
    // Group feedback by event and calculate averages
    const eventData = events.map(event => {
        const eventFeedback = feedback.filter(fb => fb.eventCode === event.eventCode);
        const avgSatisfaction = eventFeedback.length > 0
            ? eventFeedback.reduce((sum, fb) => sum + fb.moduleSatisfaction, 0) / eventFeedback.length
            : 0;
        const avgSpeakerKnowledge = eventFeedback.length > 0
            ? eventFeedback.reduce((sum, fb) => sum + fb.speakerKnowledge, 0) / eventFeedback.length
            : 0;

        return {
            eventName: event.eventName,
            eventCode: event.eventCode,
            startDate: new Date(event.startDate),
            avgSatisfaction: parseFloat(avgSatisfaction.toFixed(2)),
            avgSpeakerKnowledge: parseFloat(avgSpeakerKnowledge.toFixed(2)),
            feedbackCount: eventFeedback.length
        };
    }).sort((a, b) => a.startDate - b.startDate);

    // Destroy previous chart instance
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    const chartElement = document.getElementById('trendChart');
    if (!chartElement) return;

    // Enhanced ApexCharts configuration with better visuals
    const options = {
        series: [
            {
                name: '📊 Module Satisfaction',
                data: eventData.map(e => e.avgSatisfaction)
            },
            {
                name: '🎤 Speaker Knowledge',
                data: eventData.map(e => e.avgSpeakerKnowledge)
            }
        ],
        chart: {
            type: 'line',
            height: 350,
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    zoom: true,
                    pan: true,
                    reset: true
                }
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 1000,
                animateGradually: {
                    enabled: true,
                    delay: 150
                },
                dynamicAnimation: {
                    enabled: true,
                    speed: 350
                }
            },
            background: 'transparent',
            dropShadow: {
                enabled: true,
                top: 3,
                left: 0,
                blur: 4,
                opacity: 0.15
            }
        },
        colors: ['#667eea', '#f6ad55'],
        stroke: {
            curve: 'smooth',
            width: 4,
            lineCap: 'round',
            colors: ['#667eea', '#f6ad55']
        },
        markers: {
            size: 6,
            colors: ['#667eea', '#f6ad55'],
            strokeColors: '#fff',
            strokeWidth: 2,
            hover: {
                size: 8,
                sizeOffset: 2
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.5,
                gradientToColors: ['#764ba2', '#ed8936'],
                inverseColors: false,
                opacityFrom: 0.6,
                opacityTo: 0.1,
                stops: [0, 100]
            }
        },
        dataLabels: {
            enabled: true,
            enabledOnSeries: undefined,
            formatter: function (val) {
                return val.toFixed(1);
            },
            style: {
                fontSize: '11px',
                fontWeight: 'bold',
                colors: ['#304758']
            },
            background: {
                enabled: true,
                foreColor: '#fff',
                padding: 4,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#ddd',
                opacity: 0.9
            }
        },
        grid: {
            show: true,
            borderColor: '#e0e0e0',
            strokeDashArray: 4,
            position: 'back',
            xaxis: {
                lines: {
                    show: true
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            },
            padding: {
                top: 0,
                right: 10,
                bottom: 0,
                left: 10
            }
        },
        xaxis: {
            categories: eventData.map(e => `${e.eventCode}\n${e.startDate.toLocaleDateString()}`),
            title: {
                text: 'Events (Chronological)',
                style: {
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#444'
                }
            },
            labels: {
                style: {
                    fontSize: '11px',
                    fontWeight: 500
                }
            }
        },
        yaxis: {
            min: 0,
            max: 5,
            tickAmount: 5,
            title: {
                text: 'Average Rating (1-5 ⭐)',
                style: {
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#444'
                }
            },
            labels: {
                formatter: function(value) {
                    return value.toFixed(1) + ' ⭐';
                },
                style: {
                    fontSize: '11px',
                    fontWeight: 500
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center',
            floating: false,
            fontSize: '13px',
            fontWeight: 600,
            markers: {
                width: 12,
                height: 12,
                radius: 6
            },
            itemMargin: {
                horizontal: 15,
                vertical: 5
            }
        },
        tooltip: {
            shared: true,
            intersect: false,
            theme: 'light',
            x: {
                show: true
            },
            y: {
                formatter: function(value) {
                    return value.toFixed(2) + ' ⭐';
                }
            },
            custom: function({series, seriesIndex, dataPointIndex, w}) {
                const event = eventData[dataPointIndex];
                const satisfaction = series[0][dataPointIndex];
                const knowledge = series[1][dataPointIndex];
                return `
                    <div style="padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="font-weight: bold; margin-bottom: 8px; color: white; font-size: 14px;">📅 ${event.eventName}</div>
                        <div style="background: rgba(255,255,255,0.95); padding: 8px; border-radius: 4px; margin-bottom: 4px;">
                            <div style="color: #667eea; font-weight: 600; font-size: 13px;">📊 Module Satisfaction: ${satisfaction} ⭐</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.95); padding: 8px; border-radius: 4px; margin-bottom: 4px;">
                            <div style="color: #f6ad55; font-weight: 600; font-size: 13px;">🎤 Speaker Knowledge: ${knowledge} ⭐</div>
                        </div>
                        <div style="color: rgba(255,255,255,0.9); font-size: 11px; margin-top: 6px; text-align: center;">
                            💬 ${event.feedbackCount} responses
                        </div>
                    </div>
                `;
            }
        }
    };

    trendChartInstance = new ApexCharts(chartElement, options);
    trendChartInstance.render();
}

// Render rating distribution histograms (ApexCharts)
function renderRatingHistograms(feedback) {
    // Count ratings for speaker knowledge (1-5)
    const speakerCounts = [0, 0, 0, 0, 0];
    const satisfactionCounts = [0, 0, 0, 0, 0];

    feedback.forEach(fb => {
        if (fb.speakerKnowledge >= 1 && fb.speakerKnowledge <= 5) {
            speakerCounts[fb.speakerKnowledge - 1]++;
        }
        if (fb.moduleSatisfaction >= 1 && fb.moduleSatisfaction <= 5) {
            satisfactionCounts[fb.moduleSatisfaction - 1]++;
        }
    });

    // Destroy previous chart instances
    if (speakerHistogramInstance) {
        speakerHistogramInstance.destroy();
    }
    if (satisfactionHistogramInstance) {
        satisfactionHistogramInstance.destroy();
    }

    // Speaker Knowledge Histogram
    const speakerElement = document.getElementById('speakerKnowledgeHistogram');
    if (speakerElement) {
        const speakerOptions = {
            series: [{
                name: 'Count',
                data: speakerCounts
            }],
            chart: {
                type: 'bar',
                height: 300,
                toolbar: { show: false }
            },
            plotOptions: {
                bar: {
                    distributed: true,
                    borderRadius: 4
                }
            },
            stroke: {
                show: false
            },
            colors: ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#20c997'],
            xaxis: {
                categories: ['1⭐', '2⭐', '3⭐', '4⭐', '5⭐']
            },
            yaxis: {
                title: {
                    text: 'Number of Responses'
                },
                tickAmount: 5,
                labels: {
                    formatter: function(value) {
                        return Math.round(value);
                    }
                }
            },
            legend: {
                show: false
            },
            dataLabels: {
                enabled: true
            }
        };

        speakerHistogramInstance = new ApexCharts(speakerElement, speakerOptions);
        speakerHistogramInstance.render();
    }

    // Module Satisfaction Histogram
    const satisfactionElement = document.getElementById('moduleSatisfactionHistogram');
    if (satisfactionElement) {
        const satisfactionOptions = {
            series: [{
                name: 'Count',
                data: satisfactionCounts
            }],
            chart: {
                type: 'bar',
                height: 300,
                toolbar: { show: false }
            },
            plotOptions: {
                bar: {
                    distributed: true,
                    borderRadius: 4
                }
            },
            stroke: {
                show: false
            },
            colors: ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#20c997'],
            xaxis: {
                categories: ['1⭐', '2⭐', '3⭐', '4⭐', '5⭐']
            },
            yaxis: {
                title: {
                    text: 'Number of Responses'
                },
                tickAmount: 5,
                labels: {
                    formatter: function(value) {
                        return Math.round(value);
                    }
                }
            },
            legend: {
                show: false
            },
            dataLabels: {
                enabled: true
            }
        };

        satisfactionHistogramInstance = new ApexCharts(satisfactionElement, satisfactionOptions);
        satisfactionHistogramInstance.render();
    }
}

// Render top and bottom performers
function renderTopBottomPerformers(feedback) {
    // Group by event module and calculate averages
    const moduleStats = {};

    feedback.forEach(fb => {
        const key = `${fb.eventModuleId}`;
        if (!moduleStats[key]) {
            moduleStats[key] = {
                eventModuleId: fb.eventModuleId,
                moduleName: fb.moduleName,
                speakerName: fb.speakerName,
                eventName: fb.eventName,
                totalSatisfaction: 0,
                count: 0
            };
        }
        moduleStats[key].totalSatisfaction += fb.moduleSatisfaction;
        moduleStats[key].count++;
    });

    // Calculate averages and filter
    const modules = Object.values(moduleStats)
        .map(m => ({
            ...m,
            avgRating: m.totalSatisfaction / m.count
        }))
        .filter(m => m.count >= 3); // Minimum 3 responses

    // Sort and get top/bottom 3
    const sortedModules = [...modules].sort((a, b) => b.avgRating - a.avgRating);
    const topPerformers = sortedModules.slice(0, 3);
    const bottomPerformers = sortedModules.slice(-3).reverse();

    // Render top performers
    const topContainer = document.getElementById('topPerformers');
    if (topContainer) {
        if (topPerformers.length === 0) {
            topContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Not enough data (minimum 3 responses per module)</p>';
        } else {
            topContainer.innerHTML = topPerformers.map(m => `
                <div class="performer-item">
                    <div class="performer-info">
                        <div class="performer-name">${escapeHtml(m.moduleName)}</div>
                        <div class="performer-speaker">👤 ${escapeHtml(m.speakerName)}</div>
                    </div>
                    <div class="performer-stats">
                        <div class="performer-rating">${m.avgRating.toFixed(1)}⭐</div>
                        <div class="performer-count">${m.count} responses</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Render bottom performers
    const bottomContainer = document.getElementById('bottomPerformers');
    if (bottomContainer) {
        if (bottomPerformers.length === 0) {
            bottomContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Not enough data (minimum 3 responses per module)</p>';
        } else {
            bottomContainer.innerHTML = bottomPerformers.map(m => `
                <div class="performer-item">
                    <div class="performer-info">
                        <div class="performer-name">${escapeHtml(m.moduleName)}</div>
                        <div class="performer-speaker">👤 ${escapeHtml(m.speakerName)}</div>
                    </div>
                    <div class="performer-stats">
                        <div class="performer-rating">${m.avgRating.toFixed(1)}⭐</div>
                        <div class="performer-count">${m.count} responses</div>
                    </div>
                </div>
            `).join('');
        }
    }
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

// Navigate to Events tab with analytics filters applied
function navigateToEventsWithFilters() {
    // Get current analytics filter values
    const eventFilter = document.getElementById('analyticsFilterEvent').value;

    // Switch to events tab
    switchTab('events');

    // Apply event filter to search field if an event is selected
    if (eventFilter) {
        const eventSearchField = document.getElementById('eventSearch');
        if (eventSearchField) {
            eventSearchField.value = eventFilter;
            filterEvents();
        }
    }
}

// Navigate to Feedback tab with analytics filters applied
function navigateToFeedbackWithFilters() {
    // Get current analytics filter values
    const eventFilter = document.getElementById('analyticsFilterEvent').value;
    const moduleFilter = document.getElementById('analyticsFilterModule').value;
    const speakerFilter = document.getElementById('analyticsFilterSpeaker').value;

    // Switch to feedback tab
    switchTab('feedback');

    // Apply filters to feedback tab dropdowns
    if (eventFilter) {
        document.getElementById('filterEvent').value = eventFilter;
    }
    if (moduleFilter) {
        document.getElementById('filterModule').value = moduleFilter;
    }
    if (speakerFilter) {
        document.getElementById('filterSpeaker').value = speakerFilter;
    }

    // Trigger filter update
    filterAndSortFeedback();
}

// Export feedback to CSV (with proper escaping)
// Exports only filtered data when filters are active, otherwise all feedback
function exportFeedbackToCSV() {
    if (allFeedback.length === 0) {
        showNotification('Info', 'No feedback to export.', 'info');
        return;
    }

    // Apply current filters to determine what to export
    const eventFilter = document.getElementById('filterEvent').value;
    const moduleFilter = document.getElementById('filterModule').value;
    const speakerFilter = document.getElementById('filterSpeaker').value;
    const ratingFilter = document.getElementById('filterRating').value;
    const sortOption = document.getElementById('sortFeedback').value;

    let feedbackToExport = allFeedback;

    if (eventFilter) {
        feedbackToExport = feedbackToExport.filter(fb => fb.eventCode === eventFilter);
    }
    if (moduleFilter) {
        feedbackToExport = feedbackToExport.filter(fb => fb.moduleName === moduleFilter);
    }
    if (speakerFilter) {
        feedbackToExport = feedbackToExport.filter(fb => fb.speakerName === speakerFilter);
    }
    if (ratingFilter) {
        feedbackToExport = feedbackToExport.filter(fb => fb.moduleSatisfaction == ratingFilter);
    }

    feedbackToExport = sortFeedback(feedbackToExport, sortOption);

    if (feedbackToExport.length === 0) {
        showNotification('Info', 'No feedback matches the current filters.', 'info');
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

    const rows = feedbackToExport.map(fb => [
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

    const isFiltered = eventFilter || moduleFilter || speakerFilter || ratingFilter;
    const msg = isFiltered
        ? `Exported ${feedbackToExport.length} of ${allFeedback.length} feedback entries (filtered).`
        : `Exported all ${feedbackToExport.length} feedback entries.`;
    showNotification('Success', msg, 'success');
}

// Show notification
function showNotification(title, message, type = 'info') {
    // Remove any existing notifications
    document.querySelectorAll('.error-notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `error-notification ${type}`;

    const content = document.createElement('div');
    content.className = 'error-content';

    const titleEl = document.createElement('strong');
    titleEl.textContent = title;

    const msgEl = document.createElement('p');
    msgEl.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notification.remove();
    });

    content.appendChild(titleEl);
    content.appendChild(msgEl);
    content.appendChild(closeBtn);
    notification.appendChild(content);

    // Clicking anywhere on the notification also dismisses it
    notification.addEventListener('click', () => notification.remove());

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    const timer = setTimeout(() => {
        if (notification.parentNode) notification.remove();
    }, CONFIG.TOAST_DURATION);

    // Clear timer if manually closed
    closeBtn.addEventListener('click', () => clearTimeout(timer));
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

        const bodies = {
            'modules': { moduleIds: ids.modules },
            'events': { eventIds: ids.events },
            'feedback': { feedbackIds: ids.feedback }
        };

        const data = await apiPost(`/${type}/bulk-delete`, bodies[type]);

        if (data.success) {
            showNotification('Success', data.message, 'success');

            // Clear selections
            if (type === 'modules') selectedModules.clear();
            if (type === 'events') selectedEvents.clear();
            if (type === 'feedback') selectedFeedback.clear();

            // Uncheck select-all
            document.getElementById(`selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`).checked = false;

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

// ========================================================================
// USER MANAGEMENT
// ========================================================================

// Fetch all users
async function fetchUsers() {
    if (!isAllowed('MANAGE_USERS')) return [];
    try {
        if (CONFIG.USE_MOCK_DATA) return [];
        const result = await apiGet('/users');
        allUsers = result.data || [];
        renderUsers();
        return allUsers;
    } catch (err) {
        console.error('Failed to fetch users:', err);
        return [];
    }
}

// Fetch available roles
async function fetchRoles() {
    try {
        if (CONFIG.USE_MOCK_DATA) return [];
        const result = await apiGet('/roles');
        allRoles = result.data || [];
        return allRoles;
    } catch (err) {
        console.error('Failed to fetch roles:', err);
        return [];
    }
}

// Generate a secure random password (client-side, rejection sampling to avoid modulo bias)
function generateSecurePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const maxValid = 256 - (256 % chars.length);
    let password = '';
    while (password.length < 16) {
        const array = new Uint8Array(1);
        crypto.getRandomValues(array);
        if (array[0] < maxValid) {
            password += chars[array[0] % chars.length];
        }
    }
    return password;
}

// Human-readable descriptions for each role
const ROLE_DESCRIPTIONS = {
    GlobalAdmin:     { label: 'Full Access',       icon: '&#x2605;', desc: 'Can do everything — manages all events, modules, feedback, users, and settings' },
    UserAdmin:       { label: 'User Manager',      icon: '&#x1F465;', desc: 'Can add, edit, and remove people and change what they have access to' },
    ModuleManager:   { label: 'Module Manager',    icon: '&#x1F4DA;', desc: 'Can create and edit training modules in the catalog' },
    EventCreator:    { label: 'Event Manager',     icon: '&#x1F4C5;', desc: 'Can create events and assign modules and speakers to them' },
    FeedbackManager: { label: 'Feedback Manager',  icon: '&#x1F4AC;', desc: 'Can view and delete feedback for events they have access to' },
    FeedbackViewer:  { label: 'Reporter',          icon: '&#x1F4CA;', desc: 'Can view feedback and analytics — read-only, no editing' },
};

// Render users as intuitive people cards
function renderUsers(searchTerm = '', roleFilter = 'all') {
    const container = document.getElementById('usersList');
    if (!container) return;

    const filtered = allUsers.filter(u => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            if (!u.Username.toLowerCase().includes(term) &&
                !u.FullName.toLowerCase().includes(term) &&
                !u.Email.toLowerCase().includes(term)) return false;
        }
        if (roleFilter && roleFilter !== 'all') {
            const names = (u.roles || []).map(r => r.roleName);
            if (!names.includes(roleFilter)) return false;
        }
        return true;
    });

    const countEl = document.getElementById('userCountDisplay');
    if (countEl) countEl.textContent = allUsers.length;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="um-empty">
                <div class="um-empty-icon">&#x1F50D;</div>
                <p>No one matches your search.</p>
            </div>`;
        return;
    }

    function getInitials(name) {
        return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    }

    function avatarGradient(roles) {
        if (!roles || !roles.length) return '#94a3b8';
        const map = {
            GlobalAdmin: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            UserAdmin: 'linear-gradient(135deg,#7c3aed,#a855f7)',
            ModuleManager: 'linear-gradient(135deg,#059669,#10b981)',
            EventCreator: 'linear-gradient(135deg,#2563eb,#3b82f6)',
            FeedbackManager: 'linear-gradient(135deg,#ea580c,#f97316)',
            FeedbackViewer: 'linear-gradient(135deg,#475569,#64748b)',
        };
        return map[roles[0].roleName] || map.EventCreator;
    }

    function describePermissions(roles) {
        if (!roles || !roles.length) return '<span class="umc-no-perms">No permissions assigned yet</span>';
        // If user has GlobalAdmin, just show Full Access — it implies everything
        const hasGlobalAdmin = roles.some(r => r.roleName === 'GlobalAdmin');
        if (hasGlobalAdmin) {
            const info = ROLE_DESCRIPTIONS.GlobalAdmin;
            return `<div class="umc-perm">
                <span class="umc-perm-icon">${info.icon}</span>
                <span class="umc-perm-label">${escapeHtml(info.label)}</span>
            </div>`;
        }
        return roles.map(r => {
            const info = ROLE_DESCRIPTIONS[r.roleName] || { label: r.roleName, icon: '&#x2699;', desc: '' };
            return `<div class="umc-perm">
                <span class="umc-perm-icon">${info.icon}</span>
                <span class="umc-perm-label">${escapeHtml(info.label)}</span>
            </div>`;
        }).join('');
    }

    function lastSeenText(dateStr) {
        if (!dateStr) return 'Has not signed in yet';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 60) return `Active ${mins < 2 ? 'just now' : mins + ' min ago'}`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Active ${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `Active ${days} day${days > 1 ? 's' : ''} ago`;
        return `Last seen ${formatDate(dateStr)}`;
    }

    container.innerHTML = filtered.map(user => {
        const isInactive = !user.IsActive;
        const cardClass = isInactive ? 'umc-card umc-inactive' : 'umc-card';
        const protectedLabel = user.IsProtected
            ? '<span class="umc-protected-badge">Protected Account</span>' : '';
        const inactiveLabel = isInactive
            ? '<span class="umc-inactive-badge">Deactivated</span>' : '';

        const avatarContent = user.ProfileImage
            ? `<div class="umc-avatar umc-avatar-img"><img src="${user.ProfileImage}" alt="${escapeHtml(user.FullName)}"></div>`
            : `<div class="umc-avatar" style="background:${avatarGradient(user.roles)}">${getInitials(user.FullName)}</div>`;

        return `
        <div class="${cardClass}">
            <div class="umc-top">
                <div class="umc-identity">
                    ${avatarContent}
                    <div>
                        <div class="umc-name">${escapeHtml(user.FullName)} ${protectedLabel}${inactiveLabel}</div>
                        <div class="umc-email">${escapeHtml(user.Email)}</div>
                    </div>
                </div>
                <div class="umc-seen">${lastSeenText(user.LastLoginAt)}</div>
            </div>
            <div class="umc-perms-section">
                <div class="umc-perms-label">What they can do</div>
                <div class="umc-perms-list">${describePermissions(user.roles)}</div>
            </div>
            <div class="umc-actions">
                <button class="umc-btn btn-edit-user" data-user-id="${user.UserId}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
                    Edit
                </button>
                <button class="umc-btn btn-manage-access" data-user-id="${user.UserId}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
                    Event Access
                </button>
                <button class="umc-btn btn-reset-pw" data-user-id="${user.UserId}" data-username="${escapeHtml(user.Username)}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="11" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 8.5L13 3m0 0v3m0-3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Reset Password
                </button>
                ${!user.IsProtected ? `
                <button class="umc-btn umc-btn-danger btn-delete-user" data-user-id="${user.UserId}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3 4l1 10h8l1-10" stroke="currentColor" stroke-width="1.5"/></svg>
                    Remove
                </button>` : ''}
            </div>
        </div>`;
    }).join('');
}

// Open user create/edit modal
async function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    const pwGroup = document.getElementById('userPasswordGroup');
    const activeGroup = document.getElementById('userActiveGroup');
    const saveBtn = document.getElementById('saveUserBtn');

    form.reset();
    form.dataset.selfEdit = 'false';
    document.getElementById('editUserId').value = '';

    // Ensure roles fieldset is visible (may have been hidden by My Profile)
    const rolesFieldsetReset = document.getElementById('userRolesCheckboxes')?.closest('fieldset');
    if (rolesFieldsetReset) rolesFieldsetReset.style.display = '';

    // Remove any injected password change section from My Profile
    const existingPwSection = document.getElementById('myProfilePasswordSection');
    if (existingPwSection) existingPwSection.remove();

    // Load roles for checkboxes (human-readable grid layout)
    if (allRoles.length === 0) await fetchRoles();
    const rolesContainer = document.getElementById('userRolesCheckboxes');
    rolesContainer.innerHTML = allRoles.map(r => {
        const info = ROLE_DESCRIPTIONS[r.RoleName] || { label: r.RoleName, icon: '&#x2699;', desc: r.Description || '' };
        return `
        <label data-rolename="${escapeHtml(r.RoleName)}">
            <input type="checkbox" name="roleId" value="${r.RoleId}" data-rolename="${escapeHtml(r.RoleName)}">
            <div class="um-role-info">
                <span class="um-role-name">${info.icon} ${escapeHtml(info.label)}</span>
                <span class="um-role-desc">${escapeHtml(info.desc)}</span>
            </div>
        </label>`;
    }).join('');

    // Full Access auto-check: when GlobalAdmin is checked, check and disable all others
    setupFullAccessAutoCheck(rolesContainer);

    const subtitle = document.getElementById('userModalSubtitle');

    if (userId) {
        title.textContent = 'Edit User';
        if (subtitle) subtitle.textContent = 'Update profile and permissions';
        saveBtn.textContent = 'Save Changes';
        pwGroup.style.display = 'none';
        activeGroup.style.display = 'block';

        // Show avatar upload in edit mode
        const avatarGroup = document.getElementById('avatarUploadGroup');
        if (avatarGroup) avatarGroup.style.display = '';

        try {
            const result = await apiGet(`/users/${userId}`);
            const user = result.data;
            document.getElementById('editUserId').value = user.UserId;
            document.getElementById('userUsername').value = user.Username;
            document.getElementById('userUsername').readOnly = true;
            document.getElementById('userFullName').value = user.FullName;
            document.getElementById('userEmail').value = user.Email;
            document.getElementById('userIsActive').checked = user.IsActive;

            // Set avatar preview
            const preview = document.getElementById('avatarPreview');
            const removeBtn = document.getElementById('removeAvatarBtn');
            const initials = user.FullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            if (preview) {
                preview.dataset.initials = initials;
                if (user.ProfileImage) {
                    preview.innerHTML = `<img src="${user.ProfileImage}" alt="${escapeHtml(user.FullName)}">`;
                    preview.dataset.imageData = user.ProfileImage;
                    if (removeBtn) removeBtn.style.display = '';
                } else {
                    preview.innerHTML = `<span>${initials}</span>`;
                    preview.dataset.imageData = '';
                    if (removeBtn) removeBtn.style.display = 'none';
                }
            }

            // Set status toggle visual state
            const statusToggle = document.getElementById('umStatusToggle');
            if (statusToggle) {
                statusToggle.querySelectorAll('.um-status-opt').forEach(b => b.classList.remove('selected-active', 'selected-inactive'));
                const activeBtn = statusToggle.querySelector(`[data-active="${user.IsActive}"]`);
                if (activeBtn) activeBtn.classList.add(user.IsActive ? 'selected-active' : 'selected-inactive');
                const help = document.getElementById('umStatusHelp');
                if (help) {
                    help.textContent = user.IsActive
                        ? 'This account is currently active and can sign in.'
                        : 'This account is deactivated. The user will not be able to sign in.';
                    help.style.color = user.IsActive ? '#94a3b8' : '#dc2626';
                }
            }

            // Check existing roles and trigger Full Access auto-check
            (user.roles || []).forEach(r => {
                const cb = rolesContainer.querySelector(`input[value="${r.RoleId}"]`);
                if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
            });
        } catch (err) {
            showNotification('Error', 'Failed to load user details', 'error');
            return;
        }
    } else {
        title.textContent = 'Create New User';
        if (subtitle) subtitle.textContent = 'Set up credentials and assign permissions';
        saveBtn.textContent = 'Create User';
        pwGroup.style.display = 'block';
        activeGroup.style.display = 'none';
        document.getElementById('userUsername').readOnly = false;
        const avatarGroupCreate = document.getElementById('avatarUploadGroup');
        if (avatarGroupCreate) avatarGroupCreate.style.display = 'none';

        // Auto-generate password
        const generatedPw = generateSecurePassword();
        const pwDisplay = document.getElementById('userPwGenerated');
        if (pwDisplay) pwDisplay.textContent = generatedPw;

        // Reset override toggle
        const overrideCb = document.getElementById('userPwOverride');
        const autoView = document.getElementById('userPwAutoView');
        const manualView = document.getElementById('userPwManualView');
        if (overrideCb) overrideCb.checked = false;
        if (autoView) autoView.style.display = '';
        if (manualView) manualView.style.display = 'none';

        // Reset email notification checkbox
        const emailCb = document.getElementById('userSendEmail');
        if (emailCb) emailCb.checked = true;
    }

    modal.classList.remove('hidden');
}

// Wire up Full Access auto-check behavior on a roles container
function setupFullAccessAutoCheck(container) {
    const globalAdminCb = container.querySelector('input[data-rolename="GlobalAdmin"]');
    if (!globalAdminCb) return;

    const otherCheckboxes = container.querySelectorAll('input[name="roleId"]:not([data-rolename="GlobalAdmin"])');

    function syncFullAccess() {
        if (globalAdminCb.checked) {
            otherCheckboxes.forEach(cb => {
                cb.checked = true;
                cb.disabled = true;
                cb.closest('label').style.opacity = '0.5';
                cb.closest('label').style.pointerEvents = 'none';
            });
        } else {
            otherCheckboxes.forEach(cb => {
                cb.checked = false;
                cb.disabled = false;
                cb.closest('label').style.opacity = '';
                cb.closest('label').style.pointerEvents = '';
            });
        }
    }

    globalAdminCb.addEventListener('change', syncFullAccess);
    // Run once on setup in case it's already checked (edit mode)
    syncFullAccess();
}

// Save user (create or update)
async function handleSaveUser(e) {
    e.preventDefault();

    const userId = document.getElementById('editUserId').value;
    const isEdit = !!userId;
    const isSelfEdit = document.getElementById('userForm').dataset.selfEdit === 'true';

    // If Full Access is checked, only send GlobalAdmin — it implies all others
    const globalAdminCb = document.querySelector('#userRolesCheckboxes input[data-rolename="GlobalAdmin"]');
    let selectedRoleIds;
    if (globalAdminCb && globalAdminCb.checked) {
        selectedRoleIds = [parseInt(globalAdminCb.value)];
    } else {
        selectedRoleIds = Array.from(
            document.querySelectorAll('#userRolesCheckboxes input[name="roleId"]:checked:not(:disabled)')
        ).map(cb => parseInt(cb.value));
    }

    // For create: determine which password to use
    const isOverride = document.getElementById('userPwOverride')?.checked;
    const autoPassword = document.getElementById('userPwGenerated')?.textContent;
    const manualPassword = document.getElementById('userPassword')?.value;

    try {
        if (isEdit) {
            const profileEndpoint = isSelfEdit ? '/users/me' : `/users/${userId}`;

            if (isSelfEdit) {
                // Self-edit: update name and email
                await apiPut('/users/me', {
                    fullName: document.getElementById('userFullName').value,
                    email: document.getElementById('userEmail').value
                });

                // Handle password change if fields are filled
                const currentPw = document.getElementById('myCurrentPassword')?.value;
                const newPw = document.getElementById('myNewPassword')?.value;
                const confirmPw = document.getElementById('myConfirmPassword')?.value;
                const pwError = document.getElementById('myProfilePwError');

                if (currentPw || newPw || confirmPw) {
                    if (!currentPw) {
                        if (pwError) { pwError.textContent = 'Current password is required to change password.'; pwError.style.display = 'block'; }
                        return;
                    }
                    if (!newPw || newPw.length < 8) {
                        if (pwError) { pwError.textContent = 'New password must be at least 8 characters.'; pwError.style.display = 'block'; }
                        return;
                    }
                    if (newPw !== confirmPw) {
                        if (pwError) { pwError.textContent = 'New passwords do not match.'; pwError.style.display = 'block'; }
                        return;
                    }

                    try {
                        await apiPut('/users/me/password', { currentPassword: currentPw, newPassword: newPw });
                        showNotification('Success', 'Password changed successfully.', 'success');
                    } catch (pwErr) {
                        if (pwError) { pwError.textContent = pwErr.message || 'Failed to change password.'; pwError.style.display = 'block'; }
                        return;
                    }
                }
            } else {
                // Admin edit: update profile + roles
                await apiPut(`/users/${userId}`, {
                    fullName: document.getElementById('userFullName').value,
                    email: document.getElementById('userEmail').value,
                    isActive: document.getElementById('userIsActive').checked
                });

                // Sync roles: get current, add missing, remove extra
                const currentResult = await apiGet(`/users/${userId}`);
                const currentRoleIds = (currentResult.data.roles || []).map(r => r.RoleId);

                for (const roleId of selectedRoleIds) {
                    if (!currentRoleIds.includes(roleId)) {
                        await apiPost(`/users/${userId}/roles`, { roleId });
                    }
                }
                for (const roleId of currentRoleIds) {
                    if (!selectedRoleIds.includes(roleId)) {
                        try {
                            await apiDelete(`/users/${userId}/roles/${roleId}`);
                        } catch (err) {
                            console.warn('Failed to remove role:', err.message);
                        }
                    }
                }
            }

            // Save avatar if changed
            const avatarPreview = document.getElementById('avatarPreview');
            if (avatarPreview) {
                const newImageData = avatarPreview.dataset.imageData;
                if (newImageData !== undefined) {
                    try {
                        await apiPut(`/users/${userId}/avatar`, { image: newImageData || null });
                    } catch (avatarErr) {
                        console.warn('Avatar save failed:', avatarErr.message);
                    }
                }
            }

            // Update header if self-edit
            if (isSelfEdit) {
                const newName = document.getElementById('userFullName').value;
                if (currentUser) {
                    currentUser.fullName = newName;
                    sessionStorage.setItem('adminUser', JSON.stringify(currentUser));
                }
                adminUser.textContent = escapeHtml(newName);
                // Refresh header avatar
                const headerAvatar = document.getElementById('headerAvatar');
                if (headerAvatar && avatarPreview?.dataset.imageData) {
                    headerAvatar.textContent = '';
                    const img = document.createElement('img');
                    img.src = avatarPreview.dataset.imageData;
                    img.alt = 'Me';
                    headerAvatar.appendChild(img);
                } else if (headerAvatar) {
                    headerAvatar.textContent = newName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                }
            }

            showNotification('Success', isSelfEdit ? 'Profile updated' : 'User updated successfully', 'success');
        } else {
            // Create mode
            const password = isOverride ? manualPassword : autoPassword;
            if (!password || password.length < 8) {
                showNotification('Error', 'Password must be at least 8 characters', 'error');
                return;
            }

            const newUsername = document.getElementById('userUsername').value;
            const newFullName = document.getElementById('userFullName').value;
            const newEmail = document.getElementById('userEmail').value;
            const sendEmail = document.getElementById('userSendEmail')?.checked;

            // Show loading overlay on the modal
            const saveBtn = document.getElementById('saveUserBtn');
            const modalContent = document.querySelector('#userModal .um-modal');
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'um-creating-overlay';
            loadingOverlay.innerHTML = '<div class="um-creating-spinner"><div class="spinner"></div><p>Creating account...</p></div>';
            if (modalContent) modalContent.appendChild(loadingOverlay);
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Creating...'; }

            try {
                await apiPost('/users', {
                    username: newUsername,
                    password,
                    fullName: newFullName,
                    email: newEmail,
                    roleIds: selectedRoleIds
                });
            } catch (createErr) {
                loadingOverlay.remove();
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Create User'; }
                throw createErr;
            }

            // Build role labels for the email preview
            const selectedRoleNames = selectedRoleIds.map(id => {
                const role = allRoles.find(r => r.RoleId === id);
                if (!role) return '';
                const info = ROLE_DESCRIPTIONS[role.RoleName];
                return info ? `${info.label} — ${info.desc}` : role.RoleName;
            }).filter(Boolean);

            // Update overlay status
            const spinnerText = loadingOverlay.querySelector('p');
            if (spinnerText) spinnerText.textContent = 'Sending welcome email...';

            // Send notification email
            const loginUrl = window.location.origin + '/admin.html';
            let emailWasSent = false;
            if (sendEmail) {
                try {
                    const emailResult = await apiPost('/notify/welcome', {
                        recipientEmail: newEmail,
                        recipientName: newFullName,
                        username: newUsername,
                        temporaryPassword: password,
                        loginUrl,
                        roles: selectedRoleNames,
                        creatorEmail: currentUser?.email || ''
                    });
                    emailWasSent = emailResult?.emailSent || false;
                } catch (emailErr) {
                    console.warn('Email notification failed:', emailErr.message);
                }
            }

            // Remove overlay and close modal
            loadingOverlay.remove();
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Create User'; }
            document.getElementById('userModal').classList.add('hidden');
            await fetchUsers();

            // Show the success modal with email preview
            showUserCreatedModal({
                fullName: newFullName,
                username: newUsername,
                email: newEmail,
                password,
                loginUrl,
                roles: selectedRoleNames,
                emailSent: emailWasSent
            });
            return; // Skip the generic close/fetch below since we already did it
        }

        document.getElementById('userModal').classList.add('hidden');
        await fetchUsers();
    } catch (err) {
        showNotification('Error', err.message || 'Failed to save user', 'error');
    }
}

// Open self-profile edit modal (any logged-in user)
async function openMyProfileModal() {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    const pwGroup = document.getElementById('userPasswordGroup');
    const activeGroup = document.getElementById('userActiveGroup');
    const saveBtn = document.getElementById('saveUserBtn');
    const subtitle = document.getElementById('userModalSubtitle');

    form.reset();

    title.textContent = 'My Profile';
    if (subtitle) subtitle.textContent = 'Update your name, email, or profile photo';
    saveBtn.textContent = 'Save Changes';
    pwGroup.style.display = 'none';
    activeGroup.style.display = 'none';

    // Hide roles section — users can't change their own roles
    const rolesContainer = document.getElementById('userRolesCheckboxes');
    const rolesFieldset = rolesContainer?.closest('fieldset');
    if (rolesFieldset) rolesFieldset.style.display = 'none';

    // Show avatar upload
    const avatarGroup = document.getElementById('avatarUploadGroup');
    if (avatarGroup) avatarGroup.style.display = '';

    try {
        const result = await apiGet('/users/me');
        const user = result.data;
        document.getElementById('editUserId').value = user.UserId;
        document.getElementById('userUsername').value = user.Username;
        document.getElementById('userUsername').readOnly = true;
        document.getElementById('userFullName').value = user.FullName;
        document.getElementById('userEmail').value = user.Email;

        // Mark this as a self-edit so handleSaveUser uses /users/me
        form.dataset.selfEdit = 'true';

        // Set avatar preview
        const preview = document.getElementById('avatarPreview');
        const removeBtn = document.getElementById('removeAvatarBtn');
        const initials = user.FullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        if (preview) {
            preview.dataset.initials = initials;
            if (user.ProfileImage) {
                preview.innerHTML = `<img src="${user.ProfileImage}" alt="Me">`;
                preview.dataset.imageData = user.ProfileImage;
                if (removeBtn) removeBtn.style.display = '';
            } else {
                preview.innerHTML = `<span>${initials}</span>`;
                preview.dataset.imageData = '';
                if (removeBtn) removeBtn.style.display = 'none';
            }
        }
    } catch (err) {
        showNotification('Error', 'Failed to load your profile', 'error');
        return;
    }

    // Inject password change section into the modal body
    const modalBody = modal.querySelector('.um-modal-body');
    const existingPwSection = document.getElementById('myProfilePasswordSection');
    if (existingPwSection) existingPwSection.remove();

    if (modalBody) {
        const pwSection = document.createElement('fieldset');
        pwSection.className = 'um-fieldset';
        pwSection.id = 'myProfilePasswordSection';
        pwSection.innerHTML = `
            <legend>Change Password</legend>
            <p class="form-help" style="margin-bottom: 12px;">Leave blank to keep your current password.</p>
            <div class="form-group">
                <label for="myCurrentPassword">Current Password</label>
                <input type="password" id="myCurrentPassword" placeholder="Enter current password" autocomplete="current-password">
            </div>
            <div class="form-group">
                <label for="myNewPassword">New Password</label>
                <input type="password" id="myNewPassword" placeholder="Minimum 8 characters" autocomplete="new-password">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label for="myConfirmPassword">Confirm New Password</label>
                <input type="password" id="myConfirmPassword" placeholder="Re-enter new password" autocomplete="new-password">
            </div>
            <div class="error-message" id="myProfilePwError" style="margin-top: 8px;"></div>
        `;
        modalBody.appendChild(pwSection);
    }

    modal.classList.remove('hidden');
}

// Show the user created success modal with email preview
function showUserCreatedModal(info) {
    const modal = document.getElementById('userCreatedModal');
    const content = document.getElementById('userCreatedContent');
    if (!modal || !content) return;

    const rolesHtml = info.roles.length > 0
        ? `<ul class="uc-roles-list">${info.roles.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
        : '<p>No specific permissions assigned.</p>';

    const emailStatusHtml = info.emailSent
        ? `<div class="uc-email-sent">&#x2709; Email notifications have been queued for ${escapeHtml(info.email)} and yourself.</div>`
        : `<div class="uc-email-fallback">&#x26A0; Email not configured. Please share the login details below with the user manually.</div>`;

    content.innerHTML = `
        ${emailStatusHtml}
        <div class="uc-email-preview" id="welcomeEmailContent">
            <h4>Welcome to the CAT Bootcamp Feedback System</h4>
            <p>Hello ${escapeHtml(info.fullName)},</p>
            <p>An account has been created for you. Here are your login details:</p>
            <hr>
            <div class="uc-field">
                <span class="uc-field-label">Login URL:</span>
                <span class="uc-field-value">${escapeHtml(info.loginUrl)}</span>
            </div>
            <div class="uc-field">
                <span class="uc-field-label">Username:</span>
                <span class="uc-field-value">${escapeHtml(info.username)}</span>
            </div>
            <div class="uc-field">
                <span class="uc-field-label">Password:</span>
                <span class="uc-pw-value">${escapeHtml(info.password)}</span>
            </div>
            <p style="color: #c2410c; font-weight: 600; font-size: 0.82rem; margin-top: 10px;">You will be required to change your password on first login.</p>
            <hr>
            <p><strong>Your permissions:</strong></p>
            ${rolesHtml}
            <hr>
            <p style="font-size: 0.8rem; color: #94a3b8;">This is an automated message from the CAT Bootcamp Feedback System.</p>
        </div>
    `;

    modal.classList.remove('hidden');
}

// Delete user
async function handleDeleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    try {
        await apiDelete(`/users/${userId}`);
        showNotification('Success', 'User deleted successfully', 'success');
        await fetchUsers();
    } catch (err) {
        showNotification('Error', err.message || 'Failed to delete user', 'error');
    }
}

// Reset user password
async function handleResetPassword(userId, username) {
    if (!confirm(`Reset password for ${username}? A temporary password will be generated.`)) return;

    try {
        const result = await apiPost(`/users/${userId}/reset-password`, {});
        const modal = document.getElementById('resetPasswordModal');
        document.getElementById('resetPasswordUsername').textContent = result.data.username;
        document.getElementById('tempPasswordDisplay').textContent = result.data.temporaryPassword;
        modal.classList.remove('hidden');
    } catch (err) {
        showNotification('Error', err.message || 'Failed to reset password', 'error');
    }
}

// Manage user event access — redesigned for scalability
async function openUserEventAccessModal(userId) {
    const modal = document.getElementById('userEventAccessModal');
    const content = document.getElementById('userEventAccessContent');
    const title = document.getElementById('userEventAccessTitle');

    content.innerHTML = '<div class="um-loading"><div class="spinner"></div><span>Loading...</span></div>';
    modal.classList.remove('hidden');

    try {
        const [userResult, eventsResult] = await Promise.all([
            apiGet(`/users/${userId}`),
            apiGet('/events')
        ]);

        const user = userResult.data;
        const allEventsData = eventsResult.data || [];
        const userRoleNames = (user.roles || []).map(r => r.RoleName || r.roleName);
        const isGlobalAdmin = userRoleNames.includes('GlobalAdmin');

        title.textContent = `Event Access for ${escapeHtml(user.FullName)}`;

        // GlobalAdmin gets automatic access to everything — show a message, not checkboxes
        if (isGlobalAdmin) {
            content.innerHTML = `
                <div class="ea-global-notice">
                    <div class="ea-global-icon">&#x2605;</div>
                    <h4>Full Access — All Events</h4>
                    <p>${escapeHtml(user.FullName)} has the <strong>Full Access</strong> role, which automatically grants access to every event in the system. No manual event assignments are needed.</p>
                </div>
            `;
            return;
        }

        const grantedEventIds = new Set((user.events || []).map(e => e.EventId));

        // Build the scalable UI with search + two sections
        function renderEventAccessUI(searchTerm = '') {
            const term = searchTerm.toLowerCase();
            const granted = allEventsData.filter(e => grantedEventIds.has(e.eventId));
            const available = allEventsData.filter(e => !grantedEventIds.has(e.eventId));

            const filteredGranted = term ? granted.filter(e =>
                e.eventName.toLowerCase().includes(term) || e.eventCode.toLowerCase().includes(term)
            ) : granted;
            const filteredAvailable = term ? available.filter(e =>
                e.eventName.toLowerCase().includes(term) || e.eventCode.toLowerCase().includes(term)
            ) : available;

            function eventRow(e, isGranted) {
                return `
                    <div class="ea-item ${isGranted ? 'ea-item-granted' : ''}">
                        <label class="ea-check-label">
                            <input type="checkbox" class="ea-checkbox" data-event-id="${e.eventId}" data-section="${isGranted ? 'granted' : 'available'}">
                            <div class="ea-item-info">
                                <span class="ea-item-name">${escapeHtml(e.eventName)}</span>
                                <span class="ea-item-code">${escapeHtml(e.eventCode)}</span>
                            </div>
                        </label>
                    </div>`;
            }

            content.innerHTML = `
                <div class="ea-search-wrap">
                    <input type="text" class="ea-search" id="eventAccessSearch" placeholder="Search events..." value="${escapeHtml(searchTerm)}">
                </div>

                <div class="ea-section">
                    <div class="ea-section-header">
                        <label class="ea-select-all-label">
                            <input type="checkbox" id="eaSelectAllGranted" class="ea-checkbox-all" data-section="granted">
                            <span class="ea-section-title ea-granted-title">&#x2705; Has Access</span>
                        </label>
                        <div class="ea-section-actions">
                            <span class="ea-count">${granted.length} event${granted.length !== 1 ? 's' : ''}</span>
                            <button class="ea-btn ea-btn-remove ea-bulk-btn" id="eaBulkRemove" disabled>Remove Selected</button>
                        </div>
                    </div>
                    ${filteredGranted.length === 0
                        ? `<p class="ea-empty">${term ? 'No matching events.' : 'No events granted yet. Select events below and click Grant.'}</p>`
                        : `<div class="ea-list" id="eaGrantedList">${filteredGranted.map(e => eventRow(e, true)).join('')}</div>`
                    }
                </div>

                <div class="ea-section">
                    <div class="ea-section-header">
                        <label class="ea-select-all-label">
                            <input type="checkbox" id="eaSelectAllAvailable" class="ea-checkbox-all" data-section="available">
                            <span class="ea-section-title">Available Events</span>
                        </label>
                        <div class="ea-section-actions">
                            <span class="ea-count">${available.length} event${available.length !== 1 ? 's' : ''}</span>
                            <button class="ea-btn ea-btn-add ea-bulk-btn" id="eaBulkGrant" disabled>Grant Selected</button>
                        </div>
                    </div>
                    ${filteredAvailable.length === 0
                        ? `<p class="ea-empty">${term ? 'No matching events.' : 'All events have been granted.'}</p>`
                        : `<div class="ea-list" id="eaAvailableList">${filteredAvailable.map(e => eventRow(e, false)).join('')}</div>`
                    }
                </div>
            `;

            // ── Wire up interactions ──

            const searchInput = document.getElementById('eventAccessSearch');
            const bulkGrantBtn = document.getElementById('eaBulkGrant');
            const bulkRemoveBtn = document.getElementById('eaBulkRemove');

            // Search
            if (searchInput) {
                searchInput.addEventListener('input', debounce(() => {
                    renderEventAccessUI(searchInput.value);
                }, 200));
                searchInput.focus();
                searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
            }

            // Update bulk button state when checkboxes change
            function updateBulkButtons() {
                const checkedGranted = content.querySelectorAll('.ea-checkbox[data-section="granted"]:checked');
                const checkedAvailable = content.querySelectorAll('.ea-checkbox[data-section="available"]:checked');
                if (bulkRemoveBtn) bulkRemoveBtn.disabled = checkedGranted.length === 0;
                if (bulkGrantBtn) bulkGrantBtn.disabled = checkedAvailable.length === 0;
                // Update button text with count
                if (bulkRemoveBtn && checkedGranted.length > 0) bulkRemoveBtn.textContent = `Remove ${checkedGranted.length} Selected`;
                else if (bulkRemoveBtn) bulkRemoveBtn.textContent = 'Remove Selected';
                if (bulkGrantBtn && checkedAvailable.length > 0) bulkGrantBtn.textContent = `Grant ${checkedAvailable.length} Selected`;
                else if (bulkGrantBtn) bulkGrantBtn.textContent = 'Grant Selected';
            }

            // Individual checkboxes
            content.querySelectorAll('.ea-checkbox').forEach(cb => {
                cb.addEventListener('change', updateBulkButtons);
            });

            // Select-all checkboxes
            content.querySelectorAll('.ea-checkbox-all').forEach(allCb => {
                allCb.addEventListener('change', () => {
                    const section = allCb.dataset.section;
                    content.querySelectorAll(`.ea-checkbox[data-section="${section}"]`).forEach(cb => {
                        cb.checked = allCb.checked;
                    });
                    updateBulkButtons();
                });
            });

            // Bulk Grant
            if (bulkGrantBtn) {
                bulkGrantBtn.addEventListener('click', async () => {
                    const checked = Array.from(content.querySelectorAll('.ea-checkbox[data-section="available"]:checked'));
                    if (checked.length === 0) return;
                    bulkGrantBtn.disabled = true;
                    bulkGrantBtn.textContent = `Granting ${checked.length}...`;
                    let successCount = 0;
                    for (const cb of checked) {
                        const eventId = parseInt(cb.dataset.eventId);
                        try {
                            await apiPost(`/users/${userId}/events`, { eventId });
                            grantedEventIds.add(eventId);
                            successCount++;
                        } catch (err) { /* continue with others */ }
                    }
                    if (successCount > 0) showNotification('Success', `Granted access to ${successCount} event${successCount > 1 ? 's' : ''}.`, 'success');
                    renderEventAccessUI(searchInput ? searchInput.value : '');
                });
            }

            // Bulk Remove
            if (bulkRemoveBtn) {
                bulkRemoveBtn.addEventListener('click', async () => {
                    const checked = Array.from(content.querySelectorAll('.ea-checkbox[data-section="granted"]:checked'));
                    if (checked.length === 0) return;
                    if (!confirm(`Remove access to ${checked.length} event${checked.length > 1 ? 's' : ''}?`)) return;
                    bulkRemoveBtn.disabled = true;
                    bulkRemoveBtn.textContent = `Removing ${checked.length}...`;
                    let successCount = 0;
                    for (const cb of checked) {
                        const eventId = parseInt(cb.dataset.eventId);
                        try {
                            await apiDelete(`/users/${userId}/events/${eventId}`);
                            grantedEventIds.delete(eventId);
                            successCount++;
                        } catch (err) { /* continue with others */ }
                    }
                    if (successCount > 0) showNotification('Success', `Removed access to ${successCount} event${successCount > 1 ? 's' : ''}.`, 'success');
                    renderEventAccessUI(searchInput ? searchInput.value : '');
                });
            }
        }

        renderEventAccessUI();

    } catch (err) {
        content.innerHTML = `<p class="error-message">Failed to load event access: ${escapeHtml(err.message)}</p>`;
    }
}

// Handle change own password
async function handleChangeOwnPassword(e) {
    e.preventDefault();
    const errorEl = document.getElementById('changePasswordError');
    errorEl.textContent = '';

    const currentPw = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmNewPassword').value;

    if (newPw !== confirmPw) {
        errorEl.textContent = 'New passwords do not match.';
        return;
    }
    if (newPw.length < 8) {
        errorEl.textContent = 'New password must be at least 8 characters.';
        return;
    }

    try {
        await apiPut('/users/me/password', { currentPassword: currentPw, newPassword: newPw });
        document.getElementById('changePasswordModal').classList.add('hidden');
        showNotification('Success', 'Password changed successfully.', 'success');

        // If this was a forced change, now show the main content
        if (currentUser && currentUser.mustChangePassword) {
            currentUser.mustChangePassword = false;
            sessionStorage.setItem('adminUser', JSON.stringify(currentUser));
            showMainContent();
        }
    } catch (err) {
        errorEl.textContent = err.message || 'Failed to change password.';
    }
}

// User management event listeners (setup)
function setupUserManagementListeners() {
    // Create user button
    const createUserBtn = document.getElementById('createUserBtn');
    if (createUserBtn) createUserBtn.addEventListener('click', () => openUserModal());

    // User modal close/cancel
    const closeUserModal = document.getElementById('closeUserModal');
    if (closeUserModal) closeUserModal.addEventListener('click', () => document.getElementById('userModal').classList.add('hidden'));
    const cancelUserBtn = document.getElementById('cancelUserBtn');
    if (cancelUserBtn) cancelUserBtn.addEventListener('click', () => document.getElementById('userModal').classList.add('hidden'));

    // User form submit
    const userForm = document.getElementById('userForm');
    if (userForm) userForm.addEventListener('submit', handleSaveUser);

    // User search
    const userSearch = document.getElementById('userSearch');
    if (userSearch) userSearch.addEventListener('input', debounce(() => {
        const activeFilter = document.querySelector('.um-pill.active');
        const roleFilter = activeFilter ? activeFilter.dataset.role : 'all';
        renderUsers(userSearch.value, roleFilter);
    }, 300));

    // Role filter pills
    const filterContainer = document.getElementById('userRoleFilter');
    if (filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            const pill = e.target.closest('.um-pill');
            if (!pill) return;
            filterContainer.querySelectorAll('.um-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const search = document.getElementById('userSearch');
            renderUsers(search ? search.value : '', pill.dataset.role);
        });
    }

    // User event access modal close
    const closeAccessModal = document.getElementById('closeUserEventAccessModal');
    if (closeAccessModal) closeAccessModal.addEventListener('click', () => document.getElementById('userEventAccessModal').classList.add('hidden'));

    // Change password modal (used only for forced password change on login)
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) changePasswordForm.addEventListener('submit', handleChangeOwnPassword);

    const cancelChangePwBtn = document.getElementById('cancelChangePasswordBtn');
    if (cancelChangePwBtn) cancelChangePwBtn.addEventListener('click', () => document.getElementById('changePasswordModal').classList.add('hidden'));
    const closeChangePwModal = document.getElementById('closeChangePasswordModal');
    if (closeChangePwModal) closeChangePwModal.addEventListener('click', () => document.getElementById('changePasswordModal').classList.add('hidden'));

    // Reset password modal close
    const closeResetPwModal = document.getElementById('closeResetPasswordModal');
    if (closeResetPwModal) closeResetPwModal.addEventListener('click', () => document.getElementById('resetPasswordModal').classList.add('hidden'));
    const closeResetPwBtn = document.getElementById('closeResetPasswordBtn');
    if (closeResetPwBtn) closeResetPwBtn.addEventListener('click', () => document.getElementById('resetPasswordModal').classList.add('hidden'));

    // "My Profile" button in header — opens self-edit modal
    const myProfileBtn = document.getElementById('myProfileBtn');
    if (myProfileBtn) {
        myProfileBtn.addEventListener('click', () => openMyProfileModal());
    }

    // Avatar upload handler
    const avatarFileInput = document.getElementById('avatarFileInput');
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 500 * 1024) {
                showNotification('Error', 'Image is too large. Maximum size is 500KB.', 'error');
                avatarFileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                // Create a canvas to crop to square
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const size = Math.min(img.width, img.height);
                    canvas.width = 200;
                    canvas.height = 200;
                    const ctx = canvas.getContext('2d');
                    // Crop center square
                    const sx = (img.width - size) / 2;
                    const sy = (img.height - size) / 2;
                    ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                    // Show preview
                    const preview = document.getElementById('avatarPreview');
                    preview.innerHTML = `<img src="${dataUrl}" alt="Preview">`;
                    preview.dataset.imageData = dataUrl;

                    // Show remove button
                    const removeBtn = document.getElementById('removeAvatarBtn');
                    if (removeBtn) removeBtn.style.display = '';
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Remove avatar button
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', () => {
            const preview = document.getElementById('avatarPreview');
            const initials = preview.dataset.initials || '?';
            preview.innerHTML = `<span>${initials}</span>`;
            preview.dataset.imageData = '';
            removeAvatarBtn.style.display = 'none';
            if (avatarFileInput) avatarFileInput.value = '';
        });
    }

    // Password override toggle
    const pwOverrideCb = document.getElementById('userPwOverride');
    if (pwOverrideCb) {
        pwOverrideCb.addEventListener('change', () => {
            const autoView = document.getElementById('userPwAutoView');
            const manualView = document.getElementById('userPwManualView');
            if (autoView) autoView.style.display = pwOverrideCb.checked ? 'none' : '';
            if (manualView) manualView.style.display = pwOverrideCb.checked ? '' : 'none';
        });
    }

    // Regenerate password button
    const regenBtn = document.getElementById('userPwRegenBtn');
    if (regenBtn) {
        regenBtn.addEventListener('click', () => {
            const display = document.getElementById('userPwGenerated');
            if (display) display.textContent = generateSecurePassword();
        });
    }

    // User created modal close
    const closeCreatedModal = document.getElementById('closeUserCreatedModal');
    if (closeCreatedModal) closeCreatedModal.addEventListener('click', () => document.getElementById('userCreatedModal').classList.add('hidden'));
    const closeCreatedBtn = document.getElementById('closeUserCreatedBtn');
    if (closeCreatedBtn) closeCreatedBtn.addEventListener('click', () => document.getElementById('userCreatedModal').classList.add('hidden'));

    // Copy welcome email content
    const copyWelcomeBtn = document.getElementById('copyWelcomeEmailBtn');
    if (copyWelcomeBtn) {
        copyWelcomeBtn.addEventListener('click', () => {
            const content = document.getElementById('welcomeEmailContent');
            if (!content) return;
            // Copy as plain text
            const text = content.innerText;
            navigator.clipboard.writeText(text).then(() => {
                copyWelcomeBtn.textContent = 'Copied!';
                setTimeout(() => { copyWelcomeBtn.textContent = 'Copy Email Content'; }, 2000);
            }).catch(() => {
                const range = document.createRange();
                range.selectNodeContents(content);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
                document.execCommand('copy');
                copyWelcomeBtn.textContent = 'Copied!';
                setTimeout(() => { copyWelcomeBtn.textContent = 'Copy Email Content'; }, 2000);
            });
        });
    }

    // Forgot password/username view switching
    const showForgotPwBtn = document.getElementById('showForgotPassword');
    const showForgotUnBtn = document.getElementById('showForgotUsername');
    const backToLoginFromPw = document.getElementById('backToLoginFromPw');
    const backToLoginFromUn = document.getElementById('backToLoginFromUn');
    const loginFormView = document.getElementById('loginFormView');
    const forgotPwView = document.getElementById('forgotPasswordView');
    const forgotUnView = document.getElementById('forgotUsernameView');

    function showView(view) {
        if (loginFormView) loginFormView.style.display = 'none';
        if (forgotPwView) forgotPwView.style.display = 'none';
        if (forgotUnView) forgotUnView.style.display = 'none';
        if (view) view.style.display = '';
    }

    if (showForgotPwBtn) showForgotPwBtn.addEventListener('click', () => showView(forgotPwView));
    if (showForgotUnBtn) showForgotUnBtn.addEventListener('click', () => showView(forgotUnView));
    if (backToLoginFromPw) backToLoginFromPw.addEventListener('click', () => showView(loginFormView));
    if (backToLoginFromUn) backToLoginFromUn.addEventListener('click', () => showView(loginFormView));

    // Forgot password form submission
    const forgotPwForm = document.getElementById('forgotPasswordForm');
    if (forgotPwForm) forgotPwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('forgotPasswordMessage');
        const email = document.getElementById('resetEmail').value;
        msg.className = 'login-message';
        msg.style.display = 'none';
        try {
            const result = await apiPost('/password-reset/request', { email });
            msg.textContent = result.message || 'If an account with that email exists, a password reset has been initiated. Please contact your administrator.';
            msg.className = 'login-message success';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = err.message || 'Something went wrong. Please try again.';
            msg.className = 'login-message error';
            msg.style.display = 'block';
        }
    });

    // Forgot username form submission
    const forgotUnForm = document.getElementById('forgotUsernameForm');
    if (forgotUnForm) forgotUnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('forgotUsernameMessage');
        const email = document.getElementById('usernameRecoveryEmail').value;
        msg.className = 'login-message';
        msg.style.display = 'none';
        try {
            const result = await apiPost('/username-recovery', { email });
            msg.textContent = result.message || 'If an account with that email exists, your username has been sent. Please contact your administrator.';
            msg.className = 'login-message success';
            msg.style.display = 'block';
        } catch (err) {
            msg.textContent = err.message || 'Something went wrong. Please try again.';
            msg.className = 'login-message error';
            msg.style.display = 'block';
        }
    });

    // Account status toggle buttons
    const statusToggle = document.getElementById('umStatusToggle');
    if (statusToggle) {
        statusToggle.querySelectorAll('.um-status-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const isActive = btn.dataset.active === 'true';
                const checkbox = document.getElementById('userIsActive');
                checkbox.checked = isActive;
                // Update visuals
                statusToggle.querySelectorAll('.um-status-opt').forEach(b => {
                    b.classList.remove('selected-active', 'selected-inactive');
                });
                btn.classList.add(isActive ? 'selected-active' : 'selected-inactive');
                // Update help text
                const help = document.getElementById('umStatusHelp');
                if (help) {
                    help.textContent = isActive
                        ? 'This account is currently active and can sign in.'
                        : 'This account is deactivated. The user will not be able to sign in.';
                    help.style.color = isActive ? '#94a3b8' : '#dc2626';
                }
            });
        });
    }

    // Copy temp password button
    const copyTempPwBtn = document.getElementById('copyTempPwBtn');
    if (copyTempPwBtn) copyTempPwBtn.addEventListener('click', () => {
        const pw = document.getElementById('tempPasswordDisplay').textContent;
        navigator.clipboard.writeText(pw).then(() => {
            copyTempPwBtn.textContent = 'Copied!';
            copyTempPwBtn.classList.add('copied');
            setTimeout(() => {
                copyTempPwBtn.textContent = 'Copy';
                copyTempPwBtn.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            const range = document.createRange();
            range.selectNodeContents(document.getElementById('tempPasswordDisplay'));
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            copyTempPwBtn.textContent = 'Copied!';
            setTimeout(() => { copyTempPwBtn.textContent = 'Copy'; }, 2000);
        });
    });

    // Delegate clicks for user action buttons
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const userId = parseInt(target.dataset.userId);
        if (isNaN(userId)) return;

        if (target.classList.contains('btn-edit-user')) {
            openUserModal(userId);
        } else if (target.classList.contains('btn-delete-user')) {
            handleDeleteUser(userId);
        } else if (target.classList.contains('btn-reset-pw')) {
            handleResetPassword(userId, target.dataset.username);
        } else if (target.classList.contains('btn-manage-access')) {
            openUserEventAccessModal(userId);
        }
    });
}

// Initialize user management listeners
setupUserManagementListeners();

// Load users if the user has permission (after a short delay to allow DOM setup)
setTimeout(async () => {
    if (isAllowed('MANAGE_USERS') && !CONFIG.USE_MOCK_DATA) {
        await fetchUsers();
    }
}, 1500);

// ========================================================================
// AUDIT LOG
// ========================================================================

let auditCurrentPage = 1;
let auditFilters = {};
let auditFilterOptions = { actions: [], resourceTypes: [], usernames: [] };

async function fetchAuditLog(page = 1) {
    if (!isAllowed('DELETE_EVENTS')) return; // Only GlobalAdmin (DELETE_EVENTS is GlobalAdmin-only)
    if (CONFIG.USE_MOCK_DATA) return;

    const tbody = document.getElementById('alTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="al-loading">Loading...</td></tr>';

    try {
        const params = new URLSearchParams({ page, pageSize: 50 });
        if (auditFilters.search) params.set('search', auditFilters.search);
        if (auditFilters.action) params.set('action', auditFilters.action);
        if (auditFilters.resourceType) params.set('resourceType', auditFilters.resourceType);
        if (auditFilters.username) params.set('username', auditFilters.username);
        if (auditFilters.dateFrom) params.set('dateFrom', auditFilters.dateFrom);
        if (auditFilters.dateTo) params.set('dateTo', auditFilters.dateTo);

        const result = await apiGet(`/audit-log?${params.toString()}`);
        const { logs, pagination, filters } = result.data;

        auditCurrentPage = pagination.page;
        auditFilterOptions = filters;

        renderAuditLog(logs);
        renderAuditPagination(pagination);
        populateAuditFilterDropdowns(filters);
    } catch (err) {
        console.error('Failed to fetch audit log:', err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="al-loading">Failed to load audit log.</td></tr>';
    }
}

function relativeTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
}

function actionBadgeClass(action) {
    const key = action.toLowerCase().replace(/ /g, '_');
    return `al-action-${key}`;
}

function renderAuditLog(logs) {
    const tbody = document.getElementById('alTableBody');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="al-loading">No audit entries match your filters.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const badgeClass = actionBadgeClass(log.Action);
        const detailsJson = log.Details ? JSON.stringify(log.Details, null, 2) : null;
        const detailsHtml = log.Details ? Object.entries(log.Details).map(([k, v]) =>
            `<div class="al-detail-row"><span class="al-detail-key">${escapeHtml(k)}</span><span class="al-detail-val">${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span></div>`
        ).join('') : '<span class="al-detail-empty">No additional details recorded.</span>';

        return `
            <tr class="al-row-clickable" data-log-id="${log.AuditLogId}">
                <td>
                    <span class="al-time">${formatDateTime(log.Timestamp)}</span>
                    <span class="al-time-relative">${relativeTime(log.Timestamp)}</span>
                </td>
                <td><span class="al-user">${escapeHtml(log.Username)}</span></td>
                <td><span class="al-action-badge ${badgeClass} al-action-default">${escapeHtml(log.Action)}</span></td>
                <td>
                    <span class="al-resource-type">${escapeHtml(log.ResourceType)}</span>
                    ${log.ResourceId ? `<span class="al-resource"> #${escapeHtml(log.ResourceId)}</span>` : ''}
                </td>
                <td><span class="al-summary">${escapeHtml(log.Summary)}</span></td>
                <td><span class="al-ip">${escapeHtml(log.IpAddress || '')}</span></td>
            </tr>
            <tr class="al-detail-row-container" id="al-detail-${log.AuditLogId}" style="display: none;">
                <td colspan="6">
                    <div class="al-detail-panel">
                        <div class="al-detail-grid">
                            <div class="al-detail-section">
                                <h4>Event Details</h4>
                                <div class="al-detail-row"><span class="al-detail-key">Log ID</span><span class="al-detail-val">${log.AuditLogId}</span></div>
                                <div class="al-detail-row"><span class="al-detail-key">Timestamp</span><span class="al-detail-val">${log.Timestamp}</span></div>
                                <div class="al-detail-row"><span class="al-detail-key">User</span><span class="al-detail-val">${escapeHtml(log.Username)} (UserId: ${log.UserId})</span></div>
                                <div class="al-detail-row"><span class="al-detail-key">Action</span><span class="al-detail-val">${escapeHtml(log.Action)}</span></div>
                                <div class="al-detail-row"><span class="al-detail-key">Resource</span><span class="al-detail-val">${escapeHtml(log.ResourceType)}${log.ResourceId ? ' #' + escapeHtml(log.ResourceId) : ''}</span></div>
                                <div class="al-detail-row"><span class="al-detail-key">IP Address</span><span class="al-detail-val">${escapeHtml(log.IpAddress || 'Not recorded')}</span></div>
                            </div>
                            <div class="al-detail-section">
                                <h4>Action Data</h4>
                                ${detailsHtml}
                            </div>
                        </div>
                        ${detailsJson ? `<details class="al-raw-details"><summary>Raw JSON</summary><pre>${escapeHtml(detailsJson)}</pre></details>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Click to expand/collapse detail rows
    tbody.querySelectorAll('.al-row-clickable').forEach(row => {
        row.addEventListener('click', () => {
            const logId = row.dataset.logId;
            const detailRow = document.getElementById(`al-detail-${logId}`);
            if (detailRow) {
                const isVisible = detailRow.style.display !== 'none';
                // Collapse all others
                tbody.querySelectorAll('.al-detail-row-container').forEach(r => r.style.display = 'none');
                tbody.querySelectorAll('.al-row-clickable').forEach(r => r.classList.remove('al-row-expanded'));
                if (!isVisible) {
                    detailRow.style.display = '';
                    row.classList.add('al-row-expanded');
                }
            }
        });
    });
}

function renderAuditPagination(pagination) {
    const container = document.getElementById('alPagination');
    if (!container) return;

    const { page, totalPages, total, pageSize } = pagination;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    let pageButtons = '';
    if (totalPages > 1) {
        pageButtons += `<button class="al-page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">&larr; Prev</button>`;

        // Show at most 7 page buttons
        let startPage = Math.max(1, page - 3);
        let endPage = Math.min(totalPages, startPage + 6);
        if (endPage - startPage < 6) startPage = Math.max(1, endPage - 6);

        for (let p = startPage; p <= endPage; p++) {
            pageButtons += `<button class="al-page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }

        pageButtons += `<button class="al-page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">Next &rarr;</button>`;
    }

    container.innerHTML = `
        <span class="al-page-info">${total > 0 ? `Showing ${from}–${to} of ${total} entries` : 'No entries'}</span>
        <div class="al-page-buttons">${pageButtons}</div>
    `;

    container.querySelectorAll('.al-page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = parseInt(btn.dataset.page);
            if (!isNaN(p) && p >= 1 && p <= totalPages) fetchAuditLog(p);
        });
    });
}

function populateAuditFilterDropdowns(filters) {
    const actionSelect = document.getElementById('alFilterAction');
    const resourceSelect = document.getElementById('alFilterResource');
    const userSelect = document.getElementById('alFilterUser');

    if (actionSelect && actionSelect.options.length <= 1) {
        filters.actions.forEach(a => {
            actionSelect.add(new Option(a, a));
        });
    }
    if (resourceSelect && resourceSelect.options.length <= 1) {
        filters.resourceTypes.forEach(r => {
            resourceSelect.add(new Option(r, r));
        });
    }
    if (userSelect && userSelect.options.length <= 1) {
        filters.usernames.forEach(u => {
            userSelect.add(new Option(u, u));
        });
    }
}

function exportAuditLogCSV() {
    // Fetch all matching results (no pagination) for export
    const params = new URLSearchParams({ page: 1, pageSize: 10000 });
    if (auditFilters.search) params.set('search', auditFilters.search);
    if (auditFilters.action) params.set('action', auditFilters.action);
    if (auditFilters.resourceType) params.set('resourceType', auditFilters.resourceType);
    if (auditFilters.username) params.set('username', auditFilters.username);
    if (auditFilters.dateFrom) params.set('dateFrom', auditFilters.dateFrom);
    if (auditFilters.dateTo) params.set('dateTo', auditFilters.dateTo);

    apiGet(`/audit-log?${params.toString()}`).then(result => {
        const logs = result.data.logs;
        const headers = ['Timestamp', 'Username', 'Action', 'ResourceType', 'ResourceId', 'Summary', 'IP Address', 'Details'];
        const rows = logs.map(l => [
            l.Timestamp,
            l.Username,
            l.Action,
            l.ResourceType,
            l.ResourceId || '',
            `"${(l.Summary || '').replace(/"/g, '""')}"`,
            l.IpAddress || '',
            l.Details ? `"${JSON.stringify(l.Details).replace(/"/g, '""')}"` : ''
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }).catch(err => {
        showNotification('Error', 'Failed to export audit log', 'error');
    });
}

// Setup audit log event listeners
function setupAuditLogListeners() {
    const searchInput = document.getElementById('alSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            auditFilters.search = searchInput.value;
            fetchAuditLog(1);
        }, 300));
    }

    ['alFilterAction', 'alFilterResource', 'alFilterUser'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (id === 'alFilterAction') auditFilters.action = el.value;
            if (id === 'alFilterResource') auditFilters.resourceType = el.value;
            if (id === 'alFilterUser') auditFilters.username = el.value;
            fetchAuditLog(1);
        });
    });

    const dateFrom = document.getElementById('alFilterDateFrom');
    const dateTo = document.getElementById('alFilterDateTo');
    if (dateFrom) dateFrom.addEventListener('change', () => { auditFilters.dateFrom = dateFrom.value; fetchAuditLog(1); });
    if (dateTo) dateTo.addEventListener('change', () => { auditFilters.dateTo = dateTo.value; fetchAuditLog(1); });

    const exportBtn = document.getElementById('alExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportAuditLogCSV);
}

setupAuditLogListeners();

// ====================================
// SPEAKERS MANAGEMENT
// ====================================

async function fetchSpeakers() {
    const result = await apiGet('/speakers');
    return result.data || result || [];
}

async function loadSpeakers() {
    try {
        const speakers = await fetchSpeakers();
        allSpeakers = speakers;
        renderSpeakers(speakers);
    } catch (error) {
        console.error('Error loading speakers:', error);
    }
}

function renderSpeakers(speakers) {
    const list = document.getElementById('speakersList');
    if (!list) return;

    if (!speakers || speakers.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎤</div>
                <p>No speakers found. Create your first speaker to get started.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = speakers.map(speaker => {
        const initials = (speaker.speakerName || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const avatarContent = speaker.profileImage
            ? `<img src="${speaker.profileImage}" alt="${escapeHtml(speaker.speakerName)}">`
            : initials;

        return `
        <div class="speaker-card" data-speaker-id="${speaker.speakerId}">
            <input type="checkbox" class="speaker-checkbox" data-speaker-id="${speaker.speakerId}" style="cursor: pointer; width: 18px; height: 18px; margin-top: 3px;">
            <div class="speaker-avatar">${avatarContent}</div>
            <div class="speaker-info">
                <div class="speaker-name">${escapeHtml(speaker.speakerName)}</div>
                ${speaker.bio ? `<div class="speaker-bio">${escapeHtml(speaker.bio)}</div>` : ''}
                <div class="speaker-meta">
                    <span>📅 ${speaker.eventCount || 0} event${speaker.eventCount === 1 ? '' : 's'}</span>
                    <span class="status-badge ${speaker.isActive ? 'active' : 'inactive'}">${speaker.isActive ? 'Active' : 'Inactive'}</span>
                </div>
            </div>
            <div class="speaker-actions">
                ${isAllowed('MANAGE_SPEAKERS') ? `
                <button class="btn btn-secondary btn-sm btn-edit-speaker-record" data-speaker-id="${speaker.speakerId}">✏️ Edit</button>
                <button class="btn btn-danger btn-sm btn-delete-speaker-record" data-speaker-id="${speaker.speakerId}">🗑️</button>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');

    // Add click handlers for edit/delete buttons via delegation
    list.querySelectorAll('.btn-edit-speaker-record').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openSpeakerModal(parseInt(btn.dataset.speakerId)); });
    });
    list.querySelectorAll('.btn-delete-speaker-record').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); deleteSpeaker(parseInt(btn.dataset.speakerId)); });
    });

    // Click on speaker card opens detail view (but not on buttons/checkboxes)
    list.querySelectorAll('.speaker-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input[type="checkbox"]')) return;
            viewSpeakerDetails(parseInt(card.dataset.speakerId));
        });
    });

    updateSpeakerBulkDeleteVisibility();
}

async function viewSpeakerDetails(speakerId) {
    const speaker = allSpeakers.find(s => s.speakerId === speakerId);
    if (!speaker) {
        showNotification('Error', 'Speaker not found', 'error');
        return;
    }

    // Show a loading modal immediately
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'speakerDetailsModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>${escapeHtml(speaker.speakerName)}</h2>
                <button class="modal-close" id="closeSpeakerDetailsBtn">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <div class="loading-state"><div class="spinner"></div><p>Loading speaker history...</p></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    document.getElementById('closeSpeakerDetailsBtn').addEventListener('click', closeSpeakerDetailsModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeSpeakerDetailsModal(); });

    try {
        const result = await apiGet(`/speakers/${speakerId}/events`);
        const data = result.data || result;
        const speakerInfo = data.speaker || speaker;
        const events = data.events || [];

        const initials = (speakerInfo.speakerName || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const avatarHtml = speakerInfo.profileImage
            ? `<img src="${speakerInfo.profileImage}" alt="${escapeHtml(speakerInfo.speakerName)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
            : `<span style="font-size:2rem;font-weight:600;color:white;">${initials}</span>`;

        const body = modal.querySelector('.modal-body');
        body.innerHTML = `
            <div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #eee;">
                <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                    ${avatarHtml}
                </div>
                <div style="flex:1;">
                    <h3 style="margin:0 0 6px 0;font-size:1.3rem;">${escapeHtml(speakerInfo.speakerName)}</h3>
                    ${speakerInfo.bio ? `<p style="color:#666;margin:0 0 8px 0;line-height:1.5;">${escapeHtml(speakerInfo.bio)}</p>` : ''}
                    <div style="display:flex;gap:15px;font-size:0.9rem;color:#888;">
                        <span>📅 ${data.totalEvents || 0} event${data.totalEvents === 1 ? '' : 's'}</span>
                        <span>📚 ${data.totalModules || 0} module delivery${data.totalModules === 1 ? '' : 'ies'}</span>
                        <span class="status-badge ${speakerInfo.isActive ? 'active' : 'inactive'}">${speakerInfo.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                </div>
            </div>

            <div style="display:flex;justify-content:flex-end;margin-bottom:15px;">
                <button class="btn btn-primary btn-sm" id="viewSpeakerFeedbackBtn">💬 View All Feedback</button>
            </div>

            ${events.length > 0 ? `
                <h4 style="margin:0 0 12px 0;color:#333;">Event History</h4>
                ${events.map(event => `
                    <div style="border:1px solid #e0e0e0;border-radius:8px;padding:15px;margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                            <div>
                                <div style="font-weight:600;color:#333;">${escapeHtml(event.eventCode)}</div>
                                <div style="font-size:0.85rem;color:#888;">${formatDate(event.startDate)}${event.trainingTrack ? ` | ${escapeHtml(event.trainingTrack)}` : ''}</div>
                            </div>
                            <span class="status-badge ${event.isActive ? 'active' : 'inactive'}" style="font-size:0.75rem;">${event.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div style="background:#f8f9fa;border-radius:6px;padding:10px;">
                            ${event.modules.map(mod => `
                                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;${event.modules.indexOf(mod) < event.modules.length - 1 ? 'border-bottom:1px solid #eee;' : ''}">
                                    <div>
                                        <span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:#667eea;color:white;font-size:0.75rem;text-align:center;line-height:24px;margin-right:8px;">${mod.deliveryOrder}</span>
                                        <span style="font-weight:500;">${escapeHtml(mod.moduleName)}</span>
                                    </div>
                                    <div style="display:flex;gap:12px;font-size:0.85rem;color:#888;">
                                        <span>💬 ${mod.feedbackCount}</span>
                                        ${mod.avgSpeakerRating ? `<span>⭐ ${mod.avgSpeakerRating}</span>` : ''}
                                        ${mod.avgModuleSatisfaction ? `<span>👍 ${mod.avgModuleSatisfaction}</span>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            ` : `
                <div class="empty-state" style="padding:30px;text-align:center;">
                    <div class="empty-state-icon">📅</div>
                    <p>This speaker hasn't been assigned to any events yet.</p>
                </div>
            `}
        `;

        // "View All Feedback" button navigates to feedback tab filtered by speaker
        document.getElementById('viewSpeakerFeedbackBtn').addEventListener('click', () => {
            closeSpeakerDetailsModal();
            switchTab('feedback');
            const filterSpeakerEl = document.getElementById('filterSpeaker');
            if (filterSpeakerEl) {
                filterSpeakerEl.value = speakerInfo.speakerName;
                filterAndSortFeedback();
            }
        });

    } catch (err) {
        console.error('Error loading speaker details:', err);
        const body = modal.querySelector('.modal-body');
        body.innerHTML = `<div class="empty-state" style="padding:30px;text-align:center;"><p>Error loading speaker details. Please try again.</p></div>`;
    }
}

function closeSpeakerDetailsModal() {
    const modal = document.getElementById('speakerDetailsModal');
    if (modal) modal.remove();
}

function filterSpeakers() {
    const search = document.getElementById('speakerSearch').value.toLowerCase();
    const filtered = allSpeakers.filter(s =>
        s.speakerName.toLowerCase().includes(search) ||
        (s.bio && s.bio.toLowerCase().includes(search))
    );
    renderSpeakers(filtered);
}

function openSpeakerModal(speakerId = null) {
    currentEditingSpeakerId = speakerId;
    const modal = document.getElementById('speakerModal');
    const title = document.getElementById('speakerModalTitle');
    const form = document.getElementById('speakerForm');
    form.reset();

    const preview = document.getElementById('speakerAvatarPreview');
    const removeBtn = document.getElementById('removeSpeakerAvatar');

    if (speakerId) {
        title.textContent = 'Edit Speaker';
        const speaker = allSpeakers.find(s => s.speakerId === speakerId);
        if (speaker) {
            document.getElementById('speakerName').value = speaker.speakerName;
            document.getElementById('speakerBio').value = speaker.bio || '';
            document.getElementById('speakerIsActive').checked = speaker.isActive;
            if (speaker.profileImage) {
                preview.innerHTML = `<img src="${speaker.profileImage}" alt="Preview">`;
                preview.dataset.imageData = speaker.profileImage;
                if (removeBtn) removeBtn.style.display = '';
            } else {
                const initials = (speaker.speakerName || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                preview.innerHTML = `<span>${initials}</span>`;
                preview.dataset.imageData = '';
                if (removeBtn) removeBtn.style.display = 'none';
            }
        }
    } else {
        title.textContent = 'Create New Speaker';
        preview.innerHTML = `<span id="speakerAvatarInitials"></span>`;
        preview.dataset.imageData = '';
        if (removeBtn) removeBtn.style.display = 'none';
    }

    modal.classList.remove('hidden');
}

function closeSpeakerModal() {
    document.getElementById('speakerModal').classList.add('hidden');
    currentEditingSpeakerId = null;
}

async function handleSaveSpeaker(e) {
    e.preventDefault();

    const name = document.getElementById('speakerName').value.trim();
    const bio = document.getElementById('speakerBio').value.trim();
    const isActive = document.getElementById('speakerIsActive').checked;
    const preview = document.getElementById('speakerAvatarPreview');
    const profileImage = preview.dataset.imageData || null;

    if (!name || name.length < 2) {
        showNotification('Error', 'Speaker name must be at least 2 characters', 'error');
        return;
    }

    try {
        const payload = { speakerName: name, bio: bio || null, profileImage, isActive };
        let result;

        if (currentEditingSpeakerId) {
            result = await apiPut(`/speakers/${currentEditingSpeakerId}`, payload);
        } else {
            result = await apiPost('/speakers', payload);
        }

        if (result.success !== false) {
            closeSpeakerModal();
            await loadSpeakers();
            // Also refresh speaker dropdowns
            populateSpeakerDropdowns();
            showNotification('Success', currentEditingSpeakerId ? 'Speaker updated!' : 'Speaker created!', 'success');
        } else {
            showNotification('Error', result.message || 'Error saving speaker', 'error');
        }
    } catch (error) {
        console.error('Error saving speaker:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

async function deleteSpeaker(speakerId) {
    const speaker = allSpeakers.find(s => s.speakerId === speakerId);
    if (!confirm(`Are you sure you want to delete speaker "${speaker?.speakerName || 'Unknown'}"?`)) return;

    try {
        const result = await apiDelete(`/speakers/${speakerId}`);
        if (result.success) {
            await loadSpeakers();
            populateSpeakerDropdowns();
            showNotification('Success', 'Speaker deleted', 'success');
        } else {
            showNotification('Error', result.message || 'Error deleting speaker', 'error');
        }
    } catch (error) {
        console.error('Error deleting speaker:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

async function handleBulkDeleteSpeakers() {
    const checked = document.querySelectorAll('.speaker-checkbox:checked');
    const ids = Array.from(checked).map(cb => parseInt(cb.dataset.speakerId));
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} speaker(s)?`)) return;

    try {
        const result = await apiPost('/speakers/bulk-delete', { speakerIds: ids });
        if (result.success) {
            await loadSpeakers();
            populateSpeakerDropdowns();
            showNotification('Success', result.message, 'success');
        } else {
            showNotification('Error', result.message || 'Error deleting speakers', 'error');
        }
    } catch (error) {
        console.error('Error bulk deleting speakers:', error);
        showNotification('Error', 'Error deleting speakers', 'error');
    }
}

function toggleAllSpeakers(e) {
    document.querySelectorAll('.speaker-checkbox').forEach(cb => { cb.checked = e.target.checked; });
    updateSpeakerBulkDeleteVisibility();
}

function updateSpeakerBulkDeleteVisibility() {
    const checked = document.querySelectorAll('.speaker-checkbox:checked');
    const btn = document.getElementById('deleteSpeakersBtn');
    if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
    // Also listen for individual checkbox changes
    document.querySelectorAll('.speaker-checkbox').forEach(cb => {
        cb.removeEventListener('change', updateSpeakerBulkDeleteVisibility);
        cb.addEventListener('change', updateSpeakerBulkDeleteVisibility);
    });
}

function setupSpeakerAvatarUpload() {
    const fileInput = document.getElementById('speakerAvatarInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 500 * 1024) {
                showNotification('Error', 'Image is too large. Maximum size is 500KB.', 'error');
                fileInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const size = Math.min(img.width, img.height);
                    canvas.width = 200;
                    canvas.height = 200;
                    const ctx = canvas.getContext('2d');
                    const sx = (img.width - size) / 2;
                    const sy = (img.height - size) / 2;
                    ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    const preview = document.getElementById('speakerAvatarPreview');
                    preview.innerHTML = `<img src="${dataUrl}" alt="Preview">`;
                    preview.dataset.imageData = dataUrl;
                    const removeBtn = document.getElementById('removeSpeakerAvatar');
                    if (removeBtn) removeBtn.style.display = '';
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }
    const removeBtn = document.getElementById('removeSpeakerAvatar');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            const preview = document.getElementById('speakerAvatarPreview');
            preview.innerHTML = `<span></span>`;
            preview.dataset.imageData = '';
            removeBtn.style.display = 'none';
            if (fileInput) fileInput.value = '';
        });
    }
}

// Populate speaker dropdowns (used in add module modal, edit speaker modal)
function populateSpeakerDropdowns() {
    const activeSpeakers = allSpeakers.filter(s => s.isActive);
    const options = '<option value="">-- Select a Speaker --</option>' +
        activeSpeakers.map(s => `<option value="${s.speakerId}">${escapeHtml(s.speakerName)}</option>`).join('');

    const addModuleSelect = document.getElementById('speakerIdForModule');
    if (addModuleSelect) addModuleSelect.innerHTML = options;

    const editSpeakerSelect = document.getElementById('editSpeakerId');
    if (editSpeakerSelect) editSpeakerSelect.innerHTML = options;
}

// Override the openAddModuleModal to populate speaker dropdown
const originalOpenAddModuleModal = typeof openAddModuleModal === 'function' ? openAddModuleModal : null;

// ====================================
// TEMPLATES MANAGEMENT
// ====================================

async function fetchTemplates() {
    const result = await apiGet('/templates');
    return result.data || result || [];
}

async function loadTemplates() {
    try {
        const templates = await fetchTemplates();
        allTemplates = templates;
        renderTemplates(templates);
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

function renderTemplates(templates) {
    const list = document.getElementById('templatesList');
    if (!list) return;

    if (!templates || templates.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>No templates found. Create a template to quickly set up recurring events.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = templates.map(template => {
        const modulesList = (template.modules || [])
            .sort((a, b) => a.deliveryOrder - b.deliveryOrder)
            .map(m => `<li>${escapeHtml(m.moduleName)}</li>`).join('');

        return `
        <div class="template-card" data-template-id="${template.templateId}">
            <div class="template-card-header">
                <div class="template-name">${escapeHtml(template.templateName)}</div>
                <span class="status-badge ${template.isActive ? 'active' : 'inactive'}">${template.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            ${template.description ? `<div class="template-description">${escapeHtml(template.description)}</div>` : ''}
            <div class="template-meta">
                <span>📚 ${template.moduleCount || 0} module${template.moduleCount === 1 ? '' : 's'}</span>
                ${template.trainingTrack ? `<span>🎓 ${escapeHtml(template.trainingTrack)}</span>` : ''}
                <span>📅 ${formatDate(template.createdAt)}</span>
            </div>
            ${(template.modules || []).length > 0 ? `
            <div class="template-modules-preview">
                <h5>Modules:</h5>
                <ol>${modulesList}</ol>
            </div>
            ` : ''}
            <div class="template-actions">
                ${isAllowed('CREATE_EVENTS') ? `
                <button class="btn btn-primary btn-sm btn-use-template" data-template-id="${template.templateId}">📅 Create Event</button>
                ` : ''}
                ${isAllowed('MANAGE_TEMPLATES') ? `
                <button class="btn btn-secondary btn-sm btn-edit-template" data-template-id="${template.templateId}">✏️ Edit</button>
                <button class="btn btn-danger btn-sm btn-delete-template" data-template-id="${template.templateId}">🗑️</button>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');

    // Event listeners via delegation
    list.querySelectorAll('.btn-edit-template').forEach(btn => {
        btn.addEventListener('click', () => openTemplateModal(parseInt(btn.dataset.templateId)));
    });
    list.querySelectorAll('.btn-delete-template').forEach(btn => {
        btn.addEventListener('click', () => deleteTemplate(parseInt(btn.dataset.templateId)));
    });
    list.querySelectorAll('.btn-use-template').forEach(btn => {
        btn.addEventListener('click', () => handleCreateEventFromTemplate(parseInt(btn.dataset.templateId)));
    });
}

function filterTemplates() {
    const search = document.getElementById('templateSearch').value.toLowerCase();
    const filtered = allTemplates.filter(t =>
        t.templateName.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search)) ||
        (t.trainingTrack && t.trainingTrack.toLowerCase().includes(search))
    );
    renderTemplates(filtered);
}

function openTemplateModal(templateId = null) {
    currentEditingTemplateId = templateId;
    const modal = document.getElementById('templateModal');
    const title = document.getElementById('templateModalTitle');
    const form = document.getElementById('templateForm');
    form.reset();
    templateModulesList = [];

    // Populate module dropdown
    const select = document.getElementById('templateModuleSelect');
    if (select) {
        const activeModules = allModules.filter(m => m.isActive);
        select.innerHTML = '<option value="">-- Select a Module --</option>' +
            activeModules.map(m => `<option value="${m.moduleId}">${escapeHtml(m.moduleName)}</option>`).join('');
    }

    if (templateId) {
        title.textContent = 'Edit Template';
        const template = allTemplates.find(t => t.templateId === templateId);
        if (template) {
            document.getElementById('templateName').value = template.templateName;
            document.getElementById('templateDescription').value = template.description || '';
            document.getElementById('templateTrainingTrack').value = template.trainingTrack || '';
            templateModulesList = (template.modules || []).map(m => ({
                moduleId: m.moduleId,
                moduleName: m.moduleName,
                deliveryOrder: m.deliveryOrder,
                notes: m.notes
            })).sort((a, b) => a.deliveryOrder - b.deliveryOrder);
        }
    } else {
        title.textContent = 'Create New Template';
    }

    renderTemplateModulesBuilder();
    modal.classList.remove('hidden');
}

function closeTemplateModal() {
    document.getElementById('templateModal').classList.add('hidden');
    currentEditingTemplateId = null;
    templateModulesList = [];
}

function addModuleToTemplate() {
    const select = document.getElementById('templateModuleSelect');
    const moduleId = parseInt(select.value);
    if (!moduleId) {
        showNotification('Error', 'Please select a module', 'error');
        return;
    }

    // Check for duplicates
    if (templateModulesList.some(m => m.moduleId === moduleId)) {
        showNotification('Error', 'This module is already in the template', 'error');
        return;
    }

    const module = allModules.find(m => m.moduleId === moduleId);
    templateModulesList.push({
        moduleId,
        moduleName: module ? module.moduleName : `Module ${moduleId}`,
        deliveryOrder: templateModulesList.length + 1,
        notes: null
    });

    select.value = '';
    renderTemplateModulesBuilder();
}

function renderTemplateModulesBuilder() {
    const container = document.getElementById('templateModulesList');
    if (!container) return;

    if (templateModulesList.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding: 20px; text-align: center; color: #888;">No modules added yet. Select a module above and click "Add".</div>`;
        return;
    }

    container.innerHTML = templateModulesList.map((mod, index) => `
        <div class="template-module-item" data-index="${index}">
            <div class="template-module-order">${index + 1}</div>
            <div class="template-module-name">${escapeHtml(mod.moduleName)}</div>
            <div class="template-module-actions">
                <button type="button" onclick="moveTemplateModule(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" onclick="moveTemplateModule(${index}, 1)" ${index === templateModulesList.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" onclick="removeTemplateModule(${index})" style="color: #e74c3c;">✕</button>
            </div>
        </div>
    `).join('');
}

window.moveTemplateModule = function(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= templateModulesList.length) return;
    const temp = templateModulesList[index];
    templateModulesList[index] = templateModulesList[newIndex];
    templateModulesList[newIndex] = temp;
    // Update delivery orders
    templateModulesList.forEach((m, i) => m.deliveryOrder = i + 1);
    renderTemplateModulesBuilder();
};

window.removeTemplateModule = function(index) {
    templateModulesList.splice(index, 1);
    templateModulesList.forEach((m, i) => m.deliveryOrder = i + 1);
    renderTemplateModulesBuilder();
};

async function handleSaveTemplate(e) {
    e.preventDefault();

    const name = document.getElementById('templateName').value.trim();
    const description = document.getElementById('templateDescription').value.trim();
    const trainingTrack = document.getElementById('templateTrainingTrack').value.trim();

    if (!name || name.length < 3) {
        showNotification('Error', 'Template name must be at least 3 characters', 'error');
        return;
    }

    const modules = templateModulesList.map((m, i) => ({
        moduleId: m.moduleId,
        deliveryOrder: i + 1,
        notes: m.notes || null
    }));

    try {
        const payload = { templateName: name, description: description || null, trainingTrack: trainingTrack || null, isActive: true, modules };
        let result;

        if (currentEditingTemplateId) {
            result = await apiPut(`/templates/${currentEditingTemplateId}`, payload);
        } else {
            result = await apiPost('/templates', payload);
        }

        if (result.success !== false) {
            closeTemplateModal();
            await loadTemplates();
            showNotification('Success', currentEditingTemplateId ? 'Template updated!' : 'Template created!', 'success');
        } else {
            showNotification('Error', result.message || 'Error saving template', 'error');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

async function deleteTemplate(templateId) {
    const template = allTemplates.find(t => t.templateId === templateId);
    if (!confirm(`Delete template "${template?.templateName || 'Unknown'}"?`)) return;

    try {
        const result = await apiDelete(`/templates/${templateId}`);
        if (result.success) {
            await loadTemplates();
            showNotification('Success', 'Template deleted', 'success');
        } else {
            showNotification('Error', result.message || 'Error deleting template', 'error');
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        showNotification('Error', 'Error deleting template', 'error');
    }
}

// ====================================
// CREATE TEMPLATE FROM EVENT
// ====================================

function openEventPickerModal() {
    const modal = document.getElementById('eventPickerModal');
    const list = document.getElementById('eventPickerList');
    document.getElementById('templateFromEventName').value = '';
    document.getElementById('templateFromEventDesc').value = '';
    document.getElementById('eventPickerSearch').value = '';
    renderEventPickerList(allEvents);
    modal.classList.remove('hidden');
}

function closeEventPickerModal() {
    document.getElementById('eventPickerModal').classList.add('hidden');
}

function filterEventPicker() {
    const search = document.getElementById('eventPickerSearch').value.toLowerCase();
    const filtered = allEvents.filter(e =>
        e.eventCode.toLowerCase().includes(search) ||
        (e.eventName && e.eventName.toLowerCase().includes(search)) ||
        (e.trainingTrack && e.trainingTrack.toLowerCase().includes(search))
    );
    renderEventPickerList(filtered);
}

function renderEventPickerList(events) {
    const list = document.getElementById('eventPickerList');
    if (!events || events.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: #888;">No events found.</div>';
        return;
    }

    list.innerHTML = events.map(event => `
        <div class="event-picker-item" data-event-id="${event.eventId}">
            <div class="event-picker-name">${escapeHtml(event.eventCode)}</div>
            <div class="event-picker-meta">
                ${formatDate(event.startDate)} | ${(event.modules || []).length} module${(event.modules || []).length === 1 ? '' : 's'}
                ${event.trainingTrack ? ` | ${escapeHtml(event.trainingTrack)}` : ''}
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.event-picker-item').forEach(item => {
        item.addEventListener('click', () => handlePickEventForTemplate(parseInt(item.dataset.eventId)));
    });
}

async function handlePickEventForTemplate(eventId) {
    const templateName = document.getElementById('templateFromEventName').value.trim();
    const description = document.getElementById('templateFromEventDesc').value.trim();

    if (!templateName || templateName.length < 3) {
        showNotification('Error', 'Please enter a template name (at least 3 characters) before selecting an event', 'error');
        return;
    }

    try {
        const result = await apiPost('/templates/from-event', {
            eventId,
            templateName,
            description: description || null
        });

        if (result.success !== false) {
            closeEventPickerModal();
            await loadTemplates();
            showNotification('Success', 'Template created from event!', 'success');
        } else {
            showNotification('Error', result.message || 'Error creating template', 'error');
        }
    } catch (error) {
        console.error('Error creating template from event:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

// ====================================
// SAVE EVENT AS TEMPLATE
// ====================================

function openSaveAsTemplateModal(eventId, eventName) {
    const modal = document.getElementById('saveAsTemplateModal');
    const info = document.getElementById('saveAsTemplateEventInfo');
    const nameInput = document.getElementById('saveAsTemplateName');
    const descInput = document.getElementById('saveAsTemplateDesc');

    info.textContent = `Creating a template from event: ${eventName}`;
    nameInput.value = `${eventName} Template`;
    descInput.value = '';
    modal.dataset.eventId = eventId;
    modal.classList.remove('hidden');
}

function closeSaveAsTemplateModal() {
    document.getElementById('saveAsTemplateModal').classList.add('hidden');
}

async function handleSaveAsTemplate(e) {
    e.preventDefault();
    const modal = document.getElementById('saveAsTemplateModal');
    const eventId = parseInt(modal.dataset.eventId);
    const templateName = document.getElementById('saveAsTemplateName').value.trim();
    const description = document.getElementById('saveAsTemplateDesc').value.trim();

    if (!templateName || templateName.length < 3) {
        showNotification('Error', 'Template name must be at least 3 characters', 'error');
        return;
    }

    try {
        const result = await apiPost('/templates/from-event', {
            eventId,
            templateName,
            description: description || null
        });

        if (result.success !== false) {
            closeSaveAsTemplateModal();
            await loadTemplates();
            showNotification('Success', 'Template created from event!', 'success');
        } else {
            showNotification('Error', result.message || 'Error creating template', 'error');
        }
    } catch (error) {
        console.error('Error saving as template:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

// ====================================
// CREATE EVENT FROM TEMPLATE
// ====================================

function openTemplateSelectionModal() {
    const modal = document.getElementById('templateSelectionModal');
    document.getElementById('templateSelectionSearch').value = '';
    renderTemplateSelectionList(allTemplates.filter(t => t.isActive));
    modal.classList.remove('hidden');
}

function closeTemplateSelectionModal() {
    document.getElementById('templateSelectionModal').classList.add('hidden');
}

function filterTemplateSelection() {
    const search = document.getElementById('templateSelectionSearch').value.toLowerCase();
    const filtered = allTemplates.filter(t => t.isActive && (
        t.templateName.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search))
    ));
    renderTemplateSelectionList(filtered);
}

function renderTemplateSelectionList(templates) {
    const list = document.getElementById('templateSelectionList');
    if (!templates || templates.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: #888;">No templates available.</div>';
        return;
    }

    list.innerHTML = templates.map(t => {
        const moduleNames = (t.modules || []).sort((a, b) => a.deliveryOrder - b.deliveryOrder).map(m => escapeHtml(m.moduleName)).join(', ');
        return `
        <div class="template-selection-item" data-template-id="${t.templateId}">
            <div class="template-selection-name">${escapeHtml(t.templateName)}</div>
            <div class="template-selection-meta">
                ${t.moduleCount || 0} module${t.moduleCount === 1 ? '' : 's'}
                ${t.trainingTrack ? ` | ${escapeHtml(t.trainingTrack)}` : ''}
            </div>
            ${moduleNames ? `<div style="font-size: 0.8rem; color: #888; margin-top: 4px;">Modules: ${moduleNames}</div>` : ''}
        </div>
        `;
    }).join('');

    list.querySelectorAll('.template-selection-item').forEach(item => {
        item.addEventListener('click', () => handleCreateEventFromTemplate(parseInt(item.dataset.templateId)));
    });
}

function handleCreateEventFromTemplate(templateId) {
    const template = allTemplates.find(t => t.templateId === templateId);
    if (!template) return;

    // Close the selection modal if open
    closeTemplateSelectionModal();

    // Open the event creation modal
    openEventModal();

    // Pre-fill training track from template
    const trackInput = document.getElementById('trainingTrack');
    if (trackInput && template.trainingTrack) {
        trackInput.value = template.trainingTrack;
    }

    // Store template info for when the event is saved
    const form = document.getElementById('eventForm');
    form.dataset.templateId = templateId;

    // Show the modules section with template modules and speaker dropdowns
    const modulesSection = document.getElementById('eventModulesSection');
    if (modulesSection) {
        modulesSection.style.display = '';
        const modulesList = document.getElementById('eventModulesList');
        if (modulesList) {
            populateSpeakerDropdowns(); // Ensure speakers are loaded
            const templateModules = (template.modules || []).sort((a, b) => a.deliveryOrder - b.deliveryOrder);

            const activeSpeakers = allSpeakers.filter(s => s.isActive);
            const speakerOptions = '<option value="">-- Select --</option>' +
                activeSpeakers.map(s => `<option value="${s.speakerId}">${escapeHtml(s.speakerName)}</option>`).join('');

            modulesList.innerHTML = `
                <div style="margin-bottom: 10px; padding: 10px; background: #e8f4fd; border-radius: 6px; font-size: 0.9em; color: #333;">
                    <strong>Template: ${escapeHtml(template.templateName)}</strong> — Assign a speaker to each module below.
                </div>
                ${templateModules.map(mod => `
                <div class="template-event-module-row" data-module-id="${mod.moduleId}" data-delivery-order="${mod.deliveryOrder}">
                    <div class="template-event-module-order">${mod.deliveryOrder}</div>
                    <div class="template-event-module-name">${escapeHtml(mod.moduleName)}</div>
                    <div class="template-event-module-speaker">
                        <select class="template-speaker-select" data-module-id="${mod.moduleId}" required>
                            ${speakerOptions}
                        </select>
                    </div>
                </div>
                `).join('')}
            `;
        }
    }

    // Override the form submit to use the from-template endpoint
    form.onsubmit = async function(e) {
        e.preventDefault();
        await handleSaveEventFromTemplate(templateId);
    };
}

async function handleSaveEventFromTemplate(templateId) {
    const eventName = document.getElementById('eventName').value.trim();
    const eventCode = document.getElementById('eventCode').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const trainingTrack = document.getElementById('trainingTrack').value.trim();
    const isActive = document.getElementById('eventIsActive').checked;

    if (!eventName || !eventCode || !startDate) {
        showNotification('Error', 'Event name, code, and start date are required', 'error');
        return;
    }

    // Gather speaker assignments
    const speakerSelects = document.querySelectorAll('.template-speaker-select');
    const modules = [];
    let allAssigned = true;

    speakerSelects.forEach(select => {
        const moduleId = parseInt(select.dataset.moduleId);
        const speakerId = parseInt(select.value);
        const row = select.closest('.template-event-module-row');
        const deliveryOrder = parseInt(row.dataset.deliveryOrder);

        if (!speakerId) {
            allAssigned = false;
        }

        modules.push({ moduleId, speakerId, deliveryOrder });
    });

    if (!allAssigned) {
        showNotification('Error', 'Please assign a speaker to every module', 'error');
        return;
    }

    try {
        const result = await apiPost('/events/from-template', {
            templateId,
            eventName,
            eventCode,
            startDate,
            endDate: endDate || null,
            trainingTrack: trainingTrack || null,
            isActive,
            modules
        });

        if (result.success !== false) {
            closeEventModal();
            // Restore normal form submit
            const form = document.getElementById('eventForm');
            delete form.dataset.templateId;
            form.onsubmit = null;
            document.getElementById('eventForm').addEventListener('submit', handleSaveEvent);

            await loadEvents();
            await loadModules();
            showNotification('Success', 'Event created from template!', 'success');
        } else {
            showNotification('Error', result.message || 'Error creating event', 'error');
        }
    } catch (error) {
        console.error('Error creating event from template:', error);
        const friendlyError = getUserFriendlyErrorMessage(error);
        showNotification('Error', friendlyError.message, 'error');
    }
}

// Helper: populate speaker dropdowns whenever speaker data is available
// Call this after loading speakers and when opening add-module modal
function ensureSpeakerDropdownsPopulated() {
    if (allSpeakers.length > 0) {
        populateSpeakerDropdowns();
    }
}

console.log('Admin Panel Loaded');
console.log('Using Mock Data:', CONFIG.USE_MOCK_DATA);
