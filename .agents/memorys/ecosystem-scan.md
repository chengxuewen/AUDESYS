# Ecosystem Scan Report — AUDESYS

> 生成: 2026-08-05 | 模式: Quick | 工具: ecosystem-scan (HWUV3D 移植版)

## 结论

🟡 **1 项值得关注（技能注册表失同步）**；外部生态扫描受阻（GitHub 不可达）。

## Phase 1A: 本地快速审计（8 项）

| # | 检查项 | 结果 | 说明 |
|---|--------|------|------|
| 1 | opencode.json instructions | ✅ PASS | 21 条全部存在；4 插件（superpowers/ponytail/oh-my-opencode/context-mode）、7 MCP、8 LSP 已配置 |
| 2 | SKILL.md frontmatter | ✅ PASS | 22/22 有 name + description |
| 3 | memorys 编号连续 | ✅ PASS | decisions.md D1–D111 完全连续；conventions/pitfalls/status 为自然语言结构 |
| 4 | memorys 交叉引用 | ✅ PASS | 7 处引用全部有效（`rules/common/testing.md`、`skills/doc-audit`、`test-harness`、`skill-creator`） |
| 5 | 重复内容 | ⚠️ 良性 | ref-* 系列共用模板标题（模板生成，有意为之）；openspec 套件共享 guardrails/steps；个别通用中文标题（触发条件/工作流/推荐） |
| 6 | 孤儿文件 | ✅ PASS | 无实质孤儿（skill-guide.md 被 opencode.json 加载；book-to-skill 为完整克隆仓库，文件属其自身） |
| 7 | 技能注册表同步 | 🔴 FAIL | 见下方问题 1 |
| 8 | 任务路由表 | ✅ N/A | 无独立路由表，路由由 skill-router 技能承担（一致） |

## 🔴 问题 1（MEDIUM）: 技能注册表失同步

根 `SKILL.md`「项目专属技能」表：

- **2 个死链**：`openspec-apply-change`、`openspec-archive-change` 目录已不存在，注册表仍引用
- **4 个未注册**：`ecosystem-scan`、`lesson-review`、`skill-router`、`think-before-act` 存在于磁盘但不在注册表中（且这 4 个无 `.skill_id` 文件）
- 表头行重复（markdown 渲染瑕疵）

`AGENTS.md` STRUCTURE 图：「skills/ # 6 个技能」— 实际 22 个。

修复：删 2 行死链、补 4 行注册、更新计数（< 5 分钟）。

## 🟡 Phase 1B: 外部扫描 — 受阻

GitHub 不可达（代理 127.0.0.1:7897 无响应、直连被断；gh CLI 未安装；gitee 可达）。webfetch/curl 均失败。

本地已知线索：

- `book-to-skill` 源自 github.com/virgiliojr94/book-to-skill（完整克隆，含 tests/docs/.github）
- `superpowers` 插件来自 obra/superpowers

建议：网络恢复后运行 `/ecosystem-scan full` 补全社区扫描（已知仓库 + websearch + MCP 搜索）。

## 🔎 附带发现（对 HWUV3D 移植有参考价值）

AUDESYS rules/ 中存在但 **HWUV3D 未移植** 的规则文件：

- `.agents/rules/common/decision-gates.md`
- `.agents/rules/common/edit-safety.md`
- `.agents/rules/common/lesson-memory.md`
- `.agents/rules/common/skill-guide.md`
- `.agents/rules/typescript.md`

## 安全（Quick 项）

无明文密钥。`.agents/rules/typescript.md` 中 `const apiKey = "sk-proj-xxxxx"` 为「禁止硬编码密钥」规则的占位示例，写法正确。

## 持久化说明

本报告为新增文件 `.agents/memorys/ecosystem-scan.md`，未改动既有 4 个 memorys 文件。
