# Schema Validation

Mavibase supports schema validation to ensure data integrity in your collections.

## Schema Definition

Schemas are defined when creating or updating a collection:

```json
{
  "name": "users",
  "schema": {
    "fields": [
      { "name": "email", "type": "email", "required": true, "unique": true },
      { "name": "name", "type": "string", "required": true },
      { "name": "age", "type": "integer" },
      { "name": "role", "type": "enum", "validation": { "enum": ["admin", "user", "guest"] } }
    ]
  }
}
```

## Field Types

### Basic Types

| Type | Description | Example Values |
|------|-------------|----------------|
| `string` | Text values | `"hello"`, `"John Doe"` |
| `number` | Any numeric value | `42`, `3.14`, `-10` |
| `integer` | Whole numbers only | `1`, `42`, `-5` |
| `float` | Decimal numbers | `3.14`, `2.5` |
| `boolean` | True/false values | `true`, `false` |
| `object` | Nested JSON objects | `{ "key": "value" }` |
| `array` | Arrays of values | `[1, 2, 3]`, `["a", "b"]` |

### Specialized String Types

| Type | Description | Example Values |
|------|-------------|----------------|
| `email` | Valid email addresses | `"user@example.com"` |
| `url` | Valid URLs | `"https://example.com"` |
| `ip` | IPv4 or IPv6 addresses | `"192.168.1.1"`, `"::1"` |
| `datetime` | ISO 8601 datetime | `"2024-01-01T00:00:00Z"` |
| `enum` | Predefined values | Must match enum list |

### Relationship Type

| Type | Description |
|------|-------------|
| `relationship` | Reference to documents in another collection |

---

## Field Properties

### required
Field must be present in document.

```json
{ "name": "email", "type": "email", "required": true }
```

### unique
Field value must be unique across collection.

```json
{ "name": "username", "type": "string", "unique": true }
```

### default
Default value if field is not provided.

```json
{ "name": "status", "type": "string", "default": "pending" }
{ "name": "views", "type": "integer", "default": 0 }
```

---

## Validation Rules

Add validation rules in the `validation` object:

### String Validation

```json
{
  "name": "username",
  "type": "string",
  "validation": {
    "minLength": 3,
    "maxLength": 50,
    "pattern": "^[a-zA-Z0-9_]+$"
  }
}
```

| Rule | Description |
|------|-------------|
| `minLength` | Minimum string length |
| `maxLength` | Maximum string length |
| `pattern` | Regex pattern to match |

### Number Validation

```json
{
  "name": "age",
  "type": "integer",
  "validation": {
    "min": 0,
    "max": 150
  }
}
```

| Rule | Description |
|------|-------------|
| `min` | Minimum value |
| `max` | Maximum value |

### Array Validation

```json
{
  "name": "tags",
  "type": "array",
  "validation": {
    "minItems": 1,
    "maxItems": 10
  }
}
```

| Rule | Description |
|------|-------------|
| `minItems` | Minimum array length |
| `maxItems` | Maximum array length |

### Enum Validation

```json
{
  "name": "status",
  "type": "enum",
  "validation": {
    "enum": ["draft", "published", "archived"]
  }
}
```

### Custom Error Messages

```json
{
  "name": "age",
  "type": "integer",
  "validation": {
    "min": 18,
    "customMessage": "You must be at least 18 years old"
  }
}
```

---

## Complete Schema Example

```json
{
  "name": "products",
  "schema": {
    "fields": [
      {
        "name": "sku",
        "type": "string",
        "required": true,
        "unique": true,
        "validation": {
          "minLength": 5,
          "maxLength": 20,
          "pattern": "^[A-Z0-9-]+$"
        }
      },
      {
        "name": "name",
        "type": "string",
        "required": true,
        "validation": {
          "maxLength": 200
        }
      },
      {
        "name": "description",
        "type": "string",
        "validation": {
          "maxLength": 5000
        }
      },
      {
        "name": "price",
        "type": "number",
        "required": true,
        "validation": {
          "min": 0
        }
      },
      {
        "name": "quantity",
        "type": "integer",
        "default": 0,
        "validation": {
          "min": 0
        }
      },
      {
        "name": "status",
        "type": "enum",
        "required": true,
        "default": "draft",
        "validation": {
          "enum": ["draft", "active", "discontinued"]
        }
      },
      {
        "name": "tags",
        "type": "array",
        "validation": {
          "maxItems": 20
        }
      },
      {
        "name": "metadata",
        "type": "object"
      },
      {
        "name": "websiteUrl",
        "type": "url"
      },
      {
        "name": "contactEmail",
        "type": "email"
      },
      {
        "name": "publishedAt",
        "type": "datetime"
      },
      {
        "name": "category",
        "type": "relationship",
        "relationship": {
          "type": "manyToOne",
          "relatedCollection": "categories",
          "onDelete": "setNull"
        }
      }
    ]
  }
}
```

---

## Validation Errors

When validation fails, you receive detailed error information:

```json
{
  "success": false,
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "Document validation failed against schema",
    "details": {
      "errors": [
        "Field 'email' is required but missing",
        "Field 'age' must be at least 0"
      ],
      "fieldDetails": {
        "email": {
          "error": "required_field_missing",
          "expectedType": "email",
          "required": true
        },
        "age": {
          "error": "validation_failed",
          "message": "Field 'age' must be at least 0"
        }
      },
      "allowedFields": [
        { "name": "email", "type": "email", "required": true },
        { "name": "age", "type": "integer", "required": false }
      ]
    }
  }
}
```

---

## Unique Constraint Violations

When unique constraints are violated:

```json
{
  "success": false,
  "error": {
    "code": "UNIQUE_CONSTRAINT_VIOLATION",
    "message": "Unique constraint validation failed",
    "details": {
      "errors": [
        "Field 'email' must be unique. Value 'user@example.com' already exists"
      ]
    }
  }
}
```

---

## Schema Updates

When updating a collection schema:

1. **Adding fields** - New documents must include required new fields
2. **Removing fields** - Existing documents retain the field data
3. **Changing types** - May cause validation errors for existing documents
4. **Adding unique** - Will fail if duplicates exist

### Safe Schema Migrations

1. Add new fields as optional first
2. Migrate existing data if needed
3. Then make fields required

```json
// Step 1: Add as optional
{ "name": "newField", "type": "string" }

// Step 2: After migrating data, make required
{ "name": "newField", "type": "string", "required": true }
```

---

## Unknown Fields

By default, unknown fields (not in schema) are allowed. To reject unknown fields:

```env
REJECT_UNKNOWN_FIELDS=true
```

This will return an error if a document contains fields not defined in the schema.
