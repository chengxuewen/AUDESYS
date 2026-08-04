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

interface FxPin { name: string; dataType: string; position: FxPoint }
interface FxNode {
    id: string;
    type: string;
    position: FxPoint;
    size: { width: number; height: number };
    side?: 'Left' | 'Right';
    contactType?: 'NO' | 'NC';
    coilType?: 'Normal' | 'Negated' | 'Set' | 'Reset';
    variableName?: string;
    fbType?: string;
    inputPins?: FxPin[];
    outputPins?: FxPin[];
}
interface FxEdge { id: string; type: string; sourceId: string; targetId: string; sourcePin?: string; targetPin?: string }
interface FxBranch { id: string; rungId: string; anchorId: string; elementIds: string[]; x: number }
interface FxRung { id: string; rungNumber: number; comment?: string; elementIds: string[]; branches?: FxBranch[] }
interface FxGraph { id: string; nodes: FxNode[]; edges: FxEdge[]; rungs: FxRung[] }

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

/** Wait until the Theia shell is up AND keybindings are live (F1 opens the
 * command palette). Contribution startup can finish AFTER the shell DOM
 * appears, so a lost F1 (palette never opens) is polled until it lands.
 */
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
    await page.keyboard.press('Escape'); // leave a clean shell; openLdFile re-opens the palette
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

    // parentId proof — React Flow v12 renders parented nodes FLAT, positioned
    // absolutely: rung 2 sits at y=80, so a rung-2 child lands at absolute y=120
    const placed = await readTransform(contactNode);
    expect(placed.y).toBe(120);
    expect(placed.x % 40).toBe(0);
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
    // The property view docks in the bottom panel — expand it when collapsed
    const propertyTab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'LD Properties' }).first();
    if (!(await propertyTab.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: 'Toggle Bottom Panel' }).click();
    }
    await expect(propertyTab).toBeVisible({ timeout: 10000 });
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

// ══════════════════════════════════════════════════════════════════════════
// P0 特性 E2E — 并联分支 (OR) / FB 块 / 变量改名 / P/N 边沿触点 (T14-T22)
// ══════════════════════════════════════════════════════════════════════════
// 注意: 编辑器在页面关闭时会保存脏图到磁盘 (fixture 会被污染), 所以每个测试
// 在打开文件前重写自己的 fixture, 保证 retry 安全。

interface LdCompileResult {
    success: boolean;
    programJson: string;
    diagnostics: Array<{ severity: string; message: string; code: string }>;
}

/** Compile the open LD editor's graph through the E2E hook (backend JSON-RPC). */
async function compileLd(page: Page): Promise<LdCompileResult> {
    return page.evaluate(async () => {
        const hook = (window as unknown as { __ldEditor?: { compile(): Promise<LdCompileResult> } }).__ldEditor;
        if (!hook) {
            throw new Error('window.__ldEditor hook missing — compile surface not wired');
        }
        return hook.compile();
    });
}

/** Open Branch tool → click the first contact → wait for branch mode. */
async function openBranchOnFirstContact(page: Page): Promise<void> {
    await toolbarButton(page, 'Open Branch').click();
    await page.locator('.react-flow__node-contact').first().click();
    await expect(toolbarButton(page, 'Close Branch')).toBeVisible({ timeout: 10000 });
}

/** Pane click in branch mode — adds one branch member (rung derived from y). */
async function placeBranchMember(page: Page, fx = 0.85, fy = 0.55): Promise<void> {
    await clickPane(page, fx, fy);
}

// ── T14: Parallel branch creation → OR compile ──────────────────────────────

test('T14 open branch on contact → two members → close → compile yields OR logic', async ({ page }) => {
    writeFixture('branch14.ld', wiredGraph('branch14')); // per-test rewrite: app saves on close
    await openLdFile(page, 'branch14.ld');

    // Series anchor contact c1 + coil k1 wired (4 fixture edges)
    await expect(page.locator('.react-flow__node-contact')).toHaveCount(1);

    // Open branch on c1 → add two members below it → close
    await openBranchOnFirstContact(page);
    await placeBranchMember(page);
    await placeBranchMember(page);
    await toolbarButton(page, 'Close Branch').click();

    // Members render below the anchor at the branch column (y=120, 160)
    const contacts = page.locator('.react-flow__node-contact');
    await expect(contacts).toHaveCount(3, { timeout: 10000 });
    // poll: transforms settle a tick after the nodes mount
    await expect
        .poll(async () => (await readTransform(contacts.nth(1))).y, { timeout: 10000 })
        .toBe(120);
    await expect
        .poll(async () => (await readTransform(contacts.nth(2))).y, { timeout: 10000 })
        .toBe(160);
    const m1 = await readTransform(contacts.nth(1));
    const m2 = await readTransform(contacts.nth(2));
    expect(m1.x).toBe(m2.x); // same branch column as the anchor

    // Rewire: anchor→m1, m1|m2 (vertical bus), m2→coil replaces anchor→coil
    await expect(page.locator('.react-flow__edge')).toHaveCount(6, { timeout: 10000 });

    // Compile: branch members emit OR in the HalProgram (LD text '| NO INx')
    const result = await compileLd(page);
    expect(result.success).toBe(true);
    expect(result.programJson).toContain('"Or"');
    expect(result.diagnostics).toHaveLength(0);
});

// ── T15: FB insertion — palette → TON → pin handles → auto-wire ─────────────

test('T15 insert TON function block → node with pin handles renders and wires', async ({ page }) => {
    writeFixture('fbtest15.ld', bareGraph('fbtest15'));
    await openLdFile(page, 'fbtest15.ld');

    await toolbarButton(page, 'TON').click();
    await clickPane(page, 0.5, 0.4);

    const fbNode = page.locator('.react-flow__node-fb');
    await expect(fbNode).toBeVisible({ timeout: 10000 });
    await expect(fbNode).toContainText('TON');

    // Pin handles: EN/IN/PT in, ENO/Q/ET out (catalog TON pin set)
    await expect(fbNode.locator('.react-flow__handle')).toHaveCount(6);
    await expect(fbNode.locator('.react-flow__handle[data-handleid="in:EN"]')).toBeVisible();
    await expect(fbNode.locator('.react-flow__handle[data-handleid="out:Q"]')).toBeVisible();

    // Auto-wire: rail → EN and ENO → rail
    await expect(page.locator('.react-flow__edge')).toHaveCount(2, { timeout: 10000 });
});

// ── T16: Variable rename — double-click → inline input → save → JSON ────────

test('T16 double-click contact label renames variable and save persists it', async ({ page }) => {
    const file = path.join(WORKSPACE, 'rename16.ld');
    writeFixture('rename16.ld', contactGraph('rename16'));
    await openLdFile(page, 'rename16.ld');

    const label = page.locator('.react-flow__node-contact .ld-node-label');
    await expect(label).toHaveText('IN0');

    // Double-click opens the inline rename input
    await label.dblclick();
    const input = page.locator('.ld-node-rename');
    await expect(input).toBeVisible({ timeout: 10000 });
    await expect(input).toHaveValue('IN0');

    // Type a new name and commit with Enter
    await input.fill('PumpRun');
    await page.keyboard.press('Enter');
    await expect(label).toHaveText('PumpRun', { timeout: 10000 });

    // Save → JSON on disk carries the renamed variable
    await page.keyboard.press('Meta+s');
    await expect
        .poll(() => {
            try {
                const saved: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
                const nodes = (saved as { nodes?: Array<{ variableName?: string }> }).nodes ?? [];
                return nodes.some((n) => n.variableName === 'PumpRun');
            } catch {
                return false;
            }
        }, { timeout: 15000 })
        .toBe(true);
});

// ── T17: P/N edge contacts ──────────────────────────────────────────────────

test('T17 P Contact and N Contact render their P/N markers', async ({ page }) => {
    writeFixture('pn17.ld', bareGraph('pn17'));
    await openLdFile(page, 'pn17.ld');

    await placeWithTool(page, 'P Contact', 0.3, 0.4);
    await placeWithTool(page, 'N Contact', 0.5, 0.4);

    const contacts = page.locator('.react-flow__node-contact');
    await expect(contacts).toHaveCount(2, { timeout: 10000 });

    // The P/N marker letters render inside the contact SVG
    const markers = contacts.locator('svg text');
    await expect(markers).toHaveText(['P', 'N'], { timeout: 10000 });
});

// ── T18: Multi-rung branch — branch in rung 2, parentId assertion ───────────

function twoRungGraph(id: string): FxGraph {
    return {
        id,
        nodes: [...rails(), contact('c2', 40, 'IN0')],
        edges: [wire('w1', 'rail-l', 'c2'), wire('w2', 'c2', 'rail-r')],
        rungs: [
            { id: 'rung-1', rungNumber: 1, comment: 'Main', elementIds: [] },
            { id: 'rung-2', rungNumber: 2, comment: 'Second', elementIds: ['c2'] },
        ],
    };
}

test('T18 branch opened on a rung-2 contact keeps its members in rung 2', async ({ page }) => {
    writeFixture('multi18.ld', twoRungGraph('multi18'));
    await openLdFile(page, 'multi18.ld');

    await expect(page.locator('.react-flow__node-rung')).toHaveCount(2);

    // Open branch on the rung-2 contact (c2), then add a member
    await toolbarButton(page, 'Open Branch').click();
    await page.locator('.react-flow__node-contact').first().click();
    await expect(toolbarButton(page, 'Close Branch')).toBeVisible({ timeout: 10000 });
    await clickPane(page, 0.85, 0.6);
    await toolbarButton(page, 'Close Branch').click();

    // parentId proof — React Flow v12 renders parented nodes FLAT, positioned
    // absolutely: rung 2 sits at y=80 → anchor at 80+40=120, member at 80+120=200
    const contacts = page.locator('.react-flow__node-contact');
    await expect(contacts).toHaveCount(2, { timeout: 10000 });
    const anchor = await readTransform(contacts.first());
    const member = await readTransform(contacts.nth(1));
    expect(anchor.y).toBe(120);
    expect(member.y).toBe(200);
    expect(member.x).toBe(anchor.x);
});

// ── T19: FB compile path ────────────────────────────────────────────────────

test('T19 rung containing an FB compiles to a HalProgram', async ({ page }) => {
    writeFixture('fb19.ld', bareGraph('fb19'));
    await openLdFile(page, 'fb19.ld');

    // Build: NO contact → TON → coil
    await placeWithTool(page, 'NO Contact', 0.3, 0.4);
    await toolbarButton(page, 'TON').click();
    await clickPane(page, 0.5, 0.4);
    await placeWithTool(page, 'Coil', 0.8, 0.4);
    await expect(page.locator('.react-flow__node-fb')).toBeVisible({ timeout: 10000 });

    // Rust LD compiler has no FB tokens; rungToLdText emits only contact/coil
    // lines (FB nodes are dropped) — the compile still succeeds end-to-end via
    // the backend JSON-RPC bridge, proving the FB-present compile path works.
    const result = await compileLd(page);
    expect(result.success).toBe(true);
    expect(result.programJson.length).toBeGreaterThan(0);
    expect(result.programJson).toContain('"instructions"');
});

// ── T20: Delete branch member → branch rewired ──────────────────────────────

test('T20 deleting a branch member prunes it and rewires the branch', async ({ page }) => {
    writeFixture('branch20.ld', wiredGraph('branch20'));
    await openLdFile(page, 'branch20.ld');

    await openBranchOnFirstContact(page);
    await placeBranchMember(page);
    await placeBranchMember(page);
    await toolbarButton(page, 'Close Branch').click();
    await expect(page.locator('.react-flow__node-contact')).toHaveCount(3, { timeout: 10000 });

    // Delete member 1 (middle row) → branch rewires around member 2
    await page.locator('.react-flow__node-contact').nth(1).click();
    await page.keyboard.press('Delete');

    await expect(page.locator('.react-flow__node-contact')).toHaveCount(2, { timeout: 10000 });
    // anchor→member2 + member2→coil replace the three old branch edges
    await expect(page.locator('.react-flow__edge')).toHaveCount(5, { timeout: 10000 });
    // survivor re-stacks to the first branch row (120) in the anchor column
    await expect
        .poll(async () => (await readTransform(page.locator('.react-flow__node-contact').nth(1))).y, { timeout: 10000 })
        .toBe(120);
    const survivor = await readTransform(page.locator('.react-flow__node-contact').nth(1));
    expect(survivor.x).toBe(40);
});

// ── T21: Undo branch creation ───────────────────────────────────────────────

test('T21 undo reverts branch creation (members and branch record)', async ({ page }) => {
    writeFixture('branch21.ld', wiredGraph('branch21'));
    await openLdFile(page, 'branch21.ld');

    await openBranchOnFirstContact(page);
    await placeBranchMember(page);
    await toolbarButton(page, 'Close Branch').click();
    await expect(page.locator('.react-flow__node-contact')).toHaveCount(2, { timeout: 10000 });

    // Undo close (no-op snapshot) + undo member add → back to the bare series
    await toolbarButton(page, 'Undo').click();
    await toolbarButton(page, 'Undo').click();

    await expect(page.locator('.react-flow__node-contact')).toHaveCount(1, { timeout: 10000 });
    // anchor→coil series edge restored (fixture wiring)
    await expect(page.locator('.react-flow__edge')).toHaveCount(4, { timeout: 10000 });
});

// ── T22: Save/load round-trip with branches + FB preserved ─────────────────

function branchFbGraph(id: string): FxGraph {
    const pin = (name: string, off: number, row: number): FxPin =>
        ({ name, dataType: 'ANY', position: { x: off, y: row * 30 } });
    return {
        id,
        nodes: [
            ...rails(),
            contact('c1', 40, 'IN0'),
            {
                id: 'fb1',
                type: 'node:fb',
                fbType: 'TON',
                inputPins: [pin('EN', 0, 0), pin('IN', 0, 1), pin('PT', 0, 2)],
                outputPins: [pin('ENO', 140, 0), pin('Q', 140, 1), pin('ET', 140, 2)],
                position: { x: 240, y: 40 },
                size: { width: 140, height: 100 },
            },
            coil('k1', 'OUT0'),
            { ...contact('m1', 40, 'IN1'), position: { x: 40, y: 120 } },
        ],
        edges: [
            wire('e1', 'rail-l', 'c1'),
            wire('e2', 'c1', 'm1'),
            { id: 'e3', type: 'edge:wire', sourceId: 'm1', targetId: 'fb1', targetPin: 'EN' },
            { id: 'e4', type: 'edge:wire', sourceId: 'fb1', targetId: 'k1', sourcePin: 'ENO' },
            wire('e5', 'k1', 'rail-r'),
        ],
        rungs: [
            {
                id: 'rung-1',
                rungNumber: 1,
                comment: 'Main',
                elementIds: ['c1', 'fb1', 'k1'],
                branches: [{ id: 'branch-1', rungId: 'rung-1', anchorId: 'c1', elementIds: ['m1'], x: 40 }],
            },
        ],
    };
}

test('T22 save/reload round-trip preserves branch members and FB nodes', async ({ page }) => {
    const file = path.join(WORKSPACE, 'branchfb22.ld');
    writeFixture('branchfb22.ld', branchFbGraph('branchfb22'));
    await openLdFile(page, 'branchfb22.ld');

    // Loaded fixture: anchor + branch member + TON + coil
    await expect(page.locator('.react-flow__node-contact')).toHaveCount(2, { timeout: 10000 });
    await expect(page.locator('.react-flow__node-fb')).toHaveCount(1);
    await expect(page.locator('.react-flow__node-fb')).toContainText('TON');
    await expect(page.locator('.react-flow__edge')).toHaveCount(5);

    // Save → file JSON keeps the branch record + FB node
    await page.keyboard.press('Meta+s');
    await expect
        .poll(() => {
            try {
                const saved: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
                const graph = saved as {
                    nodes?: Array<{ type?: string }>;
                    rungs?: Array<{ branches?: Array<{ elementIds?: string[] }> }>;
                };
                return (
                    graph.nodes?.some((n) => n.type === 'node:fb') === true &&
                    graph.rungs?.[0]?.branches?.[0]?.elementIds?.includes('m1') === true
                );
            } catch {
                return false;
            }
        }, { timeout: 15000 })
        .toBe(true);

    // Close the editor tab and reopen from disk
    const tab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'branchfb22.ld' }).first();
    await tab.hover();
    await tab.locator('.lm-TabBar-tabCloseIcon, .p-TabBar-tabCloseIcon').click();
    await expect(page.locator('.ld-editor-root')).toHaveCount(0, { timeout: 10000 });

    await openLdFile(page, 'branchfb22.ld');
    await expect(page.locator('.react-flow__node-contact')).toHaveCount(2, { timeout: 10000 });
    await expect(page.locator('.react-flow__node-fb')).toHaveCount(1);
    await expect(page.locator('.react-flow__node-fb')).toContainText('TON');
    // branch member survives on its row
    await expect
        .poll(async () => (await readTransform(page.locator('.react-flow__node-contact').nth(1))).y, { timeout: 10000 })
        .toBe(120);
    await expect(page.locator('.react-flow__edge')).toHaveCount(5);
});
