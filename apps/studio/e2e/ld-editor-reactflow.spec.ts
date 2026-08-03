/// <reference types="playwright" />
/**
 * AUDESYS LD Editor — React Flow E2E Test Suite
 *
 * Tests the React Flow based LD editor (audesys-ld-editor, D110).
 *
 * Selector conventions (sdd-tester):
 *   - node type:  `.react-flow__node-<type>`  (NOT [data-type])
 *   - node id:    `.react-flow__node[data-id="..."]`
 *   - edge:       `.react-flow__edge`
 *   - position:   `el.style.transform`        (NOT boundingBox — pan/zoom safe)
 *   - async:      `expect.poll` / `toBeVisible({ timeout })` — no fixed sleeps
 *   - drag:       mouse.move(steps) → down → move(steps) → up
 *
 * Prerequisites:
 *   - Theia app running at THEIA_URL (default http://127.0.0.1:3100)
 *   - workspace dir (LD_E2E_WORKSPACE, default ~/ld-e2e-workspace) writable;
 *     fixtures are written there by beforeAll and opened via File: Open File.
 */
import { test, expect, Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const URL = process.env.THEIA_URL || 'http://127.0.0.1:3100';
const WORKSPACE = process.env.LD_E2E_WORKSPACE || path.join(os.homedir(), 'ld-e2e-workspace');
const QUICK_INPUT = '.quick-input-widget input, .quick-input-field input';
const QUICK_ROW = '.quick-input-list .monaco-list-row, .quick-input-list-row';

// ── LdGraph fixture builders (typed, mirror src/model shapes) ──────────────

interface FxPoint { x: number; y: number }
interface FxNode {
    id: string;
    type: string;
    position: FxPoint;
    size: { width: number; height: number };
    side?: 'Left' | 'Right';
    contactType?: 'NO' | 'NC';
    coilType?: 'Normal' | 'Negated' | 'Set' | 'Reset';
    variableName?: string;
}
interface FxEdge { id: string; type: string; sourceId: string; targetId: string }
interface FxGraph { id: string; nodes: FxNode[]; edges: FxEdge[]; rungs: Array<{ id: string; rungNumber: number; comment?: string; elementIds: string[] }> }

const RAIL_W = 4;
const RAIL_H = 600;

function rails(): FxNode[] {
    return [
        { id: 'rail-l', type: 'node:powerrail', side: 'Left', position: { x: 0, y: 0 }, size: { width: RAIL_W, height: RAIL_H } },
        { id: 'rail-r', type: 'node:powerrail', side: 'Right', position: { x: 640, y: 0 }, size: { width: RAIL_W, height: RAIL_H } },
    ];
}

function contact(id: string, x: number, variableName: string, contactType: 'NO' | 'NC' = 'NO'): FxNode {
    return { id, type: 'node:contact', contactType, variableName, position: { x, y: 40 }, size: { width: 36, height: 36 } };
}

function coil(id: string, variableName: string, coilType: 'Normal' | 'Negated' | 'Set' | 'Reset' = 'Normal'): FxNode {
    return { id, type: 'node:coil', coilType, variableName, position: { x: 600, y: 40 }, size: { width: 36, height: 36 } };
}

function wire(id: string, sourceId: string, targetId: string): FxEdge {
    return { id, type: 'edge:wire', sourceId, targetId };
}

/** One rung with power rails only. */
function bareGraph(id: string): FxGraph {
    return { id, nodes: rails(), edges: [], rungs: [{ id: 'rung-1', rungNumber: 1, comment: 'Main', elementIds: [] }] };
}

/** Rung with one contact + one coil, fully wired (4 wires). */
function wiredGraph(id: string): FxGraph {
    return {
        id,
        nodes: [...rails(), contact('c1', 40, 'IN0'), coil('k1', 'OUT0')],
        edges: [
            wire('w1', 'rail-l', 'c1'),
            wire('w2', 'c1', 'rail-r'),
            wire('w3', 'c1', 'k1'),
            wire('w4', 'k1', 'rail-r'),
        ],
        rungs: [{ id: 'rung-1', rungNumber: 1, comment: 'Main', elementIds: ['c1', 'k1'] }],
    };
}

/** Rung with one contact only. */
function contactGraph(id: string): FxGraph {
    return {
        id,
        nodes: [...rails(), contact('c1', 40, 'IN0')],
        edges: [wire('w1', 'rail-l', 'c1'), wire('w2', 'c1', 'rail-r')],
        rungs: [{ id: 'rung-1', rungNumber: 1, comment: 'Main', elementIds: ['c1'] }],
    };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function writeFixture(name: string, graph: FxGraph): string {
    const file = path.join(WORKSPACE, name);
    fs.writeFileSync(file, JSON.stringify(graph, null, 2), 'utf8');
    return file;
}

/** Wait until the Theia shell is up. */
async function waitForShell(page: Page): Promise<void> {
    await page.waitForSelector('#theia-app-shell, .theia-app-main', { timeout: 45000 });
    await expect(page.locator('.lm-TabBar-tabLabel, .p-TabBar-tabLabel').first()).toBeVisible({ timeout: 30000 });
}

/** Open a workspace file via File: Open File (quick open), retrying while the file index warms up. */
async function openLdFile(page: Page, fileName: string): Promise<void> {
    await page.goto(`${URL}/#${WORKSPACE}`);
    await waitForShell(page);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.keyboard.press('F1');
        const input = page.locator(QUICK_INPUT).first();
        await input.waitFor({ timeout: 10000 });
        await input.fill('>Open File');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(600); // quick picker mode switch (command → file)
        await page.keyboard.type(fileName);

        const row = page.locator(QUICK_ROW, { hasText: fileName }).first();
        try {
            await row.waitFor({ timeout: 6000 });
            await page.keyboard.press('Enter');
            await expect(page.locator('.ld-editor-root')).toBeVisible({ timeout: 15000 });
            return;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
    }
    throw lastError ?? new Error(`could not open ${fileName}`);
}

/** Click a toolbar button by exact label. */
function toolbarButton(page: Page, label: string): Locator {
    return page.locator('.ld-toolbar button').filter({ hasText: new RegExp(`^${label}$`) });
}

/** Parse translate(x,y) out of style.transform (pan/zoom-safe position source). */
async function readTransform(locator: Locator): Promise<{ x: number; y: number }> {
    const transform = await locator.evaluate((el) => (el as HTMLElement).style.transform);
    const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    expect(match, `unexpected transform "${transform}"`).not.toBeNull();
    return { x: Number(match![1]), y: Number(match![2]) };
}

/** Multi-step mouse drag of a node element by (dx, dy) screen pixels. */
async function dragNodeBy(page: Page, locator: Locator, dx: number, dy: number): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, 'node must be visible to drag').not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(startX + (dx * i) / steps, startY + (dy * i) / steps, { steps: 3 });
    }
    await page.mouse.up();
}

/** Click on the React Flow pane at a fractional position. */
async function clickPane(page: Page, fx: number, fy: number): Promise<void> {
    const pane = page.locator('.react-flow__pane').first();
    const box = await pane.boundingBox();
    expect(box, 'pane must be visible').not.toBeNull();
    await page.mouse.click(box!.x + box!.width * fx, box!.y + box!.height * fy);
}

/** Place an element with a toolbar tool + pane click. */
async function placeWithTool(page: Page, toolLabel: string, fx = 0.45, fy = 0.4): Promise<void> {
    await toolbarButton(page, toolLabel).click();
    await clickPane(page, fx, fy);
}

// ── Fixtures (beforeAll) ────────────────────────────────────────────────────

test.beforeAll(() => {
    fs.mkdirSync(WORKSPACE, { recursive: true });
    writeFixture('openbasic.ld', bareGraph('openbasic'));
    writeFixture('addcontact.ld', bareGraph('addcontact'));
    writeFixture('dragsnap.ld', contactGraph('dragsnap'));
    writeFixture('autowire.ld', bareGraph('autowire'));
    writeFixture('deletecascade.ld', wiredGraph('deletecascade'));
    writeFixture('savefile.ld', bareGraph('savefile'));
    writeFixture('undoredo.ld', bareGraph('undoredo'));
    writeFixture('addrung.ld', bareGraph('addrung'));
    writeFixture('boundary.ld', contactGraph('boundary'));
    writeFixture('typeswitch.ld', contactGraph('typeswitch'));
    writeFixture('ylock.ld', contactGraph('ylock'));
});

// ── T1: Open .ld → canvas + rung render ─────────────────────────────────────

test('T1 open .ld file → canvas renders and rung group appears', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await openLdFile(page, 'openbasic.ld');

    await expect(page.locator('.ld-editor-root')).toBeVisible();
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.locator('.react-flow__node-rung')).toHaveCount(1);
    await expect(page.locator('.react-flow__node-powerrail')).toHaveCount(2);

    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
});

// ── T2: Toolbar NO Contact → canvas click → contact appears ─────────────────

test('T2 click NO Contact tool then canvas → contact node appears', async ({ page }) => {
    await openLdFile(page, 'addcontact.ld');

    await placeWithTool(page, 'NO Contact');

    const contactNode = page.locator('.react-flow__node-contact');
    await expect(contactNode).toHaveCount(1, { timeout: 10000 });
    await expect(contactNode.first()).toContainText('IN0');
});

// ── T3: Drag node → 40px grid snap (transform assertion) ────────────────────

test('T3 drag node → position snaps to 40px grid', async ({ page }) => {
    await openLdFile(page, 'dragsnap.ld');

    const node = page.locator('.react-flow__node-contact').first();
    await expect(node).toBeVisible();
    const before = await readTransform(node);

    await dragNodeBy(page, node, 100, 0);

    await expect
        .poll(async () => {
            const after = await readTransform(node);
            return after.x !== before.x;
        }, { timeout: 10000 })
        .toBe(true);

    const after = await readTransform(node);
    expect(after.x % 40).toBe(0);
    expect(after.y % 40).toBe(0);
});

// ── T4: adding elements auto-wires → edge count increases ───────────────────
// Manual wiring is disabled by design (nodesConnectable=false); wires are
// created by the operation handlers, so the edge-count assertion keys off
// element placement.

test('T4 placing a contact creates wire edges', async ({ page }) => {
    await openLdFile(page, 'autowire.ld');

    const edges = page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(0);

    await placeWithTool(page, 'NO Contact');

    await expect
        .poll(async () => edges.count(), { timeout: 10000 })
        .toBeGreaterThan(0);
    // rail→contact and contact→rail auto wires
    await expect(edges).toHaveCount(2);
});

// ── T5: Delete node → count -1 + cascade edge deletion ──────────────────────

test('T5 delete contact → node removed and connected edges cascade-deleted', async ({ page }) => {
    await openLdFile(page, 'deletecascade.ld');

    const contactNode = page.locator('.react-flow__node-contact');
    await expect(contactNode).toHaveCount(1);
    await expect(page.locator('.react-flow__edge')).toHaveCount(4);

    await contactNode.first().click(); // select
    await page.keyboard.press('Delete');

    await expect(contactNode).toHaveCount(0, { timeout: 10000 });
    // only coil→right-rail wire survives the cascade
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    await expect(page.locator('.react-flow__node-coil')).toHaveCount(1);
});

// ── T6: Grid toggle ─────────────────────────────────────────────────────────
// ponytail: the React Flow editor has snapToGrid always on and exposes no
// Ctrl+G toggle (that command belonged to the removed GLSP editor).
// Un-testable until a toggle exists; tracked in the migration plan.

test.fixme('T6 toggle grid (Ctrl+G) → snapToGrid behavior changes', async () => { });

// ── T7 / T7b: Compilation ───────────────────────────────────────────────────
// Compile has no UI surface in the React Flow editor yet (backend module is a
// Phase-1 placeholder and no window.__ldEditor hook exists). Handler.compile
// is covered by src/__tests__/operation-handler.test.ts instead.

test.fixme('T7 compile success → compileLd returns HalProgram', async () => { });
test.fixme('T7b compile error → diagnostics returned', async () => { });

// ── T8 + T8b: Save → file JSON updated → reload round-trip ──────────────────

test('T8/T8b save updates file JSON and reload restores the graph', async ({ page }) => {
    const file = path.join(WORKSPACE, 'savefile.ld');
    await openLdFile(page, 'savefile.ld');

    // Arrange: one contact added through the UI
    await placeWithTool(page, 'NO Contact');
    await expect(page.locator('.react-flow__node-contact')).toHaveCount(1, { timeout: 10000 });

    // Act: save (Saveable → FileService.writeFile)
    await page.keyboard.press('Meta+s');

    // Assert: file on disk now carries an LdGraph with the contact
    await expect
        .poll(() => {
            try {
                const saved: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (typeof saved !== 'object' || saved === null) return false;
                const graph = saved as { id?: unknown; nodes?: unknown[]; edges?: unknown[]; rungs?: unknown[] };
                return (
                    typeof graph.id === 'string' &&
                    Array.isArray(graph.nodes) &&
                    Array.isArray(graph.edges) &&
                    Array.isArray(graph.rungs) &&
                    graph.nodes.some((n) => (n as { type?: string }).type === 'node:contact')
                );
            } catch {
                return false;
            }
        }, { timeout: 15000 })
        .toBe(true);

    // T8b: close the editor, reopen from disk, graph round-trips
    const tab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'savefile.ld' }).first();
    await tab.hover();
    await tab.locator('.lm-TabBar-tabCloseIcon, .p-TabBar-tabCloseIcon').click();
    await expect(page.locator('.ld-editor-root')).toHaveCount(0, { timeout: 10000 });

    await openLdFile(page, 'savefile.ld');
    await expect(page.locator('.react-flow__node-contact')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('.react-flow__node-rung')).toHaveCount(1);
});

// ── T9: Undo / Redo ─────────────────────────────────────────────────────────

test('T9 undo removes the placed contact, redo restores it', async ({ page }) => {
    await openLdFile(page, 'undoredo.ld');

    await placeWithTool(page, 'NO Contact');
    const contactNode = page.locator('.react-flow__node-contact');
    await expect(contactNode).toHaveCount(1, { timeout: 10000 });

    await toolbarButton(page, 'Undo').click();
    await expect(contactNode).toHaveCount(0, { timeout: 10000 });

    await toolbarButton(page, 'Redo').click();
    await expect(contactNode).toHaveCount(1, { timeout: 10000 });
});

// ── T10: Add Rung + create on the new rung ──────────────────────────────────

test('T10 Add Rung creates a second rung and elements stay rung-parented', async ({ page }) => {
    await openLdFile(page, 'addrung.ld');

    await expect(page.locator('.react-flow__node-rung')).toHaveCount(1);

    await toolbarButton(page, 'Add Rung').click();
    await expect(page.locator('.react-flow__node-rung')).toHaveCount(2, { timeout: 10000 });

    // place a contact low on the canvas; rung index derives from the click y
    await placeWithTool(page, 'NO Contact', 0.45, 0.75);
    const contactNode = page.locator('.react-flow__node-contact');
    await expect(contactNode).toHaveCount(1, { timeout: 10000 });

    // React Flow renders child nodes inside their parent rung's DOM subtree
    await expect(page.locator('.react-flow__node-rung .react-flow__node-contact')).toHaveCount(1);
});

// ── T11: drag snap boundary (left edge) ─────────────────────────────────────

test('T11 dragging far left clamps at x>=0 and stays on-grid', async ({ page }) => {
    await openLdFile(page, 'boundary.ld');

    const node = page.locator('.react-flow__node-contact').first();
    await expect(node).toBeVisible();

    await dragNodeBy(page, node, -400, 0);

    await expect
        .poll(async () => {
            const pos = await readTransform(node);
            return pos.x;
        }, { timeout: 10000 })
        .toBeGreaterThanOrEqual(0);

    const pos = await readTransform(node);
    expect(pos.x % 40).toBe(0);
});

// ── T12: element type variants ──────────────────────────────────────────────

test('T12 NC contact and Set/Reset coil variants render; NO→NC switch via property view', async ({ page }) => {
    await openLdFile(page, 'typeswitch.ld');

    // NC contact straight from the toolbar renders with the NC color variable
    await placeWithTool(page, 'NC Contact', 0.3, 0.4);
    const ncContact = page.locator('.react-flow__node-contact').nth(1);
    await expect(ncContact).toBeVisible({ timeout: 10000 });
    const ncStroke = await ncContact.locator('svg rect').first().getAttribute('stroke');
    expect(ncStroke ?? '').toContain('nc-fill');

    // Coil Set renders an "S", Coil Reset renders an "R"
    await placeWithTool(page, 'Coil S', 0.7, 0.4);
    const setCoil = page.locator('.react-flow__node-coil').first();
    await expect(setCoil).toBeVisible({ timeout: 10000 });
    await expect(setCoil.locator('svg text')).toHaveText('S');

    await placeWithTool(page, 'Coil R', 0.8, 0.4);
    await expect(page.locator('.react-flow__node-coil')).toHaveCount(2, { timeout: 10000 });
    await expect(page.locator('.react-flow__node-coil').nth(1).locator('svg text')).toHaveText('R');

    // NO→NC switch of the existing contact through the property view
    await page.locator('.react-flow__node-contact').first().click();
    const propertyTab = page.locator('.lm-TabBar-tabLabel, .p-TabBar-tabLabel', { hasText: 'LD Properties' }).first();
    await propertyTab.click();
    const typeSelect = page.locator('.ld-property__select').first();
    await expect(typeSelect).toBeVisible({ timeout: 10000 });
    await typeSelect.selectOption('NC');

    await expect
        .poll(async () => {
            const stroke = await page.locator('.react-flow__node-contact').first().locator('svg rect').first().getAttribute('stroke');
            return stroke ?? '';
        }, { timeout: 10000 })
        .toContain('nc-fill');
});

// ── T13: horizontal movement constraint ─────────────────────────────────────

test('T13 dragging diagonally keeps the contact on its original Y', async ({ page }) => {
    await openLdFile(page, 'ylock.ld');

    const node = page.locator('.react-flow__node-contact').first();
    await expect(node).toBeVisible();
    const before = await readTransform(node);

    await dragNodeBy(page, node, 80, 60);

    await expect
        .poll(async () => (await readTransform(node)).x, { timeout: 10000 })
        .not.toBe(before.x);

    const after = await readTransform(node);
    expect(after.y).toBe(before.y);
    expect(after.x % 40).toBe(0);
});
