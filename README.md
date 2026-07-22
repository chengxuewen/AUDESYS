# AUDESYS

AUDESYS — Automation Development Embedded System. Industrial control runtime
simulation platform: Studio IDE (Eclipse Theia + Monaco + GLSP), Runtime Engine,
Hardware Abstraction Layer (HAL), Simulator, and CNC control system.

## Status

Theia migration complete (2026-07-21). 19 Rust crates, 6 IEC 61131-3 compilers
(ST/IL/LD/FBD/SFC), G-code compiler, Runtime Engine (5-step cycle + hot-swap),
Supervisor, IPC Server, Modbus/HART protocol adapters, Eclipse Theia Studio IDE
(Monaco Editor + GLSP + napi-rs bridge, 6 language editors + HMI designer),
SimulationHarness, Prometheus metrics, DAP debug adapter.
618+ `#[test]` annotations. 186 SDD specification items.

Active development: CNC axis group + interpolation, amw-zenoh network transport,
HMI push-mode SignalBridge.