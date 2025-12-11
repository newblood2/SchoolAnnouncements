/**
 * @fileoverview Shared Utilities Module
 * @module utils
 * @description Common utility functions used across the application.
 * Centralizes escapeHtml, showToast, normalizeGrade, debounce, and other helpers.
 */

(function() {
    'use strict';

    // ========================================
    // Constants
    // ========================================

    const TOAST_DURATION_MS = 3000;
    const DEFAULT_DEBOUNCE_MS = 300;

    // ========================================
    // HTML/Security Utilities
    // ========================================

    /**
     * Escape HTML to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML string
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Sanitize HTML content - removes dangerous tags/attributes
     * Allows safe formatting tags only
     * @param {string} html - HTML string to sanitize
     * @returns {string} Sanitized HTML
     */
    function sanitizeHtml(html) {
        if (!html) return '';

        // Create a temporary element
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Allowed tags whitelist
        const allowedTags = [
            'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'a', 'img', 'div',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ];

        // Allowed attributes whitelist
        const allowedAttrs = [
            'href', 'src', 'alt', 'title', 'class', 'style',
            'width', 'height', 'target', 'rel'
        ];

        // Recursively clean nodes
        function cleanNode(node) {
            const children = Array.from(node.childNodes);

            children.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const tagName = child.tagName.toLowerCase();

                    // Remove disallowed tags
                    if (!allowedTags.includes(tagName)) {
                        // Keep text content, remove tag
                        const text = document.createTextNode(child.textContent);
                        node.replaceChild(text, child);
                        return;
                    }

                    // Remove disallowed attributes
                    const attrs = Array.from(child.attributes);
                    attrs.forEach(attr => {
                        if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                            child.removeAttribute(attr.name);
                        }
                        // Remove javascript: URLs
                        if (attr.name === 'href' || attr.name === 'src') {
                            if (attr.value.toLowerCase().includes('javascript:')) {
                                child.removeAttribute(attr.name);
                            }
                        }
                        // Remove event handlers from style
                        if (attr.name === 'style') {
                            child.setAttribute('style',
                                attr.value.replace(/expression\s*\(/gi, '')
                                          .replace(/javascript:/gi, '')
                            );
                        }
                    });

                    // Recursively clean children
                    cleanNode(child);
                }
            });
        }

        cleanNode(temp);
        return temp.innerHTML;
    }

    // ========================================
    // Toast Notifications
    // ========================================

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type: 'info', 'success', 'warning', 'error'
     * @param {number} duration - Duration in ms (default: 3000)
     */
    function showToast(message, type = 'info', duration = TOAST_DURATION_MS) {
        const toast = document.getElementById('toast');
        if (!toast) {
            console.warn('Toast element not found, logging instead:', message);
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }

        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    // ========================================
    // Data Utilities
    // ========================================

    /**
     * Normalize grade format for consistent comparison
     * @param {string} grade - Grade input (e.g., "K", "1st", "Grade 2")
     * @returns {string} Normalized grade (e.g., "K", "1", "2")
     */
    function normalizeGrade(grade) {
        if (!grade) return '';

        const gradeStr = String(grade).trim().toLowerCase();

        // Handle kindergarten
        if (gradeStr === 'k' || gradeStr === 'kindergarten' || gradeStr === 'kinder') {
            return 'K';
        }

        // Handle pre-k
        if (gradeStr.includes('pre') || gradeStr === 'pk' || gradeStr === 'prek') {
            return 'PK';
        }

        // Extract numeric grade
        const numMatch = gradeStr.match(/(\d+)/);
        if (numMatch) {
            return numMatch[1];
        }

        return grade.trim();
    }

    // ========================================
    // Function Utilities
    // ========================================

    /**
     * Debounce a function - delays execution until after wait ms have elapsed
     * since the last time the debounced function was invoked
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms (default: 300)
     * @returns {Function} Debounced function
     */
    function debounce(func, wait = DEFAULT_DEBOUNCE_MS) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle a function - ensures function is called at most once per wait period
     * @param {Function} func - Function to throttle
     * @param {number} wait - Wait time in ms
     * @returns {Function} Throttled function
     */
    function throttle(func, wait) {
        let lastTime = 0;
        return function executedFunction(...args) {
            const now = Date.now();
            if (now - lastTime >= wait) {
                lastTime = now;
                func.apply(this, args);
            }
        };
    }

    // ========================================
    // Validation Utilities
    // ========================================

    /**
     * Validate and clamp a numeric value within a range
     * @param {number|string} value - Value to validate
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @param {number} defaultValue - Default if invalid
     * @returns {number} Validated number
     */
    function validateNumber(value, min, max, defaultValue) {
        const num = parseInt(value, 10);
        if (isNaN(num)) {
            return defaultValue;
        }
        return Math.min(Math.max(num, min), max);
    }

    /**
     * Validate a positive integer
     * @param {number|string} value - Value to validate
     * @param {number} defaultValue - Default if invalid
     * @returns {number} Validated positive integer
     */
    function validatePositiveInt(value, defaultValue) {
        const num = parseInt(value, 10);
        if (isNaN(num) || num <= 0) {
            return defaultValue;
        }
        return num;
    }

    // ========================================
    // Export Public API
    // ========================================

    window.Utils = {
        // HTML/Security
        escapeHtml,
        sanitizeHtml,

        // Toast
        showToast,

        // Data
        normalizeGrade,

        // Functions
        debounce,
        throttle,

        // Validation
        validateNumber,
        validatePositiveInt,

        // Constants
        TOAST_DURATION_MS,
        DEFAULT_DEBOUNCE_MS
    };

    // Also expose showToast globally for backwards compatibility
    if (!window.showToast) {
        window.showToast = showToast;
    }

    console.log('Utils module loaded');

})();
