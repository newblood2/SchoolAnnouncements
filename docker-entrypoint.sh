#!/bin/sh
set -e

CERT_FILE="/etc/nginx/certs/server.crt"
KEY_FILE="/etc/nginx/certs/server.key"
HTTP_CONF="/etc/nginx/nginx-http.conf"
HTTPS_CONF="/etc/nginx/nginx-https.conf"
ACTIVE_CONF="/etc/nginx/conf.d/default.conf"

echo "=========================================="
echo "  School Announcements - Starting Server"
echo "=========================================="

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "SSL certificates found - enabling HTTPS/HTTP2"
    cp "$HTTPS_CONF" "$ACTIVE_CONF"
    echo "  - HTTPS on port 443 (exposed as 8443)"
    echo "  - HTTP on port 80 redirects to HTTPS"
    echo "  - HTTP/2 enabled for better performance"
else
    echo "No SSL certificates found - using HTTP only"
    cp "$HTTP_CONF" "$ACTIVE_CONF"
    echo "  - HTTP on port 80 (exposed as 8080)"
    echo ""
    echo "To enable HTTPS/HTTP2:"
    echo "  1. Run: cd certs && ./setup-certs.sh YOUR_SERVER_IP"
    echo "  2. Restart: docker-compose restart"
fi

echo ""
echo "Starting nginx..."
echo "=========================================="

exec nginx -g 'daemon off;'
