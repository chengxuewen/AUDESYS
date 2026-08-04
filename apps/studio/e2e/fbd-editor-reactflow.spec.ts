/// <reference types="playwright" />
/**
 * AUDESYS FBD Editor — React Flow E2E Test Suite
 *
 * Tests the React Flow based FBD editor (audesys-fbd-editor, D110 pattern,
 * mirrored from ld-editor-reactflow.spec.ts).
 *
 * Selector conventions (sdd-tester, shared with LD suite):
 *   - node type:  `.react-flow__node-<type>`  (NOT [data-type])
 *     gate → `fb-gate` (`.react-flow__node-fb-gate`), FB → `fb-block`
 *   - edge:       `.react-flow__edge`
 *   - handle id:  `.react-flow__handle[data-handleid="<pin>"]` (id = pin name)
 *   - position:   `el.style.transform`        (NOT boundingBox — pan/zoom safe)
 *   - async:      `expect.poll` / `toBeVisible({ timeout })` — no fixed sleeps
 *   - drag:       mouse.move(steps) → down → move(steps) → up
 *
 * Prerequisites:
 *   - Theia app running at THEIA_URL (default http://127.0.0.1:3100)
 *   - workspace dir (FBD_E2E_WORKSPACE, default ~/fbd-e2e-workspace) writable;
 *     fixtures are rewritten per-test (the editor persists dirty graphs on
 *     page close — same retry-safety pattern as the LD suite).
 */
import { test, expect, Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const URL = process.env.THEIA_URL || 'http://127.0.0.1:3100';
const WORKSPACE = process.env.FBD_E2E_WORKSPACE || path.join(os.homedir(), 'fbd-e2e-workspace');
const QUICK_INPUT = '.quick-input-widget input, .quick-input-field input';
const QUICK_ROW = '.quick-input-list .monaco-list-row, .quick-input-list-row';

// ── FbdGraph fixture builders (typed, mirror src/model shapes) ──────────────

interface FxPoint { x: number; y: number }
interface FxPin { name: string; dataType: string; direction: 'Input' | 'Output'; position: FxPoint }
interface FxNode {
    id: string;
    type: 'node:gate' | 'node:fb';
    position: FxPoint;
    size: { width: number; height: number };
    gateType?: string;
    fbType?: string;
    inputPorts?: FxPin[];
    outputPorts?: FxPin[];
}
interface FxEdge {
    id: string;
    type: string;
    sourceId: string;
    sourcePortName: string;
    targetId: string;
    targetPortName: string;
}
interface FxGraph { id: string; nodes: FxNode[]; edges: FxEdge[] }

function pin(name: string, dataType: string, direction: 'Input' | 'Output', x: number, y: number): FxPin {
    return { name, dataType, direction, position: { x, y } };
}

/** AND gate (2 BOOL in, 1 BOOL out) at a deterministic position. */
function andGate(id: string, x: number, y: number): FxNode {
    return {
        id, type: 'node:gate', gateType: 'AND',
        position: { x, y }, size: { width: 60, height: 60 },
        inputPorts: [pin('IN1', 'BOOL', 'Input', 0, -12), pin('IN2', 'BOOL', 'Input', 0, 12)],
        outputPorts: [pin('OUT', 'BOOL', 'Output', 60, 0)],
    };
}

/** TON function block (IN/PT in, Q/ET out) at a deterministic position. */
function tonFb(id: string, x: number, y: number): FxNode {
    return {
        id, type: 'node:fb', fbType: 'TON',
        position: { x, y }, size: { width: 120, height: 128 },
        inputPorts: [pin('IN', 'BOOL', 'Input', 0, -12), pin('PT', 'TIME', 'Input', 0, 12)],
        outputPorts: [pin('Q', 'BOOL', 'Output', 120, -12), pin('ET', 'TIME', 'Output', 120, 12)],
    };
}

function wire(id: string, srcId: string, srcPin: string, tgtId: string, tgtPin: string): FxEdge {
    return { id, type: 'edge:signal', sourceId: srcId, sourcePortName: srcPin, targetId: tgtId, targetPortName: tgtPin };
}

function emptyGraph(id: string): FxGraph {
    return { id, nodes: [], edges: [] };
}

function tonGraph(id: string): FxGraph {
    return { id, nodes: [tonFb('fb1', 40, 40)], edges: [] };
}

/** TON + AND side by side, not yet wired. */
function tonAndBare(id: string): FxGraph {
    return {
        id,
        nodes: [tonFb('fb1', 40, 40), andGate('g1', 260, 40)],
        edges: [],
    };
}

/** TON + AND wired: TON.Q (BOOL) → AND.IN1 (BOOL). */
function tonAndWired(id: string): FxGraph {
    return { ...tonAndBare(id), edges: [wire('e1', 'fb1', 'Q', 'g1', 'IN1')] };
}

// ── Helpers (mirror LD suite) ───────────────────────────────────────────────

function writeFixture(name: string, graph: FxGraph): string {
    const file = path.join(WORKSPACE, name);
    fs.writeFileSync(file, JSON.stringify(graph, null, 2), 'utf8');
    return file;
}

/** Wait until the Theia shell is up AND keybindings are live (F1 opens the command palette). */
async function waitForShell(page: Page): Promise<void> {
    await page.waitForSelector('#theia-app-shell, .theia-app-main', { timeout: 45000 });
    await expect(page.locator('#theia-top-panel')).toBeVisible({ timeout: 30000 });
    await expect
        .poll(async () => {
            await page.keyboard.press('F1');
            try {
                await page.locator(QUICK_INPUT).first().waitFor({ state: 'visible', timeout: 2000 });
                return true;
            } catch {
                await page.keyboard.press('Escape');
                return false;
            }
        }, { timeout: 30000, intervals: [2000] })
        .toBe(true);
    await page.keyboard.press('Escape'); // leave a clean shell; openFbdFile re-opens the palette
}

/** Open a workspace file via File: Open File (quick open), retrying while the file index warms up. */
async function openFbdFile(page: Page, fileName: string): Promise<void> {
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
            await expect(page.locator('.fbd-editor-root')).toBeVisible({ timeout: 15000 });
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
    return page.locator('.fbd-toolbar button').filter({ hasText: new RegExp(`^${label}$`) });
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

/** Port-to-port connection: drag from a source handle to a target handle. */
async function connectHandles(page: Page, source: Locator, target: Locator): Promise<void> {
    const srcBox = await source.boundingBox();
    const tgtBox = await target.boundingBox();
    expect(srcBox, 'source handle must be visible').not.toBeNull();
    expect(tgtBox, 'target handle must be visible').not.toBeNull();
    const sx = srcBox!.x + srcBox!.width / 2;
    const sy = srcBox!.y + srcBox!.height / 2;
    const tx = tgtBox!.x + tgtBox!.width / 2;
    const ty = tgtBox!.y + tgtBox!.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 15 });
    await page.mouse.up();
}

test.beforeAll(() => {
    fs.mkdirSync(WORKSPACE, { recursive: true });
});

// ── F1: Open .fbd → canvas + FB block render ───────────────────────────────
// ── F1: Open .fbd → canvas + FB block render ───────────────────────────────

// ── F1: Open .fbd → canvas + FB block render ───────────────────────────────

test('F1 open .fbd file → canvas renders and TON FB block appears', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    writeFixture('openfb.fbd', tonGraph('openfb'));
    await openFbdFile(page, 'openfb.fbd');

    await expect(page.locator('.fbd-editor-root')).toBeVisible();
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.locator('.react-flow__node-fb-block')).toHaveCount(1);
    await expect(page.locator('.react-flow__node-fb-block')).toContainText('TON');

    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
});

// ── F2: Palette gate insertion ──────────────────────────────────────────────

test('F2 click AND gate tool then canvas → gate node appears', async ({ page }) => {
    writeFixture('addgate.fbd', emptyGraph('addgate'));
    await openFbdFile(page, 'addgate.fbd');

    await placeWithTool(page, 'AND');

    const gateNode = page.locator('.react-flow__node-fb-gate');
    await expect(gateNode).toHaveCount(1, { timeout: 10000 });
    await expect(gateNode.first()).toContainText('AND');
    // AND: IN1 + IN2 target handles, OUT source handle
    await expect(gateNode.first().locator('.react-flow__handle')).toHaveCount(3);
});

// ── F3: Palette FB insertion → TON with pin handles ────────────────────────

test('F3 insert TON block → FB node with pin handles renders', async ({ page }) => {
    writeFixture('addfb.fbd', emptyGraph('addfb'));
    await openFbdFile(page, 'addfb.fbd');

    await placeWithTool(page, 'TON', 0.5, 0.4);

    const fbNode = page.locator('.react-flow__node-fb-block');
    await expect(fbNode).toBeVisible({ timeout: 10000 });
    await expect(fbNode).toContainText('TON');
    // TON registry: IN/PT in, Q/ET out → 4 handles, id = pin name
    await expect(fbNode.locator('.react-flow__handle')).toHaveCount(4);
    await expect(fbNode.locator('.react-flow__handle[data-handleid="IN"]')).toBeVisible();
    await expect(fbNode.locator('.react-flow__handle[data-handleid="Q"]')).toBeVisible();
});

// ── F4: Port-to-port connection (drag output handle → input handle) ────────

test('F4 drag TON.Q to AND.IN1 → edge count +1', async ({ page }) => {
    writeFixture('connectfb.fbd', tonAndBare('connectfb'));
    await openFbdFile(page, 'connectfb.fbd');

    const edges = page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(0);

    await connectHandles(
        page,
        page.locator('.react-flow__node-fb-block [data-handleid="Q"]'),
        page.locator('.react-flow__node-fb-gate [data-handleid="IN1"]'),
    );

    await expect(edges).toHaveCount(1, { timeout: 10000 });
});

// ── F5: FB node drag → position moves (transform assertion, 20px grid) ─────

test('F5 drag FB node → position moves and snaps to 20px grid', async ({ page }) => {
    writeFixture('dragfb.fbd', tonGraph('dragfb'));
    await openFbdFile(page, 'dragfb.fbd');

    const node = page.locator('.react-flow__node-fb-block').first();
    await expect(node).toBeVisible();
    const before = await readTransform(node);

    await dragNodeBy(page, node, 100, 60);

    await expect
        .poll(async () => (await readTransform(node)).x, { timeout: 10000 })
        .not.toBe(before.x);

    const after = await readTransform(node);
    expect(after.x % 20).toBe(0);
    expect(after.y % 20).toBe(0);
});

// ── F6: Delete FB node → node removed + connected edges cascade-deleted ────

test('F6 delete FB node → node removed and connected edge cascade-deleted', async ({ page }) => {
    writeFixture('deletefb.fbd', tonAndWired('deletefb'));
    await openFbdFile(page, 'deletefb.fbd');

    const fbNode = page.locator('.react-flow__node-fb-block');
    await expect(fbNode).toHaveCount(1);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    await fbNode.first().click(); // select
    await page.keyboard.press('Delete');

    await expect(fbNode).toHaveCount(0, { timeout: 10000 });
    // the only edge (fb1.Q → g1.IN1) is cascade-removed; the AND gate survives
    await expect(page.locator('.react-flow__edge')).toHaveCount(0);
    await expect(page.locator('.react-flow__node-fb-gate')).toHaveCount(1);
});

// ── F7: Undo / Redo ────────────────────────────────────────────────────────

test('F7 undo removes the placed TON, redo restores it', async ({ page }) => {
    writeFixture('undofb.fbd', emptyGraph('undofb'));
    await openFbdFile(page, 'undofb.fbd');

    await placeWithTool(page, 'TON', 0.5, 0.4);
    const fbNode = page.locator('.react-flow__node-fb-block');
    await expect(fbNode).toHaveCount(1, { timeout: 10000 });

    await toolbarButton(page, 'Undo').click();
    await expect(fbNode).toHaveCount(0, { timeout: 10000 });

    await toolbarButton(page, 'Redo').click();
    await expect(fbNode).toHaveCount(1, { timeout: 10000 });
});

// ── F8: Save → file JSON updated (FbdGraph schema) ─────────────────────────

test('F8 save updates file JSON with an FbdGraph carrying the new node', async ({ page }) => {
    const file = path.join(WORKSPACE, 'savefb.fbd');
    writeFixture('savefb.fbd', emptyGraph('savefb'));
    await openFbdFile(page, 'savefb.fbd');

    await placeWithTool(page, 'TON', 0.5, 0.4);
    await expect(page.locator('.react-flow__node-fb-block')).toHaveCount(1, { timeout: 10000 });

    // Act: save (Saveable → FileService.writeFile)
    await page.keyboard.press('Meta+s');

    // Assert: file on disk now carries an FbdGraph (id/nodes/edges) with the FB
    await expect
        .poll(() => {
            try {
                const saved: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (typeof saved !== 'object' || saved === null) return false;
                const graph = saved as { id?: unknown; nodes?: unknown[]; edges?: unknown[] };
                return (
                    typeof graph.id === 'string' &&
                    Array.isArray(graph.nodes) &&
                    Array.isArray(graph.edges) &&
                    graph.nodes.some((n) => (n as { type?: string }).type === 'node:fb')
                );
            } catch {
                return false;
            }
        }, { timeout: 15000 })
        .toBe(true);
});

// ── F9: Load round-trip (save → close → reload → graph consistent) ─────────

test('F9 save/reload round-trip preserves TON + AND + wire', async ({ page }) => {
    const file = path.join(WORKSPACE, 'roundtrip.fbd');
    writeFixture('roundtrip.fbd', tonAndWired('roundtrip'));
    await openFbdFile(page, 'roundtrip.fbd');

    // Loaded fixture: TON + AND + 1 edge
    await expect(page.locator('.react-flow__node-fb-block')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('.react-flow__node-fb-gate')).toHaveCount(1);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // Save → close the editor tab → reopen from disk
    await page.keyboard.press('Meta+s');
    await expect
        .poll(() => {
            try {
                const saved: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
                const graph = saved as { nodes?: Array<{ type?: string }>; edges?: unknown[] };
                return graph.nodes?.some((n) => n.type === 'node:fb') === true && Array.isArray(graph.edges) && graph.edges.length === 1;
            } catch {
                return false;
            }
        }, { timeout: 15000 })
        .toBe(true);

    const tab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'roundtrip.fbd' }).first();
    await tab.hover();
    await tab.locator('.lm-TabBar-tabCloseIcon, .p-TabBar-tabCloseIcon').click();
    await expect(page.locator('.fbd-editor-root')).toHaveCount(0, { timeout: 10000 });

    await openFbdFile(page, 'roundtrip.fbd');
    await expect(page.locator('.react-flow__node-fb-block')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('.react-flow__node-fb-gate')).toHaveCount(1);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});

// ── F10: Multi-FB diagram (TON → AND wired through the UI) ─────────────────

test('F10 build TON → AND diagram: 2 nodes + wire between them', async ({ page }) => {
    writeFixture('multifb.fbd', emptyGraph('multifb'));
    await openFbdFile(page, 'multifb.fbd');

    await placeWithTool(page, 'TON', 0.3, 0.4);
    await expect(page.locator('.react-flow__node-fb-block')).toHaveCount(1, { timeout: 10000 });

    await placeWithTool(page, 'AND', 0.7, 0.4);
    await expect(page.locator('.react-flow__node-fb-gate')).toHaveCount(1, { timeout: 10000 });

    // Wire TON.Q → AND.IN1 (both BOOL — passes the handler type check)
    await connectHandles(
        page,
        page.locator('.react-flow__node-fb-block [data-handleid="Q"]'),
        page.locator('.react-flow__node-fb-gate [data-handleid="IN1"]'),
    );

    await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('.react-flow__node-fb-block')).toHaveCount(1);
    await expect(page.locator('.react-flow__node-fb-gate')).toHaveCount(1);
});
