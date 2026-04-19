import { defineConfig, devices } from "@playwright/test";

const isRemote = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Auth setup — logs in and saves storage state
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Authenticated tests — depend on setup
    {
      name: "authenticated",
      testMatch: /(authenticated|features)\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
    // Public tests — no auth needed
    {
      name: "public",
      testIgnore: /(authenticated|features)\.spec\.ts$|auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer:
    process.env.CI || isRemote
      ? undefined
      : {
          command: "bun run dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 30_000,
        },
});
