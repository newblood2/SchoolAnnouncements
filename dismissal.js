/**
 * Dismissal Manager - Teacher Interface
 * Handles voice recognition, manual entry, and batch management
 */

(function() {
    'use strict';

    // Elements
    const loginScreen = document.getElementById('loginScreen');
    const dismissalContainer = document.getElementById('dismissalContainer');
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('passwordInput');
    const loginError = document.getElementById('loginError');

    const statusBadge = document.getElementById('statusBadge');
    const voiceModeBtn = document.getElementById('voiceModeBtn');
    const manualModeBtn = document.getElementById('manualModeBtn');
    const voiceInput = document.getElementById('voiceInput');
    const manualInput = document.getElementById('manualInput');

    const micButton = document.getElementById('micButton');
    const voiceStatus = document.getElementById('voiceStatus');
    const transcript = document.getElementById('transcript');
    const voiceAddBtn = document.getElementById('voiceAddBtn');
    const voiceClearBtn = document.getElementById('voiceClearBtn');

    const studentName = document.getElementById('studentName');
    const studentGrade = document.getElementById('studentGrade');
    const manualAddBtn = document.getElementById('manualAddBtn');

    const batchList = document.getElementById('batchList');
    const batchCount = document.getElementById('batchCount');

    const startDismissalBtn = document.getElementById('startDismissalBtn');
    const clearBatchBtn = document.getElementById('clearBatchBtn');
    const endDismissalBtn = document.getElementById('endDismissalBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const toast = document.getElementById('toast');

    // State
    let currentBatch = [];
    let isDismissalActive = false;
    let recognition = null;
    let isListening = false;
    let currentTranscript = '';
    let studentRoster = [];

    // Timeout configuration (2 hours)
    const DISMISSAL_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const WARNING_THRESHOLD_MS = 15 * 60 * 1000; // Show warning at 15 minutes remaining
    let dismissalStartTime = null;
    let timeoutInterval = null;

    // Timeout UI elements
    const timeoutWarning = document.getElementById('timeoutWarning');
    const timeoutCountdown = document.getElementById('timeoutCountdown');
    const sessionTimer = document.getElementById('sessionTimer');

    // ========================================
    // Authentication
    // ========================================

    // Check if already logged in - but validate session with server first
    (async function() {
        if (sessionStorage.getItem('dismissalLoggedIn') === 'true') {
            // Validate that the session is still valid with the server
            const isValid = await window.SettingsAPI.validateSession();
            if (isValid) {
                showDismissalManager();
            } else {
                // Session is invalid - clear local state and show login
                console.log('Session expired or invalid - requiring re-login');
                sessionStorage.removeItem('dismissalLoggedIn');
                window.SettingsAPI.clearSession();
                // Show a message to the user
                if (loginError) {
                    loginError.textContent = 'Session expired. Please log in again.';
                    loginError.style.display = 'block';
                }
            }
        }
    })();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordInput.value;

        // Authenticate directly with the API (password is validated server-side only)
        try {
            await window.SettingsAPI.login(password);
            sessionStorage.setItem('dismissalLoggedIn', 'true');
            showDismissalManager();
        } catch (error) {
            console.error('API login failed:', error);
            loginError.textContent = 'Incorrect password. Please try again.';
            loginError.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        if (window.SettingsAPI) {
            await window.SettingsAPI.logout();
        }
        sessionStorage.removeItem('dismissalLoggedIn');
        location.reload();
    });

    function showDismissalManager() {
        loginScreen.style.display = 'none';
        dismissalContainer.classList.add('active');
        initializeVoiceRecognition();
        loadDismissalState();
        loadStudentRoster();
    }

    // ========================================
    // Voice Recognition
    // ========================================

    function initializeVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            showToast('Voice recognition not supported in this browser', 'error');
            voiceInput.innerHTML = '<p style="color: var(--danger); text-align: center;">Voice recognition not available. Please use manual entry.</p>';
            manualModeBtn.click();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            micButton.classList.add('listening');
            voiceStatus.textContent = 'Listening...';
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptPiece = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcriptPiece;
                } else {
                    interimTranscript += transcriptPiece;
                }
            }

            currentTranscript = finalTranscript || interimTranscript;
            transcript.textContent = currentTranscript;
            transcript.classList.remove('empty');

            if (finalTranscript) {
                voiceAddBtn.disabled = false;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            voiceStatus.textContent = 'Error: ' + event.error;
            micButton.classList.remove('listening');
            isListening = false;
        };

        recognition.onend = () => {
            micButton.classList.remove('listening');
            isListening = false;
            voiceStatus.textContent = currentTranscript ? 'Click "Add Student" or tap mic again' : 'Tap mic to try again';
        };
    }

    micButton.addEventListener('mousedown', startListening);
    micButton.addEventListener('touchstart', startListening);
    micButton.addEventListener('mouseup', stopListening);
    micButton.addEventListener('touchend', stopListening);

    function startListening(e) {
        e.preventDefault();
        if (recognition && !isListening) {
            recognition.start();
        }
    }

    function stopListening(e) {
        e.preventDefault();
        if (recognition && isListening) {
            recognition.stop();
        }
    }

    voiceAddBtn.addEventListener('click', () => {
        if (!currentTranscript) return;

        const student = parseTranscript(currentTranscript);
        if (student) {
            // Auto-correct using roster if available
            if (studentRoster.length > 0 && window.FuzzyMatch) {
                const corrected = window.FuzzyMatch.autoCorrect(student.name, student.grade, studentRoster);
                if (corrected && corrected.confidence > 0.7) {
                    // High confidence - auto-correct
                    addStudentToBatch(corrected.corrected.name, corrected.corrected.grade);
                    if (corrected.corrected.name !== student.name) {
                        showToast(`Auto-corrected: ${student.name} → ${corrected.corrected.name}`, 'success');
                    } else {
                        showToast(`Added ${corrected.corrected.name}`, 'success');
                    }
                    clearVoiceInput();
                } else if (corrected && corrected.confidence > 0.5) {
                    // Medium confidence - ask for confirmation
                    if (confirm(`Did you mean: ${corrected.corrected.name} (Grade ${corrected.corrected.grade})?`)) {
                        addStudentToBatch(corrected.corrected.name, corrected.corrected.grade);
                        showToast(`Added ${corrected.corrected.name}`, 'success');
                        clearVoiceInput();
                    }
                } else {
                    // Low confidence - add as transcribed
                    addStudentToBatch(student.name, student.grade);
                    showToast(`⚠️ Name not in roster - added as transcribed`, 'warning');
                    clearVoiceInput();
                }
            } else {
                // No roster - add as transcribed
                addStudentToBatch(student.name, student.grade);
                clearVoiceInput();
            }
        } else {
            showToast('Could not parse student info. Try saying: "John Smith Grade 3"', 'error');
        }
    });

    voiceClearBtn.addEventListener('click', clearVoiceInput);

    function clearVoiceInput() {
        currentTranscript = '';
        transcript.textContent = 'Say: "John Smith Grade 3"';
        transcript.classList.add('empty');
        voiceAddBtn.disabled = true;
        voiceStatus.textContent = 'Tap and hold to speak';
    }

    function parseTranscript(text) {
        // Try to extract name and grade from transcript
        // Patterns: "John Smith Grade 3" or "John Smith 3rd grade" or "John Smith third grade"
        const gradePatterns = [
            /grade\s+(\d+|k|pre-?k|kindergarten)/i,
            /(\d+)(st|nd|rd|th)\s+grade/i,
            /(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+grade/i
        ];

        let grade = null;
        let name = text.trim();

        for (const pattern of gradePatterns) {
            const match = text.match(pattern);
            if (match) {
                grade = normalizeGrade(match[1]);
                // Remove grade part from text to get name
                name = text.replace(pattern, '').trim();
                break;
            }
        }

        if (!grade) {
            return null;
        }

        // Clean up name (remove extra spaces, capitalize)
        name = name.replace(/\s+/g, ' ').trim();
        name = name.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        return { name, grade };
    }

    function normalizeGrade(gradeStr) {
        const gradeMap = {
            'k': 'K',
            'kindergarten': 'K',
            'prek': 'Pre-K',
            'pre-k': 'Pre-K',
            'first': '1',
            'second': '2',
            'third': '3',
            'fourth': '4',
            'fifth': '5',
            'sixth': '6',
            'seventh': '7',
            'eighth': '8',
            'ninth': '9',
            'tenth': '10',
            'eleventh': '11',
            'twelfth': '12'
        };

        const lower = gradeStr.toLowerCase();
        return gradeMap[lower] || gradeStr;
    }

    // ========================================
    // Manual Entry
    // ========================================

    voiceModeBtn.addEventListener('click', () => {
        voiceModeBtn.classList.add('active');
        manualModeBtn.classList.remove('active');
        voiceInput.style.display = 'block';
        manualInput.classList.remove('active');
    });

    manualModeBtn.addEventListener('click', () => {
        manualModeBtn.classList.add('active');
        voiceModeBtn.classList.remove('active');
        manualInput.classList.add('active');
        voiceInput.style.display = 'none';
    });

    manualAddBtn.addEventListener('click', () => {
        const name = studentName.value.trim();
        const grade = studentGrade.value;

        if (!name || !grade) {
            showToast('Please enter both name and grade', 'error');
            return;
        }

        addStudentToBatch(name, grade);
        studentName.value = '';
        studentGrade.value = '';
        studentName.focus();
    });

    // ========================================
    // Batch Management
    // ========================================

    function addStudentToBatch(name, grade) {
        const student = { name, grade, id: Date.now() };
        currentBatch.push(student);
        updateBatchDisplay();
        saveBatchToAPI();
        showToast(`Added ${name} - Grade ${grade}`, 'success');
    }

    function removeStudentFromBatch(id) {
        currentBatch = currentBatch.filter(s => s.id !== id);
        updateBatchDisplay();
        saveBatchToAPI();
    }

    function updateBatchDisplay() {
        batchCount.textContent = currentBatch.length;

        if (currentBatch.length === 0) {
            batchList.classList.add('empty');
            batchList.innerHTML = 'No students in current batch';
        } else {
            batchList.classList.remove('empty');
            batchList.innerHTML = currentBatch.map(student => `
                <li class="batch-item">
                    <div class="batch-item-info">
                        <div class="batch-item-name">${escapeHtml(student.name)}</div>
                        <div class="batch-item-grade">Grade ${escapeHtml(student.grade)}</div>
                    </div>
                    <button class="batch-item-remove" onclick="window.removeStudent(${student.id})">×</button>
                </li>
            `).join('');
        }
    }

    // Expose to window for onclick
    window.removeStudent = removeStudentFromBatch;

    clearBatchBtn.addEventListener('click', () => {
        if (currentBatch.length === 0) return;

        if (confirm(`Clear all ${currentBatch.length} students from batch?`)) {
            currentBatch = [];
            updateBatchDisplay();
            saveBatchToAPI();
            showToast('Batch cleared', 'success');
        }
    });

    // ========================================
    // Dismissal Control
    // ========================================

    startDismissalBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/dismissal/start', {
                method: 'POST',
                headers: window.SettingsAPI.getAuthHeaders()
            });

            isDismissalActive = true;
            dismissalStartTime = Date.now();
            sessionStorage.setItem('dismissalStartTime', dismissalStartTime.toString());
            startDismissalTimer();
            updateDismissalStatus();
            showToast('Dismissal started - All TVs updated (2-hour session)', 'success');
        } catch (error) {
            console.error('Failed to start dismissal:', error);
            showToast('Failed to start dismissal', 'error');
        }
    });

    endDismissalBtn.addEventListener('click', async () => {
        if (!confirm('End dismissal and return TVs to announcements?')) return;
        await endDismissal();
    });

    async function endDismissal(isAutomatic = false) {
        try {
            await fetch('/api/dismissal/end', {
                method: 'POST',
                headers: window.SettingsAPI.getAuthHeaders()
            });

            isDismissalActive = false;
            dismissalStartTime = null;
            sessionStorage.removeItem('dismissalStartTime');
            currentBatch = [];
            stopDismissalTimer();
            updateDismissalStatus();
            updateBatchDisplay();

            if (isAutomatic) {
                showToast('Dismissal ended automatically (2-hour limit reached)', 'warning');
                alert('Dismissal has automatically ended after 2 hours.\n\nThis is a safety feature to prevent displays from being stuck in dismissal mode.\n\nYou can start a new dismissal session if needed.');
            } else {
                showToast('Dismissal ended', 'success');
            }
        } catch (error) {
            console.error('Failed to end dismissal:', error);
            showToast('Failed to end dismissal', 'error');
        }
    }

    // ========================================
    // Timeout Management
    // ========================================

    function startDismissalTimer() {
        // Clear any existing interval
        stopDismissalTimer();

        // Update timer every second
        timeoutInterval = setInterval(updateTimerDisplay, 1000);
        updateTimerDisplay();

        // Show session timer
        if (sessionTimer) {
            sessionTimer.style.display = 'inline-block';
        }
    }

    function stopDismissalTimer() {
        if (timeoutInterval) {
            clearInterval(timeoutInterval);
            timeoutInterval = null;
        }

        // Hide warning and timer
        if (timeoutWarning) {
            timeoutWarning.classList.remove('show');
        }
        if (sessionTimer) {
            sessionTimer.style.display = 'none';
        }
    }

    function updateTimerDisplay() {
        if (!dismissalStartTime || !isDismissalActive) {
            stopDismissalTimer();
            return;
        }

        const elapsed = Date.now() - dismissalStartTime;
        const remaining = DISMISSAL_TIMEOUT_MS - elapsed;

        // Check if timeout reached
        if (remaining <= 0) {
            console.log('Dismissal timeout reached - auto-ending session');
            endDismissal(true);
            return;
        }

        // Format remaining time
        const remainingMinutes = Math.floor(remaining / 60000);
        const remainingSeconds = Math.floor((remaining % 60000) / 1000);
        const formattedTime = `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;

        // Update session timer badge
        if (sessionTimer) {
            const hours = Math.floor(remainingMinutes / 60);
            const mins = remainingMinutes % 60;
            if (hours > 0) {
                sessionTimer.textContent = `${hours}h ${mins}m left`;
            } else {
                sessionTimer.textContent = `${mins}m left`;
            }
        }

        // Show warning if under threshold
        if (remaining <= WARNING_THRESHOLD_MS) {
            if (timeoutWarning) {
                timeoutWarning.classList.add('show');
            }
            if (timeoutCountdown) {
                timeoutCountdown.textContent = formattedTime;
            }

            // Change session timer color to warning
            if (sessionTimer) {
                sessionTimer.style.background = '#fef3c7';
                sessionTimer.style.color = '#92400e';
            }
        } else {
            if (timeoutWarning) {
                timeoutWarning.classList.remove('show');
            }
        }
    }

    function updateDismissalStatus() {
        if (isDismissalActive) {
            statusBadge.textContent = 'Active';
            statusBadge.classList.remove('inactive');
            statusBadge.classList.add('active');
            startDismissalBtn.style.display = 'none';
            endDismissalBtn.style.display = 'block';
        } else {
            statusBadge.textContent = 'Inactive';
            statusBadge.classList.remove('active');
            statusBadge.classList.add('inactive');
            startDismissalBtn.style.display = 'block';
            endDismissalBtn.style.display = 'none';
        }
    }

    // ========================================
    // API Integration
    // ========================================

    async function saveBatchToAPI() {
        if (!isDismissalActive) return;

        try {
            await fetch('/api/dismissal/batch', {
                method: 'POST',
                headers: window.SettingsAPI.getAuthHeaders(),
                body: JSON.stringify({ students: currentBatch })
            });
        } catch (error) {
            console.error('Failed to save batch:', error);
        }
    }

    async function loadDismissalState() {
        try {
            const response = await fetch('/api/dismissal/status');
            const data = await response.json();

            isDismissalActive = data.active || false;
            currentBatch = data.students || [];

            // If dismissal is active, check if we have a start time stored
            // or estimate based on current time (assume just started if unknown)
            if (isDismissalActive) {
                const storedStartTime = sessionStorage.getItem('dismissalStartTime');
                if (storedStartTime) {
                    dismissalStartTime = parseInt(storedStartTime, 10);
                    // Check if the stored time would have already expired
                    const elapsed = Date.now() - dismissalStartTime;
                    if (elapsed >= DISMISSAL_TIMEOUT_MS) {
                        // Session should have ended - end it now
                        console.log('Dismissal session expired while away - ending now');
                        await endDismissal(true);
                        return;
                    }
                } else {
                    // No stored time - set to now (gives full 2 hours)
                    dismissalStartTime = Date.now();
                }
                sessionStorage.setItem('dismissalStartTime', dismissalStartTime.toString());
                startDismissalTimer();
            } else {
                sessionStorage.removeItem('dismissalStartTime');
            }

            updateDismissalStatus();
            updateBatchDisplay();
        } catch (error) {
            console.error('Failed to load dismissal state:', error);
        }
    }

    async function loadStudentRoster() {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            studentRoster = data.studentRoster || [];

            if (studentRoster.length > 0) {
                console.log(`Loaded ${studentRoster.length} students from roster`);
            } else {
                console.log('No student roster available - auto-correction disabled');
            }
        } catch (error) {
            console.error('Failed to load student roster:', error);
        }
    }

    // ========================================
    // Utilities
    // ========================================

    function showToast(message, type = 'info') {
        toast.textContent = message;
        toast.className = 'toast show ' + type;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

})();
