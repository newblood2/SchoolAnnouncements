# OBS + MediaMTX Ultra-Low Latency Streaming Setup

This guide shows you how to stream from OBS Studio to your School Announcements display using **MediaMTX** with **WebRTC** for **sub-second latency** (300-500ms).

## What Changed From Old System

| Aspect | Old (HLS/RTMP) | New (MediaMTX/WebRTC) |
|--------|----------------|------------------------|
| **Latency** | 10-30 seconds | 300-500ms (sub-second!) |
| **Protocol** | RTMP → HLS → Browser | WHIP → WebRTC → Browser |
| **Stream Key** | Required | Optional (path-based) |
| **Setup Complexity** | Moderate | Simpler |
| **Browser Playback** | HLS.js player | Native WebRTC |

---

## Quick Start (5 Minutes)

### Step 1: Start MediaMTX Server

```bash
cd streaming-server
docker compose up -d
```

**Verify it's running:**
```bash
docker ps | grep mediamtx
```

You should see `school-streaming-server` running.

### Step 2: Configure OBS Studio (OBS 29+)

Since you have OBS 29 or newer, you can use **WHIP** (simplest method):

1. **Open OBS Studio**

2. **Settings → Stream:**
   - Service: **WHIP**
   - Server: `http://YOUR_SERVER_IP:8889/announcements/whip`
   - Bearer Token: `stream:YOUR_STREAM_TOKEN` (see Authentication section below)

   **Example URLs:**
   - Same computer: `http://localhost:8889/announcements/whip`
   - Local network: `http://192.168.1.100:8889/announcements/whip`
   - TrueNAS: `http://YOUR_TRUENAS_IP:8889/announcements/whip`

   **Important:** Use port **8889** (MediaMTX), not 8080 (web UI).

3. **Click "Apply"** and **"OK"**

4. **Click "Start Streaming"**

### Step 3: View Stream

Open in browser:
```
http://localhost:8080/stream-viewer.html
```

Or configure the main announcements display to use it (via admin panel).

**That's it!** You should see your stream with under 1 second delay! 🎉

---

## Alternative: RTMP Method (OBS 28 or Older)

If you're using an older version of OBS without WHIP support:

### OBS Settings

1. **Settings → Stream:**
   - Service: **Custom**
   - Server: `rtmp://YOUR_SERVER_IP:1935/announcements`
   - Stream Key: `?user=stream&pass=YOUR_STREAM_TOKEN` (see Authentication section)

2. **Settings → Output:**
   - Output Mode: **Advanced**
   - Encoder: **x264** or **NVENC** (NVIDIA GPU)
   - Keyframe Interval: **2** seconds

3. **Settings → Video:**
   - Base Resolution: **1920x1080**
   - Output Resolution: **1920x1080**
   - FPS: **30**

4. **Click "Apply"** and **"OK"**

---

## Finding Your Server IP Address

### Windows:
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter (e.g., `192.168.1.100`)

### Linux/Mac:
```bash
hostname -I
# or
ip addr show
```

---

## Testing Your Stream

### Method 1: Direct Stream Viewer

Open your browser to:
```
http://YOUR_SERVER_IP:8080/stream-viewer.html
```

**Debug Mode:**
- Press **'D'** key to toggle debug information
- See connection status, ICE state, and errors
- Helpful for troubleshooting

### Method 2: MediaMTX Built-in Player

MediaMTX has a built-in test page:
```
http://YOUR_SERVER_IP:8889/announcements/
```

This will show the WebRTC player for your stream.

### Method 3: Check Server API

MediaMTX provides an API to check active streams:
```
http://YOUR_SERVER_IP:9997/v3/paths/list
```

You should see your `announcements` path listed with `ready: true`.

---

## Integrating with Announcements Display

### Option 1: Via Admin Panel (Recommended)

1. Go to `http://localhost:8080/admin.html`
2. Login with your password
3. Click **"Livestream"** tab
4. **Enable livestream** toggle
5. **Livestream URL:** `stream-viewer.html` (auto-detects MediaMTX server)
6. **Enable "Auto-detect when livestream is online"**
7. **Check interval:** 15-30 seconds
8. Click **"Save Livestream Settings"**
9. Refresh main display

> **Note:** Using just `stream-viewer.html` (relative URL) is recommended. It automatically detects the MediaMTX server address based on your current hostname, so you don't need to hardcode IP addresses.

### Option 2: Direct URL (if needed)

If auto-detection doesn't work, you can specify the full URL:
- `http://YOUR_SERVER_IP:8080/stream-viewer.html?server=YOUR_SERVER_IP:8889`

---

## OBS Optimal Settings for WebRTC

### Video Settings
- **Base Resolution:** 1920x1080 (or your display resolution)
- **Output Resolution:** 1920x1080
- **Downscale Filter:** Lanczos (best quality)
- **FPS:** 30 (60 if computer can handle it)

### Output Settings (Advanced)
- **Encoder:**
  - NVIDIA GPU: **NVENC H.264** (best performance)
  - AMD GPU: **AMD HW H.264**
  - CPU only: **x264**
- **Rate Control:** CBR (Constant Bitrate)
- **Bitrate:** 3000-5000 Kbps (for local network)
- **Keyframe Interval:** 2 seconds
- **Preset:**
  - NVENC: Quality or Max Quality
  - x264: veryfast or faster
- **Profile:** high
- **Tune:** (none or zerolatency)

### Audio Settings
- **Sample Rate:** 48 kHz
- **Bitrate:** 160 Kbps
- **Codec:** AAC

---

## Architecture Diagram

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│             │  WHIP/  │                  │ WebRTC  │                 │
│ OBS Studio  │  RTMP   │ MediaMTX Server  │ (WHEP)  │ Browser Display │
│             ├────────►│                  ├────────►│                 │
│ (Streaming) │         │ Port 8889/1935   │         │ (Viewing)       │
└─────────────┘         └──────────────────┘         └─────────────────┘
                               │
                               │ API (Port 9997)
                               ├─ Metrics (Port 9998)
                               └─ HLS Fallback (Port 8888)
```

---

## How It Works

### Using WHIP (OBS 29+):
1. **OBS** streams via WHIP protocol directly to MediaMTX (WebRTC end-to-end)
2. **MediaMTX** receives WebRTC stream on port 8889
3. **Browser** connects via WHEP and gets WebRTC stream
4. **Result:** Pure WebRTC path, ultra-low latency

### Using RTMP (OBS 28 or older):
1. **OBS** streams RTMP to MediaMTX on port 1935
2. **MediaMTX** transcodes RTMP to WebRTC in real-time
3. **Browser** connects via WHEP and gets WebRTC stream
4. **Result:** Slight transcoding overhead, but still sub-second latency

---

## Stream Paths

MediaMTX uses path-based stream routing:

- **Main announcements:** `/announcements`
- **WHIP URL (OBS):** `http://SERVER:8889/announcements/whip`
- **WHEP URL (Browser):** `http://SERVER:8889/announcements/whep`
- **RTMP URL (OBS):** `rtmp://SERVER:1935/announcements`
- **HLS URL (Fallback):** `http://SERVER:8888/announcements/index.m3u8`

You can create multiple streams by using different paths:
- `/morning-announcements`
- `/assembly`
- `/sports-event`

---

## Firewall Configuration

### Ports to Allow

| Port | Protocol | Purpose |
|------|----------|---------|
| 1935 | TCP | RTMP input from OBS |
| 8888 | TCP | HLS output (fallback) |
| 8889 | TCP | WebRTC/WHIP/WHEP |
| 8189 | UDP/TCP | WebRTC ICE |
| 9997 | TCP | API (optional) |
| 9998 | TCP | Metrics (optional) |

### Windows Firewall

Allow incoming connections:
```powershell
netsh advfirewall firewall add rule name="MediaMTX RTMP" dir=in action=allow protocol=TCP localport=1935
netsh advfirewall firewall add rule name="MediaMTX WebRTC" dir=in action=allow protocol=TCP localport=8889
netsh advfirewall firewall add rule name="MediaMTX WebRTC UDP" dir=in action=allow protocol=UDP localport=8189
```

---

## Troubleshooting

### Issue: OBS Won't Connect (WHIP)

**Error:** "Failed to connect to server"

**Solutions:**
1. Check MediaMTX is running: `docker ps | grep mediamtx`
2. Verify URL is correct: `http://YOUR_IP:8889/announcements/whip`
3. Test connectivity: Open `http://YOUR_IP:9997/v3/paths/list` in browser
4. Check firewall allows port 8889
5. Try using `localhost` if on same computer

### Issue: OBS Won't Connect (RTMP)

**Error:** "Failed to connect to server"

**Solutions:**
1. Check MediaMTX is running
2. Verify RTMP server: `rtmp://YOUR_IP:1935/announcements`
3. No stream key needed (or use any value)
4. Check firewall allows port 1935
5. Look at MediaMTX logs: `docker logs school-streaming-server`

### Issue: Stream Connects but Browser Shows Error

**Error:** "Connection error" or stuck on "Connecting..."

**Solutions:**
1. **Check stream is actually streaming in OBS** (should show green indicator)
2. **Verify stream is active:**
   ```
   http://YOUR_SERVER_IP:9997/v3/paths/list
   ```
   Look for `"ready": true` for your stream path
3. **Test with MediaMTX built-in player:**
   ```
   http://YOUR_SERVER_IP:8889/announcements/
   ```
4. **Check browser console** for errors (F12 → Console tab)
5. **Press 'D' in stream viewer** to see debug information
6. **Check CORS issues** - make sure server IP matches in URLs

### Issue: High Latency (More than 2 seconds)

**Possible Causes:**
1. Network issues - check your local network
2. OBS keyframe interval too high - should be 2 seconds max
3. Computer CPU overloaded - lower OBS preset or resolution
4. Browser buffering - refresh page to reset connection

**Solutions:**
1. Lower OBS bitrate to 2500 Kbps
2. Set keyframe interval to 1-2 seconds
3. Use hardware encoder (NVENC) if available
4. Close other programs using CPU/network
5. Use wired ethernet instead of WiFi

### Issue: Stream Keeps Disconnecting

**Solutions:**
1. **Check network stability** - use wired connection
2. **Look at MediaMTX logs:**
   ```bash
   docker logs -f school-streaming-server
   ```
3. **Increase OBS bitrate stability** - use CBR mode
4. **Check CPU usage** in OBS (Stats panel)
5. **Reduce output resolution** if CPU can't keep up

### Issue: No Audio

**Solutions:**
1. **Check OBS audio sources** are enabled and not muted
2. **Verify audio in stream viewer** - browser may block autoplay
3. **Click on video** to unmute (browsers auto-mute videos)
4. **Check OBS audio settings** - should be 48kHz AAC
5. **Look at browser console** for audio codec errors

---

## Advanced Configuration

### Custom Stream Paths

Edit `streaming-server/mediamtx.yml`:

```yaml
paths:
  gym-camera:
    source: publisher

  cafeteria-camera:
    source: publisher
```

Then use:
- OBS: `http://SERVER:8889/gym-camera/whip`
- Browser: `http://SERVER:8889/gym-camera/whep`

### Recording Streams

MediaMTX can record streams to disk. Add to path configuration:

```yaml
paths:
  announcements:
    source: publisher
    record: yes
    recordPath: ./recordings/%path/%Y-%m-%d_%H-%M-%S
    recordFormat: mp4
```

### Authentication (via Admin Panel)

Streaming authentication is configured through the Admin Panel - no need to edit config files!

#### Setting Your Stream Token

1. **Open Admin Panel:** `http://YOUR_SERVER:8080/admin.html`
2. **Go to "Livestream" tab**
3. **Find "Stream Publish Token" field**
4. **Enter a secure token** (or click "Generate" for a random one)
5. **Click "Save Livestream Settings"**

The token takes effect immediately - no restart needed!

#### Configuring OBS with Authentication

**For WHIP (OBS 30+):**
1. Settings → Stream
2. Bearer Token: `stream:YOUR_TOKEN`

**For RTMP (Older OBS):**
1. Settings → Stream
2. Stream Key: `?user=stream&pass=YOUR_TOKEN`

**Example with token `my-school-stream-2024`:**
- WHIP Bearer Token: `stream:my-school-stream-2024`
- RTMP Stream Key: `?user=stream&pass=my-school-stream-2024`

#### Disabling Authentication (Not Recommended)

To disable authentication, simply leave the "Stream Publish Token" field empty in the Admin Panel.

**Warning:** Anyone on your network could then stream to your displays!

---

## Performance Monitoring

### MediaMTX API

Check server status:
```bash
curl http://localhost:9997/v3/paths/list
```

### Prometheus Metrics

MediaMTX exposes Prometheus metrics on port 9998:
```
http://localhost:9998/metrics
```

---

## Comparison: MediaMTX vs Old RTMP/HLS Setup

| Feature | Old Setup | MediaMTX |
|---------|-----------|----------|
| Latency | 10-30 sec | 0.3-0.5 sec |
| Setup Complexity | Medium | Easy |
| Docker Containers | 1 (nginx-rtmp) | 1 (mediamtx) |
| Configuration Files | 2 (nginx.conf, docker-compose) | 2 (mediamtx.yml, docker-compose) |
| Browser Compatibility | Good (HLS) | Excellent (WebRTC) |
| Mobile Support | Excellent | Excellent |
| Resource Usage | Low | Very Low |
| Protocols Supported | RTMP, HLS | RTMP, WebRTC, HLS, RTSP, SRT |
| OBS Integration | Good (RTMP) | Excellent (WHIP native) |

---

## Quick Reference Card

### Server Setup
```bash
cd streaming-server
docker compose up -d
docker logs -f school-streaming-server
```

### OBS WHIP Setup (OBS 29+)
- Service: WHIP
- Server: `http://YOUR_IP:8889/announcements/whip`
- Bearer Token: `stream:YOUR_STREAM_TOKEN`

### OBS RTMP Setup (Older OBS)
- Service: Custom
- Server: `rtmp://YOUR_IP:1935/announcements`
- Stream Key: `?user=stream&pass=YOUR_STREAM_TOKEN`

### View Stream
- Stream Viewer: `http://YOUR_IP:8080/stream-viewer.html`
- MediaMTX Player: `http://YOUR_IP:8889/announcements/`
- Debug: Press 'D' in stream viewer

### Check Status
- API: `http://YOUR_IP:9997/v3/paths/list`
- Metrics: `http://YOUR_IP:9998/metrics`
- Logs: `docker logs school-streaming-server`

---

## Next Steps

1. ✅ Start MediaMTX server
2. ✅ Set stream authentication token
3. ✅ Configure OBS with WHIP + Bearer Token
4. ✅ Test stream in browser
5. ✅ Integrate with announcements display
6. ⏭️ Set up multiple camera streams (optional)
7. ⏭️ Configure recording (optional)

---

## Support & Resources

- **MediaMTX Documentation:** https://github.com/bluenviron/mediamtx
- **WHIP Specification:** https://datatracker.ietf.org/doc/html/draft-ietf-wish-whip
- **WebRTC Troubleshooting:** https://webrtc.github.io/samples/
- **OBS Forums:** https://obsproject.com/forum/

For issues specific to this school announcements system, check the logs and use the debug mode in stream-viewer.html.

---

**Enjoy your ultra-low latency streaming!** 🎥✨
