# 工业仪器仪表通讯标准：HART / Foundation Fieldbus / PROFIBUS PA / PROFINET

> 文档定位：为 AUDESYS HAL 的协议适配层设计提供工业仪器仪表通讯协议的参考基准。

---

## 目次

1. [产品画像](#一产品画像)
   - [HART 协议](#11-hart-协议)
   - [Foundation Fieldbus (FF)](#12-foundation-fieldbus-ff)
   - [PROFIBUS PA](#13-profibus-pa)
   - [PROFINET](#14-profinet)
2. [技术特性](#二技术特性)
3. [功能概览](#三功能概览)
4. [现状与生态](#四现状与生态)
5. [市场定位](#五市场定位)
6. [产品特色](#六产品特色)
7. [对 AUDESYS 参考价值](#七对-audesys-参考价值)

---

## 一、产品画像

### 1.1 HART 协议

#### 基本信息

| 属性 | 内容 |
|------|------|
| **全称** | HART（Highway Addressable Remote Transducer，可寻址远程传感器高速通道）协议 |
| **标准组织** | FieldComm Group（原 HART Communication Foundation，2015 年与 Fieldbus Foundation 合并） |
| **首次发布** | 1986 年（HART 5），由 Rosemount Inc.（现 Emerson）开发 |
| **IEC 标准** | IEC 62591（WirelessHART，2009 年批准）；HART 也列为 IEC 61784-1 CPF 9（Communication Profile Family 9） |
| **当前版本** | HART 7.9（2024 年更新），Specification Kit 包含 17 份文档 |
| **官网** | https://www.fieldcommgroup.org |

#### 关键里程碑

| 版本 | 年份 | 关键特性 |
|------|------|---------|
| HART 5 | 1986 | 4-20mA 模拟 + FSK 数字叠加，点对点和多点模式（max 15 设备），PV 变量带状态，设备状态 |
| HART 6 | ~2000 | 全部变量带状态，增强型多变量支持，数字回路检查，本地接口锁定，32 字符 Tag，对等消息（Peer-to-peer） |
| HART 7 | ~2007 | WirelessHART（IEC 62591）、HART-IP（以太网 HART）、多点模式扩展至 63 设备、事件报告（Report by Exception）、时间戳、PV 趋势、同步采样 |

#### 核心价值主张

HART 的设计哲学是"**在现有 4-20mA 基础上叠加数字通信**"，使得工厂可以在不更换布线的情况下升级智能仪表功能。这是工业自动化历史上最成功的**向后兼容**策略——全世界部署了超过 4,000 万 HART 设备（据 FieldComm Group）。

HART 的核心理念：
- **模拟+数字双通道**：4-20mA 承载主要过程变量（PV），FSK 数字信号承载设备诊断、配置、多变量数据
- **渐进式升级**：传统 4-20mA 仪表可以通过 HART 手操器立即获得数字功能
- **现场总线过渡**：WirelessHART 和 HART-IP 为绿色工厂和改造项目提供无布线选项

---

### 1.2 Foundation Fieldbus (FF)

#### 基本信息

| 属性 | 内容 |
|------|------|
| **全称** | FOUNDATION Fieldbus（现场总线基金会现场总线） |
| **标准组织** | FieldComm Group（原 Fieldbus Foundation，2015 年与 HART Communication Foundation 合并） |
| **首次发布** | 1996 年（H1），2000 年（HSE） |
| **IEC 标准** | IEC 61158 Type 1（H1 + HSE），IEC 61804（Function Blocks），IEC 61784-1 CPF 1 |
| **技术规范** | 完整规范包（H1 / HSE / Physical Layer / Application Guides），由 20+ 份文档组成 |
| **官网** | https://www.fieldcommgroup.org |

> **关键澄清**：Foundation Fieldbus 和 HART 是**两种不同的协议**，在 2015 年之前由两个独立的标准组织管理（HART Communication Foundation 和 Fieldbus Foundation），2015 年两家合并为 FieldComm Group 后由同一组织管理，但协议本身完全不同。

#### 关键里程碑

| 里程碑 | 年份 | 说明 |
|--------|------|------|
| ISA SP50 委员会成立 | 1985 | Fieldbus 标准化的起点 |
| ISP + WorldFIP 合并 | 1994 | 成立 Fieldbus Foundation |
| H1 (31.25 kbps) 发布 | 1996 | 首版物理层 + 数据链路层 |
| HSE (100 Mbps) 发布 | 2000 | 高速以太网骨干网 |
| FF-SIF 发布 | ~2008 | 功能安全（Safety Instrumented Functions） |
| ITK 6.x 发布 | 2010s | 增强互操作性测试 |
| 与 HART CF 合并 | 2015 | 成立 FieldComm Group |

#### 核心价值主张

Foundation Fieldbus 的设计目标是实现"**控制在现场**"（Control in the Field）——将传统 DCS 中的 PID 等控制功能从中央控制器下沉到现场仪表中。其核心卖点：
- **全数字通信**：从仪表到控制室全部数字化，精度无损
- **分布式控制**：AI/PID/AO 等功能块在现场设备中执行，无需中央控制器
- **设备互操作性**：任何 FF 注册设备可以在任何 FF 主机系统中互换使用（通过 ITK 认证保证）
- **两线制总线供电**：H1 段可以同时供电和通信，减少布线成本

---

### 1.3 PROFIBUS PA

#### 基本信息

| 属性 | 内容 |
|------|------|
| **全称** | PROFIBUS PA（Process Automation，过程自动化） |
| **标准组织** | PROFIBUS & PROFINET International（PI），总部位于德国卡尔斯鲁厄（Karlsruhe） |
| **首次发布** | 1996 年（PROFIBUS PA） |
| **IEC 标准** | IEC 61158 Type 3（PROFIBUS）+ Type 10（PROFINET），IEC 61784-1 CPF 3 |
| **成员** | 全球超过 1,400 家会员公司 |
| **官网** | https://www.profibus.com |

> 注：PROFIBUS PA 使用与 Foundation Fieldbus H1 **相同的物理层**（IEC 61158-2 MBP，Manchester Bus Powered，31.25 kbps），但应用层协议完全不同。同一根电缆可以跑两种协议之一，但不能同时跑。

#### 关键里程碑

| 里程碑 | 年份 | 说明 |
|--------|------|------|
| PROFIBUS DP 发布 | 1993 | 工厂自动化高速总线（RS-485，12 Mbps） |
| PROFIBUS PA 发布 | 1996 | 过程自动化版本（MBP 物理层，本安） |
| PROFINET 发布 | 2000s | 以太网继任者 |
| PROFIsafe 发布 | ~2005 | 功能安全协议层（SIL3） |
| PROFIenergy 发布 | ~2010 | 能源管理协议 |
| PROFINET IRT | 2000s | 等时同步实时通讯 |
| PROFINET over TSN | 2023+ | TSN 集成（V2.4+） |

---

### 1.4 PROFINET

#### 基本信息

| 属性 | 内容 |
|------|------|
| **全称** | PROFINET（Process Field Network） |
| **标准组织** | PROFIBUS & PROFINET International（PI） |
| **定位** | PROFIBUS DP/PA 的工业以太网继任者 |
| **IEC 标准** | IEC 61158 Type 10，IEC 61784-2 CPF 3（实时以太网） |
| **最新规范** | V2.5（2026 年 4 月发布），新增全面安全集成 + SXP 传输协议 |
| **官网** | https://www.profibus.com |

#### 核心价值主张

PROFINET 的核心定位是"**一网到底**"（One Network for All）——使用标准以太网承载从非实时配置到高精度运动的全部通信：
- **非实时（NRT）**：TCP/IP，用于配置和诊断（~100ms）
- **实时（RT）**：跳过 TCP/IP 栈，软件实时（1-10ms 周期）
- **等时同步实时（IRT）**：硬件时间槽分片，31.25µs 周期，<1µs 抖动
- **TSN**：IEC/IEEE 60802 集成，支持时间敏感网络

---

## 二、技术特性

### 2.1 物理层对比

| 维度 | HART（有线） | WirelessHART | FF H1 | PROFIBUS PA | PROFIBUS DP | PROFINET |
|------|-------------|-------------|-------|-------------|-------------|----------|
| **传输介质** | 4-20mA 铜缆（屏蔽双绞线） | 2.4 GHz 无线电 | 屏蔽双绞线（Type A） | 屏蔽双绞线（Type A） | RS-485 双绞线 | 以太网铜缆/光纤 |
| **传输速率** | 1,200 bps（FSK） | 250 kbps（IEEE 802.15.4） | 31.25 kbps | 31.25 kbps | 最高 12 Mbps | 100 Mbps / 1 Gbps |
| **调制方式** | FSK（Bell 202）：1,200Hz="1"，2,200Hz="0" | O-QPSK + DSSS + FHSS | Manchester 编码 | Manchester 编码 | NRZ（RS-485） | 以太网（100BASE-TX/1000BASE-T） |
| **供电方式** | 4-20mA 回路供电 | 电池/能量收集 | 总线供电（9-32V DC） | 总线供电（MBP） | 独立供电 | 独立供电 / PoE |
| **拓扑** | 点对点或多点（总线） | Mesh 网格 | 总线/菊花链/树形 | 总线/菊花链/树形 | 线性总线 | 星形/线形/环形/树形 |
| **最大距离** | ~3,000m（取决于电缆） | 200m 节点间 / 2,000m LOS（视距） | 1,900m（主干+支线总长） | 1,900m | 1,200m（取决于速率） | 100m（铜缆）/ 数公里（光纤） |
| **最大设备数/段** | 1（点对点）或 15（多点 HART 5/6），63（HART 7 多点） | 250+ 设备（每 Gateway） | 最多 32 设备/段（典型 12-16） | 最多 32 设备/段 | 最多 32 站/段 | 不限（交换机级联） |
| **本质安全** | 支持（本安隔离栅） | 本安电池供电 | FISCO 模型 | FISCO 模型 | 不适用（通常安全区域） | 不适用 |

### 2.2 协议栈架构

#### 2.2.1 HART 协议栈（OSI 模型映射）

```
┌─────────────────────────────────────────────────┐
│  HART Application Layer                          │
│  ┌─────────────────────────────────────────────┐ │
│  │ 命令系统 (Universal / Common Practice /     │ │
│  │           Device Specific Commands)          │ │
│  │ 数据类型定义 (PV/SV/TV/QV, Dynamic Variables)│ │
│  │ HART-IP 映射层 (HART-IP: UDP/TCP 5094)      │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  HART Network Layer & Transport Layer            │
│  ┌─────────────────────────────────────────────┐ │
│  │ 统一网络层（汇聚 Token-Passing + TDMA + IP） │ │
│  │ 端到端传输可靠性与流控                        │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  HART Data Link Layer                            │
│  ┌───────────────────┐ ┌───────────────────────┐ │
│  │ Token-Passing     │ │ TDMA (WirelessHART)   │ │
│  │ (有线 HART)       │ │ 10ms 时隙             │ │
│  │ 主从轮询 + 突发   │ │ Superframe 周期调度   │ │
│  └───────────────────┘ └───────────────────────┘ │
├─────────────────────────────────────────────────┤
│  HART Physical Layer                             │
│  ┌───────────────────┐ ┌───────────────────────┐ │
│  │ FSK Bell 202      │ │ IEEE 802.15.4-2006    │ │
│  │ 4-20mA 模拟叠加   │ │ 2.4GHz DSSS O-QPSK    │ │
│  └───────────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**HART 命令结构分层**：

| 命令类别 | 命令号范围 | 说明 |
|---------|-----------|------|
| **Universal Commands（通用命令）** | 0–30 | 所有 HART 设备必须实现。如：读 PV（cmd 1）、读 PV 电流和量程百分比（cmd 2）、读动态变量（cmd 3）、写 PV 单位（cmd 44）等 |
| **Common Practice Commands（通用实践命令）** | 32–126 | 推荐实现，覆盖大多数仪表通用功能。如：读附加变量（cmd 33）、设置量程（cmd 35）、回路测试（cmd 40）、突发模式配置（cmd 103-109）等 |
| **Device Specific Commands（设备特定命令）** | 128–253 | 厂商自定义，如特殊传感器校准、专有诊断等 |

**HART 动态变量**：
- **PV**（Primary Variable，主变量）：通常映射为 4-20mA 模拟信号
- **SV**（Secondary Variable，第二变量）
- **TV**（Tertiary Variable，第三变量）
- **QV**（Quaternary Variable，第四变量）
- 每个变量携带状态字节（Quality：Good/Uncertain/Bad，Limit Status，Device Family Status）

#### 2.2.2 Foundation Fieldbus H1 协议栈

```
┌─────────────────────────────────────────────────┐
│  FF Application Layer                            │
│  ┌─────────────────────────────────────────────┐ │
│  │ Function Block Application Process          │ │
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │ │
│  │ │ AI  │ │ AO  │ │ PID │ │ DI  │ │ RA  │   │ │
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │ │
│  │ Transducer Block (传感器/执行器特定参数)     │ │
│  │ Resource Block (设备标识 + 诊断)            │ │
│  ├─────────────────────────────────────────────┤ │
│  │ Fieldbus Message Specification (FMS)        │ │
│  │ - VCR (Virtual Communication Relationship)  │ │
│  │ - Publisher/Subscriber (周期数据)            │ │
│  │ - Client/Server (非周期服务)                │ │
│  │ - Report Distribution (报警/事件)           │ │
│  ├─────────────────────────────────────────────┤ │
│  │ Fieldbus Access Sublayer (FAS)              │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  FF Data Link Layer (H1)                         │
│  ┌─────────────────────────────────────────────┐ │
│  │ Link Active Scheduler (LAS)                 │ │
│  │ - Compel Data (CD): 强制设备广播周期数据     │ │
│  │ - Pass Token (PT): 授权设备非周期通信        │ │
│  │ - Time Distribution (TD): 全网时钟同步       │ │
│  │ - Probe Node (PN): 探测新接入设备            │ │
│  │ - Live List 维护                             │ │
│  │ Token-Passing 逻辑环 + 调度表 (Schedule)     │ │
│  │ 设备角色: Basic / Link Master / Bridge       │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  FF Physical Layer (H1, IEC 61158-2)             │
│  ┌─────────────────────────────────────────────┐ │
│  │ Manchester 编码, 31.25 kbps                   │ │
│  │ 总线供电 (9-32V DC), 可本安 (FISCO)          │ │
│  │ MBP (Manchester Bus Powered)                 │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**FF 设备块（Block）模型**：

| 块类型 | 功能 | 典型示例 |
|--------|------|---------|
| **Resource Block** | 设备硬件信息、制造商 ID、设备状态诊断 | 每个设备 1 个 |
| **Transducer Block** | 传感器/执行器特定参数（校准、量程、线性化等） | 温度 RTD Transducer、压力 Transducer |
| **Function Block** | 控制功能 | AI（模拟输入）、AO（模拟输出）、DI（数字输入）、DO（数字输出）、PID（比例积分微分控制）、RA（比率）、SPL（分程）、ISEL（信号选择器）、CHAR（特征化）等 |

**Link Active Scheduler (LAS) — FF H1 的核心调度器**：

LAS 是 H1 段上负责仲裁通信的设备（每个段同时只有一个活动 LAS，可以有多个备用 Link Master）。其职责：
1. **Compel Data (CD)**：按调度表（Schedule）在确定的时刻强制指定设备广播其 Publisher 数据
2. **Pass Token (PT)**：在非周期时间窗口内按地址升序向设备发放令牌，授予非周期通信权限
3. **Time Distribution (TD)**：定期广播全网时钟同步帧
4. **Probe Node (PN)**：向未使用的地址发探测帧，发现新加入的设备
5. **Live List 维护**：维护所有活动设备的列表，定期广播给备用 LAS

**VCR (Virtual Communication Relationship) 类型**：

| VCR 类型 | 通信模式 | 触发方式 | 用途 |
|----------|---------|---------|------|
| **Publisher/Subscriber** | 1:N 广播（单向） | CD Token（周期） | 功能块间过程变量传递 |
| **Client/Server** | 1:1 请求/应答 | PT Token（非周期） | 配置、诊断、参数读写 |
| **Report Distribution** | 1:N 广播（事件驱动） | PT Token（非周期） | 报警、事件通知 |

**HSE（High Speed Ethernet）架构**：

HSE 是 FF 的以太网骨干层，用于连接多个 H1 段和主机系统：
- 传输速率：100 Mbps
- 设备角色：HSE Linking Device（连接 H1 段到 HSE）、HSE Field Device（直接连接以太网的 FF 设备）、HSE Host
- 通过 Linking Device（如 ABB LD 800HSE/810HSE）实现 H1 ↔ HSE 间的数据重发布（Republishing）

#### 2.2.3 PROFIBUS PA / PROFINET 协议栈

```
┌─────────────────────────────────────────────────┐
│  Application Process                             │
│  ┌─────────────────────────────────────────────┐ │
│  │ PA Profile / PROFIdrive / PROFIenergy / ... │ │
│  │ 参数模型 (Slot + Index 寻址)                  │ │
│  │ 诊断模型 (模块化诊断)                         │ │
│  ├─────────────────────────────────────────────┤ │
│  │ DPV0 (周期数据交换) / DPV1 (非周期数据交换)  │ │
│  │ DPV2 (等时同步 + 时钟同步)                    │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  Data Link Layer                                 │
│  ┌───────────────────┐ ┌───────────────────────┐ │
│  │ PROFIBUS DP/PA    │ │ PROFINET RT/IRT/NRT   │ │
│  │ Token-Passing     │ │ RT: VLAN + 优先级     │ │
│  │ (DP: RS-485)      │ │ IRT: 时间槽分片       │ │
│  │ (PA: MBP + 耦合器)│ │ NRT: TCP/UDP/IP       │ │
│  └───────────────────┘ └───────────────────────┘ │
├─────────────────────────────────────────────────┤
│  Physical Layer                                  │
│  ┌───────────────────┐ ┌───────────────────────┐ │
│  │ RS-485 / MBP      │ │ Ethernet (100M/1G)    │ │
│  │ (PA 通过 DP/PA    │ │ PoE (Powered Device)  │ │
│  │  Coupler 或 Link) │ │ APL (Advanced Phys.   │ │
│  │                   │ │ Layer, 以太网到现场)  │ │
│  └───────────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**PROFIBUS 设备类型 (DP 侧)**：

| 类别 | 功能 |
|------|------|
| **DP Master Class 1 (DPM1)** | 中央控制器（PLC），执行周期数据交换 |
| **DP Master Class 2 (DPM2)** | 编程/诊断工具 |
| **DP Slave** | 现场 I/O、驱动器、传感器/执行器 |

**PROFIBUS PA 代理 (Proxy) 架构**：

PA 设备不能直接连接到 PROFIBUS DP 主站，需要通过 Proxy 转换：
- **DP/PA Coupler（耦合器）**：透明转换，PA 段速率受限于 31.25 kbps，PA 设备直接可见于 DP 主站
- **DP/PA Link（链路器）**：智能网关，PA 段有独立的总线周期，DP 和 PA 解耦

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│ DP Master│──DP──┤ DP/PA Coupler├──PA──┤ PA Devices  │
│ (PLC)    │ 12Mbps │ (透明转换)    │31.25k │ (变送器/阀)   │
└──────────┘         └──────────────┘         └──────────────┘
```

**PROFINET 通信通道**：

| 通道 | 技术 | 周期 | 抖动 | 适用场景 |
|------|------|------|------|---------|
| **NRT（非实时）** | TCP/UDP/IP | ≥100ms | - | 参数配置、诊断、Web 服务器 |
| **RT（实时）** | 跳过 TCP/IP 栈，VLAN 优先级 | 1-10ms | - | 常规 I/O 数据交换 |
| **IRT（等时同步实时）** | 硬件时间槽分片（RED/GREEN 阶段），全网时钟同步 | 31.25µs-4ms | <1µs | 高精度运动控制、多轴同步 |
| **TSN（时间敏感网络）** | IEEE 802.1Qbv 时间感知整形（V2.4+） | <1ms | - | 融合 IT/OT 网络 |

**PROFINET IRT 工作原理**：

IRT 将以太网带宽划分为两个时间片（Phase）：
- **RED Phase（红色阶段）**：仅允许 IRT 数据帧（RTC3），由控制器预先计算调度表，精确到每个帧何时从哪个端口发出
- **GREEN Phase（绿色阶段）**：开放给所有非 IRT 通信（标准 TCP/IP 和其他 PROFINET RT 帧）

通过全网时钟同步（精度 <1µs）和时间槽分片，IRT 能够保证在 31.25µs 周期内完成一次输入 → 处理 → 输出的闭环。

**PROFIsafe — 功能安全协议**：

PROFIsafe 是叠加在 PROFIBUS/PROFINET 通信之上的安全层（"黑色通道"原则）：
- 安全等级：支持 SIL3（IEC 61508）/ PL e（ISO 13849）
- 协议包含：连续编号（Sign-of-Life）、时间期望+确认（Watchdog）、F-地址（发送方/接收方标识）、CRC 校验
- 最小安全数据：1-13 字节（工厂自动化），最大支持 123 字节
- 认证：由 IFA 和 TÜV 等安全评估机构认证
- "黑色通道"原则：PROFIsafe 不关心底层传输介质和协议，仅保护 Payload 的完整性

**GSD（General Station Description，通用站描述）**：

PROFIBUS/PROFINET 使用 GSD 文件描述设备特性：
- **PB-GSD**：PROFIBUS 设备，关键字文本格式（GSDL，GSD Language）
- **PN-GSD**：PROFINET 设备，XML 格式（GSDML，GSD Markup Language）
- GSD 内容：设备标识（VendorID + DeviceID）、模块/子模块结构、通信参数、诊断信息、F-Parameter（PROFIsafe）
- 必备性：所有认证设备必须提供 GSD 文件，认证测试会检查 GSD 的正确性

### 2.3 设备描述技术对比

| 维度 | HART (DDL/EDDL) | FF (DD/CFF) | PROFIBUS/PROFINET (GSD) |
|------|----------------|-------------|------------------------|
| **语言** | EDDL（Electronic Device Description Language，IEC 61804-3） | DD（Device Description）+ CFF（Capability File） | GSDL（文本）/ GSDML（XML） |
| **标准** | IEC 61804-3 | IEC 61804 | IEC 61784（Profile 定义） |
| **新一代** | FDI（Field Device Integration，合并 EDDL + FDT/DTM） | FDI | FDI + PA Profile |
| **核心功能** | 描述设备参数、方法、菜单结构 | 描述块参数、VCR 定义、功能块能力 | 描述模块/子模块结构、IO 数据布局、参数 |
| **认证** | FCG 注册 | ITK（Interoperability Test Kit） | PI 认证测试 |

---

## 三、功能概览

### 3.1 HART 功能清单

| 功能类别 | 具体功能 | 版本要求 |
|---------|---------|---------|
| **基本过程数据** | PV（4-20mA 模拟信号）+ SV/TV/QV 数字读取 | HART 5+ |
| **多变量读取** | 单次命令读取所有动态变量 | HART 5+ |
| **设备诊断** | 设备状态（位掩码）、扩展设备状态（HART 6+14 字节） | HART 5+ |
| **状态字节** | 每个变量独立质量状态（Good/Uncertain/Bad） | HART 6+ |
| **突发模式** | 设备自主周期发布数据（无需主机轮询） | HART 5+ |
| **事件通知** | Report by Exception（过程值超限、设备状态变化时发送） | HART 7 |
| **时间戳** | 数据采样时间戳（1ms 精度） | HART 7 |
| **PV 趋势** | 设备内缓存历史数据，批量上传给主机 | HART 7 |
| **同步采样** | 多个设备同步采样 | HART 7 |
| **回路测试** | 锁定 4-20mA 输出到指定值，验证回路完整性 | HART 5+ |
| **多点模式** | 最多 15（HART 5/6）或 63（HART 7）设备共享一个回路 | HART 5+ |
| **无线通讯** | WirelessHART Mesh 网络，2.4GHz，TSMP（Time Synchronized Mesh Protocol） | HART 7 |
| **以太网通讯** | HART-IP over UDP/TCP（端口 5094），IPv4/IPv6 | HART 7 |
| **安全** | 有线：Token-Passing 访问控制； Wireless：AES-128 加密 + 逐跳认证 + 端到端加密 | HART 7 |
| **电池供电** | 超低功耗通信模式 + 智能报告（仅在值变化或超时发送） | HART 7/WirelessHART |

### 3.2 Foundation Fieldbus 功能清单

| 功能类别 | 具体功能 | 说明 |
|---------|---------|------|
| **过程数据交换** | Publisher/Subscriber 1:N 周期广播 | LAS 用 CD Token 精确调度，典型 100ms-1s 周期 |
| **设备参数化** | Client/Server 1:1 非周期服务 | 读写功能块参数、校准、配置 |
| **报警与事件** | Report Distribution | 过程报警（Hi-Hi、Hi、Lo、Lo-Lo）、设备故障报警 |
| **控制功能** | 标准功能块 (AI/AO/DI/DO/PID/RA/SPL/...) | PID 可在现场变送器或阀门定位器中执行 |
| **链路调度** | Link Active Scheduler (LAS) | 一个 H1 段上多个设备可配置为 Link Master（备用 LAS） |
| **时钟同步** | Time Distribution (TD) | 全网 ±1ms 同步精度 |
| **设备接入** | Probe Node (PN) + 地址分配 | 新设备自动检测并加入 Live List |
| **冗余** | 备用 LAS + HSE 冗余链接设备 | LD 800HSE/810HSE 支持冗余对 |
| **本质安全** | FISCO（Fieldbus Intrinsically Safe Concept） | 单段可支持 4-8 个本安设备 |
| **安全功能** | FF-SIF（Safety Instrumented Functions） | 安全等级 SIL2/SIL3 |
| **互操作性** | ITK（Interoperability Test Kit）认证 | 任何 ITK 认证设备可在任何 FF 主机互换 |
| **功能块调度** | Macrocycle（宏周期）概念 | LAS 在宏周期内精确安排每个 VCR 的执行时间 |

### 3.3 PROFIBUS PA 功能清单

| 功能类别 | 具体功能 | 说明 |
|---------|---------|------|
| **周期数据交换** | DPV0：主站轮询从站，从站响应 | 每个 DP 周期交换输入/输出数据 |
| **非周期参数访问** | DPV1：非周期读写 | 通过 Slot + Index 寻址设备参数 |
| **等时同步** | DPV2：等时模式 | 主站和从站同步时钟，用于高速运动控制 |
| **过程自动化** | PA Profile | 标准化变送器、阀门、二进制设备的行为参数 |
| **功能安全** | PROFIsafe | SIL3，黑通道叠加 |
| **设备描述** | GSD 文件 | 描述设备通信参数和模块特性 |
| **本质安全** | FISCO（与 FF H1 相同物理层） | MBP 物理层的本安实现方案 |
| **代理网关** | DP/PA Coupler 或 DP/PA Link | 使 PA 段接入 DP 网络 |

### 3.4 PROFINET 功能清单

| 功能类别 | 具体功能 | 说明 |
|---------|---------|------|
| **周期 IO 数据** | RT 通信通道 | 1-10ms 更新周期（CC-A/B/C） |
| **等时同步** | IRT 通信通道 | 31.25µs-4ms 周期，<1µs 抖动，±1µs 时钟精度（CC-C） |
| **非周期服务** | NRT / Record Data | 读写参数、诊断、拓扑发现 |
| **设备替换** | 自动设备恢复（无需工程工具） | 用设备名（而非 IP）寻址，简化替换 |
| **网络拓扑** | LLDP + SNMP | 自动发现网络物理拓扑，用于 IRT 调度优化 |
| **功能安全** | PROFIsafe | SIL3，在标准通信通道上叠加安全层 |
| **能源管理** | PROFIenergy | 非生产时段暂停设备以节能 |
| **过程自动化** | PA Profile for PROFINET | PROFIBUS PA 设备参数模型延伸到 PROFINET |
| **驱动控制** | PROFIdrive | 编码器、变频器、伺服驱动器的标准化应用行规 |
| **诊断** | 通道级诊断 + 模块状态 | 模块化设备模型（Slot + Subslot + Channel） |
| **冗余** | S2（系统冗余）/ R1（环冗余） | PROFINET MRP（Media Redundancy Protocol） |
| **安全集成** | Secure SXP over TCP（V2.5+） | 安全配置（IDevID 证书）、安全通信 |
| **TSN 集成** | PROFINET over TSN（V2.4+） | 融合 OT/IT 网络的时间确定性通信 |

---

## 四、现状与生态

### 4.1 HART 生态现状

| 维度 | 现状 |
|------|------|
| **全球部署** | 超过 4,000 万 HART 设备在线运行（FieldComm Group 数据） |
| **设备制造商** | 全球 200+ 厂商生产 HART 认证设备 |
| **WirelessHART 网络** | 50,000+ 无线网络部署 |
| **WirelessHART 注册产品** | 15 家制造商的设备通过 FCG 注册 |
| **WirelessHART 网关** | Emerson 1410S/781S（200+ 设备）、INTREPID（250 设备/Gateway）等 |
| **标准版本** | HART 7.9（最新规范），WirelessHART 规范定期更新（IEC 62591:2016 + 2021 Corrigendum） |
| **主机系统支持** | 几乎所有 DCS（Emerson DeltaV、Honeywell Experion、ABB 800xA、Siemens PCS 7）都原生支持 HART |
| **HART-IP 发展** | 逐步普及中，用于将 HART 网络接入工厂以太网（HART 7.7 增强版） |
| **FDI 进展** | FieldComm Group 与 PI 联合推动 FDI（合并 EDDL + FDT/DTM），FDI 1.0 已发布，处于行业采纳期 |
| **认证程序** | FCG 提供开发和注册服务，包括：协议栈测试、物理层测试、EDD 测试、互操作性测试 |

### 4.2 Foundation Fieldbus 生态现状

| 维度 | 现状 |
|------|------|
| **全球部署** | 数百万 FF 节点在线运行（主要在过程工业） |
| **设备制造商** | 全球 50+ 厂商（含 Emerson、ABB、Yokogawa、Endress+Hauser、Siemens、Pepperl+Fuchs 等） |
| **注册设备** | 所有 FF 设备需通过 ITK 认证和 FCG 注册 |
| **主机系统** | Emerson DeltaV、ABB 800xA、Yokogawa CENTUM VP、Honeywell Experion PKS 等原生支持 |
| **Linking Device** | ABB LD 800HSE/810HSE（4 个 H1 通道，支持冗余）、Pepperl+Fuchs 等 |
| **本质安全** | FISCO 模型广泛应用（最大 1,000m 主干，60m 支线，255m 最长支线） |
| **HSE 部署** | 主要集中在工厂骨干网连接，HSE 现场设备较少（市场被 PROFINET/EtherNet/IP 挤压） |
| **趋势** | 新项目采用 Foundation Fieldbus 的比例在**下降**（更多转向 PROFINET PA 或 Ethernet-APL），但已有装机量巨大，长期维护需求持续 |

### 4.3 PROFIBUS PA / PROFINET 生态现状

| 维度 | 现状 |
|------|------|
| **PI 成员** | 全球超过 1,400 家会员公司 |
| **PROFIBUS 节点** | 截至 2024 年，全球安装超过 6,400 万 PROFIBUS 节点 |
| **PROFINET 节点** | 截至 2024 年，全球安装超过 6,000 万 PROFINET 节点，年增长率 20%+ |
| **PROFINET 认证设备** | 数千种设备从 300+ 制造商 |
| **PROFIsafe** | 累计部署数百万安全节点（SIL3 认证），被 IFA/TÜV 认可 |
| **PROFIenergy** | 在汽车制造等行业广泛应用 |
| **APL（Advanced Physical Layer）** | 2019 年后新兴技术——将以太网通过 2 线电缆延伸到现场（10 Mbps，最远 1,000m），直接取代 4-20mA 连接。PI 的 PROFINET over APL 是最积极的推进者之一 |
| **GSD 工具** | PI 提供 GSD 检查工具（GSD Checker），所有认证设备必须通过 GSD 验证 |
| **测试实验室** | 全球 10+ PI 认证测试实验室（含中国 ITEI） |

---

## 五、市场定位

### 5.1 协议定位矩阵

| 维度 | HART | Foundation Fieldbus | PROFIBUS PA | PROFINET |
|------|------|---------------------|-------------|----------|
| **主要市场** | 过程工业（化工、石化、制药、电力） | 过程工业（炼油、化工、制药） | 过程工业 + 工厂自动化混合 | 全行业（过程 + 离散制造） |
| **典型应用** | 仪表配置、设备诊断、资产管理 | 回路控制（PID 在现场）、分布式控制 | 过程变量监控 + 预测性维护 | 高速运动控制、生产线 IO、过程控制 |
| **部署类型** | 改造（Brownfield）为主，也用于新建（Greenfield） | 新建（Greenfield）为主，改造较少 | 新建为主（传统 PA），逐步迁移到 PROFINET PA | 新建为主，快速增长的工业以太网标准 |
| **系统复杂度** | 低（叠加在 4-20mA 上） | 高（需要 FF 工程工具、ITK 认证） | 中（DP/PA 桥接需额外组件） | 中-高（线形/环形拓扑需规划） |
| **成本** | 低（无需更换布线） | 中-高（需要 FF 专用硬件 + 工程培训） | 中（PA 耦合器/链路器增加成本） | 中（使用标准以太网组件，但 IRT 需专用交换机） |
| **技术成熟度** | 极度成熟（40 年历史） | 成熟（25 年历史），但在衰退阶段 | 成熟（25 年历史），向 PROFINET 迁移中 | 成熟+快速增长（20 年历史） |
| **未来趋势** | → FDI + HART-IP + WirelessHART 并行发展 | → 逐步被 PROFINET PA / Ethernet-APL 替代 | → 向 PROFINET over APL 迁移 | → TSN 集成，成为"一网到底"的事实标准 |

### 5.2 HART vs 其他协议的关键差异

HART 与其他协议的最大区别在于它的**过渡性设计**：
- **HART 不是"全数字总线"**，而是"模拟+数字混合"——这使得它无法像 FF 或 PROFIBUS 那样实现控制功能在现场设备中执行
- **WirelessHART 的价值**：当 HART 7 引入 WirelessHART 后，HART 获得了**无线网状网络能力**，这在爆燃区域布线成本极高的场景下具有独特优势
- **HART-IP 的价值**：将以太网引入 HART 世界，使 HART 数据可以直接进入工厂 IT 网络，而不需要通过特殊的 HART 多路复用器

### 5.3 Foundation Fieldbus vs PROFIBUS PA 的差异化

这两个协议使用**相同的物理层**（IEC 61158-2 MBP），但在应用层设计哲学上完全不同：

| 维度 | Foundation Fieldbus | PROFIBUS PA |
|------|---------------------|-------------|
| **控制位置** | 控制在现场（Function Block 中执行） | 控制在中央（DP Master 中执行） |
| **设备智能** | 高（设备包含功能块执行能力） | 低（设备主要是 I/O + 参数化） |
| **通信主导权** | LAS 集中仲裁 | DP Master 主导轮询 |
| **工程复杂度** | 高（需要设计功能块连接、宏周期调度） | 中（GSD 导入 + 参数化） |
| **灵活性** | 极高（功能块可以在设备和主机间自由分配） | 中等（周期性数据交换主要由主站控制） |

这种差异导致了市场的自然分化：
- FF 在**大型化工/炼化一体化项目**中有优势（分布式控制减免中央机柜间 + 大量回路控制需求）
- PROFIBUS PA 在**中型过程工厂和混合行业**（食品饮料、水处理、制药）更有优势（与 Siemens PCS 7/PCS neo 等主流 DCS 天然绑定）

### 5.4 PROFINET 的崛起与市场影响

PROFINET 目前是工业以太网增长最快的协议之一（仅次于 EtherNet/IP），其成功有以下几个关键因素：
1. **PI 组织的开放性**：1,400 家成员比任何单一供应商的方案都更有生态系统
2. **Siemens 全栈推动**：从 TIA Portal 工程工具到 SIMATIC 控制器到 ET 200 I/O，Siemens 的完整产品栈都是 PROFINET First
3. **TSN 未来兼容**：V2.4 引入 TSN 使 PROFINET 成为唯一同时支持 RT、IRT 和 TSN 的工业以太网协议
4. **APL 延长触达**：PROFINET over APL 使得以太网可以延伸到传统 4-20mA 设备的安装位置

---

## 六、产品特色

### 6.1 HART 的特色

1. **无可比拟的向后兼容性**：40 年历史，每一代新版本都保持向下兼容。HART 7 设备可以在 HART 5 主机上以 HART 5 模式工作
2. **独特的物理层"免费搭车"设计**：FSK 信号叠加在 4-20mA 电流回路上，互不干扰，频分复用
3. **WirelessHART 网格网络**：自组织、自愈的 Mesh 拓扑（TSMP — Time Synchronized Mesh Protocol），每个设备都可以作为路由器转发邻居的消息，自动冗余路径
4. **超低功耗**：WirelessHART 设备通常用电池工作 5-10 年（2.4GHz 射频仅在时间槽内短暂激活）
5. **HART-IP 无缝桥接**：同一应用层协议跑在 4-20mA FSK、WirelessHART 2.4GHz 或 HART-IP Ethernet 上，工厂级统一访问
6. **FDI 技术引领**：合并 EDDL 和 FDT/DTM 两个竞争标准，提供一个统一的设备集成框架

### 6.2 Foundation Fieldbus 的特色

1. **控制在现场（Control in the Field）**：唯一的将控制回路（PID 等）直接在变送器和阀门定位器中执行的协议
2. **确定性调度（LAS + Macrocycle）**：通过 LAS 和宏周期保证了控制回路的确定性和严格时序
3. **发布/订阅数据模型**：功能块以 Publisher/Subscriber 方式传递数据，不经过中央控制器，减少通信开销
4. **ITK 互操作性保证**：任何通过 ITK 认证的设备都可以在任何 FF 主机系统中互换（理论上的"即插即用"）
5. **两线制总线供电+通信**：减少布线成本，本质安全支持（FISCO）
6. **标准化功能块库**：从基本 AI/AO 到高级 PID/RA/SPL，功能块由标准定义而非厂商私有

### 6.3 PROFIBUS PA 的特色

1. **与 Siemens 生态无缝集成**：PROFIBUS PA 设备可以直接通过 Step 7 / TIA Portal 配置，工程体验统一
2. **PA Profile**：为过程设备（变送器、阀门、二进制设备）定义了标准化的参数模型
3. **DP/PA 桥接灵活**：可以选择透明 Coupler（低成本）或智能 Link（去耦速率）
4. **PROFIsafe**：功能安全叠加层，安全信号和标准信号在同一电缆上传输
5. **与 PROFINET 的平滑演进**：PA Profile 可以直接迁移到 PROFINET，保护用户投资

### 6.4 PROFINET 的特色

1. **三通道通信（NRT/RT/IRT）**：一条以太网电缆承载从非实时配置到等时同步运动控制的全部通信
2. **IRT（等时同步实时）**：31.25µs 周期 + <1µs 抖动，满足最苛刻的运动控制需求（多轴印刷机、包装机）
3. **设备替换即插即用**：通过设备名（而非 IP 地址）寻址，更换相同类型设备后自动恢复通信
4. **"黑色通道"安全**：PROFIsafe 安全信号和标准 IO 共享同一电缆，无需独立安全网络
5. **TSN 未来兼容**：PROFINET over TSN 使工控网络可以与 IT 网络真正融合
6. **APL 延伸到现场**：通过以太网 APL，实现"一网到底"的愿景——从云到传感器全部跑 IP 协议

---

## 七、对 AUDESYS 参考价值

### 7.1 AUDESYS HAL 协议适配架构

AUDESYS HAL 定义了三种通信原语（Signal / StreamChannel / RPC），需要设计协议适配层来对接各种工业仪器仪表协议。建议架构如下：

```
┌───────────────────────────────────────────────────────┐
│              AUDESYS Protocol Adapter Layer            │
│                                                        │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │ HART        │ │ FF/Fieldbus  │ │ PROFINET/PA    │  │
│  │ Adapter     │ │ Adapter      │ │ Adapter        │  │
│  │             │ │              │ │                │  │
│  │ Commands→RPC│ │ Publisher→   │ │ Cyclic IO→     │  │
│  │ Burst→Signal│ │ Signal       │ │ Signal         │  │
│  │ Events→     │ │ LAS CD→      │ │ IRT→ Signal    │  │
│  │ StreamCh.   │ │ Signal(Sched)│ │ RT→ Signal     │  │
│  │             │ │ PT→RPC       │ │ NRT→ RPC       │  │
│  └─────────────┘ └──────────────┘ └────────────────┘  │
│                                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │        Device Description Registry (DDR)         │   │
│  │  GSD Parser | EDDL Parser | DD/CFF Parser       │   │
│  │  → Cyclic Data Mapping → HAL Signal Name/Type   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
├─────────────────────────────────────────────────────────┤
│                AUDESYS HAL Core                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Signal  │  │ StreamChannel │  │        RPC        │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│                        │                                │
│              amw (AUDESYS Middleware)                    │
└─────────────────────────────────────────────────────────┘
```

### 7.2 各协议到 HAL 原语的映射

#### 7.2.1 HART → HAL 映射

| HART 通信模式 | HAL 映射 | 理由 |
|--------------|----------|------|
| **HART 命令请求/响应**（Universal / Common Practice / Device Specific） | **HAL RPC** | 天然的请求-回复模式；HART Command Number → RPC method ID；响应状态字节 → RPC status |
| **突发模式（Burst Mode）**连续数据发布 | **HAL Signal** | 单写（设备）多读（主机）；新值覆盖旧值；PV/SV/TV/QV 周期发布 → Signal push 订阅 |
| **事件/报警通知**（Report by Exception） | **HAL StreamChannel**（事件驱动） | 事件可能有多条排队（报警队列），不应被覆盖；条件触发发送 → StreamChannel 缓冲 |
| **WirelessHART Mesh 数据流** | **HAL StreamChannel**（高吞吐 + 网状路由） | 网状网络中每个设备可能转发邻居数据；节点间通信 → StreamChannel 有缓冲队列 |
| **HART-IP 网关通信** | **amw_zenoh**（Phase 2+） | HART-IP 是基于 TCP/UDP 的，天然由 amw_zenoh 的网络层承载 |

**AUDESYS 特有的 HART 适配器设计要点**：
1. **命令映射表**：HART 适配器需要维护 HART Command → RPC method 的映射表，保证通用命令（0-30）在 AUDESYS 侧有统一的接口签名
2. **变量映射**：HART PV/SV/TV/QV → HAL Signal(component.pv) / Signal(component.sv) 等命名规则
3. **HART DD/EDDL 解析器**：读取 EDDL 文件生成 HAL Signal 的类型定义（14 种类型映射）
4. **WirelessHART 网络管理**：网络管理器作为 AUDESYS 组件运行，使用 RPC 配置设备和路由

#### 7.2.2 Foundation Fieldbus → HAL 映射

| FF 通信模式 | HAL 映射 | 理由 |
|------------|----------|------|
| **Publisher/Subscriber（周期数据）** | **HAL Signal** | 单写（Publisher 功能块）多读（Subscriber 功能块）；周期数据新值覆盖旧值；LAS 用 CD Token 触发的周期更新 → HAL Signal push |
| **Client/Server（非周期参数）** | **HAL RPC** | 请求-回复语义；读/写 FF 参数 → RPC call |
| **Report Distribution（报警/事件）** | **HAL StreamChannel** | 报警可能需要缓冲（如操作员未确认的报警）；事件驱动的数据流 |
| **LAS 调度 + Macrocycle** | HAL Signal 更新由 **RT 线程**驱动 | LAS 的 CD Token 调度表映射为 RT 线程中 Signal 的 publish 调用时机 |
| **HSE 骨干网数据重发布** | amw_zenoh | HSE Linking Device 间的重发布由 amw_zenoh 的网络层处理 |
| **设备发现与地址分配** | **HalDiscovery** | FF 系统管理（SM）的地址分配和 Tag 查找 → HalDiscovery 服务 |

**AUDESYS 特有的 FF 适配器设计要点**：
1. **LAS 模拟**：AUDESYS 仿真器中需要模拟 LAS 的行为——按照 Macrocycle 调度表在确定的时刻向虚拟 FF 设备发 CD Token，触发 Signal publish
2. **功能块映射**：FF 功能块被建模为 AUDESYS 组件，功能块的输入/输出参数作为 HAL Signal
3. **DD/CFF 解析器**：解析 FF 的 Device Description 和 Capability File，生成 HAL 组件和 Signal 定义
4. **宏周期与 RT 线程对齐**：FF Macrocycle（典型 100ms-1s）应与 AUDESYS RT 线程周期保持整数倍关系

#### 7.2.3 PROFIBUS PA → HAL 映射

| PA 通信模式 | HAL 映射 | 理由 |
|------------|----------|------|
| **DPV0 周期数据交换**（主站轮询从站 IO 数据） | **HAL Signal** | DP Master 周期读写从站数据；典型的单写（从站）多读（主站+诊断工具）；循环数据 → Signal 周期更新 |
| **DPV1 非周期参数访问** | **HAL RPC** | Slot+Index 请求 → HAL RPC method；参数读写 → RPC call |
| **PROFIsafe 安全信号** | **HAL Signal**（独立 Security Domain） | 安全信号通过 HalQoS security_domain 标记隔离；与标准信号共享同一个 Signal 原语但有不同的 QoS 约束 |
| **报警/诊断** | **HAL StreamChannel** | 诊断事件可能多条排队；PA 设备的模块诊断信息 → StreamChannel 事件流 |

#### 7.2.4 PROFINET → HAL 映射

| PROFINET 通信模式 | HAL 映射 | 理由 |
|-------------------|----------|------|
| **RT 周期 IO 数据** | **HAL Signal** | 典型的 IO 控制器写入 → IO 设备读取的模式；周期数据 → Signal（push 模式，RT 线程内同步回调） |
| **IRT 等时同步数据** | **HAL Signal**（高优先级 RT 线程） | 高速、确定性数据交换（31.25µs-4ms）；严格的时序要求 → AUDESYS D13 混合调度中 RT 线程驱动 |
| **NRT 非实时服务**（配置、诊断、拓扑发现） | **HAL RPC** | 请求-回复语义；Record Data Read/Write → RPC call |
| **PROFIsafe 安全信号** | **HAL Signal**（独立 Security Domain + HalQoS deadline） | 安全信号有时序约束（Watchdog 超时 = 安全停车），HalQoS deadline 强制执行 |
| **报警** | **HAL StreamChannel** | PROFINET 诊断报警（通道级、模块级）→ StreamChannel 事件缓冲 |
| **设备替换/即插即用** | **HalDiscovery** | 设备名匹配 + MAC 地址更新 → HalDiscovery 重新绑定 |
| **GSDML 解析** | 设备描述注册器（DDR） | 从 GSDML XML 生成 HAL 组件模型和 Signal 表 |

### 7.3 设备描述注册器（DDR）设计

AUDESYS 需要一个统一的设备描述注册器来处理不同协议的设备描述文件：

```
┌─────────────────────────────────────────────────────┐
│           Device Description Registry (DDR)         │
│                                                      │
│  ┌──────────────────┐ ┌────────────────────────────┐ │
│  │ GSD/GSDML Parser │ │ EDDL/DD/CFF Parser         │ │
│  │ (PROFIBUS/PN)    │ │ (HART/FF)                  │ │
│  │                  │ │                            │ │
│  │ XML → Module     │ │ DD Token → Block Model     │ │
│  │        Model     │ │ CFF → VCR Definitions      │ │
│  └────────┬─────────┘ └────────────┬───────────────┘ │
│           │                        │                 │
│           └──────────┬─────────────┘                 │
│                      ▼                               │
│           ┌─────────────────────┐                    │
│           │ Unified Device Model│                    │
│           │ (Protocol-Neutral)  │                    │
│           └──────────┬──────────┘                    │
│                      ▼                               │
│  ┌────────────────────────────────────────────────┐  │
│  │  HAL Artifact Generator                        │  │
│  │  • Signal definitions (name, type, writer)     │  │
│  │  • RPC method definitions                     │  │
│  │  • StreamChannel definitions                   │  │
│  │  • Component manifests                        │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**DDR 的关键设计原则**：
1. **协议无关的统一模型**：解析后的设备模型不依赖原始协议（HART/FF/PROFIBUS），而是转换为 AUDESYS 的 Component + Signal + RPC 模型
2. **静态生成 + 动态查询**：设备描述文件通常在工程阶段（编译时/配置时）解析生成 HAL 工件，但 DDR 也保留运行时查询能力（用于在线参数化）
3. **14 种类型映射**：各协议的设备参数类型映射到 AUDESYS 的 14 种类型系统（Bool/S8-S64/U8-U64/F32/F64/String/Blob/Array<T>）

### 7.4 仿真器中的协议模拟架构

AUDESYS Simulator 需要能够模拟各种仪器仪表设备的行为：

```
┌─────────────────────────────────────────────────────────┐
│                    Simulator                              │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ Virtual HART │ │ Virtual FF   │ │ Virtual          │ │
│  │ Device       │ │ Function     │ │ PROFINET IO      │ │
│  │ (T, P, F, L) │ │ Block        │ │ Device           │ │
│  │              │ │ (AI/AO/PID)  │ │ (Modules)        │ │
│  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘ │
│         │                │                    │          │
│         ▼                ▼                    ▼          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │        Protocol Emulation Engine                    │ │
│  │  • HART Command Handler (Universal + Common Prac.) │ │
│  │  • FF Function Block Execution Engine               │ │
│  │  • PROFINET DPV0/DPV1 State Machine                 │ │
│  │  • Process Model (simulate PV from SP + noise)     │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              AUDESYS HAL                             │ │
│  │  Signal ←→ Process Variables (PV/SV/TV/QV)          │ │
│  │  RPC ←→ Configuration Commands                      │ │
│  │  StreamChannel ←→ Alarms/Events/Diagnostics         │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 7.5 技术路线图建议

| 阶段 | 协议支持 | 实现方式 |
|------|---------|---------|
| **Phase 1（原型）** | HART（有限集：Universal Commands 0,1,2,3 + 简单多点） | 纯软件模拟，HART 命令 → RPC 直通 |
| **Phase 2（HAL 集成）** | HART 全量 + WirelessHART + FF H1 基本功能 | 协议适配层 + DDR + HAL Signal/RPC 映射 |
| **Phase 3（以太网）** | PROFINET RT + HART-IP + FF HSE | amw_zenoh 传输层集成 |
| **Phase 4（高级）** | PROFINET IRT + PROFIsafe + FF-SIF | HAL RT 线程调度 + Security Domain 隔离 |

### 7.6 关键设计洞察

1. **HART 的混合模拟/数字设计启示**：AUDESYS 的 HAL 也可以在内部使用"高性能路径"（Signal，类似 4-20mA）和"功能路径"（RPC，类似 HART FSK）的双通道设计——关键变量走 Signal（低延迟），非关键参数走 RPC（灵活性）
2. **FF LAS 的确定性调度**：对 AUDESYS RT 线程的 Macrocycle 调度设计有直接参考价值——在一个宏周期内为所有 Signal 的 push 分配确定的时间槽
3. **PROFINET IRT 的时间分片**：RED/GREEN Phase 概念可应用于 AUDESYS 的混合调度（D13）——RT 线程 = RED Phase（严格实时），I/O 线程 = GREEN Phase（非实时但需低延迟）
4. **HART 命令三层分层**：AUDESYS 的 RPC 接口设计可以参考 HART 的命令分层——一层通用接口（所有组件都有）、一层行业通用接口（类似 FF 功能块）、一层设备特定接口
5. **GSD/EDDL 解析与代码生成**：DDR 可以在编译时从设备描述文件生成 AUDESYS 组件代码和 Signal 定义，保证运行时的类型安全和零开销

### 7.7 与现有协议的区别定位

AUDESYS HAL 不是另一个现场总线协议——它是运行在更上层（RTOS/通用 OS）的抽象层。具体的现场总线协议（HART/FF/PROFIBUS/PROFINET）通过协议适配层接入 HAL。这一定位类似于：
- **Linux 内核的 VFS（Virtual File System）**：ext4/NTFS/btrfs 是不同的文件系统实现，但上层应用通过统一的 open/read/write 系统调用操作文件
- **AUDESYS 的 amw**：HART/FF/PROFINET 是不同的协议实现，但上层组件通过统一的 Signal/StreamChannel/RPC 原语进行通信

### 7.8 深度技术讨论：周期时间与确定性分析

不同协议对实时性的要求各不相同，AUDESYS 的 RT 线程调度（D13）需要协调这些差异：

| 协议 | 最小周期 | 典型周期 | 确定性保证机制 | AUDESYS 对应 |
|------|---------|---------|---------------|-------------|
| **HART 有线** | 500ms（单变量轮询） | 1-2s（多点模式） | 主从轮询，无冲突 | I/O 线程或低优先级 RT 线程即可满足 |
| **WirelessHART** | 1s（快速模式） | 8-64s（电池供电模式） | TDMA 时隙 + Mesh 自愈 | I/O 线程或 Supervisor 线程即可满足 |
| **FF H1** | 100ms | 250ms-1s（Macrocycle） | LAS 确定性调度表 | RT 线程，与 Macrocycle 对齐 |
| **PROFIBUS DP** | 1ms | 5-20ms | Token-Passing 确定性 | I/O 线程（非严格 RT） |
| **PROFIBUS PA** | 10ms（通过 Link） | 50-100ms | 受限于 PA 段 31.25 kbps | I/O 线程 |
| **PROFINET RT** | 1ms | 2-10ms | VLAN 优先级 + RT 跳过 TCP/IP | I/O 线程或低优先级 RT |
| **PROFINET IRT** | 31.25us | 250us-4ms | 硬件时间槽分片 + 全网时钟同步（<1us 精度） | 高优先级 RT 线程（需硬件支持） |

**AUDESYS 的调度策略**：

```
┌───────────────── RT Macrocycle (1ms-100ms) ────────────────┐
│                                                              │
│ [t0] Signal Input Refresh (所有周期 Signal 快照)            │
│ [t1] RT Logic Execution (ST 程序/PID 控制等)                │
│ [t2] Signal Output Publish                                  │
│                                                              │
│ ── RT Phase End ──                                          │
│                                                              │
│ [t3] Protocol Adapter Polling (HART cmd, FF LAS CD, PN RT) │
│ [t4] StreamChannel Processing (报警缓冲/事件分发)           │
│ [t5] RPC Request Handling (配置命令/HART cmd 响应)         │
│ [t6] HalDiscovery Refresh (设备加入/离开检测)              │
│                                                              │
│ ── I/O Phase End ──                                         │
│                                                              │
│ [t7] Idle/Background (日志/统计/自适应调度调整)             │
└──────────────────────────────────────────────────────────────┘
```

### 7.9 多协议共存的统一数据模型

当 AUDESYS 需要同时管理 HART、FF 和 PROFINET 设备时，统一的内部数据模型至关重要：

```yaml
# 统一设备模型示例
devices:
  - id: "TT-101"
    protocol: HART7
    address: { poll_addr: 5, long_tag: "REACTOR_TEMP_01" }
    components:
      - name: reactor_temp_01
        signals:
          - name: reactor_temp_01.pv
            type: F32, unit: "degC"
            hal_primitive: Signal  # HART 突发模式映射
            update_period: 1000ms
          - name: reactor_temp_01.sv
            type: F32, unit: "degC"
            hal_primitive: Signal
        rpcs:
          - cmd: 1, name: "read_pv", returns: F32
          - cmd: 35, name: "set_range", params: [F32, F32]

  - id: "FIC-201"
    protocol: FF_H1
    address: { node_id: 0x14, pd_tag: "FLOW_CTRL_201" }
    components:
      - name: flow_ctrl_201
        function_blocks:
          - type: AI, block_tag: "FIC-201/AI-1"
            signals:
              - name: flow_ctrl_201.ai_out
                type: F32
                hal_primitive: Signal  # FF Publisher
          - type: PID, block_tag: "FIC-201/PID-1"
            signals:
              - name: flow_ctrl_201.pid_out
                type: F32
                hal_primitive: Signal
            rpcs:
              - name: "set_mode", params: [S8], returns: S8

  - id: "MTR-301"
    protocol: PROFINET
    address: { device_name: "motor-301", ip: "192.168.1.30" }
    components:
      - name: motor_301
        modules:
          - slot: 1, subslot: 1, type: "DAP"
          - slot: 2, subslot: 1, type: "DigitalIO"
            signals:
              - name: motor_301.run_cmd
                type: BOOL
                hal_primitive: Signal  # PROFINET RT 周期 IO
                cycle: 10ms
              - name: motor_301.run_fb
                type: BOOL
                hal_primitive: Signal
          - slot: 3, subslot: 1, type: "PROFIsafe", domain: safety
            signals:
              - name: motor_301.safe_stop
                type: BOOL
                hal_primitive: Signal
                qos: { deadline: 20ms, security_domain: "safety" }
```

### 7.10 产业趋势与 AUDESYS 策略建议

**当前趋势**：
1. **Ethernet-APL (Advanced Physical Layer)**：将以太网通过 2 线电缆延伸到现场（10 Mbps, 1,000m），直接取代传统 4-20mA。PROFINET over APL 是最积极的推动者
2. **OPC UA FX (Field eXchange)**：OPC UA 正在向现场层扩展（PubSub over TSN），与 PROFINET/EtherNet/IP 形成竞争
3. **FDI 统一设备集成**：EDDL + FDT/DTM 合并为 FDI，目标是"一个工具配置任何协议的任何设备"
4. **NAMUR Open Architecture (NOA)**：过程工业的第二通道数据访问（通过 OPC UA 旁路 DCS 直接读取仪表数据），用于监测和优化而不影响控制回路
5. **TSN (Time-Sensitive Networking) 集成**：PROFINET V2.4+ 和 OPC UA FX 都在拥抱 TSN

**AUDESYS 应对策略**：
1. **协议适配层抽象**确保可以接入任何新协议，无需改动核心 HAL
2. **FDI 兼容的 DDR**：设备描述注册器应能解析 FDI Device Package，这是工业仪表描述的未来统一格式
3. **OPC UA PubSub 集成**：amw 抽象层可以考虑 amw_opcua 实现，使 AUDESYS 可以直接参与 OPC UA FX 网络
4. **NAMUR NOA 第二通道**：AUDESYS 的 StreamChannel 天然适合承载"非侵入式"的第二通道数据流，从既有 DCS 旁路读取仪表诊断数据
5. **TSN 就绪的 RT 调度**：D13 调度模型中应为 TSN 时间感知留出接口，确保未来与 IEEE 802.1Qbv 兼容

### 7.11 典型设备类别的 HAL 建模

以下为常见工业仪表类别的 HAL 组件建模建议：

| 设备类别 | 典型协议 | HAL Component | 关键 Signal | 关键 RPC |
|---------|---------|---------------|------------|----------|
| **压力变送器** | HART 7 | pressure_xmtr | pv (F32), sv_temp (F32), device_status (U8) | read_pv, set_range, loop_test, calibrate_zero |
| **温度变送器** | FF H1 | temp_xmtr | ai_out (F32), sensor_value (F32), cjc_temp (F32) | set_mode, read_sensor_config, reset_minmax |
| **科氏质量流量计** | HART 7 | coriolis_meter | mass_flow (F32), density (F32), temp (F32), totalizer (F64) | read_variables, reset_totalizer, zero_calibrate |
| **阀门定位器** | FF H1 | valve_positioner | feedback_pos (F32), setpoint (F32), ao_block_out (F32) | set_mode, calibrate_stroke, partial_stroke_test |
| **电导率分析仪** | PROFIBUS PA | conductivity_analyzer | conductivity (F32), temp_comp (F32), cell_constant (F32) | calibrate_cell, set_tc_mode |
| **振动监测器** | WirelessHART | vibration_monitor | overall_vib (F32), peak_vib (F32), alarm_status (U8) | set_alarm_thresholds, read_waveform |
| **伺服驱动器** | PROFINET IRT | servo_drive | pos_actual (S64), vel_actual (S32), torque_actual (S16), status_word (U16) | set_position_target, enable_drive, reset_fault |
| **安全光幕** | PROFINET + PROFIsafe | safety_light_curtain | osdd_status (BOOL), muted (BOOL), reset_req (BOOL) | — (安全设备通常不暴露参数化 RPC) |

### 7.12 与 AUDESYS 现有参考文档的呼应

本文档与 AUDESYS 其他参考文档的关系：

| 本文档（仪器仪表协议） | 其他参考文档 | 交叉参考点 |
|----------------------|------------|-----------|
| HART 协议分析 | beckhoff.md (EtherCAT)、siemens.md (PROFINET) | 对比 HART 慢速仪表总线与 EtherCAT 高速设备总线在实时性/确定性上的差异 |
| FF 功能块模型 | codesys.md (IEC 61131-3 编程)、openplc.md | FF 功能块与 IEC 61131-3 功能块的语义对比；PID 控制在现场 vs 中央的区别 |
| PROFINET IRT | beckhoff.md (EtherCAT 50us 周期) | 50us 周期 EtherCAT 与 31.25us 周期 PROFINET IRT 在运动控制中的差异 |
| WirelessHART Mesh | ros.md (ROS2 DDS 通信) | 对比 WirelessHART TSMP 与 ROS2 DDS 在发布/订阅可靠性上的差异 |
| PROFIsafe | siemens.md (西门子安全 PLC) | PROFIsafe 黑通道原则与 Siemens F-CPU 的安全通信对比 |

---

> **文档版本**: v1.0
> **编写日期**: 2026-07-13
> **来源**: FieldComm Group 官方网站 (fieldcommgroup.org)、PROFIBUS & PROFINET International (profibus.com)、IEC 61158/61784/62591 标准、ABB/Emerson/Pepperl+Fuchs 技术文档、PI 白皮书
> **状态**: 技术参数已通过公开资料交叉验证。标注"待确认"的信息需进一步核实。延迟/物理参数引用自标准及制造商数据手册，实际值受具体部署环境影响。

### 7.13 协议适配器集成测试策略

AUDESYS 的协议适配器需要通过系统化的集成测试来验证多协议互操作性：

| 测试类别 | 测试内容 | 验证方法 |
|---------|---------|---------|
| **命令/响应正确性** | HART 通用命令 0-30 全量回归 | 虚拟 HART 设备 + Golden Trace（已知正确输出） |
| **周期数据确定性** | FF H1 Macrocycle 内所有 Signal 的时间戳方差 < 1us | RDTSC 时间戳测量 + 统计分布分析 |
| **多协议共存** | 同一 RT Macrocycle 内混合 HART/FF/PROFINET 设备 | 信号隔离测试：确保协议间无交叉干扰 |
| **异常恢复** | 设备断开/恢复、WirelessHART 节点丢失、LAS 切换 | 自动恢复时间测量 + 数据完整性校验 |
| **类型安全** | 14 种 HAL 类型 ↔ 各协议类型映射双向验证 | 边界值测试（NaN, Inf, 最大值, 最小值, 零值） |
| **QoS 强制执行** | HalQoS deadline + security_domain 违反行为 | 注入延迟故障、跨域访问测试 |

### 7.14 关键性能指标 (KPI) 目标

对于协议适配层的性能目标（基于现有参考系统的实践经验）：

| 指标 | 目标值 | 前提条件 | 验证工具 |
|------|--------|---------|---------|
| **HART 命令响应延迟** | < 50ms（P2P 模式） | 单设备直连，无中继器 | cycle-counter / linux-perf |
| **FF H1 Signal 更新延迟** | < 5ms（InProc） | amw_inproc 模式，仿真 LAS | RDTSC 测量 publish→callback 间隔 |
| **PROFINET RT 周期抖动** | < 100us | PREEMPT_RT，核心隔离，UDS 传输 | cyclictest 等效测量 |
| **多协议内存开销** | < 50MB（100+ 虚拟设备） | 每个虚拟设备 < 500KB | /proc/pid/smaps 分析 |
| **GSD/EDDL 解析时间** | < 100ms（10KB 文件） | 典型设备描述文件大小 | wall-clock 计时 |

> 以上数值为设计目标（待实测验证），参考了 Beckhoff TwinCAT、ABB 800xA 和 Emerson DeltaV 的实际部署数据。


### 7.15 附录：关键标准与规范索引

| 标准编号 | 名称 | 与本文档的关联 |
|---------|------|-------------|
| **IEC 61158-2** | 工业通信网络 - 现场总线规范 - 第 2 部分：物理层规范和服务定义 | FF H1 和 PROFIBUS PA 的 MBP 物理层基础 |
| **IEC 61158-3/4/5/6** | 现场总线 - 数据链路层/应用层服务/协议 | HART（Type 20）、FF（Type 1）、PROFIBUS（Type 3）、PROFINET（Type 10） |
| **IEC 61784-1** | 工业通信网络 - 行规 - 第 1 部分：现场总线行规 | CPF 1 (FF)、CPF 3 (PROFIBUS/PROFINET)、CPF 9 (HART) |
| **IEC 61784-2** | 工业通信网络 - 行规 - 第 2 部分：实时以太网行规 | PROFINET RT/IRT 行规定义 |
| **IEC 61784-3-3** | 工业通信网络 - 行规 - 第 3-3 部分：功能安全现场总线 - CPF 3 附加规范 | PROFIsafe 安全协议规范 |
| **IEC 61804-3** | 过程控制功能块 (FB) — 第 3 部分：电子设备描述语言 (EDDL) | HART DDL/EDDL 和 FF DD 的基础标准 |
| **IEC 62591** | 工业网络 - 无线通信网络和通信行规 - WirelessHART | WirelessHART 完整规范 |
| **IEEE 802.15.4-2006** | 低速率无线个域网 (LR-WPAN) | WirelessHART 物理层基础 |
| **ISO/OSI 7498** | 开放系统互联基本参考模型 | 所有协议栈的架构参照 |
| **IEC 61508/IEC 61511** | 功能安全 (SIL) 标准 | PROFIsafe 和 FF-SIF 的安全等级依据 |
| **IEC 61987** | 工业过程测量和控制 — 过程设备目录的数据结构和元素 | PA Profile 的 CDD 参照 |

> 以上标准由 IEC (International Electrotechnical Commission) 发布，可通过 www.iec.ch 购买。PI 和 FieldComm Group 成员可访问补充技术文档。

### 7.16 工业仪表协议的共同设计模式与 HAL 抽象

通过分析 HART、Foundation Fieldbus 和 PROFIBUS/PROFINET 三个协议族，可以提取出跨协议的共同设计模式：

```
┌────────────────────────────────────────────────────────┐
│           共同设计模式 (Cross-Protocol Patterns)         │
│                                                         │
│  1. 过程变量发布 (Process Variable Publishing)          │
│     HART: Burst Mode        → HAL Signal                │
│     FF:   Publisher/Subscriber → HAL Signal             │
│     PN:   RT Cyclic IO          → HAL Signal            │
│     ─────────────────────────────────────────           │
│     共同特征：周期发布、新值覆盖、1:N 消费               │
│                                                         │
│  2. 参数读写 (Parameter Access)                         │
│     HART: Command/Response           → HAL RPC          │
│     FF:   Client/Server (FMS)        → HAL RPC          │
│     PN:   Record Data Read/Write     → HAL RPC          │
│     ─────────────────────────────────────────           │
│     共同特征：请求-回复、超时、有状态                    │
│                                                         │
│  3. 事件/报警 (Event Notification)                      │
│     HART: Report by Exception         → HAL StreamCh.   │
│     FF:   Report Distribution         → HAL StreamCh.   │
│     PN:   Diagnostic Alarm            → HAL StreamCh.   │
│     ─────────────────────────────────────────           │
│     共同特征：异步触发、有缓冲、不可覆盖                  │
│                                                         │
│  4. 设备描述 (Device Description)                       │
│     HART: EDDL/FDI     ┐                               │
│     FF:   DD/CFF/FDI   ├→ 统一 DDR (Device Desc.Reg.)  │
│     PN:   GSD/GSDML/PA Prof.┘                          │
│     ─────────────────────────────────────────           │
│     共同特征：离线解析 → HAL 元数据生成                  │
│                                                         │
│  5. 设备状态 (Device Health)                            │
│     HART: Device Status Byte → HAL Signal (U8)          │
│     FF:   Resource Block    → HAL Signal (U8)           │
│     PN:   Module Diagnosis  → HAL StreamCh. + Signal    │
│     ─────────────────────────────────────────           │
│     共同特征：周期轮询 + 异步事件                        │
└────────────────────────────────────────────────────────┘
```

这五个共同模式验证了 AUDESYS HAL 的三原语（Signal/StreamChannel/RPC）设计决策的正确性——三种正交原语足以覆盖三个协议族的所有核心通信模式，无需引入第四种原语（如 Action）。
