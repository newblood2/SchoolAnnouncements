/**
 * Dismissal Reports Module
 * Handles viewing, filtering, and exporting dismissal history
 */

(function() {
    'use strict';

    // State
    let dismissalHistory = [];
    let filteredHistory = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 20;

    // Elements
    const totalDismissals = document.getElementById('totalDismissals');
    const uniqueStudentsDismissed = document.getElementById('uniqueStudentsDismissed');
    const dismissalDays = document.getElementById('dismissalDays');
    const startDateInput = document.getElementById('dismissalStartDate');
    const endDateInput = document.getElementById('dismissalEndDate');
    const gradeFilter = document.getElementById('dismissalGradeFilter');
    const filterBtn = document.getElementById('filterDismissalsBtn');
    const exportBtn = document.getElementById('exportDismissalsBtn');
    const clearHistoryBtn = document.getElementById('clearDismissalHistoryBtn');
    const historyBody = document.getElementById('dismissalHistoryBody');
    const gradeBreakdownChart = document.getElementById('gradeBreakdownChart');
    const paginationContainer = document.getElementById('dismissalPagination');

    /**
     * Initialize the module
     */
    function init() {
        // Set default date range (last 7 days)
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        if (endDateInput) endDateInput.value = today.toISOString().split('T')[0];
        if (startDateInput) startDateInput.value = weekAgo.toISOString().split('T')[0];

        // Set up event listeners
        if (filterBtn) filterBtn.addEventListener('click', loadHistory);
        if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);

        // Load initial data when tab becomes visible
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.dataset.tab === 'dismissal-reports') {
                    setTimeout(loadHistory, 100);
                }
            });
        });
    }

    /**
     * Load dismissal history from API
     */
    async function loadHistory() {
        try {
            const params = new URLSearchParams();
            if (startDateInput?.value) params.set('startDate', startDateInput.value);
            if (endDateInput?.value) params.set('endDate', endDateInput.value);
            if (gradeFilter?.value) params.set('grade', gradeFilter.value);

            const response = await fetch(`/api/dismissal/history?${params.toString()}`, {
                headers: window.SettingsAPI.getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to fetch history');

            const data = await response.json();
            dismissalHistory = data.history || [];
            filteredHistory = dismissalHistory;

            updateSummaryStats(data.summary);
            renderGradeBreakdown(data.summary.gradeBreakdown || {});
            currentPage = 1;
            renderHistoryTable();
            renderPagination();

            showToast('Dismissal history loaded', 'success');
        } catch (error) {
            console.error('Error loading dismissal history:', error);
            showToast('Failed to load dismissal history', 'error');
        }
    }

    /**
     * Update summary statistics
     */
    function updateSummaryStats(summary) {
        if (totalDismissals) totalDismissals.textContent = summary.totalDismissals || 0;
        if (uniqueStudentsDismissed) uniqueStudentsDismissed.textContent = summary.uniqueStudents || 0;
        if (dismissalDays) dismissalDays.textContent = summary.daysWithDismissals || 0;
    }

    /**
     * Render grade breakdown chart
     */
    function renderGradeBreakdown(breakdown) {
        if (!gradeBreakdownChart) return;

        const entries = Object.entries(breakdown).sort((a, b) => {
            // Sort by grade (Pre-K, K, 1-12)
            const gradeOrder = ['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
            return gradeOrder.indexOf(a[0]) - gradeOrder.indexOf(b[0]);
        });

        if (entries.length === 0) {
            gradeBreakdownChart.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 1rem;">No data available</p>';
            return;
        }

        const maxCount = Math.max(...entries.map(e => e[1]));

        gradeBreakdownChart.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${entries.map(([grade, count]) => {
                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return `
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 60px; font-weight: 500;">Grade ${grade}</div>
                            <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 24px; overflow: hidden;">
                                <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); transition: width 0.3s;"></div>
                            </div>
                            <div style="width: 40px; text-align: right; font-weight: 600; color: #374151;">${count}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render history table
     */
    function renderHistoryTable() {
        if (!historyBody) return;

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageItems = filteredHistory.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: #6b7280; padding: 2rem;">No dismissal records found</td>
                </tr>
            `;
            return;
        }

        historyBody.innerHTML = pageItems.map(entry => {
            const calledDate = new Date(entry.calledAt);
            return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 0.75rem;">${entry.date}</td>
                    <td style="padding: 0.75rem; font-weight: 500;">${escapeHtml(entry.studentName)}</td>
                    <td style="padding: 0.75rem;">${entry.grade}</td>
                    <td style="padding: 0.75rem;">${calledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Render pagination controls
     */
    function renderPagination() {
        if (!paginationContainer) return;

        const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = '';

        // Previous button
        html += `<button class="btn btn-secondary btn-sm" ${currentPage === 1 ? 'disabled' : ''} onclick="window.DismissalReports.goToPage(${currentPage - 1})">Prev</button>`;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                html += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.DismissalReports.goToPage(${i})">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                html += `<span style="padding: 0 0.5rem;">...</span>`;
            }
        }

        // Next button
        html += `<button class="btn btn-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.DismissalReports.goToPage(${currentPage + 1})">Next</button>`;

        paginationContainer.innerHTML = html;
    }

    /**
     * Go to a specific page
     */
    function goToPage(page) {
        const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
        if (page < 1 || page > totalPages) return;

        currentPage = page;
        renderHistoryTable();
        renderPagination();
    }

    /**
     * Export history to CSV
     */
    async function exportToCSV() {
        try {
            const params = new URLSearchParams();
            if (startDateInput?.value) params.set('startDate', startDateInput.value);
            if (endDateInput?.value) params.set('endDate', endDateInput.value);
            if (gradeFilter?.value) params.set('grade', gradeFilter.value);

            const response = await fetch(`/api/dismissal/history/export?${params.toString()}`, {
                headers: window.SettingsAPI.getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to export');

            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'dismissal-report.csv';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) filename = match[1];
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            showToast('Dismissal report exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting dismissal history:', error);
            showToast('Failed to export dismissal report', 'error');
        }
    }

    /**
     * Clear dismissal history
     */
    async function clearHistory() {
        if (!confirm('Are you sure you want to clear all dismissal history? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/dismissal/history', {
                method: 'DELETE',
                headers: window.SettingsAPI.getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to clear history');

            dismissalHistory = [];
            filteredHistory = [];
            currentPage = 1;

            updateSummaryStats({ totalDismissals: 0, uniqueStudents: 0, daysWithDismissals: 0 });
            renderGradeBreakdown({});
            renderHistoryTable();
            renderPagination();

            showToast('Dismissal history cleared', 'success');
        } catch (error) {
            console.error('Error clearing dismissal history:', error);
            showToast('Failed to clear dismissal history', 'error');
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
    window.DismissalReports = {
        loadHistory,
        goToPage,
        exportToCSV
    };

})();
