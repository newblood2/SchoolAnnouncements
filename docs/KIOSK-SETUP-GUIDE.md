# Kiosk Mode Setup Guide - Auto-play Audio on TVs/Raspberry Pi

## Problem
Browsers block autoplay with audio by default. For unattended digital signage displays, you need to bypass these restrictions.

## Solutions by Platform

### Solution 1: Chromium/Chrome Kiosk Mode (Recommended)

**For Raspberry Pi / Linux:**

Create a startup script that launches Chromium with autoplay enabled:

```bash
#!/bin/bash
# Save as: ~/start-announcements.sh

# Kill any existing Chromium processes
killall chromium-browser 2>/dev/null

# Wait a moment
sleep 2

# Launch Chromium in kiosk mode with autoplay enabled
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --enable-features=OverlayScrollbar \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=TranslateUI \
  --disable-translate \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  "http://192.168.12.28:8080"
```

Make it executable:
```bash
chmod +x ~/start-announcements.sh
```

**Important Flags:**
- `--autoplay-policy=no-user-gesture-required` - Allows audio autoplay
- `--kiosk` - Fullscreen mode, no UI
- `--noerrdialogs` - Hide error dialogs
- `--disable-infobars` - Hide notification bars

### Solution 2: Auto-start on Boot (Raspberry Pi)

**Method A: Using autostart (Raspberry Pi OS with Desktop)**

Edit autostart file:
```bash
mkdir -p ~/.config/lxsession/LXDE-pi
nano ~/.config/lxsession/LXDE-pi/autostart
```

Add these lines:
```bash
@xset s off
@xset -dpms
@xset s noblank
@/home/pi/start-announcements.sh
```

**Method B: Using systemd service**

Create service file:
```bash
sudo nano /etc/systemd/system/announcements-kiosk.service
```

Add:
```ini
[Unit]
Description=School Announcements Kiosk
After=network.target graphical.target

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority
ExecStart=/home/pi/start-announcements.sh
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
```

Enable and start:
```bash
sudo systemctl enable announcements-kiosk.service
sudo systemctl start announcements-kiosk.service
```

### Solution 3: Windows Kiosk Mode

**Create batch file** (`start-announcements.bat`):

```batch
@echo off
REM Kill existing Chrome
taskkill /F /IM chrome.exe 2>nul

REM Wait
timeout /t 2 /nobreak >nul

REM Start Chrome in kiosk mode with autoplay
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk ^
  --autoplay-policy=no-user-gesture-required ^
  --disable-infobars ^
  --noerrdialogs ^
  --no-first-run ^
  "http://192.168.12.28:8080"
```

**Auto-start on Windows:**
1. Press `Win + R`, type `shell:startup`, press Enter
2. Copy the batch file into the Startup folder
3. Or create a scheduled task to run at logon

### Solution 4: Firefox Kiosk Mode

**Linux/Raspberry Pi:**

```bash
#!/bin/bash
# Save as: ~/start-announcements-firefox.sh

# Kill existing Firefox
killall firefox 2>/dev/null
sleep 2

# Launch Firefox in kiosk mode
firefox \
  --kiosk \
  --private-window \
  "http://192.168.12.28:8080"
```

**Firefox autoplay settings:**
1. Navigate to: `about:config`
2. Set: `media.autoplay.default` = `0`
3. Set: `media.autoplay.blocking_policy` = `0`
4. Set: `media.autoplay.allow-muted` = `true`

Or add to Firefox policy (for managed deployments).

### Solution 5: Raspberry Pi - Dedicated Kiosk OS

**Using FullPageOS (Recommended for Pi):**

FullPageOS is a Raspberry Pi distribution designed for kiosks.

1. Download: https://github.com/guysoft/FullPageOS
2. Flash to SD card
3. Edit `/boot/fullpageos.txt` before first boot:
   ```
   URL=http://192.168.12.28:8080
   CHROME_OPTS=--autoplay-policy=no-user-gesture-required --disable-infobars
   ```
4. Boot the Pi - done!

## Hardware Setup Recommendations

### Raspberry Pi Configuration

**Recommended Models:**
- Raspberry Pi 4 (4GB RAM or higher) - Best performance
- Raspberry Pi 5 - Latest, best for 4K displays
- Raspberry Pi 3B+ - Adequate for 1080p

**OS Recommendation:**
- Raspberry Pi OS Lite + X11 + Chromium (minimal)
- Or FullPageOS (easiest)

**Power:**
- Use official power supply
- Consider PoE HAT for cleaner installation

### Disable Screen Blanking

**Add to `/boot/config.txt`:**
```ini
# Disable screen blanking
hdmi_blanking=1
```

**Add to `/etc/xdg/lxsession/LXDE-pi/autostart`:**
```bash
@xset s off
@xset -dpms
@xset s noblank
```

### Network Configuration

**Static IP (Optional but recommended):**

Edit `/etc/dhcpcd.conf`:
```ini
interface eth0
static ip_address=192.168.12.101/24
static routers=192.168.12.1
static domain_name_servers=192.168.12.1 8.8.8.8

interface wlan0
static ip_address=192.168.12.101/24
static routers=192.168.12.1
static domain_name_servers=192.168.12.1 8.8.8.8
```

## Testing Audio Autoplay

### Quick Test Script

Create `test-audio.html` on your server:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Audio Autoplay Test</title>
</head>
<body>
    <h1>Audio Autoplay Test</h1>
    <p id="status">Testing...</p>
    <video id="test" autoplay muted style="display:none">
        <source src="data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMWlzb20=" type="video/mp4">
    </video>
    <script>
        const video = document.getElementById('test');
        const status = document.getElementById('status');

        video.play().then(() => {
            status.textContent = '✅ Autoplay WORKS';
            status.style.color = 'green';
        }).catch(err => {
            status.textContent = '❌ Autoplay BLOCKED: ' + err.message;
            status.style.color = 'red';
        });
    </script>
</body>
</html>
```

Navigate to this page to test if autoplay is working.

## Troubleshooting

### Audio Still Not Playing

**1. Check browser flags are applied:**
```bash
ps aux | grep chromium
```
Should show `--autoplay-policy=no-user-gesture-required`

**2. Verify audio device:**
```bash
aplay -l  # List audio devices
amixer    # Check volume levels
```

**3. Test audio directly:**
```bash
speaker-test -t wav -c 2
```

**4. Check HDMI audio:**
```bash
# Force HDMI audio
sudo raspi-config
# → System Options → Audio → HDMI
```

### Chromium Crashes or Won't Start

**Clear cache and restart:**
```bash
rm -rf ~/.cache/chromium
rm -rf ~/.config/chromium
sudo reboot
```

### Display Goes to Sleep

**Disable all power management:**
```bash
# Add to /etc/X11/xorg.conf.d/10-monitor.conf
Section "ServerLayout"
    Identifier "ServerLayout0"
    Option "BlankTime"   "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime"     "0"
EndSection
```

## Complete Raspberry Pi Setup Checklist

For a fresh Raspberry Pi setup:

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install required packages
sudo apt install -y chromium-browser unclutter xdotool

# 3. Create startup script
cat > ~/start-announcements.sh << 'EOF'
#!/bin/bash
xset s off
xset -dpms
xset s noblank
unclutter -idle 0 &
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --autoplay-policy=no-user-gesture-required \
  "http://192.168.12.28:8080"
EOF

chmod +x ~/start-announcements.sh

# 4. Setup autostart
mkdir -p ~/.config/lxsession/LXDE-pi
cat > ~/.config/lxsession/LXDE-pi/autostart << 'EOF'
@xset s off
@xset -dpms
@xset s noblank
@/home/pi/start-announcements.sh
EOF

# 5. Disable screen blanking in boot config
echo "hdmi_blanking=1" | sudo tee -a /boot/config.txt

# 6. Set timezone
sudo timedatectl set-timezone America/New_York

# 7. Reboot
sudo reboot
```

## Alternative: Browser Profiles

If you can't use kiosk mode, create a Chrome profile with autoplay allowed:

**Chrome Profile Setup:**
1. Create new profile: `chrome://settings/people`
2. Navigate to: `chrome://flags/#autoplay-policy`
3. Set to: "No user gesture required"
4. Navigate to: `chrome://settings/content/sound`
5. Add to "Allowed to play sound": `http://192.168.12.28:8080`

Then always use this profile for the displays.

## Security Considerations

**For public/school displays:**
- Disable browser console (F12) via kiosk mode
- Use systemd to restart browser if it crashes
- Block access to browser settings
- Consider using a dedicated user account with limited permissions
- Disable SSH or use key-based auth only

## Summary

**Easiest Solution:**
Use Chromium with `--autoplay-policy=no-user-gesture-required` flag in kiosk mode.

**Best for Production:**
Raspberry Pi + FullPageOS + Chromium flags + systemd service

**For Windows TVs:**
Chrome in kiosk mode via startup batch file

**For Testing:**
Navigate to `chrome://media-engagement` to check autoplay permissions

---

**Your specific setup:**
```bash
chromium-browser \
  --kiosk \
  --autoplay-policy=no-user-gesture-required \
  "http://192.168.12.28:8080"
```

This will allow audio to play automatically when the livestream appears!
