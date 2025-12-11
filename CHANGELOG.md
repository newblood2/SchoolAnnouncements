# Changelog

All notable changes to the School Announcements Display System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-12-11

### Added
- **Dashboard Layout Editor** - Drag-and-drop widget placement on 16x9 grid
- **Multiple Slideshows** - Create and manage multiple slideshow sets
- **HTTPS/HTTP2 Support** - Improved performance with multiplexed connections
- **TrueNAS Deployment Guide** - Documentation for TrueNAS Scale deployment
- **Dark Mode** - Admin panel dark mode toggle
- **Analytics Dashboard** - Track display usage and slide views
- **Bell Schedule Widget** - Display current/upcoming class periods
- **Calendar Events Widget** - Show upcoming school events
- **Dismissal Reports** - Historical dismissal data and exports

### Changed
- Grid system updated from 12x6 to 16x9 for better TV aspect ratio
- Weather API key moved to server-side (.env) for security
- Improved real-time sync with Server-Sent Events
- Enhanced emergency alert system with custom colors
- Better slideshow interval management (prevents overlapping transitions)

### Fixed
- Fixed data persistence for dismissal history and analytics
- Fixed slideshow multiple instance bug (slides overlapping)
- Fixed SSE connection limits on HTTP/1.1
- Fixed timezone configuration (now uses environment variable)

### Security
- API key authentication for all write operations
- Rate limiting on API endpoints
- CORS configuration options
- Removed sensitive data from client-side config

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Basic announcement slideshow
- Weather widget
- Clock display
- Admin panel for configuration
- Emergency alert system
- Student dismissal management
- Livestream integration via MediaMTX
- Docker deployment support

---

## Migration Notes

### Upgrading from 1.x to 2.x

1. **Environment Variables**: Add `TZ` to your `.env` file
2. **Volume Mounts**: Add these to `docker-compose.yml`:
   ```yaml
   - ./api/dismissal-history.json:/app/dismissal-history.json
   - ./api/analytics.json:/app/analytics.json
   ```
3. **Grid Layout**: Existing layouts may need adjustment (grid changed from 12x6 to 16x9)
4. **Weather API**: Move `WEATHER_API_KEY` from `config.js` to `.env`
