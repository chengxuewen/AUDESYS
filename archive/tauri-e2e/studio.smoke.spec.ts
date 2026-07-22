// AUDESYS Studio — Smoke tests (Playwright E2E)
//
// Updated for Shell architecture: NavBar tools + ModeSelector + Toolbar + EditorSlot + BottomSlot.
// Old class names (.app-toolbar, .fo-btn, .status-bar, .debug-panel) replaced with Shell BEM classes.
// Run against the Vite dev server with mocked Tauri IPC (CI-friendly).
//

import { test, expect } from './fixtures/tauri-mock';

// ── Helpers ──

/** Click the first tool button in a NavBar group groupIndex (0=Code, 1=HMI, 2=Monitor) */
async function activateTool(page: any, groupIndex: number, btnIndex: number) {
  const btn = page.locator('.shell-navbar__group').nth(groupIndex).locator('.shell-navbar__btn').nth(btnIndex);
  await btn.click();
}

/** Activate ST Compiler (Code group, first button) */
async function activateStCompiler(page: any) {
  await activateTool(page, 0, 0);
}

// ─── TC-01: Studio Opens with Shell Layout & ST Compiler ───

test('TC-01: Studio opens with Shell layout and ST Compiler activates correctly', async ({ page }) => {
  // Step 1: Navigate to Studio
  await page.goto('/');
  await expect(page.locator('.app-root')).toBeVisible();

  // Step 2: Shell toolbar visible with Save, Open, Compile
  await expect(page.locator('.shell-toolbar')).toBeVisible();
  await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Save' })).toBeVisible();
  await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Open' })).toBeVisible();
  await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Compile' })).toBeVisible();

  // Step 3: NavBar visible with Code/HMI/Monitor groups
  await expect(page.locator('.shell-navbar')).toBeVisible();

  // Step 4: EditorSlot shows placeholder (no tool active)
  await expect(page.locator('.shell-editor-slot')).toContainText('Select a tool to begin');

  // Step 5: Activate ST Compiler from NavBar
  await activateStCompiler(page);

  // Step 6: Editor header shows "ST Source Editor"
  await expect(page.locator('.app-panel__header').filter({ hasText: 'ST Source Editor' }))
    .toBeVisible();

  // Step 7: Default ST program visible in CodeMirror
  await expect(page.locator('.cm-content')).toContainText('PROGRAM test');

  // Step 8: ST tool inline buttons: New, Open, Save, Compile & Run
  await expect(page.locator('.app-btn:has-text("New")')).toBeVisible();
  await expect(page.locator('.app-btn:has-text("Open")')).toBeVisible();
  await expect(page.locator('.app-btn:has-text("Save")')).toBeVisible();
  await expect(page.locator('.app-btn:has-text("Compile & Run")')).toBeVisible();

  // Step 9: ST tool footer shows filename + cursor position
  await expect(page.locator('.app-panel--editor')).toContainText('untitled.st');
  await expect(page.locator('.app-panel--editor')).toContainText('Ln 1, Col 1');
});

// ─── TC-02: Compile & Run — Success Path ───

test('TC-02: Compile & Run shows signal output table on success', async ({ page }) => {
  // Step 1: Navigate and activate ST Compiler
  await page.goto('/');
  await activateStCompiler(page);
  await expect(page.locator('.cm-content')).toContainText('PROGRAM test');

  // Step 2: Click "Compile & Run" (ST tool button, not shell toolbar)
  const compileBtn = page.locator('.app-btn:has-text("Compile & Run")');
  await compileBtn.click();

  // Step 3: Wait for signal output table
  await expect(page.locator('.app-signal-table')).toBeVisible({ timeout: 5000 });

  // Step 4: Verify table headers (Signal, Value, Type)
  const headers = page.locator('.app-signal-table__th');
  await expect(headers).toHaveCount(3);

  // Step 5: Verify signal rows (x=42, y=50)
  const rows = page.locator('.app-signal-table__tr');
  await expect(rows).toHaveCount(2);

  // Step 6: Compile status shows success indicator (✓ OK)
  await expect(page.locator('.app-panel--editor')).toContainText('OK');

  // Step 7: Button reverts to "Compile & Run" (enabled)
  await expect(compileBtn).toBeEnabled();
  await expect(compileBtn).toContainText('Compile & Run');
});

// ─── TC-09: Debug Mode — Toolbar & Bottom Panels ───

test('TC-09: Debug mode shows toolbar actions and bottom panel tabs', async ({ page }) => {
  // Step 1: Navigate to Studio
  await page.goto('/');
  await expect(page.locator('.app-root')).toBeVisible();

  // Step 2: Switch to Debug mode
  await page.getByRole('button', { name: 'Debug' }).click();

  // Step 3: Toolbar shows Pause, Step, Resume (debug mode actions)
  await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Pause' })).toBeVisible();
  await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Step' })).toBeVisible();
  await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Resume' })).toBeVisible();

  // Step 4: Bottom slot has tabs (3 system + 3 debug = 6 tabs)
  const tabs = page.locator('.shell-bottom-slot__tab');
  await expect(tabs).toHaveCount(6);

  // Step 5: Switch back to Edit mode — debug toolbar actions gone
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Pause' })).not.toBeVisible();
});

// ─── TC-10: BottomSlot Resize Handle Drag ───

test('TC-10: BottomSlot resize handle drag changes height', async ({ page }) => {
  // Step 1: Navigate to Studio
  await page.goto('/');
  await expect(page.locator('.app-root')).toBeVisible();

  // Step 2: Activate ST Compiler so bottom slot is populated
  await activateStCompiler(page);

  // Step 3: Verify bottom slot is visible
  const slot = page.locator('.shell-bottom-slot');
  await expect(slot).toBeVisible();

  // Step 4: Get initial height from bounding box
  const initialBox = await slot.boundingBox();
  if (!initialBox) throw new Error('slot has no bounding box');
  const initialHeight = initialBox.height;

  // Step 5: Locate resize handle and get center position
  const handle = page.locator('.shell-bottom-slot__resize-handle');
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('handle has no bounding box');
  const cx = handleBox.x + handleBox.width / 2;
  const cy = handleBox.y + handleBox.height / 2;

  // Step 6: Drag up 100px (lower mouse Y = taller panel)
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 100, { steps: 10 });
  await page.mouse.up();

  // Step 7: Verify height increased by at least 50px
  const afterUpBox = await slot.boundingBox();
  if (!afterUpBox) throw new Error('slot has no bounding box after drag up');
  expect(afterUpBox.height).toBeGreaterThan(initialHeight + 50);

  // Step 8: Drag back down ~100px to reset
  const newHandleBox = await handle.boundingBox();
  if (!newHandleBox) throw new Error('handle has no bounding box after drag up');
  const resetCx = newHandleBox.x + newHandleBox.width / 2;
  const resetCy = newHandleBox.y + newHandleBox.height / 2;
  await page.mouse.move(resetCx, resetCy);
  await page.mouse.down();
  await page.mouse.move(resetCx, resetCy + 100, { steps: 10 });
  await page.mouse.up();

  // Step 9: Verify height returns near original (±20px tolerance)
  const afterResetBox = await slot.boundingBox();
  if (!afterResetBox) throw new Error('slot has no bounding box after reset');
  expect(afterResetBox.height).toBeLessThan(initialHeight + 20);
  expect(afterResetBox.height).toBeGreaterThan(initialHeight - 20);
});
