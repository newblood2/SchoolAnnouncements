# School Announcements - Multi-Display Deployment Guide

## System Overview

Your School Announcements display system is now configured for centralized management across 30+ TVs with real-time updates.

### Architecture
- **Frontend (nginx)**: Serves the announcement display and admin panel on port 8080
- **API Server (Node.js)**: Centralized settings storage with Server-Sent Events (SSE) for real-time sync on port 3000
- **Streaming Server (MediaMTX)**: Ultra-low latency WebRTC streaming on ports 8889/8888

## Quick Start

### 1. Start All Services
```bash
docker compose up -d
```

### 2. Verify Services are Running
```bash
docker compose ps
```

All containers should show "healthy" status:
- `school-announcements` - Main display and admin panel
- `school-api` - Settings API with SSE
- `school-streaming-server` - WebRTC streaming (if using livestream)

### 3. Access Points

- **Main Display**: http://localhost:8080
- **Admin Panel**: http://localhost:8080/admin.html (password: admin123)
- **Stream Viewer**: Built into MediaMTX at http://localhost:8889/mystream
- **API Health**: http://localhost:8080/api/health

## Testing Multi-Display Sync

### Test Real-Time Updates
1. Open the main display in Browser 1: http://localhost:8080
2. Open the admin panel in Browser 2: http://localhost:8080/admin.html
3. Login with password: `admin123`
4. Make a change (e.g., apply a theme or edit a slide)
5. Watch Browser 1 update instantly without refresh

### Check Browser Console
In the main display (http://localhost:8080), open browser console (F12) and look for:
```
✓ Connected to real-time settings stream
✓ Settings loaded from server: [list of settings]
✓ Custom theme applied
✓ Loaded X custom slides
```

When you save changes in admin panel, you should see:
```
✓ Settings updated from server!
Updated keys: customTheme
```

### Verify Connected Displays
Check how many displays are connected:
```bash
curl http://localhost:8080/api/clients
```

## Admin Panel Features

### Color Themes Tab
- **6 Preset Themes**: Default Blue, Sunset Orange, Forest Green, Purple Dream, Deep Ocean, Royal Crimson
- **Custom Color Zones**:
  - Background gradient (start/end)
  - Main content panel (color + opacity)
  - Weather panel (color + opacity)
  - Bottom panel (color + opacity)
  - Accent color (gold highlights)
- **Save Custom Themes**: Create and name your own theme presets

### Slide Editor Tab
- **HTML Slides Mode**: Edit slide content directly in the admin panel
- **Image Slides Mode**: Use images from a folder (configure separately)
- **Add/Delete Slides**: Manage slide content dynamically
- **Preview**: Use "Preview Display" button to see changes

### Livestream Tab
- **Enable/Disable**: Toggle livestream display
- **Stream URL**: Enter WebRTC stream URL (e.g., http://localhost:8889/mystream)
- **Auto-detection**: Automatically show stream when online
- **Check Interval**: How often to check if stream is live (10-300 seconds)

### General Settings Tab
- **School Name**: Update the school name displayed
- **Slideshow Interval**: Time each slide displays (3-60 seconds)

## Livestream Setup (OBS)

### 1. Configure OBS
- Settings → Stream
- Service: WHIP
- Server: `http://localhost:8889/mystream/whip`
- Bearer Token: (leave empty)

### 2. Start Streaming
- Click "Start Streaming" in OBS
- Stream should connect with sub-second latency

### 3. View Stream
- Open http://localhost:8889/mystream in browser
- Or configure stream-viewer.html to show stream automatically

## Deploying to 30+ TVs

### Network Setup
1. Ensure all TVs are on the same network as the server
2. Find the server's IP address: `ipconfig` (Windows) or `ifconfig` (Linux/Mac)
3. Replace `localhost` with server IP (e.g., `http://192.168.1.100:8080`)

### TV Configuration
For each TV:
1. Open browser to: `http://[SERVER-IP]:8080`
2. Set browser to fullscreen (F11)
3. Disable sleep/screensaver
4. Configure browser to auto-start on boot

### Automatic Updates
- All TVs will connect to the SSE stream on page load
- When admin makes changes, updates broadcast to all connected displays instantly
- No manual refresh needed - changes appear in real-time

## Data Persistence

### Settings Storage
- All settings stored in: `api/settings.json`
- Persisted via Docker volume mount
- Survives container restarts

### Backup Settings
```bash
# Backup
cp api/settings.json api/settings.backup.json

# Restore
cp api/settings.backup.json api/settings.json
docker compose restart api
```

## Troubleshooting

### Admin Changes Not Appearing on Display
1. Check browser console for SSE connection errors
2. Verify API is running: `docker compose ps`
3. Check API logs: `docker logs school-api`
4. Verify connected clients: `curl http://localhost:8080/api/clients`

### OBS Cannot Connect to Streaming Server
1. Verify MediaMTX is running: `docker compose ps`
2. Check server URL: `http://localhost:8889/mystream/whip`
3. Test connection: `curl http://localhost:8889`
4. Check MediaMTX logs: `docker compose logs streaming-server`

### Display Shows Default Content Only
- This means SSE is not connected or settings are empty
- Check: `curl http://localhost:8080/api/settings`
- Should return saved theme, slides, etc.
- If empty, open admin panel and save settings

### Migration from localStorage
If you previously saved settings using localStorage:
1. Open admin panel: http://localhost:8080/admin.html
2. Click "Migrate from localStorage" button
3. Confirm migration
4. Refresh all display pages

## Configuration Files

### Change Admin Password
Edit `config.js` line 55:
```javascript
ADMIN_PASSWORD: 'admin123'  // Change this
```

Rebuild container:
```bash
docker compose up -d --build announcements
```

### Modify API Settings
Edit `api/server.js` to change:
- API port (default: 3000)
- SSE keepalive interval (default: 30s)
- Settings file location

### Update nginx Configuration
Edit `nginx.conf` to change:
- Port 80 (internal nginx port)
- API proxy settings
- SSL/HTTPS configuration (if needed)

## Monitoring

### Check System Status
```bash
# All services
docker compose ps

# API health
curl http://localhost:8080/api/health

# Connected displays
curl http://localhost:8080/api/clients

# API logs
docker logs school-api --tail 50

# Display logs
docker logs school-announcements --tail 50
```

### Performance
- Each SSE connection uses minimal bandwidth (~1 KB keepalive every 30s)
- Updates only sent when settings change
- 30+ simultaneous SSE connections should have negligible impact

## Production Recommendations

### Security
- Change default admin password in config.js
- Use HTTPS in production (configure nginx SSL)
- Consider adding API authentication
- Restrict admin panel to specific IPs (nginx config)

### Reliability
- Set up automatic container restart: `restart: unless-stopped` (already configured)
- Monitor API logs for errors
- Set up health check alerts
- Backup settings.json regularly

### Scaling
- Current setup supports 100+ simultaneous displays
- SSE is one-way (server → client), very efficient
- For 500+ displays, consider Redis pub/sub instead of in-memory client Set

## Support

### Log Files
All logs available via Docker:
```bash
docker logs school-api
docker logs school-announcements
docker logs school-streaming-server
```

### Reset to Factory Settings
```bash
# Stop services
docker compose down

# Clear settings
echo '{}' > api/settings.json

# Restart
docker compose up -d
```

### Full Rebuild
```bash
docker compose down
docker compose up -d --build
```

## API Reference

### GET /api/settings
Returns all current settings
```bash
curl http://localhost:8080/api/settings
```

### POST /api/settings
Save all settings (overwrites)
```bash
curl -X POST http://localhost:8080/api/settings \
  -H "Content-Type: application/json" \
  -d '{"customTheme": {...}}'
```

### POST /api/settings/:key
Update specific setting
```bash
curl -X POST http://localhost:8080/api/settings/customTheme \
  -H "Content-Type: application/json" \
  -d '{"value": {...}}'
```

### GET /api/settings/stream
Server-Sent Events stream (for browsers)
```javascript
const eventSource = new EventSource('/api/settings/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Settings update:', data);
};
```

### GET /api/health
Health check endpoint
```bash
curl http://localhost:8080/api/health
```

### GET /api/clients
Get connected client count
```bash
curl http://localhost:8080/api/clients
```

---

**Ready to deploy!** Start by testing with 2-3 browsers on the same computer, then expand to multiple devices on your network.
