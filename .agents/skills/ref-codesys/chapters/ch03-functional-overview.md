# Ch03: Functional Overview

## 3.1 Main Functional Modules

### 3.1.1 CODESYS Control (Runtime System)

Core runtime that transforms general-purpose computing devices into IEC 61131-3 controllers:
- User program execution
- I/O management
- Task scheduling
- Communication protocol stack
- OPC UA server
- Safety functions

### 3.1.2 CODESYS Visualization (HMI)

Multi-layer visualization:

| Product | Description | Deployment |
|---------|-------------|------------|
| TargetVisu | Local HMI on controller-connected display | Controller local |
| WebVisu | Web-based HMI via browser | Web server |
| CODESYS HMI | Standalone HMI project, WinCC-style config | Windows/Linux |

**Visualization features**:
- Shares variable space with IEC 61131-3 application (no OPC config needed)
- Graphical templates, dynamic objects
- Built-in trend charts, alarms, data logging
- Responsive design (WebVisu supports mobile)

### 3.1.3 CODESYS SoftMotion (Motion Control)

| Level | Function | Use Case |
|-------|----------|----------|
| SoftMotion Light | Single-axis positioning, CIA 402 compatible | Simple single-axis |
| SoftMotion | Single & multi-axis synchronized motion (e-cam, e-gear) | Multi-axis linkage |
| SoftMotion CNC+Robotics | Full CNC and robot control | CNC machines, industrial robots |

**SoftMotion key capabilities**:
- PLCopen MotionControl Part 1/2/4 certified FBs
- CAM Editor (electronic cam)
- Electronic Gear
- E-stop, homing, probing
- Position/velocity/torque control modes
- Virtual and logical axes

**CNC+Robotics key capabilities**:
- DIN 66025 (G-Code) 3D CNC editor
- Line/arc/spline/parabola/ellipse interpolation
- Tool Radius Compensation
- Kinematics: gantry, SCARA, parallel robot, 6-axis arm
- PLCopen Motion Part 4 certified FBs
- 3D visualization (CODESYS Depictor)
- DXF import
- Up to 9-axis paths (3 main interp + 5 linear ancillary + 3 spline orientation)

### 3.1.4 CODESYS Safety (Safety Systems)

TÜV pre-certified safety control extension:

| Level | Standard | Use Case |
|-------|----------|----------|
| Safety SIL2 | EN ISO 13849 PL d / IEC 61508 SIL2 | Mobile machinery |
| Safety SIL3 | IEC 61508 SIL3 | Industrial machinery |

- Safety FBD/ST/LD/CFC/UML editors
- Safety runtime isolated from standard runtime
- Safety data exchange protocol
- TÜV pre-certified test framework
- Optional TI RM48 MCU platform adaptation

### 3.1.5 CODESYS Fieldbus (Fieldbus)

- Integrated fieldbus configurator
- Protocol stack libraries (portable)
- EtherCAT, PROFINET, EtherNet/IP, CANopen, Modbus support
- Driver abstraction layer — swap drivers without app code changes

### 3.1.6 CODESYS OPC UA

- OPC UA Server (built-in)
- OPC UA Client (as IEC library)
- OPC UA method calls
- Alarms & Conditions
- PubSub (publish/subscribe)
- Custom information models (Companion Specifications)
- Security: Aes128Sha256RsaOaep, Aes256Sha256RsaPSS
- OPC UA 1.04 certified (TBD latest status)

### 3.1.7 CODESYS Redundancy

- Hot-Standby dual-controller
- Active/passive failover
- Application synchronization
- Status monitoring

### 3.1.8 CODESYS Automation Server (Cloud)

- Remote device management
- Remote app control (start/stop/reset)
- Certificate management
- File management
- Encrypted communication
- Edge gateway alternative

### 3.1.9 CODESYS Professional Developer Edition

- UML modeling (state diagrams, class diagrams)
- Application Composer
- Code analysis tools
- Advanced library management
- Test Manager

## 3.2 Key Workflows

### Scenario 1: OEM Device Integration
1. OEM purchases Runtime Toolkit (SDK)
2. Adapt runtime to hardware (provide Firmware Platform SDK)
3. CODESYS team assists with compilation/linking
4. OEM gets controller firmware with CODESYS capability
5. Optional: brand the IDE (CODESYS Application Platform)

### Scenario 2: Machine Development
1. Download free CODESYS Development System
2. Select target hardware (Wago/Beckhoff/third-party)
3. Write control logic in IEC 61131-3
4. Configure I/O and fieldbus
5. Debug (breakpoints/variable watch)
6. Deploy to device

### Scenario 3: Motion Control Development
1. Configure axes and drives in device tree
2. Write motion logic with SoftMotion FBs
3. Optional: write G-Code with CNC editor
4. Debug with visualization templates
5. Online Config Mode to debug drivers live

## 3.3 Extension Mechanisms

1. **Plugin System** — DI-based, paid license required, distributed via CODESYS Store, revenue sharing
2. **Library System** — OOP code packaging, signed libraries, versioned, online search/install
3. **Scripting API** — automation, project generation/modification, batch operations
4. **C Code Integration** — embed C code in IEC 61131-3 apps via plugin
5. **Device Description Files (DDF)** — XML device parameter description, import into IDE for new device support

## 3.4 AUDESYS Relevance — Functional Design

| CODESYS Module | AUDESYS Analog |
|----------------|---------------|
| Visualization (TargetVisu/WebVisu) | AUDESYS HMI/SCADA in Studio |
| SoftMotion | AUDESYS Simulator (virtual devices) |
| Fieldbus abstraction | AUDESYS HAL protocol adapters |
| OPC UA Server/Client | AUDESYS Runtime OPC UA integration |
| Redundancy | AUDESYS StreamChannel redundancy (D28) |
| Plugin system | AUDESYS Studio plugin/extensibility |
| DDF device description | AUDESYS device capability model |
