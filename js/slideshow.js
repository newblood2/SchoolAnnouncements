/**
 * @fileoverview Slideshow Module - Dynamic slide presentation management
 * @module slideshow
 * @description Manages slideshow functionality with support for both image-based slides
 * (loaded from JSON) and HTML-based slides. Includes automatic advancement, manual navigation,
 * and graceful error handling for missing images.
 *
 * @example
 * // Module initializes automatically and provides public API
 * window.Slideshow.next(); // Advance to next slide
 * window.Slideshow.previous(); // Go to previous slide
 * window.Slideshow.show(); // Show slideshow
 * window.Slideshow.hide(); // Hide slideshow
 *
 * @requires module:constants - For intervals, folders, and CSS classes
 * @requires module:error-handler - For error notifications
 */

(function() {
    'use strict';

    // Import constants
    const CONSTANTS = window.APP_CONSTANTS;

    // State
    let currentSlide = 0;
    let slides = [];
    let slideshowInterval = null;
    let imageSlides = [];
    let countdownInterval = null;

    /**
     * Loads image slides from the slides folder
     */
    async function loadImageSlides() {
        const slidesFolder = (window.CONFIG && window.CONFIG.SLIDES_FOLDER) || CONSTANTS.SLIDESHOW_DEFAULT_FOLDER;
        const useImageSlides = (window.CONFIG && window.CONFIG.USE_IMAGE_SLIDES) || false;

        if (!useImageSlides) {
            console.log('Using HTML slides');
            return;
        }

        try {
            const response = await fetch(`${slidesFolder}/slides.json`);
            if (!response.ok) {
                window.ErrorHandler.handle('slides.json not found', {
                    level: window.ErrorLevel.WARNING,
                    module: 'Slideshow',
                    showNotification: false, // Don't notify for expected fallback
                    userMessage: 'Slideshow configuration not found. Using default slides.'
                });
                return;
            }

            const data = await response.json();
            imageSlides = data.images || [];

            if (imageSlides.length === 0) {
                window.ErrorHandler.handle('No images in slides.json', {
                    level: window.ErrorLevel.WARNING,
                    module: 'Slideshow',
                    showNotification: false,
                    userMessage: 'No images configured in slides.json. Using default slides.'
                });
                return;
            }

            console.log(`Loaded ${imageSlides.length} image slides from ${slidesFolder}`);
            createImageSlides(slidesFolder, imageSlides);

        } catch (error) {
            window.ErrorHandler.handle(error, {
                level: window.ErrorLevel.WARNING,
                module: 'Slideshow',
                showNotification: true,
                userMessage: 'Failed to load image slides. Using default slides instead.',
                recoverable: false
            });
        }
    }

    /**
     * Creates image slide elements in the DOM
     * @param {string} slidesFolder - Path to slides folder
     * @param {Array} images - Array of image filenames
     */
    function createImageSlides(slidesFolder, images) {
        const slideshowContainer = document.getElementById(CONSTANTS.ELEMENT_IDS.SLIDESHOW_CONTAINER);
        if (!slideshowContainer) {
            window.ErrorHandler.handle('Slideshow container not found', {
                level: window.ErrorLevel.ERROR,
                module: 'Slideshow',
                showNotification: true,
                userMessage: 'Unable to initialize slideshow display.'
            });
            return;
        }

        // Clear existing HTML slides
        slideshowContainer.innerHTML = '';

        // Create image slides with error handling
        images.forEach((imageName, index) => {
            const slideDiv = document.createElement('div');
            slideDiv.className = CONSTANTS.CSS_CLASSES.SLIDE;
            if (index === 0) slideDiv.classList.add(CONSTANTS.CSS_CLASSES.SLIDE_ACTIVE);

            const img = document.createElement('img');
            img.src = `${slidesFolder}/${imageName}`;
            img.alt = `Slide ${index + 1}`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';

            // Handle image loading errors
            img.onerror = () => {
                window.ErrorHandler.handle(`Failed to load image: ${imageName}`, {
                    level: window.ErrorLevel.WARNING,
                    module: 'Slideshow',
                    showNotification: false, // Don't spam for each failed image
                    userMessage: `Failed to load slide image: ${imageName}`
                });

                // Replace with error message
                slideDiv.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column;">
                        <h2 style="color: #e74c3c;">⚠️ Image Not Found</h2>
                        <p style="font-size: 2rem;">${imageName}</p>
                    </div>
                `;
            };

            slideDiv.appendChild(img);
            slideshowContainer.appendChild(slideDiv);
        });
    }

    /**
     * Initializes the slideshow
     */
    function initSlideshow() {
        // Reset state
        currentSlide = 0;
        slides = document.querySelectorAll(`.${CONSTANTS.CSS_CLASSES.SLIDE}`);

        if (slides.length > 0) {
            showSlide(0);

            // Auto-advance slides
            const interval = (window.CONFIG && window.CONFIG.SLIDESHOW_INTERVAL) || CONSTANTS.SLIDESHOW_DEFAULT_INTERVAL_MS;
            slideshowInterval = setInterval(nextSlide, interval);
        }
    }

    /**
     * Displays a specific slide by index
     * @param {number} index - Slide index to display
     */
    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove(CONSTANTS.CSS_CLASSES.SLIDE_ACTIVE));

        if (index >= slides.length) {
            currentSlide = 0;
        } else if (index < 0) {
            currentSlide = slides.length - 1;
        } else {
            currentSlide = index;
        }

        slides[currentSlide].classList.add(CONSTANTS.CSS_CLASSES.SLIDE_ACTIVE);

        // Start/stop countdown updates based on current slide
        checkForCountdownSlide();

        // Track slide view for analytics
        trackSlideView(currentSlide);
    }

    /**
     * Track slide view for analytics
     * @param {number} slideIndex - Index of the viewed slide
     */
    function trackSlideView(slideIndex) {
        const slide = slides[slideIndex];
        if (!slide) return;

        // Get slide name from content
        let slideName = 'Slide ' + (slideIndex + 1);
        const h1 = slide.querySelector('h1');
        const h2 = slide.querySelector('h2');
        if (h1) slideName = h1.textContent.trim();
        else if (h2) slideName = h2.textContent.trim();

        // Send to analytics API (fire and forget)
        fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                slideName,
                displayId: window.displayId || localStorage.getItem('displayId') || 'unknown'
            })
        }).catch(() => {}); // Ignore errors - analytics shouldn't break the display
    }

    /**
     * Checks if the current slide has a countdown and starts live updates
     */
    function checkForCountdownSlide() {
        // Stop any existing countdown interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        // Check if current slide has a countdown element
        const currentSlideEl = slides[currentSlide];
        if (!currentSlideEl) return;

        const countdownSlide = currentSlideEl.querySelector('.countdown-slide[data-target-date]');
        if (countdownSlide) {
            // Update immediately and then every second
            updateCountdown(countdownSlide);
            countdownInterval = setInterval(() => updateCountdown(countdownSlide), 1000);
        }

        // Also check for calendar events slide
        const calendarSlide = currentSlideEl.querySelector('.calendar-events-slide');
        if (calendarSlide) {
            populateCalendarEvents(calendarSlide);
        }
    }

    /**
     * Populates calendar events slide with data from settings
     * @param {HTMLElement} calendarSlide - The calendar events slide element
     */
    async function populateCalendarEvents(calendarSlide) {
        const daysAhead = parseInt(calendarSlide.dataset.daysAhead) || 7;
        const maxEvents = parseInt(calendarSlide.dataset.maxEvents) || 5;
        const showTime = calendarSlide.dataset.showTime === 'true';

        const eventsList = calendarSlide.querySelector('.calendar-events-list');
        if (!eventsList) return;

        try {
            // Fetch calendar events from settings
            const response = await fetch('/api/settings');
            const settings = await response.json();
            const calendarEvents = settings.calendarEvents || [];

            // Filter to upcoming events within daysAhead
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() + daysAhead);

            const upcomingEvents = calendarEvents
                .filter(event => {
                    const eventDate = new Date(event.date + 'T00:00:00');
                    return eventDate >= today && eventDate <= endDate;
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, maxEvents);

            if (upcomingEvents.length === 0) {
                eventsList.innerHTML = '<li class="calendar-event-item no-events">No upcoming events</li>';
                return;
            }

            // Render events
            eventsList.innerHTML = upcomingEvents.map(event => {
                const eventDate = new Date(event.date + 'T00:00:00');
                const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const timeStr = showTime && event.time ? `<span class="event-time">${escapeHtml(event.time)}</span>` : '';

                return `
                    <li class="calendar-event-item">
                        <span class="event-date">${dateStr}</span>
                        <span class="event-name">${escapeHtml(event.event)}</span>
                        ${timeStr}
                    </li>
                `;
            }).join('');

        } catch (error) {
            console.error('Failed to load calendar events:', error);
            eventsList.innerHTML = '<li class="calendar-event-item error">Failed to load events</li>';
        }
    }

    /**
     * Escape HTML entities for safe display
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Updates countdown display values
     * @param {HTMLElement} countdownSlide - The countdown slide element
     */
    function updateCountdown(countdownSlide) {
        const targetDate = countdownSlide.dataset.targetDate;
        const showHours = countdownSlide.dataset.showHours === 'true';

        if (!targetDate) return;

        const target = new Date(targetDate + 'T00:00:00');
        const now = new Date();
        const diff = target - now;

        if (diff <= 0) {
            // Event has passed
            const existingContent = countdownSlide.querySelector('.countdown-numbers, .countdown-days');
            if (existingContent) {
                existingContent.outerHTML = '<div class="countdown-reached">It\'s here!</div>';
            }
            // Stop updating
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Update the values
        const daysEl = countdownSlide.querySelector('[data-unit="days"]');
        const hoursEl = countdownSlide.querySelector('[data-unit="hours"]');
        const minutesEl = countdownSlide.querySelector('[data-unit="minutes"]');
        const secondsEl = countdownSlide.querySelector('[data-unit="seconds"]');

        if (daysEl) daysEl.textContent = days;
        if (hoursEl) hoursEl.textContent = hours;
        if (minutesEl) minutesEl.textContent = minutes;
        if (secondsEl) secondsEl.textContent = seconds;
    }

    /**
     * Advances to the next slide
     */
    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    /**
     * Goes back to the previous slide
     */
    function previousSlide() {
        showSlide(currentSlide - 1);
    }

    /**
     * Stops the slideshow
     */
    function stopSlideshow() {
        if (slideshowInterval) {
            clearInterval(slideshowInterval);
            slideshowInterval = null;
        }
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    /**
     * Restarts the slideshow
     */
    function restartSlideshow() {
        stopSlideshow();
        initSlideshow();
    }

    /**
     * Shows the slideshow container
     */
    function show() {
        const slideshowContainer = document.getElementById(CONSTANTS.ELEMENT_IDS.SLIDESHOW_CONTAINER);
        if (slideshowContainer) {
            slideshowContainer.style.display = 'flex';
        }
        restartSlideshow();
    }

    /**
     * Hides the slideshow container
     */
    function hide() {
        const slideshowContainer = document.getElementById(CONSTANTS.ELEMENT_IDS.SLIDESHOW_CONTAINER);
        if (slideshowContainer) {
            slideshowContainer.style.display = 'none';
        }
        stopSlideshow();
    }

    /**
     * Initializes the slideshow module
     */
    async function init() {
        await loadImageSlides();
        initSlideshow();
        console.log('Slideshow module initialized');
    }

    // Export public API
    window.Slideshow = {
        init,
        next: nextSlide,
        previous: previousSlide,
        show,
        hide,
        restart: restartSlideshow
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
