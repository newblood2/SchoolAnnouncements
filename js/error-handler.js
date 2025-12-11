/**
 * @fileoverview Error Handler Module - Centralized error management and user notifications
 * @module error-handler
 * @description Provides comprehensive error handling with user-friendly toast notifications,
 * automatic retry logic, severity-based responses, and global error catching. Prevents error
 * notification spam with a queue system and handles both synchronous and asynchronous errors.
 *
 * @example
 * // Basic error handling
 * window.ErrorHandler.handle(error, {
 *   level: window.ErrorLevel.ERROR,
 *   module: 'Weather',
 *   userMessage: 'Failed to load weather data'
 * });
 *
 * @example
 * // Network retry with exponential backoff
 * await window.ErrorHandler.handleNetworkError(
 *   () => fetch(url),
 *   { maxRetries: 3, module: 'API' }
 * );
 *
 * @example
 * // Recoverable error with retry button
 * window.ErrorHandler.handle(error, {
 *   level: window.ErrorLevel.WARNING,
 *   recoverable: true,
 *   onRetry: () => retryOperation()
 * });
 *
 * @requires module:constants - For element IDs and configuration
 */

(function() {
    'use strict';

    // Import constants
    const CONSTANTS = window.APP_CONSTANTS;

    // Error notification queue
    const notificationQueue = [];
    let isShowingNotification = false;

    /**
     * Error severity levels enumeration
     * @enum {string}
     * @readonly
     * @property {string} INFO - Informational message (blue)
     * @property {string} WARNING - Warning message (orange)
     * @property {string} ERROR - Error message (red)
     * @property {string} CRITICAL - Critical error requiring attention (dark red, pulsing)
     */
    const ErrorLevel = {
        INFO: 'info',
        WARNING: 'warning',
        ERROR: 'error',
        CRITICAL: 'critical'
    };

    /**
     * @typedef {Object} ErrorOptions
     * @property {string} [level='error'] - Error severity level (info|warning|error|critical)
     * @property {string} [module='Unknown'] - Module or component where error occurred
     * @property {boolean} [showNotification=true] - Whether to show toast notification
     * @property {string|null} [userMessage=null] - Custom user-friendly message
     * @property {boolean} [recoverable=false] - Whether error can be retried
     * @property {Function|null} [onRetry=null] - Callback function for retry button
     */

    /**
     * @typedef {Object} NetworkRetryOptions
     * @property {number} [maxRetries=3] - Maximum retry attempts
     * @property {number} [retryDelay=1000] - Initial delay between retries (ms)
     * @property {number} [backoffMultiplier=2] - Exponential backoff multiplier
     * @property {string} [module='Network'] - Module name for logging
     * @property {string} [userMessage='Network request failed'] - Error message
     */

    /**
     * Centralized error handler for the application
     * @class ErrorHandler
     * @classdesc Manages all error handling, logging, and user notifications. Provides static
     * methods for handling errors, displaying notifications, and retrying failed operations.
     */
    class ErrorHandler {
        /**
         * Handles an error with logging and optional user notification
         * @param {Error|string} error - Error object or message
         * @param {Object} options - Error handling options
         * @param {string} options.level - Error level (info, warning, error, critical)
         * @param {string} options.module - Module where error occurred
         * @param {boolean} options.showNotification - Whether to show user notification
         * @param {string} options.userMessage - User-friendly error message
         * @param {boolean} options.recoverable - Whether error is recoverable
         * @param {Function} options.onRetry - Retry callback function
         */
        static handle(error, options = {}) {
            const {
                level = ErrorLevel.ERROR,
                module = 'Unknown',
                showNotification = true,
                userMessage = null,
                recoverable = false,
                onRetry = null
            } = options;

            // Log to console with context
            this.logError(error, level, module);

            // Show user notification if requested
            if (showNotification) {
                const message = userMessage || this.getDefaultMessage(error, level);
                this.showNotification(message, level, recoverable ? onRetry : null);
            }

            // Track error for analytics (if implemented)
            this.trackError(error, module, level);
        }

        /**
         * Logs error to console with appropriate formatting
         * @param {Error|string} error - Error to log
         * @param {string} level - Error level
         * @param {string} module - Module name
         */
        static logError(error, level, module) {
            const timestamp = new Date().toISOString();
            const errorMessage = error instanceof Error ? error.message : error;
            const stack = error instanceof Error ? error.stack : '';

            const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${module}] ${errorMessage}`;

            switch (level) {
                case ErrorLevel.INFO:
                    console.info(logMessage);
                    break;
                case ErrorLevel.WARNING:
                    console.warn(logMessage);
                    break;
                case ErrorLevel.ERROR:
                case ErrorLevel.CRITICAL:
                    console.error(logMessage);
                    if (stack) console.error('Stack trace:', stack);
                    break;
            }
        }

        /**
         * Gets default user-friendly message based on error
         * @param {Error|string} error - Error object or message
         * @param {string} level - Error level
         * @returns {string} User-friendly message
         */
        static getDefaultMessage(error, level) {
            const errorString = error instanceof Error ? error.message : error;

            // Map common errors to user-friendly messages
            const errorMappings = {
                'Failed to fetch': 'Network connection issue. Please check your internet connection.',
                'NetworkError': 'Unable to connect to the server. Please check your connection.',
                'city not found': 'Location not found. Please check your weather location settings.',
                'Invalid API key': 'Weather API key is invalid. Please check your configuration.',
                'API Key Missing': 'Weather API key is not configured. Please add your API key.',
                'Configure API Key': 'Please configure your weather API key in config.js'
            };

            // Check for matching error patterns
            for (const [pattern, message] of Object.entries(errorMappings)) {
                if (errorString.includes(pattern)) {
                    return message;
                }
            }

            // Default messages by level
            switch (level) {
                case ErrorLevel.INFO:
                    return errorString;
                case ErrorLevel.WARNING:
                    return `Warning: ${errorString}`;
                case ErrorLevel.ERROR:
                    return `An error occurred: ${errorString}`;
                case ErrorLevel.CRITICAL:
                    return `Critical error: ${errorString}. Please refresh the page.`;
                default:
                    return errorString;
            }
        }

        /**
         * Shows a notification to the user
         * @param {string} message - Message to display
         * @param {string} level - Error level
         * @param {Function|null} onRetry - Retry callback
         */
        static showNotification(message, level, onRetry = null) {
            // Add to queue
            notificationQueue.push({ message, level, onRetry });

            // Process queue if not already showing
            if (!isShowingNotification) {
                this.processNotificationQueue();
            }
        }

        /**
         * Processes the notification queue
         */
        static processNotificationQueue() {
            if (notificationQueue.length === 0) {
                isShowingNotification = false;
                return;
            }

            isShowingNotification = true;
            const { message, level, onRetry } = notificationQueue.shift();

            this.displayNotification(message, level, onRetry);
        }

        /**
         * Displays a notification toast
         * @param {string} message - Message to display
         * @param {string} level - Error level
         * @param {Function|null} onRetry - Retry callback
         */
        static displayNotification(message, level, onRetry) {
            const container = document.getElementById('errorNotificationContainer');
            if (!container) {
                console.error('Error notification container not found');
                this.processNotificationQueue();
                return;
            }

            // Create notification element
            const notification = document.createElement('div');
            notification.className = `error-notification error-notification-${level}`;
            notification.setAttribute('role', 'alert');
            notification.setAttribute('aria-live', 'assertive');

            // Add icon based on level
            const icon = this.getIconForLevel(level);

            // Build notification content
            let content = `
                <div class="error-notification-icon">${icon}</div>
                <div class="error-notification-message">${message}</div>
            `;

            // Add retry button if callback provided
            if (onRetry) {
                content += `
                    <button class="error-notification-retry" aria-label="Retry">
                        Retry
                    </button>
                `;
            }

            // Add close button
            content += `
                <button class="error-notification-close" aria-label="Close notification">
                    ×
                </button>
            `;

            notification.innerHTML = content;

            // Add event listeners
            const closeBtn = notification.querySelector('.error-notification-close');
            closeBtn.addEventListener('click', () => {
                this.removeNotification(notification);
            });

            if (onRetry) {
                const retryBtn = notification.querySelector('.error-notification-retry');
                retryBtn.addEventListener('click', () => {
                    this.removeNotification(notification);
                    onRetry();
                });
            }

            // Add to DOM
            container.appendChild(notification);

            // Trigger animation
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);

            // Auto-dismiss after timeout (except for critical errors)
            if (level !== ErrorLevel.CRITICAL) {
                const timeout = level === ErrorLevel.INFO ? 3000 : 5000;
                setTimeout(() => {
                    this.removeNotification(notification);
                }, timeout);
            }
        }

        /**
         * Removes a notification from display
         * @param {HTMLElement} notification - Notification element
         */
        static removeNotification(notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                // Process next notification in queue
                this.processNotificationQueue();
            }, 300); // Match CSS transition time
        }

        /**
         * Gets icon for error level
         * @param {string} level - Error level
         * @returns {string} Icon HTML
         */
        static getIconForLevel(level) {
            switch (level) {
                case ErrorLevel.INFO:
                    return 'ℹ️';
                case ErrorLevel.WARNING:
                    return '⚠️';
                case ErrorLevel.ERROR:
                    return '❌';
                case ErrorLevel.CRITICAL:
                    return '🚨';
                default:
                    return '•';
            }
        }

        /**
         * Tracks error for analytics (placeholder for future implementation)
         * @param {Error|string} error - Error to track
         * @param {string} module - Module name
         * @param {string} level - Error level
         */
        static trackError(error, module, level) {
            // Placeholder for analytics integration
            // Could send to analytics service, error tracking service, etc.
        }

        /**
         * Handles network errors with retry logic
         * @param {Function} fetchFn - Function to retry
         * @param {Object} options - Retry options
         * @returns {Promise} Promise that resolves with fetch result
         */
        static async handleNetworkError(fetchFn, options = {}) {
            const {
                maxRetries = 3,
                retryDelay = 1000,
                backoffMultiplier = 2,
                module = 'Network',
                userMessage = 'Network request failed'
            } = options;

            let lastError;
            let delay = retryDelay;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    return await fetchFn();
                } catch (error) {
                    lastError = error;

                    if (attempt < maxRetries) {
                        this.handle(error, {
                            level: ErrorLevel.WARNING,
                            module,
                            showNotification: false,
                            userMessage: `${userMessage}. Retrying... (${attempt + 1}/${maxRetries})`
                        });

                        // Wait before retry with exponential backoff
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= backoffMultiplier;
                    }
                }
            }

            // All retries failed
            this.handle(lastError, {
                level: ErrorLevel.ERROR,
                module,
                showNotification: true,
                userMessage: `${userMessage} after ${maxRetries} attempts.`,
                recoverable: true,
                onRetry: () => this.handleNetworkError(fetchFn, options)
            });

            throw lastError;
        }

        /**
         * Creates a safe wrapper for async functions
         * @param {Function} fn - Async function to wrap
         * @param {Object} options - Error handling options
         * @returns {Function} Wrapped function
         */
        static wrapAsync(fn, options = {}) {
            return async function(...args) {
                try {
                    return await fn.apply(this, args);
                } catch (error) {
                    ErrorHandler.handle(error, options);
                    if (!options.recoverable) {
                        throw error;
                    }
                }
            };
        }
    }

    // Global error handlers
    window.addEventListener('error', (event) => {
        ErrorHandler.handle(event.error || event.message, {
            level: ErrorLevel.ERROR,
            module: 'Global',
            showNotification: true,
            userMessage: 'An unexpected error occurred.'
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        ErrorHandler.handle(event.reason, {
            level: ErrorLevel.ERROR,
            module: 'Promise',
            showNotification: true,
            userMessage: 'An unexpected error occurred in background processing.'
        });
    });

    // Export to global scope
    window.ErrorHandler = ErrorHandler;
    window.ErrorLevel = ErrorLevel;

    console.log('Error Handler module initialized');

})();
