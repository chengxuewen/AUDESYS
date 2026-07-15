# Ch06: Product Characteristics

## 6.1 Hardware-Independent SoftPLC Concept

CODESYS's most core characteristic: **decoupling control software from hardware**:
- One IDE programs controllers from any compatible brand
- Runtime runs on Windows PC, Linux IPC, embedded devices, Raspberry Pi
- Same project deploys to different hardware platforms (recompilation required)
- OEMs focus on hardware differentiation without redeveloping programming environments

Direct analogy: Android OS — Google provides the platform; Samsung, Xiaomi, Huawei make hardware and customize UI.

## 6.2 IEC 61131-3 Compiler/Runtime Industry Standard Status

CODESYS's compiler technology is its primary technical moat:
- **Native machine code generation** — not interpreted; each target CPU gets optimized machine code
- **Multi-platform coverage** — 15+ CPU architectures, among the broadest IEC 61131-3 compiler coverage
- **Language Model centralization** — all editors (LD, FBD, SFC, CFC) convert to ST Language Model; compiler processes uniformly
- **Compiler version management** — component-level versioning since SP18 for more flexibility

## 6.3 Visualization-Integrated Development Experience

CODESYS integrates HMI directly into the development environment:
- **TargetVisu** — runs on controller-local display, no extra hardware cost
- **WebVisu** — browser-accessible, no client installation
- **Shared variable space** — HMI directly accesses PLC variables, no OPC configuration
- **Visualization templates** — SoftMotion FBs ship with built-in visualization templates for intuitive debugging
- **3D visualization** — CODESYS Depictor for CNC/robot motion 3D display

## 6.4 Integrated Motion Control + Logic Control

Single development environment unites logic and motion control:
- No extra hardware required for motion control
- Logic and motion programs collaborate in the same task
- Standard PLCopen FBs reduce learning cost
- CNC editor and kinematics transform libraries cover common robot types

## 6.5 Modularity & Extensibility

- **Plugin architecture** — almost everything (editors, compiler backends, fieldbus configurators) is a replaceable plugin
- **Library system** — encapsulate and reuse IEC 61131-3 code
- **Scripting engine** — automate development workflows via API
- **C code integration** — use C code within IEC applications

## 6.6 Safety Certification

- TÜV pre-certified safety runtime (SIL2/SIL3)
- Reduces OEM safety certification workload and cost
- Safety applications isolated from standard applications

## 6.7 AUDESYS Relevance — Design Philosophy

| CODESYS Characteristic | AUDESYS Design Implication |
|-----------------------|---------------------------|
| Hardware-independent SoftPLC | Validates AUDESYS's HAL-first architecture |
| Language Model as central IR | Design AUDESYS's internal representation (HAL IR / Device Config Model) |
| Native code gen (not interpretation) | HAL Runtime should execute native Rust, not interpret configs |
| HMI shares variable space with PLC | AUDESYS Studio's HMI should directly access Runtime state |
| Plugin architecture | AUDESYS Studio should be built as extensible from day one |
| TÜV pre-certified safety | AUDESYS Safety runtime (if needed) should pursue certification |
| SoftMotion + logic unified | AUDESYS Simulator virtual devices + Runtime logic unified |
