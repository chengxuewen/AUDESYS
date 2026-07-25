# 工程项目组织设计

**日期**: 2026-07-24 | **来源**: `docs/superpowers/specs/2026-07-24-robotics-architecture-design.md` §18, §21

## 概述

AUDESYS 工程采用三级可组合模型：Device → Cell → Factory。每一层可独立开发、版本化、部署。

## 三级模型

| | Device Project | Cell Project | Factory Project |
|------|:---:|:---:|:---:|
| 范围 | 一种设备型号 | 一组协作设备 + Hub | 全厂 + Cloud |
| 示例 | AGV 差速底盘 | AGV+机械臂+传送带 | 整个车间 |

## 三层继承

Template (上游不可变) → Project (设备型号差异) → Deployment (每台设备独有参数: PID校准、序列号)

## fleet.toml

```toml
[project]
name = "factory-line-1"

[[agents]]
id = "agv-01"
type = "agv-diffdrive"
modules = ["runtime", "safety-zone", "recorder"]

[[hubs]]
id = "station-a"
modules = ["fleet-manager", "opcua-gateway"]

[cloud]
modules = ["dashboard", "data-lake"]
```

## Studio 上下文切换

上下文 Bar: `[Factory: line-1 ▼] > [Cell: loading ▼] > [Device: agv-01 ▼]`

Signal Browser、FBD 编辑器、Deploy 目标自动按上下文过滤。

## 锁定与扩展点

厂商可声明 `extensions` 和 `locked` 区域，客户只能修改扩展点内的内容。见 §22 工程锁定设计。

## 交叉引用
- Agent: `docs/modules/agent/agent-architecture-design.md`
- Hub: `docs/modules/hub/hub-architecture-design.md`
- 架构 spec: §18 工程项目组织, §21 三级工程模型
