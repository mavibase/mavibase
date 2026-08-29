import type {
  PostgresTransaction,
  PostgresTransactionProvider,
} from "@mavibase/contracts";

export async function withPostgresTransaction<T>(
  provider: PostgresTransactionProvider,
  operation: (transaction: PostgresTransaction) => Promise<T>,
): Promise<T> {
  return provider.withTransaction(operation);
}
