# AUDESYS 轴组设计

> 生成日期：2026-07-19
> 设计目标：为运动规划器层定义轴组概念——逻辑轴分组、坐标系统、回零序列、软限位和反向间隙补偿
> 依赖：D10 HAL 协议原语、D17 Config Barrier、`docs/modules/hal/hal-protocol-design.md`、`docs/modules/hal/io-mapping-design.md`

---

## 设计原则

1. **轴组是运动规划器层的逻辑构造**，不是 HAL 原语。轴组由运动规划器组件管理，通过 Signal 与下层 HAL 设备交互，不引入新的通信原语。
2. **所有轴参数变更遵循 Config Barrier (D17)**：参数通过 RPC 提交到 pending_config 队列，在 RT 周期边界批量应用，保证 RT 线程安全。
3. **Signal 驱动的状态机**：回零、报警、使能状态机通过 Signal 读/写实现，不依赖 RPC 同步阻塞。
4. **Phase 1 仅支持独立笛卡尔轴**：不涉及运动学变换（CoreXY、Delta、SCARA 等属于 Phase 3）。
5. **命名延续 gcode-compiler 的 `axis.N.*` 范式**（`axis.0`=X, `axis.1`=Y, `axis.2`=Z）。

---

## 1. 概述

### 1.1 轴组是什么

轴组（Axis Group）是运动规划器层将多个物理轴逻辑关联为一个工作单元的概念。典型的三轴铣床包含一个轴组 `group.0`，其中聚合 `axis.0` (X)、`axis.1` (Y)、`axis.2` (Z)。A/B/C 旋转轴可组成一个独立轴组 `group.1`，或在 Phase 3 与直线轴组成 5 轴联动组。

轴组的三个核心职责：

| 职责 | 说明 | 实现层 |
|------|------|--------|
| **轴集合管理** | 定义哪些物理轴属于一个逻辑加工单元 | 运动规划器 |
| **平面约束** | 将 G17/G18/G19 平面选择绑定到轴组中的特定轴对 | 运动规划器 |
| **协调执行** | 同轴组内的轴在相同 RT 周期内同步执行运动指令 | Runtime RT 调度表 |

### 1.2 轴组与 HAL 的关系

轴组**不**是 HAL 原生概念。HAL 只看到独立的 Signal 读/写：

```
┌─────────────────────────────────────────────────────────────┐
│  MotionPlanner Component (RT 线程)                          │
│                                                             │
│  AxisGroup {                                                │
│    name: "group.0",                                         │
│    axes: [axis.0, axis.1, axis.2],                         │
│    active_plane: G17,                                       │
│    work_offset: G54,                                        │
│    limits: [soft_min, soft_max],                                   │
│    backlashes: [0.05, 0.03, 0.02],                          │
│  }                                                          │
│                                                             │
│  每周期:                                                     │
│    ┌─ read axis.N.pos_fb (编码器反馈)                       │
│    ├─ read axis.N.limit_pos / limit_neg (限位状态)          │
│    ├─ compute: path planning → next target position         │
│    ├─ apply: backlash compensation                          │
│    ├─ enforce: soft limits check                            │
│    ├─ write axis.N.pos_cmd (目标位置)                       │
│    └─ write axis.N.vel_cmd (目标速度)                       │
└──────────────┬──────────────────────────────────────────────┘
               │ Signal reads / writes
               ▼
┌─────────────────────────────────────────────────────────────┐
│  HAL Signal Bus（不感知轴组概念）                             │
│    axis.0.pos_cmd → 伺服驱动器读取                           │
│    axis.0.pos_fb  ← 伺服驱动器写入                           │
│    axis.0.limit_pos ← I/O 映射层                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 参考系统

- **LinuxCNC**：HAL pins `axis.N.*` + `motion.axis-group.*` → AUDESYS 映射为 Signal `axis.N.*`
- **GRBL**：单轴组 3 轴固定（N_AXIS=3），无多轴组概念 → AUDESYS 泛化为多轴组
- **Machinekit**：多轴组模型（trivkins + kinematics）→ Phase 3 运动学阶段参考

---

## 2. 轴组概念

### 2.1 轴组定义

```yaml
# YAML 配置形式（构建时编译为 FlatBuffers）
axis_groups:
  - name: "group.0"
    label: "三轴铣床"
    axes:
      - { index: 0, label: "X", type: linear }
      - { index: 1, label: "Y", type: linear }
      - { index: 2, label: "Z", type: linear }
    kinematics: "trivial"   # Phase 1: trivial only
    default_plane: G17      # XY
    default_unit: G21       # mm

  - name: "group.1"
    label: "旋转工作台"
    axes:
      - { index: 3, label: "A", type: rotary, min: -360.0, max: 360.0 }
      - { index: 4, label: "B", type: rotary, min: -120.0, max: 120.0 }
    kinematics: "trivial"
    default_plane: null    # 旋转轴无平面约束
```

**索引约定**：`axis.0`–`axis.2` 为直线轴（X/Y/Z），`axis.3`–`axis.5` 为旋转轴（A/B/C）。Phase 1 仅支持 `axis.0`–`axis.2`。

### 2.2 平面选择 — G17 / G18 / G19

G-code 中 `G17` (XY)、`G18` (ZX)、`G19` (YZ) 选择圆弧插补平面和刀具补偿平面。在 AUDESYS 中，平面选择被解析为轴组内轴索引的绑定：

| G-code | 平面 | 第一轴（弧半径方向） | 第二轴（弧切线方向） | 纵向轴（钻孔/补偿轴） |
|--------|------|---------------------|---------------------|----------------------|
| G17 | XY | axis.0 (X) | axis.1 (Y) | axis.2 (Z) |
| G18 | ZX | axis.2 (Z) | axis.0 (X) | axis.1 (Y) |
| G19 | YZ | axis.1 (Y) | axis.2 (Z) | axis.0 (X) |

平面选择存储在轴组的运行时状态中，作为 G-code 模态状态的一部分（见 `gcode-compiler-design.md` §模态解析 `ModalState.plane`）。运动规划器在生成 G2/G3 圆弧插补指令时读取当前轴组的 `active_plane` 以确定弧参数映射。

### 2.3 平面选择与轴组的关系

默认情况下，G17/G18/G19 选择作用于 `group.0`（主直线轴组）。多轴组场景（Phase 2+）中：

- 每个轴组可独立维护自己的平面状态
- G17/G18/G19 作用于"当前激活的轴组"（默认为 `group.0`）
- 旋转轴组 `group.1` 不受平面选择影响（旋转轴无弧平面概念）

---

## 3. 坐标系统

### 3.1 坐标系统层级

AUDESYS 坐标系统遵循 RS274/NGC 标准的三层模型：

```
机床坐标系 (Machine Coordinate System, G53)
  │  物理原点：各轴回零后的机械零位
  │  不可修改，由回零序列确定
  │
  ├── G92 偏移 (全局临时偏移)
  │     位置 = 机床坐标 + G92 偏移
  │
  ├── 工件坐标系 (Work Coordinate System)
  │   ├── G54    (工件坐标系 1)
  │   ├── G55    (工件坐标系 2)
  │   ├── G56    (工件坐标系 3)
  │   ├── G57    (工件坐标系 4)
  │   ├── G58    (工件坐标系 5)
  │   ├── G59    (工件坐标系 6)
  │   ├── G59.1  (工件坐标系 7)
  │   ├── G59.2  (工件坐标系 8)
  │   └── G59.3  (工件坐标系 9)
  │   │
  │   每个 G54-G59.3 存储相对于机床坐标系的 (offset_x, offset_y, offset_z)
  │   │
  │   └── G43 刀具长度补偿 (H offset)
  │       实际位置 = G5x 坐标 - G43 刀具长度偏移 (沿 Z 轴)
  │       通常仅影响 Z 轴，但可扩展至任意纵向轴 (G17→Z, G18→Y, G19→X)
```

### 3.2 坐标偏移数据结构

```yaml
# 轴组运行时状态中的坐标偏移
coordinate_systems:
  g92_offset:      [0.0, 0.0, 0.0]  # (x, y, z) 全局临时偏移
  active_work:     G54              # 当前工件坐标系编号
  work_offsets:
    G54:           [100.0,  50.0, -200.0]  # 工件坐标系 1 偏移
    G55:           [  0.0,   0.0,    0.0]  # 工件坐标系 2 偏移（默认零）
    # ... G56–G59.3 同理

  tool_offset:
    active:                H01    # 当前刀具长度补偿编号
    length:                -50.0  # H01 的刀具长度值 (mm)
```

### 3.3 坐标计算流程

每个 RT 周期，运动规划器计算实际目标位置：

```
1. 读取 G-code 目标位置  (target_machine: 通过 G53 指定，或基于当前工件坐标系)
2. 如果非 G53:
     target_machine = target_work + work_offsets[active_work]
3. 应用 G92 偏移:
     target_machine = target_machine + g92_offset   (ponytail: Phase 2 G92)
4. 应用刀具长度补偿 (G43):
     target_machine[longitudinal_axis] -= tool_offset.length
5. 输出 target_machine 作为运动规划器的目标位置
```

**ponytail**: Phase 1 仅支持 G53（机床坐标系）和 G54（单一工件坐标系），默认 G54 偏移为零。G55–G59.3 工件坐标系、G92 偏移、G43 刀具长度补偿延后至 Phase 2。Phase 1 的典型使用场景：回零后直接在 G54（零偏移）下加工，等同于 G53 机床坐标系直驱。

**坐标转换方向**：G5x 和 G43 偏移在运动规划器中完成，是执行层的转换——G-code 编译器仅解析 G53/G54/G43 并标记坐标系模式，实际坐标计算由运动规划器在每 RT 周期执行。这确保坐标偏移变更（如 G10）生效于下一个周期边界（Config Barrier D17）。

### 3.4 坐标系与轴组的关联

每个轴组独立维护自己的坐标系状态。多轴组场景中：

- `group.0`（直线轴组）适用于 G53/G54-G59.3 和 G43 长度补偿
- `group.1`（旋转轴组）不参与工件坐标偏移（旋转轴的零位由回零独立确定）

---

## 4. 回零序列 (Homing)

### 4.1 概述

回零（Homing）是建立机床坐标系的必要步骤。物理限位开关（或编码器索引脉冲）的位置是机床唯一的绝对参考点。回零后，轴的位置被设置为已知的机械零位（或 HOME_OFFSET 指定的偏移位置），后续所有运动均基于此参考。

AUDESYS 回零使用 **Signal 驱动的状态机**——不引入新的 RPC 或通信原语，完全通过现有 Signal 读/写实现。

### 4.2 回零状态机

回零过程分为四个阶段：

```
                  ┌──────────────────────────────────────────┐
                  │            HOMING STATE MACHINE           │
                  │                                          │
  IDLE ──[$H]──► │  SEEK  ──►  LATCH  ──►  BACKOFF  ──►  DONE │
                  │                                          │
                  │  任一阶段 fail ──► FAULT                   │
                  │                                          │
                  └──────────────────────────────────────────┘
```

#### 阶段详解

| 阶段 | 动作 | Signal 读 | Signal 写 |
|------|------|-----------|-----------|
| **SEEK** | 以 `home_search_vel` 向限位开关方向运动 | `axis.N.limit_pos` / `axis.N.limit_neg` | `axis.N.pos_cmd` (递增), `axis.N.vel_cmd` |
| **LATCH** | 限位触发后停止，反向以 `home_latch_vel` 慢速离开限位 | `axis.N.limit_pos` / `axis.N.limit_neg` (下降沿) | `axis.N.pos_cmd` (递减), `axis.N.vel_cmd` |
| **BACKOFF** | 离开限位后继续移动 `home_backoff_dist` | `axis.N.pos_fb` | `axis.N.pos_cmd` |
| **DONE** | 背隙补偿后设置当前位置为 `home_offset` | — | `axis.N.homed` = true, `axis.N.pos_fb` = home_offset |

#### 状态转换条件

```
SEEK:
  → LATCH:    limit_pos 或 limit_neg 信号上升沿检测（限位触发）
  → FAULT:    运动超时（travel > home_max_dist 仍未触限）

LATCH:
  → BACKOFF:  limit_pos/limit_neg 下降沿检测（离开限位）
  → FAULT:    运动超时（travel > home_latch_max_dist 仍未离限）

BACKOFF:
  → DONE:     移动距离 >= home_backoff_dist
  → FAULT:    运动超时

FAULT:
  → IDLE:     RPC homing.reset() 或 Supervisor 重置信号
```

### 4.3 限位开关 Signal 映射

限位开关信号由 I/O 映射层（`io-mapping-design.md`）产生，运动规划器通过订阅读取：

| Signal | Pin 类型 | 方向（对规划器） | 说明 | 来源 |
|--------|:---:|:---:|------|------|
| `axis.0.limit_pos` | Bool | Read | X 轴正向限位触发 | IoImageTable 离散输入 `x_limit_pos` |
| `axis.0.limit_neg` | Bool | Read | X 轴负向限位触发 | IoImageTable 离散输入 `x_limit_neg` |
| `axis.1.limit_pos` | Bool | Read | Y 轴正向限位触发 | IoImageTable 离散输入 `y_limit_pos` |
| `axis.1.limit_neg` | Bool | Read | Y 轴负向限位触发 | IoImageTable 离散输入 `y_limit_neg` |
| `axis.2.limit_pos` | Bool | Read | Z 轴正向限位触发 | IoImageTable 离散输入 `z_limit_pos` |
| `axis.2.limit_neg` | Bool | Read | Z 轴负向限位触发 | IoImageTable 离散输入 `z_limit_neg` |

**ponytail**: Phase 1 中每个轴使用独立的 `limit_pos`/`limit_neg` 信号（无共享限位 `HOME_IS_SHARED`）。编码器索引脉冲（`HOME_USE_INDEX`）和探针辅助回零延后至 Phase 2。

### 4.4 回零速度曲线

每个回零阶段具有独立的速度参数：

```
             速度 ↑
                  │
  home_search_vel │██████████████████
                  │                  ╲
                  │                   ╲
  home_latch_vel  │                    ████████████████
                  │                                    ╲
  0               │                                     ██──
                  └─────────────────────────────────────────► 位移
                   ←── SEEK ──→← LATCH →← BACKOFF →
```

| 参数 | 说明 | 典型值 | 单位 |
|------|------|--------|------|
| `home_search_vel` | 搜索限位的快速移动速度 | 500.0 | mm/min |
| `home_latch_vel` | 离开限位的慢速移动速度（提高重复精度） | 50.0 | mm/min |
| `home_backoff_dist` | 离开限位后的背隙补偿移动距离 | 5.0 | mm |
| `home_offset` | 归零完成后设置的坐标值 | 0.0 | mm |
| `home_max_dist` | 搜索限位的最大移动距离（超过则 FAULT） | 500.0 | mm |
| `home_latch_max_dist` | 离开限位的最大移动距离 | 20.0 | mm |
| `home_direction` | 搜索方向：`positive` 或 `negative` | `negative` | — |

### 4.5 多轴回零序列

当轴组包含多个轴时，回零可按配置顺序执行：

- **顺序回零**（默认）：`axis.0`→`axis.1`→`axis.2`，每个轴独立完成四个阶段后再开始下一个。Z 轴通常最后回零（避免刀具碰撞）。
- **并行回零**：多轴同时回零（Phase 2，需要独立的限位开关）。LinuxCNC 的 `HOME_SEQUENCE` 参数映射为 AUDESYS 的 `homing.parallel` 标志。

---

## 5. 软限位 (Soft Limits)

### 5.1 概念

软限位是在运动规划器层强制的位置范围，防止轴在回零完成后运动到物理限位之外。与硬限位（物理开关）不同，软限位是软件逻辑，可在加工中动态调整（如工件装夹后的安全区域缩减）。

### 5.2 软限位参数

每轴独立的软限位范围：

| 参数 | 说明 | 单位 |
|------|------|------|
| `axis.N.soft_limit_min` | 最小允许位置（负方向） | mm（直线轴）或 deg（旋转轴） |
| `axis.N.soft_limit_max` | 最大允许位置（正方向） | mm（直线轴）或 deg（旋转轴） |
| `axis.N.soft_limit_enable` | 软限位使能（默认 true，回零后自动启用） | Bool |

### 5.3 违规检测

软限位在运动规划器层执行，具体时机：

```
RT 周期:
1. 运动规划器计算 next_target_pos（包含 backlash 补偿后的目标位置）
2. 检测: if next_target_pos < soft_limit_min → violation
         if next_target_pos > soft_limit_max → violation
3. 若违规:
     • 设置 axis.N.soft_limit_violated = true
     • 设定 axis.N.pos_cmd = axis.N.pos_fb（保持当前位置）
     • 设定 axis.N.vel_cmd = 0.0（立即停止）
     • 生成报警: axis.N.fault = true → group.N.alarm_state = ALARM
4. 若不违规:
     • 照常写入 axis.N.pos_cmd 和 axis.N.vel_cmd
```

**关键设计**：软限位检测发生在位置更新**之前**，确保违规的轴不会移动一步。这与 LinuxCNC 的 soft limit 行为一致——在 trajectory planner 输出前拦截。

### 5.4 软限位与回零的依赖

软限位仅在轴回零完成后生效（`axis.N.homed == true` 时）。回零前的轴位置参考系未建立，禁用软限位。GRBL 也采用同样策略（`$H` 回零前 `$20`–`$22` 软限位参数无效）。

---

## 6. 反向间隙补偿 (Backlash)

### 6.1 概念

反向间隙（Backlash）是机械传动系统（丝杆-螺母、齿轮箱）在方向改变时产生的空行程。当轴从正向运动改为负向运动时，电机转过一定角度后工作台才开始反向移动。

### 6.2 补偿参数

每轴独立的 backlash 参数：

| 参数 | 说明 | 典型值 | 单位 |
|------|------|--------|------|
| `axis.N.backlash_distance` | 反向间隙补偿量 | 0.05 | mm |
| `axis.N.backlash_enable` | 补偿使能 | true | Bool |

### 6.3 方向反转检测

运动规划器在每个 RT 周期维护上一次的目标方向：

```
上一周期: axis.N.last_cmd_direction = sign(pos_cmd - prev_pos_cmd)

当前周期: desired_direction = sign(next_target - current_pos_fb)

if desired_direction != last_cmd_direction && last_cmd_direction != 0:
    → 方向反转! 激活 backlash 补偿
```

### 6.4 补偿公式

方向反转时，在一次补偿周期内施加额外的补偿位移：

```
若 (last_direction > 0 && desired_direction < 0):  // 正向→负向
    compensated_target = target + backlash_distance  // 正向多走一段

若 (last_direction < 0 && desired_direction > 0):  // 负向→正向
    compensated_target = target - backlash_distance  // 负向多走一段
```

补偿在**单个 RT 周期**内完成——将 backlash 距离作为额外位移加入目标位置。下一周期恢复正常运动（不复加补偿，直到下一次方向反转）。

```
示例：axis.0.backlash_distance = 0.05mm

  周期 n:    last_direction = +1, target = 20.00 → pos_cmd = 20.00
  周期 n+1:  direction = -1 (反转!) → target = 19.95
             compensated = 19.95 + 0.05 = 20.00 → pos_cmd = 20.00  (补偿位移)
  周期 n+2:  direction = -1 (同向) → target = 19.90 → pos_cmd = 19.90  (正常)
```

**ponytail**: Phase 1 使用单周期一次性补偿——假设 backlash 距离小于单周期位移量。大型机床 backlash > 1mm 时可能需多周期分摊，延后至 Phase 2。

### 6.5 Backlash 与回零的交互

回零时，BACKOFF 阶段本身已经补偿了反向间隙（见 §4.2）——离开限位后的 `home_backoff_dist` 移动消除了回零操作引入的空程。因此，回零完成后 `axis.N.last_cmd_direction` 重置为零，确保回零后的首次运动正常触发 backlash 补偿。

---

## 7. 轴使能与状态

### 7.1 轴状态 Signal

每个轴暴露以下状态 Signal（由运动规划器或 I/O 映射层写入）：

| Signal | Pin 类型 | 写入者 | 说明 |
|--------|:---:|--------|------|
| `axis.N.enable` | Bool | 运动规划器 / G-code (M17) | 轴使能（伺服上电） |
| `axis.N.homed` | Bool | 运动规划器（回零完成时） | 轴归零完成标志 |
| `axis.N.limit_pos` | Bool | I/O 映射层（IoDriver） | 正向硬限位触发 |
| `axis.N.limit_neg` | Bool | I/O 映射层（IoDriver） | 负向硬限位触发 |
| `axis.N.soft_limit_violated` | Bool | 运动规划器 | 软限位违规（锁存，需 Reset 清除） |
| `axis.N.fault` | Bool | 运动规划器 / I/O 映射层 | 轴故障总结信号（OR of all fault sources） |
| `axis.N.pos_fb` | F64 | 伺服驱动器 | 编码器反馈位置 (mm) |
| `axis.N.vel_fb` | F64 | 伺服驱动器 | 编码器反馈速度 (mm/s) |

### 7.2 轴组报警状态机

轴组聚合所有成员轴的状态，产出轴组级报警信号：

```
轴组报警状态机:

                    ┌──────────────────────────────────┐
                    │                                  │
                    ▼                                  │
  NORMAL ──► WARNING ──► ALARM ──► ESTOP              │
    ▲          │           │         │                  │
    │          │           │         │                  │
    └──────────┴───────────┴─────────┘                  │
             reset_alarm() 或 Supervisor RPC            │
```

| 状态 | 触发条件 | 系统行为 |
|------|---------|---------|
| NORMAL | 所有轴 `enable && homed && !fault` | 正常执行 G-code |
| WARNING | 任意轴 `!homed` 但 `enable` | 可运动（回零前的手动模式），限制 max velocity |
| ALARM | 任意轴 `fault` 或 `soft_limit_violated` | 所有轴 `vel_cmd = 0`，停止运动，等待复位 |
| ESTOP | 外部急停信号 `system.estop` | 立即切断所有轴 enable，独立于组状态 |

报警状态聚合逻辑：

```
group.N.alarm_state = ALARM   if any axis.N.fault
group.N.alarm_state = WARNING if any !axis.N.homed && no fault
group.N.alarm_state = NORMAL  otherwise
group.N.alarm_state = ESTOP   if system.estop (overrides all)
```

### 7.3 故障源聚合

`axis.N.fault` 是故障总结 Signal，由以下来源 OR 聚合：

| 故障源 | 信号 | 来源层 |
|--------|------|--------|
| 硬限位触发 | `axis.N.limit_pos \|\| axis.N.limit_neg`（运行时） | I/O 映射 |
| 软限位违规 | `axis.N.soft_limit_violated` | 运动规划器 |
| 回零失败 | 回零状态机超时 | 运动规划器 |
| 伺服报警 | `axis.N.servo_alarm` | I/O 映射（伺服驱动器状态输入） |
| 跟随误差超限 | `\|pos_cmd - pos_fb\| > follow_error_max` | 运动规划器 |

---

## 8. 信号命名表

### 8.1 完整轴控制 Signal 表

以下列出轴组系统涉及的全部 Signal。命名遵循 D10 约定的 `component.interface.name` 格式，延续 `gcode-compiler-design.md` 的 `axis.N.*` 范式。

#### 运动命令（运动规划器 → 伺服驱动器）

| Signal | 类型 | 方向 | 说明 |
|--------|:---:|:---:|------|
| `axis.0.pos_cmd` | F64 | Write | X 轴目标位置 (mm) |
| `axis.0.vel_cmd` | F64 | Write | X 轴目标速度 (mm/s) |
| `axis.0.enable` | Bool | Write | X 轴使能 |
| `axis.1.pos_cmd` | F64 | Write | Y 轴目标位置 (mm) |
| `axis.1.vel_cmd` | F64 | Write | Y 轴目标速度 (mm/s) |
| `axis.1.enable` | Bool | Write | Y 轴使能 |
| `axis.2.pos_cmd` | F64 | Write | Z 轴目标位置 (mm) |
| `axis.2.vel_cmd` | F64 | Write | Z 轴目标速度 (mm/s) |
| `axis.2.enable` | Bool | Write | Z 轴使能 |

#### 反馈信号（伺服驱动器 → 运动规划器）

| Signal | 类型 | 方向 | 说明 |
|--------|:---:|:---:|------|
| `axis.0.pos_fb` | F64 | Read | X 轴编码器反馈位置 (mm) |
| `axis.0.vel_fb` | F64 | Read | X 轴编码器反馈速度 (mm/s) |
| `axis.0.servo_alarm` | Bool | Read | X 轴伺服驱动器报警 |
| `axis.1.pos_fb` | F64 | Read | Y 轴编码器反馈位置 (mm) |
| `axis.1.vel_fb` | F64 | Read | Y 轴编码器反馈速度 (mm/s) |
| `axis.1.servo_alarm` | Bool | Read | Y 轴伺服驱动器报警 |
| `axis.2.pos_fb` | F64 | Read | Z 轴编码器反馈位置 (mm) |
| `axis.2.vel_fb` | F64 | Read | Z 轴编码器反馈速度 (mm/s) |
| `axis.2.servo_alarm` | Bool | Read | Z 轴伺服驱动器报警 |

#### 限位与状态（I/O 映射 / 运动规划器）

| Signal | 类型 | 写入者 | 说明 |
|--------|:---:|--------|------|
| `axis.0.limit_pos` | Bool | IoDriver | X 轴正向硬限位 |
| `axis.0.limit_neg` | Bool | IoDriver | X 轴负向硬限位 |
| `axis.0.homed` | Bool | MotionPlanner | X 轴归零完成 |
| `axis.0.soft_limit_violated` | Bool | MotionPlanner | X 轴软限位违规 |
| `axis.0.fault` | Bool | MotionPlanner | X 轴故障总结 |
| `axis.1.limit_pos` | Bool | IoDriver | Y 轴正向硬限位 |
| `axis.1.limit_neg` | Bool | IoDriver | Y 轴负向硬限位 |
| `axis.1.homed` | Bool | MotionPlanner | Y 轴归零完成 |
| `axis.1.soft_limit_violated` | Bool | MotionPlanner | Y 轴软限位违规 |
| `axis.1.fault` | Bool | MotionPlanner | Y 轴故障总结 |
| `axis.2.limit_pos` | Bool | IoDriver | Z 轴正向硬限位 |
| `axis.2.limit_neg` | Bool | IoDriver | Z 轴负向硬限位 |
| `axis.2.homed` | Bool | MotionPlanner | Z 轴归零完成 |
| `axis.2.soft_limit_violated` | Bool | MotionPlanner | Z 轴软限位违规 |
| `axis.2.fault` | Bool | MotionPlanner | Z 轴故障总结 |

#### 轴组状态（运动规划器 → Supervisor / Studio）

| Signal | 类型 | 方向 | 说明 |
|--------|:---:|:---:|------|
| `group.0.active_axes` | U32 | Write | 当前激活轴位掩码（bit 0=X, bit 1=Y, bit 2=Z） |
| `group.0.active_plane` | U32 | Write | 当前平面选择（0=G17 XY, 1=G18 ZX, 2=G19 YZ） |
| `group.0.active_work` | S32 | Write | 当前工件坐标系编号（54=G54, 55=G55, …） |
| `group.0.alarm_state` | U32 | Write | 报警状态码（0=Normal, 1=Warning, 2=Alarm, 3=EStop） |
| `group.0.homing_active` | Bool | Write | 任意轴正在回零中 |
| `group.0.all_homed` | Bool | Write | 所有轴归零完成 |
| `group.1.active_axes` | U32 | Write | 旋转轴组激活轴位掩码 |

#### 系统级信号

| Signal | 类型 | 写入者 | 说明 |
|--------|:---:|--------|------|
| `system.estop` | Bool | IoDriver | 急停按钮触发（硬线，最高优先级） |
| `system.estop_ack` | Bool | Supervisor | 急停确认/复位 |

### 8.2 Signal 命名约定总结

| 规则 | 示例 |
|------|------|
| 轴索引从 0 开始 | `axis.0` = X, `axis.1` = Y, `axis.2` = Z |
| 命令用 `_cmd` 后缀 | `pos_cmd`, `vel_cmd` |
| 反馈用 `_fb` 后缀 | `pos_fb`, `vel_fb` |
| 布尔状态用动词原形或形容词 | `enable`, `homed`, `fault` |
| 限位用 `limit_{pos,neg}` | `limit_pos`, `limit_neg` |
| 轴组用 `group.N.*` 前缀 | `group.0.alarm_state` |

---

## 9. HAL 协议集成

### 9.1 Signal 通信模式

轴组系统仅使用 **Signal** 原语通信——单写多读，latest-value 覆盖语义：

- **运动命令**（pos_cmd, vel_cmd, enable）：运动规划器写入，伺服驱动组件读取
- **反馈**（pos_fb, vel_fb, servo_alarm）：伺服驱动组件写入，运动规划器读取
- **限位**（limit_pos, limit_neg）：IoDriver 写入，运动规划器读取
- **状态**（homed, fault, soft_limit_violated）：运动规划器写入，Supervisor/Studio 读取
- **轴组状态**（alarm_state, homing_active）：运动规划器写入，Supervisor/Studio 读取

不使用 RPC 进行轴命令同步——RPC 的阻塞语义与 RT 线程不兼容。不使用 StreamChannel——轴状态每周期只有一个最新值。

### 9.2 RT 周期内时序

轴组系统在 RT 周期内的 Signal 读/写顺序：

```
┌──────────────── RT Cycle ────────────────────┐
│                                               │
│  1. [Config Barrier] apply_pending_config()   │  ← 轴组参数变更在此生效
│                                               │
│  2. read_barrier()                            │
│                                               │
│  3. MotionPlanner.read():                     │
│     • 读取 axis.N.pos_fb, vel_fb             │
│     • 读取 axis.N.limit_pos, limit_neg        │
│     • 读取 axis.N.servo_alarm                 │
│     • 读取 system.estop                        │
│                                               │
│  4. MotionPlanner.update():                   │
│     • 回零状态机评估 (SEEK→LATCH→BACKOFF→DONE) │
│     • 运动规划 (下一目标位置)                   │
│     • backlash 补偿                            │
│     • 软限位检测                               │
│     • 状态聚合 (homed, fault, alarm_state)    │
│                                               │
│  5. MotionPlanner.write():                    │
│     • 写入 axis.N.pos_cmd, vel_cmd            │
│     • 写入 axis.N.enable                       │
│     • 写入 axis.N.homed, fault                │
│     • 写入 group.N.alarm_state                │
│                                               │
│  6. write_barrier()                           │
│                                               │
│  7. sleep_until(next_period)                  │
│                                               │
└───────────────────────────────────────────────┘
```

### 9.3 Config Barrier D17 与轴参数

所有轴组参数通过 RPC 提交到 `pending_config` 队列，在 RT 周期边界（`apply_pending_config()` 阶段）批量应用：

| 参数类别 | 示例参数 | RPC 方法 | 生效时机 |
|---------|---------|---------|---------|
| 回零参数 | home_search_vel, home_latch_vel, home_offset | `configureComponent("motion-planner", {axis.0.home_search_vel: 300.0})` | 下一个 RT 周期边界 |
| 软限位 | soft_limit_min, soft_limit_max, soft_limit_enable | `configureComponent("motion-planner", {axis.0.soft_limit_max: 200.0})` | 下一个 RT 周期边界 |
| Backlash | backlash_distance, backlash_enable | `configureComponent("motion-planner", {axis.0.backlash_distance: 0.05})` | 下一个 RT 周期边界 |
| 坐标偏移 | work_offsets.G54 | `configureComponent("motion-planner", {group.0.work_offsets.G54.z: -30.0})` | 下一个 RT 周期边界 |

**LockLevel 约束**：

| LockLevel | 允许的参数变更 |
|-----------|-------------|
| None / Load / Config | 所有参数可自由变更 |
| Params | 仅限 soft_limit_min/max, home_offset, work_offsets (安全参数) |
| Run | 拒绝所有参数变更 RPC（返回 `LockLevelError`） |

在 `Run` 级别下，即使 Supervisor 发出参数变更 RPC，HalCore 直接拒绝而不入队。这与 D17 的 Config Barrier 互补——Barrier 保证 mid-cycle 安全，LockLevel 在 Barrier 之前拦截。

### 9.4 轴使能的安全性

`axis.N.enable` 信号具有最高优先级——当 `enable = false` 时，伺服驱动器应进入自由状态（free-wheeling）或制动状态（braking）。运动规划器在以下情况自动清零 `enable`：

- `system.estop = true`：紧急停止，所有轴 `enable = false`
- `group.N.alarm_state = ALARM`：报警状态，该组所有轴 `enable = false`
- `axis.N.fault = true`：单轴故障，该轴 `enable = false`（同组其他轴可保持使能）

**ponytail**: `enable = false` 后是否自动重新使能由 Supervisor 决策（通过 Studio 手动或自动恢复策略）。Phase 1 不实现自动恢复。

---

## 10. 限制与路线图

### 10.1 Phase 1 范围

| 功能 | 状态 | 说明 |
|------|:---:|------|
| 轴组定义（YAML → FlatBuffers） | ✅ | 单轴组 group.0，3 轴 (X/Y/Z) |
| 运动命令 Signal | ✅ | pos_cmd, vel_cmd, enable |
| 反馈 Signal | ✅ | pos_fb, vel_fb |
| 回零序列（SEEK→LATCH→BACKOFF→DONE） | ✅ | 顺序回零，独立限位，无编码器索引脉冲 |
| 软限位 | ✅ | 单轴 min/max，回零后自动启用 |
| Backlash 补偿 | ✅ | 单周期一次性补偿 |
| 轴使能与故障 | ✅ | fault 聚合，报警状态机 |
| 坐标系统 | ⚠️ 受限 | 仅 G53 + G54（零偏移）。无 G55-G59.3，无 G92，无 G43 |
| 多轴组 | ❌ | 仅 group.0 |
| 旋转轴 | ❌ | axis.3/4/5 预留索引，Phase 2 |
| 平面选择 | ⚠️ 解析 | G17/G18/G19 被 G-code 编译器解析，但运动规划器仅使用 G17 |
| 运动学变换 | ❌ | trivial kinematics only |
| 编码器索引脉冲回零 | ❌ | Phase 2 |
| 并行回零 | ❌ | Phase 2 |
| 跟随误差检测 | ❌ | Phase 2 |

### 10.2 Phase 2 路线图

| 功能 | 依赖 |
|------|------|
| G55–G59.3 工件坐标系 | 坐标偏移存储 + G10 实现 |
| G43 刀具长度补偿 | 坐标偏移 + 刀具表 |
| G92 全局临时偏移 | G-code 编译器扩展 |
| G18/G19 平面圆弧插补 | 运动规划器平面绑定 |
| 旋转轴 (axis.3–axis.5) | 轴组配置扩展 + 角度伺服命令 |
| 编码器索引脉冲辅助回零 | `HOME_USE_INDEX` 参数 + I/O 映射 |
| 多轴并行回零 | `homing.parallel` 参数 |
| 跟随误差检测 (`follow_error_max`) | `pos_cmd - pos_fb` 比较逻辑 |
| G10 坐标系数据设置 | 坐标偏移 RPC 写入 |
| 轴组激活切换 | 多轴组状态管理 |

### 10.3 Phase 3 路线图

| 功能 | 说明 |
|------|------|
| 运动学变换 (Kinematics) | CoreXY, H-Bot, Delta, SCARA, 5-axis (trunnion/head-head) |
| `kinematics` 字段扩展 | `trivial` → `corexy` / `delta` / `scara` 等 |
| 运动学正向/逆向解算 | Cartesian ↔ actuator space 转换加入运动规划器管线 |
| 旋转刀具中心点 (RTCP) | 5 轴联动刀具跟随 |
| 多轴组联动 | 直线轴组 + 旋转轴组协调运动 |
| G68/G69 坐标系旋转 | 工件坐标系旋转变换 |

### 10.4 设计决策记录

| ID | 决策 |
|----|------|
| AG1 | **轴组是运动规划器层概念**，不是 HAL 原语——HAL 仅看到独立的 axis.N.* Signal |
| AG2 | **Signal 驱动的状态机**（回零/报警/使能），不引入新 RPC 用于周期内操作 |
| AG3 | **所有轴参数变更遵循 D17 Config Barrier**——RPC 提交，周期边界批量应用 |
| AG4 | **LockLevel Run 拒绝参数变更**——轴组参数不能在 RT 运行中被修改 |
| AG5 | **软限位在运动规划器层执行**，在位置更新之前——违规时保持当前位置不变 |
| AG6 | **Backlash 补偿为单周期一次性补偿**（Phase 1），多周期分摊延后至 Phase 2 |
| AG7 | **回零 DONE 后 `last_cmd_direction` 重置为零**，确保首次运动正确触发 backlash 补偿 |
| AG8 | **`axis.N.fault` 为多重故障 OR 聚合**（限位 + 软限位 + 回零超时 + 伺服报警 + 跟随误差） |
| AG9 | **轴组报警状态机 4 态**：NORMAL → WARNING → ALARM → ESTOP（ESTOP 最高优先级） |
| AG10 | **坐标系转换在运动规划器中执行**，不是编译器层——坐标偏移变更通过 Config Barrier 生效 |
| AG11 | **Phase 1 仅支持 G17 (XY)**，G18/G19 被解析但不被运动规划器使用 |
| AG12 | **Phase 1 不实现运动学变换**——`kinematics: trivial` 为唯一支持模式 |

---

## 参考文档

- `docs/modules/hal/hal-protocol-design.md` — HAL 三种通信原语（Signal/StreamChannel/RPC），命名约定
- `docs/modules/hal/config-barrier-design.md` — D17 Config Barrier 与 LockLevel 设计
- `docs/modules/hal/io-mapping-design.md` — I/O 映射层，限位开关的 Signal 来源
- `docs/modules/hal/error-model-design.md` — D46 错误模型，故障分类与升级
- `docs/modules/cnc/gcode-compiler-design.md` — G-code 编译器设计，Signal 命名范式
- `docs/reference/linuxcnc.md` — LinuxCNC HAL pins, `HOME_SEQUENCE`, 回零参数模型
- `docs/reference/grbl.md` — GRBL 限位系统、软限位、归位状态机、9 态系统状态机
- `docs/architecture.md` — AUDESYS 系统架构，RT 线程调度，LinuxCNC HAL 适配
