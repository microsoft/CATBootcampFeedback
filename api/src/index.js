/**
 * Azure Functions V4 Index
 * This file imports all function definitions.
 * Every new function file MUST be added here to be deployed.
 */

// Core
require('./functions/health');
require('./functions/login');

// Modules
require('./functions/modules');
require('./functions/update-module');

// Events
require('./functions/events');
require('./functions/update-event');
require('./functions/update-event-status');
require('./functions/event-modules');

// Speakers
require('./functions/speakers');
require('./functions/update-speaker');

// Templates
require('./functions/templates');
require('./functions/update-template');

// Create Event from Template
require('./functions/create-event-from-template');

// Feedback
require('./functions/feedback');

// User Management & RBAC
require('./functions/users');
require('./functions/password');
require('./functions/notifications');

// Audit Log
require('./functions/audit-log');
