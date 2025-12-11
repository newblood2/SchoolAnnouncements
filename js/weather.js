/**
 * @fileoverview Weather Module - OpenWeatherMap API integration
 * @module weather
 * @description Manages weather data fetching, display updates, and error handling for current
 * conditions and 5-day forecast. Includes automatic retry logic for network failures.
 *
 * @example
 * // Module initializes automatically if API key is configured
 * // Updates weather every 10 minutes automatically
 *
 * @requires module:constants - For API URLs, update intervals, and element IDs
 * @requires module:error-handler - For error handling and user notifications
 */

(function() {
    'use strict';

    // Import constants
    const CONSTANTS = window.APP_CONSTANTS;

    /**
     * @typedef {Object} WeatherData
     * @property {number} cod - HTTP status code from API
     * @property {string} message - Error message if cod !== 200
     * @property {Object} main - Main weather data
     * @property {number} main.temp - Current temperature
     * @property {number} main.feels_like - Feels like temperature
     * @property {number} main.humidity - Humidity percentage
     * @property {number} main.temp_max - Maximum temperature
     * @property {number} main.temp_min - Minimum temperature
     * @property {Array<Object>} weather - Weather condition array
     * @property {string} weather[].description - Weather description
     * @property {string} weather[].icon - Weather icon code
     */

    /**
     * @typedef {Object} ForecastData
     * @property {string} cod - HTTP status code from API
     * @property {Array<Object>} list - Forecast items
     * @property {number} list[].dt - Timestamp
     * @property {Object} list[].main - Main weather data
     * @property {Array<Object>} list[].weather - Weather conditions
     */

    /**
     * Fetches weather data from OpenWeatherMap API with error handling and retry logic
     * @async
     * @function fetchWeather
     * @private
     * @returns {Promise<void>}
     * @throws {Error} Network errors are caught and handled by ErrorHandler
     * @description Validates configuration, builds location parameters, and fetches both
     * current weather and 5-day forecast. Includes automatic retry on network failures.
     */
    async function fetchWeather() {
        if (!validateConfig()) {
            return;
        }

        const { LOCATION, CITY_ID } = window.CONFIG;

        // Check cache first (5-minute TTL for weather data)
        const cacheKey = `weather_${CITY_ID || LOCATION}`;
        const cachedData = window.Cache?.get(cacheKey);

        if (cachedData) {
            console.log('Using cached weather data');
            if (cachedData.current) {
                displayCurrentWeather(cachedData.current);
            }
            if (cachedData.forecast) {
                displayWeatherForecast(cachedData.forecast);
            }
            return;
        }

        try {
            const weatherData = {};

            const currentWeather = await window.ErrorHandler?.handleNetworkError(
                () => fetchCurrentWeather(LOCATION, CITY_ID),
                {
                    maxRetries: 2,
                    module: 'Weather',
                    userMessage: 'Failed to fetch current weather'
                }
            ) || await fetchCurrentWeather(LOCATION, CITY_ID);

            if (currentWeather) {
                weatherData.current = currentWeather;
            }

            const forecast = await window.ErrorHandler?.handleNetworkError(
                () => fetchWeatherForecast(LOCATION, CITY_ID),
                {
                    maxRetries: 2,
                    module: 'Weather',
                    userMessage: 'Failed to fetch weather forecast'
                }
            ) || await fetchWeatherForecast(LOCATION, CITY_ID);

            if (forecast) {
                weatherData.forecast = forecast;
            }

            // Cache the weather data (5 minutes TTL)
            if (Object.keys(weatherData).length > 0) {
                window.Cache?.set(cacheKey, weatherData, 300000); // 5 minutes
                console.log('Weather data cached for 5 minutes');
            }
        } catch (error) {
            // Error already handled by ErrorHandler
            const currentDescElement = document.getElementById(CONSTANTS.ELEMENT_IDS.CURRENT_DESC);
            if (currentDescElement && !currentDescElement.textContent.startsWith('Error:')) {
                displayError(CONSTANTS.ELEMENT_IDS.CURRENT_DESC, CONSTANTS.ERROR_MESSAGES.WEATHER_LOAD_ERROR);
            }
        }
    }

    /**
     * Validates weather configuration and displays user-friendly error messages
     * @function validateConfig
     * @private
     * @returns {boolean} True if configuration is valid and ready to use
     * @description Checks for presence of location configuration.
     * API key is now handled server-side for security.
     */
    function validateConfig() {
        if (!window.CONFIG) {
            displayError(CONSTANTS.ELEMENT_IDS.CURRENT_DESC, 'Config not loaded');
            return false;
        }

        // Location is required (API key is now on server)
        if (!window.CONFIG.LOCATION && !window.CONFIG.CITY_ID) {
            displayError(CONSTANTS.ELEMENT_IDS.CURRENT_DESC, CONSTANTS.ERROR_MESSAGES.LOCATION_NOT_SET);
            window.ErrorHandler?.handle('Weather location not configured', {
                level: window.ErrorLevel?.WARNING,
                module: 'Weather',
                showNotification: true,
                userMessage: 'Weather location not set. Please configure LOCATION or CITY_ID in config.js'
            });
            return false;
        }

        return true;
    }

    /**
     * Builds location parameter for API requests
     * @param {string} location - City name location string
     * @param {number|null} cityId - OpenWeatherMap city ID
     * @returns {string|null} Location parameter string or null
     */
    function buildLocationParam(location, cityId) {
        if (cityId) {
            console.log('Using city ID:', cityId);
            return `id=${cityId}`;
        } else if (location) {
            console.log('Using city name:', location);
            return `q=${location}`;
        }
        return null;
    }

    /**
     * Fetches current weather conditions via server proxy
     * @param {string} location - Location string
     * @param {string|null} cityId - City ID (optional)
     * @returns {Promise<Object>} Weather data
     */
    async function fetchCurrentWeather(location, cityId) {
        const params = new URLSearchParams();
        if (cityId) {
            params.set('cityId', cityId);
        } else if (location) {
            params.set('location', location);
        }

        const url = `/api/weather/current?${params.toString()}`;
        console.log('Fetching weather from proxy:', url);

        const response = await fetch(url);
        const data = await response.json();

        if (response.ok && data.cod === 200) {
            displayCurrentWeather(data);
            return data;
        } else {
            const errorMsg = data.error || data.message || 'Failed to fetch current weather';
            displayError(CONSTANTS.ELEMENT_IDS.CURRENT_DESC, `Error: ${errorMsg}`);

            const error = new Error(errorMsg);
            error.code = data.cod;
            throw error;
        }
    }

    /**
     * Fetches weather forecast via server proxy
     * @param {string} location - Location string
     * @param {string|null} cityId - City ID (optional)
     * @returns {Promise<Object>} Forecast data
     */
    async function fetchWeatherForecast(location, cityId) {
        const params = new URLSearchParams();
        if (cityId) {
            params.set('cityId', cityId);
        } else if (location) {
            params.set('location', location);
        }

        const url = `/api/weather/forecast?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok && data.cod === "200") {
            displayWeatherForecast(data);
            return data;
        } else {
            throw new Error(data.error || data.message || 'Failed to fetch forecast');
        }
    }

    /**
     * Displays current weather data (from cache or fresh API call)
     * @param {Object} data - Weather data
     */
    function displayCurrentWeather(data) {
        updateCurrentWeather(data);
    }

    /**
     * Displays forecast data (from cache or fresh API call)
     * @param {Object} data - Forecast data
     */
    function displayWeatherForecast(data) {
        updateWeekForecast(data);
    }

    /**
     * Updates the current weather display
     * @param {Object} data - Weather data from API
     */
    function updateCurrentWeather(data) {
        const temp = Math.round(data.main.temp);
        const feelsLike = Math.round(data.main.feels_like);
        const humidity = data.main.humidity;
        const description = data.weather[0].description;
        const icon = data.weather[0].icon;

        setElementText(CONSTANTS.ELEMENT_IDS.CURRENT_TEMP, `${temp}°F`);
        setElementText(CONSTANTS.ELEMENT_IDS.CURRENT_DESC, description);
        setElementText(CONSTANTS.ELEMENT_IDS.FEELS_LIKE, `${feelsLike}°F`);
        setElementText(CONSTANTS.ELEMENT_IDS.HUMIDITY, `${humidity}%`);

        const iconElement = document.getElementById(CONSTANTS.ELEMENT_IDS.CURRENT_ICON);
        if (iconElement) {
            iconElement.src = `${CONSTANTS.WEATHER_ICON_BASE_URL}/${icon}@2x.png`;
            iconElement.alt = description;
        }
    }

    /**
     * Updates the week forecast display
     * @param {Object} data - Forecast data from API
     */
    function updateWeekForecast(data) {
        const forecastContainer = document.getElementById(CONSTANTS.ELEMENT_IDS.WEEK_FORECAST);
        if (!forecastContainer) return;

        forecastContainer.innerHTML = '';

        const dailyForecasts = aggregateDailyForecasts(data.list);
        const days = Object.entries(dailyForecasts).slice(0, CONSTANTS.WEATHER_MAX_FORECAST_DAYS);

        days.forEach(([day, forecast]) => {
            const forecastElement = createForecastElement(day, forecast);
            forecastContainer.appendChild(forecastElement);
        });
    }

    /**
     * Aggregates hourly forecast data into daily forecasts
     * @param {Array} forecastList - List of forecast items from API
     * @returns {Object} Daily forecasts keyed by date string
     */
    function aggregateDailyForecasts(forecastList) {
        const dailyForecasts = {};

        forecastList.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dateKey = date.toLocaleDateString(
                CONSTANTS.LOCALE,
                CONSTANTS.FORECAST_DATE_FORMAT_OPTIONS
            );

            // Use the 12:00 PM forecast for each day, or first available
            if (!dailyForecasts[dateKey]) {
                dailyForecasts[dateKey] = {
                    temp_max: item.main.temp_max,
                    temp_min: item.main.temp_min,
                    icon: item.weather[0].icon,
                    description: item.weather[0].description
                };
            } else {
                // Update min/max temps
                dailyForecasts[dateKey].temp_max = Math.max(
                    dailyForecasts[dateKey].temp_max,
                    item.main.temp_max
                );
                dailyForecasts[dateKey].temp_min = Math.min(
                    dailyForecasts[dateKey].temp_min,
                    item.main.temp_min
                );
            }
        });

        return dailyForecasts;
    }

    /**
     * Creates a forecast day DOM element
     * @param {string} day - Day label
     * @param {Object} forecast - Forecast data
     * @returns {HTMLElement} Forecast element
     */
    function createForecastElement(day, forecast) {
        const forecastDay = document.createElement('div');
        forecastDay.className = CONSTANTS.CSS_CLASSES.FORECAST_DAY;

        forecastDay.innerHTML = `
            <div class="${CONSTANTS.CSS_CLASSES.FORECAST_DAY_NAME}">${day}</div>
            <div class="${CONSTANTS.CSS_CLASSES.FORECAST_ICON}">
                <img src="${CONSTANTS.WEATHER_ICON_BASE_URL}/${forecast.icon}.png"
                     alt="${forecast.description}">
            </div>
            <div class="${CONSTANTS.CSS_CLASSES.FORECAST_TEMPS}">
                <span class="${CONSTANTS.CSS_CLASSES.FORECAST_HIGH}">${Math.round(forecast.temp_max)}°</span>
                <span class="${CONSTANTS.CSS_CLASSES.FORECAST_LOW}">${Math.round(forecast.temp_min)}°</span>
            </div>
        `;

        return forecastDay;
    }

    /**
     * Sets text content of an element by ID
     * @param {string} elementId - Element ID
     * @param {string} text - Text to set
     */
    function setElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    /**
     * Displays an error message in a specific element
     * @param {string} elementId - Element ID
     * @param {string} message - Error message
     */
    function displayError(elementId, message) {
        setElementText(elementId, message);
    }

    /**
     * Initializes weather module
     */
    function init() {
        if (window.CONFIG && (window.CONFIG.LOCATION || window.CONFIG.CITY_ID)) {
            fetchWeather();
            setInterval(fetchWeather, CONSTANTS.WEATHER_UPDATE_INTERVAL_MS);
            console.log('Weather module initialized (using server-side API proxy)');
        } else {
            console.warn('Weather module not initialized - no location configured');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
