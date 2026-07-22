# T4.4 Performance Benchmarks Report

**Date:** 2026-07-21  
**Scope:** Theia migration metrics — napi-rs bridge latency, build sizes, test coverage, compile status

---

## 1. napi-rs Bridge Latency

Benchmarked with Node.js `process.hrtime.bigint()`, 1000 iterations per function, warmup 10 calls.
Platform: macOS (darwin-x64), Node.js native addon.

| Function | avg (µs) | p50 (µs) | p95 (µs) | p99 (µs) |
|---|---|---|---|---|
| healthQuery | 5.69 | 2.47 | 8.27 | 45.36 |
| signalSnapshot (string) | 5.07 | 2.44 | 7.51 | 17.24 |
| compileSt (ST source) | 8.69 | 6.25 | 11.08 | 15.78 |
| readSignal (string) | 4.27 | 2.98 | 7.43 | 10.49 |
| simCreate+simDestroy | 3.83 | 2.53 | 6.91 | 13.37 |
| openProject (empty) | 4.61 | 2.17 | 6.99 | 17.94 |

**Key findings:**
- All napi-rs calls are single-digit microseconds at p50, well within the <50µs UDS IPC budget
- ST compilation (compileSt) is the heaviest at ~9µs avg due to parsing + IR generation
- healthQuery shows p99 spike (45µs) — first call in iteration batch likely hits cold cache
- Bridge exports 29 napi-rs functions mapping from original 34 Tauri commands

**Bridge binary:** `audesys-theia-bridge.darwin-x64.node` — 861 KB  
**Bridge source:** 446 lines (`crates/audesys-theia-bridge/src/lib.rs`)

---

## 2. Build Sizes

### Theia Studio App (`apps/studio-theia/`)

| Directory | Size |
|---|---|
| apps/studio-theia/ (total) | 1.1 GB |
| lib/ (compiled output) | 360 MB |
| node_modules/ | 805 MB |
| src/ | 20 KB |
| src-gen/ | 40 KB |

### Theia Extensions (`theia-extensions/`)

| Directory | Size |
|---|---|
| theia-extensions/ (total) | 2.4 GB |
| audesys-core + node_modules | ~2.4 GB (dominated by @theia/* framework) |

### Comparison: Old Tauri Studio

| Directory | Size |
|---|---|
| apps/studio/ (total) | 4.1 GB |
| node_modules/ | 14 MB |
| dist/ | 1.9 MB |

**Key findings:**
- Theia app (~1.1G) is significantly smaller than old Tauri Studio (~4.1G) — the old app includes Cargo build artifacts
- Theia node_modules (805MB) is large but expected for a full IDE framework with 14 @theia/* packages
- Theia Electron app binary size will be smaller than the total (bundled, not full node_modules)

---

## 3. Test Counts

### Rust Tests (799 `#[test]` annotations across 24 crates)

| Crate | Tests |
|---|---|
| audesys-controller | 150 |
| audesys-hal-core | 134 |
| audesys-hal-binding-gen | 88 |
| audesys-gcode-compiler | 75 |
| audesys-hal-ir | 61 |
| audesys-ld-semantics | 32 |
| audesys-cnc-axis-group | 32 |
| audesys-il-compiler | 32 |
| audesys-amw-inproc | 28 |
| audesys-ld-layout | 27 |
| audesys-ld-compiler | 25 |
| audesys-fbd-compiler | 21 |
| audesys-sfc-compiler | 19 |
| audesys-runtime-common | 16 |
| audesys-controller-client | 16 |
| audesys-amw-zenoh | 8 |
| audesys-modbus | 8 |
| audesys-cnc-motion | 7 |
| audesys-hal-flatbuffers | 6 |
| audesys-hart | 6 |
| audesys-dap-adapter | 5 |
| audesys-supervisor | 3 |
| audesys-modbus-sys | 0 |
| audesys-theia-bridge | 0 |

### TypeScript Tests

| Source | Tests | Notes |
|---|---|---|
| apps/studio/ (vitest) | ~142 `it()`/`test()` | Old Tauri Studio component tests |
| apps/studio-theia/ (playwright) | 5 (1 spec) | Smoke E2E: `e2e/smoke/startup.spec.ts` |
| theia-extensions/audesys-core/src/ | 0 | No own unit tests yet |
| theia-extensions/ (incl. node_modules) | 12,216 | Mostly @theia/* framework specs |

**Total own tests:** ~946 (799 Rust + 142 TS + 5 E2E)

---

## 4. Compile Check Status

| Crate | Status |
|---|---|
| audesys-theia-bridge | ✅ Compiles (`cargo build --release` + `cargo test --no-run`) |
| All 24 Rust crates | ✅ qa-fast gate: test + clippy + fmt + deny |

**Bridge type:** cdylib (Node.js native addon via napi-rs)  
**Exports:** 29 functions covering: compiler (ST/IL/LD/FBD/SFC/G-code), simulation (create/step/destroy), debug (connect/pause/step/breakpoints/registers), project (open/read), deployment (deployProgram/loadHalConfig/deployHmiLayout), signals (read/snapshot), health

---

## 5. Summary

| Metric | Value | Target | Status |
|---|---|---|---|
| napi-rs p50 latency | 2-6 µs | <50 µs | ✅ |
| napi-rs p95 latency | 7-11 µs | <100 µs | ✅ |
| Bridge binary size | 861 KB | <5 MB | ✅ |
| Theia app size | 1.1 GB | N/A (dev) | ⚠️ dev only |
| Rust tests | 799 | N/A | ✅ |
| Theia E2E tests | 5 (1 spec) | Expand in P2 | ⚠️ |
| Compile status | Passing | All green | ✅ |
