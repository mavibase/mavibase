import type {
  PostgresExtensionDefinition,
  PostgresExtensionRequest,
  PostgresSqlStatement,
} from "@mavibase/contracts";
import { assertPostgresIdentifier, quotePostgresIdentifier } from "./identifier.js";

const extensionCatalog: readonly PostgresExtensionDefinition[] = [
  {
    name: "pgcrypto",
    status: "supported",
    supportedVersions: [],
    requiresRestart: false,
    securityClass: "normal",
  },
  {
    name: "pg_trgm",
    status: "provider-dependent",
    supportedVersions: [],
    requiresRestart: false,
    securityClass: "normal",
  },
  {
    name: "vector",
    status: "provider-dependent",
    supportedVersions: [],
    requiresRestart: false,
    securityClass: "privileged",
  },
  {
    name: "postgis",
    status: "provider-dependent",
    supportedVersions: [],
    requiresRestart: true,
    securityClass: "privileged",
  },
];

export function listPostgresExtensions(): readonly PostgresExtensionDefinition[] {
  return extensionCatalog;
}

export function validatePostgresExtensionRequest(
  request: PostgresExtensionRequest,
): PostgresExtensionDefinition {
  assertPostgresIdentifier(request.name);
  const definition = extensionCatalog.find((extension) => extension.name === request.name);
  if (definition === undefined || definition.status === "unsupported") {
    throw new Error(`PostgreSQL extension is not allowed: ${request.name}`);
  }
  if (request.version !== undefined && definition.supportedVersions.length > 0 && !definition.supportedVersions.includes(request.version)) {
    throw new Error(`PostgreSQL extension version is not supported: ${request.name}@${request.version}`);
  }
  if (request.version !== undefined && !/^[a-zA-Z0-9._-]+$/.test(request.version)) {
    throw new Error(`Invalid PostgreSQL extension version: ${request.version}`);
  }
  return definition;
}

export function createEnableExtensionStatement(
  request: PostgresExtensionRequest,
): PostgresSqlStatement {
  validatePostgresExtensionRequest(request);
  const version = request.version === undefined ? "" : ` VERSION '${request.version.replaceAll("'", "''")}'`;
  return {
    text: `CREATE EXTENSION IF NOT EXISTS ${quotePostgresIdentifier(request.name)}${version}`,
    values: [],
  };
}
