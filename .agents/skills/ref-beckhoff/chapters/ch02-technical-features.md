# Ch02: Technical Features

## 2.1 Core Architecture (XAE + XAR)

TwinCAT 3 uses a two-layer architecture:

```
+--------------------------------------------------+
|  TwinCAT XAE (Engineering)                        |
|  +---------------------------------------------+ |
|  | Microsoft Visual Studio Shell               | |
|  | + TwinCAT XAE Extensions                     | |
|  +---------------------------------------------+ |
|  | PLC Editor (IEC 61131-3)                    | |
|  | C++ Module Editor                            | |
|  | NC/CNC Configuration                        | |
|  | TwinCAT HMI Designer                         | |
|  | System Manager (I/O Config)                  | |
|  | Safety Editor                                | |
|  +---------------------------------------------+ |
+--------------------------------------------------+
|  ADS Protocol (communication)                     |
+--------------------------------------------------+
|  TwinCAT XAR (Runtime)                             |
|  +---------------------------------------------+ |
|  | Real-time Scheduler (3.x kernel)            | |
|  +---------------------------------------------+ |
|  | PLC Runtime  | NC Runtime                   | |
|  | CNC Runtime  | Safety Runtime               | |
|  | Vision RT    | Analytics RT                 | |
|  +---------------------------------------------+ |
|  | TcCOM Module Interface                       | |
|  | ADS Message Router                           | |
|  | EtherCAT Master                              | |
|  +---------------------------------------------+ |
+--------------------------------------------------+
|  Operating System                                  |
|  Windows / TwinCAT/BSD / Beckhoff RT Linux       |
+--------------------------------------------------+
```

### 2.1.1 TwinCAT XAE (eXtended Automation Engineering)

Engineering environment **built on Microsoft Visual Studio**:

- PLC programming editor: IEC 61131-3 all languages (ST, LD, FBD, SFC, CFC, IL) with syntax highlighting, breakpoint debugging, online monitoring
- NC configuration tool: Axis parameter setup, kinematic models, cam curve editor
- CNC programming: G-code (DIN 66025) editor and path simulation
- System Manager: I/O mapping, EtherCAT bus config, Task scheduling config
- TwinCAT HMI Designer: HTML5-based HMI visualization
- TwinSAFE Configurator: Safety function block parameterization
- Scope View: Real-time signal oscilloscope

### 2.1.2 TwinCAT XAR (eXtended Automation Runtime)

Runtime environment executing control code on target IPC:

- Real-time kernel via hypervisor on Windows; native kernel on TwinCAT/BSD
- OS-independent real-time scheduling via double-tick method on Windows
- Multi-core support: dedicated (isolated) or shared cores
- TcCOM module architecture: standardized interface for all runtime modules

## 2.2 EtherCAT (Ethernet for Control Automation Technology)

| Feature | Detail |
|---------|--------|
| Invented | 2003, Beckhoff |
| Standard | IEC 61158 / IEC 61784 |
| Protocol type | Real-time Ethernet (modified slave MAC processing) |
| Topology | Line, star, ring (hot-connect, diagnostics) |
| Typical cycle | 250us - 1ms, theoretically 50us minimum |
| Jitter | < 1us (typical) |
| Organization | EtherCAT Technology Group (ETG), 7,000+ members |
| Data frame | "Processing on the Fly": slaves read/write data on the fly as frame passes |
| Safety protocol | FSoE (FailSafe over EtherCAT), SIL 3 / PLe |
| Supported drives | Nearly all major servo/stepper brands |

**On-the-fly processing principle**:

1. Master sends EtherCAT frame, starts frame counter
2. Frame enters first slave: slave reads its bit field (nanoseconds)
3. Slave writes local data to frame (replace or append)
4. Slave forwards frame to next slave (zero delay, no buffering)
5. Frame returns from last slave to master
6. One complete master cycle: total time = max slaves x processing time

**Frame structure**:

```
[EtherType 0x88A0 | SyncManager | Data Area | CoE/SoE | CRC]
   14B           2-6B         Variable    Variable   4B
```

- **EtherType 0x88A0**: EtherCAT-specific Ethernet type
- **SyncManager**: SM0-SM2 config, status word (SII data start, master-slave state)
- **Data Area**: Per-slave IO data regions
- **CoE (CANopen over EtherCAT)**: CANopen object dictionary access
- **SoE (Servo over EtherCAT)**: Servo drive communication protocol

## 2.3 ADS (Automation Device Specification) Communication Protocol

ADS is TwinCAT's **unified communication protocol**, analogous to AUDESYS HAL primitives.

**Message Router**: Each TwinCAT device runs an ADS Message Router managing all message routing and distribution. ADS devices identified by unique **AMS Port number**:

| AMS Port | Device |
|----------|--------|
| 100 | TwinCAT Router |
| 350 | PLC Runtime |
| 400 | PLC Runtime (legacy) |
| 500 | NC (Numerical Control) |
| 501 | NC SEC (Safety Extension) |
| 520 | NC Instance |
| 600 | CNC |
| 800 | User-defined |
| 11000 | NC Control System |
| 11500 | NC Interpreter |

ADS core concepts:

- **Index Group (16-bit) + Index Offset (32-bit)**: Binary addressing pair for any data object
- **Service types**: Read, Write, ReadWrite, Notification (subscribe/push)
- **Transport**: TCP/IP, UDP, USB, or process data mapping
- **Security**: Secure ADS (encrypted signing, Build 4026+) and ADS-over-MQTT

## 2.4 Real-Time Scheduling Model

TwinCAT uses **Rate-Monotonic Scheduling (RMS)**:

1. **Task**: Basic scheduling unit with fixed Cycle Time and priority
2. **Automatic priority management**: Shorter cycle = higher priority (manually adjustable)
3. **Double-tick mechanism** (Windows platform):
   - Tick 1: Switch to real-time mode, execute scheduling
   - Tick 2: Switch back at 90% of cycle
   - Isolated core eliminates switch overhead for better real-time quality
4. **PLC Runtime vs TcCOM modules**:
   - Standard TcCOM: Input update -> module execution (sorted) -> output update
   - PLC Runtime: Independent input/output updates for TwinCAT 2 compatibility

Key scheduling characteristics:

| Feature | Detail | AUDESYS Reference |
|---------|--------|-------------------|
| Cycle jitter control | Core isolation + double-tick keeps jitter at microseconds | AUDESYS RT thread jitter control |
| Task dependency | Depends-on relationships (A executes before B) | AUDESYS mixed scheduling dependency management |
| Runtime priority | Dynamic runtime adjustment | AUDESYS runtime priority management |
| Safety runtime isolation | TwinSAFE as independent runtime, isolated from normal Tasks | AUDESYS Safety module isolation |

## 2.5 Multi-Runtime Integration

TwinCAT 3 runs **multiple runtime systems on the same IPC**, scheduled in the same Task:

| Runtime Type | Function | License ID |
|-------------|----------|------------|
| TwinCAT PLC | IEC 61131-3 logic control | TC1200 / TC1300 |
| TwinCAT NC PTP | Point-to-point axis control | TF5000 |
| TwinCAT NC I | Interpolation path control (3D+aux) | TF5100 |
| TwinCAT CNC | G-code CNC system (multi-channel) | TF5200 |
| TwinCAT Robotics | Robot kinematic transforms | TF5420 / TF5430 |
| TwinSAFE | SIL 3 / PLe safety logic | TF1900 |
| TwinCAT Vision | Real-time vision processing | TF7100 - TF7810 |
| TwinCAT Analytics | Process data / ML | TF3500 - TF3830 |
| TwinCAT IoT | MQTT/OPC UA/HTTPS cloud | TF6100 - TF6771 |

## 2.6 C++ Modules

TwinCAT 3 supports **C++ as a first-class programming language**:

- Native VS project system (.vcxproj, supports CMake)
- C++ modules execute within real-time Task
- Data exchange with PLC via ADS or direct symbol mapping
- Architecture: x86/x64, Release/Debug configurations
- Performance: near bare-metal C++ in RT Task

**C++ Module lifecycle**:

1. Create C++ project in VS, include TwinCAT headers
2. Implement entry function (e.g., `tmcTcMain`), register module to TwinCAT Task
3. Compile to DLL
4. Add module to Task via System Manager in TwinCAT project
5. DLL deploys to target IPC with TwinCAT project on download

## 2.7 Hardware Platforms

| Series | Type | CPU Arch | OS |
|--------|------|----------|----|
| CX series (CX7000-CX5600) | Embedded PC | Arm / x86 | Windows 10 IoT / TwinCAT/BSD / RT Linux |
| C series (C6015-C7000) | Industrial PC | x86 / x64 | Windows 10/11 / TwinCAT/BSD / RT Linux |
| CP series | Control Panel | - | HMI front-end |
| CB series | Motherboard | x86 / x64 | OEM embedded |
| MX-System | Cabinet-free pluggable system | - | Integrated EtherCAT + IPC |

All latency/jitter data depends on: Beckhoff EL90xx EtherCAT Master card, Windows 10 Pro with real-time kernel activated, core isolation mode, single EtherCAT master, 1-64 slaves. Beyond 100 slaves or 70% bus bandwidth utilization, cycle/jitter degrade significantly.

## 2.8 Programming Languages

| Language | Type | Notes |
|----------|------|-------|
| IEC 61131-3 ST | Text | Primary language |
| IEC 61131-3 LD | Graphical | Ladder diagram |
| IEC 61131-3 FBD | Graphical | Function block diagram |
| IEC 61131-3 SFC | Graphical | Sequential function chart |
| IEC 61131-3 CFC | Graphical | Continuous function chart |
| IEC 61131-3 IL | Text | Instruction list (phasing out) |
| C++ | Text | TwinCAT 3 C++ Modules |
| MATLAB/Simulink | Graphical | Via TE1400 |
| TwinCAT HMI (JS/HTML5) | Web | HMI frontend development |