# =============================================================================
# SSL Certificate Setup Script for School Announcements (Windows PowerShell)
# =============================================================================
# This script generates SSL certificates using mkcert for local network HTTPS.
#
# Prerequisites:
#   - mkcert installed (choco install mkcert OR scoop install mkcert)
#   - Run this script on the SERVER machine as Administrator
#
# Usage:
#   .\setup-certs.ps1 [-ServerIP "192.168.1.100"] [-ServerHostname "school-server"]
#
# =============================================================================

param(
    [string]$ServerIP = "",
    [string]$ServerHostname = "school-announcements"
)

$ErrorActionPreference = "Stop"

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) { Write-Output $args }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  School Announcements - SSL Certificate Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check if mkcert is installed
$mkcertPath = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcertPath) {
    Write-Host "Error: mkcert is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install mkcert first:"
    Write-Host ""
    Write-Host "  With Chocolatey (run as Administrator):"
    Write-Host "    choco install mkcert" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  With Scoop:"
    Write-Host "    scoop install mkcert" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Manual download:"
    Write-Host "    https://github.com/FiloSottile/mkcert/releases" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Get server IP if not provided
if ([string]::IsNullOrEmpty($ServerIP)) {
    Write-Host "Enter the server's IP address (e.g., 192.168.1.100):" -ForegroundColor Yellow
    $ServerIP = Read-Host
    if ([string]::IsNullOrEmpty($ServerIP)) {
        Write-Host "Error: Server IP is required." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  Server IP: $ServerIP"
Write-Host "  Server Hostname: $ServerHostname"
Write-Host "  Certificate Directory: $ScriptDir"
Write-Host ""

# Step 1: Install the local CA
Write-Host "Step 1: Installing local Certificate Authority..." -ForegroundColor Cyan
try {
    mkcert -install
    Write-Host "OK - Local CA installed" -ForegroundColor Green
} catch {
    Write-Host "Note: You may need to run as Administrator to install the CA" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Generate certificates
Write-Host "Step 2: Generating SSL certificates..." -ForegroundColor Cyan
Push-Location $ScriptDir

try {
    mkcert -cert-file server.crt -key-file server.key `
        $ServerIP `
        $ServerHostname `
        "localhost" `
        "127.0.0.1" `
        "::1"

    Write-Host "OK - Certificates generated:" -ForegroundColor Green
    Write-Host "    - server.crt (certificate)"
    Write-Host "    - server.key (private key)"
} catch {
    Write-Host "Error generating certificates: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ""

# Step 3: Get CA location and copy
Write-Host "Step 3: Certificate Authority Location" -ForegroundColor Cyan
Write-Host ""

$CaRoot = mkcert -CAROOT
Write-Host "IMPORTANT: To enable HTTPS on kiosk devices without warnings," -ForegroundColor Yellow
Write-Host "you must install the root CA certificate on each device." -ForegroundColor Yellow
Write-Host ""
Write-Host "Root CA location: $CaRoot"
Write-Host ""

# Copy CA to certs directory
$CaFile = Join-Path $CaRoot "rootCA.pem"
if (Test-Path $CaFile) {
    Copy-Item $CaFile -Destination (Join-Path $ScriptDir "rootCA.pem") -Force
    Write-Host "OK - Root CA copied to: $ScriptDir\rootCA.pem" -ForegroundColor Green
}

Pop-Location

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Restart Docker to use the new certificates:"
Write-Host "   docker-compose down; docker-compose up -d" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Access the system via HTTPS:"
Write-Host "   https://${ServerIP}:8443" -ForegroundColor Yellow
Write-Host "   https://${ServerHostname}:8443 (if DNS configured)" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Install the root CA on each kiosk device:"
Write-Host "   - Copy 'rootCA.pem' to each device"
Write-Host "   - See README.md for installation instructions per OS"
Write-Host ""
Write-Host "Note: HTTP (port 8080) will redirect to HTTPS (port 8443)" -ForegroundColor Yellow
Write-Host ""
