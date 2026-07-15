# Machinekit

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: Machinekit（后分拆为 Machinekit-HAL + Machinekit-CNC）
- **开发商/组织**: 开源社区，由 Michael Haberler、Charles Steinkuehler、John Morris 等人发起，由 Machinekit 社区维护（https://www.machinekit.io）
- **首次发布年份**: 2014 年（从 LinuxCNC 分叉）
- **当前版本**:
  - Machinekit-HAL（活跃仓库）: 最新提交 2024-09，无正式发布版本号
  - Machinekit（原始仓库）: 已归档（Archived），不再开发
  - Machinekit-CNC（CNC 功能分离仓库）: 最新提交 2020-03，不活跃
- **仓库地址**:
  - Machinekit-HAL: https://github.com/machinekit/machinekit-hal
  - Machinekit（已归档）: https://github.com/machinekit/machinekit
  - Machinekit-CNC: https://github.com/machinekit/machinekit-cnc
- **项目网站**: https://www.machinekit.io
- **开发者数量**: 155 名贡献者（原 Machinekit 仓库累计），100 名（Machinekit-HAL 仓库）

### 1.2 产品定位与核心价值主张

Machinekit 定位为 **跨平台的实时机器控制框架**，核心价值主张是：

1. **硬件无关性** — 从 x86 PC 到 ARM 嵌入式单板计算机（BeagleBone、Raspberry Pi）统一运行
2. **实时环境多样性** — 支持 RT-PREEMPT、Xenomai、RTAI 三大实时 Linux 内核方案
3. **HAL 抽象层** — 基于组件的硬件抽象架构，200+ 种现成模块，快速组装机器控制系统
4. **开放生态系统** — 从 NIST EMC 公共领域代码到现代机器控制框架的 30 年演进

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| CNC 机床集成商 | 铣床/车床/激光切割机/等离子控制 | 需运动控制 + PLC + 硬件驱动一体化方案 |
| 机器人工程师 | 机械臂控制、多轴协同 | 标准化硬件接口、实时关节控制 |
| 嵌入式开发者 | BeagleBone/RPi 平台机器控制 | PRU 步进生成、低延迟 I/O |
| 工业自动化集成商 | 特殊机器自动化 | 模块化 HAL 组件、可定制线程 |
| 教育研究机构 | 运动控制教学、实时系统实验 | 开源透明、完整的 HAL 文档 |
| 3D 打印机创客 | DIY CNC/3D 打印的控制系统 | 低成本嵌入式方案、社区支持 |

### 1.4 许可证模型

- **许可证**: GNU General Public License v2.0（GPL-2.0），源自 LinuxCNC
- **商业模型**: 完全开源，社区志愿者维护
- **封闭组件**: 无 — 完全开源
- **OEM 考虑**: GPL-2.0 要求衍生作品同样开源，商用嵌入式场景需注意许可证合规性

---

## 2. 技术特性

### 2.1 核心架构

Machinekit 采用 **三层架构**（Three-Tier Architecture），源自 NIST EMC 设计：

```
+-----------------------------------------------------------+
|                Machinekit 系统架构                          |
+-----------------------------------------------------------+
|                                                           |
|  层 1: 用户界面层 (User Interface Layer)                   |
|  +-----------------------------------------------------+  |
|  | AXIS GUI | Touchy | QtQuickVcp | Machinetalk | CLI   |  |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  层 2: 控制层 (Control Layer) - NML 通信                  |
|  +-----------------------------------------------------+  |
|  | 任务规划器 (Task Planner)  |  I/O 控制器 (IO Control) | |
|  | G-code 解释器 (Interpreter) |  PLC (ClassicLadder)    | |
|  | 运动控制器 (Motion Controller)                        | |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  层 3: HAL 层 (Hardware Abstraction Layer)                |
|  +-----------------------------------------------------+  |
|  | HAL 组件库 (200+ Components)                          | |
|  | 步进发生器 | PID 控制器 | 编码器 | 并口 | GPIO | PRU   | |
|  | 信号连接 | 线程调度 | 实时函数                         | |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  RTOS 抽象层 (RTAPI - Real-Time API)                      |
|  +-----------------------------------------------------+  |
|  | RT-PREEMPT | Xenomai | RTAI | POSIX (模拟模式)       | |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  硬件层 (ARM/x86/PRU/FPGA)                                |
|  +-----------------------------------------------------+  |
|  | BeagleBone | Raspberry Pi | x86 PC | FPGA 扩展板     | |
|  +-----------------------------------------------------+  |
+-----------------------------------------------------------+
```

#### 架构层次详解

Machinekit 的设计继承自 LinuxCNC 的 EMC2 架构，分为三个逻辑层：

| 层次 | 组件 | 功能 |
|------|------|------|
| **用户界面层** | AXIS（Tk GUI）、Touchy（触摸屏）、QtQuickVcp（Qt5 QML）、Machinetalk（WebSocket/JSON） | 人机交互、G-code 发送、状态监控 |
| **控制层** | Task（任务规划器）、Motion（运动控制器）、IO（I/O 控制器）、Interpreter（G-code 解释器） | G-code 解析、轨迹规划、PLC 逻辑、I/O 管理 |
| **HAL 层** | 200+ HAL 组件（驱动/逻辑/控制/信号处理） | 硬件抽象、实时函数、信号连接、线程调度 |

#### 与 LinuxCNC 的关键差异

Machinekit 与 LinuxCNC 共享共同祖先但走向不同路线：

| 维度 | LinuxCNC | Machinekit |
|------|---------|------------|
| 目标平台 | x86 PC 为主 | ARM 嵌入式（BeagleBone/RPi）+ x86 |
| 实时方案 | RTAI 为主 | RT-PREEMPT + Xenomai + RTAI 多选择 |
| 配置系统 | 传统 .ini + .hal 文件 | 传统 + 新增 instantiable 组件 |
| CNC 功能 | 核心组成部分 | 分离至 machinekit-cn 仓库 |
| 用户界面 | AXIS (Tk) / Touchy | 新增 QtQuickVcp (Qt5 QML) / Machinetalk |
| PRU 支持 | 有限 | 内置 hal_pru_generic 驱动 |
| 社区活跃度 | 活跃 (LinuxCNC 2.9/2.10) | 低（2024 年最后提交） |

### 2.2 HAL（硬件抽象层）详解

HAL 是 Machinekit 的 **核心创新**，也是 AUDESYS 直接参考的设计来源。

#### HAL 基本概念

```
+---------------------------------------------------+
|                    HAL 系统                         |
|                                                     |
|  组件 (Component)       组件 (Component)             |
|  +----------------+     +----------------+          |
|  |  PIN: in       |     |  PIN: out      |          |
|  |  PIN: out      |-----|  PIN: in       |          |
|  |  PARAM: scale  | 信号 |  PARAM: max    |          |
|  |  FUNC: update  |     |  FUNC: process |          |
|  +----------------+     +----------------+          |
|                                                     |
|  线程 (Thread): servo-thread (1kHz)                  |
|  线程 (Thread): base-thread (10kHz)                  |
+---------------------------------------------------+
```

HAL 的核心抽象概念：

| 概念 | 电子类比 | 描述 |
|------|---------|------|
| **Component**（组件） | 集成电路 | 具有输入/输出和行为定义的软件模块 |
| **Pin**（引脚） | IC 引脚 | 组件的输入/输出数据端口 |
| **Signal**（信号） | 导线 | 连接组件引脚的数据通道 |
| **Parameter**（参数） | 可调电阻 | 组件的行为调整参数 |
| **Function**（函数） | 子电路功能 | 组件中被线程调用的实时代码块 |
| **Thread**（线程） | 时钟信号 | 以固定周期调度函数执行的实时线程 |

#### HAL 数据类型

HAL 组件引脚支持以下数据类型：

| 类型 | 描述 | 示例 |
|------|------|------|
| `bit` | 布尔值 (true/false) | 限位开关状态 |
| `float` | 双精度浮点 (double) | 位置指令、PID 输出 |
| `s32` | 32 位有符号整数 | 编码器计数 |
| `u32` | 32 位无符号整数 | 步进脉冲计数 |

#### HAL 实时线程

Machinekit 的实时执行基于两种默认线程：

| 线程 | 周期 | 优先级 | 用途 |
|------|------|--------|------|
| **servo-thread** | 1ms (1kHz) 典型 | 高 | 运动控制、PID 闭环、轨迹插补 |
| **base-thread** | 100μs (10kHz) 典型 | 最高 | 步进脉冲生成、高速 I/O、PWM |

线程通过 `addf` 命令添加函数，按添加顺序执行。

### 2.3 RTAPI（实时 API）抽象层

RTAPI 是 Machinekit 的关键创新之一 — 它提供了 **RTOS 无关的实时编程接口**，使 HAL 组件无需修改即可运行在不同实时内核之上：

```
+------------------------------------------------------+
|                RTAPI 抽象层                            |
|                                                       |
|  统一 API: rtapi_init()  rtapi_task_new()             |
|            rtapi_prio_highest()  rtapi_delay()        |
|            hal_export_funct()  hal_create_thread()    |
+------------------------------------------------------+
          |           |            |          |
          v           v            v          v
+---------+   +-------+   +--------+   +------+
|POSIX    |   |RT-    |   |Xenomai |   |RTAI  |
|(模拟)   |   |PREEMPT|   |用户空间 |   |内核  |
+---------+   +-------+   +--------+   +------+
```

#### RTAPI 核心函数

| 函数 | 用途 |
|------|------|
| `rtapi_init(char *name)` | 初始化 RTAPI 模块，返回模块 ID |
| `rtapi_exit(int comp_id)` | 退出并释放 RTAPI 资源 |
| `rtapi_prio_highest()` | 获取最高实时优先级 |
| `rtapi_task_new()` | 创建新的实时任务 |
| `rtapi_snprintf()` | 实时安全的格式化输出 |
| `rtapi_print()` | 实时安全的打印函数 |
| `hal_init(char *name)` | 初始化 HAL 组件（调用 rtapi_init） |
| `hal_create_thread()` | 创建实时线程 |
| `hal_add_funct_to_thread()` | 将函数添加到线程 |
| `hal_export_funct()` | 导出 HAL 函数供线程调度 |

#### 统一构建系统（Unified Build）

Machinekit 的 Unified Build 支持在 **一次构建** 中为多个 RTOS 风格生成二进制文件：

| RT 风格 (Flavor) | 类型 | 描述 |
|-----------------|------|------|
| **posix** | 用户空间 | 无实时内核需求，用于开发和模拟 |
| **rt-preempt** | 用户空间 | 基于 RT-PREEMPT 内核补丁的软实时 |
| **xenomai** | 用户空间 | 基于 Xenomai 阳内核的硬实时 |
| **xenomai-kernel** | 内核模块 | Xenomai 内核线程（已弃用） |
| **rtai** | 内核模块 | RTAI 实时内核（x86 为主） |

构建配置示例：
```bash
# 为 BeagleBone 构建 Xenomai + POSIX 风格
./configure --with-platform=beaglebone --with-xenomai --with-posix

# 为 x86 PC 构建所有风格
./configure --with-rt-preempt --with-xenomai --with-posix
```

### 2.4 支持的硬件平台

| 平台 | CPU 架构 | 推荐实时方案 | 步进生成方式 |
|------|---------|------------|------------|
| x86 PC | x86_64 | RT-PREEMPT / RTAI | 并口 / FPGA 扩展卡 |
| BeagleBone Black | ARM Cortex-A8 (AM335x) | Xenomai | PRU（可编程实时单元） |
| BeagleBone White | ARM Cortex-A8 (AM335x) | Xenomai | PRU + BeBoPr 扩展板 |
| Raspberry Pi 2/3/4 | ARM Cortex-A53/A72 | RT-PREEMPT | GPIO 比特弹跳 |
| Odroid U3/XU4 | ARM Cortex-A7/A15 | RT-PREEMPT | GPIO |
| PocketBeagle | ARM Cortex-A8 (AM335x) | Xenomai | PRU |

### 2.5 PRU 步进生成技术

Machinekit 的 **hal_pru_generic** 驱动是 BeagleBone 平台的关键创新：

```
+------------------------------------------------------+
|     BeagleBone AM335x + Machinekit PRU 架构            |
|                                                       |
|  主机 (ARM Cortex-A8, Linux + Xenomai)                 |
|  +--------------------------------------------------+ |
|  | Machinekit HAL (servo-thread @ 1kHz)              | |
|  | 位置计算 -> 步骤时间 -> 发送到 PRU 共享内存       | |
|  +-----------------------+--------------------------+ |
|                          |                            |
|  PRU-0 (Programmable Realtime Unit @ 200MHz)          |
|  +-----------------------+--------------------------+ |
|  | PRU 固件 (任务链)                                  | |
|  | 步进脉冲生成 | PWM 生成 | 编码器计数               | |
|  | 定时精度: ~5ns (PRU 单周期指令)                    | |
|  +--------------------------------------------------+ |
|                          |                            |
|  BeBoPr 扩展板 (GPIO 电平转换)                         |
|  +--------------------------------------------------+ |
|  | 步进驱动接口 | 限位开关 | 探针 | 模拟输入          | |
|  +--------------------------------------------------+ |
+------------------------------------------------------+
```

PRU 的关键特性：

| 特性 | 值 |
|------|-----|
| PRU 频率 | 200MHz (AM335x) |
| 指令周期 | 5ns |
| 步进频率上限 | ~4MHz（简单配置）|
| 共享内存 | 12KB (PRU0 + PRU1) |
| 任务链机制 | 动态链接 PRU 代码片段 |
| 最小周期 | 取决于任务链长度 |

PRU 驱动使用 **tasklet 任务链** 架构 — 将步进、PWM、编码器等功能的 PRU 代码片段动态链接到执行链中，运行时按需配置。

### 2.6 运动控制器（Motion Controller）

Motion 控制器是控制层的核心，负责轨迹插补和伺服控制：

```
G-code 指令
    |
    v
NML 消息队列 (Neutral Message Language)
    |
    v
Motion 控制器
+----------------------------------------------+
| TP (Trajectory Planner) 轨迹规划器             |
| - 线性插补 (G01)                             |
| - 圆弧插补 (G02/G03)                         |
| - 加减速控制                                 |
| - 前瞻队列 (Look-ahead)                       |
+----------------------------------------------+
    |
    v
+----------------------------------------------+
| 运动学变换 (Kinematics)                        |
| - 三轴铣床 (trivkins)                        |
| - 五轴 (五轴 kinematics)                      |
| - 并联运动学 (Delta/SCARA)                    |
| - 自定义 kinematics 模块                       |
+----------------------------------------------+
    |
    v
+----------------------------------------------+
| 伺服循环 (Servo Loop @ 1kHz)                  |
| - PID 位置环                                  |
| - 前馈控制                                    |
| - 编码器反馈                                  |
+----------------------------------------------+
    |
    v
HAL 引脚: axis.N.motor-pos-cmd 等
```

### 2.7 组件生成器（Component Generator）

Machinekit 提供了两个工具来简化 HAL 组件开发：

#### comp（传统组件生成器）

comp 是 LinuxCNC 遗留的组件生成器，从 .comp 描述文件生成 C 代码：

```c
// 示例: ddt.comp - 微分器组件
component ddt "Compute the derivative of a signal";
pin in float in "The signal to differentiate";
pin out float out "Its derivative";
function _;
;;
double previous;
void _(_inst inst) {
    out = in - previous;  // 计算微分
    previous = in;        // 保存当前值
}
```

#### instcomp（可实例化组件生成器）

instcomp 是 Machinekit 新增的组件生成器，支持运行时动态创建实例：

```c
// 示例: 使用 instcomp 创建可实例化的低通滤波器
component lowpass "First order low-pass filter";
pin in float in "Input signal";
pin out float out "Filtered output";
param rw float cutoff "Cutoff frequency in Hz";
function _;
;;
double state;
void _(_inst inst) {
    double dt = 1.0 / fperiod;  // 从周期计算时间步长
    double tau = 1.0 / (2 * M_PI * cutoff);
    double alpha = dt / (tau + dt);
    state = state + alpha * (in - state);
    out = state;
}
```

| 特性 | comp | instcomp |
|------|------|---------|
| 创建实例时机 | 加载时一次性创建 | 运行时按需创建 |
| 灵活性 | 需预知最大实例数 | 任意数量、任意时刻 |
| 内存效率 | 静态分配 | 动态分配 |
| 代码复杂度 | 较低 | 略高 |
| 已转换组件数 | 传统组件 | 80+ 组件已迁移 |
| 适用场景 | 简单驱动、固定配置 | 多种实例、动态场景 |

### 2.8 三大关键驱动组件

#### stepgen（步进发生器）

将位置指令转换为步进脉冲序列：

```
axis.N.motor-pos-cmd (float)
    |
    v
stepgen.N
+--------------------------------------------------+
| 位置环 (Position Loop)                           |
| - 位置误差计算                                    |
| - 速度前馈                                        |
| 步进产生 (Step Generation)                        |
| - 加减速控制                                      |
| - 步进方向输出 (step/dir)                        |
+--------------------------------------------------+
    |
    v
HAL 引脚: stepgen.N.step (bit), stepgen.N.dir (bit)
```

关键参数：

| 参数 | 类型 | 典型值 | 描述 |
|------|------|--------|------|
| `position-scale` | float | 1000.0 | 每毫米步数 |
| `max-velocity` | float | 500.0 | 最大速度 (mm/s) |
| `max-acceleration` | float | 1000.0 | 最大加速度 (mm/s²) |
| `step-type` | s32 | 0-3 | 步进脉冲类型 |

#### PID（PID 控制器）

通用 PID 闭环控制器：

```
cmd (float) -----> + ----> PID ----> output
                    ^          |
                    |          v
feedback (float) ---+      enable (bit)
```

| 参数 | 描述 |
|------|------|
| `Pgain` | 比例增益 |
| `Igain` | 积分增益 |
| `Dgain` | 微分增益 |
| `bias` | 输出偏置 |
| `FF0` / `FF1` / `FF2` | 前馈系数 |
| `maxoutput` | 最大输出限制 |
| `maxerror` | 最大误差限制 |
| `deadband` | 死区范围 |

#### encoder（编码器计数）

```c
// 编码器 HAL 引脚
pin in bit encoder.N.phase-A;    // A 相信号
pin in bit encoder.N.phase-B;    // B 相信号
pin in bit encoder.N.index;      // Z 相零位
pin out s32 encoder.N.count;     // 编码器计数
pin out float encoder.N.velocity; // 速度估计
param rw float encoder.N.scale;  // 刻度因子
```

### 2.9 硬件驱动 HAL 组件

Machinekit 支持丰富的硬件驱动组件：

| 驱动组件 | 描述 | 平台 |
|---------|------|------|
| `hal_parport` | 并口 GPIO 驱动 | x86 PC |
| `hal_pru_generic` | PRU 步进/PWM 驱动 | BeagleBone |
| `hm2_eth` | HostMot2 FPGA 以太网驱动 | Mesa 卡 |
| `hm2_pci` | HostMot2 FPGA PCI 驱动 | Mesa 卡 |
| `hal_bb_gpio` | BeagleBone GPIO 驱动 | BeagleBone |
| `serport` | 串口 Modbus 驱动 | 通用 |
| `pluto_servo` | Pluto-P FPGA 步进驱动 | x86 |
| `hal_stg` | 伺服端子组驱动 | x86 |

### 2.10 逻辑与控制组件

| 组件 | 描述 | 类型 |
|------|------|------|
| `and2` / `or2` / `not` | 标准逻辑门 | bit 逻辑 |
| `mux2` / `mux4` / `mux8` | 多路复用器 | bit/float 选择 |
| `integ` | 积分器 | float 数学 |
| `ddt` | 微分器 | float 数学 |
| `limit1` / `limit2` / `limit3` | 限幅器 | float 限幅 |
| `wcomp` | 窗口比较器 | float→bit |
| `sum2` / `sum4` | 加权求和 | float 运算 |
| `scale` | 缩放偏移 | float 线性变换 |
| `deadzone` | 死区处理 | float 死区 |
| `biquad` | 双二次滤波器 | float IIR 滤波器 |
| `classicladder` | PLC 梯形图 | IEC 61131-3 LD |
| `logic` | 多输入逻辑门 | bit 逻辑（可配置） |

### 2.11 Machinetalk 通信协议

Machinekit 引入了 **Machinetalk** — 基于 WebSocket 和 Protocol Buffers 的远程通信协议：

| 特性 | 技术细节 |
|------|---------|
| 传输层 | WebSocket (ws://) |
| 序列化 | Protocol Buffers (protobuf) |
| 消息模式 | 发布/订阅 (Pub/Sub) |
| 数据通道 | Machinetalk 通道 (Value/Command) |
| UI 支持 | QtQuickVcp (QML) 前端 |
| 远程访问 | 支持手机/平板控制 |

Machinetalk 允许用户界面（如 QtQuickVcp）通过网络与 Machinekit 实时内核通信，实现 **分布式架构**：

```
+-----------+        +-----------+        +-----------+
| QtQuickVcp|        | 手机/平板  |        | Web 界面   |
| (QML UI)  |        | (HTML5)   |        | (JavaScript)|
+-----+-----+        +-----+-----+        +-----+------+
      |                      |                    |
      +----------------------+--------------------+
                            |
                    WebSocket / JSON
                            |
                    +-------v-------+
                    |  Machinetalk   |
                    |  服务器        |
                    +-------+-------+
                            |
                    HAL 数据通道
                            |
                    +-------v-------+
                    |  Machinekit   |
                    |  HAL 核心     |
                    +---------------+
```

### 2.12 QtQuickVcp 用户界面

Machinekit 的现代 UI 框架，基于 Qt5 QML：

| 特性 | 描述 |
|------|------|
| 框架 | Qt5 Quick (QML) + C++ |
| 通信 | Machinetalk (WebSocket) |
| 远程 | 支持手机/平板/桌面 |
| 组件 | 虚拟摇杆、DRO、状态机 |
| 扩展 | QML 插件式 UI 设计 |

---

## 3. 功能概览

### 3.1 主要功能模块

#### HAL 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| HAL 库 | `src/hal/lib/hal.c` | HAL 核心库：信号、引脚、参数管理 |
| HAL 命令 | `src/hal/utils/halcmd/` | halcmd CLI 工具 |
| RTAPI | `src/rtapi/` | 实时 API 抽象层 |
| 组件生成器 | `src/hal/components/comp` | .comp 文件到 C 代码生成器 |
| 线程管理 | `src/hal/lib/hal_thread.c` | 实时线程创建和管理 |
| 共享内存 | `src/hal/lib/hal_memory.c` | HAL 共享内存管理 |

#### 运动控制模块

| 模块 | 路径 | 职责 |
|------|------|------|
| 轨迹规划 | `src/emc/motion/tp.c` | 轨迹规划和插补 |
| 运动学 | `src/emc/kinematics/` | 机床运动学变换 |
| 伺服循环 | `src/emc/motion/` | PID 伺服控制 |
| 步进生成 | `src/hal/components/stepgen.c` | 步进脉冲生成 |

#### 用户界面

| UI | 描述 | 技术 |
|----|------|------|
| AXIS | 传统 3D CNC GUI | Tcl/Tk |
| Touchy | 触摸屏 GUI | Tcl/Tk |
| QtQuickVcp | 现代 QML GUI | Qt5 QML |
| halshow | HAL 实时诊断 | Tcl/Tk |
| halscope | HAL 信号示波器 | Tcl/Tk |
| halmeter | HAL 信号仪表 | GTK/Tcl |

### 3.2 HAL 配置流程

```
# 一个典型的 CNC 机床 HAL 配置

# 1. 加载实时组件
loadrt stepgen step_type=0,0
loadrt pid num_chan=2
loadrt hal_parport

# 2. 将函数添加到线程
addf stepgen.0.update-reset base-thread
addf stepgen.0.make-pulses base-thread
addf stepgen.1.update-reset base-thread
addf stepgen.1.make-pulses base-thread
addf pid.0.do-pid servo-thread
addf pid.1.do-pid servo-thread

# 3. 创建信号
net X-pos-cmd <= axis.0.motor-pos-cmd => stepgen.0.position-cmd
net X-pos-fb <= encoder.0.position => axis.0.motor-pos-fb
net X-enable <= iocontrol.0.enable => stepgen.0.enable

# 4. 连接硬件
net X-step <= stepgen.0.step => parport.0.pin-02
net X-dir  <= stepgen.0.dir  => parport.0.pin-03
net X-en   <= stepgen.0.enable => parport.0.pin-04
```

### 3.3 halcmd 命令参考

| 命令 | 功能 | 示例 |
|------|------|------|
| `loadrt` | 加载实时组件 | `loadrt stepgen step_type=0,0` |
| `loadusr` | 加载用户空间组件 | `loadusr halscope` |
| `newinst` | 创建组件实例 | `newinst lowpass lp.0` |
| `addf` | 添加函数到线程 | `addf stepgen.0.update-reset base-thread` |
| `net` | 创建信号连接 | `net X-pos <= axis.0.motor-pos-cmd` |
| `setp` | 设置参数值 | `setp stepgen.0.max-velocity 500` |
| `getp` | 读取参数值 | `getp stepgen.0.position-scale` |
| `show pin` | 显示所有引脚 | `show pin` |
| `show sig` | 显示所有信号 | `show sig "X-*"` |
| `show thread` | 显示所有线程 | `show thread` |
| `unloadrt` | 卸载实时组件 | `unloadrt hal_parport` |
| `start` | 启动实时线程 | `start` |
| `stop` | 停止实时线程 | `stop` |

### 3.4 INI 配置文件

Machinekit 使用 .ini 文件作为系统配置入口：

```ini
[MACHINE]
MACHINE = My CNC Mill
DEBUG = 0

[DISPLAY]
DISPLAY = axis
GEOMETRY = xyz
LATHE = 0

[TRAJ]
AXES = 3
MAX_VELOCITY = 500
MAX_ACCELERATION = 2000
DEFAULT_VELOCITY = 300
DEFAULT_ACCELERATION = 1000

[AXIS_0]
TYPE = LINEAR
UNIT_CONVERSION = 1.0
MIN_LIMIT = -500
MAX_LIMIT = 500
MAX_VELOCITY = 500
MAX_ACCELERATION = 1000
BACKLASH = 0.01

[EMCMOT]
BASE_PERIOD = 100000    # 100μs (10kHz base thread)
SERVO_PERIOD = 1000000  # 1000μs (1kHz servo thread)

[HAL]
HALFILE = my_machine.hal
HALFILE = custom_io.hal
HALCMD = loadusr halscope
```

### 3.5 HAL 实时调试工具

#### halshow（HAL 状态树）

halshow 提供 HAL 状态的实时树形视图，包含六个主要节点：

| 节点 | 内容 |
|------|------|
| Components | 所有加载的 HAL 组件及其 ID |
| Pins | 所有 HAL 引脚及其当前值 |
| Signals | 所有 HAL 信号及其连接的引脚 |
| Parameters | 所有 HAL 参数 |
| Functions | 所有导出的 HAL 函数 |
| Threads | 所有实时线程及函数执行顺序 |

#### halscope（HAL 示波器）

类似数字示波器的信号监测工具：

| 功能 | 描述 |
|------|------|
| 通道数 | 最多 16 个信号通道 |
| 触发模式 | 上升沿/下降沿/电平 |
| 采样率 | 实时线程周期 |
| 时间基准 | 可调（ms/div） |
| 显示 | 波形图、数值 |

#### halmeter（HAL 仪表）

简单的数值显示工具，支持多个独立的仪表窗口。

### 3.6 实时内核配置

Machinekit 支持三种主流实时 Linux 方案：

#### RT-PREEMPT 配置

```bash
# 安装 RT-PREEMPT 内核
sudo apt-get install linux-image-rt-amd64  # Debian
# 或
sudo apt-get install linux-image-rt  # Ubuntu

# 构建 Machinekit
./configure --with-rt-preempt
make
sudo make install
```

#### Xenomai 配置

```bash
# BeagleBone Xenomai 内核
# 使用 Machinekit 预构建的 Debian 镜像
# bone-debian-8.7-machinekit-armhf-2017-02-12-4gb.img.xz

# 构建
./configure --with-platform=beaglebone --with-xenomai
make
sudo make install
```

#### RTAI 配置

```bash
# x86 PC 使用 RTAI
./configure --with-rtai
make
sudo make install
```

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| Machinekit-HAL GitHub Stars | ~123 |
| Machinekit-HAL Forks | ~70 |
| Machinekit-HAL Contributors | 100 |
| 原始 Machinekit Stars | ~350（已归档） |
| 原始 Machinekit 总提交数 | 19,926 |
| 原始 Machinekit 贡献者 | 155 |
| Machinekit-HAL 最后更新 | 2024-09 |
| Machinekit-CNC 最后更新 | 2020-03 |
| 原始 Machinekit 最后更新 | 2020-04（归档） |
| 主要开发语言 | C (57.8%), CMake (16.1%), C++ (9.7%), Python (7.7%) |
| APT 包支持 | Debian 9/10/11, Ubuntu 18.04/20.04/21.04 |

### 4.2 社区规模/用户基数

- **GitHub**: 125 个 Open Issues (Machinekit-HAL) — 表明有活跃但缓慢的问题跟踪
- **论坛**: Google Groups "machinekit" — 遗留支持和讨论
- **Matrix**: #machinekit:matrix.org — 实时聊天
- **Open Hub**: 分析显示过去 12 个月零提交 — 表明社区活跃度极低
- **学术引用**: 作为嵌入式实时控制案例被少数论文引用
- **工业应用**: 少量用于 Hobby CNC、3D 打印、特殊机器控制

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **Machinekit-HAL** | 核心 HAL 实时框架（当前活跃仓库） |
| **Machinekit-CNC** | CNC 运动控制套件（包含 G-code 解释器、任务规划、运动控制） |
| **QtQuickVcp** | Qt5 QML 用户界面框架 |
| **Machinetalk** | WebSocket/Protobuf 通信协议 |
| **hal_pru_generic** | BeagleBone PRU 步进/PWM 驱动 |
| **BeBoPr** | BeagleBone CNC 扩展板（步进驱动 + I/O） |
| **Machinekit Debian Images** | 预构建的 BeagleBone SD 卡镜像 |
| **Machinekit Documentation** | 在线文档（machinekit.io） |
| **Automatic Package Build** | Jenkins CI 自动打包（已停用） |

### 4.4 最新发展趋势

1. **开发停滞** — Machinekit-HAL 最后提交为 2024-09，原 Machinekit 仓库 2020 年归档，整个项目已基本停滞
2. **功能精简** — 原 Machinekit 分拆为 Machinekit-HAL（核心 HAL）+ Machinekit-CNC（CNC 功能），追求精简核心
3. **LinuxCNC 分化** — 两个项目代码库差异持续扩大（+20,613 / -5,114 差异提交）
4. **Platform 扩展** — 从 x86 向 ARM 嵌入式平台转移是核心价值，BeagleBone PRU 集成是独特卖点
5. **RTOS 多样性** — Unified Build 实现多 RTOS 风格的一构建多部署
6. **HAL 组件现代化** — instcomp 可实例化组件生成器是重要的架构升级
7. **Machinetalk 通信** — 引入 WebSocket 远程控制是迈向分布式架构的尝试

### 4.5 安全评估

#### 已知安全考虑

- **无内置网络安全** — 传统 LinuxCNC 设计假设机器控制网络为物理隔离，无加密/认证
- **Machinetalk 扩展** — WebSocket 通信增加了网络攻击面
- **实时内核依赖** — 安全性严重依赖底层 RTOS 内核的安全配置
- **共享内存访问** — HAL 共享内存无访问控制
- **无 SIL 认证** — 不适用于安全关键应用（IEC 61508）
- **无冗余架构** — 无热备/故障切换机制

#### 历史安全事件

- **CVE 记录** — Machinekit 本身无已知 CVE（但作为 LinuxCNC fork 继承其组件）
- **社区对策** — 标准实践是通过网络隔离和防火墙保护 Machinekit 系统

---

## 5. 市场定位

### 5.1 主要应用行业与场景

| 行业 | 典型应用 | 推荐平台 |
|------|---------|---------|
| CNC 加工 | 铣床/车床/等离子/激光/水刀 | BeagleBone + BeBoPr / x86 + Mesa |
| 3D 打印 | FDM/SLA 3D 打印机控制 | BeagleBone / RPi |
| 机器人 | 多轴机械臂控制 | BeagleBone + I/O 扩展 |
| 特殊机器 | 包装/装配/测试设备 | 按需平台 |
| 教育培训 | 运动控制和实时系统教学 | BeagleBone 低门槛方案 |
| DIY/创客 | 个人 CNC 项目 | RPi 低成本方案 |

### 5.2 竞争对手对比

| 维度 | Machinekit | LinuxCNC | GRBL | Marlin | Klipper |
|------|-----------|---------|------|--------|---------|
| 开源 | 完全开源 (GPL-2.0) | 完全开源 (GPL-2.0) | 开源 (GPL-3.0) | 开源 (GPL-3.0) | 开源 (GPL-3.0) |
| 目标平台 | ARM + x86 | x86 为主 | AVR (8-bit) | AVR/ARM (32-bit) | Linux + MCU |
| 实时方案 | RT-PREEMPT/Xenomai/RTAI | RTAI 为主 | 裸机 ISR | 裸机 ISR | Linux + 独立 MCU |
| 轴数 | 9 轴 (理论) | 9 轴 | 3 轴 | 4-5 轴 | 6+ 轴 |
| HAL 架构 | 200+ 组件 | 类似组件库 | 无 | 无 | 无 (Python + MCU) |
| 闭环控制 | 支持 (PID + 编码器) | 支持 | 开环 | 开环 | 开环 |
| 步进精度 | 依赖 RTOS 抖动 | PCI FPGA | ~25μs | ~50μs | 25μs |
| 学习成本 | 高 | 高 | 低 | 低 | 中 |
| 开发活跃度 | 极低 (停滞) | 中等活跃 | 中等 (grblHAL 活跃) | 高度活跃 | 高度活跃 |

### 5.3 与 LinuxCNC 详细对比

| 维度 | LinuxCNC | Machinekit |
|------|---------|------------|
| 维护状态 | 活跃开发 (2024 年发布 2.10) | 基本停滞 (最后提交 2024-09) |
| 社区规模 | 大 | 极小 |
| 平台 | x86 为主 | ARM + x86 |
| PRU 支持 | 有限（需移植） | 原生 hal_pru_generic |
| 用户界面 | AXIS/Touchy/GS2 | AXIS/Touchy/QtQuickVcp |
| 实时选择 | RTAI 为主（可选 RT-PREEMPT） | RT-PREEMPT/Xenomai/RTAI |
| 文档 | 详尽 | 中等 |
| 商业支持 | 有 (第三方) | 无 |
| 升级路径 | LinuxCNC 2.8→2.9→2.10 | 无明确路线图 |

---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **HAL 硬件抽象层** — 独一无二的电子面包板抽象，200+ 现成组件可组装任意机器控制系统
   - 组件/引脚/信号/线程的电路模型设计，降低嵌入式实时控制开发门槛
   - comp/instcomp 组件生成器，数行代码即可创建新 HAL 组件
   - HAL 状态实时可见 (halshow/halscope/halmeter)

2. **RTOS 无关的 RTAPI 抽象** — 一次编写，运行于 RT-PREEMPT/Xenomai/RTAI
   - Unified Build 实现多风格一构建多部署
   - 开发阶段使用 POSIX 模拟，发布时切换实时内核

3. **嵌入式 ARM 平台原生支持** — 针对 BeagleBone PRU 深度优化
   - hal_pru_generic 利用 PRU 实现 5ns 精度的步进脉冲
   - Debian Machinekit 预构建镜像，开箱即用
   - BeBoPr 扩展板为 CNC 应用提供完整接口

4. **完整的 CNC 软件栈** — 从 G-code 解析到步进脉冲的全链条覆盖
   - 支持 9 轴运动控制
   - 多目标运动学变换（三轴/五轴/并联）
   - 前瞻轨迹规划

5. **Machinetalk 远程架构** — 基于 WebSocket 的分布式控制
   - QtQuickVcp QML 前端，支持手机/平板
   - 工业实时控制与消费级 UI 分离

### 6.2 标志性功能或设计理念

- **"HAL 是电子面包板"** — 通过引脚/信号/组件的电路模型，将复杂的嵌入式实时控制设计简化为搭积木
- **"RTOS 无关性"** — RTAPI 抽象层选择正确的抽象粒度，一次编程在所有 RTOS 上运行
- **"INSTCOMP 实例化"** — 传统实时组件需预先分配所有资源，instcomp 实现了运行时动态创建
- **"嵌入式 Linux + PRU"** — 利用 BeagleBone 的异构计算（ARM + PRU）实现通用计算与硬实时结合
- **"从 NIST EMC 到现代框架"** — 从 1990 年代到 2020 年代的持续演进，验证了 HAL 架构的设计正确性

### 6.3 创新设计哲学

#### HAL 的"电路板"设计哲学

Machinekit 的 HAL 将电子电路设计理念引入软件架构：

```
电子电路                     HAL
真实元器件                   HAL 组件
IC 引脚                      HAL 引脚
导线                         HAL 信号
可调电阻                     HAL 参数
时钟周期                     HAL 线程
示波器                       halscope
万用表                       halmeter
```

这种类比降低了工业控制系统的复杂性理解门槛，使机器集成商能够像设计电子电路一样设计控制系统。

#### "组件的可组合性"

HAL 组件的核心设计原则是 **可组合性** — 任何组件的标准引脚都可以通过信号连接到任何其他组件的标准引脚：

```bash
# 将 PID 输出连接到步进发生器输入
net X-vel-cmd <= pid.0.output => stepgen.0.velocity-cmd

# 将限位开关状态连接到运动控制器
net X-lim-min <= parport.0.pin-10 => axis.0.neg-lim-sw-in

# 将急停按钮连接到全局使能
net estop <= parport.0.pin-12 => iocontrol.0.emc-enable-in
```

#### "RTAPI 的最小接口"

RTAPI 的设计哲学是**最小够用的实时抽象接口**：

```c
// RTAPI 核心函数数量 < 20
// 典型组件只需调用 3-5 个函数
int comp_id;
comp_id = hal_init("my_component");    // 初始化
hal_pin_float_new("my_pin.in", &pin);  // 创建引脚
hal_export_funct("my_func", func, ...); // 导出函数
// → 仅需 3 个函数启动一个组件
```

---

## 7. 对 AUDESYS 的参考价值

### 7.1 可借鉴的架构设计/理念

#### 1. HAL 组件/引脚/信号/线程抽象

Machinekit 的 HAL 提供了一套 **完整的"电子面包板"抽象**，这是 AUDESYS HAL 设计最直接的参考来源：

| Machinekit HAL 概念 | AUDESYS 对应概念 | 参考意义 |
|--------------------|-----------------|---------|
| Component（组件） | HAL Transport / Driver | 统一接口的模块化组件 |
| Pin（引脚） | Signal（信号原语） | 类型化的输入/输出端口 |
| Signal（信号） | HalTransport | 组件间数据通道 |
| Thread（线程） | 实时线程调度 | 固定周期函数调度 |
| Function（函数） | RT 回调 | 组件中的可调度代码 |

**AUDESYS 参考**: AUDESYS 的 `Signal` 原语（单写多读最新值覆盖）与 Machinekit HAL 的 `net` 信号概念一致，但 AUDESYS 增加了类型化（14 种类型 vs 4 种）和多节点通信（跨进程/跨网络）的能力。

#### 2. RTAPI 的 RTOS 无关抽象

Machinekit 的 RTAPI 提供了 **RTOS 无关的实时编程接口**，使组件无需修改即可运行在不同 RTOS 上。这一理念与 AUDESYS `amw`（AUDESYS Middleware）抽象层高度一致：

```
RTAPI (Machinekit)       amw (AUDESYS)
------------             -------------
hal_init()               HalTransport::init()
hal_create_thread()      AMW 线程管理
hal_export_funct()       RPC/Signal 回调注册
hal_add_funct_to_thread() 线程调度器
```

**AUDESYS 参考**: AUDESYS 的 `amw` 抽象层（D11）可参考 RTAPI 的设计模式，但 AUDESYS 在此基础上增加了更丰富的通信原语（Signal/StreamChannel/RPC）和更严格的 QoS（deadline/liveliness/security_domain）。

#### 3. 组件生成器（comp/instcomp）

Machinekit 的 comp 和 instcomp 组件生成器允许以极少的代码创建新的 HAL 组件。这一理念对 AUDESYS HAL 驱动开发有重要参考价值：

```c
// Machinekit comp — 10 行创建组件
component my_filter;
pin in float in;
pin out float out;
param rw float cutoff;
function _;
;;
// ... implementation

// 类似的对 AUDESYS HAL 组件的启示：
// 提供 amw 组件宏/DSL，使驱动开发标准化
// 减少重复的 boilerplate 代码
```

**AUDESYS 参考**: 如果 AUDESYS 未来提供 HAL 驱动 SDK，可借鉴 comp/instcomp 的声明式组件描述模式。

#### 4. 实时线程层次（servo-thread / base-thread）

Machinekit 的双线程层次（1kHz servo + 10kHz base）提供了清晰的实时调度模型：

| 线程 | 典型周期 | AUDESYS 对应 |
|------|---------|-------------|
| base-thread | 100μs (10kHz) | RT 数据面 (< 1μs) |
| servo-thread | 1ms (1kHz) | I/O 通信层 (~10μs) |
| (无对应) | - | 控制面/HMI (~100μs) |

**AUDESYS 参考**: AUDESYS 的延迟分层（D19: < 1μs / ~10μs / ~100μs）比 Machinekit 的线程层次更细粒度，但设计思路一致 — 将不同实时要求的任务分配到不同频率的线程中执行。

### 7.2 可移植/适配的技术模块

| 技术模块 | 描述 | 移植价值 |
|---------|------|---------|
| **HAL 组件库架构** | 200+ 现成组件的分类和接口设计 | 高，AUDESYS HAL 组件注册表可参考 |
| **RTAPI 抽象层** | RTOS 无关的实时 API | 中，amw 已经覆盖但理念一致 |
| **instcomp 实例化模式** | 运行时动态创建组件实例 | 高，AUDESYS 动态组件加载可参考 |
| **Machinetalk 协议** | WebSocket + Protobuf 远程控制 | 中，AUDESYS JSON-RPC 已有类似设计 |
| **halshow/halscope 调试工具** | HAL 状态可视化 | 高，AUDESYS Studio IDE 调试功能可借鉴 |
| **PRU 驱动模式** | 异构计算（主处理器 + 实时协处理器） | 高，如果 AUDESYS 需要 FPGA/MCU 协同 |
| **halcmd CLI 命令体系** | 统一命令行工具 | 中，AUDESYS CLI 工具设计参考 |

### 7.3 与 AUDESYS 定位的差异与互补

| 维度 | Machinekit | AUDESYS |
|------|-----------|---------|
| 核心定位 | 通用机器控制框架 | 工业控制系统模拟平台 |
| 目标用户 | CNC 集成商、机器人工程师 | 控制工程师、系统集成商 |
| 编程方式 | HAL 配置脚本 + G-code + PLC | 多种语言 + 可视化开发 |
| 实时性 | RT-PREEMPT / Xenomai 硬实时 | 硬实时 + 仿真双模 |
| 通信 | HAL 信号（本机） + Machinetalk（远程） | HAL 原语（Signal/StreamChannel/RPC）+ JSON-RPC |
| HAL 设计 | 组件 + 引脚 + 信号（4 种类型） | 通信原语（14 种类型 + String + Blob + Array） |
| 硬件支持 | ARM (BeagleBone/RPi) + x86 | 仿真为主 + HAL 接口 |
| 维护状态 | 基本停滞 | 早期开发（零源代码） |

**互补关系**：

- Machinekit 的 **HAL 设计哲学** 是 AUDESYS HAL 设计最直接的参考来源，但 AUDESYS 在通信原语、类型系统、QoS 等方面更加丰富
- Machinekit 的 **停滞教训** 对 AUDESYS 的长期维护策略有警示意义：大规模分叉 + 社区分裂导致开发者分散、项目停滞
- AUDESYS 的 **Simulator 功能** 可包含 Machinekit 的 HAL 场景仿真，使开发者无需物理硬件即可测试 HAL 组件
- Machinekit 的 **Machinetalk/WebSocket 远程架构** 为 AUDESYS Studio IDE 的远程调试功能提供了参考

### 7.4 详细对比分析：AUDESYS HAL 与 Machinekit HAL

| 维度 | Machinekit HAL | AUDESYS HAL（设计） |
|------|--------------|-------------------|
| 设计目标 | 机器控制组件互联（本机实时） | 完整的实时通信中间件（分布异构） |
| 抽象模型 | 电子面包板（组件/引脚/信号） | 通信原语（Signal/StreamChannel/RPC） |
| 原语数量 | 4 种（bit/float/s32/u32） | 14 种（11 标量 + String + Blob + Array<T>） |
| 线程模型 | base-thread + servo-thread | 多类型线程（RT/I/O/事件驱动） |
| 发现机制 | 无（静态 halcmd 配置） | HalDiscovery（anycast/group/unicast） |
| QoS | 无 | HalQoS（deadline/liveliness/security_domain） |
| 跨进程通信 | 共享内存（本机） | FlatBuffers over UDS（多语言） |
| 多机通信 | Machinetalk（WebSocket） | Zenoh（Phase 2） |
| 组件创建 | comp/instcomp 生成器 | HAL SDK（规划中） |
| 调试工具 | halshow/halscope/halmeter | Studio IDE 调试面板（规划中） |

Machinekit 的 HAL 是 **"单机实时控制组件互联"** 模型，而 AUDESYS 的 HAL 是 **"分布式异构实时通信中间件"**。两者在抽象层次和应用范围上有本质差异，但 Machinekit HAL 的简洁性和可组合性对 AUDESYS 有直接参考价值。

### 7.5 项目停滞的教训

Machinekit 从 2014 年分叉到 2024 年基本停滞，其教训对 AUDESYS 具有重要参考意义：

| 教训 | Machinekit 表现 | AUDESYS 应对 |
|------|---------------|-------------|
| **分叉成本高** | LinuxCNC 差异 20,000+ 提交，无法合并回线 | 零源代码阶段不依赖分叉，原始设计 |
| **社区分裂** | 贡献者从 155 人分散到 3 个仓库 | D34: hal-core 驱动并行，减少并行分裂 |
| **维护者疲劳** | 最后活跃贡献者减少到个位数 | D43: 关注 AI 辅助工具降低维护负担 |
| **平台绑定** | BeagleBone 深度绑定限制了通用性 | D19: 多语言策略确保跨平台 |
| **文档老化** | 部分文档与代码不一致 | D14: 独立详细设计文档策略 |
| **测试不足** | 缺乏 CI 测试基础设施 | D30: 三层 QA 体系从 Phase 0 开始 |

### 7.6 对 AUDESYS HAL 设计的具体参考点

1. **引脚类型系统** — Machinekit 仅 4 种类型（bit/float/s32/u32），AUDESYS 的 14 种类型覆盖更广但需注意不要太复杂
2. **线程命名约定** — base-thread/servo-thread 清晰表述了用途和速度，AUDESYS 可参考
3. **信号命名** — `<source>.<function>.<name>` 模式明确信号来源和用途
4. **配置分离** — .ini（系统配置）+ .hal（组件互联）的分离设计值得借鉴
5. **调试可视化** — halshow 的树形状态显示 + halscope 的波形显示是 HAL 调试的黄金标准

---

> **本文档基于 2026 年 7 月的公开信息编写。Machinekit 项目已基本停止开发，Machinekit-HAL 最后提交为 2024 年 9 月。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从 GitHub 仓库验证。**