# AUDESYS 架构决策

## D1: 项目命名规范 = AUDESYS
- **日期**: 2026-07-08
- **决定**: 全大写 `AUDESYS`，npm scope 用 `@audesys/`
- **理由**: 与 `package.json`（name="AUDESYS"）和 git remote 一致

## D2: 缺失依赖文件 = 移除引用
- **日期**: 2026-07-08
- **决定**: 从 SKILL.md 和 agent-guide.md 中删除对不存在文件的引用
- **理由**: 技能/指南应自包含，不依赖外部文件
- **影响的引用**: `docs/MODACS-Design.md` (14x)、`packages/ui/src/styles/theme.css` (4x)、`docs/MODACS-AI-Dev.md`、`~/.omo/teams/modacs-dev/config.json`

## D3: architecture.md 历史引用 = 完全去 MODACS 化
- **日期**: 2026-07-08
- **决定**: 移除所有 MODACS 历史叙述，重写为独立项目文档
- **理由**: 不应保留任何 MODACS 痕迹

## D4: .agents/rules/ 通用规则 = 仅扫描确认
- **日期**: 2026-07-08
- **决定**: 89 个规则文件已验证零 MODACS 引用，不做修改
- **理由**: 文件不含 MODACS 字样，通用开发规则与项目名无关

## D5: design-system SKILL.md = 保留并重品牌
- **日期**: 2026-07-08
- **决定**: 保留设计系统技能，重新品牌为 AUDESYS
- **理由**: AUDESYS 是工业控制平台，需要 UI 一致性

## D6: architecture.md = 骨架占位
- **日期**: 2026-07-08
- **决定**: 去 MODACS 化后内容不足 50% 的章节用 `TODO: 为 AUDESYS 重写此节` 占位
- **理由**: 保留有效技术内容，标记需重写的章节

## D7: agent-guide.md = 精简为空项目指南
- **日期**: 2026-07-08
- **决定**: 简化为匹配 AUDESYS 当前空项目状态
- **理由**: 移除 MODACS 7 阶段工作流、不存在的路径引用

## D8: D4 规则 = 无操作仅扫描
- **日期**: 2026-07-08
- **决定**: 确认性 grep 扫描，预期无修改
- **理由**: 89 个文件已确认零 MODACS 残留

## D9: @modacs/* 命名空间 = 移除引用
- **日期**: 2026-07-08
- **决定**: 移除所有 `@modacs/*` 引用，不替换为 `@audesys/*`
- **理由**: AUDESYS 尚无自己的包命名空间

## D10: HAL 通信原语 = Signal / StreamChannel / RPC 三分法
- **日期**: 2026-07-09
- **决定**: 用三种正交原语覆盖四种系统（LinuxCNC / OpenPLC / ROS2 / dora-rs）的全部通信模式，不引入第 4 种
- **理由**: Signal（单写多读最新值覆盖）与 StreamChannel（多写多读有缓冲队列）不可合并——ROS2 十年教训
- **参考**: `docs/modules/hal/hal-protocol-design.md`

## D11: amw 中间件抽象层 = HalTransport + HalDiscovery + HalQoS
- **日期**: 2026-07-09
- **决定**: 参考 ROS2 rmw 模式，定义 amw（AUDESYS Middleware）三极 trait，传输/发现/QoS 实现可替换
- **理由**: 不绑死 Zenoh/DDS/MQTT，换实现不换 API。Phase 1 用 amw_inproc，Phase 2+ 用 amw_zenoh
- **参考**: `docs/modules/hal/amw-middleware-design.md`

## D12: 统一类型系统 = 14 种
- **日期**: 2026-07-09
- **决定**: 11 种标量（Bool/S8/U8/S16/U16/S32/U32/S64/U64/F32/F64）+ String + Blob + Array<T>
- **理由**: 覆盖 IEC 61131-3 全部类型（TIME/DATE/TOD/DT 映射到现有数值类型），WSTRING 不引入（UTF-8 only），Blob 不进类型推导
- **参考**: `docs/modules/hal/iec-type-system-design.md`

## D13: 四系统混合线程调度
- **日期**: 2026-07-09
- **决定**: RT 线程 = LinuxCNC 显式函数列表 + ROS2 control 的 read→update→write 管线 + OpenPLC 扫描屏障 + dora-rs 事件驱动 I/O 线程
- **理由**: 三类执行需求（硬实时控制 / I/O 通信 / 流数据）不能放进同一个调度模型
- **参考**: `docs/modules/hal/thread-scheduling-design.md`

## D14: HAL 详细设计 = 模块化子文档（修订）
- **日期**: 2026-07-09（原始），2026-07-15 修订
- **决定**: HAL 详细设计维护为 `docs/modules/hal/` 目录下 18 份独立子文档，不再合并为单文档。`architecture.md` 按主题引用对应子文档。
- **理由**: 子文档独立维护降低修改冲突，每份文档聚焦一个设计主题，可独立审核和更新。
- **参考**: `docs/modules/hal/`（18 份子文档，覆盖 17 个设计主题）

## D15: 文档目录结构 = modules/hal/ 子目录（修订）
- **日期**: 2026-07-09（原始），2026-07-15 修订
- **决定**: 设计文档放入 `docs/modules/{module}/` 子目录，每个子文档独立维护
- **理由**: 减少单文件膨胀，按主题粒度组织；每份文档可被独立引用和版本追踪
- **当前结构**: `docs/modules/hal/` 含 18 份子文档

## D16: 工业 QoS 三层执行
- **日期**: 2026-07-09
- **决定**: Deadline 在 RT 数据面（amw 内部同周期 tick 触发）、Liveliness 在控制面（Zenoh 原生）、Security Domain 在配置面（静态 keyexpr 标记）
- **理由**: 不同维度的执行时间和可靠性要求不同，不能全放进 RT 线程
- **参考**: `docs/modules/hal/industrial-qos-design.md`

## D17: Config Barrier + LockLevel
- **日期**: 2026-07-09
- **决定**: 所有配置变更排队到 RT 周期边界批量应用（Config Barrier），LockLevel 从运行时锁变更为配置权限分级
- **理由**: 多进程 Supervisor 可能随时发 RPC，不能依赖 LinuxCNC 式的开发者自觉。Run 级别拒绝所有 RPC
- **参考**: `docs/modules/hal/config-barrier-design.md`

## D18: HAL 协议设计 = 团队审核驱动
- **日期**: 2026-07-09
- **决定**: HAL 协议设计经 3 人团队（LinuxCNC 实时 / ROS2 中间件 / IEC 61131-3 软PLC）并行审核，共 27 项发现，全部逐项交互确认
- **理由**: 多视角交叉验证，避免单领域盲点
- **审核范围**: CRITICAL 7 / HIGH 8 / MEDIUM 8 / LOW 4

## D19: 多语言策略 = Rust Core + FlatBuffers
- **日期**: 2026-07-09
- **决定**: RT 数据面 Rust 独占（< 1μs），I/O 通信 Rust + C++ FlatBuffers over UDS（~10μs），控制面/HMI 15 种语言 FlatBuffers over Zenoh（~100μs）
- **理由**: SCHED_FIFO 线程需要无 GC/无 JIT/无异步运行时，仅 Rust 满足。C++ FFI 桥接限非 RT 线程。FlatBuffers 作为统一跨语言序列化格式
- **参考**: `docs/modules/hal/multi-language-strategy.md`

## D20: 参考文档库 = 41 篇竞品分析（含两轮扩展，22→41）
- **日期**: 2026-07-13
- **决定**: 建立 `docs/reference/` 参考文档库，覆盖 12 大类别 41 个工业自动化产品/项目（原 22 篇，2026-07-15 扩展至 41 篇）
- **理由**: 为 AUDESYS HAL/Studio/Runtime 设计提供竞品架构参考，避免闭门造车。每篇含"对 AUDESYS 参考价值"章节，直接将竞品架构映射到 AUDESYS 设计
- **覆盖范围**: DCS（中控/和利时/Honeywell/Emerson）、软PLC（truST/QiTech/OpenPLC）、SCADA/组态（Ignition/KingView/FUXA/InTouch/LabVIEW）、仪器仪表/通信（HART/FF/PROFIBUS/OPC UA/RuSTy）、IDE/平台（CODESYS/Qtouch/Beckhoff/Siemens）、机器人/数据流（ROS2/dora-rs/LinuxCNC）、3D打印机固件（Klipper/Marlin/Smoothieware/RepRapFirmware）、CNC控制器（Machinekit/GRBL/GRBLHAL/LinuxCNC-STM32）、FPGA运动控制卡（Pico-PPMC/RMC）、MCU智能固件（SimpleFOC/FluidNC）、现场总线协议栈（Beremiz/Forklift-PLC/4diac-FORTE/SOES/IgH EtherCAT/CANopenNode/CANfestival）
- **文档格式**: 统一 7 章节（产品画像、技术特性、功能概览、现状与生态、市场定位、产品特色、对AUDESYS参考价值），≥800 行，中文撰写，技术术语保留英文原文

## D21: Studio IDE 技术栈 = Tauri + React + TypeScript
- **日期**: 2026-07-13
> ⚠️ **已弃用** — 此决策于 2026-07-21 被 D71 取代。Studio 已从 Tauri+React 迁移到 Eclipse Theia。
- **决定**: AUDESYS Studio 使用 Tauri (Rust 后端) + React + TypeScript 构建桌面 IDE。Phase 2 增加 PWA 辅助访问。CI/CD 同时验证 macOS/Windows/Linux 三平台 Playwright E2E 测试。
- **理由**: Tauri Rust 后端与 HAL 开发语言一致，包体积（~5-10MB）远小于 Electron（~120MB），内存占用（~50MB）远低于 Electron（~150MB）。工业 HMI 以表单/图表/SVG 为主，跨平台 WebView 差异（≤3% 像素级）不影响核心功能。
- **参考**: Beckhoff TwinCAT 3 (VS Shell 不自研 IDE 的模式验证), Ignition Perspective (Web 原生可行性验证), QiTech Control (Electron→Tauri 迁移趋势验证)

## D22: IEC 61131-3 编译器策略 = Phase 1 RuSTy + Phase 2 HAL IR + Phase 3 完全自研
- **日期**: 2026-07-13
- **决定**: Phase 1 使用 RuSTy 编译 ST 源码，通过 HAL Binding Generator 映射到 HAL 原语。Phase 2 自研 ST 前端 + HAL IR（稳定接口），后端仍用 RuSTy LLVM。Phase 3 完全自研（包含 LLVM 后端），HAL IR 不变。
- **理由**: Phase 1 最快验证 HAL 设计。HAL IR 作为稳定接口在后端可随时替换（RuSTy→LLVM→WASM），用户 ST 代码零感知。CODESYS 经验警告完整编译器需数十年，分阶段演进是务实策略。
- **参考**: RuSTy（Rust+LLVM IEC 61131-3 编译器）、truST（CST→HIR→IR 管线验证）、CODESYS（数十年编译器投入警示）

## D23: Phase 1 协议适配范围 = Modbus RTU/TCP + HART 有限集
- **日期**: 2026-07-13
- **决定**: Phase 1 仅适配 Modbus RTU/TCP 和 HART 有限集。Phase 2 增加 OPC UA Gateway，Phase 3 增加 EtherCAT。
- **理由**: Modbus 覆盖 60%+ 设备（libmodbus FFI 1人月），HART 一通道多Pin 验证 HAL。OPC UA open62541 50万行C 不应进入 RT 路径。EtherCAT 需 PREEMPT_RT+专用网卡，推后至 Phase 3。
- **参考**: SUPCON ECS-700、QiTech ethercat-hal、OPC UA 参考文档 §7.6

## D24: 配置格式 = 开发 YAML + 运行时 FlatBuffers
- **日期**: 2026-07-13
- **决定**: 开发阶段使用 YAML 作为人类可读配置格式，构建时编译为 FlatBuffers 二进制，运行时零拷贝加载。
- **理由**: YAML 人类可读+Git友好（开发体验），FlatBuffers 零拷贝+零堆分配（L1 RT路径兼容）。与 D19 多语言策略一致（FlatBuffers 支持15种语言）。
- **参考**: HAL 多语言策略 D19、FUXA JSON 项目文件、LabVIEW .vi 二进制教训（Git不可diff）

## D25: Studio 编程模式 = Phase 1 ST Only + HMI 可视化设计器
- **日期**: 2026-07-13
- **决定**: Phase 1 仅支持 ST 文本编程和 HMI 可视化设计。Phase 2 增加 FBD 编辑器（FBD→ST 转换器复用编译管线）。永不追求 5 语言全覆盖。
- **理由**: ST 是 RuSTy（D22）唯一支持的语言。FBD 编辑器需 6-12 人月。CODESYS 核心模式——所有图形语言编译为 ST 内部表示——为 Phase 2 扩展提供清晰路径。
- **参考**: CODESYS（FBD/LD/SFC→ST）、Beckhoff（4种语言）、FUXA（Web SVG HMI）、LabVIEW（Git 不兼容教训）

## D26: 脚本/扩展策略 = Phase 1 YAML Only + Phase 2 WASM + Python (非RT)
- **日期**: 2026-07-13
- **决定**: Phase 1 不提供脚本/扩展语言（仅 YAML 配置 + ST 编程）。Phase 2 引入 WASM 插件系统（语言无关安全沙箱）+ Python bindings（仅非RT数据处理路径）。
- **理由**: Phase 1 聚焦核心（HAL+Runtime+Studio 骨架），避免早期锁定特定语言运行时。Ignition Jython 锁死 Python 2.7 的教训警示：切勿在 Phase 1 绑定特定脚本语言。
- **参考**: Ignition Jython（10年技术债）、dora-rs PyO3、RuSTy WASM

## D27: HalQoS 安全域 = 层级化标签
- **日期**: 2026-07-13
- **决定**: HalQoS security_domain 从平面标签升级为 `{level}.{domain}.{subdomain}` 层级化标签，支持通配匹配。
- **理由**: Honeywell CEE 分区控制模型需要层级化表达，编译时展开为位掩码零 RT 开销。
- **参考**: Honeywell CEE、IEC 62443

## D28: StreamChannel 冗余 — Phase 1 预留 trait，不实现
- **日期**: 2026-07-13
- **决定**: StreamChannel 协议预留 `redundancy` 字段（`none` / `dual_link` / `n_plus_1`），Phase 1 仅支持 `none`，Phase 2+ 实现 `dual_link`。
- **理由**: 冗余是 amw 实现细节而非 HAL 协议一部分（审核结论）。SUPCON ECS-700 和 Honeywell FTE 验证双链路需求。预留 trait 避免 Phase 2 协议变更破坏 Phase 1 代码。
- **参考**: SUPCON ECS-700（1:1 热备）、Honeywell FTE（双网冗余）

## D29: 部署策略 = Phase 1 Docker + PREEMPT_RT
- **日期**: 2026-07-13
- **决定**: Phase 1 使用 Docker + PREEMPT_RT 脚本部署，Phase 2 评估 NixOS（参考 QiTech 验证模式）。
- **理由**: Docker 最广泛使用 + CI/CD 成熟。QiTech 证明 NixOS 在生产工厂可用（10+台），但增加 Phase 1 团队学习成本。
- **参考**: QiTech Control（NixOS 生产部署验证）

## D30: 测试基础设施 = Phase 1 三层 QA（dora-rs 模式）
- **日期**: 2026-07-13
- **决定**: 采用 dora-rs 三层 QA 体系：qa-fast/qa-full/qa-deep。Phase 1 不要求 80% 覆盖率（代码驱动阶段再要求）。
- **理由**: dora-rs 验证此模式在 Rust 项目中的实用性。Miri UB 检测对 RT 代码安全至关重要。
- **参考**: dora-rs 三层 QA、Miri UB 检测、loom 并发测试
## 实施防护规则
- **G1**: architecture.md 内容完整性 — 删除后保留率 <50% 的章节变为 TODO 占位符
- **G2**: 删除后文本连贯性 — 无指向已删除 MODACS 上下文的孤立引用
- **G3**: @modacs/* 不自动替换 — 仅移除
- **G4**: 每次修改后运行不区分大小写的 `grep -ri modacs` 验证
- **G5**: HAL 详细文档在 `docs/modules/hal/` 目录下各子文档独立维护，architecture.md 按主题引用对应子文档

## D31: 集成化实施路线图 = 统一里程碑表
- **日期**: 2026-07-13
- **决定**: HAL 8 阶段 + Studio 4 阶段 + Runtime 分阶段统一编排为一个里程碑表，标注每阶段的模块交互点和依赖关系
- **理由**: 当前三套阶段计划各自独立，无统一时间线、无并行构建分析、无里程碑交叉引用
- **参考**: dora-rs GitHub Projects + milestones 跨模块发布管理模式

## D32: Phase 0 启动策略 = CI 先行（基础设施优先）
- **日期**: 2026-07-13
- **决定**: 在 Phase 1 代码编写之前，先搭建 cargo workspace + CI/CD（qa-fast 三层门禁）+ 测试框架骨架
- **理由**: 测试基础设施是 TDD 的前提。dora-rs 证实 cargo workspace 初始化 + CI 搭建仅需 1-2 天
- **参考**: dora-rs qa 策略、rust-template workspace 骨架

## D33: SDD→TDD 过渡方法论 = 直接 TDD（修订）
- **日期**: 2026-07-13（原始），2026-07-13 修订
- **决定**: 放弃 Ludwig v0.1 alpha，采用标准 Rust 测试 + AAA 模式直接从设计规范提取测试场景
- **理由**: Ludwig v0.1 alpha（19 commits、1 维护者 bus factor=1、无 crates.io 发布、no-proptest yet）不满足生产级工具链可靠性要求。规范驱动开发增加中间产物维护成本（9 份 .md 文件），直接 TDD 提供同等可追溯性（// 来源注释）无工具风险。优先级 A 测试（类型系统 + HalQoS + Config Barrier）约 26 个纯逻辑测试在 HalTransport trait 定义前独立可测
- **参考**: .agents/rules/common/testing.md（AAA 模式、80% 覆盖率、TDD 工作流）、`docs/modules/hal/` 各子文档（测试场景提取源）、欧洲 XFEL 虚拟 PLC 验证模式（Phase 2 参考）
- ~~**决定**: 使用 Ludwig（github.com/samdvr/ludwig）将 Markdown 设计规范自动转换为 Rust test stubs~~ *[已于2026-07-13废弃，见上方修订]*
- ~~**理由**: 三层验证（结构性→确定性→判断性）最适合当前文档驱动状态。手工从 8 份设计规范编写测试会遗漏边界情况~~
- ~~**参考**: Ludwig 三步验证模型、SpecDD 源邻规范模式、SDD 分类学（arXiv 2602.00180）~~

## D34: 模块构建顺序 = hal-core 驱动并行
- **日期**: 2026-07-13
- **决定**: Phase 0 完成后，hal-core + amw_inproc + hal-flatbuffers + CI 测试基础设施四件同时启动
- **理由**: hal-core 作为依赖树根节点。amw_inproc 和 hal-flatbuffers 依赖 hal-core 但彼此独立
- **参考**: Cargo workspace 依赖分析、dora-rs 多 crate 并行模式

## D35: Cargo Workspace 结构 = 标准布局
- **日期**: 2026-07-13
- **决定**: 虚拟 workspace manifest + crates/（Rust）+ apps/studio/（Tauri）+ scripts/qa/（CI）+ tests/（集成测试）
- **理由**: 虚拟 workspace 避免根 crate。apps/studio/ 独立 pnpm workspace 与 Rust 解耦
- **参考**: Rust Book §14.3、rust-template、dora-rs 仓库布局

## D36: CI/CD 流水线 = 渐进式三层 QA
- **日期**: 2026-07-13
- **决定**: Phase 0: qa-fast（fmt+clippy+test+deny+unwrap-budget）。Phase 1 中期: qa-full（coverage+mutants+semver）。Phase 2: qa-deep（miri+proptest+adversarial LLM）
- **理由**: dora-rs 验证突变测试是最高价值门禁（检测同义反复测试）。unwrap-budget ratchet 防止 panic 累积
- **参考**: dora-rs qa-poc-report-2026-04-09

## D37: SCHED_FIFO 测试策略 = 分阶段（逻辑层→RT 层）
- **日期**: 2026-07-13
- **决定**: Phase 1 仅测试纯逻辑层（hal-core 无硬件依赖，标准 CI）。Phase 2 PREEMPT_RT runner + qa-deep 验证 RT 确定性
- **理由**: 嵌入式 Rust 社区三层层分离模式已被验证。SCHED_FIFO 线程无法在标准 CI runner 运行
- **参考**: Testable Embedded Rust (datenkollektiv.de)、欧洲 XFEL 虚拟 PLC 模式、RTIC SRP

## D38: Studio 集成时机 = 并行 + 渐进对接
- **日期**: 2026-07-13
- **决定**: Studio 基础设施与 HAL 并行启动，编辑器按 HAL 阶段逐步对接
- **理由**: Studio Core/注册表/项目 CRUD 不依赖 HAL。Scene Designer→Phase 2、Panel→Phase 3、Logic Designer→Phase 2
- **参考**: architecture.md §三 Studio 演进路线

## D39: FlatBuffers Schema = .fbs 手写 + flatc 生成
- **日期**: 2026-07-13
- **决定**: 手写 .fbs schema 作为跨语言 source of truth，flatc 自动生成所有语言绑定
- **理由**: flatc 是官方工具链，保证跨语言一致性。Rust proc macro 反向生成缺乏成熟工具链
- **参考**: Google FlatBuffers 官方文档、dora-rs Arrow Schema 模式、ROS2 .idl 模式

## D40: 发布策略 = Phase 2 v0.1.0 起步
- **日期**: 2026-07-13
- **决定**: Phase 1 内部开发不发布。Phase 2 移植验证后 v0.1.0
- **理由**: Phase 1 产出是内部基础设施。Phase 2 移植验证后 HAL 对外可用
- **参考**: Semantic Versioning 2.0.0

## D41: 开发流程 = 沿用现有规则 + D30 CI 门禁
- **日期**: 2026-07-13
- **决定**: .agents/rules/common/ 通用流程 + D30 三层 QA 作为 CI 门禁
- **理由**: 89 个规则文件已验证完整，覆盖 TS/Rust 规范、TDD、code review、安全、Git 工作流
- **参考**: .agents/rules/ 89 个文件、development-workflow.md、testing.md

## D42: MCP 工具链策略 = 分阶段启用，按需加载
- **日期**: 2026-07-14
- **决定**: 移除 3 个前端 MCP（shadcn、tailwind、lucide — 零前端代码阶段无价值），保留 7 个核心 MCP：remote-qt-docs、codegraph、playwright、github、openspace（新启用）、memory（禁用）、postgres（禁用）。Phase 1 前端开发时再评估前端 MCP
- **理由**: 零源代码阶段前端 MCP 无实际产出。7 个核心 MCP 覆盖文档查询、代码图谱、浏览器测试、开源搜索、AI 开发辅助、记忆系统、数据库
- **参考**: agent-guide.md §5.6、opencode.json mcp 配置

## D43: AI 辅助工具集成 = Plugin（ponytail）+ MCP（openspace）
- **日期**: 2026-07-14
- **决定**: ponytail 作为 OpenCode plugin 集成（`@dietrichgebert/ponytail`），每次推理自动注入防过度工程规则。OpenSpace 作为开发辅助 MCP 启用，需 Python 3.11+ + API Key
- **理由**: ponytail plugin 方式与现有 superpowers/oh-my-opencode 一致。OpenSpace（AI agent 技能进化引擎）作为辅助开发工具启用，不进入 AUDESYS 核心架构
- **参考**: opencode.json plugin 数组、init-mcp-openspace.mjs

## D44: D14/D15 逆转 = hal-detailed-design.md 拆分为 19 份独立子文档
- **日期**: 2026-07-15
- **决定**: 逆转 D14/D15，删除合并文档 hal-detailed-design.md（3386行），保留并扩展 docs/modules/hal/ 下 19 份独立子文档。architecture.md §一 按主题引用子文档。
- **理由**: 子文档独立维护降低修改冲突。合并操作不可逆（丢失独立文档的编辑历史），实际修改中发现子文档模式更利于并行编辑。7 份缺失子文档从合并文档提取完成。
- **参考**: docs/modules/hal/（19 份子文档，覆盖 17 个设计主题），architecture.md §一
## D45: Runtime 设计文档 = IPC 安全 + 可观测性 + 硬件 + 升级
- **日期**: 2026-07-15
- **决定**: Phase 1 前必须有 Runtime 设计文档覆盖：IPC 安全(495行)（UDS+HMAC，Zenoh mTLS，RBAC），可观测性（health/metrics/logs/alerts + AmwMetrics），硬件需求（三档规格 + PREEMPT_RT checklist），升级策略(282行)（schema版本/迁移/hot-swap/OTA/rollback）
- **理由**: 50 项文档审计发现 Runtime 运维/安全/升级三个关键缺口（3 CRITICAL），这些缺口会阻断 Phase 1 生产部署。
- **参考**: docs/modules/runtime/ 4 份设计文档，架构审计 gap-optimizer 报告
## D46: HAL 错误模型设计 = 5 层分类 + 状态机
- **日期**: 2026-07-15
- **决定**: 新建 docs/modules/hal/error-model-design.md（564行），覆盖 5 层错误分类（类型/传输/资源/发现/调度）、Signal 写入失败拒绝策略、StreamChannel 溢出恢复 + 熔断、传输断开 4 态机、类型不匹配检测、SlidingWindowCounter 升级路径。
- **理由**: 审计发现错误模型覆盖仅 40%（StreamChannel+QoS已覆盖，Signal写失败/传输断连/类型不匹配完全缺失）。
- **参考**: docs/modules/hal/error-model-design.md，架构审计 gap-optimizer 报告 H4
## D47: doc-audit 技能 = 持续文档审计管道
- **日期**: 2026-07-15
- **决定**: 新建 .agents/skills/doc-audit/SKILL.md（242行），支持 6 维度审计：决策验证/文档一致性/参考验证/缺口优化/阶段审计(SDD+TDD+计划)/代码→规范追溯(Phase 1+)。支持团队模式（4-6 ultrabrain）和背景代理模式。提供 /doc-audit full/quick-fix/phase/decisions/consistency 命令。
- **理由**: 50 项交互式审计验证了多视角并行审计模式的有效性。将审计流程固化为可复用技能，确保每次文档变更后可持续审计。
- **参考**: .agents/skills/doc-audit/SKILL.md，审计报告 b73 区块
## D48: SDD 规范生成 = 设计文档→测试规范自动化管道
- **日期**: 2026-07-15
- **决定**: 从 4 份 HAL 设计文档提取 121 项规范（openspec/specs/）：类型系统(30)、HalQoS(30)、Config Barrier(24)、协议(37)。每项规范含 ID→前置条件→操作→期望结果→边界条件→测试映射。Pair-writing 团队 4 人并行生成。
- **理由**: 为 Phase 0 M0.3 直接 TDD 做准备。规范可直接转写为 Rust #[test] 函数，AAA 模式已预结构化。优先级 B 规范（Scan Barrier、线程调度）等 Mock trait 定义后按需生成。
- **参考**: openspec/specs/ 4 份规范文档，SDD 汇总 b68-b70 区块
## D49: 50 项审计修复流程 = 交互审核 + 团队模式 + 批量执行
- **日期**: 2026-07-15
- **决定**: 50 项审计发现采用交互式逐项审核（question() 确认），CHAT/团队模式并行修复（doc-fixers 3人团队 + 2 background agents），12 commits 原子提交。
- **理由**: 批量自动修复不可靠（文档编辑需人类判断）。交互审核保证每项修复方案经确认。团队 + background 并行最大化吞吐。12 次原子提交确保每项逻辑变更独立可审计。
- **参考**: 审计报告 b73 区块，提交记录 7d72c90..aadcb3e
## D50: test-harness 技能 = 多语言自动化测试工具架
- **日期**: 2026-07-15
- **决定**: 新建 .agents/skills/test-harness/SKILL.md（447行），支持 6 种交互模式：SDD→测试生成 (stubs/AAA骨架/完整填充 三层)、测试→规范反向追溯、用例执行与修复、增量测试 (git diff)、项目测试基础设施初始化、覆盖率报告。覆盖 5 种语言 (Rust/TS/Python/C++/C)。Phase 感知：自动跳过未就绪模块。
- **理由**: SDD 121 项规范缺乏自动化转写管道。模式 1 (SDD→测试) 直接解决 D33 直接 TDD 的测试生成瓶颈。多语言支持匹配 D19 策略。Phase 感知避免生成不可运行的测试。
- **参考**: .agents/skills/test-harness/SKILL.md，openspec/specs/ 4 份规范文档

## D51: 技能库扩展 = skill-creator + 7 Studio 参考技能
- **日期**: 2026-07-15
- **决定**: 新增 skill-creator（从 webrtc-kit 移植，适配 AUDESYS HAL/FlatBuffers/Rust）和 7 个 Studio 参考技能（ref-codesys/ref-beckhoff/ref-qtouch/ref-ignition/ref-fuxa/ref-intouch/ref-labview）
- **理由**: skill-creator 支持从 HAL traits/SDD specs/FlatBuffers schemas/Cargo crates 自动生成技能。7 参考技能为 Studio IDE 设计提供竞品参考（D21/D22/D25）
- **参考**: .agents/skills/skill-creator/SKILL.md，.agents/skills/ 下 7 个 ref-* 技能目录

## D52: 参考模式缺口识别 = 41 篇竞品交叉验证
- **日期**: 2026-07-15
- **决定**: 41 篇竞品交叉验证识别 3 CRITICAL（OPC UA 内置、Web-first HMI、模板驱动 HMI）+ 6 HIGH（数字孪生、多人工程、包管理器、诊断链、CEE 容量模型、PLCopen XML）+ 8 MEDIUM 模式缺口。CRITICAL 项列入 Architecture 待评估，HIGH 项列入 Phase 2+ 路线图。
- **理由**: 避免闭门造车，确保 AUDESYS 不与工业主流实践脱节。
- **参考**: docs/reference/ 41 篇竞品分析，模式缺口报告

## D53: Phase 0 完成定义修订 = CI 就绪，crate 骨架 Phase 1 M0.3
- **日期**: 2026-07-15
- **决定**: Phase 0 "P0 基础设施就绪" 仅指 CI/CD 管道（qa-fast 5 门禁全绿）。amw_inproc 和 hal-flatbuffers crate 骨架属于 Phase 1 M0.3（hal-core 驱动并行）。hal-core 当前仅有 trait stubs（HalCoreLinked token），实际 HalTransport/HalDiscovery/HalQoS 在 Phase 1 M0.3 定义。
- **理由**: status.md 的 "P0基础设施就绪" 与 D34 "Phase 0 完成后四件同时启动" 存在歧义——澄清 Phase 0 = CI 就绪，Phase 1 M0.3 = crate 骨架 + trait 定义。
- **参考**: D30 三层 QA、D32 CI 先行策略、D34 模块构建顺序

## D54: 技能移植 = 7 项 openspec 技能从 webrtc-kit 增强
- **日期**: 2026-07-15
- **决定**: 从 webrtc-kit 项目对比分析移植 7 项增强：skill-creator 新建（HAL trait/SDD spec/FlatBuffers/Cargo crate 四种输入源），test-harness 新增 Mode 7 选择性测试运行（git diff → cargo test -p），openspec-propose 结构化升级（强制名称确认+上下文收集+layer/backend 评估+结构化模板），openspec-apply TDD 支持（test-first 执行+7 门禁验证+spec 交叉引用+规则层级），doc-audit 三项增强（孤立测试检测+决策新鲜度+CROSS-CHECK.md），openspec-verify 交叉层验证（spec 一致性检查+孤立测试检测），openspec-explore 4-source 知识源模型（Specs/Design Docs/Project Memory/Codebase）
- **理由**: webrtc-kit 技能在结构化程度、验证严密性和知识组织方面优于 AUDESYS 原有版本。并行移植 7 项实现技能库同步升级。
  - **参考**: .agents/skills/ 下 7 个 openspec 技能文件，webrtc-kit/.agents/skills/ 对比分析

## D55: CNC 系统策略 = G-code→HAL IR 编译器 + 运动规划器 + 轴组
- **日期**: 2026-07-19
- **决定**: AUDESYS CNC 系统分为三个构件：G-code 编译器（第 6 种源码语言，与 ST/IL/LD/FBD/SFC 并列）、运动规划器（梯形/S曲线速度剖面，Phase 1 逐周期步进，Phase 2 Runtime 协处理器）、轴组（坐标系统、回零、软限位、反向间隙）。采用 LinuxCNC 4 层模型作为主参考架构（UI→Task→Motion→HAL），GRBL 逐周期步进作为 Phase 1 运动实现参考，Klipper 分布式 Host/MCU 模型作为 Phase 2+ 架构参考，TwinCAT CNC PLC+CNC 统一作为产品愿景参考。
- **理由**: CNC 是 AUDESYS tier-1 应用场景，HAL 已预留 motion.axis.N.pos Signal 约定。以最低架构开销建立 G-code 编译管道，后续运动规划器、插补引擎、运动学模型渐进叠加。G-code 编译器作为第 6 种源码语言与现有 5 种 IEC 61131-3 编译器共享 HalProgram 后端，零 VM 变更。
- **参考**: `docs/modules/cnc/` 4 份设计文档，`docs/modules/cnc/cnc-reference-models.md`，`.sisyphus/plans/add-gcode-compiler/`

## D56: IEC 61131-3 编译器策略偏差 = RuSTy→直接自研
- **日期**: 2026-07-19
- **决定**: 记录 D22 决策与实际实现的偏离。D22 原定 Phase 1 使用 RuSTy（Rust+LLVM IEC 61131-3 编译器）编译 ST 源码，HAL Binding Generator 映射到 HAL 原语。实际实现路径：直接自研 5 种 IEC 61131-3 编译器（ST/IL/LD/FBD/SFC），全部编译到 HalProgram 后端，零外部依赖。
- **理由**: RuSTy 评估后发现集成复杂度高于自研。自研编译器与 HAL IR/VM 共享类型系统，接口零摩擦。CODESYS 的「所有图形语言编译为 ST 内部表示」模式已通过 LD→IL→HalProgram 两步转换实现，完全等价。
- **参考**: D22, `crates/audesys-st-compiler/`, `crates/audesys-il-compiler/`, `crates/audesys-ld-compiler/`, `crates/audesys-fbd-compiler/`, `crates/audesys-sfc-compiler/`

## D57: Studio 编程模式偏差 = ST Only→6 语言全实现
- **日期**: 2026-07-19
- **决定**: 记录 D25 决策与实际实现的偏离。D25 原定 Phase 1 仅支持 ST 文本编程和 HMI 可视化设计，Phase 2 增加 FBD 编辑器（FBD→ST 转换器复用编译管线）。实际实现路径：Phase 1 即完成 5 种 IEC 61131-3 语言（ST/IL/LD/FBD/SFC）全实现，外加 G-code 编译器作为第 6 种源码语言。
- **理由**: 编译器实现速度超出预期（D22 自研决策降低摩擦）。FBD 编辑器（@xyflow/react 流程图→IL 文本）意外发现实现简单（~200 行转换逻辑），无需等待 Phase 2。CNC 需求推动 G-code 编译器作为额外语言加入管线，与 5 种 IEC 语言共享 HalProgram 后端。
- **参考**: D25, `crates/audesys-gcode-compiler/`, `docs/modules/cnc/gcode-compiler-design.md`

## D58: Studio 插件架构 = PluginRegistry + CommandRegistry + PlatformAdapter + PanelSystem
- **日期**: 2026-07-19
- **决定**: AUDESYS Studio 采用四层插件架构。参考 VS Code Extension API（activate/deactivate 模式、25 种 activationEvents、20+ 种 Contribution Points），但 P1 仅实现核心：PluginRegistry (Manifest Scan + Lifecycle)、CommandRegistry (37 命令 7 命名空间)、PanelSystem (PanelDescriptor 布局引擎)、PlatformAdapter (PC/Web 双模式)。
- **理由**: VS Code 的插件架构经过 10 年验证，是最成熟的 IDE 扩展模型。AUDESYS 不需要重造轮子——直接采用 activate/deactivate 模式、activationEvents 延迟加载、commands 统一入口。Tauri 不支持运行时动态加载，因此 P1 使用静态 JSON manifests + lazy import 组件。
- **参考**: docs/modules/studio/plugin-architecture-design.md, docs/reference/vscode.md

## D59: Studio PC/Web 双模式 = PlatformAdapter 抽象层
- **日期**: 2026-07-19
- **决定**: 通过 IPlatformAdapter 接口将 Tauri 特定 API（invoke、fs、dialog）抽象为统一接口。PC 模式封装 Tauri API，Web 模式使用浏览器 API（fetch + IndexedDB + File API）。前端 React 组件零修改——仅替换 import 源。
- **理由**: VS Code 的 IFileService/ICommandService 抽象模式已验证 Web 迁移可行性。当前 61 处 @tauri-apps/* 硬绑定是 Web 部署的主要阻碍。PlatformAdapter 作为唯一的适配点，替换后 100% 前端代码可复用。
- **参考**: docs/modules/studio/plugin-architecture-design.md §3, docs/reference/vscode.md §2.5

## D60: Panel Widget 复用 = packages/studio-core 共享组件
- **日期**: 2026-07-19
- **决定**: Runtime Panel 复用 Studio 的 7 种 HMI Widget 组件（Gauge/Trend/Tank/Indicator/Button/Display/Text），而非重写。Widget 提取到 `packages/studio-core/src/widgets/`，统一 WidgetProps 接口 `{ signalValue, ...rest }`。
- **理由**: 7 种 widget 已实现且测试通过，重写带来双倍维护成本。Widget 已改为纯函数组件，signalValue 通过 prop 注入（而不内部调用 useHmiSignal），两端可注入不同的信号源。
- **参考**: packages/studio-core/, apps/studio/src/components/widgets/

## D61: Panel Plugin 参考 Studio 接口但不继承
- **日期**: 2026-07-19
- **决定**: Panel 的 Plugin System 参考 Studio 的 PluginRegistry 生命周期模式（activate/deactivate）和 Manifest 结构，但不作为子类/继承关系。
- **理由**: Panel 插件上下文不同——核心能力是 SignalBridge（信号订阅/写入/快照），而 Studio 是 Tauri invoke（文件/调试/部署）。强行共享接口会引入不必要的抽象层，增加两端复杂度。
- **参考**: docs/modules/runtime/panel-architecture-design.md §3, docs/modules/studio/plugin-architecture-design.md

## D62: SignalBridge 默认 Hybrid 模式 = Push 优先 + Poll 降级
- **日期**: 2026-07-19
- **决定**: Runtime Panel 信号更新采用 Hybrid 策略：优先使用 IPC push 推送（Controller 端 SIGNAL_PUSH frame），降级使用 100ms poll 轮询（SIGNAL_SNAPSHOT）。Push 延迟 <50μs (UDS)，poll 作为 Controller 不支持推送时的兜底。
- **理由**: Push 是低延迟的最佳方案，但不能假设所有 Controller 部署都支持 0x16 push frame（特别是远程 WebSocket 场景）。Hybrid 确保 Panel 在所有部署模式下都能工作。
- **参考**: .sisyphus/plans/signal-bridge/design.md, docs/modules/runtime/panel-architecture-design.md §4

## D63: 订阅推送在周期边界批量发送
- **日期**: 2026-07-19
- **决定**: Controller 端信号变化推送在 RT 周期边界（Config Barrier 边界）批量发送，不在信号变化时即时推送。同周期内同一信号多次变化，仅推送最终值。
- **理由**: 避免 RT 线程中逐信号推送造成抖动。与 Config Barrier (D17) 设计哲学一致——所有变更在周期边界批量应用。
- **参考**: docs/modules/hal/config-barrier-design.md, docs/modules/runtime/panel-architecture-design.md §7

## D64: HMI 角色 writeSignal 限定按钮绑定信号
- **日期**: 2026-07-19
- **决定**: 新增 Role::HMI (枚举值 5)，用于 Panel 连接到 Controller 的角色认证。writeSignal 权限仅限于 HmiLayout 中 button widget 绑定的信号，非 button 信号拒绝写入。
- **理由**: 操作员不应通过 Panel 修改控制逻辑信号，但需要启停按钮能力（如紧急停止、泵启停）。审计日志中区分 `Role::HMI`（Panel 操作）和 `Role::Operator`（Studio 操作）。
- **参考**: docs/modules/runtime/ipc-security-design.md, docs/modules/runtime/panel-architecture-design.md §7.4

## D65: Panel 作为独立 Tauri 应用而非 Studio 面板
- **日期**: 2026-07-19
- **决定**: Runtime Panel 作为独立的 Tauri 应用（`apps/runtime-panel/`）部署，不嵌入 Studio IDE 窗口。支持全屏 kiosk 模式，独立进程可单独部署、升级、崩溃隔离。
- **理由**: 操作员站全屏运行，不应嵌入 IDE chrome（工具栏、文件树、终端）。独立进程提供进程级隔离——Panel 崩溃不影响 Studio 开发，反之亦然。与 D65（应为 D58）Studio 插件架构是互补关系而非替代关系。
- **参考**: docs/modules/runtime/panel-architecture-design.md, docs/reference/ignition.md

## D66: Transport 层统一接口 + 自动选择
- **日期**: 2026-07-19
- **决定**: Panel Transport 层定义统一接口 `IPanelTransport`（connect/readSignal/writeSignal/snapshot/subscribe），三种实现：UdsTransport（本地 UDS ~10μs）、WsTransport（远程 WebSocket ~5ms LAN）、SimTransport（SimulationHarness 进程内）。部署时根据配置自动选择。
- **理由**: UDS/WS/Sim 三种模式接口一致，Panel 业务代码零变更。自动选择避免操作员手动配置传输模式。
- **参考**: docs/modules/runtime/panel-architecture-design.md §5, crates/audeys-controller-client/src/lib.rs

## D69: HMI 布局版本管理 = YAML 文本 + Git diff 友好
- **日期**: 2026-07-19
- **决定**: HMI 布局文件以 YAML 文本格式存储（`{project}/hmi/layout.yaml`），纳入 Git 版本管理。不采用二进制序列化或数据库存储。P2 升级为 FlatBuffers 编译（D24 运行时策略）。
- **理由**: YAML 文本 Git-diffable，工程师可直接审查布局变更（"将 Tank-1 从 x=100 移动到 x=200"）。LabVIEW .vi 二进制格式不可 Git diff 的教训（pitfalls.md §LabVIEW 二进制格式）直接验证了文本格式的必要性。FlatBuffers 仅用于运行时加载，不用于源码管理。
- **参考**: `apps/studio/src/hooks/useHmiLayout.ts:46-68` (exportYaml), `apps/studio/src-tauri/src/lib.rs:406-409` (save_hmi_layout)
## D68: HMI 布局部署协议 = 复用 deploy_program IPC 模式 + 新增 0x17
- **日期**: 2026-07-19
- **决定**: HMI 布局部署使用与 `deploy_program` (IPC method 0x10) 相同的模式：Studio 通过 ControllerClient 发送 HmiLayout → Controller 写入 Config Barrier → 下周期边界 Panel 获取新布局。新增 IPC method 0x17 (DEPLOY_HMI_LAYOUT)，不修改现有 0x10 语义。
- **理由**: Config Barrier (D17) 已在周期边界批量应用变更，HMI 布局变更适用相同机制。0x10 的 HMAC 认证+RBAC (Role::Engineer) 可直接复用。新建 0x17 保持方法语义单一职责——0x10=程序部署，0x17=HMI 布局部署。
- **参考**: `crates/audeys-ipc-server/src/`, `docs/modules/hal/config-barrier-design.md`, `docs/modules/runtime/panel-architecture-design.md`

## D67: HMI 调试信号注入 = sim_set_signal Tauri 命令复用
- **日期**: 2026-07-19
- **决定**: HMI Builder 的 Preview 模式信号注入复用现有 `sim_set_signal` Tauri 命令（第 331 行），通过 SimulationHarness 注入模拟信号值。不新建独立的 HMI 信号模拟系统。
- **理由**: SimulationHarness 已有完整的信号写入/读取/步进能力，新建独立系统会重复建设。HMI Preview 本质上就是"注入信号 → 观察 widget 渲染"的测试循环，与 SimHarness 的 step/read 模式完全等价。
- **参考**: `apps/studio/src-tauri/src/lib.rs:331`, `crates/audeys-runtime-engine/src/simulation.rs`

## D70: Studio 响应式布局 = CSS flexbox + min-height:0 + 去白边
- **日期**: 2026-07-20
- **决定**: Studio 采用 `height: 100%` 继承链（html→body→#root→.app-root）替代 `100vh`，`.app-panel` 加 `min-height:0; max-height:100%` 允许 flex 子元素随窗口缩小，html/body 显式设置 `background: var(--color-canvas)` 防止白边。
- **理由**: Playwright 测试验证（1440×900→1000×450）布局始终填满视口。根因是 flex 子元素默认 `min-height: auto` 阻止缩小，CSS `overflow:hidden` 无法越过此限制。
- **参考**: `apps/studio/src/index.css`, `apps/studio/src/App.css`, `apps/studio/e2e/studio-responsive-ui.spec.ts`（15 项测试）

## D71: Studio 技术栈迁移 = Tauri+React → Eclipse Theia
- **日期**: 2026-07-21
- **决定**: Studio IDE 从 Tauri+React 自建架构迁移到 Eclipse Theia 框架
- **理由**: (a) Neuron Automation 已验证 Theia+GLSP 可用于 IEC 61131-3 工业编程；(b) VS Code 扩展生态（Open VSX）；(c) TI/ST/Arm/Samsung 等主流厂商采用 Theia；(d) Theia 提供 Dock/Tab/Command Palette/Keybinding/Theme 等 13 项开箱即用的通用 IDE 功能；(e) Fork VS Code 不可行（周发版维护成本过高）；(f) CodeBlitz 不可行（无调试/无 Rust LSP）
- **技术栈**: Eclipse Theia (Electron) + Monaco Editor + Eclipse GLSP + ReactWidget + napi-rs (Rust bridge)
- **影响范围**: Studio 前端全部替换。Runtime Panel 不受影响（D65 保持有效）。Rust 运行时通过 napi-rs 桥接（~50% 需适配：34 个 Tauri 命令重写为 ~25 个 napi-rs 函数，Cargo.toml 配置变更，Controller 生命周期适配）。纯逻辑代码（编译器、VM、Engine）零修改。
- **取代决策**: D21 (Tauri+React 技术栈)，D58 部分 (插件架构由 Theia Extension System 替代)，D59 部分 (PlatformAdapter 由 Theia Backend Service 替代)
- **参考**: docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md

## D72: Smoke 测试作为 qa-fast Step 0，2 分钟超时
- **日期**: 2026-07-22
- **决定**: qa-fast CI 门禁新增 Step 0 Smoke 测试（`cargo test --workspace -- smoke`），独立于 Step 1 full test suite。Smoke 超时 2 分钟，超过则 CI 快速失败。
- **理由**: 工业控制编译器和运行时测试套件规模大（700+ tests），快速 smoke 门禁在破坏性变更时 2 分钟内给出信号，避免等待 full suite 超时。IEC 61131-3 和 G-code 编译器 smoke 覆盖核心编译路径。
- **参考**: `qa/smoke-checks.sh`, `.github/workflows/qa-fast.yml`

## D73: SDD 追溯率 ≥80% 作为 Phase 退出条件
- **日期**: 2026-07-22
- **决定**: 每个 Phase 退出前必须验证 SDD 规范→测试的追溯率达到 ≥80%。追溯通过 `#[test]` 注释中的 `// SDD: <spec-id>` 标签自动统计。不满足则 Phase 不退出。
- **理由**: SDD 规范（186 项）与测试之间的追溯链是零源代码阶段设计→实现的唯一可验证桥梁。≥80% 阈值来自 P0 测试优化分析——当前覆盖率乐观估计 55%，80% 是可达成且有意义的提升目标。
- **参考**: `openspec/specs/` 6 份规范（186 项），`qa/check-sdd-traceability.sh`

## D74: 每 Phase 内联测试任务（+18 总计）
- **日期**: 2026-07-22
- **决定**: 每个 P0/P1 子任务包中包含内联测试任务（如 T3.1→T3.1b、T3.5→T3.5b），测试任务与实现任务保持 1:1 配对。总计新增 18 个测试子任务。
- **理由**: P0 测试分析发现 7 个模块无独立测试任务——测试依赖分散在实现任务中，完成后无人验证。内联配对确保每个模块有明确的「测试编写」和「测试验证」步骤，TDD 可执行化。
- **参考**: `.sisyphus/plans/p0-testing-optimization/design.md` §3（任务结构重构）

## D75: AI 生成代码须在同一个 PR 中包含测试
- **日期**: 2026-07-22
- **决定**: 所有由 AI 代理生成的代码必须在其提交的同一个 PR 中包含对应测试（单元测试或集成测试）。测试缺失则 PR 不可合并。AI 代理在 `task.md` 的 acceptance criteria 中明确列出所需测试。
- **理由**: P0 测试优化分析发现 AI 生成的模块（LD 编译器、FBD 编译器、SFC 编辑器）测试覆盖率偏低，原因是 AI 优先完成功能代码、测试作为「后续任务」被跳过了。同 PR 提交强制 AI 代理在交付时承担测试责任。
- **参考**: `.sisyphus/plans/p0-testing-optimization/design.md` §4（AI 代理测试约束）

## D76: Phase 退出条件可自动验证（P4 签字除外）
- **日期**: 2026-07-22
- **决定**: 除 P4（生产部署签字）外，所有 Phase 退出条件必须可自动验证（CI 脚本检查）。退出条件包括但不限于：测试通过率、SDD 追溯率、覆盖率、性能基准。P4 签字是唯一的人类判断门。
- **理由**: 手动审核不可重复、不可 CI 门禁化。可自动验证的退出条件使 Phase 边界成为真正的「绿灯/红灯」开关，减少人工审查认知负荷。P4 保留签字是因为生产部署需要安全判断、变更管理审批等不可自动化因素。
- **参考**: `.sisyphus/plans/p0-testing-optimization/design.md` §5（Phase 退出自动化）
