# Theia 工业 IDE 生态分析 + Neuron Automation 对比

> 数据来源：Eclipse Theia 官网、GitHub、AUDESYS 架构文档、Neuron Automation 官网（2026-06-30 产品发布）、行业媒体报道
> ⚠️ 关键修正：Neuron Smart Engineer 使用 **VS Code 扩展架构**，并非 Eclipse Theia。AUDESYS D71 可能引用错误来源。

## 1. Theia 工业 IDE 生态

### 1.1 确认使用 Theia 的工业项目

| 项目/公司 | 领域 | Theia 版本 | 状态 |
|----------|------|-----------|:----:|
| **AUDESYS Studio** | 工业控制 IDE (IEC 61131-3) | 1.73.0 | 开源 (Apache 2.0) |
| **STM32CubeMX2** | 嵌入式 MCU 配置 | 1.x | 商业 |
| **TI Code Composer Studio** | 嵌入式 DSP/MCU | 1.x | 商业 |
| **Arm Keil MDK** | 嵌入式 MCU 开发 | 1.x | 商业 |
| **CDT Cloud Blueprint** | C/C++ 嵌入式 | 1.x | 开源 |
| **MVTec HDevelopEVO** | 机器视觉 IDE | 1.x | 商业 |
| **Logi.cals** | IEC 61131-3 编程 | 1.x | 商业 |
| **Ericsson Code RealTime** | 实时系统 | 1.x | 商业 |
| **Renesas QuickConnect** | 嵌入式 MCU | 1.x | 商业 |

### 1.2 Theia 在工业控制中的架构模式

```
Theia Frontend (Browser/Electron)
  ├─ Monaco Editor (ST/IL/G-code)
  ├─ GLSP Diagram Widget (LD/FBD)
  │   ├─ Sprotty (SVG 渲染)
  │   └─ ContainerModule (DI 绑定)
  └─ Custom Widgets
         ↕ JSON-RPC / WebSocket
Theia Backend (Node.js)
  ├─ GLSP Server 子进程
  └─ napi-rs Bridge → Rust 编译器
```

**AUDESYS 实施教训**：
1. `@eclipse-glsp/sprotty` vs `sprotty` 导入导致 DI Symbol 不匹配
2. GLSP ActionHandler 必须显式注册（StatusAction, SetDirtyStateAction）
3. 扩展 node_modules 删除原则（D97）
4. 浏览器模式需 patching（fix-tokens.py）

## 2. Neuron Automation — Smart Engineer

### 2.1 公司概述

| 维度 | 内容 |
|------|------|
| **公司** | Neuron Automation GmbH（奥地利 St. Pölten） |
| **成立** | 2019（logi.cals + ISH 合并，30+ 年行业经验） |
| **员工** | 61 人 |
| **产品** | Power Engineer（桌面）+ Smart Engineer（Web，2026-06-30 发布） |
| **核心业务** | 功能安全认证工具包（SIL 3 / PL e / ASIL C） |
| **官网** | https://www.neuron-automation.eu |

### 2.2 Smart Engineer 产品画像

| 维度 | 内容 |
|------|------|
| **定位** | 下一代 Web 工程环境，IEC 61131-3 IDE |
| **前端架构** | **VS Code 扩展架构**（非 Eclipse Theia） |
| **安全认证** | T3 认证，SIL 3 (IEC 61508) / PL e (ISO 13849) / ASIL C (ISO 26262) |
| **发布时间** | 2026-06-30 |
| **部署** | Desktop / Server / Cloud |

> ⚠️ AUDESYS D71 记录 "Neuron Automation 已验证 Theia+GLSP 可用于 IEC 61131-3 工业编程"。**但实际 Smart Engineer 使用 VS Code 扩展架构 + 专有 FBD 编辑器**（非 Theia + GLSP）。D71 可能引用的是 Neuron 的早期原型或其他产品线。

### 2.3 技术特性

| 特性 | 说明 |
|------|------|
| **IEC 61131-3 语言** | ST, FBD, LD, SFC 全支持 |
| **图形编辑器** | Smart-FBD（专有简化 FBD）+ LD 编辑器 |
| **AI Transforma** | ST 代码生成、FBD 图生成、测试用例创建、错误分析 |
| **Web 前端** | VS Code 扩展架构，浏览器直接访问 |
| **多语言** | Python, C/C++ 通过 VS Code 扩展 |
| **DevOps** | 纯文本工程文件（Git 友好）、CLI、headless 构建 |
| **仿真器** | 内置 PLC 仿真器（无需硬件测试） |
| **OEM 白标** | 自定义品牌、RBAC、可定制 UI |
| **离线 AI** | LLM 可在隔离生产环境运行（无云连接） |

### 2.4 运行时系统

- **RTS Max**：全功能 C++ 软 PLC
- **RTS Micro**：小型嵌入式运行时
- **RTS Nano**：超轻量运行时

### 2.5 与 AUDESYS 的对比

| 维度 | Neuron Smart Engineer | AUDESYS Studio |
|------|:---:|:---:|
| **IDE 框架** | VS Code 扩展架构 | Eclipse Theia 1.73.0 |
| **图形编辑器** | 专有 FBD + LD | GLSP（LD/FBD 迁移中） |
| **编译器** | C++ TÜV 认证 | Rust 自研 6 种编译器 |
| **安全认证** | ✅ SIL 3 T3 | 未认证 |
| **AI 辅助** | ✅ Transforma | 无 |
| **Web IDE** | ✅ 原生 | ✅ 原生 |
| **开源** | ❌ 商业 | ✅ Apache 2.0 |
| **价格** | 商业许可 | 免费开源 |

> **文档版本**: v1.1
> **生成日期**: 2026-07-30
> **数据来源**: Eclipse Theia 官网、Neuron Automation 官网（产品数据表 PDF, 2026-06-30 发布）、Computer&Automation、Digital Engineering Magazin
