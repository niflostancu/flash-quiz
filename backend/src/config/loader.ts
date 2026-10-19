// Backend config loader
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

export async function loadConfig(): Promise<BackendConfig> {
  const raw = await readFile("config.yaml", "utf8").catch(() => "{}");
  const cfg = parse(raw) as Partial<BackendConfig>;
  return {
    port: cfg.port ?? 3000,
    hostname: cfg.hostname ?? "0.0.0.0",
  };
}
