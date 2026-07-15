# Beckhoff Design Patterns

## 1. PC-based Control Pattern

**Problem**: Traditional PLC hardware is expensive, underpowered (CPU 2-3 generations behind), and vendor-locked. Upgrades require replacing entire hardware and often software.

**Solution**: Run real-time control software on standard industrial PC hardware. Software defines function, hardware defines performance. Upgrade IPC independently of software.

**When to use in AUDESYS**: HAL-centric architecture where runtime is decoupled from specific hardware. This validates AUDESYS's approach of abstracting hardware via HAL and running on generic hardware.

**Trade-offs**: PC hardware has lower reliability specifications than dedicated PLC hardware (wider temperature range, vibration tolerance). Mitigated by industrial-grade IPC components.

## 2. Multi-Runtime Single-Task Scheduler Pattern

**Problem**: Multiple control functions (PLC, NC, CNC, Safety, Vision, Analytics) need to run concurrently on the same hardware. Running them as separate processes causes synchronization issues and race conditions.

**Solution**: Mount all runtime types to the same real-time Task scheduler. Share the same process image with fixed execution order. Each runtime type implements the TcCOM interface for standardized Task registration.

```
Task Scheduler (fixed cycle)
  -> Input update (shared process image)
  -> PLC Runtime (sorted execution order)
  -> NC Runtime (sorted execution order)
  -> CNC Runtime (sorted execution order)
  -> Safety Runtime (sorted execution order)
  -> Output update (shared process image)
```

**When to use in AUDESYS**: AUDESYS mixed thread scheduling (D13). All runtime modules (PLC, NC, CNC, Safety) should mount to the same scheduler with fixed execution order for deterministic behavior.

**Trade-offs**: A single misbehaving runtime can block the entire Task cycle. Each runtime must complete within its allocated time slice. Requires rigorous testing of worst-case execution time (WCET).

## 3. VS Shell as IDE Container Pattern

**Problem**: Building a full-featured industrial IDE from scratch is extremely expensive (CODESYS took decades). Most IDE features (editor, debugger, version control, project system) are generic.

**Solution**: Embed an existing mature IDE Shell (Visual Studio) and focus engineering on automation-specific extensions: PLC editors, hardware configurator, scope view, safety configurator.

**When to use in AUDESYS**: Studio IDE Shell strategy. Use VS Code or Theia as container, develop IEC 61131-3 language server, HAL configuration plugin, and HMI designer as extensions.

**Trade-offs**: Dependency on the Shell vendor's ecosystem (VS Shell tied to Microsoft). Shell version upgrades can break extensions. Mitigated by choosing open-source shells (VS Code, Theia) and using well-defined extension APIs.

## 4. Open Interface, Closed Core Pattern

**Problem**: Industrial software needs ecosystem and third-party integration to thrive, but the core runtime is valuable IP that needs protection.

**Solution**: Open the protocol (EtherCAT, ADS) and module interface (TcCOM) for third-party integration. Keep the core runtime closed-source. Third parties build devices, tools, and add-ons on top of open interfaces.

```
Open: EtherCAT protocol (ETG standard), ADS spec, TcCOM interface
Closed: TwinCAT runtime engine, real-time scheduler, compiler
```

**When to use in AUDESYS**: HAL protocol (Signal / StreamChannel / RPC) should be publicly specified. amw (AUDESYS Middleware) interface should be open for third-party transport implementations. Core runtime can remain closed-source.

**Trade-offs**: Interface changes require strict version management. Once open, interfaces are hard to change. Requires rigorous API design upfront.

## 5. Platform Level Licensing Pattern

**Problem**: Customers have different hardware capabilities and budgets. Per-feature pricing creates complex SKU matrices and analysis paralysis.

**Solution**: License by hardware CPU core count (Platform Level 10-94). Higher levels unlock more features. Users choose hardware, then license matches.

**When to use in AUDESYS**: If commercializing, structure licensing by deployment scale (cores, instances) rather than per-feature or per-tag. Lower-level license covers basic functionality; higher levels unlock advanced features.

**Trade-offs**: 10 levels with 100+ TFxxxx modules creates confusing SKU matrix. Users may overbuy to avoid future upgrade costs.

## 6. Performance Claim with Dependency Condition Pattern

**Problem**: Marketing claims "50us cycle, <1us jitter" without context. Engineers deploy in suboptimal conditions and blame the platform.

**Solution**: Every performance claim explicitly states dependency conditions: hardware platform, core isolation, slave count, bus bandwidth utilization, and OS configuration.

**When to use in AUDESYS**: Every latency/throughput specification in HAL docs must include conditions and verification methods. This is exactly what AUDESYS audit found and fixed (see pitfalls.md "unverifiable latency claims").

**Trade-offs**: Conditional claims are harder to market. Competitors may cite unqualified best-case numbers. Requires discipline to maintain.

## 7. ADS Binary Addressing Pattern

**Problem**: String-based addressing (like topic names) has parsing overhead and variable latency. Real-time systems need deterministic, low-latency data access.

**Solution**: Use numeric binary addressing: (AMS Port, IndexGroup, IndexOffset) triple. Fixed-size, deterministic lookup time, no string parsing.

**When to use in AUDESYS**: HAL Signal naming (component.interface.name) could be compiled to numeric pairs internally for efficient runtime lookup, while keeping human-readable names for configuration.

**Trade-offs**: Binary addressing is harder to debug without a lookup table. Requires a symbol table or dictionary to map between human names and numeric addresses.

## 8. Software-Defined Mechatronics Pattern

**Problem**: Traditional control cabinets are large, expensive, and hard to maintain. Each device has its own enclosure, wiring, and power supply.

**Solution**: Integrate IPC, EtherCAT coupler, I/O, and servo drives into a single IP67-rated pluggable system (MX-System). No cabinet needed. All functionality defined by software configuration.

**When to use in AUDESYS**: Future hardware integration phases. The pattern validates that software abstraction can reduce physical complexity.

**Trade-offs**: Single-point integration risk. Repair requires replacing the entire module. Higher per-unit cost than discrete components.