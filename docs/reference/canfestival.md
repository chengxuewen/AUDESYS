# CanFestival

> **开源 CANopen 框架 — ANSI C 主站/从站双模式实现**
> 维护者：Edouard TISSERANT, Francis DUPIN, Laurent BESSARD
> 当前版本：CanFestival-3（持续维护中）
> 许可：LGPL v2.1（运行时）/ GPL v2（工具）
> 官网：https://canfestival.org

---

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: CanFestival
- **开发商/组织**: Edouard TISSERANT、Francis DUPIN、Laurent BESSARD（核心开发者），开源社区维护
- **首次发布年份**: 2001 年（原始发布）
- **当前状态**: 维护模式 — CanFestival-3 分支活跃，社区有多个 fork
- **仓库地址**: https://dev.automforge.net/CanFestival-3、https://github.com/mhaberler/Canfestival-3、https://github.com/beremiz/canfestival
- **许可证**: LGPL v2.1（运行时库）/ GPL v2（开发工具）
- **官网**: https://canfestival.org

#### 项目背景

CanFestival 是开源社区历史最悠久的 CANopen 实现之一，始创于 2001 年。作为最早的开源 CANopen 协议栈，CanFestival 在嵌入式 CANopen 设备的开发中发挥了重要作用，被广泛应用于工业自动化、机器人、嵌入式系统等领域。

CanFestival 的设计目标从一开始就明确：**提供一个完整的、可移植的、主站/从站双模式支持的 CANopen 框架**，涵盖从 MCU 到 PC 的多种平台。

与 CANopenNode（Apache 2.0，纯从站为主）不同，CanFestival 更强调主站能力和跨平台支持，特别是其**双许可证模型**（LGPL 运行时 + GPL 工具）降低了商业集成的门槛。

#### 与 CANopenNode 对比

| 维度 | CanFestival | CANopenNode |
|------|------------|------------|
| 首次发布 | 2001 | 约 2010 |
| 许可证 | LGPL v2.1 + GPL v2 | Apache 2.0 |
| 主站功能 | 完整 | 有限 |
| 从站功能 | 完整 | 完整 |
| 平台支持 | Linux/Win32/MCU | 任意 MCU（需移植）|
| 对象字典编辑器 | 内置（Objdictedit.py）| 独立（CANopenEditor）|
| 代码质量 | 中 | 高 |
| 社区活跃度 | 维护模式 | 活跃 |

### 1.2 产品定位与核心价值主张

CanFestival 定位为 **免费、开源、双模式（主站/从站）的 CANopen 框架**，核心价值主张：

1. **主站/从站双模式**: 同一协议栈同时支持主站和从站功能
2. **LGPL 运行时**: 允许商业闭源链接，降低集成门槛
3. **跨平台**: 原生支持 Linux、Win32、多种 MCU 架构
4. **内置工具**: 对象字典编辑器（Objdictedit.py）、网络拓扑编辑器（Networkedit.py）
5. **多 CAN 驱动**: 支持 SocketCAN、PEAK、Kvaser 等多种 CAN 硬件接口
6. **Beremiz 集成**: 与 Beremiz（开源 IEC 61131-3 PLC 编程环境）深度集成

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| PLC 开发者 | 分布式 I/O 控制 | 主站/从站双模式，IEC 61131-3 集成 |
| 嵌入式开发者 | 自定义 CANopen 设备开发 | 轻量级、可移植、主站功能 |
| 工业自动化 | 伺服驱动器、I/O 模块 | 主站管理能力 |
| 教育研究 | CANopen 协议教学 | 完全开源的实现 |
| 系统集成 | 多厂商设备互联 | 多种 CAN 硬件驱动支持 |

### 1.4 许可证模型

| 组件 | 许可证 | 说明 |
|------|--------|------|
| 运行时库（libcanfestival）| LGPL v2.1 | 可商业闭源链接 |
| 开发工具（Objdictedit）| GPL v2 | 工具必须开源 |
| 生成代码 | 无限制 | 生成的 C 代码不继承许可证 |
| 示例代码 | LGPL v2.1 | 可自由使用 |

### 1.5 项目成熟度评估

| 评估维度 | 状态 | 说明 |
|---------|------|------|
| 功能完整性 | 高 | 支持完整 CANopen 协议栈 |
| 代码质量 | 中 | 历史代码，部分驱动维护不足 |
| 文档完整性 | 中 | LaTeX 手册 + 示例代码 |
| 测试覆盖 | 低 | 有限的自动化测试 |
| 社区贡献 | 中 | 多个 fork，但核心维护者有限 |
| 商业支持 | 无 | 纯开源社区项目 |

---

## 2. 技术特性

### 2.1 核心架构

CanFestival 采用 **分层架构**，核心协议栈与平台驱动分离：

```
+------------------------------------------------------------+
|  CANopen 应用层                                              |
|  +--------------------------------------------------------+|
|  | 对象字典（Object Dictionary）                            ||
|  | - 通信参数区 (0x1000-0x1FFF)                             ||
|  | - 制造商特定区 (0x2000-0x5FFF)                           ||
|  | - 标准设备描述区 (0x6000-0x9FFF)                         ||
|  +--------------------------------------------------------+|
|  +--------------------------------------------------------+|
|  | CANopen 协议栈核心                                       ||
|  | - NMT（网络管理）                                        ||
|  | - SDO（服务数据对象）                                     ||
|  | - PDO（过程数据对象）                                     ||
|  | - EMCY（紧急消息）                                       ||
|  | - SYNC（同步）                                           ||
|  | - LSS（层设置服务）                                       ||
|  +--------------------------------------------------------+|
|  +--------------------------------------------------------+|
|  | 平台抽象层                                               ||
|  | - 定时器驱动（timers_*）                                 ||
|  | - CAN 驱动（can_*）                                      ||
|  +--------------------------------------------------------+|
+------------------------------------------------------------+
```

### 2.2 目录结构

CanFestival 的源代码目录结构：

| 目录 | 内容 |
|------|------|
| src/ | CANopen 协议栈核心（ANSI C）|
| include/ | 头文件 |
| drivers/ | 平台驱动、定时器驱动、CAN 驱动 |
| drivers/unix/ | Linux/Unix 平台接口 |
| drivers/win32/ | Windows 平台接口 |
| drivers/timers_xeno/ | Xenomai 实时定时器 |
| drivers/timers_rtai/ | RTAI 实时定时器 |
| drivers/timers_unix/ | POSIX 定时器 |
| drivers/can_socket/ | SocketCAN 驱动 |
| drivers/can_peak_linux/ | PEAK CAN 接口 |
| drivers/can_peak_win32/ | Windows PEAK 接口 |
| drivers/can_serial/ | 串口 CAN 桥接 |
| drivers/can_virtual/ | 虚拟 CAN（测试用）|
| objdictgen/ | 对象字典编辑器（Python）|
| examples/ | 示例代码 |
| doc/ | 文档（LaTeX 手册）|

### 2.3 核心协议支持

| 协议 | 功能 | 状态 |
|------|------|------|
| NMT 从站 | 启动/停止/复位 | 已实现 |
| NMT 主站 | 管理网络节点 | 已实现 |
| 心跳 | 生产者/消费者 | 已实现 |
| 节点守护 | 旧版错误控制 | 已实现 |
| PDO | 4 TPDO + 4 RPDO | 已实现 |
| SDO 服务器 | 加速/分段/块传输 | 已实现 |
| SDO 客户端 | 主站 SDO 访问 | 已实现 |
| EMCY | 紧急消息 | 已实现 |
| SYNC | 同步信号 | 已实现 |
| LSS 从站 | 节点 ID 和波特率 | 已实现 |
| LSS 主站 | 配网服务 | 已实现 |
| LSS FastScan | 自动发现 | 已实现 |

### 2.4 对象字典编辑器（Objdictedit.py）

CanFestival 的 Python 对象字典编辑器是其核心工具之一：

| 功能 | 说明 |
|------|------|
| 图形界面 | 基于 wxPython 的 GUI 编辑器 |
| 配置文件 | 支持 .prf 设备配置文件格式 |
| 代码生成 | 生成 C 语言对象字典源代码 |
| 设备描述 | 支持 CiA 标准设备描述 |
| 网络编辑 | 网络拓扑编辑器（Networkedit.py）|
| 导出格式 | EDS、DCF、C 源代码 |

### 2.5 CAN 驱动支持

| 驱动 | 平台 | 说明 |
|------|------|------|
| can_socket | Linux | SocketCAN 接口 |
| can_peak_linux | Linux | PEAK PCAN 接口 |
| can_peak_win32 | Windows | PEAK PCAN-Light |
| can_virtual | Linux/Windows | 进程内虚拟 CAN |
| can_serial | Unix | 串口 CAN 桥接 |
| can_uvccm_win32 | Windows | ACACETUS RS232 CAN-uVCCM |
| can_kvaser | Windows | Kvaser CANlib |
| can_anagate | Windows | AnaGate CAN |
| can_ixxat | Windows | IXXAT VCI |
| can_vscom | Windows | VSCom VSCAN |

---

## 3. 功能概览

### 3.1 核心功能

| 功能 | 说明 | 状态 |
|------|------|------|
| NMT 主站 | 网络节点管理 | 已实现 |
| NMT 从站 | 设备状态机 | 已实现 |
| SDO 客户端 | 远程参数访问 | 已实现 |
| SDO 服务器 | 本地参数服务 | 已实现 |
| PDO | 高速过程数据 | 已实现 |
| 心跳监控 | 错误控制 | 已实现 |
| EMCY | 紧急消息 | 已实现 |
| LSS | 层设置服务 | 已实现 |
| SYNC | 同步 | 已实现 |

### 3.2 示例程序

| 示例 | 说明 |
|------|------|
| TestMasterSlave | 单进程主站+从站，NMT/SYNC/SDO/PDO 通信 |
| TestMasterSlaveLSS | 含 LSS 的主站+2 从站示例 |
| DS401_Master | DS-401 数字 I/O 模块主站示例 |
| DS401_Slave_Gui | wxWidgets GUI 从站示例 |
| CANOpenShell | 交互式 CANopen Shell |
| win32test | Windows 平台主站示例 |

### 3.3 命令接口

CANOpenShell 提供交互式 CANopen 命令：

| 命令 | 功能 |
|------|------|
| NMT 操作 | 启动/停止/复位节点 |
| SDO 读写 | 访问对象字典参数 |
| PDO 配置 | 配置 PDO 映射 |
| LSS 操作 | 节点 ID 和波特率配置 |
| 心跳监控 | 监控节点存活状态 |

---

## 4. 现状与生态

### 4.1 当前开发状态

| 分支 | 维护状态 | 说明 |
|------|---------|------|
| CanFestival-3（原始）| 维护 | dev.automforge.net 主仓库 |
| mhaberler/Canfestival-3 | 维护 | GitHub 镜像，含 CMake 构建 |
| ljessendk/CanFestival | 活跃 | 优化小内存 MCU（AVR/PIC）|
| beremiz/canfestival | 活跃 | CMake 构建，Beremiz 集成 |
| canfestival-rtt | 维护 | RT-Thread 移植 |

### 4.2 关联生态

**Beremiz 集成**：CanFestival 与 Beremiz（开源 IEC 61131-3 PLC 编程环境）深度集成，作为 Beremiz 的 CANopen 通信层。

**RT-Thread 移植**：canfestival-rtt 包将 CanFestival 移植到 RT-Thread OS，支持 STM32 等平台。

**LinuxCNC 集成**：LinuxCNC 通过 HAL 组件支持 CANopen 设备，CanFestival 可作为 CANopen 从站协议栈。

### 4.3 相关技术栈

| 技术 | 关系 | 说明 |
|------|------|------|
| Beremiz | IEC 61131-3 PLC IDE | CanFestival 作为 Beremiz 的 CANopen 层 |
| SocketCAN | Linux CAN 接口 | 主选 CAN 驱动 |
| RT-Thread | 嵌入式 RTOS | canfestival-rtt 移植 |
| Python | 工具语言 | Objdictedit.py 编辑器 |

---

## 5. 市场定位

### 5.1 在 CANopen 生态中的位置

| 方案 | 许可证 | 主站 | 从站 | 平台 | 价格 |
|------|--------|------|------|------|------|
| CanFestival | LGPL | 完整 | 完整 | 多平台 | 免费 |
| CANopenNode | Apache 2.0 | 有限 | 完整 | 多平台 | 免费 |
| IXXAT | 商业 | 完整 | 完整 | 多平台 | $3000+ |
| Port | 商业 | 完整 | 完整 | 多平台 | $2000+ |
| MicroCANopen | 商业 | 无 | 完整 | MCU | $1000+ |

### 5.2 竞品对比

| 对比项 | CanFestival | CANopenNode |
|--------|------------|------------|
| 主站能力 | 完整 NMT 主站 | 有限 |
| 代码质量 | 中 | 高 |
| 文档 | 中 | 好 |
| 工具链 | 内置 Objdictedit | 独立 CANopenEditor |
| 社区活跃度 | 维护模式 | 活跃 |
| 许可证友好度 | LGPL 友好 | Apache 2.0 友好 |

---

## 6. 产品特色

### 6.1 核心差异化特征

| 特征 | CanFestival | 说明 |
|------|------------|------|
| 主站/从站双模式 | 完整支持 | 可同时作为主站和从站 |
| LGPL 运行时 | 商业友好 | 可闭源链接 |
| 内置对象字典编辑器 | Objdictedit.py | 图形化配置 |
| 多 CAN 驱动 | 10+ 驱动 | 广泛硬件支持 |
| Beremiz 集成 | 深度集成 | IEC 61131-3 生态 |
| 小内存优化 | ljessendk fork | 适用于 AVR/PIC |

### 6.2 双模式主站/从站

CanFestival 的核心差异化是**同时支持主站和从站模式**：

```
主站模式（Master）：
- 发送 NMT 命令管理网络节点
- 通过 SDO 客户端访问远程参数
- 配置 PDO 映射
- 监控心跳/节点守护
- LSS 主站配置

从站模式（Slave）：
- 响应 NMT 命令
- 提供 SDO 服务器
- 发送/接收 PDO
- 发送 EMCY
- 心跳生产者
```

### 6.3 对象字典生成

CanFestival 的对象字典生成流程：

```
.user.prf (用户配置文件) --> Objdictedit.py --> OD.c + OD.h (C 代码)
```

生成的 C 代码包括：
- 对象字典索引表
- 变量定义和初始值
- 回调函数注册
- 类型定义和访问函数

---

## 7. 对 AUDESYS 参考价值

### 7.1 CANopen 协议架构 vs AUDESYS HAL 设计

| CANopen 概念 | AUDESYS 等价 | 参考价值 |
|-------------|-------------|---------|
| PDO 过程数据 | Signal | 高速广播，无协议开销 |
| SDO 服务数据 | RPC | 参数化访问 |
| EMCY 紧急消息 | 异常 Signal | 优先级事件通知 |
| 对象字典 | HalDiscovery | 运行时自描述 |
| 心跳 | HalQoS Liveliness | 节点存活监控 |
| NMT 状态机 | 设备生命周期 | 状态管理模型 |

### 7.2 主站/从站模式对 AUDESYS 的启示

CanFestival 的主站/从站双模式对 AUDESYS 的节点角色设计有参考意义：

| 角色 | CanFestival | AUDESYS 对应 |
|------|------------|-------------|
| 主站 | 管理网络、配置参数 | Runtime 节点 |
| 从站 | 执行实时任务 | HAL 设备节点 |
| 混合 | 同时承担两种角色 | 同一节点可同时发布和消费 |

### 7.3 对象字典工具链

CanFestival 的 Objdictedit.py 工具链对 AUDESYS 的配置工具设计有参考价值：

| 工具 | CanFestival | AUDESYS 对应 |
|------|------------|-------------|
| 配置编辑器 | Objdictedit.py | Studio 配置编辑器 |
| 代码生成 | Python → C | Studio → YAML/FlatBuffers |
| 设备描述 | .prf 配置文件 | YAML 设备描述文件 |
| 导出格式 | EDS/DCF | FlatBuffers Schema |

### 7.4 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 高 | 2001 年以来持续使用 |
| 主站能力 | 高 | 完整 NMT 主站功能 |
| AUDESYS 参考 | 中 | 对象字典和主站模式可参考 |
| 代码质量 | 中 | 历史代码，部分驱动待更新 |
| 学习价值 | 中 | 展示了 CANopen 协议栈架构 |

CanFestival 的主站/从站双模式设计，特别是其对象字典工具链和 Beremiz 集成，对 AUDESYS 的 Studio 配置工具和 Runtime 节点管理有参考价值。

---

> **本文档基于 2026 年 7 月的公开信息编写。CanFestival 涉及多个分支和 fork，具体功能和兼容性以各项目官方文档为准。**


### 2.6 对象字典内部机制

CanFestival 的对象字典（OD）使用静态索引表实现，每个条目包含：

| OD 条目字段 | 类型 | 说明 |
|-----------|------|------|
| Index | uint16 | 对象索引 (0x0000-0xFFFF)|
| SubIndex | uint8 | 子索引 |
| DataType | uint8 | 数据类型（整数、浮点、字符串等）|
| AccessType | uint8 | 访问权限（RO/RW/WO）|
| PDO Mapping | bool | 是否可 PDO 映射 |
| pFunct | 函数指针 | 读/写回调函数 |

**SDO 传输流程**：

```
客户端 (主站)                    服务端 (从站)
    |                               |
    |-- SDO 请求 (CAN ID=0x600+ID)-->|
    |   [Index:0x1017, Sub:0]       |
    |                               |-- 查找 OD 条目
    |                               |-- 调用读回调函数
    |<-- SDO 响应 (CAN ID=0x580+ID)--|
    |   [心跳时间: 1000ms]           |
```

**PDO 映射机制**：

PDO 映射表定义了哪些对象字典条目通过 PDO 发送：

```
TPDO1 通信参数 (0x1800):
  - COB-ID: 0x180+NodeID
  - 传输类型: 255 (事件触发)
  - 禁止时间: 100us

TPDO1 映射参数 (0x1A00):
  - 第1项: 0x2000, Sub 0, 32位 (数字I/O输入)
  - 第2项: 0x2001, Sub 0, 16位 (模拟输入)
```

### 2.7 NMT 状态机详细实现

CanFestival 的 NMT 状态机实现使用状态转换表：

```
                          +----------+
        上电/复位 --------->| 初始化   |
                          +----+-----+
                               |
                       自动进入(等待SYNC)
                               |
                               v
                          +----------+
      NMT 停止节点 <-------| 预操作   |<------- 心跳启动
      (收到0x02)           +----+-----+
                               |
                        NMT 启动节点 (0x01)
                               |
                               v
                          +----------+
      NMT 停止节点 <-------| 操作     |<------- NMT 启动节点
      (收到0x02)           +----+-----+
                               |
                        NMT 进入预操作 (0x80)
                               |
                               v
                          +----------+
                          | 停止     |
                          +----------+
```

### 2.8 定时器驱动架构

CanFestival 支持多种定时器驱动，用于处理 CANopen 的定时事件：

| 定时器驱动 | 平台 | 精度 | 特点 |
|-----------|------|------|------|
| timers_unix | POSIX | 毫秒级 | 基于 timer_create/setitimer |
| timers_xeno | Xenomai | 微秒级 | 实时 Linux 扩展 |
| timers_rtai | RTAI | 微秒级 | 硬实时 Linux |
| timers_kernel | Linux 内核 | 微秒级 | 内核模块模式 |
| timers_win32 | Windows | 毫秒级 | 多媒体定时器 |

定时器驱动接口（5个函数）：

```c
void TimerInit(void);           // 初始化
void TimerCleanup(void);        // 清理
void SetAlarm(Alarm* alarm);    // 设置定时器
void RemoveAlarm(Alarm* alarm); // 移除定时器
Time GetElapsedTime(void);      // 获取已用时间
```

### 2.9 CAN 驱动架构

CanFestival 的 CAN 驱动采用动态加载设计（dlopen/LoadLibrary）：

```c
// CAN 驱动接口
typedef struct {
    const char* Name;
    unsigned char (*canSend)(Message* m);
    int (*canReceive)(Message* m);
    int (*canOpen)(s_BOARD* board);
    int (*canClose)(void);
    int (*canChangeBaudRate)(char* baud);
} CANDriver;
```

**SocketCAN 驱动实现细节**：

```c
// SocketCAN 驱动核心
int canOpen(s_BOARD* board) {
    struct sockaddr_can addr;
    struct ifreq ifr;

    s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    strcpy(ifr.ifr_name, board->busname);
    ioctl(s, SIOCGIFINDEX, &ifr);

    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    bind(s, (struct sockaddr*)&addr, sizeof(addr));

    return s;  // 返回 socket 句柄
}

unsigned char canSend(Message* m) {
    struct can_frame frame;
    frame.can_id = m->cob_id;
    frame.can_dlc = m->len;
    memcpy(frame.data, m->data, m->len);
    return write(can_socket, &frame, sizeof(frame)) > 0;
}
```

---

## 3. 功能概览 (续)

### 3.4 DS-401 设备配置文件支持

| 对象索引 | 功能 | 子索引 |
|---------|------|--------|
| 0x6000 | 数字输入 (Read Input 8-bit) | 0: 全部, 1-8: 每通道 |
| 0x6001 | 数字输入 (Read Input 16-bit)| 0: 全部, 1-16: 每通道 |
| 0x6200 | 数字输出 (Write Output 8-bit) | 0: 全部, 1-8: 每通道 |
| 0x6201 | 数字输出 (Write Output 16-bit)| 0: 全部, 1-16: 每通道 |
| 0x6401 | 模拟输入 (16-bit) | 0: 全部, 1-8: 每通道 |
| 0x6411 | 模拟输出 (16-bit) | 0: 全部, 1-8: 每通道 |

### 3.5 主站管理功能

CanFestival 的 NMT 主站提供完整的节点管理能力：

| 功能 | 命令 | 说明 |
|------|------|------|
| 启动节点 | masterSendNMTstateChange(node, NMT_Start_Node) | 将节点置为操作状态 |
| 停止节点 | masterSendNMTstateChange(node, NMT_Stop_Node) | 停止节点通信 |
| 预操作 | masterSendNMTstateChange(node, NMT_Enter_PreOperational) | 进入配置模式 |
| 复位节点 | masterSendNMTstateChange(node, NMT_Reset_Node) | 完全复位 |
| 复位通信 | masterSendNMTstateChange(node, NMT_Reset_Communication) | 仅复位通信模块 |

### 3.6 SDO 客户端操作

```c
// 主站读取从站对象字典
UNS8 readNetworkDict(CO_Data* d, UNS8 nodeId,
                     UNS16 index, UNS8 subIndex,
                     UNS8 dataType, UNS8 useBlockMode);

// 主站写入从站对象字典
UNS8 writeNetworkDict(CO_Data* d, UNS8 nodeId,
                      UNS16 index, UNS8 subIndex,
                      UNS8 dataType, UNS32 data,
                      UNS8 useBlockMode);

// 获取 SDO 传输结果
UNS8 getReadResultNetworkDict(CO_Data* d, void* data,
                              UNS32* size, UNS32* abortCode);
```

---

## 5. 市场定位 (续)

### 5.3 与 IEC 61131-3 (Beremiz) 的集成

CanFestival 作为 Beremiz 的 CANopen 通信层，在 IEC 61131-3 生态中扮演重要角色：

| Beremiz 功能 | CanFestival 角色 |
|-------------|----------------|
| PLC 程序编辑 | — |
| 编译为 C 代码 | — |
| CANopen 设备配置 | 通过 Objdictedit.py 编辑 OD |
| CANopen 通信运行时 | 链接 CanFestival 运行时库 |
| 分布式 I/O 管理 | NMT 主站管理远程节点 |

### 5.4 技术路线成熟度分析

| 评估项 | CanFestival | CANopenNode | 商业栈 |
|--------|------------|------------|--------|
| 协议完整性 | 高 | 高 | 极高 |
| 实时能力 | 中 (需 Xenomai/RTAI) | 中 | 高 |
| 多平台 | 高 (Linux/Win32/MCU) | 中 (MCU 为主) | 中 |
| 主站能力 | 完整 | 有限 | 完整 |
| 工具生态 | 中 | 中 | 高 |
| 社区规模 | 中 (多个 fork) | 中 | N/A |

### 5.5 典型应用场景

| 场景 | 配置 | 说明 |
|------|------|------|
| 分布式 I/O | 1 主站 + 8 从站 (CiA 401) | 数字/模拟 I/O 模块 |
| 伺服驱动器 | 1 主站 + 4 伺服 (CiA 402) | DS-402 驱动器控制 |
| 传感器网络 | 1 主站 + 16 传感器 | 温度/压力采集 |
| PLC 控制系统 | Beremiz + CanFestival | 完整 PLC 方案 |

---

## 7. 对 AUDESYS 参考价值 (续)

### 7.2 主站/从站模式映射到 AUDESYS 节点架构

| CANopen 节点角色 | AUDESYS 等价 | 通信模式 |
|-----------------|-------------|---------|
| NMT 主站 | Runtime 主控节点 | 下发管理命令 |
| NMT 从站 | HAL 设备节点 | 执行实时任务 |
| SDO 客户端 | RPC 调用方 | 请求-响应模式 |
| SDO 服务器 | RPC 服务方 | 处理参数访问 |
| PDO 生产者 | Signal 发布者 | 广播实时数据 |
| PDO 消费者 | Signal 订阅者 | 消费实时数据 |

### 7.3 对象字典 vs AUDESYS HalDiscovery

CanFestival 的对象字典自描述机制对 AUDESYS 的 HalDiscovery 设计提供了具体参考：

| OD 特性 | 实现方式 | AUDESYS 对应 |
|---------|---------|-------------|
| 索引表 | 静态数组 + 函数指针 | HalDiscovery 数据结构 |
| 数据类型 | 预定义枚举 | 14 标准类型 |
| 访问权限 | RO/RW/WO | Signal 发布/订阅权限 |
| PDO 映射 | 运行时配置 | Signal 绑定 |
| 回调函数 | 读/写触发 | RPC 回调 |
| 非易失存储 | EEPROM 保存 | 持久化配置 |

### 7.4 双许可证模型的启示

CanFestival 的 LGPL 运行时 + GPL 工具双许可证模式对 AUDESYS 的许可证策略有参考意义：

| 组件类型 | CanFestival | AUDESYS 建议 |
|---------|------------|-------------|
| 运行时库 | LGPL v2.1 | 宽松许可 (MIT/Apache) |
| 开发工具 | GPL v2 | 开源工具 |
| 用户代码 | 无限制 | 无限制 |
| 硬件设计 | N/A | CERN-OHL-S |

### 7.5 CAN 通信层 vs AUDESYS HalTransport

CAN 总线在物理层和链路层的设计原则对 AUDESYS 的实时通信层设计有参考价值：

| CAN 特性 | CANopen 相关 | AUDESYS HalTransport 启示 |
|---------|------------|------------------------|
| 仲裁机制 | 低 COB-ID = 高优先级 | 信号优先级编码 |
| 错误检测 | CRC + ACK + 位填充 | 传输层错误处理 |
| 错误恢复 | 总线关闭/自动重发 | 故障转移策略 |
| 位定时 | 同步段/传播段/相位段 | 时钟同步精度 |

### 7.6 综合评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 成熟度 | 高 | 25 年持续使用的协议栈 |
| 主站功能 | 高 | 完整 NMT 主站能力 |
| AUDESYS HAL 参考 | 中 | 对象字典和主站模式参考价值高 |
| 跨平台 | 高 | Linux/Win32/MCU 三平台 |
| 代码质量 | 中 | 历史代码需选择性参考 |

CanFestival 的 **主站/从站双模式架构** 是 AUDESYS 设计分布式节点管理系统时的重要参考。特别是其对象字典工具链和 NMT 状态机模型，直接对应 AUDESYS 的 HalDiscovery 和设备生命周期管理。

---

> **本文档基于 2026 年 7 月的公开信息编写。CanFestival 涉及多个分支和 fork，具体功能和兼容性以各项目官方文档为准。标注 "待确认" 的信息表示当前公开资料不足以确定，建议直接从官方仓库验证。**


### 2.10 对象字典生成工具链 (Objdictedit.py)

对象字典编辑器的核心功能架构：

```
Objdictedit.py 工作流程：
                    +------------------+
                    | .prf 配置文件    |  CiA 标准设备描述文件
                    +--------+---------+
                             |
                             v
                    +------------------+
                    | Objdictedit.py   |  wxPython GUI 编辑器
                    +--------+---------+
                             |
                    +--------+---------+
                    | 生成 C 代码       |
                    +--------+---------+
                             |
               +-------------+-------------+
               |                           |
               v                           v
        +-----------+             +------------------+
        | OD.c      | 对象字典    | OD.h             | 头文件
        | 数据定义  | 初始化      | 函数声明和宏定义 |
        +-----------+             +------------------+
```

**Objdictedit.py 生成的对象字典代码结构**：

```c
// OD.c — 自动生成的对象字典定义

// 索引表条目
const indextable OD_Entries[] = {
    // 通信参数区 (0x1000-0x1FFF)
    { 0x1000, 0x00, { &od_1000_0, sizeof(UNS32) }, RW },
    { 0x1001, 0x00, { &od_1001_0, sizeof(UNS8)  }, RO },
    { 0x1017, 0x00, { &od_1017_0, sizeof(UNS16) }, RW },
    // 制造商特定区 (0x2000-0x5FFF)
    { 0x2000, 0x08, { &od_2000_0, sizeof(UNS8)  }, RW },
    // ...
};

// 子索引定义
subindex OD_1017_Sub[] = {
    { 0x00, SDO_ACC_RO, NULL, "Number of entries" },
    { 0x01, SDO_ACC_RW, &od_1017_0, "Producer Heartbeat Time" },
};
```

### 2.11 主从站通信示例

**TestMasterSlave 示例** 展示了 CanFestival 的核心工作流程：

```c
int main() {
    // 1. 初始化两个节点（主站和从站）
    canOpen(&MasterBoard, &TestMaster_Data);
    canOpen(&SlaveBoard, &TestSlave_Data);

    // 2. 设置节点 ID
    setNodeId(&TestMaster_Data, 0x01);
    setNodeId(&TestSlave_Data, 0x02);

    // 3. 初始化状态机
    setState(&TestMaster_Data, Initialisation);
    setState(&TestSlave_Data, Initialisation);
    setState(&TestMaster_Data, Operational);
    setState(&TestSlave_Data, Operational);

    // 4. 主站发送 NMT 启动命令
    masterSendNMTstateChange(&TestMaster_Data, 0x02, NMT_Start_Node);

    // 5. 主站发送 SYNC 信号
    masterSendSYNC(&TestMaster_Data);

    // 6. 主站读取从站对象字典
    UNS32 data;
    UNS32 size = sizeof(UNS32);
    readNetworkDict(&TestMaster_Data, 0x02, 0x1000, 0, uint32, 0);
    getReadResultNetworkDict(&TestMaster_Data, &data, &size, NULL);

    // 7. 主站写入从站参数
    UNS32 heartbeat = 1000;  // 1000ms
    writeNetworkDict(&TestMaster_Data, 0x02, 0x1017, 0, uint16, heartbeat, 0);

    return 0;
}
```

---

## 4. 现状与生态 (续)

### 4.4 CMake 构建系统 (beremiz fork)

beremiz/canfestival 分支使用 CMake 构建系统，提供可配置的编译选项：

| CMake 选项 | 默认值 | 说明 |
|-----------|--------|------|
| CF_TARGET | unix | 目标平台 (unix/windows) |
| CF_CAN_DRIVER | virtual | CAN 驱动 (socket/peak/virtual) |
| CF_TIMERS_DRIVER | unix | 定时器驱动 (unix/windows/xeno) |
| CF_ENABLE_LSS | OFF | 启用 LSS 服务 |
| CF_ENABLE_LSS_FS | OFF | 启用 LSS FastScan |
| CF_ENABLE_DLL_DRIVERS | ON | 构建动态 CAN 驱动 |
| CF_BUILD_EXAMPLES | OFF | 构建示例程序 |

**构建输出**：

| 库文件 | 说明 |
|--------|------|
| libcanfestival.a | 核心 CANopen 协议栈 |
| libcanfestival_<timers>.a | 平台驱动（含定时器）|
| libcanfestival_can_<driver>.so | CAN 驱动（动态加载）|

---

## 6. 产品特色 (续)

### 6.4 动态 CAN 驱动加载

CanFestival 的 CAN 驱动动态加载机制降低了跨平台适配的工作量：

```c
// 动态加载 CAN 驱动
if (!LoadCanDriver("libcanfestival_can_socket.so")) {
    printf("ERROR: could not load CAN driver\n");
    return -1;
}

// 运行时切换 CAN 驱动
// 从 SocketCAN 切换到 PEAK
if (!LoadCanDriver("libcanfestival_can_peak_linux.so")) {
    printf("ERROR: could not load CAN driver\n");
}
```

### 6.5 串口 CAN 桥接

CanFestival 的串口 CAN 驱动（can_serial）提供了一种独特的远程 CAN 通信方式：

| 特性 | 说明 |
|------|------|
| 物理层 | RS-232 / RS-485 |
| 协议 | 自定义串行 CAN 帧封装 |
| 距离 | RS-232: 15m, RS-485: 1200m |
| 波特率 | 115200-921600 bps |
| 拓扑 | 点对点 / PTY hub |
| 应用 | 远程 CAN 调试、分布式系统 |

### 6.6 虚拟 CAN 网络

can_virtual 驱动使用 Unix 管道实现进程内 CAN 通信，用于开发和测试：

```c
// 虚拟 CAN 网络拓扑
// 进程 1 (主站)              进程 2 (从站)
// +-------------+           +-------------+
// | TestMaster  | <--pipe--> | TestSlave  |
// | libcanfestival         |  | libcanfestival |
// | can_virtual.so |        |  | can_virtual.so |
// +-------------+           +-------------+
```

---

## 7. 对 AUDESYS 参考价值 (续)

### 7.7 动态驱动加载模式

CanFestival 的 CAN 驱动动态加载模式对 AUDESYS 的 HalTransport 实现有参考意义：

| CanFestival 特性 | AUDESYS 对应设计 |
|-----------------|----------------|
| dlopen 动态加载 | HalTransport 可插拔后端 |
| 运行时切换驱动 | amw_inproc ↔ amw_zenoh 切换 |
| 虚拟 CAN 驱动 | 模拟 HAL 测试 |
| 多驱动并行 | 同时支持多种通信方式 |

### 7.8 定时器驱动抽象

CanFestival 的定时器驱动抽象层（5 个标准函数）是 AUDESYS 设计 RT 定时器接口的参考：

```c
// CanFestival 定时器 API
void TimerInit(void);        // 初始化定时器子系统
void TimerCleanup(void);     // 清理定时器资源
void SetAlarm(Alarm* a);     // 设置定时器
void RemoveAlarm(Alarm* a);  // 移除定时器
Time GetElapsedTime(void);   // 获取已用时间

// AUDESYS 对应接口（设计建议）
trait HalTimer {
    fn init() -> Result<()>;
    fn cleanup();
    fn set_alarm(duration: Duration, callback: fn()) -> AlarmId;
    fn remove_alarm(id: AlarmId);
    fn elapsed() -> Duration;
}
```

### 7.9 多平台移植策略

CanFestival 的跨平台移植策略对 AUDESYS 的多平台支持有参考价值：

| 层 | CanFestival | AUDESYS |
|----|------------|---------|
| 协议核心 | ANSI C（可移植）| Rust（跨平台）|
| 操作系统 | 3 种定时器驱动 | std/os 抽象 |
| CAN 硬件 | 10+ CAN 驱动 | HalTransport 后端 |
| 工具 | Python 跨平台 | Rust/WASM 跨平台 |

---

> **本文档基于 2026 年 7 月的公开信息编写。CanFestival 涉及多个分支和 fork，具体功能和兼容性以各项目官方文档为准。**
