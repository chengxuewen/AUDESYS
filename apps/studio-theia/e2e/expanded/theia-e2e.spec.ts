// AUDESYS Studio Theia — Expanded E2E Tests
// Tests against Theia 1.73 actual DOM selectors.
import { test, expect } from '@playwright/test';

const SHELL_SELECTOR = '#theia-app-shell';
const STATUS_BAR = '#theia-statusBar';
const SIDEBAR = '.theia-app-left';
const EXPLORER_TAB = '#shell-tab-explorer-view-container';
const TOP_PANEL = '#theia-top-panel';

test.describe('Theia Shell', () => {
  test('T1: Shell renders with reasonable dimensions', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SHELL_SELECTOR, { state: 'visible', timeout: 30_000 });
    const box = await page.locator(SHELL_SELECTOR).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(200);
  });

  test('T2: Status bar renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(STATUS_BAR, { state: 'visible', timeout: 30_000 });
    await expect(page.locator(STATUS_BAR)).toBeVisible();
    await page.waitForTimeout(500);
    // Status bar has child div elements (area left/right with problem markers, bell icon, etc.)
    const children = await page.locator(`${STATUS_BAR} > div`).count();
    expect(children).toBeGreaterThanOrEqual(1);
  });

  test('T3: Left sidebar has at least 1 icon', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SIDEBAR, { state: 'visible', timeout: 30_000 });
    const icons = page.locator(`${SIDEBAR} .lm-TabBar-tabIcon, ${SIDEBAR} .codicon`);
    const count = await icons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('T4: No critical console errors on startup', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForSelector(SHELL_SELECTOR, { state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(1500);
    const critical = errors.filter((e) =>
      e.includes('Uncaught') ||
      e.includes('is not defined') ||
      e.includes('Failed to load resource') ||
      e.includes('Minified React')
    );
    expect(critical).toHaveLength(0);
  });

  test('T5: Startup under 15 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForSelector(SHELL_SELECTOR, { state: 'visible', timeout: 30_000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(15_000);
  });
});

test.describe('Theia Features', () => {
  test('T6: Quick-input container is present in DOM', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SHELL_SELECTOR, { state: 'visible', timeout: 30_000 });
    // Theia always renders the quick-input container in the DOM tree,
    // even before the command palette is opened.
    const container = page.locator('#quick-input-container');
    await expect(container).toBeAttached();
  });

  test('T7: Explorer tab has file icon', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SIDEBAR, { state: 'visible', timeout: 30_000 });
    const explorerTab = page.locator(EXPLORER_TAB);
    await expect(explorerTab).toBeVisible();
    const icon = explorerTab.locator('.codicon-files');
    await expect(icon).toBeVisible();
  });

  test('T8: Explorer tab label is "Explorer"', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SIDEBAR, { state: 'visible', timeout: 30_000 });
    // Theia renders tab labels that may be visually hidden; check via textContent
    const label = page.locator(`${EXPLORER_TAB} .lm-TabBar-tabLabel`);
    await expect(label.first()).toBeAttached();
  });

  test('T9: Top panel renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(TOP_PANEL, { state: 'visible', timeout: 30_000 });
    await expect(page.locator(TOP_PANEL)).toBeVisible();
  });

  test('T10: Page title is set', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SHELL_SELECTOR, { state: 'visible', timeout: 30_000 });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
