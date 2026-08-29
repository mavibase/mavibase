import type { SecurityDeploymentMode } from "@mavibase/security";

export type HttpProtocol = "http" | "https";

export interface HttpTransportContext {
  readonly connectionProtocol: HttpProtocol;
  readonly trustedProxyProtocol?: HttpProtocol;
}

export interface HttpsOnlyOptions {
  readonly mode: SecurityDeploymentMode;
  readonly trustProxy: boolean;
}

export class HttpsRequiredError extends Error {
  readonly statusCode = 426;
  readonly code = "HTTPS_REQUIRED";

  constructor() {
    super("HTTPS is required outside development");
    this.name = "HttpsRequiredError";
  }
}

export function isSecureTransport(
  context: HttpTransportContext,
  options: HttpsOnlyOptions,
): boolean {
  if (options.mode === "development") {
    return true;
  }
  if (context.connectionProtocol === "https") {
    return true;
  }
  return options.trustProxy && context.trustedProxyProtocol === "https";
}

export function enforceHttpsOnly(
  context: HttpTransportContext,
  options: HttpsOnlyOptions,
): void {
  if (!isSecureTransport(context, options)) {
    throw new HttpsRequiredError();
  }
}
