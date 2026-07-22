// AUDESYS Studio Theia — Playwright E2E Browser Test config
// Runs against a pre-started Theia instance. No webServer.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: [
    'smoke/startup-browser.spec.ts',
    'expanded/theia-e2e.spec.ts',
  ],
  timeout: 60_000,
  retries: 1,
  expect: { timeout: 15_000 },
  reporter: 'list',

  use: {
    baseURL: process.env.THEIA_URL || 'http://127.0.0.1:58805',
    ...devices['Desktop Chrome'],
    ignoreHTTPSErrors: true,
  },
});
