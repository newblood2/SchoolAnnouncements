/**
 * Service Worker - Offline Resilience
 * Caches critical assets and provides fallback when network is unavailable
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `school-announcements-${CACHE_VERSION}`;

// Assets to cache for offline use
const CRITICAL_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/config.js',
    '/js/constants.js',
    '/js/error-handler.js',
    '/js/config-validator.js',
    '/js/cache.js',
    '/js/theme-loader.js',
    '/js/datetime.js',
    '/js/weather.js',
    '/js/slideshow.js',
    '/js/livestream.js',
    '/js/init.js',
    // Fonts
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching critical assets');
                return cache.addAll(CRITICAL_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim(); // Take control immediately
            })
    );
});

// Fetch event - network first, then cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip livestream URLs (never cache video streams)
    if (url.pathname.includes('/stream/') || url.port === '8889') {
        return;
    }

    // Strategy: Network first, cache fallback
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Clone the response before caching
                const responseToCache = response.clone();

                // Cache successful responses for critical assets
                if (response.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }

                return response;
            })
            .catch(() => {
                // Network failed - try cache
                return caches.match(request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            console.log('[Service Worker] Serving from cache:', request.url);
                            return cachedResponse;
                        }

                        // No cache available - return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }

                        // For other requests, return a basic response
                        return new Response('Network error and no cached version available', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Message event - handle commands from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.delete(CACHE_NAME).then(() => {
                return caches.open(CACHE_NAME).then((cache) => {
                    return cache.addAll(CRITICAL_ASSETS);
                });
            })
        );
    }
});
