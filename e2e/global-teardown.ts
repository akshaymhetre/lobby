import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * The suite runs against the dev database the demo reads, and it raises real tickets and ticks
 * real journey steps. Put those two modules back afterwards so the demo never shows test data.
 * Set E2E_KEEP_DATA=1 to keep what the run created, for debugging.
 */
export default function globalTeardown() {
  if (process.env.E2E_KEEP_DATA === "1") return;
  const cwd = path.resolve(__dirname, "..");
  for (const mod of ["helpdesk", "journeys"]) {
    execFileSync("pnpm", ["--filter", "@lobby/db", "seed:one", mod], { cwd, stdio: "inherit" });
  }
  // Reseeding replaces tickets and request types, so their search entries go stale. Queue a rebuild.
  execFileSync("pnpm", ["--filter", "@lobby/worker", "reindex"], { cwd, stdio: "inherit" });
}
