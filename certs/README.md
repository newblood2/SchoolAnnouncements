# SSL Certificates Directory

This directory contains SSL certificates for enabling HTTPS/HTTP2.

## Quick Setup

### Windows (PowerShell as Administrator)
```powershell
# Install mkcert first
choco install mkcert

# Generate certificates (replace with your server's IP)
.\setup-certs.ps1 -ServerIP "192.168.1.100"
```

### Linux/macOS
```bash
# Install mkcert first (see main README)

# Generate certificates (replace with your server's IP)
chmod +x setup-certs.sh
./setup-certs.sh 192.168.1.100
```

## Files Generated

After running the setup script:

| File | Description | Share? |
|------|-------------|--------|
| `server.crt` | SSL certificate | No |
| `server.key` | Private key (keep secure!) | No |
| `rootCA.pem` | Root CA certificate | Yes - install on kiosks |

## Installing Root CA on Kiosks

See the main README.md for detailed instructions on installing the root CA on different operating systems.

## Security Note

- Never commit `server.key` to version control
- The `.gitignore` file prevents accidental commits
- Only share `rootCA.pem` with trusted devices on your network
