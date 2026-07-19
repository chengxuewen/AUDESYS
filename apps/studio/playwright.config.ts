// AUDESYS Studio — Playwright E2E config
// Connects to tauri-driver (WebDriver protocol) for Tauri desktop app testing.
//
// PREREQUISITES:
//   cargo install tauri-driver
//
// RUNNING:
//   Terminal 1: cargo tauri dev -- --remote-debugging-port=9222  (from apps/studio/src-tauri/)
//   Terminal 2: tauri-driver --port 4444 --native-host 127.0.0.1
//   Terminal 3: npm run test:e2e
//
// For CI (no native Rust binary needed), use web mode:
//   npm run test:e2e -- --project=web-mock
//   (starts Vite dev server and mocks Tauri IPC calls)

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  expect: { timeout: 10_000 },

  projects: [
    {
      name: 'web-mock',
      use: {
        // Vite dev server — plain web app without Tauri shell
        baseURL: 'http://localhost:5173',
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'tauri-driver',
      use: {
        browserName: 'chromium',
        // Connect to tauri-driver instead of launching its own browser
        connectOptions: {
          wsEndpoint: 'ws://localhost:4444',
        },
      },
    },
  ],

  // Vite dev server for web-mock project (CI-friendly, no Tauri binary)
  webServer: {
    command: 'npx vite --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    cwd: '.',
    timeout: 15_000,
  },
});
