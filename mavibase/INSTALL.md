
## Installation Steps

### 1. Install Dependencies

From the root directory, run:

```bash
npm install
# or if you prefer pnpm (recommended for monorepos)
pnpm install
```

This will:
- Install all root dependencies
- Install dependencies for all packages (core, database, api)
- Install dependencies for the server app
- Link all workspace packages together

### 2. Setup Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

### 3. Start Database Services

If you have Docker:

```bash
cd infra/docker
docker-compose up -d
```

Or start PostgreSQL and Redis manually.

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Start Development Server

```bash
pnpm run dev
```

Your server will be running at `http://localhost:3000`

## Available Commands

All these work from the root directory:

- `pnpm run dev` - Start dev server with hot reload
- `pnpm run build` - Build for production
- `pnpm run migrate` - Run database migrations
- `pnpm run backfill:sizes` - Backfill size tracking (run after migration 022)
- `pnpm run backfill:team-id` - Backfill team IDs for multi-tenancy
- `pnpm run monitor:quotas` - Monitor database quotas and usage
- `pnpm run typecheck` - Check TypeScript types
## Verify Installation

After installation, verify everything is linked:

```bash
pnpm run typecheck
```

If there are no errors, you're good to go!

## Need Help?

- Check `SETUP.md` for detailed setup instructions
- Review `README.md` for API documentation
- Check `/docs` folder for architecture and guides
