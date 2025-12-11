# Combined All-in-One Dockerfile
# Includes: Node.js API + Static Files + MediaMTX Streaming Server

# Stage 1: Get MediaMTX from official image
FROM bluenviron/mediamtx:latest AS mediamtx

# Stage 2: Build the application
FROM node:18-alpine

# Install supervisor and curl (for health checks)
RUN apk add --no-cache supervisor curl

# Copy MediaMTX binary from official image
COPY --from=mediamtx /mediamtx /usr/local/bin/mediamtx

WORKDIR /app

# Install Node.js dependencies
COPY api/package*.json ./
RUN npm install --production

# Copy API files
COPY api/server.js ./
COPY api/security.js ./

# Copy frontend files to public directory
COPY index.html ./public/
COPY admin.html ./public/
COPY dismissal.html ./public/
COPY stream-viewer.html ./public/
COPY styles.css ./public/
COPY admin.css ./public/

# Copy all root JS files (config, admin, dismissal, service-worker, etc.)
COPY *.js ./public/

# Copy JS module files
COPY js/ ./public/js/

# Copy MediaMTX configuration
COPY streaming-server/mediamtx.yml /etc/mediamtx.yml

# Create directories for persistent data
RUN mkdir -p /app/data /app/public/uploads /app/public/slides

# Default empty JSON files (will be overwritten by volume mounts)
RUN echo '{}' > /app/data/settings.json && \
    echo '{}' > /app/data/displays.json && \
    echo '{}' > /app/data/dismissal-history.json && \
    echo '{}' > /app/data/analytics.json

# Copy supervisord configuration and entrypoint
COPY supervisord.conf /etc/supervisord.conf
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PUBLIC_DIR=/app/public

# Expose ports
# 8080 - Web UI + API
# 8889 - WebRTC/WHIP (OBS streaming)
# 1935 - RTMP (fallback)
# 8189 - WebRTC ICE
# 8888 - HLS (fallback)
EXPOSE 8080 8889 1935 8189 8189/udp 8888

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Start via entrypoint (properly passes environment variables)
CMD ["/entrypoint.sh"]
