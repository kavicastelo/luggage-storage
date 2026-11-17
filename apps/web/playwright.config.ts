import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }]
  ],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "pnpm --filter @luggage-storage/api exec tsx src/server.ts",
      url: "http://127.0.0.1:3000/api/v1/ready",
      cwd: "../..",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PAYMENT_PROVIDER: "sandbox",
        RATE_LIMIT_LOGIN_IP_MAX: "1000"
      }
    },
    {
      command: "pnpm --filter @luggage-storage/web exec vite --port 5173 --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      cwd: "../..",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_API_URL: "http://127.0.0.1:3000/api/v1",
        VITE_ENABLE_DEMO_PREVIEW: "false",
        VITE_FEATURE_REVIEWS: "false",
        VITE_FEATURE_PROMOTIONS: "false"
      }
    }
  ]
});

