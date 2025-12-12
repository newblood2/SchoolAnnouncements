/**
 * @fileoverview Livestream Module - Automatic stream detection and display switching
 * @module livestream
 * @description Manages livestream display with automatic online/offline detection.
 * Seamlessly switches between livestream (when available) and slideshow (fallback).
 * Supports YouTube Live, OBS streams, and other iframe-compatible video sources.
 *
 * @example
 * // Module initializes automatically if AUTO_DETECT_LIVESTREAM is enabled
 * // Public API for manual control:
 * window.Livestream.show('https://youtube.com/embed/VIDEO_ID');
 * window.Livestream.toggle(); // Toggle between stream and slideshow
 * window.Livestream.isActive(); // Check if livestream is showing
 *
 * @requires module:constants - For check intervals and element IDs
 * @requires module:slideshow - For fallback display
 * @requires module:error-handler - For error notifications
 */

(function() {
    'use strict';

    // Import constants
    const CONSTANTS = window.APP_CONSTANTS;

    // State
    let livestreamMonitorInterval = null;
    let isLivestreamActive = false;

    /**
     * Shows or hides the livestream
     * @param {string|null} url - Livestream URL or null to hide
     */
    function showLivestream(url) {
        const livestreamFrame = document.getElementById(CONSTANTS.ELEMENT_IDS.LIVESTREAM_FRAME);
        if (!livestreamFrame) {
            console.error(CONSTANTS.ERROR_MESSAGES.LIVESTREAM_FRAME_NOT_FOUND);
            return;
        }

        if (url) {
            activateLivestream(livestreamFrame, url);
        } else {
            deactivateLivestream(livestreamFrame);
        }
    }

    /**
     * Activates the livestream display by injecting iframe into slideshow widget
     * @param {HTMLElement} livestreamFrame - Livestream iframe element
     * @param {string} url - Livestream URL
     */
    function activateLivestream(livestreamFrame, url) {
        // Stop slideshow animations
        if (window.Slideshow) {
            window.Slideshow.hide();
        }

        // Add autoplay parameter for MediaMTX streams
        let streamUrl = url;
        if (url.includes('8889') || url.includes('/stream/')) {
            const separator = url.includes('?') ? '&' : '?';
            streamUrl = url + separator + 'autoplay=yes';
        }

        // Find the slideshow widget (grid layout)
        const slideshowWidget = document.querySelector('.widget-slideshow');

        if (slideshowWidget) {
            // Hide ALL children of the slideshow widget (the slideshow content)
            Array.from(slideshowWidget.children).forEach(child => {
                if (child !== livestreamFrame) {
                    child.style.display = 'none';
                }
            });

            // Style iframe to fill the widget completely
            livestreamFrame.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 12px;
                z-index: 10;
                display: block;
            `;

            // Ensure widget fills properly for absolute child
            slideshowWidget.style.position = 'relative';
            slideshowWidget.style.overflow = 'hidden';
            slideshowWidget.style.display = 'block';

            // Move iframe into the widget
            if (livestreamFrame.parentElement !== slideshowWidget) {
                slideshowWidget.appendChild(livestreamFrame);
            }
        }

        // Set source and show
        livestreamFrame.src = streamUrl;
        livestreamFrame.style.display = 'block';
        isLivestreamActive = true;
        console.log('Switched to livestream:', streamUrl);
    }

    /**
     * Deactivates the livestream display and restores slideshow
     * @param {HTMLElement} livestreamFrame - Livestream iframe element
     */
    function deactivateLivestream(livestreamFrame) {
        // Hide livestream
        livestreamFrame.style.display = 'none';
        livestreamFrame.src = '';
        isLivestreamActive = false;

        // Restore the slideshow widget children and display
        const slideshowWidget = document.querySelector('.widget-slideshow');
        if (slideshowWidget) {
            // Restore flex display
            slideshowWidget.style.display = 'flex';
            slideshowWidget.style.flexDirection = 'column';

            Array.from(slideshowWidget.children).forEach(child => {
                if (child !== livestreamFrame) {
                    child.style.display = '';
                }
            });
        }

        // Restart slideshow
        if (window.Slideshow) {
            window.Slideshow.show();
        }
        console.log('Switched to slideshow');
    }

    /**
     * Checks if a livestream URL is accessible
     * @param {string} url - Livestream URL to check
     * @returns {Promise<boolean>} True if stream is available
     */
    async function checkLivestreamStatus(url) {
        if (!url) return false;

        try {
            // For YouTube embeds, assume available (iframe will handle errors)
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                return true;
            }

            // For stream-viewer.html (WebRTC), check the default 'announcements' stream
            if (url.includes('stream-viewer.html')) {
                // Extract stream name from URL params if present, default to 'announcements'
                let streamName = 'announcements';
                try {
                    const urlObj = new URL(url, window.location.origin);
                    streamName = urlObj.searchParams.get('stream') || 'announcements';
                } catch (e) {
                    // URL parsing failed, use default
                }

                console.log('Checking MediaMTX stream (via stream-viewer):', streamName);
                return await checkMediaMTXStream(streamName);
            }

            // For MediaMTX streams, check the stream API
            if (url.includes(':8889/') || url.includes('/stream/') || url.includes('mediamtx') || url.includes('whip')) {
                try {
                    // Extract stream name from URL
                    // Supports: /stream/mystream/, /stream/mystream/whip, http://localhost:8889/mystream/
                    let streamName;

                    // Remove trailing slash and query parameters for parsing
                    const cleanUrl = url.split('?')[0].replace(/\/$/, '').replace(/\/whip$/, '').replace(/\/whep$/, '');

                    if (cleanUrl.includes('/stream/')) {
                        // Proxied stream: /stream/mystream → extract "mystream"
                        streamName = cleanUrl.split('/stream/')[1].split('/')[0];
                    } else {
                        // Direct stream: http://host:8889/mystream → extract "mystream"
                        streamName = cleanUrl.split('/').pop();
                    }

                    console.log('Checking MediaMTX stream:', streamName);
                    return await checkMediaMTXStream(streamName);

                } catch (error) {
                    console.log('MediaMTX stream check failed:', error.message);
                    return false;
                }
            }

            // For other streams (OBS, RTMP, HLS, etc.), try to fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.LIVESTREAM_CHECK_TIMEOUT_MS || 5000);

            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors', // Avoid CORS issues
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return true; // If we get here, stream is likely available

        } catch (error) {
            console.log('Livestream not available:', error.message);
            return false;
        }
    }

    /**
     * Check MediaMTX stream status via API
     * @param {string} streamName - Name of the stream to check
     * @returns {Promise<boolean>} True if stream has active publisher
     */
    async function checkMediaMTXStream(streamName) {
        try {
            // Check MediaMTX API for stream status
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.LIVESTREAM_CHECK_TIMEOUT_MS || 5000);

            const apiUrl = `/api/stream/${streamName}/status`;
            const response = await fetch(apiUrl, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            // Check if stream is online (has active publisher)
            if (data.online) {
                console.log('MediaMTX stream status: ONLINE', data.source);
                return true;
            }

            // Check for error or offline
            if (data.error) {
                console.log('MediaMTX stream offline:', data.error);
            } else {
                console.log('MediaMTX stream offline (no publisher)');
            }
            return false;

        } catch (error) {
            console.log('MediaMTX stream check failed:', error.message);
            return false;
        }
    }

    /**
     * Checks livestream status and switches display accordingly
     */
    async function checkAndSwitch() {
        const livestreamUrl = window.CONFIG && window.CONFIG.LIVESTREAM_URL;
        if (!livestreamUrl) return;

        try {
            const isOnline = await checkLivestreamStatus(livestreamUrl);

            if (isOnline && !isLivestreamActive) {
                console.log('Livestream detected online, switching...');
                showLivestream(livestreamUrl);
            } else if (!isOnline && isLivestreamActive) {
                console.log('Livestream went offline, switching to slideshow...');
                showLivestream(null);
            }
        } catch (error) {
            window.ErrorHandler.handle(error, {
                level: window.ErrorLevel.WARNING,
                module: 'Livestream',
                showNotification: false, // Don't notify for routine checks
                userMessage: 'Failed to check livestream status.'
            });
            // Safely fall back to slideshow if we can't check
            if (isLivestreamActive) {
                showLivestream(null);
            }
        }
    }

    /**
     * Starts monitoring livestream status
     */
    function startLivestreamMonitoring() {
        const livestreamUrl = window.CONFIG && window.CONFIG.LIVESTREAM_URL;
        const checkInterval = (window.CONFIG && window.CONFIG.LIVESTREAM_CHECK_INTERVAL) || CONSTANTS.LIVESTREAM_CHECK_INTERVAL_MS;

        if (!livestreamUrl) {
            console.log('No livestream URL configured, auto-detection disabled');
            return;
        }

        console.log('Livestream auto-detection enabled. Checking every', checkInterval / 1000, 'seconds');

        // Initial check
        checkAndSwitch();

        // Periodic checks
        livestreamMonitorInterval = setInterval(checkAndSwitch, checkInterval);
    }

    /**
     * Stops monitoring livestream status
     */
    function stopLivestreamMonitoring() {
        if (livestreamMonitorInterval) {
            clearInterval(livestreamMonitorInterval);
            livestreamMonitorInterval = null;
        }
    }

    /**
     * Toggles between livestream and slideshow
     */
    function toggleLivestream() {
        const livestreamUrl = window.CONFIG && window.CONFIG.LIVESTREAM_URL;

        if (!livestreamUrl) {
            console.log(CONSTANTS.ERROR_MESSAGES.NO_LIVESTREAM_URL);
            return;
        }

        if (isLivestreamActive) {
            showLivestream(null);
        } else {
            showLivestream(livestreamUrl);
        }
    }

    /**
     * Initializes the livestream module
     */
    function init() {
        if (window.CONFIG && window.CONFIG.AUTO_DETECT_LIVESTREAM) {
            startLivestreamMonitoring();
        }
        console.log('Livestream module initialized');
    }

    // Export public API
    window.Livestream = {
        show: showLivestream,
        toggle: toggleLivestream,
        startMonitoring: startLivestreamMonitoring,
        stopMonitoring: stopLivestreamMonitoring,
        isActive: () => isLivestreamActive
    };

    // Expose showLivestream globally for backwards compatibility
    window.showLivestream = showLivestream;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
