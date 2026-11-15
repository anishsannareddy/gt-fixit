import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests for the three role flows.
 *   npm run test:e2e
 * Runs against a production build on port 3123, using the demo accounts from `npm run seed`
 * and your Supabase project from .env.local. Tests create their own requests and delete them afterwards.
 */
const PORT = 3123;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // the flows share data (a request moves from student → technician → admin)
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npm run build && npx next start -p ${PORT}`, port: PORT, timeout: 240_000, reuseExistingServer: true },
});
