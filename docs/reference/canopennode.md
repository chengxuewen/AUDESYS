# CANopenNode

> **开源 CANopen 协议栈 — ANSI C 嵌入式从站/主站实现**
> 维护者：Janez Paternoster（CANopenNode 组织）
> 当前版本：v4.0（2024-2025 持续更新）
> 许可：Apache 2.0
> 官网：https://canopennode.github.io

---

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: CANopenNode
- **开发商/组织**: Janez Paternoster 创建，CANopenNode GitHub 组织维护
- **首次发布年份**: 约 2010 年
- **当前状态**: 活跃维护，持续更新
- **仓库地址**: https://github.com/CANopenNode/CANopenNode
- **许可证**: Apache 2.0
- **社区**: CANopenNode GitHub 组织（含 CANopenLinux、CANopenDemo、CANopenEditor 等子项目）

#### 项目背景

CANopenNode 是开源社区中最成熟、最完整的 CANopen 协议栈实现。CANopen 是基于 CAN（Controller Area Network）总线的高层协议，由 CiA（CAN in Automation）标准化（EN 50325-4 / CiA 301）。CANopen 广泛应用于工业自动化、医疗设备、工程车辆、机器人等领域，是欧洲最主流的工业现场总线协议之一。

CANopenNode 项目诞生的背景是：
1. **CANopen 协议栈的商业授权成本高**：主流 CANopen 实现（如 IXXAT、Port's CANopen）需要数千美元的授权费
2. **嵌入式系统对 CANopen 需求的增长**：2010 年代，基于 STM32 等 ARM MCU 的嵌入式系统对 CANopen 支持的需求激增
3. **开源 CAN 基础设施的成熟**：Linux SocketCAN 的普及（2008 年进入主线内核）为 CANopen 协议栈提供了稳定的 CAN 硬件抽象层
4. **CiA 协议的标准化**：CiA 301 v4.2、CiA 302、CiA 304、CiA 305 等标准的完善为开源实现提供了明确的技术规范

CANopenNode 从一开始就采用模块化设计：核心协议栈（CANopenNode）与硬件驱动分离，用户只需提供 CAN 驱动和定时器驱动即可在任何 MCU 上运行。

#### 与商业 CANopen 协议栈对比

| 维度 | CANopenNode | IXXAT CANopen | Port CANopen | MicroCANopen |
|------|------------|--------------|-------------|-------------|
| 许可证 | Apache 2.0 | 商业 | 商业 | 商业 |
| 授权费 | 免费 | $3000-10000 | $2000-5000 | $1000-3000 |
| 主站功能 | 有限 | 完整 | 完整 | 无 |
| 从站功能 | 完整 | 完整 | 完整 | 完整 |
| 协议合规 | 通过 CiA CTT | 认证 | 认证 | 认证 |
| 技术支持 | 社区 | 厂商 | 厂商 | 厂商 |
| 目标平台 | 任意 MCU | 商业 | 商业 | 小型 MCU |

### 1.2 产品定位与核心价值主张

CANopenNode 定位为 **免费、开源、跨平台、经过合规测试的 CANopen 嵌入式协议栈**。核心价值主张：

1. **完全免费**: Apache 2.0 许可证，商业使用无限制
2. **ANSI C 实现**: 高度可移植，支持任意 MCU 架构
3. **模块化架构**: 按需启用/禁用协议组件，最小化 ROM/RAM 占用
4. **CiA 合规**: 通过 CANopen Conformance Test Tool 测试
5. **完整功能集**: 支持 NMT、PDO、SDO、EMCY、SYNC、TIME、LSS、SRDO 等全部标准协议
6. **非阻塞设计**: 所有代码非阻塞，适合实时系统集成

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| 嵌入式开发者 | 工业设备 CANopen 从站开发 | 低成本、合规、可移植 |
| 工业自动化厂商 | 伺服驱动器、I/O 模块、传感器 | 商业友好的 Apache 2.0 许可 |
| 机器人开发者 | 关节伺服、传感器网络 | 实时性、确定性 |
| 汽车电子 | 电动汽车 CAN 通信 | 经过验证的协议实现 |
| 工程机械 | 分布式 I/O 控制 | 多节点、长距离 |

### 1.4 许可证模型

| 组件 | 许可证 | 说明 |
|------|--------|------|
| CANopenNode 核心 | Apache 2.0 | 商业友好，可自由使用 |
| CANopenLinux | Apache 2.0 | Linux 平台实现 |
| CANopenEditor | Apache 2.0 | 对象字典编辑器 |
| CANopenDemo | Apache 2.0 | 示例和教程 |

### 1.5 项目成熟度评估

| 评估维度 | 状态 | 说明 |
|---------|------|------|
| 功能完整性 | 高 | 支持 CiA 301/302/304/305/309 |
| 代码质量 | 高 | 模块化 ANSI C，Doxygen 文档 |
| 文档完整性 | 高 | Doxygen 生成的 HTML 文档 + README + 教程 |
| 测试覆盖 | 中 | 通过 CiA CTT 测试，但社区测试有限 |
| 社区贡献 | 中 | 约 20 活跃贡献者 |
| 商业支持 | 无 | 社区驱动 |

---

## 2. 技术特性

### 2.1 核心架构

CANopenNode 采用 **对象字典（Object Dictionary）驱动** 的架构：

```
+------------------------------------------------------------+
|  CANopen 设备                                              |
|                                                            |
|  +------------------+  +--------------------------------+  |
|  | CANopenNode 核心  |  | 对象字典 (Object Dictionary)   |  |
|  |                  |  |                                |  |
|  | - NMT 从站       |  | 0x1000-0x1FFF: 通信参数       |  |
|  | - PDO 管理       |  | 0x2000-0x5FFF: 制造商特定     |  |
|  | - SDO 服务器     |  | 0x6000-0x9FFF: 标准设备描述   |  |
|  | - EMCY 处理      |  |                                |  |
|  | - SYNC 同步      |  +--------------------------------+  |
|  | - TIME 时间戳     |                                      |
|  | - LSS 层设置     |  +--------------------------------+  |
|  | - SRDO 安全      |  | CAN 硬件抽象层 (CO_driver)     |  |
|  +------------------+  | CAN 控制器驱动程序              |  |
|                         +--------------------------------+  |
+------------------------------------------------------------+
```

**关键设计原则**：
- 所有代码非阻塞：无 busy-wait、无阻塞 I/O
- 对象字典是所有数据的中心：PDO 映射、SDO 访问、应用数据均通过 OD 接口
- 硬件抽象层（CO_driver）完全分离：移植到新平台只需实现 5-10 个函数

### 2.2 协议栈文件结构

CANopenNode 的源代码按 CiA 标准编号组织子目录：

| 目录 | 对应的 CiA 标准 | 协议 |
|------|---------------|------|
| 301/ | CiA 301 | 应用层和通信协议（NMT、PDO、SDO、EMCY、SYNC、TIME）|
| 303/ | CiA 303-3 | LED 指示灯 |
| 304/ | CiA 304 | 安全相关数据对象（SRDO、GFC）|
| 305/ | CiA 305 | 层设置服务（LSS）|
| 309/ | CiA 309-3 | ASCII 命令接口（CANopen 网关）|

### 2.3 NMT（网络管理）

NMT（Network Management）是 CANopen 设备状态机管理的核心：

```
                    +-----------+
                    | 初始化     |
                    +-----+-----+
                          |
                          v
                    +-----------+
       +----------> | 预操作     | <----------+
       |            +-----+-----+            |
       |                  |                  |
       |                  v                  |
       |            +-----------+            |
       +----------- | 操作      | -----------+
                    +-----+-----+
                          |
                          v
                    +-----------+
                    | 停止      |
                    +-----------+
```

**NMT 状态转换**：
- **初始化（Initialisation）**: 设备上电后自动进入，初始化对象字典
- **预操作（Pre-operational）**: 允许 SDO 通信，禁止 PDO 通信
- **操作（Operational）**: 允许所有通信（PDO 激活）
- **停止（Stopped）**: 仅限 NMT 通信

### 2.4 PDO（过程数据对象）

PDO 用于高速广播实时数据，无协议开销：

| PDO 类型 | 通信方式 | 典型用途 |
|---------|---------|---------|
| TPDO1-4 | 事件/定时/SYNC 触发 | 发送实时过程数据 |
| RPDO1-4 | 接收 CAN 消息 | 接收实时过程数据 |
| 动态映射 | 运行时配置 PDO 映射 | 灵活数据组织 |

**PDO 通信规则**：
- 最高优先级：COB-ID 0x180-0x1FF（TPDO）
- 无协议开销：数据直接从对象字典映射到 CAN 帧
- 支持事件触发、定时触发、SYNC 同步触发、远程帧触发
- 位映射（bitwise mapping）支持

### 2.5 SDO（服务数据对象）

SDO 用于访问对象字典中所有参数，支持三种传输模式：

| 模式 | 传输数据量 | 适用场景 |
|------|-----------|---------|
| 加速传输（Expedited）| 1-4 字节 | 小数据快速访问 |
| 分段传输（Segmented）| 无限 | 大数据传输 |
| 块传输（Block）| 无限 | 批量数据传输 |

SDO 采用客户端/服务器模型：
- SDO 服务器（Server）：从站设备，响应 SDO 请求
- SDO 客户端（Client）：主站设备，发起 SDO 请求

### 2.6 EMCY（紧急消息）

紧急消息用于报告设备内部错误：

| 错误码 | 含义 | 示例 |
|--------|------|------|
| 0x0000 | 无错误 | 错误恢复 |
| 0x10xx | 通用错误 | 存储器错误 |
| 0x20xx | 电流/电压 | 过流 |
| 0x30xx | 温度 | 过温 |
| 0x40xx | 通信 | CAN 总线关闭 |
| 0x50xx | 设备配置 | 参数错误 |
| 0x60xx | 设备特定 | 制造商定义 |

### 2.7 SYNC 和 TIME 同步

| 同步机制 | 精度 | 说明 |
|---------|------|------|
| SYNC | 毫秒级 | 同步 PDO 传输，广播消息 |
| TIME | 毫秒级 | 时间戳同步，符合 CiA 301 |
| 无同步 | 事件驱动 | 适合非实时 I/O |

### 2.8 LSS（层设置服务）

LSS 提供节点 ID 和波特率的在线配置：

| LSS 服务 | 说明 |
|---------|------|
| LSS 从站 | 响应 LSS 主站的配置请求 |
| LSS 主站 | 修改网络节点的 ID 和波特率 |
| LSS FastScan | 自动发现网络节点 |
| 波特率配置 | 在线修改 CAN 波特率 |

### 2.9 SRDO（安全相关数据对象）

SRDO 提供安全相关的通信：

| 特性 | 说明 |
|------|------|
| 标准 | EN 50325-5, CiA 304 |
| CRC | 16 位 CRC 校验 |
| 冗余 | 双通道冗余通信 |
| 超时 | 监控接收超时 |
| GFC | 全局故障安全命令 |

---

## 3. 功能概览

### 3.1 核心协议支持

| 协议 | 功能 | 状态 |
|------|------|------|
| NMT 从站 | 启动/停止/复位设备 | 已实现 |
| NMT 主站 | 简易 NMT 主站 | 已实现 |
| 心跳（Heartbeat）| 生产者/消费者错误控制 | 已实现 |
| 节点守护（Node Guarding）| 旧版错误控制 | 已实现 |
| PDO | 4 个 TPDO + 4 个 RPDO，动态映射 | 已实现 |
| SDO 服务器 | 加速/分段/块传输 | 已实现 |
| SDO 客户端 | 访问远程设备对象字典 | 已实现 |
| EMCY 生产者/消费者 | 紧急消息 | 已实现 |
| SYNC 生产者/消费者 | 同步信号 | 已实现 |
| TIME 生产者/消费者 | 时间戳同步 | 已实现 |
| LSS 从站 | 节点 ID 和波特率设置 | 已实现 |
| LSS 主站 | 配网其他节点 | 已实现 |
| LSS FastScan | 自动发现 | 已实现 |
| CANopen 网关 | CiA 309-3 ASCII 命令接口 | 已实现 |
| SRDO | 安全数据对象 | 已实现 |
| GFC | 全局故障安全命令 | 已实现 |
| 非易失存储 | 对象字典数据持久化 | 已实现 |

### 3.2 工具链

| 工具 | 功能 | 许可证 |
|------|------|--------|
| CANopenEditor | 对象字典编辑器（GUI）| Apache 2.0 |
| cocomm | CANopen 命令行工具 | Apache 2.0 |
| canopend | CANopen Linux 守护进程 | Apache 2.0 |
| Doxygen 文档 | 自动生成的 API 文档 | — |

---

## 4. 现状与生态

### 4.1 当前开发状态

| 组件 | 维护状态 | 说明 |
|------|---------|------|
| CANopenNode | 活跃 | 核心协议栈持续更新 |
| CANopenLinux | 活跃 | Linux 平台实现 |
| CANopenDemo | 中等 | 示例和教程 |
| CANopenEditor | 活跃 | 对象字典编辑器 |
| CANopenPIC | 维护 | PIC 微控制器移植 |

### 4.2 关联生态

**CANopen 组织**：https://www.can-cia.org 提供完整的 CANopen 标准文档和技术规范。

**Linux CAN 生态**：
- SocketCAN（Linux 内核 CAN 子系统）
- can-utils（CAN 调试工具集）
- CANopenNode 与 SocketCAN 深度集成

**RTOS 移植**：
- FreeRTOS：通过 CANopenDemo 支持
- RT-Thread：canfestival-rtt 包（基于 CanFestival）
- Zephyr：Zephyr 内置 CAN 驱动支持

**硬件平台支持**：
- STM32 F0/F1/F2/F3/F4/F7/H7
- PIC 24/32
- dsPIC 33
- AVR
- MCF5282（Freescale ColdFire）
- Linux x86_64 / ARM（树莓派）

### 4.3 相关技术栈

| 技术 | 关系 | 说明 |
|------|------|------|
| SocketCAN | Linux CAN 接口 | CANopenNode 通过 SocketCAN 访问 CAN 硬件 |
| CANopenEditor | 对象字典编辑 | 图形化配置工具 |
| can-utils | CAN 调试 | candump、cansend、cangen 等 |
| CANopen 安全 | EN 50325-5 | SRDO 和 GFC 协议 |

---

## 5. 市场定位

### 5.1 在 CANopen 生态中的位置

| 方案 | 许可证 | 主站 | 从站 | 价格 | 合规 |
|------|--------|------|------|------|------|
| CANopenNode | Apache 2.0 | 有限 | 完整 | 免费 | 通过 CTT |
| CanFestival | LGPL | 完整 | 完整 | 免费 | 部分 |
| IXXAT CANopen | 商业 | 完整 | 完整 | $3000+ | 认证 |
| Port CANopen | 商业 | 完整 | 完整 | $2000+ | 认证 |
| EmSA CANopen | 商业 | 完整 | 完整 | $1000+ | 认证 |

### 5.2 竞品对比

| 对比项 | CANopenNode | CanFestival | 商业栈 |
|--------|------------|------------|--------|
| 许可证 | Apache 2.0 | LGPL/GPL | 商业 |
| 代码质量 | 高 | 中 | 高 |
| 文档 | 好 | 一般 | 好 |
| 合规 | 通过 CTT | 部分 | 认证 |
| 社区 | 活跃 | 维护 | N/A |
| 可移植性 | 高 | 中 | 低 |

---

## 6. 产品特色

### 6.1 核心差异化特征

| 特征 | CANopenNode | 说明 |
|------|------------|------|
| 非阻塞设计 | 所有代码无阻塞 | 适合实时系统集成 |
| 模块化 | 按需启用/禁用 | 最小化资源占用 |
| 可移植性 | 纯 ANSI C | 任意 MCU 架构 |
| 合规性 | 通过 CiA CTT | 工业级可靠性 |
| 商业友好 | Apache 2.0 | 无限制商业使用 |
| 完整协议 | CiA 301/304/305/309 | 一站式解决方案 |

### 6.2 对象字典架构

CANopenNode 的对象字典采用分层设计：

```
对象字典 (OD)
├── 通信参数区 (0x1000-0x1FFF)
│   ├── 0x1000 设备类型
│   ├── 0x1001 错误寄存器
│   ├── 0x1005 COB-ID SYNC 消息
│   ├── 0x1008 制造商设备名
│   ├── 0x1009 硬件版本
│   ├── 0x100A 软件版本
│   ├── 0x1018 身份对象
│   ├── 0x1017 心跳生产者时间
│   ├── 0x1400-0x1BFF PDO 通信参数
│   └── 0x1600-0x1BFF PDO 映射参数
├── 制造商特定区 (0x2000-0x5FFF)
│   └── 应用自定义参数
└── 标准设备描述区 (0x6000-0x9FFF)
    ├── CiA 401 数字 I/O 模块
    ├── CiA 402 驱动/运动控制
    └── CiA 406 编码器
```

---

## 7. 对 AUDESYS 参考价值

### 7.1 CANopen 协议架构 vs AUDESYS HAL 设计

CANopen 的协议架构与 AUDESYS HAL 的通信原语有诸多相似之处：

| CANopen 概念 | AUDESYS 等价 | 参考价值 |
|-------------|-------------|---------|
| PDO（过程数据对象）| Signal | 高速广播实时数据，无协议开销 |
| SDO（服务数据对象）| RPC | 参数化访问，按需传输 |
| EMCY（紧急消息）| 异常 Signal | 带优先级的事件通知 |
| SYNC | StreamChannel 同步 | 网络级同步机制 |
| 对象字典 | HalDiscovery | 运行时自描述数据结构 |
| 心跳 | HalQoS Liveliness | 节点存活监控 |

### 7.2 PDO 映射对 Signal 的启示

CANopen 的 PDO 动态映射机制对 AUDESYS 的 Signal 设计有直接参考价值：

| PDO 特性 | AUDESYS Signal 对应设计 |
|---------|----------------------|
| 运行时配置 PDO 映射 | Signal 应支持运行时的发布/订阅绑定 |
| 事件触发传输 | StreamChannel 支持水位线触发 |
| SYNC 同步传输 | StreamChannel 支持周期同步 |
| 位映射（bitwise mapping）| Signal 支持位级打包 |

### 7.3 对象字典 vs HalDiscovery

CANopen 的对象字典提供了设备能力的完整自描述，AUDESYS 的 HalDiscovery 可参考：

| 对象字典特性 | AUDESYS HalDiscovery 对应 |
|------------|-------------------------|
| 0x1000 设备类型 | HalDiscovery 设备类型标识 |
| 0x1008 设备名 | 字符串标识 |
| 0x1018 身份对象 | 厂商/产品/序列号 |
| 0x1400 PDO 通信参数 | Signal 通信参数 |
| 0x1600 PDO 映射参数 | Signal 到物理引脚的映射 |

### 7.4 NMT 状态机 vs AUDESYS 设备状态

CANopen 的 NMT 状态机（初始化 → 预操作 → 操作 → 停止）为 AUDESYS 的设备生命周期管理提供了参考模型：

| NMT 状态 | AUDESYS 对应 | 说明 |
|---------|-------------|------|
| 初始化 | 设备上电/加载 | 加载配置、初始化 HAL |
| 预操作 | 配置中 | 允许 RPC 配置，禁止实时数据 |
| 操作 | 运行中 | 允许所有通信 |
| 停止 | 停止 | 仅限管理通信 |

### 7.5 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 高 | 10+ 年开发，通过 CiA CTT 测试 |
| 代码质量 | 高 | 模块化 ANSI C，Doxygen 文档 |
| AUDESYS 参考 | 高 | 对象字典、PDO/Signal 映射、NMT 状态机 |
| 学习价值 | 高 | CANopen 协议栈完整实现 |
| 生产准备 | 高 | Apache 2.0 许可，商业友好 |

CANopenNode 是 AUDESYS 设计 HAL 通信层时最重要的参考实现之一，特别是其对象字典驱动的架构、PDO 映射机制和 NMT 状态机模型。

---

> **本文档基于 2026 年 7 月的公开信息编写。CANopenNode 版本和功能以 GitHub 仓库为准。**


### 2.10 对象字典接口详解

CANopenNode 的对象字典接口（CO_ODinterface.h/.c）提供了灵活的数据访问方式：

```c
// 对象字典访问函数
OD_getU8(OD_entry* entry, OD_subIndex_t subIndex);
OD_setU8(OD_entry* entry, OD_subIndex_t subIndex, U8 value);
OD_getU16(OD_entry* entry, OD_subIndex_t subIndex);
OD_setU16(OD_entry* entry, OD_subIndex_t subIndex, U16 value);
OD_getU32(OD_entry* entry, OD_subIndex_t subIndex);
OD_setU32(OD_entry* entry, OD_subIndex_t subIndex, U32 value);

// 回调函数注册
OD_setWriteCallback(OD_entry* entry, OD_writeCallback_t cb);
OD_setReadCallback(OD_entry* entry, OD_readCallback_t cb);
```

| 访问方式 | 说明 | 性能 |
|---------|------|------|
| 直接访问 | 通过指针操作内存 | 最快 |
| 函数访问 | 通过 get/set 函数 | 快 |
| 回调访问 | 触发读写回调 | 中等 |
| SDO 访问 | 通过网络协议 | 慢 |

### 2.11 NMT 从站状态机实现

CANopenNode 的 NMT 从站状态机在 CO_NMT_Heartbeat.c 中实现：

```c
// NMT 状态转换处理（简化）
void CO_NMT_process(CO_NMT_t* nmt, CO_CANrxMsg_t* msg) {
    CO_NMT_internalState_t newState;

    switch (msg->data[0]) {
        case NMT_CMD_START:
            newState = CO_NMT_OPERATIONAL;
            break;
        case NMT_CMD_STOP:
            newState = CO_NMT_STOPPED;
            break;
        case NMT_CMD_ENTER_PREOP:
            newState = CO_NMT_PRE_OPERATIONAL;
            break;
        case NMT_CMD_RESET_NODE:
            newState = CO_NMT_INITIALISATION;
            break;
        case NMT_CMD_RESET_COMM:
            newState = CO_NMT_INITIALISATION;
            break;
    }

    // 执行状态转换
    CO_NMT_setState(nmt, newState);
}
```

**心跳生产者实现**：

```c
void CO_NMT_heartbeatTimer_cb(CO_NMT_t* nmt) {
    // 发送心跳消息
    CO_CANtxBuf_t* buffer = CO_CANtxBufferInit(
        nmt->CANptr,          // CAN 通道
        0,                    // RTR = 否
        1,                    // DLC = 1 字节
        CO_EM_NON,            // 非紧急
        nmt->nodeId + 0x700,  // COB-ID = 0x700 + NodeID
        0                     // 同步标志
    );

    // 设置心跳数据（NMT 状态）
    buffer->data[0] = nmt->state;

    // 发送 CAN 消息
    CO_CANsend(nmt->CANptr, buffer);
}
```

### 2.12 PDO 动态映射实现

CANopenNode 支持运行时修改 PDO 映射参数，通过对象字典回调实现：

```c
// PDO 映射条目
typedef struct {
    U16 index;      // 对象字典索引
    U8 subIndex;    // 子索引
    U8 length;      // 数据位长度
} CO_PDO_mapping_t;

// TPDO 配置
typedef struct {
    U32 cobID;              // COB-ID
    U8 transmissionType;    // 传输类型
    U16 inhibitTime;        // 禁止时间 (100us 单位)
    U16 eventTimer;         // 事件定时器 (ms)
    CO_PDO_mapping_t mapping[8]; // 映射表
} CO_TPDO_config_t;
```

**PDO 传输类型**：

| 类型 | 值 | 触发条件 |
|------|---|---------|
| 同步非循环 | 0 | 收到 SYNC 后，数据变化才发送 |
| 同步循环 | 1-240 | 每 N 个 SYNC 发送一次 |
| 事件触发 | 255 | 数据变化立即发送 |
| RTR 触发 | 252-254 | 远程帧请求触发 |
| 非循环同步 | 253 | 同步但不循环 |

### 2.13 SDO 块传输

CANopenNode 支持 SDO 块传输（block transfer），提高大数据传输效率：

```
SDO 块传输流程：

客户端 (主站)                    服务端 (从站)
    |                               |
    |-- 块下载请求 (initiate) ------->|
    |<-- 块确认 (CRC) ---------------|
    |-- 数据序列 (block) ----------->|
    |   [数据帧 1-127]               |
    |<-- 块响应 (ACK/NACK) ----------|
    |-- 数据序列 (block) ----------->|
    |   [数据帧 1-127]               |
    |   ...                          |
    |<-- 块结束 (end) ---------------|
    |-- SDO 结果 ------------------->|
```

### 2.14 CiA 309-3 ASCII 命令接口

CANopenNode 的 ASCII 命令接口（CO_gateway_ascii.h/.c）实现了 CiA 309-3 标准：

| 命令 | 功能 | 示例 |
|------|------|------|
| SDO 读取 | [1] SDO 读操作 | SDO 读 0x02 0x1017 0x00 i16 |
| SDO 写入 | [1] SDO 写操作 | SDO 写 0x02 0x1017 0x00 i16 1000 |
| NMT 操作 | [2] NMT 命令 | NMT 启动 0x02 |
| LSS 操作 | [3] LSS 命令 | LSS 配置 0x02 125K |
| 心跳监控 | [4] 心跳查询 | 心跳 0x02 |

---

## 4. 现状与生态 (续)

### 4.4 支持的硬件平台

| 架构 | 平台 | 移植状态 |
|------|------|---------|
| ARM Cortex-M3 | STM32F1 | 通过 CANopenDemo 支持 |
| ARM Cortex-M4 | STM32F4 | 通过 CANopenDemo 支持 |
| ARM Cortex-M7 | STM32H7 | 通过 CANopenDemo 支持 |
| PIC24/32 | Microchip | 独立移植 |
| dsPIC33 | Microchip | 独立移植 |
| AVR | Atmel | 独立移植 |
| ColdFire | MCF5282 | 独立移植 |
| Linux x86_64 | PC 平台 | 通过 CANopenLinux 支持 |
| Linux ARM | 树莓派 | 通过 CANopenLinux 支持 |

### 4.5 CANopenDemo 示例结构

CANopenDemo 是学习 CANopenNode 的最佳起点：

| 示例 | 功能 | 前置条件 |
|------|------|---------|
| 基础示例 | 最小 CANopen 设备 | 仅需 C 编译器 |
| STM32 + FreeRTOS | RTOS 集成示例 | STM32 开发板 |
| Linux 示例 | SocketCAN 集成 | Linux + CAN 硬件 |
| CiA 401 I/O | 数字/模拟 I/O 设备 | CANopen 网络 |

---

## 5. 市场定位 (续)

### 5.3 与 CiA 设备配置文件的兼容性

| 设备配置文件 | CANopenNode 支持 | 说明 |
|------------|----------------|------|
| CiA 401 (I/O) | 完整 | 数字/模拟 I/O 模块参考 |
| CiA 402 (驱动) | 有限 | 运动控制需要额外实现 |
| CiA 406 (编码器) | 有限 | 编码器配置文件参考 |
| CiA 404 (测量) | 有限 | 测量设备接口 |

### 5.4 合规性详细说明

| CiA 标准 | 覆盖范围 | 测试方法 |
|---------|---------|---------|
| CiA 301 v4.2 | 应用层和通信协议 | CTT v3.0 |
| CiA 302 | 附加功能 | CTT 可选测试 |
| CiA 304 | 安全相关数据 | SRDO 测试 |
| CiA 305 | LSS 层设置 | LSS 测试套件 |
| CiA 309-3 | ASCII 网关 | 功能验证 |

---

## 7. 对 AUDESYS 参考价值 (续)

### 7.2 SYNC 同步机制 vs AUDESYS StreamChannel

CANopenNode 的 SYNC 同步机制对 AUDESYS 的 StreamChannel 同步设计有直接参考价值：

| SYNC 特性 | 实现 | AUDESYS 对应 |
|-----------|------|-------------|
| 广播 SYNC 消息 | 生产者发送 0x080 COB-ID | StreamChannel 同步信号 |
| PDO 同步传输 | 收到 SYNC 后统一发送 | 批处理数据帧 |
| 非循环同步 | 仅数据变化时更新 | 事件驱动 StreamChannel |
| 周期同步 | 固定间隔发送 | 定时 StreamChannel |

### 7.3 非阻塞架构对 AUDESYS RT 线程的启示

CANopenNode 的所有协议组件采用非阻塞设计，每个组件提供一个 `process()` 函数：

```c
// CANopenNode 的轮询式非阻塞处理
while (1) {
    CO_NMT_process(nmt, rxMsg);
    CO_PDO_process(pdo, rxMsg);
    CO_SDOserver_process(sdo, rxMsg);
    CO_EM_process(em, rxMsg);
    CO_HBconsumer_process(hbc, rxMsg);
    // ... 更多协议组件
    sleep_ms(1);
}
```

AUDESYS 的 RT 线程可参考此模式：每个 RT 周期轮询所有 Signal/StreamChannel/RPC 处理函数，确保确定性执行时间。

### 7.4 对象字典 vs AUDESYS HalDiscovery

| OD 区域 | 用途 | AUDESYS HalDiscovery 对应 |
|---------|------|------------------------|
| 0x1000-0x1FFF | 通信参数 | Signal/StreamChannel 配置 |
| 0x2000-0x5FFF | 制造商特定 | 设备特有 HAL 参数 |
| 0x6000-0x9FFF | 标准设备 | 标准 I/O 配置文件 |
| 0x5000-0x5FFF | 网络参数 | 网络配置 |

### 7.5 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 高 | 10+ 年，通过 CiA CTT 认证 |
| 代码质量 | 高 | ANSI C, Doxygen, 模块化 |
| AUDESYS 参考 | 高 | 对象字典、PDO/Signal、非阻塞架构 |
| 学习价值 | 高 | CANopen 协议栈完整蓝本 |
| 生产准备 | 高 | Apache 2.0, 商业友好 |

CANopenNode 的对象字典驱动架构和非阻塞协议处理模式，是 AUDESYS 设计 HalDiscovery 和 RT 线程模型时最重要的参考实现之一。特别是其 PDO 映射机制与 AUDESYS Signal 的运行时绑定设计理念高度一致。

---

> **本文档基于 2026 年 7 月的公开信息编写。CANopenNode 版本和功能以 GitHub 仓库 (https://github.com/CANopenNode/CANopenNode) 为准。**


### 2.15 存储管理

CANopenNode 的存储子系统（CO_storage.h/.c）提供对象字典数据的非易失保存：

| 存储类型 | 实现 | 说明 |
|---------|------|------|
| CO_storageEeprom | EEPROM 块设备 | 通过 eeprom.h 接口访问 |
| CO_storageRam | RAM 存储 | 掉电丢失 |
| 自动加载 | 上电时从 EEPROM 恢复 | 保持配置持久性 |

### 2.16 错误处理

CANopenNode 的错误处理通过 CO_Emergency.h/.c 和 CO_Error.h/.c 实现：

```c
// 紧急消息对象
typedef struct {
    U16 errorCode;        // 错误码 (CiA 301 定义)
    U8 errorRegister;     // 错误寄存器 (0x1001)
    U32 infoCode;         // 附加信息码
    CO_CANtxBuf_t* txBuff; // CAN 发送缓冲区
} CO_Emergency_t;

// 错误历史
typedef struct {
    U16 errors;           // 错误计数
    time_t lastOccurred;  // 最近错误时间
    U16 lastErrorCode;    // 最近错误码
} CO_ErrorHistory_t;
```

### 2.17 LED 指示灯 (CiA 303-3)

CANopenNode 的 LED 指示灯模块（CO_LEDs.h/.c）符合 CiA 303-3 标准：

| LED 状态 | 含义 | 对应 NMT 状态 |
|---------|------|-------------|
| 熄灭 | 设备未上电 | — |
| 单闪 | 预操作状态 | Pre-operational |
| 双闪 | 初始化完成 | Initialisation |
| 绿灯常亮 | 操作状态 | Operational |
| 红灯常亮 | 紧急状态 | — |
| 红绿交替 | 启动中 | Boot-up |

### 2.18 CANopenNode 各组件文件调用关系

```
CANopen.h/.c (主入口)
├── CO_config.h (配置)
├── CO_driver.h (CAN 硬件抽象)
├── CO_NMT_Heartbeat.h/.c (NMT + 心跳)
├── CO_PDO.h/.c (PDO 管理)
│   └── CO_fifo.h/.c (FIFO 缓冲区)
├── CO_SDOserver.h/.c (SDO 服务器)
├── CO_SDOclient.h/.c (SDO 客户端)
├── CO_Emergency.h/.c (紧急消息)
├── CO_HBconsumer.h/.c (心跳消费者)
├── CO_SYNC.h/.c (同步)
├── CO_TIME.h/.c (时间戳)
├── CO_LSS.h + CO_LSSmaster.h/.c + CO_LSSslave.h/.c (LSS)
├── CO_SRDO.h/.c + CO_GFC.h/.c (安全)
├── CO_gateway_ascii.h/.c (网关)
├── CO_storage.h/.c (存储)
├── CO_trace.h/.c (跟踪)
└── CO_LEDs.h/.c (指示灯)
```

---

## 6. 产品特色 (续)

### 6.3 可配置性

CANopenNode 的配置通过 CO_config.h 中的 `CO_config_t` 结构体控制：

```c
// 配置结构体
typedef struct {
    U32 configFlags;           // 启用/禁用协议组件
    U8 NMT_startupState;       // 启动后的 NMT 状态
    U16 heartbeatProducerTime; // 心跳时间 (ms)
    U8 SYNC_producer;          // 是否作为 SYNC 生产者
    U16 SYNC_time;             // SYNC 周期 (us)
    // 更多配置项...
} CO_config_t;
```

**配置标志位**：

| 标志 | 功能 | 默认 |
|------|------|------|
| CO_CONFIG_NMT | NMT 从站 | 启用 |
| CO_CONFIG_PDO | PDO 通信 | 启用 |
| CO_CONFIG_SDO_SRV | SDO 服务器 | 启用 |
| CO_CONFIG_SDO_CLI | SDO 客户端 | 禁用 |
| CO_CONFIG_EM | 紧急消息 | 启用 |
| CO_CONFIG_HB_CONS | 心跳消费者 | 禁用 |
| CO_CONFIG_SYNC | SYNC 处理 | 禁用 |
| CO_CONFIG_LSS | LSS 服务 | 禁用 |
| CO_CONFIG_SRDO | 安全数据对象 | 禁用 |
| CO_CONFIG_GATEWAY | ASCII 网关 | 禁用 |

### 6.4 CANopenLinux 部署

CANopenLinux 是基于 CANopenNode 的 Linux 平台实现：

```bash
# 安装依赖
sudo apt-get install build-essential git cmake libsocketcan-dev

# 编译
git clone https://github.com/CANopenNode/CANopenLinux
cd CANopenLinux
git submodule update --init
mkdir build && cd build
cmake ..
make

# 启动 CANopen 守护进程
sudo ./canopend --can="can0" --nodeid=1

# 使用 cocomm 命令行工具
cocomm "SDO 读 0x02 0x1017 0x00 i16"
cocomm "NMT 启动 0x02"
```

---

## 7. 对 AUDESYS 参考价值 (续)

### 7.6 COB-ID 优先级编码 vs AUDESYS HalQoS

CANopen 的 COB-ID 编码规则对 AUDESYS 的 HalQoS 优先级标签设计有参考价值：

| CANopen COB-ID 范围 | 功能 | 优先级 | AUDESYS HalQoS 对应 |
|-------------------|------|--------|-------------------|
| 0x000-0x07F | NMT/同步 | 最高 | 管理 Signal |
| 0x080-0x0FF | 紧急消息 | 高 | 异常 Signal |
| 0x100-0x1FF | PDO (实时数据) | 中高 | 实时 StreamChannel |
| 0x200-0x5FF | SDO (配置) | 中 | RPC 调用 |
| 0x600-0x7FF | 网络管理 | 低 | 管理消息 |

### 7.7 EMCY 消息 vs AUDESYS 异常 Signal

CANopenNode 的紧急消息机制对 AUDESYS 的异常 Signal 设计有参考：

| EMCY 特性 | 实现 | AUDESYS 对应 |
|-----------|------|-------------|
| 错误码 | 16 位标准错误码 | 错误类型枚举 |
| 错误寄存器 | 8 位错误寄存器 | 错误状态位图 |
| 自动发送 | 错误发生时自动发送 | 异常 Signal 自动触发 |
| 可配置 | 启用/禁用 | HalQoS 配置 |

### 7.8 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 高 | 10+ 年，通过 CiA CTT 认证测试 |
| 代码质量 | 高 | 模块化 ANSI C，完整的 Doxygen 文档 |
| AUDESYS HAL 参考 | 高 | 对象字典、PDO/Signal 映射、非阻塞架构 |
| 学习价值 | 高 | 完整的 CANopen 协议栈实现蓝本 |
| 生产准备 | 高 | Apache 2.0 许可，商业友好 |
| 在线文档 | 高 | Doxygen HTML 文档 + 在线手册 |

CANopenNode 的对象字典驱动架构和非阻塞协议处理模式，是 AUDESYS 设计 HalDiscovery 和 RT 线程模型时最重要的参考实现之一。其 PDO 映射机制与 AUDESYS Signal 的运行时绑定设计理念高度一致。

---

> **本文档基于 2026 年 7 月的公开信息编写。CANopenNode 版本和功能以 GitHub 仓库 (https://github.com/CANopenNode/CANopenNode) 为准。**
