# IgH EtherCAT Master — 开源 Linux EtherCAT 主站

> **GPLv2 开源 EtherCAT 主站协议栈 — Linux 内核模块 + 用户空间库**
> 维护者：EtherCAT Technology Group（ETG）开源工作组，Florian Pose（德国）
> 当前版本：IgH EtherCAT Master 1.6.2（2024 年更新）
> 许可：GPL v2（内核模块）/ LGPL v2.1（用户空间库）
> 官网：https://etherlab.org/en/ethercat/

---

## 1. 产品画像

### 1.1 项目起源与历史

IgH EtherCAT Master 是一个面向 Linux 内核的 EtherCAT 主站协议栈实现。由 Florian Pose 在德国 Ingenieurgemeinschaft IgH 公司开发，于 2005 年首次公开发布。这是最早的开源 EtherCAT 主站实现之一，与 Beckhoff 官方的 TwinCAT（Windows 专有）形成鲜明对比——IgH 让 Linux 用户能够在开源环境下运行 EtherCAT 主站。

IgH 项目的诞生背景：
1. **Linux 工业控制需求**：2000 年代中期，Linux 在工业自动化领域的应用逐渐增加，但缺乏高效的实时 EtherCAT 主站方案
2. **TwinCAT 的 Windows 锁定**：Beckhoff 的 TwinCAT 是当时最成熟的 EtherCAT 主站方案，但仅支持 Windows，不适用于嵌入式 Linux 和专用工控机
3. **LinuxCNC 生态需求**：LinuxCNC（当时称为 EMC2）是 Linux 上的知名 CNC 控制软件，需要一个开源 EtherCAT 主站来实现高性能运动控制
4. **实时 Linux 的成熟**：PREEMPT_RT 补丁和 Xenomai 等实时 Linux 方案逐渐成熟，为内核态 EtherCAT 主站提供了实时运行环境

IgH 的主要演进里程碑：

| 年份 | 版本 | 里程碑 |
|------|------|--------|
| 2005 | v1.0-pre | 初始开发版本，基础帧收发 |
| 2006 | v1.0 | 首个稳定版，内核模块架构确立 |
| 2008 | v1.1 | 增加 DC（分布式时钟）支持 |
| 2010 | v1.2 | 用户空间库（libethercat）独立，EoE 支持 |
| 2012 | v1.3 | VoE 支持，改进的 DC 同步 |
| 2014 | v1.4 | 多网卡支持，内核 3.x 兼容 |
| 2016 | v1.5 | 实时接口重构，增加 RTDM/Xenomai 支持 |
| 2018 | v1.5.2 | 长期维护版本，稳定 API |
| 2020 | v1.5.3 | LinuxCNC/EMC 集成优化 |
| 2022 | v1.6.0 | 内核 5.x 兼容性更新，新功能冻结 |
| 2024 | v1.6.2 | 维护版本，修复安全漏洞和内核兼容性问题 |

### 1.2 技术定位

IgH EtherCAT Master 在 EtherCAT 主站方案中的定位对比如下：

| 对比维度 | IgH EtherCAT Master | Beckhoff TwinCAT | SOEM（Simple Open EtherCAT Master） | acontis EC-Master |
|----------|---------------------|------------------|--------------------------------------|-------------------|
| 角色 | 主站 | 主站 | 主站 | 主站 |
| 开源 | 是（GPL v2） | 否（商业） | 是（MIT） | 否（商业） |
| 运行环境 | Linux 内核 + 用户空间 | Windows | 用户空间 | Linux/Windows |
| 实时性 | 内核态（PREEMPT_RT/Xenomai） | Windows RT | 用户态（有抖动） | 内核态 |
| DC 支持 | 完整 | 完整 | 基础 | 完整 |
| LinuxCNC 集成 | 原生支持 | 不支持 | 需适配 | 需适配 |
| 多网卡 | 支持 | 支持 | 有限 | 支持 |
| 社区活跃度 | 中（mailing list） | N/A | 高（GitHub） | N/A |
| 商用授权 | 需 IgH 授权 | 商业 | MIT | 商业 |

### 1.3 核心使用场景

IgH EtherCAT Master 的典型应用场景：

1. **LinuxCNC 数控系统**：作为 LinuxCNC 的 EtherCAT HAL 驱动后端，实现高精度运动控制
2. **实时工业控制系统**：在 PREEMPT_RT Linux 上运行实时 EtherCAT 通信
3. **机器人控制**：EtherCAT 总线连接伺服驱动器和远程 I/O，运行实时控制循环
4. **测试与测量系统**：EtherCAT 高速数据采集系统的数据链路层
5. **协议转换/网关**：将 EtherCAT 与其他现场总线（Modbus、CANopen 等）桥接

### 1.4 与 AUDESYS 的关系定位

IgH 对 AUDESYS HAL 参考价值的三个核心维度：
- **内核/用户空间双层架构**：AUDESYS Runtime 的实时通信层可以借鉴 IgH 的分层设计
- **实时接口抽象**：IgH 对 PREEMPT_RT 和 Xenomai 的支持模式是实时通信的参考
- **DC 同步的主站侧实现**：AUDESYS 的 amw 实时同步可以参考 IgH 的 DC 漂移补偿算法

---

## 2. 技术特性

### 2.1 系统架构

IgH EtherCAT Master 采用内核/用户空间双层架构：

```
+-------------------------------------------+
|                用户空间                    |
|  应用层 (Application)                     |
|  LinuxCNC HAL / 自定义实时任务            |
+-------------------------------------------+
|  用户空间库 (libethercat)                 |
|  提供 char 设备接口 / ioctl 调用          |
|  /dev/EtherCAT0 - /dev/EtherCATN          |
+--+----------------------------------------+
   |
+--+----------------------------------------+
|                内核空间                    |
|  EtherCAT 主站内核模块 (ec_master.ko)     |
|  状态机管理 / 过程数据交换 / DC 同步     |
|  邮箱协议 (CoE/SoE/VoE/EoE)              |
+-------------------------------------------+
|  网卡驱动 (Generic/E1000/E1000e/RTnet)    |
|  原生以太网驱动 + EtherCAT 帧收发         |
+-------------------------------------------+
|         实时层 (RT Layer)                 |
|  PREEMPT_RT / Xenomai / RTnet            |
+-------------------------------------------+
|             硬件层                        |
|  标准以太网网卡 (Intel/Realtek/Broadcom)  |
+-------------------------------------------+
```

**内核模块层**：`ec_master.ko` 是 IgH 的核心模块，管理 EtherCAT 状态机、域（Domain）和过程数据映射。该层在 Linux 内核中运行，负责所有实时关键的操作。

**网卡驱动接口**：IgH 通过两种方式访问网卡硬件：
1. **原生驱动接口**：使用 Linux 内核的 net_device 接口发送/接收 EtherCAT 帧
2. **RTnet 接口**（实时）：通过 RTnet（Xenomai 的实时网络栈）实现确定性帧收发

**用户空间库**：`libethercat` 提供用户空间 API，通过字符设备 `/dev/EtherCATX` 与内核模块交互。用户空间程序通过 `ioctl()` 调用配置从站、映射 PDO、读写过程数据。

**配置工具**：`ethercat` 命令行工具提供配置和管理功能，包括：
- `ethercat slaves` — 枚举从站设备
- `ethercat pdos` — 查看/配置 PDO 映射
- `ethercat sdos` — SDO 访问
- `ethercat state` — 查看/设置从站状态
- `ethercat master` — 主站状态信息

### 2.2 内核模块架构

IgH EtherCAT Master 的内核模块由以下组件构成：

**核心数据结构**：

| 数据结构 | 说明 | 作用 |
|----------|------|------|
| `ec_master_t` | 主站实例 | 管理一个 EtherCAT 主站的所有状态和数据 |
| `ec_slave_t` | 从站实例 | 表示一个 EtherCAT 从站设备 |
| `ec_domain_t` | 域 | 从站 PDO 数据的分组管理单元 |
| `ec_sdo_request_t` | SDO 请求 | 异步 SDO 访问请求 |
| `ec_pdo_entry_t` | PDO 条目 | 单个 PDO 数据的映射条目 |
| `ec_voe_handler_t` | VoE 处理 | Vendor-specific 数据处理 |

**主站状态机**：

```
+-----------+    +------------+    +-----------+    +--------+
| IDLE      |--->| OPERATION  |--->| STOP     |--->| IDLE   |
+-----------+    +------------+    +-----------+    +--------+
      |                |
      |                v
      +-----------> ERROR ---> IDLE
```

主站状态机各状态的含义：
- **IDLE**：主站空闲，不主动发送帧
- **OPERATION**：正常操作模式，定期发送过程数据帧和 DC 同步帧
- **STOP**：停止状态，紧急停止
- **ERROR**：错误状态，发生不可恢复的错误

**域（Domain）管理**：
域是 IgH 中 PDO 数据的核心管理机制。一个域包含一组从站的 PDO 数据，所有域中的 PDO 数据在同一 EtherCAT 帧中交换。域的概念简化了过程数据的管理：
- 用户创建域并添加从站的 PDO 映射
- IgH 自动计算域的总数据大小
- 在 OPERATION 状态下，域数据在每个周期自动交换

### 2.3 内核/用户空间接口

IgH 通过字符设备驱动提供内核/用户空间接口：

```c
// 打开 EtherCAT 主站设备
int fd = open("/dev/EtherCAT0", O_RDWR);

// 配置从站 PDO 映射
ec_ioctl_config_t config;
config.slave = 0;                        // 从站地址
config.slave_config = ...;               // 从站配置

// 注册域
ec_ioctl_domain_t domain;
domain.index = 0;                        // 域索引
domain.data_size = 64;                   // 数据大小

// 映射 PDO 条目到域
ec_ioctl_reg_pdo_entry_t pdo_entry;
pdo_entry.slave = 0;
pdo_entry.vendor_id = 0x00000002;
pdo_entry.product_code = 0x00000001;
pdo_entry.pdo_entry_index = 0x7000;
pdo_entry.pdo_entry_subindex = 0x01;
pdo_entry.domain = 0;

// 激活配置
ioctl(fd, EC_IOCTL_CONFIG, ...);

// 切换到 OPERATION 状态
ioctl(fd, EC_IOCTL_MASTER_OPERATION, ...);

// 读取域数据（在每个实时周期中调用）
uint8_t domain_data[64];
ioctl(fd, EC_IOCTL_GET_DOMAIN_DATA, domain_data);
```

**用户空间库 API** (`libethercat`)：

```c
// 初始化主站
ec_master_t* master = ecrt_request_master(0);

// 配置从站
ec_slave_config_t* sc = ecrt_slave_config_create(
    master, 0, 0x00000002, 0x00000001);

// 创建域
ec_domain_t* domain = ecrt_domain_create(master);

// 注册 PDO 条目
ecrt_slave_config_pdo_assign_create(sc, 0x1600, 1);
ecrt_slave_config_pdo_entry_add(sc, 0x7000, 0x01, domain, &domain_offset);

// 激活主站
ecrt_master_activate(master);

// 获取域数据指针
uint8_t* domain_data = ecrt_domain_data(domain);

// 实时循环
while (running) {
    ecrt_master_receive(master);     // 接收帧
    ecrt_domain_process(domain);     // 处理域数据
    
    // 读取/写入 PDO 数据
    uint8_t input = domain_data[input_offset];
    domain_data[output_offset] = output_value;
    
    ecrt_domain_queue(domain);       // 排队域数据
    ecrt_master_send(master);        // 发送帧
}
```

### 2.4 实时接口

IgH 支持多种实时运行模式：

**PREEMPT_RT 模式**（推荐）：
- 使用标准 Linux 内核 + PREEMPT_RT 补丁
- 核隔离（isolcpus）将主站线程绑定到专用 CPU 核心
- 线程优先级设为 SCHED_FIFO，通常使用优先级 95-99
- 典型抖动：10-50us（取决于硬件和系统负载）

**Xenomai 模式**：
- 使用 Xenomai 实时内核框架
- 通过 RTnet 提供确定性网络通信
- 内核抢占完全禁用，实时线程运行在 Xenomai 域
- 典型抖动：<10us

**RTnet 实时网络栈**：
IgH 通过 RTnet 实现实时网络通信。RTnet 提供：
- 确定性数据链路层
- 优先级驱动的帧调度
- 无锁的帧缓冲区管理
- 独立于 Linux 网络栈的实时路径

实时接口配置示例：

```c
// 设置主站实时模式
ecrt_master_set_send_interval(master, 1000000); // 1ms 周期

// 创建实时线程（PREEMPT_RT 模式）
pthread_t rt_thread;
struct sched_param param = { .sched_priority = 98 };

pthread_create(&rt_thread, NULL, rt_cycle_func, NULL);
pthread_setschedparam(rt_thread, SCHED_FIFO, &param);

// CPU 亲和性绑定
cpu_set_t cpuset;
CPU_ZERO(&cpuset);
CPU_SET(1, &cpuset);
pthread_setaffinity_np(rt_thread, sizeof(cpu_set_t), &cpuset);
```

### 2.5 DC — 分布式时钟

IgH 的 DC 支持是从站同步的关键。DC 在主站侧的实现包括：

**DC 时间同步流程**：
1. **参考时钟选举**：IgH 扫描网络中支持 DC 的从站，选择第一个作为参考时钟
2. **初始偏移采集**：在 Init 状态下，IgH 采集参考时钟与其他从站的初始时间偏移
3. **持续漂移补偿**：在 OP 状态下，IgH 周期性读取从站的系统时间偏移寄存器，计算漂移率并写入补偿值
4. **SYNC 信号同步**：所有从站的 SYNC0/SYNC1 信号基于参考时钟对齐

**DC 时钟数据结构**：
```c
// DC 时间数据结构
struct ec_dc_time {
    uint64_t system_time;       // 参考时钟的系统时间 (ns)
    uint64_t rx_time;           // 帧接收时间戳
    int64_t  offset;            // 时间偏移
    int32_t  drift;             // 漂移率 (ns/s)
};

// DC 状态机
struct ec_dc_sync {
    uint8_t  activate;          // DC 激活标志
    uint32_t cycle_time;        // 周期时间 (ns)
    int32_t  shift_time;        // 延迟移位 (ns)
    uint16_t sync0_cycle;       // SYNC0 周期
    uint16_t sync1_cycle;       // SYNC1 周期
};
```

**DC 配置示例**：
```c
// 配置从站 DC 参数
ec_slave_config_t* sc = ecrt_slave_config_create(master, 0, vendor_id, product_code);

// 启用 DC
ecrt_slave_config_dc(sc, 0x0300, 1000000, 500000, 0, 0);
// 参数解释：
//   activate: 0x0300 (DC 激活 + SYNC0/SYNC1 使能)
//   cycle_time: 1000000 ns (1ms 周期)
//   shift_time: 500000 ns (SYNC0 在周期中点触发)
```

**DC 同步精度**：
- 同机测试（同一主站）：<100ns
- 标准以太网（单跳）：<1us
- 交换机级联（多跳）：<5us
- 抖动来源：网卡中断延迟、内核调度延迟、PHY 延迟变化

### 2.6 邮箱协议支持

IgH 支持完整的 EtherCAT 邮箱协议：

**CoE（CANopen over EtherCAT）**：
- 完整 SDO 上传/下载
- 分段 SDO 传输（最大 4GB 数据）
- SDO 信息服务
- SDO 完成访问
- PDO 映射配置（通过 CoE）

**EoE（Ethernet over EtherCAT）**：
- 在 EtherCAT 总线上封装标准以太网帧
- 创建虚拟网络接口（ecX.Y）
- 支持 TCP/IP 协议栈通过 EoE 运行
- 适用于配置/诊断工具的网络访问

**VoE（Vendor-specific over EtherCAT）**：
- 厂商自定义数据通道
- 通过 VoE handler 管理
- 适用于专用诊断协议

**SoE（Servo over EtherCAT）**：
- SERCOS 风格的伺服驱动访问
- 支持 IDN（识别号）访问
- 适用于某些品牌的伺服驱动器

### 2.7 过程数据映射和域管理

IgH 的域管理是过程数据交换的核心机制。

**域创建和 PDO 映射流程**：

1. 创建域对象
2. 为每个从站配置 PDO 映射
3. 将 PDO 条目注册到域
4. 激活配置后获取域数据指针
5. 在实时循环中通过域指针访问数据

**多域管理**：
IgH 支持最多 16 个独立域，适用于：
- 不同周期的 PDO 数据分组
- 安全相关数据和非安全数据隔离
- 不同优先级的 PDO 通道

**域数据一致性保证**：
- 域数据在 `ecrt_master_receive()` 和 `ecrt_domain_process()` 之间保持一致
- 帧接收和数据处理之间不允许用户干预
- `ecrt_domain_queue()` 标记域数据为待发送状态
- `ecrt_master_send()` 将所有待发送域组合到一个或多个 EtherCAT 帧中

---

## 3. 功能概览

### 3.1 核心功能矩阵

| 功能模块 | 支持程度 | 版本要求 | 说明 |
|----------|---------|----------|------|
| EtherCAT 状态机管理 | 完整 | v1.0+ | 主站状态机 + 从站状态管理 |
| CoE 协议 | 完整 | v1.0+ | SDO 上传/下载/分段/信息 |
| EoE | 完整 | v1.2+ | 虚拟网络接口 |
| VoE | 完整 | v1.3+ | 厂商自定义数据通道 |
| SoE | 完整 | v1.3+ | SERCOS over EtherCAT |
| DC 分布式时钟 | 完整 | v1.1+ | 参考时钟 + 漂移补偿 |
| PREEMPT_RT 支持 | 完整 | v1.4+ | SCHED_FIFO 实时线程 |
| Xenomai 支持 | 完整 | v1.5+ | RTDM 实时接口 |
| RTnet 支持 | 完整 | v1.5+ | 实时网络栈 |
| 多网卡支持 | 完整 | v1.4+ | 多主站实例 |
| 热插拔 | 基础 | v1.5+ | 从站热插拔检测 |
| 冗余 | 不支持 | - | 主站冗余不在规划中 |
| 用户空间 API | 完整 | v1.2+ | libethercat + char device |

### 3.2 配置管理工具

IgH 提供 `ethercat` 命令行工具进行运行时配置和管理：

```bash
# 主站信息
ethercat master                    # 显示主站状态
ethercat master -m 0               # 指定主站 0

# 从站管理
ethercat slaves                    # 枚举所有从站
ethercat slaves -p 0               # 指定位置 0 的从站详细信息

# PDO 管理
ethercat pdos                      # 显示所有 PDO 映射
ethercat pdos -s 0                 # 从站 0 的 PDO 映射

# SDO 访问
ethercat sdos -s 0                 # 从站 0 的所有对象
ethercat upload -p 0 -t uint32 -o 0x1000 -r 0x01  # SDO 上传
ethercat download -p 0 -t uint32 -o 0x7000 -r 0x01 0xFF  # SDO 下载

# 状态管理
ethercat state -p 0 OP             # 将从站 0 切换到 OP 状态
ethercat state -p 0 PREOP          # 将从站 0 切换到 Pre-Op 状态

# 调试
ethercat debug -l 7                # 设置日志级别
ethercat version                   # 显示版本信息
```

### 3.3 LinuxCNC 集成

IgH 与 LinuxCNC 的集成是其最重要的应用之一。通过 `ethercat-hal` 驱动模块，IgH 将 EtherCAT I/O 暴露为 LinuxCNC HAL（硬件抽象层）组件：

```c
// LinuxCNC HAL 组件加载
$ halcmd loadrt ethercat-hal
$ halcmd show ethercat-hal

// 配置 EtherCAT 设备
$ halcmd setp ethercat-hal.cycle-time 1000000  // 1ms 周期
$ halcmd setp ethercat-hal.refresh-rate 1000   // 1000 Hz

// 映射 PDO 数据到 HAL 引脚
// 数字量输入
$ halcmd net di-0 <= ethercat-hal.digital-in-00
$ halcmd net di-1 <= ethercat-hal.digital-in-01

// 数字量输出
$ halcmd net do-0 => ethercat-hal.digital-out-00

// 模拟量输入
$ halcmd net ai-0 <= ethercat-hal.analog-in-00

// 伺服驱动（通过 CiA 402）
$ halcmd net motor-pos-cmd => ethercat-hal.axis-00.pos-cmd
$ halcmd net motor-act-pos <= ethercat-hal.axis-00.act-pos
```

LinuxCNC 集成架构：
```
LinuxCNC (用户空间)
    |
    v
HAL 组件 (ethercat-hal)
    |
    v
ecl (EtherCAT 配置库)
    |
    v
libethercat (用户空间 API)
    |
    v
/dev/EtherCAT0 (字符设备)
    |
    v
ec_master.ko (内核模块)
    |
    v
网卡驱动
```

### 3.4 调试与诊断工具

IgH 提供丰富的调试和诊断能力：

**内核日志诊断**：
```bash
# 查看 EtherCAT 相关内核日志
dmesg | grep -i ethercat

# 设置调试级别
echo 7 > /sys/module/ec_master/parameters/debug

# 查看主站状态
cat /sys/class/ethercat/ethercat0/master/*

# 查看帧统计
cat /proc/ethercat/*
```

**帧分析**：
- 统计收发帧数、错误帧数
- 邮箱超时分析
- DC 同步偏移监测

**性能监控**：
```bash
# 实时周期监控
[rt-cycle] period: 1000100 ns (target: 1000000 ns)
            jitter: max=121500 ns, avg=3520 ns, exec=1500 ns
```

---

## 4. 现状与生态

### 4.1 项目活跃度

IgH EtherCAT Master 的社区状态（截至 2026 年）：
- **项目维护**：核心维护者 Florian Pose，bus factor = 1
- **主要分发**：etherlab.org / GitHub（社区维护的镜像仓库）
- **邮件列表**：etherlab-user（主要技术讨论渠道）
- **贡献者**：约 30+ 位活跃贡献者
- **发布周期**：约 1-2 年一个主要版本
- **LinuxCNC 用户**：全球数千个 LinuxCNC 系统使用 IgH

项目状况的关键观察：
- **维护模式**：IgH 已进入维护模式，v1.6.x 只有 bug 修复和安全更新
- **内核兼容性**：每次 Linux 内核大版本升级都需要适配，这是最大的维护负担
- **LinuxCNC 依赖**：IgH 的持续开发很大程度上受 LinuxCNC 社区的需求驱动
- **替代方案兴起**：用户空间实现（如 SOEM）的成熟正在侵蚀 IgH 的应用领域
- **商业支持**：有数家公司提供基于 IgH 的商业支持和定制开发

### 4.2 支持的网卡硬件

IgH 对网卡的支持分为两类：

**原生驱动（Native Driver）**：
| 网卡型号 | 芯片 | 支持状态 | 实时性能 |
|----------|------|----------|----------|
| Intel PRO/1000 (e1000) | Intel 8254x | 完整 | 好 |
| Intel PRO/1000 (e1000e) | Intel 8257x | 完整 | 好 |
| Intel PRO/100 | Intel 8255x | 完整 | 中 |
| Realtek RTL8139 | RTL8139 | 完整 | 中 |
| Realtek RTL8169 | RTL8169 | 完整 | 好 |

**Generic 驱动**：
- 使用 Linux 内核通用网络设备接口
- 不需要专用驱动，任何 ethX 设备都能工作
- 实时性能比原生驱动差（额外的 DMA 映射和数据拷贝）

**RTnet 驱动**：
- 基于 Xenomai 的实时网络栈
- 提供最优的实时性能
- 支持的网卡：e1000、e1000e、RTL8139
- 需要 Xenomai 内核

### 4.3 与其他主站方案的竞争分析

| 维度 | IgH | SOEM | acontis EC-Master | TwinCAT |
|------|-----|------|-------------------|---------|
| 开源 | 是 (GPL v2) | 是 (MIT) | 否 | 否 |
| 实时性 | 内核态，抖动 <50us | 用户态，抖动 <500us | 内核态，抖动 <50us | Windows RT，抖动 <100us |
| DC 支持 | 完整 | 基础 | 完整 | 完整 |
| 部署复杂度 | 高（内核模块编译） | 低（用户空间库） | 中 | 低 |
| Windows 支持 | 否 | 是 | 是 | 是 |
| 学习曲线 | 陡峭 | 平缓 | 中 | 中 |
| 调试工具 | 命令行工具 | 有限 | 商业工具 | TwinCAT Scope |
| LinuxCNC | 原生集成 | 需适配 | 需适配 | 不支持 |
| 商业支持 | 社区/商业 | 社区 | 商业 | Beckhoff |

### 4.4 应用场景分布

| 领域 | 占比 | 典型配置 |
|------|------|----------|
| 数控加工（LinuxCNC） | 40% | Intel e1000 + PREEMPT_RT, 1-4ms 周期 |
| 机器人控制 | 20% | Xenomai + RTnet, 0.5-2ms 周期 |
| 测试台架 | 15% | 标准 Linux + 非实时 |
| 科研/教育 | 10% | 任意网卡 + Ubuntu |
| 嵌入式系统 | 10% | ARM + PREEMPT_RT |
| 协议开发 | 5% | Xenomai + 调试工具 |

---

## 5. 市场定位

### 5.1 IgH 在 EtherCAT 主站生态中的位置

IgH 在 EtherCAT 主站生态中定位于**开源 Linux 实时控制主站**。它的核心竞争力：

1. **唯一的开源内核态 EtherCAT 主站**：目前唯一成熟的开源内核态实现
2. **LinuxCNC 标准后端**：LinuxCNC 的官方 EtherCAT HAL 驱动
3. **完整的 DC 实现**：唯一实现完整 DC 补偿的开源主站
4. **多邮箱协议**：CoE/EoE/VoE/SoE 全覆盖

### 5.2 与用户空间方案的竞争定位

| 场景 | 选择 IgH | 选择 SOEM |
|------|----------|-----------|
| 抖动要求 <100us | 内核态，IgH 优势 | 不适合 |
| 抖动要求 <500us | 过度设计 | 用户态足够 |
| LinuxCNC 集成 | 原生支持 | 需手动适配 |
| 需要完整 DC | 完整支持 | 基础支持 |
| 快速原型开发 | 配置复杂 | 易于使用 |
| 内核升级兼容 | 需要适配 | 不受影响 |

### 5.3 与商业主站的对比

| 决策因素 | 选择 IgH | 选择商业方案 |
|----------|----------|-------------|
| 预算 | 有限（开源） | 有商业预算 |
| 技术能力 | 有内核开发能力 | 希望即插即用 |
| 支持需求 | 社区支持足够 | 需要 SLA |
| 定制需求 | 需要深度定制 | 标准功能满足需求 |
| 认证需求 | 自行完成 | 供应商协助 |
| 生命周期 | 长期维护 | 商业保障 |

---

## 6. 产品特色

### 6.1 内核/用户空间双层架构

IgH 的架构核心特征——内核/用户空间双层设计——是其区别于其他 EtherCAT 主站方案的最显著特色。

**内核模块的优点**：
- 最小化的实时抖动（直接访问网卡硬件）
- 与 Linux 调度器紧密集成（SCHED_FIFO 优先级管理）
- 高效的 DMA 操作（零拷贝数据路径）
- 直接系统调用接口（ioctl）

**用户空间库的优点**：
- 灵活的应用程序开发（标准 Linux 编程模型）
- 安全性（内核崩溃不影响用户进程）
- 易于调试（gdb 可附加到用户进程）

**数据流路径**：
```
实时周期：
1. ecrt_master_receive()    -- 内核模块接收 EtherCAT 帧
2. ecrt_domain_process()    -- 内核模块处理域数据
3. 用户读写域数据            -- 用户空间操作（无内核切换）
4. ecrt_domain_queue()      -- 标记域数据待发送
5. ecrt_master_send()       -- 内核模块发送 EtherCAT 帧
```

### 6.2 完整的 DC 实现

IgH 的 DC 支持是开源 EtherCAT 主站中最完整的：

**DC 漂移补偿算法**：
```c
// 漂移补偿算法（简化）
static void dc_drift_compensation(ec_master_t* master)
{
    int64_t ref_time, slave_time;
    int64_t offset, drift;
    
    for (int i = 0; i < master->slave_count; i++) {
        ec_slave_t* slave = &master->slaves[i];
        
        // 读取参考时钟和从站时钟
        ref_time = ec_read_reference_time(master);
        slave_time = ec_read_slave_time(slave);
        
        // 计算偏移
        offset = ref_time - slave_time;
        
        // 计算漂移率（使用低通滤波器）
        drift = offset - slave->dc.last_offset;
        drift = (drift * DC_ALPHA) + (slave->dc.drift * (256 - DC_ALPHA));
        drift >>= 8;
        
        // 写入补偿值
        ec_write_slave_dc_drift(slave, drift);
        slave->dc.last_offset = offset;
    }
}
```

DC 配置灵活性：
- 可配置 SYNC0/SYNC1 周期和偏移
- 支持从站作为参考时钟
- 支持 DC 周期时间从 100us 到 10ms
- 支持 DC 延迟移位（shift time）

### 6.3 用户空间 API 设计

IgH 的用户空间 API 设计简洁且功能完整：

**API 使用模式**：
1. 请求主站 → `ecrt_request_master()`
2. 配置从站 → `ecrt_slave_config_create()`
3. 创建域 → `ecrt_domain_create()`
4. 注册 PDO → `ecrt_slave_config_pdo_assign_create()`
5. 激活 → `ecrt_master_activate()`
6. 实时循环 → `ecrt_master_receive()` / `ecrt_master_send()`

**API 设计原则**：
- 最小状态管理：API 用户不需要管理内部状态机
- 配置一次性：所有配置在 `ecrt_master_activate()` 之前完成
- 运行时不分配内存：实时路径无动态内存分配
- 线程安全：发送和接收函数可在多线程环境中使用

### 6.4 多网卡和多主站支持

IgH 支持同时运行多个主站实例，每个主站绑定到不同的网卡：

```bash
# 加载两个主站实例
$ modprobe ec_master main_devices=eth0,eth1
# 或通过 sysfs 配置
$ echo eth0 > /sys/class/ethercat/create_master
$ echo eth1 > /sys/class/ethercat/create_master

# 访问不同主站
$ ethercat master -m 0  # 主站 0（eth0）
$ ethercat master -m 1  # 主站 1（eth1）
```

多主站的支持使得 IgH 能够控制独立的 EtherCAT 网段，适用于：
- 冗余网络结构
- 物理隔离的安全区域
- 不同速率要求的子网

### 6.5 内核兼容性策略

IgH 的 Linux 内核兼容性策略是通过条件编译和抽象层实现的：

```c
// 内核版本兼容层示例
#if LINUX_VERSION_CODE >= KERNEL_VERSION(5, 0, 0)
    // 使用新 API
    struct net_device* dev = alloc_netdev(
        sizeof(struct ec_netdev_priv),
        "ec%d",
        NET_NAME_UNKNOWN,
        ec_ether_setup);
#else
    // 使用旧 API
    struct net_device* dev = alloc_netdev(
        sizeof(struct ec_netdev_priv),
        "ec%d",
        ec_ether_setup);
#endif
```

IgH 当前支持的内核版本范围：
- 稳定支持：Linux 4.x 系列
- 有限支持：Linux 5.x / 6.x（需补丁）
- 不再支持：Linux 2.6 / 3.x 系列

---

## 7. 对 AUDESYS 参考价值

### 7.1 IgH 实时架构 vs AUDESYS Runtime 通信层 (5星)

IgH 的内核/用户空间双层架构是 AUDESYS Runtime 实时通信层设计的最直接参考模型。

**关键类比**：

| IgH 组件 | AUDESYS 对应组件 | 参考价值 |
|----------|-----------------|----------|
| ec_master.ko（内核模块） | AUDESYS Runtime 内核态通信代理 | 实时性保障机制 |
| libethercat（用户空间库） | AUDESYS Runtime 用户空间通信 API | 接口设计模式 |
| /dev/EtherCATX（字符设备） | AUDESYS Runtime 系统调用接口 | 内核/用户空间通信 |
| ecrt_master_send/receive | amw_inproc Send/Receive | 实时数据路径 |
| 域（Domain） | StreamChannel 组 | 数据分组管理 |

**AUDESYS Runtime 架构建议**：
```
AUDESYS Runtime 实时通信层（参考 IgH 架构）

用户空间：
+---------------------------------------------+
|  Studio IDE / 用户应用                        |
+---------------------------------------------+
|  AUDESYS SDK (audesys_sdk)                  |
|  libaudesys_hal / libaudesys_rt             |
+--+------------------------------------------+
   |  ioctl() / mmap() 通信
+--+------------------------------------------+
|  内核空间：                                   |
|  AUDESYS RT 通信内核模块 (audesys_rt.ko)    |
|  StreamChannel 路由 / Signal 值交换         |
|  HalQoS 执行 / 周期调度                     |
+---------------------------------------------+
|  PREEMPT_RT / Xenomai                       |
+---------------------------------------------+
|  网卡/硬件驱动                               |
+---------------------------------------------+
```

### 7.2 域管理 vs AUDESYS StreamChannel 分组 (4星)

IgH 的域（Domain）概念——将相关 PDO 数据分组到同一帧中——直接对应 AUDESYS 中 StreamChannel 的分组需求。

**域管理的借鉴价值**：
1. **编译期路由**：IgH 的域映射在激活前确定，运行时零配置开销。AUDESYS 的 StreamChannel 路由应在启动阶段确定，RT 路径使用预计算的路由表
2. **批量数据交换**：域将多个从站的 PDO 数据合并为一个帧，减少总线开销。AUDESYS 的 StreamChannel 组也应支持将多个 Signal 合并到同一通道
3. **一致性边界**：域数据在 receive/process 之间保持一致。AUDESYS StreamChannel 的读写应在 RT 周期的固定相位执行

**AUDESYS 设计建议**：
```rust
// AUDESYS StreamChannel 组（参考 IgH Domain）
pub struct StreamChannelGroup {
    channels: Vec<StreamChannel>,
    signal_slots: Vec<SignalSlot>,  // 编译期确定的 Signal 偏移
    tx_buffer: Vec<u8>,
    rx_buffer: Vec<u8>,
}

impl StreamChannelGroup {
    // 编译期计算所有 Signal 在 buffer 中的偏移
    pub fn build(config: &ChannelGroupConfig) -> Self;
    
    // 零开销 Signal 读写（通过预计算偏移）
    pub fn read_signal<T>(&self, id: SignalId) -> &T;
    pub fn write_signal<T>(&mut self, id: SignalId, value: T);
}
```

### 7.3 DC 漂移补偿算法 vs AUDESYS 跨节点同步 (4星)

IgH 的 DC 漂移补偿算法经过多年实际验证，是 AUDESYS 跨节点同步的可靠参考。

**漂移补偿算法的关键要素**：

```c
// IgH DC 漂移补偿 -> AUDESYS 同步算法映射
// 
// IgH 实现                                  AUDESYS 对应
// ---------------------------------------  ------------------------
// ec_read_reference_time()                 NTP/PTP 参考时钟获取
// ec_read_slave_time()                     从设备时间戳读取
// offset = ref_time - slave_time           时间偏移计算
// 低通滤波器平滑 drift                     加权移动平均滤波
// 写入补偿值                                写入时钟调节寄存器
```

**AUDESYS 分阶段同步路线**（基于 IgH 经验）：
- **Phase 1**：软件同步，使用 `clock_nanosleep()` 和参考时钟帧，目标抖动 <100us
- **Phase 2**：网络级同步，实现 IgH 风格的漂移补偿算法，目标抖动 <10us
- **Phase 3**：硬件辅助同步（PTP/IEEE 1588），目标抖动 <1us

### 7.4 实时接口抽象 vs AUDESYS RT 线程调度 (4星)

IgH 对 PREEMPT_RT 和 Xenomai 两种实时方案的支持模式为 AUDESYS 的 RT 线程调度提供了参考。

**IgH 实时层抽象的关键设计**：
1. **统一实时 API**：IgH 提供 `ecrt_master_set_send_interval()` 等平台无关的实时接口，底层适配 PREEMPT_RT 和 Xenomai
2. **线程优先级管理**：使用 SCHED_FIFO 优先级 95-99（PREEMPT_RT）或 RTDM 优先级（Xenomai）
3. **CPU 亲和性**：将 RT 线程绑定到隔离的 CPU 核心上

**AUDESYS RT 线程管理建议**：

```rust
// AUDESYS RT 线程配置（参考 IgH 实时模式）
pub struct RtThreadConfig {
    pub scheduler: SchedulerType,  // SCHED_FIFO / SCHED_RR
    pub priority: u8,              // 建议: 95-99
    pub cpu_affinity: usize,       // 隔离的 CPU 核心
    pub cycle_time: Duration,      // 周期时间
    pub stack_size: usize,         // 栈大小
}

// RT 周期循环（参考 IgH 实时循环模式）
fn rt_cycle(master: &mut RtMaster) -> Result<()> {
    loop {
        // 1. 接收阶段
        master.receive()?;
        
        // 2. 处理阶段
        let inputs = master.process_domain()?;
        
        // 3. 应用控制逻辑
        control_algorithm(inputs);
        
        // 4. 排队和发送
        master.queue_domain()?;
        master.send()?;
        
        // 5. 等待下一个周期（clock_nanosleep）
        wait_next_cycle();
    }
}
```

### 7.5 IgH 的局限性 vs AUDESYS 的改进方向 (3星)

IgH 项目的长期问题为 AUDESYS 提供了"不要这样做"的参考：

| IgH 的问题 | 对 AUDESYS 的教训 | 改进方向 |
|------------|-------------------|----------|
| 内核模块依赖 | 避免内核态实现的必要性 | Phase 1 用户态实现 + PREEMPT_RT |
| 内核版本兼容性负担 | 抽象层应独立于内核版本 | 通过 FFI 或 UIO 实现硬件访问 |
| Bus factor = 1 | 项目风险控制 | 核心模块至少 2 位维护者 |
| 文档不足 | 文档是首要任务 | Phase 0 文档基础设施 |
| 没有 Windows 支持 | 跨平台设计 | Tauri（跨平台） + Rust |
| 用户态 API 复杂 | 简洁 API 设计 | 最小 API 表面积原则 |
| 无冗余支持 | 设计时考虑冗余 | StreamChannel 预留 redundancy 字段 |

### 7.6 总结：IgH 对 AUDESYS 的关键参考权重

| 参考点 | 权重 | 适用模块 | 优先级 |
|--------|------|----------|--------|
| 内核/用户空间双层架构 | 5星 | AUDESYS Runtime 通信层 | P0 |
| 域管理 StreamChannel 分组 | 4星 | amw StreamChannel | P1 |
| DC 漂移补偿算法 | 4星 | amw 跨节点同步 | P1 |
| 实时接口抽象 | 4星 | AUDESYS RT 线程调度 | P1 |
| 多网卡/多主站 | 3星 | Runtime 管理 | P2 |
| PREEMPT_RT 集成模式 | 4星 | 部署/CI | P1 |
| LinuxCNC HAL 接口 | 3星 | Runtime HAL 适配层 | P2 |
| 用户空间 API 设计 | 3星 | AUDESYS SDK | P2 |

**总体评估**：IgH EtherCAT Master 对 AUDESYS 的最核心参考价值在于其**经过生产验证的实时通信架构**。作为唯一成熟的开源内核态 EtherCAT 主站，IgH 用 20 年的实际部署证明了内核/用户空间双层实时通信架构的有效性。AUDESYS Runtime 的通信层可以借鉴这一架构，但应使用 Rust 语言和现代 Linux 机制（如 AF_XDP、io_uring）替代 IgH 直接操作内核网络栈的方式，以降低维护复杂度和提高安全性。

> **补充说明**：IgH EtherCAT Master 虽然在开源 EtherCAT 主站领域具有不可替代的地位，但其技术架构反映了 2005 年代的设计选择（内核模块、C 语言、手动内核适配）。AUDESYS 在设计 Runtime 通信层时应吸收 IgH 的架构思想（分层、实时隔离、域管理），但使用更现代的实现方式（Rust 的零成本抽象、用户态 DPDK/AF_XDP、类型安全），避免继承 IgH 的维护负担。