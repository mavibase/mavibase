# Getting Started Guide

This guide covers local development setup using pnpm. For Docker/self-hosting, see [Self-Hosting Guide](./self-hosting.md).

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 20+ | `node --version` |
| pnpm | 9+ | `pnpm --version` |
| PostgreSQL | 14+ | `psql --version` |
| Redis | 6+ | `redis-cli --version` |

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/vexojs/mavibase-codebase.git
cd mavibase-codebase
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs all dependencies and automatically builds the packages (the monorepo has a postinstall build step).

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your local PostgreSQL and Redis credentials:

```bash
# For local development with your own PostgreSQL/Redis:
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/mavibase_db
PLATFORM_DB_URL=postgresql://postgres:yourpassword@localhost:5432/mavibase_platform
REDIS_URL=redis://localhost:6379

# Security tokens - generate with: openssl rand -base64 32
ACCESS_TOKEN_SECRET=your-random-64-char-string
REFRESH_TOKEN_SECRET=your-random-64-char-string
JWT_SECRET=your-random-64-char-string
API_KEY_PEPPER=your-random-32-char-string
INTERNAL_API_KEY=your-random-32-char-string
```

### 4. Create Databases

Create the two required PostgreSQL databases:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE mavibase_db;"
psql -U postgres -c "CREATE DATABASE mavibase_platform;"
```

### 5. Run Migrations

```bash
pnpm migrate
```

This runs both platform and database migrations to set up the schema.

### 6. Start Development Servers

```bash
# Start everything (API + Console)
pnpm dev:all

# Or start individually:
pnpm dev           # API server only (port 5000)
pnpm dev:console   # Web console only (port 3000)
```

---

## Verify Installation

Once running, verify everything works:

| Service | URL | Expected |
|---------|-----|----------|
| API Health | http://localhost:5000/health | `{ "status": "ok" }` |
| DB Health | http://localhost:5000/api/v1/db/health | `{ "status": "ok" }` |
| Platform Health | http://localhost:5000/api/v1/platform/health | `{ "status": "ok" }` |
| Web Console | http://localhost:3000 | Login page |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API server with hot reload |
| `pnpm dev:console` | Start web console with hot reload |
| `pnpm dev:all` | Start both API and console |
| `pnpm build` | Build all packages |
| `pnpm build:console` | Build console for production |
| `pnpm migrate` | Run all database migrations |
| `pnpm clean` | Remove all dist/ artifacts |

---

## Project Structure

```
mavibase/
├── apps/
│   ├── server/          # Express.js API server (port 5000)
│   └── console/         # Next.js web console (port 3000)
├── packages/
│   ├── core/            # Shared types and utilities
│   ├── database/        # Database engine
│   ├── api/             # REST API layer
│   └── platform/        # Auth, users, teams
├── migrations/          # Database migration files
├── scripts/             # Utility scripts
└── docs/                # Documentation
```


## Troubleshooting

### Database connection errors

Ensure PostgreSQL is running and the databases exist:
```bash
psql -U postgres -c "\l"  # List databases
```

### Redis connection errors

Ensure Redis is running:
```bash
redis-cli ping  # Should return PONG
```

### Port conflicts

If ports 5000 or 3000 are in use, update the `PORT` in `.env` or kill the existing process:
```bash
lsof -i :5000  # Find process using port
kill -9 <PID>  # Kill it
```
