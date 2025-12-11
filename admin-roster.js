/**
 * Admin Panel - Student Roster Management
 * Handles CSV upload, roster display, and student search
 */

(function() {
    'use strict';

    // Elements
    const rosterFile = document.getElementById('rosterFile');
    const uploadRosterBtn = document.getElementById('uploadRosterBtn');
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    const clearRosterBtn = document.getElementById('clearRosterBtn');
    const rosterList = document.getElementById('rosterList');
    const rosterCount = document.getElementById('rosterCount');
    const rosterSearch = document.getElementById('rosterSearch');

    let currentRoster = [];

    // ========================================
    // CSV Upload
    // ========================================

    uploadRosterBtn.addEventListener('click', async () => {
        const file = rosterFile.files[0];
        if (!file) {
            showToast('Please select a CSV file first', 'error');
            return;
        }

        try {
            const text = await file.text();
            const students = parseCSV(text);

            if (students.length === 0) {
                showToast('No valid students found in CSV', 'error');
                return;
            }

            // Save to API
            await window.SettingsAPI.save('studentRoster', students);

            currentRoster = students;
            updateRosterDisplay();
            showToast(`Uploaded ${students.length} students successfully!`, 'success');

            // Clear file input
            rosterFile.value = '';
        } catch (error) {
            console.error('Error uploading roster:', error);
            showToast('Failed to upload roster: ' + error.message, 'error');
        }
    });

    downloadTemplateBtn.addEventListener('click', () => {
        const template = 'Name,Grade\nJohn Smith,3\nSarah Johnson,5\nMike Brown,K\nEmily Davis,12\n';
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student-roster-template.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Template downloaded', 'success');
    });

    clearRosterBtn.addEventListener('click', async () => {
        if (!confirm(`Clear all ${currentRoster.length} students from roster?`)) {
            return;
        }

        try {
            await window.SettingsAPI.save('studentRoster', []);
            currentRoster = [];
            updateRosterDisplay();
            showToast('Roster cleared', 'success');
        } catch (error) {
            console.error('Error clearing roster:', error);
            showToast('Failed to clear roster', 'error');
        }
    });

    // ========================================
    // CSV Parsing
    // ========================================

    function parseCSV(text) {
        const lines = text.trim().split('\n');
        const students = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Skip header row if it looks like headers
            if (i === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('grade'))) {
                continue;
            }

            const parts = line.split(',').map(p => p.trim());
            if (parts.length < 2) continue;

            const name = parts[0];
            const grade = normalizeGrade(parts[1]);

            if (name && grade) {
                students.push({ name, grade });
            }
        }

        return students;
    }

    function normalizeGrade(gradeStr) {
        const gradeMap = {
            'k': 'K',
            'kindergarten': 'K',
            'prek': 'Pre-K',
            'pre-k': 'Pre-K',
            'prekindergarten': 'Pre-K'
        };

        const lower = gradeStr.toLowerCase().trim();
        if (gradeMap[lower]) {
            return gradeMap[lower];
        }

        // Try to extract number
        const match = gradeStr.match(/(\d+)/);
        if (match) {
            const num = parseInt(match[1]);
            if (num >= 1 && num <= 12) {
                return num.toString();
            }
        }

        return gradeStr; // Return as-is if can't normalize
    }

    // ========================================
    // Display
    // ========================================

    function updateRosterDisplay(filter = '') {
        rosterCount.textContent = currentRoster.length;

        if (currentRoster.length === 0) {
            rosterList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">No roster uploaded yet</p>';
            return;
        }

        const filteredStudents = filter ?
            currentRoster.filter(s =>
                s.name.toLowerCase().includes(filter.toLowerCase()) ||
                s.grade.toLowerCase().includes(filter.toLowerCase())
            ) : currentRoster;

        if (filteredStudents.length === 0) {
            rosterList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">No students match your search</p>';
            return;
        }

        rosterList.innerHTML = filteredStudents.map((student, index) => `
            <div class="roster-item">
                <div>
                    <div class="roster-item-name">${escapeHtml(student.name)}</div>
                    <div class="roster-item-grade">Grade ${escapeHtml(student.grade)}</div>
                </div>
                <button class="roster-item-remove" data-student-name="${escapeHtml(student.name)}">×</button>
            </div>
        `).join('');

        // Add event listeners for remove buttons (safer than inline onclick)
        rosterList.querySelectorAll('.roster-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                window.removeRosterStudent(btn.dataset.studentName);
            });
        });
    }

    rosterSearch.addEventListener('input', (e) => {
        updateRosterDisplay(e.target.value);
    });

    // ========================================
    // Student Removal
    // ========================================

    window.removeRosterStudent = async function(name) {
        currentRoster = currentRoster.filter(s => s.name !== name);

        try {
            await window.SettingsAPI.save('studentRoster', currentRoster);
            updateRosterDisplay(rosterSearch.value);
            showToast(`Removed ${name}`, 'success');
        } catch (error) {
            console.error('Error removing student:', error);
            showToast('Failed to remove student', 'error');
        }
    };

    // ========================================
    // Load Roster on Init
    // ========================================

    async function loadRoster() {
        try {
            const settings = await window.SettingsAPI.getAll();
            currentRoster = settings.studentRoster || [];
            updateRosterDisplay();
        } catch (error) {
            console.error('Error loading roster:', error);
            showToast('Failed to load student roster', 'error');
        }
    }

    // ========================================
    // Utilities
    // ========================================

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(message, type = 'info') {
        // Use global showToast if available
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }
        // Fallback implementation
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = 'toast show ' + type;
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    // Initialize when admin panel loads
    if (window.initializeAdmin) {
        const originalInit = window.initializeAdmin;
        window.initializeAdmin = function() {
            originalInit();
            loadRoster();
        };
    } else {
        // Fallback if initializeAdmin not defined yet
        document.addEventListener('DOMContentLoaded', loadRoster);
    }

})();
