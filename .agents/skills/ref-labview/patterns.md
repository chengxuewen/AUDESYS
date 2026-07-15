# LabVIEW Patterns for AUDESYS

## 1. Channel Abstraction Pattern (DAQmx -> HAL)

**Problem**: Hardware abstraction needs to decouple logical I/O from physical addressing while maintaining type safety.

**LabVIEW solution**: Physical Channel -> Virtual Channel -> Task three-layer model. Physical addressing in config, logical names in code, Task encapsulates all config as atomic unit.

**AUDESYS application**: component.interface.name -> Signal naming. YAML config maps logical names to hardware addresses. Config Barrier applies changes atomically at cycle boundaries.

## 2. Dual-Mode Execution Pattern (Host/Target Split)

**Problem**: Real-time control needs deterministic execution but flexible UI development.

**LabVIEW solution**: Host VI (Windows, UI, full API) + RT Target VI (deterministic control). Communication via Network Streams/Shared Variables.

**AUDESYS application**: Studio IDE (development) + Runtime (execution). Communication via amw_zenoh transport. Development mode allows hot-reload, production mode is deterministic.

## 3. Incremental Compilation Pattern

**Problem**: Large industrial projects need fast edit-compile-run feedback loops.

**LabVIEW solution**: VI-level incremental compilation. Only modified VIs recompile. Dependency graph tracks cascading changes.

**AUDESYS application**: Cargo workspace incremental compilation. Studio LSP triggers recompile on save. Debug mode prioritizes compile speed, release mode prioritizes optimization.

## 4. Message-Driven Concurrency Pattern (QMH/Actor)

**Problem**: Industrial control systems need modular, scalable concurrency without shared-state complexity.

**LabVIEW solution**: QMH (single queue, message-based) or Actor Framework (multiple actors, each with own queue). Messages are the only communication primitive.

**AUDESYS application**: Runtime MachineAct (QiTech-style) can use message-driven architecture. DQMH's 80/20 rule (80% capability at 20% complexity) is the right target — avoid AF's steep learning curve.

## 5. Error Propagation Pattern (Error Cluster)

**Problem**: Error handling in dataflow/graphical systems needs to propagate errors without global state.

**LabVIEW solution**: Error Cluster on every side-effect VI. Error In -> execute or skip. Error Out -> propagate downstream. Merge Errors combines parallel error flows.

**AUDESYS application**: Rust Result<T,E> with `?` operator is superior (compile-time checking, precise error types). Do NOT replicate Error Cluster pattern. But the "error propagation on every I/O operation" concept is worth adopting — every Signal/StreamChannel operation should return Result.

## 6. Multi-Rate Execution Pattern

**Problem**: Different control loops need different cycle rates (fast: current control, medium: position control, slow: monitoring).

**LabVIEW solution**: Multiple Timed Loops with different periods and priorities. High-priority loops preempt lower-priority loops.

**AUDESYS application**: D13 multi-cycle RT thread groups. RT thread (fast, 1-10ms), I/O thread (medium, 10-100ms), event thread (variable). Config Barrier ensures configuration consistency across rate boundaries.

## 7. Config Wizard Pattern (Express VI = Declarative Config)

**Problem**: Engineers need to configure standard functionality without writing code from scratch.

**LabVIEW solution**: Express VI = configuration dialog that generates optimized code. Examples: DAQ Assistant, Simulation Express VI.

**AUDESYS application**: Studio config wizards for standard control loops (PID, alarm rules, logging). Generated YAML/ST code. Reduces boilerplate while keeping Studio's text-first approach.

## 8. Dataflow Debugging Pattern (Probe + Highlight)

**Problem**: Debugging dataflow applications requires understanding data movement across distributed nodes.

**LabVIEW solution**: Probe Tool (live value on any wire) + Highlight Execution (animation of data flow). Combined = most powerful debug mode.

**AUDESYS application**: Debug bridge with dataflow visualization. Highlight Signal/StreamChannel paths. Probe shows real-time Signal values. Animation shows data movement direction and timing.

## 9. Hardware Virtualization Pattern (MAX Simulated Devices)

**Problem**: Development needs hardware-like behavior without physical hardware.

**LabVIEW solution**: MAX provides simulated devices for development. Virtual bench enables code development before hardware is available.

**AUDESYS application**: Simulator AVD Manager provides virtual devices. Phase 1: simple virtual Printer/Serial. Phase 3+: full AVD (7 device types). Each virtual device emulates Signal/StreamChannel behavior.

## 10. Text-First Project File Pattern

**Problem**: Binary project files prevent effective version control, code review, and CI/CD.

**LabVIEW anti-pattern**: Binary .vi files. No Git DIFF. No merge reconciliation. Code review requires LabVIEW license.

**AUDESYS pattern**: Text-first approach:
- ST code -> .st files (plain text)
- HAL config -> YAML (declarative, Kubernetes-style)
- Connections -> JSON/YAML mapping tables
- Project metadata -> TOML (Cargo.toml style)
- HMI layout -> JSON (web renderer-friendly)

**Benefits**: Git DIFF, text merge, PR review, CI/CD pipeline, LLM generation.