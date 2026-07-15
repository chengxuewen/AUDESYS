# LabVIEW Quick Reference Cheat Sheet

## G Language Basics

| Element | Description | Visual |
|---------|-------------|--------|
| Node | Function/SubVI/Express VI. Executes when all inputs available. | Icon with terminals |
| Wire | Data connection. Color = type, thickness = dimension. | Colored line |
| Terminal | Front panel control/indicator on block diagram | Bordered (control) / borderless (indicator) |
| Structure | Execution flow control (loop, case, event) | Framed box on diagram |

## Wire Color Types

| Color | Type | Example |
|-------|------|---------|
| Blue | Integer | I8, I16, I32, U8, U16, U32, U64 |
| Orange | Float | Single, Double, Extended |
| Green | Boolean | True/False |
| Pink | String | Text |
| Purple | Variant, Path | Dynamic data, file path |
| Brown | Cluster | Compound data structure |

## Key Programming Patterns

| Pattern | Architecture | Use Case |
|---------|-------------|----------|
| State Machine | While + Case + Shift Register | Test sequences, simple control |
| Producer-Consumer | 2 parallel loops + Queue | DAQ (fast acquisition, slow processing) |
| QMH | Message queue + Case dispatch | Most medium-large projects |
| DQMH | LVOOP + modular QMH modules | Large projects, modular architecture |
| Actor Framework | Nested actors + message queues | Highly complex systems (steep learning) |

## Debugging Shortcuts

| Feature | Action | Use |
|---------|--------|-----|
| Highlight Execution | Click light bulb on toolbar | See data flow animation |
| Probe Tool | Right-click wire -> Probe | Live value display |
| Breakpoint | Right-click node/wire -> Set Breakpoint | Pause execution |
| Probe + Highlight | Both active simultaneously | Most powerful debug mode |

## DAQmx Channel Model

```
Physical Channel ("Dev1/ai0") 
  -> Virtual Channel ("Temperature Sensor 1") 
    -> Task (channel + timing + trigger) 
      -> DAQmx Read/Write VI
```

## HAL Equivalent Mapping

| LabVIEW | AUDESYS HAL |
|---------|-------------|
| Wire | Signal (single-writer, latest-value) |
| Stream Channel (Channel Wire) | StreamChannel (buffered, multi-writer) |
| VI Call | RPC (request/response) |
| Shared Variable | Signal + HalDiscovery |
| Notifier | Signal subscription notification |
| Shift Register | StreamChannel ring buffer |
| DAQmx Task | Signal (configured I/O abstraction) |
| Virtual Channel | component.interface.name |

## RT Scheduling Comparison

| LabVIEW RT | AUDESYS D13 |
|-----------|-------------|
| Timed Loop | RT thread (LinuxCNC function list) |
| CPU core isolation | RT thread exclusive core |
| Watchdog timer | HalQoS deadline monitoring |
| Multi-rate Timed Loops | Multi-cycle RT thread groups |
| Host/Target split | Studio/Runtime separation |
| Network Streams | amw_zenoh transport |

## Critical AUDESYS Lessons

| Lesson | Source | Action |
|--------|--------|--------|
| Text project files from day 1 | LabVIEW .vi binary pain | JSON/YAML/TOML for all files |
| No clean-slate rewrite | NXG failure ($8.2B lesson) | Incremental evolution only |
| ST as primary language | LabVIEW graphical spaghetti | Text-first, graphical as debug tool |
| CLI+YAML config first | LabVIEW MAX GUI dependency | Config via CLI, GUI as optional |
| Plugin-based IDE architecture | LabVIEW NXG monolithic | VS Code model |
| amw transport trait for HW independence | LabVIEW NI hardware lock-in | Pluggable protocol stack |
| Rust Result<T,E> compile-time errors | LabVIEW Error Cluster runtime | Compile-time checking eliminates bugs |

## Do NOT Copy From LabVIEW

- Binary .vi source files -> AUDESYS: text-based project files
- NI hardware lock-in -> AUDESYS: amw trait hardware independence
- Graphical spaghetti on large projects -> AUDESYS: ST primary, graphical debug only
- MAX GUI-dependent config -> AUDESYS: CLI/YAML-first config
- IDE monolithic architecture -> AUDESYS: plugin-based (VS Code model)
- Patent-protected G language -> AUDESYS: open standards (IEC 61131-3 + text DSL)

## Do Copy From LabVIEW

- Dataflow model (Signal/StreamChannel/RPC) -> validates D10
- DAQmx channel abstraction -> component.interface.name naming
- Probe + Highlight execution -> Studio debug bridge UX
- Express VI config wizard -> Studio config wizards for standard loops
- Host/Target dual-mode execution -> Studio/Runtime split
- Timed Loop + core isolation -> RT thread scheduling (D13)
- Error propagation on every I/O -> every Signal/StreamChannel operation returns Result