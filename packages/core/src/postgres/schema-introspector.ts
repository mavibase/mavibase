import type {
  PostgresColumn,
  PostgresConstraint,
  PostgresConstraintType,
  PostgresIndex,
  PostgresSchemaCatalog,
  PostgresTable,
  SqlQueryExecutor,
} from "@mavibase/contracts";
import { assertPostgresIdentifier } from "./identifier.js";

interface TableRow {
  readonly table_name: unknown;
}

interface ColumnRow {
  readonly table_name: unknown;
  readonly column_name: unknown;
  readonly ordinal_position: unknown;
  readonly data_type: unknown;
  readonly is_nullable: unknown;
  readonly column_default: unknown;
}

interface ConstraintRow {
  readonly table_name: unknown;
  readonly constraint_name: unknown;
  readonly constraint_type: unknown;
  readonly definition: unknown;
}

interface IndexRow {
  readonly tablename: unknown;
  readonly indexname: unknown;
  readonly indexdef: unknown;
  readonly is_unique: unknown;
  readonly is_primary: unknown;
}

const tableQuery = `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = $1
  AND table_type = 'BASE TABLE'
ORDER BY table_name
`;

const columnQuery = `
SELECT table_name, column_name, ordinal_position, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = $1
ORDER BY table_name, ordinal_position
`;

const constraintQuery = `
SELECT cls.relname AS table_name,
       con.conname AS constraint_name,
       CASE con.contype
         WHEN 'p' THEN 'primary-key'
         WHEN 'u' THEN 'unique'
         WHEN 'f' THEN 'foreign-key'
         WHEN 'c' THEN 'check'
         WHEN 'x' THEN 'exclude'
         ELSE 'unknown'
       END AS constraint_type,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class cls ON cls.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = $1
ORDER BY cls.relname, con.conname
`;

const indexQuery = `
SELECT table_class.relname AS tablename,
       index_class.relname AS indexname,
       pg_get_indexdef(index_class.oid) AS indexdef,
       index_meta.indisunique AS is_unique,
       index_meta.indisprimary AS is_primary
FROM pg_index index_meta
JOIN pg_class table_class ON table_class.oid = index_meta.indrelid
JOIN pg_class index_class ON index_class.oid = index_meta.indexrelid
JOIN pg_namespace schema_namespace ON schema_namespace.oid = table_class.relnamespace
WHERE schema_namespace.nspname = $1
ORDER BY table_class.relname, index_class.relname
`;

export async function introspectPostgresSchema(
  executor: SqlQueryExecutor,
  schema: string,
): Promise<PostgresSchemaCatalog> {
  assertPostgresIdentifier(schema);
  const [tables, columns, constraints, indexes] = await Promise.all([
    executor.query<TableRow>(tableQuery, [schema]),
    executor.query<ColumnRow>(columnQuery, [schema]),
    executor.query<ConstraintRow>(constraintQuery, [schema]),
    executor.query<IndexRow>(indexQuery, [schema]),
  ]);
  const tableMap = new Map<string, PostgresTable>();

  for (const row of tables.rows) {
    const name = readString(row.table_name, "table_name");
    tableMap.set(name, {
      schema,
      name,
      columns: [],
      constraints: [],
      indexes: [],
    });
  }

  for (const row of columns.rows) {
    const table = requireTable(tableMap, row.table_name);
    const column: PostgresColumn = {
      name: readString(row.column_name, "column_name"),
      ordinalPosition: readNumber(row.ordinal_position, "ordinal_position"),
      dataType: readString(row.data_type, "data_type"),
      isNullable: readString(row.is_nullable, "is_nullable") === "YES",
      defaultExpression: readNullableString(row.column_default, "column_default"),
    };
    tableMap.set(table.name, { ...table, columns: [...table.columns, column] });
  }

  for (const row of constraints.rows) {
    const table = requireTable(tableMap, row.table_name);
    const constraint: PostgresConstraint = {
      name: readString(row.constraint_name, "constraint_name"),
      type: readConstraintType(row.constraint_type),
      definition: readString(row.definition, "definition"),
    };
    tableMap.set(table.name, { ...table, constraints: [...table.constraints, constraint] });
  }

  for (const row of indexes.rows) {
    const table = requireTable(tableMap, row.tablename);
    const index: PostgresIndex = {
      name: readString(row.indexname, "indexname"),
      definition: readString(row.indexdef, "indexdef"),
      isUnique: readBoolean(row.is_unique, "is_unique"),
      isPrimary: readBoolean(row.is_primary, "is_primary"),
    };
    tableMap.set(table.name, { ...table, indexes: [...table.indexes, index] });
  }

  return {
    schema,
    tables: [...tableMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function requireTable(tableMap: ReadonlyMap<string, PostgresTable>, value: unknown): PostgresTable {
  const name = readString(value, "table_name");
  const table = tableMap.get(name);
  if (table === undefined) {
    throw new Error(`PostgreSQL catalog row references unknown table: ${name}`);
  }
  return table;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid PostgreSQL catalog field: ${field}`);
  }
  return value;
}

function readNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return readString(value, field);
}

function readNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(`Invalid PostgreSQL catalog field: ${field}`);
  }
  return number;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "t" || value === "true") {
    return true;
  }
  if (value === "f" || value === "false") {
    return false;
  }
  throw new Error(`Invalid PostgreSQL catalog field: ${field}`);
}

function readConstraintType(value: unknown): PostgresConstraintType {
  const type = readString(value, "constraint_type");
  if (["check", "exclude", "foreign-key", "primary-key", "unique", "unknown"].includes(type)) {
    return type as PostgresConstraintType;
  }
  throw new Error(`Invalid PostgreSQL constraint type: ${type}`);
}
