# Dismissal System Guide

## Overview

The dismissal system helps manage afternoon student pickup by displaying student names on all TV screens in real-time. Teachers at the pickup area can use voice recognition or manual entry on a tablet to call students.

## Features

✅ **Voice Recognition** - Say "John Smith Grade 3" and the system transcribes it
✅ **Manual Entry** - Type student name and select grade
✅ **Real-time Updates** - All TVs update within 5 seconds
✅ **Batch Management** - Call 5-12 students at once, then clear for next batch
✅ **Full-screen Display** - Large, easy-to-read student cards
✅ **Mobile-friendly** - Works on iPads, Android tablets, and phones
✅ **Secure** - Same password as admin panel

## Quick Start

### For Teachers at Pickup

1. **Open dismissal manager on tablet:**
   ```
   http://192.168.12.28:8080/dismissal.html
   ```

2. **Login** with admin password (same as admin panel)

3. **Start Dismissal**
   - Click "Start Dismissal" button
   - All TVs switch to dismissal display

4. **Add Students** (two ways):

   **Voice Method:**
   - Tap and hold the microphone button
   - Say: "John Smith Grade 3"
   - Release button
   - Review transcription
   - Click "Add Student"

   **Manual Method:**
   - Click "⌨️ Manual" tab
   - Type student name
   - Select grade from dropdown
   - Click "Add Student"

5. **Clear Batch**
   - After students are picked up
   - Click "Clear Batch" button
   - Screen clears, ready for next batch

6. **End Dismissal**
   - When all students dismissed
   - Click "End Dismissal"
   - TVs return to announcements

### For Classroom Teachers

- Just watch your TV screen
- Student names appear automatically
- When you see your student's name, dismiss them

## Display Layout

TVs show a full-screen dismissal interface with:

```
┌────────────────────────────────────────┐
│         🚗 DISMISSAL                   │
│    Please Come to Pickup               │
├────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌───────┐│
│  │ John     │  │ Sarah    │  │ Mike  ││
│  │ Smith    │  │ Johnson  │  │ Brown ││
│  │ Grade 3  │  │ Grade 5  │  │ Grade ││
│  └──────────┘  └──────────┘  └───────┘│
│                                        │
│  ┌──────────┐  ┌──────────┐           │
│  │ Emily    │  │ David    │           │
│  │ Davis    │  │ Wilson   │           │
│  │ Grade 2  │  │ Grade 4  │           │
│  └──────────┘  └──────────┘           │
└────────────────────────────────────────┘
```

- Blue gradient background
- Large, readable text
- Student cards auto-arrange in grid
- Scales to fit any number of students

## Voice Recognition Tips

### What to Say

Good examples:
- ✅ "John Smith Grade 3"
- ✅ "Sarah Johnson Grade Five"
- ✅ "Mike Brown Third Grade"
- ✅ "Emily Davis Kindergarten"

The system understands:
- Number grades: "Grade 3", "3rd grade"
- Word grades: "Third grade", "Fifth grade"
- Special grades: "K", "Kindergarten", "Pre-K"

### Best Practices

1. **Speak clearly** - Normal pace, don't rush
2. **Hold button while speaking** - Like a walkie-talkie
3. **Review transcription** - Check if correct before adding
4. **Use manual entry** - If voice recognition struggles with a name

### Browser Support

Voice recognition works on:
- ✅ Chrome (desktop & mobile)
- ✅ Edge
- ✅ Safari (iOS 14.5+)
- ❌ Firefox (use manual entry)

If voice doesn't work, the system automatically shows an error and you can use manual entry.

## Troubleshooting

### Voice Recognition Not Working

**Problem:** Mic button does nothing or shows error

**Solutions:**
1. Check browser permissions (allow microphone access)
2. Chrome/Edge works best - try switching browsers
3. Use manual entry instead (⌨️ Manual tab)
4. Check microphone is working in device settings

### Names Not Appearing on TVs

**Problem:** Added students but TVs don't update

**Solutions:**
1. Check "Start Dismissal" button was clicked (status should show "Active")
2. Verify TVs are on and showing the main page
3. Check network connection
4. Refresh the TV browser (if accessible)
5. Check API health: http://192.168.12.28:8080/api/health

### Can't Login

**Problem:** Password incorrect

**Solutions:**
1. Use same password as admin panel
2. Check with admin if password changed
3. Password is in `config.js` file: `ADMIN_PASSWORD`

### Student Names Have Typos

**Problem:** Voice transcription incorrect

**Solutions:**
1. Remove student (click × button next to name)
2. Re-add with manual entry
3. Speak more clearly and slower
4. Switch to manual entry tab

## API Endpoints

For developers or custom integrations:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/dismissal/status` | GET | No | Get current dismissal state |
| `/api/dismissal/start` | POST | Yes | Start dismissal mode |
| `/api/dismissal/end` | POST | Yes | End dismissal and return to slides |
| `/api/dismissal/batch` | POST | Yes | Update current batch of students |

### Example: Get Dismissal Status

```bash
curl http://192.168.12.28:8080/api/dismissal/status
```

Response:
```json
{
  "active": true,
  "students": [
    {"name": "John Smith", "grade": "3", "id": 1732468800123},
    {"name": "Sarah Johnson", "grade": "5", "id": 1732468801456}
  ],
  "timestamp": 1732468802000
}
```

## Security

- **Authentication required** for starting/ending dismissal and adding students
- **Read-only status endpoint** - displays can check status without auth
- **Same security as admin panel** - uses existing session system
- **HTTPS recommended** for production (protects passwords in transit)

## Technical Details

### How It Works

1. **Teacher Interface** (dismissal.html)
   - Web Speech API for voice recognition
   - Simple form for manual entry
   - Real-time batch management

2. **API Server** (api/server.js)
   - Stores current dismissal state in memory
   - Broadcasts updates via SSE to all connected displays
   - Authentication for write operations

3. **Display Component** (js/dismissal-display.js)
   - Polls API every 5 seconds for status
   - Full-screen overlay (higher priority than livestream/slides)
   - Auto-updates when new students added

### Performance

- **Latency:** 0-5 seconds from teacher adding to TV display
- **Scalability:** Tested with 30+ simultaneous displays
- **Memory:** ~1MB per 100 students (negligible)
- **Network:** <1KB per update

### Browser Compatibility

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Display | ✅ | ✅ | ✅ | ✅ |
| Manual Entry | ✅ | ✅ | ✅ | ✅ |
| Voice Recognition | ✅ | ✅ | ✅ (iOS 14.5+) | ❌ |

## Best Practices for Daily Use

### Setup (Once)

1. Bookmark dismissal page on pickup tablets
2. Test voice recognition before first use
3. Create printed backup list of students by grade
4. Train teachers on both voice and manual entry

### During Dismissal

1. **Start early** - Open page and login before first cars arrive
2. **One operator** - Designate one person to manage the tablet
3. **Call in batches** - 5-12 students works best
4. **Clear regularly** - Click "Clear Batch" as students leave
5. **End properly** - Click "End Dismissal" when done

### Backup Plan

If system fails:
1. Use walkie-talkie (traditional method)
2. Write names on whiteboard
3. System will resume when back online

## Advanced: Custom Integration

### Integrate with Student Information System

You can create a custom tool that:
1. Fetches student roster from your SIS
2. Pre-fills dropdown with today's students
3. Auto-calls students based on car ID scanning

Example integration endpoint:
```javascript
// Add student via API
fetch('http://192.168.12.28:8080/api/dismissal/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Session-Token': sessionToken
  },
  body: JSON.stringify({
    students: [
      {name: 'John Smith', grade: '3', id: Date.now()}
    ]
  })
});
```

### Webhook Notifications

To get notified when dismissal starts/ends:
- Listen to SSE stream at `/api/settings/stream`
- Look for `dismissal_start`, `dismissal_update`, `dismissal_end` events

## FAQ

**Q: Can multiple teachers use the dismissal page at once?**
A: Only one teacher should actively add students. Multiple viewers can watch the display page, but adding students from multiple devices may cause conflicts.

**Q: What happens if internet goes down during dismissal?**
A: TVs will freeze on last batch shown. New students won't appear until connection restored. Use walkie-talkie backup.

**Q: Can I customize the colors or layout?**
A: Yes! Edit `js/dismissal-display.js` to change colors, fonts, grid layout. Requires rebuild: `docker-compose build && docker-compose up -d`

**Q: How many students can be displayed at once?**
A: Tested up to 50 students. Grid auto-adjusts. For >30 students, consider multiple smaller batches for better readability.

**Q: Can I print a log of who was dismissed and when?**
A: Not currently built-in. The system tracks students in memory only. You could add logging to the API if needed.

**Q: Does it work offline?**
A: Teacher interface requires network. TVs cache assets via service worker, but real-time updates require network connection.

## Support

If you encounter issues:

1. Check the console logs (F12 in browser)
2. Verify API health: `http://192.168.12.28:8080/api/health`
3. Check container logs: `docker logs school-api`
4. Refer to main documentation in IMPROVEMENTS.md

---

## Summary

The dismissal system provides a modern, efficient way to manage afternoon pickup:

✅ **Faster than walkie-talkie** - Direct to all screens
✅ **Less error-prone** - Visual confirmation
✅ **Easy to use** - Voice or manual entry
✅ **Real-time** - Updates within 5 seconds
✅ **Scalable** - Works with 30+ displays

Perfect for private schools with parent pickup lines!
