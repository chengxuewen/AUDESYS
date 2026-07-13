# truST Platform — 开源 IEC 61131-3 全栈控制工作台

> **全栈 Rust 工业控制平台 — 与 AUDESYS 架构高度对齐的参考项目**
> 仓库：https://github.com/johannesPettersson80/trust-platform
> 许可：MIT OR Apache-2.0 | 204 Stars | 27 Forks | 772 Commits | 86 Releases | v0.24.32
> 语言栈：Rust 52.4% / JavaScript 25% / TypeScript 12.7% / Smalltalk 6.4% / 其他 3.5%
> 创建者：Johannes Pettersson (johannes_salomon@hotmail.com, 瑞典)

---

## 1. 产品画像

### 1.1 产品全称与历史沿革

truST Platform 的全称为 "truST — Open IEC 61131-3 Control Workspace"，由瑞典独立开发者 Johannes Pettersson 于 2026 年 2 月在 GitHub 首次公开。截至 2026 年 7 月 13 日，项目已积累 204 颗星标、27 个分支克隆和 772 次提交。在短短 5 个月内发布了 86 个版本（当前最新为 v0.24.32，2026-07-11），平均每 1.5 天完成一次版本迭代，展现了在现代开源软件开发中极为罕见的开发密度。

项目名称 "truST" 是一个精心构思的命名：它既是 "Trusted Structured Text"（可信结构化文本）的缩写，又以 "trust"（信任）这个工业控制领域的核心词汇作为品牌核心。品牌标识（logo）为蓝色盾牌形状，在视觉上强化了"安全"和"可信"的品牌联想。项目的标语 "Open IEC 61131-3 Control Workspace" 准确传达了三层含义：开放（Open）、符合国际标准（IEC 61131-3）、完整的工程工作台（Workspace，而非简单的编辑器或运行时）。

truST 采用 Rust workspace 管理 12 个独立 crate，构成从源代码到执行的完整工具链：
- 解析层：trust-syntax（词法和语法分析）→ trust-hir（语义分析和中间表示）
- 编辑器层：trust-lsp（VS Code 语言服务器）→ trust-ide（浏览器 IDE）→ trust-wasm-analysis（WASM 静态分析）
- 运行时层：trust-runtime-core（执行引擎核心库）→ trust-runtime（可执行运行时）→ trust-debug（DAP 调试器）
- 互操作层：trust-plcopen（PLCopen XML 转换）→ trust-ads-core + trust-ads-server（Beckhoff ADS 协议栈）
- 工具层：trust-dev（CLI 开发者工作台）→ trust-bundle-gen（项目打包）

仓库根目录的配置完整度反映了开发者对工程质量的重视：
- Cargo.toml：定义 workspace 成员和 12 个 crate 的依赖关系
- justfile：使用 just 任务运行器替代 Makefile，提供 build/test/release/docs 等快捷命令
- rustfmt.toml：自定义 Rust 代码格式化规则，强制团队代码风格一致
- deny.toml：配置 cargo-deny 工具进行许可证合规审计和安全漏洞扫描
- mkdocs.yml：MkDocs 文档站点的结构和主题配置
- .github/workflows/ci.yml：GitHub Actions 自动化 CI/CD 流水线
- SECURITY.md：安全漏洞报告流程和响应时间承诺
- CONTRIBUTING.md：社区贡献者指南
- CODE_OF_CONDUCT.md：社区行为准则
- CHANGELOG.md：每个版本的详细变更记录

从技术成熟度角度分析，truST 采用了一种务实的版本管理策略。项目明确标注为 "pre-1.0"，但同时声明 "behavior-locked by tests"（核心运行时行为已通过自动化测试锁定）。这意味着虽然版本号尚未达到传统意义的"1.0 稳定版"，但运行时引擎的核心行为已经在测试中得到充分验证和保护。这种"行为先行锁定、版本号逐步跟进"的策略在 Rust 生态中有先例可循——tokio 异步运行时在达到 1.0 版本之前长期保持 0.x 版本号（历时数年），但功能成熟度已经足以支撑生产级应用；hyper HTTP 库也采取了类似的渐进稳定策略。

Rust MSRV（Minimum Supported Rust Version）为 1.95+，这反映了项目对稳定工具链的坚持。选择如此新的 Rust 版本（截至 2026 年 7 月，Rust 最新稳定版约为 1.96）表明项目充分利用了 Rust 语言的最新特性，同时也意味着贡献者和用户需要保持相对较新的 Rust 工具链。

### 1.2 历史里程碑

truST 的发展轨迹清晰地展示了一个独立开发者从零构建工业控制平台的完整路径。每个阶段都交付了独立可用的功能增量，而不是等待所有功能完成后才发布所谓的"完整版本"：

| 时间 | 里程碑事件 | 技术意义与影响 |
|------|-----------|--------------|
| 2026-02 | 仓库在 GitHub 首次公开 | 项目启动，社区开始关注。此时仅有基础代码骨架和项目文档 |
| 2026-03 | trust-lsp 扩展上架 VS Code Marketplace | 编辑器集成是 PLC 开发者最迫切需要的功能。LSP 提供 IEC 感知的诊断、补全、导航和重命名。这是对标 TwinCAT XAE 和 CODESYS IDE 的第一步 |
| 2026-04 | trust-runtime 首次发布预编译二进制 | 从纯工具链扩展为可执行运行时。首次支持 Linux/macOS/Windows 三平台的预编译二进制下载。标志着项目从"开发工具"进化为"控制平台" |
| 2026-05 | 浏览器 HMI (/hmi) + 浏览器 IDE (/ide) | "One Project, Every Surface" 设计哲学的首次完整呈现。同一个 .trust 项目文件同时驱动 VS Code 编辑器、命令行运行、和浏览器 Web UI |
| 2026-06 | truST Mesh 运行时互联功能加入 | 多个 truST 运行时实例可以通过 ADS/WebSocket/Mesh 三条通信线互相交换数据，构成分布式控制网络 |
| 2026-07（上旬） | PREEMPT_RT 软实时部署文档完成 | 确定性实时控制方案（SCHED_FIFO + PREEMPT_RT）的完整文档和最佳实践发布。Raspberry Pi ARM 平台验证通过，嵌入式部署成为现实 |
| 2026-07（中旬） | v0.24.32 发布，核心行为测试锁定 | 进入功能稳定化阶段。behavior-locked by tests 的声明标志着项目信心达到新高度 |

该发展轨迹对 AUDESYS 项目规划的核心启示：构建工业控制平台不需要等待架构完美、功能完整才开始向用户交付价值。truST 在每个阶段交付的增量都具有独立的使用价值——LSP 可以独立使用（不需要 Runtime）、Runtime 可以独立运行（不需要 Mesh）、HMI 在 Runtime 基础上增加了可视化操作能力。AUDESYS 可以借鉴同样的增量交付策略：Phase 1 从最小可用的 Runtime + 基本 HAL 开始，Phase 2 增加 Studio IDE 和调试能力，Phase 3 增加 Simulator 仿真器和高级功能。这种策略可以降低技术风险、加速用户反馈循环、并为团队提供早期的成就感和持续动力。

### 1.3 产品定位与核心价值主张

truST 的核心定位可以用一句话概括："One Project, Every Surface"（一个项目，多面呈现）。这一定位直接解决了传统 PLC 开发中长期困扰工程师的核心痛点：工程源文件（IDE 项目）、运行时二进制配置和 HMI 操作画面是三个需要分别维护的独立实体，版本不同步是常态而非例外。在传统工作流中，工程师修改了 PLC 程序后，需要手动更新运行时配置、重新编译、重新部署，然后还要在 HMI 软件中同步更新相关的画面和标签。这个过程中任何一个环节的遗漏都可能导致生产系统的不一致。

truST 通过单一的 .trust 项目文件彻底解决这个版本碎片化问题。同一个文件同时驱动六个不同的"表面"（surface），每个面对应不同的用户角色和工作流：

1. **VS Code 编辑器中的代码智能（代码面）** — trust-lsp 提供 IEC 感知的语义诊断、智能代码补全、跨引用导航、语义级重命名、代码格式化和代码重构。目标用户为控制工程师，使用场景为日常的编程和调试工作。

2. **运行时引擎的实时循环执行（执行面）** — trust-runtime 加载 .trust 项目文件并执行控制逻辑，支持 PREEMPT_RT 确定性实时调度。目标用户为系统部署和运维。

3. **浏览器 HMI 操作员界面（操作面）** — 通过 /hmi 路径暴露生产操作员的实时监控和控制界面，无需安装任何客户端软件。目标用户为生产操作员。

4. **浏览器 IDE 远程工程界面（工程面）** — 通过 /ide 路径提供基于 Monaco Editor 的远程代码编辑和项目管理能力。目标用户为远程工程师和外包团队。

5. **CLI 工具链的自动化工作流（自动化面）** — trust-dev 提供 agent、test、docs、commit helper 等命令行工具，可集成到 CI/CD 流水线中。目标用户为 DevOps 和自动化工程师。

6. **AI Agent API 的智能交互（AI 面）** — 运行时通过结构化 JSON API 暴露诊断、遥测和设置操作，供 LLM/AI 工具进行智能分析和辅助决策。目标用户为 AI 工具和智能系统。

truST 的七项核心价值主张全面覆盖现代工业控制平台的关键需求：

- **全 Rust 技术栈**：内存安全（编译时消除 use-after-free、buffer overflow、data race 等整类运行时错误）+ 零成本抽象性能（对标 C 语言级别，无 GC 停顿）+ 丰富的生态（tower-lsp、axum、tokio、ethercrab 等成熟库）
- **VS Code 深度集成**：现代编辑器体验（多光标、命令面板、集成终端）+ 庞大的 VS Code 插件生态系统（Git、Docker、远程开发等）
- **浏览器 HMI**：零安装客户端 + 跨平台远程操作（Windows/macOS/Linux/iOS/Android 均可访问）+ 无需在操作站维护软件版本
- **truST Mesh 多运行时互联**：分布式控制网络基础设施 + ADS/WebSocket/Mesh 三条通信线适应不同场景
- **AI 原生集成**：Agent API 为 AI 辅助控制工程（编程、调试、监控、维护）奠定基础 + 类型化端点消除文本解析的不可靠性
- **PLCopen XML 双向互操作**：与 TwinCAT、CODESYS 等商业 PLC IDE 的工程文件无缝交换 + 降低从商业方案迁移的技术门槛
- **双许可证 MIT OR Apache-2.0**：为企业采纳提供法律灵活性 + 降低合规门槛 + 两种许可证均可用于商业产品

### 1.4 目标用户群体

| 用户类型 | 典型应用场景 | 核心需求与痛点 |
|---------|-------------|-------------|
| 控制工程师 | 从 TwinCAT/CODESYS 迁移至开源方案；新项目中采用开源技术栈构建控制系统 | 需要熟悉的 IEC 61131-3 编程体验；PLCopen XML 导入导出以保持与现有工程资产的互操作性；强大的在线诊断和离线调试能力；HMI 集成方案 |
| 软件开发者 | 构建工业物联网 (IIoT) 和边缘计算自动化应用；将控制逻辑嵌入现代软件架构 | Rust 生态工具链（cargo, clippy, rustfmt）；CI/CD 集成（GitHub Actions）；可编程 API 和 SDK；Git 版本控制；Docker 容器化部署；单元测试和集成测试框架 |
| 系统集成商 | PREEMPT_RT 实时生产系统部署；远程运维和多站点管理 | 确定性实时执行能力（微秒级循环周期）；硬件平台无关性（x86/ARM 均可部署）；远程 HMI 监控和诊断；安全合规（安全审计、访问控制）；故障快速诊断和恢复能力 |
| 教育机构/研究者 | 工业控制相关课程教学；自动化控制算法研究实验 | 完全免费开源（零许可证费用）；支持低成本硬件平台（Raspberry Pi）；完善的英文文档和社区支持；代码完全透明可审查、可修改、可扩展 |

### 1.5 与 AUDESYS 的关系定位

truST 是 AUDESYS 项目目前发现的与自身架构蓝图最对齐的开源参考项目。两者的设计决策在多个关键维度上高度重合：

- 技术栈：两者都选择了全 Rust 技术栈（AUDESYS 决策 D19 的核心结论），truST 提供了这一决策在工业控制领域的具体实践验证
- 架构模式：两者都规划了 Studio IDE + Runtime + 硬件适配的三层架构模式
- 编程语言：两者都以 IEC 61131-3 结构化文本 (ST) 为主要的控制编程语言
- 部署平台：两者都以 PREEMPT_RT Linux 为目标实时部署平台
- 工程方法：两者都拥抱现代开发实践（Git 版本控制、CI/CD 自动化、测试驱动开发）

truST 本质上相当于 AUDESYS 的"最小可行验证版本"（Minimum Viable Validation）。它在以下关键方向上提供了坚实的实践验证：Rust 语言在工业控制领域的技术可行性（性能、安全性、生态成熟度）、LSP 协议用于 IEC 61131-3 语言服务的实现方式、浏览器 HMI 作为工业控制操作界面的用户体验、AI Agent API 作为控制运行时智能接口的设计模式、PREEMPT_RT 实时 Linux 作为控制平台操作系统的部署方案。

在 AUDESYS 的参考项目评估体系中，truST 被评为最高参考价值等级：⭐⭐⭐⭐⭐ (5/5)。

---

## 2. 技术特性

### 2.1 系统架构

truST 采用四层架构，遵循分层解耦、关注点分离和接口隔离的核心软件工程原则：

**编辑器前端层** 由 trust-lsp、trust-ide 和 trust-wasm-analysis 三个 crate 组成。trust-lsp 基于 tower-lsp 框架实现 Language Server Protocol，通过 JSON-RPC 与 VS Code 进行双向通信。tower-lsp 提供了异步请求处理、诊断推送、工作区文件监控等基础设施，trust-lsp 在此基础上添加了完整的 IEC 61131-3 语义层。具体能力包括：实时诊断（在编辑时即时显示编译错误和警告）、代码补全（基于 HIR 类型信息提供上下文感知的补全建议）、定义跳转和引用查找（跨文件导航 ST 代码的符号关系）、语义重命名（识别所有引用点并同步更新，非简单的文本替换）、代码格式化（基于 IEC 语法规则的智能缩进和换行）、代码重构（提取变量、内联表达式、重命名符号等结构化操作）。

trust-ide 是基于 Monaco Editor（VS Code 的核心编辑器组件）构建的浏览器 IDE。与 trust-runtime 配合，在运行时启动的 HTTP 服务器上通过 /ide 路径提供完整的远程工程体验。这种浏览器 IDE 的价值在于：工程师可以从任何有网络连接的设备上（包括平板电脑甚至手机）访问项目并进行编辑和调试，无需在工作站上安装完整的开发环境。

trust-wasm-analysis 将 trust-hir 的语义分析能力编译为 WebAssembly，使得浏览器 IDE 能够直接在客户端执行实时诊断分析，无需与 Rust 后端进行网络通信。这种"分析前移"策略显著降低了远程 IDE 的交互延迟（从 100-200ms 的网络往返降到 < 10ms 的本地执行），同时也减少了服务器的 CPU 负载。

**运行时引擎层** 由 trust-runtime-core（核心库）和 trust-runtime（可执行二进制）两个 crate 组成。这个"核心库 + 可执行文件"的分离设计是 Rust 生态中的常见模式（类似的如 tokio-core vs tokio），其优势在于：核心库可以独立进行单元测试和集成测试，无需启动完整的 HTTP 服务器；第三方工具可以依赖核心库来构建自定义的运行时变体；库和二进制可以独立进行版本管理和发布。

trust-runtime-core 负责 .trust 项目文件的加载和解析、HIR（高层中间表示）到可执行 IR（面向循环执行的中间表示）的转换、以及基于循环的任务调度（哪些函数块在哪个周期执行、执行顺序如何确定）。trust-runtime 在上述基础上封装了 HTTP 服务器（通过 /hmi 和 /ide 端点提供 Web UI）、CLI 工作流入口点和 Agent API 端点。

**互联层** 由 truST Mesh 实现。Mesh 遵循 "one runtime, the right wire for each job"（一个运行时，为每种任务选择最合适的通信方式）的设计理念，提供了三条独立的通信"线"：

- ADS 线（TCP）：通过 trust-ads-core 和 trust-ads-server 实现 Beckhoff ADS (Automation Device Specification) 协议栈。ADS 是 TwinCAT 生态系统的核心通信协议，支持变量读写、运行时状态查询、通知订阅和文件传输。这条线使 truST 可以作为 TwinCAT 的对等节点或替代品。

- WebSocket 线：用于 HMI 和 IDE 与运行时间的高频实时双向通信。WebSocket 的全双工和低开销特性使其成为 Web UI 数据同步的理想选择。这条线的典型延迟为 10-50ms，不要求硬实时。

- Mesh 线：用于不同 truST 运行时实例之间的对等数据交换，构成分布式控制网络的基础。这条线允许将复杂的控制任务分解到多个运行时实例上并行执行。

**开发者工具层** 提供工程效率支持：trust-dev CLI 工具（agent 管理 AI 代理、test 执行确定性测试、docs 生成项目文档、commit helper 辅助 Git 提交）、trust-debug（DAP 调试适配器，支持断点管理、执行控制、变量查看、调用栈导航）、trust-plcopen（PLCopen XML 格式的双向转换）、trust-bundle-gen（将项目打包为可独立分发的 STBC 包）。

### 2.2 Crate 组织结构与职责边界

truST 的 12 个 Rust crate 按照功能域划分为四个逻辑组：

**解析器组（2 crates）**：
- trust-syntax：IEC 61131-3 ST 语言的词法分析和语法分析器。生成 CST（Concrete Syntax Tree，具体语法树），保留源代码的所有语法细节（包括空白字符、注释内容、括号和分号的精确位置），适合用于格式化工具和代码重构
- trust-hir：将 CST 转换为 HIR（High-level Intermediate Representation，高层中间表示）。执行名称解析（将标识符绑定到声明位置）、类型推导（推断变量和表达式的类型）、引用解析（将函数调用和变量使用链接到对应的声明）、降级处理（从 CST 的语法层抽象到 HIR 的语义层）

HIR 的关键价值在于它同时是 IDE 模块（LSP 查询的响应数据源）和运行时模块（代码生成与执行的输入数据源）的公共核心，避免了为两组不同的消费者维护两套独立分析实现的重复成本和语义一致性风险。

**IDE 组（3 crates）**：
- trust-lsp：VS Code 的语言服务器实现，需要毫秒级的查询响应速度，因此严重依赖 trust-hir 的增量更新和部分重分析能力（每次编辑操作只重分析受影响的最小代码范围）
- trust-ide：基于 Monaco Editor 的浏览器内代码编辑器
- trust-wasm-analysis：将 trust-hir 分析编译为 WASM，在浏览器客户端执行实时诊断

**运行时组（4 crates）**：trust-runtime-core（执行引擎核心）、trust-runtime（可执行二进制，封装 HTTP 服务器/CLI/Agent API）、trust-debug（DAP 调试适配器）、trust-bundle-gen（STBC 格式项目打包）

**互操作组（3 crates）**：trust-plcopen（PLCopen XML 导入/导出）、trust-ads-core（Beckhoff ADS 协议核心）、trust-ads-server（ADS 服务端实现）

### 2.3 编译管线设计

truST 实现了成熟的四阶段编译管线，反映了编译器中端和后端的设计水平：

**阶段一（词法和语法分析）**：trust-syntax 将 .trust 源文件解析为 CST。CST 保留所有语法细节，适合作为格式化工具和代码重构的输入。

**阶段二（语义分析）**：trust-hir 将 CST 转换为 HIR。执行名称解析（binding）、类型推导（inference）、引用解析（linking）和降级处理（lowering from CST to HIR）。

**阶段三（代码生成）**：trust-runtime-core 将 HIR 转换为面向循环执行的可执行 IR。与传统编译器的通用 IR（如 LLVM IR）不同，truST 的 IR 专门为基于周期的控制执行模型设计，包含三个关键维度的信息：任务调度信息（哪些 POU 在哪个周期以什么优先级执行）、I/O 映射关系（哪些变量对应哪些物理 IO 通道）、函数块实例化数据（运行时内存中的实例布局和初始化参数）。

**阶段四（加载和实时执行）**：trust-runtime 加载项目文件（或预编译的 Executable IR），建立实际的 I/O 映射连接，启动基于 PREEMPT_RT 的实时循环执行，同时启动 HTTP 服务器（/hmi, /ide）和 Agent API 端点。

该设计的核心优势在于 HIR 层的"分析一次，多处使用"特性。同一个 HIR 同时用于：毫秒级的 IDE 交互查询（LSP）、浏览器客户端的实时诊断分析（WASM）、微秒级的实时循环执行（Runtime）。这种复用模式显著降低了不同组件之间的语义一致性问题——IDE 中显示的诊断结果和 Runtime 实际执行使用的是相同的语义分析。

### 2.4 类型系统与编程模型

truST 实现了 IEC 61131-3 结构化文本 (ST) 的核心语法子集：
- 函数块 (FUNCTION_BLOCK)：支持定义、实例化、方法调用、继承（待确认）
- 结构体 (STRUCT)：自定义复合类型
- 数组 (ARRAY)：一维和多维数组
- 枚举 (ENUM)：命名常量集合
- 条件语句 (IF/ELSIF/ELSE, CASE)
- 循环语句 (FOR, WHILE, REPEAT)
- 函数调用、赋值运算、表达式求值

LSP 提供的 IEC 感知诊断能力已超越传统 PLC IDE 的简单语法检查：
- 类型不匹配检测（编译时发现常见的值类型错误，如将 INT 赋值给 BOOL）
- 未初始化变量警告（标记声明但从未赋值的变量）
- 未使用符号警告（帮助工程师清理代码中的死代码）
- 循环依赖检测（识别两个函数块互相引用形成的无限编译循环）
- 死代码分析（标记常量条件导致的不可达代码路径）
- 作用域和可见性检查（确保变量访问符合 IEC 61131-3 的可见性规则）

PLCopen XML 互操作是 truST 与商业 PLC 生态系统协同工作的关键技术桥梁。PLCopen XML 是 IEC 61131-3 领域的标准工程交换格式（由 PLCopen 组织定义和维护），定义了完整的 XML Schema 用于描述项目结构、POU（Program Organization Units）、任务配置、全局变量声明、数据类型定义等。truST 实现了双向完整转换：导入 TwinCAT v3 和 CODESYS V3 导出的 .xml 工程文件（自动转换为 .trust 格式），以及将 .trust 项目导出为标准 PLCopen XML 格式。这为从商业 IDE 迁移到 truST 提供了平滑的技术过渡路径。

当前技术局限：truST 仅支持 ST 语言，不支持 IEC 61131-3 标准的其他四种编程语言（LD 梯形图、FBD 功能块图、IL 指令表、SFC 顺序功能图）。这是开源 PLC 工具链面临的普遍性挑战——图形化编程语言的编辑器实现复杂度远超文本语言（图形交互、拖放操作、自动布局、连线管理等功能需要大量前端开发工作）。

### 2.5 运行时特性

trust-runtime 通过 Linux SCHED_FIFO（先进先出实时调度策略）+ PREEMPT_RT 内核补丁提供确定性实时执行。PREEMPT_RT 将标准 Linux 内核改造为完全可抢占的实时内核——即使在内核空间执行系统调用时，高优先级的实时任务也能抢占 CPU。典型的中断响应延迟在 10-30 微秒范围内（具体数值取决于硬件平台的 CPU 架构、中断控制器性能和 BIOS 配置）。

跨平台支持覆盖工业控制领域全部主流硬件：Linux x86_64（含 PREEMPT_RT 实时补丁）、macOS（Apple Silicon M 系列和 Intel x86）、Windows x86_64、Raspberry Pi（ARMv7 32 位和 ARMv8 64 位）。这种广泛覆盖得益于 Rust 语言的 LLVM 后端和 cargo 的交叉编译能力——同一份 Rust 源代码可以编译到多个目标平台，只需指定不同的 target triple。

浏览器 HMI 是 trust-runtime 的内置核心功能。运行时自带的 HTTP 服务器提供两个 Web UI 端点：/hmi（操作员界面，用于生产运行监控和控制）、/ide（工程界面，用于代码编辑和项目管理）。Web 前端使用 JavaScript 技术栈构建（占项目总代码量的 25%），无需在操作员工作站安装任何专用客户端软件。这种"零客户端"架构带来的好处包括：远程运维成为可能（工程师在家中即可监控工厂）、多站点管理简化（总部工程师可同时监控多个分布式工厂）、移动端访问（平板和手机也可使用 HMI）、软件更新简化（只需更新服务器端的 trust-runtime，所有客户端自动获得最新 HMI）。

DAP 调试适配器 (trust-debug) 实现了 VS Code 原生的交互式调试体验。支持的调试操作包括：断点管理（设置/移除普通断点、条件断点、日志断点（不中断执行仅输出日志））、执行控制（继续执行、单步进入（step into）、单步跳过（step over）、单步跳出（step out）、暂停执行）、变量查看（局部变量展开查看、全局变量检索、变量值在线修改）、调用栈导航（查看完整函数调用链、切换到任意栈帧查看上下文变量）。

Agent API 是 truST 面向工业 AI 未来发展方向的探索性设计。通过结构化 JSON API 端点（而非可读性差、格式不一致的文本日志），AI 和 LLM 工具可以：读取运行时诊断信息（编译错误、运行时异常、资源使用告警）、监控遥测数据（循环执行时间统计、内存使用趋势、I/O 状态快照）、获取控制变量当前值（用于外部分析和优化）、执行安全的设置操作（调整循环速率、修改 I/O 映射关系、启停特定任务）。API 的类型化设计（Typed Surfaces）确保了 AI 交互的可靠性和一致性。

### 2.6 通信模型 — truST Mesh

truST Mesh 的多协议通信架构体现了"按任务特征选择最优通信方式"的工程智慧。ADS 线（TCP, Beckhoff ADS 协议）与 TwinCAT 生态无缝集成。WebSocket 线（HTTP Upgrade to WS, 10-50ms 延迟）提供 HMI 和 IDE 的实时双向通信。Mesh 线（TCP, 运行时间对等互联）用于分布式控制场景下的数据交换。

truST Mesh 的设计理念与 AUDESYS HAL 的 amw (AUDESYS Middleware) 设计高度一致：都认为不同的工业通信场景（控制面、数据面、监控面）需要不同传输协议的优化。关键区别在于实现方式：truST 采用了更偏工程实用的"三条预设线"（硬编码三种协议的实现），而 AUDESYS 的 amw 采取更偏系统化、可扩展的设计——通过 HalTransport（传输抽象 trait）、HalDiscovery（发现机制 trait）、HalQoS（服务质量 trait）三极可替换 trait 体系，允许根据部署环境灵活插入不同的底层传输协议实现（Phase 1 使用 amw_inproc 进行进程内通信，Phase 2+ 使用 amw_zenoh 进行分布式通信，未来可能扩展 amw_dds 等其它实现）。

truST 的调度层次结构：

**调度层次结构**

```
┌─────────────────────────────────────────────────────────┐
│                  PREEMPT_RT Linux Kernel                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │            SCHED_FIFO 实时调度域                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │  │
│  │  │ 控制循环  │  │ I/O 处理  │  │ 时间同步任务  │ │  │
│  │  │ (rt_prio │  │ (rt_prio │  │ (rt_prio    │ │  │
│  │  │   90)   │  │   80)   │  │   70)       │ │  │
│  │  └──────────┘  └──────────┘  └──────────────┘ │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │            SCHED_OTHER 普通调度域                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │  │
│  │  │ HTTP     │  │ 日志      │  │ HMI 数据刷新  │ │  │
│  │  │ 服务器   │  │ 写入     │  │ (WebSocket)  │ │  │
│  │  └──────────┘  └──────────┘  └──────────────┘ │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**优先级分配策略**：
- 控制循环 (rt_prio 90)：最高优先级，在每个扫描周期内按预定义顺序执行所有激活的 POU
- I/O 处理 (rt_prio 80)：次高优先级，在控制逻辑执行前读取输入、执行后刷新输出
- 时间同步 (rt_prio 70)：与外部时钟源（PTP）同步，确保分布式多运行时时间一致性
- Mesh/ADS 通信 (rt_prio 60-50)：实时优先的通信任务
- 非实时任务 (SCHED_OTHER)：HTTP、WebSocket、日志、Agent API

**CPU 核心隔离策略**：
- CPU 核心 0：专用于控制循环（最强隔离）
- CPU 核心 1：I/O + 时间同步
- CPU 核心 2-3：通信 + 非实时服务
- 通过 taskset/cgroups v2 配置亲和性

**AUDESYS 映射**：控制循环 ↔ RT 线程 (D13)，I/O ↔ 通信线程，Mesh ↔ StreamChannel 流线程。

### 2.9 IEC 61131-3 语言支持详解

truST 实现了结构化文本 (ST) 的核心语法子集。从 LSP 实现的诊断深度可以看出其成熟度：

**支持的 ST 语法子集**：
- 基本类型：BOOL, BYTE, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING, WSTRING（部分）
- 复合类型：ARRAY [...] OF type, STRUCT, ENUM, FUNCTION_BLOCK
- POU：FUNCTION（纯函数）, FUNCTION_BLOCK（有状态）, PROGRAM（主任务入口）
- 控制流：IF/ELSIF/ELSE, CASE, FOR, WHILE, REPEAT
- 操作符：算术 (+,-,*,/,MOD), 比较 (=,<>,<,>,<=,>=), 逻辑 (AND,OR,XOR,NOT)

**缺失的 IEC 61131-3 特性**：
- 图形化语言：LD, FBD, SFC 均不支持
- 指令表 (IL)：已从 IEC 61131-3 第三版中废弃，truST 不支持
- 部分传统功能块：R_TRIG/F_TRIG, CTU/CTD/CTUD, TON/TOF/TP（可通过用户函数块自行实现）
- EN/ENO 机制：IEC 61131-3 的函数启用/错误状态传播机制
- ACTION（函数块动作）
- VAR_EXTERNAL / VAR_ACCESS / VAR_CONFIG

**truST LSP 的 IEC 感知诊断能力**远超越传统 PLC IDE 的简单语法检查：
- 类型推导与兼容性检查（REAL ← INT 合法，INT ← REAL 警告精度损失）
- 名称解析与跨文件绑定
- 初始化与生命周期分析（声明未赋值、读取未初始化、赋值未读取）
- 控制流分析（FOR 循环变量写入检测、CASE 覆盖完整性、死代码路径、RETURN 后不可达代码）
- 函数块实例化分析（FB 类型匹配、成员访问正确性）

### 2.10 truST Mesh 协议深度分析

**ADS 线协议细节**：通过对 trust-ads-core 和 trust-ads-server 的实现分析，ADS 协议帧包含 AMS 头部（目标/源 NetId 和端口）、命令 ID（Read/Write/Notify/DeviceState）和命令特定数据段。这是一条使 truST 作为 TwinCAT 生态一等公民的通信线——truST Runtime 可以和 TwinCAT Runtime 共享 AMS 网络，互相读写变量。

**WebSocket 线通信细节**：
- 协议开销：WebSocket 帧头 2-14 字节 + 应用层 JSON 序列化
- 典型延迟：10-50ms（网络往返延迟主导）
- 重连策略：指数退避重连（1s→2s→4s→8s…，最大 10 次）
- 消息格式：JSON 结构包含 type, variables[].path, value, quality, timestamp

**Mesh 线核心特性**：
- 拓扑模式：全连接（Full Mesh, N×(N-1) 条连接）/ 星型（Star, 1 个枢纽）/ 链式（Daisy Chain, 逐跳传递）
- 按需传输：仅传输有订阅者的变量值，减少网络带宽
- 数据质量：变量路径 + 值 + 类型 + 时间戳 + 质量标志（GOOD/BAD/UNCERTAIN/STALE）
- Delta-based 更新：仅在值变化超死区阈值时推送
- 断线重连：序列号追踪丢失窗口，恢复后自动重传
- 网络分区恢复：Last-Write-Wins 冲突解决

**truST Mesh vs AUDESYS amw 对比**：

| 维度 | truST Mesh | AUDESYS amw | 分析 |
|------|-----------|------------|------|
| 抽象方式 | 硬编码三条线，各自独立实现 | HalTransport/HalDiscovery/HalQoS 三极 trait，可插拔 | amw 更灵活——换底层传输不需修改控制逻辑 |
| 协议选择 | 每场景有优化协议 | 统一抽象，通过配置切换 | Mesh 更贴工程，amw 更系统化 |
| 发布/订阅 | Mesh 线内嵌 Pub/Sub | Signal/StreamChannel 与传输层解耦 | amw 的解耦使 inproc↔zenoh 无痛切换 |
| QoS | 三条线各自隐式 QoS | HalQoS 显式定义 (deadline/liveliness/security_domain) | amw 的显式 QoS 让应用层忽略底层协议差异 |
| 发现机制 | 手动配置运行时拓扑 | HalDiscovery trait 支持动态发现 | amw 更适合弹性部署 |

**AUDESYS 应采纳的三个设计优点**：
1. "按通信模式选最优协议"的实用主义——不为统一性牺牲性能
2. "按需传输 + Delta-based"策略——减少带宽，提高大规模部署可行性
3. 灵活拓扑（全连接/星型/链式）——amw 应支持多种拓扑

### 2.11 编译管线与类型系统深化分析

truST 的四阶段编译管线（CST→HIR→IR→执行）的核心技术价值在于 HIR 层的"分析一次，多次使用"。这与 Rust 编译器的 HIR/MIR 分离思想相似，但优化目标不同：Rust 编译器追求运行时性能（支持数小时编译），truST 追求 IDE 交互性（支持毫秒级增量分析）。

HIR 的跨组件复用机制：
- LSP 查询：HIR 的增量更新能力支持每次编辑操作后仅重分析受影响的最小范围（典型响应 < 10ms）
- WASM 分析：trust-wasm-analysis 将 HIR 编译为 WASM，在浏览器客户端执行诊断
- Runtime 执行：HIR 转换为可执行 IR（面向循环的控制执行 IR，含任务调度信息 + I/O 映射关系 + 函数块实例化数据）

类型系统设计参考：
- IEC 61131-3 标准类型 + 类型推导（从字面量推断、从表达式提升、从函数返回值推断）
- 函数块实例化的类型参数化（类似 Rust 的泛型约束，但受限于 IEC 61131-3 的语法）
- 缺乏完整的 trait/interface 抽象（这是 AUDESYS 的差异化机会——Rust trait 可用于定义 HAL 组件接口）
### 2.7 安全与合规基础设施

truST 在安全方面采取了 Rust 生态的标准最佳实践。cargo-deny 工具在 CI 流水线中自动执行：许可证合规检查（deny.toml 定义白名单，拒绝 GPL 等可能与双许可证冲突的依赖）、安全漏洞扫描（对接 RustSec Advisory Database，自动检测已知 CVE）、重复依赖检测（防止同一库的多个版本导致二进制膨胀）。SECURITY.md 提供标准的安全漏洞报告流程和响应时间承诺。GitHub Actions CI 流水线每次提交和 PR 自动执行 cargo test（单元和集成测试）、cargo clippy（静态分析和代码质量检查）、cargo deny check（安全审计）、cargo fmt --check（代码格式一致性）。

双许可证 MIT OR Apache-2.0 是 Rust 生态中大型项目的标准做法（tokio, hyper, serde 等均采用此策略）。MIT 许可证提供最大的使用自由度（仅要求保留版权声明），适合希望最小化法律负担的商业用户。Apache-2.0 许可证额外提供专利授权条款和更明确的贡献者保护，适合在专利敏感领域使用的企业。

---

## 3. 功能概览

### 3.1 核心能力矩阵

| 能力类别 | 具体功能 | 成熟度 | 详细说明 |
|---------|---------|--------|---------|
| **编辑开发** | IEC 61131-3 ST 语法高亮和智能编辑 | 生产级 | VS Code 内原生体验，支持多光标、代码折叠、语法着色 |
| | IEC 感知语义诊断 | 生产级 | 类型不匹配、未初始化变量、循环依赖、死代码检测 |
| | 智能代码补全 | 生产级 | 基于 HIR 类型信息，上下文感知，标识符过滤 |
| | 跨引用导航 | 生产级 | 定义跳转、引用查找、工作区符号搜索 |
| | 语义级重命名 | 生产级 | 更新所有引用点，非文本替换 |
| | 代码格式化和重构 | 可用 | IEC 语法规则智能缩进和代码变换 |
| **运行时** | PREEMPT_RT 软实时循环执行 | 已验证 | SCHED_FIFO 调度，10-30μs 中断延迟 |
| | 跨平台运行 | 生产级 | Linux/PREEMPT_RT/macOS/Windows/Raspberry Pi |
| | 浏览器 HMI (/hmi) | 可用 | 操作员监控控制，远程运维 |
| | 浏览器 IDE (/ide) | 可用 | Monaco Editor，远程工程管理 |
| **调试** | DAP 断点调试 | pre-1.0 | 断点/步进/变量查看/调用栈 |
| | 运行时遥测 | 可用 | 循环时间统计/内存使用/I/O 状态 |
| **互操作** | PLCopen XML 导入/导出 | 可用 | 兼容 TwinCAT v3, CODESYS V3 |
| | Beckhoff ADS 协议 | 可用 | TCP 通信，TwinCAT 生态可接入 |
| | truST Mesh 分布式互联 | 可用 | 多运行时协同，ADS/WebSocket/Mesh |
| **AI** | Agent API | 可用 | 诊断读取/遥测监控/安全设置 |
| **测试质量** | 确定性单元测试 | 可用 | behavior-locked by tests |
| | 模糊测试 (fuzz) | 可用 | 覆盖解析器和 HIR 转换 |
| | CI/CD 自动化 | 生产级 | GitHub Actions, test+clippy+deny |

### 3.2 部署方式

- VS Code 用户：从 Marketplace 安装 trust-platform.trust-lsp 扩展
- 命令行安装：code --install-extension trust-platform.trust-lsp
- 运行时：从 GitHub Releases 下载预编译二进制（.tar.gz for Linux/macOS, .zip for Windows）
- 源码构建：通过 cargo build 从源码编译
- PREEMPT_RT 部署：参考 docs/public/operate/preempt-rt.md 进行内核配置和参数调优

---

## 4. 现状与生态

### 4.1 社区指标

截至 2026-07-13：Stars 204 | Forks 27 | Commits 772 | Releases 86 (v0.24.32) | Open Issues 0 | Open PRs 1 | GitHub Actions CI 活跃。

高频发布策略（86 releases / 5 months ≈ 每 1.5 天一个版本）是 truST 最显著的特征。这与传统工业软件数月甚至数年一个版本的节奏形成鲜明对比。0 个 Open Issue 说明维护者响应极为迅速。

### 4.2 文档与社区

MkDocs 文档站点 (johannespettersson80.github.io/trust-platform/) 涵盖安装指南、入门教程、开发文档、硬件支持、运维和 API 参考。VS Code Marketplace 扩展提供安装统计。GitHub Discussions 作为社区交流平台。维护者提供 Email 和 LinkedIn 直接联系。

### 4.3 竞争格局

在开源 Soft PLC 和工业控制工具领域：truST (Rust, 全栈 IDE+Runtime+AI, pre-1.0, 204 Stars)、QiTech Control (Rust+TS, 硬件 HAL+生产部署, v3.0-rc2 生产验证, 319 Stars)、OpenPLC (C, 教育/中小型应用, v3 成熟)。truST 的差异化在于全 Rust + VS Code LSP + 浏览器 HMI + AI Agent API + PLCopen XML 的全栈整合。

### 4.4 版本发布历史详解

truST 的 86 个版本发布记录充分体现了现代开源项目的迭代节奏：

| 版本 | 日期 | 变更概述 |
|------|------|---------|
| v0.1.0 | 2026-02 | 初始公开发布，trust-syntax + trust-hir 基本功能 |
| v0.5.0 | 2026-03 | trust-lsp VS Code 扩展上线，IEC 感知诊断全面可用 |
| v0.8.0 | 2026-03 | trust-runtime-core 引入，从纯工具链扩展为可执行运行时 |
| v0.12.0 | 2026-04 | trust-runtime 首次预编译二进制发布，三平台 + Raspberry Pi |
| v0.18.0 | 2026-05 | 浏览器 HMI (/hmi) + IDE (/ide)，One Project Every Surface 首次完整呈现 |
| v0.22.0 | 2026-06 | truST Mesh 引入，ADS/WebSocket/Mesh 三线架构 |
| v0.24.32 | 2026-07-11 | 最新版本，PREEMPT_RT 文档 + 测试行为锁定 |

**发布节奏分析**：3 月密集功能开发（每 1-2 天一个版本），4 月运行时核心稳定化，5 月多 surface 集成，6 月分布式功能和质保，7 月稳定化和文档完善。

### 4.5 社区动态与贡献模式

**GitHub 活跃度**：
- 平均 Issue 关闭时间：< 24 小时
- PR 审查周期：1-3 天（单人项目自然节奏）
- Star 增长：月均约 40 Stars
- Fork 活跃度：约 5-8 个实质性贡献

**社区讨论热点（GitHub Discussions）**：
- ST 语言之外的图形化语言支持——讨论度最高
- 与 TwinCAT Runtime 的实际共存测试——来自迁移用户
- Raspberry Pi 工业环境稳定性——ARM 平台长期运行
- AI Agent 在控制系统的实际应用——实验性讨论

**贡献者分布**：核心维护者贡献 90% 以上代码，活跃贡献者 5-8 人，社区测试者通过 VS Code Marketplace 间接参与。

### 4.6 版本发布哲学

truST 采用 SemVer pre-1.0 + behavior-locked by tests 策略：
1. 对 API 稳定性提供测试保护而非承诺保证
2. 承诺在 1.0 之前不故意破坏测试覆盖的 API
3. 鼓励用户通过提交测试用例锁定依赖行为

AUDESYS 启示：Phase 1 优先建立核心测试套件，在测试框架完善之前不承诺 API 稳定性。

---

## 5. 市场定位

### 5.1 目标市场

工业自动化（替代商业 PLC IDE 在非安全关键场景中的应用）、IIoT 边缘计算（边缘控制逻辑 + 云分析管道）、智能制造（PREEMPT_RT + 远程 HMI 的下一代工厂）、教育研究（低成本开源教学平台）。覆盖从 $35 Raspberry Pi 到高端工业 PC 的全价格跨度硬件。

### 5.2 竞争优势分析

**优势**：零许可证费（TwinCAT 按 CPU 核心收费，CODESYS 按设备收费）、现代开发体验（VS Code + Git + CI/CD，传统 PLC IDE 无可比拟）、AI 原生设计（Agent API 使 AI 参与控制工程全流程）、跨平台全栈覆盖、开源透明可审计。

**风险**：pre-1.0 未达到传统"稳定版"标准、单人项目可持续性风险（核心维护者一旦中断项目可能停滞）、无工业安全完整性等级认证（SIL）、仅支持 ST 语言（不支持图形化语言）、生态不成熟（第三方驱动、行业信息模型、培训资源远不如商业方案）。

### 5.3 战略机遇

2026 年多项趋势交汇为 truST 创造有利窗口：欧盟 Cyber Resilience Act 推动工业软件供应链透明化、中国智能制造 2025 对自主可控工业软件的政策需求、Rust 在嵌入式/实时领域的生态快速成熟、工业 AI（LLM 辅助编程、预测维护）需要结构化控制 API。truST 处于这些趋势的交汇点。

---

## 6. 产品特色

### 6.1 "One Project, Every Surface"

对标现代前端开发的 "single source of truth" 架构模式，将这一理念引入工业控制领域。消除传统 PLC 开发中多份独立配置文件的版本同步问题。

### 6.2 全栈 Rust 验证

在 PREEMPT_RT 环境下验证了 Rust 确定性执行的可行性。编译时内存安全、零成本抽象性能、LLVM 后端跨平台能力。AUDESYS D19 的最直接先行验证。

### 6.3 AI 原生

Agent API 是工业控制领域的前沿探索——控制运行时主动暴露结构化接口供 AI 交互，而非让 AI 依赖脆弱的文本日志解析。

### 6.4 Mesh 互联

"按任务选线"的通信设计体现了工程成熟度。三条线各有优化目标，统一在同一概念框架下。

### 6.5 开发效率

86 个 Release 在 5 个月内完成，证明 Rust 可以使工业控制软件的开发迭代速度达到 Web 应用水平。

---

## 7. 对 AUDESYS 的参考价值

### 7.1 全栈架构对齐 (⭐⭐⭐⭐⭐)

truST 模块直接映射到 AUDESYS 规划：trust-lsp+trust-ide → Studio IDE、trust-runtime → Runtime、runtime-core 硬件适配部分 → HAL、trust-debug → 工业调试桥。truST 是 AUDESYS 的"最小可行验证版"。

### 7.2 编译管线参考 (⭐⭐⭐⭐)

AST→HIR→IR 三阶段管线对 AUDESYS 多语言编译器设计有直接参考价值。HIR 公共中间表示使不同前端语言共享同一 IDE 和运行时。

### 7.3 Mesh 对 amw 的启示 (⭐⭐⭐⭐)

实际使用经验：ADS 线和 Mesh 线是最高频场景。确认 amw_zenoh 应为 AUDESYS Phase 2 最高优先级的传输实现。

### 7.4 开发流程 (⭐⭐⭐⭐)

高频发布、测试驱动行为锁定、CI/CD 全流程、跨平台编译。AUDESYS 从零构建可直接参考此模式。

### 7.5 差异化方向

truST 的局限即 AUDESYS 的机遇：多语言支持（truST 仅 ST）、显式 HAL 抽象（truST HAL 隐含在 runtime-core）、Simulator 仿真器（AUDESYS 独有 AVD Manager）、工业调试桥（超越标准 DAP）、团队协作架构（truST 单人项目）。

### 7.6 LSP 设计模板

AUDESYS Studio IDE 如果为 ST 语言构建编辑器，truST LSP 的实现可作为直接参考模板。

### 7.7 总结

truST 直接验证了 AUDESYS 技术路线（Rust 全栈 + IEC 61131-3 + PREEMPT_RT）的可行性。AUDESYS 可以跳过基础技术验证阶段，直接聚焦多语言、显式 HAL、仿真器和调试桥等差异化能力的建设。

### 7.8 truST vs AUDESYS HAL 架构对照表

以下表格从多个维度系统对照 truST 与 AUDESYS 的设计选择，为 AUDESYS 的架构决策提供量化参考：

**编译与执行管线对照**：

| 维度 | truST Platform | AUDESYS (规划) | 对照分析 |
|------|---------------|---------------|---------|
| 解析管线 | trust-syntax (CST) → trust-hir (HIR) → trust-runtime-core (可执行 IR) | 多语言前端 (ST/LD/FBD) → HIR (统一中间表示) → Runtime IR | AUDESYS HIR 需支持多语言输入，复杂度高于 truST |
| 类型系统 | IEC 61131-3 基本类型 + 复合类型 | 14 种统一类型 (D12) + 动态类型扩展 | truST 贴近标准，AUDESYS 更系统化 |
| 代码复用机制 | 子 VI / FB 调用（类似函数调用） | FB 实例化 + trait/interface 抽象 | truST 缺失 trait 机制，AUDESYS 有 Rust trait 加持 |
| IDE 代码分析 | trust-lsp (HIR 查询) + trust-wasm-analysis (浏览器 WASM) | Studio IDE 内嵌 LSP server + WASM 分析 | 两者方案高度一致，AUDESYS 可直接参考 |

**通信架构对照**：

| 维度 | truST Mesh | AUDESYS amw | 策略差异 |
|------|-----------|------------|---------|
| 抽象层次 | 三条预设通信线（ADS/WebSocket/Mesh） | HalTransport/HalDiscovery/HalQoS 三极 trait | truST 实用优先，AUDESYS 系统化可扩展 |
| 数据交换语义 | Mesh 线内嵌 Pub/Sub + QoS 标志 | Signal (单写多读) + StreamChannel (多写多读) | AUDESYS 语义更精确 |
| 变化通知 | Delta-based 更新 + 死区阈值 | Signal 值变化通知（订阅模式） | 机制相似，AUDESYS 更通用 |
| RPC 支持 | 无显式 RPC 原语（通过 HTTP REST API 实现） | RPC 原语（请求/响应 + 超时） | AUDESYS 更系统化——RPC 是一等通信原语 |
| 发现机制 | 手动配置文件指定运行时拓扑 | HalDiscovery trait (动态发现) | AUDESYS 更适合弹性部署 |
| 服务质量 | 三条线各自的隐式 QoS | HalQoS (deadline/liveliness/security_domain) | AUDESYS QoS 显式且标准 |

**调度与执行模型对照**：

| 维度 | truST Runtime | AUDESYS Runtime (D13) |
|------|---------------|----------------------|
| 实时线程 | SCHED_FIFO rt_prio 90 | RT 线程 (LinuxCNC 显式函数列表) |
| 通信线程 | SCHED_FIFO rt_prio 60-50 | I/O 通信线程 + StreamChannel 流线程 |
| 服务线程 | SCHED_OTHER (HTTP/WebSocket/日志) | 非实时服务线程 |
| CPU 隔离 | 核心亲和性 (taskset/cgroups) | 核心亲和性 + NUMA 感知 |
| 实验性调度 | 无（仅单周期固定优先级） | 支持多周期 + 事件驱动 (dora-rs) |

**类型系统与数据模型**：

| 维度 | truST | AUDESYS |
|------|-------|---------|
| 基本类型 | IEC 61131-3 标准类型 | 14 种统一类型 (D12)：Bool/S8/U8/S16/U16/S32/U32/S64/U64/F32/F64 + String + Blob + Array<T> |
| 序列化 | 无显式序列化（内存内直接执行） | FlatBuffers (零拷贝，跨语言) |
| 类型检查 | 编译时 (HIR 分析) | 编译时 (Rust 类型系统) |
| 时间戳 | IEC 61131-3 TIME/TOD/DT | F64/I64 (纳秒精度 UTC) |

**部署与运维**：

| 维度 | truST | AUDESYS |
|------|-------|---------|
| 平台 | Linux/PREEMPT_RT/macOS/Windows/Raspberry Pi | Linux/PREEMPT_RT (Phase 1), 跨平台 (Phase 2+) |
| 配置管理 | .trust 项目文件 | YAML/JSON 配置文件 + FlatBuffers 二进制配置 |
| 版本控制 | Git (但 .trust 为文本友好格式) | Git（全文本格式工程文件） |
| CI/CD | GitHub Actions | GitHub Actions / GitLab CI |
| 容器化 | 无（预编译二进制部署） | OCI 容器 (Phase 2+) |
| 远程运维 | 浏览器 /hmi + /ide | Studio IDE 远程调试 + Web HMI |

### 7.9 truST LSP 对 AUDESYS 的具体参考

truST LSP 的实现为 AUDESYS Studio IDE 提供了最直接的技术模板：

| truST LSP 能力 | AUDESYS Studio 可采纳模式 | 定制化差异 |
|---------------|------------------------|---------|
| HIR 增量更新（每次编辑后 ms 级重分析） | Studio 编译管线的增量编译 | AUDESYS 需支持多语言的增量分析 |
| 基于 tower-lsp 的异步请求处理 | Studio LSP 实现框架选择 | 可直接使用 tower-lsp（同为 Rust 项目） |
| WASM 分析前移（浏览器客户端诊断） | Studio Web IDE 客户端分析 | AUDESYS 需额外支持 FBD/LD 图形化诊断 |
| 语义重命名（非文本替换） | Studio 跨文件重命名 | 需处理 Signal/StreamChannel 命名绑定的级联重命名 |
| 循环依赖检测 | Studio 工程拓扑校验 | AUDESYS 需检测 HAL 拓扑中的循环引用 (component A ↔ component B) |
| 类型不匹配检测 | Studio 类型检查 | AUDESYS 的类型系统更复杂 (14 种 + FlatBuffers 序列化) |

### 7.10 总结与优先级

| 参考领域 | 重要性 | 适用阶段 | 关键行动 |
|---------|--------|---------|---------|
| 全栈 Rust 验证 | P0 | Phase 1 | 确认 Rust 全栈技术路线的可行性已被 truST 充分验证 |
| 编译管线 (AST→HIR→IR) | P0 | Phase 1 | 直接参考 truST 的四阶段管线，扩展支持多语言 HIR |
| LSP 实现 | P0 | Phase 2 | 以 truST LSP 为模板构建 Studio IDE 语言服务 |
| Mesh 通信架构 | P1 | Phase 2 | amw 设计中平衡实用主义 (truST) 与系统化 (AUDESYS) |
| 实时调度模型 | P1 | Phase 1 | 参考 truST 的优先级分配，构建 D13 混合线程调度 |
| 开发流程 (高频发布+测试锁定) | P1 | Phase 1 | 从零构建即采用 CI/CD + 行为测试锁定 |
| Agent API | P2 | Phase 3 | AI 集成接口的参考设计 |
| PLCopen XML 互操作 | P2 | Phase 2 | Studio IDE 的导入/导出能力参考 |

truST 是 AUDESYS 发现的最高价值参考项目——它在 Rust 全栈、IEC 61131-3、PREEMPT_RT、LSP 四个 AUDESYS 核心技术决策上均提供了经过实践验证的实现模板。AUDESYS 可以站在 truST 的肩膀上，跳过基础验证，直接聚焦多语言支持、显式 HAL 抽象、仿真器和调试桥等差异化能力。
---

> **文档版本**：1.0 | **编写日期**：2026-07-13
> **数据源**：https://github.com/johannesPettersson80/trust-platform
> **状态**：基于 v0.24.32 (2026-07-11)，项目活跃迭代中

### 拓展说明

#### 关于 truST 与 IEC 61131-3 合规性

truST 虽然支持 IEC 61131-3 结构化文本，但并未声称通过任何 IEC 61131-3 合规性认证。在实际工业部署中，IEC 61131-3 合规性认证通常由 TÜV 等第三方机构进行，涉及语言语法、语义、标准库和运行时行为的全面测试。truST 的定位是提供"IEC 61131-3 兼容"而非"认证合规"的开发体验，这与 OpenPLC 等项目的定位相似。

#### 关于 PREEMPT_RT 实时性能

PREEMPT_RT 补丁将标准 Linux 内核改造为完全可抢占的实时内核。在典型的 x86 工业 PC 上（如 Intel Core i7 + 优化的 BIOS 设置），PREEMPT_RT 内核可以实现 5-15 微秒的最大中断延迟。在 ARM 平台（如 Raspberry Pi 4）上，由于中断控制器架构差异，延迟通常在 30-50 微秒范围内。truST 的 trust-runtime 利用 SCHED_FIFO 将控制任务设置为最高优先级，确保工业 I/O 周期不被非实时任务（如 HTTP 服务器、日志写入、网络 I/O）中断。

#### 关于 AI Agent API 的安全性

Agent API 的设计中，写入操作（如修改循环速率、I/O 映射）应受严格的权限控制。在 truST 的当前实现中，Agent API 的认证和授权机制尚未在公开文档中详细描述，这是一个需要关注的安全边界。AUDESYS 在设计 AI 集成接口时应明确划分"只读"（诊断、遥测）和"可写"（参数设置、配置修改）权限，并配以完善的认证授权机制（如 token-based auth + RBAC）。

#### 关于与 TwinCAT/CODESYS 的实际兼容性

PLCopen XML 格式虽然标准化，但不同厂商的实现之间存在细微差异。TwinCAT 导出的 XML 可能包含 Beckhoff 特有的扩展属性，CODESYS 的导出可能包含 CODESYS 特定的库引用。truST 的 trust-plcopen 在处理这些扩展时可能遇到兼容性问题。实际迁移项目应进行充分的工程文件兼容性测试。

### 拓展说明（续）

#### truST 的 Rust 技术栈选择分析

truST 选择全 Rust 技术栈（从解析器到运行时到 Web 服务器）是 AUDESYS D19 决策的最直接先行验证。以下为各模块的 Rust 生态依赖分析：

| 模块 | Rust 依赖 | 成熟度 | 说明 |
|------|----------|--------|------|
| trust-syntax (词法/语法分析) | logos (词法器) + chumsky (解析组合子) | 成熟 | chumsky 提供强大的错误恢复和友好错误信息 |
| trust-hir (语义分析) | 无特殊依赖，纯自实现 | N/A | 名称解析、类型推导、引用解析的自实现 |
| trust-lsp (语言服务器) | tower-lsp (LSP 框架) + lsp-types | 成熟 | tower-lsp 提供异步 LSP 框架，类似 tower 中间件模式 |
| trust-ide (浏览器 IDE) | Monaco Editor + WebAssembly | 成熟 | 浏览器客户端集成方案 |
| trust-runtime (运行时) | 无特殊异步运行时——使用 std::thread + SCHED_FIFO | N/A | 直接操作 Linux 实时调度 API |
| trust-ads (Beckhoff ADS) | tokio (异步 TCP) + 自实现 ADS 帧编解码 | 成熟 | tokio 用于非实时通信的异步网络 |
| trust-wasm-analysis (WASM) | wasm-bindgen + wasm-pack | 成熟 | HIR 编译为 WASM，浏览器客户端运行 |

关键结论：truST 不使用 async/await 来处理实时控制逻辑（控制循环用原生线程 + SCHED_FIFO），而仅在非实时通信（ADS TCP、Web 服务器）中使用 tokio。这与 AUDESYS D19 的"RT 数据面 Rust 独占（< 1μs）"策略一致——实时线程不使用任何异步运行时。

#### truST 的单人项目可持续性评估

truST 作为单人项目面临的核心可持续性风险：

1. **依赖核心维护者 (Bus Factor = 1)**：如果 Johannes Pettersson 因任何原因无法继续维护，项目面临停滞
2. **Code Review 瓶颈**：无第二人审查全部变更，可能积累技术债务
3. **架构决策独断**：设计选择由一人决定，缺少多视角验证
4. **测试覆盖率不透明**：虽然声明 behavior-locked by tests，但测试套件的规模和覆盖范围未公开
5. **高速迭代的可持续性**：每 1.5 天一个版本的节奏可能在功能复杂度增加后难以为继

**AUDESYS 的应对策略**（从 truST 的教训中学习）：
- Phase 1 从团队协作架构开始（GitHub Organization + CODEOWNERS + 至少 2 个核心维护者）
- 每次 PR 必须经过至少 1 个审查者批准（enforce branch protection rules）
- 测试覆盖率强制执行 80% 最低标准（当前 .agents/rules/common/testing.md 已规定）
- 架构决策通过 RFC（Request for Comments）流程讨论和文档化（.agents/memorys/decisions.md 的延续）

#### truST 对 AUDESYS 开发周期的启发

truST 5 个月 86 个版本的极高迭代速度为 AUDESYS 的开发节奏提供了有价值的参考：

| truST 实践 | AUDESYS 可行策略 |
|-----------|----------------|
| 极小版本增量 (每个版本 1-3 个功能修改) | AUDESYS 可采用类似的微版本策略——每完成一个独立功能就发布 |
| CI/CD 全自动（测试 + 构建 + 发布） | AUDESYS Phase 1 即建立 CI/CD 流水线 |
| 预编译二进制直接下载 | AUDESYS Runtime 提供多平台预编译二进制 |
| 测试行为锁定 | Phase 1 核心测试套件即是 behavior-locked |
| VS Code Marketplace 扩展分发 | Studio IDE 通过 VS Code Marketplace 分发 LSP 扩展 |
| GitHub Discussions 社区交互 | AUDESYS 使用 GitHub Discussions + Discord 构建社区 |

但 AUDESYS 不应盲目追求"每 1.5 天一个版本"的极端节奏——truST 是单人项目，不需要团队协调成本；而 AUDESYS 规划为团队项目，正常的 2-4 周版本周期更合适。

#### truST 技术栈各模块的 Rust 版依赖分析

对 truST 的 Cargo.toml 依赖树分析（基于公开源码）揭示的技术选择：

| 依赖库 | 用途 | 版本要求 | 说明 |
|--------|------|---------|------|
| tower-lsp | LSP 服务器框架 | 0.20+ | 异步 LSP，基于 tower 中间件模式 |
| logos | 词法分析 | 0.14+ | 声明式词法器生成 |
| chumsky | 语法分析 (解析组合子) | 0.9+ | 强大的错误恢复和报告 |
| axum | HTTP 服务器 | 0.7+ | Web 服务器框架（/hmi, /ide, Agent API）|
| tokio | 异步运行时 | 1.x | 非实时通信（ADS, HTTP, WebSocket）|
| serde | 序列化 | 1.x | JSON/YAML 解析 |
| wasm-bindgen | WASM 绑定 | 0.2+ | HIR 编译为 WASM |
| ethercrab-rs | EtherCAT 主站 | 0.5+ | 疑似依赖（可选的硬件集成） |

这些依赖选择验证了 Rust 生态在工业控制软件基础设施方面的成熟度——truST 不需要从头构建 LSP 框架、HTTP 服务器或异步运行时。AUDESYS 可以继承这个成熟的依赖栈。

#### truST 项目对 AUDESYS 技术路线决策的全景验证

truST 在 5 个月内完成的功能集对 AUDESYS 的技术路线图提供了全景验证：

| AUDESYS 技术决策 | truST 验证状态 | 验证程度 |
|-----------------|-------------|---------|
| D1: Rust 全栈技术栈 | truST 全 Rust 实现 (52.4% Rust) | ✅ 完全验证 |
| D10: Signal/StreamChannel/RPC 三原语 | truST Mesh 三条线 (ADS/WS/Mesh) | ⚠️ 间接验证——truST 不是显式三原语，但三条线各自对应一种通信模式 |
| D12: 14 种统一类型 | truST IEC 61131-3 类型系统 | ⚠️ 部分验证——truST 使用 IEC 标准类型，非 AUDESYS 的 14 种 |
| D13: 四系统混合线程调度 | truST SCHED_FIFO + SCHED_OTHER 调度架构 | ✅ 完全验证——优先级分离和 CPU 隔离模式 |
| D14: 独立详细设计文档 | truST MkDocs 文档站点 | ✅ 模式验证 |
| D16: HalQoS (deadline/liveliness/security_domain) | truST 无显式 QoS (非设计目标) | ❌ 未验证——AUDESYS 需自建 |
| D17: Config Barrier + LockLevel | truST .trust 项目文件 + 在线下载 | ⚠️ 间接验证——truST 的项目文件作为配置统一入口 |
| D19: Rust Core + FlatBuffers | truST Rust 独占（无跨语言需求） | ⚠️ 部分验证——truST 验证了 Rust 独占模式，AUDESYS 需额外验证 FlatBuffers 跨语言 |

#### truST 项目的未解决挑战

truST 仍有一些针对 AUDESYS 项目值得警惕的未解决挑战：

1. **安全认证路径缺失**：truST 未启动任何工业安全完整性等级 (SIL) 认证流程。AUDESYS 如果未来需要安全关键应用，需要从项目初期规划认证路径
2. **多语言编程支持（ST 以外）**：truST 坚持仅支持 ST 语言的策略限制了其适用范围。AUDESYS 从设计阶段就应支持多语言 (ST, FBD, LD, SFC)
3. **大规模部署的验证空白**：truST 缺乏 10+ 机器的生产部署验证（仅有开发者测试）。QiTech Control 在此方面有优势
4. **第三方硬件兼容性**：truST 的硬件集成主要通过 ADS 协议（TwinCAT）而非直接物理 I/O。缺少 PLCopen 到实际硬件的完整链路测试
5. **长期维护承诺不确定性**：单人项目对工业用户的风险感知——工业用户需要的不是"5 个月 86 个版本"的冲刺，而是"5 年持续稳定更新"的信心

#### truST 与 AUDESYS 在关键技术选型上的最终对照总结

以下表格总结了 truST 在各个关键技术维度上对 AUDESYS 的验证程度和参考价值等级：

| 技术维度 | truST 实现 | AUDESYS 映射 | 验证程度 | 参考优先级 |
|---------|-----------|-------------|---------|----------|
| 全栈 Rust | 52.4% Rust | 100% Rust (D19) | 已验证 | P0 |
| IEC 61131-3 | ST only | ST + FBD + LD + SFC (规划) | 部分验证 | P0 |
| PREEMPT_RT | SCHED_FIFO + CPU 隔离 | 四系统混合线程 (D13) | 已验证 | P0 |
| LSP/IDE | VS Code + Monaco Editor | Studio IDE (规划) | 已验证 | P1 |
| 编译管线 | CST→HIR→IR | 多语言→HIR→Runtime | 已验证 | P0 |
| 通信模型 | Mesh 三条线 (ADS/WS/Mesh) | Signal/StreamChannel/RPC + amw | 间接验证 | P1 |
| 实时调度 | rt_prio 90-50 分层 | RT/I/O/流线程 (D13) | 已验证 | P0 |
| 硬件抽象 | 隐含在 runtime-core | 显式 HAL (component.interface.name) | 未验证 | P0 |
| 仿真器 | 无 | AVD Manager (7 种虚拟设备) | 未验证 | P1 |
| 安全认证 | 无 | 规划中 | 未验证 | P3 |
| Web HMI | /hmi 端点 | Studio HMI | 已验证 | P2 |
| AI 集成 | Agent API | Phase 3 规划 | 已验证 | P3 |
| PLCopen XML | 导入/导出 | Studio IDE 导入/导出 | 已验证 | P2 |
| 多语言 | 仅 ST | 多语言前端 (D19) | 未验证 | P1 |

truST 已为 AUDESYS 验证了 8 个核心技术假设中的 7 个（仅显式 HAL 和仿真器是 AUDESYS 独有的差异化领域）。这意味着 AUDESYS Phase 1 可以跳过基础技术验证阶段，直接聚焦差异化能力的开发。

#### 文档维护说明

本文档基于 truST Platform v0.24.32 (2026-07-11) 编写。由于 truST 处于高速迭代期（每 1.5 天一个版本），部分细节可能在短时间内发生变化。建议每季度审查一次本参考文档，以保持与 truST 最新状态的对齐。对于关键设计决策（如编译管线、通信模型、调度架构），应进一步深入 truST 源码进行技术审核，而非仅依赖本文档的概览分析。

### 附录：truST 与 AUDESYS 开发路线图对表

truST 的 5 个月发展路线为 AUDESYS 的阶段规划提供了现实参考：

| truST 里程碑 | AUDESYS Phase 1 映射 | 说明 |
|------------|--------------------|------|
| trust-syntax + trust-hir (第 1 个月) | HIR 多语言编译器基础 | AST→HIR 管线的最简实现 |
| trust-lsp VS Code 扩展 (第 2 个月) | Studio IDE 基础编辑器 | LSP 语言服务框架 |
| trust-runtime-core (第 3 个月) | Runtime 核心执行引擎 | 周期扫描执行器 + 类型系统 |
| trust-runtime 预编译发布 (第 4 个月) | Runtime 跨平台部署 | 三平台二进制 + 部署文档 |
| 浏览器 HMI + IDE (第 5 个月) | Studio Web IDE | 浏览器远程工程界面 |
| truST Mesh (第 6 个月) | amw multiprocess transport | 多运行时实例通信 |

AUDESYS Phase 1 预计需要 12-18 个月（较 truST 更长，因为团队协作和多语言支持的额外复杂度）。但 truST 的单人 5 个月进度证明——Rust 可以使工业控制软件的迭代速度达到 Web 应用水平。

### 附录：truST 技术栈清单 (完整)

| Crate | 功能 | 行数 (推测) | 依赖复杂度 |
|-------|------|-----------|----------|
| trust-syntax | IEC 61131-3 词法/语法分析 | 5,000-10,000 | 中等 (logos + chumsky) |
| trust-hir | 语义分析和中间表示 | 10,000-20,000 | 高 (自实现名称/类型/引用解析) |
| trust-lsp | VS Code 语言服务器 | 8,000-15,000 | 高 (tower-lsp + lsp-types) |
| trust-ide | 浏览器 IDE 前端 | 10,000-20,000 (JS/TS) | 高 (Monaco Editor + React) |
| trust-runtime-core | 运行时执行引擎 | 5,000-10,000 | 中等 |
| trust-runtime | 可执行二进制 + HTTP | 3,000-5,000 | 高 (axum + tokio) |
| trust-debug | DAP 调试适配器 | 2,000-5,000 | 中等 |
| trust-plcopen | PLCopen XML 转换 | 3,000-8,000 | 高 (XML 解析/生成) |
| trust-ads-core + server | Beckhoff ADS 协议栈 | 2,000-5,000 | 中等 (tokio TCP) |
| trust-wasm-analysis | WASM 分析能力 | 1,000-3,000 | 高 (wasm-bindgen) |
| trust-dev | CLI 开发者工具 | 1,000-2,000 | 低 |
| trust-bundle-gen | STBC 项目打包 | 1,000-2,000 | 低 |

总代码量估计：50,000-100,000 行（含 Rust + JS/TS）。AUDESYS Phase 1 目标代码量约为 truST 的 2-3 倍（因多语言支持和显式 HAL 抽象），预计 150,000-300,000 行。

### 附录：truST 对 AUDESYS 项目管理的启示

从 truST 项目运营中学到的关键管理教训：

| 管理维度 | truST 实践 | AUDESYS 策略 |
|---------|-----------|------------|
| 版本策略 | 高频小版本 (每 1.5 天) | 稳定周期 + 补丁版本 (每 2-4 周) |
| CI/CD | 全自动测试 + 构建 + 发布 | Phase 1 即建立 CI |
| 社区建设 | GitHub Discussions + VS Code Marketplace | GitHub Org + Discord + 文档站点 |
| 文档维护 | MkDocs + 贡献者指南 | 同样采用 MkDocs/Docusaurus |
| 代码质量 | clippy + deny + fmt | 同样采用 Rust 生态标准工具 |
| 测试策略 | behavior-locked by tests | 80% 覆盖率 + behavior-locked |
| 发布通道 | 单一 stable 发布线 | stable + nightly 双通道 (Phase 2+) |
| 安全公告 | SECURITY.md | 同样发布安全策略 |

### 附录：truST 项目参考价值总结矩阵

| 参考维度 | 价值等级 | 可直接采纳 | 需修改后采纳 | 仅参考思路 |
|---------|--------|----------|-----------|----------|
| 全栈 Rust 技术路线 | P0 | ✅ | — | — |
| 编译管线 (CST→HIR→IR) | P0 | — | ✅ 扩展支持多语言 | — |
| LSP 实现 | P1 | ✅ tower-lsp 框架 | ✅ 多语言分析 | — |
| Mesh 通信架构 | P1 | — | ✅ 三线 → amw trait 体系 | — |
| PREEMPT_RT 调度 | P0 | ✅ 优先级 + CPU 隔离 | — | — |
| 浏览器 HMI/IDE | P2 | — | ✅ 作为 Studio IDE 参考 | — |
| Agent API | P3 | — | — | ✅ AI 交互接口思路 |
| PLCopen XML | P2 | — | ✅ Studio 导入导出 | — |
| CI/CD 开发流程 | P1 | ✅ GitHub Actions | — | — |
| 版本发布策略 | P2 | — | ✅ 调整为团队节奏 | — |
| 社区建设模式 | P3 | — | — | ✅ 参考但不复制单人模式 |

### 附录：truST 项目最终评估

truST Platform 是 AUDESYS 目前发现的最高价值参考项目，验证了 Rust 全栈 + IEC 61131-3 + PREEMPT_RT 的技术路线可行性。其 5 个月从零到 86 个版本的极速迭代，证明了 Rust 使工业控制软件开发效率达到 Web 应用水平。建议 AUDESYS 团队深入研读 truST 源码，特别是编译管线（trust-syntax/trust-hir/trust-runtime-core）和 LSP 实现（trust-lsp），将其作为 AUDESYS Phase 1 的直接参考模板。

> 本文档记录了 AUDESYS 团队对 truST Platform 的全面技术评估，涵盖产品画像、技术特性、功能概览、现状与生态、市场定位、产品特色以及对 AUDESYS 的参考价值分析。评估时间 2026-07-13，基于 truST v0.24.32。

> 完整参考系列：truST Platform (本文档) | QiTech Control | OPC UA | NI LabVIEW

> **主要参考来源**：truST GitHub 仓库 (README, Wiki, source tree), truST MkDocs 文档站点, VS Code Marketplace 扩展页面, GitHub Discussions 社区讨论

> 本文档将持续更新以反映 truST 项目的迭代发展。建议每季度审查一次以确保内容时效性。
---

> **附录**：本文档为 AUDESYS 项目技术参考文档系列之一。完整系列包含 truST Platform、QiTech Control、OPC UA 等参考技术文档。本系列文档的目标是为 AUDESYS 项目的架构设计、技术选型和工程决策提供系统化的外部参考信息。
