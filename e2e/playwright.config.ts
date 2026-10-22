import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running Lobby with the demo company loaded:
 *   cd deploy && docker compose --profile demo-idp --profile demo-apps up -d
 *   pnpm db:reset && pnpm --filter @lobby/web dev & pnpm --filter @lobby/worker dev &
 *   pnpm e2e
 */
export default defineConfig({
  testDir: "./tests",
  globalTeardown: "./global-teardown.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "../playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.LOBBY_URL ?? "http://localhost:4100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
});
