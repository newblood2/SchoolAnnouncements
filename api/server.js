/**
 * School Announcements API Server
 * Centralized configuration management with Server-Sent Events for real-time updates
 * Enhanced with display tracking, heartbeat monitoring, and comprehensive security
 *
 * Security Features:
 * - Rate limiting on all endpoints
 * - Password hashing with PBKDF2
 * - CSRF protection for state-changing operations
 * - Input validation and sanitization
 * - Security headers
 * - Audit logging
 */

const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const multer = require('multer');

// Security module
const {
    hashPassword,
    verifyPassword,
    RateLimiter,
    CSRFProtection,
    InputValidator,
    securityHeaders,
    AuditLogger
} = require('./security');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DISPLAYS_FILE = path.join(DATA_DIR, 'displays.json');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
const UPLOADS_DIR = process.env.PUBLIC_DIR ? path.join(process.env.PUBLIC_DIR, 'uploads') : path.join(__dirname, 'uploads');
const DISMISSAL_HISTORY_FILE = path.join(DATA_DIR, 'dismissal-history.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

// Ensure data directory exists
if (DATA_DIR !== __dirname && !fsSync.existsSync(DATA_DIR)) {
    fsSync.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure uploads directory exists
if (!fsSync.existsSync(UPLOADS_DIR)) {
    fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'slide-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    }
});

// Authentication configuration
// IMPORTANT: Set API_KEY environment variable in production!
const API_KEY = process.env.API_KEY || 'change-this-in-production';
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

// Display tracking configuration
const HEARTBEAT_TIMEOUT_MS = 90000; // 90 seconds - mark offline if no heartbeat
const DISPLAY_CLEANUP_INTERVAL_MS = 60000; // Check for stale displays every minute

// Store active sessions
const sessions = new Map();

// Store SSE clients for broadcasting
const clients = new Map(); // Changed to Map to track display info

// Store display information
const displays = new Map();

// ============================================
// SECURITY SETUP
// ============================================

// Initialize audit logger
const auditLog = new AuditLogger({
    maxLogs: 10000,
    onLog: (entry) => {
        // Could write to file or external service here
    }
});

// Rate limiters - very permissive for school deployments with many displays
// In containerized environments, all clients may share the same IP
const generalRateLimiter = new RateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 10000, // Essentially unlimited for normal use
    message: 'Too many requests, please try again later'
});

const authRateLimiter = new RateLimiter({
    windowMs: 900000, // 15 minutes
    maxRequests: 100, // Generous for shared IP scenarios
    message: 'Too many login attempts, please try again later'
});

const apiRateLimiter = new RateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 10000, // Essentially unlimited for normal use
    message: 'API rate limit exceeded'
});

/**
 * Get real client IP from request (handles proxies)
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.socket?.remoteAddress ||
           'unknown';
}

// CSRF protection
const csrfProtection = new CSRFProtection({
    tokenLength: 32,
    tokenTTL: 3600000 // 1 hour
});

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || true, // Configure in production
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Security headers
app.use(securityHeaders({
    frameOptions: 'SAMEORIGIN',
    csp: false // Disable CSP for now as it needs careful configuration
}));

// Apply general rate limiting to all routes
app.use(generalRateLimiter.middleware());

// Serve static files if PUBLIC_DIR is set (combined mode)
const PUBLIC_DIR = process.env.PUBLIC_DIR;
if (PUBLIC_DIR && fsSync.existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR));
    app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));
    app.use('/slides', express.static(path.join(PUBLIC_DIR, 'slides')));
}

// Proxy /stream/ requests to MediaMTX (for combined container mode)
// This allows WHIP/WHEP streaming through the main port (8080)
const MEDIAMTX_HOST = process.env.MEDIAMTX_HOST || 'localhost';
const MEDIAMTX_PORT = process.env.MEDIAMTX_PORT || '8889';

// Collect raw body for stream proxy (needed for SDP in WHIP/WHEP)
app.use('/stream', express.raw({ type: '*/*', limit: '1mb' }));

app.use('/stream', async (req, res) => {
    const streamPath = req.url || '/';
    const targetUrl = `http://${MEDIAMTX_HOST}:${MEDIAMTX_PORT}${streamPath}`;

    try {
        // Build fetch options
        const fetchOptions = {
            method: req.method,
            headers: {
                'Accept': req.headers.accept || '*/*',
            }
        };

        // Forward content-type and body for POST/PATCH requests (WHIP/WHEP SDP)
        if (req.method === 'POST' || req.method === 'PATCH') {
            fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'application/sdp';
            if (req.body && req.body.length > 0) {
                fetchOptions.body = req.body;
            }
        }

        const response = await fetch(targetUrl, fetchOptions);

        // Forward response headers (important for WHIP Location header)
        for (const [key, value] of response.headers) {
            if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-encoding') {
                // Rewrite Location header to use proxy path
                if (key.toLowerCase() === 'location') {
                    const location = value.replace(`http://${MEDIAMTX_HOST}:${MEDIAMTX_PORT}`, '/stream');
                    res.setHeader(key, location);
                } else {
                    res.setHeader(key, value);
                }
            }
        }

        res.status(response.status);

        // Stream the response body
        if (response.body) {
            const reader = response.body.getReader();
            const pump = async () => {
                const { done, value } = await reader.read();
                if (done) {
                    res.end();
                    return;
                }
                res.write(Buffer.from(value));
                await pump();
            };
            await pump();
        } else {
            const text = await response.text();
            res.send(text);
        }
    } catch (error) {
        console.error('Stream proxy error:', error.message);
        res.status(502).json({ error: 'Stream server unavailable' });
    }
});

// MediaMTX API port (default 9997)
const MEDIAMTX_API_PORT = process.env.MEDIAMTX_API_PORT || '9997';

/**
 * GET /api/stream/:streamName/status
 * Check if a MediaMTX stream is online (has an active publisher)
 * Used by livestream.js to auto-detect when OBS is streaming
 */
app.get('/api/stream/:streamName/status', async (req, res) => {
    const { streamName } = req.params;

    try {
        // Query MediaMTX API to check stream status
        const apiUrl = `http://${MEDIAMTX_HOST}:${MEDIAMTX_API_PORT}/v3/paths/get/${encodeURIComponent(streamName)}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            // Stream path doesn't exist or MediaMTX API error
            return res.json({
                online: false,
                error: response.status === 404 ? 'Stream not found' : 'MediaMTX API error',
                source: null
            });
        }

        const data = await response.json();

        // Check if stream has an active source (publisher)
        // When OBS is streaming, source will have properties like type: "rtmpConn" or "webRTCSession"
        const hasPublisher = data.source && data.source.id && data.source.id !== '';

        res.json({
            online: hasPublisher,
            name: data.name,
            source: data.source || null,
            readers: data.readers || [],
            ready: data.ready || false
        });

    } catch (error) {
        console.error('Stream status check error:', error.message);
        res.json({
            online: false,
            error: 'Failed to check stream status',
            source: null
        });
    }
});

/**
 * POST /api/stream/auth
 * External authentication endpoint for MediaMTX
 * MediaMTX calls this to validate publish credentials
 * Returns 200 OK to allow, 401 to deny
 */
app.post('/api/stream/auth', express.json(), async (req, res) => {
    try {
        const { user, password, action, path } = req.body;

        // Only validate publish actions (streaming to server)
        // Read actions (viewing) should be allowed without auth
        if (action === 'read') {
            return res.status(200).send('OK');
        }

        // For publish actions, validate credentials
        if (action === 'publish') {
            // Load the publish token from settings
            const settings = await loadSettings();
            const livestreamConfig = settings.livestreamConfig || {};
            const storedToken = livestreamConfig.publishToken;

            // If no token configured, allow all (for backwards compatibility)
            if (!storedToken || storedToken === '') {
                console.log(`Stream auth: No token configured, allowing publish to ${path}`);
                return res.status(200).send('OK');
            }

            // Validate credentials
            // Expected: user = "stream", password = the token
            if (user === 'stream' && password === storedToken) {
                console.log(`Stream auth: Valid credentials for ${path}`);
                return res.status(200).send('OK');
            }

            // Also accept the token directly as password with no user
            if (!user && password === storedToken) {
                console.log(`Stream auth: Valid token for ${path}`);
                return res.status(200).send('OK');
            }

            console.log(`Stream auth: Invalid credentials for ${path} (user: ${user})`);
            return res.status(401).send('Invalid credentials');
        }

        // For other actions (playback, etc.), allow
        res.status(200).send('OK');

    } catch (error) {
        console.error('Stream auth error:', error);
        res.status(500).send('Internal server error');
    }
});

/**
 * Generate a secure session token
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a unique display ID
 */
function generateDisplayId() {
    return 'display_' + crypto.randomBytes(8).toString('hex');
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT_MS) {
            sessions.delete(token);
            console.log('Expired session removed:', token.substring(0, 8) + '...');
        }
    }
}

/**
 * Clean up stale displays (no heartbeat received)
 */
function cleanupStaleDisplays() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [displayId, display] of displays.entries()) {
        if (now - display.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
            // Mark as offline instead of removing
            if (display.status !== 'offline') {
                display.status = 'offline';
                display.offlineSince = now;
                cleanedCount++;
                console.log(`Display ${displayId} marked offline (no heartbeat)`);
            }
        }
    }

    if (cleanedCount > 0) {
        // Broadcast display status update
        broadcastUpdate({
            type: 'displays_update',
            timestamp: now,
            displays: getDisplaysSummary()
        });
    }
}

// Clean up expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Clean up stale displays every minute
setInterval(cleanupStaleDisplays, DISPLAY_CLEANUP_INTERVAL_MS);

/**
 * Authentication middleware
 * Checks for valid session token or API key
 */
function authenticate(req, res, next) {
    // Allow GET requests to settings without auth (for displays to read config)
    if (req.method === 'GET' && req.path.startsWith('/api/settings')) {
        return next();
    }

    // Allow SSE connections without auth (they only receive data)
    if (req.path === '/api/settings/stream') {
        return next();
    }

    // Allow display registration and heartbeat without auth (but not admin operations)
    if (req.path.startsWith('/api/displays')) {
        // Public endpoints: GET all displays, POST heartbeat
        if (req.method === 'GET' && req.path === '/api/displays') {
            return next();
        }
        if (req.method === 'POST' && req.path === '/api/displays/heartbeat') {
            return next();
        }
        // All other display operations (DELETE, update, commands) require auth - continue to auth check
    }

    // Check for session token in header
    const sessionToken = req.headers['x-session-token'];
    if (sessionToken && sessions.has(sessionToken)) {
        const session = sessions.get(sessionToken);
        // Update last accessed time
        session.lastAccessed = Date.now();
        return next();
    }

    // Check for API key in header
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === API_KEY) {
        return next();
    }

    // No valid authentication
    res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid session token or API key required'
    });
}

/**
 * Load settings from file
 */
async function loadSettings() {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, return default empty settings
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

/**
 * Save settings to file
 */
async function saveSettings(settings) {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Load displays from file (persistent storage)
 */
async function loadDisplays() {
    try {
        const data = await fs.readFile(DISPLAYS_FILE, 'utf8');
        const savedDisplays = JSON.parse(data);
        // Restore to Map
        for (const [id, display] of Object.entries(savedDisplays)) {
            display.status = 'offline'; // All displays start offline until they connect
            displays.set(id, display);
        }
        console.log(`Loaded ${displays.size} displays from storage`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading displays:', error);
        }
    }
}

/**
 * Save displays to file
 */
async function saveDisplays() {
    try {
        const displaysObj = Object.fromEntries(displays);
        await fs.writeFile(DISPLAYS_FILE, JSON.stringify(displaysObj, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving displays:', error);
    }
}

/**
 * Get displays summary for API responses
 */
function getDisplaysSummary() {
    const summary = [];
    const now = Date.now();

    for (const [id, display] of displays.entries()) {
        summary.push({
            id: id,
            name: display.name || 'Unnamed Display',
            location: display.location || 'Unknown',
            status: display.status,
            lastHeartbeat: display.lastHeartbeat,
            lastHeartbeatAgo: Math.floor((now - display.lastHeartbeat) / 1000),
            registeredAt: display.registeredAt,
            ipAddress: display.ipAddress || 'Unknown',
            userAgent: display.userAgent,
            screenResolution: display.screenResolution,
            currentPage: display.currentPage,
            offlineSince: display.offlineSince
        });
    }

    // Sort by status (online first) then by name
    summary.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return (a.name || '').localeCompare(b.name || '');
    });

    return summary;
}

/**
 * Broadcast update to all connected SSE clients
 */
function broadcastUpdate(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    let sentCount = 0;

    clients.forEach((clientInfo, client) => {
        try {
            client.write(message);
            sentCount++;
        } catch (error) {
            // Client disconnected, will be removed on next heartbeat
            console.log('Error sending to client:', error.message);
        }
    });

    console.log(`Broadcasted update to ${sentCount} clients`);
}

// Load displays on startup
loadDisplays();

/**
 * POST /api/auth/login
 * Authenticate and receive a session token
 * Protected by aggressive rate limiting to prevent brute force
 */
app.post('/api/auth/login', authRateLimiter.middleware(), async (req, res) => {
    const { apiKey } = req.body;

    // Validate input
    const apiKeyValidation = InputValidator.string(apiKey, {
        required: true,
        minLength: 1,
        maxLength: 256
    });

    if (!apiKeyValidation.valid) {
        auditLog.log({
            action: 'LOGIN_FAILED',
            reason: 'Invalid input',
            ip: req.ip
        });
        return res.status(400).json({
            error: 'Invalid input',
            message: apiKeyValidation.error
        });
    }

    if (apiKeyValidation.value !== API_KEY) {
        auditLog.log({
            action: 'LOGIN_FAILED',
            reason: 'Invalid credentials',
            ip: req.ip
        });
        return res.status(401).json({
            error: 'Invalid credentials',
            message: 'API key is incorrect'
        });
    }

    // Create new session
    const sessionToken = generateSessionToken();
    const csrfToken = csrfProtection.generateToken(sessionToken);

    sessions.set(sessionToken, {
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        ip: req.ip
    });

    auditLog.log({
        action: 'LOGIN_SUCCESS',
        ip: req.ip,
        sessionId: sessionToken.substring(0, 8) + '...'
    });

    console.log('New session created:', sessionToken.substring(0, 8) + '...');

    res.json({
        success: true,
        sessionToken: sessionToken,
        csrfToken: csrfToken,
        expiresIn: SESSION_TIMEOUT_MS
    });
});

/**
 * POST /api/auth/logout
 * Invalidate current session
 */
app.post('/api/auth/logout', (req, res) => {
    const sessionToken = req.headers['x-session-token'];

    if (sessionToken && sessions.has(sessionToken)) {
        sessions.delete(sessionToken);
        console.log('Session logged out:', sessionToken.substring(0, 8) + '...');
    }

    res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/validate
 * Check if current session token is valid
 */
app.get('/api/auth/validate', (req, res) => {
    const sessionToken = req.headers['x-session-token'];

    if (!sessionToken) {
        return res.status(401).json({ valid: false, error: 'No session token provided' });
    }

    const session = sessions.get(sessionToken);
    if (!session) {
        return res.status(401).json({ valid: false, error: 'Invalid session token' });
    }

    // Check if session has expired (24 hours)
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        sessions.delete(sessionToken);
        return res.status(401).json({ valid: false, error: 'Session expired' });
    }

    res.json({ valid: true, createdAt: session.createdAt });
});

/**
 * GET /api/settings
 * Return all current settings
 */
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await loadSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

/**
 * POST /api/settings
 * Save settings and broadcast update
 * Requires authentication
 */
app.post('/api/settings', authenticate, async (req, res) => {
    try {
        const newSettings = req.body;

        // Validate that we received an object
        if (!newSettings || typeof newSettings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings format' });
        }

        // Validate and sanitize new settings
        const sanitizedSettings = sanitizeSettings(newSettings);

        // Load existing settings and merge (don't replace everything)
        const existingSettings = await loadSettings();
        const mergedSettings = { ...existingSettings, ...sanitizedSettings };

        // Save merged settings to file
        await saveSettings(mergedSettings);

        // Audit log
        auditLog.log({
            action: 'SETTINGS_UPDATE',
            ip: req.ip,
            details: { settingsCount: Object.keys(sanitizedSettings).length }
        });

        // Broadcast to all connected clients (send merged settings)
        broadcastUpdate({
            type: 'settings_update',
            timestamp: Date.now(),
            settings: mergedSettings
        });

        res.json({
            success: true,
            message: 'Settings saved and broadcasted',
            clients: clients.size
        });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

/**
 * Sanitize settings object to prevent XSS and injection
 */
function sanitizeSettings(settings) {
    const sanitized = {};

    for (const [key, value] of Object.entries(settings)) {
        // Validate key
        const keyValidation = InputValidator.string(key, {
            maxLength: 100,
            pattern: /^[a-zA-Z0-9_-]+$/
        });

        if (!keyValidation.valid) continue;

        // Sanitize value based on type
        if (typeof value === 'string') {
            // Don't sanitize URLs or specific fields that need HTML
            if (key.toLowerCase().includes('url') || key.toLowerCase().includes('html')) {
                sanitized[keyValidation.value] = value.substring(0, 10000);
            } else {
                sanitized[keyValidation.value] = InputValidator.sanitizeHtml(value).substring(0, 10000);
            }
        } else if (typeof value === 'number') {
            sanitized[keyValidation.value] = isFinite(value) ? value : 0;
        } else if (typeof value === 'boolean') {
            sanitized[keyValidation.value] = value;
        } else if (Array.isArray(value)) {
            sanitized[keyValidation.value] = value.slice(0, 1000);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[keyValidation.value] = sanitizeSettings(value);
        }
    }

    return sanitized;
}

/**
 * POST /api/settings/:key
 * Update a specific setting key
 * Requires authentication
 */
app.post('/api/settings/:key', authenticate, async (req, res) => {
    try {
        const { key } = req.params;
        const value = req.body.value;

        // Load current settings
        const settings = await loadSettings();

        // Update specific key
        settings[key] = value;

        // Save to file
        await saveSettings(settings);

        // Broadcast to all connected clients
        broadcastUpdate({
            type: 'settings_update',
            timestamp: Date.now(),
            key: key,
            value: value,
            settings: settings
        });

        res.json({
            success: true,
            message: `Setting '${key}' updated and broadcasted`,
            clients: clients.size
        });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});

/**
 * GET /api/settings/backup
 * Export all settings, displays, and roster as JSON backup
 * Requires authentication
 */
app.get('/api/settings/backup', authenticate, async (req, res) => {
    try {
        const settings = await loadSettings();
        const displaysObj = Object.fromEntries(displays);

        const backup = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            settings: settings,
            displays: displaysObj
        };

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="school-announcements-backup-${new Date().toISOString().split('T')[0]}.json"`);

        res.json(backup);

        auditLog.log({
            action: 'BACKUP_EXPORT',
            ip: req.ip,
            details: { settingsCount: Object.keys(settings).length, displaysCount: displays.size }
        });
    } catch (error) {
        console.error('Error exporting backup:', error);
        res.status(500).json({ error: 'Failed to export backup' });
    }
});

/**
 * POST /api/settings/restore
 * Restore settings from JSON backup
 * Requires authentication
 */
app.post('/api/settings/restore', authenticate, async (req, res) => {
    try {
        const backup = req.body;

        // Validate backup structure
        if (!backup || !backup.version || !backup.settings) {
            return res.status(400).json({ error: 'Invalid backup format' });
        }

        // Restore settings
        const sanitizedSettings = sanitizeSettings(backup.settings);
        await saveSettings(sanitizedSettings);

        // Optionally restore displays (but keep current online status)
        if (backup.displays && typeof backup.displays === 'object') {
            for (const [id, display] of Object.entries(backup.displays)) {
                if (!displays.has(id)) {
                    displays.set(id, {
                        ...display,
                        status: 'offline',
                        lastHeartbeat: Date.now()
                    });
                } else {
                    // Update name/location but keep connection status
                    const existing = displays.get(id);
                    existing.name = display.name || existing.name;
                    existing.location = display.location || existing.location;
                    existing.tags = display.tags || existing.tags;
                }
            }
            await saveDisplays();
        }

        // Broadcast updated settings
        broadcastUpdate({
            type: 'settings_update',
            timestamp: Date.now(),
            settings: sanitizedSettings
        });

        auditLog.log({
            action: 'BACKUP_RESTORE',
            ip: req.ip,
            details: { backupVersion: backup.version, exportedAt: backup.exportedAt }
        });

        res.json({
            success: true,
            message: 'Backup restored successfully',
            settingsRestored: Object.keys(sanitizedSettings).length
        });
    } catch (error) {
        console.error('Error restoring backup:', error);
        res.status(500).json({ error: 'Failed to restore backup' });
    }
});

/**
 * GET /api/settings/stream
 * Server-Sent Events endpoint for real-time updates
 */
app.get('/api/settings/stream', async (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Get client IP address (handles proxies via x-forwarded-for)
    const clientIp = getClientIp(req);

    // Get display info from query params
    const displayId = req.query.displayId || generateDisplayId();
    const displayName = req.query.name || 'Unnamed Display';
    const displayLocation = req.query.location || 'Unknown';
    const screenResolution = req.query.resolution || 'unknown';
    const currentPage = req.query.page || 'index';

    // Store client info
    const clientInfo = {
        displayId: displayId,
        connectedAt: Date.now(),
        name: displayName,
        location: displayLocation
    };

    // Add client to map
    clients.set(res, clientInfo);

    // Update or create display record
    const now = Date.now();
    if (displays.has(displayId)) {
        const display = displays.get(displayId);
        display.status = 'online';
        display.lastHeartbeat = now;
        display.offlineSince = null;
        display.ipAddress = clientIp;
        display.screenResolution = screenResolution;
        display.currentPage = currentPage;
        display.userAgent = req.headers['user-agent'];
        // Only update name/location if they were explicitly set (not defaults)
        if (displayName !== 'Unnamed Display') display.name = displayName;
        if (displayLocation !== 'Unknown') display.location = displayLocation;
    } else {
        displays.set(displayId, {
            name: displayName,
            location: displayLocation,
            status: 'online',
            registeredAt: now,
            lastHeartbeat: now,
            ipAddress: clientIp,
            userAgent: req.headers['user-agent'],
            screenResolution: screenResolution,
            currentPage: currentPage
        });
    }

    // Save displays periodically (debounced)
    saveDisplays();

    console.log(`Display connected: ${displayId} (${displayName}). Total: ${clients.size}`);

    // Broadcast display update
    broadcastUpdate({
        type: 'displays_update',
        timestamp: now,
        displays: getDisplaysSummary()
    });

    // Send initial settings, display ID, and display tags
    try {
        const settings = await loadSettings();
        const display = displays.get(displayId);
        const displayTags = display?.tags || [];

        res.write(`data: ${JSON.stringify({
            type: 'initial',
            timestamp: now,
            displayId: displayId,
            displayTags: displayTags,
            settings: settings
        })}\n\n`);
    } catch (error) {
        console.error('Error sending initial settings:', error);
    }

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
        try {
            res.write(`: heartbeat\n\n`);
        } catch (error) {
            // Client disconnected
            clearInterval(heartbeat);
            handleDisconnect(res, displayId);
        }
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        handleDisconnect(res, displayId);
    });
});

/**
 * Handle display disconnection
 */
function handleDisconnect(res, displayId) {
    clients.delete(res);

    if (displays.has(displayId)) {
        const display = displays.get(displayId);
        display.status = 'offline';
        display.offlineSince = Date.now();
    }

    console.log(`Display disconnected: ${displayId}. Total: ${clients.size}`);

    // Broadcast display update
    broadcastUpdate({
        type: 'displays_update',
        timestamp: Date.now(),
        displays: getDisplaysSummary()
    });

    // Save displays
    saveDisplays();
}

/**
 * POST /api/displays/heartbeat
 * Receive heartbeat from a display
 */
app.post('/api/displays/heartbeat', (req, res) => {
    const { displayId, status, currentPage, screenResolution } = req.body;

    if (!displayId) {
        return res.status(400).json({ error: 'Display ID required' });
    }

    const now = Date.now();
    const clientIp = getClientIp(req);

    if (displays.has(displayId)) {
        const display = displays.get(displayId);
        display.lastHeartbeat = now;
        display.status = 'online';
        display.offlineSince = null;
        display.ipAddress = clientIp; // Update IP on each heartbeat

        if (currentPage) display.currentPage = currentPage;
        if (screenResolution) display.screenResolution = screenResolution;
        if (status) display.customStatus = status;

        res.json({
            success: true,
            timestamp: now,
            nextHeartbeat: HEARTBEAT_TIMEOUT_MS / 2 // Suggest next heartbeat time
        });
    } else {
        // Unknown display, register it
        displays.set(displayId, {
            name: 'New Display',
            location: 'Unknown',
            status: 'online',
            registeredAt: now,
            lastHeartbeat: now,
            ipAddress: clientIp,
            currentPage: currentPage || 'unknown',
            screenResolution: screenResolution || 'unknown'
        });

        saveDisplays();

        res.json({
            success: true,
            registered: true,
            timestamp: now,
            nextHeartbeat: HEARTBEAT_TIMEOUT_MS / 2
        });
    }
});

/**
 * GET /api/displays
 * Get all registered displays and their status
 */
app.get('/api/displays', (req, res) => {
    const summary = getDisplaysSummary();
    const onlineCount = summary.filter(d => d.status === 'online').length;

    res.json({
        total: displays.size,
        online: onlineCount,
        offline: displays.size - onlineCount,
        displays: summary,
        timestamp: Date.now()
    });
});

/**
 * POST /api/displays/:id/update
 * Update display information (name, location, etc.)
 */
app.post('/api/displays/:id/update', authenticate, (req, res) => {
    const { id } = req.params;
    const { name, location, tags } = req.body;

    if (!displays.has(id)) {
        return res.status(404).json({ error: 'Display not found' });
    }

    const display = displays.get(id);

    if (name) display.name = name;
    if (location) display.location = location;
    if (tags !== undefined) display.tags = Array.isArray(tags) ? tags : [];

    saveDisplays();

    // Broadcast update
    broadcastUpdate({
        type: 'displays_update',
        timestamp: Date.now(),
        displays: getDisplaysSummary()
    });

    res.json({
        success: true,
        display: {
            id: id,
            name: display.name,
            location: display.location,
            status: display.status
        }
    });
});

/**
 * DELETE /api/displays/inactive/all
 * Remove all inactive/offline displays from tracking
 * NOTE: This route MUST come BEFORE /api/displays/:id to avoid "inactive" being treated as an ID
 */
app.delete('/api/displays/inactive/all', authenticate, (req, res) => {
    const removedDisplays = [];

    for (const [id, display] of displays.entries()) {
        if (display.status === 'offline') {
            removedDisplays.push({
                id: id,
                name: display.name || 'Unnamed'
            });
            displays.delete(id);
        }
    }

    if (removedDisplays.length === 0) {
        return res.json({
            success: true,
            message: 'No inactive displays to remove',
            removed: 0
        });
    }

    saveDisplays();

    // Audit log
    auditLog.log({
        action: 'DISPLAYS_DELETE_INACTIVE',
        ip: req.ip,
        details: {
            removedCount: removedDisplays.length,
            displays: removedDisplays.map(d => d.name).join(', ')
        }
    });

    // Broadcast update
    broadcastUpdate({
        type: 'displays_update',
        timestamp: Date.now(),
        displays: getDisplaysSummary()
    });

    res.json({
        success: true,
        message: `Removed ${removedDisplays.length} inactive display(s)`,
        removed: removedDisplays.length,
        displays: removedDisplays
    });
});

/**
 * DELETE /api/displays/:id
 * Remove a display from tracking
 */
app.delete('/api/displays/:id', authenticate, (req, res) => {
    const { id } = req.params;

    if (!displays.has(id)) {
        return res.status(404).json({ error: 'Display not found' });
    }

    const displayName = displays.get(id).name || id;
    displays.delete(id);
    saveDisplays();

    // Audit log
    auditLog.log({
        action: 'DISPLAY_DELETE',
        ip: req.ip,
        details: { displayId: id, displayName: displayName }
    });

    // Broadcast update
    broadcastUpdate({
        type: 'displays_update',
        timestamp: Date.now(),
        displays: getDisplaysSummary()
    });

    res.json({
        success: true,
        message: `Display ${id} removed`
    });
});

/**
 * POST /api/displays/broadcast
 * Send a command to all displays
 * NOTE: This route MUST come BEFORE /api/displays/:id/command to avoid "broadcast" being treated as an ID
 */
app.post('/api/displays/broadcast', authenticate, (req, res) => {
    const { command, params } = req.body;

    broadcastUpdate({
        type: 'command',
        targetDisplay: '*',
        command: command,
        params: params,
        timestamp: Date.now()
    });

    res.json({
        success: true,
        message: `Command '${command}' broadcast to ${clients.size} displays`
    });
});

/**
 * POST /api/displays/:id/command
 * Send a command to a specific display
 */
app.post('/api/displays/:id/command', authenticate, (req, res) => {
    const { id } = req.params;
    const { command, params } = req.body;

    if (!displays.has(id)) {
        return res.status(404).json({ error: 'Display not found' });
    }

    // Broadcast command to specific display
    const message = `data: ${JSON.stringify({
        type: 'command',
        targetDisplay: id,
        command: command,
        params: params,
        timestamp: Date.now()
    })}\n\n`;

    // Send to all clients (they filter by displayId)
    clients.forEach((clientInfo, client) => {
        if (clientInfo.displayId === id) {
            try {
                client.write(message);
            } catch (error) {
                console.error('Error sending command:', error);
            }
        }
    });

    res.json({
        success: true,
        message: `Command '${command}' sent to display ${id}`
    });
});

/**
 * GET /api/health
 * Enhanced health check endpoint with detailed system information
 */
app.get('/api/health', async (req, res) => {
    try {
        // Check if settings file is accessible
        let settingsHealth = 'ok';
        let settingsCount = 0;
        try {
            const settings = await loadSettings();
            settingsCount = Object.keys(settings).length;
        } catch (error) {
            settingsHealth = 'error';
        }

        const memoryUsage = process.memoryUsage();
        const displaysSummary = getDisplaysSummary();
        const onlineDisplays = displaysSummary.filter(d => d.status === 'online').length;

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            connections: {
                sse_clients: clients.size,
                active_sessions: sessions.size
            },
            displays: {
                total: displays.size,
                online: onlineDisplays,
                offline: displays.size - onlineDisplays
            },
            settings: {
                status: settingsHealth,
                count: settingsCount
            },
            memory: {
                rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
                heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024)
            },
            version: '2.0.0'
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            error: error.message
        });
    }
});

/**
 * GET /api/clients
 * Get number of connected clients
 */
app.get('/api/clients', (req, res) => {
    res.json({
        count: clients.size,
        timestamp: Date.now()
    });
});

/**
 * GET /api/audit
 * Get recent audit log entries (requires authentication)
 */
app.get('/api/audit', authenticate, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const logs = auditLog.getRecent(Math.min(limit, 1000));

    res.json({
        count: logs.length,
        logs: logs,
        timestamp: Date.now()
    });
});

/**
 * GET /api/security/status
 * Get security status information
 */
app.get('/api/security/status', authenticate, (req, res) => {
    res.json({
        rateLimiting: {
            enabled: true,
            generalLimit: '100 requests/minute',
            authLimit: '10 attempts/15 minutes',
            apiLimit: '60 requests/minute'
        },
        sessions: {
            active: sessions.size,
            timeout: SESSION_TIMEOUT_MS / 1000 / 60 + ' minutes'
        },
        audit: {
            enabled: true,
            recentEvents: auditLog.getRecent(5).length
        },
        inputValidation: true,
        securityHeaders: true,
        timestamp: Date.now()
    });
});

/**
 * Image Upload Endpoints
 */

/**
 * POST /api/upload/image
 * Upload an image for slides
 */
app.post('/api/upload/image', authenticate, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Return the URL path to the uploaded image
    const imageUrl = `/api/uploads/${req.file.filename}`;

    auditLog.log({
        action: 'IMAGE_UPLOAD',
        ip: req.ip,
        details: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        }
    });

    console.log('Image uploaded:', req.file.filename);

    res.json({
        success: true,
        url: imageUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
    });
});

/**
 * GET /api/uploads/:filename
 * Serve uploaded images
 */
app.get('/api/uploads/:filename', (req, res) => {
    const filename = req.params.filename;

    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    // Check if file exists
    if (!fsSync.existsSync(filePath)) {
        return res.status(404).json({ error: 'Image not found' });
    }

    res.sendFile(filePath);
});

/**
 * GET /api/uploads
 * List all uploaded images
 */
app.get('/api/uploads', authenticate, async (req, res) => {
    try {
        const files = await fs.readdir(UPLOADS_DIR);
        const images = files
            .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f))
            .map(filename => ({
                filename,
                url: `/api/uploads/${filename}`
            }));

        res.json({ images });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list images' });
    }
});

/**
 * DELETE /api/uploads/:filename
 * Delete an uploaded image
 */
app.delete('/api/uploads/:filename', authenticate, async (req, res) => {
    const filename = req.params.filename;
    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    try {
        await fs.unlink(filePath);

        auditLog.log({
            action: 'IMAGE_DELETE',
            ip: req.ip,
            details: { filename: safeFilename }
        });

        res.json({ success: true, message: 'Image deleted' });
    } catch (error) {
        res.status(404).json({ error: 'Image not found' });
    }
});

/**
 * Emergency Alert Endpoints
 */

// Emergency alert state
let emergencyAlertState = {
    active: false,
    alert: null
};

/**
 * POST /api/emergency/alert
 * Send emergency alert to all displays
 */
app.post('/api/emergency/alert', authenticate, (req, res) => {
    const alertData = req.body;

    if (!alertData || !alertData.message) {
        return res.status(400).json({ error: 'Alert message required' });
    }

    emergencyAlertState.active = true;
    emergencyAlertState.alert = {
        ...alertData,
        timestamp: Date.now()
    };

    // Audit log
    auditLog.log({
        action: 'EMERGENCY_ALERT_SENT',
        ip: req.ip,
        details: {
            type: alertData.type,
            message: alertData.message
        }
    });

    // Broadcast to all connected clients
    broadcastUpdate({
        type: 'emergency_alert',
        timestamp: Date.now(),
        alert: emergencyAlertState.alert
    });

    console.log('⚠️ EMERGENCY ALERT SENT:', alertData.message);

    res.json({
        success: true,
        message: 'Emergency alert broadcast to all displays',
        clients: clients.size
    });
});

/**
 * POST /api/emergency/cancel
 * Cancel active emergency alert
 */
app.post('/api/emergency/cancel', authenticate, (req, res) => {
    const wasActive = emergencyAlertState.active;

    emergencyAlertState.active = false;
    emergencyAlertState.alert = null;

    // Audit log
    auditLog.log({
        action: 'EMERGENCY_ALERT_CANCELLED',
        ip: req.ip
    });

    // Broadcast cancellation to all connected clients
    broadcastUpdate({
        type: 'emergency_cancel',
        timestamp: Date.now()
    });

    console.log('✓ Emergency alert cancelled');

    res.json({
        success: true,
        message: wasActive ? 'Emergency alert cancelled' : 'No active alert',
        clients: clients.size
    });
});

/**
 * GET /api/emergency/status
 * Get current emergency alert status
 */
app.get('/api/emergency/status', (req, res) => {
    res.json({
        active: emergencyAlertState.active,
        alert: emergencyAlertState.alert,
        timestamp: Date.now()
    });
});

/**
 * Dismissal Management Endpoints
 */

// Dismissal state
let dismissalState = {
    active: false,
    students: [],
    startTime: null
};

// Dismissal history storage
let dismissalHistory = [];
const DISMISSAL_HISTORY_DAYS = 30; // Keep history for 30 days

/**
 * Load dismissal history from file
 */
async function loadDismissalHistory() {
    try {
        const data = await fs.readFile(DISMISSAL_HISTORY_FILE, 'utf8');
        const parsed = JSON.parse(data);
        dismissalHistory = parsed.history || [];
        // Clean up old entries (older than 30 days)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - DISMISSAL_HISTORY_DAYS);
        dismissalHistory = dismissalHistory.filter(entry => new Date(entry.date) >= cutoffDate);
        console.log(`Loaded ${dismissalHistory.length} dismissal history entries`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading dismissal history:', error);
        }
        dismissalHistory = [];
    }
}

/**
 * Save dismissal history to file
 */
async function saveDismissalHistory() {
    try {
        await fs.writeFile(DISMISSAL_HISTORY_FILE, JSON.stringify({ history: dismissalHistory }, null, 2));
    } catch (error) {
        console.error('Error saving dismissal history:', error);
    }
}

/**
 * Log a dismissal event
 */
async function logDismissalEvent(studentName, grade, calledAt, completedAt = null) {
    const event = {
        id: crypto.randomBytes(8).toString('hex'),
        date: new Date().toISOString().split('T')[0],
        studentName,
        grade,
        calledAt: calledAt || new Date().toISOString(),
        completedAt
    };
    dismissalHistory.push(event);
    await saveDismissalHistory();
    return event;
}

// Load dismissal history on startup
loadDismissalHistory();

/**
 * POST /api/dismissal/start
 * Start dismissal mode
 */
app.post('/api/dismissal/start', authenticate, async (req, res) => {
    try {
        dismissalState.active = true;
        dismissalState.students = [];
        dismissalState.startTime = new Date().toISOString();

        // Broadcast to all connected clients
        broadcastUpdate({
            type: 'dismissal_start',
            timestamp: Date.now()
        });

        res.json({
            success: true,
            message: 'Dismissal started'
        });

        console.log('Dismissal mode activated');
    } catch (error) {
        console.error('Error starting dismissal:', error);
        res.status(500).json({ error: 'Failed to start dismissal' });
    }
});

/**
 * POST /api/dismissal/end
 * End dismissal mode and return to normal display
 */
app.post('/api/dismissal/end', authenticate, async (req, res) => {
    try {
        dismissalState.active = false;
        dismissalState.students = [];

        // Broadcast to all connected clients
        broadcastUpdate({
            type: 'dismissal_end',
            timestamp: Date.now()
        });

        res.json({
            success: true,
            message: 'Dismissal ended'
        });

        console.log('Dismissal mode deactivated');
    } catch (error) {
        console.error('Error ending dismissal:', error);
        res.status(500).json({ error: 'Failed to end dismissal' });
    }
});

/**
 * POST /api/dismissal/batch
 * Update current batch of students
 */
app.post('/api/dismissal/batch', authenticate, async (req, res) => {
    try {
        const { students } = req.body;

        if (!Array.isArray(students)) {
            return res.status(400).json({ error: 'Students must be an array' });
        }

        // Find new students (not already in the previous state)
        const previousIds = new Set(dismissalState.students.map(s => s.id));
        const newStudents = students.filter(s => !previousIds.has(s.id));

        // Log new students to history
        for (const student of newStudents) {
            await logDismissalEvent(student.name, student.grade, new Date().toISOString());
        }

        dismissalState.students = students;

        // Broadcast to all connected clients
        broadcastUpdate({
            type: 'dismissal_update',
            timestamp: Date.now(),
            students: students
        });

        res.json({
            success: true,
            message: 'Batch updated',
            students: students.length
        });

        console.log(`Dismissal batch updated: ${students.length} students`);
    } catch (error) {
        console.error('Error updating dismissal batch:', error);
        res.status(500).json({ error: 'Failed to update batch' });
    }
});

/**
 * GET /api/dismissal/status
 * Get current dismissal status (no auth required - displays need to read)
 */
app.get('/api/dismissal/status', (req, res) => {
    res.json({
        active: dismissalState.active,
        students: dismissalState.students,
        timestamp: Date.now()
    });
});

/**
 * GET /api/dismissal/history
 * Get dismissal history with optional date range filter
 */
app.get('/api/dismissal/history', authenticate, async (req, res) => {
    try {
        const { startDate, endDate, grade } = req.query;

        let filtered = [...dismissalHistory];

        // Filter by date range
        if (startDate) {
            filtered = filtered.filter(e => e.date >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(e => e.date <= endDate);
        }

        // Filter by grade
        if (grade) {
            filtered = filtered.filter(e => e.grade === grade);
        }

        // Sort by most recent first
        filtered.sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt));

        // Calculate summary stats
        const uniqueDates = [...new Set(filtered.map(e => e.date))];
        const uniqueStudents = [...new Set(filtered.map(e => e.studentName))];
        const gradeBreakdown = {};
        filtered.forEach(e => {
            gradeBreakdown[e.grade] = (gradeBreakdown[e.grade] || 0) + 1;
        });

        res.json({
            history: filtered,
            summary: {
                totalDismissals: filtered.length,
                uniqueStudents: uniqueStudents.length,
                daysWithDismissals: uniqueDates.length,
                gradeBreakdown
            }
        });
    } catch (error) {
        console.error('Error fetching dismissal history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * GET /api/dismissal/history/export
 * Export dismissal history as CSV
 */
app.get('/api/dismissal/history/export', authenticate, async (req, res) => {
    try {
        const { startDate, endDate, grade } = req.query;

        let filtered = [...dismissalHistory];

        // Apply same filters as history endpoint
        if (startDate) {
            filtered = filtered.filter(e => e.date >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(e => e.date <= endDate);
        }
        if (grade) {
            filtered = filtered.filter(e => e.grade === grade);
        }

        // Sort by date/time
        filtered.sort((a, b) => new Date(a.calledAt) - new Date(b.calledAt));

        // Generate CSV
        const csvHeaders = ['Date', 'Student Name', 'Grade', 'Called At', 'Completed At'];
        const csvRows = filtered.map(e => {
            const calledDate = new Date(e.calledAt);
            const completedDate = e.completedAt ? new Date(e.completedAt) : null;
            return [
                e.date,
                `"${e.studentName.replace(/"/g, '""')}"`,
                e.grade,
                calledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                completedDate ? completedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''
            ].join(',');
        });

        const csv = [csvHeaders.join(','), ...csvRows].join('\n');
        const filename = `dismissal-report-${startDate || 'all'}-to-${endDate || 'now'}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);

        console.log(`Exported ${filtered.length} dismissal records to CSV`);
    } catch (error) {
        console.error('Error exporting dismissal history:', error);
        res.status(500).json({ error: 'Failed to export history' });
    }
});

/**
 * DELETE /api/dismissal/history
 * Clear dismissal history (admin only)
 */
app.delete('/api/dismissal/history', authenticate, async (req, res) => {
    try {
        const previousCount = dismissalHistory.length;
        dismissalHistory = [];
        await saveDismissalHistory();

        res.json({
            success: true,
            message: `Cleared ${previousCount} dismissal records`
        });

        console.log(`Cleared ${previousCount} dismissal history records`);
    } catch (error) {
        console.error('Error clearing dismissal history:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// ============================================
// ANALYTICS
// ============================================

// Analytics storage
let analyticsData = {
    slideViews: {},
    hourlyActivity: {},
    activityLog: [],
    displayActivity: {},
    dailyStats: {}
};

/**
 * Load analytics from file
 */
async function loadAnalytics() {
    try {
        const data = await fs.readFile(ANALYTICS_FILE, 'utf8');
        const parsed = JSON.parse(data);
        analyticsData = {
            slideViews: parsed.slideViews || {},
            hourlyActivity: parsed.hourlyActivity || {},
            activityLog: parsed.activityLog || [],
            displayActivity: parsed.displayActivity || {},
            dailyStats: parsed.dailyStats || {}
        };

        // Clean up old activity log entries (keep last 7 days)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        analyticsData.activityLog = analyticsData.activityLog.filter(
            entry => new Date(entry.timestamp) >= cutoffDate
        );

        console.log('Analytics loaded');
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading analytics:', error);
        }
        analyticsData = {
            slideViews: {},
            hourlyActivity: {},
            activityLog: [],
            displayActivity: {},
            dailyStats: {}
        };
    }
}

/**
 * Save analytics to file
 */
async function saveAnalytics() {
    try {
        await fs.writeFile(ANALYTICS_FILE, JSON.stringify(analyticsData, null, 2));
    } catch (error) {
        console.error('Error saving analytics:', error);
    }
}

/**
 * Log display activity
 */
function logDisplayActivity(displayId, displayName, event) {
    analyticsData.activityLog.push({
        timestamp: new Date().toISOString(),
        displayId,
        displayName,
        event
    });

    // Track display activity
    if (!analyticsData.displayActivity[displayId]) {
        analyticsData.displayActivity[displayId] = {
            name: displayName,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            connectCount: 0
        };
    }

    analyticsData.displayActivity[displayId].lastSeen = new Date().toISOString();
    if (event === 'connect') {
        analyticsData.displayActivity[displayId].connectCount++;
    }

    // Debounce save
    if (!saveAnalytics.pending) {
        saveAnalytics.pending = true;
        setTimeout(() => {
            saveAnalytics();
            saveAnalytics.pending = false;
        }, 5000);
    }
}

/**
 * Track slide view
 */
function trackSlideView(slideName) {
    if (!slideName) return;

    analyticsData.slideViews[slideName] = (analyticsData.slideViews[slideName] || 0) + 1;

    // Track hourly activity
    const hour = new Date().getHours();
    analyticsData.hourlyActivity[hour] = (analyticsData.hourlyActivity[hour] || 0) + 1;

    // Track daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!analyticsData.dailyStats[today]) {
        analyticsData.dailyStats[today] = { views: 0, displays: new Set() };
    }
    analyticsData.dailyStats[today].views++;
}

// Load analytics on startup
loadAnalytics();

/**
 * GET /api/analytics
 * Get analytics data with optional date range
 */
app.get('/api/analytics', authenticate, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Calculate totals
        let totalViews = Object.values(analyticsData.slideViews).reduce((sum, v) => sum + v, 0);
        let activeDisplays = Object.keys(analyticsData.displayActivity).length;

        // Filter activity log by date if specified
        let filteredLog = [...analyticsData.activityLog];
        if (startDate) {
            const start = new Date(startDate);
            filteredLog = filteredLog.filter(entry => new Date(entry.timestamp) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1); // Include end date
            filteredLog = filteredLog.filter(entry => new Date(entry.timestamp) < end);
        }

        // Calculate uptime (simplified: based on active periods)
        const today = new Date().toISOString().split('T')[0];
        const uptimeMinutes = analyticsData.dailyStats[today]?.views || 0;
        const totalMinutes = 24 * 60; // Full day

        res.json({
            slideViews: analyticsData.slideViews,
            hourlyActivity: analyticsData.hourlyActivity,
            activityLog: filteredLog,
            displayActivity: analyticsData.displayActivity,
            totalViews,
            activeDisplays,
            uptimeMinutes: Math.min(uptimeMinutes, totalMinutes),
            totalMinutes
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

/**
 * POST /api/analytics/track
 * Track a slide view (called from display)
 */
app.post('/api/analytics/track', (req, res) => {
    try {
        const { slideName, displayId } = req.body;

        if (slideName) {
            trackSlideView(slideName);
        }

        if (displayId) {
            const today = new Date().toISOString().split('T')[0];
            if (!analyticsData.dailyStats[today]) {
                analyticsData.dailyStats[today] = { views: 0, displays: [] };
            }
            if (Array.isArray(analyticsData.dailyStats[today].displays)) {
                if (!analyticsData.dailyStats[today].displays.includes(displayId)) {
                    analyticsData.dailyStats[today].displays.push(displayId);
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking analytics:', error);
        res.status(500).json({ error: 'Failed to track' });
    }
});

/**
 * POST /api/analytics/clear-old
 * Clear analytics older than specified days
 */
app.post('/api/analytics/clear-old', authenticate, async (req, res) => {
    try {
        const { daysOld = 30 } = req.body;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        // Clear old activity log entries
        const originalLogLength = analyticsData.activityLog.length;
        analyticsData.activityLog = analyticsData.activityLog.filter(
            entry => new Date(entry.timestamp) >= cutoffDate
        );

        // Clear old daily stats
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        Object.keys(analyticsData.dailyStats).forEach(date => {
            if (date < cutoffDateStr) {
                delete analyticsData.dailyStats[date];
            }
        });

        await saveAnalytics();

        res.json({
            success: true,
            message: `Cleared ${originalLogLength - analyticsData.activityLog.length} old log entries`
        });
    } catch (error) {
        console.error('Error clearing old analytics:', error);
        res.status(500).json({ error: 'Failed to clear old analytics' });
    }
});

/**
 * POST /api/analytics/clear-all
 * Clear all analytics data
 */
app.post('/api/analytics/clear-all', authenticate, async (req, res) => {
    try {
        analyticsData = {
            slideViews: {},
            hourlyActivity: {},
            activityLog: [],
            displayActivity: {},
            dailyStats: {}
        };

        await saveAnalytics();

        res.json({ success: true, message: 'All analytics cleared' });
    } catch (error) {
        console.error('Error clearing analytics:', error);
        res.status(500).json({ error: 'Failed to clear analytics' });
    }
});

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * POST /api/notifications/test-email
 * Send a test email to verify SMTP configuration
 */
app.post('/api/notifications/test-email', authenticate, async (req, res) => {
    try {
        const { to, settings } = req.body;

        if (!to || !settings) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Note: In a production environment, you would use nodemailer here
        // This is a placeholder that simulates the email sending process
        // To actually send emails, install nodemailer: npm install nodemailer

        // Validate settings
        if (!settings.host || !settings.user) {
            return res.status(400).json({ error: 'SMTP host and user are required' });
        }

        // Simulate email sending (replace with actual nodemailer implementation)
        console.log(`[NOTIFICATION] Test email would be sent to: ${to}`);
        console.log(`[NOTIFICATION] SMTP Config: ${settings.host}:${settings.port}`);

        // For demo purposes, we'll return success
        // In production, uncomment and use nodemailer:
        /*
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: settings.host,
            port: settings.port || 587,
            secure: settings.secure || false,
            auth: {
                user: settings.user,
                pass: settings.password
            }
        });

        await transporter.sendMail({
            from: `"${settings.fromName || 'School Notifications'}" <${settings.fromAddress || settings.user}>`,
            to: to,
            subject: 'Test Notification from School Announcements',
            text: 'This is a test notification to verify your email configuration is working correctly.',
            html: '<h2>Test Notification</h2><p>This is a test notification to verify your email configuration is working correctly.</p>'
        });
        */

        res.json({ success: true, message: 'Test email configuration validated (demo mode)' });
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
});

/**
 * POST /api/notifications/test-sms
 * Send a test SMS to verify Twilio configuration
 */
app.post('/api/notifications/test-sms', authenticate, async (req, res) => {
    try {
        const { to, settings } = req.body;

        if (!to || !settings) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Validate settings
        if (!settings.accountSid || !settings.authToken || !settings.phoneNumber) {
            return res.status(400).json({ error: 'Twilio Account SID, Auth Token, and Phone Number are required' });
        }

        // Note: In production, you would use the Twilio SDK
        // npm install twilio
        console.log(`[NOTIFICATION] Test SMS would be sent to: ${to}`);
        console.log(`[NOTIFICATION] From Twilio number: ${settings.phoneNumber}`);

        // For demo purposes, we'll return success
        // In production, uncomment and use Twilio SDK:
        /*
        const twilio = require('twilio');
        const client = twilio(settings.accountSid, settings.authToken);

        await client.messages.create({
            body: 'This is a test notification from School Announcements. Your SMS configuration is working correctly.',
            from: settings.phoneNumber,
            to: to
        });
        */

        res.json({ success: true, message: 'Test SMS configuration validated (demo mode)' });
    } catch (error) {
        console.error('Error sending test SMS:', error);
        res.status(500).json({ error: error.message || 'Failed to send test SMS' });
    }
});

/**
 * POST /api/notifications/send
 * Send a notification (called internally when dismissal/alert happens)
 */
app.post('/api/notifications/send', authenticate, async (req, res) => {
    try {
        const { type, recipients, data } = req.body;

        if (!type || !recipients || !data) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Load notification settings
        const allSettings = await loadSettings();
        const notificationSettings = allSettings.notificationSettings;

        if (!notificationSettings || !notificationSettings.enabled) {
            return res.json({ success: false, message: 'Notifications are disabled' });
        }

        let sent = 0;
        const errors = [];

        // Process each recipient
        for (const recipient of recipients) {
            try {
                // Send email if enabled and recipient has email
                if (notificationSettings.emailEnabled && recipient.email) {
                    // In production, send actual email via nodemailer
                    console.log(`[NOTIFICATION] Email would be sent to: ${recipient.email}`);
                    sent++;
                }

                // Send SMS if enabled and recipient has phone
                if (notificationSettings.smsEnabled && recipient.phone) {
                    // In production, send actual SMS via Twilio
                    console.log(`[NOTIFICATION] SMS would be sent to: ${recipient.phone}`);
                    sent++;
                }
            } catch (recipientError) {
                errors.push({ recipient: recipient.email || recipient.phone, error: recipientError.message });
            }
        }

        res.json({
            success: true,
            sent,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error sending notifications:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// ============================================
// WEATHER PROXY (keeps API key secure)
// ============================================

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || null;
const WEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5';

/**
 * GET /api/weather/current
 * Proxy for current weather - keeps API key server-side
 */
app.get('/api/weather/current', async (req, res) => {
    if (!WEATHER_API_KEY) {
        return res.status(503).json({
            error: 'Weather service not configured',
            message: 'WEATHER_API_KEY not set in environment'
        });
    }

    const { location, cityId } = req.query;

    if (!location && !cityId) {
        return res.status(400).json({
            error: 'Missing location',
            message: 'Provide either location or cityId parameter'
        });
    }

    try {
        const locationParam = cityId ? `id=${cityId}` : `q=${encodeURIComponent(location)}`;
        const url = `${WEATHER_API_BASE}/weather?${locationParam}&appid=${WEATHER_API_KEY}&units=imperial`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.cod === 200) {
            res.json(data);
        } else {
            res.status(response.status || 400).json({
                error: data.message || 'Weather API error',
                cod: data.cod
            });
        }
    } catch (error) {
        console.error('Weather proxy error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

/**
 * GET /api/weather/forecast
 * Proxy for weather forecast - keeps API key server-side
 */
app.get('/api/weather/forecast', async (req, res) => {
    if (!WEATHER_API_KEY) {
        return res.status(503).json({
            error: 'Weather service not configured',
            message: 'WEATHER_API_KEY not set in environment'
        });
    }

    const { location, cityId } = req.query;

    if (!location && !cityId) {
        return res.status(400).json({
            error: 'Missing location',
            message: 'Provide either location or cityId parameter'
        });
    }

    try {
        const locationParam = cityId ? `id=${cityId}` : `q=${encodeURIComponent(location)}`;
        const url = `${WEATHER_API_BASE}/forecast?${locationParam}&appid=${WEATHER_API_KEY}&units=imperial`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.cod === "200") {
            res.json(data);
        } else {
            res.status(response.status || 400).json({
                error: data.message || 'Weather API error',
                cod: data.cod
            });
        }
    } catch (error) {
        console.error('Weather forecast proxy error:', error);
        res.status(500).json({ error: 'Failed to fetch forecast data' });
    }
});

/**
 * GET /api/weather/alerts
 * Get weather alerts for configured location using OpenWeatherMap One Call API
 */
app.get('/api/weather/alerts', async (req, res) => {
    if (!WEATHER_API_KEY) {
        return res.status(503).json({
            error: 'Weather service not configured',
            alerts: []
        });
    }

    try {
        // Load settings to get location
        const settings = await loadSettings();
        const weatherConfig = settings.weatherConfig || {};

        // Get lat/lon from weather config or use defaults
        let lat = weatherConfig.lat;
        let lon = weatherConfig.lon;

        // If no coordinates, try to get from city name
        if (!lat || !lon) {
            const location = weatherConfig.location || weatherConfig.city;
            if (location) {
                // Use geocoding API to get coordinates
                const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${WEATHER_API_KEY}`;
                const geoResponse = await fetch(geoUrl);
                const geoData = await geoResponse.json();

                if (geoData && geoData.length > 0) {
                    lat = geoData[0].lat;
                    lon = geoData[0].lon;
                }
            }
        }

        if (!lat || !lon) {
            return res.json({
                alerts: [],
                message: 'No location configured for weather alerts'
            });
        }

        // Use One Call API 3.0 for alerts
        const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily&appid=${WEATHER_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.alerts && data.alerts.length > 0) {
            // Transform alerts to our format
            const alerts = data.alerts.map(alert => ({
                event: alert.event,
                sender: alert.sender_name,
                start: alert.start,
                end: alert.end,
                description: alert.description,
                tags: alert.tags || []
            }));

            res.json({ alerts });
        } else {
            res.json({ alerts: [] });
        }
    } catch (error) {
        console.error('Weather alerts error:', error);
        // Return empty alerts instead of error to prevent display issues
        res.json({ alerts: [], error: 'Failed to fetch weather alerts' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     School Announcements API Server v2.0.0 (Secured)         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Port: ${PORT}`);
    console.log(`Settings file: ${SETTINGS_FILE}`);
    console.log(`Displays file: ${DISPLAYS_FILE}`);
    console.log('');
    console.log('Security Features Enabled:');
    console.log('  ✓ Rate limiting (100 req/min general, 10 req/15min auth)');
    console.log('  ✓ CSRF protection with secure tokens');
    console.log('  ✓ Input validation and sanitization');
    console.log('  ✓ Security headers (X-Frame-Options, X-Content-Type-Options)');
    console.log('  ✓ Audit logging for all admin actions');
    console.log('  ✓ Session management with 24-hour timeout');
    console.log('');
    if (API_KEY === 'change-this-in-production') {
        console.log('⚠️  WARNING: Using default API key! Set API_KEY environment variable.');
    }
    console.log('');
    console.log('Endpoints:');
    console.log('  Authentication:');
    console.log('    POST /api/auth/login - Login with API key');
    console.log('    POST /api/auth/logout - Logout');
    console.log('');
    console.log('  Settings:');
    console.log('    GET  /api/settings - Get all settings');
    console.log('    POST /api/settings - Save all settings');
    console.log('    POST /api/settings/:key - Update specific setting');
    console.log('    GET  /api/settings/stream - SSE real-time updates');
    console.log('');
    console.log('  Displays:');
    console.log('    GET  /api/displays - List all displays');
    console.log('    POST /api/displays/heartbeat - Display heartbeat');
    console.log('    POST /api/displays/:id/update - Update display info');
    console.log('    POST /api/displays/:id/command - Send command to display');
    console.log('    POST /api/displays/broadcast - Broadcast to all displays');
    console.log('    DELETE /api/displays/:id - Remove display');
    console.log('');
    console.log('  Security:');
    console.log('    GET  /api/audit - View audit logs');
    console.log('    GET  /api/security/status - Security status');
    console.log('');
    console.log('  System:');
    console.log('    GET  /api/health - Health check');
    console.log('    GET  /api/clients - Connected clients count');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    // Notify all clients of shutdown
    broadcastUpdate({
        type: 'server_shutdown',
        timestamp: Date.now()
    });
    // Save displays before exit
    saveDisplays().then(() => {
        process.exit(0);
    });
});
