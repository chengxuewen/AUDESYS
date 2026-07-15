# Ignition Design Patterns

## 1. Gateway-Centric Thin Client Pattern

**Problem**: Traditional SCADA installs client software on each operator station. Updates require touching every machine, causing version drift.

**Solution**: All intelligence in a central Gateway server. Clients (Vision via Java Web Start, Perspective via browser) are thin terminals that connect to Gateway for data and rendering.

**When to use in AUDESYS**: Runtime-centric architecture where HAL is the core. Clients connect to Runtime via WebSocket/binary protocol, never poll data sources directly.

**Trade-offs**: Gateway becomes single point of failure (mitigated by Active-Standby redundancy). Network latency affects client experience.

## 2. Tag Provider Adapter Pattern

**Problem**: Industrial environments have heterogeneous data sources (OPC UA, Modbus, MQTT, Siemens S7, Allen-Bradley, SQL). Each requires different connection handling, addressing, and data formatting.

**Solution**: Abstract each data source as a Tag Provider implementing a unified interface (start/stop/read/write/subscribe). The Tag Engine manages all providers transparently.

```
interface TagProvider {
    start(): void
    stop(): void
    read(tagPath: string): TagValue
    write(tagPath: string, value: TagValue): void
    subscribe(tagPath: string, callback: (TagValue) => void): Subscription
}
```

**When to use in AUDESYS**: HAL Driver Manager should use this pattern. Each protocol (Modbus, OPC UA, MQTT) implements the same `Driver` trait.

**Trade-offs**: Finding the right abstraction level is hard. Too generic loses protocol-specific features. Too specific breaks the abstraction.

## 3. Unlimited Licensing Trust Signal Pattern

**Problem**: Traditional SCADA pricing (per-point per-client) creates friction. Customers hesitate to expand, integrators over-engineer to avoid license costs.

**Solution**: Per-server license with unlimited tags, clients, and projects. This communicates confidence in platform scalability and removes cost as a scaling barrier.

**When to use in AUDESYS**: If AUDESYS commercializes, consider per-instance or per-core licensing rather than per-tag or per-client.

**Trade-offs**: Higher entry price for small deployments. Requires sufficient volume to amortize unlimited access.

## 4. Auto-Discovery with Sparkplug Pattern

**Problem**: Configuring hundreds of tags from MQTT devices manually is error-prone and tedious.

**Solution**: Sparkplug's Birth certificates (NBIRTH/DBIRTH) carry device metadata. MQTT Engine parses these, auto-creates tag folders (Group ID), UDT instances (Edge Node ID), and tags (Metrics).

```
MQTT Broker → Sparkplug NBIRTH → MQTT Engine → auto-create tags → Tag Engine
```

**When to use in AUDESYS**: HAL topology discovery. When a new device connects, it announces its capabilities via HAL protocol. The Runtime auto-creates Signal/StreamChannel endpoints.

## 5. Browser-Based Designer Pattern

**Problem**: Traditional industrial IDEs require desktop installation (TIA Portal, CODESYS, TwinCAT). Engineers need different machines for design and operations.

**Solution**: Perspective Designer runs entirely in the browser. Engineers open a URL, log in, and start designing HMI screens. Same machine can be used for both design and runtime monitoring.

**When to use in AUDESYS**: Studio IDE HMI editor should be Web-first. Use Electron for desktop packaging if needed, but the core should be browser-deployable.

**Trade-offs**: Browser-based editors have limitations with native file access, large project loading, and offline editing. Service Worker + IndexedDB can mitigate some offline limitations.

## 6. Alarm Pipeline Pattern

**Problem**: Alarm processing needs different stages (filter redundant alarms, prioritize, notify different channels, archive). Hard-coding this flow is inflexible.

**Solution**: Configurable pipeline of stages: Filter → Split → Notify → Store. Each stage can be customized with scripts or configuration.

**When to use in AUDESYS**: Runtime alarm processing should implement a pipeline architecture. Stages can be added, removed, or customized without changing core logic.

## 7. Dual UI Strategy (and the Anti-Pattern)

**Problem**: Vision (Swing) and Perspective (React) coexist. Each has different component models, rendering engines, and deployment mechanisms.

**Result**: Double maintenance cost for UI components, themes, and behaviors. Engineers must learn two design paradigms.

**Lesson**: AUDESYS should pick ONE UI technology stack from day one. If Web is chosen, commit fully. Avoid the "maintain two" trap.

## 8. Solution Suite Packaging Pattern

**Problem**: Ignition has 30+ modules. Individual pricing creates analysis paralysis for customers.

**Solution**: Group modules into themed Solution Suites (Application Building, Industrial Historian, Enterprise Integration, Alarm Management, DataOps). Each suite has a fixed price covering all included modules.

**When to use in AUDESYS**: If modular, group features into value-bundled packages rather than individual line-item pricing.