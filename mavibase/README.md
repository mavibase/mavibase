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

---

## Dashboard Preview

> **[Screenshot coming soon]**

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

Clients (Web, Mobile, Servers) connect through a **Load Balancer** to the **REST API** and **Realtime API**, both protected by a **Security Layer**. Requests are handled by the **Executor**, backed by **Cache (Redis)** and a **Queue (Redis)**. A **PostgreSQL Database** serves as the primary data store, with background workers handling Builds, Mails, Webhooks, Functions, and more.

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

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/mavibase/mavibase.git
cd mavibase

# 2. Install all dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env
# Fill in your PostgreSQL and Redis credentials

# 4. Run database migrations
pnpm migrate

# 5. Start the API server
pnpm dev

# 6. Start the web console (optional)
pnpm dev:console

# Or start both together
pnpm dev:all
```

- API server: `http://localhost:3000`
- Web console: `http://localhost:3001`

---

## API Overview

### Health

```
GET  /health
GET  /api/v1/db/health
GET  /api/v1/platform/health
```

### Database API — `/api/v1/db`

```
# Databases
POST   /databases
GET    /databases
GET    /databases/:id
PUT    /databases/:id
DELETE /databases/:id

# Collections
POST   /databases/:dbId/collections
GET    /databases/:dbId/collections
PUT    /databases/:dbId/collections/:colId
DELETE /databases/:dbId/collections/:colId

# Documents
POST   /databases/:dbId/collections/:colId/documents
GET    /databases/:dbId/collections/:colId/documents
PUT    /databases/:dbId/collections/:colId/documents/:docId
DELETE /databases/:dbId/collections/:colId/documents/:docId
POST   /databases/:dbId/collections/:colId/documents/query

# Document Versions
GET    /databases/:dbId/collections/:colId/documents/:docId/versions
POST   /databases/:dbId/collections/:colId/documents/:docId/versions/:v/restore

# Indexes
POST   /databases/:dbId/collections/:colId/indexes
GET    /databases/:dbId/collections/:colId/indexes
DELETE /databases/:dbId/collections/:colId/indexes/:indexId

# Transactions
POST   /databases/:dbId/transactions/begin
POST   /databases/:dbId/transactions/:txId/commit
POST   /databases/:dbId/transactions/:txId/rollback
```

### Platform API — `/api/v1/platform`

```
# Auth
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/verify-email
POST   /auth/forgot-password
POST   /auth/reset-password

# Users / Teams / Projects
GET    /users/me
POST   /teams
GET    /teams
POST   /projects
GET    /projects
PATCH  /projects/:id
DELETE /projects/:id

# API Keys
POST   /api-keys
GET    /api-keys
DELETE /api-keys/:id

# Sessions & MFA
GET    /sessions
DELETE /sessions/:id
POST   /mfa/enable
POST   /mfa/verify
POST   /mfa/disable
```

---

## Scripts

```bash
pnpm dev               # Start API server (hot reload)
pnpm dev:console       # Start web console
pnpm dev:all           # Start both concurrently
pnpm build             # Build all packages
pnpm migrate           # Run all migrations
pnpm clean             # Remove dist/ artifacts
```

---

## Current Status

| Feature | Status |
|---|---|
| Document database engine | Done |
| Schema validation | Done |
| Query engine (20+ operators) | Done |
| Document versioning | Done |
| Transactions (ACID) | Done |
| Authentication (JWT + MFA) | Done |
| Teams & projects (multi-tenant) | Done |
| API key management | Done |
| Web console (Next.js 15) | Done |
| Realtime subscriptions | Planned |
| Edge Functions | Planned |
| File Storage | Planned |
| SDKs (JS, Python, Flutter) | Planned |
| Self-host Docker image | Planned |

---

## Coming in v0.1.1

The upcoming patch release will include:

- **JavaScript SDK**
- **PHP SDK**

We appreciate your support and look forward to your feedback as we continue building Mavibase. Stay tuned.

---

## Contributing

Contributions are very welcome. Please read the contributing guide before submitting a pull request.

1. Fork the repository
2. Create your branch: `git checkout -b feature/my-feature`
3. Commit your changes following Conventional Commits: `git commit -m 'feat: add my feature'`
4. Push and open a Pull Request

---

## Community

<p align="center">
  <a href="https://t.me/Mavibase"><img src="https://img.shields.io/badge/Telegram-Join%20Community-26A5E4?logo=telegram&logoColor=white" alt="Telegram" /></a>
  &nbsp;
  <a href="https://www.linkedin.com/company/mavibase"><img src="https://img.shields.io/badge/LinkedIn-Follow%20Us-0A66C2?logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
  &nbsp;
  <a href="https://whatsapp.com/channel/0029VbC64yW8KMqtBoq8Ty1S"><img src="https://img.shields.io/badge/WhatsApp-Join%20Channel-25D366?logo=whatsapp&logoColor=white" alt="WhatsApp" /></a>
</p>

---

## License

Mavibase is open-source software licensed under the [Apache License 2.0](./LICENSE).

---

<p align="center">Built with care by the Mavibase team.</p>
