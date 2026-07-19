# AUDESYS

AUDESYS — Automation Development Embedded System. Industrial control runtime
simulation platform: Studio IDE, Runtime Engine, Hardware Abstraction Layer (HAL),
Simulator, and CNC control system.

## Status

MVP prototype complete (2026-07-19). 19 Rust crates, 6 IEC 61131-3 compilers
(ST/IL/LD/FBD/SFC), G-code compiler, Runtime Engine (5-step cycle + hot-swap),
Supervisor, IPC Server, Modbus/HART protocol adapters, Tauri Studio IDE (33 commands,
8 panels), SimulationHarness, Prometheus metrics, DAP debug adapter.
618+ `#[test]` annotations. 162 SDD specification items.

Active development: CNC axis group + interpolation, Studio HMI visual designer,
amw-zenoh network transport.