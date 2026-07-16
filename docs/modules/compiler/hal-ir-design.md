# HAL IR — Intermediate Representation Design

> 生成日期：2026-07-16
> 设计目标：定义 AUDESYS HAL IR 格式——ST 编译器输出与 HAL Runtime 之间的稳定接口
> 依赖决策：D10 (通信原语), D12 (14类型系统), D19 (FlatBuffers), D22 (编译器策略), D24 (运行时 FlatBuffers)

---

## 设计原则

**HAL IR 是编译器的"产品交付格式"，不是编译器内部表示。** 它定义了一种标准化的二进制程序描述，使得：
- 任何 IEC 61131-3 编译器前端（RuSTy、自研 ST→IR、未来 FBD→IR）输出同一格式
- HAL Runtime 的 IR 引擎只需理解这一种格式
- 编译器前端和后端可独立替换，用户 ST 代码零感知（D22 核心目标）

**HAL IR 不追求通用性——它只表达 HAL 运行时能执行的语义。** 这包括：读写 Signal、读写 StreamChannel、算术逻辑运算、条件/循环控制流。不包括：GC、异常处理、动态类型、闭包。

**Phase 1 最小主义：** 仅支持简单 ST 程序需要的指令集。函数调用、定时器、结构体、多任务调度推迟到 Phase 2+。

---

## 1. 核心概念

HAL IR 程序是一个 FlatBuffers 二进制文件，包含三个部分：

### 1.1 Signal 绑定

将程序变量映射到 HAL Signal。编译器从 ST 程序中识别出所有 `%IW*` / `%QW*` 地址映射或 HAL 组件变量声明，生成绑定表。

```
ST 程序中的变量 counter AT %IW0 : INT;
→ IR 中 SignalBinding { hal_signal_name: "sensor.counter", program_var: "counter", direction: Read, hal_type: S16 }
```

**绑定即契约**：HAL Runtime 在加载 IR 程序时根据绑定表注册 Signal 读/写操作。变量名是 IR 内部的虚拟寄存器。

### 1.2 StreamChannel 绑定

将程序 I/O 映射到命名 StreamChannel。用于日志输出、报警流、与 Supervisor 的数据通道。

### 1.3 指令流

线性指令序列，基于寄存器虚拟机模型：

- **16 个通用寄存器** `r0`–`r15`：用于中间计算
- **命名变量**（来自 Signal 绑定）：通过 Load/Store 指令与寄存器交互
- **指令指针 (IP)**：顺序执行，跳转指令修改 IP
- **无栈** (Phase 1)：无函数调用，所有逻辑在一个扁平指令流中

---

## 2. FlatBuffers Schema

以下是 HAL IR 的 FlatBuffers schema。该 schema 将添加到现有 `crates/audesys-hal-flatbuffers/schema/` 目录（与 `hal_value.fbs` 并存）。

### 2.1 主程序表

```fbs
// HAL IR — Compiled IEC 61131-3 Program
// Schema: hal_ir.fbs
// Phase 1: simple ST programs only

namespace audesys.hal.ir;

// ── Program entry point ──

table HalProgram {
  name: string;                    // Program name from ST source
  version: uint32;                 // IR format version (current: 1)
  registers: uint8 = 16;           // Number of general-purpose registers
  signals: [SignalBinding];        // Signal ⇄ variable bindings
  channels: [ChannelBinding];      // StreamChannel bindings
  constants: [Constant];           // Literal constants table (shared)
  instructions: [Instruction];     // Executable instruction stream
}

root_type HalProgram;
```

### 2.2 绑定表

```fbs
// ── I/O direction ──

enum Direction : byte {
  Read = 0,
  Write = 1,
  ReadWrite = 2
}

// ── Signal binding — maps a program variable to a HAL Signal ──

table SignalBinding {
  hal_signal_name: string;         // e.g., "sensor.temp" (D10: component.interface.name)
  program_var: string;             // Variable name in IR (register alias)
  direction: Direction;
  hal_type: HalType;               // From hal_value.fbs (S32, F64, Bool, etc.)
}

// ── StreamChannel binding — maps program variable to a named channel ──

table ChannelBinding {
  channel_name: string;            // e.g., "alarms.overheat" (D10: domain.stream_name)
  program_var: string;
  direction: Direction;
  hal_type: HalType;
  buffer_size: uint16 = 64;        // Local buffer depth for consumer
}
```

### 2.3 常量表

```fbs
// ── Literal constant — scalar values shared across instructions ──

table Constant {
  index: uint16;                   // Referenced by LoadConst instruction
  type: HalType;                   // From hal_value.fbs
  // one of the following:
  bool_val: bool;
  int8_val: byte;
  uint8_val: ubyte;
  int16_val: short;
  uint16_val: ushort;
  int32_val: int;
  uint32_val: uint;
  int64_val: long;
  uint64_val: ulong;
  float32_val: float;
  float64_val: double;
}
```

### 2.4 指令集

```fbs
// ── Opcode enumeration ──

enum Opcode : byte {
  // Data movement
  Nop = 0,
  Load = 1,          // reg ← signal
  Store = 2,         // signal ← reg
  LoadConst = 3,     // reg ← constants[idx]
  LoadChannel = 4,   // reg ← channel
  StoreChannel = 5,  // channel ← reg

  // Arithmetic (on registers)
  Add = 10,          // reg_a + reg_b → reg_out
  Sub = 11,          // reg_a - reg_b → reg_out
  Mul = 12,          // reg_a * reg_b → reg_out
  Div = 13,          // reg_a / reg_b → reg_out
  Mod = 14,          // reg_a % reg_b → reg_out
  Neg = 15,          // -reg_a → reg_out

  // Bitwise
  And = 20,          // reg_a & reg_b → reg_out
  Or = 21,           // reg_a | reg_b → reg_out
  Xor = 22,          // reg_a ^ reg_b → reg_out
  Not = 23,          // ~reg_a → reg_out
  Shl = 24,          // reg_a << reg_b → reg_out
  Shr = 25,          // reg_a >> reg_b → reg_out

  // Comparison (sets flags)
  CmpEq = 30,        // reg_a == reg_b ? flags_zero = 1 : 0
  CmpNe = 31,        // reg_a != reg_b ?
  CmpLt = 32,        // reg_a < reg_b ?
  CmpLe = 33,        // reg_a <= reg_b ?
  CmpGt = 34,        // reg_a > reg_b ?
  CmpGe = 35,        // reg_a >= reg_b ?

  // Control flow
  Jump = 40,         // ip = target (unconditional)
  JumpIf = 41,       // if flags_zero: ip = target
  JumpIfNot = 42,    // if !flags_zero: ip = target

  // Conversion
  Cast = 50,         // Convert reg from src_type to dst_type

  // Special
  Halt = 255         // End program (or scan cycle boundary)
}

// ── Operand union — register index or constant index ──

union OperandValue {
  reg: uint8,        // Register index (0-15)
  const_idx: uint16, // Constant table index
}

table Operand {
  kind: OperandValue;
}

// ── Instruction — one VM instruction ──

table Instruction {
  opcode: Opcode;
  operands: [Operand];  // 0-3 operands depending on opcode
}
```

### 2.5 操作数约定

| Opcode | Operands | 语义 |
|--------|----------|------|
| `Nop` | 0 | No operation |
| `Load` | 2: `dest_reg, signal_name(const_idx)` | `r[dest] ← read_signal(signal)` |
| `Store` | 2: `signal_name(const_idx), src_reg` | `publish_signal(signal, r[src])` |
| `LoadConst` | 2: `dest_reg, const_idx` | `r[dest] ← constants[const_idx]` |
| `LoadChannel` | 2: `dest_reg, channel_name(const_idx)` | `r[dest] ← channel.read()` |
| `StoreChannel` | 2: `channel_name(const_idx), src_reg` | `channel.write(r[src])` |
| `Add` | 3: `reg_a, reg_b, reg_out` | `r[out] ← r[a] + r[b]` |
| `Sub` | 3: `reg_a, reg_b, reg_out` | `r[out] ← r[a] - r[b]` |
| `Mul` | 3: `reg_a, reg_b, reg_out` | `r[out] ← r[a] * r[b]` |
| `Div` | 3: `reg_a, reg_b, reg_out` | `r[out] ← r[a] / r[b]` (整型截断，浮点 IEEE 754) |
| `Mod` | 3: `reg_a, reg_b, reg_out` | `r[out] ← r[a] % r[b]` (仅整型) |
| `Neg` | 2: `reg_a, reg_out` | `r[out] ← -r[a]` |
| `And` | 3: `reg_a, reg_b, reg_out` | `r[out] ← r[a] & r[b]` |
| `Or` | 3: `reg_a, reg_b, reg_out` | `r[out] ← r[a] | r[b]` |
| `Shl` | 3: `reg_a, reg_b, reg_out` | `r[out] ← r[a] << r[b]` |
| `CmpEq` | 2: `reg_a, reg_b` | Set `flags_zero` if equal |
| `Jump` | 1: `target_ip` | `ip = target` |
| `JumpIf` | 1: `target_ip` | `if(flags_zero) ip = target` |
| `JumpIfNot` | 1: `target_ip` | `if(!flags_zero) ip = target` |
| `Cast` | 3: `reg, src_type(const_idx), dst_type(const_idx)` | Type conversion |
| `Halt` | 0 | End of scan cycle |

**类型由 HalType 标签推断**：Arithmetic/Comparison 指令的操作数类型由 Signal Binding 的 `hal_type` 字段决定。运行时从声明类型执行正确的运算语义（整型除法、浮点 IEEE 754）。

---

## 3. 执行模型

### 3.1 运行时虚拟机

```
┌──────────────────────────────────────┐
│            HAL IR Engine              │
│                                       │
│  r0 r1 r2 ... r15   (寄存器文件)       │
│  flags_zero          (比较标志)        │
│  ip                  (指令指针)        │
│                                       │
│  constants[]         (常量表)          │
│  signal_bindings[]   (Signal 绑定)     │
│──────────────────────────────────────│
│                                       │
│  ┌──────────┐       ┌──────────────┐  │
│  │ HalTransport │◄───┤   IR Engine  │  │
│  │  (traits)    │    │  (execute)   │  │
│  └─────┬────┘       └──────────────┘  │
│        │                               │
│  publish_signal()   read_signal()     │
└────────┴──────────────────────────────┘
```

### 3.2 扫描周期

IR 引擎在 HAL 的 read→compute→write 周期中执行（见 `docs/modules/hal/thread-scheduling-design.md`）：

```
每个 RT 周期：
  1. Load 阶段：执行所有 Load 指令（从 Signal 读入寄存器）
  2. Compute 阶段：执行算术/逻辑/控制流指令（寄存器间计算）
  3. Write 阶段：执行所有 Store 指令（寄存器写入 Signal）
  4. Halt：IP 回卷到指令 0，等待下一周期
```

**Phase 1 简化**：指令流按顺序执行（单线程）。不要求编译器分离 Load/Compute/Write 阶段——IR 只是扁平指令序列，运行时直接顺序解释。Phase 2+ 可引入多任务后，由调度器决定各任务 IR 的执行时机。

### 3.3 示例：简单计数器

```pascal
// ST 源码
PROGRAM SimpleCounter
VAR
    counter : INT := 0;
    sensor AT %IW0 : INT;
    output AT %QW0 : INT;
END_VAR

counter := sensor + 1;
output := counter;
END_PROGRAM
```

编译为 HAL IR（伪代码展示）：

```yaml
signals:
  - { hal_signal_name: "sensor.value", program_var: "sensor", direction: Read, hal_type: S16 }
  - { hal_signal_name: "actuator.counter", program_var: "output", direction: Write, hal_type: S16 }
constants:
  - { index: 0, type: S16, int16_val: 1 }
  - { index: 1, type: S16, int16_val: 0 }
instructions:
  - { opcode: Load,        operands: [r0, "sensor.value"] }      # r0 ← read signal
  - { opcode: LoadConst,    operands: [r1, const_0] }             # r1 ← 1
  - { opcode: Add,          operands: [r0, r1, r2] }              # r2 ← r0 + r1
  - { opcode: Store,        operands: ["actuator.counter", r2] }  # publish signal ← r2
  - { opcode: Halt }
```

### 3.4 条件分支示例

```pascal
IF sensor > 100 THEN
    output := 1;
ELSE
    output := 0;
END_IF;
```

编译为：

```yaml
instructions:
  - { opcode: Load,        operands: [r0, "sensor.value"] }
  - { opcode: LoadConst,    operands: [r1, const_100] }          # r1 ← 100
  - { opcode: CmpGt,        operands: [r0, r1] }                 # flags_zero = (r0 > r1)
  - { opcode: JumpIfNot,    operands: [lbl_else] }               # if !(sensor>100) goto else
  - { opcode: LoadConst,    operands: [r2, const_1] }            # then: r2 ← 1
  - { opcode: Store,        operands: ["actuator.output", r2] }
  - { opcode: Jump,         operands: [lbl_end] }                # goto end
lbl_else:
  - { opcode: LoadConst,    operands: [r2, const_0] }            # else: r2 ← 0
  - { opcode: Store,        operands: ["actuator.output", r2] }
lbl_end:
  - { opcode: Halt }
```

---

## 4. 集成点

### 4.1 编译器前端 → HAL IR

```
┌──────────┐   ST Source     ┌──────────────┐   HalProgram    ┌──────────────┐
│  RuSTy   │ ──────────────► │ HAL Binding   │ ─────────────► │  .hal_ir.fbs  │
│ (Phase1) │                 │ Generator     │                │  (二进制文件)  │
└──────────┘                 └──────────────┘                └──────────────┘
```

- **RuSTy (Phase 1)**：编译 ST → RuSTy 内部 IR → HAL Binding Generator 映射到 HAL 原语 → 输出 `.hal_ir.fbs` 二进制
- **自研 ST 前端 (Phase 2)**：ST → AST → HAL IR（同一输出格式，用户代码不变）
- **FBD→ST→IR (Phase 2)**：CODESYS 模式——FBD 先转 ST，再走同一编译管线

### 4.2 HAL IR → Runtime

```
┌──────────────┐   flatc decode   ┌──────────────┐   execute    ┌────────────────┐
│  .hal_ir.fbs  │ ──────────────► │  IR Engine    │ ──────────► │  HalTransport   │
│  (二进制文件)  │                │  (Rust VM)    │            │  publish/read   │
└──────────────┘                 └──────────────┘             └────────────────┘
```

- **Runtime 加载**：`HalProgram` 通过 FlatBuffers 零拷贝读取（`get_root_as_hal_program(buf)`）
- **IR Engine 执行**：顺序解释指令流，每条指令调用对应的 `HalTransport` 方法
- **Signal 映射**：Load/Store 指令通过 `SignalBinding` 表解析 `program_var` → `hal_signal_name` → `HalTransport::read_signal()` / `publish_signal()`
- **流式处理**：`LoadChannel`/`StoreChannel` 通过 `ChannelBinding` 表映射到 StreamChannel trait

### 4.3 构建流水线

```
YAML 项目文件 (.audesys.yml)
    │
    ├── ST 源码 (.st)
    │       │
    │       ▼ (ruSTy / 自研编译器)
    │   HalProgram FlatBuffers (.hal_ir)
    │       │
    │       ▼ (flatc --rust)
    │   Rust 绑定 (hal_ir_generated.rs)
    │
    └── Signal 定义 (YAML) ──► hal_value FlatBuffers
                                    │
                                    ▼
                            HAL Runtime 加载执行
```

> 参考 D24：开发阶段 YAML 人类可读，构建时编译为 FlatBuffers 二进制，运行时零拷贝加载。

---

## 5. 与现有代码的关系

### 5.1 现有 crate 的角色

| Crate | 角色 | HAL IR 如何对接 |
|-------|------|----------------|
| `audesys-hal-core` | HalTransport trait、HalValue enum、HalPinType | IR Engine 调用 `HalTransport::publish_signal()` / `read_signal()` 执行 Load/Store |
| `audesys-hal-flatbuffers` | `hal_value.fbs` (HalType, HalValue, HalSignal) | IR schema (`hal_ir.fbs`) 复用 `hal_value.fbs` 中的 `HalType` 枚举和 `HalValue` 表。通过 `include "hal_value.fbs"` 引用 |
| `amw_inproc` | HalTransport 实现 (in-process) | IR Engine 不感知传输实现——仅依赖 `HalTransport` trait |
| (新增 crate, Phase 1 M0.4) | IR Engine — 解释 HalProgram 的 Rust VM | 新 crate: `audesys-hal-ir`，放在 `crates/audesys-hal-ir/` |

### 5.2 Schema 复用方式

`hal_ir.fbs` 通过 FlatBuffers `include` 复用 `hal_value.fbs` 中的类型定义：

```fbs
// hal_ir.fbs 顶部
include "hal_value.fbs";

namespace audesys.hal.ir;

// ...使用 hal_value.fbs 中的 HalType 枚举
table SignalBinding {
  hal_signal_name: string;
  program_var: string;
  direction: Direction;
  hal_type: audesys.hal.HalType;  // 引用 hal_value.fbs 的类型
}
```

---

## 6. Phase 1 范围与限制

### Phase 1 支持

- 简单 ST 程序：变量声明、赋值、算术、比较、if/else、while 循环
- 标量类型：Bool, S8–S64, U8–U64, F32, F64（对应 HalValue 的 11 种标量）
- Signal 读写：通过 Load/Store 指令
- 单个扫描周期内的线性执行

### Phase 1 明确不支持（推迟到 Phase 2+）

| 功能 | 推迟原因 | 推迟到 |
|------|---------|--------|
| 函数调用 (FUN/FB) | 需栈帧、参数传递、返回地址——显著增加 VM 复杂度 | Phase 2 |
| 定时器/计数器 (TON, TOF, CTU, CTD) | 需持久状态管理、时间源注入——运行时基础设施先就绪 | Phase 2 |
| 结构体/数组访问 | 需字段偏移计算、数组边界检查、Array<T> 指令支持 | Phase 2 |
| 多任务调度 | 需多 IR 程序并发、优先级抢占、扫描屏障协调 | Phase 2 |
| 字符串操作 | String 类型支持 I/O 绑定，不支持运算符 (CONCAT) | Phase 2 |
| StreamChannel 指令 | 通道基础设施 (UDS/Zenoh) 在 Phase 2 就绪 | Phase 2 |
| 异常/错误处理 | 需错误边界语义、try/catch 对应物 | Phase 3 |

---

## 7. 决策记录

| 决策 | 理由 |
|------|------|
| 寄存器虚拟机（非栈式） | 寄存器 VM 指令更少（Add r0,r1,r2 vs push/push/add/pop），解释开销低，更接近 LLVM IR |
| 16 个通用寄存器 | 简单 ST 程序不需要更多。寄存器压力大时可溢写到 `constants[]` 临时变量 |
| 类型由 signal_binding 声明，非运行时检查 | 编译器已验证类型正确性。运行时进行类型检查是重复工作，增加 RT 开销 |
| 常量独立成表，指令引用索引 | 避免字面量在指令流中重复（同一常数可能被多个 LoadConst 引用）。FlatBuffers 的 `[Constant]` 表天然支持 |
| 比较指令设标志 (flags_zero)，跳转读标志 | 经典两段式：比较 + 条件跳转。与真实 CPU 模型一致，编译器后端易于映射 |
| FlatBuffers 作为 IR 二进制格式 | 零拷贝加载（与 D19/D24 一致）。Schema 即文档。`flatc` 自动生成 15 种语言的解析代码 |
| `hal_ir.fbs` include `hal_value.fbs` | 避免类型定义重复。Signal 绑定的 hal_type 字段与运行时 HalValue 类型完全一致 |
| Phase 1 不需要单独的 Load/Compute/Write 阶段标记 | 单线程顺序执行即可。多任务时才需要编译器标记阶段边界以供调度器使用 |

---

## 8. 开放问题（Phase 2+）

以下问题已识别但不在 Phase 1 范围内，记录于此供后续设计参考：

1. **函数调用模型**：FB (Function Block) 实例如何表示为 IR？每个 FB 实例是独立的 HalProgram 还是同一 HalProgram 内的子程序？需要栈帧和调用约定。
2. **定时器表示**：TON/TOF 需要时间源注入。是通过特殊 Signal（`system.tick`）还是 IR 引擎内置时间 API？
3. **结构体/数组**：STRUCT 成员的偏移量如何编码？ARRAY 索引如何表示？需要 `LoadIndexed` / `StoreIndexed` 指令。
4. **多任务 IR 调度**：多个 HalProgram 如何分配到不同 RT 周期？需要调度元数据（周期、优先级、依赖）附加到 HalProgram。
5. **增量加载/热更新**：是否允许在不停止 Runtime 的情况下替换单个 HalProgram？需要版本号和原子切换机制。
6. **IR 版本兼容性**：版本号 1→2 升级时，Runtime 是否需要支持加载旧版本 IR？策略是向前兼容还是要求重新编译？

---

## 9. 参考

- D10: HAL 通信原语（Signal / StreamChannel / RPC）— `.agents/memorys/decisions.md`
- D12: 14 种统一类型系统 — `docs/modules/hal/iec-type-system-design.md`
- D19: 多语言策略 (Rust + FlatBuffers) — `docs/modules/hal/multi-language-strategy.md`
- D22: 编译器策略 (RuSTy → HAL IR → 自研) — `.agents/memorys/decisions.md`
- D24: 配置格式 (YAML + FlatBuffers) — `.agents/memorys/decisions.md`
- HalValue 枚举 — `crates/audesys-hal-core/src/value.rs`
- HalTransport trait — `crates/audesys-hal-core/src/transport.rs`
- FlatBuffers Schema — `crates/audesys-hal-flatbuffers/schema/hal_value.fbs`
- 线程调度 — `docs/modules/hal/thread-scheduling-design.md`
