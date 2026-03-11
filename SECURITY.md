# Security Policy

The Mavibase team takes security seriously. We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

**security@mavibase.com**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Include

Please include the following information in your report:

- **Type of vulnerability** (e.g., SQL injection, XSS, authentication bypass)
- **Full paths of source file(s)** related to the vulnerability
- **Location** of the affected source code (tag/branch/commit or direct URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact** of the vulnerability and how it might be exploited

### What to Expect

1. **Acknowledgment** - We will acknowledge receipt of your report within 48 hours
2. **Assessment** - We will investigate and assess the severity of the issue
3. **Updates** - We will keep you informed of our progress
4. **Resolution** - We will notify you when the vulnerability is fixed
5. **Credit** - We will credit you in our security advisories (unless you prefer to remain anonymous)

## Security Measures

### Authentication & Authorization

- **Password Hashing** - All passwords are hashed using Argon2 or bcrypt
- **JWT Tokens** - Short-lived access tokens with secure refresh token rotation
- **API Keys** - Scoped API keys with fine-grained permissions
- **MFA Support** - Optional two-factor authentication using TOTP
- **Session Management** - Secure session handling with automatic expiration

### Data Protection

- **Encryption in Transit** - All API communication uses HTTPS/TLS
- **Multi-Tenancy Isolation** - Complete data isolation between projects using PostgreSQL schemas
- **Input Validation** - All inputs are validated and sanitized
- **SQL Injection Prevention** - Parameterized queries throughout the codebase

### Infrastructure Security

- **Rate Limiting** - Protection against brute force and DDoS attacks
- **CORS** - Configurable Cross-Origin Resource Sharing policies
- **Security Headers** - Helmet.js for secure HTTP headers
- **Audit Logging** - Comprehensive logging of security-relevant events

### Secure Development

- **Dependency Scanning** - Regular scanning for vulnerable dependencies
- **Code Review** - All changes require code review before merging
- **Type Safety** - TypeScript for compile-time type checking
- **Least Privilege** - Services run with minimal required permissions

## Security Best Practices for Self-Hosting

When self-hosting Mavibase, we recommend:

### Network Security

- Deploy behind a reverse proxy (nginx, Caddy, Traefik)
- Use TLS/SSL certificates (Let's Encrypt recommended)
- Restrict database access to application servers only
- Use private networks for internal service communication

### Configuration

- Use strong, unique passwords for all services
- Generate secure JWT secrets (minimum 256 bits)
- Enable rate limiting in production
- Configure appropriate CORS origins
- Set secure cookie options in production

### Database Security

- Use dedicated database users with minimal privileges
- Enable SSL for database connections
- Regular automated backups
- Keep PostgreSQL and Redis updated

### Monitoring

- Enable audit logging
- Monitor for unusual activity
- Set up alerts for failed authentication attempts
- Regular security log reviews

## Disclosure Policy

- We will coordinate public disclosure with you
- We will credit researchers who report valid vulnerabilities
- We aim to release fixes within 90 days of verification
- Critical vulnerabilities will be prioritized for immediate patching

## Bug Bounty

We currently do not have a formal bug bounty program, but we do recognize and thank security researchers who help improve Mavibase security. We may offer:

- Public acknowledgment (with your permission)
- Mavibase swag
- Inclusion in our security hall of fame

## Security Updates

Security updates are released as patch versions and announced through:

- GitHub Security Advisories
- Release notes
- Our official communication channels

We strongly recommend keeping your Mavibase installation up to date.

## Contact

For security-related inquiries:

- **Email:** security@mavibase.com
- **PGP Key:** Available upon request

For general support and non-security issues, please use GitHub Issues or Discussions.

---

Thank you for helping keep Mavibase and its users safe!
