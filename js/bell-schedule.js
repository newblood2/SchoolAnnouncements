/**
 * Bell Schedule Display Module
 * Shows current/next class period based on configurable schedule
 */

(function() {
    'use strict';

    let bellSchedule = null;
    let updateInterval = null;
    let widgetElement = null;

    /**
     * Initialize the bell schedule module
     */
    async function init() {
        await loadBellSchedule();

        if (bellSchedule && bellSchedule.enabled) {
            createWidget();
            updateDisplay();
            // Update every 10 seconds
            updateInterval = setInterval(updateDisplay, 10000);
        }
    }

    /**
     * Load bell schedule from API
     */
    async function loadBellSchedule() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            bellSchedule = settings.bellSchedule || null;

            // Check if feature is enabled
            const featuresEnabled = settings.enabledFeatures?.bellSchedule !== false;
            if (!featuresEnabled && bellSchedule) {
                bellSchedule.enabled = false;
            }

            if (bellSchedule && bellSchedule.enabled) {
                console.log('Bell schedule loaded:', bellSchedule.currentSchedule);
            }
        } catch (error) {
            console.error('Failed to load bell schedule:', error);
        }
    }

    /**
     * Create the bell schedule widget
     */
    function createWidget() {
        if (widgetElement) return;

        widgetElement = document.createElement('div');
        widgetElement.id = 'bellScheduleWidget';
        widgetElement.className = 'bell-schedule-widget';
        widgetElement.innerHTML = `
            <div class="bell-current">
                <div class="bell-label">Now</div>
                <div class="bell-period-name" id="currentPeriod">--</div>
                <div class="bell-time-remaining" id="timeRemaining">--</div>
            </div>
            <div class="bell-next">
                <div class="bell-label">Next</div>
                <div class="bell-period-name" id="nextPeriod">--</div>
                <div class="bell-next-time" id="nextTime">--</div>
            </div>
        `;

        // Insert widget into the page (e.g., in the bottom panel or sidebar)
        const bottomPanel = document.querySelector('.bottom-panel');
        if (bottomPanel) {
            bottomPanel.insertBefore(widgetElement, bottomPanel.firstChild);
        } else {
            document.body.appendChild(widgetElement);
        }
    }

    /**
     * Get current schedule type periods
     */
    function getCurrentPeriods() {
        if (!bellSchedule || !bellSchedule.schedules) return [];

        const scheduleType = bellSchedule.currentSchedule || 'regular';
        return bellSchedule.schedules[scheduleType] || [];
    }

    /**
     * Parse time string to minutes since midnight
     */
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Format minutes to time string
     */
    function formatMinutes(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${mins.toString().padStart(2, '0')} ${ampm}`;
    }

    /**
     * Update the bell schedule display
     */
    function updateDisplay() {
        if (!bellSchedule || !bellSchedule.enabled || !widgetElement) return;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const periods = getCurrentPeriods();

        if (periods.length === 0) {
            showNoPeriods();
            return;
        }

        let currentPeriod = null;
        let nextPeriod = null;
        let timeInCurrent = 0;

        // Find current and next period
        for (let i = 0; i < periods.length; i++) {
            const period = periods[i];
            const startMin = timeToMinutes(period.start);
            const endMin = timeToMinutes(period.end);

            if (currentMinutes >= startMin && currentMinutes < endMin) {
                currentPeriod = period;
                timeInCurrent = endMin - currentMinutes;
                nextPeriod = periods[i + 1] || null;
                break;
            } else if (currentMinutes < startMin) {
                nextPeriod = period;
                break;
            }
        }

        // Update display
        const currentPeriodEl = document.getElementById('currentPeriod');
        const timeRemainingEl = document.getElementById('timeRemaining');
        const nextPeriodEl = document.getElementById('nextPeriod');
        const nextTimeEl = document.getElementById('nextTime');

        if (currentPeriod) {
            if (currentPeriodEl) currentPeriodEl.textContent = currentPeriod.name;
            if (timeRemainingEl) {
                const mins = Math.floor(timeInCurrent);
                timeRemainingEl.textContent = `${mins} min remaining`;
            }
            widgetElement.classList.add('in-period');
            widgetElement.classList.remove('between-periods');
        } else {
            if (currentPeriodEl) currentPeriodEl.textContent = 'Passing';
            if (timeRemainingEl) {
                if (nextPeriod) {
                    const nextStart = timeToMinutes(nextPeriod.start);
                    const mins = nextStart - currentMinutes;
                    timeRemainingEl.textContent = `${mins} min`;
                } else {
                    timeRemainingEl.textContent = 'End of day';
                }
            }
            widgetElement.classList.remove('in-period');
            widgetElement.classList.add('between-periods');
        }

        if (nextPeriod) {
            if (nextPeriodEl) nextPeriodEl.textContent = nextPeriod.name;
            if (nextTimeEl) nextTimeEl.textContent = formatMinutes(timeToMinutes(nextPeriod.start));
        } else {
            if (nextPeriodEl) nextPeriodEl.textContent = '--';
            if (nextTimeEl) nextTimeEl.textContent = '--';
        }
    }

    /**
     * Show message when no periods are configured
     */
    function showNoPeriods() {
        if (!widgetElement) return;

        const currentPeriodEl = document.getElementById('currentPeriod');
        const timeRemainingEl = document.getElementById('timeRemaining');
        const nextPeriodEl = document.getElementById('nextPeriod');
        const nextTimeEl = document.getElementById('nextTime');

        if (currentPeriodEl) currentPeriodEl.textContent = '--';
        if (timeRemainingEl) timeRemainingEl.textContent = 'No schedule';
        if (nextPeriodEl) nextPeriodEl.textContent = '--';
        if (nextTimeEl) nextTimeEl.textContent = '--';
    }

    /**
     * Hide the bell schedule widget
     */
    function hide() {
        if (widgetElement) {
            widgetElement.style.display = 'none';
        }
    }

    /**
     * Show the bell schedule widget
     */
    function show() {
        if (widgetElement) {
            widgetElement.style.display = 'flex';
        }
    }

    /**
     * Refresh the bell schedule
     */
    async function refresh() {
        await loadBellSchedule();
        if (bellSchedule && bellSchedule.enabled) {
            if (!widgetElement) createWidget();
            show();
            updateDisplay();
        } else {
            hide();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }

    // Expose public API
    window.BellSchedule = {
        refresh,
        show,
        hide,
        updateDisplay
    };

})();
