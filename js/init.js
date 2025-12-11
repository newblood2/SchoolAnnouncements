/**
 * @fileoverview Initialization Module - Application bootstrap and global controls
 * @module init
 * @description Handles application initialization, keyboard shortcuts, school name setup,
 * and automatic 3 AM refresh scheduling. Coordinates startup of all other modules.
 *
 * @example
 * // Module initializes automatically on DOM ready
 * // Keyboard shortcuts available:
 * // - Arrow Left/Right: Navigate slides
 * // - F: Toggle fullscreen
 * // - L: Toggle livestream
 *
 * @requires module:constants - For keyboard mappings and configuration
 * @requires module:slideshow - For keyboard navigation
 * @requires module:livestream - For livestream toggle
 */

(function() {
    'use strict';

    // Import constants
    const CONSTANTS = window.APP_CONSTANTS;

    /**
     * Initializes the school name across all display elements
     */
    function initializeSchoolName() {
        const schoolName = (window.CONFIG && window.CONFIG.SCHOOL_NAME) || CONSTANTS.DEFAULT_SCHOOL_NAME;

        // Update bottom panel school name
        const schoolNameElement = document.getElementById(CONSTANTS.ELEMENT_IDS.SCHOOL_NAME);
        if (schoolNameElement) {
            schoolNameElement.textContent = schoolName;
        }

        // Update welcome message
        const welcomeElement = document.getElementById(CONSTANTS.ELEMENT_IDS.WELCOME_MESSAGE);
        if (welcomeElement) {
            welcomeElement.textContent = `Welcome to ${schoolName}`;
        }

        // Update page title
        document.title = `School Announcements - ${schoolName}`;
    }

    /**
     * Sets up keyboard event listeners for navigation and controls
     */
    function initializeKeyboardControls() {
        document.addEventListener('keydown', handleKeyPress);
        console.log('Keyboard controls initialized');
    }

    /**
     * Handles keyboard events
     * @param {KeyboardEvent} e - Keyboard event
     */
    function handleKeyPress(e) {
        switch(e.key) {
            case CONSTANTS.KEYBOARD.ARROW_RIGHT:
                if (window.Slideshow) {
                    window.Slideshow.next();
                }
                break;

            case CONSTANTS.KEYBOARD.ARROW_LEFT:
                if (window.Slideshow) {
                    window.Slideshow.previous();
                }
                break;

            case CONSTANTS.KEYBOARD.LIVESTREAM_TOGGLE:
            case CONSTANTS.KEYBOARD.LIVESTREAM_TOGGLE_UPPER:
                handleLivestreamToggle();
                break;

            case CONSTANTS.KEYBOARD.FULLSCREEN:
            case CONSTANTS.KEYBOARD.FULLSCREEN_UPPER:
                toggleFullscreen();
                break;
        }
    }

    /**
     * Handles livestream toggle key press
     */
    function handleLivestreamToggle() {
        const livestreamUrl = window.CONFIG && window.CONFIG.LIVESTREAM_URL;

        if (!livestreamUrl) {
            console.log('Press L to toggle livestream. Configure URL in config.js');
            console.log('Set LIVESTREAM_URL in your config.js file');
            return;
        }

        if (window.Livestream) {
            window.Livestream.toggle();
        }
    }

    /**
     * Toggles fullscreen mode
     */
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // ========================================
    // Display Schedule Checker
    // ========================================

    let displaySchedule = null;
    let scheduleCheckInterval = null;
    let offHoursOverlay = null;

    /**
     * Load display schedule from API
     */
    async function loadDisplaySchedule() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            displaySchedule = settings.displaySchedule || null;

            if (displaySchedule && displaySchedule.enabled) {
                console.log('Display schedule loaded:', displaySchedule);
                startScheduleChecker();
            }
        } catch (error) {
            console.error('Failed to load display schedule:', error);
        }
    }

    /**
     * Start checking the schedule every minute
     */
    function startScheduleChecker() {
        // Check immediately
        checkSchedule();

        // Then check every minute
        scheduleCheckInterval = setInterval(checkSchedule, 60000);
    }

    /**
     * Check if display should be on or off based on schedule
     */
    function checkSchedule() {
        if (!displaySchedule || !displaySchedule.enabled) {
            hideOffHoursOverlay();
            return;
        }

        const now = new Date();
        const currentDay = now.getDay(); // 0-6, Sunday = 0
        const currentTimeStr = now.toTimeString().substring(0, 5); // HH:MM

        // Check if today is an active day
        const daysOfWeek = displaySchedule.daysOfWeek || [1, 2, 3, 4, 5];
        if (!daysOfWeek.includes(currentDay)) {
            showOffHoursOverlay();
            return;
        }

        // Check if current time is within active hours
        const startTime = displaySchedule.startTime || '07:00';
        const endTime = displaySchedule.endTime || '17:00';

        if (currentTimeStr >= startTime && currentTimeStr < endTime) {
            hideOffHoursOverlay();
        } else {
            showOffHoursOverlay();
        }
    }

    /**
     * Show the off-hours overlay
     */
    function showOffHoursOverlay() {
        if (!offHoursOverlay) {
            offHoursOverlay = document.createElement('div');
            offHoursOverlay.id = 'offHoursOverlay';
            offHoursOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                color: white;
                font-family: 'Poppins', sans-serif;
            `;

            const message = displaySchedule?.offMessage || 'Display is currently off';
            offHoursOverlay.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🌙</div>
                    <h1 style="font-size: 3rem; font-weight: 600; margin-bottom: 1rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${message}</h1>
                    <p style="font-size: 1.5rem; opacity: 0.8;" id="offHoursTime"></p>
                </div>
            `;
            document.body.appendChild(offHoursOverlay);
        }

        // Update time display
        const timeElement = offHoursOverlay.querySelector('#offHoursTime');
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }

        offHoursOverlay.style.display = 'flex';
    }

    /**
     * Hide the off-hours overlay
     */
    function hideOffHoursOverlay() {
        if (offHoursOverlay) {
            offHoursOverlay.style.display = 'none';
        }
    }

    /**
     * Schedules a daily refresh at 3 AM to prevent memory leaks
     */
    function scheduleDaily3AMRefresh() {
        const now = new Date();
        const next3AM = new Date();
        next3AM.setHours(CONSTANTS.AUTO_REFRESH_HOUR, 0, 0, 0);

        // If 3 AM has already passed today, schedule for tomorrow
        if (now >= next3AM) {
            next3AM.setDate(next3AM.getDate() + 1);
        }

        const timeUntil3AM = next3AM - now;
        const hoursUntil = Math.floor(timeUntil3AM / (1000 * 60 * 60));

        console.log(`Auto-refresh scheduled in ${hoursUntil} hours (at 3:00 AM)`);

        setTimeout(() => {
            console.log('Performing scheduled refresh...');
            location.reload();
        }, timeUntil3AM);
    }

    /**
     * Logs welcome message and keyboard shortcuts to console
     */
    function logWelcomeMessage() {
        console.log('School Announcements Display - Ready');
        console.log('Keyboard shortcuts:');
        console.log('  Arrow keys: Navigate slides');
        console.log('  F: Toggle fullscreen');
        console.log('  L: Toggle livestream (configure URL first)');
    }

    /**
     * Initializes the application
     */
    function init() {
        // Validate configuration before proceeding
        if (!window.ConfigValidator.validateAndDisplay()) {
            console.error('Application cannot start due to configuration errors');
            return; // Stop initialization if config is invalid
        }

        initializeSchoolName();
        initializeKeyboardControls();
        scheduleDaily3AMRefresh();
        loadDisplaySchedule();
        logWelcomeMessage();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
