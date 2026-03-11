<p align="center">
  <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-2D9nxBSTYc7DOWMDtGGLMGBTdHLLek.png" alt="Mavibase — Build backends in minutes." width="100%" />
</p>

<h3 align="center">The open-source Backend as a Service platform.</h3>
<p align="center">Databases · Authentication · Realtime · Edge Functions · Storage</p>

<br />

<p align="center">
  <a href="https://github.com/mavibase/mavibase/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License: Apache 2.0" />
  </a>
  <img src="https://img.shields.io/badge/status-active%20development-blue" alt="Status: Active Development" />
  <img src="https://img.shields.io/badge/TypeScript-5.3+-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Node.js-20+-green?logo=node.js&logoColor=white" alt="Node.js" />
</p>

---

> **Note:** Mavibase is currently in active development. Features and APIs may change. We welcome contributors and early testers.

---

## What is Mavibase?

Mavibase is a self-hostable, open-source **Backend as a Service (BaaS)** platform — similar to Supabase, Appwrite, or Firebase — that lets you ship production backends in minutes without managing infrastructure from scratch.

It provides a full-stack backend platform out of the box: a powerful document database engine backed by PostgreSQL, authentication with MFA, session management, team and project organization, API key management, and a beautiful web console to manage everything visually.

### Quick Links

- **[📚 Full Documentation](./docs)** — Complete guides and API reference
- **[🚀 Getting Started](./docs/getting-started/quickstart.mdx)** — Quick start guide
- **[📖 API Reference](./docs/api)** — Detailed API documentation
- **[💡 Concepts](./docs/concepts)** — Deep dives into data models, permissions, and more

---

## Dashboard Preview

<img width="1901" height="1044" alt="image" src="https://github.com/user-attachments/assets/71701786-ca6e-40bd-9ecc-94d675ebc06c" />


---

## Features

### Data Model
- **Databases** — Create and manage multiple isolated databases per project
- **Collections** — Flexible NoSQL collections with optional schema enforcement
- **Documents** — Full CRUD operations with bulk support
- **Document Versioning** — Automatic version history tracking on every document

### Schema & Validation
- **12 Field Types** — `string`, `number`, `integer`, `float`, `boolean`, `object`, `array`, `email`, `url`, `ip`, `datetime`, `enum`
- **Validation Rules** — `required`, `unique`, `default`, `min`/`max`, `minLength`/`maxLength`, `regex`, enum lists
- **Relationships** — `oneToOne`, `oneToMany`, `manyToOne`, `manyToMany` with `cascade` / `setNull` / `restrict` on delete, optional two-way sync

### Querying
- **Query Language** — JSON-based operators: `equal`, `notEqual`, `lessThan`, `greaterThan`, `between`, `contains`, `startsWith`, `endsWith`, `search` (full-text), `in`, `notIn`, `isNull`, `isNotNull`, `and`, `or`, `not`
- **Sorting & Pagination** — `orderBy`, `limit`, `offset`
- **Aggregations** — Aggregate operations on collection data
- **Population** — Resolve relationship fields to full documents inline

### Permissions & Roles
- **Collection-level Permissions** — `read`, `create`, `update`, `delete` rules per collection
- **Document-level Permissions** — Optional per-document permission overrides
- **Permission Types** — `any`, `user:{id}`, `role:{name}`, `owner`
- **Custom Project Roles** — Define roles (e.g. `moderator`, `analyst`) and assign them to end-users
- **Role Assignments** — Assign roles with optional expiry

### Indexes
- **Field Indexes** — Create indexes on any collection field for query performance
- **Index Status Tracking** — `pending` → `creating` → `active` / `failed` lifecycle

### Observability
- **Audit Logs** — Full audit trail on all database operations
- **Slow Query Logs** — Automatic detection and logging of slow queries with optimization suggestions, 30-day retention
- **Usage & Quotas** — Per-database quota enforcement and usage tracking
- **Size Tracking** — Database and collection size monitoring

### Security
- **API Key Authentication** — Project-scoped API keys with fine-grained scope controls
- **Multi-tenancy** — Full team + project isolation on all data

### Console UI
- Light theme, Dark theme, System theme
- Complete database management from the dashboard
- Manage database structure, permissions, and data directly from the interface

---

## Architecture

Clients (Web, Mobile, Servers) connect through a **Load Balancer** to the **REST API** and **Realtime API**, both protected by a **Security Layer**. Requests are handled by the **Executor**, backed by **Cache (Redis)** and a **Queue (Redis)**. A **PostgreSQL Database** serves as the primary data store, with background workers handling Builds, Audits, Mails, Webhooks, Functions, and more.

This is a **pnpm monorepo** with two apps and four shared packages:

```
mavibase/
├── apps/
│   ├── server/          # Express.js API server
│   └── console/         # Next.js 15 web console
│
├── packages/
│   ├── core/            # Shared TypeScript types and error classes
│   ├── database/        # Database engine (query, schema, transactions)
│   ├── api/             # REST controllers, routes, middleware
│   └── platform/        # Auth, users, teams, projects, sessions, MFA
│
└── scripts/
    ├── migrate-platform.ts
    └── migrate-database.ts
```

---

## Tech Stack

### Backend
| | |
|---|---|
| Runtime | Node.js + Express |
| Language | TypeScript |
| Auth | JWT + Argon2 / bcrypt, HTTP-only cookies |
| Database | PostgreSQL (`pg`) |
| Cache / Realtime | Redis (`ioredis`) |
| Email | Nodemailer & Resend |
| Security | Helmet, CORS, `express-rate-limit` |
| Logging | Winston |
| IDs | nanoid, uuid |

### Frontend
| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + shadcn/ui + Radix UI |
| Styling | Tailwind CSS v4 |
| Icons | HugeIcons & Lucide React |
| Animations | Framer Motion |
| Data Fetching | SWR + Axios |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| Charts | Recharts |

### Infrastructure
| | |
|---|---|
| Database | Multi-tenant PostgreSQL with isolated schemas per project |
| Cache | Redis for caching and session management |
| Migrations | Migration system for both platform and database schemas |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Redis 6+

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/mavibase/mavibase.git
cd mavibase

# 2. Install all dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env
# Fill in your PostgreSQL and Redis credentials

# 4. Run migrations
pnpm migrate

# 5. Start development servers
pnpm dev:all
```

- **API Server:** `http://localhost:5000`
- **Web Console:** `http://localhost:3000`

For detailed installation and setup instructions, see [Installation Guide](./docs/getting-started/installation.mdx).

---

## API Reference

### Database API — `/api/v1/db`

[View full documentation](./docs/api)

**Core Operations:**
- **Databases** — Create, read, update, delete databases
- **Collections** — Manage collections with optional schema
- **Documents** — CRUD operations with versioning and soft deletes
- **Querying** — Advanced querying with 20+ operators
- **Transactions** — ACID-compliant atomic operations
- **Indexes** — Optimize query performance
- **Roles & Permissions** — Fine-grained access control

**Observability:**
- **Slow Queries** — Track and optimize slow queries
- **Audit Logs** — Full operation history per database

### Platform API — `/api/v1/platform`

[View full documentation](./docs/api)

**Authentication & Users:**
- **Auth** — Registration, login, MFA, password reset
- **Users** — User profile management
- **Sessions** — Session and logout management
- **Two-Factor** — Enable/disable 2FA

**Organization:**
- **Teams** — Team management and permissions
- **Projects** — Project creation and configuration
- **API Keys** — Create and manage scoped API keys
- **Project Roles** — Custom role definitions and assignments

### Health Endpoints

```
GET /health
GET /api/v1/db/health
GET /api/v1/platform/health
```

---

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Getting Started
- **[Quickstart](./docs/getting-started/quickstart.mdx)** — Get up and running in 5 minutes
- **[Installation](./docs/getting-started/installation.mdx)** — Detailed setup instructions
- **[Authentication](./docs/getting-started/authentication.mdx)** — Learn authentication flows

### Concepts
- **[Data Model](./docs/concepts/data-model.mdx)** — Understand databases, collections, and documents
- **[Permissions](./docs/concepts/permissions.mdx)** — Row-level and field-level access control
- **[Multi-Tenancy](./docs/concepts/multi-tenancy.mdx)** — Build multi-tenant SaaS applications
- **[Transactions](./docs/concepts/transactions.mdx)** — ACID-compliant atomic operations

### API Reference
- **[Databases](./docs/api/databases.mdx)** — Database operations
- **[Collections](./docs/api/collections.mdx)** — Collection management
- **[Documents](./docs/api/documents.mdx)** — Document CRUD and versioning
- **[Querying](./docs/api/querying.mdx)** — Query syntax and operators
- **[Transactions](./docs/api/transactions.mdx)** — Transaction endpoints
- **[Indexes](./docs/api/indexes.mdx)** — Query optimization
- **[Roles](./docs/api/roles.mdx)** — Role management
- **[Authentication](./docs/api/auth.mdx)** — Auth endpoints
- **[Users](./docs/api/users.mdx)** — User management
- **[Teams](./docs/api/teams.mdx)** — Team operations
- **[Projects](./docs/api/projects.mdx)** — Project management
- **[API Keys](./docs/api/api-keys.mdx)** — API key management
- **[Sessions](./docs/api/sessions.mdx)** — Session management
- **[Two-Factor](./docs/api/two-factor.mdx)** — MFA setup and verification
- **[Slow Queries](./docs/api/slow-queries.mdx)** — Performance monitoring

### Guides
- **[Querying Guide](./docs/guides/querying.mdx)** — Master the query language
- **[Error Handling](./docs/guides/error-handling.mdx)** — Handle API errors gracefully
- **[Best Practices](./docs/guides/best-practices.mdx)** — Production-ready patterns

---

## Development Scripts

```bash
# Development
pnpm dev               # Start API server (hot reload)
pnpm dev:console       # Start web console (hot reload)
pnpm dev:all           # Start both servers concurrently

# Building
pnpm build             # Build all packages
pnpm clean             # Remove build artifacts

# Database
pnpm migrate           # Run all migrations
pnpm migrate:platform  # Platform schema migrations
pnpm migrate:database  # Database engine migrations

# Testing & Linting
pnpm test              # Run test suite
pnpm lint              # Lint all packages
```

---

## Project Status

### Completed Features ✅

- Document database engine with PostgreSQL
- Schema validation (12 field types)
- Advanced query engine (20+ operators)
- Document versioning & history
- ACID-compliant transactions
- Authentication (JWT, Argon2, MFA)
- Multi-tenancy (teams & projects)
- Role-based access control
- Row-level security (RLS)
- Field-level access control
- API key management with scopes
- Web console (Next.js 15)
- Audit logging
- Slow query detection
- Self-hosting support
- Comprehensive documentation

### Planned Features 🚀

- Realtime subscriptions (WebSocket)
- Edge Functions (FaaS)
- File Storage (S3-compatible)
- Official SDKs:
  - JavaScript/TypeScript
  - Python
  - Flutter
  - Go
- GraphQL API
- Advanced analytics
- Webhooks

---

## Roadmap

Follow the project progress and upcoming features on [GitHub Issues](https://github.com/mavibase/mavibase/issues).

---

## Contributing

We welcome contributions from the community! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and commit: `git commit -m 'feat: add my feature'`
4. Push to your fork and create a Pull Request
5. Ensure all tests pass and documentation is updated

### Areas for Contribution

- Bug fixes and performance improvements
- New operators for the query engine
- Documentation and examples
- SDK development
- Testing and quality assurance

---

## Community

Join us and stay updated on Mavibase:

<p align="center">
  <a href="https://github.com/mavibase/mavibase/discussions"><img src="https://img.shields.io/badge/GitHub-Discussions-181717?logo=github&logoColor=white" alt="GitHub Discussions" /></a>
  &nbsp;
  <a href="https://t.me/Mavibase"><img src="https://img.shields.io/badge/Telegram-Community-26A5E4?logo=telegram&logoColor=white" alt="Telegram" /></a>
  &nbsp;
  <a href="https://twitter.com/mavibase"><img src="https://img.shields.io/badge/Twitter-Follow-1DA1F2?logo=twitter&logoColor=white" alt="Twitter" /></a>
  &nbsp;
  <a href="https://www.linkedin.com/company/mavibase"><img src="https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
</p>

### Support

- **Issues & Bug Reports:** [GitHub Issues](https://github.com/mavibase/mavibase/issues)
- **Discussions:** [GitHub Discussions](https://github.com/mavibase/mavibase/discussions)
- **Security:** [Security Policy](./SECURITY.md)

---

## License

Mavibase is open-source software licensed under the [Apache License 2.0](./LICENSE).

---

<p align="center">Built with care by the Mavibase team.</p>
