import { loadConfig, toPublicConfig } from "@mavibase/config";

export function bootstrapConsole() {
  return toPublicConfig(loadConfig({ role: "console" }));
}
