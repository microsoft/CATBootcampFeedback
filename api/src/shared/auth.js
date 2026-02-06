/**
 * Authentication Middleware
 *
 * Validates JWT tokens for admin endpoints
 */

const jwt = require('jsonwebtoken');

// JWT secret - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'CAT-Bootcamp-Secret-Key-Change-In-Production-2026';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h'; // Default 8 hour expiration

/**
 * Generate JWT token for authenticated user
 */
function generateToken(user) {
    const payload = {
        username: user.username,
        email: user.email,
        fullName: user.fullName,
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
 * Middleware to require authentication
 * Returns null if authenticated, or error response if not
 */
function requireAuth(req) {
    // Get token from Authorization header
    // Azure Functions V4 uses headers.get() method
    const authHeader = req.headers.get ? req.headers.get('authorization') : (req.headers.authorization || req.headers.Authorization);

    if (!authHeader) {
        return {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            }
        };
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
        return {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: false,
                message: 'Invalid or expired token',
                code: 'INVALID_TOKEN'
            }
        };
    }

    // Token is valid - return null (no error)
    return null;
}

/**
 * Get authenticated user from token
 */
function getAuthenticatedUser(req) {
    // Azure Functions V4 uses headers.get() method
    const authHeader = req.headers.get ? req.headers.get('authorization') : (req.headers.authorization || req.headers.Authorization);

    if (!authHeader) {
        return null;
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

    return verifyToken(token);
}

module.exports = {
    generateToken,
    verifyToken,
    requireAuth,
    getAuthenticatedUser,
    JWT_SECRET,
    JWT_EXPIRY
};
