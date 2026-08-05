# LD 编辑器 UI 布局 + 操作流程规格（CODESYS / TwinCAT / TIA Portal）

> 来源：CODESYS Ladder 官方文档、TwinCAT 3 Infosys、TIA Portal V21 文档、AutomationDirect、contactandcoil.com 教程
> 日期：2026-08-05
> 用途：为 AUDESYS LD 编辑器 React Flow 拓扑化重构提供可执行交互规格

---

## 1. 整体 UI 布局

### 1.1 CODESYS Ladder（现代 LD2 编辑器）

```
┌─────────────────────────────────────────────────────────────┐
│ 菜单栏: File  Edit  View  Project  Build  Debug  Online     │
│ 工具栏: [编译] [在线] [断点] [搜索] [缩放]                    │
├──────────┬────────────────────────────────┬──────────────────┤
│          │                                │                  │
│ 声明区    │   实现区（Implementation）      │   ToolBox        │
│ (上半)   │   ┌───────────────────────┐   │   ┌────────────┐ │
│          │   │ Network 1  [标题]     │   │   │ Ladder     │ │
│ 变量声明  │   │           [注释]     │   │   │ Elements   │ │
│          │   │ ┃ ─┤ ├─┤ /├─( )─    │   │   │  Contact   │ │
│          │   │ ┃   分支...           │   │   │  Coil      │ │
│          │   ├───────────────────────┤   │   │  Block     │ │
│          │   │ Network 2  [标题]     │   │   │  Network   │ │
│          │   │ ┃ ─┤ ├─( )─          │   │   │  Branch    │ │
│          │   └───────────────────────┘   │   ├────────────┤ │
│          │                                │   │ Operators  │ │
│          │   右下角工具栏:                 │   │  AND/OR/...│ │
│          │   [选择][移动][放大镜][缩放列表] │   ├────────────┤ │
│          │                                │   │ FBs        │ │
│          │                                │   │  TON/CTU/..│ │
│          │                                │   └────────────┘ │
├──────────┴────────────────────────────────┴──────────────────┤
│ 消息窗口 / 错误列表                                           │
└─────────────────────────────────────────────────────────────┘
```

**关键特征：**
- ToolBox 默认在**右侧**（与 FBD/CFC/SFC 共享）
- 网络（rung）垂直排列为**列表**（非网格），每行一个网络
- 网络左侧有**编号区**（Network 1, 2, 3...），编号旁有矩形插入标记
- 编辑区右下角有**浮动工具栏**（选择/移动/放大镜/缩放）

### 1.2 TwinCAT 3 Ladder

```
┌─────────────────────────────────────────────────────────────┐
│ 菜单栏: TwinCAT  PLC  Build  Debug  Online  View  Tools     │
│ 工具栏: [编译] [在线] [运行] [停止]                           │
├──────────┬────────────────────────────────┬──────────────────┤
│ Solution │                                │                  │
│ Explorer │   编辑器窗口                    │   Toolbox        │
│          │   ┌───────────────────────┐   │   ┌────────────┐ │
│ (设备树)  │   │ Declaration Part (上) │   │   │ LD Elements│ │
│          │   ├───────────────────────┤   │   │  Contact   │ │
│          │   │ Implementation Part   │   │   │  Coil      │ │
│          │   │ ┌───────────────────┐ │   │   │  Box       │ │
│          │   │ │ Network 1         │ │   │   │  Network   │ │
│          │   │ │ ┃ ─┤ ├─( )─      │ │   │   ├────────────┤ │
│          │   │ ├───────────────────┤ │   │   │ Operators  │ │
│          │   │ │ Network 2         │ │   │   │ Functions  │ │
│          │   │ └───────────────────┘ │   │   │ FBs        │ │
│          │   └───────────────────────┘   │   └────────────┘ │
├──────────┴────────────────────────────────┤                  │
│ Output / Error List / Properties          │                  │
└───────────────────────────────────────────┴──────────────────┘
```

**关键特征：**
- 与 CODESYS 共享相同引擎（TwinCAT 基于 CODESYS 内核）
- Toolbox 默认在**右侧**
- 支持纯 LD 和 LD/FBD 混合两种编辑器
- 纯 LD 编辑器**无显式分支元素**——通过拖拽元素位置隐式创建分支

### 1.3 TIA Portal LAD

```
┌─────────────────────────────────────────────────────────────┐
│ 菜单栏: Project  Edit  View  Compile  Online  Options        │
│ 工具栏: [编译] [在线] [下载] [监控]                           │
├──────────┬──────────────────────────────────────────────────┤
│ 项目树    │   指令树                    编辑器区域             │
│          │   ┌──────────────┐   ┌───────────────────────┐  │
│ PLC      │   │ Bit Logic    │   │ Declaration (上半)    │  │
│ ├─Blocks │   │ ├─ -\|\|-    │   ├───────────────────────┤  │
│ │ ├─OB1  │   │ ├─ -\|/\|-  │   │ Network 1: [注释]     │  │
│ │ ├─FC1  │   │ ├─ -( )-    │   │ L ┃─\|\|─\|/\|─( )─R │  │
│ │ └─FB1  │   │ ├─ -(S)-    │   ├───────────────────────┤  │
│ ├─Tags   │   │ └─ -(R)-    │   │ Network 2: [注释]     │  │
│ └─Types  │   ├──────────────┤   │ L ┃─\|\|─( )─R       │  │
│          │   │ General      │   └───────────────────────┘  │
│          │   │ ├─Open Branch│                               │
│          │   │ ├─Close Branch│                              │
│          │   │ ├─Empty Box  │                               │
│          │   │ ├─Insert Net │                               │
│          │   │ └─Insert Input│                              │
│          │   ├──────────────┤                               │
│          │   │ Timer/Cnt    │                               │
│          │   │ Math/Move    │                               │
│          │   └──────────────┘                               │
└──────────┴──────────────────────────────────────────────────┘
```

**关键特征：**
- 指令树在**左侧**（Project 树下方或独立面板），不是右侧
- 编辑器区域包含**声明区（上）+ 网络区（下）**
- 每个网络有**注释行**（网络标题/注释合一）
- 左右**母线（Power Rail）**是可视边界
- **Compact/Wide** 间距设置影响元素间垂直距离

---

## 2. 网络行（Rung）视觉结构

### 2.1 CODESYS

```
┌───────────────────────────────────────────────────────────────┐
│ Network 1    ← 编号（左侧边距，可点击选中整个网络）              │
│ 标题行: "Motor Start Circuit"  ← 双击编辑                      │
│ 注释行: "Start motor when sensor active"  ← 双击编辑           │
│ 跳转标签: "LABEL_1"  ← 双击编辑（可选）                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┃━━━━┤ ├━━━━┤ /├━━━━━━━━( )━━━━━┤                          │ ↑
│  ↑    ↑      ↑                    ↑                           │ 元素区
│  左母线 NO触点 NC触点           线圈                           │ (可配置
│  (bus bar)                                                    │  高度)
│  ┃━━━━━━━━━━━┤ ├━━━━━━━━━━━━━━━━( )━━━━━┤                   │ ↓
│      ↑ 分支起点 (三角标记)              ↑ 分支终点              │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ [分隔线: 可在选项中隐藏]                                        │
└───────────────────────────────────────────────────────────────┘
```

**布局比例（近似）：**
- 标题行 + 注释行 + 跳转标签：约 20-30% 高度（可配置显示/隐藏）
- 元素区：约 60-70% 高度（随元素数量自动扩展）
- 分隔线：约 10% 高度（可隐藏）

**选项配置（Ladder editor 选项）：**
- `Show network title`：显示/隐藏标题行
- `Show network comment`：显示/隐藏注释行
- `Show separator`：网络间分隔线
- `Show addresses`：显示变量地址
- `Line breaks`：网络内换行

### 2.2 TwinCAT

与 CODESYS 基本相同（同一引擎），额外选项：
- `Show box icon`：在 Box 元素内显示图标
- `Show network title`：同 CODESYS

### 2.3 TIA Portal

```
┌───────────────────────────────────────────────────────────────┐
│ Network 1: "Motor Start Circuit"  ← 注释行（标题+注释合并）     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  L ┃━━━━┤ ├━━━━┤ /├━━━━━━━━( )━━━━━━━━━━R                   │
│  ↑                ↑                    ↑                      │
│  左母线         NO/NC触点             线圈→右母线              │
│  (Left Rail)                          (Right Rail)            │
│                                                               │
│  L ┃━━━━━━━━━┤ ├━━━━━━━━━━━━━━━━━━( )━━━R                   │
│         ↑ 分支开点（Open Branch）                              │
└───────────────────────────────────────────────────────────────┘
```

**关键差异：**
- TIA Portal 的注释区是**单行**（标题+注释合并），不是 CODESYS 的三行
- 显示**左右母线**（Left/Right Power Rail）作为视觉边界
- Compact/Wide 设置：控制元素间**垂直间距**（Wide 模式下更宽松）

---

## 3. 插入点标记视觉规格

### 3.1 CODESYS / TwinCAT（相同）

| 标记形状 | 颜色 | 位置 | 含义 |
|---------|------|------|------|
| **方形（Square）** | 灰色背景，hover→绿色 | 已有元素**内部** | **替换**：新元素替换该位置的元素 |
| **菱形（Rhombus/Diamond）** | 灰色，hover→绿色 | 连接线**上方** | **插入**：在该连接线位置插入新元素（水平插入） |
| **三角形-下（Triangle ▼）** | 灰色，hover→绿色 | 触点**上方** | **并联上方**：在该触点/元素上方开新分支 |
| **三角形-上（Triangle ▲）** | 灰色，hover→绿色 | 触点**下方** | **并联下方**：在该触点/元素下方开新分支 |
| **箭头（Arrow →）** | 灰色，hover→绿色 | 网络**编号区** | **新建网络**：在该位置上方插入新网络 |

**交互细节：**
- 默认颜色：**灰色**（位置标记在拖拽过程中显示）
- Hover 状态：**绿色**（鼠标悬停时高亮，表示"可以释放"）
- 鼠标指针变为 **+（加号）** 符号
- 选中区域（已放置元素）：**红色**高亮 + 红色轮廓

**拖拽行为：**
1. 从 ToolBox 拖出元素 → 所有可用插入点同时显示（灰色标记）
2. 鼠标移动到某标记上方 → 该标记变绿 + 鼠标变 +
3. 释放鼠标 → 元素插入该位置

### 3.2 TIA Portal

TIA Portal **不使用**灰色菱形/三角形插入标记系统。

**替代机制：**
- 选中指令后**点击**网络中的目标位置（非拖拽）
- 或从指令树**拖拽**到网络的空白处/已有元素上
- 分支通过 **Open Branch** / **Close Branch** 指令显式创建
- 无拓扑插入点标记——位置由目标元素类型决定

---

## 4. 放置操作流程

### 4.1 CODESYS / TwinCAT：拖拽放置

```
操作流程：
1. 在 ToolBox 中选择元素（如 Contact）
2. 按住鼠标左键拖出
3. 拖到网络上方 → 所有可用插入点显示为灰色标记
4. 移动鼠标到目标标记 → 标记变绿 + 鼠标变 +
5. 释放鼠标 → 元素插入

放置模式：
┌────────────────────────────────────────────────────────┐
│ a) 水平插入（菱形标记）                                 │
│    已有: ┃━┤A├━┤B├━( )━                               │
│    在A和B之间的菱形释放 → ┃━┤A├━┤NEW├━┤B├━( )━        │
│                                                        │
│ b) 替换（方形标记）                                     │
│    在B的方形标记释放 → ┃━┤A├━┤NEW├━( )━                │
│                                                        │
│ c) 并联上方（上三角标记）                               │
│    在A的上三角释放 → 创建A上方的新并联分支               │
│                                                        │
│ d) 并联下方（下三角标记）                               │
│    在A的下三角释放 → 创建A下方的新并联分支               │
│                                                        │
│ e) 新建网络（箭头标记）                                 │
│    拖到编号区的箭头标记 → 在该位置上方插入新空网络        │
└────────────────────────────────────────────────────────┘
```

**注意：CODESYS Ladder（LD2）不支持菜单/键盘放置**——必须拖拽。
旧版 FBD/LD/IL 编辑器支持菜单命令（Insert Contact / Insert Coil / ...）。

### 4.2 TIA Portal：拖拽 + 快捷键

**方法 A：拖拽**
1. 展开指令树 → Bit Logic Operations
2. 拖拽 NO Contact 到网络中的目标位置
3. 释放 → 触点插入（位置由最近的连接线决定）

**方法 B：快捷键（关键差异）**
```
F3    → 在光标位置插入常开触点 (NO Contact)
F4    → 在光标位置插入常闭触点 (NC Contact)
F5    → 在光标位置插入水平线（连接线）
F6    → 在光标位置插入垂直线（分支线）
F7    → 插入线圈 (Coil)
F8    → 插入空盒 (Empty Box)——输入名称后自动匹配指令
Insert → 通用插入命令
```

**放置规则：**
- 所有网络**必须以线圈或 Box 结束**
- 触点只能在**左侧逻辑区**，线圈只能在**右侧输出区**
- 只有从母线直接引出的分支才允许放置线圈

### 4.3 操作流程对比

| 操作 | CODESYS LD2 | TwinCAT LD | TIA Portal LAD |
|------|-------------|------------|----------------|
| 放置触点 | 拖拽到菱形标记 | 拖拽到菱形标记 | F3/F4 或拖拽 |
| 放置线圈 | 拖拽到菱形标记 | 拖拽到菱形标记 | F7 或拖拽 |
| 放置 FB | 拖拽到菱形标记 | 拖拽到菱形标记 | F8 后输入名称 |
| 替换元素 | 拖拽到方形标记 | 拖拽到方形标记 | 拖拽覆盖 |
| 新建网络 | 拖拽 Network 到箭头标记 | 拖拽 Network 到箭头标记 | Insert 或菜单 |
| 放置分支 | 拖拽到三角标记 | 拖拽到三角标记 | Open Branch 指令 |

---

## 5. 分支创建流程

### 5.1 CODESYS Ladder（LD2）——拓扑拖拽模型

**创建开放分支（并联触点）：**
```
步骤：
1. 已有网络：┃━┤A├━┤B├━( )━
2. 从 ToolBox 拖出新触点 C
3. 拖到触点 A 的 ▼（下三角）标记位置
4. 释放 → 创建开放分支：

   ┃━┤A├━━━━━━━( )━
    ┃━┤C├━━━━━━━/

注：分支自动延伸到网络末尾（开放）
```

**关闭分支（创建 OR 构造）：**
```
步骤：
1. 已有开放分支：
   ┃━┤A├━━━━━━━( )━
    ┃━┤C├━━━━━━━/

2. 选中两条分支线（触点 A 和 C 后面的线段）
   - 多选：Ctrl+点击 或 拖选
   - 选中线段显示为红色小方块

3. 右键 → "Close Parallel Branch"

4. 结果（闭合分支，OR 构造）：
   ┃━┤A├━┓
    ┃━┤C├━╋━( )━
            ↑ 闭合点（单竖线 = OR）
```

**SCE 模式（Short Circuit Evaluation）：**
- 闭合分支默认为 OR 模式（单竖线）
- 右键竖线 → "Toggle Parallel Mode" → 切换为 SCE（双竖线）
- SCE 表示：如果旁路条件为 TRUE，则跳过 FB 调用

**重新打开闭合分支：**
```
方法 1：选中一个分支 → 拖拽选框到另一个分支
方法 2：选中任一分支 → 右键 → "Open Parallel Branch"
注意：多并联分支时，Open 会同时打开所有分支
```

### 5.2 TwinCAT LD——位置隐式分支

**与 CODESYS Ladder 相同**（同一引擎）。区别：
- TwinCAT 纯 LD 编辑器**无显式 Branch 元素**
- 分支完全通过**拖拽元素位置**隐式创建
- LD/FBD 混合编辑器支持显式 Branch 元素

**创建并联分支：**
```
1. 已有：┃━┤A├━( )━
2. 拖出触点 B → 拖到 A 的 ▼ 标记 → 释放
3. 自动创建：
   ┃━┤A├━━━( )━
    ┃━┤B├━━━/
```

**闭合分支（OR 构造）：**
```
1. 选中两条分支（触点后的线段）
2. 右键 → "Close parallel branch"
3. 结果：
   ┃━┤A├━┓
    ┃━┤B├━╋━( )━
```

**输出分支限制：**
- 线圈右侧可创建输出分支
- 输出分支**只能放置线圈或 FB**，不能放触点
- 在已有线圈/Box 顶部 hover → 出现放置指示器 → 点击 → 在下方创建新输出分支

### 5.3 TIA Portal——显式 Branch 指令

**创建并联分支（显式指令模型）：**
```
步骤：
1. 已有网络：L ┃━┤A├━┤B├━( )━R
2. 打开指令树 → General → Open Branch
3. 拖拽 "Open Branch" 到触点 A 之后的位置
4. 在新分支中放置触点 C 和 D
5. 拖拽 "Close Branch" 到触点 B 之后
6. 结果：
   L ┃━┤A├━┓━┤B├━( )━R
          ┃━┤C├━┤D├━┛
```

**分支规则：**
- 并联分支**向下开，向上合**
- 分支只能在已有 LAD 元素**之后**插入
- 分支可直接连接到母线（全并联）
- 只有从母线直接引出的分支才允许放置线圈
- 嵌套深度建议 ≤3 层（超出应改用 SCL）
- 删除分支：删除分支中所有元素 → 分支自动删除

**键盘操作：**
```
Ctrl + 1  → 插入 NO 触点
Ctrl + 2  → 插入 NC 触点
Ctrl + 3  → 插入线圈
Ctrl + 4  → 插入定时器
Ctrl + 5  → 插入计数器
Insert    → 通用插入
Delete    → 删除选中元素
```

---

## 6. 删除 / 移动 / 修改操作

### 6.1 CODESYS / TwinCAT

| 操作 | 方法 | 说明 |
|------|------|------|
| **删除单个元素** | 选中（红色高亮）→ Delete 键 | 或右键菜单 Delete |
| **删除分支** | 先删除分支内所有元素 → 再删除分支标记（小方块） | 不可直接删除非空分支 |
| **移动元素** | 选中（红色高亮）→ 拖拽到新插入点（方形标记） | 拖拽时显示可用目标位置 |
| **替换元素** | 拖拽新元素到已有元素上 → 已有元素变绿时释放 | 无缝替换，保持连接 |
| **重命名变量** | 双击元素上的 `???` 或变量名 → 输入新名称 | 支持 Input Assistant |
| **修改修饰符** | 选中引脚 → 右键 → Negate / Set/Reset / Edge Detection | 修饰符显示在元素符号旁 |
| **注释网络** | 选中整个网络 → 右键 → "Outcommented" | 网络变灰+斜体，不参与执行 |
| **编辑标题/注释** | 双击网络左上角的第 1/2/3 行 | 依次为标题、注释、跳转标签 |

### 6.2 TIA Portal

| 操作 | 方法 | 说明 |
|------|------|------|
| **删除单个元素** | 选中 → Delete 键 | 或 Edit → Delete |
| **删除分支** | 删除分支中所有元素 → 分支自动消失 | 无需显式删除分支容器 |
| **移动元素** | 拖拽到新位置 | TIA 自动重连线路 |
| **复制元素** | Ctrl+C → Ctrl+V | 支持跨网络复制 |
| **撤销** | Ctrl+Z | 支持多步撤销 |
| **注释** | Ctrl+/ | 注释/取消注释选中逻辑 |
| **编辑网络注释** | 点击网络注释行 → 直接输入 | 单行合并注释 |

---

## 7. 快捷键汇总

### 7.1 CODESYS Ladder

| 快捷键 | 功能 |
|--------|------|
| Delete | 删除选中元素 |
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| Ctrl+C/V/X | 复制/粘贴/剪切 |
| Tab | 跳转到下一个可编辑字段 |
| Shift+Tab | 跳转到上一个可编辑字段 |
| Enter | 打开选中字段的编辑框 |
| Ctrl+Home | 跳到文档开头（第一个网络） |
| Ctrl+End | 跳到文档末尾（最后一个网络） |
| 右键菜单 | 所有修改命令（Negate/Set/Reset/Edge/Branch） |

**注意：CODESYS Ladder（LD2）无 F3/F4/F5 等功能键快捷放置。**所有放置必须通过拖拽。

### 7.2 TwinCAT LD

与 CODESYS 相同（同一引擎）。额外：
| 快捷键 | 功能 |
|--------|------|
| `/` | 切换选中触点的 NO/NC（快速取反） |

### 7.3 TIA Portal LAD

| 快捷键 | 功能 |
|--------|------|
| F3 | 插入常开触点 (NO Contact) |
| F4 | 插入常闭触点 (NC Contact) |
| F5 | 插入水平线 |
| F6 | 插入垂直线 |
| F7 | 插入线圈 |
| F8 | 插入空盒 (Empty Box) |
| Insert | 通用插入命令 |
| Delete | 删除选中元素 |
| Ctrl+Z | 撤销 |
| Ctrl+C/V/X | 复制/粘贴/剪切 |
| Ctrl+F | 查找 |
| Ctrl+H | 替换 |
| Ctrl+B | 编译当前块 |
| Ctrl+Shift+B | 编译全部 |
| Ctrl+F8 | 在线更改（下载到 PLC） |
| Ctrl+1 | LAD: 插入 NO 触点（某些版本） |
| Ctrl+2 | LAD: 插入 NC 触点（某些版本） |
| Ctrl+3 | LAD: 插入线圈（某些版本） |

### 7.4 AutomationDirect（参考：标准 LD 快捷键模式）

| 快捷键 | 功能 |
|--------|------|
| Esc | 从工具模式返回选择模式 |
| F3 | 插入 NO 触点 |
| F4 | 插入 NC 触点 |
| Shift+F1 | 插入上升沿触点 |
| Shift+F2 | 插入下降沿触点 |
| F5 | 插入水平线 |
| F6 | 插入垂直线 |
| Shift+F3 | 插入 Set（锁存）线圈 |
| Shift+F4 | 插入 Reset（解锁）线圈 |
| Shift+F5 | 插入上升沿线圈 |
| Shift+F6 | 插入下降沿线圈 |

---

## 8. 关键设计差异总结

| 维度 | CODESYS Ladder | TwinCAT LD | TIA Portal LAD |
|------|---------------|------------|----------------|
| **放置模型** | 拖拽到插入点标记 | 拖拽到插入点标记 | 拖拽 + 快捷键 F3-F8 |
| **插入点标记** | 菱形/三角/方形/箭头 | 菱形/三角/方形/箭头 | 无（位置隐式决定） |
| **分支模型** | 拓扑拖拽（三角标记） | 拓扑拖拽（三角标记） | 显式 Open/Close Branch 指令 |
| **闭合分支** | 选中两线段 → Close | 选中两线段 → Close | 自动（Close Branch 指令） |
| **工具箱位置** | 右侧 | 右侧 | 左侧（指令树） |
| **网络注释** | 3 行（标题/注释/跳转标签） | 3 行（标题/注释/跳转标签） | 1 行（合并） |
| **母线** | 左母线可见 | 左母线可见 | 左右母线均可见 |
| **间距设置** | 通过选项配置 | 通过选项配置 | Compact/Wide 模式切换 |
| **替换** | 拖拽覆盖（绿色高亮） | 拖拽覆盖（绿色高亮） | 拖拽覆盖或删除+插入 |

---

## 9. 来源 URL

| 来源 | URL |
|------|-----|
| CODESYS Ladder Overview | https://content.helpme-codesys.com/en/CODESYS%20Ladder/_ld_overview.html |
| CODESYS Programming in LD Editor | https://content.helpme-codesys.com/en/CODESYS%20Ladder/_ld_programming_in_ld_editor.html |
| CODESYS Branch | https://content.helpme-codesys.com/en/CODESYS%20Ladder/_ld_branch.html |
| CODESYS Common Graphical Editors | https://content.helpme-codesys.com/en/CODESYS%20Development%20System/_cds_common_functionalities_in_grafic_editors.html |
| CODESYS Closed Branch | https://content.helpme-codesys.com/en/CODESYS%20LD%20FBD/_cds_ld_element_closed_branch.html |
| CODESYS Insert Network | https://content.helpme-codesys.com/en/CODESYS%20Ladder/_ld_cmd_insert_network.html |
| TwinCAT Ladder Editor | https://infosys.beckhoff.com/content/1033/tc3_plc_intro/14585737227.html |
| TwinCAT Programming in LD | https://infosys.beckhoff.com/content/1033/tc3_plc_intro/14585739915.html |
| TwinCAT Common Graphical Editors | https://infosys.beckhoff.com/content/1033/tc3_plc_intro/2528216459.html |
| TwinCAT LD Options | https://infosys.beckhoff.com/content/1033/tc3_userinterface/14585828235.html |
| TwinCAT LD Branch Limits | https://industrialmonitordirect.com/blogs/knowledgebase/configuring-twincat-3-ladder-editor-branch-limits-and-workarounds |
| TwinCAT Tutorial (contactandcoil) | https://www.contactandcoil.com/twincat-3-tutorial/ladder-logic-editor/ |
| TIA Portal Keyboard Shortcuts | https://docs.tia.siemens.cloud/r/en-us/v21/program-editor/using-the-keyboard-in-the-program-editor |
| TIA Portal LAD Rules | https://docs.tia.siemens.cloud/r/en-us/v21/creating-lad-programs/branches-in-lad/rules-for-branches-in-lad |
| TIA Portal Branch Insertion | https://docs.tia.siemens.cloud/r/en-us/v21/creating-lad-programs/branches-in-lad/inserting-branches-into-the-lad-network |
| TIA Portal LAD Settings | https://docs.tia.siemens.cloud/r/en-us/v21/creating-lad-programs/settings-for-lad/overview-of-the-settings-for-lad |
| TIA Portal Keyboard Guide | https://industrialmonitordirect.com/blogs/knowledgebase/siemens-tia-portal-keyboard-shortcuts-complete-reference |
| TIA Portal Basic Instructions | https://t-ia-connect.com/en/tia-portal-basic-instructions |
| AutomationDirect LD Shortcuts | https://cdn.automationdirect.com/static/helpfiles/ls_plc/Content/C_ProcedureTopics/LP307-1.htm |
| CODESYS Forge Branch Discussion | https://forge.codesys.com/forge/talk/Engineering/thread/3053f3e5fc/ |
