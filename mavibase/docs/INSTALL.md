# Installation Guide

This guide walks you through setting up Mavibase for local development or production deployment.

## Prerequisites

Before installing Mavibase, ensure you have the following:

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20.x+ | LTS recommended |
| PostgreSQL | 14+ | With JSONB support |
| Redis | 6+ | For session caching |
| pnpm | 8+ | Package manager |

### Installing Prerequisites

**Node.js** (using nvm):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**pnpm**:
```bash
npm install -g pnpm
```

**PostgreSQL** (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**PostgreSQL** (macOS with Homebrew):
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Redis** (Ubuntu/Debian):
```bash
sudo apt install redis-server
sudo systemctl start redis
```

**Redis** (macOS with Homebrew):
```bash
brew install redis
brew services start redis
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mavibase.git
cd mavibase
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs dependencies for all packages in the monorepo workspace.

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [SETUP.md](./SETUP.md) for all options):

```env
# Server
PORT=3000
NODE_ENV=development

# PostgreSQL
DATABASE_URL=postgres://user:password@localhost:5432/mavibase
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mavibase
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets (generate secure random strings)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars

# Email (optional for development)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
EMAIL_FROM=noreply@mavibase.com
```

### 4. Create Database

Connect to PostgreSQL and create the database:

```bash
# Connect as postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE mavibase;
CREATE USER mavibase_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE mavibase TO mavibase_user;
\q
```

### 5. Run Migrations

Run the database migrations to create the required tables:

```bash
pnpm migrate
```

This runs both platform and database migrations:
- `pnpm migrate:platform` - Creates platform tables (users, teams, projects, sessions, etc.)
- `pnpm migrate:database` - Creates database engine tables (databases, collections, documents, etc.)

### 6. Start the Server

**Development mode** (with hot reload):
```bash
pnpm dev
```

**Production mode**:
```bash
pnpm build
pnpm start
```

### 7. Verify Installation

Check if the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 10,
  "checks": {
    "server": { "status": "up" },
    "database_pool": { "status": "up" },
    "platform_pool": { "status": "up" }
  }
}
```

## Docker Installation (Optional)

If you prefer Docker, create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: mavibase
      POSTGRES_USER: mavibase
      POSTGRES_PASSWORD: mavibase_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  mavibase:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://mavibase:mavibase_password@postgres:5432/mavibase
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-secret-key
      JWT_REFRESH_SECRET: your-refresh-secret
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

Run with Docker Compose:
```bash
docker-compose up -d
```

## Troubleshooting

### Connection Refused to PostgreSQL

1. Check PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. Verify connection settings in `.env`

3. Check PostgreSQL logs:
   ```bash
   sudo tail -f /var/log/postgresql/postgresql-14-main.log
   ```

### Connection Refused to Redis

1. Check Redis is running:
   ```bash
   sudo systemctl status redis
   ```

2. Test Redis connection:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

### Migration Failures

1. Ensure database exists and user has permissions
2. Check `DATABASE_URL` format
3. Run migrations with verbose output:
   ```bash
   DEBUG=* pnpm migrate
   ```

### Port Already in Use

Change the port in `.env`:
```env
PORT=3001
```

Or kill the process using the port:
```bash
lsof -i :3000
kill -9 <PID>
```

## Next Steps

- Read the [Configuration Guide](./SETUP.md) for all environment variables
- Check the [API Reference](./API.md) for available endpoints
- Learn about [Schema Validation](./SCHEMAS.md) for your collections
