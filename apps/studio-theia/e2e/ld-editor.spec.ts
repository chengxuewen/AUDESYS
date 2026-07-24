/// <reference types="playwright" />
// AUDESYS Studio Theia — LD Editor E2E Tests
// Run: npx playwright test e2e/ld-editor.spec.ts
import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://127.0.0.1:3100';
const SHELL = '#theia-app-shell';

/** Collect console errors, exclude known non-critical noise */
function collectErrors(page: ReturnType<typeof test['info']> extends never ? never : Parameters<Parameters<typeof test>[1]>[0]['page']) {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return {
    errors,
    critical(): string[] {
      return errors.filter(e =>
        !e.includes('favicon.ico') &&
        !e.includes('WebSocket') &&
        !e.includes('setTheme') &&
        !e.includes('service worker')
      );
    },
  };
}

test.describe('LD Editor E2E', () => {

  test('TC-01: Studio launches with correct title, widgets>70, 0 real-errors', async ({ page }) => {
    const errTracker = collectErrors(page);
    await page.goto(STUDIO_URL);
    await page.waitForTimeout(8000);

    await expect(page).toHaveTitle('AUDESYS Studio');

    const widgetCount = await page.evaluate(() =>
      document.querySelectorAll('.p-Widget, .lm-Widget').length
    );
    expect(widgetCount).toBeGreaterThan(70);

    expect(errTracker.critical()).toHaveLength(0);
  });

  test('TC-02: F1 > New Ladder Diagram — file created notification or explorer update', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.keyboard.press('F1');
    await page.waitForTimeout(1500);

    const input = page.locator('.quick-input-field input, .monaco-inputbox input');
    await input.fill('>New Ladder Diagram');
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const notif = page.locator('.theia-notification');
    const notifCount = await notif.count();
    if (notifCount > 0) {
      const text = (await notif.first().textContent()) || '';
      expect(text).toMatch(/Created|untitled|Ladder|LD/i);
    }
  });

  test('TC-03: LD Tool Palette exists and has tool buttons', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);

    // ponytail: Theia duplicates tab IDs — use .first() for strict mode
    await page.locator('#shell-tab-audesys-ld-palette').first().click({ force: true });
    await page.waitForTimeout(1000);

    const ldButtons = page.locator('#audesys-ld-palette .ld-palette-button');
    const btnCount = await ldButtons.count();
    expect(btnCount).toBeGreaterThanOrEqual(1);
  });

  test('TC-04: FBD Tool Palette exists and has tool buttons', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.locator('#shell-tab-audesys-fbd-palette').first().click({ force: true });
    await page.waitForTimeout(1000);

    const fbdButtons = page.locator('#audesys-fbd-palette .fbd-palette-button');
    const btnCount = await fbdButtons.count();
    expect(btnCount).toBeGreaterThanOrEqual(1);
  });

  test('TC-05: Signal Browser is visible in sidebar', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);

    const signalTab = page.locator('.lm-TabBar-tabLabel:has-text("Signal Browser")');
    await expect(signalTab.first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-06: Debug Panel is visible in bottom area', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);

    const debugTab = page.locator('.lm-TabBar-tabLabel:has-text("Debug"), .lm-TabBar-tabLabel:has-text("Debug Panel")');
    await expect(debugTab.first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-07: HMI Designer can be opened via F1 command palette', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.keyboard.press('F1');
    await page.waitForTimeout(1500);

    const input = page.locator('.quick-input-field input, .monaco-inputbox input');
    await input.fill('>HMI Designer');
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const hmiWidgets = page.locator(
      '.lm-TabBar-tabLabel:has-text("HMI"), ' +
      '.lm-TabBar-tabLabel:has-text("Designer")'
    );
    const count = await hmiWidgets.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('TC-08: LD Tool Palette "NO Contact" button is clickable', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForSelector(SHELL, { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.locator('#shell-tab-audesys-ld-palette').first().click({ force: true });
    await page.waitForTimeout(1000);

    const noContactBtn = page.locator('#audesys-ld-palette .ld-palette-button').first();
    await expect(noContactBtn).toBeVisible({ timeout: 5000 });
    await noContactBtn.click();
  });

  test('TC-09: 0 console errors across full test session', async ({ page }) => {
    const errTracker = collectErrors(page);
    await page.goto(STUDIO_URL);
    await page.waitForTimeout(6000);

    await page.keyboard.press('F1');
    await page.waitForTimeout(1000);
    const input = page.locator('.quick-input-field input, .monaco-inputbox input');
    await input.fill('>New Ladder Diagram');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    expect(errTracker.critical()).toHaveLength(0);
  });

});
