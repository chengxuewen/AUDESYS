# Marlin

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: Marlin（3D 打印机固件）
- **开发商/组织**: 最初由 Erik van der Zalm 在 2011 年从 Sprinter 固件分支创建，现由 Marlin 社区维护（MarlinFirmware 组织），核心维护者包括 Scott Lahteine（@thinkyhead）、Bob Kuhn、Chris Pepper 等
- **首次发布年份**: 2011 年（Marlin v1.0），从 Sprinter/grbl 分支
- **当前版本**: 
  - Marlin 2.1.x（2024-2026 年稳定分支）— 基于 Arduino 框架的 32 位版本
  - Marlin 2.0.x（已停止功能更新，安全修复中）
  - Marlin 1.1.x（已停止维护，经典 AVR 版本）
  - 开发分支: Marlin 2.2.x（bugfix-2.1.x 分支，持续开发中）
- **仓库地址**: 
  - Marlin 主仓库: https://github.com/MarlinFirmware/Marlin
  - Marlin 配置示例: https://github.com/MarlinFirmware/Configurations
  - Marlin 文档: https://marlinfw.org/
- **许可证**: GNU General Public License v3.0（GPL-3.0）

### 1.2 产品定位与核心价值主张

Marlin 定位为 **最广泛部署的开源 3D 打印机固件**，其核心价值主张是：

1. **极广的硬件兼容性** — 从 8 位 AVR（Arduino Mega 2560）到 32 位 ARM（STM32、LPC176x、GD32 等），覆盖数百种 3D 打印机主板
2. **成熟稳定** — 超过 14 年的持续开发，数十万次实际部署验证，是 RepRap 社区的事实标准固件
3. **功能丰富** — 完整的 G-code 支持、多轴运动学、自动调平、热床控制、SD 卡打印、LCD 显示、安全保护
4. **单芯片一体式架构** — 所有计算（G-code 解析、运动规划、温度控制、LCD 显示、SD 卡读取）都在同一颗 MCU 上完成
5. **Arduino 生态** — 基于 Arduino 框架，易于编译、修改和定制

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| 3D 打印初学者 | 入门级打印机（Ender 3、Anycubic 等） | 开箱即用、社区支持多 |
| 中级爱好者 | 改装/升级现有打印机 | 丰富的配置选项、支持多种传感器 |
| 高级 DIY 玩家 | 自建 CoreXY/Delta 打印机 | 灵活的运动学选择、高级功能 |
| 打印机 OEM | 商业 3D 打印机出厂固件 | 稳定可靠、定制化能力 |
| 教育机构 | 3D 打印教学、STEM 课程 | 文档完善、易于上手 |
| 工业用户 | 轻量制造、快速原型 | 可靠性和可重复性 |

### 1.4 许可证模型

- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **商业模型**: 完全开源免费，社区驱动开发
- **封闭组件**: 无 — 完全开源
- **OEM 考虑**: GPL-3.0 要求衍生作品同样开源，商业 3D 打印机集成 Marlin 时需注意许可证合规性

---

## 2. 技术特性

### 2.1 核心架构

Marlin 采用 **单芯片一体式架构（Single-Chip Monolithic Architecture）** — 所有功能在同一个 MCU 上完成：

```
+--------------------------------------------------------------+
|                    Marlin 系统架构                             |
|                    8-bit/32-bit MCU 单芯片                     |
+--------------------------------------------------------------+
|  Arduino 框架层 (HAL 抽象层)                                   |
|  +--------------------------------------------------------+  |
|  | Marlin 核心模块                                         |  |
|  |                                                         |  |
|  |  +------------------+  +------------------+             |  |
|  |  | G-code 解析器    |  | 运动规划器       |             |  |
|  |  | (Marlin/G-code)   |  | (planner.cpp)    |             |  |
|  |  +------------------+  +--------+---------+             |  |
|  |                                |                        |  |
|  |  +------------------+  +------+---------+             |  |
|  |  | 温度控制         |  | 步进控制        |             |  |
|  |  | (temperature.cpp) |  | (stepper.cpp)   |             |  |
|  |  +------------------+  +------------------+             |  |
|  |                                                         |  |
|  |  +------------------+  +------------------+             |  |
|  |  | LCD/显示         |  | SD 卡管理        |             |  |
|  |  +------------------+  +------------------+             |  |
|  |                                                         |  |
|  |  +------------------+  +------------------+             |  |
|  |  | 端止/探针        |  | 风扇/加热        |             |  |
|  |  +------------------+  +------------------+             |  |
|  +--------------------------------------------------------+  |
|  | 硬件抽象层 (HAL)                                       |  |
|  |  +--------+ +--------+ +--------+ +--------+           |  |
|  |  | AVR    | | STM32  | | LPC176x| | Teensy |           |  |
|  |  +--------+ +--------+ +--------+ +--------+           |  |
|  +--------------------------------------------------------+  |
|  | 物理硬件层                                              |  |
|  |  +---------+ +---------+ +---------+ +---------+       |  |
|  |  | GPIO    | | Timer   | | ADC     | | UART/SPI |       |  |
|  |  +---------+ +---------+ +---------+ +---------+       |  |
|  +--------------------------------------------------------+  |
+--------------------------------------------------------------+
```

#### 主循环（Main Loop）架构

Marlin 的主循环是一个 **轮询式架构（Polling Loop）**，按以下顺序执行：

```
void loop() {
  // 1. 管理缓冲区
  // 2. 获取 G-code 命令（来自串口/SD 卡/LCD）
  // 3. 解析 G-code
  // 4. 执行 G-code
  // 5. 管理热端加热
  // 6. 管理热床加热
  // 7. 管理风扇
  // 8. 管理 LCD 更新
  // 9. 管理主机通信
  // 10. 管理安全检查（热失控保护等）
}
```

#### 中断驱动架构（ISR-Driven Architecture）

Marlin 的步进控制完全由 **定时器中断（Timer Interrupt）** 驱动：

```
定时器中断 (TIMER0_COMPA_vect 或类似的步进定时器中断)
  |
  +-> stepper.cpp 的 ISR:
  |     1. 计算当前中断的步进脉冲
  |     2. 通过 Bresenham DDA 选择下一个要步进的轴
  |     3. 切换 step pin HIGH
  |     4. 调度下一个中断时间
  |     5. 切换 step pin LOW
  |     6. 更新位置计数器
  |
  +-> 温度 ADC 中断:
  |     1. 读取 ADC 值
  |     2. 更新温度数组
  |     3. 计算 PID 输出
  |
  +-> LCD 更新中断（可选）:
        1. 轮询 LCD 按键
        2. 更新 LCD 显示
```

### 2.2 步进控制算法

#### Bresenham DDA 算法

Marlin 的步进控制基于 **Bresenham Digital Differential Analyzer（DDA）** 算法，与 grbl 同源：

```
// Bresenham DDA 步进选择逻辑的简化伪代码
for (int i = 0; i < num_steps; i++) {
    // 对每个轴，累加该轴的"误差"项
    for (int axis = X_AXIS; axis <= E_AXIS; axis++) {
        counter[axis] += counter_increment[axis];
        if (counter[axis] >= 0) {
            // 该轴需要步进
            step_pin_high(axis);
            counter[axis] -= counter_max[axis];
            // 调度步进脉冲宽度
            step_pin_low(axis);
            position[axis] += direction[axis];
        }
    }
    // 调度下一个步进事件的中断时间
    set_next_step_interrupt(next_interval);
}
```

**Bresenham 算法特点**：
- 计算量小（整数运算，无浮点）
- 适合 8 位 MCU 的运算能力
- 步进脉冲分布均匀，减少机械振动
- 多轴同步效果好

#### 梯形速度规划（Trapezoid Speed Profile）

Marlin 使用 **梯形速度规划** 在 Move 的前瞻队列中：

```
  速度
   ^
   |    /----------\        <- 巡航段 (cruise)
   |   /            \
   |  /              \     <- 减速段 (deceleration)
   | /                \
   +-----------------------> 时间
   加速段(cruise)   减速段
```

Marlin 的 `planner.cpp` 维护一个 **前瞻队列（Look-ahead Queue）**：

```cpp
// 简化的 Marlin 前瞻队列逻辑
class Planner {
    block_t block_buffer[BLOCK_BUFFER_SIZE];  // 环形缓冲区
    uint8_t block_buffer_head, block_buffer_tail;

    // 添加一个 Move 块到队列
    void buffer_line(const float(&pos)[XYZE], float feedrate) {
        // 计算 max entry speed
        // 计算 max exit speed
        // 生成 trapezoid 参数
        // 推入队列
    }

    // 前瞻优化 — 检查相邻块，调整 junction velocity
    void recalculate() {
        // 从队列尾部开始，向前调整 junction velocity
        // 确保所有 Move 可平滑过渡
    }
};
```

### 2.3 运动学系统

Marlin 支持的运动学类型：

| 运动学类型 | 宏定义 | 轴数 | 说明 |
|-----------|--------|------|------|
| Cartesian | 默认 | 3+2 (XYZE) | 标准笛卡尔，X/Y/Z 独立轴 |
| CoreXY | `COREXY` | 3+2 | CoreXY 对角线同步带 |
| CoreXZ | `COREXZ` | 3+2 | CoreXZ 变体 |
| Delta | `DELTA` | 3+2 | Delta 并联运动学 |
| SCARA | `SCARA` | 3+2 | SCARA 臂运动学 |
| Polar | 自定义 | 3+2 | 极坐标运动学 |
| MarkForged | `MARKFORGED` | 3+2 | MarkForged 类型 |

**Cartesian 运动学**（默认）：

```cpp
// 简化的 Cartesian 逆运动学
void cartesian_to_steppers(const float(&target)[XYZE]) {
    stepper_counts[X_AXIS] = lround(target[X_AXIS] * steps_per_mm[X_AXIS]);
    stepper_counts[Y_AXIS] = lround(target[Y_AXIS] * steps_per_mm[Y_AXIS]);
    stepper_counts[Z_AXIS] = lround(target[Z_AXIS] * steps_per_mm[Z_AXIS]);
    stepper_counts[E_AXIS] = lround(target[E_AXIS] * steps_per_mm[E_AXIS]);
}
```

**CoreXY 运动学**：

```cpp
// 简化的 CoreXY 逆运动学
void corexy_to_steppers(const float(&target)[XYZE]) {
    // CoreXY: motor_A = X + Y, motor_B = X - Y
    float motor_A = target[X_AXIS] + target[Y_AXIS];
    float motor_B = target[X_AXIS] - target[Y_AXIS];
    stepper_counts[A_MOTOR] = lround(motor_A * steps_per_mm[X_AXIS]);
    stepper_counts[B_MOTOR] = lround(motor_B * steps_per_mm[Y_AXIS]);
    stepper_counts[Z_AXIS] = lround(target[Z_AXIS] * steps_per_mm[Z_AXIS]);
    stepper_counts[E_AXIS] = lround(target[E_AXIS] * steps_per_mm[E_AXIS]);
}
```

**Delta 运动学**：

```cpp
// 简化的 Delta 逆运动学
void delta_to_steppers(const float(&target)[XYZE]) {
    // 计算每个塔柱的 Z 高度
    for (int i = 0; i < 3; i++) {
        float dx = target[X_AXIS] - tower_x[i];
        float dy = target[Y_AXIS] - tower_y[i];
        float distance = sqrt(dx*dx + dy*dy);
        float z = target[Z_AXIS] + sqrt(delta_arm_length * delta_arm_length - distance * distance);
        stepper_counts[i] = lround(z * steps_per_mm[Z_AXIS]);
    }
    stepper_counts[E_AXIS] = lround(target[E_AXIS] * steps_per_mm[E_AXIS]);
}
```

### 2.4 G-code 解析器

Marlin 包含一个 **完整的 G-code 解析器**，支持 G-code 标准子集（RS-274D/NGC）：

```cpp
// G-code 解析的简化结构
void process_parsed_command() {
    switch (parser.command_letter) {
        case 'G':
            switch (parser.codenum) {
                case 0:  // G0: 快速移动
                case 1:  // G1: 线性移动
                    prepare_move_to_destination();
                    break;
                case 28: // G28: 回零
                    home_all_axes();
                    break;
                case 29: // G29: 自动调平
                    bed_leveling();
                    break;
                // ... 更多 G-code
            }
            break;
        case 'M':
            switch (parser.codenum) {
                case 104: // M104: 设置挤出机温度
                    set_target_hotend(parser.floatval('S'));
                    break;
                case 109: // M109: 等待挤出机温度
                    set_target_hotend(parser.floatval('S'));
                    wait_for_hotend();
                    break;
                // ... 更多 M-code
            }
            break;
    }
}
```

支持的 G-code 命令数量：超过 400 个（包括 G-code、M-code、T-code 和自定义命令）。

### 2.5 温度控制系统

Marlin 的温度控制使用 **PID（Proportional-Integral-Derivative）** 控制器：

```cpp
// Marlin PID 温度控制（简化）
class Temperature {
    // PID 参数
    float Kp, Ki, Kd;  // 比例、积分、微分系数

    // PID 计算（每次 ADC 读数触发）
    void update_PID(const int heater_id) {
        float input = current_temperature[heater_id];  // 当前温度
        float setpoint = target_temperature[heater_id];  // 目标温度

        float error = setpoint - input;
        float pid_output = Kp * error
                         + Ki * (iTerm[heater_id] += error)
                         + Kd * (error - last_error[heater_id]);

        // 限幅到 PWM 范围
        pid_output = constrain(pid_output, 0, PID_MAX);

        // 设置 PWM 输出
        set_heater_pwm(heater_id, pid_output);
        last_error[heater_id] = error;
    }
};
```

**PID 自动调谐** — Marlin 支持 `M303` 命令自动调谐 PID 参数：

```
M303 E0 S200 C8  ; 挤出机 0 目标 200°C，循环 8 次
```

使用 Ziegler-Nichols 方法自动计算 Kp、Ki、Kd 值。

**热失控保护（Thermal Runaway Protection）** — Marlin 内置了多层安全保护：

```
- 加热速率检测：如果温度上升速度异常，进入保护状态
- 温度下降检测：如果加热时温度下降，切断加热
- 最大温度限制：MAX_TEMP 硬限制，防止硬件故障
- 最小温度限制：MIN_TEMP 防止传感器断开误判
```

### 2.6 配置系统

Marlin 使用 **C 宏配置系统** — 所有配置在编译时通过 `Configuration.h` 和 `Configuration_adv.h` 定义：

```cpp
// Configuration.h 示例
#ifndef CONFIGURATION_H
#define CONFIGURATION_H

// 打印机信息
#define STRING_CONFIG_H_AUTHOR "(Your Name, Ender 3)"
#define CUSTOM_MACHINE_NAME "Ender 3"

// 运动学类型
#define COREXY  // 取消注释以启用 CoreXY
//#define DELTA  // 取消注释以启用 Delta

// 步进电机参数
#define X_DRIVER_TYPE  TMC2209
#define Y_DRIVER_TYPE  TMC2209
#define Z_DRIVER_TYPE  TMC2209

#define X_STEPS_PER_MM 80.0
#define Y_STEPS_PER_MM 80.0
#define Z_STEPS_PER_MM 400.0
#define E_STEPS_PER_MM 93.0

#define X_MAX_POS 235
#define Y_MAX_POS 235
#define Z_MAX_POS 250

// 速度限制
#define DEFAULT_MAX_FEEDRATE { 500, 500, 10, 25 }
#define DEFAULT_MAX_ACCELERATION { 500, 500, 100, 1000 }
#define DEFAULT_ACCELERATION 500

// 温度传感器
#define TEMP_SENSOR_0 1
#define TEMP_SENSOR_BED 1

// PID 参数
#define DEFAULT_Kp 22.80
#define DEFAULT_Ki 1.41
#define DEFAULT_Kd 90.68

// 自动调平
#define AUTO_BED_LEVELING_BILINEAR
//#define AUTO_BED_LEVELING_UBL  // Unified Bed Leveling

// 显示
#define REPRAP_DISCOUNT_FULL_GRAPHIC_SMART_CONTROLLER

#endif
```

```cpp
// Configuration_adv.h 示例（高级配置）
#define FILAMENT_RUNOUT_SENSOR    // 断料检测
#define POWER_LOSS_RECOVERY       // 掉电续打
#define ADVANCED_OK               // 详细状态报告
#define EMERGENCY_PARSER          // 紧急停止（M112）实时响应
#define HOST_ACTION_COMMANDS      // 主机动作命令
#define SDSUPPORT                 // SD 卡支持
#define FAN_SOFT_PWM              // 风扇软 PWM
#define BLINKM                    // RGB LED
#define NEOPIXEL_LED              // 可寻址 LED
```

**配置系统的设计特点**：

- **编译时配置** — 所有参数在编译时确定，运行时无法修改
- **宏定义开关** — 使用 `#define` / `#undef` 控制功能启用/禁用
- **条件编译** — 大量使用 `#ifdef` / `#ifndef` 在编译时选择代码路径
- **配置复杂度** — `Configuration.h` + `Configuration_adv.h` 共有约 2000+ 个可配置项

### 2.7 硬件抽象层（HAL）

Marlin 2.0+ 引入了 **硬件抽象层（Hardware Abstraction Layer）** 以支持多平台：

```
Marlin HAL 架构:

            Marlin 核心代码
                 |
            +----+----+
            | HAL API |
            +----+----+
                 |
    +--------+---+---+--------+
    |        |       |        |
   AVR     STM32   LPC176x  Teensy
    |        |       |        |
 Arduino  STM32Duino LPC176  Teensyduino
```

**HAL 提供的接口**：

```cpp
// HAL 接口示例 (HAL.h)
namespace hal {
    // 定时器
    void timer_set(const uint16_t cycles);
    void timer_start(const uint8_t channel);
    void timer_stop(const uint8_t channel);

    // GPIO
    void gpio_set(const pin_t pin, const uint8_t value);
    uint8_t gpio_read(const pin_t pin);

    // ADC
    uint16_t adc_read(const pin_t pin);

    // 串口
    void serial_init(const uint16_t baud);
    void serial_write(const uint8_t c);
    uint8_t serial_read();

    // 延迟
    void delay_us(const uint16_t us);
    void delay_ms(const uint16_t ms);

    // 复位
    void reset();
}
```

### 2.8 自动调平系统

Marlin 支持多种自动调平（Auto Bed Leveling, ABL）方式：

| 调平方式 | 宏定义 | 原理 | 精度 |
|---------|--------|------|------|
| Bilinear | `AUTO_BED_LEVELING_BILINEAR` | 矩形网格插值 | 高 |
| Unified (UBL) | `AUTO_BED_LEVELING_UBL` | 3x3 到 15x15 可配置网格 | 很高 |
| Linear | `AUTO_BED_LEVELING_LINEAR` | 3 点平面拟合 | 中 |
| 3-Point | `AUTO_BED_LEVELING_3POINT` | 3 点平面拟合 | 中 |
| Mesh | `MESH_BED_LEVELING` | 手动网格调平 | 中 |

**Unified Bed Leveling (UBL)** 是 Marlin 2.0 引入的最强大的调平系统：

```
UBL 工作流程:
1. 用户选择网格密度（3x3 到 15x15）
2. 传感器探测每个网格点
3. 将测得的偏移量存储为 Z 校正矩阵
4. 打印时在 G-code 坐标上叠加 Z 校正
5. 支持手动编辑和微调网格点
```

### 2.9 线性提前（Linear Advance）

Marlin 的线性提前（Linear Advance, LA）是 Klipper 的 Pressure Advance 的前身，由 Marlin 开发者实现：

```cpp
// Linear Advance 的简化实现
void planner::apply_linear_advance(block_t *block) {
    // K = linear_advance_k 系数（用户调参）
    float k = planner_settings.linear_advance_k;

    // 计算挤出量的补偿
    float e_compensation = k * (block->acceleration_e - block->acceleration);

    // 修改挤出步进量
    block->steps[E_AXIS] += lround(e_compensation * block->step_event_count);
}
```

Linear Advance 和 Klipper 的 Pressure Advance 的核心区别：
- Marlin LA：基于当前加速度的挤出补偿
- Klipper PA：基于当前速度的挤出补偿

### 2.10 显示与交互

Marlin 支持多种 LCD 显示和交互方式：

| 显示类型 | 接口 | 特点 |
|---------|------|------|
| Character LCD (2004/1602) | HD44780 并行 | 经典 4 行/2 行文本显示 |
| Graphical LCD (12864) | ST7920 串行/并行 | 点阵图形显示，支持图标 |
| TFT 触摸屏 | FSMC/SPI | 彩色触摸屏（Marlin 2.0+） |
| Nextion HMI | 串口 | 智能串口屏 |
| DWIN LCD | 自定义 | 创想三维等 OEM 使用 |
| U8G/U8G2 | 各种 | 通用图形库 |

---

## 3. 功能概览

### 3.1 主要功能模块

| 模块 | 文件 | 职责 |
|------|------|------|
| G-code 解析 | `Marlin/gcode/` | 400+ 个 G/M-code 命令的执行 |
| 运动规划 | `Marlin/planner.cpp` | 前瞻队列、梯形速度规划 |
| 步进控制 | `Marlin/stepper.cpp` | 步进脉冲 ISR 生成 |
| 温度控制 | `Marlin/temperature.cpp` | PID 温度控制、热失控保护 |
| 端点管理 | `Marlin/endstops.cpp` | 回零、限位开关 |
| 运动学 | `Marlin/motion/` | 多种运动学逆解 |
| 自动调平 | `Marlin/feature/bedlevel/` | ABL/UBL 床调平 |
| SD 卡 | `Marlin/sd/` | SD 卡读取和打印 |
| LCD 显示 | `Marlin/lcd/` | 多种 LCD 驱动 |
| 主机通信 | `Marlin/host/)` | 串口/USB 通信 |
| 高级功能 | `Marlin/feature/` | 断料检测、掉电续打、WiFi 等 |

### 3.2 关键工作流

#### 工作流：Marlin 编译与部署

1. **下载源码** — 从 GitHub 下载 Marlin 源码或使用 PlatformIO 项目模板
2. **配置** — 编辑 `Configuration.h` 和 `Configuration_adv.h`
3. **选择主板** — 在 `pins.h` 中选择目标主板型号
4. **编译** — 使用 PlatformIO 或 Arduino IDE 编译
5. **烧录** — 通过 USB 或 SD 卡烧录固件
6. **校准** — 运行 G-code 校准：PID 自动调谐、自动调平、e-steps 校准
7. **打印** — 通过 SD 卡或 USB 主机上传 G-code 打印

#### 工作流：运动规划与执行

```
1. 串口/SD 卡接收 G-code:
   G1 X100 Y100 E10 F6000

2. G-code 解析 (GcodeParser):
   -> 解析 G1 命令
   -> 提取 X/Y/Z/E/F 参数
   -> 调用 plan_buffer_line()

3. 运动规划 (planner.cpp):
   -> 计算 Move 距离和速度
   -> 生成梯形速度剖面
   -> 加入前瞻队列 (block_t)

4. 前瞻优化 (recalculate()):
   -> 检查相邻 block 的 junction velocity
   -> 调整加速/减速参数

5. 步进 ISR (stepper.cpp):
   -> 定时器中断触发
   -> Bresenham DDA 选择步进轴
   -> 切换 step pin
   -> 调度下一个中断时间

6. 位置更新:
   -> 更新当前位置计数器
   -> 检查是否完成该 block
   -> 完成时加载下一个 block
```

### 3.3 安全功能

Marlin 内置了丰富的安全保护机制：

| 安全功能 | 触发条件 | 响应 |
|---------|---------|------|
| 热失控保护 | 温度上升过快或下降 | 切断加热并报警 |
| 最大温度保护 | 温度超过 MAX_TEMP | 切断加热并报警 |
| 最小温度保护 | 传感器开路或短路 | 切断加热并报警 |
| 软件限位 | 超出软限位范围 | 停止运动并报警 |
| 硬件限位 | 触发限位开关 | 立即停止运动 |
| 看门狗计时器 | 程序死循环 | MCU 硬件复位 |
| 紧急停止 M112 | 串口命令或 LCD 操作 | 立即停止所有输出 |
| 掉电检测 | 电源电压下降 | 保存打印状态 |

### 3.4 扩展机制

Marlin 的扩展主要通过以下方式实现：

1. **编译时配置** — 通过 `#define` 宏启用/禁用功能
2. **条件编译** — 使用 `#ifdef` 选择编译路径
3. **HAL 层** — 通过 HAL 接口支持新硬件平台
4. **LCD 菜单** — 可扩展的 LCD 菜单系统
5. **G-code 自定义** — 通过 `Marlin/gcode/` 添加自定义 G-code
6. **插件系统** — 无原生插件系统（实现复杂度高，MCU 资源限制）

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| Marlin GitHub Stars | ~16,000 |
| Marlin GitHub Forks | ~19,000+ |
| Marlin 贡献者 | 约 600+ |
| 主要开发语言 | C++ (Arduino/PlatformIO) |
| 编译环境 | PlatformIO, Arduino IDE |
| 稳定版本 | Marlin 2.1.2.x (2024-2026) |
| 经典版本 | Marlin 1.1.9 (已停止维护) |
| 活跃分支 | bugfix-2.1.x |

### 4.2 社区规模

- **GitHub**: 16,000+ Stars，19,000+ Forks — 3D 打印固件中 Star 数最高的项目
- **Discord/Reddit**: r/3Dprinting、r/MarlinFirmware — 数十万用户
- **论坛**: Marlin 官方论坛、RepRap 论坛
- **OEM 部署**: 创想三维（Creality）、Anycubic、Artillery 等主流 3D 打印机厂商使用 Marlin 或 Marlin 分支
- **配置库**: `MarlinFirmware/Configurations` 仓库包含数百种主板和打印机的预配置示例

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **Marlin 主固件** | 3D 打印机核心固件 |
| **Marlin 配置示例** | 200+ 主板/打印机的预配置示例 |
| **PlatformIO 环境** | 推荐的编译工具链 |
| **Auto Build Marlin** | VS Code 扩展，一键编译 |
| **Marlin 文档** | marlinfw.org — 完整的配置和使用文档 |
| **OctoPrint** | 流行的 Web 打印管理（通过串口连接 Marlin） |
| **Pronterface** | 桌面打印控制软件 |
| **Repetier-Host** | 多功能的打印管理工具 |
| **Cura/PrusaSlicer** | 切片软件 — 生成 Marlin 兼容的 G-code |

### 4.4 Marlin 2.0 与 1.1 的关键差异

| 维度 | Marlin 1.1.x | Marlin 2.0/2.1.x |
|------|-------------|-----------------|
| 架构 | 仅 AVR 8-bit | AVR + 32-bit ARM + LPC + Teensy |
| 框架 | Arduino AVR | Arduino + HAL 抽象层 |
| 步进驱动 | A4988/DRV8825 原生 | TMC 驱动支持（SILENT/SPREAD） |
| 调平 | 基本 ABL | UBL + Bilinear + 3-Point |
| 线性提前 | 有 | 有（改进版） |
| 显示 | 基本 LCD | 多种 LCD + TFT + DWIN + Nextion |
| 混合打印 | 无 | 支持 IDEX 双头 |
| 输入整形 | 无 | 有限（实验性） |
| 高级功能 | 有限 | 断料检测、掉电续打、WiFi、RGB |

### 4.5 最新发展趋势

1. **32 位 MCU 迁移** — 从 8 位 AVR 向 STM32/GD32 过渡，Marlin 2.0+ 的 HAL 层支持 32 位平台
2. **TMC 驱动普及** — TMC2208/TMC2209/TMC5160 静音驱动成为标配，Marlin 原生支持
3. **Klipper 竞争** — Klipper 的高速增长对 Marlin 造成竞争压力，但 Marlin 仍凭借硬件兼容性保持最大份额
4. **Input Shaper 实验性支持** — Marlin 2.1.x 开始实验性集成 Input Shaper
5. **Marlin 持续走向模块化** — 通过分离的 feature 模块实现更灵活的配置
6. **OEM 定制化** — 创想三维等厂商持续推出基于 Marlin 的定制固件分支

---

## 5. 市场定位

### 5.1 主要应用场景

| 场景 | 硬件 | 典型用户 |
|------|------|---------|
| 入门级 3D 打印 | Ender 3、Ender 5、Anycubic Mega | 初学者、爱好者 |
| 中端 DIY 打印 | Voron 改造、自组装 | 中级爱好者 |
| 高端 Delta 打印 | FLSUN、Anycubic Kobra | Delta 爱好者 |
| 工业原型 | 小型制造、快速原型 | 工程师 |
| 教育 | 学校/大学 3D 打印实验室 | 教育工作者 |
| 商业 OEM | 打印机厂商出厂固件 | OEM 厂商 |

### 5.2 竞争对手对比

| 维度 | Marlin | Klipper | RepRapFirmware | Smoothieware |
|------|--------|---------|----------------|-------------|
| 架构 | 单芯片 MCU | Host + MCU 分布式 | 单芯片 MCU | 单芯片 MCU |
| 硬件要求 | Arduino 兼容主板 | RPi + 任意 MCU | Duet 主板 | LPC176x 主板 |
| 实时性 | ISR 中断（硬实时） | Python + C（软实时） | ISR 中断 | ISR 中断 |
| 步进精度 | Bresenham DDA | 25us itersolve | 有限 | 有限 |
| 配置方式 | 编译时宏 | 运行时 cfg 文件 | 运行时 config.g | 编译时配置 |
| 调平方式 | ABL/UBL/3P/Mesh | BLTouch/Adaptive Mesh | 多种 | 有限 |
| 输入整形 | 实验性 | 原生（6 种 shaper） | 无 | 无 |
| 宏系统 | 有限（G-code） | Jinja2 强大 | 有限 | 有限 |
| Web 控制 | OctoPrint 外挂 | Moonraker + UI | Duet 内置 | 无 |
| 社区 | 最大（16k Stars） | 增长最快（12k Stars） | 中等 | 基本停止 |
| 安装复杂度 | 低（编译烧录） | 中（需 RPi 设置） | 低（Duet 专用板） | 低 |
| 维护状态 | 活跃 | 极活跃 | 活跃 | 停止 |

### 5.3 Marlin 的独特市场定位

Marlin 的核心优势是 **"最简单、最省心、最广泛"**：

1. **最简单** — 仅需编译烧录一颗 MCU，无需额外硬件（Raspberry Pi）
2. **最省心** — 14 年积累的稳定性和可靠性，社区经验丰富
3. **最广泛** — 支持数百种主板，覆盖几乎所有常见 3D 打印机
4. **最低成本** — 8 位 AVR 板加 Arduino 线即可运行，总成本低至 20 美元

---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **最广泛的硬件兼容性**：
   - 从 8 位 AVR 到 32 位 ARM Cortex，支持 200+ 种主板
   - 厂商通常直接使用 Marlin 作为出厂固件
   - 更新新主板只需要添加 `pins.h` 配置文件

2. **成熟稳定的代码库**：
   - 14 年持续开发，数十万次实际部署
   - 热失控保护、看门狗、软限位等安全机制完善
   - 大量用户的反馈和测试

3. **丰富的配置选项**：
   - 2000+ 个可配置项
   - 几乎涵盖了所有 3D 打印机的需求
   - 灵活的条件编译系统

4. **Arduino 生态兼容**：
   - 基于 Arduino 框架，学习成本低
   - 使用熟悉的 Arduino IDE 或 PlatformIO
   - 便于修改和定制

5. **最大的社区支持**：
   - 16,000+ Stars、19,000+ Forks
   - 大量的教程、视频、配置示例
   - 官方配置库覆盖 200+ 种打印机

### 6.2 标志性功能或设计理念

- **"单芯片一切"的设计哲学** — 所有功能集成在同一颗 MCU 上，最小化硬件成本
- **"Configuration.h"编译器配置** — 通过宏定义配置，配置即代码
- **"Bresenham 步进算法"** — 从 grbl 继承的经典整数 DDA 算法
- **"Marlin 热失控保护"** — 已成为 3D 打印机安全的事实标准
- **"Unified Bed Leveling"** — Marlin 的网格调平系统

### 6.3 设计局限与教训

1. **编译时配置** — 每次修改参数都需要重新编译烧录，迭代周期长
2. **单芯片性能瓶颈** — 8 位 AVR 的 16MHz 主频和 2KB SRAM 限制了很多高级功能
3. **无原生插件系统** — 扩展功能必须修改核心代码
4. **中断负载** — 步进 ISR 和温度 ADC 中断争抢 CPU 时间
5. **Input Shaper 缺失** — 相比 Klipper，Marlin 的振动抑制能力有限

---

## 7. 对 AUDESYS 的参考价值

### 7.1 单芯片一体式架构的参考

Marlin 的单芯片一体式架构是 **极简嵌入式控制系统的标杆案例**：

```
Marlin 的单芯片架构（8-bit AVR）:
  1 颗 MCU: ATmega2560 (16MHz, 256KB Flash, 8KB SRAM)
  -> G-code 解析 + 运动规划 + 步进控制 + 温度控制 + LCD 显示 + SD 卡读取
  -> 全部在 8KB SRAM 内完成
  -> 2011-2020 年占据 3D 打印固件 90%+ 市场份额
```

**AUDESYS 参考**: AUDESYS HAL 在嵌入式 MCU 侧的设计可参考 Marlin 的极简模式：

- 在资源受限的 MCU 上，用中断 ISR 实现精确的定时控制
- 使用整数运算（Bresenham DDA）替代浮点运算，降低计算需求
- 保持 MCU 固件的扁平化设计，避免过度抽象

### 7.2 步进电机 ISR 中断驱动设计

Marlin 的步进控制和 ISR 架构对 AUDESYS HAL 的实时层设计有直接参考价值：

```
Marlin ISR 结构:
  Timer Interrupt (TIMER0_COMPA_vect)
    -> stepper.cpp ISR handler
      -> Bresenham DDA 算法选择步进轴
      -> step pin 切换
      -> 调度下一个中断时间
      -> 位置更新

AUDESYS HAL 实时层参考:
  RT Timer Interrupt
    -> HalTransport 数据采样
    -> Signal 最新值更新
    -> 周期 deadline 检查
    -> 调度下一周期
```

**关键参考点**：

1. **ISR 的简洁性** — Marlin 的步进 ISR 非常精简，执行时间 < 5us
2. **定时器级联** — 使用多个定时器实现不同优先级的中断
3. **中断优先级** — 步进 ISR 优先级最高，温度 ADC 次之，LCD 更新最低
4. **无阻塞** — ISR 中不允许任何阻塞操作

### 7.3 PID 温度控制

Marlin 的 PID 温度控制是 AUDESYS HAL 的 `temperature` 模块的最佳参考实现：

```cpp
// Marlin PID -> AUDESYS HAL 温度控制模块参考
// AUDESYS HAL 的 PID 温度控制器设计
pub struct PIDController {
    kp: f32,
    ki: f32,
    kd: f32,
    i_term: f32,
    last_error: f32,
    output_min: f32,
    output_max: f32,
}

impl PIDController {
    pub fn update(&mut self, setpoint: f32, input: f32) -> f32 {
        let error = setpoint - input;
        self.i_term += error;
        // 积分限幅 (anti-windup)
        self.i_term = self.i_term.clamp(self.output_min, self.output_max);

        let output = self.kp * error
                   + self.ki * self.i_term
                   + self.kd * (error - self.last_error);

        self.last_error = error;
        output.clamp(self.output_min, self.output_max)
    }
}
```

**Marlin PID 的关键设计特点**：
- 积分限幅（Integral Anti-windup）
- 输出限幅到 PWM 范围
- 多路 PID 并行（热端 + 热床）
- 定时器触发 ADC 采样（50-100Hz）

### 7.4 Configuration.h 宏配置系统

Marlin 的 `Configuration.h` 编译时配置系统对 AUDESYS 的配置设计有参考价值：

| Marlin 配置方式 | 优点 | 缺点 | AUDESYS 参考 |
|----------------|------|------|-------------|
| 编译时宏 #define | 零运行时开销 | 每次修改需编译 | 核心参数（如 PIN 映射）可编译时确定 |
| 条件编译 #ifdef | 代码裁剪 | 配置复杂度高 | 模块化编译时可选择性地包含功能 |
| 2000+ 配置项 | 灵活性极高 | 新手配置困难 | 设计合理的默认值 + 可选高级配置 |

**AUDESYS 参考**: AUDESYS 的配置系统可以借鉴 Marlin 的"编译时裁剪 + 运行时参数"分层：

- **编译时层**: HAL 的 PIN 映射、RT 参数、硬件配置（零开销）
- **运行时层**: 控制逻辑参数、通信参数、HMI 参数（Flexible）

### 7.5 Marlin 与 AUDESYS HAL 的详细对比

| 维度 | Marlin | AUDESYS HAL（设计） |
|------|--------|-------------------|
| 架构 | 单芯片 MCU 一体式 | 分布式 Host + HAL MCU |
| 目标 | 3D 打印机运动控制 | 工业控制系统通信/仿真 |
| 步进控制 | Bresenham DDA ISR | 通过 HalTransport 的步进/信号原语 |
| 温度控制 | PID 中断控制 | 通过 HAL 的 temperature 模块 |
| 运动学 | 6 种（Cartesian/CoreXY/Delta/SCARA） | 不直接提供（上层的 Runtime 实现） |
| 配置方式 | Configuration.h 编译时宏 | YAML (开发) + FlatBuffers (运行时) |
| 硬件抽象 | HAL 层（AVR/STM32/LPC/Teensy） | HalTransport + HalDiscovery + HalQoS |
| 实时性 | 硬件 ISR 中断，硬实时 | 分层延迟（< 1us / ~10us / ~100us） |
| 扩展性 | 修改核心代码 | 动态加载 + 脚本引擎 |
| 多语言 | C++（Arduino） | Rust + C++ + 15 种语言（分层） |
| 通信 | 串口 G-code 协议 | FlatBuffers over UDS/Zenoh |

### 7.6 核心参考价值总结

Marlin 为 AUDESYS 提供了三个层面的参考价值：

1. **嵌入式实时控制的极简范式**：Marlin 在 8 位 AVR（8KB SRAM）上实现了完整的 3D 打印机控制系统，证明了在资源受限的 MCU 上实现确定性实时控制是可行的。AUDESYS HAL 的 MCU 侧设计应参考 Marlin 的 ISR 驱动架构，保持核心代码的简洁性和确定性。

2. **PID 温度控制的参考实现**：Marlin 的 PID 温度控制器经过了数万次实际部署的验证，其积分限幅、热失控保护、多路 PID 并行等设计可直接作为 AUDESYS HAL 温度模块的参考。

3. **配置系统的教训**：Marlin 的 `Configuration.h` 配置系统虽然灵活，但 2000+ 配置项和编译时修改的复杂度是新手的主要痛点。AUDESYS 应采用"编译时核心裁剪 + 运行时灵活配置"的分层设计，避免 Marlin 的配置复杂度问题。

---

> **本文档基于 2026 年 7 月的公开信息编写。部分数据（如 GitHub Stars、版本号）可能随 Marlin 版本迭代而变化。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从官方仓库验证。**