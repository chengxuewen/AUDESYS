# CNC 竞品架构评估与 AUDESYS 参考模型

> **文档性质**: AUDESYS CNC 子系统架构参考 — 从 8 个主流 CNC/运动控制系统中提取对 HAL 设计有直接映射关系的架构模式
> **数据来源**: 全部引自 `docs/reference/` 目录下原始竞品分析文档，不包含独立推测数据
> **HAL 决策映射**: 每项架构特征均标注对应 AUDESYS HAL 设计决策编号（D10/D11/D13/D17/D19/D24/D55）
> **生成日期**: 2026-07-19 | **版本**: 1.0

---

## 目录

1. [概述](#1-概述)
2. [LinuxCNC — 经典四层架构与 HAL 信号系统](#2-linuxcnc--经典四层架构与-hal-信号系统)
3. [GRBL — 中断驱动步进与 Bresenham 算法](#3-grbl--中断驱动步进与-bresenham-算法)
4. [Klipper — 分布式 Host/MCU 架构](#4-klipper--分布式-hostmcu-架构)
5. [Marlin — 单芯片 G-code 与紧凑解析器](#5-marlin--单芯片-g-code-与紧凑解析器)
6. [Machinekit — LinuxCNC 分叉与 RTOS 多样性](#6-machinekit--linuxcnc-分叉与-rtos-多样性)
7. [grblHAL — 硬件抽象层驱动模型](#7-grblhal--硬件抽象层驱动模型)
8. [Smoothieware — 事件驱动模块系统](#8-smoothieware--事件驱动模块系统)
9. [TwinCAT CNC — PLC+CNC 统一与 EtherCAT 时钟](#9-twincat-cnc--plccnc-统一与-ethercat-时钟)
10. [架构对比总表](#10-架构对比总表)
11. [AUDESYS CNC 采纳参考模型](#11-audesys-cnc-采纳参考模型)
12. [AUDESYS 差异化定位](#12-audesys-差异化定位)

---

## 1. 概述

### 1.1 分析目的

AUDESYS CNC 子系统（D55）的目标是将 G-code 源码编译为 HAL IR，与现有 IEC 61131-3 编译器共享 HalProgram 后端，实现零 VM 变更。本章通过交叉分析 8 个主流 CNC/运动控制系统，为以下设计决策提供竞品验证：

- **架构分层**：实时控制面与非实时管理面的分离策略（映射 D19 多语言三层架构）
- **通信模型**：组件间数据交换机制 — 共享内存、信号总线、RPC、远程协议（映射 D10 三原语）
- **调度策略**：实时线程的组织与优先级体系（映射 D13 四系统混合调度）
- **配置管理**：开发态与运行态的配置分离（映射 D17 Config Barrier + D24 YAML/FlatBuffers）
- **运动控制管线**：从 G-code 源码到 HAL IR 再到步进脉冲的端到端数据流

### 1.2 评估系统范围

| 系统 | 类型 | 分析重点 |
|------|------|---------|
| LinuxCNC | 开源全功能 CNC | 四层架构、HAL 信号系统、NML 通信、运动学可插拔性 |
| GRBL | 嵌入式 CNC 固件 | 中断驱动步进、Bresenham 算法、规划缓冲区、极简 G-code 解析 |
| Klipper | 分布式 3D 打印固件 | Host/MCU 分离、步进压缩、MCU 协议、Input Shaper |
| Marlin | 单芯片 3D 打印固件 | 紧凑 G-code 解析器、PID 温度控制、编译时配置 |
| Machinekit | LinuxCNC 分叉 | RTAPI 抽象层、instcomp 动态实例化、PRU 步进生成 |
| grblHAL | GRBL 重构 | 核心-驱动分离架构、HAL 接口定义 |
| Smoothieware | 模块化数控固件 | 事件驱动模块系统、配置驱动运动控制管线 |
| TwinCAT CNC | 商业工业 CNC | PLC+CNC 统一调度、EtherCAT 实时总线、多运行时集成 |

### 1.3 分析框架

每个系统的分析遵循统一框架：架构特征提取 → HAL 决策映射 → ADOPT/SKIP/ADAPT 三级判定。

"ADOPT" 表示直接采纳为 AUDESYS 设计模式；"SKIP" 表示因架构方向不兼容、技术栈不同或历史包袱而跳过，并给出替代方案；"ADAPT" 表示采纳核心理念但需根据 AUDESYS 技术栈调整实现方式。

---

## 2. LinuxCNC — 经典四层架构与 HAL 信号系统

### 2.1 架构概览

LinuxCNC 是 AUDESYS 最重要的参考系统 — 其四层架构和 HAL 设计历经 30 年工业验证（NIST EMC 1990s → EMC2 2003 → LinuxCNC 2011 → v2.9.10 2026）：

```
┌──────────────────────────────────────────────┐
│ GUI 层 (Axis/Gmoccapy/QtVCP/Touchy)         │ ← 非实时, Tcl/Tk, GTK, Qt
├──────────────────────────────────────────────┤
│ Task 控制器 (EMCTASK)                        │ ← 非实时
│ G-code 解释器 (RS274NGC) + 任务协调          │   NML 共享内存 IPC
├──────────────┬───────────────────────────────┤
│ Motion (EMCMOT)│ IO (EMCIO)                  │ ← 实时 + 非实时
│ 轨迹规划/PID   │ 主轴/冷却/换刀             │
│ 运动学/SCHED_FIFO │                           │
├──────────────┴───────────────────────────────┤
│ HAL 硬件抽象层                               │ ← 实时, 共享内存
│ Pin + Signal + Component + Function + Thread │
├──────────────────────────────────────────────┤
│ 硬件驱动 (parport/Mesa/EtherCAT/Modbus)     │
└──────────────────────────────────────────────┘
```

### 2.2 HAL 核心概念详细分析

HAL 的"电路板类比"是 CNC 控制领域最优雅的设计抽象：

| HAL 概念 | 电子类比 | 数据结构 | AUDESYS 对应 |
|----------|---------|---------|-------------|
| **Component** | 集成电路 | 链表注册 | HAL 组件注册表 |
| **Pin** | IC 引脚 | `hal_pin_t { type, dir, *d_ptr, name }` | Signal 原语的端点 |
| **Signal** | 导线 | `hal_signal_t { type, *data, readers, name }` | **Signal 原语 (D10)** |
| **Function** | 芯片功能 | 代码块 + 导出接口 | AMW 回调/RT 任务 |
| **Thread** | 时钟信号 | 周期执行的函数列表 | 实时线程调度 (D13) |
| **Parameter** | 可调电阻 | 运行时可读写变量 | HalConfig 参数 |

**关键的 Pin-Signal 连接模型**：

LinuxCNC 的 Pin 是指向 Signal 数据空间的**指针**，实现零拷贝数据交换。当一个输出 Pin 连接到一个 Signal 时，该 Pin 的 `d_ptr` 直接指向 Signal 的 `data` 地址。所有读取该 Signal 的输入 Pin 同样指向该地址。这是一个**单写多读最新值覆盖**模型。

**映射 D10**：这与 AUDESYS Signal 原语的语义完全一致。AUDESYS 在此基础上扩展了三个维度：
1. **类型系统**：4 种 → 14 种（11 标量 + String + Blob + Array<T>）
2. **通信范围**：本机共享内存 → FlatBuffers 序列化 over UDS/Zenoh（跨进程/跨网络）
3. **命名规范**：`component.instance.pin` → `component.interface.name`（D10 约定）

### 2.3 两级实时线程

LinuxCNC 的 `base-thread + servo-thread` 两级模型定义了 CNC 实时控制的经典调度范式：

| 线程 | 典型周期 | 优先级 | 执行内容 |
|------|---------|--------|---------|
| **base-thread** | 25-50μs | 最高 | stepgen 脉冲生成、编码器读取、并口输出 |
| **servo-thread** | 500-1000μs | 中 | motion-command-handler、轨迹规划 (TP)、PID 伺服环、运动学正/逆解算 |
| 用户空间 | 非实时 | 普通 | GUI、I/O 控制、文件操作 |

**映射 D13**：AUDESYS 的三级延迟模型（<1μs RT 数据面 / ~10μs I/O 通信面 / ~100μs 控制面）与 LinuxCNC 的两级模型理念一致，但粒度更细：
- Layer 1 (<1μs): Rust 独占、SCHED_FIFO — 对应 LinuxCNC base-thread
- Layer 2 (~10μs): Rust + C++ FlatBuffers over UDS — 对应 LinuxCNC servo-thread
- Layer 3 (~100μs): 15 种语言 FlatBuffers over Zenoh — 对应 LinuxCNC 用户空间

### 2.4 线程调度中的函数驱动模型

LinuxCNC 的核心设计哲学之一是**函数（Function）是调度的基本单元，而非组件/对象**：

```
# 将多个组件的函数按所需顺序添加到同一线程
addf stepgen.0.make-pulses base-thread
addf encoder.0.read base-thread
addf parport.0.write base-thread

addf motion-command-handler servo-thread
addf motion-controller servo-thread
addf pid.0.do-pid-calcs servo-thread
```

这种设计允许系统集成商精确控制每个函数在哪个线程以什么频率执行，实现了"定义"与"调度"的分离。AUDESYS Runtime 的调度器可参考这个函数级粒度，将不同 HAL 组件的 RT 回调分组到不同优先级的线程中。

### 2.5 NML 通信协议

NML（Neutral Message Language）是 LinuxCNC 非实时层之间的消息传递协议，基于共享内存 IPC：
- GUI ↔ Task ↔ IO 之间通过 NML 传递命令和状态
- 消息类型包括：NML 命令（RCS/ABORT 等）、NML 状态（位置/速度/模式）
- 优先级通道：命令通道（高优先级）和状态通道（低优先级）

**NML 的设计问题**：
- 绑定共享内存，无法跨网络
- 无类型安全（C `void*` 类型擦除）
- 无版本协商机制

### 2.6 可插拔运动学系统

LinuxCNC 的 15+ 可插拔运动学模块通过标准 C 函数接口（`kinematicsForward`/`kinematicsInverse`/`kinematicsType`）实现。支持从三轴直角坐标到六足并联的完整拓扑谱系。通过 `switchkins` 模块支持运行时切换最多 3 种运动学 — 这对 AUDESYS 的多场景仿真具有直接参考价值。

### 2.7 对 AUDESYS 的采纳判定

| 特征 | 判定 | 理由与 AUDESYS 映射 |
|------|------|-------------------|
| **四层架构分离** | **ADOPT** | 管理层↔控制层↔实时层↔硬件层的清晰分层。映射: Studio IDE ↔ Runtime ↔ HAL ↔ 物理层 |
| **HAL Signal 概念** | **ADOPT** | 单写多读最新值 — 直接对应 D10 Signal 原语。AUDESYS 扩展类型系统和跨网络能力 |
| **NML 消息总线** | **SKIP** | 替换为 D10 StreamChannel（多写多读有缓冲队列）+ RPC（请求-响应），语义更明确 |
| **共享内存通信** | **SKIP** | 替换为 D11 amw 抽象层 — FlatBuffers over UDS/Zenoh，不限于本机 |
| **两级实时线程** | **ADAPT** | 概念保留，AUDESYS D13 扩展为三级延迟 + 多类型线程 |
| **函数驱动调度** | **ADOPT** | 函数级粒度调度是 AUDESYS Runtime 调度器的参考设计 |
| **HAL 组件注册表** | **ADOPT** | 150+ 组件的分类体系（运动/信号处理/逻辑/数学/硬件/通信/PLC/UI/工具）是 AUDESYS HAL 组件注册表的组织参考 |
| **halscope/halmeter** | **ADOPT** | 实时信号示波器 + 万用表 — 映射 AUDESYS 工业调试桥的实时观测面板 |
| **可插拔运动学** | **ADOPT (Phase 3+)** | 运动学模块通过标准接口可插拔 — AUDESYS G-code 编译器的运动学组件化 |

---

## 3. GRBL — 中断驱动步进与 Bresenham 算法

### 3.1 架构概览

GRBL 是**资源受限 MCU 上实现实时 CNC 控制的典范** — 在 ATmega328p（32KB Flash、2KB RAM、16MHz）上实现 30kHz 无抖动步进脉冲。其核心设计哲学是**"命令解释与运动执行完全分离"**：

```
应用层 (gcode.c):
  G-code 双遍解析 → 模态组 → 运动模式 (G0/G1/G2/G3)
      ↕
规划层 (planner.c):
  16 块环缓冲 (Ring Buffer) → 两遍重计算 (Reverse + Forward Pass)
  → 梯形加速度曲线
      ↕
执行层 (stepper.c, 中断):
  Bresenham 直线算法 + AMASS 自适应多轴平滑 → 步进脉冲生成
      ↕
协议层 (protocol.c):
  串行通信 (serial.c) → 实时命令 → 9 状态状态机
      ↕
硬件抽象 (cpu_map.h):
  ATmega328p / ATmega2560 / 自定义平台
```

### 3.2 Bresenham 步进算法 — 整数运算的优雅

GRBL 选择 Bresenham 直线算法而非 DDA（数字微分分析器）是基于硬件约束的理性选择：

| 算法 | 运算类型 | MCU 要求 | GRBL 选择原因 |
|------|---------|---------|-------------|
| **Bresenham** | 整数加法/减法 | 无 FPU 即可 | ATmega328p 无硬件浮点单元 |
| **DDA** | 浮点运算 | 需要 FPU | 更平滑但有资源开销 |

**AMASS（Adaptive Multi-Axis Step Smoothing）**是 GRBL 的关键创新 — 通过位移操作增加 Bresenham 分辨率，消除低频多轴锯齿：

| AMASS Level | 位偏移 | ISR 频率倍增 | 适用步频率范围 |
|------------|--------|------------|--------------|
| Level 0 | 0 | x1 | >20kHz |
| Level 1 | 1 bit | x2 | 5-20kHz |
| Level 2 | 2 bits | x4 | 0-5kHz |
| Level 3 | 3 bits | x8 | 极低频 |

### 3.3 运动规划缓冲区

GRBL 的**16 块环缓冲 + 两遍重计算**是紧凑前瞻规划的经典实现：

- **Reverse Pass**（逆向遍历）：从最后块到第一块，计算每块的最大入口速度（受出口速度约束）
- **Forward Pass**（正向遍历）：从第一块到最后块，确保加速不超过能力
- **梯形剖面**：`accelerate_steps → plateau_steps → decelerate_steps`

### 3.4 9 状态状态机

GRBL 的 9 状态状态机（IDLE → QUEUED → CYCLE → HOLD → HOMING → ALARM → CHECK_MODE → SAFETY_DOOR → SLEEP）是嵌入式 CNC 状态管理的完整参考。所有状态转换通过 volatile 标志位触发，中断（Reset/Safety Door/Feed Hold）优先级高于循环启动。

### 3.5 对 AUDESYS 的采纳判定

| 特征 | 判定 | 理由与 AUDESYS 映射 |
|------|------|-------------------|
| **中断驱动步进** | **ADOPT (Phase 1)** | 定时器 ISR 驱动的步进脉冲生成 — 映射 AUDESYS RT 数据面的步进组件 |
| **16 块规划缓冲** | **ADOPT** | 前瞻规划缓冲概念 — 映射 D10 StreamChannel 有界队列 |
| **Bresenham/AMASS 算法** | **ADAPT** | 无 FPU 平台用 Bresenham，有 FPU 平台用 DDA。AUDESYS HAL 步进组件库提供算法选项 |
| **CPU 映射系统 (cpu_map.h)** | **ADOPT** | 硬件无关引脚映射 — AUDESYS HAL 驱动平台适配的参考模式 |
| **实时命令 volatile 标志位** | **ADAPT** | 概念映射到 D10 RPC 原语 — 控制命令通过低延迟 RPC 通道 |
| **系统状态机** | **ADOPT** | 9 状态模型是 Runtime Engine 运动状态管理的参考 |
| **直接 GPIO 切换** | **SKIP** | 替换为 D10 Signal 传输 — 步进事件标准化为 HAL 信号 |
| **8 位 AVR 目标** | **SKIP** | AUDESYS 最低硬件基线为 32 位 ARM（匹配 D19 多语言策略） |
| **EEPROM 配置** | **ADAPT** | 掉电保持的概念保留 — 映射 D17 Config Barrier 的持久化层 |

---

## 4. Klipper — 分布式 Host/MCU 架构

### 4.1 架构概览

Klipper 是 AUDESYS Studio ↔ Controller 两层模型最接近的竞品参考。其核心创新是**"上位机计算，下位机执行"**的分布式架构：

```
Tier 1: Host (Raspberry Pi, Python + C helpers)
  klippy.py:
    G-code 解析 (gcode.py) → 前瞻规划 (toolhead.py)
    → 运动学 (kin_cartesian.py) → Input Shaper (input_shaper.py)
  C helper (chelper/):
    itersolve.c (步进时间求解) → trapq.c (梯形速度队列)
    → stepcompress.c (步进压缩) → steppersync.c (多 MCU 同步)

    ↕ Klipper MCU Protocol (USB/Serial/CAN/SPI)
    ↕ 二进制消息块: Header(2B) + Seq(1B) + Content(VLQ) + CRC16(2B) + Sync(0x7E)

Tier 2: MCU (AVR/STM32/RP2040/ESP32...)
  命令调度 (command.c) → 定时调度 (sched.c)
  → 步进执行 (stepper.c): gpio_out_toggle_noirq() 精确切换

Tier 3: 生态层
  Moonraker (JSON-RPC API) → Mainsail/Fluidd (Vue.js/React Web UI)
```

### 4.2 MCU 协议 — Data Dictionary 机制

Klipper MCU 协议的核心创新是**动态数据字典**（Data Dictionary）— MCU 构建时自动收集所有 `DECL_COMMAND()` 和 `sendf()` 宏声明的命令/响应描述，zlib 压缩为 JSON 字符串存储在 MCU Flash。Host 连接时通过 `identify` command 分块下载、解压、解析字典，用字典编码所有后续命令。

**映射 D11 (HalDiscovery)**：Data Dictionary 的概念直接映射到 AUDESYS HalDiscovery 的设备类型描述机制。区别在于：Klipper 的字典在编译时生成、MCU Flash 存储；AUDESYS 的 HalDiscovery 可以支持运行时动态发现和注册。

### 4.3 步进压缩 — 10-50x 带宽优化

`stepcompress.c` 将连续步进时间序列压缩为 `(interval, count, add)` 三参数格式：
- **interval**: 步进脉冲间隔（时钟滴答数）
- **count**: 步数
- **add**: 每步间隔的增量调整（实现加速/减速，采用二次拟合）

一个 `queue_step` 命令可编码数百至上千次步进脉冲。未压缩的原始步进流约 20-50KB/s，压缩后降至 2-5KB/s。

### 4.4 Input Shaper — 前馈振动抑制

Klipper 的 Input Shaper 是**开环前馈控制**技术在消费级 3D 打印中最成功的应用：
- 6 种 shaper 类型（ZV/MZV/ZVD/EI/2HUMP_EI/3HUMP_EI）
- MZV 是 Klipper 开发者独创的折中方案（n=3, t=0.75×Td）
- ADXL345 加速度计自动测量共振频率（5-133Hz 扫描）
- `SHAPER_CALIBRATE` 命令自动计算最佳 shaper_type + shaper_freq

**映射 AUDESYS HAL Filter Chain**：Klipper "运动学 → Input Shaper → 步进"的链式滤波架构直接启发了 AUDESYS HAL 的 Filter Chain 设计 — 在 Motion Generator → Actuator 之间串联可配置滤波器（Input Shaper / Low-pass / Dead-band）。

### 4.5 多 MCU 时钟同步

Klipper 支持同时连接多个 MCU（CAN 总线/USB），通过 `clocksync.py` 的线性回归模型实现时钟漂移校正。`steppersync.c` 确保多个 MCU 的步进脉冲在精确时间点上对齐 — 所有 MCU 的 step 事件在 Host 侧被协调为同一时间轴。

### 4.6 Jinja2 宏系统

Klipper 的 G-code 宏系统支持 Jinja2 模板引擎 + 变量 + 条件判断，是轻量级脚本引擎的参考实现：
- 修改配置文件后 `RESTART` 立即生效 — 无需编译
- 基于 printer 状态变量的条件判断和循环
- Python 扩展（klippy/extras/）无需 Jinja2 知识即可开发

**映射 AUDESYS Studio IDE 脚本引擎**：D55 CNC 宏系统可参考 Klipper 模式 — 轻量级模板语言 + 预定义控制命令，比完整 IEC 61131-3 更轻量、更易学。

### 4.7 对 AUDESYS 的采纳判定

| 特征 | 判定 | 理由与 AUDESYS 映射 |
|------|------|-------------------|
| **Host/MCU 分布式** | **ADOPT (Phase 2+)** | 直接映射 AUDESYS Studio ↔ Controller 两层项目模型 |
| **Python Host 代码** | **SKIP** | AUDESYS Host 采用 Rust/C++（D19），Python 不进入 RT 路径 |
| **MCU Data Dictionary** | **ADAPT** | 概念映射到 D11 HalDiscovery 的设备类型描述 |
| **步进压缩算法** | **ADOPT** | D10 StreamChannel 批处理/压缩传输 — Phase 2+ 优化方向 |
| **Input Shaper** | **ADOPT** | AUDESYS HAL Filter Chain 设计 — 可串联滤波器架构 |
| **Jinja2 宏系统** | **ADOPT** | Studio IDE 轻量级脚本引擎参考 (D55) |
| **printer.cfg 无编译** | **ADOPT (理念)** | D24 YAML 开发态 + 一次编译 FlatBuffers 的策略内化了此理念 |
| **多 MCU 时钟同步** | **ADOPT (Phase 3+)** | HalQoS 高级特性 — 分布式时钟同步 |

---

## 5. Marlin — 单芯片 G-code 与紧凑解析器

### 5.1 架构概览

Marlin 是**部署最广泛的开源 3D 打印机固件**（16K+ Stars、200+ 种主板），采用轮询式主循环 + 定时器中断 ISR 的单芯片一体式架构。其 G-code 解析器和运动规划器继承自 GRBL，但针对 3D 打印场景增加了温度 PID、自动调平（ABL/UBL/Mesh）、挤出控制、LCD 显示等模块。

### 5.2 G-code 解析器紧凑设计

Marlin 的 G-code 解析器是 GRBL 双遍解析的直接继承，支持 6 种运动学（Cartesian/CoreXY/CoreXZ/Delta/SCARA/Polar/MarkForged）。解析器的紧凑性体现在：所有 G-code 指令的解析在同一个 `gcode.cpp` 文件中完成，通过宏驱动的命令表进行分发。

### 5.3 Configuration.h 编译时配置的教训

Marlin 的 `Configuration.h` 包含 2000+ 配置项，通过条件编译 `#ifdef` 控制功能裁剪。**关键教训**：
- **优势**：零运行时开销、代码裁剪精确
- **劣势**：每次参数修改需重新编译烧录（30 分钟迭代周期）、配置复杂度高、新手易出错

**AUDESYS 应对（D24）**：YAML 开发态（人类可读、Git 友好）+ FlatBuffers 运行时（零拷贝加载、零堆分配），避免 Marlin 的"编译即配置"反模式。核心编译时参数（如 PIN 映射）可类似 Marlin 编译时确定，但运行时参数通过 YAML→FlatBuffers 管道配置。

### 5.4 对 AUDESYS 的采纳判定

| 特征 | 判定 | 理由与 AUDESYS 映射 |
|------|------|-------------------|
| **紧凑 G-code 解析器** | **ADOPT** | 双遍解析 + 模态组设计的紧凑实现 — G-code 编译器的解析器参考
| **PID 温度控制** | **ADOPT (参考)** | 积分限幅、热失控保护、多路并行 — 工业验证的 PID 实现
| **单芯片 MCU 架构** | **SKIP** | AUDESYS D19 分布式平台 — 与单芯片一体式方向不兼容
| **Configuration.h 配置** | **SKIP (教训)** | D24 YAML + FlatBuffers + D17 Config Barrier — 避免"编译即配置" |

---

## 6. Machinekit — LinuxCNC 分叉与 RTOS 多样性

### 6.1 架构概览

Machinekit 2014 年从 LinuxCNC 分叉，核心贡献是**RTAPI 实时抽象层** — 使 HAL 组件无需修改即可运行于 RT-PREEMPT / Xenomai / RTAI 三种实时内核：

```
HAL 组件层 (200+ 组件, API 与 LinuxCNC 兼容)
    ↕ RTAPI 抽象层 (rtapi_init/rtapi_task_new/hal_create_thread/...)
  ┌──────────┬──────────┬──────────┬──────────┐
  │ POSIX    │ RT-      │ Xenomai  │ RTAI     │
  │ (模拟)   │ PREEMPT  │ (用户空间)│ (内核)   │
  └──────────┴──────────┴──────────┴──────────┘
    ↕ 硬件层
  x86 PC  |  BeagleBone (ARM PRU)  |  RPi
```

### 6.2 RTAPI 设计哲学

RTAPI 的核心设计哲学是**"最小够用的实时抽象接口"** — API 函数总数 < 20，典型组件仅需 3-5 个函数调用即可启动：

```c
comp_id = hal_init("my_component");     // 初始化
hal_pin_float_new("my_pin.in", &pin);   // 创建引脚
hal_export_funct("my_func", func, ...);  // 导出函数
// 仅需 3 个函数调用 → 组件启动
```

**映射 D11 (amw)**：RTAPI 的"RTOS 无关"理念与 AUDESYS amw 抽象层的"传输/发现/QoS 实现可替换"在哲学上一致。区别在于抽象层次：RTAPI 抽象的是实时内核调度接口；amw 抽象的是通信中间件传输接口。

### 6.3 instcomp — 运行时动态实例化

instcomp 是 Machinekit 对传统 HAL comp 的重要升级 — 支持运行时按需创建组件实例，而非加载时一次性预分配：

```c
// 运行时创建实例: newinst lowpass lp.1
// 无需预先知道最大实例数
// 动态分配：任意数量、任意时刻
```

**映射 D17 (Config Barrier)**：instcomp 的运行时动态实例化概念直接映射到 D17 — 配置变更通过 Config Barrier 排队到 RT 周期边界批量应用，可包括组件的动态创建/销毁。

### 6.4 PRU 步进生成技术

Machinekit 的 hal_pru_generic 驱动利用 BeagleBone AM335x 的 PRU（可编程实时单元，200MHz、5ns 指令周期）实现硬件级精度的步进脉冲生成 — ARM Cortex-A8 主机负责 HAL 伺服循环（1kHz 位置计算），PRU 负责步进脉冲时序（可达 ~4MHz）。

### 6.5 Machinetalk 远程架构

Machinetalk 是 Machinekit 引入的 WebSocket + Protocol Buffers 远程通信框架，支持手机/平板通过 QtQuickVcp (QML) 前端控制 CNC。验证了"工业实时控制与消费级 UI 分离"的可行性。

### 6.6 项目停滞的教训

Machinekit 从 155 名贡献者到基本停滞（2024 年最后提交），关键教训：

| 教训 | Machinekit 表现 | AUDESYS 应对 |
|------|---------------|-------------|
| **分叉成本** | LinuxCNC 差异 20000+ 提交 | D34: 不依赖分叉，原始设计 |
| **社区分裂** | 贡献者分散到 3 个仓库 | D34: hal-core 驱动并行，减少分裂风险 |
| **维护者疲劳** | 贡献者缩减至个位数 | D43: AI 辅助工具降低维护负担 |
| **平台绑定** | BeagleBone 深度绑定 | D19: 多语言策略确保跨平台 |
| **测试不足** | 缺乏 CI 基础设施 | D30: 三层 QA 从 Phase 0 开始 |

### 6.7 对 AUDESYS 的采纳判定

| 特征 | 判定 | 理由与 AUDESYS 映射 |
|------|------|-------------------|
| **RTAPI RTOS 抽象** | **ADOPT (理念)** | 与 D11 amw 抽象层哲学一致 — 底层实现可替换 |
| **instcomp 动态实例化** | **ADOPT** | 运行时动态创建 — 映射 D17 Config Barrier 的动态配置变更 |
| **Machinetalk 远程 HAL** | **ADAPT** | WebSocket + Protobuf 验证了远程 HAL 可行性。AUDESYS: D19 FlatBuffers + Zenoh |
| **PRU 异构计算** | **ADOPT (Phase 3+)** | FPGA/MCU 协同的参考架构 |
| **项目停滞教训** | **ADOPT (治理)** | D34/D30/D43 共同应对社区可持续性风险 |

---

## 7. grblHAL — 硬件抽象层驱动模型

### 7.1 架构概览

grblHAL 是 GRBL 的现代化重构，核心创新是**核心-驱动分离（Core-Driver Separation）架构** — 通过 `hal_t` 硬件抽象层结构体将核心固件与硬件驱动完全解耦：

```
grblHAL Core (C, 平台无关):
  G-code 解析器 | 运动规划器 | 协议处理器
  任务管理器 | 运动学 | 插件框架 | 系统设置
    ↕ hal_t 接口 (函数指针表)
硬件驱动 (15+ 平台):
  ESP32 | STM32F7xx | STM32H7xx | RP2040 | iMXRT1062 | ...
```

### 7.2 hal_t 结构体 — 函数指针驱动的 HAL

grblHAL 的 `hal_t` 结构体包含约 50+ 个函数指针，覆盖：
- **步进控制**: `stepper.*` 函数族
- **限位/控制**: `limits.*`, `control.*` 
- **冷却/主轴**: `coolant.*`, `spindle.*`
- **探针/端口**: `probe.*`, `port.*`
- **流/定时器/NVS**: `stream.*`, `timer.*`, `nvs.*`
- **工具/RGB/外设**: `tool.*`, `rgb.*`, `periph.*`

驱动开发者只需实现这些函数指针，即可将 grblHAL 部署到新硬件平台。

**映射 D11 (HalTransport trait)**：grblHAL 的 `hal_t` 结构体与 AUDESYS 的 `HalTransport` trait 在抽象模式上一致 — 都是通过接口/函数指针表实现底层实现的可替换性。区别在于 grblHAL 限制在单 MCU 内的硬件驱动抽象，AUDESYS 扩展到跨进程/跨网络的通信传输抽象。

### 7.3 对 AUDESYS 的采纳判定

| 特征 | 判定 | 理由 |
|------|------|------|
| **核心-驱动分离** | **ADOPT** | 直接参考 — AUDESYS HAL 核心 trait 定义与硬件实现分离 |
| **hal_t 函数指针表** | **ADAPT** | Rust trait 替代 C 函数指针表，类型安全 |
| **插件框架** | **ADOPT** | AUDESYS HAL 组件的动态加载/注册机制参考 |

---

## 8. Smoothieware — 事件驱动模块系统

### 8.1 架构概览

Smoothieware 采用**模块化事件驱动架构**，Kernel 作为中央调度器管理模块注册和事件分发：

```
Kernel (中央调度器):
  模块管理 | 事件分发 | 配置管理 | 定时器管理

通信模块: SerialConsole | GcodeDispatch | Network | Player (SD卡)
运动控制: Robot | Planner | Conveyor | Stepper
工具模块: Extruder | TemperatureCtrl | Laser | Spindle
辅助模块: Endstops | ZProbe | Switch | Panel (LCD)
```

### 8.2 运动控制管线

Smoothieware 的运动控制管线是 G-code → 步进的标准参考实现：

```
G-code 输入
  → GcodeDispatch (解析)
  → Robot (运动学反解 + 线段分割)
  → Planner (加速度前瞻 + Block 队列)
  → Conveyor (时序控制 + G-code 执行时机)
  → Stepper (步进信号生成, Timer ISR)
```

### 8.3 V1→V2 架构演变的教训

- V1: 裸机 superloop + 事件总线广播 → 简洁但耦合度高
- V2: FreeRTOS 多任务 + 模块注册表查找 + M-code 类型安全处理器
- 架构巨大差异导致用户升级困难

**AUDESYS 启示**：D22 分阶段编译器策略（RuSTy → HAL IR → 自研，HAL IR 稳定接口）正是为了避免类似 V1→V2 的破坏性架构变更。保持接口稳定性，内部实现可替换。

### 8.4 对 AUDESYS 的采纳判定

| 特征 | 判定 | 理由 |
|------|------|------|
| **运动控制管线** | **ADOPT** | G-code → Robot → Planner → Conveyor → Stepper 管线是 AUDESYS Runtime 运动控制的参考 |
| **事件驱动模块** | **ADAPT** | 事件总线 → D10 三原语（Signal/StreamChannel/RPC）替代广播 |
| **config.txt 配置** | **ADOPT (理念)** | 无编译配置验证了文本配置在工业控制中的可行性 (D24) |
| **V1→V2 升级教训** | **ADOPT (治理)** | 保持接口稳定，内部演进 — D22 策略验证 |

---

## 9. TwinCAT CNC — PLC+CNC 统一与 EtherCAT 时钟

### 9.1 架构概览

TwinCAT 3 自 2011 年发布以来是最成功的商业 PC-based CNC 平台，核心架构是**多运行时统一调度**：

```
TwinCAT XAE (Engineering, VS Shell):
  IEC 61131-3 PLC Editor | NC 配置 | CNC G-code Editor | HMI Designer
  C++ Module Editor | Safety Editor | System Manager
    ↕ ADS 通信协议 (Automation Device Specification)
TwinCAT XAR (Runtime, 实时内核):
  ┌──────────┬──────────┬──────────┬──────────┬──────────┐
  │ PLC      │ NC PTP   │ NC I     │ CNC      │ Safety   │
  │ Runtime  │ Runtime  │ Runtime  │ Runtime  │ Runtime  │
  └──────────┴──────────┴──────────┴──────────┴──────────┘
     ↕ 共享过程映像 (同一 Task 调度, 固定执行顺序)
  EtherCAT Master → 伺服/步进驱动器 (50μs 周期, <1μs 抖动)
```

### 9.2 多运行时统一调度的核心设计

TwinCAT 的最大差异点是**在同一 IPC 上使用同一实时 Task 调度引擎运行多种运行时**：
- **数据同步**: 所有运行时共享同一过程映像，无需数据交换指令
- **周期同步**: 多个运行时可挂载到同一 Task，保证确定性执行顺序
- **统一调试**: Visual Studio 调试器同时调试 PLC 代码和 C++ 模块
- **版本一致性**: TwinCAT Package Manager 统一管理所有运行时版本

例如一台五轴加工中心可同时运行：
- PLC Runtime: 逻辑控制（启动/停止/互锁）
- NC I Runtime: 5 轴插补路径
- CNC Runtime: G-code 解析与路径模拟
- Safety Runtime (TwinSAFE): 监控急停和安全门
- Vision Runtime: 同步检测加工质量
- Analytics Runtime: 记录主轴振动数据

**以上全部在一个 IPC 上运行，一个项目文件中管理。**

**映射 AUDESYS**: TwinCAT 的多运行时统一模型是 AUDESYS "IEC 61131-3 + G-code 双语言同一 Runtime 调度"的产品愿景参考。TwinCAT 证明了"(PLC 逻辑 + CNC 运动控制) 同平台确定性调度"是可行的，且经过了近 30 年（1996-2025）的商业验证。

### 9.3 ADS 通信协议

ADS 是 TwinCAT 系统的统一通信协议，核心特征：
- **消息路由器**: 每个设备有唯一的 AMS Port（PLC=350, NC=500, CNC=600）
- **寻址方式**: (IndexGroup, IndexOffset) 二元组 — 类似 HalDiscovery 的层级化地址
- **服务类型**: Read / Write / ReadWrite / Notification（订阅/推送）
- **传输层**: TCP/IP / UDP / USB / 过程数据映射

**映射 AUDESYS**: ADS 的消息路由 + Read/Write/Notification 模式与 D10 的三原语（Signal=Notification 推送、RPC=Read/Write 请求-响应、StreamChannel=流式传输）有对应关系。AMS Port 的可配置设备标识启发了 HalDiscovery 的地址设计方案。

### 9.4 对 AUDESYS 的采纳判定

| 特征 | 判定 | 理由与 AUDESYS 映射 |
|------|------|-------------------|
| **PLC+CNC 统一** | **ADOPT (产品愿景)** | IEC 61131-3 + G-code 同一 Runtime — 映射 D55 |
| **多运行时统一调度** | **ADOPT (理念)** | 不同运行时挂载同一 Task 调度器 — D13 四系统混合调度的工业验证 |
| **ADS 通信协议** | **ADAPT** | 消息路由模式映射 HalDiscovery 地址设计 |
| **EtherCAT 专有技术** | **SKIP** | AUDESYS 不绑定特定总线协议（D11 amw 传输可替换） |
| **Visual Studio 集成** | **ADOPT (理念)** | "使用成熟 IDE 而非自研"原则 — AUDESYS Studio IDE 同样选择成熟技术栈 |
| **TwinCAT/BSD** | **ADOPT (理念)** | 专用实时操作系统的思路 — AUDESYS 可参考 PREEMPT_RT Linux 作为 RT 面 OS |

---

## 10. 架构对比总表

下表从 12 个设计维度横比 8 个 CNC 系统，标注与 AUDESYS 的兼容度：

| 维度 | LinuxCNC | GRBL | Klipper | Marlin | Machinekit | grblHAL | Smoothieware | TwinCAT CNC | **AUDESYS 策略** |
|------|---------|------|---------|--------|------------|---------|-------------|-------------|-----------------|
| **G-code 解析器** | RS274NGC 完整 | 双遍解析子集 | Python 完整 | 双遍解析子集 | RS274NGC 完整 | 双遍解析子集 | 完整解析 | DIN 66025 | ADOPT GRBL 紧凑模式 + 扩展 (D55) |
| **运动规划器** | 实时 TP 前瞻 | 16 块环缓冲 | Python 前瞻 + C 压缩 | 梯形规划 | 实时 TP 前瞻 | 16 块环缓冲 | 块队列前瞻 | NC 插补器 | ADOPT GRBL 缓冲区 + Klipper 压缩 |
| **实时模型** | PREEMPT_RT | 裸机 ISR | Host (Python) + MCU ISR | 裸机 ISR | RT-PREEMPT/ Xenomai/RTAI | 裸机 ISR | 裸机/FreRTOS | TwinCAT RT 内核 | D13 四系统混合调度 |
| **轴模型** | Joint/Axis (9 轴) | 3 轴硬编码 | 7 种运动学 | 6 种运动学 | Joint/Axis (9 轴) | 3-6 轴 | 多轴 | 多轴插补 | 组件化轴抽象 |
| **归零 (Homing)** | 7 步序列 | 基本循环 | 基本 | 基本 | 7 步序列 | 基本循环 | 基本 | NC 内置 | ADOPT LinuxCNC 归零序列 |
| **现场总线** | Modbus/EtherCAT(有限) | 无 (GPIO) | USB/CAN/SPI | 无 (GPIO) | EtherCAT/Modbus | USB/SPI/Ethernet | USB | EtherCAT (核心) | D11 HalTransport 抽象 |
| **编程语言** | C + Python | C | Python + C | C++ (Arduino) | C + Python | C | C++ | IEC 61131-3 + C++ | D19 Rust 核心 + 分层 |
| **运动学** | 15+ 可插拔模块 | 直角/圆弧 | 7 种 (Python+C) | 6 种 | 可插拔模块 | 直角/圆弧 | 6 种 | NC 内置 | 组件化运动学 |
| **前瞻 (Look-ahead)** | 实时前瞻 | 16 块前瞻 | Python 前瞻队列 | 块队列前瞻 | 实时前瞻 | 16 块前瞻 | 块队列 | NC 内建 | ADOPT GRBL 16 块 + 可扩展 |
| **源代码许可** | GPL-2.0 | GPL-3.0 | GPL-3.0 | GPL-3.0 | GPL-2.0 | GPL-3.0 | GPL-3.0 | 商业闭源 | Apache 2.0 |
| **工业部署** | 改造市场 | Maker/DIY | Maker/高级 DIY | Maker/OEM | 研究/教育 | Maker→轻工业 | Maker/DIY | 工业全线 | 目标工业控制 |
| **AUDESYS 兼容度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

> 兼容度评定标准：⭐⭐⭐⭐⭐ = 架构可直接映射，核心模式 ADOPT | ⭐⭐⭐⭐ = 部分映射，重要模式 ADOPT | ⭐⭐⭐ = 概念可参考，需 ADAPT | ⭐⭐ = 仅有单一模块参考价值 | ⭐ = 方向不兼容

---

## 11. AUDESYS CNC 采纳参考模型

基于 8 个系统的交叉分析，AUDESYS CNC 参考模型从 4 个层次提取关键架构模式：

### 11.1 LinuxCNC → AUDESYS: 四层架构 + HAL 信号

```
LinuxCNC                          AUDESYS CNC
─────────                         ───────────
GUI 层 (多种 GUI)                   Studio IDE (Tauri + React)
Task 控制器 (G-code 解析+NML)       Runtime Engine (控制面 + HalProgram)
Motion 控制器 (实时 SCHED_FIFO)     HAL RT 数据面 (Rust, <1μs)
HAL 硬件抽象层                      amw (HalTransport/HalDiscovery/HalQoS)
  共享内存 Signal 连接                FlatBuffers Signal/StreamChannel/RPC (D10)
```

**直接采纳**：
- HAL Signal 的单写多读语义 → D10 Signal 原语
- Pin → Signal 的连接模型（零拷贝指针）→ 类型化的端点注册
- 四层架构的清晰职责分离 → Studio/Runtime/HAL/物理设备 四层
- `component.instance.pin` 命名规范 → `component.interface.name` (D10)

**增强升级**：
- 4 种数据类型 → 14 种 (D19)
- 本机共享内存 → FlatBuffers 跨进程/跨网络 (D19)
- 静态 halcmd 配置 → D17 Config Barrier 动态配置

### 11.2 GRBL → AUDESYS Phase 1: 极简步进执行

```
GRBL                               AUDESYS Phase 1 CNC
────                               ──────────────────
主循环 G-code 解析+规划              Host Runtime (Rust)
16 块环缓冲                         StreamChannel 有界队列 (D10)
Timer1 ISR 步进生成                  RT 线程步进 HAL 组件
Bresenham + AMASS                   可选 Bresenham/DDA 算法库
实时命令 volatile 标志位             RPC 控制命令 (D10)
9 状态状态机                        Runtime Engine 运动状态管理
```

Phase 1 策略：以最低架构开销建立 G-code 编译 → HAL IR 管道（D55），不追求 5 轴联动。GRBL 的极简步进执行模型作为 MVP CNC 运动控制参考实现。

### 11.3 Klipper → AUDESYS Phase 2+: 分布式 Host/MCU

```
Klipper                            AUDESYS Phase 2+ CNC
───────                            ──────────────────
RPi (Python Host)                  Studio IDE + Runtime Engine
  G-code 解析                       IEC 61131-3 编译器 + G-code 组件 (D55)
  运动规划 (Python + C helpers)     Runtime 规划模块 (Rust + C++)
  Input Shaper                      HAL Filter Chain
  步进压缩 (stepcompress.c)         StreamChannel 批量传输
MCU (C, 定时执行)                    Controller MCU (HAL RT 面)
  queue_step 执行                   Signal/StreamChannel 步进原语
```

Phase 2+ 策略：Klipper 验证了"上位机计算、下位机执行"的分布式架构可行性。AUDESYS Studio ↔ Controller 两层项目模型正是此架构的直接映射。

### 11.4 TwinCAT CNC → AUDESYS 产品愿景: PLC+CNC 统一

TwinCAT 从 1996 年至今近 30 年的成功验证了 PLC+CNC 统一平台的商业可行性：

```
TwinCAT                            AUDESYS 愿景
────────                           ────────────
PLC Runtime                        IEC 61131-3 Runtime (ST/FBD/LD/SFC)
NC/CNC Runtime                     G-code 运动控制模块 (D55)
Safety Runtime (TwinSAFE)          Safety 模块 (LockLevel 隔离, D17)
EtherCAT 分布式时钟                Phase 3+ HalQoS 时钟同步
Visual Studio IDE                   Studio IDE (Tauri + React)
```

### 11.5 CNC 特性路线图

```
Phase 1 (MVP): GRBL 步进模式
  → 3 轴步进 HAL 组件 → Bresenham/DDA 算法库 → G-code 解析器组件 → HalProgram 后端

Phase 2 (扩展): Klipper 分布式模式
  → Studio ↔ Controller IPC → Input Shaper Filter Chain → 多 MCU 同步 → 步进压缩 (D10 StreamChannel)

Phase 3 (高级): LinuxCNC 全功能模式
  → 5 轴联动 → 可插拔运动学 → 前瞻规划 → 闭环 PID → halscope 级调试工具

Phase 4 (工业): TwinCAT 统一模式
  → PLC+CNC 统一调度 → Safety 模块 → EtherCAT/Profinet 适配 → 工业认证
```

---

## 12. AUDESYS 差异化定位

### 12.1 核心技术差异

| 维度 | 现有 CNC 系统通病 | AUDESYS 差异化 |
|------|-----------------|---------------|
| **双语言原生支持** | G-code OR IEC 61131-3 (择一) | **IEC 61131-3 + G-code 双语言原生** — PLC 逻辑用 IEC，运动路径用 G-code，同一 HalProgram 后端 (D55) |
| **序列化格式** | 无标准化 (共享内存/NML/自定义二进制) | **FlatBuffers 零拷贝** (D19) — 跨语言、跨平台、零堆分配 |
| **配置管理** | 编译时/重启生效 (LinuxCNC .hal, Marlin Configuration.h) | **Config Barrier + LockLevel** (D17) — 运行时配置变更排队到 RT 周期边界批量应用 |
| **仿真能力** | 无 (需物理硬件) | **SimulationHarness** — 无硬件测试完整 HAL 组件和运动控制逻辑 |
| **通信原语** | 单一原语 (HAL 信号 OR G-code 串行 OR NML) | **三原语正交覆盖** (D10) — Signal + StreamChannel + RPC |
| **类型系统** | 4 种 (bit/float/s32/u32) | **14 种** — 11 标量 + String + Blob + Array<T> |
| **跨平台架构** | 单一平台 (x86 OR ARM OR AVR) | **三层延迟模型** (D19) — Rust RT 面 + C++ I/O 面 + 15 语言控制面 |
| **硬件抽象** | 本机共享内存 (LinuxCNC) / 单协议 (Klipper MCU) | **amw trait** (D11) — 传输/发现/QoS 三极抽象，实现可替换 |
| **调试工具** | 本机 halscope/halmeter | **工业调试桥** — 远程实时信号示波器 + 分布式追踪 + 可视化 |
| **开源许可** | GPL-2.0/GPL-3.0 (限制性商用) | **Apache 2.0** — 商业友好 |
| **版本兼容** | 无机制 (LinuxCNC 2.7→2.8 破坏性) | **FlatBuffers schema 版本管理** + D22 HAL IR 稳定接口 |
| **安全模型** | 无 (物理隔离假设) | **LockLevel** (D17) + **HalQoS security_domain** (D16) |

### 12.2 CNC 特有差异化特性

除了以上通用 HAL 差异化，AUDESYS CNC 子系统还具有以下专有特性：

1. **G-code 作为第 6 种源码语言** (D55)：与 ST/IL/LD/FBD/SFC 五种 IEC 61131-3 语言并列，共用 HalProgram 后端，零 VM 变更
2. **HAL IR 作为统一中间表示**：ST 编译器和 G-code 编译器都生成 HAL IR，使 PLC 逻辑和 CNC 运动路径可在同一 Runtime 中无缝交互
3. **运动规划器作为 HAL 组件**：轨迹规划、运动学变换、插补器都作为可替换的 HAL 组件实现，而非内建到内核
4. **Config Barrier 安全换刀**：多进程 Supervisor 触发的换刀 RPC 通过 Config Barrier 排队到 RT 周期边界，避免 LinuxCNC"开发者自觉"式的非安全性
5. **SimulationHarness CNC 仿真**：无需物理硬件即可在 InprocMiddleware 上运行完整的 CNC 运动管线测试，包括归零序列、软限位、工具路径验证
6. **双语言调试统一**：Studio IDE 中的断点/单步/变量监视同时对 IEC 61131-3 代码和 G-code 路径有效

---

> **文档版本**: 1.0 | **源数据**: `docs/reference/` 41 篇中 8 篇 CNC 类竞品文档
> **映射决策**: D10 (三原语) / D11 (amw) / D13 (混合调度) / D16 (HalQoS) / D17 (Config Barrier) / D19 (多语言) / D24 (配置格式) / D55 (CNC 策略)
