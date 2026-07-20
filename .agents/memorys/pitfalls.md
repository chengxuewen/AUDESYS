# AUDESYS 项目坑点

## 已遭遇的坑

### HAL 设计审核：过度工程化风险
- **问题**: 团队审核发现多项计划过度复杂，如引入第 4 种原语（Action）、完整 DDS QoS、专用名称服务
- **原因**: 设计者容易受参考系统（ROS2/DDS）的"完整解决方案"影响，忽略了 AUDESYS 的三原语 + amw 抽象层已经覆盖核心需求
- **方案**: 每项审核发现经交互式确认，拒绝 4 项过度设计提案（Action 原语、NameService、完整 QoS、DDS QoS 映射），RPC + StreamChannel + Signal 组合 + HalQoS 轻量扩展足以覆盖

### DDS 概念迁移陷阱
- **问题**: ROS2 的 DDS QoS（reliable/best-effort/durability/ownership）容易被视为 AUDESYS 的"缺失功能"
- **原因**: ROS2 开发者会将 DDS 概念视为工业 QoS 的必要组成部分
- **方案**: 明确区分 DDS QoS（面向消息中间件）与工业 QoS（device alive? data fresh? data isolated?）。AUDESYS 的 Signal 天然 latest-value, StreamChannel 有 QueuePolicy，HalQoS 仅增加 deadline/liveliness/security_domain 三个最小维度

### 架构文档膨胀
- **问题**: HAL 详细设计曾尝试放入 architecture.md，导致 HAL 章节体积为其他章节的 10 倍
- **方案**: D14 — HAL 详细设计维护为 `docs/modules/hal/` 下 18 份独立子文档，architecture.md §一 按主题引用对应子文档。

### 延迟声明不可验证
- **问题**: 原始延迟声明（< 1μs, ~10μs）不带前提条件和验证方法，属于"乐观估计"
- **原因**: 设计初期容易只看理想情况忽略 PREEMPT_RT 内核、消息大小、硬件性能等因素
- **方案**: 每行延迟声明加 `condition` 字段 + 典型范围，配套验证方法（criterion/linux-perf/tcpdump/rdtsc），写入审计报告

## 项目初始化相关

### 全局 MODACS→AUDESYS 替换的危险
- **问题**: 不能简单地全局替换 `MODACS` → `AUDESYS`
- **原因**: 
  - `@modacs/*` npm scope 不应自动变为 `@audesys/*`（AUDESYS 还没有自己的包）
  - 历史上下文引用需审慎处理（architecture.md 中某些是合法性引用）
  - 文件路径引用（`docs/MODACS-Design.md`）应移除而非重命名
- **方案**: 精确的手术式编辑，配合每次修改后 `grep -ri modacs` 验证

### 缺失依赖文件的处理
- **问题**: 被引用的文件不存在于 AUDESYS 中（MODACS-Design.md、MODACS-AI-Dev.md、theme.css）
- **原因**: .agents/ 和 .opencode/ 直接从 MODACS 复制，保留了指向 MODACS 文件的引用
- **方案**: 移除引用使技能自包含，而非创建占位文件

### architecture.md 章节连贯性
- **问题**: 删除 MODACS 引用后，某些章节内容不足 50%，上下文支离破碎
- **原因**: 2289 行文档中 18+ 处 MODACS 引用，删除后 40-60% 内容为不连贯骨架
- **方案**: D6 骨架占位策略 — 内容不足 50% 的章节用 `TODO: 为 AUDESYS 重写此节` 替换

### Git 仓库状态
- **问题**: 仓库已初始化但零提交（首次提交前）
- **影响**: 所有文件显示为 `??`（未跟踪），无 git 历史可参考
- **方案**: 首次提交包含所有基础文件

### .gitignore 排除 .sisyphus/
- **注意**: `.sisyphus/` 在 .gitignore 中，计划文件和证据不会提交到仓库
- **影响**: 提交时需排除 `.sisyphus/` 路径

## 参考文档生成相关

### 并行输出覆盖风险
- **问题**: 多个 agent/team member 并行生成同一文件时，后写入者覆盖先写入者（如 labview.md 从 663 行被覆盖为 1 行）
- **原因**: team member 和 background task 同时处理重叠产品，无文件锁机制
- **方案**: 并行任务需显式分配互斥产品范围。产出后立即验证行数——发现覆盖立即补写

### 行数达标约束挑战
- **问题**: trust-platform.md 和 qitech-control.md 初次产出远低于 800 行（372/225），需多轮扩充
- **原因**: deep agent 在工具输出截断时会自动压缩内容，而非增长到目标行数
- **方案**: 对首次不达标的文档发送专门的"EXPAND"任务，指定保留现有内容、追加特定章节的详细分析

## 架构评审新增坑点

### Ignition Jython — 脚本语言锁定教训
- **问题**: Ignition 从 2010 年起使用 Jython (Python 2.7)，10 年后锁死在旧版本，无法升级（依赖生态自建）
- **方案**: D26 — Phase 1 不引入脚本语言，Phase 2 用 WASM 插件避免语言锁定

### LabVIEW 二进制格式 — Git 不兼容
- **问题**: .vi 二进制文件不可 Git diff，项目管理困难
- **方案**: D24 — 选择文本格式（YAML）作为开发配置格式，编译为 FlatBuffers 仅用于运行时加载

### CODESYS 编译器投入低估
- **问题**: CODESYS 完整支持 5 种 IEC 61131-3 语言花了数十年，容易低估编译器投入
- **方案**: D22 — 分阶段演进（RuSTy → HAL IR → 自研），不追求 5 语言全覆盖

### 未成熟工具依赖 — Ludwig alpha 教训
- **问题**: 实施规划 D33 原方案依赖 Ludwig（github.com/samdvr/ludwig）自动生成测试桩，团队审查发现 v0.1 alpha 不满足生产要求（19 commits、1 维护者、无 crates.io 发布、属性测试延期）
- **原因**: 设计阶段容易被工具论文或演示所吸引，忽略生产可靠性（bus factor、发布渠道、功能完备性）
- **方案**: 修订 D33 为直接 TDD。选择工具链必须满足：(1) 正式发布到包注册表 (2) bus factor >= 2 (3) 功能完备性经团队验证。Phase 0/1 禁止依赖 alpha/unstable 工具

### CI 脚本 set -e 与 grep exit code 1 冲突
- **问题**: unwrap-budget.sh 使用 set -euo pipefail + rg -c，当 rg 无匹配时 exit code=1 导致脚本中断
- **原因**: safe bash 与搜索工具默认行为冲突，rg/grep 将无匹配视为错误退出码
- **方案**: 使用 rg -o pattern 2>/dev/null | wc -l 模式代替 rg -c。所有 CI 脚本中的 grep 类命令均需审计此模式

## MCP 配置相关

### 零代码阶段 MCP 过度启用
- **问题**: 前端 MCP（shadcn、tailwind、lucide）在零源代码阶段启用，均无实际产出
- **原因**: 配置从 MODACS 迁移时保留全量，未按项目阶段裁剪
- **方案**: 已移除 3 个前端 MCP，保留 7 个核心 MCP（qt-docs、codegraph、playwright、github、openspace、memory、postgres）。新增 GitHub + OpenSpace 弥补 Phase 0 工具缺口

### GitHub MCP 认证依赖
- **问题**: `local-github` MCP 需要 `GITHUB_TOKEN` 环境变量，当前未配置将导致认证失败
- **方案**: 首次使用前需创建 GitHub Personal Access Token（classic），repo 或 public_repo 权限，通过 shell profile 或 `.env` 注入



## 文档审计相关

### 50 项交互式审计 — 发现分布
- **问题**: 全量文档审计（architecture.md + 18 HAL子文档 + decisions/conventions/status/pitfalls + 3 P0计划）共发现 50 项：11 CRITICAL + 13 HIGH + 19 MEDIUM + 7 LOW
- **原因**: 文档驱动阶段累积的债务（过期引用、Phase歧义、类型计数矛盾、安全域格式不一致）和设计缺口（IPC安全、可观测性、错误模型、硬件基线）
- **方案**: 逐项交互审核确认（45项修复、5项延后），团队模式 + background agent 并行修复，12 commits 原子提交

### 交互审核模式验证
- **问题**: 50 项发现若批量自动修复会引入新矛盾
- **方案**: 标准化交互审核模式：每项列详情→方案优劣→来源→影响→推荐，question() 确认后执行。此模式已固化进 doc-audit 技能

### 并发编辑冲突 — 多子代理编辑同一文件
- **问题**: architecture.md 被 bg_314cfa75 和直接编辑同时修改，可能产生冲突
- **原因**: 大型审计修复中多个子代理处理同一份大型文档的不同切面
- **方案**: architecture.md 的编辑应集中到单个 agent，其他 agent 处理独立文件。doc-audit 技能的 Conductor 规范已包含冲突处理规则

## 竞品参考相关

### 参考文档产品时效性
- **问题**: 4 项参考文档对应产品已停滞/停售：Machinekit（社区分裂，活跃度低）、LabVIEW NXG（NI 已停售，回归 LabVIEW 经典版）、InTouch（品牌碎片化，Aveva 多次重构）、GRBL（自 2019 年无更新）
- **原因**: 参考文档库仅记录产品架构快照，未标注产品生命周期状态
- **方案**: 在对应参考文档中标注「历史参考」标签，注明最后一次活跃年份或停售时间点。活跃产品标注「活跃参考」以作区分
- **方案**: 在对应参考文档中标注「历史参考」标签，注明最后一次活跃年份或停售时间点。活跃产品标注「活跃参考」以作区分

## CNC 系统相关

### G-code 方言差异
- **问题**: RS274/NGC、GRBL、Klipper、Mach3 各有 G-code 扩展和方言差异（如 G38.x 探针、G10 参数设置、Mxxx 宏定义），直接运行特定机器生成的 G-code 可能因不支持的扩展而失败
- **原因**: 各 CNC 厂商和开源项目在 RS274 基础上有不同的扩展集，无统一标准
- **方案**: Phase 1 选取 RS274 标准交集子集（G0/G1/G2/G3/G17-G21/G90/G91/M3/M4/M5/M30），不支持的指令返回明确的 GCodeError::UnsupportedCommand 错误。Phase 2+ 按需扩展

### 实时性与扫描周期
- **问题**: 当前 Runtime 默认 10ms 周期。对于高速 CNC (1000mm/s)，10ms 周期分辨率约 10mm/cycle，精度不可接受
- **原因**: 扫描周期引擎未针对微秒级 RT 设计
- **方案**: Phase 1 仅用于仿真/验证（不用于真实加工）。Phase 2+ 需要专用 RT 线程（SCHED_FIFO, 1ms→100μs 周期），参考 LinuxCNC 的 servo-thread 模式。此风险在设计文档中明确标注

### 运动精度 — 无运动规划器
- **问题**: Phase 1 使用逐周期步进逼近，无加速度控制、无前瞻、无路径混合。直接用于加工会导致振动、精度丢失、甚至电机失步
- **原因**: 运动规划器属于 Phase 2 构件，Phase 1 G-code 编译器仅做指令解析 + 逐周期步进
- **方案**: Phase 1 编译器输出仅在 SimulationHarness 下验证。运动规划器延后至 Phase 2（Runtime 协处理器），Phase 3 实现完整 S 曲线 + 前瞻

## Runtime Panel 性能陷阱（SCADA 竞品参考）

2026-07-19 基于 Ignition Perspective、FUXA、InTouch OMI、iFIX、KingView、Beckhoff ADS 等 8 家竞品的性能分析。

### SVG 运行时渲染上限
- **问题**: FUXA 使用 SVG 渲染 HMI 画面，>200 组件时 DOM reflow 严重，UI 卡顿
- **来源**: `docs/reference/fuxa.md` §7.4 — 明确标注 Canvas/WebGL 替代建议
- **方案**: PanelRenderer 在 widget 数 > 50 时应切换 Canvas 渲染模式（P2），P1 阶段在 HmiLayout 验证器中加 console.warn

### SQLite 作为时序存储的天花板
- **问题**: FUXA 默认 SQLite 存储历史数据，>1000 tag 时出现性能瓶颈
- **来源**: `docs/reference/fuxa.md` §7.8 + §7.7 — 可插拔 InfluxDB 为推荐替代
- **方案**: TrendRecorder 的存储接口从设计之初就抽象为 ITimeSeriesStorage trait，P1 默认 Memory/SQLite，P2 支持 InfluxDB/TDengine

### Web HMI 双产品线维护灾难
- **问题**: Ignition Vision+Perspective 双线、InTouch OMI+WindowViewer 双线——维护成本翻倍、用户混淆
- **来源**: `docs/reference/ignition.md` §7.10、`docs/reference/intouch.md` §7.10
- **方案**: D21 已确定 Studio 和 Panel 共享 widget 组件（packages/studio-core/），不创建独立 UI 产品线

### 信号字符串名运行时比较开销
- **问题**: 100+ 信号订阅时，每次推送用字符串名（"axis.0.pos"）匹配订阅列表开销大
- **来源**: Beckhoff ADS Index Group/Offset 数值寻址（`docs/reference/beckhoff.md`）
- **方案**: 编译时 Signal Registry 分配 u32 ID，HmiLayout 存储 ID 而非字符串名。P2 阶段实现

### 全量数据推送网络洪水
- **问题**: iFIX 同步 65K tag 需 90s（压缩前）；Ignition 无 deadband 时每次微小变化都推送
- **来源**: `docs/reference/qtouch.md`（iFIX 65K tag 同步）、`docs/reference/ignition.md`（Historican deadband）
- **方案**: D62 Hybrid push + D63 周期边界批量已解决架构层。P1 增加 Deadband 写入过滤——F64 信号值变化 < 阈值时不推送

### 渲染管线未利用 WebWorker
- **问题**: Ignition Perspective 用 WebWorker+Canvas 实现高性能，而 FUXA 和当前 AUDESYS Panel 单线程渲染
- **来源**: `docs/reference/ignition.md` §2.1.4 — Perspective 性能评级"高"的核心原因
- **方案**: P2 引入 WebWorker SignalBridge——HalValue 解码、信号缓存更新、依赖追踪在 Worker 中完成

### GDI/旧渲染管线的画质问题
- **问题**: KingView 从 GDI 升级到 Direct2D 才解决画面粗糙、闪烁问题；LabVIEW 从 GDI 迁移到 .NET/WPF
- **来源**: `docs/reference/kingview.md`、`docs/reference/labview.md`
- **方案**: Canvas/WebGL 从 P1 起步（TrendWidget），避免走 GDI 式的老旧渲染路径

### ISA-101 高密度画面的认知负荷
- **问题**: 高密度画面中操作员无法快速识别异常——ISA-101 要求正常状态低饱和度灰度、仅高亮异常
- **来源**: iFIX High Performance HMI（`docs/reference/qtouch.md` §181-182）、InTouch ISA-101（`docs/reference/intouch.md` §508）
- **方案**: WidgetRenderer 色彩方案遵循 ISA-101 原则：正常 widget 使用灰度/低饱和度，异常信号使用语义状态色高亮

## HMI 设计器相关

### useHmiSignal 静默吞异常
- **问题**: `useHmiSignal.ts:31-32` catch 分支 `setValue(null)` 静默吞异常——信号读取失败时 Preview 模式 widget 不显示任何错误指示，操作员以为设备正常
- **来源**: `apps/studio/src/hooks/useHmiSignal.ts:31-32`
- **方案**: catch 分支设置独立状态 `error: string | null`，widget 在 `isPreview` 模式下显示错误指示（红色叉号+错误信息）。同时添加 console.error 用于开发者调试

### 500ms 轮询间隔不足
- **问题**: `useHmiSignal` 使用 500ms setInterval 轮询——工业快速变化信号（如编码器脉冲、振动传感器）在 500ms 间隔内可能发生多次变化，Preview 模式显示的值可能误导操作员
- **来源**: `apps/studio/src/hooks/useHmiSignal.ts:38`
- **方案**: 当前的 500ms 间隔适用于慢速信号（温度、压力、液位），足够 Phase 1 HMI 设计验证。Phase 2 迁移到 SignalBridge (D62) 时切换到推流模式（<50μs UDS push），消除轮询延迟

### YAML 导出格式脆弱
- **问题**: `useHmiLayout.exportYaml()` 回退到手工拼接 YAML 字符串（行 50-67），而非使用 js-yaml 库。回退格式丢失嵌套配置和特殊字符转义
- **来源**: `apps/studio/src/hooks/useHmiLayout.ts:46-68`
- **方案**: 安装 `js-yaml` npm 包并导入，替换回退实现。当前回退格式仅作为 MVP 演示用途可接受（简单 widget 配置无特殊字符）

### HMI 布局无运行时验证
- **问题**: HMI 布局在 Studio 端保存时无验证（无重叠检测、无信号绑定有效性校验、无 widget 数量上限）。错误布局仅在部署到 Runtime Panel 时发现
- **来源**: `apps/studio/src/types/hmi.ts` — HmiLayout 类型无验证层
- **方案**: P1 添加 HmiLayoutVendor 校验函数：widget 少於 50 个、信号名匹配注册表、widget 位置不越界。P2 升级为 Zod schema 验证（遵循 TypeScript 编码约定）

### app-toolbar unclosed div causes DOM nesting bug
- Problem: App.tsx non-HMI branch had only one `</div>` closing `.app-toolbar__actions`, leaving `.app-toolbar` unclosed. `.app-main` rendered as toolbar child.
- Cause: Deeply nested React JSX with conditional rendering makes missing close tags hard to detect.
- Solution: Add second `</div>` after `.app-toolbar__actions` close tag.
- Found: 2026-07-20 responsive layout debugging — Playwright screenshot showed 80%+ black viewport. DOM check: `.app-main` parentChain = app-main->app-toolbar->app-root.

### Playwright webServer port/cwd configuration
- Problem: `webServer.cwd` defaults to monorepo root, not `apps/studio/`. `npx vite` resolution slow. Ports 3000/5173 often occupied.
- Solution: Use `./node_modules/.bin/vite` direct path. Port 4000 for Studio dev. Timeout 60s.

### .debug-panel class name conflict
- Problem: After wrapping non-HMI panels in `.app-main`, `.debug-panel` CSS class resolves to 4 elements (strict mode violation in tests).
- Cause: `debug-panel` is a generic class used by multiple sub-panels.
- Solution: Use `.first()` in Playwright selectors. Long-term: unique CSS class per sub-panel.
