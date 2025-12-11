# School Announcements API - Lightweight Node.js Container
# Version 2.0.0 with security enhancements
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including new security packages)
RUN npm install --production

# Copy application files
COPY server.js ./
COPY security.js ./

# Create data files with defaults if they don't exist
RUN echo '{}' > settings.json && echo '{}' > displays.json

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]
