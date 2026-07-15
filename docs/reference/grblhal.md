# grblHAL

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: grblHAL（grbl Hardware Abstraction Layer，grbl 硬件抽象层）
- **开发商/组织**: 由 **Terje Io**（io-engineering）于 2018 年创建并持续维护的开源项目
- **首次发布年份**: 2018 年（2018-2019 年进入活跃开发阶段）
- **当前版本**: 核心代码持续迭代，Driver 版本以 `YYMMDD` 格式标记，如 `driver_version = "250419"`（2025 年 4 月 19 日）
- **仓库地址**:
  - 核心代码（Core）: https://github.com/grblHAL/core
  - 硬件驱动仓库（Drivers）: https://github.com/grblHAL/drivers
  - 插件仓库（Plugins）: https://github.com/grblHAL/plugins
  - ESP32 驱动: https://github.com/grblHAL/ESP32
  - 项目官方网站: https://www.grbl.org
  - Web Builder 在线构建工具: http://svn.io-engineering.com:8080

### 1.2 产品定位与核心价值主张

grblHAL 定位为 **无妥协（no-compromise）、高性能、低成本的 CNC 运动控制器固件**，是经典 [grbl](https://github.com/gnea/grbl)（Arduino 版本）的现代化移植和大幅增强版本。其核心价值主张是：

1. **硬件抽象层（HAL）驱动架构** — 核心固件代码与硬件驱动完全解耦，同一份核心代码可运行于 15+ 种不同处理器平台上，通过实现 HAL 接口即可扩展新硬件支持
2. **极高的运动控制性能** — 在 ARM Cortex-M 系列等 32 位处理器上实现最高 300 kHz 稳定、无抖动的步进脉冲输出，远超 grbl（Arduino 版本 ~30 kHz）
3. **零侵入式插件扩展** — 用户编写的插件（Plugin）可以在不修改核心源代码的情况下增加新功能，包括新的 M 代码、额外输出、ATC 系统、Web UI 等
4. **完整的 G-Code 兼容** — 支持 grbl 1.1f 规范的全部 G-Code，同时扩展了宏函数、变量、自动换刀（ATC）等功能

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| CNC 创客/爱好者 | DIY CNC 铣床、雕刻机、激光切割机的控制器固件 | 低成本硬件（ESP32、STM32、RP2040）、易部署、丰富功能 |
| 3D 打印开发者 | CoreXY 打印机、Delta 机器人控制 | 高性能多轴控制、运动规划 |
| 小型制造商 | 生产级 CNC 铣床的替代控制器 | 可靠的多轴控制、自动换刀、G-Code 兼容性 |
| 机器人开发者 | 墙绘机器人、极坐标机器人 | 多运动学模型支持（CoreXY、Polar、Wall Plotter） |
| 教育工作者 | CNC 教学、运动控制研究 | 开源、可定制、多平台支持 |
| 工业设备集成商 | 定制化 CNC 控制器开发 | 硬件抽象、插件机制、多平台部署 |

### 1.4 许可证模型

- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **商业模型**: 完全开源，无商业限制
- **封闭组件**: 无 — 核心固件、所有驱动、所有插件均为开源
- **OEM 考虑**: GPL-3.0 要求衍生作品同样开源，商用嵌入式场景需注意许可证合规性

---

## 2. 技术特性

### 2.1 核心架构

grblHAL 采用 **核心-驱动分离（Core-Driver Separation）** 架构，通过硬件抽象层（HAL）实现核心固件与硬件平台之间的完全解耦。

```
+------------------------------------------------------------------+
|                      grblHAL Core                                |
|                                                                  |
|  +-------------------+  +------------------+  +---------------+  |
|  |   G-Code Parser   |  |  Motion Planner  |  | Tool Change   |  |
|  |   (gcode.c)       |  |  (planner.c)     |  | (tool_change.c)|  |
|  +-------------------+  +------------------+  +---------------+  |
|  +-------------------+  +------------------+  +---------------+  |
|  |  Protocol Handler |  |  Task Manager    |  | Kinematics    |  |
|  |  (protocol.c)     |  |  (task.c)        |  | (kinematics.c)|  |
|  +-------------------+  +------------------+  +---------------+  |
|                                                                  |
|  +-------------------+  +------------------+  +---------------+  |
|  |  Plugin Framework |  |  System Settings |  | Spindle Control|  |
|  |  (plugin API)     |  |  (settings.c)    |  | (spindle.c)   |  |
|  +-------------------+  +------------------+  +---------------+  |
|                                                                  |
|                          HAL Interface (hal_t)                    |
|  +--------------------------------------------------------------+  |
|  | stepper | limits | control | coolant | spindle | probe | port |  |
|  | stream  | timer  | nvs     | tool    | rgb     | periph | ... |  |
|  +--------------------------------------------------------------+  |
+------------------------------------------------------------------+
|                     Hardware Driver (Platform-Specific)           |
|  ESP32 / STM32F7xx / STM32H7xx / RP2040 / iMXRT1062 / ...        |
+------------------------------------------------------------------+
```

**核心组件**：

- **grbl_t（grbl）** — 核心事件处理结构体，包含大量函数指针（回调），用于事件分发
- **system_t（sys）** — 系统状态结构体，包含位置、状态标志、运行时标志
- **hal_t（hal）** — 硬件抽象层结构体，包含所有硬件相关的函数指针

### 2.2 硬件抽象层（HAL）设计

HAL 是 grblHAL 最核心的架构创新。它定义了一个完整的 `hal_t` 结构体（位于 `hal.h`），包含所有核心固件需要访问硬件的功能指针（Function Pointer）。驱动开发者只需实现这些函数指针，即可将 grblHAL 部署到新的硬件平台上。

**核心结构体定义（`hal.h`）**：

```c
typedef struct {
    uint32_t version;              // HAL 版本
    char *info;                    // 驱动/平台信息字符串
    char *driver_version;          // 驱动版本日期字符串（YYMMDD 格式）
    char *board;                   // 可选的板卡名称
    uint32_t f_step_timer;         // 主步进定时器频率（Hz）
    uint32_t f_mcu;                // MCU 主频（MHz）
    uint32_t rx_buffer_size;       // 输入流缓冲区大小（字节）

    // 驱动初始化
    driver_setup_ptr driver_setup; // 驱动设置函数

    // 核心子系统处理函数
    limits_ptrs_t limits;          // 限位开关处理函数
    homing_ptrs_t homing;          // 回零处理函数
    control_signals_ptrs_t control;// 控制信号处理函数
    coolant_ptrs_t coolant;        // 冷却液控制函数
    spindle_data_ptrs_t spindle_data;// 主轴数据处理函数
    stepper_ptrs_t stepper;        // 步进电机控制函数
    io_stream_t stream;            // 流 I/O 处理函数
    io_port_t port;                // I/O 端口处理函数

    // 工具函数
    void (*delay_ms)(uint32_t ms, delay_callback_ptr callback);
    void (*set_bits_atomic)(volatile uint_fast16_t *value, uint_fast16_t bits);
    uint_fast16_t (*clear_bits_atomic)(volatile uint_fast16_t *value, uint_fast16_t v);

    // 可选组件
    probe_ptrs_t probe;            // 探针输入处理（可选）
    tool_ptrs_t tool;              // 换刀处理（可选）
    timer_ptrs_t timer;            // 定时器处理（可选）
    nvs_io_t nvs;                  // 非易失性存储（可选）
    // ... 更多可选功能指针
} hal_t;
```

**步进电机子系统接口（`stepper_ptrs_t`）**：

```c
typedef struct {
    stepper_wake_up_ptr wake_up;                    // 启用电机和步进中断
    stepper_go_idle_ptr go_idle;                    // 禁用步进中断
    stepper_enable_ptr enable;                      // 启用/禁用步进电机
    stepper_cycles_per_tick_ptr cycles_per_tick;    // 设置步进脉冲时序
    stepper_pulse_start_ptr pulse_start;            // 输出步进脉冲
    stepper_interrupt_callback_ptr interrupt_callback; // 下一步回调
    stepper_get_ganged_ptr get_ganged;              // 获取捆绑轴
    stepper_claim_motor_ptr claim_motor;            // 声明电机
    stepper_output_step_ptr output_step;            // 输出单步
    stepper_status_ptr status;                      // 获取/重置步进状态
} stepper_ptrs_t;
```

**驱动能力声明（`driver_cap_t`）**：

```c
typedef union {
    uint32_t value;
    struct {
        uint32_t software_debounce         :1,  // 支持软件消抖
                 step_pulse_delay          :1,  // 支持步进脉冲延迟
                 limits_pull_up            :1,  // 限位输入支持上拉电阻
                 control_pull_up           :1,  // 控制输入支持上拉电阻
                 probe_pull_up             :1,  // 探针输入支持上拉电阻
                 spindle_encoder           :1,  // 支持主轴编码器
                 spindle_sync              :1,  // 支持主轴同步运动
                 sd_card                   :1,  // 支持 SD 卡
                 bluetooth                 :1,  // 支持蓝牙
                 wifi                      :1,  // 支持 Wi-Fi
                 spindle_pid               :1,  // 支持主轴 PID 控制
                 mpg_mode                  :1,  // 支持手轮模式
                 laser_ppi_mode            :1,  // 支持激光 PPI 模式
                 atc                       :1,  // 支持自动换刀
                 odometers                 :1,  // 支持里程计
                 pwm_spindle               :1,  // 支持 PWM 主轴
                 probe_latch               :1,  // 支持探针锁存
    };
} driver_cap_t;
```

**驱动初始化示例（ESP32 驱动 `driver.c`）**：

```c
bool driver_init(void) {
    serialInit();

    hal.info = "ESP32";
    hal.driver_version = "210423";
    hal.driver_setup = driver_setup;
    hal.f_step_timer = rtc_clk_apb_freq_get() / STEPPER_DRIVER_PRESCALER;
    hal.delay_ms = driver_delay_ms;
    hal.settings_changed = settings_changed;

    hal.stepper.wake_up = stepperWakeUp;
    hal.stepper.go_idle = stepperGoIdle;
    hal.stepper.enable = stepperEnable;
    hal.stepper.cycles_per_tick = stepperCyclesPerTick;
    hal.stepper.pulse_start = stepperPulseStart;

    hal.limits.enable = limitsEnable;
    hal.limits.get_state = limitsGetState;
    hal.coolant.set_state = coolantSetState;
    hal.spindle.set_state = spindleSetState;

    hal.driver_cap.software_debounce = On;
    hal.driver_cap.step_pulse_delay = On;
    hal.driver_cap.spindle_encoder = On;
    hal.driver_cap.wifi = On;

    return true;
}
```

**HAL 的初始化流程**：

1. `driver_init()` — 驱动初始化，设置 `hal_t` 结构体的所有函数指针
2. `grbl_enter()` — 核心入口函数，初始化系统状态
3. 核心从 NVS（非易失性存储）加载设置
4. 调用 `hal.driver_setup(settings)` — 驱动配置 MCU 外设
5. 核心进入主循环，所有硬件访问都通过 HAL 函数指针

### 2.3 系统架构详解

**关键数据结构**：

- **`system_t sys`** — 系统状态，包含当前位置、状态标志、运行时标志
- **`grbl_t grbl`** — 核心事件处理，包含大量事件回调函数指针
- **`hal_t hal`** — 硬件抽象层，所有硬件访问的入口

**任务管理系统**：

grblHAL 实现了前景/后台任务调度系统：
- **实时任务（Realtime）** — 在最高优先级中断中执行，处理步进脉冲、限位检测等
- **前景任务（Foreground）** — 在协议处理线程中执行，处理 G-Code 解析、状态报告等
- **延迟任务（Delayed Tasks）** — 通过 `task_add_delayed()` 注册，在下次 tick 时执行

**事件驱动架构**：

grblHAL 采用事件驱动的架构，核心组件通过回调函数（Callback）进行交互。`grbl_t` 结构体包含大量事件处理器函数指针，可扩展性极强：

```c
typedef struct {
    on_execute_realtime_ptr on_execute_realtime;  // 实时事件执行
    on_report_options_ptr on_report_options;       // 状态报告
    on_probe_toolsetter_ptr on_probe_toolsetter;   // 工具校准探针
    on_toolchange_ack_ptr on_toolchange_ack;       // 换刀确认
    on_homing_completed_ptr on_homing_completed;   // 回零完成
} grbl_t;
```

### 2.4 支持的硬件平台

grblHAL 目前支持超过 15 种不同的处理器/处理器系列，所有平台共享同一份核心代码：

| 处理器 | 开发板 | MCU 主频 | FPU | 轴数 | 编译器/IDE | 特色功能 |
|--------|--------|---------|-----|------|-----------|---------|
| i.MXRT1062 | Teensy 4.x | 600 MHz | yes | 最多 5 轴 | Arduino IDE | 最高性能，NVS 闪存 |
| STM32F7xx | Nucleo-F756ZG | 216 MHz | yes | 最多 8 轴 | STMCubeIDE | 多轴、WebUI |
| STM32H7xx | Nucleo-H743ZI | 450 MHz | yes | 最多 8 轴 | STMCubeIDE | 高速、多轴 |
| ESP32 | ESP32 开发板 | 2×240 MHz | yes | 3 轴 | ESP IDF | Wi-Fi、FreeRTOS、I2C |
| RP2040 | Pi Pico | 125 MHz | no | 最多 6 轴 | VS Code | 低成本、多轴 |
| RP2350 | Pi Pico2 | 150 MHz | yes | 最多 6 轴 | VS Code | 新架构、多轴 |
| MSP432E401Y | LaunchPad | 150 MHz | yes | 最多 6 轴 | CCS | 低功耗 |
| TM4C1294 | LaunchPad | 120 MHz | yes | 最多 6 轴 | CCS | 工业级 |
| STM32F4xx | Blackpill | 84/100/180 MHz | yes | 最多 6 轴 | STMCubeIDE | 主流选择 |
| STM32F3xx | BlackPill | 72 MHz | no | 最多 6 轴 | STMCubeIDE | 低成本 |

**ESP32 驱动特色**：
- 支持 Wi-Fi 和蓝牙（ESP-IDF）
- 可作为 FreeRTOS 任务运行
- 支持 I2C 键盘和 I2C I/O 扩展器
- 支持 ESP3D-WEBUI（Web UI）
- 支持 RMT（Remote Control Peripheral）输出步进脉冲
- 支持 I2S 音频输出作为步进信号源

**构建方式**：
- **本地构建**：各驱动有自己的构建系统（ESP-IDF、STM32CubeIDE、VS Code 等）
- **Docker 构建**：`docker run -it --rm -v $(pwd):/grbl espressif/idf:release-v4.3 idf.py build`
- **Web Builder**：在线 Web 构建工具（http://svn.io-engineering.com:8080），无需安装工具链

### 2.5 运动控制系统

**运动规划器（Motion Planner）**：
- 支持 **前瞻（Look Ahead）** 加速管理，控制器会前瞻未来的运动并规划速度曲线，实现平滑加速和无冲击拐角（jerk-free cornering）
- 最高步进脉冲频率：300 kHz（稳定、无抖动）
- 支持直线插补（G0/G1）、圆弧插补（G2/G3）、螺旋插补（G2/G3 带 Z 轴运动）
- 支持精确停止模式（G61）和连续运动模式

**前瞻加速管理**：

grblHAL 的运动规划器在运动队列中前瞻优化速度曲线。当规划器检测到运动方向变化时，会自动减速以最小化拐角冲击；在直线段中则加速到最大允许速度。

**多轴控制**：
- 支持最多 8 轴（取决于驱动实现）
- 支持捆绑轴（Ganged Axes）—— 多个电机驱动同一轴
- 支持自动回零（Auto Squaring）—— 捆绑轴自动对齐
- 支持 ABC 轴映射（可映射到 UVW 车床模式）

### 2.6 运动学（Kinematics）子系统

grblHAL 支持多种运动学模型，适用于非笛卡尔坐标系机器：

**支持的 Kinematics 模型**：

| 模型 | 适用机器 | 变换机制 |
|------|---------|---------|
| CoreXY | CoreXY 结构打印机/铣床 | 双电机协同控制 X/Y 运动 |
| Wall Plotter | 墙绘机器人（V-plotter） | 两条皮带/绳的三角关系变换 |
| Polar Robot | 极坐标机器人 | 半径和角度坐标（R, θ） |
| Cartesian | 标准笛卡尔坐标 CNC | 1:1 映射（默认） |

**Kinematics API**：

```c
// 核心变换函数
void transform_from_cartesian(float *cartesian, float *motor);  // XYZ -> 电机坐标
void transform_steps_to_cartesian(int32_t *steps, float *xyz);  // 电机步进 -> XYZ
bool segment_line(float *target, float *position, float *segment); // 长线段分割
```

**线分割（Line Segmentation）**：
对于非线性的运动学模型（CoreXY、Wall Plotter、Polar），Cartesian 空间的直线在电机空间中会变为曲线。grblHAL 通过 `segment_line()` 函数将长线段分割为小段，确保精度。

### 2.7 G-Code 支持

grblHAL 支持完整的 rs274/ngc（G-Code）标准，并经多个 CAM 工具验证兼容：

**支持的 G-Code**：

| 类别 | 命令 |
|------|------|
| 非模态命令 | G4, G10L2, G10L20, G28, G30, G53, G92, G92.1 |
| 运动模式 | G0, G1, G2, G3, G5, G5.1, G38.2-G38.5, G80, G33 |
| 固定循环 | G73, G81, G82, G83, G85, G86, G89, G98, G99 |
| 重复循环 | G76 |
| 进给模式 | G93, G94, G95, G96, G97 |
| 单位 | G20, G21 |
| 缩放 | G50, G51 |
| 车床模式 | G7, G8 |
| 距离模式 | G90, G91 |
| 平面选择 | G17, G18, G19 |
| 刀具长度偏移 | G43, G43.1, G43.2, G49 |
| 坐标系统 | G54-G59, G59.1, G59.2, G59.3 |
| 控制模式 | G61 |

**支持 M-Code**：

| 类别 | 命令 |
|------|------|
| 程序流 | M0, M1, M2, M30, M60 |
| 冷却液 | M7, M8, M9 |
| 主轴 | M3, M4, M5 |
| 换刀 | M6, M61 |
| 开关 | M48, M49, M50, M51, M53 |
| I/O 控制 | M62, M63, M64, M65, M66, M67, M68 |
| 模态状态 | M70, M71, M72, M73 |

### 2.8 换刀系统（Tool Change）

grblHAL 的换刀系统支持多种模式，通过 `tool_change.c` 实现：

**换刀模式**：

| 模式 | 设置值 | 描述 |
|------|-------|------|
| Disabled（禁用） | 0 | 不执行换刀 |
| Manual（手动） | 1 | 停止在安全 Z 位置，等待用户手动换刀 |
| Manual_G59_3 | 2 | 移动到 G59.3 坐标系的换刀位置 |
| SemiAutomatic（半自动） | 3 | 换刀后自动探针校准 |
| FastSemiAutomatic | 4 | 快速半自动换刀 |
| ATC（自动） | 5 | 自动换刀（依赖插件或驱动实现） |

**换刀序列**：
1. 停止主轴和冷却液
2. 回退到安全位置（Z 轴）
3. 等待用户确认（手动模式）或执行自动换刀（ATC 模式）
4. 恢复主轴和冷却液状态
5. 更新刀具长度偏移（TLO）

**刀具长度偏移（TLO）和探针**：
```
$TLR - 设置刀具长度参考
$TPW - 探针工件（测量刀具长度）
```

**ATC 插件机制**：
自动换刀（ATC）通过插件实现，插件通过设置 `hal.driver_cap.atc = true` 并重写 `hal.tool.change` 和 `hal.tool.select` 函数指针来接管核心换刀逻辑。

```c
void atc_init(void) {
    hal.tool.select = atc_tool_select;
    hal.tool.change = atc_tool_change;
    hal.driver_cap.atc = On;  // 阻止核心换刀代码注册
}
```

### 2.9 流通信系统（Stream I/O）

grblHAL 的流系统支持多种通信通道，通过 `io_stream_t` 结构体抽象：

| 流类型 | 描述 | 典型波特率/速率 |
|--------|------|---------------|
| Serial（串口） | UART 串行通信 | 115200 bps |
| USB | USB 虚拟串口 | 高速 |
| Bluetooth | 蓝牙 SPP | 115200 bps |
| Ethernet | 以太网（WizNet W5100S/W5500） | 10/100 Mbps |
| WebSocket | WebSocket 流 | 取决于网络 |
| SD Card | SD 卡流读取 | SPI 速度 |

**实时命令处理**：
流系统支持实时命令（Real-time Command）的即时处理，即使在执行其他操作时也能立即响应 `Feed Hold`、`Cycle Start` 等命令。

### 2.10 非易失性存储（NVS）

grblHAL 支持多种形式的非易失性存储，用于保存系统设置和用户数据：

| 存储类型 | 典型容量 | 写入周期 | 适用平台 |
|---------|---------|---------|---------|
| Flash 模拟 EEPROM | 4KB-64KB | 10K-100K | STM32、ESP32、RP2040 |
| 独立 EEPROM | 1KB-32KB | 1M | TM4C1294、TM4C123 |
| FRAM（推荐） | 4KB-32KB | 10^12 | 里程计等高频写入场景 |

**NVS API（`nvs_io_t`）**：
```c
typedef struct {
    bool (*init)(void);           // 初始化 NVS
    bool (*read)(uint32_t addr, uint8_t *data, uint32_t size);  // 读取数据
    bool (*write)(uint32_t addr, const uint8_t *data, uint32_t size); // 写入数据
    bool (*erase)(void);          // 擦除整个 NVS
} nvs_io_t;
```

---

## 3. 功能概览

### 3.1 主要功能模块

**核心功能**：

| 模块 | 文件 | 职责 |
|------|------|------|
| G-Code 解析器 | `gcode.c` | 解析 rs274/ngc 标准 G-Code |
| 运动规划器 | `planner.c` | 前瞻加速管理，运动队列优化 |
| 步进电机控制 | `stepper.c` | 精确步进脉冲生成 |
| 协议处理 | `protocol.c` | 串行协议、实时命令处理 |
| 任务管理 | `task.c` | 延迟任务调度 |
| 系统设置 | `settings.c` | 设置管理（$ 命令） |
| 限位开关 | `limits.c` | 限位检测、硬限位触发 |
| 回零 | `homing.c` | 回零序列控制 |
| 主轴控制 | `spindle.c` | 主轴启停、速度控制 |
| 冷却液控制 | `coolant.c` | 冷却液开关 |
| 换刀 | `tool_change.c` | 刀具管理、换刀序列 |
| 探针 | `probe.c` | G38.x 探针循环 |
| 运动学 | `kinematics.c` | 坐标变换 |
| 插件框架 | `plugin.h` | 插件注册和事件系统 |

### 3.2 关键工作流

**工作流：固件构建与烧录（ESP32 示例）**：

1. `git clone --recursive https://github.com/grblHAL/ESP32` — 克隆 ESP32 驱动
2. 修改 `grbl/config.h` 和 `CMakeLists.txt` 配置功能和引脚
3. 配置引脚映射（`*_map.h` 文件）
4. 添加自定义插件（添加 `my_plugin.c` 到 CMakeLists.txt）
5. `idf.py build` — 编译固件
6. `idf.py -p /dev/ttyUSB0 flash` — 烧录到设备

**工作流：CNC 控制操作**：

1. G-Code Sender（如 `ioSender`、`Candle`、`Universal G-Code Sender`）通过串口/USB 连接 grblHAL
2. 发送 G-Code 指令（G0/G1 快速移动/线性进给）
3. grblHAL 解析 G-Code → 运动规划器计算速度曲线 → 步进 ISR 输出脉冲
4. 实时命令（如 Ctrl+C 暂停）通过单独字节流即时处理
5. 状态报告通过 `?` 命令周期性返回

### 3.3 插件系统

grblHAL 的插件系统允许用户在不修改核心源代码的情况下扩展功能：

**插件注册机制**：

```c
// 插件通过拦截事件回调函数指针实现扩展
static void my_plugin_init(void) {
    // 保存原始回调
    on_report_options = grbl.on_report_options;
    // 替换为插件回调
    grbl.on_report_options = my_report_options;

    // 注册自定义设置
    nvs_alloc(sizeof(my_settings_t));
    settings_register(&my_setting_details);

    // 注册延迟任务
    task_add_delayed(my_poll_function, NULL, 100);
}
```

**插件实现的功能**：

| 插件类型 | 示例 | 实现方式 |
|---------|------|---------|
| ATC 自动换刀 | `flexihal_atc` | 替换 `hal.tool.change` / `hal.tool.select` |
| 主轴驱动 | Modbus VFD 主轴 | 替换 `hal.spindle.set_state` |
| I/O 扩展 | I2C GPIO 扩展器 | 通过 `io_port_t` 注册数字 I/O |
| 用户 M-Code | 自定义 M 代码 | 注册 `user_mcode_ptrs_t` |
| Web UI | ESP3D-WEBUI | 通过 Wi-Fi/以太网提供 Web 界面 |
| 里程计 | `Plugin_odometer` | 记录步进电机总运动距离 |
| RGB 灯 | NeoPixel 控制 | 注册 `rgb_ptr_t` |
| SD 卡 | SD 卡流读取 | 替换 `io_stream_t` |
| 键盘 | I2C 键盘控制 | 注册 `periph_port_t` |

### 3.4 引脚交叉开关系统（Pin Crossbar）

grblHAL 实现了灵活的引脚映射系统，通过 `pin_function_t` 枚举定义所有可能的引脚功能：

```c
typedef enum {
    Pin_StepX,    // X 轴步进
    Pin_DirX,     // X 轴方向
    Pin_StepY,    // Y 轴步进
    Pin_DirY,     // Y 轴方向
    Pin_LimitX,   // X 轴限位
    Pin_LimitY,   // Y 轴限位
    Pin_Probe,    // 探针输入
    Pin_SpindlePWM, // 主轴 PWM
    Pin_CoolantMist, // 冷却液雾
    Pin_CoolantFlood, // 冷却液
    // ... 更多引脚功能
} pin_function_t;
```

每个引脚关联 `pin_cap_t` 能力声明，定义该引脚可用的硬件功能（PWM、ADC、中断等）。

### 3.5 主轴控制

grblHAL 支持多种主轴控制方式：

| 主轴类型 | 控制方式 | 支持的驱动 |
|---------|---------|-----------|
| PWM 主轴 | 通过 PWM 信号控制转速 | 大多数驱动 |
| 可变频率主轴 | 0-10V 模拟信号 | 通过 DAC 或 PWM+DAC 转换 |
| Modbus VFD | Modbus RTU 协议 | 支持多种 VFD 品牌 |
| RC Servo/ESC | 标准 PWM 信号（20ms 周期，1-2ms 脉冲） | 所有驱动 |
| 编码器闭环 | 主轴编码器反馈 | iMXRT1062、STM32F7xx 等 |

**恒表面速度（CSS）**：
grblHAL 支持 G96/G97 恒表面速度（Constant Surface Speed）模式，根据工具位置自动调整主轴转速。

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| GitHub 仓库 | 核心、驱动、插件三个主要仓库 |
| 核心代码首次提交 | 2018 年 |
| 支持的处理器系列 | 15+ |
| 核心代码语言 | C（优化 C） |
| 许可证 | GPL-3.0 |
| 主要维护者 | Terje Io（核心 + 多个驱动） |
| 社区贡献者 | 多位驱动和插件贡献者 |

### 4.2 社区规模/用户基数

- **GitHub 生态**：grblHAL 组织包含多个仓库（core、drivers、plugins、ESP32、PLC 等）
- **Web Builder 使用**：在线构建工具提供无需安装工具链的固件构建
- **用户论坛**：https://www.grbl.org 社区论坛
- **CNC 社区**：广泛应用于 DIY CNC、激光切割、雕刻等社区
- **学术引用**：因 HAL 设计模式被嵌入式系统课程引用

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **grblHAL Core** | 核心固件，包含 G-Code 解析、运动规划、协议处理 |
| **硬件驱动** | 15+ 处理器平台驱动实现 |
| **插件系统** | 扩展 ATC、Web UI、自定义 I/O 等 |
| **Web Builder** | 在线固件构建工具 |
| **ioSender** | 兼容的 G-Code Sender（支持协议扩展） |
| **ESP3D-WEBUI** | ESP32 平台 Web 界面 |
| **CNC BoosterPack** | TI LaunchPad 扩展板 |
| **Trinamic 驱动** | TMC2130 步进驱动支持 |

### 4.4 最新发展趋势

1. **多平台扩展** — 持续增加新处理器支持（RP2350、iMXRT 等）
2. **ATC 插件生态壮大** — 社区开发的 ATC 插件增多（flexihal_atc 等）
3. **Web UI 集成** — ESP3D-WEBUI 的双向通信
4. **以太网连接** — WizNet W5500/W5100S SPI 以太网支持
5. **I2C 外设扩展** — I2C GPIO 扩展器、I2C 键盘等
6. **PLC 功能扩展** — 从纯 CNC 控制器向更通用的工业控制器演进

### 4.5 安全评估

| 维度 | 评估 |
|------|------|
| 物理安全 | 限位开关、紧急停止、软限位 |
| 通信安全 | 串口/USB 协议不支持加密（本地控制场景） |
| 固件安全 | 无安全启动机制 |
| 认证 | 无认证机制（本地控制场景） |
| 输入验证 | G-Code 解析器有输入验证，防止格式错误 |

---

## 5. 市场定位

### 5.1 主要应用行业与场景

| 行业 | 典型应用 | 硬件平台 |
|------|---------|---------|
| DIY CNC 制作 | 铣床、雕刻机、激光切割机 | ESP32、STM32、RP2040 |
| 3D 打印 | CoreXY 打印机、Delta 机器人 | iMXRT1062、STM32 |
| 小型制造 | 小型生产 CNC 铣床 | STM32H7xx、iMXRT1062 |
| 教育 | CNC 教学、运动控制课程 | RP2040、STM32F3xx |
| 机器人 | 墙绘机器人、极坐标机器人 | ESP32、STM32 |
| 激光加工 | 激光切割、激光雕刻 | ESP32（支持 PPI 模式） |

### 5.2 竞争对手对比

| 维度 | grblHAL | 原始 grbl (Arduino) | Marlin | Smoothieware | LinuxCNC |
|------|---------|-------------------|--------|-------------|---------|
| 开源 | 完全开源（GPL-3.0） | 开源（GPL-3.0） | 开源（GPL-3.0） | 开源（GPL-3.0） | 开源（GPL-2.0） |
| 硬件平台 | 15+ 种 32 位 MCU | AVR（8 位） | 32 位 MCU | LPC 系列 | x86 PC |
| 性能 | 300 kHz 步进脉冲 | ~30 kHz | ~100 kHz | ~200 kHz | 极高 |
| HAL 架构 | 完整 HAL，函数指针 | 无 | 有限 | 无 | 有（RT 组件） |
| 插件系统 | 事件驱动插件 | 无 | 有限 | 无 | 有 |
| 运动学 | CoreXY/Polar/Wall Plotter | 仅 Cartesian | 多种 | 有限 | 完整 |
| 自动换刀 | 支持（插件方式） | 不支持 | 有限 | 有限 | 完整 |
| 主要用途 | CNC 控制器 | CNC 控制器 | 3D 打印 | CNC 控制器 | 工业 CNC |

### 5.3 行业引用案例

- **DIY CNC 社区**：广泛使用的 CNC 控制器固件，特别是在 ESP32 和 STM32 平台上
- **激光切割**：通过 PPI 模式支持脉冲激光控制
- **3D 打印**：CoreXY 运动学支持的打印机控制
- **教育**：嵌入式系统课程中作为 HAL 设计模式的教学案例

---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **HAL 驱动架构的极致应用**：
   - 所有硬件访问通过函数指针间接调用，无直接硬件依赖
   - 核心代码零修改即可支持新硬件
   - `driver_cap_t` 位掩码声明精确的驱动能力，核心可据此优化行为

2. **零侵入式插件扩展**：
   - 无需修改核心源代码即可添加功能
   - 通过事件回调拦截机制实现插件扩展
   - 插件可注册自定义设置（保存到 NVS）
   - 已实现插件：ATC、Web UI、I2C 键盘、里程计、Modbus VFD 主轴

3. **极高的性能密度**：
   - 在 600 MHz iMXRT1062 上实现 300 kHz 稳定步进脉冲
   - 在 125 MHz RP2040 上实现最多 6 轴控制
   - 优化的 C 代码 + 精确的 ISR 定时

4. **多运动学模型支持**：
   - 标准 Cartesian、CoreXY、Wall Plotter、Polar Robot
   - 统一的 kinematics API 使得自定义运动学模型容易实现
   - 线分割（Line Segmentation）保证非线性运动学精度

5. **灵活的构建方式**：
   - 本地构建：原生 IDE 支持
   - Docker 构建：跨平台 CI/CD 友好
   - Web Builder：无需安装工具链，浏览器即可构建

### 6.2 标志性功能或设计理念

- **"函数指针解耦"** — 通过 `hal_t`、`grbl_t` 结构体中的函数指针实现核心与驱动的完全解耦，这是嵌入式系统 HAL 设计的最佳实践
- **"事件驱动插件"** — 核心代码通过事件回调（`on_*` 函数指针）暴露钩子，插件通过替换这些钩子来扩展功能
- **"驱动能力自描述"** — `driver_cap_t` 位掩码使驱动能够精确声明其能力，核心据此自适应优化
- **"300 kHz 无抖动"** — 步进脉冲的精确时序是 CNC 控制的关键指标

### 6.3 创新设计哲学

**"从 Arduino 到工业级"的演进路径**：
grblHAL 从原始 grbl（Arduino 8 位 AVR 版本）起步，通过 HAL 架构将其提升到 32 位工业级水平。这一演进路径证明：通过良好的架构抽象，嵌入式固件可以从简单的原型扩展到工业级应用。

**"核心代码不变"的原则**：
grblHAL 的核心代码不包含任何硬件特定的代码。所有硬件访问都通过 HAL 函数指针间接进行。这意味着核心代码可以在不同硬件平台之间零修改移植。

---

## 7. 对 AUDESYS 的参考价值

### 7.1 可借鉴的架构设计/理念

#### 1. HAL 函数指针架构

grblHAL 的 HAL 设计是嵌入式系统硬件抽象的最佳实践。AUDESYS HAL 可以借鉴其以下设计要点：

- **函数指针驱动的 HAL 接口**：使用结构体封装所有函数指针，驱动初始化时填充这些指针，核心代码通过指针间接调用
- **能力声明机制**：驱动通过位掩码声明其能力，核心代码可根据能力启用或禁用功能
- **可选组件设计**：HAL 接口分为必需组件（stepper、stream）和可选组件（probe、tool、encoder），兼顾灵活性和最小化实现

**AUDESYS 参考**：AUDESYS HAL 的 `HalTransport` trait 可以借鉴 grblHAL 的函数指针模式，在 Rust 中表现为 trait 对象和动态分发。

#### 2. 插件系统的事件回调机制

grblHAL 的插件系统通过事件回调（`on_*` 函数指针）实现零侵入扩展。AUDESYS 的模块化架构可以借鉴：

- **保存/替换回调模式**：插件保存原始回调，替换为自定义实现，在自定义实现中调用原始回调形成链式处理
- **自定义设置注册**：插件可动态注册自己的配置项，无需修改核心配置系统
- **延迟任务注册**：插件可注册周期性执行任务，无需额外线程

#### 3. 多平台 HAL 驱动实现

grblHAL 的 15+ 驱动实现展示了如何在不同 MCU 平台上实现同一 HAL 接口。这对 AUDESYS 的 HAL 多平台策略有直接参考价值。

### 7.2 可移植/适配的技术模块

| 技术模块 | 描述 | 移植价值 |
|---------|------|---------|
| **HAL 函数指针接口设计** | `hal_t` 结构体设计 | 高，直接参考 AUDESYS HAL 的 trait 设计 |
| **插件事件回调机制** | `grbl_t` 事件回调系统 | 高，AUDESYS 模块化扩展可借鉴 |
| **运动规划器** | 前瞻加速管理 | 中，如果 AUDESYS 需要 CNC 运动控制 |
| **运动学变换** | CoreXY/Polar 变换 | 中，如果 AUDESYS 需要多运动学模型 |
| **步进电机控制** | 精确脉冲时序 | 中，如果 AUDESYS 需要直接控制步进电机 |
| **流通信抽象** | 串口/USB/蓝牙/以太网统一接口 | 低，AUDESYS 使用更高级别的通信抽象 |

### 7.3 与 AUDESYS 定位的差异与互补

| 维度 | grblHAL | AUDESYS |
|------|---------|---------|
| 核心定位 | CNC 运动控制器固件 | 工业控制系统模拟平台 |
| 目标硬件 | 嵌入式 MCU（STM32、ESP32、RP2040） | 通用计算平台 + 仿真 |
| 控制类型 | 实时步进电机控制 | 多样化的工业控制仿真 |
| 编程方式 | G-Code 输入 | 多种语言 + 可视化（规划中） |
| HAL 设计 | 函数指针驱动的硬件抽象 | 完整的通信原语（Signal/StreamChannel/RPC） |
| 插件系统 | 事件回调拦截 | 模块化扩展（规划中） |
| 抽象层次 | 硬件访问层（GPIO、定时器、PWM） | 通信中间件层（节点间数据交换） |

**互补关系**：
- grblHAL 的 HAL 设计是 **底层硬件抽象**（如何访问 MCU 外设），AUDESYS 的 HAL 设计是 **上层通信抽象**（如何在分布式节点间交换数据），两者在抽象层次上互补
- grblHAL 的插件事件回调机制为 AUDESYS 的模块化扩展提供了参考模式
- grblHAL 的 15+ 平台驱动证明了良好 HAL 设计的多平台价值

### 7.4 详细对比分析：AUDESYS HAL 与 grblHAL HAL

| 维度 | grblHAL HAL | AUDESYS HAL（设计） |
|------|------------|-------------------|
| 设计目标 | 统一 MCU 外设访问接口 | 完整的实时通信中间件 |
| 原语 | 函数指针：stepper、limits、spindle 等 | Signal + StreamChannel + RPC |
| 实现方式 | C 结构体 + 函数指针 | Rust trait + 动态分发 |
| 类型系统 | 基本 C 类型（int、float、bitmask） | 14 种（11 标量 + String + Blob + Array） |
| 发现机制 | 静态编译时绑定 | HalDiscovery（anycast/group/unicast） |
| QoS | 无（实时性依赖 ISR 优先级） | HalQoS（deadline/liveliness/security_domain） |
| 序列化 | 直接内存访问 | FlatBuffers（多语言互操作） |
| 多语言 | 纯 C 实现 | Rust + C++ + 15 种语言（分层） |
| 扩展机制 | 事件回调 + 插件框架 | 模块化设计（规划中） |
| 配置管理 | 编译时配置 + NVS 设置 | Config Barrier + LockLevel |

grblHAL 的 HAL 是典型的 **MCU 外设抽象层**（解决"如何在不同的 MCU 上访问 GPIO、定时器、PWM"），而 AUDESYS 的 HAL 是 **通信中间件**（解决"如何在分布式节点间交换数据"）。两者在抽象层次上有本质区别，但 grblHAL 的函数指针驱动架构对 AUDESYS 的 trait 设计有直接参考价值。

### 7.5 开源生态系统对比

| 维度 | grblHAL 生态 | AUDESYS（当前/规划） |
|------|-------------|-------------------|
| 代码仓库 | 核心 + 驱动 + 插件 三个仓库 | 单仓库（早期项目） |
| 贡献者 | 多位驱动和插件贡献者 | 0 |
| 硬件支持 | 15+ 处理器平台 | 仿真为主 |
| 插件系统 | 数十种社区插件 | 无 |
| 商业支持 | 社区自维护 | 无 |
| 工业部署 | 广泛（DIY CNC 社区） | 0 |
| Web Builder | 在线构建工具 | 无 |

grblHAL 证明了通过 HAL 架构实现多平台支持的有效性，其插件生态系统的发展模式对 AUDESYS 的模块化扩展有参考价值。

---

> **本文档基于 2026 年 7 月的公开信息编写。部分数据可能随 grblHAL 版本迭代而变化。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从官方仓库验证。

### 7.6 开源治理模式的参考

grblHAL 采用松散的组织治理模式：核心代码由 Terje Io 维护，各驱动有独立的仓库和维护者，插件完全由社区独立开发。这种模式的好处是：

- **降低贡献门槛** — 驱动开发者不需要理解整个核心代码即可贡献
- **分散维护负担** — 各驱动有独立维护者，不依赖单一核心团队
- **社区自发增长** — 插件可以独立于核心版本发布

AUDESYS 在组织开源社区时，可参考这种核心+驱动分离的仓库结构，降低外部贡献门槛。

### 7.7 从 grblHAL 到 AUDESYS 的迁移路径思考

虽然 grblHAL 是底层 MCU 固件而 AUDESYS 是上层仿真平台，但两者可以通过以下桥接方式互通：

1. **HAL 适配器** — 在 AUDESYS 的 HAL 层实现一个 grblHAL 适配器，将 grblHAL 的运动控制命令映射到 AUDESYS Signal/StreamChannel
2. **仿真模式** — AUDESYS Simulator 可以仿真 grblHAL 的行为，用于测试 G-Code 程序
3. **Plugin Bridge** — 通过插件方式将 grblHAL 集成到 AUDESYS 的模块化架构中

这种桥接思路适用于 AUDESYS 与底层控制硬件的集成场景。

---

> **本文档基于 2026 年 7 月的公开信息编写。部分数据可能随 grblHAL 版本迭代而变化。建议直接从官方仓库验证最新信息。**
> **注意**: grblHAL 的 HAL 设计是面向底层 MCU 外设抽象的典范，与 AUDESYS 的通信中间件 HAL 在抽象层次上互补，两者结合可实现从固件到平台的完整控制栈。

---

> **grblHAL 参考文档结束**
