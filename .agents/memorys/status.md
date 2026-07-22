# AUDESYS 项目状态

## 当前阶段
- **Theia 迁移完成** — 2026-07-21，Studio IDE 从 Tauri+React 迁移到 Eclipse Theia+Monaco Editor+GLSP+napi-rs。6 语言编辑器就绪：ST Monaco ✅、IL Monaco ✅、G-code Monaco ✅、LD GLSP 编辑器 ✅、FBD GLSP 编辑器 ✅、SFC 编辑器 ✅。Signal Browser ✅、Scope View ✅、Debug Panel ✅、HMI Designer (Theia) ✅、Mode System ✅。Runtime Panel 不受影响（D65 保持有效）。
- **Studio ↔ Controller 集成完成** — ControllerClient 库（UDS IPC 客户端，6 方法+认证）、Studio Tauri 命令（deploy_program/load_hal_config/read_controller_signal）
- **协议适配器就绪** — Modbus RTU/TCP（8 测试）、HART（6 测试）
- **仿真器就绪** — SimulationHarness + 故障注入引擎 + 场景录制/回放 + VirtualModbusTcpDevice + VirtualHARTDevice
- **可观测性就绪** — Prometheus metrics + DAP 调试适配器（12 命令）+ JSON 日志
- **CNC 设计完成** — 2026-07-19，`docs/modules/cnc/` 4 份设计文档（G-code 编译器、运动规划器、轴组管理、竞品参考模型）+ 37 项 CNC SDD 规范 + architecture.md §七 CNC 章节
- **Runtime Panel 架构设计完成** — 2026-07-19，5 层架构（Shell/Plugin/WidgetRenderer/SignalBridge/Transport）、4 内置插件（OperatorLogin/AlarmManager/TrendRecorder/MultiScreenNav）、PC/Web 双形态、3 种部署拓扑、SignalProvider TS 接口、7 项架构决策（D60-D66）、新增 Role::HMI
- **SCADA 性能分析完成** — 2026-07-19，基于 8 家竞品（Ignition/FUXA/InTouch/iFIX/KingView/Beckhoff/CODESYS/LabVIEW）的 Web HMI 渲染性能、大数据处理、图表优化、认知负荷分析，生成 18 项优化建议（P1 8 项 + P2 7 项 + P3 3 项）、8 项陷阱清单
- **HMI 设计器就绪** — 2026-07-19，可视化拖拽编辑器（react-rnd 自由布局画布）、7 种工业 widget（Gauge/Trend/Tank/Indicator/Button/Display/Text）、信号绑定对话框（controller_signal_snapshot 集成）、属性面板（位置/尺寸/标签/信号/类型专属配置）、Edit/Preview 模式切换、YAML 持久化（save_hmi_layout/load_hmi_layout）

## 仓库状态
- **最新提交**: `f923088` — `perf(runtime): add criterion benchmarks for signal throughput, RPC, and registry ops`（当前会话未提交，含以下变更）
- **提交历史**: 197 commits on main (2026-07-08 至 2026-07-20)
- **源代码**: 21 crates（crates/）+ 2 Tauri 应用（apps/studio/ + apps/runtime-panel/）
- **测试**: 737 `#[test]` 标注 + 17 个前端 vitest 组件测试文件 + 15 个 Playwright E2E UI 测试
- **SDD 规范**: 186 项（openspec/specs/6 份）：类型系统(30) + HalQoS(30) + Config Barrier(24) + 协议(37) + CNC(41) + HMI(24)
- **CI**: qa-fast 5 门禁（test/clippy/fmt/deny/unwrap）+ GitHub Actions macOS+Linux 矩阵
- **依赖**: `@colbymchenry/codegraph` (devDependency) + Rust toolchain stable

## 模块状态

| 模块 | 状态 | 备注 |
|------|:----:|------|
| ST 编译器 + HAL IR/VM | ✅ 完成 | 34 操作码，7 控制流，函数调用栈 |
| IL 编译器 | ✅ 完成 | 21 IL 助记符 → HalProgram |
| LD 编译器 | ✅ 完成 | LD 图形 → IL 文本 → HalProgram |
| FBD 编译器 | ✅ 完成 | 功能块图 → HalProgram |
| SFC 编译器 | ✅ 完成 | 19 步进 → HalProgram |
| Runtime Engine | ✅ 完成 | 5 步周期，Config Barrier，Hot-swap，信号注册表 |
| Supervisor | ✅ 完成 | 子进程编排，指数退避，3 重试 |
| IPC Server | ✅ 完成 | UDS 10 方法（0x01-0x17），HMAC 认证，5 角色 RBAC |
| Studio IDE | ✅ Theia 迁移完成 | D71: Tauri+React → Eclipse Theia+Monaco+GLSP+napi-rs，迁移完成（2026-07-21） |
| Studio Theia 迁移 | 🟡 3 扩展已集成 (apps/studio-theia-test/) | P3: audesys-core ✅, audesys-debug ✅ (8 文件/7 测试/DI 就绪), audesys-hmi-designer ✅。Workbench 在 Electron+browser 双端渲染正常，DevTools (F12) 可用，后端连接正常。待办: 移植回 apps/studio-theia/ + 集成 IDE 编辑器扩展 (ST/IL/LD/FBD/SFC/G-code) |
| LD GLSP Editor | ✅ 完成 | Eclipse GLSP 图形编辑器，LD 梯形图 → HalProgram |
| FBD GLSP Editor | ✅ 完成 | Eclipse GLSP 图形编辑器，FBD 功能块图 → HalProgram |
| ST Monaco Editor | ✅ 完成 | Monaco Editor 文本编辑器，ST 结构化文本 |
| IL Monaco Editor | ✅ 完成 | Monaco Editor 文本编辑器，IL 指令表 |
| G-code Monaco Editor | ✅ 完成 | Monaco Editor 文本编辑器，G-code RS274 |
| SFC Editor | ✅ 完成 | SFC 顺序功能图编辑器 |
| Signal Browser | ✅ 完成 | Theia Widget，信号注册表浏览/搜索 |
| Scope View | ✅ 完成 | Theia Widget，信号实时波形示波器 |
| Debug Panel (Theia) | ✅ 完成 | Theia Widget，8 源文件/7 测试，DI bindings 完整 |
| HMI Designer (Theia) | ✅ 完成 | Theia Widget，HMI 可视化设计器迁移完成 |
| Mode System | ✅ 完成 | 编辑器模式切换系统（6 语言 + HMI） |
| ControllerClient | ✅ 完成 | UDS IPC 客户端（7 方法含 deploy_hmi_layout + 认证）|
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
| Runtime Panel | 🟡 骨架实现 | 独立 Tauri app + IpcSignalProvider (100ms 轮询) + IpcLayoutLoader + 5 Tauri 命令 (connect/read/disconnect)，P2: push 模式
| HMI 设计器 | ✅ 完成 | 拖拽编辑器+7 widget+信号绑定+YAML 持久化+布局验证+部署，5 vitest 测试+3 Playwright E2E 测试
| HMI 部署管道 | 🟡 | IPC 0x17→Controller Config Barrier→Panel，P1 轮询（Push 模式待 P1 续建完成）|
| HMI 调试能力 | 🟡 基础具备 | SignalInjector+布局验证器已实现，P2: 渲染性能监控+断点调试

## 文档与规范

| 类别 | 状态 | 备注 |
|------|:----:|------|
| HAL 设计文档 | ✅ 完成 | `docs/modules/hal/` 19 份子文档 |
| Runtime 设计文档 | ✅ 完成 | 6 份：IPC 安全+可观测+硬件+升级+Panel架构+审计日志 |
| CNC 设计文档 | ✅ 完成 | `docs/modules/cnc/` 4 份子文档 + SDD 规范 |
| Studio 设计文档 | 🟡 设计完成 | `docs/modules/studio/` 1 份设计文档 |
| Runtime Panel 设计文档 | ✅ 完成 | `docs/modules/runtime/` 新增 1 份：panel-architecture-design.md（5层架构+PC/Web双形态+插件模型） |
| 竞品参考文档 | ✅ 完成 | `docs/reference/` 41 篇（12 大类） |
| SDD 规范 | ✅ 完成 | `openspec/specs/` 6 份规范，186 项（新增 HMI 管道规范） |
| 架构文档 | ✅ 完成 | `docs/architecture.md` 2,066 行，七章 |
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
