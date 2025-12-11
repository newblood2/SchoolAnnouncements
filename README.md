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
   git clone https://github.com/Wyattech/SchoolAnnouncements.git
   cd school-announcements
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

5. **(Recommended) Enable HTTPS/HTTP2**

   For better performance and security, especially with multiple kiosks:
   ```bash
   # Install mkcert (see HTTPS section below for your OS)
   cd certs
   ./setup-certs.ps1 -ServerIP "YOUR_SERVER_IP"  # Windows
   # OR
   ./setup-certs.sh YOUR_SERVER_IP               # Linux/macOS

   # Restart Docker
   cd ..
   docker-compose down && docker-compose up -d
   ```

   Then access via: https://YOUR_SERVER_IP:8443

### Default Credentials
- **Admin Password**: Set via `ADMIN_PASSWORD` in `.env` (default: `admin123`)
- **API Key**: Set via `API_KEY` in `.env` (default: `change-this-in-production`)

> **Important**: Change the default credentials before deploying!

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

**Quick WHIP Setup (Recommended):**
1. In OBS, go to Settings > Stream
2. Set Service to "WHIP"
3. Set Server to `http://your-server:8080/stream/mystream/whip`
4. Start streaming

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Network                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│                 │                 │                         │
│  ┌───────────┐  │  ┌───────────┐  │  ┌───────────────────┐  │
│  │  Nginx    │  │  │  Node.js  │  │  │    MediaMTX       │  │
│  │  :8080    │◄─┼─►│  API      │  │  │  Streaming Server │  │
│  │           │  │  │  :3000    │  │  │  :8889 (WebRTC)   │  │
│  └───────────┘  │  └───────────┘  │  │  :1935 (RTMP)     │  │
│       ▲         │       ▲         │  └───────────────────┘  │
│       │         │       │         │           ▲             │
└───────┼─────────┴───────┼─────────┴───────────┼─────────────┘
        │                 │                     │
   ┌────┴────┐      ┌─────┴─────┐         ┌─────┴─────┐
   │ Browser │      │ Settings  │         │    OBS    │
   │ Display │      │   JSON    │         │  Studio   │
   └─────────┘      └───────────┘         └───────────┘
```

## File Structure

```
school-announcements/
├── api/                    # Node.js API server
│   ├── server.js          # Main API server
│   ├── security.js        # Security utilities
│   ├── settings.json      # Persistent settings
│   └── uploads/           # Uploaded images
├── certs/                  # SSL certificates (generated)
│   ├── setup-certs.sh     # Certificate generator (Linux/macOS)
│   ├── setup-certs.ps1    # Certificate generator (Windows)
│   ├── server.crt         # SSL certificate (generated)
│   ├── server.key         # Private key (generated)
│   └── rootCA.pem         # Root CA to install on kiosks
├── kiosk/                  # Kiosk display setup scripts
│   └── raspberry-pi-setup.sh  # Raspberry Pi kiosk installer
├── js/                     # Frontend JavaScript modules
│   ├── theme-loader.js    # Real-time theme updates
│   ├── emergency-alert.js # Emergency alert display
│   ├── livestream.js      # Livestream integration
│   └── ...
├── streaming-server/       # MediaMTX configuration
├── docs/                   # Documentation
├── docker-compose.yml      # Docker orchestration
├── Dockerfile             # Nginx frontend container
├── nginx.conf             # Nginx HTTPS configuration
├── nginx-http.conf        # Nginx HTTP fallback configuration
├── config.js              # Frontend configuration
└── .env                   # Environment variables
```

## HTTPS / HTTP2 Setup (Recommended)

Enabling HTTPS provides better security and enables HTTP/2, which significantly improves performance by allowing multiple requests over a single connection (eliminates the 6-connection browser limit).

### Why HTTP/2?

| Feature | HTTP/1.1 | HTTP/2 |
|---------|----------|--------|
| Connections per domain | 6 max | Unlimited (multiplexed) |
| Page load with many assets | Slow (queued) | Fast (parallel) |
| Real-time updates (SSE) | May block other requests | Works smoothly |

### Quick Setup (5 minutes)

#### Step 1: Install mkcert

**Windows (PowerShell as Administrator):**
```powershell
choco install mkcert
# OR with Scoop:
scoop install mkcert
```

**macOS:**
```bash
brew install mkcert
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

#### Step 2: Generate Certificates

```bash
# Navigate to certs directory
cd certs

# Windows (PowerShell):
.\setup-certs.ps1 -ServerIP "192.168.1.100"

# Linux/macOS:
chmod +x setup-certs.sh
./setup-certs.sh 192.168.1.100
```

Replace `192.168.1.100` with your server's actual IP address.

#### Step 3: Restart Docker

```bash
docker-compose down && docker-compose up -d
```

#### Step 4: Access via HTTPS

- **HTTPS**: https://192.168.1.100:8443
- **HTTP** (redirects to HTTPS): http://192.168.1.100:8080

### Installing Root CA on Kiosk Devices

After generating certificates, you need to install the root CA on each kiosk device to avoid certificate warnings.

The root CA file is located at: `certs/rootCA.pem`

#### Windows

1. Copy `rootCA.pem` to the kiosk
2. Double-click the file
3. Click "Install Certificate"
4. Select "Local Machine" → Next
5. Select "Place all certificates in the following store"
6. Click "Browse" → select "Trusted Root Certification Authorities"
7. Click Next → Finish

**Or via Command Line (as Administrator):**
```cmd
certutil -addstore -f "ROOT" rootCA.pem
```

**Or via Group Policy (for multiple machines):**
1. Open Group Policy Management
2. Create/edit a GPO linked to your kiosk OU
3. Navigate to: Computer Configuration → Policies → Windows Settings → Security Settings → Public Key Policies → Trusted Root Certification Authorities
4. Import `rootCA.pem`

#### macOS

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain rootCA.pem
```

#### Linux (Debian/Ubuntu)

```bash
sudo cp rootCA.pem /usr/local/share/ca-certificates/school-announcements.crt
sudo update-ca-certificates
```

#### Linux (Fedora/RHEL)

```bash
sudo cp rootCA.pem /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust
```

#### Chromebook (Managed)

Use Google Admin Console to deploy the certificate via Chrome Enterprise policy.

### Verifying HTTP/2

Open Chrome DevTools (F12) → Network tab → Right-click column headers → Enable "Protocol".
You should see "h2" for HTTP/2 connections.

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
