# School Announcements Display - Docker Image
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx configurations (HTTP and HTTPS)
COPY nginx.conf /etc/nginx/nginx-https.conf
COPY nginx-http.conf /etc/nginx/nginx-http.conf

# Create certificates directory
RUN mkdir -p /etc/nginx/certs

# Create entrypoint script with proper Unix line endings
RUN printf '#!/bin/sh\n\
set -e\n\
CERT_FILE="/etc/nginx/certs/server.crt"\n\
KEY_FILE="/etc/nginx/certs/server.key"\n\
HTTP_CONF="/etc/nginx/nginx-http.conf"\n\
HTTPS_CONF="/etc/nginx/nginx-https.conf"\n\
ACTIVE_CONF="/etc/nginx/conf.d/default.conf"\n\
echo "=========================================="\n\
echo "  School Announcements - Starting Server"\n\
echo "=========================================="\n\
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then\n\
    echo "SSL certificates found - enabling HTTPS/HTTP2"\n\
    cp "$HTTPS_CONF" "$ACTIVE_CONF"\n\
    echo "  - HTTPS on port 443 (exposed as 8443)"\n\
    echo "  - HTTP on port 80 redirects to HTTPS"\n\
    echo "  - HTTP/2 enabled for better performance"\n\
else\n\
    echo "No SSL certificates found - using HTTP only"\n\
    cp "$HTTP_CONF" "$ACTIVE_CONF"\n\
    echo "  - HTTP on port 80 (exposed as 8080)"\n\
    echo ""\n\
    echo "To enable HTTPS/HTTP2:"\n\
    echo "  1. Run: cd certs && ./setup-certs.sh YOUR_SERVER_IP"\n\
    echo "  2. Restart: docker-compose restart"\n\
fi\n\
echo ""\n\
echo "Starting nginx..."\n\
echo "=========================================="\n\
exec nginx -g "daemon off;"\n\
' > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Copy application files
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY config.js /usr/share/nginx/html/
COPY service-worker.js /usr/share/nginx/html/

# Copy admin panel files
COPY admin.html /usr/share/nginx/html/
COPY admin.css /usr/share/nginx/html/
COPY admin.js /usr/share/nginx/html/
COPY admin-api-adapter.js /usr/share/nginx/html/
COPY admin-roster.js /usr/share/nginx/html/
COPY admin-displays.js /usr/share/nginx/html/
COPY admin-slides.js /usr/share/nginx/html/
COPY admin-emergency.js /usr/share/nginx/html/
COPY admin-dismissal-reports.js /usr/share/nginx/html/
COPY admin-bell-schedule.js /usr/share/nginx/html/
COPY admin-calendar.js /usr/share/nginx/html/
COPY admin-analytics.js /usr/share/nginx/html/
COPY admin-notifications.js /usr/share/nginx/html/
COPY admin-layout.js /usr/share/nginx/html/

# Copy dismissal manager files
COPY dismissal.html /usr/share/nginx/html/
COPY dismissal.js /usr/share/nginx/html/

# Copy stream viewer
COPY stream-viewer.html /usr/share/nginx/html/

# Copy JavaScript modules
COPY js/ /usr/share/nginx/html/js/

# Create a health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80 || exit 1

# Expose ports (80 for HTTP, 443 for HTTPS)
EXPOSE 80 443

# Use custom entrypoint that selects HTTP or HTTPS config
ENTRYPOINT ["/docker-entrypoint.sh"]
