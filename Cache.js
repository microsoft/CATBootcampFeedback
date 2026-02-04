/**
 * Simple caching layer for API responses
 */

import { CONFIG } from './config.js';

export class APICache {
    constructor(ttlMs = CONFIG.EVENT_CACHE_TTL) {
        this.cache = new Map();
        this.ttlMs = ttlMs;
    }

    /**
     * Set cache entry
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     */
    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Get cache entry
     * @param {string} key - Cache key
     * @returns {any|null} Cached value or null
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        const age = Date.now() - item.timestamp;
        if (age > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Check if key exists and is valid
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete cache entry
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache size
     * @returns {number}
     */
    size() {
        return this.cache.size;
    }

    /**
     * Clean expired entries
     */
    cleanExpired() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttlMs) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));

        return keysToDelete.length;
    }
}

// Global caches
export const eventCache = new APICache(CONFIG.EVENT_CACHE_TTL);
export const feedbackCache = new APICache(CONFIG.FEEDBACK_CACHE_TTL);

// Clean expired entries every 5 minutes
if (typeof window !== 'undefined') {
    setInterval(() => {
        eventCache.cleanExpired();
        feedbackCache.cleanExpired();
    }, 300000);
}
