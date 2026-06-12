/**
 * Authentication & Authorization Middleware
 *
 * Validates JWT tokens and enforces role-based access control for admin endpoints.
 * JWT payload includes userId, username, email, fullName, roles[], and isProtected.
 */

const jwt = require('jsonwebtoken');
const { SECURITY_HEADERS } = require('./utils');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not configured');
}
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGINS || '*';

/**
 * Generate JWT token for authenticated user
 * @param {Object} user - User object with userId, username, email, fullName, roles, isProtected
 */
function generateToken(user) {
    const payload = {
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles || [],
        isProtected: user.isProtected || false,
        iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRY,
        issuer: 'cat-bootcamp-api',
        audience: 'cat-bootcamp-admin'
    });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'cat-bootcamp-api',
            audience: 'cat-bootcamp-admin'
        });
    } catch (error) {
        return null;
    }
}

/**
 * Build a standardized error response with security headers
 */
function authErrorResponse(status, message, code) {
    return {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
            ...SECURITY_HEADERS
        },
        jsonBody: {
            success: false,
            message,
            code
        }
    };
}

/**
 * Extract token from request Authorization header
 */
function extractToken(req) {
    // Prefer a custom header: Azure Static Web Apps managed functions do not
    // reliably forward the standard Authorization header, so the client also
    // sends the raw token in x-auth-token (see web api.js).
    const customToken = req.headers.get
        ? req.headers.get('x-auth-token')
        : (req.headers['x-auth-token'] || req.headers['X-Auth-Token']);
    if (customToken) {
        return customToken.startsWith('Bearer ') ? customToken.substring(7) : customToken;
    }

    const authHeader = req.headers.get
        ? req.headers.get('authorization')
        : (req.headers.authorization || req.headers.Authorization);

    if (!authHeader) return null;

    return authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;
}

/**
 * Middleware to require authentication.
 * Returns null if authenticated, or an error response if not.
 */
function requireAuth(req) {
    const token = extractToken(req);

    if (!token) {
        return authErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return authErrorResponse(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }

    return null;
}

/**
 * Middleware to require authentication AND at least one of the specified roles.
 * GlobalAdmin always passes regardless of the allowedRoles list.
 *
 * @param {Object} req - The HTTP request
 * @param {...string} allowedRoles - Role names that are permitted
 * @returns {Object|null} Error response if unauthorized/forbidden, null if allowed
 */
function requireRole(req, ...allowedRoles) {
    const authError = requireAuth(req);
    if (authError) return authError;

    const user = getAuthenticatedUser(req);
    if (!user || !user.roles) {
        return authErrorResponse(403, 'No roles assigned', 'FORBIDDEN');
    }

    // GlobalAdmin bypasses all role checks
    if (user.roles.includes('GlobalAdmin')) return null;

    const hasRole = allowedRoles.some(role => user.roles.includes(role));
    if (!hasRole) {
        return authErrorResponse(403, 'Insufficient permissions', 'FORBIDDEN');
    }

    return null;
}

/**
 * Get authenticated user from token.
 * Returns the decoded JWT payload or null.
 */
function getAuthenticatedUser(req) {
    const token = extractToken(req);
    if (!token) return null;
    return verifyToken(token);
}

/**
 * Check if the authenticated user has a specific role.
 */
function hasRole(req, roleName) {
    const user = getAuthenticatedUser(req);
    if (!user || !user.roles) return false;
    if (user.roles.includes('GlobalAdmin')) return true;
    return user.roles.includes(roleName);
}

/**
 * Check if the request has a valid auth token (without requiring it).
 * Useful for dual-purpose endpoints (public + admin).
 */
function isAuthenticated(req) {
    const token = extractToken(req);
    if (!token) return false;
    return verifyToken(token) !== null;
}

module.exports = {
    generateToken,
    verifyToken,
    requireAuth,
    requireRole,
    getAuthenticatedUser,
    hasRole,
    isAuthenticated
};
