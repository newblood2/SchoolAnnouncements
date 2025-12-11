/**
 * Admin Calendar Events Module
 * Handles calendar event management in the admin panel
 */

(function() {
    'use strict';

    // State
    let calendarEvents = [];

    // Elements
    const calendarFile = document.getElementById('calendarFile');
    const uploadCalendarBtn = document.getElementById('uploadCalendarBtn');
    const downloadCalendarTemplateBtn = document.getElementById('downloadCalendarTemplateBtn');
    const eventsList = document.getElementById('eventsList');
    const eventCount = document.getElementById('eventCount');
    const addEventBtn = document.getElementById('addEventBtn');
    const clearEventsBtn = document.getElementById('clearEventsBtn');

    /**
     * Initialize the module
     */
    async function init() {
        await loadEvents();
        setupEventListeners();
        renderEvents();
    }

    /**
     * Load events from API
     */
    async function loadEvents() {
        try {
            const settings = await window.SettingsAPI.getAll();
            calendarEvents = settings.calendarEvents || [];
        } catch (error) {
            console.error('Failed to load calendar events:', error);
        }
    }

    /**
     * Save events to API
     */
    async function saveEvents() {
        try {
            await window.SettingsAPI.save('calendarEvents', calendarEvents);
        } catch (error) {
            console.error('Failed to save calendar events:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        if (uploadCalendarBtn) {
            uploadCalendarBtn.addEventListener('click', handleUpload);
        }

        if (downloadCalendarTemplateBtn) {
            downloadCalendarTemplateBtn.addEventListener('click', downloadTemplate);
        }

        if (addEventBtn) {
            addEventBtn.addEventListener('click', showAddEventModal);
        }

        if (clearEventsBtn) {
            clearEventsBtn.addEventListener('click', clearEvents);
        }
    }

    /**
     * Handle CSV upload
     */
    async function handleUpload() {
        if (!calendarFile || !calendarFile.files[0]) {
            showToast('Please select a CSV file first', 'error');
            return;
        }

        const file = calendarFile.files[0];

        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());

            // Skip header if it looks like a header
            let startIndex = 0;
            if (lines[0] && lines[0].toLowerCase().includes('date')) {
                startIndex = 1;
            }

            const newEvents = [];

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Parse CSV (handle quoted fields)
                const fields = parseCSVLine(line);
                if (fields.length >= 2) {
                    const [date, event, time, description] = fields;
                    newEvents.push({
                        id: Date.now() + i,
                        date: date.trim(),
                        event: event.trim(),
                        time: (time || '').trim(),
                        description: (description || '').trim()
                    });
                }
            }

            if (newEvents.length === 0) {
                showToast('No valid events found in the CSV file', 'error');
                return;
            }

            // Add new events to existing events
            calendarEvents = [...calendarEvents, ...newEvents];

            // Sort by date
            calendarEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

            await saveEvents();
            renderEvents();

            calendarFile.value = '';
            showToast(`Imported ${newEvents.length} events successfully!`, 'success');
        } catch (error) {
            console.error('Error parsing CSV:', error);
            showToast('Error parsing CSV file. Check the format.', 'error');
        }
    }

    /**
     * Parse a CSV line, handling quoted fields
     */
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }

    /**
     * Download CSV template
     */
    function downloadTemplate() {
        const template = `Date,Event,Time,Description
2024-12-20,Winter Break Begins,,School Closed
2025-01-06,School Resumes,8:00 AM,Welcome Back!
2025-01-15,Parent-Teacher Conference,3:00 PM,Elementary Building
2025-02-14,Valentine's Day Party,2:00 PM,All grades`;

        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'calendar-events-template.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    }

    /**
     * Render events list
     */
    function renderEvents() {
        if (!eventsList) return;

        // Update count
        if (eventCount) eventCount.textContent = calendarEvents.length;

        if (calendarEvents.length === 0) {
            eventsList.innerHTML = `
                <p style="text-align: center; color: #6b7280; padding: 2rem;">No events imported yet</p>
            `;
            return;
        }

        // Group events by upcoming and past
        const today = new Date().toISOString().split('T')[0];
        const upcoming = calendarEvents.filter(e => e.date >= today);
        const past = calendarEvents.filter(e => e.date < today);

        let html = '';

        if (upcoming.length > 0) {
            html += '<h4 style="margin-bottom: 0.75rem;">Upcoming Events</h4>';
            html += upcoming.slice(0, 20).map(event => renderEventItem(event)).join('');
        }

        if (past.length > 0) {
            html += '<h4 style="margin: 1.5rem 0 0.75rem;">Past Events</h4>';
            html += past.slice(0, 10).map(event => renderEventItem(event, true)).join('');
        }

        eventsList.innerHTML = html;

        // Add delete event listeners
        eventsList.querySelectorAll('.event-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.dataset.id);
                await deleteEvent(id);
            });
        });
    }

    /**
     * Render a single event item
     */
    function renderEventItem(event, isPast = false) {
        const date = new Date(event.date + 'T00:00:00');
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        return `
            <div class="event-item" style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: ${isPast ? '#f9fafb' : '#f0fdf4'}; border-radius: 8px; margin-bottom: 0.5rem; ${isPast ? 'opacity: 0.6;' : ''}">
                <div style="min-width: 80px; font-weight: 600; color: #374151;">${dateStr}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${escapeHtml(event.event)}</div>
                    ${event.time || event.description ? `
                        <div style="font-size: 0.875rem; color: #6b7280;">
                            ${event.time ? event.time : ''} ${event.time && event.description ? '•' : ''} ${event.description || ''}
                        </div>
                    ` : ''}
                </div>
                <button class="btn btn-danger btn-sm event-delete" data-id="${event.id}">Delete</button>
            </div>
        `;
    }

    /**
     * Delete an event
     */
    async function deleteEvent(id) {
        calendarEvents = calendarEvents.filter(e => e.id !== id);
        await saveEvents();
        renderEvents();
        showToast('Event deleted', 'success');
    }

    /**
     * Clear all events
     */
    async function clearEvents() {
        if (!confirm('Are you sure you want to delete all calendar events?')) {
            return;
        }

        calendarEvents = [];
        await saveEvents();
        renderEvents();
        showToast('All events cleared', 'success');
    }

    /**
     * Show add event modal
     */
    function showAddEventModal() {
        const date = prompt('Event Date (YYYY-MM-DD):');
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            showToast('Invalid date format. Use YYYY-MM-DD.', 'error');
            return;
        }

        const event = prompt('Event Name:');
        if (!event) return;

        const time = prompt('Time (optional):') || '';
        const description = prompt('Description (optional):') || '';

        calendarEvents.push({
            id: Date.now(),
            date,
            event,
            time,
            description
        });

        calendarEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveEvents();
        renderEvents();
        showToast('Event added successfully!', 'success');
    }

    /**
     * Escape HTML entities
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
    window.CalendarAdmin = {
        load: loadEvents,
        getEvents: () => calendarEvents
    };

})();
