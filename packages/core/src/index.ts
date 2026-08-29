export {
  assertPostgresIdentifier,
  quotePostgresIdentifier,
} from "./postgres/identifier.js";
export {
  createIndexStatement,
  createTableStatement,
  executeStatement,
} from "./postgres/schema-ddl.js";
export type {
  CreateColumnDefinition,
  CreateForeignKeyDefinition,
  CreateIndexDefinition,
  CreateTableDefinition,
  SqlStatement,
} from "./postgres/schema-ddl.js";
export { introspectPostgresSchema } from "./postgres/schema-introspector.js";
