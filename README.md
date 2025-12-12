# School Announcements Display System

A modern, real-time digital signage system designed for schools. Display announcements, weather, livestreams, and manage student dismissal across multiple screens with centralized control.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)

## Features

### Display System
- **Real-time Sync** - All displays update instantly via Server-Sent Events (SSE)
- **Custom Themes** - Fully customizable color schemes with preset and custom themes
- **Slideshow** - Multiple slide types (welcome, events, reminders, quotes, images, custom HTML)
- **Weather Widget** - Current conditions and forecast display
- **Clock & Date** - Large, readable time display

### Livestream Integration
- **WebRTC Streaming** - Ultra-low latency via WHIP protocol
- **OBS Integration** - Direct streaming from OBS Studio
- **Auto-Detection** - Automatically switches to livestream when active
- **Fallback Support** - RTMP streaming as backup option

### Emergency Alerts
- **One-Click Alerts** - Lockdown, Evacuation, Shelter in Place, Severe Weather, Medical
- **Custom Alerts** - Create custom emergency messages with configurable colors
- **Instant Override** - Immediately takes over all connected displays
- **Audio Alerts** - Optional sound notification

### Student Dismissal
- **Roster Management** - Import/manage student lists with grades and transportation
- **Visual Display** - Large, clear display of students being called
- **Batch Calling** - Call multiple students at once
- **Fuzzy Search** - Quick student lookup with fuzzy matching

### Admin Features
- **Scheduled Slides** - Set date/time ranges for slides to appear
- **Rich Text Editor** - WYSIWYG editor for slide content
- **Image Upload** - Direct image upload for slides
- **Live Preview** - See changes before publishing
- **Display Manager** - Monitor and control all connected displays

## Screenshots

<!-- Add screenshots here -->
<details>
<summary>Click to view screenshots</summary>

### Main Display
*Screenshot of the main announcement display*

### Admin Panel
*Screenshot of the admin panel*

### Emergency Alert
*Screenshot of emergency alert mode*

### Dismissal Display
*Screenshot of student dismissal display*

</details>

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [OBS Studio](https://obsproject.com/) (optional, for livestreaming)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/newblood2/SchoolAnnouncements.git
   cd SchoolAnnouncements
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start the system**
   ```bash
   docker-compose up -d
   ```

4. **Access the displays**
   - Main Display: http://localhost:8080
   - Admin Panel: http://localhost:8080/admin.html
   - Dismissal Manager: http://localhost:8080/dismissal.html

### Default Credentials
- **Admin Password**: Set via `ADMIN_PASSWORD` in `.env` (default: `admin123`)
- **API Key**: Set via `API_KEY` in `.env` (default: `change-this-in-production`)

> **Important**: Change the default credentials before deploying!

### Using Pre-built Docker Image

You can also pull the pre-built image from GitHub Container Registry:

```bash
docker pull ghcr.io/newblood2/schoolannouncements:main
```

Or use it directly in your docker-compose.yml:
```yaml
services:
  school-announcements:
    image: ghcr.io/newblood2/schoolannouncements:main
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
      - ./slides:/app/public/slides
      - ./uploads:/app/public/uploads
    environment:
      - API_KEY=your-secret-key
      - WEATHER_API_KEY=your-openweathermap-key
      - TZ=America/New_York
```

### TrueNAS Scale Deployment

See [docs/TRUENAS-DEPLOYMENT.md](docs/TRUENAS-DEPLOYMENT.md) for deploying on TrueNAS Scale using the Custom App feature.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_PASSWORD` | Admin panel login password | `admin123` |
| `API_KEY` | API authentication key | `change-this-in-production` |
| `TZ` | Timezone | `America/New_York` |
| `WEATHER_API_KEY` | OpenWeatherMap API key | (optional) |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |

### Weather Setup

1. Get a free API key from [OpenWeatherMap](https://openweathermap.org/api)
2. Add to your `.env` file:
   ```
   WEATHER_API_KEY=your_api_key_here
   ```
3. Configure location in `config.js`

### Livestream Setup

See [OBS-MEDIAMTX-SETUP.md](docs/OBS-MEDIAMTX-SETUP.md) for detailed streaming configuration.

**Quick Setup:**

1. **Configure Display** (Admin Panel → Livestream):
   - Enable livestream
   - Set URL to `stream-viewer.html` (auto-detects MediaMTX server)
   - Enable "Auto-detect when livestream is online"

2. **Configure OBS** (WHIP - Recommended for OBS 29+):
   - Go to Settings → Stream
   - Set Service to "WHIP"
   - Set Server to `http://YOUR_SERVER_IP:8080/stream/announcements/whip`
   - Leave Bearer Token empty (anonymous publishing is enabled by default)
   - Start streaming

The display will automatically switch to the livestream when OBS starts broadcasting.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      Docker Network                        │
├─────────────────────────────┬─────────────────────────────┤
│                             │                             │
│  ┌───────────────────────┐  │  ┌───────────────────────┐  │
│  │  School Announcements │  │  │       MediaMTX        │  │
│  │  (Node.js + Static)   │  │  │   Streaming Server    │  │
│  │       :8080           │  │  │   :8889 (WebRTC)      │  │
│  │                       │  │  │   :1935 (RTMP)        │  │
│  └───────────────────────┘  │  └───────────────────────┘  │
│             ▲               │             ▲               │
└─────────────┼───────────────┴─────────────┼───────────────┘
              │                             │
    ┌─────────┴─────────┐           ┌───────┴───────┐
    │  Browser/Display  │           │  OBS Studio   │
    └───────────────────┘           └───────────────┘
```

## File Structure

```
SchoolAnnouncements/
├── api/                    # Node.js API server
│   ├── server.js          # Main server (API + static files)
│   └── security.js        # Security utilities
├── data/                   # Persistent data (mount as volume)
│   ├── settings.json      # App settings
│   ├── displays.json      # Connected displays
│   ├── dismissal-history.json  # Dismissal records
│   └── analytics.json     # Usage analytics
├── js/                     # Frontend JavaScript modules
│   ├── theme-loader.js    # Real-time theme updates
│   ├── emergency-alert.js # Emergency alert display
│   ├── livestream.js      # Livestream integration
│   └── ...
├── streaming-server/       # MediaMTX configuration
├── docs/                   # Documentation
├── slides/                 # Custom slide images (mount as volume)
├── uploads/                # Uploaded images (mount as volume)
├── docker-compose.yml      # Docker orchestration
├── Dockerfile             # Combined Node.js container
├── config.js              # Frontend configuration
└── .env                   # Environment variables
```

## HTTPS Setup (Optional)

For production deployments requiring HTTPS, place a reverse proxy (like Nginx, Traefik, or Caddy) in front of the application.

**Using Traefik (recommended for Docker):**
```yaml
# Add to docker-compose.yml
services:
  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./certs:/certs
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"

  school-announcements:
    labels:
      - "traefik.http.routers.school.rule=Host(`announcements.local`)"
      - "traefik.http.routers.school.tls=true"
```

**Using Nginx:**
See `docker-compose.multi.yml` and `Dockerfile.nginx` for the multi-container setup with Nginx reverse proxy.

## Raspberry Pi Kiosk Setup

Set up Raspberry Pi devices as dedicated announcement displays.

### Quick Setup

1. **Flash Raspberry Pi OS** (with Desktop) to an SD card

2. **Copy setup files to the Pi**:
   ```bash
   scp certs/rootCA.pem pi@raspberrypi:~/
   scp kiosk/raspberry-pi-setup.sh pi@raspberrypi:~/
   ```

3. **Run the setup script**:
   ```bash
   ssh pi@raspberrypi
   chmod +x raspberry-pi-setup.sh
   sudo ./raspberry-pi-setup.sh https://YOUR_SERVER_IP:8443
   sudo reboot
   ```

The Pi will automatically boot into fullscreen kiosk mode.

### What Gets Configured

- Chromium browser in kiosk mode (fullscreen, no toolbars)
- SSL certificate installed (no security warnings)
- Auto-start on boot with auto-login
- Screen blanking disabled
- Mouse cursor hidden after inactivity
- Management scripts for easy maintenance

### Management Commands

After setup, SSH into the Pi to use these commands:

```bash
~/restart-kiosk.sh        # Restart browser
~/exit-kiosk.sh           # Exit kiosk mode
~/set-kiosk-url.sh URL    # Change server URL
```

### Multiple Displays

For multiple Pis, give each a unique name:
```bash
sudo ./raspberry-pi-setup.sh https://SERVER:8443 "Cafeteria"
sudo ./raspberry-pi-setup.sh https://SERVER:8443 "Main Office"
```

See [kiosk/README.md](kiosk/README.md) for detailed instructions.

## Security Considerations

### For Local Network Use
This system is designed for local network deployment. For local-only use:
- Change default passwords in `.env`
- Ensure your network is properly secured
- Enable HTTPS/HTTP2 for better security and performance

### For Internet-Facing Deployment
If exposing to the internet, additional steps are required:

1. **Use HTTPS** - Already configured with mkcert for local networks. For internet use, consider Let's Encrypt
2. **Strong Passwords** - Use strong, unique passwords
3. **Firewall** - Only expose necessary ports (8080/8443)
4. **Updates** - Keep Docker images updated
5. **Rate Limiting** - Already implemented in API

See [docs/DEPLOYMENT-GUIDE.md](docs/DEPLOYMENT-GUIDE.md) for production deployment instructions.

## API Documentation

### Authentication
All write operations require authentication via session token:
```
POST /api/auth/login
Body: { "apiKey": "your-api-key" }
Returns: { "sessionToken": "..." }
```

Use the session token in subsequent requests:
```
Header: X-Session-Token: your-session-token
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all settings |
| POST | `/api/settings` | Update all settings |
| GET | `/api/settings/stream` | SSE stream for real-time updates |
| POST | `/api/emergency/alert` | Send emergency alert |
| POST | `/api/emergency/cancel` | Cancel emergency alert |
| GET | `/api/displays` | List connected displays |
| POST | `/api/upload/image` | Upload image |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [MediaMTX](https://github.com/bluenviron/mediamtx) - Streaming server
- [Quill](https://quilljs.com/) - Rich text editor
- [OpenWeatherMap](https://openweathermap.org/) - Weather data

## Support

If you encounter any issues or have questions:
1. Check the existing issues
2. Create a new issue with detailed information

---

Made with care for schools everywhere.
