import { loadConfig } from "@mavibase/config";

export function bootstrapWorker() {
  return loadConfig({ role: "worker" });
}
