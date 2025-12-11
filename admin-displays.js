/**
 * Display Manager Module for Admin Panel
 * Handles display tracking, heartbeat monitoring, and remote commands
 */

(function() {
    'use strict';

    // State
    let displays = [];
    let updateInterval = null;
    let editingDisplayId = null;

    /**
     * Initialize the Display Manager
     */
    function init() {
        // Load displays on init
        loadDisplays();

        // Set up auto-refresh every 10 seconds
        updateInterval = setInterval(loadDisplays, 10000);

        // Set up event listeners
        setupEventListeners();

        // Create edit modal
        createEditModal();
    }

    /**
     * Set up event listeners for buttons
     */
    function setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshDisplaysBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = 'Refreshing...';
                loadDisplays().then(() => {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = 'Refresh Status';
                });
            });
        }

        // Broadcast refresh button
        const broadcastRefreshBtn = document.getElementById('broadcastRefreshBtn');
        if (broadcastRefreshBtn) {
            broadcastRefreshBtn.addEventListener('click', () => {
                broadcastCommand('refresh');
            });
        }

        // Delete all inactive button
        const deleteInactiveBtn = document.getElementById('deleteInactiveBtn');
        if (deleteInactiveBtn) {
            deleteInactiveBtn.addEventListener('click', deleteAllInactive);
        }

        // Broadcast commands
        const cmdRefreshAll = document.getElementById('cmdRefreshAll');
        if (cmdRefreshAll) {
            cmdRefreshAll.addEventListener('click', () => broadcastCommand('refresh'));
        }

        const cmdReloadAll = document.getElementById('cmdReloadAll');
        if (cmdReloadAll) {
            cmdReloadAll.addEventListener('click', () => broadcastCommand('reload'));
        }

        const cmdClearCache = document.getElementById('cmdClearCache');
        if (cmdClearCache) {
            cmdClearCache.addEventListener('click', () => broadcastCommand('clearCache'));
        }

        const cmdTestAlert = document.getElementById('cmdTestAlert');
        if (cmdTestAlert) {
            cmdTestAlert.addEventListener('click', () => broadcastCommand('testAlert', {
                message: 'Test alert from Admin Panel',
                duration: 5000
            }));
        }
    }

    /**
     * Load displays from API
     */
    async function loadDisplays() {
        try {
            const response = await fetch('/api/displays');
            const data = await response.json();

            displays = data.displays || [];

            // Update stats
            updateStats(data.total, data.online, data.offline);

            // Render display list
            renderDisplayList();

            return data;
        } catch (error) {
            console.error('Failed to load displays:', error);
            showToast('Failed to load displays', 'error');
        }
    }

    /**
     * Update statistics display
     */
    function updateStats(total, online, offline) {
        const totalEl = document.getElementById('totalDisplays');
        const onlineEl = document.getElementById('onlineDisplays');
        const offlineEl = document.getElementById('offlineDisplays');

        if (totalEl) totalEl.textContent = total || 0;
        if (onlineEl) onlineEl.textContent = online || 0;
        if (offlineEl) offlineEl.textContent = offline || 0;
    }

    /**
     * Render the display list
     */
    function renderDisplayList() {
        const container = document.getElementById('displaysList');
        if (!container) return;

        if (displays.length === 0) {
            container.innerHTML = `
                <div class="no-displays">
                    <p>No displays have connected yet.</p>
                    <p style="font-size: 0.875rem;">Open the main display page on your TV/monitors to register them.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = displays.map(display => `
            <div class="display-card ${display.status}" data-id="${escapeHtml(display.id)}">
                <div class="display-status-dot ${display.status}"></div>
                <div class="display-info">
                    <div class="display-name">${escapeHtml(display.name)}</div>
                    <div class="display-location">${escapeHtml(display.location)} &bull; ${display.currentPage || 'Unknown page'}</div>
                    <div class="display-id" style="font-size: 0.75rem; color: #6b7280; font-family: monospace;">
                        IP: ${escapeHtml(display.ipAddress || 'Unknown')} &bull; ID: ${escapeHtml(display.id)}
                    </div>
                    ${display.tags && display.tags.length > 0 ? `
                        <div class="display-tags" style="margin-top: 0.5rem;">
                            ${display.tags.map(tag => `<span class="tag-badge" style="display: inline-block; background: #e0e7ff; color: #3730a3; padding: 0.125rem 0.5rem; border-radius: 12px; font-size: 0.75rem; margin-right: 0.25rem;">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="display-meta">
                    <div class="display-meta-item">
                        <span>${display.status === 'online' ? '🟢' : '🔴'}</span>
                        <span>${display.status === 'online' ? 'Online' : formatOfflineTime(display.offlineSince)}</span>
                    </div>
                    <div class="display-meta-item">
                        <span>📺</span>
                        <span>${display.screenResolution || 'Unknown'}</span>
                    </div>
                    <div class="display-meta-item">
                        <span>⏱️</span>
                        <span>${formatLastHeartbeat(display.lastHeartbeatAgo)}</span>
                    </div>
                </div>
                <div class="display-actions">
                    <button class="btn btn-primary btn-edit" data-action="edit" data-display-id="${escapeHtml(display.id)}">Edit</button>
                    ${display.status === 'online' ? `
                        <button class="btn btn-secondary btn-command" data-action="refresh" data-display-id="${escapeHtml(display.id)}">Refresh</button>
                    ` : ''}
                    <button class="btn btn-danger btn-delete" data-action="delete" data-display-id="${escapeHtml(display.id)}">Delete</button>
                </div>
            </div>
        `).join('');

        // Add event listeners for display actions (safer than inline onclick)
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const displayId = btn.dataset.displayId;
                if (action === 'edit') {
                    window.DisplayManager.editDisplay(displayId);
                } else if (action === 'refresh') {
                    window.DisplayManager.sendCommand(displayId, 'refresh');
                } else if (action === 'delete') {
                    window.DisplayManager.deleteDisplay(displayId);
                }
            });
        });
    }

    /**
     * Format last heartbeat time
     */
    function formatLastHeartbeat(seconds) {
        if (!seconds && seconds !== 0) return 'Unknown';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    }

    /**
     * Format offline time
     */
    function formatOfflineTime(timestamp) {
        if (!timestamp) return 'Offline';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `Offline ${seconds}s`;
        if (seconds < 3600) return `Offline ${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `Offline ${Math.floor(seconds / 3600)}h`;
        return `Offline ${Math.floor(seconds / 86400)}d`;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Create edit modal
     */
    function createEditModal() {
        const modal = document.createElement('div');
        modal.id = 'displayEditModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Display</h3>
                    <button class="modal-close" onclick="window.DisplayManager.closeEditModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="editDisplayName">Display Name</label>
                        <input type="text" id="editDisplayName" class="form-input" placeholder="e.g., Room 101 TV">
                    </div>
                    <div class="form-group">
                        <label for="editDisplayLocation">Location</label>
                        <input type="text" id="editDisplayLocation" class="form-input" placeholder="e.g., Main Office">
                    </div>
                    <div class="form-group">
                        <label>Display ID</label>
                        <input type="text" id="editDisplayId" class="form-input" readonly style="background: #f3f4f6;">
                    </div>
                    <div class="form-group">
                        <label for="editDisplayTags">Tags</label>
                        <input type="text" id="editDisplayTags" class="form-input" placeholder="e.g., gym, office, sports (comma separated)">
                        <small style="color: #6b7280;">Assign tags to show specific content on this display</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="window.DisplayManager.closeEditModal()">Cancel</button>
                    <button class="btn btn-success" onclick="window.DisplayManager.saveDisplay()">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditModal();
            }
        });
    }

    /**
     * Open edit modal for a display
     */
    function editDisplay(displayId) {
        const display = displays.find(d => d.id === displayId);
        if (!display) return;

        editingDisplayId = displayId;

        document.getElementById('editDisplayName').value = display.name || '';
        document.getElementById('editDisplayLocation').value = display.location || '';
        document.getElementById('editDisplayId').value = displayId;
        document.getElementById('editDisplayTags').value = (display.tags || []).join(', ');

        document.getElementById('displayEditModal').classList.add('active');
    }

    /**
     * Close edit modal
     */
    function closeEditModal() {
        document.getElementById('displayEditModal').classList.remove('active');
        editingDisplayId = null;
    }

    /**
     * Save display changes
     */
    async function saveDisplay() {
        if (!editingDisplayId) return;

        const name = document.getElementById('editDisplayName').value.trim();
        const location = document.getElementById('editDisplayLocation').value.trim();
        const tagsInput = document.getElementById('editDisplayTags').value.trim();
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];

        if (!name) {
            showToast('Please enter a display name', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/displays/${editingDisplayId}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                },
                body: JSON.stringify({ name, location, tags })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Display updated successfully', 'success');
                closeEditModal();
                loadDisplays();
            } else {
                showToast('Failed to update display: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to update display:', error);
            showToast('Failed to update display', 'error');
        }
    }

    /**
     * Delete a display
     */
    async function deleteDisplay(displayId) {
        const display = displays.find(d => d.id === displayId);
        if (!display) return;

        if (!confirm(`Are you sure you want to remove "${display.name}"?\n\nThis will stop tracking this display. It will re-register if it connects again.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/displays/${displayId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                }
            });

            const data = await response.json();

            if (data.success) {
                showToast('Display removed', 'success');
                loadDisplays();
            } else {
                showToast('Failed to remove display: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to delete display:', error);
            showToast('Failed to remove display', 'error');
        }
    }

    /**
     * Delete all inactive/offline displays
     */
    async function deleteAllInactive() {
        const inactiveCount = displays.filter(d => d.status === 'offline').length;

        if (inactiveCount === 0) {
            showToast('No inactive displays to remove', 'info');
            return;
        }

        if (!confirm(`Are you sure you want to remove all ${inactiveCount} inactive display(s)?\n\nThey will re-register if they connect again.`)) {
            return;
        }

        try {
            const response = await fetch('/api/displays/inactive/all', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                }
            });

            const data = await response.json();

            if (data.success) {
                if (data.removed > 0) {
                    showToast(`Removed ${data.removed} inactive display(s)`, 'success');
                } else {
                    showToast('No inactive displays to remove', 'info');
                }
                loadDisplays();
            } else {
                showToast('Failed to remove displays: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to delete inactive displays:', error);
            showToast('Failed to remove inactive displays', 'error');
        }
    }

    /**
     * Send command to a specific display
     */
    async function sendCommand(displayId, command, params = {}) {
        try {
            const response = await fetch(`/api/displays/${displayId}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                },
                body: JSON.stringify({ command, params })
            });

            const data = await response.json();

            if (data.success) {
                showToast(`Command '${command}' sent successfully`, 'success');
            } else {
                showToast('Failed to send command: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to send command:', error);
            showToast('Failed to send command', 'error');
        }
    }

    /**
     * Broadcast command to all displays
     */
    async function broadcastCommand(command, params = {}) {
        try {
            const response = await fetch('/api/displays/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                },
                body: JSON.stringify({ command, params })
            });

            const data = await response.json();

            if (data.success) {
                showToast(`Command '${command}' broadcast to all displays`, 'success');
            } else {
                showToast('Failed to broadcast command: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to broadcast command:', error);
            showToast('Failed to broadcast command', 'error');
        }
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        // Use global showToast if available
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }

        // Fallback toast implementation
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast ${type} show`;
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    /**
     * Cleanup on page unload
     */
    function cleanup() {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // Expose public API
    window.DisplayManager = {
        loadDisplays,
        editDisplay,
        closeEditModal,
        saveDisplay,
        deleteDisplay,
        deleteAllInactive,
        sendCommand,
        broadcastCommand
    };

})();
