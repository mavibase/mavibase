import type {
  PostgresSelectQuery,
  PostgresSqlStatement,
} from "@mavibase/contracts";
import { assertPostgresIdentifier, quotePostgresIdentifier } from "./identifier.js";

export function compilePostgresSelect(
  query: PostgresSelectQuery,
): PostgresSqlStatement {
  assertPostgresIdentifier(query.schema);
  assertPostgresIdentifier(query.table);
  if (query.columns.length === 0) {
    throw new Error("A PostgreSQL select requires at least one column");
  }
  for (const column of query.columns) {
    assertPostgresIdentifier(column);
  }
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 10000)) {
    throw new Error("PostgreSQL select limit must be an integer from 1 through 10000");
  }

  const values: unknown[] = [];
  const predicates = (query.predicates ?? []).map((predicate) => {
    assertPostgresIdentifier(predicate.column);
    values.push(predicate.value);
    return `${quotePostgresIdentifier(predicate.column)} ${predicate.operator} $${values.length}`;
  });
  const whereClause = predicates.length === 0 ? "" : ` WHERE ${predicates.join(" AND ")}`;
  const limitClause = query.limit === undefined ? "" : ` LIMIT ${query.limit}`;

  return {
    text: `SELECT ${query.columns.map((column) => quotePostgresIdentifier(column)).join(", ")} FROM ${quotePostgresIdentifier(query.schema)}.${quotePostgresIdentifier(query.table)}${whereClause}${limitClause}`,
    values,
  };
}
