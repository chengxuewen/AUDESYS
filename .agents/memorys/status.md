# AUDESYS 项目状态

## 当前阶段
- **MVP 原型完成** — 2026-07-17，6 语言 IEC 61131-3 编译器（ST/IL/LD/FBD/SFC）、HAL IR/VM（34 操作码+定时器+计数器+触发器+函数调用栈）、Runtime Engine（5 步周期引擎+Config Barrier+Hot-swap+信号注册表）、Supervisor（子进程编排+指数退避+重启）、IPC Server（9 方法 UDS 协议+HMAC 认证+5 角色 RBAC）、Studio IDE（Tauri+CodeMirror 6+React+TypeScript，8 面板+15 Tauri 命令+5 种可视化编辑器）
- **Studio ↔ Controller 集成完成** — ControllerClient 库（UDS IPC 客户端，6 方法+认证）、Studio Tauri 命令（deploy_program/load_hal_config/read_controller_signal）
- **协议适配器就绪** — Modbus RTU/TCP（8 测试）、HART（6 测试）
- **仿真器就绪** — SimulationHarness + 故障注入引擎 + 场景录制/回放 + VirtualModbusTcpDevice + VirtualHARTDevice
- **可观测性就绪** — Prometheus metrics + DAP 调试适配器（12 命令）+ JSON 日志
- **CNC 设计完成** — 2026-07-19，`docs/modules/cnc/` 4 份设计文档（G-code 编译器、运动规划器、轴组管理、竞品参考模型）+ 37 项 CNC SDD 规范 + architecture.md §七 CNC 章节

## 仓库状态
- **最新提交**: `0249d9b` — `feat(controller): add VirtualHARTDevice with HART universal commands 0-3`
- **提交历史**: 184 commits on main (2026-07-08 至 2026-07-19)
- **源代码**: 17 crates（crates/）+ Tauri Studio 应用（apps/studio/）
- **测试**: 614 `#[test]` 标注 + 12 个前端 vitest 组件测试文件
- **SDD 规范**: 162 项（openspec/specs/）：类型系统(30) + HalQoS(30) + Config Barrier(24) + 协议(37) + CNC(37) + 健康检查(4)
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
| IPC Server | ✅ 完成 | UDS 9 方法，HMAC 认证，5 角色 RBAC |
| Studio IDE | ✅ 完成 | Tauri + CodeMirror 6 + 15 命令 + 8 面板 |
| ControllerClient | ✅ 完成 | UDS IPC 客户端（6 方法+认证） |
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
| CNC 系统 | 🟡 设计完成 | `docs/modules/cnc/` 4 份设计文档（5,575 行） |
| G-code 编译器 | 🔲 计划中 | `.sisyphus/plans/add-gcode-compiler/` 提案就绪（17 任务） |

## 文档与规范

| 类别 | 状态 | 备注 |
|------|:----:|------|
| HAL 设计文档 | ✅ 完成 | `docs/modules/hal/` 19 份子文档 |
| Runtime 设计文档 | ✅ 完成 | 4 份：IPC 安全+可观测+硬件+升级 |
| CNC 设计文档 | ✅ 完成 | `docs/modules/cnc/` 4 份子文档 + SDD 规范 |
| 竞品参考文档 | ✅ 完成 | `docs/reference/` 41 篇（12 大类） |
| SDD 规范 | ✅ 完成 | `openspec/specs/` 5 份规范，162 项 |
| 架构文档 | ✅ 完成 | `docs/architecture.md` 1,822 行，七章 |
| 文档审计 | ✅ 完成 | 两次审计：50+32 项发现，77 项修复 |
| 实施规划 | ✅ 完成 | D31-D55 已记录，P0 团队审查通过 |

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
