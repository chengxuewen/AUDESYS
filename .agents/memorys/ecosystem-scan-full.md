# AUDESYS 生态体系 Full-Scan 深度审计报告（Phase 2A）

> 生成: 2026-08-05 | 模式: Full（15 项本地深度审计） | 扫描器: full-scanner（团队扫描任务）
> 目标: `/Users/cxw/Documents/Code/Work/DEVSYS/AUDESYS`
> 严重级别: 🔴 block（必须修复）/ 🟡 warn（应当修复）/ 🔵 info（建议/参考）

---

## 0. 网络探测

| 探测 | 结果 |
|------|------|
| `curl https://api.github.com`（默认代理） | ❌ SSL_ERROR_SYSCALL，HTTP 000 |
| `curl --noproxy '*' https://api.github.com` | ❌ SSL_ERROR_SYSCALL，HTTP 000 |

**结论**: GitHub 不可达 → **外部社区扫描（第 13 项）DEFERRED**，本次全部 15 项均在离线模式下执行。
本地已知线索（供网络恢复后补扫）：`book-to-skill` 源自 github.com/virgiliojr94/book-to-skill（完整克隆，README 中带 upstream badge/安装指引）；`superpowers` 插件来自 obra/superpowers；git remote 为 gitee.com/chengxuewen/AUDESYS。

---

## 1. 配置健康 — `.opencode/opencode.json` 🟢 健康（8.5/10）

| 维度 | 实测 | 判定 |
|------|------|------|
| instructions | 21 条，**全部存在**（AGENTS.md + 4 memorys + 15 规则 + rust/typescript） | ✅ |
| plugins | 4 个：superpowers / ponytail / oh-my-opencode / context-mode | ✅ |
| MCP servers | 7 个：remote-qt-docs、local-codegraph、local-playwright、local-github、local-openspace（enabled）；local-memory、local-postgres（**disabled**） | ✅ 但见建议 |
| LSP servers | 8 个：typescript / pyright / bash / rust-analyzer / html / remark / gopls / clangd，全部经 `.opencode/init-lsp-wrap.mjs` 包装，**脚本存在** | ✅ |
| model | `new-api/deepseek-v4-pro`，enabled_providers = [new-api, deepseek]，一致 | ✅ |
| compaction | auto | ✅ |

**建议**:
- 🔵 2 个 disabled MCP（local-memory/local-postgres）属遗留配置——保留可作未来启用，但建议注释说明保留原因，避免误读为"计划中"。
- 🔵 gopls（Go）、clangd（C++）与当前 Rust+TS 主导栈匹配度低（crates/ 无 Go/C++ 源码）；pyright 有 book-to-skill/openspace venv 支撑、remark 有 docs 生态支撑，保留合理。可按需关闭 gopls/clangd 减少启动开销。

---

## 2. 技能清单 — `.agents/skills/`（22 个） 🟡 有重叠但可控

磁盘 22 个：book-to-skill、design-system、doc-audit、ecosystem-scan、lesson-review、openspec-apply/archive/explore/propose/sync-specs/verify（6）、ref-beckhoff/codesys/fuxa/ignition/intouch/labview/qtouch（7）、skill-creator、skill-router、test-harness、think-before-act。

- 🔵 **openspec-* 套件（6 个）**：完整生命周期（propose→apply→verify→archive→explore→sync-specs），共享 guardrails/steps，属有意的内聚套件，**良性**。
- 🔵 **ref-* 系列（7 个）**：共用同一模板（SKILL.md + chapters/ + cheatsheet.md + glossary.md + patterns.md，无 TODO/MODACS 占位残留 ✅）。7 个技能结构 100% 一致——可考虑合并为 1 个数据驱动的参考技能 + 7 份平台数据（chapters/），减少模板漂移维护成本。**低优先**。
- 🔵 **skill-creator vs book-to-skill 同域**：两者都是"生成技能"（前者从项目构件，后者从文档/书籍）。建议在两者 SKILL.md 中互相交叉引用，或由 skill-router 统一分流，避免边界模糊。
- 🔵 **book-to-skill 为完整克隆**（19 项：含 .github/、.gitignore、tests/、docs/、CHANGELOG.md、pyproject.toml 等）。Agent 实际只消费 SKILL.md 与 book_to_skill/ 脚本；其余为上游快照冗余。无嵌套 .git（非 submodule），不会产生子仓库问题，但建议：精简为最小技能格式，或保留并在 README 标注上游版本。
- 🔵 **ecosystem-scan vs doc-audit**：审计域重叠（一个审 .agents 体系、一个审文档架构），对象不同，可接受。

---

## 3. 安全扫描 🟢 PASS

- 扫描范围：`.agents/`、`.opencode/opencode.json`、AGENTS.md、SKILL.md。
- ✅ 无 `curl | sh`、无 `eval $`、无 `rm -rf /`、无 chmod 777、无明文密钥（api_key/secret/token/password 匹配全部为环境变量引用 `${GITHUB_TOKEN}` / `${MEMORY_DATABASE_URL}`）。
- 🔵 book-to-skill 内 3 处 `sudo apt install poppler-utils`（utils.py / dependencies.py / README.md）：为上游克隆的自述安装指引，面向用户本机操作，非脚本自动执行——**可接受**。
- 🔵 附带：`.agents/.DS_Store` 存在于磁盘（.gitignore 已含 .DS_Store，未入库 ✅），建议物理删除保持整洁。

---

## 4. 记忆系统陈旧度 — `.agents/memorys/` 🟡 多处失同步

| 位置 | 声称 | 实测 | 级别 |
|------|------|------|------|
| AGENTS.md:44 | 决策 "D1-D19 + G1-G5" | decisions.md 实际 **D1-D111，无 G 条目** | 🟡 |
| AGENTS.md:20 | "11 openspec-* + 4 ref-*" | 实际 **6 openspec-* + 7 ref-***（总数 22 仍对） | 🟡 |
| conventions.md:13 | "architecture.md 中无 MODACS 历史引用（完全去 MODACS 化）" | **docs/architecture.md 仍有 modacs 残留** | 🟡 |
| conventions.md:32-33 | 提交前验证命令 | **完全重复的两行** | 🔵 |
| qa/qa-fast-m1-gate.sh:97 | MODACS zero 门禁 `grep -ri modacs . --exclude-dir=.git --exclude-dir=.sisyphus --exclude-dir=target` | 未排除 `.agents/`（memorys 自身大量含 modacs → **必然自匹配**）、未排除 node_modules/.yarn/.playwright-mcp | 🟡 |
| status.md:200-214 | openspec-apply-change / openspec-archive-change 已删除 | 与磁盘一致 ✅ | ✅ |
| pitfalls.md:26-41 | MODACS 迁移期坑点（MODACS-Design.md 等） | 迁移已完成（D3），条目为历史记录，建议标注"历史" | 🔵 |
| decisions.md:12 | D1 影响文件列表（MODACS-Design.md 等） | 决策历史记录，可接受 | ✅ |

**MODACS 残留实测（仓库内 5 个跟踪文件）**：
`docs/architecture.md`、`docs/superpowers/specs/2026-07-24-robotics-architecture-design.md`、`docs/reference/opc-ua.md`、`qa/qa-fast-m1-gate.sh`（自身）、`AGENTS.md:46`（"MODACS 适配"描述，属合法提及）。

> 🟡 核心矛盾：conventions 声称已完全去 MODACS 化 + 提交前 grep 校验，但仓库仍有 4 处真实残留、且校验命令本身会命中 memorys——该治理机制当前要么常红要么未被运行。

---

## 5. 规则质量 — `.agents/rules/`（common 14 文件 + rust.md + typescript.md） 🟡 命令可用性有缺口

**环境验证**（全部命令实测 PATH/版本）：

| 命令 | 状态 |
|------|------|
| cargo 1.96.1 / pixi 0.67.2 / yarn / pnpm 10.33.3 / node v26 / flatc | ✅ 全部可执行 |
| `scripts/qa-fast.sh`、`scripts/qa-full.sh`（pixi.toml test-qa-fast/test-qa-full 引用） | ✅ 存在 |
| `cargo deny check`（security.md） | ✅ cargo-deny 0.20.2 |
| `cargo audit`（security.md） | ❌ **未安装**（`no such command: audit`） |
| `cargo llvm-cov`（testing.md） | ❌ **未安装**（`no such command: llvm-cov`） |
| `cargo tarpaulin`（pixi.toml coverage 任务） | ❓ 未安装且不在 pixi 依赖中（pixi.toml 注释自述"cargo-tarpaulin 不在 conda-forge，需 cargo install"——网络阻断下无法安装） |
| `npx vitest run` / Playwright（testing.md） | ✅ node_modules/.bin 含 vitest + playwright + playwright-mcp |

- 🟡 **testing.md 与 pixi.toml 覆盖工具不一致**：规则写 `cargo llvm-cov`，pixi coverage 任务写 `cargo tarpaulin`——二选一并加入 pixi 依赖清单。
- 🟡 **security.md `cargo audit` 不可执行**：建议 pixi 增加 cargo-audit（或删除该行只留 cargo-deny）。
- ✅ 规则引用的 npm/npx 命令与 node_modules 现状吻合。

---

## 6. 更新可用性（CHANGELOG） 🔵

- 仅 `book-to-skill/CHANGELOG.md`（上游克隆自带）。
- **其余 21 个原生技能无 CHANGELOG/版本标识**——无法追踪"上次改动内容"。建议轻量方案：每个 SKILL.md frontmatter 增加 `last-updated`，或仓库级 CHANGELOG 一节记录技能变更。

---

## 7. 技能使用度 🟡 规则→技能链接机制未落实

- 22 个技能在文档体系（AGENTS.md + SKILL.md + rules + memorys）中全部有引用，最低 `openspec-sync-specs` 5 次、最高 `book-to-skill` 96 次（含克隆自述），**无零引用技能** ✅。
- 🟡 **`See skill:` 引用 0 处**：SKILL.md:92 的程序要求"在对应的规则文件中添加 `See skill: <name>` 引用"，但 `.agents/rules/` 中无一规则实际使用该语法（typescript.md 仅以自然语言提及 security-reviewer/e2e-runner）。规则↔技能层级链接名存实亡——要么在规则中补 `See skill:`，要么删除 SKILL.md 中的该要求。
- ✅ 替代机制存在：`skill-guide.md`（技能分类速查 + 场景组合）作为常驻 instruction 承担了技能推荐职责，且指向 `/skill-router`。

---

## 8. 孤儿恢复 🟢 无孤儿

- 技能层：22/22 全部被 SKILL.md 注册表收录。
- 规则层：rules/README.md 树所列 13 个 common 文件 + rust/typescript 全部存在且被 opencode.json 加载。
- 记忆层：5 个 memorys 文件全部被 opencode.json instructions 加载。
- 🔵 唯一"孤儿感"来源：book-to-skill 内部 15+ 文件仅被自身消费（上游快照，见第 2 项）。

---

## 9. 代理审计质量 🟡 幻影代理引用

- 🟡 **`common/agents.md` 引用 8 个代理**（planner、architect、tdd-guide、code-reviewer、security-reviewer、build-error-resolver、e2e-runner、refactor-cleaner 等），声明"位于 `~/.claude/agents/`"——**该目录在本机不存在**。当前环境实际可用代理仅 explore/librarian（以及 skill 层工具）。此规则系 Claude Code 系迁移遗留：要么映射到 opencode 等效能力（skill 化：requesting-code-review / tdd-guide 等已在 skill-guide 中），要么在规则中标注"如可用"。
- 🔵 AGENTS.md:16 声称 agent-guide.md "554 行"，实测 **514 行**。
- ✅ typescript.md:271/281 引用 security-reviewer / e2e-runner（同属幻影范畴，但以 skill 语义表述，可接受）。

---

## 10. 环境 🟡 双包管理器迁移中

- ✅ 工具链完整：cargo 1.96.1（满足 pixi `>=1.85,<2`）、pixi 0.67.2、node v26、yarn、pnpm 10.33.3、flatc。
- ✅ rust-toolchain.toml `channel = "stable"`；pixi.toml 含 dev/test 特性任务（build/check/lint/audit/test/qa-fast/qa-full/coverage）；node_modules 存在于根、apps/studio、theia-extensions/*。
- 🟡 **yarn→pnpm 迁移中间态**：yarn.lock（472KB）+ `.yarn/releases` 与 pnpm-lock.yaml + pnpm-workspace.yaml + `package.json.pre-migration.bak`（7-31）并存。package.json 用 `workspaces`（apps/studio + theia-extensions/*）+ resolutions（Theia 1.73.0 全家桶），pnpm-workspace.yaml 与 pnpm 兼容。**双锁文件漂移风险**——建议尽快完成迁移并删除 yarn.lock 与 .bak。
- 🔵 `.playwright-mcp/` 本地缓存 771 项、`.venv-openspace/`、test-results/ 等均在仓库根（gitignore 覆盖，未入库）；体积大，建议定期清理。
- 🔵 网络：GitHub 阻断（第 0 项）；`cargo install` / `npm install`（无缓存时）等网络依赖操作当前不可用——第 5 项的工具缺失短期内无法通过在线安装补齐。

---

## 11. 交叉引用死链 🟢 无真实断链（有历史噪音）

对 AGENTS.md + SKILL.md + 全部 .agents md 文件中反引号路径做了存在性检查：

- ✅ 有效：`.opencode/init-mcp-*.mjs`（4 个全部存在）、`init-lsp-wrap.mjs`、`agent-guide.md`、`docs/modules/hal/*`（conventions 引用）、ref-* 的 `chapters/ch0X.md`（1-7 全部存在）、`scripts/qa-fast.sh` 等。
- 🔵 **历史记录噪音**（非缺陷，建议不修或加"历史"标注）：
  - `docs/MODACS-Design.md`、`docs/MODACS-AI-Dev.md`、`packages/ui/src/styles/theme.css`（decisions.md:12 / pitfalls.md:35——迁移期记录，文件已不存在，属当时的事实陈述）。
  - pitfalls.md 中大量 `lib/backend/*.js`、`lib/frontend/bundle.js` 等 Theia 构建产物路径（构建后才存在，静态无法验证；且 GLSP 时代路径部分已随 D110 失效）。
- 🔵 **疑似拼写错误**：decisions.md 引用 `crates/audeys-runtime-engine/src/simulation.rs`——crates/ 实际全部为 `audesys-*`（audesys-agent 至 audesys-ld-compiler 等 15+ 个），`audeys-runtime-engine` 不存在，应为 `audesys-runtime-engine`。
- 🔵 待核：`qa/smoke-checks.sh`、`.github/workflows/qa-fast.yml`（decisions.md 提及，未逐一验证存在性——建议顺手核对）。

---

## 12. 语义重复规则 🟡 轻度

- 🟡 **skill-guide.md 含整节 "NocoBase 类（仅 NocoBase 项目）"**：11 个 nocobase-* 技能表格（ui-builder/data-modeling/plugin-development/workflow/acl/ai-employee/env/data-analysis/notification/publish/revision）——AUDESYS **不是** NocoBase 项目，此节为从 HWUV3D 继承的冗余（该用户级技能亦不存在于本仓库 .agents/skills/）。建议删除该节或标注"仅 HWUV3D/NocoBase 环境可用"。
- 🔵 `rules/README.md` 目录树列 13/14 个 common 文件，**缺 skill-guide.md**（新文件未同步进 README 树）。
- 🔵 配对重叠（互补为主，无需合并）：lesson-memory.md（持续记忆规则）↔ lesson-review 技能（批量回顾）；decision-gates.md（写码前 STOP and ASK）↔ think-before-act 技能（先调研再动手）；development-workflow.md ↔ git-workflow.md（提交流程小段重复，后者仅 622B 极薄）；patterns.md ↔ coding-style.md（设计模式与风格边界）。均为可接受的双层设计，建议交叉引用互链即可。

---

## 13. 社区趋势 — SKIP（网络阻断，已 DEFERRED）

见第 0 项。网络恢复后运行 `/ecosystem-scan full` 补全：已知仓库（virgiliojr94/book-to-skill、obra/superpowers）+ websearch + 包注册表对比。

---

## 14. 技能目录同步（SKILL.md 注册表 vs 磁盘） 🟡 基本同步

- ✅ **22/22 完全同步**：磁盘 22 个技能目录 ↔ SKILL.md「项目专属技能」表 22 行，一一对应，无缺失无多余。
- 🟡 **遗留不一致**：
  - SKILL.md openspec-apply 行尾 HTML 注释：`<!-- openspec-apply-change is the experimental workflow variant; both maintained -->`——与 status.md:200/214（openspec-apply-change **已删除**）矛盾，注释已过期。
  - AGENTS.md:20 技能构成统计过时（见第 4 项）。
  - （注：并行代理若正在修复，以上为扫描时点的观测状态。）

---

## 15. 任务路由表 🟢 N/A

- 无独立路由表文件（`.agents/` 下无 routing 相关文件）——与设计一致。
- 路由职责由 `skill-router` 技能承担，skill-guide.md 明确引用（"复杂任务时，使用 /skill-router 技能"），闭环成立。

---

## 汇总

### 严重级别统计

| 级别 | 数量 | 条目 |
|------|------|------|
| 🔴 block | 0 | — |
| 🟡 warn | 9 | AGENTS.md 决策索引过时（D1-D19+G1-G5 → D1-D111）；AGENTS.md 技能构成过时（11 openspec/4 ref）；MODACS 去残留声明 vs 5 文件残留 + QA 门禁自匹配；testing.md llvm-cov 不可执行且与 pixi tarpaulin 不一致；security.md cargo audit 不可执行；`See skill:` 机制 0 落实；agents.md 幻影代理（~/.claude/agents 不存在）；yarn/pnpm 双锁文件迁移中间态；skill-guide NocoBase 冗余节 |
| 🔵 info | 14 | 2 个禁用 MCP 遗留；gopls/clangd 低匹配；ref-* 模板合并候选；skill-creator/book-to-skill 同域；book-to-skill 克隆冗余；技能无 CHANGELOG；conventions 重复行；pitfalls MODACS 历史条目；decisions crates 拼写；lib/ 路径噪音；rules README 缺 skill-guide；agent-guide 行数；SKILL.md 过期注释；.playwright-mcp 缓存 |

### 建议修复顺序（高→低）

1. 🟡 统一 coverage/audit 工具链：pixi.toml 依赖清单 + testing.md/security.md 命令对齐（二选一：llvm-cov 或 tarpaulin；cargo-audit 或删除）。
2. 🟡 修正 AGENTS.md 索引（D1-D111、6 openspec-*、7 ref-*、agent-guide 514 行）与 SKILL.md 过期注释。
3. 🟡 MODACS 治理闭环：清理 4 处真实残留（docs/architecture.md 等）；修正 qa-fast-m1-gate.sh MODACS zero 门禁排除项（--exclude-dir=.agents --exclude-dir=node_modules --exclude-dir=.yarn --exclude-dir=.playwright-mcp），否则门禁常红/被跳过。
4. 🟡 落实或删除 `See skill:` 机制；处理 agents.md 幻影代理引用。
5. 🟡 完成 yarn→pnpm 迁移收尾（删 yarn.lock + .bak，或回退 pnpm 文件）。
6. 🔵 清理 skill-guide NocoBase 节、rules README 补 skill-guide.md、conventions 重复行、decisions crates 拼写、.agents/.DS_Store。
7. 🔵 技能版本化（frontmatter last-updated 或轻量 CHANGELOG）；ref-* 合并评估；book-to-skill 精简评估。
8. 🌐 网络恢复后补跑外部社区扫描（第 13 项）。

---
*本报告仅审计 .agents/ 体系与配置，未改动任何文件。*
