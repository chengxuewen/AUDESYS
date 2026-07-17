# OpenCode OMO 配置修复指南：reasoning_content 压缩丢失问题

> **问题标识**: `reasoning_content must be passed back to the API`
> **触发条件**: 使用 DeepSeek V4 Pro 等推理模型 + ACP/OpenCode 上下文压缩
> **影响范围**: 所有通过 `@ai-sdk/openai-compatible` 使用 DeepSeek 推理模型的 OpenCode OMO 项目

---

## 一、问题描述

### 现象

会话中使用 DeepSeek V4 Pro 模型时，上下文自动压缩后下次 API 调用报错：

```
The `reasoning_content` in the thinking mode must be passed back to the API.
```

### 根本原因

```
DeepSeek 推理模式
  → API 响应包含 reasoning_content 字段（模型思考过程）
    → ACP compress 或 OpenCode compaction 压缩旧消息
      → 包含 reasoning_content 的 assistant 消息被替换为摘要
        → reasoning_content 永久丢失
          → 下次 API 调用时 DeepSeek 校验历史消息 → 报错
```

DeepSeek API（类似 Anthropic extended thinking）要求**所有历史 assistant 消息中的 `reasoning_content` 字段必须完整传递回 API**。任何压缩/修剪操作只要移除了这些字段，就会导致请求被拒绝。

### 关键认知

- `opencode.json` 中的 `compaction: { auto: false }` 只关闭了 **OpenCode 内置压缩**
- **ACP 插件**（`opencode-acp`）的 `compress` 功能是独立系统，仍会触发压缩
- 两者不互斥，`compaction: auto=false` **不能阻止 ACP 压缩**

---

## 二、诊断步骤

### 2.1 确认是否为 reasoning_content 问题

```bash
# 1. 检查是否使用 DeepSeek 模型
grep -n "deepseek\|reasoningEffort" .opencode/oh-my-openagent.jsonc

# 2. 检查 ACP 压缩配置
cat .opencode/acp.jsonc | grep -A5 compress

# 3. 检查模型配置中是否有 supportsReasoning
grep -n "supportsReasoning" ~/.config/opencode/opencode.json
```

### 2.2 确认 ACP 压缩是否在运行

会话中执行 `/acp:stats` 查看压缩统计。如果有 `compress` 相关计数，说明 ACP 压缩已触发。

---

## 三、修复方案

### 修复 1：禁用所有模型的 Reasoning 模式（`~/.config/opencode/opencode.json`）

为所有映射到 DeepSeek 推理模型的别名添加 `"supportsReasoning": false`：

```jsonc
{
  "provider": {
    "new-api": {
      "models": {
        "premium-max": {
          // ... 原有配置 ...
          "supportsReasoning": false   // ← 新增
        },
        "premium-max-1": {
          // ... 原有配置 ...
          "supportsReasoning": false   // ← 新增
        },
        "premium-max-2": {
          // ... 原有配置 ...
          "supportsReasoning": false   // ← 新增
        },
        "deepseek-v4-pro": {
          // ... 原有配置 ...
          "supportsReasoning": false   // ← 新增
        },
        "deepseek-v4-flash": {
          // ... 原有配置 ...
          "supportsReasoning": false   // ← 新增
        }
      }
    }
  }
}
```

> **注意**: `supportsReasoning` 只对 DeepSeek 模型别名生效。Qwen/Kimi/Doubao/GLM/MiniMax 等非 DeepSeek 模型不返回 `reasoning_content`，无需此配置。

### 修复 2：移除 Agent 级别的 reasoningEffort（`.opencode/oh-my-openagent.jsonc`）

```jsonc
// ❌ 修复前
"oracle": {
  "model": "new-api/premium-max",
  "reasoningEffort": "high",    // ← 删除此行
  "temperature": 0.2
}

"ultrabrain": {
  "model": "new-api/premium-max",
  "reasoningEffort": "high",    // ← 删除此行
  "temperature": 0.2
}

"unspecified-high": {
  "model": "new-api/premium",
  "reasoningEffort": "medium",   // ← 删除此行
  "temperature": 0.1
}

// ✅ 修复后
"oracle": {
  "model": "new-api/premium-max",
  // reasoningEffort 已移除
  "temperature": 0.2
}
```

### 修复 3：上调 ACP 压缩阈值（`.opencode/acp.jsonc`）

延迟触发压缩，减少 reasoning_content 丢失的概率：

```jsonc
// ❌ 修复前
"compress": {
  "minContextLimit": "70%",   // 窗口达 70% 即触发
  "maxContextLimit": "85%"    // 硬上限
}

// ✅ 修复后
"compress": {
  "minContextLimit": "85%",   // 窗口达 85% 才建议压缩
  "maxContextLimit": "95%"    // 窗口达 95% 硬压缩
}
```

### 修复 4：清理无效 ACP 配置键

移除非当前版本支持的配置字段，避免配置校验警告：

```jsonc
// ❌ 删除：v1.2.8 不支持 pruneNotificationType
"pruneNotificationType": "chat",
```

### 修复 5：增加 turn 保护窗口

防止过早修剪当前会话上下文：

```jsonc
// ❌ 修复前
"turnProtection": { "enabled": true, "turns": 8 }

// ✅ 修复后
"turnProtection": { "enabled": true, "turns": 15 }
```

### 修复 6：加速 Fallback 降级

减少等待超时模型的时间：

```jsonc
// ❌ 修复前
"runtime_fallback": {
  "timeout_seconds": 60
}

// ✅ 修复后（30s 即降级）
"runtime_fallback": {
  "timeout_seconds": 30
}
```

---

## 四、验证清单

修复完成后逐项检查：

- [ ] `grep -n "reasoningEffort" .opencode/oh-my-openagent.jsonc` → 零结果
- [ ] `grep -n "supportsReasoning" ~/.config/opencode/opencode.json` → 所有 DeepSeek 模型均设为 `false`
- [ ] `grep "pruneNotificationType" .opencode/acp.jsonc` → 零结果
- [ ] `acp.jsonc` 中 `compress.minContextLimit` ≥ `"85%"`
- [ ] `acp.jsonc` 中 `turnProtection.turns` ≥ 15
- [ ] `oh-my-openagent.jsonc` 中 `timeout_seconds` = 30

> **⚠️ 配置变更后必须重启 OpenCode 会话才能生效。**

---

## 五、配置速查

| 配置项 | 文件 | 必改 | 说明 |
|--------|------|------|------|
| `supportsReasoning: false` | `~/.config/opencode/opencode.json` | ✅ | 每个 DeepSeek 模型别名均需 |
| 移除 `reasoningEffort` | `.opencode/oh-my-openagent.jsonc` | ✅ | Oracle, Ultrabrain, unspecified-high |
| `compress.minContextLimit: "85%"` | `.opencode/acp.jsonc` | ✅ | 延迟触发 ACP 压缩 |
| `compress.maxContextLimit: "95%"` | `.opencode/acp.jsonc` | ✅ | 扩大压缩窗口 |
| 移除 `pruneNotificationType` | `.opencode/acp.jsonc` | ✅ | 清理无效键 |
| `turnProtection.turns: 15` | `.opencode/acp.jsonc` | ⬆️ | 增强会话保护 |
| `timeout_seconds: 30` | `.opencode/oh-my-openagent.jsonc` | ⬆️ | 加速降级 |

---

## 六、已知局限

1. **`supportsReasoning: false` 依赖 AI SDK 版本** — 如果 `@ai-sdk/openai-compatible` 版本不支持此字段，可能需要改用 `providerOptions` 或切换到非推理模型
2. **已压缩会话不可恢复** — 修复前已被 ACP 压缩的会话 block 中 reasoning_content 已永久丢失，需要重启会话
3. **非 DeepSeek 模型不受影响** — Qwen/Kimi/Doubao/GLM/MiniMax 等模型不返回 `reasoning_content`，无需 `supportsReasoning` 配置
4. **对模型能力的影响** — `supportsReasoning: false` 仅禁用显式推理链输出，不影响模型内部推理能力。对 coding/debugging 任务无明显影响

---

## 七、适用范围

本指南适用于以下场景：
- OpenCode + OMO (oh-my-opencode) 编排体系
- 使用 `@ai-sdk/openai-compatible` provider 接入 DeepSeek API
- 启用了 ACP (`opencode-acp`) 插件的项目
- 通过 New API 网关等代理使用 DeepSeek V4 Pro / V4 Flash / V4 Pro Max 等推理模型

**最后更新**: 2026-07-17
**适用版本**: OpenCode + OMO + ACP v1.2.8 + DeepSeek V4 系列
