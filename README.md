<p align="center">
  <a href="https://mavibase.com">
    <img width="1600" height="572" alt="mvbs_banner_github" src="https://github.com/user-attachments/assets/e31f81d0-5fe8-449c-92c4-5a415b63d670" />
  </a>
</p>

<h1 align="center">Mavibase | Build backends in minutes</h1>

<p align="center">
  <a href="https://github.com/mavibase/mavibase/releases"><img src="https://img.shields.io/github/v/release/mavibase/mavibase?style=flat-square" alt="GitHub Release" /></a>
  <a href="https://github.com/mavibase/mavibase/stargazers"><img src="https://img.shields.io/github/stars/mavibase/mavibase?style=flat-square" alt="GitHub Stars" /></a>
  <a href="https://github.com/mavibase/mavibase/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mavibase/mavibase?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <a href="https://demo.mavibase.com">Mavibase Live Demo</a>
</p>

Mavibase is an open-source Backend-as-a-Service (BaaS) platform that provides authentication, document database, and API management in one place. Self-host on your own infrastructure with full control over your data, or use managed databases from providers you trust.

Built with TypeScript and designed for multi-tenancy, it handles the backend primitives every application needs without vendor lock-in.

**Databases:** PostgreSQL (vanilla), Neon, Supabase, AWS RDS, or any PostgreSQL-compatible database

**Cache:** Redis, Upstash, or any Redis-compatible store

**Deployment:** Docker, Docker Compose, any Linux server, VPS, or cloud provider

For documentation, visit the [`/docs`](./docs) folder.

> [!WARNING]
> This project is under active development. Full backward compatibility is not guaranteed before v1.0.0.

---

## Use Cases

Mavibase implements the primitives almost any backend needs. You can use it for:

- **SaaS Products** with multi-tenant data isolation, user management, and team workspaces
- **Internal Tools** and admin dashboards with role-based access control
- **Mobile/Web App Backends** with authentication, data storage, and REST APIs
- **Prototypes & MVPs** to validate ideas quickly without infrastructure overhead
- **API-First Applications** where you need a reliable backend without vendor lock-in

---

## Features

- **Authentication** - Email/password, OAuth providers, magic links, MFA, JWT sessions
- **Document Database** - Flexible schema storage with collections, relationships, and JSONB querying
- **Permissions** - Role-based access control with document-level security rules
- **API Keys** - Scoped API keys with secure BLAKE3/HMAC hashing
- **Multi-tenancy** - Teams, projects, and isolated databases per tenant
- **Transactions** - ACID transactions with configurable isolation levels
- **Versioning** - Document version history with configurable retention
- **Audit Logs** - Track all changes across users, teams, projects, and documents
- **Admin Console** - Full web UI for managing your backend

---

## Structure

The project is a TypeScript monorepo with two applications and four packages:

| Package | Purpose |
|---------|---------|
| `@mavibase/core` | Shared types, utilities, error handling |
| `@mavibase/database` | Document engine, query parser, schema validation, permissions |
| `@mavibase/api` | REST API routes and controllers |
| `@mavibase/platform` | Auth, users, teams, projects, API keys, audit logs |

| App | Purpose |
|-----|---------|
| `apps/server` | Express API server (port 5000) |
| `apps/console` | Next.js admin dashboard (port 3000) |

---

## Quick Start

The fastest way to get running with Docker:

```bash
mkdir mavibase && cd mavibase

# Download required files
curl -O https://raw.githubusercontent.com/mavibase/mavibase/main/infra/docker/docker-compose.yml
curl -O https://raw.githubusercontent.com/mavibase/mavibase/main/infra/docker/init-db.sh

# Create .env with passwords
cat > .env << EOF
DB_PASSWORD=your-secure-password
REDIS_PASSWORD=your-redis-password
ACCESS_TOKEN_SECRET=$(openssl rand -base64 32)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
API_KEY_PEPPER=$(openssl rand -base64 24)
INTERNAL_API_KEY=$(openssl rand -base64 24)
EOF

# Start
docker compose up -d
```

- **Console:** http://localhost:3000
- **API:** http://localhost:5000

For production deployments, BYOD (Bring Your Own Database), and detailed configuration options, see the [Self-Hosting Guide](docs/guides/self-hosting.mdx).

---

## Development Setup

```bash
git clone https://github.com/mavibase/mavibase.git
cd mavibase
pnpm install
cp .env.example .env
pnpm migrate
pnpm dev:all
```

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before getting started. It covers dev setup, project structure, testing, code style, and how to submit changes.

Before writing code, please open a GitHub Issue so we can align on the approach.

---

## Contributors

Thank you to everyone who has contributed to Mavibase.

<a href="https://github.com/mavibase/mavibase/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mavibase/mavibase" />
</a>

---

## License

[Apache License 2.0](LICENSE)
