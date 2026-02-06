/**
 * Shared utilities for Azure Functions
 */

const NodeCache = require('node-cache');

// Cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300 });

/**
 * Create HTTP response
 */
function createResponse(statusCode, body, headers = {}) {
    return {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
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
    const pattern = /^CS[A-Z0-9]{6}$/;
    return pattern.test(code);
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
    cacheSet
};
