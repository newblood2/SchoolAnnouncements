/**
 * Admin Emergency Alert Module
 * Handles emergency alert management from admin panel
 */

(function() {
    'use strict';

    // Alert history for current session
    const alertHistory = [];

    // Alert types configuration (matches the display side)
    const ALERT_TYPES = {
        lockdown: {
            name: 'Lockdown',
            icon: '🔒',
            color: '#dc2626',
            bgColor: '#7f1d1d',
            message: 'LOCKDOWN IN EFFECT',
            subMessage: 'Lock doors, turn off lights, stay silent',
            sound: true,
            flash: true
        },
        evacuation: {
            name: 'Evacuation',
            icon: '🚨',
            color: '#ea580c',
            bgColor: '#7c2d12',
            message: 'EVACUATE IMMEDIATELY',
            subMessage: 'Proceed to designated evacuation points',
            sound: true,
            flash: true
        },
        shelter: {
            name: 'Shelter in Place',
            icon: '🏠',
            color: '#2563eb',
            bgColor: '#1e3a8a',
            message: 'SHELTER IN PLACE',
            subMessage: 'Stay in current location until further notice',
            sound: true,
            flash: false
        },
        weather: {
            name: 'Severe Weather',
            icon: '⛈️',
            color: '#7c3aed',
            bgColor: '#4c1d95',
            message: 'SEVERE WEATHER ALERT',
            subMessage: 'Move to interior rooms away from windows',
            sound: true,
            flash: false
        },
        medical: {
            name: 'Medical Emergency',
            icon: '🏥',
            color: '#dc2626',
            bgColor: '#7f1d1d',
            message: 'MEDICAL EMERGENCY',
            subMessage: 'Clear the area, medical personnel en route',
            sound: false,
            flash: false
        },
        custom: {
            name: 'Custom Alert',
            icon: '⚠️',
            color: '#f59e0b',
            bgColor: '#78350f',
            message: 'EMERGENCY ALERT',
            subMessage: '',
            sound: true,
            flash: false
        }
    };

    let isAlertActive = false;

    /**
     * Send an emergency alert to all displays
     * @param {string} type - Alert type (lockdown, evacuation, etc.)
     * @param {Object} customData - Optional custom data for the alert
     */
    async function sendAlert(type, customData = {}) {
        const alertConfig = ALERT_TYPES[type] || ALERT_TYPES.custom;

        const alertData = {
            type: type,
            icon: customData.icon || alertConfig.icon,
            message: customData.message || alertConfig.message,
            subMessage: customData.subMessage || alertConfig.subMessage,
            color: customData.color || alertConfig.color,
            bgColor: customData.bgColor || alertConfig.bgColor,
            flash: customData.flash !== undefined ? customData.flash : alertConfig.flash,
            sound: customData.sound !== undefined ? customData.sound : alertConfig.sound,
            timestamp: Date.now()
        };

        // Confirmation for emergency alerts
        const confirmed = confirm(
            `⚠️ EMERGENCY ALERT ⚠️\n\n` +
            `You are about to broadcast:\n` +
            `"${alertData.message}"\n\n` +
            `This will override ALL connected displays immediately.\n\n` +
            `Are you sure you want to proceed?`
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch('/api/emergency/alert', {
                method: 'POST',
                headers: window.SettingsAPI.getAuthHeaders(),
                body: JSON.stringify(alertData)
            });

            if (!response.ok) {
                throw new Error('Failed to send alert');
            }

            const result = await response.json();

            isAlertActive = true;

            // Add to history
            alertHistory.unshift({
                ...alertData,
                sentAt: new Date().toLocaleTimeString()
            });

            // Update UI
            updateAlertStatus(true, alertData);
            updateAlertHistory();

            window.showToast(`Emergency alert sent to ${result.clients} displays!`, 'success');
        } catch (error) {
            console.error('Failed to send emergency alert:', error);
            window.showToast('Failed to send alert: ' + error.message, 'error');
        }
    }

    /**
     * Cancel the active emergency alert
     */
    async function cancelAlert() {
        const confirmed = confirm(
            `Cancel the active emergency alert?\n\n` +
            `All displays will return to normal content.`
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch('/api/emergency/cancel', {
                method: 'POST',
                headers: window.SettingsAPI.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to cancel alert');
            }

            const result = await response.json();

            isAlertActive = false;

            // Add cancellation to history
            alertHistory.unshift({
                type: 'cancelled',
                message: 'Alert Cancelled',
                sentAt: new Date().toLocaleTimeString()
            });

            // Update UI
            updateAlertStatus(false);
            updateAlertHistory();

            window.showToast(`Alert cancelled. ${result.clients} displays returned to normal.`, 'success');

        } catch (error) {
            console.error('Failed to cancel alert:', error);
            window.showToast('Failed to cancel alert: ' + error.message, 'error');
        }
    }

    /**
     * Update the alert status banner
     */
    function updateAlertStatus(active, alertData = null) {
        const banner = document.getElementById('alertStatusBanner');
        const cancelSection = document.getElementById('cancelAlertSection');

        if (!banner) return;

        if (active && alertData) {
            banner.className = 'alert-status-banner active';
            banner.innerHTML = `
                <div class="alert-status-icon">${alertData.icon}</div>
                <div class="alert-status-text">
                    <strong>ACTIVE: ${alertData.message}</strong>
                    <span>All displays showing emergency alert</span>
                </div>
            `;
            banner.style.background = alertData.bgColor;

            if (cancelSection) {
                cancelSection.style.display = 'block';
            }
        } else {
            banner.className = 'alert-status-banner inactive';
            banner.innerHTML = `
                <div class="alert-status-icon">✓</div>
                <div class="alert-status-text">
                    <strong>No Active Alert</strong>
                    <span>All displays showing normal content</span>
                </div>
            `;
            banner.style.background = '';

            if (cancelSection) {
                cancelSection.style.display = 'none';
            }
        }
    }

    /**
     * Update the alert history display
     */
    function updateAlertHistory() {
        const historyEl = document.getElementById('alertHistory');
        if (!historyEl) return;

        if (alertHistory.length === 0) {
            historyEl.innerHTML = '<p class="no-alerts">No alerts have been sent this session.</p>';
            return;
        }

        historyEl.innerHTML = alertHistory.slice(0, 10).map(alert => `
            <div class="alert-history-item ${alert.type === 'cancelled' ? 'cancelled' : ''}">
                <span class="alert-history-icon">${alert.icon || '✓'}</span>
                <span class="alert-history-message">${alert.message}</span>
                <span class="alert-history-time">${alert.sentAt}</span>
            </div>
        `).join('');
    }

    /**
     * Check current alert status from server
     */
    async function checkAlertStatus() {
        try {
            const response = await fetch('/api/emergency/status');
            const data = await response.json();

            isAlertActive = data.active;
            updateAlertStatus(data.active, data.alert);

        } catch (error) {
            console.error('Failed to check alert status:', error);
        }
    }

    /**
     * Initialize emergency alert module
     */
    function init() {
        // Quick alert buttons
        document.querySelectorAll('.emergency-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const alertType = btn.dataset.type;
                sendAlert(alertType);
            });
        });

        // Custom alert button
        const sendCustomBtn = document.getElementById('sendCustomAlertBtn');
        if (sendCustomBtn) {
            sendCustomBtn.addEventListener('click', () => {
                const message = document.getElementById('customAlertMessage').value.trim();
                const subMessage = document.getElementById('customAlertSubMessage').value.trim();
                const color = document.getElementById('customAlertColor').value;
                const flash = document.getElementById('customAlertFlash').checked;
                const sound = document.getElementById('customAlertSound').checked;

                if (!message) {
                    window.showToast('Please enter an alert message', 'error');
                    return;
                }

                // Darken the color for background
                const bgColor = darkenColor(color, 0.5);

                sendAlert('custom', {
                    message: message.toUpperCase(),
                    subMessage: subMessage,
                    color: color,
                    bgColor: bgColor,
                    flash: flash,
                    sound: sound
                });
            });
        }

        // Cancel alert button
        const cancelBtn = document.getElementById('cancelAlertBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', cancelAlert);
        }

        // Check initial status
        checkAlertStatus();
    }

    /**
     * Darken a hex color
     */
    function darkenColor(hex, factor) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.floor((num >> 16) * factor);
        const g = Math.floor(((num >> 8) & 0x00FF) * factor);
        const b = Math.floor((num & 0x0000FF) * factor);
        return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    // Expose public API
    window.AdminEmergency = {
        sendAlert,
        cancelAlert,
        checkStatus: checkAlertStatus
    };

})();
