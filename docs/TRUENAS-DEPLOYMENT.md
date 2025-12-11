# TrueNAS Scale Deployment Guide

This guide covers deploying the School Announcements Display System on TrueNAS Scale 25.10 using Docker Compose.

## Prerequisites

- TrueNAS Scale 25.10 or later
- Docker Compose support enabled
- Network access from displays to TrueNAS server

## Deployment Steps

### 1. Create Dataset for Application Data

1. In TrueNAS web UI, go to **Storage > Pools**
2. Create a new dataset: `school-announcements`
3. Note the path (e.g., `/mnt/pool/school-announcements`)

### 2. Transfer Files to TrueNAS

Copy the entire project to your TrueNAS server:

```bash
# From your local machine
scp -r school-announcements/ root@truenas:/mnt/pool/school-announcements/
```

Or use the TrueNAS file browser to upload files.

### 3. Prepare Configuration Files

SSH into your TrueNAS server:

```bash
ssh root@truenas
cd /mnt/pool/school-announcements
```

#### Create .env file:

```bash
cp .env.example .env
nano .env
```

Configure your environment:

```bash
# Security - Generate a strong key!
API_KEY=your-secure-api-key-here

# Timezone (match your school's timezone)
TZ=America/New_York

# Weather API (get from openweathermap.org)
WEATHER_API_KEY=your-weather-api-key

# CORS - Set to your server IP for production
CORS_ORIGIN=*
```

#### Configure config.js:

```bash
cp config.example.js config.js
nano config.js
```

Update with your school's information:
- School name
- Weather location

### 4. Create Required Files

Ensure these files exist (create if missing):

```bash
# Create empty JSON files for data persistence
echo '{}' > api/settings.json
echo '{}' > api/displays.json
echo '{}' > api/dismissal-history.json
echo '{}' > api/analytics.json

# Create uploads directory
mkdir -p api/uploads

# Create slides directory
mkdir -p slides
```

### 5. Set Permissions

TrueNAS may need specific permissions:

```bash
# Make sure Docker can read/write the data files
chmod 666 api/settings.json api/displays.json api/dismissal-history.json api/analytics.json
chmod 755 api/uploads slides
```

### 6. Deploy with Docker Compose

```bash
cd /mnt/pool/school-announcements
docker-compose up -d
```

### 7. Verify Deployment

Check that containers are running:

```bash
docker-compose ps
```

You should see three containers:
- `school-announcements` (nginx frontend)
- `school-api` (Node.js API)
- `school-streaming-server` (MediaMTX)

### 8. Access the Application

- **Main Display**: `http://truenas-ip:8080`
- **Admin Panel**: `http://truenas-ip:8080/admin.html`
- **Dismissal**: `http://truenas-ip:8080/dismissal.html`

## HTTPS Setup (Recommended)

For HTTPS with HTTP/2 support:

### 1. Install mkcert on your local machine

See main README for OS-specific instructions.

### 2. Generate Certificates

```bash
cd certs
./setup-certs.sh YOUR_TRUENAS_IP
```

### 3. Copy Certificates to TrueNAS

```bash
scp server.crt server.key root@truenas:/mnt/pool/school-announcements/certs/
```

### 4. Restart Containers

```bash
docker-compose down
docker-compose up -d
```

### 5. Install Root CA on Kiosks

Copy `rootCA.pem` to each kiosk display and install it as a trusted certificate (see main README).

## Migrating Existing Configuration

If you're migrating from another server with existing settings:

### 1. Export from Old Server

Copy these files from your existing installation:
- `api/settings.json` - All admin panel settings
- `api/displays.json` - Registered displays
- `api/uploads/` - Uploaded images
- `config.js` - School name, weather location
- `.env` - Environment variables (recreate API keys if needed)

### 2. Import to TrueNAS

```bash
# Copy settings (preserves all configuration)
scp api/settings.json root@truenas:/mnt/pool/school-announcements/api/
scp api/displays.json root@truenas:/mnt/pool/school-announcements/api/

# Copy uploads
scp -r api/uploads/ root@truenas:/mnt/pool/school-announcements/api/

# Copy config
scp config.js root@truenas:/mnt/pool/school-announcements/
```

### 3. Restart to Apply

```bash
docker-compose restart
```

## TrueNAS-Specific Considerations

### Storage

- Use a dedicated dataset for the application
- Consider using SSD storage for better performance
- Enable compression on the dataset (lz4 recommended)

### Networking

- Ensure firewall allows ports 8080 (HTTP), 8443 (HTTPS), 8889 (WebRTC)
- For streaming, also allow ports 1935 (RTMP), 8888 (HLS)

### Backup

TrueNAS makes backups easy:

1. Take snapshots of the `school-announcements` dataset
2. Or use replication to backup to another system

Key files to backup:
- `api/settings.json`
- `api/displays.json`
- `api/uploads/`
- `config.js`
- `.env`

### Updates

To update the application:

```bash
cd /mnt/pool/school-announcements
git pull  # If using git
docker-compose down
docker-compose up --build -d
```

## Troubleshooting

### Containers Won't Start

Check logs:
```bash
docker-compose logs -f
```

### Permission Denied Errors

```bash
# Fix file permissions
chmod 666 api/*.json
chmod -R 755 api/uploads slides
```

### Network Issues

Verify TrueNAS firewall settings allow the required ports.

### Display Not Connecting

1. Check that the display can reach the TrueNAS IP
2. Verify the URL is correct (http://truenas-ip:8080)
3. Check browser console for errors

## Support

For issues specific to this deployment:
1. Check the main [README](../README.md)
2. Review [Docker documentation](DOCKER.md)
3. Open an issue on GitHub
