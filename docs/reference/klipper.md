# Klipper

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: Klipper（3D 打印机固件）
- **开发商/组织**: 由 Kevin O'Connor 创建并维护，Kevin 同时也是知名的 x86 模拟器 Bochs 的共同作者
- **首次发布年份**: 2016 年（首次公开在 GitHub），Klipper v0.1.0 于 2016 年 3 月发布
- **当前版本**: 
  - Klipper 主分支: 持续滚动发布模式（rolling release），无传统语义版本号
  - Moonraker API Server: v0.9.x（2026 年初）
  - Mainsail Web UI: v2.14.x（2026 年初）
  - Fluidd Web UI: v1.30.x（2026 年初）
- **仓库地址**: 
  - Klipper (Core): https://github.com/Klipper3d/klipper
  - Moonraker: https://github.com/Arksine/moonraker
  - Mainsail: https://github.com/mainsail-crew/mainsail
  - Fluidd: https://github.com/fluidd-core/fluidd
  - KlipperScreen: https://github.com/KlipperScreen/KlipperScreen
- **文档地址**: https://www.klipper3d.org/ — 官方文档 + Klipper Discourse 论坛

### 1.2 产品定位与核心价值主张

Klipper 定位为 **高性能、低成本、基于分布式架构的 3D 打印机固件**，其核心价值主张是：

1. **分布式架构** — 将复杂的运动规划计算从 MCU 迁移到上位机（Raspberry Pi），MCU 仅负责时序精确的执行
2. **极高步进精度** — 实现 25 微秒级别的步进事件调度精度，远超传统 Marlin 固件
3. **廉价硬件上的卓越性能** — 即使在 8 位 AVR 平台上，Klipper 也能实现远超传统固件的运动平滑度
4. **纯 Python 开发** — 大部分 Klipper 主机代码用 Python 编写，降低了开发和配置门槛
5. **输入整形（Input Shaping）** — 通过软件方式消除打印中的共振纹，无需额外硬件（除加速度计外）
6. **无编译配置（printer.cfg）** — 纯文本配置文件，无需每次调整参数都重新编译烧录 MCU

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| 3D 打印爱好者/创客 | FDM/FFF 打印，追求打印质量和速度 | 需更高质量打印、振动抑制 |
| Voron/HevORT/DoomCube 高速打印用户 | CoreXY 高速打印（300-2000mm/s） | 输入整形、Pressure Advance、CAN 总线 |
| 高级改装者 | 多 MCU 打印机、Delta/SCARA 异构运动学 | 运动学灵活性、Python 宏编程 |
| 制造/原型工程师 | 轻量化制造、功能原型 | 可靠性和质量稳定性 |
| 3D 打印社区（Discord/Reddit） | 社群帮助、配置分享 | 活跃社区、文档完善 |
| 打印机 OEM | RatRig、LDO、Siboor、FLSUN 等框架厂商 | 提供预配置、降低用户配置负担 |
| 开源开发者 | 3D 打印软件栈研究、功能定制 | 完整的源代码访问、C/Python 开发 |

### 1.4 许可证模型

- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **商业模型**: 完全开源免费，无商业运营实体
- **封闭组件**: Moonraker API Server 同为 GPL-3.0，Mainsail/Fluidd Web UI 为 AGPL-3.0
- **OEM 考虑**: GPL-3.0 要求衍生作品同样开源，商业 3D 打印机集成 Klipper 时需注意许可证合规性

---

## 2. 技术特性

### 2.1 核心架构

Klipper 的核心创新在于 **三分层架构（Three-Tier Architecture）**：

```
+--------------------------------------------------------------+
|                    Klipper 系统架构                           |
+--------------------------------------------------------------+
|  Tier 1: 上位机 Host Software (Linux/Raspberry Pi)            |
|  Python 运行时                                                   |
|                                                                 |
|  +------------------------------------------+                 |
|  | klippy.py (Klipper Master Process)       |                 |
|  |  - G-code 解析器 (gcode.py)              |                 |
|  |  - 运动规划 toolhead.py + chelper/C      |                 |
|  |  - 运动学 kin_cartesian.py               |                 |
|  |  - 输入整形 input_shaper.py              |                 |
|  |  - Pressure Advance 算法                 |                 |
|  |  - 宏系统 (gcode_macro.py)               |                 |
|  +------------------------------------------+                 |
|  +------------------------------------------+                 |
|  | C Helper Library (chelper/)               |                 |
|  |  - itersolve.c (步进时间求解器)          |                 |
|  |  - stepcompress.c (步进压缩)             |                 |
|  |  - trapq.c (梯型速度队列)                |                 |
|  |  - steppersync.c (多MCU同步)            |                 |
|  |  - kin_*.c (运动学加速)                  |                 |
|  +------------------------------------------+                 |
+----------------------+----------------------------------------+
                       | Klipper MCU Protocol
                       | (USB/Serial/CAN/SPI)
+----------------------+----------------------------------------+
|  Tier 2: MCU Firmware (C, 8/32-bit MCU)                       |
|                                                                 |
|  +------------------------------------------+                 |
|  | 命令调度(command.c) + 定时调度(sched.c)  |                 |
|  |  - 步进驱动 (stepper.c)                  |                 |
|  |  - 数字/模拟IO (gpioc.c, adcc.c)        |                 |
|  |  - 温度传感器 (thermistor.c)             |                 |
|  |  - SPI/I2C 总线 (spic.c, i2cc.c)        |                 |
|  |  - PWM 生成 (pwm.c)                       |                 |
|  |  - Endstop 处理 (endstop.c)              |                 |
|  |  - 硬件抽象 (arch-specific)              |                 |
|  +------------------------------------------+                 |
|  支持的 MCU 架构:                                              |
|  +------+ +--------+ +---------+ +--------+                   |
|  | AVR  | | STM32  | | RP2040  | | LPC   |                    |
|  +------+ +--------+ +---------+ +--------+                   |
|  +------+ +--------+ +---------+ +------+                     |
|  |ESP32 | |SAM3X  | |SAM4S   | |Linux |                     |
|  +------+ +--------+ +---------+ +------+                     |
+--------------------------------------------------------------+
|  Tier 3: Klipper 生态层 (可选工具)                              |
|                                                                 |
|  +------------------------------------------+                 |
|  | Moonraker API Server (Python)             |                 |
|  |  - JSON-RPC over WebSocket/UDS             |                 |
|  |  - 文件管理                                |                 |
|  |  - 打印机数据库                            |                 |
|  |  - Web 插件系统                            |                 |
|  +------------------------------------------+                 |
|  +------------------+ +---------------------+                 |
|  | Mainsail Web UI  | | Fluidd Web UI       |                 |
|  | (Vue.js)         | | (React)             |                 |
|  +------------------+ +---------------------+                 |
|  +------------------+ +---------------------+                 |
|  | OctoPrint (Legacy)| | KlipperScreen (UI) |                 |
|  +------------------+ +---------------------+                 |
+--------------------------------------------------------------+
```

#### Tier 1: Klipper Host Software（Python + C helpers）

Klipper 主机软件运行在 Linux 主机（通常为 Raspberry Pi）上，管理所有复杂的计算任务：

- **G-code 解析**: `klippy/gcode.py` — 解析 G-code 文件流，处理 M-commands 和 G-commands
- **运动规划（ToolHead）**: `klippy/toolhead.py` — 前瞻队列（Look-ahead Queue）、trapezoid 速度规划
- **运动学（Kinematics）**: `klippy/kinematics/` — Cartesian、CoreXY、Delta、SCARA、Polar 等多种运动学模型
- **C Helper 库**: `klippy/chelper/` — 性能关键代码，用 C 语言实现并通过 Python C-Extension 绑定

#### Tier 2: MCU Firmware（C，运行在微控制器上）

MCU 固件的设计原则是 **极简、精确** — 只负责执行上位机下发的、带精确时间戳的指令：

- **命令调度**: `src/command.c` — DECL_COMMAND() 宏声明的命令处理器
- **定时调度**: `src/sched.c` — 基于 waketime 优先级队列的定时任务
- **步进控制**: `src/stepper.c` — 生成 step/direction 脉冲的硬件控制
- **硬件抽象**: `src/stm32/`、`src/avr/`、`src/rp2040/`、`src/esp32/` 等架构特定代码层

#### Tier 3: 生态系统工具

- **Moonraker**: Python JSON-RPC API Server，通过 Unix Domain Socket 与 Klipper Host 通信
- **Mainsail/Fluidd**: 基于 Web 的 3D 打印机控制前端 UI（Vue.js / React）
- **KlipperScreen**: 为触摸屏设计的嵌入式 UI（Python/PyQt）

### 2.2 MCU 协议架构（Klipper Messaging Protocol）

Klipper MCU 协议是 Klipper 分布式架构中的核心技术，定义 Host Linux 与 MCU 之间的实时通信：

#### 协议设计目标

```
低延迟 (< 100 us) + 低带宽 + 低复杂度 for MCU
```

Klipper 的 Host-MCU 协议本质上是一个 **轻量级 RPC 机制（Remote Procedure Call）**：

- MCU 端声明 Host 可调用的命令（`DECL_COMMAND()` C 宏）
- MCU 端声明可生成的响应消息（`sendf()` C 宏）
- Host 端使用 MCU 声明的命令编码/发送/解析

#### 命令声明范例

```c
// DECL_COMMAND() 宏范例 - MCU 声明命令
DECL_COMMAND(command_set_digital_out, "set_digital_out pin=%u value=%c");

void command_set_digital_out(uint32_t *args) {
    uint8_t pin = args[0];       // pin 参数
    uint8_t value = args[1];     // value 参数
    gpio_out_set(pin, value);
}
```

#### 响应声明范例

```c
// sendf() 宏范例 - MCU 生成响应
sendf("status clock=%u status=%u", sched_read_clock(), sched_status());
```

#### 二进制消息块（Message Block）格式

```
+----------+---------+-----------+-----------+----------+
| Header   | Sequence| Content   | CRC16     | Sync     |
| (2 bytes)| (1 byte)| (0-58  B) | (2 bytes) | 0x7e     |
+----------+---------+-----------+-----------+----------+
| len: 总  | seq: 4b | VLQ 编码  | CCITT CRC | 帧同步    |
| 长度(5-  | + 0x10  | 的命令/  | 的头+内容  | 标记      |
| 64 B)    | resv:4b | 响应序列  | (去除尾部) |          |
+----------+---------+-----------+-----------+----------+
```

- **Header**: 数据包总长度（5-64 字节）
- **Sequence**: 4 位序列号 + 0x10 保留位
- **Content**: VLQ（Variable Length Quantity）编码的命令 ID + 参数
- **CRC16**: CCITT CRC（包含 Header 和 Content）
- **Sync**: 0x7e 帧同步字节

#### 数据字典（Data Dictionary）机制

Klipper 协议的核心创新之一是 **动态数据字典**，它实现了 MCU 声明的运行时类型描述：

```
MCU 构建时:
  DECL_COMMAND() + sendf() 宏 -> 自动收集 -> 生成 data dictionary
  -> zlib 压缩 -> JSON 字符串 -> 存储在 MCU flash 的 text section

Host 连接时:
  发送 identify command (ID=1, 硬编码) -> MCU 响应 identify_response
  -> 分块下载压缩字典 -> Host 拼接 -> decompress -> 解析
  -> 用字典编码所有后续命令
```

- MCU 存储压缩过的 JSON 数据字典（通常 1-4KB 压缩后）
- Host 通过 `identify` command（ID=1 硬编码）分块下载字典
- MCU 构建时自动分配命令和响应的唯一整数 ID
- Host 使用动态数据字典编码命令/解析响应

#### 消息流（Message Flow）

**Host -> MCU 方向（可靠传输）**：
- MCU 检查 CRC 和 Sequence Number 确保命令准确、有序
- MCU 始终按顺序处理消息块
- Host 实现自动重传：发送后等待 ack，超时后重传
- Nak 机制支持快速重传（MCU 发现损坏/乱序时发送 nak）
- Window 窗口传输允许多个 outstanding 消息块同时传输

**MCU -> Host 方向（尽力传输）**：
- 无自动重传 — MCU 侧实现简单
- 序列号字段在不同方向上的含义不同
- 高层代码通过重新请求或定期调度来处理丢失响应

#### 步进控制协议

核心命令 `queue_step` — 定义 Klipper 步进压缩的精髓：

```c
queue_step oid=%c interval=%u count=%hu add=%hi
```

- **oid**: 步进电机对象 ID
- **interval**: 步进脉冲间隔（时钟滴答数）
- **count**: 步数
- **add**: 每步间隔的增量调整（实现加速/减速）

MCU 侧的处理过程：

```
queue_step -> per-stepper move queue (先进先出)
  -> sched.c 定时器 waketime
  -> stepper_event(): gpio_out_toggle_noirq()
  -> 更新 next_waketime = cur_waketime + interval + add_accumulator
  -> count--, 直到 count=0
  -> stepper_load_next() 从 move_queue 弹出 next stepper_move
```

### 2.3 运动规划与前瞻系统

Klipper 的运动规划在上位机（Python）中完成，使用 **前瞻队列（Look-ahead Queue）** 实现最优速度规划：

```
Move 1 -> Move 2 -> Move 3 -> ... -> Move N
|                    |
|+--- Junction ----+|
|  (v_max junction) |
```

**Trapezoid 速度剖面**：

```
                  +-- cruise --+
                 /              \
   acceleration /                \ deceleration
               /                  \
  +----------+                    +----------+
   Move 1     <- Junction ->       Move 2
               (optimal v_junction)
```

**Klipper 前瞻算法的数学原理**：

```python
# 简化的前瞻调整逻辑（来自 toolhead.py 的概念）
class Move:
    def __init__(self, start_pos, end_pos, max_cruise_v, accel):
        self.max_start_v = 0          # 起点最大速度
        self.max_cruise_v = max_cruise_v  # 巡航最大速度
        self.max_end_v = 0            # 终点最大速度
        self.accel = accel            # 加速度

    # Junction calculation: 相邻两个 Move 之间的最大 entry velocity
    def calc_junction(self, prev_move):
        # 基于 prev_move 的实际 end velocity 计算
        # 考虑 prev_move 的 velocity 方向和当前 move 的 velocity 方向
        v = (prev_move.max_end_v ** 2 + self.max_cruise_v ** 2) ** 0.5
        self.max_start_v = min(v, 50.0)  # mm/sec, clamped at 50mm/s
```

**C Helper 队列流程**：

```
trapq.c                     itersolve.c                 stepcompress.c
+---------------+           +---------------+           +------------------+
| trapq_append  | ------>   | solve_step    | ------>   | compress_add     |
| (移动队列     |           | (步进时间     |           | (interval/       |
|  添加)        |           |  求解)        |           |  count/add 压缩)  |
+---------------+           +---------------+           +--------+---------+
                                                                    |
+-------------------------------------------------------------------+
|
v
steppersync.c -> serialhdl.py -> MCU serial -> sched.c -> stepper.c
```

#### Itersolve — 迭代步进时间求解

`itersolve.c` 实现 **Secant Method（割线法）** 来找出步进电机在该移动段中的步进时间：

```c
// 简化的 itersolve 查找步进交叉时间
double itersolve_calc(struct stepper_kinematics *sk, struct move *m,
                      double move_time) {
    // 调用 kinematic callback 获取坐标位置
    double pos = sk->calc_position(sk, m, move_time);
    return pos;  // 用于搜索 step threshold 交叉点
}
```

#### Step Compression — 步进压缩

`stepcompress.c` 将连续步进时间序列压缩为 **(interval, count, add)** 三参数格式：

```c
#define QUADRATIC_DEV 4  // 二次拟合偏差上限

struct stepcompress {
    struct steppersync *ss;
    int max_error;
    uint32_t cur_interval;
    uint16_t cur_count;
    int32_t cur_add;
};
```

**步进压缩的价值**：一个 queue_step 命令可以编码数百次步进脉冲（典型新 Move 中 count=1000+），极大降低了 Host-MCU 通信带宽需求。未经压缩的步进事件流需要大约 20-50KB/s 的原始步进数据带宽，压缩后降至约 2-5KB/s。

### 2.4 运动学系统

Klipper 支持 **多种运动学模型（Kinematic Models）**，每种模型有 Python 和 C 两种实现：

#### 支持的 7 种运动学类型

| 模块 | 路径 | 轴类型 | 典型打印机 |
|------|------|--------|-----------|
| Cartesian | `kin_cartesian.py` | X/Y/Z 独立轴 | Prusa、Ultimaker |
| CoreXY | `kin_corexy.py` | CoreXY 对角线同步带 | Voron 2.4、RatRig V-Minion |
| CoreXZ | `kin_corexz.py` | CoreXZ 变体 | CoreXZ 框架 |
| Delta | `kin_delta.py` | Delta 并联运动学 | FLSUN QQ-S Pro |
| Polar | `kin_polar.py` | 极坐标运动学 | Polar 3D 打印机 |
| Rotary | `kin_rotary.py` | 旋转轴运动学 | SCARA 臂 |
| None (定制) | — | 用户自定义运动学 | 特殊机械结构 |

#### CoreXY 运动学（最常见的 Klipper 轴类型）

```
CoreXY 正向运动学:
  X = (motor_A + motor_B) / 2
  Y = (motor_A - motor_B) / 2

CoreXY 逆运动学:
  motor_A = (X + Y) / 2
  motor_B = (X - Y) / 2
```

**Klipper 的 CoreXY C 实现**（`chelper/kin_corexy.c`）：

```c
double kin_corexy_calc_pos(struct stepper_kinematics *sk, struct move *m,
                           double move_time) {
    struct trapq *tq = m->tq;
    double pos[MAX_AXIS];
    trapq_get_pos(tq, move_time, pos);

    // CoreXY: X = (A + B) / 2, Y = (A - B) / 2
    double a = sk->get_axis(pos, 0);  // motor_A (axis_0)
    double b = sk->get_axis(pos, 1);  // motor_B (axis_1)

    // 返回该 stepper 的位置用于 step time 搜索
    return sk->axis == 0 ? (a + b) / 2 : (a - b) / 2;
}
```

#### Delta 运动学

Delta 运动学是 Klipper 在 3D 打印领域的另一项核心优势。Klipper 通过 `kin_delta.c` C 实现高效求解 Delta 正/逆运动学：

```
// 简化的 Delta 逆运动学
A = atan2(Y, X) + arm_angle       # Tower A 角度
B = atan2(Y, X) + 120 + arm_angle  # Tower B
C = atan2(Y, X) + 240 + arm_angle  # Tower C

Z_tower = Z_base + sqrt(R_arm^2 - (R_tower - R_carriage)^2)
```

### 2.5 输入整形（Input Shaping）

Klipper 的 Input Shaping 是其最具标志性的技术特性，通过在 **运动命令上叠加抗谐振滤波器** 来消除打印中的 ringing 纹路：

#### 工作原理

Input Shaping 是一种 **开环控制（Open-loop Control）** 技术：

```
原始运动命令
  v(t)
  |\            /|
  | \          / |
  |  \________/  |
  |              |
  +--------+----+---> time

     |  卷积  |
     v        v
     +        +

  Impulse 序列 (A_i, T_i)
  |         |      |    |
  | A_1    | A_2  |    | ... A_n
  +--------+------+----+----> time

     |  卷积  |
     v        v

  整形后的运动命令
   ___/    \___
  /              \
 /                \
/                  \
+--------------------+---> time
```

Klipper 支持的 Input Shaper 类型：

| Shaper 类型 | 持续时间 | 5% 容错范围 | 10% 容错范围 | Smoothing |
|------------|---------|-------------|-------------|-----------|
| `ZV` | 0.5 / shaper_freq | N/A | ± 5% | 低 |
| `MZV`（默认） | 0.75 / shaper_freq | ± 4% | -10%...+15% | 中低 |
| `ZVD` | 1 / shaper_freq | ± 15% | ± 22% | 中 |
| `EI` | 1 / shaper_freq | ± 20% | ± 25% | 中高 |
| `2HUMP_EI` | 1.5 / shaper_freq | -40...+45% | -45...+50% | 高 |
| `3HUMP_EI` | 2 / shaper_freq | -50...+60% | -55%...+65% | 很高 |

#### Klipper 独有的 MZV（Modified Zero Vibration）Shaper

MZV 是 Klipper 开发者 `@dmbutyugin` 设计的 **自定义 Input Shaper**，在 ZV（低 smoothing）和 ZVD（高鲁棒性）之间取得平衡：

- 默认参数：`n=3, t=0.75 * Td`（Td = damped period of oscillation）
- 比 ZV 提供更宽的频率抑制范围
- 比 ZVD 提供更少的 smoothing
- 适合典型的 3D 打印机机械结构（30-70 Hz 共振频率）

#### 共振测量方式

Klipper 支持 **加速度计（ADXL345/LIS2DW/MPU9250）** 自动测量共振：

```
1. 安装 accelerometer（USB/SPI/I2C 通过 rpi_mcu）
2. 执行 TEST_RESONANCES AXIS=X
   -> 上位机驱动 toolhead 按频率扫描 (5-133 Hz)
   -> accelerometer 记录振动响应
   -> FFT 分析 -> 识别共振峰
3. 运行 SHAPER_CALIBRATE
   -> 自动计算最佳 shaper_type + shaper_freq
```

### 2.6 Pressure Advance

Pressure Advance 是 Klipper 处理挤出（Extrusion）压力的算法，确保喷嘴前端的熔体压力保持恒定：

```
PA 实现原理:

传统 Marlin:
  E = E_distance * extruder_ratio
  (无 PA: 加速/减速时挤出量不补偿)

Klipper PA:
  pressure_advance = K * velocity_change
  E_corrected = E_distance * extruder_ratio + pressure_advance
  (K = pressure_advance factor, 由用户调参)
```

```python
# klippy/extras/pressure_advance.py 的概念
class PressureAdvance:
    def __init__(self, config):
        self.pa_value = config.getfloat('pressure_advance', 0.0, minval=0.0)
        self.smooth_time = config.getfloat(
            'pressure_advance_smooth_time', 0.040, minval=0.010)

    def update_extrude(self, time, e_pos, e_velocity):
        # PA 补偿 = K * dE/dt 的导数
        pa_correction = self.pa_value * e_velocity
        return pa_correction
```

Pressure Advance 调参流程：
1. 打印 PA 测试塔（在 Z 轴递增 PA 值）
2. 观察每一层 corner 处的过度挤出/欠挤出
3. 选择最佳 PA 值写入 printer.cfg
4. 可选：使用 `TUNING_TOWER` 命令自动测试

### 2.7 G-code 宏系统

Klipper 提供丰富的 **G-code Macro System** — 直接在 `printer.cfg` 中用 G-code 命令编写宏：

#### 宏定义示例

```gcode
[gcode_macro PRINT_START]
gcode:
    # 打印启动序列
    G28        ; 回零
    M104 S{params.BED_TEMP|default(60)}  ; 设置热床
    M109 S{params.EXTRUDER_TEMP|default(200)}  ; 等待挤出机温度
    G32        ; 自动调平
    G0 Z5      ; 抬升
```

**Jinja2 模板引擎** — Klipper 的宏系统支持 Jinja2 模板语法，提供强大的变量和条件控制：

```gcode
[gcode_macro CANCEL_PRINT]
description: Cancel the ongoing print
gcode:
    SAVE_VARIABLE  ; 保存当前状态
    {% if printer.cancel_object %}
        CANCEL_OBJECT
    {% endif %}
    {% if printer.heater_fan %}
        M106 S0    ; 关闭风扇
    {% endif %}
    TURN_OFF_HEATERS
    M84           ; 关闭电机
```

### 2.8 通信协议支持

| 协议 | 角色 | 用途 | 典型带宽 |
|------|------|------|---------|
| UART/serial | Host <-> MCU | 低速 3D 打印机（250000 baud） | < 25 KB/s |
| USB CDC | Host <-> MCU | 标准连接方式 | 1-12 Mbps |
| CANBus / CAN-FD | Host <-> MCU | 多 MCU 打印机推荐 | 1-8 Mbps |
| SPI | Host <-> MCU | 特殊场景（如 RP2040 SPI slave） | 10-50 Mbps |
| Unix Domain Socket (UDS) | Klipper <-> Moonraker | API 层 IPC | 高速 |
| JSON-RPC (WS) | Moonraker <-> Web UI | 前端控制接口 | 实时 |
| USB (KlipperScreen) | 触摸屏 <-> Klipper | 嵌入式 UI | 实时 |

### 2.9 多 MCU 架构

Klipper 支持 **同时连接多个 MCU**（一条 CAN-FD 总线或多个 USB 设备）：

```
+-------------------+
| Klipper Host      |
| (Raspberry Pi)    |
+--------+----------+
         |
    +----+----+----------+
    |         |          |
 USB    CAN-FD     USB/Serial
    |         |          |
+---+---+ +--+---+ +---+---+
| MCU 1 | |MCU 2 | | MCU 3 |
| 主步  | | 挤出  | | 温度  |
| 进驱动 | | 机   | | 控制  |
+-------+ +------+ +-------+
```

**时钟同步** — 多 MCU 架构需要时钟漂移校正：

```python
# klippy/clocksync.py 概念
class ClockSync:
    def __init__(self):
        self.clock_est = None
        # 线性模型: host_clock = offset + mcu_clock * freq_ratio

    def update(self, mcu_clock, host_clock):
        # 每 1 秒从 MCU 获取 get_clock -> clock response
        # 建立 host_clock vs mcu_clock 的线性回归
        self.clock_est = linear_estimate(mcu_clock, host_clock)

    def mcu_to_host(self, mcu_clock):
        # 将 MCU 时间戳转换为主机时间
        return self.clock_est.predict(mcu_clock)
```

**steppersync.c** — 多 MCU 步进同步机制确保多个 MCU 的步进脉冲在精确的时间点上对齐：
- 所有 MCU 的 step 事件在 Host 侧被协调为同一个时间轴
- 通过 clock sync 将各 MCU 的本地时钟转换到统一的主机时钟
- 最后的步进事件同时/顺序下发到各 MCU

### 2.10 配置系统

Klipper 采用 **纯文本配置文件 + 无编译** 的配置哲学：

```ini
# printer.cfg — Klipper 配置示例
[mcu]
serial: /dev/ttyACM0
baud: 250000

[printer]
kinematics: corexy
max_velocity: 500
max_accel: 20000
square_corner_velocity: 5.0

[stepper_x]
step_pin: PE2
dir_pin: PE1
enable_pin: !PE0
microsteps: 16
rotation_distance: 40
endstop_pin: ^PD0
position_endstop: 0
position_max: 250

[stepper_y]
step_pin: PE6
dir_pin: PE5
enable_pin: !PE4
microsteps: 16
rotation_distance: 40
endstop_pin: ^PD1
position_max: 250

[stepper_z]
step_pin: PE10
dir_pin: PE9
enable_pin: !PE8
microsteps: 16
rotation_distance: 8
endstop_pin: ^!PD2
position_max: 250

[extruder]
step_pin: PE14
dir_pin: PE13
enable_pin: !PE12
microsteps: 16
rotation_distance: 33.2
nozzle_diameter: 0.400
filament_diameter: 1.75
heater_pin: PB5
sensor_pin: PA1
sensor_type: EPCOS 100K B57560G104F
control: pid
pid_Kp: 22.801
pid_Ki: 1.456
pid_Kd: 88.932
min_temp: 0
max_temp: 260

[input_shaper]
shaper_freq_x: 50.0
shaper_type_x: mzv
shaper_freq_y: 45.0
shaper_type_y: mzv

[pause_resume]
[gcode_macro PRINT_START]
gcode:
    # 宏指令...
```

配置文件的解释依赖于 Klipper 的 `configfile.py` 模块，所有段落在运行时被解析为 Python 对象后注入对应的模块。

---

## 3. 功能概览

### 3.1 主要功能模块

#### Klipper Host 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| G-code 解析 | `klippy/gcode.py` | G/M/T-code 命令解析与分发 |
| 运动规划 | `klippy/toolhead.py` | Look-ahead 前瞻、Move 队列 |
| MCU 通信 | `klippy/mcu.py` | MCU 命令封装与同步 |
| 运动学 | `klippy/kinematics/*kin_*.py` | 7 种运动学模型 |
| 配置解析 | `klippy/configfile.py` | configfile 段落式配置 |
| 加热/热敏 | `klippy/extras/heater.py` | PID 温度控制 |
| 宏系统 | `klippy/extras/gcode_macro.py` | Jinja2 宏引擎 |
| 输入整形 | `klippy/extras/input_shaper.py` | 共振补偿算法 |
| Pressure Advance | `klippy/extras/pressure_advance.py` | 挤出补偿 |
| Web 连接 | `klippy/webhooks.py` | Moonraker JSON-RPC 接口 |

#### C Helper 库

| 模块 | 路径 | 职责 |
|------|------|------|
| Iterative Solver | `klippy/chelper/itersolve.c` | 步进脉冲时间计算 |
| Step Compressor | `klippy/chelper/stepcompress.c` | 步进时间 quadratic 压缩 |
| Trapezoid Queue | `klippy/chelper/trapq.c` | 梯形速度运动队列 |
| Stepper Sync | `klippy/chelper/steppersync.c` | 多 MCU 步进同步 |
| Kinematics (CoreXY) | `klippy/chelper/kin_corexy.c` | CoreXY C 实现 |
| Kinematics (Delta) | `klippy/chelper/kin_delta.c` | Delta C 实现 |
| Kinematics (Cartesian) | `klippy/chelper/kin_cartesian.c` | Cartesian C 实现 |
| Serial Queue | `klippy/chelper/serialqueue.c` | 高性能串行队列 |

#### MCU Firmware 模块

| 模块 | 路径 | 职责 |
|------|------|------|
| 命令调度 | `src/command.c` | 命令解析与调度 |
| 定时器 | `src/sched.c` | 优先级 waketime 任务调度 |
| 步进 | `src/stepper.c` | 步进脉冲精确生成 |
| ADC | `src/adcc.c` | 模拟/数字转换 |
| 温度 ADC | `src/temperature.c` | 测温 |
| GPIO | `src/gpioc.c` | 数字 GPIO |
| PWM | `src/pwm.c` | PWM 生成 |
| SPI | `src/spic.c` | SPI 总线 |
| I2C | `src/i2cc.c` | I2C 总线 |
| LPC176x | `src/lpc176x/` | LPC176x 架构代码 |
| STM32 | `src/stm32/` | STM32 F0/F1/F4/G0 |
| AVR | `src/avr/` | Atmega 8/16/32/128 |
| RP2040 | `src/rp2040/` | Raspberry Pi Pico |
| ESP32 | `src/esp32/` | ESP32 WiFi + BLE |

### 3.2 关键工作流

#### 工作流：Klipper 安装与配置

1. **安装上位机** — Raspberry Pi 上通过 `kiauh` 脚本（Klipper Installer and Update Helper）一键安装 Klipper + Moonraker + Mainsail/Fluidd
2. **编译 MCU 固件** — `cd klipper && make menuconfig` 选择 MCU 类型、通信接口（USB/Serial/CAN）
3. **烧录 MCU** — `make flash` 或通过 DFU/stm32 bootloader 写入
4. **配置 printer.cfg** — 编写配置文件，定义 MCU 端口、电机参数、挤出机参数
5. **验证连接** — `RESTART` -> `FIRMWARE_RESTART` -> `STATUS` 确认 Klippy 连接正常
6. **校准** — PID_autotune、Pressure Advance、Input Shaper
7. **打印** — 通过 Moonraker/Mainsail/OctoPrint 上传 G-code 打印

#### 工作流：运动规划与执行

```
1. G-code 解析 (gcode.py -> toolhead.py)
   G1 X100 Y100 E10 F6000
   -> 解析为 Move object
   -> 加入前瞻队列 (look-ahead)

2. 前瞻优化 (toolhead.py)
   -> 计算 junction velocity
   -> 生成 trapezoid speed profile
   -> 切分为 trapq entries (C helper)

3. 步进时间求解 (itersolve.c)
   -> 对每个 stepper 调用 kinematic callback
   -> 搜索 step threshold 交叉时间
   -> 生成步进脉冲事件 (stepper_move_t)

4. 步进压缩 (stepcompress.c)
   -> 将步进时间序列压缩为 (interval, count, add)
   -> 通过 serialqueue 发送 queue_step 命令到 MCU

5. MCU 执行 (stepper.c)
   -> 解析 queue_step 命令
   -> 加入 per-stepper move queue
   -> sched.c 定时器触发 stepper_event()
   -> gpio_out_toggle_noirq() 精确切换 step pin
   -> 自动处理 deceleration via add accumulator
```

### 3.3 床调平系统

Klipper 提供多种床调平（Bed Leveling）方式：

| 调平方法 | 传感器 | 精度 | 适用场景 |
|---------|--------|------|---------|
| Manual Bed Leveling | 无 | 低 | 入门打印机 |
| BLTouch/BLTouch | 电磁探针 | 高 | CoreXY/Cartesian |
| Klicky/Omron | 微型限位开关 | 高 | Voron 社区 |
| Eddy/Proximity | 涡流传感器 | 中 | PEI/玻璃床 |
| Adaptive Mesh | 自动适配网格 | 高 | 变形床 |

**Adaptive Mesh** — Klipper 独有的智能调平算法：

```
Adaptive Mesh:
  1. 在 G-code 的打印区域内生成 mesh 网格
  2. 仅在打印区域内校准 Z 高度
  3. 自适应网格密度：复杂区域精细
  4. 大幅减少 mesh 生成时间
```

#### Bed Mesh 配置示例

```ini
[bed_mesh]
speed: 120
horizontal_move_z: 5
mesh_min: 10, 10
mesh_max: 190, 190
probe_count: 5, 3
algorithm: bicubic
fade_start: 1
fade_end: 10
fade_target: 0
```

### 3.4 温度控制系统

Klipper 的温度控制支持 PID 控制和 Bang-Bang 控制两种模式：

```ini
# PID 配置示例
[heater_bed]
heater_pin: PB6
sensor_pin: PA2
sensor_type: NTC 100K B57560G104F
control: pid
pid_Kp: 58.1
pid_Ki: 2.4
pid_Kd: 352.7
min_temp: 0
max_temp: 120

[temperature_fan chamber_fan]
pin: PD12
sensor_type: NTC 100K B57560G104F
sensor_pin: PA3
max_power: 1.0
control: pid
pid_Kp: 4.0
pid_Ki: 0.04
pid_Kd: 40.0
target_temp: 45
```

### 3.5 Moonraker API 服务器

Moonraker 是 Klipper 生态中的核心 API 组件，提供 JSON-RPC over WebSocket / Unix Domain Socket 接口：

```
+------------------+    JSON-RPC/WebSocket    +------------------+
| Mainsail/Fluidd  | -----------------------> |  Moonraker       |
| Web UI           |   REST File Upload       |  /tmp/moonraker  |
| (Vue.js/React)   |   WebSocket Updates      |  .sock (UDS)    |
+------------------+                          |                  |
                                               |  +------------+  |
+------------------+                          |  | History    |  |
| Klipper Host     |     Unix Domain Socket   |  | DB         |  |
| (klippy.py)      | -----------------------> |  +------------+  |
| /tmp/klippy_uds  |   JSON-RPC/v0.2          |  | File       |  |
+------------------+                          |  | Manager   |  |
                                               |  +------------+  |
                                               |  | Machine    |  |
                                               |  | Stats      |  |
                                               |  +------------+  |
                                               |  | Power      |  |
                                               |  | Manager   |  |
                                               |  +------------+  |
                                               +------------------+
```

Moonraker 提供的主要 API 组：
- **Printer API**: 打印机状态、G-code 发送、打印控制
- **File API**: 文件上传/下载/删除/列表
- **Machine API**: 系统信息、服务管理、MCU 固件更新
- **Plugin API**: 插件安装与管理
- **Authorization API**: API Key 认证
- **DB API**: 持久化参数存储

### 3.6 Probing 与自动调平

Klipper 支持丰富的自动调平功能——BLTouch / Klicky / Voron Tap / Eddy 传感器

```ini
# BLTouch 配置示例
[bltouch]
sensor_pin: ^PD3
control_pin: PD4
x_offset: -25
y_offset: -15

[screw_tilt_adjust]
screw1: 5, 5
screw1_name: front_left
screw2: 245, 5
screw2_name: front_right
screw3: 245, 245
screw3_name: rear_right
screw4: 5, 245
screw4_name: rear_left
```

**Screw Tilt Adjust** — 通过调节四个打印床角螺丝手动调平，Klipper 自动计算每个角的调整量。

### 3.7 Web 控制界面

| Web UI | 技术栈 | GitHub Stars | 特点 |
|--------|--------|-------------|------|
| Mainsail | Vue.js + Vite | ~2,500 | 现代界面，Klipper 最佳体验 |
| Fluidd | React + Webpack | ~1,500 | 轻量，资源占用少 |
| OctoPrint | Python/Flask | ~9,000 | 传统/成熟，插件生态丰富 |
| KlipperScreen | Python/PyQt | ~1,800 | 触摸屏 UI |

### 3.8 扩展机制

Klipper 生态的扩展主要通过以下几种机制实现：

1. **Moonraker Plugins**: Python 插件挂载到 Moonraker API Server
2. **Klippy Extras**: Python 扩展模块位于 `klippy/extras/`
3. **G-code Macro**: 直接在 `printer.cfg` 中用 Jinja2 + G-code 编写
4. **Klippy Hooks**: 通过 `register_event_handler` 订阅系统事件
5. **MCU 添加**: `printer.cfg` 加 `[mcu extruder]` 段即可添加额外 MCU

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| Klipper GitHub Stars | ~12,000 |
| Moonraker GitHub Stars | ~2,500 |
| Mainsail GitHub Stars | ~2,500 |
| Fluidd GitHub Stars | ~1,500 |
| KlipperScreen GitHub Stars | ~1,800 |
| Klipper 总 Forks | ~4,500 |
| Klipper 贡献者 | ~700+（跨主仓库和生态） |
| 主要开发语言 | Python (Host) + C (MCU) |
| 发布模式 | Rolling Release（持续滚动） |

### 4.2 社区规模

- **Discord 社区**: Klipper Discord (discord.klipper3d.org) — 20,000+ 成员
- **Klipper Discourse 论坛**: active.klipper3d.org — 重度使用，包含文档和讨论
- **Reddit**: r/klippers — 100,000+ 订阅者
- **GitHub Issues**: 极活跃，Kevin O'Connor 亲自处理社区问题
- **Klipper 变体/生态**: 大量派生项目（KlipperAdaptiveMeshing、KlipperTimelapse、LEDEffects）

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **Klipper (Core)** | 3D 打印机固件 — Host + MCU |
| **Moonraker** | JSON-RPC API Server — Klipper 与 UI 之间的桥梁 |
| **Mainsail** | Vue.js Web UI — 现代 Klipper 控制台 |
| **Fluidd** | React Web UI — 轻量级 Klipper 控制台 |
| **KlipperScreen** | PyQt 触摸屏 UI — SKR TFT35/BTT PiTFT 等 |
| **OctoPrint** | Python 传统 UI — 通过 OctoKlipper 插件桥接 |
| **MainsailOS** | Buildroot 构建的 Raspberry Pi OS 镜像 |
| **KlipperAdaptiveMeshing** | 社区 G-code 宏 — 自适应床调平 |
| **Klipper Timelapse** | Moonraker 插件 — 缩时录像 |
| **ShakeTune** | Moonraker 插件 — Input Shaper 自动调谐 |

### 4.4 硬件兼容性

| MCU 架构 | 具体芯片 | 通信方式 |
|---------|---------|---------|
| AVR (8-bit) | ATmega328P, ATmega2560, AT90USB1286 | UART/USB |
| STM32 | STM32F103, STM32F407, STM32G0B1, STM32H743 | USB/CAN/SPI |
| RP2040 | Raspberry Pi Pico | USB/CAN |
| LPC176x | LPC1768, LPC1769 | USB/CAN |
| SAM3X | SAM3X8E (Arduino Due) | USB |
| SAM4S | SAM4S8C, SAM4SA16 | USB |
| ESP32 | ESP32, ESP32-S3 | WiFi/UART/USB |
| Linux | Raspberry Pi GPIO (as MCU) | Pseudo-tty |

**现有支持的主板**: 超过 200 种主板配置文件在 Klipper 仓库的 `config/` 目录中，覆盖从 8 位 AVR 到 32 位 ARM Cortex 的全系列常见 3D 打印机主板。

### 4.5 最新发展趋势

1. **CAN-FD 总线支持** — FCAN / GigaCAN 等 CAN 适配器在高性能 3D 打印机的应用增长迅速
2. **厂商预装 Klipper** — RatRig、LDO、Siboor、FLSUN 等厂商开始出厂预装 Klipper
3. **ESP32 ESP3D-CAN** — 通过 ESP32 运行 Klipper MCU 固件并提供 WiFi 支持
4. **加速度计 ADXL345 标准化** — 高端 3D 打印机标配共振测量排座
5. **多 MCU 和 CAN** — 高端打印机用独立的 MCU 管理步进驱动、热端控制和 chamber 环境
6. **Macro Ecosystem 爆发** — Voron 社区的大量 Klipper 宏项目
7. **Toolchanger 支持** — Klipper 的 ERCF/MMU 多色多材料打印支持成熟化

### 4.6 安全评估

Klipper 的安全特性较弱，原因如下：
- **Moonraker API 无内置认证**: 默认基于 LAN 信任，暴露到 WAN 不安全
- **UDS 保护**: `/tmp/klippy_uds` 仅允许 localhost 访问
- **Mainsail/Fluidd 无 TLS**: 局域网部署常见
- **CANBus 物理访问**: 对 CAN 节点的物理访问可直接操控 MCU
- **远程访问**: 建议使用 nginx reverse proxy + HTTPS + API Key 进行远程访问

---

## 5. 市场定位

### 5.1 主要应用场景与用户

| 场景 | 硬件 | 典型用户 |
|------|------|---------|
| CoreXY 高速打印 (Voron, RatRig) | RPi + SKR 1.4/Octopus | 高级 DIY 玩家 |
| 床式 Cartesian 高速打印改造 | RPi + Einsy RAMBo | 打印爱好者 |
| Delta 打印机 | RPi + FLSUN Delta board | Delta 爱好者 |
| 改装 Marlin 打印机 | RPi + 原 Marlin board | 升级用户 |
| 大型格式打印机 | RPi + SKR Pro/Spider | 大型零件打印 |
| IDEX 双头打印 | RPi + 双 MCU | 高级多材料打印 |
| 工具更换 (Toolchanger) | RPi + 多 MCU | 多工具打印 |

### 5.2 竞争对手对比

| 维度 | Klipper | Marlin | RepRapFirmware | Smoothieware |
|------|---------|--------|----------------|-------------|
| 架构 | Host + MCU 分布式 | 单芯片 MCU | 单芯片 MCU | 单芯片 MCU |
| 编程语言 | Python + C | C++ (Arduino) | C++ | C++ |
| 步进精度 | ~25 us | Bresenham ISR | 有限 | 有限 |
| Input Shaping | 原生（多种 shaper） | 有限的 IS | 无 | 无 |
| Pressure Advance | 原生 | 有限的 LA | 有 | 无 |
| 运动学 | 7 种 + 自定义 | Cartesian, Delta | Cartesian, CoreXY, Delta | Cartesian, CoreXY, Delta |
| 宏系统 | Jinja2 + G-code | 基本 | G-code 宏 | 有限 |
| Web 控制 | Moonraker + Mainsail/Fluidd | OctoPrint (外挂) | DuetWebControl (内置) | 无 |
| 多 MCU | 原生 | 无 | Duet 扩展 (单板) | 无 |
| 配置语言 | printer.cfg (无编译) | Configuration.h (需编译) | config.g (无编译) | config.txt (需编译) |
| 实时性 | Python + C helper (软实时) | ISR 中断 | ISR 中断 | ISR 中断 |
| 社区 | 增长最快 | 最大 | 中等 | 基本停止 |
| 开源 | GPL-3.0 | GPL-3.0 | GPL-3.0 | GPL-3.0 |
| 最低硬件 | RPi Zero + AVR MCU | 8-bit AVR | 32-bit ARM (Duet) | LPC176x |

### 5.3 Klipper 的独特市场定位

Klipper 在 3D 打印固件市场中的独特定位是 **"分布式固件"** — 它的所有竞争对手都在单 MCU 上运行全部计算，而 Klipper 通过把计算任务迁移到 Linux Host 来实现：

1. **计算资源充裕** — Raspberry Pi 的 4 核 ARM Cortex + 512MB/1GB RAM 满足实时运动学 + Input Shaper + 宏系统运算
2. **MCU 保持轻量** — MCU 仅需 1-2KB RAM 就可以处理 step/direction/time
3. **性能天花板最高** — Marlin 或 Smoothieware 都无法在 8 位 AVR 上完成 Input Shaper 的计算
4. **配置周转极快** — 从 Marlin 的 Configuration.h + 编译 + 烧录 30 分钟流程，降到 printer.cfg + restart 30 秒

---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **分布式架构（Host + MCU 分离）**:
   - 计算密集型运动规划在上位机 Linux 完成
   - MCU 仅执行微秒级精度的 step pulse
   - 上位机故障 -> 打印停下但数据不丢失；MCU 故障 -> 打印受损但不影响上位机

2. **25 us 步进精度**:
   - 使用 iterative solver 计算每个 step 的精确时间
   - 不使用 Bresenham DDA (Marlin) 的近似算法
   - step compression 将数千 step 打包进 queue_step 命令

3. **Input Shaper 的完整实现**:
   - 6 种 shaper 类型（ZV, MZV, ZVD, EI, 2HUMP, 3HUMP）
   - MZV 是 Klipper 开发者独创的折中方案
   - ADXL345 加速度计实现自动调谐

4. **Pressure Advance**:
   - 按速度补偿挤出压力，消除 corner 处的过度挤出
   - Z 轴平滑时间滤波减少噪声

5. **Jinja2 宏系统**:
   - 完整的 Jinja2 模板引擎 + G-code 命令
   - 基于 printer 状态变量的条件判断和循环
   - 无需编译，修改配置文件后立即生效

6. **无编译配置**:
   - printer.cfg 纯文本配置
   - MCU firmware 只需编译一次
   - 所有参数可通过 printer.cfg 或 g-code 命令运行时修改

7. **Python 扩展生态**:
   - klippy/extras/ 目录是标准的 Python 扩展机制
   - G-code macro 无需 Python 知识 — 只写 G-code
   - 自定义 kinematics 仅需编写 Python + C 绑定

8. **多 MCU 原生支持**:
   - 多个 MCU 通过时钟同步协调
   - CANBus 连接多 MCU 降低布线复杂度
   - steppersync 队列确保多 MCU 步进同步

### 6.2 标志性功能或设计理念

- **"上位机计算，下位机执行"** — Klipper 的核心哲学：复杂的数学和算法在上位机 Python 完成，MCU 仅负责精确执行
- **"Input Shaper 作为标配"** — 几乎所有 Klipper 用户都启用 Input Shaper，已成为高速 3D 打印的必备功能
- **"无编译配置"** — 将配置修改从 30 分钟就地降至 30 秒
- **"Python 核心 + C 加速"** — Klipper 将 Python 带入实时控制领域，C helper 仅用于性能关键路径
- **"社区驱动"** — 庞大的 G-code 宏社区（Voron Klipper Macros）是 Klipper 的扩展爆点

### 6.3 创新设计哲学

#### "分布式"设计哲学

Klipper 最根本的设计决策是 **"计算在哪里"**：

```
传统 3D 打印机（Marlin / Smoothieware）:
  MCU 做所有: G-code parsing + step generation + timing + temperature
  -> 8-bit AVR ~16MHz, 2KB SRAM -> 计算瓶颈

Klipper:
  Host (1.5GHz ARM Cortex-A53) -> Python 运动规划 + Input Shaper + macro
  MCU (8-bit / 32-bit) -> timer-based step execution only
  -> Host 计算资源相对 MCU 来说是无限的
```

#### "Step Compression" 设计

Klipper 的步进压缩算法目的是以最小带宽在 Host 和 MCU 之间传输大量的 step 事件：

```
Host 侧:
  itersolve.c   ->   step time series (10,000 steps/move)
  stepcompress.c ->   (interval, count, add) compression (>1000 step/command)
  = 约 10x-50x 压缩率

MCU 侧:
  queue_step -> per-stepper move queue
  stepper.c  -> timer-based execution
```

---

## 7. 对 AUDESYS 的参考价值

### 7.1 分布式架构对 Runtime 和 HAL 设计

Klipper 的 **Host (Linux) + MCU (8/32-bit) 分布式** 架构为 AUDESYS Runtime 提供了三种直接参考：

#### 1) Host-MCU 分离模型

Klipper 将计算和执行的物理分离对应到 AUDESYS Runtime 的"控制面"与"实时面"分离：

```
AUDESYS Runtime 的 Host-MCU 分离设想:

Host Layer (Linux Application)
  +----------------------------------+
  | AUDESYS Studio IDE / Simulator   |
  | Python / C++  Runtime Logic      |
  |  - Control Logic Execution       |
  |  - 宏 / 脚本引擎                 |
  |  - HMI 通信                      |
  +----------------------------------+
        | JSON-RPC/FlatBuffers IPC
        |
        v
MCU Layer (Real-time HAL)
  +----------------------------------+
  | AUDESYS HAL MCU (STM32/ESP32)    |
  |  - 定时 I/O                      |
  |  - 精确 Timer (PWM/GPIO)         |
  |  - 传感器 Polling                |
  |  - 实时响应 (RT thread)          |
  +----------------------------------+
```

Klipper 的经验说明：将实时控制路径与非实时管理路径分离是可行的，并且可以在资源受限的 MCU 上实现确定性行为。AUDESYS Runtime 可以将复杂的控制逻辑（脚本、配置、HMI）放在 Host 层，而将确定性的 I/O 扫描和实时响应放在 MCU 层。

#### 2) MCU 协议设计参考

Klipper MCU 协议的关键设计决策值得 AUDESYS HAL 参考：

| Klipper MCU Protocol | AUDESYS HAL 参考 |
|---------------------|----------------------|
| 轻量级 RPC 机制 | HalTransport 可在 RPC + Signal/StreamChannel 中选择 |
| DECL_COMMAND / sendf 宏 | AUDESYS 可参考 MCU 侧的 HAL API 声明语法 |
| VLQ 编码 — 最小带宽 | FlatBuffers 也需要关注 MCU 侧的最小 footprint |
| Data Dictionary — 动态生成 | HalDiscovery 的设备发现和数据类型描述机制 |
| CRC + sequence number => error-free channel | 实时 + 仿真双模式的 reliability 策略 |
| Window 传输 + Ack/Nak | 控制面可靠传输协议参考 |

#### 3) 通信抽象的层次化

Klipper 通过切换 UART/USB/SPI/CAN 来实现 Host-MCU 通信而不修改 MCU 代码：

```
MCU <-> Host: Serial => USB => CANBus => SPI =>（仅改 Makefile 的通信接口配置）
```

AUDESYS HAL 可同样实现 `HalTransport` 的统一通信抽象，通过切换 Transport Backend 来支持 UART / USB / CAN / TCP / UDS 等多种物理链路，而不修改上层的控制逻辑。

### 7.2 实时运动规划分离

Klipper 的关键技术创新在于 **"非实时计算由上位机完成，实时执行由 MCU 完成"**。这直接对应到 AUDESYS Runtime 设计的核心问题 — "实时性和仿真模式的分离"：

```
Klipper 的分层:

| 层       | 功能                    | 实时性    | 编程语言 |
|---------|------------------------|----------|---------|
| Host    | G-code parsing          | 非实时   | Python  |
| Host    | Look-ahead motion       | 近实时   | Python  |
| Host    | Input Shaper            | 近实时   | C       |
| Host    | Step time solver        | 近实时   | C       |
| MCU     | Step pulse generation   | 硬实时   | C ISR   |
```

**AUDESYS Runtime 的分层建议**:

```
| 层       | 功能                    | 实时性    |
|---------|------------------------|----------|
| 管理面  | Configuration, REST    | 非实时   |
| 控制面  | 运动规划、I/O 扫描      | 近实时   |
| 实时面  | HAL Transport, ASIC    | 硬实时   |
```

Klipper 的这套 "Host + MCU" 设计 + C Helper 库 + Python 管理 = AUDESYS Runtime 可以借鉴 **同一 CPU 上的分层**（SCHED_OTHER + SCHED_FIFO）**或不同 CPU 上的分离**（Host + MCU）架构。

### 7.3 Input Shaper 对 HAL 设计的参考

Input Shaper 的实现位于 `klippy/chelper/input_shaper.c`，通过 ffi 桥接 Python <-> C：

AUDESYS HAL 如果需要在多个节点间进行运动规划/控制/响应，可以采用 **Filter Chain 设计** — 在每个 Motion Generator → Actuator 之间串联 filter：

```
AUDESYS HAL Filter Chain 设计:

Sensor Input -> Kinematic -> Filter 1 (Input Shaper)
                             -> Filter 2 (Low-pass)
                             -> Filter 3 (Dead-band)
                                -> Actuator Output
```

这也符合 Klipper 的 "Kinematics + Input Shaper" 模式：先解运动学 → 再过 Input Shaper 的 filter。AUDESYS HAL 如果处理运动控制类任务，可以借鉴这种链式滤波架构。

### 7.4 Python 扩展生态

Klipper 证明了 **Python 在实时控制系统的 Host 层** 的可行性：

```python
# Klipper 的 extras/ 架构 — 任何 Python 脚本都可以扩展系统
class MyModule:
    def __init__(self, config):
        self.printer = config.get_printer()
        # Klipper 的 event handler system
        self.printer.register_event_handler(
            "klippy:connect", self._handle_connect
        )

    def _handle_connect(self):
        # 扩展逻辑
        pass
```

**AUDESYS 参考**: AUDESYS Studio IDE / Simulator 可以用 Python 作为脚本/扩展语言：

- Klipper 的 extras/ — Python 脚本可动态加载到 Runtime
- Moonraker 的 plugins/ — JSON-RPC API 扩展
- Mainsail + Fluidd — Vue.js/React Web UI 前端

```
AUDESYS Python 扩展架构设想:

  Base Runtime (C++/Rust)
    |
    +-- Python 扩展:
    |     - Control scripts（控制逻辑）
    |     - I/O Handler (Modbus, GPIO)
    |     - Custom logic（自定义规则引擎）
    |
    +-- HMI 前端:
    |     (Web UI for dashboard)
    |
    +-- Studio 扩展:
          (Plugin-based IDE 扩展)
```

### 7.5 G-code 宏系统对 AUDESYS 脚本引擎的参考

Klipper 的 `[gcode_macro]` + Jinja2 模板引擎提供了一个强大的、无需编译的脚本系统，这对 AUDESYS Studio IDE 的脚本引擎设计有直接参考：

**AUDESYS 参考**: AUDESYS Studio IDE 可以设计类似的宏/脚本系统，用于编写控制逻辑序列：

```jinja2
# AUDESYS 可能的宏语法（参考 Klipper 的 Jinja2 模式）
[macro START_CYCLE]
type: motor_control
description: 启动控制循环
script:
    {% if state.machine_running %}
        {% call rollback() %}
            # 故障回滚逻辑
            {% if sensor.temperature > limits.max_temp %}
                emergency_stop(reason="温度超限")
            {% endif %}
        {% endcall %}
    {% endif %}
```

AUDESYS 的脚本系统不需要完整 Python，可以像 Klipper 一样使用轻量级模板语言 + 预定义的控制命令来组合逻辑。这比 IEC 61131-3 的完整语言覆盖更轻量、更易学。

### 7.6 Klipper MCU 协议与 AUDESYS HAL 的详细对比

| 维度 | Klipper MCU Protocol | AUDESYS HAL（设计） |
|------|---------------------|-------------------|
| 通信目标 | Host <-> MCU 实时步进控制 | 分布式节点间实时数据交换 |
| 原语 | step/endstop/pwm/temperature | Signal + StreamChannel + RPC 三原语 |
| 接口声明 | DECL_COMMAND + sendf C 宏 | HalTransport trait（Rust） |
| 类型描述 | Data Dictionary (JSON) | FlatBuffers Schema (.fbs) |
| 序列化 | zlib + binary + VLQ | FlatBuffers（零拷贝） |
| 实时保证 | Step Queue 精确计时 | HalQoS deadline + liveliness |
| 发现机制 | clock sync / timer | HalDiscovery（anycast/group/unicast） |
| 可靠性 | CRC + Seq + Ack/Nak | amw 传输层决定 |

Klipper MCU Protocol 的精髓是 **"简单可靠"**：每个消息块 5-64 字节，VLQ 编码，CRC 校验，Sequence Number 确认。这与 AUDESYS HAL 设计中的 Signal（单写多读最新值）和 StreamChannel（多写多读有缓冲队列）形成了有趣的对比：

- Klipper 的协议本质是 RPC 风格（命令-响应）
- AUDESYS HAL 提供了更丰富的原语集（Signal + StreamChannel + RPC）
- Klipper 证明了在 MCU 侧实现极简协议栈是可行的
- AUDESYS HAL 的 FlatBuffers + HalDiscovery 提供了更强大的异构互操作性

### 7.7 分布式架构在工业控制中的映射

| 维度 | Klipper | AUDESYS |
|------|---------|---------|
| 架构模式 | Host + MCU（分布式 + 嵌入式） | Host + HAL（分布式 + 实时层） |
| 目标领域 | 3D 打印运动控制 | 工业控制系统仿真/运行 |
| 显示/UI | Mainsail FFF (Vue.js) | Studio IDE（Tauri + React） |
| 技术栈 | Python + C | Rust + C++ + Python（分层） |
| 扩展性 | Python extras + Moonraker plugins | 动态加载 + 脚本引擎（规划中） |
| 实时层 | 25 us 步进精度 MCU | HalTransport + RT thread（规划中） |
| 许可 | GPL-3.0 | Apache 2.0（规划中） |
| 发布 | Rolling Release | 语义化版本（规划中） |
| 硬件需求 | Raspberry Pi + 任意 MCU | 工业 PC / 嵌入式网关（规划中） |

### 7.8 核心参考价值总结

Klipper 为 AUDESYS 提供了四个层面的参考价值：

1. **架构设计**: 分布式 Host-MCU 分离模式可直接映射到 AUDESYS Runtime 的 Management + Control 分层设计。Klipper 证明了将计算密集型任务（运动规划、脚本引擎）放在 Host 层、精确实时执行放在 MCU 层的可行性。

2. **通信协议**: Klipper MCU Protocol 的极简 RPC 设计（消息块 5-64B、VLQ 编码、CRC 校验、Data Dictionary 动态类型描述）为 AUDESYS HAL 的 MCU 侧通信提供了"最少字节原则"的参考。AUDESYS HAL 的 HalTransport 需要同时管理 RPC（控制命令）和 Signal/StreamChannel（数据流），Klipper 证明了在 MCU 侧保持协议栈精简的重要性。

3. **Python 扩展生态**: Klipper 的 extras/ 架构证明 Python 作为上位机脚本/扩展语言完全可行。AUDESYS Studio IDE 和 Simulator 可以参考此模式，将 Python 作为扩展接口语言（非实时路径），降低控制逻辑开发的灵活性和门槛。

4. **Input Shaper 的 Filter Chain**: Klipper 的 Input Shaper 链式架构（kinematics -> shaper -> stepgen）可推广到 AUDESYS HAL 的通用 Filter Chain 设计，用于处理信号的滤波、补偿、限幅等预处理。

---

> **本文档基于 2026 年 7 月的公开信息编写。部分数据（如 GitHub Stars、版本号）可能随 Klipper 版本迭代而变化。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从官方仓库验证。**