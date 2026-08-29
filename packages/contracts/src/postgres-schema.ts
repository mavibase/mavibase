export type PostgresColumnType =
  | "bigint"
  | "boolean"
  | "date"
  | "integer"
  | "jsonb"
  | "numeric"
  | "text"
  | "timestamp"
  | "timestamptz"
  | "uuid";

export type PostgresConstraintType =
  | "check"
  | "exclude"
  | "foreign-key"
  | "primary-key"
  | "unique"
  | "unknown";

export interface PostgresColumn {
  readonly name: string;
  readonly ordinalPosition: number;
  readonly dataType: string;
  readonly isNullable: boolean;
  readonly defaultExpression: string | null;
}

export interface PostgresConstraint {
  readonly name: string;
  readonly type: PostgresConstraintType;
  readonly definition: string;
}

export interface PostgresIndex {
  readonly name: string;
  readonly definition: string;
  readonly isUnique: boolean;
  readonly isPrimary: boolean;
}

export interface PostgresTable {
  readonly schema: string;
  readonly name: string;
  readonly columns: readonly PostgresColumn[];
  readonly constraints: readonly PostgresConstraint[];
  readonly indexes: readonly PostgresIndex[];
}

export interface PostgresSchemaCatalog {
  readonly schema: string;
  readonly tables: readonly PostgresTable[];
}

export interface SqlQueryResult<Row> {
  readonly rows: readonly Row[];
}

export interface SqlQueryExecutor {
  query<Row = unknown>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>>;
}
