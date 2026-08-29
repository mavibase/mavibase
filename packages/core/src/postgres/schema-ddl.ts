import type {
  PostgresColumnType,
  SqlQueryExecutor,
} from "@mavibase/contracts";
import { assertPostgresIdentifier, quotePostgresIdentifier } from "./identifier.js";

export interface CreateColumnDefinition {
  readonly name: string;
  readonly type: PostgresColumnType;
  readonly nullable?: boolean;
}

export interface CreateForeignKeyDefinition {
  readonly name: string;
  readonly columns: readonly string[];
  readonly referencedSchema: string;
  readonly referencedTable: string;
  readonly referencedColumns: readonly string[];
}

export interface CreateTableDefinition {
  readonly schema: string;
  readonly name: string;
  readonly columns: readonly CreateColumnDefinition[];
  readonly primaryKey?: readonly string[];
  readonly uniqueConstraints?: readonly (readonly string[])[];
  readonly foreignKeys?: readonly CreateForeignKeyDefinition[];
}

export interface CreateIndexDefinition {
  readonly schema: string;
  readonly table: string;
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique?: boolean;
}

export interface SqlStatement {
  readonly text: string;
  readonly values: readonly unknown[];
}

export function createTableStatement(definition: CreateTableDefinition): SqlStatement {
  assertDefinition(definition);
  const tableName = qualifiedName(definition.schema, definition.name);
  const columnStatements = definition.columns.map((column) => {
    const nullability = column.nullable === false ? " NOT NULL" : "";
    return `${quotePostgresIdentifier(column.name)} ${column.type}${nullability}`;
  });
  const constraintStatements: string[] = [];

  if (definition.primaryKey !== undefined) {
    constraintStatements.push(`PRIMARY KEY (${columnList(definition.primaryKey)})`);
  }

  for (const columns of definition.uniqueConstraints ?? []) {
    if (columns.length === 0) {
      throw new Error("Unique constraints require at least one column");
    }
    constraintStatements.push(`UNIQUE (${columnList(columns)})`);
  }

  for (const foreignKey of definition.foreignKeys ?? []) {
    if (foreignKey.columns.length === 0 || foreignKey.columns.length !== foreignKey.referencedColumns.length) {
      throw new Error(`Foreign key ${foreignKey.name} has mismatched columns`);
    }
    constraintStatements.push(
      `CONSTRAINT ${quotePostgresIdentifier(foreignKey.name)} FOREIGN KEY (${columnList(foreignKey.columns)}) REFERENCES ${qualifiedName(foreignKey.referencedSchema, foreignKey.referencedTable)} (${columnList(foreignKey.referencedColumns)})`,
    );
  }

  return {
    text: `CREATE TABLE ${tableName} (${[...columnStatements, ...constraintStatements].join(", ")})`,
    values: [],
  };
}

export function createIndexStatement(definition: CreateIndexDefinition): SqlStatement {
  if (definition.columns.length === 0) {
    throw new Error("Indexes require at least one column");
  }
  for (const identifier of [definition.schema, definition.table, definition.name, ...definition.columns]) {
    assertPostgresIdentifier(identifier);
  }
  const uniqueness = definition.unique === true ? "UNIQUE " : "";
  return {
    text: `CREATE ${uniqueness}INDEX ${quotePostgresIdentifier(definition.name)} ON ${qualifiedName(definition.schema, definition.table)} (${columnList(definition.columns)})`,
    values: [],
  };
}

export async function executeStatement(
  executor: SqlQueryExecutor,
  statement: SqlStatement,
): Promise<void> {
  await executor.query(statement.text, statement.values);
}

function assertDefinition(definition: CreateTableDefinition): void {
  for (const identifier of [definition.schema, definition.name, ...definition.columns.map((column) => column.name)]) {
    assertPostgresIdentifier(identifier);
  }
  if (definition.columns.length === 0) {
    throw new Error("Tables require at least one column");
  }
}

function qualifiedName(schema: string, name: string): string {
  assertPostgresIdentifier(schema);
  assertPostgresIdentifier(name);
  return `${quotePostgresIdentifier(schema)}.${quotePostgresIdentifier(name)}`;
}

function columnList(columns: readonly string[]): string {
  return columns.map((column) => quotePostgresIdentifier(assertPostgresIdentifier(column))).join(", ");
}
