/**
 * Rate Limiting Middleware for Azure Functions
 *
 * Provides in-memory rate limiting to protect against:
 * - Brute force attacks on login endpoints
 * - API abuse and spam
 * - DDoS attacks
 */

// In-memory store for rate limiting
// Note: This is per-instance. For production scale, consider Redis or Azure Cache
const requestCounts = new Map();

// Cleanup interval to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.resetTime > data.windowMs) {
            requestCounts.delete(key);
        }
    }
}, 60000); // Cleanup every minute

/**
 * Rate limiter configuration
 */
const RATE_LIMITS = {
    // Login endpoint: 5 attempts per 15 minutes
    login: {
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: 'Too many login attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_LOGIN'
    },

    // Feedback submission: 3 per minute per IP
    feedback: {
        windowMs: 60 * 1000,
        max: 3,
        message: 'Too many feedback submissions. Please slow down and try again in a minute.',
        code: 'RATE_LIMIT_FEEDBACK'
    },

    // Admin operations: 60 per minute
    admin: {
        windowMs: 60 * 1000,
        max: 60,
        message: 'Too many requests. Please slow down.',
        code: 'RATE_LIMIT_ADMIN'
    },

    // Public API: 100 per minute
    public: {
        windowMs: 60 * 1000,
        max: 100,
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_PUBLIC'
    }
};

/**
 * Get client identifier (IP address)
 * Prioritizes X-Forwarded-For header for proxied requests
 */
function getClientIdentifier(req) {
    // Try X-Forwarded-For first (Azure Front Door, proxies)
    const forwardedFor = req.headers.get ?
        req.headers.get('x-forwarded-for') :
        req.headers['x-forwarded-for'];

    if (forwardedFor) {
        // Take first IP if multiple are present
        return forwardedFor.split(',')[0].trim();
    }

    // Fallback to X-Client-IP
    const clientIP = req.headers.get ?
        req.headers.get('x-client-ip') :
        req.headers['x-client-ip'];

    if (clientIP) {
        return clientIP;
    }

    // Last resort: use a default identifier
    return 'unknown-client';
}

/**
 * Rate limiting middleware
 * Returns null if request is allowed, or error response if rate limited
 *
 * @param {Object} req - Azure Functions request object
 * @param {string} limitType - Type of rate limit ('login', 'feedback', 'admin', 'public')
 * @returns {Object|null} - Error response object or null if allowed
 */
function rateLimit(req, limitType = 'public') {
    const config = RATE_LIMITS[limitType];

    if (!config) {
        // Invalid limit type, allow by default but log warning
        console.warn(`Invalid rate limit type: ${limitType}`);
        return null;
    }

    // Get client identifier
    const clientId = getClientIdentifier(req);
    const key = `${limitType}:${clientId}`;

    const now = Date.now();

    // Get or create rate limit data for this client
    let limitData = requestCounts.get(key);

    if (!limitData || now - limitData.resetTime > config.windowMs) {
        // First request or window expired, create new entry
        limitData = {
            count: 1,
            resetTime: now,
            windowMs: config.windowMs
        };
        requestCounts.set(key, limitData);
        return null; // Allow request
    }

    // Increment counter
    limitData.count++;

    if (limitData.count > config.max) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((config.windowMs - (now - limitData.resetTime)) / 1000);

        return {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Retry-After': retryAfter.toString(),
                'X-RateLimit-Limit': config.max.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': new Date(limitData.resetTime + config.windowMs).toISOString()
            },
            body: {
                success: false,
                message: config.message,
                code: config.code,
                retryAfter: retryAfter
            }
        };
    }

    // Request allowed
    return null;
}

/**
 * Get rate limit info for monitoring/debugging
 * @param {string} limitType - Type of rate limit
 * @returns {Object} - Rate limit statistics
 */
function getRateLimitInfo(limitType = 'public') {
    const config = RATE_LIMITS[limitType];
    const clients = [];

    for (const [key, data] of requestCounts.entries()) {
        if (key.startsWith(`${limitType}:`)) {
            const clientId = key.split(':')[1];
            clients.push({
                clientId: clientId.substring(0, 8) + '...', // Truncate for privacy
                count: data.count,
                resetTime: new Date(data.resetTime + data.windowMs).toISOString()
            });
        }
    }

    return {
        limitType,
        maxRequests: config?.max,
        windowMs: config?.windowMs,
        activeClients: clients.length,
        clients: clients.slice(0, 10) // Return top 10 for debugging
    };
}

/**
 * Clear rate limits for a specific client (admin function)
 * @param {string} clientId - Client identifier to clear
 */
function clearRateLimit(clientId) {
    let cleared = 0;
    for (const key of requestCounts.keys()) {
        if (key.includes(clientId)) {
            requestCounts.delete(key);
            cleared++;
        }
    }
    return cleared;
}

module.exports = {
    rateLimit,
    getRateLimitInfo,
    clearRateLimit,
    RATE_LIMITS
};
