# Stream Proxying Guide - Multi-Network Support

## Problem Solved

This guide addresses two critical issues with livestreaming:

### 1. Localhost URL Issue
**Problem:** When you use `http://localhost:8889/mystream` as the stream URL, each client device tries to connect to its **own** localhost, not the server's localhost.

**Result:** Stream works on the server but fails on all other devices.

### 2. Network Accessibility Issue
**Problem:** In some network setups:
- Display TVs can access the main server (port 8080)
- But they cannot access the streaming server directly (port 8889)
- Firewall rules, VLANs, or network segmentation block port 8889
- You want to access from external networks without opening multiple ports

**Solution:** nginx proxies the stream through the main server port, so clients only need access to port 8080.

## How Stream Proxying Works

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│             │         │                  │         │                 │
│  OBS        ├────────>│  MediaMTX        │         │  Display TVs    │
│  Streaming  │  RTMP   │  (port 8889)     │<────────┤  (browsers)     │
│  Software   │  1935   │                  │  Proxy  │                 │
│             │         │                  │  HTTP   │                 │
└─────────────┘         └─────────┬────────┘  8080   └─────────────────┘
                                  │
                                  │ Internal
                                  │ Network
                                  ↓
                        ┌──────────────────┐
                        │                  │
                        │  nginx           │
                        │  Proxy Server    │
                        │  (port 80)       │
                        │                  │
                        └──────────────────┘
```

**Flow:**
1. OBS streams to MediaMTX on port 1935 (RTMP) or 8889 (WHIP)
2. MediaMTX processes and makes stream available on port 8889
3. Display clients request: `http://server-ip:8080/stream/mystream`
4. nginx receives the request and forwards it to MediaMTX (internal)
5. MediaMTX responds with the stream
6. nginx forwards the stream back to the client

**Benefits:**
- Clients only need access to port 8080 (main display port)
- Works across different networks and VLANs
- Simplified firewall rules
- Single entry point for all services

## Configuration

### Step 1: Update Livestream URL in Admin Panel

1. Open admin panel: `http://[server-ip]:8080/admin.html`
2. Go to **Livestream** tab
3. Set the livestream URL using **relative path**:

```
/stream/mystream
```

**Important:** Use the relative path format starting with `/stream/`

**Do NOT use:**
- ❌ `http://localhost:8889/mystream` (only works on server)
- ❌ `http://192.168.1.100:8889/mystream` (requires direct access to port 8889)

**DO use:**
- ✅ `/stream/mystream` (works everywhere via proxy)

### Step 2: Configure OBS Streaming

**For RTMP (recommended for reliability):**
- Server: `rtmp://[server-ip]:1935/mystream`
- Stream Key: (leave empty)

**For WHIP (WebRTC push):**
- Server: `http://[server-ip]:8889/mystream/whip`
- Bearer Token: (leave empty)

### Step 3: Test Stream Access

**From Server:**
```bash
curl -I http://localhost:8080/stream/mystream
```

**From Another Device:**
```bash
curl -I http://[server-ip]:8080/stream/mystream
```

Both should return HTTP status (404 if not streaming, 200 if streaming).

## Network Scenarios

### Scenario 1: Single Local Network
**Setup:** All devices on same LAN (192.168.1.x)

**Configuration:**
- Livestream URL: `/stream/mystream`
- Access from displays: `http://192.168.1.100:8080` (replace with actual server IP)
- OBS streams to: `rtmp://192.168.1.100:1935/mystream`

**Ports needed:**
- **8080** (HTTP - displays access this)
- **1935** (RTMP - OBS uses this)

### Scenario 2: Multiple Networks / VLANs
**Setup:** TVs on VLAN 10, Server on VLAN 20, streaming server on VLAN 30

**Configuration:**
- Livestream URL: `/stream/mystream`
- Firewall rules: Allow VLAN 10 → VLAN 20 port 8080 only
- Internal proxy: nginx forwards to MediaMTX (no external access needed)

**Advantages:**
- TVs don't need direct access to streaming server
- Only one firewall rule needed
- Simplified network security

### Scenario 3: External/Public Access
**Setup:** Want to access from internet

**Configuration:**
- Livestream URL: `/stream/mystream`
- Port forwarding: External 80/443 → Internal 8080
- Use domain name or public IP

**Access:**
- Internal: `http://192.168.1.100:8080/stream/mystream`
- External: `http://your-domain.com/stream/mystream`

## Troubleshooting

### Stream Not Appearing on Displays

1. **Check OBS is streaming:**
   ```bash
   curl http://[server-ip]:8889/mystream
   ```
   Should return HTML page if stream exists.

2. **Check proxy is working:**
   ```bash
   curl http://[server-ip]:8080/stream/mystream
   ```
   Should return same result as above.

3. **Check browser console (F12):**
   - Should see: "MediaMTX stream detected online (publishing)"
   - If seeing: "MediaMTX stream offline" → OBS not streaming
   - If seeing: "stream check failed" → proxy not working

4. **Check livestream settings in API:**
   ```bash
   curl http://[server-ip]:8080/api/settings | grep livestreamConfig
   ```

### Localhost URL Issue

**Symptoms:**
- Stream works on server browser
- Stream fails on all other devices
- Browser console shows "localhost" errors

**Fix:**
1. Open admin panel
2. Go to Livestream tab
3. Change URL from `http://localhost:8889/mystream` to `/stream/mystream`
4. Save settings
5. All displays will update automatically via SSE

### 404 Error on Stream

**Cause:** OBS is not currently streaming.

**Fix:**
1. Open OBS
2. Click "Start Streaming"
3. Within 5 seconds (or your check interval), display should switch to stream

### Network Access Issues

**Problem:** Stream works on local network but not from other VLANs

**Solution 1 - Use Proxy (Recommended):**
- Set URL to `/stream/mystream`
- Only port 8080 needs to be accessible

**Solution 2 - Open Port 8889:**
- Configure firewall to allow access to port 8889
- Use direct URL: `http://[server-ip]:8889/mystream`

## OBS Configuration Examples

### Local Network Streaming (RTMP)
```
Settings → Stream
- Service: Custom
- Server: rtmp://192.168.1.100:1935/mystream
- Stream Key: (empty)
- Use Authentication: No
```

### WebRTC Streaming (WHIP)
```
Settings → Stream
- Service: WHIP
- Server: http://192.168.1.100:8889/mystream/whip
- Bearer Token: (empty)
```

### Recommendations:
- **RTMP** for reliability and compatibility
- **WHIP** for lowest possible latency
- Use proxied viewer URL (`/stream/mystream`) regardless of push protocol

## Port Reference

| Port | Service | Used By | Public? |
|------|---------|---------|---------|
| 8080 | Main Web Server (nginx) | Display browsers | Yes |
| 8889 | MediaMTX HTTP/WebRTC | Proxied by nginx | No* |
| 1935 | RTMP | OBS streaming | Yes |
| 3000 | API Server | Internal only | No |
| 9997 | MediaMTX API | Internal only | No |

\* Port 8889 can be kept internal if using proxy

## Security Best Practices

1. **Use Proxy for Viewers:**
   - Set stream URL to `/stream/mystream`
   - Don't expose port 8889 publicly
   - Reduces attack surface

2. **Restrict RTMP Access:**
   - Only allow OBS devices to access port 1935
   - Use firewall rules to limit source IPs

3. **HTTPS/SSL (Production):**
   - Configure nginx SSL for port 443
   - Use Let's Encrypt for free certificates
   - Force HTTPS redirect

4. **Authentication (Optional):**
   - Add nginx basic auth for `/stream/` location
   - Configure MediaMTX authentication for publishers
   - Protect admin panel with stronger password

## Advanced: Multiple Streams

To support multiple streams (e.g., different classrooms):

### OBS Configuration:
- Classroom A: `rtmp://server:1935/classroom-a`
- Classroom B: `rtmp://server:1935/classroom-b`

### Admin Panel URLs:
- Display 1: `/stream/classroom-a`
- Display 2: `/stream/classroom-b`

### Access:
- All work through same proxy
- No additional configuration needed
- Each display can show different stream

## Testing Checklist

- [ ] Admin panel accessible at `http://[server-ip]:8080/admin.html`
- [ ] Stream URL set to `/stream/mystream` (relative path)
- [ ] OBS connects to server successfully
- [ ] Start streaming in OBS
- [ ] Stream appears in browser at `http://[server-ip]:8080`
- [ ] Open browser on **different device** on network
- [ ] Navigate to `http://[server-ip]:8080`
- [ ] Stream appears automatically within check interval
- [ ] Stop OBS streaming
- [ ] Display switches back to slideshow automatically

## Summary

**Key Takeaways:**

1. **Always use relative path for stream URL:** `/stream/mystream`
2. **Never use localhost:** It only works on the server
3. **Proxy = Simpler networking:** Only port 8080 needs to be accessible
4. **OBS pushes, browsers pull:** OBS uses 1935 (RTMP) or 8889 (WHIP), viewers use 8080
5. **Automatic detection:** Stream appears/disappears automatically based on OBS status

**Quick Reference:**

| Setting | Value |
|---------|-------|
| Admin Panel | `http://[server-ip]:8080/admin.html` |
| Livestream URL | `/stream/mystream` |
| OBS Server (RTMP) | `rtmp://[server-ip]:1935/mystream` |
| OBS Server (WHIP) | `http://[server-ip]:8889/mystream/whip` |
| Check Interval | 5-10 seconds recommended |

---

**Need help?** Check DEPLOYMENT-GUIDE.md for general setup instructions.
