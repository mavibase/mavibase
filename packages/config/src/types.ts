export type DeploymentMode = "cloud" | "self-hosted" | "development";

export type ProcessRole = "server" | "worker" | "console";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ConfigEnvironment {
  readonly [key: string]: string | undefined;
}

export interface ConfigLoadOptions {
  readonly environment?: ConfigEnvironment;
  readonly role: ProcessRole;
}

export interface HttpConfig {
  readonly host: string;
  readonly port: number;
}

export interface MavibaseConfig {
  readonly deployment: {
    readonly mode: DeploymentMode;
  };
  readonly process: {
    readonly role: ProcessRole;
  };
  readonly publicUrl: string;
  readonly http: HttpConfig;
  readonly corsOrigins: readonly string[];
  readonly logLevel: LogLevel;
  readonly postgres: {
    readonly url: string | undefined;
  };
  readonly redis: {
    readonly url: string | undefined;
  };
  readonly secrets: {
    readonly sessionSecret: string | undefined;
    readonly encryptionKey: string | undefined;
  };
}

export interface PublicConfig {
  readonly deployment: {
    readonly mode: DeploymentMode;
  };
  readonly process: {
    readonly role: ProcessRole;
  };
  readonly publicUrl: string;
  readonly http: HttpConfig;
  readonly corsOrigins: readonly string[];
  readonly logLevel: LogLevel;
}
