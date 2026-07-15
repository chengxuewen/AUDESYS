# Beremiz

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: Beremiz（Beremiz Automation Platform）
- **开发商/组织**: 由 **Luc Bourn** 于 2005 年创立，后发展为开源社区项目，现由 Beremiz 社区维护（https://beremiz.org）
- **首次发布年份**: 2005 年（基于 IEC 61131-3 标准开发）
- **当前版本**:
  - Beremiz Editor: v2.0.2（2023 年），持续社区维护
  - MatIEC 编译器: v1.7（2023 年），核心编译器引擎
  - Beremiz Runtime: 与 MatIEC 紧密集成，多平台支持
- **仓库地址**:
  - 主仓库: https://github.com/beremiz/Beremiz
  - MatIEC 编译器: https://github.com/thiagoralves/MatIEC
  - 文档: https://beremiz.org/docs/

### 1.2 产品定位与核心价值主张

Beremiz 定位为 **完整的开源 IEC 61131-3 可编程逻辑控制器开发平台**，涵盖从编辑器到运行时的全栈工具链。其核心价值主张是：

1. **完整的 IEC 61131-3 支持** — 实现全部 5 种编程语言（LD、ST、FBD、IL、SFC），包括顺序功能图和函数块的完整语义
2. **开源透明的全栈工具链** — 编辑器、编译器、运行时全部开源，无黑箱组件
3. **多硬件目标支持** — 同一工程可在多种目标平台编译部署，包括 x86 Linux、Raspberry Pi、Arduino、STM32、BeagleBone、RISC-V 等
4. **PLCopen XML 标准交换格式** — 使用 IEC 61131-3 标准 XML 格式作为工程交换格式，与其他 PLCopen 兼容编辑器互操作
5. **MatIEC 编译器** — 成熟的 IEC 61131-3 编译器引擎，生成 ANSI C 代码，支持多种目标架构

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| 工业自动化工程师 | 工厂 PLC 开发、机器控制、运动控制 | 完整 IEC 61131-3、跨平台部署、无许可费用 |
| 学术研究机构 | 自动化课程、IEC 61131-3 标准教学 | 开源透明、可教学、标准兼容 |
| 系统集成商 | 小型 PLC 项目、原型验证 | 快速开发、低成本、多硬件目标 |
| 创客/爱好者 | 家庭自动化、实验室项目、教学实验 | 易用编辑器、Arduino/Raspberry Pi 支持 |
| 嵌入式开发者 | STM32/ARM 软 PLC 开发 | C 代码生成、资源可控 |

### 1.4 许可证模型

- **许可证**: Mozilla Public License v2.0（MPL-2.0）
- **商业模型**: 开源免费，社区驱动，无商业公司主导
- **封闭组件**: 无 — 完全开源
- **OEM 考虑**: MPL-2.0 对衍生作品要求较宽松，适合嵌入式集成

---

## 2. 技术特性

### 2.1 核心架构

Beremiz 采用 **编辑器 + 编译器 + 运行时** 的三层分离架构：

```
+--------------------------------------------------------------+
|                   Beremiz Platform                            |
+--------------------------------------------------------------+
|   Editor (Python 3 + wxWidgets)                              |
|   +------------------------------------------------------+   |
|   | - IEC 61131-3 编程语言编辑器（LD/ST/FBD/IL/SFC）      |   |
|   | - 项目管理和配置                                       |   |
|   | - 硬件目标选择                                         |   |
|   | - 编译触发                                             |   |
|   +------------------------------------------------------+   |
+--------------------------------------------------------------+
|   MatIEC Compiler (C)                                         |
|   +------------------------------------------------------+   |
|   | - 词法分析（Lexer）                                     |   |
|   | - 语法分析（Parser，flex/bison）                        |   |
|   | - 语义分析（类型检查、作用域解析）                        |   |
|   | - 中间代码生成（ANSI C）                                 |   |
|   | - 标准库实现（STRING、TIME、DATE 等）                   |   |
|   +------------------------------------------------------+   |
+--------------------------------------------------------------+
|   Beremiz Runtime (Target-Specific C)                          |
|   +------------------------------------------------------+   |
|   | - PLC 状态机（INIT/STOPPED/RUNNING/ERROR）             |   |
|   | - 扫描周期管理（Task Execution）                        |   |
|   | - I/O 映像表（Image Tables）                            |   |
|   | - 硬件抽象层（驱动接口）                                 |   |
|   | - 多任务调度                                             |   |
|   +------------------------------------------------------+   |
+--------------------------------------------------------------+
```

#### 编辑器架构（Beremiz Editor）

- **路径**: `beremiz/` 主目录
- **语言**: Python 3（编辑器本身），部分图形组件
- **GUI 框架**: wxWidgets（跨平台）
- **功能模块**:
  - `IEC61131/` — IEC 61131-3 语言实现
  - `IDE/` — IDE 框架和项目管理
  - `BeremizProject/` — 项目管理和硬件配置
  - `Targets/` — 硬件目标定义

#### MatIEC 编译器架构

MatIEC 是 Beremiz 的核心编译器引擎，由 Thiago Alves 在博士研究期间开发，专门针对 IEC 61131-3 标准优化：

- **词法分析**: 使用 flex 生成，支持所有 IEC 61131-3 语言的词法单元
- **语法分析**: 使用 bison 生成，递归下降解析器，完整的 IEC 61131-3 语法覆盖
- **中间表示**: 将每种语言统一转换为内部 AST，再翻译为 ANSI C
- **标准库实现**: 完整的 IEC 61131-3 标准类型和函数（STRING、BYTE、INT、DINT、REAL、TIME、DATE 等）
- **输出格式**: 生成人类可读的 ANSI C 源代码，可被标准编译器（GCC、Clang）编译

#### Runtime 架构

Beremiz 运行时基于 C 代码生成，包含：

```
+----------------------------------+
|        Beremiz Runtime           |
+----------------------------------+
|  +-----------------------------+ |
|  |  PLC State Machine           | |
|  |  INIT -> STOPPED -> RUNNING | |
|  |  -> ERROR -> STOPPED        | |
|  +-----------------------------+ |
|                                   |
|  +-----------------------------+ |
|  |  Task Scheduler              | |
|  |  - Cyclic Tasks             | |
|  |  - Event Tasks              | |
|  |  - ISO Tasks                | |
|  +-----------------------------+ |
|                                   |
|  +-----------------------------+ |
|  |  I/O Image Tables           | |
|  |  - %IX (Digital Input)      | |
|  |  - %QX (Digital Output)     | |
|  |  - %IW (Analog Input)       | |
|  |  - %QW (Analog Output)      | |
|  +-----------------------------+ |
|                                   |
|  +-----------------------------+ |
|  |  Hardware Driver Layer       | |
|  |  - GPIO / Serial / Modbus   | |
|  |  - Ethernet / OPC UA        | |
|  +-----------------------------+ |
+----------------------------------+
```

### 2.2 关键技术能力

#### MatIEC 编译器管线（Compiler Pipeline）

Beremiz 的编译流程是其最核心的技术能力：

```
IEC 61131-3 源文件 (.st)
  |
  | [MatIEC Lexer]
  |
  +-> Token Stream
       |
       | [MatIEC Parser (bison)]
       |
       +-> AST (Abstract Syntax Tree)
            |
            | [Semantic Analysis]
            |   - Type Checking
            |   - Scope Resolution
            |   - Symbol Table
            |
            +-> Typed AST
                 |
                 | [C Code Generation]
                 |
                 +-> ANSI C Source Code (.c files)
                      |
                      | [GCC/Clang Compilation]
                      |
                      +-> Target Binary (.bin / .elf / .hex)
```

**编译器关键特性**:
- **多语言统一**: LD、ST、FBD、IL、SFC 统一为内部 AST，消除了语言间的语义差异
- **标准兼容**: 严格遵循 IEC 61131-3 标准，支持 Function Block、Program、Action 等所有语言构造
- **资源可控**: 生成的 C 代码在内存占用和执行效率上可预测，适合资源受限 MCU
- **多目标支持**: 同一工程可针对不同目标（x86、ARM、RISC-V）重新编译

#### 类型系统

Beremiz/MatIEC 支持的 IEC 61131-3 类型系统：

| 类型类别 | 具体类型 | 描述 |
|---------|---------|------|
| 整型 | INT, DINT, LINT, UINT, UDINT, ULINT | 16/32/64 位整型 |
| 浮点 | REAL, LREAL | IEEE 754 浮点 |
| 布尔 | BOOL | 真/假 |
| 字符 | CHAR, STRING, WSTRING | ASCII/Unicode 字符串 |
| 时间 | TIME, TOD, DATE, DT | 时间相关类型 |
| 数组 | ARRAY [...] OF ... | 多维数组 |
| 结构 | STRUCT ... END_STRUCT | 用户定义结构 |
| 枚举 | ENUM (x := y) END_ENUM | 枚举类型 |
| 指针 | REF_TO, POINTER TO | 指针和引用 |
| 位于变量 | AT, AT % | 地址映射变量 |

#### 编程语言支持

| 语言 | 缩写 | 类型 | 支持状态 | 特征 |
|------|------|------|---------|------|
| Structured Text | ST | 文本化 | 完全支持 | 类似 Pascal 的高级语言 |
| Ladder Diagram | LD | 图形化 | 完全支持 | 继电器逻辑图 |
| Function Block Diagram | FBD | 图形化 | 完全支持 | 信号流图 |
| Instruction List | IL | 文本化 | 完全支持 | 类似汇编的低级语言 |
| Sequential Function Chart | SFC | 图形化 | 完全支持 | 顺序控制图 |

**ST 语言示例**:
```pascal
PROGRAM Example
VAR
    counter : INT := 0;
    start_flag : BOOL := FALSE;
    total : REAL;
END_VAR

IF start_flag THEN
    counter := counter + 1;
    IF counter > 10 THEN
        total := REAL(counter) * 1.5;
    END_IF;
END_IF;
END_PROGRAM
```

#### 扫描周期与任务调度

Beremiz 运行时支持三种任务类型：

| 任务类型 | 描述 | 典型周期 |
|---------|------|---------|
| Cyclic Task | 周期性执行，固定周期 | 10ms-100ms |
| Event Task | 事件触发执行 | 事件驱动 |
| ISO Task | ISO 任务（IEC 61131-3 标准） | 按配置 |

扫描周期模型：
```
1. Read Inputs:    从 I/O 映像表读取硬件输入
2. Execute Tasks:  按优先级和执行顺序执行各任务
3. Write Outputs:  将结果写入 I/O 映像表输出
4. Sleep:          休眠至下一周期
```

#### PLC 状态机

```
INIT -> STOPPED -> RUNNING（正常循环）
              -> ERROR（异常）
              -> STOPPED（手动停止）
```

### 2.3 支持的硬件/平台

Beremiz 支持广泛的硬件目标，覆盖从 8 位 MCU 到 x86 工业 PC：

| 平台类型 | 具体硬件 | 目标架构 | 典型周期 |
|---------|---------|---------|---------|
| 工业 PC | x86 Linux PC | x86_64 | 1-10ms |
| 单板计算机 | Raspberry Pi 3/4/5 | ARM | 10-50ms |
| 单板计算机 | BeagleBone Black | ARM Cortex-A8 | 10-50ms |
| 微控制器 | STM32F4/F7/H7 系列 | ARM Cortex-M4/M7 | 1-10ms |
| 微控制器 | STM32L4 系列 | ARM Cortex-M4 | 1-10ms |
| 微控制器 | ESP32 | Xtensa LX6 / RISC-V | 1-5ms |
| 微控制器 | Arduino Uno/Mega | AVR | 10-20ms |
| 微控制器 | RISC-V 开发板 | RISC-V | 待确认 |
| 仿真 | QEMU 仿真器 | 多架构 | 取决于宿主 |

### 2.4 开发工具链流程

```
Beremiz Editor (Python 3 / wxWidgets)
  |
  | 1. 使用 IEC 61131-3 语言设计 PLC 程序
  | 2. 配置硬件目标（CPU、I/O、通信）
  | 3. 触发编译
  |
  +-> MatIEC Compiler (C)
        |
        | 4. 编译为 ANSI C 源代码
        | 5. 调用目标工具链编译
        |
        +-> Target Binary
              |
              | 6. 下载到目标硬件
              |
              v
         PLC Runtime Execution
```

### 2.5 PLCopen XML 标准格式

Beremiz 使用 **PLCopen XML**（IEC 61131-3 标准交换格式）作为工程文件的主格式。PLCopen XML 的优势：
- **标准兼容**: IEC 61131-3 定义的官方交换格式
- **跨编辑器互操作**: 可与 Codesys、TwinCAT、Codesys Export Wizard 等交换
- **版本控制友好**: 文本格式，Git 可 diff
- **语义保留**: 图形化语言的语义完整保留在 XML 中

### 2.6 硬件抽象层设计

Beremiz 的 HAL（Hardware Abstraction Layer）通过目标特定的驱动接口实现：

| 组件 | 路径 | 职责 |
|------|------|------|
| Target Manager | beremiz/BeremizProject/Targets/ | 目标硬件管理和配置 |
| I/O Driver Framework | 各目标驱动目录 | 硬件 I/O 抽象 |
| Driver Templates | beremiz/drivers/ | 通用驱动模板 |

**HAL 数据缓冲**:
- %IX / %QX — 数字输入/输出映像表
- %IW / %QW — 模拟输入/输出映像表
- 地址映射通过 AT 语法在源程序中声明

---

## 3. 功能概览

### 3.1 主要功能模块

#### Editor 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| IEC61131 语言引擎 | beremiz/IEC61131/ | 五种语言的核心实现 |
| 项目管理器 | beremiz/BeremizProject/ | 工程创建、配置、管理 |
| 图形编辑器 | beremiz/IDE/ | LD/FBD/SFC 图形化编辑 |
| 代码编辑器 | beremiz/IDE/ | ST/IL 文本编辑（带语法高亮） |
| 类型系统 | beremiz/IEC61131/ | 类型定义、继承、约束 |
| 编译器接口 | beremiz/ | 与 MatIEC 编译器的桥接 |

#### MatIEC 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| Lexer (flex) | matiec/ | 词法分析 |
| Parser (bison) | matiec/ | 语法分析 |
| Semantic Analyzer | matiec/ | 语义分析、类型检查 |
| C Code Generator | matiec/ | ANSI C 代码生成 |
| Standard Library | matiec/ | IEC 标准类型和函数实现 |

#### Runtime 核心模块

| 模块 | 职责 |
|------|------|
| PLC State Machine | 状态机管理（INIT/STOPPED/RUNNING/ERROR） |
| Task Scheduler | 多任务调度（Cyclic/Event/ISO） |
| I/O Image Tables | I/O 映像表管理 |
| Hardware Driver | 硬件抽象驱动层 |
| Communication Stack | Modbus/Ethernet 通信协议栈 |

### 3.2 关键工作流

#### 工作流：PLC 程序开发与部署

1. **设计** — 在 Beremiz Editor 中使用 LD/ST/FBD/IL/SFC 设计 PLC 程序
2. **配置** — 选择硬件目标，配置 I/O 映射和通信协议
3. **编译** — MatIEC 编译器将 IEC 61131-3 程序编译为 ANSI C 源代码
4. **编译目标** — 调用目标平台工具链（GCC/Clang/AVR-GCC）编译为二进制
5. **部署** — 下载到目标硬件（通过串口、以太网或 SD 卡）
6. **运行** — 目标硬件启动 PLC Runtime，执行扫描周期

#### 工作流：硬件目标扩展

1. 在 Targets/ 目录中创建新目标定义
2. 实现硬件抽象层驱动（GPIO、ADC、PWM 等）
3. 配置 I/O 映像表地址映射
4. 创建目标工具链配置（编译器路径、链接器脚本）
5. 在 Editor 中注册新目标

### 3.3 通信协议支持

Beremiz 通过目标特定实现和插件方式支持多种通信协议：

| 协议 | 类型 | 实现方式 |
|------|------|---------|
| Modbus TCP | Master/Slave | 目标驱动层实现 |
| Modbus RTU | Master/Slave | 串口驱动实现 |
| CANopen | 待确认 | 通过外部 CAN 库 |
| OPC UA | 待确认 | 通过外部 OPC UA 栈 |
| EtherNet/IP | 待确认 | 目标特定实现 |

### 3.4 扩展机制

Beremiz 的扩展主要通过以下机制实现：

1. **自定义硬件目标**: 通过创建新目标定义，支持新的硬件平台
2. **自定义驱动**: 通过实现标准驱动接口，支持新的 I/O 设备
3. **库文件**: 支持用户定义的功能块库（Function Block Library）
4. **PLCopen XML**: 支持导入/导出 PLCopen 标准格式的工程文件

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| GitHub Stars | ~390（主仓库） |
| MatIEC GitHub Stars | ~90 |
| GitHub Forks | ~150（主仓库） |
| 主要开发语言 | Python 3（编辑器）、C（编译器/Runtime） |
| 许可证 | MPL-2.0 |
| 最新版本 | v2.0.2（2023 年） |
| 维护状态 | 社区维护，更新频率较低 |

### 4.2 社区规模/用户基数

- **学术应用**: Beremiz 在多个欧洲大学自动化课程中使用
- **工业应用**: 主要面向小型 PLC 项目和嵌入式控制场景
- **俄罗斯社区**: 有独立的俄罗斯社区分支（Beremiz-RU）
- **研究应用**: 被用于 IEC 61131-3 编译器研究和自动化教学

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **Beremiz Editor** | 跨平台桌面 IDE（Windows/Linux/macOS），Python 3 + wxWidgets |
| **MatIEC Compiler** | 独立的 IEC 61131-3 编译器，可被 OpenPLC 等其他项目复用 |
| **Beremiz Runtime** | 目标特定的 C 运行时，支持多硬件平台 |
| **PLCopen XML** | 标准 IEC 61131-3 交换格式，跨编辑器互操作 |
| **第三方目标分支** | 社区贡献的多个硬件目标支持（STM32、ESP32、RISC-V） |

### 4.4 MatIEC 的复用情况

MatIEC 作为独立的 IEC 61131-3 编译器引擎，被多个其他项目复用：
- **OpenPLC v3**: 使用 MatIEC 作为编译器（后被 STruC++ 替代）
- **Arduino PLC IDE**: 基于 Modbus 的 Arduino PLC 方案中使用
- **Beremiz-RU**: 俄罗斯社区的 Beremiz 分支
- **多个学术项目**: 被用于 IEC 61131-3 相关的研究和教学

### 4.5 局限性分析

1. **编辑器老化**: Python 2/3 过渡期留下的 wxWidgets 界面与现代 IDE 相比差异明显
2. **MatIEC 标准兼容性**: 对 IEC 61131-3 Edition 3 的支持有限，主要集中在 Edition 2
3. **社区活跃度下降**: 更新频率较低，新特性开发缓慢
4. **实时性**: 运行时缺乏 SCHED_FIFO 等实时调度支持（依赖目标平台）
5. **调试能力**: 调试功能有限，缺乏运行中变量监视和强制
6. **文档**: 项目文档相对欠缺，主要依赖源码注释
7. **安全性**: 无内置安全机制（TLS、认证等）

---

## 5. 市场定位

### 5.1 主要应用行业与场景

| 行业 | 典型应用 | 部署级别 |
|------|---------|---------|
| 教育/学术 | IEC 61131-3 编程教学、编译器研究 | 桌面 PC |
| 嵌入式开发 | STM32/ARM 软 PLC 开发 | MCU 级别 |
| 小型制造 | 简单生产线控制 | 嵌入式 |
| 系统集成 | 原型验证、PoC | 多种平台 |
| 开源社区 | IoT 项目、实验室自动化 | Raspberry Pi |

### 5.2 竞争对手对比

| 维度 | Beremiz | OpenPLC | CODESYS |
|------|---------|---------|---------|
| 开源 | 完全开源（MPL-2.0） | 完全开源（GPL-3.0） | 商业（免费版有限制） |
| 许可证 | MPL-2.0（宽松） | GPL-3.0（严格） | 商业 |
| 编辑器 GUI | Python/wxWidgets | TypeScript/Electron（v4） | 成熟专业 IDE |
| 编译器 | MatIEC（ANSI C） | STruC++（C++17，v4） | 专有编译器 |
| IEC 61131-3 | 5 种语言（Ed 2） | 5 种语言（Ed 3，v4） | 完全支持 |
| Ed 3 支持 | 有限 | 完全支持（v4） | 完全支持 |
| 硬件支持 | 广泛（多目标） | 极广（Arduino 到 PC） | Windows + 特定硬件 |
| 实时性 | 依赖目标平台 | SCHED_FIFO（Linux） | 硬实时 |
| 活跃度 | 低 | 高 | 极高 |

### 5.3 历史贡献

Beremiz 在开源 IEC 61131-3 生态系统中的历史贡献：
1. **首个完整的开源 IEC 61131-3 IDE**: 为后续项目如 OpenPLC 提供了参考实现
2. **MatIEC 编译器**: 成为 IEC 61131-3 开源编译器的标准实现，被 OpenPLC v3 和多个学术项目复用
3. **PLCopen XML 验证**: 验证了 PLCopen XML 作为标准交换格式的可行性
4. **多目标示范**: 展示了一个 IEC 61131-3 平台支持多种硬件目标的可行性

---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **完整的全栈开源**：
   - 编辑器、编译器、运行时全部开源
   - MPL-2.0 许可证对商业集成更友好（相比 GPL-3.0）
   - 无黑箱组件，完全透明

2. **MatIEC 编译器**：
   - 成熟的 IEC 61131-3 编译器，10 年+持续开发
   - 生成 ANSI C，跨平台兼容性极强
   - 可被独立于编辑器使用，支持 CLI 编译
   - 使用标准 flex/bison 工具链，易于维护和扩展

3. **灵活的硬件目标系统**：
   - 目标定义机制清晰：Toolchain + Hardware + Driver
   - 支持从 8 位 AVR 到 64 位 ARM/x86 的全范围目标
   - 社区贡献了多个非官方目标（STM32、ESP32、RISC-V）

4. **PLCopen XML 标准交换**：
   - 与其他 PLCopen 兼容编辑器双向交互
   - 工程文件是标准 XML，版本控制友好
   - 利于团队协作和工程复用

5. **教育价值**：
   - 完整的 IEC 61131-3 实现，适合自动化教学
   - 编译器开源，适合编译器设计课程
   - 运行时 C 代码生成，适合嵌入式系统教学

### 6.2 标志性功能或设计理念

- **"编译器为中心"的架构** — MatIEC 是平台的核心理念，与 Beremiz Editor 可独立使用
- **"多目标一次开发"** — 通过硬件目标抽象，同一工程可部署到不同硬件
- **"标准交换"** — PLCopen XML 作为工程交换格式，体现对 IEC 标准的严格遵循
- **"教学即用"** — 从设计之初就考虑了教学场景，代码清晰注释完整

### 6.3 历史教训

Beremiz 的发展历史为开源工业自动化项目提供了几个重要教训：

1. **维护可持续性**: Beremiz 在核心开发者 Luc Bourn 退出后活跃度显著下降，缺乏商业支持的开源工控项目面临长期维护挑战
2. **技术栈老化**: Python 2 到 Python 3 的迁移痛点，wxWidgets 工具链的维护成本递增
3. **标准演进滞后**: 对 IEC 61131-3 Edition 3 的支持滞后，导致被 OpenPLC STruC++ 超越
4. **社区分流**: 多个分支（Beremiz-RU、MatIEC 独立使用）导致社区力量分散

---

## 7. 对 AUDESYS 的参考价值

### 7.1 可借鉴的架构设计/理念

#### 1. 完整的 IDE + Runtime 架构

Beremiz 是少有的提供完整开源 PLC IDE 和 Runtime 的项目。其架构为 AUDESYS Studio IDE 提供了直接参考：

```
Beremiz Architecture:
  Editor (IDE) <-> Compiler (MatIEC) <-> Runtime (Target C)

AUDESYS Reference:
  Studio IDE <-> Compiler (RuSTy/HAL IR) <-> Runtime (HAL)
```

**AUDESYS 参考**: Studio IDE 的设计可参考 Beremiz 的编辑器 + 编译器 + Runtime 三层分离模式，避免功能耦合。

#### 2. MatIEC 编译器管线

MatIEC 的编译器管线是 IEC 61131-3 编译器实现的参考实现：

| 阶段 | MatIEC | AUDESYS 参考 (D22) |
|------|--------|-------------------|
| 词法分析 | flex | RuSTy 或自研 |
| 语法分析 | bison | RuSTy 或自研 |
| 语义分析 | 手写 | RuSTy 或自研 |
| 中间代码 | AST | HAL IR（Phase 2） |
| 代码生成 | ANSI C | LLVM/目标代码 |
| 标准库 | IEC 61131-3 原生 | IEC 61131-3 兼容层 |

**AUDESYS 参考**: MatIEC 验证了 IEC 61131-3 编译器的可行性。AUDESYS D22 的 RuSTy -> HAL IR -> 自研分阶段策略，其 HAL IR 阶段可参考 MatIEC 作为编译管线稳定的中间接口层。

#### 3. 硬件目标抽象系统

Beremiz 的硬件目标系统将编译目标抽象为清晰的配置层：

```
Target Definition:
  - Toolchain: 编译器路径和选项
  - Hardware: 处理器架构、内存布局
  - Driver: I/O 驱动接口实现
  - Communication: 协议栈配置
```

**AUDESYS 参考**: AUDESYS 的 HAL 设计（HalTransport 等 trait）在概念层次上比 Beremiz 的硬件目标抽象更丰富，但 Beremiz 的"目标 = 工具链 + 硬件 + 驱动 + 通信"分解方式可指导 AUDESYS 多目标设计。

#### 4. PLCopen XML 标准交换

Beremiz 采用 PLCopen XML 作为工程交换格式，验证了标准交换格式的长期价值。

**AUDESYS 参考**: AUDESYS D24 定义使用 YAML 作为开发配置、FlatBuffers 作为运行时格式。这种"人类可读 + 机器高效"的双格式策略，与 Beremiz 的"PLCopen XML 编辑器使用 + C 运行时执行"的思路一致。

#### 5. 开源社区演进路径

Beremiz 展示了开源 IEC 61131-3 平台的完整生命周期：

```
个人项目 -> 社区项目 -> 分支分化 -> 活跃度下降
```

**AUDESYS 参考**: AUDESYS 应从 Beremiz 的教训中规划商业支撑策略（D40 Phase 2 v0.1.0 发布策略），避免成为缺乏维护动力的开源项目。

### 7.2 可移植/适配的技术模块

| 技术模块 | 描述 | 移植价值 |
|---------|------|---------|
| **MatIEC 词法/语法分析器** | 成熟的 IEC 61131-3 flex/bison 实现 | 中，可作为 ST 解析的参考实现 |
| **MatIEC 标准库** | IEC 61131-3 标准类型和函数实现 | 高，IEC 标准类型定义可参考 |
| **PLCopen XML Schema** | IEC 61131-3 标准交换格式定义 | 高，如 AUDESYS 需要支持 PLCopen |
| **目标定义机制** | Toolchain + Hardware + Driver 三层 | 中，概念层次可参考 |
| **I/O 映像表** | 标准 %IX/%QX/%IW/%QW 地址模型 | 高，PLC I/O 标准映射方式 |

### 7.3 与 AUDESYS 定位的差异与互补

| 维度 | Beremiz | AUDESYS |
|------|---------|---------|
| 核心定位 | IEC 61131-3 PLC 开发平台 | 工业控制系统模拟平台 |
| 目标用户 | PLC 程序员、自动化教学 | 控制工程师、系统集成商、开发者 |
| 编译器 | MatIEC（IEC 61131-3 -> C） | RuSTy/HAL IR（分阶段，D22） |
| 运行时 | 目标特定 C 运行时 | Rust 运行时（HAL 中间件架构） |
| IDE | Python/wxWidgets | Tauri/React/TypeScript（D21） |
| 通信 | Modbus/目标特定 | JSON-RPC/REST + HAL（规划中） |
| HAL | 目标驱动抽象 | 完整通信原语（Signal/StreamChannel/RPC） |
| 实时性 | 依赖目标平台 | 分层延迟（<1us/~10us/~100us） |
| 安全性 | 无内置安全 | 规划中（TLS/JWT） |

**互补关系**:
- Beremiz 的 **MatIEC 编译器** 可作为 AUDESYS Phase 1/RuSTy 阶段的参考实现
- Beremiz 的 **PLCopen XML 支持** 为 AUDESYS Studio IDE 的 IEC 61131-3 兼容性提供了标准路径
- AUDESYS 的 **HAL 设计**（3 信号原语 + amw 抽象）在通信抽象层远超 Beremiz 的简单驱动接口
- Beremiz 的 **硬件目标抽象** 为 AUDESYS Runtime 的多平台支持提供了参考层次划分
- AUDESYS 可提供 Beremiz 所缺少的现代化 IDE（Tauri/React）、调试能力和安全特性

### 7.4 MatIEC vs AUDESYS 编译器策略 (D22) 对比

| 维度 | MatIEC | AUDESYS Phase 1 (RuSTy) | AUDESYS Phase 2-3 (HAL IR/自研) |
|------|--------|------------------------|-------------------------------|
| 源语言 | IEC 61131-3 Ed 2 | IEC 61131-3 ST | IEC 61131-3 全部语言 |
| 输入格式 | .st 文件 | ST 源码 | ST 源码 / PLCopen XML |
| 输出格式 | ANSI C | C/Rust（通过 RuSTy LLVM） | HAL IR -> LLVM/WASM |
| 编译器工具链 | flex/bison | RuSTy（Rust 框架） | 自研前端 + HAL IR |
| 中间表示 | AST（内部） | RuSTy IR | HAL IR（稳定接口） |
| 标准兼容 | IEC 61131-3 Ed 2 | IEC 61131-3 Ed 3 | IEC 61131-3 Ed 3+ |
| 多语言支持 | 5 种全部 | ST Only | 5 种全部（Phase 3） |

**关键启示**:
- MatIEC 证明了 IEC 61131-3 -> C 代码生成是一条经过验证的编译器路径
- Beremiz 的 Ed 2 限制提醒 AUDESYS 应从 Ed 3 起步（D22 已考虑这一点）
- MatIEC 的单一 ANSI C 输出格式限制了多目标优化空间，HAL IR 方案更灵活
- 编译器是长期投入，AUDESYS 的分阶段策略（RuSTy -> HAL IR -> 自研）避免了 MatIEC "一人编译器"的风险

### 7.5 历史教训与 AUDESYS 项目策略

| Beremiz 教训 | AUDESYS 对应策略 |
|-------------|-----------------|
| 缺乏商业支撑导致活跃度下降 | D40: Phase 2 发布 v0.1.0，规划商业化路径 |
| 编辑器技术栈老化（Python 2/wxWidgets） | D21: Tauri + React，现代化技术栈 |
| 标准演进滞后（Ed 2 -> Ed 3 过渡慢） | D22: 从 Phase 1 开始就支持 Ed 3 |
| 编译器依赖单一个体维护 | D22 分阶段策略：RuSTy 社区 + HAL IR 稳定 + 团队自研 |
| 缺少调试和安全功能 | 从设计之初规划调试桥和安全架构 |
| 分支社区力量分散 | D35: 统一的 crate 组织结构，单仓库策略 |

---

> **本文档基于 2026 年 7 月的公开信息编写。部分数据（如特定版本的详细特性）可能随 Beremiz 版本迭代而变化。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从官方仓库验证。**


## 3. 功能概览（续）

### 3.5 工程管理功能

Beremiz 编辑器提供完整的工程管理能力：

- **工程创建**: 支持创建新工程，选择硬件目标、任务类型和 I/O 配置
- **库管理**: 管理用户定义的功能块库，支持导入/导出标准 PLCopen XML 格式
- **变量表**: 支持全局变量、局部变量、直接地址映射变量（AT 语法）的管理
- **资源视图**: 显示目标任务资源消耗，帮助优化扫描周期
- **配置管理**: 支持多配置管理，同一个工程可以管理多套硬件配置

### 3.6 代码生成与优化

MatIEC 的代码生成器具有以下优化特性：

1. **常量折叠**（Constant Folding）：编译时计算常量表达式，减少运行时开销
2. **死代码消除**（Dead Code Elimination）：移除不可达代码路径
3. **变量寻址优化**: 将 IEC 变量地址映射为优化的 C 内存访问
4. **内联展开**: 对小型 Function Block 进行内联展开以减少函数调用开销
5. **运行时库链接**: 仅链接实际使用的标准库函数，减少二进制体积

生成的 C 代码特点：
- 完全可读，保留原始 IEC 变量名作为 C 注释
- 无动态内存分配（适合 MCU 环境）
- 使用静态内存池，执行时间可预测
- 通过标准 C 编译器可交叉编译到多种目标架构

### 3.7 调试与诊断能力

Beremiz 的调试能力相对有限，包括：

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| 变量监视 | 查看运行时变量值 | Editor 轮询运行时 |
| 强制变量（Force） | 手动设置变量值 | 通过运行时接口 |
| 扫描周期统计 | 显示最小/最大/当前周期时间 | 运行时统计 |
| 状态指示 | 显示 PLC 状态机状态 | Editor 状态栏 |
| 错误日志 | 运行时错误信息显示 | 日志缓冲区 |

---

## 4. 现状与生态（续）

### 4.6 社区分支与衍生产品

Beremiz 产生了多个社区分支和衍生产品：

1. **Beremiz-RU**: 俄罗斯社区维护的分支，增加俄罗斯本土目标支持
2. **MatIEC 独立使用**: MatIEC 编译器被 OpenPLC v3 采用，成为开源 IEC 61131-3 事实标准的编译器引擎
3. **Arduino PLC IDE**: Arduino 官方 PLC IDE 的底层编译器参考 MatIEC 设计
4. **PyPLC**: 基于 Beremiz 核心的 Python PLC 运行时实现（学术项目）
5. **教育分支**: 多个大学维护的教育化 Beremiz 版本，简化界面用于教学

### 4.7 发展历程时间线

- **2005**: Luc Bourn 开始 Beremiz 项目，首个开源 IEC 61131-3 IDE
- **2007**: MatIEC 编译器初版完成，支持 ST 和 IL 语言
- **2009**: 图形化编辑器（LD/FBD/SFC）功能完成，成为最完整的开源 IEC 61131-3 IDE
- **2011**: PLCopen XML 导入/导出功能支持
- **2013**: 多硬件目标系统完善，支持 ARM/AVR/x86 目标
- **2014**: Thiago Alves 将 MatIEC 用于 OpenPLC 项目
- **2016**: Beremiz 社区活跃度开始下降，核心开发者参与减少
- **2018**: OpenPLC v3 以 Beremiz 为基础，成为更活跃的替代方案
- **2020**: Beremiz 转移到 GitHub，版本 v2.0 发布
- **2023**: v2.0.2 发布，维护模式，无重大新特性
- **2024-2026**: 社区维护，更新频率进一步降低

### 4.8 技术债务分析

Beremiz 在当前状态下的主要技术债务：

1. **Python 2/3 兼容性残留**: 代码库中仍有大量 Python 2 兼容性代码
2. **wxWidgets 版本依赖**: 对 wxPython 版本绑定严格，新平台支持困难
3. **MatIEC 架构限制**: 单阶段 C 代码生成无法支持 OOP 和 IEC 61131-3 Ed 3 新增特性
4. **测试覆盖不足**: 缺乏系统化的测试套件
5. **文档缺失**: API 文档和开发者指南不完整
6. **UI 现代化需求**: 与现代 IDE 相比 UI 交互差距明显

---

## 5. 市场定位（续）

### 5.4 典型用户画像

#### 学术用户（教学场景）
- **机构**: 大学自动化/计算机工程系
- **课程**: IEC 61131-3 编程、编译器设计、嵌入式系统
- **需求**: 开源可审计、完整 IEC 标准支持、教学文档
- **部署**: 教师工作站 + 学生实验台

#### 研究用户（编译器方向）
- **领域**: PLC 编译器优化、代码生成、标准演进
- **需求**: 完整的编译器管线可修改、多语言支持
- **工具链**: MatIEC 源码 + 自定义后端

#### 工业用户（嵌入式场景）
- **行业**: 小型设备制造、嵌入式控制
- **硬件**: STM32、ARM Cortex-M 系列 MCU
- **需求**: 资源受限平台、C 代码输出、确定性执行

### 5.5 竞争优势分析

**优势**:
1. 唯一完整的开源 IEC 61131-3 全栈工具链
2. MPL-2.0 许可（比 GPL 更商业友好）
3. 编译器可独立使用（MatIEC）
4. 成熟的 PLCopen XML 支持

**劣势**:
1. 编辑器技术和用户体验严重老化
2. 社区活跃度下降，版本更新停滞
3. 缺少现代化调试和诊断工具
4. 实时性支持有限（依赖目标平台）
5. 缺少商业支撑和认证

---

## 6. 产品特色（续）

### 6.4 编译器设计哲学

MatIEC 编译器遵循几个核心设计原则：

**"生成可读的 C 代码"**:
MatIEC 输出的 ANSI C 代码是人工可读的，保留 IEC 变量名和注释结构。这使得生成的代码不仅可执行，还可以作为教育和调试工具。

**"最小运行时依赖"**:
MatIEC 生成的代码运行时（runtime library）仅约几千行 C 代码，无操作系统依赖，适合从 RTOS 到裸机（bare-metal）的任何环境。

**"标准的编译器工具链"**:
使用 flex/bison 生成词法/语法分析器，降低了编译器维护和扩展的门槛。任何熟悉编译原理的开发者都可以参与 MatIEC 开发。

**"可预测的性能"**:
通过避免动态内存分配和运行时反射，MatIEC 生成的代码执行时间可预测，满足工业控制场景的实时性需求。

### 6.5 与其他开源 PLC 项目的关联

Beremiz/MatIEC 在开源 PLC 生态中处于基础性地位：

```
Beremiz (2005) - 首个开源 IEC 61131-3 IDE
  |
  +-> MatIEC (2007) - 独立编译器引擎
  |     |
  |     +-> OpenPLC v3 (2014) - 采用 MatIEC 作为编译器
  |     |     |
  |     |     +-> OpenPLC v4 (2024) - 替换为 STruC++
  |     |
  |     +-> 多个学术项目和教育用途
  |
  +-> PLCopen XML 标准验证
```

这种关联显示了开源生态的继承和演进模式：Beremiz 证明了 IEC 61131-3 开源 IDE 的可行性，其核心组件 MatIEC 被 OpenPLC 等后续项目继承，而 OpenPLC v4 的 STruC++ 则代表了 IEC 61131-3 编译器技术的下一代演进。

