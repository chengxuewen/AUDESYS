# AGENTS.md — AUDESYS Project Knowledge Base

**Generated:** 2026-07-13
**Commit:** `ffbf480`
**Branch:** `main`
**Branch:** `main`

## OVERVIEW
AUDESYS — 工业控制系统运行时模拟平台。从 MODACS 分离，聚焦 Studio IDE、Runtime 运行时、Simulator 仿真器、HAL 硬件抽象层。当前早期阶段，零源代码，HAL 详细设计已完成（3 专家团队审核），参考文档库已建成（41 篇竞品分析）。

## STRUCTURE
```
AUDESYS/
├── .opencode/          # OpenCode 配置（插件、MCP、LSP、instructions）
│   ├── opencode.json   # 主配置：模型、插件、44 条 instructions、6 个 MCP、8 个 LSP
│   ├── agent-guide.md  # 554 行 — AI 代理使用指南（5 层模型体系、OMO 编排）
│   └── init-mcp-*.mjs  # 7 个 MCP 自动安装脚本（codegraph/playwright/shadcn/tailwind/lucide/postgres）
├── .agents/
│   ├── rules/          # 89 个编码规则文件（16 语言 × common + 中文副本）
│   ├── skills/         # 6 个技能（design-system + 5 openspec-*）
│   └── memorys/        # 4 个项目记忆文件（status/conventions/decisions/pitfalls）
├── docs/
│   ├── architecture.md           # ~1,700 行 — 系统架构概览（6 主章）
│   ├── modules/                  # 按模块组织的详细设计子文档
│   │   └── hal/                  # 19 份 HAL 子文档（独立维护，覆盖 17 个设计主题）
│   ├── reference/                # 41 篇竞品参考文档（12 大类别）
│   ├── plans/                    # P0 实施计划文档
├── openspec/           # OpenSpec 变更管理与 SDD 规范目录
│   ├── specs/                     # 4 份 SDD 规范文档（121 项）
│   └── changes/                   # 变更提案目录
├── SKILL.md            # 技能注册表（superpowers + 项目专属 + agents）
├── AGENTS.md           # 本文件 — 项目知识库入口
├── README.md           # 项目简介
├── package.json        # 极简：仅 `name: "AUDESYS"` + `@colbymchenry/codegraph` 开发依赖
├── package-lock.json   # npm lock 文件
├── LICENSE             # Apache 2.0
└── .gitignore          # 排除 .sisyphus/
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 项目状态和阶段 | `.agents/memorys/status.md` | 模块状态表、已知缺失 |
| 架构决策 | `.agents/memorys/decisions.md` | D1-D19 + G1-G5 |
| 编码约定 | `.agents/memorys/conventions.md` | 命名、不可变性、TS 规范、HAL 设计约定 |
| 已知坑点 | `.agents/memorys/pitfalls.md` | MODACS 适配 + HAL 设计审核 |
| HAL 详细设计 | `docs/modules/hal/` | 19 份独立子文档：协议原语、amw、类型系统、线程调度、多语言等 17 个设计主题 |
| 架构文档 | `docs/architecture.md` | 系统级模块概览、HAL §一 精简到 168 行交叉引用 |
| 多语言策略 | `docs/modules/hal/multi-language-strategy.md` | Rust/C++/15 语言三层架构 + FlatBuffers |
| 语言规则 | `.agents/rules/{lang}/` | 各语言专属规则 |
| Agent 配置 | `.opencode/opencode.json` | instructions、MCP、LSP |
| Agent 使用指南 | `.opencode/agent-guide.md` | OMO 编排体系、5 层模型路由 |
| 技能注册表 | `SKILL.md` | superpowers + 项目专属技能清单 |
| 通用规则 | `.agents/rules/common/` | 安全、编码风格、测试、Git 工作流 |
| 参考文档库 | `docs/reference/` | 41 篇竞品分析（12 大类别），每篇 ≥800 行 |
| 安全规则 | `.agents/rules/common/security.md` | Secret management、XSS、CSRF |
| Runtime 设计文档 | `docs/modules/runtime/` | 4 份子文档：IPC安全、可观测性、硬件需求、升级策略 |

## CODE MAP
_当前无源代码。以下为架构文档中规划的模块：_

| 模块 | 状态 | 规划路径 |
|------|------|----------|
| Studio IDE (§11) | 🔲 计划中 | `apps/studio` + `packages/studio-core/` |
| Runtime (§6) | 🔲 计划中 | `apps/runtime/`（6 模块套件），详见 `docs/modules/runtime/`（4 份子文档） |
| Simulator (§15) | 🔮 Phase 3/4 | AVD Manager（7 种虚拟设备） |
| HAL 硬件抽象 | 🟡 详细设计完成 | `docs/modules/hal/`（19 份子文档） |
| 工业调试桥 | 🔲 计划中 | — |
| 实时控制 | 🔲 计划中 | — |

## CONVENTIONS
### AUDESYS 独有
- **命名**: `AUDESYS` 全大写，npm scope `@audesys/`
- **去 MODACS 化**: 保持零 MODACS 残留，每次修改后运行 `grep -ri modacs . --exclude-dir=.git --exclude-dir=.sisyphus`
- **精确编辑**: 不全局 MODACS→AUDESYS 替换，使用手术式编辑
- **@modacs/* 移除**: 移除所有 `@modacs/*` 引用，不自动替换为 `@audesys/*`
- **文档组织**: 概览 → `architecture.md`，详细设计 → `docs/modules/{module}/` 子文档

### TypeScript
- 公共 API 显式类型注解
- `interface` 优先于 `type`（对象形状）
- `unknown` > `any`
- Zod 用于边界层模式验证
- 禁止 `as any` / `@ts-ignore` / `console.log`

### 通用
- 不可变性优先（永不突变，总是创建新副本）
- 小文件 > 大文件（200-400 行典型，800 行最大）
- 显式错误处理，无静默吞异常
- 布尔值前缀 `is`/`has`/`should`/`can`

## ANTI-PATTERNS (THIS PROJECT)
- **`as any` / `@ts-ignore`** — 永不使用，零例外
- **`console.log`** — 生产代码禁止
- **静默吞异常** — `catch(e) {}` 绝对不允许
- **对象突变** — 始终返回新对象，永不就地修改
- **全局 MODACS→AUDESYS 替换** — 使用精确的手术式编辑
- **硬编码密钥** — 使用环境变量或密钥管理器
- **不必要的文件写入** — 文档文件仅在用户明确要求时创建
- **引入第 4 种通信原语** — Signal/StreamChannel/RPC 已正交覆盖全部场景
- **引入完整 DDS QoS** — HalQoS 三个最小维度足以满足工业需求

## COMMANDS
```bash
# 尚无构建脚本——package.json 不包含 scripts 字段
# 仅有 devDependency: @colbymchenry/codegraph
npm install    # 安装依赖（如需要）
```

## NOTES
- **零源代码** — 项目处于文档驱动设计阶段，HAL 详细设计已完成
- **从 MODACS 分离** — 2026-07-08 首次提交。无 MODACS 代码共享
- **.sisyphus/** 被 gitignore 排除 — 计划文件和证据不提交到仓库
- **双 package.json** — 根目录用 npm，`.opencode/` 用独立包（插件系统）
- **HAL 设计审核** — 3 专家 × 27 项发现，全部交互式确认，12 份独立文档合并为详细设计
- **Agent 超配** — 规则（89 个文件）和 MCP 服务器（7 个活动）是为未来开发准备的
- **test 基础设施** — 不存在。要求 80% 覆盖率、TDD、AAA 模式（在规则中声明，但无框架可执行）
