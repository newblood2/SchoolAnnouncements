/**
 * Visual Slide Editor Module
 * User-friendly WYSIWYG slide editor for non-technical users
 * Supports multiple slideshows
 */

(function() {
    'use strict';

    // ========================================
    // MULTIPLE SLIDESHOWS SUPPORT
    // ========================================
    let slideshows = {};  // { id: { name: string, slides: array } }
    let currentSlideshowId = 'default';

    function generateSlideshowId() {
        return 'slideshow-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    function loadSlideshows() {
        const saved = localStorage.getItem('multipleSlideshows');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                slideshows = data.slideshows || {};
                currentSlideshowId = data.currentSlideshowId || 'default';
            } catch (e) {
                initializeDefaultSlideshows();
            }
        } else {
            initializeDefaultSlideshows();
        }

        // Ensure at least one slideshow exists
        if (Object.keys(slideshows).length === 0) {
            initializeDefaultSlideshows();
        }

        renderSlideshowTabs();
    }

    function initializeDefaultSlideshows() {
        // Migrate from old single slideshow format
        const oldSlides = localStorage.getItem('visualSlides');
        let defaultSlides = [];

        if (oldSlides) {
            try {
                defaultSlides = JSON.parse(oldSlides);
            } catch (e) {
                defaultSlides = getDefaultSlides();
            }
        } else {
            defaultSlides = getDefaultSlides();
        }

        slideshows = {
            'default': {
                name: 'Main Slideshow',
                slides: defaultSlides
            }
        };
        currentSlideshowId = 'default';
    }

    function saveSlideshows() {
        // Save multiple slideshows format
        localStorage.setItem('multipleSlideshows', JSON.stringify({
            slideshows: slideshows,
            currentSlideshowId: currentSlideshowId
        }));

        // Also save current slideshow in old format for backward compatibility
        saveCurrentSlideshowToOldFormat();
    }

    function saveCurrentSlideshowToOldFormat() {
        const currentSlideshow = slideshows[currentSlideshowId];
        if (!currentSlideshow) return;

        localStorage.setItem('visualSlides', JSON.stringify(currentSlideshow.slides));

        // Save all slideshows content to API
        const allSlideshowsContent = {};
        Object.entries(slideshows).forEach(([id, show]) => {
            allSlideshowsContent[id] = {
                name: show.name,
                slides: show.slides.map(slide => {
                    const template = SLIDE_TEMPLATES[slide.template];
                    return {
                        type: slide.template,
                        content: template ? template.render(slide.data) : slide.data.html || ''
                    };
                })
            };
        });

        // Save to API
        if (window.SettingsAPI) {
            window.SettingsAPI.save('slideshows', allSlideshowsContent).catch(err => {
                console.error('Failed to save slideshows to API:', err);
            });

            // Also save legacy customSlides for the default slideshow
            const defaultContent = slideshows['default']?.slides.map(slide => {
                const template = SLIDE_TEMPLATES[slide.template];
                return {
                    type: slide.template,
                    content: template ? template.render(slide.data) : slide.data.html || ''
                };
            }) || [];
            window.SettingsAPI.save('customSlides', defaultContent);
        }
    }

    function renderSlideshowTabs() {
        const container = document.getElementById('slideshowTabs');
        if (!container) return;

        container.innerHTML = Object.entries(slideshows).map(([id, show]) => `
            <div class="slideshow-tab ${id === currentSlideshowId ? 'active' : ''}" data-slideshow-id="${id}">
                <span class="slideshow-tab-name"
                      contenteditable="true"
                      data-slideshow-id="${id}"
                      title="Click to rename">${escapeHtml(show.name)}</span>
                ${Object.keys(slideshows).length > 1 ? `
                    <div class="slideshow-tab-actions">
                        <button class="slideshow-tab-btn delete-slideshow-btn" data-slideshow-id="${id}" title="Delete slideshow">×</button>
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Add click handlers for tabs
        container.querySelectorAll('.slideshow-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (e.target.classList.contains('slideshow-tab-name') ||
                    e.target.classList.contains('slideshow-tab-btn')) return;
                selectSlideshow(tab.dataset.slideshowId);
            });
        });

        // Add rename handlers
        container.querySelectorAll('.slideshow-tab-name').forEach(nameEl => {
            nameEl.addEventListener('blur', (e) => {
                const id = e.target.dataset.slideshowId;
                const newName = e.target.textContent.trim() || 'Untitled';
                if (slideshows[id]) {
                    slideshows[id].name = newName;
                    saveSlideshows();
                }
            });
            nameEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        });

        // Add delete handlers
        container.querySelectorAll('.delete-slideshow-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.slideshowId;
                deleteSlideshow(id);
            });
        });
    }

    function selectSlideshow(id) {
        if (!slideshows[id]) return;

        currentSlideshowId = id;
        slides = slideshows[id].slides;
        selectedSlideIndex = -1;

        renderSlideshowTabs();
        renderSlideList();

        if (slides.length > 0) {
            selectSlide(0);
        } else {
            const editorContainer = document.getElementById('slideEditorContainer');
            if (editorContainer) {
                editorContainer.innerHTML = `
                    <div class="no-slide-selected">
                        <p>No slides in this slideshow.</p>
                        <p>Click "Add Slide" to create one!</p>
                    </div>
                `;
            }
        }

        saveSlideshows();
    }

    function addSlideshow() {
        const id = generateSlideshowId();
        const num = Object.keys(slideshows).length + 1;

        slideshows[id] = {
            name: `Slideshow ${num}`,
            slides: []
        };

        selectSlideshow(id);
        showToast('New slideshow created!', 'success');
    }

    function deleteSlideshow(id) {
        if (Object.keys(slideshows).length <= 1) {
            showToast('Cannot delete the last slideshow', 'error');
            return;
        }

        if (!confirm(`Delete "${slideshows[id].name}" and all its slides?`)) {
            return;
        }

        delete slideshows[id];

        // Switch to another slideshow
        const remainingIds = Object.keys(slideshows);
        selectSlideshow(remainingIds[0]);

        showToast('Slideshow deleted', 'success');
    }

    function getSlideshowsList() {
        return Object.entries(slideshows).map(([id, show]) => ({
            id,
            name: show.name
        }));
    }

    // ========================================
    // QUILL EDITORS
    // ========================================
    let quillEditors = {};

    function initializeQuillEditors() {
        // Clean up existing editors
        Object.keys(quillEditors).forEach(key => {
            if (quillEditors[key]) {
                delete quillEditors[key];
            }
        });
        quillEditors = {};

        // Initialize new Quill editors
        document.querySelectorAll('.quill-editor').forEach(editorEl => {
            const fieldId = editorEl.dataset.field;
            const hiddenInput = document.getElementById(`field_${fieldId}`);

            if (!hiddenInput) return;

            const quill = new Quill(editorEl, {
                theme: 'snow',
                placeholder: 'Enter your content here...',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'align': [] }],
                        ['link', 'image'],
                        ['clean']
                    ]
                }
            });

            // Set initial content
            const initialContent = hiddenInput.value;
            if (initialContent) {
                quill.root.innerHTML = initialContent;
            }

            // Update hidden input and preview on change
            quill.on('text-change', function() {
                const html = quill.root.innerHTML;
                hiddenInput.value = html;
                hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
            });

            quillEditors[fieldId] = quill;
        });
    }

    // ========================================
    // SCHEDULE MANAGEMENT
    // ========================================
    let slideSchedules = {};

    function loadSchedules() {
        try {
            const saved = localStorage.getItem('slideSchedules');
            if (saved) {
                slideSchedules = JSON.parse(saved);
            }
        } catch (e) {
            slideSchedules = {};
        }
    }

    function saveSchedules() {
        localStorage.setItem('slideSchedules', JSON.stringify(slideSchedules));

        // Also save to API
        if (window.SettingsAPI) {
            window.SettingsAPI.save('slideSchedules', slideSchedules).catch(err => {
                console.error('Failed to save schedules to API:', err);
                showToast('Failed to save slide schedules', 'error');
            });
        }
    }

    function getScheduleForSlide(slideId) {
        return slideSchedules[slideId] || null;
    }

    function setScheduleForSlide(slideId, schedule) {
        if (schedule && schedule.enabled) {
            slideSchedules[slideId] = schedule;
        } else {
            delete slideSchedules[slideId];
        }
        saveSchedules();
    }

    // ========================================
    // SLIDE TEMPLATES
    // ========================================
    const SLIDE_TEMPLATES = {
        welcome: {
            name: 'Welcome Message',
            icon: '👋',
            description: 'A welcoming title slide',
            fields: [
                { id: 'title', label: 'Title', type: 'text', default: 'Welcome!', placeholder: 'Enter welcome message' },
                { id: 'subtitle', label: 'Subtitle', type: 'text', default: 'Morning Announcements', placeholder: 'Enter subtitle' }
            ],
            render: (data) => `<h1>${escapeHtml(data.title)}</h1><p class="subtitle">${escapeHtml(data.subtitle)}</p>`
        },
        announcement: {
            name: 'Announcement',
            icon: '📢',
            description: 'Important announcement with title and message',
            fields: [
                { id: 'title', label: 'Title', type: 'text', default: 'Announcement', placeholder: 'Enter title' },
                { id: 'message', label: 'Message', type: 'textarea', default: 'Enter your announcement here...', placeholder: 'Enter announcement details' }
            ],
            render: (data) => `<h2>${escapeHtml(data.title)}</h2><p class="announcement-text">${escapeHtml(data.message).replace(/\n/g, '<br>')}</p>`
        },
        events: {
            name: 'Events List',
            icon: '📅',
            description: 'List of upcoming events with times',
            fields: [
                { id: 'title', label: 'Section Title', type: 'text', default: "Today's Events", placeholder: 'Enter section title' },
                { id: 'events', label: 'Events', type: 'eventlist', default: [
                    { name: 'Morning Assembly', time: '8:00 AM' },
                    { name: 'Student Council', time: '3:00 PM' }
                ]}
            ],
            render: (data) => {
                const eventsList = data.events.map(e =>
                    `<li><span class="event-name">${escapeHtml(e.name)}</span><span class="event-time">${escapeHtml(e.time)}</span></li>`
                ).join('');
                return `<h2>${escapeHtml(data.title)}</h2><ul class="events-list">${eventsList}</ul>`;
            }
        },
        bulletList: {
            name: 'Bullet Points',
            icon: '📝',
            description: 'Simple list of items',
            fields: [
                { id: 'title', label: 'Title', type: 'text', default: 'Reminders', placeholder: 'Enter title' },
                { id: 'items', label: 'List Items', type: 'simplelist', default: ['First item', 'Second item', 'Third item'] }
            ],
            render: (data) => {
                const itemsList = data.items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
                return `<h2>${escapeHtml(data.title)}</h2><ul class="bullet-list">${itemsList}</ul>`;
            }
        },
        lunch: {
            name: 'Lunch Menu',
            icon: '🍽️',
            description: 'Display lunch options',
            fields: [
                { id: 'title', label: 'Title', type: 'text', default: "Today's Lunch", placeholder: 'Enter title' },
                { id: 'mainDish', label: 'Main Dish', type: 'text', default: 'Pizza', placeholder: 'Main dish' },
                { id: 'sides', label: 'Sides', type: 'text', default: 'Salad, Fruit Cup', placeholder: 'Side dishes' },
                { id: 'drink', label: 'Drink', type: 'text', default: 'Milk or Juice', placeholder: 'Beverage options' }
            ],
            render: (data) => `
                <h2>${escapeHtml(data.title)}</h2>
                <div class="lunch-menu">
                    <div class="lunch-item"><span class="lunch-label">Main:</span> ${escapeHtml(data.mainDish)}</div>
                    <div class="lunch-item"><span class="lunch-label">Sides:</span> ${escapeHtml(data.sides)}</div>
                    <div class="lunch-item"><span class="lunch-label">Drink:</span> ${escapeHtml(data.drink)}</div>
                </div>
            `
        },
        birthday: {
            name: 'Birthdays',
            icon: '🎂',
            description: 'Celebrate student birthdays',
            fields: [
                { id: 'title', label: 'Title', type: 'text', default: 'Happy Birthday!', placeholder: 'Enter title' },
                { id: 'names', label: 'Birthday Names', type: 'simplelist', default: ['John S.', 'Sarah M.'] }
            ],
            render: (data) => {
                const namesList = data.names.map(name => `<span class="birthday-name">${escapeHtml(name)}</span>`).join('');
                return `<h2>🎂 ${escapeHtml(data.title)} 🎂</h2><div class="birthday-names">${namesList}</div>`;
            }
        },
        countdown: {
            name: 'Countdown Timer',
            icon: '⏰',
            description: 'Live countdown to an event date',
            fields: [
                { id: 'eventName', label: 'Event Name', type: 'text', default: 'Winter Break', placeholder: 'What are we counting down to?' },
                { id: 'targetDate', label: 'Target Date', type: 'date', default: '', placeholder: 'Select date' },
                { id: 'showHours', label: 'Show Hours/Minutes', type: 'checkbox', default: false }
            ],
            render: (data) => {
                // Calculate days remaining (for preview - live update handled by slideshow.js)
                const target = data.targetDate ? new Date(data.targetDate + 'T00:00:00') : null;
                const now = new Date();
                let countdownHtml = '';

                if (target && target > now) {
                    const diff = target - now;
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                    if (data.showHours) {
                        countdownHtml = `
                            <div class="countdown-numbers">
                                <div class="countdown-unit"><span class="countdown-value" data-unit="days">${days}</span><span class="countdown-label">Days</span></div>
                                <div class="countdown-unit"><span class="countdown-value" data-unit="hours">${hours}</span><span class="countdown-label">Hours</span></div>
                                <div class="countdown-unit"><span class="countdown-value" data-unit="minutes">${minutes}</span><span class="countdown-label">Min</span></div>
                            </div>
                        `;
                    } else {
                        countdownHtml = `<div class="countdown-days"><span class="countdown-value" data-unit="days">${days}</span> <span class="countdown-label">Days</span></div>`;
                    }
                } else if (target) {
                    countdownHtml = `<div class="countdown-reached">It's here!</div>`;
                } else {
                    countdownHtml = `<div class="countdown-days"><span class="countdown-value">?</span> <span class="countdown-label">Days</span></div>`;
                }

                return `
                    <div class="countdown-slide" data-target-date="${escapeHtml(data.targetDate || '')}" data-show-hours="${data.showHours}">
                        <h2 class="countdown-title">Countdown to</h2>
                        <h1 class="countdown-event">${escapeHtml(data.eventName)}</h1>
                        ${countdownHtml}
                    </div>
                `;
            }
        },
        calendarEvents: {
            name: 'Calendar Events',
            icon: '📆',
            description: 'Display upcoming events from imported calendar',
            fields: [
                { id: 'title', label: 'Section Title', type: 'text', default: 'Upcoming Events', placeholder: 'Enter section title' },
                { id: 'daysAhead', label: 'Days to Show', type: 'number', default: 7, placeholder: 'Number of days ahead' },
                { id: 'maxEvents', label: 'Max Events', type: 'number', default: 5, placeholder: 'Maximum events to display' },
                { id: 'showTime', label: 'Show Event Times', type: 'checkbox', default: true }
            ],
            render: (data) => {
                // This slide dynamically loads events at display time
                // For preview, show placeholder
                return `
                    <div class="calendar-events-slide"
                         data-days-ahead="${escapeHtml(String(data.daysAhead || 7))}"
                         data-max-events="${escapeHtml(String(data.maxEvents || 5))}"
                         data-show-time="${data.showTime !== false}">
                        <h2>${escapeHtml(data.title)}</h2>
                        <ul class="calendar-events-list" aria-label="Calendar events">
                            <li class="calendar-event-placeholder">Events will load from calendar...</li>
                        </ul>
                    </div>
                `;
            }
        },
        quote: {
            name: 'Quote of the Day',
            icon: '💬',
            description: 'Inspirational quote',
            fields: [
                { id: 'quote', label: 'Quote', type: 'textarea', default: 'Be the change you wish to see in the world.', placeholder: 'Enter the quote' },
                { id: 'author', label: 'Author', type: 'text', default: 'Mahatma Gandhi', placeholder: 'Who said this?' }
            ],
            render: (data) => `
                <div class="quote-slide">
                    <blockquote>"${escapeHtml(data.quote)}"</blockquote>
                    <cite>— ${escapeHtml(data.author)}</cite>
                </div>
            `
        },
        image: {
            name: 'Image Slide',
            icon: '🖼️',
            description: 'Display an image with optional caption',
            fields: [
                { id: 'imageUrl', label: 'Image', type: 'imageupload', default: '', placeholder: 'Upload or enter image URL' },
                { id: 'caption', label: 'Caption (optional)', type: 'text', default: '', placeholder: 'Enter image caption' }
            ],
            render: (data) => {
                const caption = data.caption ? `<p class="image-caption">${escapeHtml(data.caption)}</p>` : '';
                return `<div class="image-slide"><img src="${escapeHtml(data.imageUrl)}" alt="${escapeHtml(data.caption || 'Slide image')}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%23ddd%22 width=%22400%22 height=%22300%22/><text fill=%22%23999%22 x=%22200%22 y=%22150%22 text-anchor=%22middle%22>Image not found</text></svg>'">${caption}</div>`;
            }
        },
        richcontent: {
            name: 'Rich Content',
            icon: '✨',
            description: 'Create content with rich text editor',
            fields: [
                { id: 'title', label: 'Title', type: 'text', default: 'Announcement', placeholder: 'Enter slide title' },
                { id: 'content', label: 'Content', type: 'richtext', default: '<p>Click here to start editing...</p>', placeholder: 'Use the toolbar to format your content' }
            ],
            render: (data) => `
                <div class="rich-content-slide">
                    ${data.title ? `<h2>${escapeHtml(data.title)}</h2>` : ''}
                    <div class="rich-content">${sanitizeHtml(data.content)}</div>
                </div>
            `
        },
        custom: {
            name: 'Custom HTML',
            icon: '🔧',
            description: 'Advanced: Write your own HTML',
            fields: [
                { id: 'html', label: 'HTML Content', type: 'code', default: '<h2>Custom Slide</h2>\n<p>Your content here...</p>', placeholder: 'Enter HTML code' }
            ],
            render: (data) => data.html
        }
    };

    // ========================================
    // STATE
    // ========================================
    let slides = [];
    let selectedSlideIndex = -1;
    let draggedSlideIndex = -1;

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Sanitize HTML - allows safe formatting tags, removes dangerous ones
     */
    function sanitizeHtml(html) {
        if (!html) return '';

        // Use Utils.sanitizeHtml if available
        if (window.Utils && window.Utils.sanitizeHtml) {
            return window.Utils.sanitizeHtml(html);
        }

        // Fallback: Create a temporary element and sanitize
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Allowed tags whitelist
        const allowedTags = ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'div'];
        const allowedAttrs = ['href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height', 'target'];

        function cleanNode(node) {
            const children = Array.from(node.childNodes);
            children.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const tagName = child.tagName.toLowerCase();
                    if (!allowedTags.includes(tagName)) {
                        const text = document.createTextNode(child.textContent);
                        node.replaceChild(text, child);
                        return;
                    }
                    // Remove dangerous attributes
                    Array.from(child.attributes).forEach(attr => {
                        if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                            child.removeAttribute(attr.name);
                        }
                        if ((attr.name === 'href' || attr.name === 'src') && attr.value.toLowerCase().includes('javascript:')) {
                            child.removeAttribute(attr.name);
                        }
                    });
                    cleanNode(child);
                }
            });
        }

        cleanNode(temp);
        return temp.innerHTML;
    }

    function generateId() {
        return 'slide_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ========================================
    // SLIDE MANAGEMENT
    // ========================================
    function loadSlides() {
        const saved = localStorage.getItem('visualSlides');
        if (saved) {
            try {
                slides = JSON.parse(saved);
            } catch (e) {
                slides = getDefaultSlides();
            }
        } else {
            // Try to migrate from old format
            const oldSlides = localStorage.getItem('customSlides');
            if (oldSlides) {
                slides = migrateOldSlides(JSON.parse(oldSlides));
            } else {
                slides = getDefaultSlides();
            }
        }
        renderSlideList();
        if (slides.length > 0) {
            selectSlide(0);
        }
    }

    function getDefaultSlides() {
        return [
            {
                id: generateId(),
                template: 'welcome',
                data: { title: 'Good Morning!', subtitle: 'Welcome to Morning Announcements' }
            },
            {
                id: generateId(),
                template: 'events',
                data: {
                    title: "Today's Events",
                    events: [
                        { name: 'Student Council Meeting', time: '3:00 PM' },
                        { name: 'Basketball Practice', time: '4:00 PM' },
                        { name: 'Drama Club Rehearsal', time: '3:30 PM' }
                    ]
                }
            },
            {
                id: generateId(),
                template: 'bulletList',
                data: {
                    title: 'Important Reminders',
                    items: [
                        'Report cards available next week',
                        'Picture day retakes on Friday',
                        'Winter break begins December 23rd'
                    ]
                }
            }
        ];
    }

    function migrateOldSlides(oldSlides) {
        return oldSlides.map(slide => ({
            id: generateId(),
            template: 'custom',
            data: { html: slide.content }
        }));
    }

    function saveSlides() {
        // Update current slideshow's slides
        if (slideshows[currentSlideshowId]) {
            slideshows[currentSlideshowId].slides = slides;
        }

        // Save all slideshows
        saveSlideshows();

        showToast('Slides saved! Changes will appear on the display.', 'success');
    }

    // ========================================
    // RENDER FUNCTIONS
    // ========================================
    function renderSlideList() {
        const container = document.getElementById('slideListContainer');
        if (!container) return;

        if (slides.length === 0) {
            container.innerHTML = `
                <div class="no-slides-message">
                    <p>No slides yet!</p>
                    <p>Click "Add New Slide" to get started.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = slides.map((slide, index) => {
            const template = SLIDE_TEMPLATES[slide.template] || SLIDE_TEMPLATES.custom;
            const isSelected = index === selectedSlideIndex;
            return `
                <div class="slide-list-item ${isSelected ? 'selected' : ''}"
                     data-index="${index}"
                     draggable="true"
                     onclick="window.SlideEditor.selectSlide(${index})">
                    <div class="slide-list-drag-handle" title="Drag to reorder">⋮⋮</div>
                    <div class="slide-list-icon">${template.icon}</div>
                    <div class="slide-list-info">
                        <div class="slide-list-title">${escapeHtml(slide.data.title || slide.data.eventName || template.name)}</div>
                        <div class="slide-list-type">${template.name}</div>
                    </div>
                    <div class="slide-list-number">${index + 1}</div>
                </div>
            `;
        }).join('');

        // Add drag and drop handlers
        setupDragAndDrop();
    }

    function renderSlideEditor() {
        const container = document.getElementById('slideEditorContainer');
        if (!container) return;

        if (selectedSlideIndex < 0 || selectedSlideIndex >= slides.length) {
            container.innerHTML = `
                <div class="no-slide-selected">
                    <div class="no-slide-icon">👈</div>
                    <p>Select a slide from the list to edit it</p>
                    <p>or add a new slide to get started</p>
                </div>
            `;
            return;
        }

        const slide = slides[selectedSlideIndex];
        const template = SLIDE_TEMPLATES[slide.template] || SLIDE_TEMPLATES.custom;
        const schedule = getScheduleForSlide(slide.id) || {};

        container.innerHTML = `
            <div class="slide-editor-header">
                <div class="slide-editor-title">
                    <span class="slide-editor-icon">${template.icon}</span>
                    <span>Editing: ${template.name}</span>
                    ${schedule.enabled ? '<span class="schedule-badge">📅 Scheduled</span>' : ''}
                </div>
                <div class="slide-editor-actions">
                    <button class="btn btn-secondary btn-sm" onclick="window.SlideEditor.duplicateSlide(${selectedSlideIndex})">
                        Duplicate
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="window.SlideEditor.deleteSlide(${selectedSlideIndex})">
                        Delete
                    </button>
                </div>
            </div>

            <div class="slide-editor-fields">
                ${renderFields(template.fields, slide.data)}
            </div>

            <!-- Schedule Section -->
            <div class="slide-schedule-section">
                <h4>📅 Schedule</h4>
                <p class="schedule-help">Set when this slide should appear. Leave empty to always show.</p>

                <div class="schedule-toggle">
                    <label class="toggle-label">
                        <input type="checkbox" id="scheduleEnabled" ${schedule.enabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                        <span>Enable Schedule</span>
                    </label>
                </div>

                <div class="schedule-options" id="scheduleOptions" style="display: ${schedule.enabled ? 'block' : 'none'};">
                    <div class="schedule-row">
                        <div class="schedule-field">
                            <label for="scheduleStartDate">Start Date</label>
                            <input type="date" id="scheduleStartDate" class="form-input" value="${schedule.startDate || ''}">
                        </div>
                        <div class="schedule-field">
                            <label for="scheduleEndDate">End Date</label>
                            <input type="date" id="scheduleEndDate" class="form-input" value="${schedule.endDate || ''}">
                        </div>
                    </div>

                    <div class="schedule-row">
                        <div class="schedule-field">
                            <label for="scheduleStartTime">Start Time</label>
                            <input type="time" id="scheduleStartTime" class="form-input" value="${schedule.startTime || ''}">
                        </div>
                        <div class="schedule-field">
                            <label for="scheduleEndTime">End Time</label>
                            <input type="time" id="scheduleEndTime" class="form-input" value="${schedule.endTime || ''}">
                        </div>
                    </div>

                    <div class="schedule-field">
                        <label>Days of Week</label>
                        <div class="days-of-week">
                            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => `
                                <label class="day-checkbox">
                                    <input type="checkbox" value="${i}" ${(schedule.daysOfWeek || []).includes(i) ? 'checked' : ''}>
                                    <span>${day}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <button class="btn btn-primary btn-sm" id="saveScheduleBtn">Save Schedule</button>
                    <button class="btn btn-secondary btn-sm" id="clearScheduleBtn">Clear Schedule</button>
                </div>
            </div>

            <!-- Display Tags Section -->
            <div class="slide-tags-section">
                <h4>🏷️ Display Tags</h4>
                <p class="schedule-help">Choose which displays show this slide. Leave empty or use "all" to show on all displays.</p>

                <div class="form-group">
                    <label for="slideTargetTags">Target Tags</label>
                    <input type="text" id="slideTargetTags" class="form-input"
                           value="${(slide.targetTags || []).join(', ')}"
                           placeholder="e.g., gym, cafeteria (comma separated, or 'all')">
                    <small style="color: #6b7280;">Displays must have at least one matching tag to show this slide</small>
                </div>

                <button class="btn btn-primary btn-sm" id="saveTagsBtn">Save Tags</button>
            </div>

            <div class="slide-editor-preview">
                <h4>Preview</h4>
                <div class="slide-preview-frame">
                    <div class="slide-preview-content" id="slidePreviewContent">
                        ${template.render(slide.data)}
                    </div>
                </div>
            </div>
        `;

        // Add event listeners for field changes
        setupFieldListeners();
        setupScheduleListeners(slide.id);
        setupTagsListener();
    }

    function setupScheduleListeners(slideId) {
        const enabledCheckbox = document.getElementById('scheduleEnabled');
        const optionsDiv = document.getElementById('scheduleOptions');
        const saveBtn = document.getElementById('saveScheduleBtn');
        const clearBtn = document.getElementById('clearScheduleBtn');

        if (enabledCheckbox) {
            enabledCheckbox.addEventListener('change', () => {
                if (optionsDiv) {
                    optionsDiv.style.display = enabledCheckbox.checked ? 'block' : 'none';
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const schedule = {
                    enabled: document.getElementById('scheduleEnabled').checked,
                    startDate: document.getElementById('scheduleStartDate').value || null,
                    endDate: document.getElementById('scheduleEndDate').value || null,
                    startTime: document.getElementById('scheduleStartTime').value || null,
                    endTime: document.getElementById('scheduleEndTime').value || null,
                    daysOfWeek: Array.from(document.querySelectorAll('.days-of-week input:checked'))
                        .map(cb => parseInt(cb.value))
                };

                setScheduleForSlide(slideId, schedule);
                renderSlideList();
                showToast('Schedule saved!', 'success');
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                setScheduleForSlide(slideId, null);
                renderSlideEditor();
                renderSlideList();
                showToast('Schedule cleared!', 'success');
            });
        }
    }

    function setupTagsListener() {
        const saveTagsBtn = document.getElementById('saveTagsBtn');
        const tagsInput = document.getElementById('slideTargetTags');

        if (saveTagsBtn && tagsInput) {
            saveTagsBtn.addEventListener('click', () => {
                if (selectedSlideIndex < 0) return;

                const tagsValue = tagsInput.value.trim();
                const tags = tagsValue
                    ? tagsValue.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
                    : [];

                slides[selectedSlideIndex].targetTags = tags;
                saveSlides();
                showToast('Display tags saved!', 'success');
            });
        }
    }

    function renderFields(fields, data) {
        return fields.map(field => {
            const value = data[field.id] !== undefined ? data[field.id] : field.default;

            switch (field.type) {
                case 'text':
                    return `
                        <div class="editor-field">
                            <label for="field_${field.id}">${field.label}</label>
                            <input type="text"
                                   id="field_${field.id}"
                                   class="form-input field-input"
                                   data-field="${field.id}"
                                   value="${escapeHtml(value)}"
                                   placeholder="${field.placeholder || ''}">
                        </div>
                    `;

                case 'number':
                    return `
                        <div class="editor-field">
                            <label for="field_${field.id}">${field.label}</label>
                            <input type="number"
                                   id="field_${field.id}"
                                   class="form-input field-input"
                                   data-field="${field.id}"
                                   value="${escapeHtml(value)}"
                                   placeholder="${field.placeholder || ''}">
                        </div>
                    `;

                case 'date':
                    return `
                        <div class="editor-field">
                            <label for="field_${field.id}">${field.label}</label>
                            <input type="date"
                                   id="field_${field.id}"
                                   class="form-input field-input"
                                   data-field="${field.id}"
                                   value="${escapeHtml(value)}"
                                   placeholder="${field.placeholder || ''}">
                        </div>
                    `;

                case 'checkbox':
                    return `
                        <div class="editor-field editor-field-checkbox">
                            <label class="checkbox-label">
                                <input type="checkbox"
                                       id="field_${field.id}"
                                       class="field-checkbox"
                                       data-field="${field.id}"
                                       ${value ? 'checked' : ''}>
                                <span>${field.label}</span>
                            </label>
                        </div>
                    `;

                case 'textarea':
                    return `
                        <div class="editor-field">
                            <label for="field_${field.id}">${field.label}</label>
                            <textarea id="field_${field.id}"
                                      class="form-input field-input"
                                      data-field="${field.id}"
                                      rows="4"
                                      placeholder="${field.placeholder || ''}">${escapeHtml(value)}</textarea>
                        </div>
                    `;

                case 'richtext':
                    return `
                        <div class="editor-field">
                            <label>${field.label}</label>
                            <div class="quill-wrapper">
                                <div id="quill_${field.id}" class="quill-editor" data-field="${field.id}"></div>
                                <input type="hidden" id="field_${field.id}" class="field-input" data-field="${field.id}" value="${escapeHtml(value)}">
                            </div>
                            <small class="field-hint">Use the toolbar above to format text, add lists, and more</small>
                        </div>
                    `;

                case 'imageupload':
                    return `
                        <div class="editor-field">
                            <label for="field_${field.id}">${field.label}</label>
                            <div class="image-upload-wrapper">
                                <div class="image-preview-box" id="preview_${field.id}">
                                    ${value ? `<img src="${escapeHtml(value)}" alt="Preview">` : '<span class="preview-placeholder">No image selected</span>'}
                                </div>
                                <div class="image-upload-controls">
                                    <input type="file"
                                           id="file_${field.id}"
                                           class="image-file-input"
                                           data-field="${field.id}"
                                           accept="image/*">
                                    <label for="file_${field.id}" class="btn btn-primary btn-sm">
                                        Upload Image
                                    </label>
                                    <span class="upload-or">or</span>
                                    <input type="text"
                                           id="field_${field.id}"
                                           class="form-input field-input image-url-input"
                                           data-field="${field.id}"
                                           value="${escapeHtml(value)}"
                                           placeholder="Enter image URL">
                                </div>
                                <small class="field-hint">Upload an image or enter a URL. Max file size: 10MB</small>
                            </div>
                        </div>
                    `;

                case 'code':
                    return `
                        <div class="editor-field">
                            <label for="field_${field.id}">${field.label}</label>
                            <textarea id="field_${field.id}"
                                      class="form-input field-input code-input"
                                      data-field="${field.id}"
                                      rows="8"
                                      placeholder="${field.placeholder || ''}">${escapeHtml(value)}</textarea>
                            <small class="field-hint">⚠️ Advanced: HTML code will be rendered directly</small>
                        </div>
                    `;

                case 'simplelist':
                    return `
                        <div class="editor-field">
                            <label>${field.label}</label>
                            <div class="list-editor" data-field="${field.id}">
                                ${(value || []).map((item, i) => `
                                    <div class="list-item">
                                        <input type="text" class="form-input list-item-input" value="${escapeHtml(item)}" data-index="${i}">
                                        <button type="button" class="btn-icon btn-remove-item" onclick="window.SlideEditor.removeListItem('${field.id}', ${i})">✕</button>
                                    </div>
                                `).join('')}
                                <button type="button" class="btn btn-secondary btn-sm btn-add-item" onclick="window.SlideEditor.addListItem('${field.id}')">
                                    + Add Item
                                </button>
                            </div>
                        </div>
                    `;

                case 'eventlist':
                    return `
                        <div class="editor-field">
                            <label>${field.label}</label>
                            <div class="event-list-editor" data-field="${field.id}">
                                ${(value || []).map((event, i) => `
                                    <div class="event-item">
                                        <input type="text" class="form-input event-name-input" value="${escapeHtml(event.name)}" placeholder="Event name" data-index="${i}" data-prop="name">
                                        <input type="text" class="form-input event-time-input" value="${escapeHtml(event.time)}" placeholder="Time" data-index="${i}" data-prop="time">
                                        <button type="button" class="btn-icon btn-remove-item" onclick="window.SlideEditor.removeEventItem('${field.id}', ${i})">✕</button>
                                    </div>
                                `).join('')}
                                <button type="button" class="btn btn-secondary btn-sm btn-add-item" onclick="window.SlideEditor.addEventItem('${field.id}')">
                                    + Add Event
                                </button>
                            </div>
                        </div>
                    `;

                default:
                    return '';
            }
        }).join('');
    }

    function renderTemplateSelector() {
        const container = document.getElementById('templateSelectorModal');
        if (!container) return;

        const templateHtml = Object.entries(SLIDE_TEMPLATES).map(([key, template]) => `
            <div class="template-option" onclick="window.SlideEditor.addSlideFromTemplate('${key}')">
                <div class="template-icon">${template.icon}</div>
                <div class="template-info">
                    <div class="template-name">${template.name}</div>
                    <div class="template-desc">${template.description}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="modal-content template-selector-content">
                <div class="modal-header">
                    <h3>Choose a Slide Type</h3>
                    <button class="modal-close" onclick="window.SlideEditor.closeTemplateSelector()">&times;</button>
                </div>
                <div class="template-grid">
                    ${templateHtml}
                </div>
            </div>
        `;
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================
    function setupFieldListeners() {
        // Text and textarea inputs (debounced preview)
        document.querySelectorAll('.field-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const field = e.target.dataset.field;
                if (selectedSlideIndex >= 0 && field) {
                    slides[selectedSlideIndex].data[field] = e.target.value;
                    debouncedUpdatePreview();
                }
            });
        });

        // Checkbox inputs (update immediately)
        document.querySelectorAll('.field-checkbox').forEach(input => {
            input.addEventListener('change', (e) => {
                const field = e.target.dataset.field;
                if (selectedSlideIndex >= 0 && field) {
                    slides[selectedSlideIndex].data[field] = e.target.checked;
                    updatePreview();
                }
            });
        });

        // Simple list inputs (debounced preview)
        document.querySelectorAll('.list-item-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const listEditor = e.target.closest('.list-editor');
                const field = listEditor?.dataset.field;
                const index = parseInt(e.target.dataset.index);
                if (selectedSlideIndex >= 0 && field !== undefined && !isNaN(index)) {
                    slides[selectedSlideIndex].data[field][index] = e.target.value;
                    debouncedUpdatePreview();
                }
            });
        });

        // Event list inputs (debounced preview)
        document.querySelectorAll('.event-name-input, .event-time-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const listEditor = e.target.closest('.event-list-editor');
                const field = listEditor?.dataset.field;
                const index = parseInt(e.target.dataset.index);
                const prop = e.target.dataset.prop;
                if (selectedSlideIndex >= 0 && field !== undefined && !isNaN(index) && prop) {
                    slides[selectedSlideIndex].data[field][index][prop] = e.target.value;
                    debouncedUpdatePreview();
                }
            });
        });

        // Initialize Quill editors for richtext fields
        initializeQuillEditors();

        // Image upload handlers
        document.querySelectorAll('.image-file-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const fieldId = e.target.dataset.field;
                const file = e.target.files[0];

                if (!file) return;

                // Show loading state
                const previewBox = document.getElementById(`preview_${fieldId}`);
                if (previewBox) {
                    previewBox.innerHTML = '<span class="preview-placeholder">Uploading...</span>';
                }

                try {
                    const formData = new FormData();
                    formData.append('image', file);

                    const response = await fetch('/api/upload/image', {
                        method: 'POST',
                        headers: {
                            'X-Session-Token': window.SettingsAPI.getSessionToken()
                        },
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error('Upload failed');
                    }

                    const result = await response.json();

                    // Update the URL input and data
                    const urlInput = document.getElementById(`field_${fieldId}`);
                    if (urlInput) {
                        urlInput.value = result.url;
                        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    // Update preview
                    if (previewBox) {
                        previewBox.innerHTML = `<img src="${result.url}" alt="Preview">`;
                    }

                    showToast('Image uploaded successfully!', 'success');
                } catch (error) {
                    console.error('Upload failed:', error);
                    showToast('Failed to upload image', 'error');
                    if (previewBox) {
                        previewBox.innerHTML = '<span class="preview-placeholder">Upload failed</span>';
                    }
                }
            });
        });

        // URL input change - update preview
        document.querySelectorAll('.image-url-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const fieldId = e.target.dataset.field;
                const previewBox = document.getElementById(`preview_${fieldId}`);
                const url = e.target.value;

                if (previewBox) {
                    if (url) {
                        previewBox.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview" onerror="this.parentElement.innerHTML='<span class=\\'preview-placeholder\\'>Invalid image URL</span>'">`;
                    } else {
                        previewBox.innerHTML = '<span class="preview-placeholder">No image selected</span>';
                    }
                }
            });
        });
    }

    function setupDragAndDrop() {
        const items = document.querySelectorAll('.slide-list-item');

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedSlideIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedSlideIndex = -1;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const targetIndex = parseInt(item.dataset.index);
                if (draggedSlideIndex !== -1 && draggedSlideIndex !== targetIndex) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const targetIndex = parseInt(item.dataset.index);
                if (draggedSlideIndex !== -1 && draggedSlideIndex !== targetIndex) {
                    moveSlide(draggedSlideIndex, targetIndex);
                }
            });
        });
    }

    function updatePreview() {
        const previewContainer = document.getElementById('slidePreviewContent');
        if (!previewContainer || selectedSlideIndex < 0) return;

        const slide = slides[selectedSlideIndex];
        const template = SLIDE_TEMPLATES[slide.template] || SLIDE_TEMPLATES.custom;
        previewContainer.innerHTML = template.render(slide.data);
    }

    // Debounced preview update for input fields (150ms delay)
    const debouncedUpdatePreview = (function() {
        let timeout = null;
        const debounce = window.Utils?.debounce || function(func, wait) {
            let timeoutId = null;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), wait);
            };
        };
        return debounce(updatePreview, 150);
    })();

    // ========================================
    // SLIDE ACTIONS
    // ========================================
    function selectSlide(index) {
        selectedSlideIndex = index;
        renderSlideList();
        renderSlideEditor();
    }

    function addSlideFromTemplate(templateKey) {
        const template = SLIDE_TEMPLATES[templateKey];
        if (!template) return;

        // Build default data from template fields
        const data = {};
        template.fields.forEach(field => {
            data[field.id] = JSON.parse(JSON.stringify(field.default));
        });

        const newSlide = {
            id: generateId(),
            template: templateKey,
            data: data
        };

        slides.push(newSlide);
        closeTemplateSelector();
        renderSlideList();
        selectSlide(slides.length - 1);
        showToast('New slide added!', 'success');
    }

    function deleteSlide(index) {
        if (!confirm('Delete this slide?')) return;

        slides.splice(index, 1);

        if (selectedSlideIndex >= slides.length) {
            selectedSlideIndex = slides.length - 1;
        }

        renderSlideList();
        renderSlideEditor();
        showToast('Slide deleted!', 'success');
    }

    function duplicateSlide(index) {
        const original = slides[index];
        const duplicate = {
            id: generateId(),
            template: original.template,
            data: JSON.parse(JSON.stringify(original.data))
        };

        // Add "Copy" to the title if it exists
        if (duplicate.data.title) {
            duplicate.data.title += ' (Copy)';
        }

        slides.splice(index + 1, 0, duplicate);
        renderSlideList();
        selectSlide(index + 1);
        showToast('Slide duplicated!', 'success');
    }

    function moveSlide(fromIndex, toIndex) {
        const [slide] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, slide);

        // Update selected index
        if (selectedSlideIndex === fromIndex) {
            selectedSlideIndex = toIndex;
        } else if (fromIndex < selectedSlideIndex && toIndex >= selectedSlideIndex) {
            selectedSlideIndex--;
        } else if (fromIndex > selectedSlideIndex && toIndex <= selectedSlideIndex) {
            selectedSlideIndex++;
        }

        renderSlideList();
        showToast('Slide moved!', 'info');
    }

    function addListItem(fieldId) {
        if (selectedSlideIndex < 0) return;

        if (!slides[selectedSlideIndex].data[fieldId]) {
            slides[selectedSlideIndex].data[fieldId] = [];
        }
        slides[selectedSlideIndex].data[fieldId].push('New item');
        renderSlideEditor();
    }

    function removeListItem(fieldId, index) {
        if (selectedSlideIndex < 0) return;
        slides[selectedSlideIndex].data[fieldId].splice(index, 1);
        renderSlideEditor();
    }

    function addEventItem(fieldId) {
        if (selectedSlideIndex < 0) return;

        if (!slides[selectedSlideIndex].data[fieldId]) {
            slides[selectedSlideIndex].data[fieldId] = [];
        }
        slides[selectedSlideIndex].data[fieldId].push({ name: 'New Event', time: 'TBD' });
        renderSlideEditor();
    }

    function removeEventItem(fieldId, index) {
        if (selectedSlideIndex < 0) return;
        slides[selectedSlideIndex].data[fieldId].splice(index, 1);
        renderSlideEditor();
    }

    // ========================================
    // MODAL FUNCTIONS
    // ========================================
    function openTemplateSelector() {
        renderTemplateSelector();
        document.getElementById('templateSelectorModal').classList.add('active');
    }

    function closeTemplateSelector() {
        document.getElementById('templateSelectorModal').classList.remove('active');
    }

    // ========================================
    // UTILITY
    // ========================================
    function showToast(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    function resetToDefaults() {
        if (!confirm('Reset all slides to defaults? This will delete all your current slides.')) return;

        slides = getDefaultSlides();
        selectedSlideIndex = 0;
        saveSlides();
        renderSlideList();
        renderSlideEditor();
        showToast('Slides reset to defaults!', 'success');
    }

    // ========================================
    // INITIALIZATION
    // ========================================
    function init() {
        // Create the template selector modal if it doesn't exist
        if (!document.getElementById('templateSelectorModal')) {
            const modal = document.createElement('div');
            modal.id = 'templateSelectorModal';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        loadSchedules();

        // Load multiple slideshows instead of single slides
        loadSlideshows();

        // Set slides reference to current slideshow's slides
        slides = slideshows[currentSlideshowId]?.slides || [];

        renderTemplateSelector();

        // Set up button handlers
        const addSlideBtn = document.getElementById('addNewSlideBtn');
        if (addSlideBtn) {
            addSlideBtn.addEventListener('click', openTemplateSelector);
        }

        const saveBtn = document.getElementById('saveSlidesBtn2');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveSlides);
        }

        const resetBtn = document.getElementById('resetSlidesBtn2');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetToDefaults);
        }

        // Add slideshow button handler
        const addSlideshowBtn = document.getElementById('addSlideshowBtn');
        if (addSlideshowBtn) {
            addSlideshowBtn.addEventListener('click', addSlideshow);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Small delay to ensure other scripts have loaded
        setTimeout(init, 100);
    }

    // Expose public API
    window.SlideEditor = {
        selectSlide,
        addSlideFromTemplate,
        deleteSlide,
        duplicateSlide,
        addListItem,
        removeListItem,
        addEventItem,
        removeEventItem,
        openTemplateSelector,
        closeTemplateSelector,
        saveSlides,
        loadSlides,
        // Multiple slideshows support
        getSlideshowsList,
        getSlideshows: () => slideshows
    };

})();
