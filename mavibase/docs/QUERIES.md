# Query Language

Mavibase provides a powerful query language for filtering, sorting, and paginating documents.

## Query Format

Queries are passed as a JSON array of query operators:

```json
[
  { "method": "equal", "attribute": "status", "values": ["active"] },
  { "method": "greaterThan", "attribute": "age", "values": [18] },
  { "method": "orderBy", "attribute": "createdAt", "values": ["desc"] },
  { "method": "limit", "attribute": "", "values": [10] }
]
```

## Query Methods

### Comparison Operators

#### equal
Exact match.

```json
{ "method": "equal", "attribute": "status", "values": ["active"] }
{ "method": "equal", "attribute": "age", "values": [25] }
{ "method": "equal", "attribute": "verified", "values": [true] }
```

#### notEqual
Not equal to value.

```json
{ "method": "notEqual", "attribute": "status", "values": ["deleted"] }
```

#### lessThan
Less than value (numbers, dates).

```json
{ "method": "lessThan", "attribute": "price", "values": [100] }
{ "method": "lessThan", "attribute": "createdAt", "values": ["2024-01-01T00:00:00Z"] }
```

#### lessThanEqual
Less than or equal to value.

```json
{ "method": "lessThanEqual", "attribute": "age", "values": [65] }
```

#### greaterThan
Greater than value.

```json
{ "method": "greaterThan", "attribute": "score", "values": [90] }
```

#### greaterThanEqual
Greater than or equal to value.

```json
{ "method": "greaterThanEqual", "attribute": "quantity", "values": [1] }
```

#### between
Value between two bounds (inclusive).

```json
{ "method": "between", "attribute": "price", "values": [10, 100] }
{ "method": "between", "attribute": "createdAt", "values": ["2024-01-01", "2024-12-31"] }
```

---

### String Operators

#### contains
Field contains substring (case-insensitive).

```json
{ "method": "contains", "attribute": "name", "values": ["john"] }
```

#### startsWith
Field starts with prefix.

```json
{ "method": "startsWith", "attribute": "email", "values": ["admin@"] }
```

#### endsWith
Field ends with suffix.

```json
{ "method": "endsWith", "attribute": "email", "values": ["@gmail.com"] }
```

#### search
Full-text search (uses PostgreSQL text search).

```json
{ "method": "search", "attribute": "description", "values": ["product review"] }
```

---

### Array Operators

#### in
Field value is in array of values.

```json
{ "method": "in", "attribute": "status", "values": ["active", "pending", "review"] }
{ "method": "in", "attribute": "categoryId", "values": ["cat1", "cat2", "cat3"] }
```

#### notIn
Field value is not in array of values.

```json
{ "method": "notIn", "attribute": "role", "values": ["banned", "suspended"] }
```

---

### Null Operators

#### isNull
Field is null or doesn't exist.

```json
{ "method": "isNull", "attribute": "deletedAt", "values": [] }
```

#### isNotNull
Field is not null and exists.

```json
{ "method": "isNotNull", "attribute": "verifiedAt", "values": [] }
```

---

### Logical Operators

#### and
All conditions must match.

```json
{
  "method": "and",
  "attribute": "",
  "values": [[
    { "method": "equal", "attribute": "status", "values": ["active"] },
    { "method": "greaterThan", "attribute": "age", "values": [18] }
  ]]
}
```

#### or
Any condition must match.

```json
{
  "method": "or",
  "attribute": "",
  "values": [[
    { "method": "equal", "attribute": "role", "values": ["admin"] },
    { "method": "equal", "attribute": "role", "values": ["moderator"] }
  ]]
}
```

#### not
Negate conditions.

```json
{
  "method": "not",
  "attribute": "",
  "values": [[
    { "method": "equal", "attribute": "status", "values": ["deleted"] }
  ]]
}
```

---

### Sorting & Pagination

#### orderBy
Sort results by field.

```json
{ "method": "orderBy", "attribute": "createdAt", "values": ["desc"] }
{ "method": "orderBy", "attribute": "name", "values": ["asc"] }
```

#### limit
Limit number of results.

```json
{ "method": "limit", "attribute": "", "values": [25] }
```

#### offset
Skip number of results (use with limit for pagination).

```json
{ "method": "offset", "attribute": "", "values": [50] }
```

---

## Query Examples

### Basic Filtering

Find active users:
```json
[
  { "method": "equal", "attribute": "status", "values": ["active"] }
]
```

Find users older than 18:
```json
[
  { "method": "greaterThan", "attribute": "age", "values": [18] }
]
```

### Multiple Conditions

Find active premium users:
```json
[
  { "method": "equal", "attribute": "status", "values": ["active"] },
  { "method": "equal", "attribute": "plan", "values": ["premium"] }
]
```

### Complex Queries

Find users who are either admins or have a verified email, sorted by creation date:
```json
[
  {
    "method": "or",
    "attribute": "",
    "values": [[
      { "method": "equal", "attribute": "role", "values": ["admin"] },
      { "method": "isNotNull", "attribute": "emailVerifiedAt", "values": [] }
    ]]
  },
  { "method": "orderBy", "attribute": "createdAt", "values": ["desc"] },
  { "method": "limit", "attribute": "", "values": [20] }
]
```

### Date Range Queries

Find orders from January 2024:
```json
[
  { "method": "between", "attribute": "createdAt", "values": ["2024-01-01T00:00:00Z", "2024-01-31T23:59:59Z"] }
]
```

### Text Search

Find products matching "wireless headphones":
```json
[
  { "method": "search", "attribute": "description", "values": ["wireless headphones"] }
]
```

### Pagination

Page 3 of results (25 per page):
```json
[
  { "method": "orderBy", "attribute": "createdAt", "values": ["desc"] },
  { "method": "limit", "attribute": "", "values": [25] },
  { "method": "offset", "attribute": "", "values": [50] }
]
```

---

## Using Queries in API

### Query String (GET requests)

URL-encode the JSON array:

```
GET /api/v1/db/databases/{db}/collections/{col}/documents?queries=[{"method":"equal","attribute":"status","values":["active"]}]
```

### Request Body (POST /documents/query)

```json
POST /api/v1/db/databases/{db}/collections/{col}/documents/query

{
  "queries": [
    { "method": "equal", "attribute": "status", "values": ["active"] },
    { "method": "orderBy", "attribute": "createdAt", "values": ["desc"] }
  ],
  "populate": ["author", "category"]
}
```

---

## Query Limits

| Limit | Default | Description |
|-------|---------|-------------|
| Max filters | 50 | Maximum number of query operators |
| Max OR conditions | 10 | Maximum conditions in OR operator |
| Max IN values | 100 | Maximum values in IN/notIn operators |
| Max query depth | 5 | Maximum nesting of logical operators |
| Max regex length | 200 | Maximum pattern length for string operators |
| Max results | 100 | Maximum documents returned (configurable) |

---

## Performance Tips

1. **Use indexes** - Create indexes on frequently queried fields
2. **Limit results** - Always use `limit` to avoid fetching too many documents
3. **Avoid deep nesting** - Keep logical operator nesting shallow
4. **Use cursor pagination** - For large datasets, use cursor-based pagination instead of offset
5. **Project fields** - Use the `fields` parameter to return only needed fields
