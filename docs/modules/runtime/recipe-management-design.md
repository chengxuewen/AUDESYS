# 配方管理设计

**日期**: 2026-07-24 | **来源**: `docs/superpowers/specs/2026-07-24-robotics-architecture-design.md` §25

## 概述

配方是参数集，映射到 HAL 信号。TOML 格式，版本化，审批流管理。

## 配方结构

```toml
[recipe]
name = "standard-batch"
version = "2.1"
status = "approved"       # draft → review → approved → active → archived

[params]
mixer.speed = 1200
heater.setpoint = 185.0

[signals]                 # 参数 → HAL 信号映射
"mixer.speed" = "mixer.velocity_setpoint"

[validation]              # 参数范围校验
"mixer.speed" = { min = 500, max = 3000 }
```

## FBD 集成

标准 `RecipeLoad` FB：选配方名 → trigger → 参数写入 HAL 信号。支持 busy/done/error 状态。

## Studio Recipe Manager

树形视图 + 版本对比 + 审批状态。已激活配方不可直接编辑，必须创建新版本。所有变更记录审计日志。

## 生命周期

draft → review → approved → active → archived

M1 打印机场景：standard-print.toml（标准打印）、fine-detail.toml（精细打印）、fast-print.toml（快速打印）。
