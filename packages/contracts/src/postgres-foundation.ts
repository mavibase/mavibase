import type { SqlQueryExecutor, SqlQueryResult } from "./postgres-schema.js";

export interface PostgresSqlStatement {
  readonly text: string;
  readonly values: readonly unknown[];
}

export type PostgresExtensionStatus =
  | "operator-managed"
  | "provider-dependent"
  | "supported"
  | "unsupported";

export interface PostgresExtensionDefinition {
  readonly name: string;
  readonly status: PostgresExtensionStatus;
  readonly supportedVersions: readonly string[];
  readonly requiresRestart: boolean;
  readonly securityClass: "normal" | "privileged";
}

export interface PostgresExtensionRequest {
  readonly name: string;
  readonly version?: string;
}

export interface PostgresMigrationPlan {
  readonly id: string;
  readonly description: string;
  readonly statements: readonly PostgresSqlStatement[];
}

export interface PostgresQueryPredicate {
  readonly column: string;
  readonly operator: "=" | "<>" | "<" | "<=" | ">" | ">=";
  readonly value: unknown;
}

export interface PostgresSelectQuery {
  readonly schema: string;
  readonly table: string;
  readonly columns: readonly string[];
  readonly predicates?: readonly PostgresQueryPredicate[];
  readonly limit?: number;
}

export interface PostgresTransaction extends SqlQueryExecutor {
  readonly commit: () => Promise<void>;
  readonly rollback: () => Promise<void>;
}

export interface PostgresTransactionProvider {
  withTransaction<T>(
    operation: (transaction: PostgresTransaction) => Promise<T>,
  ): Promise<T>;
}

export type PostgresQueryResult<Row> = SqlQueryResult<Row>;
