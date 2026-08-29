import type {
  ConfigEnvironment,
  ConfigLoadOptions,
  DeploymentMode,
  LogLevel,
  MavibaseConfig,
  ProcessRole,
  PublicConfig,
} from "./types.js";

const deploymentModes: readonly DeploymentMode[] = [
  "cloud",
  "self-hosted",
  "development",
];

const logLevels: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export class ConfigurationError extends Error {
  readonly key: string;

  constructor(key: string, message: string) {
    super(`${key}: ${message}`);
    this.name = "ConfigurationError";
    this.key = key;
  }
}

export function loadConfig(options: ConfigLoadOptions): MavibaseConfig {
  const environment = options.environment ?? readProcessEnvironment();
  const mode = readEnum(
    environment.MAVIBASE_DEPLOYMENT_MODE ?? "development",
    deploymentModes,
    "MAVIBASE_DEPLOYMENT_MODE",
  );
  const role = options.role;
  const publicUrl = readUrl(
    environment.MAVIBASE_PUBLIC_URL ?? "http://localhost:3000",
    "MAVIBASE_PUBLIC_URL",
  );
  const httpPort = readPort(environment.MAVIBASE_HTTP_PORT ?? "3000");
  const httpHost = environment.MAVIBASE_HTTP_HOST ?? "127.0.0.1";
  const corsOrigins = readOrigins(environment.MAVIBASE_CORS_ORIGINS);
  const logLevel = readEnum(
    environment.MAVIBASE_LOG_LEVEL ?? "info",
    logLevels,
    "MAVIBASE_LOG_LEVEL",
  );
  const postgresUrl = readOptionalUrl(
    environment.MAVIBASE_DATABASE_URL,
    "MAVIBASE_DATABASE_URL",
    ["postgres:", "postgresql:"],
  );
  const redisUrl = readOptionalUrl(
    environment.MAVIBASE_REDIS_URL,
    "MAVIBASE_REDIS_URL",
    ["redis:", "rediss:"],
  );
  const sessionSecret = readSecret(
    environment.MAVIBASE_SESSION_SECRET,
    "MAVIBASE_SESSION_SECRET",
    role,
  );
  const encryptionKey = readSecret(
    environment.MAVIBASE_ENCRYPTION_KEY,
    "MAVIBASE_ENCRYPTION_KEY",
    role,
  );

  if (role !== "console" && postgresUrl === undefined) {
    throw new ConfigurationError(
      "MAVIBASE_DATABASE_URL",
      "is required for server and worker processes",
    );
  }

  if (mode !== "development" && publicUrl.startsWith("http://")) {
    throw new ConfigurationError(
      "MAVIBASE_PUBLIC_URL",
      "must use HTTPS outside development",
    );
  }

  return {
    deployment: { mode },
    process: { role },
    publicUrl,
    http: { host: httpHost, port: httpPort },
    corsOrigins,
    logLevel,
    postgres: { url: postgresUrl },
    redis: { url: redisUrl },
    secrets: { sessionSecret, encryptionKey },
  };
}

export function toPublicConfig(config: MavibaseConfig): PublicConfig {
  return {
    deployment: config.deployment,
    process: config.process,
    publicUrl: config.publicUrl,
    http: config.http,
    corsOrigins: config.corsOrigins,
    logLevel: config.logLevel,
  };
}

function readProcessEnvironment(): ConfigEnvironment {
  const runtime = globalThis as typeof globalThis & {
    process?: { readonly env?: ConfigEnvironment };
  };
  return runtime.process?.env ?? {};
}

function readEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  key: string,
): T {
  if (!allowed.includes(value as T)) {
    throw new ConfigurationError(key, `must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function readPort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError(
      "MAVIBASE_HTTP_PORT",
      "must be an integer from 1 through 65535",
    );
  }
  return port;
}

function readOrigins(value: string | undefined): readonly string[] {
  if (value === undefined || value.trim() === "") {
    return [];
  }
  return value.split(",").map((origin) => readUrl(origin.trim(), "MAVIBASE_CORS_ORIGINS"));
}

function readUrl(value: string, key: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new ConfigurationError(key, "must be a valid HTTP or HTTPS URL");
  }
}

function readOptionalUrl(
  value: string | undefined,
  key: string,
  protocols: readonly string[],
): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) {
      throw new Error("unsupported protocol");
    }
    return value;
  } catch {
    throw new ConfigurationError(key, `must use ${protocols.join(" or ")}`);
  }
}

function readSecret(
  value: string | undefined,
  key: string,
  role: ProcessRole,
): string | undefined {
  if (role === "console") {
    if (value !== undefined) {
      throw new ConfigurationError(key, "must not be provided to console processes");
    }
    return undefined;
  }
  if (value === undefined || value.length < 32) {
    throw new ConfigurationError(key, "must be at least 32 characters");
  }
  return value;
}
