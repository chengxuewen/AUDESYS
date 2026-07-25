# Agent 架构设计

**日期**: 2026-07-24 | **来源**: `docs/superpowers/specs/2026-07-24-robotics-architecture-design.md` §3, §32

## 概述

Agent 是车端管理代理（原 Supervisor），运行在每台设备上，管理 Runtime 生命周期、容器编排、Field 连接、MCAP 录制和 OTA 升级。

Agent / Runtime 分离是工业安全必需——Agent 采用非 RT 优先级，Runtime 采用 SCHED_FIFO 硬实时。任何 Agent 故障不影响 Runtime 的电机控制。

## supervision tree

```toml
# supervisor.toml — Agent 配置
[agent]
node_id = "AGV-01"

[[components]]
id = "runtime"
type = "process"
binary = "/opt/audesys/bin/audesys-runtime"
restart = { max_retries = 3, backoff_ms = [100, 500, 2000] }

[[components]]
id = "ros2-bridge"
type = "container"
image = "ghcr.io/audesys/ros2-bridge:humble"
restart = { max_retries = 3, backoff_ms = [1000, 2000] }
```

## 崩溃退避

第1次崩溃 → 100ms → 重启 → 又崩 → 第2次 → 500ms → 重启 → 又崩 → 第3次 → 2000ms → 重启 → 又崩 → max_retries 达上限 → Dead → 通知 Hub。

依赖方重启后，被依赖方不触发级联重启，等待自动重连。

## 健康检查

- 进程：周期 RPC ping (500ms 超时)
- 容器：podman healthcheck run
- 远程：Zenoh queryable heartbeat

## 部署模式

| 模式 | Studio | Agent | Runtime | Panel | 用途 |
|------|:---:|:---:|:---:|:---:|------|
| A: 开发 | ✅ | ✅ | ✅ | ✅ | 工程师站 |
| B: 运行 | ❌ | ✅ | ✅ | ✅ | 操作站 |
| C: 瘦端 | ❌ | ❌ | ❌ | ✅ | 移动平板 |
| D: 调试 | ❌ | ✅ | ✅(Sim) | ✅ | 现场调试 |
| E: 部署 | ❌ | ✅ | ✅ | ❌ | 无头设备 |

## 平台适配

| 平台 | Agent 能力 |
|------|------|
| P1 PC-GUI | 完整 |
| P2 PC-HDL | 完整 |
| P3 SBC | 轻量 (无容器) |
| P4/P5 MCU | 无 Agent (被 PC 管理) |

## 参考

- 架构 spec: §3 audesys-supervisor, §32 部署形态, §31 平台适配
- 决策: D81 命名为 Agent

## 交叉引用
- Hub 平台: `docs/modules/hub/hub-architecture-design.md` — Agent 通过 Zenoh 连接 Hub(Field角色)
- 工程项目: `docs/modules/studio/project-organization-design.md` — fleet.toml 中 agents 配置
- 架构 spec: §3 Agent 架构, §32 部署模式, §48 M1.0 实施
