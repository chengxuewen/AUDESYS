# Ch07: Reference Value for AUDESYS

**Source**: `docs/reference/codesys.md` §7
**AUDESYS Context**: Direct design decisions, patterns, and lessons for AUDESYS Studio/HAL/Runtime

---

## 7.1 IEC 61131-3 Compiler Architecture & Runtime Design

CODESYS compiler architecture provides important reference for AUDESYS HAL runtime design:

| CODESYS Feature | Reference Value for AUDESYS |
|-----------------|----------------------------|
| Language Model as central representation | AUDESYS can adopt similar design — unify all editor inputs into an intermediate representation |
| Native machine code vs interpretation | AUDESYS HAL must decide between JIT/interpreter/machine code for runtime execution |
| Compiler frontend/backend separation | Applicable to AUDESYS multi-language strategy (Rust Core + C++ + other languages) |
| Runtime + OS Abstraction Layer (OSAL) | Directly corresponds to AUDESYS HAL hardware abstraction layer design |

**Key Question**: Does AUDESYS need IEC 61131-3 language support? Or focus on Studio IDE's configuration-based development? CODESYS proves IEC 61131-3 compilers are massive engineering investments (decades of accumulation). AUDESYS should carefully evaluate whether to build or adopt existing solutions.

**D22 alignment**: D22 specifies Phase 1 RuSTy + Phase 2 HAL IR + Phase 3 self-developed compiler. CODESYS validates the phased approach — but warns that full IEC 61131-3 compiler is decades of work.

## 7.2 SoftPLC Development IDE Design Patterns

CODESYS IDE design patterns are valuable for AUDESYS Studio IDE design:

| Design Pattern | CODESYS Implementation | Reference for AUDESYS |
|---------------|----------------------|----------------------|
| Plugin architecture | Full pluginization based on DI framework | AUDESYS Studio can adopt similar extensible architecture |
| Language model | Editor inputs uniformly convert to ST | AUDESYS can define a unified "device configuration model" |
| Project tree | Device Tree + POU view | Reference for Studio IDE project browsing structure |
| Online Change | Modify running PLC program without stopping | Critical industrial control requirement |
| Device Description File | DDF format describes device capabilities | Reference for AUDESYS hardware description files |

## 7.3 Hardware-Independent Runtime Abstraction Layer Design

CODESYS runtime abstraction layer design is a key reference for AUDESYS HAL:

- **CODESYS Control Runtime Toolkit** provides an SDK for OEMs to adapt their own hardware
- Runtime includes: OS abstraction layer, event system, memory management, task scheduling, I/O management
- Supports multiple OSes and CPU architectures through layered abstraction

**Reference for AUDESYS HAL**:
- AUDESYS HAL's amw (AUDESYS Middleware) abstraction layer can reference CODESYS's "pluggable communication stack" design
- Runtime-to-IDE communication protocol design (CODESYS uses proprietary protocol)
- Device description mechanism (DDF analogy) — device capabilities exposed to IDE via description files

## 7.4 Visualization and Motion Control Integration

CODESYS integrates visualization directly into the development environment:

- **TargetVisu/WebVisu** shares variable space with PLC project, no additional configuration
- **SoftMotion visualization templates** provide ready-to-use debugging interfaces for motion control FBs
- **3D visualization** (Depictor) for CNC/robot path validation

**Reference for AUDESYS Studio**:
- Should IDE include a lightweight HMI designer?
- How to design the integration depth between visualization and runtime debugging?
- Online debugging interface design for motion control parameters

## 7.5 OPC UA Integration Strategy

CODESYS OPC UA implementation strategy provides reference:

- Built-in OPC UA Server (no additional hardware)
- OPC UA Client provided as IEC library
- Supports Alarms & Conditions, Methods, PubSub
- Custom information models (Companion Specifications)

**Reference for AUDESYS**:
- Should AUDESYS Runtime include a built-in OPC UA Server?
- Relationship with amw abstraction layer — OPC UA as one communication protocol or built-in protocol?
- D23 specifies Phase 2 OPC UA Gateway — CODESYS validates the value of built-in OPC UA

## 7.6 Business Model Insights

CODESYS business model has direct reference value for AUDESYS:

| Aspect | CODESYS Model | Reference for AUDESYS |
|--------|-------------|----------------------|
| IDE free | Lowers barrier, expands ecosystem | AUDESYS Studio can consider free strategy |
| Runtime licensed | Per-device authorization, stable revenue | AUDESYS Runtime business model design |
| OEM customization | Branded versions, royalty model | Should AUDESYS provide SDK to equipment manufacturers? |
| App Store | CODESYS Store revenue sharing | AUDESYS plugin/library ecosystem planning |

## 7.7 Risks to Avoid

CODESYS development history exposes risks AUDESYS must be aware of:

1. **Compiler version fragmentation**: The SP17→SP18 transition made compiler version management complex, eventually forcing abandonment of unified version numbers
2. **Runtime compatibility**: New IDE may not support old runtime; old IDE may not connect to new runtime
3. **Plugin dependency management**: After modularization, plugin compatibility management becomes a challenge
4. **Web-based migration**: CODESYS go! long-term coexistence strategy with V3 needs observation
5. **Native machine code commitment**: CODESYS's heavy investment in per-CPU code generators created significant maintenance burden

---

## Summary: Top 10 Takeaways for AUDESYS

1. **IDE free, runtime licensed** — proven model for ecosystem growth
2. **Language model as central IR** — all editors → ST → compiler; AUDESYS can define unified device config model
3. **Native code generation** — per-CPU optimization; AUDESYS D19 Rust Core validates this
4. **Plugin-based IDE** — every feature replaceable; AUDESYS Tauri plugin system should follow
5. **DDF device description** — XML device capabilities; AUDESYS can define its own device capability format
6. **Hardware-independent SoftPLC** — one IDE for 400+ OEMs; AUDESYS HAL validates this
7. **Visualization shares variable space** — HMI directly accesses runtime variables; no OPC config needed
8. **Safety runtime isolation** — separate execution context; AUDESYS should consider safety domain isolation
9. **Modularization lesson** — component-level versioning after SP17 forced by fragmentation
10. **CODESYS go! Web IDE** — cautionary tale: Web migration is risky; text-based projects are a win
