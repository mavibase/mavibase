# Self-Hosting Guide

Run your own Mavibase instance in 3 steps.

## Requirements

- Docker and Docker Compose installed
- 1 GB RAM minimum (2 GB recommended)

---

## Quick Start

### Step 1: Download

```bash
# Clone the repo
git clone https://github.com/mavibase/mavibase.git
cd mavibase

# Or just download the files you need
curl -O https://raw.githubusercontent.com/mavibase/mavibase/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/mavibase/mavibase/main/.env.example
```

### Step 2: Configure

```bash
# Copy the example config
cp .env.example .env

# Edit .env and change the passwords marked [CHANGE THIS]
nano .env   # or use any text editor
```

**Important:** When using `docker compose up -d`, you only need to set **passwords** - NOT full URLs. Docker Compose automatically builds the connection URLs using container hostnames.

#### Example `.env` for Docker Compose (local/self-hosted)

```bash
# ============================================
# DOCKER COMPOSE MODE - Only set passwords!
# URLs are built automatically by docker-compose.yml
# ============================================

# Database password (used by docker-compose to build DATABASE_URL)
DB_PASSWORD=your-secure-postgres-password-here

# Redis password (used by docker-compose to build REDIS_URL)
REDIS_PASSWORD=your-secure-redis-password-here

# DO NOT set these when using docker compose - they're built automatically:
# DATABASE_URL=...     <- Don't set this!
# PLATFORM_DB_URL=...  <- Don't set this!
# REDIS_URL=...        <- Don't set this!

# ============================================
# Security - CHANGE ALL OF THESE!
# ============================================
ACCESS_TOKEN_SECRET=generate-a-64-char-random-string-here
REFRESH_TOKEN_SECRET=generate-another-64-char-random-string
JWT_SECRET=and-another-64-char-random-string
API_KEY_PEPPER=minimum-32-chars-random-pepper-for-api-keys
INTERNAL_API_KEY=minimum-32-chars-for-internal-service-calls

# ============================================
# Optional settings (defaults are fine)
# ============================================
# NODE_ENV=production
# LOG_LEVEL=info
# FRONTEND_URL=http://localhost:3000
# ALLOWED_ORIGINS=http://localhost:3000
```

Generate secure values with:
```bash
openssl rand -base64 32
```

**Why no URLs?** The `docker-compose.yml` automatically constructs:
- `DATABASE_URL=postgresql://mavibase:${DB_PASSWORD}@postgres:5432/mavibase_db`
- `PLATFORM_DB_URL=postgresql://mavibase:${DB_PASSWORD}@postgres:5432/mavibase_platform`
- `REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379`

The hostnames `postgres` and `redis` are the container names - Docker networking handles the rest.

### Step 3: Run

```bash
docker compose up -d
```

That's it! Open http://localhost:3000 to access the console.

---

## Quick Reference: Docker Compose vs Production

| Setting | Docker Compose | Production (BYOD) |
|---------|---------------|-------------------|
| `DB_PASSWORD` | Set this | Not needed |
| `REDIS_PASSWORD` | Set this | Not needed |
| `DATABASE_URL` | Don't set (auto-built) | Set full URL |
| `PLATFORM_DB_URL` | Don't set (auto-built) | Set full URL |
| `REDIS_URL` | Don't set (auto-built) | Set full URL |
| Compose file | `docker-compose.yml` | `docker-compose.prod.yml` |
| Creates containers | postgres, redis, mavibase | mavibase only |

---

## What Gets Created

Docker automatically creates:

| Service | Port | Description |
|---------|------|-------------|
| **mavibase** | 3000 (console), 5000 (API) | Main application |
| **postgres** | 5432 | Database (2 DBs: `mavibase_db` + `mavibase_platform`) |
| **redis** | 6379 | Cache & sessions |

---

## Common Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f mavibase

# Restart
docker compose restart

# Update to latest version
docker compose pull
docker compose up -d

# Full reset (deletes all data!)
docker compose down -v
docker compose up -d
```

---

## Using Your Own Database (BYOD / Production)

If you have managed databases (Neon, Supabase, AWS RDS, Upstash), you need to set **full URLs** instead of just passwords.

### Step 1: Create two PostgreSQL databases

Create these databases on your provider:
- `mavibase_db` - Document storage
- `mavibase_platform` - Users, teams, projects

### Step 2: Create `.env` with full URLs

#### Example `.env` for Production (external databases)

```bash
# ============================================
# PRODUCTION MODE - Set full URLs!
# Using external services (Neon, Supabase, Upstash, etc.)
# ============================================

# PostgreSQL - Full connection URLs (required)
DATABASE_URL=postgresql://user:password@your-host.neon.tech:5432/mavibase_db?sslmode=require
PLATFORM_DB_URL=postgresql://user:password@your-host.neon.tech:5432/mavibase_platform?sslmode=require

# Redis - Full connection URL (required)
REDIS_URL=redis://:your-redis-password@your-host.upstash.io:6379

# ============================================
# Security - CHANGE ALL OF THESE!
# ============================================
ACCESS_TOKEN_SECRET=generate-a-64-char-random-string-here
REFRESH_TOKEN_SECRET=generate-another-64-char-random-string
JWT_SECRET=and-another-64-char-random-string
API_KEY_PEPPER=minimum-32-chars-random-pepper-for-api-keys
INTERNAL_API_KEY=minimum-32-chars-for-internal-service-calls

# ============================================
# Production settings
# ============================================
NODE_ENV=production
LOG_LEVEL=info

# Update these to your domain!
FRONTEND_URL=https://console.yourdomain.com
ALLOWED_ORIGINS=https://console.yourdomain.com,https://yourdomain.com
CORS_ORIGIN=https://console.yourdomain.com

# ============================================
# Optional: Email verification
# ============================================
ENABLE_EMAIL_SERVICE=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

### Step 3: Use production compose file

```bash
docker compose -f docker-compose.prod.yml up -d
```

This uses `docker-compose.prod.yml` which does NOT create postgres/redis containers - it expects your external services.

---

## Production Checklist

Before going to production:

- [ ] Changed all passwords in `.env`
- [ ] Set `FRONTEND_URL` to your domain
- [ ] Set `ALLOWED_ORIGINS` to your domain
- [ ] Set up HTTPS (use a reverse proxy like Nginx or Caddy)
- [ ] Set up backups for PostgreSQL
- [ ] (Optional) Enable email service for verification

### Example: Using with Caddy (HTTPS)

```bash
# Caddyfile
mavibase.yourdomain.com {
    reverse_proxy localhost:3000
}

api.mavibase.yourdomain.com {
    reverse_proxy localhost:5000
}
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs mavibase

# Check if ports are in use
lsof -i :3000
lsof -i :5000
```

### Database connection error

```bash
# Verify PostgreSQL is running
docker compose ps

# Check database logs
docker compose logs postgres
```

### Reset everything

```bash
# Warning: This deletes all data!
docker compose down -v
docker compose up -d
```

---

## Updating

```bash
# Pull latest images
docker compose pull

# Restart with new version
docker compose up -d
```

Migrations run automatically on startup.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Your Server                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │   Mavibase   │  │  PostgreSQL  │  │   Redis   │  │
│  │              │  │              │  │           │  │
│  │ Console:3000 │──│ mavibase_db  │  │  Cache    │  │
│  │ API:5000     │  │ mavibase_    │  │  Sessions │  │
│  │              │  │   platform   │  │           │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```
