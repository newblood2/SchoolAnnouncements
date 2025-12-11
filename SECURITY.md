# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in the School Announcements Display System, please report it responsibly:

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the security issue to the repository maintainers
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Assessment and response within 7 days
- Credit in the fix announcement (if desired)

## Security Best Practices

When deploying School Announcements:

### Environment Variables

- **Never** commit `.env` files with real credentials
- Generate strong API keys:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Rotate API keys periodically

### Network Security

- Deploy behind a firewall for local network use
- Use HTTPS/HTTP2 (see certificate setup in README)
- Restrict CORS origins in production (`CORS_ORIGIN` in .env)

### Docker Security

- Keep Docker and images updated
- Don't expose unnecessary ports
- Use read-only volume mounts where possible

### Admin Access

- Use strong API keys (not default values)
- Limit admin panel access to trusted networks
- Monitor for unauthorized access attempts

## Known Security Considerations

1. **Local Network Design**: This system is designed for local network deployment. Additional hardening is required for internet-facing deployments.

2. **API Key Authentication**: The API uses a shared key. For higher security environments, consider implementing user-based authentication.

3. **File Uploads**: Image uploads are restricted to specific formats. Ensure upload directory permissions are properly configured.

## Updates

Security updates will be released as soon as practical. Watch the repository for release notifications.
