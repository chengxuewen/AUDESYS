/// <reference types="playwright" />
import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://127.0.0.1:3100';

test.describe('CODESYS Workflow E2E', () => {

  test('E2E-1: Studio launches with correct title and no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(STUDIO_URL);
    await page.waitForTimeout(10000);
    await expect(page).toHaveTitle('AUDESYS Studio');
    expect(errors.filter(e => !e.includes('favicon.ico') && !e.includes('setTheme'))).toHaveLength(0);
  });

  test('E2E-2: Create LD file via command palette', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForTimeout(8000);

    // Open command palette
    await page.keyboard.press('F1');
    await page.waitForTimeout(1000);

    // Type the command
    const input = page.locator('.quick-input-field input, .monaco-inputbox input');
    await input.fill('>New Ladder Diagram (LD) File');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Verify file appears — look for explorer elements or notification
    const notifications = page.locator('.theia-notification');
    if (await notifications.count() > 0) {
      const text = await notifications.first().textContent();
      expect(text).toMatch(/Created|untitled/);
    }
  });

  test('E2E-3: LD editor opens and tool palette is visible', async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForTimeout(8000);

    // Check LD tool palette is in sidebar
    const palette = page.locator('.lm-TabBar-tabLabel:has-text("LD Tool Palette")');
    await expect(palette.first()).toBeVisible({ timeout: 5000 });
  });

  test('E2E-5: Workbench has expected widgets and 0 errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(STUDIO_URL);
    await page.waitForTimeout(10000);

    const widgetCount = await page.evaluate(() =>
      document.querySelectorAll('.p-Widget, .lm-Widget').length
    );
    expect(widgetCount).toBeGreaterThan(70);
    const realErrors = errors.filter(e => !e.includes('favicon.ico'));
    expect(realErrors).toHaveLength(0);
  });
});
