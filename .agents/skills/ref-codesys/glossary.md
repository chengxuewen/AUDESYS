# CODESYS Glossary

**Source**: `docs/reference/codesys.md` — Appendix B
**Context**: Key terms for AUDESYS Studio/HAL/Runtime design

---

## Core Architecture Terms

| Term | English | Definition |
|------|---------|------------|
| 运行时系统 | Runtime System | Software layer that executes PLC programs on target devices |
| 软PLC | SoftPLC | Software PLC running on general-purpose computing hardware |
| 语言模型 | Language Model | CODESYS's internal data representation of programming language constructs |
| 代码生成器 | Code Generator | Component that generates target CPU machine code from the language model |
| 设备描述文件 | DDF (Device Description File) | XML file describing device capabilities, importable into IDE |
| 在线修改 | Online Change | Modifying PLC program without stopping the running system |
| 任务调度 | Task Scheduling | Management of PLC program execution cycles (Cyclic/Free-run/Event) |
| 现场总线 | Fieldbus | Sensor-actuator communication networks (EtherCAT, PROFINET, etc.) |

## Communication & Protocol Terms

| Term | English | Definition |
|------|---------|------------|
| OPC UA | Open Platform Communications Unified Architecture | Industrial communication standard; CODESYS has built-in Server/Client |
| IEC 61131-3 | — | International standard for PLC programming languages (5 languages + CFC) |
| EtherCAT | — | Real-time industrial Ethernet fieldbus; CODESYS supports as Master |
| PROFINET | — | Siemens industrial Ethernet; CODESYS supports as Controller/Device |
| EtherNet/IP | — | Rockwell industrial Ethernet; CODESYS supports as Scanner/Adapter |
| CANopen | — | CAN-based fieldbus; CODESYS supports as Master/Slave |
| MQTT | Message Queuing Telemetry Transport | Lightweight publish/subscribe IoT protocol |

## Safety & Certification Terms

| Term | English | Definition |
|------|---------|------------|
| SIL | Safety Integrity Level | IEC 61508 safety integrity levels (SIL2, SIL3) |
| TÜV | Technischer Überwachungsverein | German technical inspection association; CODESYS safety pre-certified |
| EN ISO 13849 PL d | — | European safety standard for machinery; Performance Level d |
| Safety SIL2 | — | CODESYS Safety module certified to IEC 61508 SIL2 / EN ISO 13849 PL d |
| Safety SIL3 | — | CODESYS Safety module certified to IEC 61508 SIL3 |

## IDE & Development Terms

| Term | English | Definition |
|------|---------|------------|
| POU | Program Organization Unit | IEC 61131-3 program organization (Program, Function, Function Block, Variable) |
| DI | Dependency Injection | Framework used by CODESYS plugin architecture |
| DUT | Device Under Test | Target device being programmed/debugged |
| GVL | Global Variable List | IEC 61131-3 global variable declaration |
| PLC Handler Interface | — | CODESYS SDK interface for secondary development |
| CODESYS Store | — | Official app marketplace for libraries, plugins, templates, SoftPLCs |
| CODESYS Forge | — | Developer community and sample code repository |

## Hardware & Platform Terms

| Term | English | Definition |
|------|---------|------------|
| OSAL | OS Abstraction Layer | CODESYS Runtime's hardware-independent OS abstraction |
| Runtime Toolkit | — | OEM SDK for integrating CODESYS runtime into custom hardware |
| SoftMotion | — | CODESYS motion control add-on module |
| SoftMotion CNC+Robotics | — | Full CNC and robotics control module with kinematics |
| vPLC | virtual PLC | Virtualized PLC running in containers/VMs |

## Version & Release Terms

| Term | Definition |
|------|------------|
| Service Pack (SP) | CODESYS major release (e.g., SP21 = V3.5 SP21) |
| CODESYS Essentials | Core component set after SP17 modularization |
| CODESYS go! | Next-gen Web-based IDE released April 2026 (Beta) |
| Component-level versioning | Independent version numbers (4.x.x.x) per plugin since SP18 |
| Single License (SL) | Per-device CODESYS Control license |

## Motion Control Terms

| Term | English | Definition |
|------|---------|------------|
| 电子凸轮 | E-Cam (Electronic Cam) | Software-based cam profile for synchronized motion |
| 电子齿轮 | E-Gear (Electronic Gear) | Software-based gear ratio between axes |
| 刀具半径补偿 | Tool Radius Compensation | CNC machining compensation for tool radius |
| PLCopen MotionControl | — | Standard motion control function block specifications |

---

**AUDESYS Mapping Notes**:
- **OSAL** → AUDESYS HAL amw abstraction layer (D11)
- **DDF** → AUDESYS device capability model (TBD)
- **Language Model** → AUDESYS device configuration model (TBD)
- **SoftMotion** → AUDESYS Simulator virtual devices (Phase 3/4)
- **CODESYS Store** → AUDESYS plugin/library marketplace concept
