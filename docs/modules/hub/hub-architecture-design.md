# Hub 平台架构设计

**日期**: 2026-07-24 | **来源**: `docs/superpowers/specs/2026-07-24-robotics-architecture-design.md` §38-§41
**基座**: AUDEBase (微内核+插件热插拔平台)

## 概述

Hub 是 AUDESYS 的统一管理中台，基于 AUDEBase 平台构建。通过插件化架构支持 Field（场端）、Cloud（云端）、Standalone（单机）三种部署角色。

AUDEBase 提供微内核 + 插件热插拔 + Schema 低代码 + ACL + Dashboard 基础能力。Hub 插件实现 AUDESYS 特有的 fleet-manager、opcua-gateway、edge-connector 等功能。

## 三种角色

| | Field 角色 | Cloud 角色 | Standalone |
|------|:---:|:---:|:---:|
| 部署位置 | 工厂现场 | 云端 | 单机 |
| 核心插件 | fleet-manager(local), opcua-gateway | fleet-manager(global), data-lake, analytics | 两者合并 |
| 层级 | 向上聚合到 Cloud Hub | 向下聚合 Field Hub | 无层级 |

## Hub 插件清单

- **fleet-manager**: 多机调度、交通管制、充电调度 (FBD 可编程)
- **dashboard**: 实时监控、趋势图、告警面板
- **schema-engine**: 低代码数据模型 (质检记录、设备台账)
- **opcua-gateway**: OPC 40501 AGV 标准信息模型
- **edge-connector**: Agent ↔ Hub Zenoh 通信枢纽
- **alerts**: ISA-18.2 告警引擎
- **studio-web**: Web IDE
- **user-management**: 用户与权限管理
- **ota-publisher** (Cloud角色): 滚动升级 (Monaco + WASM 编译器)
- **data-lake**: 长期时序存储 (Cloud 角色)
- **analytics**: 全局分析 (Cloud 角色)
- **ota-publisher**: 滚动升级管理 (Cloud 角色)

## 与 AUDEBase 的关系

- Hub = AUDEBase + AUDESYS 插件集
- AUDEBase 处理: 插件生命周期、认证授权、数据建模、UI 框架
- Hub 插件处理: 工业调度、OPC UA 网关、Agent 通信、实时监控

## 层级聚合

Global Hub(Cloud) → edge-connector → Regional Hub(Field) → Agent → Runtime。深度不限。

## 参考

- 架构 spec: §38 Studio 对 Hub 的二开能力, §39 跨仓库编排, §41 统一平台
- 决策: D81 命名 Hub
- AUDEBase: 相邻仓库 `AUDEBase/`

## 交叉引用
- Agent: `docs/modules/agent/agent-architecture-design.md` — Hub 通过 Zenoh 管理 Agent
- Studio: `docs/modules/studio/project-organization-design.md` — fleet.toml 中 hubs 配置
- 架构 spec: §41 Hub 统一平台, §38 Studio 对 Hub 的二开能力
