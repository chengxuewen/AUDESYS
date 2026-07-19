# AUDESYS 插补引擎设计

> 生成日期：2026-07-19
> 依赖决策：D10 (通信原语 Signal/StreamChannel/RPC), D55 (G-code→HAL IR 编译策略)
> 设计目标：定义 G2/G3 圆弧插补和螺旋插补的弦分割算法，与 G-code 编译器管线集成
> 参考项目：GRBL (arc subdivision + chord tolerance), LinuxCNC (canonical arc representation), Klipper (itersolve sampling)

---

## 设计原则

1. **插补在编译器层完成**：G-code 编译器将 G2/G3 圆弧分解为一系列 G1 直线段，每条段生成为 HalProgram 中的 Store 指令。Runtime 不感知弧与直线的区别。
2. **弦公差 (chord tolerance) 控制精度**：圆弧被分割为等角度弦段。弦段与弧之间的最大偏差不超过可配置的 `chord_tolerance` 参数。
3. **平面感知**：G17 (XY)、G18 (ZX)、G19 (YZ) 三个平面正确映射弧参数到对应的轴对。
4. **Phase 1 仅支持完整圆心定义**：I/J/K 增量模式（G90.1 默认）和 R 半径模式。圆心绝对模式 (G90.2) 延后至 Phase 2。
5. **螺旋插补原生支持**：G2/G3 + 同步 Z 轴增量产生螺旋运动（常用于螺纹铣削）。

---

## 1. 概述

### 1.1 插补在编译管线中的位置

```
G-code 源码
    │
    ▼
┌──────────────────────┐
│  Tokenizer & Parser  │  → GCodeCommand (I, J, K, R 参数)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  G-code Compiler     │
│                      │
│  emit_motion()       │
│    ├─ G0: rapid      │
│    ├─ G1: linear     │
│    └─ G2/G3: arc     │  ← 插补引擎 (本节)
│         │             │
│         ▼             │
│    emit_arc()         │
│      ├─ 圆心计算      │
│      ├─ 弦分割        │
│      └─ emit_g1() × N │  → HalProgram
└──────────────────────┘
       │
       ▼
  HalProgram (IR 指令流)
       │
       ▼
  HAL VM / Runtime Engine
```

### 1.2 参考架构

| 特性 | GRBL | LinuxCNC | Klipper | AUDESYS |
|------|------|------|------|------|
| 插补位置 | 编译器 (arc→lines) | 解释器 (arc→canon) | Host (trapq) | 编译器 (arc→store) |
| 曲面表达 | 弦段 (chord) | 弧原语 (canon PREP) | 步进采样 (itersolve) | 弦段 (chord) |
| 精度控制 | 固定角度步长 | 偏差 + 长度 | 时间+距离采样 | chord_tolerance |
| 螺旋插补 | 支持 | 支持 | 支持 | 支持 |
| 弧参数格式 | I/J/K 增量 | I/J/K + R | I/J/K | I/J/K + R |

**选择理由**：编译器层插补 (GRBL 模式) 最简——Runtime 不需要理解弧原语，所有指令统一为 G1 直线段。chord_tolerance 控制精度，而 Runtime 无额外计算负担。

### 1.3 设计约束

| 约束 | 说明 |
|------|------|
| **无新 VM 操作码** | 弧插补不需要新的 Opcode。输出使用现有 LoadImm/Store 指令 |
| **平面切换** | G17/G18/G19 仅影响圆心坐标的轴对映射，不影响分段算法 |
| **弧方向** | G2 = 顺时针 (CW)，G3 = 逆时针 (CCW)。数学上：G3 是标准正角度增加方向 |
| **全圆处理** | 起点 = 终点时，I/J 定义的圆心产生 360° 全圆 |
| **R 格式歧义** | 正值 R 表示弧 ≤ 180°，负值 R 表示弧 > 180° (RS274 标准) |
| **弦公差默认** | 5μm (0.005mm)，工业 CNC 典型精度 |

---

## 2. 圆心计算

### 2.1 I/J/K 增量模式 (G90.1 默认)

圆心从起点偏移 I/J 距离（增量模式），与刀具当前位置无关：

```
给定：起点 P_start = (state.current_x, state.current_y)
      I = cmd.i   (X 方向偏移)
      J = cmd.j   (Y 方向偏移)

圆心：C = (P_start.x + I, P_start.y + J)
```

G90/G91（绝对/增量坐标模式）仅影响终点计算，不影响圆心偏移 I/J/K——I/J/K **始终是增量**（相对于起点）。

### 2.2 R 半径模式

当未提供 I/J（或 I == 0 && J == 0），使用 R 半径计算圆心：

```
给定：起点 P_start, 终点 P_end, 半径 R
      mid = (P_start + P_end) / 2
      chord_vec = P_end - P_start
      half_chord = |chord_vec| / 2

验证：如果 |R| < half_chord → 返回错误 (弧不存在)

圆心偏移距离：h = sqrt(R² - half_chord²)

圆心偏移方向（垂直于弦）：
  perpendicular = normalize((-chord_vec.y, chord_vec.x))
  
  if R > 0 (弧 ≤ 180°): C = mid + h * perpendicular
  if R < 0 (弧 > 180°): C = mid - h * perpendicular
```

**R 格式歧义处理**：RS274 标准规定正 R 表示弧 ≤ 180°，负 R 表示弧 > 180°。当 `|R| == half_chord` 时，弧恰好为半圆（180°），此时圆心位于中点，无歧义。

### 2.3 零半径检测

```
if |R| < epsilon (or I² + J² < epsilon, on active plane):
    return Error: "arc with zero radius"
```

零半径弧无合法圆心，编译阶段直接报错。

### 2.4 G17/G18/G19 平面轴对映射

| G-code | 平面 | 第一轴 (弧半径方向) | 第二轴 (弧切线方向) | I 偏移 | J 偏移 | 纵向轴 |
|--------|------|-------------------|-------------------|--------|--------|--------|
| G17 | XY | X | Y | I (X偏移) | J (Y偏移) | Z |
| G18 | ZX | Z | X | K (Z偏移) | I (X偏移) | Y |
| G19 | YZ | Y | Z | J (Y偏移) | K (Z偏移) | X |

---

## 3. 弦分割算法

### 3.1 算法流程

```
emit_arc(state, cmd, plane):
  1. 计算圆心 C
  2. 计算起点角 θ_start = atan2(P_start.y - C.y, P_start.x - C.x)
  3. 计算终点角 θ_end   = atan2(P_end.y - C.y, P_end.x - C.x)
  4. 计算弧半径 R = |P_start - C|
  5. 调整角度范围：
       if G2 (CW):
           while θ_end > θ_start: θ_end -= 2π
           sweep = θ_start - θ_end
       if G3 (CCW):
           while θ_end < θ_start: θ_end += 2π
           sweep = θ_end - θ_start
  6. 计算角步长：
       max_angle = 2 * acos(1 - chord_tolerance / R)  // 最大允许角步
       max_angle = min(max_angle, PI / 6)              // 上限 30°
       n_segments = max(ceil(sweep / max_angle), 1)
       ang_step = sweep / n_segments
  7. 逐段生成位置：
       for i in 1..=n_segments:
           θ_i = θ_start + i * ang_step (G3) 或 θ_start - i * ang_step (G2)
           P_i = (C.x + R * cos(θ_i), C.y + R * sin(θ_i))
           发射 axis.N.pos Store 指令 (每个参与轴)
           发射 axis.N.enable Store 指令
```

### 3.2 弦公差推导

弦段与弧之间的最大径向偏差 δ 与半径 R 和角步 Δθ 的关系：

```
δ = R * (1 - cos(Δθ / 2))
```

给定目标公差 δ_target，最大允许角步：

```
Δθ_max = 2 * acos(1 - δ_target / R)
```

**示例**：
| 半径 R | 公差 δ = 0.005mm | Δθ_max | 全圆段数 |
|--------|:---:|:---:|:---:|
| 1mm | 5μm | 5.7° | 63 |
| 10mm | 5μm | 1.8° | 200 |
| 100mm | 5μm | 0.57° | 633 |
| 1000mm | 5μm | 0.18° | 2000 |

**上限保护**：Δθ_max 上限为 30° (π/6)，防止极小半径弧产生过少段数影响精度。大半径弧自动产生更精细的分段。

### 3.3 全圆处理

当起点等于终点（|P_start - P_end| < epsilon）：

```
if G2 (CW):  sweep = -2π (或 360° 顺时针)
if G3 (CCW): sweep = +2π (或 360° 逆时针)
```

生成完整的 360° 弦段序列。圆心由 I/J/K 确定（R 模式不支持全圆，RS274 规定全圆必须用 I/J/K 格式）。

### 3.4 弧方向图示

```
          G2 (CW, 顺时针)              G3 (CCW, 逆时针)
    
        Y ↑                            Y ↑
          |  终点                        |  起点
          | ╱                            | ╲
          |╱                              |  ╲
    ──────+──────→ X              ──────+──────→ X
         ╱|圆心                          ╲  |圆心
        ╱ |                                ╲|
      起点                                 终点
```

---

## 4. 螺旋插补 (Helical Interpolation)

### 4.1 概念

螺旋插补是 G2/G3 弧 + 同步纵向轴运动的组合。典型应用是螺纹铣削：

```gcode
G17 G2 X10 Y0 Z-5 I5 J0 F200  ; XY 平面 CW 弧 + Z 轴同步下行 5mm
```

### 4.2 实现

螺旋插补在分段时同步插补纵向轴：

```
给定：起点 Z_start = state.current_z, 终点 Z_end = cmd.z
      弧段数 n_segments (由弦分割决定)

每段纵向增量：Δz = (Z_end - Z_start) / n_segments

for i in 1..=n_segments:
    P_i = arc_position(θ_i)          // XY 平面位置
    Z_i = Z_start + i * Δz           // 同步 Z 位置
    发射 axis.{0,1}.pos Store 指令 (X, Y)
    发射 axis.2.pos Store 指令        (Z, 已插补)
    发射 axis.{0,1,2}.enable Store 指令
```

**关键特性**：
- Z 轴与弧段完全同步——每段弦等价于一个 3D 直线段 (X,Y,Z)
- 不需要新的 VM 指令——输出与 G1 3D 直线完全相同的 Store 序列
- 纵向轴由 `gcode-compiler-design.md` §2.3 的纵向轴映射表确定

### 4.3 多圈螺旋

当螺旋包含多圈（如深孔螺纹铣削），G-code 形式为：

```gcode
G91                          ; 增量模式
G2 X0 Y0 Z-2 I5 J0 L10       ; 10 圈螺旋，每圈下行 2mm
```

此时 `L` (loop count) 参数表示弧的重复次数。编译器：
1. 计算单圈弧段 → n_segments_per_loop
2. 计算每圈 Z 增量 → Δz_per_loop
3. 重复 L 次，累计 Z 偏移

**Phase 1 限制**：L 参数延后至 Phase 2。Phase 1 需手动展开多圈 G-code 行。

---

## 5. 指令发射

### 5.1 弧段→Store 指令映射

弧段不产生梯形速度剖面——弧已经是平滑路径，段间不需要加减速。每段直接发射位置 Store 指令：

```rust
// 每个弧段 i 产生：
instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(x_i)));
instructions.push(Instruction::new(Opcode::Store, vec![
    Operand::SignalName("axis.0.pos".into()),
    Operand::Register(REG_POS_X),
]));
instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(true)));
instructions.push(Instruction::new(Opcode::Store, vec![
    Operand::SignalName("axis.0.enable".into()),
    Operand::Register(REG_STEP),
]));
// 对 Y 轴和 Z 轴同理…
```

**简化理由** (ponytail)：弧段角度步长 ≤ 30°，相邻段方向变化小。GRBL 经验证明弦段直接 Store 无需梯形剖面即可保持平滑运动。

### 5.2 弧段数量上限保护

防止恶意或错误的超长弧（如 R=100000mm 的大弧）产生过多段数：

```
if n_segments > 5000:
    return Error: "arc segment count exceeds limit (5000)"
```

5μm 公差下，R=25m 的弧才达到 5000 段。实际 CNC 加工中弧半径极少超过 1m。

### 5.3 速度处理

G2/G3 的 F 参数指定弧路径上的进给速度（与 G1 相同）。弦段不产生梯形剖面——假设弧运动已经足够平滑，相邻段的切线方向变化缓慢：

```
v_tangential = F / 60.0  // mm/s (与 G1 一致)
Δpos_per_segment = 弧弦长 / 段数
时间预算 per segment = Δpos / v_tangential
```

Phase 1 的逐周期步进模型下，Runtime 每个周期执行有限数量指令。弦段密集时，Runtime 自然将弧的运动分散到多个扫描周期。运动平滑性由弦段的小角度变化保证。

### 5.4 模态状态更新

弧终点更新 ModalState 的 `current_x/y/z`：

```
modal_state.current_x = end_x (弧终点 X)
modal_state.current_y = end_y (弧终点 Y)
modal_state.current_z = end_z (螺旋终点 Z 或原 Z 值)
```

后续 G-code 行从弧终点继续运动——与 G1 行为一致。

---

## 6. 弧参数验证

### 6.1 必需参数检查

| 场景 | 必需参数 | 错误条件 |
|------|---------|---------|
| 全圆 (`start == end`) | I, J (或 I, K 或 J, K) | I² + J² < epsilon → zero radius error |
| 弧 (`start != end`) + I/J | I, J (定义圆心) | I² + J² < epsilon → zero radius error |
| 弧 (`start != end`) + R | R (定义半径) | |R| < half_chord → arc impossible error |
| 螺旋弧 | I, J (or R) + Z (纵向移动) | 同上述圆心检查 + Z 参数 |

### 6.2 端点一致性检查

```
起点到圆心距离：d_start = |P_start - C|
终点到圆心距离：d_end   = |P_end - C|

if |d_start - d_end| / d_start > 0.001:  // 0.1% 容差
    继续执行，但取平均半径 R_effective = (d_start + d_end) / 2
    使用 R_effective 进行弦分割
```

宽松处理：G-code 的微小浮点舍入误差不应阻断编译。取起点和终点半径的平均值作为有效半径。

### 6.3 R 模式半圆检测

```
if |R| - half_chord < epsilon:
    // 弧恰为半圆 (180°)
    圆心位于弦中点
    sweep = π (180°)
```

---

## 7. 与 G-code 编译器的集成

### 7.1 emit_motion() 修改

当前 `emit_motion()` 对 G2/G3 发射 Nop：

```rust
match cmd.g_code.unwrap_or(state.motion_mode) {
    0 => emit_g0(&next, instructions),
    1 => emit_g1(&prev, &next, instructions),
    2 | 3 => {
        // ponytail: G2/G3 Phase 1 parse-only — emit Nop + comment
        instructions.push(Instruction::nop());
    }
    _ => { /* error */ }
}
```

替换为：

```rust
    2 | 3 => {
        let is_cw = cmd.g_code == Some(2);
        emit_arc(&prev, &next, cmd, is_cw, instructions)?;
    }
```

### 7.2 emit_arc() 函数签名

```rust
/// Emit chord-based circular interpolation for G2/G3.
///
/// # Arguments
/// * `prev` — modal state before this arc
/// * `next` — modal state after applying this arc command
/// * `cmd`  — parsed G-code command (contains I/J/K/R/Z)
/// * `is_cw` — true for G2 (clockwise), false for G3 (counter-clockwise)
/// * `instructions` — output buffer for VM instructions
fn emit_arc(
    prev: &ModalState,
    next: &ModalState,
    cmd: &GCodeCommand,
    is_cw: bool,
    instructions: &mut Vec<Instruction>,
) -> Result<(), GCodeError>
```

### 7.3 编译器常量

```rust
/// Chord tolerance for arc subdivision (mm).
/// 5μm — industry-standard precision for CNC milling.
const CHORD_TOLERANCE_MM: f64 = 0.005;

/// Maximum angular step per chord segment (radians).
/// 30° cap prevents degenerate short-chord behavior on tiny arcs.
const MAX_ANGLE_PER_SEGMENT: f64 = std::f64::consts::PI / 6.0;

/// Maximum arc segments to emit. Safety limit.
const MAX_ARC_SEGMENTS: u32 = 5000;

/// Radius equality tolerance (mm).
const RADIUS_EPSILON: f64 = 1e-9;

/// Endpoint consistency tolerance (ratio).
const ENDPOINT_CONSISTENCY_TOLERANCE: f64 = 0.001;
```

---

## 8. 测试策略

### 8.1 单元测试

| 测试 | 输入 | 预期 |
|------|------|------|
| G2 全圆 (I/J) | `G2 X0 Y0 I5 J0` | 产生 Store 指令，覆盖 360° |
| G3 90° 弧 (I/J) | `G3 X0 Y10 I10 J0` | 产生 Store 指令，扫角 90° |
| G2 螺旋 | `G2 X10 Y0 I5 J0 Z-5` | 产生包含 Z 轴的 Store 指令 |
| G2 R 格式 | `G2 X5 Y5 R5` | 产生 Store 指令 |
| G18 平面弧 | `G18 G2 X5 Z0 I2 K0` | ZX 平面弧，Y 不变 |
| 零半径错误 | `G2 X10 Y0 I0 J0` | 返回 GCodeError |
| R < 半弦长 | `G2 X20 Y0 R5` (起点 0,0) | 返回错误 (弧不存在) |
| 全圆 R 格式 | `G2 X0 Y0 R5` (起点 0,0) | 返回错误 (全圆必须用 I/J) |
| G2 象限测试 | G2 从 (10,0) 到 (0,10), I=-10 | CW 弧，终点 (0,10) |
| G3 象限测试 | G3 从 (0,10) 到 (10,0), J=-10 | CCW 弧，终点 (10,0) |

### 8.2 集成测试

| 测试 | 说明 |
|------|------|
| `test_g2_g3_output_motion` | 替换 `test_g2_parse_only` 和 `test_g3_parse_only`，验证实际 Store 指令 |
| `test_arc_chord_count` | 验证不同半径的弧产生的段数符合预期 (R=1mm → ~63段, R=100mm → ~633段) |
| `test_helical_z_sync` | 验证螺旋插补的 Z 值与 XY 弧段同步 |
| `test_plane_g18_mapping` | 验证 G18 弧正确映射到 Z/X 轴 |

---

## 9. 限制与路线图

### 9.1 Phase 1 范围

| 功能 | 状态 | 说明 |
|------|:---:|------|
| G2/G3 弦分割 | ✅ | chord_tolerance 控制，最大 30°/段 |
| I/J/K 圆心模式 | ✅ | 增量偏移（相对起点） |
| R 半径模式 | ✅ | 正值 ≤ 180°，负值 > 180° |
| 螺旋插补 | ✅ | 弧 + 同步 Z 轴 |
| G17/G18/G19 | ✅ | 平面切换正确映射轴对 |
| 全圆 (I/J) | ✅ | 起点=终点，I/J 定义圆心 |
| 弧参数验证 | ✅ | 零半径、R < 半弦长检测 |
| G2/G3 同一行 | ❌ | Phase 2（每行只能有一个 G-code） |
| G90.2 圆心绝对模式 | ❌ | Phase 2 |
| L 重复参数 | ❌ | Phase 2（多圈螺旋） |
| 弧→弧切线过渡 | ❌ | Phase 2（连续路径优化） |
| 端点→圆心一致性容差 | ⚠️ 宽松 | 0.1% 容差，取平均半径 |

### 9.2 Phase 2 路线图

| 功能 | 依赖 |
|------|------|
| G90.2 圆心绝对模式 | 坐标系偏移支持（相对机床原点定义圆心） |
| L 多圈重复参数 | 编译器循环展开支持 |
| 弧→弧切线过渡 | 前瞻规划 (motion-planner-design.md §4) |
| 自适应弦公差 | 根据弧半径动态调整（小半径精加工用更小公差） |
| G5 样条插补 | 需要独立设计文档 |

### 9.3 Phase 3 路线图

| 功能 | 说明 |
|------|------|
| NURBS 插补 | 样条曲线直接插补（非先离散为线段） |
| 弧拟合 | G1 线段序→弧重拟合（CAM 后处理优化） |
| 5 轴螺旋插补 | 旋转刀具中心点 (RTCP) + 弧插补 |

---

## 10. 设计决策记录

| ID | 决策 | 理由 |
|----|------|------|
| IP1 | **编译器层完成弧→弦离散** | GRBL 验证的模式——Runtime 无弧感知，所有运动统一为 G1 Store 指令 |
| IP2 | **chord_tolerance = 5μm** | 工业 CNC 标准精度。匹配 LinuxCNC 默认 tolerance |
| IP3 | **角步上限 30°** | 防止极小半径弧产生过少段数。弦与弧偏差在 30° 时为 R×(1-cos(15°)) = 0.034R，即 R=1mm 时偏差 34μm |
| IP4 | **弧段不使用梯形剖面** | 弧段间切线方向变化小，Store 指令的自然位置变化已足够平滑。GRBL 同样在弧段上不使用加速度控制 |
| IP5 | **端点→圆心不一致 → 取平均半径** | G-code 浮点舍入不应阻断编译。0.1% 容差足够覆盖正常精度范围 |
| IP6 | **全圆必须用 I/J/K** | RS274 标准规定。R 模式下起点=终点无法确定圆心（无数个可能位置） |
| IP7 | **螺旋 Z 插补与弧段同步** | 每段弦等价于 3D 直线段。无额外 VM 指令，与 G1 3D 输出完全兼容 |
| IP8 | **最大 5000 段上限** | 防止极端参数生成过多 IR 指令。5μm 公差下 R=25m 弧才达此上限 |

---

## 参考文档

- `docs/modules/cnc/gcode-compiler-design.md` — G-code 编译器设计，emit_motion() 结构
- `docs/modules/cnc/motion-planner-design.md` — 梯形速度剖面，前瞻规划
- `docs/modules/cnc/axis-group-design.md` — 轴组，坐标系，软限位
- `docs/modules/hal/hal-protocol-design.md` — HAL Signal 原语
- `docs/reference/grbl.md` — GRBL 弧插补实现参考
- `docs/reference/linuxcnc.md` — LinuxCNC canonical arc 表示
