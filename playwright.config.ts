// Browser tests: the real app against the real Supabase project, with a
// throwaway user and organization created in e2e/setup.ts and deleted in
// e2e/teardown.ts. Locally: `npm run test:e2e` (uses .env.local).
import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables directly.
}

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /setup\.ts/, teardown: "teardown" },
    { name: "teardown", testMatch: /teardown\.ts/ },
    {
      name: "desktop",
      testMatch: /\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "e2e/.auth/owner.json" },
    },
  ],
  webServer: {
    // A production build is what users get; `next dev` is fine for quick local runs.
    command: process.env.CI ? `npm run build && npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
