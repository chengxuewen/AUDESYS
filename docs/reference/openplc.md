# OpenPLC

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: OpenPLC（开源可编程逻辑控制器）
- **开发商/组织**: 最初由 Thiago Alves 在其博士研究期间创建（University of Sao Paulo / Mississippi State University），后由 **Autonomy Logic**（https://autonomylogic.com） 商业运营
- **首次发布年份**: 2014 年（学术论文发表于 IEEE GHTC），OpenPLC v1 于 2015 年发布
- **当前版本**: 
  - OpenPLC Runtime v4: 最新稳定版 v4.0.6-beta（2026年），v4.1.0-rc.3（2026年5月，预发布）
  - OpenPLC Editor v4: v4.1.4（2026年2月）
  - OpenPLC v3（经典版）: 已归档（End of Life），不再维护
- **仓库地址**: 
  - Runtime v4: https://github.com/Autonomy-Logic/openplc-runtime
  - Editor v4: https://github.com/Autonomy-Logic/openplc-editor
  - OpenPLC v3（已归档）: https://github.com/thiagoralves/OpenPLC_v3
  - STruC++ 编译器: https://github.com/Autonomy-Logic/strucpp

### 1.2 产品定位与核心价值主张

OpenPLC 定位为 **低成本、开源、符合 IEC 61131-3 标准的可编程逻辑控制器**，其核心价值主张是：

1. **打破工业自动化成本壁垒** — 典型商用 PLC 价格在 100 美元至数千美元之间，OpenPLC 可将成本降低至 20-200 美元
2. **完全开源透明** — 提供完整源代码，是唯一能提供全部源代码的 PLC 平台
3. **硬件无关性** — 可在几乎任何计算平台上运行（从 Arduino 到工业 PC）
4. **学术与工业双重用途** — 既作为工业自动化平台，也作为网络安全研究的框架

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| 学术研究者 | ICS 安全实验、控制系统教学、SCADA 仿真 | 需完全访问源代码、可修改运行时行为 |
| 工业自动化工程师 | 小型生产线控制、远程站点边缘 PLC | 低成本、标准 IEC 61131-3 编程、Modbus 通信 |
| 教育机构 | 自动化课程、PLC 编程教学 | 低成本硬件（Arduino/Raspberry Pi）、图形化编程 |
| 创客/爱好者 | 家庭自动化、温室控制、DIY 项目 | 简单部署、社区支持 |
| 系统集成商 | 原型验证、PoC 开发 | 快速迭代、无许可证费用 |
| 工业网络安全研究员 | 漏洞发现、攻击仿真、IDS/IPS 开发 | 完整运行时可见性、可控的实验环境 |

### 1.4 许可证模型

- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **商业模型**: 开源免费，Autonomy Logic 提供商业支持和 Autonomy Edge Cloud 云服务
- **封闭组件**: 无 — 完全开源
- **OEM 考虑**: GPL-3.0 要求衍生作品同样开源，商用嵌入式场景需注意许可证合规性

---

## 2. 技术特性

### 2.1 核心架构

OpenPLC Runtime v4 采用 **双进程架构（Dual-Process Architecture）**：

```
+--------------------------------------------------------------+
|                   OpenPLC Runtime v4                          |
+--------------------+-----------------------------------------+
|   进程 1: REST API  |   进程 2: PLC Runtime Core (C/C++)      |
|   Server (Python)   |                                         |
|                     |  +-----------------------------------+  |
|  +---------------+  |  | PLC State Machine                |  |
|  | Flask HTTPS   |  |  | INIT -> STOPPED -> RUNNING       |  |
|  | Port 8443     |  |  |                 -> ERROR         |  |
|  | JWT Auth      |  |  +-----------------------------------+  |
|  | TLS           |  |                                         |
|  +-------+-------+  |  +-----------------------------------+  |
|          |          |  | Scan Cycle Manager                 |  |
|  +-------+-------+  |  | Read Inputs -> Execute Logic      |  |
|  | WebSocket     |  |  | -> Write Outputs -> Sleep         |  |
|  | Debug Interface|  |  | SCHED_FIFO Real-time Priority    |  |
|  +-------+-------+  |  +-----------------------------------+  |
|          |          |                                         |
|  +-------+-------+  |  +-----------------------------------+  |
|  | Compilation   |  |  | Plugin Driver System              |  |
|  | Orchestrator  |  |  | (Python + C/C++ plugins)          |  |
|  +---------------+  |  +-----------------------------------+  |
|                     |                                         |
+--------+-----------+  +-----------------------------------+  |
         |               | STruC++ Generated .so Library    |  |
         |               | (dlopen() loaded dynamically)     |  |
         +---------------+-----------------------------------+  |
                         Unix Domain Socket IPC                |
                         /run/runtime/plc_runtime.sock         |
```

#### 进程 1: REST API Server（Python/Flask）

- **路径**: `webserver/`
- **端口**: 8443（HTTPS，自签名 TLS 证书）
- **功能**: 
  - REST API 供 OpenPLC Editor 通信
  - WebSocket 调试接口
  - 编译编排（协调 PLC 程序的编译流程）
  - 用户认证管理（JWT）
- **入口点**: `webserver/app.py`

#### 进程 2: PLC Runtime Core（C/C++）

- **路径**: `core/src/plc_app/`
- **可执行文件**: `build/plc_main`
- **调度策略**: SCHED_FIFO（实时优先级）
- **功能**: 
  - 确定性扫描周期执行（Deterministic Scan Cycle）
  - PLC 状态机管理（INIT / RUNNING / STOPPED / ERROR / EMPTY）
  - 通过 Unix Domain Socket 与 REST API 进程通信
  - 动态加载编译后的 PLC 程序（.so 共享库）

#### 进程间通信（IPC）

- **命令 Socket**: `/run/runtime/plc_runtime.socket`（文本协议，用于 start/stop/status 命令）
- **日志 Socket**: `/run/runtime/log_runtime.socket`（实时日志流）
- **客户端**: `webserver/unixclient.py`
- **服务器端**: `core/src/plc_app/unix_socket.c`

### 2.2 关键技术能力

#### 编译器技术

OpenPLC 的编译器经历了三次演进：

| 阶段 | 编译器 | 特征 | 状态 |
|------|--------|------|------|
| v1-v3 | LDmicro（修改版） | 仅 Ladder Diagram，生成 ANSI C | 已废弃 |
| v3 | MatIEC | IEC 61131-3 v2，5 种语言全部支持，生成宏密集型 C 代码 | 已被替换 |
| v4 | **STruC++** | IEC 61131-3 Edition 3，生成 C++17（类、虚方法、模板），支持 OOP | 当前主力 |

**STruC++（2025-2026 年发布）** 的关键特性：

- 支持 IEC 61131-3 Edition 3 的全部面向对象特性（方法、接口、继承、属性）
- 支持 CODESYS 扩展（POINTER TO、类型化字面量、64 位类型）
- 可直接导入 CODESYS v2（.lib）和 v3（.library）库文件
- 内置单元测试框架 — 在编译器级别进行 PLC 程序测试
- 交互式 REPL 环境（`strucpp source.st --build`）
- 基于 TypeScript 开发，可在浏览器中运行
- 输出格式为 C++17，生成可读性良好的类层次结构
- 支持的 IEC 61131-3 语言：ST（结构化文本）、IL（指令表）、LD（梯形图）、FBD（功能块图）、SFC（顺序功能图）

#### 类型系统

OpenPLC 运行时支持的 IEC 61131-3 类型系统包含丰富的类型层次，在 STruC++ 的 `core/strucpp_runtime/include/` 中实现：

| 头文件 | 行数 | 内容 |
|--------|------|------|
| `iec_types.hpp` | 228 | 类型基础定义 |
| `iec_array.hpp` | 308 | 数组类型实现 |
| `iec_char.hpp` | 251 | 字符类型实现 |
| `iec_date.hpp` | 305 | 日期类型实现 |
| `iec_dt.hpp` | 433 | 日期时间组合类型 |
| `iec_enum.hpp` | 277 | 枚举类型实现 |
| `iec_located.hpp` | 221 | 位于变量（AT 地址映射） |
| `iec_memory.hpp` | 94 | 内存管理 |
| `iec_pointer.hpp` | 508 | 指针类型 |
| `iec_retain.hpp` | 83 | 保持型变量（RETAIN） |
| `iec_std_lib.hpp` | 1,041 | 标准库函数实现 |
| `iec_string.hpp` | 1,134 | 字符串类型实现 |
| `iec_struct.hpp` | 132 | 结构体实现 |
| `iec_subrange.hpp` | 364 | 子范围类型 |
| `iec_time.hpp` | 441 | 时间类型 |
| `iec_tod.hpp` | 318 | 日时刻类型（Time of Day） |
| `iec_traits.hpp` | 584 | 类型特性模板 |
| `iec_var.hpp` | 501 | 变量基础设施 |
| `iec_wstring.hpp` | 539 | 宽字符串类型 |
| `iec_ptr.hpp` | 216 | 智能指针 |
| `debug_dispatch.hpp` | 340 | 调试协议调度 |

#### 扫描周期（Scan Cycle）

OpenPLC 的扫描周期模型遵循标准 PLC 的三阶段循环：

```
1. Read Inputs:   插件驱动从硬件读取输入（digital_input[]、analog_input[]）
2. Execute Logic: 执行编译后的 PLC 程序（ext_config_run__()）
3. Write Outputs: 插件驱动向硬件写入输出（digital_output[]、analog_output[]）
4. Sleep:         使用 clock_nanosleep() 精确休眠至下一周期
```

- **典型周期时间**: 20-50ms（Raspberry Pi），5-10ms（工业 PC），10-20ms（ESP32）
- **实时调度**: SCHED_FIFO 优先级，需要 root 权限或 CAP_SYS_NICE
- **推荐**: 专用 CPU 核心 + PREEMPT_RT 内核（可选但有益）

#### PLC 状态机

```
INIT -> STOPPED -> RUNNING -> STOPPED -> RUNNING（循环）
                    -> ERROR -> STOPPED
                    -> EMPTY（无程序状态）
```

### 2.3 支持的硬件/平台

OpenPLC v4 支持几乎所有能运行 Linux 的平台：

| 平台类型 | 具体硬件 | 推荐场景 | 周期时间 |
|---------|---------|---------|---------|
| 单板计算机 | Raspberry Pi 3/4/5 | 教育、原型 | 20-50ms |
| 单板计算机 | BeagleBone Black | 工业边缘 | 待确认 |
| 单板计算机 | x86 Linux PC | 高性能场景 | 5-20ms |
| 工业 PC | Beckhoff CX、Siemens IOT2000 | Tier 3 工业 | 5-10ms |
| 微控制器 | Arduino Uno/Mega（v3 兼容） | 超低成本 | 10-20ms |
| 微控制器 | ESP32 | IoT 边缘 | 10-20ms |
| 微控制器 | Arduino Nano、MKR 系列 | 小体积场景 | 待确认 |
| 微控制器 | RP2040（树莓派 Pico） | 超低成本 | 待确认 |
| 容器 | Docker（多架构：x86_64, ARM64, ARM32） | 云端/测试 | 取决于宿主 |

### 2.4 编程语言与开发工具链

#### 支持的 IEC 61131-3 语言

| 语言 | 缩写 | 类型 | v4 支持状态 |
|------|------|------|------------|
| Ladder Diagram（梯形图） | LD | 图形化 | 完全支持 |
| Structured Text（结构化文本） | ST | 文本化 | 完全支持 |
| Function Block Diagram（功能块图） | FBD | 图形化 | 路线图中（v4 初期缺失） |
| Instruction List（指令表） | IL | 文本化 | 支持（已退役但兼容） |
| Sequential Function Chart（顺序功能图） | SFC | 图形化 | 路线图中（v4 初期缺失） |
| Python 脚本 | Python | 文本化 | 路线图中 |
| C/C++ 内联 | C/C++ | 文本化 | 支持（Arduino 目标） |

#### 开发工具链流程

```
OpenPLC Editor (TypeScript/Electron)
  |
  | 1. 用 LD/ST/FBD 设计 PLC 程序
  | 2. 编辑器本地编译：JSON -> XML -> ST -> C/C++（STruC++）
  | 3. 打包为 program.zip
  |
  +-- HTTPS POST /api/upload-file（JWT 认证）
  |
  v
OpenPLC Runtime
  |
  | 4. 验证并提取到 core/generated/
  | 5. scripts/compile.sh 使用 CMake + GCC 编译
  | 6. 生成 build/libplc_<hash>.so 共享库
  | 7. dlopen() 动态加载执行
  |
  v
SCHED_FIFO 实时执行
```

### 2.5 线程模型详解

OpenPLC Runtime v4 的线程模型基于 SCHED_FIFO 实时优先级设计，核心线程包括：

| 线程 | 角色 | 调度策略 | 优先级 | 职责 |
|------|------|---------|--------|------|
| PLC 扫描线程 | 主执行 | SCHED_FIFO | 高（默认 50） | 扫描周期循环：读输入->执行逻辑->写输出->休眠 |
| Unix Socket 监听线程 | IPC | SCHED_OTHER | 普通 | 处理来自 REST API 进程的命令和日志请求 |
| EtherCAT 总线线程（v4.1+） | 现场总线 | SCHED_FIFO | 高（专有） | 与 EtherCAT 从站进行周期数据交换 |
| 插件驱动线程 | I/O | 按插件配置 | 可变 | 各插件可自建线程用于硬件轮询 |

**扫描周期时序**：

```
周期开始                                周期结束
  |                                         |
  +-- Read Inputs（读输入）---- t_read -----+
  +-- Execute Logic（执行逻辑）-- t_exec ---+
  +-- Write Outputs（写输出）--- t_write ---+
  +-- Sleep（休眠至下一周期）--- t_sleep ---+
```

扫描周期时间 = t_read + t_exec + t_write + t_sleep。周期频率由用户在运行时配置中设定（典型值 20ms = 50Hz）。

**EtherCAT 周期线程**（v4.1.0-rc 新增）：

- 专有的 SCHED_FIFO 线程用于 EtherCAT 总线数据交换
- 通过 tick divisor 与 IEC 任务（IEC Task）关联
- 使用 Welford 在线算法计算扫描周期统计数据（EWMA 指数加权移动平均）
- 诊断数据包括：周期时间、抖动（Jitter）、丢帧统计

**实时性要求**：

- 需要 root 权限或 `CAP_SYS_NICE` capability
- 推荐专用 CPU 核心（通过 taskset 绑定）
- PREEMPT_RT 内核可选但有益（减少调度延迟）
- 实时内核可能将周期抖动从 +/-500us 降低到 +/-50us（待确认）

### 2.6 v4 与 v3 的架构差异

| 维度 | OpenPLC v3（已归档） | OpenPLC v4（当前） |
|------|---------------------|-------------------|
| 架构 | 单进程（Python Flask + C 运行时一体） | 双进程（Python API Server + C/C++ 实时内核分离） |
| 编译器 | MatIEC（IEC 61131-3 v2，生成 C） | STruC++（IEC 61131-3 Ed 3，生成 C++17，支持 OOP） |
| 编辑器 | Python 2.7/wxPython 桌面应用 | TypeScript/Electron，跨平台（Win/Mac/Linux） |
| 代码生成 | 宏密集型 C，flat-index 变量 API | C++17 类层次结构，分层 debug 寻址 |
| 实时性 | SCHED_FIFO，单线程 | SCHED_FIFO，支持 EtherCAT 专线线程 |
| 安全 | 无内置安全 | TLS + JWT + 文件上传验证 |
| 部署 | 手动依赖安装 | 一键安装脚本 + systemd 服务 + Docker |
| 硬件支持 | 通过硬件层代码框配置 | 插件系统（Python + C/C++ 两种类型） |
| 调试 | 基本 | WebSocket 实时变量监视和强制 |
| IPC | Python 函数调用（Web 和运行时同进程） | Unix Domain Socket 双进程通信 |
| 维护状态 | 已归档（End of Life） | 活跃开发中 |

### 2.7 STruC++ 编译器架构详解

STruC++ 作为 OpenPLC v4 的关键技术突破，其架构分为以下层次：

#### 前端（Frontend）

- **词法分析**（Lexer）：基于 TypeScript 实现，支持 UTF-8 编码的 ST 源码
- **语法分析**（Parser）：递归下降解析器（Recursive Descent Parser），支持 IEC 61131-3 Edition 3 语法
- **抽象语法树**（AST）：类型化 AST 节点表示所有 IEC 语言构造

#### 语义分析（Semantic Analysis）

- **符号表**：变量、功能块、函数、方法的全局符号解析
- **类型检查**：完整的 IEC 61131-3 Edition 3 类型系统验证
- **重载解析**：函数和运算符重载消歧
- **OOP 语义**：方法调用、接口实现、继承层次的验证

#### 后端（Backend）

- **代码生成**：将 AST 翻译为 C++17 源代码
- **生成物**：`Configuration` 类（入口点）、`Task` 类（每个 IEC 任务）、`Program`/`FunctionBlock` 实例
- **运行时可执行导出**：`--build` 模式生成独立可执行文件，支持交互式 REPL
- **共享库导出**：生成 `.so` 文件供运行时的 `dlopen()` 加载

#### 测试框架

```
# 编译并运行测试
strucpp source.st --test tests.st

# 交互式运行（REPL 模式）
strucpp my_program.st --build

# 在运行时中看到 help 命令
> help
> cycle           # 执行一个扫描周期
> force %QX0.0 true  # 强制输出
> inspect %IW0       # 查看输入变量
```

#### STruC++ 与运行时的 ABI 契约

Runtime v4 通过以下 C 链接导出符号与生成的 .so 进行交互：

| 符号 | 类型 | 用途 |
|------|------|------|
| `strucpp_get_config()` | 函数 | 获取 Configuration 入口点 |
| `strucpp_set_locks()` | 函数 | 提供互斥锁指针 |
| `strucpp_get_located_vars()` | 函数 | 获取位于变量描述表 |
| `strucpp_get_located_var_count()` | 函数 | 获取变量计数 |
| `strucpp_debug_array_count()` | 函数 | debug 协议数组数量 |
| `strucpp_debug_elem_count()` | 函数 | debug 协议元素数量 |
| `strucpp_debug_set()` | 函数 | 写变量（debug） |
| `strucpp_debug_read()` | 函数 | 读变量（debug） |
| `g_config` | 全局变量 | Configuration_CONFIG0 实例指针 |

---

## 3. 功能概览

### 3.1 主要功能模块

#### Runtime 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| PLC 主循环 | `core/src/plc_app/plc_main.c` | 运行时入口、信号处理、初始化 |
| 状态管理 | `core/src/plc_app/plc_state_manager.cpp` | PLC 状态机管理、.so 加载/卸载 |
| 扫描周期 | `core/src/plc_app/scan_cycle_manager.c` | 确定性时序控制 |
| 调试协议 | `core/src/plc_app/debug_handler.c` | WebSocket 调试协议实现 |
| I/O 缓冲 | `core/src/plc_app/image_tables.cpp` | I/O 映像表管理 |
| 看门狗 | `core/src/plc_app/utils/watchdog.c` | 系统健康监测 |
| 日志 | `core/src/plc_app/utils/log.c` | 循环日志缓冲区 |
| 定时器 | `core/src/plc_app/utils/timing.c` | 高精度时间管理 |

#### Web Server 模块

| 模块 | 路径 | 职责 |
|------|------|------|
| REST API | `webserver/restapi.py` | 程序上传、状态查询、控制 API |
| WebSocket 调试 | `webserver/debug_websocket.py` | 实时变量监视与强制 |
| 编译编排 | `webserver/plcapp_management.py` | 编译流程协调 |
| 运行时管理 | `webserver/runtimemanager.py` | PLC 进程启动/停止 |
| 配置管理 | `webserver/config.py` | 运行时配置 |
| 认证 | `webserver/credentials.py` | TLS 证书生成 |

#### 支持的通信协议

| 协议 | 角色 | 端口 | 用途 |
|------|------|------|------|
| Modbus TCP | Server + Client | 502 | SCADA/HMI 通信 |
| Modbus RTU | Server + Client | 串口 | 串行设备通信 |
| EtherNet/IP | Server | 44818（待确认） | Allen-Bradley 兼容 |
| PCCC | Server | - | Allen-Bradley 旧协议 |
| DNP3 | Server | 20000 | 电力/能源行业 |
| Snap7（S7） | Server | 102（待确认） | Siemens S7 兼容 |
| EtherCAT | Master | - | 高速现场总线 |
| OPC UA | Server（插件） | 4840（待确认） | 信息模型集成 |

#### 通信协议地址映射

OpenPLC 使用标准 PLC 内存区域进行协议访问：

| 内存区域 | 数据类型 | 用途 |
|---------|---------|------|
| %IX0.0-%IX0.n | bool | 数字输入 |
| %QX0.0-%QX0.n | bool | 数字输出 |
| %IW0-%IWn | int | 模拟输入 |
| %QW0-%QWn | int | 模拟输出 |
| Modbus Holding Registers | int16_t | 可选通信区 |

### 3.2 关键工作流

#### 工作流：PLC 程序开发与部署

1. **创建** — 在 OpenPLC Editor v4 中使用 LD、ST 或 FBD 设计程序
2. **本地编译** — Editor 将程序编译为 ST，再通过 STruC++ 编译为 C++17，打包为 program.zip
3. **上传** — Editor 通过 HTTPS POST `/api/upload-file`（JWT 认证）上传到 Runtime
4. **远程编译** — Runtime 验证、解压，使用 CMake + GCC 编译为 .so 共享库
5. **执行** — Runtime 通过 `dlopen()` 加载 .so，进入 RUNNING 状态，开始扫描周期
6. **调试** — Editor 通过 WebSocket 连接 `/api/debug`，进行实时变量监控和强制

#### 工作流：硬件 I/O 集成

1. 在 Runtime 中创建或配置 `plugins.conf`
2. 选择插件类型：Python（type=0）或 Native C/C++（type=1）
3. 实现核心回调函数：
   - `read_inputs()` — 从硬件读取输入
   - `write_outputs()` — 向硬件写入输出
   - `update_config()` — 配置更新处理
4. Python 插件支持隔离的虚拟环境（per-plugin venv）

### 3.3 扩展机制

OpenPLC 的扩展主要通过三个机制实现：

1. **插件系统（Plugin System）**:
   - Python 插件运行在隔离的虚拟环境中
   - C/C++ 原生插件直接编译进运行时
   - 插件类型在 `plugins.conf` 中配置
   - 示例插件位于 `core/src/drivers/plugins/python/` 和 `core/src/drivers/plugins/native/`

2. **自定义硬件驱动**:
   - 通过 HAL 接口实现 `updateBuffersIn()` 和 `updateBuffersOut()`
   - 包括数字输入/输出、模拟输入/输出、Modbus 寄存器
   - 支持 EtherCAT 从站配置（EtherCAT Slave Information 文件解析）

3. **STruC++ 编译器扩展**:
   - 自有的 `.stlib` 库格式（带元数据的 JSON + ST/C++ 源码）
   - 可导入 CODESYS v2（.lib）和 v3（.library）库文件
   - 支持用户自定义功能块和库

### 3.4 编译流水线详解

OpenPLC v4 的编译流程在 Editor 端和 Runtime 端各执行一部分，形成了独特的分级编译流水线：

#### 第一级：Editor 端预编译（TypeScript）

```
梯形图/功能块图（图形化编辑器中的图形元素）
  -> JSON 序列化
  -> XML 中间表示（IEC 61131-3 标准 XML 格式，保存为 .xml）
  -> ST 代码生成（结构化文本，保存为 .st）
  -> STruC++ 前端解析（语法 + 语义分析）
  -> C++17 源代码生成
  -> 打包为 program.zip（含 .cpp 源文件和 CMakeLists.txt）
```

#### 第二级：Runtime 端远程编译（C/C++）

```
Editor HTTPS POST -> /api/upload-file（JWT 认证）
  -> Runtime webserver 接收并保存到 core/generated/
  -> scripts/compile.sh 调用 CMake 配置
  -> GCC 编译为 .so 共享库
  -> 输出到 build/libplc_<sha256>.so
```

#### 第三级：运行时动态加载

```
plc_state_manager.cpp 调用 dlopen("build/libplc_<sha256>.so", RTLD_NOW)
  -> dlsym("strucpp_get_config") 获取 Configuration 入口点
  -> dlsym("strucpp_set_locks") 设置互斥锁
  -> 遍历 ConfigurationInstance，定位所有 IEC 变量
  -> 绑定 image_tables 缓冲指针到位于变量
  -> 进入 RUNNING 状态，开始扫描周期
```

- **编译缓存**: Runtime 缓存已编译的 .so 文件，当上传相同程序时无需重新编译
- **增量编译**: 仅在 IEC 源代码发生变化时触发重新编译（通过 content hash 检测）

### 3.5 硬件抽象层（HAL）设计

OpenPLC 的 HAL 虽然概念上与 LinuxCNC HAL 同名，但实现更轻量。它是一个基于回调函数的插件接口：

```
+------------------------------+
|      OpenPLC Runtime         |
|                              |
|  +------------------------+  |
|  |    HAL 接口层           |  |
|  |  updateBuffersIn()      |  |
|  |  updateBuffersOut()     |  |
|  +--------+---------------+  |
|           |                  |
|  +--------+---------------+  |
|  |    插件驱动层           |  |
|  |  +------+ +--------+   |  |
|  |  |RPi   | |Modbus  |   |  |
|  |  |GPIO  | |RTU     |   |  |
|  |  +------+ +--------+   |  |
|  +--------+---------------+  |
|           |                  |
|  +--------+---------------+  |
|  |    物理硬件/仿真层      |  |
|  |  GPIO / 串口 / 网络    |  |
|  +------------------------+  |
+------------------------------+
```

**HAL 数据缓冲**:

| 缓冲数组 | 类型 | 读写位置 |
|---------|------|---------|
| `bool digital_input[]` | 数字输入 | `updateBuffersIn()` 中更新 |
| `bool digital_output[]` | 数字输出 | `updateBuffersOut()` 中读取 |
| `int analog_input[]` | 模拟输入 | `updateBuffersIn()` 中更新 |
| `int analog_output[]` | 模拟输出 | `updateBuffersOut()` 中读取 |
| `int16_t input_register[]` | Modbus 输入寄存器 | 可选，由 Modbus 驱动使用 |
| `int16_t holding_register[]` | Modbus 保持寄存器 | 可选，由 Modbus 驱动使用 |

**自定义硬件驱动开发**: 开发者需要实现两个核心函数：

- `updateBuffersIn()` — 将物理输入的当前状态读入 `digital_input[]` 和 `analog_input[]`
- `updateBuffersOut()` — 将 `digital_output[]` 和 `analog_output[]` 写入物理输出

### 3.6 调试协议（Debug Protocol）

OpenPLC v4 的调试协议基于 WebSocket，支持以下功能：

| 功能码 | 名称 | 用途 |
|-------|------|------|
| FC 0x41 | ARRAY_COUNT | 获取变量数组数量 |
| FC 0x42 | ELEM_COUNT | 获取指定数组的元素数量 |
| FC 0x43 | SIZE | 获取变量字节大小 |
| FC 0x44 | SET | 写入变量值（支持 Force） |
| FC 0x45 | READ | 读取变量值 |

调试会话流程：
1. Editor 通过 WebSocket 连接到 Runtime 的 `/api/debug` 端点
2. Editor 发送 FC 0x45 轮询监视列表中的变量
3. Editor 通过 FC 0x44 强制变量值（Force）
4. Runtime 在每个扫描周期结束时更新调试缓冲区
5. Editor 计算变量变化并更新 UI 显示

v4 中调试协议从 flat-index 寻址升级为 hierarchical 寻址（`arr_idx.elem_idx`），支持复杂数据结构的逐层次浏览。

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| OpenPLC v3 GitHub Stars | ~1,565 |
| OpenPLC Editor v4 GitHub Stars | ~228（TypeScript） |
| OpenPLC Runtime v4 GitHub Stars | ~132（Python + C/C++） |
| STruC++ GitHub Stars | ~44（TypeScript） |
| OpenPLC v3 Forks | ~598 |
| OpenPLC Editor v4 Contributors | ~30 |
| v3 状态 | 已归档（Archived / End of Life） |
| v4 最新稳定版 | v4.0.6-beta |
| v4 最新预发布 | v4.1.0-rc.3（2026-05-22） |
| Editor 最新版 | v4.1.4（2026-02-28） |
| 主要开发语言 | TypeScript（Editor）、C/C++（Runtime Core）、Python（API Server） |

### 4.2 社区规模/用户基数

- **学术论文**: Google Scholar 搜索 "OpenPLC" 超过 200 篇相关论文（截至 2026 年）
- **主要研究方向**: ICS 网络安全（最多）、工业控制系统仿真、入侵检测、Modbus 协议安全
- **核心论文引用**: 2014 年原始论文 104 次引用；2018 年 Computers & Security 论文大量引用
- **工业应用**: 小型制造、水处理、HVAC、农业灌溉、智能交通
- **用户论坛**: https://openplc.discussion.community — 9,000+ 帖子，活跃社区

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **OpenPLC Editor** | 跨平台桌面 IDE（Windows/macOS/Linux），基于 TypeScript/Electron |
| **OpenPLC Runtime** | 无头 PLC 运行时，支持 REST API 远程控制 |
| **STruC++** | 新一代 IEC 61131-3 编译器 |
| **OpenPLC61850** | 学术分支 — 增加 IEC 61850 MMS 协议支持 |
| **OpenPLC Aqua** | 安全增强分支 — 增加加密、白名单、TLS 等功能 |
| **Autonomy Edge Cloud** | 商业云服务 — 远程管理 OpenPLC Runtime |
| **HMI Builder** | 网页版 HMI 构建工具 |
| **第三方扩展板** | Pixtend（Raspberry Pi 工业 I/O 扩展）、Sequent Microsystems Mega-IO HAT |

### 4.4 最新发展趋势

1. **STruC++ 编译器替代 MatIEC** — OpenPLC 社区为期二十年的编译器依赖被打破，STruC++ 支持 IEC 61131-3 Edition 3 和 CODESYS 兼容性
2. **v4 全面重写** — Editor 从 Python/wxPython 迁移到 TypeScript/Electron，Runtime 采用双进程架构
3. **EtherCAT 支持增强** — v4.1.0 新增基于 SCHED_FIFO 的 EtherCAT 总线线程、扫描统计、Welford 诊断
4. **安全增强** — TLS 加密 + JWT 认证从 v4 设计之初就内建
5. **OPC UA 集成** — 通过插件系统支持 OPC UA 协议
6. **基于 .so 的动态加载** — STruC++ 生成为共享库，运行时通过 `dlopen()` 加载，支持热更新潜力
7. **CI/CD 集成** — STruC++ 的内置测试框架支持在 CI 管道中自动执行 PLC 程序测试

### 4.5 安全评估

OpenPLC 的安全特性在不同版本间有显著差异：

#### v3 安全缺陷（已知）

OpenPLC v3 在设计之初未考虑安全性，已知问题包括：

- **缺乏加密**：所有通信（Web、Modbus）均为明文
- **缺乏认证**：Web 界面使用默认凭据（openplc/openplc），Modbus 无认证
- **缺乏完整性保护**：上传的程序文件无数字签名或 hash 验证
- **历史程序泄露**：攻击者可获取之前上传的所有 PLC 程序
- **控制逻辑注入**：无需凭据即可修改运行中的用户程序
- **硬件层代码框**：允许任意代码执行（CVE-2021-31630）
- **文件上传验证不足**：可能导致路径遍历或文件包含攻击

这些问题已被多篇学术论文验证（IEEE Access 2024、INF 2023 等）。

#### v4 安全增强

OpenPLC Runtime v4 从设计之初就内置了安全特性：

- **TLS 加密**：所有 HTTP 通信通过自签名 TLS 证书加密
- **JWT 认证**：用户登录后获得 JSON Web Token，API 请求需要 Bearer Token
- **文件上传验证**：严格的文件类型和内容验证
- **Unix Domain Socket 隔离**：API 进程和实时内核通过 IPC 通信，不共享内存
- **插件隔离**：每个 Python 插件运行在独立的虚拟环境中

#### 已知局限

- **无 SIL 认证**：OpenPLC 未通过 IEC 61508 功能安全认证，不适用于安全关键应用
- **无冗余架构**：无双机热备或故障切换机制
- **无审计日志**：操作日志功能有限
- **无访问控制粒度**：仅支持用户/密码级认证，不支持角色权限管理
- **操作系统依赖**：安全性严重依赖底层操作系统的加固程度

#### 学术安全增强分支

| 分支 | 增强特性 |
|------|---------|
| **OpenPLC Aqua** | 凭据加密 + Web 服务器白名单 + SSL/TLS + 入侵检测 |
| **OpenPLC61850** | IEC 61850 MMS 协议支持，含相应的安全考虑 |
| **AESI-PLC** | ST 文件完整性验证 + 内存保护 + 加密通信 |

---

## 5. 市场定位

### 5.1 主要应用行业与场景

| 行业 | 典型应用 | 部署级别 |
|------|---------|---------|
| 教育/学术 | PLC 编程教学、自动化课程、研究实验平台 | Tier 1（Raspberry Pi） |
| 网络安全研究 | ICS 攻击仿真、漏洞研究、入侵检测系统 | Tier 1-2（Linux PC） |
| 小型制造 | 生产线简单控制、泵顺序控制、包装控制 | Tier 2-3（工业 Pi） |
| HVAC | 暖通空调控制、楼宇自动化 | Tier 2（Raspberry Pi） |
| 农业 | 灌溉控制、温室环境监控、畜牧业自动化 | Tier 1-2 |
| 水务 | 水处理厂控制、泵站远程控制 | Tier 2（边缘网关） |
| 智能交通 | 交通灯控制（有实际案例） | Tier 2 |
| 能源 | 光伏跟踪、变电站监控（通过 OpenPLC61850） | Tier 2-3 |

**四种部署层级**：

| 层级 | 硬件 | 成本 | 周期时间 | 适用场景 |
|------|------|------|---------|---------|
| Tier 1 | Raspberry Pi + 通用 I/O HAT | 80-200 USD | 50-100ms | 教育、PoC、非关键控制 |
| Tier 2 | Raspberry Pi + 工业扩展板（Pixtend） | 400-800 USD | 20-50ms | 边缘 PLC、远程站点 |
| Tier 3 | 工业 PC + EtherCAT | 1,500-5,000 USD | 5-10ms | 多轴控制、高速扫描 |
| Tier 4 | Arduino/ESP32 裸机 | 20-60 USD | 10-20ms | 远程传感器、IoT 终端 |

### 5.2 竞争对手对比

| 维度 | OpenPLC | CODESYS | Beckhoff TwinCAT | Siemens S7 | Arduino PLC IDE |
|------|---------|---------|-----------------|-----------|----------------|
| 开源 | 完全开源（GPL-3.0） | 商业（免费版有限制） | 商业 | 商业 | 商业（基于 OpenPLC） |
| 许可证费用 | 零 | 免费版功能受限 | 需购买授权 | 高昂 | Arduino 板免费 |
| IEC 61131-3 | 5 种语言（Ed 3） | 完全支持 | 完全支持 | 支持 | 部分支持 |
| 安全认证 | 无 SIL | SIL 2/3 | SIL 2/3 | SIL 3 | 无 |
| 实时性 | 软实时（无硬实时内核） | 硬实时 | 硬实时 | 硬实时 | 有限 |
| 硬件支持 | 极广（Arduino 到 PC） | Windows + 特定硬件 | Windows + Beckhoff | 西门子硬件 | Arduino 家族 |
| 通信协议 | 5+ 种（Modbus/ENIP/EtherCAT） | 极多协议支持 | 极多协议支持 | Profinet/ProfiBus | Modbus 为主 |
| 社区规模 | 中等（学术领域大） | 大 | 大 | 极大 | 中等 |
| 总拥有成本 | 极低 | 中 | 高 | 极高 | 极低 |
| 商业化支持 | 有限（Autonomy Logic） | 完善 | 完善 | 完善 | Arduino 支持 |

### 5.3 行业引用案例

以下为 OpenPLC 在行业和研究中的实际部署案例（来自公开文献和社区报告）：

#### 学术与教育

- **密西西比州立大学**（2014-2018）：原始论文所在地，持续用于 ICS 安全课程
- **上海交通大学**（2022）：基于 OpenPLC 的实时异常检测框架
- **兰卡斯特大学**（2023）：安全 PLC 编程社区驱动倡议的参考平台
- **布兰登堡工业大学**（2023-2024）：多项 OpenPLC 漏洞发现和安全增强研究

#### 工业与公共服务

- **智能交通系统**：社区报告已有多个交通灯控制系统基于 OpenPLC 部署
- **水处理**：学术论文中验证的水处理厂仿真和监控场景
- **农业自动化**：灌溉控制和温室环境监控（多种部署层级）
- **暖通空调控制**：楼宇自动化场景的 HVAC 控制

#### 工业控制安全研究

OpenPLC 已成为 ICS 安全研究的 **标准仿真平台**。截至 2024 年，超过 50 篇学术论文以其为实验对象，涵盖：

- Modbus 协议注入攻击与防御
- 控制逻辑注入与篡改攻击
- Man-in-the-Middle 攻击与重放攻击
- 基于机器学习的异常检测系统
- PLC 恶意软件检测方法
- 专有协议逆向工程

---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **唯一完全开源的工业级 PLC**：
   - 提供全部源代码（Runtime + Editor + Compiler）
   - 无黑箱组件 — 所有通信协议和运行时行为完全透明
   - 唯一能在学术论文中被完全复现的 PLC 平台

2. **极低成本**：
   - 硬件成本低至 20 美元（Arduino）
   - 零许可证费用
   - 部署层级灵活，同一软件栈可从 Arduino 扩展到工业 PC

3. **极广硬件兼容性**：
   - 从 8 位 AVR 到 64 位 ARM/x86 的全平台覆盖
   - 唯一支持 Arduino 家族的现代化 PLC 软件
   - Docker 支持使云原生部署成为可能

4. **学术研究框架**：
   - 已成为 ICS 网络安全研究的事实标准框架
   - 数百篇学术论文以其为实验平台
   - 多个学术分支（OpenPLC61850、OpenPLC Aqua）

5. **编译器创新**：
   - STruC++ 是首个支持 IEC 61131-3 Edition 3 的开源编译器
   - 内建单元测试框架（PLC 程序测试无需特定 IDE 或硬件）
   - 浏览器可运行（基于 TypeScript）

### 6.2 标志性功能或设计理念

- **"双进程解耦架构"** — 将 REST API 处理与实时 PLC 执行分离，保障实时性不受 Web 请求影响
- **"硬件无关的 IEC 61131-3 运行时"** — 通过 HAL 层解耦，同一份 PLC 程序可在不同硬件上运行
- **"动态 .so 加载"** — 编译后的 PLC 程序作为共享库被运行时动态加载，支持 C++ 类的完整运行时多态
- **"自带单元测试的编译器"** — STruC++ 的 `--test` 模式开创了 PLC 开发 CI/CD 先河
- **"以学术验证推动工业应用"** — 从博士项目成长为工业可用平台

### 6.3 创新设计哲学

OpenPLC 的设计哲学中包含几个值得注意的理念：

#### "从学术到产业"的演进路径

OpenPLC 从博士项目出发，经过 12 年发展成为一个工业可用平台。其演进路径为：

1. **Phase 1（2014-2015）**: 论文概念验证，仅支持 Arduino + LD
2. **Phase 2（2016-2018）**: OpenPLC v2，软件 PLC 模式 + Modbus 支持
3. **Phase 3（2018-2023）**: OpenPLC v3，MATIEC 编译器 + Web UI + 多协议
4. **Phase 4（2023-2026）**: OpenPLC v4，STruC++ + TypeScript IDE + 双进程架构

这种演进路径对 AUDESYS 的参考价值在于：不必从一开始就追求功能完整性，而是通过持续的社区驱动迭代逐步成熟。

#### "编译器中心"设计

OpenPLC 将关键创新集中在编译器层面（从 MatIEC 到 STruC++），而非运行时层面。这种策略的好处是：

- 编译器改进可以立刻惠及所有目标平台（Arduino、Raspberry Pi、Linux PC）
- 编译器层面的优化（OOP、类型系统、测试框架）不受运行时架构变化影响
- 独立于特定硬件或操作系统，跨平台效益最大化

#### "即用型"部署哲学

OpenPLC v4 强调通过一键安装脚本、systemd 服务自动化和 Docker 容器化降低部署门槛。这与传统工业自动化中需要专业工程师数天部署的模式形成鲜明对比。

---

## 7. 对 AUDESYS 的参考价值

### 7.1 可借鉴的架构设计/理念

#### 1. 双进程分离架构

OpenPLC v4 将 **REST API 进程**（Python/Flask）与 **PLC 实时内核**（C/C++ SCHED_FIFO）分离，通过 Unix Domain Socket 通信。这一设计确保：

- REST API 的 HTTP 开销和 Python GIL 不污染实时路径
- PLC 内核可随时独立重启而不影响 API 服务
- 安全层（TLS/JWT）集中在 API 进程，避免实时线程负担

**AUDESYS 参考**: Runtime 模块可考虑类似的分离架构 — 控制面（管理 API）与数据面（实时控制）解耦。

#### 2. IEC 61131-3 编译器流程

```
IEC 61131-3 Source (ST/LD/FBD/IL/SFC)
  -> XML Intermediate
  -> ANSI C / C++17 Code Generation（MatIEC / STruC++）
  -> GCC/CMake Binary Compilation
  -> Dynamic Loading (.so / dlopen)
```

**AUDESYS 参考**: 如需要支持 IEC 61131-3，可借鉴此三级编译流水线（源语言 -> 中间表示 -> 编译 -> 动态加载）。

#### 3. 插件化 I/O 驱动

OpenPLC 的插件系统通过 `read_inputs()` / `write_outputs()` 回调函数抽象硬件，支持 Python 和 C/C++ 两种插件类型。这与 AUDESYS HAL 设计中的 `HalTransport` trait 思路高度一致。

#### 4. 双用途定位

OpenPLC 证明了一个控制平台可以同时服务 **工业应用** 和 **学术研究** 两个截然不同的市场。AUDESYS 的 Studio IDE + Simulator 组合也有潜力覆盖开发和仿真双场景。

### 7.2 可移植/适配的技术模块

| 技术模块 | 描述 | 移植价值 |
|---------|------|---------|
| **STruC++ IEC 61131-3 编译器** | 生成 C++17，支持 Edition 3 | 高，如果 AUDESYS 需要 PLC 语言支持 |
| **MatIEC 词法/语法分析器** | 成熟的 flex/bison 实现 | 中，可作为 ST 解析参考 |
| **Modbus 协议栈** | 成熟的 TCP/RTU Server+Client 实现 | 高，AUDESYS 最终需要 Modbus 集成 |
| **插件系统架构** | 统一硬件 I/O 抽象 | 高，与 AUDESYS HAL 设计互补 |
| **扫描周期管理** | clock_nanosleep 高精度定时 | 中，AUDESYS RT 调度可参考 |
| **PLC 状态机** | INIT/STOPPED/RUNNING/ERROR 模型 | 高，标准 IEC 状态模型 |

### 7.3 与 AUDESYS 定位的差异与互补

| 维度 | OpenPLC | AUDESYS |
|------|---------|---------|
| 核心定位 | 开源 PLC 运行时（替代商用 PLC） | 工业控制系统模拟平台 |
| 目标用户 | PLC 程序员、工控工程师、安全研究员 | 控制工程师、系统集成商、开发者 |
| 编程方式 | IEC 61131-3 语言 | 多种语言 + 可视化开发（规划中） |
| 实时性 | SCHED_FIFO 软实时 | 硬实时+仿真双模（规划中） |
| 编译器 | STruC++（IEC 61131-3 -> C++17） | 待定（规划中） |
| 通信 | Modbus/DNP3/ENIP/EtherCAT | JSON-RPC/REST + HAL（规划中） |
| HAL | 轻量插件抽象（read/write 回调） | 完整的通信原语系统（Signal/StreamChannel/RPC） |
| 硬件支持 | 极广（Arduino 到 PC） | 仿真为主 + 物理 HAL 接口（规划中） |
| 安全认证 | 无 | 无（仿真平台不要求 SIL） |

**互补关系**：

- OpenPLC 的 **编译器和运行时** 可作为 AUDESYS 的底层控制执行引擎
- AUDESYS 的 **HAL 设计**（3 信号原语 + amw 抽象 + 14 类型系统）在概念上比 OpenPLC 的 HAL 更丰富，可提供更强大的通信抽象
- 两者的硬件抽象层理念一致，但设计深度不同 — OpenPLC 的 HAL 是简单的函数回调，AUDESYS 的 HAL 是完整的通信中间件
- AUDESYS 可将 OpenPLC 作为 **参考实现** 或 **仿真目标** — 编译 IEC 61131-3 程序后在 AUDESYS Simulator 中运行

### 7.4 详细对比分析：AUDESYS HAL 与 OpenPLC HAL

| 维度 | OpenPLC HAL | AUDESYS HAL（设计） |
|------|------------|-------------------|
| 设计目标 | 统一 I/O 硬件访问接口 | 完整的实时通信中间件 |
| 原语 | updateBuffersIn/Out 回调 | Signal + StreamChannel + RPC |
| 类型系统 | 6 种缓冲数组（bool/int） | 14 种（11 标量 + String + Blob + Array<T>） |
| 线程模型 | 循环扫描（单线程） | 多类型线程（RT/I/O/事件驱动） |
| 发现机制 | 无（静态配置） | HalDiscovery（3 种寻址：anycast/group/unicast） |
| QoS | 无 | HalQoS（deadline/liveliness/security_domain） |
| 序列化 | 直接内存访问 | FlatBuffers（多语言互操作） |
| 多语言 | C/C++ + Python | Rust + C++ + 15 种语言（分层） |
| 实时性 | SCHED_FIFO 扫描 | 分层延迟（< 1us / ~10us / ~100us） |
| 配置管理 | plugins.conf + 硬件层代码框 | Config Barrier + LockLevel |

OpenPLC 的 HAL 是典型的 **I/O 抽象层**（解决"如何从不同硬件读取/写入"），而 AUDESYS 的 HAL 是 **实时通信中间件**（解决"如何在分布式异构节点间可靠、实时地交换数据"）。两者在设计深度和抽象层次上有本质区别，但 OpenPLC HAL 的简洁性（仅 6 个数组 + 2 个函数）提醒 AUDESYS 设计者避免过度工程化。

### 7.5 开源生态系统对比

| 维度 | OpenPLC 生态 | AUDESYS（当前/规划） |
|------|-------------|-------------------|
| 贡献者 | 30+ 活跃贡献者（Editor v4） | 无（早期项目） |
| 学术引用 | 200+ 论文 | 0 |
| 商业支持 | Autonomy Logic + 云服务 | 无 |
| 社区 | 论坛 9,000+ 帖子 | 无 |
| 工业部署 | 数千（估测） | 0 |
| 安全研究 | 大量（ICS 安全标准平台） | 无 |
| 协议集成 | Modbus/DNP3/ENIP/EtherCAT/S7 | JSON-RPC/REST（规划中） |
| 硬件支持 | 20+ 平台 | 仿真为主 |

OpenPLC 提供了 AUDESYS 可借鉴的开源工业控制生态建设路径：以学术研究为起点，通过持续社区贡献扩展功能，在特定领域（如 ICS 安全）建立权威性，然后向更广泛的工业应用渗透。

---

> **本文档基于 2026 年 7 月的公开信息编写。部分数据（如特定版本的详细特性）可能随 OpenPLC 版本迭代而变化。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从官方仓库验证。**