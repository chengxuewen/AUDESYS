// AUDESYS Studio Theia — Playwright Electron Smoke Test config
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/startup-electron.spec.ts',
  timeout: 90_000,
  retries: 1,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    ignoreHTTPSErrors: true,
  },
});
