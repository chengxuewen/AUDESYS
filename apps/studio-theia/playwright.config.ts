// AUDESYS Studio Theia — Playwright Smoke Test config
// Verifies Theia application starts and renders core UI correctly.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/smoke',
  timeout: 60_000,
  retries: 2,
  expect: { timeout: 15_000 },
  reporter: 'dot',

  use: {
    baseURL: 'http://localhost:4000',
    ...devices['Desktop Chrome'],
    // Theia Electron app: ignore HTTPS errors from self-signed certs
    ignoreHTTPSErrors: true,
  },

  // Start Theia app (serves frontend on port 3000)
  webServer: {
    command: 'npx theia start --app-target browser --port 4000',
    cwd: './',
    port: 4000,
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
