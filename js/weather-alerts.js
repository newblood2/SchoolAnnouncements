/**
 * Weather Alerts Module
 * Displays severe weather warnings when active
 */

(function() {
    'use strict';

    let alertBanner = null;
    let checkInterval = null;
    let currentAlert = null;
    const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

    /**
     * Initialize the weather alerts module
     */
    function init() {
        createAlertBanner();
        checkForAlerts();

        // Check periodically
        checkInterval = setInterval(checkForAlerts, CHECK_INTERVAL);
    }

    /**
     * Create the alert banner element
     */
    function createAlertBanner() {
        if (alertBanner) return;

        alertBanner = document.createElement('div');
        alertBanner.id = 'weatherAlertBanner';
        alertBanner.className = 'weather-alert-banner';
        alertBanner.innerHTML = `
            <div class="alert-icon">⚠️</div>
            <div class="alert-content">
                <div class="alert-title"></div>
                <div class="alert-description"></div>
            </div>
            <div class="alert-time"></div>
        `;
        document.body.appendChild(alertBanner);
    }

    /**
     * Check for active weather alerts
     */
    async function checkForAlerts() {
        try {
            // First check if weather alerts are enabled
            const settingsResponse = await fetch('/api/settings');
            const settings = await settingsResponse.json();

            // Check both enabledFeatures and the old weatherAlerts setting
            const weatherAlertsEnabled = settings.enabledFeatures?.weatherAlerts !== false &&
                                         settings.weatherAlerts?.enabled !== false;

            if (!weatherAlertsEnabled) {
                hideAlert();
                return;
            }

            // Get weather alerts from our API
            const response = await fetch('/api/weather/alerts');

            if (!response.ok) {
                console.log('Weather alerts API not available or no alerts');
                hideAlert();
                return;
            }

            const data = await response.json();

            if (data.alerts && data.alerts.length > 0) {
                // Show the most severe alert
                const alert = data.alerts[0];
                showAlert(alert);
            } else {
                hideAlert();
            }
        } catch (error) {
            console.error('Error checking weather alerts:', error);
            hideAlert();
        }
    }

    /**
     * Show a weather alert
     */
    function showAlert(alert) {
        if (!alertBanner) return;

        currentAlert = alert;

        const titleEl = alertBanner.querySelector('.alert-title');
        const descEl = alertBanner.querySelector('.alert-description');
        const timeEl = alertBanner.querySelector('.alert-time');

        if (titleEl) titleEl.textContent = alert.event || 'Weather Alert';
        if (descEl) descEl.textContent = alert.description || alert.headline || '';

        if (timeEl && alert.end) {
            const endTime = new Date(alert.end * 1000);
            timeEl.textContent = `Until ${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        }

        // Set severity color
        const severity = (alert.tags || []).join(' ').toLowerCase();
        alertBanner.className = 'weather-alert-banner active';

        if (severity.includes('extreme') || severity.includes('tornado')) {
            alertBanner.classList.add('extreme');
        } else if (severity.includes('severe')) {
            alertBanner.classList.add('severe');
        } else if (severity.includes('moderate')) {
            alertBanner.classList.add('moderate');
        }

        console.log('Weather alert shown:', alert.event);
    }

    /**
     * Hide the alert banner
     */
    function hideAlert() {
        if (alertBanner) {
            alertBanner.classList.remove('active', 'extreme', 'severe', 'moderate');
        }
        currentAlert = null;
    }

    /**
     * Check if an alert is currently showing
     */
    function isActive() {
        return currentAlert !== null;
    }

    /**
     * Force a refresh of alerts
     */
    function refresh() {
        checkForAlerts();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }

    // Expose public API
    window.WeatherAlerts = {
        refresh,
        isActive,
        show: showAlert,
        hide: hideAlert
    };

})();
