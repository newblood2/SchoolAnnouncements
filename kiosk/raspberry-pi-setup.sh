#!/bin/bash
# =============================================================================
# Raspberry Pi Kiosk Setup Script for School Announcements
# =============================================================================
# This script sets up a Raspberry Pi as a kiosk display for the School
# Announcements system. It installs the SSL certificate, configures Chromium
# to run in kiosk mode, and sets up auto-start on boot.
#
# Usage:
#   1. Copy this script and rootCA.pem to your Raspberry Pi
#   2. Run: chmod +x raspberry-pi-setup.sh
#   3. Run: sudo ./raspberry-pi-setup.sh
#
# Requirements:
#   - Raspberry Pi OS (with desktop)
#   - rootCA.pem file in the same directory
#   - Network connection to the announcements server
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - EDIT THESE VALUES
SERVER_URL="${1:-}"
DISPLAY_NAME="${2:-Kiosk}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  School Announcements - Raspberry Pi Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (sudo ./raspberry-pi-setup.sh)${NC}"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER="${SUDO_USER:-pi}"
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)

# Get server URL if not provided
if [ -z "$SERVER_URL" ]; then
    echo -e "${YELLOW}Enter the server URL (e.g., https://192.168.1.100:8443):${NC}"
    read -r SERVER_URL
    if [ -z "$SERVER_URL" ]; then
        echo -e "${RED}Error: Server URL is required.${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  Server URL: $SERVER_URL"
echo "  Display Name: $DISPLAY_NAME"
echo "  User: $ACTUAL_USER"
echo "  Home: $ACTUAL_HOME"
echo ""

# =============================================================================
# Step 1: Update system
# =============================================================================
echo -e "${BLUE}Step 1: Updating system packages...${NC}"
apt-get update -qq
apt-get upgrade -y -qq
echo -e "${GREEN}✓ System updated${NC}"
echo ""

# =============================================================================
# Step 2: Install required packages
# =============================================================================
echo -e "${BLUE}Step 2: Installing required packages...${NC}"
apt-get install -y -qq \
    chromium-browser \
    unclutter \
    xdotool \
    sed \
    libnss3-tools \
    ca-certificates
echo -e "${GREEN}✓ Packages installed${NC}"
echo ""

# =============================================================================
# Step 3: Install SSL Certificate
# =============================================================================
echo -e "${BLUE}Step 3: Installing SSL certificate...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CA_FILE="$SCRIPT_DIR/rootCA.pem"

if [ ! -f "$CA_FILE" ]; then
    echo -e "${RED}Error: rootCA.pem not found in $SCRIPT_DIR${NC}"
    echo "Please copy rootCA.pem from the server's certs/ directory"
    exit 1
fi

# Install system-wide CA
cp "$CA_FILE" /usr/local/share/ca-certificates/school-announcements.crt
update-ca-certificates
echo -e "${GREEN}✓ System CA certificate installed${NC}"

# Install for Chromium (NSS database)
NSSDB="$ACTUAL_HOME/.pki/nssdb"
mkdir -p "$NSSDB"
chown -R $ACTUAL_USER:$ACTUAL_USER "$ACTUAL_HOME/.pki"

# Remove old cert if exists, then add new one
certutil -d sql:$NSSDB -D -n "School Announcements CA" 2>/dev/null || true
certutil -d sql:$NSSDB -A -n "School Announcements CA" -t "TC,C,T" -i "$CA_FILE"
chown -R $ACTUAL_USER:$ACTUAL_USER "$NSSDB"
echo -e "${GREEN}✓ Chromium CA certificate installed${NC}"
echo ""

# =============================================================================
# Step 4: Configure display settings
# =============================================================================
echo -e "${BLUE}Step 4: Configuring display settings...${NC}"

# Disable screen blanking
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/10-monitor.conf << 'EOF'
Section "ServerFlags"
    Option "BlankTime" "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime" "0"
EndSection
EOF

# Disable screen saver via lightdm
if [ -f /etc/lightdm/lightdm.conf ]; then
    sed -i 's/^#xserver-command=X$/xserver-command=X -s 0 -dpms/' /etc/lightdm/lightdm.conf
fi

echo -e "${GREEN}✓ Display settings configured (no screen blanking)${NC}"
echo ""

# =============================================================================
# Step 5: Create kiosk startup script
# =============================================================================
echo -e "${BLUE}Step 5: Creating kiosk startup script...${NC}"

KIOSK_SCRIPT="$ACTUAL_HOME/kiosk.sh"
cat > "$KIOSK_SCRIPT" << EOF
#!/bin/bash
# School Announcements Kiosk Startup Script
# Auto-generated by raspberry-pi-setup.sh

# Configuration
URL="$SERVER_URL"
DISPLAY_NAME="$DISPLAY_NAME"

# Enable audio auto-unmute for kiosk mode
# Appends ?kiosk=1 to enable audio in stream-viewer.html
if [[ "\$URL" != *"?"* ]]; then
    URL="\${URL}?kiosk=1"
elif [[ "\$URL" != *"kiosk=1"* ]]; then
    URL="\${URL}&kiosk=1"
fi

# Wait for network
echo "Waiting for network..."
while ! ping -c 1 -W 1 8.8.8.8 &> /dev/null; do
    sleep 1
done
echo "Network is up"

# Wait for X server
while [ -z "\$DISPLAY" ]; do
    export DISPLAY=:0
    sleep 1
done

# Wait a bit for desktop to fully load
sleep 5

# Hide mouse cursor after 0.5 seconds of inactivity
unclutter -idle 0.5 -root &

# Disable screen saver and power management
xset s off
xset -dpms
xset s noblank

# Clear Chromium crash flags (prevents "restore pages" dialog)
CHROMIUM_DIR="$ACTUAL_HOME/.config/chromium"
mkdir -p "\$CHROMIUM_DIR/Default"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "\$CHROMIUM_DIR/Default/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "\$CHROMIUM_DIR/Default/Preferences" 2>/dev/null || true

# Launch Chromium in kiosk mode
echo "Starting Chromium kiosk..."
chromium-browser \\
    --kiosk \\
    --noerrdialogs \\
    --disable-infobars \\
    --disable-session-crashed-bubble \\
    --disable-restore-session-state \\
    --no-first-run \\
    --start-fullscreen \\
    --disable-translate \\
    --disable-features=TranslateUI \\
    --disable-pinch \\
    --overscroll-history-navigation=0 \\
    --check-for-update-interval=31536000 \\
    --disable-component-update \\
    --autoplay-policy=no-user-gesture-required \\
    --disk-cache-size=1 \\
    --media-cache-size=1 \\
    "\$URL"
EOF

chmod +x "$KIOSK_SCRIPT"
chown $ACTUAL_USER:$ACTUAL_USER "$KIOSK_SCRIPT"
echo -e "${GREEN}✓ Kiosk script created: $KIOSK_SCRIPT${NC}"
echo ""

# =============================================================================
# Step 6: Configure autostart
# =============================================================================
echo -e "${BLUE}Step 6: Configuring autostart...${NC}"

# Create autostart directory
AUTOSTART_DIR="$ACTUAL_HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

# Create autostart entry
cat > "$AUTOSTART_DIR/kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=School Announcements Kiosk
Exec=$KIOSK_SCRIPT
X-GNOME-Autostart-enabled=true
EOF

chown -R $ACTUAL_USER:$ACTUAL_USER "$AUTOSTART_DIR"
echo -e "${GREEN}✓ Autostart configured${NC}"
echo ""

# =============================================================================
# Step 7: Create systemd service (backup method)
# =============================================================================
echo -e "${BLUE}Step 7: Creating systemd service...${NC}"

cat > /etc/systemd/system/kiosk.service << EOF
[Unit]
Description=School Announcements Kiosk
After=graphical.target
Wants=graphical.target

[Service]
Type=simple
User=$ACTUAL_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=$ACTUAL_HOME/.Xauthority
ExecStartPre=/bin/sleep 10
ExecStart=$KIOSK_SCRIPT
Restart=on-failure
RestartSec=10

[Install]
WantedBy=graphical.target
EOF

systemctl daemon-reload
systemctl enable kiosk.service
echo -e "${GREEN}✓ Systemd service created and enabled${NC}"
echo ""

# =============================================================================
# Step 8: Set up auto-login
# =============================================================================
echo -e "${BLUE}Step 8: Configuring auto-login...${NC}"

# For Raspberry Pi OS with desktop
RASPI_CONFIG="/etc/lightdm/lightdm.conf"
if [ -f "$RASPI_CONFIG" ]; then
    # Enable autologin
    sed -i "s/^#autologin-user=.*/autologin-user=$ACTUAL_USER/" "$RASPI_CONFIG"
    sed -i "s/^autologin-user=.*/autologin-user=$ACTUAL_USER/" "$RASPI_CONFIG"
fi

# Use raspi-config to set boot to desktop with autologin
raspi-config nonint do_boot_behaviour B4 2>/dev/null || true

echo -e "${GREEN}✓ Auto-login configured for user: $ACTUAL_USER${NC}"
echo ""

# =============================================================================
# Step 9: Optimize for kiosk use
# =============================================================================
echo -e "${BLUE}Step 9: Optimizing for kiosk use...${NC}"

# Increase GPU memory for better graphics
if ! grep -q "gpu_mem" /boot/config.txt; then
    echo "gpu_mem=128" >> /boot/config.txt
fi

# Disable overscan (for modern displays)
sed -i 's/^#disable_overscan=1/disable_overscan=1/' /boot/config.txt 2>/dev/null || true

# Disable splash screen for faster boot
if ! grep -q "disable_splash" /boot/config.txt; then
    echo "disable_splash=1" >> /boot/config.txt
fi

echo -e "${GREEN}✓ Kiosk optimizations applied${NC}"
echo ""

# =============================================================================
# Step 10: Create management scripts
# =============================================================================
echo -e "${BLUE}Step 10: Creating management scripts...${NC}"

# Create script to restart kiosk
cat > "$ACTUAL_HOME/restart-kiosk.sh" << 'EOF'
#!/bin/bash
pkill -f chromium
sleep 2
~/kiosk.sh &
EOF
chmod +x "$ACTUAL_HOME/restart-kiosk.sh"
chown $ACTUAL_USER:$ACTUAL_USER "$ACTUAL_HOME/restart-kiosk.sh"

# Create script to exit kiosk mode
cat > "$ACTUAL_HOME/exit-kiosk.sh" << 'EOF'
#!/bin/bash
pkill -f chromium
systemctl stop kiosk.service
echo "Kiosk mode stopped. Run ~/kiosk.sh to restart."
EOF
chmod +x "$ACTUAL_HOME/exit-kiosk.sh"
chown $ACTUAL_USER:$ACTUAL_USER "$ACTUAL_HOME/exit-kiosk.sh"

# Create script to update URL
cat > "$ACTUAL_HOME/set-kiosk-url.sh" << 'EOF'
#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: ./set-kiosk-url.sh https://server:8443"
    exit 1
fi
sed -i "s|^URL=.*|URL=\"$1\"|" ~/kiosk.sh
echo "URL updated to: $1"
echo "Run ~/restart-kiosk.sh to apply changes"
EOF
chmod +x "$ACTUAL_HOME/set-kiosk-url.sh"
chown $ACTUAL_USER:$ACTUAL_USER "$ACTUAL_HOME/set-kiosk-url.sh"

echo -e "${GREEN}✓ Management scripts created:${NC}"
echo "    ~/restart-kiosk.sh - Restart the kiosk browser"
echo "    ~/exit-kiosk.sh    - Stop kiosk mode"
echo "    ~/set-kiosk-url.sh - Change the server URL"
echo ""

# =============================================================================
# Complete!
# =============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "The Raspberry Pi is now configured as a kiosk display."
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Reboot the Raspberry Pi: sudo reboot"
echo "  2. The kiosk will automatically start after reboot"
echo ""
echo -e "${YELLOW}Management commands:${NC}"
echo "  ~/restart-kiosk.sh  - Restart the browser"
echo "  ~/exit-kiosk.sh     - Exit kiosk mode"
echo "  ~/set-kiosk-url.sh  - Change server URL"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo "  - Press Alt+F4 to close Chromium (if keyboard connected)"
echo "  - SSH in and run ~/exit-kiosk.sh to stop kiosk"
echo "  - Check logs: journalctl -u kiosk.service"
echo ""
