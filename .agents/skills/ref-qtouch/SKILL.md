# ref-qtouch — QiTech Control / QTouch 平台参考

## Metadata

- **name**: ref-qtouch
- **description**: QiTech Control / QTouch 跨平台组态 SCADA 平台参考，用于 AUDESYS Studio IDE 和 Runtime 设计
- **source**: `docs/reference/qtouch.md`（849 行竞品分析）
- **mode**: 技术参考（Technical Reference）
- **depth**: 研究级（Study Depth）

## 概述

QTouch（武汉舜通智能）和 Proficy HMI/SCADA iFIX（GE → Velotic）是工业监控领域的两个代表性产品。QTouch 代表国产化跨平台路线，iFIX 代表传统北美 SCADA 技术路线。两份参考共同覆盖了 SCADA/HMI 平台的完整设计空间。

本技能从两份参考文档中提取核心框架，用于 AUDESYS Studio IDE、Runtime、HAL 的设计决策。

## 7 节结构

| 章节 | 主题 | 内容概要 |
|------|------|---------|
| ch01 | 产品画像 | 产品定位、目标用户、许可模型 |
| ch02 | 技术特性 | 架构、运行时、通信、安全、平台 |
| ch03 | 功能概览 | 可视化、SCADA、报警、历史数据、报表、Web |
| ch04 | 现状与生态 | 版本、用户基数、合作伙伴、发展趋势 |
| ch05 | 市场定位 | 行业覆盖、竞争格局、市场地位 |
| ch06 | 产品特色 | 高性能 HMI、开放架构、分布式、可靠性 |
| ch07 | 对 AUDESYS 参考价值 | IDE 设计、HAL 抽象、报警模型、所有权变迁 |

## 核心框架

### 框架 1：NixOS 部署模型（从 QiTech 验证）

QiTech Control 在生产环境中使用 NixOS 作为部署平台（10+ 台），验证了 NixOS 在工业场景中的可行性：

- **声明式配置**：系统配置可复现，版本控制友好
- **原子升级**：回滚能力对工业现场至关重要
- **不可变基础设施**：减少配置漂移
- **AUDESYS 参考**：D29 决策 — Phase 1 用 Docker + PREEMPT_RT，Phase 2 评估 NixOS

### 框架 2：Electron → Tauri 迁移（从 QiTech 趋势）

QiTech 从 Electron 向 Tauri 迁移的趋势验证了 AUDESYS D21 的技术选型：

- **包体积对比**：Tauri ~5-10MB vs Electron ~120MB
- **内存占用**：Tauri ~50MB vs Electron ~150MB
- **Rust 后端一致性**：Tauri 与 HAL 开发语言一致
- **跨平台覆盖**：均支持 macOS/Windows/Linux

### 框架 3：Qt 工业 UI 模式（从 QTouch 技术栈）

QTouch 基于 Qt 的跨平台组态软件验证了 Qt 在工业 SCADA 中的应用：

- **Qt Quick / QML**：声明式 UI 适合 HMI 画面绘制
- **信号-槽机制**：天然适配工业数据变化通知
- **跨平台渲染**：一次开发，多平台适配
- **国产化支持**：龙芯/飞腾/兆芯/鲲鹏/申威

## 使用方式

加载技能：
```
skill(name="ref-qtouch")
```

查阅特定章节：
- `skill(name="ref-qtouch", user_message="ch01")` — 产品画像
- `skill(name="ref-qtouch", user_message="ch07")` — AUDESYS 参考价值
- `skill(name="ref-qtouch", user_message="glossary")` — 术语表
- `skill(name="ref-qtouch", user_message="patterns")` — 设计模式
- `skill(name="ref-qtouch", user_message="cheatsheet")` — 速查表

## 相关决策

- D21: Studio IDE 技术栈 = Tauri + React + TypeScript
- D24: 配置格式 = 开发 YAML + 运行时 FlatBuffers
- D25: 编程模式 = ST Only + HMI 可视化设计器
- D29: 部署策略 = Docker + PREEMPT_RT，Phase 2 评估 NixOS

## 相关文档

- `docs/reference/qtouch.md` — 完整参考文档（849 行）
- `docs/reference/trust-platform.md` — 中控技术 ECS-700 参考
- `docs/reference/codesys.md` — CODESYS IDE 参考
- `.agents/memorys/decisions.md` — D21-D41 架构决策