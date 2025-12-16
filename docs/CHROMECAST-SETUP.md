# Chromecast Display Setup Guide

This guide explains how to display School Announcements on Chromecast devices using Chromecast-Kiosk.

## Overview

[Chromecast-Kiosk](https://github.com/mrothenbuecher/Chromecast-Kiosk) is an open-source tool that casts web pages to multiple Chromecast devices. It automatically reconnects if a Chromecast times out or disconnects.

## Prerequisites

- Chromecast devices (any generation, Google TV also works)
- All devices on the same network as your TrueNAS server
- Static IP addresses assigned to each Chromecast (recommended)

## Step 1: Deploy Chromecast-Kiosk

### Option A: Docker Compose (Recommended)

```bash
cd chromecast-kiosk
docker-compose up -d
```

### Option B: Docker Run

```bash
docker run -d \
  --name school-announcements-chromecast \
  --network host \
  --restart unless-stopped \
  -v chromecast-config:/usr/local/tomcat/webapps/presenter/WEB-INF/config \
  rez0n/chromecast-kiosk:latest
```

### Option C: TrueNAS Custom App

Add a new custom app with:
- Image: `rez0n/chromecast-kiosk:latest`
- Network: Host mode
- Volume: Mount for `/usr/local/tomcat/webapps/presenter/WEB-INF/config`

## Step 2: Access the Web Interface

Open your browser and go to:
```
http://YOUR_SERVER_IP:8080/presenter
```

## Step 3: Add Chromecast Devices

In the Chromecast-Kiosk web interface:

1. Click **"Add ChromeCast"**
2. Enter the Chromecast's **IP address** (e.g., `192.168.2.50`)
3. Enter a **friendly name** (e.g., `Gym TV`)
4. Click **Save**

Repeat for each Chromecast device.

## Step 4: Configure Display URLs

For each Chromecast, set the URL to cast. Use URL parameters to configure each display differently:

### Basic URL (all slides)
```
http://192.168.2.17:8080/display.html?name=MainLobby
```

### Tagged URL (filtered content)
```
http://192.168.2.17:8080/display.html?name=GymTV&location=Gymnasium&tags=gym,sports
```

### URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `name` | Display name (shows in Admin Panel) | `name=GymTV` |
| `location` | Physical location | `location=Gymnasium` |
| `tags` | Content filter tags (comma-separated) | `tags=gym,sports,events` |

## Step 5: Start Casting

1. In Chromecast-Kiosk, select a device
2. Enter the display URL
3. Set refresh interval (3600 seconds = 1 hour recommended)
4. Click **"Start Casting"**

The display will automatically reconnect if disconnected.

## Example Setup

| Chromecast Name | IP | URL |
|-----------------|----|----|
| Main Office | 192.168.2.50 | `http://192.168.2.17:8080/display.html?name=MainOffice&tags=office,all` |
| Gym TV | 192.168.2.51 | `http://192.168.2.17:8080/display.html?name=GymTV&tags=gym,sports` |
| Cafeteria 1 | 192.168.2.52 | `http://192.168.2.17:8080/display.html?name=Cafeteria1&tags=cafeteria,lunch` |
| Cafeteria 2 | 192.168.2.53 | `http://192.168.2.17:8080/display.html?name=Cafeteria2&tags=cafeteria,lunch` |
| Library | 192.168.2.54 | `http://192.168.2.17:8080/display.html?name=Library&tags=library,all` |

## Content Targeting

### Creating Tagged Slides

In the Admin Panel, when creating slides, you can set `targetTags` to control which displays show the slide:

- **No tags**: Shows on all displays
- **`all` tag**: Shows on all displays
- **Specific tags**: Only shows on displays with matching tags

### How Tag Matching Works

1. Display loads with tags from URL (e.g., `tags=gym,sports`)
2. Slides are filtered based on their `targetTags`
3. Only matching slides are shown

Example:
- Slide with `targetTags: ["sports"]` → Shows on Gym TV (has "sports" tag)
- Slide with `targetTags: ["lunch"]` → Shows only on Cafeteria displays
- Slide with `targetTags: ["all"]` → Shows everywhere

## Troubleshooting

### Chromecast Not Found

1. Ensure Chromecast has a static IP
2. Verify Chromecast-Kiosk is running with `network_mode: host`
3. Check that all devices are on the same network/VLAN

### Display Shows "Connecting to stream..."

1. Verify the display URL is correct
2. Check that port 8080 is accessible from the Chromecast
3. Test the URL in a regular browser first

### Cast Stops After a While

Chromecast-Kiosk should auto-reconnect. If not:
1. Check the Chromecast-Kiosk logs
2. Verify the Chromecast hasn't changed IP
3. Restart the Chromecast-Kiosk container

### Tags Not Working

1. Verify the URL has `?tags=` parameter (not `&tags=` if it's the first parameter)
2. Check browser console for "Display tags set from URL" message
3. Clear localStorage and reload: `localStorage.clear()`

## Network Requirements

| Port | Service | Direction |
|------|---------|-----------|
| 8080 | School Announcements | Chromecast → Server |
| 8080 | Chromecast-Kiosk Web UI | Browser → Server |
| 8008-8009 | Chromecast Control | Server → Chromecast |
| 5353 | mDNS (discovery) | Multicast |

## For Roku TVs

Chromecast-Kiosk does **not** work with Roku. Options:
1. **Replace with Chromecast** (~$30) - Recommended
2. **Fire TV Stick** (~$25) - Use Silk browser in kiosk mode
3. **Roku apps** (TVQue, QuickEsign) - $6-7/month per TV

## Resources

- [Chromecast-Kiosk GitHub](https://github.com/mrothenbuecher/Chromecast-Kiosk)
- [Docker Image](https://hub.docker.com/r/rez0n/chromecast-kiosk)
