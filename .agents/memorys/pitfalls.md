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

## AUDEDeck 性能陷阱（SCADA 竞品参考）

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
- **问题**: HMI 布局在 Studio 端保存时无验证（无重叠检测、无信号绑定有效性校验、无 widget 数量上限）。错误布局仅在部署到 AUDEDeck 时发现
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

## Theia Studio 白屏问题（2026-07-22）

### 诊断环境
- **问题**: 启动 `apps/studio-theia/` 的 Theia 应用后只显示白色背景 + loading spinner，无 IDE workbench
- **发现**: 从 Tauri Pro 项目配置到实际启动需要理解 5 层启动链 (package.json scripts → theia CLI → Electron main process → backend server → frontend injection)

### 根因 1: 端口冲突
- **问题**: 默认端口 3000 被 Docker Desktop 占用，Theia 后端无法绑定端口
- **修复**: `theia start --port=5000`

### 根因 2: sandbox:true 阻止渲染
- **问题**: package.json 中 `electron.windowOptions.webPreferences.sandbox: true` 覆盖了 Theia 默认 `sandbox: false`
- **原因**: Theia 的 Electron 主进程需要在渲染进程中使用 Node.js API（文件系统、进程管理），sandbox 禁用这些 API
- **修复**: 删除自定义 sandbox 配置，使用 Theia 内置默认值 `sandbox: false`

### 根因 3: --disable-gpu 阻止渲染
- **问题**: Electron `--disable-gpu` 在 macOS 上导致软件渲染路径失败，Chromium 启动但无像素输出
- **修复**: 删除 `--disable-gpu`，macOS 上使用 GPU 加速

### 根因 4: 入口点混淆
- **问题**: `npx electron lib/backend/main.js` 启动后端服务器，不创建 Electron BrowserWindow
- **正确**: `npx electron lib/backend/electron-main.js` 或 `npm start`（theia start）
- **混淆源**: 旧 Tauri Studio (`apps/studio/`) 仍存在，使用完全不同的启动模式

### 根因 5: ai/bulk-edit 模块冲突
- **问题**: 自定义 src-gen/frontend/index.js 导入了 @theia/ai-core、@theia/ai-chat、@theia/bulk-edit 等未声明的模块
- **修复**: 使用 `theia init` 裸生成的 src-gen/frontend/index.js（无自定义 AI 模块导入）

### Electron + 浏览器双端可用方案
- **原理**: ElectronTokenValidator.allowRequest() 在 THEIA_ELECTRON_TOKEN 未设置时自动放行
- **补丁 4 文件**:
  1. lib/backend/main.js — Express 中间件链加 CORS + WebSocket 放行
  2. lib/frontend/index.html — polyfill window.electronTheiaCore 浏览器不可用 API
  3. electron-token-backend-contribution.js — 中间件首行 next() 直接放行
  4. electron-token-validator.js — allowRequest() 永远返回 true
- **结果**: Electron 窗口正常 + 浏览器 (Playwright MCP) 同时可用
- **工作位置**: `apps/studio-theia-test/`（非 `apps/studio-theia/`）

### 遗留问题
### 遗留问题
- 需将修复从 `apps/studio-theia-test/` 移植回 `apps/studio-theia/`

### 浏览器兼容性 (2026-07-22)
- **问题**: Theia Electron 构建无法在浏览器中访问——安全令牌 403 + WindowMetadata API 缺失
- **方案**: 4 个补丁实现双端可用
  1. `lib/frontend/index.html` — 38 API electronTheiaCore polyfill
  2. `lib/frontend/bundle.js` — WindowMetadata 可选链修复
  3. `lib/backend/electron-main.js` — allowRequest 令牌绕过
  4. `lib/backend/main.js` — 中间件令牌绕过
- **自动化**: `postbuild.sh` 在每次 `theia build` 后自动应用补丁
- **注意**: `npm install` 会重置 node_modules 令牌补丁

### audesys 扩展浏览器初始化 (2026-07-22)
- **问题**: audesys-core 的 IecNewFileContribution 在浏览器中因 Monaco async dep 崩溃
- **方案**: 禁用 IecNewFileContribution + SignalBrowser/ScopeView 使用 try-catch + @optional() 延迟注入
- **audesys-debug**: 就绪，无阻塞问题——仅 3 个非阻塞关注点

### F12 DevTools 不弹出
- **问题**: Electron 窗口按下 F12 / Cmd+Option+I 无反应，DevTools 无法打开
- **原因**: Theia 拦截了键盘事件，路由到 IPC 调用 `webContents.openDevTools()`，但 IPC 通道在应用初始化完成前不可用。`--auto-open-devtools-for-tabs` 通过 `theia start --electron-args` 传递时也会失效
- **方案**: 在 `src-gen/backend/electron-main.js` 和 `lib/backend/electron-main.js` 中直接注册 `globalShortcut.register('F12', ...)` 和 `Cmd+Option+I`，绕过 Theia 的 IPC 机制
- **代码**: `app.whenReady().then(() => { globalShortcut.register('F12', () => { BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools(); }); })`
- **已验证集成**: audesys 自定义扩展（core, debug, hmi-designer）通过 `studio-theia-test` 加载验证。Debug Panel 8 源文件/7 测试，DI bindings 完整，Electron+browser 双端可用

### plugin-ext TDZ 错误 — audesys 扩展初始化时序
- **问题**: `@theia/plugin-ext` 在加载 audesys 自定义扩展时出现 TDZ (Temporal Dead Zone) 错误，扩展 DI 绑定在类引用被访问时尚未完成初始化
- **原因**: Theia 的 `ContainerModule` 绑定是同步执行的，但 audesys 自定义扩展间的依赖引用（core → debug → hmi-designer）在模块加载阶段触发了尚未绑定的服务引用。`@theia/plugin-ext` 的 `HostedPluginSupport` 在 `onStart()` 中遍历已安装扩展时，audesys 扩展的 DI 容器尚未完全构建
- **方案**: 在 `audesys-core-frontend-module.ts` 中使用 Theia 的 `ConnectionStatusService` 进行延迟初始化，debug 和 hmi-designer 扩展通过 `@postConstruct()` 装饰器确保服务在绑定完成后才被消费。`plugin-ext` 的 `autoDownload: false` + `marketplace: []` 配置（已存在于 `studio-theia-test/package.json`）确保自定义扩展优先加载

## 全量文档审计相关（2026-07-23）

### fbd-compiler 未加入 workspace members
- **问题**: `crates/audesys-fbd-compiler/` 目录和 Cargo.toml 存在，但根 Cargo.toml workspace members 中缺失此项。cargo build --workspace 不会编译/测试 FBD 编译器
- **原因**: FBD 编译器后添加时遗漏了更新 workspace members
- **方案**: 在根 Cargo.toml workspace members 中添加 `crates/audesys-fbd-compiler`

### st-compiler 命名实际位置为 hal-binding-gen
- **问题**: architecture.md、decisions.md、vscode.md 等多处引用 `crates/audesys-st-compiler/`，但该目录不存在。ST 编译功能实际在 `crates/audesys-hal-binding-gen/` 中
- **原因**: hal-binding-gen 原定为 Phase 1 的 HAL Binding Generator（D22），后扩展为完整 ST→HalProgram 编译器，但 crate 名未重命名
- **方案**: (a) 将 architecture.md 等文档中的 st-compiler 引用改为 hal-binding-gen；(b) 若未来需要独立 crate，可创建 audesys-st-compiler 并从 hal-binding-gen 中提取

### 架构文档 Tauri→Theia 迁移滞后
- **问题**: D71 将 Studio 从 Tauri+React 迁移到 Eclipse Theia（2026-07-21），但 architecture.md 中仍有 60+ 处 Tauri 引用（L1540 桌面端框架=Tauri 等）
- **方案**: P1 全面更新 architecture.md 的 Studio 相关章节（§三、§六），Panel 章节保留 Tauri（D65 独立 Tauri app 不受 D71 影响）

### 历史参考标签长期未添加
- **问题**: 7 月 15 日审计要求为 Machinekit/LabVIEW NXG/InTouch/GRBL 4 份参考文档添加历史参考标签，实际未执行
- **方案**: 2026-07-23 已添加。后续新停滞产品需同步标注

## Theia Studio 浏览器双端兼容（2026-07-23）

### @theia/core 多份物理副本 — 模块身份分裂
- **问题**: 6 个扩展有 `@theia/core` 物理副本（非 symlink），导致 `FrontendApplicationConfigProvider` 是不同单例。主应用 `set()` 后，扩展 `get()` 返回 null → 白屏
- **原因**: 扩展的 `@theia/*` 声明为 `dependencies`（非 `peerDependencies`），各自 `npm install` 创建了独立物理副本
- **方案**: (a) 将 `@theia/*` 改为 `peerDependencies`；(b) 删除扩展 `node_modules/@theia` 物理副本，symlink 到 app 的副本；(c) `npm dedupe` 全局去重

### React 重复实例 — HMI Designer useState 返回 null
- **问题**: HMI Designer 的 `node_modules/react` 是独立物理副本（React 18.3.1），与 app 的 React 19.2.8 不同实例。`React.createElement()` 在不同实例间无法共享 hooks 上下文
- **原因**: `react` 声明为 `dependencies`，npm install 创建了独立副本
- **方案**: 删除 HMI Designer `node_modules/react` 和 `react-dom`，symlink 到 app 副本

### Electron 安全令牌三层验证
- **问题**: 浏览器访问 Theia 时被 403/400 阻止。Theia 有三层 Electron 令牌验证：(1) Express `allowRequest` 中间件；(2) Socket.IO `allowRequest` 握手；(3) Socket.IO `allowConnect` 防御纵深
- **方案**: `token-patch.py` 绕过全部三层（字符串替换 + Socket.IO 中间件替换）

### electronTheiaCore polyfill 覆盖
- **问题**: 浏览器端缺少 Electron 原生 `window.electronTheiaCore` API。初始 polyfill 仅 5 个 API，实际需要 ~38 个（`onAboutToClose`、`onKeyboardLayoutChanged`、`setBackgroundColor`、`isFullScreenable` 等）
- **方案**: `postbuild.sh` + `index.html` 注入完整 38 API polyfill（从 studio-theia-test 移植）

### HMI Designer 命令 execute 为空
- **问题**: `audesys-hmi:open-designer` 命令注册了但 `execute` 为空——命令面板选中不打开任何 widget
- **原因**: 原实现 `execute: () => { /* widget opened via factory */ }`
- **方案**: 注入 `ApplicationShell` + `HmiDesignerWidget`，`execute` 中调用 `shell.addWidget(widget)` + `shell.activateWidget()`

### npm dedupe 对嵌套 @theia 包不彻底
- **问题**: `npm dedupe` 减少了重复包但未消除全部。`@theia/variable-resolver/node_modules/@theia/core` 等嵌套副本导致 DI 绑定冲突（`RawProcessFactory` 未绑定、`@injectable` 多次装饰）
- **方案**: `find` 遍历所有嵌套 `node_modules/@theia/`，逐包 `rm -rf` + `ln -sfn` symlink 到 app 根 `node_modules/@theia/`
- **位置**: `apps/studio-theia-test/` 已验证修复，`theia-extensions/audesys-core/`、`theia-extensions/audesys-debug/`、`theia-extensions/audesys-hmi-designer/` 三个扩展已集成并通过验证

## LD/FBD GLSP 编辑器集成（2026-07-24）

### ReactWidget 通过 new 创建 → @postConstruct 不触发 → 组件空白
- **问题**: `LdPaletteWidget`、`FbdPaletteWidget`、`LdEditorWidget`、`FbdEditorWidget` 四个组件通过 `new` 而非 DI 容器创建，导致 `@postConstruct()` 装饰器不触发，`ReactWidget.render()` 从未调用，组件 body 为空（仅 Perfect Scrollbar rail）
- **原因**: Theia 的 `ReactWidget` 依赖 `@postConstruct()` 中的 `this.update()` 触发 `onUpdateRequest → nodeRoot.render(this.render())`。通过 `new` 创建的对象不会触发装饰器生命周期
- **方案**: 在 `onAfterAttach(msg)` 中调用 `this.update()`，替代 `@postConstruct` 触发渲染

### LD 编辑器触点/线圈显示 ?? — 变量名硬编码
- **问题**: `ld-operation-handler.ts` 中 `addContact()` 和 `addCoil()` 硬编码 `variableName = '??'`
- **修复**: 自动递增命名：触点 `IN{n}`，线圈 `OUT{n}`

### LD 编辑器 SVG 不可见 — CSS 变量未定义
- **问题**: `ld-editor-widget.tsx` 的 `injectCssContent()` 只定义了布局类，未定义 `--ld-contact-no-fill`、`--ld-power-rail-color` 等 SVG 渲染变量
- **修复**: 在 `.ld-editor` 类中添加 14 个 CSS 变量（light + dark theme）

### E2E 测试覆盖不足 — 未验证渲染闭环
- **问题**: 自动测试仅验证按钮存在（TC-01~09），未验证元素放置后的 SVG 渲染（TC-10+），导致 ?? 标签和 CSS 变量缺失未被发现
- **方案**: 扩展测试到 5 层 26 测试，覆盖 L1 启动 → L2 元素创建 → L3 交互 → L4 状态 → L5 编译。约束：后续所有功能必须有对应测试

### LD 编辑器空画布点击无反应 — 需先创建 rung
- **问题**: 空 LD 模板 `rungs:[]`，点击触点/线圈工具后 canvas click handler 中 `findRungByY` 返回 null → 静默失败
- **修复**: 空画布时自动创建 rung（仅限触点/线圈类工具）


## Studio 双端构建与令牌修复 (2026-07-27)

### 捆绑 main.js 中的 engine.io allowRequest 损坏

- **问题**: lib/backend/main.js 中 engine.io 的 allowRequest 处理器缺少 if (!success) 检查 — ALL Socket.IO 请求无条件返回 403（FORBIDDEN）
- **症状**: 浏览器控制台中 Socket.IO polling 请求出现 20+ 个 403 错误，应用无法加载
- **原因**: 主JS捆绑文件中的调试修改残留：console.log('[DEBUG] calling allowRequest...') 和 console.log('[DEBUG] allowRequest callback...') — 回调忽略了 success 参数
- **修复**: 将损坏的处理程序恢复为正确的 engine.io 代码（含 if (!success) 守卫）
- **验证**: node_modules/engine.io/build/server.js 包含正确的原始代码 — 损坏仅存在于捆绑的 main.js 中
- **预防**: (a) 不要手动编辑捆绑文件；(b) 调试日志在提交前移除；(c) 添加 postbuild 完整性检查验证 engine.io allowRequest 未被损坏

### 双端测试状态 (2026-07-27)

| 测试类别 | 状态 | 详情 |
|----------|:----:|------|
| Rust 编译器 (ld/il/agent) | ✅ | 38+ tests pass, 0 fail |
| Runtime Pipeline | ✅ | 7/7 pass (0.26s) |
| Vitest (hmi-designer) | ⚠️ | 14/14 pass signal-validation, 3 suites fail (react module) |
| 浏览器访问 | ⚠️ | IDE 加载但未渲染 (@injectable 重复) |
| Electron 应用 | ✅ | 独立启动正常 |
| npm run build | ❌ | esbuild 8 errors (symlink后) |

### 双模式测试快速检查清单

**浏览器模式:**
1. curl http://127.0.0.1:3100 — 预期 200 + HTML
2. 浏览器访问 — 预期少于 5 个控制台错误（仅 favicon.ico 404 可接受）
3. 零个 Socket.IO 403 响应
4. 存在 .theia-app DOM 元素（IDE 完全渲染）

**Electron 模式:**
1. cargo test -p audesys-ld-compiler -p audesys-il-compiler -p audesys-agent
2. cargo test -p audesys-runtime --test pipeline_test
3. cd theia-extensions/audesys-hmi-designer && npx vitest run

## GLSP 依赖陷阱 (2026-07-27)

### sprotty-theia 死依赖 — GLSP 2.x 已废弃
- **问题**: theia-extensions/audesys-ld-glsp/package.json 声明 sprotty-theia ^0.12.0 作为依赖，但 GLSP 2.0（2023 年 10 月发布）已移除 sprotty-theia，由 @eclipse-glsp/theia-integration 替代
- **原因**: 代码从 GLSP 1.x 时期迁移而来，依赖声明从未更新。npm install 从未真正拉取 sprotty-theia（package.json 中声明但 node_modules 不存在）
- **方案**: 删除 sprotty-theia 依赖，替换为 @eclipse-glsp/theia-integration（2.7.0 版本锁定）。参考 .sisyphus/plans/glsp-migration/plan.md T0.1

### GLSP 核心依赖声明但未安装
- **问题**: @eclipse-glsp/client、@eclipse-glsp/protocol、@eclipse-glsp/server-node 在 package.json 中声明，但 node_modules 中不存在对应包
- **原因**: 依赖声明是迁移意图的残留，实际 npm install 从未执行过 GLSP 包的安装（可能被 npm dedupe 或后续 package.json 清理移除）
- **方案**: 按计划 T0.1 重新安装正确版本：@eclipse-glsp/client 2.7.0、@eclipse-glsp/protocol 2.7.0、@eclipse-glsp/server 2.7.0

### React+SVG 混合架构 — 非真正 GLSP
- **问题**: LdEditorWidget（929 行）使用 React+SVG 自定义渲染，通过 @xyflow/react 流程图库绘制，而非真正的 GLSP 图模型
- **原因**: 早期实现选择了 React+SVG 快速原型路径，与 GLSP 生态不集成。缺少 GLSP 提供的图模型管理、Command Framework、Undo/Redo、脏状态等能力
- **方案**: 按 Route C 计划进行全面 GLSP 迁移：Phase 1 实现 GLSP Client 连接，Phase 2 实现服务端，复用 ld-views.tsx（323 行 Sprotty IView）作为 IView 渲染组件

### LdSprottyDiagramWidget — 导出但从未实例化
- **问题**: LdSprottyDiagramWidget 在 src/ 中导出，但从未被任何 DI 容器实例化或绑定
- **原因**: 该 widget 是 GLSP 迁移的早期尝试，但从未连接 DI 容器。属于死代码
- **方案**: 在 GLSP 迁移 Phase 1 中，GLSP Theia 集成通过 DiagramOpener 创建 GLSPDiagramWidget，不再需要 LdSprottyDiagramWidget

### server/index.ts — 死代码
- **问题**: theia-extensions/audesys-ld-glsp/src/server/index.ts 定义了 launchLdServer() 和 LdDiagramModule，但从未被任何入口文件调用
- **原因**: 服务端代码是 GLSP 迁移架构的预留，但缺少 Theia 后端入口的注册。package.json 中 theiaExtensions 字段未注册 backend 入口
- **方案**: 按计划 Phase 1 注册 Theia 后端入口，连接 GLSP Server 启动器到 Theia 生命周期

## Theia 浏览器模式 404 (2026-07-28)

### BackendApplicationServer 绑定覆盖导致静态文件不服务
- **问题**: Theia 浏览器模式返回 404，前端 HTML/JS 无法加载
- **原因**: `@eclipse-glsp/theia-integration` 等模块先绑定了 `BackendApplicationServer`，但不含 `express.static` 中间件。`server.js` 中的 `isBound` 检查跳过了 `defaultServeStatic` 注册
- **方案**: 在 `lib/backend/main.js` 的 `start()` 函数中无条件调用 `defaultServeStatic(app)`，绕过 `isBound` 检查
- **社区先例**: Theia issue #15660 (2025-05) 官方正在开发 `theia build` 自动检测重复扩展

### @injectable 装饰器重复
- **问题**: 浏览器控制台报 `Cannot apply @injectable decorator multiple times`，IDE 白屏
- **原因**: npm 为不同 `@theia/*` 子包安装了不同版本的 `@theia/core`（如 1.73.0 vs 1.73.1），导致 inversify 容器中有多个装饰器定义
- **方案**: (a) 固定所有直接 `@theia/*` 依赖为精确版本 `1.73.0`（不用 `^`）；(b) 对非直接依赖添加 npm overrides；(c) `npm dedupe` 去重
- **社区先例**: Theia issue #3780, #7248, #7390, #10859；GLSP theia-integration README 推荐 resolutions/overrides
- **验证**: `npm ls @theia/core` 应只显示一个版本；`theia check:theia-extensions` 检测重复扩展

### postbuild.sh 正则补丁破坏 main.js
- **问题**: `token-patch.py` 使用贪婪正则 `[^}]*wsRequestValidator[^}]*\}` 替换 Socket.IO allowRequest，但匹配越界导致 `});` 残留和 `catch` 无 `try`
- **原因**: 正则 `[^}]*` 在多层嵌套的 JS 代码中不可靠，会跨过方法边界
- **方案**: 使用精确字符串匹配（Python `str.replace()`）替代正则；或用 AST 解析工具
- **教训**: 对打包后的 JS 文件做补丁，永远用精确字符串匹配，不用正则

### npm overrides 对直接依赖无效
- **问题**: `npm install` 报 `EOVERRIDE: Override for @theia/console@^1.73.0 conflicts with direct dependency`
- **原因**: npm overrides 不能覆盖直接依赖的版本，只能覆盖传递依赖
- **方案**: 直接依赖用精确版本（`"1.73.0"` 而非 `"^1.73.0"`），传递依赖用 overrides

### Playwright 浏览器未安装
- **问题**: Playwright 测试报 `Executable doesn't exist at .../chromium_headless_shell-...`
- **原因**: `npx playwright install` 未在 CI/开发环境中执行
- **方案**: 在 postinstall 或 CI 脚本中添加 `npx playwright install chromium`

## 编辑安全失误总结 (2026-07-28)

### 缺少闭合括号 ×3
- **问题**: 编辑 server/index.ts 时多次丢失类的闭合 `}`，导致 TypeScript 编译失败
- **原因**: 使用 `edit` 工具替换跨类边界的代码范围时，替换文本未包含闭合括号
- **方案**: (a) 编辑后执行 `grep -c '{' file && grep -c '}' file` 验证括号匹配；(b) 对复杂文件用 `write` 完整重写而非增量 `edit`

### 重复 import 行
- **问题**: 团队并发编辑后，ld-editor-widget.tsx 出现重复的 import 行
- **原因**: 多个代理同时修改同一文件，后写入者未检查已有内容
- **方案**: 编辑前先 `grep` 检查目标符号是否已存在

### 变量名覆盖 (h 覆盖 snabbdom h())
- **问题**: ld-gmodel-views.ts 中 `const h = model.size?.height ?? 60` 覆盖了 snabbdom 的 `h()` 函数
- **原因**: 使用 `sed` 批量替换时未检查变量名冲突
- **方案**: 重命名变量前 `grep` 所有同名引用；避免使用单字母变量名

### 测试覆盖盲区
- **问题**: 127 个单元/集成测试全部通过，但未发现浏览器白屏问题
- **原因**: 所有测试都是逻辑层验证（OperationHandler、IView 渲染、ModelState），没有 E2E 冒烟测试验证 Theia 启动和页面渲染
- **方案**: 每次构建后必须运行 E2E 冒烟测试（`startup-browser.spec.ts`），验证 HTTP 200 + 无 403 + 无 @injectable 错误 + IDE shell 渲染

### F12 DevTools 不弹出
- **问题**: Electron 窗口按下 F12 / Cmd+Option+I 无反应，DevTools 无法打开
- **原因**: Theia 拦截了键盘事件，路由到 IPC 调用 `webContents.openDevTools()`，但 IPC 通道在应用初始化完成前不可用。`--auto-open-devtools-for-tabs` 通过 `theia start --electron-args` 传递时也会失效
- **方案**: 在 `lib/backend/electron-main.js` 中直接注册 `globalShortcut.register('F12', ...)` 和 `Cmd+Option+I`，绕过 Theia 的 IPC 机制。已集成到 `fix-tokens.py` 自动修补

## Theia Bundle 模块重复陷阱 (2026-07-28) — ✅ 已通过 yarn workspaces 迁移解决

### Symbol 型 DI 标识符对模块重复极度敏感
- **问题**: LD palette contribution 绑定成功（console.log 确认），但 `initializeLayout` 从未被调用，widget 不显示
- **原因**: Bundle 中有 **2 个** `Symbol("FrontendApplicationContribution")`。LD 扩展的 `node_modules/@theia/core` symlink 导致 esbuild 将同一物理文件打包为两个独立模块。Symbol 是唯一的——两个模块实例产生两个不同 Symbol，LD 绑定到 Symbol B，Theia 用 Symbol A 收集 contributions
- **诊断方法**: `grep -c 'Symbol("FrontendApplicationContribution")' lib/frontend/bundle.js` — 必须为 1
- **方案**: 删除所有扩展的 `node_modules/`，让所有依赖通过 `apps/studio/node_modules/` 解析（Theia 官方标准模式）
- **验证**: `grep -c 'Symbol("FrontendApplicationContribution")' bundle.js` = 1
- **失败尝试（禁止重蹈）**: esbuild alias → DI 崩溃；nodePaths → DI 崩溃；只删部分 symlink → 不一致；给所有扩展加 symlink → 10 个 Symbol
- **教训**: 先调研 Theia 官方推荐方式再动手，不要凭直觉尝试 bundler 配置

### node_modules symlink 导致 bundler 模块重复
- **问题**: LD 扩展有 `node_modules/@theia/core -> apps/studio/node_modules/@theia/core` symlink，FBD 没有。Bundler 将 symlink 路径和直接解析路径视为不同模块
- **原因**: esbuild/webpack 按解析路径（非物理路径）去重模块。symlink 改变了解析路径
- **方案**: 扩展禁止拥有本地 `node_modules/`（包括 symlink 和物理副本）。所有共享依赖由 app 层提供
- **禁止**: 不要在扩展中运行 `npm install`——这会创建本地 node_modules 导致模块重复

### Theia 扩展 React 导入必须用 @theia/core/shared/react
- **问题**: `Cannot read properties of null (reading 'useState')` — React hooks 全部崩溃
- **原因**: 扩展直接从 `"react"` 导入，bundle 中产生多个 React 实例。React hooks 依赖单例 dispatcher，多实例导致 dispatcher 为 null
- **方案**: 所有 Theia 扩展中 React 导入统一为 `import React from '@theia/core/shared/react'`，react-dom 用 `@theia/core/shared/react-dom/client`
- **检查**: `grep -rn 'from "react"\|from '\''react'\''' theia-extensions/*/src packages/*/src --include="*.ts" --include="*.tsx" | grep -v "@theia/core/shared/react"` 必须为空

### Theia 官方做法被忽略 — 7h 调试代价 — ✅ 已通过 yarn workspaces 迁移解决
- **问题**: Symbol 重复问题耗费 7h 调试，根因是未遵循 Theia 官方推荐的依赖管理方式
- **原因**: (a) 读自己写的 conventions.md 而非 Theia 官方文档；(b) 把 workaround（两步构建+symlink）当作正确方案；(c) 验证“是否生效”而非“是否正确”
- **正确做法**: Theia 官方用 Yarn Workspaces monorepo + `dependencies`（非 peerDependencies）。yarn hoist 自动将 @theia/* 统一到根 node_modules，esbuild 通过单一路径解析，无 Symbol 重复
- **教训**: 遇到框架级问题时，第一步永远是查官方文档/社区经验，而不是凭直觉尝试配置。花 10 分钟调研可以省 3 小时试错
- **参考**: Theia Authoring Extensions + Composing Applications 文档
- **迁移计划**: 从 npm + file: link 迁移到 yarn workspaces，删除 build-glsp.sh，直接用 `yarn && theia build`

### 源码与 lib/ 编译文件不同步
- **问题**: FBD 图标重复——源码已删除 `onStart()` 方法，但 `lib/` 中仍有旧编译产物
- **原因**: 修改 `.ts` 源码后未重新编译（`tsc -b`），或编译失败但旧 lib 文件残留
- **方案**: (a) 修改源码后确认 `lib/` 同步更新；(b) 若 tsc 编译失败，直接整文件重写 lib/*.js（禁止用 sed 编辑编译后的 JS——sed 会破坏注释/括号结构）

### 括号平衡检查优先于错误行号
- **问题**: Playwright 报 `Unexpected token (95:0)` 指向空行，多次修复失败
- **原因**: 真正问题是 `test.describe()` 缺少闭合 `});`（26 open / 25 close），错误信息指向 EOF 而非缺失位置
- **方案**: 遇到 "unexpected token" 先运行 `node -e "const c=require('fs').readFileSync(f,'utf8'); console.log((c.match(/\{/g)||[]).length, (c.match(/\}/g)||[]).length)"` 检查括号平衡

### 先调研官方推荐再动手（元教训）
- **问题**: LD 图标消失后花了 3+ 小时尝试各种 bundler 配置（alias、nodePaths、symlink 增删），全部失败或引入新问题
- **原因**: 没有先调研 Theia 官方推荐的扩展开发模式。官方模式很简单：扩展不应有本地 node_modules，所有依赖通过 app 层解析
- **方案**: 遇到框架级问题时，第一步永远是查官方文档/社区经验，而不是凭直觉尝试配置。花 10 分钟调研可以省 3 小时试错

### 服务器启动方式混淆
- **问题**: `npm start` 启动 Electron 而非浏览器模式，导致测试连接失败
- **方案**: 浏览器模式用 `node lib/backend/main.js --port=3100`，不用 `npm start` 或 `npx theia start`

## GLSP 迁移陷阱 (2026-07-29)

### 手动编辑 lib/*.js 是错误做法
- **问题**: 直接编辑编译产物 lib/*.js，导致源码与 lib 不同步，下次编译丢失修改
- **原因**: 不理解构建流程。lib/ 是 tsc 编译产物，不是手写代码
- **方案**: 修源码 → `tsc -b` 编译 → 验证。禁止手动编辑 lib/
- **例外**: 仅当 tsc 完全不可用时（如缺少依赖），可临时补丁 lib，但必须同时修源码

### 扩展 node_modules 的正确用法
- **问题**: 完全删除扩展 node_modules 导致 tsc 无法编译（找不到 @theia 类型）
- **原因**: 混淆了构建时依赖和运行时依赖
- **方案**: 扩展 node_modules 用 **symlink** 指向 app 的 node_modules（构建用），esbuild 通过 preserveSymlinks=true 使用 app 模块（运行时无重复）
- **结构**: `theia-extensions/audesys-ld-glsp/node_modules/@theia/core -> ../../../apps/studio/node_modules/@theia/core`

### GLSP 视图类必须 @injectable
- **问题**: 打开 .ld 文件报错 `Views should be @injectable: MMn`
- **原因**: GLSP/Sprotty 要求所有 IView 实现类必须用 @injectable() 装饰
- **方案**: 所有视图类添加 `@injectable()` 装饰器，从 'inversify' 导入
- **检查**: `grep -n "class.*View" src/client/*.ts` 确认每个视图类都有 @injectable

### 编辑后必须验证
- **问题**: 多次 edit 后源码语法损坏（重复 import、多余括号）
- **方案**: 每次编辑后运行 `npx tsc --noEmit` 验证语法，不要积累未验证的修改

### 声称完成前必须 E2E 测试
- **问题**: 声称 Phase A 完成，但实际未测试打开 .ld 文件
- **方案**: 任何功能修复必须通过 E2E 测试确认（Playwright 打开文件、检查渲染、无报错）

### lib/ 编译产物过期导致源码修改无效
- **问题**: 修改源码添加 `onDidInitializeLayout()` 方法后，Theia 行为不变——方法在 `.ts` 源码中存在，但编译后的 `lib/*.js` 中不存在
- **原因**: 修改源码后未执行 `tsc -b` 或 `npm run build` 重新编译。Theia 的 `theia build` 只打包已编译的 JS 文件，不编译 TS 源码。扩展独立编译需 `@types/node`，缺少本地 node_modules 则编译失败
- **方案**: (a) 修改源码后执行 `npm run build`（app 级）；(b) 需要独立编译时，先创建必要的 symlink: `ln -sf ../../apps/studio/node_modules/@theia node_modules/@theia`
- **验证**: `grep -c '新方法名' lib/**/*.js` 确认编译产物包含修改
- **禁止**: 只改源码不重新编译就测试——这是本次会话的核心错误，耗费大量时间在已修复但未生效的问题上

### 非根因诊断链条过长
- **问题**: LD 面板不显示的调试中，先后尝试了 3 个错误方向：Symbol 重复（已排除）→ @injectable 缺失（非根因，FBD 也缺失但工作）→ Socket.IO 403（非主因），最终通过团队审核发现根因是 lib/ 过期
- **原因**: 单视角调试容易陷入局部最优——每个诊断都有部分证据支持但非全局根因
- **方案**: 复杂调试时使用团队审核模式（>2 次失败尝试后自动升级），多视角交叉验证
- **验证**: team_create 3 成员 server/client/completeness → team_task_create 并行分析
- **禁止**: 连续 3+ 次失败诊断后继续单打独斗（应升级到团队模式或 Oracle）


## GLSP 编辑器调试 (2026-07-30)

### GLSP 服务器 stdout 被端口发现机制消费
- **问题**: `console.log()` 在 GLSP 服务器进程中不输出到 Theia 日志
- **原因**: `GLSPSocketServerContribution` 读取子进程 stdout 用于端口发现，其他行被丢弃
- **方案**: GLSP 服务器调试日志必须使用 `console.error()`（stderr），stderr 被 Theia 后端捕获并写入日志文件
- **验证**: `grep '[PREFIX]' /tmp/theia-server.log` 出现日志即表示 stderr 通路正常
- **禁止**: GLSP 服务器代码中禁止使用 `console.log()` 调试——输出被吞掉

### GLSP StatusAction 分发失败导致 loadSourceModel 不被调用
- **问题**: 打开 .ld 文件后 loadSourceModel() 从未被调用，浏览器显示 rejectRequest 错误
- **原因**: RequestModelActionHandler.execute() 在 try/catch 之外调用 reportModelLoading()，该方法 dispatch StatusAction。如果无 handler 注册，doDispatch() 抛出 GLSPServerError("No handler registered for action kind: statusAction")
- **方案**: 在 LdDiagramModule.configureActionHandlers() 中注册 StatusActionNoOpHandler
- **关键代码**: apps/studio/node_modules/@eclipse-glsp/server/lib/common/features/model/request-model-action-handler.js 第 46 行
- **禁止**: 不要假设 GLSP 框架自动处理所有 action——每个 dispatched action 都需要 handler

### GLSP 服务器进程无法通过端口 kill 终止
- **问题**: kill $(lsof -t -i:3100) 只终止 Theia 后端，GLSP 服务器（随机端口）继续运行旧代码
- **原因**: GLSP 服务器由 GLSPSocketServerContribution 以独立进程启动，监听随机端口
- **方案**: 重启前务必杀掉所有残留 GLSP 服务器进程
- **验证命令**: `ps aux | grep 'ld-glsp.*server/index' | grep -v grep | awk '{print $2}' | xargs kill; ps aux | grep 'ld-glsp.*server/index' | grep -v grep | wc -l` 必须为 0

### Edge type 为 undefined 导致 GModelIndex 抛出
- **问题**: GModelIndex.doIndex() 抛出 "The type property of a GModelElement must not be undefined"
- **原因**: 测试用 .ld JSON 文件中 edges 缺少 type 字段，LdDiagramGenerator 直接使用 edge.type（undefined）
- **方案**: 使用 edge.type ?? 'edge:wire' 提供默认值
- **禁止**: 不要假设 JSON 文件中的字段都存在——生成器代码应使用默认值或 nullish coalescing

### esbuild 的 CJS 命名导出 re-export 不可靠
- **问题**: `import { SGraphView } from 'sprotty'` 在 esbuild 打包后为 undefined，Sprotty 报 "missing graph view"
- **原因**: sprotty 是 CJS 模块（exports.SGraphView = ...），通过 `export * from './graph/views'` re-export。esbuild 的 export * 处理对 CJS 命名导出不可靠
- **方案**: 从子路径直接导入: `import { SGraphView } from 'sprotty/lib/graph/views'`
- **注意**: 此问题可能仍未完全解决——需进一步验证

### 扩展 node_modules symlink 导致 Symbol 全部重复（D97 回归） — ✅ 已通过 yarn workspaces 迁移解决
- **问题**: 为修复 vitest 模块解析添加了扩展 node_modules symlink，导致 esbuild 将 @theia/core 打包两份。`Symbol("OpenHandler")` = 2, `Symbol("FrontendApplicationContribution")` = 2 等全部重复。所有 DI @inject() 静默失败——handler 从不实例化，`.ld` 文件以文本打开
- **原因**: esbuild 通过 symlink 路径和直接路径将同一模块解析为不同实例。即使 `preserveSymlinks=true` 仍可能因路径别名问题产生重复
- **方案**: 构建前移除 symlink → Symbols 全部 = 1 → DI 恢复。构建后恢复 symlink（GLSP 独立服务器进程需要 node_modules 解析依赖）
- **验证**: `for s in OpenHandler FrontendApplicationContribution OpenerService; do echo "$s: $(grep -c "Symbol(\"$s\")" apps/studio/lib/frontend/bundle.js)"; done` — 全部必须 = 1
- **构建两步法**: `rm theia-extensions/*/node_modules && npm run build && ln -sf ../../apps/studio/node_modules theia-extensions/*/node_modules`
- **禁止**: 不要在生产构建中保留扩展 node_modules（即使 symlink）

### GLSP 框架 toService() + inversify 6.2.2 不兼容
- **问题**: GLSPTheiaFrontendModule.registerDiagramManager() 调用 `bind(OpenHandler).toService(diagramManagerServiceId)` 创建 OpenHandler 绑定，但 Theia ContributionProvider<OpenHandler> 无法收集该绑定。GLSP diagram manager 的 canHandle() 从未被调用
- **原因**: inversify 6.2.2 的 toService() 创建 DynamicValue 绑定，在 Theia 1.73 的 ContainerBasedContributionProvider.getAll() 中不生效（疑似多注入版本行为变更）
- **方案**: 放弃 toService() 绑定。使用手动 OpenHandler + OpenerService.addHandler() 绕行
- **参考**: D99, D101

### Theia ContainerBasedContributionProvider 缓存问题
- **问题**: getContributions() 首次调用后永久缓存结果。后续绑定的 handler 不可见
- **方案**: 使用 OpenerService.addHandler() 动态注册（官方 API，不受缓存影响）

### GLSP 服务器启动需要 node_modules
- **问题**: GLSP 服务器作为独立 Node.js 进程运行（`node lib/server/index.js`），需要 node_modules 解析 @eclipse-glsp/* 依赖。移除扩展 symlink 后服务器启动失败
- **方案**: 构建后恢复 symlink。构建产物（bundle.js）不受影响——仅运行时服务器进程需要

### LdCreateNodeHandler: createCommand() 返回 commandOf() 导致节点创建失败
- **问题**: 将 execute() 改为 createCommand() + this.commandOf() 后，点击画布无法创建节点
- **原因**: commandOf() 回调中使用 this.modelState 时 this 上下文可能不正确，或 GLSP 2.x 框架对自定义 OperationHandler 的 commandOf() 支持不完整
- **方案**: 回归 execute() 模式——createCommand() 返回 undefined，execute() 直接操作 modelState。GLSP 框架在 execute() 后调用 submitModel() 触发 GModel 重新生成
- **验证**: 双击后能正常编辑
### 并行 edit() 导致重复代码
- **问题**: 多次 edit() 调用导致重复的 const existing、重复的 .type(edge.type)、重复的 console.error 行
- **原因**: 每次 edit 替换时未确认目标范围已被前次 edit 修改，产生残留代码

### 裸 npm run build 跳过 symlink 恢复 → GLSP 服务器静默失败
- **问题**: 修复 package.json 后用 `npm run build`（非 `npm run build:glsp`），build-glsp.sh 的 '恢复 symlink' 步骤被跳过。GLSP 服务器无法解析 `@eclipse-glsp/server` 模块，`GLSPSocketServerContribution` 捕获错误但仅写日志，不通知用户
- **原因**: `build-glsp.sh` 自动化了四步（去重→构建→验证→恢复），但裸 `npm run build` 仅构建。人工执行容易遗忘恢复步骤
- **方案**: 始终使用 `npm run build:glsp`（内部调用 build-glsp.sh）。或将 symlink 恢复加入 `postbuild` 钩子
- **验证**: `ls -la theia-extensions/audesys-ld-glsp/node_modules` 必须是 symlink → `../../apps/studio/node_modules`
- **禁止**: 不要用裸 `npm run build` 进行 GLSP 生产构建

### Yarn workspaces 迁移后 vitest 依赖解析失败
- **问题**: `@testing-library/dom` 缺失导致 hmi-designer vitest 测试全部失败（4 files fail）
- **原因**: yarn workspaces hoist 改变了依赖解析路径，`@testing-library/jest-dom` 的 peer dependency `@testing-library/dom` 未被正确解析
- **方案**: 暂时禁用 HMI designer（从 apps/studio/package.json 移除），待 vitest 依赖问题解决后重新启用
- **验证**: `cd theia-extensions/audesys-hmi-designer && npx vitest run` 应全部通过
- **状态**: 待修复（D106）
- **方案**: 每次 edit 后 Read 验证文件内容；同一文件 3 次以上 edit 使用 Write 整体重写
- **验证**: `grep -c '重复关键字' file.ts` 检查无意外重复计数 > 1

## FBD GLSP 迁移 (2026-07-31)

### snabbdom `h()` 变量名冲突 — 与 LD 同坑
- **问题**: `const h = model.size?.height ?? 60` 覆盖了 snabbdom 的 `h()` 函数，导致14个 `TS2349: This expression is not callable` 错误
- **原因**: snabbdom 的 `h()` 函数与高度变量 `h` 同名。TypeScript 解析时优先使用局部变量
- **方案**: 使用 `nodeH`/`nodeW` 而非 `h`/`w` 作为节点尺寸变量名
- **验证**: `grep -rn 'const h =' src/client/*.ts` 应返回 0 结果
- **禁止**: 禁止在使用 snabbdom `h()` 的文件中用 `h` 作为变量名

### GLSP `portFeature` 不存在
- **问题**: 导入 `portFeature` from `@eclipse-glsp/client` 报 `TS2724: has no exported member named 'portFeature'`
- **原因**: GLSP 2.7.0 没有 `portFeature`。Port 连接由框架自动处理，无需显式启用
- **方案**: PORT 类型只用 `selectFeature`，GLSP 自动处理 port-to-port 连接
- **验证**: `grep -rn 'portFeature' src/` 应返回 0 结果

### ActionHandler 导入路径 — 在 server 非 protocol
- **问题**: `import { ActionHandler } from '@eclipse-glsp/protocol'` 报 `TS2305: has no exported member`
- **原因**: `ActionHandler` 和 `ActionHandlerConstructor` 定义在 `@eclipse-glsp/server`，不在 `@eclipse-glsp/protocol`
- **方案**: `import { ActionHandler, ActionHandlerConstructor } from '@eclipse-glsp/server'`
- **验证**: `grep -rn 'ActionHandler.*protocol' src/` 应返回 0 结果

### snabbdom 不应作为直接依赖
- **问题**: 添加 `"snabbdom": "^3.5.1"` 到 package.json 后，yarn 创建本地副本，导致类型冲突
- **原因**: snabbdom 通过 `@eclipse-glsp/client` 传递引入。直接依赖创建了独立的物理副本，VNode 类型不兼容
- **方案**: 从 dependencies 中移除 snabbdom，使用传递依赖
- **验证**: `ls theia-extensions/audesys-fbd-glsp/node_modules/snabbdom` 应报 No such file
- **禁止**: 禁止将传递依赖添加为直接依赖

### `as const` 导致 readonly 类型冲突
- **问题**: `fileExtensions: ['.fbd'] as const` 产生 `readonly [".fbd"]`，无法赋值给 `string[]`
- **原因**: GLSPDiagramLanguage 的 fileExtensions 期望 mutable `string[]`，`as const` 产生 readonly tuple
- **方案**: 移除 `as const`，使用普通对象字面量
- **验证**: `npx tsc --noEmit` EXIT 0

### theia build 不编译扩展 TypeScript
- **问题**: `npx theia build` 成功但运行时报 `Cannot find module 'audesys-fbd-glsp/lib/theia/fbd-theia-backend-module'`
- **原因**: `theia build` 只打包已编译的 `.js` 文件，不编译 `.ts` 源码。扩展需要先 `npx tsc -b` 编译
- **方案**: 新建扩展后先 `npx tsc -b`（在扩展目录），再 `npx theia build`（在 apps/studio）
- **验证**: `ls theia-extensions/audesys-fbd-glsp/lib/theia/fbd-theia-backend-module.js` 应存在

### 反复 edit 破坏 Rust enum — 用 Write 重写
- **问题**: 为 IL 编译器添加 MOD/定时器/计数器助记符时，多次增量 edit 导致 enum 变体重复定义 (Gt×2, Eq×2, Ret×2...) 和分支被意外删除，累计 10+ 次编译修复
- **原因**: 增量 edit 在 enum/结构体上逐行添加时，替换范围边界容易错位，删除行时误删相邻分支，产生重复定义和缺失分支
- **方案**: 对 enum 定义区域使用 Write 整体重写（读全文→构造完整 enum→一次写入），不做增量 edit。此规则已存在于 edit-safety Rule 9 (复杂文件用 write)
- **验证**: `node -e "const c=require('fs').readFileSync(f,'utf8');console.log((c.match(/\{/g)||[]).length,(c.match(/\}/g)||[]).length)"` 括号平衡 + `cargo check`
- **禁止**: 禁止对 Rust enum 变体列表做逐行增量 edit — 每次修改前先读完整 enum 区域，用 Write 重写

## LD 网格集成 + 创建问题 (2026-08-03)

### yarn file: 依赖导致扩展代码不生效（物理副本）
- **问题**: 修改 `theia-extensions/audesys-ld-glsp/src/` 后反复"改了不生效"（rung:group 视图、ghost、hint 都如此），实际是 apps/studio/node_modules 中扩展是**物理副本**（yarn file: 依赖复制）而非 symlink
- **原因**: apps/studio/package.json 用 `"audesys-ld-glsp": "file:../../theia-extensions/..."` → yarn 视为独立包复制到 apps/studio/node_modules，源码改动不自动同步
- **方案**: 改为 semver 版本 `"audesys-ld-glsp": "0.1.0"`（yarn workspaces 自动 symlink 到 theia-extensions/）；`@audesys/theia-bridge` 不在 workspaces 保留 file:
- **验证**: `node -e "console.log(require.resolve('audesys-ld-glsp/package.json', {paths:['/Users/cxw/.../apps/studio']}))"` 应指向 theia-extensions/ 而非 apps/studio/node_modules
- **禁止**: 禁止在 apps/studio/package.json 用 file: 引用 workspace 内扩展

### GLSP 自定义 ghost 模板无 features → 不跟随鼠标
- **问题**: 自定义 ghostElement 模板（`{ template: { type: 'node:contact', size, args } }`）导致 ghost 不跟随鼠标（固定在初始位置），而默认 InsertIndicator 跟随正常
- **原因**: 模板 schema 不含 features 字段；NodeInsertTrackingListener 用 `isMoveable(ghost)` guard → 自定义模板实例化后无 moveFeature → 不跟踪
- **方案**: 用默认 InsertIndicator（自带 moveFeature），不传自定义 ghostElement；或用 GLSP 推荐的模板格式
- **验证**: ghost transform 应随鼠标移动变化（translate 值更新）
- **禁止**: 禁止给 NodeCreationTool 传无 features 的自定义 ghostElement 模板

### rung:group containableElementTypeIds 必须含 'node:insert-indicator'
- **问题**: 点击 rung 内创建节点失败，ghost 被阻止进入 rung（停在 rung 边界）
- **原因**: NodeCreationTool 的 ghost 是 InsertIndicator（type='node:insert-indicator'），NoOverlapMovementRestrictor 检查 `rung.isContainableElement(ghost.type)` → 若 rung 的 containableElementTypeIds 不含 'node:insert-indicator' → ghost 视为障碍被 restrict
- **方案**: 服务器 shapeTypeHints 中 rung:group 的 containableElementTypeIds 必须包含 'node:insert-indicator'（连同业务类型）
- **验证**: ghost 能平滑进入 rung 内部，点击创建成功
- **禁止**: 禁止容器 hint 的 containableElementTypeIds 遗漏 ghost 类型

### ChangeBoundsManager getMinimumMovement 对 InsertIndicator 返回 grid → ghost 卡顿
- **问题**: ghost 按 40px 跳跃且卡在错误位置（translate(160,-34)）
- **原因**: GLSP 默认 `getMinimumMovement` 对 InsertIndicator 返回 `gridManager.grid`（40×40）→ 任何 <40px 移动被重置 → ghost 无法微调
- **方案**: 客户端覆写 ChangeBoundsManager.getMinimumMovement，对 InsertIndicator 返回 {x:1,y:1}（GridSnapper 仍 snap 最终位置到 40px）
- **验证**: ghost 平滑跟随鼠标（1px 级），最终落点仍是 40px 倍数
- **参考**: `node_modules/@eclipse-glsp/client/lib/features/tools/change-bounds/change-bounds-manager.js`

### 网格背景 CSS 变量空 — 必须用 GGraphView
- **问题**: 网格背景类 'grid-background' 应用了但 --grid-background-width/height 为空 → bgSize: auto 网格不渲染
- **原因**: SGraphView 不注入 IGridManager，不写网格 CSS 变量；GGraphView 渲染时通过 getGridStyle 写入
- **方案**: graph 视图必须用 GGraphView（configureDefaultModelElements 默认注册，**不要**再 configureModelElement 覆盖 graph）
- **验证**: `getComputedStyle(graph).getPropertyValue('--grid-background-width')` 非空（= 40 × zoom）
- **禁止**: 禁止 configureModelElement 覆盖 'graph' 类型（会覆盖 GGraphView 丢失网格）

### GLSP 坐标偏差 — offsetX vs pageX 双重缩放
- **问题**: ghost 位置与鼠标图坐标约 2x 偏差（如鼠标图 (466,117)，ghost 显示 (240,7.5)）
- **原因**: MousePositionTracker.mouseMove 用 `event.offsetX/offsetY`（相对事件目标 DOM 元素），初始化用 pageX/pageY；当 graph root 有 transform（scale+translate）且 pointer-events 改变命中目标时，offsetX 在局部空间再经 parentToLocal 除 zoom → 双重缩放
- **方案**: 让事件命中 SVG 画布根（避免嵌套 transform 元素拦截），或覆写 mouse tracking 用 getAbsolutePosition
- **验证**: ghost 位置与鼠标图坐标一致（±40px snap）
- **注意**: 已知 GLSP edge case，改动需谨慎

### GLSP 服务器独立进程 — 修改后必须重启
- **问题**: 修改服务器代码（shapeTypeHints 等）后行为不变
- **原因**: GLSP 服务器是独立 node 进程（GLSPSocketServerContribution 启动），Theia 后端重启才会重新拉起
- **方案**: 修改服务器代码后：杀 GLSP 进程 + 重启 Theia 后端；或验证 require.resolve 指向最新 lib
- **验证**: `ps aux | grep 'glsp.*server/index' | wc -l` 重启后 = 1（新进程）
- **禁止**: 禁止只改 lib 不重启 GLSP 进程就验证

## GLSP 完全移除 — React Flow 迁移 (2026-08-03)

### GLSP 点击创建 3+ 轮调试失败 — 黑盒典型症状
- **问题**: LD 编辑器点击创建节点失败，机制链分析全部正常（事件到达、ghost 跟随、hint 注入、id 匹配）但 CreateNodeOperation 从未发出
- **原因**: GLSP 黑盒（minified bundle、5 层抽象：DI→Sprotty→GLSP→protocol→server、无断点、每轮调试 5min）
- **方案**: D110 完全移除 GLSP，迁移到 React Flow（标准 DOM，HMR 调试 <30s，Playwright 原生支持）
- **教训**: 框架黑盒 + 调试闭环慢（>5min/轮）时，3 轮失败后应质疑技术栈选择而非继续调试
- **禁止**: 不要在 GLSP 黑盒机制上继续"分析"— 机制链全通但功能不工作时是框架问题

### theia clean 删除 src-gen 后 gen-esbuild.electron.mjs 缺失
- **问题**: `theia clean` 后 `theia build` 失败 — esbuild.mjs 引用 `gen-esbuild.electron.mjs` 但 theia.target=browser 不生成它
- **原因**: 自定义 esbuild.mjs 硬编码 import electron 配置（D98 target=browser 时期的遗留）
- **方案**: 移除 esbuild.mjs 中 electron import/context（target=browser 不需要 electron bundle）
- **验证**: `npm run build` 3 门禁全过 + HTTP 200

### GLSP 决策废弃需逐项判定，非 blanket
- **问题**: 计划初稿"废弃 D92-D109"是错误的一刀切
- **原因**: D108（编译器管线）+ D105（Yarn Workspaces）是 Rust 编译器/构建系统设计，与 GLSP 无关
- **方案**: 逐项判定：废弃纯 GLSP（D92/93/97/99/101/103/104/107），保留通用（D95/96/98/105/106/108），部分处理（D94/100/102/109）
