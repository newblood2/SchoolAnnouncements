/**
 * Admin API Adapter
 * Wraps admin.js localStorage calls to use centralized API instead
 * This script loads after admin.js and replaces localStorage operations
 */

(function() {
    'use strict';

    // Wait for SettingsAPI to be available
    if (!window.SettingsAPI) {
        console.error('SettingsAPI not loaded! Make sure settings-api.js is included before this script.');
        return;
    }

    /**
     * Override the saveTheme function to use API
     */
    if (document.getElementById('applyThemeBtn')) {
        document.getElementById('applyThemeBtn').addEventListener('click', async function(e) {
            e.preventDefault();
            const theme = getCurrentTheme();

            try {
                await window.SettingsAPI.save('customTheme', theme);
                showToast('Theme saved to server! All displays will update automatically.', 'success');
            } catch (error) {
                showToast('Error saving theme: ' + error.message, 'error');
            }
        }, true); // Use capture to override existing handler
    }

    /**
     * Override save custom theme
     */
    if (document.getElementById('saveCustomThemeBtn')) {
        document.getElementById('saveCustomThemeBtn').addEventListener('click', async function(e) {
            e.preventDefault();
            const themeName = prompt('Enter a name for this custom theme:');
            if (themeName && themeName.trim()) {
                const theme = getCurrentTheme();
                theme.name = themeName.trim();

                try {
                    // Get existing themes from server
                    const settings = await window.SettingsAPI.getAll();
                    const customThemes = settings.customThemes || [];
                    customThemes.push(theme);

                    await window.SettingsAPI.save('customThemes', customThemes);
                    showToast(`Custom theme "${themeName}" saved to server!`, 'success');
                    loadCustomThemes();
                } catch (error) {
                    showToast('Error saving custom theme: ' + error.message, 'error');
                }
            }
        }, true);
    }

    /**
     * Override save slides
     */
    if (document.getElementById('saveSlidesBtn')) {
        document.getElementById('saveSlidesBtn').addEventListener('click', async function(e) {
            e.preventDefault();

            // Collect content from all textareas
            slides.forEach((slide, index) => {
                const textarea = document.getElementById(`slide-${index}`);
                if (textarea) {
                    slide.content = textarea.value;
                }
            });

            try {
                await window.SettingsAPI.save('customSlides', slides);
                showToast('Slides saved to server! All displays will update automatically.', 'success');
            } catch (error) {
                showToast('Error saving slides: ' + error.message, 'error');
            }
        }, true);
    }

    /**
     * Override save livestream settings
     */
    if (document.getElementById('saveLivestreamBtn')) {
        document.getElementById('saveLivestreamBtn').addEventListener('click', async function(e) {
            e.preventDefault();

            // Validate check interval (10-300 seconds)
            const validateNum = window.Utils?.validatePositiveInt || ((v, min, max, def) => {
                const n = parseInt(v);
                return (!isNaN(n) && n >= min && n <= max) ? n : def;
            });
            const checkIntervalSeconds = validateNum(document.getElementById('livestreamCheckInterval').value, 10, 300, 10);

            const publishTokenEl = document.getElementById('streamPublishToken');
            const livestreamConfig = {
                enabled: document.getElementById('enableLivestream').checked,
                url: document.getElementById('livestreamUrl').value,
                autoDetect: document.getElementById('autoDetectLivestream').checked,
                checkInterval: checkIntervalSeconds * 1000,
                publishToken: publishTokenEl ? publishTokenEl.value : ''
            };

            try {
                await window.SettingsAPI.save('livestreamConfig', livestreamConfig);

                // Update CONFIG for backward compatibility
                window.CONFIG.LIVESTREAM_URL = livestreamConfig.enabled ? livestreamConfig.url : null;
                window.CONFIG.AUTO_DETECT_LIVESTREAM = livestreamConfig.autoDetect;
                window.CONFIG.LIVESTREAM_CHECK_INTERVAL = livestreamConfig.checkInterval;

                showToast('Livestream settings saved to server! All displays will update automatically.', 'success');
            } catch (error) {
                showToast('Error saving livestream settings: ' + error.message, 'error');
            }
        }, true);
    }

    /**
     * Override save general settings
     */
    if (document.getElementById('saveGeneralBtn')) {
        document.getElementById('saveGeneralBtn').addEventListener('click', async function(e) {
            e.preventDefault();

            // Validate slideshow interval (3-60 seconds)
            const validateNum = window.Utils?.validatePositiveInt || ((v, min, max, def) => {
                const n = parseInt(v);
                return (!isNaN(n) && n >= min && n <= max) ? n : def;
            });
            const intervalSeconds = validateNum(document.getElementById('slideshowInterval').value, 3, 60, 8);

            const generalConfig = {
                schoolName: document.getElementById('schoolName').value,
                slideshowInterval: intervalSeconds * 1000
            };

            try {
                await window.SettingsAPI.save('generalConfig', generalConfig);

                // Update CONFIG for backward compatibility
                window.CONFIG.SCHOOL_NAME = generalConfig.schoolName;
                window.CONFIG.SLIDESHOW_INTERVAL = generalConfig.slideshowInterval;

                showToast('General settings saved to server! All displays will update automatically.', 'success');
            } catch (error) {
                showToast('Error saving general settings: ' + error.message, 'error');
            }
        }, true);
    }

    /**
     * Load settings from server on page load
     */
    async function loadSettingsFromServer() {
        try {
            const settings = await window.SettingsAPI.getAll();
            return settings;
        } catch (error) {
            console.error('Error loading settings from server:', error);
            showToast('Failed to load settings from server', 'error');
            return {};
        }
    }

    // Load settings when admin panel initializes
    if (typeof initializeAdmin === 'function') {
        const originalInit = initializeAdmin;
        window.initializeAdmin = async function() {
            await loadSettingsFromServer();
            originalInit();
        };
    }

    /**
     * Add migration button to admin panel
     */
    function addMigrationButton() {
        const header = document.querySelector('.admin-header .header-actions');
        if (header) {
            const migrateBtn = document.createElement('button');
            migrateBtn.className = 'btn btn-secondary';
            migrateBtn.textContent = 'Migrate from localStorage';
            migrateBtn.style.marginRight = '10px';
            migrateBtn.addEventListener('click', async function() {
                if (confirm('Migrate all localStorage settings to server? This will overwrite server settings.')) {
                    try {
                        await window.SettingsAPI.migrateFromLocalStorage();
                        showToast('Settings migrated successfully! Refresh the page.', 'success');
                    } catch (error) {
                        showToast('Migration failed: ' + error.message, 'error');
                    }
                }
            });
            header.insertBefore(migrateBtn, header.firstChild);
        }
    }

    // Add migration button when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addMigrationButton);
    } else {
        addMigrationButton();
    }

})();
