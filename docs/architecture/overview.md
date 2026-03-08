# Architecture Overview

Mavibase is a multi-tenant Backend as a Service (BaaS) platform built as a pnpm monorepo.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│              (Web, Mobile, Server Applications)                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LOAD BALANCER                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────┐            ┌──────────────────┐
│    REST API      │            │   REALTIME API   │
│   (Port 5000)    │            │   (WebSockets)   │
└────────┬─────────┘            └────────┬─────────┘
         │                               │
         └───────────────┬───────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYER                               │
│         (Auth, Rate Limiting, CORS, Validation)                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       EXECUTOR                                   │
│            (Query Engine, Schema Validation)                     │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────┐                ┌──────────────────┐
│   CACHE (Redis)  │                │   QUEUE (Redis)  │
│  Sessions, Data  │                │  Background Jobs │
└──────────────────┘                └──────────────────┘
           │                                  │
           └───────────────┬──────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                           │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │ Platform Schema │    │      Project Schemas (per tenant)   │ │
│  │  - users        │    │  - documents                        │ │
│  │  - teams        │    │  - collections                      │ │
│  │  - projects     │    │  - indexes                          │ │
│  │  - sessions     │    │  - permissions                      │ │
│  │  - api_keys     │    │  - versions                         │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
mavibase/
├── apps/
│   ├── server/              # Express.js API server
│   │   ├── src/
│   │   │   └── main.ts      # Entry point
│   │   └── package.json
│   │
│   └── console/             # Next.js 16 web console
│       ├── app/             # App Router pages
│       ├── components/      # React components
│       └── package.json
│
├── packages/
│   ├── core/                # Shared utilities
│   │   ├── types/           # TypeScript interfaces
│   │   ├── errors/          # Error classes
│   │   └── utils/           # Helper functions
│   │
│   ├── database/            # Database engine
│   │   ├── query/           # Query parser & executor
│   │   ├── schema/          # Schema validation
│   │   ├── transactions/    # ACID transactions
│   │   └── versioning/      # Document versioning
│   │
│   ├── api/                 # REST API layer
│   │   ├── controllers/     # Request handlers
│   │   ├── routes/          # Route definitions
│   │   ├── middleware/      # Auth, validation, etc.
│   │   └── validators/      # Input validation
│   │
│   └── platform/            # Platform services
│       ├── auth/            # Authentication (JWT, MFA)
│       ├── users/           # User management
│       ├── teams/           # Team management
│       ├── projects/        # Project management
│       └── sessions/        # Session management
│
├── migrations/              # SQL migration files
├── scripts/                 # Build & utility scripts
└── docs/                    # Documentation
```

---

## Tech Stack

### Backend

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Language | TypeScript 5.3+ |
| Database | PostgreSQL 14+ |
| Cache | Redis 6+ |
| Auth | JWT + Argon2/bcrypt |
| Logging | Winston |
| Security | Helmet, CORS, rate-limit |

### Frontend

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v4 |
| State | SWR |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |

---

## Multi-Tenancy Model

Mavibase uses **schema-based multi-tenancy**:

1. **Platform Database** (`mavibase_platform`)
   - Stores users, teams, projects, sessions, API keys
   - Single shared schema for all platform data

2. **Data Database** (`mavibase_db`)
   - Each project gets an isolated PostgreSQL schema
   - Schema name: `project_{projectId}`
   - Complete data isolation between projects

```
mavibase_db
├── project_abc123/
│   ├── documents
│   ├── collections
│   └── indexes
├── project_def456/
│   ├── documents
│   ├── collections
│   └── indexes
└── ...
```

---

## Request Flow

1. **Client** sends request to API
2. **Security Layer** validates JWT/API key, checks rate limits
3. **Router** directs to appropriate controller
4. **Controller** validates input, calls service
5. **Service** executes business logic
6. **Database** layer performs queries
7. **Response** returned to client