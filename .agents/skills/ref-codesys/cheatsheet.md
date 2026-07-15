# Cheatsheet — CODESYS Reference for AUDESYS

## Quick Numbers

| Metric | Value |
|--------|-------|
| Founded | 1994 |
| IDE registered users | 300,000+ |
| OEM partners | 400+ |
| Device types | 1,000+ |
| Installed devices | Tens of millions |
| IDE price | Free |
| Runtime (Win SL) | ~€100-500/device |
| Runtime (Raspberry Pi) | ~€50-200/device |
| SoftMotion | ~€500-2,000/device |
| Safety SIL2/SIL3 | ~€1,000-3,000/device |
| Min cycle (Beckhoff x86) | <50μs |
| Min cycle (Pi 4) | ~1-5ms |
| Supported CPU architectures | 15+ |
| Supported languages | IEC 61131-3: ST, LD, FBD, SFC, IL, CFC |

## Architecture at a Glance

```
IDE (.NET, WinForms, Plugin-based, DI framework)
  ↕  Proprietary TCP/UDP protocol
Runtime (C, OSAL, Event/Memory/Task system)
  ↕
Compiler Stack (Frontend: parse→Language Model, Backend: native code gen)
```

## IDE 5-Layer Architecture

1. User-Facing Layer — Language editors, I/O config, servo/driver config
2. Language Model — All inputs → ST (primary internal representation)
3. Compiler — Semantic check, compile with libraries, generate auxiliary code
4. Code Generator — Language Model → target CPU native machine code
5. Auxiliary Modules — Debugger, Library Manager, Plugins, Refactoring, Scripting

## Key Design Decisions

| Decision | CODESYS Approach | AUDESYS Implication |
|----------|-----------------|---------------------|
| IDE pricing | Free | Consider free Studio |
| Runtime pricing | Per-device licensed | Runtime/OEM SDK revenue model |
| Internal representation | ST Language Model | Define AUDESYS Device Config Model / HAL IR |
| Execution | Native code generation | Native Rust execution |
| IDE architecture | Plugin-based (DI) | Design for extensibility from start |
| Device support | DDF (XML) | YAML dev + FlatBuffers runtime |
| HMI integration | Shared variable space | HMI shares namespace with Runtime |
| Communication | Proprietary protocol | UDS+HMAC local, Zenoh mTLS network |
| Safety | TÜV pre-certified, isolated runtime | Safety runtime isolation if needed |

## Competitive Landscape

| Competitor | Relationship | Key Differentiator |
|------------|-------------|-------------------|
| Siemens TIA Portal | Direct competitor | Hardware lock-in, larger market share |
| Beckhoff TwinCAT | Derived from CODESYS V2 | Better motion control, Beckhoff-only |
| Rockwell Studio 5000 | Direct competitor | North America, Allen-Bradley only |
| Schneider EcoStruxure | Branded CODESYS V3 | Same tech, different skin |

## Market Segments

- **Core**: Machine building/OEM (~30% share)
- **Strong**: Mobile machinery, Education
- **Important**: Building automation
- **Low**: Automotive (TIA dominant), Process industry

## Key Workflows

1. **OEM integration**: Runtime Toolkit SDK → hardware adaptation → branded firmware
2. **Machine dev**: Free IDE → write IEC 61131-3 → configure I/O → debug → deploy
3. **Motion dev**: Configure axes → SoftMotion FBs → CNC editor → visualize → online config

## AUDESYS Decision Map

| CODESYS Pattern | AUDESYS Decision | Status |
|-----------------|-----------------|--------|
| Language Model IR | HAL IR / Device Config Model | 🟡 Design phase |
| Plugin IDE | Tauri + React plugin system | 🟡 Design phase |
| Native code gen | Native Rust execution | ✅ Aligned (D19) |
| OSAL | amw abstraction (HalTransport/Discovery/QoS) | ✅ Aligned (D11) |
| DDF device desc | YAML dev + FlatBuffers runtime | ✅ Aligned (D24) |
| Free IDE | Free Studio strategy | 🟡 TBD |
| Online Change | Config Barrier hot-reload | ✅ Aligned (D17) |
| Proprietary protocol | UDS+HMAC + Zenoh mTLS | ✅ Aligned (Runtime design) |

## Risks to Watch

1. ⚠️ Don't fragment versioning in Phase 1
2. ⚠️ Pin protocol versions before Phase 1 ships
3. ⚠️ Stay monolithic in Phase 1, modularize later
4. ⚠️ Desktop first (Tauri), Web IDE is Phase 3+
5. ⚠️ IEC 61131-3 compiler is decades of work — don't build one in Phase 1 (use RuSTy, D22)
