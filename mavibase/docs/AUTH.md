# Authentication & Authorization

Mavibase provides a complete authentication system with JWT tokens, sessions, and multi-factor authentication.

## Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│ Register │────▶│  Login   │
└──────────┘     └──────────┘     └──────────┘
                                        │
                                        ▼
                               ┌──────────────┐
                               │ Access Token │
                               │    (15min)   │
                               └──────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
            ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
            │  API Request │   │   Refresh    │   │    Logout    │
            │  (with JWT)  │   │   (7 days)   │   │              │
            └──────────────┘   └──────────────┘   └──────────────┘
```

## Registration

### POST /api/v1/platform/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstname": "John",
  "lastname": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false,
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "team": {
      "id": "team_xyz",
      "name": "John"
    },
    "project": {
      "id": "proj_123",
      "name": "John's Project"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**What happens:**
1. User account is created
2. Personal team is created automatically
3. Personal project is created automatically
4. Verification email is sent (if SMTP configured)
5. JWT tokens are returned

### Password Requirements
- Minimum 8 characters (configurable via `PASSWORD_MIN_LENGTH`)
- Hashed with bcrypt (12 rounds by default)

---

## Login

### POST /api/v1/platform/auth/login

Authenticate with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": true,
      "status": "active",
      "lastLoginAt": "2024-01-01T12:00:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "requiresMFA": false
  }
}
```

**If MFA is enabled:**
```json
{
  "success": true,
  "data": {
    "requiresMFA": true,
    "mfaToken": "mfa_temp_token..."
  }
}
```

Then verify MFA:
```json
POST /api/v1/platform/mfa/verify
{
  "mfaToken": "mfa_temp_token...",
  "code": "123456"
}
```

---

## JWT Tokens

### Access Token
- Short-lived (15 minutes by default)
- Used for API authentication
- Include in `Authorization` header

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Refresh Token
- Long-lived (7 days by default)
- Used to obtain new access tokens
- Stored in Redis for validation

### Token Refresh

### POST /api/v1/platform/auth/refresh

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## Logout

### POST /api/v1/platform/auth/logout

Revoke current session.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Email Verification

### Verify Email

### POST /api/v1/platform/auth/verify-email

**Request:**
```json
{
  "token": "verification-token-from-email"
}
```

### Resend Verification Email

### POST /api/v1/platform/auth/resend-verification

**Request:**
```json
{
  "email": "user@example.com"
}
```

---

## Password Reset

### Request Reset

### POST /api/v1/platform/auth/forgot-password

**Request:**
```json
{
  "email": "user@example.com"
}
```

An email with reset link is sent (if user exists).

### Reset Password

### POST /api/v1/platform/auth/reset-password

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePassword123!"
}
```

---

## Multi-Factor Authentication (MFA)

Mavibase supports TOTP-based MFA (compatible with Google Authenticator, Authy, etc.).

### Enable MFA

### POST /api/v1/platform/mfa/enable

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,..."
  }
}
```

1. Display QR code to user
2. User scans with authenticator app
3. User enters verification code

### Verify MFA Setup

### POST /api/v1/platform/mfa/verify

**Request:**
```json
{
  "code": "123456"
}
```

### Disable MFA

### POST /api/v1/platform/mfa/disable

**Request:**
```json
{
  "code": "123456"
}
```

Requires valid MFA code to disable.

---

## Session Management

### List Sessions

### GET /api/v1/platform/sessions

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sess_abc",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastActiveAt": "2024-01-01T12:00:00Z",
      "current": true
    },
    {
      "id": "sess_def",
      "ipAddress": "10.0.0.1",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)...",
      "createdAt": "2024-01-02T00:00:00Z",
      "lastActiveAt": "2024-01-02T08:00:00Z",
      "current": false
    }
  ]
}
```

### Revoke Session

### DELETE /api/v1/platform/sessions/:sessionId

Revoke a specific session (log out that device).

### Revoke All Sessions

### DELETE /api/v1/platform/sessions

Revoke all sessions except current (log out all other devices).

---

## API Key Authentication

For server-to-server communication, use API keys instead of JWT.

### Create API Key

### POST /api/v1/platform/api-keys

**Request:**
```json
{
  "name": "Production Server",
  "scopes": ["read", "write"],
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "key_abc123",
    "name": "Production Server",
    "key": "mk_live_abcdef123456...",
    "scopes": ["read", "write"],
    "expiresAt": "2025-01-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

> **Important:** The full key is only shown once. Store it securely.

### Using API Keys

```
Authorization: Bearer mk_live_abcdef123456...
```

Or via header:
```
X-API-Key: mk_live_abcdef123456...
```

### Available Scopes
- `read` - Read-only access to resources
- `write` - Create and update resources
- `delete` - Delete resources
- `admin` - Full administrative access

---

## Security Best Practices

### 1. Token Storage (Client-Side)
- Store access tokens in memory (not localStorage)
- Store refresh tokens in HTTP-only cookies
- Never expose tokens in URLs

### 2. HTTPS Only
- Always use HTTPS in production
- Set `Secure` flag on cookies

### 3. Token Rotation
- Access tokens expire quickly (15 min)
- Refresh tokens are rotated on use
- Implement token refresh logic in your client

### 4. Rate Limiting
- Auth endpoints are rate limited (10 req/min)
- Implement exponential backoff on failures

### 5. Password Security
- Enforce strong passwords
- Use bcrypt with high rounds (12+)
- Never log or expose passwords

### Example: Secure Auth Client

```javascript
class AuthClient {
  constructor() {
    this.accessToken = null;
  }

  async login(email, password) {
    const response = await fetch('/api/v1/platform/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include' // For refresh token cookie
    });
    
    const data = await response.json();
    this.accessToken = data.data.accessToken;
    return data;
  }

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (response.status === 401) {
      await this.refresh();
      return this.request(url, options);
    }

    return response.json();
  }

  async refresh() {
    const response = await fetch('/api/v1/platform/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    
    const data = await response.json();
    this.accessToken = data.data.accessToken;
  }
}
```
