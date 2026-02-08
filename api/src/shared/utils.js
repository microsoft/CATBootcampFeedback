/**
 * Shared utilities for Azure Functions
 */

const NodeCache = require('node-cache');

// Cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300 });

/**
 * Security headers for all API responses
 * Protects against XSS, clickjacking, MIME sniffing, and other attacks
 */
const SECURITY_HEADERS = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.azurestaticapps.net https://*.azurewebsites.net; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

/**
 * Create HTTP response with security headers
 */
function createResponse(statusCode, body, headers = {}) {
    return {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            ...SECURITY_HEADERS,
            ...headers
        },
        body: JSON.stringify(body)
    };
}

/**
 * Success response
 */
function success(data, message = 'Success') {
    return createResponse(200, { success: true, message, data });
}

/**
 * Error response
 */
function error(statusCode, message, code = 'ERROR') {
    return createResponse(statusCode, {
        error: {
            code,
            message,
            statusCode,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Validate event code format
 */
function validateEventCode(code) {
    if (!code || typeof code !== 'string') return false;
    const trimmed = code.trim();
    return trimmed.length >= 3 && trimmed.length <= 50;
}

/**
 * Validate feedback data
 */
function validateFeedbackData(data) {
    const errors = [];

    if (!data.eventCode || !validateEventCode(data.eventCode)) {
        errors.push('Invalid event code');
    }

    if (!data.speakerKnowledge || data.speakerKnowledge < 1 || data.speakerKnowledge > 5) {
        errors.push('Speaker knowledge must be between 1 and 5');
    }

    const validDepths = ['Too Technical', 'Just Right', 'Too Low Level'];
    if (!data.contentDepth || !validDepths.includes(data.contentDepth)) {
        errors.push('Invalid content depth value');
    }

    if (!data.moduleSatisfaction || data.moduleSatisfaction < 1 || data.moduleSatisfaction > 5) {
        errors.push('Module satisfaction must be between 1 and 5');
    }

    if (data.additionalComments && data.additionalComments.length > 1000) {
        errors.push('Comments must be less than 1000 characters');
    }

    return errors;
}

/**
 * Sanitize input text
 */
function sanitize(input) {
    if (!input || typeof input !== 'string') return '';

    return input
        .trim()
        .substring(0, 1000)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Get client IP address
 */
function getClientIP(request) {
    return request.headers['x-forwarded-for'] ||
           request.headers['x-real-ip'] ||
           'unknown';
}

/**
 * Rate limiting check (simple in-memory)
 */
const rateLimitStore = new Map();

function checkRateLimit(key, maxAttempts = 5, windowMs = 3600000) {
    const now = Date.now();
    const attempts = rateLimitStore.get(key) || [];

    // Remove old attempts
    const validAttempts = attempts.filter(time => now - time < windowMs);

    if (validAttempts.length >= maxAttempts) {
        const oldestAttempt = Math.min(...validAttempts);
        const retryAfter = Math.ceil((windowMs - (now - oldestAttempt)) / 1000);
        return { allowed: false, retryAfter };
    }

    validAttempts.push(now);
    rateLimitStore.set(key, validAttempts);

    return { allowed: true };
}

/**
 * Cache get/set helpers
 */
function cacheGet(key) {
    return cache.get(key);
}

function cacheSet(key, value, ttl = 300) {
    return cache.set(key, value, ttl);
}

/**
 * Add security headers to Azure Functions v4 response object
 * Usage: return addSecurityHeaders({ status: 200, jsonBody: {...} })
 */
function addSecurityHeaders(response) {
    return {
        ...response,
        headers: {
            ...SECURITY_HEADERS,
            ...(response.headers || {})
        }
    };
}

module.exports = {
    createResponse,
    success,
    error,
    validateEventCode,
    validateFeedbackData,
    sanitize,
    getClientIP,
    checkRateLimit,
    cacheGet,
    cacheSet,
    addSecurityHeaders,
    SECURITY_HEADERS
};
