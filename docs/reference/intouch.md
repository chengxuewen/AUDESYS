# AVEVA InTouch HMI/SCADA（原 Wonderware）

> AUDESYS 项目参考文档 · 生成日期: 2026-07-13
> 研究来源: AVEVA 官方文档、Wikipedia、行业博客、技术白皮书、InTouch 脚本与逻辑指南、系统规模指南
> 本文档旨在为 AUDESYS HMI 运行时、Studio IDE、配置管理、对象建模及可视化架构的设计提供跨产品参考

---

**📜 历史参考** — 品牌经多次收购重构（Wonderware → Schneider → AVEVA），产品碎片化。OMI 现代化仍在推进。本分析作为 HMI 模板系统和设备绑定的参考。
## 1. 产品画像

### 1.1 公司基本信息

| 维度 | 详情 |
|------|------|
| **产品全称** | AVEVA InTouch HMI（原 Wonderware InTouch） |
| **当前开发商** | AVEVA Group Limited（施耐德电气全资子公司） |
| **原始开发商** | Wonderware Corporation |
| **成立时间** | 1987 年（Wonderware） |
| **创始人** | Dennis Morin 和 Phil Huber |
| **原始总部** | Irvine, California, USA |
| **首次发布** | 1989 年（InTouch 1.0，首个基于 Microsoft Windows 的 HMI） |
| **当前版本** | InTouch 2023 R2 / System Platform 2023 R2（2024 年持续更新） |
| **官方网站** | https://www.aveva.com/en/products/intouch-hmi/ |
| **员工规模** | AVEVA 全球约 6,500+ 人（2023 年私有化后） |

### 1.2 历史沿革与关键里程碑

InTouch 的开发商变迁反映了过去三十余年工业软件行业并购整合的典型路径：

| 时间 | 里程碑 |
|------|--------|
| **1987 年** | Wonderware 在加州 Irvine 成立。创始人 Dennis Morin 和 Phil Huber 来自当地另一家初创公司，怀揣"让工厂操作员也能使用 Windows 监控生产过程"的愿景 |
| **1989 年** | **InTouch 1.0 发布**——工业史上第一个基于 Microsoft Windows 的 HMI/SCADA 软件。在当时的 DOS 主导环境中，Windows 3.0 尚未发布，这一决策极具远见 |
| **1990 年代** | InTouch 迅速成为行业标杆。Wonderware 发布 FactorySuite 集成套件（含 InTouch、InControl、IndustrialSQL Server、InTrack、InBatch），确立"工厂套件"范式 |
| **1998 年** | Wonderware 被英国 Siebe plc 收购 |
| **1999 年** | Siebe 与 BTR plc 合并为 **Invensys plc**，Wonderware 成为 Invensys 子公司 |
| **2014 年 1 月** | **施耐德电气**（Schneider Electric）以 £34 亿收购 Invensys，Wonderware 并入 Schneider Electric Software 业务部 |
| **2018 年 3 月** | Schneider Electric 将其工业软件业务与 **AVEVA**（英国剑桥的工程软件公司）合并，形成全球领先的工业软件企业。Wonderware 品牌正式退役 |
| **2021 年** | AVEVA 以 $50 亿收购 OSIsoft（PI System 所有者）——这是工业软件史上最大收购之一。Historian 与 PI System 同属一家 |
| **2023 年 1 月** | Schneider Electric 完成对 AVEVA 剩余股份的收购（约 41%），AVEVA 从伦敦证券交易所退市，**完全私有化** |
| **2024 年 6 月** | AVEVA 发布 **InTouch Unlimited** 新定价策略，取消 Tag 数量限制，推出订阅制许可，开发工具免费 |

**创始人现状**: Phil Huber 至今活跃于创业圈和技术会议；Dennis Morin 于 2012 年底去世。

### 1.3 历史地位与技术影响力

InTouch 在工业自动化领域的历史地位无法被高估：

1. **首创 Windows HMI 范式**：在 DOS 时代率先押注 Windows 平台，定义了"图形化工厂操作界面"的标准。WindowMaker（开发环境）+ WindowViewer（运行环境）的 IDE/Runtime 分离设计，影响了其后几乎所有 HMI 产品。
2. **Tag-based 数据模型的行业标准**：InTouch 的 Tagname Dictionary（标签名字典）定义了 HMI 数据管理的基本范式——每个数据点有一个名字、类型、报警属性、历史记录配置。此模型被 iFIX、WinCC、Citect 等广泛借鉴。
3. **ArchestrA 面向对象革命**：2000 年代初发布的 ArchestrA 框架，将传统平面 Tag 模型升级为面向对象的层次化模型（Object-based Automation），推出了 Galaxy Repository（统一配置数据库）、Application Server（分布式运行时）。这是工业 SCADA 从"填表画图"到"软件工程"的转折。
4. **FactorySuite 集成套件**：行业最早的"一站式"工业软件套件，HMI + 软 PLC + 数据库 + 追溯 + 批处理的预集成模式，对后来的 FactoryTalk、SIMATIC 产品线产生了深远影响。
5. **最大的 HMI 安装基础**：据行业估计，Wonderware/AVEVA 在全球 HMI/SCADA 市场占据约 **1/3 的安装基础**，在流程工业（食品饮料、水处理、油气、化工、制药）中尤为突出。

### 1.4 产品线全景

AVEVA 当前的 HMI/SCADA 产品组合经历了品牌统一和架构重构：

| 产品 | 定位 | 前身 | 核心特性 |
|------|------|------|----------|
| **InTouch HMI** | 经典 PC 端 HMI | Wonderware InTouch | Tag-based 可视化，WindowMaker + WindowViewer，QuickScript 脚本 |
| **InTouch Unlimited** | 全功能 HMI/SCADA（新定价模型） | — | 无限 Tag/客户端/可扩展性，含 Historian + Reporting，订阅/永久许可可选 |
| **InTouch Edge HMI** | 嵌入式/设备级 HMI | Wonderware InTouch Machine Edition (原 InduSoft) | Windows Embedded OS 部署，紧凑型可视化，OEM 场景 |
| **System Platform** | 企业级 SCADA 平台 | Wonderware System Platform (原 ArchestrA) | Galaxy 集中管理，对象模板，多工程师协作，分布式部署 |
| **Operations Management Interface (OMI)** | 现代 Web/响应式可视化 | — | HTML5 可视化框架，跨设备自适应，情境感知 UI |
| **AVEVA Operations Control** | 订阅制全栈操作控制套件 | — | 零 Tag/IO/服务器限制，含全功能 Historian + Reporting + 分析 |
| **Historian** | 工业时序数据库 | Wonderware Historian (原 IndustrialSQL Server) | 高性能时序数据存储，Block 技术，比标准 SQL 快数百倍 |
| **AVEVA Edge** | 低成本 HMI/嵌入式 | InduSoft Web Studio | 独立产品线，面向价格敏感的低端场景 |

### 1.5 InTouch vs System Platform 定位差异

这是新接触 AVEVA 产品线者最易混淆的问题：

| 维度 | InTouch Classic | System Platform |
|------|----------------|-----------------|
| **数据模型** | 平面 Tag 模型（Tagname Dictionary） | 面向对象模型（ArchestrA Object） |
| **配置管理** | 本地文件（每台机器独立） | Galaxy 集中式数据库 |
| **多工程师协作** | 有限（NAD 手动同步） | 完全（同 Galaxy 多用户检出/检入） |
| **符号/模板** | 基础 Wizards | ArchestrA Industrial Graphics（对象模板 + 图形符号） |
| **部署模型** | 独立单机或 NAD 分发 | Galaxy 部署/撤销部署工作流 |
| **安装体积** | ~4.5 GB（即使仅装 InTouch 也需 System Platform 仓库） | ~4.5 GB+ |
| **学习曲线** | 低（1-2 天入门） | 高（建议正式培训） |
| **适用规模** | 单机到中小型系统 | 多节点企业级 |

> **关键须知**: 即使仅安装 InTouch Classic，也必须安装完整的 System Platform 安装仓库（~4.5 GB）。这是工程师常见的困惑点——预期轻量 HMI 安装，实际需要下载庞大的平台包。

### 1.6 商业许可模型

AVEVA InTouch 的许可历史本身就是一个行业缩影，经历了"按点计价 → 阶梯升级 → 无限许可 → 订阅制"的演进：

| 许可模型 | 详情 |
|----------|------|
| **历史模型**（1989-2024） | 永久许可（Perpetual License），按 Tag 阶梯定价：100/256/512/1000/3000/8000/32K/64K。升级时旧许可作废，新许可重新购买（"discard & replace"） |
| **当前模型**（2024+） | **InTouch Unlimited**：无限 Tag + 无限客户端 + 无限可扩展性。永久许可（Standard/Professional）和订阅制（Premier）可选。开发工具免费 |
| **定价参考** | InTouch Unlimited Standard: ~$12,000；Professional: ~$20,000；Workstation 1K: ~$1,795（均待确认，实际价格通过 AVEVA 合作伙伴报价） |
| **Premier 订阅** | 在 Professional 功能基础上增加 Unlimited Historian |
| **Operations Control** | 仅订阅制，零 Tag/IO/服务器限制，含 AI/分析能力 |
| **生命周期** | 完整支持约 5 年 + 有限支持 2 年 → 技术支撑（仅知识库和基本诊断） |
| **Flex 订阅** | AVEVA 转向信用点/订阅模型，跨云/混合/本地部署 |

---

## 2. 技术特性

### 2.1 核心架构总览

AVEVA System Platform 的架构可以归纳为**五层模型**：

```
┌──────────────────────────────────────────────────────────────┐
│                    可视化层（Visualization）                     │
│  ┌─────────────┬──────────────────┬──────────────────────┐   │
│  │ InTouch HMI  │    InTouch OMI   │  InTouch Access      │   │
│  │ (WindowViewer)│ (HTML5 Web 客户端)│  Anywhere (RDP/Web) │   │
│  └─────────────┴──────────────────┴──────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│                    应用服务层（Application Server）              │
│  ┌──────────────────┬────────────────────────────────────┐   │
│  │  ArchestrA IDE    │   Application Engines (AppEngine)   │   │
│  │  (开发环境)        │   - 报警引擎                         │   │
│  │  - Symbol Editor  │   - 历史引擎                         │   │
│  │  - Object Editor  │   - 脚本引擎 (.NET)                  │   │
│  │  - Galaxy Browser │   - I/O 引擎                         │   │
│  └──────────────────┴────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│                    配置管理层（Galaxy Repository）            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Galaxy Repository (GR Node)                            │  │
│  │  - Microsoft SQL Server 数据库                          │  │
│  │  - 统一命名空间（Global Namespace）                       │  │
│  │  - 对象 / 模板 / 图形符号 / 安全配置                       │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                    通信中间件层（Communications）              │
│  ┌─────────┬───────────┬───────────┬──────────────────────┐ │
│  │SuiteLink│ DDE/FastDDE│OPC DA/UA │ MQTT / REST / ODBC  │ │
│  │(TCP/IP) │ (Legacy)  │(DA Server)│ (Gateway / Adapter) │ │
│  └─────────┴───────────┴───────────┴──────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                    现场设备层（Field Devices）                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  PLC (AB/Siemens/Omron/Mitsubishi/...)、RTU、DCS、       │  │
│  │  智能仪表、条码扫描器、RFID、视觉系统、机器人               │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 ArchestrA 面向对象自动化框架

ArchestrA 是 Wonderware 2002 年前后推出的面向对象自动化框架，后来演变为 System Platform 的技术核心。它解决了传统 Tag 模型的三大根本性问题：

**问题 1：平面 Tag 爆炸**
传统 InTouch 应用中，一个水泵需要 20+ 个 Tag（运行状态、转速、电流、温度、报警设定值、维护计时器等）。10 个水泵 = 200+ 个独立 Tag，每种 Tag 的报警属性、历史记录配置、动画链接必须在 WindowMaker 中逐个手工创建。

**问题 2：工程不可复用**
如果在工厂 A 为水泵写好了全部逻辑，在工厂 B 使用"相同的"水泵时需要从头创建所有 Tag——Tag 模型不支持模板化和继承。

**问题 3：部署与运维割裂**
Tag 配置存在于每台 View Node 的本地文件中。修改一个报警阈值需要更新所有受影响的 View Node，没有中央配置管理和变更同步机制。

**ArchestrA 的解决方案**：

```
┌─────────────────────────────────────────────────────────────┐
│                   ArchestrA Object Template                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  $Pump (Base Template)                                   ││
│  │  - Attributes:                                           ││
│  │    Running: Boolean     (I/O → PLC.DI_001)               ││
│  │    Speed: Real          (I/O → PLC.AI_001)               ││
│  │    Current: Real        (I/O → PLC.AI_002)               ││
│  │    Temperature: Real    (I/O → PLC.AI_003)               ││
│  │    AlarmHigh: Real      (Memory, Default=85.0)           ││
│  │    RuntimeHours: Integer(Memory)                         ││
│  │  - Scripts:                                              ││
│  │    OnTrue Alarm Condition → Generate Alarm               ││
│  │  - Graphics:                                             ││
│  │    PumpSymbol (Industrial Graphic)                        ││
│  │  - Inheritance:                                          ││
│  │    └─ $Pump_TypeA (Derived) → Speed.Max = 3000          ││
│  │       └─ Pump_Line1_001 (Instance) → I/O mapping deployed ││
│  │       └─ Pump_Line1_002 (Instance)                       ││
│  │       └─ Pump_Line2_001 (Instance)                       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**关键概念**：

| 概念 | 说明 | 类比 |
|------|------|------|
| **Template（模板）** | 定义一类设备/过程的属性、脚本、图形的蓝图 | OOP 中的 Class |
| **Derived Template（派生模板）** | 基于父模板的扩展/定制 | OOP 中的 Subclass |
| **Instance（实例）** | 模板的具体运行期对象，映射到实际 I/O 地址 | OOP 中的 Object Instance |
| **Containment（包容）** | 对象可以包含子对象，形成层次结构（泵 → 罐区 → 车间 → 工厂） | OOP 中的 Composition |
| **Area（区域）** | 对象的组织分组，用于报警管理、安全权限 | — |
| **Deployment（部署）** | 将对象实例指定到特定节点的特定 AppEngine 上运行 | — |
| **Galaxy（星系）** | 所有模板/实例/图形/安全配置的统一逻辑命名空间 | — |

### 2.3 Galaxy Repository — 统一配置数据库

Galaxy 是 System Platform 的**集中式配置数据库**，基于 Microsoft SQL Server。它是 ArchestrA 对象模型的物理载体。

**Galaxy 架构特性**：

```
┌──────────────────────────────────────────────────────────────┐
│                      Galaxy Repository                        │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    GR Node (SQL Server)                   ││
│  │  ┌─────────────┬─────────────┬─────────────┬────────────┐││
│  │  │  Objects DB  │ Graphics DB │ Security DB │ History DB │││
│  │  │ - Templates  │ - Symbols   │ - Users     │ - Versions │││
│  │  │ - Instances  │ - Wizards   │ - Roles     │ - Audit    │││
│  │  │ - Attributes │ - Layouts   │ - Perms     │            │││
│  │  └─────────────┴─────────────┴─────────────┴────────────┘││
│  └──────────────────────────────────────────────────────────┘│
│                            ↕                                  │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              IDE Node (ArchestrA IDE)                     ││
│  │  - 多工程师同时检出/检入（Check-Out / Check-In）           ││
│  │  - 对象版本管理                                           ││
│  │  - 部署前验证                                             ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Galaxy 的关键设计原则**：

1. **单一数据源（Single Source of Truth）**：所有配置数据（对象、模板、图形、安全）来自一个 SQL Server 数据库，避免文件同步问题。
2. **多用户开发**：多个工程师可以同时开发同一 Galaxy，通过检出/检入机制管理冲突。模板变更可被所有使用者继承。
3. **集中部署**：从 IDE 中选择"Deploy"，对象被推送到指定的 AppEngine 节点。撤销部署（Undeploy）反向操作。
4. **命名空间隔离**：Galaxy 提供全局命名空间，所有对象引用使用 Galaxy 级别的名称——跨节点引用不需要知道物理位置。

> **复杂度警告**：Galaxy 引入的管理开销显著。"卸载/重新安装"和"撤销部署/重新部署"是常见的故障排除步骤。对于仅需单机 HMI 的小项目，Galaxy 的管理开销可能比其带来的好处更大。

### 2.4 WindowMaker 与 WindowViewer — IDE/Runtime 分离设计

这是 InTouch 最具影响力的设计决策之一，也是 AUDESYS Studio ↔ Runtime 最直接的对标对象。

```
┌──────────────────────────────────────────────────────────────┐
│                    开发阶段（Design Time）                      │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  WindowMaker (IDE)                                        ││
│  │  - 图形对象编辑器（矢量图形、位图、Symbol、Wizard）         ││
│  │  - Tagname Dictionary（标签名字典）                        ││
│  │  - QuickScript 编辑器（7 种脚本类型）                       ││
│  │  - 报警配置（分布式报警系统）                               ││
│  │  - 历史趋势配置                                           ││
│  │  - 安全配置（基于操作系统用户/组）                           ││
│  │  - I/O Access Name 配置（SuiteLink/DDE/OPC 远程连接）      ││
│  └──────────────────────────────────────────────────────────┘│
│                            ↓ 保存                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  应用文件（Application Directory）                         ││
│  │  - *.win（窗口定义）                                       ││
│  │  - tagname.x（标签数据库）                                 ││
│  │  - *.dbg（调试/安全信息）                                  ││
│  └──────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│                    运行阶段（Runtime）                         │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  WindowViewer (Runtime)                                   ││
│  │  - 加载应用文件到内存                                      ││
│  │  - 读取 Tag 值（本地 Memory Tag / 远程 I/O Tag）           ││
│  │  - 执行脚本（基于 7 种触发器）                              ││
│  │  - 动画链接求值（Animation Links）                         ││
│  │  - 报警检测与通知                                          ││
│  │  - 历史数据记录（Logging）                                  ││
│  │  - 与 Application Server / Galaxy 通信                     ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**InTouch 应用类型演进**：

| 应用类型 | 创建方式 | 管理方式 | 支持 ArchestrA Graphics | 使用场景 |
|----------|---------|---------|------------------------|---------|
| **Standalone Application** | Application Manager | Application Manager | 有限（可嵌入 Industrial Graphics） | 传统单机 HMI |
| **Managed Application** | ArchestrA IDE（InTouchViewApp 对象） | ArchestrA IDE | 完全 | 集成到 System Platform |
| **InTouchView Application** | Application Manager 或 IDE | Application Manager | — | 纯可视化节点（逻辑在 Application Server） |

**Managed Application 工作流**：
1. 在 ArchestrA IDE 中创建 $InTouchViewApp 的派生模板
2. 从派生模板创建实例
3. 在 Symbol Editor 中创建 Industrial Graphics
4. 从 IDE 打开 WindowMaker 编辑窗口，嵌入 Industrial Graphics
5. 部署 → WindowViewer 加载应用

**快速切换（Fast Switch）**：WindowMaker 和 WindowViewer 之间支持快速切换，开发者可以在编辑后立即在 Runtime 中测试——类似于现代前端框架的 Hot Reload 概念。

### 2.5 Tag 数据模型

InTouch 的 Tag 模型是 HMI 行业的标准范式，值得 AUDESYS 深入研究——包括其演进路径中的经验教训。

#### 2.5.1 Tag 类型体系

```
┌──────────────────────────────────────────────────────────────┐
│                     InTouch Tag 类型                           │
├──────────────────────────────────────────────────────────────┤
│  按数据源分类:                                                 │
│  ┌─────────────────┬─────────────────────────────────────┐   │
│  │  Memory Tag      │ 内部变量，WindowViewer 内存驻留        │   │
│  │  - Discrete      │  布尔型 (0/1, On/Off, True/False)    │   │
│  │  - Integer       │  32 位有符号整数 (-2,147,483,648~)    │   │
│  │  - Real          │  64 位浮点数                          │   │
│  │  - Message       │  最长 131 字符的字符串                 │   │
│  ├─────────────────┼─────────────────────────────────────┤   │
│  │  I/O Tag         │ 外部数据源（PLC/RTU/远程节点）         │   │
│  │  - I/O Discrete  │  通过 SuiteLink/DDE/OPC 读写的布尔     │   │
│  │  - I/O Integer   │  通过 SuiteLink/DDE/OPC 读写的整数     │   │
│  │  - I/O Real      │  通过 SuiteLink/DDE/OPC 读写的浮点     │   │
│  │  - I/O Message   │  通过 SuiteLink/DDE/OPC 读写的字符串   │   │
│  └─────────────────┴─────────────────────────────────────┘   │
│  按特殊用途分类:                                               │
│  ┌─────────────────┬─────────────────────────────────────┐   │
│  │  Indirect Tag    │ 标签指针——运行时通过 .Name 属性重定向   │   │
│  │  Hist Trend Tag  │ 历史趋势图引用                         │   │
│  │  Tag ID Tag      │ 标签标识符，用于运行时分配趋势画笔       │   │
│  │  Group Var Tag   │ 已废弃（仅向后兼容 v7.11-）             │   │
│  │  SuperTag        │ 标签模板——关联标签组的数据结构模板       │   │
│  └─────────────────┴─────────────────────────────────────┘   │
│  系统 Tag:                                                    │
│  ┌─────────────────┬─────────────────────────────────────┐   │
│  │  $System Tag     │ 系统预定义，$ 前缀标识，不可删除        │   │
│  │  $DateString    │  当前日期字符串                         │   │
│  │  $TimeString    │  当前时间字符串                         │   │
│  │  $AccessLevel   │  当前用户安全级别                       │   │
│  │  $Operator      │  当前登录用户名                         │   │
│  │  $NewAlarm      │  新报警标志                             │   │
│  │  $LogicRunning  │  脚本执行状态（可读写）                  │   │
│  │  ...            │  共计 100+ 系统 Tag                     │   │
│  └─────────────────┴─────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

#### 2.5.2 Tag 的关键属性

每个 InTouch Tag 可配置的属性包含：

| 属性类别 | 子属性 | 说明 |
|----------|--------|------|
| **基本属性** | Tagname、Comment、Type | 唯一标识名、注释、数据类型 |
| **报警属性** | Alarm Group、Alarm State、Priority | 报警组、报警值设定（HH/HI/LO/LOLO）、优先级 1-999 |
| **历史属性** | Log Data、Log Deadband、Retentive | 是否记历史、记录死区、是否记忆断电前状态 |
| **I/O 属性** | Access Name、Item Name | 远程数据源连接（指定通信服务器和变量地址） |
| **事件属性** | Log Events、Event Priority | 是否记录事件（Tag 值变化来源记录）、事件优先级 |
| **安全属性** | Minimum Access Level | 读写此 Tag 所需的最低安全级别 |
| **扩展属性** | Dotfields（.field 后缀属性） | 运行时动态访问 Tag 子状态：.Alarm、.Quality、.TimeStamp、.HiLimit 等 |

#### 2.5.3 Tag-based → Object-based 的演进

这是 InTouch 历史中最重要的技术教训，直接对应 AUDESYS D7（避免 Tag 中心设计）的决策：

| 阶段 | 模型 | 优势 | 局限 |
|------|------|------|------|
| **Tag-based**（InTouch 1.0-9.x） | 全局扁平 Tag 列表 | 简单直观、概念清晰 | 工程不可复用、Tag 爆炸、无层次结构 |
| **SuperTag**（InTouch 7.0+） | Tag 模板（关联 Tag 组） | 部分复用、结构模板化 | 仅数据结构模板，无行为封装、无继承 |
| **ArchestrA Object**（System Platform 1.0+） | 面向对象（属性 + 脚本 + 图形） | 继承、多态、部署管理 | 学习曲线陡峭、过度工程风险 |
| **InTouch Unlimited**（2024+） | 混合模型（Unlimited Tags + Object Templates） | 简化对象创建、模板自动生成 | 构建中，向后兼容 |

### 2.6 QuickScript 脚本引擎

QuickScript 是 InTouch 的私有脚本语言，语法接近 Visual Basic，但编译和运行环境完全嵌入 WindowViewer。

#### 2.6.1 七种脚本类型（按触发器分类）

| 脚本类型 | 触发器 | 典型用途 |
|----------|--------|----------|
| **Application Script** | On Startup / While Running / On Shutdown | 初始化变量、后台循环逻辑、系统状态维护 |
| **Window Script** | On Show / While Showing / On Hide | 窗口级逻辑（加载数据、定时刷新、释放资源） |
| **Key Script** | On Key Down / While Down / On Key Up | 键盘快捷键、自定义热键 |
| **Condition Script** | On True / While True / On False / While False | 基于 Tag 值的条件逻辑（如 IF PumpFail THEN alarm()） |
| **Data Change Script** | Tag 值变化（仅一次） | 报警处理、计算联动、事件响应 |
| **Action Script** | 操作员点击图形对象（一次/周期性） | 按钮动作、画面导航、命令下发 |
| **ActiveX Event Script** | ActiveX 控件事件（如 Click/DoubleClick） | 第三方控件集成 |

#### 2.6.2 QuickScript 语言特性

```
// 基本语法示例 —— 条件脚本：OnTrue for Alarm_Pump_Fail
IF Alarm_Pump_Fail AND NOT Ack_Required THEN
    Ack_Required = 1;
    Ack_Operator = WhoAmI();         // 获取当前 Windows 用户
    Ack_Time = StringFromTime(Time(), 3);
    
    // 发送邮件通知
    SendEmail("operator@company.com", 
               "Pump Alarm", 
               "Pump 1 has failed at " + StringFromTime(Time(), 3));
ENDIF;

// 间接 Tag 使用示例 —— 运行时动态切换 I/O 绑定
IF PumpNo == 1 THEN
    IndPumpRPM.Name = "PumpRPM1";
ELSE
    IndPumpRPM.Name = "PumpRPM2";
ENDIF;

// 访问 Tag 的 .field 属性
// MyTag.Alarm      — 报警状态
// MyTag.Quality    — 数据质量
// MyTag.TimeStamp  — 时间戳
// MyTag.HiLimit    — 高报警限值
```

**关键语言特性**：

| 特性 | 说明 |
|------|------|
| **内置函数库** | 数学函数、三角函数、字符串函数、文件 I/O、SQL 访问、DDE 通信、报警管理 |
| **QuickFunction** | 可复用的自定义函数，存储在 QuickFunction 库中 |
| **OLE 对象调用** | 通过 OLE 访问原生 Windows 功能（注册表读写、对话框、外部程序启动） |
| **ActiveX 集成** | 可以嵌入和使用几乎任何 Windows ActiveX 控件 |
| **$LogicRunning 控制** | 运行时暂停/恢复所有同步脚本执行 |
| **异步 vs 同步** | 异步脚本不阻塞 UI 线程；数据变更脚本为同步执行 |

#### 2.6.3 脚本演进：QuickScript → QuickScript.NET

InTouch 10.0 开始引入 QuickScript.NET，在传统 QuickScript 基础上增加：
- **.NET 函数支持**：可以直接调用 .NET Framework 库函数
- **C# 脚本能力**：在 ArchestrA 脚本中使用 C# 语法
- **增强的调试**：IDE 内步进调试、断点、变量查看

### 2.7 通信架构 — I/O Server 模型

InTouch 的通信架构是其与 PLC/设备交互的枢纽，经历了从 DDE 到 SuiteLink 再到 OPC UA 的演进。

#### 2.7.1 通信协议栈

```
┌──────────────────────────────────────────────────────────────┐
│                    InTouch 通信层                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │            InTouch Application (WindowViewer)         │    │
│  │              I/O Tags (Access Name + Item Name)       │    │
│  └────────────────────┬─────────────────────────────────┘    │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐    │
│  │              Access Name 抽象层                         │    │
│  │  ┌──────────┬───────────┬───────────┬──────────┐      │    │
│  │  │ SuiteLink │ DDE/FastDDE│OPC DA/UA │ MQTT     │      │    │
│  │  │ (TCP/IP)  │ (Legacy)  │ (DA Server)│          │      │    │
│  │  └──────────┴───────────┴───────────┴──────────┘      │    │
│  └────────────────────┬─────────────────────────────────┘    │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐    │
│  │              I/O Server 层                             │    │
│  │  ┌────────────────────────────────────────────────┐   │    │
│  │  │  DA Server / OI Server / FSGateway             │   │    │
│  │  │  - DASABCIP    (Allen-Bradley EtherNet/IP)     │   │    │
│  │  │  - DASSIDIR    (Siemens S7 via TCP)            │   │    │
│  │  │  - DASMBSerial (Modbus RTU/ASCII Serial)       │   │    │
│  │  │  - DASMBTCP    (Modbus TCP)                    │   │    │
│  │  │  - OI Gateway  (OPC 到 SuiteLink 桥接)          │   │    │
│  │  │  - FSGateway   (通用数据访问网关)                │   │    │
│  │  └────────────────────────────────────────────────┘   │    │
│  └────────────────────┬─────────────────────────────────┘    │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐    │
│  │              物理设备层                                │    │
│  │  PLC | RTU | DCS | 智能仪表 | 条码器 | 其他设备       │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

#### 2.7.2 通信协议对比

| 协议 | 传输层 | 特性 | 当前状态 |
|------|--------|------|----------|
| **SuiteLink** | TCP/IP | VTQ（Value/Time/Quality）、高性能、详细诊断 | 推荐（工业级 TCP 通信） |
| **DDE（Dynamic Data Exchange）** | Windows 消息 | 传统 Windows 进程间通信 | 已过时，仅向后兼容 |
| **FastDDE** | Windows 消息 | DDE 的改进版（减少消息数） | 缓慢淘汰 |
| **NetDDE** | NetBIOS | DDE 的网络扩展 | 已淘汰 |
| **OPC DA（Data Access）** | COM/DCOM | 工业标准数据访问 | 成熟稳定，广泛使用 |
| **OPC UA（Unified Architecture）** | TCP/HTTPS | 平台无关、安全、可扩展 | 当前主流（InTouch 可作为 OPC UA Server） |
| **MQTT** | TCP | IoT 协议，轻量级发布/订阅 | 新增支持（2023+） |
| **Access Name** | 抽象层 | 逻辑连接名，屏蔽协议差异 | 核心设计 |

**Access Name 机制**：
Access Name 是 InTouch 通信架构的关键抽象——每个 Access Name 定义了 InTouch 到 I/O Server 的一条逻辑连接（协议 + 节点名 + 应用名 + 主题名）。在 WindowMaker 中配置 I/O Tag 时只需指定 Access Name 和 Item Name，无需了解底层协议细节。运行时可通过 `IOSetAccessName()` 函数切换到备用 I/O Server。

#### 2.7.3 InTouch as OPC UA Server

从 InTouch 2023 开始，InTouch 可以作为 OPC UA Server 对外暴露数据：
- 将 InTouch Tag 作为 OPC UA 变量节点发布
- 支持 OPC UA Data Access 规范
- 允许第三方 OPC UA Client（如 Ignition、上位 MES）直接读取 InTouch 数据
- 安全：支持证书认证和加密通信

### 2.8 InTouch OMI（Operations Management Interface）

OMI 是 AVEVA 对现代 Web 可视化的答案，解决了传统 WindowViewer 只能在 Windows 桌面运行的局限性。

**OMI 核心特性**：

| 特性 | 说明 |
|------|------|
| **HTML5 原生** | 基于 Web 技术栈，在任何现代浏览器中运行，无需 ActiveX 或插件 |
| **响应式设计** | 一次构建，自适应部署到桌面、平板、手机、大屏 |
| **情境感知 UI** | 根据用户角色、设备类型、当前位置自动调整显示内容 |
| **App 架构** | OMI Apps 是可嵌入的卡片式功能单元（趋势、报警、地图、KPI），通过插件机制扩展 |
| **动态自动生成** | 根据模板定义自动生成画面，避免为一类设备重复绘制 |
| **多用户协作** | 多工程师同时在云端或本地开发同一应用 |
| **现代 UX** | 弹出式侧面板、多级窗口结构、手势控制（缩放/平移）、历史回放 |
| **Situational Awareness** | 基于 ISA-101 标准的情境感知色彩方案和导航模式 |

**OMI 与 WindowViewer 的关系**：
OMI 不是 WindowViewer 的替代品，而是新增的可视化选项。传统 InTouch 应用可在 WindowViewer 中继续运行，OMI ViewApp 可混合在同一个 System Platform 项目中。

### 2.9 InTouch Edge HMI

InTouch Edge HMI（前身 InTouch Machine Edition / InduSoft）定位于嵌入式和小型化 HMI 市场：

| 维度 | InTouch Edge HMI | InTouch Classic |
|------|-----------------|-----------------|
| **目标平台** | Windows Embedded OS、嵌入式面板 | Windows Desktop/Server |
| **安装体积** | 紧凑（< 500 MB） | ~4.5 GB |
| **许可模型** | 按设备许可，低成本 | 按 Tag/节点许可 |
| **对象模板** | 有限 | 完全（ArchestrA） |
| **适用场景** | OEM 设备嵌入式面板、小型本地 HMI | 控制室操作站、企业级 SCADA |
| **通信协议** | OPC UA、Modbus、MQTT、60+ 协议 | SuiteLink + DA/OPC Servers |

### 2.10 分布式架构

System Platform 支持从单机到大规模分布式系统的灵活伸缩：

```
┌──────────────────────────────────────────────────────────────┐
│            企业级 System Platform 分布式部署                   │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    企业网络层                             │ │
│  │  ┌─────────────────────────────────────────────────────┐│ │
│  │  │ AVEVA Connect / PI System / ERP / MES / Cloud      ││ │
│  │  └─────────────────────────────────────────────────────┘│ │
│  └────────────────────┬────────────────────────────────────┘ │
│                       │                                       │
│  ┌────────────────────▼────────────────────────────────────┐ │
│  │                    GR Node                               │ │
│  │  Galaxy Repository (SQL Server) + Historian Server      │ │
│  │  ← 集中配置 + 历史数据 + 冗余配置                         │ │
│  └────────────────────┬────────────────────────────────────┘ │
│                       │                                       │
│     ┌─────────────────┼─────────────────┐                    │
│     ▼                 ▼                  ▼                    │
│  ┌─────────┐    ┌──────────┐    ┌──────────────┐             │
│  │AppEngine1│    │AppEngine2│    │ RDS / Web    │             │
│  │ (Primary)│    │ (Primary)│    │ (Terminal     │             │
│  │ - Area A │    │ - Area C │    │  Services)    │             │
│  │ - Area B │    │ - Area D │    │ (15-30 会话)  │             │
│  └────┬────┘    └────┬─────┘    └──────┬───────┘             │
│       │              │                 │                      │
│  ┌────▼────┐    ┌────▼─────┐    ┌─────▼────────┐             │
│  │AppEngine1│    │AppEngine2│    │ InTouch OMI  │             │
│  │ (Backup) │    │ (Backup) │    │ ViewApps     │             │
│  └─────────┘    └──────────┘    │ (HTML5 客户端)│             │
│                                 └──────────────┘             │
│                       │                                       │
│  ┌────────────────────▼────────────────────────────────────┐ │
│  │                  现场设备与 I/O                           │ │
│  │  PLC / RTU / 智能仪表 (通过 DA Server / OPC UA)         │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**分布式关键概念**：

| 概念 | 说明 |
|------|------|
| **WinPlatform** | 每个物理/虚拟计算机在 Galaxy 中的代表对象 |
| **AppEngine** | 应用程序引擎——运行 Automation Object 的后台服务。建议每个逻辑处理器不超过 2 个 AppEngine |
| **ViewEngine** | 可视化引擎——管理 InTouch/OMI ViewApp 的后台服务 |
| **Area** | 对象的组织分组，决定对象在哪个 AppEngine 上运行 |
| **冗余** | AppEngine 支持 Primary/Backup 对，自动故障转移（~15 秒） |
| **NAD** | Network Application Development——传统 InTouch 应用的网络分发机制 |
| **RDS（Remote Desktop Services）** | 终端服务部署——15-30 并发会话的远程桌面访问 |
| **InTouch Access Anywhere** | 基于 HTML5 的远程桌面访问（无需 RDP 客户端） |

**部署模型建议**：

| 应用规模 | I/O 点数 | 推荐架构 | 冗余 |
|----------|---------|---------|------|
| 小型 | < 25,000 | 单节点 All-in-One | 无需 |
| 中型 | 50,000-200,000 Historized Tags | Client-Server + 冗余 AppEngine | Primary/Backup |
| 大型 | > 200,000 Historized Tags | 多 AppEngine + 分布式 GR + RDS | 全冗余 |
| SCADA（广域网） | 分层架构 | Tier-2 Historian 汇总 | 多层次冗余 |

### 2.11 安全模型

InTouch 的安全基于以下层次架构：

| 安全层 | 实现方式 | 说明 |
|--------|---------|------|
| **操作系统认证** | Windows Active Directory / LDAP / Local Users | 推荐使用 AD——集中管理，避免每台机器单独维护用户 |
| **ArchestrA 安全** | Galaxy 级基于角色的访问控制（RBAC） | 关系型安全——定义用户与 Galaxy 对象/功能的操作权限 |
| **应用级安全** | WindowViewer 安全脚本 + $AccessLevel 系统 Tag | 运行时根据用户级别显示/隐藏功能 |
| **Tag 级安全** | Tagname Dictionary 的 Minimum Access Level | 控制谁可以读写特定 Tag |
| **网络安全** | TLS 节点到节点加密 | InTouch 节点、GR、AppEngine 之间通信加密 |
| **AVEVA Identity Manager** | 集中身份管理（与 AVEVA Connect 集成） | 单点登录（SSO）、云认证 |
| **审计追踪** | Galaxy Audit Trail + InTouch Log | 记录所有操作日志和配置变更 |
| **21 CFR Part 11** | 电子签名 + 审计追踪 + 不可否认性 | 制药和生命科学合规 |
| **Patch Management** | 集中补丁管理——从中央节点推送更新到所有联网机器 | 减少运维窗口 |

---

## 3. 功能概览

### 3.1 可视化（Visualization）

InTouch 提供工业 HMI 最成熟的可视化能力：

| 功能 | 技术实现 | 说明 |
|------|---------|------|
| **矢量图形** | WindowMaker 内置图元（线条、矩形、椭圆、多边形、文本） | 支持渐变填充、透明度、旋转、缩放 |
| **位图/图像** | BMP、JPG、PNG、SVG（2023+） | 设备照片、流程图、厂区布局 |
| **符号库（Symbol Library）** | 预置 ISA 标准符号（泵、阀、电机、储罐、传送带） | 开箱即用，减少 80% 工程工作量（AVEVA 声称） |
| **工业图形（Industrial Graphics）** | ArchestrA Symbol Editor 创建，对象化封装 | 嵌入式动画、数据绑定、模板化 |
| **Wizard** | 预配置的复合对象（如报警浏览器、趋势控件、仪表盘） | 拖放即可使用 |
| **动画链接（Animation Links）** | 值显示、颜色变化、位置移动、尺寸缩放、可见性、方向、闪烁、禁用、工具提示 | 绑定 Tag 值/表达式，无需脚本 |
| **Symbol Wizard** | 可配置参数的 Wizard 模板 | Designer 定义配置界面，Consumer 使用 |

**Industrial Graphics 示例**：
```
// 一个泵的 Industrial Graphic 定义
PumpSymbol:
  - Visual Elements:
    - PumpBody (Ellipse, fill color = if Running then Green else Gray)
    - DirectionArrow (Polygon, visible = Running, rotation direction = Forward)
    - SpeedLabel (Text, text = Speed value + " RPM")
  - Custom Properties:
    - Running: Boolean   (exposed for binding)
    - Speed: Real        (exposed for binding)
    - LabelText: String  (configurable by consumer)
```

### 3.2 报警管理（Distributed Alarm System）

InTouch 的分布式报警系统（Distributed Alarm System）是其架构中最精妙的部分之一。

#### 3.2.1 报警架构

```
┌──────────────────────────────────────────────────────────────┐
│                  InTouch 分布式报警系统                         │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Alarm Provider（报警提供者）                              ││
│  │  - InTouch 本地 Tag 报警                                  ││
│  │  - Application Server 对象报警                            ││
│  │  - 外部 Alarm Provider（SPC Pro, QI Analyst, 第三方）     ││
│  │  - 通过 Wonderware Alarm API Toolkit 自定义               ││
│  └────────────────────┬─────────────────────────────────────┘│
│                       │ SuiteLink (VTQ)                       │
│                       ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Alarm Manager（报警管理器）                               ││
│  │  ┌─────────────────┬────────────────────────────────┐    ││
│  │  │ Summary Alarms   │ Historical Alarms & Events     │    ││
│  │  │ (当前活动报警)    │ (内存缓冲区, 可配置大小)        │    ││
│  │  └─────────────────┴────────────────────────────────┘    ││
│  └────────────────────┬─────────────────────────────────────┘│
│                       │                                       │
│     ┌─────────────────┼─────────────────┐                    │
│     ▼                 ▼                  ▼                    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Alarm DB │  │ Alarm Printer│  │ Alarm Consumer│          │
│  │ Logger   │  │ (打印报警)    │  │ ActiveX 控件   │          │
│  │ (SQL DB) │  │              │  │ - Alarm Viewer │          │
│  │          │  │              │  │ - Alarm Pareto │          │
│  │          │  │              │  │ - Alarm Tree   │          │
│  └──────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

#### 3.2.2 报警类型

| 报警类型 | 说明 | 适用场景 |
|----------|------|----------|
| **Value Alarm（值报警）** | 基于 Tag 值的阈值判断 | 最常见。HIHI、HI、LO、LOLO 四级 |
| **Deviation Alarm（偏差报警）** | 目标值与实际值的偏差 | 设定值控制的偏差监控 |
| **Rate-of-Change Alarm（变化率报警）** | Tag 值变化速率超限 | 快速上升/下降趋势预警（如反应器温升） |
| **Event（事件）** | Tag 值变化来源记录 | 操作员动作/脚本/I/O 来源的完整记录 |

#### 3.2.3 分布式报警核心特性

| 特性 | 说明 |
|------|------|
| **Provider-Consumer 模型** | 报警产生节点（Provider）与消费节点（Consumer）解耦 |
| **分布式报警记录** | 多个节点上的报警内存构成一个逻辑报警集合 |
| **毫秒级时间戳** | 报警时间戳在 Provider 端生成，精确到毫秒，使用 UTC 时间 |
| **无缝故障转移** | Backup 报警 Provider 在主节点断开时自动接管，主节点恢复后重新同步已确认报警 |
| **报警查询** | 从内部报警内存或 SQL Server 报警数据库查询活动/历史报警 |
| **过滤与抑制** | 按报警类、Tag、组进行过滤；报警抑制功能可按节点屏蔽报警显示 |
| **远程确认** | 操作员可以从任何网络节点确认报警，确认信息包含操作员节点名 |
| **自动确认** | 配置报警返回正常时自动确认（Auto-Acknowledge） |

### 3.3 历史数据与趋势（Historian & Trending）

| 功能 | 实现 | 说明 |
|------|------|------|
| **InTouch 本地历史** | LGH 文件（Log History） | WindowViewer 内置历史记录，可配置记录死区和固定间隔记录 |
| **AVEVA Historian** | 专业时序数据库（SQL Server 基础上的 Block 技术） | 存储速度比标准关系数据库快数百倍，存储空间仅为几分之一 |
| **Historian Client** | 趋势控件（ActiveX/.NET） | 交互式趋势图：缩放、平移、游标读数、多画笔对比 |
| **History Playback** | 历史回放 | 以录像形式回放历史 HMI 画面，无需脚本配置即可分析历史操作 |
| **分布式历史系统** | 远程历史 Provider | 从网络中任何 InTouch 节点或 Historian Server 检索历史数据 |
| **统计计算** | 实时统计 | 自动计算 min/max/average/standard deviation，无需编码 |

**Historian Block 技术**：
Block 是 AVEVA Historian 的核心创新——将连续时间段的 Tag 数据压缩为块，包含起始值、结束值、时间范围和质量信息。相比逐条记录每个采样值，Block 存储大幅减少了 I/O 和磁盘占用。

### 3.4 安全与审计

参见 §2.11 安全模型的详细说明。InTouch 支持：
- **OS 集成认证**：Active Directory / LDAP 集中管理
- **ArchestrA RBAC**：Galaxy 级基于角色的访问控制
- **Tag 级安全**：每个 Tag 可配置最小访问级别
- **区域安全**：按工厂区域/生产线划分访问权限
- **电子签名**（FDA 21 CFR Part 11 合规）：操作确认 + 审计追踪
- **TLS 加密**：节点到节点通信加密
- **集中补丁管理**：中央节点推送更新
- **$AccessLevel 系统 Tag**：运行时根据用户级别动态控制 UI 可见性

### 3.5 Recipe Management（配方管理）

InTouch 内置 Recipe Manager 工具：

| 功能 | 说明 |
|------|------|
| **Recipe Template** | 电子表格界面定义配方模板（模板文件 .csv） |
| **Unit 映射** | 配方参数映射到特定生产单元的实际 Tag（如 PLC 设定值） |
| **Recipe 操作** | Load（加载配方值到 PLC）、Save（从 PLC 读回当前值保存为配方）、Delete |
| **安全控制** | 配方加载需要满足 $AccessLevel >= Recipe SecurityLevel |
| **Error Handling** | 配方加载失败自动处理（如 PLC 脱机时阻止加载） |

此外，AVEVA Recipe Management 作为独立产品提供更高级的配方管理：
- ISA-88 标准的配方程序执行
- 配方版本管理和电子签名
- 浏览器界面（可嵌入 InTouch）
- OPC UA 接口（与任何控制系统集成）

### 3.6 SPC（统计过程控制）

InTouch SPC Pro 提供：
- 控制图（X-bar、R、S、P、NP、C、U、EWMA）
- 过程能力分析（Cp、Cpk、Pp、Ppk）
- 报警规则（Western Electric 规则、Nelson 规则）
- 实时数据采集和统计计算
- 集成到分布式报警系统

### 3.7 冗余与高可用

| 冗余级别 | 实现 | 故障转移时间 |
|----------|------|------------|
| **AppEngine 冗余** | Primary/Backup 对，AppEngine 状态同步 | ~15 秒 |
| **Galaxy Repository 冗余** | SQL Server Always On / Mirroring | 取决于 SQL 配置 |
| **Historian 冗余** | Tier-2 汇总 + 本地缓冲 | < 30 秒 |
| **I/O Server 冗余** | 多个 DA Server + Access Name 切换 | ~5-10 秒 |
| **网络冗余** | 双 NIC 绑定 | 实时 |

### 3.8 多语言支持

InTouch 支持运行时语言切换（德语、日语、法语、简体中文等），包括：
- 静态文本翻译
- Tag 报警消息翻译
- 错误提示翻译
- 托管应用的 IDE 级语言切换

---

## 4. 现状与生态

### 4.1 最新版本与更新

| 产品 | 版本 | 发布时间 |
|------|------|---------|
| InTouch HMI | 2023 R2 | 2023 年末 |
| System Platform | 2023 R2 | 2023 年末 |
| InTouch Unlimited | — | 2024 年 6 月推出新定价 |
| OMI | 2023 R2 | 含在 System Platform 中 |
| Historian | 2023 R2 | 含在 System Platform 中 |

**2024 年关键更新**：
- InTouch Unlimited 新定价模型（取消 Tag 限制）
- 开发工具免费
- 现代化安装程序
- 从 OPC UA 和 MQTT 源快速创建内容
- 开源脚本增强
- 统一可视化（InTouch/Edge 融合路线图）
- CONNECT 加速开发和 AI/ML 开发辅助

### 4.2 安装基础

InTouch 及其前身 Wonderware 被认为是全球**安装基础最大的 HMI/SCADA 产品**：
- 历史第三方调查（2003 ARC Advisory Group）：Wonderware 占全球 HMI 市场约 15%（竞争对手 Siemens 12%、Rockwell 10%、GE/Intellution 10%）
- 业内普遍认为 AVEVA InTouch/System Platform 在流程工业的安装基础占 **1/3 以上**
- 超过 90% 的领先工业企业使用 AVEVA 软件

### 4.3 行业覆盖

| 行业 | 典型应用 | InTouch 优势 |
|------|---------|-------------|
| **食品饮料** | 批次生产监控、配方管理、CIP 清洗 | Recipe Manager + 批处理模板 |
| **水处理/废水** | SCADA 监控、泵站控制、水质监测 | 广域网 SCADA 架构 + 远程遥测 |
| **石油天然气** | 管道 SCADA、井口监控、炼油厂 | 大规模分布式架构 + 冗余 |
| **化工** | 反应器监控、批次控制 | 报警管理 + 配方管理 |
| **制药** | FDA 合规、电子签名、审计追踪 | 21 CFR Part 11 认证 + 电子批记录 |
| **电力/公用事业** | 变电站监控、发电厂 SCADA | 冗余 + 快速报警 |
| **采矿/金属** | 选矿厂监控、物料处理 | 大规模 I/O + 趋势分析 |
| **基础设施** | 楼宇自动化、隧道监控、机场 | 多协议连接性 |

### 4.4 合作伙伴生态

AVEVA 的合作伙伴生态是其主要竞争优势之一：

| 生态组件 | 说明 |
|----------|------|
| **系统集成商（SI）** | 全球认证集成商网络，提供项目交付、定制开发、本地支持 |
| **OEM 合作伙伴** | 设备制造商嵌入 InTouch/Edge HMI |
| **技术合作伙伴** | 通信驱动、数据库、报表、MES 扩展的第三方供应商 |
| **Heroes HQ** | AVEVA 官方技术论坛——知识库、社区问答、最佳实践分享 |
| **培训资源** | 视频教程、认证课程、文档中心（docs.aveva.com） |
| **AVEVA Connect** | 云端工业智能平台——跨工厂/供应链的统一数据视图 |

### 4.5 社区与支持

| 渠道 | 说明 |
|------|------|
| **官方文档** | docs.aveva.com——完整的在线产品文档 |
| **Heroes HQ** | 官方技术社区 |
| **培训** | AVEVA 认证培训课程（教室/在线） |
| **技术支持** | 通过 AVEVA Global Customer Support 门户 |
| **行业社区** | PLC-HMI-SCADAs.com、Reddit r/SCADA、LinkedIn 群组 |

### 4.6 支持生命周期

| 阶段 | 持续时间 | 服务内容 |
|------|---------|---------|
| **主流支持（Mainstream Support）** | ~5 年 | 完整支持：补丁、热修复、产品更新、电话支持 |
| **扩展支持（Extended Support）** | ~2 年 | 有限支持：仅安全补丁和 P1 问题 |
| **自支持（Self-Support）** | 无限期 | 仅知识库和基本诊断——无补丁、无新更新 |

---

## 5. 市场定位

### 5.1 竞争格局总览

| 竞争对手 | 开发商 | 核心优势 | InTouch 的比较优势/劣势 |
|----------|--------|---------|------------------------|
| **Ignition** | Inductive Automation | 无限许可模型、Web 原生架构、跨平台 | InTouch 安装基础更大、ArchestrA 对象模型更成熟、但许可成本高 |
| **WinCC** | Siemens | 与 SIMATIC PLC 紧耦合、TIA Portal 集成 | InTouch 多供应商支持更好、但 Siemens 生态锁定更强 |
| **FactoryTalk View** | Rockwell Automation | 与 Allen-Bradley PLC 紧耦合、PlantPAx 体系 | InTouch 跨供应商兼容、但 AB 生态内 FTView 最优 |
| **iFIX** | Emerson (GE Digital) | 分布式架构、水/电/油气行业积累 | InTouch 更完善的报警系统和对象模型 |
| **GENESIS64** | Iconics | 原生 64 位、OData REST API、3D 可视化 | InTouch 安装基础优势、但 Iconics 技术更新更激进 |
| **Citect SCADA** | AVEVA（同一家） | 高性能驱动、采矿/金属行业 | 同一母公司、面向不同市场——Citect 在澳洲和中国优势 |

### 5.2 与 Ignition 的直接对比（最重要的竞争关系）

| 维度 | InTouch / System Platform | Ignition |
|------|--------------------------|----------|
| **许可证模型** | 历史：按 Tag 阶梯。2024+：Unlimited 订阅/永久 | 按服务器许可，不限 Tag/客户端/项目 |
| **价格参考** | Unlimited Professional ~$20,000 | Platform Base ~$10,000-20,000 |
| **Web 客户端** | InTouch OMI（HTML5）+ RDS | Perspective（原生 HTML5 React） |
| **工程 IDE** | WindowMaker + ArchestrA IDE（桌面） | Ignition Designer（Web 浏览器） |
| **脚本语言** | QuickScript + .NET（C#） | Python (Jython 2.7) |
| **数据模型** | 对象化（ArchestrA）→ 但向后兼容 Tag | 统一 Tag Provider 模型 |
| **安装依赖** | Windows Only + SQL Server | Java + 数据库（多平台） |
| **冗余模型** | AppEngine Primary/Backup + Galaxy 冗余 | Gateway Network Redundancy |
| **MQTT 支持** | 新增（2023+） | 原生 Sparkplug B（Cirrus Link 深度集成） |
| **社区** | 传统 SI 网络 + Heroes HQ | 非常活跃的论坛 + Inductive University |

> **核心问题**：Ignition 的无限许可 + Web 原生架构正在从 InTouch 手中夺取新增市场份额，尤其是在新建项目和中小型企业中。InTouch 的回应是 InTouch Unlimited（2024）+ 开发工具免费。

### 5.3 市场定位分析

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 已有 InTouch/Wonderware 历史系统 | **保持 InTouch** | 迁移成本极高（数月工程），升级路径成熟 |
| 新建大型企业流程 SCADA | InTouch + System Platform | ArchestrA 对象模型对多站点标准化极为有效 |
| 新建供应商中立中小型系统 | **Ignition**（通常更优） | 更低的许可成本，更现代的 Web 架构 |
| Siemens PLC 为主的工厂 | **WinCC Unified** | 原生 S7 集成，免 OPC 协议转换延迟 |
| Allen-Bradley PLC 为主的工厂 | **FactoryTalk View** | 原生 EtherNet/IP，PlantPAx 工艺对象库 |
| 仅需嵌入式 HMI（OEM） | InTouch Edge HMI | 紧凑安装、低成本、多协议支持 |
| 制药/生命科学（21 CFR Part 11） | InTouch + AVEVA Recipe Mgt | 电子签名、审计追踪、批次报告——全栈合规 |
| 绿色地带 IIoT / Web 优先 | AVEVA Operations Control 或 Ignition | 浏览器原生、容器化、模型驱动部署 |

### 5.4 定价竞争力分析

InTouch 的定价结构是其最大的市场竞争劣势之一，但 2024 年的 InTouch Unlimited 改革正在改变这一格局：

| 历史痛点 | 2024 年改革 |
|----------|-----------|
| 按 Tag 阶梯定价，超限需"丢弃旧许可重新购买" | Unlimited 模型：无限 Tag/客户端/扩展 |
| 开发环境需购买额外许可 | **开发工具免费** |
| 许可升级是"可弃成本和替换"（discard & replace） | 订阅制可选，永久许可 + Upgrade Protection |
| 许可透明度低（仅通过合作伙伴报价） | 改进中——Standard/Professional 参考价格公开 |
| 全产品栈许可昂贵（Historían + Reporting + MES 单独许可） | InTouch Unlimited 已包含 Historian + Reporting |

**TCO（总拥有成本）对比**（估算）：

| 场景 | InTouch（传统） | InTouch Unlimited | Ignition | WinCC |
|------|---------------|-------------------|----------|-------|
| 500 Tag 单机 | ~$5,000-8,000 | ~$12,000（Standard） | ~$10,000 | ~$5,000-8,000 |
| 5000 Tag + 10 客户端 | ~$50,000-100,000 | ~$20,000（Professional） | ~$20,000-30,000 | ~$25,000-40,000 |
| 企业级多站点 | 定制报价 | ~$20,000/2 节点 | ~$50,000+（多 Gateway） | 定制报价 |

---

## 6. 产品特色

### 6.1 ArchestrA 面向对象范式——行业首创

ArchestrA 是 InTouch 最核心的技术差异化优势。在其 2002 年前后推出时，整个 HMI/SCADA 行业仍停留在平面 Tag 模型的层面。ArchestrA 的面向对象自动化概念在当时是革命性的：

- **模板化工程**：将设备/过程建模为可复用的对象模板。一个"泵"模板定义为 PumpTemplate，包含所有属性（转速、电流、温度、报警限值）、脚本逻辑（启停联锁、故障检测）和图形表示（泵符号）。任何类型的泵只需从该模板派生实例。
- **继承**：派生模板可以继承父模板的全部属性，并覆盖特定属性（如 TypeA_Pump 覆盖 MaxRPM = 3000）。
- **包容**：对象可以包含子对象，形成自然的过程层次结构（例如 Tank → contains Pump + LevelSensor + Valve）。
- **版本管理**：模板变更时，所有实例可以手动或自动继承变更。

**对行业的影响**：Rockwell 在其 Integrated Architecture 中引入 Add-On Instructions (AOI) 和 PlantPAx process objects；Siemens 在 TIA Portal 中引入 Library 和 Typicals——这些都可以追溯至 ArchestrA 的概念影响。

### 6.2 Galaxy 统一配置库

Galaxy 解决了传统 SCADA 工程的"配置分散"问题：

- **单一数据源**：所有工程设计数据存储在一个 SQL Server 数据库中，而非散布在每台 View Node 的文件系统上
- **多工程师协作**：检出/检入机制允许多个工程师同时工作在同一 Galaxy 中
- **逻辑命名空间**：所有对象引用使用逻辑名称（如 Pump_001），而非物理地址（如 `\\NodeA\AppEngine1\Pump_001`）
- **部署模型**：配置变更通过部署工作流推送——对象被分配到特定 AppEngine 节点上运行

### 6.3 最悠久的工业 HMI 传承

InTouch 从 1989 年起累积的工程经验是竞争者难以复制的资产：
- 超过 35 年的现场验证——数百万个工程实践中发现的边界条件、协议兼容性问题、许可模型迭代
- 庞大的已部署应用库——大量工厂运行着 10-20 年前用 WindowMaker 创建的应用，这些应用至今仍在生产环境中稳定运行
- 生态系统惯性——全球数以万计的工程师熟悉 WindowMaker 和 QuickScript

### 6.4 AVEVA 生态系统集成

AVEVA 的产品组合为 InTouch 提供了从控制层到企业层的完整软件栈：

| 层级 | 产品 | 与 InTouch 的关系 |
|------|------|------------------|
| 现场控制 | InTouch / Edge HMI | HMI 可视化 |
| 过程控制 | System Platform | 对象模型 + 集中管理 |
| 数据管理 | Historian / PI System | 时序数据存储与分析 |
| MES/MOM | AVEVA MES / Batch / Workflow | 生产执行与调度 |
| 可视化 | OMI + PI Vision | Web 操作界面 + 企业仪表盘 |
| 优化 | AVEVA Insight / APC | 大数据分析与先进过程控制 |
| 云端 | AVEVA Connect | 统一云平台——跨工厂/供应链的数据视图 |
| 统一运营 | AVEVA Unified Operations Center | 企业级运营中心 |

这种一站式的集成能力是西门子（TIA Portal + MindSphere）和罗克韦尔（FactoryTalk + Plex）以外，少数能提供完整 ISA-95 层级覆盖的供应商。

### 6.5 通信驱动覆盖广度

InTouch 拥有业内最广泛的设备通信驱动库（DA Servers/OI Servers），覆盖几乎所有主流 PLC 品牌（Allen-Bradley、Siemens、Omron、Mitsubishi、Schneider、GE、ABB 等）和工业协议（Modbus、PROFIBUS、EtherNet/IP、PROFINET、DF1、Host Link 等）。

### 6.6 从 Legacy 到 Modern 的迁移故事

InTouch 正在经历一个历史性的现代化转型：
- WindowViewer（1990 年代 Win32） → OMI（2020 年代 HTML5）
- 仅 Windows Desktop → 多设备（桌面 + Web + 移动）
- 平面 Tag → 对象模板（ArchestrA）
- 固定许可阶梯 → 无限/订阅许可（Unlimited）
- 传统 QuickScript → QuickScript.NET + C# 脚本
- 封闭导出 → OPC UA Server + MQTT

---

## 7. 对 AUDESYS 参考价值

### 7.1 ArchestrA 对象模型 — HAL 设备建模参考

ArchestrA 的面向对象范式对 AUDESYS HAL 设计有直接参考价值：

| ArchestrA 概念 | AUDESYS 对应 | 参考价值 |
|---------------|-------------|---------|
| **Object Template** | HAL Device Model（设备模型模板） | 定义一类设备的 Signal/StreamChannel/RPC 接口套餐 |
| **Instance** | Device Instance（设备实例） | 运行时实例化，绑定到物理 I/O 或仿真 I/O |
| **Containment** | 设备层次结构（Device Tree） | 模块包含子模块（如机器人 → 关节 → 电机上 HAL Pin） |
| **Derived Template** | 设备模型继承 | 基类设备（GenericMotor）→ 派生设备（SERVO_Motor） |
| **Deployment** | Task/Thread Assignment | 设备实例分配到特定 RT 线程或 I/O 线程 |
| **Attribute** | Signal / StreamChannel | ArchestrA 的 Attribute = AUDESYS 的 Signal（带时间戳和质量） |

**AUDESYS 可以借鉴的设计模式**：
```
// ArchestrA 风格的 HAL 设备模型定义（概念示例）
DeviceTemplate MotorBase:
  Signals:
    Running:     Bool    (output, write-only)
    Speed:       Float64 (output, write-only)
    Current:     Float64 (input, read-only)
    Temperature: Float64 (input, read-only)
    FaultCode:   Uint16  (input, read-only)
  StreamChannels:
    VelocityProfile: StreamChannel (output, history=1000)
  RPC:
    Enable():    void
    Disable():   void
    ResetFault(): void
    HomeAxis():  void

DeviceTemplate ServoMotor extends MotorBase:
  Signals:
    + Position:   Float64 (input, read-only)
    + Torque:     Float64 (input, read-only)
    + FollowingError: Float64 (input, read-only)
  RPC:
    + MoveTo(position: Float64, speed: Float64): void
    + Stop(): void
```

### 7.2 Galaxy 集中式配置 — Studio IDE 配置管理

Galaxy 的集中式配置数据库为 AUDESYS Studio 提供了配置管理架构的参考模型：

| Galaxy 特性 | AUDESYS 参考 | 建议 |
|------------|-------------|------|
| **单一数据源** | Studio Project 文件（YAML/JSON 或 SQLite） | 所有配置在一个项目文件中，避免多文件同步 |
| **多工程师协作** | Git-based 版本控制 + 检出/检入隐喻 | Studio 集成 Git，支持分支/合并 |
| **逻辑命名空间** | Device Tree + Signal 命名（`component.interface.name`） | 使用逻辑名而非物理路径 |
| **部署工作流** | Config Barrier（D17 决策） | 配置变更排队到周期边界，批量应用到 Runtime |
| **模板-实例** | Device Template Library | Studio 提供设备模板库，拖放实例化 |
| **对象版本管理** | Git tags + semantic versioning | 设备模板版本管理 |

**关键教训 — Galaxy 的复杂度代价**：
Galaxy 的缺点是过度集中化带来运维负担。AUDESYS 可以采用**轻量级的 Git-based 配置管理**——配置就是代码（Configuration as Code），以 Git 仓库代替复杂的集中式数据库。Git 的合并/分支/版本回滚能力天然支持多工程师协作。

### 7.3 WindowMaker ↔ WindowViewer — Studio ↔ Runtime 对标

InTouch 的 IDE/Runtime 分离设计是 AUDESYS Studio ↔ Runtime 分离最直接的对标对象：

| InTouch | AUDESYS | 分析 |
|---------|---------|------|
| **WindowMaker** | Studio IDE | 图形化工程环境 |
| **WindowViewer** | Runtime Engine | 实时执行环境 |
| **Fast Switch** | Hot Reload | 编辑后立即在 Runtime 中测试 |
| **NAD（网络应用分发）** | Runtime 远程部署 | 从 Studio 部署应用到 Runtime 节点 |
| **Managed Application** | Studio-Managed Project | IDE 全生命周期管理（创建→开发→部署→运维） |
| **Tagname Dictionary** | Signal/StreamChannel Registry | 数据点定义和管理 |

**需注意的设计差异**：

| 维度 | InTouch | AUDESYS 建议 |
|------|---------|-------------|
| 数据类型 | 4 种（Discrete/Integer/Real/Message） | 14 种（D12 决策：含 IEC 61131-3 全覆盖） |
| 数据模型 | 平面 Tag → 对象（ArchestrA） | 原生对象-信号模型（Signal/StreamChannel/RPC 三分法） |
| 脚本触发 | 7 种触发器（Application/Window/Key/Condition/DataChange/Action/ActiveXEvent） | HAL 层不需要脚本——控制逻辑在 Runtime 的 PLC 程序中 |
| 通信协议 | SuiteLink/DDE/OPC DA/UA 混合 | amw 三极 trait（HalTransport/HalDiscovery/HalQoS）统一抽象 |

### 7.4 Tag-based → Object-based 演进 — 历史教训

InTouch 从 Tag 模型到 ArchestrA 对象的演进过程对 AUDESYS 有根本性的参考价值：

**教训 1：不要从平面 Tag 开始**
InTouch 的 Tag 模型在 1990 年代非常合适（概念简单，符合当时 PLC 的内存镜像模式）。但随着系统复杂度增长，平面 Tag 的致命缺陷暴露无遗：
- 100 个泵 = 2000+ 个独立 Tag。每个 Tag 的报警配置需手工复制。
- "泵类型"的概念不存在于数据模型中——只存在于工程师的脑海中。
- 跨项目复用为零。

AUDESYS 从第一天就应采用 **Signal（component.interface.name）** 的层次命名模型，避免平面 Tag 的设计。

**教训 2：向后兼容的代价巨大**
ArchestrA 引入后，InTouch 必须同时支持 Standalone（Tag-based）和 Managed（Object-based）两种应用模式。这两种模式的脚本语法不同（QuickScript vs .NET Script）、Tag 访问方式不同（直接 Tag 名 vs Galaxy 属性路径）——至今仍在增加维护负担。

AUDESYS 的 HAL 只有一种数据模型：Signal/StreamChannel/RPC。不引入向后兼容的 Tag 模式。

**教训 3：对象模型 + 图形符号绑定**
ArchestrA 的最佳设计选择之一是将对象模板与 Industrial Graphics 绑定——对象不仅包含数据和逻辑，还包含其可视化表现形式。AUDESYS Studio 应借鉴：用户拖入一个设备模板到画面中，自动生成与该设备的所有 Signal 绑定的标准控件（数值显示、状态灯、趋势图、报警指示）。

### 7.5 InTouch OMI 现代化 — Studio Web 前端参考

InTouch 从 Win32 WindowViewer 到 HTML5 OMI 的现代化转型为 AUDESYS Studio 提供了关键参考：

| OMI 特性 | AUDESYS Studio 参考 |
|----------|-------------------|
| **HTML5 原生可视化** | Studio HMI 设计器应基于 Web（React/Vue），摆脱桌面依赖 |
| **响应式设计** | 一次设计，自适应部署到多种屏幕尺寸（控制室大屏、工程笔记本、平板） |
| **情境感知 UI** | 根据用户角色自动调整显示内容（操作员查看趋势 vs 维护人员查看诊断） |
| **App 插件架构** | OMI Apps 的插件机制 = Studio 的扩展/模块系统 |
| **动态画面生成** | 基于设备模板自动生成标准监控画面——减少重复工程 |
| **历史回放** | 仿真/测试时回放历史数据——对 Simulator 模块极为有用 |
| **Situational Awareness 设计** | ISA-101 标准的色彩方案和布局规范——工业 UI 的黄金标准 |

**AUDESYS Studio 的具体建议**：
- **HMI 设计完全 Web 化**：使用 React/Vue + Canvas/SVG 实现工业图形编辑器
- **核心编程（PLC 逻辑）桌面优先**：IEC 61131-3 编程环境的 LSP + 语法高亮 + 调试在 Web 中实现仍有技术挑战
- **模板驱动的画面生成**：拖入 Device Template → 自动生成与其 Signal/StreamChannel/RPC 绑定的标准 UI 控件
- **WebSocket 实时通信**：Studio 前端通过 WebSocket 与 Runtime 通信（对标 InTouch 的 SuiteLink）

### 7.6 通信架构 — amw 中间件对照

InTouch 的 I/O Server 模型对 AUDESYS 的 amw（AUDESYS Middleware）设计有参考价值：

| InTouch 通信概念 | AUDESYS amw 对应 | 参考价值 |
|-----------------|-----------------|---------|
| **Access Name** | amw 连接抽象（Connection） | 屏蔽底层协议差异——应用只需指定逻辑连接名 |
| **DA Server** | amw_transport 实现 | 每种协议对应一个 transport 实现 |
| **SuiteLink（VTQ）** | Signal 天然携带 Timestamp + Quality | AUDESYS Signal 已经包含 VTQ（D10/D11 决策） |
| **OPC UA Server 角色** | amw 对外接口（OPC UA Pub/Sub） | Runtime 可对外暴露 OPC UA Server 接口 |
| **FSGateway** | amw Gateway/Bridge | 跨协议数据桥接 |
| **IOSetAccessName() 动态切换** | amw 故障转移 | 运行时切换 backup transport |
| **DASABCIP / DASSIDIR 等专用驱动** | amw_transport 协议实现 | 每种 PLC 协议需要专门的 transport plugin |

### 7.7 报警系统 — 分布式报警架构参考

InTouch 的分布式报警系统对 AUDESYS 的报警管理设计有重要参考：

| InTouch 报警特性 | AUDESYS 参考 |
|-----------------|-------------|
| **Provider-Consumer 解耦** | 报警生产者（Runtime 节点）与消费者（HMI 客户端）独立部署 |
| **分布式报警内存** | 多个 Runtime 节点报警构成逻辑统一视图 |
| **Provider 端时间戳** | 报警发生时刻即打时间戳（不依赖 Consumer 时钟） |
| **毫秒精度 + UTC** | 跨时区 SOE（Sequence of Events）重现 |
| **故障转移同步** | backup 节点接管后，报警确认状态重新同步 |
| **报警查询** | 活动报警 + 历史报警的查询 API |
| **过滤与抑制** | 按 Area/Group/Severity 灵活过滤 |

### 7.8 工程效率 — 模板化与自动化

InTouch 的 Industrial Graphics 和自动化库声称可减少 80% 工程工作量——AUDESYS Studio 应内建类似的工程效率机制：

| InTouch 效率机制 | AUDESYS 实现建议 |
|-----------------|-----------------|
| Industrial Graphics Library | Studio 设备符号库（拖放使用） |
| Symbol Wizard（可配置模板） | Studio 组件属性面板（配置参数自动生成绑定） |
| Managed Application（模板化创建） | Studio 项目模板（含预配置的设备模型和 HMI 布局） |
| 多用户协作（Galaxy Check-Out/In） | Git 分支 + Studio 内冲突解决 UI |
| 画面自动生成 | 基于 Device Template 的自动画面生成引擎 |
| 快速切换（Fast Switch） | Studio 内置仿真预览（编辑后立即在嵌入式 Simulator 中预览） |

### 7.9 冗余设计对标

| InTouch 冗余 | AUDESYS 冗余参考 | 优先级 |
|-------------|----------------|--------|
| AppEngine Primary/Backup（~15s failover） | Runtime 热备（ACTIVE/STANDBY 模式） | Phase 2 |
| GR Node SQL Server Mirroring | Studio 项目存储高可用（Git + remote backup） | Phase 2 |
| Historian Tier-2 汇总 | 仿真/测试数据分层存储 | Phase 3 |
| Access Name 多 I/O Server 切换 | amw 多 transport failover | Phase 2 |

### 7.10 需警惕的陷阱

从 InTouch 的发展历程中，AUDESYS 应注意避免：

1. **Tag 模型的技术债**：AUDESYS D10 决策已确立 Signal/StreamChannel/RPC 三分法——这是正确的。不要引入平面 Tag 作为兼容层。
2. **双重产品线的维护负担**：InTouch OMI 与 WindowViewer、Classic InTouch 与 System Platform 双线并行造成了长期的维护和技术支持负担。AUDESYS Studio 应选定唯一的技术栈（Web 前端 + Rust 后端），避免视觉分裂。
3. **许可定价的透明性**：InTouch 的"不公开标价"模式造成市场不信任。如果 AUDESYS 未来商业化，应考虑公开定价或至少提供明确的报价机制。
4. **过度工程化**：Galaxy + ArchestrA 引入的管理复杂性对小项目是负担。AUDESYS 应保持"渐进式复杂度"——小项目可以用简化的配置，大项目解锁完整对象模型。
5. **向后兼容的代价**：InTouch 至今仍在支持 DDE、NetDDE、Group Var Tag（v7.11 遗留产物）、传统 QuickScript 语法——这些向后兼容承诺严重拖慢了现代化速度。
6. **Windows 绑定**：InTouch 对 Windows 的深度依赖（COM/DCOM、ActiveX、SuiteLink 的 Windows 性能计数器）限制了平台选择。AUDESYS Runtime 的 Rust/C 实现可避免此问题。
7. **安装体积膨胀**："即使仅装 InTouch 也必须下载 4.5GB System Platform 仓库"——这种打包方式增加了部署摩擦。

### 7.11 总结：InTouch 对 AUDESYS 的关键参考权重

| 参考领域 | 重要性 | 适用阶段 | 优先级 |
|---------|--------|---------|--------|
| ArchestrA 对象模型 → HAL Device Model 设计 | 极高 | Phase 1-2 | P0 |
| WindowMaker/WindowViewer → Studio/Runtime 分离 | 极高 | Phase 1 | P0 |
| Tag-based → Object-based 演进教训 | 极高 | Phase 1（防设计偏差） | P0 |
| Galaxy 配置管理 → Studio 项目管理 | 高 | Phase 2 | P1 |
| OMI Web 现代化 → Studio Web 前端 | 高 | Phase 2 | P1 |
| 分布式报警 → AUDESYS 报警管理 | 中 | Phase 2-3 | P2 |
| 冗余设计 → Runtime 高可用 | 中 | Phase 3 | P2 |
| 工程效率机制 → Studio UX 设计 | 中 | Phase 2-3 | P2 |
| 商业许可模型 → AUDESYS 未来商业模式 | 低 | Phase 3+ | P3 |

---

> **文档版本**: v2.0
> **编写日期**: 2026-07-13
> **数据来源**: AVEVA 官方文档（docs.aveva.com）、AVEVA System Platform Datasheet、InTouch HMI Concepts and Capabilities Guide、InTouch HMI Scripting and Logic Guide、InTouch HMI Data Management Guide、InTouch HMI Alarms and Events Guide、System Platform Sample Architecture、System Sizing Guidelines、AVEVA 2024 新闻稿（BusinessWire）、第三方 SCADA 对比分析（Industrial Monitor Direct、Anexee、Fortune Business Insights）、维基百科
> **（待确认）标注**: 价格信息基于第三方对比分析和 AVEVA 2024 年新闻稿推断，具体价格以 AVEVA 合作伙伴最新报价为准。安装基础数据基于行业估计，AVEVA 未公开发布官方安装数量。

## 附录

### A. InTouch 产品家族对照表

| 当前名称 | 历史名称 | 类型 | 状态 |
|----------|---------|------|------|
| AVEVA InTouch HMI | Wonderware InTouch | 经典 PC HMI | 活跃开发 |
| InTouch Unlimited | — | 全功能 HMI/SCADA（新许可模型） | 活跃开发（2024+） |
| InTouch Edge HMI | Wonderware InTouch Machine Edition / InduSoft | 嵌入式 HMI | 活跃开发 |
| AVEVA System Platform | Wonderware System Platform / ArchestrA System Platform | 企业 SCADA 平台 | 活跃开发 |
| AVEVA OMI | Wonderware OMI | Web 可视化框架 | 活跃开发 |
| AVEVA Historian | Wonderware Historian / IndustrialSQL Server | 时序数据库 | 活跃开发 |
| AVEVA Operations Control | — | 订阅制全栈套件 | 活跃开发 |
| AVEVA Edge | InduSoft Web Studio | 低成本 HMI | 活跃开发（独立产品线） |
| AVEVA Recipe Management | Wonderware Recipe Manager | 配方管理 | 活跃开发 |
| AVEVA MES | Wonderware MES | 制造执行系统 | 活跃开发 |

### B. 术语表

| 术语 | 英文/缩略 | 说明 |
|------|----------|------|
| 标签名字典 | Tagname Dictionary | InTouch 标签定义和管理工具 |
| 窗口制作器 | WindowMaker | InTouch 开发环境（IDE） |
| 窗口查看器 | WindowViewer | InTouch 运行时环境 |
| 星系 | Galaxy | System Platform 的集中式配置数据库 |
| 快速脚本 | QuickScript | InTouch 的专有脚本语言 |
| 应用引擎 | AppEngine | 运行 Automation Object 的后台服务 |
| 平台 | WinPlatform | 物理计算机在 Galaxy 中的代表对象 |
| 访问名 | Access Name | 到 I/O Server 的逻辑连接定义 |
| 套件链接 | SuiteLink | Wonderware 的 TCP/IP 工业通信协议 |
| 分布式报警系统 | Distributed Alarm System | Provider-Consumer 模型的报警架构 |
| 网络应用开发 | NAD (Network Application Development) | InTouch 应用网络分发机制 |
| 工业图形 | Industrial Graphic | ArchestrA 的可复用图形符号 |
| 托管应用 | Managed Application | 由 ArchestrA IDE 管理的 InTouch 应用 |
| 操作管理界面 | OMI (Operations Management Interface) | HTML5 响应式可视化框架 |
| 快速切换 | Fast Switch | WindowMaker ↔ WindowViewer 快速切换 |
| 块技术 | Block Technology | Historian 的压缩存储技术 |
| 值-时间-质量 | VTQ (Value-Time-Quality) | SuiteLink 的数据传输三元组 |
| 情境感知 | Situational Awareness | ISA-101 标准的 HMI 设计理念 |
| 通配符符号 | Wildcard Symbol | InTouch 符号的类型，允许运行时动态改变输入源 |
| 检测/检出 | Check-Out / Check-In | Galaxy 多用户开发版本控制机制 |
| 部署/撤销部署 | Deploy / Undeploy | 对象从 Galaxy 到 AppEngine 的分发/回收 |

### C. 参考链接

- AVEVA InTouch HMI 官网: https://www.aveva.com/en/products/intouch-hmi/
- AVEVA System Platform 官网: https://www.aveva.com/en/products/system-platform/
- AVEVA 官方文档: https://docs.aveva.com/
- InTouch Concepts Guide (PDF): https://download.astor.com.pl/dokumentacja/Wonderware/.../ITConcepts.pdf
- InTouch Scripting and Logic Guide (PDF): https://cdn.logic-control.com/media/ITScriptsAndLogic.pdf
- InTouch Data Management Guide (PDF): https://cdn.logic-control.com/media/ITDataManagement.pdf
- System Platform Architecture Flyer: https://www.aveva.com/.../Flyer_SampleArchitectureSystemPlatform.pdf
- 2024 InTouch Unlimited 发布: https://www.aveva.com/en/about/news/press-releases/2024/aveva-unveils-new-intouch-unlimited...
---

## 3. 功能概览

### 3.1 主要功能模块

| 模块 | 功能描述 |
|------|---------|
| **InTouch HMI** | 旗舰 HMI 可视化软件——操作员图形、报警、脚本 |
| **InTouch Studio** | 集成开发环境（原 Wonderware Development Studio） |
| **WindowMaker** | HMI 设计器——创建图形界面 |
| **WindowViewer** | 运行时 HMI 客户端 |
| **Alarm & Event Subsystem (AES)** | 报警与事件管理——配置、显示、确认、抑制、历史记录 |
| **Tagname Dictionary** | 集中化 Tag 管理（Memory Tag + I/O Tag） |
| **QuickScript** | 脚本语言——7 种脚本类型 |
| **OPC UA/DA Support** | 内置 OPC 服务器和客户端 |
| **Historian 集成** | 与 AVEVA Historian 深度集成（高速时序数据存储和检索） |
| **System Platform 集成** | 与 AVEVA System Platform（原 ArchestrA）集成——Galaxy 对象仓库、冗余、分布式部署 |
| **AVEVA MES** | 制造执行系统——OEE、质量追踪 |
| **Workflow Management** | 工作流管理（原 Wonderware Skelta）——标准化自动化流程 |
| **Security** | 登录对话框 (PostLogonDialog)、用户权限管理 |
| **Distributed Name Manager** | 分布式名称管理——创建报警组列表 |

### 3.2 关键工作流/使用场景

1. **监控与报警**: 操作员查看实时工艺参数，报警时立即响应确认
2. **操作员控制**: 通过按钮/开关发送命令到 PLC
3. **历史趋势**: 查看 Tag 历史数据，分析工艺趋势
4. **安全认证**: 多级用户登录（操作员/管理员）
5. **跨屏导航**: 主窗口 → 子窗口（如设备详情）
6. **HMI-PLC 握手**: HMI 发送触发信号 → PLC 执行定时操作 → HMI 显示状态反馈

### 3.3 InTouch HMI vs AVEVA Edge 对比

| 特性 | InTouch HMI | AVEVA Edge |
|------|------------|------------|
| 目标规模 | 大型复杂工厂 | 中小规模/远程站点 |
| 可扩展性 | 企业级、多站点 | 模块化、轻量级 |
| 开发工具 | InTouch Studio | Edge Studio |
| 集成能力 | 与 System Platform 深度集成 | 基础集成 |
| 部署方式 | 集中式企业环境 | 远程/去中心化安装 |
| 成本 | 较高 | 较低 |
---

## 4. 现状与生态

### 4.1 当前版本 (2025/2026)

- **InTouch HMI 2023 R2**: 当前主要稳定版本
  - 新功能: 开发环境全新 UI、**No Tag Limit**（无 Tag 数量限制）
- **InTouch HMI 2025**: 作为直接回应 Ignition 等竞争者的版本发布
  - 类似 All-Inclusive System Platform 许可模式
- **InTouch HMI 2026 (BETA)**: 已进入 Beta 阶段
  - 支持 Windows Server 2025 LTSC Standard 和 Datacenter
  - System Platform 不支持 Server Core 版本
- **2026 版关键路线**:
  - **Ramp up migration support for InTouch for System Platform → OMI**（加速从 InTouch for System Platform 迁移到 Operations Management Interface）
  - **AVEVA Edge**: 轻量级替代品
  - **AVEVA Connect**: 工业云平台
  - **PI System** 集成（2021 年收购 OSIsoft 后）

### 4.2 用户基数

- "InTouch 是世界上最受欢迎的 HMI 软件"（官方表述）
- "数千个工厂"使用（行业博客描述）
- 大量遗留系统仍在运行（20 年前的项目至今仍在运行，向后兼容性出色）
- 全球广泛的集成商生态和分销商网络

### 4.3 生态系统

**与 AVEVA 产品矩阵的整合**:

| 产品 | 关系 |
|------|------|
| **AVEVA System Platform** | 企业级对象仓库（Galaxy）、分布式部署、冗余、Web 客户端 |
| **AVEVA Historian** | 高速时序数据库，InTouch 的报警/事件/Tag 历史直接写入 |
| **AVEVA PI System** | 2021 年收购 OSIsoft 后集成，企业级数据历史和分析 |
| **AVEVA MES** | 制造执行系统，从 InTouch 获取生产数据 |
| **AVEVA EDA (Electric)** | 电力系统设计和资产管理 |
| **AVEVA InControl** | 过程控制系统（PLC 级）|
| **AVEVA Operations Management Interface (OMI)** | 2026 路线图——新一代操作管理界面，替代 InTouch for System Platform |
| **AVEVA Edge** | 轻量级 HMI/SCADA，面向中小站点 |
| **AVEVA Connect** | 工业云平台，连接本地和云端 |

**与第三方系统集成**:
- KepServer EX、MatrikonOPC、TOP Server —— OPC Server 桥接
- Siemens S7、Rockwell/Allen-Bradley、Schneider Modicon —— PLC 驱动
- SQL Server、Oracle —— 数据库连接
- Ignition —— 竞争产品，但部分用户共存使用

### 4.4 最新发展趋势

1. **AVEVA 私有化（2023 年 1 月）**
   - Schneider Electric 完成对 AVEVA 的全资收购
   - AVEVA 从上市公司转为私有化
   - 战略整合: 工业自动化 + 工程设计 + 数据管理

2. **云化战略**
   - **AVEVA Connect** 工业云平台
   - **AVEVA Flex** 订阅制许可模式
   - InTouch 本地部署 + 云端监控的混合模式
   - **Operations Management Interface (OMI)** 作为下一代操作管理界面

3. **从 InTouch for System Platform 到 OMI 的迁移**
   - InTouch for System Platform（ArchestrA 集成版本）逐步被 OMI 替代
   - 2026 版明确加速迁移支持
   - 传统 InTouch HMI 继续支持本地 Windows 部署

4. **Ignition 等竞争者的压力**
   - InTouch 2025 作为直接回应发布
   - 保持 All-Inclusive System Platform 许可模式
   - 强调与 AVEVA 全产品线的深度集成作为差异化

5. **No Tag Limit（2023 版）**
   - 历史上 InTouch 按 Tag 数量收费，限制了大站点的采用
   - 2023 版取消 Tag 数量限制，降低大项目部署门槛
   - 配合 AVEVA Flex 订阅制，定价模式向使用量转移
---

## 5. 市场定位

### 5.1 主要应用行业

- **石油天然气**: 炼化厂、管道监控、海上平台 HMI
- **化工**: 流程工业的过程监控、配方管理、批次控制
- **水处理**: 污水处理厂、自来水厂的 SCADA/HMI 系统
- **电力**: 发电厂、变电站监控、电网调度辅助
- **制造业**: 汽车装配线、电子制造、离散制造
- **制药**: GMP 合规的过程监控、电子批记录
- **食品饮料**: 生产线监控、配方管理

### 5.2 与 WinCC, iFIX, FactoryTalk 的竞争对比

| 产品 | 开发商 | 优势 | 劣势 |
|------|--------|------|------|
| **InTouch (AVEVA)** | AVEVA/Schneider | 图形设计灵活、报警系统强大、Historian 集成、System Platform 企业级 | 价格不透明、订阅制转型中、依赖 Windows |
| **WinCC** | Siemens | TIA Portal 集成、西门子 PLC 深度绑定、工业生态完整 | 封闭生态、跨厂商兼容性弱 |
| **iFIX** | GE/Tridium | 价格较低、OPC 支持好、灵活部署 | 设计器较老、企业级功能弱于 InTouch |
| **FactoryTalk** | Rockwell/Allen-Bradley | AB PLC 深度集成、制造业强、CIP/Safety 原生 | 封闭生态、主要在北美市场 |
| **Ignition** | Inductive Automation | 跨平台、开源架构、现代 Web 界面、价格透明 | 企业级深度不如 InTouch、遗留系统集成成本高 |

**InTouch 的差异化优势**:
1. 40 年历史积累的图形化 HMI 设计经验
2. 业界最强的报警管理系统（Alarm & Event Subsystem）
3. Tag Dictionary 集中化数据模型（与 Signal-based 模型形成对比）
4. 与 AVEVA 全产品线（System Platform, Historian, MES, PI）的深度集成
5. 庞大的遗留系统安装基数和成熟的迁移路径

### 5.3 主要批评与局限

1. **依赖 Windows** —— 运行时必须运行在 Windows 上，无 Linux/macOS 版本
2. **非实时操作系统** —— 不保证确定性，不适合硬实时控制
3. **价格不透明** —— 不公开标价，需通过分销商报价
4. **订阅制转型** —— 从永久许可转向 AVEVA Flex 订阅制，增加长期拥有成本
5. **技术栈老旧** —— ActiveX 依赖、.NET 间接集成，不如现代 Web 技术栈灵活
6. **Ignition 等现代竞争者** —— 跨平台、Web 原生、价格透明的竞争压力
---

## 6. 产品特色

### 6.1 标志性功能与设计理念

**1. Display Designer（窗口设计器）—— 图形化 HMI 设计标杆**
- 拖拽式界面设计，符号库（Symbol Factory）提供丰富的工业控件
- Animation Links 机制: 图形对象与 Tag 双向绑定（颜色、大小、可见性、位置）
- 多窗口管理: 支持弹窗、条件显示、窗口间导航
- 所见即所得: 设计时即可预览运行时效果

**2. Tag Dictionary（Tag 字典）—— 集中化数据管理**
- 所有变量（Tag）集中管理，支持 Memory Tag 和 I/O Tag 两种类型
- I/O Tag 通过 Access Name 定义通信路径，解耦变量定义与通信配置
- Dot Fields 机制: Tag 可携带扩展属性（HiLimit, HiStatus, LoLimit 等），支持运行时动态修改
- $System 系统 Tag: 内置系统变量，无需外部配置
- 2023 版取消 Tag 数量限制，支持大规模部署

**3. Alarm Management（报警管理）—— 业界最强报警系统**
- 1-999 优先级分级，4 个 Range 可独立配置颜色和确认策略
- 多种报警类型: Hi/Low/HiHi/LoLo/Digital/Time-out
- 抑制/确认机制: Acknowledge、Suppress、Unsuppress
- 报警显示控件: 高级查看器、组列表、分布式显示
- 报警历史记录与 Historian 集成
- 报警 Annunciation: 弹窗、闪烁、声音提示

**4. QuickScript —— 嵌入式脚本语言**
- 7 种脚本类型覆盖应用级、窗口级、按键级、条件级、数据变更级、函数级、ActiveX 事件级
- BASIC/JavaScript 混合语法，易于上手
- 事件驱动执行模型，优先保证 UI 响应性

**5. Runtime/Design-time 分离模式**
- WindowMaker（设计器）+ WindowViewer（运行时）清晰分离
- 运行时可部署在任意 Windows 机器上（含 Web/Mobile/RDS 客户端）
- 设计时修改不中断运行时

### 6.2 成功的应用案例

1. **石化炼化厂** —— 全流程工艺监控，报警管理覆盖数万个 Tag
2. **水处理厂** —— SCADA 级分布式监控，多个远程站点集中显示
3. **发电厂** —— 电力参数实时监控，历史趋势分析
4. **制药厂** —— GMP 合规的过程监控，电子批记录集成 Historian
5. **汽车制造** —— 生产线 HMI，与 PLC 和 MES 系统深度集成
---

## 7. 对 AUDESYS 的参考价值

### 7.1 HMI 运行时架构参考

**InTouch 的 Design-time / Runtime 分离模式**对 AUDESYS Studio IDE + Runtime 架构的启示:

| InTouch 概念 | AUDESYS 可借鉴之处 |
|-------------|-------------------|
| **WindowMaker**（设计器） | AUDESYS Studio IDE 的图形化 HMI 设计器 |
| **WindowViewer**（运行时） | AUDESYS Runtime 的 HMI 渲染引擎 |
| **Display**（窗口） | AUDESYS 的 HMI 屏幕/视图 |
| **Animation Links** | AUDESYS 的 Signal → UI 控件双向绑定 |
| **Symbol Factory** | AUDESYS 的 HMI 控件库/组件库 |
| **Runtime 客户端** | AUDESYS 的多客户端架构（本地/Web/Mobile） |

**关键设计模式**:
- **Runtime 与 Designer 分离**: AUDESYS Studio（设计）和 Runtime（执行）应该清晰分离
- **事件驱动脚本引擎**: InTouch 的脚本优先级机制（UI 响应优先）值得参考
- **无限 Read-Write 客户端**: AUDESYS 应支持多个 HMI 客户端同时访问
- **不依赖实时操作系统**: InTouch 运行在 Windows 上的经验说明 HMI 不需要硬实时，但 AUDESYS 的 Supervisor 层需要确定性

### 7.2 报警管理系统的设计模式

InTouch 的报警系统是**业界最强的报警管理方案之一**，对 AUDESYS 报警模块有重要参考价值:

**设计模式清单**:

1. **优先级分级** (Priority 1-999, 4 Ranges)
   - AUDESYS 可参考: 定义 3-5 级报警优先级（CRITICAL/HIGH/MEDIUM/LOW/INFO）
   - 每个级别可配置颜色、确认策略、通知渠道

2. **确认机制** (Acknowledge)
   - AUDESYS 需要: 报警确认流程（选确认/全确认/按优先级确认）
   - 确认状态持久化（断电后恢复）

3. **抑制机制** (Suppress)
   - AUDESYS 需要: 临时屏蔽报警（维护模式、启动阶段）
   - Inhibit Tag 模式: 通过另一个 Tag 控制报警抑制

4. **报警历史** (Historical Logging)
   - AUDESYS 需要: 报警事件日志（时间戳、类型、值、确认状态）
   - 与历史数据库集成（类似 Historian）

5. **报警显示控件**
   - 高级查看器（排序、过滤、查询、冻结）
   - 组列表、分布式显示
   - Annunciation（弹窗、闪烁、声音）

6. **报警配置属性**
   - Hi/Low/HiHi/LoLo 限值
   - 延时确认、延时激活
   - 确认/取消确认策略

### 7.3 Tag-based 数据模型 vs Signal-based 模型的对比

这是 AUDESYS 设计者需要**深入思考**的核心架构决策:

| 维度 | InTouch Tag 模型 | AUDESYS Signal 模型 | 差异分析 |
|------|-----------------|-------------------|---------|
| **核心概念** | Tag（标记）—— 命名变量 | Signal（信号）—— 命名数据通道 | Tag 偏 HMI 变量，Signal 偏通信通道 |
| **数据流方向** | 双向（Read-Write） | 单写多读（Signal）/ 多写多读（StreamChannel） | Signal 更明确表达方向性 |
| **存储位置** | 中央 Tag Dictionary | 分布在各节点 | Tag 集中，Signal 分布式 |
| **通信机制** | Access Name（通信路径抽象） | amw_transport（传输层抽象） | 两者都是通信抽象层 |
| **属性系统** | Dot Fields（Tag.HiLimit 等） | Signal 属性 + QoS | Dot Fields 简单灵活，QoS 更结构化 |
| **实时性** | 非实时（Windows 调度） | RT 线程（确定性） | AUDESYS 更严格 |
| **事件驱动** | Condition/Data Change Script | Signal 事件感知 + StreamChannel | 两者都支持事件驱动 |
| **报警集成** | 报警属性配置在 Tag 中 | 报警作为 Signal 的消费者 | AUDESYS 更灵活 |

**关键洞察**:
- InTouch 的 **Tag Dictionary 集中管理模式**在企业级部署中非常实用，但存在单点瓶颈
- AUDESYS 的 **Signal-based 模型**更分布式，更适合多进程/多节点部署
- **Dot Fields 机制**值得借鉴: 为 AUDESYS Signal 添加可配置的元数据属性（类似 HiLimit/LoLimit）
- **Access Name 机制**值得借鉴: 通信路径与变量定义解耦，支持热切换通信后端

### 7.4 OPC 作为通信桥梁的架构启示

InTouch 通过 OPC 作为**标准化通信桥梁**，实现了与任意 PLC/SCADA 的互操作。

**对 AUDESYS 的启示**:
- AUDESYS HAL 应提供类似 OPC 的**标准化接口层**，允许第三方系统通过标准协议接入
- **amw_transport** 层应支持多种传输后端（inproc/zenoh/UDS/OPC UA），与 InTouch 的多驱动策略类似
- **通信路径抽象**（Access Name）模式值得借鉴: 将通信配置与变量定义分离

### 7.5 Runtime/Design-time 分离模式

InTouch 的 **WindowMaker（设计器）+ WindowViewer（运行时）** 分离模式是 HMI/SCADA 领域的经典架构。

**对 AUDESYS 的启示**:
- AUDESYS Studio IDE 应提供完整的 HMI 设计器（类似 WindowMaker）
- AUDESYS Runtime 应提供独立的 HMI 渲染引擎（类似 WindowViewer）
- 设计时修改不应中断运行时（热部署能力）
- 运行时支持多客户端（本地/Web/Mobile）

### 7.6 总结: InTouch 对 AUDESYS 的核心借鉴价值

1. **报警管理系统**是 InTouch 最成熟的功能模块，AUDESYS 应从中汲取优先级分级、确认机制、抑制机制、历史日志的设计经验
2. **Tag Dictionary 集中管理**虽然适合企业级部署，但 AUDESYS 的分布式 Signal 模型更灵活，应在两者之间找到平衡
3. **Design-time / Runtime 分离**是 HMI/SCADA 领域的最佳实践，AUDESYS 应遵循
4. **OPC 通信桥梁模式**对 AUDESYS 的标准化接口设计有重要参考价值
5. **QuickScript 的 7 种脚本类型**为 AUDESYS 的脚本/事件系统提供了成熟的参考模式
