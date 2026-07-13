# OPC UA — 工业通信统一架构

> **IEC 62541 标准化 — 从 OPC Classic 到统一架构的工业 4.0 通信标准**
> 标准化组织：OPC Foundation（成立于 1996 年）
> OPC UA 首次发布：2008 年（规范 Part 1-8）
> 当前版本：OPC UA 1.05（2022 年发布）
> 许可：规范免费获取，实现需遵循 OPC Foundation 合规要求
> 官网：opcfoundation.org

---

## 1. 产品画像

### 1.1 OPC 基金会与历史沿革

OPC Foundation 成立于 1996 年，最初由五家工业自动化公司（Fisher-Rosemount、Intellution、Opto 22、Rockwell Software、Siemens）联合创建，旨在解决 Windows 平台上工业应用程序之间数据交换的互操作性问题。

**OPC Classic 时代（1996-2008）**：

OPC（OLE for Process Control）最初基于 Microsoft 的 COM/DCOM（Component Object Model / Distributed COM）技术。这一选择在当时是自然的——Windows 是工业上位机的主要操作系统，COM 提供了进程间通信的标准机制。

| OPC Classic 规范 | 全称 | 功能 | 现状 |
|----------------|------|------|------|
| OPC DA (Data Access) | 数据访问规范 | 实时过程数据的读取和写入 | 已被 OPC UA 取代，但仍广泛存在于旧系统中 |
| OPC HDA (Historical Data Access) | 历史数据访问 | 历史趋势数据和聚合查询 | 功能整合进 OPC UA Historical Access |
| OPC A&E (Alarms & Events) | 报警与事件 | 过程报警通知、操作员确认 | 功能整合进 OPC UA Alarms & Conditions |
| OPC Commands | 命令规范 | 控制命令下发 | 功能整合进 OPC UA Methods |
| OPC XML-DA | XML 数据访问 | Web Service 风格的数据访问 | 过渡性技术，已被 OPC UA 替代 |
| OPC UA (Unified Architecture) | 统一架构 | 完整重构的服务导向架构 | 当前主流标准 |

COM/DCOM 的固有限制最终推动了 OPC UA 的诞生：
1. **Windows 平台锁定**：COM/DCOM 是 Microsoft 专有技术，无法跨平台
2. **DCOM 配置复杂**：分布式 OPC 系统的 DCOM 安全配置被视为工业 IT 的噩梦
3. **安全模型过时**：COM 安全模型设计于 1990 年代，不满足现代工业网络安全需求
4. **防火墙穿透困难**：DCOM 使用动态端口分配，难以被防火墙策略管理
5. **数据建模能力缺乏**：OPC DA 仅能表示扁平化的标签列表，无信息建模能力

**OPC UA 标准化进程**：

| 年份 | 里程碑 | 说明 |
|------|--------|------|
| 2003 | OPC UA 项目启动 | OPC Foundation 决定开发独立于 COM 的新一代架构 |
| 2006 | OPC UA 规范草案发布 | 首批 Part 1-8 规范草案供审查 |
| 2008 | OPC UA 1.00 发布 | 正式发布，成为 IEC 62541 标准的基础 |
| 2010 | IEC 62541 标准化 | OPC UA 被采纳为国际标准 IEC 62541 |
| 2015 | OPC UA 1.03 | 增加 PubSub 初步支持、HTTPS 传输 |
| 2017 | OPC UA 1.04 | PubSub 正式发布（UADP over UDP + MQTT broker）、新增 Nano/Micro 设备 Profile |
| 2020 | OPC UA 1.04 修订 | 安全增强、扩展的 Companion Spec 支持 |
| 2022 | OPC UA 1.05 | 最新版本，WebSocket 传输标准化、新的安全策略 |

### 1.2 OPC UA 与 OPC Classic 的根本区别

| 维度 | OPC Classic (DA/HDA/A&E) | OPC UA |
|------|------------------------|--------|
| 技术基础 | Microsoft COM/DCOM（Windows 专有） | 平台中立的服务导向架构（SOA） |
| 数据模型 | 扁平标签（Tag）列表 | 面向对象的信息模型（Address Space + 类型层次） |
| 发现机制 | 手动配置 OPC Server 的 ProgID/CLSID | 标准化的 Discovery Server（FindServers/GetEndpoints） |
| 传输协议 | DCOM（TCP 端口 135 + 动态端口） | opc.tcp (TCP port 4840), opc.https (443), WebSockets |
| 安全模型 | DCOM 安全（NTLM/Kerberos） | 多层安全：应用认证 (x509) + 用户认证 + 消息签名/加密 + 审计 |
| 平台支持 | Windows only | Windows, Linux, macOS, VxWorks, 嵌入式 RTOS, Android, iOS |
| 数据类型 | VARIANT（COM 变体类型，有限） | 扩展的类型系统（含枚举、结构体、多维数组、可选字段） |
| 数据访问 | 同步/异步 Read/Write | Read/Write + Subscription (发布/订阅) + MonitoredItem |
| 历史数据 | 独立规范（OPC HDA） | 内建于 OPC UA Part 11 |
| 报警 | 独立规范（OPC A&E） | 内建于 OPC UA Part 9 |
| 方法调用 | 无（OPC Commands 为独立规范） | 内建 Method 节点 + Call 服务 |
| 可扩展性 | 无标准扩展机制 | Companion Specification（伴随规范）+ 自定义类型系统 |

### 1.3 产品定位与核心价值主张

OPC UA 的定位从最初的「解决 Windows 上工业软件的互操作问题」演变为「工业 4.0 和 IIoT 的统一通信标准」。其核心价值主张包括：

1. **平台独立性**：从嵌入式传感器到企业云，同一套通信协议覆盖全栈
2. **安全优先设计**：从协议设计之初就内建多层安全（认证 + 加密 + 审计），非事后补充
3. **信息建模能力**：不只是传输数据，更传输数据的语义（类型、关系、元数据）
4. **向后兼容与向前扩展**：通过 Profile 和 Companion Spec 机制支持广泛的设备类型和行业需求
5. **德国工业 4.0 RAMI 4.0 的核心通信标准**：RAMI 4.0（Reference Architecture Model Industrie 4.0）将 OPC UA 指定为通信层唯一推荐标准

### 1.4 与 AUDESYS 的关系定位

OPC UA 对 AUDESYS 的参考价值主要在两个方面：
- **信息建模**：OPC UA 的 Address Space + Type System 为 AUDESYS HAL 的命名体系、组件接口模型提供设计参考
- **通信集成**：AUDESYS Runtime 对外暴露 OPC UA 接口是与其他工业系统互操作的关键
- **安全性**：OPC UA 的多层安全模型可参考用于 AUDESYS 的 HalQoS security_domain

参考价值评分：⭐⭐⭐⭐⭐ (5/5)

---

## 2. 技术特性

### 2.1 系统架构

OPC UA 采用服务导向架构（SOA），客户端通过服务调用访问服务器的数据和功能：

```
┌─────────────────────────────────────────────────────────────┐
│                     OPC UA Client (客户端)                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Client Application                                      │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │ │
│  │  │ 数据访问  │  │ 报警接收  │  │ 历史趋势分析         │ │ │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  OPC UA Client SDK (UA Stack)                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │ │
│  │  │ 序列化    │  │ 安全通道  │  │ 会话管理             │ │ │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  │ OPC UA Binary / JSON   │
                  │ opc.tcp / opc.https /  │
                  │ WebSocket              │
                  └───────────┬───────────┘
┌─────────────────────────────────────────────────────────────┐
│                     OPC UA Server (服务器)                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  OPC UA Server SDK (UA Stack)                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │ │
│  │  │ 反序列化  │  │ 安全通道  │  │ 会话管理             │ │ │
│  │  └──────────┘  └──────────┘  └──────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Server Application (服务器应用)                           │ │
│  │  ┌──────────────────────────────────────────────────────┐│ │
│  │  │              Address Space (地址空间)                  ││ │
│  │  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐ ││ │
│  │  │  │Objects │  │ Types  │  │ Views  │  │ Methods  │ ││ │
│  │  │  │(对象)  │  │(类型)  │  │(视图)  │  │(方法)    │ ││ │
│  │  │  └────────┘  └────────┘  └────────┘  └──────────┘ ││ │
│  │  └──────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  底层数据源 (PLC / DCS / 数据库 / 传感器...)                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 信息模型（Information Model）— 核心

OPC UA 的信息模型是其最独特的技术特征。它不是简单的数据传输协议，而是带语义信息的面向对象的数据建模框架。

**地址空间（Address Space）**：

Address Space 是 OPC UA Server 暴露给客户端的全部数据和元数据的集合。其中每个元素都是一个 Node（节点）。

**节点类型（Node Classes）**：

| 节点类型 | 说明 | 关键属性 | AUDESYS 对应概念 |
|---------|------|---------|---------------|
| **Object** | 结构化的数据容器（可包含 Variable/Method/其他 Object） | NodeId, BrowseName, DisplayName, EventNotifier | component（组件——一个控制器、一个传感器、一个执行器） |
| **Variable** | 数据的实际承载者（值 + 元数据） | Value, DataType, ValueRank, AccessLevel, MinimumSamplingInterval, Historizing | Pin（Signal 的值载体） |
| **Method** | 可调用的操作（类似函数调用） | InputArguments, OutputArguments, Executable, UserExecutable | RPC（远程可调用的操作） |
| **ObjectType** | Object 的类型定义（模板） | 定义其 Object 实例应包含的 Variable 和 Method | 函数块类型定义（FUNCTION_BLOCK） |
| **VariableType** | Variable 的类型定义 | 定义 Variable 的数据类型、值范围、工程单位 | 存储数据类型元数据 |
| **ReferenceType** | Reference 的类型定义 | 定义节点间关系的语义（Organizes, HasComponent, HasProperty 等） | HAL 组件间连接关系语义 |
| **DataType** | 数据类型定义 | 基本类型 (Int32, Float, String...) 或自定义结构体 | HAL 14 种统一类型 |
| **View** | Address Space 的过滤子集 | 按特定视角组织节点（如"维护视图"、"操作视图"） | 暂不适用（AUDESYS 面向运行时，非信息浏览） |

**核心节点标识符**：

- **NodeId**：节点的唯一全局标识符。可以是数字（Numeric, i=85）、字符串（String, "myTemp"）、GUID 或 Opaque（二进制）。NodeId 空间用 Namespace Uri 和 NamespaceIndex 隔离
- **BrowseName**：人类可读的有意义名称，用于在 Address Space 中浏览
- **DisplayName**：本地化（多语言）的显示名称

**地址空间的基本结构**（根节点下）：

```
Root (i=84)
├── Objects (i=85)          ← 所有实例对象（温度传感器、阀门、电机...）
│   ├── DeviceSet
│   │   ├── TemperatureSensor1
│   │   │   ├── CurrentValue (Variable)
│   │   │   ├── EngineeringUnits (Variable)
│   │   │   └── StatusCode (Variable)
│   │   └── Motor1
│   │       ├── Speed (Variable)
│   │       ├── Start (Method)
│   │       └── Stop (Method)
│   └── Server
├── Types (i=86)            ← 类型系统（所有 ObjectType, VariableType, DataType 定义）
│   ├── ObjectTypes
│   │   ├── BaseObjectType
│   │   ├── FolderType
│   │   └── AnalogItemType (含 EURange, EngineeringUnits, InstrumentRange)
│   ├── VariableTypes
│   │   ├── BaseDataVariableType
│   │   └── AnalogItemType (派生自 BaseDataVariableType)
│   ├── DataTypes
│   │   ├── BaseDataType
│   │   ├── Boolean, SByte, Byte, Int16, UInt16, Int32, UInt32, Int64, UInt64
│   │   ├── Float, Double, String, DateTime, Guid, ByteString
│   │   └── EUInformation (工程单位)
│   └── ReferenceTypes
│       ├── References (非层次化)
│       ├── HierarchicalReferences (层次化)
│       │   ├── Organizes
│       │   ├── HasComponent
│       │   ├── HasProperty
│       │   └── HasSubtype
│       └── NonHierarchicalReferences
│           ├── HasTypeDefinition
│           └── HasModellingRule
└── Views (i=87)            ← 地址空间的过滤视图
    └── MaintenanceView
        └── (仅显示维护相关的变量和报警)
```

**Reference（引用）机制**：

OPC UA 通过 Reference 定义节点间的语义关系。Reference 本身就是带类型的（ReferenceType），这是 OPC UA 信息模型的核心机制。

| Reference 类型 | 语义 | 示例 |
|--------------|------|------|
| Organizes | 组织层次（逻辑分组，文件夹结构） | Objects → DeviceSet → TemperatureSensor1 |
| HasComponent | 组件包含关系（强归属） | TemperatureSensor1 → CurrentValue（Variable 是其组成部分） |
| HasProperty | 属性关系（元数据，不可删除不可重命名） | CurrentValue → EngineeringUnits（元数据属性） |
| HasTypeDefinition | 类型定义关系 | TemperatureSensor1 → AnalogItemType（该 Object 的类型是什么） |
| HasSubtype | 类型继承关系 | AnalogItemType → BaseDataVariableType（子类型关系） |
| HasModellingRule | 建模规则（必选/可选） | 标记 Variable 是否为强制包含项 |

### 2.3 服务集（Service Sets）

OPC UA 定义了 37 种服务，分为 10 个服务集。如下为核心服务：

**Discovery Service Set（发现服务集）**：
- `FindServers`：客户端发现网络中可用的 OPC UA 服务器
- `GetEndpoints`：获取服务器的可用端点（Endpoint，包含协议、安全策略、认证方式）
- `RegisterServer`：服务器向 Discovery Server 注册自身

**Session Service Set（会话服务集）**：
- `CreateSession`：客户端与服务器建立安全会话（交换证书，协商安全参数）
- `ActivateSession`：激活会话（客户端认证——用户/密码或 x509 证书）
- `CloseSession`：关闭会话

**View Service Set（浏览/视图服务集）**：
- `Browse`：浏览 Address Space 的树形结构（客户端发现服务器上有哪些变量和对象）
- `BrowseNext`：分页浏览的后续请求
- `TranslateBrowsePathsToNodeIds`：将人类可读的路径（如 "/Objects/DeviceSet/TemperatureSensor1/CurrentValue"）转换为 NodeId

**Attribute Service Set（属性服务集）**：
- `Read`：读取节点的一个或多个属性值（如 Variable 的 Value、DataType、DisplayName）
- `Write`：写入节点的属性值
- `HistoryRead`：读取历史数据（原始数据、处理后的数据、事件）
- `HistoryUpdate`：写入历史数据

**MonitoredItem Service Set（监控项服务集）**：
- `CreateMonitoredItems`：在 Subscription 中创建监控项（指定要监控哪些 Variable 的变化）
- `ModifyMonitoredItems`：修改监控项的采样间隔、死区、触发条件
- `DeleteMonitoredItems`：删除监控项
- `SetMonitoringMode`：启用/禁用监控项
- `SetTriggering`：设置触发关系（一个监控项值变化触发其他监控项的报告）

**Subscription Service Set（订阅服务集）**：
- `CreateSubscription`：创建订阅（定义发布间隔、生命周期、最大通知数）
- `ModifySubscription`：修改订阅参数
- `DeleteSubscriptions`：删除订阅
- `Publish`：客户端轮询获取订阅的通知（服务器将变化数据打包为 NotificationMessage 返回）
- `Republish`：重传丢失的通知

**Method Service Set（方法服务集）**：
- `Call`：客户端调用服务器上 Object 暴露的 Method（带输入参数，返回输出参数）

**Query Service Set（查询服务集）**：
- `QueryFirst` / `QueryNext`：基于类型的查询（类似 SQL 查询 Address Space）

### 2.4 发布/订阅（PubSub）— IIoT 核心

OPC UA 1.04（2017 年引入）的 PubSub 是其进军 IIoT（工业物联网）的关键扩展。与传统 Client/Server 模式（一对一绑定式通信）不同，PubSub 支持一对多的松耦合通信模式。

**两种 PubSub 传输模式**：

**1. 无连接模式（Connectionless）：UADP over UDP**
- UADP（UA Datagram Protocol）—— OPC UA 自定义的 UDP 数据包格式
- 支持多播（Multicast）：一个 Publisher 通过 UDP 多播发送数据，多个 Subscriber 同时接收
- 典型延迟：1-10ms（局域网内）
- 典型带宽：1-100 Mbps
- 适用场景：机器对机器（M2M）实时通信、控制器间数据交换
- 不保证交付（与 Client/Server 模式的可靠连接不同）

**2. 代理模式（Broker-based）：MQTT / AMQP**
- 通过消息代理（Broker，如 Eclipse Mosquitto、EMQX）中转消息
- Publisher → Broker → Subscriber：彻底解耦发布者和订阅者
- MQTT：轻量级 IoT 协议，适合低带宽、高延迟网络（如广域网、云端）
- AMQP：企业级消息队列，适合高级路由和事务性消息
- 支持 JSON 编码（与云应用的兼容性好）和 UADP 编码（性能更优）

**PubSub 网络消息（NetworkMessage）结构**：

```
┌──────────────────────────────────────────────────────────────┐
│                    NetworkMessage Header                       │
│  ┌────────────────────┬───────────────────────────────────┐  │
│  │ PublisherId         │ DataSetWriterId                   │  │
│  │ (发布者标识)         │ (数据集写入者 ID)                    │  │
│  └────────────────────┴───────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                    DataSetMessage                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ DataSetMessage Header                                    │ │
│  │ ┌───────────────┬──────────────┬─────────────────────┐ │ │
│  │ │SequenceNumber  │ Timestamp    │ Status              │ │ │
│  │ │ (序列号)        │ (时间戳)     │ (状态)               │ │ │
│  │ └───────────────┴──────────────┴─────────────────────┘ │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ Payload (有效载荷)                                         │ │
│  │ ┌─────────────┬─────────────┬─────────────┬───────────┐│ │
│  │ │Field 1 Value│Field 2 Value│Field 3 Value│...        ││ │
│  │ │(Speed=1500) │(Temp=42.5)  │(Status=OK)  │           ││ │
│  │ └─────────────┴─────────────┴─────────────┴───────────┘│ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**对 AUDESYS 的直接参考**：OPC UA PubSub 的发布/订阅模式与 AUDESYS HAL 的 StreamChannel 原语存在精确的语义映射。PubSub 的 DataSetMessage 对应 StreamChannel 的一个数据帧。

### 2.5 安全模型

OPC UA 的安全设计是其区别于大多数工业通信协议的核心优势：

**分层安全模型**：

```
┌──────────────────────────────────────────────────────┐
│         Application Layer (应用层安全)                 │
│  ┌────────────────────────────────────────────────┐  │
│  │  用户认证 (User Authentication)                   │  │
│  │  ├── 用户名/密码                                   │  │
│  │  ├── x509 用户证书                                │  │
│  │  └── WS-SecurityToken (Web 服务)                  │  │
│  │  用户授权 (Authorization)                         │  │
│  │  ├── Role & Permission 模型                       │  │
│  │  └── Node 级别的读/写/执行权限控制                  │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│         Communication Layer (通信层安全)               │
│  ┌────────────────────────────────────────────────┐  │
│  │  应用认证 (Application Authentication)             │  │
│  │  └── x509 证书（客户端 ↔ 服务器双向认证）          │  │
│  │  消息安全 (Message Security)                      │  │
│  │  ├── Sign (签名 — 完整性 + 不可否认性)             │  │
│  │  ├── SignAndEncrypt (签名+加密 — 完整性 + 机密性) │  │
│  │  └── None (无安全 — 仅适合隔离网络)                │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│         Transport Layer (传输层安全)                   │
│  ┌────────────────────────────────────────────────┐  │
│  │  opc.tcp://  → UA Secure Conversation             │  │
│  │  opc.https:// → TLS (Transport Layer Security)    │  │
│  │  WebSocket   → WSS (WebSocket Secure over TLS)    │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**安全策略（Security Policies）**：

| 策略 | 签名算法 | 加密算法 | 密钥长度 | 安全强度 |
|------|---------|---------|---------|---------|
| None | 无 | 无 | — | 仅适合隔离系统（如单板测试台） |
| Basic128Rsa15 | RSA-SHA1 | AES128 | RSA 1024 | 已废弃（不再符合最低安全要求） |
| Basic256 | RSA-SHA1 | AES256 | RSA 1024 | 已废弃 |
| Basic256Sha256 | RSA-SHA-256 | AES256 | RSA 2048 | 已废弃（OPC UA 1.04 中弃用） |
| Aes128-Sha256-RsaOaep | RSA-OAEP-SHA256 | AES128-SHA256 | RSA 2048 | 推荐（当前生产环境标准） |
| Aes256-Sha256-RsaPss | RSA-PSS-SHA256 | AES256-SHA256 | RSA 4096 | 推荐（高安全场景） |

**审计（Audit）**：
OPC UA 服务器自动生成审计事件（Audit Event），记录所有安全相关操作：会话创建/关闭、用户认证成功/失败、变量写入（值的前后对比）、方法调用（调用参数和结果）。审计日志可用于合规性检查和事后安全分析。

**对 AUDESYS 的参考**：
- AUDESYS HalQoS 的 security_domain 标记（D16 决策）可以从 OPC UA 的多层安全模型中汲取分类思路
- OPC UA 的权限模型（Node 级别的读/写/执行控制）可直接映射到 AUDESYS 的 Signal 和 RPC 的权限检查
- OPC UA 的审计事件可参考用于 AUDESYS 工业调试桥的操作审计功能

### 2.6 传输协议选项

| 传输协议 | URI Scheme | 说明 | 典型应用 |
|---------|-----------|------|---------|
| **UA TCP** | opc.tcp:// | OPC UA 原生二进制协议。基于 TCP，默认端口 4840。最高性能（二进制编码，无额外封装）| 车间层、控制器间通信 |
| **HTTPS** | opc.https:// | 基于 HTTPS 的 OPC UA 二进制或 JSON 编码。支持标准 Web 安全 (TLS) | 企业层、通过防火墙的广域网通信 |
| **WebSocket** | —（新，OPC UA 1.05） | 基于 WebSocket 的二进制或 JSON 编码。允许浏览器直接作为 OPC UA 客户端 | Web HMI、云端仪表板 |

### 2.7 Profile 体系

OPC UA 通过 Profile（配置文件）机制定义设备的能力子集，确保不同复杂度的设备可以声称合规的最小功能集：

| Profile | 目标设备 | 核心能力 | 典型用例 |
|---------|---------|---------|---------|
| **Nano Embedded Device Server** | 极受限嵌入式设备（< 256KB RAM） | 仅含最基础的 UA 服务（Read/Write 基本类型变量），无类型系统，无会话安全 | 智能传感器（温度/压力变送器）、RFID 阅读器 |
| **Micro Embedded Device Server** | 受限嵌入式设备（< 1MB RAM） | 含基础浏览（Browse）、订阅（Subscription）、x509 证书安全 | 嵌入式控制器、边缘网关 |
| **Standard UA Server** | 全功能工业 PC/服务器 | 完整的 Address Space、类型系统、历史数据、报警和条件、方法调用 | SCADA 服务器、MES 接口、DCS 网关 |
| **Global Discovery Server** | 工厂全范围的发现服务 | 注册全厂所有 UA Server 的端点信息 | 大型工厂的集中设备发现和管理 |
| **PubSub Publisher** | 数据发布者 | 通过 UDP (UADP) 或 MQTT (JSON/UADP) 发布数据 | 高速数据流发布（如振动监测、功率分析） |
| **PubSub Subscriber** | 数据订阅者 | 接收 UDP 多播或 MQTT broker 的订阅数据 | 数据分析、云平台 |

---

## 3. 功能概览

### 3.1 核心能力矩阵

| 能力 | 状态 | 说明 |
|------|------|------|
| 数据访问 (Data Access) | 成熟 | 读/写实时过程变量，含模拟量（Engineering Units/EURange）和数字量 |
| 历史数据 (Historical Access) | 成熟 | 原始数据查询、聚合数据处理、事件历史 |
| 报警与条件 (Alarms & Conditions) | 成熟 | 多级报警状态机、搁置 Shelving、确认 Acknowledge、对话 Dialog |
| 方法调用 (Methods) | 成熟 | 远程可调用操作，带输入/输出参数 |
| 订阅 (Subscription) | 成熟 | 数据变化驱动的推送通知，含死区 Deadband 和采样间隔 |
| 发布/订阅 (PubSub) | 可用 | UDP 多播 + MQTT/AMQP broker 两种模式 |
| 发现 (Discovery) | 成熟 | 自动发现网络中的 OPC UA 服务器及其端点 |
| 审计 (Audit) | 成熟 | 安全操作自动记录（创建会话、写入变量、方法调用） |
| 冗余 (Redundancy) | 可用 | 客户端透明故障切换（Transparent Failover）|
| 聚合 (Aggregation) | 可用 | 服务器端数据聚合（平均、最小、最大、计数等） |
| 反向连接 (Reverse Connect) | 可用 | 客户端发起连接（穿透防火墙/NAT） |

### 3.2 数据访问（Data Access）详细

每个 Variable 节点的关键属性：

- `Value`：当前值（任意 OPC UA 数据类型）
- `DataType`：值的精确数据类型（如 Int32, Float, String）
- `ValueRank`：值的维度（-2=Any, -1=Scalar 标量, 0=Unknown, 1=一维数组, 2=二维数组...）
- `AccessLevel`：当前客户端的有效访问权限（可读/可写/可订阅）
- `UserAccessLevel`：当前用户的有效访问权限
- `MinimumSamplingInterval`：该变量允许的最小采样间隔（ms，硬件限制）
- `Historizing`：是否记录历史数据
- `StatusCode`：值的质量标志（Good/Bad/Uncertain + 子状态码）

**模拟量项（AnalogItem）**：
从 `BaseDataVariableType` 派生的变量类型，附加工程单位语义：
- `EURange`：工程单位范围（如 -50°C 到 150°C）
- `EngineeringUnits`：工程单位（如 °C, MPa, rpm）
- `InstrumentRange`：仪器的物理量程上限
- 值在读取时自动从原始值（如 4-20mA ADC 计数）转换为工程单位

**离散量项（DiscreteItem）**：
- `TwoStateDiscreteType`：二态开关量（Open/Closed, On/Off）
- `MultiStateDiscreteType`：多态离散量（如电机的 Off/Starting/Running/Stopping/Fault 状态）

### 3.3 报警与条件（Alarms & Conditions）

OPC UA 的 A&C 模型是极其完善的报警系统设计：

**报警状态机**：

```
  Inactive (非激活)           Active (激活)
       │                          │
       ├──────────────────────────┤  条件满足/不满足
       │                          │
       ▼                          ▼
  Acknowledged (已确认)      Unacknowledged (未确认)
       │                          │
       ├── Confirm (确认) ────────┤
       │                          │
       ▼                          ▼
   Shelved (搁置)            Active+Unacknowledged
   (定时或手动搁置)
```

**关键报警概念**：
- **Condition**：特定状态（如温度过高、压力过低、网络断线）
- **Alarm**：需要操作员注意的 Condition
- **Event**：状态变化通知（无状态跟踪）
- **Shelving**：暂时搁置报警（如已知的维护窗口期内忽略报警）
- **Acknowledge**：操作员确认知晓报警
- **Confirm**：系统自动确认（当条件自动恢复时）
- **Area/Plant Hierarchy**：按生产区域组织报警（方便报警分组和过滤）

### 3.4 历史访问（Historical Access）

OPC UA 支持三种历史数据查询模式：

1. **历史原始数据（Historical Raw）**：存储的原始采样点（每个采样点的时间戳 + 值 + 质量）
2. **历史处理后数据（Historical Modified）**：带额外处理信息的采样点（如插值、人工修正标记）
3. **历史聚合数据（Historical Aggregate）**：服务器端聚合计算（如每小时的均值、最大值、标准差），客户端无需拉取所有原始数据
4. **历史事件（Historical Events）**：历史报警和事件记录的查询

---

## 4. 现状与生态

### 4.1 标准化与采用状态

| 维度 | 数据 |
|------|------|
| 当前 OPC UA 版本 | 1.05（2022 年发布） |
| IEC 标准化 | IEC 62541（全套标准，与 OPC UA 规范同步更新） |
| 德国 Industrie 4.0 RAMI | OPC UA 是唯一推荐的通信标准 |
| EU 工业云倡议 | GAIA-X / Catena-X 使用 OPC UA 作为数据交换协议 |
| 美国 IIC（Industrial Internet Consortium） | OPC UA 为核心连接框架之一 |
| 全球 NAMUR | 推荐 OPC UA 用于过程自动化通信 |
| 中国智能制造标准体系 | OPC UA 被纳入 GB/T 33863 系列标准 |

### 4.2 伴随规范（Companion Specifications）生态

OPC UA 的伴随便携是行业标准化的重要成果——与特定行业的组织合作，定义该行业专属的信息模型：

| 伴随规范 | 制定组织 | 行业/领域 |
|---------|---------|---------|
| **ADI** | OPC Foundation + 分析仪器制造商 | 分析仪器（光谱仪、色谱仪）的通用信息模型 |
| **FDI** | FDI Cooperation (FieldComm Group + OPCF + PROFIBUS + FDT) | 现场设备集成（统一 EDD 和 FDT 的下一代设备集成标准） |
| **PLCopen** | PLCopen | IEC 61131-3 PLC 信息模型（含程序组织单元发布/状态） |
| **PackML** | OMAC | 包装机械的状态机和数据模型 |
| **Weihenstephan** | TU München | 饮料灌装线的统一状态模型 |
| **AutoID** | AIM-D | 自动识别设备（条码扫描器、RFID）|
| **Robotics** | VDMA | 机器人系统的通用信息模型 |
| **Machine Vision** | VDMA | 机器视觉系统模型 |
| **Machine Tools (umati)** | VDW | 机床（CNC）的通用接口规范 |
| **EUROMAP 77/83** | EUROMAP | 塑料和橡胶机械（注塑机）信息模型 |
| **ISA-95 / IEC 62264** | ISA / IEC | 企业与控制系统集成（MES 与 DCS 数据交换） |
| **MDIS** | MCS-DCS Interface Standard | 海底生产控制系统接口标准 |
| **Powerlink** | EPSG | 电力行业通信 |

### 4.3 SDK 生态

| SDK | 语言 | 许可证 | 说明 |
|-----|------|--------|------|
| **open62541** | C（99 标准） | MPL v2.0 | 最活跃的开源 OPC UA 实现。支持 Server + Client + PubSub。广泛用于嵌入式设备和 IoT 项目 |
| **UA-.NET Standard** | C#/.NET | GPL v2 + 商业许可 | OPC Foundation 官方维护。全面支持 Server + Client + PubSub |
| **node-opcua** | TypeScript/JavaScript | MIT | 最广泛使用的 Node.js OPC UA 实现。支持 Server + Client |
| **Python opcua-asyncio** | Python | LGPL | 基于 asyncio 的 Python 实现。适合快速原型和数据采集脚本 |
| **S2OPC** | C | Apache 2.0 | 专为安全关键系统设计的 OPC UA 实现（由 ANSSI 和 Airbus 开发） |
| **Unified Automation SDK** | C/C++/Java/.NET | 商业许可 | 最成熟的商业实现。行业标杆级性能和可靠性 |
| **Softing SDK** | C++/.NET | 商业许可 | 德国老牌自动化公司的商业实现 |
| **Prosys OPC UA SDK** | Java | 商业许可 | 领先的 Java 实现 |
| **C++ SDK (open62541++)** | C++ | 多样化 | 多个基于 open62541 的 C++ 封装 |

### 4.4 与 OPC UA over TSN 的整合

OPC UA over TSN（Time-Sensitive Networking）是 2020 年以来的重点发展方向。TSN 是一组 IEEE 802.1 标准，在标准以太网上提供确定性延迟和时钟同步。

OPC UA over TSN 结合：
- OPC UA（通信协议 + 信息模型）—— 定义"说什么"
- TSN（确定性网络）—— 保证"何时到达"

这使 OPC UA 能够满足现场级（Field-level）通信的实时性要求，直接挑战 PROFINET、EtherCAT 等传统工业以太网协议的地位。

---

## 5. 市场定位

### 5.1 与其他工业通信协议的竞争分析

| 维度 | OPC UA | MQTT | DDS | PROFINET / EtherCAT |
|------|--------|------|-----|---------------------|
| 信息模型 | 强大的信息建模能力（类型系统、引用、伴随便携） | 无（仅主题字符串） | 基于类型的主题（DDS Topic Types） | 有限的语义（设备配置 GSD/GSDML 文件） |
| 通信模式 | Client/Server + PubSub | Pub/Sub only | Pub/Sub (DCPS) | 生产者/消费者 + 周期性 IO 数据交换 |
| 实时性 | 中等（UA TCP 1-10ms）+ TSN 可达到 < 1ms | 低（MQTT broker 中转延迟） | 低延迟（< 100μs，DDS 实时实现） | 极高（EtherCAT 100μs，PROFINET IRT 31.25μs） |
| 安全 | 多层完整安全（认证、加密、签名、审计） | 依赖 TLS（基本安全） | 安全扩展（DDS Security） | 有限（工业网络物理隔离为主） |
| 平台 | 完全平台中立 | 完全平台中立 | 完全平台中立 | 专用硬件/ASIC（从站侧需要专用芯片） |
| 云集成 | UA TCP 难以穿透防火墙，需 UA 代理或 PubSub MQTT | 天然云友好（已有 MQTT brokers 于云端） | 需要 DDS 路由服务连接云端 | 不支持 |
| 规模 | 从传感器到云的全栈 | 从设备到云的全栈 | 系统内通信，大规模分布式系统 | 单控制域内（< 100m 线缆） |
| 开销 | 中等（二进制 UA 编码） | 低（MQTT 最小 2 字节头） | 中等至高（DDS RTPS 协议） | 极低（EtherCAT 处理 on-the-fly） |

**定位总结**：
- OPC UA：工业互操作性的"通用语言"——用于系统间集成、企业级数据交换和云连接
- MQTT：IIoT 设备到云的轻量级数据管道——用于低功耗传感器和云端数据湖
- DDS：高可靠性分布式系统——用于国防、航空航天、自动驾驶
- PROFINET / EtherCAT：高速实时现场总线——用于运动控制和亚毫秒级 I/O 刷新

OPC UA 不是要替代 PROFINET 或 EtherCAT，而是作为"横向集成"的标准（跨系统、跨平台的数据交换），而现场总线继续负责"纵向"的实时设备控制。OPC UA over TSN 试图打破这个分工，但目前仍处于部署初期。

---

## 6. 产品特色

### 6.1 信息建模而非数据传输

OPC UA 最核心的差异化特征：它不仅传输数据（像 Modbus 那样），还传输数据的语义。Address Space 中的每个 Variable 都带有数据类型、工程单位、值范围、仪器量程、质量标志——接收方不需要额外的"标签映射表"或"Excel 配置文档"来理解数据的含义。OPC UA 服务器本身即数据字典。

### 6.2 安全优先设计

与 Modbus（无安全）、EtherNet/IP（可选安全）等协议不同，OPC UA 在协议设计阶段就将安全内建为核心特性，而非事后添加。每一层都有对应的安全机制——传输层 TLS、通信层消息签名加密、应用层用户认证和权限管理。这种多层安全设计是让 OPC UA 被工业网络信息安全标准 (IEC 62443) 采用的关键原因。

### 6.3 从传感器到云

OPC UA Nano Embedded Device Profile 可在 < 256KB RAM 的传感器上运行，同时 Standard UA Server 可在数据中心运行。同一套协议、同一套信息模型，覆盖了嵌入式设备 → 边缘控制器 → SCADA → MES → ERP → 云的全栈。

### 6.4 伴随规范的生态力量

伴随规范（Companion Specification）使领域专家可以定义行业专属的信息模型，而不需要修改 OPC UA 核心规范。这意味着 OPC UA 的适用范围可以无限扩展——只要某个行业组织与 OPC Foundation 合作定义该行业的信息模型即可。

### 6.5 向后兼容与向前扩展

OPC UA Profile 机制允许渐进式采用——从最简单的 Nano Server 开始，逐步增加功能（Micro → Standard → PubSub）。这种机制避免了对设备制造商的"全有或全无"要求。

---

## 7. 对 AUDESYS 的参考价值

### 7.1 OPC UA Address Space vs AUDESYS HAL 命名体系 (⭐⭐⭐⭐⭐)

OPC UA 的 Address Space 和节点类型系统为 AUDESYS HAL 的组件命名和接口模型提供了最完整的工业化参考：

| OPC UA 概念 | AUDESYS HAL 映射 | 分析 |
|------------|-----------------|------|
| Object 节点 (Organizes 层次) | component (组件——一个控制器/传感器/执行器) | OPC UA Objects 树对应 HAL 组件拓扑 |
| Variable 节点 | Pin（Signal 的值载体）| 每个 Variable 的 Value + DataType + Quality 对应 HAL Pin 的值 + 类型 + 状态 |
| Method 节点 | RPC 原语（远程过程调用）| OPC UA Call 服务对 HAL RPC 的语义（请求/响应、超时）
| HasComponent 引用 | component.interface 的子 Pin 包含关系 | 组件接口下的 Pin 集合 |
| HasProperty 引用 | Pin 的元数据（数据类型、工程单位、范围）| 配置面（Config Barrier）的元数据属性 |
| ReferenceType 层次 | Signal/StreamChannel 连接关系语义 | OPC UA 的类型化引用可参考用于 HAL 连接的语义标注 |
| Type System (ObjectType/VariableType) | 函数块类型定义（FUNCTION_BLOCK 模板）| OPC UA 类型系统直接映射到 IEC 61131-3 类型层次 |
| Browse Service | HalDiscovery（组件发现与端点枚举）| 浏览器发现服务器上有哪些变量 → 发现组件有哪些 Pin |
| 地址空间层次 | component.interface.name 的 Hierarchical 命名 | Objects → DeviceSet → Component → Interface → Pin |

### 7.2 OPC UA PubSub vs AUDESYS StreamChannel (⭐⭐⭐⭐⭐)

OPC UA PubSub 的发布/订阅模式与 AUDESYS 的 StreamChannel 原语存在精确的结构映射：

| OPC UA PubSub | AUDESYS StreamChannel | 映射分析 |
|--------------|----------------------|---------|
| Publisher | StreamChannel 写入者 (Writer) | 多个 Publisher 可写入同一 StreamChannel |
| Subscriber (UDP Multicast) | StreamChannel 读取者 (Reader) | 多播接收 = StreamChannel 的"多读"语义 |
| DataSetMessage | StreamChannel 的一帧数据 | 含 SequenceNumber + Timestamp + 值数组 |
| SequenceNumber | StreamChannel 帧序列号 | 用于检测丢帧和乱序 |
| PublisherId | HalDiscovery 的服务标识符 | 识别 StreamChannel 的来源 |
| WriterGroup | 多个 StreamChannel 的聚合发布组 | 同周期的多个流数据一起发布 |
| UADP over UDP | amw_zenoh transport (UDP/IP) | 高性能传输层 |
| MQTT Broker | amw_mqtt transport (可选) | 云友好的传输层 |

**关键设计洞察**：
1. OPC UA PubSub 的 DataSetMessage 包含 SequenceNumber 和 Timestamp——这正是 AUDESYS StreamChannel 需要的数据帧结构。AUDESYS 可以直接借鉴 DataSetMessage 的帧格式设计 StreamChannel 的帧头。
2. UADP 的零拷贝设计（二进制编码直接写入 UDP 负载）对应 AUDESYS 的 FlatBuffers 策略（D19）——性能优先场景避免 JSON 编码开销。
3. MQTT broker 模式验证了"通过消息代理解耦发布者和订阅者"的架构可行性，与 amw 的 HalTransport trait 可替换性设计一致。

### 7.3 OPC UA Method Call vs AUDESYS RPC (⭐⭐⭐⭐)

| OPC UA Method | AUDESYS RPC | 对照 |
|-------------|------------|------|
| Call 服务（请求/响应） | RPC 请求/响应 | 完全一致的语义 |
| InputArguments (类型化参数列表) | RPC 请求参数（类型化） | 参数序列化需求一致 |
| OutputArguments | RPC 响应结果 | 返回类型一致 |
| Executable 标志 | 运行时可调用性检查 | Config Barrier + LockLevel (D17) |
| UserExecutable 标志 | RBAC 权限控制 | 操作员/工程师权限区分 |
| StatusCode (Bad_MethodInvalid...) | RPC 错误码 | 建议采用类似结构化的错误类型 |

### 7.4 OPC UA Security vs AUDESYS HalQoS security_domain (⭐⭐⭐⭐)

| OPC UA 安全特性 | AUDESYS HalQoS | 分析 |
|---------------|---------------|------|
| 应用认证 (x509 证书) | security_domain: "trusted" | 节点间互信验证 |
| 用户认证 (user/pwd + x509) | RBAC 权限模型 | 操作员/工程师/管理员权限分级 |
| 消息签名 (Sign) | 消息完整性验证 | 防篡改——数据面可选，控制面必需 |
| 消息加密 (SignAndEncrypt) | 消息机密性 | 网络隔离场景可能不需要 |
| 审计 (Audit) | 工业调试桥操作审计 | 记录所有配置变更和控制操作 |
| 安全策略 (Security Policy) | HalQoS.security_policy 字段 | 建议增加——本地/隔离/保护不同策略 |

### 7.5 AUDESYS 应采纳的 OPC UA 设计模式

| 采纳 | OPC UA 模式 | AUDESYS 实现建议 |
|------|-----------|----------------|
| ✅ 直接采纳 | Address Space 层次化命名 (Objects → ... → Variable) | component.interface.pin 的三级命名体系 |
| ✅ 直接采纳 | Type System（值类型 + 工程单位 + 范围） | HAL 14 种类型的元数据扩展（每个 Pin 可附带 EngineeringUnits 和 Range） |
| ✅ 直接采纳 | DataSetMessage 帧结构 (SeqNum + Timestamp + Values[]) | StreamChannel 的数据帧格式直接参考 |
| ✅ 直接采纳 | 结构化 StatusCode（Good/Bad/Uncertain → 子状态码） | Pin 值的质量标志代替简单的 OK/Error |
| ✅ 借鉴修改 | Method Call → RPC | 添加超时机制和降级策略（OPC UA Method 无内建超时） |
| ✅ 借鉴修改 | PubSub Broker 模式 → amw transport | 使用 amw 的 HalTransport trait 实现不同的 broker（Zenoh 作为主要实现） |
| ⚠️ 谨慎采纳 | 完整 Address Space（含 Browse 导航） | Phase 1 不需要（增加运行时开销），Phase 2+ 可考虑 |
| ❌ 不采纳 | 每个服务器运行一个 UA Stack（重型协议栈） | AUDESYS 使用轻量级 FlatBuffers + Zenoh（更低的内存和 CPU 开销） |

### 7.6 AUDESYS 应避免的 OPC UA 设计陷阱

| OPC UA 陷阱 | 对 AUDESYS 的教训 |
|------------|-----------------|
| **协议栈复杂度**：open62541 单库超过 50 万行 C 代码，商用 UA 栈的学习和集成成本极高 | AUDESYS HAL 必须保持轻量——amw transport trait 的小接口足以替换底层传输 |
| **信息过载**：Address Space 的完整浏览和查询机制在实时系统中产生不可预测的负载 | HAL Discovery 应返回最小信息集（组件名 + Pin 列表 + 类型），不需要浏览整个拓扑 |
| **安全性能税**：x509 证书验证和消息加密在每个请求上增加数百微秒延迟 | 安全设计应分层：控制面（RPC/Config）加密，数据面（Signal/StreamChannel）可选加密 |
| **XML Schema 依赖**：OPC UA 规范使用 XML Schema 定义类型（虽然运行时使用二进制编码） | AUDESYS 类型定义使用 FlatBuffers schema（.fbs 文件），比 XML Schema 更简洁且编译时可用 |
| **向后兼容压力**：OPC UA 1.00 的某些已废弃安全策略（如 Basic128Rsa15）仍被要求支持 | AUDESYS 从零开始无需向后兼容包袱——直接定义当前最优安全策略 |

### 7.7 总结：OPC UA 对 AUDESYS 的关键参考权重

| 参考领域 | 重要性 | 适用阶段 | 关键行动 |
|---------|--------|---------|---------|
| Address Space 命名层级 → HAL 命名体系 | P0 | Phase 1 | 以 Objects/Component/Interface/Pin 模式设计 HAL 组件命名 |
| PubSub DataSetMessage → StreamChannel 帧结构 | P0 | Phase 1 | 借鉴 SeqNum+Timestamp+Values[] 设计数据帧 |
| Method Call → RPC 语义 | P0 | Phase 1 | 参考被调用方法的错误码体系和参数模型 |
| Type System → HAL 类型元数据 | P1 | Phase 1 | 为 Pin 类型增加工程单位和范围的元数据字段 |
| Security 多层模型 → HalQoS | P1 | Phase 2 | security_domain 的分类参考 OPC UA 的安全策略 |
| Audit Event → 调试审计 | P2 | Phase 2 | RPC 调用和 Config 变更的审计记录 |
| OPC UA over TSN → 确定性网络 | P3 | Phase 3+ | 为 amw 预留 TSN transport 的 trait 接口 |
| Companion Spec 生态 → AUDESYS 行业扩展 | P3 | Phase 3+ | AUDESYS 可参考伴随便携的行业信息模型定义机制 |

---

> **文档版本**：1.0 | **编写日期**：2026-07-13
> **数据源**：OPC Foundation 官方规范 (Part 1-14), open62541 文档, OPC UA 1.05 发布说明, IEC 62541 标准, OPC Foundation 市场资料
> **状态**：基于 OPC UA 1.05 (2022) + 2026 年已知的伴随便携和 SDK 状态
> **（待确认）标注**：部分市场份额数据和采用率基于行业报告估计

---

### 补充说明

#### 关于 OPC UA 与 MQTT 的"协议之争"

工业物联网领域长期存在 "OPC UA vs MQTT" 的争论。实际上这是对两种协议定位的误解——它们不是竞争关系，而是互补关系：

- **OPC UA**：标准化信息模型 + 安全的 Client/Server 通信。适合需要"数据语义"（不只是值）和"安全可控"（谁在什么时候写入了什么）的场景
- **MQTT**：轻量级发布/订阅管道。适合简单的"传感器值 → 云端"数据流，不需要语义信息

OPC UA 1.04 之后的 PubSub MQTT 模式将两者融合——使用 OPC UA 定义信息模型（变量名、类型、单位），使用 MQTT 作为传输管道（低开销的发布/订阅）。这正是 AUDESYS 应该采取的模式：HAL 定义了 Signal/StreamChannel/RPC 的语义（类似 OPC UA 的信息建模），amw transport 实现了底层的传输协议（类似 OPC UA PubSub 的 MQTT/UADP 传输选择）。

#### 关于 open62541 的技术评估

open62541 是目前最活跃的开源 OPC UA 实现（GitHub 2,500+ Stars，活跃维护）。其技术特性：

- 纯 C99 实现（最大程度跨平台）
- 内存模型可定制（静态内存池 / 动态分配 / 自定义分配器），适合嵌入式
- 支持 Server + Client + PubSub
- 编译后 Server 库约 200-300KB（取决于启用功能）
- Rust 绑定存在但非官方维护（open62541-sys + 社区 rust 封装）

AUDESYS 如果需要对外暴露 OPC UA 接口（与第三方系统集成），可以考虑通过 open62541 的 FFI 桥接（类似 D19 决策中 C++ FFI 桥接限非 RT 线程的策略），在 I/O 通信线程中运行 OPC UA 服务器，通过 Signal/StreamChannel 与 RT 线程交换数据。

#### OPC UA over TSN 的发展现状（2026）

截至 2026 年，OPC UA over TSN 在以下行业显示了进展：

- 控制器制造商（B&R、Beckhoff、Siemens）已发布支持 OPC UA over TSN 的硬件原型和固件
- 实验室环境和展会演示中展示了确定性控制器间通信（< 100μs 抖动）
- 但大规模生产部署仍处于早期阶段——TSN 交换机的成本、配置复杂性和多厂商互操作性问题仍需时间解决
- AUDESYS Phase 1-2 不需要关注 OPC UA over TSN，可在 Phase 3 评估时预留 amw_tsn transport trait

#### OPC UA FX (Field eXchange) 倡议

OPC Foundation 于 2023 年启动了 OPC UA FX (Field eXchange) 倡议，旨在将 OPC UA 扩展到现场级（Controller-to-Controller, C2C 和 Controller-to-Device, C2D）通信。这是 OPC UA 从"工厂骨干网"向下延伸到"现场设备层"的战略方向。

OPC UA FX 核心组件：
- UAFX Connection Manager：自动化建立控制器之间和控制器与设备之间的安全通信连接
- UAFX PubSub：基于 TSN 的确定性发布/订阅，用于控制器间的周期性数据交换
- UAFX Safety：基于 OPC UA Safety 规范的功能安全通信（面向 SIL2/SIL3 应用）
- UAFX Motion：面向运动控制的确定性通信（亚毫秒级同步）

这意味 OPC UA 将在未来几年内与 EtherCAT、PROFINET 等传统现场总线在"实时控制"领域直接竞争。对 AUDESYS 的长期影响：如果 UAFX 成为主流，AUDESYS 的 amw 应考虑预留 UAFX transport trait 接口。

#### OPC UA 在 AUDESYS 架构中的最佳位置

OPC UA 不应是 AUDESYS HAL 的"内部通信协议"（内部使用更轻量的 FlatBuffers + Zenoh），而应是 HAL 的"对外互操作接口"：

```
AUDESYS Runtime
  ┌──────────────────────────┐
  │  RT 线程 (控制逻辑)       │
  │  Signal ← FlatBuffers →  │  内部：高性能零拷贝通信
  │  StreamChannel ← Zenoh →  │
  └──────────┬───────────────┘
             │
  ┌──────────▼───────────────┐
  │  OPC UA Gateway           │  对外：标准工业互操作
  │  (UA Server on I/O 线程)  │
  │  暴露：Address Space       │
  │  - Objects → 组件树       │
  │  - Variables → Pin 值     │
  │  - Methods → RPC 端点     │
  └──────────────────────────┘
```

这样设计的好处：
- 内部通信保持轻量和高性能（FlatBuffers + Zenoh）
- 外部系统通过 OPC UA 标准化接口访问（SCADA、MES、第三方系统）
- OPC UA Gateway 运行在非 RT 线程，不影响控制循环的确定性
- 符合 D19 多语言策略——OPC UA Gateway 可以是 C++ 实现（通过 open62541），与 Rust RT 核心通过 FFI 桥接

#### OPC UA 的时间序列数据与 AUDESYS StreamChannel

OPC UA 的 Subscription 和 PubSub 机制提供了时间序列数据（time-series data）的服务质量保证：
- Publishing Interval：客户端可指定数据的推送间隔（对应 StreamChannel 的帧率）
- Sampling Interval：每个 MonitoredItem 的采样速率（对应 Pin 的采样周期）
- Keep-Alive Count / Lifetime Count：订阅的生命周期管理（对应 StreamChannel 的连接超时和保活机制）
- Queue Size：缓冲队列大小（对应 StreamChannel 的缓冲容量）

OPC UA Subscription 的设计为 AUDESYS StreamChannel 的 QoS 参数提供了可直接参考的模板。AUDESYS 的 HalQoS 应借鉴 Publishing/Sampling/Lifetime 三个核心参数。

#### OPC UA 标准库的规模与复杂度评估

OPC UA 作为一个"完整的"工业通信标准，其规范文档极其庞大：
- 核心规范 Part 1-14：超过 1,500 页
- 伴随便携规范：每个 Companion Spec 额外 50-200 页
- open62541 代码库：超过 500,000 行 C 代码
- node-opcua 代码库：超过 200,000 行 TypeScript 代码

对于 AUDESYS 而言，这强化了一个关键设计原则：AUDESYS HAL 不应尝试实现完整的 OPC UA 协议栈。HAL 的核心（Signal/StreamChannel/RPC + amw）应保持轻量和聚焦，通过可选的 OPC UA Gateway 提供外部互操作。正如 Linux 内核保持最小化和模块化，OPC UA 的庞大协议栈应作为外部模块而非 HAL 的内核部分。

#### 对 AUDESYS 的最终建议

1. **Phase 1**：HAL 内部通信使用 FlatBuffers + Zenoh（轻量、高性能）。不引入 OPC UA 依赖性
2. **Phase 2**：构建独立的 OPC UA Gateway 模块（基于 open62541 FFI），在非 RT 线程暴露 Address Space 接口
3. **Phase 2+**：使 Gateway 的 Address Space 自动映射 HAL 的组件拓扑（component.interface.pin → Objects/Component/Interface/Variable）
4. **Phase 3**：评估是否需要原生 OPC UA PubSub 支持（如果工业 4.0 生态要求 OPC UA 作为现场级通信协议）
5. **贯穿**：持续监控 OPC UA FX (Field eXchange) 的发展，如果其成为 EtherCAT/PROFINET 的替代方案，为 amw 预留 amw_uafx transport trait

#### OPC UA 与 MODACS/AUDESYS 历史的关系

AUDESYS 与 MODACS 的分离（2026-07）要求完全去 MODACS 化。OPC UA 作为工业互操作标准，不包含任何 MODACS 特定引用，可以安全地被 AUDESYS 采用为外部集成接口标准。

---

> 本文档为 AUDESYS 项目技术参考文档系列之一。
