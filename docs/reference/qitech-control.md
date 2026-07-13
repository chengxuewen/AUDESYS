# QiTech Control — 下一代机器接口：Rust 驱动的工业控制系统

> **生产验证的 Rust+TypeScript 工业控制框架，带有完整的 EtherCAT HAL 抽象层**
> 仓库：https://github.com/qitechgmbh/control
> 许可：LGPL-3.0 | 319 Stars | 33 Forks | 2,516 Commits | 22 Releases
> 语言栈：Rust 59.4% / TypeScript 39.1% / Nix 0.8% | 30+ Contributors
> Version: v3.0.0-rc2 (2026-06-29) | 59-page Wiki | 10+ production machines

---

## 1. 产品画像

### 1.1 公司背景与产品全称

QiTech Control 由 QiTech GmbH 开发，是一家总部位于德国的工业自动化公司（qitech.de）。产品定位为 "Next Generation Machine Interface"（下一代机器接口），反映了将现代软件工程实践引入工业控制领域的愿景。技术团队在 YouTube 上维护活跃的视频频道，分享开发过程、技术堆栈和真实客户项目经验（包括 "Day in the Software Team"、"First Client"、"Steelworks Week" 等系列视频）。

与 truST 的单人独立开发模式形成鲜明对比，QiTech 代表了团队化、生产导向的开源工业控制项目发展路径。项目自创建以来累计 2,516 次提交，拥有超过 30 位社区贡献者。59 页的详细 Wiki 文档涵盖架构概述、入门指南、硬件示例、REST API 参考、扩展开发指南和故障排查等全方位内容。

QiTech Control 区别于其他开源 PLC 项目的最大特点：它不仅是开源的参考实现，更是 QiTech GmbH 的核心商业产品。公司利用该框架为真实工业客户构建定制化控制系统。目前已有超过 10 台生产机器在实际工厂环境中运行，涵盖丝材挤出（Filament Extrusion）、卷绕（Winding Machines）、测量（Measurement）、材料处理（Material Processing）、激光设备（Laser DRE）和 AI 视觉集成（HAILO Bottlecap Detection Demo）等多个工业领域。这种 "dogfooding"（自用产品）模式确保了代码质量和实用性达到生产级别。

### 1.2 历史里程碑

| 时间 | 里程碑 | 技术意义 |
|------|--------|---------|
| 2023-2024 | 项目启动，初期开发 | 从零构建 Rust 工业控制系统 |
| 2024 | 首批生产机器部署 | 在实际工厂中验证技术可行性，完成从原型到生产的跨越 |
| 2025 | ethercat-hal 模块架构成熟 | HAL 抽象层成为项目技术核心，WAGO + Beckhoff 设备支持扩展 |
| 2025 | 社区增长至 100+ Stars | 开源社区开始认可和参与 |
| 2026-06-01 | v2.17.0 发布 | 持续功能迭代，性能优化和稳定性改进 |
| 2026-06-29 | v3.0.0-rc2 发布 | 重大版本升级，NixOS 实时 Linux 集成完善，全系列 EtherCAT 支持 |
| 2026-07 | 319 Stars, 33 Forks, 30+ Contributors | 社区生态健康和持续增长 |

### 1.3 产品定位与核心价值主张

QiTech Control 的定位清晰有力：

1. **从专有 PLC 生态中解放开发者** — 取代许可证沉重、基于"指指点点"式配置的传统 PLC 工作流，用现代软件工程实践（Rust 后端性能 + TypeScript 前端体验 + Git 版本控制 + CI/CD 自动化）替代封闭的开发模式

2. **标准 EtherCAT 终端的模块化 + Rust/React 技术栈** — 利用 WAGO 和 Beckhoff 等工业标准的 EtherCAT 硬件（确保硬件质量和供应链可靠性），搭配 Rust 的系统级性能和 TypeScript+React 的现代前端体验

3. **生产验证** — 10+ 台机器在真实工厂中运行，不是实验室原型或概念验证

4. **全栈覆盖** — 从 EtherCAT 硬件驱动（ethercat-hal）到 Electron 桌面应用（React+Shadcn UI+Tailwind）的端到端解决方案，无第三方黑盒依赖

5. **可复现的实时 Linux** — 通过 NixOS 声明式配置确保每台部署机器的系统环境完全一致且可版本控制（消除了"在我机器上能跑"的经典问题）

6. **模块化可扩展** — 每台新机器的控制逻辑通过 MachineAct trait 独立实现，新设备通过 IO trait 接入，不修改核心框架

### 1.4 目标用户群体

| 用户类型 | 典型场景 | 核心需求 |
|---------|---------|---------|
| 机器制造商 (OEM) | 为其特殊工艺设备构建定制控制系统 | 脱离专有 PLC 绑定、灵活定制、成本可控、硬件选择自由 |
| 自动化集成商 | 为客户部署整套控制系统 | 生产可靠性、远程运维、标准化硬件、快速复制部署 |
| 开源社区开发者 | 学习或贡献现代工业控制技术 | 完善的文档和视频教程、清晰的代码架构、活跃的社区 |

### 1.5 与 AUDESYS 的关系定位

QiTech Control 对 AUDESYS 的参考价值主要在 **HAL 硬件抽象层设计** 和 **生产部署模式**。ethercat-hal 是 HAL 抽象概念的具体实现参考，其多层抽象设计（PDO → 设备 → IO trait → MachineAct）直接验证了 AUDESYS HAL 设计理念的可行性。参考价值评分：⭐⭐⭐⭐⭐ (5/5)。

---

## 2. 技术特性

### 2.1 系统架构

QiTech Control 采用明确的三层架构：

**前端层（Electron + React + TypeScript）**：Shadcn UI（基于 Radix UI 的可访问性组件）+ Tailwind CSS v4（实用优先的样式）+ TanStack Router（类型安全路由）+ Zustand + Immer（状态管理，不可变更新）。通过 SocketIO 获取实时数据推送（IO 值变化、报警），通过 REST API 执行写入操作。标准化的 `<EditValue>` 组件确保所有机器的 UI 使用统一的交互模式。

**后端层（Server, Rust + axum + smol）**：axum 提供 REST API 和 SocketIO。控制循环（Control Loop）是核心执行机制——每个 EtherCAT 周期执行一次所有激活机器的 act() 逻辑。smol 作为轻量级异步运行时。MachineAct trait 定义每台机器的核心接口：`act(&mut self, io: &dyn MachineIO)` 每周期执行一次，`act_machine_message(&mut self, msg: MachineMessage)` 处理异步 API 命令。

**硬件抽象层（EtherCAT HAL + Control Core, Rust + ethercrab-rs）**：基于 ethercrab-rs 实现 EtherCAT 主站功能。负责 PDO 编解码（原始位向量 ↔ 类型化变量）、CoE 配置（CAN over EtherCAT 设备参数设置）、IO trait 抽象。ethercat-hal-derive 提供过程宏自动生成样板代码。

**操作系统层（NixOS + PREEMPT_RT）**：通过 flake.nix 声明式定义完全可复现的实时 Linux 环境，包括内核配置、驱动加载、系统服务等。

### 2.2 ethercat-hal：硬件抽象层架构

ethercat-hal 是 QiTech Control 的技术核心，采用四层抽象设计：

**第一层：PDO 编解码层**。每个 EtherCAT 周期，主站从所有从站读取 PDO 数据——一个包含所有输入/输出的原始位向量。PDO 层将位向量解码为类型化的 Rust 值（bool, u16, f32），以及将输出值编码回位向量。例如 EL2004（4 通道数字输出）的 PDO 包含 4 个位，解码为 4 个独立 bool。关键挑战在于位域的精确处理——每个字段的偏移量和位宽由设备 ESI 文件定义。

**第二层：设备层**。相同或相似 PDO 的设备共享实现。EL2002（2 通道）、EL2004（4 通道）、EL2008（8 通道）都是数字量输出，区别仅在有效位数量。设备实现存储最近一次 PDO 数据和时间戳（对诊断追溯至关重要）。

**第三层：IO Trait 层**。定义 6 种标准 IO trait：

| Trait | 功能 | 典型设备 |
|-------|------|---------|
| DigitalOutputDevice | 数字量输出（开/关） | EL2002/2004/2008, WAGO 750-402/501/502/530 |
| DigitalInputDevice | 数字量输入（高/低） | EL1004/1008, WAGO 750-430 |
| AnalogOutputDevice | 模拟量输出（0-10V/4-20mA） | EL4002/4004, WAGO 750-455/460/553 |
| AnalogInputDevice | 模拟量输入（电压/电流→工程单位） | EL3021/3024, WAGO 750-455 |
| PulseTrainOutputDevice | 脉冲序列输出（步进/伺服） | EL7031, WAGO 750-671/672 |
| EncoderInputDevice | 编码器输入（位置/速度反馈） | EL5101, WAGO 750-1506 |

核心价值：硬件无关性。机器控制逻辑只需操作 DigitalOutputDevice trait，不关心具体是 1×8 通道还是 4×2 通道端子。

**第四层：MachineAct Trait**。机器逻辑的统一接口。关键区别：IO trait 是无状态的 getter/setter，MachineAct 维护内部状态（PID 积分项、状态机状态、生产计数器等）。

### 2.3 控制循环与实时调度

每周期执行流程：
1. EtherCAT 主站（ethercrab-rs）触发周期，通过 DC（Distributed Clock）同步
2. 读取所有从站 PDO 数据
3. ethercat-hal 将 PDO 解码为类型化 IO 值
4. 遍历激活的 MachineAct 实例，调用 act() 计算输出
5. 将结果编码回 PDO 格式
6. EtherCAT 主站写入所有从站

典型周期 1ms。NixOS PREEMPT_RT 内核确保控制循环不被非实时任务中断。

### 2.4 通信架构

**前端-后端**：SocketIO 实时推送（IO 值、状态、报警）+ REST API 写入（参数设置、命令下发）。SocketIO 的双向实时通道 + 自动重连 + room 概念，适合多客户端 HMI。

**后端-硬件**：EtherCAT 主现场总线 + Modbus TCP/RTU 辅助协议（连接 Mitsubishi 变频器、WAGO 电源管理设备）+ Xtrem 协议（特定设备专用通信）。

### 2.5 前端技术栈

Electron + React + Shadcn UI（Radix UI 可访问性组件）+ Tailwind CSS v4 + TanStack Router + Zustand + Immer。标准化的 `<EditValue>` 组件封装读取→显示→写入的完整流程，所有机器 UI 复用此模式。

### 2.6 NixOS 实时 Linux

关键文件：flake.nix（依赖和构建目标）、flake.lock（精确版本锁定）、nixos/（内核参数、驱动、网络配置）、nixos-build-iso.sh（构建可启动 ISO）、nixos-install.sh（自动安装）、nixos-setup.sh（系统初始化）。

NixOS 优势：声明式配置（版本控制）、原子升级回滚、确定性构建（bit-for-bit reproducible）。工程师修改 flake.nix → CI 构建 ISO → 目标 PC USB 启动自动安装。全流程自动化和可复现。

### 2.7 硬件支持

WAGO 750 系列：402（DI）、430（8ch DI）、455（AI）、460（AO）、501/502（DO）、530（8ch DO）、553（AO）、652（串口）、671/672（步进控制器）、1506（编码器）。

Beckhoff EL 系列：2004（4ch DO）、3021（AI）、7031（步进电机）。

其他：Mitsubishi 变频器（Modbus）、WAGO 电源控制器（Modbus TCP）。

### 2.8 ethercat-hal 深度架构分析

ethercat-hal 是 QiTech Control 的技术核心。以下深入分析其技术实现细节：

**Crate 组织结构**：

```
control/
└── crates/
    ├── ethercat-hal/          ← HAL 核心（四层抽象）
    │   ├── src/
    │   │   ├── lib.rs           ← 模块入口，re-export 所有公共接口
    │   │   ├── pdo.rs            ← PDO 编解码层（第一层）
    │   │   ├── device.rs         ← 设备层（第二层）
    │   │   ├── io_traits.rs      ← IO trait 定义（第三层）
    │   │   ├── io_traits_impl/   ← IO trait 的各设备实现
    │   │   ├── machine.rs        ← MachineAct trait 定义（第四层）
    │   │   ├── types.rs          ← 通用类型定义
    │   │   └── error.rs          ← 错误类型
    │   └── Cargo.toml
    ├── ethercat-hal-derive/      ← 过程宏（自动生成 IO trait 实现）
    ├── control-core/             ← 控制循环核心
    │   ├── src/
    │   │   ├── cycle.rs          ← 控制循环调度
    │   │   ├── scheduler.rs      ← 线程调度与优先级管理
    │   │   └── realtime.rs       ← PREEMPT_RT 集成
    │   └── Cargo.toml
    ├── server/                   ← axum HTTP + SocketIO 服务器
    └── ui/                       ← Electron + React 前端
```

### 2.9 PDO 编解码层详解

PDO（Process Data Object，过程数据对象）是 EtherCAT 的数据传输核心。每个 EtherCAT 周期，主站与所有从站交换 PDO 数据——一个连续的位向量（byte slice）。

**PDO 映射表（Mapping）**：

每个设备由 EtherCAT Slave Information (ESI) XML 文件描述其 PDO 布局。ethercat-hal 解析 ESI 文件或硬编码映射表（Rust struct），将位域映射为类型化字段：

```rust
// EL2004 数字量输出 (4 通道) PDO 映射示例
// ESI XML 中定义的 PDO: Output_1 (bit 0), Output_2 (bit 1), Output_3 (bit 2), Output_4 (bit 3)
struct El2004Pdo {
    // PDO 原始位向量: [out4][out3][out2][out1][0][0][0][0]
    raw: [u8; 1],  // 1 字节
}

impl El2004Pdo {
    // 编码: Rust 类型 → 位向量
    fn encode(ch1: bool, ch2: bool, ch3: bool, ch4: bool) -> [u8; 1] {
        let mut raw = 0u8;
        if ch1 { raw |= 0b0001; }
        if ch2 { raw |= 0b0010; }
        if ch3 { raw |= 0b0100; }
        if ch4 { raw |= 0b1000; }
        [raw]
    }
    // 解码: 位向量 → Rust 类型
    fn decode(raw: &[u8]) -> (bool, bool, bool, bool) {
        let byte = raw[0];
        (
            (byte & 0b0001) != 0,  // 通道 1
            (byte & 0b0010) != 0,  // 通道 2
            (byte & 0b0100) != 0,  // 通道 3
            (byte & 0b1000) != 0,  // 通道 4
        )
    }
}
```

**模拟量 PDO 映射示例 (EL3021, 16 位 ADC)**：

```rust
struct El3021Pdo {
    raw: [u8; 2],  // 2 字节 = 16 位 ADC 值
}

impl El3021Pdo {
    fn encode(value: f32) -> [u8; 2] {
        // 工程值 → ADC 编码
        let adc = ((value + 10.0) / 20.0 * 65535.0) as u16;  // 4-20mA → 0-65535
        u16::to_le_bytes(adc)
    }
    fn decode(raw: &[u8]) -> f32 {
        let adc = u16::from_le_bytes([raw[0], raw[1]]);
        (adc as f32 / 65535.0 * 20.0) - 10.0  // 0-65535 → 4-20mA 工程单位
    }
}
```

### 2.10 CoE (CAN over EtherCAT) 与 SDO 配置

PDO 传输周期性过程数据，而 SDO（Service Data Object，服务数据对象）传输非周期性的设备配置参数。CoE 使 EtherCAT 继承 CANopen 的设备配置协议。

**SDO 配置的典型操作**：

1. **读取设备标识**：SDO 上传（Upload）获取设备名称、固件版本、供应商 ID
2. **配置 PDO 映射**：SDO 下载（Download）修改 PDO 映射（选择这个设备传输哪些变量）
3. **配置 CoE 对象字典**：SDO 访问设备的内存对象字典，修改参数（如滤波器时间常数、死区阈值、量程选择）
4. **状态机控制**：通过 CoE 状态机（Init → Pre-Op → Safe-Op → Op）控制设备启动流程

**与 AUDESYS Config Barrier 的对照**：

SDO 配置操作需要在设备启动前（Pre-Op 状态）完成，设备进入 Op 状态后不允许修改 PDO 映射。这与 AUDESYS D17 决策（Config Barrier：配置变更排队到周期边界批量应用）的语义完全一致——配置在"离线"阶段完成，运行时只能通过有限的参数进行微调。

### 2.11 终端抽象模型（Terminal Abstraction）

QiTech 使用 'Terminal'（端子）概念抽象一个 EtherCAT 从站的物理 I/O 点：

```
                               ┌─────────────────┐
                               │   MachineAct    │  ← 第四层: 机器逻辑
                               │   (每周期调用)   │
                               └────────┬────────┘
                                        │ 使用 IO trait
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
              ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
              │DigitalOut │     │ AnalogIn  │     │ EncoderIn │  ← 第三层: IO trait
              │ Device    │     │ Device    │     │ Device    │
              └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
                    │                   │                   │
              ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
              │ EL2004    │     │ EL3021    │     │ EL5101    │  ← 第二层: 设备
              │ (4ch DO)  │     │ (1ch AI)  │     │ (Encoder) │
              └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
                    │                   │                   │
              ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
              │ PDO 编码   │     │ PDO 解码   │     │ PDO 解码   │  ← 第一层: PDO
              │ rust→bits  │     │ bits→f32  │     │ bits→pos  │
              └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
                    └───────────────────┴───────────────────┘
                                        │
                                 EtherCAT Frame
```

**关键设计原则**：
- 每层仅依赖下一层的接口，不跨层访问底层 PDO
- MachineAct 代码完全与物理设备类型无关——今天用 EL2004（4 通道 DO），明天可替换为 WAGO 750-530（8 通道 DO），不修改任何控制逻辑代码
- 设备层负责 PDO 类型转换和 CoE 配置（两者都是设备特定的），IO trait 层负责语义抽象

### 2.12 control-core: 控制执行引擎

control-core crate 实现了 QiTech 的实时控制循环。这是 QiTech 版本的 "RT thread"（对应 AUDESYS D13 决策中的 RT 线程）：

**控制循环的精确时序**（1ms 周期为例）：

```
0μs: EtherCAT 主站触发 DC 同步（Distributed Clock，分布式时钟）
   │
10μs: 读取所有从站 PDO 数据（通过 EtherCAT 帧携带）
   │
20μs: ethercat-hal 解码所有 PDO → 类型化 Rust IO 值
   │
30μs: 遍历所有激活的 MachineAct，依次调用 act(&mut self, io: &dyn MachineIO)
   │     ├── Machine A: PID 计算 + 输出计算 (100μs)
   │     ├── Machine B: 状态机推进 + 输出计算 (50μs)
   │     └── Machine C: 数据记录 + Modbus 变频器通信 (200μs)
   │
500μs: 所有 MachineAct 执行完毕，计算结果编码回 PDO 格式
   │
510μs: EtherCAT 主站写入所有从站 PDO
   │
520μs: 空隙时间（CPU idle，可被非实时任务使用）
   │
1ms:  下一周期 DC 同步触发
```

**线程调度与优先级管理**：

| 任务 | 优先级 | 核心亲和性 | 说明 |
|------|--------|----------|------|
| EtherCAT 主站循环 | SCHED_FIFO 99 | CPU 0 | 最高优先级，确保确定性 |
| ethercat-hal 编解码 | SCHED_FIFO 98 | CPU 0 | 与主站同核心，减少缓存失效 |
| MachineAct 执行 | SCHED_FIFO 97-90 | CPU 0-1 | 按机器重要性分配优先级 |
| Modbus 通信 | SCHED_FIFO 50 | CPU 2 | 辅助协议，低于控制循环 |
| TCP/SocketIO 服务 | SCHED_OTHER | CPU 2-3 | 非实时通信 |
| HTTP/REST API | SCHED_OTHER | CPU 3 | Web 服务 |

**看门狗（Watchdog）监测**：
- 控制循环超时检测：如果 act() 执行总时间超过 500μs（到达下一周期数据写入时间点），触发看门狗
- 单个 MachineAct 超时：如果某个机器的 act() 超过 300μs，发出告警但继续执行（不阻塞其他机器）
- PDO 通信失败：如果 EtherCAT 主站连续 N 个周期读取失败，触发紧急停止

### 2.13 NixOS 实时配置详解

QiTech 的 NixOS 配置是其竞争力的重要组成部分——它使实时 Linux 环境的部署可复现和可版本控制：

**内核配置示例**（从 flake.nix 中提取的核心部分）：

```nix
# flake.nix 中的内核配置
boot.kernelPackages = pkgs.linuxPackages_rt;  # PREEMPT_RT 内核
boot.kernelParams = [
  "isolcpus=0,1"  # 隔离 CPU 0 和 1 用于实时任务
  "nohz_full=0,1"  # 无滴答模式（减少定时器中断对 CPU 0/1 的干扰）
  "rcu_nocbs=0,1"  # 不在 CPU 0/1 上运行 RCU 回调
  "irqaffinity=2-3"  # 将所有非实时 IRQ 绑定到 CPU 2-3
  "processor.max_cstate=1"  # 限制 CPU 休眠深度（减少唤醒延迟）
  "intel_idle.max_cstate=0"  # 禁用 Intel CPU 深度休眠
  "amd_idle.max_cstate=1"  # 限制 AMD CPU 休眠深度
  "nosmt"  # 禁用超线程（减少时序不确定性）
];

# 实时优先级配置
security.rtkit.enable = true;

# EtherCAT 网卡驱动（igc for Intel I225/I226 2.5GbE）
boot.kernelModules = [ "igc" ];
```

**NixOS 部署流程**：

```
工程师 PC (flame.nix 修改)
        │
        ▼ (nixos-build-iso.sh)
   CI 构建 ISO (GitHub Actions)
        │
        ▼ (USB 写入)
   目标工业 PC (USB 启动)
        │
        ▼ (nixos-install.sh)
   自动安装到本地 SSD
        │
        ▼ (nixos-setup.sh)
   系统初始化（网络配置、hostname、SSH 密钥）
        │
        ▼ (重启)
   QiTech Control Runtime 启动
```

**NixOS 优势总结**：
1. **环境一致性**：开发机与生产机的内核版本、驱动、库完全一致（bit-for-bit）
2. **版本控制**：flame.nix + flame.lock 纳入 Git，CI 自动验证配置正确性
3. **原子升级回滚**：如果新配置导致问题，一条命令 `nixos-rebuild switch --rollback` 立即回滚
4. **灾难恢复**：ISO 包含完整系统（OS + QiTech Runtime），换新硬盘后 USB 启动即可恢复

### 2.14 设备预设系统（Device Presets）

QiTech 的设备预设系统是生产部署中的重要特性——一份配置文件定义整台机器的 EtherCAT 设备列表和配置参数：

```yaml
# machine_config.yaml 示例
machine_name: ExtruderLine1
ethercat_devices:
  - name: main_extruder_motor
    position: Auto  # 自动分配槽位
    preset_name: Wago750_671_stepper
    # 自动加载预设的 CoE 配置参数
    
  - name: heater1_zone1
    position: Auto
    preset_name: Wago750_455_AI_4_20mA
    scaling:
      raw_min: 0
      raw_max: 32767
      engineering_min: 0.0     # 4mA 对应 0°C
      engineering_max: 300.0    # 20mA 对应 300°C
      
  - name: cooling_fan
    position: 3
    preset_name: Wago750_501_DO

modbus_devices:
  - name: frequency_drive
    ip: 192.168.1.50
    device_type: Mitsubishi_FR_A800

machine_act: ExtruderLine1Act  # 绑定的 MachineAct 实现
cycle_rate_ms: 1  # 控制周期
```

设备预设的核心价值：
- 换硬件端子不需要改代码（从 WAGO 换成 Beckhoff 只需改 yaml）
- 复制整台机器只需修改 `machine_name` 和 IP 地址
- CI 可自动静态验证配置文件的完整性（所有引用的 preset_name 是否在预设库中存在）
---

## 3. 功能概览

### 3.1 核心能力矩阵

| 能力 | 状态 | 说明 |
|------|------|------|
| EtherCAT 主站（DC 同步） | 生产级 | ethercrab-rs, 1ms 周期 |
| PDO 编解码 (bit↔typed) | 生产级 | 自动类型转换 |
| CoE 设备配置 | 生产级 | CAN over EtherCAT 参数 |
| 6 种 IO trait | 生产级 | 硬件无关控制逻辑 |
| MachineAct 调度 | 生产级 | per-cycle act() + message |
| React UI | 生产级 | Shadcn UI + Tailwind + SocketIO |
| REST API | 生产级 | axum + 完整文档 |
| Modbus TCP/RTU | 生产级 | 辅助协议 |
| NixOS 实时 Linux | 生产级 | 声明式 + 可复现 |
| 多机器支持 | 生产级 | 一台控制器多台独立机器 |
| 设备预设系统 | 生产级 | 快速切换配置 |

### 3.2 生产机器目录

10+ 台机器：丝材挤出、卷绕（多轴同步+张力控制）、测量（高精度采集）、材料处理、激光（精密定位+功率控制）、瓶盖检测（AI 视觉集成）。

---

## 4. 现状与生态

Stars 319 | Forks 33 | Commits 2,516 | Contributors 30+ | Releases 22 (v3.0.0-rc2) | Open Issues 33 | Open PRs 5。

59 页 Wiki 文档 + YouTube 视频教程。LGPL-3.0 许可证。团队协作模式（vs truST 单人）。

---

## 5. 市场定位

目标：机器制造（OEM 定制控制）、材料加工、测试测量、智能制造。优势：生产验证、全栈 Rust+TS、模块化 HAL、NixOS 可复现、广泛硬件支持。风险：LGPL-3.0 商业限制、仅 EtherCAT、Electron 非 Web 原生。

---

## 6. 产品特色

ethercat-hal 四层抽象（PDO→Device→IO Trait→MachineAct）是核心创新。NixOS 声明式实时环境使系统环境可版本控制。模块化机器架构（每台机器独立 MachineAct + 共享基础设施）。标准化 UI 组件（`<EditValue>` + SocketIO）。

---

## 7. 对 AUDESYS 的参考价值

### 7.1 ethercat-hal 抽象模型 (⭐⭐⭐⭐⭐)

ethercat-hal 是 AUDESYS HAL 设计的最直接参考：
- PDO 编解码 ↔ HAL 类型系统序列化/反序列化层
- IO trait ↔ HAL 组件接口模型 (component.interface.name)
- CoE 配置 ↔ Config Barrier 机制
- 设备时间戳 ↔ HalQoS deadline 监控
- 设备识别 ↔ HalDiscovery 注册

### 7.2 实时 Linux 集成 (⭐⭐⭐⭐)

NixOS+PREEMPT_RT 经验：实际循环时间、抖动特性、硬件兼容性数据。AUDESYS Phase 1 PREEMPT_RT 部署直接可参考。

### 7.3 生产部署模式 (⭐⭐⭐⭐⭐)

10+ 机器真实工厂运行验证 Rust 工业控制可行性。NixOS ISO→安装→运行的部署流程为 AUDESYS 提供成熟模板。

### 7.4 前端通信模式 (⭐⭐⭐⭐)

SocketIO 实时 + REST 写入可直接用于 AUDESYS HMI 架构。

### 7.5 对 HAL 协议设计的具体启示

| QiTech ethercat-hal | AUDESYS HAL 启示 |
|-------------------|-----------------|
| PDO bit→typed 编解码 | 14 种类型的序列化层 |
| 6 种 IO trait | Signal 读写方向分类 |
| CoE per-device 配置 | Config Barrier + LockLevel (D17) |
| 设备识别 | HalDiscovery 注册与发现 |
| MachineAct per-cycle | 四系统混合线程调度 (D13) |
| 时间戳存储 | HalQoS deadline 监控 (D16) |

### 7.6 总结

QiTech Control 在 HAL 设计和生产部署方面为 AUDESYS 提供最高价值的参考。ethercat-hal 的多层抽象模型直接验证了 AUDESYS HAL 设计理念。10+ 台生产机器为 Rust 工业控制提供可信的技术可行性证明。

### 7.7 QiTech ethercat-hal vs AUDESYS HAL 详细架构对比

| 维度 | QiTech ethercat-hal | AUDESYS HAL | 分析 |
|------|-------------------|------------|------|
| 第一层: 数据编解码 | PDO bit-typed Rust | FlatBuffers 14 种类型序列化 | AUDESYS 更通用——不绑定 EtherCAT |
| 第二层: 设备抽象 | 设备层 (EL2004, WAGO 750...) | 组件模型 (component.interface) | QiTech 设备与硬件 1:1 |
| 第三层: IO 接口 | 6 种 IO trait | Signal 原语 (单写多读) | QiTech 更向物理 IO, AUDESYS Signal 更通用 |
| 第四层: 业务逻辑 | MachineAct trait | FUNCTION_BLOCK + RT 线程 | MachineAct 函数式, FB 是 IEC 标准模型 |
| 配置管理 | device-presets YAML + CoE | Config Barrier (YAML/JSON) | QiTech 更贴近硬件部署 |
| 硬件发现 | 手动 YAML 列出设备 | HalDiscovery trait (动态) | AUDESYS 更灵活 |

**PDO 编码 vs Signal 原语**：

QiTech 的 PDO 编解码是设备特定的位域映射（偏移量+位宽由 ESI 文件定义），AUDESYS 的 Signal 是独立 Pin 值通过 FlatBuffers 序列化。两者在不同层次上解决类似问题：
- PDO 保证整个帧的原子性（同一个 EtherCAT 周期），AUDESYS 需要通过 Config Barrier (D17) 保证批量配置一致性
- QiTech 编解码手写 per-device，AUDESYS 通过 FlatBuffers schema 自动生成
- QiTech 错误检测靠 EtherCAT CRC，AUDESYS 靠 FlatBuffers 内建校验 + HalQoS

**6 IO trait vs Signal 分类**：

| QiTech IO trait | 方向 | Signal 映射 |
|----------------|------|-----------|
| DigitalOutputDevice | Write | Signal.Write<Bool> |
| DigitalInputDevice | Read | Signal.Read<Bool> |
| AnalogOutputDevice | Write | Signal.Write<F32> |
| AnalogInputDevice | Read | Signal.Read<F32> |
| PulseTrainOutputDevice | Write | Signal.Write<U32> + 元数据 |
| EncoderInputDevice | Read | Signal.Read<S64> + 元数据 |

**MachineAct vs FUNCTION_BLOCK**：

| 维度 | QiTech MachineAct | AUDESYS FB |
|------|------------------|----------|
| 周期接口 | act(&mut self, io: &dyn MachineIO) | 标准 FB 方法 |
| 异步消息 | act_machine_message(&mut self, msg) | RPC 调用 |
| 多实例 | 手动管理 MachineManager | 声明式实例化 |
| 状态 | Rust struct 字段 | FB 内部 VAR 变量 |
| 调度 | 所有机器同一循环调用 act() | 按任务周期分配 RT 线程组 |

### 7.8 NixOS 部署参考

QiTech NixOS 方案的 AUDESYS 采纳建议：

| QiTech NixOS | AUDESYS 采纳 |
|-------------|------------|
| flake.nix 声明式配置 | 直接采纳——定义内核、驱动、包依赖 |
| CPU 隔离 (isolcpus, nohz_full) | 直接采纳——PREEMPT_RT 最佳实践 |
| IRQ 亲和性 | 直接采纳 |
| nixos-build-iso.sh | 参考——构建 AUDESYS Runtime ISO |
| nixos-install.sh | 参考——自动安装脚本 |
| 原子升级回滚 | 采纳——`nixos-rebuild switch --rollback` |
| flake.lock 版本锁定 | 采纳——确保部署环境一致 |

### 7.9 生产验证的量化价值

| 验证维度 | QiTech 数据 | AUDESYS 参考价值 |
|---------|-----------|----------------|
| 生产机器 | 10+ 台 | Rust 控制系统达到生产级可靠性的证明 |
| 控制周期 | 1ms | PREEMPT_RT 可满足毫秒级实时控制 |
| EtherCAT DC | 同步 + 零丢失 | ethercrab-rs 可用性验证 |
| 团队规模 | 30+ contributors | Rust 工业控制有足够的社区人才 |
| 版本成熟度 | v3.0.0-rc2 | 达到 3.x 成熟度的 Rust 工业项目 |

### 7.10 总结与优先级

| 参考领域 | 重要性 | 关键行动 |
|---------|--------|---------|
| ethercat-hal 四层抽象 | P0 | AUDESYS HAL 组件模型的直接设计参考 |
| NixOS 实时部署 | P0 | 直接采纳核心参数，构建 AUDESYS ISO |
| PDO 编解码 | P0 | 参考位域映射，设计 FlatBuffers 序列化层 |
| IO trait → Signal | P1 | 参考 6 种 IO trait 定义 Signal 分类 |
| MachineAct → FB | P1 | 参考接口设计 RT 线程任务调度 |
| 设备预设系统 | P1 | 参考 YAML 设计 HAL 拓扑配置 |
| CoE SDO → Config Barrier | P1 | 验证 D17 配置面管理模型 |
| SocketIO+REST → Studio | P2 | 参考前端通信设计 HMI 架构 |

---

> **文档版本**：1.0 | **编写日期**：2026-07-13
> **数据源**：https://github.com/qitechgmbh/control (README, Wiki, source tree)
> **状态**：基于 v3.0.0-rc2 (2026-06-29)

### 拓展说明

#### 关于 LGPL-3.0 许可的商业影响

QiTech Control 使用的 LGPL-3.0 许可证在开源工业控制领域有特定的商业影响：

- LGPL-3.0 允许商业使用，但要求：对 QiTech 本身的修改必须开源（以 LGPL-3.0 或 GPL-3.0 发布）。但如果仅通过动态链接使用 QiTech（如调用其库的 API），则不需要开源自有代码
- QiTech 的 crate 结构（独立的 ethercat-hal、control-core、server）允许使用者仅依赖核心库，而不需要开源自有的 MachineAct 实现
- 对 AUDESYS 的启示：如果 AUDESYS 采用 Apache 2.0 许可证（比 LGPL-3.0 更宽松），将消除商业用户对许可证感染的顾虑。Apache 2.0 允许闭源商业使用且不要求衍生作品开源（仅要求保留版权声明和免责声明）

#### 关于 Electron 前端 vs Web 原生

QiTech 选择 Electron（桌面端框架）而非浏览器原生的 Web 技术。这一选择的利弊：
- 优势：可访问系统级资源（文件系统、串口、USB 设备）、不受浏览器安全沙箱限制
- 劣势：桌面端应用需要安装和更新（无法像浏览器 HMI 那样"零安装"访问）、Electron 体积庞大（通常 50-100MB）
- AUDESYS 选择：Phase 1 建议采用 Web 原生（浏览器 HMI），避免 Electron 的安装负担和桌面端维护负担

#### 关于 ethercrab-rs 的技术评估

QiTech 使用 ethercrab-rs（纯 Rust 实现的 EtherCAT 主站）作为底层驱动。对 AUDESYS 的参考：
- ethercrab-rs 证明纯 Rust 可以实现 EtherCAT 主站的完整功能（DC 同步、PDO 编解码、CoE 配置）
- 性能：典型 EtherCAT 周期 1ms（使用 DC 同步），实测抖动 < 50μs（Raspberry Pi 上的 PREEMPT_RT 内核）
- ethercrab-rs 的维护活跃度：GitHub Stars 数百，定期发布。但不如 IgH EtherCAT Master（C 实现、20 年历史）成熟
- AUDESYS 如果未来需要支持 EtherCAT，可评估 ethercrab-rs 或通过 FFI 桥接 IgH EtherCAT Master

#### QiTech 与 truST 的互补关系

| 维度 | QiTech Control | truST Platform | 互补分析 |
|------|---------------|---------------|---------|
| 核心关注 | 硬件抽象层 (ethercat-hal) + 生产部署 | 编译管线 + IDE + 语言服务器 | QiTech 侧重运行时硬件集成，truST 侧重开发体验 |
| 硬件支持 | EtherCAT + WAGO/Beckhoff（物理硬件为主）| ADS/TwinCAT（软件协议为主）| QiTech 面向真实 I/O，truST 面向软件运行时 |
| 目标用户 | 机器制造商 (OEM) + 系统集成商 | 控制工程师 + Rust 开发者 | QiTech 更偏生产，truST 更偏开发 |
| 部署方式 | NixOS ISO 安装到物理 PC | 预编译二进制 + Docker | QiTech 与 OS 紧耦合，truST 更通用 |
| 社区规模 | 319 Stars, 30+ contributors | 204 Stars, 1 core maintainer | QiTech 有更大团队和更多贡献者 |

AUDESYS 可以同时借鉴两者的优点：truST 的 IDE 和编译管线设计 + QiTech 的 HAL 抽象和生产部署方案。

#### 关于生产机器的实际可靠性数据

QiTech GmbH 的 YouTube 频道公开了一些生产机器的运行数据（需注意这是厂商自我报告的数据，非独立第三方审计）：
- 丝材挤出机器：连续运行 6 个月无控制系统重启
- 卷绕机：1ms 周期下运行数万小时无控制逻辑崩溃
- 激光设备：位置控制精度达到亚毫米级（机械精度大于控制精度）
- 所有机器使用相同的 EtherCAT 周期（1ms），证明了控制软件（而非硬件）的统一性

这些数据为 Rust 工业控制平台的可信度提供了有力支撑。AUDESYS 可以引用这些数据作为 Rust 技术栈在工业控制领域可行性的辅助证据（但需要明确标注数据来源为厂商自我报告）。

#### QiTech Rust 依赖分析

| 依赖库 | 用途 |
|--------|------|
| ethercrab-rs | EtherCAT 主站核心 |
| smol | 轻量级异步运行时 |
| axum | HTTP REST API |
| SocketIO (rust-socketio) | 前端实时推送 |
| serde + serde_json | 序列化/YAML/JSON |
| rust-modbus | Modbus TCP/RTU |
| log + env_logger | 生产日志 |

#### QiTech CI/CD 模式

PR 检查 (fmt/clippy/test) → nightly 构建 → Release 二进制 + NixOS ISO → Docker 镜像。AUDESYS Phase 1 应建立同等多层 CI 流水线。

#### QiTech 与商业 PLC 的共存

QiTech 的务实定位：不是替代所有 PLC，而是在深度定制场景中替代专有 PLC。新老系统通过 Modbus/EtherCAT 互联。AUDESYS Simulator 可成为传统 DCS 的数字孪生，而非要求完全替换。

#### QiTech 未来路线图（推测）

- v3.0 正式版（2026 下半年）
- v3.1+：更多 EtherCAT 从站 (B&R, Siemens ET200)
- 浏览器 HMI 替代 Electron
- OPC UA Server 集成
- Profinet / EtherNet/IP 辅助协议支持

#### QiTech 与 AUDESYS 的互补合作关系

QiTech 和 AUDESYS 不是竞争关系——它们解决的问题不同：
- QiTech 解决：如何用 Rust 构建生产就绪的 EtherCAT 控制系统
- AUDESYS 解决：如何构建通用的工业控制仿真和开发平台

QiTech 的 ethercat-hal 可以成为 AUDESYS Simulator 的一个设备仿真驱动（EtherCAT 设备模型），使 Simulator 能够模拟真实的 WAGO/Beckhoff 设备行为。反之，AUDESYS 的 Studio IDE 可以为 QiTech 用户提供更好的 IEC 61131-3 编辑和仿真体验。两个项目的技术栈高度兼容（均为 Rust），协作的摩擦成本极低。

#### 对 AUDESYS 的最终建议

从 QiTech Control 的深度分析中得出的最关键启示：
1. HAL 抽象必须是多层的——直接从应用逻辑跳到硬件寄存器的"扁平 HAL"不可行。QiTech 的四层抽象（PDO→Device→IO Trait→MachineAct）验证了多层次的必要性
2. 生产部署的可靠性需要通过实际机器运行来证明——QiTech 的 10+ 台机器比任何基准测试都更有说服力
3. 实时 Linux 的部署需要一个可复现的系统配置方案——NixOS 是目前最成熟的方案，AUDESYS 应从 Phase 1 就规划 NixOS 集成
4. 设备配置应该声明式（YAML/JSON）而非代码式——QiTech 的设备预设系统直接验证了这一原则
5. 不要尝试替代所有现有系统——共存策略比"全栈替代"更务实且更容易被客户接受

#### QiTech 与 AUDESYS 关键技术选型对照总结

| 技术维度 | QiTech 实现 | AUDESYS 映射 | 验证程度 |
|---------|-----------|-------------|---------|
| 全栈 Rust | 59.4% Rust | 100% Rust (D19) | 已验证 |
| EtherCAT 主站 | ethercrab-rs | amw_ethercat transport (未来) | 已验证 |
| HAL 抽象 | PDO→Device→IO Trait→MachineAct | component.interface + Signal/StreamChannel/RPC | 已验证 |
| PREEMPT_RT | NixOS + SCHED_FIFO | 四系统混合线程 (D13) | 已验证 |
| 生产部署 | 10+ 台机器, NixOS ISO | Phase 2+ 部署规划 | 已验证 |
| 设备配置 | device-presets YAML | Config Barrier (D17) | 已验证 |
| 前端通信 | SocketIO + REST | Studio HMI | 已验证 |
| 多协议 | EtherCAT + Modbus + Xtrem | amw transport trait 可插拔 | 已验证 |
| 浏览器 HMI | Electron (计划迁移 Web) | Web 原生 HMI | 部分验证 |
| OPC UA | 计划中 | 规划 OPC UA Gateway | 未验证 |
| 仿真器 | 无 | AVD Manager | 未验证 |

QiTech 为 AUDESYS 验证了 HAL 抽象、PREEMPT_RT 部署、设备配置管理和多协议支持四大核心技术假设。特别是在 HAL 抽象的生产级实现方面，QiTech 提供了目前唯一经过生产验证的 Rust 参考。

#### 文档维护说明

本文档基于 QiTech Control v3.0.0-rc2 (2026-06-29) 编写。QiTech 由 QiTech GmbH 团队持续开发，部分技术细节可能在后续版本中发生变化。建议在 v3.0 正式版发布后更新本文档。对于关键设计决策（如 ethercat-hal 抽象模型、NixOS 部署方案），应进一步深入 QiTech 源码进行技术审核。

### 附录：QiTech 技术栈完整清单

| Crate/Module | 功能 | 代码行数 (推测) |
|-------------|------|---------------|
| ethercat-hal | 四层抽象核心 | 5,000-8,000 |
| ethercat-hal-derive | IO trait 过程宏 | 500-1,000 |
| control-core | 控制循环/调度/实时集成 | 3,000-5,000 |
| server | axum HTTP + SocketIO | 2,000-4,000 |
| ui | Electron + React 前端 | 20,000-40,000 (JS/TS) |
| 各种 MachineAct 实现 | 生产机器逻辑 | 10,000-30,000 |

总代码量估算：50,000-100,000 行（Rust + TypeScript）。AUDESYS Phase 1 预期代码量约为 QiTech 的 2-3 倍。

### 附录：QiTech 开发路线图对 AUDESYS 的借鉴

| QiTech 经验 | AUDESYS Phase 1 策略 |
|-----------|--------------------|
| 先构建核心 HAL，再构建具体机器 | 先完善 HAL 协议规范，再实现 Runtime 和 Studio |
| dogfooding（自用产品）是质量保障 | 从 Phase 1 开始就用 AUDESYS 构建内部测试和仿真 |
| NixOS 从项目早期就集成 | Phase 1 启动即规划 NixOS 集成 |
| YouTube 视频提升社区认知 | AUDESYS 可考虑技术博客或视频教程 |
| 59 页 Wiki 作为文档基础 | Phase 1 配套在线文档站点 (MkDocs/Docusaurus) |
| 30+ contributors 团队协作 | Phase 1 建立清晰的 CONTRIBUTING.md 和 issue 模板 |
| 10+ 生产机器作为可信度证明 | Phase 2 寻求首个生产场景的参考用户 |

### 附录：QiTech 对 AUDESYS 设计风险的预警

从 QiTech 的实践中学到的警示信号：
1. LGPL-3.0 许可证可能导致商业用户犹豫——AUDESYS 的 Apache 2.0 许可证是更明智的选择
2. Electron 桌面端的安装负担——AUDESYS 应优先 Web 原生 HMI
3. 仅支持 EtherCAT 限制了硬件选择——AUDESYS amw transport trait 应支持多种现场总线
4. 团队内部机器逻辑代码可能紧耦合到 EtherCAT 细节——AUDESYS 的 HAL 必须严格隔离控制逻辑和硬件细节
5. 产品预设系统虽然方便，但过多预设会膨胀维护负担——AUDESYS 预设库应做最小集，鼓励社区贡献扩展

### 附录：QiTech 项目管理对 AUDESYS 的启示

| 管理维度 | QiTech 实践 | AUDESYS 策略 |
|---------|-----------|------------|
| 版本策略 | 持续迭代 (v3.0.0-rc2) | 稳定周期 (每 2-4 周) |
| CI/CD | GitHub Actions 全自动 | Phase 1 即建立 CI |
| 文档 | 59 页 Wiki + YouTube | MkDocs/Docusaurus 文档站点 |
| 社区 | GitHub Issues + PRs | GitHub Org + Discord |
| 团队 | 30+ contributors | Phase 1 目标 3-5 核心开发者 |
| 商业化 | Dogfooding (自用产品) | 开源优先，不排除未来的 SaaS 模式 |
| 质量保障 | 10+ 台生产机器 | 测试套件 + 仿真验证 (Phase 1) |
| 许可证 | LGPL-3.0 | Apache 2.0 (更宽松) |

### 附录：QiTech YouTube 频道资料清单

QiTech GmbH 的 YouTube 频道提供了丰富的技术展示和开发过程视频：
- Day in the Software Team 系列：展示日常开发流程和工具使用
- First Client 系列：首个客户项目的技术实现细节
- Steelworks Week 系列：在钢铁厂现场部署的实际操作
- EtherCAT 设备配置教程
- NixOS 安装和配置指南

这些视频材料为 AUDESYS 团队理解 Rust 工业控制的实际工作流提供了直观参考。

### 附录：综合评估总结

### 附录：QiTech 项目参考价值总结矩阵

| 参考维度 | 价值等级 | 可直接采纳 | 需修改后采纳 | 仅参考思路 |
|---------|--------|----------|-----------|----------|
| ethercat-hal 四层抽象 | P0 | — | ✅ 泛化为 HAL 组件模型 | — |
| NixOS 实时部署 | P0 | ✅ 核心配置参数 | ✅ 构建 ISO/自动化脚本 | — |
| PDO 编解码 | P0 | — | ✅ 通用化为 FlatBuffers | — |
| IO trait 分类 | P1 | — | ✅ 映射为 Signal 读写方向 | — |
| MachineAct 模型 | P1 | — | ✅ 映射为 FUNCTION_BLOCK | — |
| 设备预设系统 | P1 | — | ✅ 参考设计 HAL 拓扑 YAML | — |
| CoE SDO 配置 | P1 | — | ✅ 验证 D17 Config Barrier | — |
| SocketIO + REST | P2 | — | ✅ Studio 通信模式参考 | — |
| 生产部署数据 | P0 | ✅ 作为 Rust 可信度证据 | — | — |
| Dogfooding 实践 | P1 | — | ✅ AUDESYS 自用仿真 | — |
| 团队协作模式 | P2 | — | — | ✅ 参考 30+ 人团队实践 |

### 附录：QiTech 项目最终评估

QiTech Control 在 HAL 抽象层设计和生产部署方面为 AUDESYS 提供最高价值参考。其核心创新 ethercat-hal 的四层抽象模型、NixOS 声明式实时部署方案、10+ 生产机器的可信度证明，三大支柱使 QiTech 成为 AUDESYS HAL 设计的首选参考。建议 AUDESYS 团队深入研读 QiTech 的 ethercat-hal 源码和 NixOS 配置（flake.nix），将其作为 AUDESYS HAL 组件模型和实时部署方案的直接参考模板。与 truST Platform 的 IDE/编译管线优势形成互补——truST 指导 AUDESYS Studio 和编译器设计，QiTech 指导 AUDESYS HAL 和部署方案。

---

> **文档版本**：1.0 | **编写日期**：2026-07-13
> **数据源**：https://github.com/qitechgmbh/control (README, Wiki, source tree, YouTube), https://github.com/johannesPettersson80/trust-platform
> **状态**：QiTech v3.0.0-rc2 (2026-06-29) | truST v0.24.32 (2026-07-11) | OPC UA 1.05 (2022)

QiTech Control 是 AUDESYS 目前发现的 HAL 抽象层设计和生产部署方面价值最高的参考项目。其核心创新 ethercat-hal 的多层抽象（PDO→Device→IO Trait→MachineAct）直接验证了 AUDESYS HAL 设计中"多层次抽象"的必要性。NixOS 声明式部署方案为 AUDESYS 提供了一键可复现的实时 Linux 环境模板。10+ 台生产机器的运行数据为 Rust 工业控制提供了有力的可信度支撑。AUDESYS 应深度借鉴 QiTech 的 HAL 抽象模型和 NixOS 部署方案，同时在许可证、前端技术栈、多协议支持方面做出差异化选择。

> 完整参考系列：truST Platform | QiTech Control (本文档) | OPC UA | NI LabVIEW

> 本文档记录了 AUDESYS 团队对 QiTech Control 的全面技术评估。评估时间 2026-07-13，基于 QiTech v3.0.0-rc2。

> **主要参考来源**：QiTech GitHub 仓库 (README, Wiki, source tree), QiTech GmbH YouTube 频道, QiTech NixOS 配置文件, ethercrab-rs 文档

> QiTech 与 truST 是 AUDESYS 参考体系中最核心的两个互补项目：truST 验证了 IDE/编译管线/全栈 Rust 的可行性，QiTech 验证了 HAL 抽象层/生产部署/NixOS 实时环境的可行性。建议 AUDESYS 团队结合两者优势，构建完整的工业控制仿真与开发平台。

> 本文档将持续更新以反映 QiTech Control 和 truST Platform 项目的迭代发展。建议每季度审查一次以确保内容时效性。

> 在 AUDESYS 参考体系中的评估排名：

> 1. truST Platform (⭐⭐⭐⭐⭐) — IDE/编译管线/全栈 Rust 验证
  > 2. QiTech Control (⭐⭐⭐⭐⭐) — HAL 抽象/生产部署/NixOS 集成
  > 3. OPC UA (⭐⭐⭐⭐⭐) — 信息建模/安全模型/对外互操作
  > 4. NI LabVIEW (⭐⭐⭐⭐) — 图形化编程范式/硬件抽象模式
  > 5. 中控 SUPCON (⭐⭐⭐⭐) — DCS 通信模型/冗余设计/国产化路线



