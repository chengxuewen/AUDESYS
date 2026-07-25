# 告警管理设计 (ISA-18.2)

**日期**: 2026-07-24 | **来源**: `docs/superpowers/specs/2026-07-24-robotics-architecture-design.md` §26

## 概述

遵循 ISA-18.2 工业告警管理标准。告警需要操作员响应（区别于事件）。

## 告警生命周期

正常 → 激活(未确认) → 确认(已确认) → 恢复正常 → 清除

## 告警类型

HI_HI / HI / LO / LO_LO / DEV 五种标准类型。

属性：signal, limit, deadband (防抖动), on_delay, off_delay, priority, message, consequence, corrective_action。

## 优先级与速率限制

| 优先级 | 速率 | 颜色 | 响应时间 |
|--------|:---:|:---:|:---:|
| CRITICAL | <5/min | 🔴 | <1min |
| HIGH | <10/min | 🟠 | <5min |
| MEDIUM | <20/min | 🟡 | <15min |
| LOW | <50/min | 🔵 | <60min |

ISA-18.2 要求操作员每小时不超过 150 条告警。

## 标准告警 FB

`Alarm_HI_HI`、`Alarm_HI`、`Alarm_LO`、`Alarm_LO_LO`、`Alarm_DEV` — 可直接拖入 FBD。

## 抑制与搁置

设备停机时自动抑制从属告警。操作员可临时搁置已知告警（自动恢复），记录审计日志。

## M1 打印机告警

温度过高(CRITICAL)、门打开(HIGH)、树脂不足(MEDIUM)、打印完成(LOW)。

## 告警面板

- 活动告警列表 + 详情面板 (实时)
- 告警洪水检测 (>10/min 自动告警)
- 告警归档到长期存储
- ISA-18.2 合规报告 (告警频率 TOP10、操作员响应时间、洪水检测)
