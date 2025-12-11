# Docker Deployment Guide

The easiest way to deploy the School Announcements Display System!

## Quick Start (3 Steps)

### 1. Install Docker

**Windows/Mac:**
- Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Install and start Docker Desktop

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

**Raspberry Pi:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in
```

### 2. Configure Your Settings

Edit `config.js` and configure for your school:
```javascript
SCHOOL_NAME: 'Your School Name',
WEATHER_API_KEY: 'your_actual_api_key_here',
LOCATION: 'Bel Air,MD,US',
USE_IMAGE_SLIDES: true,  // Use images from slides/ folder
LIVESTREAM_URL: null,    // Optional: YouTube or OBS stream URL
AUTO_DETECT_LIVESTREAM: true,  // Auto-switch when stream is online
```

### 3. Add Your Announcement Images

1. Place your announcement images in the `slides/` folder
2. Update `slides/slides.json` with your image filenames:
   ```json
   {
     "images": [
       "monday-announcements.png",
       "upcoming-events.jpg"
     ]
   }
   ```

**Persistent Volumes:** The `slides/` folder is mounted as a persistent volume. You can update images without rebuilding the container - just refresh the browser!

### 4. Start the Application

**Linux/Mac/Raspberry Pi:**
```bash
./start.sh
```

**Windows (PowerShell):**
```powershell
docker compose up -d --build
```

**Windows (Command Prompt):**
```cmd
docker-compose up -d --build
```

The app will be available at: **http://localhost:8080**

## Management Commands

### Start/Restart
```bash
./start.sh          # Linux/Mac
docker compose up -d --build  # Windows
```

### Stop
```bash
./stop.sh           # Linux/Mac
docker compose down # Windows
```

### View Logs
```bash
docker compose logs -f
```

### Update Slides (No Rebuild Required!)
Thanks to persistent volumes, updating slides is easy:

```bash
# 1. Add/remove images in the slides/ folder
# 2. Update slides/slides.json with the new image list
# 3. Refresh the browser (or wait for auto-refresh)
```

**No container rebuild needed!** Images update immediately.

### Update Configuration
After editing `config.js`:
```bash
# Restart container (no rebuild needed, it's mounted as a volume)
docker compose restart
```

### Update HTML/CSS/JS
After editing `index.html`, `styles.css`, or `script.js`:
```bash
./start.sh          # Rebuilds and restarts
```

## Deployment Scenarios

### 1. Raspberry Pi Setup (Recommended for TVs)

**Full Kiosk Setup:**

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 2. Clone/copy your announcement files
cd /home/pi/
# (copy your files here)

# 3. Configure weather API in config.js

# 4. Start container
./start.sh

# 5. Install Chromium
sudo apt-get update
sudo apt-get install chromium-browser unclutter

# 6. Auto-start on boot
mkdir -p ~/.config/lxsession/LXDE-pi/
nano ~/.config/lxsession/LXDE-pi/autostart
```

Add to autostart file:
```
@xset s off
@xset -dpms
@xset s noblank
@chromium-browser --kiosk --app=http://localhost:8080
@unclutter -idle 0
```

**Reboot and it will auto-start in kiosk mode!**

### 2. Linux Server

```bash
# Start container
docker compose up -d --build

# Auto-restart on boot
docker update --restart unless-stopped school-announcements

# Access from other devices on network
# Find your IP: ip addr show
# Access at: http://YOUR_IP:8080
```

### 3. Windows PC

1. Start Docker Desktop
2. Open PowerShell in project folder
3. Run: `docker compose up -d --build`
4. Open Chrome to: http://localhost:8080
5. Press F11 for fullscreen

**Auto-start on Windows boot:**
- Press Win+R, type `shell:startup`
- Create shortcut to `start-windows.bat`:
```batch
@echo off
cd C:\path\to\SchoolAnnouncements
docker compose up -d
timeout 5
start chrome --kiosk --app=http://localhost:8080
```

### 4. Mac

```bash
./start.sh
open http://localhost:8080
# Press Cmd+Shift+F for fullscreen
```

### 5. Cloud Deployment (AWS, Azure, GCP)

```bash
# On your cloud instance
git clone <your-repo>
cd SchoolAnnouncements
docker compose up -d --build

# Open firewall port 8080
# Access via: http://YOUR_SERVER_IP:8080
```

## Port Configuration

Default port is **8080**. To change it, edit `docker-compose.yml`:

```yaml
ports:
  - "80:80"     # Use port 80
  # or
  - "3000:80"   # Use port 3000
```

## Timezone Configuration

Edit `docker-compose.yml` to set your timezone:

```yaml
environment:
  - TZ=America/New_York  # Eastern Time
  # - TZ=America/Chicago # Central Time
  # - TZ=America/Denver  # Mountain Time
  # - TZ=America/Los_Angeles  # Pacific Time
```

[Full timezone list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs

# Check if port is in use
sudo lsof -i :8080  # Linux/Mac
netstat -ano | findstr :8080  # Windows
```

### Can't access from other devices
```bash
# Make sure firewall allows port 8080
sudo ufw allow 8080  # Linux

# Windows: Add inbound rule in Windows Firewall
```

### Weather not loading
1. Check API key in `config.js`
2. Verify internet connection in container:
   ```bash
   docker exec school-announcements ping -c 3 google.com
   ```

### Changes not appearing
```bash
# Rebuild the container
docker compose down
docker compose up -d --build
```

## Performance Tips

**Raspberry Pi:**
- Use Raspberry Pi 3B+ or newer for best performance
- Use wired ethernet instead of WiFi
- Allocate at least 1GB RAM to the system

**Memory Management:**
- Container uses ~50MB RAM
- App auto-refreshes at 3 AM daily
- Chromium kiosk mode uses ~200-300MB RAM

## Security Considerations

### For Public-Facing Deployments:

1. **Use HTTPS** with a reverse proxy (nginx/traefik)
2. **Firewall** - only open necessary ports
3. **Regular Updates:**
   ```bash
   docker compose pull
   docker compose up -d --build
   ```

### Example with Traefik (HTTPS):

```yaml
# docker-compose.yml additions
services:
  announcements:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.announcements.rule=Host(`announcements.yourschool.edu`)"
      - "traefik.http.routers.announcements.tls=true"
      - "traefik.http.routers.announcements.tls.certresolver=letsencrypt"
```

## Monitoring

### Check if container is running:
```bash
docker ps
```

### Check container health:
```bash
docker inspect school-announcements | grep -A 10 Health
```

### Auto-restart if crashed:
Already configured with `restart: unless-stopped`

## Backup & Recovery

### Backup your configuration:
```bash
tar -czf announcements-backup.tar.gz config.js index.html
```

### Restore:
```bash
tar -xzf announcements-backup.tar.gz
./start.sh
```

## Advanced: Multi-TV Deployment

Deploy one container per TV with different content:

```yaml
# docker-compose-tv1.yml
services:
  tv1:
    build: .
    ports:
      - "8081:80"
    volumes:
      - ./tv1-content:/usr/share/nginx/html:ro

# docker-compose-tv2.yml
services:
  tv2:
    build: .
    ports:
      - "8082:80"
    volumes:
      - ./tv2-content:/usr/share/nginx/html:ro
```

## Support

- Check logs: `docker compose logs -f`
- Verify config: `cat config.js`
- Test weather API: Visit https://openweathermap.org/api with your key
- Restart container: `docker compose restart`

---

**Happy Announcing! 📢**
