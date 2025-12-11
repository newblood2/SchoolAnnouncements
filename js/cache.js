/**
 * @fileoverview Advanced Cache Module - Smart caching with request batching and optimization
 * @module cache
 * @description Provides intelligent caching with TTL, request deduplication, batch operations,
 * and memory-efficient storage with automatic cleanup.
 *
 * @example
 * // Store data with 10-minute TTL
 * window.Cache.set('weather-current', weatherData, 600000);
 *
 * // Retrieve cached data
 * const cached = window.Cache.get('weather-current');
 *
 * // Deduplicate concurrent requests
 * const data = await window.Cache.dedupe('api-call', () => fetch('/api/data'));
 *
 * // Batch multiple operations
 * window.Cache.batch.add('settings', { theme: 'dark' });
 * window.Cache.batch.add('settings', { fontSize: 16 });
 * await window.Cache.batch.flush('settings'); // Sends combined update
 */

(function() {
    'use strict';

    /**
     * @typedef {Object} CacheEntry
     * @property {*} data - Cached data
     * @property {number} timestamp - When the data was cached
     * @property {number} ttl - Time-to-live in milliseconds
     * @property {number} [accessCount] - Number of times accessed
     * @property {number} [lastAccessed] - Last access timestamp
     */

    /**
     * Configuration constants
     */
    const CONFIG = {
        MAX_CACHE_SIZE_KB: 5120, // 5MB max cache size
        CLEANUP_INTERVAL_MS: 60000, // Clean up every minute
        DEFAULT_TTL_MS: 300000, // 5 minutes default TTL
        BATCH_DELAY_MS: 100, // Delay before flushing batch
        MAX_BATCH_SIZE: 50, // Maximum items in a batch
        STALE_WHILE_REVALIDATE_MS: 30000 // Serve stale data while fetching fresh
    };

    /**
     * In-flight request tracking for deduplication
     * @type {Map<string, Promise>}
     */
    const inFlightRequests = new Map();

    /**
     * Batch operation queues
     * @type {Map<string, {items: Array, timer: number|null, resolver: Function|null}>}
     */
    const batchQueues = new Map();

    /**
     * In-memory cache for frequently accessed items
     * @type {Map<string, CacheEntry>}
     */
    const memoryCache = new Map();

    /**
     * Cache Manager Class with advanced features
     */
    class CacheManager {
        /**
         * Stores data in cache with TTL and access tracking
         * @param {string} key - Cache key
         * @param {*} data - Data to cache (will be JSON stringified for localStorage)
         * @param {number} [ttl=CONFIG.DEFAULT_TTL_MS] - Time-to-live in milliseconds
         * @param {Object} [options] - Additional options
         * @param {boolean} [options.memoryOnly=false] - Store only in memory (faster, not persistent)
         * @param {string} [options.priority='normal'] - Cache priority: 'high', 'normal', 'low'
         * @returns {boolean} True if successfully cached
         */
        static set(key, data, ttl = CONFIG.DEFAULT_TTL_MS, options = {}) {
            try {
                const entry = {
                    data: data,
                    timestamp: Date.now(),
                    ttl: ttl,
                    accessCount: 0,
                    lastAccessed: Date.now(),
                    priority: options.priority || 'normal'
                };

                // Always store in memory cache for fast access
                memoryCache.set(key, entry);

                // Persist to localStorage unless memory-only
                if (!options.memoryOnly) {
                    const serialized = JSON.stringify(entry);

                    // Check if we need to make room
                    if (this._getStorageSize() + serialized.length > CONFIG.MAX_CACHE_SIZE_KB * 1024) {
                        this._evictLRU();
                    }

                    localStorage.setItem(`cache_${key}`, serialized);
                }

                return true;
            } catch (error) {
                // localStorage might be full or unavailable
                console.warn('Failed to cache data:', error);
                // Try to evict and retry once
                try {
                    this._evictLRU();
                    if (!options.memoryOnly) {
                        localStorage.setItem(`cache_${key}`, JSON.stringify({
                            data, timestamp: Date.now(), ttl, accessCount: 0, lastAccessed: Date.now()
                        }));
                    }
                    return true;
                } catch (retryError) {
                    return false;
                }
            }
        }

        /**
         * Retrieves data from cache if not expired
         * Implements stale-while-revalidate pattern
         * @param {string} key - Cache key
         * @param {Object} [options] - Retrieval options
         * @param {boolean} [options.allowStale=false] - Return stale data if within revalidation window
         * @returns {*|null} Cached data or null if not found/expired
         */
        static get(key, options = {}) {
            try {
                // Check memory cache first (fastest)
                let entry = memoryCache.get(key);

                // Fall back to localStorage
                if (!entry) {
                    const cached = localStorage.getItem(`cache_${key}`);
                    if (cached) {
                        entry = JSON.parse(cached);
                        // Populate memory cache
                        memoryCache.set(key, entry);
                    }
                }

                if (!entry) {
                    return null;
                }

                const now = Date.now();
                const age = now - entry.timestamp;
                const isExpired = age > entry.ttl;
                const isStaleButUsable = isExpired && age < (entry.ttl + CONFIG.STALE_WHILE_REVALIDATE_MS);

                // Update access tracking
                entry.accessCount = (entry.accessCount || 0) + 1;
                entry.lastAccessed = now;

                if (!isExpired) {
                    return entry.data;
                }

                if (options.allowStale && isStaleButUsable) {
                    // Mark as stale for caller to know
                    return { data: entry.data, stale: true };
                }

                // Expired and not allowing stale
                this.remove(key);
                return null;
            } catch (error) {
                console.warn('Failed to retrieve cached data:', error);
                this.remove(key);
                return null;
            }
        }

        /**
         * Get or set pattern - returns cached value or fetches and caches new value
         * @param {string} key - Cache key
         * @param {Function} fetcher - Async function to fetch data if not cached
         * @param {number} [ttl] - TTL for new cache entry
         * @returns {Promise<*>} Cached or fresh data
         */
        static async getOrSet(key, fetcher, ttl = CONFIG.DEFAULT_TTL_MS) {
            const cached = this.get(key);
            if (cached !== null) {
                return cached;
            }

            const data = await fetcher();
            this.set(key, data, ttl);
            return data;
        }

        /**
         * Deduplicates concurrent requests for the same resource
         * @param {string} key - Unique key for this request
         * @param {Function} fetcher - Async function to fetch data
         * @returns {Promise<*>} Data from the request
         */
        static async dedupe(key, fetcher) {
            // If there's already an in-flight request, return that promise
            if (inFlightRequests.has(key)) {
                return inFlightRequests.get(key);
            }

            // Create the request promise
            const requestPromise = (async () => {
                try {
                    return await fetcher();
                } finally {
                    // Clean up after request completes
                    inFlightRequests.delete(key);
                }
            })();

            // Store the promise
            inFlightRequests.set(key, requestPromise);
            return requestPromise;
        }

        /**
         * Removes a specific cache entry
         * @param {string} key - Cache key
         */
        static remove(key) {
            try {
                memoryCache.delete(key);
                localStorage.removeItem(`cache_${key}`);
            } catch (error) {
                console.warn('Failed to remove cache entry:', error);
            }
        }

        /**
         * Clears all cache entries
         */
        static clear() {
            try {
                memoryCache.clear();
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('cache_')) {
                        localStorage.removeItem(key);
                    }
                });
                console.log('Cache cleared');
            } catch (error) {
                console.warn('Failed to clear cache:', error);
            }
        }

        /**
         * Invalidate cache entries matching a pattern
         * @param {string|RegExp} pattern - Pattern to match against cache keys
         */
        static invalidate(pattern) {
            try {
                const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

                // Clear from memory cache
                for (const key of memoryCache.keys()) {
                    if (regex.test(key)) {
                        memoryCache.delete(key);
                    }
                }

                // Clear from localStorage
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('cache_')) {
                        const cacheKey = key.substring(6); // Remove 'cache_' prefix
                        if (regex.test(cacheKey)) {
                            localStorage.removeItem(key);
                        }
                    }
                });
            } catch (error) {
                console.warn('Failed to invalidate cache:', error);
            }
        }

        /**
         * Gets cache statistics
         * @returns {Object} Cache statistics
         */
        static getStats() {
            try {
                const keys = Object.keys(localStorage);
                const cacheKeys = keys.filter(key => key.startsWith('cache_'));
                const now = Date.now();

                let totalSize = 0;
                let validEntries = 0;
                let expiredEntries = 0;
                let totalAccessCount = 0;
                const entriesByPriority = { high: 0, normal: 0, low: 0 };

                cacheKeys.forEach(key => {
                    const value = localStorage.getItem(key);
                    totalSize += value ? value.length : 0;

                    try {
                        const entry = JSON.parse(value);
                        if (now - entry.timestamp > entry.ttl) {
                            expiredEntries++;
                        } else {
                            validEntries++;
                        }
                        totalAccessCount += entry.accessCount || 0;
                        const priority = entry.priority || 'normal';
                        entriesByPriority[priority] = (entriesByPriority[priority] || 0) + 1;
                    } catch (e) {
                        // Invalid entry
                    }
                });

                return {
                    totalEntries: cacheKeys.length,
                    validEntries: validEntries,
                    expiredEntries: expiredEntries,
                    memoryEntries: memoryCache.size,
                    totalSizeBytes: totalSize,
                    totalSizeKB: (totalSize / 1024).toFixed(2),
                    maxSizeKB: CONFIG.MAX_CACHE_SIZE_KB,
                    usagePercent: ((totalSize / 1024 / CONFIG.MAX_CACHE_SIZE_KB) * 100).toFixed(1),
                    totalAccessCount: totalAccessCount,
                    entriesByPriority: entriesByPriority,
                    inFlightRequests: inFlightRequests.size
                };
            } catch (error) {
                console.warn('Failed to get cache stats:', error);
                return null;
            }
        }

        /**
         * Checks if localStorage is available
         * @returns {boolean} True if localStorage is available
         */
        static isAvailable() {
            try {
                const test = '__cache_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        }

        /**
         * Prefetch and cache multiple resources
         * @param {Array<{key: string, fetcher: Function, ttl?: number}>} resources
         * @returns {Promise<Object>} Results keyed by resource key
         */
        static async prefetch(resources) {
            const results = {};
            await Promise.all(
                resources.map(async ({ key, fetcher, ttl }) => {
                    try {
                        const data = await this.getOrSet(key, fetcher, ttl);
                        results[key] = { success: true, data };
                    } catch (error) {
                        results[key] = { success: false, error: error.message };
                    }
                })
            );
            return results;
        }

        /**
         * Get current storage size in bytes
         * @private
         */
        static _getStorageSize() {
            let total = 0;
            for (const key in localStorage) {
                if (key.startsWith('cache_')) {
                    total += localStorage.getItem(key)?.length || 0;
                }
            }
            return total;
        }

        /**
         * Evict least recently used entries
         * @private
         */
        static _evictLRU() {
            try {
                const entries = [];
                const keys = Object.keys(localStorage);

                keys.forEach(key => {
                    if (key.startsWith('cache_')) {
                        try {
                            const entry = JSON.parse(localStorage.getItem(key));
                            entries.push({
                                key,
                                lastAccessed: entry.lastAccessed || entry.timestamp,
                                priority: entry.priority || 'normal',
                                size: localStorage.getItem(key)?.length || 0
                            });
                        } catch (e) {
                            // Invalid entry, remove it
                            localStorage.removeItem(key);
                        }
                    }
                });

                // Sort by priority (low first) then by last accessed (oldest first)
                const priorityOrder = { low: 0, normal: 1, high: 2 };
                entries.sort((a, b) => {
                    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                    if (priorityDiff !== 0) return priorityDiff;
                    return a.lastAccessed - b.lastAccessed;
                });

                // Remove entries until we're under 80% of max size
                const targetSize = CONFIG.MAX_CACHE_SIZE_KB * 1024 * 0.8;
                let currentSize = this._getStorageSize();
                let evictedCount = 0;

                for (const entry of entries) {
                    if (currentSize <= targetSize) break;
                    localStorage.removeItem(entry.key);
                    memoryCache.delete(entry.key.substring(6));
                    currentSize -= entry.size;
                    evictedCount++;
                }

                if (evictedCount > 0) {
                    console.log(`Cache: Evicted ${evictedCount} LRU entries`);
                }
            } catch (error) {
                console.warn('Failed to evict LRU entries:', error);
            }
        }

        /**
         * Clean up expired entries
         * @private
         */
        static _cleanup() {
            try {
                const now = Date.now();
                let cleanedCount = 0;

                // Clean memory cache
                for (const [key, entry] of memoryCache.entries()) {
                    if (now - entry.timestamp > entry.ttl) {
                        memoryCache.delete(key);
                        cleanedCount++;
                    }
                }

                // Clean localStorage
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('cache_')) {
                        try {
                            const entry = JSON.parse(localStorage.getItem(key));
                            if (now - entry.timestamp > entry.ttl) {
                                localStorage.removeItem(key);
                                cleanedCount++;
                            }
                        } catch (e) {
                            // Invalid entry, remove it
                            localStorage.removeItem(key);
                            cleanedCount++;
                        }
                    }
                });

                if (cleanedCount > 0) {
                    console.log(`Cache: Cleaned up ${cleanedCount} expired entries`);
                }
            } catch (error) {
                console.warn('Cache cleanup failed:', error);
            }
        }
    }

    /**
     * Batch Operations Manager
     * Allows grouping multiple operations and executing them together
     */
    class BatchManager {
        /**
         * Add an item to a batch queue
         * @param {string} queueName - Name of the batch queue
         * @param {*} item - Item to add to the batch
         * @param {Function} [processor] - Function to process the batch when flushed
         * @returns {Promise<*>} Resolves when batch is flushed
         */
        static add(queueName, item, processor = null) {
            return new Promise((resolve, reject) => {
                if (!batchQueues.has(queueName)) {
                    batchQueues.set(queueName, {
                        items: [],
                        timer: null,
                        resolvers: [],
                        processor: processor
                    });
                }

                const queue = batchQueues.get(queueName);
                queue.items.push(item);
                queue.resolvers.push({ resolve, reject });

                if (processor && !queue.processor) {
                    queue.processor = processor;
                }

                // Clear existing timer
                if (queue.timer) {
                    clearTimeout(queue.timer);
                }

                // Auto-flush if batch is full
                if (queue.items.length >= CONFIG.MAX_BATCH_SIZE) {
                    this.flush(queueName);
                } else {
                    // Set timer for delayed flush
                    queue.timer = setTimeout(() => {
                        this.flush(queueName);
                    }, CONFIG.BATCH_DELAY_MS);
                }
            });
        }

        /**
         * Manually flush a batch queue
         * @param {string} queueName - Name of the batch queue
         * @returns {Promise<*>} Result of batch processing
         */
        static async flush(queueName) {
            const queue = batchQueues.get(queueName);
            if (!queue || queue.items.length === 0) {
                return null;
            }

            // Clear timer
            if (queue.timer) {
                clearTimeout(queue.timer);
                queue.timer = null;
            }

            // Get items and resolvers
            const items = [...queue.items];
            const resolvers = [...queue.resolvers];

            // Clear queue
            queue.items = [];
            queue.resolvers = [];

            try {
                let result;
                if (queue.processor) {
                    result = await queue.processor(items);
                } else {
                    result = items;
                }

                // Resolve all promises
                resolvers.forEach(({ resolve }) => resolve(result));
                return result;
            } catch (error) {
                // Reject all promises
                resolvers.forEach(({ reject }) => reject(error));
                throw error;
            }
        }

        /**
         * Get current batch queue status
         * @param {string} queueName - Name of the batch queue
         * @returns {Object|null} Queue status
         */
        static getStatus(queueName) {
            const queue = batchQueues.get(queueName);
            if (!queue) return null;
            return {
                itemCount: queue.items.length,
                hasPendingTimer: queue.timer !== null
            };
        }

        /**
         * Clear a batch queue without processing
         * @param {string} queueName - Name of the batch queue
         */
        static clear(queueName) {
            const queue = batchQueues.get(queueName);
            if (queue) {
                if (queue.timer) {
                    clearTimeout(queue.timer);
                }
                queue.resolvers.forEach(({ reject }) =>
                    reject(new Error('Batch queue cleared'))
                );
                batchQueues.delete(queueName);
            }
        }
    }

    /**
     * Request Coalescing - combines multiple rapid requests into one
     */
    class RequestCoalescer {
        constructor(delay = 50) {
            this.delay = delay;
            this.pending = new Map();
        }

        /**
         * Coalesce multiple calls into a single execution
         * @param {string} key - Unique key for this coalesced request
         * @param {Function} fn - Function to execute
         * @returns {Promise<*>}
         */
        coalesce(key, fn) {
            return new Promise((resolve, reject) => {
                if (!this.pending.has(key)) {
                    this.pending.set(key, {
                        resolvers: [],
                        timer: null
                    });
                }

                const entry = this.pending.get(key);
                entry.resolvers.push({ resolve, reject });

                if (entry.timer) {
                    clearTimeout(entry.timer);
                }

                entry.timer = setTimeout(async () => {
                    const resolvers = entry.resolvers;
                    this.pending.delete(key);

                    try {
                        const result = await fn();
                        resolvers.forEach(r => r.resolve(result));
                    } catch (error) {
                        resolvers.forEach(r => r.reject(error));
                    }
                }, this.delay);
            });
        }
    }

    // Start periodic cleanup
    setInterval(() => CacheManager._cleanup(), CONFIG.CLEANUP_INTERVAL_MS);

    // Expose to window
    window.Cache = CacheManager;
    window.Cache.batch = BatchManager;
    window.Cache.RequestCoalescer = RequestCoalescer;
    window.Cache.CONFIG = CONFIG;

    // Log cache availability on load
    if (CacheManager.isAvailable()) {
        console.log('Advanced Cache system initialized');
        console.log(`  - Max size: ${CONFIG.MAX_CACHE_SIZE_KB}KB`);
        console.log(`  - Default TTL: ${CONFIG.DEFAULT_TTL_MS / 1000}s`);
        console.log(`  - Features: TTL, LRU eviction, request deduplication, batch operations`);

        // Log cache stats if there are cached items
        const stats = CacheManager.getStats();
        if (stats && stats.totalEntries > 0) {
            console.log(`  - Current: ${stats.validEntries} valid entries (${stats.usagePercent}% used)`);
        }
    } else {
        console.warn('Cache system running in memory-only mode (localStorage not available)');
    }

})();
