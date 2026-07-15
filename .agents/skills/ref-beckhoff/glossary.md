# Beckhoff TwinCAT Glossary

| Term (EN) | Term (CN) | Definition |
|-----------|-----------|------------|
| **ADS** | 自动化设备规范 | Automation Device Specification — TwinCAT's unified communication protocol (Read/Write/Notification over AMS Router) |
| **AMS** | 自动化消息规范 | Automation Message Specification — ADS message routing layer with Port-based addressing |
| **AMS Port** | AMS 端口号 | Unique numeric identifier for each ADS device (350=PLC, 500=NC, 600=CNC) |
| **CFC** | 连续功能图 | Continuous Function Chart — IEC 61131-3 graphical language for free-form function block placement |
| **CoE** | 基于EtherCAT的CANopen | CANopen over EtherCAT — object dictionary access for configuration and diagnostics |
| **EtherCAT** | 以太网控制自动化技术 | Ethernet for Control Automation Technology — Beckhoff's real-time Ethernet protocol (IEC 61158) |
| **ETG** | EtherCAT技术组织 | EtherCAT Technology Group — 7,000+ member organization maintaining EtherCAT standard |
| **FBD** | 功能块图 | Function Block Diagram — IEC 61131-3 graphical language |
| **FSoE** | 基于EtherCAT的安全功能 | FailSafe over EtherCAT — safety protocol achieving SIL 3 / PLe |
| **Index Group** | 索引组 | 16-bit identifier in ADS addressing, categorizing data objects |
| **Index Offset** | 索引偏移 | 32-bit identifier in ADS addressing, pinpointing specific data within a group |
| **IPC** | 工业PC | Industrial PC — standard PC hardware adapted for industrial environments |
| **LD** | 梯形图 | Ladder Diagram — IEC 61131-3 graphical language for electrical engineers |
| **MC3** | 运动控制3代 | TwinCAT MC3 — next-generation motion control architecture (2024, companion to PLC++) |
| **NC** | 数控 | Numerical Control — axis motion control (PTP) and interpolation (NC I) |
| **NC PTP** | 点到点数控 | Point-to-point axis control (single-axis positioning) |
| **NC I** | 插补数控 | Interpolation path control (3D+auxiliary axes) |
| **On-the-fly processing** | 边传输边处理 | EtherCAT frame processing: slaves read/write data as frame passes through, no store-and-forward |
| **PC-based Control** | 基于PC的控制 | Beckhoff's philosophy: standard PC hardware replaces dedicated PLC hardware |
| **Platform Level** | 平台级别 | Beckhoff's licensing tier system (10-94) based on CPU core count |
| **PLC++** | 新一代PLC运行时 | TwinCAT PLC++ — 2024 next-gen PLC runtime with fundamentally rearchitected engine |
| **RMS** | 速率单调调度 | Rate-Monotonic Scheduling — shorter cycle = higher priority, TwinCAT's default scheduling strategy |
| **SFC** | 顺序功能图 | Sequential Function Chart — IEC 61131-3 graphical language for state machines |
| **SIL 3** | 安全完整性等级3 | Safety Integrity Level 3 — industrial safety certification level |
| **SoE** | 基于EtherCAT的伺服协议 | Servo over EtherCAT — servo drive communication protocol |
| **ST** | 结构化文本 | Structured Text — IEC 61131-3 primary text-based programming language |
| **TcCOM** | TwinCAT组件对象模型 | TwinCAT Component Object Model — standardized interface for all runtime modules |
| **TFxxxx** | TwinCAT功能模块 | TwinCAT function module numbering system (100+ modules across 8 categories) |
| **TwinCAT** | Windows控制自动化技术 | The Windows Control and Automation Technology — Beckhoff's software platform |
| **TwinCAT/BSD** | 基于BSD的TwinCAT | TwinCAT on FreeBSD — dedicated RTOS eliminating Windows dependency |
| **TwinSAFE** | TwinCAT安全功能 | TwinCAT safety solution — SIL 3 / PLe safety logic integrated into TwinCAT 3 |
| **XAE** | 扩展自动化工程 | eXtended Automation Engineering — TwinCAT 3 engineering environment (VS-based IDE) |
| **XAR** | 扩展自动化运行时 | eXtended Automation Runtime — TwinCAT 3 runtime environment on target IPC |