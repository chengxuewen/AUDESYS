# AUDESYS 编译器管线设计

> **生成日期**: 2026-07-31
> **决策**: D108 (编译器管线架构)

## 概述

AUDESYS 有 6 种源码语言编译器，全部输出 HalProgram（HAL IR 字节码），运行在 16 寄存器 VM 上。

```
ST ──→ audesys-hal-binding-gen ──→ HalProgram        (直接)
G-code ──→ audesys-gcode-compiler ──→ HalProgram      (直接)
LD ──→ audesys-ld-compiler ──→ IL 文本 ──→ audesys-il-compiler ──→ HalProgram
FBD ──→ audesys-fbd-compiler ──→ IL 文本 ──→ audesys-il-compiler ──→ HalProgram
SFC ──→ audesys-sfc-compiler ──→ IL 文本 ──→ audesys-il-compiler ──→ HalProgram
```

## 设计决策

### 为什么 ST/G-code 直接编译？

| 语言 | 输入形式 | 编译路径 | 理由 |
|------|----------|----------|------|
| **ST** | 文本 → AST (有 if/while/for/case/function) | 直接 | AST 直接映射到 HalIR 的 Jump/Call/Ret |
| **G-code** | 文本 → AST (有 G/M 代码命令) | 直接 | 非 IEC 语言，无 IL 对应 |

### 为什么 LD/FBD/SFC 经 IL？

| 语言 | 输入形式 | 编译路径 | 理由 |
|------|----------|----------|------|
| **LD** | 图形 (触点/线圈/并联/串联) | 经 IL | 图形结构必须线性化为指令序列 |
| **FBD** | 图形 (功能块/信号线) | 经 IL | 功能块连接必须线性化 |
| **SFC** | 图形 (步骤/转换/动作) | 经 IL | 状态机必须线性化 |

IL (Instruction List) 是 IEC 61131-3 标准定义的"汇编语言"，用于线性化图形语言。

## 编译器详情

### ST 编译器 (`audesys-hal-binding-gen`)

- **输入**: IEC 61131-3 Structured Text
- **输出**: HalProgram (直接)
- **管线**: source → tokenize → parse_program → compile_ast → HalProgram
- **代码**: 1043 行 codegen，支持 if/while/for/case/function
- **测试**: 32 个 #[test] 标注，覆盖 34 个 HAL IR 操作码

### IL 编译器 (`audesys-il-compiler`)

- **输入**: IEC 61131-3 Instruction List 文本
- **输出**: HalProgram
- **管线**: source → tokenize → parse → compile_ast → HalProgram
- **代码**: 253 行 lexer + 227 行 parser + 347 行 codegen
- **支持指令**: 23 助记符 (LD/LDN/ST/AND/ANDN/OR/ORN/XOR/ADD/SUB/MUL/DIV/GT/GE/EQ/NE/LE/LT/JMP/JMPC/JMPCN/CAL/RET)
- **缺失指令**: S/R/NOT/MOD/定时器/计数器/边沿/双稳态 (计划 Phase 1-2 修复)
- **测试**: 32 个 #[test]

### LD 编译器 (`audesys-ld-compiler`)

- **输入**: LD 文本格式 (NETWORK + NO/NC/OUT/SET/RESET)
- **输出**: IL 文本 (经 IL 编译器编译为 HalProgram)
- **管线**: source → tokenize → parse_networks → generate_il → IL 文本
- **LD→IL 映射**:
  - NO 触点 (首个) → `LD var`
  - NC 触点 (首个) → `LDN var`
  - NO 触点 (后续) → `AND var`
  - NC 触点 (后续) → `ANDN var`
  - OUT 线圈 → `ST var`
  - SET 线圈 → `S var`
  - RESET 线圈 → `R var`
- **缺失**: 并联分支 (OR/ORN)、多输出、正/负跳变触点 (计划 Phase 1 修复)

### FBD 编译器 (`audesys-fbd-compiler`)

- **输入**: FbdGraph JSON (功能块图)
- **输出**: IL 文本
- **管线**: graph → convertGraphToIl → IL 文本

### SFC 编译器 (`audesys-sfc-compiler`)

- **输入**: SFC 文本格式 (STEP/TRANSITION/ACTION)
- **输出**: IL 文本
- **管线**: source → parse → generate_il → IL 文本
- **约束**: Phase 1 仅顺序步骤，无并行/替代分支

### G-code 编译器 (`audesys-gcode-compiler`)

- **输入**: ISO 6983 / RS274 G-code
- **输出**: HalProgram (直接)
- **管线**: source → tokenize → parse_all → compile_commands → HalProgram
- **支持**: G0/G1/G2/G3、M3/M4/M5、G17-G21/G90/G91/G80/M30

## HAL IR 操作码 (34 个)

| 分类 | 操作码 | 说明 |
|------|--------|------|
| 数据移动 | Nop, Load, Store | 基础数据移动 |
| 算术 | Add, Sub, Mul, Div, Mod, Neg | 完整算术 |
| 比较 | Eq, Neq, Gt, Lt, Gte, Lte | 完整比较 |
| 逻辑 | And, Or, Xor, Not | 完整位逻辑 |
| 控制流 | Jump, JumpIf, Call, Ret | 基础控制流 |
| 数组 | LoadIndex, StoreIndex | 数组访问 |
| 定时器 | TimerRun, ReadTimer | TON/TOF/TP |
| 计数器 | CounterRun, ReadCounter | CTU/CTD/CTUD |
| 双稳态 | SrRun, ReadSr | SR/RS |
| 边沿 | EdgeRun, ReadEdge | R_TRIG/F_TRIG |
| 终止 | Halt | 扫描周期结束 |

## IEC 61131-3:2025 合规性

> **重要**: IEC 61131-3 Edition 4 (2025年5月) 已移除 IL。标准现在只认：ST, LD, FBD, SFC。

| 语言 | 标准合规性 | 说明 |
|------|:----------:|------|
| ST | ✅ 完整 | 支持 if/while/for/case/function |
| LD | 🟡 基础 | NO/NC/OUT/SET/RESET，缺并联/多输出 |
| FBD | 🟡 基础 | 功能块 + 信号线，缺完整 FB 库 |
| SFC | 🟡 基础 | 顺序步骤，无并行分支 |
| IL | 🟡 基础 | 23/35+ 指令 |
| G-code | ✅ RS274 子集 | G0/G1/G2/G3 + M 代码 |

> **注**: 虽然 IEC 61131-3:2025 已移除 IL 作为标准语言，AUDESYS 仍将 IL 用作 LD/FBD/SFC 的**内部中间表示**（IR）。IL 作为"汇编语言"的线性化特性使其成为图形语言到 HalProgram 的理想中间层。用户不直接编写 IL 代码。

## 参考

- D108: 编译器管线架构决策 (decisions.md)
- `crates/audesys-hal-ir/src/instruction.rs` — HAL IR 操作码定义
- `crates/audesys-il-compiler/` — IL 编译器实现
- `crates/audesys-ld-compiler/` — LD 编译器实现
- `crates/audesys-hal-binding-gen/` — ST 编译器实现
- `crates/audesys-gcode-compiler/` — G-code 编译器实现
- `crates/audesys-fbd-compiler/` — FBD 编译器实现
- `crates/audesys-sfc-compiler/` — SFC 编译器实现
