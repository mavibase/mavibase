export function quotePostgresIdentifier(identifier: string): string {
  if (identifier.length === 0 || identifier.includes("\u0000")) {
    throw new Error("PostgreSQL identifiers must be non-empty and contain no NUL bytes");
  }
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function assertPostgresIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }
  return identifier;
}
