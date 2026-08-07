# LD 编辑器差距分析（Gap Analysis）与弥补计划

> AUDESYS LD Editor — 与主流工业 PLC IDE 的差距分析与演进路线
>
> **生成日期**: 2026-08-07
> **对标对象**: 三菱 GX Works3 / CODESYS / OpenPLC Editor / 西门子 TIA Portal / cdilga/ladder-logic-editor
> **范围**: 功能 / UI / 操作逻辑 / Project 管理（工程树）

---

## 1. 概览

本文档系统性对比 AUDESYS LD 编辑器与四家主流工业 PLC IDE（三菱 GX Works3、CODESYS、OpenPLC Editor、西门子 TIA Portal）的 LD/LAD 梯形图编辑能力，识别差距、给出弥补计划，并划分实施优先级。

AUDESYS LD 编辑器当前是一个**单文件、拓扑化、纯编辑**的 IEC 61131-3 梯形图编辑器（React Flow + 引入 Rust 编译器到 HalProgram）。定位为商业编辑器的"编辑核心"子集 —— **项目结构、在线调试、文档导出三大块几乎空白**。

**对标结论先行**：在"编辑画布"这一层，AUDESYS 已接近甚至部分超越商业编辑器（拓扑插入点、▲▼ 分支标记、实时校验、迷你地图、Git 友好格式）；但在"工程化"三层 —— 在线监控、工程树/变量表、PLCopen 互操作 —— 差距达 90%+，是当前的核心短板。

---

## 2. 当前能力定位（基线）

### 2.1 已实现（编辑核心）

- **元素**：NO/NC/P/N 触点、Normal/Negated/Set/Reset 线圈、比较盒（EQ/GT/LT/GE/LE/NE）、FB 节点（TON/TOF/TP/CTU/CTD + 算术，17 种）、电源轨
- **拓扑编辑（D112）**：CODESYS 风格菱形插入点，仅菱形放置元素；位置由 rung.elementIds 结构推导（layoutRung/layoutGraph 纯函数）
- **分支**：打开/关闭并联分支、▲▼ 标记（T14b/c）、OR 逻辑
- **操作**：addContact/addCoil/addFb/addRung/deleteElement/reorderElement/connectWire/disconnectWire/changeContactType/changeCoilType/setRungTitle/setRungComment/setElementComment/deleteRung/moveRung/addPowerRail/renameVariable/openBranch/addBranchContact/closeBranch/deleteBranch/pasteElements/replaceElement/validate/compile （`ld-operation-handler.ts`）
- **编辑 UX**：内联重命名（双击）、Tab/Shift+Tab/Enter 字段导航、右键上下文菜单（Negate/Edge/Copy/Comment/CrossRef…）、复制/粘贴/剪切、拖拽替换（A4）、网格切换（Ctrl+G）、撤销/重做（Ctrl+Z/Y）
- **导航**：查找（Ctrl+F）、交叉引用（Ctrl+Shift+X）、迷你地图、缩放/适配
- **校验**：500ms 防抖实时校验，rung/节点级错误/警告 + 徽标
- **监控**：监控模式骨架（值徽标、活动线高亮 CSS），未接 Runtime
- **编译**：LdGraph → LD 文本 → napi-rs 桥 → Rust 编译器 → HalProgram

### 2.2 关键技术栈

- 前端: React Flow（@xyflow/react）+ Theia widget
- 状态: LdGModelState（全图快照 undo/redo）
- 后端: Rust 编译器经 napi-rs 桥接；浏览器端经 JSON-RPC 到后端 loadBridge
- 持久化: `.ld` JSON 文件（Git 友好）

---

## 3. 对标范围与方法

| 对标对象 | 类型 | 参考来源 |
|---------|------|---------|
| 三菱 GX Works3 | 商业（MELSEC） | GX Works3 操作手册 SH-081215ENG、iQ-R 特性页、Tips Vol.1-3 |
| CODESYS | 商业（软 PLC） | CODESYS 官方、`docs/reference/codesys.md`、ref-codesys 技能 |
| OpenPLC Editor | 开源（v3 Beremiz / v4 Electron） | `docs/reference/openplc.md`、GitHub Autonomy-Logic/openplc-editor |
| 西门子 TIA Portal | 商业（S7-1200/1500） | `docs/reference/siemens.md`、`ld-editor-ui-spec.md` |
| cdilga/ladder-logic-editor | 开源（ST↔LD） | `docs/reference/ladder-logic-editor.md` |

方法：逐厂商功能清单（元素/编辑 UX/分支/导航/在线/导出）→ 与 AUDESYS 逐项对照 → 识别跨厂商共识差距 → 制定弥补计划。

---

## 4. 四厂商共识差距总表

所有主流 PLC IDE 共有的能力中，AUDESYS 缺失的按影响排序：

| # | 差距 | 三菱 | CODESYS | OpenPLC | 西门子 | 当前状态 | 优先级 |
|---|------|:---:|:---:|:---:|:---:|---------|:---:|
| 1 | **在线实时监控**（真触点高亮/值徽标/活动线） | ✅ | ✅ | ✅ | ✅ | 🟡 仅骨骼，未接 Runtime IPC | **P0** |
| 2 | **变量强制 / Watch 窗口 / 断点** | ✅ | ✅ | 🟡 | ✅ | ❌ | **P0** |
| 3 | **多 POU 工程树 + 全局/局部变量表 + IEC 类型** | ✅ | ✅ | ✅ | ✅ | ❌ 单 .ld 文件 | **P0** |
| 4 | **PLCopen XML 导入导出**（互操作） | ❌ | ✅ | ✅ | ❌ | ❌ | **P0** |
| 5 | **指令集**：跳转/CALL/标签、MOVE、嵌套分支、TONR/CTUD、通用盒 | ✅ | ✅ | 🟡 | ✅ | ❌ | **P1** |
| 6 | **查找/替换 + 交叉引用跳转 + 书签 + 跳转网络** | ✅ | ✅ | 🟡 | ✅ | 🟡 有 Find/CrossRef，无 Replace/书签 | **P1** |
| 7 | **编辑 UX**：F 键快速放置、多选批量、快捷键自定义、内嵌 ST | ✅ | ✅ | 🟡 | ✅ | 🟡 部分 | **P1** |
| 8 | **文档/导出**：打印/PDF/CSV | ✅ | ✅ | ❌ | ✅ | ❌ | **P2** |

---

## 5. 分维度差距详解

### 5.1 在线监控 / 调试（差距最大，商业编辑器的"杀手锏"）

| 特性 | 三菱 | CODESYS | OpenPLC | 西门子 | 当前 | 说明 |
|------|:---:|:---:|:---:|:---:|:---:|------|
| 实时值高亮（真触点变蓝/绿） | ✅ | ✅ | ✅ | ✅ | 🟡 | 监控骨架有，未接 Runtime 真实值 |
| 变量强制值 | ✅ | ✅ | 🟡 | ✅ | ❌ | 通过 Runtime IPC 写信号 |
| Watch 窗口 | ✅ | ✅ | ❌ | ✅ | ❌ | 注册变量到独立观测窗 |
| 断点 / 单步 | ✅ | ✅ | ❌ | ✅ | ❌ | Studio 有 DAP 适配器，LD 未接 |
| 在线改（运行中下载） | ✅ | ✅ | 🟡 | ✅ | ❌ | Runtime 有 hot-swap，编辑器未接 |
| 采样追踪 / 波形 | ✅ | ✅ | ❌ | ✅ | ❌ | 有 Scope View widget，未接 LD |
| 仿真联动 | ✅ Simulator3 | ✅ | ❌ | ✅ PLCSIM | 🟡 | SimulationHarness 存在，未集成编辑器 |

**接入路径**：复用已有的 Runtime IPC / SignalBridge（`crates/audesys-runtime-client`）、监控骨架（`monitoring` 状态 + `monitorValues` + `ld-edge--active`/`ld-value-badge` CSS）。这是"看起来像工业编辑器"的分水岭。

### 5.2 项目结构 / 工程树（Project Management）

| 特性 | 三菱 | CODESYS | OpenPLC | 西门子 | 当前 |
|------|:---:|:---:|:---:|:---:|:---:|
| 多 POU 工程树（Programs/FBs/Functions） | ✅ | ✅ | ✅ | ✅ OB/FB/FC | ❌ 单 .ld 文件 |
| 全局/局部变量声明表 | ✅ | ✅ | ✅ | ✅ 标签表 | ❌ 变量内联在元素上 |
| IEC 数据类型声明 | ✅ | ✅ | ✅ | ✅ | ❌ 无类型 |
| I/O 设备映射（%I/%Q/%M/%D） | ✅ | ✅ | ✅ | ✅ 硬件组态 | ❌ 仅标签名 |
| 硬件配置图 | ✅ | ✅ | ❌ | ✅ | ❌（模拟聚焦，范围不同） |
| 工程树 ↔ 编辑器双向定位 | ✅ | ✅ | ✅ | ✅ | ❌ |

**这是我们最需要补的"工程化"短板** —— 单文件模型无法支撑真实 PLC 项目。

### 5.3 导航 / 查找

| 特性 | 三菱 | CODESYS | OpenPLC | 西门子 | 当前 |
|------|:---:|:---:|:---:|:---:|:---:|
| 查找/替换（变量/指令） | ✅ | ✅ | 🟡 | ✅ | 🟡 有 Find，无 Replace |
| 交叉引用 + 跳转定义 | ✅ | ✅ | 🟡 | ✅ | 🟡 有 CrossRef，无跳转 |
| 书签 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 跳转到网络号 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 注释显示切换（多语言） | ✅ 16 语言 | ✅ | ❌ | ✅ | ❌ |

### 5.4 编辑 UX

| 特性 | 三菱 | CODESYS | OpenPLC | 西门子 | 当前 |
|------|:---:|:---:|:---:|:---:|:---:|
| 多选 + 批量删除/移动 | ✅ | ✅ | 🟡 | ✅ | ❌（A5 已规划） |
| 快捷键自定义 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 连续复制粘贴（设备号递增） | ✅ | ✅ | ❌ | ✅ | ❌ |
| 内嵌 ST 表达式框（Ctrl+B） | ✅ | ✅ | ❌ | ✅ | ❌ |
| F 键快速放置（F3=F 触点, F8=盒） | ❌ | ✅ | ❌ | ✅ | ❌ |
| 快速触点类型切换（/ 键） | ✅ | ✅ | ❌ | ✅ | ❌ |
| 拖变量 → 自动生成 NO 触点 | ✅ | ✅ | ❌ | ✅ | ❌ |
| F1 指令帮助 | ✅ | ✅ | ❌ | ✅ | ❌ |

### 5.5 指令集

| 特性 | 三菱 | CODESYS | OpenPLC | 西门子 | 当前 |
|------|:---:|:---:|:---:|:---:|:---:|
| 跳转 / CALL / 标签 | ✅ | ✅ | ❌ | ✅ | ❌（A6 跳转标签已规划） |
| MOVE 数据传输 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 定时器 TON/TOF/TP | ✅ | ✅ | ✅ | ✅ | ✅（TON/TOF/TP） |
| 累加定时器 TONR | ✅ | ✅ | ❌ | ✅ | ❌ |
| 计数器 CTU/CTD | ✅ | ✅ | ✅ | ✅ | ✅ |
| 双向计数 CTUD | ✅ | ✅ | 🟡 | ✅ | ❌ |
| 比较/算术 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 数学 ABS/SQRT/INV | ✅ | ✅ | ✅ | ✅ | ❌ |
| EN/ENO | ✅ | ✅ | ✅ | ✅ | ✅ |
| 通用参数化盒（F8 后输入类型名） | ✅ | ✅ | ❌ | ✅ | ❌ |
| MCR 主控区 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 嵌套分支 | ✅ ≤3 层 | ✅ | ❌ | ✅ ≤3 层 | ❌ |

### 5.6 文档 / 导出 / 互操作

| 特性 | 三菱 | CODESYS | OpenPLC | 西门子 | 当前 |
|------|:---:|:---:|:---:|:---:|:---:|
| PLCopen XML 导入导出 | ❌ | ✅ | ✅ | ❌ | ❌ |
| 打印 / PDF | ✅ | ✅ | ❌ | ✅ | ❌ |
| 设备注释 CSV 导出 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 库导入（.lib） | ✅ | ✅ | ✅ | ✅ | ❌ |
| 版本管理 | ✅ 私有 | 🟡 | 🟡 | ✅ 私有 | ✅ Git（.ld=JSON） |

---

## 6. 我们已超越商业编辑器的地方（保持）

- **拓扑插入点模型（D112）** — CODESYS 风格，比三菱自由网格、OpenPLC 纯网格更少视觉杂乱
- **▲▼ 分支标记一键分支** — 比三菱箭头键画线、西门子 Open/Close Branch 指令更直观
- **实时校验**（500ms 防抖）— 编译期错误高亮，OpenPLC 仅编译时报
- **迷你地图** — 四厂商大多无
- **Git 友好格式**（.ld 为 JSON）— 优于三菱/西门子私有二进制
- **IEC 61131-3 标准 `%I/%Q` 寻址** — 优于三菱 X/Y 裸地址
- **Web 原生 + Playwright 可测** — 三菱/西门子是 Win32 私有 UI，无法自动化
- **图即数据**（拓扑结构存储）— 为未来 ST↔LD 双向转换打基础

---

## 7. 弥补计划

### 7.1 功能（Features）

| 优先级 | 项 | 复用基础 | 工作量 |
|:---:|-----|---------|:---:|
| **P0** | Runtime 实时监控接入（真触点高亮 + 值徽标 + 活动线） | 监控骨架、Runtime IPC/SignalBridge、`ld-edge--active` CSS | 中 |
| **P0** | PLCopen XML 导入导出（与 CODESYS/OpenPLC 互操作） | `.ld` 为 JSON，映射 XML 2.0 | 中 |
| **P0** | 变量/标签表 + IEC 类型（全局/局部） | variable-utils 已有 | 中 |
| **P1** | 指令扩充（jump/label、MOVE、嵌套分支、TONR/CTUD、通用盒） | IL 编译器已支持跳转，LD→IL 可映射 | 中 |
| **P1** | 查找/替换 + 书签 + 跳转网络 | Find/CrossRef 已有 | 小 |
| **P2** | 打印 / PDF / CSV 导出 | React Flow 可分帧渲染 | 小 |

### 7.2 UI

- **指令面板**（instruction palette，拖拽放置）— 替代纯工具栏，对齐 CODESYS/TIA 指令树
- **多元素选择 + 批量删除/移动**（A5 已规划）
- **属性面板增强** — 选中元素显示类型/变量/注释，可编辑
- 迷你地图、缩放、网格已有

### 7.3 操作逻辑

- **F 键快速放置**（F3=NO, F4=NC, F7=线圈, F8=盒）— TIA 风格
- **拖变量 → 自动生成 NO 触点**（TIA 特性）
- **快捷键自定义**（导入/导出配置）
- **内嵌 ST 表达式**（Ctrl+B）— 复杂逻辑直接写 ST
- **连续粘贴**（设备号递增）— 三菱特性

### 7.4 Project 管理（工程树）

- **多 POU 工程树**：Programs / FBs / Functions / GVL（全局变量列表），对齐 IEC 61131-3 组织结构
- **变量/标签表**：全局 + 局部，类型声明，IEC 数据类型
- **I/O 映射**：`%I/%Q/%M/%D` 设备分配表
- **工程树 ↔ 编辑器双向定位**：点树节点跳转网络，点元素反查所在 POU
- **版本管理**：Git（.ld 为 JSON，天然 diff 友好）— 已优于商业私有格式

---

## 8. 实施路线图（按最大影响排序）

| 阶段 | 内容 | 价值 |
|:---:|------|------|
| **1** | 接 Runtime 实时监控 | 分水岭 —"看起来像工业编辑器" |
| **2** | 多 POU 工程树 + 变量表 | 项目化的前提 |
| **3** | PLCopen XML 导入导出 | IEC 互操作，P0 合规 |
| **4** | 指令扩充（jump/label/MOVE/嵌套分支） | 表达力 |
| **5** | 查找/替换 + 书签 | 导航效率 |
| **6** | 编辑 UX 打磨（F 键、多选批量、快捷键自定义） | 生产效率 |

---

## 9. 已规划项对照（代码中已有 TODO）

以下在任务列表/记忆中已标记规划，与本文档差距项对应：

- **A5**: 多元素选择 + 批量删除（deleteElements）→ §7.2 / §5.4
- **A6**: 网络级操作 + 箭头标记新建网络 + 跳转标签 + Outcommented → §5.5 / §7.3
- **P1**: 查找/交叉引用 → §5.3（已部分完成）
- **P2**: 实时验证/跳转/监控模式 → §5.1（监控骨架已存在）

---

## 10. 参考

- `docs/reference/siemens.md` — 西门子 TIA Portal 产品分析
- `docs/reference/openplc.md` — OpenPLC 产品分析（v3 Beremiz / v4 Electron）
- `docs/reference/codesys.md` — CODESYS 产品分析
- `docs/reference/ld-editor-ui-spec.md` — LD 编辑器 UI 规范（CODESYS/TwinCAT/TIA/OpenPLC）
- `docs/reference/ladder-logic-editor.md` — cdilga/ladder-logic-editor 参考（ST↔LD 双向转换 + 仿真）
- `theia-extensions/audesys-ld-editor/` — 当前 LD 编辑器源码