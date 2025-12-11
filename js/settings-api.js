/**
 * @fileoverview Settings API Client - Handles communication with centralized settings API
 * @module settings-api
 * @description Provides functions to save/load settings from the server instead of localStorage.
 * Automatically syncs changes across all displays via Server-Sent Events.
 */

(function() {
    'use strict';

    const API_BASE = '/api/settings';
    const AUTH_BASE = '/api/auth';

    // Store session token
    let sessionToken = sessionStorage.getItem('api_session_token');

    /**
     * Settings API Client
     */
    const SettingsAPI = {
        /**
         * Login to API and get session token
         * @param {string} apiKey - API key
         * @returns {Promise<Object>} Login response with session token
         */
        async login(apiKey) {
            try {
                const response = await fetch(`${AUTH_BASE}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ apiKey })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Authentication failed');
                }

                const result = await response.json();
                sessionToken = result.sessionToken;
                sessionStorage.setItem('api_session_token', sessionToken);
                console.log('API authentication successful');
                return result;
            } catch (error) {
                console.error('API login failed:', error);
                throw error;
            }
        },

        /**
         * Logout and clear session token
         * @returns {Promise<void>}
         */
        async logout() {
            try {
                if (sessionToken) {
                    await fetch(`${AUTH_BASE}/logout`, {
                        method: 'POST',
                        headers: {
                            'X-Session-Token': sessionToken
                        }
                    });
                }
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                sessionToken = null;
                sessionStorage.removeItem('api_session_token');
            }
        },

        /**
         * Get headers with authentication
         * @returns {Object} Headers object
         */
        getAuthHeaders() {
            const headers = {
                'Content-Type': 'application/json',
            };

            if (sessionToken) {
                headers['X-Session-Token'] = sessionToken;
            }

            return headers;
        },

        /**
         * Get the current session token
         * @returns {string|null} Session token or null if not logged in
         */
        getSessionToken() {
            return sessionToken || sessionStorage.getItem('api_session_token');
        },

        /**
         * Check if current session is valid
         * @returns {Promise<boolean>} True if session is valid
         */
        async validateSession() {
            const token = this.getSessionToken();
            if (!token) {
                return false;
            }

            try {
                const response = await fetch('/api/auth/validate', {
                    method: 'GET',
                    headers: {
                        'X-Session-Token': token
                    }
                });

                if (response.ok) {
                    return true;
                }

                // Session invalid - clear it
                if (response.status === 401) {
                    this.clearSession();
                    return false;
                }

                return false;
            } catch (error) {
                console.error('Session validation error:', error);
                return false;
            }
        },

        /**
         * Clear session without making API call
         */
        clearSession() {
            sessionToken = null;
            sessionStorage.removeItem('api_session_token');
        },

        /**
         * Handle unauthorized response - clears session and triggers re-login
         * @param {Function} onSessionInvalid - Callback when session is invalid
         */
        onUnauthorized: null,

        /**
         * Set callback for unauthorized responses
         * @param {Function} callback - Function to call when session is invalid
         */
        setUnauthorizedCallback(callback) {
            this.onUnauthorized = callback;
        },

        /**
         * Handle API response and check for auth errors
         * @param {Response} response - Fetch response
         * @returns {Response} The response if OK
         * @throws {Error} If unauthorized or other error
         */
        async handleResponse(response) {
            if (response.status === 401) {
                this.clearSession();
                if (this.onUnauthorized) {
                    this.onUnauthorized();
                }
                throw new Error('Session expired. Please log in again.');
            }
            return response;
        },
        /**
         * Get all settings from server
         * @returns {Promise<Object>} Settings object
         */
        async getAll() {
            try {
                const response = await fetch(API_BASE);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error loading settings from server:', error);
                // Fallback to localStorage if API fails
                return this.getFromLocalStorage();
            }
        },

        /**
         * Save all settings to server
         * @param {Object} settings - Complete settings object
         * @returns {Promise<Object>} Response from server
         */
        async saveAll(settings) {
            try {
                const response = await fetch(API_BASE, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(settings)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log(`Settings saved and broadcast to ${result.clients} displays`);
                return result;
            } catch (error) {
                console.error('Error saving settings to server:', error);
                throw error;
            }
        },

        /**
         * Save a specific setting key
         * @param {string} key - Setting key
         * @param {*} value - Setting value
         * @returns {Promise<Object>} Response from server
         */
        async save(key, value) {
            try {
                const response = await fetch(`${API_BASE}/${key}`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ value })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log(`Setting '${key}' saved and broadcast to ${result.clients} displays`);
                return result;
            } catch (error) {
                console.error(`Error saving setting '${key}' to server:`, error);
                throw error;
            }
        },

        /**
         * Get setting from localStorage (fallback)
         * @param {string} key - Setting key
         * @returns {*} Setting value or null
         */
        getFromLocalStorage(key) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : null;
            } catch (error) {
                return null;
            }
        },

        /**
         * Get all settings from localStorage (fallback)
         * @returns {Object} All settings from localStorage
         */
        getAllFromLocalStorage() {
            const settings = {};
            const keys = [
                'customTheme',
                'customThemes',
                'customSlides',
                'livestreamConfig',
                'generalConfig',
                'USE_IMAGE_SLIDES'
            ];

            keys.forEach(key => {
                const value = this.getFromLocalStorage(key);
                if (value !== null) {
                    settings[key] = value;
                }
            });

            return settings;
        },

        /**
         * Migrate localStorage settings to server (one-time migration)
         * @returns {Promise<void>}
         */
        async migrateFromLocalStorage() {
            console.log('Migrating localStorage settings to server...');

            const localSettings = this.getAllFromLocalStorage();

            if (Object.keys(localSettings).length === 0) {
                console.log('No localStorage settings to migrate');
                return;
            }

            try {
                await this.saveAll(localSettings);
                console.log('Successfully migrated settings to server');
                console.log('Migrated keys:', Object.keys(localSettings));
            } catch (error) {
                console.error('Error migrating settings:', error);
                throw error;
            }
        }
    };

    // Export to window
    window.SettingsAPI = SettingsAPI;

    console.log('Settings API Client loaded');

})();
