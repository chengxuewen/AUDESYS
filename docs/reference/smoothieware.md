# Smoothieware

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: Smoothieware（简称 Smoothie）
- **开发商/组织**: 社区驱动开发，由 **Arthur Wolf**（SmoothieProject 创始人）发起，核心贡献者包括 **Jim Morris**（wolfmanjm，V2 主要开发者）、**Michael Moon**（triffid）等志愿者团队
- **首次发布年份**: 2011 年（最初作为 LPC1768 平台的 G-code 解释器），2012 年正式开源发布
- **当前版本**:
  - Smoothieware V1: 稳定版（edge 分支），最后活跃提交约 2021 年，已进入维护期
  - Smoothieware V2: 开发中，基于 STM32H745（2023 年首批出货），持续更新中（2026 年仍有活跃开发）
- **仓库地址**:
  - V1（经典版）: https://github.com/Smoothieware/Smoothieware（edge 分支，~4,363 commits）
  - V2: https://github.com/Smoothieware/SmoothieV2（STM32H745 重写）
  - SmoothieBoard 硬件: https://github.com/Smoothieware/SmoothieBoard
- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **社区**: https://smoothieware.org/，https://forum.makerforums.info/c/smoothie

### 1.2 产品定位与核心价值主张

Smoothieware 定位为 **模块化、高性能、开源 CNC 控制器固件**，其核心价值主张是：

1. **模块化设计** — 通过事件驱动模块系统，在不修改核心代码的情况下扩展功能
2. **无需编译即可配置** — 使用 config.txt 文件配置几乎所有参数，无需重新编译固件
3. **高性能 32 位运动控制** — 基于 LPC1769（120MHz Cortex-M3）或 STM32H745（480MHz Cortex-M7）实现高精度步进电机控制
4. **硬件平台无关性** — 支持多种 LPC17xx 和 STM32H7 硬件平台
5. **多用途** — 支持 3D 打印、CNC 铣削、激光切割、等离子切割等多种数控应用

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| 3D 打印爱好者 | FDM 打印机控制、多色打印、自动调平 | 无需编译配置、大量社区配置示例 |
| CNC 创客 | 桌面铣床、雕刻机、激光切割机 | 高精度步进控制、Spindle/Laser 模块 |
| 开源硬件开发者 | 基于 SmoothieBoard 的定制数控系统 | 模块化扩展、事件 API |
| 教育机构 | 数控技术教学、运动控制实验 | 代码可读性、文档完整性 |
| 小型制造商 | 小批量生产、快速原型 | 稳定可靠、多轴支持 |
| 固件开发者 | 定制模块开发、功能扩展 | 模块 API、事件系统 |

### 1.4 许可证模型

- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **商业模型**: 开源免费，通过 SmoothieBoard 硬件销售获得收入
- **封闭组件**: 无 — 完全开源
- **OEM 考虑**: GPL-3.0 要求衍生作品同样开源，商业嵌入式场景需注意许可证合规性

---

## 2. 技术特性

### 2.1 核心架构

Smoothieware 采用 **模块化事件驱动架构（Modular Event-Driven Architecture）**，由 Kernel（内核）统一管理模块注册和事件分发：

```
+------------------------------------------------------------+
|                   Smoothieware Kernel                       |
|  (libs/Kernel.h) - 中央调度器，管理模块生命周期和事件总线    |
+------------------------------------------------------------+
|                                                            |
|  +------------------+  +-------------------+              |
|  | 通信模块          |  | 运动控制模块       |              |
|  | SerialConsole    |  | Robot             |              |
|  | GcodeDispatch    |  | Planner           |              |
|  | Network          |  | Conveyor          |              |
|  | Player (SD卡)    |  | Stepper           |              |
|  +------------------+  +-------------------+              |
|                                                            |
|  +------------------+  +-------------------+              |
|  | 工具模块          |  | 辅助模块          |              |
|  | Extruder         |  | Endstops          |              |
|  | TemperatureCtrl  |  | ZProbe            |              |
|  | Laser            |  | Switch            |              |
|  | Spindle          |  | Panel (LCD)       |              |
|  +------------------+  +-------------------+              |
|                                                            |
+------------------------------------------------------------+
```

#### V1 架构（LPC1769，裸机事件驱动）

V1 使用 **裸机 superloop** 架构，核心是事件总线（Event Bus）：

```
+G-code 输入流 (USB/Serial/SD) -> SerialConsole
  | 触发 on_console_line_received 事件
  v
GcodeDispatch 模块
  | 解析 G-code 为 Gcode 对象
  | 触发 on_gcode_received 事件
  v
Robot 模块
  | 将目标位置转换为线段
  | 应用运动学反解 (Arm Solution)
  | 调用 append_milestone()
  v
Planner 模块
  | 创建 Block 对象（含速度、方向、加速度信息）
  | 重新计算队列中所有 Block 的加速度曲线（look-ahead）
  | 将 Block 加入队列
  v
Conveyor 模块
  | 管理 Block 队列的 FIFO 执行
  | 在 Block 实际执行时触发 on_gcode_execute 事件
  v
Stepper 模块
  | 加速循环：根据梯型曲线调整速度
  | 步进循环：生成 step/direction 信号
  | Timer ISR 驱动步进电机
  v
物理步进电机驱动器 (A5984/TMC2660)
```

#### V2 架构（STM32H745，FreeRTOS 多任务）

V2 改用 **FreeRTOS 多任务架构**，模块通过注册表（Module Registry）查找和通信：

```
+-------------------------------------------------------+
|  FreeRTOS Kernel                                       |
|  多任务调度 + 硬件定时器中断                            |
+-------------------------------------------------------+
|                                                       |
|  +------------------+  +-------------------+         |
|  | ConfigReader     |  | Module Registry   |         |
|  | INI 配置文件解析  |  | 模块注册表查找    |         |
|  +------------------+  +-------------------+         |
|                                                       |
|  +------------------+  +-------------------+         |
|  | StepTicker       |  | SlowTicker        |         |
|  | 步进定时器 (200kHz)|  | 慢速定时器 (1kHz)  |         |
|  +------------------+  +-------------------+         |
|                                                       |
|  +------------------+  +-------------------+         |
|  | Dispatcher       |  | Conveyor          |         |
|  | M-code 命令分发   |  | 运动队列管理      |         |
|  +------------------+  +-------------------+         |
+-------------------------------------------------------+
```

**V2 关键差异**：
- 模块使用 `REGISTER_MODULE` 宏注册，通过 `Module::lookup()` 查找
- 连续操作（如激光功率控制）使用 SlowTicker/FastTicker 回调，而非事件广播
- M-code 通过 `THEDISPATCHER->add_handler()` 注册类型安全处理器
- 模块可直接通过 `StepTicker::getInstance()->get_current_block()` 读取当前运动块

### 2.2 Kernel 与事件系统（V1）

Kernel 是 Smoothieware V1 的中央调度器，负责：

1. **模块管理**: 添加模块、调用模块的 `on_module_loaded()` 方法
2. **事件分发**: 维护事件总线，向所有注册的模块广播事件
3. **配置管理**: 通过 Config 模块读取 config.txt 配置缓存
4. **定时器管理**: SlowTicker（1Hz ~ 1kHz）、StepTicker（步进定时器）

```cpp
// Kernel 构造函数中的核心初始化流程
Kernel::Kernel() {
    // 1. 初始化串口（用于调试输出）
    this->serial = new SerialConsole(USBTX, USBRX, DEFAULT_SERIAL_BAUD_RATE);
    
    // 2. 加载配置缓存
    this->config = new Config();
    this->config->config_cache_load();
    
    // 3. 配置串口（根据 config.txt 中的设置）
    this->serial = new SerialConsole(USBTX, USBRX, 
        this->config->value(uart0_checksum, baud_rate_setting_checksum)
            ->by_default(DEFAULT_SERIAL_BAUD_RATE)->as_number());
    
    // 4. 添加核心模块
    this->add_module(this->slow_ticker = new SlowTicker());
    this->step_ticker = new StepTicker();
    this->adc = new Adc();
    
    // 5. 配置中断优先级（LPC17xx 特有）
    NVIC_SetPriority(TIMER0_IRQn, 2);  // 步进定时器 — 最高优先级
    NVIC_SetPriority(TIMER1_IRQn, 1);  // 加速定时器 — 最高优先级
    NVIC_SetPriority(TIMER2_IRQn, 4);
    NVIC_SetPriority(PendSV_IRQn, 3);
    
    // 6. 添加运动控制核心模块
    this->add_module(this->conveyor = new Conveyor());
    this->add_module(this->gcode_dispatch = new GcodeDispatch());
    this->add_module(this->robot = new Robot());
    this->add_module(this->simpleshell = new SimpleShell());
    this->planner = new Planner();
}
```

**V1 事件枚举**（定义在 `libs/Module.h` 中）：

| 事件名称 | 触发时机 | 参数 | 用途 |
|---------|---------|------|------|
| `ON_IDLE` | 主循环空闲时 | 无 | 低优先级周期性任务 |
| `ON_GCODE_RECEIVED` | G-code 从串口接收时 | `Gcode*` | 解析和处理 G-code 命令 |
| `ON_GCODE_EXECUTE` | Block 即将执行时 | `Gcode*` | 在正确的时序执行 G-code |
| `ON_SPEED_CHANGE` | 步进速度变化时 | `Stepper*` | 激光功率比例控制 |
| `ON_BLOCK_BEGIN` | Block 开始执行时 | `Block*` | 运动块开始 |
| `ON_BLOCK_END` | Block 完成执行时 | `Block*` | 运动块结束 |
| `ON_HALT` | 紧急停止时 | `void*` | 安全关闭设备 |
| `ON_ENABLE` | 使能/禁用步进电机 | `uint32_t` | 电机驱动控制 |
| `ON_SECOND_TICK` | 每秒一次 | 无 | 低频率状态检查 |
| `ON_PLAY` | 恢复执行 | 无 | 继续运动 |
| `ON_PAUSE` | 暂停执行 | 无 | 暂停运动 |

### 2.3 模块化设计

Smoothieware 的模块系统是其最核心的架构特征。V1 和 V2 采用不同的模块通信模型：

#### V1 模块模型：事件广播

V1 模块继承自 `Module` 基类，通过 `register_for_event()` 注册事件处理：

```cpp
class Laser : public Module {
public:
    Laser() : laser_pin(P2_0) {
        laser_pin.period_us(10);  // 100kHz PWM
    }

    void on_module_loaded() {
        // 注册事件处理器
        this->register_for_event(ON_GCODE_EXECUTE);
        this->register_for_event(ON_SPEED_CHANGE);
    }

    void on_gcode_execute(void* argument) {
        Gcode* gcode = static_cast<Gcode*>(argument);
        if (gcode->has_letter('G')) {
            int code = gcode->get_value('G');
            if (code == 0) {           // G0 = 快速移动
                this->laser_pin = 0;    // 关闭激光
                this->laser_on = false;
            } else if (code > 0 && code < 4) {  // G1/G2/G3 = 切削移动
                this->laser_on = true;
            }
        }
    }

    void on_speed_change(void* argument) {
        Stepper* stepper = static_cast<Stepper*>(argument);
        if (this->laser_on) {
            // 根据当前速度比例调整激光功率
            this->laser_pin = double(stepper->trapezoid_adjusted_rate)
                / double(stepper->current_block->nominal_rate);
        }
    }

private:
    PwmOut laser_pin;
    bool laser_on;
};
```

#### V2 模块模型：配置驱动 + 直接通信

V2 模块使用 `REGISTER_MODULE` 宏注册，通过配置驱动实例化：

```cpp
// V2 模块结构
class Laser : public Module {
public:
    Laser() {}

    // 配置驱动的方法
    bool configure(ConfigReader& cr) {
        ConfigReader::section_map_t m;
        if (!cr.get_section("laser", m)) return false;
        if (!cr.get_bool(m, "enable", false)) return false;

        // 读取配置
        pwm_pin = new Pwm(cr.get_string(m, "pwm_pin", "nc"));
        laser_maximum_power = cr.get_float(m, "maximum_power", 1.0f);

        // 注册 M-code 处理器
        THEDISPATCHER->add_handler(Dispatcher::MCODE_HANDLER, 221,
            std::bind(&Laser::handle_M221, this, _1, _2));

        // 注册定时器回调（比例功率控制）
        SlowTicker::getInstance()->attach(1000,
            std::bind(&Laser::set_proportional_power, this));

        return true;
    }

    // 定时器驱动的比例功率控制
    void set_proportional_power() {
        const Block* block = StepTicker::getInstance()->get_current_block();
        if (block != nullptr && block->is_ready && block->is_g123) {
            float requested_power = block->s_value / laser_maximum_s_value;
            float ratio = current_speed_ratio(block);
            set_laser_power(requested_power * ratio * scale);
        }
    }

private:
    Pwm* pwm_pin;
    float laser_maximum_power;
    float laser_minimum_power;
    float scale;
};

// 在特殊链接段注册模块
REGISTER_MODULE(Laser)
```

V2 模块注册表使用 `REGISTER_MODULE` 宏，将模块创建函数指针放置在特殊链接段（linker section），固件启动时自动遍历并调用：

```cpp
// 启动时遍历注册的模块
extern uint32_t __registered_modules_start;
extern uint32_t __registered_modules_end;
uint32_t* g_pfnModules = &__registered_modules_start;

while (g_pfnModules < &__registered_modules_end) {
    bool (*pfnModule)(ConfigReader&) = (bool (*)(ConfigReader&))*g_pfnModules;
    pfnModule(cr);  // 调用模块的创建函数
    g_pfnModules++;
}
```

### 2.4 运动控制管线

Smoothieware 的运动控制管线是从 GRBL 移植并演进的，核心包含四个阶段：

#### 阶段 1: Robot — G-code 到线段

```cpp
// Robot::append_milestone() — 将 G-code 目标位置转换为线段
bool Robot::append_milestone(const float target[], float rate_mm_s) {
    float transformed_target[n_motors];

    // 应用床补偿变换
    if (compensationTransform) {
        compensationTransform(transformed_target);
    }

    // 计算各轴位移
    for (size_t i = 0; i < n_motors; i++) {
        deltas[i] = transformed_target[i] - last_machine_position[i];
    }

    // 运动学反解：笛卡尔坐标 -> 执行器坐标
    ActuatorCoordinates actuator_pos;
    arm_solution->cartesian_to_actuator(transformed_target, actuator_pos);

    // 将线段传递给 Planner
    return THEKERNEL->planner->append_block(
        actuator_pos, n_motors, rate_mm_s, distance, unit_vec, acceleration, s_value, g123);
}
```

**运动学支持**：Robot 模块通过 `ArmSolution` 抽象层支持多种运动学模型：

| 运动学模型 | 类名 | 适用机器 |
|-----------|------|---------|
| 笛卡尔（Cartesian） | `CartesianSolution` | 标准 3 轴 CNC/3D 打印机 |
| 并联臂（Delta） | `DeltaSolution` | Delta 3D 打印机 |
| 铰接臂（Arm） | `ArmSolution` | 机械臂 |
| SCARA | `SCARASolution` | 平面关节机器人 |
| 线性 Delta（LinearDelta） | `LinearDeltaSolution` | 线性 Delta 打印机 |
| CoreXY/H-Bot | `CoreXY/HSolution` | CoreXY 运动系统 |

#### 阶段 2: Planner — 线段到 Block + 加速度前瞻

Planner 执行 GRBL 算法的核心 — 加速度前瞻（Look-ahead）：

```cpp
// Planner::append_block() — 创建 Block 并重新计算加速度曲线
bool Planner::append_block(ActuatorCoordinates& actuator_pos, ...) {
    Block* block = THECONVEYOR->queue.head_ref();

    // 计算各轴步数
    for (size_t i = 0; i < n_motors; i++) {
        int32_t steps = THEROBOT->actuators[i]->steps_to_target(actuator_pos[i]);
        block->direction_bits[i] = (steps < 0) ? 1 : 0;
        block->steps[i] = labs(steps);
    }

    // 计算名义速度（nominal speed）
    block->nominal_rate = block->steps_event_count * rate_mm_s / distance;

    // 计算 junction 速度（弯道速度限制）
    float cos_theta = -prev_unit_vec[X] * unit_vec[X]
                     - prev_unit_vec[Y] * unit_vec[Y]
                     - prev_unit_vec[Z] * unit_vec[Z];
    float sin_half_theta = sqrtf(0.5F * (1.0F - cos_theta));
    float vmax_junction = min(prev_nominal_speed, nominal_speed);
    vmax_junction = min(vmax_junction, sqrtf(acceleration * junction_deviation * sin_half_theta));

    return true;
}
```

**前瞻算法流程**：
1. 新增 Block 时，从队列尾部向前遍历，计算每个 Block 的最大入口速度（reverse_pass）
2. 然后从队列头部向后遍历，计算每个 Block 的最大出口速度（forward_pass）
3. 根据入口/出口速度计算梯型加速度曲线（calculate_trapezoid）
4. 重复直到所有 Block 的加速度曲线收敛

#### 阶段 3: Conveyor — Block 队列管理

Conveyor 管理 Block 的 FIFO 队列，确保 G-code 在正确的时间执行：

```cpp
// Conveyor 负责两点：
// 1. 将 G-code 字符串附加到最新的 Block 上
// 2. 当 Block 从队列中弹出时，触发 on_gcode_execute 事件
//
// 这样 G-code 中的 M-code（如 M106 风扇开）会在对应的运动
// 即将执行时被触发，而非在接收到时就执行
```

**关键设计**：G-code 的接收和执行分离。`on_gcode_received` 在接收时触发（用于准备），`on_gcode_execute` 在 Block 实际执行时触发（用于真正的操作）。

#### 阶段 4: Stepper — 步进信号生成

Stepper 模块是 Smoothieware 最关键的实时部分，包含两个循环：

1. **加速循环（Acceleration Loop）** — 以固定频率（`ACCELERATION_TICKS_PER_SECOND`）运行，调整步进速度：

```cpp
void Stepper::trapezoid_generator_tick(void) {
    if (this->current_block && !this->paused && this->main_stepper->moving) {
        uint32_t current_steps = this->main_stepper->stepped;

        if (current_steps <= this->current_block->accelerate_until) {
            // 加速阶段
            this->trapezoid_adjusted_rate += this->current_block->rate_delta;
        } else if (current_steps > this->current_block->decelerate_after) {
            // 减速阶段
            this->trapezoid_adjusted_rate -= this->current_block->rate_delta;
        } else if (trapezoid_adjusted_rate != current_block->nominal_rate) {
            // 匀速阶段
            this->trapezoid_adjusted_rate = this->current_block->nominal_rate;
        }
    }
}
```

2. **步进循环（Stepping Loop）** — 由硬件定时器中断驱动，实际生成 step/direction 信号：

```
步进循环伪代码：
while (有 Block 在执行) {
    for (每个运动轴) {
        if (该轴需要步进) {
            设置 step pin = HIGH
            等待微秒级的脉冲宽度
            设置 step pin = LOW
        }
    }
    等待下一个步进定时器中断
}
```

### 2.5 配置系统

Smoothieware 最创新的特性之一是 **无需编译的配置系统**：

#### V1 配置格式（config.txt）

```
# 运动控制模块
default_feed_rate                             4000     # 默认进给速度 (mm/min)
default_seek_rate                             4000     # 默认快速移动速度 (mm/min)
acceleration                                  3000     # 加速度 (mm/s²)
junction_deviation                            0.05     # 弯道速度限制参数

# 步进电机配置
alpha_steps_per_mm                            80       # X 轴步数/mm
beta_steps_per_mm                             80       # Y 轴步数/mm
gamma_steps_per_mm                            2560     # Z 轴步数/mm
alpha_max_rate                                30000    # X 轴最大速度 (mm/min)

# 挤出机配置
extruder.hotend.enable                        true
extruder.hotend.steps_per_mm                  140
extruder.hotend.default_feed_rate             600

# 温度控制配置
temperature_control.hotend.enable             true
temperature_control.hotend.thermistor_pin     0.23
temperature_control.hotend.heater_pin         2.7
temperature_control.hotend.set               185       # 目标温度 185°C

# 限位开关配置
endstops_enable                               true
alpha_homing_direction                        home_to_min
beta_homing_direction                         home_to_min
gamma_homing_direction                        home_to_min

# 网络配置
network.enable                                true
network.ip                                    dhcp       # 自动获取 IP
```

#### V2 配置格式（config.ini，INI 格式）

```
[general]
machine_name = My 3D Printer

[system]
baud_rate = 115200

[motion control]
default_feed_rate = 4000
default_acceleration = 1000.0

[actuator]
alpha.steps_per_mm = 80
beta.steps_per_mm = 80
gamma.steps_per_mm = 2560

[tmc2660]
cs = 0.7
microsteps = 32

[laser]
enable = true
pwm_pin = 2.0
maximum_power = 1.0
```

**配置系统实现原理**：V1 使用 checksum 机制（编译时计算配置键名的 CRC32 校验和），在运行时无需字符串比较即可快速查找配置值：

```cpp
// Config 模块通过 checksum 快速查找配置值
// checksum 是配置键名的 CRC32 值，在编译时计算
// 运行时仅比较 32 位整数，无需字符串解析
float steps_per_mm = THEKERNEL->config->value(
    alpha_steps_per_mm_checksum  // 编译时计算的 CRC32
)->by_default(80.0f)->as_number();
```

### 2.6 支持的硬件/平台

#### 主控芯片

| 版本 | 主控芯片 | 架构 | 频率 | Flash | RAM | 状态 |
|------|---------|------|------|-------|-----|------|
| V1 | NXP LPC1769 | ARM Cortex-M3 | 120MHz | 512KB | 64KB | ✅ 稳定 |
| V1 | NXP LPC1768 | ARM Cortex-M3 | 96MHz | 512KB | 64KB | ✅ 兼容 |
| V2 | STM32H745 | Dual Cortex-M7+M4 | 480MHz+240MHz | 2MB | 1MB | ✅ 活跃开发 |
| V2（取消） | LPC4330 | Cortex-M4+M0 | 204MHz | 8MB | 264KB | ❌ 因芯片短缺取消 |

#### 步进电机驱动

| 驱动芯片 | 版本 | 最大微步 | 特性 |
|---------|------|---------|------|
| A5984 | V1 | 1/32 | 成熟可靠、成本低 |
| TMC2660 | V2 | 1/256 | 高精度、低噪音 |
| TMC2590 | V2 | 1/256 | 同 TMC2660，备选方案 |
| Heroic | V2-mini（取消） | 1/128 | 取消 |

#### 硬件平台

| 平台 | 版本 | 特点 | 状态 |
|------|------|------|------|
| SmoothieBoard V1 (3X/4X/5X) | V1 | LPC1769, 3-5 轴驱动, A5984 | ✅ 生产中 |
| SmoothieBoard V2 Prime | V2 | STM32H745, 4 轴驱动, TMC2660, 以太网 | ✅ 2023 年出货 |
| SmoothieBoard V2 Mini | V2（取消） | LPC4330, 低成本 | ❌ 取消 |
| SmoothieBoard V2 Pro | V2（取消） | LPC4330+FPGA, 高端 | ❌ 取消 |
| mBed LPC1768 | V1 | 开发板, 原型验证 | ✅ 兼容 |
| LPCXpresso | V1 | NXP 开发板 | ✅ 兼容 |
| 自定义 LPC17xx 板 | V1 | 用户自制硬件 | ✅ 兼容 |

#### V2 Prime 详细规格

| 规格 | V1 (3X) | V1 (4X) | V1 (5X) | V2 Prime |
|------|---------|---------|---------|----------|
| MCU | LPC1769 | LPC1769 | LPC1769 | STM32H745 |
| 时钟 | 120MHz | 120MHz | 120MHz | 480+240MHz |
| Flash | 512KB | 512KB | 512KB | 2MB |
| RAM | 64KB | 64KB | 64KB | 1MB |
| 步进驱动 | 3 × A5984 | 4 × A5984 | 5 × A5984 | 4 × TMC2660/2590 |
| 最大微步 | 1/32 | 1/32 | 1/32 | 1/256 |
| 静音 | 否 | 否 | 否 | 是 (StealthChop2) |
| 以太网 | 是 | 是 | 是 | 是 (Fast Ethernet) |
| USB | 1 × USB-B | 1 × USB-B | 1 × USB-B | 2 × (USB-B + USB-A) |
| SD 卡 | SPI | SPI | SPI | SDIO (高速) |
| 扩展口 | 标准排针 | 标准排针 | 标准排针 | 8 × Gadgeteer |

### 2.7 通信与接口

| 接口 | 协议 | 用途 |
|------|------|------|
| USB | 复合设备（Serial + Mass Storage） | G-code 发送 + SD 卡文件访问 |
| 以太网 (V1) | TCP/IP | 网络接口、Web 界面 |
| 以太网 (V2) | Fast Ethernet + TCP/IP | Web 界面、FTP、Telnet、WebSocket |
| SD 卡 | SPI (V1) / SDIO (V2) | 配置存储、G-code 文件执行 |
| GPIO | 数字 I/O | 限位开关、探针、继电器 |
| ADC | 模拟输入 | 热敏电阻、电压监测 |
| PWM | 脉宽调制 | 加热器、激光、主轴控制 |
| SPI | 串行外设接口 | TMC 驱动通信、SD 卡 (V1) |
| I2C | 串行总线（待确认） | 扩展外设 |
| UART | 串口 | 调试、外部 LCD 面板 |

---

## 3. 功能概览

### 3.1 主要功能模块

#### 核心运动控制模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Robot | `src/modules/robot/Robot.cpp` | G-code 解析、运动学计算、线段生成 |
| Planner | `src/modules/robot/Planner.cpp` | Block 队列管理、加速度前瞻计算 |
| Conveyor | `src/modules/robot/Conveyor.cpp` | 运动队列的 FIFO 执行、G-code 时序控制 |
| Stepper | `src/modules/robot/Stepper.cpp` | 步进信号生成、梯型加速度曲线控制 |
| StepTicker | `src/libs/StepTicker.cpp` | 高频步进定时器（默认 100kHz） |
| SlowTicker | `src/libs/SlowTicker.cpp` | 低频定时器服务（1Hz ~ 1kHz） |

#### 通信模块

| 模块 | 文件 | 职责 |
|------|------|------|
| SerialConsole | `src/modules/communication/SerialConsole.cpp` | USB/串口通信 |
| GcodeDispatch | `src/modules/communication/GcodeDispatch.cpp` | G-code 解析和分发 |
| Network | `src/modules/communication/Network.cpp` | 以太网通信（V2：FTP/WebSocket/Telnet） |
| Player | `src/modules/communication/Player.cpp` | SD 卡 G-code 文件播放 |

#### 工具模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Extruder | `src/modules/tools/extruder/Extruder.cpp` | 3D 打印挤出机控制 |
| TemperatureControl | `src/modules/tools/temperaturecontrol/` | 加热器 PID 控制、热敏电阻读取 |
| Laser | `src/modules/tools/laser/Laser.cpp` | 激光功率比例控制 |
| Spindle | `src/modules/tools/spindle/Spindle.cpp` | CNC 主轴转速控制 |
| Switch | `src/modules/tools/switch/Switch.cpp` | 通用 I/O 开关（风扇、冷却液等） |
| Endstops | `src/modules/tools/endstops/Endstops.cpp` | 限位开关和归零 |
| ZProbe | `src/modules/tools/zprobe/ZProbe.cpp` | 自动调平探针 |
| Scanner | `src/modules/tools/scanner/` | 3D 扫描支持（待确认） |

#### 辅助模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Panel | `src/modules/tools/panel/Panel.cpp` | LCD 面板和旋转编码器 |
| CurrentControl | `src/modules/tools/currentcontrol/` | 数字步进电机电流控制 |
| KillButton | `src/modules/tools/killbutton/` | 软件紧急停止 |
| SimpleShell | `src/modules/utils/SimpleShell.cpp` | 命令行调试 shell |

### 3.2 关键工作流

#### 工作流：G-code 执行管线

```
1. 串口接收 G-code 行
   SerialConsole 触发 on_console_line_received 事件

2. GcodeDispatch 解析
   解析 G/M/T/S 代码，创建 Gcode 对象
   触发 on_gcode_received 事件

3. Robot 处理
   如果是运动命令（G0/G1/G2/G3）：
     计算目标位置
     应用运动学反解（Cartesian -> Actuator）
     调用 append_milestone() 传递给 Planner
   如果是非运动命令（M106/M104 等）：
     附加到最近的运动 Block 上

4. Planner 创建 Block
   创建 Block 对象，设置步数/方向
   计算加速度曲线
   重新计算队列中所有 Block 的加速度（look-ahead）
   将 Block 加入队列

5. Conveyor 执行
   从队列头部弹出 Block
   触发 on_gcode_execute 事件（执行附加的 G-code）
   通知 Stepper 开始执行

6. Stepper 步进
   加速循环：根据梯型曲线调节速度
   步进循环：生成 step/direction 脉冲
   完成所有步数后释放 Block

7. 完成
   触发 on_gcode_execute 事件（清除操作）
   返回 OK 给主机
```

#### 工作流：自动调平（Z-Probe）

```
1. 主机发送 G29 或 G30 命令
2. GcodeDispatch 接收，触发 on_gcode_received 事件
3. ZProbe 模块接收 G29/G30 命令
4. ZProbe 控制 Robot 移动到探测点
5. ZProbe 向床面方向移动，直到触发探针信号
6. 记录触发时的 Z 坐标
7. 抬升探针，移动到下一个探测点
8. 所有点探测完成后，计算床面补偿矩阵
9. 设置 Robot 的 compensationTransform 回调函数
10. 后续打印中，每段运动 XYZ 坐标自动经过补偿变换
```

#### 工作流：定时器驱动模块（V2 激光实例）

```
1. 配置加载时，Laser 模块注册 SlowTicker 回调（1kHz）
2. 每次 G1/G2/G3 命令执行时，s_value（功率值）存储在 Block 中
3. SlowTicker 每 1ms 调用 Laser::set_proportional_power()
4. 该函数通过 StepTicker 获取当前正在执行的 Block
5. 读取 Block 中的 s_value 和当前速度比例
6. 计算实际功率 = 请求功率 × 速度比例 × 缩放因子
7. 设置 PWM 脉宽到实际功率值
8. 这样在加速阶段激光功率自动降低，匀速阶段恢复
```

### 3.3 G-code 事件执行时序

Smoothieware 的 G-code 时序模型是理解其行为的关键：

```
时间线 →
  |
  | G1 X100 F600 (移动到 X100，速度 600mm/min)
  | G4 P1000 (暂停 1 秒)
  | M106 S128 (设置风扇速度 50%)
  |
  v

接收时刻：
  |-- G1 X100 --> 进入 Planner 队列
  |-- G4 P1000 --> 附加到 Block 1
  |-- M106 S128 --> 附加到 Block 2（因为 G4 后才有空队列）

执行时刻：
  |-- Block 1 开始执行
  |     |-- Stepper 开始步进 X 轴
  |     |-- G4 的 on_gcode_execute 触发 -> 暂停 1 秒
  |     |-- Stepper 继续步进
  |     |-- Block 1 完成
  |-- Block 2 开始执行
  |     |-- 无运动（纯 M-code）
  |     |-- M106 的 on_gcode_execute 触发 -> 设置 PWM
  |     |-- Block 2 完成
```

**G-code 队列重排优化**：非运动 G-code（如 M104 设置温度）可以提前执行，不需要等到 Block 队列清空。这通过 `append_gcode()` 方法实现：

```cpp
// 在 GcodeDispatch 中
if (gcode->has_m && (gcode->m == 104 || gcode->m == 140)) {
    // 温度设置 - 立即执行，不等待队列
    THEKERNEL->call_event(ON_GCODE_RECEIVED, gcode);
} else {
    // 其他 G-code - 附加到最后一个 Block
    THEKERNEL->conveyor->append_gcode(gcode);
}
```

### 3.4 扩展机制

Smoothieware 的扩展主要通过三种方式实现：

#### 1. 编写新模块（V1）

1. 继承 Module 基类
2. 在构造函数中注册事件处理器
3. 实现事件回调方法
4. 将模块添加到 `src/makefile` 的编译列表

```cpp
// 步骤 1-3：创建模块类
class MyModule : public Module {
public:
    MyModule() {}
    void on_module_loaded() {
        this->register_for_event(ON_GCODE_RECEIVED);
        this->register_for_event(ON_IDLE);
    }
    void on_gcode_received(void* argument) {
        Gcode* gcode = static_cast<Gcode*>(argument);
        // 处理自定义 G-code
    }
    void on_idle(void* argument) {
        // 周期性任务
    }
};
```

#### 2. 编写新模块（V2）

1. 继承 Module 基类
2. 实现 `configure(ConfigReader&)` 方法
3. 使用 `REGISTER_MODULE` 宏注册
4. 在 config.ini 中添加对应配置节

```cpp
// 模块自动注册示例
REGISTER_MODULE(MyCustomModule)
```

#### 3. 编译时排除/包含模块

通过 makefile 的 `EXCLUDE_MODULES` 变量控制编译时包含的模块：

```makefile
# 为 3D 打印机编译（包含挤出机、温度控制）
EXCLUDE_MODULES =

# 为 CNC 铣床编译（排除挤出机、温度控制）
EXCLUDE_MODULES = tools/temperaturecontrol tools/extruder

# 为激光切割机编译（包含激光，排除挤出机）
EXCLUDE_MODULES = tools/temperaturecontrol tools/extruder

# 编译命令
make AXIS=4 CNC=1  # CNC 模式，4 轴
make AXIS=3        # 3D 打印机模式，3 轴
```

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| V1 GitHub Stars | ~1,400 |
| V2 GitHub Stars | ~40 |
| V1 Forks | ~1,000 |
| V1 Commits | ~4,363 |
| 主要开发语言 | C++（V1 和 V2） |
| V1 最后活跃提交 | 约 2021 年（edge 分支） |
| V2 状态 | 活跃开发中（2026 年仍有更新） |
| V2 硬件状态 | SmoothieBoard V2 Prime 2023 年出货 |

### 4.2 社区规模/用户基数

- **论坛**: https://forum.makerforums.info/c/smoothie（Maker Forums 的 Smoothie 板块）
- **文档网站**: http://smoothieware.org/（维基百科风格，V1 和 V2 双版本文档）
- **硬件销售**: SmoothieBoard 通过多家分销商销售（如 robosprout.com）
- **用户基数**: 数千名活跃用户（基于 SmoothieBoard 销售量和社区讨论量估算）
- **典型用户**: 3D 打印爱好者、CNC 创客、激光切割用户

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **SmoothieBoard V1** | LPC1769 控制器板，3/4/5 轴版本，A5984 驱动 |
| **SmoothieBoard V2 Prime** | STM32H745 控制器板，TMC2660 驱动，2023 年出货 |
| **SmoothieBoard V2 扩展板** | 6 轴扩展板、双向电平转换器等 Gadgeteer 扩展 |
| **Web 界面** | 以太网 Web 控制面板（Smoothie Webif） |
| **Panel 模块** | 多种 LCD 面板支持（2004 字符屏、图形屏等） |
| **第三方固件分支** | 基于 Smoothieware 的定制版本（如用于特定 3D 打印机） |
| **配置示例库** | ConfigSamples 目录包含数十种机器配置示例 |

### 4.4 历史演进与维护现状

Smoothieware 的发展可以分为三个阶段：

#### 阶段 1: 兴起（2011-2015）

- 2011 年：Arthur Wolf 发起项目，基于 GRBL 的运动控制算法
- 2012-2013 年：引入模块化设计、事件驱动架构
- 2014 年：Kickstarter 众筹 SmoothieBoard，获得大量关注
- 2015 年：SmoothieBoard 批量出货，社区快速增长

#### 阶段 2: 成熟（2016-2020）

- V1 固件功能完善，支持 3D 打印、CNC、激光切割
- 模块化架构成熟，大量第三方模块涌现
- 社区贡献者众多，累计 4,363 次提交
- config.txt 无需编译配置成为标志性特性

#### 阶段 3: 转型与停滞（2020-2022）

- **2020 年 COVID-19 芯片危机**：LPC4330 芯片全球短缺，V2 开发被迫终止
- **2020-2021 年**：V2 重新设计为 STM32H745，开发延迟
- **2021-2022 年**：V1 开发基本停滞，最后提交聚集在 2021 年
- **Klipper 快速崛起**：Klipper 的分布式架构（上位机 Linux + 下位机 MCU）成为更受欢迎的选择
- **原因分析**：
  - 芯片短缺导致 V2 硬件延迟 3 年以上
  - V1 的 LPC1769 在性能上无法与 Klipper 的 Raspberry Pi + MCU 组合竞争
  - 集中式（所有计算在 MCU）vs 分布式（复杂计算在 SBC）架构竞争失利
  - 核心维护者 burnout（社区志愿者项目常见问题）

#### 阶段 4: V2 复苏（2023-至今）

- 2023 年 5 月：SmoothieBoard V2 Prime 首批出货
- 2023-2026 年：V2 固件持续开发，Jim Morris（wolfmanjm）为主要开发者
- 2026 年：V2 新增 ELS（电子螺纹车床）模块、M4 协处理器可用、NTP 客户端、FTP 服务器
- 文档网站重写，增加 V1/V2 版本切换

### 4.5 停止维护的教训分析

Smoothieware V1 的维护停滞为开源工业控制项目提供了重要的教训：

#### 1. 单片式架构的性能天花板

```
Smoothieware V1:          Klipper:
+------------------+      +------------------+
| LPC1769 (120MHz) |      | Raspberry Pi 4   |
| 所有计算在 MCU    |      | (1.5GHz, 4核)    |
|                  |      | 复杂计算在 Linux  |
| 步进 + 运动学    |      | 上运行            |
| + G-code解析      |      |                   |
| + 温度控制        |      | MCU 仅执行步进    |
| + 网络通信        |      | 实时步进信号      |
| = CPU 瓶颈        |      | = 可扩展性强      |
+------------------+      +------------------+
```

**教训**：在 MCU 能力有限的情况下，单片式架构最终会达到性能天花板。分布式架构（复杂计算在 SBC，实时控制在小 MCU）提供了更好的扩展性。

#### 2. 硬件依赖风险

- Smoothieware 深度绑定 LPC17xx 系列 MCU
- 芯片短缺导致 V2 硬件开发延迟 3 年
- 供应链问题直接导致项目停滞
- **教训**：固件/软件项目应尽可能降低对特定硬件的依赖，或设计硬件抽象层

#### 3. 社区志愿者项目的可持续性

- 核心维护者（Arthur Wolf、Jim Morris）均为志愿者
- 无法保证持续的开发投入
- 无商业实体支持核心开发（硬件销售是收入来源，但不足以支撑全职开发）
- **教训**：开源工业控制项目需要可持续的商业模式，否则难以长期维护

#### 4. 竞争格局变化

| 固件 | 架构 | 性能 | 社区活跃度 | 维护状态 |
|------|------|------|-----------|---------|
| Smoothieware V1 | 单片 MCU | 中等 | 低 | 停滞 |
| Marlin | 单片 MCU | 低-中 | 高 | 活跃 |
| Klipper | 分布式 SBC+MCU | 高 | 极高 | 非常活跃 |
| GRBL | 单片 MCU | 低-中 | 中 | 稳定 |
| GRBLHAL | HAL 抽象 MCU | 中 | 中 | 活跃 |

#### 5. 长期维护的启示

1. **架构前瞻性**：设计时应考虑未来 5-10 年的性能需求
2. **硬件抽象**：通过 HAL 层降低对特定硬件的依赖
3. **社区 vs 商业**：确定项目是否有持续的商业支撑
4. **文档和交接**：核心开发者离开时，项目的知识和文档能否传承
5. **渐进式升级**：是否支持从旧版本平滑迁移到新版本

---

## 5. 市场定位

### 5.1 主要应用行业与场景

| 行业 | 典型应用 | 硬件平台 |
|------|---------|---------|
| 3D 打印 | FDM 打印机控制、多色打印、自动调平 | SmoothieBoard V1/V2 |
| CNC 铣削 | 桌面 CNC、雕刻机、小型零件加工 | SmoothieBoard + 外部驱动器 |
| 激光切割 | CO2 激光、二极管激光切割/雕刻 | SmoothieBoard + Laser 模块 |
| 等离子切割 | 小型金属切割 | SmoothieBoard + 外部驱动 |
| 教育 | 数控教学、运动控制实验 | mBed LPC1768 |
| 创客 | 自定义数控系统、机器人控制 | 自定义 LPC17xx 硬件 |

### 5.2 竞争对手对比

| 维度 | Smoothieware | Marlin | GRBL | Klipper | LinuxCNC |
|------|-------------|--------|------|---------|----------|
| 架构 | 单片 MCU | 单片 MCU | 单片 MCU | 分布式 SBC+MCU | PC 实时 Linux |
| 处理器 | LPC1769/STM32H7 | AVR/STM32 | AVR/STM32 | RPi + MCU | x86 PC |
| 最大步进频率 | 100kHz | ~100kHz | ~30kHz | 500kHz+ | 取决于硬件 |
| 配置方式 | 配置文件无需编译 | 编译时宏 | 编译时配置 | 配置文件 | 配置文件 |
| 模块化 | ✅ 事件驱动模块化 | ❌ 宏驱动的条件编译 | ❌ 单文件 | ⚠️ 部分模块化 | ✅ HAL 模块化 |
| 运动学支持 | 多运动学（6+） | 多运动学 | 仅笛卡尔 | 多运动学 | 多运动学 |
| 实时性 | 中断驱动 ISR | 中断驱动 ISR | 中断驱动 ISR | Linux 实时 + MCU ISR | PREEMPT_RT |
| 网络支持 | 以太网内置 | 需要扩展 | 通常无 | 以太网（上位机） | 以太网 |
| 社区活跃度 | 低（V1 停滞） | 高 | 中 | 非常高 | 中 |
| 维护状态 | V1 停滞，V2 开发中 | 活跃 | 稳定 | 非常活跃 | 稳定 |

### 5.3 历史地位评估

Smoothieware 在开源数控固件历史上具有独特的地位：

1. **第一个主流 32 位开源固件**：在 Marlin 和 GRBL 仍以 8 位 AVR 为主时，Smoothieware 率先采用 32 位 ARM Cortex-M3 处理器
2. **模块化设计的先驱**：Smoothieware 的事件驱动模块化架构在 2012 年领先于同类项目
3. **无需编译配置的推广者**：config.txt 配置文件概念（无需重新编译即可改变固件行为）后来被 Marlin 的 `MarlinUI` 和 Klipper 的配置文件借鉴
4. **硬件+软件一体化生态**：SmoothieBoard 硬件 + Smoothieware 固件的一体化模式，是开源数控硬件比较成功的商业化尝试
5. **32 位过渡的桥梁**：Smoothieware 证明了 32 位 MCU 在数控领域的可行性，为后来的 Klipper 等更复杂的系统铺平了道路

---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **真正的事件驱动模块化架构**：
   - 模块通过事件总线耦合，新增功能无需修改核心代码
   - 可动态注册/注销事件处理器
   - 模块之间完全解耦，仅通过 Kernel 事件总线通信

2. **无需编译的配置系统**：
   - 所有配置参数通过 config.txt 文件设置
   - 支持热修改（部分参数无需重启）
   - 配置校验和机制实现高效的运行时查找
   - 对用户极度友好 — 修改配置文件即可，无需开发环境

3. **32 位高性能运动控制**：
   - 120MHz Cortex-M3（V1）/ 480MHz Cortex-M7（V2）
   - 100kHz 步进频率（V1）/ 200kHz 步进频率（V2）
   - 浮点运算加速（V2 的 FPU）

4. **多运动学支持**：
   - 单一固件支持 6+ 种运动学模型
   - 通过 ArmSolution 抽象层，每种运动学模型是独立的模块
   - 用户无需修改核心代码即可切换运动学类型

5. **复合 USB 设备**：
   - 同时提供 Serial 和 Mass Storage 功能
   - 插入电脑即可识别为串口设备和 U 盘
   - 通过拖拽文件即可刷写固件（Drag and Drop flashing）

6. **内置以太网**：
   - 从 V1 就内置以太网支持（同代产品中少见）
   - Web 界面远程控制
   - 支持网络文件传输

### 6.2 标志性功能或设计理念

- **"模块化，而非单片"** — 通过事件驱动模块系统实现功能解耦
- **"配置即代码"** — 无需编译即可配置所有功能
- **"事件总线，而非函数调用"** — 模块间通过事件通信，而非直接调用
- **"从 GRBL 到 Smoothie"** — 证明 32 位 MCU 是数控固件的未来方向
- **"开源硬件 + 开源软件"** — 同时提供开源硬件设计文件和开源固件

### 6.3 创新设计哲学

#### "事件即 API" 思想

Smoothieware V1 的事件系统本质上是一种 **发布-订阅（Pub-Sub）架构**。模块不需要知道其他模块的存在，只需注册事件、处理事件、触发事件：

```
事件总线模型：
+--------------+       +--------------+
| SerialConsole|------>| on_console   |------>| GcodeDispatch |
+--------------+       | _line_received     +--------------+
                       |              |
+--------------+       |  EVENTS      |       +--------------+
| ZProbe       |<------| on_idle      |<------| Robot         |
+--------------+       |              |       +--------------+
                       |              |
+--------------+       | on_gcode_    |       +--------------+
| Laser        |<------| _execute     |<------| Conveyor      |
+--------------+       +--------------+       +--------------+
```

这种设计使得：
- 新模块可以通过注册现有事件快速集成
- 删除模块不会影响其他模块（只需取消注册）
- 模块可以独立测试（通过模拟事件输入）

#### "编译时排除"的模块选择

V1 通过 makefile 的 `EXCLUDE_MODULES` 实现编译时模块裁剪：

```makefile
# 这种设计允许：
# 1. 针对不同机器类型生成最小固件镜像
# 2. 减少 Flash 占用（512KB 在 V1 上是硬约束）
# 3. 避免未使用的模块消耗 CPU 周期
# 4. 用户可以根据需要定制固件

# 3D 打印机版本：保留所有模块
# make

# CNC 版本：去掉挤出机/温度控制，增加主轴
# make CNC=1 EXCLUDE_MODULES=tools/temperaturecontrol tools/extruder

# 激光版本：保留激光，去掉挤出机
# make LASER=1 EXCLUDE_MODULES=tools/temperaturecontrol tools/extruder
```

#### "C++ 对象化 GRBL 算法" 的移植策略

Smoothieware 的运动控制算法源于 GRBL（C 语言实现），但进行了 C++ 对象化重构：

```cpp
// GRBL 的 C 风格（全局变量 + 函数）
// static uint32_t st_go_position[N_AXIS];
// static uint32_t st_exit_position[N_AXIS];
// void st_prep_buffer() { ... }

// Smoothieware 的 C++ 风格（封装为对象）
class StepperMotor {
public:
    void set_speed(float speed);
    void move(int direction, uint32_t steps);
    bool is_moving();
private:
    uint32_t stepped;
    uint32_t target;
    float steps_per_second;
};
```

这种 C→C++ 的移植策略：
- 提高了代码可读性和可维护性
- 支持多实例（如多个步进电机对象）
- 便于单元测试（通过 mock 对象替换硬件接口）

---

## 7. 对 AUDESYS 的参考价值

### 7.1 可借鉴的架构设计/理念

#### 1. 模块化架构遗产

Smoothieware 的模块化架构是开源数控固件中最成熟的之一。其核心设计理念对 AUDESYS 的模块系统设计有直接参考价值：

**事件驱动模块通信（V1）**：
- 模块通过事件总线通信，无需知道其他模块的存在
- 新增功能只需注册事件处理器，无需修改核心
- 这种松耦合设计使得系统易于扩展和维护

**配置驱动模块加载（V2）**：
- 模块通过 `REGISTER_MODULE` 宏自动注册
- 配置文件中控制哪些模块启用/禁用
- 启动时根据配置动态实例化模块

**AUDESYS 参考**：AUDESYS 的 Runtime 和 HAL 模块系统可借鉴：

| Smoothieware 特性 | AUDESYS 对应设计 | 参考价值 |
|-------------------|-----------------|---------|
| 事件总线 (V1) | HAL 通信原语（Signal/StreamChannel/RPC） | 直接 — 事件总线类似 Signal 的单写多读模式 |
| REGISTER_MODULE (V2) | HalTransport trait 注册机制 | 高 — 自动注册机制可减少配置代码 |
| 配置驱动加载 | Config Barrier + 模块配置 | 中 — 配置驱动 vs 代码驱动的权衡 |
| 模块生命周期管理 | Runtime 模块管理器 | 高 — 启动/停止/热加载 |

#### 2. 配置系统设计

Smoothieware 的 config.txt 配置系统是"无需编译即可配置"理念的典范：

```
# Smoothieware 的配置哲学：
# 用户不需要知道如何编译，只需要编辑文本文件
# 所有参数都在一个文件中，按模块组织
# 注释说明每个参数的用途和单位

# 等效于 Marlin 的 Configuration.h 宏定义
# Marlin 用户需要安装 Arduino IDE，修改宏，重新编译，重新刷写
# Smoothieware 用户只需要编辑 config.txt，重启即可
```

**AUDESYS 参考**：AUDESYS 的配置策略（D24：开发 YAML + 运行时 FlatBuffers）可借鉴：

- Smoothieware 证明了纯文本配置在工业控制中的可行性（用户友好）
- 配置的模块化组织（按模块分节）是良好的实践
- 但纯文本配置在运行时性能上不如二进制格式（FlatBuffers 的优势）
- **建议**：AUDESYS 可以保留 YAML 开发的友好性，同时通过编译步骤生成 FlatBuffers 二进制

#### 3. 运动控制管线

Smoothieware 的 G-code → Robot → Planner → Conveyor → Stepper 管线是工业运动控制的成熟参考：

```
G-code 输入
  → Robot（运动学 + 线段分割）
  → Planner（加速度前瞻 + Block 队列）
  → Conveyor（时序控制 + G-code 执行时机）
  → Stepper（步进信号生成）
```

**AUDESYS 参考**：AUDESYS Runtime 的运动控制模块：

- 如果需要支持 G-code 运动控制，可直接参考此管线
- 管线各阶段的职责划分清晰，便于模块化实现
- 加速度前瞻算法（GRBL 的 look-ahead）是运动控制的核心算法

### 7.2 可移植/适配的技术模块

| 技术模块 | 描述 | 移植价值 |
|---------|------|---------|
| **事件驱动模块系统** | 基于事件总线（V1）或注册表（V2）的模块通信 | 高 — 可直接参考 AUDESYS Runtime 的模块系统 |
| **ArmSolution 运动学抽象** | 支持 6+ 种运动学模型的接口层 | 中 — 如果需要运动学支持 |
| **Config checksum 机制** | 编译时计算 CRC32，运行时快速查找 | 中 — 对嵌入式环境有参考价值 |
| **梯型加速度曲线** | 基于 GRBL 的加速度控制算法 | 中 — 标准运动控制算法 |
| **G-code 解析器** | 完整的 G-code 词法/语法解析 | 中 — 如果需要 G-code 支持 |
| **PID 温度控制** | 加热器 PID 调节算法 | 中 — 标准控制算法 |
| **复合 USB 设备** | 同时提供 Serial + Mass Storage | 低 — 取决于 AUDESYS 硬件形态 |

### 7.3 与 AUDESYS 定位的差异与互补

| 维度 | Smoothieware | AUDESYS |
|------|-------------|---------|
| 核心定位 | 3D 打印/CNC 数控固件 | 工业控制系统模拟平台 |
| 目标用户 | 创客、3D 打印爱好者、CNC 用户 | 控制工程师、系统集成商、开发者 |
| 运行环境 | 嵌入式 MCU（LPC1769/STM32H7） | 多种平台（仿真 + 物理 Runtime） |
| 编程方式 | G-code 输入 | 多种语言 + 可视化开发（规划中） |
| 实时性 | 中断驱动 ISR | 硬实时 + 仿真双模（规划中） |
| 通信接口 | USB/Serial/Ethernet | JSON-RPC/REST + HAL（规划中） |
| HAL 设计 | 无显式 HAL 层（直接 Pin 操作） | 完整的通信原语（Signal/StreamChannel/RPC） |
| 硬件支持 | LPC17xx/STM32H7 特定 | 仿真为主 + 物理 HAL 接口（规划中） |
| 安全认证 | 无 | 无（仿真平台不要求 SIL） |

**互补关系**：
- Smoothieware 的 **运动控制管线** 可作为 AUDESYS Runtime 运动控制的参考实现
- Smoothieware 的 **事件驱动模块系统** 与 AUDESYS 的 HAL 通信原语在概念上互补
- AUDESYS 的 **HAL 设计** 比 Smoothieware 的硬件抽象更完整（Smoothieware 直接操作 GPIO/Pin，无中间抽象层）
- Smoothieware 的 **维护教训** 对 AUDESYS 的长期发展策略有重要参考价值

### 7.4 详细对比分析：模块化架构

| 维度 | Smoothieware V1 | Smoothieware V2 | AUDESYS（设计） |
|------|----------------|----------------|----------------|
| 模块通信 | 事件总线广播 | 注册表查找 + 直接调用 | HAL 原语（Signal/StreamChannel/RPC） |
| 模块注册 | 构造函数注册 | REGISTER_MODULE 宏 | HalTransport trait 实现 |
| 配置方式 | config.txt（键值对） | config.ini（INI 格式） | YAML（开发）+ FlatBuffers（运行时） |
| 实时性 | 中断 ISR | FreeRTOS 任务 + ISR | SCHED_FIFO 线程（分层设计） |
| 硬件抽象 | 直接 Pin 操作 | Pwm/Pin 类封装 | HalTransport + HalDiscovery + HalQoS |
| 类型系统 | 基本类型（int/float/bool） | 基本类型 | 14 种（11 标量 + String + Blob + Array<T>） |
| 扩展方式 | 继承 Module + 事件注册 | REGISTER_MODULE + 配置 | 实现 trait + 注册到 amw |

### 7.5 维护教训总结

Smoothieware 的维护停滞为 AUDESYS 提供了以下关键启示：

#### 1. 架构设计需考虑长期可扩展性

- Smoothieware V1 的 LPC1769（64KB RAM）在 2012 年足够强大，但到 2020 年已严重不足
- **AUDESYS 启示**：HAL 和 Runtime 的架构设计应考虑未来 5-10 年的性能需求，采用分层可扩展设计

#### 2. 降低硬件依赖

- Smoothieware 深度绑定 LPC17xx 系列，芯片短缺导致 V2 延迟 3 年
- **AUDESYS 启示**：HAL 设计中的 `HalTransport` 抽象层确保传输实现可替换，不绑死特定硬件

#### 3. 可持续的社区治理

- Smoothieware 的志愿者模型导致核心贡献者 burnout 后项目停滞
- **AUDESYS 启示**：考虑建立可持续的治理模式，可能是商业实体 + 开源社区的组合

#### 4. 渐进式升级路径

- Smoothieware V1 → V2 的架构巨大差异（裸机 → FreeRTOS，事件总线 → 注册表）导致用户升级困难
- **AUDESYS 启示**：D22 的编译器分阶段策略（RuSTy → HAL IR → 自研）是正确的方向，保持接口稳定

#### 5. 竞争意识

- Klipper 的分布式架构在 2018-2020 年迅速取代 Smoothieware 的市场地位
- **AUDESYS 启示**：持续关注竞品架构演进，特别是分布式实时控制方向

---

> **本文档基于 2026 年 7 月的公开信息编写。Smoothieware V2 仍在开发中，特性可能随版本迭代而变化。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从官方仓库验证。**