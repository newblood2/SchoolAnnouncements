/**
 * @fileoverview Dismissal Display Module - Shows student names on TVs
 * @module dismissal-display
 * @description Full-screen display showing students called for dismissal.
 * Automatically updates in real-time when teachers add students.
 */

(function() {
    'use strict';

    const CONSTANTS = window.APP_CONSTANTS;

    // State
    let isDismissalActive = false;
    let currentStudents = [];
    let dismissalCheckInterval = null;

    /**
     * Create dismissal display container
     */
    function createDismissalContainer() {
        const existingContainer = document.getElementById('dismissalDisplay');
        if (existingContainer) {
            return existingContainer;
        }

        const container = document.createElement('div');
        container.id = 'dismissalDisplay';
        container.className = 'dismissal-display';
        container.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            z-index: 10000;
            overflow: hidden;
        `;

        container.innerHTML = `
            <style>
                .dismissal-header {
                    text-align: center;
                    padding: 3rem 2rem;
                    background: rgba(0, 0, 0, 0.2);
                }

                .dismissal-title {
                    font-size: 4rem;
                    font-weight: 700;
                    color: #ffd700;
                    margin: 0;
                    text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.4);
                }

                .dismissal-subtitle {
                    font-size: 2rem;
                    color: white;
                    margin: 1rem 0 0 0;
                    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.4);
                }

                .dismissal-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 2rem;
                    padding: 3rem;
                    max-width: 1800px;
                    margin: 0 auto;
                    animation: fadeIn 0.5s ease-in;
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .student-card {
                    background: white;
                    border-radius: 16px;
                    padding: 2.5rem 2rem;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                    text-align: center;
                    animation: slideIn 0.4s ease-out;
                    transition: transform 0.3s;
                }

                .student-card:hover {
                    transform: translateY(-5px);
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .student-name {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: #1e3c72;
                    margin: 0 0 1rem 0;
                    line-height: 1.2;
                }

                .student-grade {
                    font-size: 1.75rem;
                    color: #666;
                    font-weight: 500;
                }

                .dismissal-empty {
                    text-align: center;
                    color: white;
                    font-size: 2.5rem;
                    padding: 4rem 2rem;
                    opacity: 0.7;
                }

                /* Responsive adjustments */
                @media (max-width: 1400px) {
                    .dismissal-grid {
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    }
                    .student-name {
                        font-size: 2rem;
                    }
                    .student-grade {
                        font-size: 1.5rem;
                    }
                }

                @media (max-width: 900px) {
                    .dismissal-title {
                        font-size: 3rem;
                    }
                    .dismissal-subtitle {
                        font-size: 1.5rem;
                    }
                    .dismissal-grid {
                        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                        gap: 1.5rem;
                        padding: 2rem;
                    }
                }
            </style>

            <div class="dismissal-header">
                <h1 class="dismissal-title">🚗 DISMISSAL</h1>
                <p class="dismissal-subtitle">Please Come to Pickup</p>
            </div>
            <div id="dismissalGrid" class="dismissal-grid"></div>
        `;

        document.body.appendChild(container);
        return container;
    }

    /**
     * Show dismissal display
     */
    function showDismissal() {
        console.log('Showing dismissal display');

        // Hide other displays
        if (window.Slideshow) {
            window.Slideshow.hide();
        }
        if (window.Livestream && window.Livestream.isActive()) {
            window.Livestream.show(null); // Hide livestream
        }

        const container = createDismissalContainer();
        container.style.display = 'block';
        isDismissalActive = true;

        updateDismissalDisplay();
    }

    /**
     * Hide dismissal display
     */
    function hideDismissal() {
        console.log('Hiding dismissal display');

        const container = document.getElementById('dismissalDisplay');
        if (container) {
            container.style.display = 'none';
        }

        isDismissalActive = false;
        currentStudents = [];

        // Restore slideshow
        if (window.Slideshow) {
            window.Slideshow.show();
        }
    }

    /**
     * Update dismissal display with current students
     */
    function updateDismissalDisplay() {
        const grid = document.getElementById('dismissalGrid');
        if (!grid) return;

        if (currentStudents.length === 0) {
            grid.innerHTML = '<div class="dismissal-empty">Waiting for students...</div>';
        } else {
            grid.innerHTML = currentStudents.map(student => `
                <div class="student-card">
                    <div class="student-name">${escapeHtml(student.name)}</div>
                    <div class="student-grade">Grade ${escapeHtml(student.grade)}</div>
                </div>
            `).join('');
        }
    }

    /**
     * Update students list (called from SSE events)
     * @param {Array} students - Array of student objects
     */
    function updateStudents(students) {
        currentStudents = students || [];
        if (isDismissalActive) {
            updateDismissalDisplay();
        }
    }

    /**
     * Fetch dismissal status from API
     */
    async function checkDismissalStatus() {
        try {
            const response = await fetch('/api/dismissal/status');
            if (!response.ok) {
                throw new Error('Failed to fetch dismissal status');
            }

            const data = await response.json();

            // Update state
            const wasActive = isDismissalActive;
            isDismissalActive = data.active || false;
            currentStudents = data.students || [];

            // Show/hide dismissal display
            if (isDismissalActive && !wasActive) {
                showDismissal();
            } else if (!isDismissalActive && wasActive) {
                hideDismissal();
            } else if (isDismissalActive) {
                updateDismissalDisplay();
            }

        } catch (error) {
            console.error('Error checking dismissal status:', error);
        }
    }

    /**
     * Start monitoring dismissal status
     */
    function startDismissalMonitoring() {
        console.log('Dismissal monitoring started');

        // Initial check
        checkDismissalStatus();

        // Check every 5 seconds
        dismissalCheckInterval = setInterval(checkDismissalStatus, 5000);
    }

    /**
     * Stop monitoring dismissal status
     */
    function stopDismissalMonitoring() {
        if (dismissalCheckInterval) {
            clearInterval(dismissalCheckInterval);
            dismissalCheckInterval = null;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Initialize dismissal display
     */
    function init() {
        createDismissalContainer();
        startDismissalMonitoring();
        console.log('Dismissal display module initialized');
    }

    // Export public API
    window.DismissalDisplay = {
        show: showDismissal,
        hide: hideDismissal,
        isActive: () => isDismissalActive,
        updateStudents: updateStudents,
        startMonitoring: startDismissalMonitoring,
        stopMonitoring: stopDismissalMonitoring
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
