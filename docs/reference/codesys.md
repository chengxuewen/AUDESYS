# CODESYS

## 1. 产品画像

### 1.1 基本信息

- **全称**: CODESYS (Controller Development System)
- **开发商**: CODESYS Group (原 3S-Smart Software Solutions GmbH)
- **总部**: 德国肯普滕 (Kempten)
- **首次发布**: 1994 年
- **创始人**: Dieter Hess 和 Manfred Werner
- **公司性质**: 私营企业（非上市公司，不属于任何设备制造商）
- **员工规模**: 约 230 人（全球，含中国、意大利、美国办事处）
- **品牌更名**: 2020 年 6 月 19 日从 3S-Smart Software Solutions GmbH 更名为 CODESYS GmbH
- **当前版本**: CODESYS V3.5 SP21（2025 年发布）
- **官方网站**: https://www.codesys.com

### 1.2 产品定位与核心价值主张

CODESYS 的核心定位是**独立于硬件（hardware-independent）的 IEC 61131-3 工业控制开发平台**。其核心价值主张包括：

- **制造商无关性（Manufacturer Independence）**：一个 IDE 可编程来自 400+ 家 OEM 厂商的 PLC 控制器
- **软PLC（SoftPLC）理念**：将传统硬件 PLC 的控制功能以软件形式运行在通用计算平台上（Windows/Linux/嵌入式 RTOS）
- **全栈覆盖**：从 IEC 61131-3 编程、编译器、运行时到可视化、运动控制、安全、现场总线一体化
- **开放生态**：IDE 免费下载，运行时按设备授权，OEM 厂商可定制自己的品牌版本

CODESYS 不是 PLC 硬件制造商，而是向 OEM 提供软件栈的供应商。这一商业模式使其成为工业自动化领域的"软件中间件"——类似于 Android 在移动生态系统中的角色。

### 1.3 目标用户群体

| 用户类型 | 描述 | 典型用例 |
|---------|------|---------|
| OEM 设备制造商 | 生产 PLC、PAC、运动控制器的硬件厂商 | 将 CODESYS 运行时集成到自家硬件中，提供品牌化编程环境 |
| 机器制造商（Machine Builder） | 生产专用自动化设备的厂商 | 使用 CODESYS 开发机器控制程序，搭配 Wago、Beckhoff 等硬件 |
| 系统集成商（System Integrator） | 为客户提供自动化解决方案的工程公司 | 多品牌 PLC 编程、项目集成、调试 |
| 最终用户（End User） | 工厂运维工程师 | 维护已有 CODESYS 设备，开发小规模应用 |
| 教育/研究机构 | 大学、职业技术学院 | 教学培训、PLC 编程入门 |

### 1.4 商业许可模型

CODESYS 采用**分层许可（Tiered Licensing）** 模型：

| 组件 | 许可方式 | 价格范围 |
|------|---------|---------|
| CODESYS Development System (IDE) | **免费** | €0 |
| CODESYS Control Win SL (PC 软PLC) | 单设备许可 | ~€100-500 |
| CODESYS Control for Raspberry Pi SL | 单设备许可 | ~€50-200 |
| CODESYS Control Runtime Toolkit (OEM SDK) | OEM 年费 + 每设备版税 | 待确认 |
| CODESYS SoftMotion | 附加许可 | ~€500-2,000/设备 |
| CODESYS SoftMotion CNC+Robotics | 附加许可 | ~€1,000-3,000/设备 |
| CODESYS Safety SIL2/SIL3 | 附加许可 | ~€1,000-3,000/设备 |
| CODESYS OPC UA Server | 附加许可 | 待确认 |
| CODESYS Professional Developer Edition | 开发者订阅 | 待确认 |
| CODESYS Automation Server | 云订阅 | 按量计费 |

**关键特点**：
- IDE 免费降低了学习门槛和原型开发成本
- 运行时许可绑定到具体设备，而非开发者人数
- OEM 可通过 CODESYS Runtime Toolkit 定制运行时，许可费按出货量计算
- 从 CODESYS Store 可直接购买单设备许可（SL = Single License）

---

## 2. 技术特性

### 2.1 核心架构

CODESYS 由三大核心组件构成：

```
+--------------------------------------------------+
|  CODESYS Development System (IDE)                 |
|  - 基于 .NET Framework 4.8 (Windows)              |
|  - 插件架构 (Plugin Architecture)                 |
|  - 依赖注入 (DI) 框架                             |
|  - 支持 WinForms / GDI+ 渲染引擎                  |
+--------------------------------------------------+
          |  CODESYS 自有通信协议 (TCP/UDP)
          v
+--------------------------------------------------+
|  CODESYS Control (Runtime System)                 |
|  - 使用 C 语言实现                                |
|  - 轻量级操作系统抽象层 (OSAL)                     |
|  - 事件系统 / 内存管理 / 异常处理 / 任务调度       |
|  - 支持多核分配                                    |
|  - 可运行在: Windows, Linux, VxWorks, QNX, RTOS    |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|  CODESYS Compiler Stack                           |
|  - 前端: IEC 61131-3 语言解析 → 语言模型          |
|  - 后端: 原生机器码生成 (Native Code Generation)  |
|  - 目标 CPU: x86, ARM, ARM64, PowerPC, TriCore,   |
|    Blackfin, ColdFire, RX, SH, 28x, Cortex M3 等  |
+--------------------------------------------------+
```

#### 2.1.1 IDE 架构（编程系统）

CODESYS Development System 的架构层次：

1. **用户界面层（User-Facing Layer）**
   - IEC 61131-3 语言编辑器（ST, LD, FBD, SFC, IL, CFC）
   - I/O 配置页面
   - 伺服/驱动器配置
   - 网络通信配置
   - 基于 WinForms 和 GDI+ 画布渲染

2. **CODESYS 语言模型（Language Model）**
   - 支持所有 IEC 61131-3 语言的数据模型
   - 结构化文本（ST）作为主要内部表示
   - 其他语言编辑器（如 LD）将输入转换为 ST
   - 配置设置生成对应的全局变量类型（DUT）、全局变量（GVL）和初始化代码

3. **CODESYS 编译器（Compiler）**
   - 扫描语言模型检查错误
   - 编译程序（含已安装库）
   - 生成辅助代码：类型转换、任务管理、I/O 同步、初始化
   - 输入输出均为 CODESYS 语言模型（输出增强版本）

4. **代码生成器（Code Generator）**
   - 从语言模型生成目标 CPU 的原生机器码
   - 直接执行，无需解释器
   - 针对不同 CPU 架构优化

5. **辅助模块（Auxiliary Modules）**
   - 上传/下载
   - 调试器（断点、变量监控、单步执行）
   - 库管理器
   - 插件系统
   - 重构工具
   - 脚本引擎（Scripting API）
   - 项目比较工具

#### 2.1.2 运行时架构（Runtime System）

CODESYS Control 运行时系统的核心组件：

- **自有通信协议**：用于与 IDE 的主机通信
- **程序管理**：支持多程序并发执行（待确认是否严格并行）
- **用户程序执行引擎**：执行编译后的原生机器码
- **OPC UA 协议栈**：内置 OPC UA Server/Client
- **SQLite 集成**：本地数据存储
- **自定义框架**：含事件系统、内存管理、异常处理、任务调度
- **PLC Handler 接口**：用于二次开发（SDK 形式提供）

运行时支持部署形态：
- **CODESYS Control Full**：完整运行时，支持抢占式多任务操作系统
- **CODESYS Control Embedded**：面向嵌入式设备的预配置运行时
- **CODESYS Control SL**：面向标准平台（Windows/Linux）的即用型 SoftPLC

### 2.2 关键技术能力

#### 2.2.1 IEC 61131-3 全语言支持

CODESYS 支持 IEC 61131-3 标准定义的全部 5 种编程语言，外加 CFC：

| 语言 | 缩写 | 说明 | CODESYS 支持状态 |
|------|------|------|-----------------|
| 结构化文本 | ST | 类 Pascal 高级语言 | 完全支持，内部核心表示 |
| 梯形图 | LD/LAD | 图形化继电器逻辑 | 完全支持，多种变体 |
| 功能块图 | FBD | 图形化信号流 | 完全支持 |
| 顺序功能图 | SFC | 状态机/流程控制 | 完全支持 |
| 指令表 | IL | 汇编风格的低级语言 | 已弃用（PLCopen 标记为 obsolete） |
| 连续功能图 | CFC | 自由布局功能块图 | 支持（作为附加组件） |

**IEC 61131-3 第 3 版（面向对象扩展）**：
- 支持 METHOD、INTERFACE、EXTENDS、IMPLEMENTS 关键字
- 封装、继承、多态
- 面向对象与面向过程可混合使用
- 支持将 OOP 代码封装为带函数调用接口的库

#### 2.2.2 编译器技术

- **原生机器码生成**：不为解释执行，直接生成目标 CPU 的机器码
- **多 CPU 平台支持**：x86, ARM, ARM64, PowerPC, TriCore, Blackfin, ColdFire, RX, SH, 28x, Cortex M3 等
- **编译器版本管理**：SP17 之前有统一编译器版本号，SP18 之后移除，改为组件独立版本化
- **编译流程**：语言模型 → 语义检查 → 代码生成 → 链接 → 下载到目标设备

#### 2.2.3 实时性能

- 最小循环周期：50μs（视硬件性能而定）
- 支持多核分配（任务组分配到不同 CPU 核心）
- 抢占式多任务调度
- 支持 Cyclic、Free-run、Event 三种任务类型

#### 2.2.5 编译器技术深入

CODESYS 的编译器技术是产品核心竞争力之一：

**编译器前端（Frontend）**：
- 词法分析（Lexer）→ Token 序列
- 语法分析（Parser）→ 抽象语法树（AST）
- 语义分析 → 类型检查、作用域解析
- 生成 CODESYS 语言模型

**编译器后端（Backend）**：
- 语言模型优化（常量折叠、死代码消除）
- 指令选择（映射到目标 CPU 指令集）
- 寄存器分配
- 原生机器码生成

**支持的 CPU 代码生成器**：
- ARM Code Generator, ARM64 Code Generator
- Cortex M3 Code Generator
- x86 Code Generator, x64 Code Generator
- PowerPC Code Generator, TriCore Code Generator
- Blackfin, ColdFire, RX, SH, 28x Code Generator

所有代码生成器集成在标准 IDE 安装包中，用户选择目标设备时自动匹配。

#### 2.2.6 任务调度系统

CODESYS 的任务调度支持多种模式：

**Cyclic（循环任务）**：固定周期执行（1ms/10ms/100ms 等）
**Free-run（自由运行）**：连续执行
**Event（事件触发）**：由中断或变量变化触发

多核支持（SP17+）：任务组可分配到不同 CPU 核心。
优先级管理：高优先级任务可抢占低优先级任务，支持看门狗。

**典型周期性能**：
- Beckhoff CX2040 x86: <50μs
- ARM Cortex-A 高性能: ~100μs
- Wago PFC200 ARM: ~1-10ms
- Raspberry Pi 4: ~1-5ms
- SoftPLC Win SL: ~1-10ms

#### 2.2.7 库系统

CODESYS 的库系统是代码复用的核心机制：

- 库封装 IEC 61131-3 代码（函数、功能块、全局变量）
- 签名库（Signed Library）——基于证书确保来源可信
- 版本化管理（主版本.次版本.修订）
- 库依赖检查（Library Dependency Inspection）
- 从 CODESYS Store 在线安装
- 用户可创建私有库
- 库可包含文档和示例

#### 2.2.8 脚本与自动化

CODESYS Scripting API 支持自动化开发流程：

- 基于 .NET 的脚本引擎
- 项目创建、修改、编译自动化
- CI/CD 集成
- 批量操作（如批量导入导出变量）
- 支持 Python 脚本（通过附加组件，待确认）
- Windows 平台的实时性通过 CODESYS 自研内核补丁实现
- Linux 平台使用标准 Linux RT-PREEMPT 补丁

#### 2.2.4 现场总线支持

| 总线协议 | 角色 | 支持状态 |
|---------|------|---------|
| EtherCAT | Master | 完全支持 |
| PROFINET | Controller/Device | 完全支持 |
| EtherNet/IP | Scanner/Adapter | 完全支持 |
| CANopen | Master/Slave | 完全支持 |
| Modbus TCP/RTU | Client/Server | 完全支持 |
| PROFIBUS | Master | 通过附加模块 |
| J1939 | 支持 | 通过 CAN 栈 |
| Sercos | 支持 | 待确认 |

### 2.3 支持的硬件/平台

CODESYS 运行时已适配超过 400 家 OEM 制造商的 1,000+ 种设备类型，涵盖：

**主要 OEM 合作伙伴**：
- Wago — PFC100, PFC200, TP600 系列
- Beckhoff — CX 系列工控机（TwinCAT 基于 CODESYS 衍生）
- Schneider Electric — AC500 系列（部分型号基于 CODESYS V3）
- Bosch Rexroth — IndraControl, ctrlX CORE
- ABB — AC500 系列
- Eaton — XC 系列控制器
- Festo — CPX-E, CECC 运动控制器
- IFM — ecomatController（移动机械）
- KUNBUS — RevPi（基于 Raspberry Pi）
- Berghof — MPC, ECC 控制器
- Lenze — 控制器系列
- Moeller — PS4-341 系列
- 多家中国 OEM — Lico, UniMAT 等

**标准平台 SoftPLC**：
- CODESYS Control Win SL — Windows 平台
- CODESYS Control for Linux SL — Linux 平台
- CODESYS Control for Raspberry Pi SL — Raspberry Pi CM4/CM5
- CODESYS Control for PLCnext SL — Phoenix Contact PLCnext

**CPU 架构**：
- x86 (Intel/AMD 32/64-bit)
- ARM (Cortex-A, Cortex-M3, Cortex-R)
- ARM64 (AArch64)
- PowerPC
- TriCore
- Blackfin
- ColdFire
- Renesas RX
- Texas Instruments C28x

### 2.4 编程语言与开发工具链

**IDE 开发功能**：
- 多语言编辑器（支持语法高亮、智能提示、输入助手）
- 库管理器（Library Manager）
- 设备描述文件（DDF, Device Description File）
- 项目比较工具（支持图形化编辑器比较）
- 调试功能：断点、变量监控、单步、强制赋值
- 序列控制（Sequence Control）
- 在线修改（Online Change）
- 脚本 API（Scripting Engine）
- 重构工具（Refactoring）
- 项目模板和向导

**版本控制集成**：
- CODESYS Git 支持（SP17 起支持 XML 导出）
- CODESYS SVN 支持
- 第三方工具：Copia
- 传统上使用单文件项目存储，新版本支持 Git-friendly XML 导出

---

## 3. 功能概览

### 3.1 主要功能模块

#### 3.1.1 CODESYS Control（运行时系统）

核心运行时，将通用计算设备转变为 IEC 61131-3 控制器。提供：
- 用户程序执行
- I/O 管理
- 任务调度
- 通信协议栈
- OPC UA 服务器
- 安全功能

#### 3.1.2 CODESYS Visualization（可视化）

CODESYS 提供多层可视化方案：

| 产品 | 说明 | 部署方式 |
|------|------|---------|
| TargetVisu | 本地 HMI，运行在控制器连接的显示器上 | 控制器本地 |
| WebVisu | 基于 Web 的 HMI，通过浏览器访问 | Web 服务器 |
| CODESYS HMI | 独立 HMI 项目，支持 WinCC 风格的组态 | Windows/Linux |

可视化特点：
- 与 IEC 61131-3 应用共享变量空间
- 支持图形化模板、动态对象
- 内置趋势图、报警、数据记录
- 响应式设计（WebVisu 支持移动端）

#### 3.1.3 CODESYS SoftMotion（运动控制）

运动控制扩展，将逻辑控制器转变为运动控制器：

| 等级 | 功能 | 适用场景 |
|------|------|---------|
| SoftMotion Light | 单轴定位，CIA 402 兼容驱动 | 简单单轴运动 |
| SoftMotion | 单轴和多轴同步运动（电子凸轮、电子齿轮） | 多轴联动 |
| SoftMotion CNC+Robotics | 完整 CNC 和机器人控制 | 数控机床、工业机器人 |

**SoftMotion 关键能力**：
- PLCopen MotionControl Part 1/2/4 认证功能块
- 电子凸轮编辑器（CAM Editor）
- 电子齿轮（Electronic Gear）
- 急停、回零、探针功能
- 位置/速度/扭矩控制模式
- 支持虚拟轴和逻辑轴

**CNC+Robotics 关键能力**：
- DIN 66025 (G-Code) 3D CNC 编辑器
- 支持直线/圆弧/样条/抛物线/椭圆插补
- 刀具半径补偿（Tool Radius Compensation）
- 支持多种运动学模型：龙门、SCARA、并联机器人、6轴关节臂
- PLCopen Motion Part 4 认证功能块
- 3D 可视化（CODESYS Depictor）
- DXF 导入
- 支持 9 维路径（3 主插补轴 + 5 线性附加轴 + 3 样条取向轴）

#### 3.1.4 CODESYS Safety（安全）

安全控制系统扩展，通过 TÜV 预认证：

| 等级 | 标准 | 适用场景 |
|------|------|---------|
| Safety SIL2 | EN ISO 13849 PL d / IEC 61508 SIL2 | 移动机械 |
| Safety SIL3 | IEC 61508 SIL3 | 工业机械 |

- 安全 FBD/ST/LD/CFC/UML 编辑器
- 安全运行时与标准运行时隔离
- 安全数据交换协议
- TÜV 预认证测试框架
- 可选 TI RM48 MCU 平台适配

#### 3.1.5 CODESYS Fieldbus（现场总线）

现场总线配置和通信支持：
- 集成式现场总线配置器
- 协议栈库（可移植）
- 支持 EtherCAT, PROFINET, EtherNet/IP, CANopen, Modbus 等
- 驱动抽象层，更换驱动无需修改应用代码

#### 3.1.6 CODESYS OPC UA

OPC UA 通信扩展：
- OPC UA Server（内置）
- OPC UA Client（IEC 库形式）
- OPC UA 方法调用
- OPC UA 报警与条件（Alarms & Conditions）
- OPC UA PubSub（发布/订阅）
- 自定义信息模型（Companion Specifications）
- 安全策略：Aes128Sha256RsaOaep, Aes256Sha256RsaPSS
- 通过 OPC UA 1.04 认证（待确认最新认证状态）

#### 3.1.7 CODESYS Redundancy（冗余）

冗余控制扩展：
- 双机热备（Hot-Standby）
- 主动/被动切换
- 应用同步
- 状态监控

#### 3.1.8 CODESYS Automation Server（自动化服务器）

云平台服务：
- 远程设备管理
- 应用远程控制（启动/停止/复位）
- 证书管理
- 文件管理
- 加密通信
- 边缘网关替代

#### 3.1.9 CODESYS Professional Developer Edition

专业开发者工具集：
- UML 建模（状态图、类图）
- 应用组合器（Application Composer）
- 代码分析工具
- 高级库管理
- 测试管理（Test Manager）

### 3.2 关键工作流/使用场景

#### 场景 1：OEM 设备集成
1. OEM 采购 CODESYS Runtime Toolkit（SDK）
2. 在硬件上适配运行时（需提供 Firmware Platform SDK）
3. CODESYS 团队协助编译链接
4. OEM 获得带 CODESYS 能力的控制器固件
5. 可选：定制 IDE 品牌（CODESYS Application Platform）

#### 场景 2：机器开发
1. 下载免费 CODESYS Development System
2. 选择目标硬件（Wago/Beckhoff/第三方）
3. 使用 IEC 61131-3 语言编写控制逻辑
4. 配置 I/O 和现场总线
5. 调试（断点/变量监控）
6. 部署到设备

#### 场景 3：运动控制开发
1. 在设备树中配置轴和驱动器
2. 使用 SoftMotion 功能块编写运动逻辑
3. 可选：使用 CNC 编辑器编写 G-Code 程序
4. 使用可视化模板调试
5. 在线配置模式（Online Config Mode）调试驱动器

### 3.3 扩展机制

CODESYS 提供多层次的扩展能力：

1. **插件系统（Plugin System）**
   - 基于 DI（依赖注入）框架
   - 插件开发需付费许可
   - 可通过 CODESYS Store 分发
   - 收入分成模式

2. **库系统（Library System）**
   - 支持封装 OOP 代码为库
   - 库签名（Signed Libraries）——基于证书
   - 版本化管理
   - 在线库搜索和安装

3. **脚本引擎（Scripting API）**
   - 支持自动化任务
   - 项目生成/修改
   - 批量操作

4. **C 代码集成（C Code Integration）**
   - 在 IEC 61131-3 应用中集成 C 代码
   - 通过 CODESYS C Code Integration 插件

5. **设备描述文件（DDF）**
   - XML 格式描述设备参数
   - 导入 IDE 即可使用新设备

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

- **最新稳定版**: CODESYS V3.5 SP21（2025 年发布）
- **版本策略**: 每年一个 Service Pack 大版本，组件独立版本化（SP17 之后）
- **更新周期**: 从 SP17 起，核心组件（CODESYS Essentials）固定，功能模块可独立更新
- **CODESYS go!**: 2026 年 4 月发布，基于 Web 技术的新一代 IDE（Beta 阶段），2028 年后将收费
- **研发投入**: 持续增长，2025 年路线图显示 OPC UA、安全、模块化、云平台为主要方向

### 4.2 用户基数

- **IDE 注册用户**: 全球超过 300,000 人（CODESYS Store 注册数）
- **设备制造商**: 500+ OEM 提供 CODESYS 兼容设备
- **设备类型**: 1,000+ 种不同设备型号
- **单设备数量**: 数千万台 CODESYS 兼容设备在运行
- **地理分布**: 欧洲（德国为核心）、中国、亚太、北美、中东

### 4.3 生态系统

#### 4.3.1 硬件生态

CODESYS 生态系统中最独特的是其**硬件厂商中立性**：

- 400+ OEM 厂商许可 CODESYS 运行时
- 90+ 自动化公司深度集成 CODESYS 开发环境
- 主要品牌：Beckhoff (TwinCAT), Wago, Schneider Electric, ABB, Bosch Rexroth, Eaton, Festo, IFM
- 标准平台：Windows, Linux, Raspberry Pi, PLCnext

#### 4.3.2 软件生态

- **CODESYS Store**: 官方应用商店，提供库、插件、模板、SoftPLC
- **OSCAT**: 开源社区库（Open Source Community for Automation Technology）
- **CODESYS Forge**: 开发者社区和示例代码
- **第三方库**: 大量厂商提供的专用库（驱动、通信、算法）

#### 4.3.3 培训与认证

- CODESYS 官方培训课程
- 开发者研讨会（Runtime Toolkit Workshop）
- 在线文档和帮助系统
- 社区论坛
- 技术博客（如 Stefan Henneken 的博客）

### 4.4 最新发展趋势

#### 4.4.1 模块化重组（SP17+）

自 SP17 起，CODESYS 进行了重大的架构重构：
- 核心功能精简为"CODESYS Essentials"
- 语言编辑器、现场总线配置器、代码生成器从核心中剥离为独立插件
- 每个插件有独立版本号（4.x.x.x）
- 可独立更新，无需等待年度 Service Pack
- 引入 CODESYS Installer 管理多版本安装

#### 4.4.2 CODESYS go!（Web 化）

2026 年 4 月发布的基于 Web 技术的新一代 IDE：
- 后端可运行在桌面、服务器、云、甚至 PLC 上
- 前端支持任何浏览器（Windows/Linux/Mac）
- 文本化项目存储（Git-friendly）
- 复用 CODESYS V3 编译器
- 与 CODESYS Control V3 兼容
- 初始功能有限，逐步扩展

#### 4.4.3 工业 4.0 / IIoT

- OPC UA 持续增强（PubSub, Alarms & Conditions, 自定义信息模型）
- MQTT 支持
- 云连接（CODESYS Automation Server）
- Google Cloud IoT Core 集成
- 边缘计算能力

#### 4.4.4 虚拟化与容器化

- 虚拟 PLC（vPLC）概念推广
- Docker 支持（Wago PFC200）
- 云原生部署
- 通用 IT 硬件运行控制软件

#### 4.4.5 安全增强

- 用户管理强制启用
- 加密通信
- 证书管理
- 签名库
- CodeMeter 许可保护

---

## 5. 市场定位

### 5.1 主要应用行业

| 行业 | 应用场景 | 市场份额估计 |
|------|---------|------------|
| 机械制造（OEM） | 包装机、纺织机、印刷机、木工机械 | 核心市场，~30% |
| 移动机械 | 农业机械、工程车辆、物料搬运 | 强项（IFM 等） |
| 楼宇自动化 | HVAC、照明、能源管理 | 重要市场 |
| 过程工业 | 化工、制药、食品饮料 | 中低份额 |
| 汽车制造 | 生产线、装配线 | 低份额（TIA Portal 主导） |
| 基础设施 | 水处理、电力 | 中低份额 |
| 教育 | 培训、教学、实验室 | 强项（免费 IDE） |

### 5.2 与竞品的对比

#### 5.2.1 vs Siemens TIA Portal

| 维度 | CODESYS | TIA Portal |
|------|---------|-----------|
| 开发商 | CODESYS Group（独立） | Siemens（硬件厂商） |
| IDE 价格 | 免费 | €700-15,000+ |
| 硬件支持 | 400+ 品牌 | 仅 Siemens |
| 市场份额 | ~15%（400+ 品牌合计） | ~35-40%（仅 Siemens） |
| 编程语言 | 全部 5+CFC | 全部 5 种 |
| 仿真 | 内置软PLC | PLCSIM（需单独许可） |
| 运动控制 | SoftMotion（附加） | SIMOTION（集成） |
| 安全 | SIL2/SIL3 认证 | Safety Integrated |
| 版本控制 | Git-friendly XML | 有限（TIA Openness API） |
| 学习曲线 | 中等 | 较陡 |
| 主要市场 | OEM/机器制造 | 工厂自动化/过程控制 |
| 全球职位需求 | ~2,500（美国） | ~10,000（美国） |

**关系**: CODESYS 和 TIA Portal 是直接竞争关系，但各自占据不同细分市场。TIA Portal 主导大型工厂自动化和过程控制，CODESYS 主导 OEM 机器制造和移动机械。

#### 5.2.2 vs Beckhoff TwinCAT

| 维度 | CODESYS | TwinCAT |
|------|---------|---------|
| 关系 | 上游平台 | 基于 CODESYS 衍生 + 自研扩展 |
| IDE | CODESYS Development System | TwinCAT XAE（Visual Studio Shell） |
| 运行时 | CODESYS Control | TwinCAT Runtime（自研实时内核） |
| 硬件 | 400+ 品牌 | 仅 Beckhoff 硬件 |
| 运动控制 | SoftMotion（附加许可） | 内置 NC/CNC |
| 最小周期 | 50μs（硬件依赖） | <50μs（Beckhoff 硬件优化） |
| 现场总线 | 多种 | EtherCAT 原生支持 |
| HMI | 内置可视化 | 无原生 HMI（需第三方） |

**关系**: TwinCAT 最初基于 CODESYS V2，TwinCAT 3 使用 Visual Studio Shell 但保留了 IEC 61131 兼容性。两者既竞争又有着技术渊源。TwinCAT 在高端运动控制场景有优势，CODESYS 在硬件灵活性上胜出。

#### 5.2.3 vs Rockwell Studio 5000

| 维度 | CODESYS | Studio 5000 |
|------|---------|------------|
| 开发商 | CODESYS Group | Rockwell Automation |
| 硬件 | 400+ 品牌 | 仅 Rockwell/Allen-Bradley |
| IDE 价格 | 免费 | ~$2,000+ |
| 主要市场 | 欧洲/亚洲 | 北美 |
| 编程语言 | 全 IEC 61131 | Ladder/ST/FBD/SFC |
| 集成 HMI | 是 | 需 FactoryTalk View |

#### 5.2.4 vs Schneider EcoStruxure Machine Expert

**关系**: Schneider Electric 的 EcoStruxure Machine Expert 本身就是基于 CODESYS V3 的品牌化版本。两者是"上游"与"品牌版"的关系，而非竞争关系。

### 5.3 竞争/互补关系总结

- **对上（SCADA/HMI）**: CODESYS 提供内置可视化，但通常与 SCADA 系统（WinCC, Ignition, iFIX）互补使用
- **对下（现场总线）**: 支持主流现场总线，是 EtherCAT 技术组的重要成员
- **横向（云/IT）**: 通过 OPC UA、MQTT 与 IT 系统集成，Automation Server 提供云能力

---

## 6. 产品特色

### 6.1 硬件无关的软PLC 理念

CODESYS 最核心的特色是**将控制软件与硬件解耦**：

- 一套 IDE 可编程任意品牌的兼容控制器
- 运行时可在 Windows PC、Linux 工控机、嵌入式设备、Raspberry Pi 上运行
- 同一个项目可部署到不同硬件平台（需重新编译）
- OEM 可专注于硬件差异化，无需重复开发编程环境

这一理念的直接类比是 Android 操作系统——Google 提供 Android 平台，三星、小米、华为各自制造硬件并定制 UI。

### 6.2 IEC 61131-3 编译器/运行时的工业标准地位

CODESYS 的编译器技术是其主要技术壁垒：

- **原生机器码生成**：不同于解释型实现，CODESYS 编译器为每个目标 CPU 生成优化的机器码
- **多平台覆盖**：支持 15+ CPU 架构，是业界覆盖最广的 IEC 61131-3 编译器之一
- **语言模型中心化**：所有编辑器（LD, FBD, SFC, CFC）输入均转换为 ST 语言模型，编译器统一处理
- **编译器版本管理**：SP18 之后采用组件级版本化，灵活性更强

### 6.3 可视化集成的开发体验

CODESYS 将可视化（HMI）直接集成到开发环境中：

- **TargetVisu**：在控制器本地显示器上运行，无额外硬件成本
- **WebVisu**：通过 Web 浏览器访问，无需安装客户端
- **共享变量空间**：HMI 直接访问 PLC 变量，无需额外配置 OPC 通信
- **可视化模板**：SoftMotion 功能块自带可视化模板，调试更直观
- **3D 可视化**：CODESYS Depictor 支持 CNC/机器人运动 3D 显示

### 6.4 一体化运动控制与逻辑控制

CODESYS 在单一开发环境中整合了逻辑控制和运动控制：

- 无需额外硬件专用于运动控制
- 逻辑程序和运动程序在同一任务中协同
- 标准 PLCopen 功能块降低学习成本
- CNC 编辑器和运动学变换库覆盖常见机器人类型

### 6.5 模块化与可扩展性

- **插件架构**：几乎所有功能（编辑器、编译器后端、现场总线配置器）都是可替换的插件
- **库系统**：封装和复用 IEC 61131-3 代码
- **脚本引擎**：通过 API 自动化开发流程
- **C 代码集成**：在 IEC 应用中使用 C 代码

### 6.6 安全认证

- TÜV 预认证的安全运行时（SIL2/SIL3）
- 减少 OEM 安全认证的工作量和成本
- 安全应用与标准应用隔离

---

## 7. 对 AUDESYS 的参考价值

### 7.1 IEC 61131-3 编译器架构与运行时设计

CODESYS 的编译器架构为 AUDESYS 的 HAL（硬件抽象层）运行时设计提供了重要参考：

| CODESYS 特性 | 对 AUDESYS 的参考价值 |
|-------------|---------------------|
| 语言模型（Language Model）作为中心表示 | AUDESYS 可考虑类似的设计——将所有编辑器输入统一为中间表示 |
| 原生机器码生成 vs 解释执行 | AUDESYS HAL 需决定运行时采用 JIT/解释/机器码方式 |
| 编译器前端/后端分离 | 适用于 AUDESYS 的多语言策略（Rust Core + C++ + 其他语言） |
| 运行时与操作系统抽象层（OSAL） | 与 AUDESYS HAL 的硬件抽象层设计直接对应 |

**关键问题**：AUDESYS 是否也需要类似 IEC 61131-3 的编程语言支持？还是聚焦于 Studio IDE 的配置式开发？CODESYS 的经验表明，IEC 61131-3 编译器是巨大的工程投入（数十年积累），AUDESYS 需谨慎评估是否自研或采用现有方案。

### 7.2 软PLC 开发 IDE 的设计模式

CODESYS IDE 的设计模式值得 AUDESYS Studio IDE 参考：

| 设计模式 | CODESYS 实现 | 对 AUDESYS 的参考 |
|---------|-------------|------------------|
| 插件架构 | 基于 DI 框架的全插件化 | AUDESYS Studio 可采用类似的可扩展架构 |
| 语言模型 | 编辑器输入统一转换为 ST | AUDESYS 可定义统一的"设备配置模型" |
| 项目树 | 设备树（Device Tree）+ POU 视图 | 对 Studio IDE 的项目浏览结构有参考价值 |
| 在线修改 | 运行时不停机修改程序 | 工业控制的关键需求 |
| 设备描述文件 | DDF 格式描述设备能力 | 对 AUDESYS 的硬件描述文件有参考意义 |

### 7.3 硬件无关的 Runtime 抽象层设计

CODESYS 的运行时抽象层设计是 AUDESYS HAL 的重要参考：

- **CODESYS Control Runtime Toolkit** 提供了一个 SDK，OEM 用于适配自有硬件
- 运行时包含：OS 抽象层、事件系统、内存管理、任务调度、I/O 管理
- 支持多种 OS 和 CPU 架构，通过分层抽象实现

**对 AUDESYS HAL 的参考**：
- AUDESYS HAL 的 amw（AUDESYS Middleware）抽象层可参考 CODESYS 的"可插拔通信栈"设计
- 运行时与 IDE 的通信协议设计（CODESYS 使用自有协议）
- 设备描述机制（DDF 类比）——设备能力通过描述文件暴露给 IDE

### 7.4 可视化与运动控制的集成方式

CODESYS 将可视化直接集成到开发环境中的做法值得关注：

- **TargetVisu/WebVisu** 与 PLC 项目共享变量空间，无需额外配置
- **SoftMotion 可视化模板** 为运动控制功能块提供即用型调试界面
- **3D 可视化**（Depictor）用于 CNC/机器人路径验证

**对 AUDESYS Studio 的参考**：
- IDE 是否应内置轻量级 HMI 设计器？
- 可视化与运行时调试的集成程度如何设计？
- 运动控制参数的在线调试界面设计

### 7.5 OPC UA 集成策略

CODESYS 的 OPC UA 实现策略提供了参考：

- 内置 OPC UA Server（无需额外硬件）
- OPC UA Client 以 IEC 库的形式提供
- 支持 Alarms & Conditions、Methods、PubSub
- 自定义信息模型（Companion Specifications）

**对 AUDESYS 的参考**：
- AUDESYS 的 Runtime 是否应内置 OPC UA Server？
- 与 amw 抽象层的关系——OPC UA 作为通信协议之一，还是内置协议？

### 7.6 商业模式启示

CODESYS 的商业模式对 AUDESYS 有直接参考价值：

| 方面 | CODESYS 模式 | 对 AUDESYS 的参考 |
|------|-------------|------------------|
| IDE 免费 | 降低门槛，扩大生态 | AUDESYS Studio 可考虑免费策略 |
| 运行时收费 | 按设备授权，收入稳定 | AUDESYS Runtime 的商业模式设计 |
| OEM 定制 | 品牌化版本，版税模式 | AUDESYS 是否向设备厂商提供 SDK？ |
| 应用商店 | CODESYS Store 分成 | AUDESYS 的插件/库生态规划 |

### 7.7 需警惕的风险

CODESYS 的发展历程中也暴露出一些 AUDESYS 需注意的风险：

1. **编译器版本碎片化**：SP17 到 SP18 的过渡中，编译器版本管理变得复杂，最终被迫放弃统一版本号
2. **运行时兼容性**：新 IDE 可能不支持旧运行时，旧 IDE 可能无法连接新运行时
3. **插件依赖管理**：模块化后，插件间的兼容性管理成为挑战
4. **Web 化迁移**：CODESYS go! 与 V3 的长期共存策略需观察

---

*文档生成日期：2026-07-13*
*信息来源：CODESYS 官方网站、产品数据表、SP17-SP21 发布说明、技术博客、第三方对比分析*
*标注"待确认"的信息需进一步验证*

## 附录

### A. 版本历史

| 版本 | 发布时间 | 主要变化 |
|------|---------|---------|
| V2.3 | ~2005 | 上一个主要版本，仍有一些遗留安装
| V3.0 | ~2010 | 全新架构，引入语言模型和插件系统
| V3.5 SP16 | 2024 | 最后一个非模块化版本
| V3.5 SP17 | 2024 | 重大模块化重构，引入 CODESYS Installer
| V3.5 SP18 | 2024 | 移除编译器版本概念，组件独立版本化
| V3.5 SP19 | 2024 | 基础库转为独立插件格式
| V3.5 SP20 | 2025 | 持续改进和优化
| V3.5 SP21 | 2025 | 最新版本，保留 4th Edition 关键字
| CODESYS go! | 2026-04 | 基于 Web 的新一代 IDE（Beta）

### B. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 运行时系统 | Runtime System | 在目标设备上执行 PLC 程序的软件层
| 软PLC | SoftPLC | 在通用计算硬件上运行的软件化 PLC
| 语言模型 | Language Model | CODESYS 编程语言的内部数据表示
| 代码生成器 | Code Generator | 从语言模型生成目标 CPU 机器码的组件
| 设备描述文件 | DDF | 描述设备能力的 XML 文件
| 在线修改 | Online Change | 不停机修改程序
| 任务调度 | Task Scheduling | 管理 PLC 程序执行周期
| 现场总线 | Fieldbus | 传感器执行器通信网络
| OPC UA | Open Platform Communications Unified Architecture | 工业通信标准
| IEC 61131-3 | — | PLC 编程语言国际标准
| SIL | Safety Integrity Level | 安全完整性等级
| TUV | Technischer Uberwachungsverein | 德国技术监督协会

### C. 参考链接

- CODESYS 官方网站: https://www.codesys.com
- CODESYS Store: https://store.codesys.com
- CODESYS 文档: https://content.helpme-codesys.com
- CODESYS 路线图: https://us.codesys.com/ecosystem/up-to-date/roadmap
- PLCopen: https://plcopen.org

### D. 文档版本信息

- 文档版本: 1.0
- 生成日期: 2026-07-13
- 作者: researcher-ide (AUDESYS Team)
- 审核状态: 草稿