# Relationships

Mavibase supports full document relationships with automatic validation, population, and cascade operations.

## Relationship Types

| Type | Description | Example |
|------|-------------|---------|
| `oneToOne` | One document relates to exactly one other | User → Profile |
| `oneToMany` | One document relates to many others | Author → Posts |
| `manyToOne` | Many documents relate to one | Posts → Author |
| `manyToMany` | Many documents relate to many | Posts ↔ Tags |

## Defining Relationships

Add a relationship field in your collection schema:

```json
{
  "name": "posts",
  "schema": {
    "fields": [
      { "name": "title", "type": "string", "required": true },
      { "name": "content", "type": "string" },
      {
        "name": "author",
        "type": "relationship",
        "relationship": {
          "type": "manyToOne",
          "relatedCollection": "users",
          "onDelete": "setNull"
        }
      }
    ]
  }
}
```

## Relationship Configuration

### type (required)
The relationship cardinality:
- `oneToOne` - Single reference (stored as string ID)
- `oneToMany` - Array of references (stored as array of IDs)
- `manyToOne` - Single reference (stored as string ID)
- `manyToMany` - Array of references (stored as array of IDs)

### relatedCollection (required)
The target collection name or ID:
```json
"relatedCollection": "users"
"relatedCollection": "col_abc123"
```

### onDelete (required)
Action when referenced document is deleted:

| Action | Description |
|--------|-------------|
| `cascade` | Delete all documents that reference this one |
| `setNull` | Set the relationship field to null |
| `restrict` | Prevent deletion if references exist |

### twoWay (optional)
Create a reverse relationship in the target collection:
```json
{
  "name": "author",
  "type": "relationship",
  "relationship": {
    "type": "manyToOne",
    "relatedCollection": "users",
    "onDelete": "setNull",
    "twoWay": true,
    "twoWayKey": "posts"
  }
}
```

This automatically creates a `posts` field in the `users` collection.

---

## Relationship Examples

### One-to-One: User → Profile

**Users collection:**
```json
{
  "name": "users",
  "schema": {
    "fields": [
      { "name": "email", "type": "email", "required": true },
      {
        "name": "profile",
        "type": "relationship",
        "relationship": {
          "type": "oneToOne",
          "relatedCollection": "profiles",
          "onDelete": "cascade"
        }
      }
    ]
  }
}
```

**Creating a user with profile:**
```json
// 1. Create profile first
POST /collections/profiles/documents
{ "data": { "bio": "Hello world", "avatar": "https://..." } }
// Returns: { "$id": "prof_123", ... }

// 2. Create user with profile reference
POST /collections/users/documents
{ "data": { "email": "user@example.com", "profile": "prof_123" } }
```

### One-to-Many: Author → Posts (Two-Way)

**Authors collection:**
```json
{
  "name": "authors",
  "schema": {
    "fields": [
      { "name": "name", "type": "string", "required": true },
      {
        "name": "posts",
        "type": "relationship",
        "relationship": {
          "type": "oneToMany",
          "relatedCollection": "posts",
          "onDelete": "cascade",
          "twoWay": true,
          "twoWayKey": "author"
        }
      }
    ]
  }
}
```

This creates:
- `posts` field in authors (array of post IDs)
- `author` field in posts (single author ID) - automatically created

### Many-to-Many: Posts ↔ Tags

**Posts collection:**
```json
{
  "name": "posts",
  "schema": {
    "fields": [
      { "name": "title", "type": "string" },
      {
        "name": "tags",
        "type": "relationship",
        "relationship": {
          "type": "manyToMany",
          "relatedCollection": "tags",
          "onDelete": "setNull",
          "twoWay": true,
          "twoWayKey": "posts"
        }
      }
    ]
  }
}
```

---

## Storing Relationships

### Single Reference (oneToOne, manyToOne)
Store as a string document ID:

```json
{
  "data": {
    "title": "My First Post",
    "author": "usr_abc123"
  }
}
```

### Multiple References (oneToMany, manyToMany)
Store as an array of document IDs:

```json
{
  "data": {
    "title": "My First Post",
    "tags": ["tag_1", "tag_2", "tag_3"]
  }
}
```

---

## Populating Relationships

By default, relationship fields return IDs. Use `populate` to fetch full documents:

### Query Parameter
```
GET /documents?populate=author,tags
```

### Request Body
```json
POST /documents/query
{
  "queries": [...],
  "populate": ["author", "tags"]
}
```

### Before Population
```json
{
  "$id": "post_123",
  "title": "My Post",
  "author": "usr_abc",
  "tags": ["tag_1", "tag_2"]
}
```

### After Population
```json
{
  "$id": "post_123",
  "title": "My Post",
  "author": {
    "$id": "usr_abc",
    "$createdAt": "2024-01-01T00:00:00Z",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "tags": [
    { "$id": "tag_1", "name": "Technology" },
    { "$id": "tag_2", "name": "Tutorial" }
  ]
}
```

---

## Relationship Validation

Mavibase validates relationships when creating/updating documents:

### 1. Target Collection Exists
```json
{
  "error": {
    "code": "TARGET_COLLECTION_NOT_FOUND",
    "message": "Target collection 'categories' not found"
  }
}
```

### 2. Referenced Document Exists
```json
{
  "error": {
    "code": "REFERENCED_DOCUMENT_NOT_FOUND",
    "message": "Document 'doc_invalid' referenced by 'author' not found"
  }
}
```

### 3. Correct Value Type
```json
// For oneToOne/manyToOne - must be string
"author": "usr_123"  // ✓ Correct
"author": ["usr_123"]  // ✗ Wrong

// For oneToMany/manyToMany - must be array
"tags": ["tag_1", "tag_2"]  // ✓ Correct
"tags": "tag_1"  // ✗ Wrong
```

---

## Cascade Delete Behavior

### cascade
When a referenced document is deleted, all documents referencing it are also deleted:

```
Delete user_123 → All posts where author = user_123 are deleted
```

### setNull
When a referenced document is deleted, the relationship field is set to null:

```
Delete user_123 → All posts where author = user_123 have author set to null
```

### restrict
Deletion is prevented if any documents reference it:

```json
{
  "error": {
    "code": "REFERENCE_EXISTS",
    "message": "Cannot delete: 5 document(s) reference this document via 'author'",
    "details": {
      "referencingDocuments": 5,
      "field": "author"
    }
  }
}
```

---

## Best Practices

### 1. Choose the Right Relationship Type
- Use `manyToOne` for "belongs to" relationships (post belongs to author)
- Use `oneToMany` for "has many" relationships (author has many posts)
- Use `manyToMany` for flexible associations (posts have tags, tags have posts)

### 2. Consider onDelete Carefully
- `cascade` - Use when child data is meaningless without parent (order items without order)
- `setNull` - Use when preserving history matters (posts without deleted author)
- `restrict` - Use when deletion should require explicit cleanup

### 3. Use Two-Way Sparingly
- Creates additional schema fields
- Requires synchronization overhead
- Best for frequently queried reverse relationships

### 4. Index Relationship Fields
For better query performance on relationship fields:
```json
POST /collections/{collectionId}/indexes
{
  "name": "author_idx",
  "fields": ["author"]
}
```

### 5. Populate Only When Needed
- Population adds database queries
- Only populate fields you need
- Consider pagination when populating arrays
