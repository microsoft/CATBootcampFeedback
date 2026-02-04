/**
 * Custom error classes for the Feedback Application
 * Provides structured error handling with error codes and user-friendly messages
 */

import { CONFIG } from './config.js';

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
    constructor(message, code, statusCode = 500, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            error: {
                name: this.name,
                message: this.message,
                code: this.code,
                statusCode: this.statusCode,
                timestamp: this.timestamp
            }
        };
    }
}

/**
 * Error for feedback submission failures
 */
export class FeedbackError extends AppError {
    constructor(message, code = CONFIG.ERROR_CODES.SERVER_ERROR, statusCode = 500) {
        super(message, code, statusCode);
    }
}

/**
 * Error for invalid event codes
 */
export class EventError extends AppError {
    constructor(message, code = CONFIG.ERROR_CODES.EVENT_NOT_FOUND, statusCode = 404) {
        super(message, code, statusCode);
    }
}

/**
 * Error for network failures
 */
export class NetworkError extends AppError {
    constructor(message = 'Unable to connect to server. Check your internet connection.') {
        super(message, CONFIG.ERROR_CODES.NETWORK_ERROR, 0);
    }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends AppError {
    constructor(message = 'Too many requests. Please try again later.', retryAfter = null) {
        super(message, CONFIG.ERROR_CODES.RATE_LIMIT_EXCEEDED, 429);
        this.retryAfter = retryAfter;
    }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed. Please check your credentials.') {
        super(message, CONFIG.ERROR_CODES.AUTHENTICATION_FAILED, 401);
    }
}

/**
 * Error for validation failures
 */
export class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, CONFIG.ERROR_CODES.INVALID_DATA, 400);
        this.field = field;
    }
}

/**
 * Parse HTTP response and throw appropriate error
 */
export async function parseErrorResponse(response) {
    let errorData = {};

    try {
        errorData = await response.json();
    } catch (e) {
        // Response doesn't have JSON body
    }

    const message = errorData.message || errorData.error?.message || 'An error occurred';

    switch (response.status) {
        case 400:
            throw new ValidationError(message);
        case 401:
            throw new AuthenticationError(message);
        case 404:
            throw new EventError(message, CONFIG.ERROR_CODES.EVENT_NOT_FOUND, 404);
        case 429:
            const retryAfter = response.headers.get('Retry-After');
            throw new RateLimitError(message, retryAfter);
        case 500:
        case 502:
        case 503:
        case 504:
            throw new FeedbackError(
                'Server error. Please try again later.',
                CONFIG.ERROR_CODES.SERVER_ERROR,
                response.status
            );
        default:
            throw new AppError(message, 'UNKNOWN_ERROR', response.status);
    }
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error) {
    if (error instanceof NetworkError) {
        return {
            title: 'Connection Error',
            message: 'Unable to connect to the server. Please check your internet connection and try again.',
            canRetry: true
        };
    }

    if (error instanceof RateLimitError) {
        const retryTime = error.retryAfter ? ` Please try again in ${error.retryAfter} seconds.` : ' Please try again later.';
        return {
            title: 'Too Many Requests',
            message: 'You have made too many requests.' + retryTime,
            canRetry: false
        };
    }

    if (error instanceof EventError) {
        return {
            title: 'Event Not Found',
            message: 'The feedback link appears to be invalid or expired. Please contact the event organizer.',
            canRetry: false
        };
    }

    if (error instanceof AuthenticationError) {
        return {
            title: 'Authentication Failed',
            message: 'Invalid username or password. Please try again.',
            canRetry: true
        };
    }

    if (error instanceof ValidationError) {
        return {
            title: 'Invalid Data',
            message: error.message,
            canRetry: true
        };
    }

    // Generic error
    return {
        title: 'Error',
        message: error.message || 'An unexpected error occurred. Please try again.',
        canRetry: true
    };
}

/**
 * Log error to console and telemetry
 */
export function logError(error, context = {}) {
    console.error('Error:', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack,
        context
    });

    // Integration point for Application Insights or other logging
    if (CONFIG.FEATURES.ENABLE_TELEMETRY && window.telemetry) {
        window.telemetry.trackError(error, context);
    }
}
