import type { DeploymentMode } from "@mavibase/config";

export type SecurityDeploymentMode = DeploymentMode;

export interface SecurityPolicyOptions {
  readonly mode: SecurityDeploymentMode;
}

export interface SessionCookiePolicy {
  readonly name: string;
  readonly secure: boolean;
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly path: "/";
}

export interface SecurityHeadersOptions extends SecurityPolicyOptions {
  readonly console: boolean;
}
