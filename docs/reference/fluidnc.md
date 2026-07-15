# FluidNC — ESP32 CNC运动控制固件

> **生成日期**: 2026-07-14
> **参考来源**: GitHub (bdring/FluidNC, GPLv3), wiki.fluidnc.com, DeepWiki, config.yaml示例
> **当前版本**: v3.x (持续发布)

## 一、产品画像

FluidNC 是 ESP32 平台上的 CNC 运动控制固件，由 Bart Dring（Grbl_ESP32 的创建者）开发并维护。它是 Grbl_ESP32 的下一代产品——从基于 C 语言单文件的 Grbl 架构迁移到 C++ 面向对象设计，同时保持了 100% 的 Grbl G-code 兼容性。

### 1.1 项目背景

FluidNC 的诞生源于原始 Grbl（由 Sungeon 'Sonny' Jeon 开发的 Arduino AVR 平台 CNC 控制固件）的架构限制。Grbl 是 C 语言单文件实现，运行在资源极其有限的 AVR MCU 上（8位、2KB RAM、16MHz），在功能扩展和硬件适配方面存在天花板。

Bart Dring 最初创建了 Grbl_ESP32 将 Grbl 移植到 ESP32，随后认识到需要彻底重写架构以充分利用 ESP32 的资源（双核 240MHz、520KB SRAM、WiFi/蓝牙、丰富的外设）。FluidNC 因此诞生，以 C++ 面向对象设计、YAML 配置文件驱动、WebUI 网络界面、可插拔运动学系统为核心特征。

### 1.2 许可证

FluidNC 采用 GPLv3 许可证（GNU General Public License v3），继承自 Grbl 的 GPLv3 许可条款。这意味着使用 FluidNC 的衍生产品必须开源。对于商业嵌入式应用，这是一个需要律师评估的合规问题。相比之下，SimpleFOC 的 MIT 许可证更加宽松。

### 1.3 目标用户

- **CNC 爱好者和创客**：DIY 雕刻机、激光切割机、等离子切割机
- **小型制造企业**：桌面级数控设备、原型验证
- **教育机构**：数控加工教学平台、竞赛设备
- **设备制造商**：基于 FluidNC 定制数控设备，提供 WebUI 和远程控制能力

### 1.4 定位对比

| 固件 | 平台 | 许可证 | 架构 | 网络能力 | 运动学 | 轴数 |
|------|------|--------|------|----------|--------|------|
| FluidNC | ESP32 | GPLv3 | C++ OO+YAML配置 | WiFi/蓝牙/WebUI | 可插拔（5种） | 6轴12电机 |
| Grbl | AVR/STM32 | GPLv3 | C单文件 | 无 | 仅笛卡尔 | 3轴 |
| GrblHAL | 多平台 | GPLv3 | C+HAL层 | 无原生 | 可插拔 | 6轴 |
| grblHAL-ESP32 | ESP32 | GPLv3 | C+HAL层 | 有限 | 可插拔 | 6轴 |
| LinuxCNC | x86/ARM | GPLv2 | Linux RTOS | 完整 | 完整 | 9轴 |

## 二、技术特性

### 2.1 系统架构

FluidNC 采用面向对象分层架构，主要层次包括：

```
┌──────────────────────────────────────┐
│          WebUI (ESP3D WebUI)         │  浏览器/手机控制
├──────────────────────────────────────┤
│          G-Code 解析器                │  RS274/NGC标准解析
├──────────────────────────────────────┤
│          运动控制 (Motion Control)     │  mc_linear/mc_arc/mc_probe
├──────────────────────────────────────┤
│         运动学变换 (Kinematics)        │  Cartesian/CoreXY/Delta/WallPlotter
├──────────────────────────────────────┤
│         轨迹规划 (Planner)            │  加加速度/速度/加速度规划
├──────────────────────────────────────┤
│         步进输出 (Stepping Engine)     │  RMT/Timed/I2S_STATIC/I2S_STREAM
├──────────────────────────────────────┤
│         电机驱动 (Motor Drivers)      │  StepStick/TMC2209/TMC2130等
├──────────────────────────────────────┤
│         硬件抽象层                    │  ESP32 GPIO/Timer/RMT/I2S
└──────────────────────────────────────┘
```

每一层通过 C++ 类边界清晰隔离，支持在 YAML 配置文件中切换实现。

### 2.2 配置文件驱动设计

FluidNC 最本质的创新在于从"编译时配置"转向"运行时配置"。传统 Grbl 需要修改 config.h 重新编译，而 FluidNC 使用 YAML 配置文件描述整个机器：

```yaml
name: "My CNC Machine"
board: "ESP32 Dev Controller V4"

stepping:
  engine: RMT
  idle_ms: 250
  pulse_us: 2
  dir_delay_us: 1

axes:
  shared_stepper_disable_pin: gpio.13:low
  x:
    steps_per_mm: 800
    max_rate_mm_per_min: 2000
    acceleration_mm_per_sec2: 25
    max_travel_mm: 1000
    homing:
      cycle: 2
      mpos_mm: 10
    motor0:
      limit_all_pin: gpio.17:low:pu
      stepstick:
        direction_pin: gpio.14
        step_pin: gpio.12

  y: ...
  z: ...
```

配置文件通过 USB/Serial 或 WiFi 上传到 ESP32 Flash，无需重新编译固件。这种设计使得 FluidNC 可以预编译发布，用户只需编写配置文件即可适配任意机器。

### 2.3 运动学系统

FluidNC 支持可插拔的运动学变换系统。`KinematicSystem` 虚基类定义了标准接口，具体实现包括：

- **Cartesian**（笛卡尔）：标准 XYZ 正交坐标，每个轴独立驱动
- **CoreXY**：双电机驱动 XY 平面，对角线运动需要双电机协调
- **CoreXZ**：CoreXY 的 XZ 平面变体
- **Delta**：并联臂运动学（3轴或更多），复杂的非线性变换
- **WallPlotter**：墙面绘图仪运动学（两电机通过绳索定位）

运动学变换发生在笛卡尔坐标到电机坐标的映射阶段。`kinematics->cartesian_to_motors()` 函数在执行时处理变换，运动轨迹规划（Planner）工作在统一规划层，不感知具体的运动学类型。

### 2.4 轨迹规划器（Planner）

FluidNC 的 Planner 继承自 Grbl 的经典规划算法，但进行了重要增强。Planner 核心逻辑位于 `PlanBufferer.cpp`，流程包括：

**1. 线段缓冲区管理**：Planner 维护一个环形缓冲区（`plan_block_t block_buffer[]`），每个块（block）表示一个运动线段。块包含步数、方向位、加速度限制、速度限制等信息。

**2. 加加速度/速度规划**：Planner 实现了"look-ahead"前瞻算法，预读多个运动线段，在连接点处计算最大允许过弯速度。核心算法基于向心加速度近似：
- `junction_cos_theta` 计算两段运动之间的夹角
- 0° 夹角（直线）：使用最小连接速度
- 180° 夹角（折返）：无限连接速度
- 一般角度：`Vmax = sqrt(acceleration * junction_deviation * sin(θ/2) / (1 - sin(θ/2)))`

**3. 加速/减速曲线**：通过 `plan_compute_profile_parameters()` 计算每个运动块的加速、巡航、减速阶段。支持梯形速度曲线。

**4. 规划重算（Planner Recalculate）**：当新运动块加入缓冲区时，自动重算缓冲区中所有块的连接速度。这是 Grbl 体系的关键算法——通过在缓冲区内来回扫描，确保加速度约束在所有连接点上都被满足。

### 2.5 步进系统（Stepping Engine）

FluidNC 提供四种可切换的步进引擎，每种利用不同的 ESP32 硬件外设：

**Timed Engine**（最简）：
- 使用 GPIO 直接操作 + 自旋循环延迟
- 无硬件卸载，CPU 占用率高
- 适用：低脉冲频率（<50kHz）

**RMT Engine**（默认，推荐）：
- 使用 ESP32 的 RMT（Remote Control）外设生成精确脉冲时序
- RMT 通道硬件处理脉冲宽度和间隔，CPU 无需等待
- 适用：大多数 CNC 应用（50-200kHz）

**I2S_STATIC Engine**（高性能）：
- 使用 I2S 外设并行输出到 GPIO
- 固定缓冲区模式，适合稳定脉冲率
- 适用：需要高脉冲率但不需要步进包（step packet）的应用

**I2S_STREAM Engine**（最高性能）：
- 使用 I2S 外设流式输出步进数据包
- 连续数据流模式，最高脉冲率
- 适用：高速加工（>200kHz）

步进系统使用 20MHz 硬件定时器（`fStepperTimer`），通过 `Stepping::step()` 函数接收轴位掩码和方向位，生成精确的步进脉冲。

### 2.6 通信与网络

FluidNC 的通信能力远超越传统 Grbl 的串口协议：

**串口通道（Channel）**：
- USB/Serial 通道：传统串口通信
- WiFi 通道：TCP socket 连接（端口 23/telnet 风格）
- 蓝牙通道：SPP（Serial Port Profile）
- 所有通道共享相同的 G-code 执行管道

**Channels 系统**：FluidNC 引入了抽象的 Channel 概念，将通信通道与协议处理解耦。每个 Channel 有自己的输入缓冲区、实时命令处理和输出回调。这意味着无论从串口、WiFi 还是蓝牙接收 G-code，执行路径完全一致。

**WebUI（ESP3D-WebUI）**：
- 内置在 ESP32 Flash 中的 Web 界面
- 通过 WiFi AP 或 STA 模式访问
- 功能：文件上传、G-code 发送、位置状态监控、速度进给倍率控制、手动点动
- 响应式设计，适配 PC/手机/平板
- 基于 luc-github/ESP3D-WEBUI 项目

**SD 卡支持**：
- 直接从 SD 卡流式读取 G-code 文件
- 串口/WiFi 通道独立的 SD 卡访问路径
- 支持 `M21`/`M22` 挂载/卸载命令
- $sd/ 目录浏览命令

### 2.7 G-Code 解析器

FluidNC 实现了完整的 RS274/NGC G-code 标准解析器：

**两阶段执行模型**：
1. 解析阶段（Phase 1）：`collapseGCode()` 预处理（去除空格和注释）→ 单词解析（字地址格式）→ 模态组验证
2. 执行阶段（Phase 2）：非模态命令→模态更新→运动→I/O→参数赋值

**模态系统**：解析器维护 `gc_state`（持久状态）和 `gc_block`（临时块）。模态组包括：运动模式（G0/G1/G2/G3/G38/G80）、平面选择（G17/G18/G19）、距离模式（G90/G91）、进给模式（G93/G94/G95）等。

**坐标系统**：
- 机器坐标（Machine Coordinates）：物理轴位置
- 工件坐标（Work Coordinates）：G54-G59 六个工件坐标系
- G92 偏移：临时零位偏移
- TLO（Tool Length Offset）：刀具长度补偿

**参数与表达式**：
- 支持 `#` 参数（系统参数：位置、进给率、刀具信息）
- 支持 `[...]` 表达式（算术运算、函数调用）
- 延迟赋值：参数在运动完成后更新

### 2.8 主循环和执行流

FluidNC 的主循环执行顺序：

```
1. protocol_auto_cycle_start() —— 自动启动运动（Planner缓冲区非空时）
2. protocol_execute_realtime() —— 处理实时命令（进给保持、急停等）
3. mc_dwell() —— 延时代理
4. gc_execute_line() —— 解析和执行 G-code 行
5. 探针监控 —— 探针触发检测
6. SD 卡流式读取 —— SD 卡文件的下一行
7. WiFi/蓝牙通道轮询 —— 网络通道的数据接收
```

关键设计点：实时命令（Realtime Commands）通过中断或单独的定时器处理，不依赖主循环的响应速度。`protocol_execute_realtime()` 函数检查 `sys.realtime_request` 位图，处理进给保持、恢复、急停、速度倍率等实时操作。

### 2.9 硬件抽象与机器配置

FluidNC 的硬件配置通过 `MachineConfig` 类管理，覆盖以下方面：

**GPIO 引脚配置**：
- 步进/方向引脚
- 限位开关（正极/负极/共用）
- 探针引脚
- 冷却液控制（M8/M9）
- 主轴控制（PWM/继电器/VFD）
- 使能信号

**限位开关和归零**：
- 支持正极、负极或双端限位
- limit_all_pin：双端限位共用引脚（节省引脚，但无法确定触发端）
- 独立 limit_pos_pin/limit_neg_pin：区分正负触发端
- 多轴同周期归零（相同 cycle 编号的轴同时移动）
- 支持先搜索（seek）再慢速定位（feed）的两阶段归零

**主轴控制**：
- PWM 控制（通过 gpio.pwm 输出）
- VFD（变频器）控制（通过 RS485 Modbus 协议）
- 支持转速同步

**冷却液和辅助 I/O**：
- 冷却液泵（M8 开/M9 关）
- 继电器输出
- 自定义 M 代码映射



### 2.10 实时命令处理

FluidNC 的实时命令系统是 CNC 固件安全性的关键保障。与传统 Grbl 类似，FluidNC 使用特定的 ASCII 字符在 G-code 流中带外（out-of-band）传输实时命令：

| 字符 | 功能 | 优先级 |
|------|------|--------|
| `~` (0x7E) | Cycle Start / Resume | 高 |
| `!` (0x21) | Feed Hold | 高 |
| Ctrl+X (0x24) | 急停 (Kill / Reset) | 最高 |
| Ctrl+C (0x03) | 重置复位 | 最高 |
| `?` (0x3F) | 状态查询 | 低 |

实时命令不经过 G-code 解析器，直接从串口缓冲区中提取并由 `protocol_execute_realtime()` 处理。Feed Hold 和 Cycle Start 共享一个互斥状态机：Feed Hold 时 Planner 减速停止但不清除缓冲区（可继续）；Kill 时立刻停止并请除所有缓冲区（不可继续）。

### 2.11 进给率控制

FluidNC 支持多种进给率模式，满足不同的加工策略需求：

**G93（Inverse Time Mode）**：逆时间模式，进给率定义为完成整个运动段的倒数时间（每分钟的分数）。这种模式在多轴联动时需要确保所有轴同时到达终点。

**G94（Units per Minute Mode）**：每分钟进给量（默认）。F 值以 mm/min 或 inches/min 为单位。这是最常用的进给率模式。

**G95（Units per Revolution Mode）**：每转进给量。F 值以 mm/rev 为单位，进给率与主轴转速相关联。适用于车床加工。

**进给率倍率**：通过 WebUI 或串口命令可在 1%-200% 范围内实时调整进给率倍率。硬件定时器通过调整 Planner 块中的时间参数实现倍率变化，不需要重新计算轨迹。

### 2.12 主轴同步和速度控制

主轴控制是 FluidNC 的核心能力之一：

**PWM 主轴控制**：通过 GPIO 输出 PWM 信号到主轴驱动接口。支持配置 PWM 频率、占空比和线性化曲线。M3 启动（顺时针），M4 启动（逆时针），M5 停止。

**VFD 变频器控制**：通过 RS485 接口使用 Modbus RTU 协议控制变频器。支持配置 baud rate、Modbus ID、寄存器地址。实现转速同步——当 M3 S10000 设定 10000rpm 时，FluidNC 通过 RS485 发送设定值到变频器。

**激光功率控制**：在激光模式下，主轴转速控制被重新映射为激光功率控制。M4 在激光中实现"动态功率模式"——激光功率随进给速度自动调整，保持恒定能量密度。这种模式对激光雕刻和切割至关重要。

**转速倍率**：与进给率类似，主轴转速也支持实时倍率调整。WebUI 提供滑块控制，可在 50%-200% 范围内调整。

### 2.13 SD 卡文件流式处理

FluidNC 的 SD 卡处理是一个精心设计的数据流系统：

**文件读取流程**：
1. `$sd/` 命令系列（文件列表、选择、状态）
2. `M21` 挂载 SD 卡，`M22` 卸载 SD 卡
3. `~` (Cycle Start) 开始执行当前 SD 卡中的文件
4. 文件逐行读取、逐行解析执行
5. 遇到急停或文件结束时停止

**SD 卡与网络并行访问处理**：FluidNC 处理了 SD 卡访问冲突问题——WebUI 和 Pendant（手轮面板）同时访问 SD 卡时可能出现竞态条件。Mitch Bradley 修复了此问题（#1676），通过互斥机制确保同一时刻只有一个访问者。

**缓冲区流量控制**：当 SD 卡文件执行时，如果 Planner 缓冲区满了，系统等待缓冲区有空位再继续读取。这种 back-pressure 机制防止了缓冲溢出。

### 2.14 多轴联动和插补

FluidNC 的插补算法支持：

**线性插补（G0/G1）**：多轴同步线性运动。Planner 计算每个轴所需的步数，步进引擎确保所有轴同时到达目标位置。

**圆弧插补（G2/G3）**：通过微线段近似实现圆和螺旋线。圆弧在 XY、XZ、YZ 平面内进行，半径插补基于圆心坐标（IJK）或半径（R）。

**精确停止与连续路径**：
- G61（Exact Stop）：在每个运动段末端精确停止，适用于尖锐转角
- G61.1（Exact Path）：沿精确路径运行，不绕过转角
- G64（Continuous Mode）：允许在转角处平滑过渡，更接近编程路径但可能绕过尖锐转角

### 2.15 硬件定时器和中断系统

FluidNC 的定时器系统是实时性能的核心：

**步进定时器**：20MHz 硬件定时器，每个 tick 驱动步进状态机。定时器周期根据需要的步进率动态调整。`Stepping::step()` 函数以 ISR 形式在定时器上下文中执行。

**中断优先级**：
1. 步进定时器 ISR（最高优先级，微秒级周期）
2. 实时命令处理（来自串口的字符在中断中标记）
3. 探针输入 ISR（引脚电平变化立即触发）
4. 主循环（最低优先级，处理 G-code 解析等非实时任务）

**RMT 外设的硬件时序管理**：RMT 引擎利用 ESP32 的 RMT 外设生成高速脉冲序列。RMT 通道有专用的时钟和计数器，可以在不占用 CPU 的情况下产生精确的脉冲宽度和间隔。

### 2.16 POSIX 构建目标

一个值得注意的技术特性是 FluidNC 的 POSIX 构建目标（`build posix`），它允许 FluidNC 在标准 Linux 环境中编译和运行。这个目标由 @MitchBradley 实现（#1664），主要用于集成测试和开发调试。

POSIX 构建目标的意义：
- 不需要 ESP32 硬件即可测试 G-code 解析、Planner 算法、配置加载等核心逻辑
- 可以在 CI/CD 中集成 FluidNC 的单元测试
- 为 AUDESYS Simulator 的设计提供了直接参考——在仿真模式下运行相同的控制逻辑

## 三、功能概览


### 3.1 安装与配置流程

FluidNC 的部署流程极其简洁：用户无需编译固件，只需要两步：

**第一步：安装固件**。使用 FluidNC 安装脚本（install.sh/install.bat）通过 USB/Serial 将预编译的二进制文件上传到 ESP32。固件预编译了所有特性，无需按机器定制编译。

**第二步：编写配置文件**。创建一个 YAML 配置文件（如 `machine.yaml`），描述机器的硬件拓扑——轴数、步进/方向引脚、限位开关、主轴类型、行程范围、加速参数等。通过 USB 串口或 WiFi 上传配置文件到 ESP32 Flash。

**配置验证**：FluidNC 在启动时解析 YAML 配置。如果配置错误，会输出详细的错误信息指明问题所在。

### 3.2 WebUI 远程控制

FluidNC 的 WebUI 是其最具竞争力的功能之一：

- **WiFi AP 模式**：ESP32 创建 WiFi 热点，手机/电脑直接连接
- **WiFi STA 模式**：ESP32 连接到现有网络，通过 IP 地址访问
- **Web 界面功能**：G-code 发送面板、实时位置监视、进给率/主轴倍率控制、手动点动（Jogging）、文件管理器（上传/下载/删除）、配置文件编辑器
- **安全性**：可配置 WiFi 密码和 WebUI 访问密码

### 3.3 探针循环

FluidNC 实现了 G38.x 探测循环，用于自动测量工件位置：

1. 同步机制：等待 Planner 缓冲区清空
2. 初始状态检查：确保探针未触发
3. 运动队列：通过 `mc_linear()` 将探测运动加入 Planner
4. 监控：`probing` 标志在运动过程中持续监控探针输入
5. 触发停止：探针被触发时立刻停止运动，记录位置
6. 可选偏移：触发的坐标偏移到指定工件坐标系

探针中断由步进 ISR 处理，确保实时响应。`probe_steps[]` 数组保存触发时刻的精确位置。

### 3.4 圆弧插补

圆弧（G2/G3）和螺旋插补通过 `mc_arc()` 函数实现：

- 将圆弧分解为微小直线段（微线段近似）
- 微线段通过标准 Planner 进行轨迹规划
- 支持 XY/XZ/YZ 平面选择（G17/G18/G19）
- 支持 IJK（圆心坐标）和 R（半径）两种圆弧定义方式

### 3.5 点动模式

Jogging（点动）用于手动控制：

- 通过 WebUI 按钮或串口 `$J=` 命令触发
- 支持连续点动（持续移动）和增量点动（固定距离）
- 点动运动队列与 G-code 运动共享 Planner 缓冲区
- 点动取消：新命令或按钮松开时立刻停止

### 3.6 回零循环

回零（Homing）是 CNC 加工的安全前提：

- 支持单轴回零（`$HX` 回零 X 轴）和多轴同周期回零（`$H`）
- 两阶段归零：先高速搜索（seek）限位开关，再低速定位（feed）精确位置
- `pulloff_mm` 参数控制接触开关后的回退距离
- `mpos_mm` 参数设置回零后的机器坐标位置
- 行程搜索上限 = `seek_scaler * max_travel_mm`
- 回零前禁止任何运动命令（发送 Alarm: Unhomed）

### 3.7 刀具和主轴管理

FluidNC 支持从简单到复杂的刀具管理：

- 单主轴：PWM 或继电器控制，支持 M3/M4/M5
- 多刀具：通过 M6 换刀指令，支持刀库
- VFD 变频器：RS485 控制，支持转速同步
- 激光模式：激光功率随速度自动调整（M4 动态功率模式）
- 工具类型混合：一台机器可以同时配置激光切割头和主轴

### 3.8 宏与自定义 M 代码

FluidNC 支持通过配置文件定义自定义 M 代码：

```yaml
macros:
  m100: "G90 G0 X0 Y0"        # 自定义 M100：返回原点
  m101: "M3 S10000 G4 P2000"  # 自定义 M101：启动主轴10秒
```

自定义宏可以在不修改固件的情况下扩展机器功能，如自动换刀序列、工作台交换、探针测量序列等。

### 3.9 文件系统

- 内部 Flash 文件系统（SPIFFS）：存储配置文件和 WebUI 文件
- SD 卡文件系统：存储 G-code 文件
- 支持文件列表（$sd/list）、上传、下载、删除
- 支持 G-code 文件从 SD 卡直接流式执行
- 串口命令的自动完成功能（Tab 键）

## 四、现状与生态

### 4.1 项目活跃度

FluidNC 由 Bart Dring 领导开发，核心贡献者包括 Mitch Bradley（大量 Bug 修复和 POSIX 构建支持）。GitHub 仓库 `bdring/FluidNC` 拥有超过 5k stars，持续发布新版本。

关键贡献领域：
- @MitchBradley：WebUI 加载问题修复、SD 卡访问冲突修复、异常解码、POSIX 构建目标、JSON 编码修复、串口补全功能、VFD 速度同步修复
- Discord 社区：活跃的开发和用户讨论

### 4.2 硬件生态

FluidNC 支持多种 ESP32 开发板和 CNC 控制板：

**官方参考硬件**：
- ESP32 Dev Controller V4：Bart Dring 设计的参考控制板
- 6-pack：6轴控制板
- S3 系列：ESP32-S3 支持（USB Host 功能）

**支持的驱动器**：
- StepStick（经典 A4988/DRV8825）
- TMC2209/TMC2130（静音驱动，支持 StallGuard）
- Trinamic 系列（TMC5160 等高性能驱动）

**支持的 ESP32 变体**：
- ESP32（标准版）：WiFi+蓝牙
- ESP32-S2：USB OTG
- ESP32-S3：USB OTG + 更高性能 + 原生 USB Host

### 4.3 文档与社区

- 官方 Wiki：wiki.fluidnc.com（详尽的配置参考和指南）
- 配置文件示例：bdring/fluidnc-config-files 仓库（官方和社区贡献的配置模板）
- Discord 服务器：开发和用户交流
- G-code 发送器兼容性：与 Candle、UGS、LaserGRBL 等标准 Grbl 发送器兼容

### 4.4 许可证与商业使用

GPLv3 许可证限制了闭源商业使用。如果公司基于 FluidNC 开发产品，必须将衍生固件开源。这与 MIT 许可的 SimpleFOC 形成对比。但对于 CNC 设备制造商来说，GPLv3 通常是可接受的——控制固件开源不影响机器设计专利和品牌价值。

### 4.5 与竞品对比

| 特性 | FluidNC | Grbl | GrblHAL | LinuxCNC | MotionController (RMC) |
|------|---------|------|---------|----------|----------------------|
| 平台 | ESP32 | AVR/STM32 | 多平台 | x86/ARM | Pi+FPGA |
| 轴数 | 6轴12电机 | 3轴 | 6轴 | 9轴 | 4轴 |
| 网络 | WiFi/蓝牙/WebUI | 无 | 无原生 | 完整 | Ethernet |
| 配置 | YAML运行时 | 编译时 | 编译时 | HAL/RTL | FPGA固件 |
| 运动学 | 5种(可插拔) | 笛卡尔 | 可插拔 | 完整 | 笛卡尔 |
| 步进引擎 | RMT/I2S/定时器 | 定时器 | 定时器 | N/A(伺服) | FPGA |
| 实时性 | 裸机优先级 | 裸机AVR | 裸机 | RT-PREEMPT | 硬件实时 |
| 社区 | 5k+ stars | 15k+ stars | 2k+ stars | 老牌 | 小众 |
| 许可 | GPLv3 | GPLv3 | GPLv3 | GPLv2 | 闭源(待确认) |
| 部署 | 脚本安装+配置 | 编译烧录 | 编译烧录 | 完整Linux | Pi镜像 |



### 4.6 社区贡献与核心开发者

FluidNC 的核心开发团队：

**Bart Dring**（项目创始人）：Grbl_ESP32 和 FluidNC 的创建者，硬件工程师背景，设计了 ESP32 Dev Controller V4 参考板。负责核心架构设计和硬件参考平台。

**Mitch Bradley**：FluidNC 最重要的社区贡献者，致力于 bug 修复和功能增强。贡献范围包括：WebUI 加载问题修复、SD 卡访问冲突修复、异常解码功能、POSIX 构建目标、JSON 编码问题修复、VFD 速度同步修复、串口 Tab 自动补全功能。Mitch 的贡献风格是"修复根源而非症状"——每次修复都解决一类问题而非单个 bug。

### 4.7 硬件兼容性矩阵

FluidNC 在广泛的硬件配置上经过验证：

**ESP32 开发板**：
- Espressif ESP32-DevKitC（标准开发板）
- ESP32-S3-DevKitC（USB Host 功能）
- ESP32-Saola-1（ESP32-S2 评估板）

**CNC 控制板**：
- ESP32 Dev Controller V4（Bart Dring 设计）
- ESP32 6-pack（6 轴控制板）
- 社区设计的各种定制板

**步进驱动**：
- 标准 StepStick（A4988/DRV8825 等）
- TMC2209/TMC2225（UART 模式，静音驱动）
- TMC2130/TMC5160（SPI 模式，StallGuard 堵转检测）
- Trinamic 系列：支持多种 Trinamic 驱动芯片

**主轴类型**：
- PWM 直流主轴（MOSFET 驱动）
- 变频器主轴（RS485 Modbus 协议）
- 激光模块（PWM 功率控制）
- 继电器开关（三相/单相）

**限位/探针**：
- 机械限位开关（NC/NO 配置）
- 霍尔效应传感器
- 光学接近开关
- 接触式探针（Z 轴对刀/工件找正）

### 4.8 典型应用案例

**案例1：桌面雕刻机（3轴，NEMA17 步进电机）**
- 配置：ESP32 Dev Controller + 3个 StepStick A4988 + 3个 NEMA17 电机
- 功能：WiFi WebUI 控制，SD 卡离线加工
- 特点：YAML 配置简单（~50 行），无需编译

**案例2：激光切割机（2轴，CoreXY 运动学）**
- 配置：ESP32-S3 + TMC2209 静音驱动 + 40W CO2 激光管
- 功能：WebUI 控制激光功率，动态功率模式
- 特点：CoreXY 运动学配置，激光 PWM 频率优化

**案例3：等离子切割机（3轴，THC 高度控制）**
- 配置：ESP32 + TMC5160 大电流驱动 + 等离子电源
- 功能：弧压高度控制、割缝补偿
- 特点：需要额外的模拟输入通道

**案例4：多工具复合机（激光+主轴+旋转轴）**
- 配置：ESP32 + 6pack 控制板 + 1500W 主轴 + 激光模块 + 旋转轴
- 功能：自动换刀宏、M6 换刀序列
- 特点：多工具宏管理，配置文件 ~200 行
## 五、市场定位

### 5.1 目标市场

- **教育/创客 CNC**：桌面雕刻机、激光切割机、3D 打印机（最主流市场）
- **小型制造**：原型加工、小批量生产、标牌制作
- **物联网数控**：利用 WiFi/WebUI 实现远程监控和操作
- **专业设备 OEM**：激光切割机品牌、等离子切割机厂商

### 5.2 竞争优势

- **部署极简**：预编译固件+YAML配置文件，无需编译工具链。从零到加工只需 15 分钟
- **网络原生**：WiFi 和 WebUI 是 FluidNC 区别于所有传统 Grbl 固件的最大特色
- **配置灵活**：YAML 配置文件使同一固件可以适配不同机器
- **架构扩展性**：C++ 面向对象设计便于添加新的运动学、步进引擎和硬件驱动
- **Grbl 兼容**：保持 100% Grbl G-code 协议兼容性，所有 G-code 发送器即插即用
- **性能优势**：ESP32 的双核 240MHz 提供了比 AVR 和 STM32F1 更充足的算力

### 5.3 局限性

- **实时性上限**：ESP32 无硬件实时单元，步进输出精度受中断延迟影响
- **GPIO 数量限制**：ESP32 的 GPIO 引脚数量限制了需要大批 I/O 的应用
- **功率限制**：直接驱动能力弱，需要外部步进驱动器
- **无闭环控制**：不支持伺服闭环，不适用于高精度应用
- **GPLv3 限制**：商业闭源使用受限
- **运动学数量有限**：相比 LinuxCNC（完整支持 9 轴和各种并联/串联运动学），FluidNC 的运动学选择有限

## 六、产品特色

### 6.1 配置文件驱动 — "无编译"哲学

FluidNC 将 CNC 固件的配置从"编译时"迁移到"运行时"，这是对 Grbl 时代最大痛点的直接回应。用户不再需要安装 Arduino IDE、配置编译环境、修改 config.h、重新烧录。只需上传一次固件，然后通过 YAML 文件描述机器特性。这种设计模式大幅降低了 CNC 固件的使用门槛。

### 6.2 原生 WebUI — 机器即服务

FluidNC 将 Web 服务器嵌入 ESP32，使得每台 FluidNC 机器本质上是一台带 WebUI 的网络设备。用户通过手机、平板或电脑浏览器即可控制机器，无需专用 G-code 发送器软件。这种 "Machine as a Service" 模式在工业领域正在普及（如 Siemens Sinumerik ONE），FluidNC 将其带入了桌面级市场。

### 6.3 可插拔步进引擎

四种步进引擎的设计展示了 FluidNC 对 ESP32 硬件外设的深入利用。从简单的 GPIO 自旋（Timed）到 RMT 硬件卸载，到 I2S 高速流式输出，用户可以根据电机的步进频率要求选择最适合的引擎。这种硬件加速的设计在嵌入式固件中值得借鉴。

### 6.4 运动学系统抽象

通过 `KinematicSystem` 虚基类，FluidNC 将坐标变换与轨迹规划分离。这种设计使得添加新的运动学类型（如 SCARA、五轴联动）只需继承接口并实现 `cartesian_to_motors()` 函数。当前支持的 5 种运动学覆盖了大部分桌面级 CNC 应用，但架构设计支持无限扩展。

### 6.5 Channels — 统一通信抽象

FluidNC 的 Channel 系统将串口/WiFi/蓝牙/SD 卡封装为统一的输入源。这种设计超越了传统 Grbl（仅串口）和 LinuxCNC（串口+网络通过中间件）的通信架构。每个 Channel 独立处理输入、实时命令和输出流，G-code 执行管道完全透明。

### 6.6 探针 ISR 同步

探针事件由步进 ISR（中断服务程序）直接检测，不依赖主循环轮询。这保证了探针触发的低延迟（微秒级），对于高精度探测操作（如工件找正、刀具长度测量）至关重要。探针位置在触发时刻被精确记录，不受主循环延迟影响。

## 七、对AUDESYS参考价值

### 7.1 配置文件驱动设计的借鉴

FluidNC 的 YAML 配置驱动设计对 AUDESYS 的配置格式决策（D24：开发 YAML + 运行时 FlatBuffers）提供了直接参考：

- **运行时配置可行性验证**：FluidNC 证明了在 ESP32 这种资源受限的 MCU 上运行时解析 YAML 配置是完全可行的
- **配置热更新**：FluidNC 支持通过 WiFi 更新配置文件——AUDESYS 的 Config Barrier（D17）可以参考这种模式
- **错误反馈**：FluidNC 在配置解析错误时输出详细的错误信息，这对 AUDESYS 的 YAML→FlatBuffers 编译错误处理有参考价值

AUDESYS 可以借鉴的配置设计原则：
1. 配置文件是"机器描述"，而非"代码配置"
2. 用户接口与实现细节分离（YAML 配置对用户友好，FlatBuffers 对运行时友好）
3. 配置验证在加载时执行，错误立即暴露

### 7.2 通信架构的参考

FluidNC 的 Channel 系统为 AUDESYS 的 HAL 通信原语（Signal/StreamChannel/RPC）设计提供了参考：

- **统一抽象**：FluidNC 将串口、WiFi、蓝牙、SD 卡统一为 Channel——这正是 AUDESYS 的 amw 中间件（D11）的设计目标
- **多个输入源同时活跃**：FluidNC 支持所有 Channel 同时工作——AUDESYS 的 StreamChannel 应支持类似的多源地写入
- **实时命令通道**：FluidNC 的实时命令通过中断处理而不是主循环轮询——AUDESYS 的 RT 数据面（D16）需要类似的优先级分离

### 7.3 步进引擎的硬件加速模式

FluidNC 的四种步进引擎展示了"硬件抽象 + 可替换实现"的设计模式，这正是 AUDESYS 的 HAL 设计核心思想：

- **RMT 引擎 = 硬件卸载模式**：专用外设处理精确时序，CPU 专注于计算任务——与 AUDESYS 的 amw 传输层抽象类似
- **I2S_STREAM 引擎 = 高性能模式**：使用高速外设流式输出——对应 AUDESYS 的 amw_zenoh 高性能实现
- **Timed 引擎 = 兼容模式**：纯 GPIO 实现，无需特殊硬件——对应 AUDESYS 的 amw_inproc 简单实现

AUDESYS 的 HAL 可以从这种"多实现、统一接口"的模式中汲取设计思路。

### 7.4 实时性与运动控制

FluidNC 在主循环+ISR 混合模式下实现了硬实时响应的步进输出，这为 AUDESYS 的 RT 调度（D13）提供了参考：

- **ISR 处理时间关键操作**：步进脉冲和探针触发等时间关键操作在 ISR 中处理
- **主循环处理非关键操作**：G-code 解析、配置管理等在后台优先级执行
- **实时命令位图**：通过 `sys.realtime_request` 位图实现快速的全局状态通信

AUDESYS 的 RT 调度可以借鉴这种优先级分离模式，但需要加强到 SCHED_FIFO 级别（D37）以满足硬实时要求。

### 7.5 轨迹规划算法的参考

FluidNC 的 Planner 算法对 AUDESYS Runtime 的运动控制模块有直接参考价值：

- **Look-ahead 前瞻算法**：通过预读多个运动线段计算最优过弯速度——AUDESYS 的 RT 运动控制需要类似的算法
- **向心加速度近似**：使用简单的数学公式实现复杂的加加速度控制——在实时约束下，简单算法比复杂算法更可靠
- **Planner 重算**：新线段加入时自动重算所有连接点——保证全局约束一致性

AUDESYS 的 Runtime 运动控制模块可以将 FluidNC 的 Planner 算法作为参考实现进行移植。

### 7.6 运动学系统的架构借鉴

FluidNC 的 `KinematicSystem` 抽象为 AUDESYS 的机器模型设计提供了参考：

- **坐标变换与运动规划分离**：运动学只负责坐标变换，不参与轨迹规划——低耦合设计
- **通过配置文件选择运动学**：无需编译时配置——AUDESYS 的 Config Barrier 可以考虑类似的设计
- **接口简洁**：`cartesian_to_motors()` 单一接口覆盖所有运动学类型

AUDESYS 的 HAL Device Object 模型可以参考这种"定义少量标准接口，支持多样化实现"的设计模式。

### 7.7 WebUI 对 AUDESYS Studio 的参考

FluidNC 的 WebUI 实现为 AUDESYS Studio（D21：Tauri + React + TypeScript）提供了参考：

- **嵌入式 Web 服务器**：ESP32 运行 Web 服务器提供机器控制界面——AUDESYS 的 Studio 可以通过 WebSocket 与 Runtime 通信
- **实时状态更新**：WebUI 使用 AJAX/WebSocket 实现位置和状态的实时更新
- **响应式设计**：一套 UI 适配 PC/手机/平板

AUDESYS Studio 的初期原型可能不需要完全的桌面应用——FluidNC 的模式证明，Web 界面足以提供 90% 的功能。

### 7.8 对 AUDESYS Simulator 的参考

FluidNC 的 POSIX 构建目标（由 Mitch Bradley 贡献）支持在 Linux 上运行 FluidNC 进行集成测试——这为 AUDESYS Simulator 提供了直接参考：

- **Simulator 架构**：FluidNC 的 POSIX 目标可以在没有硬件的情况下运行规划器和 G-code 解析器
- **AUDESYS Simulator 可以**：在仿真模式下运行同样的 HAL 协议栈，验证控制逻辑而不需要真实硬件
- **G-code 模拟**：FluidNC 的 `$C` G-code 检查模式验证 G-code 的正确性而不执行运动

### 7.9 局限性与警示

1. **ESP32 平台局限**：FluidNC 绑定了 ESP32 平台，不能迁移到其他 MCU/MPU。AUDESYS 的 HAL 必须保持平台无关。

2. **无安全性**：FluidNC 没有功能安全特性。AUDESYS 必须从设计开始就考虑 IEC 61508 兼容性。

3. **GPLv3 vs MIT**：FluidNC 的 GPLv3 限制了商业生态。AUDESYS 的许可证策略需要平衡开放性和商业化。

4. **无闭环控制**：FluidNC 仅支持开环步进控制。AUDESYS 必须同时支持开环步进和闭环伺服。

5. **多语言支持**：FluidNC 完全在 C++/ESP-IDF/Arduino 生态中。AUDESYS 必须支持多语言（D19）。



### 7.10 总结：FluidNC 对 AUDESYS 的整体价值

FluidNC 代表了 CNC 控制固件从 Grbl 的"编译时配置"到"运行时配置"的演进。其最核心的贡献是证明了：在资源受限的嵌入式平台上，面向对象架构、YAML 配置、Web 界面、可插拔硬件抽象可以同时实现，而不会牺牲实时性能。

对于 AUDESYS，FluidNC 的核心参考价值在于：
1. 配置文件驱动的设计模式——与 AUDESYS 的 D24 决策方向一致
2. 统一通信抽象（Channels）——与 AUDESYS 的 amw 中间件设计思想一致
3. 可插拔步进引擎——与 AUDESYS 的 HAL 多实现策略一致
4. 运动学抽象——为 AUDESYS 的机器模型设计提供参考
5. 轨迹规划算法——可直接移植到 AUDESYS Runtime
6. WebUI 模式——为 AUDESYS Studio 的初期原型提供参考


### 7.11 FluidNC 到 AUDESYS HAL 的详细映射

将 FluidNC 的各个子系统映射到 AUDESYS 的 HAL 概念体系，可以更清晰地看出参考价值：

| FluidNC 子系统 | FluidNC 功能 | AUDESYS 对应 | 映射参考 |
|---------------|-------------|-------------|----------|
| Stepping Engine | RMT/Timed/I2S 步进脉冲生成 | amw 传输层 (D11) | 硬件卸载+软件回退多实现策略 |
| MotionControl mc_linear() | 笛卡尔直线运动 | HAL RPC Action | 运动控制通道的 RPC 接口 |
| Planner plan_buffer_line() | 轨迹规划与前瞻 | RT-Scheduler (D13) | 实时调度+约束满足 |
| Kinematics cartesian_to_motors() | 坐标变换 | HAL Signal | 传感器数据变换链 |
| GCode Parser gc_execute_line() | G-code 解析执行 | ST Compiler (D22) | IEC 61131-3 ST 语言解析 |
| Channel 通信抽象 | 统一的输入/输出源 | HAL StreamChannel | 多源数据输入 |
| Machine Config YAML | 机器描述配置文件 | Config YAML (D24) | 开发阶段配置格式 |
| WebUI ESP3D | 浏览器控制界面 | Studio IDE (D21) | Tauri+React 调试面板 |
| Channel 实时命令 | 带外实时命令处理 | RPC 实时面 (D16) | 优先级分级的通信面 |

这个映射表可以作为 AUDESYS 参考文档的交叉引用索引使用。

### 7.12 对 AUDESYS Runtime 运动控制模块的参考

AUDESYS Runtime 的运动控制模块是 Phase 1 的核心组件之一（D34：hal-core 驱动并行）。FluidNC 的 Planner 算法可以直接复用：

**Planner 移植点**：
1. `plan_buffer_line()` 算法的 Rust 移植——前瞻算法和加加速度规划可以直接翻译为 Rust
2. `planner_recalculate()` 重算机制——Rust 版本可以复用相同的"向后扫描+向前扫描"策略
3. `junction_speed` 算法——基于向心加速度的弯道速度计算

**需要考虑的差异**：
- FluidNC 的 Planner 针对开环步进电机优化，AUDESYS Runtime 需要同时支持步进和伺服
- FluidNC 使用浮点数，AUDESYS 的 RT 路径可能需要考虑定点数（CORDIC 或无 FPU 的 MCU）
- FluidNC 的环形缓冲区设计在 Rust 中需要改写为 safe Rust 的环形缓冲区实现

### 7.13 对 AUDESYS 配置设计的参考

FluidNC 的 YAML 配置系统设计对 AUDESYS 的配置格式（D24）有多点参考：

**成功的做法（AUDESYS 可以借鉴）**：
1. YAML 配置描述机器拓扑（轴/电机/驱动器/传感器）
2. 配置错误在加载时立即报告，带行号和错误描述
3. 配置文件有版本号，支持向后兼容
4. 配置文件模板（参考 fluidnc-config-files 仓库）降低上手难度

**需改进的做法（AUDESYS 应该避免）**：
1. FluidNC 在运行时解析 YAML（在 MCU 上）——这不是最佳实践，解析开销影响启动时间。AUDESYS 的 D24 决策（YAML → FlatBuffers 编译）更适合 RT 场景。
2. FluidNC 的配置更新需要重启——AUDESYS 的 Config Barrier（D17）支持运行时配置变更，无需重启。
3. FluidNC 缺少配置版本管理——AUDESYS 应在 YAML 配置中嵌入 schema 版本，支持自动升级。

### 7.14 对 AUDESYS 通信架构的参考

FluidNC 的 Channel 系统和实时命令处理对 AUDESYS 的通信面（data/control/configuration three-plane model）有参考价值：

**Three-plane 通信模型自 FluidNC 视角**：
- **数据面（Data Plane）**：G-code 运动命令 → AUDESYS Signal（传感器数据）+ StreamChannel（运动指令流）
- **控制面（Control Plane）**：实时命令（Feed Hold/Cycle Start/Kill） → AUDESYS RPC（控制通道）+ HalQoS Liveliness（D16）
- **配置面（Configuration Plane）**：YAML 配置文件 → AUDESYS Config Barrier（D17）+ HalQoS Security Domain（D27）

FluidNC 展示了这些通信面在嵌入式平台上的共存模式——三个面共享同一物理通道（串口/WiFi），通过协议层分离（实时命令在 G-code 流中带外传输）。AUDESYS 的 amw 中间件应该在此基础上更进一步，使用逻辑通道分离三个通信面。

### 7.15 对 AUDESYS Simulator 的详细参考

FluidNC 的 POSIX 构建目标为 AUDESYS Simulator 提供了直接架构参考：

**Simulator 架构对比**：

| 层面 | FluidNC POSIX 目标 | AUDESYS Simulator |
|------|-------------------|-------------------|
| 控制逻辑 | 相同的 Planner+GCode 处理 | 相同的 HAL API 调用 |
| 硬件接口 | 无（POSIX 空实现） | 虚拟设备（模拟器） |
| 测试能力 | 集成测试、CI/CD | 完整仿真（含实时调度） |
| 外部连接 | 标准 I/O 重定向 | FlatBuffers over TCP/IP |

**Simulator 实现路径**：
1. Phase 1：像 FluidNC POSIX 一样，在无硬件模式下运行核心控制逻辑
2. Phase 2：添加虚拟设备模拟器（模拟电机、传感器、IO行为）
3. Phase 3：添加回归测试套件，在 CI 中自动运行

FluidNC 的 POSIX 构建用不到 200 行代码实现了无硬件测试能力——AUDESYS 的 Simulator 在 Phase 1 可以遵循同样的"轻量级实现"路径。

### 7.16 对 AUDESYS Studio 的 Web 架构参考

FluidNC 的 WebUI 虽然简单（ESPN3D-WebUI 是单页 HTML+JS），但它验证了"嵌入式设备 + Web 界面"作为远程控制手段的可行性。对于 AUDESYS Studio（D21：Tauri + React + TypeScript）：

**WebUI 到 Tauri 的功能映射**：
- WebUI 点动控制 → Tauri 的 Tauri Command 调用 Rust 后端发送 Dot Control 命令
- WebUI 位置监视 → Tauri 的 Event 系统接收 Runtime 状态更新
- WebUI 文件上传 → Tauri 的文件系统 API
- WebUI 配置编辑 → Tauri 的代码编辑器组件

**AUDESYS Studio 可以超越 FluidNC WebUI 的地方**：
1. 完整的 G-code 编辑器（语法高亮、行号、自动完成）
2. 2D/3D 加工路径预览（Three.js 或专用渲染器）
3. 多机管理（一个 Studio 实例管理多台 FluidNC/AUDESYS 设备）
4. 插件系统（自定义面板和扩展）

### 7.17 总结：FluidNC 在 AUDESYS 参考文档体系中的位置

FluidNC 填补了 AUDESYS 参考文档体系中"桌面级 CNC 固件"的空白。它与 LinuxCNC（完整工业级 CNC 系统）、SimpleFOC（MCU 级 FOC 电机控制库）一起，覆盖了从工业级到桌面级到芯片级的完整运动控制谱系。

FluidNC 的核心经验教训：
1. **配置文件驱动设计**：YAML 使固件适配任何机器——这一模式已被 AUDESYS 采纳为 D24
2. **网络原生接入**：WiFi 和 WebUI 是 FluIne NC 最强差异化——AUDESYS Studio 应至少提供 Web 接入选项
3. **可插拔架构**：步进引擎和运动学的多实现策略——AUDESYS HAL 的 amw 三重实现（D11）是同一模式
4. **实时性与灵活性并存**：C++ OO + ISR 实时处理——AUDESYS 的 RT 线程（D13）应参考这种设计
5. **POSIX 模拟测试**：无硬件测试模式——AUDESYS Simulator Phase 1 的架构模板
