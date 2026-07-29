---
name: lesson-review
description: "批量会话回顾：系统性提取经验教训，写入项目记忆。长时间调试会话结束后触发。"
---

# lesson-review

> 批量会话回顾：系统性提取经验教训，写入项目记忆。

## 触发条件

- 用户说"总结经验" / "更新记忆" / "记录教训" / "回顾会话"
- 长时间调试会话结束（>1h 或 >3 次失败尝试）
- 用户指出多个错误后
- `/lesson-review` 命令

## 与规则和技能的关系

```
think-before-act  →  [行动]  →  lesson-memory  →  doc-audit
   (咨询)                       (即时捕获)          (定期审计)
                    lesson-review ← 批量补漏
```

| | `lesson-memory` 规则 | `lesson-review` 技能 |
|---|---|---|
| 时机 | 即时（每次错误后，自动触发） | 批量（会话结束/用户触发） |
| 方式 | 反射 | 交互式回顾 |
| 粒度 | 单条教训 | 全会话扫描 |

## 流程

### Step 1: 扫描会话

回顾本次会话中哪些时刻触发了规则但可能遗漏了：

- 编译/构建失败
- >1 次失败尝试才定位根因
- 用户纠正做法/偏好
- 意外发现（"原来如此"）
- 耗时 >30min 的问题
- 编辑后语法损坏

### Step 2: 逐条提取（5 问清单）

对每个发现，逐条完成：

1. **什么错了？**（现象描述）
2. **为什么错？**（根因分析）
3. **正确做法？**（解决方案）
4. **如何预防？**（检查命令 / 约束）
5. **存到哪里？**（按存储目标表）

### Step 3: 写入

按 `lesson-memory` 规则的模板格式写入。平凡修复（1 行/无分支/无副作用）用 1 行捕获，不用完整模板。

### Step 4: 验证

- [ ] 每条 pitfall 有 verify 字段（检查命令）
- [ ] 每条 convention 可被 grep/lint 验证
- [ ] 无重复（grep 目标文件确认）
- [ ] decisions.md 编号连续
- [ ] 高频/高成本教训标注是否需要 CI 门禁升级

## 输出格式

```markdown
## 会话经验总结 — YYYY-MM-DD

### 已记录 (N 条)
1. [标题] → pitfalls.md
2. [标题] → conventions.md
...

### 未记录（无需记录）
- [原因]

### 建议升级
- [某条教训建议添加 CI 门禁，理由：重复 3+ 次/耗费 >1h]
```

## 存储目标（按项目配置）

适用任何项目，修改路径即可：

```
- 技术陷阱 → {pitfall_log}      # AUDESYS: .agents/memorys/pitfalls.md
- 开发约束 → {conventions}        # AUDESYS: .agents/memorys/conventions.md
- 架构决策 → {decisions}          # AUDESYS: .agents/memorys/decisions.md
- 可执行检查 → {checks}           # AUDESYS: .agents/rules/common/edit-safety.md
- 测试要求 → {test_rules}         # AUDESYS: .agents/rules/common/testing.md
```
