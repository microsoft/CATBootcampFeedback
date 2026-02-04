/**
 * Client-side rate limiting to prevent abuse
 */

import { CONFIG } from './config.js';
import { RateLimitError } from './errors.js';

export class RateLimiter {
    constructor(maxAttempts, windowMs, storageKey) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.storageKey = storageKey;
        this.attempts = this.loadAttempts();
    }

    /**
     * Load attempts from localStorage
     * @private
     */
    loadAttempts() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const attempts = JSON.parse(stored);
                // Filter out old attempts
                const now = Date.now();
                return attempts.filter(time => now - time < this.windowMs);
            }
        } catch (e) {
            console.error('Error loading rate limiter attempts:', e);
        }
        return [];
    }

    /**
     * Save attempts to localStorage
     * @private
     */
    saveAttempts() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.attempts));
        } catch (e) {
            console.error('Error saving rate limiter attempts:', e);
        }
    }

    /**
     * Check if another attempt is allowed
     * @returns {boolean}
     */
    canAttempt() {
        const now = Date.now();
        // Remove old attempts outside the window
        this.attempts = this.attempts.filter(time => now - time < this.windowMs);
        this.saveAttempts();

        return this.attempts.length < this.maxAttempts;
    }

    /**
     * Record an attempt
     */
    recordAttempt() {
        this.attempts.push(Date.now());
        this.saveAttempts();
    }

    /**
     * Get time until next attempt is allowed
     * @returns {number} Milliseconds until next attempt
     */
    getTimeUntilNextAttempt() {
        if (this.canAttempt()) return 0;

        const now = Date.now();
        const oldestAttempt = Math.min(...this.attempts);
        const timeUntilExpiry = this.windowMs - (now - oldestAttempt);

        return Math.max(0, timeUntilExpiry);
    }

    /**
     * Get formatted time until next attempt
     * @returns {string} Human-readable time
     */
    getFormattedTimeUntilNextAttempt() {
        const ms = this.getTimeUntilNextAttempt();

        if (ms === 0) return 'now';

        const minutes = Math.ceil(ms / 60000);
        if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }

        const hours = Math.ceil(minutes / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }

    /**
     * Check and throw error if rate limited
     * @throws {RateLimitError}
     */
    checkRateLimit() {
        if (!this.canAttempt()) {
            const waitTime = this.getFormattedTimeUntilNextAttempt();
            throw new RateLimitError(
                `Too many attempts. Please try again in ${waitTime}.`,
                Math.ceil(this.getTimeUntilNextAttempt() / 1000)
            );
        }
    }

    /**
     * Reset rate limiter
     */
    reset() {
        this.attempts = [];
        this.saveAttempts();
    }

    /**
     * Get number of remaining attempts
     * @returns {number}
     */
    getRemainingAttempts() {
        const now = Date.now();
        this.attempts = this.attempts.filter(time => now - time < this.windowMs);
        return Math.max(0, this.maxAttempts - this.attempts.length);
    }
}

/**
 * Create rate limiter for feedback submissions
 * @param {string} eventCode - Event code for scoping
 * @returns {RateLimiter}
 */
export function createFeedbackRateLimiter(eventCode) {
    return new RateLimiter(
        CONFIG.MAX_SUBMISSIONS_PER_EVENT,
        CONFIG.SUBMISSION_COOLDOWN_MS,
        `rateLimiter_feedback_${eventCode}`
    );
}

/**
 * Create rate limiter for login attempts
 * @returns {RateLimiter}
 */
export function createLoginRateLimiter() {
    return new RateLimiter(
        CONFIG.MAX_LOGIN_ATTEMPTS,
        CONFIG.LOGIN_COOLDOWN_MS,
        'rateLimiter_login'
    );
}
