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
- **参考**: `docs/hal-detailed-design.md` §1

## D11: amw 中间件抽象层 = HalTransport + HalDiscovery + HalQoS
- **日期**: 2026-07-09
- **决定**: 参考 ROS2 rmw 模式，定义 amw（AUDESYS Middleware）三极 trait，传输/发现/QoS 实现可替换
- **理由**: 不绑死 Zenoh/DDS/MQTT，换实现不换 API。Phase 1 用 amw_inproc，Phase 2+ 用 amw_zenoh
- **参考**: `docs/hal-detailed-design.md` §2–3

## D12: 统一类型系统 = 14 种
- **日期**: 2026-07-09
- **决定**: 11 种标量（Bool/S8/U8/S16/U16/S32/U32/S64/U64/F32/F64）+ String + Blob + Array<T>
- **理由**: 覆盖 IEC 61131-3 全部类型（TIME/DATE/TOD/DT 映射到现有数值类型），WSTRING 不引入（UTF-8 only），Blob 不进类型推导
- **参考**: `docs/hal-detailed-design.md` §4

## D13: 四系统混合线程调度
- **日期**: 2026-07-09
- **决定**: RT 线程 = LinuxCNC 显式函数列表 + ROS2 control 的 read→update→write 管线 + OpenPLC 扫描屏障 + dora-rs 事件驱动 I/O 线程
- **理由**: 三类执行需求（硬实时控制 / I/O 通信 / 流数据）不能放进同一个调度模型
- **参考**: `docs/detail/hal/thread-scheduling-design.md`

## D14: HAL 详细设计 = 独立文档策略
- **日期**: 2026-07-09
- **决定**: HAL 详细设计独立为 `docs/hal-detailed-design.md`，不在 `docs/architecture.md` 内展开
- **理由**: architecture.md 保持系统概览角色（~2300 行，6 个主章均衡），详细规范独立维护
- **参考**: `docs/hal-detailed-design.md`（3,185 行，16 章）

## D15: 文档目录结构 = detail/ 子目录
- **日期**: 2026-07-09
- **决定**: 独立设计文档放入 `docs/detail/{module}/` 子目录，合并后主文档在 `docs/` 根目录
- **理由**: 减少 docs/ 根目录文件数量，按模块组织；主合并文档作为入口
- **当前结构**: `docs/modules/hal/` 含 12 份子文档
- **当前结构**: `docs/detail/hal/` 含 11 份子文档

## D16: 工业 QoS 三层执行
- **日期**: 2026-07-09
- **决定**: Deadline 在 RT 数据面（amw 内部同周期 tick 触发）、Liveliness 在控制面（Zenoh 原生）、Security Domain 在配置面（静态 keyexpr 标记）
- **理由**: 不同维度的执行时间和可靠性要求不同，不能全放进 RT 线程
- **参考**: `docs/hal-detailed-design.md` §3

## D17: Config Barrier + LockLevel
- **日期**: 2026-07-09
- **决定**: 所有配置变更排队到 RT 周期边界批量应用（Config Barrier），LockLevel 从运行时锁变更为配置权限分级
- **理由**: 多进程 Supervisor 可能随时发 RPC，不能依赖 LinuxCNC 式的开发者自觉。Run 级别拒绝所有 RPC
- **参考**: `docs/detail/hal/config-barrier-design.md`

## D18: HAL 协议设计 = 团队审核驱动
- **日期**: 2026-07-09
- **决定**: HAL 协议设计经 3 人团队（LinuxCNC 实时 / ROS2 中间件 / IEC 61131-3 软PLC）并行审核，共 27 项发现，全部逐项交互确认
- **理由**: 多视角交叉验证，避免单领域盲点
- **审核范围**: CRITICAL 7 / HIGH 8 / MEDIUM 8 / LOW 4

## D19: 多语言策略 = Rust Core + FlatBuffers
- **日期**: 2026-07-09
- **决定**: RT 数据面 Rust 独占（< 1μs），I/O 通信 Rust + C++ FlatBuffers over UDS（~10μs），控制面/HMI 15 种语言 FlatBuffers over Zenoh（~100μs）
- **理由**: SCHED_FIFO 线程需要无 GC/无 JIT/无异步运行时，仅 Rust 满足。C++ FFI 桥接限非 RT 线程。FlatBuffers 作为统一跨语言序列化格式
- **参考**: `docs/detail/hal/multi-language-strategy.md`

## D20: 参考文档库 = 22 篇竞品分析
- **日期**: 2026-07-13
- **决定**: 建立 `docs/reference/` 参考文档库，覆盖 7 大类别 22 个工业自动化产品/项目
- **理由**: 为 AUDESYS HAL/Studio/Runtime 设计提供竞品架构参考，避免闭门造车。每篇含"对 AUDESYS 参考价值"章节，直接将竞品架构映射到 AUDESYS 设计
- **覆盖范围**: DCS（中控/和利时/Honeywell/Emerson）、软PLC（truST/QiTech/OpenPLC）、SCADA/组态（Ignition/KingView/FUXA/InTouch/LabVIEW）、仪器仪表/通信（HART/FF/PROFIBUS/OPC UA/RuSTy）、IDE/平台（CODESYS/Qtouch/Beckhoff/Siemens）、机器人/数据流（ROS2/dora-rs/LinuxCNC）
- **文档格式**: 统一 7 章节（产品画像、技术特性、功能概览、现状与生态、市场定位、产品特色、对AUDESYS参考价值），≥800 行，中文撰写，技术术语保留英文原文

## D21: Studio IDE 技术栈 = Tauri + React + TypeScript
- **日期**: 2026-07-13
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
- **G5**: HAL 详细文档统一入口为 `docs/hal-detailed-design.md`，子文档在 `docs/detail/hal/` 归档

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
- **参考**: .agents/rules/common/testing.md（AAA 模式、80% 覆盖率、TDD 工作流）、docs/hal-detailed-design.md §1-7（测试场景提取源）、欧洲 XFEL 虚拟 PLC 验证模式（Phase 2 参考）
- **决定**: 使用 Ludwig（github.com/samdvr/ludwig）将 Markdown 设计规范自动转换为 Rust test stubs
- **理由**: 三层验证（结构性→确定性→判断性）最适合当前文档驱动状态。手工从 8 份设计规范编写测试会遗漏边界情况
- **参考**: Ludwig 三步验证模型、SpecDD 源邻规范模式、SDD 分类学（arXiv 2602.00180）

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
- **决定**: Phase 0: qa-fast（fmt+clippy+test+audit+unwrap-budget）。Phase 1 中期: qa-full（coverage+mutants+semver）。Phase 2: qa-deep（miri+proptest+adversarial LLM）
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
