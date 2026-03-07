# Mavibase Setup Guide

## Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- Redis 6 or higher
- pnpm (recommended) or npm

## Quick Start

### 1. Install Dependencies

From the root directory:

```bash
pnpm install
# or
npm install
```

This will install all dependencies for the monorepo including all packages and apps.

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your database and Redis credentials:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mavibase
POSTGRES_USER=mavibase
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=mavibase

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3000
NODE_ENV=development
```

### 3. Start PostgreSQL and Redis

Using Docker Compose (recommended):

```bash
cd infra/docker
docker-compose up -d
```

Or start them manually with your preferred method.

### 4. Run Database Migrations

```bash
pnpm migrate
```

This will create all necessary database tables and indexes.

### 5. Start Development Server

```bash
pnpm dev
```

The server will start on `http://localhost:3000`

## Available Scripts

From the root directory:

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build all packages and apps for production
- `pnpm migrate` - Run database migrations
- `pnpm backfill:sizes` - Calculate and backfill size tracking data
- `pnpm backfill:team-id` - Backfill team_id for multi-tenancy
- `pnpm monitor:quotas` - Monitor quota usage across databases
- `pnpm typecheck` - Run TypeScript type checking

## Project Structure

```
mavibase/
├── apps/
│   └── server/          # Main Express server
├── packages/
│   ├── core/            # Core types and interfaces
│   ├── database/        # Database engine and operations
│   └── api/             # REST API routes and controllers
├── migrations/
│   └── database/        # SQL migration files
├── scripts/             # Utility scripts
├── docs/                # Documentation
└── infra/               # Infrastructure config
```

## Next Steps

1. Read the [API Documentation](./docs/api/) to understand available endpoints
2. Check [Architecture Documentation](./docs/architecture/) for system design
3. Review [Permissions Guide](./docs/guides/permissions.md) for security setup

## Troubleshooting

### Port already in use

If port 3000 is already in use, change the `PORT` in your `.env` file.

### Database connection errors

1. Verify PostgreSQL is running: `docker ps` or `pg_isready`
2. Check your `DATABASE_URL` in `.env`
3. Ensure database user has proper permissions

### Redis connection errors

1. Verify Redis is running: `redis-cli ping`
2. Check `REDIS_URL` or `REDIS_HOST/PORT` in `.env`

### TypeScript errors

Run type checking to see detailed errors:

```bash
pnpm typecheck
```

## Production Deployment

See [Self-Hosting Guide](./docs/guides/self-hosting.md) for production deployment instructions.
