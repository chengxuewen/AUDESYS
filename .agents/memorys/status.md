# AUDESYS 项目状态

## 当前阶段
- **Theia 迁移完成** — 2026-07-21，Studio IDE 从 Tauri+React 迁移到 Eclipse Theia+Monaco Editor+GLSP+napi-rs。6 语言编辑器就绪：ST Monaco ✅、IL Monaco ✅、G-code Monaco ✅、LD GLSP 编辑器 🟡、FBD GLSP 编辑器 🟡、SFC 编辑器 ✅。Signal Browser ✅、Scope View ✅、Debug Panel ✅、HMI Designer (Theia) ✅、Mode System ✅。Runtime Panel 不受影响（D65 保持有效）。
- **Studio ↔ Runtime 集成完成** — RuntimeClient 库（UDS IPC 客户端，6 方法+认证）、Studio napi-rs bridge 命令（deploy_program/load_hal_config/read_controller_signal）
- **协议适配器就绪** — Modbus RTU/TCP（8 测试）、HART（6 测试）
- **仿真器就绪** — SimulationHarness + 故障注入引擎 + 场景录制/回放 + VirtualModbusTcpDevice + VirtualHARTDevice
- **可观测性就绪** — Prometheus metrics + DAP 调试适配器（12 命令）+ JSON 日志
- **CNC 设计完成** — 2026-07-19，`docs/modules/cnc/` 5 份设计文档（G-code 编译器、运动规划器、轴组管理、竞品参考模型、插补引擎）+ 41 项 CNC SDD 规范 + architecture.md §七 CNC 章节
- **Runtime Panel 架构设计完成** — 2026-07-19，5 层架构（Shell/Plugin/WidgetRenderer/SignalBridge/Transport）、4 内置插件（OperatorLogin/AlarmManager/TrendRecorder/MultiScreenNav）、PC/Web 双形态、3 种部署拓扑、SignalProvider TS 接口、7 项架构决策（D60-D66）、新增 Role::HMI
- **SCADA 性能分析完成** — 2026-07-19，基于 8 家竞品（Ignition/FUXA/InTouch/iFIX/KingView/Beckhoff/CODESYS/LabVIEW）的 Web HMI 渲染性能、大数据处理、图表优化、认知负荷分析，生成 18 项优化建议（P1 8 项 + P2 7 项 + P3 3 项）、8 项陷阱清单
- **HMI 设计器就绪** — 2026-07-19，可视化拖拽编辑器（react-rnd 自由布局画布）、7 种工业 widget（Gauge/Trend/Tank/Indicator/Button/Display/Text）、信号绑定对话框（controller_signal_snapshot 集成）、属性面板（位置/尺寸/标签/信号/类型专属配置）、Edit/Preview 模式切换、YAML 持久化（save_hmi_layout/load_hmi_layout）

## 仓库状态
- **最新提交**: `f923088` — `perf(runtime): add criterion benchmarks for signal throughput, RPC, and registry ops`（当前会话未提交，含以下变更）
- **提交历史**: 197 commits on main (2026-07-08 至 2026-07-20)
- **源代码**: 24 crates（crates/）+ 1 Tauri 应用（apps/runtime-panel/）。apps/studio/ 已弃用（D71 Theia 迁移）
- **测试**: 799 `#[test]` 标注 + 19 个 vitest 测试文件 (134 tests) + 19 个 Playwright E2E UI 测试 (ld-editor.spec.ts 26 tests) |
- **SDD 规范**: 239 项（openspec/specs/7 份）：类型系统(30) + HalQoS(30) + Config Barrier(24) + 协议(37) + CNC(41) + HMI(22) + Studio Theia(55)
- **CI**: qa-fast 5 门禁（test/clippy/fmt/deny/unwrap）+ GitHub Actions macOS+Linux 矩阵
- **依赖**: `@colbymchenry/codegraph` (devDependency) + Rust toolchain stable

## 模块状态

| 模块 | 状态 | 备注 |
|------|:----:|------|
| ST 编译器 + HAL IR/VM | ✅ 完成 | 34 操作码，7 控制流，函数调用栈。ST 编译位于 audesys-hal-binding-gen（原 hal-binding-gen 扩展为完整 ST-HalProgram 编译器），非独立 crate
| IL 编译器 | ✅ 完成 | 21 IL 助记符 → HalProgram |
| LD 编译器 | ✅ 完成 | LD 图形 → IL 文本 → HalProgram |
| FBD 编译器 | ✅ 完成 | 功能块图 to HalProgram。2026-07-23 修复: 加入 workspace members
| SFC 编译器 | ✅ 完成 | 19 步进 → HalProgram |
| Runtime Engine | ✅ 完成 | 5 步周期，Config Barrier，Hot-swap，信号注册表 |
| Supervisor | ✅ 完成 | 子进程编排，指数退避，3 重试 |
| IPC Server | ✅ 完成 | UDS 10 方法（0x01-0x17），HMAC 认证，5 角色 RBAC |
| Studio IDE | ✅ Theia 迁移完成 | D71: Tauri+React → Eclipse Theia+Monaco+GLSP+napi-rs，迁移完成（2026-07-21） |
| Studio Theia 迁移 | ✅ 10/11 扩展集成 (apps/studio/) | 2026-07-23: core, debug, hmi-designer, backend, st-editor, il-editor, gcode-editor, sfc-editor, ld-glsp, fbd-glsp 全部可用。Electron+browser 双端正常（3层token+38API polyfill）。theia-bridge 21/30 函数真实实现（6编译器+7控制器+3模拟+2项目管理）。0测试。待办: 9 debug stub + widget 复用
|| LD GLSP Editor | 🟡 React+SVG 实现，GLSP 迁移计划中 | SVG 编辑器 + tool palette，触点/线圈放置，auto-rung，右键菜单。当前为 React+SVG 实现，GLSP 迁移计划中（2026-07-24 决定） |
|| FBD GLSP Editor | 🟡 React+SVG 实现，GLSP 服务端缺失，迁移计划中 | Eclipse GLSP 图形编辑器，FBD 功能块图 → HalProgram。当前为 React+SVG 实现，GLSP 服务端缺失，GLSP 迁移计划中 |
| ST Monaco Editor | ✅ 完成 | Monaco Editor 文本编辑器，ST 结构化文本 |
| IL Monaco Editor | ✅ 完成 | Monaco Editor 文本编辑器，IL 指令表 |
| G-code Monaco Editor | ✅ 完成 | Monaco Editor 文本编辑器，G-code RS274 |
| SFC Editor | ✅ 完成 | SFC 顺序功能图编辑器 |
| Signal Browser | ✅ 完成 | Theia Widget，信号注册表浏览/搜索 |
| Scope View | ✅ 完成 | Theia Widget，信号实时波形示波器 |
| Debug Panel (Theia) | ✅ 完成 | Theia Widget，8 源文件/7 测试，DI bindings 完整 |
| HMI Designer (Theia) | ✅ 完成 | Theia Widget，HMI 可视化设计器迁移完成 |
| Mode System | ✅ 完成 | 编辑器模式切换系统（6 语言 + HMI） |
| RuntimeClient | ✅ 完成 | UDS IPC 客户端（7 方法含 deploy_hmi_layout + 认证）|
| Studio ↔ Controller 联调 | ✅ 完成 | deploy_program + load_hal_config + read_controller_signal |
| Modbus RTU/TCP | ✅ 完成 | libmodbus FFI，8 测试 |
| HART 适配器 | ✅ 完成 | 通道多 Signal 模式，6 测试 |
| DAP 调试适配器 | ✅ 完成 | 12 命令，断点/步进/寄存器/变量 |
| Studio 调试面板 | ✅ 完成 | 9 Tauri 调试命令 + DebugPanel 组件 |
| Prometheus Metrics | ✅ 完成 | /healthz + /metrics 端点，6 计数器 |
| JSON 日志 | ✅ 完成 | 结构化日志，按级别/模块过滤 |
| SimulationHarness | ✅ 完成 | 进程内测试工具架，场景录制/回放 |
| 故障注入引擎 | ✅ 完成 | Timeout/OutOfRange/Disconnect，5 测试 |
| VirtualModbusTcpDevice | ✅ 完成 | 8 FC 处理，寄存器↔信号映射，12 测试 |
| VirtualHARTDevice | ✅ 完成 | 通用命令 0-3 模拟，13 测试 |
| IEC 功能块 | ✅ 完成 | SR/RS/R_TRIG/F_TRIG，266 测试全通过 |
| 仿真 | 🟡 Inproc | InprocMiddleware 已是 MVP 仿真层，AVD Phase 3+ |
| Simulator (AVD) | 🔮 Phase 3/4 | 7 种虚拟设备，设计完成 |
| 工业调试桥 | 🔲 规划中 | architecture.md §5 设计完成 |
| CNC 系统 | 🟡 编译器+轴组完成 | G-code (75 测试含 G2/G3)、轴组 crate (32 测试)、运动规划器提取中、插补设计文档完成 |
| Studio 插件架构 | ⚠️ 已废弃（D71 Theia 替代） | D58/D59 被 D71 取代：插件模型→Theia Extension System，PlatformAdapter→Theia Browser 模式 |
| Runtime Panel | ✅ 打包就绪 | 独立 Tauri app + IpcSignalProvider (100ms 轮询) + IpcLayoutLoader + 9 Tauri 命令 (含 push/subscribe/reconnect) + macOS/Linux bundle 目标配置。Role::HMI 待添加 (D64)。0 测试。Push 模式 P2
| HMI 设计器 | ✅ 完成 | 拖拽编辑器+7 widget+信号绑定+YAML 持久化+布局验证+部署，5 vitest 测试+3 Playwright E2E 测试
| HMI 部署管道 | 🟡 | IPC 0x17→Controller Config Barrier→Panel，P1 轮询（Push 模式待 P1 续建完成）|
| HMI 调试能力 | 🟡 基础具备 | SignalInjector+布局验证器已实现，P2: 渲染性能监控+断点调试

## P0-P2 阶段完成状态

| 阶段 | 主要交付 | 日期 | 状态 |
|------|---------|------|:----:|
| P0 | CI (qa-fast 5门禁), Workspace 结构, 24 crates 骨架 | 2026-07-15 | ✅ |
| P1 | 5 IEC 61131-3 编译器 (ST/IL/LD/FBD/SFC), Runtime Engine, IPC Server | 2026-07-20 | ✅ |
| P1 | Theia 迁移 (D71), 6 语言编辑器, HMI Designer, GLSP 编辑器 | 2026-07-21 | ✅ |
| P1 | Modbus RTU/TCP, HART 适配器, SimHarness | 2026-07-19 | ✅ |
|| P2 | LD GLSP Editor (Sprotty SVG), FBD GLSP Editor — React+SVG 实现，GLSP 迁移计划中 | 2026-07-24 | 🟡 |
| P2 | Runtime Panel 打包 (tauri bundle), SignalBridge push/poll, 9 Tauri 命令 | 2026-07-25 | ✅ |
| P2 | G-code 编译器 (75 测试), CNC 轴组 (32 测试), 插补设计 | 2026-07-19 | ✅ |
| P2 | Prometheus metrics, DAP 调试 (12 命令), JSON 日志 | 2026-07-20 | ✅ |
| P3 | AVD 仿真 (7 虚拟设备), amw-zenoh 网络传输 | 🔮 | 🔮 |
| P4 | NixOS 打包, OTA, IEC 62443 认证 | 🔮 | 🔮 |

## 文档与规范

| 类别 | 状态 | 备注 |
|------|:----:|------|
| HAL 设计文档 | ✅ 完成 | `docs/modules/hal/` 19 份子文档 |
| Runtime 设计文档 | ✅ 完成 | 6 份：IPC 安全+可观测+硬件+升级+Panel架构+审计日志 |
| CNC 设计文档 | ✅ 完成 | `docs/modules/cnc/` 5 份子文档 + SDD 规范 |
| Studio 设计文档 | 🟡 设计完成 | `docs/modules/studio/` 2 份设计文档（plugin-architecture-design + theia-architecture） |
| Runtime Panel 设计文档 | ✅ 完成 | `docs/modules/runtime/` 新增 1 份：panel-architecture-design.md（5层架构+PC/Web双形态+插件模型） |
| 竞品参考文档 | ✅ 完成 | `docs/reference/` 41 篇（12 大类） |
| SDD 规范 | ✅ 完成 | `openspec/specs/` 7 份规范，239 项（新增 HMI 管道规范） |
| 架构文档 | ✅ 完成 | `docs/architecture.md` 2,110 行，七章 |
| 文档审计 | ✅ 完成 | 两次审计：50+32 项发现，77 项修复 |
| 实施规划 | ✅ 完成 | D31-D55 已记录，P0 团队审查通过 |
- **D67-D69** HMI 设计决策（sim_set_signal 复用、IPC 0x17 DEPLOY_HMI_LAYOUT、YAML Git 版本管理）
- **D70** Studio 响应式布局（`min-height:0` on `.app-panel`、html/body `background: var(--color-canvas)` 去白边）

## 技能库

| 技能 | 状态 | 用途 |
|------|:----:|------|
| design-system | ✅ | AUDESYS 工业 UI 设计系统 |
| book-to-skill | ✅ | 文档→技能转换 |
| doc-audit | ✅ | 6 维度文档架构审计 |
| test-harness | ✅ | 多语言自动化测试工具架（6 模式） |
| skill-creator | ✅ | 从 HAL/SDD/FlatBuffers/Cargo 生成技能 |
| openspec-propose | ✅ | 结构化变更提案 |
| openspec-apply | ✅ | 变更实施（TDD + 7 门禁） |
| openspec-verify | ✅ | 交叉层规范验证 |
| openspec-explore | ✅ | 4 源知识探索 |
| openspec-archive | ✅ | 变更归档 |
| openspec-sync-specs | ✅ | 增量规范同步 |
| ref-codesys/ref-beckhoff/ref-qtouch | ✅ | Studio 参考技能（7 项） |
| think-before-act | ✅ | 先调研→列方案→审批→执行，防蛮干（不限语言/框架） |
| ecosystem-scan | ✅ | 双层审计（Quick/Full）+ 生态扫描 + 安全门禁 |
| skill-guide | ✅ | 常驻技能选择指南（决策树 + 场景组合） |
| skill-router | ✅ | 主动技能路由分析（任务分类→技能匹配） |

## 架构演进 (2026-07-24)

- **架构重新设计完成** — `docs/superpowers/specs/2026-07-24-robotics-architecture-design.md` (1864 行, 48 章节)，覆盖统一自动化平台全栈架构
- **命名体系重定义**:
  - Supervisor → **Agent** (车端管理代理)
  - Controller → **Runtime** (实时运行时)
  - Field + Cloud → **Hub** (统一插件化平台)
- **新增 crates 规划**: `audesys-agent` (从 Supervisor 改名), `audesys-hub` (新仓库)
- **Studio 双形态**: Desktop (CODESYS IDE 模式) + Web (Hub 插件模式)
- **新增功能设计**: 配方管理(ISA-18.2)、告警管理、审计追踪(21 CFR 11)、控制器冗余(Hot Standby)、时间同步(PTP)、数字孪生
- **15 项新架构决策**: D77-D91 已记录于 decisions.md

## M1 里程碑 (3D 打印机控制器)

- **目标**: 以光固化打印机验证 IEC 61131-3 + HMI + 硬件 IO 全链路
- **子任务**: Agent+Runtime 联调 → ST 端到端 → FBD 端到端 → SFC+G-code → HMI 设计 → 硬件 IO → 收尾
- **计划**: 7-8 周, `.sisyphus/plans/m1-3d-printer-platform/`


## Studio 双端测试状态 (2026-07-27) — 已废弃（被 2026-07-28 修复取代）

见下方 2026-07-28 章节

**Socket.IO 修复**: 捆绑 main.js 中的 engine.io allowRequest 处理器已损坏（调试残留导致所有请求返回 403）。node_modules 源码正确，仅捆绑版本受影响。已应用修复。详见 pitfalls.md。

## Studio 双端构建修复 (2026-07-27) — 已废弃（被 2026-07-28 修复取代）

见下方 2026-07-28 章节
## Studio 双端构建修复 (2026-07-28)

- **esbuild 构建修复**: 删除所有扩展 node_modules → Symbol 去重 → LD/FBD 图标正常
- **浏览器菜单修复**: theia.target 改为 browser → browser-menu-module 加载 → 原生 Web 菜单可点击
- **React hooks 修复**: 所有扩展 React 导入改为 @theia/core/shared/react, 0 errors
- **@audesys/theia-bridge**: 添加到 studio dependencies（扩展不再自带）
- **LD palette onStart 移除**: 防止重复创建 widget
- **PC+Web 共存**: theia.target=browser, 一次构建 → 三目标 (browser/node/electron), 双端功能对齐
- **think-before-act 技能**: 新增元约束技能，先调研→列方案→审批→执行

### 双端测试状态 (2026-07-28)

| 测试类别 | 状态 | 详情 |
|----------|:----:|------|
| Rust 编译器 (ld/il/agent) | ✅ | 38+ tests pass, 0 fail |
| Runtime Pipeline | ✅ | 7/7 pass (0.26s) |
| E2E Smoke (S1-S6) | ✅ | 6/6 pass (24.9s) |
| Vitest (hmi-designer) | ⚠️ | 14/14 pass signal-validation, 3 suites fail (react module) |
| 浏览器访问 | ✅ | IDE 渲染正常, 菜单栏可点击, LD/FBD 图标正常, 0 Socket.IO 错误 |
| Electron 应用 | ✅ | 窗口启动正常, 双端功能对齐, Web 渲染菜单替代原生 |
| npm run build | ✅ | 0 errors, 3 targets (browser/node/electron) |

### 诊断清单

```bash
# Symbol 唯一性（必须 = 1）
grep -c 'Symbol("FrontendApplicationContribution")' lib/frontend/bundle.js

# React 导入检查（必须为空）
grep -rn 'from "react"' theia-extensions/*/src packages/*/src --include="*.ts" --include="*.tsx" | grep -v "@theia/core/shared/react"

# 扩展本地 node_modules 检查（必须为空）
find theia-extensions -path "*/node_modules/@theia*" 2>/dev/null

# 启动命令
# Web:  node lib/backend/main.js --port=3100
# PC:   npx electron lib/backend/electron-main.js
```

## Ecosystem Scan (2026-07-29)

### P0 完成
- D97 重复合并 → decisions.md 1 个 D97
- openspec-apply-change 删除（被 openspec-apply 取代）
- openspec-archive-change 删除（被 openspec-archive 取代）

### P1 内部完成
- testing.md: +5 条可执行命令
- security.md: +1 条可执行命令

### P1 外部
- testmu-ai/playwright-skill: GitHub 0 结果，仓库不存在
- testmu-ai/vitest-skill: GitHub 0 结果，仓库不存在
- trailofbits/security-skills: GitHub 0 结果，仓库不存在
- 已有覆盖: Playwright MCP + vitest 实际使用 + security.md 规则

### 技能数
- 删除: 2 (openspec-apply-change, openspec-archive-change)
- 新增: 4 (ecosystem-scan, lesson-review, skill-guide, skill-router)
- 净变化: +2（23 → 25）

### Agent 模型分层优化 (2026-07-29)
- prometheus: premium → premium-max（计划生成错误代价最大）
- metis: premium → fast（度量分析是 pattern matching）
- oracle/prometheus: +reasoningEffort: "high"
- ultrabrain: +reasoningEffort: "high"
- unspecified-high: +reasoningEffort: "medium"
- explore: temperature 0.0 → 0.1
- timeout_seconds: 30 → 60

### 技能 frontmatter 修复
- 9 个技能添加 name + description: lesson-review, think-before-act, ref-beckhoff, ref-codesys, ref-fuxa, ref-ignition, ref-intouch, ref-labview, ref-qtouch

### OMSPBase 对比扫描
- 配置已同步: prometheus/metis/reasoningEffort/timeout
- 无需额外添加: teams 配置、platform.md

### LD/FBD 工具面板修复 (2026-07-29)
- 根因: `initializeLayout()` 仅在首次启动时调用，后续启动恢复保存的布局
- 修复: 添加 `onDidInitializeLayout()` + 防重复守卫（Theia 官方推荐模式）
- 发现: lib/ 编译产物过期导致修复在源码中存在但编译后不生效
- 教训: 修改源码后必须验证 lib/ 编译产物（已添加 edit-safety Rule 13）

## Theia 参考文档 + GLSP 调试 (2026-07-30)

### GLSP 编辑器验证 (ld-glsp-verify-editor)
- **状态**: 9/15 任务完成，图表渲染阻塞
- **修复**: loadSourceModel 文件读取 ✅、StatusAction handler ✅、边缘 type 默认值 ✅、Socket.IO 403 ✅
- **阻塞**: sprotty vs @eclipse-glsp/sprotty DI Symbol 不匹配导致 ViewRegistry 找不到 graph view
- **方案**: 混合导入 — views 从 @eclipse-glsp/sprotty，features 从 sprotty（D99）

### 参考文档库扩展
- 新增: `docs/reference/glsp.md` (770行) — Eclipse GLSP 产品画像 + node-json-theia 模板深度分析
- 新增: `docs/reference/theia-architecture.md` (441行) — Eclipse Theia 架构深入分析（DI、扩展、Widget、生命周期）
- 新增: `docs/reference/theia.md` (310行) — Eclipse Theia 产品画像
- 新增: `docs/reference/neuron-smart-engineer.md` (216行) — Neuron Smart Engineer 分析
- 新增: `docs/reference/theia-projects.md` (104行) — Theia 工业生态对比
- 修正: Neuron Smart Engineer 使用 VS Code 扩展架构（非 Theia）— D100

### 技能库更新
- pitfalls.md: 追加 GLSP 调试章节 (7条) — stdout 消费、StatusAction handler、进程 kill、边缘 type、CJS 导出、并行 edit
- edit-safety.md: 追加 Rule 14-18
- decisions.md: 追加 D99 (GLSP 模块隔离), D100 (Neuron 技术栈修正)

### 清理
- .sisyphus/ 过时文件已清理（审计、旧计划、旧 spec、旧 teams）
- 保留活跃文件: ld-glsp-verify-editor.md, ld-glsp-cleanup.md, dual-mode-test-report.md

## LD GLSP 编辑器修复 (2026-07-30)

### 根因与修复
- **Symbol 重复**: 扩展 node_modules symlink 导致所有 @theia/core Symbol 在 bundle 中重复 (=2)，全部 DI 注入静默失败
- **修复**: 构建时移除 symlink，构建后恢复（服务器需要）。Symbol 去重后 `[LD Opener]` bootstrapping/constructed/registered 全部出现
- **OpenHandler 注册**: 使用 `FrontendApplicationContribution.onStart()` + `OpenerService.addHandler()` 手动注册，绕过 inversify 6.2.2 + Theia 1.73 环境下 `toService()` 不被 `ContributionProvider` 收集的问题
- **编辑功能**: 还原 `execute()` 模式（`createCommand()` 返回 undefined），GLSP 框架自动触发 GModel 重新生成

### 提交
- `5934369` revert to execute() pattern
- `7984c3c` bypass Symbol duplication via manual OpenHandler + bootstrap
- `bc45078` bind OpenHandler in plain ContainerModule
- `446c6db` use commandOf() pattern (已回退)
- `2e8c04a` configureDefaultModelElements + import unify + ComputedBoundsActionHandler

### 新增决策
- D103: 构建时移除扩展 node_modules symlink
- D104: LD GLSP OpenHandler 注册策略 — OpenerService.addHandler()

### 记忆更新
- pitfalls.md: 新增 5 条（Symbol 重复、toService 不兼容、缓存问题、服务器 node_modules、commandOf 失败）
- edit-safety.md: 新增 Rule 19 — 构建后 Symbol 唯一性检查
- conventions.md: 新增 GLSP 构建两步法
