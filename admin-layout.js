/**
 * Admin Layout Editor - Dashboard Builder
 * Allows creating fully customizable grid-based layouts
 */

(function() {
    'use strict';

    // Grid configuration - 16:9 aspect ratio for TV displays
    const GRID_COLUMNS = 16;
    const GRID_ROWS = 9;
    const MIN_WIDGET_SIZE = { width: 2, height: 1 };

    // Widget type definitions - sizes optimized for 16:9 TV displays
    const WIDGET_TYPES = {
        slideshow: {
            name: 'Slideshow',
            icon: '📺',
            defaultSize: { width: 12, height: 7 },
            minSize: { width: 4, height: 3 },
            configFields: [
                { id: 'slideshowId', label: 'Slideshow', type: 'slideshow-select', default: 'default' },
                { id: 'interval', label: 'Slide Duration (ms)', type: 'number', default: 8000 },
                { id: 'transition', label: 'Transition', type: 'select', options: ['fade', 'slide', 'none'], default: 'fade' }
            ]
        },
        weather: {
            name: 'Weather',
            icon: '🌤️',
            defaultSize: { width: 4, height: 5 },
            minSize: { width: 3, height: 3 },
            configFields: [
                { id: 'showForecast', label: 'Show Forecast', type: 'checkbox', default: true },
                { id: 'units', label: 'Units', type: 'select', options: ['imperial', 'metric'], default: 'imperial' }
            ]
        },
        clock: {
            name: 'Clock',
            icon: '🕐',
            defaultSize: { width: 4, height: 2 },
            minSize: { width: 3, height: 1 },
            configFields: [
                { id: 'showDate', label: 'Show Date', type: 'checkbox', default: true },
                { id: 'showSeconds', label: 'Show Seconds', type: 'checkbox', default: false },
                { id: 'format24h', label: '24-Hour Format', type: 'checkbox', default: false }
            ]
        },
        'school-name': {
            name: 'School Name',
            icon: '🏫',
            defaultSize: { width: 8, height: 2 },
            minSize: { width: 4, height: 1 },
            configFields: [
                { id: 'fontSize', label: 'Font Size', type: 'select', options: ['small', 'medium', 'large', 'xlarge'], default: 'large' },
                { id: 'alignment', label: 'Alignment', type: 'select', options: ['left', 'center', 'right'], default: 'center' }
            ]
        },
        calendar: {
            name: 'Calendar',
            icon: '📅',
            defaultSize: { width: 4, height: 4 },
            minSize: { width: 3, height: 3 },
            configFields: [
                { id: 'daysAhead', label: 'Days to Show', type: 'number', default: 7 },
                { id: 'maxEvents', label: 'Max Events', type: 'number', default: 5 }
            ]
        },
        'bell-schedule': {
            name: 'Bell Schedule',
            icon: '🔔',
            defaultSize: { width: 4, height: 3 },
            minSize: { width: 3, height: 2 },
            configFields: [
                { id: 'showCountdown', label: 'Show Countdown', type: 'checkbox', default: true },
                { id: 'showNextPeriod', label: 'Show Next Period', type: 'checkbox', default: true }
            ]
        },
        dismissal: {
            name: 'Dismissal Queue',
            icon: '🚗',
            defaultSize: { width: 5, height: 5 },
            minSize: { width: 4, height: 3 },
            configFields: [
                { id: 'maxVisible', label: 'Max Visible', type: 'number', default: 10 },
                { id: 'fontSize', label: 'Font Size', type: 'select', options: ['small', 'medium', 'large'], default: 'medium' }
            ]
        },
        'custom-text': {
            name: 'Custom Text',
            icon: '📝',
            defaultSize: { width: 5, height: 2 },
            minSize: { width: 2, height: 1 },
            configFields: [
                { id: 'text', label: 'Text', type: 'textarea', default: 'Custom text here' },
                { id: 'fontSize', label: 'Font Size', type: 'select', options: ['small', 'medium', 'large', 'xlarge'], default: 'medium' },
                { id: 'color', label: 'Text Color', type: 'color', default: '#ffffff' },
                { id: 'alignment', label: 'Alignment', type: 'select', options: ['left', 'center', 'right'], default: 'center' }
            ]
        },
        'custom-html': {
            name: 'Custom HTML',
            icon: '</>',
            defaultSize: { width: 5, height: 3 },
            minSize: { width: 2, height: 2 },
            configFields: [
                { id: 'html', label: 'HTML Content', type: 'textarea', default: '<div style="padding: 1rem; color: white;">Custom HTML</div>' }
            ]
        },
        embed: {
            name: 'Embed',
            icon: '🔗',
            defaultSize: { width: 8, height: 5 },
            minSize: { width: 4, height: 3 },
            configFields: [
                { id: 'url', label: 'URL', type: 'url', default: '' },
                { id: 'allowFullscreen', label: 'Allow Fullscreen', type: 'checkbox', default: true }
            ]
        },
        image: {
            name: 'Image',
            icon: '🖼️',
            defaultSize: { width: 5, height: 4 },
            minSize: { width: 2, height: 2 },
            configFields: [
                { id: 'src', label: 'Image URL', type: 'url', default: '' },
                { id: 'objectFit', label: 'Fit', type: 'select', options: ['cover', 'contain', 'fill', 'none'], default: 'cover' },
                { id: 'alt', label: 'Alt Text', type: 'text', default: '' }
            ]
        }
    };

    // Layout presets
    const LAYOUT_PRESETS = {
        default: {
            name: 'Default',
            widgets: [
                { type: 'slideshow', x: 0, y: 0, width: 9, height: 5, config: {} },
                { type: 'weather', x: 9, y: 0, width: 3, height: 5, config: {} },
                { type: 'school-name', x: 0, y: 5, width: 6, height: 1, config: {} },
                { type: 'clock', x: 6, y: 5, width: 6, height: 1, config: { showDate: true } }
            ]
        },
        fullscreen: {
            name: 'Fullscreen Slideshow',
            widgets: [
                { type: 'slideshow', x: 0, y: 0, width: 12, height: 6, config: {} }
            ]
        },
        infoBoard: {
            name: 'Info Board',
            widgets: [
                { type: 'slideshow', x: 0, y: 0, width: 8, height: 4, config: {} },
                { type: 'weather', x: 8, y: 0, width: 4, height: 3, config: {} },
                { type: 'calendar', x: 8, y: 3, width: 4, height: 3, config: {} },
                { type: 'school-name', x: 0, y: 4, width: 4, height: 1, config: {} },
                { type: 'clock', x: 4, y: 4, width: 4, height: 1, config: { showDate: true } },
                { type: 'bell-schedule', x: 0, y: 5, width: 8, height: 1, config: {} }
            ]
        },
        minimal: {
            name: 'Minimal',
            widgets: [
                { type: 'slideshow', x: 0, y: 0, width: 12, height: 5, config: {} },
                { type: 'clock', x: 4, y: 5, width: 4, height: 1, config: { showDate: true } }
            ]
        },
        dismissalFocus: {
            name: 'Dismissal Focus',
            widgets: [
                { type: 'dismissal', x: 0, y: 0, width: 8, height: 6, config: { maxVisible: 15 } },
                { type: 'clock', x: 8, y: 0, width: 4, height: 2, config: { showDate: true } },
                { type: 'weather', x: 8, y: 2, width: 4, height: 4, config: {} }
            ]
        }
    };

    // State
    let widgets = [];
    let selectedWidgetId = null;
    let isDragging = false;
    let isResizing = false;
    let dragData = null;
    let gridElement = null;
    let nextWidgetId = 1;

    /**
     * Initialize the layout editor
     */
    function init() {
        renderEditor();
        loadSavedLayout();
        setupEventListeners();
    }

    /**
     * Render the layout editor UI
     */
    function renderEditor() {
        const container = document.getElementById('layoutContent');
        if (!container) return;

        container.innerHTML = `
            <div class="layout-editor-container">
                <div class="layout-editor-toolbar">
                    <button class="btn btn-primary" id="saveLayoutBtn">Save Layout</button>
                    <button class="btn btn-secondary" id="resetLayoutBtn">Reset to Default</button>
                    <button class="btn btn-danger" id="clearLayoutBtn">Clear All</button>
                    <button class="btn btn-info" id="previewLayoutBtn">Preview</button>
                </div>

                <div class="layout-editor-main">
                    <div class="widget-palette">
                        <h3>Widgets</h3>
                        <p class="palette-hint">Drag to grid or click to add</p>
                        <div class="widget-list" id="widgetList">
                            ${renderWidgetPalette()}
                        </div>

                        <h3>Presets</h3>
                        <div class="preset-list" id="presetList">
                            ${renderPresetList()}
                        </div>
                    </div>

                    <div class="grid-canvas-wrapper">
                        <div class="grid-info">12-column grid (${GRID_COLUMNS} x ${GRID_ROWS})</div>
                        <div class="grid-canvas" id="gridCanvas">
                            ${renderGridCells()}
                            <div class="grid-widgets" id="gridWidgets"></div>
                        </div>
                    </div>

                    <div class="widget-config-panel" id="widgetConfigPanel">
                        <h3>Widget Settings</h3>
                        <div class="config-content" id="configContent">
                            <p class="no-selection">Select a widget to configure</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        gridElement = document.getElementById('gridCanvas');
    }

    /**
     * Render widget palette items
     */
    function renderWidgetPalette() {
        return Object.entries(WIDGET_TYPES).map(([type, config]) => `
            <div class="palette-widget" draggable="true" data-widget-type="${type}">
                <span class="widget-icon">${config.icon}</span>
                <span class="widget-name">${config.name}</span>
            </div>
        `).join('');
    }

    /**
     * Render preset list
     */
    function renderPresetList() {
        return Object.entries(LAYOUT_PRESETS).map(([key, preset]) => `
            <button class="preset-btn" data-preset="${key}">${preset.name}</button>
        `).join('');
    }

    /**
     * Render grid cells for visual reference
     */
    function renderGridCells() {
        let html = '<div class="grid-cells">';
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLUMNS; col++) {
                html += `<div class="grid-cell" data-col="${col}" data-row="${row}"></div>`;
            }
        }
        html += '</div>';
        return html;
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        const container = document.getElementById('layoutContent');
        if (!container) return;

        // Widget palette drag
        container.querySelectorAll('.palette-widget').forEach(el => {
            el.addEventListener('dragstart', handlePaletteDragStart);
            el.addEventListener('click', handlePaletteClick);
        });

        // Preset buttons
        container.querySelectorAll('.preset-btn').forEach(el => {
            el.addEventListener('click', handlePresetClick);
        });

        // Grid drop zone
        const gridCanvas = document.getElementById('gridCanvas');
        if (gridCanvas) {
            gridCanvas.addEventListener('dragover', handleGridDragOver);
            gridCanvas.addEventListener('drop', handleGridDrop);
            gridCanvas.addEventListener('dragleave', handleGridDragLeave);
            gridCanvas.addEventListener('click', handleGridClick);
        }

        // Toolbar buttons
        document.getElementById('saveLayoutBtn')?.addEventListener('click', saveLayout);
        document.getElementById('resetLayoutBtn')?.addEventListener('click', () => applyPreset('default'));
        document.getElementById('clearLayoutBtn')?.addEventListener('click', clearLayout);
        document.getElementById('previewLayoutBtn')?.addEventListener('click', previewLayout);

        // Global mouse events for dragging/resizing
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    /**
     * Handle palette drag start
     */
    function handlePaletteDragStart(e) {
        const widgetType = e.target.closest('.palette-widget').dataset.widgetType;
        e.dataTransfer.setData('text/plain', widgetType);
        e.dataTransfer.effectAllowed = 'copy';
        dragData = { type: 'new', widgetType };
    }

    /**
     * Handle palette click (add widget)
     */
    function handlePaletteClick(e) {
        const widgetType = e.target.closest('.palette-widget').dataset.widgetType;
        addWidget(widgetType);
    }

    /**
     * Handle preset click
     */
    function handlePresetClick(e) {
        const presetKey = e.target.dataset.preset;
        if (presetKey && LAYOUT_PRESETS[presetKey]) {
            if (widgets.length > 0 && !confirm('This will replace your current layout. Continue?')) {
                return;
            }
            applyPreset(presetKey);
        }
    }

    /**
     * Handle grid drag over
     */
    function handleGridDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        showDropPreview(e);
    }

    /**
     * Handle grid drag leave
     */
    function handleGridDragLeave(e) {
        hideDropPreview();
    }

    /**
     * Handle grid drop
     */
    function handleGridDrop(e) {
        e.preventDefault();
        hideDropPreview();

        const widgetType = e.dataTransfer.getData('text/plain');
        if (!widgetType || !WIDGET_TYPES[widgetType]) return;

        const pos = getGridPosition(e);
        addWidgetAt(widgetType, pos.col, pos.row);
    }

    /**
     * Handle grid click (deselect)
     */
    function handleGridClick(e) {
        if (e.target.classList.contains('grid-cell') || e.target.classList.contains('grid-cells')) {
            selectWidget(null);
        }
    }

    /**
     * Get grid position from mouse event
     */
    function getGridPosition(e) {
        const rect = gridElement.getBoundingClientRect();
        const cellWidth = rect.width / GRID_COLUMNS;
        const cellHeight = rect.height / GRID_ROWS;

        const col = Math.floor((e.clientX - rect.left) / cellWidth);
        const row = Math.floor((e.clientY - rect.top) / cellHeight);

        return {
            col: Math.max(0, Math.min(col, GRID_COLUMNS - 1)),
            row: Math.max(0, Math.min(row, GRID_ROWS - 1))
        };
    }

    /**
     * Show drop preview
     */
    function showDropPreview(e) {
        const pos = getGridPosition(e);
        let preview = document.getElementById('dropPreview');

        if (!preview) {
            preview = document.createElement('div');
            preview.id = 'dropPreview';
            preview.className = 'drop-preview';
            document.getElementById('gridWidgets').appendChild(preview);
        }

        const widgetType = dragData?.widgetType;
        const config = WIDGET_TYPES[widgetType];
        const width = config?.defaultSize?.width || 3;
        const height = config?.defaultSize?.height || 2;

        preview.style.gridColumn = `${pos.col + 1} / span ${Math.min(width, GRID_COLUMNS - pos.col)}`;
        preview.style.gridRow = `${pos.row + 1} / span ${Math.min(height, GRID_ROWS - pos.row)}`;
        preview.style.display = 'block';
        preview.textContent = config?.name || 'Widget';
    }

    /**
     * Hide drop preview
     */
    function hideDropPreview() {
        const preview = document.getElementById('dropPreview');
        if (preview) preview.style.display = 'none';
    }

    /**
     * Add widget at default position
     */
    function addWidget(type) {
        const pos = findEmptyPosition(type);
        if (pos) {
            addWidgetAt(type, pos.col, pos.row);
        } else {
            showToast('No space available. Remove some widgets first.', 'error');
        }
    }

    /**
     * Add widget at specific position
     */
    function addWidgetAt(type, col, row) {
        const config = WIDGET_TYPES[type];
        if (!config) return;

        const widget = {
            id: `widget-${nextWidgetId++}`,
            type,
            x: col,
            y: row,
            width: Math.min(config.defaultSize.width, GRID_COLUMNS - col),
            height: Math.min(config.defaultSize.height, GRID_ROWS - row),
            config: {}
        };

        // Apply default config values
        config.configFields.forEach(field => {
            widget.config[field.id] = field.default;
        });

        widgets.push(widget);
        renderWidgets();
        selectWidget(widget.id);
    }

    /**
     * Find empty position for widget
     */
    function findEmptyPosition(type) {
        const config = WIDGET_TYPES[type];
        const width = config.defaultSize.width;
        const height = config.defaultSize.height;

        for (let row = 0; row <= GRID_ROWS - height; row++) {
            for (let col = 0; col <= GRID_COLUMNS - width; col++) {
                if (!hasOverlap(col, row, width, height)) {
                    return { col, row };
                }
            }
        }
        return null;
    }

    /**
     * Check if position overlaps with existing widgets
     */
    function hasOverlap(x, y, width, height, excludeId = null) {
        return widgets.some(w => {
            if (w.id === excludeId) return false;
            return !(x + width <= w.x || x >= w.x + w.width ||
                    y + height <= w.y || y >= w.y + w.height);
        });
    }

    /**
     * Render all widgets on grid
     */
    function renderWidgets() {
        const container = document.getElementById('gridWidgets');
        if (!container) return;

        // Keep drop preview if exists
        const dropPreview = document.getElementById('dropPreview');

        container.innerHTML = widgets.map(widget => {
            const config = WIDGET_TYPES[widget.type];
            const isSelected = widget.id === selectedWidgetId;

            return `
                <div class="grid-widget ${isSelected ? 'selected' : ''}"
                     id="${widget.id}"
                     data-widget-id="${widget.id}"
                     style="grid-column: ${widget.x + 1} / span ${widget.width}; grid-row: ${widget.y + 1} / span ${widget.height};">
                    <div class="widget-header" data-widget-id="${widget.id}">
                        <span class="widget-icon">${config.icon}</span>
                        <span class="widget-title">${config.name}</span>
                        <button class="widget-delete" data-widget-id="${widget.id}">&times;</button>
                    </div>
                    <div class="widget-preview">
                        ${getWidgetPreview(widget)}
                    </div>
                    <div class="widget-size">${widget.width}x${widget.height}</div>
                    <div class="resize-handle resize-se" data-widget-id="${widget.id}" data-direction="se"></div>
                    <div class="resize-handle resize-e" data-widget-id="${widget.id}" data-direction="e"></div>
                    <div class="resize-handle resize-s" data-widget-id="${widget.id}" data-direction="s"></div>
                </div>
            `;
        }).join('');

        // Re-append drop preview
        if (dropPreview) container.appendChild(dropPreview);

        // Add event listeners to widgets
        container.querySelectorAll('.grid-widget').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('widget-delete') && !e.target.classList.contains('resize-handle')) {
                    e.stopPropagation();
                    selectWidget(el.dataset.widgetId);
                }
            });
        });

        container.querySelectorAll('.widget-delete').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteWidget(el.dataset.widgetId);
            });
        });

        container.querySelectorAll('.resize-handle').forEach(el => {
            el.addEventListener('mousedown', handleResizeStart);
        });

        container.querySelectorAll('.widget-header').forEach(el => {
            el.addEventListener('mousedown', handleMoveStart);
        });
    }

    /**
     * Get widget preview content
     */
    function getWidgetPreview(widget) {
        switch (widget.type) {
            case 'slideshow':
                return '<div class="preview-slideshow"><div class="preview-slide-icon">▶</div>Slideshow</div>';
            case 'weather':
                return '<div class="preview-weather"><span class="preview-temp">72°F</span><span class="preview-icon">🌤️</span></div>';
            case 'clock':
                return '<div class="preview-clock">10:30 AM</div>';
            case 'school-name':
                return '<div class="preview-school">School Name</div>';
            case 'calendar':
                return '<div class="preview-calendar"><div>📅 Upcoming Events</div></div>';
            case 'bell-schedule':
                return '<div class="preview-bell"><div>🔔 Period 3</div><div class="preview-time">25 min left</div></div>';
            case 'dismissal':
                return '<div class="preview-dismissal"><div>🚗 Dismissal Queue</div></div>';
            case 'custom-text':
                return `<div class="preview-text">${escapeHtml(widget.config.text || 'Custom Text')}</div>`;
            case 'custom-html':
                return '<div class="preview-html">&lt;/&gt; HTML Content</div>';
            case 'embed':
                return '<div class="preview-embed">🔗 Embedded Content</div>';
            case 'image':
                return widget.config.src ?
                    `<img src="${escapeHtml(widget.config.src)}" class="preview-image" alt="">` :
                    '<div class="preview-image-placeholder">🖼️ Image</div>';
            default:
                return '<div class="preview-default">Widget</div>';
        }
    }

    /**
     * Select a widget
     */
    function selectWidget(widgetId) {
        selectedWidgetId = widgetId;
        renderWidgets();
        renderConfigPanel();
    }

    /**
     * Delete a widget
     */
    function deleteWidget(widgetId) {
        widgets = widgets.filter(w => w.id !== widgetId);
        if (selectedWidgetId === widgetId) {
            selectedWidgetId = null;
        }
        renderWidgets();
        renderConfigPanel();
    }

    /**
     * Render configuration panel
     */
    function renderConfigPanel() {
        const container = document.getElementById('configContent');
        if (!container) return;

        if (!selectedWidgetId) {
            container.innerHTML = '<p class="no-selection">Select a widget to configure</p>';
            return;
        }

        const widget = widgets.find(w => w.id === selectedWidgetId);
        if (!widget) return;

        const config = WIDGET_TYPES[widget.type];

        container.innerHTML = `
            <div class="config-header">
                <span class="widget-icon">${config.icon}</span>
                <span class="widget-type">${config.name}</span>
            </div>

            <div class="config-section">
                <h4>Position & Size</h4>
                <div class="config-grid">
                    <label>X: <input type="number" id="config-x" value="${widget.x}" min="0" max="${GRID_COLUMNS - 1}"></label>
                    <label>Y: <input type="number" id="config-y" value="${widget.y}" min="0" max="${GRID_ROWS - 1}"></label>
                    <label>Width: <input type="number" id="config-width" value="${widget.width}" min="${config.minSize.width}" max="${GRID_COLUMNS}"></label>
                    <label>Height: <input type="number" id="config-height" value="${widget.height}" min="${config.minSize.height}" max="${GRID_ROWS}"></label>
                </div>
            </div>

            <div class="config-section">
                <h4>Options</h4>
                ${config.configFields.map(field => renderConfigField(field, widget.config[field.id])).join('')}
            </div>

            <button class="btn btn-danger btn-sm" id="deleteWidgetBtn">Delete Widget</button>
        `;

        // Add event listeners
        ['x', 'y', 'width', 'height'].forEach(prop => {
            document.getElementById(`config-${prop}`)?.addEventListener('change', (e) => {
                updateWidgetPosition(prop, parseInt(e.target.value));
            });
        });

        config.configFields.forEach(field => {
            const el = document.getElementById(`config-${field.id}`);
            if (el) {
                el.addEventListener('change', (e) => {
                    updateWidgetConfig(field.id, field.type === 'checkbox' ? e.target.checked : e.target.value);
                });
            }
        });

        document.getElementById('deleteWidgetBtn')?.addEventListener('click', () => {
            deleteWidget(selectedWidgetId);
        });
    }

    /**
     * Render config field
     */
    function renderConfigField(field, value) {
        const currentValue = value !== undefined ? value : field.default;

        switch (field.type) {
            case 'checkbox':
                return `
                    <label class="config-checkbox">
                        <input type="checkbox" id="config-${field.id}" ${currentValue ? 'checked' : ''}>
                        ${field.label}
                    </label>
                `;
            case 'select':
                return `
                    <label class="config-select">
                        ${field.label}:
                        <select id="config-${field.id}">
                            ${field.options.map(opt => `<option value="${opt}" ${currentValue === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </label>
                `;
            case 'slideshow-select':
                // Dynamic slideshow selection
                const slideshows = window.SlideEditor?.getSlideshowsList?.() || [{ id: 'default', name: 'Main Slideshow' }];
                return `
                    <label class="config-select">
                        ${field.label}:
                        <select id="config-${field.id}">
                            ${slideshows.map(s => `<option value="${s.id}" ${currentValue === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
                        </select>
                    </label>
                `;
            case 'number':
                return `
                    <label class="config-number">
                        ${field.label}:
                        <input type="number" id="config-${field.id}" value="${currentValue}">
                    </label>
                `;
            case 'color':
                return `
                    <label class="config-color">
                        ${field.label}:
                        <input type="color" id="config-${field.id}" value="${currentValue}">
                    </label>
                `;
            case 'textarea':
                return `
                    <label class="config-textarea">
                        ${field.label}:
                        <textarea id="config-${field.id}" rows="3">${escapeHtml(currentValue)}</textarea>
                    </label>
                `;
            case 'url':
            case 'text':
            default:
                return `
                    <label class="config-text">
                        ${field.label}:
                        <input type="${field.type === 'url' ? 'url' : 'text'}" id="config-${field.id}" value="${escapeHtml(currentValue)}">
                    </label>
                `;
        }
    }

    /**
     * Update widget position/size
     */
    function updateWidgetPosition(prop, value) {
        const widget = widgets.find(w => w.id === selectedWidgetId);
        if (!widget) return;

        const config = WIDGET_TYPES[widget.type];
        widget[prop] = value;

        // Clamp to grid bounds
        widget.x = Math.max(0, Math.min(widget.x, GRID_COLUMNS - widget.width));
        widget.y = Math.max(0, Math.min(widget.y, GRID_ROWS - widget.height));
        widget.width = Math.max(config.minSize.width, Math.min(widget.width, GRID_COLUMNS - widget.x));
        widget.height = Math.max(config.minSize.height, Math.min(widget.height, GRID_ROWS - widget.y));

        renderWidgets();
        renderConfigPanel();
    }

    /**
     * Update widget config
     */
    function updateWidgetConfig(key, value) {
        const widget = widgets.find(w => w.id === selectedWidgetId);
        if (!widget) return;

        widget.config[key] = value;
        renderWidgets();
    }

    /**
     * Handle resize start
     */
    function handleResizeStart(e) {
        e.preventDefault();
        e.stopPropagation();

        const widgetId = e.target.dataset.widgetId;
        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;

        isResizing = true;
        dragData = {
            widgetId,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: widget.width,
            startHeight: widget.height,
            direction: e.target.dataset.direction
        };

        selectWidget(widgetId);
        document.body.style.cursor = e.target.dataset.direction === 'e' ? 'ew-resize' :
                                     e.target.dataset.direction === 's' ? 'ns-resize' : 'nwse-resize';
    }

    /**
     * Handle move start
     */
    function handleMoveStart(e) {
        if (e.target.classList.contains('widget-delete')) return;

        e.preventDefault();
        e.stopPropagation();

        const widgetId = e.target.closest('.widget-header')?.dataset.widgetId;
        if (!widgetId) return;

        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;

        isDragging = true;
        dragData = {
            widgetId,
            startX: e.clientX,
            startY: e.clientY,
            startCol: widget.x,
            startRow: widget.y
        };

        selectWidget(widgetId);
        document.body.style.cursor = 'move';
    }

    /**
     * Handle mouse move
     */
    function handleMouseMove(e) {
        if (!isDragging && !isResizing) return;
        if (!gridElement) return;

        const rect = gridElement.getBoundingClientRect();
        const cellWidth = rect.width / GRID_COLUMNS;
        const cellHeight = rect.height / GRID_ROWS;

        const widget = widgets.find(w => w.id === dragData.widgetId);
        if (!widget) return;

        const config = WIDGET_TYPES[widget.type];

        if (isDragging) {
            const deltaX = e.clientX - dragData.startX;
            const deltaY = e.clientY - dragData.startY;

            const colDelta = Math.round(deltaX / cellWidth);
            const rowDelta = Math.round(deltaY / cellHeight);

            const newX = Math.max(0, Math.min(dragData.startCol + colDelta, GRID_COLUMNS - widget.width));
            const newY = Math.max(0, Math.min(dragData.startRow + rowDelta, GRID_ROWS - widget.height));

            if (!hasOverlap(newX, newY, widget.width, widget.height, widget.id)) {
                widget.x = newX;
                widget.y = newY;
                renderWidgets();
            }
        }

        if (isResizing) {
            const deltaX = e.clientX - dragData.startX;
            const deltaY = e.clientY - dragData.startY;

            const minWidth = config.minSize.width;
            const minHeight = config.minSize.height;

            if (dragData.direction === 'e' || dragData.direction === 'se') {
                const colDelta = Math.round(deltaX / cellWidth);
                const newWidth = Math.max(minWidth, Math.min(dragData.startWidth + colDelta, GRID_COLUMNS - widget.x));
                if (!hasOverlap(widget.x, widget.y, newWidth, widget.height, widget.id)) {
                    widget.width = newWidth;
                }
            }

            if (dragData.direction === 's' || dragData.direction === 'se') {
                const rowDelta = Math.round(deltaY / cellHeight);
                const newHeight = Math.max(minHeight, Math.min(dragData.startHeight + rowDelta, GRID_ROWS - widget.y));
                if (!hasOverlap(widget.x, widget.y, widget.width, newHeight, widget.id)) {
                    widget.height = newHeight;
                }
            }

            renderWidgets();
        }
    }

    /**
     * Handle mouse up
     */
    function handleMouseUp() {
        // Only re-render config panel if we were actually dragging/resizing
        const wasDraggingOrResizing = isDragging || isResizing;

        isDragging = false;
        isResizing = false;
        dragData = null;
        document.body.style.cursor = '';

        // Only update config panel if position/size changed from drag/resize
        if (wasDraggingOrResizing) {
            renderConfigPanel();
        }
    }

    /**
     * Apply preset
     */
    function applyPreset(presetKey) {
        const preset = LAYOUT_PRESETS[presetKey];
        if (!preset) return;

        widgets = preset.widgets.map((w, i) => ({
            id: `widget-${nextWidgetId++}`,
            ...w
        }));

        selectedWidgetId = null;
        renderWidgets();
        renderConfigPanel();
        showToast(`Applied "${preset.name}" preset`, 'success');
    }

    /**
     * Clear layout
     */
    function clearLayout() {
        if (confirm('Are you sure you want to remove all widgets?')) {
            widgets = [];
            selectedWidgetId = null;
            renderWidgets();
            renderConfigPanel();
        }
    }

    /**
     * Save layout
     */
    async function saveLayout() {
        try {
            const layoutData = {
                gridLayout: {
                    columns: GRID_COLUMNS,
                    rows: GRID_ROWS,
                    gap: 16,
                    widgets: widgets.map(w => ({
                        id: w.id,
                        type: w.type,
                        x: w.x,
                        y: w.y,
                        width: w.width,
                        height: w.height,
                        config: w.config
                    }))
                }
            };

            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': window.SettingsAPI?.getSessionToken() || ''
                },
                body: JSON.stringify(layoutData)
            });

            if (response.ok) {
                showToast('Layout saved successfully!', 'success');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('Failed to save layout:', error);
            showToast('Failed to save layout', 'error');
        }
    }

    /**
     * Load saved layout
     */
    async function loadSavedLayout() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();

            if (settings.gridLayout && settings.gridLayout.widgets && settings.gridLayout.widgets.length > 0) {
                widgets = settings.gridLayout.widgets.map(w => ({
                    ...w,
                    id: w.id || `widget-${nextWidgetId++}`
                }));

                // Update nextWidgetId
                widgets.forEach(w => {
                    const match = w.id.match(/widget-(\d+)/);
                    if (match) {
                        nextWidgetId = Math.max(nextWidgetId, parseInt(match[1]) + 1);
                    }
                });

                renderWidgets();
            } else {
                // Apply default preset if no saved layout
                applyPreset('default');
            }
        } catch (error) {
            console.error('Failed to load layout:', error);
            applyPreset('default');
        }
    }

    /**
     * Preview layout
     */
    function previewLayout() {
        // Save first, then open
        saveLayout().then(() => {
            window.open('/', '_blank');
        });
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
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    // Initialize when tab is shown
    document.addEventListener('DOMContentLoaded', () => {
        // Check if layout tab exists and add click handler
        const layoutTab = document.querySelector('[data-tab="layout"]');
        if (layoutTab) {
            layoutTab.addEventListener('click', () => {
                setTimeout(init, 100);
            });
        }

        // Initialize if already on layout tab
        const layoutContent = document.getElementById('layoutContent');
        if (layoutContent && layoutContent.offsetParent !== null) {
            init();
        }
    });

    // Expose for external use
    window.LayoutEditor = {
        init,
        getWidgets: () => widgets,
        setWidgets: (w) => { widgets = w; renderWidgets(); },
        save: saveLayout,
        applyPreset
    };

})();
