import type {
  PostgresMigrationPlan,
  PostgresSqlStatement,
  SqlQueryExecutor,
} from "@mavibase/contracts";

export function validatePostgresMigrationPlan(
  plan: PostgresMigrationPlan,
): PostgresMigrationPlan {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(plan.id)) {
    throw new Error(`Invalid PostgreSQL migration ID: ${plan.id}`);
  }
  if (plan.description.trim().length === 0) {
    throw new Error(`Migration ${plan.id} requires a description`);
  }
  if (plan.statements.length === 0) {
    throw new Error(`Migration ${plan.id} requires at least one statement`);
  }
  for (const statement of plan.statements) {
    validateStatement(statement);
  }
  return plan;
}

export async function applyPostgresMigrationPlan(
  executor: SqlQueryExecutor,
  plan: PostgresMigrationPlan,
): Promise<void> {
  const validatedPlan = validatePostgresMigrationPlan(plan);
  for (const statement of validatedPlan.statements) {
    await executor.query(statement.text, statement.values);
  }
}

function validateStatement(statement: PostgresSqlStatement): void {
  if (statement.text.trim().length === 0) {
    throw new Error("Migration statements must not be empty");
  }
  if (statement.text.includes("\u0000")) {
    throw new Error("Migration statements must not contain NUL bytes");
  }
}
