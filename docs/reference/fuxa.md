# FUXA — 开源 Web SCADA/HMI

## 1. 产品画像

### 1.1 基本信息

- **产品全称**: FUXA（Functional User Experience for Automation）
- **开发商**: frangoteam（开源社区团队）
- **创始人**: unocelli（GitHub 用户名，待确认真实姓名）
- **首次发布**: 2019 年 3 月 9 日（GitHub 仓库创建）
- **开源协议**: MIT License（完全自由使用、修改、分发）
- **当前版本**: v1.3.3（npm）/ v1.3.2（GitHub Release，2026 年 5 月 19 日）
- **GitHub**: https://github.com/frangoteam/FUXA
- **官方网站**: https://frangoteam.org
- **npm 包**: @frangoteam/fuxa（npm install 安装）
- **Docker 镜像**: frangoteam/fuxa:latest
- **GitHub Stars**: 4,700+（截至 2026 年 7 月）
- **GitHub Forks**: 1,280+
- **Open Issues**: 349
- **协作语言**: English（README、Issues、代码注释）
- **仓库标签**: angular, bacnet, dashboard, hmi, iot, modbus, mqtt, nodejs, opc-ua, plc, s7, scada, siemens, svg-editor, web-editor, web-hmi, web-scada

### 1.2 产品定位与核心价值主张

FUXA 的定位是**完全开源的 Web 原生 SCADA/HMI 平台**，其核心价值主张是：

- **零成本起步**：MIT 开源协议，无许可费用。无论是个人学习和原型开发还是商业部署，完全免费
- **完全 Web 化**：从工程设计到运行时监控，全部在浏览器中完成。无需安装任何桌面客户端软件
- **轻量级架构**：Node.js + Angular 技术栈，可运行在 Docker、Linux、Windows、macOS、Raspberry Pi 上
- **拖拽式 SVG 编辑器**：无需编写 Web 代码即可创建工业监控画面——降低了不熟悉前端开发的自动化工程师的入门门槛
- **多协议支持**：原生支持 Modbus RTU/TCP、OPC UA、MQTT、Siemens S7、BACnet、EtherNet/IP、WebAPI 等工业协议
- **REST API**：提供完整的 REST API，方便与其他系统（MES、ERP、AI 分析平台）集成

FUXA 在开源 SCADA 领域的地位类似于 Grafana 在监控可视化领域的地位——用现代 Web 技术降低了专业可视化的门槛。

### 1.3 目标用户群体

| 用户群体 | 典型需求 | FUXA 优势 |
|---------|---------|----------|
| 小型工厂/车间 | 低成本 SCADA/HMI | 零许可费用，Raspberry Pi 即可运行 |
| 系统集成商 | 快速原型开发和项目试水 | 免费、快速部署、可定制 |
| IoT/IIoT 开发者 | 设备数据可视化 | REST API、MQTT、多协议支持 |
| 教育机构/学生 | 学习 SCADA 技术 | 开源、文档丰富、社区活跃 |
| Maker/创客 | 家庭自动化/智能农业 | 轻量级，Raspberry Pi 兼容 |
| 研究机构 | SCADA 安全研究、协议测试 | 完全可审计的源代码 |
| 开发者/DevOps | 自定义工业数据看板 | Docker 一键部署、REST API 集成 |
| 中小企业 | 替代昂贵的商业 SCADA | 功能足够且免费 |

### 1.4 商业模式

FUXA 是**完全免费的 MIT 开源项目**，没有商业许可模型：

- **源码**：GitHub 公开仓库，任何人可自由 fork、修改、分发
- **npm 安装**：`npm install @frangoteam/fuxa`
- **Docker 安装**：`docker pull frangoteam/fuxa:latest`
- **商业模式**：项目本身无商业模式。可能的收入来源（推测）包括：
  - 捐赠/赞助（GitHub Sponsors）
  - 企业定制开发服务
  - 付费技术支持
  - 云托管服务（未来可能）

这种模式与 Ignition Maker Edition（非商业免费）或传统的商业 SCADA 形成鲜明对比——FUXA 欢迎任何形式的商业使用。

---

## 2. 技术特性

### 2.1 核心架构

FUXA 采用经典的**前后端分离 Web 架构**：

```
┌─────────────────────────────────────────────────────────┐
│                    浏览器客户端（Angular）                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  FUXA Web UI（Angular SPA）                         │ │
│  │  ┌──────────────┬──────────────┬───────────────┐   │ │
│  │  │ SVG 编辑器    │ 实时监控画面  │ 报警/趋势/报表  │   │ │
│  │  │ (拖拽设计)   │ (运行时渲染)  │ (管理界面)    │   │ │
│  │  ├──────────────┴──────────────┴───────────────┤   │ │
│  │  │  WebSocket 实时数据通道                        │   │ │
│  │  └──────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                  HTTP REST API / WebSocket               │
├─────────────────────────────────────────────────────────┤
│                 Node.js 后端服务器（Express）              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  核心服务层                                         │ │
│  │  ┌──────────┬──────────┬──────────┬────────────┐  │ │
│  │  │Tag Engine│Alarm Mgr │History   │User/Auth   │  │ │
│  │  │标签引擎   │报警管理    │历史记录    │用户/认证     │  │ │
│  │  ├──────────┼──────────┼──────────┼────────────┤  │ │
│  │  │Report    │Recipe    │Script    │Scheduler   │  │ │
│  │  │报表       │配方       │脚本       │定时任务      │  │ │
│  │  └──────────┴──────────┴──────────┴────────────┘  │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │        协议适配器层（Device Drivers）          │  │ │
│  │  │  ┌──────┬──────┬──────┬──────┬──────┬─────┐ │  │ │
│  │  │  │Modbus│OPC UA│MQTT  │S7    │BACnet│EIP  │ │  │ │
│  │  │  │      │      │      │      │      │     │ │  │ │
│  │  │  └──────┴──────┴──────┴──────┴──────┴─────┘ │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  ├────────────────────────────────────────────────────┤ │
│  │              数据存储层                              │ │
│  │  ┌──────────┬──────────┬──────────────┐           │ │
│  │  │ SQLite   │ InfluxDB │ 文件系统      │           │ │
│  │  │ (配置DB) │ (时序DB)  │ (项目文件)    │           │ │
│  │  └──────────┴──────────┴──────────────┘           │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### 2.1.1 后端（Node.js + Express）

FUXA 后端基于 Node.js 构建，使用 Express（推测）或类似框架作为 HTTP 服务器：

- **运行时要求**：Node.js 18 LTS（推荐）/ Node.js 20+
- **WebSocket**：后端通过 WebSocket 向前端推送实时数据（Tag 值变化、报警事件）
- **REST API**：提供完整的 RESTful API 供外部系统集成
- **进程模式**：
  - 标准模式：单进程运行
  - Daemon 模式：作为后台守护进程运行（适用于嵌入式/无头部署）
- **存储**：
  - 配置数据：SQLite（轻量级嵌入式数据库）
  - 历史数据：SQLite 或 InfluxDB（可选，用于高性能时序数据存储）
  - 项目文件：文件系统（JSON 格式的项目配置）

#### 2.1.2 前端（Angular）

FUXA 前端使用 Angular 框架构建单页应用（SPA）：

- **Angular 版本**：待确认（推测 Angular 15+）
- **SVG 编辑器**：基于浏览器原生 SVG 能力的拖拽式编辑器，是 FUXA 最核心的前端组件
- **实时更新**：通过 WebSocket 接收后端推送的 Tag 数据变化，实现毫秒级的画面更新
- **响应式设计**：支持移动端浏览器访问（但非专门优化的移动 App）

#### 2.1.3 SVG 编辑器架构

FUXA 的 SVG 编辑器是整个产品最独特的技术组件：

```
┌─────────────────────────────────────────┐
│         FUXA SVG Editor                  │
│  ┌───────────────────────────────────┐  │
│  │  画布 (SVG Canvas)                 │  │
│  │  - 拖拽组件到画布                  │  │
│  │  - 移动/缩放/旋转/对齐             │  │
│  │  - 图层管理 (Z-Order)              │  │
│  ├───────────────────────────────────┤  │
│  │  组件库 (Toolbox)                  │  │
│  │  - 基本形状 (矩形/圆/线/文本)      │  │
│  │  - 仪表组件 (Gauge/Bar/Tank)       │  │
│  │  - 控制组件 (Button/Switch/Slider) │  │
│  │  - 图表组件 (Chart/Trend)          │  │
│  │  - 容器组件 (Panel/IFrame)         │  │
│  │  - 图片/图标                       │  │
│  ├───────────────────────────────────┤  │
│  │  属性面板 (Property Panel)         │  │
│  │  - 位置/尺寸/颜色/字体             │  │
│  │  - 数据绑定 (Tag Binding)          │  │
│  │  - 动画/行为 (Animation/Event)     │  │
│  │  - 条件样式 (Conditional Format)   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 2.2 数据采集与协议支持

FUXA 支持通过插件化的**设备驱动程序**连接各种工业设备和协议：

#### 支持的协议

| 协议 | 模式 | 实现方式 | 备注 |
|------|------|---------|------|
| **Modbus RTU** | 串口（RS232/RS485） | node-modbus 或 serialport | 支持 RTU 模式 |
| **Modbus TCP** | TCP | node-modbus | 支持 TCP 模式 |
| **OPC UA** | TCP | node-opcua | 支持订阅（Subscription）模式 |
| **MQTT** | TCP | mqtt.js | 支持发布和订阅 |
| **Siemens S7** | TCP | node-snap7 或 nodes7 | 直接连接 S7-300/400/1200/1500 |
| **BACnet** | UDP | node-bacnet | 楼宇自动化协议 |
| **EtherNet/IP** | TCP/UDP | 自定义驱动（待确认） | Allen-Bradley PLC 通信 |
| **WebAPI** | HTTP/HTTPS | axios/fetch | REST API 数据源 |
| **OPC DA** | DCOM | 待确认（可能通过 OPC UA Gateway） | 仅 Windows 环境 |

#### 设备数据流模型

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ 物理设备      │ →  │ 协议适配器     │ →  │ 标签引擎     │
│ (PLC/传感器)  │    │ (Device Driver)│    │ (Tag Engine) │
└─────────────┘    └──────────────┘    └──────┬──────┘
                                                │
                      ┌─────────────────────────┼──────────────────┐
                      ↓                         ↓                  ↓
               ┌────────────┐          ┌─────────────┐    ┌─────────────┐
               │ WebSocket   │          │ 报警引擎      │    │ 历史记录      │
               │ 推送到前端   │          │ (Alarm Engine)│    │ (InfluxDB)   │
               └────────────┘          └─────────────┘    └─────────────┘
```

- **轮询（Polling）**：Modbus、S7 等协议使用周期性轮询读取设备数据
- **订阅（Subscription）**：OPC UA 支持订阅模式，数据变化时自动推送
- **事件驱动**：MQTT 基于消息的事件驱动模式

### 2.3 脚本与表达式

FUXA 的脚本能力相对基础（与 Ignition 的 Python 或组态王的类 C 脚本相比）：

- **表达式**：支持在 SVG 组件的属性绑定中使用简单表达式（数值运算、条件判断）
- **JavaScript 脚本**：可在特定事件触发时执行 JavaScript 代码（前端执行）
- **REST API 调用**：通过 WebAPI 设备驱动集成外部系统的计算逻辑

### 2.4 安全模型

FUXA 的安全模型相对基础，适合受信任的内部网络环境：

- **用户认证**：本地用户名/密码认证（JWT Token）
- **角色管理**：支持基本角色（Admin、User、Viewer）
- **权限控制**：
  - 项目级访问控制（不同用户可访问不同的 HMI 项目）
  - 功能权限（编辑、操作、查看）
- **HTTPS**：支持 TLS/SSL 加密（需自行配置反向代理如 Nginx）
- **API 认证**：REST API 通过 JWT Bearer Token 认证
- **安全限制**：
  - 无 LDAP/AD 集成（社区版限制）
  - 无双因素认证
  - 无审计日志（或仅基础日志）
  - 无 OPC UA 证书管理

对于生产环境，建议在 FUXA 前面部署反向代理（Nginx/Caddy）以增加安全层。

### 2.5 可扩展性

| 维度 | FUXA 能力 |
|------|----------|
| 单机部署 | 是（标准模式） |
| Docker 部署 | 是（官方 Docker 镜像） |
| 嵌入式部署 | 是（Raspberry Pi、ARM Linux） |
| 集群/负载均衡 | 否（单进程架构） |
| 分布式/多站点 | 可通过多个实例 + 消息中间件实现（非内置） |
| 冗余/高可用 | 否（需要外部方案如 Docker Swarm/K8s） |

---

## 3. 功能概览

### 3.1 可视化

FUXA 的核心功能是**基于 SVG 的 Web HMI 可视化**：

#### SVG 编辑器功能

- **拖拽式设计**：从组件库拖拽组件到画布
- **组件类型**：
  - **基本形状**：矩形、圆角矩形、圆形、椭圆、直线、折线、多边形、路径
  - **文本**：单行文本、多行文本、带样式的标签
  - **仪表/指示器**：圆形仪表（Gauge）、条形仪表（Bar）、液位指示器（Tank）、线性仪表
  - **控制组件**：按钮（Button）、开关（Toggle Switch）、滑块（Slider）、输入框（Input）
  - **图表**：实时趋势图、历史趋势图、饼图、柱状图
  - **容器**：面板（Panel）、嵌入式框架（IFrame）、管道（Pipe）
  - **多媒体**：图片、SVG 图标、摄像头视频流
  - **数据表格**：实时数据表格
  - **HTML 组件**：自定义 HTML/CSS
- **数据绑定**：组件属性（颜色、尺寸、文本、可见性）可直接绑定到 Tag 值
- **条件样式**：基于 Tag 值的条件颜色/样式变化（如温度 > 100°C 时变红）
- **动画**：旋转、移动、缩放动画（可绑定 Tag 值）
- **事件处理**：鼠标点击、悬停事件可触发动作（导航、写 Tag 值、执行脚本）
- **图层管理**：Z-Order 排序、分组、锁定
- **对齐工具**：吸附对齐、等距分布、网格
- **缩放/平移**：编辑器画布支持缩放和平移

#### 实时监控画面

- **全屏模式**：运行时画面可全屏展示（适合大屏/电视）
- **自动刷新**：通过 WebSocket 实时更新 Tag 值，无需手动刷新
- **多页面导航**：支持多个视图页面之间的导航
- **移动端访问**：响应式布局，支持手机/平板浏览器

### 3.2 报警管理

- **报警定义**：基于 Tag 值的限值报警（高、高高、低、低低）
- **报警分级**：Info、Warning、Alert、Critical 四级
- **报警状态**：Active、Acknowledged、Cleared
- **报警确认**：用户可确认（Acknowledge）报警
- **报警通知**：待确认（可能通过 Webhook 或邮件）
- **报警历史**：报警记录存储在 SQLite 数据库中，支持查询
- **报警声音**：支持报警声音提示

### 3.3 趋势与历史数据

- **实时趋势**：在 SVG 画面中嵌入实时趋势图
- **历史趋势**：查询历史数据并以趋势图展示
- **数据存储**：
  - 默认：SQLite（适合小规模数据）
  - 可选：InfluxDB（高性能时序数据库，适合大规模数据）
- **数据导出**：待确认（可能支持 CSV 导出）
- **数据回放**：待确认

### 3.4 报表

FUXA 在 v1.3.x 中引入报表功能：

- **报表类型**：日/周/月报、自定义时间范围报告
- **输出格式**：PDF、CSV（待确认）
- **定时生成**：支持按日程自动生成报表
- **数据源**：从 Tag 历史数据或报警数据生成

### 3.5 配方管理（Recipe）

- **配方定义**：一组 Tag 值的预设集合
- **配方操作**：加载、保存、编辑
- **配方存储**：SQLite 数据库

### 3.6 用户与角色管理

- **用户管理**：创建、编辑、删除用户
- **角色类型**：
  - Admin：完全控制权
  - Editor：可编辑项目但不能管理用户
  - Viewer：仅查看权限
- **权限应用**：
  - 不同用户可访问不同的 HMI 项目
  - 控制操作（写 Tag、确认报警）需要相应权限
- **会话管理**：JWT Token 过期机制

### 3.7 多语言支持

- **内置语言**：英语（主要），部分支持多语言（i18n 基础架构存在）
- **自定义翻译**：可修改前端翻译文件（待确认）

### 3.8 REST API

FUXA 提供完整的 REST API，是其企业集成能力的核心：

| API 端点（推测路径） | 功能 |
|-------------------|------|
| `GET /api/tags` | 获取所有 Tag 列表 |
| `GET /api/tags/{id}/value` | 读取 Tag 当前值 |
| `POST /api/tags/{id}/value` | 写入 Tag 值 |
| `GET /api/alarms` | 获取当前报警列表 |
| `POST /api/alarms/{id}/ack` | 确认报警 |
| `GET /api/history` | 查询 Tag 历史数据 |
| `GET /api/projects` | 获取项目列表 |

REST API 使 FUXA 可以作为数据中间件，向上层 MES/ERP 系统暴露工业数据。

---

## 4. 现状与生态

### 4.1 版本与发布

### 4.0 项目发展历程

FUXA 项目从启动到成为开源 SCADA 领域最活跃的项目，经历了以下阶段：
- **2019 年 3 月**：GitHub 仓库创建，由 frangoteam（unoceelli）发起
- **2020 年**：达到 v1.0 首个正式发布
- **2021-2022 年**：协议支持扩展（OPC UA、MQTT、S7），社区快速增长
- **2023 年**：引入 InfluxDB 支持、BACnet 协议、Docker 官方镜像
- **2024 年**：持续迭代，GitHub Stars 突破 3,000
- **2025-2026 年**：v1.3.x 系列，增强报警管理、报表导入导出、UI 定制化


| 版本 | 发布时间 | 关键变化 |
|------|---------|---------|
| v1.0.0 | 2020（待确认） | 首个稳定版 |
| v1.1.x | 2022（待确认） | 协议扩展 |
| v1.2.0 | 2023（待确认） | InfluxDB 支持、BACnet 支持 |
| v1.2.7 | 2024 | 不再支持 Node.js 14 及更早版本 |
| v1.3.0 | 2025（待确认） | OPC UA 发布间隔优化、设备插件消息 |
| v1.3.2 | 2026-05-19 | 最新 GitHub Release |
| v1.3.3 | 2026 | npm 最新版 |

### 4.2 社区活跃度

| 指标 | 数据 |
|------|------|
| GitHub Stars | 4,700+ |
| GitHub Forks | 1,280+ |
| Open Issues | 349 |
| 贡献者数量 | 待确认（主要维护者为 frangoteam/unoceelli） |
| npm 下载量 | 待确认 |
| Docker Hub 下载量 | 待确认 |
| 活跃讨论平台 | GitHub Issues（主要）、frangoteam.org 论坛（待确认） |

### 4.3 部署方式

| 部署方式 | 命令/方法 | 适用场景 |
|---------|----------|---------|
| **Docker** | `docker run -d -p 1881:1881 frangoteam/fuxa:latest` | 快速部署、生产环境 |
| **npm 安装** | `npm install @frangoteam/fuxa` | Node.js 环境已有 |
| **源码安装** | `git clone` + `npm install` + `npm start` | 开发/定制 |
| **Electron 应用** | 需自行构建（README 提到可创建 Electron 应用） | 桌面应用场景 |
| **Raspberry Pi** | npm 安装或 Docker（ARM 镜像） | 边缘/嵌入式 |

- **默认端口**：1881
- **配置文件**：`_project` 目录（项目文件，JSON 格式）
- **数据库文件**：`fuxa.db`（SQLite 配置数据库）

### 4.4 技术栈

| 层 | 技术 |
|----|------|
| **后端运行时** | Node.js 18+ LTS |
| **后端框架** | Express.js（推测） |
| **WebSocket** | socket.io（推测） |
| **前端框架** | Angular（推测 v15+） |
| **SVG 编辑器** | 自研（基于浏览器原生 SVG API） |
| **Modbus** | node-modbus / modbus-serial |
| **OPC UA** | node-opcua |
| **MQTT** | mqtt.js |
| **Siemens S7** | node-snap7 或 nodes7 |
| **BACnet** | node-bacnet |
| **默认数据库** | SQLite（better-sqlite3） |
| **时序数据库** | InfluxDB（可选） |
| **图表库** | Chart.js 或 D3.js（推测，用于趋势图） |
| **认证** | JWT（jsonwebtoken） |

### 4.5 竞品对比

| 维度 | FUXA | ScadaBR | Rapid SCADA | OpenSCADA |
|------|------|---------|-------------|-----------|
| GitHub Stars | 4,700+ | ~300 | ~500 | ~600 |
| 开源协议 | MIT | GPL | Apache 2.0 | GPL |
| 技术栈 | Node.js + Angular | Java (Tomcat) | C# (.NET) | C++ + Qt |
| Web 原生 | ✓ (纯 Web) | ✓ | ✓ | 部分 |
| SVG 编辑器 | ✓ (拖拽) | ✗ | ✓ | ✗ |
| 移动端 | ✓ (浏览器) | 有限 | 有限 | ✗ |
| Docker | ✓ 官方镜像 | 社区镜像 | ✗ | ✗ |
| 轻量级 | ✓ (RPi 兼容) | ✗ | 中等 | 中等 |
| 协议支持 | 8 种 | 4-5 种 | 3-4 种 | 6-7 种 |
| REST API | ✓ | ✓ | ✓ | ✓ |
| 社区活跃度 | 高 | 低 | 中等 | 中等 |
| 生产就绪度 | 中等 | 中等 | 高 | 高 |

---

## 5. 市场定位

### 5.1 目标市场

FUXA 主要面向以下几类市场：

| 市场 | 典型使用者 | FUXA 的匹配度 |
|------|-----------|:---:|
| 个人/教育/原型 | 学生、爱好者、创业者 | ★★★★★ |
| 小型工厂（< 100 点） | 小型制造企业、农业温室 | ★★★★☆ |
| IoT 数据可视化 | IoT 平台的数据展示层 | ★★★★☆ |
| 实验室/研究机构 | 科研数据采集和可视化 | ★★★★★ |
| 系统集成商的试点项目 | 为客户做 PoC 演示 | ★★★★☆ |
| 中型工厂（100-1000 点） | 中等规模产线监控 | ★★★☆☆ |
| 大型企业（> 1000 点） | 大型工厂/多站点 | ★★☆☆☆ |

### 5.2 市场位置

- 在开源 SCADA 领域：**社区活跃度最高的 Web SCADA 项目之一**
- 与商业 SCADA 的关系：**互补而非替代**——FUXA 适合预算有限或对定制化要求高的场景，商业 SCADA 适合需要厂商技术支持和企业级功能的场景
- 主要地理分布：全球（GitHub 用户分布），在欧洲和北美有较高认可度

### 5.3 核心竞争力

1. **完全免费开源**：零成本起步，MIT 协议无任何商业使用限制
2. **轻量级 Node.js 架构**：现代 Web 开发者熟悉的栈，易于定制和扩展
3. **SVG 拖拽编辑器**：不需要前端开发技能即可创建工业画面
4. **Docker 一键部署**：`docker run` 一行命令即可启动
5. **Raspberry Pi 支持**：极低硬件成本（$35）部署 SCADA 系统
6. **多协议覆盖**：覆盖主流工业协议，满足大部分场景需求

---

## 6. 产品特色

### 6.1 SVG 编辑器——Web HMI 的 Figma

FUXA 的 SVG 编辑器是其最突出的技术特色。它实现了一个**在浏览器中运行的、面向工业场景的图形编辑器**：

- **完全 Web 化**：不需要安装任何桌面软件，打开浏览器就能设计 HMI 画面
- **所见即所得**：设计时看到的样子就是运行时看到的样子
- **数据绑定可视化**：通过属性面板配置 Tag 绑定，而非手写代码
- **零编程门槛**：自动化工程师无需 HTML/CSS/JavaScript 知识即可创建监控画面

这种设计理念与 Ignition Perspective Designer（浏览器内 HMI 设计器）高度一致，但 FUXA 是完全开源的。

### 6.2 轻量级架构——$35 的 SCADA 服务器

FUXA 可以运行在 Raspberry Pi 上（硬件成本仅 $35），这使其成为**成本最低的 SCADA 部署方案之一**：

```
硬件成本对比（最小部署）：
- FUXA on Raspberry Pi 4:     $35  (RPi 4) + $10 (SD卡) = ~$45
- Ignition Edge on 工控机:     $1,500 (Edge License) + $500 (工控机) = ~$2,000
- WinCC RT on IPC:            $3,000+ (License) + $1,000 (IPC) = ~$4,000+
- 组态王 on Windows 工控机:     ¥5,000 (License) + ¥3,000 (工控机) = ~¥8,000
```

虽然 FUXA 在功能完整度上不如商业产品，但对于小型项目或原型验证，这一成本优势是颠覆性的。

### 6.3 MIT 开源——真正的自由

MIT License 是所有开源协议中**最宽松的之一**：

- 允许商业使用（无需开源自己的代码）
- 允许修改和分发（无需公开修改）
- 允许闭源集成（可嵌入商业产品）
- 唯一的限制：需保留版权声明

这意味着企业可以将 FUXA 作为自己产品的 HMI 模块，甚至二次开发后闭源销售。

### 6.4 Docker 原生支持

FUXA 是少数几个提供**官方 Docker 镜像**的开源 SCADA 项目之一：

```bash
# 一行命令部署
docker run -d --name fuxa \
  -p 1881:1881 \
  -v fuxa_data:/usr/src/app/FUXA/server/_appdata \
  -v fuxa_db:/usr/src/app/FUXA/server/_db \
  frangoteam/fuxa:latest
```

Docker 化的优势：
- 环境一致性（无需考虑 Node.js 版本、OS 差异）
- 快速部署和迁移
- 支持 Docker Compose 多服务编排（FUXA + InfluxDB + Mosquitto MQTT）
- 支持 Kubernetes 部署（需自行配置存储卷）

### 6.5 Node.js 生态——熟悉的开发环境

选择 Node.js 作为后端是 FUXA 的战略性技术决策：

- **庞大的 npm 生态**：可直接使用数十万个 npm 包
- **JavaScript 全栈**：前后端使用同一语言，降低团队技能要求
- **异步 I/O 天然优势**：Node.js 的事件驱动模型非常适合处理大量并发设备通信
- **学习曲线低**：Web 开发者转行工业自动化开发的入门门槛降低

但同时，Node.js 的垃圾回收（GC）可能导致**实时性能的不确定性**——这对 SCADA 级别的时间精度（毫秒级）通常可接受，但不适合需要微秒级确定性的硬实时控制。

### 6.6 插件化的协议适配器

FUXA 的设备协议采用**插件化架构**，添加新协议相对简单：

```
protocols/
  modbus.js    ← Modbus TCP/RTU 适配器
  opcua.js     ← OPC UA 适配器
  mqtt.js      ← MQTT 适配器
  s7.js        ← Siemens S7 适配器
  bacnet.js    ← BACnet 适配器
  ethernetip.js ← EtherNet/IP 适配器
  webapi.js    ← WebAPI 适配器
```

每个适配器实现了统一的接口（连接、断开、读取、写入），新增协议只需实现相同的接口。

---

### 6.7 工程文件的可移植性

FUXA 的项目完全以 JSON 配置文件保存，这带来了极高的可移植性：
- 整个 SCADA 项目的所有配置（设备、Tag、画面、报警、用户）都在 `_appdata` 目录下的 JSON 文件中
- 可通过简单的文件复制在不同计算机之间迁移项目
- 可通过 Git 进行项目版本控制
- 可通过脚本批量生成和修改配置（如自动添加 100 个 Modbus Tag）

这与传统 SCADA 的二进制工程文件格式形成鲜明对比——FUXA 的工程文件是可读、可编辑、可脚本处理的纯 JSON。

### 6.8 与商业 SCADA 的桥接角色

FUXA 在实际项目中的一个独特角色是作为传统 SCADA 的 Web 化前端补充：
- 传统 SCADA 的 Web 发布功能通常额外收费且功能有限
- FUXA 可以独立于传统 SCADA 运行，通过 OPC UA/Modbus 读取数据
- 在一个传统 SCADA + FUXA 的混合架构中，传统 SCADA 负责控制逻辑和历史存储，FUXA 负责 Web 可视化和移动端访问
- 这种"前端分离"的架构在不替换原有系统的前提下实现了现代化升级

## 7. 对 AUDESYS 的参考价值

### 7.1 SVG 编辑器——AUDESYS Studio HMI 设计器的直接参考

FUXA 的 SVG 编辑器是 AUDESYS Studio HMI 设计器**最直接的实现参考**：

| FUXA SVG Editor 设计 | AUDESYS Studio 参考点 |
|---------------------|---------------------|
| 浏览器内拖拽式编辑器 | AUDESYS HMI Designer 的核心交互模式 |
| 组件库 + 属性面板 + 画布三栏布局 | IDE 布局设计 |
| Tag 属性绑定（属性面板配置） | AUDESYS HMI 数据绑定系统 |
| 条件样式（基于 Tag 值的颜色/可见性变化） | AUDESYS HMI 动态渲染引擎 |
| 图层管理 + Z-Order | AUDESYS HMI 图形对象模型 |
| SVG 原生渲染 + WebSocket 实时更新 | AUDESYS 前端技术栈选择 |

**关键设计参考**：

```
AUDESYS HMI Designer 组件模型（参考 FUXA）：
┌────────────────────────────────────────┐
│  HMIComponent                          │
│  ├── ComponentType (Shape/Basic)       │
│  ├── Geometry (x, y, w, h, rotation)   │
│  ├── Style (fill, stroke, font, ...)   │
│  ├── Bindings[]                        │
│  │   └── {property, tag, transform}    │
│  ├── Conditions[]                      │
│  │   └── {expression, styleOverride}   │
│  ├── Events[]                          │
│  │   └── {trigger, action}             │
│  └── Children[] (容器组件)             │
└────────────────────────────────────────┘
```

### 7.2 协议适配器架构

FUXA 的协议插件化架构与 AUDESYS HAL 的设备驱动接口高度契合：

| FUXA 协议适配器 | AUDESYS HAL 对应 |
|---------------|-----------------|
| 统一接口：connect / disconnect / read / write | HAL Driver trait |
| 每个协议独立模块（modbus.js / opcua.js / s7.js） | HAL Driver 插件（独立 crate） |
| 周期性轮询 VS 事件订阅 | HAL 的轮询模式和订阅模式 |
| 设备配置（host/port/unitID 等） | HAL DriverConfig 结构体 |

**FUXA 对 AUDESYS 驱动架构的启发**：

- FUXA 选择 npm 生态的成熟协议库（如 node-opcua），AUDESYS 可以选择 Rust 生态的成熟 crate（如 `ruma`-ster 的 opcua crate）
- FUXA 的协议适配器是松耦合设计，AUDESYS 也应保持 Driver 之间的独立性
- FUXA 的 WebAPI 驱动（HTTP 数据源）说明了一个重要概念：**数据源不一定是物理设备，也可以是 REST API**

### 7.3 轻量级部署——AUDESYS Runtime 的参考

FUXA 在 Raspberry Pi 上的部署经验为 AUDESYS Runtime 的轻量化提供了参考：

- **Node.js 内存占用**：FUXA 在 RPi 上的典型内存占用约 200-500 MB（含 Node.js 运行时）
- **SQLite 作为配置存储**：无需安装和配置独立数据库
- **Docker 化**：便于在边缘设备上部署和更新
- **Daemon 模式**：无头设备的后台运行

AUDESYS Runtime 选择 Rust 编译为原生二进制，比 Node.js 的解释执行有本质优势：
- 更低的内存占用（10-50 MB vs 200-500 MB）
- 更快的启动速度（毫秒 vs 秒）
- 无 GC 停顿（确定性实时性能）

### 7.4 Web 原生 HMI 的工程实践

FUXA 证明了**Web 原生 HMI 在现实中是可行的**：

| 挑战 | FUXA 的解决方案 | AUDESYS 的参考 |
|------|---------------|---------------|
| SVG 编辑器的复杂度 | 自研轻量级 SVG 编辑器 | AUDESYS 可参考其架构，或考虑基于开源编辑器（如 svg.js）构建 |
| 实时数据刷新 | WebSocket 推送 | AUDESYS 使用 WebSocket 或 HAL StreamChannel 的 Web 桥接 |
| 多页面导航 | Angular Router | AUDESYS 前端路由设计 |
| 大数据量渲染 | SVG 原生渲染（单画面< 200 组件） | AUDESYS 需评估 Canvas/WebGL 渲染方案（大数据量场景） |
| 移动端适配 | 响应式布局（有限） | AUDESYS 应从设计初期就支持完整响应式 |

### 7.5 技术栈选择的启示

FUXA 的技术栈（TypeScript/JavaScript + Node.js + Angular + SQLite）展示了"全 JS 栈"在工业 SCADA 领域的优劣：

**优势**：
- 统一语言降低团队技能要求
- npm 生态丰富，快速获取功能库
- 前后端代码共享类型定义

**劣势**：
- Node.js GC 停顿可能导致实时数据采集抖动
- 大规模数据处理性能不足（对比 Rust/C++）
- 内存占用较高
- 单线程模型的扩展性受限

**对 AUDESYS 的参考**：
- **前端**：可以采用 TypeScript + React（充分利用 npm 生态）
- **后端/实时**：必须使用 Rust（确定性实时性能、无 GC、内存安全）
- **FFI 桥接**：Rust 核心通过 WebSocket/HTTP/FlatBuffers 与 TypeScript 前端通信

### 7.6 开源生态策略

FUXA 在 GitHub 上的成功为 AUDESYS 的开源策略提供参考：

| FUXA 策略 | AUDESYS 参考 |
|----------|------------|
| MIT License | AUDESYS 可选择 MIT 或 Apache 2.0（商业友好） |
| 活跃的 GitHub Issues 社区 | AUDESYS 建立 GitHub Discussions + Issues |
| Docker 官方镜像 | AUDESYS 提供官方 Docker 镜像 |
| npm 发布 | AUDESYS 提供各平台的预编译二进制包 |
| 清晰的 README + 截图 | AUDESYS 文档质量策略 |
| 定期 Release + Changelog | AUDESYS 发布规范 |

### 7.7 从 FUXA 到 AUDESYS 的升级路径

将 FUXA 的局限性转化为 AUDESYS 的差异化优势：

| FUXA 的局限 | AUDESYS 的解决方案 |
|-----------|-----------------|
| Node.js 单线程 | Rust 多线程 + 异步任务调度 |
| 无实时确定性 | Rust + SCHED_FIFO 实时调度 |
| 报警功能基础 | 完整的 ISA 18.2 报警管理 + 报警管道 |
| 无冗余 | HAL 内置冗余支持 |
| SVG 渲染性能有限 | Canvas/WebGL 高性能渲染方案 |
| 脚本能力有限 | WASM 多语言插件系统 |
| 安全模型基础 | 企业级认证授权（LDAP、OAuth、RBAC） |

### 7.8 需警惕的陷阱

1. **SVG 编辑器的复杂度陷阱**：FUXA 的 SVG 编辑器看似简单，但完整实现（吸附、旋转、缩放、路径编辑、导出）需要大量工作。AUDESYS 可考虑基于成熟的 Web 图形库（如 Fabric.js、Konva.js）构建编辑器。
2. **Node.js 版本依赖**：FUXA 经历了 Node.js 14 → 18 的迁移，某些 S7 库（node-snap7）需要额外编译依赖。AUDESYS 选择 Rust 避免了这类运行时版本问题。
3. **SQLite 的性能天花板**：FUXA 默认使用 SQLite 存储历史数据，在大 Tag 量（> 1000 点）时可能出现性能瓶颈。AUDESYS 应考虑可插拔的时序存储后端。
4. **单进程架构的可扩展性**：FUXA 是单进程架构，无法水平扩展。AUDESYS Runtime 应从一开始就支持多进程/分布式架构。

---

## 附录

### A. 版本历史

| 版本 | 关键变化 |
|------|---------|
| v0.x (2019-2020) | 项目初始开发，基础 SVG 编辑器和 Modbus 支持 |
| v1.0.0 (~2020) | 首个正式发布，生产可用 |
| v1.2.0 (~2023) | 引入 InfluxDB 支持、BACnet 协议支持 |
| v1.2.7 (~2024) | Node.js 14 不再支持，迁移到 Node.js 18 |
| v1.3.0 (~2025) | OPC UA 发布间隔优化，设备插件消息功能 |
| v1.3.1 | 报警确认通知重置修复等 |
| v1.3.2 (2026-05-19) | Header 高度可配、View 参数处理、报警导入导出、按钮图标、设备插件消息、InfluxDB Tag 名称支持、TDengine 字符串转义 |
| v1.3.3 (2026) | npm 最新版本 |

### B. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 标签 | Tag | 数据点（对应设备的一个变量/寄存器） |
| 设备 | Device | 物理设备（PLC、传感器等）的抽象 |
| 协议适配器 | Device Driver / Protocol Adapter | 与具体通信协议对接的驱动程序 |
| SVG 编辑器 | SVG Editor | 基于浏览器 SVG 的拖拽式画面设计器 |
| 视图 | View | 一个 HMI 监控画面页面 |
| 数据绑定 | Data Binding | 将 Tag 值绑定到 SVG 组件属性的机制 |
| 条件样式 | Conditional Formatting | 基于 Tag 值自动变化的组件样式 |
| Daemon 模式 | Daemon Mode | 后台守护进程运行模式 |
| MIT License | — | 最宽松的开源软件许可之一 |

### C. 技术栈详情

| 组件 | 具体技术 | npm 包名 |
|------|---------|---------|
| 后端框架 | Express.js | express |
| WebSocket | Socket.io | socket.io |
| 前端框架 | Angular | @angular/core |
| Modbus 驱动 | node-modbus | modbus-serial |
| OPC UA 驱动 | node-opcua | node-opcua |
| MQTT 驱动 | mqtt.js | mqtt |
| S7 驱动 | node-snap7 / nodes7 | nodes7 |
| BACnet 驱动 | node-bacnet | bacstack |
| 内置数据库 | SQLite | better-sqlite3 |
| 时序数据库 | InfluxDB (可选) | influx |
| 认证 | JWT | jsonwebtoken |
| 图表 | Chart.js 或 ECharts | chart.js |
| 容器化 | Docker | — |

### D. 部署参考命令

```bash
# Docker 部署
docker run -d --name fuxa \
  -p 1881:1881 \
  -v fuxa_data:/usr/src/app/FUXA/server/_appdata \
  -v fuxa_db:/usr/src/app/FUXA/server/_db \
  frangoteam/fuxa:latest

# npm 部署
npm install @frangoteam/fuxa
cd node_modules/@frangoteam/fuxa
npm start

# Docker Compose（FUXA + InfluxDB）
# fuxa:
#   image: frangoteam/fuxa:latest
#   ports: ["1881:1881"]
# influxdb:
#   image: influxdb:latest
#   environment: [INFLUXDB_DB=fuxa]
```

### E. 参考链接

- GitHub 仓库: https://github.com/frangoteam/FUXA
- 官方网站: https://frangoteam.org
- npm 包: https://www.npmjs.com/package/@frangoteam/fuxa
- Docker Hub: https://hub.docker.com/r/frangoteam/fuxa
- GitHub Releases: https://github.com/frangoteam/FUXA/releases

### F. 文档版本信息

- 文档版本: 1.0
- 生成日期: 2026-07-13
- 作者: AUDESYS Team
- 审核状态: 草稿
- 信息来源: FUXA GitHub 仓库、npm 包页面、frangoteam.org 官网、Docker Hub、GitHub Issues 和 Release Notes
- 标注"待确认"的信息需进一步验证

> FUXA 是 AUDESYS 研究 Web 原生 SCADA/HMI 工程实践最重要的开源参考。其 SVG 编辑器、协议适配器架构和部署模式为 AUDESYS Studio 和 Runtime 的设计提供了可运行的对照样本。

