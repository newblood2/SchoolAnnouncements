# Kiosk Setup Scripts

This directory contains scripts to set up kiosk displays for the School Announcements system.

## Raspberry Pi Setup

### Requirements
- Raspberry Pi 3/4/5 with Raspberry Pi OS (with Desktop)
- Network connection
- HDMI display
- `rootCA.pem` from the server's `certs/` directory

### Quick Setup

1. **On your server**, generate SSL certificates if you haven't already:
   ```bash
   cd certs
   ./setup-certs.ps1 -ServerIP "YOUR_SERVER_IP"  # Windows
   # or
   ./setup-certs.sh YOUR_SERVER_IP               # Linux/macOS
   ```

2. **Copy files to your Raspberry Pi**:
   ```bash
   # From your server, copy to the Pi
   scp certs/rootCA.pem pi@raspberrypi:~/
   scp kiosk/raspberry-pi-setup.sh pi@raspberrypi:~/
   ```

3. **On the Raspberry Pi**, run the setup:
   ```bash
   chmod +x raspberry-pi-setup.sh
   sudo ./raspberry-pi-setup.sh https://YOUR_SERVER_IP:8443
   ```

4. **Reboot**:
   ```bash
   sudo reboot
   ```

The Pi will automatically boot into kiosk mode showing the announcements display.

### What the Script Does

1. **Updates system packages**
2. **Installs Chromium** (if not present) and required tools
3. **Installs SSL certificate** system-wide and for Chromium
4. **Disables screen blanking** and power management
5. **Creates kiosk startup script** with optimized Chromium flags
6. **Configures autostart** on boot
7. **Enables auto-login** for the pi user
8. **Creates management scripts** for easy maintenance
9. **Enables audio auto-unmute** for livestream playback

### Audio/Livestream

The kiosk script automatically:
- Adds `?kiosk=1` to URLs to enable audio auto-unmute
- Configures Chromium with `--autoplay-policy=no-user-gesture-required`

This means when a livestream starts, audio will play automatically without user interaction.

**To manually control audio**, you can:
- Press `M` key to toggle mute
- Click the mute button (bottom-right when stream is playing)
- Click anywhere on the video to unmute

### Management Commands

After setup, these scripts are available in the home directory:

| Script | Description |
|--------|-------------|
| `~/restart-kiosk.sh` | Restart the Chromium browser |
| `~/exit-kiosk.sh` | Stop kiosk mode |
| `~/set-kiosk-url.sh URL` | Change the server URL |

### Troubleshooting

**Exit kiosk mode temporarily:**
- Press `Alt+F4` (if keyboard connected)
- SSH in and run `~/exit-kiosk.sh`

**View logs:**
```bash
journalctl -u kiosk.service -f
```

**Change server URL:**
```bash
~/set-kiosk-url.sh https://new-server:8443
~/restart-kiosk.sh
```

**Certificate issues:**
```bash
# Re-install certificate
sudo cp rootCA.pem /usr/local/share/ca-certificates/school-announcements.crt
sudo update-ca-certificates
```

### Network Requirements

The Raspberry Pi needs network access to:
- Your announcements server (port 8443 for HTTPS or 8080 for HTTP)
- Internet (optional, for weather data)

### Multiple Displays

To set up multiple Raspberry Pi kiosks:

1. Flash Raspberry Pi OS to each SD card
2. Copy the setup files to each Pi
3. Run the setup script on each
4. Optionally give each a unique display name:
   ```bash
   sudo ./raspberry-pi-setup.sh https://SERVER:8443 "Lobby Display"
   ```

The server will track each display separately in the admin panel.
