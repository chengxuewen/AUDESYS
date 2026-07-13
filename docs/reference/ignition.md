# Ignition SCADA (Inductive Automation)

## 1. 产品画像

### 1.1 基本信息

- **产品全称**: Ignition SCADA / Ignition Platform（由 Inductive Automation 开发）
- **开发商**: Inductive Automation, LLC
- **总部**: Folsom, California, USA（福尔瑟姆，加利福尼亚州，美国）
- **成立时间**: 2003 年
- **创始人**: Steve Hechtman（CEO，创始人）
- **核心人物**: Carl Gould（CTO，首席技术官），Colby Clegg（CEO，2018 年起），Travis Cox（Co-Director of Sales Engineering）
- **公司性质**: 私营企业（未上市，员工持股）
- **员工规模**: 约 300-400 人（待确认，持续增长中）
- **Ignition 首次发布**: 2010 年（Ignition 7.x 为第一个商业版本系列）
- **当前版本**: Ignition 8.3（2024 年发布）
- **官方网站**: https://inductiveautomation.com
- **用户社区**: https://forum.inductiveautomation.com

### 1.2 产品定位与核心价值主张

Ignition 的定位是**新一代工业应用平台（Industrial Application Platform）**，其核心价值主张彻底颠覆了传统 SCADA 行业：

- **无限许可模型（Unlimited Licensing Model）**：按服务器授权，不限客户端数、标签（Tag）数、项目数。只需一个服务器许可证，所有客户端自动包含——与传统的按点数/按客户端计费模式形成根本性对立。
- **Web 原生架构（Web-Native Architecture）**：Ignition 本质上是一个 Web 服务器平台，所有工程和运行时功能通过浏览器交付。设计师和操作员无需安装任何客户端软件。
- **跨平台部署**：Gateway 支持 Linux、Windows、macOS，打破了传统 SCADA 对 Windows 的依赖。
- **模块化平台**：核心平台免费试用，按需购买模块（Modular），从边缘到企业全场景覆盖。
- **开放标准优先**：原生支持 OPC UA、MQTT（Sparkplug）、SQL 数据库、REST API，拥抱 IT/OT 融合。

Ignition 的商业口号是 "The New SCADA"（新 SCADA），旨在用现代互联网架构替代 1990 年代遗留下来的传统 SCADA 产品（如 Wonderware、iFIX、WinCC）。

### 1.3 目标用户群体

| 用户群体 | 典型需求 | Ignition 优势 |
|---------|---------|-------------|
| 大型企业/工厂 | 大规模 SCADA，多站点集中管理，与 MES/ERP 集成 | 无限许可 + 企业级架构（Hub and Spoke、Scale-Out） |
| 系统集成商 | 快速交付项目，多项目复用，预算是关键约束 | 无许可成本压力，模板和项目复用 |
| 中小型企业 | 低成本入门的 SCADA 系统 | Ignition Edge 面对小型场景，Ignition Maker Edition 免费 |
| OEM 设备制造商 | 嵌入设备端的可视化/HMI | Ignition Edge 嵌入式部署 |
| IIoT/数字化转型团队 | MQTT 数据采集，边缘计算，云端集成 | MQTT Engine + Distributor + Cloud Edition |
| 食品饮料/制药/水处理 | FDA 合规，审计追踪，批量报告 | 电子签名、审计日志、配方管理 |
| 油气/能源 | 大规模地理分布站点监控 | Hub and Spoke 架构 + 冗余 |

### 1.4 商业许可模型

Ignition 采用**按服务器许可、无限客户端/标签/项目**的模型，这是其最显著的市场差异点：

#### 许可等级

| 产品层级 | 许可模式 | 适用场景 |
|---------|---------|---------|
| **Ignition Platform** | 一次性购买（永久许可） | 核心平台，所有模块的底座 |
| **Ignition Edge** | 一次性购买（永久许可） | 边缘设备（功能受限：单项目、单 Tag Provider、无数据库直连） |
| **Ignition Cloud Edition** | 按使用量计费（持续付费） | 云端部署场景 |
| **Ignition Maker Edition** | 免费 | 个人/教育/原型/非商业使用 |

#### Solution Suites（解决方案套件）

Ignition 8.3 将模块打包为五个 Solution Suites：

| 套件名称 | 包含模块 | 核心功能 |
|---------|---------|---------|
| **Application Building Suite** | Perspective + Reporting | 移动响应式 HMI/SCADA + 报表 |
| **Industrial Historian Suite** | Historian + SQL Historian | 高性能时序数据存储 |
| **Enterprise Integration Suite** | MongoDB, Kafka, MQTT Transmission, MQTT Engine | 企业数据集成与 IIoT |
| **Alarm Management Suite** | Alarm Notification + Voice + SMS + Twilio | 高级报警通知 |
| **DataOps Suite** | SQL Bridge + Web Development + Event Streams | 数据编排与自定义 Web |

#### 价格参考

- **Ignition Platform Base**: 约 $10,000 - $20,000（一次性，待确认，实际价格需询价）
- **Solution Suites**: 每个套件约 $5,000 - $15,000（待确认）
- **Individual Modules**: 约 $1,000 - $5,000 每个（待确认）
- **Ignition Edge**: 约 $1,500 - $3,000（待确认）
- **Support Plan**（含 Upgrade Protection）: 许可费的 15%-20%/年（待确认）
- **Upgrade Protection**: 如果购买了 Support Plan，套件中新增模块自动免费包含

> **关键价格策略**：与传统 SCADA 相比，大型项目可节省 50%-80% 的许可成本。例如：传统 SCADA 5000 点 + 10 客户端的项目许可费可能 $50,000-$100,000，Ignition 仅需 $10,000-$30,000（取决于模块选择）。

#### 许可管理

- 六位数字许可证密钥，通过 Gateway 网页界面在线激活
- 可随时取消激活并将许可证转移到其他 Gateway
- 30 天全功能试用期（可重置两次）
- Ignition Edge 内置 35 天本地数据缓存

---

## 2. 技术特性

### 2.1 核心架构

Ignition 采用**三层架构**，以 Gateway 为核心通信枢纽：

```
┌────────────────────────────────────────────────────────┐
│                    客户层（Client Tier）                   │
│  ┌──────────────┬──────────────┬──────────────────┐    │
│  │ Vision       │ Perspective  │ 第三方（REST/WS）  │    │
│  │ (Java Swing) │ (HTML5/React)│                  │    │
│  │ 桌面客户端   │ Web/移动浏览  │ 自定义应用/API    │    │
│  └──────────────┴──────────────┴──────────────────┘    │
├────────────────────────────────────────────────────────┤
│                  Gateway 层（Gateway Tier）               │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Ignition Gateway (Java)              │  │
│  │  ┌─────────┬─────────┬──────────┬────────────┐  │  │
│  │  │Web Server│Tag Engine│Scripting │Alarm Engine│  │  │
│  │  ├─────────┼─────────┼──────────┼────────────┤  │  │
│  │  │History  │Report Engine│Security│Redundancy│  │  │
│  │  ├─────────┴─────────┴──────────┴────────────┤  │  │
│  │  │          Module Framework (OSGi)           │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
├────────────────────────────────────────────────────────┤
│                    数据层（Data Tier）                     │
│  ┌──────┬────────┬───────┬───────┬──────┬─────────┐    │
│  │ OPC UA│Modbus │MQTT   │SQL DB │Siemens│Allen-  │    │
│  │       │       │       │       │ S7    │Bradley  │    │
│  └──────┴────────┴───────┴───────┴──────┴─────────┘    │
└────────────────────────────────────────────────────────┘
```

#### 2.1.1 Gateway（核心服务）

Gateway 是 Ignition 的心脏——一个基于 Java 的服务器进程，负责：

- **Web 服务器**：内置 Jetty/Tomcat（待确认），提供 HTTPS 访问、Session 管理
- **Tag 引擎**：实时数据引擎，管理所有 Tag（支持 OPC UA、MQTT、Expression、Memory 等多种 Tag Provider）
- **脚本引擎**：Jython（Java 上的 Python 2.7 实现）用于服务端脚本
- **报警引擎**：基于 ISA 18.2 的报警管理，支持报警管道（Alarm Pipeline）
- **历史记录引擎**：将时序数据写入 SQL 数据库或 Ignition Historian 专用引擎
- **报表引擎**：基于 JasperReports 的报表生成
- **安全模型**：用户认证、角色/安全级别、项目级访问控制
- **冗余**：支持主备冗余（Active-Standby）

Gateway 进程特点：
- Java 11+ 运行（8.3 版本）
- 内存占用：典型 2-8 GB（取决于模块和 Tag 量）
- 可通过 G1GC 优化大堆内存
- 支持双网卡（Dual-NIC），可桥接企业网和控制网

#### 2.1.2 Designer（工程环境）

Designer 是一个**跨平台桌面 IDE**（基于 Java/Swing 或 Eclipse RCP 框架），通过浏览器启动（Java Web Start 或直接下载）：

- 项目树管理所有资源（窗口、模板、脚本、报表、事务组等）
- Tag Browser 浏览和编辑所有 Tag
- Vision Designer：传统桌面 HMI 画面设计器
- Perspective Designer：Web/移动 HMI 画面设计器（自 8.1 版本起在浏览器内运行）
- Transaction Group Designer：数据采集和转发配置
- Scripting Console：交互式 Python 脚本开发
- Gateway Web 界面中也内置了简化版 Perspective Designer

#### 2.1.3 Vision Module（桌面 HMI）

Vision 是 Ignition 的**传统桌面 HMI 模块**，基于 Java Swing 渲染：

- 启动方式：通过 Gateway 网页点击启动（Java Web Start）或本地安装客户端
- 渲染引擎：Java 2D（Swing），硬件加速有限
- 组件库：按钮、标签、图表、表格、报警组件、趋势图等 100+ 标准组件
- 窗口管理：支持弹出窗口、停靠窗口（Docked Windows）、多显示器
- 模板系统：可创建可复用的窗口模板
- 数据绑定：直接绑定到 Gateway Tag（Property Binding）
- 脚本：Python 事件脚本（ActionPerformed、PropertyChange 等）
- 限制：非移动响应式，依赖 Java 运行时，现代化程度低于 Perspective

#### 2.1.4 Perspective Module（Web/移动 HMI）

Perspective 是 Ignition 的**新一代 Web 原生 HMI 模块**（2019 年引入 Ignition 8.0），代表了 Ignition 的未来方向：

- **技术栈**：前端基于 React/TypeScript（推测），后端通过 WebSocket 与 Gateway 实时通信
- **设计方式**：完全在浏览器中进行画面设计（Perspective Designer 是 Web 应用），无需安装桌面软件
- **响应式布局**：支持 Flexbox 和 CSS Grid 布局，一套设计适配手机、平板、桌面
- **Session 管理**：每个浏览器 Tab/移动端连接为一个 Session，Session 有独立的生命周期和属性
- **视图（View）与容器（Container）**：
  - View 是基本设计单元（一个 HMI 画面）
  - Container 负责子组件的布局（Coordinate、Flex、Breakpoint、Column 等）
- **组件系统**：按钮、文本、图表、仪表、地图、报警表格、二维码扫描器等 200+ 内置组件
- **数据绑定**：双向绑定、转换（Transform）、表达式绑定
- **脚本**：支持 Python 事件脚本（服务端执行）和客户端脚本（JavaScript，有限）
- **原生移动功能**：摄像头扫描、GPS 定位、推送通知
- **离线模式**：支持断网时本地缓存运行
- **Power Chart**：高性能时序图表组件，支持百万级数据点渲染

Perspective 模块对比 Vision 模块：

| 特性 | Vision | Perspective |
|------|--------|------------|
| 渲染技术 | Java Swing | HTML5/React |
| 设计器 | 桌面应用 | 浏览器 |
| 移动端 | 不支持 | 原生支持（响应式） |
| 组件数量 | 100+ | 200+ |
| 性能 | 中等（单线程 Swing） | 高（WebWorker + Canvas） |
| 部署 | 需安装 JRE | 零安装（浏览器即可） |
| 离线支持 | 不支持 | 支持 |
| 未来方向 | 维护模式 | 主力发展 |

### 2.2 数据采集与通信

#### 2.2.1 Tag Provider 架构

Ignition 的 Tag 系统采用**Provider 模式**，每个数据源作为一个 Tag Provider：

| Tag Provider | 描述 | 协议 |
|-------------|------|------|
| **OPC UA** | 内置 OPC UA Client，连接任意 OPC UA Server | OPC UA TCP |
| **MQTT Engine** | 订阅 MQTT Sparkplug 消息，自动生成 Tag | MQTT Sparkplug |
| **Modbus** | Modbus TCP/RTU 设备驱动 | Modbus |
| **Siemens** | 直接连接 Siemens S7 系列 PLC | S7 Protocol |
| **Allen-Bradley** | 直接连接 Rockwell Logix 系列 PLC | EtherNet/IP, CSP |
| **SQL Bridge** | 从 SQL 数据库读写数据 | JDBC |
| **Memory** | 内存 Tag（无外部数据源） | 无 |
| **Expression** | 基于其他 Tag 的表达式计算 Tag | 无 |
| **Web API (WebDev)** | REST API 数据源 | HTTP/HTTPS |
| **OPC DA** | 遗留 OPC DA Server 连接（Windows only） | DCOM |
| **BACnet** | 楼宇自动化协议（第三方模块或内置，待确认） | BACnet/IP |

#### 2.2.2 MQTT 优先的 IIoT 架构

Ignition 是首个将 MQTT Sparkplug 作为**一等公民（First-Class Citizen）**的商业 SCADA 平台：

- **MQTT Engine**：订阅 MQTT 主题（Sparkplug 格式），自动发现设备、创建 Tag、建立数据流——无需手动配置
- **MQTT Distributor**：将 Ignition 内部 Tag 数据发布为 MQTT Sparkplug 消息
- **MQTT Transmission**：高级 MQTT 发布引擎，支持自定义负载格式
- 与 Cirrus Link Solutions 合作开发 MQTT 模块

MQTT Engine 的自动 Tag 创建流程：
```
MQTT Broker ──Sparkplug──> MQTT Engine ──自动创建Tag──> Tag Engine
   │                            │
   │  设备上线消息              │  自动发现：
   │  (NBIRTH/DBIRTH)          │  - Group ID → Tag Folder
   │                           │  - Edge Node ID → UDT Instance
   │  数据消息                  │  - Metric → Tag
   │  (NDATA/DDATA)            │
```

#### 2.2.3 OPC UA 集成

Ignition 内置完整的 OPC UA 协议栈：

- **OPC UA Client**：连接任何 OPC UA Server，支持 Data Access、Alarms & Conditions、Historical Access
- **OPC UA Server**：暴露 Ignition Tag 为 OPC UA 地址空间，供第三方客户端访问
- 支持安全策略：None、Basic128Rsa15、Basic256、Basic256Sha256、Aes128Sha256RsaOaep、Aes256Sha256RsaPss
- 支持用户认证：匿名、用户名/密码、证书

### 2.3 脚本与表达式引擎

#### Python 脚本（Jython）

Ignition 使用 **Jython**（Java 平台上的 Python 2.7 实现）作为脚本语言：

- **Gateway 脚本**：在 Gateway 启动时或定时执行，用于后台任务
- **Client 脚本**：在客户端事件触发时执行（按钮点击、Tag 变化、窗口打开等）
- **Tag 事件脚本**：Tag 值变化时触发的脚本
- **报警管道脚本**：在报警处理流程中自定义逻辑
- **Transaction Group 脚本**：数据采集/转发时执行

Python 脚本可访问：
- `system` 库：Ignition 核心 API（Tag 读写、数据库操作、报警管理等）
- Java 类库：通过 Jython 可直接调用 Java API
- 第三方 JAR：可导入自定义 Java 库

#### 表达式语言

Expression Tag 使用简化的表达式语法进行数据计算：

```
// Expression Tag 示例
{tag1} + {tag2} * 1.5
if({temperature} > 100, "HIGH", "OK")
```

#### SQL 集成

Ignition 提供一等公民的 SQL 数据库集成：
- **SQL Bridge**：双向数据同步（Tag ↔ SQL）
- **Transaction Groups**：将 Tag 数据周期性地写入 SQL 数据库
- **Named Queries**：预定义 SQL 查询，可参数化，从任意模块调用
- **数据库连接池**：支持 MySQL、PostgreSQL、SQL Server、Oracle、MariaDB、SQLite 等

### 2.4 安全模型

Ignition 8.3 引入了升级的安全架构：

#### 认证（Authentication）

- **本地用户**：Gateway 内置的用户管理
- **Active Directory / LDAP**：企业级目录服务集成
- **联合身份（Federated Identity）**：SAML、OAuth 2.0、OpenID Connect（支持 Okta、Azure AD、Google 等）
- **双因素认证（2FA）**：通过身份提供商（IdP）支持

#### 授权（Authorization）

- **安全级别（Security Levels）**：替代传统的角色模型，采用层级继承
  - 示例：`Operator/LineB` 的用户自动继承 `Operator` 级别的权限
- **项目级访问控制**：不同用户/角色可访问不同项目
- **组件级安全**：单个 UI 组件可设置可见性/可操作性权限
- **Tag 级安全**：Tag 的读/写权限
- **源 IP 限制**：基于网络位置的访问控制

#### 通信安全

- **TLS/SSL**：Perspective 客户端使用 HTTPS + WSS（WebSocket Secure）
- **OPC UA 安全**：支持 Sign & Encrypt
- **Guest 模式**：未登录用户仅具有受限访问权限（强制 Guest 模式以防止未授权写入）

### 2.5 可扩展性架构

Ignition 提供多种企业级部署架构：

| 架构模式 | 描述 | 典型场景 |
|---------|------|---------|
| **Basic** | 单 Gateway | 小到中型工厂 |
| **Scale-Out** | 多 Gateway 集群（水平扩展） | 高并发客户端访问（数千客户端） |
| **Hub and Spoke** | 中心 Gateway + 远程边缘 Gateway | 多站点地理分布（油气田、水务网络） |
| **Enterprise** | 多层级 Gateway（工厂级 → 区域级 → 企业级） | 大型跨国企业 |
| **Cloud-Based** | Gateway 部署在云中（AWS/Azure/GCP） | 纯云/混合云场景 |

Scale-Out 架构通过**前端负载均衡 Gateway + 后端 Worker Gateway** 模式实现：
```
           ┌─────────────┐
           │  Load       │
           │  Balancer   │
           └──────┬──────┘
      ┌───────────┼───────────┐
┌─────┴─────┐┌────┴─────┐┌────┴─────┐
│ Front-end ││ Front-end││ Front-end│
│ Gateway 1 ││ Gateway 2││ Gateway 3│
└─────┬─────┘└────┬─────┘└────┬─────┘
      └───────────┼───────────┘
         ┌────────┴────────┐
    ┌────┴────┐      ┌────┴────┐
    │ Backend │      │ Backend │
    │ Gateway │      │ Gateway │
    │ (Data)  │      │ (Data)  │
    └─────────┘      └─────────┘
```

### 2.6 Web 启动技术

Ignition 最独特的技术之一是**Web 启动（Web-Launch）机制**：

- 用户打开浏览器访问 Gateway URL（例如 `http://gateway:8088`）
- 登录后，Vision 客户端通过 **Java Web Start**（JNLP）从 Gateway 自动下载启动
- Perspective 客户端直接在浏览器中渲染（纯 Web 应用）
- 客户端无需手动安装软件，Gateway 管理版本更新
- 客户端启动后通过高速二进制协议（或 WebSocket）与 Gateway 通信

---

## 3. 功能概览

### 3.1 可视化（Visualization）

| 功能 | Vision（桌面） | Perspective（Web/移动） |
|------|--------------|----------------------|
| 画面设计 | 桌面 Designer（Swing） | 浏览器 Designer |
| 组件库 | 100+ 标准组件 | 200+ 组件 |
| 图表 | Easy Chart（基础图表） | Power Chart（高性能时序图） |
| 仪表 | 多种仪表组件 | 现代仪表组件 |
| 表格 | Table、Power Table | Table、Flex Repeater |
| 地图 | 不支持 | 内置地图组件（Map） |
| 3D | 不支持 | 第三方支持或规划中 |
| 动画 | 支持颜色/位置/尺寸动画 | 支持 CSS 动画 |
| 多语言 | 支持翻译 | 内置 i18n |
| 模板 | 窗口模板 | 视图模板 + UDT |

### 3.2 报警管理（Alarm Management）

基于 ISA 18.2 标准：

- **报警定义**：基于 Tag 的阈值报警（高/低/高高/低低/偏差/变化率）
- **报警管道（Alarm Pipeline）**：可配置的处理流程（过滤 → 分级 → 通知 → 存储）
- **报警通知**：Email、SMS、语音电话（通过 Alarm Notification Suite）、Teams/Slack（Webhook）
- **报警确认**：支持确认注释、电子签名
- **报警归档**：自动将报警历史存入 SQL 数据库
- **Shelving**：临时搁置报警（按时间或永久）
- **报警分组**：按区域、设备、优先级组织

### 3.3 趋势与历史记录（Trending & Historian）

| 组件 | 描述 |
|------|------|
| **SQL Historian** | 将 Tag 数据存入标准 SQL 数据库（MySQL/PostgreSQL/SQL Server） |
| **Ignition Historian** | 专用高性能时序数据库引擎（比 SQL Historian 快 10-100 倍） |
| **数据压缩** | 死区压缩（Deadband）+ 旋转门压缩（Swinging Door） |
| **数据回填** | 断网时缓存数据，恢复后回填 |
| **Power Chart** | 客户端高性能图表，支持百万点渲染、缩放、平移 |
| **Easy Chart** | 基础趋势图（Vision 下使用） |

### 3.4 报表（Reporting）

- 基于 JasperReports 引擎（开源 Java 报表工具）
- 支持 PDF、Excel、HTML、CSV 输出
- 按日程自动生成和发送（Email）
- 参数化报表（用户输入参数后生成）
- 支持子报表（Subreport）

### 3.5 配方管理（Recipe Management）

- 配方定义：一组 Tag 值的集合
- 配方存储：SQL 数据库
- 配方操作：下载（Write to PLC）、上传（Read from PLC）、比较
- 配方安全：可电子签名确认

### 3.6 用户与角色管理

- 本地用户 + Active Directory/LDAP + Federated Identity
- 安全级别系统（层级继承）
- 用户源（User Source）支持多种身份提供商混合使用

### 3.7 冗余（Redundancy）

- 主备冗余（Active-Standby）
- 心跳监测 + 自动故障切换
- 历史数据同步
- 需要两个许可证（主节点 + 备份节点）

### 3.8 多语言支持

- Vision：通过 Translation Manager 管理翻译文本
- Perspective：内置 i18n 框架，支持动态语言切换
- 翻译文件格式：JSON 键值对

### 3.9 其他模块

| 模块 | 功能 |
|------|------|
| **OEE (Overall Equipment Effectiveness)** | 设备综合效率计算和看板 |
| **SPC (Statistical Process Control)** | 统计过程控制图表 |
| **Enterprise Administration** | 集中管理多个 Gateway 的 EAM 控制器 |
| **Web Development** | 使用 Python (Flask-like) 开发自定义 Web 页面 |
| **Event Streams** | 事件驱动数据管道 |
| **Kafka** | Apache Kafka 集成（消费和发布） |
| **MongoDB** | MongoDB 数据库集成 |
| **SMS Notification** | 通过 GSM Modem 发送 SMS |
| **Twilio Notification** | 通过 Twilio 云服务发送 SMS/语音 |
| **Voice Notification** | 电话语音通知 |

---

## 4. 现状与生态

### 4.1 当前版本

| 产品 | 版本 | 状态 |
|------|------|------|
| Ignition Platform | 8.3 | 主流版本 |
| Ignition Edge | 8.3 | 活跃开发 |
| Ignition Maker Edition | 8.x | 活跃（免费版） |
| Ignition Cloud Edition | 8.x | AWS/Azure/GCP 可用 |

### 4.2 版本历史

| 版本 | 发布时间 | 关键里程碑 |
|------|---------|-----------|
| Ignition 7.x | 2010 | 首个商业发布，引入 Web-Launch、无限许可 |
| Ignition 7.5 | 2012 | 引入 Vision Module |
| Ignition 7.7 | 2014 | 引入 OPC UA |
| Ignition 7.8 | 2016 | 引入 MQTT Module（与 Cirrus Link 合作） |
| Ignition 7.9 | 2016 | 引入 Perspective Module（Beta） |
| Ignition 8.0 | 2019 | **Perspective 正式发布**——移动响应式 HTML5 SCADA |
| Ignition 8.1 | 2021 | Perspective Designer 在浏览器中运行，架构升级 |
| Ignition 8.3 | 2024 | Solution Suites，安全升级（SAML/OAuth/OpenID），Power Chart 优化 |

### 4.3 安装量

- 全球 100+ 国家有部署（待确认）
- 系统集成商认证网络：3,000+ 认证集成商（Integrator Program）
- 下载量：超过 10 万次下载（待确认）
- 客户案例涵盖：Amazon、Tesla、Coca-Cola、Shell、Heineken 等（公开案例）

### 4.4 社区与生态

| 生态组件 | 描述 |
|---------|------|
| **Ignition Forum** | 活跃的技术社区（forum.inductiveautomation.com），数万注册用户 |
| **Inductive University (IU)** | 免费在线培训平台，200+ 视频课程，含认证考试 |
| **Integrator Program** | 三级认证体系（Registered → Certified → Premier），全球 3,000+ 家公司 |
| **Ignition Exchange** | 社区模块和资源共享平台 |
| **Ignition Community Conference (ICC)** | 年度大会（Folsom, CA），全球用户和集成商参与 |
| **Third-Party Modules** | Sepasoft (MES/OEE), Cirrus Link (MQTT), EAM, Kymera 等 |
| **GitHub** | 开源 Python 脚本库和工具 |

### 4.5 支持的平台

| 平台 | Gateway | Designer | Vision Client | Perspective Client |
|------|---------|----------|---------------|-------------------|
| Windows | ✓ | ✓ | ✓ | ✓ |
| Linux | ✓ | ✓ | ✓ | ✓ |
| macOS | ✓ | ✓ (有限) | ✓ | ✓ |
| Docker | ✓ | ✗ | ✗ | ✓ |
| iOS | ✗ | ✗ | ✗ | ✓ (浏览器) |
| Android | ✗ | ✗ | ✗ | ✓ (浏览器) |
| Raspberry Pi | ✓ (Arm Linux) | ✗ | ✗ | ✓ (浏览器) |

### 4.6 竞品对比

| 维度 | Ignition | Wonderware (AVEVA) | iFIX (GE) | WinCC (Siemens) | VTScada (Trihedral) |
|------|---------|-------------------|-----------|----------------|---------------------|
| 许可模型 | 按服务器（无限） | 按 Tag 数 | 按 Tag 数 | 按 Tag 数 | 按 Tag 数 |
| Web 原生 | 是 | 部分 | 有限 | 有限 | 是 |
| 平台 | Linux/Win/macOS | Windows | Windows | Windows | Windows |
| 脚本语言 | Python (Jython) | VBScript/.NET | VBA | VBScript/C# | 自有脚本 |
| MQTT 支持 | 一等公民 | 有限 | 有限 | 有限 | 不支持 |
| 移动端 | 原生响应式 | Web 客户端 | 有限 | 有限 | Web 客户端 |
| 入门成本 | 中等 | 高 | 高 | 高 | 中等 |
| 大型项目成本 | 低 | 很高 | 很高 | 很高 | 中等 |

---

## 5. 市场定位

### 5.1 目标行业

| 行业 | 典型应用 |
|------|---------|
| 食品饮料 | 产线监控、批次管理、FDA 合规 |
| 制药 | 21 CFR Part 11 合规、审计追踪、批次报告 |
| 水处理/污水处理 | 多站点远程监控（Hub and Spoke） |
| 油气 | 井口监控、管道 SCADA、地理分布站点 |
| 能源/电力 | 变电站监控、可再生能源管理 |
| 汽车制造 | MES 集成、产线可视化 |
| 包装 | 产线 OEE、SPC |
| 楼宇自动化 | 能源管理、HVAC 控制 |
| IIoT/数字化转型 | MQTT 数据采集、边缘到云数据管道 |

### 5.2 市场地位

- 北美市场：增长最快的 SCADA 平台之一
- 被 Gartner、ARC Advisory Group、Frost & Sullivan 认可
- 相比传统 SCADA 厂商（AVEVA/GE/Siemens），价格和架构优势明显
- 在 MQTT/IIoT 领域是行业领先者

### 5.3 价格层

- **入门级（Ignition Edge）**：$1,500 - $3,000
- **中端（Platform + 1-2 Suites）**：$15,000 - $40,000
- **企业级（全模块 + 冗余）**：$50,000 - $100,000+
- 对比传统 SCADA 同类配置，可节省 50%-80%

### 5.4 地域分布

- **主要市场**：北美（美国、加拿大）
- **增长市场**：欧洲、澳大利亚、南美
- **亚洲市场**：相对较新，通过合作伙伴拓展

### 5.5 核心竞争力

1. **无限许可**：消除了传统 SCADA 的成本焦虑
2. **Web 原生**：跨平台、零安装客户端
3. **IT/OT 融合**：MQTT、SQL、REST、Kafka 一等公民
4. **Python 脚本**：降低工程学习成本
5. **模块化**：从边缘到企业，按需购买

---

## 6. 产品特色

### 6.1 无限许可模型——颠覆性的商业模式

Ignition 的无限许可模型是整个产品最核心的差异化因素。传统的 SCADA 产品按"点数 × 客户端数"收费，导致：
- 扩大系统需要不断增加许可费用
- 项目经理在规划时需要精确估算点数（往往导致过度采购或不足）
- 集成商在报价中许可费占比偏高，压缩利润

Ignition 打破了这个模型：
- 一个服务器许可 = 无限 Tag + 无限客户端 + 无限项目
- 集成商可一次购买，无限复用
- 甲方可自由扩展系统而无需额外许可成本

这不仅是价格策略，更是**架构信任的建立**——Inductive Automation 用"无限"表达了对其平台扩展性的信心。

### 6.2 Web-Launch 技术——免安装部署

Ignition 的 Web 启动机制解决了工业 IT 环境中最头疼的问题之一：客户端软件部署和维护。

传统 SCADA：每个操作员站安装 View 客户端 → 升级时逐台更新 → 版本不一致导致问题。

Ignition：所有客户端从 Gateway 启动 → 升级 Gateway 即升级所有客户端 → 版本一致性保证。

### 6.3 Perspective——移动优先的 SCADA

2019 年 Perspective 的发布标志着 SCADA 行业的转折点：

- **首次**将移动响应式设计带入工业 SCADA
- 同一套画面在手机、平板、桌面自适应显示
- 设计师在浏览器中设计（类似 Figma 的工作流）
- Session 概念将传统的"窗口"升级为现代的"会话"

Perspective 在工业界的意义类似于 React Native 对移动开发的影响——用 Web 技术栈提供接近原生的体验。

### 6.4 MQTT Sparkplug 优先

Ignition 是最早将 MQTT Sparkplug 作为核心数据协议的商业 SCADA 平台。这一决策与 Ignition 的架构哲学一致：

- **去中心化**：MQTT 天然支持发布/订阅，无单点故障
- **自动发现**：Sparkplug 允许自动发现设备和 Tag，减少工程配置
- **报告采集（Report by Exception）**：减少带宽消耗
- **状态感知**：Sparkplug 的 Birth/Death 证书机制提供设备在线状态

### 6.5 Gateway 中心化架构

Ignition 将所有智能集中在 Gateway，客户端是"哑终端"：
- 所有数据采集在 Gateway 完成（而非客户端）
- 客户端通过二进制协议接收数据（而非各自采集）
- 统一的安全策略和审计日志

这种架构使 Ignition 天然适合云部署和多层级架构。

### 6.6 Inductive University——免费教育生态

IU 提供 200+ 小时免费视频培训，含认证考试。这降低了 Ignition 的学习门槛，同时建立了用户锁定效应——学会 Ignition 的工程师更容易推荐 Ignition。

---

## 7. 对 AUDESYS 的参考价值

### 7.1 Web 原生 HMI 架构设计

Ignition Perspective 是 AUDESYS Studio IDE 的 Web 化战略**最直接的参考对象**：

| Ignition Perspective 设计 | AUDESYS Studio 参考点 |
|--------------------------|---------------------|
| 浏览器内设计器（Browser-Based Designer） | AUDESYS Studio 是否应提供完全在浏览器中运行的 HMI 设计器？ |
| React + WebSocket 实时通信 | AUDESYS 前端技术栈选择（React/Vue/Svelte + WebSocket） |
| 响应式布局（Flexbox/CSS Grid） | AUDESYS HMI 编辑器布局引擎设计 |
| Session 管理 | AUDESYS Runtime 的客户端会话模型 |
| 离线模式支持 | AUDESYS Runtime 的离线缓存策略 |

**关键设计决策**：AUDESYS Studio 应优先做 **Web 优先** 还是**桌面优先**？
- Ignition 的经验：Vision（桌面）→ Perspective（Web），两条产品线并存使维护成本翻倍
- AUDESYS 如果从零开始，应考虑**Web 优先**，桌面版通过 Electron 封装

### 7.2 无限许可模型的启示

Ignition 的无限许可模型对 AUDESYS 的商业化路径有直接参考：

| Ignition 策略 | AUDESYS 参考 |
|-------------|------------|
| 平台免费 + 模块收费 | AUDESYS Studio 基础版免费，高级模块（仿真、调试、分析）收费 |
| 按服务器而非按点/客户端 | AUDESYS Runtime 可选择按实例/按 CPU 核授权 |
| Edge 低价版 | AUDESYS 轻量版 Runtime 面向边缘/Raspberry Pi |
| 30 天全功能试用 | AUDESYS 提供全功能时间限制试用（30 天或更长） |

### 7.3 Gateway 中心化架构与 HAL 的关系

Ignition 的 Gateway 架构（所有数据采集集中在 Gateway）与 AUDESYS 的 HAL 设计有相似的思维：

- Ignition Gateway Tag Provider ↔ AUDESYS HAL Signal/StreamChannel
- Ignition Gateway 通过 Tag Provider 统一管理各种协议 ↔ AUDESYS HAL 通过 amw（AUDESYS Middleware）抽象传输层

**关键参考点**：
- Ignition 的 Tag Provider 插件架构可参考为 AUDESYS HAL 的**设备驱动/协议适配器架构**
- 每个 Tag Provider 实现了统一的接口（start/stop/read/write/subscribe）——这正是 HAL amw 的 trait 定义
- MQTT Engine 的"自动发现设备并创建 Tag"机制，可参考为 AUDESYS HAL 的自动拓扑发现

### 7.4 多协议适配器设计

Ignition 的 Tag Provider 设计为 AUDESYS 的设备驱动/协议适配器架构提供了参考：

```
AUDESYS HAL Driver Architecture (参考 Ignition Tag Provider):
┌─────────────────────────────────────────────┐
│           HAL Driver Manager               │
│  ┌───────┬────────┬────────┬───────────┐   │
│  │Modbus │ OPC UA │ MQTT   │ S7/Siemens│   │
│  │Driver │ Driver │ Driver │ Driver    │   │
│  ├───────┴────────┴────────┴───────────┤   │
│  │     Driver Interface (trait)        │   │
│  │  - connect()                        │   │
│  │  - read(tag) → Signal               │   │
│  │  - write(tag, value)               │   │
│  │  - subscribe(tag, callback)         │   │
│  └──────────────────────────────────────┘   │
│                 ↕                            │
│         HAL amw Transport                  │
└─────────────────────────────────────────────┘
```

### 7.5 报警管理（ISA 18.2）

Ignition 的报警管道（Alarm Pipeline）设计是 AUDESYS 报警系统的参考：

- 报警生命周期管理：Active → Unacknowledged → Acknowledged → Cleared
- 报警管道：Filter → Split → Notify → Store
- 报警搁置（Shelving）
- 电子签名确认

AUDESYS 可在 Runtime 中实现类似的报警处理管线。

### 7.6 OPC UA 集成策略

Ignition 内置 OPC UA Server + Client 的模式值得 AUDESYS 参考：

- AUDESYS Runtime 是否应内置 OPC UA Server？——是，这对与第三方 SCADA/HMI 的互操作性至关重要
- OPC UA 与 HAL 信号系统的映射关系：OPC UA Variable ↔ HAL Signal
- AUDESYS 的 OPC UA Server 可作为 amw 的一个 Transport 实现

### 7.7 脚本语言策略

Ignition 选择 Python (Jython) 作为脚本语言。对 AUDESYS 的参考：

- **Python 作为扩展语言**：工业工程师熟悉度较高，学习曲线平缓
- **Jython 的问题**：Python 2.7 已停止维护，Ignition 面临升级到 GraalPy/Python 3 的压力
- AUDESYS 选择：考虑 **WASM 插件**（不绑死特定语言）或 **Lua**（轻量级嵌入）

### 7.8 社区生态建设

Ignition 的生态建设策略值得 AUDESYS 学习：

| Ignition 生态组件 | AUDESYS 参考 |
|------------------|------------|
| Inductive University（免费培训） | AUDESYS Academy（在线文档 + 视频教程 + 认证体系） |
| Integrator Program（认证集成商） | AUDESYS 合作伙伴生态（集成商 + OEM） |
| Ignition Exchange（模块共享） | AUDESYS Marketplace（插件/模板/驱动商店） |
| Forum（技术社区） | AUDESYS Community（论坛 + GitHub Discussions） |
| ICC（年度大会） | AUDESYS Conference |

### 7.9 Web IDE 架构取舍

从 Ignition Perspective Designer 学习：

- **Perspective Designer 完全在浏览器中运行**——这对 AUDESYS Studio 是一个信号
- 传统工业 IDE 都是桌面应用（TIA Portal、CODESYS、TwinCAT），Ignition 首次证明了**工业 SCADA 工程可以在浏览器中完成**
- AUDESYS Studio 应评估：核心功能（PLC 编程、HMI 设计）是否可 Web 化？
  - **推荐策略**：HMI 设计完全 Web 化，PLC 编程桌面优先（LSP + 语法高亮的 Web 实现在工业 IDE 中仍有限制）

### 7.10 需警惕的陷阱

从 Ignition 的发展历程中 AUDESYS 应注意：

1. **Vision ↔ Perspective 双线维护**：两条 HMI 产品线带来维护负担。AUDESYS 应从第一天就选定唯一的技术栈。
2. **Jython (Python 2.7) 的锁定**：依赖特定语言运行时可能在 10 年后成为技术债。选择嵌入脚本引擎时需考虑长期维护性。
3. **Java 依赖**：Gateway 对 Java 运行时的依赖在某些嵌入式/Linux RT 场景下是负担。AUDESYS Runtime 应考虑 C/Rust 实现以保证实时性和轻量化。
4. **MQTT 供应商锁定**：Ignition 的 MQTT 模块依赖 Cirrus Link，如果合作破裂可能影响产品线。AUDESYS 的核心通信组件应自研或使用完全开源的实现。

---

## 附录

### A. 产品家族

| 产品 | 描述 |
|------|------|
| Ignition Platform | 核心平台，含 Gateway + Designer |
| Ignition Edge | 边缘版（功能受限，单项目单 Tag Provider） |
| Ignition Maker Edition | 免费版（非商业用途：教育/个人/原型） |
| Ignition Cloud Edition | 云端部署版（按量计费） |
| Perspective Module | Web/移动 HMI 模块 |
| Vision Module | 传统桌面 HMI 模块 |
| MQTT Engine | MQTT Sparkplug 订阅引擎 |
| MQTT Distributor | MQTT Sparkplug 发布引擎 |
| MQTT Transmission | 高级 MQTT 发布引擎 |
| Alarm Notification | 报警通知模块 |
| OEE | 设备综合效率 |
| SPC | 统计过程控制 |
| Reporting | 报表模块 |
| SQL Bridge | SQL 数据桥接 |
| Web Development | 自定义 Web 开发 |
| Enterprise Administration | 多 Gateway 管理 |

### B. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 网关 | Gateway | Ignition 核心服务器进程 |
| 标签 | Tag | 数据点（模拟量、数字量、字符串） |
| 标签提供者 | Tag Provider | 数据源抽象（OPC UA、Modbus、MQTT、Memory 等） |
| 透视 | Perspective | Web/移动 HMI 模块 |
| 视图 | Vision | 传统桌面 HMI 模块 |
| 设计器 | Designer | 工程开发 IDE |
| 解决方案套件 | Solution Suite | 模块打包销售方式 |
| 升级保护 | Upgrade Protection | 持续更新支持计划 |
| 感应大学 | Inductive University (IU) | 免费在线培训平台 |
| 集成商计划 | Integrator Program | 三级认证集成商体系 |
| 报警管道 | Alarm Pipeline | 报警处理流程 |
| MQTT | Message Queuing Telemetry Transport | 物联网消息协议 |
| Sparkplug | MQTT Sparkplug | MQTT 工业 payload 规范 |
| OPC UA | Open Platform Communications Unified Architecture | 工业通信标准 |

### C. 参考链接

- Inductive Automation 官方网站: https://inductiveautomation.com
- Ignition 文档 (8.3): https://www.docs.inductiveautomation.com/docs/8.3
- Ignition 论坛: https://forum.inductiveautomation.com
- Inductive University: https://inductiveuniversity.com
- Ignition Exchange: https://inductiveautomation.com/exchange
- Ignition 定价: https://inductiveautomation.com/pricing/ignition
- Cirrus Link (MQTT 合作伙伴): https://www.cirrus-link.com
- Sepasoft (MES 模块): https://www.sepasoft.com

### D. 文档版本信息

- 文档版本: 1.0
- 生成日期: 2026-07-13
- 作者: AUDESYS Team
- 审核状态: 草稿
- 信息来源: Inductive Automation 官方网站、Ignition User Manual (8.3)、Ignition Forum、Inductive University、ICC 大会资料、第三方技术博客和分析报告
- 标注"待确认"的信息需进一步验证
