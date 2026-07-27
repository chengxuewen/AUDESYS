// AUDESYS Studio Theia — Startup Smoke Tests (Browser)
// Updated for Theia 1.73 actual DOM selectors.
import { test, expect } from '@playwright/test';

const SHELL = '#theia-app-shell';
const STATUS_BAR = '#theia-statusBar';
const SIDEBAR = '.theia-app-left';

test.describe('Theia Startup Smoke', () => {
  test('S1: Theia shell renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30_000 });
    const box = await page.locator(SHELL).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(200);
  });

  test('S2: Activity bar has at least 1 icon', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SIDEBAR, { state: 'visible', timeout: 30_000 });
    const icons = page.locator(`${SIDEBAR} .lm-TabBar-tabIcon, ${SIDEBAR} .codicon`);
    const count = await icons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('S3: Status bar renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(STATUS_BAR, { state: 'visible', timeout: 30_000 });
    await expect(page.locator(STATUS_BAR)).toBeVisible();
  });

  test('S4: No critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(1500);
    const critical = errors.filter(
      (e) =>
        e.includes('Uncaught') ||
        e.includes('is not defined') ||
        e.includes('Failed to load resource') ||
        e.includes('Minified React')
    );
    expect(critical).toHaveLength(0);
  });

  test('S5: Startup under 15 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30_000 });
    expect(Date.now() - start).toBeLessThan(15_000);
  });
});
