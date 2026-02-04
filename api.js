/**
 * API utilities with retry logic, error handling, and CSRF protection
 */

import { CONFIG } from './config.js';
import { NetworkError, parseErrorResponse, logError } from './errors.js';
import { getCSRFToken, sleep } from './utils.js';

/**
 * Fetch with retry logic and exponential backoff
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, maxRetries = CONFIG.MAX_RETRIES) {
    let lastError;

    // Add timeout to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

    try {
        options.signal = controller.signal;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);

                // Don't retry client errors (4xx) except 429
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    return response;
                }

                // Return successful responses or last attempt
                if (response.ok || attempt === maxRetries - 1) {
                    return response;
                }

                // Retry server errors (5xx) and 429
                lastError = new Error(`HTTP ${response.status}`);

            } catch (error) {
                lastError = error;

                // Don't retry if request was aborted (timeout)
                if (error.name === 'AbortError') {
                    throw new NetworkError('Request timeout. Please try again.');
                }

                // Don't retry on last attempt
                if (attempt === maxRetries - 1) {
                    break;
                }
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.min(
                CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt),
                CONFIG.RETRY_MAX_DELAY
            );

            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
            await sleep(delay);
        }
    } finally {
        clearTimeout(timeoutId);
    }

    // All retries failed
    throw new NetworkError();
}

/**
 * Make API request with error handling and CSRF protection
 * @param {string} endpoint - API endpoint (relative to API_BASE_URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
export async function apiRequest(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;

    // Add default headers
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Add CSRF token for state-changing requests
    if (CONFIG.FEATURES.ENABLE_CSRF_PROTECTION &&
        ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase())) {
        headers['X-CSRF-Token'] = getCSRFToken();
    }

    // Add auth token if available
    const authToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    options.headers = headers;

    try {
        const response = await fetchWithRetry(url, options);

        if (!response.ok) {
            await parseErrorResponse(response);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return null;
        }

        return await response.json();

    } catch (error) {
        logError(error, { endpoint, method: options.method });
        throw error;
    }
}

/**
 * GET request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<any>}
 */
export async function apiGet(endpoint) {
    return apiRequest(endpoint, { method: 'GET' });
}

/**
 * POST request
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body
 * @returns {Promise<any>}
 */
export async function apiPost(endpoint, data) {
    return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

/**
 * PUT request
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body
 * @returns {Promise<any>}
 */
export async function apiPut(endpoint, data) {
    return apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

/**
 * DELETE request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<any>}
 */
export async function apiDelete(endpoint) {
    return apiRequest(endpoint, { method: 'DELETE' });
}

/**
 * Download file from API
 * @param {string} endpoint - API endpoint
 * @param {string} filename - Filename for download
 */
export async function apiDownload(endpoint, filename) {
    try {
        const response = await fetchWithRetry(`${CONFIG.API_BASE_URL}${endpoint}`);

        if (!response.ok) {
            await parseErrorResponse(response);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

    } catch (error) {
        logError(error, { endpoint, filename });
        throw error;
    }
}
