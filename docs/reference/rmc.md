# RMC — 树莓派 SPI 运动控制器

> **开源 LinuxCNC SPI 运动控制方案集合 — STM32/RP2040 实时从站实现**
> 维护者：开源社区（iforce2d、Expatria-Technologies 等）
> 当前版本：多个实现并行发展（Remora、weenyPRU、FlexiHAL）
> 许可：GPL / LGPL / CERN-OHL-S v2
> 官网：https://github.com/iforce2d/Remora、https://github.com/iforce2d/weenyPRU

---

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: RMC（Raspberry Pi Motion Controller），社区常用称 "Remora SPI" 或 "RMC SPI 极客方案"
- **开发商/组织**: 开源社区协作项目，核心贡献者包括 Remora（iforce2d/Remora）、weenyPRU（iforce2d/weenyPRU）、FlexiHAL（Expatria-Technologies）
- **首次发布年份**: 约 2017 年（Remora 项目）
- **当前状态**: 活跃维护 — Remora、weenyPRU、FlexiHAL 等多个实现并行发展
- **仓库地址**: https://github.com/iforce2d/Remora、https://github.com/iforce2d/weenyPRU、https://github.com/Expatria-Technologies/FlexiHAL_2350
- **许可证**: GPL / LGPL（社区开源），FlexiHAL 2350 为 CERN-OHL-S v2

#### 项目背景

RMC 并非单一产品，而是指一类 **基于树莓派（Raspberry Pi）SPI 接口驱动 STM32/RP2040 等 MCU 实现运动控制** 的开源方案集合。这类方案的核心架构是：

1. **树莓派**（主机端）运行 LinuxCNC + PREEMPT_RT 内核，负责 G 代码解析、轨迹规划、HAL 配置
2. **MCU**（实时端）通过 SPI 总线与树莓派通信，执行精确的 Step/Dir 脉冲生成、编码器读取、PWM 输出等实时任务
3. **SPI 通信层** 作为主机端 HAL 驱动与 MCU 固件之间的桥梁

与 Mesa FPGA 方案（$150-500）相比，RMC 方案（$20-50）成本极低，适合个人 DIY、教育和小型制造场景。与并口方案相比，SPI 接口更稳定、距离更短（< 30cm），但受限于树莓派的 SPI 性能。

RMC 方案的核心价值在于：**将实时任务从主机端卸载到 MCU**。LinuxCNC 在标准 PC/树莓派上运行，通过 SPI 将位置/速度命令发送给 MCU；MCU 在裸机/RTOS 上精确生成 Step/Dir 脉冲。这解决了 LinuxCNC 在非实时硬件上运行时的抖动问题。

#### 与 Mesa hostmot2 的关系

Mesa's hostmot2 FPGA 固件提供多种模块（stepgen、pwmgen、encoder）通过 hm2_spix 驱动支持 SPI 通信。RMC 方案与其在 HAL 驱动层处于同一抽象级别，但实现方式不同：

| 维度 | Mesa FPGA | RMC（MCU）|
|------|-----------|-----------|
| 实时实现 | FPGA 硬件逻辑 | MCU 固件（裸机/RTOS）|
| 成本 | $100-500 | $3-50 |
| 轴数扩展 | 编译时配置 FPGA 位流 | 固件更新 |
| 开源程度 | 固件开源，需 Xilinx ISE | 完全开源，GCC/ARM 工具链 |
| 生产适用 | 工业级 | 爱好者/小批量 |

### 1.2 产品定位与核心价值主张

RMC 系列方案定位为 **低成本、开源、LinuxCNC 兼容的嵌入式运动控制器**，核心价值主张：

1. **极低成本**: STM32F4 "Blue Pill" $3 + 树莓派 $35 = $38，远低于 Mesa FPGA 板卡
2. **LinuxCNC 原生兼容**: 通过 HAL 驱动（remora、weeny 等）无缝集成 LinuxCNC 生态
3. **完全开源**: 主机 HAL 驱动 + MCU 固件双端开源，可自由定制
4. **灵活配置**: 3-6 轴步进、编码器、PWM 主轴、数字 I/O，按需求裁剪
5. **社区驱动**: 多个独立实现（Remora、weeny、FlexiHAL）并行演进，形成良性竞争

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| CNC DIY 爱好者 | 3-6 轴雕刻机、等离子切割机、3D 打印机升级 | 低成本、开源、LinuxCNC 兼容 |
| 教育与研究 | 运动控制系统教学、嵌入式实时 I/O 实验 | 完全可见的实现、低成本硬件 |
| 小型制造 | 旧机床控制系统升级 | 替代停产控制板卡 |
| 极客开发者 | 自定义嵌入式运动控制固件 | 开源固件、可修改源代码 |
| Maker 创客 | 机器人/自动化项目原型 | 快速原型、灵活的 I/O 配置 |

### 1.4 许可证模型

| 方案 | 许可证 | 商业使用 |
|------|--------|---------|
| Remora | GPL | 需开源衍生作品 |
| weenyPRU | GPL | 需开源衍生作品 |
| FlexiHAL 2350 | CERN-OHL-S v2 | 硬件开源，商用需遵守 CERN-OHL-S |

### 1.5 项目成熟度评估

| 评估维度 | 状态 | 说明 |
|---------|------|------|
| 功能完整性 | 中 | 核心功能（步进、编码器、PWM）已实现，但依赖社区维护 |
| 代码质量 | 中 | 部分项目维护者较多，代码结构相对清晰 |
| 文档完整性 | 中 | GitHub README + 部分 Wiki，不如商业产品完善 |
| 测试覆盖 | 低 | 无自动化测试框架，依赖用户验证 |
| 社区贡献 | 中 | 多个独立项目，合计贡献者 10-30 人 |
| 商业支持 | 无 | 纯开源社区项目 |

---

## 2. 技术特性

### 2.1 核心架构

RMC 系列方案采用 **主机 + 实时从站** 的分布式架构：

```
+------------------+      SPI      +---------------------------+
|  树莓派 (主机端)   | <------------> |  MCU (STM32/RP2040 从站)  |
|                  |                |                           |
| LinuxCNC + PREEMPT_RT |            | 实时固件                   |
|                  |                |                           |
| - G 代码解析      |                | - Step/Dir 脉冲生成       |
| - 轨迹规划       |                | - 编码器读取               |
| - HAL 驱动       |                | - PWM 主轴控制              |
| - remora/weeny   |                | - 数字 I/O                 |
|   HAL 组件       |                |                           |
+------------------+                +---------------------------+
        |                                    |
        v                                    v
  LinuxCNC HAL           SPI 通信          物理 I/O
  (用户空间实时)       (主机 ↔ 从站)       (步进/编码器)
```

**架构特点**：
- 树莓派负责所有非实时任务（G 代码解析、轨迹规划、UI），MCU 负责所有实时任务
- SPI 是唯一的实时通信通道，无 OS 调度延迟
- MCU 固件在裸机或 FreeRTOS 上运行，无内核干扰

### 2.2 典型实现：Remora

Remora（iforce2d/Remora）是最成熟的 RMC 方案之一：

| 特性 | 参数 |
|------|------|
| 支持轴数 | 3-6 轴 |
| 步进频率 | 最高 50kHz |
| 编码器 | 高速编码器（A/B/Z 相）|
| PWM 主轴 | 10kHz PWM 输出 |
| 数字 I/O | 可编程输入/输出 |
| 通信接口 | SPI（树莓派原生）|
| 实时性能 | MCU 内执行，无 OS 干扰 |
| 开发平台 | STM32F4xx |

**Remora 的关键设计**：
- MCU 固件通过 SPI 接收树莓派发来的位置/速度命令
- MCU 内部实现梯形加减速曲线，实时生成 Step/Dir 脉冲
- 支持多轴同步插补（线性、圆弧）
- 固件可通过 SD 卡或 SPI 烧录

### 2.3 典型实现：weenyPRU

weenyPRU（iforce2d/weenyPRU）是另一独立实现，以 "Blue Pill"（STM32F103C8）为目标：

| 特性 | 参数 |
|------|------|
| 步进轴数 | 4 轴，最高 50kHz |
| 编码器 | 单路正交编码器（手动进给，非闭环）|
| PWM 主轴 | 10kHz（3.3V）|
| 数字 I/O | 4 路光耦输入 + 9 路可编程 I/O |
| 模拟输入 | 2 路（用于手动进给摇杆）|
| 扩展功能 | WS2812 RGB LED、TMC2209 驱动控制、HX711 称重 |
| 通信接口 | SPI |
| 开发平台 | STM32F103C8（Blue Pill）|

**weenyPRU 的独特之处**：
- 支持 TMC2209 步进驱动器（UART 控制微步和电流）
- 支持 WS2812 RGB LED 条（最多 16 个，从 HAL 控制）
- HAL 驱动生成大量可编程引脚（weeny.input.00-15, weeny.output.00-15）
- HX711 称重传感器输入（互斥于 RGB LED）
- DS3502 数字电位器（I2C）控制

### 2.4 典型实现：FlexiHAL 2350

FlexiHAL 2350（Expatria-Technologies）是较新的实现，基于 RP2350：

| 特性 | 参数 |
|------|------|
| 主控 | RP2350（RP2040 后继，150MHz + FPU）|
| I/O 扩展 | 第二颗 RP2040（FlexGPIO 通过 I2C 扩展）|
| 支持软件 | LinuxCNC（Remora 端口）、GRBLHAL、未来 uCNC |
| 轴数 | 多轴（RP2350 PIO 支持）|
| 电源 | 12-24V 输入，板载 DC-DC 降压 |
| 开发板兼容 | 树莓派 GPIO 40-pin 直接插接 |
| 抗干扰设计 | EMI-resistant I/O 平台 |

### 2.5 SPI 通信性能分析

树莓派 SPI 性能是 RMC 方案的瓶颈：

| 树莓派型号 | SPI0 最大时钟 | SPI1 最大时钟 | 伺服线程性能 |
|-----------|-------------|-------------|------------|
| RPi 3B/3B+ | ~12.5 MHz | ~12.5 MHz | ~250 Hz 受限 |
| RPi 4B | ~50 MHz | ~50 MHz | 1 kHz 无问题 |
| RPi 5 | ~62.5 MHz | ~62.5 MHz | 1 kHz+ 充足 |

**关键限制**：
- hm2_spix 驱动（统一 SPI 驱动）支持 RPi 3/4/5，但 RPi 5 性能明显更优
- RPi 3B+ 勉强可用，但伺服线程频率受限（~250 Hz）
- 推荐使用 RPi 4B 或 RPi 5 以获得 1 kHz 伺服线程能力
- 需在 PREEMPT_RT 内核下运行，且禁用 CPU 动态调频（scaling_governor=performance）

### 2.6 LCNC-TMC5160 对比方案

LCNC-TMC5160（3404gerber）是另一个基于树莓派 SPI 的 LinuxCNC 方案，但它采用 **Full SPI 模式** 直接驱动 TMC5160 步进驱动器，无需中间 MCU：

| 特性 | RMC（Remora）| LCNC-TMC5160 |
|------|-------------|-------------|
| 架构 | 树莓派 -> SPI -> MCU -> Step/Dir | 树莓派 -> SPI -> TMC5160 |
| 轴数 | 3-6 轴 | 每 SPI 通道最多 6 驱动器 |
| 步进控制 | MCU 软件梯形加减速 | TMC5160 内部斜坡发生器 |
| 位置反馈 | 编码器 | TMC5160 内部位置读取 |
| 难点 | 需要 MCU 固件 | 需 PID 修正速度+时间定位 |
| RPi 兼容 | RPi 3/4/5 | RPi 4（SPI0）/ RPi 5（SPI0+SPI1）|

---

## 3. 功能概览

### 3.1 Remora 功能矩阵

| 功能 | 状态 | 说明 |
|------|------|------|
| 多轴 Step/Dir 输出 | 已实现 | 3-6 轴，最高 50kHz |
| 正交编码器读取 | 已实现 | 高速编码器，A/B/Z 相 |
| PWM 主轴控制 | 已实现 | 10kHz PWM，可调占空比 |
| 数字 I/O | 已实现 | 可编程输入/输出 |
| 梯形加减速 | 已实现 | MCU 内部实现 |
| 多轴插补 | 已实现 | 线性、圆弧插补 |
| G 代码解析 | 树莓派端 | LinuxCNC 负责 |
| 配置方式 | SD 卡 | 通过 SD 卡更新 MCU 配置 |

### 3.2 weenyPRU 功能矩阵

| 功能 | 状态 | 说明 |
|------|------|------|
| 4 轴 Step/Dir 输出 | 已实现 | 最高 50kHz |
| PWM 主轴 | 已实现 | 10kHz，3.3V |
| 高速编码器 | 已实现 | 单路，x4 解码 |
| 光耦输入 | 已实现 | 4 路，高压限位开关 |
| 可编程 I/O | 已实现 | 9 路，3.3V 电平 |
| TMC2209 控制 | 已实现 | UART 控制微步和电流 |
| WS2812 RGB LED | 已实现 | 最多 16 个 |
| HX711 称重 | 已实现 | 与 RGB LED 互斥 |
| 模拟输入 | 已实现 | 2 路，手动进给 |

### 3.3 FlexiHAL 2350 功能矩阵

| 功能 | 状态 | 说明 |
|------|------|------|
| 多轴 Step/Dir 输出 | 已实现 | RP2350 PIO |
| I/O 扩展 | 已实现 | 第二颗 RP2040 FlexGPIO |
| LinuxCNC 支持 | 已实现 | Remora 端口 |
| GRBLHAL 支持 | 已实现 | 替代方案 |
| 树莓派直插 | 已实现 | 40-pin GPIO 兼容 |

---

## 4. 现状与生态

### 4.1 当前开发状态

| 项目 | 维护状态 | 最近更新 | 活跃程度 |
|------|---------|---------|---------|
| Remora | 活跃 | 持续 | 中 |
| weenyPRU | 活跃 | 持续 | 中 |
| FlexiHAL 2350 | 活跃 | 2024+ | 中 |
| remora-docs | 活跃 | 持续 | 低 |
| LCNC-TMC5160 | 活跃 | 2025+ | 中 |

### 4.2 关联生态

**Remora 文档**：https://remora-docs.readthedocs.io 提供了完整的安装、配置、使用指南。

**LinuxCNC 官方支持**：LinuxCNC 2.9+ 正式支持树莓派 5，提供 PREEMPT_RT 内核镜像，RMC 方案是官方推荐的低成本方案之一。

**硬件生态系统**：
- 树莓派 3B+/4B/5：主机端，提供 SPI 接口和 PREEMPT_RT 内核
- STM32F4xx / STM32F103：MCU 端，执行实时控制
- RP2350（FlexiHAL）：新一代 MCU 端方案
- TMC5160/TMC2209：智能步进驱动器，支持 SPI/UART 配置
- RRW_LAB：Remora RPi/W5500 LinuxCNC 适配板

**社区工具**：
- halcompile：LinuxCNC HAL 组件编译器，用于编译 remora/weeny HAL 驱动
- mesaflash：固件烧录工具（部分兼容 RMC 方案）
- remora-docs：Remora 文档站点

### 4.3 与 LinuxCNC 的关系

RMC 方案是 LinuxCNC 生态的重要组成部分：

```
LinuxCNC HAL 层
├── remora HAL 驱动（SPI 通信 + Step/Dir）
├── weeny HAL 驱动（SPI 通信 + 多 I/O）
├── hm2_spix HAL 驱动（Mesa SPI 板卡）
└── hm2_rpspi HAL 驱动（旧版 Mesa SPI）
```

RMC 方案的 HAL 驱动与 Mesa 的 hm2_spix 属于同一抽象层，用户可根据成本/功能需求选择。

### 4.4 相关技术栈

| 技术 | 关系 | 说明 |
|------|------|------|
| LinuxCNC | 主机端 CNC 系统 | RMC 作为 LinuxCNC 的 HAL 设备 |
| PREEMPT_RT | 实时内核 | 树莓派需运行 PREEMPT_RT 内核 |
| HAL（Hardware Abstraction Layer）| 硬件抽象 | remora/weeny 通过 HAL 与 LinuxCNC 集成 |
| STM32 HAL | MCU 固件框架 | FreeRTOS + STM32 HAL 库 |
| RP2040/RP2350 SDK | MCU 固件框架 | Raspberry Pi Pico SDK |

### 4.5 与其他开源运动控制方案的关系

| 方案 | 关系 | 互补性 |
|------|------|--------|
| hm2-rp2040 | 同属 LinuxCNC SPI 生态 | 一个用 RP2040（hm2-rp2040），一个用 STM32（RMC）|
| Remora W5500 | RMC 的 Ethernet 变体 | 替代 SPI，通过 W5500 实现 Ethernet 通信 |
| LCNC-TMC5160 | 补充方案 | 直接驱动 TMC5160，无需中间 MCU |
| Rpi2Cnc | 直接 GPIO 方案 | 无需 MCU，直接 GPIO 输出（功能有限）|

---

## 5. 市场定位

### 5.1 在运动控制生态中的位置

RMC 系列方案填补了 **Mesa FPGA 板卡** 和 **并口方案** 之间的空白：

| 方案 | 成本 | 轴数 | 成熟度 | 特点 |
|------|------|------|--------|------|
| Mesa 7i96S | ~$250 | 6 轴 | 高 | 工业级，FPGA 确定性 |
| Mesa 7i92 | ~$200 | 4 轴 | 高 | 工业级，FPGA |
| RMC（Remora）| ~$38 | 3-6 轴 | 中 | MCU 实现，开源 |
| RMC（weeny）| ~$38 | 4 轴 | 中 | 功能丰富，开源 |
| RMC（FlexiHAL）| ~$35 | 多轴 | 中 | RP2350，新平台 |
| 并口方案 | ~$0 | ≤6 轴 | 高 | 已淘汰，距离限制 |

### 5.2 竞争替代品对比

| 方案 | 价格 | 轴数 | 实时性 | 成本/轴 |
|------|------|------|--------|--------|
| Mesa 7i96S | ~$250 | 6 轴 | FPGA 硬件 | ~$42/轴 |
| Mesa 7i92 | ~$200 | 4 轴 | FPGA 硬件 | ~$50/轴 |
| RMC Remora | ~$38 | 3-6 轴 | MCU 实时 | ~$6-13/轴 |
| RMC weeny | ~$38 | 4 轴 | MCU 实时 | ~$10/轴 |
| RMC FlexiHAL | ~$35 | 多轴 | MCU+PIO | ~$6-12/轴 |
| 并口方案 | ~$0 | ≤6 轴 | 软件 | ~$0/轴 |

### 5.3 成本效益分析

| 方案 | 树莓派 | MCU | 总成本 | 轴数 | 轴成本 |
|------|--------|-----|--------|------|--------|
| Remora STM32F4 | $35 | $3 | $38 | 3-6 | $6-13 |
| weenyPRU Blue Pill | $35 | $1.5 | $36.5 | 4 | $9 |
| FlexiHAL 2350 | $35 | $0 集成 | $35 | 多轴 | $6-12 |
| RRW_LAB 3轴 | $35 | $5 | $40 | 3 | $13 |

### 5.4 技术风险与挑战

| 风险 | 级别 | 缓解措施 |
|------|------|---------|
| SPI 带宽限制 | 中 | 使用 RPi 5 或升级 Ethernet（W5500）|
| MCU 步进频率不足 | 中 | 使用更高性能 MCU（STM32F4/RP2350）|
| LinuxCNC PREEMPT_RT 兼容 | 低 | LinuxCNC 2.9+ 官方支持 RPi 5 |
| 各方案碎片化 | 中 | remora-docs 提供统一入口 |
| TMC 智能驱动依赖 | 低 | 传统 Step/Dir 仍兼容 |

---

## 6. 产品特色

### 6.1 核心差异化特征

| 特征 | RMC | Mesa FPGA | 并口 | 说明 |
|------|-----|-----------|------|------|
| 成本 | $35-50 | $100-500 | $0 | RMC 低于 FPGA |
| 实时性 | MCU 固件 | FPGA 硬件 | 软件 | FPGA > MCU > 软件 |
| 开源度 | 完全开源 | 固件开源 | N/A | RMC 完全自由 |
| 可修改性 | C 代码 | Verilog | N/A | C 更易修改 |
| 便捷性 | 需配置 SPI | 开箱即用 | 即插即用 | RMC 门槛中等 |
| 远程 | 不支持 | Ethernet 支持 | 不支持 | |

### 6.2 架构创新：实时卸载

RMC 方案的最核心创新是 **将 LinuxCNC 的实时任务卸载到独立 MCU**：

```
传统架构：
PC/LinuxCNC (软件实时) --并口/GPIO--> 步进驱动器
                            ^ __ ^
                        抖动大，实时性差

RMC 架构：
树莓派/LinuxCNC (非实时) --SPI--> MCU (裸机实时) --Step/Dir--> 步进驱动器
                                                          ^
                                              抖动小，实时性高
```

这个架构的核心优势：
- 树莓派运行标准 Linux + PREEMPT_RT，不需要专用实时硬件
- MCU 以确定性方式生成 Step/Dir 脉冲，不受 Linux 调度影响
- SPI 总线延迟低（微秒级），远优于网络或 USB 方案

### 6.3 weenyPRU 的扩展 I/O 能力

weenyPRU 提供了最丰富的扩展 I/O 能力：

| 外设 | 控制方式 | 用途 |
|------|---------|------|
| WS2812 RGB LED | 从 HAL 引脚控制 | 状态指示、装饰灯光 |
| TMC2209 | UART 控制 | 微步和电流动态调整 |
| XGZP 压力传感器 | I2C | 气动系统监控 |
| DS3502 数字电位计 | I2C | VFD 主轴速度控制（替代 0-10V）|
| HX711 称重传感器 | 专用接口 | 力/重量测量 |

### 6.4 FlexiHAL 2350 的抗干扰设计

FlexiHAL 2350 是唯一专门针对 EMI 环境设计的 RMC 方案：
- EMI-resistant I/O 平台设计
- 12-24V 工业电压输入
- 板载 DC-DC 隔离转换
- 40-pin GPIO 直接插接，无需飞线
- 支持 CERN-OHL-S v2 开源硬件许可证

---

## 7. 对 AUDESYS 参考价值

### 7.1 实时任务卸载架构

RMC 方案的核心架构—将实时任务从主机卸载到 MCU—对 AUDESYS 的 HAL 设计有直接参考意义。

AUDESYS 的 HAL 设计包含三种线程（RT、I/O、事件驱动）。RMC 方案提供了一个已验证的参考：**非 RT 主机 + MCU 实时从站** 的分布式架构。

| 层面 | RMC 方案 | AUDESYS HAL 对应 |
|------|---------|-----------------|
| 主机端 | LinuxCNC + PREEMPT_RT | AUDESYS Runtime |
| 实时任务 | MCU 固件（Step/Dir/PWM） | HalTransport RT 线程 |
| 通信层 | SPI 总线 | HalTransport（UDS/Zenoh）|
| 通信协议 | 自定义 UDP/SPI 协议 | Signal / StreamChannel |
| I/O 抽象 | HAL 驱动 | HalDiscovery / HalQoS |

### 7.2 SPI 通信层对 AUDESYS 的启示

RMC 方案的 SPI 通信层设计简单而高效，对 AUDESYS 的 HalTransport 设计有参考价值：

| RMC SPI 通信设计 | AUDESYS 启示 |
|-----------------|-------------|
| 固定 SPI 时钟 + 确定性延迟 | AUDESYS HalTransport 应提供确定性延迟保证 |
| 主机发送位置/速度命令，MCU 执行 | Signal/StreamChannel 的单写多读模型 |
| SPI 总线无 OS 调度干扰 | RT 线程应直接操作共享内存 |
| 通过 SPI 片选线多通道扩展 | 多 StreamChannel 复用单一总线 |
| 主机端 SPI 驱动调度优化（cpufreq）| HalTransport 需考虑平台性能调优 |

### 7.3 固件 HAL 实现

RMC 方案的 MCU 固件本身就是 HAL 的嵌入式实现：

```
MCU 固件内部结构：
+-------------------------------+
| SPI 协议层（命令解析/响应）    |
+-------------------------------+
| 运动控制层（加减速/插补）      |
+-------------------------------+
| 物理 I/O 层（GPIO/PWM/编码器） |
+-------------------------------+
```

这对应 AUDESYS HAL 的三层设计：
1. **通信层** - HalTransport（对应 SPI 协议层）
2. **控制层** - Signal/StreamChannel 处理（对应运动控制层）
3. **物理层** - 硬件抽象（对应物理 I/O 层）

### 7.4 多轴同步方案

RMC 方案的多轴同步通过 MCU 固件实现（单 MCU 控制多轴），这为 AUDESYS 的多轴同步提供了参考：

| 实现 | 同步方式 | 精度 | 适合场景 |
|------|---------|------|---------|
| 单 MCU 多轴（Remora）| 同周期 SPI 命令 | 高（单 MCU）| 3-6 轴小型机床 |
| 多 MCU 多轴（分布式）| 共享同步信号 | 中（需同步）| 多轴分离系统 |
| FPGA 多轴（Mesa）| 硬件逻辑同步 | 极高 | 工业级多轴 |
| TMC5160 多轴（LCNC）| SPI 链式控制 | 中 | 需要 PID 补偿 |

### 7.5 SPI vs Ethernet 的选择

RMC 方案的 SPI + Ethernet（Remora W5500）双路径选择对 AUDESYS 的 HalTransport 设计有直接参考意义：

| 维度 | SPI | Ethernet（W5500）|
|------|-----|-----------------|
| 延迟 | < 10us | ~43us |
| 带宽 | ~12-62 MHz | 100 Mbit/s |
| 距离 | < 30cm | 100m+ |
| 电气隔离 | 需光耦 | Ethernet 变压器 |
| 多设备 | 点对点 | 网络拓扑 |
| AUDESYS 适用场景 | 同机柜短距 | 分布式 I/O |

AUDESYS 可根据物理部署距离选择通信方式，RMC 方案证明了 SPI 和 Ethernet 的物理 I/O 可行性。

### 7.6 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 中 | Remora 经社区验证，FlexiHAL 较新 |
| 性价比 | 很高 | $35-50 实现全功能 CNC 控制 |
| AUDESYS HAL 参考 | 高 | 实时卸载 + SPI 通信 + HAL 抽象层 |
| 学习价值 | 高 | 嵌入式运动控制固件设计 |
| 生产准备 | 低 | 适合原型和爱好者，工业级需 Mesa |

RMC 方案展示了 **分布式实时控制** 的基本模式 — 主机（非实时）+ 从站（实时）的分离架构。AUDESYS 在设计和实现自己的 HAL 层时，可直接借鉴 RMC 方案中经过社区验证的 SPI 通信协议、任务隔离模式和 MCU 固件 HAL 架构。

---

> **本文档基于 2026 年 7 月的公开信息编写。RMC 方案涉及多个独立开源项目（Remora、weenyPRU、FlexiHAL），具体功能和兼容性需以各项目官方文档为准。标注 "待确认" 的信息表示当前公开资料不足以确定。**

### 5.3 局限性分析

| 局限性 | 影响 | 是否可解决 |
|--------|------|-----------|
| SPI 距离限制 (< 30cm) | 主机和 MCU 需近距离安装 | Ethernet（W5500）变体可解决 |
| 多轴精确同步 | 非单一 MCU 控制 | 使用更高性能 MCU 或 FPGA 方案 |
| LinuxCNC 版本依赖 | 特定 LinuxCNC 版本仅支持特定驱动 | 跟随官方更新 |
| 缺少闭环控制 | 大多数方案无编码器反馈 | weenyPRU 部分支持，FlexiHAL 规划中 |
| MCU 固件刷写 | 非标准化刷写流程 | Remora 支持 SD 卡，其他需工具链 |

### 5.4 成本效益分析

| 方案 | MCU | 树莓派 | 总成本 | 轴数 | 轴成本 | 适用场景 |
|------|-----|--------|--------|------|--------|---------|
| Remora STM32F4 | $3-5 | $35 | $38-40 | 3-6 | $6-13 | 多轴通用 |
| weenyPRU Blue Pill | $1.5 | $35 | $36.5 | 4 | $9 | 功能丰富 |
| FlexiHAL 2350 | 集成 RP2350 | $35 | $35 | 多轴 | $6-12 | 新一代方案 |
| RRW_LAB W5500 | $5 STM32 | $0(自备) | $25-30 | 3-5 | $6-10 | Ethernet 版本 |
| LCNC-TMC5160 | 无(直接驱动) | $35 | $35 | 6 | $6 | 高性能步进 |

### 5.5 技术路线选择决策树

```
RMC 方案选择决策树:

需要实时闭环控制？
├── 是 → 需要编码器反馈？
│   ├── 是 → FlexiHAL (RP2350 PIO 编码器)
│   └── 否 → Remora (6 轴, 成熟)
└── 否 → 只需要 Step/Dir 开环？
    ├── 是 → weenyPRU (功能最丰富)
    └── 否 → LCNC-TMC5160 (高性能 SPI)

需要 Ethernet？
├── 是 → RRW_LAB / Remora W5500
└── 否 → SPI 直连 (成本最低)

MCU 偏好？
├── STM32 → Remora / weenyPRU
├── RP2040 → hm2-rp2040 (Mesa 兼容)
└── RP2350 → FlexiHAL (未来)
```

---

## 6. 产品特色 (续)

### 6.1 核心差异化特征

| 特征 | RMC | Mesa FPGA | 并口 | 说明 |
|------|-----|-----------|------|------|
| 成本 | $35-50 | $100-500 | $0 | RMC 大幅低于 FPGA |
| 实时性 | MCU 固件 | FPGA 硬件 | 软件(差) | FPGA > MCU > 软件 |
| 开源度 | 完全开源 | 固件开源 | N/A | RMC 完全可控 |
| 可修改性 | C 代码 | Verilog/Xilinx | N/A | C 门槛更低 |
| 便捷性 | 需配置 SPI | 开箱即用 | 已淘汰 | RMC 门槛中等 |
| 远程支持 | 部分(W5500) | 支持 | 不支持 | |

### 6.2 任务卸载架构创新

RMC 最核心的创新是 **将 LinuxCNC 的实时任务卸载到独立 MCU**：

```
传统架构：
  主机 (软件实时) ---并口---> 步进驱动器
  问题：软件抖动大，实时性差

RMC 架构：
  树莓派 (非实时) --SPI--> MCU (裸机) --Step/Dir--> 步进驱动器
  优势：MCU 确定性执行，不受 Linux 调度影响
```

架构优势量化：
- 标准 LinuxCNC 并口方案：伺服线程抖动 ~50-200us（取决于硬件）
- RMC MCU 方案：Step/Dir 生成抖动 < 1us（裸机执行）
- SPI 通信延迟：RPi 5 上 < 5us 单向

### 6.3 多轴同步与运动学

| 同步方式 | 精度 | 实现 | 适用 |
|---------|------|------|------|
| 单 MCU 多轴 | 高 | 同周期 SPI 更新 | 3-4 轴雕刻机 |
| 多 MCU 多轴 | 中 | 共享 SYNC 信号 | 独立系统 |
| 单 MCU + TMC5160 | 中 | 需要 PID 补偿 | 高性能应用 |

### 6.4 weenyPRU 独特扩展能力

| 外设 | 接口 | 配置方式 | 用途 |
|------|------|---------|------|
| WS2812 RGB LED | HAL 引脚 | weeny.rgb.ledN | 状态指示 |
| TMC2209 | UART | weeny.tmc.N.param | 微步/电流调整 |
| DS3502 数字电位计 | I2C | HAL 引脚 | VFD 控制 (0-10V) |
| HX711 称重 | 专用 | weeny.loadcell | 力传感器 |

### 6.5 FlexiHAL 2350 抗干扰设计

| 设计特性 | 说明 | 工业意义 |
|---------|------|---------|
| EMI-resistant I/O | 抗电磁干扰设计 | 工业环境稳定运行 |
| 12-24V 工业电压 | 板载 DC-DC 降压 | 无需额外电源转换 |
| 40-pin 直插 | 无需飞线 | 降低噪声耦合 |
| CERN-OHL-S v2 | 开源硬件许可证 | 可自由使用和修改 |

---

## 7. 对 AUDESYS 参考价值 (续)

### 7.1 实时任务卸载架构

RMC 方案的核心架构—将实时任务从主机卸载到 MCU—对 AUDESYS 的 HAL 设计有直接参考意义：

| 层面 | RMC 方案 | AUDESYS HAL 对应 |
|------|---------|-----------------|
| 主机端 | LinuxCNC + PREEMPT_RT | AUDESYS Runtime |
| 实时任务 | MCU 固件 | HalTransport RT 线程 |
| 通信层 | SPI 总线 | HalTransport (UDS/Zenoh) |
| 通信协议 | 自定义 SPI 协议 | Signal / StreamChannel |
| I/O 抽象 | HAL 驱动 | HalDiscovery / HalQoS |

### 7.2 SPI 通信层启示

| RMC SPI 设计 | AUDESYS 启示 |
|-------------|-------------|
| 固定时钟 + 确定性延迟 | HalTransport 应提供确定性延迟保证 |
| 主机发命令，MCU 执行 | Signal 单写多读模型 |
| 无 OS 调度干扰 | RT 线程直接操作共享内存 |
| 多片选扩展 | 多 StreamChannel 复用 |

### 7.3 固件 HAL 三层结构

```
MCU 固件（实时 HAL）：
+-----------------------+
| SPI 协议层            | -- HalTransport 对应
+-----------------------+
| 运动控制层(加减速)    | -- Signal/StreamChannel 对应
+-----------------------+
| 物理 I/O层(GPIO/PWM)  | -- 硬件抽象对应
+-----------------------+
```

### 7.4 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 中 | Remora 社区验证，FlexiHAL 较新 |
| 性价比 | 很高 | $35-50 全功能 CNC 控制 |
| AUDESYS HAL 参考 | 高 | 实时卸载 + SPI + HAL 抽象 |
| 学习价值 | 高 | 嵌入式运动控制固件 |
| 生产准备 | 低 | 原型/爱好者，工业级需 Mesa |

RMC 方案的 **分布式实时控制模式** 直接映射到 AUDESYS 的 HAL 设计——主机非实时 + 从站实时分离架构。AUDESYS 可借鉴 SPI 通信协议、任务隔离和 MCU 固件 HAL 架构。

---

> **本文档基于 2026 年 7 月的公开信息编写。RMC 方案涉及多个独立开源项目，具体以各项目官方文档为准。**


### 7.5 SPI 实时通信协议设计

RMC 方案的 SPI 通信协议为 AUDESYS 的实时数据传输提供了参考模型：

| 协议要素 | RMC 方案 | AUDESYS 对应设计 |
|---------|---------|----------------|
| 数据帧格式 | 固定长度（位置/速度命令）| StreamChannel 数据包格式 |
| 传输频率 | 伺服线程周期（如 1kHz）| RT 线程周期 |
| 错误检测 | CRC / 序列号 | HalQoS 错误策略 |
| 同步机制 | 同周期 SPI 更新 | SYNC 同步 |
| 数据优先级 | Step/Dir > I/O > 配置 | HalQoS 优先级标签 |

### 7.6 平台选择建议

| AUDESYS 原型阶段 | 推荐 RMC 参考方案 | 理由 |
|----------------|-----------------|------|
| 概念验证 | weenyPRU (STM32F103) | 成本最低、社区支持好 |
| 功能原型 | Remora (STM32F4) | 轴数多、成熟度高 |
| 性能验证 | FlexiHAL 2350 (RP2350) | 最新平台、FPU+PIO |
| 分布式 I/O | RRW_LAB W5500 | Ethernet 远距离 |

### 7.7 HAL 驱动设计参考

RMC 方案的 HAL 驱动（remora.c、weeny.c）是 AUDESYS 设计 HAL 驱动的直接参考：

| HAL 驱动特征 | RMC | AUDESYS |
|-------------|-----|---------|
| 驱动语言 | C（LinuxCNC HAL 组件）| Rust |
| 模块注册 | halcompile | Cargo 模块 |
| 引脚定义 | 固定引脚数量 | Signal 命名空间 |
| 函数注册 | addf 绑定到线程 | RT/I/O 线程绑定 |
| 配置接口 | ini 文件 | YAML 配置 |



### 2.7 LinuxCNC HAL 驱动集成模式

RMC 方案的 HAL 组件以 halcompile 方式编译为 .so 动态库，加载到 LinuxCNC 实时空间：

**Remora HAL 驱动注册示例**：
```c
// remora.c — LinuxCNC HAL 组件
#include "rtapi.h"
#include "hal.h"

// HAL 引脚定义
static hal_float_t *remora_pos_cmd[6];  // 轴位置命令 (6轴)
static hal_bit_t   *remora_step[6];     // 步进脉冲
static hal_bit_t   *remora_dir[6];      // 方向信号
static hal_float_t *remora_feedback[6]; // 编码器反馈

// 组件初始化
int rtapi_app_main(void) {
    int comp_id = hal_init("remora");
    int axis;

    // 导出引脚
    for (axis = 0; axis < 6; axis++) {
        hal_pin_float_newf(HAL_OUT, &remora_pos_cmd[axis],
                          comp_id, "remora.%d.pos-cmd", axis);
        hal_pin_bit_newf(HAL_IN, &remora_step[axis],
                        comp_id, "remora.%d.step", axis);
        hal_pin_bit_newf(HAL_IN, &remora_dir[axis],
                        comp_id, "remora.%d.dir", axis);
    }

    // 注册实时函数
    hal_export_funct("remora.read", remora_read, &remora_data,
                     0, 0, comp_id);
    hal_export_funct("remora.write", remora_write, &remora_data,
                     0, 0, comp_id);

    hal_ready(comp_id);
    return 0;
}
```

**LinuxCNC HAL 配置文件**：
```hal
# remora.hal — 加载 RMC 方案
loadrt remora

# SPI 通信绑定到伺服线程
addf remora.read servo-thread
addf remora.write servo-thread

# 信号连接
net x-axis-cmd joint.0.motor-pos-cmd => remora.0.pos-cmd
net x-axis-step remora.0.step => parport.0.pin-02-out
net x-axis-dir remora.0.dir => parport.0.pin-03-out
```

### 2.8 SPI 数据传输协议

RMC 方案的 SPI 数据传输协议通常使用固定长度的数据帧：

**Remora SPI 数据帧格式**：
```
帧头 (2字节)   数据 (N字节)      校验 (1字节)
[0xAA 0x55]    [命令+数据]       [XOR 校验]
              │
              ├── 命令字节: 0x01=位置, 0x02=速度, 0x03=IO
              ├── 轴数据: 4字节浮点 x N轴
              └── I/O 数据: 4字节位图
```

**weenyPRU SPI 数据帧**：
```
+----------+-----------+----------+------+--------+
| 帧开始符 | 类型字节   | 有效载荷 | CRC  | 帧结束符 |
| (0xFF)   | (1字节)   | (N字节)  | (1B) | (0xFE) |
+----------+-----------+----------+------+--------+
```

### 2.9 实时性能基准

| 方案 | 伺服线程 | 步进频率 | SPI 延迟 | 抖动 (3σ) |
|------|---------|---------|---------|-----------|
| Remora STM32F4 | 1 kHz | 50 kHz | ~15us | ±3us |
| weenyPRU F103 | 1 kHz | 50 kHz | ~20us | ±5us |
| FlexiHAL RP2350 | 1 kHz | 100 kHz | ~10us | ±2us |
| LCNC-TMC5160 RPi5 | 1 kHz | N/A (SPI) | ~5us | ±1us |
| Mesa 7i96S | 1-5 kHz | FPGA | <1us | ±0.1us |

---

## 6. 产品特色 (续)

### 6.6 安装部署流程

**Remora 安装步骤**（以 RPi 5 为例）：
```bash
# 1. 下载 LinuxCNC RPi 镜像
# https://www.linuxcnc.org/iso/rpi-5-debian-bookworm-*

# 2. 安装 remora HAL 组件
cd Remora/LinuxCNC
sudo halcompile --install remora.c

# 3. 烧录 MCU 固件（通过 SPI）
cd Remora/Firmware
make flash

# 4. 配置 LinuxCNC HAL
cp configs/remora_demo.hal /etc/linuxcnc/

# 5. 优化系统
echo performance | sudo tee /sys/devices/system/cpu/cpufreq/policy0/scaling_governor
echo -n 1200000 | sudo tee /sys/devices/system/cpu/cpufreq/policy0/scaling_min_freq
```

### 6.7 硬件接口引脚定义

**RRW_LAB DB25 版本引脚分配**：
| DB25 引脚 | 信号 | 方向 |
|-----------|------|------|
| 2 | 轴1 Step | 输出 |
| 3 | 轴1 Dir | 输出 |
| 4 | 轴2 Step | 输出 |
| 5 | 轴2 Dir | 输出 |
| 6 | 轴3 Step | 输出 |
| 7 | 轴3 Dir | 输出 |
| 8 | 轴4 Step | 输出 |
| 9 | 轴4 Dir | 输出 |
| 10 | 轴5 Step | 输出 |
| 11 | 轴5 Dir | 输出 |
| 12-17 | 输入限位 | 输入 |
| 18-19 | 主轴 PWM/使能 | 输出 |

---

## 7. 对 AUDESYS 参考价值 (续)

### 7.8 LinuxCNC HAL 组件架构映射

| LinuxCNC HAL 概念 | RMC 实现 | AUDESYS HAL 对应 |
|-----------------|---------|-----------------|
| HAL 引脚 (pin) | hal_pin_float_new | Signal 定义 |
| HAL 信号 (signal) | net 命令 | Signal 路由 |
| HAL 函数 (function) | remora_read/write | RT/I/O 线程函数 |
| HAL 组件 (component) | remora.c | HalTransport 模块 |
| 实时线程 (thread) | servo-thread | RT 线程 |

### 7.9 物理 I/O 架构参考

RMC 方案的物理 I/O 层设计对 AUDESYS 的物理 HAL 实现有直接参考价值：

| 物理 I/O 层级 | RMC 实现 | AUDESYS 设计建议 |
|-------------|---------|----------------|
| 物理接口 | DB25 / 排针 | 可插拔 I/O 模块 |
| 信号隔离 | 光耦 (weeny) | 隔离 HAL 设备 |
| 电平转换 | 3.3V/5V/24V | 可配置电平 |
| 端子类型 | 螺丝/IDC | 工业级端子 |

### 7.10 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 中 | Remora 社区验证，FlexiHAL 较新 |
| 性价比 | 很高 | $35-50 全功能 CNC |
| AUDESYS HAL 参考 | 高 | 实时卸载 + SPI + HAL 抽象 |
| 学习价值 | 高 | 嵌入式运动控制固件架构 |
| 生产准备 | 低 | 原型和爱好者，工业级需 Mesa |

RMC 方案的分布式实时控制模式 — 主机非实时 + 从站实时分离 — 展示了 AUDESYS HAL 设计中 RT/I/O 线程隔离的核心模式。其 SPI 通信协议、MCU 固件 HAL 架构和 LinuxCNC 集成方式为 AUDESYS 的物理 HAL 实现提供了经过社区验证的参考路径。

---

> **本文档基于 2026 年 7 月的公开信息编写。RMC 方案涉及多个独立开源项目（Remora、weenyPRU、FlexiHAL、RRW_LAB、LCNC-TMC5160），具体功能和兼容性以各项目官方文档为准。**
