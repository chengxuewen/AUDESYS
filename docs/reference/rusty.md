# RuSTy — Rust 实现的 IEC 61131-3 结构化文本编译器

> 文档定位：为 AUDESYS 未来可能的 IEC 61131-3 ST 支持提供编译器后端参考。

---

## 目次

1. [产品画像](#一产品画像)
2. [技术特性](#二技术特性)
3. [功能概览](#三功能概览)
4. [现状与生态](#四现状与生态)
5. [市场定位](#五市场定位)
6. [产品特色](#六产品特色)
7. [对 AUDESYS 参考价值](#七对-audesys-参考价值)

---

## 一、产品画像

### 1.1 基本信息

| 属性 | 内容 |
|------|------|
| **项目全称** | RuSTy（Rust Structured Text Compiler） |
| **项目定位** | 基于 Rust 和 LLVM 的 IEC 61131-3 结构化文本（ST）编译器 |
| **开发者** | PLC-lang 社区，核心维护者为开源贡献者团队 |
| **许可证** | LGPL（Lesser General Public License） |
| **项目仓库** | https://github.com/PLC-lang/rusty |
| **首次发布** | ~2022 年 |
| **v1.0.0 正式发布** | 2026 年 6 月 3 日 |
| **开发语言** | Rust（编译器本体）、ST（标准库）、Markdown（文档） |
| **后端** | LLVM 编译器基础设施（生成原生机器码） |
| **官方文档** | https://plc-lang.github.io/rusty/ |

### 1.2 GitHub 仓库统计（截至 2026 年 7 月）

| 指标 | 数值 |
|------|------|
| **Stars** | 1,000+ |
| **Forks** | 100+ |
| **提交次数** | 3,000+ |
| **贡献者** | 50+ |
| **Open Issues** | 活跃 |
| **最新活动** | 每日活跃开发（2026 年 4 月提交了 #1688：IEC 61131-3:2025 Edition 属性语法迁移） |

### 1.3 项目起源与背景

RuSTy 起源于工业自动化社区对**开放、现代、原生编译的 IEC 61131-3 编译器**的需求。传统工业 PLC 编程环境（如 CODESYS、Beckhoff TwinCAT、Siemens TIA Portal）虽然功能完善，但编译器技术栈封闭、依赖于专有运行时。

RuSTy 的开发动机包括：
1. **打破厂商锁定（Vendor Lock-in）**：PLC 世界长期被少数厂商的编译器/运行时垄断，开源社区需要一个共同的编译器基础
2. **利用现代编译器技术**：LLVM 提供了世界级的优化和后端支持，ST 编译器不应停留在 1990 年代技术
3. **Rust 的安全性**：编译器是软件可信链（Trust Chain）中的关键组件——一个用 Rust 编写的编译器可以消除大量内存安全漏洞
4. **跨平台原生编译**：从 x86 服务器到 ARM 嵌入式设备再到 RISC-V 微控制器甚至是 WASM 浏览器——LLVM 后端一键切换

项目维护者曾表示："越多公司使用我们的基础，我们就能更好地覆盖各种小众兼容场景。"这一愿景与 Linux 内核的发展路径高度相似。

### 1.4 核心价值主张

RuSTy 的核心价值可概括为四个关键词：

| 价值 | 说明 |
|------|------|
| **开放** | LGPL 许可，可用于商业产品（动态链接或提供目标文件供用户重新链接） |
| **原生** | 直接编译为原生机器码（x86/ARM/RISC-V/WASM），无需虚拟机或解释器 |
| **现代** | 跟进 IEC 61131-3:2025 Edition（属性语法），使用 Rust + LLVM 现代技术栈 |
| **无运行时** | RuSTy 不包含运行时，输出的是纯目标文件（.o / .so），由用户自行调度 |

---

## 二、技术特性

### 2.1 编译器架构

RuSTy 采用**直接 AST→LLVM IR 代码生成**的架构（当前版本，未来计划引入 Mid-level IR）：

```
┌────────────────────────────────────────────────────────────┐
│  IEC 61131-3 Structured Text Source (.st)                  │
│  PROGRAM MyController                                       │
│  VAR                                                        │
│    sensor AT %IW0 : INT;                                    │
│    setpoint : REAL := 100.0;                                │
│  END_VAR                                                    │
│  sensor := sensor + 1;                                      │
│  IF sensor > setpoint THEN ... END_IF                       │
│  END_PROGRAM                                                │
└────────────────────────┬───────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Lexer（词法分析） — 基于 logos crate                      │
│  • 识别 IEC 61131-3 关键字（PROGRAM, VAR, IF, THEN, ...）  │
│  • 支持 IEC 61131-3:2025 新关键字（PROPERTY_GET/PROPERTY_SET）│
│  • Token 流输出                                              │
└────────────────────────┬───────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Parser（语法分析） — 手写递归下降解析器                    │
│  • 构造 Concrete Syntax Tree（具体语法树）                   │
│  • 支持 POUs（Program/Function Block/Function）              │
│  • 支持 Class/Interface/Method（IEC 61131-3 OOP 扩展）      │
│  • IEC 61131-3:2025 Property 语法解析                        │
│  • 硬件地址绑定（AT %IW0）                                    │
└────────────────────────┬───────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  AST（Abstract Syntax Tree）— plc_ast crate                 │
│  • 类型化 AST（Typed AST）                                   │
│  • 属性块（PropertyBlock）— PROPERTY_GET/PROPERTY_SET 聚合  │
│  • 配置变量（ConfigVariable）— 硬件地址绑定 %IX1.1 等        │
│  • 访问者模式（Visitor + MutVisitor）                        │
└────────────────────────┬───────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Validation & Semantic Analysis（验证与语义分析）            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ • 类型检查（Type Checking）                              │ │
│  │ • 作用域检查（Scope Resolution）                         │ │
│  │ • 类型推导（Type Inference）                             │ │
│  │ • 属性验证（Property Validation）                        │ │
│  │ • 诊断生成（Diagnostics，错误码 E001-E117+）            │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬───────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Lowering（降级转换）— plc_lowering crate                   │
│  • 高级 ST 结构 → 低级 IR 友好形式                           │
│  • 接口多态调度表生成（Polymorphism Dispatch Table）         │
│  • 继承层次展开                                              │
└────────────────────────┬───────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Codegen（代码生成）— 直接 AST → LLVM IR                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ • 当前状态：复杂但功能完整的直接代码生成逻辑              │ │
│  │ • 处理状态机、控制流、OOP 虚函数分派                     │ │
│  │ • 未来计划：引入 Mid-level IR（MIR）简化代码生成         │ │
│  │ • 社区讨论：#1556 "Architectural inquiry: Direct        │ │
│  │   AST-to-LLVM vs Intermediate Representation"           │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬───────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  LLVM Backend                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ • LLVM IR → 优化 Pass → 目标机器码                      │ │
│  │ • 目标架构：x86_64, ARM64, RISC-V, WASM                │ │
│  │ • 输出格式：.o (静态对象), .so/.dll (共享库),           │ │
│  │            .ll (LLVM IR), .bc (LLVM Bitcode)           │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 2.2 关于 Mid-level IR（MIR）的讨论

RuSTy 维护者在 GitHub Discussion #1556 中分享了关于编译器架构的深刻见解：

> **直接 AST→LLVM 代码生成**使架构保持精简，但导致代码生成逻辑相当复杂，需要处理状态和复杂的控制流。

维护者的关键观点：
- MIR 有**显著好处**：可以在 MIR 层统一处理控制流展开、ST 特定语义（如 EN/ENO 信号流），然后简洁地映射到 LLVM IR
- 但 MIR 的**复杂性转移**：代码生成简化了，但复杂的工作移到了更早的阶段（MIR 构造和优化）
- **不要从一开始就过度设计**："在开始时让系统先编译通过，然后再优化它。如果在设计之初就能容纳 MIR，那很好——它会更容易维护……但请记住你仍然在做同样的步骤，只是更早而已"
- RuSTy **计划将来引入 MIR**，这已在核心团队的路线图中

这个经验直接适用于 AUDESYS 如果将来实现自己的 ST 编译器前端——可以先快速出原型（直接生成 HAL API 调用），再逐步引入优化层。

### 2.3 类型系统

RuSTy 完整实现了 IEC 61131-3 的类型层级。以下是支持的类型及其 LLVM 映射：

| IEC 61131-3 类型 | Rusty 支持 | LLVM 映射 | 备注 |
|-----------------|-----------|-----------|------|
| **BOOL** | ✔ | i1 | 布尔类型 |
| **SINT** | ✔ | i8 | 8 位有符号整数 |
| **INT** | ✔ | i16 | 16 位有符号整数 |
| **DINT** | ✔ | i32 | 32 位有符号整数 |
| **LINT** | ✔ | i64 | 64 位有符号整数 |
| **USINT** | ✔ | i8 | 8 位无符号整数 |
| **UINT** | ✔ | i16 | 16 位无符号整数 |
| **UDINT** | ✔ | i32 | 32 位无符号整数 |
| **ULINT** | ✔ | i64 | 64 位无符号整数 |
| **REAL** | ✔ | f32 | 32 位浮点数 |
| **LREAL** | ✔ | f64 | 64 位浮点数 |
| **STRING** | ✔ | {i8*, i64} | 字符串（指针 + 长度） |
| **WSTRING** | ✔ | {i16*, i64} | 宽字符串（UTF-16） |
| **DATE** | ✔ | i64 | 日期类型（64 位时间戳） |
| **TIME** | ✔ | i64 | 时间类型 |
| **TOD（Time of Day）** | ✔ | i64 | 当日时间 |
| **DT（Date and Time）** | ✔ | i64 | 日期时间 |
| **LDATE/LTIME/LTOD/LDT** | ✔ | i64 | 长整型时间类型 |
| **ARRAY [lo..hi] OF type** | ✔ | [N x LLVMType] | 定长数组 |
| **STRUCT** | ✔ | {LLVMTypes...} | 结构体类型 |
| **ENUM** | ✔ | 对应整数类型 | 枚举类型 |
| **ALIAS** | ✔ | 类型别名 | 类型别名 |
| **Sub-range** | ✔ | 基础整数类型 + 运行时检查 | 子范围类型 |
| **Sized String (STRING[N])** | ✔ | [N x i8] | 定长字符串 |
| **REFERENCE TO** | ✔ | 指针 | 引用类型 |
| **Initial Values** | ✔ | 编译时常量初始化 | 初始值 |

### 2.4 C 互操作层（C Interoperability）

RuSTy 的核心设计之一是**通过 C ABI 与硬件绑定**：

```
┌───────────────────┐     C ABI      ┌───────────────────┐
│  IEC 61131-3 程序  │ ◄──────────► │  C/Rust 运行时     │
│  (ST 编译为 .so)    │              │  (硬件抽象层)      │
│                    │              │                    │
│  PROGRAM Main      │              │  void read_sensor( │
│    ...             │   extern     │    int* value);    │
│    result :=       │   FUNCTION   │                   │
│      read_sensor();│   read_sensor│  void write_act(   │
│    write_act(result│   : DINT;    │    int value);     │
│    );              │              │                    │
│  END_PROGRAM       │              │  int main() {      │
│                    │              │    // 周期调度     │
│                    │              │    // 调用 ST 程序 │
│                    │              │  }                 │
└───────────────────┘              └───────────────────┘
```

**外部函数声明**（ST 侧）：
```pascal
{external} FUNCTION read_sensor : DINT; END_FUNCTION
{external} FUNCTION write_act : DINT; VAR_INPUT value : DINT; END_VAR END_FUNCTION
```

**C 侧实现**：
```c
#include <stdint.h>

int64_t read_sensor(void) {
    // 通过硬件接口读取传感器值
    return hardware_read(SENSOR_REGISTER);
}

int64_t write_act(int64_t value) {
    // 通过硬件接口写入执行器
    hardware_write(ACTUATOR_REGISTER, value);
    return 0;
}
```

**硬件地址绑定**（AT 语法）：
```pascal
VAR_GLOBAL
    myInput AT %IX1.1 : BOOL;  // 绑定到输入地址 %IX1.1
    myOutput AT %QW5 : WORD;    // 绑定到输出地址 %QW5
END_VAR
```

这些绑定变量会在编译后的目标文件中生成对应符号（如 `__PI_1_1`），运行时可使用 DWARF 调试符号（通过 gimli crate 解析）来发现和绑定变量，供 Modbus 等协议读取。

> **当前限制**：RuSTy 目前仅目标 64 位系统（所有指针均为 64 位），日期时间类型也是 64 位。如需 32 位目标（如某些微控制器），社区欢迎贡献。

---

## 三、功能概览

### 3.1 IEC 61131-3 语言支持

RuSTy 当前支持 **结构化文本（ST）** 语言。以下是支持的语言特性：

| 特性 | 状态 | 说明 |
|------|------|------|
| **基本赋值与算术** | ✔ 完全支持 | :=, +, -, *, /, MOD 等 |
| **条件语句** | ✔ 完全支持 | IF/THEN/ELSIF/ELSE/END_IF, CASE/OF/ELSE/END_CASE |
| **循环语句** | ✔ 完全支持 | FOR/TO/BY/DO/END_FOR, WHILE/DO/END_WHILE, REPEAT/UNTIL/END_REPEAT |
| **函数与函数块** | ✔ 完全支持 | FUNCTION, FUNCTION_BLOCK, PROGRAM，含 VAR_INPUT/OUTPUT/IN_OUT |
| **结构化类型** | ✔ 完全支持 | STRUCT, ARRAY, ENUM, ALIAS, Sub-range |
| **字符串操作** | ✔ 完全支持 | STRING, WSTRING, Sized String, 字符串函数 |
| **日期时间** | ✔ 完全支持 | DATE, TIME, TOD, DT, 含长整型变体 |
| **OOP 支持** | ✔ 完全支持 | CLASS, INTERFACE, METHOD, EXTENDS, IMPLEMENTS |
| **属性（Properties）** | ✔ IEC 61131-3:2025 | PROPERTY_GET / PROPERTY_SET（2025 Edition 正式语法） |
| **外部函数** | ✔ 完全支持 | {external} FUNCTION — C 互操作 |
| **硬件地址绑定** | ✔ 完全支持 | AT %IX, %QX, %IW, %QW 等 |
| **指针/引用** | ✔ 完全支持 | REFERENCE TO, 指针解引用 |
| **SFC** | ✘ 未支持 | 顺序功能图（Sequential Function Chart） |
| **LD** | ✘ 未支持 | 梯形图（Ladder Diagram） |
| **FBD** | ✘ 未支持 | 功能块图（Function Block Diagram） |
| **IL** | ✘ 未支持 | 指令表（Instruction List，IEC 61131-3 第三版已移除） |

### 3.2 编译目标（Target）

RuSTy 借助 LLVM 的交叉编译能力支持多种目标架构（目前仅 64 位）：

| 目标 | 状态 | 用途 |
|------|------|------|
| **x86_64-linux** | ✔ 主要目标 | 服务器/工业 PC 部署 |
| **x86_64-windows** | ✔ 支持 | Windows 工业 PC |
| **aarch64-linux** | ✔ 支持 | ARM64 嵌入式控制器 |
| **riscv64** | ✔ 支持 | RISC-V 微控制器/处理器 |
| **wasm32** | ✔ 支持 | WebAssembly（浏览器/边缘计算） |

编译命令示例：
```bash
# 编译到本地目标
plc build --target=x86_64-linux

# 交叉编译到 ARM64
plc build --target=aarch64-linux --sysroot=/path/to/sysroot --linker=aarch64-linux-gnu-gcc

# 生成 LLVM IR（调试用）
plc build --emit=ir

# 生成 LLVM Bitcode
plc build --emit=bc
```

### 3.3 标准库（stdlib）

RuSTy 包含 IEC 61131-3 标准库的部分实现，位于 `libs/stdlib/iec61131-st/`：

| 标准库模块 | 内容 |
|-----------|------|
| **双稳态功能块** | RS, SR（复位优先/置位优先触发器） |
| **边沿检测** | R_TRIG, F_TRIG（上升沿/下降沿检测） |
| **计数器** | CTU, CTD, CTUD（加/减/加减计数器） |
| **定时器** | TON, TOF, TP（接通延时/断开延时/脉冲定时器） |
| **字符串函数** | LEN, LEFT, RIGHT, MID, CONCAT, INSERT, DELETE, REPLACE, FIND |
| **数值函数** | ABS, SQRT, LN, LOG, EXP, SIN, COS, TAN, ASIN, ACOS, ATAN |
| **类型转换** | *_TO_* 系列类型转换函数 |

### 3.4 工具链集成（plc-toolkit）

RuSTy 是 **plc-toolkit** 生态的核心编译器组件：

| 工具 | 功能 |
|------|------|
| **plc** | RuSTy 的 CLI 前端：编译、构建项目、运行测试 |
| **plc-project** | 项目模板管理 |
| **plc-debug** | 调试支持（通过 DWARF 符号解析） |
| **plc-lsp** | LSP（Language Server Protocol）服务器 |

---

## 四、现状与生态

### 4.1 版本状态

| 版本 | 日期 | 关键变化 |
|------|------|---------|
| **v0.x（开发期）** | ~2022-2025 | 核心 ST 语言支持、LLVM 代码生成、OOP 语义 |
| **v1.0.0** | 2026-06-03 | 稳定 API、正式发布、语义版本控制开始 |
| **当前** | 2026-07 | 活跃开发，IEC 61131-3:2025 Property 语法迁移中 |

### 4.2 下游项目

| 项目 | 说明 |
|------|------|
| **plc-toolkit** | RuSTy 生态的工具链套装（构建系统 + LSP + 调试） |
| **RoboC++** | 机器人控制相关的 C++/ST 混合编程项目 |
| **OpenPLC 集成** | 社区有将 RuSTy 与 OpenPLC 集成的讨论和初步实验（参见 Scribd 上的 "Beyond 2nd Edition OpenPLC Forum" 文档） |

### 4.3 社区活跃度

- **GitHub Discussions**：活跃的技术讨论区。典型讨论如 #1556（AST→LLVM vs MIR 架构对比）、#1406（实际硬件支持状态）
- **Issue 响应**：核心维护者通常在几天内回复技术问题
- **Contribution 指引**：项目欢迎贡献，特别是在文档（硬件绑定说明被明确标注为需要改进的领域）
- **路线图透明度**：维护者公开讨论未来计划（如 MIR 引入）

### 4.4 已知限制与待办

| 限制 | 影响 | 计划 |
|------|------|------|
| **仅 64 位目标** | 不支持 32 位 ARM Cortex-M 等微控制器 | 欢迎贡献者提交 PR 支持 |
| **无运行时** | 用户需自己编写调度循环（定时器触发 ST 程序执行） | 这是设计选择，不会内置运行时 |
| **无 SFC/LD/FBD** | 仅限于 ST 语言 | 暂无明确计划 |
| **直接 AST→LLVM 代码生成复杂度** | 代码生成模块维护难度较高 | 计划引入 MIR |
| **属性语法过渡期** | IEC 61131-3:2025 新语法与旧自定义语法并存 | 逐步迁移中（见 #1688） |
| **用户文档** | 文档覆盖不完整（硬件绑定是贡献重点） | 欢迎文档贡献 |
| **库生态** | 标准库功能有限（相较于 CODESYS/Beremiz） | 逐步扩展 |

---

## 五、市场定位

### 5.1 与其他 IEC 61131-3 编译器的对比

| 维度 | RuSTy | CODESYS Compiler | MatIEC (Beremiz/OpenPLC) | logi.CAD |
|------|-------|-----------------|------------------------|----------|
| **许可证** | LGPL（开源） | 专有（运行时按设备许可） | GPLv2（MatIEC）, GPL/LGPL（Beremiz） | 专有 |
| **实现语言** | Rust | C | C++ | 专有 |
| **后端** | LLVM（多目标原生代码） | 自研原生代码生成器（x86/ARM/PowerPC/TriCore 等 12+ 目标） | 自研中间代码（IL）→ C 代码生成 | 自研 |
| **优化质量** | LLVM 优化 Pass（O0-O3） | 专有优化（良好，但闭源） | 基础优化 | 中等 |
| **IEC 版本** | IEC 61131-3:2025 Edition | IEC 61131-3:2013 Edition | IEC 61131-3:2003 Edition (2nd) | IEC 61131-3:2013 |
| **语言支持** | 仅 ST | ST, LD, FBD, SFC, IL, CFC | ST, IL, SFC（MatIEC v2） | ST, LD, FBD, SFC |
| **OOP 支持** | ✔ Class/Interface/Method/Property | ✔（CODESYS V3.5 SP17+） | ✘ | ✔ |
| **运行时** | 无（输出 .so 自管理） | CODESYS Control Runtime | MatIEC 独立运行时 + OpenPLC Runtime | logi.RTS |
| **硬件支持** | LLVM 目标 × C 互操作 | CODESYS Runtime Toolkit（12+ 架构） | 通过 HAL 层（OpenPLC） | 专有软 PLC |
| **IDE** | CLI + LSP（可集成到 VS Code 等） | CODESYS Development System（.NET） | Beremiz IDE（Python/wxPython） | logi.CAD IDE |
| **成熟度** | 早期（v1.0 刚发布） | 极成熟（30 年历史） | 中等成熟 | 成熟（24 年历史） |
| **生态系统** | 有限（社区驱动） | 极庞大（400+ OEM 厂商，数百万节点） | 小-中（教育/研究为主，OpenPLC 最近在增长） | 中（Siemens I/O 等集成） |

### 5.2 RuSTy 的独特定位

RuSTy 在 IEC 61131-3 编译器生态中占据一个独特的细分位置：

1. **唯一使用 Rust + LLVM 的组合**：Rust 提供编译器本身的内存安全，LLVM 提供世界级优化和多目标支持——没有任何其他 ST 编译器同时拥有这两者
2. **唯一原生支持 IEC 61131-3:2025 Edition**：当 CODESYS 和其他编译器还在适配 2013 版本时，RuSTy 已率先迁移到 2025 Edition 语法
3. **"库而非平台"哲学**：CODESYS 和 Beremiz 都提供完整的 IDE + Runtime 平台，RuSTy 只做编译器——类似于 gcc/clang 在 C 世界中的角色
4. **WGSL/WAST/WASM 潜力**：虽然 RuSTy 目前不支持梯形图和功能块图，但其 LLVM→WASM 路径为浏览器端工业控制提供了可能性（类似 TwinCAT HMI 但更开放）

### 5.3 适用场景

| 场景 | RuSTy 适合度 | 说明 |
|------|------------|------|
| **嵌入式 ST 控制器（自定义硬件）** | ★★★★★ | 编译为原生代码 + C 互操作是理想的软 PLC 模式 |
| **工业 PC 部署** | ★★★★ | 原生 Linux/Windows 编译，但缺少现成运行时 |
| **教育/研究** | ★★★★★ | 开源 + LGPL + 简单 CLI 极适合教学 |
| **浏览器端仿真** | ★★★★ | WASM 目标使 ST 程序可以运行在浏览器中 |
| **PLC 厂商二次开发** | ★★★★ | LGPL 允许商业使用（动态链接），可作为自有 IDE 的后端编译器 |
| **大型 DCS 系统** | ★★ | 缺少分布式 I/O 管理、冗余、报警等平台功能 |
| **现有 PLC 替代** | ★ | 无现成的编程 IDE、无丰富的库生态、无认证 |

---

## 六、产品特色

### 6.1 编译器本身的 Rust 安全性

RuSTy 不仅是"编译 ST 的工具"——它本身是用 Rust 编写的，这是其最重要的特色之一。传统 IEC 61131-3 编译器（CODESYS、MatIEC、logi.CAD）均使用 C/C++ 实现，这意味着编译器本身可能成为安全攻击面。

在工业控制系统中，编译器是**可信计算基（TCB，Trusted Computing Base）**的一部分——如果编译器被攻击者篡改或利用其漏洞，生成的机器码可能包含后门。Rust 的内存安全和类型安全从根本上消除了缓冲区溢出、Use-after-free、空指针解引用等 C/C++ 常见漏洞。

### 6.2 LLVM 后端的跨架构优势

RuSTy 的 LLVM 后端是其最具战略价值的技术选择：

| 架构 | 典型设备 | 编译器路径 |
|------|---------|-----------|
| x86_64 | Intel/AMD IPC | `RuSTy → LLVM → x86_64 机器码` |
| ARM64 | Raspberry Pi, NVIDIA Jetson, Qualcomm 嵌入式 | `RuSTy → LLVM → ARM64 机器码` |
| RISC-V 64 | SiFive, StarFive 等 RISC-V SoC | `RuSTy → LLVM → RISC-V 机器码` |
| WASM | 浏览器, Wasmtime, Wasmer, Edge Runtime | `RuSTy → LLVM → WASM bytecode` |

这种跨架构能力意味着：同一份 ST 源代码可以编译为车间现场的 ARM 控制器，也可以编译为云端的 x86 仿真环境，甚至编译为浏览器中的 Wasm 演示——只需切换 `--target` 参数。

### 6.3 IEC 61131-3:2025 Edition 的先行者

IEC 61131-3:2025 Edition 引入了几项重要变化，RuSTy 是最早适配的编译器之一：

- **正式 Property 语法**：`PROPERTY_GET / PROPERTY_SET` 替代了之前非标准的自定义语法。RuSTy 的 PR #1688（2026-04-21）完成了此迁移，涉及 60 个文件的修改
- **属性语法适配的务实态度**：核心团队坦言当前的实现是"某种程度上的 Hack"——内部仍使用 `PropertyBlock` 聚合 AST 节点，这展示了在保持兼容性和快速推进之间的平衡
- **CODESYS 也在跟进**：CODESYS 文件存储（File Based Storage）v0.9.2 测试版也已支持新的属性语法

### 6.4 轻量级"库"设计

RuSTy 没有运行时（Runtime），它是纯粹的代码生成器。这使得它可以在任何地方嵌入：

```bash
# 类 Unix 管道式使用
cat my_program.st | rusty compile -o my_program.so
gcc my_runtime.c -L. -lmy_program -o controller
./controller
```

这种设计类似于 LLVM/Clang 在 C 世界中的角色——它不是操作系统，而是一个工具，可以被更上层的系统（如 AUDESYS Runtime）编排和使用。

### 6.5 活跃且务实的社区

与许多学术项目不同，RuSTy 的社区**目标明确是工业级**。核心团队公开邀请商业公司使用并贡献：
> "越多公司使用我们的基础，我们就能更好地兼容各种小众场景。"

社区讨论质量高，如 #1556 的 AST→LLVM vs MIR 讨论中，维护者给出了基于实际经验的工程建议（而非纯理论），并且接受了外部贡献者的合理质疑。

---

## 七、对 AUDESYS 参考价值

### 7.1 编译器后端集成架构

如果 AUDESYS 将来支持 IEC 61131-3 ST 语言，RuSTy 可以作为**编译器后端**直接集成：

```
┌────────────────────────────────────────────────────────────┐
│              AUDESYS Studio IDE                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ST Editor (IEC 61131-3 编辑器)                        │ │
│  │  • 语法高亮、自动补全、诊断                             │ │
│  │  • LSP 客户端 → plc-lsp                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ST Compiler Integration Layer                          │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Compiler Backend Selector                       │  │ │
│  │  │  ┌──────────────┐  ┌───────────────────────────┐ │  │ │
│  │  │  │  RuSTy       │  │  Future: custom backend   │ │  │ │
│  │  │  │  (LLVM)      │  │  (HAL API native)         │ │  │ │
│  │  │  └──────────────┘  └───────────────────────────┘ │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  HAL Binding Generator                                 │ │
│  │  • 将 ST 外部函数映射为 HAL Signal / RPC 调用          │ │
│  │  • 将 ST AT 地址绑定转换为 HAL 组件寻址                 │ │
│  │  • 生成 HAL 适配层桩代码（C ABI → HAL API）             │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AUDESYS Runtime                                        │ │
│  │  • 加载 .so 到 RT 线程的执行周期中                       │ │
│  │  • 周期调用 ST 程序入口点                               │ │
│  │  • 在调用前后执行 Signal 输入/输出刷新                   │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 7.2 ST 程序到 HAL 的映射模式

利用 RuSTy 编译的 ST 程序与 AUDESYS HAL 的集成可以采用以下模式：

#### 7.2.1 编译期集成（推荐方式）

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  ST 源代码   │────▶│  RuSTy 编译器    │────▶│  .so 文件     │
│  (Logic)    │     │  + HAL Binding   │     │  + HAL 清单   │
└─────────────┘     │  Generator       │     └──────┬───────┘
                    └─────────────────┘            │
                                                   ▼
                    ┌─────────────────────────────────────┐
                    │  HAL Integration Manifests          │
                    │                                     │
                    │  Signals (from ST VAR/AT 变量):      │
                    │  • controller.sensor_value : INT    │
                    │  • controller.actuator_cmd : BOOL   │
                    │  • controller.alarm_flag : BOOL     │
                    │                                     │
                    │  RPC Methods (from ST FUNCTION):     │
                    │  • controller.config_setpoint()     │
                    │  • controller.calibrate()            │
                    │                                     │
                    │  Schedule:                           │
                    │  • Entry point: controller_main()   │
                    │  • Cycle: 10ms (RT thread)          │
                    │  • Input refresh → main() → Output  │
                    └─────────────────────────────────────┘
```

**ST 代码示例**：
```pascal
PROGRAM MotorControl
VAR_EXTERNAL
    speed_feedback AT %IW0 : INT;      {input} 
    speed_setpoint : INT := 1000;       {input}
    motor_enable AT %QW0 : BOOL;       {output}
    fault_flag : BOOL;                  {output}
END_VAR

VAR
    error : INT;
END_VAR

// 控制逻辑
error := speed_setpoint - speed_feedback;
IF error > 50 THEN
    motor_enable := TRUE;
    fault_flag := FALSE;
ELSE
    motor_enable := FALSE;
    fault_flag := TRUE;
END_IF;
END_PROGRAM
```

**HAL Binding Generator 输出**：
```yaml
# 自动生成的 HAL 组件清单
component: motor_control
signals:
  - name: motor_control.speed_feedback
    type: INT
    direction: input
    source: ruSTy_program.MotorControl.speed_feedback
  - name: motor_control.speed_setpoint
    type: INT
    direction: input
    source: ruSTy_program.MotorControl.speed_setpoint
  - name: motor_control.motor_enable
    type: BOOL
    direction: output
    target: ruSTy_program.MotorControl.motor_enable
  - name: motor_control.fault_flag
    type: BOOL
    direction: output
    target: ruSTy_program.MotorControl.fault_flag

schedule:
  entry_point: MotorControl_main
  cycle: 10ms
  thread: RT
  io_update: read_inputs → call_MotorControl_main → write_outputs
```

#### 7.2.2 运行时适配

RT 线程的调度循环：

```
┌──────────────── 每个 RT 周期 ────────────────┐
│                                                │
│  1. read_inputs():                             │
│     speed_feedback := hal.read_signal(         │
│       "motor_control.speed_feedback")          │
│     speed_setpoint := hal.read_signal(         │
│       "motor_control.speed_setpoint")           │
│                                                │
│  2. MotorControl_main():                       │
│     执行 ST 控制逻辑 (.so 中的编译代码)          │
│                                                │
│  3. write_outputs():                           │
│     hal.publish_signal(                        │
│       "motor_control.motor_enable",            │
│       motor_enable)                            │
│     hal.publish_signal(                        │
│       "motor_control.fault_flag",              │
│       fault_flag)                              │
│                                                │
└────────────────────────────────────────────────┘
```

### 7.3 RuSTy 的"无运行时"哲学与 AUDESYS 的契合度

RuSTy 选择不提供运行时，正是 AUDESYS 可以补充的价值：

| RuSTy 缺失 | AUDESYS 提供 | 结合效果 |
|-----------|-------------|---------|
| 周期调度循环 | HAL RT 线程 + Signal 周期刷新 | RuSTy 编译的 ST 程序被挂载到 RT 线程中执行 |
| I/O 硬件抽象 | HAL 14 种类型 + amw | ST 程序的 `AT %IW0` 等绑定通过 HAL Signal 实现 |
| 分布式通信 | HAL StreamChannel + RPC | ST 程序可以读写远程 Signal，调用远程 RPC |
| 设备发现 | HalDiscovery | ST 程序引用的外部组件可在运行时被发现和绑定 |
| QoS 保证 | HalQoS (deadline/liveliness/security_domain) | 安全关键 ST 程序可通过 HalQoS 配置 deadline |

### 7.4 编译器集成层级选择

AUDESYS 在不同阶段可以选择不同深度的 RuSTy 集成：

| 集成层级 | 方式 | 优点 | 缺点 | 推荐阶段 |
|---------|------|------|------|---------|
| **Level 0：独立使用** | RuSTy 单独编译 .so，AUDESYS 手动加载 | 零集成成本 | 手动映射 HAL 接口，无 IDE 集成 | 原型验证 |
| **Level 1：HAL Binding Generator** | RuSTy 编译 + 后处理生成 HAL 清单 | 自动生成 Signal/RPC 映射 | 需要维护生成器代码 | Phase 2-3 |
| **Level 2：嵌入为库** | 通过 Rust FFI 在 AUDESYS 进程中调用 RuSTy 编译器 API | 实时编译、IDE 集成 | RuSTy API 可能不稳定（v1.0 刚开始） | Phase 3-4 |
| **Level 3：定制后端** | 为 RuSTy 编写自定义代码生成后端，直接输出 HAL API 调用 | 零开销集成 | 巨大的维护成本 | Phase 4+（不推荐） |

**推荐路径**：Phase 2 实现 Level 1（HAL Binding Generator），Phase 3 根据需要推向 Level 2。

### 7.5 仿真器中的 ST 执行

AUDESYS Simulator 可以在 WASM 目标执行 ST 逻辑（利用 RuSTy 的 WASM 后端）：

```
┌────────────────────────────────────────────────────┐
│  Simulator                                           │
│                                                      │
│  ┌──────────────────────────┐ ┌───────────────────┐ │
│  │ RT Simulation Thread     │ │ HMI / Web UI      │ │
│  │ (native x86_64 .so)     │ │                   │ │
│  │                          │ │ ┌───────────────┐ │ │
│  │ MotorControl.so ────────│─│▶│ WASM Instance │ │ │
│  │ (RuSTy x86_64 编译)     │ │ │               │ │ │
│  │                          │ │ │ MotorControl  │ │ │
│  │ 高效的二进制代码         │ │ │ .wasm         │ │ │
│  │ 用于精确仿真             │ │ │               │ │ │
│  │                          │ │ │ 浏览器端仿真  │ │ │
│  └──────────────────────────┘ │ └───────────────┘ │ │
│                                                      │
│  两种模式可以运行同一份 ST 源代码：                    │
│  • RT 模式：编译为原生 .so，精确仿真                   │
│  • 展示模式：编译为 .wasm，浏览器交互式演示             │
└────────────────────────────────────────────────────┘
```

### 7.6 安全关键系统的编译器认证考虑

如果 AUDESYS 将来需要支持安全关键系统（如 SIL3 功能安全），编译器认证是一个绕不开的话题：

**RuSTy 与认证**：
- LGPL 开源代码便于**审计和验证**（相较于闭源的 CODESYS 编译器）
- Rust 编写的编译器具有**更高的内存安全基线**，减少了认证中的可信计算基（TCB）复杂度
- 但 RuSTy 目前**尚未经过任何安全认证**（IEC 61508 SIL3 编译器认证，如 TÜV SÜD）
- LLVM 本身也未经过安全认证——这是所有 LLVM 后端编译器的共同挑战

**AUDESYS 的路径**：
- 非安全应用：RuSTy 直接作为编译后端
- 安全关键应用：RuSTy 编译后的 .so 文件可以经过**独立的二进制验证**（反汇编 → 控制流图验证 → 确认符合预期）
- 或者使用"多样化编译"（Diverse Compilation）：同一 ST 程序用 RuSTy 和另一个编译器分别编译，运行时比较输出

### 7.7 ST 代码到 HAL 的类型系统映射

| IEC 61131-3 类型 | HAL 14 类型 | 说明 |
|-----------------|------------|------|
| BOOL | Bool | 直接映射 |
| SINT/USINT | S8/U8 | 8 位整数 |
| INT/UINT | S16/U16 | 16 位整数 |
| DINT/UDINT | S32/U32 | 32 位整数 |
| LINT/ULINT | S64/U64 | 64 位整数 |
| REAL | F32 | 32 位浮点 |
| LREAL | F64 | 64 位浮点 |
| STRING | String | 变长字符串 |
| WSTRING | String | UTF-8 转换（WSTRING 内部为 UTF-16） |
| DATE/TIME/TOD/DT | S64 | 64 位纳秒时间戳 |
| ARRAY [N] OF T | Array\<T\> | 定长数组 |
| STRUCT | 组合为多个 Signal | 结构体成员展开为独立 Signal |

> 注意：IEC 61131-3 的 STRUCT 类型可能需要展开为多个 HAL Signal，因为 HAL 的类型系统中每个 Signal 是单一类型的值，不支持嵌套结构（除非使用 Blob 序列化）。

### 7.8 总结：RuSTy 对 AUDESYS 的战略价值

1. **最直接的 ST 编译器后端**：无需从零开发 IEC 61131-3 编译器，直接集成 RuSTy 编译生成的 .so
2. **跨架构部署**：同一份 ST 逻辑可以在 x86_64 仿真器上运行，也可以在 ARM64/RISC-V 现场设备上运行
3. **WASM 赋能**：WASM 目标使得浏览器端运行 ST 逻辑成为可能，这对于 AUDESYS Studio 的在线仿真功能极具价值
4. **类型安全 + 内存安全**：Rust 编写的编译器在可信计算基（TCB）中相比 C/C++ 编译器具备天然安全优势
5. **社区对接**：可以通过贡献 RuSTy 项目（特别是 AUDESYS HAL 绑定生成器方向）来影响 IEC 61131-3 开源编译器生态的发展方向
6. **阶段适配**：从 Level 0（独立使用）到 Level 2（嵌入为库），AUDESYS 可以根据自身发展阶段选择不同深度的集成

---

> **文档版本**: v1.0
> **编写日期**: 2026-07-13
> **来源**: GitHub PLC-lang/rusty 项目（github.com/PLC-lang/rusty）、RuSTy 用户文档（plc-lang.github.io/rusty）、GitHub Discussions #1556/#1406/#1688、PLC-lang 社区贡献者讨论
> **状态**: 技术信息基于公开的 GitHub 仓库和文档交叉验证。标注"待确认"的信息需进一步核实。项目统计数据为截至 2026 年 7 月的近似值。

### 7.9 IEC 61131-3 编译器认证与 RuSTy 的挑战

将 ST 编译器用于安全关键系统（SIL2/SIL3）时，编译器本身需要通过认证。以下是 RuSTy 与认证相关的分析：

| 认证维度 | 传统闭源编译器 (CODESYS/Siemens) | RuSTy 的挑战与机遇 |
|---------|--------------------------------|-------------------|
| **编译器验证** | 厂商内部分析 + TUV 认证（成本数万欧元） | 开源 → 社区审计 + 独立验证可能性 |
| **TCB（可信计算基）** | 闭源二进制不可审计 | 源码可见，但 LLVM 本身量大 |
| **形式化验证** | 极少（成本极高） | 理论上 Rust 的形式化验证工具链更成熟（如 Kani, Creusot） |
| **多样化编译** | 通常使用单一编译器 | 可与 MatIEC 搭配形成双编译器验证 |
| **运行时确定性** | 专有 Runtime 保证调度确定性 | 无 Runtime → 确定性由集成者（如 AUDESYS）保证 |
| **测试覆盖** | 内部测试套件，覆盖度不公开 | 开源测试套件可见（lit tests + unit tests），社区可贡献 |

**对 AUDESYS 的影响**：
- **非安全应用**：RuSTy 直接使用，无认证负担
- **安全应用 (SIL2)**：RuSTy + AUDESYS RT 线程调度保证 + 独立二进制验证
- **安全应用 (SIL3)**：建议 RuSTy + MatIEC 双编译 + 运行时输出比对

### 7.10 从 RuSTy 学到的编译器工程经验

对于 AUDESYS 团队，RuSTy 的开发过程提供了几个关键的工程启示：

1. **"让系统先编译通过"哲学**：RuSTy 维护者强调不要从一开始就过度设计（如 MIR）。这与 AUDESYS 的 Phase 1-2-3-4 渐进式策略高度一致——先跑通最关键路径（Phase 1 InProc 单机），再逐层优化

2. **C ABI 作为通用接口**：RuSTy 通过 C ABI 绑定硬件，而非定制 FFI。C ABI 是跨越 Rust/C++/ST 的"通用语言"——AUDESYS 也可以将 C ABI 作为 HAL API 的可选接口（除了 amw 原生 API 之外）

3. **DWARF 调试符号的价值**：RuSTy 通过 DWARF 暴露 ST 变量符号供 Modbus 等外部协议访问。AUDESYS 的 HalDiscovery 可以利用 DWARF 自动发现 .so 文件中暴露的 IEC 61131-3 变量

4. **社区贡献的切入点**：RuSTy 维护者明确指出"文档"是最需要社区贡献的领域（特别是硬件绑定文档）。AUDESYS 可以通过贡献 HAL 绑定文档来回馈开源社区

5. **IEC 61131-3:2025 的先行者优势**：RuSTy 的 2025 Edition Property 语法迁移（#1688）展示了如何在保持向后兼容的同时推进标准适配——内部保留 PropertyBlock 聚合是一个务实的过渡方案

6. **LGPL 许可的商业友好性**：RuSTy 的 LGPL 许可允许 AUDESYS 在商业产品中动态链接使用——这比 GPL 更灵活，比 MIT/Apache 更有"贡献回馈"的社区粘性

### 7.11 附录：RuSTy 相关资源索引

| 资源 | URL | 说明 |
|------|-----|------|
| **GitHub 主仓库** | https://github.com/PLC-lang/rusty | 源代码、Issues、PR、Discussions |
| **用户文档** | https://plc-lang.github.io/rusty/ | 构建安装、编译使用、外部函数、库支持 |
| **API 文档 (rustdoc)** | https://plc-lang.github.io/rusty/api/rusty/ | Rust crate 的自动生成 API 文档 |
| **LLVM Package** | https://github.com/PLC-lang/llvm-package-windows/releases/ | Windows 平台的预编译 LLVM |
| **Discussions #1556** | https://github.com/PLC-lang/rusty/discussions/1556 | AST→LLVM vs MIR 架构讨论 |
| **Discussions #1406** | https://github.com/PLC-lang/rusty/discussions/1406 | 硬件支持和实际 PLC 部署讨论 |
| **PR #1688** | https://github.com/PLC-lang/rusty/pull/1688 | IEC 61131-3:2025 Property 语法迁移 |
| **学术论文** | https://repositorio-aberto.up.pt/bitstream/10216/132765/2/411556.pdf | LLVM-based IEC 61131-3 Compiler 论文 |


### 7.12 与 AUDESYS 其他参考文档中编译器相关的交叉引用

| 本文档 (RuSTy) | 其他参考文档 | 交叉参考点 |
|----------------|------------|-----------|
| RuSTy 编译器架构 (AST→LLVM) | codesys.md (CODESYS Compiler Stack) | CODESYS 使用 C 实现的原生代码生成器 vs RuSTy 的 Rust+LLVM 后端对比 |
| RuSTy IEC 61131-3 ST 语言支持 | codesys.md (IEC 61131-3 五语言) | RuSTy 仅支持 ST 而 CODESYS 支持全部 5+1 种语言 |
| C 互操作 + 无运行时 | openplc.md (MatIEC + OpenPLC Runtime) | RuSTy 无运行时 → 用户编调度循环 vs OpenPLC 有完整 Runtime |
| WASM 目标 | linuxcnc.md (HAL 组件 C 编译) | RuSTy 的 WASM → 浏览器仿真 vs LinuxCNC 的 C → 原生内核模块 |
| LGPL 许可 + 社区驱动 | beckhoff.md (TwinCAT 专有) | 开源 PLC 编译器 vs 闭源 TwinCAT 编译器 |
| Property 语法 (IEC 2025) | codesys.md (CODESYS V3.5) | 新版 IEC 属性语法的实现对比 |


### 7.13 结论

RuSTy 代表了 IEC 61131-3 编译器技术的一次代际升级——从 1990 年代的 C/C++ 闭源编译器栈跃迁到 2020 年代的 Rust+LLVM 开源架构。对 AUDESYS 而言，RuSTy 提供了一个"够用且现代"的 ST 编译后端，其 LGPL 许可和活跃社区使得集成风险可控。

AUDESYS 的集成策略应当遵循"渐进式采纳"：
- Phase 1-2：Level 0/1 集成（独立编译 + HAL 清单生成）
- Phase 3-4：Level 2 集成（嵌入式编译 + IDE 深度集成）

这种渐进式策略既能在早期快速验证 ST 控制逻辑在 AUDESYS Runtime 上的可行性，又能在后期提供完整的 IDE 编程体验。
