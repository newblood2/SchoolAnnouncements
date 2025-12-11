# Admin Panel Guide

## Accessing the Admin Panel

Navigate to `/admin.html` to access the admin panel.

**Default Password:** `admin123`

**SECURITY WARNING:** Change this password immediately in `config.js` (line 55):

```javascript
ADMIN_PASSWORD: 'your-secure-password-here'
```

**Note:** The password is stored in plaintext in `config.js` since this is a client-side application. For production use with sensitive data, consider implementing server-side authentication.

## Features

### 1. Color Theme Editor

Customize the visual appearance of your school announcements display with powerful theming options.

#### Preset Themes

Choose from 6 professionally designed preset themes:
- **Default Blue** - Professional blue gradient
- **Sunset Orange** - Warm orange gradient
- **Forest Green** - Natural green tones
- **Purple Dream** - Rich purple gradient
- **Deep Ocean** - Dark oceanic blue
- **Royal Crimson** - Bold purple and blue

#### Custom Color Zones

Fine-tune 5 different color zones:

1. **Background Gradient Start** - Left side of gradient
2. **Background Gradient End** - Right side of gradient
3. **Main Content Panel** - Slideshow/livestream area (color + opacity)
4. **Weather Panel** - Right sidebar (color + opacity)
5. **Bottom Panel** - School name and date/time bar (color + opacity)
6. **Accent Color** - Highlighting and bullet points

#### Saving Custom Themes

1. Adjust colors to your preference
2. Click **"Apply Theme"** to preview changes
3. Click **"Save as Custom Theme"** to save permanently
4. Name your theme for easy reuse
5. Load saved themes from the "Custom Themes" section

#### Applying Changes

- Click **"Apply Theme"** to save to localStorage
- Refresh the main display (`index.html`) to see changes
- Changes persist across browser sessions

### 2. Slide Content Editor

Edit the HTML content of your announcement slides.

#### Slide Modes

- **HTML Slides** - Edit slides directly in the admin panel
- **Image Slides** - Use images from the `slides/` folder (configured in `slides.json`)

#### Managing HTML Slides

1. Click on any slide to edit its HTML content
2. Use standard HTML tags:
   - `<h1>` - Large headings
   - `<h2>` - Medium headings
   - `<p>` - Paragraphs
   - `<ul><li>` - Bulleted lists
3. Click **"Add New Slide"** to create additional slides
4. Click **"Delete Slide"** to remove unwanted slides
5. Click **"Save All Slides"** to apply changes

#### Example Slide HTML

```html
<h2>Today's Events</h2>
<ul>
    <li>Basketball Game - 6:00 PM</li>
    <li>Band Concert - 7:30 PM</li>
    <li>PTA Meeting - 8:00 PM</li>
</ul>
```

#### Resetting Slides

Click **"Reset to Default"** to restore original slide content.

### 3. Livestream Configuration

Control livestream display settings.

#### Enable/Disable Livestream

Use the toggle switch to enable or disable livestream functionality.

#### Livestream URL

Enter your livestream URL:
- **YouTube Live:** `https://www.youtube.com/embed/YOUR_VIDEO_ID`
- **OBS/RTMP:** `http://192.168.1.100:8080/stream.m3u8`
- Any iframe-compatible video source

#### Auto-Detection

Enable **"Auto-detect when livestream is online"** to automatically switch between slides and livestream.

#### Check Interval

Set how often (in seconds) the system checks if the stream is online:
- Minimum: 10 seconds
- Maximum: 300 seconds (5 minutes)
- Recommended: 60 seconds (default)

### 4. General Settings

Configure basic display settings.

#### School Name

Change the school/district name displayed in the bottom-left corner.

#### Slideshow Interval

Set how long each slide displays:
- Minimum: 3 seconds
- Maximum: 60 seconds
- Default: 8 seconds

## Workflow

### Typical Setup Process

1. **Login** to admin panel with password
2. **Choose a theme** from presets or customize colors
3. **Apply and save** your theme
4. **Edit slide content** for your announcements
5. **Save slides**
6. **Configure livestream** if needed
7. **Save general settings** (school name, timing)
8. **Refresh main display** to see all changes

### Daily Updates

1. Navigate to `/admin.html`
2. Login with password
3. Go to **"Slide Editor"** tab
4. Update slide content for today's announcements
5. Click **"Save All Slides"**
6. Main display updates automatically on next cycle

## Technical Details

### Storage

All settings are saved to browser `localStorage`:
- `customTheme` - Current active theme
- `customThemes` - Array of saved custom themes
- `customSlides` - HTML slide content
- `livestreamConfig` - Livestream settings
- `generalConfig` - School name and intervals
- `USE_IMAGE_SLIDES` - Slide mode (HTML vs images)

### Applying Changes

The `theme-loader.js` module automatically loads and applies saved settings when the main display loads. Changes take effect immediately upon page refresh.

### Session Security

Admin login is session-based:
- Password is validated against `config.js`
- Session expires when browser tab closes
- No cookies or persistent login
- Password is stored in plaintext in config (consider server-side auth for production)

## Tips & Best Practices

### Color Themes

- Maintain good contrast ratios for readability (minimum 4.5:1)
- Test themes on your actual TV display
- Consider lighting conditions in your classroom
- Use semi-transparent panels (10-40% opacity) for best effect

### Slides

- Keep text concise and readable from 25+ feet away
- Use bullet points for easier scanning
- Limit to 3-5 items per slide for clarity
- Test font sizes on actual display

### Livestream

- Use wired network connection for reliability
- Test stream URL before important events
- Set check interval based on expected stream duration
- Have backup slides ready in case stream fails

### General

- Take screenshots of working configurations
- Document your custom themes with descriptive names
- Regularly backup `localStorage` data if possible
- Change default admin password immediately

## Troubleshooting

### Changes Not Appearing

1. Ensure you clicked **"Save"** buttons in admin panel
2. **Hard refresh** main display (Ctrl+F5 or Cmd+Shift+R)
3. Check browser console for errors
4. Clear browser cache if issues persist

### Theme Not Loading

1. Verify theme was saved (check Custom Themes list)
2. Check browser localStorage in DevTools
3. Reset to default theme and reapply
4. Ensure no conflicting CSS in custom slides

### Slides Not Updating

1. Confirm slide mode (HTML vs Images)
2. Check that slides were saved
3. Verify HTML syntax is valid
4. Look for JavaScript errors in console

### Livestream Issues

1. Test URL in separate browser tab
2. Check network connectivity
3. Verify stream is actually online
4. Review CORS policies for external streams

## Support

For issues or feature requests, check the main project documentation or contact your IT administrator.
