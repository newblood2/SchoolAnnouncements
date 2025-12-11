/**
 * Security Module for School Announcements API
 * Provides rate limiting, input validation, CSRF protection, and password hashing
 */

const crypto = require('crypto');

/**
 * ============================================
 * PASSWORD HASHING WITH PBKDF2
 * ============================================
 * Using Node.js built-in crypto for password hashing
 * PBKDF2 is NIST-approved and secure for password storage
 */

const HASH_CONFIG = {
    iterations: 100000,
    keyLength: 64,
    digest: 'sha512',
    saltLength: 32
};

/**
 * Hash a password using PBKDF2
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hash in format: salt:hash
 */
async function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(HASH_CONFIG.saltLength).toString('hex');

        crypto.pbkdf2(
            password,
            salt,
            HASH_CONFIG.iterations,
            HASH_CONFIG.keyLength,
            HASH_CONFIG.digest,
            (err, derivedKey) => {
                if (err) reject(err);
                resolve(`${salt}:${derivedKey.toString('hex')}`);
            }
        );
    });
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password to verify
 * @param {string} storedHash - Stored hash in format: salt:hash
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(password, storedHash) {
    return new Promise((resolve, reject) => {
        const [salt, hash] = storedHash.split(':');

        if (!salt || !hash) {
            resolve(false);
            return;
        }

        crypto.pbkdf2(
            password,
            salt,
            HASH_CONFIG.iterations,
            HASH_CONFIG.keyLength,
            HASH_CONFIG.digest,
            (err, derivedKey) => {
                if (err) reject(err);
                // Use timing-safe comparison to prevent timing attacks
                const derivedHash = derivedKey.toString('hex');
                resolve(crypto.timingSafeEqual(
                    Buffer.from(hash, 'hex'),
                    Buffer.from(derivedHash, 'hex')
                ));
            }
        );
    });
}

/**
 * ============================================
 * RATE LIMITING
 * ============================================
 */

/**
 * Simple in-memory rate limiter
 * (Use Redis in production for distributed systems)
 */
class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000; // 1 minute default
        this.maxRequests = options.maxRequests || 100;
        this.message = options.message || 'Too many requests, please try again later';
        this.keyGenerator = options.keyGenerator || ((req) => req.ip);
        this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
        this.skipFailedRequests = options.skipFailedRequests || false;

        this.requests = new Map();

        // Cleanup old entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if request should be rate limited
     * @param {string} key - Identifier for the requester
     * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number }
     */
    check(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get or create entry
        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }

        const timestamps = this.requests.get(key);

        // Filter out old timestamps
        const recent = timestamps.filter(ts => ts > windowStart);
        this.requests.set(key, recent);

        const remaining = Math.max(0, this.maxRequests - recent.length);
        const resetTime = recent.length > 0 ? recent[0] + this.windowMs : now + this.windowMs;

        return {
            allowed: recent.length < this.maxRequests,
            remaining,
            resetTime,
            total: this.maxRequests
        };
    }

    /**
     * Record a request
     * @param {string} key - Identifier for the requester
     */
    hit(key) {
        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }
        this.requests.get(key).push(Date.now());
    }

    /**
     * Express middleware
     */
    middleware() {
        return (req, res, next) => {
            const key = this.keyGenerator(req);
            const result = this.check(key);

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', result.total);
            res.setHeader('X-RateLimit-Remaining', result.remaining);
            res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

            if (!result.allowed) {
                res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: this.message,
                    retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
                });
            }

            this.hit(key);
            next();
        };
    }

    /**
     * Cleanup old entries
     */
    cleanup() {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        for (const [key, timestamps] of this.requests.entries()) {
            const recent = timestamps.filter(ts => ts > windowStart);
            if (recent.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, recent);
            }
        }
    }
}

/**
 * ============================================
 * CSRF PROTECTION
 * ============================================
 */

/**
 * CSRF Token Manager
 */
class CSRFProtection {
    constructor(options = {}) {
        this.tokenLength = options.tokenLength || 32;
        this.cookieName = options.cookieName || 'csrf_token';
        this.headerName = options.headerName || 'x-csrf-token';
        this.tokens = new Map(); // sessionId -> token
        this.tokenTTL = options.tokenTTL || 3600000; // 1 hour

        // Cleanup expired tokens every 10 minutes
        setInterval(() => this.cleanup(), 600000);
    }

    /**
     * Generate a CSRF token for a session
     * @param {string} sessionId - Session identifier
     * @returns {string} - CSRF token
     */
    generateToken(sessionId) {
        const token = crypto.randomBytes(this.tokenLength).toString('hex');
        this.tokens.set(sessionId, {
            token,
            createdAt: Date.now()
        });
        return token;
    }

    /**
     * Verify a CSRF token
     * @param {string} sessionId - Session identifier
     * @param {string} token - Token to verify
     * @returns {boolean} - True if valid
     */
    verifyToken(sessionId, token) {
        const stored = this.tokens.get(sessionId);
        if (!stored) return false;

        // Check if expired
        if (Date.now() - stored.createdAt > this.tokenTTL) {
            this.tokens.delete(sessionId);
            return false;
        }

        // Timing-safe comparison
        try {
            return crypto.timingSafeEqual(
                Buffer.from(stored.token),
                Buffer.from(token)
            );
        } catch (e) {
            return false;
        }
    }

    /**
     * Express middleware for CSRF protection
     * Protects POST, PUT, DELETE, PATCH methods
     */
    middleware() {
        return (req, res, next) => {
            // Skip safe methods
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                return next();
            }

            // Get session ID from session token header
            const sessionId = req.headers['x-session-token'];
            if (!sessionId) {
                // No session, skip CSRF check (auth will handle this)
                return next();
            }

            // Get CSRF token from header
            const csrfToken = req.headers[this.headerName];

            if (!csrfToken || !this.verifyToken(sessionId, csrfToken)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Invalid or missing CSRF token'
                });
            }

            next();
        };
    }

    /**
     * Cleanup expired tokens
     */
    cleanup() {
        const now = Date.now();
        for (const [sessionId, data] of this.tokens.entries()) {
            if (now - data.createdAt > this.tokenTTL) {
                this.tokens.delete(sessionId);
            }
        }
    }
}

/**
 * ============================================
 * INPUT VALIDATION & SANITIZATION
 * ============================================
 */

/**
 * Input validator with common validation rules
 */
const InputValidator = {
    /**
     * Validate and sanitize a string
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @returns {Object} - { valid: boolean, value: any, error?: string }
     */
    string(value, options = {}) {
        const {
            required = false,
            minLength = 0,
            maxLength = 10000,
            pattern = null,
            trim = true,
            allowEmpty = false
        } = options;

        // Check required
        if (value === undefined || value === null) {
            if (required) {
                return { valid: false, error: 'Value is required' };
            }
            return { valid: true, value: '' };
        }

        // Convert to string
        let str = String(value);

        // Trim
        if (trim) {
            str = str.trim();
        }

        // Check empty
        if (!allowEmpty && str.length === 0 && required) {
            return { valid: false, error: 'Value cannot be empty' };
        }

        // Check length
        if (str.length < minLength) {
            return { valid: false, error: `Value must be at least ${minLength} characters` };
        }
        if (str.length > maxLength) {
            return { valid: false, error: `Value must be no more than ${maxLength} characters` };
        }

        // Check pattern
        if (pattern && !pattern.test(str)) {
            return { valid: false, error: 'Value does not match required pattern' };
        }

        return { valid: true, value: str };
    },

    /**
     * Validate an email address
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @returns {Object} - { valid: boolean, value: any, error?: string }
     */
    email(value, options = {}) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const result = this.string(value, { ...options, maxLength: 254 });

        if (!result.valid) return result;
        if (result.value && !emailPattern.test(result.value)) {
            return { valid: false, error: 'Invalid email address' };
        }

        return { valid: true, value: result.value.toLowerCase() };
    },

    /**
     * Validate a URL
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @returns {Object} - { valid: boolean, value: any, error?: string }
     */
    url(value, options = {}) {
        const { allowRelative = true, protocols = ['http', 'https'] } = options;
        const result = this.string(value, { ...options, maxLength: 2048 });

        if (!result.valid) return result;
        if (!result.value) return result;

        // Allow relative URLs
        if (allowRelative && result.value.startsWith('/')) {
            return { valid: true, value: result.value };
        }

        try {
            const url = new URL(result.value);
            const protocol = url.protocol.replace(':', '');

            if (!protocols.includes(protocol)) {
                return { valid: false, error: `URL must use one of: ${protocols.join(', ')}` };
            }

            return { valid: true, value: result.value };
        } catch (e) {
            return { valid: false, error: 'Invalid URL format' };
        }
    },

    /**
     * Validate an integer
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @returns {Object} - { valid: boolean, value: any, error?: string }
     */
    integer(value, options = {}) {
        const { required = false, min = null, max = null } = options;

        if (value === undefined || value === null || value === '') {
            if (required) {
                return { valid: false, error: 'Value is required' };
            }
            return { valid: true, value: null };
        }

        const num = parseInt(value, 10);

        if (isNaN(num)) {
            return { valid: false, error: 'Value must be an integer' };
        }

        if (min !== null && num < min) {
            return { valid: false, error: `Value must be at least ${min}` };
        }

        if (max !== null && num > max) {
            return { valid: false, error: `Value must be no more than ${max}` };
        }

        return { valid: true, value: num };
    },

    /**
     * Validate a boolean
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @returns {Object} - { valid: boolean, value: any, error?: string }
     */
    boolean(value, options = {}) {
        const { required = false } = options;

        if (value === undefined || value === null) {
            if (required) {
                return { valid: false, error: 'Value is required' };
            }
            return { valid: true, value: false };
        }

        if (typeof value === 'boolean') {
            return { valid: true, value };
        }

        if (value === 'true' || value === '1' || value === 1) {
            return { valid: true, value: true };
        }

        if (value === 'false' || value === '0' || value === 0) {
            return { valid: true, value: false };
        }

        return { valid: false, error: 'Value must be a boolean' };
    },

    /**
     * Validate an array
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @returns {Object} - { valid: boolean, value: any, error?: string }
     */
    array(value, options = {}) {
        const { required = false, minLength = 0, maxLength = 1000, itemValidator = null } = options;

        if (value === undefined || value === null) {
            if (required) {
                return { valid: false, error: 'Value is required' };
            }
            return { valid: true, value: [] };
        }

        if (!Array.isArray(value)) {
            return { valid: false, error: 'Value must be an array' };
        }

        if (value.length < minLength) {
            return { valid: false, error: `Array must have at least ${minLength} items` };
        }

        if (value.length > maxLength) {
            return { valid: false, error: `Array must have no more than ${maxLength} items` };
        }

        if (itemValidator) {
            const validatedItems = [];
            for (let i = 0; i < value.length; i++) {
                const result = itemValidator(value[i]);
                if (!result.valid) {
                    return { valid: false, error: `Item ${i}: ${result.error}` };
                }
                validatedItems.push(result.value);
            }
            return { valid: true, value: validatedItems };
        }

        return { valid: true, value };
    },

    /**
     * Sanitize HTML to prevent XSS
     * @param {string} html - HTML string to sanitize
     * @returns {string} - Sanitized string (HTML entities escaped)
     */
    sanitizeHtml(html) {
        if (!html) return '';
        return String(html)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },

    /**
     * Validate a hex color
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @returns {Object} - { valid: boolean, value: any, error?: string }
     */
    hexColor(value, options = {}) {
        const result = this.string(value, options);
        if (!result.valid) return result;
        if (!result.value) return result;

        const hexPattern = /^#[0-9A-Fa-f]{6}$/;
        if (!hexPattern.test(result.value)) {
            return { valid: false, error: 'Invalid hex color format (use #RRGGBB)' };
        }

        return { valid: true, value: result.value.toUpperCase() };
    }
};

/**
 * ============================================
 * SECURITY HEADERS
 * ============================================
 */

/**
 * Security headers middleware (lightweight alternative to helmet)
 */
function securityHeaders(options = {}) {
    return (req, res, next) => {
        // Prevent clickjacking
        res.setHeader('X-Frame-Options', options.frameOptions || 'SAMEORIGIN');

        // Prevent MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // XSS protection (legacy, but still useful)
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // Referrer policy
        res.setHeader('Referrer-Policy', options.referrerPolicy || 'strict-origin-when-cross-origin');

        // Content Security Policy (basic)
        if (options.csp !== false) {
            res.setHeader('Content-Security-Policy', options.csp || "default-src 'self'");
        }

        // Remove powered-by header
        res.removeHeader('X-Powered-By');

        next();
    };
}

/**
 * ============================================
 * AUDIT LOGGING
 * ============================================
 */

/**
 * Simple audit logger
 */
class AuditLogger {
    constructor(options = {}) {
        this.logs = [];
        this.maxLogs = options.maxLogs || 10000;
        this.onLog = options.onLog || null;
    }

    /**
     * Log an action
     * @param {Object} entry - Log entry
     */
    log(entry) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ...entry
        };

        this.logs.push(logEntry);

        // Keep logs under limit
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Call custom handler
        if (this.onLog) {
            this.onLog(logEntry);
        }

        // Console log for development
        console.log(`[AUDIT] ${logEntry.action}:`, JSON.stringify({
            user: logEntry.user,
            ip: logEntry.ip,
            details: logEntry.details
        }));
    }

    /**
     * Get recent logs
     * @param {number} limit - Number of logs to return
     * @returns {Array} - Recent log entries
     */
    getRecent(limit = 100) {
        return this.logs.slice(-limit).reverse();
    }

    /**
     * Search logs
     * @param {Object} criteria - Search criteria
     * @returns {Array} - Matching log entries
     */
    search(criteria = {}) {
        return this.logs.filter(log => {
            if (criteria.action && log.action !== criteria.action) return false;
            if (criteria.user && log.user !== criteria.user) return false;
            if (criteria.ip && log.ip !== criteria.ip) return false;
            if (criteria.startTime && new Date(log.timestamp) < new Date(criteria.startTime)) return false;
            if (criteria.endTime && new Date(log.timestamp) > new Date(criteria.endTime)) return false;
            return true;
        });
    }
}

// Export all security components
module.exports = {
    hashPassword,
    verifyPassword,
    RateLimiter,
    CSRFProtection,
    InputValidator,
    securityHeaders,
    AuditLogger
};
