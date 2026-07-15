# Patterns — Reusable Architectural Patterns from FUXA

## Pattern 1: Unified Protocol Adapter Interface

**FUXA pattern**: All protocol adapters implement the same interface: `connect()`, `disconnect()`, `read()`, `write()`.

**AUDESYS mapping**: HAL Driver trait in Rust:

```rust
trait Driver {
    fn connect(&mut self, config: &DriverConfig) -> Result<(), DriverError>;
    fn disconnect(&mut self) -> Result<(), DriverError>;
    fn read(&mut self, signals: &[&Signal]) -> Result<Vec<SignalValue>, DriverError>;
    fn write(&mut self, signals: &[SignalValue]) -> Result<(), DriverError>;
}
```

**Key principle**: Protocol independence. Adding Modbus TCP, OPC UA, or MQTT requires only implementing the trait — the HAL core doesn't need to change.

## Pattern 2: Tag as Central Data Abstraction

**FUXA pattern**: Every device variable is a "Tag" — the central data abstraction. Device → Protocol Adapter → Tag Engine → WebSocket → Frontend.

**AUDESYS mapping**: HAL Signal as the central data abstraction:

```
Device → HAL Driver → Signal → amw Transport → Subscriber
```

**Key principle**: All device data flows through one abstraction layer. Frontend, backend, and storage all interact with Signals/Tags — never directly with protocols.

## Pattern 3: Three-Panel HMI Editor Layout

**FUXA pattern**: Toolbox (left) + Canvas (center) + Property Panel (right). This is the standard HMI editor layout.

**AUDESYS mapping**: Studio HMI Designer should adopt the same layout:

```
┌──────────────────────────────────────────────────┐
│  ┌──────────┐  ┌─────────────────┐  ┌──────────┐ │
│  │ Toolbox  │  │     Canvas      │  │ Property │ │
│  │ (shapes, │  │  (SVG/Canvas    │  │ Panel    │ │
│  │  gauges, │  │   with objects) │  │ (bindings│ │
│  │  controls)│  └─────────────────┘  │  events) │ │
│  └──────────┘                        └──────────┘ │
└──────────────────────────────────────────────────┘
```

**Key principle**: Separation of concerns — component selection, visual composition, and property configuration are three distinct workflows.

## Pattern 4: WebSocket Real-time Data Pipeline

**FUXA pattern**: Backend monitors Tag value changes → publishes to WebSocket channel → frontend subscribes → renders updates.

**AUDESYS mapping**: HAL Signal change detection → amw publish → WebSocket bridge → React frontend state update.

**Key principle**: Push-based real-time updates. Polling the backend is wasteful — push only when values change.

## Pattern 5: JSON-Native Project Files

**FUXA pattern**: Entire SCADA project (devices, tags, screens, alarms, users) stored as JSON files in `_appdata/`. Benefits: Git-friendly, human-readable, script-processable.

**AUDESYS mapping**: D24 — YAML for development config, FlatBuffers for runtime. Same principle: text-first project files.

**Key principle**: Binary project files (like LabVIEW's .vi) are a version-control nightmare. Always use text-based formats.

## Pattern 6: Plugin-Based Architecture

**FUXA pattern**: Protocol adapters, storage backends, and UI components are plugins. New protocols = new module implementing interface.

**AUDESYS mapping**: HAL Driver plugins (independent crates), amw transport plugins (inproc → Zenoh), storage plugins (SQLite → InfluxDB → TDengine).

**Key principle**: Plugin interfaces decouple core from extensions. Core stays small; capabilities grow via plugins.

## Pattern 7: Lightweight Edge Deployment

**FUXA pattern**: Docker container + Raspberry Pi = $45 SCADA server. No external dependencies beyond Node.js.

**AUDESYS mapping**: Rust static binary + Docker = even lighter (~50MB vs ~200MB). Same deployment pattern, better performance.

**Key principle**: The deployment target should be determined by the hardware floor (Raspberry Pi / industrial edge), not the development environment.
