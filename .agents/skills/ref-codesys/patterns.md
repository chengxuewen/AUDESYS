# CODESYS Design Patterns

**Source**: `docs/reference/codesys.md` — extracted design decisions
**Context**: Patterns AUDESYS Studio/HAL can adopt or learn from

---

## Pattern 1: Language Model as Central IR

**CODESYS Implementation**: All IEC 61131-3 editors (ST, LD, FBD, SFC, CFC) convert input to a single internal ST representation (Language Model). Compiler processes one IR uniformly.

**AUDESYS Applicability**: 
- AUDESYS Studio can define a unified "Device Configuration Model" as central IR
- YAML config, HMI design, ST programs all map to same IR
- Enables cross-module features (refactoring, analysis, validation)

**Decision Impact**: D24 (YAML + FlatBuffers) — IR should be YAML-dev + FlatBuffers-RT

---

## Pattern 2: Native Code Generation Per CPU Target

**CODESYS Implementation**: One language model → per-CPU optimized machine code generators (15+ architectures). No interpretation at runtime.

**AUDESYS Applicability**:
- D19: Rust Core for RT data plane (< 1us) — aligns with native code philosophy
- HAL IR compilation to native Rust binaries per target
- Avoid interpretation overhead for real-time paths

**Decision Impact**: D19 multi-language strategy; D22 compiler strategy

---

## Pattern 3: Plugin-Based IDE with DI Framework

**CODESYS Implementation**: Every IDE feature (editors, compiler backends, fieldbus configurators) is a replaceable plugin. DI framework manages dependencies.

**AUDESYS Applicability**:
- AUDESYS Studio Tauri app should adopt plugin architecture
- Language editors, visualizers, debuggers as plugins
- Enables third-party extensions (like CODESYS Store)

**Decision Impact**: Studio plugin system design; AUDESYS Store concept

---

## Pattern 4: Device Description File (DDF)

**CODESYS Implementation**: XML format describes device capabilities. Import DDF → new device supported in IDE.

**AUDESYS Applicability**:
- AUDESYS needs device capability description format
- FlatBuffers-based device model (D19 alignment)
- Device type definitions auto-generate IDE configuration UI

**Decision Impact**: D24 FlatBuffers schema design

---

## Pattern 5: OSAL Hardware Abstraction

**CODESYS Implementation**: OS Abstraction Layer decouples runtime from OS/CPU specifics. Runtime runs on Windows, Linux, VxWorks, QNX, RTOS.

**AUDESYS Applicability**:
- Direct parallel: AUDESYS HAL amw abstraction (D11)
- HalTransport, HalDiscovery, HalQoS as amw three-axis traits
- Swap transport (amw_inproc → amw_zenoh) without code changes

**Decision Impact**: D11 amw middleware design; D10 Signal/StreamChannel/RPC orthogonality

---

## Pattern 6: Free IDE + Licensed Runtime

**CODESYS Implementation**: IDE is free (€0). Runtime licensed per device. OEM SDK has annual + royalty model.

**AUDESYS Applicability**:
- AUDESYS Studio should be free/open source
- AUDESYS Runtime can be open source or per-device licensed
- Revenue from enterprise features, support, OEM SDK

**Decision Impact**: Business model; D40 release strategy (v0.1.0 in Phase 2)

---

## Pattern 7: Visualization Shares Variable Space

**CODESYS Implementation**: TargetVisu/WebVisu directly accesses PLC variables. No OPC UA configuration needed between IDE and HMI.

**AUDESYS Applicability**:
- AUDESYS HMI/SCADA should share runtime variable space
- Direct binding: HMI element ↔ runtime variable (like CODESYS)
- Reduces configuration complexity

**Decision Impact**: Runtime observability design (D45); HMI integration in Studio

---

## Pattern 8: Modular Runtime with Add-on Modules

**CODESYS Implementation**: Core runtime + add-on modules (SoftMotion, Safety, OPC UA, Redundancy, Fieldbus). Each module is independently licensable.

**AUDESYS Applicability**:
- AUDESYS Runtime core + optional modules
- HAL protocol adapters as modules (Modbus, OPC UA, EtherCAT)
- Simulator virtual devices as modules (Phase 3/4)

**Decision Impact**: Module design; D14 HAL modular sub-documents pattern

---

## Pattern 9: Component-Level Independent Versioning

**CODESYS Implementation**: Since SP17, each plugin/module has independent version number (4.x.x.x). Independent updates without waiting for Service Pack.

**AUDESYS Applicability**:
- HAL components can have independent versions
- Runtime core vs HAL vs Studio each version independently
- Avoids CODESYS's SP17 fragmentation lesson: version ranges must be managed

**Decision Impact**: D35 cargo workspace structure; D40 release strategy

---

## Pattern 10: Safety Runtime Isolation

**CODESYS Implementation**: Safety runtime (SIL2/SIL3) runs isolated from standard runtime. Separate execution context, TÜV pre-certified.

**AUDESYS Applicability**:
- AUDESYS Safety domain (D27) should have isolated execution
- `l1.*` security domain matches all L1 devices (D27)
- Safety-critical paths separate from standard data paths

**Decision Impact**: D27 HalQoS security domains; D46 error model

---

## Patterns to AVOID

| Pattern | CODESYS Lesson | AUDESYS Counter-Strategy |
|---------|---------------|------------------------|
| Unified compiler version | SP17→SP18 forced component-level versioning | Use cargo workspace independent versions from start |
| IDE/Runtime compatibility | New IDE may not support old runtime | Define stable version compatibility matrix |
| Plugin dependency management | After modularization, compatibility management became complex | Pin compatible version ranges explicitly |
| Web IDE migration | CODESYS go! coexistence with V3 strategy unproven | Start Web-native (Tauri) from day one |

---

**Reference**: CODESYS patterns are extracted for AUDESYS Studio design decisions (D21-D49). Each pattern maps to one or more AUDESYS design documents in `docs/modules/`.
