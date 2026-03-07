# Mavibase v0.1.0 — Initial Release

**Release date:** March 2026

We are excited to announce the first public release of **Mavibase** — an open-source, self-hostable Backend as a Service platform. This is the foundation release that ships the core database engine, platform services, and web console together as a working, production-ready system.

---

## What's included in v0.1.0

### Database Engine

- **Databases** — Create and manage multiple isolated databases per project
- **Collections** — NoSQL-style collections with optional schema enforcement
- **Documents** — Full CRUD with bulk operations support
- **Document Versioning** — Automatic version history on every document write
- **12 Field Types** — `string`, `number`, `integer`, `float`, `boolean`, `object`, `array`, `email`, `url`, `ip`, `datetime`, `enum`
- **Validation Rules** — `required`, `unique`, `default`, `min`/`max`, `minLength`/`maxLength`, `regex`, enum lists
- **Relationships** — `oneToOne`, `oneToMany`, `manyToOne`, `manyToMany` with `cascade` / `setNull` / `restrict` on delete
- **Query Engine** — JSON-based query language with 20+ operators: `equal`, `notEqual`, `lessThan`, `greaterThan`, `between`, `contains`, `startsWith`, `endsWith`, `search` (full-text), `in`, `notIn`, `isNull`, `isNotNull`, `and`, `or`, `not`
- **Sorting & Pagination** — `orderBy`, `limit`, `offset`
- **Aggregations** — Aggregate operations on collection data
- **Population** — Resolve relationship fields to full documents inline
- **ACID Transactions** — Full transaction support with `begin`, `commit`, `rollback`
- **Field Indexes** — Create indexes on any field, with `pending → creating → active / failed` lifecycle tracking

### Permissions & Security

- **Collection-level Permissions** — `read`, `create`, `update`, `delete` per collection
- **Document-level Permissions** — Optional per-document override rules
- **Permission Types** — `any`, `user:{id}`, `role:{name}`, `owner`
- **Custom Project Roles** — Define and assign roles (e.g. `moderator`, `analyst`) with optional expiry
- **API Key Authentication** — Project-scoped keys with fine-grained scope controls

### Observability

- **Slow Query Logs** — Automatic slow query detection with suggestions, 30-day retention
- **Usage & Quotas** — Per-database quota enforcement and usage tracking
- **Size Tracking** — Database and collection size monitoring

### Platform & Authentication

- **Authentication** — Register, login, logout, JWT access + refresh tokens, email verification, password reset
- **Multi-Factor Authentication (MFA)** — Two-factor authentication support
- **Session Management** — Secure Redis-backed sessions with per-device revocation
- **Teams & Projects** — Full multi-tenant architecture — team and project isolation on all data
- **API Key Management** — Create, list, and revoke project API keys with scoped permissions

### Web Console

- Built with **Next.js 15**, **React 19**, **shadcn/ui**, and **Tailwind CSS v4**
- Vercel-inspired sidebar with team → project switching and slide animations
- Database browser: manage databases, collections, documents, indexes, permissions, relationships
- Authentication dashboard: manage users and sessions
- Project settings: environment picker, API key management, team configuration
- Dark / Light / System theme support
- Fully responsive (mobile + desktop)

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Server | Node.js 20+ · Express.js · TypeScript |
| Database | PostgreSQL 14+ |
| Cache / Sessions | Redis 6+ |
| Web Console | Next.js 15 · React 19 · Tailwind CSS v4 |
| Auth | JWT · Argon2 / bcrypt · HTTP-only cookies |
| Monorepo | pnpm workspaces |

---

## Known Limitations in v0.1.0

- Realtime subscriptions are **not yet available** (planned for a future release)
- Edge Functions are **not yet available**
- File Storage is **not yet available**
- No official SDK yet — SDKs (JavaScript, PHP) are coming in **v0.1.1**
- No official Docker image yet — self-host guide coming soon

---

## Coming in v0.1.1

- **JavaScript SDK** — Official client SDK for web and Node.js
- **PHP SDK** — Official client SDK for PHP applications

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/mavibase/mavibase.git
cd mavibase

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env

# Run migrations
pnpm migrate

# Start the API server and console
pnpm dev:all
```

Full documentation is available in the [README](./README.md).

---

## Community

- Telegram: [t.me/Mavibase](https://t.me/Mavibase)
- WhatsApp: [Join our channel](https://whatsapp.com/channel/0029VbC64yW8KMqtBoq8Ty1S)
- LinkedIn: [linkedin.com/company/mavibase](https://www.linkedin.com/company/mavibase)

---

## License

Mavibase is licensed under the [Apache License 2.0](./LICENSE).

---

Thank you for your support. We are just getting started.

— The Mavibase Team
