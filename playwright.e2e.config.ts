import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3101",
    headless: true,
    channel: "chrome",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "NEXT_DIST_DIR=.next-e2e bun run --cwd apps/web dev --port 3101",
    url: "http://127.0.0.1:3101",
    timeout: 180_000,
    reuseExistingServer: false
  }
});
