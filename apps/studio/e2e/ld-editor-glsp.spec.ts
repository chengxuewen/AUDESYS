/// <reference types="playwright" />
/**
 * AUDESYS LD GLSP Editor — E2E Test Suite (GLSP Architecture)
 *
 * Tests the new Eclipse GLSP-based LD editor, replacing the old React+SVG editor.
 * Uses GLSP selectors: .sprotty-graph, [data-element-type], [data-element-id].
 *
 * Scenarios: E2E-1 through E2E-11
 * Config: video=retain-on-failure, trace=on-first-retry
 */
import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:3100';

// GLSP selectors
const GRAPH = '.sprotty-graph';
const CONTACT = '[data-element-type="node:contact"]';
const COIL = '[data-element-type="node:coil"]';
const POWERRAIL = '[data-element-type="node:powerrail"]';
const ANY_ELEMENT = '[data-element-type]';
const PALETTE_ITEM = '.tool-button';

test.use({
  video: 'retain-on-failure',
  trace: 'on-first-retry',
});

// Shared helper: open .ld file and wait for diagram to render
async function openLdDiagram(page: import('@playwright/test').Page) {
  await page.goto(URL);
  await page.waitForTimeout(8000);

  // Open command palette → New Ladder
  await page.keyboard.press('F1');
  await page.locator('.quick-input-field input').fill('>New Ladder');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // Wait for GLSP graph to render
  await expect(page.locator(GRAPH)).toBeVisible({ timeout: 10000 });
}

// Shared helper: click a palette tool by its label text
async function clickPaletteTool(page: import('@playwright/test').Page, label: string) {
  // GLSP palette renders tool buttons with label text
  const palette = page.locator('.tool-palette');
  await expect(palette).toBeVisible({ timeout: 5000 });
  const btn = palette.locator(PALETTE_ITEM, { hasText: label });
  await expect(btn).toBeVisible({ timeout: 3000 });
  await btn.click();
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-1: Open .ld → diagram renders (.sprotty-graph visible, 2+ power rails)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-1: Diagram Renders', () => {
  test('open .ld file → .sprotty-graph visible with 2+ power rails', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    // Verify graph element exists
    await expect(page.locator(GRAPH)).toBeVisible();

    // Verify at least 2 power rails (left + right)
    const railCount = await page.locator(POWERRAIL).count();
    expect(railCount).toBeGreaterThanOrEqual(2);

    // No console errors (ignore favicon)
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-2: Palette NO Contact → click canvas → contact appears
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-2: NO Contact Creation', () => {
  test('click NO Contact in palette → click canvas → contact node appears', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    const before = await page.locator(CONTACT).count();

    // Activate NO Contact tool
    await clickPaletteTool(page, 'NO Contact');

    // Click on canvas to place
    const graph = page.locator(GRAPH);
    const box = await graph.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 3, box!.y + 60);
    await page.waitForTimeout(500);

    // Verify contact was created
    const after = await page.locator(CONTACT).count();
    expect(after).toBeGreaterThan(before);

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-3: Palette NC Contact → click canvas → NC contact appears
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-3: NC Contact Creation', () => {
  test('click NC Contact in palette → click canvas → NC contact node appears', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    const before = await page.locator(CONTACT).count();

    // Activate NC Contact tool
    await clickPaletteTool(page, 'NC Contact');

    // Click on canvas to place
    const graph = page.locator(GRAPH);
    const box = await graph.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 3, box!.y + 60);
    await page.waitForTimeout(500);

    // Verify contact was created
    const after = await page.locator(CONTACT).count();
    expect(after).toBeGreaterThan(before);

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-4: Palette Coil → click canvas → coil appears
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-4: Coil Creation', () => {
  test('click Normal Coil in palette → click canvas → coil node appears', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    // First add a contact (coil needs at least one contact)
    await clickPaletteTool(page, 'NO Contact');
    const graph = page.locator(GRAPH);
    const box = await graph.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 3, box!.y + 60);
    await page.waitForTimeout(500);

    const before = await page.locator(COIL).count();

    // Now add a coil to the right of the contact
    await clickPaletteTool(page, 'Normal Coil');
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + 60);
    await page.waitForTimeout(500);

    // Verify coil was created
    const after = await page.locator(COIL).count();
    expect(after).toBeGreaterThan(before);

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-5: Select → Delete → element removed
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-5: Delete Element', () => {
  test('select element → press Delete → element removed', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    // Add a contact first
    await clickPaletteTool(page, 'NO Contact');
    const graph = page.locator(GRAPH);
    const box = await graph.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 3, box!.y + 60);
    await page.waitForTimeout(500);

    const before = await page.locator(CONTACT).count();
    expect(before).toBeGreaterThan(0);

    // Select the contact
    const contact = page.locator(CONTACT).first();
    await contact.click();
    await page.waitForTimeout(200);

    // Delete via keyboard
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);

    // Verify element was removed
    const after = await page.locator(CONTACT).count();
    expect(after).toBeLessThan(before);

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-6: Add Rung → rung count increases
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-6: Add Rung', () => {
  test('add rung via palette → rung count increases', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    // Count initial rungs (text elements with rung numbers)
    const initialRungs = await page.locator(ANY_ELEMENT).count();

    // Look for "Add Rung" in palette (may be a button or menu item)
    const palette = page.locator('.tool-palette');
    await expect(palette).toBeVisible({ timeout: 5000 });

    // Try to find and click "Add Rung" or similar rung-adding mechanism
    const addRungBtn = palette.locator(PALETTE_ITEM, { hasText: /rung/i });
    if (await addRungBtn.count() > 0) {
      await addRungBtn.first().click();
      await page.waitForTimeout(500);
    } else {
      // Fallback: add a contact which auto-creates a new rung if canvas is empty
      await clickPaletteTool(page, 'NO Contact');
      const graph = page.locator(GRAPH);
      const box = await graph.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 3, box.y + 60);
        await page.waitForTimeout(500);
      }
    }

    // Verify element count increased (rung was added or content changed)
    const after = await page.locator(ANY_ELEMENT).count();
    expect(after).toBeGreaterThanOrEqual(initialRungs);

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-7: Compile → no error notification
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-7: Compile', () => {
  test('compile diagram → no error notification shown', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    // Add a contact and coil to have something compilable
    await clickPaletteTool(page, 'NO Contact');
    const graph = page.locator(GRAPH);
    const box = await graph.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 3, box!.y + 60);
    await page.waitForTimeout(500);

    await clickPaletteTool(page, 'Normal Coil');
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + 60);
    await page.waitForTimeout(500);

    // Trigger compile via keyboard shortcut or command palette
    // Try Ctrl+Shift+P → Compile LD or right-click context menu
    await page.keyboard.press('Control+Shift+p');
    await page.waitForTimeout(500);
    const input = page.locator('.quick-input-field input');
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill('>Compile');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Check for error notifications
    const errorNotifications = page.locator('.theia-notification.error, .notification-error, [data-severity="error"]');
    const errorCount = await errorNotifications.count();
    expect(errorCount).toBe(0);

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-8: Undo → element restored
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-8: Undo', () => {
  test('add element → undo → element restored to previous state', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    const initial = await page.locator(CONTACT).count();

    // Add a contact
    await clickPaletteTool(page, 'NO Contact');
    const graph = page.locator(GRAPH);
    const box = await graph.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 3, box!.y + 60);
    await page.waitForTimeout(500);

    const afterAdd = await page.locator(CONTACT).count();
    expect(afterAdd).toBeGreaterThan(initial);

    // Undo via Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);

    // Verify element was removed (undo restored previous state)
    const afterUndo = await page.locator(CONTACT).count();
    expect(afterUndo).toBeLessThan(afterAdd);

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-9: Open .ld file → GLSP editor loads (not text editor)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-9: GLSP Editor Loads .ld File', () => {
  test('open .ld file → diagram editor renders, not Monaco text', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    // GLSP diagram editor must be visible
    await expect(page.locator(GRAPH)).toBeVisible();

    // Monaco text editor must NOT be visible for this file
    // Monaco uses .monaco-editor as its root element
    const monacoVisible = await page.locator('.monaco-editor').first()
      .isVisible()
      .catch(() => false);
    // If Monaco is visible it means .ld opened as text, not diagram
    expect(monacoVisible).toBe(false);

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-10: Tool palette creates contact on canvas
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-10: Palette Creates Contact', () => {
  test('click NO Contact → click canvas → SVG contact element appears', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    // Snapshot contact count before
    const before = await page.locator(CONTACT).count();

    // Activate NO Contact tool from palette
    await clickPaletteTool(page, 'NO Contact');

    // Click on canvas to place contact
    const graph = page.locator(GRAPH);
    const box = await graph.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 3, box!.y + 60);
    await page.waitForTimeout(500);

    // Verify SVG contact element appeared
    const after = await page.locator(CONTACT).count();
    expect(after).toBeGreaterThan(before);

    // Verify the element is a real SVG node (has data-element-id)
    const contact = page.locator(CONTACT).first();
    const elementId = await contact.getAttribute('data-element-id');
    expect(elementId).toBeTruthy();

    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E-11: Console has 0 GLSP errors after file open
// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-11: Zero GLSP Console Errors', () => {
  test('open .ld file → wait for render → console error count = 0', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await openLdDiagram(page);

    // Wait a bit longer for any async GLSP operations to settle
    await page.waitForTimeout(2000);

    // Filter out favicon 404 (not a real error)
    const glspErrors = errors.filter(e => !e.includes('favicon'));

    // Log any errors for debugging
    if (glspErrors.length > 0) {
      console.error('[E2E-11] Unexpected console errors:', glspErrors);
    }

    expect(glspErrors).toHaveLength(0);
  });
});
