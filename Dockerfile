# Combined Single-Container Dockerfile
# Serves both the frontend and API from one Node.js container

FROM node:18-alpine

WORKDIR /app

# Install dependencies
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
COPY *.js ./public/
COPY js/ ./public/js/

# Create directories for persistent data
RUN mkdir -p /app/data /app/public/uploads /app/public/slides

# Default empty JSON files (will be overwritten by volume mounts)
RUN echo '{}' > /app/data/settings.json && \
    echo '{}' > /app/data/displays.json && \
    echo '{}' > /app/data/dismissal-history.json && \
    echo '{}' > /app/data/analytics.json

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PUBLIC_DIR=/app/public

# Expose single port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start the server
CMD ["node", "server.js"]
