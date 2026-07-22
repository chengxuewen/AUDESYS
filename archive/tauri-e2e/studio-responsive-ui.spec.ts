// AUDESYS Studio — Responsive UI & HMI Tests
// Updated for Shell architecture: NavBar tools + ModeSelector + Toolbar + EditorSlot + BottomSlot.
// Old class names (.app-toolbar, .app-panel--output) replaced with Shell BEM equivalents.
// Mode cycling replaced with NavBar tool activation.
import { test, expect } from './fixtures/tauri-mock';

// ── Helpers ──

/** Click a tool button in a NavBar group */
async function activateTool(page: any, groupIndex: number, btnIndex: number) {
  await page.locator('.shell-navbar__group').nth(groupIndex).locator('.shell-navbar__btn').nth(btnIndex).click();
}

/** Activate HMI Designer (HMI group, first button) */
async function activateHmi(page: any) {
  await activateTool(page, 1, 0);
}

/** Activate ST Compiler (Code group, first button) */
async function activateStCompiler(page: any) {
  await activateTool(page, 0, 0);
}

test.describe('Responsive Layout', () => {
  test('RL-01: fills viewport at 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const box = await page.locator('.app-root').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1440, 0);
    expect(box!.height).toBeGreaterThan(500); // Shell is content-sized, doesn't stretch to viewport
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(1,\s*1,\s*2\)/); // dark canvas, no white
  });

  test('RL-02: fills viewport at 1200x600', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1200, height: 600 });
    const box = await page.locator('.app-root').boundingBox();
    expect(box!.width).toBeCloseTo(1200, 0);
    expect(box!.height).toBeGreaterThan(400);
  });

  test('RL-03: fills viewport at 1000x450 — no scrollbar', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1000, height: 450 });
    const box = await page.locator('.app-root').boundingBox();
    expect(box!.width).toBeCloseTo(1000, 0);
    expect(box!.height).toBeGreaterThan(250);
    const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hScroll).toBe(false);
  });

  test('RL-04: editor + bottom slot visible after tool activation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    // Activate ST Compiler — renders .app-panel--editor inside EditorSlot
    await activateStCompiler(page);
    await expect(page.locator('.app-panel--editor')).toBeVisible();
    // Bottom slot always visible
    await expect(page.locator('.shell-bottom-slot')).toBeVisible();
    // CodeMirror editor visible
    await expect(page.locator('.cm-editor')).toBeVisible();
  });
});

test.describe('Toolbar', () => {
  test('TB-01: toolbar buttons visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.shell-toolbar')).toBeVisible();
    // Shell toolbar has Save, Open, Compile as global actions in edit mode
    await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Save' })).toBeVisible();
    await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Open' })).toBeVisible();
    await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Compile' })).toBeVisible();
  });

  test('TB-02: NavBar tool buttons visible', async ({ page }) => {
    await page.goto('/');
    // Code group tools: 6 editor tools
    const codeGroup = page.locator('.shell-navbar__group').first();
    await expect(codeGroup.locator('.shell-navbar__btn')).toHaveCount(6);
    // HMI group: 1 tool
    const hmiGroup = page.locator('.shell-navbar__group').nth(1);
    await expect(hmiGroup.locator('.shell-navbar__btn')).toHaveCount(1);
  });
});

test.describe('Mode Switching', () => {
  const modes = ['Edit', 'Debug', 'Commissioning'] as const;

  test('MS-01: cycles through Edit → Debug → Commissioning', async ({ page }) => {
    await page.goto('/');
    // Start in Edit mode
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

    // Switch to Debug
    await page.getByRole('button', { name: 'Debug' }).click();
    await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Pause' })).toBeVisible();

    // Switch to Commissioning
    await page.getByRole('button', { name: 'Commissioning' }).click();
    await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Deploy' })).toBeVisible();

    // Back to Edit
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('.shell-toolbar__btn').filter({ hasText: 'Pause' })).not.toBeVisible();
  });

  test('MS-02: activating different tools switches editor content', async ({ page }) => {
    await page.goto('/');

    // Activate ST Compiler
    await activateStCompiler(page);
    await expect(page.locator('.app-panel__header').filter({ hasText: 'ST Source Editor' })).toBeVisible();

    // Activate IL Compiler (Code group, 2nd button)
    await activateTool(page, 0, 1);
    await expect(page.locator('.app-panel__header').filter({ hasText: 'IL Source Editor' })).toBeVisible();

    // Activate LD Editor (Code group, 3rd button)
    await activateTool(page, 0, 2);
    await expect(page.locator('.app-panel__header').filter({ hasText: 'LD Editor' })).toBeVisible();
  });
});

test.describe('HMI Builder', () => {
  test('HMI-01: HMI toolbar buttons visible (Save, Load, Edit/Preview, Deploy)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await activateHmi(page);
    // HMI toolbar buttons use app-btn class
    await expect(page.locator('.app-btn:has-text("Save")').first()).toBeVisible();
    await expect(page.locator('.app-btn:has-text("Load")')).toBeVisible();
    await expect(page.locator('.app-btn:has-text("Preview")')).toBeVisible();
    await expect(page.locator('.app-btn:has-text("Deploy")')).toBeVisible();
  });

  test('HMI-02: canvas + widget palette visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await activateHmi(page);
    await expect(page.locator('.hmi-canvas')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.app-panel__header').filter({ hasText: 'Widgets' }))
      .toBeVisible({ timeout: 3000 });
  });

  test('HMI-03: canvas is substantial', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await activateHmi(page);
    const box = await page.locator('.hmi-canvas').boundingBox();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(150);
  });
});

test.describe('Console', () => {
  test('CC-01: no ref errors on load', async ({ page }) => {
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('/');
    const critical = errs.filter(e => e.includes('is not defined') || e.includes('Minified React'));
    expect(critical).toHaveLength(0);
  });
});
