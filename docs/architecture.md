# AUDESYS 架构文档

> **更新日期**: 2026-07-19
> **状态**: 架构文档 - 反映当前 MVP 实现状态

---

## 目录

- [AUDESYS 架构文档](#audesys-架构文档)
  - [目录](#目录)
  - [AUDESYS 概述](#audesys-概述)
    - [什么是 AUDESYS](#什么是-audesys)
    - [应用场景](#应用场景)
    - [产品线](#产品线)
    - [术语速查](#术语速查)
  - [一、HAL 系统](#一hal-系统)
    - [1. 架构概览](#1-架构概览)
    - [2. 通信原语](#2-通信原语)
    - [3. amw 中间件抽象层](#3-amw-中间件抽象层)
    - [4. 工业 QoS](#4-工业-qos)
    - [5. 线程调度](#5-线程调度)
    - [6. Config Barrier](#6-config-barrier)
    - [7. 移植对接](#7-移植对接)
    - [8. 多语言策略](#8-多语言策略)
    - [9. 实施路线](#9-实施路线)
    - [10. 设计决策速查](#10-设计决策速查)
  - [二、Runtime 套件](#二runtime-套件)
    - [目录](#目录-1)
    - [1. Runtime 套件概览](#1-runtime-套件概览)
    - [2. 多进程拓扑](#2-多进程拓扑)
    - [3. 进程职责矩阵](#3-进程职责矩阵)
    - [4. Supervisor 模块](#4-supervisor-模块)
      - [4.1 进程生命周期管理](#41-进程生命周期管理)
      - [4.2 配置与参数管理](#42-配置与参数管理)
      - [4.3 组件更新管理](#43-组件更新管理)
    - [5. Controller 模块](#5-controller-模块)
      - [5.1 核心循环](#51-核心循环)
      - [5.2 硬件抽象层](#52-硬件抽象层)
      - [5.3 关键实时技术](#53-关键实时技术)
    - [6. Panel 模块](#6-panel-模块)
    - [7. Gateway 模块](#7-gateway-模块)
    - [8. Remote 模块](#8-remote-模块)
      - [8.1 核心功能设计](#81-核心功能设计)
      - [8.2 数据流](#82-数据流)
    - [9. Edge 模块](#9-edge-模块)
    - [10. AUDESYS Link 通信中间件](#10-audesys-link-通信中间件)
      - [10.1 定位](#101-定位)
      - [10.2 架构分层](#102-架构分层)
      - [10.3 使用者](#103-使用者)
    - [11. IPC 通信分层](#11-ipc-通信分层)
      - [UDS JSON-RPC（AUDESYS 标准进程间通信）](#uds-json-rpcaudesys-标准进程间通信)
    - [12. 多实例隔离](#12-多实例隔离)
      - [隔离维度](#隔离维度)
    - [13. 崩溃恢复与安全状态](#13-崩溃恢复与安全状态)
    - [14. 模块分类矩阵](#14-模块分类矩阵)
    - [15. 部署模式](#15-部署模式)
      - [三种部署形态](#三种部署形态)
      - [桌面 ↔ Web 的无缝切换](#桌面--web-的无缝切换)
  - [三、Studio 套件](#三studio-套件)
    - [1. 产品定位](#1-产品定位)
      - [创建端 vs 运行端](#创建端-vs-运行端)
    - [2. 现状评估](#2-现状评估)
      - [已设计（文档层面）](#已设计文档层面)
      - [关键发现](#关键发现)
    - [3. Studio 在 AUDESYS 中的位置](#3-studio-在-audesys-中的位置)
    - [4. 三层架构](#4-三层架构)
    - [5. 内置编辑器](#5-内置编辑器)
      - [插件编辑器（v2+）](#插件编辑器v2)
    - [6. RBAC 权限模型](#6-rbac-权限模型)
      - [四层权限](#四层权限)
      - [角色模板](#角色模板)
      - [权限决策流程](#权限决策流程)
    - [7. 多项目架构](#7-多项目架构)
      - [项目类型 -\> 编辑器映射](#项目类型---编辑器映射)
      - [项目生命周期](#项目生命周期)
    - [8. 插件系统](#8-插件系统)
      - [StudioEditor 接口](#studioeditor-接口)
      - [编辑器注册表](#编辑器注册表)
      - [插件安装流程](#插件安装流程)
    - [9. 部署模式](#9-部署模式)
      - [桌面端特殊能力](#桌面端特殊能力)
    - [10. 平台集成](#10-平台集成)
    - [11. 参考系统](#11-参考系统)
    - [12. 演进路线](#12-演进路线)
    - [13. 风险与决策点](#13-风险与决策点)
      - [技术风险](#技术风险)
      - [关键决策点](#关键决策点)
    - [14. 下一步行动](#14-下一步行动)
  - [四、Simulator 套件](#四simulator-套件)
    - [1. 架构 - 子进程模型](#1-架构---子进程模型)
    - [2. 仿真器 Profile（AVD Manager 模式）](#2-仿真器-profileavd-manager-模式)
    - [3. 7 种虚拟设备类型](#3-7-种虚拟设备类型)
    - [4. 协议仿真方案](#4-协议仿真方案)
    - [5. 仿真器生命周期](#5-仿真器生命周期)
  - [五、调试桥](#五调试桥)
    - [1. 协议 - DAP 子集 + 工业扩展](#1-协议---dap-子集--工业扩展)
    - [2. 三类断点 + Log Points](#2-三类断点--log-points)
    - [3. DAP 兼容子集](#3-dap-兼容子集)
    - [4. AUDESYS 工业调试扩展](#4-audesys-工业调试扩展)
    - [5. 调试 UX 关键模式](#5-调试-ux-关键模式)
    - [6. 与 HAL Protocol 集成](#6-与-hal-protocol-集成)
  - [六、Web 迁移路径](#六web-迁移路径)
    - [1. 桌面版 vs Web 版差异](#1-桌面版-vs-web-版差异)
    - [2. 代码复用率](#2-代码复用率)
    - [3. 迁移策略](#3-迁移策略)
      - [Phase 5a: WebSocket 传输层](#phase-5a-websocket-传输层)
      - [Phase 5b: Web 部署模式](#phase-5b-web-部署模式)
      - [Phase 5c: 多租户 SaaS](#phase-5c-多租户-saas)
    - [4. 架构差异图](#4-架构差异图)



## AUDESYS 概述

### 什么是 AUDESYS

**AUDESYS**（**Au**tomation **De**velopment **Sys**tem）是一个面向工业自动化的通用开发与运行时平台，覆盖**工业控制**、**软 PLC**、**测控与数据采集**、**上位机（HMI/SCADA）**、**机器人控制**和**数控加工**等应用场景。

传统上，这些领域各自发展出独立的工具链，开发者不得不在多个平台之间切换：

- **LabVIEW** — 图形化数据流编程，主导测控与虚拟仪器领域
- **ROS/ROS2** + **dora-rs** — 节点式分布式通信，聚焦机器人中间件
- **LinuxCNC** — 自研实时 HAL 与 G-code 解释器，深耕数控机床
- **CODESYS / TwinCAT** — 软 PLC 标准（IEC 61131-3），将 PLC 运行时移植到通用 PC

AUDESYS 借鉴了 Android Studio 的"**IDE + Runtime + Emulator + Debug Bridge**"分层模型，将其应用于工业自动化领域。通过统一的 **HAL 硬件抽象系统**（受 LinuxCNC HAL 和 dora-rs 数据流范式启发）、**Runtime 多进程套件**、**Simulator 设备仿真器**和**工业调试桥**，提供一条龙开发体验——编写软 PLC 梯形图逻辑、搭建机器人控制图、开发测控上位机、调试数控设备 G-code，均在同一平台内完成。

AUDESYS 的产品线包括：AUDESYS Studio（统一编辑器/IDE）、AUDESYS Runtime（PC 应用套件）、AUDESYS HAL（硬件抽象层协议）、AUDESYS Simulator（设备模拟器）和 AUDESYS Debug（调试桥）。Runtime 套件包含 Controller、Panel、Gateway、Remote、Edge、Supervisor 六个核心组件。

技术栈方面，实时控制路径采用 Rust/C/C++（子毫秒确定性），进程管理使用 Node.js，协议网关使用 Python。

### 应用场景

| 场景 | 核心需求 | AUDESYS 对应模块 |
|------|----------|-------------------|
| **工业控制** | 实时 I/O、确定性时序、多轴联动 | Controller + HAL + Studio + Panel |
| **软 PLC** | IEC 61131-3 运行时、梯形图/ST 编辑器 | Controller + HAL + Studio + Panel |
| **测控与数据采集** | 高速采样、信号处理、虚拟仪器面板 | Controller + HAL + Studio + Panel |
| **上位机（HMI/SCADA）** | 触摸屏交互、报警管理、趋势图 | Panel + Studio |
| **机器人控制** | 多节点协作、运动规划、传感器融合 | Controller + Link（参考 dora-rs） |
| **数控加工** | G-code 解析、轨迹插补、刀具补偿 | Controller + HAL（参考 LinuxCNC） |


### 产品线

| 产品 | 描述 | 技术栈 | 状态 |
|------|------|--------|------|
| AUDESYS Studio | 统一编辑器/IDE | TypeScript + React + @xyflow/react + Tauri | ✅ 已实现 |
| AUDESYS HAL | 硬件抽象层协议 | Rust + FlatBuffers | 🟡 详细设计完成 |
| AUDESYS Simulator | 设备模拟器 | Rust + SimulationHarness | 🟡 Inproc MVP |
| AUDESYS Debug | 调试桥 | Rust + DAP | ✅ DAP 已实现 |

### 术语速查

| 术语 | 说明 |
|------|------|
| **Studio** | 统一编辑器/IDE，可视化配置设备模板、流程逻辑和 HMI 界面 |
| **Runtime** | PC 应用套件，多进程实时控制系统 |
| **Runtime Supervisor** | 进程/参数/配置/更新管理器（Node.js） |
| **Runtime Controller** | 实时控制模块（Rust + HAL Core + amw_inproc），旧名 Act |
| **Runtime Panel** | 触摸屏 HMI 人机交互（Tauri + React），旧名 HMI |
| **Runtime Gateway** | 外部通信应用（MES/ERP/云对接） |
| **Runtime Remote** | 远程访问（WebRTC 浏览器 B/S 架构） |
| **Runtime Edge** | 边缘采集（7×24 独立运行） |
| **Link** | 通信中间件库/SDK |
| **HAL** | 硬件抽象层（Hardware Abstraction Layer） |
| **HAL Core** | HAL 核心实现（Rust，Sans-I/O） |
| **HAL Client** | 多语言 HAL 客户端绑定（Node.js/Python/C++） |
| **Phase H1-H8** | HAL 实施阶段（见 §一.9） |
| **Phase S1-S4** | Studio 实施阶段（见 §三.12） |
|| **Phase R1-R6** | Runtime 实施阶段（见 §二） |
|| **Phase L1-L3** | 多语言支持阶段（见 `docs/modules/hal/multi-language-strategy.md`） |

---

## 一、HAL 系统

> 🟡 **状态**: 详细设计完成 — 3 专家团队审核（27 项发现，全部交互式确认）
> **详细规范**: 见 `docs/modules/hal/` 目录下 19 份独立子文档，覆盖协议原语、amw、类型系统、线程调度、多语言等 17 个设计主题。

---

### 1. 架构概览

HAL 是 AUDESYS 的多语言通信核心，用 **三种正交原语**（Signal、StreamChannel、RPC）覆盖四种参考系统（LinuxCNC、OpenPLC、ROS2、dora-rs）的全部通信模式。

```
                     AUDESYS HAL Protocol
  ┌──────────────────────────────────────────────────┐
  │  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
  │  │  Signal  │  │StreamChannel │  │    RPC    │  │
  │  │ 单写多读  │  │  多写多读     │  │ 请求/回复  │  │
  │  │ 最新值覆盖│  │  缓冲 + 反压  │  │ 超时+幂等  │  │
  │  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  │
  │       └───────────────┬────────────────┘         │
  │                       │                          │
  │    ┌──────────────────┴──────────────────┐       │
  │    │  amw (AUDESYS Middleware)           │       │
  │    │  HalTransport │ HalDiscovery │ HalQoS│       │
  │    └──────────────────┬──────────────────┘       │
  │                       │                          │
  │  ┌──────┬─────────────┼──────────────┬────────┐  │
  │  │InProc│ amw_zenoh   │  amw_dds     │ amw_*  │  │
  │  │Phase1│ Phase2+     │  (未来)       │ (未来)  │  │
  │  └──────┴─────────────┴──────────────┴────────┘  │
  └──────────────────────────────────────────────────┘
```

协议核心不做 I/O（Sans-I/O），三种原语通过 FlatBuffers 序列化，amw 抽象层负责传输/发现/QoS 实现。数据面走 Typed API 或 FlatBuffers，控制面走 JSON-RPC 2.0。

---

### 2. 通信原语

| 原语 | 语义 | 延迟/吞吐 | 典型场景 |
|------|------|-----------|---------|
| **Signal** | 单写多读，无缓冲（最新值覆盖）。三种消费模式：push（回调）、pull（自定频率）、pull_batch（批量快照） | InProc < 1μs, UDS ~10μs | 轴位置、温度、数字 I/O、限位开关 |
|| **StreamChannel** | 多写多读，有缓冲队列，三种队列策略：DropOldest / Backpressure / DropNewest。预留 redundancy 字段（none/dual_link/n_plus_1），Phase 1 = none。≥4KB 负载走零拷贝 SHM | 100+ MB/s (Zenoh SHM) | 点云 LiDAR、图像流、高速 ADC 采样、日志 |
| **RPC** | 请求/回复模式，超时可配置（默认 5s），可选幂等标记（配置操作可安全重试） | 低频（控制面） | 加载/配置组件、动态创建 Signal、ROS2 service 等效、LinuxCNC halcmd 等效 |

Signal 与 StreamChannel **不可合并**——这是 ROS2 社区十年验证的教训：控制信号需要零缓冲低延迟，数据流需要缓冲高吞吐。

> 详见 `docs/modules/hal/hal-protocol-design.md`
---

### 3. amw 中间件抽象层

参考 ROS2 `rmw`（ROS Middleware）设计模式，`amw`（AUDESYS Middleware）将 HAL 三种通信原语与具体传输实现解耦——换实现不换 API。由三个平级 trait 组成：

| Trait | 职责 | 执行位置 |
|-------|------|---------|
| **HalTransport** | 数据面 — Signal publish/subscribe，StreamChannel create/open，RPC expose/call | RT 线程 / Stream Worker |
| **HalDiscovery** | 控制面 — 所有通信端点的 register/unregister/lookup/watch | Supervisor / Zenoh key-value store |
| **HalQoS** | 服务面 — deadline / liveliness / security_domain 三个维度 | 按维度分发（见 §4） |

**实现演进**：Phase 1 用 `amw_inproc`（Typed API，无序列化，同进程），Phase 2 起接入 `amw_zenoh`（Zenoh 原生发现 + QoS），未来可切换到 `amw_dds` 或 `amw_mqtt`，API 不变，Phase 1→4 零迁移。

> 详见 `docs/modules/hal/amw-middleware-design.md`
---

### 4. 工业 QoS

AUDESYS 只定义三个最小维度（不引入完整 DDS QoS），各维度在不同执行位置实现：

| 维度 | 执行位置 | amw_inproc 实现 | amw_zenoh 实现 | 说明 |
|------|---------|----------------|---------------|------|
| **Deadline** | RT 数据面 | RT tick 计时器，同周期同步触发回调 | Zenoh 内置 timer + callback | 信号最大更新间隔监控。编码器断连时同 RT 周期响应，不经过 Supervisor |
| **Liveliness** | 控制面 | 无（同进程共享生命周期） | `liveliness::declare_token` | 组件心跳监控，100ms 级足够 |
| **Security Domain** | 配置面 | 无（同进程天然隔离） | keyexpr 前缀 `{domain}/` | 纯元数据标记，零运行时开销，静态隔离 |

> 详见 `docs/modules/hal/industrial-qos-design.md`
---

### 5. 线程调度

四类线程混合调度，每类解决不同的执行需求（不能放进同一个调度模型）：

| 线程类型 | 调度策略 | 核心模式 | 参考来源 |
|---------|---------|---------|---------|
| **RT 线程** | SCHED_FIFO + CPU pin + mlockall | 每周期：`read_barrier` → 有序函数列表（LinuxCNC 式）→ `write_barrier` → `sleep_until` | LinuxCNC 显式函数列表 + ROS2 control read→update→write 管线 + OpenPLC 扫描屏障 |
| **I/O 线程** | tokio async 事件驱动 | 驱动 Modbus/CAN/EtherCAT 等，写入共享 I/O 映像表 | dora-rs 数据驱动风格 |
| **Stream Worker Pool** | 线程池 + QueuePolicy 反压 | 高吞吐数据流（点云/图像/高速采样），事件驱动，无固定周期 | dora-rs 风格 |
| **Supervisor 线程** | Node.js | 进程生命周期管理、配置热加载、HAL 快照订阅（100ms 间隔） | — |

RT 线程的主循环：`read_barrier`（冻结所有输入 Signal + 锁定 I/O 映像表）→ 按序执行函数列表 → `write_barrier`（原子发布所有输出 Signal + 释放 I/O 锁）→ 等待下一周期。过运行时跳过迟到周期并触发 ALARM Signal。

> 详见 `docs/modules/hal/thread-scheduling-design.md`
---

### 6. Config Barrier 与 LockLevel

所有配置变更排队到 RT 周期边界，在 `read_barrier` 之前批量应用——物理上不可能 mid-cycle 注入，不依赖开发者自觉。

| 级别 | 含义 | RPC 行为 |
|------|------|---------|
| `Config` | 允许所有配置变更 | RPC 可入队，下一个周期边界应用 |
| `Run` | 组件正在执行 | **拒绝所有 RPC 配置请求** |
| `Lock` | 开发者手动锁定 | 拒绝 RPC + Supervisor 命令 |

Config Barrier 与扫描屏障是两个独立但协同的机制：Config Barrier 保护 funct_list/signals/threads（周期边界应用），扫描屏障保护 I/O image table/Signal values（周期内 read→write 一致性）。

> 详见 `docs/modules/hal/config-barrier-design.md`
---

### 7. 移植对接

移植外部系统功能时，被移植代码改造后以 AUDESYS HAL 为原生通信层，不桥接外部协议：

| 参考系统 | 原始概念 | HAL 原语映射 | 消息大小 |
|---------|---------|------------|---------|
| **LinuxCNC** | hal_pin (bit/float/s32/u32) | **Signal** | 1–64 bits |
| **LinuxCNC** | hal_stream | **StreamChannel** | 1KB–10KB |
| **OpenPLC** | 扫描周期 I/O 映像表（1024 点） | **Signal<Array\<S32\>>**（2 条消息/周期，非 8192 条） | 4KB |
| **OpenPLC** | 单点 HMI 监控 | **Signal\<Bool\>**（从 image table 提取，按需） | 1 bit |
| **ROS2** | 控制类 topic（低速/值更新，如 /cmd_vel） | **Signal** | 48 bytes |
| **ROS2** | 感知类 topic（高频/批量，如 /scan, /joint_states） | **StreamChannel** | 4–100KB |
| **ROS2** | service（如 /get_map, ~10s/次） | **RPC** | MB 级 |
| **dora-rs** | Arrow IPC buffer (~2MB/frame, 30Hz) | **StreamChannel\<Blob\>**（零拷贝，HAL 不解析 Arrow） | 2MB |
| **dora-rs** | 结构化输出（Array\<F32\>, ~1KB/frame） | **StreamChannel\<Array\<F32\>\>** | 1KB |

> 详见 `docs/modules/hal/porting-strategy-design.md`
---

### 8. 多语言策略

> 详见 `docs/modules/hal/multi-language-strategy.md`（多语言策略完整版）。以下为快速参考摘要：

HAL 按延迟需求分三层，FlatBuffers 作为跨语言序列化统一格式：

| 层 | 用途 | 语言 | 通信方式 | 延迟 | Phase |
|----|------|------|---------|------|-------|
| **L1** | RT 数据面 | **Rust（独占）** | Typed API（InProcess，无序列化） | < 1μs | Phase 1 |
| **L2** | I/O 通信 | Rust, C++ | FlatBuffers over UDS | ~10μs | Phase 2 |
| **L3** | 控制面 / HMI | Python, Node.js, Go, C#, Java 等 15 种语言 | FlatBuffers over Zenoh | ~100μs | Phase 3+ |

**L1 为什么 Rust 独占**：SCHED_FIFO 线程需要无 GC、无 JIT、无异步运行时，只有 Rust 同时满足零开销抽象 + 内存安全 + 无运行时。C++ FFI 桥接仅限 L2（非 RT 线程），用于现有 C++ 驱动库（如 EtherCAT master）对接。

已否决方案：WASM/WASI（JIT 非确定性）、gRPC/Protobuf（50–200μs RTT）、Cap'n Proto（跨语言零拷贝不可行）、嵌入脚本 Lua/Rhai/Python（GIL 阻塞 RT）。

---

### 9. 实施路线

HAL 分 8 个 Phase 实施。详见 `docs/modules/hal/implementation-roadmap.md`。「9. 实施路线」小节中不重复维护。

---

### 10. 设计决策速查

| # | 决策 | 理由 |
|---|------|------|
| D1 | Signal / StreamChannel 不合并 | 控制信号（零缓冲低延迟）与数据流（有缓冲高吞吐）不可调和，ROS2 十年教训 |
| D2 | RPC 不拆成一对 Signal | 拆开会丢失超时、幂等、请求/响应关联 |
| D3 | amw 三相 trait（Transport + Discovery + QoS） | 关注面分离，各维度换实现不换 API |
| D4 | Deadline 在 RT 数据面，Liveliness 在控制面 | 编码器断连需同周期触发；心跳丢失 100ms 级足够 |
| D5 | 14 种类型（11 标量 + String + Blob + Array\<T\>） | 覆盖 IEC 61131-3 全部类型；WSTRING 不引入（UTF-8 only）；Blob 不进类型推导 |
| D6 | 四类线程混合调度，不合并 | 硬实时 / I/O / 数据流 / 配置四类需求不可通约 |
| D7 | Config Barrier + LockLevel 替代信任式安全 | Supervisor 随时可发 RPC，不能依赖 LinuxCNC 式的开发者自觉 |
| D8 | .agents/rules/ 通用规则仅扫描确认 | 89 个文件已验证，零 MODACS 残留 |
| D19 | L1 RT 数据面 Rust 独占 | SCHED_FIFO 需无 GC/无 JIT/无异步，仅 Rust 满足 |

---

> **其他 HAL 详细设计子文档**：
> - 类型系统：`docs/modules/hal/iec-type-system-design.md`
> - 扫描屏障：`docs/modules/hal/scan-barrier-design.md`
> - 错误模型：`docs/modules/hal/error-model-design.md`
> - I/O 映射：`docs/modules/hal/io-mapping-design.md`
> - ROS2 Actions：`docs/modules/hal/ros2-actions-design.md`
> - RT 内存与调度：`docs/modules/hal/rt-memory-and-scheduling.md`
> - 功能安全：`docs/modules/hal/functional-safety-design.md`
> - 延迟验证：`docs/modules/hal/latency-validation.md`
> - 协议规范 YAML：`docs/modules/hal/protocol-spec-yaml.md`
> - 对比分析：`docs/modules/hal/hal-comparison-analysis.md`

## 二、Runtime 套件

> ✅ **状态**: MVP 完成 — 5 步周期引擎 + Config Barrier + Hot-swap + 信号注册表

### 目录

1. [Runtime 套件概览](#1-runtime-套件概览)
2. [多进程拓扑](#2-多进程拓扑)
3. [进程职责矩阵](#3-进程职责矩阵)
4. [Supervisor 模块](#4-supervisor-模块)
5. [Controller 模块](#5-controller-模块)
6. [Panel 模块](#6-panel-模块)
7. [Gateway 模块](#7-gateway-模块)
8. [Remote 模块](#8-remote-模块)
9. [Edge 模块](#9-edge-模块)
10. [AUDESYS Link 通信中间件](#10-audesys-link-通信中间件)
11. [IPC 通信分层](#11-ipc-通信分层)
12. [多实例隔离](#12-多实例隔离)
13. [崩溃恢复与安全状态](#13-崩溃恢复与安全状态)
14. [模块分类矩阵](#14-模块分类矩阵)
15. [部署模式](#15-部署模式)

---

| 阶段 | 范围 | 说明 |
|------|------|------|
| **R1** | Controller RT 骨架 | 核心循环、SCHED_FIFO 线程、Signal 发布 |
| **R2** | Runtime I/O 线程 | StreamChannel 消费端，amw_inproc 对接 |
| **R3** | Supervisor 进程管理 | 生命周期管理、崩溃恢复、配置分发 |
| **R4** | Gateway 协议适配 | 外部通信适配层 |
| **R5** | Panel WebView | Tauri 桌面 HMI 骨架 |
| **R6** | Remote WebRTC | 远程访问 WebRTC 通道 |

> **详细设计文档**：
> - IPC 安全：`docs/modules/runtime/ipc-security-design.md`
> - 可观测性：`docs/modules/runtime/observability-design.md`
> - 硬件需求：`docs/modules/runtime/hardware-requirements.md`
> - 升级策略：`docs/modules/runtime/upgrade-strategy.md`

### 1. Runtime 套件概览

AUDESYS Runtime 套件是面向工业控制场景的完整运行时产品形态。Runtime 套件是一个**多进程实时控制系统**，由六个核心模块组成：

| 模块 | 产品名 | 职责 | 技术栈 |
|------|--------|------|--------|
| **Supervisor** | AUDESYS Supervisor | 进程/参数/配置/更新管理器 | Node.js (`child_process.fork`) + UDS JSON-RPC |
| **Controller** | AUDESYS Controller | 实时控制（PLC/CNC/运动控制） | Rust + HAL Core + amw_inproc（子毫秒确定性控制） |
| **Panel** | AUDESYS Panel | 触摸屏 HMI（人机交互） | Tauri + React 19 + shadcn/ui |
| **Gateway** | AUDESYS Gateway | 外部通信（MES/ERP/云对接） | Node.js + Link SDK |
| **Remote** | AUDESYS Remote | 远程访问（WebRTC 浏览器 B/S） | 屏幕采集 + GPU 编码 + WebRTC |
| **Edge** | AUDESYS Edge | 边缘采集（7×24 独立运行） | 独立进程 + 轻量 Web 配置 |

```
┌──────────────────────────────────────────────────────────────┐
│                     Runtime 套件全景                          │
│                                                              │
│    用户层    │  Panel(本地HMI)  Remote(远程Web)  Edge(采集)   │
│    ─────────┼──────────────────────────────────────────────  │
│    控制层    │  Controller (实时控制, RT)                     │
│    ─────────┼──────────────────────────────────────────────  │
│    管理层    │  Supervisor (进程生命周期/配置/更新)           │
│    ─────────┼──────────────────────────────────────────────  │
│    通信层    │  Gateway (MES/ERP/云)                         │
│    ─────────┼──────────────────────────────────────────────  │
│    中间件    │  AUDESYS Link (进程间共享内存/主机间通信)       │
│    ─────────┼──────────────────────────────────────────────  │
│    硬件层    │  Servo | Stepper | CAN | GPIO | Modbus | RS485│
└──────────────────────────────────────────────────────────────┘
```

> **命名变更说明**: 旧名 Act -> 新名 **Controller**；旧名 HMI -> 新名 **Panel**。新增 Gateway/Remote/Edge/Supervisor 四个模块。

---

### 2. 多进程拓扑

```
┌─────────────────────────────────────────────────────────────────┐
│                    Single Host (Linux + PREEMPT_RT)              │
│                                                                 │
│  ┌──────────────────────┐                                       │
│  │  Supervisor          │  进程/参数/配置/更新管理器              │
│  │                      │                                       │
│  │  - 进程生命周期       │  启动/停止/重启/崩溃恢复               │
│  │  - 配置管理          │  配置分发/热重载/版本回滚               │
│  │  - 参数管理          │  运行参数下发/收集                     │
│  │  - 组件更新          │  接收更新->编排->执行->验证->回滚           │
│  │  - 健康检查          │  心跳监测/资源监控                     │
│  └──┬───────┬──────┬────┘                                      │
│     │       │      │                                           │
│     ▼       ▼      ▼                                           │
│ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐                     │
│ │Ctrl  ││Panel ││Gate  ││Remote││Edge  │                      │
│ │      ││      ││way   ││      ││      │                      │
│ │CPU:1 ││CPU:2 ││CPU:3 ││CPU:3 ││CPU:3 │                      │
│ │RT:99 ││      ││      ││      ││      │                      │
│ └──────┘└──────┘└──────┘└──────┘└──────┘                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              硬件层 (通过 Controller 独占访问)              │  │
│  │  Servo | Stepper | RS232/485 | CAN | GPIO | Modbus TCP  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 对外网络 (通过 Gateway)                     │  │
│  │  MES/ERP | O&M运维系统 | Studio开发后台 | 云端              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**设计原则**:

- **进程隔离**: 每个模块是独立进程，一个模块崩溃不影响其他模块
- **CPU 绑定**: Controller 绑定到隔离核心（`isolcpus`），保证实时性
- **职责分离**: Supervisor 管进程，Controller 管硬件，Gateway 管通信，各司其职
- **硬件独占**: 只有 Controller 直接访问硬件，其他模块通过 Controller 间接操作

---

### 3. 进程职责矩阵

| 进程 | 优先级 | CPU 绑定 | RT 要求 | 崩溃影响 | 重启策略 |
|------|--------|---------|--------|---------|---------|
| **Supervisor** | SCHED_RR 50 | core 0 | 无 | 完全失效 -> systemd 兜底 | systemd watchdog |
| **Controller** | SCHED_FIFO 99 | core 0-1 (isolated) | 硬实时 | 设备失控 -> 紧急停止 | Immediate + 安全状态 |
| **Panel** | SCHED_OTHER | core 2-3 | 软实时 | 界面不可用 -> 不丢数据 | 快速重启 (5s) |
| **Gateway** | SCHED_OTHER | core 3 | 无 | 外部通信断开 -> 缓存重连 | 自动重连 + 重启 |
| **Remote** | SCHED_OTHER | core 3 | 无 | 远程不可用 -> 本地不受影响 | 自动重启 |
| **Edge** | SCHED_OTHER | core 3 | 无 | 采集中断 -> 本地缓存 | 自动重启 |

**关键设计**:

- **Controller 是唯一硬实时进程**，使用 `SCHED_FIFO 99` 最高优先级 + `mlockall` 锁定内存
- **Supervisor 用 systemd 兜底**，自身崩溃时 systemd watchdog 重启整个套件
- **Panel 崩溃不丢数据**，Controller 继续运行，操作员可在 Panel 重启后恢复交互
- **Gateway 断网缓存**，网络恢复后自动补传缓存数据

---

### 4. Supervisor 模块

| 属性 | 值 |
|------|-----|
| **产品名** | AUDESYS Supervisor |
| **职责** | Runtime 套件的进程/参数/配置/更新管理器 |
| **管理对象** | Controller / Panel / Gateway / Remote / Edge 子进程 |
| **技术** | Node.js (`child_process.fork`) + UDS JSON-RPC |
| **兜底** | systemd watchdog（Supervisor 自身崩溃时） |

> AUDESYS 尚未开始实现。Supervisor 是全新模块，将管理完整 Runtime 套件。

#### 4.1 进程生命周期管理

```
启动序列:
  1. 解析配置 (instance.yaml)
  2. 检查系统资源 (CPU isolation, RT kernel, 内存)
  3. 按依赖顺序启动子进程:
     ├── Controller (等待 ready 信号)
     ├── Gateway (等待 Controller ready)
     ├── Panel (等待 Controller ready)
     ├── Remote (等待 Panel ready)
     └── Edge (独立启动)
  4. 注册 systemd watchdog
  5. 进入监控循环

停止序列:
  1. 通知所有进程准备停止
  2. Controller: 完成当前周期 -> 安全状态 -> 释放硬件
  3. Gateway: 发送离线通知 -> 断开外部连接
  4. Panel/Remote/Edge: 保存状态 -> 退出
  5. 等待所有子进程退出 (timeout: 10s) -> 超时 SIGKILL
  6. 清理 IPC 资源 -> 退出
```

#### 4.2 配置与参数管理

| 功能 | 说明 |
|------|------|
| 配置分发 | 将模板配置推送到各子进程 |
| 参数管理 | 运行时参数下发/收集 |
| 配置热重载 | 不重启进程，推送新配置 |
| 版本化配置 | 支持回滚到上一版本 |

#### 4.3 组件更新管理

```
更新流程 (Supervisor 与 Gateway 协作):

  Gateway:                    Supervisor:
    1. 接收更新通知              |
    2. 下载更新包                |
    3. 验证签名                  |
    4. 传递给 Supervisor ──────-> 5. 评估当前状态 (运行中? 不能更新 Controller)
                                6. 编排更新序列:
                                   ├── stop 旧模块
                                   ├── 替换文件 (原子操作)
                                   ├── start 新模块
                                   ├── 健康检查 + 就绪信号
                                   └── 失败 -> 自动回滚到旧版本
                                7. 更新完成通知 -> Gateway 上报状态
```

**更新粒度**:

| 粒度 | 说明 |
|------|------|
| 模块更新 | 替换单个模块（如 Controller v1.2 -> v1.3） |
| 配置热更新 | 不重启进程，推送新配置 |
| Runtime 整体 | 全套件版本升级（所有模块一起更新） |
| 回滚 | 任何更新失败 -> 自动回滚到上一版本 |

> **设计依据**: 更新本质是进程生命周期的特殊操作（stop -> replace -> start），与崩溃恢复（stop -> restart）是同一类操作的自然扩展。systemd 先例：`systemctl restart` 和包更新后服务重启都由 systemd 编排，但包下载/安装由 apt/dnf 完成（对应 Gateway 下载，Supervisor 执行）。

---

### 5. Controller 模块

| 属性 | 值 |
|------|-----|
| **产品名** | AUDESYS Controller |
| **职责** | 实时控制（PLC/CNC/运动控制） |
| **技术** | Rust + HAL Core + amw_inproc（子毫秒确定性控制），Podman 隔离可选 |
| **通信** | 通过 AUDESYS Link 库与设备通信；UDS JSON-RPC 与 Supervisor |

#### 5.1 核心循环

参考 LinuxCNC HAL（Hardware Abstraction Layer）模型：

```
Base Thread (500µs):   Read Inputs -> Control Logic (PID/Trajectory) -> Write Outputs
Servo Thread (1-4ms):  iceoryx2/Link Publish (状态) + Subscribe (命令)
Safety Thread:         看门狗心跳 / 紧急停止检测 / 安全状态机
```

#### 5.2 硬件抽象层

Controller 的硬件抽象由 [HAL 系统](#一hal-系统) 统一管理，详见 §一。

**设备驱动层**: Servo (EtherCAT/CANopen/Modbus) / Stepper (Pulse/DIR) / CAN / Serial (RS232/485) / GPIO / ADC / Safety IO

#### 5.3 关键实时技术

| 技术 | 用途 |
|------|------|
| `isolcpus` | CPU 核心隔离，防止其他进程抢占 |
| `SCHED_FIFO` | 实时调度策略，最高优先级 |
| `mlockall` | 锁定内存，禁止 swap |
| `PREEMPT_RT` | Linux 内核完全可抢占 |
| `timerfd` | 高精度周期定时器（纳秒精度） |

> **技术栈说明**: Controller 使用 Rust 而非 TypeScript，因为硬实时控制需要子毫秒确定性。

---

### 6. Panel 模块

| 属性 | 值 |
|------|-----|
| **产品名** | AUDESYS Panel |
| **职责** | 触摸屏 HMI（人机交互） |
| **技术** | Tauri + React 19 + shadcn/ui + Tailwind v4 |
| **渲染目标** | 本地显示器（DRM/KMS）或虚拟 framebuffer（无头模式） |

**独立进程的原因**:

1. **故障隔离**: Panel 崩溃不影响 Controller
2. **资源隔离**: UI 内存泄漏不影响实时控制
3. **独立生命周期**: 可重启而不中断控制

> AUDESYS 尚未开始实现。Panel 将使用 Tauri 桌面框架实现原生触摸屏体验，React + shadcn/ui 技术栈将被完全继承。

---

### 7. Gateway 模块

| 属性 | 值 |
|------|-----|
| **产品名** | AUDESYS Gateway |
| **职责** | 外部通信应用（使用 Link 库） |
| **技术** | Node.js，`import { Link } from '@audesys/link'` |
| **与 Link 的关系** | Link 是基础设施库，Gateway 是使用 Link 的运行端应用 |

**功能清单**:

- MES/ERP 对接
- 运维系统通信
- Studio 远程调试桥接
- OTA 推送接收
- 断网缓存 + 重连补传

**协议适配阶段**（per D23）:

| 阶段 | 协议 | 范围 |
|------|------|------|
| Phase 1 | Modbus RTU/TCP + HART 有限集 | 覆盖 60%+ 设备，libmodbus FFI |
| Phase 2 | OPC UA Gateway | open62541 网关，不进 RT 路径 |
| Phase 3 | EtherCAT | 需 PREEMPT_RT + 专用网卡 |

> **与 Remote 的区分**: Gateway 传输"数据"（结构化 JSON/二进制），Remote 传输"媒体"（视频流 + 输入事件）。

---

### 8. Remote 模块

| 属性 | 值 |
|------|-----|
| **产品名** | AUDESYS Remote |
| **职责** | 远程访问（浏览器 B/S 架构） |
| **功能** | 远程监控、远程操作、远程调试 |

#### 8.1 核心功能设计

```
屏幕采集:  DRM/KMS DMA-BUF (Linux) / DXGI (Windows) / ScreenCaptureKit (macOS)
GPU 编码:  VAAPI (Intel/AMD) / NVENC (NVIDIA) - H.264/H.265, 零拷贝
视频传输:  WebRTC (<100ms, 浏览器原生支持)
输入注入:  uinput (Linux内核级虚拟输入) / SendInput (Win) / CGEvent (mac)
会话管理:  多客户端, Viewer/Operator/Engineer/Admin 权限, 控制权互斥
画质自适应: 根据网络带宽动态调整码率/分辨率
```

#### 8.2 数据流

```
视频下行: Panel Framebuffer -> DMA-BUF -> VAAPI Encode -> WebRTC -> 浏览器
输入上行: 浏览器 -> WebRTC DataChannel -> uinput -> Panel 显示服务器
总延迟: ~30-70ms
```

---

### 9. Edge 模块

| 属性 | 值 |
|------|-----|
| **产品名** | AUDESYS Edge |
| **职责** | 边缘采集（7×24 独立运行） |
| **技术** | 独立进程，带轻量 Web 配置界面 |
| **功能** | 数据采集、设备协议适配（通过 Link）、本地缓存、断网续传 |

Edge 模块设计为完全独立运行，即使 Supervisor 和 Controller 都停止，Edge 仍可继续采集数据并在本地缓存，待系统恢复后补传。

---

### 10. AUDESYS Link 通信中间件

> **已决策**: Link 中间件基于 amw（AUDESYS Middleware）抽象架构。Phase 1 用 amw_inproc（同进程 Typed API），Phase 2+ 用 amw_zenoh（Zenoh PubSub），编码层定为 FlatBuffers。详见 `docs/modules/hal/amw-middleware-design.md`。

#### 10.1 定位

```
AUDESYS Link ≠ 运行端应用
AUDESYS Link = 通信中间件库 / SDK (packages/link/)
```

Link 是基础设施库，不是独立运行的进程。Runtime 套件中的 Gateway、Controller、Edge 通过 `import { Link } from '@audesys/link'` 使用其通信能力。

#### 10.2 架构分层

```
packages/link/
  ├── 编解码层: FlatBuffers（已决策，D19/D24）
  ├── PubSub 层: amw_inproc (Phase 1) → amw_zenoh (Phase 2+)
  ├── Request/Reply: gRPC / Tower
  ├── P2P: Tokio channels
  ├── 协议适配: Serial / Modbus / MQTT / OPC-UA / S7 / BACnet / CAN
  └── Extensions: Recording / OpenTelemetry
```

#### 10.3 使用者

```
apps/runtime/gateway/    - import { Link } from '@audesys/link' (与 MES/云通信)
apps/runtime/controller/ - 通过 Link 的 Serial/Modbus adapter 与设备通信
apps/runtime/edge/       - 通过 Link 采集数据
```

---

### 11. IPC 通信分层

Runtime 套件的通信分为四个层次，每层使用不同技术：

```
Layer 1: 硬实时数据 (Controller 内部)
  └── HAL pins (裸共享内存 mmap) - 周期数据 < 100ns

Layer 2: 进程间通信 (Runtime 模块之间)
  └── UDS JSON-RPC (~20µs) - Supervisor ↔ Controller/Panel/Gateway/Remote/Edge

Layer 3: 对外通信 (Gateway)
  └── AUDESYS Link (Zenoh) - 与 MES/运维/Studio

Layer 4: 远程媒体 (Remote)
  └── WebRTC - 视频流 + 输入事件
```

#### UDS JSON-RPC（AUDESYS 标准进程间通信）

| 属性 | 值 |
|------|-----|
| 传输 | Unix Domain Socket |
| 协议 | JSON-RPC 2.0 |
| 延迟 | ~20µs 控制面 JSON-RPC（本机）/ ~10µs 数据面 FlatBuffers（PREEMPT_RT） |
| 特性 | `container.resolve<T>()` 返回透明 Proxy，无需额外 broker |
| 录制 | RPC Hub 旁路录制所有调用（MCAP 格式） |
| 调试 | Foxglove Bridge（WebSocket, `AUDESYS_DEBUG=1`） |

---

### 12. 多实例隔离

单主机运行多个控制实例（如多台 3D 打印机、多条产线）：

```
Host: factory-floor-01
  ├── Instance: printer-01 (光固化打印机 #1)
  │   ├── Supervisor  (CPU 0)
  │   ├── Controller  (CPU 1, UDS domain: printer-01)
  │   ├── Panel       (CPU 5, 端口 3000)
  │   ├── Gateway     (CPU 7)
  │   ├── Remote      (端口 9443)
  │   └── Edge        (CPU 8)
  │
  └── Instance: printer-02 (光固化打印机 #2)
      ├── Supervisor  (CPU 0)
      ├── Controller  (CPU 2, UDS domain: printer-02)
      ├── Panel       (CPU 6, 端口 4001)
      ├── Gateway     (CPU 9)
      ├── Remote      (端口 9444)
      └── Edge        (CPU 10)
```

#### 隔离维度

| 维度 | 机制 |
|------|------|
| CPU | `taskset` + `isolcpus` |
| IPC | UDS socket path prefix |
| MQTT | Topic prefix |
| 网络端口 | 端口范围分配 |
| 文件系统 | 独立工作目录 |
| 进程名 | 命名空间前缀 |
| cgroup | 独立 cgroup |

---

### 13. 崩溃恢复与安全状态

```
崩溃恢复策略:
  ├── Controller 崩溃 -> 立即触发急停 -> 等待安全状态 -> 重启 -> 需操作员确认
  ├── Panel 崩溃 -> 自动重启 (3次) -> 3次失败告警 -> Controller 继续运行
  ├── Gateway 崩溃 -> 自动重启 -> 断网期间缓存数据 -> 重连后补传
  ├── Remote 崩溃 -> 自动重启 -> 本地不受影响
  └── Edge 崩溃 -> 自动重启 -> 本地缓存续传
```

**安全状态机**:

- Controller 崩溃时，硬件必须进入安全状态（急停）
- 硬件层面的安全继电器独立于软件，确保软件故障不会导致物理危险
- Controller 重启后需要操作员确认才能恢复控制

---

### 14. 模块分类矩阵

| 模块 | 进程类型 | 有 GUI | 有 Web | 实时 | 独立部署 |
|------|---------|:------:|:------:|:----:|:-------:|
| Supervisor | 宿主进程 | ❌ | ❌ | ❌ | ❌（套件核心） |
| Controller | 子进程（Rust） | ❌ | ❌ | ✅ | ✅ |
| Panel | 子进程（Tauri） | ✅ | ❌ | ❌ | ✅ |
| Gateway | 子进程（Node.js） | ❌ | ❌ | ❌ | ✅ |
| Remote | 子进程 | ❌ | ✅ | ❌ | ✅ |
| Edge | 子进程 | ❌ | ✅（轻量） | ❌ | ✅ |

---

### 15. 部署模式

#### 三种部署形态

| 模式 | 形态 | 适用场景 | 技术方案 |
|------|------|---------|---------|
| **桌面应用** | Runtime 安装包 | 单机使用、直接连设备、离线运行 | Tauri bundler + 本地 SQLite |
| **边缘服务** | Docker on Edge | 车间级部署、多设备集中管理 | Docker + Link + 时序数据库 |
| **云服务** | K8s + Web | 多租户、远程监控、SaaS | K8s + PostgreSQL + InfluxDB |

#### 桌面 ↔ Web 的无缝切换

```
桌面模式:
  Supervisor (Node.js) 管理:
    ├── Controller (Rust, 实时控制)
    ├── Panel (Tauri, 本地触摸)
    ├── Gateway (Node.js, 外部通信)
    ├── Remote (浏览器访问)
    └── Edge (Node.js, 采集)

Web 模式:
  Platform Core (Node.js + Hono):
    ├── Web Client: Studio Editor (浏览器)
    ├── Web Client: Panel UI (浏览器)
    └── API Client: 第三方集成
```

**代码复用**: Panel React 组件 100% 复用，差异仅在窗口管理（Tauri vs 浏览器 Tab）。

---

## 三、Studio 套件

> ✅ **状态**: MVP 完成 — Tauri + CodeMirror 6 + 33 Tauri 命令 + 8 面板 + 6 种源码语言

### 1. 产品定位

**AUDESYS Studio** 是统一编辑器/IDE，受 UE（项目类型驱动）、VS Code（插件扩展）、TIA Portal（工业组态）启发。它通过可视化编辑器配置设备模板、流程逻辑和 HMI 界面，一键打包为桌面应用或部署为 Web 服务。

#### 创建端 vs 运行端

```
AUDESYS
├── 创建端: AUDESYS Studio (统一编辑器/IDE)
│   ├── 内置: Scene Designer, Flow Designer, Data Designer, Debug
│   └── 插件: Logic Designer (v2+), App Builder (v2+)
│
└── 运行端: AUDESYS Runtime (PC 应用套件)
    ├── Supervisor   - 进程/参数/配置/更新管理器
    ├── Controller   - 实时控制
    ├── Panel        - 触摸 HMI
    ├── Gateway      - 外部通信应用
    ├── Remote       - 远程访问
    └── Edge         - 边缘采集
```

---

### 2. 现状评估

#### 已设计（文档层面）

| 组件 | 内容概要 | 状态 |
|------|---------|:----:|
| **Studio 产品定位** | 统一编辑器/IDE，插件可扩展 | 📄 |
| **内置编辑器** | Scene/Flow/Data Designer + Debug | 📄 |
| **插件编辑器** | Logic Designer (IEC 61131-3), App Builder | 📄 远景 |
| **项目类型驱动** | 项目类型决定加载哪些编辑器 | 📄 |
| **ACL 策略模板** | `all`/`own`/`readonly`/`department` + 运行时过滤 | 📄 |
| **RBAC 表结构** | roles/permissions/user_roles 表 | 📄 |

#### 关键发现

```
设计完成度:  ████████████████████████░░  ~90% (文档)
代码实现度:  ████████████████░░░░░░░░░░  ~70%
Studio 代码:  ████████████████░░░░░░░░░░  ~70% (Tauri + React)
RBAC 代码:   ██████████████░░░░░░░░░░░░  ~60% (HMAC + 5 角色)
```

---

### 3. Studio 在 AUDESYS 中的位置

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUDESYS Studio                                 │
│                    (多用户开发平台 / 插件)                            │
│                                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐    │
│  │ Scene   │ │ Flow    │ │ Data    │ │ Logic   │ │ App      │    │
│  │Designer │ │Designer │ │Designer │ │Designer │ │ Builder  │    │
│  │ (HMI/   │ │(DAG流程)│ │(数据模型│ │(PLC代码)│ │(无代码)  │    │
│  │ Panel)  │ │         │ │)        │ │         │ │          │    │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘    │
│       └───────────┴───────────┴───────────┴───────────┘           │
│                          │                                          │
│                   ┌──────┴───────┐                                 │
│                   │ Studio Core  │                                 │
│                   │ (项目管理、  │                                 │
│                   │  插件注册、  │                                 │
│                   │  权限网关)   │                                 │
│                   └──────┬───────┘                                 │
│                          │                                          │
│  ┌───────────────────────┼───────────────────────┐                 │
│  │           身份与权限层                         │                 │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐  │                 │
│  │  │ Casdoor  │  │ RBAC引擎 │  │ 项目隔离层 │  │                 │
│  │  │(OIDC/    │  │(Action + │  │(Project +  │  │                 │
│  │  │ LDAP/SSO)│  │ Scope)   │  │ Namespace) │  │                 │
│  │  └──────────┘  └──────────┘  └────────────┘  │                 │
│  └───────────────────────────────────────────────┘                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  AUDESYS平台        │
                    │  (base 进程)         │
                    │  Hono HTTP :3000     │
                    │  RPC Hub UDS         │
                    │  Process Manager     │
                    │  Topic Bus           │
                    │  MCAP Recorder       │
                    │  PostgreSQL 16       │
                    └─────────────────────┘
```

---

### 4. 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Layer 1: 接入层                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Web 浏览器│  │ 桌面应用 │  │ 嵌入模式 │                 │
│  │ (Tauri) │  │(Panel内嵌)│                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       └─────────────┴─────────────┘                         │
│                     │                                        │
│              OIDC Redirect + JWT                            │
├─────────────────────────────────────────────────────────────┤
│                     Layer 2: 平台层                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Casdoor  │  │ RBAC引擎 │  │ 项目管理 │  │ 插件注册 │   │
│  │ IdP      │-> │ Action+  │-> │ Project  │-> │ Editor   │   │
│  │          │  │ Scope    │  │ CRUD     │  │ Registry │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                     │                                        │
│              Hono HTTP + WebSocket                           │
├─────────────────────────────────────────────────────────────┤
│                     Layer 3: 编辑器层                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Scene    │  │ Flow     │  │ Data     │  │ Logic    │   │
│  │ Designer │  │ Designer │  │ Designer │  │ Designer │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  (每个编辑器是独立插件，通过 Studio Core API 访问平台)       │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. 内置编辑器

| 编辑器 | 类型 | 用途 | 技术 | 状态 |
|--------|------|------|------|:----:|
| **Scene Designer** | scene | 画面组态（HMI/Panel 界面设计） | @xyflow/react | 📄 设计 |
| **Flow Designer** | flow | DAG 流程编辑（工作流/数据流） | @xyflow/react | 📄 设计 |
| **Data Designer** | data | 数据模型设计（表结构/字段） | Drizzle schema | 📄 设计 |
| **Debug** | debug | MCAP 回放 + RPC 调试 + Topic 监控 | 已有 Debug SPA | ✅ 已实现 |

#### 插件编辑器（v2+）

| 编辑器 | 类型 | 用途 | 状态 |
|--------|------|------|:----:|
| **Logic Designer** | logic | PLC 代码编辑（Phase 1 = ST Only，Phase 2+ = IEC 61131-3: LD/FBD/SFC） | 📄 远景 |
| **App Builder** | app | 无代码应用构建器 | 📄 远景 |

---
> **编译器策略（D22）**: Phase 1 使用 RuSTy 编译 ST → HAL Binding Generator 映射到 HAL 原语；Phase 2 自研 ST 前端 + HAL IR（稳定接口），后端仍用 RuSTy LLVM；Phase 3 完全自研（含 LLVM 后端），HAL IR 不变。用户 ST 代码零感知。


### 6. RBAC 权限模型

#### 四层权限

```
┌─────────────────────────────────────────────────────────────┐
│                    AUDESYS Studio RBAC 四层模型                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: 平台级 (Platform-level)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  can('platform:login')           -> 能否登录          │   │
│  │  can('platform:admin')           -> 平台管理          │   │
│  │  can('studio:access')            -> 能否打开 Studio   │   │
│  │  can('studio:plugin:install')    -> 安装插件          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Layer 2: 项目级 (Project-level)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  can('studio:project:create')    -> 创建项目          │   │
│  │  can('studio:project:read',      -> 查看项目          │   │
│  │      scope: 'project:<id>')                          │   │
│  │  can('studio:project:update',     -> 编辑项目         │   │
│  │      scope: 'project:<id>')                          │   │
│  │  can('studio:project:publish',    -> 发布项目         │   │
│  │      scope: 'project:<id>')                          │   │
│  │  can('studio:project:invite',     -> 邀请成员         │   │
│  │      scope: 'project:<id>')                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Layer 3: 编辑器级 (Editor-level)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  can('studio:editor:open',       -> 打开编辑器        │   │
│  │      scope: 'editor:scene')                          │   │
│  │  can('studio:editor:edit',       -> 编辑权限          │   │
│  │      scope: 'editor:scene')                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Layer 4: 资源级 (Resource-level)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  资源级 ACL (策略模板 + 运行时过滤)                       │   │
│  │  can('collection:read', scope: 'collection:<name>')  │   │
│  │  filterFields('collection:<name>', user.role)        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 角色模板

| 角色 | 平台级 | 项目级 | 编辑器级 | 资源级 | 典型用户 |
|------|:------:|:------:|:--------:|:------:|---------|
| **admin** | 全部 | 全部 | 全部 | all | 系统管理员 |
| **developer** | login | create/read/update/publish/export | open/edit | all | 开发工程师 |
| **supervisor** | login | read/publish/export | open/edit | own+department | 主管/审核 |
| **operator** | login | read/export | open(只读) | readonly | 操作工 |
| **viewer** | login | read | open(只读) | readonly | 查看者 |

#### 权限决策流程

```
用户请求: "打开项目 P001 的 Scene Designer 编辑器"

┌──────────────────────────────────────────────────┐
│ Step 1: 身份验证 (Casdoor OIDC)                  │
│  JWT -> userId: 'alice', role: 'developer'        │
│  ✅ platform:login -> pass                        │
├──────────────────────────────────────────────────┤
│ Step 2: Studio 访问权限                          │
│  can('studio:access', role='developer') -> ✅     │
├──────────────────────────────────────────────────┤
│ Step 3: 项目级权限                               │
│  can('studio:project:read',                      │
│      scope: 'project:P001') -> ✅                 │
│  (检查项目成员表: alice ∈ P001.members)          │
├──────────────────────────────────────────────────┤
│ Step 4: 编辑器级权限                             │
│  can('studio:editor:open',                       │
│      scope: 'editor:scene') -> ✅                 │
│  (检查项目类型 P001.type='hmi' -> scene 可用)     │
├──────────────────────────────────────────────────┤
│ Step 5: 加载编辑器                               │
│  registry.load('@audesys/scene-designer')        │
│  -> 渲染 Scene Designer UI                        │
└──────────────────────────────────────────────────┘
```

---

### 7. 多项目架构

#### 项目类型 -> 编辑器映射

```
┌─────────────────────────────────────────────────────────────┐
│                  项目类型 -> 编辑器映射                        │
├──────────┬──────────────────────────────────────────────────┤
│          │  Scene    Flow     Data     Logic    App         │
│          │ Designer  Designer Designer Designer Builder     │
├──────────┼──────────┬─────────┬────────┬────────┬──────────┤
│ hmi      │   ✅     │   ⬜    │  ✅    │  ⬜   │  ⬜      │
│ plc      │   ⬜     │   ⬜    │  ✅    │  ✅   │  ⬜      │
│ firmware │   ⬜     │   ✅    │  ✅    │  ⬜   │  ⬜      │
│ gateway  │   ⬜     │   ✅    │  ✅    │  ⬜   │  ⬜      │
│ plc      │   ⬜     │   ⬜    │  ✅    │  ✅   │  ⬜      │
│ gateway  │   ⬜     │   ✅    │  ✅    │  ⬜   │  ⬜      │
│ full     │   ✅     │   ✅    │  ✅    │  ✅   │  ✅      │
│ custom   │   由项目 config.editors 字段定义                  │
└──────────┴──────────┴─────────┴────────┴────────┴──────────┘
└──────────┴──────────┴─────────┴────────┴────────┴──────────┘
```

#### 两层项目模型：Firmware + Engineering

AUDESYS 将传统工业控制项目拆分为两层：

- **Firmware Project（固件项目）** — 定义控制器的运行时配置：硬件接口、通信协议、周期参数。固件项目定义 HAL 信号接口（如 `sensor.temp.pt100`），配置 Modbus/HART 适配器，声明组件和线程调度。
- **Engineering Project（工程项目）** — ST 源代码和 HMI 设计，仅能消费固件暴露的信号。编译时通过 `expects_signals` 验证信号契约。

核心规则：**固件项目定义硬件接口，工程项目只能消费固件暴露的信号——不能新增信号或适配器。**

```
┌─ Firmware Project ────────┐     ┌─ Engineering Project ──┐
│ · HAL 信号定义              │     │ · ST 源代码              │
│ · 协议适配器（Modbus/HART）  │───▶│ · 信号契约（expects_signals）│
│ · 周期、Pin 映射、组件配置   │     │ · 编译→部署到控制器       │
└───────────────────────────┘     └─────────────────────────┘
              │                               │
              └───── 部署捆绑包 ───────────────┘
                   .afw + .air
                        │
                        ▼
               ┌──────────────────┐
               │  Controller (运行时)│
               └──────────────────┘
```

固件项目映射到 `firmware` 项目类型，工程项目映射到现有的 `plc` 或 `hmi` 类型。详见 `docs/plans/p0-mvp-status.md` §1。


#### 项目生命周期

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌───────────┐
│  draft  │ ──-> │ active  │ ──-> │published │ ──-> │ archived │ ──-> │  deleted  │
│ (草稿)  │     │ (开发中)│     │ (已发布) │     │ (归档)   │     │ (已删除)  │
└─────────┘     └─────────┘     └──────────┘     └──────────┘     └───────────┘

状态转换权限:
  draft -> active:     developer+ (project:update)
  active -> published:  supervisor+ (project:publish)
  published -> active:  admin (状态回退)
  * -> archived:        admin (project:delete)
  archived -> deleted:  admin (硬删除)
```

---

### 8. 插件系统

#### StudioEditor 接口

```typescript
// packages/studio-core/src/types.ts

export interface StudioEditor {
  id: string                          // '@audesys/scene-designer'
  name: string                        // 'Scene Designer'
  type: EditorType                    // 'scene' | 'flow' | 'data' | 'logic' | 'app'
  supportsProjectTypes: ProjectType[] // ['hmi', 'full']
  icon: string                        // lucide icon name
  component: React.LazyExoticComponent<React.ComponentType<EditorProps>>
  permissions: EditorPermission[]
  settingsPanel?: React.LazyExoticComponent<React.ComponentType<SettingsProps>>
  onActivate?(ctx: EditorContext): Promise<void>
  onDeactivate?(ctx: EditorContext): Promise<void>
}

export interface EditorContext {
  rpc: RpcClient
  resources: ResourceService
  acl: AclClient
  user: UserInfo
  project: ProjectInfo
  eventBus: EventBus
  notify: NotifyService
}
```

#### 编辑器注册表

编辑器通过 `EditorRegistry` 注册，结合 RBAC 和项目类型过滤：

```typescript
class EditorRegistry {
  private editors = new Map<string, StudioEditor>()

  register(editor: StudioEditor): void { /* ... */ }

  getEditorsForProject(
    projectType: ProjectType,
    userPermissions: Permission[]
  ): StudioEditor[] {
    // 1. 按项目类型过滤
    // 2. 按用户权限过滤
    // 3. 返回可用编辑器列表
  }
}
```

#### 插件安装流程

```
管理员安装新编辑器插件:

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 1. 下载插件  │ ─-> │ 2. 验证签名  │ ─-> │ 3. 权限检查  │
│ (npm/GitHub) │    │ (SHA256)     │    │ (admin only) │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
┌──────────────┐    ┌──────────────┐    ┌──────┴───────┐
│ 6. 通知 UI   │ ←─ │ 5. 注册路由  │ ←─ │ 4. 加载插件  │
│ (刷新编辑器  │    │ + RPC + 权限 │    │ (sandbox)   │
│  列表)       │    │ 定义         │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

### 9. 部署模式

```
┌─────────────────────────────────────────────────────────────┐
│                     Studio 部署模式                          │
├──────────┬──────────────────────────────────────────────────┤
│  Web 端  │  浏览器访问 -> Hono HTTP :3000/studio             │
│          │  适合: 远程开发、跨平台、团队协作                 │
│          │  技术: React SPA + WebSocket (协同)              │
├──────────┼──────────────────────────────────────────────────┤
│  桌面端  │  Tauri 打包                                   │
│          │  适合: 离线开发、低延迟、本地文件系统访问         │
│          │  技术: 同 Web 端代码 + 本地文件系统桥接          │
├──────────┼──────────────────────────────────────────────────┤
│  嵌入式  │  作为 Panel 的编辑模式嵌入                       │
│          │  适合: 运行时在线编辑（类似 LabVIEW 运行时编辑） │
│          │  技术: Studio Core 嵌入 Panel 进程               │
└──────────┴──────────────────────────────────────────────────┘
```

#### 桌面端特殊能力

```
✅ 本地文件系统访问 (项目可保存为 .audesys-project 文件)
✅ 离线开发 (无网络时使用本地 SQLite)
✅ 本地 Git 集成 (项目版本控制)
✅ 硬件调试 (直接访问串口/USB)
❌ 多用户协作 (需连回服务器)
```

---

### 10. 平台集成

> **TODO: 为 AUDESYS 重写此节** — 平台集成方案依赖 Studio Phase 2 实现细节，当前保留占位

---

### 11. 参考系统

| 维度 | 最佳参考 | 借鉴内容 |
|------|---------|---------|
| **权限模型** | Grafana (Action+Scope) | 细粒度 RBAC，Folder 继承，自定义角色 |
| **项目隔离** | n8n (Project 绑定资源) | 项目作为权限边界，资源绑定项目 |
| **身份管理** | Casdoor (OIDC+LDAP) | 单二进制 IdP，内置组织/团队/用户层级 |
| **应用权限** | 群晖 DSM (应用级开关) | 编辑器级开关（谁能打开 Scene Designer） |
| **字段级 ACL** | NocoBase (策略模板) | 策略模板方式实现 |
| **插件系统** | VS Code Extension API | 编辑器注册表 + 权限过滤 + 项目类型映射 |
| **协同编辑** | VS Code Live Share | v2+ 用 Yjs CRDT 实现 |

---

### 12. 演进路线

```
S1: 核心编辑器           S2: 多用户 + RBAC
(单用户编辑器)                (团队协作)
┌──────────────────────┐      ┌──────────────────────┐
│ • Studio Core 框架   │      │ • Casdoor 集成        │
│ • 编辑器注册表       │ ──->  │ • RBAC 四层模型       │
│ • Scene Designer MVP │      │ • 项目隔离            │
│ • Debug (已有)       │      │ • 团队/组织           │
│ • 项目 CRUD          │      │ • 版本控制 (Git)      │
│ • 桌面端打包         │      │ • Web 端部署          │
└──────────────────────┘      └──────────────────────┘

S3: 运行时编辑           S4: 协同 + 生态
(LabVIEW 式在线编辑)          (插件市场 + 多租户)
┌──────────────────────┐      ┌──────────────────────┐
│ • Panel 嵌入编辑模式 │      │ • 实时协同编辑 (Yjs)  │
│ • 热部署             │ ──->  │ • 插件市场            │
│ • Flow Designer      │      │ • 多租户 SaaS         │
│ • Data Designer      │      │ • Logic Designer      │
│ • 在线调试回路       │      │ • App Builder         │
└──────────────────────┘      └──────────────────────┘
```

---

### 13. 风险与决策点

#### 技术风险

| 风险 | 影响 | 概率 | 对策 |
|------|:----:|:----:|------|
| **Casdoor 集成复杂度** | 高 | 中 | Phase 1 用内置 JWT，Phase 2 后期再接 Casdoor |
| **协同编辑冲突** | 中 | 中 | Phase 1-2 不做实时协同，用文件锁 + 版本控制 |
| **编辑器插件沙箱安全** | 高 | 低 | Phase 1 用进程隔离 (UDS)，Phase 3+ 考虑 QuickJS |
| **SQLite -> PostgreSQL 迁移** | 中 | 低 | Drizzle ORM 抽象层已就位 |
| **桌面端离线/在线同步** | 中 | 中 | Phase 1 纯离线，Phase 2 纯在线，Phase 3 再考虑同步 |

#### 关键决策点

| 决策 | 推荐 | 理由 |
|------|------|------|
| **身份系统** | 先 JWT 后 Casdoor | Phase 1 用 JWT 快速启动，Phase 2 接 Casdoor |
| **项目存储** | 双模式（文件系统 + DB） | 桌面端用文件，Web 端用 DB，Drizzle 抽象 |
| **协同编辑** | Yjs (CRDT) | 无需中央服务器，离线友好，生态成熟 |
| **编辑器框架** | 自研 | AUDESYS 编辑器是图形化组态，非文本编辑 |
| **插件分发** | npm registry | 复用 npm 生态，Phase 4+ 再考虑自建 |
| **桌面端框架** | Tauri | Rust 后端与 HAL 技术栈一致，包体积 5-10MB |
| **RBAC 粒度** | 细粒度 (Action+Scope) | Grafana 模式，扩展性好 |

---

### 14. 下一步行动

```
立即可做:
  1. 创建 packages/studio-core/ 包骨架
  2. 定义 StudioEditor 接口和 EditorRegistry
  3. 将 PanelRegistry 提取为通用注册器
  4. 设计 .audesys-project 文件格式 (JSON schema)

需要数据库完成后:
  5. 项目 CRUD API (Drizzle + PostgreSQL)
  6. 项目成员表

需要 RBAC 完成后:
  7. RBAC 四层模型实现
  8. Casdoor 集成
  9. 权限管理 UI

可并行开发:
  10. Scene Designer MVP (@xyflow/react 画面编辑)
  11. Flow Designer MVP (DAG 流程编辑)
  12. 桌面端打包 (Tauri)
```

---

## 四、Simulator 套件

> ✅ **状态**: Inproc MVP 完成 — SimulationHarness + 故障注入引擎 + 场景录制/回放 + VirtualModbusTcpDevice + VirtualHARTDevice

### 1. 架构 - 子进程模型

> **设计决策**：仿真器作为 Studio 的 **子进程** 运行（`child_process.fork`），不是线程，不是独立应用。

**子进程而非线程的理由**：

1. **隔离性**：仿真器崩溃不影响 Studio
2. **可替换后端**：未来可替换为 Gazebo headless
3. **独立执行**：可用于 CI/CD、Docker 容器
4. **性能隔离**：仿真计算不阻塞 Studio UI

```
Studio (Tauri Main)
  ├── SimulatorManager (AVD Manager)     ← 配置/启动/停止仿真器
  ├── Simulator (child_process.fork)      ← 独立子进程
  │     ├── VirtualDevice[]               ← 虚拟设备实例数组
  │     │   ├── VirtualSerialDevice       ← 虚拟串口 (G-code 响应)
  │     │   ├── VirtualModbusTcpServer    ← 虚拟 Modbus TCP
  │     │   ├── VirtualModbusRtuDevice    ← 虚拟 Modbus RTU
  │     │   ├── VirtualCanBus             ← 虚拟 CAN 总线
  │     │   ├── VirtualCanOpenNode        ← 虚拟 CANopen 节点
  │     │   ├── VirtualUsbCamera          ← 虚拟 USB 相机
  │     │   └── VirtualDisplay            ← 虚拟显示窗口
  │     ├── HALClient (Thin Client)       ← 连接到 Controller 或独立 HAL
  │     └── TelemetryPublisher            ← MQTT 状态发布
  └── DebugBridgeClient                   ← Studio 侧通信客户端
```

---

### 2. 仿真器 Profile（AVD Manager 模式）

参考 Android Studio AVD Manager，每个仿真器实例由一个 JSON Profile 定义：

```json
{
  "name": "Resin LCD Printer Sim",
  "version": "2.0",
  "type": "resin-lcd",
  "description": "1440x2560 LCD resin printer simulation",

  "devices": [
    {
      "type": "serial-gcode",
      "label": "Mainboard Serial",
      "config": {
        "port": "virtual",
        "baudRate": 115200,
        "responseDelay": 10,
        "faultInjection": true
      }
    },
    {
      "type": "modbus-tcp",
      "label": "Temp Controller",
      "config": {
        "port": 5020,
        "slaveId": 1,
        "registers": {
          "0": { "name": "bed-temp", "type": "float", "value": 25.0 },
          "1": { "name": "uv-power", "type": "float", "value": 0.0 }
        }
      }
    }
  ],

  "simulation": {
    "speedMultiplier": 1,
    "realtimeSync": true,
    "faultScenarios": [
      { "name": "bed-overheat", "trigger": "manual",
        "action": "set-register:0:120" },
      { "name": "serial-disconnect", "trigger": "manual",
        "action": "disconnect:serial-gcode" }
    ]
  }
}
```

---

### 3. 7 种虚拟设备类型

| 虚拟设备 | 对应协议 | 实现方式 | 现有代码复用 | 状态 |
|----------|---------|---------|-------------|------|
| `VirtualSerialDevice` | RS485/Serial | 伪终端 (socat) 或内存虚拟 | ✅ virtual-device.ts | 🔮 Phase 3 |
| `VirtualModbusTcpServer` | Modbus TCP | TCP Server 监听 | ✅ modbus-server.ts | 🔮 Phase 3 |
| `VirtualModbusRtuDevice` | Modbus RTU | 虚拟串口 + RTU 帧 | 需新增 | 🔮 Phase 3 |
| `VirtualCanBus` | CAN Bus | socketcan vcan | 需新增 | 🔮 Phase 4 |
| `VirtualCanOpenNode` | CANopen | 虚拟节点 (vcan) | 需新增 | 🔮 Phase 4 |
| `VirtualUsbCamera` | USB Camera | v4l2loopback / 测试图像 | 需新增 | 🔮 Phase 4 |
| `VirtualDisplay` | Display | 虚拟显示窗口 | ✅ simulator-projector.ts | 🔮 Phase 3 |

---

### 4. 协议仿真方案

| 协议 | 仿真方案 | 实现方式 | 现有代码复用 |
|------|----------|----------|-------------|
| RS485/Serial | 伪终端 (socat) 或内存虚拟 | `VirtualSerialDevice` 包装现有 `VirtualPrinterDevice` | ✅ virtual-device.ts |
| Modbus TCP | TCP Server 监听 | `VirtualModbusTcpServer` | ✅ modbus-server.ts |
| Modbus RTU | 虚拟串口 + RTU 帧 | `VirtualModbusRtuDevice` | 需新增 |
| CAN Bus | socketcan vcan | `VirtualCanBus` | 需新增 |
| CANopen | 虚拟节点 (vcan) | `VirtualCanOpenNode` | 需新增 |
| USB Camera | v4l2loopback / 测试图像 | `VirtualUsbCamera` | 需新增 |
| Display | 虚拟显示窗口 | `VirtualDisplay` | ✅ simulator-projector.ts |

---

### 5. 仿真器生命周期

```
用户在 AVD Manager 中选择 Profile
    ↓
Studio Main: simulatorManager.launch(profile)
    ↓
child_process.fork(simulator-entry.js, [profilePath])
    ↓
Simulator 进程:
    1. 加载 Profile JSON
    2. 创建 VirtualDevice 实例
    3. 连接 HALClient（到 Controller 或独立 HAL）
    4. 启动 TelemetryPublisher (MQTT)
    5. 通知 Studio: "ready"
    ↓
Studio: debugBridgeClient.connect(udsPath)
    ↓
用户操作 (启动打印/调试/监控)
    ↓
用户关闭仿真器 / Studio 退出
    ↓
Simulator 进程: SIGTERM -> 清理资源 -> exit
```

**故障注入能力**：

仿真器支持故障注入场景，用于测试 Controller 的容错能力：

| 故障场景 | 触发方式 | 动作 |
|----------|---------|------|
| `bed-overheat` | 手动 | 设置寄存器 0 为 120°C |
| `serial-disconnect` | 手动 | 断开串口连接 |
| `modbus-timeout` | 手动 | Modbus 响应超时 |
| `can-bus-error` | 手动 | 注入 CAN 总线错误帧 |

---

## 五、调试桥

> ✅ **状态**: DAP MVP 完成 — 12 调试命令 + 断点/步进/寄存器/变量

### 1. 协议 - DAP 子集 + 工业扩展

> **来源**：VS Code DAP + LabVIEW + UE5 Blueprint + Node-RED + Foxglove + XState Inspector

Debug Bridge 采用 **JSON-RPC 2.0** 协议，兼容 VS Code Debug Adapter Protocol (DAP) 子集，并扩展工业调试能力。

---

### 2. 三类断点 + Log Points

| 断点类型 | 参考 | 触发条件 | UI 表现 |
|----------|------|----------|---------|
| **CodeBreakpoint** | VS Code DAP | 源码行号 + 条件表达式 | 红色圆点 |
| **BlueprintBreakpoint** | UE5 Blueprint | Flow 图节点 ID + 条件 | 红色标记 |
| **StateMachineBreakpoint** | XState Inspector | 状态名 / 转换事件 | 红色边框 |
| **LogPoint** | VS Code | 源码行号，不暂停 | 蓝色菱形 |

---

### 3. DAP 兼容子集

```typescript
interface DAPSubset {
  setBreakpoints(source: string, lines: number[],
    conditions?: string[]): Breakpoint[];
  continue(threadId?: number): void;
  stepOver(threadId?: number): void;
  stepInto(threadId?: number): void;
  stepOut(threadId?: number): void;
  pause(threadId?: number): void;
  stackTrace(threadId: number): StackFrame[];
  variables(variablesReference: number): Variable[];
  evaluate(expression: string, frameId?: number): EvaluateResponse;
}
```

---

### 4. AUDESYS 工业调试扩展

```typescript
interface AUDESYSDebugExtensions {
  // 蓝图断点
  setBlueprintBreakpoint(graphId: string, nodeId: string,
    condition?: string): void;

  // 状态机断点
  setStateBreakpoint(machineId: string, state?: string,
    transition?: string): void;

  // Probe (信号探针 - LabVIEW 风格)
  setProbe(signalName: string, mode: 'polling' | 'event',
    condition?: string): ProbeId;

  // 通信监听 (Foxglove/dora-rs 风格)
  getCommLog(filter?: {
    transport?: string;
    direction?: 'tx' | 'rx'
  }): CommLogEntry[];

  // 信号历史 (时间线回放)
  getSignalHistory(signalName: string, startTime?: number,
    endTime?: number): SignalSample[];

  // 执行高亮 (UE5/LabVIEW 风格)
  setExecutionHighlight(config: {
    enabled: boolean;
    speed: 'slow' | 'step' | 'realtime'
  }): void;

  // 故障注入 (仿真器专属)
  injectFault(component: string,
    type: 'disconnect' | 'error' | 'timeout' | 'value-override'): void;

  // 快照与恢复
  snapshot(): HALSnapshot;
  restore(snapshot: HALSnapshot): void;
}
```

**DAP 标准 vs AUDESYS 扩展对比**：

| 能力 | DAP 标准 | AUDESYS 扩展 |
|------|---------|------------|
| 源码断点 | ✅ | ✅ |
| 单步调试 | ✅ | ✅ |
| 变量检查 | ✅ | ✅ |
| 表达式求值 | ✅ | ✅ |
| 蓝图断点 | ❌ | ✅ BlueprintBreakpoint |
| 状态机断点 | ❌ | ✅ StateMachineBreakpoint |
| 信号探针 | ❌ | ✅ Probe 模式 |
| 通信监听 | ❌ | ✅ CommLog |
| 信号历史 | ❌ | ✅ SignalHistory |
| 执行高亮 | ❌ | ✅ ExecutionHighlight |
| 故障注入 | ❌ | ✅ injectFault |
| 快照恢复 | ❌ | ✅ snapshot/restore |

---

### 5. 调试 UX 关键模式

基于 7 平台研究验证的最佳实践：

1. **Probe 模式（LabVIEW）**：拖拽探针到任意信号/引脚，非侵入式显示实时值
2. **Debug Sidebar + 消息树（Node-RED）**：每个节点执行事件显示为可展开的消息树
3. **Panel-First 布局（Foxglove）**：拖拽 topic 到面板即可订阅，所有面板同步全局时间轴
4. **状态机 Time Travel（XState）**：状态图高亮当前状态 + 事件历史时间线可回溯
5. **DAP 变量检查（VS Code）**：作用域层次，嵌套对象懒加载
6. **Node Status 指示器（Node-RED）**：每个节点显示运行状态点（绿/蓝/红）
7. **Debug Console REPL（VS Code）**：暂停时可执行表达式，交互式发送事件/查询信号

---

### 6. 与 HAL Protocol 集成

Debug Bridge 通过 HAL Client 访问 Controller 的 HAL Core：

- **信号探针**：订阅 HAL `SignalUpdate`，显示实时值
- **信号历史**：查询 HAL `HALSnapshot`，时间线回放
- **通信监听**：订阅 HAL `StreamData`，显示通信帧
- **快照恢复**：调用 HAL `getSnapshot()` / `restoreSnapshot()`
- **故障注入**：通过仿真器 `injectFault` 接口（仅仿真模式）

---

## 六、Web 迁移路径

> 🔮 **状态**: 规划中 - AUDESYS 尚未开始实现

### 1. 桌面版 vs Web 版差异

AUDESYS 支持桌面版（Tauri）和 Web 版两种部署模式。以下是核心技术差异：

| 能力 | 桌面版 | Web 版 |
|------|--------|--------|
| 传输层 | UDS + FlatBuffers | Zenoh + WebSocket |
| 串口 | Rust serialport | Web Serial API / Gateway |
| 存储 | SQLite (本地) | PostgreSQL (远程) |
| MQTT | Aedes (内嵌) | MQTT over WS (远程) |
| 窗口 | Tauri | 浏览器 Tab |
| 仿真器 | child_process.fork | Docker 容器 (远程) |
| 调试 | UDS JSON-RPC | WebSocket JSON-RPC |

---

### 2. 代码复用率

```
React 组件 (编辑器 + 面板):  100% 复用
TypeScript 类型定义:          100% 复用
HAL Protocol Schema:         100% 复用 (FlatBuffers)
Node.js Thin Client:         ~90% 复用 (传输层替换)
Rust HAL Core:               100% 复用 (仅传输层加 Zenoh)
Simulator Core:              ~90% 复用
Tauri Main:               0% (替换为 WebSocket 客户端)
```

**复用率分析**：

| 模块 | 复用率 | 需要修改的部分 |
|------|--------|---------------|
| React 组件 | 100% | 无 - 纯前端组件 |
| TypeScript 类型 | 100% | 无 - 类型定义与传输无关 |
| HAL Protocol Schema | 100% | 无 - FlatBuffers 语言无关 |
| Node.js Thin Client | ~90% | Transport 层从 UDS 替换为 WebSocket |
| Rust HAL Core | 100% | 传输层增加 Zenoh 支持 |
| Simulator Core | ~90% | 子进程模式从 fork 替换为 Docker |
| Tauri Main | 0% | 完全替换为 WebSocket 客户端 |

---

### 3. 迁移策略

#### Phase 5a: WebSocket 传输层

1. 实现 `WebSocketTransport`（实现 `ISignalTransport` 接口）
2. Node.js Thin Client 增加 WebSocket 传输模式
3. Studio 前端直接通过 WebSocket 连接远程 Controller

#### Phase 5b: Web 部署模式

1. Studio 前端打包为静态资源（Vite build）
2. Supervisor 作为 Web Server 提供静态资源 + WebSocket 代理
3. 仿真器替换为 Docker 容器（远程执行）

#### Phase 5c: 多租户 SaaS

1. 基于 JWT 的多租户认证
2. 每个租户独立的 Controller 实例
3. 共享 Studio 前端（按租户加载模板）

---

### 4. 架构差异图

```
桌面版架构:
  Studio (Tauri) ←UDS-> Controller (Rust) ←Serial-> 设备
  Studio (Tauri) ←UDS-> Simulator (fork)

Web 版架构:
  Browser (React) ←WebSocket-> Supervisor (Node.js) ←Zenoh-> Controller (Rust) ←Serial-> 设备
  Browser (React) ←WebSocket-> Supervisor (Node.js) ←Docker API-> Simulator (Container)
```


---

## 七、CNC 系统

AUDESYS 以 G-code（RS274/NGC）编译器作为第 6 种源码语言，与现有 5 种 IEC 61131-3 语言
（ST/IL/LD/FBD/SFC）共享 HalProgram 后端，实现 CNC 运动控制能力。新增 `docs/modules/cnc/`
子文档模块，覆盖 G-code 编译管道、运动规划器、轴组管理三构件。

### CNC 构件

| 构件 | 文档 | 状态 |
|------|------|:---:|
| G-code 编译器 | `docs/modules/cnc/gcode-compiler-design.md` | ✅ 已完成 |
| 运动规划器 | `docs/modules/cnc/motion-planner-design.md` | 🟡 梯形剖面完成 |
| 轴组管理 | `docs/modules/cnc/axis-group-design.md` | 🟡 设计完成 |
| 竞品参考 | `docs/modules/cnc/cnc-reference-models.md` | 🟡 设计完成 |

### 架构概览

```
  G-code 文本 (String)
        │
        ▼
┌───────────────────────────────────────┐
│  G-code Compiler                      │
│  crates/audesys-gcode-compiler/       │
│  Lexer → Two-Pass Parser → IR Gen     │
└──────────────────┬────────────────────┘
                   │
                   ▼
          HalProgram { name, signals, instructions }
                   │
                   ▼
      HAL VM / Executor (复用现有 34 操作码)
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   axis.N.pos  spindle.rpm  motion.state
   (F64)       (F64)        (U8)
```

### 核心设计决策

- **D55**: G-code→HAL IR 编译策略 — 编译器作为独立管道，输入 G-code 文本，输出 HalProgram，
  零 VM 变更。Phase 1 覆盖 G0/G1/G2/G3 运动指令 + M3/M4/M5/M30 辅助指令。
- **参考模型**: LinuxCNC 4 层架构（UI→Task→Motion→HAL）映射到 AUDESYS
  （Studio↔UI, Controller↔Task, Runtime Engine↔Motion, HAL Transport↔HAL pins）。
- **运动规划器**: Phase 1 使用逐周期步进逼近（步长 = 进给率 × 周期时间），
  Phase 2 迁移至 Runtime 协处理器实现梯形/S 曲线速度剖面。
- **轴组**: 逻辑轴组（X,Y,Z）通过 G17/G18/G19 关联平面选择，回零/软限位/反向间隙
  作为 Signal 驱动状态机。

### 与 IEC 61131-3 编译器的统一

| 源语言 | 编译器 Crate | 输出类型 |
|--------|-------------|----------|
| ST | `audesys-hal-binding-gen` | HalProgram |
| IL | `audesys-il-compiler` | HalProgram |
| LD | `audesys-ld-compiler` | HalProgram |
| FBD | `audesys-fbd-compiler` | HalProgram |
| SFC | `audesys-sfc-compiler` | HalProgram |
| **G-code** | **`audesys-gcode-compiler`** | **HalProgram** |

所有 6 种编译器输出相同的 `HalProgram` 类型，VM 不感知源码语言。

### 阶段路线

| 阶段 | 覆盖 | 关键能力 |
|:---:|------|----------|
| Phase 1 | G0/G1/M3/M5/M30 | ✅ 完成: G-code 编译器（69 测试）+ 梯形速度剖面
| Phase 2 | G2/G3 弧线 + 轴组 | 圆弧插补 + Runtime 协处理器（延后）
| Phase 3 | 多轴插补 + 运动学 | S 曲线 + 前瞻 + CoreXY/Delta/SCARA（规划中）

### 参考

- `docs/modules/cnc/gcode-compiler-design.md` — G-code 编译管道详细设计
- `docs/modules/cnc/motion-planner-design.md` — 运动规划器设计
- `docs/modules/cnc/axis-group-design.md` — 轴组/坐标系统设计
- `docs/modules/cnc/cnc-reference-models.md` — CNC 竞品架构评估
- `openspec/specs/cnc-spec.md` — SDD 规范（37 项）
- D55 in `.agents/memorys/decisions.md`
- D10/D11/D17/D19 in `.agents/memorys/decisions.md`