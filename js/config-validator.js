/**
 * @fileoverview Config Validator Module - Validates application configuration
 *
 * This module validates the CONFIG object to ensure all required settings are
 * properly configured. It provides helpful error messages to guide users in
 * fixing configuration issues.
 *
 * @example
 * // Automatically runs on initialization
 * const isValid = window.ConfigValidator.validate();
 * if (!isValid) {
 *     console.error('Configuration errors detected');
 * }
 */

(function() {
    'use strict';

    /**
     * @typedef {Object} ValidationResult
     * @property {boolean} isValid - Whether the configuration is valid
     * @property {string[]} errors - Array of error messages
     * @property {string[]} warnings - Array of warning messages
     */

    /**
     * Configuration Validator Class
     */
    class ConfigValidator {
        /**
         * Validates the entire configuration object
         * @returns {ValidationResult} Validation result with errors and warnings
         */
        static validate() {
            const errors = [];
            const warnings = [];

            // Check if CONFIG exists
            if (typeof window.CONFIG === 'undefined') {
                errors.push('CONFIG object is not defined. Please ensure config.js is loaded.');
                return { isValid: false, errors, warnings };
            }

            const config = window.CONFIG;

            // Validate school name
            this.validateSchoolName(config, errors, warnings);

            // Validate weather configuration
            this.validateWeatherConfig(config, errors, warnings);

            // Validate slideshow configuration
            this.validateSlideshowConfig(config, errors, warnings);

            // Validate livestream configuration
            this.validateLivestreamConfig(config, errors, warnings);

            const isValid = errors.length === 0;

            // Log results
            if (errors.length > 0) {
                console.error('❌ Configuration Validation Failed:');
                errors.forEach((error, index) => {
                    console.error(`  ${index + 1}. ${error}`);
                });
            }

            if (warnings.length > 0) {
                console.warn('⚠️  Configuration Warnings:');
                warnings.forEach((warning, index) => {
                    console.warn(`  ${index + 1}. ${warning}`);
                });
            }

            if (isValid && warnings.length === 0) {
                console.log('✅ Configuration validated successfully');
            }

            return { isValid, errors, warnings };
        }

        /**
         * Validates school name configuration
         * @param {Object} config - Configuration object
         * @param {string[]} errors - Array to collect errors
         * @param {string[]} warnings - Array to collect warnings
         */
        static validateSchoolName(config, errors, warnings) {
            if (!config.SCHOOL_NAME || typeof config.SCHOOL_NAME !== 'string') {
                errors.push('SCHOOL_NAME is required and must be a string');
            } else if (config.SCHOOL_NAME.trim().length === 0) {
                errors.push('SCHOOL_NAME cannot be empty');
            } else if (config.SCHOOL_NAME.length > 100) {
                warnings.push('SCHOOL_NAME is very long and may not display properly');
            }
        }

        /**
         * Validates weather API configuration
         * @param {Object} config - Configuration object
         * @param {string[]} errors - Array to collect errors
         * @param {string[]} warnings - Array to collect warnings
         */
        static validateWeatherConfig(config, errors, warnings) {
            // Note: WEATHER_API_KEY is now stored securely on the server (in .env)
            // No client-side validation needed for the API key

            // Validate location configuration
            const hasLocation = config.LOCATION && typeof config.LOCATION === 'string' && config.LOCATION.trim().length > 0;
            const hasCityId = config.CITY_ID && typeof config.CITY_ID === 'number' && config.CITY_ID > 0;

            if (!hasLocation && !hasCityId) {
                errors.push('Either LOCATION or CITY_ID must be set for weather functionality');
            }

            if (hasLocation && hasCityId) {
                warnings.push('Both LOCATION and CITY_ID are set. CITY_ID will take precedence');
            }

            // Validate location format if provided
            if (hasLocation) {
                const locationParts = config.LOCATION.split(',');
                if (locationParts.length < 2) {
                    warnings.push('LOCATION should be in format "City,StateCode,CountryCode" (e.g., "Bel Air,MD,US")');
                }
            }
        }

        /**
         * Validates slideshow configuration
         * @param {Object} config - Configuration object
         * @param {string[]} errors - Array to collect errors
         * @param {string[]} warnings - Array to collect warnings
         */
        static validateSlideshowConfig(config, errors, warnings) {
            // Validate slideshow interval
            if (typeof config.SLIDESHOW_INTERVAL !== 'number') {
                errors.push('SLIDESHOW_INTERVAL must be a number (milliseconds)');
            } else if (config.SLIDESHOW_INTERVAL < 1000) {
                warnings.push('SLIDESHOW_INTERVAL is less than 1 second. This may cause slides to change too quickly');
            } else if (config.SLIDESHOW_INTERVAL > 60000) {
                warnings.push('SLIDESHOW_INTERVAL is greater than 1 minute. Slides may change too slowly');
            }

            // Validate image slides configuration
            if (typeof config.USE_IMAGE_SLIDES !== 'boolean') {
                errors.push('USE_IMAGE_SLIDES must be a boolean (true or false)');
            }

            if (config.USE_IMAGE_SLIDES) {
                if (!config.SLIDES_FOLDER || typeof config.SLIDES_FOLDER !== 'string') {
                    errors.push('SLIDES_FOLDER must be set when USE_IMAGE_SLIDES is true');
                } else if (config.SLIDES_FOLDER.trim().length === 0) {
                    errors.push('SLIDES_FOLDER cannot be empty when USE_IMAGE_SLIDES is true');
                }
            }
        }

        /**
         * Validates livestream configuration
         * @param {Object} config - Configuration object
         * @param {string[]} errors - Array to collect errors
         * @param {string[]} warnings - Array to collect warnings
         */
        static validateLivestreamConfig(config, errors, warnings) {
            // Validate auto-detect setting
            if (typeof config.AUTO_DETECT_LIVESTREAM !== 'boolean') {
                errors.push('AUTO_DETECT_LIVESTREAM must be a boolean (true or false)');
            }

            // Validate livestream URL if auto-detect is enabled
            if (config.AUTO_DETECT_LIVESTREAM) {
                if (!config.LIVESTREAM_URL) {
                    warnings.push('AUTO_DETECT_LIVESTREAM is enabled but LIVESTREAM_URL is not set');
                } else if (typeof config.LIVESTREAM_URL !== 'string') {
                    errors.push('LIVESTREAM_URL must be a string when set');
                } else if (!this.isValidUrl(config.LIVESTREAM_URL)) {
                    warnings.push('LIVESTREAM_URL does not appear to be a valid URL');
                }
            }

            // Validate check interval
            if (typeof config.LIVESTREAM_CHECK_INTERVAL !== 'number') {
                errors.push('LIVESTREAM_CHECK_INTERVAL must be a number (milliseconds)');
            } else if (config.LIVESTREAM_CHECK_INTERVAL < 10000) {
                warnings.push('LIVESTREAM_CHECK_INTERVAL is less than 10 seconds. This may cause excessive network requests');
            }
        }

        /**
         * Validates if a string is a valid URL
         * @param {string} urlString - URL string to validate
         * @returns {boolean} True if valid URL
         */
        static isValidUrl(urlString) {
            try {
                const url = new URL(urlString);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch (e) {
                return false;
            }
        }

        /**
         * Displays configuration errors and warnings to the user
         * Shows a helpful overlay with instructions on how to fix issues
         * @param {ValidationResult} result - Validation result
         */
        static displayValidationErrors(result) {
            if (result.isValid && result.warnings.length === 0) {
                return;
            }

            // Create error overlay
            const overlay = document.createElement('div');
            overlay.id = 'config-error-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #c0392b 0%, #8e44ad 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                font-family: 'Poppins', sans-serif;
                padding: 2rem;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                max-width: 800px;
                background: rgba(0, 0, 0, 0.8);
                padding: 3rem;
                border-radius: 20px;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            `;

            let html = `
                <h1 style="font-size: 3rem; margin-bottom: 1.5rem; text-align: center;">
                    ⚙️ Configuration ${result.errors.length > 0 ? 'Error' : 'Warning'}
                </h1>
            `;

            if (result.errors.length > 0) {
                html += `
                    <div style="background: rgba(231, 76, 60, 0.2); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border-left: 4px solid #e74c3c;">
                        <h2 style="font-size: 2rem; margin-bottom: 1rem; color: #e74c3c;">❌ Errors (must be fixed):</h2>
                        <ul style="font-size: 1.6rem; line-height: 1.8; padding-left: 2rem;">
                            ${result.errors.map(err => `<li style="margin-bottom: 0.5rem;">${err}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            if (result.warnings.length > 0) {
                html += `
                    <div style="background: rgba(243, 156, 18, 0.2); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border-left: 4px solid #f39c12;">
                        <h2 style="font-size: 2rem; margin-bottom: 1rem; color: #f39c12;">⚠️ Warnings (recommended to fix):</h2>
                        <ul style="font-size: 1.6rem; line-height: 1.8; padding-left: 2rem;">
                            ${result.warnings.map(warn => `<li style="margin-bottom: 0.5rem;">${warn}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            html += `
                <div style="background: rgba(52, 152, 219, 0.2); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #3498db;">
                    <h2 style="font-size: 2rem; margin-bottom: 1rem; color: #3498db;">💡 How to fix:</h2>
                    <ol style="font-size: 1.6rem; line-height: 1.8; padding-left: 2rem;">
                        <li style="margin-bottom: 0.5rem;">Open the <code style="background: rgba(255,255,255,0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">config.js</code> file</li>
                        <li style="margin-bottom: 0.5rem;">Update the configuration values according to the errors above</li>
                        <li style="margin-bottom: 0.5rem;">Save the file and refresh the page</li>
                    </ol>
                </div>
            `;

            if (!result.isValid) {
                html += `
                    <p style="text-align: center; margin-top: 2rem; font-size: 1.4rem; opacity: 0.8;">
                        The application cannot start until all errors are resolved.
                    </p>
                `;
            }

            content.innerHTML = html;
            overlay.appendChild(content);
            document.body.appendChild(overlay);
        }

        /**
         * Validates configuration and handles display of errors
         * @returns {boolean} True if configuration is valid
         */
        static validateAndDisplay() {
            const result = this.validate();

            // Display errors if validation failed or there are warnings
            if (!result.isValid) {
                this.displayValidationErrors(result);
                return false;
            }

            // Show warnings in console but allow app to continue
            if (result.warnings.length > 0) {
                window.ErrorHandler?.handle(
                    new Error('Configuration has warnings'),
                    {
                        level: 'warning',
                        module: 'ConfigValidator',
                        userMessage: `Configuration has ${result.warnings.length} warning(s). Check console for details.`,
                        showNotification: true
                    }
                );
            }

            return true;
        }
    }

    // Expose to window
    window.ConfigValidator = ConfigValidator;

})();
