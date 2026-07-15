# LinuxCNC-STM32 — STM32 USB虚拟并口与硬件步进发生器

> **生成日期**: 2026-07-14
> **参考来源**: LinuxCNC文档 (linuxcnc.org), GitHub (Remora, WeenyPRU), STM32Cube HAL, LinuxCNC论坛
> **相关项目**: Remora, WeenyPRU, NVEM, EC500, Flexi-HAL

## 一、产品画像

### 1.1 概念与定位

LinuxCNC-STM32 不是一个单一项目，而是一类"硬件步进发生器"方案的总称——使用 STM32 微控制器作为 LinuxCNC（运行在 PC 上的实时 CNC 控制软件）的外部硬件加速器，通过 USB/SPI/以太网等接口连接，在 STM32 上利用硬件定时器生成精确的步进脉冲，从而将时间关键（实时）的步进生成任务从 PC 卸载到专用硬件。

这类方案的核心动机是解决 LinuxCNC 的传统痛点：PC 并行端口（LPT）的实时步进生成受限于 PC 的延迟抖动（latency jitter）。

### 1.2 历史背景

LinuxCNC（原 EMC2）是开源 CNC 控制软件的标准方案。传统上，它依赖 PC 的并行端口（Parallel Port, LPT）输出步进/方向信号，步进脉冲由软件（stepgen HAL 组件）在实时线程中生成。这种方法的问题在于：

1. **并行端口逐渐消失**：现代 PC 主板不再集成 LPT 端口，PCIe 并行端口卡存在兼容性问题
2. **实时性依赖 PC**：stepgen 必须在实时线程中运行，PC 的延迟抖动直接影响步进精度
3. **最大步进频率受限**：软件 stepgen 的典型步进频率上限为 5-25kHz（取决于 CPU 和延迟）

为解决这些问题，社区和工业界探索了多种硬件加速方案：
- Mesa FPGA 卡（7i43/7i76/7i96 等）：通过 FPGA 硬件生成步进脉冲，连接方式为并行端口或以太网
- Pico Systems 并行端口 DAQ 卡
- **STM32 方案**：利用 STM32 的硬件定时器生成步进脉冲，作为低成本的 Mesa 替代方案

### 1.3 主要方案

**Remora**（GitHub: remora-cnc/remora-firmware）：
- 最成熟的 STM32 硬件步进发生器方案
- STM32F446/F407 目标平台，支持以太网（W5500 SPI 以太网控制器）或 USB 连接
- 配套 LinuxCNC HAL 组件，通过 SPI 或以太网 UDP 通信
- 参见：docs/reference/remora.md（兄弟文档）

**WeenyPRU**（GitHub: iforce2d/weenyPRU）：
- STM32F103（Blue Pill）+ Raspberry Pi SPI 接口
- 4 轴步进电机控制，最高 50kHz 步进频率
- 通过 Raspberry Pi 的 PRU（Programmable Real-time Unit）与 LinuxCNC 通信
- 支持 TMC2209 步进驱动控制、RGB LED、压力传感器、称重传感器等

**NVEM / EC500**：
- 商业 STM32 控制板，原用于 Mach3
- NVEM：STM32F207 + 以太网 PHY
- EC500：STM32F407 + 以太网 PHY
- 已停产，LinuxCNC 社区提供 Legacy Support

**Flexi-HAL（Expatria Technologies）**：
- STM32F446 + W5500 以太网 SPI 适配器
- 专为 Remora 设计
- 开源硬件设计

### 1.4 与传统方案对比

| 方案 | 平台 | 连接方式 | 步进生成 | 最大步进频率 | 实时性 | 成本 |
|------|------|----------|----------|-------------|--------|------|
| 软件 stepgen + LPT | PC | 并行端口 | 软件(PC) | 5-25kHz | 依赖PC RT | ~$0 |
| Mesa FPGA | PC+FPGA | LPT/以太网 | 硬件(FPGA) | 10MHz+ | 硬件实时 | $100-300 |
| Remora | PC+STM32 | 以太网/USB | 硬件(STM32 TIM) | 100-200kHz | 硬件实时 | $30-80 |
| WeenyPRU | RPi+STM32 | SPI | 硬件(STM32 TIM) | 50kHz | 硬件实时 | $15-30 |
| EtherCAT | PC+专用 | 以太网 | 硬件(从站) | 10MHz+ | 硬件实时 | $100-500+ |

## 二、技术特性

### 2.1 系统架构

LinuxCNC-STM32 方案的核心架构为"PC + STM32 双处理器"模式：

```
┌────────────────────┐          ┌──────────────────────┐
│     LinuxCNC (PC)  │          │      STM32 MCU       │
│                    │          │                      │
│  HAL 用户空间组件    │  通信协议  │  通信协议解析         │
│  (halcompile)       │◄────────►│  (USB CDC / SPI /    │
│                    │          │   以太网 UDP)         │
│  实时线程 base-thread│          │                      │
│  (stepgen.make-pulses│          │  Stepgen 固件         │
│   由 STM32 替代)    │          │  (定时器中断)          │
│                    │          │                      │
│  HAL 伺服线程        │          │  GPIO 管理            │
│  (stepgen.update-freq│          │  (限位/探针/冷却/主轴)  │
│   发送频率到 STM32)  │          │                      │
└────────────────────┘          └──────────────────────┘
```

**关键设计原则**：将时间关键（time-critical）的步进脉冲生成从 PC 侧卸载到 STM32 侧。PC 只需以较低频率（伺服线程，通常 1-10kHz）发送位置/速度命令，STM32 在硬件定时器中断中精确生成步进脉冲。

### 2.2 STM32 定时器步进生成原理

STM32 的通用定时器（TIM）是步进生成的核心硬件。其工作原理如下：

**定时器 PWM 输出模式**：
- 定时器计数器从 0 递增到 ARR（Auto-Reload Register）
- 当计数器值 < CCRx（Capture/Compare Register）时，输出高电平
- 当计数器值 >= CCRx 时，输出低电平
- 通过调整 CCRx 控制脉冲宽度，通过调整 ARR 控制脉冲频率

**步进频率控制**：
- 定时器时钟频率 = TIM_CLK（通常为 APB 时钟，如 84MHz 或 108MHz）
- 步进频率 = TIM_CLK / (ARR + 1) / (prescaler + 1)
- 例如：TIM_CLK = 84MHz, prescaler = 0, ARR = 840 → 步进频率 = 100kHz
- 在运行时动态调整 ARR 以改变步进频率，实现加速/减速

**多轴同步**：
- 多个定时器可以使用同一个定时器同步信号（TRGO）
- 或使用一个主定时器触发多个从定时器
- 确保所有轴在同一个时间基准上生成脉冲

**DMA 加速**：
- 使用 DMA 自动更新定时器的 ARR 和 CCRx 寄存器
- 无需 CPU 干预即可实现连续的步进脉冲序列
- DMA 环形缓冲区预加载多个周期的频率参数

### 2.3 USB 通信接口

USB 是 STM32 与 PC 之间最常用的通信接口，但存在重要的实时性限制：

**USB CDC（Communications Device Class）虚拟串口**：
- STM32 使用 USB CDC 模拟串口，LinuxCNC 端通过 /dev/ttyACMx 访问
- 优点：Linux 原生驱动支持，无需额外驱动安装
- 优点：全双工通信，同时接收命令和发送状态
- 缺点：USB 帧周期为 1ms（全速 USB）或 125μs（高速 USB），引入了确定性延迟

**USB 批量传输（Bulk Transfer）**：
- 用于大块数据传输，带宽高但延迟不确定
- 适合批量命令更新（如批量设置多个轴的频率参数）
- 不适合实时步进命令

**USB 实时性限制**：
- LinuxCNC 官方文档明确标注："USB devices cannot be used to control motors or perform other real time tasks"
- USB 到并行端口转换器不可用：延迟从几微秒到几十毫秒不等
- 但 STM32 方案通过在 STM32 侧做硬件步进生成来规避此限制——PC 只需发送低频命令，高频步进由 STM32 定时器处理

**延迟分解**：
- USB 传输延迟（从 PC 发送到 STM32 接收）：通常 1-6ms（USB 全速）
- 缓冲区延迟：PC 和 STM32 的 USB 缓冲区引入额外延迟
- 步进频率更新延迟：从命令发送到 STM32 更新定时器频率
- 总延迟典型值：1-10ms——对于步进频率更新足够，但对于直接步进脉冲生成不可接受

### 2.4 SPI 通信接口

在 WeenyPRU 等方案中，SPI 是替代 USB 的通信接口：

**SPI 优势**：
- 确定性延迟：SPI 时钟由主设备（Raspberry Pi）控制，没有帧周期概念
- 高吞吐量：SPI 时钟可达 40MHz+
- 低延迟：微秒级延迟，远低于 USB
- 全双工同步通信

**SPI 架构**：
- Raspberry Pi 运行 LinuxCNC，使用 PRU（可编程实时单元）生成 SPI 数据流
- STM32 作为 SPI 从设备，接收命令并发送状态
- 命令格式：频率命令 + 状态查询 + GPIO 控制

### 2.5 以太网通信接口

更高级的 Remora 方案使用以太网（W5500 SPI 以太网控制器）：

**W5500 硬件 TCP/IP 协议栈**：
- 硬件 TCP/IP 卸载，不占用 STM32 CPU
- 8 个独立 Socket 全硬件实现
- 支持 TCP/UDP/ICMP/IPv4
- SPI 接口连接 STM32，时钟配置最高 80MHz

**以太网优势**：
- 远程部署能力（PC 可与 STM32 分离，通过交换机/路由器连接）
- 标准网络协议，易于调试和诊断
- 带宽高，可同时传输步进命令、GPIO 状态、模拟量数据

**实时性考虑**：
- 以太网基于 UDP 的通信延迟通常 <1ms（同网段）
- 通过调整 UDP 包大小和发送频率优化延迟
- 与 EtherCAT 相比，标准以太网的延迟不确定

### 2.6 HAL 组件设计

LinuxCNC 端需要一个 HAL（Hardware Abstraction Layer）组件来与 STM32 通信。以 WeenyPRU 的 `weeny.c` 为例：

**HAL 组件结构**：
```c
// 简化的 HAL 组件结构
#include "rtapi.h"
#include "hal.h"

// 每轴的状态
typedef struct {
    hal_float_t *pos_cmd;        // 位置命令（来自 motion 模块）
    hal_float_t *freq_cmd;       // 频率命令（计算后的步进频率）
    hal_s32_t *feedback;         // 步进反馈计数
    hal_bit_t *enable;           // 使能信号
    // ... 更多参数
} axis_t;

// 组件实例
typedef struct {
    axis_t axes[MAX_AXES];
    hal_float_t *spindle_speed;
    hal_bit_t *coolant_flood;
    hal_bit_t *coolant_mist;
    // ... 通信接口
    int fd;                      // 串口/SPI 文件描述符
} weeny_t;

// 实时函数：读取位置命令，计算频率，发送到 STM32
static void read_commands(void *arg, long period) {
    weeny_t *w = (weeny_t *)arg;
    for (int i = 0; i < MAX_AXES; i++) {
        // 计算步进频率
        float freq = fabs(*(w->axes[i].freq_cmd));
        // 限制频率范围
        if (freq > MAX_FREQ) freq = MAX_FREQ;
        // 通过通信接口发送到 STM32
        send_freq_to_stm32(w->fd, i, freq, *(w->axes[i].pos_cmd) >= 0);
    }
}
```

HAL 组件通过 `halcompile` 工具编译安装，在 LinuxCNC 的 `.hal` 配置文件中连接：

```hal
# 加载 STM32 硬件步进发生器组件
loadrt weeny

# 连接信号
net x-stepgen              weeny.0.freq-cmd
net x-enable               weeny.0.enable
net x-feedback             weeny.0.position-fb

# 添加实时函数到伺服线程
addf weeny.read-commands servo-thread
addf weeny.write-outputs servo-thread
addf weeny.read-inputs base-thread
```

### 2.7 STM32Cube HAL 固件架构

STM32 端的固件基于 STM32Cube HAL 开发，关键组件包括：

**时钟配置**：
- 使用 HSE（外部高速晶振）作为系统时钟源：通常 8MHz 或 25MHz
- PLL 倍频到 72-180MHz（取决于 STM32 型号）
- APB1 定时器时钟：通常为系统时钟的一半（36-90MHz）
- APB2 定时器时钟：通常等于系统时钟（72-180MHz）

**定时器配置**：
- 使用 TIM1/TIM2/TIM8/TIM9 等高级/通用定时器
- 每个轴分配一个定时器通道
- 配置为 PWM 输出模式，由定时器更新事件触发中断
- 中断优先级设为最高（抢占优先级 0）

**USB 配置**：
- USB CDC 类配置（设备描述符、配置描述符、接口描述符）
- 端点 1：批量输入（IN，STM32 发送到 PC）
- 端点 2：批量输出（OUT，PC 发送到 STM32）
- 数据缓冲区管理：环形缓冲区或双缓冲区

**GPIO 配置**：
- 步进引脚：定时器通道输出
- 方向引脚：通用 GPIO 输出
- 限位引脚：GPIO 输入，带外部中断
- 探针引脚：GPIO 输入，最高优先级中断
- 使能/冷却/主轴：GPIO 输出

### 2.8 步进脉冲时序参数

STM32 固件需要精确控制步进脉冲的时序参数，以满足不同步进驱动器的要求：

**脉冲宽度（steplen）**：步进脉冲的高电平持续时间
- 典型值：2-10μs
- 可通过定时器比较值控制：`steplen_ticks = steplen_us * (TIM_CLK / 1000000)`
- 例如：TIM_CLK = 84MHz, steplen = 4μs → steplen_ticks = 336

**脉冲间隔（stepspace）**：连续步进脉冲之间的最小间隔
- 决定了最大步进频率：`max_freq = 1 / (steplen + stepspace)`
- 例如：steplen = 4μs, stepspace = 4μs → max_freq = 125kHz

**方向建立时间（dirsetup）**：方向信号变化后到步进脉冲之间的最小延迟
- 典型值：1-5μs
- 确保步进驱动器在接收脉冲前已稳定检测到方向信号

**方向保持时间（dirhold）**：步进脉冲后方向信号必须保持的最小时间
- 典型值：1-5μs
- 确保步进驱动器在脉冲结束后仍能检测到方向信号

**方向切换延迟（dirdelay）**：从上一个步进脉冲到反向步进脉冲之间的最小延迟
- 典型值：steplen + dirsetup + dirhold
- 在某些步进类型（type 1）中替代 dirsetup 和 dirhold

### 2.9 步进频率控制算法

STM32 端的步进频率控制采用"累加器法"（DDS 方法），与 LinuxCNC 的软件 stepgen 算法一致：

**累加器原理**：
```
accumulator += frequency_command
if (accumulator >= PICKOFF_THRESHOLD) {
    accumulator -= PICKOFF_THRESHOLD;
    generate_step_pulse();  // 产生步进脉冲
}
```

- `frequency_command`：与目标步进频率成正比的加数
- `PICKOFF_THRESHOLD`：2^32 或 2^31（取决于实现）
- 当累加器溢出时，产生一个步进脉冲
- 步进频率 = `frequency_command * TIM_CLK / PICKOFF_THRESHOLD`

**加速/减速控制**：
- 梯形加速曲线：恒加速→恒速→恒减速
- S 形加速曲线：加加速度受限的平滑加速
- 急停：立即设置频率为 0

**位置跟踪**：
- 累加器同时跟踪位置：`position += (accumulator >= PICKOFF_THRESHOLD) ? 1 : 0`
- 位置反馈通过通信接口发送回 LinuxCNC
- 位置反馈用于闭环校正（如果检测到丢步）

### 2.10 DMA 与多轴同步

高性能实现使用 DMA 和定时器同步机制：

**DMA 预加载频率序列**：
- 使用 DMA 将预设的频率序列从内存传输到定时器 ARR 寄存器
- 无需 CPU 干预即可实现复杂的加速/减速曲线
- 环形缓冲区（DMA circular mode）支持连续运动

**定时器同步（Timer Synchronization）**：
- 使用一个主定时器（如 TIM1）的更新事件触发其他定时器
- 主定时器频率 = 期望的步进同步频率
- 从定时器在收到触发信号后更新 ARR 和 CCRx
- 确保所有轴在完全相同的时刻更新步进频率

**多轴运动协调**：
- LinuxCNC 发送到 STM32 的命令包含每个轴的目标频率
- STM32 在同步信号中同时更新所有轴的频率
- 所有轴在同一时间基准上运行，步进时序完全同步



### 2.11 中断优先级与嵌套管理

STM32 的中断管理对步进生成的实时性至关重要：

**NVIC 优先级配置**：
- 定时器中断：抢占优先级 0，子优先级 0（最高优先级）
- USB/SPI 接收中断：抢占优先级 1，子优先级 0
- GPIO 外部中断（限位/探针）：抢占优先级 0，子优先级 1
- SysTick 中断：抢占优先级 3，子优先级 0（最低优先级）

**中断延迟控制**：
- STM32 Cortex-M 内核的硬件中断延迟通常为 12 个时钟周期
- 在 168MHz 的 STM32F407 上，中断延迟约 71ns
- 定时器中断服务程序（ISR）长度应控制在 200 个时钟周期以内
- 长任务应分解到主循环中处理，ISR 只做最小处理（设置标志位）

**中断嵌套**：
- 高优先级中断可以抢占低优先级中断
- 步进定时器 ISR 总是最高优先级，不会被任何其他中断打断
- USB 中断可以被打断，不影响步进精度

### 2.12 时间戳与同步

多轴同步需要精确的时间戳管理：

**全局时间基准**：
- 使用 STM32 的 DWT（Data Watchpoint and Trace）周期计数器
- DWT 计数器在每个 CPU 周期递增，提供纳秒级的时间戳
- 时钟频率 = HCLK（如 168MHz），分辨率 = 5.95ns

**位置反馈时间戳**：
- 每次步进脉冲产生时，记录 DWT 计数器值
- 位置反馈数据包中包含时间戳信息
- PC 端可以通过时间戳精确计算位置和时间的关系

**通信同步**：
- PC 发送的命令帧中包含时间戳
- STM32 根据时间戳确定命令的生效时间
- 补偿通信延迟（通过往返时间 RTT 估算）

### 2.13 实时操作系统集成

虽然大部分 STM32 步进发生器方案使用裸机（bare-metal），但 RTOS 可以增强系统的健壮性：

**FreeRTOS 集成**：
- 步进定时器 ISR 作为最高优先级任务（不受 RTOS 调度影响）
- 通信处理作为中等优先级任务
- I/O 监控作为低优先级任务
- 使用 FreeRTOS 的队列（Queue）在 ISR 和任务之间传递数据

**任务分配**：
```
优先级 0（ISR）：步进定时器 → 步进脉冲生成
优先级 1（ISR）：USB/SPI 接收 → 命令解析
优先级 2（任务）：命令处理 → 更新步进频率
优先级 3（任务）：状态上报 → 发送反馈到 PC
优先级 4（任务）：I/O 监控 → 限位/探针检测（非中断模式）
空闲：看门狗刷新、统计信息
```

**裸机 vs RTOS**：
- 裸机：无任务切换开销，确定性最高，适合高性能步进生成
- RTOS：任务管理更灵活，适合功能复杂的系统（如带 LCD 显示、SD 卡记录）

### 2.14 CAN 总线接口扩展

部分方案使用 CAN 总线作为 PC 和 STM32 之间的通信接口：

**CAN 优势**：
- 工业现场总线标准，在机床领域广泛使用
- 确定性延迟（CAN 帧优先级仲裁）
- 差分信号，抗干扰能力强
- 多节点支持（一台 PC 控制多台 STM32）

**CANopen 协议**：
- 基于 CAN 的高层协议（CiA 301/402）
- PDO（过程数据对象）：周期性传输实时控制数据
- SDO（服务数据对象）：非周期性传输配置数据
- 支持多主站和心跳监控

**与 AUDESYS 的关联**：CANopen 设备配置文件（CiA 402）定义了统一的驱动器和运动控制设备接口。AUDESYS 的 HAL 设备对象模型可以参考 CiA 402 的对象字典设计。

### 2.15 编码器反馈接口

步进电机系统通常为开环控制，但部分应用需要编码器反馈进行闭环补偿：

**编码器接口**：
- 增量式编码器：使用 STM32 定时器的编码器模式（Encoder Mode）
- 自动计数：定时器硬件自动解码 A/B 相信号
- 方向检测：定时器硬件检测旋转方向
- 索引信号（Z 相）：用于回零参考点

**闭环补偿策略**：
- 位置比较：比较命令位置（累加器计数值）和编码器反馈位置
- 丢步检测：如果位置偏差超过阈值，触发警报或自动修正
- 动态校正：在下一个运动段中补偿位置偏差
## 三、功能概览

### 3.1 步进电机控制

- 支持 3-6 轴步进电机控制（取决于 STM32 型号和定时器资源）
- 每轴独立配置步进类型（Step/Dir、Quadrature、Up/Down 等）
- 每轴独立配置时序参数（steplen、stepspace、dirsetup、dirhold）
- 最高步进频率：50-200kHz（取决于定时器时钟和脉冲宽度）
- 加速/减速控制：梯形和 S 形曲线

### 3.2 数字 I/O 管理

- 限位开关输入（正极/负极/共用）
- 探针输入（高优先级中断处理）
- 冷却液控制（M8/M9 输出）
- 主轴控制（PWM 输出/继电器输出）
- 通用数字 I/O（可配置输入/输出方向）

### 3.3 主轴控制

- PWM 主轴速度控制（通过定时器输出）
- 主轴转速反馈（通过编码器输入或霍尔传感器）
- 支持 M3（顺时针）/ M4（逆时针）/ M5（停止）
- 可通过 RS485 控制变频器 VFD

### 3.4 通信协议

- 命令-响应协议：PC 发送命令帧，STM32 执行并返回状态
- 命令帧格式：轴号 + 目标频率 + 方向 + 使能标志
- 状态帧格式：各轴位置反馈 + 限位状态 + 探针状态
- 错误检测：CRC 校验或累加和校验
- 保持活跃（Heartbeat）机制：如果 PC 停止发送超过超时时间，STM32 自动停止所有轴

### 3.5 故障保护

- 看门狗定时器（IWDG）：在固件崩溃时自动复位 STM32
- 限位触发自动停止：限位开关触发时立即停止所有轴
- 急停输入：硬件急停信号直接关闭驱动器使能
- 通信超时保护：PC 通信断开时自动减速停止
- 过流保护：可通过 ADC 检测驱动器电流

### 3.6 配置与校准

- 每轴步进/毫米（steps_per_mm）参数
- 最大加速度（max_acceleration）
- 最大速度（max_velocity）
- 回零参数（方向、速度、偏移）
- 反向间隙补偿（backlash compensation）

## 四、现状与生态

### 4.1 项目活跃度

LinuxCNC-STM32 方案由多个独立项目组成，活跃度参差不齐：

**Remora**（remora-cnc/remora-firmware）：
- GitHub 上有活跃的开发和 Issue 讨论
- 配套 STM32 HAL 组件和配置工具
- 社区维护的硬件设计（Flexi-HAL）
- 适合需要以太网连接的场景

**WeenyPRU**（iforce2d/weenyPRU）：
- 个人维护项目（iforce2d）
- 使用 STM32F103 Blue Pill，硬件成本极低
- 适合 Raspberry Pi + LinuxCNC 用户
- 维护频率较低，但功能稳定

**NVEM / EC500**：
- 商业产品，已停产
- LinuxCNC 社区提供 Legacy Support
- 不适合新设计

### 4.2 硬件生态

**STM32 型号选择**：

| 型号 | 架构 | 频率 | 定时器资源 | USB | 以太网 | 适用场景 |
|------|------|------|-----------|-----|--------|---------|
| STM32F103 | Cortex-M3 | 72MHz | 7个TIM | USB FS | 无 | 低端3-4轴，WeenyPRU |
| STM32F207 | Cortex-M3 | 120MHz | 12个TIM | USB HS | 有 | 中端，NVEM |
| STM32F407 | Cortex-M4F | 168MHz | 14个TIM | USB HS | 有 | 中高端，EC500/Remora |
| STM32F446 | Cortex-M4F | 180MHz | 8个TIM | USB HS | 无(需W5500) | 中高端，Flexi-HAL |
| STM32F7 | Cortex-M7 | 216MHz | 20个TIM | USB HS | 有 | 高性能，6-8轴 |

**硬件参考平台**：
- STM32F103C8T6（Blue Pill）：$2-3，最便宜的选择
- STM32F407VET6 开发板：$10-15，平衡性能和成本
- WeAct Studio STM32F411CEU6：$8-12，小尺寸高性能
- Flexi-HAL 开源板：开源设计，可自行制作

### 4.3 与 LinuxCNC 的集成

LinuxCNC-STM32 方案与 LinuxCNC 的集成涉及多个层面：

**HAL 组件安装**：
```bash
# 使用 halcompile 编译安装
sudo halcompile --install weeny.c

# 或使用 loadrt 加载
loadrt hal_parport  # 传统的并行端口
loadrt weeny        # STM32 硬件步进发生器（替代 stepgen）
```

**HAL 配置文件（.hal）**：
```hal
# 加载 STM32 硬件步进发生器
loadrt weeny

# 连接轴信号
net x-pos-cmd <= axis.0.motor-pos-cmd => weeny.0.pos-cmd
net x-enable <= axis.0.amp-enable-out => weeny.0.enable
net x-feedback => weeny.0.position-fb => axis.0.motor-pos-fb

# 连接限位信号
net x-limit-min => weeny.0.limit-min
net x-limit-max => weeny.0.limit-max

# 添加实时函数
addf weeny.read-commands servo-thread
addf weeny.read-inputs base-thread
```

**关键差异**：与传统的并行端口+stepgen 配置相比，STM32 方案不再需要 `stepgen.make-pulses` 在 base-thread 中运行（这是最频繁的实时函数）。代之以 `weeny.read-commands` 在 servo-thread 中运行（频率较低，1-10kHz），大幅降低了 PC 的实时性要求。

### 4.4 实时性能基准

| 指标 | 软件 stepgen + LPT | STM32 硬件步进 | 改进 |
|------|-------------------|---------------|------|
| 最大步进频率 | 5-25kHz | 50-200kHz | 10x |
| 步进抖动（jitter） | 10-100μs | <1μs | 100x |
| PC 实时要求 | 硬实时（SCHED_FIFO） | 软实时（普通线程） | 显著降低 |
| 支持轴数 | 3-6（受 CPU 负载限制） | 4-6（受定时器资源限制） | 相同 |
| 延迟敏感性 | 高（每个步进都依赖 PC） | 低（PC 只发频率命令） | 根本性改善 |
| 适用 PC 硬件 | 专用工控机 | 普通 PC/笔记本 | 范围扩大 |

### 4.5 与竞品对比

| 特性 | STM32 (Remora/Weeny) | Mesa FPGA (7i76/7i96) | 软件 stepgen+LPT | EtherCAT |
|------|---------------------|----------------------|-----------------|----------|
| 步进频率 | 50-200kHz | 10MHz+ | 5-25kHz | 10MHz+ |
| 抖动 | <1μs 定时器 | <0.1μs FPGA | 10-100μs | <0.1μs |
| 成本 | $15-80 | $100-300 | ~$0 | $100-500+ |
| 开源 | 完全开源 | 闭源固件 | 完全开源 | 主站开源 |
| 开发难度 | 中（需要 STM32 固件） | 低（即插即用） | 低（直接使用） | 高（需要配置） |
| 灵活性 | 高（可定制固件） | 低（固定功能） | 中（HAL 灵活） | 中（标准协议） |
| 社区支持 | 中 | 高（Mesa 成熟） | 极高（LinuxCNC 核心） | 高（EtherCAT 标准） |
| PC 性能要求 | 低 | 低 | 高 | 中 |



### 4.6 开发工具链

**STM32 固件开发**：
- STM32CubeMX：图形化配置工具（时钟树、GPIO、定时器、USB 配置）
- STM32CubeIDE：集成开发环境（基于 Eclipse + GCC ARM）
- ARM GCC Toolchain：开源编译器（arm-none-eabi-gcc）
- OpenOCD：调试和烧录工具
- HAL/LL 库：STM32Cube HAL（硬件抽象层）和 LL（低层）API

**LinuxCNC 组件开发**：
- halcompile：HAL 组件编译器
- 编译器.halconf：HAL 配置文件
- haltcl：Tcl 脚本接口
- halscope：HAL 信号示波器（调试工具）
- halmeter：HAL 信号值显示工具

**调试与测试**：
- 逻辑分析仪：验证步进脉冲时序（Saleae Logic 等）
- 示波器：测量脉冲宽度和抖动
- 串口监控：分析 USB CDC 通信内容
- halscope：监控 LinuxCNC 内部信号

### 4.7 已知问题与解决方案

**问题1：USB 通信断开导致电机失控**
- 症状：STM32 收不到新命令后保持最后频率继续运行
- 解决方案：实现通信超时（watchdog timer），PC 定期发送心跳包

**问题2：步进脉冲抖动**
- 症状：步进脉冲宽度不稳定
- 原因：定时器 ISR 被其他中断延迟
- 解决方案：将步进定时器优先级设为最高，或使用定时器硬件自动输出

**问题3：多轴同步丢失**
- 症状：各轴之间的步进时序不一致
- 原因：定时器更新事件不同步
- 解决方案：使用定时器主从同步模式，或使用 20MHz 共同时钟

**问题4：USB 缓冲区溢出**
- 症状：命令丢失，轴响应异常
- 原因：PC 发送频率超过 STM32 处理能力
- 解决方案：实现流控制（XON/XOFF 或硬件 CTS/RTS）

### 4.8 典型应用案例

**案例1：3 轴桌面雕刻机（STM32F103 + USB CDC）**
- 配置：Blue Pill + 3 个 A4988 步进驱动器 + 24V 电源
- 步进频率：最高 50kHz
- 软件：LinuxCNC 2.9 + WeenyPRU HAL 组件
- 成本：$25（控制板+驱动器）
- 性能：可满足大多数 Note，雕刻需求

**案例2：4 轴激光切割机（STM32F407 + 以太网）**
- 配置：STM32F407 开发板 + W5500 以太网模块 + 4 个 TMC2209
- 步进频率：最高 100kHz
- 软件：LinuxCNC + Remora HAL 组件
- 成本：$60
- 性能：以太网远程控制，激光功率同步

**案例3：3 轴铣床升级（STM32F446 + Flexi-HAL）**
- 配置：Flexi-HAL 控制板 + TMC5160 大电流驱动
- 步进频率：最高 150kHz
- 软件：LinuxCNC + Remora（以太网 UDP）
- 成本：$120
- 性能：闭环步进控制，编码器反馈

### 4.9 社区资源

- LinuxCNC 论坛（forum.linuxcnc.org）：硬件接口相关讨论
- GitHub（remora-cnc/remora-firmware）：Remora 项目主页
- GitHub（iforce2d/weenyPRU）：WeenyPRU 项目主页
- Expatria Technologies：Flexi-HAL 硬件设计
- ST 社区（community.st.com）：STM32 技术问题
## 五、市场定位

### 5.1 目标市场

LinuxCNC-STM32 方案定位于"低成本工业级硬件步进发生器"：

1. **DIY 数控爱好者和创客**：需要比软件 stepgen 更高步进频率和更低抖动，但预算有限
2. **小型制造企业**：需要将 LinuxCNC 部署到现代 PC（无 LPT 端口），但不想购买昂贵的 Mesa FPGA 卡
3. **教育机构**：用于教学 CNC 系统和嵌入式实时控制的原理
4. **嵌入式开发者**：需要定制化的 CNC 控制硬件，可以在 STM32 固件中自由添加功能

### 5.2 竞争优势

- **成本优势**：STM32F103 开发板仅 $2-3，完整方案（含驱动板）$30-80，远低于 Mesa 的 $100-300
- **开源完整**：从 LinuxCNC HAL 组件到 STM32 固件，全部开源，无闭源成分
- **硬件灵活性**：可以在 STM32 固件中自由添加功能，如 TMC 驱动控制、传感器接口、自定义 I/O
- **PC 兼容性**：通过 USB 连接现代 PC（无 LPT 端口），无需专用工控机
- **实时性改善**：将步进生成的实时要求从 PC 卸载到硬件，大幅降低 PC 的延迟抖动影响

### 5.3 局限性

- **步进频率上限**：STM32 定时器受限于 MCU 时钟频率（72-216MHz），步进频率最高 200kHz，远低于 FPGA 的 10MHz+
- **USB 延迟**：USB 通信的延迟（1-6ms）限制了频率更新的响应速度，不适合需要快速动态响应的应用
- **轴数限制**：STM32 的定时器资源限制了支持的最大轴数（通常 4-6 轴）
- **开发难度**：需要编写 STM32 固件和 LinuxCNC HAL 组件，对开发者要求较高
- **生态不成熟**：相比 Mesa 的成熟生态，STM32 方案缺乏标准化和广泛验证
- **无功能安全**：不具备 IEC 61508/ISO 13849 安全认证

## 六、产品特色

### 6.1 硬件卸载的实时步进生成

LinuxCNC-STM32 方案最核心的价值在于将步进脉冲生成从 PC 的实时线程卸载到 STM32 的硬件定时器。这种架构设计意味着：

- PC 的延迟抖动不再影响步进精度
- 步进抖动从 10-100μs 降低到 <1μs
- 步进频率从 5-25kHz 提升到 50-200kHz
- PC 不再需要 SCHED_FIFO 硬实时内核

### 6.2 极低成本的高性能替代

STM32F103C8T6（Blue Pill）仅 $2-3，加上几个步进驱动器和电源，就可以构建一个完整的 4 轴 CNC 控制器。对于预算有限的爱好者和教育机构，这是一个极具吸引力的方案。

### 6.3 完整的开源生态

从 LinuxCNC HAL 组件到 STM32 固件，所有代码完全开源。用户可以：
- 修改固件添加自定义功能（如 TMC 驱动控制、附加传感器）
- 移植到不同的 STM32 型号
- 根据特定应用定制通信协议

### 6.4 分层的实时性设计

不同于传统的"全或无"实时性要求（要么连接硬实时 PC，要么不工作），STM32 方案提供了分层的实时性：

- **硬实时层**：STM32 硬件定时器处理步进脉冲生成（微秒级精度）
- **软实时层**：PC 的伺服线程发送频率命令（1-10ms 周期）
- **非实时层**：G-code 解析和用户界面处理

这种分层设计使得 PC 可以运行在 PREEMPT 内核（非 SCHED_FIFO）上，甚至可以使用普通 Linux 桌面。

### 6.5 通信接口的多样性

STM32 方案支持多种通信接口，适应不同的应用场景：

- **USB CDC**：最简单的连接方式，即插即用
- **SPI**：最低延迟，适合对实时性要求最高的场景
- **以太网（W5500）**：远程部署，适合分布式控制
- **CAN**：适合工业现场总线网络

### 6.6 与 LinuxCNC 的深度 HAL 集成

STM32 方案通过 LinuxCNC 的 HAL（硬件抽象层）组件实现深度集成，用户可以在 HAL 配置中使用与标准 stepgen 完全相同的信号连接方式，切换透明。

## 七、对AUDESYS参考价值

### 7.1 PC↔MCU 实时接口架构的启示

LinuxCNC-STM32 方案最核心的参考价值在于其"PC + MCU 双处理器实时接口"架构。AUDESYS 的 Runtime（§6，运行在 PC 或嵌入式 Linux 上）和 HAL（硬件抽象层，运行在 MCU 上）之间需要类似的接口设计。

**架构映射**：

| LinuxCNC-STM32 | AUDESYS 对应 | 参考价值 |
|---------------|-------------|----------|
| PC 运行 LinuxCNC + HAL | AUDESYS Runtime (PC/Linux) | 运行非实时控制逻辑 |
| STM32 运行步进发生器固件 | AUDESYS HAL Driver (MCU) | 运行实时硬件控制 |
| 通信接口（USB/SPI/以太网） | amw 中间件 (D11) | 传输层实现 |
| HAL 组件（weeny.c/remora.c） | HAL RPC 客户端 | PC 端通信 API |
| 步进定时器中断 | RT-Scheduler 硬实时线程 | 时间关键任务调度 |
| 通信超时保护 | Config Barrier (D17) | 故障安全机制 |

### 7.2 实时性分层的借鉴

LinuxCNC-STM32 的分层实时性设计直接验证了 AUDESYS 的四系统混合线程调度（D13）的合理性：

- **硬实时层（STM32 定时器 ISR）** ↔ AUDESYS 的 RT 线程（SCHED_FIFO）：处理微秒级时间关键任务
- **软实时层（PC 伺服线程）** ↔ AUDESYS 的 I/O 通信线程：处理毫秒级周期性任务
- **非实时层（PC 用户空间）** ↔ AUDESYS 的控制面/配置面：处理非实时逻辑

AUDESYS 的 RT-Scheduler 可以从 LinuxCNC-STM32 的架构中验证：在 MCU 端处理硬实时任务、在 PC 端处理软实时任务的分层设计是可行的。

### 7.3 通信延迟预算的参考

LinuxCNC-STM32 的通信延迟分析为 AUDESYS 的 amw 中间件（D11）提供了重要的延迟预算参考：

| 通信层 | LinuxCNC-STM32 延迟 | AUDESYS 目标 | 差距 |
|--------|-------------------|-------------|------|
| USB 全速 | 1-6ms | 不可用于 RT 通信 | — |
| SPI 同步 | 1-10μs | 可用于 RT 通信 | 足够 |
| 以太网 UDP | 0.1-1ms | 可用于控制面通信 | 需要优化 |
| RT 定时器 | <1μs | 硬件原生延迟 | 匹配 |

AUDESYS 的 amw 传输层（D11：amw_inproc / amw_zenoh）应选择适合的通信接口，并在不同接口之间提供一致的 API。

### 7.4 步进频率控制算法的移植

LinuxCNC-STM32 的步进频率控制算法（累加器法 + 定时器 PWM 输出）可以直接移植到 AUDESYS 的 HAL Driver 固件中：

```rust
// AUDESYS HAL 步进发生器（Rust 实现参考）
struct StepperGenerator {
    accumulator: u32,
    pickoff: u32,       // 2^31 或 2^32
    frequency: u32,     // 当前频率命令
    step_pin: OutputPin,
    dir_pin: OutputPin,
    timer: TimerPWM,    // 硬件定时器 PWM 输出
}

impl StepperGenerator {
    fn update_frequency(&mut self, freq: u32, direction: bool) {
        self.frequency = freq;
        self.dir_pin.set(direction);
    }

    fn step_isr(&mut self) {
        self.accumulator += self.frequency;
        if self.accumulator >= self.pickoff {
            self.accumulator -= self.pickoff;
            self.step_pin.toggle(); // 产生步进脉冲
        }
    }
}
```

### 7.5 HAL 组件设计模式的参考

LinuxCNC 的 HAL 组件设计模式（`halcompile` 编译、`loadrt` 加载、`addf` 添加到实时线程、信号连接）为 AUDESYS 的 HAL API 设计提供了参考：

- **面向信号的连接**：HAL 使用信号（Signal）连接组件，类似 AUDESYS 的 Signal 原语
- **实时函数注册**：HAL 组件注册实时函数，LinuxCNC 调度器确保在实时线程中执行
- **参数导出**：组件参数通过 HAL 引脚暴露，可在运行时调整

AUDESYS 的 HAL RPC 和 Signal 原语应该提供类似的能力：组件间通过信号连接，实时函数由调度器管理，参数可运行时调整。

### 7.6 USB 延迟问题的警示

LinuxCNC 社区对 USB 用于实时控制的明确拒绝（"USB devices cannot be used for real time tasks"）对 AUDESYS 是一个重要警示：

- **USB 不适合 RT 数据面**：AUDESYS 的 RT 数据面（D16）不应使用 USB 作为传输层
- **USB 适合控制面/配置面**：USB 可以用于非实时的配置和调试通信
- **硬件卸载是唯一出路**：如果必须使用 USB，必须在 MCU 端卸载所有实时任务

AUDESYS 的 amw 传输层选择（D11：Phase 1 amw_inproc、Phase 2+ amw_zenoh）避免了 USB 的限制，但如果在未来需要 USB 连接，必须参考 LinuxCNC 的教训。

### 7.7 STM32 定时器资源的管理

STM32 定时器资源的管理策略对 AUDESYS 的 HAL 设备对象模型有参考价值：

- **定时器复用**：一个定时器可以同时驱动多个步进通道（通过不同的比较值）
- **定时器同步**：多个定时器可以通过硬件触发链同步
- **DMA 卸载**：DMA 可以自动更新定时器参数，无需 CPU 干预

AUDESYS 的 HAL Driver 固件应该提供类似的定时器管理抽象层，让上层应用不必关心具体的定时器资源分配。

### 7.8 通信协议设计的参考

LinuxCNC-STM32 的通信协议设计（命令-响应、频率命令+状态反馈、心跳机制、超时保护）为 AUDESYS 的 HAL RPC 协议提供了参考：

- **命令-响应模式**：PC 发送命令帧，MCU 执行并返回状态，适合大部分控制场景
- **批量更新**：一次发送多个轴的命令，减少通信开销
- **心跳机制**：PC 定期发送心跳包，MCU 监控心跳超时，在超时时自动停止所有轴
- **状态反馈**：MCU 返回各轴位置、限位状态、故障状态

AUDESYS 的 HAL RPC 应该支持类似的功能，同时增加安全域（D27）和 QoS 参数（D16）。

### 7.9 对 AUDESYS Simulator 的参考

LinuxCNC-STM32 的"PC 端软实时 + MCU 端硬实时"架构为 AUDESYS Simulator 提供了仿真模型：

- **Simulator 可以在 PC 上模拟 STM32 的行为**：在仿真模式下，PC 端运行 STM32 固件的模拟版本
- **通信协议可以在回环（loopback）模式下测试**：PC 端的 HAL 组件通过本地回环与模拟的 STM32 通信
- **实时性验证**：通过记录和比较延迟分布，验证是否满足实时性要求

### 7.10 总结：LinuxCNC-STM32 对 AUDESYS 的整体价值

LinuxCNC-STM32 方案对 AUDESYS 的核心参考价值在于：

1. **PC+MCU 双处理器实时接口架构**：验证了"PC 运行非实时逻辑 + MCU 运行硬实时逻辑"的可行性
2. **分层实时性设计**：硬实时（定时器 ISR）→ 软实时（伺服线程）→ 非实时（用户空间）的三层模型
3. **通信延迟预算**：不同通信接口的延迟特性数据，为 amw 传输层选择提供依据
4. **步进频率控制算法**：可直接移植到 AUDESYS HAL Driver 固件
5. **HAL 组件设计模式**：面向信号的连接、实时函数注册、参数导出
6. **USB 延迟的警示**：USB 不适合实时数据面，硬件卸载是唯一出路
7. **定时器管理策略**：定时器复用、同步、DMA 卸载的 STM32 实践

但 LinuxCNC-STM32 方案也暴露了 STM32 作为实时控制器的天花板：
- 步进频率上限远低于 FPGA
- 轴数受限于定时器资源
- 通信接口的延迟和带宽限制

AUDESYS 的 HAL 设计应该在这些方面超越 STM32 方案，特别是在多轴同步、高步进频率和确定性通信方面。
