import type { SecurityHeadersOptions } from "./types.js";

const hstsValue = "max-age=31536000; includeSubDomains";
const consoleContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
].join("; ");

export function createSecurityHeaders(
  options: SecurityHeadersOptions,
): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (options.mode !== "development") {
    headers["Strict-Transport-Security"] = hstsValue;
  }
  if (options.console) {
    headers["Content-Security-Policy"] = consoleContentSecurityPolicy;
  }
  return headers;
}

export function getConsoleContentSecurityPolicy(): string {
  return consoleContentSecurityPolicy;
}
