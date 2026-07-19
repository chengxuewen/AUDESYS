# AUDESYS G-code 编译器设计

> 生成日期：2026-07-19
> 依赖决策：D10 (通信原语 Signal/StreamChannel/RPC), D12 (14 类型系统), D19 (FlatBuffers), D22 (编译器策略), D55 (G-code→HAL IR 编译策略)
> 设计目标：将 ISO 6983 / RS274 / DIN 66025 G-code 编译为 HAL IR (HalProgram)，使 AUDESYS Runtime 原生支持 CNC 运动控制
> 参考项目：GRBL (双遍解析 + 模态组), LinuxCNC (RS274NGC 解释器 + HAL Signal)

---

## 概述

### G-code 在 AUDESYS 中的定位

AUDESYS Runtime 是一个扫描周期引擎（scan-cycle engine），每个周期顺序执行 HalProgram 指令流，读写 Signal。这与传统 CNC 控制器（如 GRBL 的中断驱动步进 ISR 或 LinuxCNC 的 RT 线程）有本质区别：

| 特性 | 传统 CNC 控制器 | AUDESYS Runtime |
|------|:---:|:---:|
| 执行模型 | 中断驱动步进脉冲 | 周期扫描（默认 10ms） |
| 时间精度 | μs 级（定时器 ISR） | ms 级（周期边界） |
| 运动连续性 | 硬件保证（步进脉冲串） | 软件保证（逐周期增量逼近） |
| 实时性 | 硬实时（SCHED_FIFO） | 软实时（周期执行） |

**核心设计决策**：运动指令跨越数百个扫描周期，G-code 编译器将每条运动指令分解为逐周期递进的 IR 指令序列，而非将运动规划交由 VM 运行时处理。G0 在一个周期内完成（直接写入目标位置），G1 生成带计步循环的 IR 指令流。

### G-code 是 AUDESYS 的第 6 种源语言

AUDESYS 编译器管线统一将多种源语言编译为 HalProgram：

```
ST 源文件  ──→  ST Compiler  ──┐
IL 源文件  ──→  IL Compiler  ──┤
LD 源文件  ──→  LD Compiler  ──┤
FBD 源文件 ──→  FBD Compiler ──┼──→ HalProgram ──→ HAL VM ──→ Signal Transport
SFC 源文件 ──→  SFC Compiler ──┤
G-code 源  ──→  G-code Compiler┘
```

所有编译器输出相同的 `HalProgram` 结构——VM 和 Runtime 不感知源码语言。G-code 编译器作为独立 crate (`audesys-gcode-compiler`)，输入 G-code 文本，输出 `HalProgram`。零现有模块变更。

---

## G-code 标准覆盖

### RS274/NGC 标准子集

AUDESYS Phase 1 覆盖 RS274/NGC (NIST RS274NGC) 的核心子集，参考 GRBL v1.1 的命令覆盖范围。选取 G-code 方言间交集的最小功能集，确保跨方言兼容性。

### 模态组 (Modal Groups)

| 组 | G-code | 功能 | Phase 1 |
|----|--------|------|:---:|
| 1 (运动模式) | G0 | 快速定位 (Rapid) | ✅ |
| 1 | G1 | 直线插补 (Linear Interpolation) | ✅ |
| 1 | G2 | 顺时针圆弧 (CW Arc) | 🟡 parse-only |
| 1 | G3 | 逆时针圆弧 (CCW Arc) | 🟡 parse-only |
| 1 | G80 | 取消固定循环 | ❌ |
| 2 (平面选择) | G17 | XY 平面 | ✅ |
| 2 | G18 | XZ 平面 | ✅ |
| 2 | G19 | YZ 平面 | ✅ |
| 3 (距离模式) | G90 | 绝对坐标 | ✅ |
| 3 | G91 | 增量坐标 | ✅ |
| 6 (单位) | G20 | 英寸 | ✅ |
| 6 | G21 | 毫米 | ✅ |
| — | M3 | 主轴顺时针启动 | ✅ |
| — | M4 | 主轴逆时针启动 | ❌ Phase 2 |
| — | M5 | 主轴停止 | ✅ |
| — | M30 | 程序结束 | ✅ |

### 坐标字 (Coordinate Words)

| 字母 | 含义 | 类型 | Phase 1 |
|------|------|:---:|:---:|
| X | X 轴坐标 | F64 | ✅ |
| Y | Y 轴坐标 | F64 | ✅ |
| Z | Z 轴坐标 | F64 | ✅ |
| I | 圆弧圆心 X 偏移 | F64 | 🟡 parse-only |
| J | 圆弧圆心 Y 偏移 | F64 | 🟡 parse-only |
| K | 圆弧圆心 Z 偏移 | F64 | 🟡 parse-only |
| R | 圆弧半径 | F64 | 🟡 parse-only |

### 辅助字 (Auxiliary Words)

| 字母 | 含义 | 类型 | Phase 1 |
|------|------|:---:|:---:|
| F | 进给速度 (mm/min 或 inch/min) | F64 | ✅ |
| S | 主轴转速 (RPM) | F64 | ✅ |
| T | 刀具号 | U32 | ❌ |
| P | 停留时间 (ms) 或子程序号 | F64 / U32 | ❌ |
| N | 行号 | U32 | ✅ (忽略，仅供注释) |

### 不支持的功能 (Phase 1)

| 功能 | G-code | 推迟阶段 |
|------|--------|:---:|
| 刀具半径补偿 | G40/G41/G42 | Phase 3 |
| 刀具长度补偿 | G43/G49 | Phase 3 |
| 固定循环 | G81-G89 | Phase 3 |
| 坐标系统选择 | G54-G59 | Phase 3 |
| 子程序调用 | M98/M99 | Phase 3 |
| 宏/表达式 | — | Phase 4 |
| A/B/C 旋转轴 | — | Phase 3 |
| 进给模式切换 | G93/G94 | Phase 2 |
| 探针 | G38.2-G38.3 | Phase 3 |

---

## 编译器架构

```
   G-code Text (String)
          │
          ▼
┌─────────────────────────────────────────┐
│  G-code Compiler (audesys-gcode-compiler) │
│                                         │
│  ┌─ Lexer (token.rs) ─────────────────┐ │
│  │  Token 枚举：G(u32), M(u32),       │ │
│  │  X(f64), Y(f64), Z(f64),          │ │
│  │  I(f64), J(f64), K(f64),          │ │
│  │  R(f64), F(f64), S(f64),          │ │
│  │  T(u32), P(f64), N(u32),          │ │
│  │  Star(可选行号), Percent(程序分界),│ │
│  │  Comment(String),                  │ │
│  │  EOL, EOF                         │ │
│  └────────────────────────────────────┘ │
│                │                         │
│                ▼                         │
│  ┌─ Parser (parser.rs) ───────────────┐ │
│  │  Two-pass 模态解析器：              │ │
│  │    Pass 1: Tokenize → GCodeLine    │ │
│  │    Pass 2: 模态状态合并            │ │
│  │  模态分组（参照 RS274）：           │ │
│  │    Group 1: G0, G1, G2, G3        │ │
│  │    Group 2: G17, G18, G19         │ │
│  │    Group 3: G90, G91               │ │
│  │    Group 6: G20, G21               │ │
│  │  输出: Vec<GCodeCommand>           │ │
│  └────────────────────────────────────┘ │
│                │                         │
│                ▼                         │
│  ┌─ IR Generator (compiler.rs) ───────┐ │
│  │  GCodeCommand → HalProgram         │ │
│  │  ModalState 维护：                  │ │
│  │    motion_mode: G0/G1/G2/G3       │ │
│  │    coord_mode: G90/G91            │ │
│  │    unit_mode: G20/G21             │ │
│  │    plane: XY/XZ/YZ (G17/G18/G19)  │ │
│  │    feedrate: F64 (mm/min)         │ │
│  │    spindle_rpm: F64               │ │
│  │    current_pos: (x, y, z)         │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
          │
          ▼
    HalProgram { name, signals, instructions }
          │
          ▼
    HAL VM / Executor (existing) → Signal Transport
```

### 三阶段流水线

1. **Lexer** — 将 G-code 文本流转换为 Token 序列。G-code 语法极其简单（字母 + 数值，无嵌套结构），手写 lexer 无外部依赖。
2. **Parser（两遍）** — 第一遍按行 tokenize，识别 G/M-code 并更新模态状态；第二遍将坐标字与当前模态状态合并，生成语义完整的 `GCodeCommand`。
3. **IR Generator** — 将 `GCodeCommand` 序列编译为 `HalProgram`。利用编译时可确定的模态状态生成最优 IR，运行时零模态开销。

---

## 词法分析

### Token 类型定义

```rust
pub enum Token {
    // G-code 命令
    G(u32),          // G0, G1, G2, G3, G17-G19, G20, G21, G90, G91, G80
    M(u32),          // M3, M5, M30

    // 坐标字
    X(f64),          // X 轴坐标值
    Y(f64),          // Y 轴坐标值
    Z(f64),          // Z 轴坐标值

    // 圆弧参数
    I(f64),          // 圆心 X 方向偏移（增量）
    J(f64),          // 圆心 Y 方向偏移（增量）
    K(f64),          // 圆心 Z 方向偏移（增量）
    R(f64),          // 圆弧半径

    // 辅助字
    F(f64),          // 进给速度
    S(f64),          // 主轴转速
    T(u32),          // 刀具号
    P(f64),          // 停留时间 / 子程序号

    // 结构标记
    N(u32),          // 行号（Phase 1 忽略，不做顺序验证）
    Star,             // * — 可选行号分隔符
    Percent,          // % — 程序开始/结束分界符

    // 注释与空白
    Comment(String),  // (comment) 或 ;comment
    EOL,              // 行结束
    EOF,              // 文件结束
}
```

### 词法规则

| 规则 | 示例 | 说明 |
|------|------|------|
| 字母 + 数字 | `G0`, `X10.5`, `M30` | 单字母命令 + 可选数值，字母后紧跟数字或小数点 |
| 正负号 | `X-5.0`, `G91 X-10` | 负值以 `-` 前缀表示 |
| 小数 | `F500.0`, `X0.001` | 浮点数支持小数点和科学计数法 |
| 空白 | `G0 X10 Y20` | 空格 / Tab 分隔 Token |
| 注释 `()` | `(drill hole)` | 括号注释，支持跨行 |
| 注释 `;` | `; this is a comment` | 分号到行尾注释 |
| `%` | `%` ... `%` | 程序分界符，传统上标记文件开头和结尾 |
| `*` | `N10 G0 X10*` | 可选行结束符 |
| 行号 `N` | `N10 G0 X10` | 行号仅供阅读，lexer 不验证顺序 |

### 容错策略

- 未知字母（如 `Q`, `H`, `D`）→ Token 化但标记为 Unsupported，在 parser 阶段报告为 `GCodeError::UnsupportedCommand`
- 行号 `N` 在 Phase 1 不验证连续性——GRBL 也不要求行号连续
- 空行（仅注释/空白）→ 跳过
- `%` 缺失不报错——不是所有 G-code 方言都使用 `%` 分界符

---

## 模态解析

### 两遍解析器 (Two-pass Parser)

参照 GRBL 的 `gcode.c` 架构，AUDESYS G-code 解析器采用两遍设计：

**第一遍：行词法分析** — 将一行 G-code 文本转换为 token 流，识别 G/M-code 并更新模态状态。各行独立 tokenize，彼此无依赖。

**第二遍：模态合并** — 将解析出的坐标字（X/Y/Z/I/J/K）与当前模态状态合并生成语义完整的 `GCodeCommand`：

```
行文本: "G1 X30.0 Y40.0 F500"
        │
Pass 1: Tokenize → tokens: [G(1), X(30.0), Y(40.0), F(500.0)]
        Update modal: motion_mode=G1, feedrate=500.0
        │
Pass 2: Resolve modal:
        G0/1/2/3 来自 Group 1 → 当前运动模式（从模态继承或行内覆盖）
        X/Y/Z 坐标 → current_pos 根据 G90/G91 计算目标位置
        F → 进给速度（从模态继承或行内覆盖）
        S → 主轴转速（从模态继承或行内覆盖）
        │
Output:  GCodeCommand { motion: G1Linear, target: (30.0, 40.0, z_keep),
          feedrate: 500.0, spindle_rpm: current_spindle_rpm, ... }
```

### ModalState 结构体

```rust
/// G-code 模态状态 — 表示所有跨行继承的 G-code 参数。
/// 不可变模式：每次 `advance()` 返回新的 ModalState 副本。
#[derive(Debug, Clone)]
pub struct ModalState {
    /// 运动模式 — Group 1（默认 G0）
    pub motion_mode: MotionMode,
    /// 坐标模式 — Group 3（默认 G90 绝对坐标）
    pub coord_mode: CoordMode,
    /// 单位模式 — Group 6（默认 G21 毫米）
    pub unit_mode: UnitMode,
    /// 平面选择 — Group 2（默认 G17 XY 平面）
    pub plane: Plane,
    /// 进给速度 — mm/min 或 inch/min（默认 0，未设置）
    pub feedrate: f64,
    /// 主轴转速 — RPM（默认 0，主轴停转）
    pub spindle_rpm: f64,
    /// 当前绝对位置 — (x, y, z) 累加器
    pub current_pos: (f64, f64, f64),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MotionMode {
    Rapid,        // G0
    Linear,       // G1
    ArcCW,        // G2
    ArcCCW,       // G3
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CoordMode {
    Absolute,     // G90
    Incremental,  // G91
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UnitMode {
    Inch,         // G20
    Millimeter,   // G21
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Plane {
    XY,  // G17
    XZ,  // G18
    YZ,  // G19
}
```

### 不可变状态转移

每次处理一行 G-code 时：

```
fn process_line(state: &ModalState, line: &GCodeLine) -> (ModalState, GCodeCommand) {
    // 1. 从当前 state 克隆基数
    // 2. 行内命令覆盖对应模态字段
    // 3. 用合并后的模态解析坐标和参数
    // 4. 生成 GCodeCommand
    // 5. 返回新的 ModalState（不修改旧状态）
}
```

**模态继承示例**：

```
G90 G21           ; modal: coord=Absolute, unit=mm
G0 X10 Y20        ; coord=Absolute → 目标 (10, 20)
G1 X30 F500       ; motion=G1 (行内覆盖), feedrate=500, coord=Absolute → 目标 (30, 20)
X50               ; 仅 X 坐标字，其他从模态继承 → G1 X50 Y20 F500
M30               ; 程序结束
```

### 编译时模态解析 vs 运行时模态查询

**关键决策**：模态状态（G90/G91、G20/G21）在编译时完全解析为绝对坐标值和进给量。运行时不感知 G-code 语义——HalProgram 中只有具体的坐标值和步进取值。

| 模态 | 解析时机 | IR 中的表示 |
|------|:---:|------|
| G90 / G91 | 编译时 | 目标位置已转换为绝对坐标 |
| G20 / G21 | 编译时 | 所有值已转换为毫米（内部统一单位） |
| F (进给速度) | 编译时 | 已转换为 mm/cycle 步进量 |
| G17 / G18 / G19 | 编译时 | 运动轴选择已确定（不影响 Phase 1 三轴运动） |

**优点**：运行时零 G-code 语义开销，VM 仅执行 Load/Store/Add/Sub/Jump 指令。
**代价**：运行时无法查询"当前处于 G90 还是 G91"——对于监控面板可通过额外 Signal (`motion.state`) 暴露必要信息。

---

## IR 指令映射

### 操作码使用约定

G-code 编译器仅使用现有 HAL IR 操作码的子集，不新增操作码：

| 操作码 | G-code 用途 |
|--------|------------|
| `Load` | 加载常量（目标坐标、步进量、周期计数）到寄存器 |
| `Store` | 写 Signal（轴位置、速度、使能，主轴状态） |
| `Add` | 逐周期增量累加轴位置 |
| `Sub` | 周期计数器递减、负向步进 |
| `Mul` | G20→G21 单位转换（inch * 25.4 → mm） |
| `Div` | 进给速度 / 周期频率 = 每周期步进量 |
| `Eq` | 周期计数器 == 0 检测 |
| `JumpIf` | 运动循环跳转 |
| `Jump` | 无条件跳转（跳过不需要的轴写入） |
| `Halt` | 程序结束 (M30) 或扫描周期结束 |

### G0 快速定位

G0 在一个扫描周期内完成——直接将目标位置写入 Signal：

```
输入:   G0 X10.0 Y20.0 Z5.0
模态:   G90 (绝对坐标), G21 (毫米)

伪 IR:
    Load    r0,  10.0          ; X 目标位置
    Store   "axis.0.pos", r0   ; 写入 X 轴位置 Signal
    Load    r1,  20.0          ; Y 目标位置
    Store   "axis.1.pos", r1
    Load    r2,  5.0           ; Z 目标位置
    Store   "axis.2.pos", r2
    Halt                        ; 周期结束
```

**设计说明**：G0 语义是"以最大速度移动到目标位置"。在没有运动规划器的 Phase 1，简化为直接写入目标位置。在运动仿真场景中，轴位置在单周期内跳变到目标值是合理行为——后继运动模块（Phase 2 运动规划器）可作为 VM 后的 Signal 消费者执行实际轨迹生成。

### G1 直线插补

G1 生成逐周期步进循环，每个周期在 X/Y/Z 轴上累加一个步进量：

```
输入:   G1 X30.0 Y40.0 F500
模态:   G90 (绝对坐标), current_pos: (10.0, 20.0, 0.0), 周期 = 10ms

编译时计算:
    dx = 30.0 - 10.0 = 20.0 mm
    dy = 40.0 - 20.0 = 20.0 mm
    dist = sqrt(20.0² + 20.0²) = 28.284 mm
    time = 28.284 / 500.0 * 60 = 3.394s
    cycles = 3.394 / 0.010 = 339 cycles (取整)
    step_x = 20.0 / 339.0 = 0.0589 mm/cycle
    step_y = 20.0 / 339.0 = 0.0589 mm/cycle

伪 IR:
    ; ── 初始化 ──
    Load    r5,  30.0          ; r5 = 目标 X
    Load    r6,  40.0          ; r6 = 目标 Y
    Load    r7,  0.0589        ; r7 = step_x (mm/cycle)
    Load    r8,  0.0589        ; r8 = step_y (mm/cycle)
    Load    r9,  339.0         ; r9 = 剩余周期计数 (F64)
    Load    r15, 1.0           ; r15 = 常数 1.0

    ; ── 运动循环 ──
loop_start:                     ; 地址: instruction_index
    Load    r0,  "axis.0.pos"  ; r0 = 当前 X (读 Signal)
    Add     r0,  r7,  r0       ; r0 += step_x
    Store   "axis.0.pos",  r0  ; 写新 X 位置
    Load    r1,  "axis.1.pos"  ; r1 = 当前 Y
    Add     r1,  r8,  r1       ; r1 += step_y
    Store   "axis.1.pos",  r1  ; 写新 Y 位置
    Sub     r9,  r15, r9       ; r9 -= 1.0
    Eq      r9,  0.0           ; r9 == 0?
    JumpIf  loop_start          ; 如果 r9 > 0, 跳回循环
    Halt                         ; 周期结束 / 运动完成
```

**ponytail**: Phase 1 使用逐周期增量逼近目标位置。以 10ms 周期、500mm/min 为例，一个 30mm 的移动需要约 340 个周期（3.4 秒）。无运动规划器时，加速度由 Runtime 的 cycle_ms 间隔隐式控制——所有周期具有相同的步进量（等速运动）。Phase 2 替换为 motion planner 驱动的精确梯形速度曲线时，仅需替换编译器中的 IR 生成逻辑，VM 和 Signal 接口不变。

**增量模式 (G91) 示例**：

```
输入:   G91 G1 X20.0 Y20.0 F500
模态:   current_pos: (10.0, 20.0, 0.0)
        → 目标位置 = (10.0+20.0, 20.0+20.0, 0.0) = (30.0, 40.0, 0.0)
        → IR 与 G90 模式相同
```

**单轴移动优化**：当仅一个轴的目标位置发生变化时，省略未使用轴的 Load/Store 指令，减少指令数量：

```
输入:   G1 X50.0 F500
模态:   current_pos: (30.0, 40.0, 0.0)
        → 仅 X 轴移动，Y/Z 保持不变

伪 IR (优化版):
    Load    r5,  50.0          ; 目标 X
    Load    r7,  0.0589        ; step_x
    Load    r9,  339.0         ; 周期计数
    Load    r15, 1.0
loop_start:
    Load    r0,  "axis.0.pos"
    Add     r0,  r7,  r0
    Store   "axis.0.pos",  r0
    Sub     r9,  r15, r9
    Eq      r9,  0.0
    JumpIf  loop_start
    Halt
```

**Z 轴单独移动**：当仅 Z 轴变化时（如钻孔操作），生成仅含 Z 轴的步进循环。

### G2 / G3 圆弧插补

```
输入:   G2 X50.0 Y50.0 I10.0 J0.0 F400
模态:   plane=XY (G17), coord_mode=G90

编译时行为 (Phase 1):
    • 成功解析所有参数（X, Y, I, J, F）到 GCodeCommand
    • 验证参数完整性（圆心偏移和终点坐标是否齐全）
    • 不生成运动 IR — 输出 None 或标记 skipped
    • 测试验证解析正确性

Phase 2+:
    • angular step per cycle（Bresenham 圆弧算法或中点圆算法）
    • 弧参数存储到 r12 (I), r13 (J) 寄存器
    • Call @arc_interp 子程序
```

**ponytail**: Phase 1 中 G2/G3 仅做参数解析，不生成 IR。实际插补算法延后到 Phase 3，与运动规划器一起实现。Phase 1 的弧指令测试验证解析正确性即可（包括模态继承、参数验证）。

### 平面选择与设置命令

设置命令（G17-G21, G90-G91）不产生 IR 指令——它们仅修改编译器的模态状态，影响后续运动指令的 IR 生成：

```
输入:   G20            ; 设置英寸单位
        G0 X1.0        ; 1.0 inch → 编译时转换为 25.4 mm → IR: Load r0, 25.4

输入:   G91            ; 设置增量坐标
        G1 X10.0 F500  ; 目标 = current_pos + 10.0 mm
```

### M3 / M5 主轴控制

主轴控制在单周期内完成——直接写入 Signal：

```
输入:   M3 S1000

伪 IR:
    Load    r4,  1000.0       ; 主轴 RPM
    Store   "spindle.rpm", r4 ; 写 RPM Signal
    Load    r5,  1.0          ; TRUE
    Store   "spindle.cw", r5  ; 写主轴顺时针使能
    Halt                       ; 周期结束
```

```
输入:   M5

伪 IR:
    Load    r5,  0.0          ; FALSE
    Store   "spindle.cw", r5  ; 停止主轴
    Store   "spindle.rpm", r5 ; RPM = 0
    Halt                       ; 周期结束
```

### M30 程序结束

M30 映射为 `Halt` 指令。程序执行完所有指令后，VM 自然停止。若需要对外通知"程序完成"，可写入 `program.complete` Signal：

```
输入:   M30

伪 IR:
    Load    r15,  1.0            ; TRUE
    Store   "program.complete", r15  ; 通知 Supervisor 程序完成
    Halt                          ; 停止执行
```

### 完整程序编译示例

```
输入 G-code:
    G90 G21                ; 绝对坐标, 毫米
    G0 X0 Y0 Z10           ; 快速移动到起始位置
    M3 S1000               ; 主轴 1000 RPM 顺时针
    G1 Z-2.0 F200          ; 下刀 2mm
    G1 X50.0 Y50.0 F500    ; 直线铣削
    G0 Z10.0               ; 抬刀
    M5                     ; 主轴停
    M30                    ; 程序结束

编译输出 HalProgram:
    name: "unnamed"
    signals: [
        { name: "axis.0.pos", direction: Write, type: F64 },
        { name: "axis.1.pos", direction: Write, type: F64 },
        { name: "axis.2.pos", direction: Write, type: F64 },
        { name: "spindle.rpm", direction: Write, type: F64 },
        { name: "spindle.cw",  direction: Write, type: Bool },
        { name: "program.complete", direction: Write, type: Bool },
    ]
    instructions: [
        ; G0 X0 Y0 Z10
        Load r0, 0.0  →  Store axis.0.pos, r0
        Load r1, 0.0  →  Store axis.1.pos, r1
        Load r2, 10.0 →  Store axis.2.pos, r2
        Halt
        ; M3 S1000
        Load r4, 1000.0 → Store spindle.rpm, r4
        Load r5, 1.0    → Store spindle.cw, r5
        Halt
        ; G1 Z-2.0 F200 — 步进循环
        ... (Z 轴步进循环，12mm 行程，200mm/min，约 360 cycles)
        ; G1 X50.0 Y50.0 F500 — 步进循环
        ... (XY 轴步进循环，70.7mm 行程，500mm/min，约 848 cycles)
        ; G0 Z10.0
        Load r2, 10.0 → Store axis.2.pos, r2
        Halt
        ; M5
        Load r5, 0.0 → Store spindle.cw, r5 → Store spindle.rpm, r5
        Halt
        ; M30
        Load r15, 1.0 → Store program.complete, r15
        Halt
    ]
```

---

## 信号命名规范

G-code 编译器自动生成以下 Signal 绑定。命名遵循 D10 约定的 `component.interface.name` 格式：

### 轴控制 Signal

| Signal 名称 | Pin 类型 | 方向 | 说明 | 示例值 |
|-------------|:---:|:---:|------|--------|
| `axis.0.pos` | F64 | Write | X 轴当前位置 (mm) | 10.5 |
| `axis.0.vel` | F64 | Write | X 轴当前速度 (mm/s) | 8.33 |
| `axis.0.enable` | Bool | Write | X 轴使能 | true |
| `axis.1.pos` | F64 | Write | Y 轴当前位置 (mm) | 20.0 |
| `axis.1.vel` | F64 | Write | Y 轴当前速度 (mm/s) | 8.33 |
| `axis.1.enable` | Bool | Write | Y 轴使能 | true |
| `axis.2.pos` | F64 | Write | Z 轴当前位置 (mm) | -2.0 |
| `axis.2.vel` | F64 | Write | Z 轴当前速度 (mm/s) | 3.33 |
| `axis.2.enable` | Bool | Write | Z 轴使能 | true |

**索引约定**：`axis.0` → X, `axis.1` → Y, `axis.2` → Z。Phase 2+ 扩展 A/B/C 旋转轴为 `axis.3`/`axis.4`/`axis.5`。

**velocity Signal**：Phase 1 中 velocity 值在 G0 时设为 F64::MAX（表示最大速度），G1 时为保证的进给速度。由下游运动规划器消耗（Phase 2+）。

### 主轴控制 Signal

| Signal 名称 | Pin 类型 | 方向 | 说明 | 示例值 |
|-------------|:---:|:---:|------|--------|
| `spindle.cw` | Bool | Write | 主轴顺时针旋转使能 | true |
| `spindle.ccw` | Bool | Write | 主轴逆时针旋转使能 | false |
| `spindle.rpm` | F64 | Write | 主轴目标转速 (RPM) | 1000.0 |

### 程序状态 Signal

| Signal 名称 | Pin 类型 | 方向 | 说明 | 示例值 |
|-------------|:---:|:---:|------|--------|
| `motion.state` | String | Write | 当前运动状态描述 | "rapid", "linear", "idle" |
| `program.complete` | Bool | Write | 程序执行完成（M30 触发） | true |

**注意**：`motion.state` 使用 String 类型 Signal（Pin 类型为 String），Supervisor 和 HMI 面板可通过 pull 模式读取。Phase 1 中此 Signal 可选，后续版本强制生成。

### Signal 绑定生命周期

编译器生成的 Signal 绑定作为 HalProgram 的一部分，在 `deploy_program` IPC 调用时由 Controller 注册到 Signal 注册表。程序执行结束后，Signal 保留最终值（latest-value 语义），后续程序可读取上一个程序的输出。

---

## 寄存器分配

G-code 编译器使用 r0-r15 共 16 个寄存器。分配布局尽量与其他编译器（ST/IL）保持一致（r14=CR, r15=TRUE 遵循 IL 调用约定）。

| 寄存器 | 助记名 | 用途 | 读写频率 |
|:---:|------|------|:---:|
| r0 | `R_AXIS_X` | X 轴当前位置 / 目标位置 | 高（每个运动周期读写） |
| r1 | `R_AXIS_Y` | Y 轴当前位置 / 目标位置 | 高 |
| r2 | `R_AXIS_Z` | Z 轴当前位置 / 目标位置 | 高 |
| r3 | `R_FEEDRATE` | 当前进给速度 (mm/min) | 低（G1 行设置时写入） |
| r4 | `R_SPINDLE_RPM` | 主轴转速 (RPM) | 低（M3/M5 时写入） |
| r5 | `R_TMP0` | 临时寄存器 — 目标 X | 中（运动块初始化时写入） |
| r6 | `R_TMP1` | 临时寄存器 — 目标 Y | 中 |
| r7 | `R_TMP2` | 临时寄存器 — 步进量 X (mm/cycle) | 中 |
| r8 | `R_TMP3` | 临时寄存器 — 步进量 Y (mm/cycle) | 中 |
| r9 | `R_STEP_X` | G1 步进计数器 (剩余周期数) | 高（每个周期减 1） |
| r10 | `R_STEP_Y` | 临时 — 步进量 Z (mm/cycle) | 中 |
| r11 | `R_STEP_Z` | 临时 — G20 转换因子 25.4 | 低 |
| r12 | `R_ARC_I` | 圆弧圆心 X 偏移 (I) | 低（G2/G3 Phase 2+） |
| r13 | `R_ARC_J` | 圆弧圆心 Y 偏移 (J) | 低（G2/G3 Phase 2+） |
| r14 | `R_CR` | 累加器（Current Result，遵循 IL 约定） | 中 |
| r15 | `R_TRUE` | 常数 1.0（遵循 IL 约定） | 高（循环计数器递减） |

### 寄存器压力分析

G1 直线插补是寄存器使用最密集的场景：每个周期需要 9 个寄存器（r0-r2 读轴位置 + r7-r8 读步进量 + r9 计数器 + r14 中间值 + r15 常数）。剩余寄存器（r3-r6, r10-r13）可自由用于多轴扩展和计算暂存。

**单轴移动最低寄存器占用**：4 个（r0 轴位置 + r7 步进量 + r9 计数器 + r15 常数）。Phase 1 的多轴 G1 不会超出 16 个寄存器限制。

---

## 错误处理

遵循 D46 五层错误模型，G-code 编译器定义以下错误类型：

### GCodeError 枚举

```rust
pub enum GCodeError {
    /// 语法错误 — 词法或语法解析失败
    ParseError {
        line: u32,
        msg: String,
    },
    /// 不支持的 G-code 命令
    UnsupportedCommand {
        line: u32,
        code: String,
    },
    /// 命令缺少必要参数
    MissingParameter {
        line: u32,
        param: String,  // 如 "X", "F", "I"
    },
    /// 寄存器分配溢出
    RegisterOverflow {
        required: u8,   // 需要的寄存器数量
    },
}
```

### 错误分类（对应 D46 五层模型）

| 错误层 | 对应错误 | 示例 |
|--------|---------|------|
| **类型错误** | ParseError | `Xabc`（非数值）、`G` 后无数值、数值超出 F64 范围 |
| **传输错误** | N/A | 编译器不涉及网络 I/O |
| **资源错误** | RegisterOverflow | 复杂宏展开后超过 16 个寄存器 |
| **发现错误** | N/A | 编译器不涉及组件发现 |
| **调度错误** | N/A | 编译器是批处理转换，无调度语义 |

### 错误示例场景

| 输入 | 错误类型 | 错误信息 |
|------|---------|---------|
| `G999` | UnsupportedCommand { line: 1, code: "G999" } | 未实现的 G-code 命令 |
| `G2 X50` | MissingParameter { line: 1, param: "I or J or R" } | 圆弧缺少圆心或半径参数 |
| `X10.5` (无运动模式) | ParseError { line: 1, msg: "无运动模式" } | 首次 G0/G1 前出现坐标字 |
| `G1 F` (F 值缺失) | MissingParameter { line: 1, param: "F" } | G1 需要进给速度 |
| 空文件 | Ok(empty HalProgram) | 空输入 → 空程序（非错误） |

### 错误恢复策略

Phase 1 采用 **fail-fast** 策略：遇到第一个错误立即返回 `Err(GCodeError)`。不尝试错误恢复或跳过错误行继续编译——这与 ST/IL 编译器的行为一致。后续阶段可考虑类似 GRBL 的"检查模式 (Check Mode)"——在不执行运动的情况下检测所有错误并汇总报告。

---

## 限制与路线图

### Phase 1 限制

| 限制 | 影响 | 缓解措施 |
|------|------|---------|
| 无运动规划器 | G0 瞬间跳变，G1 等速运动，无加速度控制 | 适用于仿真/验证，不可用于真实加工 |
| 10ms 周期精度 | 高速 CNC (1000mm/s) 精度 ~10mm/cycle | Phase 2 专用 RT 线程 (< 1ms) |
| G2/G3 parse-only | 圆弧不生成运动 IR | Phase 2 实现 Bresenham 圆弧插补 |
| 三轴限定 (X/Y/Z) | 不支持 A/B/C 旋转轴 | Phase 3 扩展多轴 |
| 无刀具补偿 | 不可用于实际加工 | Phase 3 引入 G40/G41/G42 |
| 无子程序/宏 | 复杂加工策略需外部展开 | Phase 3-4 引入 M98/M99 和宏系统 |
| G-code 方言差异 | RS274/GRBL/Klipper/Mach3 各有扩展 | Phase 1 选取交集子集 |
| 模态状态内存不可运行时查询 | 运行时无法获取"当前 G90/G91"等状态 | 通过 `motion.state` Signal 暴露有限信息 |

### Phase 2 路线图

- **运动规划器**：梯形速度曲线（trapezoidal profile）、S-curve 加加速度控制、look-ahead 前瞻缓冲
- **G2/G3 圆弧插补**：Bresenham 圆弧算法或中点圆算法，支持 I/J/K 圆心偏移和 R 半径模式
- **专用 RT 线程**：将运动执行从 scan-cycle 引擎分离到专用 RT 线程，周期降至 < 1ms
- **G93/G94 进给模式**：时间倒数进给 (inverse time) 支持
- **velocity Signal 写入**：运动规划器生成的实时速度写入 `axis.N.vel`

### Phase 3 路线图

- **多轴支持**：A/B/C 旋转轴 (`axis.3`–`axis.5`)、多轴联动插补
- **运动学模型**：Cartesian / CoreXY / Delta / SCARA 运动学正逆解
- **刀具补偿**：刀具半径补偿 (G40/G41/G42)、刀具长度补偿 (G43/G49)
- **固定循环**：G81-G89 钻孔循环
- **坐标系统**：G54-G59 多坐标系统支持
- **子程序**：M98/M99 子程序调用与嵌套

### Phase 4 路线图

- **宏系统**：G-code 变量和表达式，类似 Klipper 宏或 Fanuc Macro B
- **Studio 集成**：G-code 编辑器（CodeMirror 6 + 语法高亮 + 实时编译反馈）、G-code 路径预览面板
- **高级运动规划**：路径混合 (path blending)、加加速度控制 (jerk-limited)、曲率自适应进给

---

## 对 AUDESYS 参考价值

### 架构验证

G-code 编译器的设计直接验证了 AUDESYS 架构的核心假设：

1. **HAL IR 作为通用编译器目标**：现有 30+ 操作码无需新增即可覆盖 G-code 运动语义。Load/Store/Add/Sub/Jump/Eq/Halt 组合足以表达逐周期增量运动模型——验证了 D22 "编译器前端可独立替换"的设计目标。

2. **Signal 作为设备抽象**：轴位置、速度、使能、主轴状态全部通过已有 Signal 原语表达（D10 三原语之一），无需引入新的通信机制。验证了 Signal 的"单写多读 latest-value"语义天然匹配运动控制场景。

3. **扫描周期引擎的 CNC 适配性**：运动跨越数百周期时，每周期仅执行少量 IR 指令（3-8 条）。10ms 周期下指令执行时间 < 1μs，运动计算开销可忽略——瓶颈是周期精度而非计算能力。

4. **编译时优化 vs 运行时开销**：G90/G91/G20/G21 在编译时完全解析为绝对值和毫米单位，运行时零模态语义开销。验证了将"配置"与"执行"分离的 Config Barrier 模式（D17）在编译器管道中的有效性。

### 竞品对标

| 特性 | GRBL | LinuxCNC | AUDESYS G-code |
|------|------|----------|:---:|
| G-code 解析架构 | 双遍解析 (gcode.c) | RS274NGC 解释器 | 双遍解析 + 模态合并 |
| 输出格式 | 运动块 → 规划器缓冲 | NML 消息 | HalProgram (统一 IR) |
| 运动执行 | 中断驱动步进 ISR | RT 线程 + HAL 信号 | 扫描周期 VM + Signal |
| 编译时解析 | 部分（G90/G91 运行时解析） | 运行时解析 | **全部编译时解析** |
| 语言无关性 | C only | C + HAL 组件 | 6 种源语言 → 同一 IR |
| 运动规划器 | 梯形速度曲线 + 前瞻 | 梯形 + S-curve | Phase 2 规划中 |
| 多轴支持 | 3 轴 | 9 轴 | 3 轴 (Phase 1) → 6+ 轴 (Phase 3) |

### 设计决策摘要

| 决策 | 编号 | 内容 | 依据 |
|------|:---:|------|------|
| G-code→HAL IR 编译 | D55 | 将 G-code 作为第 6 种源语言编译为 HalProgram | D22 (多前端单后端编译器策略) |
| 编译时模态解析 | — | G90/G91/G20/G21/F 在编译时解析为绝对值和 mm/cycle | GRBL 验证双遍解析可行性；减少运行时开销 |
| G1 步进循环 | — | 逐周期增量累加，等速运动 | 扫描周期引擎无法保证微秒级定时 |
| G0 直接写入 | — | 单周期写入目标位置 | 快速定位在仿真中无需真实轨迹 |
| G2/G3 延后 | — | Phase 1 parse-only | 圆弧插补需要运动规划器（Phase 2） |
| 手写 lexer/parser | — | 零外部解析库依赖 | G-code 语法极其简单（< 20 token 类型） |
| 零 VM 操作码新增 | — | 复用现有 30+ opcodes | Load/Store/Add/Sub/Jump/Eq/Halt 足够 |

---

## 参考文档

- `docs/reference/grbl.md` — GRBL G-code 解析器架构、双遍解析、模态组定义
- `docs/reference/linuxcnc.md` — LinuxCNC RS274NGC 解释器、HAL 信号架构
- `docs/reference/klipper.md` — G-code 宏系统参考
- `docs/modules/hal/hal-protocol-design.md` — Signal 命名约定 `motion.axis.N.pos`
- `docs/modules/compiler/hal-ir-design.md` — HAL IR 格式、HalProgram 结构
- `crates/audesys-hal-ir/src/instruction.rs` — 完整操作码定义（30+ opcodes）
- `crates/audesys-hal-ir/src/program.rs` — HalProgram + SignalBinding 结构
- `.sisyphus/plans/add-gcode-compiler/proposal.md` — 本变更提案
- `.sisyphus/plans/add-gcode-compiler/design.md` — 详细设计文档
