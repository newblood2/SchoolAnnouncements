/**
 * @fileoverview DateTime Module - Real-time clock and date display management
 * @module datetime
 * @description Manages the real-time clock and date display with automatic updates.
 * Updates every second to show current time in 12-hour format with AM/PM and full date.
 *
 * @example
 * // Module initializes automatically on DOM ready
 * // Displays: "09:45:23 PM" and "Monday, November 23, 2025"
 *
 * @requires module:constants - For update intervals and element IDs
 */

(function() {
    'use strict';

    // Import constants
    const CONSTANTS = window.APP_CONSTANTS;

    /**
     * Updates both time and date display elements
     * @function updateDateTime
     * @private
     * @returns {void}
     * @description Called every second to keep time and date synchronized
     */
    function updateDateTime() {
        const now = new Date();

        updateTimeDisplay(now);
        updateDateDisplay(now);
    }

    /**
     * Updates the time display in 12-hour format with AM/PM
     * @function updateTimeDisplay
     * @private
     * @param {Date} now - Current date/time object
     * @returns {void}
     * @description Converts 24-hour time to 12-hour format with zero-padded values
     * @example
     * // Displays: "02:30:45 PM" for 14:30:45
     * updateTimeDisplay(new Date());
     */
    function updateTimeDisplay(now) {
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';

        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12
        const displayHours = String(hours).padStart(2, '0');

        const timeElement = document.getElementById(CONSTANTS.ELEMENT_IDS.TIME_DISPLAY);
        if (timeElement) {
            timeElement.textContent = `${displayHours}:${minutes}:${seconds} ${ampm}`;
        }
    }

    /**
     * Updates the date display with full weekday and date
     * @function updateDateDisplay
     * @private
     * @param {Date} now - Current date/time object
     * @returns {void}
     * @description Formats date as "Weekday, Month Day, Year" using Intl.DateTimeFormat
     * @example
     * // Displays: "Monday, November 23, 2025"
     * updateDateDisplay(new Date());
     */
    function updateDateDisplay(now) {
        const dateString = now.toLocaleDateString(
            CONSTANTS.LOCALE,
            CONSTANTS.DATE_FORMAT_OPTIONS
        );

        const dateElement = document.getElementById(CONSTANTS.ELEMENT_IDS.DATE_DISPLAY);
        if (dateElement) {
            dateElement.textContent = dateString;
        }
    }

    /**
     * Initializes the date/time display module
     * @function init
     * @private
     * @returns {void}
     * @description Sets up the display with current time/date and starts automatic updates.
     * Updates occur every second (1000ms) as defined in CONSTANTS.DATETIME_UPDATE_INTERVAL_MS
     * @example
     * // Called automatically when DOM is ready
     * init();
     */
    function init() {
        updateDateTime(); // Initial call
        setInterval(updateDateTime, CONSTANTS.DATETIME_UPDATE_INTERVAL_MS);
        console.log('DateTime module initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
