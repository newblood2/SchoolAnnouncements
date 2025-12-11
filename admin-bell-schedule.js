/**
 * Admin Bell Schedule Module
 * Handles bell schedule configuration in the admin panel
 */

(function() {
    'use strict';

    // State
    let bellSchedule = {
        enabled: false,
        currentSchedule: 'regular',
        schedules: {
            regular: [],
            early_release: [],
            delay: []
        }
    };

    // Elements
    const enabledCheckbox = document.getElementById('bellScheduleEnabled');
    const currentScheduleSelect = document.getElementById('currentScheduleType');
    const editScheduleTypeSelect = document.getElementById('editScheduleType');
    const periodsContainer = document.getElementById('periodsContainer');
    const addPeriodBtn = document.getElementById('addPeriodBtn');
    const saveBellScheduleBtn = document.getElementById('saveBellScheduleBtn');

    /**
     * Initialize the module
     */
    async function init() {
        await loadBellSchedule();
        setupEventListeners();
        renderPeriods();
    }

    /**
     * Load bell schedule from API
     */
    async function loadBellSchedule() {
        try {
            const settings = await window.SettingsAPI.getAll();
            if (settings.bellSchedule) {
                bellSchedule = {
                    enabled: settings.bellSchedule.enabled || false,
                    currentSchedule: settings.bellSchedule.currentSchedule || 'regular',
                    schedules: settings.bellSchedule.schedules || {
                        regular: [],
                        early_release: [],
                        delay: []
                    }
                };
            }

            // Update UI
            if (enabledCheckbox) enabledCheckbox.checked = bellSchedule.enabled;
            if (currentScheduleSelect) currentScheduleSelect.value = bellSchedule.currentSchedule;
            if (editScheduleTypeSelect) editScheduleTypeSelect.value = bellSchedule.currentSchedule;
        } catch (error) {
            console.error('Failed to load bell schedule:', error);
        }
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        if (editScheduleTypeSelect) {
            editScheduleTypeSelect.addEventListener('change', () => {
                renderPeriods();
            });
        }

        if (addPeriodBtn) {
            addPeriodBtn.addEventListener('click', addPeriod);
        }

        if (saveBellScheduleBtn) {
            saveBellScheduleBtn.addEventListener('click', saveBellSchedule);
        }
    }

    /**
     * Render periods for the selected schedule type
     */
    function renderPeriods() {
        if (!periodsContainer || !editScheduleTypeSelect) return;

        const scheduleType = editScheduleTypeSelect.value;
        const periods = bellSchedule.schedules[scheduleType] || [];

        if (periods.length === 0) {
            periodsContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6b7280;">
                    No periods configured. Click "+ Add Period" to add one.
                </div>
            `;
            return;
        }

        periodsContainer.innerHTML = periods.map((period, index) => `
            <div class="period-row" data-index="${index}" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.75rem; padding: 0.75rem; background: #f9fafb; border-radius: 8px;">
                <input type="text" class="form-input period-name" value="${escapeHtml(period.name)}" placeholder="Period Name" style="flex: 2;">
                <input type="time" class="form-input period-start" value="${period.start}" style="flex: 1;">
                <span style="color: #6b7280;">to</span>
                <input type="time" class="form-input period-end" value="${period.end}" style="flex: 1;">
                <button class="btn btn-danger btn-sm period-delete" data-index="${index}">Delete</button>
            </div>
        `).join('');

        // Add delete event listeners
        periodsContainer.querySelectorAll('.period-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                deletePeriod(index);
            });
        });

        // Add change event listeners to update state
        periodsContainer.querySelectorAll('.period-row').forEach((row, index) => {
            const nameInput = row.querySelector('.period-name');
            const startInput = row.querySelector('.period-start');
            const endInput = row.querySelector('.period-end');

            [nameInput, startInput, endInput].forEach(input => {
                input.addEventListener('change', () => {
                    updatePeriod(index, {
                        name: nameInput.value,
                        start: startInput.value,
                        end: endInput.value
                    });
                });
            });
        });
    }

    /**
     * Add a new period
     */
    function addPeriod() {
        const scheduleType = editScheduleTypeSelect?.value || 'regular';

        if (!bellSchedule.schedules[scheduleType]) {
            bellSchedule.schedules[scheduleType] = [];
        }

        bellSchedule.schedules[scheduleType].push({
            name: `Period ${bellSchedule.schedules[scheduleType].length + 1}`,
            start: '08:00',
            end: '08:45'
        });

        renderPeriods();
    }

    /**
     * Update a period
     */
    function updatePeriod(index, data) {
        const scheduleType = editScheduleTypeSelect?.value || 'regular';

        if (bellSchedule.schedules[scheduleType] && bellSchedule.schedules[scheduleType][index]) {
            bellSchedule.schedules[scheduleType][index] = data;
        }
    }

    /**
     * Delete a period
     */
    function deletePeriod(index) {
        const scheduleType = editScheduleTypeSelect?.value || 'regular';

        if (bellSchedule.schedules[scheduleType]) {
            bellSchedule.schedules[scheduleType].splice(index, 1);
            renderPeriods();
        }
    }

    /**
     * Save bell schedule to API
     */
    async function saveBellSchedule() {
        bellSchedule.enabled = enabledCheckbox?.checked || false;
        bellSchedule.currentSchedule = currentScheduleSelect?.value || 'regular';

        try {
            await window.SettingsAPI.save('bellSchedule', bellSchedule);
            showToast('Bell schedule saved!', 'success');
        } catch (error) {
            console.error('Failed to save bell schedule:', error);
            showToast('Failed to save bell schedule', 'error');
        }
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
    window.BellScheduleAdmin = {
        load: loadBellSchedule,
        save: saveBellSchedule
    };

})();
