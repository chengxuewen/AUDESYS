// AUDESYS Studio — Smoke tests (Playwright E2E)
//
// These tests verify the Studio app loads and key panels render correctly.
// Run against the Vite dev server with mocked Tauri IPC (CI-friendly).
//
// For full Tauri desktop testing, run:
//   npm run test:e2e -- --project=tauri-driver

import { test, expect } from './fixtures/tauri-mock';

// ─── TC-01: Studio Opens with Default ST Source in Editor ───

test('TC-01: Studio opens with default ST source in editor', async ({ page }) => {
  // Step 1: Navigate to Studio
  await page.goto('/');
  await expect(page.locator('.app-root')).toBeVisible();

  // Step 2: Editor header shows "ST Source Editor"
  await expect(page.locator('.app-panel__header').filter({ hasText: 'ST Source Editor' }))
    .toBeVisible();

  // Step 3: Default ST program visible
  await expect(page.locator('.cm-content')).toContainText('PROGRAM test');

  // Step 4: "New", "Open", "Save" buttons in toolbar
  await expect(page.locator('.fo-btn:has-text("New")')).toBeVisible();
  await expect(page.locator('.fo-btn:has-text("Open")')).toBeVisible();
  await expect(page.locator('.fo-btn:has-text("Save")')).toBeVisible();

  // Step 5: "Compile & Run" button visible and enabled
  const compileBtn = page.locator('button:has-text("Compile & Run")');
  await expect(compileBtn).toBeVisible();
  await expect(compileBtn).toBeEnabled();

  // Step 6: Status bar shows "Ready", "Ln 1, Col 1", "untitled.st"
  await expect(page.locator('.status-bar')).toContainText('Ready');
  await expect(page.locator('.status-bar')).toContainText('Ln 1, Col 1');
  await expect(page.locator('.status-bar')).toContainText('untitled.st');
});

// ─── TC-02: Compile & Run — Success Path ───

test('TC-02: Compile & Run shows signal output table on success', async ({ page }) => {
  // Step 1: Navigate and confirm editor loaded
  await page.goto('/');
  await expect(page.locator('.cm-content')).toContainText('PROGRAM test');

  // Step 2: Click "Compile & Run"
  const compileBtn = page.locator('button:has-text("Compile & Run")');
  await compileBtn.click();

  // Step 3: Wait for signal output table
  await expect(page.locator('.app-signal-table')).toBeVisible({ timeout: 5000 });

  // Step 4: Verify table headers
  const headers = page.locator('.app-signal-table__th');
  await expect(headers).toHaveCount(3);

  // Step 5: Verify signal rows (x=42, y=50)
  const rows = page.locator('.app-signal-table__tr');
  await expect(rows).toHaveCount(2);

  // Step 6: Status bar shows "Success"
  await expect(page.locator('.status-bar')).toContainText('Success');

  // Step 7: Button reverts to "Compile & Run" (enabled)
  await expect(compileBtn).toBeEnabled();
  await expect(compileBtn).toContainText('Compile & Run');
});

// ─── TC-09: Debug Panel — Connect Form Visible ───

test('TC-09: Debug panel shows connect form with socket path and secret inputs', async ({ page }) => {
  // Step 1: Navigate to Studio
  await page.goto('/');
  await expect(page.locator('.app-root')).toBeVisible();

  // Step 2: Debug panel visible in output area
  await expect(page.locator('.debug-panel')).toBeVisible();

  // Step 3: "Debug" header shown
  await expect(
    page.locator('.debug-panel .app-panel__header').filter({ hasText: 'Debug' })
  ).toBeVisible();

  // Step 4: Socket path input, secret input, "Connect" button visible
  await expect(
    page.locator('.debug-panel__connect input[placeholder="Socket path"]')
  ).toBeVisible();
  await expect(
    page.locator('.debug-panel__connect input[placeholder="Secret"]')
  ).toBeVisible();
  await expect(
    page.locator('.debug-panel__connect button:has-text("Connect")')
  ).toBeVisible();

  // Step 5: Fill socket path
  await page.fill(
    '.debug-panel__connect input[placeholder="Socket path"]',
    '/tmp/audesys-controller.sock'
  );
  await page.fill(
    '.debug-panel__connect input[placeholder="Secret"]',
    'test-secret'
  );

  // Step 6: Click "Connect" — mock returns "connected"
  await page.click('.debug-panel__connect button:has-text("Connect")');
  await expect(page.locator('.debug-panel__status')).toContainText('connected');
});
