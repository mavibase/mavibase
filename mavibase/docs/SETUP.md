# Configuration Guide

This guide covers all configuration options for Mavibase.

## Environment Variables

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | Full PostgreSQL connection string |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `mavibase` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | - | Database password |
| `DB_SSL` | `false` | Enable SSL connection |
| `DB_POOL_MIN` | `2` | Minimum pool connections |
| `DB_POOL_MAX` | `10` | Maximum pool connections |
| `DB_POOL_IDLE_TIMEOUT` | `10000` | Idle connection timeout (ms) |
| `DB_CONNECTION_TIMEOUT` | `5000` | Connection timeout (ms) |

### Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Full Redis connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password (if required) |
| `REDIS_DB` | `0` | Redis database number |
| `REDIS_TLS` | `false` | Enable TLS connection |

### Authentication Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | **Required.** JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | - | **Required.** Refresh token secret (min 32 chars) |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token expiration |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh token expiration |
| `PASSWORD_MIN_LENGTH` | `8` | Minimum password length |
| `BCRYPT_ROUNDS` | `12` | bcrypt hashing rounds |

### Email Configuration (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | - | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASS` | - | SMTP password |
| `SMTP_SECURE` | `false` | Use TLS |
| `EMAIL_FROM` | `noreply@mavibase.com` | From address for emails |
| `APP_URL` | `http://localhost:3000` | App URL for email links |

### Query & Performance Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_QUERY_LIMIT` | `100` | Maximum documents per query |
| `DEFAULT_QUERY_LIMIT` | `25` | Default pagination limit |
| `MAX_OR_CONDITIONS` | `10` | Maximum OR conditions in query |
| `MAX_QUERY_FILTERS` | `50` | Maximum total query filters |
| `MAX_QUERY_DEPTH` | `5` | Maximum query nesting depth |
| `MAX_REGEX_LENGTH` | `200` | Maximum regex pattern length |
| `REJECT_UNKNOWN_FIELDS` | `false` | Reject documents with unknown fields |

### Rate Limiting Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max auth requests per window |

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |
| `CORS_CREDENTIALS` | `true` | Allow credentials in CORS |
| `TRUST_PROXY` | `true` | Trust reverse proxy headers |
| `REQUEST_SIZE_LIMIT` | `10mb` | Maximum request body size |

## Example Configuration

### Development (.env)

```env
# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/mavibase_dev
DB_POOL_MIN=2
DB_POOL_MAX=5

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=dev-jwt-secret-change-in-production-min-32-chars
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production-32chars

# Query limits
MAX_QUERY_LIMIT=100
DEFAULT_QUERY_LIMIT=25

# Rate limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=1000

# CORS (allow all in development)
CORS_ORIGINS=*
```

### Production (.env)

```env
# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Database (use connection pooler like PgBouncer)
DATABASE_URL=postgres://user:password@db.example.com:5432/mavibase?sslmode=require
DB_SSL=true
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_CONNECTION_TIMEOUT=10000

# Redis (use managed Redis)
REDIS_URL=rediss://user:password@redis.example.com:6380
REDIS_TLS=true

# Auth (use strong secrets)
JWT_SECRET=your-256-bit-secret-generated-with-openssl-rand-base64-32
JWT_REFRESH_SECRET=another-256-bit-secret-generated-securely
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
BCRYPT_ROUNDS=12

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
APP_URL=https://api.yourdomain.com

# Query limits
MAX_QUERY_LIMIT=100
DEFAULT_QUERY_LIMIT=25
REJECT_UNKNOWN_FIELDS=true

# Rate limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5

# CORS (restrict to your domains)
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
CORS_CREDENTIALS=true

# Security
TRUST_PROXY=true
REQUEST_SIZE_LIMIT=5mb
```

## Generating Secure Secrets

Generate secure JWT secrets:

```bash
# Using openssl
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Connection Pool Tuning

### PostgreSQL Pool Settings

For a typical production setup:

| Metric | Recommendation |
|--------|---------------|
| `DB_POOL_MIN` | 5-10 connections |
| `DB_POOL_MAX` | 20-50 connections (depends on server resources) |
| `DB_POOL_IDLE_TIMEOUT` | 10000ms |
| `DB_CONNECTION_TIMEOUT` | 5000-10000ms |

**Formula for max connections:**
```
max_connections = (num_cores * 2) + effective_spindle_count
```

For cloud databases, check your plan's connection limits.

### Redis Connection Settings

For session management:
- Use a dedicated Redis instance for sessions
- Enable persistence (RDB or AOF) if session data must survive restarts
- Configure `maxmemory-policy` to `volatile-lru` for session-only use

## Health Checks

Mavibase exposes health check endpoints for monitoring:

```bash
# Overall health (checks both pools)
curl http://localhost:3000/health

# Database service health
curl http://localhost:3000/api/v1/db/health
curl http://localhost:3000/api/v1/db/ready
curl http://localhost:3000/api/v1/db/live

# Platform service health
curl http://localhost:3000/api/v1/platform/health
curl http://localhost:3000/api/v1/platform/ready
curl http://localhost:3000/api/v1/platform/live
```

### Kubernetes Probes Example

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/db/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/v1/db/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Logging Configuration

Mavibase uses structured JSON logging in production:

```env
LOG_LEVEL=info  # debug, info, warn, error
```

Log output includes:
- Request ID tracking
- Response times
- Error stack traces (in development)

## Next Steps

- [API Reference](./API.md) - Complete API documentation
- [Schema Validation](./SCHEMAS.md) - Define collection schemas
- [Query Language](./QUERIES.md) - Query operators and syntax
