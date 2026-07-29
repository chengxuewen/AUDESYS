---
name: skill-router
description: "分析用户意图，推荐最合适的技能组合。当任务复杂、多个技能可能适用、或用户不确定用什么技能时使用。也可用户手动调用 '/skill-router'。"
---

# Skill Router — 技能路由分析

分析用户任务，输出推荐技能列表和执行顺序。

---

## 使用方式

### Agent 主动调用
当检测到以下情况时，agent 应主动调用本技能：
- 任务涉及多个领域（如"实现功能并测试"）
- 用户明确问"该用什么技能"
- 任务复杂度高，需要规划

### 用户手动调用
```
/skill-router
/skill-router <任务描述>
```

---

## 分析流程

### Step 1: 任务分类

将用户任务归类到以下类别：

| 类别 | 关键词/模式 |
|------|------------|
| **创建** | 添加、创建、实现、新建、开发、构建 |
| **修改** | 修改、更新、调整、重构、优化 |
| **修复** | 修复、解决、调试、出错、不工作、失败 |
| **审查** | 审查、检查、验证、review |
| **文档** | 文档、说明、README、注释 |
| **测试** | 测试、覆盖率、spec |
| **部署** | 部署、发布、上线、打包 |
| **探索** | 调研、分析、了解、对比 |
| **NocoBase** | 包含 nocobase、nb、collection、block、workflow 等关键词 |
| **Git** | 提交、合并、分支、rebase、commit |

### Step 2: 上下文检测

检测任务上下文：

- **项目类型**: AUDESYS / NocoBase / 其他
- **语言**: Rust / TypeScript / Python / 其他
- **阶段**: 设计 / 实现 / 测试 / 审查 / 部署
- **复杂度**: 简单(1步) / 中等(2-3步) / 复杂(4+步)

### Step 3: 技能匹配

根据分类和上下文，匹配技能：

#### 创建类任务
```
必选: brainstorming, test-driven-development
条件:
  - 多步任务 → writing-plans + executing-plans
  - 并行可能 → subagent-driven-development
  - UI 组件 → design-system
  - NocoBase → nocobase-ui-builder
  - 新插件 → nocobase-plugin-development
完成后: requesting-code-review → verification-before-completion → git-master
```

#### 修改类任务
```
必选: ponytail, test-driven-development
条件:
  - 重构 → brainstorming（先设计）
  - 大规模 → writing-plans
完成后: requesting-code-review → verification-before-completion → git-master
```

#### 修复类任务
```
必选: systematic-debugging, test-driven-development
条件:
  - 安全相关 → security-reviewer
完成后: requesting-code-review → verification-before-completion → git-master
```

#### 审查类任务
```
必选: requesting-code-review 或 receiving-code-review
条件:
  - AI 代码 → ai-slop-remover
  - 文档 → doc-audit
完成后: verification-before-completion
```

#### NocoBase 类任务
```
默认入口: nocobase-ui-builder
条件:
  - 数据模型 → nocobase-data-modeling
  - 工作流 → nocobase-workflow-manage
  - 权限 → nocobase-acl-manage
  - 有原型 → nocobase-prototype-repro
  - AI 员工 → nocobase-ai-employee
  - 通知 → nocobase-notification-manage
  - 环境 → nocobase-env-manage
```

### Step 4: 输出推荐

输出格式：

```
## 技能推荐

**任务**: [用户任务摘要]
**类别**: [创建/修改/修复/...]
**复杂度**: [简单/中等/复杂]

### 推荐技能链

1. **[技能名]** — [用途说明]
2. **[技能名]** — [用途说明]
3. ...

### 可选技能

- [技能名] — [何时需要]
- ...

### 执行顺序

[技能1] → [技能2] → [技能3] → ...

### 跳过建议

如果任务简单（[说明]），可以跳过 [技能名]。
```

---

## 特殊规则

### 1. 简单任务逃生
如果任务明确是 1-2 行修改，直接推荐 ponytail，不推荐完整流程。

### 2. 安全优先
涉及认证、权限、密钥、支付的任务，必须推荐 security 相关检查。

### 3. NocoBase 默认路径
NocoBase 任务默认从 nocobase-ui-builder 开始，除非用户明确要其他技能。

### 4. 不重复推荐
如果用户已经在使用某个技能，不要重复推荐。

### 5. 组合推荐
多个技能可以组合使用时，说明组合方式和顺序。

---

## 示例

### 示例 1: 新功能
用户: "我想给 Runtime Panel 添加趋势图组件"

输出:
```
## 技能推荐

**任务**: 添加趋势图组件
**类别**: 创建
**复杂度**: 中等

### 推荐技能链

1. **brainstorming** — 探索需求和设计
2. **design-system** — 确保符合 AUDESYS 工业设计系统
3. **test-driven-development** — TDD 实现
4. **verification-before-completion** — 验证完成

### 可选技能

- openspec-propose — 如果需要完整设计提案
- requesting-code-review — 合并前审查

### 执行顺序

brainstorming → design-system → TDD → verification → git-master
```

### 示例 2: Bug 修复
用户: "LD 编辑器打开文件时报错"

输出:
```
## 技能推荐

**任务**: 修复 LD 编辑器报错
**类别**: 修复
**复杂度**: 中等

### 推荐技能链

1. **systematic-debugging** — 系统化定位根因
2. **test-driven-development** — 先写失败测试，再修复
3. **verification-before-completion** — 验证修复

### 执行顺序

systematic-debugging → TDD → verification → git-master
```

### 示例 3: 简单任务
用户: "把这个变量名从 `data` 改成 `signalValue`"

输出:
```
## 技能推荐

**任务**: 变量重命名
**类别**: 修改
**复杂度**: 简单（1 步）

### 推荐

直接使用 ponytail 模式完成，无需额外技能。
```

---

## 边界情况

### 任务不明确
如果用户任务模糊，先问清楚再推荐，不要猜测。

### 多个领域交叉
如果任务涉及多个领域（如"NocoBase 插件需要调用 Rust API"），推荐两个领域的技能链。

### 用户已有偏好
如果用户明确说"用 X 技能"，尊重用户选择，不强制推荐其他技能。
