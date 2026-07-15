# Pico-PPMC / hm2-rp2040

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: hm2-rp2040（HostMot2 firmware for the RP2040），社区亦称之为 Pico-PPMC（Pico Parallel Port Motion Control）
- **开发商/组织**: 由 Seb Kuzminsky（SebKuzminsky）个人开发，Seb 是 LinuxCNC 社区核心开发者之一，也是 Mesa hostmot2 驱动的主要维护者
- **首次发布年份**: 约 2023-2024 年（仍在早期开发阶段）
- **当前状态**: 实验性开发阶段 — GPIO 输入/输出工作，步进/编码器/PWM 模块未实现
- **仓库地址**: https://github.com/SebKuzminsky/hm2-rp2040
- **许可证**: 基于 GPL 许可（与 Mesa hostmot2 许可证一致）

#### 项目背景

LinuxCNC 社区长期以来面临一个核心矛盾：高性能的 Mesa FPGA 板卡（$150-500）虽然可靠，但价格门槛限制了普及；而并口直连方案虽然免费，但受限于并行接口的物理距离（< 2m）、电气噪声敏感性和 PC 硬件的逐渐淘汰（现代主板普遍取消并行端口）。

hm2-rp2040 项目试图填补这个空白 — 使用广泛可用、成本极低的 RP2040 微控制器（$1-4）搭配 W5500 Ethernet 芯片（$10 开发板），通过固件模拟 Mesa FPGA 的功能，同时保留 Ethernet 长距离通信的优势。

该项目并非社区中第一个将 RP2040 用于运动控制的尝试 — mrdunk 的 rp2040_pio_stepper 和 eraserhd 的 Remora-RP2040-W5500 都是类似方向的探索 — 但 hm2-rp2040 的独特之处在于直接兼容 Mesa hostmot2 协议，无需修改 LinuxCNC 的用户空间代码。

#### 与 Mesa 的历史关系

Mesa Electronics 是 hostmot2 FPGA 固件的原始开发者，自 2000 年代初开始为 LinuxCNC 社区提供运动控制硬件。其产品线覆盖 PCI、PCIe、Ethernet、SPI 等多种接口，所有 FPGA 固件均以 GPL 许可开源。然而，Mesa 固件的开发需要 Xilinx ISE/Vivado 工具链（免费但复杂），且 FPGA 板卡的生产成本难以降低到 $50 以下。

hm2-rp2040 由 Mesa hostmot2 驱动的主要维护者开发，天然具备协议兼容性的优势。Seb Kuzminsky 对 hostmot2 寄存器文件、IDROM、模块描述符等底层细节的理解使得固件移植的准确性更高。

#### 与 LinuxCNC 的关系

LinuxCNC 是 hm2-rp2040 的唯一主机端 CNC 系统。hm2-rp2040 作为 LinuxCNC HAL 设备，通过标准 Mesa 驱动（hm2_eth 或 hm2_spix）与 LinuxCNC 通信。

关键依赖关系：
- LinuxCNC 必须配置为 uspace 实时模式（hm2_eth 驱动仅支持 uspace）
- 主机需运行 PREEMPT_RT 内核以保障实时性
- 推荐使用专用网卡（Ethernet 模式）或 SPI 端口（SPI 模式）直连
- 需要安装 mesaflash 工具（需略微修改以支持 hm2-rp2040 的 IDROM）

### 1.2 产品定位与核心价值主张

hm2-rp2040 定位为 **低成本、开源、与 Mesa hostmot2 兼容的 RP2040 固件**，其核心价值主张是：

1. **将 $4 MCU 变为 LinuxCNC 运动控制 I/O 设备** — RP2040（Raspberry Pi Pico 的微控制器）仅需 $1-4，W5500-EVB-Pico 开发板（含 Ethernet）仅需 $10，成本远低于 Mesa FPGA 板卡（$100-500）
2. **完全兼容 Mesa hostmot2 生态** — 使用标准 hm2_eth/SPI 驱动，与 LinuxCNC 现有工具链无缝集成，无需修改 LinuxCNC 核心代码
3. **开源透明** — 固件源代码完全公开，无 FPGA 专有工具链依赖（Mesa 固件需要 Xilinx ISE/Vivado）
4. **RP2040 通用性** — 基于广泛可用的 RP2040 平台，开发者可结合 PIO（可编程 I/O）实现自定义外设

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| CNC DIY 爱好者 | 自制 3-6 轴雕刻机、等离子切割机 | 低成本运动控制、社区支持、灵活配置 |
| 小型制造企业 | 旧机床控制系统升级 | 替代停产的控制板卡、降低改造成本 |
| LinuxCNC 开发者 | 新硬件平台验证、hostmot2 实验 | 开放的固件平台、可修改的源代码 |
| 教育与研究 | 运动控制系统教学、实时 I/O 实验 | 低成本硬件、完全可见的固件实现 |
| 嵌入式开发者 | 自定义 I/O 扩展板开发 | RP2040 成熟工具链、PIO 灵活性 |

### 1.4 许可证模型

- **许可证**: GPL（与 Mesa hostmot2 固件一致）
- **商业模型**: 完全开源免费
- **封闭组件**: 无 — 所有代码公开
- **OEM 考虑**: GPL 要求衍生作品同样开源，商用嵌入式场景需注意许可证合规性

### 1.5 项目成熟度评估

| 评估维度 | 状态 | 说明 |
|---------|------|------|
| 功能完整性 | 15% | 仅 GPIO 实现，核心模块缺失 |
| 代码质量 | 中 | 由 LinuxCNC 核心维护者编写，但尚在早期 |
| 文档完整性 | 低 | 仅有 README 和源码注释 |
| 测试覆盖 | 低 | 无自动化测试框架 |
| 社区贡献 | 1 人 | 单一维护者 |
| 商业支持 | 无 | 个人开源项目 |
| 生产适用性 | 否 | 仅限实验/开发环境使用 |

---

## 2. 技术特性

### 2.1 核心架构

hm2-rp2040 采用 **双核对称多处理（SMP）架构**，充分利用 RP2040 的两个 ARM Cortex-M0+ 内核：

```
+------------------------------------------------------------------+
|                    RP2040 (hm2-rp2040 固件)                       |
+------------------------------------------------------------------+
| 核心 0: hostmot2 引擎              | 核心 1: 主机通信             |
|                                    |                              |
| +------------------------------+   | +--------------------------+ |
| | IDROM / Module Descriptors   |   | | 通信接口（运行中选定）    | |
| | Pin Descriptors              |   | |                          | |
| | 64kB 寄存器文件（共享内存）   |   | | 选项 A: hm2_eth (W5500) | |
| +------------------------------+   | | 选项 B: SPI Slave        | |
|            |                       | +--------------------------+ |
|            v                       |            ^                 |
| +------------------------------+   |            |                 |
| | Module Handler 循环          |   |  共享内存   |                 |
| | - ioport (GPIO)              |   |  (64kB      |                 |
| | - stepgen（未实现）          |   |   寄存器    |                 |
| | - pwmgen（未实现）           |   |   文件)     |                 |
| | - encoder（未实现）          |   |            |                 |
| +------------------------------+   |            |                 |
|            |                       |            |                 |
|            v                       |            v                 |
|  +-----------------------------+  |  +------------------------+  |
|  | PIO / GPIO 硬件操作          |  |  | SPI / Ethernet 硬件    |  |
|  +-----------------------------+  |  +------------------------+  |
+------------------------------------------------------------------+
```

**启动流程**：

1. 启动核心初始化寄存器文件 — 包括 IDROM、Module Descriptors、Pin Descriptors 以及所有预分配模块区域
2. 为每个编译时选中的 Module 注册处理程序（handler），用于执行该模块的计算和 I/O 操作
3. 启动第二个核心，在循环中运行所有已注册的 Module Handler
4. 启动核心（核心 1）开始与主机通信（选定 SPI 或 Ethernet 接口）

**关键架构决策**：

- **寄存器宽度**: 所有寄存器为 32 位，使用 RP2040 ARM Cortex-M0+ 的本机字节序（little-endian）
- **多字节访问**: 通信接口（SPI/Ethernet）负责处理多字节数据的字节序转换，确保与 x86 主机兼容
- **FIFO 限制**: 当前双核架构（Eth/SPI 通信在核心 1，hm2 固件在核心 0）无法处理 FIFO 寄存器 — FIFO 需要核心间同步的原子访问。这不影响常见的简单模块（ioport、stepgen、pwmgen、encoder），但限制了需要 FIFO 的高级功能
- **实时性**: RP2040 的 Cortex-M0+ 内核提供确定的执行时序，无缓存一致性开销，适合硬实时 I/O 操作

### 2.2 RP2040 硬件平台

RP2040 是 Raspberry Pi 设计的微控制器，7x7mm QFN-56 封装，关键参数：

| 参数 | 值 |
|------|-----|
| CPU | 双核 ARM Cortex-M0+ @ 133MHz |
| SRAM | 264kB（6 独立存储体，全交叉连接） |
| 外部 Flash | 最大 16MB（专用 QSPI 总线） |
| GPIO | 30 个，4 个可用作模拟输入（12-bit ADC） |
| PIO | 2 个 PIO 块，每块 4 个状态机（共 8 个） |
| SPI | 2 x SPI 控制器 |
| UART | 2 x UART |
| I2C | 2 x I2C 控制器 |
| PWM | 16 x PWM 通道 |
| USB | USB 1.1 Host/Device |
| 特色外设 | 插值器（Interpolator）、整数除法器 |
| 工作电压 | 1.8V - 3.3V I/O |
| 封装 | 7x7mm QFN-56 |
| 单价 | ~$1-4（量价）|

#### PIO（可编程 I/O）结构

RP2040 的 PIO 是 hm2-rp2040 实现高性能 I/O 的关键：

- **每个 PIO 状态机**: 2 x 32 位移位寄存器（双向）、2 x 32 位暂存寄存器、4x32 位总线 FIFO（可重构为 8x32 单方向）、分数时钟分频（16 整数+8 小数位）、灵活 GPIO 映射、DMA 接口
- **性能**: 每个状态机可持续吞吐量最高 1 word/clock（来自系统 DMA）
- **确定性**: PIO 指令执行严格周期级确定，适合精确时序控制
- **GPIO 基址**: 每个 PIO 实例可寻址 32 个 GPIO，通过设置 GPIO 基址（0 或 16）访问不同引脚组（RP2350 支持 48 GPIO 时）

#### W5500-EVB-Pico 目标板

主要参考硬件平台：

| 参数 | 值 |
|------|-----|
| MCU | RP2040（双核 ARM Cortex-M0+ @ 133MHz） |
| Ethernet | W5500 硬连线 TCP/IP 控制器（SPI 接口） |
| SRAM | 264kB |
| Flash | 2MB |
| GPIO 可用 | 20 个（16-21 用于 W5500，23 NC，29 = 3.3V） |
| 接口 | USB-C、Ethernet RJ45、26 GPIO 排针 |
| 尺寸 | 21 x 51mm（标准 Pico 外形）|
| 价格 | ~$10（Digikey）|

W5500 提供 8 个独立硬件 SOCKET、32kB 内部存储器、支持 TCP/UDP/ICMP/IPv4/ARP/IGMP/PPPoE、WOL 和低功耗模式，最高 SPI 速度 80MHz。

### 2.3 模块系统

hm2-rp2040 实现了 Mesa hostmot2 的模块化架构，Module 在编译时通过选中启用，运行时由核心 0 循环执行：

#### ioport（GPIO I/O 端口）

**已实现**。将 RP2040 的 29 个 GPIO 映射为 hostmot2 的通用数字 I/O：

- hostmot2 每个 I/O Port 实例最多支持 24 个 GPIO 线
- 将 29 个 GPIO 拆分为两个 I/O Port 实例：
  - 实例 0: GPIO 0-23（24 个）
  - 实例 1: GPIO 24-29（6 个）
- 在 W5500-EVB-Pico 上，GPIO 16-21 用于连接 W5500 Ethernet 芯片，GPIO 23 未连接，GPIO 29 连接 +3.3V
  - 实例 0 可用: GPIO 0-15 和 22（17 个）
  - 实例 1 可用: GPIO 24-28（5 个）
- 未由 Module 实例使用的 I/O Pin 将作为通用 GPIO（GPIO）暴露

#### stepgen（步进发生器）

**未实现**。Mesa hostmot2 的步进发生器模块将位置/速度指令转换为步进方向（Step/Dir）脉冲信号。需要 PIO 状态机实现精确脉冲时序。

#### pwmgen（PWM 发生器）

**未实现**。PWM 发生器模块将数值转换为 PWM 脉冲信号，通常用于伺服电机模拟速度控制。

#### encoder（编码器计数器）

**未实现**。正交编码器计数器模块读取增量式编码器的 A/B 相信号，计录位置值。

### 2.4 主机通信接口

hm2-rp2040 支持两种主机通信方式，编译时选定：

#### Ethernet（hm2_eth 模式 — 首要目标）

通过 W5500 硬连线 TCP/IP 控制器实现：

- **协议**: 基于 UDP 的 hostmot2 Ethernet 协议
- **主机驱动**: LinuxCNC 标准 hm2_eth 驱动
- **性能**: 百兆 Ethernet，典型 RTT < 0.1ms
- **优势**: 长距离（100m+）、电气隔离（通过 Ethernet 变压器）、无需专用驱动配置
- **硬件**: W5500-EVB-Pico（$10）为最推荐平台，W6100-EVB-Pico（$18）未来可支持

#### SPI Slave 模式

通过 RP2040 SPI 控制器以从机模式工作：

- **主机驱动**: LinuxCNC hm2_spix 或 hm2_rpspi 驱动
- **性能限制**: RP2040 SPI 从机模式最高约 11MHz（见数据手册 4.4.3.4 章节）
- **当前问题**: 1MHz SPI 频率下无法跟上 mesaflash 速度，100kHz 可工作
- **优化方向**: SPI DMA 可能改善性能，但 Ethernet 方案是更好的选择
- **适用场景**: 短距离、低成本的单板计算机（Raspberry Pi）直连方案

### 2.5 寄存器文件架构

hostmot2 的核心数据结构是 64kB 寄存器文件：

```
+-------------------------------------------------------------+
| 64kB hostmot2 寄存器文件（共享内存）                          |
+-------------------------------------------------------------+
| IDROM（Identification ROM）                | 固定偏移        |
| - 魔数签名                                 |                 |
| - 寄存器文件描述                           |                 |
| - 模块计数                                 |                 |
+--------------------------------------------+                 |
| Module Descriptor Table                    |                 |
| - 每模块类型                               |                 |
| - 寄存器偏移                               |                 |
| - 模块大小                                 |                 |
+--------------------------------------------+                 |
| Pin Descriptor Table                       |                 |
| - 每 Pin 功能分配                          |                 |
| - GPIO / 模块功能映射                      |                 |
+--------------------------------------------+                 |
| 模块寄存器区域（各模块专属）                |                 |
| - ioport: 数据方向 / 输出值 / 输入值       |                 |
| - stepgen: 位置 / 速度 / 加速 / 状态       |                 |
| - pwmgen: 频率 / 占空比 / 死区             |                 |
| - encoder: 计数值 / 速度 / 索引            |                 |
+-------------------------------------------------------------+
```

**共享内存机制**:

- 寄存器文件在 RP2040 的两个核心间共享（通过 AHB 交叉开关连接）
- 核心 0（hm2 引擎）写入 I/O 输入值，读取输出值
- 核心 1（通信接口）响应主机的读写请求，直接操作寄存器文件
- 非 FIFO 寄存器无需核心间同步（单原子读写），FIFO 需额外同步机制（当前未实现）

### 2.6 关键技术能力汇总

| 技术领域 | 能力 | 备注 |
|---------|------|------|
| GPIO 通道 | 29（映射为 2 个 hostmot2 I/O Port） | 已实现 |
| 步进轴数 | 理论上最多 8 轴（通过 PIO） | 未实现 |
| 编码器输入 | 理论上实现正交解码 | 未实现 |
| PWM 输出 | 通过 PIO/PWM 外设实现 | 未实现 |
| 主机通信 | Ethernet（W5500）/ SPI Slave | 编译时选择 |
| 线程模型 | 双核：hm2 逻辑 + 通信 | 核间共享内存 |
| 实时性 | Cortex-M0+ 确定性执行 | 需 PREEMPT_RT 主机 |
| 电源 | USB 5V / 排针 5V | 板载 LDO 转 3.3V |
| 调试 | SWD（Serial Wire Debug）| 通过 SWCLK/SWDIO 引脚 |

---

## 3. 功能概览

### 3.1 当前已实现功能（Phase 1）

| 功能 | 状态 | 说明 |
|------|------|------|
| GPIO 数字输入 | 已实现 | 读取 29 个 GPIO 的数字电平 |
| GPIO 数字输出 | 已实现 | 设置 29 个 GPIO 的数字电平 |
| hostmot2 IDROM | 已实现 | 完整的 IDROM 初始化 |
| Module Descriptor | 已实现 | 编译时模块注册 |
| Pin Descriptor | 已实现 | GPIO 到 hostmot2 引脚映射 |
| SPI Slave 通信 | 实验性 | 100kHz 可用，1MHz 需优化 |
| Ethernet 通信 | 基础实现 | 基于 W5500 的 UDP 通信 |

### 3.2 规划中功能（Phase 2+）

| 功能 | 预计状态 | 说明 |
|------|---------|------|
| stepgen（步进发生器）| 未实现 | 使用 PIO 生成 Step/Dir 脉冲 |
| pwmgen（PWM 发生器）| 未实现 | 使用 PWM 外设输出可调占空比方波 |
| encoder（编码器计数器）| 未实现 | 使用 PIO 实现正交解码 |
| FIFO 寄存器支持 | 未实现 | 需要核间同步机制 |
| SPI DMA 优化 | 未实现 | 提高 SPI 通信速率 |
| W6100-EVB-Pico 支持 | 未实现 | 第二个 Ethernet 目标平台 |
| RP2350 支持 | 未实现 | 更高性能、更多 PIO |
| PIO 自定义外设 | 未实现 | 利用 PIO 灵活性扩展 I/O |

### 3.3 hostmot2 标准模块支持矩阵

Mesa hostmot2 固件支持多种模块，hm2-rp2040 对标实现：

| 模块 | Mesa FPGA | hm2-rp2040 | 依赖 |
|------|-----------|-----------|------|
| ioport（GPIO）| 支持 | 已实现 | 直接 GPIO 寄存器 |
| stepgen | 支持 | 未实现 | PIO 状态机（高精度脉冲）|
| pwmgen | 支持 | 未实现 | PWM 外设 / PIO |
| encoder (qcount) | 支持 | 未实现 | PIO 编码器协议 |
| sserial (Smart Serial) | 不支持 | — | 需要复杂同步 |
| uart | 支持 | 待评估 | PIO UART |
| bspi | 支持 | 待评估 | PIO SPI |
| FIFO 高级功能 | 支持 | 不支持 | 核心架构限制 |

### 3.4 开发工具链

- **SDK**: Raspberry Pi Pico SDK（C 语言）
- **编译器**: ARM GCC（arm-none-eabi）
- **构建系统**: CMake（标准 RP2040 构建流程）
- **调试**: SWD（Segger J-Link / Raspberry Pi Debug Probe）
- **烧录**: RP2040 BOOTSEL + UF2 drag-and-drop
- **主机测试工具**: `mesaflash`（需稍作修改）、`elbpcom`（Ethernet Low-Level Board Protocol Communicator）

#### elbpcom 使用示例

```bash
# 读取寄存器地址 0x104 (8 bytes)
$ elbpcom --address=0x104 --read=8

# 写入寄存器地址 0x200 (4 bytes)
$ elbpcom --address=0x200 --write 00000080
```

#### 构建步骤

```bash
# 克隆含子模块
git clone --recurse-submodules https://github.com/SebKuzminsky/hm2-rp2040

# 编辑 CMakeLists.txt 设置 WIZNET_CHIP = W5500
# 选择 W5500-EVB-Pico 目标

# 构建
cd hm2-rp2040
mkdir build && cd build
cmake -DPICO_BOARD=wiznet_w5100s_evb_pico ..
make

# 烧录: 按住 BOOTSEL, 插 USB, 松开, 拷贝 build/*.uf2
```

---

#### PIO 编程模型与 hostmot2 模块实现

RP2040 的 PIO 状态机使用专用的汇编语言（PIO ASM）编程，每个状态机可执行最多 32 条指令。PIO 指令集包含 9 条指令：JMP、WAIT、IN、OUT、PUSH、PULL、MOV、IRQ、SET。

对于 stepgen（步进发生器）模块，PIO 实现方案：
- 使用一个 PIO 状态机生成 Step/Dir 脉冲，通过分数时钟分频器实现精确的频率控制
- 使用另一个 PIO 状态机作为步进计数器，通过位置反馈实现闭环
- 理论最大步进频率：6.65 MHz（133 MHz / 20 个周期/步），实际限制约 500 kHz（步进驱动器最小脉冲宽度限制）

对于 encoder（编码器计数器）模块，PIO 实现方案：
- 使用一个 PIO 状态机解码正交编码器的 A/B 相信号
- 支持 4 倍频（x4 decoding）提高分辨率
- 编码器计数通过 DMA 直接写入共享内存寄存器文件

对于 pwmgen（PWM 发生器）模块，PIO 实现方案：
- 使用 RP2040 的硬件 PWM 外设（16 个独立通道）
- 或使用 PIO 状态机实现更高精度的 PWM 输出
- 支持频率和占空比独立控制

#### 以太网通信性能

W5500 以太网控制器的硬件 TCP/IP offload 引擎减轻了 RP2040 的协议处理负担，实测 ping RTT 为 0.043ms（平均）。hm2_eth 协议基于 UDP，使用自定义的读写事务序列号机制检测丢包：
- 每个读写请求携带递增的序列号
- 接收端检查序列号连续性，检测丢失分组
- 丢包计数器递增，达到阈值后触发 I/O 错误标志
- 错误状态可由用户配置的 packet-error-decrement 参数自动恢复

这种设计确保在噪声环境下 Ethernet 通信的可靠性，是 AUDESYS 设计分布式 HAL 通信时值得参考的机制。

#### 实时性能分析

hm2-rp2040 的实时性能受以下因素影响：

| 因素 | 影响 | 说明 |
|------|------|------|
| RP2040 时钟 | 133MHz，确定性 | Cortex-M0+ 无缓存，无分支预测，时序可预测 |
| Ethernet 延迟 | ~43us RTT | W5500 硬件 offload，受主机 NIC 和驱动影响 |
| 共享内存争用 | 极低 | AHB crossbar 全连接，非 FIFO 访问无锁 |
| SPI 延迟 | ~10us | 较短距离，但受限于 SPI 时钟频率 |
| 主机 RT 调度 | PREEMPT_RT | LinuxCNC 伺服线程需 SCHED_FIFO 优先级 |
| 固件执行周期 | 待测 | 当前仅 GPIO 模块，模块越多周期越长 |

## 4. 现状与生态

### 4.1 当前开发状态

hm2-rp2040 项目处于 **早期实验性开发阶段**：

| 里程碑 | 状态 | 时间 |
|--------|------|------|
| 初始提交 / 仓库创建 | 已完成 | 2023 |
| 双核架构实现 | 已完成 | |
| GPIO (ioport) 实现 | 已完成 | |
| 共享内存寄存器文件 | 已完成 | |
| SPI Slave 通信 | 实验性 | 100kHz 可用 |
| W5500 Ethernet 通信 | 基础实现 | ping 可达 (0.043ms RTT) |
| mesaflash 连接 | SPI 速度不足 | 需要 DMA 优化 |
| stepgen 模块 | 未实现 | |
| pwmgen 模块 | 未实现 | |
| encoder 模块 | 未实现 | |

项目核心开发者 Seb Kuzminsky 同时也是 LinuxCNC 的 Mesa hostmot2 驱动维护者，熟悉 hm2 协议栈。他在 Adafruit RP2040 Scorpio 上进行了原型开发，主要目标平台为 W5500-EVB-Pico（$10 Ethernet RP2040 板）。

### 4.2 关联生态系统

#### Mesa hostmot2 生态

Mesa Electronics 是 hostmot2 FPGA 固件的原始开发者，提供一系列 Anything I/O 运动控制板卡：

| 技术路线 | 代表产品 | 价格范围 | 特点 |
|---------|---------|---------|------|
| Mesa FPGA PCI | 5i20, 5i22, 5i23 | $200-400 | 成熟稳定，ISA 总线 |
| Mesa FPGA PCIe | 3x20 | $150-350 | PCI-Express 接口 |
| Mesa FPGA Ethernet | 7i76E, 7i80, 7i92, 7i93, 7i96S | $100-300 | 百兆 Ethernet，hm2_eth 驱动 |
| Mesa FPGA SPI | 7i90HD, 7i43, 7C80, 7C81 | $80-200 | SPI 连接 Raspberry Pi |
| **hm2-rp2040 (RP2040)** | W5500-EVB-Pico | **$10** | 开源替代，兼容 hostmot2 |

Mesa 提供的 LinuxCNC 兼容 FPGA 固件包括：stepgen (步进)、pwmgen (PWM)、encoder (编码器)、sserial (智能串行)、uart (UART)、bspi (SPI) 等模块。

#### litehm2 (sensille/litehm2)

LiteX port of hostmot2 code to more FPGA boards:

| 特征 | litehm2 | hm2-rp2040 |
|------|---------|------------|
| 目标硬件 | Linsn RV901T (LED 控制板, FPGA) | RP2040 MCU |
| CPU 核心 | RISC-V VexRiscv (LiteX SoC) | ARM Cortex-M0+ |
| 协议实现 | LPB16 + IP/UDP/ICMP/ARP | hostmot2 register file |
| 价格 | ~$20-50 | ~$10 |
| 开发框架 | LiteX (Migen) | Raspberry Pi Pico SDK |
| 成熟度 | 有 HAL 示例（6040 机床） | 实验性 |

#### rp2040_pio_stepper

mrdunk 开发的基于 RP2040 步进电机控制器：

| 参数 | rp2040_pio_stepper | hm2-rp2040 |
|------|--------------------|------------|
| 步进轴 | 最多 8 轴 | 未实现（规划中）|
| 步进速率 | 理论 6.65 MHz, 实际 ~500kHz | 未实现 |
| GPIO | 32 + MCP23017 扩展 (4-8) | 29 GPIO（hostmot2 兼容）|
| 主轴 | RS-485 VFD (Huanyang/Fuling) | 未实现 |
| 主机 | LinuxCNC UDP/Ethernet | LinuxCNC hm2_eth |
| 状态 | 可用, 含 HAL 配置 | 实验性 |

### 4.3 社区与支持

- **开发者**: Seb Kuzminsky (1人)，LinuxCNC 核心贡献者
- **仓库**: https://github.com/SebKuzminsky/hm2-rp2040
- **LinuxCNC 论坛**: https://forum.linuxcnc.org 讨论
- **文档**: GitHub README + LinuxCNC hostmot2 手册
- **商业支持**: 无（个人开源项目）

### 4.4 相关技术栈

| 技术 | 关系 | 说明 |
|------|------|------|
| LinuxCNC | 主机端 CNC 系统 | hm2-rp2040 作为 LinuxCNC HAL 设备 |
| Mesa hostmot2 | 协议兼容 | hm2-rp2040 实现 hostmot2 固件规范 |
| hm2_eth | LinuxCNC Ethernet 驱动 | 标准 Mesa Ethernet 板卡驱动 |
| hm2_spix | LinuxCNC SPI 驱动 | Mesa SPI 板卡统一驱动 |
| Raspberry Pi Pico SDK | 固件 SDK | 提供 RP2040 外设和 PIO API |
| Wiznet W5500 | 硬件 Ethernet 控制器 | 8 硬件 SOCKET, TCP/IP offload |
| mesaflash | 固件烧录/管理 | 需略微修改以支持 hm2-rp2040 |

#### Remora-RP2040-W5500 对比

Remora-RP2040-W5500（eraserhd/scottalford75）是另一个基于 RP2040 的 LinuxCNC 运动控制固件，与 hm2-rp2040 在目标和架构上有所不同：

| 维度 | Remora-RP2040 | hm2-rp2040 |
|------|---------------|------------|
| 协议 | 自定义 UDP 协议 | 标准 hostmot2 hm2_eth |
| 主机驱动 | 自定义 HAL 组件（halcompile）| 标准 hm2_eth 驱动 |
| 步进轴 | 支持（已实现）| 未实现 |
| 配置方式 | 固件编译时配置 + HAL 参数 | 编译时选择模块 |
| 成熟度 | 较高（有社区使用）| 实验性 |
| 兼容性 | 需额外安装 HAL 驱动 | 标准 Mesa 驱动即可 |

Remora 的优势在于步进功能已实现，可直接使用；hm2-rp2040 的优势在于与 Mesa 生态的天然兼容性。两者的存在说明 RP2040 作为 LinuxCNC I/O 平台的可行性已被社区验证。

#### 技术趋势：从 FPGA 到 MCU 的运动控制演化

RP2040 作为运动控制平台的出现反映了开源 CNC 社区的一个重要技术趋势 — 用低成本通用 MCU 替代专用 FPGA。这一趋势的驱动因素包括：

1. **FPGA 成本壁垒**: Xilinx Spartan-6 系列芯片涨价 + 供应不稳定，Mesa 等厂商承受成本压力
2. **PIO 技术成熟**: RP2040 的 PIO 显著降低了确定性 I/O 的门槛，8 个状态机足以覆盖常见的运动控制需求
3. **Ethernet 普及**: 通过 W5500 等廉价 Ethernet 芯片，MCU 可达到与 FPGA 方案相近的网络通信性能
4. **工具链简化**: ARM GCC + CMake 远易于 Xilinx ISE/Vivado，降低了社区贡献门槛
5. **社区创新**: 多个 RP2040 运动控制项目（hm2-rp2040、rp2040_pio_stepper、Remora）的并行发展验证了平台的可行性
---

## 5. 市场定位

### 5.1 在 hostmot2 生态中的位置

hm2-rp2040 填补了 Mesa hostmot2 生态中的一个空白 — **超低成本的 hostmot2 兼容硬件平台**：

Mesa FPGA 板卡提供工业级可靠性、多模块支持（stepgen/pwmgen/encoder 等），但通常 $150-500+。hm2-rp2040 以 $10 成本提供 hostmot2 GPIO 功能的基础实现，适合对成本敏感、对功能需求有限的用户。

### 5.2 竞争替代品对比

| 方案 | 价格 | 成熟度 | 步进能力 | GPIO | Ethernet |
|------|------|--------|---------|------|---------|
| Mesa 7i96S | ~$250 | 高 | 6 轴 | 48+ | 支持 |
| Mesa 7i92 | ~$200 | 高 | 4 轴 | 48+ | 支持 |
| Mesa 7i90HD + SPI | ~$120 | 高 | 8 轴 | 48+ | 否(SPI) |
| litehm2 (Linsn) | ~$30 | 中 | 待定 | 待定 | 支持 |
| rp2040_pio_stepper | $10 | 高 | 8 轴(PIO) | 32+ | 支持 |
| **hm2-rp2040** | **$10** | **低** | **未实现** | **29 GPIO** | **支持** |
| LinuxCNC + 并口 | ~$0 | 高 | <=6 | 17 | 否 |

hm2-rp2040 当前仅实现了 GPIO 功能，尚未与并口方案构成竞争。其核心竞争力在于 future proof — 一旦 stepgen/pwmgen/encoder 实现完成，将成为 $10 级别的全功能 LinuxCNC I/O 方案。

### 5.3 理想用户画像

| 维度 | 描述 |
|------|------|
| 技术水平 | 中高级 — 需要编译固件、配置 LinuxCNC HAL |
| 预算 | $10-30（板卡 + 配件）|
| 应用 | 简单 CNC 控制（3D 打印机、低端雕刻机）|
| 替代对象 | 废弃/过时的 Mesa 板卡 |
| 社群属性 | LinuxCNC 论坛用户 |

### 5.4 成本效益分析

| 方案 | 单轴成本 | 5 轴总成本 | 特点 |
|------|---------|-----------|------|
| Mesa 7i96S（6 轴）| ~$42/轴 | ~$250 | 工业级，开箱即用 |
| Mesa 7i92（4 轴）| ~$50/轴 | ~$250 | 工业级，需外接驱动器 |
| hm2-rp2040（仅 GPIO）| ~$10/板 | ~$10 | 仅数字 I/O，无步进 |
| rp2040_pio_stepper（8 轴）| ~$1.25/轴 | ~$10 | 步进功能完整，开源 |
| LinuxCNC + 并口 | ~$0 | ~$0 | 有限轴数，并口瓶颈 |

hm2-rp2040 在步进功能实现后，有望成为性价比最高的单轴方案。但需注意，$10 的成本仅包含 W5500-EVB-Pico 板卡，不包括驱动器和电源。

### 5.5 技术风险与挑战

| 风险 | 级别 | 缓解措施 |
|------|------|---------|
| 步进模块实现延迟 | 高 | 参考 rp2040_pio_stepper 的 PIO 实现 |
| SPI 性能不足 | 中 | 转向 Ethernet 为主通信方案 |
| FIFO 寄存器限制 | 中 | 避免依赖 FIFO 的模块，或重构核间同步 |
| 单一维护者 | 高 | 吸引社区贡献者，文档化架构 |
| 与 Mesa 固件兼容性 | 低 | 由 LinuxCNC 核心维护者开发 |
| 实时性不足 | 中 | 固件优化 + PIO 加速关键路径 |

### 5.6 发展路线图预测

基于项目现状和社区趋势，hm2-rp2040 的合理发展路径：

| 阶段 | 时间 | 里程碑 |
|------|------|--------|
| Phase 1（当前）| 2023-2025 | GPIO 实现 + 双核架构 + Ethernet 通信 |
| Phase 2 | 2026-2027 | stepgen 模块 + encoder 模块 + pwmgen 模块 |
| Phase 3 | 2027-2028 | SPI DMA 优化 + 多板支持 |
| Phase 4 | 2028+ | RP2350 移植 + FIFO 支持 + 生产级可用性 |
---

## 6. 产品特色

### 6.1 核心差异化特征

| 特征 | hm2-rp2040 | Mesa FPGA | 说明 |
|------|-----------|----------|------|
| 成本 | $10 | $150-500 | W5500-EVB-Pico 极低门槛 |
| 固件开源 | 完全开源 | 开源但需 Xilinx ISE | RP2040 工具链（ARM GCC）免费易用 |
| 编译复杂度 | 低 (CMake) | 高 (Xilinx ISE/Vivado) | Pico SDK 安装简单 |
| 多平台 | RP2040 / RP2350 | Xilinx FPGA | RP2040 生态丰富 |
| hostmot2 兼容 | 标准 hm2_eth | 原生 hm2_eth | 无需修改 LinuxCNC |
| PIO 灵活性 | 8 个 PIO 状态机 | 硬件描述 | 可软件自定义外设 |
| 模块丰富度 | GPIO 仅实现 | 全模块支持 | 仍在早期 |

### 6.2 双核架构创新

hm2-rp2040 的 RP2040 双核使用方案值得关注：

| 核心 | 职责 | 关键代码 |
|------|------|---------|
| 核心 0 (hm2) | Module Handler 循环, GPIO R/W, PIO 操作 | 寄存器文件 R/W, handler 注册/执行 |
| 核心 1 (comm) | SPI Slave / Ethernet 通信 | W5500 ioLibrary_Driver, UDP 协议 |
| 共享内存 | 64kB hostmot2 寄存器文件 | AHB crossbar, 核间数据交换 |

**核间通信性能**: RP2040 的 AHB crossbar 是全连接的，两个 Cortex-M0+ 通过 SIO 和共享 SRAM 通信的延迟极低（几个 CPU 周期），远优于软件消息队列方案。

### 6.3 hostmot2 兼容性

| hostmot2 特性 | 支持 | 备注 |
|-------------|------|------|
| IDROM | 支持 | 标准 IDROM 初始化 |
| Module Descriptor | 支持 | 编译时注册 |
| Pin Descriptor | 支持 | GPIO 映射 |
| 32-bit 寄存器 | 支持 | little-endian 本机字节序 |
| FIFO 寄存器 | 不支持 | 核架构限制 |
| GPIO / ioport | 支持 | 29 线，2 个 I/O Port 实例 |
| stepgen | 未实现 | 需要 PIO 实现 |
| pwmgen | 未实现 | 需要 PWM 外设 |
| encoder | 未实现 | 需要 PIO 正交解码 |
| hm2_eth 协议 | 支持 | W5500 实现 |
| hm2_spix 协议 | 有限 | SPI 速度受限 |
| mesaflash 兼容 | 有限 | SPI 1MHz 不足 |

### 6.4 SPI vs Ethernet 对比

| 维度 | SPI Slave | Ethernet (W5500) |
|------|-----------|------------------|
| 速度 | ~100kHz (当前) -> ~11MHz (理论) | 100Mbit/s |
| 延迟 | < 10us (SPI) | ~43us RTT |
| 距离 | < 50cm | 100m+ |
| 电气隔离 | 需额外 optocoupler | Ethernet 变压器提供 |
| 主机要求 | 需 SPI 端口 (RPi GPIO) | 任意 NIC |
| 网络拓扑 | 点对点 | 点对点 / 交换网络 |
| 推荐程度 | 仅 debug | 生产首选 |

---

## 7. 对 AUDESYS 参考价值

### 7.1 低成本 HAL 硬件的实现思路

hm2-rp2040 项目展示了 **MCU 级 HAL 硬件** 如何替代 FPGA/ASIC 级专用 I/O 控制器的设计理念：

AUDESYS 的 HAL 层设计主要面向仿真环境（软件 HAL），但最终可能需要物理 I/O 接口。hm2-rp2040 提供了一个极低成本（$10）的参考路径 — 使用通用 MCU 而非专用 FPGA 实现运动控制 I/O。

| 维度 | Mesa FPGA | hm2-rp2040 (RP2040) | 对 AUDESYS 启示 |
|------|-----------|---------------------|----------------|
| 成本 | $150-500+ | $10 | 低成本 MCU 方案可行 |
| 时序 | FPGA 提供精确逻辑 | PIO 提供精确时序 | 需嵌入式 PIO 或等效外设 |
| 开发工具 | Xilinx ISE（复杂）| ARM GCC + Pico SDK（免费）| 降低 AUDESYS 硬件准入门槛 |
| IP 复用 | Verilog | C 代码 + PIO 程序 | C/PIO 组合更具可移植性 |

### 7.2 双核架构 vs AUDESYS 线程模型

AUDESYS 的 HAL 设计包含多类型线程：RT（实时）、I/O、事件驱动。hm2-rp2040 的双核分工（hm2 逻辑 + 通信 I/O）提供了 MCU 级别上 **任务隔离** 的参考：

**hm2-rp2040 启示**：
- 实时 I/O 循环（核心 0 的 Module Handler）可作为 AUDESYS `RT` 线程的原型
- 核心 1 的 Ethernet/SPI 通信栈对应 AUDESYS `I/O` 线程
- 共享内存（64kB 寄存器文件）是 AUDESYS Signal/RPC 原语的极简实现：无锁原子读写

**差异分析**：

| 维度 | hm2-rp2040 | AUDESYS HAL（设计） |
|------|-----------|-------------------|
| CPU 架构 | Cortex-M0+ 双核 SMP | Linux x86_64 / ARM |
| RT 实现 | Cortex-M0+ 确定性（无 OS） | PREEMPT_RT + SCHED_FIFO |
| 通信 | RP2040 AHB crossbar（CPU 周期级）| Kernel / Userspace IPC |
| 隔离 | 硬件缓存无关（M0+ 无 cache） | Linux cache thrashing 需关注 |
| 扩展 | 2 核固定 | 任意多线程 |

### 7.3 寄存器文件 vs AUDESYS 信号原语

hm2-rp2040 使用的 hostmot2 64kB **寄存器文件**（register file）与 AUDESYS 的信号原语（Signal / StreamChannel / RPC）在设计理念上有共通之处：

| hostmot2 概念 | AUDESYS 等价 |
|-------------|-------------|
| IDROM + 寄存器偏移 | Signal 命名空间 |
| 32-bit 寄存器 | 14 种类型 (int/float/string/blob) |
| Module 实例 -> 寄存器区域 | Signal group / StreamChannel |
| FIFO 寄存器（未实现）| RPC 调用 |

AUDESYS 可借鉴 hostmot2 的 **寄存器映射** 设计优势：
- **确定性访问**: 32-bit 寄存器的偏移量计算简单（无动态内存分配）
- **可预测延迟**: 共享内存的 R/W 时间恒定（O(1)）
- **结构透明**: IDROM 使运行时能够自描述寄存器布局

### 7.4 PIO 作为 I/O 加速器

RP2040 的 **PIO (Programmable I/O)** 是 hm2-rp2040 未来的核心技术优势 — PIO 状态机可替代 FPGA 逻辑的部分功能：

| PIO 应用 | hostmot2 模块 | 时序要求 |
|---------|-------------|---------|
| Step/Dir 脉冲生成 | stepgen | 50ns-2us 分辨率 |
| 正交编码器解码 | encoder | 10ns-1us 分辨率 |
| PWM 生成 | pwmgen | 1us-1ms 分辨率 |
| UART/SPI/I2C 协议 | uart/bspi | 标准协议 |

AUDESYS 在未来设计嵌入式 I/O 子系统时，可考虑以下路径：
1. **PIO 级抽象**: 如果 AUDESYS Simulator 未来需要硬件 I/O 接口，可采用类似 PIO 的灵活时序单元
2. **RP2040/RP2350 集成**: Pico 平台的广泛可用性使其成为 AUDESYS physical I/O 的理想候选项
3. **litehm2 对比**: LiteX FPGA 生态 vs RP2040 PIO — PIO 更低成本且无 FPGA 工具链依赖

### 7.5 hostmot2 模块化设计的借鉴

Mesa hostmot2 的 **模块化 FPGA 配置** 设计为 AUDESYS 的 HAL 模块构成提供了架构参考：

| hostmot2 概念 | AUDESYS 等价（规划）| 借鉴 |
|-------------|-------------------|------|
| Module Descriptor | HAL 模块定义 | 编译时注册 vs 动态加载 |
| Pin Descriptor | Signal 路由 | 灵活性 = 配置复杂度 |
| IDROM | 服务发现 / HalDiscovery | 运行时自描述 |
| 寄存器文件 | 共享内存 Signal | 确定性延迟 |
| 编译时实例化 | 编译时 vs 运行时 | 嵌入式约束 |


### 7.5.5 RP2040 生态与 RP2350 演进

RP2040 的成功已催生了 Raspberry Pi 的第二代产品 — **RP2350**。RP2350 相比 RP2040 的关键升级：

| 特性 | RP2040 | RP2350 | AUDESYS 意义 |
|------|--------|--------|--------------|
| 双核 | Cortex-M0+ @ 133MHz | Cortex-M33 @ 150MHz + FPU | FPU 对浮点 RT 计算至关重要 |
| PIO 数量 | 8 个 | 8 个（增强指令集） | 同等的灵活 I/O 可编程性 |
| 以太网 | 需外扩 W5500 | 可选 MAC 集成 | 减少外扩组件 |
| 安全 | 无 | TrustZone + Crypto Cell | RT 代码保护 |
| 价格 | $1-4 | 待定（预计相近）| 成本基本不变 |

**RP2350 对 AUDESYS 的意义**：RP2350 的 TrustZone 安全机制和硬件加密单元（Crypto Cell）为嵌入式 HAL 设备提供了 RT 代码保护能力。对于 AUDESYS 的物理 I/O 原型，RP2350 是一个比 RP2040 更适合长期使用的平台，特别是当 HAL 设备需要安全启动和安全通信时。

RP2040/RP2350 生态为 AUDESYS 提供了一条 **渐进式硬件 HAL 演进路径**：

1. **Phase 0 原型阶段**：RP2040 + W5500-EVB-Pico，$10 成本，纯数字 I/O，验证 hm2-rp2040 协议栈
2. **Phase 1 验证阶段**：RP2350 开发板，增加 FPU 浮点运算能力，支持更复杂的实时控制算法
3. **Phase 2 生产阶段**：定制 RP2350 PCB，集成 TrustZone 安全、加密通信、多协议 I/O

这条路径与 AUDESYS 的 Phase 0 → Phase 1 → Phase 2 演进完全吻合，RP2040/RP2350 可作为 AUDESYS 物理 HAL 的标准硬件平台。
AUDESYS 可借鉴 Mesa hostmot2 的设计哲学 — **编译时确定 I/O 布局** 而非动态发现/绑定（对于 RT 部分），以牺牲灵活性换取确定性和 RT 性能。

### 7.6 Ethernet 实时通信对比

hm2-rp2040 使用的 **hm2_eth 协议** 与 AUDESYS 的 JSON-RPC/REST 规划在通信目标上有本质区别：

| 维度 | hm2_eth | AUDESYS（规划）|
|------|---------|---------------|
| 延迟目标 | < 0.1ms (RT servo) | ~ms (simulation debug) |
| 协议 | 自定义 UDP | JSON-RPC / REST |
| 可靠性 | Ethernet 驱动级 ACK | HTTP / TCP |
| 丢失策略 | 超时 + 错误计数器 | 请求重试 |
| 多路复用 | 点对点专用网线 | JSON / HTTP 多设备 |

hm2_eth 使用 `iptables` 链 `hm2-eth-rules-output` 隔离 LinuxCNC 的网络流量，确保 RT 线程不被其他网络干扰。AUDESYS 在设计实时通信时可借鉴**专用网卡/接口 + 通信隔离**的理念。

### 7.7 嵌入式实时 I/O 的设计启示

hm2-rp2040 展示了 **MCU 级 I/O 设备** 如何通过简单协议与主机连接:

| 启示 | 说明 | AUDESYS 应用 |
|------|------|-------------|
| 内核分离 | I/O 逻辑 vs 应用逻辑 | AUDESYS 可将 HAL 部署在独立 MCU |
| 简单协议 | hostmot2 寄存器映射 = 强类型 RPC proto | AUDESYS HAL 可定义二进制协议 |
| 配置过滤 | iptables 隔离 RT 流量 | AUDESYS 需网络 QoS |
| 成本效率 | $10 的 W5500-EVB-Pico | 物理 HAL 原型的最佳起点 |

### 7.7.5 RP2040/RP2350 作为 AUDESYS 物理 HAL 硬件平台

hm2-rp2040 项目的最大参考价值在于它证明了 **$10 的 RP2040 芯片可以承载 hostmot2 运动控制协议栈**。这为 AUDESYS 的物理 HAL 硬件实现提供了一条低成本、可验证的参考路径：

1. **协议栈移植参考**：hm2-rp2040 的 W5500 Ethernet 驱动（W5500 ioLibrary_Driver）和 SPI Slave 实现，可直接作为 AUDESYS 物理 I/O 芯片的通信层参考
2. **双核任务隔离**：核心 0 的 Module Handler 循环对应 AUDESYS 的 RT 线程，核心 1 的通信栈对应 I/O 线程 — 这是 MCU 级别 RT/I/O 隔离的极简实现
3. **PIO 作为 I/O 加速器**：RP2040 的 PIO 状态机（8 个）可替代 FPGA 的部分功能，生成精确时序的 Step/Dir 脉冲，为 AUDESYS 物理 HAL 提供确定性 I/O
4. **渐进式硬件演进**：RP2040 → RP2350 的升级路径（FPU、TrustZone、安全启动）与 AUDESYS 的 Phase 0 → Phase 1 → Phase 2 演进完全吻合

对于 AUDESYS 的硬件 HAL 原型开发，RP2040 + W5500-EVB-Pico 是目前性价比最高的起点 — $10 成本即可获得完整的 Ethernet 运动控制 I/O 能力。

hm2-rp2040 的 W5500 通信架构特别值得 AUDESYS 关注：W5500 是一个 8 Socket 的硬件 TCP/IP 控制器，所有协议栈处理（ARP、IP、TCP/UDP）均在硬件级别完成，RP2040 仅需通过 SPI 读写 Socket 寄存器。这意味着：

| 层面 | W5500 实现 | AUDESYS 启示 |
|------|-----------|-------------|
| 物理层 | SPI（MCU ↔ W5500）| 嵌入式 HAL 设备可用 SPI/Ethernet 通用接口 |
| 数据链路层 | W5500 硬件 MAC | 嵌入式 HAL 无需实现 MAC 驱动 |
| 网络层 | W5500 硬件 IP | 嵌入式 HAL 无需实现 IP 协议栈 |
| 传输层 | W5500 硬件 UDP | 嵌入式 HAL 仅需 UDP 应用层逻辑 |
| 应用层 | hostmot2 寄存器映射 | AUDESYS HAL 可定义简洁的二进制协议 |

这种分层解耦使嵌入式 HAL 设备的软件实现极简化 — RP2040 核心 1 仅需约 2000 行 C 代码即可完成完整的 Ethernet 通信，包括 UDP 协议、序列号管理、丢包检测。AUDESYS 在设计嵌入式 HAL 设备时，可参考这种 **硬件卸载 + 极简软件** 的分层架构。
### 7.8 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 低 | GPIO 仅实现，核心模块 (stepgen/pwmgen/encoder) 未完成 |
| 开发活跃 | 中 | Seb 持续维护 hm2-rp2040/ping tests |
| AUDESYS HAL 参考 | 高 | 双核隔离 + 寄存器映射 + PIO 加速 |
| AUDESYS 物理 I/O 候选 | 很高 | $10 成本 + 开源 + hm2_eth 兼容 |
| 学习价值 | 高 | hostmot2 协议、RP2040 双核编程 |
| 生产准备 | 否 | 仅适合实验/开发，不建议生产部署 |

hm2-rp2040 项目当前虽处于早期阶段（仅 GPIO 实现），但其**双核架构、共享内存协议**对 AUDESYS 的设计参考价值远超过当前功能实现。它展示了一个实时通信中间件的 MCU 微缩实现，与 AUDESYS 的 HAL Signal/StreamChannel 在设计理念上高度契合。

AUDESYS 可将 hm2-rp2040 + W5500-EVB-Pico 作为：
1. **物理 HAL 的原型平台**: $10 成本即可开始 AUDESYS 硬件 I/O 实验
2. **通信协议参考**: hostmot2 的寄存器文件映射 vs AUDESYS 的 Signal/StreamChannel
3. **RT/I/O 任务隔离**: 双核分工的 MCU 参考

---

> **本文档基于 2026 年 7 月的公开信息编写。hm2-rp2040 (SebKuzminsky/hm2-rp2040) 仍处于早期实验阶段。部分数据可能随项目版本迭代而变化。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从官方仓库验证。**