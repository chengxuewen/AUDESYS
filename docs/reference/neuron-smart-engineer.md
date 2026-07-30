# Neuron Automation Smart Engineer — IEC 61131-3 工程环境

> 活跃参考 — 2026-06-30 发布。数据来源：Neuron Automation 官网、产品数据表 PDF、Computer&Automation、Digital Engineering Magazin

## 1. 产品画像

| 维度 | Smart Engineer | Power Engineer（前身） |
|------|:------------:|:---------------------:|
| **全称** | Neuron Application Smart Engineer | Neuron Application Power Engineer |
| **定位** | 下一代 Web IEC 61131-3 工程环境 | 当前一代桌面工程工具 |
| **首发日期** | 2026-06-30 | 2019+ |
| **前端架构** | VS Code 扩展架构（Web 原生） | 桌面（C++） |
| **安全认证** | T3 认证，SIL 3 / PL e / ASIL C | TÜV 认证，SIL 3 |
| **开发商** | Neuron Automation GmbH | 同 |
| **编程语言** | ST, FBD, LD, SFC, C/C++, Python | 同 |
| **部署** | Desktop / Server / Cloud | Desktop only |
| **许可证** | 商业许可 | 商业许可 |
| **官网** | https://www.neuron-automation.eu |

### 公司背景

Neuron Automation GmbH 成立于 2019 年（由奥地利的 logi.cals GmbH 和 ISH Ingenieursozietät GmbH 合并而成），拥有 30+ 年 PLC 编程和功能安全领域经验。总部位于奥地利 St. Pölten，61 名员工，办事处遍布德国、匈牙利、泰国和美国佛罗里达。

## 2. 技术特性

### 2.1 架构

Smart Engineer 采用 **VS Code 扩展架构**（非 Eclipse Theia）：

```
┌────────────────────────────────────┐
│       Web Frontend (Browser)       │
│  VS Code Extension Architecture    │
│  ├─ FBD Editor (专有)              │
│  ├─ LD Editor (专有)              │
│  ├─ ST Editor (Monaco-based)      │
│  └─ SFC Editor                     │
├────────────────────────────────────┤
│       Backend (C++ 编译器链)       │
│  ├─ IEC 61131-3 编译器（认证）     │
│  ├─ Transforma AI 引擎             │
│  └─ RTS 运行时（Max/Micro/Nano）   │
└────────────────────────────────────┘
```

### 2.2 与 AUDESYS Studio 的技术栈对比

| 组件 | Neuron Smart Engineer | AUDESYS Studio |
|------|----------------------|----------------|
| **IDE 框架** | VS Code 扩展架构 | Eclipse Theia 1.73.0 |
| **文本编辑器** | Monaco（推测） | Monaco Editor |
| **图形编辑器** | 专有 FBD + LD | GLSP（LD/FBD 迁移中） |
| **编译器后端** | C++（TÜV 认证） | Rust（6 种自研编译器） |
| **运行时** | RTS Max/Micro/Nano（C++） | Runtime Engine（Rust） |
| **DI 容器** | VS Code API（无 DI） | InversifyJS |
| **AI 辅助** | Transforma ✅ | 无 |
| **安全认证** | SIL 3 T3 ✅ | 无 |
| **扩展生态** | 3000+ VS Code 扩展 | Open VSX + Theia 扩展 |
| **Web 原生** | ✅ | ✅ |
| **Desktop** | ✅ | ✅ (Electron) |

## 3. 功能概览

### 3.1 编程语言支持

- **ST**（结构化文本）: ✅ IEC 61131-3 标准
- **FBD**（功能块图）: ✅ Smart-FBD（简化安全编程）+ 标准 FBD
- **LD**（梯形图）: ✅ IEC 61131-3 标准
- **SFC**（顺序功能图）: ✅ IEC 61131-3 标准
- **C/C++**：✅ 用于 POU 实现和旧代码集成
- **Python**：✅ 通过 VS Code 扩展

### 3.2 AI Transforma

Smart Engineer 的核心差异化特性：

| 功能 | 说明 |
|------|------|
| **需求→ST 代码** | 从结构化安全需求自动生成 ST 代码 |
| **ST↔FBD 转换** | ST 代码和 FBD 图形双向转换 |
| **测试用例生成** | 自动生成测试用例 |
| **错误分析** | AI 辅助的错误诊断和分析 |
| **离线运行** | 支持无云连接的隔离生产环境（本地 LLM） |

### 3.3 工程工具

- **集成 PLC 仿真器**：无需硬件即可测试
- **现场总线配置器**：集成配置工具
- **安全参数编辑器**：专用于功能安全参数
- **DevOps 就绪**：纯文本工程文件（Git 友好）、CLI 接口、headless 构建
- **单元测试框架**：集成测试支持

### 3.4 OEM 定制

- 自定义品牌（White-label）
- 基于角色的访问控制（RBAC）
- 可定制的用户界面
- 多用户支持

## 4. 现状与生态

### 4.1 市场地位

Neuron Automation 在**功能安全 PLC 编程工具**领域处于领先地位：
- T3 认证是安全工具的最高级别
- 30+ 年行业积累
- 从 Power Engineer（桌面）到 Smart Engineer（Web）的世代升级

### 4.2 产品线

| 产品 | 定位 | 状态 |
|------|------|:----:|
| **Smart Engineer** | 下一代 Web IDE | 2026-06-30 发布 |
| **Power Engineer** | 当前桌面 IDE | 维护中 |
| **RTS Max** | 全功能运行时 | 稳定 |
| **RTS Micro** | 小型嵌入式 | 稳定 |
| **RTS Nano** | 超轻量运行时 | 稳定 |

## 5. 市场定位

### 5.1 目标市场

- 机器制造商（OEM）
- 系统集成商
- 自动化组件制造商
- 安全关键应用：运动控制、汽车、楼宇自动化、移动机械、机器人、传感器

### 5.2 竞争格局

| 竞品 | IDE 框架 | 安全认证 | AI 辅助 | 开源 |
|------|---------|:---:|:---:|:---:|
| **Neuron Smart Engineer** | VS Code 扩展 | SIL 3 ✅ | ✅ Transforma | ❌ |
| **CODESYS** | 自研 | SIL 2 | ❌ | ❌ |
| **Beckhoff TwinCAT** | VS Shell | SIL 3 | ❌ | ❌ |
| **AUDESYS Studio** | Theia | ❌ | ❌ | ✅ |
| **Beremiz** | 自研 | ❌ | ❌ | ✅ |
| **OpenPLC** | Web | ❌ | ❌ | ✅ |

### 5.3 Neuron 的优势

1. **功能安全认证**：SIL 3 T3 是最高级别认证，市场壁垒极高
2. **AI 辅助编程**：Transforma 是首个在 IEC 61131-3 IDE 中深度集成 AI 的产品
3. **Web 原生**：Smart Engineer 支持云端部署，符合工业 4.0 趋势
4. **VS Code 生态**：3000+ 扩展可直接使用，降低学习成本

## 6. 产品特色

### 6.1 功能安全深度集成

Neuron 的核心差异化：
- **T3 认证**：最高安全级别，覆盖编译器、运行时、工具链全过程
- **Safe + Non-Safe 混合开发**：同一工具中同时开发安全和非安全代码
- **安全参数编辑器**：专门的安全参数配置工具
- **认证编译器链**：从 Power Engineer 继承的 TÜV 认证编译器

### 6.2 AI 辅助工程

Transforma AI 的独特价值：
- **需求驱动开发**：从结构化安全需求自动生成 ST 代码
- **多模态转换**：ST↔FBD 图形双向转换
- **测试自动化**：AI 生成测试用例
- **离线能力**：无需云连接，满足工业安全要求

### 6.3 Web 原生 + 文本工程

- **Web 前端**：浏览器直接访问，零安装
- **文本工程文件**：JSON/YAML 格式，Git 友好
- **CLI 接口**：支持 CI/CD 自动化构建
- **Headless 模式**：服务器端构建，无需 GUI

## 7. 对 AUDESYS 参考价值

### 7.1 架构路线启示

| AUDESYS 决策 | Neuron 验证 | 建议 |
|-------------|-----------|------|
| **D71: Theia 迁移** | Neuron 选择了 VS Code 扩展而非 Theia | 验证 Theia 路线有其独特价值（深度定制），但 VS Code 路线更成熟 |
| **GLSP 图形编辑器** | Neuron 使用专有 FBD 编辑器而非 GLSP | GLSP 提供标准化框架但定制成本高 |
| **Rust 编译器** | Neuron 使用 C++ TÜV 认证编译器 | Rust 编译器没有认证优势，但有安全优势 |
| **开源策略** | Neuron 全商业产品 | 开源可以作为差异化（尤其在需要自定义的场景） |

### 7.2 功能对标建议

| Neuron 功能 | AUDESYS 对标 | 优先级 |
|------------|-------------|:----:|
| **Transforma AI** | 可规划 AI 辅助编程（ST 代码生成） | 远期 |
| **SIL 3 认证** | 非当前目标（先在非安全市场验证） | 远期 |
| **集成仿真器** | SimulationHarness ✅ 已实现 | — |
| **纯文本工程文件** | YAML 工程格式 ✅ 已规划 | P1 |
| **CLI 接口** | 可规划 headless 构建 | P2 |
| **现场总线配置器** | Modbus/HART 适配器 ✅ 已实现 | — |
| **OEM 白标** | 开源 Apache 2.0 允许商业使用 | ✅ |

### 7.3 关键教训

1. **AI 是工业编程的未来**：Neuron 的 Transforma 证明 IEC 61131-3 编程可以被 AI 辅助，AUDESYS 应规划 AI 能力
2. **安全认证是市场壁垒**：功能安全认证需要数年积累，AUDESYS 应在合适的时机启动认证流程
3. **VS Code 扩展生态不可忽视**：即使使用 Theia 框架，也应保留 VS Code 扩展兼容性
4. **文本工程文件 > 二进制**：Neuron 的纯文本工程文件策略验证了 D69（YAML 版本管理）的正确性
5. **2026-06-30 发布证明**：Smart Engineer 刚发布不到 2 个月（此文档生成于 2026-07-30），是市场上最新的 IEC 61131-3 Web IDE

### 7.4 竞品优势与 AUDESYS 定位

| 维度 | Neuron 优势 | AUDESYS 差异化 |
|------|-----------|--------------|
| **安全** | ✅ SIL 3 T3 | → 非安全市场先验证 |
| **AI** | ✅ Transforma | → 开源 AI 辅助框架 |
| **生态** | VS Code 3000+ 扩展 | → Open VSX + Theia 混合生态 |
| **许可** | ❌ 商业付费 | ✅ Apache 2.0 免费开源 |
| **运行时** | C++ RTS | → Rust Runtime（安全+性能） |
| **可定制性** | 🟡 VS Code 限制 | ✅ Theia 深度定制 |

> **文档版本**: v1.0
> **生成日期**: 2026-07-30
> **数据来源**: Neuron Automation 官网 (neuron-automation.eu), Smart Engineer 产品数据表 PDF (2026-06-30), Computer&Automation, Digital Engineering Magazin, AUDESYS 架构文档
