# Platform Package

This package contains the platform authentication and management service for the BaaS control plane. It handles user authentication, teams, projects, API keys, and platform-level operations.

## Features

- User authentication (register, login, logout)
- JWT-based session management
- Team management
- Project management
- API key management
- Email verification
- Password reset
- Two-factor authentication
- MFA support

## Database

The platform service uses a separate PostgreSQL database specified by the `PLATFORM_DB_URL` environment variable.

### Running Migrations

```bash
pnpm migrate:platform
```

Migrations are located in `/migrations/platform/`.

## Structure

```
packages/platform/
├── src/
│   ├── config/          # Database and Redis configuration
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── package.json
├── tsconfig.json
└── README.md
```

## API Routes

All platform routes are prefixed with `/api/platform/`:

- `/api/platform/auth` - Authentication endpoints
- `/api/platform/auth/users` - User management
- `/api/platform/auth/sessions` - Session management
- `/api/platform/auth/2fa` - Two-factor authentication
- `/api/platform/api-keys` - API key management
- `/api/platform/teams` - Team management
- `/api/platform/projects` - Project management
- `/api/platform/internal` - Internal endpoints

## Environment Variables

Required environment variables (add to `.env`):

```env
PLATFORM_DB_URL=postgresql://user:password@localhost:5432/platform_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM=noreply@example.com
EMAIL_VERIFICATION_URL=http://localhost:3000/verify
```
