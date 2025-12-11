/**
 * Admin Analytics Module
 * Handles analytics dashboard in the admin panel
 */

(function() {
    'use strict';

    // State
    let analyticsData = {
        slideViews: {},
        hourlyActivity: {},
        activityLog: [],
        displayActivity: {}
    };

    // Elements
    const totalSlideViews = document.getElementById('totalSlideViews');
    const activeDisplaysToday = document.getElementById('activeDisplaysToday');
    const avgViewsPerDisplay = document.getElementById('avgViewsPerDisplay');
    const uptimePercentage = document.getElementById('uptimePercentage');
    const analyticsStartDate = document.getElementById('analyticsStartDate');
    const analyticsEndDate = document.getElementById('analyticsEndDate');
    const loadAnalyticsBtn = document.getElementById('loadAnalyticsBtn');
    const exportAnalyticsBtn = document.getElementById('exportAnalyticsBtn');
    const slidePerformanceChart = document.getElementById('slidePerformanceChart');
    const hourlyActivityChart = document.getElementById('hourlyActivityChart');
    const activityLogBody = document.getElementById('activityLogBody');
    const clearOldAnalyticsBtn = document.getElementById('clearOldAnalyticsBtn');
    const clearAllAnalyticsBtn = document.getElementById('clearAllAnalyticsBtn');

    /**
     * Initialize the module
     */
    async function init() {
        setDefaultDates();
        setupEventListeners();
        await loadAnalytics();
    }

    /**
     * Set default date range (last 7 days)
     */
    function setDefaultDates() {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        if (analyticsEndDate) {
            analyticsEndDate.value = today.toISOString().split('T')[0];
        }
        if (analyticsStartDate) {
            analyticsStartDate.value = weekAgo.toISOString().split('T')[0];
        }
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        if (loadAnalyticsBtn) {
            loadAnalyticsBtn.addEventListener('click', loadAnalytics);
        }

        if (exportAnalyticsBtn) {
            exportAnalyticsBtn.addEventListener('click', exportAnalytics);
        }

        if (clearOldAnalyticsBtn) {
            clearOldAnalyticsBtn.addEventListener('click', clearOldAnalytics);
        }

        if (clearAllAnalyticsBtn) {
            clearAllAnalyticsBtn.addEventListener('click', clearAllAnalytics);
        }
    }

    /**
     * Load analytics data from API
     */
    async function loadAnalytics() {
        try {
            const startDate = analyticsStartDate?.value || '';
            const endDate = analyticsEndDate?.value || '';

            const response = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`, {
                headers: {
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load analytics');
            }

            analyticsData = await response.json();
            renderAnalytics();
            showToast('Analytics loaded', 'success');
        } catch (error) {
            console.error('Failed to load analytics:', error);
            // Initialize with empty data if API fails
            analyticsData = {
                slideViews: {},
                hourlyActivity: {},
                activityLog: [],
                displayActivity: {},
                totalViews: 0,
                activeDisplays: 0,
                uptimeMinutes: 0,
                totalMinutes: 0
            };
            renderAnalytics();
        }
    }

    /**
     * Render all analytics components
     */
    function renderAnalytics() {
        renderOverviewStats();
        renderSlidePerformance();
        renderHourlyActivity();
        renderActivityLog();
    }

    /**
     * Render overview statistics
     */
    function renderOverviewStats() {
        const totalViews = analyticsData.totalViews || Object.values(analyticsData.slideViews).reduce((sum, v) => sum + v, 0);
        const activeDisplays = analyticsData.activeDisplays || Object.keys(analyticsData.displayActivity).length;
        const avgViews = activeDisplays > 0 ? Math.round(totalViews / activeDisplays) : 0;

        // Calculate uptime percentage
        const uptimeMinutes = analyticsData.uptimeMinutes || 0;
        const totalMinutes = analyticsData.totalMinutes || 1;
        const uptime = Math.round((uptimeMinutes / totalMinutes) * 100);

        if (totalSlideViews) totalSlideViews.textContent = formatNumber(totalViews);
        if (activeDisplaysToday) activeDisplaysToday.textContent = activeDisplays;
        if (avgViewsPerDisplay) avgViewsPerDisplay.textContent = formatNumber(avgViews);
        if (uptimePercentage) uptimePercentage.textContent = `${uptime}%`;
    }

    /**
     * Render slide performance chart
     */
    function renderSlidePerformance() {
        if (!slidePerformanceChart) return;

        const slideViews = analyticsData.slideViews || {};
        const entries = Object.entries(slideViews).sort((a, b) => b[1] - a[1]);

        if (entries.length === 0) {
            slidePerformanceChart.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">No slide view data yet. Views are tracked automatically.</p>';
            return;
        }

        const maxViews = Math.max(...entries.map(e => e[1]));

        slidePerformanceChart.innerHTML = entries.map(([slideName, views]) => {
            const percentage = maxViews > 0 ? (views / maxViews) * 100 : 0;
            return `
                <div class="performance-bar-item">
                    <div class="performance-bar-label">
                        <span class="slide-name">${escapeHtml(slideName)}</span>
                        <span class="slide-views">${formatNumber(views)} views</span>
                    </div>
                    <div class="performance-bar-track">
                        <div class="performance-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render hourly activity chart
     */
    function renderHourlyActivity() {
        if (!hourlyActivityChart) return;

        const hourlyActivity = analyticsData.hourlyActivity || {};

        // Create array of 24 hours
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            activity: hourlyActivity[i] || 0
        }));

        const maxActivity = Math.max(...hours.map(h => h.activity), 1);

        hourlyActivityChart.innerHTML = `
            <div class="hourly-chart-container">
                ${hours.map(h => {
                    const height = (h.activity / maxActivity) * 100;
                    const label = h.hour === 0 ? '12am' : h.hour === 12 ? '12pm' : h.hour > 12 ? `${h.hour - 12}pm` : `${h.hour}am`;
                    const showLabel = h.hour % 3 === 0;
                    return `
                        <div class="hourly-bar-container" title="${label}: ${h.activity} views">
                            <div class="hourly-bar" style="height: ${height}%"></div>
                            ${showLabel ? `<span class="hourly-label">${label}</span>` : '<span class="hourly-label"></span>'}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render activity log
     */
    function renderActivityLog() {
        if (!activityLogBody) return;

        const log = analyticsData.activityLog || [];

        if (log.length === 0) {
            activityLogBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #6b7280; padding: 2rem;">No activity logged yet</td></tr>';
            return;
        }

        // Show most recent 50 entries
        const recentLog = log.slice(-50).reverse();

        activityLogBody.innerHTML = recentLog.map(entry => {
            const time = new Date(entry.timestamp).toLocaleString();
            const eventClass = entry.event === 'connect' ? 'event-connect' : entry.event === 'disconnect' ? 'event-disconnect' : '';
            return `
                <tr>
                    <td style="padding: 0.75rem;">${time}</td>
                    <td style="padding: 0.75rem;">${escapeHtml(entry.displayName || entry.displayId || 'Unknown')}</td>
                    <td style="padding: 0.75rem;"><span class="event-badge ${eventClass}">${escapeHtml(entry.event)}</span></td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Export analytics to CSV
     */
    function exportAnalytics() {
        const rows = [
            ['Analytics Export', new Date().toISOString()],
            [],
            ['Slide Performance'],
            ['Slide Name', 'Views']
        ];

        Object.entries(analyticsData.slideViews || {}).forEach(([name, views]) => {
            rows.push([name, views]);
        });

        rows.push([]);
        rows.push(['Hourly Activity']);
        rows.push(['Hour', 'Views']);

        for (let i = 0; i < 24; i++) {
            const label = i === 0 ? '12 AM' : i === 12 ? '12 PM' : i > 12 ? `${i - 12} PM` : `${i} AM`;
            rows.push([label, analyticsData.hourlyActivity?.[i] || 0]);
        }

        rows.push([]);
        rows.push(['Activity Log']);
        rows.push(['Timestamp', 'Display', 'Event']);

        (analyticsData.activityLog || []).forEach(entry => {
            rows.push([entry.timestamp, entry.displayName || entry.displayId, entry.event]);
        });

        const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        downloadCSV(csv, `analytics-export-${new Date().toISOString().split('T')[0]}.csv`);
        showToast('Analytics exported', 'success');
    }

    /**
     * Clear analytics older than 30 days
     */
    async function clearOldAnalytics() {
        if (!confirm('Clear analytics data older than 30 days?')) return;

        try {
            const response = await fetch('/api/analytics/clear-old', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                },
                body: JSON.stringify({ daysOld: 30 })
            });

            if (!response.ok) {
                throw new Error('Failed to clear old analytics');
            }

            await loadAnalytics();
            showToast('Old analytics cleared', 'success');
        } catch (error) {
            console.error('Failed to clear old analytics:', error);
            showToast('Failed to clear old analytics', 'error');
        }
    }

    /**
     * Clear all analytics data
     */
    async function clearAllAnalytics() {
        if (!confirm('Are you sure you want to clear ALL analytics data? This cannot be undone.')) return;

        try {
            const response = await fetch('/api/analytics/clear-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                }
            });

            if (!response.ok) {
                throw new Error('Failed to clear analytics');
            }

            analyticsData = {
                slideViews: {},
                hourlyActivity: {},
                activityLog: [],
                displayActivity: {}
            };
            renderAnalytics();
            showToast('All analytics cleared', 'success');
        } catch (error) {
            console.error('Failed to clear analytics:', error);
            showToast('Failed to clear analytics', 'error');
        }
    }

    /**
     * Helper: Format large numbers with K/M suffix
     */
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    /**
     * Helper: Download CSV file
     */
    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    }

    /**
     * Helper: Escape HTML entities
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Helper: Show toast notification
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
    window.AnalyticsAdmin = {
        load: loadAnalytics,
        export: exportAnalytics
    };

})();
