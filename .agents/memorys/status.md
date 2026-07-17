# AUDESYS 项目状态

## 当前阶段
- **MVP 原型完成** — 2026-07-17，ST 编译器满栈管道（词法→解析→类型检查→代码生成）、HAL IR/VM（30 操作码+定时器+计数器+函数调用栈）、Runtime Engine（5 步周期引擎+Config Barrier+信号注册表）、Supervisor（子进程编排+重启）、IPC Server（6 方法 UDS 协议+HMAC 认证）、Studio IDE（CodeMirror 6+Tauri 桌面应用）
- **Studio ↔ Controller 集成规划中** — 两层项目模型设计完成（Firmware Project + Engineering Project），联调/调试/可观测性/部署/仿真五维度分析完毕，详见 `docs/plans/p0-mvp-status.md`
- **HAL 详细设计扩展** — 2026-07-15，19 份独立子文档 + 4 份 Runtime 设计文档 + 121 项 SDD 规范

## 当前阶段
- **HAL 详细设计扩展** — 2026-07-15，D14/D15 逆转：hal-detailed-design.md（3386行）拆分为 docs/modules/hal/ 下 19 份独立子文档，architecture.md §一 精简为行引用
- **参考文档库扩展** — 2026-07-15，参考库从 22 篇扩至 41 篇（docs/reference/），新增 5 个类别，总计 19 篇新文档
- **SDD 规范生成** — 2026-07-15，从 4 份 HAL 设计文档提取 121 项规范（openspec/specs/）：类型系统(30)、HalQoS(30)、Config Barrier(24)、协议(37)
- **Runtime 设计文档** — 2026-07-15，新建 4 份文档：IPC 安全设计(494行)、可观测性设计(567行)、硬件需求(402行)、升级策略(281行)
- **文档架构审计完成** — 2026-07-15，50 项发现经交互审核（11 CRITICAL + 13 HIGH + 19 MEDIUM + 7 LOW），45 项修复应用，5 项延后。新建 doc-audit 技能支持持续审计
- **P0 基础设施就绪** — 2026-07-15，Cargo workspace 虚拟清单 + audesys-hal-core crate + CI/CD 三层 QA + rust-toolchain/clippy/deny/fmt 工具链，qa-fast 5 门禁全绿
- **技能库增强** (2026-07-15) — 2026-07-14/15：book-to-skill (文档→技能转换)、doc-audit (文档审计)、test-harness (多语言测试工具架)、skill-creator (从 webrtc-kit 移植) + 7 篇 Studio 参考技能 (ref-codesys/ref-beckhoff/ref-qtouch/ref-ignition/ref-fuxa/ref-intouch/ref-labview)。7 项 openspec 技能从 webrtc-kit 移植增强（propose/apply/verify/explore + test-harness Mode 7 + doc-audit 3项增强 + skill-creator 新建）
## 实施规划新增决策
- D31-D41 已记录于 `.agents/memorys/decisions.md`（D33 经团队审查修订：Ludwig→直接 TDD）
- D42-D43 已记录（MCP工具链策略，AI辅助工具集成）
- D44-D49 已记录（HAL拆分逆转，Runtime设计，错误模型，doc-audit技能，SDD规范生成，审计修复流程）
- D50-D54 已记录（test-harness、skill-creator+参考技能、参考模式缺口、Phase 0定义修订、webrtc-kit技能移植）
## 仓库状态
- **最新提交**: `ddc0a72` — `chore: migrate flat skill files to subdirectory form for consistency`
- **提交历史**: 16 commits on main (2026-07-15)，总计 +6,989 / -3,615 行
- **源代码**: cargo workspace 就绪（`Cargo.toml` 虚拟清单 + `crates/audesys-hal-core/` + `crates/amw_inproc/` + `crates/hal-flatbuffers/`），含 `.fbs` FlatBuffers schema 骨架
- **测试**: 121 项 SDD 规范就绪（openspec/specs/）+ 1 项编译链接验证测试 (health.rs) + amw_inproc/hal-flatbuffers stub（Phase 1 M0.3 待实现）
- **CI**: qa-fast 5 门禁（test/clippy/fmt/deny/unwrap）+ GitHub Actions macOS+Linux 矩阵
- **依赖**: `@colbymchenry/codegraph` (devDependency) + Rust toolchain stable
| 模块 | 状态 | 备注 |
|------|:----:|------|
| ST 编译器 + HAL IR/VM | ✅ 完成 | 30 操作码，7 控制流，62 测试通过 |
| Runtime Engine | ✅ 完成 | 5 步周期引擎，信号注册表，atomic 度量 |
| Supervisor | ✅ 完成 | 子进程编排，指数退避，3 重试 |
| IPC Server | ✅ 完成 | UDS 6 方法，HMAC 认证，5 角色 RBAC |
| Studio IDE | ✅ 完成 | CodeMirror 6+Tauri，编译+本地执行 |
| HAL 设计文档 | ✅ 完成 | `docs/modules/hal/` 19 份子文档 |
| Runtime 设计文档 | ✅ 完成 | 4 份：IPC 安全+可观测+硬件+升级 |
| Studio ↔ Controller 联调 | 🔲 规划中 | 两层项目模型已设计，IPC 方法待实现 |
| 调试功能 | 🔲 规划中 | 架构 §5 设计完成，零代码实现 |
| 仿真 | 🟡 Inproc | InprocMiddleware 已是 MVP 仿真层，AVD Phase 3+ |
| Simulator (AVD) | 🔮 Phase 3/4 | 7 种虚拟设备，设计完成 |
| 工业调试桥 | 🔲 规划中 | architecture.md §5 设计完成 |

| 实施规划 | ✅ P0 团队审查完成（27项）+ 第一次审计修复（45项）+ 第二次审计修复（32项） | D31-D54 已记录，Phase 0→1 过渡定义清晰（D53） |
| 文档审计 | ✅ 两次审计完成：50项（45修复/5延后）+ 32项（全部修复） | 持续审计管道建立，支持 /doc-audit full/quick-fix/phase 命令 |
| 技能库 | ✅ 13 项目技能 + 7 参考技能 | 覆盖审计、测试、设计系统、文档转换、变更管理、Studio 参考 |
| skill-creator | ✅ 从 webrtc-kit 移植，适配 HAL/FlatBuffers | 技能创建与维护工具 |

| 技能移植 | ✅ 7 项 openspec 技能从 webrtc-kit 移植增强 | propose/apply/verify/explore + test-harness Mode 7 + doc-audit 3项 |
