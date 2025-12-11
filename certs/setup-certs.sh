#!/bin/bash
# =============================================================================
# SSL Certificate Setup Script for School Announcements
# =============================================================================
# This script generates SSL certificates using mkcert for local network HTTPS.
#
# Prerequisites:
#   - mkcert installed (https://github.com/FiloSottile/mkcert)
#   - Run this script on the SERVER machine
#
# Usage:
#   ./setup-certs.sh [server-ip] [server-hostname]
#
# Example:
#   ./setup-certs.sh 192.168.1.100 school-server
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_IP="${1:-}"
SERVER_HOSTNAME="${2:-school-announcements}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  School Announcements - SSL Certificate Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo -e "${RED}Error: mkcert is not installed.${NC}"
    echo ""
    echo "Please install mkcert first:"
    echo ""
    echo "  Windows (with Chocolatey):"
    echo "    choco install mkcert"
    echo ""
    echo "  Windows (with Scoop):"
    echo "    scoop install mkcert"
    echo ""
    echo "  macOS (with Homebrew):"
    echo "    brew install mkcert"
    echo ""
    echo "  Linux (Debian/Ubuntu):"
    echo "    sudo apt install libnss3-tools"
    echo "    curl -JLO https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64"
    echo "    chmod +x mkcert-v1.4.4-linux-amd64"
    echo "    sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert"
    echo ""
    exit 1
fi

# Get server IP if not provided
if [ -z "$SERVER_IP" ]; then
    echo -e "${YELLOW}Enter the server's IP address (e.g., 192.168.1.100):${NC}"
    read -r SERVER_IP
    if [ -z "$SERVER_IP" ]; then
        echo -e "${RED}Error: Server IP is required.${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  Server IP: $SERVER_IP"
echo "  Server Hostname: $SERVER_HOSTNAME"
echo "  Certificate Directory: $SCRIPT_DIR"
echo ""

# Step 1: Install the local CA (if not already installed)
echo -e "${BLUE}Step 1: Installing local Certificate Authority...${NC}"
mkcert -install
echo -e "${GREEN}✓ Local CA installed${NC}"
echo ""

# Step 2: Generate certificates
echo -e "${BLUE}Step 2: Generating SSL certificates...${NC}"
cd "$SCRIPT_DIR"

# Generate certificate for server IP, hostname, and localhost
mkcert -cert-file server.crt -key-file server.key \
    "$SERVER_IP" \
    "$SERVER_HOSTNAME" \
    "localhost" \
    "127.0.0.1" \
    "::1"

echo -e "${GREEN}✓ Certificates generated:${NC}"
echo "    - server.crt (certificate)"
echo "    - server.key (private key)"
echo ""

# Step 3: Show CA location
CA_ROOT=$(mkcert -CAROOT)
echo -e "${BLUE}Step 3: Certificate Authority Location${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT: To enable HTTPS on kiosk devices without warnings,${NC}"
echo -e "${YELLOW}you must install the root CA certificate on each device.${NC}"
echo ""
echo "Root CA location: $CA_ROOT"
echo ""
echo "The root CA file is: ${CA_ROOT}/rootCA.pem"
echo ""

# Copy CA to certs directory for easy distribution
if [ -f "${CA_ROOT}/rootCA.pem" ]; then
    cp "${CA_ROOT}/rootCA.pem" "$SCRIPT_DIR/rootCA.pem"
    echo -e "${GREEN}✓ Root CA copied to: $SCRIPT_DIR/rootCA.pem${NC}"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Setup Complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo ""
echo "1. Restart Docker to use the new certificates:"
echo "   docker-compose down && docker-compose up -d"
echo ""
echo "2. Access the system via HTTPS:"
echo "   https://${SERVER_IP}:8443"
echo "   https://${SERVER_HOSTNAME}:8443 (if DNS configured)"
echo ""
echo "3. Install the root CA on each kiosk device:"
echo "   - Copy 'rootCA.pem' to each device"
echo "   - See README.md for installation instructions per OS"
echo ""
echo -e "${YELLOW}Note: HTTP (port 8080) will redirect to HTTPS (port 8443)${NC}"
echo ""
