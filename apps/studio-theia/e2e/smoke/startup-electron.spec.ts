// AUDESYS Studio Theia — Startup Smoke Tests (Electron)
// Uses Playwright's Electron launcher to test the Electron app directly.

import { _electron as electron, test, expect } from '@playwright/test';

const TIMEOUT = 60_000;

test.describe('Theia Startup (Electron)', () => {
  test('T1: Theia workbench renders', async () => {
    const app = await electron.launch({
      args: ['.', '--no-sandbox'],
      timeout: TIMEOUT,
    });

    const page = await app.firstWindow();
    await page.waitForSelector('.theia-workbench', { state: 'visible', timeout: TIMEOUT });

    const box = await page.locator('.theia-workbench').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(200);

    await app.close();
  });

  test('T2: Activity Bar has at least 3 icons', async () => {
    const app = await electron.launch({
      args: ['.', '--no-sandbox'],
      timeout: TIMEOUT,
    });

    const page = await app.firstWindow();
    await page.waitForSelector('.theia-activity-bar', { state: 'visible', timeout: TIMEOUT });

    const icons = page.locator('.theia-activity-bar .action-label');
    const visibleCount = await icons.count();
    expect(visibleCount).toBeGreaterThanOrEqual(3);

    await app.close();
  });

  test('T3: Status Bar renders', async () => {
    const app = await electron.launch({
      args: ['.', '--no-sandbox'],
      timeout: TIMEOUT,
    });

    const page = await app.firstWindow();
    await page.waitForSelector('.theia-statusBar', { state: 'visible', timeout: TIMEOUT });

    const statusBar = page.locator('.theia-statusBar');
    await expect(statusBar).toBeVisible();
    const text = await statusBar.innerText();
    expect(text.length).toBeGreaterThan(0);

    await app.close();
  });

  test('T4: No console errors on startup', async () => {
    const errors: string[] = [];
    // We need to capture errors after page is available
    const app = await electron.launch({
      args: ['.', '--no-sandbox'],
      timeout: TIMEOUT,
    });

    const page = await app.firstWindow();
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.waitForSelector('.theia-workbench', { state: 'visible', timeout: TIMEOUT });

    // Small wait to collect any late errors
    await page.waitForTimeout(2000);

    const critical = errors.filter(
      (e) =>
        e.includes('Uncaught') ||
        e.includes('is not defined') ||
        e.includes('Failed to load resource') ||
        e.includes('Minified React')
    );
    expect(critical).toHaveLength(0);

    await app.close();
  });

  test('T5: Startup time under 15 seconds', async () => {
    const start = Date.now();
    const app = await electron.launch({
      args: ['.', '--no-sandbox'],
      timeout: TIMEOUT,
    });

    const page = await app.firstWindow();
    await page.waitForSelector('.theia-workbench', { state: 'visible', timeout: TIMEOUT });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(15_000);

    await app.close();
  });
});
