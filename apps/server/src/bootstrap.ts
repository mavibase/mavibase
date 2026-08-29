import { loadConfig } from "@mavibase/config";

export function bootstrapServer() {
  return loadConfig({ role: "server" });
}
