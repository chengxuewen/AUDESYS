# Ch02: Technical Features

## 2.1 Core Architecture

Three core components:

```
+--------------------------------------------------+
|  CODESYS Development System (IDE)                 |
|  - .NET Framework 4.8 (Windows)                   |
|  - Plugin Architecture                            |
|  - Dependency Injection (DI) Framework            |
|  - WinForms / GDI+ rendering                      |
+--------------------------------------------------+
          |  CODESYS proprietary protocol (TCP/UDP)
          v
+--------------------------------------------------+
|  CODESYS Control (Runtime System)                 |
|  - C implementation                               |
|  - OS Abstraction Layer (OSAL)                    |
|  - Event system / Memory mgmt / Exception / Task |
|  - Multi-core assignment                          |
|  - Runs on: Windows, Linux, VxWorks, QNX, RTOS   |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|  CODESYS Compiler Stack                           |
|  - Frontend: IEC 61131-3 parse → Language Model  |
|  - Backend: Native machine code generation       |
|  - Target CPUs: x86, ARM, ARM64, PowerPC, etc.   |
+--------------------------------------------------+
```

### 2.1.1 IDE Architecture (Programming System)

**5-layer architecture**:

1. **User-Facing Layer** — IEC 61131-3 language editors (ST, LD, FBD, SFC, IL, CFC), I/O config, servo/driver config, network config. WinForms + GDI+ canvas.

2. **CODESYS Language Model** — Internal data model for all IEC 61131-3 languages. ST is the primary internal representation. Other editors (LD, FBD, SFC) convert input to ST. Config generates DUT, GVL, and init code.

3. **CODESYS Compiler** — Scans language model for errors, compiles programs (with installed libraries), generates auxiliary code (type conversions, task management, I/O sync, initialization). Input/output are both Language Model (output is enhanced version).

4. **Code Generator** — Generates target CPU native machine code from Language Model. Direct execution, no interpreter. Per-CPU optimization.

5. **Auxiliary Modules** — Upload/Download, Debugger (breakpoints, variable watch, step), Library Manager, Plugin System, Refactoring, Scripting API, Project Compare.

### 2.1.2 Runtime Architecture

Core components of CODESYS Control:
- Proprietary protocol for IDE communication
- Multi-program concurrent execution
- Native machine code execution engine
- Built-in OPC UA Server/Client
- SQLite integration
- Custom framework (event system, memory mgmt, exception handling, task scheduling)
- PLC Handler interface (SDK for 2nd-party dev)

**Deployment forms**:
- **CODESYS Control Full** — Full runtime for preemptive multitasking OS
- **CODESYS Control Embedded** — Pre-configured for embedded devices
- **CODESYS Control SL** — Ready-to-use SoftPLC for standard platforms (Windows/Linux)

## 2.2 Key Technical Capabilities

### 2.2.1 IEC 61131-3 Full Language Support

| Language | Abbrev | Description | CODESYS Status |
|----------|--------|-------------|----------------|
| Structured Text | ST | Pascal-like HLL | Full, internal core representation |
| Ladder Diagram | LD/LAD | Graphical relay logic | Full, multiple variants |
| Function Block Diagram | FBD | Graphical signal flow | Full |
| Sequential Function Chart | SFC | State machine / process control | Full |
| Instruction List | IL | Assembly-style low-level | Deprecated |
| Continuous Function Chart | CFC | Free-layout FBD | Add-on |

**IEC 61131-3 3rd Edition (OOP extension)**: METHOD, INTERFACE, EXTENDS, IMPLEMENTS keywords. Encapsulation, inheritance, polymorphism. OOP + procedural mixed use. OOP code can be packaged as function-call interface libraries.

### 2.2.2 Compiler Technology

- **Native machine code generation** — not interpreted, direct target CPU machine code
- **Multi-CPU support** — x86, ARM, ARM64, PowerPC, TriCore, Blackfin, ColdFire, RX, SH, 28x, Cortex M3+
- **Compiler version management** — SP17 had unified version; SP18+ component-level independent versioning
- **Compile flow**: Language Model → Semantic check → Code gen → Link → Download to target

### 2.2.3 Real-Time Performance

- Minimum cycle: 50μs (hardware-dependent)
- Multi-core task assignment
- Preemptive multitasking
- Cyclic, Free-run, Event task types

### 2.2.4 Fieldbus Support

| Protocol | Role | Status |
|----------|------|--------|
| EtherCAT | Master | Full |
| PROFINET | Controller/Device | Full |
| EtherNet/IP | Scanner/Adapter | Full |
| CANopen | Master/Slave | Full |
| Modbus TCP/RTU | Client/Server | Full |
| PROFIBUS | Master | Add-on module |
| J1939 | Supported | Via CAN stack |
| Sercos | Supported | TBD |

### 2.2.5 Compiler Deep Dive

**Frontend**: Lexer → Token → Parser → AST → Semantic analysis (type check, scope resolution) → Language Model

**Backend**: Language Model optimization (constant folding, dead code elimination) → Instruction selection (target ISA) → Register allocation → Native machine code

**Code generators per CPU**: ARM, ARM64, Cortex M3, x86, x64, PowerPC, TriCore, Blackfin, ColdFire, RX, SH, 28x — all bundled in standard IDE installer, auto-matched to target device.

### 2.2.6 Task Scheduling

- **Cyclic**: Fixed period (1ms/10ms/100ms)
- **Free-run**: Continuous execution
- **Event**: Interrupt or variable-change triggered
- **Multi-core** (SP17+): Task groups assigned to different CPU cores
- **Priority**: High-preempts-low, watchdog support

**Typical cycle performance**:
- Beckhoff CX2040 x86: <50μs
- ARM Cortex-A high-perf: ~100μs
- Wago PFC200 ARM: ~1-10ms
- Raspberry Pi 4: ~1-5ms
- SoftPLC Win SL: ~1-10ms

### 2.2.7 Library System

- Encapsulates IEC 61131-3 code (functions, FBs, global variables)
- Signed Libraries — certificate-based source verification
- Versioned (major.minor.revision)
- Library Dependency Inspection
- Online install from CODESYS Store
- User-created private libraries
- Libraries can include docs and examples

### 2.2.8 Scripting & Automation

- .NET-based Scripting API engine
- Project creation/modification/compilation automation
- CI/CD integration
- Batch operations (import/export variables)
- Python support via add-on (TBD)

### 2.2.9 Real-Time on Windows/Linux

- **Windows**: Self-developed kernel patch by CODESYS
- **Linux**: Standard RT-PREEMPT kernel patch

## 2.3 Hardware/Platform Support

**400+ OEM manufacturers, 1,000+ device types.**

**Major OEM partners**: Wago (PFC100/200, TP600), Beckhoff (CX series — TwinCAT derives from CODESYS), Schneider Electric (AC500), Bosch Rexroth (IndraControl, ctrlX CORE), ABB (AC500), Eaton (XC), Festo (CPX-E, CECC), IFM (ecomatController), KUNBUS (RevPi/Raspberry Pi), Berghof (MPC, ECC), Lenze, Moeller (PS4-341), Chinese OEMs (Lico, UniMAT).

**Standard SoftPLC platforms**: CODESYS Control Win SL, Linux SL, Raspberry Pi CM4/CM5 SL, PLCnext SL.

**CPU architectures**: x86/x64, ARM (Cortex-A/M/R), ARM64, PowerPC, TriCore, Blackfin, ColdFire, Renesas RX, TI C28x.

## 2.4 IDE Development Features

- Multi-language editor (syntax highlight, IntelliSense, input assistant)
- Library Manager
- Device Description Files (DDF) — XML device capability description
- Project Compare Tool (including graphical editor comparison)
- Debugger: breakpoints, variable watch, step-through, force assignment
- Sequence Control
- **Online Change** — modify code while running
- Scripting Engine
- Refactoring
- Project templates and wizards

**Version control**: CODESYS Git support (SP17+, XML export), CODESYS SVN, third-party Copia tool. Traditionally single-file project storage; new versions support Git-friendly XML export.

## 2.5 AUDESYS Relevance — Architecture Decisions

| CODESYS Pattern | AUDESYS Studio Application |
|-----------------|--------------------------|
| Language Model as central IR | HAL IR / Device Config Model as AUDESYS's internal representation |
| Native code gen (not interpretation) | HAL Runtime executes native Rust; JIT for dynamic configs |
| Frontend/Backend compiler split | Matches D19 multi-language strategy (Rust Core + FlatBuffers) |
| OSAL (OS Abstraction Layer) | Directly corresponds to AUDESYS HAL |
| Plugin-based IDE with DI | AUDESYS Studio plugin architecture design |
| Proprietary IDE↔Runtime protocol | Reference for AUDESYS Studio↔Runtime IPC design |
