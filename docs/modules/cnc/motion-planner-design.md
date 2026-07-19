# AUDESYS 运动规划器 (Motion Planner) 设计

> 生成日期：2026-07-19
> 依赖决策：D10 (通信原语 Signal/StreamChannel/RPC), D13 (混合线程调度), D17 (Config Barrier + LockLevel), D55 (G-code→HAL IR 编译策略)
> 设计目标：将 G1 目标位置分解为逐周期位置增量，在数百个扫描周期内完成从起点到终点的速度控制运动
> 参考项目：LinuxCNC (4 层模型 UI→Task→Motion→HAL), GRBL (梯形速度剖面 + 前瞻规划), Klipper (look-ahead queue + trapq + itersolve)

---

## 1. 概述

### 1.1 运动规划器在 AUDESYS 中的定位

AUDESYS Runtime 是扫描周期引擎（scan-cycle engine），默认周期 10ms。G-code 编译器将运动指令（G0/G1）编译为 HalProgram 中的 IR 指令流，运动规划器的职责是在这些指令**执行阶段**（而非编译阶段）计算每个周期的目标位置增量。

**核心功能**：接收 G-code 编译产生的运动块（motion block），对每个运动块计算梯形速度剖面，在数百个 RT 周期内逐周期输出位置命令 Signal。

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDESYS CNC 数据流                           │
│                                                                 │
│  G-code 文本 → G-code Compiler → HalProgram (IR)                │
│                                       │                         │
│                                       ▼                         │
│  HalProgram → HAL VM → motion block Signal 组                   │
│                                       │                         │
│                                       ▼                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Motion Planner (本设计)                      │   │
│  │                                                         │   │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │   │
│  │  │ Look-ahead    │  │ Trajectory    │  │ Axis Output  │  │   │
│  │  │ Ring Buffer   │→ │ Generator     │→ │ Signals      │  │   │
│  │  │ (G64 blending)│  │ (梯形/S曲线) │  │ (F64 pos/vel)│  │   │
│  │  └──────────────┘  └───────────────┘  └──────┬──────┘  │   │
│  └───────────────────────────────────────────────┼────────┘   │
│                                                   │             │
│                                                   ▼             │
│  motion.axis.{n}.pos(F64) → PID Controller → StepGen Output    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 参考架构：LinuxCNC 4 层模型中的 Motion 层

LinuxCNC 将 CNC 系统分为四层，运动规划器位于 **Motion 控制器 (EMCMOT)**：

| 层 | 名称 | 实时性 | 与 AUDESYS 对应 |
|----|------|:---:|------|
| UI 层 | GUI (Axis, Gmoccapy, QtVCP) | 非实时 | Studio IDE |
| Task 层 | EMCTASK — G-code 解析与任务协调 | 非实时 | G-code Compiler |
| **Motion 层** | **EMCMOT — 轨迹规划、前瞻、PID** | **RT 线程 (SCHED_FIFO)** | **Motion Planner (本文档)** |
| HAL 层 | Pins + Signals + Functions | RT + 用户态 | HAL Signal System |

LinuxCNC 的 EMCMOT 是整个系统的计算核心，承担轨迹规划（trapezoidal generator）、前瞻（look-ahead）、PID 闭环三大职责。AUDESYS 将这三者拆分为独立模块——Motion Planner 仅负责轨迹规划与前瞻，PID 作为独立 Component 通过 Signal 与 Planner 通信。

### 1.3 设计约束与假设

| 约束 | 说明 |
|------|------|
| **周期时间** | 默认 10ms，可配置为 1ms（伺服线程）。运动规划器完全依赖周期时间计算位置增量 |
| **扫描周期模型** | 每个周期 Planner 在 RT 线程的 `update()` 阶段执行（参见 thread-scheduling-design.md §3.2） |
| **Phase 1 策略** | IR-based per-cycle stepping: `step = feedrate × cycle_time`，周期边界输出 |
| **Phase 2 升级** | Runtime co-processor 模式：运动规划器独立于扫描周期，以更高频率（如 1ms）输出位置 |
| **Config Barrier** | 所有运动参数（加速度、最大速度、前瞻深度）在 RT 周期边界应用（D17） |

---

## 2. 梯形速度剖面 (Trapezoidal Velocity Profile)

### 2.1 剖面定义

梯形速度剖面是工业 CNC 的标准运动曲线，将运动段 (motion segment) 的距离 `S` 分解为三个阶段：

```
            velocity
              │
   nominal_v ─┤        +──────────────+
              │        /                \
              │       /                  \
              │      /                    \
entry_v ──────┤─────+                      +────── exit_v
              │
              │← accel →←── cruise ──→← decel →
              │         plateau              │
              └────────────────────────────────────→ time
```

三个阶段的距离计算：

- **加速段距离**: <code>D<sub>accel</sub> = (v<sub>nominal</sub><sup>2</sup> − v<sub>entry</sub><sup>2</sup>) / (2 × a)</code>
- **减速段距离**: <code>D<sub>decel</sub> = (v<sub>nominal</sub><sup>2</sup> − v<sub>exit</sub><sup>2</sup>) / (2 × a)</code>
- **匀速段距离**: <code>D<sub>cruise</sub> = S − D<sub>accel</sub> − D<sub>decel</sub></code>

**三角形剖面**（段太短，无法达到 nominal velocity）：当 <code>D<sub>accel</sub> + D<sub>decel</sub> > S</code> 时，剖面退化为纯加速→立即减速。GRBL 使用 `intersection_distance()` 计算交点速度 `v_intersection`：

<code>v<sub>intersection</sub> = sqrt((2 × a × S + v<sub>entry</sub><sup>2</sup> + v<sub>exit</sub><sup>2</sup>) / 2)</code>

### 2.2 逐周期位置分解

运动规划器在每个 RT 周期 `update()` 中执行以下计算：

```
给定: motion block = {entry_v, nominal_v, exit_v, accel, total_distance}
      cycle_time = 10ms (可配置)

每个周期:
  1. 计算当前期望速度 v_target(t):
     - 加速阶段: v(t) = v_entry + a × t
     - 匀速阶段: v(t) = v_nominal
     - 减速阶段: v(t) = v_nominal − a × (t − t_decel_start)
  2. 位置增量: Δpos = v_target(t) × cycle_time
  3. 累加位置: pos = pos + Δpos
  4. 发布 Signal: motion.axis.{n}.pos = pos
```

**关键假设**：Phase 1 中，周期时间 (`cycle_time`) 固定且确定。步进生成器（StepGen Component）读取 `motion.axis.{n}.pos` 并按自己的步进脉冲分辨率（microsteps/mm）二次分解。

### 2.3 运动块参数表

| 参数 | 类型 | 来源 | 说明 |
|------|------|------|------|
| `entry_velocity` | F64 | Look-ahead (前一块的 `exit_velocity`) | mm/s |
| `nominal_velocity` | F64 | G-code F 参数（限制于 axis 最大速度） | mm/s |
| `exit_velocity` | F64 | Look-ahead（后一块的 `entry_velocity`） | mm/s |
| `acceleration` | F64 | 轴配置（取所有参与轴的最小值） | mm/s² |
| `total_distance` | F64 | G-code 编译器计算（起点→终点欧氏距离） | mm |
| `start_position` | F64[6] | 当前轴位置（上一块终点） | mm |
| `target_position` | F64[6] | G-code 目标坐标 | mm |

**多轴合成加速度**：当运动段涉及 N 个轴时，合成加速度 `a_synthetic = min(axis[0].accel, axis[1].accel, …, axis[N-1].accel)`。各轴沿合成路径的投影比例由起点→终点向量决定。

### 2.4 梯形剖面与 GRBL 对比

GRBL 的 `calculate_trapezoid_for_block()` 在步进空间（step count）中计算梯形参数：

| 参数 | GRBL (step 空间) | AUDESYS (距离空间) |
|------|:---:|:---:|
| 加速段长度 | `accelerate_steps` | `D_accel` (mm) |
| 匀速段长度 | `plateau_steps` | `D_cruise` (mm) |
| 减速段长度 | `decelerate_steps` | `D_decel` (mm) |
| 段总长 | `step_event_count` | `total_distance` (mm) |
| 速率转换 | steps/min → steps/s | mm/min → mm/s |

AUDESYS 在距离空间计算的优势：避免步进脉冲分辨率（microsteps/mm）变化时需重新烘焙剖面参数。StepGen Component 在获取 `motion.axis.{n}.pos` Signal 后自行完成从 mm 到 step pulse 的转换。

---

## 3. S曲线 (S-Curve Velocity Profile)

### 3.1 梯形剖面的局限性

梯形剖面在加速/减速的起始点存在**加速度突变**（jerk = da/dt → ∞），导致机械冲击和振动。工业高端 CNC 使用 S曲线（S-Curve）控制 jerk 为有限值。

```
            velocity                          jerk
              │                                │
              │       ┌──────────┐             │  +j_max ─┐
              │      /            \            │          │
              │     /              \           │          │         ┌───────
              │    /                \          │          └─────────┘
              │   /                  \         │
              └──┘                    └─────── │─────────────────────────→ time
                ↑← 7-phase profile →↑         │          ┌─────────┐
                                               │          │
                                               │  ────────┘         └───────
                                               │  -j_max            ┌───────
```

### 3.2 7 阶段剖面

S曲线将梯形剖面的 3 阶段扩展为 7 阶段，每个阶段 jerk 为常量 (+j_max, 0, 或 −j_max)：

| 阶段 | 名称 | jerk | 加速度变化 | 说明 |
|------|------|:---:|------|------|
| 1 | 加加速度段 (Jerk-up) | +j_max | 0 → +a_max | 加速度从 0 线性增长到 a_max |
| 2 | 匀加速段 (Constant accel) | 0 | +a_max (恒定) | 以最大加速度持续加速 |
| 3 | 减加速度段 (Jerk-down) | −j_max | +a_max → 0 | 加速度减小到 0，速度达到 nominal_v |
| 4 | 匀速段 (Constant velocity) | 0 | 0 | 恒速巡航 |
| 5 | 加减速度段 (Jerk-down) | −j_max | 0 → −a_max | 开始减速 |
| 6 | 匀减速段 (Constant decel) | 0 | −a_max (恒定) | 以最大减速度持续减速 |
| 7 | 减减速度段 (Jerk-up) | +j_max | −a_max → 0 | 减速度恢复到 0，速度达到 exit_v |

**三角 S 曲线**：当段太短无法达到 a_max 时，阶段 2 和/或阶段 6 消失，剖面退化为 5 阶段或 3 阶段。

### 3.3 Phase 1 策略：线性段近似

S曲线计算涉及三次多项式（jerk 积分），在 Phase 1 的 IR 逐周期步进模型中**实时计算复杂度可接受**——每个周期仅需计算 `v(t) = ∫a(t)dt`。但为避免 Phase 1 过度工程化：

| Phase | 剖面模型 | 实现方式 |
|:---:|------|------|
| **Phase 1** | **梯形剖面** | 逐周期线性插值：`v(t) = v_prev + a × cycle_time` |
| **Phase 2** | **S曲线（7 阶段）** | Runtime co-processor 独立计算（不受扫描周期限制） |
| **Phase 3** | **自适应 jerk** | 根据轴刚度和负载质量动态计算 j_max（需频率响应测试） |

**Phase 1 取舍理由**：梯形剖面覆盖 90% 以上工业场景（GRBL, Klipper, Marlin 均默认梯形剖面）。S曲线在 10ms 扫描周期下机械冲击差异不可感知——step pulse 到物理轴经过步进驱动器 + 微步 + 电机电感滤波后已自然平滑。S曲线在 Runtime co-processor (1ms 或更高频率) 阶段引入价值更大。

---

## 4. 前瞻规划 (Look-ahead Planning)

### 4.1 问题：无前瞻的后果

没有前瞻的运动规划器遇到以下 G-code 序列时会减速到 0：

```gcode
G1 X10 Y0 F6000   ; 长直道，期望以 6000 mm/min 运行
G1 X10 Y10 F6000  ; 90° 转角 — 必须减速通过
G1 X20 Y10 F6000  ; 再次直道
```

无前瞻：每段独立规划 → 段边界处 `exit_v = 0` → 每段都经历完整加速→匀速→减速。总运动时间约为前瞻版本 **3-5 倍**。

### 4.2 前瞻规划的核心算法

**GRBL / Klipper 的共同模式**：两遍遍历 (two-pass) 优化运动块间的连接速度：

```
┌────────────────────────────────────────────┐
│         Look-ahead Ring Buffer (N blocks)   │
│                                            │
│  [Block 0] ← [Block 1] ← ... ← [Block N]  │
│     │            │                │        │
│     └────────────┴────────────────┘        │
│              Reverse Pass                  │
│    (从最后块逆向遍历，计算最大入口速度)     │
│                                            │
│     ┌────────────┬────────────────┐        │
│     │            │                │        │
│     └────────────┴────────────────┘        │
│              Forward Pass                  │
│    (从第一块正向遍历，修正加速可行性)       │
└────────────────────────────────────────────┘
```

#### Reverse Pass（逆向遍历）

从最后一块回溯到第一块，约束：每块的 `entry_v` 必须满足从 `entry_v` 减速到下一块 `entry_v` 的距离不超过当前块总距离：

<code>entry_v<sub>max</sub>[i] = min( nominal_v[i], sqrt(exit_v[i+1]<sup>2</sup> + 2 × a × S[i]) )</code>

#### Forward Pass（正向遍历）

从第一块遍历到最后一块，约束：每块的 `exit_v` 必须满足从 `entry_v` 加速到 `exit_v` 的距离不超过当前块总距离：

<code>exit_v<sub>max</sub>[i] = min( entry_v[i+1], sqrt(entry_v[i]<sup>2</sup> + 2 × a × S[i]) )</code>

**最终逐块速度**：`entry_v[i] = min(reverse_pass_entry[i], forward_pass_entry[i])`

### 4.3 转角速度 (Corner Velocity)

前瞻规划的核心价值在于计算连续运动段之间的**转角速度**——即上一段的 `exit_v` = 下一段的 `entry_v` = `v_corner`。

#### 基于转弯半径的转角速度

对于 G64 连续路径模式，转角速度由**向心加速度约束**决定：

<code>v<sub>corner</sub> = sqrt(a<sub>max</sub> × r<sub>turn</sub>)</code>

其中 `r_turn` 为转角半径，由相邻两段的**路径夹角 θ** 和**允许的最大路径偏差 δ** (corner tolerance) 计算：

<code>r<sub>turn</sub> = δ × (1 − cos(θ)) / sin(θ)</code>

路径夹角 θ 由两段方向向量的点积计算：

<code>cos(θ) = (v<sub>1</sub> · v<sub>2</sub>) / (|v<sub>1</sub>| × |v<sub>2</sub>|)</code>

#### Klipper square_corner_velocity 模型

Klipper 使用更简化的模型，直接指定转角速度上限：

```yaml
square_corner_velocity: 5.0  # mm/s — 90° 转角的最大通过速度
```

转角速度 <code>v<sub>corner</sub>(θ) = min( nominal_v × sin(θ/2), square_corner_velocity × f(θ) )</code>

AUDESYS Phase 1 采用此简化模型，Phase 2 引入完整转弯半径计算。

### 4.4 环缓冲 (Ring Buffer) 设计

前瞻规划使用环缓冲存储运动块，避免每次 G-code 行都触发完整两遍遍历：

| 参数 | Phase 1 默认值 | 说明 |
|------|:---:|------|
| 缓冲数量 (N) | 16 | 借鉴 GRBL。16 块足够覆盖绝大多数复杂 G-code 路径 |
| 触发重计算 | 新块入队时 | 仅需对新增块及其前驱块运行 reverse pass |
| 前瞻时间窗口 | N × (S/v_nominal) | 典型路径中约 100-500ms 前瞻 |
| 内存占用 | 16 × 约 128 bytes = 2KB | 运动块结构体紧凑（F64 × 6 坐标 + F64 × 4 速度 + 标志位） |

**环缓冲与 Config Barrier 的交互**：前瞻缓冲位于 Motion Planner Component 内部，修改前瞻参数（buffer 大小、square_corner_velocity）通过 RPC → Config Barrier 在下一个周期边界生效。

### 4.5 与 Klipper Look-ahead 对比

| 特性 | Klipper | AUDESYS Phase 1 |
|------|------|------|
| 前瞻位置 | 上位机 (Python/C helpers) | Runtime RT 线程 |
| 数据队列 | trapq (C, linked list) | Ring Buffer (fixed array) |
| 步进时间求解 | itersolve (Secant Method) | 无（Phase 1 用匀速步进） |
| 最小前瞻距离 | 0.5-1.0s move time (可配) | 16 块 |
| junction 计算 | `calc_junction(prev_move)` | `accel_from_turn_radius(θ, δ)` |

---

## 5. 路径混合 (Path Blending)

### 5.1 精确停止 vs 连续路径

| 模式 | G-code | 行为 |
|------|--------|------|
| **Exact Stop (精确停止)** | G61 | 每个运动段结束处完全停止 (`exit_v = 0`)，确保精确到达目标点 |
| **Exact Path (精确路径)** | G61.1 | 路径无偏差，段间连续但速度可能降至 0 |
| **Continuous Path (连续路径)** | **G64** | 允许路径偏差 δ，段间不减速（或减速到转角速度），最大化吞吐 |

G64 是实际生产中最常用的模式（LinuxCNC 默认模式），也是 AUDESYS 前瞻规划的默认路径模式。

### 5.2 G64 路径混合参数

```yaml
G64 P{Q}:
  P: 路径偏差容忍度 (corner tolerance)，单位 mm
     默认: P0.0 (无偏差容忍 → 降至 G61)
  Q: 前瞻距离 (look-ahead distance)，未指定时使用默认前瞻深度

示例:
  G64 P0.05     # 允许路径偏离编程路径最多 0.05mm
  G64 P0.1 Q100 # 允许 0.1mm 偏差，前瞻至少 100mm
```

**G64 + 转角速度的协同**：

- **大转角 (θ ≈ 90°)**：δ 限制转角速度 → 段边界处大幅减速
- **小转角 (θ ≈ 5°)**：δ 允许高转角速度 → 几乎不减速，路径平滑过渡
- **直线 (θ = 0°)**：零转角 → `v_corner = v_nominal`，无缝过渡

### 5.3 路径偏差约束

当 G64 指定了 `P` 值，转角速度的上限需要满足：

<code>v<sub>corner</sub> ≤ sqrt( a<sub>max</sub> × δ × (1 − cos(θ)) / sin(θ) )</code>

**物理意义**：转角速度越快，刀具/主轴因惯性无法精确跟随编程路径，产生的路径偏差 `δ_actual` 越大。约束保证 `δ_actual ≤ δ`。

### 5.4 Phase 1 路径混合策略

| 模式 | 支持 | 行为 |
|------|:---:|------|
| G61 (Exact Stop) | ✅ | 每个块 `exit_v = 0`，无前瞻优化 |
| G64 (Continuous Path) | ✅ | 前瞻规划启用的默认模式 |
| G64 P{Q} | ✅ | 支持 corner tolerance 前缀 |
| G64 动态混合 | 🟡 Phase 2 | 根据路径曲率自适应调整 δ |

Path blending 不引入新通信原语——前瞻结果写入运动块的 `entry_velocity` / `exit_velocity`，通过现有 Signal 接口传递。

---

## 6. 多轴同步

### 6.1 轴协调模型

CNC 运动规划的核心挑战是多轴**同步**——所有参与轴必须在同一时刻到达各自的目标位置。AUDESYS 采用**主时间轴** (master time axis) 模型：

```
所有参与轴共享同一个梯形剖面。
合成距离 S_synthetic = sqrt(Σ(delta_i²))
合成速度 v_synthetic(t) = trapezoid_profile(t, S_synthetic, ...)
每轴位置: pos_i(t) = start_i + (delta_i / S_synthetic) × ∫v_synthetic(t)dt
```

### 6.2 3 轴 + 旋转轴协调

AUDESYS Phase 1 支持标准 3 轴 Cartesian 运动 + 1 旋转轴 (A/B/C)：

| 轴 | 类型 | 坐标单位 | 速度单位 |
|----|------|------|------|
| X, Y, Z | 直线轴 (linear) | mm | mm/s |
| A, B, C | 旋转轴 (rotary) | 度 (°) | °/s |

**旋转轴分离计算**：旋转轴与直线轴的加速度维度不同（mm/s² vs °/s²），参与合成计算时使用**时间同步**而非距离同步：

- 直线轴合成平行四边形剖面（取最差轴的加速度）
- 旋转轴以相同的时间参数独立计算自己的梯形剖面
- 所有轴在相同的 `t_start`、`t_accel_end`、`t_decel_start`、`t_end` 时间节点完成

### 6.3 6 轴协调 (Phase 2+)

6 轴同步（3 直线 + 3 旋转）用于 5 轴 CNC 加工和工业机器人运动学：

```
直线轴组: X, Y, Z
旋转轴组: A (绕 X), B (绕 Y), C (绕 Z)
或 Stewart 平台并联运动学
```

| Phase | 轴数 | 运动学 | 说明 |
|:---:|:---:|------|------|
| Phase 1 | 3 + 1 | Cartesian + 独立旋转 | 标准 3 轴铣床 + 旋转工作台 |
| Phase 2 | 6 | 正向/逆向运动学 | 5 轴加工 + SCARA/Delta 机器人 |
| Phase 3 | 6+ | 自定义运动学模块 | 并联机构 (Stewart) + 冗余轴 |

### 6.4 多轴 Signal 布局

每个轴通过独立的 Signal 组暴露状态：

```yaml
motion.axis.x.pos:       F64  # X 轴当前位置 (mm)
motion.axis.x.velocity:  F64  # X 轴当前速度 (mm/s)
motion.axis.x.target:    F64  # X 轴当前段目标位置 (mm)
motion.axis.x.enable:    Bool # X 轴使能
motion.axis.y.pos:       F64  # Y 轴...
# ... 依此类推
motion.planner.active:   Bool # Planner 是否正在执行运动
motion.planner.line:     U32  # 当前执行的行号 (G-code line number)
```

---

## 7. Runtime 集成

### 7.1 运动块 Signal 接口

Motion Planner 与 Runtime 其他组件通过 HAL Signal 接口通信。运动块通过以下 Signal 组进入 Planner：

```yaml
# 每运动段发布一次（G-code 编译器 → Motion Planner）
motion.block_ready:           U8    # 新块就绪标志 (non-zero = ready)
motion.block.entry_velocity:  F64   # 入口速度 (mm/s)
motion.block.nominal_velocity: F64  # 名义速度 (mm/s)  
motion.block.exit_velocity:   F64   # 出口速度 (mm/s)
motion.block.acceleration:    F64   # 段加速度 (mm/s²)
motion.block.start_x:         F64   # X 起点 (mm)
motion.block.start_y:         F64   # Y 起点 (mm)
motion.block.target_x:        F64   # X 终点 (mm)
motion.block.target_y:        F64   # Y 终点 (mm)
# ... start_z / target_z / start_a / target_a 等扩展轴

# 反馈 (Motion Planner → Runtime)
motion.block.ack:             U8    # 块已接受 (echo block_ready)
motion.block.complete:        U8    # 块执行完毕 (1 = done)
motion.cycle.progress:        F64   # 当前块的完成进度 (0.0~1.0)
```

**握手协议**：

```
1. G-code 编译器: 写入 {entry_v, nominal_v, exit_v, accel, start_*, target_*}
2. G-code 编译器: 设置 motion.block_ready = 1
3. Motion Planner: 读取 block_ready → 复制参数到内部环缓冲 → 设置 block.ack = block_ready
4. G-code 编译器: 看到 ack == 1 → 准备下一块
5. Motion Planner: 执行完成后设置 motion.block.complete = 1
```

### 7.2 Config Barrier 集成 (D17)

所有运动规划器的配置参数通过 Config Barrier 在周期边界批量应用，确保**永不 mid-cycle 注入**：

```yaml
# 运动规划器可配置参数 (RPC → Config Barrier → 周期边界生效)
motion.config.max_velocity:        F64   # 全局最大速度 (mm/s)
motion.config.default_acceleration: F64  # 默认加速度 (mm/s²)
motion.config.corner_tolerance:    F64   # G64 路径偏差容忍 (mm)
motion.config.square_corner_velocity: F64 # 简化转角速度 (mm/s)
motion.config.lookahead_blocks:    U32   # 前瞻缓冲块数量 (1-64)
```

**LockLevel 约束**：

| LockLevel | 配置变更 | 行为 |
|-----------|:---:|------|
| `Config` | ✅ 允许 | 参数在下个周期边界生效 |
| `Setup` | ✅ 允许 | 同 Config |
| `Run` | ❌ 禁止 | RPC 直接返回 `ERR_LOCKED` |
| `Emergency` | ❌ 禁止 | 仅允许紧急停止 RPC |

### 7.3 RT 线程集成

Motion Planner 作为 HalComponent 注册到 RT 线程（参见 thread-scheduling-design.md §3.2）：

```yaml
# threads.yaml
threads:
  - name: motion-thread
    period_us: 1000          # 1ms (高速伺服线程)
    priority: 55             # SCHED_FIFO 55
    cpu_affinity: [2]
    functions:
      - component: motion-planner
        phase: update          # 仅在 update 阶段执行
      - component: pid-loop-x
        phase: update
        after: ["motion-planner.update"]   # PID 读取 Planner 输出的位置 Signal
      - component: pid-loop-y
        phase: update
        after: ["motion-planner.update"]
      - component: pid-loop-z
        phase: update
        after: ["motion-planner.update"]
```

**执行顺序**：Motion Planner `update()` → PID loop `update()` → StepGen `write()`。Planner 的 `update()` 在 `read_barrier()` 之后、`write_barrier()` 之前执行，与其他 Update 阶段 Component 共享同一周期。

### 7.4 与扫描周期引擎的关系

Phase 1 的 IR stepping 模型中，G-code 编译器已经将运动指令展开为 `STEP_X / STEP_Y / SET_POS` 等 IR 指令。Motion Planner 在以下场景发挥作用：

1. **纯 G1 路径**：如果 G-code 编译器选择"延迟规划"模式（将运动块参数通过 Signal 传给 Motion Planner 而非编译为 IR 步进循环），Planner 接管逐周期计算
2. **G64 路径混合**：需要前瞻优化的复杂路径，由 Planner 而非编译器处理
3. **Runtime 动态覆盖**：用户通过 Feed Override 旋钮实时调整进给速度，由 Planner 在周期内响应

**编译时 vs 运行时规划的分界线**：

| 场景 | 规划位置 | 原因 |
|------|:---:|------|
| 简单直线 (G1 无 G64) | G-code Compiler (编译时) | 梯形剖面参数完全已知 |
| 连续路径 (G64) | Motion Planner (运行时) | 需要前瞻多段、计算转角速度 |
| 快速定位 (G0) | G-code Compiler (编译时) | 直接写入目标位置，无需规划 |
| Feed Override | Motion Planner (运行时) | 周期内响应倍率变更 |

---

## 8. 实时性分析

### 8.1 周期时间预算

Motion Planner 在 RT 线程的 `update()` 阶段执行，必须在分配的时间预算内完成：

| 操作 | 典型耗时 (1ms 周期) | 典型耗时 (10ms 周期) | 备注 |
|------|:---:|:---:|------|
| 读取 motion block signal | < 0.1μs | < 0.1μs | Signal 读取为共享内存指针解引用 |
| 环缓冲入队 (1 块) | ~0.5μs | ~0.5μs | 固定大小数组写入 |
| Reverse Pass (16 块) | ~3μs | ~3μs | 两遍浮点乘法 + sqrt |
| Forward Pass (16 块) | ~3μs | ~3μs | 同上 |
| 梯形剖面更新 (1 块) | ~1μs | ~1μs | 加减 + 乘法 |
| 轴位置 Signal 发布 (6 轴) | ~0.3μs | ~0.3μs | 共享内存写入 |
| **Motion Planner 总计** | **~8μs** | **~8μs** | |
| RT 线程总预算 (含 PID+StepGen) | **~200μs** | **~2ms** | 1ms 周期的 20%，10ms 周期的 20% |

**结论**：在 1ms RT 线程中，Motion Planner 仅占用约 4% 的时间预算，留有充足余量。

### 8.2 SCHED_FIFO 优先级规划

| 线程 | 周期 | 优先级 | CPU | 说明 |
|------|:---:|:---:|:---:|------|
| safety-thread | 5ms | 60 (最高) | CPU 4 | 安全监控优先级最高 |
| motion-thread | 1ms | 55 | CPU 2 | Motion Planner + PID + StepGen |
| servo-thread | 1ms | 50 | CPU 3 | 其他伺服组件 (编码器回读等) |
| plc-scan-thread | 10ms | 45 | CPU 0-1 | PLC 逻辑扫描 |

### 8.3 前瞻深度 vs 内存权衡

| 前瞻块数 (N) | 前瞻窗口 (典型) | 内存 | 规划质量 | 适用场景 |
|:---:|------|:---:|:---:|------|
| 8 | ~50-250ms | 1KB | 一般 | 简单轮廓 (矩形、圆) |
| 16 | ~100-500ms | 2KB | 良好 | 标准 CNC 加工 (默认) |
| 32 | ~200ms-1s | 4KB | 优秀 | 复杂 3D 曲面精加工 |
| 64 | ~400ms-2s | 8KB | 最佳 | 高速加工 + 密集曲率变化 |

**内存约束**：Phase 1 默认 16 块 (2KB)，RT 线程预分配的栈内存内即可容纳。N=64 在 RAM 受限的嵌入式 MCU 上可能需要动态分配，列入 Phase 2 评估。

### 8.4 过运行保护

当 Motion Planner 的计算时间超过周期预算时：

1. **跳过迟到周期** — 追赶当前时间（与 thread-scheduling-design.md §3.4 一致）
2. **ALARM Signal** — `motion.planner.overrun` 设置为 `Bool(true)`
3. **降级策略** — Planner 自动切换到 G61 Exact Stop 模式（禁用前瞻），减少计算负载
4. **恢复条件** — 连续 10 个周期无过运行后自动恢复 G64

---

## 9. 限制与路线图

### 9.1 Phase 1 限定

| 限制 | 说明 | 缓解措施 |
|------|------|------|
| **梯形剖面 only** | 无 S曲线 jerk 控制 | 步进驱动器的微步平滑 + 电机电感自然滤波 |
| **10ms 位置更新** | 扫描周期频率上限 | 独立的 1ms motion-thread 提供更高频率输出 |
| **前瞻 16 块** | No adaptive depth | G64 Q 参数可让用户手动增加 |
| **Cartesian only** | 无并联运动学 | 3+1 轴覆盖 80%+ 工业场景 |
| **无 feed-per-revolution** | 主轴同步缺失 | Phase 2 加入主轴编码器回读 |
| **单线程规划** | Planner 非多线程 | 计算量足够小 (8μs/周期)，无并行需求 |
| **无动态加速度** | 加速度固定于轴配置 | Phase 2 加入负载自适应 |

### 9.2 路线图

```
Phase 1 (当前)                 Phase 2                     Phase 3
═══════════════               ════════════               ════════════

梯形剖面                       S曲线 (7阶段)               自适应 jerk
逐周期 IR stepping            Runtime co-processor         FPGA 加速器
Ring Buffer (16)              自适应前瞻深度              连续前瞻 (unlimited)
G64 简化转角速度              完整转弯半径计算             实时曲率分析
3 + 1 轴                     6 轴全协调                  并联运动学
单段梯形                      段间重叠加速                 最优时间轨迹
```

#### Phase 2: Runtime Co-processor

Phase 2 将 Motion Planner 从 RT 线程的 `update()` 函数升级为独立 co-processor 进程：

- **独立频率**：不受扫描周期限制，以 1ms (或更高) 频率独立运行
- **直接 HAL 访问**：通过共享内存直接读写 Signal，不经过周期屏障
- **前瞻增强**：自适应前瞻深度（根据路径曲率动态调整）
- **S曲线**：7 阶段 jerk-limited 剖面，消除加速度突变
- **螺旋插补 (G2/G3)**：圆弧→螺旋运动在 Planner 层支持（Phase 1 由 G-code 编译器处理）

#### Phase 3: 高级运动学

- **并联机器人运动学**：Stewart 平台、Delta 机器人
- **最优时间轨迹**：在加速度和 jerk 约束下，计算时间最优轨迹
- **FPGA 加速**：轨迹生成卸载到 FPGA 硬件加速器 (如 Mesa 卡)
- **实时曲率分析**：连续前瞻 + 动态 G64 偏差容忍

### 9.3 与参考系统的差异总结

| 特性 | LinuxCNC | GRBL | Klipper | AUDESYS Phase 1 |
|------|------|------|------|------|
| 剖面类型 | 梯形 | 梯形 | 梯形 | 梯形 |
| 前瞻算法 | T_P (task plane) | Reverse+Forward Pass | Look-ahead Queue | Reverse+Forward Pass |
| 执行模型 | RT 线程 C 函数 | 中断 ISR | Host Python + MCU C | RT 线程 Rust Component |
| 规划空间 | 距离空间 | 步进空间 (steps) | 距离空间 + 时间空间 | 距离空间 |
| 路径混合 | G61/G64 (P) | Junction deviation | square_corner_velocity | G64 P + square_corner_velocity |
| 多轴上限 | 9 轴 | 3 轴 (6 轴 grblHAL) | 取决于运动学 | 3 + 1 (Phase 1) → 6 (Phase 2) |
| 参数变更 | halcmd 运行时 | EEPROM 重读 (compile-time) | printer.cfg 重载 | RPC → Config Barrier |
| 语言 | C | C | Python + C | Rust |

---

## 10. 设计决策记录

| 决策 | 理由 |
|------|------|
| **Phase 1 使用梯形剖面** | 覆盖 90%+ 工业场景。GRBL/Klipper/Marlin 默认梯形。10ms 周期下 S曲线冲击差异不可感知 |
| **前瞻采用 Reverse+Forward Pass** | GRBL 验证的两遍遍历算法成熟、实现简单、确定性可审计 |
| **距离空间规划** | 避免步进脉冲分辨率变更时重新烘焙剖面参数。步进生成器独立完成 mm→step 转换 |
| **Signal 接口而非内存共享** | 与 HAL 协议设计一致（D10），Motion Planner 与其他 Component 通过标准 Signal 通信 |
| **Config Barrier 保护所有参数** | D17 要求。RT 周期内参数不可变防止 mid-cycle 注入 |
| **motin-thread 独立于扫描周期** | 运动控制需要更高频率 (1ms vs 10ms)。借鉴 ROS2 control 的独立 RT 线程模式 (D13) |
| **转角速度使用 square_corner_velocity 简化** | Klipper 验证的实用模型。Phase 2 升级到完整转弯半径计算 |
| **不引入第 4 种通信原语** | 现有 Signal/StreamChannel/RPC 三原语正交覆盖 (D10)。运动块参数通过 Signal 传递 |
| **6 轴协调后移至 Phase 2** | Phase 1 集中验证梯形剖面 + 前瞻在 AUDESYS 架构中的正确性。多轴运动学增加正交复杂度 |
