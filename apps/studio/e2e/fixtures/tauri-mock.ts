// AUDESYS Studio — Tauri IPC mock for web-mode E2E testing
// Use this fixture when running Playwright against the Vite dev server
// instead of a full Tauri desktop app. All Tauri invoke() calls are intercepted.

import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      // Mock @tauri-apps/api/core invoke
      const mockInternals = {
        invoke: async (cmd: string, _args?: unknown) => {
          const mocks: Record<string, unknown> = {
            compile_st: '{"program":"__mock_program__","instructions":[]}',
            compile_il: '{"program":"__mock_program__","instructions":[]}',
            compile_ld: '{"program":"__mock_program__","instructions":[]}',
            compile_fbd: '{"program":"__mock_program__","instructions":[]}',
            compile_sfc: '{"program":"__mock_program__","instructions":[]}',
            run_program: JSON.stringify([
              { name: 'x', value: 42, pin_type: 'INT' },
              { name: 'y', value: 50, pin_type: 'INT' },
            ]),
            connect_controller: 'connected',
            disconnect_controller: 'disconnected',
            controller_signal_snapshot: JSON.stringify([['x', '42'], ['y', '50']]),
            fetch_controller_metrics: '# HELP cycles_total\ncycles_total 1234\n',
            controller_pause: 'paused',
            controller_resume: 'running',
            controller_step: 'stepped',
            controller_get_registers: JSON.stringify([['PC', '0x0042'], ['ACC', '42']]),
            controller_get_breakpoints: JSON.stringify([10, 20]),
            controller_add_breakpoint: null,
            controller_remove_breakpoint: null,
          };
          return mocks[cmd] ?? `mock:${cmd}`;
        },
      };
      // Set on both window and Object.defineProperty for robustness
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = mockInternals;
      Object.defineProperty(window, '__TAURI_INTERNALS__', { value: mockInternals, writable: true, configurable: true });

      // Mock @tauri-apps/plugin-dialog
      (window as unknown as Record<string, unknown>).__TAURI_PLUGIN_DIALOG__ = {
        open: async () => '/mock/path/test.st',
        save: async () => '/mock/path/saved.st',
      };

      // Mock @tauri-apps/plugin-fs
      (window as unknown as Record<string, unknown>).__TAURI_PLUGIN_FS__ = {
        readTextFile: async (_path: string) =>
          'PROGRAM mock\nVAR\n  a : INT;\nEND_VAR\na := 1;\nEND_PROGRAM',
        writeTextFile: async () => {},
      };
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
