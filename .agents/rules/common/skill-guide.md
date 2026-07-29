# Skill Guide — 技能选择指南

> 本文件作为常驻 instruction，帮助 agent 在合适时机主动推荐技能。
> 复杂任务时，使用 `/skill-router` 技能进行深度分析。

## 技能分类速查

### 流程类（HOW to work）

| 技能 | 触发时机 | 优先级 |
|------|----------|--------|
| brainstorming | 任何创造性任务前（新功能、组件、行为变更） | **必用** |
| writing-plans | 有规格/需求，需要多步实施计划 | 高 |
| executing-plans | 已有实施计划，开始执行 | 高 |
| subagent-driven-development | 计划中有独立任务可并行 | 中 |
| test-driven-development | 实现功能或修复 bug，写代码前 | **必用** |
| systematic-debugging | 遇到 bug、测试失败、意外行为 | **必用** |
| think-before-act | 复杂决策，需要先调研再动手 | 高 |

### 质量类（CHECK quality）

| 技能 | 触发时机 | 优先级 |
|------|----------|--------|
| requesting-code-review | 完成任务、实现功能、合并前 | 高 |
| receiving-code-review | 收到代码审查反馈时 | 中 |
| verification-before-completion | 声称完成前 | **必用** |
| ai-slop-remover | 代码有 AI 生成味道时 | 中 |
| review-work | 完成重要实现后 | 高 |

### Git/工作流类

| 技能 | 触发时机 | 优先级 |
|------|----------|--------|
| git-master | 任何 git 操作（commit/rebase/squash/blame） | **必用** |
| finishing-a-development-branch | 实现完成，决定如何集成 | 中 |
| using-git-worktrees | 需要隔离工作区 | 低 |

### AUDESYS 项目类

| 技能 | 触发时机 | 优先级 |
|------|----------|--------|
| openspec-propose | 描述想构建什么，需要完整提案 | 高 |
| openspec-apply | 开始实施变更提案 | 高 |
| openspec-verify | 实施任务完成后验证 | 高 |
| openspec-explore | 想法/问题需要探索澄清 | 中 |
| openspec-archive | 变更完成，归档 | 低 |
| openspec-sync-specs | 同步 delta specs 到主 specs | 低 |
| doc-audit | 文档变更后、阶段切换前 | 中 |
| test-harness | 需要从 SDD 生成测试 | 中 |
| design-system | 创建/修改 UI 组件 | 高 |
| skill-creator | 创建新技能 | 低 |
| ecosystem-scan | 优化 .agents/ 体系 | 低 |
| lesson-review | 回顾经验教训 | 低 |
| book-to-skill | 从文档/书籍提取技能 | 低 |

### NocoBase 类（仅 NocoBase 项目）

| 技能 | 触发时机 |
|------|----------|
| nocobase-ui-builder | 新页面、block、菜单、布局调整（**默认入口**） |
| nocobase-data-modeling | 检查/修改 collections、fields、relations |
| nocobase-plugin-development | 创建/开发 NocoBase 插件 |
| nocobase-workflow-manage | 检查/创建/诊断工作流 |
| nocobase-acl-manage | 角色、权限策略、用户-角色管理 |
| nocobase-ai-employee | AI 员工生命周期（发现、创建、配置） |
| nocobase-env-manage | 环境引导、运行时、CLI 维护 |
| nocobase-data-analysis | 查询分析业务数据 |
| nocobase-notification-manage | 通知管理（消息、邮件、工作流通知） |
| nocobase-publish-manage | 备份恢复、迁移发布 |
| nocobase-revision | 保存里程碑为可恢复修订 |
| nocobase-prototype-repro | 有原型/截图需要复现时 |
| nocobase-dsl-reconciler | 用户明确要 YAML/DSL/git 工作流时 |
| nocobase-utils | 通用参考工具（表达式、UID 等） |
| nocobase-plugin-manage | 检查/启用/禁用插件 |

### 参考类（REFERENCE patterns）

| 技能 | 触发时机 |
|------|----------|
| ref-codesys | 参考 CODESYS 设计 |
| ref-beckhoff | 参考 Beckhoff 设计 |
| ref-qtouch | 参考 Qtouch 设计 |
| ref-ignition | 参考 Ignition 设计 |
| ref-fuxa | 参考 FUXA 设计 |
| ref-intouch | 参考 InTouch 设计 |
| ref-labview | 参考 LabVIEW 设计 |

### 工具类（UTILITIES）

| 技能 | 触发时机 |
|------|----------|
| ponytail | 任何编码任务（强制最简方案） |
| team-mode | 需要并行 agent 团队 |
| dispatching-parallel-agents | 2+ 独立任务可并行 |
| playwright | 浏览器相关任务 |
| customize-opencode | 编辑 opencode 配置 |

---

## 场景组合建议

### 新功能开发
```
brainstorming → writing-plans → [确认] → test-driven-development → executing-plans → requesting-code-review → verification-before-completion → git-master
```

### Bug 修复
```
systematic-debugging → test-driven-development → requesting-code-review → verification-before-completion → git-master
```

### 文档变更
```
doc-audit → [修复] → verification-before-completion → git-master
```

### NocoBase 应用构建
```
nocobase-data-modeling → nocobase-ui-builder → nocobase-workflow-manage → nocobase-revision
```

### 代码审查
```
requesting-code-review → receiving-code-review → [修复] → verification-before-completion → git-master
```

### 架构决策
```
openspec-explore → openspec-propose → [确认] → openspec-apply → openspec-verify → openspec-archive
```

---

## 主动推荐规则

### 必须主动推荐的场景

1. **用户说"实现 X"/"添加 Y"/"修复 Z"** → 推荐 brainstorming + TDD
2. **用户说"完成"/"做好了"/"可以了"** → 推荐 verification-before-completion
3. **用户说"提交"/"commit"/"合并"** → 推荐 git-master + requesting-code-review
4. **用户说"调试"/"出错了"/"不工作"** → 推荐 systematic-debugging
5. **用户描述新功能需求** → 推荐 brainstorming + openspec-propose
6. **用户说"审查"/"review"** → 推荐 requesting-code-review 或 receiving-code-review
7. **用户开始编码** → 推荐 ponytail（强制最简方案）

### 不推荐技能的场景

1. 用户问简单问题（"X 是什么？"）
2. 用户只是聊天/确认（"ok"/"继续"/"好的"）
3. 任务已经很明确且简单（1-2 行修改）

---

## 技能优先级排序

当多个技能可能适用时，按此顺序：

1. **安全/验证类** verification-before-completion > security > code-review
2. **流程类** brainstorming > TDD > debugging
3. **项目特定** openspec-* > nocobase-* > ref-*
4. **工具类** ponytail > team-mode > playwright
5. **文档类** doc-audit > book-to-skill > skill-creator

---

## 快速决策树

```
用户消息
  │
  ├─ 创造性任务？→ brainstorming
  │
  ├─ 写代码？→ ponytail + TDD
  │
  ├─ 调试？→ systematic-debugging
  │
  ├─ 完成？→ verification-before-completion
  │
  ├─ 提交？→ git-master
  │
  ├─ 审查？→ requesting/receiving-code-review
  │
  ├─ NocoBase？→ nocobase-ui-builder（默认入口）
  │
  ├─ 架构设计？→ openspec-explore/propose
  │
  └─ 其他？→ 正常响应，不推荐技能
```
