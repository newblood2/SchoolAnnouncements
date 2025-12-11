/**
 * Layout Renderer Module
 * Renders the grid-based dashboard layout on the homepage
 */

(function() {
    'use strict';

    // Grid configuration (must match admin-layout.js) - 16:9 for TV displays
    const GRID_COLUMNS = 16;
    const GRID_ROWS = 9;

    // State
    let currentLayout = null;
    let layoutEnabled = false;
    let slideshowIntervals = {}; // Track slideshow intervals for cleanup

    /**
     * Initialize the layout renderer
     */
    async function init() {
        console.log('[LayoutRenderer] Initializing...');
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            console.log('[LayoutRenderer] Settings loaded, gridLayout exists:', !!settings.gridLayout);

            if (settings.gridLayout && settings.gridLayout.widgets && settings.gridLayout.widgets.length > 0) {
                currentLayout = settings.gridLayout;
                layoutEnabled = true;
                console.log('[LayoutRenderer] Rendering dashboard with', currentLayout.widgets.length, 'widgets');
                renderDashboard();
                console.log('[LayoutRenderer] Dashboard rendered successfully');
            } else {
                console.log('[LayoutRenderer] No custom layout found, using default HTML structure');
            }
        } catch (error) {
            console.error('[LayoutRenderer] Failed to load layout:', error);
        }
    }

    /**
     * Render the complete dashboard
     */
    function renderDashboard() {
        if (!currentLayout || !currentLayout.widgets) return;

        // Hide default layout elements
        hideDefaultLayout();

        // Create dashboard grid container
        const dashboard = document.createElement('div');
        dashboard.id = 'dashboardGrid';
        dashboard.className = 'dashboard-grid';
        dashboard.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${GRID_COLUMNS}, 1fr);
            grid-template-rows: repeat(${GRID_ROWS}, 1fr);
            gap: ${currentLayout.gap || 16}px;
            height: 100vh;
            width: 100vw;
            padding: ${currentLayout.gap || 16}px;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 1;
            overflow: hidden;
            background: linear-gradient(135deg, #134e5e 0%, #71b280 100%);
        `;

        // Render each widget
        currentLayout.widgets.forEach(widget => {
            const widgetEl = renderWidget(widget);
            if (widgetEl) {
                dashboard.appendChild(widgetEl);
            }
        });

        // Add dashboard to body
        document.body.appendChild(dashboard);

        // Initialize widget functionality
        initializeWidgets();
    }

    /**
     * Hide default layout elements
     */
    function hideDefaultLayout() {
        const elements = [
            '.main-content',
            '.weather-panel',
            '.bottom-panel'
        ];

        elements.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.style.display = 'none';
        });
    }

    /**
     * Render a single widget
     */
    function renderWidget(widget) {
        const container = document.createElement('div');
        container.className = `dashboard-widget widget-${widget.type}`;
        container.id = widget.id;
        container.style.cssText = `
            grid-column: ${widget.x + 1} / span ${widget.width};
            grid-row: ${widget.y + 1} / span ${widget.height};
            background: rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        // Get widget content based on type
        const content = getWidgetContent(widget);
        container.innerHTML = content;

        return container;
    }

    /**
     * Get widget HTML content
     */
    function getWidgetContent(widget) {
        switch (widget.type) {
            case 'slideshow':
                return getSlideshowContent(widget);
            case 'weather':
                return getWeatherContent(widget);
            case 'clock':
                return getClockContent(widget);
            case 'school-name':
                return getSchoolNameContent(widget);
            case 'calendar':
                return getCalendarContent(widget);
            case 'bell-schedule':
                return getBellScheduleContent(widget);
            case 'dismissal':
                return getDismissalContent(widget);
            case 'custom-text':
                return getCustomTextContent(widget);
            case 'custom-html':
                return getCustomHtmlContent(widget);
            case 'embed':
                return getEmbedContent(widget);
            case 'image':
                return getImageContent(widget);
            default:
                return '<div class="widget-placeholder">Unknown Widget</div>';
        }
    }

    /**
     * Slideshow widget content
     */
    function getSlideshowContent(widget) {
        return `
            <style>
                #widgetSlideshow-${widget.id} {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                #widgetSlideshow-${widget.id} .slide {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.5s ease-in-out, visibility 0.5s;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    text-align: center;
                    color: white;
                }
                #widgetSlideshow-${widget.id} .slide.active {
                    opacity: 1;
                    visibility: visible;
                }
                #widgetSlideshow-${widget.id} .slide h1,
                #widgetSlideshow-${widget.id} .slide h2 {
                    margin: 0 0 1rem 0;
                    font-size: 2.5rem;
                }
                #widgetSlideshow-${widget.id} .slide ul {
                    list-style: disc;
                    text-align: left;
                    font-size: 1.5rem;
                    line-height: 2;
                }
                #widgetSlideshow-${widget.id} .slide p {
                    font-size: 1.25rem;
                }
            </style>
            <div class="widget-slideshow"
                 data-interval="${widget.config.interval || 8000}"
                 data-transition="${widget.config.transition || 'fade'}"
                 data-slideshow-id="${widget.config.slideshowId || 'default'}"
                 style="width: 100%; height: 100%;">
                <div class="slideshow-container" id="widgetSlideshow-${widget.id}">
                    <div class="slide active">
                        <h1>Loading...</h1>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Weather widget content
     */
    function getWeatherContent(widget) {
        return `
            <div class="widget-weather-content" data-show-forecast="${widget.config.showForecast !== false}">
                <div class="weather-current">
                    <img class="weather-icon" id="widgetWeatherIcon-${widget.id}" src="" alt="Weather">
                    <div class="weather-temp" id="widgetWeatherTemp-${widget.id}">--°</div>
                    <div class="weather-desc" id="widgetWeatherDesc-${widget.id}">Loading...</div>
                </div>
                <div class="weather-details">
                    <div class="weather-detail">
                        <span class="label">Feels Like:</span>
                        <span id="widgetWeatherFeels-${widget.id}">--°</span>
                    </div>
                    <div class="weather-detail">
                        <span class="label">Humidity:</span>
                        <span id="widgetWeatherHumidity-${widget.id}">--%</span>
                    </div>
                </div>
                ${widget.config.showForecast !== false ? `
                    <div class="weather-forecast" id="widgetWeatherForecast-${widget.id}">
                        <!-- Forecast will be populated -->
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Clock widget content
     */
    function getClockContent(widget) {
        return `
            <div class="widget-clock-content"
                 data-show-date="${widget.config.showDate !== false}"
                 data-show-seconds="${widget.config.showSeconds === true}"
                 data-format-24h="${widget.config.format24h === true}">
                <div class="clock-time" id="widgetClockTime-${widget.id}">--:--</div>
                ${widget.config.showDate !== false ? `
                    <div class="clock-date" id="widgetClockDate-${widget.id}">Loading...</div>
                ` : ''}
            </div>
        `;
    }

    /**
     * School name widget content
     */
    function getSchoolNameContent(widget) {
        const schoolName = window.CONFIG?.SCHOOL_NAME || 'School Name';
        const fontSize = widget.config.fontSize || 'large';
        const alignment = widget.config.alignment || 'center';

        const fontSizeMap = {
            small: '1.5rem',
            medium: '2rem',
            large: '2.5rem',
            xlarge: '3.5rem'
        };

        return `
            <div class="widget-school-name-content" style="
                font-size: ${fontSizeMap[fontSize]};
                text-align: ${alignment};
                display: flex;
                align-items: center;
                justify-content: ${alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center'};
                height: 100%;
                padding: 1rem;
                font-weight: 700;
                color: white;
            ">
                ${escapeHtml(schoolName)}
            </div>
        `;
    }

    /**
     * Calendar widget content
     */
    function getCalendarContent(widget) {
        return `
            <div class="widget-calendar-content" data-days="${widget.config.daysAhead || 7}" data-max="${widget.config.maxEvents || 5}">
                <div class="calendar-header">Upcoming Events</div>
                <div class="calendar-events" id="widgetCalendarEvents-${widget.id}">
                    <div class="loading">Loading events...</div>
                </div>
            </div>
        `;
    }

    /**
     * Bell schedule widget content
     */
    function getBellScheduleContent(widget) {
        return `
            <div class="widget-bell-content" data-countdown="${widget.config.showCountdown !== false}" data-next="${widget.config.showNextPeriod !== false}">
                <div class="bell-current" id="widgetBellCurrent-${widget.id}">
                    <div class="period-name">Loading...</div>
                    <div class="period-time"></div>
                </div>
                ${widget.config.showCountdown !== false ? `
                    <div class="bell-countdown" id="widgetBellCountdown-${widget.id}"></div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Dismissal widget content
     */
    function getDismissalContent(widget) {
        return `
            <div class="widget-dismissal-content" data-max="${widget.config.maxVisible || 10}">
                <div class="dismissal-header">Student Dismissal</div>
                <div class="dismissal-queue" id="widgetDismissalQueue-${widget.id}">
                    <div class="queue-empty">No students in queue</div>
                </div>
            </div>
        `;
    }

    /**
     * Custom text widget content
     */
    function getCustomTextContent(widget) {
        const fontSize = widget.config.fontSize || 'medium';
        const color = widget.config.color || '#ffffff';
        const alignment = widget.config.alignment || 'center';

        const fontSizeMap = {
            small: '1rem',
            medium: '1.5rem',
            large: '2rem',
            xlarge: '3rem'
        };

        return `
            <div class="widget-custom-text-content" style="
                font-size: ${fontSizeMap[fontSize]};
                color: ${color};
                text-align: ${alignment};
                display: flex;
                align-items: center;
                justify-content: ${alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center'};
                height: 100%;
                padding: 1rem;
            ">
                ${escapeHtml(widget.config.text || '')}
            </div>
        `;
    }

    /**
     * Custom HTML widget content
     */
    function getCustomHtmlContent(widget) {
        // Note: This renders raw HTML - use with caution
        return `
            <div class="widget-custom-html-content" style="height: 100%; overflow: auto;">
                ${widget.config.html || ''}
            </div>
        `;
    }

    /**
     * Embed widget content
     */
    function getEmbedContent(widget) {
        if (!widget.config.url) {
            return '<div class="widget-placeholder">No URL configured</div>';
        }

        return `
            <iframe class="widget-embed-frame"
                    src="${escapeHtml(widget.config.url)}"
                    style="width: 100%; height: 100%; border: none;"
                    ${widget.config.allowFullscreen ? 'allowfullscreen' : ''}
                    loading="lazy">
            </iframe>
        `;
    }

    /**
     * Image widget content
     */
    function getImageContent(widget) {
        if (!widget.config.src) {
            return '<div class="widget-placeholder">No image configured</div>';
        }

        return `
            <img class="widget-image"
                 src="${escapeHtml(widget.config.src)}"
                 alt="${escapeHtml(widget.config.alt || '')}"
                 style="width: 100%; height: 100%; object-fit: ${widget.config.objectFit || 'cover'};">
        `;
    }

    /**
     * Initialize widget functionality after render
     */
    function initializeWidgets() {
        // Initialize clocks
        initializeClocks();

        // Initialize slideshows
        initializeSlideshows();

        // Initialize weather widgets
        initializeWeatherWidgets();

        // Initialize calendar widgets
        initializeCalendarWidgets();

        // Initialize bell schedule widgets
        initializeBellScheduleWidgets();

        // Initialize dismissal widgets
        initializeDismissalWidgets();
    }

    /**
     * Initialize all clock widgets
     */
    function initializeClocks() {
        document.querySelectorAll('.widget-clock-content').forEach(clockEl => {
            const widgetId = clockEl.closest('.dashboard-widget').id;
            const showDate = clockEl.dataset.showDate === 'true';
            const showSeconds = clockEl.dataset.showSeconds === 'true';
            const format24h = clockEl.dataset.format24h === 'true';

            function updateClock() {
                const now = new Date();
                const timeEl = document.getElementById(`widgetClockTime-${widgetId}`);
                const dateEl = document.getElementById(`widgetClockDate-${widgetId}`);

                if (timeEl) {
                    let hours = now.getHours();
                    const minutes = now.getMinutes().toString().padStart(2, '0');
                    const seconds = showSeconds ? ':' + now.getSeconds().toString().padStart(2, '0') : '';

                    if (!format24h) {
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12 || 12;
                        timeEl.textContent = `${hours}:${minutes}${seconds} ${ampm}`;
                    } else {
                        timeEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes}${seconds}`;
                    }
                }

                if (dateEl && showDate) {
                    dateEl.textContent = now.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                    });
                }
            }

            updateClock();
            setInterval(updateClock, 1000);
        });
    }

    /**
     * Initialize slideshow widgets
     */
    async function initializeSlideshows() {
        try {
            // Clear all existing slideshow intervals first
            Object.keys(slideshowIntervals).forEach(key => {
                clearInterval(slideshowIntervals[key]);
                delete slideshowIntervals[key];
            });
            console.log('[LayoutRenderer] Cleared existing slideshow intervals');

            const response = await fetch('/api/settings');
            const settings = await response.json();

            // Support both old format (customSlides) and new format (slideshows)
            const slideshows = settings.slideshows || {};
            const defaultSlides = settings.customSlides || [];

            // Ensure 'default' slideshow exists for backward compatibility
            if (!slideshows['default'] && defaultSlides.length > 0) {
                slideshows['default'] = {
                    name: 'Main Slideshow',
                    slides: defaultSlides
                };
            }

            document.querySelectorAll('.widget-slideshow').forEach(slideshowEl => {
                const widget = slideshowEl.closest('.dashboard-widget');
                const widgetId = widget.id;
                const container = document.getElementById(`widgetSlideshow-${widgetId}`);
                const interval = parseInt(slideshowEl.dataset.interval) || 8000;

                // Get the selected slideshow ID from data attribute or widget config
                const widgetData = currentLayout?.widgets?.find(w => w.id === widgetId);
                const selectedSlideshowId = slideshowEl.dataset.slideshowId || widgetData?.config?.slideshowId || 'default';

                // Get slides for this slideshow
                const slideshowData = slideshows[selectedSlideshowId];
                const slides = slideshowData?.slides || defaultSlides;

                if (!container || slides.length === 0) {
                    if (container) {
                        container.innerHTML = `
                            <div class="slide active">
                                <h2>No slides available</h2>
                                <p>Add slides in the admin panel</p>
                            </div>
                        `;
                    }
                    return;
                }

                // Render slides
                container.innerHTML = slides.map((slide, index) => `
                    <div class="slide ${index === 0 ? 'active' : ''}" data-index="${index}">
                        ${slide.content}
                    </div>
                `).join('');

                // Start slideshow and track the interval
                let currentSlideIndex = 0;
                const intervalId = setInterval(() => {
                    const allSlides = container.querySelectorAll('.slide');
                    if (allSlides.length > 1) {
                        allSlides[currentSlideIndex].classList.remove('active');
                        currentSlideIndex = (currentSlideIndex + 1) % allSlides.length;
                        allSlides[currentSlideIndex].classList.add('active');
                    }
                }, interval);

                // Store interval ID for cleanup
                slideshowIntervals[widgetId] = intervalId;
                console.log(`[LayoutRenderer] Started slideshow interval for ${widgetId}`);
            });
        } catch (error) {
            console.error('Failed to initialize slideshows:', error);
        }
    }

    /**
     * Initialize weather widgets
     */
    async function initializeWeatherWidgets() {
        try {
            // Get weather config from settings
            const response = await fetch('/api/settings');
            const settings = await response.json();
            const weatherConfig = settings.weatherConfig || {};
            const location = weatherConfig.location || weatherConfig.city || 'New York';

            // Fetch current weather
            const weatherResponse = await fetch(`/api/weather/current?location=${encodeURIComponent(location)}`);

            if (!weatherResponse.ok) {
                console.warn('Weather API not available');
                return;
            }

            const weatherData = await weatherResponse.json();

            // Update all weather widgets
            document.querySelectorAll('.widget-weather-content').forEach(weatherEl => {
                const widgetId = weatherEl.closest('.dashboard-widget').id;

                const tempEl = document.getElementById(`widgetWeatherTemp-${widgetId}`);
                const descEl = document.getElementById(`widgetWeatherDesc-${widgetId}`);
                const iconEl = document.getElementById(`widgetWeatherIcon-${widgetId}`);
                const feelsEl = document.getElementById(`widgetWeatherFeels-${widgetId}`);
                const humidityEl = document.getElementById(`widgetWeatherHumidity-${widgetId}`);
                const forecastEl = document.getElementById(`widgetWeatherForecast-${widgetId}`);

                if (weatherData.main) {
                    if (tempEl) tempEl.textContent = `${Math.round(weatherData.main.temp)}°F`;
                    if (feelsEl) feelsEl.textContent = `${Math.round(weatherData.main.feels_like)}°F`;
                    if (humidityEl) humidityEl.textContent = `${weatherData.main.humidity}%`;
                }
                if (weatherData.weather && weatherData.weather[0]) {
                    if (descEl) descEl.textContent = weatherData.weather[0].description;
                    if (iconEl) iconEl.src = `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`;
                }
            });

            // Fetch forecast if any widget needs it
            const forecastWidgets = document.querySelectorAll('.widget-weather-content[data-show-forecast="true"]');
            if (forecastWidgets.length > 0) {
                const forecastResponse = await fetch(`/api/weather/forecast?location=${encodeURIComponent(location)}`);
                if (forecastResponse.ok) {
                    const forecastData = await forecastResponse.json();
                    forecastWidgets.forEach(weatherEl => {
                        const widgetId = weatherEl.closest('.dashboard-widget').id;
                        const forecastEl = document.getElementById(`widgetWeatherForecast-${widgetId}`);
                        if (forecastEl && forecastData.list) {
                            // Get daily forecasts (every 8th item = 24 hours)
                            const dailyForecasts = forecastData.list.filter((_, i) => i % 8 === 0).slice(0, 5);
                            forecastEl.innerHTML = dailyForecasts.map(day => {
                                const date = new Date(day.dt * 1000);
                                const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                return `
                                    <div class="forecast-day">
                                        <span class="forecast-date">${dayName}</span>
                                        <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png" alt="" class="forecast-icon">
                                        <span class="forecast-temps">
                                            <span class="high">${Math.round(day.main.temp_max)}°</span>
                                            <span class="low">${Math.round(day.main.temp_min)}°</span>
                                        </span>
                                    </div>
                                `;
                            }).join('');
                        }
                    });
                }
            }

            // Refresh weather every 10 minutes
            setTimeout(initializeWeatherWidgets, 10 * 60 * 1000);
        } catch (error) {
            console.error('Failed to load weather:', error);
        }
    }

    /**
     * Initialize calendar widgets
     */
    async function initializeCalendarWidgets() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            const events = settings.calendarEvents || [];

            document.querySelectorAll('.widget-calendar-content').forEach(calendarEl => {
                const widgetId = calendarEl.closest('.dashboard-widget').id;
                const container = document.getElementById(`widgetCalendarEvents-${widgetId}`);
                const daysAhead = parseInt(calendarEl.dataset.days) || 7;
                const maxEvents = parseInt(calendarEl.dataset.max) || 5;

                if (!container) return;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDate = new Date(today);
                endDate.setDate(endDate.getDate() + daysAhead);

                const upcomingEvents = events
                    .filter(e => {
                        const eventDate = new Date(e.date + 'T00:00:00');
                        return eventDate >= today && eventDate <= endDate;
                    })
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .slice(0, maxEvents);

                if (upcomingEvents.length === 0) {
                    container.innerHTML = '<div class="no-events">No upcoming events</div>';
                    return;
                }

                container.innerHTML = upcomingEvents.map(event => {
                    const eventDate = new Date(event.date + 'T00:00:00');
                    const dateStr = eventDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    });
                    return `
                        <div class="calendar-event">
                            <div class="event-date">${dateStr}</div>
                            <div class="event-name">${escapeHtml(event.event)}</div>
                        </div>
                    `;
                }).join('');
            });
        } catch (error) {
            console.error('Failed to load calendar events:', error);
        }
    }

    /**
     * Initialize bell schedule widgets
     */
    function initializeBellScheduleWidgets() {
        // Use existing bell schedule functionality if available
        if (window.BellSchedule) {
            document.querySelectorAll('.widget-bell-content').forEach(bellEl => {
                const widgetId = bellEl.closest('.dashboard-widget').id;
                // Bell schedule module will update these
            });
        }
    }

    /**
     * Initialize dismissal widgets
     * Uses the main SSE stream from theme-loader.js for updates
     */
    function initializeDismissalWidgets() {
        document.querySelectorAll('.widget-dismissal-content').forEach(dismissalEl => {
            const widgetId = dismissalEl.closest('.dashboard-widget').id;
            const container = document.getElementById(`widgetDismissalQueue-${widgetId}`);
            const maxVisible = parseInt(dismissalEl.dataset.max) || 10;

            if (!container) return;

            // Store container reference for updates from main SSE stream
            dismissalEl.dataset.initialized = 'true';
        });
    }

    /**
     * Update dismissal widgets from SSE event
     * Called by theme-loader.js when dismissal updates are received
     */
    function handleDismissalUpdate(students) {
        document.querySelectorAll('.widget-dismissal-content[data-initialized="true"]').forEach(dismissalEl => {
            const widgetId = dismissalEl.closest('.dashboard-widget').id;
            const container = document.getElementById(`widgetDismissalQueue-${widgetId}`);
            const maxVisible = parseInt(dismissalEl.dataset.max) || 10;

            if (container) {
                updateDismissalQueue(container, students || [], maxVisible);
            }
        });
    }

    /**
     * Update dismissal queue display
     */
    function updateDismissalQueue(container, queue, maxVisible) {
        if (queue.length === 0) {
            container.innerHTML = '<div class="queue-empty">No students in queue</div>';
            return;
        }

        const visibleQueue = queue.slice(0, maxVisible);
        container.innerHTML = visibleQueue.map((student, index) => `
            <div class="queue-item ${index < 3 ? 'queue-item-highlight' : ''}">
                <span class="student-number">${index + 1}</span>
                <span class="student-name">${escapeHtml(student.name)}</span>
                <span class="student-grade">${escapeHtml(student.grade)}</span>
            </div>
        `).join('');

        if (queue.length > maxVisible) {
            container.innerHTML += `<div class="queue-more">+${queue.length - maxVisible} more</div>`;
        }
    }

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Handle layout updates from the main SSE stream (theme-loader.js)
     * This avoids opening duplicate SSE connections
     */
    function handleSettingsUpdate(settings) {
        let needsFullRefresh = false;

        // Check if layout changed
        if (settings.gridLayout && settings.gridLayout.widgets) {
            const newLayout = settings.gridLayout;
            if (JSON.stringify(newLayout) !== JSON.stringify(currentLayout)) {
                console.log('[LayoutRenderer] Layout changed, refreshing dashboard...');
                currentLayout = newLayout;
                needsFullRefresh = true;
            }
        }

        // Check if slides/slideshows changed - reinitialize slideshows
        if (settings.customSlides || settings.slideshows) {
            console.log('[LayoutRenderer] Slides updated, reinitializing slideshows...');
            if (!needsFullRefresh && layoutEnabled) {
                // Just reinitialize slideshows without full dashboard refresh
                initializeSlideshows();
                return;
            }
        }

        // Full refresh if layout changed
        if (needsFullRefresh) {
            const existingDashboard = document.getElementById('dashboardGrid');
            if (existingDashboard) {
                existingDashboard.remove();
            }

            if (currentLayout && currentLayout.widgets && currentLayout.widgets.length > 0) {
                layoutEnabled = true;
                renderDashboard();
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API
    window.LayoutRenderer = {
        init,
        isEnabled: () => layoutEnabled,
        getLayout: () => currentLayout,
        refresh: init,
        handleSettingsUpdate,  // Called by theme-loader.js when settings change
        handleDismissalUpdate  // Called by theme-loader.js when dismissal updates are received
    };

})();
