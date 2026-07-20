// AUDESYS Studio — Responsive UI & HMI Tests
import { test, expect } from './fixtures/tauri-mock';

test.describe('Responsive Layout', () => {
  test('RL-01: fills viewport at 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const box = await page.locator('.app-root').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1440, 0);
    expect(box!.height).toBeCloseTo(900, 0);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(1,\s*1,\s*2\)/); // dark canvas, no white
  });

  test('RL-02: fills viewport at 1200x600', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1200, height: 600 });
    const box = await page.locator('.app-root').boundingBox();
    expect(box!.width).toBeCloseTo(1200, 0);
    expect(box!.height).toBeCloseTo(600, 0);
  });

  test('RL-03: fills viewport at 1000x450 — no scrollbar', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1000, height: 450 });
    const box = await page.locator('.app-root').boundingBox();
    expect(box!.width).toBeCloseTo(1000, 0);
    expect(box!.height).toBeCloseTo(450, 0);
    const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hScroll).toBe(false);
  });

  test('RL-04: editor + output panels visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('.app-panel--editor')).toBeVisible();
    await expect(page.locator('.app-panel--output')).toBeVisible();
    await expect(page.locator('.cm-editor')).toBeVisible();
  });
});

test.describe('Toolbar', () => {
  test('TB-01: toolbar buttons visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.app-toolbar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New' }).first()).toBeVisible();
    await expect(page.locator('button:has-text("Compile & Run")')).toBeVisible();
  });

  test('TB-02: mode toggle shows ST', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'ST', exact: true })).toBeVisible();
  });
});

test.describe('Mode Switching', () => {
  const modes = ['ST', 'IL', 'LD', 'FBD', 'SFC', 'HMI'] as const;
  for (let i = 0; i < modes.length - 1; i++) {
    test(`MS-${modes[i]}→${modes[i+1]}: switches correctly`, async ({ page }) => {
      await page.goto('/');
      const btn = page.getByRole('button', { name: /^(ST|IL|LD|FBD|SFC|HMI)$/ });
      let cur = await btn.textContent(), c = 0;
      while (cur !== modes[i] && c++ < 10) { await btn.click(); cur = await btn.textContent(); }
      await btn.click();
      expect(await btn.textContent()).toBe(modes[i + 1]);
    });
  }
});

test.describe('HMI Builder', () => {
  async function toHmi(page: any) {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /^(ST|IL|LD|FBD|SFC|HMI)$/ });
    let t = await btn.textContent(), c = 0;
    while (t !== 'HMI' && c++ < 10) { await btn.click(); t = await btn.textContent(); }
    expect(t).toBe('HMI');
  }

  test('HMI-01: Deploy, Save, Edit/Preview visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await toHmi(page);
    await expect(page.getByRole('button', { name: 'Save' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deploy' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit|Preview/ })).toBeVisible();
  });

  test('HMI-02: canvas + palette header visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await toHmi(page);
    await expect(page.locator('.hmi-canvas')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.app-panel__header').filter({ hasText: 'Widgets' }))
      .toBeVisible({ timeout: 3000 });
  });

  test('HMI-03: canvas is substantial', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await toHmi(page);
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
