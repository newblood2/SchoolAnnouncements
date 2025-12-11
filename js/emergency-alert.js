/**
 * Emergency Alert System
 * Handles emergency broadcasts across all displays
 */

(function() {
    'use strict';

    // Emergency alert state
    let isAlertActive = false;
    let currentAlert = null;
    let alertOverlay = null;

    // Alert types with their configurations
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

    /**
     * Create the emergency alert overlay
     */
    function createAlertOverlay() {
        if (alertOverlay) return alertOverlay;

        alertOverlay = document.createElement('div');
        alertOverlay.id = 'emergencyAlertOverlay';
        alertOverlay.className = 'emergency-alert-overlay';
        alertOverlay.style.display = 'none';
        alertOverlay.innerHTML = `
            <div class="emergency-alert-content">
                <div class="emergency-alert-icon"></div>
                <div class="emergency-alert-message"></div>
                <div class="emergency-alert-submessage"></div>
                <div class="emergency-alert-time"></div>
            </div>
        `;
        document.body.appendChild(alertOverlay);

        // Add styles if not already present
        if (!document.getElementById('emergencyAlertStyles')) {
            const styles = document.createElement('style');
            styles.id = 'emergencyAlertStyles';
            styles.textContent = `
                .emergency-alert-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--alert-bg, #7f1d1d);
                    animation: alertPulse 1s ease-in-out infinite;
                }

                .emergency-alert-overlay.flash {
                    animation: alertFlash 0.5s ease-in-out infinite;
                }

                @keyframes alertPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.9; }
                }

                @keyframes alertFlash {
                    0%, 100% { background: var(--alert-bg, #7f1d1d); }
                    50% { background: var(--alert-color, #dc2626); }
                }

                .emergency-alert-content {
                    text-align: center;
                    color: white;
                    padding: 2rem;
                    max-width: 90%;
                }

                .emergency-alert-icon {
                    font-size: 8rem;
                    margin-bottom: 1rem;
                    animation: iconBounce 1s ease-in-out infinite;
                }

                @keyframes iconBounce {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }

                .emergency-alert-message {
                    font-size: 5rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 1rem;
                    text-shadow: 4px 4px 8px rgba(0,0,0,0.5);
                }

                .emergency-alert-submessage {
                    font-size: 2.5rem;
                    font-weight: 500;
                    opacity: 0.95;
                    margin-bottom: 2rem;
                }

                .emergency-alert-time {
                    font-size: 1.5rem;
                    opacity: 0.8;
                    font-family: monospace;
                }

                @media (max-width: 1200px) {
                    .emergency-alert-icon { font-size: 5rem; }
                    .emergency-alert-message { font-size: 3rem; }
                    .emergency-alert-submessage { font-size: 1.5rem; }
                }
            `;
            document.head.appendChild(styles);
        }

        return alertOverlay;
    }

    /**
     * Show emergency alert
     * @param {Object} alert - Alert configuration
     */
    function showAlert(alert) {
        const overlay = createAlertOverlay();
        const alertConfig = ALERT_TYPES[alert.type] || ALERT_TYPES.custom;

        currentAlert = {
            ...alertConfig,
            ...alert,
            startTime: Date.now()
        };

        isAlertActive = true;

        // Set colors
        overlay.style.setProperty('--alert-bg', currentAlert.bgColor || alertConfig.bgColor);
        overlay.style.setProperty('--alert-color', currentAlert.color || alertConfig.color);

        // Set content
        overlay.querySelector('.emergency-alert-icon').textContent = currentAlert.icon || alertConfig.icon;
        overlay.querySelector('.emergency-alert-message').textContent = currentAlert.message || alertConfig.message;
        overlay.querySelector('.emergency-alert-submessage').textContent = currentAlert.subMessage || alertConfig.subMessage || '';

        // Flash effect
        if (currentAlert.flash) {
            overlay.classList.add('flash');
        } else {
            overlay.classList.remove('flash');
        }

        // Show overlay
        overlay.style.display = 'flex';

        // Update time
        updateAlertTime();

        // Play alert sound
        if (currentAlert.sound) {
            playAlertSound();
        }

        console.log('Emergency alert activated:', currentAlert.message);
    }

    /**
     * Hide emergency alert
     */
    function hideAlert() {
        if (alertOverlay) {
            alertOverlay.style.display = 'none';
            alertOverlay.classList.remove('flash');
        }

        isAlertActive = false;
        currentAlert = null;

        console.log('Emergency alert deactivated');
    }

    /**
     * Update the alert time display
     */
    function updateAlertTime() {
        if (!isAlertActive || !alertOverlay) return;

        const timeEl = alertOverlay.querySelector('.emergency-alert-time');
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString();
        }

        // Continue updating
        if (isAlertActive) {
            setTimeout(updateAlertTime, 1000);
        }
    }

    /**
     * Play alert sound using Web Audio API
     */
    function playAlertSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            function playTone(frequency, startTime, duration) {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            }

            // Play alert tones
            const now = audioContext.currentTime;
            playTone(880, now, 0.3);
            playTone(660, now + 0.35, 0.3);
            playTone(880, now + 0.7, 0.3);

        } catch (e) {
            console.warn('Could not play alert sound:', e);
        }
    }

    /**
     * Get alert status
     */
    function getStatus() {
        return {
            active: isAlertActive,
            alert: currentAlert
        };
    }

    // Expose public API
    window.EmergencyAlert = {
        ALERT_TYPES,
        show: showAlert,
        hide: hideAlert,
        getStatus,
        isActive: () => isAlertActive
    };

    console.log('Emergency Alert System loaded');
})();
