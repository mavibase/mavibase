import type {
  PostgresBackupProvider,
  PostgresBackupRequest,
  PostgresDatabaseProvisioningRequest,
  PostgresOperationReference,
  PostgresProvisioningProvider,
} from "@mavibase/contracts";

export async function requestPostgresBackup(
  provider: PostgresBackupProvider,
  request: PostgresBackupRequest,
): Promise<PostgresOperationReference> {
  validateBackupRequest(request);
  return provider.createBackup(request);
}

export async function requestPostgresDatabaseProvisioning(
  provider: PostgresProvisioningProvider,
  request: PostgresDatabaseProvisioningRequest,
): Promise<PostgresOperationReference> {
  validateProvisioningRequest(request);
  return provider.provisionDatabase(request);
}

function validateBackupRequest(request: PostgresBackupRequest): void {
  requireIdentifier(request.backupId, "backupId");
  requireIdentifier(request.databaseResourceId, "databaseResourceId");
  requireIdentifier(request.requestedBy, "requestedBy");
  if (request.retentionUntil.trim().length === 0) {
    throw new Error("Backup retentionUntil is required");
  }
}

function validateProvisioningRequest(
  request: PostgresDatabaseProvisioningRequest,
): void {
  requireIdentifier(request.databaseResourceId, "databaseResourceId");
  requireIdentifier(request.projectId, "projectId");
  requireIdentifier(request.environmentId, "environmentId");
  requireIdentifier(request.provider, "provider");
  requireIdentifier(request.region, "region");
  requireIdentifier(request.idempotencyKey, "idempotencyKey");
}

function requireIdentifier(value: string, field: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(value)) {
    throw new Error(`Invalid PostgreSQL operation ${field}`);
  }
}
