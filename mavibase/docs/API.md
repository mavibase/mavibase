# API Reference

Complete API documentation for Mavibase.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

Most endpoints require authentication via JWT Bearer token:

```
Authorization: Bearer <access_token>
```

Obtain tokens via `/api/v1/platform/auth/login`.

## Response Format

All responses follow this structure:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

---

## Health Endpoints

### GET /health
Overall system health check.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "heapUsed": "45MB",
    "heapTotal": "100MB"
  },
  "responseTime": 5,
  "checks": {
    "server": { "status": "up" },
    "database_pool": {
      "status": "up",
      "responseTime": 2,
      "connections": { "total": 10, "idle": 8, "waiting": 0 }
    },
    "platform_pool": {
      "status": "up",
      "responseTime": 1,
      "connections": { "total": 10, "idle": 9, "waiting": 0 }
    }
  }
}
```

---

## Database API

Base path: `/api/v1/db`

### Databases

#### POST /databases
Create a new database.

**Request:**
```json
{
  "name": "my-database",
  "description": "My application database"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "db_abc123",
    "name": "my-database",
    "description": "My application database",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /databases
List all databases.

**Query Parameters:**
- `limit` (number) - Results per page (default: 25, max: 100)
- `cursor` (string) - Pagination cursor

#### GET /databases/:databaseId
Get database by ID.

#### PUT /databases/:databaseId
Update database.

#### DELETE /databases/:databaseId
Delete database (soft delete).

---

### Collections

#### POST /databases/:databaseId/collections
Create a collection with optional schema.

**Request:**
```json
{
  "name": "users",
  "key": "users",
  "schema": {
    "fields": [
      { "name": "email", "type": "email", "required": true, "unique": true },
      { "name": "name", "type": "string", "required": true },
      { "name": "age", "type": "integer", "validation": { "min": 0, "max": 150 } },
      { "name": "role", "type": "enum", "validation": { "enum": ["admin", "user", "guest"] } }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "col_xyz789",
    "name": "users",
    "key": "users",
    "databaseId": "db_abc123",
    "schemaId": "sch_def456",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /databases/:databaseId/collections
List collections in a database.

#### GET /databases/:databaseId/collections/:collectionId
Get collection by ID.

#### PUT /databases/:databaseId/collections/:collectionId
Update collection (including schema).

#### DELETE /databases/:databaseId/collections/:collectionId
Delete collection.

---

### Documents

#### POST /databases/:databaseId/collections/:collectionId/documents
Create a document.

**Request:**
```json
{
  "data": {
    "email": "user@example.com",
    "name": "John Doe",
    "age": 30,
    "role": "user"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "$id": "doc_123abc",
    "$createdAt": "2024-01-01T00:00:00.000Z",
    "$updatedAt": "2024-01-01T00:00:00.000Z",
    "$version": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "age": 30,
    "role": "user"
  }
}
```

#### GET /databases/:databaseId/collections/:collectionId/documents
List documents with filtering.

**Query Parameters:**
- `queries` (JSON array) - Filter queries (see [Queries](./QUERIES.md))
- `limit` (number) - Results per page
- `cursor` (string) - Pagination cursor
- `fields` (string) - Comma-separated fields to return (projection)
- `populate` (string) - Comma-separated relationship fields to populate

**Example:**
```
GET /documents?queries=[{"method":"equal","attribute":"role","values":["admin"]}]&limit=10
```

#### GET /databases/:databaseId/collections/:collectionId/documents/:documentId
Get document by ID.

#### PUT /databases/:databaseId/collections/:collectionId/documents/:documentId
Update document (full replacement).

**Request:**
```json
{
  "data": {
    "email": "user@example.com",
    "name": "John Smith",
    "age": 31,
    "role": "admin"
  }
}
```

#### PATCH /databases/:databaseId/collections/:collectionId/documents/:documentId
Partial update with patch operations.

**Request:**
```json
{
  "operations": [
    { "op": "set", "path": "name", "value": "Jane Doe" },
    { "op": "increment", "path": "age", "value": 1 },
    { "op": "push", "path": "tags", "value": "premium" }
  ]
}
```

#### DELETE /databases/:databaseId/collections/:collectionId/documents/:documentId
Delete document (soft delete).

#### POST /databases/:databaseId/collections/:collectionId/documents/query
Advanced query with body.

**Request:**
```json
{
  "queries": [
    { "method": "greaterThan", "attribute": "age", "values": [18] },
    { "method": "equal", "attribute": "role", "values": ["user"] },
    { "method": "orderBy", "attribute": "createdAt", "values": ["desc"] },
    { "method": "limit", "attribute": "", "values": [10] }
  ],
  "populate": ["profile", "team"]
}
```

---

### Document Versions

#### GET /documents/:documentId/versions
Get version history.

**Response:**
```json
{
  "success": true,
  "data": [
    { "version": 3, "data": {...}, "createdAt": "2024-01-03T00:00:00.000Z" },
    { "version": 2, "data": {...}, "createdAt": "2024-01-02T00:00:00.000Z" },
    { "version": 1, "data": {...}, "createdAt": "2024-01-01T00:00:00.000Z" }
  ]
}
```

#### GET /documents/:documentId/versions/:version
Get specific version.

#### POST /documents/:documentId/versions/:version/restore
Restore document to a previous version.

---

### Transactions

#### POST /databases/:databaseId/transactions/begin
Begin a transaction.

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_abc123",
    "expiresAt": "2024-01-01T00:05:00.000Z"
  }
}
```

#### POST /databases/:databaseId/transactions/:transactionId/commit
Commit transaction.

#### POST /databases/:databaseId/transactions/:transactionId/rollback
Rollback transaction.

---

### Indexes

#### POST /collections/:collectionId/indexes
Create an index.

**Request:**
```json
{
  "name": "email_idx",
  "fields": ["email"],
  "unique": true
}
```

#### GET /collections/:collectionId/indexes
List indexes.

#### DELETE /collections/:collectionId/indexes/:indexId
Delete index.

---

## Platform API

Base path: `/api/v1/platform`

### Authentication

#### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstname": "John",
  "lastname": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false
    },
    "team": {
      "id": "team_xyz",
      "name": "John"
    },
    "project": {
      "id": "proj_123",
      "name": "John's Project"
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

#### POST /auth/login
Login with credentials.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "requiresMFA": false
  }
}
```

#### POST /auth/logout
Logout (revoke tokens).

**Headers:** `Authorization: Bearer <access_token>`

#### POST /auth/refresh
Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJhbG..."
}
```

#### POST /auth/verify-email
Verify email address.

**Request:**
```json
{
  "token": "verification-token-from-email"
}
```

#### POST /auth/forgot-password
Request password reset.

**Request:**
```json
{
  "email": "user@example.com"
}
```

#### POST /auth/reset-password
Reset password with token.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "newSecurePassword123"
}
```

---

### Users

#### GET /users/me
Get current user profile.

#### PUT /users/me
Update current user profile.

**Request:**
```json
{
  "firstname": "Jane",
  "lastname": "Doe"
}
```

#### DELETE /users/me
Delete current user account.

---

### Teams

#### POST /teams
Create a new team.

**Request:**
```json
{
  "name": "My Team",
  "description": "Team description"
}
```

#### GET /teams
List user's teams.

#### GET /teams/:teamId
Get team details.

#### PUT /teams/:teamId
Update team.

#### DELETE /teams/:teamId
Delete team.

---

### Projects

#### POST /projects
Create a new project.

**Request:**
```json
{
  "name": "My Project",
  "teamId": "team_xyz"
}
```

#### GET /projects
List projects.

#### GET /projects/:projectId
Get project details.

#### PUT /projects/:projectId
Update project.

#### DELETE /projects/:projectId
Delete project.

---

### Sessions

#### GET /sessions
List active sessions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sess_abc",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastActiveAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

#### DELETE /sessions/:sessionId
Revoke a session.

---

### MFA / Two-Factor Authentication

#### POST /mfa/enable
Enable MFA.

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,..."
  }
}
```

#### POST /mfa/verify
Verify MFA code (during login or setup).

**Request:**
```json
{
  "code": "123456"
}
```

#### POST /mfa/disable
Disable MFA.

**Request:**
```json
{
  "code": "123456"
}
```

---

### API Keys

#### POST /api-keys
Create an API key.

**Request:**
```json
{
  "name": "Production API Key",
  "scopes": ["read", "write"],
  "expiresAt": "2025-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "key_abc123",
    "name": "Production API Key",
    "key": "mk_live_abc123xyz...",
    "scopes": ["read", "write"],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

> **Note:** The full API key is only shown once upon creation.

#### GET /api-keys
List API keys.

#### DELETE /api-keys/:keyId
Revoke an API key.

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `SCHEMA_VALIDATION_FAILED` | 400 | Document doesn't match schema |
| `INVALID_QUERY` | 400 | Invalid query syntax |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `UNIQUE_CONSTRAINT_VIOLATION` | 409 | Unique field value exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| General API | 100 requests/minute |
| Auth endpoints | 10 requests/minute |
| Document queries | 100 requests/minute |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```
