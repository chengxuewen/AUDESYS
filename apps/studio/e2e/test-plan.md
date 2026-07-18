# AUDESYS Studio — Playwright E2E Test Plan

> **Target:** AUDESYS Studio Tauri desktop application (React + TypeScript + CodeMirror 6 webview)
> **Framework:** Playwright (WebDriver protocol via tauri-driver)
> **Last updated:** 2026-07-18

---

## 1. Tauri E2E Setup (tauri-driver + Playwright)

Tauri v2 desktop apps cannot be launched in a headless browser. Instead, use `tauri-driver`, which exposes a WebDriver-compatible HTTP endpoint that Playwright can connect to.

### 1.1 Prerequisites

```bash
# Install tauri-driver (WebDriver server for Tauri)
cargo install tauri-driver

# Playwright (in studio project)
cd apps/studio
npm install -D @playwright/test
```

### 1.2 Playwright Config

Create `apps/studio/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    // tauri-driver listens on localhost:4444 by default
    // Playwright connects to it as a remote WebDriver
    browserName: 'chromium',
    // Connect to tauri-driver instead of launching its own browser
    connectOptions: {
      wsEndpoint: 'ws://localhost:4444',
    },
  },
});
```

### 1.3 Running Tests

```bash
# Terminal 1: Build and start the Tauri dev server with WebDriver
cd apps/studio
cargo tauri dev -- --remote-debugging-port=9222 &

# Terminal 2: Start tauri-driver
tauri-driver --port 4444 --native-host 127.0.0.1 &

# Terminal 3: Run Playwright tests
npx playwright test
```

### 1.4 Alternative: Tauri as Web App (Simpler CI Path)

If tauri-driver setup is too heavy for CI, build the Studio as a plain web app without Tauri IPC:

```bash
# Vite dev server — serves the React webview directly without Tauri shell
cd apps/studio
npx vite --port 5173
```

Then use standard Playwright `chromium.launch()` pointing at `http://localhost:5173`. Tauri IPC calls (`invoke("compile_st", ...)`) will fail, so mock them via `page.route()` or `window.__TAURI_INTERNALS__` stubs. This is the **recommended approach for CI** since no native Rust binary is needed.

### 1.5 Mocking Tauri IPC in Web Mode

```ts
// e2e/fixtures/tauri-mock.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Intercept Tauri IPC and return mock responses
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: any) => {
          const mocks: Record<string, any> = {
            compile_st: JSON.stringify({ program: 'mock', instructions: [] }),
            compile_il: JSON.stringify({ program: 'mock', instructions: [] }),
            compile_ld: JSON.stringify({ program: 'mock', instructions: [] }),
            run_program: JSON.stringify([
              { name: 'x', value: 42, pin_type: 'INT' },
              { name: 'y', value: 50, pin_type: 'INT' },
            ]),
            connect_controller: 'connected',
            disconnect_controller: 'disconnected',
            controller_signal_snapshot: [['x', '42'], ['y', '50']],
            fetch_controller_metrics: '# HELP cycles_total\ncycles_total 1234\n',
            controller_pause: 'paused',
            controller_resume: 'running',
            controller_step: 'stepped',
            controller_get_registers: [['PC', '0x0042'], ['ACC', '42']],
            controller_get_breakpoints: '[10, 20]',
            controller_add_breakpoint: null,
            controller_remove_breakpoint: null,
          };
          return mocks[cmd] ?? `mock:${cmd}`;
        },
      };
    });
    await use(page);
  },
});
```

---

## 2. Test Scenarios

### TC-01: Studio Opens with Default ST Source in Editor

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Navigate to Studio | App loads without error | `.app-root` is visible |
| 2 | Observe editor area | Editor header shows "ST Source Editor" | `.app-panel__header` contains "ST Source Editor" |
| 3 | Observe editor content | Default ST program visible (`PROGRAM test\nVAR\n  x : INT; ...`) | `.cm-content` contains "PROGRAM test" |
| 4 | Observe toolbar | "New", "Open", "Save" buttons visible | `.fo-btn` count = 3 |
| 5 | Observe toolbar actions | "Compile & Run" button visible and enabled | `button:has-text("Compile & Run"):not([disabled])` |
| 6 | Observe status bar | Shows "Ready", "Ln 1, Col 1", "untitled.st" | `.status-bar` contains "Ready" |

### TC-02: Compile & Run — Success Path (Signal Output Table)

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Navigate to Studio | Default ST source loaded | `.cm-content` contains "PROGRAM test" |
| 2 | Click "Compile & Run" | Button text changes to "Compiling..." and becomes disabled | `button:has-text("Compiling..."):disabled` |
| 3 | Wait for compilation | Signal output table appears | `.app-signal-table` is visible |
| 4 | Verify table headers | "Signal Name", "Value", "Type" columns present | `.app-signal-table__th` count = 3 |
| 5 | Verify signal rows | `x` = 42 (INT), `y` = 50 (INT) | `.app-signal-table__tr` count >= 2 |
| 6 | Verify status bar | Shows "Success" | `.status-bar__status--success` contains "Success" |
| 7 | Verify button reset | Button reverts to "Compile & Run" (enabled) | `button:has-text("Compile & Run"):not([disabled])` |

### TC-03: Compile & Run — Error Path (Syntax Error Diagnostics)

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Clear editor and type invalid ST (`x := ;`) | Editor shows malformed code | `.cm-content` |
| 2 | Click "Compile & Run" | Status bar shows "Error" | `.status-bar__status--error` |
| 3 | Observe error panel | Error panel expands and shows error count | `.error-panel__label--has-errors` is visible |
| 4 | Verify error items | At least one error item with severity "error" | `.error-panel__item--error` count >= 1 |
| 5 | Verify error location | Shows line and column | `.error-panel__item-location` contains "Ln N, Col N" |
| 6 | Click error item | Editor cursor jumps to error location | `.cm-cursor` position changes |
| 7 | Verify signal table | "Compile an ST program..." placeholder shown | `.app-panel__empty` contains "Compile an ST program" |

### TC-04: Language Mode Toggle (ST → IL → LD → ST)

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Observe initial mode | Toggle button shows "ST" | `button:has-text("ST")` (monospace font in toolbar) |
| 2 | Click toggle button | Button now shows "IL" | `button:has-text("IL")` |
| 3 | Click toggle button again | Button now shows "LD" | `button:has-text("LD")` |
| 4 | Click toggle button again | Button shows "ST" (cycled back) | `button:has-text("ST")` |

Note: In mock mode, invoke will call `compile_il` / `compile_ld` / `compile_st` depending on mode.

### TC-05: File Operations — Open File Dialog

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Click "Open" button | Tauri file dialog opens (or mock returns path) | `.fo-btn:has-text("Open")` |
| 2 | Select a `.st` file | Editor loads file content | `.cm-content` contains the file content |
| 3 | Observe status bar | Shows filename (not "untitled.st") | `.status-bar__file` shows selected filename |
| 4 | Observe toolbar | Current filename displayed | `.file-operations__name` shows filename |

Note: For web mock mode, stub `@tauri-apps/plugin-dialog` `open()` to return a path and `readTextFile()` to return content. In Playwright, use `page.evaluate()` to mock these before clicking.

### TC-06: File Operations — New File

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Load a file (TC-05) | Status shows filename | `.status-bar__file` not "untitled.st" |
| 2 | Click "New" button | Editor clears, status shows "untitled.st" | `.cm-content` is empty (or has lang defaults) |
| 3 | Observe error panel | Cleared (no errors) | `.error-panel__label` contains "No errors" |
| 4 | Observe signal table | Cleared (placeholder shown) | `.app-panel__empty` contains "Compile an ST program" |
| 5 | Observe status bar | Shows "Ready" | `.status-bar__status--ready` |

### TC-07: File Operations — Save File

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Load a file | Current file is set | Status shows filename |
| 2 | Modify source in editor | Content changed | `.cm-content` shows new content |
| 3 | Click "Save" | File saved (no dialog if `currentFile` is set) | `.fo-btn:has-text("Save")` |
| 4 | Verify no error | Status stays "Ready" | `.status-bar__status--ready` |

Note: When `currentFile` is null, clicking "Save" triggers Tauri `save()` dialog. Mock `@tauri-apps/plugin-dialog` `save()` for this case.

### TC-08: Error Panel Collapse/Expand

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Trigger a compile error (TC-03) | Error panel shows errors | `.error-panel__item--error` visible |
| 2 | Click error panel header | Panel collapses, error list hidden | `.error-panel--collapsed` class present on `.error-panel` |
| 3 | Click header again | Panel expands, error list visible | `.error-panel--collapsed` absent<br>`.error-panel__list` visible |

### TC-09: Debug Panel — Connect Button Visible

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Navigate to Studio | Debug panel visible in output area | `.debug-panel` is visible |
| 2 | Observe header | "Debug" header shown | `.app-panel__header` within `.debug-panel` contains "Debug" |
| 3 | Observe connect form | Socket path input, secret input, "Connect" button visible | `.debug-panel__connect` > `input[placeholder="Socket path"]`<br>`.debug-panel__connect` > `input[placeholder="Secret"]`<br>`button:has-text("Connect")` |
| 4 | Fill socket path | Input accepts text | Type into `[placeholder="Socket path"]` |
| 5 | Click "Connect" | Status changes to "connected" (with mock) | `.debug-panel__status` contains "connected" |

### TC-10: Signal Monitor — Start/Stop Button

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Navigate to Studio | Signal Monitor panel visible | Div with header "Signal Monitor" |
| 2 | Observe idle state | "○ Idle" shown in header; "Start" button visible | `button:has-text("Start")` |
| 3 | Click "Start" | Polling begins, header shows "● Live (N)" | `button:has-text("Stop")`<br>Header contains "● Live" |
| 4 | Wait for first poll (~500ms) | Signal table appears with rows | `.app-signal-table` within Signal Monitor visible |
| 5 | Click "Stop" | Polling stops, header shows "○ Idle" | `button:has-text("Start")` |

### TC-11: Compile & Run Button — Disabled States

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | Clear editor to empty | "Compile & Run" button disabled | `button:has-text("Compile & Run"):disabled` |
| 2 | Type valid source | Button becomes enabled | `button:has-text("Compile & Run"):not([disabled])` |
| 3 | Click "Compile & Run" | Button shows "Compiling..." and is disabled | `button:has-text("Compiling..."):disabled` |

### TC-12: Status Bar Reflects All States

| Step | Action | Expected Result | CSS Selector Hint |
|------|--------|-----------------|-------------------|
| 1 | On load | "Ready" status | `.status-bar__status--ready` |
| 2 | After successful compile | "Success" status | `.status-bar__status--success` |
| 3 | After compile error | "Error" status | `.status-bar__status--error` |
| 4 | Observe cursor position | "Ln N, Col M" updates on cursor move | `.status-bar__cursor` |
| 5 | Open a file (TC-05) | File name shown (not "untitled.st") | `.status-bar__file` |

---

## 3. Selector Reference (from Actual Components)

| UI Element | Preferred Selector |
|------------|-------------------|
| App root | `.app-root` |
| Toolbar | `.app-toolbar` |
| Toolbar actions (right side) | `.app-toolbar__actions` |
| New button | `.fo-btn:has-text("New")` |
| Open button | `.fo-btn:has-text("Open")` |
| Save button | `.fo-btn:has-text("Save")` |
| Compile & Run button | `.app-toolbar__actions button:has-text("Compile & Run")` |
| Language toggle button | `.app-toolbar__actions button` (the monospace one) |
| File name display | `.file-operations__name` |
| Editor panel | `.app-panel--editor` |
| Editor header | `.app-panel--editor .app-panel__header` |
| CodeMirror content | `.cm-content` |
| CodeMirror editor container | `.cm-editor` |
| Output panel | `.app-panel--output` (no dedicated class, uses `.app-panel` with signal table) |
| Signal output table | `.app-signal-table` |
| Signal table headers | `.app-signal-table__th` |
| Signal table rows | `.app-signal-table__tr` |
| Empty state placeholder | `.app-panel__empty` |
| Error panel | `.error-panel` |
| Error panel header/button | `.error-panel__header` |
| Error item (error severity) | `.error-panel__item--error` |
| Error item (warning severity) | `.error-panel__item--warning` |
| Error location text | `.error-panel__item-location` |
| Error message text | `.error-panel__item-message` |
| Debug panel | `.debug-panel` (first occurrence) |
| Debug connect inputs | `.debug-panel__connect input` |
| Debug Connect button | `.debug-panel__connect button:has-text("Connect")` |
| Debug status text | `.debug-panel__status` |
| Signal Monitor | `.debug-panel` containing "Signal Monitor" header |
| Signal Monitor Start | `button:has-text("Start")` |
| Signal Monitor Stop | `button:has-text("Stop")` |
| Status bar | `.status-bar` |
| Status bar cursor | `.status-bar__cursor` |
| Status bar state dot | `.status-bar__dot` |
| Status bar file | `.status-bar__file` |
| Observable panel | Component containing "Observability" header |

---

## 4. Mock IPC Command Map

For web-mode testing, configure these mock responses in `addInitScript()` or `page.route()`:

| Tauri Command (`invoke` arg) | Mock Return | Used In |
|------------------------------|-------------|---------|
| `compile_st` | `'{"program":"...","instructions":[]}'` | TC-02, TC-03 |
| `compile_il` | `'{"program":"...","instructions":[]}'` | TC-04 |
| `compile_ld` | `'{"program":"...","instructions":[]}'` | TC-04 |
| `run_program` | `'[{"name":"x","value":42,"pin_type":"INT"},{"name":"y","value":50,"pin_type":"INT"}]'` | TC-02 |
| `connect_controller` | `'connected'` | TC-09 |
| `disconnect_controller` | `'disconnected'` | TC-09 |
| `controller_signal_snapshot` | `'[["x","42"],["y","50"]]'` | TC-10 |
| `fetch_controller_metrics` | `'# HELP cycles_total\ncycles_total 1234\n'` | — |
| `controller_pause` | `'paused'` | — |
| `controller_resume` | `'running'` | — |
| `controller_step` | `'stepped'` | — |
| `controller_get_registers` | `'[["PC","0x0042"],["ACC","42"]]'` | — |
| `controller_get_breakpoints` | `'[10,20]'` | — |
| `controller_add_breakpoint` | `null` | — |
| `controller_remove_breakpoint` | `null` | — |

**Error mock** (for TC-03): Have `compile_st` throw: `"parse error: unexpected token at line 3, col 5"`

### Tauri Plugin Dialog Mocks

For file open/save operations, mock `@tauri-apps/plugin-dialog`:

```ts
await page.addInitScript(() => {
  // Mock dialog plugin
  (window as any).__TAURI_PLUGIN_DIALOG__ = {
    open: async () => '/mock/path/test.st',
    save: async () => '/mock/path/saved.st',
  };
  // Mock fs plugin
  (window as any).__TAURI_PLUGIN_FS__ = {
    readTextFile: async (path: string) => 'PROGRAM mock\nVAR\n  a : INT;\nEND_VAR\na := 1;\nEND_PROGRAM',
    writeTextFile: async () => {},
  };
});
```

---

## 5. Test File Structure

```
apps/studio/e2e/
├── test-plan.md          # This file
├── fixtures/
│   └── tauri-mock.ts     # Shared IPC mock setup
├── editor.spec.ts        # TC-01, TC-02, TC-03, TC-04, TC-11
├── file-ops.spec.ts      # TC-05, TC-06, TC-07
├── panels.spec.ts        # TC-08, TC-09, TC-10
└── status-bar.spec.ts    # TC-12
```
