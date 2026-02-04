/**
 * Utility functions for the Feedback Application
 * Input sanitization, validation, and helper functions
 */

import { CONFIG } from './config.js';
import { ValidationError } from './errors.js';

/**
 * Input sanitization utilities
 */
export const InputSanitizer = {
    /**
     * Remove HTML tags and escape dangerous characters
     * @param {string} input - The input to sanitize
     * @param {number} maxLength - Maximum allowed length
     * @returns {string} Sanitized string
     */
    sanitizeText(input, maxLength = CONFIG.COMMENTS_MAX_LENGTH) {
        if (!input || typeof input !== 'string') return '';

        return input
            .trim()
            .substring(0, maxLength)
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .replace(/`/g, '&#x60;')
            .replace(/=/g, '&#x3D;');
    },

    /**
     * Sanitize names (speaker, module)
     * @param {string} input - The name to sanitize
     * @param {number} maxLength - Maximum allowed length
     * @returns {string} Sanitized name
     */
    sanitizeName(input, maxLength = CONFIG.SPEAKER_NAME_MAX_LENGTH) {
        if (!input || typeof input !== 'string') return '';

        return input
            .trim()
            .substring(0, maxLength)
            .replace(/[^a-zA-Z0-9\s\-\.']/g, '');
    },

    /**
     * Validate event code format
     * @param {string} code - The event code to validate
     * @returns {boolean} True if valid
     */
    validateEventCode(code) {
        if (!code || typeof code !== 'string') return false;
        return CONFIG.EVENT_CODE_PATTERN.test(code);
    },

    /**
     * Validate rating value
     * @param {any} value - The rating value
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @returns {boolean} True if valid
     */
    validateRating(value, min = 1, max = 5) {
        const num = parseInt(value, 10);
        return !isNaN(num) && num >= min && num <= max;
    },

    /**
     * Validate content depth value
     * @param {string} value - The content depth value
     * @returns {boolean} True if valid
     */
    validateContentDepth(value) {
        const validValues = ['Too Technical', 'Just Right', 'Too Low Level'];
        return validValues.includes(value);
    },

    /**
     * Validate email address
     * @param {string} email - The email to validate
     * @returns {boolean} True if valid
     */
    validateEmail(email) {
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email);
    }
};

/**
 * Debounce function - delays execution until after wait period
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function - limits execution to once per wait period
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, wait = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, wait);
        }
    };
}

/**
 * Format date for display
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format date and time for display
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date and time
 */
export function formatDateTime(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Generate star rating display
 * @param {number} rating - Rating value (1-5)
 * @returns {string} Star emoji string
 */
export function getStars(rating) {
    const num = parseInt(rating, 10);
    if (isNaN(num) || num < 1 || num > 5) return '';
    return '⭐'.repeat(num);
}

/**
 * Generate CSRF token
 * @returns {string} CSRF token
 */
export function generateCSRFToken() {
    if (crypto && crypto.getRandomValues) {
        return 'csrf_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Fallback for older browsers
    return 'csrf_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Get or create CSRF token
 * @returns {string} CSRF token
 */
export function getCSRFToken() {
    let token = sessionStorage.getItem('csrfToken');

    if (!token) {
        token = generateCSRFToken();
        sessionStorage.setItem('csrfToken', token);
    }

    return token;
}

/**
 * Get URL parameter value
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value
 */
export function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (e) {
            document.body.removeChild(textarea);
            return false;
        }
    }
}

/**
 * Show minimum loading time for better UX
 * @param {Promise} asyncOperation - The async operation to perform
 * @param {number} minDisplayTime - Minimum time to show loading
 * @returns {Promise<any>} Operation result
 */
export async function showLoadingWithMinimum(asyncOperation, minDisplayTime = CONFIG.LOADING_MIN_DISPLAY_TIME) {
    const loadingStart = Date.now();

    try {
        const result = await asyncOperation;

        const elapsed = Date.now() - loadingStart;
        const remaining = Math.max(0, minDisplayTime - elapsed);

        if (remaining > 0) {
            await new Promise(resolve => setTimeout(resolve, remaining));
        }

        return result;
    } catch (error) {
        // Always show errors immediately
        throw error;
    }
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate event code
 * @returns {string} Event code
 */
export function generateEventCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous characters
    let code = CONFIG.EVENT_CODE_PREFIX;

    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
}

/**
 * Validate feedback form data
 * @param {Object} data - Form data to validate
 * @throws {ValidationError} If validation fails
 */
export function validateFeedbackData(data) {
    if (!data.eventCode || !InputSanitizer.validateEventCode(data.eventCode)) {
        throw new ValidationError('Invalid event code', 'eventCode');
    }

    if (!InputSanitizer.validateRating(data.speakerKnowledge)) {
        throw new ValidationError('Speaker knowledge rating must be between 1 and 5', 'speakerKnowledge');
    }

    if (!InputSanitizer.validateContentDepth(data.contentDepth)) {
        throw new ValidationError('Invalid content depth value', 'contentDepth');
    }

    if (!InputSanitizer.validateRating(data.moduleSatisfaction)) {
        throw new ValidationError('Module satisfaction rating must be between 1 and 5', 'moduleSatisfaction');
    }

    if (data.additionalComments && data.additionalComments.length > CONFIG.COMMENTS_MAX_LENGTH) {
        throw new ValidationError(
            `Comments must be less than ${CONFIG.COMMENTS_MAX_LENGTH} characters`,
            'additionalComments'
        );
    }
}

/**
 * Escape HTML in string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Check if user is on mobile device
 * @returns {boolean} True if mobile
 */
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Request fullscreen mode
 * @param {HTMLElement} element - Element to make fullscreen (default: document.documentElement)
 * @returns {Promise<void>}
 */
export async function requestFullscreen(element = document.documentElement) {
    try {
        if (element.requestFullscreen) {
            await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            await element.msRequestFullscreen();
        }
    } catch (err) {
        console.error('Error attempting to enable fullscreen:', err);
    }
}

/**
 * Exit fullscreen mode
 * @returns {Promise<void>}
 */
export async function exitFullscreen() {
    try {
        if (document.exitFullscreen) {
            await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            await document.msExitFullscreen();
        }
    } catch (err) {
        console.error('Error attempting to exit fullscreen:', err);
    }
}

/**
 * Toggle fullscreen mode
 * @returns {Promise<void>}
 */
export async function toggleFullscreen() {
    if (document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement) {
        await exitFullscreen();
    } else {
        await requestFullscreen();
    }
}
