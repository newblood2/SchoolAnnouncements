# Combined All-in-One Dockerfile
# Includes: Node.js API + Static Files + MediaMTX Streaming Server

FROM node:18-alpine

# Install dependencies for MediaMTX and process management
RUN apk add --no-cache curl supervisor

# Download MediaMTX (hardcoded version for reliability)
RUN curl -L -o /tmp/mediamtx.tar.gz "https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_amd64.tar.gz" \
    && tar -xzf /tmp/mediamtx.tar.gz -C /usr/local/bin mediamtx \
    && rm /tmp/mediamtx.tar.gz \
    && chmod +x /usr/local/bin/mediamtx

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
COPY config.js ./public/
COPY config.example.js ./public/
COPY service-worker.js ./public/

# Copy JavaScript files
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
RUN chmod +x /entrypoint.sh

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
    CMD wget --quiet --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start via entrypoint (properly passes environment variables)
CMD ["/entrypoint.sh"]
