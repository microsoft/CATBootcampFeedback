/**
 * Central configuration file for the Feedback Application
 * All constants and configuration values should be defined here
 */

export const CONFIG = {
    // API Configuration
    API_BASE_URL: '/api',
    USE_MOCK_DATA: true,  // Set to false for production

    // Timeouts & Intervals
    API_TIMEOUT: 30000,                 // 30 seconds
    MOCK_API_DELAY: 1000,               // 1 second
    COUNT_REFRESH_INTERVAL: 5000,       // 5 seconds
    AUTO_LOGOUT_TIMEOUT: 28800000,      // 8 hours
    LOADING_MIN_DISPLAY_TIME: 500,      // 0.5 seconds

    // Validation Rules
    COMMENTS_MAX_LENGTH: 1000,
    EVENT_CODE_LENGTH: 8,
    EVENT_CODE_PREFIX: 'CS',
    EVENT_CODE_PATTERN: /^CS[A-Z0-9]{6}$/,
    SPEAKER_NAME_MIN_LENGTH: 2,
    SPEAKER_NAME_MAX_LENGTH: 100,
    MODULE_NAME_MIN_LENGTH: 5,
    MODULE_NAME_MAX_LENGTH: 200,

    // Rate Limiting (client-side)
    MAX_SUBMISSIONS_PER_EVENT: 0,       // 0 = unlimited (no limit for events with many participants)
    SUBMISSION_COOLDOWN_MS: 3600000,    // Not used when MAX_SUBMISSIONS_PER_EVENT = 0
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_COOLDOWN_MS: 300000,          // 5 minutes

    // QR Code Settings
    QR_CODE_SIZE: 300,
    QR_CODE_MARGIN: 2,
    QR_CODE_ERROR_CORRECTION: 'M',
    QR_CODE_COLOR_DARK: '#667eea',
    QR_CODE_COLOR_LIGHT: '#ffffff',

    // Display & Animation
    COUNT_ANIMATION_DURATION: 1000,     // 1 second
    TOAST_DURATION: 5000,               // 5 seconds
    MODAL_ANIMATION_DURATION: 300,      // 0.3 seconds

    // Cache Settings
    EVENT_CACHE_TTL: 300000,            // 5 minutes
    FEEDBACK_CACHE_TTL: 60000,          // 1 minute

    // Retry Settings
    MAX_RETRIES: 3,
    RETRY_BASE_DELAY: 1000,             // 1 second
    RETRY_MAX_DELAY: 10000,             // 10 seconds

    // Error Codes
    ERROR_CODES: {
        INVALID_EVENT_CODE: 'INVALID_EVENT_CODE',
        EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
        EVENT_INACTIVE: 'EVENT_INACTIVE',
        RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
        NETWORK_ERROR: 'NETWORK_ERROR',
        SERVER_ERROR: 'SERVER_ERROR',
        INVALID_DATA: 'INVALID_DATA',
        AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
        UNAUTHORIZED: 'UNAUTHORIZED',
        CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID'
    },

    // Feature Flags
    FEATURES: {
        ENABLE_OFFLINE_SUPPORT: false,
        ENABLE_TELEMETRY: true,
        ENABLE_PERFORMANCE_MONITORING: true,
        ENABLE_CSRF_PROTECTION: true,
        ENABLE_CLIENT_RATE_LIMITING: true
    }
};

// Environment-specific overrides
if (typeof window !== 'undefined') {
    // Auto-detect Azure environment
    const isAzure = window.location.hostname.includes('azurestaticapps.net') ||
                    window.location.hostname.includes('azurewebsites.net');

    // Check if running in production (not localhost)
    const isProduction = window.location.hostname !== 'localhost' &&
                        window.location.hostname !== '127.0.0.1';

    if (isProduction || isAzure) {
        CONFIG.USE_MOCK_DATA = false;
        CONFIG.API_BASE_URL = '/api'; // Relative path for Azure Static Web Apps
    }

    console.log('Environment detected:', {
        hostname: window.location.hostname,
        isAzure,
        isProduction,
        useMockData: CONFIG.USE_MOCK_DATA,
        apiBaseUrl: CONFIG.API_BASE_URL
    });
}

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.ERROR_CODES);
Object.freeze(CONFIG.FEATURES);
