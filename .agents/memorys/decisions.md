# AUDESYS 架构决策

## D1: 项目命名规范 = AUDESYS
- **日期**: 2026-07-08
- **决定**: 全大写 `AUDESYS`，npm scope 用 `@audesys/`
- **理由**: 与 `package.json`（name="AUDESYS"）和 git remote 一致

## D2: 缺失依赖文件 = 移除引用
- **日期**: 2026-07-08
- **决定**: 从 SKILL.md 和 agent-guide.md 中删除对不存在文件的引用
- **理由**: 技能/指南应自包含，不依赖外部文件
- **影响的引用**: `docs/MODACS-Design.md` (14x)、`packages/ui/src/styles/theme.css` (4x)、`docs/MODACS-AI-Dev.md`、`~/.omo/teams/modacs-dev/config.json`

## D3: architecture.md 历史引用 = 完全去 MODACS 化
- **日期**: 2026-07-08
- **决定**: 移除所有 MODACS 历史叙述，重写为独立项目文档
- **理由**: 不应保留任何 MODACS 痕迹

## D4: .agents/rules/ 通用规则 = 仅扫描确认
- **日期**: 2026-07-08
- **决定**: 89 个规则文件已验证零 MODACS 引用，不做修改
- **理由**: 文件不含 MODACS 字样，通用开发规则与项目名无关

## D5: design-system SKILL.md = 保留并重品牌
- **日期**: 2026-07-08
- **决定**: 保留设计系统技能，重新品牌为 AUDESYS
- **理由**: AUDESYS 是工业控制平台，需要 UI 一致性

## D6: architecture.md = 骨架占位
- **日期**: 2026-07-08
- **决定**: 去 MODACS 化后内容不足 50% 的章节用 `TODO: 为 AUDESYS 重写此节` 占位
- **理由**: 保留有效技术内容，标记需重写的章节

## D7: agent-guide.md = 精简为空项目指南
- **日期**: 2026-07-08
- **决定**: 简化为匹配 AUDESYS 当前空项目状态
- **理由**: 移除 MODACS 7 阶段工作流、不存在的路径引用

## D8: D4 规则 = 无操作仅扫描
- **日期**: 2026-07-08
- **决定**: 确认性 grep 扫描，预期无修改
- **理由**: 89 个文件已确认零 MODACS 残留

## D9: @modacs/* 命名空间 = 移除引用
- **日期**: 2026-07-08
- **决定**: 移除所有 `@modacs/*` 引用，不替换为 `@audesys/*`
- **理由**: AUDESYS 尚无自己的包命名空间

## 实施防护规则
- **G1**: architecture.md 内容完整性 — 删除后保留率 <50% 的章节变为 TODO 占位符
- **G2**: 删除后文本连贯性 — 无指向已删除 MODACS 上下文的孤立引用
- **G3**: @modacs/* 不自动替换 — 仅移除
- **G4**: 每次修改后运行不区分大小写的 `grep -ri modacs` 验证
