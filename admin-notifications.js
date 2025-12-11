/**
 * Admin Notifications Module
 * Handles parent notification settings in the admin panel
 */

(function() {
    'use strict';

    // State
    let notificationSettings = {
        enabled: false,
        emailEnabled: false,
        smsEnabled: false,
        smtp: {
            host: '',
            port: 587,
            secure: false,
            user: '',
            password: '',
            fromName: '',
            fromAddress: ''
        },
        twilio: {
            accountSid: '',
            authToken: '',
            phoneNumber: ''
        },
        triggers: {
            dismissal: true,
            emergency: false,
            weatherAlert: false
        },
        templates: {
            dismissal: '{studentName} has been called for dismissal at {time}. Please proceed to the designated pickup area.',
            emergency: '{schoolName} Emergency Alert: {message}'
        }
    };

    // Elements
    const notificationsEnabled = document.getElementById('notificationsEnabled');
    const emailNotificationsEnabled = document.getElementById('emailNotificationsEnabled');
    const smsNotificationsEnabled = document.getElementById('smsNotificationsEnabled');
    const smtpHost = document.getElementById('smtpHost');
    const smtpPort = document.getElementById('smtpPort');
    const smtpSecure = document.getElementById('smtpSecure');
    const smtpUser = document.getElementById('smtpUser');
    const smtpPassword = document.getElementById('smtpPassword');
    const emailFromName = document.getElementById('emailFromName');
    const emailFromAddress = document.getElementById('emailFromAddress');
    const twilioAccountSid = document.getElementById('twilioAccountSid');
    const twilioAuthToken = document.getElementById('twilioAuthToken');
    const twilioPhoneNumber = document.getElementById('twilioPhoneNumber');
    const notifyOnDismissal = document.getElementById('notifyOnDismissal');
    const notifyOnEmergency = document.getElementById('notifyOnEmergency');
    const notifyOnWeatherAlert = document.getElementById('notifyOnWeatherAlert');
    const dismissalTemplate = document.getElementById('dismissalTemplate');
    const emergencyTemplate = document.getElementById('emergencyTemplate');
    const testEmailBtn = document.getElementById('testEmailBtn');
    const testSmsBtn = document.getElementById('testSmsBtn');
    const saveNotificationSettingsBtn = document.getElementById('saveNotificationSettingsBtn');

    /**
     * Initialize the module
     */
    async function init() {
        await loadSettings();
        setupEventListeners();
        populateForm();
    }

    /**
     * Load settings from API
     */
    async function loadSettings() {
        try {
            const settings = await window.SettingsAPI.getAll();
            if (settings.notificationSettings) {
                notificationSettings = {
                    ...notificationSettings,
                    ...settings.notificationSettings
                };
            }
        } catch (error) {
            console.error('Failed to load notification settings:', error);
        }
    }

    /**
     * Save settings to API
     */
    async function saveSettings() {
        try {
            await window.SettingsAPI.save('notificationSettings', notificationSettings);
            showToast('Notification settings saved!', 'success');
        } catch (error) {
            console.error('Failed to save notification settings:', error);
            showToast('Failed to save settings', 'error');
            throw error;
        }
    }

    /**
     * Populate form with current settings
     */
    function populateForm() {
        if (notificationsEnabled) notificationsEnabled.checked = notificationSettings.enabled;
        if (emailNotificationsEnabled) emailNotificationsEnabled.checked = notificationSettings.emailEnabled;
        if (smsNotificationsEnabled) smsNotificationsEnabled.checked = notificationSettings.smsEnabled;

        // SMTP settings
        if (smtpHost) smtpHost.value = notificationSettings.smtp?.host || '';
        if (smtpPort) smtpPort.value = notificationSettings.smtp?.port || 587;
        if (smtpSecure) smtpSecure.checked = notificationSettings.smtp?.secure || false;
        if (smtpUser) smtpUser.value = notificationSettings.smtp?.user || '';
        if (smtpPassword) smtpPassword.value = notificationSettings.smtp?.password || '';
        if (emailFromName) emailFromName.value = notificationSettings.smtp?.fromName || '';
        if (emailFromAddress) emailFromAddress.value = notificationSettings.smtp?.fromAddress || '';

        // Twilio settings
        if (twilioAccountSid) twilioAccountSid.value = notificationSettings.twilio?.accountSid || '';
        if (twilioAuthToken) twilioAuthToken.value = notificationSettings.twilio?.authToken || '';
        if (twilioPhoneNumber) twilioPhoneNumber.value = notificationSettings.twilio?.phoneNumber || '';

        // Triggers
        if (notifyOnDismissal) notifyOnDismissal.checked = notificationSettings.triggers?.dismissal !== false;
        if (notifyOnEmergency) notifyOnEmergency.checked = notificationSettings.triggers?.emergency || false;
        if (notifyOnWeatherAlert) notifyOnWeatherAlert.checked = notificationSettings.triggers?.weatherAlert || false;

        // Templates
        if (dismissalTemplate) dismissalTemplate.value = notificationSettings.templates?.dismissal || '';
        if (emergencyTemplate) emergencyTemplate.value = notificationSettings.templates?.emergency || '';
    }

    /**
     * Collect form values into settings object
     */
    function collectFormValues() {
        notificationSettings = {
            enabled: notificationsEnabled?.checked || false,
            emailEnabled: emailNotificationsEnabled?.checked || false,
            smsEnabled: smsNotificationsEnabled?.checked || false,
            smtp: {
                host: smtpHost?.value || '',
                port: parseInt(smtpPort?.value) || 587,
                secure: smtpSecure?.checked || false,
                user: smtpUser?.value || '',
                password: smtpPassword?.value || '',
                fromName: emailFromName?.value || '',
                fromAddress: emailFromAddress?.value || ''
            },
            twilio: {
                accountSid: twilioAccountSid?.value || '',
                authToken: twilioAuthToken?.value || '',
                phoneNumber: twilioPhoneNumber?.value || ''
            },
            triggers: {
                dismissal: notifyOnDismissal?.checked || false,
                emergency: notifyOnEmergency?.checked || false,
                weatherAlert: notifyOnWeatherAlert?.checked || false
            },
            templates: {
                dismissal: dismissalTemplate?.value || '',
                emergency: emergencyTemplate?.value || ''
            }
        };
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        if (saveNotificationSettingsBtn) {
            saveNotificationSettingsBtn.addEventListener('click', async () => {
                collectFormValues();
                await saveSettings();
            });
        }

        if (testEmailBtn) {
            testEmailBtn.addEventListener('click', testEmail);
        }

        if (testSmsBtn) {
            testSmsBtn.addEventListener('click', testSms);
        }
    }

    /**
     * Test email configuration
     */
    async function testEmail() {
        collectFormValues();

        if (!notificationSettings.smtp.host || !notificationSettings.smtp.user) {
            showToast('Please configure SMTP settings first', 'error');
            return;
        }

        const testAddress = prompt('Enter email address to send test message to:');
        if (!testAddress) return;

        try {
            testEmailBtn.disabled = true;
            testEmailBtn.textContent = 'Sending...';

            const response = await fetch('/api/notifications/test-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                },
                body: JSON.stringify({
                    to: testAddress,
                    settings: notificationSettings.smtp
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Test email sent successfully!', 'success');
            } else {
                showToast(`Failed to send: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Test email error:', error);
            showToast('Failed to send test email', 'error');
        } finally {
            testEmailBtn.disabled = false;
            testEmailBtn.textContent = 'Send Test Email';
        }
    }

    /**
     * Test SMS configuration
     */
    async function testSms() {
        collectFormValues();

        if (!notificationSettings.twilio.accountSid || !notificationSettings.twilio.authToken) {
            showToast('Please configure Twilio settings first', 'error');
            return;
        }

        const testNumber = prompt('Enter phone number to send test SMS to (with country code):');
        if (!testNumber) return;

        try {
            testSmsBtn.disabled = true;
            testSmsBtn.textContent = 'Sending...';

            const response = await fetch('/api/notifications/test-sms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                },
                body: JSON.stringify({
                    to: testNumber,
                    settings: notificationSettings.twilio
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Test SMS sent successfully!', 'success');
            } else {
                showToast(`Failed to send: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Test SMS error:', error);
            showToast('Failed to send test SMS', 'error');
        } finally {
            testSmsBtn.disabled = false;
            testSmsBtn.textContent = 'Send Test SMS';
        }
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    // Expose public API
    window.NotificationsAdmin = {
        load: loadSettings,
        save: saveSettings,
        getSettings: () => notificationSettings
    };

})();
