# GRBL

**📜 历史参考** — 自 2019 年起无更新。本分析保留作为极简运动控制架构参考。
## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: GRBL（Embedded G-code Interpreter and CNC Controller）
- **开发商/组织**: 开源社区，由 **Simen Svale Skogsrud**（2009-2011）发起，**Sungeun K. Jeon（Sonny）**（2011-2015）主导开发，后由 **gnea**（Douglas Chapman）维护（2015-至今）
- **首次发布年份**: 2009 年（grbl/grbl 仓库创建于 2009-01-24）
- **当前版本**:
  - 官方仓库 grbl/grbl（原站）: 仅保留历史版本，已归档
  - 官方仓库 gnea/grbl（新站）: **v1.1h**（2019-08-25，最新稳定版）
  - v1.1 系列: v1.1e（2016-10-13 beta）→ v1.1f（2017-02-01）→ v1.1g（2018-10-01）→ v1.1h（2019-08-25）
  - v0.9 系列: v0.9g → v0.9h → v0.9i → v0.9j（2016-03-17）
- **仓库地址**:
  - 原官方仓库（已归档）: https://github.com/grbl/grbl（6.1K stars，3.2K forks）
  - 当前官方仓库（v1.1）: https://github.com/gnea/grbl
  - Grbl-Mega（Mega2560 支持）: https://github.com/gnea/grbl-Mega
  - grblHAL（HAL 化移植）: https://github.com/grblHAL/grblHAL
- **项目网站**: 原 https://grbl.org（已归档）

### 1.2 产品定位与核心价值主张

GRBL 定位为 **低成本、高性能、嵌入式 CNC 控制器**，核心价值主张是：

1. **极致低成本** — 仅需 Arduino Uno（$25），替代并口（Parallel Port）控制系统
2. **无妥协性能** — 在 8 位 AVR MCU 上实现 30kHz 无抖动步进脉冲，硬实时控制
3. **极简即插即用** — 烧录固件即可运行，无需复杂配置
4. **G-code 标准兼容** — 支持 RS274/NGC G-code 子集
5. **硬件无关性** — CPU 映射系统支持多平台移植

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| DIY CNC 创客 | 3D 打印机/CNC 铣床/激光切割机 | 低成本、简单部署、Arduino 生态 |
| 小型制造商 | 桌面 CNC 加工 | 3 轴运动控制、激光/主轴控制 |
| 教育/教学 | CNC 和嵌入式系统教学 | 开源透明、可分析代码 |
| 原型开发者 | 快速 CNC 原型验证 | 无许可证费用、社区支持 |
| 激光雕刻爱好者 | 激光切割机/雕刻机 | 激光模式、主轴 PWM |
| OEM 制造商 | 预装 CNC 套件 | 稳定性、EEPROM 存储配置 |

### 1.4 许可证模型

- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **商业模型**: 完全开源，免费使用
- **封闭组件**: 无 — 完全开源
- **OEM 考虑**: GPL-3.0 要求衍生作品同样开源，商用预装 CNC 套件需注意许可证合规性
- **硬件要求**: 免费固件，需自行采购硬件（Arduino 或兼容板）

---

## 2. 技术特性

### 2.1 核心架构

GRBL 采用 **分层中断驱动架构**（Layered Interrupt-Driven Architecture），运行在 ATmega328p（Arduino Uno）上：

```
+-------------------------------------------------------------+
|                GRBL 系统架构                                 |
+-------------------------------------------------------------+
|                                                           |
|  应用层 (Application Layer)                                |
|  +-----------------------------------------------------+  |
|  | G-code 解释器 (gcode.c)                              |  |
|  |  - 双遍解析 (Two-pass Parser)                        |  |
|  |  - 模态组 (Modal Groups)                            |  |
|  |  - 运动模式 (G0/G1/G2/G3)                           |  |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  规划层 (Planner Layer) - planner.c                       |
|  +-----------------------------------------------------+  |
|  | 前瞻规划器 (Look-ahead Planner)                      |  |
|  |  - 规划缓冲 (Planner Buffer) - 环缓冲 (Ring Buffer)   |  |
|  |  - 速度优化 (Reverse + Forward Pass)                 |  |
|  |  - 梯形加速度曲线 (Trapezoidal Profile)               |  |
|  |  - 段缓冲 (Segment Buffer)                           |  |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  执行层 (Execution Layer) - stepper.c                     |
|  +-----------------------------------------------------+  |
|  | 步进生成器 (Stepper ISR)                             |  |
|  |  - Bresenham 直线算法                                |  |
|  |  - AMASS 自适应多轴平滑                              |  |
|  |  - 梯形生成器 (Trapezoid Generator)                   |  |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  协议层 (Protocol Layer) - protocol.c                      |
|  +-----------------------------------------------------+  |
|  | 协议处理器 (Protocol Handler)                        |  |
|  |  - 串行通信 (serial.c)                               |  |
|  |  - 实时命令 (Real-time Commands)                     |  |
|  |  - 状态机 (State Machine)                            |  |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  硬件抽象层 (Hardware Abstraction) - cpu_map.h             |
|  +-----------------------------------------------------+  |
|  | CPU 映射 (CPU Mapping)                               |  |
|  |  - ATmega328p (Arduino Uno)                          |  |
|  |  - ATmega2560 (Arduino Mega)                         |  |
|  |  - 自定义平台扩展                                    |  |
|  +-----------------------------------------------------+  |
|                        |                                  |
|  硬件层 (Hardware)                                         |
|  +-----------------------------------------------------+  |
|  | 步进电机 | 限位开关 | 主轴 | 冷却 | 安全门 | 探针    |  |
|  +-----------------------------------------------------+  |
+-------------------------------------------------------------+
```

#### 架构层次详解

GRBL 的核心设计哲学是 **"命令解释与运动执行完全分离"**：

| 层次 | 组件 | 文件 | 职责 |
|------|------|------|------|
| **应用层** | G-code 解析器 | gcode.c/h | 将 G-code 指令解析为内部运动命令 |
| **规划层** | 运动规划器 | planner.c/h | 计算加速度曲线、速度优化、前瞻缓冲 |
| **执行层** | 步进模块 | stepper.c/h | 产生精确的步进脉冲（中断驱动） |
| **协议层** | 协议处理器 | protocol.c/h | 串行通信、命令路由、实时命令 |
| **硬件层** | CPU 映射 | cpu_map.h | 硬件引脚到逻辑功能的映射 |

#### 中断架构（Interrupt Architecture）

GRBL 完全基于中断实现硬实时控制：

| 中断源 | 定时器/触发 | 优先级 | 用途 | ISR 代码 |
|--------|------------|--------|------|---------|
| Timer1 COMPA | 比较匹配中断 | 最高 | 步进脉冲生成（主步进 ISR） | stepper.c |
| Timer0 OVF | 溢出中断 | 最高 | 步进脉冲下降沿复位 | stepper.c |
| Serial RX | UART 接收 | 中 | 串行数据接收 | serial.c |
| Pin Change | 引脚变化 | 中 | 控制引脚（复位/进给保持/循环启动） | protocol.c |

#### 主循环（Main Loop）

```c
// main.c 主循环伪代码
int main(void) {
    serial_init();              // 初始化串行通信
    settings_init();            // 从 EEPROM 加载配置
    st_init();                  // 初始化步进模块
    sei();                      // 启用中断
    memset(&sys, 0, sizeof(sys));
    sys.abort = true;           // 触发初始化
    sys.state = STATE_INIT;     // 初始状态

    for(;;) {
        if (sys.abort) {
            // 系统重置：清空缓冲、初始化状态
            serial_reset_read_buffer();
            plan_init();
            gc_init();
            protocol_init();
            spindle_init();
            limits_init();
            st_reset();
            sys_sync_current_position();
            // ...
        }

        protocol_execute_runtime();  // 处理实时命令
        protocol_process();          // 处理串行协议
    }
}
```

### 2.2 系统状态机（State Machine）

GRBL 使用 **9 状态状态机** 管理系统行为：

| 状态 | 常量 | 描述 | 允许操作 |
|------|------|------|---------|
| **IDLE** | STATE_IDLE | 空闲，等待命令 | 所有操作 |
| **QUEUED** | STATE_QUEUED | 已排队，等待循环启动 | 循环启动 |
| **CYCLE** | STATE_CYCLE | 运动中 | 实时命令（进给保持/重置） |
| **HOLD** | STATE_HOLD | 进给保持中 | 恢复/重置 |
| **HOMING** | STATE_HOMING | 归位循环中 | 实时命令 |
| **ALARM** | STATE_ALARM | 报警状态 | 仅重置、解锁命令 |
| **CHECK MODE** | STATE_CHECK_MODE | G-code 检查模式（无运动） | G-code 处理（无执行） |
| **SAFETY DOOR** | STATE_SAFETY_DOOR | 安全门打开 | 实时命令 |
| **SLEEP** | STATE_SLEEP | 休眠模式，电机禁用 | 仅重置 |

#### 状态转换图

```
STATE_INIT
    |
    v
STATE_IDLE <---> STATE_QUEUED <---> STATE_CYCLE
    |                         |
    |                         v
    |                    STATE_HOLD <---> STATE_CYCLE (恢复后)
    |
    v
STATE_HOMING (归位)
    |
    v (归位完成)
STATE_IDLE
    |
    v (错误/碰撞)
STATE_ALARM
    |
    v ($X 解锁)
STATE_IDLE

(任何状态) --> STATE_SAFETY_DOOR (安全门)
(任何状态) --> STATE_SLEEP (休眠)
```

### 2.3 G-code 解析器（Parser）

GRBL 的 G-code 解析器采用 **双遍解析**（Two-pass Parser）设计：

#### 第一遍：命令解析

第一遍解析所有 G-code 命令（G/M/T 代码），更新模态状态：

| 字母 | 含义 | 示例 |
|------|------|------|
| G | G-code 命令 | G0, G1, G2, G3, G17, G20, G90 |
| M | M-code 命令 | M3, M5, M0, M2 |
| T | 刀具号 | T1, T2 |

#### 第二遍：参数解析

第二遍解析坐标参数（X/Y/Z/I/J/K）和运动参数（F/S/P）：

| 字母 | 含义 | 单位 |
|------|------|------|
| X/Y/Z | 目标坐标 | 毫米/英寸（取决于 G20/G21） |
| F | 进给速度 | 毫米/分钟 或 秒/运动（G93/G94） |
| S | 主轴转速 | RPM |
| P | 停留时间 | 毫秒 |
| I/J/K | 圆弧圆心偏移 | 毫米 |

#### 模态组（Modal Groups）

GRBL 实现的模态组：

| 组 | G-code | 功能 |
|----|--------|------|
| 0 | G10, G28, G30, G92, G92.1, G92.2, G92.3 | 非模态（每行执行一次） |
| 1 | G0, G1, G2, G3, G80 | 运动模式（Seek/Linear/Arc CCW/Arc CW/Cancel） |
| 2 | G17, G18, G19 | 平面选择（XY/XZ/YZ） |
| 3 | G20, G21 | 单位模式（英寸/毫米） |
| 4 | G90, G91 | 距离模式（绝对/增量） |
| 5 | G93, G94 | 进给模式（逆时针/正常） |
| 6 | G53 | 绝对覆盖（机床坐标） |
| 7 | M3, M4, M5 | 主轴控制（CW/CCW/停止） |
| 8 | M7, M8, M9 | 冷却控制（雾/流/停止） |
| 9 | M0, M1, M2, M30, M60 | 程序流（暂停/可选暂停/结束） |
| 10 | M48, M49 | 进给/速度覆盖开关 |

#### 不支持的功能

| 功能 | 说明 |
|------|------|
| 固定循环 (Canned Cycles) | G81-G89 未实现 |
| 刀具半径补偿 (Tool Radius Compensation) | G41/G42 未实现 |
| A/B/C 轴 | 仅支持 X/Y/Z 三轴 |
| 表达式计算 | 不支持 G-code 表达式 |
| 变量 | 不支持 G-code 变量 |
| 多次坐标系统 | G54-G59 未实现 |
| 多次归位位置 | 仅支持一个归位位置 |
| 探测 | G38.2-G38.3（部分支持，取决于配置） |
| 覆盖控制 | M48/M49（部分支持，取决于配置） |


### 2.4 运动规划器（Motion Planner）

GRBL 的运动规划器是系统的核心优化引擎：

#### 前瞻规划（Look-ahead Planning）

```
G-code 行 -> 解析器 -> 规划缓冲 (Ring Buffer, 16 blocks) -> 段缓冲 -> 步进 ISR
```

规划缓冲（Planner Buffer）是 **16 块环缓冲**，存储多个运动块（block），使系统可以前瞻多个运动并进行速度优化。

#### 速度优化算法

GRBL 使用 **两遍重计算**（Two-pass Recalculation）算法优化速度曲线：

| 遍历 | 方向 | 目的 |
|------|------|------|
| **Reverse Pass**（逆向遍历） | 从最后块到第一块 | 计算每块最大入口速度（受出口速度约束） |
| **Forward Pass**（正向遍历） | 从第一块到最后块 | 确保加速不超过能力（受入口速度约束） |

#### 梯形加速度曲线

```
nominal_rate*entry_factor -->   +
                                 |             + <-- nominal_rate*exit_factor
                                 +-------------+
                                      time -->

                           +--------+   <-- nominal_rate
                          /          \
```

| 参数 | 描述 | 单位 |
|------|------|------|
| `nominal_rate` | 名义速度（段内最大速度） | steps/min |
| `initial_rate` | 入口速度 | steps/min |
| `final_rate` | 出口速度 | steps/min |
| `accelerate_steps` | 加速阶段步数 | steps |
| `decelerate_steps` | 减速阶段步数 | steps |
| `plateau_steps` | 匀速阶段步数 | steps |

#### 梯形计算伪代码

```c
// planner.c - 梯形参数计算
static void calculate_trapezoid_for_block(block_t *block, float entry_factor, float exit_factor) {
    block->initial_rate = ceil(block->nominal_rate * entry_factor);
    block->final_rate = ceil(block->nominal_rate * exit_factor);
    int32_t accel_per_min = block->rate_delta * ACCELERATION_TICKS_PER_SECOND * 60.0;
    int32_t accelerate_steps = ceil(estimate_acceleration_distance(
        block->initial_rate, block->nominal_rate, accel_per_min));
    int32_t decelerate_steps = floor(estimate_acceleration_distance(
        block->nominal_rate, block->final_rate, -accel_per_min));
    int32_t plateau_steps = block->step_event_count - accelerate_steps - decelerate_steps;
    if (plateau_steps < 0) {
        accelerate_steps = ceil(intersection_distance(
            block->initial_rate, block->final_rate, accel_per_min, block->step_event_count));
        plateau_steps = 0;
    }
    block->accelerate_until = accelerate_steps;
    block->decelerate_after = accelerate_steps + plateau_steps;
}
```

### 2.5 步进控制（Stepper Control）

#### Bresenham 直线算法

GRBL 使用 **Bresenham 直线算法** 实现多轴同步步进，而非 DDA（数字微分分析器）：

| 优势 | 说明 |
|------|------|
| 精确性 | Bresenham 算法使用整数计数，无浮点舍入误差 |
| 低开销 | 仅需加法/减法，无乘除运算 |
| 多轴同步 | 所有轴在同一 ISR 周期内同步计算 |

#### 步进 ISR 数据结构

```c
// stepper.c - 步进 ISR 数据结构
typedef struct {
    uint32_t counter_x,       // Bresenham 计数器 - X轴
             counter_y,       // Bresenham 计数器 - Y轴
             counter_z;       // Bresenham 计数器 - Z轴
    uint32_t step_count;      // 段内剩余步数
    uint8_t execute_step;     // 执行步标记
    uint8_t step_outbits;     // 下一步输出位
    uint8_t dir_outbits;      // 方向输出位
    st_block_t *exec_block;   // 当前执行块
    segment_t *exec_segment;  // 当前执行段
} stepper_t;
```

#### AMASS（Adaptive Multi-Axis Step Smoothing）

AMASS 是 GRBL 的创新算法，解决 Bresenham 在低频时的 **多轴锯齿效应**（Aliasing）：

| AMASS 级别 | 位偏移 | ISR 频率倍增 | 非主导轴步进精度 |
|-----------|--------|------------|---------------|
| Level 0（无 AMASS） | 0 | x1 | 仅主轴步进时非主轴才步进 |
| Level 1 | 1 bit | x2 | 非主导轴可在 2 个 ISR 周期中步进 |
| Level 2 | 2 bits | x4 | 非主导轴可在 4 个 ISR 周期中步进 |
| Level 3 | 3 bits | x8 | 非主导轴可在 8 个 ISR 周期中步进 |

AMASS 通过 **位移操作**（bit-shift）而非乘法增加 Bresenham 分辨率，在保留 Bresenham 精确性的同时消除多轴锯齿：

```
Level 1: Bresenham step_count << 1 (x2), ISR 频率 x2
Level 2: Bresenham step_count << 2 (x4), ISR 频率 x4
Level 3: Bresenham step_count << 3 (x8), ISR 频率 x8
```

AMASS 自适应级别取决于步频率：
- 高频（> 20kHz）: 通常不需要 AMASS
- 中频（5-20kHz）: Level 1
- 低频（0-5kHz）: Level 2-3

### 2.6 实时命令系统（Real-time Commands）

GRBL 的实时命令系统在运行时随时可响应，无需等待当前运动完成：

#### 实时命令字符

| 命令 | ASCII | 功能 | 说明 |
|------|-------|------|------|
| `~` | 0x7E | 重置（Reset） | 立即停止所有运动，重置系统 |
| `!` | 0x21 | 进给保持（Feed Hold） | 减速停止当前运动 |
| `?` | 0x3F | 状态查询（Status Report） | 返回当前状态（位置/模式/错误） |
| `*` | 0x2A | 实时覆盖命令 | 实时进给/主轴速度覆盖（v1.1） |
| `$` | 0x24 | 系统命令（Settings） | 配置/查询系统设置 |

#### 实时执行标志

```c
// 系统实时执行标志位（8 位，每个 bit 一个命令）
typedef struct {
    uint8_t abort;                 // 系统重置标志
    uint8_t state;                 // 系统状态
    volatile uint8_t execute;      // 实时命令执行标志（全局 volatile）
    // execute 的 bit 定义：
    //   EXEC_CYCLE_START  (bit 0)
    //   EXEC_CYCLE_STOP   (bit 1)
    //   EXEC_FEED_HOLD    (bit 2)
    //   EXEC_RESET        (bit 3)
    //   EXEC_SAFETY_DOOR  (bit 4)
    //   EXEC_HOMING_CYCLE (bit 5)
    //   EXEC_MOTOR_ENABLE (bit 6)
    //   EXEC_MOTOR_DISABLE(bit 7)
} system_t;
```

实时命令的优先级：重置（Reset） > 安全门（Safety Door） > 进给保持（Feed Hold） > 循环启动（Cycle Start）

### 2.7 硬件抽象层（CPU 映射）

GRBL 的 **CPU 映射系统** 提供了硬件无关性：

#### 支持的 CPU 平台

| 平台 | CPU | Flash | RAM | 引脚数 | 备注 |
|------|-----|-------|-----|--------|------|
| ATmega328p | 8-bit AVR | 32KB | 2KB | 28 | Arduino Uno（官方支持） |
| ATmega2560 | 8-bit AVR | 256KB | 8KB | 54 | Arduino Mega（社区支持） |

#### CPU 映射文件结构

```c
// cpu_map_atmega328p.h - 示例片段
#define GRBL_PLATFORM "Atmega328p"

// 步进引脚定义
#define STEPPING_DDR        DDRD
#define STEPPING_PORT       PORTD
#define STEPPING_BIT        2     // Pin D2

#define DIRECTION_DDR       DDRD
#define DIRECTION_PORT      PORTD
#define DIRECTION_BIT       5     // Pin D5

#define STEP_ENABLE_DDR     DDRB
#define STEP_ENABLE_PORT    PORTB
#define STEP_ENABLE_BIT     4     // Pin D10

// 限位开关引脚
#define LIMIT_DDR           DDRB
#define LIMIT_PIN           PINB
#define LIMIT_PORT          PORTB
#define LIMIT_MASK          0x07  // Pins D8-D10
```

### 2.8 EEPROM 配置存储

GRBL 使用 **EEPROM** 存储运行时配置，实现掉电保持：

#### 核心配置参数

| 设置 | EEPROM 地址 | 描述 | 单位 | 默认值 |
|------|-----------|------|------|--------|
| `$0` | 步进脉冲时间 | 步进脉冲宽度 | μs | 4.0 |
| `$1` | 步进延迟 | 步进脉冲到方向延迟 | ms | 0 |
| `$2` | 步进波特率 | 串行通信波特率 | bps | 115200 |
| `$3` | 步进波特率 | 串行通信波特率 | bps | 115200 |
| `$10` | X 轴步数/毫米 | X 轴分辨率 | steps/mm | 200.0 |
| `$11` | Y 轴步数/毫米 | Y 轴分辨率 | steps/mm | 200.0 |
| `$12` | Z 轴步数/毫米 | Z 轴分辨率 | steps/mm | 2500.0 |
| `$20` | X 轴最大速度 | X 轴最高速度 | mm/min | 1000.0 |
| `$21` | Y 轴最大速度 | Y 轴最高速度 | mm/min | 1000.0 |
| `$22` | Z 轴最大速度 | Z 轴最高速度 | mm/min | 1000.0 |
| `$23` | X 轴加速度 | X 轴加速度 | mm/s² | 500.0 |
| `$24` | Y 轴加速度 | Y 轴加速度 | mm/s² | 500.0 |
| `$25` | Z 轴加速度 | Z 轴加速度 | mm/s² | 500.0 |
| `$26` | 进给速度 | 默认进给速度 | mm/min | 2500.0 |
| `$27` | 快速速度 | 默认快速移动速度 | mm/min | 5000.0 |
| `$28` | 步进空转延迟 | 步进电机禁用延迟 | ms | 25 |
| `$29` | 状态报告使能 | 状态报告格式 | bit | 10 |
| `$30` | 归位使能 | 上电归位使能 | bit | 0 |
| `$31` | 归位偏移 | 归位偏移量 | mm | 0.0 |
| `$32` | 软限位使能 | 软限位保护使能 | bit | 0 |
| `$33` | 归位方向掩码 | 归位方向掩码 | bit | 0 |
| `$34` | 归位快速速度 | 归位快速速度 | mm/min | 8000.0 |
| `$35` | 归位进给速度 | 归位慢速速度 | mm/min | 500.0 |
| `$36` | 归位延迟 | 归位触发后延迟 | ms | 250 |
| `$37` | 归位偏移 | 归位后偏移 | mm | 5.0 |

#### 系统命令接口

| 命令 | 功能 |
|------|------|
| `$` | 列出所有设置 |
| `$N` | 设置 N 的默认值 |
| `$Nx=value` | 设置 N 为 value |
| `$G` | 查看 G-code 模态状态 |
| `$I` | 查看机器 ID |
| `$C` | 加载默认配置 |
| `$X` | 解锁报警状态 |
| `$H` | 执行归位循环 |
| `$J=X...Y...Z...F...` | 手动移动 |


### 2.9 串行通信协议（Serial Protocol）

GRBL 使用 **异步串行通信**（UART）与主机通信：

#### 通信参数

| 参数 | 值 |
|------|-----|
| 波特率 | 115200 bps（默认，v0.9h 起） |
| 数据位 | 8 |
| 停止位 | 1 |
| 奇偶校验 | 无 |

#### 流控协议

GRBL 使用 **行缓冲协议**（Line-buffered Protocol）：

```
主机发送 -> [G-code 行或 $ 命令] -> CR/LF 结束
            GRBL 处理 -> 响应 "ok" 或 "error:..."
```

| 响应类型 | 格式 | 含义 |
|---------|------|------|
| `ok` | 单行 | 命令成功接收 |
| `error:` | `error: <消息>` | 命令执行错误 |
| `ALARM:` | `ALARM: <消息>` | 系统报警 |
| `<Idle>...` | 状态报告 | 当前系统状态 |
| `[MSG:...` | `[MSG: <消息>]` | 信息消息 |

#### 状态报告格式（v1.1）

```
<Idle|MPos:10.000,20.000,30.000|WPos:10.000,20.000,30.000|Bf:16,128|Ov:100,100,100|F:2500.000|Pn:---|Fs:0.0>
```

| 字段 | 含义 |
|------|------|
| `MPos` | 机床坐标位置（mm） |
| `WPos` | 工件坐标位置（mm） |
| `Bf` | 缓冲器使用情况（规划/串行） |
| `Ov` | 实时覆盖（进给/主轴/进给倍率） |
| `F` | 当前进给速度（mm/min） |
| `Pn` | 探针状态（--- 或 x/y/z） |
| `Fs` | 当前状态（0=Idle, 1=Cycle, 2=Hold） |

### 2.10 主轴与冷却控制

#### 主轴控制接口

GRBL v1.1 支持 **可变主轴速度**（Variable Spindle）：

| 模式 | 控制方式 | 引脚 |
|------|---------|------|
| PWM（默认） | 通过 PWM 控制主轴速度 | D11（S 引脚） |
| 数字（开关） | 仅启停控制 | D11（S 引脚） |
| 模拟（DAC） | 通过模拟信号控制 | 配置依赖 |

| M-code | 功能 |
|--------|------|
| M3 | 主轴正转（CW） |
| M4 | 主轴反转（CCW） |
| M5 | 主轴停止 |

#### 冷却控制接口

| M-code | 功能 |
|--------|------|
| M7 | 雾化冷却开启 |
| M8 | 水流冷却开启 |
| M9 | 冷却关闭 |

#### 激光模式

GRBL v1.1 引入 **激光模式**（Laser Mode），通过配置启用：

| 特性 | 说明 |
|------|------|
| 激光启用 | 在 config.h 中定义 `ENABLE_LASER` |
| 主轴速度控制 | 激光功率通过 S 代码控制 |
| 激光输出 | 主轴 PWM 输出控制激光功率 |
| 速度同步 | 激光速度与进给速度同步（激光模式） |

---

## 3. 功能概览

### 3.1 主要功能模块

| 模块 | 文件 | 职责 |
|------|------|------|
| G-code 解析器 | gcode.c/h | RS274/NGC G-code 解析，双遍解析 |
| 运动规划器 | planner.c/h | 前瞻规划、速度优化、梯形曲线 |
| 步进模块 | stepper.c/h | Bresenham 步进生成、AMASS 平滑 |
| 协议处理器 | protocol.c/h | 串行通信、实时命令、状态机 |
| 设置管理 | settings.c/h | EEPROM 配置存储/加载 |
| 报告系统 | report.c/h | 状态报告、错误消息 |
| 主轴控制 | spindle_control.c/h | 主轴启停、PWM 控制 |
| 冷却控制 | coolant_control.c/h | 冷却开关控制 |
| 限位系统 | limits.c/h | 硬限位、软限位、归位 |
| 探针系统 | probe.c/h | 探针检测 |
| 系统控制 | system.c/h | 系统状态管理、报警 |
| CPU 映射 | cpu_map.h | 硬件引脚映射 |
| 主循环 | main.c | 初始化、主循环、系统重置 |

### 3.2 配置参数（Settings）

#### 步进参数

| 设置 | 描述 | 范围 | 单位 |
|------|------|------|------|
| `$0` | 步进脉冲时间 | 4-500 | μs |
| `$1` | 步进到方向延迟 | 0-500 | ms |
| `$2` | 禁用步进时隙 | 0-255 | ms |

#### 轴向参数

| 设置 | 描述 | 范围 | 单位 |
|------|------|------|------|
| `$10`-`$12` | 步数/毫米 | >0 | steps/mm |
| `$20`-`$22` | 最大速度 | >0 | mm/min |
| `$23`-`$25` | 加速度 | >0 | mm/s² |

#### 系统参数

| 设置 | 描述 | 范围 | 单位 |
|------|------|------|------|
| `$26` | 默认进给速度 | >0 | mm/min |
| `$27` | 默认快速速度 | >0 | mm/min |
| `$28` | 步进空转延迟 | 0-1000 | ms |
| `$29` | 状态报告格式 | bit | bit |
| `$30` | 归位使能 | bit | bit |
| `$31` | 归位模式 | bit | bit |
| `$32` | 软限位 | bit | bit |

### 3.3 实时命令参考

| 命令 | 功能 | 时机 |
|------|------|------|
| `~` | 系统重置 | 任何状态 |
| `!` | 进给保持 | 运动中（STATE_CYCLE） |
| `?` | 状态查询 | 任何状态 |
| `$` | 设置查询 | IDLE 状态 |
| `$N` | 设置默认值 | IDLE 状态 |
| `$H` | 归位循环 | IDLE 状态 |
| `$X` | 解锁报警 | ALARM 状态 |

### 3.4 配置编译选项（config.h）

GRBL 通过 **编译时配置**（config.h）启用/禁用功能：

| 选项 | 默认 | 功能 |
|------|------|------|
| `N_AXIS` | 3 | 支持轴数（3 或 4） |
| `REPORT_REALTIME_STATUS` | 启用 | 实时状态报告 |
| `REPORT_INTERPRETER_STATE` | 启用 | G-code 解析状态 |
| `REPORT_BUFFER_STATUS` | 启用 | 缓冲器状态报告 |
| `REPORT_OVERRIDES` | 启用 | 实时覆盖报告 |
| `REPORT_BUILD_INFO` | 禁用 | 版本信息报告 |
| `REPORT_CONFIG_VALUES` | 禁用 | 编译时配置报告 |
| `ENABLE_LASER` | 禁用 | 激光模式 |
| `REPORT_SPINDLE_RPM` | 禁用 | 主轴 RPM 报告 |
| `ENABLE_PARKING_MOTION` | 禁用 | 驻车运动 |
| `ENABLE_SOFTWARE_DEBOUNCE` | 禁用 | 软件消抖 |
| `ENABLE_CONTROL_MEMORY` | 禁用 | 控制内存使能 |
| `ENABLE_SAFETY_DOOR_INPUT` | 禁用 | 安全门输入 |
| `ENABLE_PROBE_INPUT` | 启用 | 探针输入 |
| `N_LIMIT_PINS` | 3 | 限位引脚数 |
| `N_CONTROL_PINS` | 1 | 控制引脚数 |
| `CONTROL_INVERT_MASK` | 0 | 控制引脚反转掩码 |


---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| 原仓库 grbl/grbl Stars | ~6,100 |
| 原仓库 grbl/grbl Forks | ~3,200 |
| 当前仓库 gnea/grbl Stars | ~1,400 |
| 当前仓库 gnea/grbl Forks | ~1,100 |
| 最后提交 | 2019-08-25（v1.1h 发布） |
| 最新版本 | v1.1h（2019-08-25） |
| 仓库语言 | C（98%+） |
| 开源许可证 | GPL-3.0 |

#### 版本演变

| 版本 | 发布日期 | 关键特性 | 状态 |
|------|---------|---------|------|
| v0.5 | 2011 | 基础 CNC 控制器 | 已归档 |
| v0.6 | 2012 | 基础进给控制 | 已归档 |
| v0.7 | 2013 | 多轴支持 | 已归档 |
| v0.8 | 2013 | 归位功能、串行通信 | 已归档 |
| v0.9 | 2014-2016 | 稳定版（v0.9j 最终版 2016-03-17） | 稳定 |
| v1.0 | 2016 | 预览版（测试新功能） | 已弃用 |
| v1.1 | 2016-2019 | 实时覆盖、激光模式、CoreXY | 稳定（v1.1h 最终版 2019-08-25） |

### 4.2 社区规模/用户基数

#### 使用统计（LaserGRBL 遥测数据，2019-12）

基于 ~75,000 个独立安装的版本分布：

| 版本 | 安装数 | 占比 | 发布年份 |
|------|--------|------|---------|
| v1.1f | 34,485 | 45.63% | 2017 |
| v0.9j | 15,013 | 19.87% | 2016 |
| v0.9i | 9,177 | 12.14% | 2015 |
| v1.1g | 4,952 | 6.55% | 2018 |
| v1.1h | 3,598 | 4.76% | 2019 |
| v1.1e | 2,702 | 3.58% | 2016 |
| v0.8c | 2,512 | 3.32% | 2013 |
| 其他 | ~1,500 | ~2.0% | - |

#### OEM 使用数据

| 制造商 | 设备数 | 主要版本 | 备注 |
|--------|--------|---------|------|
| 某 OEM 厂商 | 10,000+ | 1.0c (~8000), 0.9g (~2000) | 自定义 PCB |
| 各类 CNC 套件 | 估计 100,000+ | 0.9j, 1.1f | 预装固件 |

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **GRBL v0.9** | 经典稳定版，仍被广泛使用 |
| **GRBL v1.1** | 最新版，实时覆盖/激光/CoreXY |
| **Grbl-Mega** | Mega2560 平台移植（社区维护） |
| **grblHAL** | 基于 HAL 架构的 GRBL 重构（grblHAL 项目） |
| **GRBL-Panel** | 跨平台 GUI（C#/.NET） |
| **Universal Gcode Sender (UGS)** | Java 跨平台 G-code 发送器 |
| **bCNC** | Python/Tkinter G-code 发送器 |
| **LaserGRBL** | 激光专用 GUI（Java） |
| **PicSender** | 激光雕刻专用软件 |
| **CNCjs** | 现代 Web-based G-code 发送器 |
| **OpenBuilds** | CNC 套件和配件 |
| **Smoothieware** | 受 GRBL 启发的现代固件 |
| **Marlin** | 受 GRBL 启发的 3D 打印固件 |

### 4.4 最新发展趋势

#### v1.1 系列发展（2016-2019）

| 时间 | 事件 |
|------|------|
| 2016-10 | v1.1 Public Beta 发布，实时覆盖功能首次出现 |
| 2016-12 | v1.1e 正式发布到 master |
| 2017-02 | v1.1f 发布 |
| 2018-10 | v1.1g 发布 |
| 2019-08 | v1.1h 发布（最终稳定版） |

#### v1.1 关键新特性

1. **实时覆盖（Real-time Overrides）** — 在运动过程中实时调整进给/主轴速度/进给倍率，毫秒级响应
2. **激光模式（Laser Mode）** — 支持激光切割/雕刻，功率随进给速度同步
3. **CoreXY 支持** — 支持 CoreXY 运动学（Delta打印机等）
4. **安全门支持** — 安全门输入和动作
5. **配置灵活性** — 更多编译时配置选项
6. **状态报告改进** — 更多信息量、更紧凑的状态报告格式

#### 当前状态（2024+）

- **官方仓库已归档** — grbl/grbl 已归档，gnea/grbl 为当前官方仓库
- **社区维护** — 核心开发活动减少，主要由社区维护
- **grblHAL 项目** — 将 GRBL 重构为 HAL 架构（类似 LinuxCNC 的 HAL），支持多平台（STM32/ESP32）
- **Grbl-Mega** — Mega2560 移植，但核心算法与 GRBL 相同
- **后继项目** — Smoothieware、Marlin、Klipper 等受 GRBL 启发的项目

### 4.5 安全评估

#### 已知安全考虑

- **无内置网络安全** — 传统设计假设控制系统为物理隔离
- **串行通信** — UART 通信无加密，假设物理安全
- **EEPROM 配置** — 敏感配置存储在 EEPROM 中，无加密保护
- **无访问控制** — 无用户认证/授权机制
- **无日志审计** — 无操作日志记录
- **实时控制风险** — 错误的 G-code 可能导致物理碰撞

#### 与 Machinekit/LinuxCNC 的安全对比

| 安全维度 | GRBL | Machinekit | AUDESYS 参考 |
|---------|------|------------|-------------|
| 网络安全 | 无 | 有（Machinetalk WebSocket） | 规划中（JSON-RPC） |
| 访问控制 | 无 | 无 | 规划中（LockLevel） |
| 配置加密 | 无（EEPROM 明文） | 无 | 规划中 |
| 物理安全 | 无（串行） | 无（Machinetalk） | 规划中 |
| 错误恢复 | 有（重置/报警） | 有（HAL 状态机） | 有（Signal/StreamChannel） |


---

## 5. 市场定位

### 5.1 主要应用行业与场景

| 行业 | 典型应用 | 推荐配置 |
|------|---------|---------|
| DIY 创客 | 3D 打印机、CNC 铣床、激光切割机 | Arduino Uno + GRBL v1.1 |
| 小型制造 | 桌面 CNC 加工、 PCB 铣床 | Arduino Uno + GRBL v1.1 |
| 激光雕刻 | 激光切割/雕刻机 | Arduino Uno + GRBL v1.1（激光模式） |
| 教育培训 | CNC/嵌入式系统教学 | Arduino Uno + GRBL v0.9 |
| 原型开发 | 快速 CNC 原型验证 | Arduino Uno + GRBL v1.1 |
| OEM 套件 | 预装 CNC 套件、激光套件 | Arduino Uno + GRBL 定制固件 |
| 机器人 | Delta 机器人、CoreXY 打印机 | Arduino Uno + GRBL v1.1（CoreXY） |

### 5.2 竞争对手对比

| 维度 | GRBL | Marlin | Klipper | LinuxCNC | Machinekit | Smoothieware |
|------|------|--------|---------|----------|------------|-------------|
| 目标平台 | AVR 8-bit（328p） | AVR/ARM | ARM + Linux + MCU | x86 为主 | ARM + x86 | ARM Cortex-M |
| 内存占用 | ~32KB Flash | ~128KB+ | ~1MB+ | 数百 MB | 数十 MB | ~1MB |
| 实时性 | 硬实时（中断） | 硬实时（中断） | Linux + MCU 分离 | RT-PREEMPT | RT-PREEMPT/Xenomai | RTOS（ChibiOS） |
| 步进精度 | 30kHz（Bresenham） | ~30kHz（DDA） | 25μs（MCU） | ~1kHz（HAL） | ~1kHz（HAL） | ~20kHz |
| 轴数 | 3-4 轴 | 3-6+ 轴 | 6+ 轴 | 9 轴（理论） | 9 轴（理论） | 3-6+ 轴 |
| 运动学 | 直角/圆弧 | 直角/圆弧/Delta | 直角/圆弧/Delta/SCARA | 直角/圆弧/五轴 | 直角/圆弧/五轴 | 直角/圆弧/Delta |
| 闭环支持 | 无（开环） | 有限 | 无（开环） | 有（PID + 编码器） | 有（PID + 编码器） | 有 |
| 配置方式 | EEPROM（$命令） | config.h + EEPROM | printer.cfg | HAL 脚本 | HAL 脚本 | config.ini |
| 学习成本 | 极低 | 低 | 中 | 高 | 高 | 低 |
| 社区活跃度 | 低（已归档） | 极高 | 极高 | 中等 | 极低 | 中等 |
| 许可证 | GPL-3.0 | GPL-3.0 | GPL-3.0 | GPL-2.0 | GPL-2.0 | GPL-3.0 |
| 成本 | ~$25（Arduino） | ~$25（Arduino） | ~$200+（Pi + MCU） | ~$200+（PC） | ~$200+（BeagleBone） | ~$25（STM32） |

### 5.3 与其他嵌入式固件详细对比

#### GRBL vs Marlin

| 维度 | GRBL | Marlin |
|------|------|--------|
| 主要用途 | CNC 铣床/激光 | 3D 打印机 |
| 算法 | Bresenham | DDA |
| 温度控制 | 无 | 有（PID 加热床/热端） |
| 3D 打印特性 | 无 | 有（回抽、挤出、分层） |
| 硬件抽象 | CPU 映射 | 引脚映射 + 板定义 |
| 配置方式 | EEPROM + config.h | config.h + 菜单 |
| 扩展性 | 有限 | 高（LCD/SD/触摸） |

#### GRBL vs Klipper

| 维度 | GRBL | Klipper |
|------|------|---------|
| 架构 | 单一 MCU | Linux 主机 + 独立 MCU |
| 计算资源 | 32KB Flash / 2KB RAM | 主机: 数百 MB / MCU: 8KB+ |
| 步进精度 | 30kHz（Bresenham） | 25μs（MCU） |
| 输入整形 | 无 | 有（Input Shaping） |
| 多轴同步 | 3-4 轴 | 6+ 轴 |
| 学习曲线 | 极低 | 中 |
| 扩展性 | 有限（EEPROM） | 高（Python 插件） |
| 硬件要求 | Arduino Uno（$25） | Pi + MCU（$200+） |

### 5.4 成本分析

#### GRBL 典型硬件成本

| 组件 | 价格 | 备注 |
|------|------|------|
| Arduino Uno | $25-35 | 官方或兼容板 |
| 步进电机驱动板 | $20-50 | A4988/TMC2208 等 |
| 步进电机 | $30-80/个 | 42 或 57 步进电机 |
| 限位开关 | $5-10/个 | 机械或光学 |
| 主轴/激光 | $100-500 | 取决于应用 |
| **总计（3 轴）** | **$200-500** | 入门级 CNC 系统 |

#### 与 Machinekit/LinuxCNC 的成本对比

| 平台 | 硬件成本 | 学习成本 | 适用场景 |
|------|---------|---------|---------|
| GRBL | $200-500 | 极低 | 桌面 CNC/激光 |
| Marlin | $200-500 | 低 | 3D 打印 |
| Klipper | $400-800 | 中 | 高端 3D 打印/CNC |
| Machinekit | $400-1000 | 高 | 嵌入式 CNC |
| LinuxCNC | $500-2000+ | 高 | 工业 CNC |

### 5.5 商业应用案例

GRBL 已被大量 OEM 厂商预装在 CNC 套件中：

| 制造商/套件 | 应用 | 使用版本 |
|-----------|------|---------|
| 各类桌面 CNC 套件 | 3 轴 CNC 铣床 | v0.9j, v1.1f |
| 激光切割机套件 | 桌面激光切割 | v1.1（激光模式） |
| 3D 打印机套件 | CoreXY/Delta 3D 打印 | v1.1（CoreXY） |
| PCB 铣床套件 | PCB 铣削 | v0.9j |
| 某 OEM 厂商（10,000+ 设备） | 定制化 PCB | v1.0c（定制固件） |


---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **极致资源利用** — 在 ATmega328p（32KB Flash、2KB RAM）上实现完整的 3 轴 CNC 控制器
   - 总代码量 < 32KB，充分利用 MCU 资源
   - 中断驱动的硬实时控制，无需 RTOS
   - 极简的内存模型，无堆栈溢出风险

2. **Bresenham 算法** — 使用整数算术实现精确的多轴同步，无浮点误差
   - 相比 DDA 算法（Marlin 使用），Bresenham 在 8 位 MCU 上效率更高
   - AMASS 自适应平滑解决了 Bresenham 的低频多轴锯齿问题

3. **零配置部署** — 烧录固件即可运行，无需任何配置文件
   - EEPROM 存储所有运行时配置，修改参数无需重新烧录
   - 串行 `$` 命令即可配置所有参数

4. **实时覆盖** — v1.1 引入的毫秒级实时参数调整
   - 在运动过程中实时调整进给/主轴速度
   - 相比传统方案（需要等待当前运动完成），响应速度快数个数量级

5. **极简 G-code 实现** — 支持最常用的 G-code 子集
   - 双遍解析设计，代码紧凑且高效
   - 模态组设计符合 RS274/NGC 标准

6. **开放生态** — 大量第三方 GUI 工具和硬件扩展
   - UGS、CNCjs、bCNC 等跨平台 GUI
   - LaserGRBL、PicSender 等专业激光工具

### 6.2 标志性功能或设计理念

#### "30kHz 无抖动步进脉冲"

GRBL 在 ATmega328p 上实现了 **30kHz 稳定无抖动的步进脉冲**，这是其核心性能指标：

| 参数 | 值 |
|------|-----|
| 步进频率上限 | 30,000 Hz |
| ISR 执行时间 | ~5μs（典型）、~25μs（最大） |
| ISR 周期 | 33.3μs @ 30kHz |
| 步进脉冲宽度 | 4μs（默认，可调） |

#### "Bresenham 胜过 DDA"

GRBL 选择 Bresenham 直线算法而非 DDA（数字微分分析器）是基于 8 位 MCU 的实际情况：

| 算法 | 优势 | 劣势 | GRBL 选择原因 |
|------|------|------|-------------|
| **Bresenham** | 整数运算、精确、低开销 | 多轴低频锯齿 | 8 位 MCU 无硬件浮点单元 |
| **DDA** | 平滑、无锯齿 | 需要浮点运算、资源消耗大 | ATmega328p 无 FPU |

AMASS 算法弥补了 Bresenham 在低频时的不足，使 GRBL 在保持低开销的同时实现了平滑运动。

#### "中断即一切"

GRBL 的整个实时控制基于中断，主循环仅处理协议和初始化：

| 组件 | 执行方式 | 实时要求 |
|------|---------|---------|
| 步进脉冲生成 | Timer1 COMPA 中断 | 硬实时（33.3μs @ 30kHz） |
| 步进脉冲下降沿 | Timer0 OVF 中断 | 硬实时（~5μs） |
| 串行数据接收 | Serial RX 中断 | 中实时（115200 bps） |
| 控制引脚输入 | Pin Change 中断 | 高实时（立即响应） |
| 运动规划 | 主循环 | 软实时 |
| G-code 解析 | 主循环 | 非实时 |

#### "命令解释与执行分离"

GRBL 的架构分离了命令解释（主循环）与运动执行（中断）：

```
G-code 行 → 解析器 → 规划缓冲 → 段缓冲 → 步进 ISR（中断）
    ^                              |
    |                              v
主循环（非实时）              中断（硬实时）
```

这种分离使 GRBL 能够：
- 在运动规划时不影响步进脉冲的精确性
- 在 G-code 解析出错时不影响正在执行的运动
- 实时命令可在运动中随时响应

### 6.3 创新设计哲学

#### "在 32KB 中实现 CNC 控制器"

GRBL 的设计哲学是 **"在极度受限的资源下实现可用的 CNC 控制"**：

```
32KB Flash 总空间
|
+-- 约 30KB：核心代码（解析器/规划器/步进/协议）
|   |-- gcode.c：约 5KB
|   |-- planner.c：约 4KB
|   |-- stepper.c：约 5KB
|   |-- protocol.c：约 4KB
|   |-- settings.c：约 2KB
|   |-- main.c：约 1KB
|   |-- 其他（spindle/limits/report）：约 9KB
|
+-- 约 2KB：启动代码、中断向量、EEPROM 配置
```

#### "中断优先的实时模型"

GRBL 的实时模型完全基于优先级中断：

```
优先级：Reset > Safety Door > Feed Hold > Cycle Start > 步进 ISR
```

- 所有高优先级命令通过 volatile 标志位传递
- 主循环周期性检查标志位并执行
- 步进 ISR 不受主循环状态影响

#### "EEPROM 即配置"

GRBL 将所有运行时配置存储在 EEPROM 中，无需重新烧录：

- 设置持久化（断电保持）
- 通过串行 `$` 命令修改
- 支持默认配置恢复（`$C`）
- 支持设置备份/恢复


---

## 7. 对 AUDESYS 的参考价值

### 7.1 可借鉴的架构设计/理念

#### 1. 中断驱动的实时控制模型

GRBL 的 **中断驱动模型** 是资源受限嵌入式实时控制的典范：

```
主循环（协议/解析）  ←→  中断（步进脉冲生成）
     非实时                     硬实时
```

**AUDESYS 参考**:
- AUDESYS HAL 的 **RT 数据面**（< 1μs）可参考 GRBL 的纯中断驱动模式
- 资源受限场景（如嵌入式 MCU 运行 HAL 组件）可借鉴 GRBL 的内存最小化设计
- AUDESYS 的 **AMW 抽象层** 在 MCU 上可提供类似 GRBL 的中断调度接口

#### 2. Bresenham 步进算法

GRBL 选择 Bresenham 而非 DDA 的决定基于硬件约束，对 AUDESYS 的步进控制有参考意义：

| 场景 | 算法选择 | 原因 |
|------|---------|------|
| 8 位 MCU（无 FPU） | Bresenham | 整数运算，低开销 |
| 32 位 MCU（有 FPU） | DDA | 浮点运算，平滑性更好 |
| 资源不受限 | DDA + 前馈 | 最高精度和平滑性 |

**AUDESYS 参考**: AUDESYS HAL 组件库可提供多种步进算法选项，根据目标平台自动选择最优算法。

#### 3. 运动规划与执行分离

GRBL 的 **规划缓冲 + 段缓冲** 两层缓冲设计：

```
G-code 行 → 解析器 → 规划缓冲（16 blocks）→ 段缓冲 → 步进 ISR
```

- 规划缓冲（Planner Buffer）：存储多个运动块，允许前瞻优化
- 段缓冲（Segment Buffer）：将运动块分解为等速段，供步进 ISR 执行

**AUDESYS 参考**:
- AUDESYS **StreamChannel** 原语可参考此分层缓冲模型
- RT 数据面（步进执行）与 I/O 通信面（规划）分离，降低实时要求
- AUDESYS **amw** 的 **HalTransport** 抽象层可参考 GRBL 的 **步进模块** 设计

#### 4. 极简配置存储（EEPROM）

GRBL 使用 **EEPROM** 存储配置，通过串行 `$` 命令修改：

**AUDESYS 参考**:
- AUDESYS HAL 组件的 **静态配置** 可参考 GRBL 的 EEPROM 模型
- 组件参数通过 HalConfig 接口持久化
- 运行时配置修改无需重新编译/烧录

#### 5. 实时命令系统

GRBL 的 **实时命令** 通过 volatile 标志位传递，任何状态可随时响应：

**AUDESYS 参考**:
- AUDESYS **RPC** 原语可参考 GRBL 的实时命令系统
- 控制命令（如重置/停止）可设计为低延迟通道
- 状态查询通过 **Signal** 原语实现

### 7.2 可移植/适配的技术模块

| 技术模块 | 描述 | 移植价值 |
|---------|------|---------|
| **G-code 解析器** | 双遍解析、模态组实现 | 高，AUDESYS 可集成 G-code 解析器作为 HAL 组件 |
| **运动规划器** | 前瞻规划、梯形曲线、速度优化 | 高，AUDESYS StreamChannel 可集成此规划器 |
| **Bresenham 步进** | 整数运算、多轴同步 | 中，AUDESYS HAL 组件库可包含此算法 |
| **AMASS 平滑** | 自适应多轴平滑算法 | 中，低频步进平滑的参考实现 |
| **CPU 映射系统** | 硬件无关的引脚映射 | 高，AUDESYS HAL 驱动可参考此模式 |
| **EEPROM 配置** | 掉电保持的配置存储 | 中，AUDESYS 组件配置的持久化参考 |
| **实时命令** | volatile 标志位的实时命令系统 | 中，AUDESYS RPC 控制命令参考 |
| **串行协议** | 行缓冲的串行通信协议 | 低，AUDESYS 有 JSON-RPC 协议 |

### 7.3 与 AUDESYS 定位的差异与互补

| 维度 | GRBL | AUDESYS |
|------|------|---------|
| 核心定位 | 嵌入式 CNC 控制器 | 工业控制系统模拟平台 |
| 目标平台 | 8 位 AVR MCU（32KB Flash） | 多平台（Linux/MCU/FPGA） |
| 实时性 | 硬实时（中断，30kHz） | 硬实时（amw，<1μs）+ 软实时（I/O，~10μs） |
| 运动控制 | 3-4 轴（直角/圆弧/CoreXY） | 规划中：多轴（HAL 组件） |
| 通信协议 | 串行 UART（115200 bps） | JSON-RPC/REST + HAL 原语 |
| 闭环支持 | 无（开环步进） | 有（HAL 编码器/PID 组件） |
| 可编程性 | EEPROM 设置 + config.h | HAL 组件可编程 + Studio IDE |
| 安全机制 | 无（物理隔离假设） | LockLevel + Config Barrier |

**互补关系**：

- GRBL 的 **极简设计** 为 AUDESYS 提供了 **"轻量级嵌入式控制器"** 的参考模式
- AUDESYS 的 **HAL 抽象层** 可封装 GRBL 的运动规划算法为 HAL 组件
- GRBL 的 **Bresenham + AMASS** 算法可作为 AUDESYS HAL 组件库的参考实现
- AUDESYS 的 **Simulator** 功能可包含 GRBL 式的 CNC 场景仿真

### 7.4 详细对比分析：AUDESYS HAL 与 GRBL 运动控制

| 维度 | GRBL 运动控制 | AUDESYS HAL（设计） |
|------|-------------|-------------------|
| 控制模型 | 中断驱动（ISR） | 分层调度（RT/I/O/控制面） |
| 步进算法 | Bresenham + AMASS | 待实现（组件化） |
| 规划缓冲 | 16 blocks 环缓冲 | StreamChannel 缓冲 |
| 速度优化 | 两遍重计算（Reverse + Forward） | 待实现 |
| 运动学 | 直角/圆弧/CoreXY | 组件化（Kinematics 组件） |
| 轴数 | 3-4 轴 | 不限（组件化扩展） |
| 轴抽象 | 硬编码 X/Y/Z | HAL 组件化（多轴实例） |
| 配置方式 | EEPROM + $ 命令 | HalConfig（FlatBuffers） |
| 实时精度 | 30kHz（Bresenham） | < 1μs（RT 数据面） |
| 扩展性 | 低（EEPROM 限制） | 高（HAL 组件系统） |

### 7.5 嵌入式实时控制设计启示

GRBL 在 **极度受限的资源**（32KB Flash、2KB RAM）下实现实时控制的经验对 AUDESYS 具有直接参考价值：

#### 最小化内存占用

```c
// GRBL 的内存模型
// 全局变量：< 2KB RAM
// 主循环变量：< 1KB
// ISR 变量：< 1KB
// 无堆分配，无 malloc/free
```

**AUDESYS 参考**:
- AUDESYS HAL 组件在 MCU 上运行时，应优先使用静态内存分配
- 避免动态内存分配，减少堆碎片和栈溢出风险
- 组件配置使用 **HalConfig** 接口而非运行时堆分配

#### 中断优先级模型

```c
// GRBL 中断优先级
// 1. Timer1 COMPA（步进 ISR）- 最高
// 2. Timer0 OVF（步进下降沿）- 高
// 3. Serial RX - 中
// 4. Pin Change - 中
```

**AUDESYS 参考**:
- AUDESYS 的 **RT 线程** 在 MCU 上应使用最高优先级中断
- I/O 通信线程使用中等优先级
- 控制面操作使用低优先级或主循环

#### 确定性执行时间

| 组件 | 执行时间（GRBL） | AUDESYS 对应 |
|------|----------------|------------|
| 步进 ISR | ~5-25μs | < 1μs（RT 数据面） |
| 规划计算 | 主循环，无时间要求 | ~10μs（I/O 通信面） |
| G-code 解析 | 主循环，无时间要求 | ~100μs（控制面） |
| 状态报告 | 主循环，无时间要求 | ~100μs（控制面） |

### 7.6 对 AUDESYS HAL 设计的特定参考点

1. **步进组件设计** — GRBL 的 Bresenham + AMASS 可作为 AUDESYS HAL 步进组件的参考实现
2. **规划组件设计** — GRBL 的两遍重计算算法可作为 AUDESYS HAL 运动规划组件的参考
3. **CPU 映射模式** — GRBL 的 cpu_map.h 模式可作为 AUDESYS HAL 驱动平台适配的参考
4. **EEPROM 配置** — GRBL 的配置存储模式可作为 AUDESYS HAL 组件配置持久化的参考
5. **实时命令模式** — GRBL 的 volatile 标志位模式可作为 AUDESYS HAL 实时控制的参考
6. **G-code 解析器** — GRBL 的解析器可作为 AUDESYS HAL 的 G-code 组件参考实现

### 7.7 GRBL 项目的教训与 AUDESYS 启示

| GRBL 的教训 | 对 AUDESYS 的启示 |
|-----------|----------------|
| **开发停滞**（2019 年后无新版本） | 避免单一维护者依赖，建立社区贡献机制 |
| **EEPROM 限制**（仅 $ 命令配置） | AUDESYS HAL 配置更丰富（FlatBuffers + HalConfig） |
| **无网络安全**（物理隔离假设） | AUDESYS 从设计之初考虑网络安全（Security Domain） |
| **无闭环支持**（开环步进） | AUDESYS HAL 支持编码器/PID 闭环组件 |
| **无远程架构**（仅串行） | AUDESYS 有 JSON-RPC + HalTransport 远程架构 |
| **配置灵活性有限** | AUDESYS HAL 组件可动态创建/配置（instcomp 模式） |

---

> **本文档基于 2026 年 7 月的公开信息编写。GRBL 官方仓库已归档（grbl/grbl），gnea/grbl 为当前官方仓库，最新版本 v1.1h（2019-08-25）。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从 GitHub 仓库验证。**