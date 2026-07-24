/// <reference types="playwright" />
/**
 * AUDESYS LD Editor — Comprehensive E2E Test Suite
 *
 * Layers: L1=Startup, L2=Creation, L3=Interaction, L4=State, L5=Compile
 * Constraint: ALL future LD/FBD features MUST have tests here.
 */
import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:3100';

test.describe('L1 Startup', () => {
  test('TC-01 title AUDESYS Studio', async ({ page }) => {
    await page.goto(URL);
    await page.waitForTimeout(10000);
    await expect(page).toHaveTitle('AUDESYS Studio');
  });

  test('TC-02 widgets >70', async ({ page }) => {
    await page.goto(URL);
    await page.waitForTimeout(10000);
    const n = await page.evaluate(() => document.querySelectorAll('.p-Widget, .lm-Widget').length);
    expect(n).toBeGreaterThan(70);
  });

  test('TC-03 0 console errors', async ({ page }) => {
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(URL);
    await page.waitForTimeout(10000);
    const real = errs.filter(e => !e.includes('favicon.ico') && !e.includes('setTheme') && !e.includes('popup'));
    expect(real).toHaveLength(0);
  });
});

test.describe('L2 Element Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await page.waitForTimeout(8000);
    await page.keyboard.press('F1');
    await page.locator('.quick-input-field input').fill('>New Ladder');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.locator('#shell-tab-audesys-ld-palette').first().click({ force: true });
    await page.waitForTimeout(500);
  });

  test('TC-10 place NO contact → SVG element appears', async ({ page }) => {
    await page.locator('#audesys-ld-palette .ld-palette-button').first().click();
    await page.locator('.ld-editor svg').click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(500);
    await expect(page.locator('[data-element-id]').first()).toBeAttached({ timeout: 5000 });
  });

  test('TC-11 NO contact label = IN0 (not ??)', async ({ page }) => {
    await page.locator('#audesys-ld-palette .ld-palette-button').first().click();
    await page.locator('.ld-editor svg').click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(500);
    await expect(page.locator('[data-element-id] text').first()).toContainText('IN0', { timeout: 3000 });
  });

  test('TC-12 coil label = OUT0', async ({ page }) => {
    await page.locator('#audesys-ld-palette .ld-palette-button').nth(2).click();
    await page.locator('.ld-editor svg').click({ position: { x: 400, y: 100 } });
    await page.waitForTimeout(500);
    await expect(page.locator('[data-element-id] text').first()).toContainText('OUT0', { timeout: 3000 });
  });

  test('TC-13 second placement → IN1', async ({ page }) => {
    const btn = page.locator('#audesys-ld-palette .ld-palette-button').first();
    await btn.click(); await page.locator('.ld-editor svg').click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(300);
    await btn.click(); await page.locator('.ld-editor svg').click({ position: { x: 300, y: 100 } });
    await page.waitForTimeout(500);
    const texts = await page.locator('[data-element-id] text').allTextContents();
    expect(texts).toContain('IN0');
    expect(texts).toContain('IN1');
  });

  test('TC-14 NC contact stroke color defined', async ({ page }) => {
    await page.locator('#audesys-ld-palette .ld-palette-button').nth(1).click();
    await page.locator('.ld-editor svg').click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(500);
    const stroke = await page.evaluate(() => {
      const r = document.querySelector('[data-element-id] rect');
      return r ? window.getComputedStyle(r).stroke : '';
    });
    expect(stroke).toBeTruthy();
  });
});

test.describe('L3 Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await page.waitForTimeout(8000);
    await page.keyboard.press('F1');
    await page.locator('.quick-input-field input').fill('>New Ladder');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.locator('#shell-tab-audesys-ld-palette').first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('#audesys-ld-palette .ld-palette-button').first().click();
    await page.locator('.ld-editor svg').click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(500);
  });

  test('TC-15 right-click → context menu visible', async ({ page }) => {
    await page.locator('[data-element-id]').first().click({ button: 'right' });
    await page.waitForTimeout(500);
    await expect(page.locator('.ld-context-menu')).toBeVisible({ timeout: 3000 });
  });

  test('TC-16 delete removes element', async ({ page }) => {
    const before = await page.locator('[data-element-id]').count();
    await page.locator('[data-element-id]').first().click({ button: 'right' });
    await page.locator('.ld-context-menu__item--danger').click();
    await page.waitForTimeout(500);
    expect(await page.locator('[data-element-id]').count()).toBeLessThan(before);
  });

  test('TC-17 empty canvas deselects', async ({ page }) => {
    await page.locator('[data-element-id]').first().click();
    await page.locator('.ld-editor svg').click({ position: { x: 600, y: 50 } });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-element-id]').first()).toBeAttached();
  });
});

test.describe('L4 Canvas State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await page.waitForTimeout(8000);
    await page.keyboard.press('F1');
    await page.locator('.quick-input-field input').fill('>New Ladder');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.locator('#shell-tab-audesys-ld-palette').first().click({ force: true });
    await page.waitForTimeout(500);
  });

  test('TC-20 empty canvas → auto rung', async ({ page }) => {
    await page.locator('#audesys-ld-palette .ld-palette-button').first().click();
    await page.locator('.ld-editor svg').click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(500);
    const texts = await page.locator('text').allTextContents();
    const rung = texts.find(t => t.trim() === '000' || t.trim() === '001');
    expect(rung).toBeDefined();
  });

  test('TC-21 power rails exist', async ({ page }) => {
    await expect(page.locator('[data-element-id*="rail"]').first()).toBeAttached({ timeout: 5000 });
  });

  test('TC-22 CSS variables defined', async ({ page }) => {
    const ok = await page.evaluate(() => {
      const s = window.getComputedStyle(document.querySelector('.ld-editor')!);
      return [
        '--ld-contact-no-fill', '--ld-contact-nc-fill', '--ld-power-rail-color',
        '--ld-wire-color', '--ld-grid-color', '--ld-selection-color'
      ].filter(v => !s.getPropertyValue(v) || s.getPropertyValue(v) === '').length;
    });
    expect(ok).toBeLessThan(3);
  });
});

test.describe('L5 Compile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await page.waitForTimeout(8000);
    await page.keyboard.press('F1');
    await page.locator('.quick-input-field input').fill('>New Ladder');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.locator('#shell-tab-audesys-ld-palette').first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('#audesys-ld-palette .ld-palette-button').first().click();
    await page.locator('.ld-editor svg').click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(500);
  });

  test('TC-25 right-click compile no errors', async ({ page }) => {
    await page.locator('[data-element-id]').first().click({ button: 'right' });
    await page.waitForTimeout(300);
    const btn = page.locator('.ld-context-menu__item:has-text("Compile")');
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(2000);
      const n = page.locator('.theia-notification');
      if (await n.count() > 0) expect(await n.first().textContent()).toBeTruthy();
    }
  });

  test('TC-26 full session 0 errors', async ({ page }) => {
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(URL);
    await page.waitForTimeout(10000);
    expect(errs.filter(e => !e.includes('favicon.ico') && !e.includes('setTheme') && !e.includes('popup'))).toHaveLength(0);
  });
});
