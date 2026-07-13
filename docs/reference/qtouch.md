# Qtouch (GE/Emerson Proficy / iFIX)

## 1. 产品画像

### 1.1 基本信息

- **产品名称**: Proficy HMI/SCADA（含 iFIX 和 CIMPLICITY 两个旗舰产品）
- **曾用名/品牌**:
  - FIX / FIX DMACS / FIX32 / iFIX（Intellution 时代）
  - Proficy HMI/SCADA（GE Digital / GE Fanuc 时代）
  - GE Vernova Proficy（2024-2026）
  - Velotic Proficy（2026 年 3 月后，最新品牌）
- **开发商历史**:
  - Intellution, Inc.（1981 年由 Steve Rubin 创立）
  - Emerson Electric（1995 年收购 Intellution，约 $100M）
  - GE Fanuc / GE Digital（2001 年交换至 GE）
  - GE Vernova（2024 年 GE 拆分，软件业务并入）
  - Velotic（2026 年 3 月，TPG 收购后成立的新独立公司）
- **首次发布**: 1983-1984（FIX——Fully Integrated Control System，基于 MS-DOS）
- **当前版本**: iFIX 2023 / CIMPLICITY 2023
- **官方网站**: https://www.gevernova.com/software/products/hmi-scada（现重定向至 Velotic）

### 1.2 产品定位与核心价值主张

Proficy HMI/SCADA 的定位是**工业级 HMI 和 SCADA 软件平台**，核心价值主张包括：

- **高性能 HMI（High Performance HMI）**：基于 ISA 101 标准设计的现代操作界面，减少操作员认知负荷
- **开放架构（Open Architecture）**：基于 OPC、ActiveX、COM、VBA 等标准技术，易于集成
- **分布式联网能力**：支持多站点、多节点的 SCADA 网络架构
- **工业级可靠性**：冗余服务器、热备切换、故障转移
- **历史数据管理**：与 Proficy Historian 深度集成

iFIX 和 CIMPLICITY 是 Proficy HMI/SCADA 家族中的两个旗舰产品，面向不同场景：

| 维度 | iFIX | CIMPLICITY |
|------|------|-----------|
| 定位 | 高性能 HMI + SCADA | 企业级分布式 SCADA |
| 架构 | 单站点/集中式 | 多站点/分布式 |
| 可视化 | 强（High Performance HMI） | 强（企业级模板） |
| 升级 | 标准升级 | Active Update（零停机） |
| 适用场景 | 单工厂、过程控制 | 多工厂、广域分布 |

### 1.3 目标用户群体

| 用户类型 | 典型场景 |
|---------|---------|
| 制药行业 | 批次控制、合规记录（FDA 21 CFR Part 11） |
| 水处理/污水处理 | 远程监控、SCADA 集中管理 |
| 电力/能源 | 发电厂监控、电网调度 |
| 石油天然气 | 管道监控、海上平台 |
| 食品饮料 | 生产线监控、配方管理 |
| 汽车制造 | 生产线监控、质量追溯 |
| 基础设施 | 地铁、交通监控 |
| 系统集成商 | 为客户定制 SCADA 解决方案 |

### 1.4 商业许可模型

Proficy HMI/SCADA 采用**标签数（Tag Count）** + **节点数（Node Count）** 的许可模型：

- **iFIX 许可层级**：
  - iFIX Standard：有限标签数
  - iFIX Plus：更多标签数 + 高级功能
  - iFIX Developer：开发环境许可
  - 运行时许可（Runtime License）：按部署节点收费

- **CIMPLICITY 许可层级**：
  - 按节点数许可（Node-based Licensing）
  - 客户端/服务器分离许可
  - 可选附加模块：Webspace、Historian、Report Writer

- **免费试用**：提供 2 小时运行时的全功能试用版

- **2026 年 Velotic 收购后的变化**：待确认（许可模式可能调整）

---

## 2. 技术特性

### 2.1 核心架构

#### 2.1.1 iFIX 架构

iFIX 基于 **Client/Server 架构**，核心组件如下：

```
+--------------------------------------------------+
|  iFIX WorkSpace (IDE)                             |
|  - 集成开发环境（IDE）                             |
|  - 配置工具 + 运行时环境                          |
|  - 基于 Ribbon Bar UI（Microsoft Fluent UI）      |
|  - 内置 VBA 脚本编辑器（Visual Basic Editor）     |
|  - 支持 ActiveX 文档嵌入                         |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|  SCADA Server (SCADA Node)                        |
|  - SAC (Scan, Alarm, and Control) 程序            |
|  - 数据库链（Database Chains）                     |
|  - 报警管理（Alarm Management）                    |
|  - 数据采集（Data Acquisition）                    |
|  - 分布式网络通信                                  |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|  通信层（Connectivity Layer）                       |
|  - KEPServerEX / Industrial Gateway Server (IGS)  |
|  - OPC UA / OPC DA                                |
|  - 原生 I/O 驱动（多种 PLC 协议）                   |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|  Proficy Historion (数据历史记录)                   |
|  - 高性能时序数据归档                              |
|  - 高效存储和检索                                  |
|  - 与 iFIX 数据库同步配置                          |
+--------------------------------------------------+
```

**iFIX 关键组件详解**：

1. **iFIX WorkSpace**：统一的开发环境，集成了配置、设计、运行功能
   - 提供项目导航（树形视图）
   - 画面编辑器（Picture Editor）
   - 数据库管理器（Database Manager）
   - 调度器（Scheduler）
   - 脚本编辑器（VBA）
   - 运行时环境（Run-time Environment）

2. **SAC (Scan, Alarm, and Control)**：SCADA 节点的核心系统程序
   - 执行数据库链的逻辑
   - 扫描 I/O 点
   - 报警检测和路由
   - 控制输出

3. **数据库链（Database Chains）**：iFIX 的数据处理核心
   - 模拟量输入链（Analog Input Chain）
   - 模拟量输出链（Analog Output Chain）
   - 数字量输入链（Digital Input Chain）
   - 数字量输出链（Digital Output Chain）
   - 包含报警检测、量程转换、滤波、PID 控制等功能块

4. **报警管理（Alarm Management）**：
   - 报警分区（Alarm Areas）
   - 报警路由（Operator/Application Message Routing）
   - 报警升级（Alarm Escalation）
   - 报警搁置（Alarm Shelving）
   - ISA 18.2 标准合规

#### 2.1.2 CIMPLICITY 架构

CIMPLICITY 采用**基于节点的分布式架构**：

- **CIMPLICITY Server**：中央 SCADA 服务器
- **CIMPLICITY Client**：远程客户端，通过 Web 或专用客户端访问
- **CIMPLICITY WebServer**：基于 Web 的远程访问
- **Active Update**：零停机升级机制

#### 2.1.3 集成组件

Proficy HMI/SCADA 产品线包含多个集成组件：

| 组件 | 功能 | 说明 |
|------|------|------|
| Proficy Historian | 时序数据归档 | 高效采集、存储、检索工业时序数据 |
| Proficy Operations Hub | 现代 Web 仪表板 | 低代码/无代码 Web 应用开发 |
| Proficy Webspace | HTML5 移动客户端 | 零部署 Web 访问（iOS/Android/Windows） |
| KEPServerEX (IGS) | OPC 服务器 | 200+ 设备驱动，统一连接层 |
| CSense | 分析引擎 | 嵌入式分析和根因检测 |
| Proficy Authentication | 统一认证 | UAA（User Authentication and Authorization） |
| Configuration Hub | Web 集中配置 | 浏览器端项目配置管理 |

### 2.2 关键技术能力

#### 2.2.1 高性能 HMI（High Performance HMI）

iFIX 的核心差异化能力，基于 ISA 101 标准：

- **异常驱动的显示（Abnormal Situation Display）**：正常状态不显示，异常时突出显示
- **减少视觉噪音**：使用灰度/低饱和度设计，仅重要信息着色
- **层级导航**：从概览到细节的 Drill-down 导航
- **预定义 Dynamo 对象**：500+ ISA 符号和预置图形对象
- **模型化可视化**：基于 Plant Model 的可视化结构

#### 2.2.2 报警管理

iFIX 的报警管理能力：

- ISA 18.2 标准合规报警管理
- 报警优先级和严重性分级
- 报警分区和路由
- 报警升级（Escalation）
- 报警搁置（Shelving）
- 报警抑制（Suppression）
- 报警历史记录和审计
- 操作员确认和注释
- 报警队列管理（默认队列大小 10,000）

#### 2.2.3 冗余与高可用性

- **故障转移（Failover）**：主/备服务器架构
- **数据库同步压缩**：65,000 标签数据库同步时间从 90 秒降至 3 秒（2023 版本）
- **UDP/TCP 协议选择**：UDP 更快，TCP 更可靠
- **网络隔离**：实时 SCADA 网络与数据同步网络分离
- **热备切换**：主动/被动模式，无缝切换

#### 2.2.4 开放集成

iFIX 的开放架构能力：

- **OPC UA/DA**：客户端和服务器支持
- **ActiveX/COM**：嵌入第三方控件
- **VBA 脚本**：自动化任务和自定义逻辑
- **REST API**：与企业系统集成
- **SQL 数据库**：直接读写关系数据库
- **ODBC**：与其他数据源连接
- **MQTT 客户端**：IoT 和传感器数据接入（2023 版本新增）
- **Integration Toolkit**：用于 ERP、MES 集成的工具包

#### 2.2.5 安全功能

- 基于角色的安全（Role-based Security）
- 用户认证和授权
- 安全远程访问（UAA 认证）
- 审计日志（Operator Action Logging）
- 安全模式（Safe Mode）——仅允许从可信位置打开画面
- 只读模式（Read-Only Mode）
- 跨平台加密通信

### 2.3 支持的硬件/平台

**操作系统**：
- Windows 10/11（64-bit）
- Windows Server（版本待确认）

**通信协议支持**（通过 KEPServerEX/IGS）：
- Allen-Bradley (Rockwell) 全系列
- Siemens S7 全系列
- Modbus TCP/RTU
- OPC UA/DA
- BACnet
- MQTT
- DNP3
- 200+ 种设备驱动

**部署方式**：
- 本地部署（On-Premise）
- 虚拟化部署（VMware, Hyper-V）
- 云部署（Azure，待确认具体支持程度）

### 2.4 编程语言与开发工具链

**配置式开发（Configuration-based）**：
- 画面编辑器：拖拽式图形化设计
- 数据库管理器：表格化配置 I/O 点
- 调度器：定时任务配置
- 报警配置：策略化报警规则

**脚本化扩展**：
- **VBA（Visual Basic for Applications）**：主要脚本语言，集成在 WorkSpace 中
- 支持事件驱动脚本（画面打开、数据变化、报警触发等）
- 支持自定义功能块（Custom Function Block）

**集成开发环境**：
- iFIX WorkSpace（单一 IDE，配置 + 运行）
- Configuration Hub（Web 端集中配置，2023 版本新增）
- Proficy Operations Hub（Web 端低代码开发）

---

## 3. 功能概览

### 3.1 主要功能模块

#### 3.1.1 画面开发与可视化

**画面编辑器**：
- 基于向量的图形引擎
- 支持 500+ Dynamo 预置对象
- ISA 101 标准符号库
- 动态链接（Dynamo 主对象变更自动更新所有实例）
- 现代化 Ribbon Bar UI

**可视化类型**：
- 实时趋势图（Real-time Charts）
- 历史趋势图（Historical Charts，与 Historian 集成）
- 柱状图、面积图、样条图、最佳拟合曲线
- X-Bar, R-Bar, S-Bar, 直方图, 对数图（iFIX 5.0+）
- 数据表（VisiconX 数据网格）
- 3D 可视化（通过第三方组件）

#### 3.1.2 SCADA 监控与控制

**数据采集**：
- 多协议并行采集
- 标签数据库管理
- 实时数据质量监控
- I/O 超时和错误处理

**控制功能**：
- 设定值写入（Setpoint Write）
- 远程控制（Remote Control）
- 批次控制（Batch Execution，通过 GE Batch Execution）
- 顺序控制（Sequential Control）
- 联锁逻辑（Interlock Logic）

#### 3.1.3 报警管理

**报警处理流程**：
1. 报警检测（SAC 程序扫描）
2. 报警优先级分配
3. 报警路由（按区域/类型/级别）
4. 操作员确认
5. 报警记录（Alarm Logging）
6. 报警归档（Historian 集成）

**报警类型**：
- 过程报警（Process Alarm）
- 系统报警（System Alarm）
- 操作员消息（Operator Message）
- 应用消息（Application Message）

#### 3.1.4 历史数据管理

**Proficy Historian 关键能力**：
- 高性能时序数据采集
- 高效压缩存储
- 快速检索和查询
- 基于 Web 的查看
- 与 iFIX 数据库同步（一次性配置，自动同步）
- 云原生/本地部署选项

**免费归档**：iFIX 许可包含 1,000 个 I/O 点的免费 Historian Essentials 归档

#### 3.1.5 报表与分析

- 预配置报表模板
- 自定义报表设计
- 趋势分析
- 统计过程控制（SPC）图表
- 生产效率分析（OEE）
- CSense 嵌入式分析引擎

#### 3.1.6 用户管理

- 角色定义（Operator, Engineer, Administrator, Manager）
- 权限分级（画面访问、操作权限、配置权限）
- LDAP/Active Directory 集成
- 双因素认证（待确认）
- 操作审计日志

#### 3.1.7 Web 与移动端

**Proficy Webspace**：
- HTML5 零部署客户端
- 支持 Windows/Mac/Linux/iOS/Android
- 全功能 SCADA 访问（与厚客户端相同）
- 响应式设计
- 安全的远程访问

**Proficy Operations Hub**：
- 低代码/无代码 Web 应用开发
- 现代仪表板设计
- 与 iFIX/CIMPLICITY 数据集成
- 移动端支持

### 3.2 关键工作流/使用场景

#### 场景 1：工厂 SCADA 部署
1. 安装 KEPServerEX/IGS 配置 PLC 连接
2. 安装 iFIX 开发环境（WorkSpace）
3. 创建标签数据库（Tag Database）
4. 设计 HMI 画面（使用 Dynamo 和 High Performance HMI 原则）
5. 配置报警和事件
6. 配置 Historian 数据归档
7. 部署到 SCADA 服务器
8. 配置 Webspace 远程访问
9. 调试和投产

#### 场景 2：多站点集中监控
1. 各站点部署 CIMPLICITY Server
2. 中央监控室部署 CIMPLICITY Client
3. 配置跨站点数据同步
4. 统一报警管理
5. 集中报表和历史数据

#### 场景 3：系统升级
1. 创建项目备份
2. 使用 Active Update（CIMPLICITY）或标准升级流程（iFIX）
3. 验证兼容性
4. 逐步切换

### 3.3 扩展机制

**配置工具**：
- Configuration Hub（Web 集中配置）
- 项目模板和标准化
- 批量配置工具
- 备份/恢复工具

**脚本扩展**：
- VBA 脚本（主要扩展方式）
- Python 脚本（通过第三方集成，待确认）
- REST API 调用

**集成工具**：
- Integration Toolkit（ERP/MES 集成）
- OPC 工具包（自定义 I/O 驱动开发）
- SQL 数据访问
- Web API

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

- **最新版本**: iFIX 2023 / CIMPLICITY 2023
- **更新频率**: 约每年一个主要版本
- **2023 版本主要更新**:
  - 集成安装程序（15 分钟安装，之前需 1-3 小时）
  - MQTT 客户端支持
  - Configuration Hub Web 配置
  - Operations Hub 增强集成
  - 冗余功能增强（数据库压缩、UDP/TCP 选择）
  - 安全模式
  - 备份恢复工具
  - 报警队列从 200 扩至 10,000
- **2025 年**：iFIX 和 CIMPLICITY 持续更新，与 Operations Hub 深度集成，嵌入式 CSense 分析

### 4.2 用户基数

- **全球客户**: 20,000+ 组织（GE Vernova 官方数据）
- **行业覆盖**: 制药、水处理、电力、石油天然气、食品饮料、汽车、基础设施
- **地理分布**: 北美（核心市场）、欧洲、亚太、中东
- **安装规模**: 从单站点到数千标签的多站点大型部署

### 4.3 生态系统

**OEM 合作伙伴**：
- KEPServerEX 支持 200+ 设备驱动
- 与 Rockwell, Siemens, Schneider, Emerson 等 PLC 品牌兼容
- 通过 OPC 实现第三方软件集成

**系统集成商**：
- 全球认证系统集成商网络
- 区域分销商（如东南亚的 Allied Solutions Global）
- 专业服务团队

**培训与支持**：
- 官方培训课程
- 在线文档和帮助系统
- 专业服务团队
- 认证合作伙伴培训

### 4.4 最新发展趋势

#### 4.4.1 GE → Emerson → GE Vernova → Velotic 所有权变迁

这是 Proficy HMI/SCADA 产品历史上最重要的事件：

| 时间 | 事件 | 影响 |
|------|------|------|
| 1981 | Intellution 创立 | FIX 产品诞生 |
| 1995 | Emerson 收购 Intellution ($100M) | 产品进入 Emerson 自动化组合 |
| 2001 | GE 从 Emerson 获得该业务 | 成为 GE Fanuc 的一部分 |
| 2008 | iFIX 5.0 发布 | 重大架构更新 |
| 2010s | GE Digital 时期 | 工业互联网战略 |
| 2024 | GE 分拆，成立 GE Vernova | 软件业务并入 GE Vernova |
| 2024-2026 | GE Vernova Proficy | 品牌过渡期 |
| **2026.03** | **TPG 收购，成立 Velotic** | **最大变化——从 GE 独立** |

**2026 年 3 月关键事件**：
- 私募股权公司 TPG 从 GE Vernova 收购 Proficy 软件业务
- 同时收购 PTC 的 Kepware 和 ThingWorx 业务
- 合并成立新公司 **Velotic**（独立工业软件公司）
- Proficy 产品品牌保持不变（仍为 Proficy iFIX / Proficy CIMPLICITY）
- 产品开发和客户支持继续

**对用户的影响**：
- 现有许可和技能延续有效
- 产品开发路线图待确认（Velotic 独立运营后的策略）
- 与 KEPServerEX 的集成更紧密（同属 Velotic）

#### 4.4.2 Web 化与云化

- Proficy Operations Hub 作为现代 Web 前端
- Configuration Hub 实现浏览器端配置
- 云原生 Historian（Cloud-native OT Historian）
- 与 Azure 云集成（待确认）
- 支持容器化部署（待确认）

#### 4.4.3 IIoT 与边缘计算

- MQTT 客户端支持（2023 版本）
- 边缘设备连接
- 与 ThingWorx（同属 Velotic）的集成潜力
- 嵌入式分析（CSense）

#### 4.4.4 安全合规

- 持续增强 OT 安全功能
- 支持 FDA 21 CFR Part 11（制药合规）
- 支持 CFR21 合规（2024 版本增强）
- IEC 62443 网络安全标准支持（待确认具体认证级别）

---

## 5. 市场定位

### 5.1 主要应用行业

| 行业 | 市场地位 | 竞争产品 |
|------|---------|---------|
| 制药 | **强项**（FDA 合规、批次控制） | WinCC, FactoryTalk |
| 水处理/污水处理 | **强项**（SCADA 分布式架构） | WinCC, ClearSCADA |
| 电力/能源 | 较强 | WinCC OA, ClearSCADA |
| 石油天然气 | 中等 | WinCC OA, Citect |
| 食品饮料 | 中等 | FactoryTalk, WinCC |
| 汽车制造 | 中等 | FactoryTalk, WinCC |
| 基础设施 | 较强 | WinCC OA, ClearSCADA |

### 5.2 竞争格局对比

#### 5.2.1 vs Wonderware InTouch (Aveva)

| 维度 | Proficy iFIX | Wonderware InTouch |
|------|-------------|-------------------|
| 开发商 | GE → Velotic | Aveva (Schneider) |
| 架构 | Client/Server | Client/Server |
| 可视化 | High Performance HMI (ISA 101) | Galaxy Repository |
| 脚本 | VBA | .NET / QuickScript |
| 历史数据 | Proficy Historian | Wonderware Historian |
| 移动端 | Webspace HTML5 | InTouch Access Anywhere |
| 制药合规 | 强 | 强 |
| 市场地位 | 北美领先 | 全球分布 |

#### 5.2.2 vs Siemens WinCC

| 维度 | Proficy iFIX | Siemens WinCC |
|------|-------------|---------------|
| 开发商 | GE → Velotic | Siemens |
| 架构 | Client/Server | Client/Server |
| 集成性 | 独立 SCADA | 深度集成 TIA Portal |
| 可视化 | High Performance HMI | WinCC Unified |
| 脚本 | VBA | VBS / C# |
| 移动端 | Webspace HTML5 | WinCC Unified Web |
| 硬件绑定 | 无 | 优化 Siemens PLC |
| 市场地位 | 北美 | 欧洲/全球 |

#### 5.2.3 vs Rockwell FactoryTalk

| 维度 | Proficy iFIX | FactoryTalk |
|------|-------------|-------------|
| 开发商 | GE → Velotic | Rockwell Automation |
| 架构 | Client/Server | Site Edition / SE |
| 集成性 | 通用 | 深度集成 Logix |
| 可视化 | High Performance HMI | FactoryTalk View |
| 脚本 | VBA | VBA |
| 历史数据 | Proficy Historian | FactoryTalk Historian |
| 硬件绑定 | 无 | 优化 Allen-Bradley |
| 市场地位 | 北美 | 北美 |

#### 5.2.4 vs Emerson Movicon

| 维度 | Proficy iFIX | Emerson Movicon.NExT |
|------|-------------|---------------------|
| 开发商 | GE → Velotic | Emerson |
| 架构 | Client/Server | 模块化/可扩展 |
| 核心技术 | .NET, COM, OPC | .NET 8, Python, OPC UA |
| 跨平台 | Windows | Windows + Linux |
| 脚本 | VBA | Python |
| Web 支持 | Webspace | WebHMI |
| 归属 | Velotic（独立） | Emerson（内部） |

**有趣的关系**：Emerson 既是 Proficy iFIX 的前持有者（1995-2001），又拥有竞争产品 Movicon。Emerson 在 2001 年将 Intellution 业务交换给 GE 后，后来通过收购意大利公司 Progea 获得了 Movicon 产品线。

### 5.3 市场地位总结

- **全球 SCADA 市场**：Proficy HMI/SCADA 属于第一梯队，与 Wonderware、WinCC、FactoryTalk 并列
- **北美市场**：在制药、水处理领域有显著优势
- **欧洲市场**：份额低于 Siemens WinCC 和 Aveva 产品
- **亚太市场**：通过分销商覆盖，在特定行业有部署
- **2026 年 Velotic 独立后的影响**：待观察——独立可能带来更灵活的产品策略，也可能面临资源缩减

---

## 6. 产品特色

### 6.1 高性能 HMI（High Performance HMI）

iFIX 最标志性的特色是 High Performance HMI：

- **基于 ISA 101 标准**：业界最完整的 HMI 设计标准实现
- **异常驱动显示**：正常状态不显示（灰色/低饱和度），异常时突出
- **减少认知负荷**：操作员可快速识别异常，减少信息过载
- **预置 Dynamo 对象**：500+ ISA 标准符号，拖拽即用
- **模型化导航**：基于 Plant Model 的层级导航（概览→区域→详细）

### 6.2 开放架构（Open Architecture）

iFIX 自诞生之初就强调开放：

- **基于标准技术**：OPC、ActiveX、COM、VBA、ODBC
- **与 Office 集成**：可直接嵌入 Word/Excel 文档
- **第三方控件**：支持 ActiveX 控件嵌入
- **自定义驱动**：OPC Toolkit 可开发私有 I/O 驱动
- **大数据集成**：REST API、SQL 数据库访问

### 6.3 分布式联网能力

- **按需数据访问**：仅传输请求的数据，减少网络流量
- **去中心化处理**：SCADA 节点独立运行，不依赖中央服务器
- **报警分布**：报警事件可跨节点路由
- **网络隔离**：实时数据网络与同步网络分离

### 6.4 工业级可靠性

- **故障转移（Failover）**：主/备服务器自动切换
- **数据库同步压缩**：大标签库快速同步
- **热备**：备机实时同步，无缝切换
- **安全模式**：限制画面仅从可信位置加载

### 6.5 厂商无关性

- 支持 200+ PLC 和驱动协议
- 不绑定任何硬件厂商
- 适合混合厂商环境
- 满足工厂长期运营中更换设备的需求

### 6.6 长期产品延续性

- 自 1983 年首次发布，至今超过 40 年
- 向后兼容性（新版本可打开旧项目）
- 庞大的安装基础
- 丰富的行业知识和经验积累

---

## 7. 对 AUDESYS 的参考价值

### 7.1 HMI/SCADA 运行时架构参考

Proficy HMI/SCADA 的运行时架构为 AUDESYS Studio IDE 提供了重要参考：

| 架构特性 | Proficy 实现 | 对 AUDESYS 的参考 |
|---------|-------------|------------------|
| Client/Server 架构 | SCADA 节点 + 客户端 | AUDESYS Runtime 的分布式架构参考 |
| SAC 扫描引擎 | 数据库链执行机制 | 实时数据扫描引擎设计 |
| 按需数据访问 | 仅传输请求数据 | 网络带宽优化策略 |
| 报警管理 | 分区/路由/升级 | 工业报警系统设计 |
| 可视化引擎 | 基于向量的图形引擎 | Studio IDE 的画面引擎设计 |

### 7.2 IDE 设计参考

iFIX WorkSpace 的设计理念对 AUDESYS Studio IDE 有参考价值：

**优点**：
- 配置与运行在同一环境（WorkSpace 既是 IDE 也是运行时）
- 拖拽式开发，降低编程门槛
- 丰富的预置对象（Dynamo）
- 脚本扩展（VBA）提供灵活性

**AUDESYS 可借鉴的设计**：
- 采用"配置为主 + 脚本扩展"的开发模式
- 内置丰富的工业符号库
- 统一的项目浏览器（树形结构）
- 在线调试和变量监控

**需避免的缺陷**：
- VBA 脚本的局限性（性能、安全性）
- 配置工具分散（多个独立工具 vs 统一 IDE）
- 版本兼容性管理复杂

### 7.3 通信协议抽象层

Proficy 使用 KEPServerEX/IGS 作为统一的通信层，这一设计理念值得 AUDESYS 参考：

- **统一 OPC 层**：将所有设备协议统一为 OPC UA/DA 接口
- **驱动插件化**：新设备驱动以插件形式添加
- **协议转换**：在服务器层完成协议转换，上层应用无需关心设备细节

**对 AUDESYS HAL 的参考**：
- AUDESYS 的 HAL 抽象层可采用类似设计——统一通信接口，驱动插件化
- 与 amw（AUDESYS Middleware）的传输抽象层可类比 KEPServerEX 的角色
- 支持多种协议（OPC UA, Modbus, MQTT）的统一接入

### 7.4 可视化与 HMI 设计

iFIX 的 High Performance HMI 理念对 AUDESYS Studio 的可视化设计有直接影响：

**设计原则**：
- 异常驱动显示（Abnormal Situation Display）
- 减少视觉噪音
- 颜色语义化（灰度正常，彩色异常）
- 层级导航结构

**对 AUDESYS Studio 的参考**：
- Studio IDE 是否内置 HMI 设计器？
- 是否采用 High Performance HMI 设计原则？
- 可视化模板库如何设计？

### 7.5 报警与事件系统

iFIX 的报警系统是工业 SCADA 报警设计的标杆：

- ISA 18.2 标准合规
- 报警分区和路由
- 优先级和升级机制
- 操作员确认流程
- 审计和记录

**对 AUDESYS 的参考**：
- AUDESYS Runtime 是否需要内置报警系统？
- 报警模型如何与 HAL 的 Signal/StreamChannel 原语集成？
- 报警存储和查询策略

### 7.6 所有权变迁的教训

Proficy HMI/SCADA 经历了多次所有权变更（Intellution → Emerson → GE → GE Vernova → Velotic），这对 AUDESYS 的长期战略有参考价值：

**教训**：
1. **品牌多次变更**：FIX → FIX32 → iFIX → Proficy HMI/SCADA → GE Vernova Proficy → Velotic Proficy
2. **用户担忧**：每次所有权变更都带来用户对产品长期支持的担忧
3. **技术债务**：VBA 和 COM 技术栈已显老旧，但向后兼容性需求限制了现代化
4. **独立 vs 依附**：Velotic 独立后可能更灵活，但失去 GE 品牌背书

**对 AUDESYS 的参考**：
- 保持品牌一致性
- 核心技术栈选择需考虑长期演进
- 独立运营的商业模式设计
- 技术现代化与向后兼容的平衡

### 7.7 与 CODESYS 的互补参考

CODESYS 和 Proficy HMI/SCADA 代表工业控制领域的不同层级：

| 维度 | CODESYS | Proficy iFIX |
|------|---------|-------------|
| 层级 | 控制器层（PLC） | 监控层（SCADA/HMI） |
| 核心能力 | 逻辑控制、运动控制 | 数据采集、可视化、报警 |
| 用户 | PLC 程序员 | 操作员、工程师 |
| 开发模式 | 编程语言（IEC 61131-3） | 配置 + 脚本（VBA） |
| 与 AUDESYS 关系 | 参考 Runtime 设计 | 参考 Studio IDE 设计 |

AUDESYS 同时从两者中汲取设计灵感——CODESYS 提供底层运行时参考，Proficy 提供上层 IDE 和可视化参考。

### 7.8 对 AUDESYS Studio IDE 的具体建议

综合 Proficy HMI/SCADA 和 CODESYS 的分析，对 AUDESYS Studio IDE 的建议：

1. **统一 IDE 设计**：效仿 iFIX WorkSpace 的"配置即运行"理念，但采用现代化技术栈
2. **插件化架构**：参考 CODESYS 的插件系统和 iFIX 的 ActiveX 集成
3. **脚本引擎**：选择现代脚本语言（如 Python/Lua）替代 VBA
4. **可视化内置**：内置 HMI 设计器，支持 High Performance HMI 原则
5. **通信抽象层**：统一 OPC UA 连接，支持多种工业协议
6. **Web 支持**：原生支持 Web 部署，借鉴 Operations Hub 和 WebVisu
7. **开放标准**：基于 OPC UA、MQTT、REST API 等开放标准

---

*文档生成日期：2026-07-13*
*信息来源：GE Vernova 产品页面、iFIX 技术文档、行业分析报告、第三方对比文章*
*标注"待确认"的信息需进一步验证*

**说明**：本文档主要涵盖 GE Vernova Proficy HMI/SCADA 产品线（iFIX + CIMPLICITY）。"Qtouch" 名称可能指代以下产品之一：
1. GE Proficy HMI/SCADA 家族（本文档主要覆盖对象）
2. 武汉舜通智能的 QTouch 跨平台组态 SCADA 软件（基于 Qt 技术栈，面向国产化替代市场）
3. 与 Emerson 的 Movicon 产品线可能存在混淆

如需补充武汉舜通 QTouch 或 Emerson Movicon 的详细分析，请另行指示。

### 7.9 补充参考：武汉舜通 QTouch 跨平台组态软件

作为补充参考，武汉舜通智能科技有限公司的 QTouch 组态软件与 AUDESYS 的相关性值得关注：

**产品定位**：
- 面向跨平台、自主可控、云网端边、人工智能的工业 SCADA 软件
- 支持国产芯片（龙芯/飞腾/兆芯/鲲鹏/申威）和国产操作系统
- 采用 Qt 跨平台技术栈，实现一次编程多平台适配

**技术特点**：
- 基于 IEC 61131-3 标准的 SoftPLC（梯形图编程）
- C 语言编辑编译系统（嵌入式逻辑处理）
- 四维一体架构：云、网、端、边
- 丰富的协议库和边缘计算能力
- 支持嵌入式设备部署
- 支持 JS 脚本开发环境

**对 AUDESYS 的参考价值**：
- 国产化替代策略：QTouch 的国产芯片适配路线可参考
- 跨平台技术选型：Qt 作为跨平台 UI 框架的可行性验证
- 云端一体化设计：云网端边的架构设计思路
- 在军工、国网、研究院等行业的应用经验
- 将 IEC 61131-3 与 C 语言混合编程的模式

---

## 附录

### A. 版本历史概要

| 版本 | 时间 | 主要变化 |
|------|------|---------|
| FIX (The FIX) | 1983-84 | 首个 PC 版 HMI/SCADA，MS-DOS
| FIX DMACS | 1989 | 更名为 Distributed Manufacturing ACS
| FIX Hawaii | 1995 | 全新 GUI，Windows 原生
| FIX32 | 1996+ | 32 位 Windows 版本
| iFIX | 2000+ | 更名 iFIX，.NET 集成
| iFIX 5.0 | 2008 | Ribbon Bar UI，Historian 集成
| iFIX 2023 | 2023 | MQTT, Configuration Hub, 集成安装
| CIMPLICITY 2023 | 2023 | Active Update, 性能增强
| Velotic 时代 | 2026.03 | TPG 收购，独立运营

### B. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| SCADA | Supervisory Control and Data Acquisition | 监控和数据采集系统
| HMI | Human-Machine Interface | 人机界面
| SAC | Scan, Alarm, and Control | iFIX 核心扫描程序
| IGS | Industrial Gateway Server | 工业网关服务器
| OPC UA | Open Platform Communications Unified Architecture | 工业通信标准
| Dynamo | — | iFIX 预置图形对象
| Historian | — | 时序数据历史记录系统
| Failover | — | 故障转移/冗余切换
| ISA 101 | — | HMI 设计标准
| ISA 18.2 | — | 报警管理标准
| Webspace | — | HTML5 远程客户端
| Operations Hub | — | Web 低代码应用平台
| VBA | Visual Basic for Applications | 脚本语言
| Velotic | — | 2026 年成立的独立工业软件公司

### C. 参考链接

- GE Vernova Proficy: https://www.gevernova.com/software/products/proficy
- iFIX 文档: https://www.gevernova.com/software/documentation/ifix
- Velotic 介绍: https://www.velotic.com（待确认）
- Emerson Movicon: https://www.emerson.com/movicon
- 武汉舜通 QTouch: http://qtouchtech.com

### D. 文档版本信息

- 文档版本: 1.0
- 生成日期: 2026-07-13
- 作者: researcher-ide (AUDESYS Team)
- 审核状态: 草稿