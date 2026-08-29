export type PostgresOperationStatus =
  | "accepted"
  | "failed"
  | "running"
  | "succeeded";

export type PostgresBackupType =
  | "logical"
  | "physical"
  | "point-in-time"
  | "snapshot";

export interface PostgresOperationReference {
  readonly operationId: string;
  readonly status: PostgresOperationStatus;
}

export interface PostgresBackupRequest {
  readonly backupId: string;
  readonly databaseResourceId: string;
  readonly type: PostgresBackupType;
  readonly requestedBy: string;
  readonly retentionUntil: string;
}

export interface PostgresBackupMetadata {
  readonly backupId: string;
  readonly databaseResourceId: string;
  readonly type: PostgresBackupType;
  readonly provider: string;
  readonly status: PostgresOperationStatus;
  readonly sizeBytes: number | null;
  readonly createdAt: string;
  readonly retentionUntil: string;
  readonly encrypted: boolean;
  readonly encryptionReference: string | null;
  readonly restoreCompatibility: string;
}

export interface PostgresBackupProvider {
  createBackup(request: PostgresBackupRequest): Promise<PostgresOperationReference>;
}

export interface PostgresDatabaseProvisioningRequest {
  readonly databaseResourceId: string;
  readonly projectId: string;
  readonly environmentId: string;
  readonly provider: string;
  readonly region: string;
  readonly idempotencyKey: string;
}

export interface PostgresProvisionedDatabase {
  readonly databaseResourceId: string;
  readonly provider: string;
  readonly providerResourceId: string;
  readonly status: "provisioning" | "ready" | "failed";
  readonly connectionSecretReference: string | null;
}

export interface PostgresProvisioningProvider {
  provisionDatabase(
    request: PostgresDatabaseProvisioningRequest,
  ): Promise<PostgresOperationReference>;
}
