# AUDESYS Studio — Plugin Host Security Configuration

**Phase 1: Zero Third-Party Extensions**

## Plugin Host Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| `autoDownload` | `false` | Disables automatic extension download from any marketplace |
| `marketplace` | `[]` | Empty whitelist — no extension marketplaces configured |
| `theiaPlugins` | `{}` | No bundled plugins declared in package.json |

All extension loading is disabled at the Theia Plugin Host level. No third-party
code can enter the plugin process, regardless of how it is packaged or obtained.

## Electron Security (Theia Defaults)

Theia 1.73.0 applies these defaults for Electron `webPreferences`. AUDESYS
keeps them at their secure defaults, no relaxation:

| Setting | Value | Notes |
|---------|-------|-------|
| `contextIsolation` | `true` | Prevents renderer access to Node.js globals and Electron internals |
| `nodeIntegration` | `false` | No `require()` or Node.js APIs in renderer |
| `nodeIntegrationInWorker` | `false` | Same for web workers |
| `sandbox` | `true` | OS-level sandbox for renderer processes (macOS + Linux) |
| `webSecurity` | `true` | Enforces same-origin policy, prevents mixed content |

These are configured in `package.json` → `theia.frontend.config.electron.windowOptions.webPreferences`.

## macOS Hardened Runtime

The `electron-builder.yml` enables `hardenedRuntime: true` with custom
entitlements for notarization. This is additional enforcement beyond the
Electron security defaults above.

## What Is NOT Present

- **No `@theia/vsx-registry` dependency** — the VSX registry extension is not installed, so the Studio cannot browse or install extensions from Open VSX.
- **No marketplace URLs** — no remote extension source is configured.
- **No bundled extensions** — `theiaPlugins` is empty, `theiaPluginsDir` points to an empty directory.

## Phase 2 Whitelist Process (Future)

When AUDESYS moves to Phase 2 and needs sanctioned extensions:

1. Specific extension IDs are added to `theiaPlugins` in `package.json`.
2. Extensions are placed in the `theia-plugins/` directory under version control.
3. Extension source is audited: no network access, no `child_process`, no native modules without review.
4. `autoDownload` stays `false` — all extensions are manually curated.
5. If a private marketplace is needed, a single trusted URL is added to `marketplace[]`.
