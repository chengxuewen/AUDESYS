# AUDESYS MVP 统一计划

> 创建日期：2026-07-20
> 整合范围：取代以下 6 份旧文档，形成唯一计划入口
> - ~~`p0-milestone-roadmap.md`~~ — P0 里程碑已过期
> - ~~`p0-mvp-acceptance.md`~~ — 全部验收项已通过
> - ~~`p0-phase0-bootstrap.md`~~ — Phase 0 已完成
> - ~~`p0-sdd-tdd-ludwig.md`~~ — D33 修订为直接 TDD，Ludwig 方案已废弃
> - ~~`tdd-audit-report.md`~~ — 一次性审计，无后续行动项

**唯一计划入口**。创建于 2026-07-20。

已删除的旧文档（2026-07-20 清理）：
- ~~p0-milestone-roadmap.md~~ — P0 里程碑已过期
- ~~p0-mvp-acceptance.md~~ — 全部验收项已通过
- ~~p0-phase0-bootstrap.md~~ — Phase 0 已完成
- ~~p0-sdd-tdd-ludwig.md~~ — D33 修订为直接 TDD，Ludwig 方案已废弃
- ~~tdd-audit-report.md~~ — 一次性审计，无后续行动项
- ~~p0-mvp-status.md~~ — 核心内容已整合入本文档

---

## 目录

- [0. 模块状态表](#0-模块状态表)
- [1. P0 回顾：已完成的里程碑](#1-p0-回顾已完成的里程碑)
- [2. P1 核心：Studio Theia 迁移](#2-p1-核心studio-theia-迁移)
  - [2.1 背景与动机](#21-背景与动机)
  - [2.2 架构决策](#22-架构决策)
  - [2.3 任务分解](#23-任务分解)
  - [2.4 关键依赖链](#24-关键依赖链)
  - [2.5 并行化机会](#25-并行化机会)
- [4. P2 前瞻](#4-p2-前瞻)
- [5. Phase 5: Cleanup & Sunset](#5-phase-5-cleanup--sunset)
- [6. 里程碑时间线](#6-里程碑时间线)
- [附录 A：旧文档裁决](#附录-a旧文档裁决)
- [附录 B：关键设计决策引用](#附录-b关键设计决策引用)
- [附录 C：测试与质量基线](#附录-c测试与质量基线)

---

## 0. 模块状态表

| 模块 | 状态 | 关键能力 |
|------|:----:|----------|
| **ST/IL/LD/FBD/SFC 编译器** | ✅ | 6 语言 IEC 61131-3 编译器（D57），全部编译到 HalProgram 后端 |
| **G-code 编译器** | ✅ | RS274 子集，G0/G1/G2/G3/G90/G91，75 测试（D55） |
| **HAL IR/VM** | ✅ | 34 操作码，定时器+计数器+触发器，函数调用栈，数组 |
| **Runtime Engine** | ✅ | 5 步周期引擎（Config Barrier→Read→Compute→VM→Write），信号注册表 |
| **Supervisor** | ✅ | 子进程编排，指数退避重启（3重试），UDS 状态推送 |
| **IPC Server** | ✅ | 17 方法 UDS 协议（0x01-0x17），HMAC-SHA256，6 角色 RBAC（含 HMI） |
| **ControllerClient** | ✅ | UDS IPC 客户端，7 方法含 deploy_hmi_layout + deploy_program |
| **Studio IDE** | 🟡 | Tauri+CodeMirror 6，8 面板，35+ Tauri 命令，6 编辑模式 + HMI 设计器 | Theia 迁移计划中（22-31周） |
| **HMI 设计器** | ✅ | react-rnd 拖拽布局，7 种工业 widget，信号绑定，YAML 持久化（D67-D69） |
| **HMI 部署管道** | 🟡 | IPC 0x17→Controller Config Barrier→Panel，Panel P1 轮询 |
| **Runtime Panel** | 🟡 | 独立 Tauri app，IpcSignalProvider (100ms)，IpcLayoutLoader，5 命令 |
| **CNC 系统** | 🟡 | G-code 编译器+轴组 crate (32 测试)，运动规划器+插补设计中（D55） |
| **IEC 功能块** | ✅ | SR/RS/R_TRIG/F_TRIG，266 测试全通过 |
| **Modbus 适配器** | ✅ | RTU/TCP，libmodbus FFI，8 测试 |
| **HART 适配器** | ✅ | 通道多 Signal 模式，6 测试 |
| **DAP 调试器** | ✅ | 12 命令，断点/步进/变量，Studio 调试面板可操作 |
| **SimulationHarness** | ✅ | 进程内测试+场景录制/回放+故障注入+虚拟设备 |
| **可观测性** | 🟡 | Prometheus + JSON 日志已验证，告警/SQL 审计日志设计中 |
| **Studio Theia 迁移** | 🔲 待启动（22-31周） | D71 决策：Tauri+React → Eclipse Theia，`docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md` |

---

## 1. P0 回顾：已完成的里程碑

以下是 P0 阶段全部完成的里程碑，记录供参考。

### M0：基础设施（✅ 已完成）
- Cargo workspace 结构：21 crates + 2 Tauri apps
- CI/CD：`qa-fast.sh` 5 门禁（test/clippy/fmt/deny/unwrap），GitHub Actions macOS+Linux 矩阵
- 测试基础设施：737 `#[test]` + 17 vitest 组件测试 + 15 Playwright E2E
- SDD 规范：186 项（`openspec/specs/` 6 份）
- 单元测试框架：Rust (`#[test]`) + Vitest (前端)

### M1：编译器实现（✅ 已完成）
- 6 语言 IEC 61131-3 编译器（ST/IL/LD/FBD/SFC/G-code）
- 统一 HalProgram 后端，零 VM 变更
- IEC 功能块：SR/RS/R_TRIG/F_TRIG，266 测试
- 266 测试全通过

### M2：运行时实现（✅ 已完成）
- Runtime Engine：5 步周期引擎（Config Barrier→Read→Compute→VM→Write）
- Supervisor：子进程编排，指数退避（3 重试）
- IPC Server：17 方法 UDS 协议，HMAC-SHA256，6 角色 RBAC
- ControllerClient：7 方法 IPC 客户端

### M3：Studio IDE 实现（✅ 已完成）
- Tauri + React + TypeScript + CodeMirror 6
- 8 面板：编辑器/SignalWatch/Debug/Observable/Simulator/Project/Error/Status
- 35+ Tauri 命令
- 6 种编辑模式：ST/IL/LD/FBD/SFC/HMI
- HMI 可视化设计器：react-rnd 拖拽，7 widget，YAML 持久化

### M4：协议与仿真（✅ 已完成）
- Modbus RTU/TCP：libmodbus FFI，8 测试
- HART：通道多 Signal，6 测试
- DAP 调试器：12 命令
- SimulationHarness：场景录制/回放，故障注入，虚拟设备

---

## 2. P1 核心：Studio Theia 迁移

### 2.1 背景与动机

**决策变更**：原 D58 插件化重构计划已取消。经评估（Fork VS Code 每周发版不可行、CodeBlitz 无调试/无 Rust LSP、自建+成熟库仍缺 13/16 项通用 IDE 功能），决定将 Studio 从 Tauri+React 自建架构迁移到 Eclipse Theia 框架。

**关键参考**：Neuron Automation 已基于 Theia+GLSP 构建 IEC 61131-3 IDE（ST/FBD/LD）并在生产环境运行。TI、ST、Arm、Samsung 等主流厂商均采用 Theia。

### 2.2 架构概览

- **Theia Frontend**: Monaco Editor (ST/IL/G-code) + GLSP (LD/FBD) + ReactWidget (HMI/Scope) + Theia Widgets
- **Theia Backend**: Node.js + napi-rs → Rust Runtime (35K 行零修改)
- **Plugin Host**: VS Code 扩展兼容（Open VSX）

### 2.3 任务分解（5 Phase / 28-36 周）

> 估时已根据三审修正（arch-auditor + theia-expert + migration-feasibility，15 项 MUST-FIX）。
> 原始 11-14 周估时低估了 GLSP 编辑器（13 天→6-10 周）、napi-rs worker_thread、ReactWidget 冲突解决等工作量。

#### Phase 1: 基础设施（5-6 周）

**目标**：Theia 骨架可运行、napi-rs 桥接通、现有 737 Rust 测试全通过。

| 任务ID | 任务 | 产出 | 估时 | 依赖 |
|--------|------|------|:---:|------|
| **T1.1** | Theia 应用骨架搭建 | `apps/studio-theia/` 目录，package.json，Theia extension 结构，Hello World 启动，含 Electron 安全配置（contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true） | 3 天 | — |
| **T1.2** | napi-rs 绑定层 | `crates/audesys-theia-bridge/`（~500-1000 行），34 个 Tauri 命令→~25 个 napi-rs 函数（compile_st/compile_ld/compile_il/compile_fbd/compile_sfc/compile_gcode/read_signal/signal_snapshot/deploy_program/deploy_hmi_layout/health_query 等） | 5 天 | — |
| **T1.3** | worker_thread 架构验证 | 验证 napi-rs 在 `worker_threads` 中运行不阻塞 Node.js 事件循环。DAP 适配器保留为独立进程 | 1 周 | T1.2 |
| **T1.4** | Theia Backend Service | `theia-extensions/audesys-backend/`（~300 行），JSON-RPC 代理，JSON Schema 参数校验，RBAC 中间件（复用 HMAC + 6 角色），rate limiting，审计日志（napi-rs 调用 + 扩展生命周期） | 3 天 | T1.2 |
| **T1.4a** | Controller 生命周期适配器 | Controller 进程管理（启动/停止/心跳/重连），UDS socket 管理，HMAC 认证适配。将 Tauri 的 Controller 子进程管理适配为 Theia Backend Service 独立管理 | 3 天 | T1.2 |
| **T1.5** | CI/CD 适配 | GitHub Actions Electron build matrix (macOS/Linux/Windows)，napi-rs 三平台交叉编译，Electron 代码签名。实际完成时间取决于代码签名证书获取（预计 2 周）。维持现有 Tauri CI 绿色（双轨：每次 Rust 修改后同时触发 Tauri + Theia CI） | 3 天→2 周 | T1.1 |
| **T1.6** | Theia 学习 workshop | 团队掌握 Theia extension DI（inversify）、Contribution 体系、GLSP 架构、Monaco 自定义。可并行 T1.1-T1.4 | 1 周 | — |
| **T1.7** | Open VSX 安全配置 | 扩展白名单（0 第三方），Plugin Host 沙箱隔离，FS 只读 | 2 天 | T1.1 |
| **T1.1t** | Theia 启动 Smoke 测试 | `apps/studio-theia/smoke/startup.spec.ts`：骨架启动→窗口出现→Console 无错误 | 0.5 天 | T1.1 |
| **T1.2t** | napi-rs 编译单元测试 | 每函数 2+ 用例（正常+错误路径），覆盖 STH-BRIDGE-001~010 | 2 天 | T1.2 |
| **T1.3t** | napi-rs worker_thread 集成测试 | 并行调用 5 个 napi-rs 函数验证无阻塞，运行 100 次迭代验证稳定性 | 1 天 | T1.3 |
| **T1.4t** | Theia Backend RBAC + Schema 测试 | 6 角色各 1 用例（允许+拒绝），JSON-RPC schema 验证，rate limiting 测试 | 1 天 | T1.4 |

**出入口条件**：① napi-rs 单元测试 10+ 通过 ② 现有 737 Rust 测试零回归 ③ Theia 启动 Smoke 通过 ④ napi-rs 5 个核心函数在 worker_thread 中通过 ⑤ Controller 连接/心跳/重连生命周期通过。Tauri Studio 保持可用（双轨运行）。回滚条件：napi-rs 延迟 > 2× Tauri 基线。

#### Phase 2a: GLSP LD 编辑器（7-11 周）

> **规模修正**（三审 §10.1）：原估 LD 5 天严重低估。每编辑器需 GModel 800-1500 行 + GLSP 操作 1200-2000 行 + 布局引擎 1000-2000 行 + 属性视图 500-800 行 + 集成 600-1000 行 ≈ **5000-9000 行/编辑器**。

| 任务ID | 任务 | 产出 | 估时 | 依赖 |
|--------|------|------|:---:|------|
| **T2a.1** | LD GModel 定义 | ContactNode（NO/NC），CoilNode（普通/取反），PowerRail（左/右），WireConnection，Rung，FB placeholder 等 8-12 种图形类型 | 1-2 周 | T1.1 |
| **T2a.2** | LD GLSP Server | CreateContact、DeleteElement、ReconnectWire、MoveRung、AddRung、DeleteRung 等 ~15 种操作。参考 Neuron 开源代码 | 2-3 周 | T2a.1 |
| **T2a.3** | LD Tool palette | NO contact，NC contact，coil，negated coil，FB placeholder，水平/垂直线等 ~15 项 | 1 周 | T2a.1 |
| **T2a.4** | LD Layout engine | Power rails 对齐，rung 自动编号，连接线自动路由（Rust napi-rs，1000-2000 行） | 1-2 周 | T2a.1 |
| **T2a.5** | LD Property view | 变量名编辑器、注释、取反标志 | 1 周 | T2a.2 |
| **T2a.6** | LD IEC 61131-3 specifics | EN/ENO 引脚、power flow 语义（左→右）、rung 求值顺序 | 1 周 | T2a.2 |
| **T2a.7** | Theia GLSP integration | Diagram configuration、CSS 主题适配、toolbar 贡献点 | 1 周 | T2a.2 |
| **T2a.8** | @xyflow/react fallback | 备选方案：如 GLSP 超 12 周，将现有 `@xyflow/react` LD 编辑器通过 ReactWidget 迁移到 Theia（1-2 周替代 6-10 周） | 1-2 周 | — |
| **T2a.1t** | LD GModel 单元测试 | GModel 类型序列化/反序列化、属性验证、STH-GLSP-001~003 | 0.5 天 | T2a.1 |
| **T2a.2t** | LD GLSP Server 测试 | 15 种操作各 1 用例（编辑→GModel 输出验证） | 2 天 | T2a.2 |
| **T2a.3t** | LD 编辑器 Smoke 集成测试 | 端到端：打开 LD 编辑器→添加 contact→添加 coil→连线→编译→HalProgram 非空 | 1 天 | T2a.2+T2a.3 |
| **T2a.4t** | LD 布局引擎测试 | Rust 侧：自动路由测试（连线不穿越、rung 编号正确） | 1 天 | T2a.4 |
| **T2a.5t** | LD IEC 语义测试 | power flow 方向、EN/ENO 引脚验证、rung 求值顺序的正确性 | 1 天 | T2a.6 |

**出入口条件**：① LD GLSP 单元测试 15+ 通过 ② LD Smoke 集成测试通过 ③ napi-rs 延迟 ≤ 2× 基线 ④ 回归测试零失败 ⑤ ST Monaco 编辑器 + 编译管线可用。回滚触发条件：Phase 2a 超过 12 周时激活 T2a.8 @xyflow/react fallback。

#### Phase 2b: FBD + 文本编辑器（7-9 周）

| 任务ID | 任务 | 产出 | 估时 | 依赖 |
|--------|------|------|:---:|------|
| **T2b.1** | FBD GModel | ANDNode，ORNode，NOTNode，XORNode，MUXNode，FunctionBlockNode（含 Pin 类型：输入/输出/双向） | 1-2 周 | T2a.2 |
| **T2b.2** | FBD GLSP Server | 复用 LD GLSP 基础设施（~60% 的操作逻辑共用），新增 CreateFB、ConnectPin 等操作 | 1-2 周 | T2b.1 |
| **T2b.3** | FBD Tool palette | AND，OR，XOR，NOT，MUX，比较器（EQ/GT/LT），FB 实例库 ~12+ 项 | 1 周 | T2b.1 |
| **T2b.4** | ST Monaco Editor | Monarch tokenizer 400-700 行，completion provider（关键词+变量+FB），diagnostics（napi-rs 桥接 Rust 编译器错误） | 1 周 | T1.2 |
| **T2b.5** | IL Monaco Editor | Custom tokenizer（accumulator model，LD/CR 特殊语义），completion provider | 1 周 | T1.2 |
| **T2b.6** | G-code Monaco Editor | Monarch tokenizer 200-300 行（G/M codes + 坐标参数） | 0.5 周 | T1.2 |
| **T2b.7** | SFC Editor | P1 优先文本模式（Step/Transition/Selection Branch 结构化文本），图形 SFC 延后到 P2 | 1 周 | T1.2 |
| **T2b.1t** | FBD GModel 测试 | 5 种节点类型序列化/反序列化 + Pin 类型验证 | 0.5 天 | T2b.1 |
| **T2b.2t** | FBD GLSP Server 测试 | 复用 LD 测试框架，CreateFB/ConnectPin 特定操作测试 | 1.5 天 | T2b.2 |
| **T2b.3t** | ST Monaco 诊断映射测试 | Rust 编译器错误→Monaco marker 映射验证（每种错误类型 1 用例） | 1 天 | T2b.4 |
| **T2b.4t** | SFC 结构化文本编译测试 | Step/Transition/SelectionBranch→HalProgram 输出验证 | 0.5 天 | T2b.7 |
| **T2b.5t** | 6 语言编译管线回归 | 每语言 1 个最小程序编译→HalProgram 验证 | 1 天 | T2b.4-T2b.6 |

**出入口条件**：① FBD GLSP 单元测试 12+ 通过 ② 6 语言编译管线回归 6/6 通过 ③ STH-MONACO 诊断映射 5/5 通过 ④ 回归测试零失败 ⑤ LD/FBD GLSP 编辑器可用 + 全 6 语言编译管线可用。

> 执行细化详见 [p1-execution-refinement.md](p1-execution-refinement.md) §Phase 2b


#### Phase 3: 面板 + Shell（4-5 周）

> **ReactWidget 冲突**：新增 1 周专项解决 react-rnd 与 Lumino 的坐标系统/拖拽/Z-index/CSS 隔离冲突（三审 §10.4）。

| 任务ID | 任务 | 产出 | 估时 | 依赖 |
|--------|------|------|:---:|------|
| **T3.1** | Signal Browser | Theia TreeView + 实时信号值刷新（napi-rs signal_snapshot） | 3 天 | T1.2 |
| **T3.2** | Scope View | 实时示波器面板（Canvas 渲染 + 多通道 + 时间窗口） | 5 天 | T3.1 |
| **T3.3** | Debug Panel | DAP adapter 适配 Theia Debug API（复用现有 DAP 12 命令） | 5 天 | T1.2 |
| **T3.4** | Project Tree | 类型化资源层级（扩展 Theia File Explorer，自定义文件类型图标+IEC 61131-3 资源分组） | 3 天 | T1.1 |
| **T3.5** | HMI Designer | react-rnd → ReactWidget wrapper + Lumino 冲突解决（坐标系统/拖拽/Z-index/CSS 隔离专项 1 周）。保留 7 种 widget + 信号绑定 + YAML 持久化 | 5 天→2-4 周 | T1.1 |
| **T3.6** | Mode 系统 | Edit/Debug/Commissioning Mode，Theia toolbar contributions | 3 天 | T1.1 |
| **T3.7** | inversify DI wiring | 全部编辑器/面板的 inversify ContainerModule 注册（~1500-2000 行样板代码，贯穿 Phase 2-3） | 贯穿 | T1.1 |
| **T3.1t** | Signal Browser 测试 | TreeView 节点渲染、信号值刷新、napi-rs 数据通路 | 0.5 天 | T3.1 |
| **T3.2t** | Scope View Canvas 测试 | 多通道渲染、时间窗口滚动、缩放边界 | 0.5 天 | T3.2 |
| **T3.3t** | Debug Panel 测试 | 断点设置/命中/步进/变量查看（复用 DAP 12 命令） | 1 天 | T3.3 |
| **T3.5t** | HMI Designer ReactWidget 测试 | widget 渲染、拖拽坐标验证、信号绑定、YAML 往返、HMI-VAL-001~008 | 1 天 | T3.5 |

**出入口条件**：① 所有面板单元测试 12+ 通过 ② Debug 面板 12 命令全通过 ③ HMI VAL 8/8 通过 ④ Playwright E2E 15+ 通过（含新增 Theia E2E）。

> 执行细化详见 [p1-execution-refinement.md](p1-execution-refinement.md) §Phase 3

#### Phase 4: 测试 + 打包（3-4 周）

| 任务ID | 任务 | 产出 | 估时 | 依赖 |
|--------|------|------|:---:|------|
| **T4.1** | napi-rs integration tests | 每个 binding 函数 ≥3 个测试（happy path + error path + edge case），测试覆盖率 ≥ 80% 新增 napi-rs 代码 | 3 天 | T1.2 |
| **T4.2** | Theia extension tests | Theia testing framework（前端 + 后端） | 3 天 | Phase 3 |
| **T4.3** | Playwright E2E tests | 15+ E2E 场景覆盖：ST 编辑→编译→部署、LD 编辑→编译、信号读取、HMI 布局→部署→Panel 渲染、Debug 会话 | 5 天 | Phase 3 |
| **T4.4** | Performance benchmarks | 启动时间、内存占用、napi-rs 延迟 vs Tauri 基线对比。验收标准：napi-rs 延迟 ≤ 2× Tauri 基线 | 2 天 | Phase 3 |
| **T4.5** | Electron packaging | DMG (macOS) / MSI (Windows) / AppImage (Linux)，auto-update（electron-updater） | 3 天 | Phase 3 |
|| **T4.6** | Documentation | 迁移指南（Tauri Studio→Theia Studio 用户迁移路径）、架构文档更新、开发环境搭建指南 | 3 天 | Phase 4 |
|| **T4.6a** | tauri-to-theia-migrate CLI | 读取 `project.yaml` 生成 `.theia/workspace.json`，断点格式转换（`debug/bookmarks.json` → `.theia/debug.json`） | 2 天 | T4.6 |
|| **T4.6b** | 项目记忆更新 | 追加 D72-D76 到 decisions.md、更新 status.md 模块表（Theia 迁移完成）、更新 README.md 架构描述 | 1 天 | T4.6 |
|| **T4.7** | Stakeholder review | 全量检查 + 签收 | 2 天 | T4.3-T4.6b |

**出入口条件**：① 全量 150+ 测试通过（含新增 18 测试任务产出） ② Playwright E2E 20+ 通过（含 Theia 新增 5 场景） ③ SDD 追溯覆盖率 ≥ 80% ④ napi-rs 延迟 ≤ 2× Tauri 基线 ⑤ Electron ≤ 250MB ⑥ 三平台 Smoke 通过 ⑦ tauri-to-theia-migrate 对 3 个样本项目迁移成功。回滚条件：napi-rs 延迟 > 2× Tauri 基线 或 Electron 包体积 > 250MB。

> 执行细化详见 [p1-execution-refinement.md](p1-execution-refinement.md) §Phase 4

### 2.4 关键依赖链

```
T1.1 (Theia 骨架)
  ├─→ T1.1t (Theia Smoke)
  ├─→ T2a.1 (LD GModel)
  │     ├─→ T2a.1t (GModel 单元测试)
  │     └─→ T2a.2 (LD GLSP Server)
  │           ├─→ T2a.2t (Server 测试)
  │           ├─→ T2a.5 (LD Property view)
  │           ├─→ T2a.6 (IEC 61131-3 specifics)
  │           │     └─→ T2a.5t (IEC 语义测试)
  │           ├─→ T2a.7 (GLSP integration)
  │           └─→ T2b.1 (FBD GModel)
  │                 ├─→ T2b.1t (FBD GModel 测试)
  │                 └─→ T2b.2 (FBD GLSP Server)
  │                       └─→ T2b.2t (Server 测试)
  ├─→ T3.4 (Project Tree)
  ├─→ T3.5 (HMI Designer)
  │     └─→ T3.5t (HMI ReactWidget 测试)
  ├─→ T3.6 (Mode system)
  └─→ T3.7 (DI wiring ∥ 贯穿 Phase 2-3)

T1.2 (napi-rs binding)
  ├─→ T1.2t (napi-rs 单元测试)
  ├─→ T1.3 (worker_thread 验证)
  │     └─→ T1.3t (worker_thread 集成测试)
  ├─→ T1.4 (Backend Service)
  │     └─→ T1.4t (RBAC + Schema 测试)
  ├─→ T1.4a (Controller 生命周期适配器)
  ├─→ T2b.4→T2b.7 (Monaco editors)
  │     ├─→ T2b.3t (ST 诊断映射)
  │     ├─→ T2b.4t (SFC 编译测试)
  │     └─→ T2b.5t (6 语言回归)
  ├─→ T3.1 (Signal Browser)
  │     └─→ T3.1t (Signal Browser 测试)
  ├─→ T3.3 (Debug Panel)
  │     └─→ T3.3t (Debug Panel 测试)
  └─→ T4.1 (napi-rs tests)

Phase 3 ──→ Phase 4 (所有面板就绪后开始测试+打包)
  ├─→ T4.6 (Documentation)
  │     ├─→ T4.6a (tauri-to-theia-migrate CLI)
  │     └─→ T4.6b (项目记忆更新)
  └─→ T4.3→T4.5→T4.7 (测试+打包+签收，依赖 T4.6b)
```

### 2.5 并行化机会

| 并行组 | 任务 | 前提 |
|--------|------|------|
| **P1 内部并行** | T1.1 + T1.2 + T1.6 | T1.1/T1.2 无相互依赖，T1.6 workshop 可与编码并行 |
| **跨 Phase 并行** | T2b.4-T2b.7 (Monaco 文本编辑器) ∥ Phase 2a GLSP | 文本编辑器仅依赖 T1.2（napi-rs），不依赖 GLSP |
| **面板并行** | T3.1 + T3.3 + T3.4 | 信号浏览器/Debug/项目树各自独立 |
| **T2a.8 备选** | @xyflow/react fallback 探索 | 可与 T2a.1-T2a.7 并行探索（仅 1-2 周投入） |
| **测试并行** | T4.1 + T4.2 + T4.4 | tests/benchmarks 各自独立；T4.3 (Playwright) 可与其他 T4.x 并行 |

**总工期缩短潜力**：Phase 2a (GLSP) 与 Phase 2b 文本编辑器并行可将 22 周压缩到 ~18-20 周（假设 3 人团队）。

### 2.6 用户数据迁移

**目标**：确保 Tauri Studio 用户项目平滑迁移到 Theia Studio。

| 资产 | 源格式 | 目标格式 | 迁移方式 |
|------|--------|----------|----------|
| ST/IL/LD/FBD/SFC 源码 | 项目目录 `.st/.ld/.fbd` 等 | 同格式（零迁移成本） | 文件系统直接复用 |
| HMI 布局 | `hmi/layout.yaml` | `hmi/layout.yaml`（同格式） | 文件系统直接复用 |
| Signal Registry | Runtime 状态（运行时动态） | 运行时自动恢复 | 无需迁移 |
| 项目配置 | `project.yaml` | Theia workspace 配置（`.theia/workspace.json`） | 自动转换工具 |
| 编译产物 | `target/`（Rust cargo） | 同路径 | 文件系统直接复用 |
| 调试会话断点 | `debug/bookmarks.json`（Tauri 本地） | Theia Debug breakpoints（`.theia/debug.json`） | 格式转换脚本 |

**风险**：
- 项目配置格式不兼容：提供 `tauri-to-theia-migrate` CLI 工具，读取 `project.yaml` 生成 `.theia/workspace.json`
- 断点坐标偏移：Theia 行号模型与 Tauri 一致（Monaco Editor），零偏移

**验证**：
- `T4.6` 文档中提供迁移指南
- 迁移后项目可通过 `compile_st` / `deploy_program` 等核心命令正常工作

### 2.7 Phase 审查门禁

**目标**：每个 Phase 出口设置硬性门禁，防止带病进入下一 Phase。

| Phase | 门禁条件 | 未通过处理 |
|-------|----------|------------|
| Phase 1 | ① napi-rs 单元测试 10+ 通过 ② Theia 骨架可启动 + Smoke 通过 ③ 现有 737 Rust 测试零回归 ④ napi-rs 5 核心函数在 worker_thread 中通过 | 不进入 Phase 2a |
| Phase 2a | ① LD GLSP 单元测试 15+ 通过 ② LD Smoke 集成测试通过 ③ napi-rs 延迟 ≤ 2× 基线 ④ 回归测试零失败 ⑤ LD 编辑器端到端可用 | 激活 T2a.8 @xyflow/react fallback |
| Phase 2b | ① FBD GLSP 单元测试 12+ 通过 ② 6 语言编译管线回归 6/6 通过 ③ 回归测试零失败 ④ 全 6 语言编辑器可用 | 不进入 Phase 3 |
| Phase 3 | ① 所有面板单元测试 12+ 通过 ② Debug 面板 12 命令全通过 ③ HMI VAL 8/8 通过 ④ Playwright E2E 15+ 通过 | 不进入 Phase 4 |
| Phase 4 | ① 150+ 测试全通过 ② Playwright E2E 20+ 通过 ③ SDD 追溯 ≥ 80% ④ napi-rs ≤ 2× 基线 ⑤ Electron ≤ 250MB ⑥ 三平台 Smoke 通过 | 不发布，回滚修复 |

**门禁执行**：
- Phase 1-4 门禁由 CI `qa-full` 自动检查（含 Smoke + test + E2E + SDD trace）
- Phase 4 额外需人工签收（Stakeholder review，T4.7）
- 门禁未通过时，冻结 Phase 出口，不启动下一 Phase 开发任务

---

## 3. P1 续建：现有模块完善

### 3.1 HMI 部署管道完善
- [ ] **Panel Push 模式**：替代当前 100ms 轮询，迁移到 `SIGNAL_PUSH` frame（D62）
- [ ] **HmiLayout 验证**：添加 Zod schema 验证（遵循 TypeScript 约定），widget ≤50、信号名匹配注册表
- [ ] **Deadband 过滤**：F64 信号变化 < 阈值不推送（pitfalls.md §全量数据推送）

### 3.2 Runtime Panel 完善
- [ ] **WebSocket Transport**：实现 `WsTransport`（D66），支持远程 Web 访问
- [ ] **TrendRecorder 存储**：抽象 `ITimeSeriesStorage` trait，P1 默认 Memory/SQLite（pitfalls.md §SQLite 作为时序存储）
- [ ] **WebWorker SignalBridge**：HalValue 解码+缓存更新在 Worker 中（pitfalls.md §渲染管线）

### 3.3 CNC 运动规划器
- [ ] **运动规划器**：梯形速度剖面 + S 曲线（D55），`crates/audesys-cnc-motion/`
- [ ] **插补引擎**：逐周期步进 + 前瞻缓冲区（D55），集成到 Runtime 周期

### 3.4 测试增强
- [ ] **qa-full 门禁**：criterion bench + proptest + tarpaulin coverage
- [ ] **Playwright E2E**：HMI 布局部署→Panel 渲染的端到端测试（注：此为 Tauri 侧。Theia E2E 见 §2.3 T4.3）
- [ ] **覆盖率跟踪**：设置 rust-codecov 或 tarpaulin CI

---

## 4. P2 前瞻

| 功能 | 依赖 | 阶段 |
|------|------|:--:|
| IEC 61499 函数块网络编辑器 | Theia Extension System | P2 |
| WASM 插件沙箱 | Theia Contribution System 成熟 | P2 |
| Zenoh 网络传输 | amw_zenoh crate + Controller IPC | P2 |
| OPC UA Gateway | open62541 FFI（不进入 RT 路径） | P2 |
| Studio Web 模式 | Theia 内置 Browser 模式支持 | P2 |
| 第三方 HMI widget 市场 | Theia Extension + Open VSX | P3 |
| 数字孪生（OPC UA + MQTT） | Gateway + Edge 模块 | P3 |
| CNC 实时加工（SCHED_FIFO 1ms） | 运动规划器 + PREEMPT_RT | P3 |

---

## 5. Phase 5: Cleanup & Sunset

**目标**：Theia Phase 4 通过所有门禁后，移除 Tauri Studio 旧代码、清理重复 CI、归档旧测试。

| 任务ID | 任务 | 产出 | 估时 | 依赖 |
|--------|------|------|:---:|------|
| **T5.1** | 移除 Tauri Studio 源码 | 删除 `apps/studio/`、移除 `Cargo.toml` workspace member | 1 天 | Phase 4 全部门禁通过 |
| **T5.2** | 移除 PlatformAdapter 死代码 | 删除 D58/D59 相关代码（PlatformAdapter/StudioEventBus/ToolRegistry） | 1 天 | T5.1 |
| **T5.3** | 归档 Tauri E2E 测试 | 移动 `apps/studio/e2e/` → `archive/tauri-e2e/` | 0.5 天 | T5.1 |
| **T5.4** | 移除 Tauri CI 任务 | 从 `.github/workflows/qa.yml` 移除 Tauri-only jobs | 0.5 天 | T5.1 |

**出入口条件**：`grep -r "tauri" apps/ --include="*.ts" --include="*.tsx" --include="*.json" | wc -l` = 0（runtime-panel 除外）。Cargo workspace 仅含 Theia 相关 crate。

---

## 6. 里程碑时间线

```
P0 (已完成)                    P1 (Theia 迁移)                 P2 (规划中)
─────────────────────────────────────────────────────────────────────────────
M0: CI/测试基础设施     ✅
M1: IEC 编译器          ✅
M2: Runtime Engine      ✅
M3: Studio IDE + HMI    ✅      → Theia 迁移 🟡 (22-31周)    → IEC 61499 + Zenoh
M4: 协议适配 + 仿真      ✅                                     → OPC UA + Web
                                  |—— Phase 1 基础设施 (5-6周, 12 tasks: T1.1-T1.7 + T1.1t-T1.4t)
                                  |—— Phase 2a GLSP LD (7-11周, 13 tasks: T2a.1-T2a.8 + T2a.1t-T2a.5t)
                                  |—— Phase 2b FBD+文本编辑 (7-9周, 12 tasks: T2b.1-T2b.7 + T2b.1t-T2b.5t)
                                  |—— Phase 3 面板+Shell (4-5周, 11 tasks: T3.1-T3.7 + T3.1t-T3.5t)
                                  |—— Phase 4 测试+打包 (3-4周, 9 tasks: T4.1-T4.7 + T4.6a-T4.6b)
                                  |—— Phase 5 清理 (0.5-1周, 4 tasks: T5.1-T5.4)
                                  |
                                  出入口检查点：
                                  |  P1完成→napi-rs 10+ 测试通过 + Smoke 通过
                                  |  P2a完成→LD 15+ 测试通过 + Smoke 集成通过（ST 跨 Phase 并行）
                                  |  P2b完成→FBD 12+ 测试通过 + 全6语言回归 6/6
                                  |  P3完成→面板 12+ 测试通过 + E2E 15+
                                  |  P4完成→150+ 测试 + E2E 20+ + SDD 80% + Electron 打包
                                  |  P5完成→Tauri 源码零残留 + CI 清理完毕
```

| 优先级(Blocking) | Phase | 核心任务 | 工时 | 阻塞 |
|:------:|-------|------|:------:|------|
| 🔴 | Phase 1 | T1.1-T1.7 + T1.1t-T1.4t Theia 骨架 + napi-rs + 测试 | 5-6 周 | 全部后续 Phase |
| 🔴 | Phase 2a | T2a.1-T2a.8 + T2a.1t-T2a.5t GLSP LD 编辑器 + 测试 | 7-11 周 | T2b.1 FBD GModel |
| 🟠 | Phase 2b | T2b.1-T2b.7 + T2b.1t-T2b.5t GLSP FBD + Monaco + 测试 | 7-9 周 | Phase 3 面板集成 |
| 🟠 | Phase 3 | T3.1-T3.7 + T3.1t-T3.5t 面板 + Shell + 测试 | 4-5 周 | Phase 4 E2E 测试 |
|| 🟡 | Phase 4 | T4.1-T4.7 + T4.6a-T4.6b 全量测试 + 打包 + 文档 + 迁移工具 + 签收 | 3-4 周 | 发布 |
| 🟢 | Phase 5 | T5.1-T5.4 清理 Tauri 旧代码 + 归档测试 + 精简 CI | 0.5-1 周 | — |

**工期汇总**：
- 串行路径（最长链）：Phase 1 → Phase 2a → Phase 2b → Phase 3 → Phase 4 → Phase 5 = 28-36 周
- 并行优化路径（Phase 2a GLSP ∥ Phase 2b 文本编辑器）：~22-24 周（3 人团队）
- 串行路径（@xyflow/react fallback 替代 GLSP）：Phase 1 → Phase 2b 文本 → Phase 3 → Phase 4 = ~19-22 周

---

## 附录 A：旧文档裁决

| 旧文件 | 裁决 | 理由 |
|--------|:--:|------|
| `p0-milestone-roadmap.md` | 🗑 废弃 | P0 里程已过，内容未覆盖 HMI/CNC/Panel |
| `p0-mvp-acceptance.md` | ✅ 完成 | CI/CD、workspace、测试基础设施全部就绪 |
| `p0-phase0-bootstrap.md` | ✅ 完成 | Phase 0 启动任务已执行 |
| `p0-sdd-tdd-ludwig.md` | 🗑 废弃 | D33 修订为直接 TDD，Ludwig v0.1 alpha 方案已弃 |
| `tdd-audit-report.md` | 📋 存档 | 一次性审计，无后续行动项（D33 修订已落地） |
| `p0-mvp-status.md` | ➡ 整合 | 核心内容（模块表、架构分析）迁入本文档 |

> 上述旧文件已于 2026-07-20 删除。本文档是 docs/plans/ 下唯一计划文件。

---

## 附录 B：关键设计决策引用

| 决策 | 内容 | 文档位置 |
|------|------|---------|
| D58 | Studio 插件架构 = PluginRegistry + CommandRegistry + PlatformAdapter + PanelSystem | `.agents/memorys/decisions.md` | ⚠️ 已废弃 |
| D59 | Studio PC/Web 双模式 = PlatformAdapter 抽象层 | `.agents/memorys/decisions.md` | ⚠️ 已废弃 |
| D21 | Studio 技术栈 = Tauri + React + TypeScript（⚠️ 已弃用，被 D71 取代） | `.agents/memorys/decisions.md` |
| **D71** | **Studio 技术栈迁移 = Eclipse Theia**（取代 D21/D58 部分/D59 部分），napi-rs 桥接 Rust 后端 | `.agents/memorys/decisions.md` |
| D60 | Panel Widget 复用 = packages/studio-core 共享组件 | `.agents/memorys/decisions.md` |
| D62 | SignalBridge 默认 Hybrid = Push 优先 + Poll 降级 | `.agents/memorys/decisions.md` |
| D67-D69| HMI 设计决策（sim_set_signal/0x17/YAML） | `.agents/memorys/decisions.md` |
| D70 | Studio 响应式布局（css flexbox + min-height:0） | `.agents/memorys/decisions.md` |
| **D72** | **Smoke 作为 qa-fast Step 0**，2 分钟超时 | `docs/plans/p1-testing-optimization.md` |
| **D73** | **SDD 追溯覆盖率 ≥ 80%** 作为 Phase 出口条件 | `docs/plans/p1-testing-optimization.md` |
| **D74** | **每 Phase 新增 4-5 个内联测试任务**，共计 +18 任务 | `docs/plans/p1-testing-optimization.md` |
| **D75** | **AI 生成代码必须同 PR 含测试**，禁止先实现后补 | `docs/plans/p1-testing-optimization.md` |
| **D76** | **Phase 出口条件全部可自动化验证**（除 P4 签收） | `docs/plans/p1-testing-optimization.md` |

---

## 附录 C：测试与质量基线

### 当前测试统计

| 层级 | 框架 | 当前计数 | P4 目标 | 状态 |
|------|------|:---:|:---:|:--:|
| Rust unit | `#[test]` | 737 | 750+ | ✅ CI 通过 |
| Frontend vitest (Tauri) | Vitest | 17 | 17+ | ✅ CI 通过 |
| Frontend vitest (Theia) | Vitest | 0 | 50+ | 🔜 Phase 3 |
| napi-rs integration | Vitest + cargo test | 0 | 50+ | 🔜 Phase 1-4 |
| Playwright E2E (Tauri) | Playwright | 15 | 15+ | ✅ CI 通过 |
| Playwright E2E (Theia) | Playwright | 0 | 20+ | 🔜 Phase 3-4 |
| SDD trace | verify-sdd-trace.sh | 0% | 80%+ | 🔜 Phase 4 |
| Criterion bench | criterion | — | 激活 | 🔜 qa-full |
| Smoke gate | smoke.sh | 0 | 8 项 | 🔜 即刻 |
| tauri-to-theia-migrate | Vitest + cargo test | 0 | T4.6 | 🔜 Phase 4 |

### CI 门禁

```bash
./scripts/qa/qa-fast.sh   # 每次提交: cargo test + clippy + fmt + deny + unwrap
./scripts/qa/qa-full.sh   # 每次 PR: + criterion bench + proptest + tarpaulin
./scripts/qa/qa-deep.sh   # Release: + Miri UB + loom + mutation
```

### 编码规范

- 禁止 `as any` / `@ts-ignore` / `console.log`
- Rust: `cargo clippy -- -D warnings`
- 公共 API 显式类型注解
- Zod 用于边界层模式验证
- AAA 模式测试（Arrange/Act/Assert）
