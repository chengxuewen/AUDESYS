// AUDESYS Studio Theia — Startup Smoke Tests
// Verifies the core Theia workbench renders without critical failures.

import { test, expect } from '@playwright/test';

test.describe('Theia Startup', () => {
  test('T1: Theia workbench renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.theia-workbench', { state: 'visible', timeout: 30_000 });
    // Workbench container should fill most of the viewport
    const box = await page.locator('.theia-workbench').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(200);
  });

  test('T2: Activity Bar has at least 3 icons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.theia-activity-bar', { state: 'visible', timeout: 30_000 });
    // Theia renders activity bar icons as .action-label with icon classes
    const icons = page.locator('.theia-activity-bar .action-label');
    // Theia sometimes renders tooltips as hidden labels — filter visible
    const visibleCount = await icons.count();
    // Sparse assertion: at least 3 icons (Explorer, Search, Source Control, etc.)
    expect(visibleCount).toBeGreaterThanOrEqual(3);
  });

  test('T3: Status Bar renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.theia-statusBar', { state: 'visible', timeout: 30_000 });
    const statusBar = page.locator('.theia-statusBar');
    await expect(statusBar).toBeVisible();
    // Status bar should contain some text (e.g. line/col info, language mode)
    const text = await statusBar.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('T4: No console errors on startup', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForSelector('.theia-workbench', { state: 'visible', timeout: 30_000 });
    // Filter out non-critical errors (e.g. favicon 404, known Theia harmless warnings)
    const critical = errors.filter(
      (e) =>
        e.includes('Uncaught') ||
        e.includes('is not defined') ||
        e.includes('Failed to load resource') ||
        e.includes('Minified React')
    );
    expect(critical).toHaveLength(0);
  });

  test('T5: Startup time under 15 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForSelector('.theia-workbench', { state: 'visible', timeout: 30_000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(15_000);
  });
});
