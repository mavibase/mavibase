import type {
  SecurityPolicyOptions,
  SessionCookiePolicy,
} from "./types.js";

export function getSessionCookiePolicy(
  options: SecurityPolicyOptions,
): SessionCookiePolicy {
  const production = options.mode !== "development";
  return {
    name: production ? "__Host-mavibase_session" : "mavibase_session",
    secure: production,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  };
}
