# LinuxCNC

## 1. 产品画像

### 1.1 产品全称与历史沿革

- **产品全称**: LinuxCNC（Linux Computer Numerical Control）
- **曾用名**: EMC（Enhanced Machine Controller，1990s-2003）、EMC2（2003-2011）
- **开发商/组织**: 最初由美国国家标准与技术研究院（NIST）创建，2003 年后由开源社区维护
- **项目归属**: LinuxCNC 组织（https://linuxcnc.org）
- **首次发布年份**: 
  - 1990s：NIST 的 EMC（Enhanced Machine Controller）作为政府项目启动
  - 2003：EMC2 诞生 — 社区驱动的开源分支，HAL 概念提出
  - 2011：正式更名为 LinuxCNC
  - 2022：2.9 系列发布（首个基于 PREEMPT_RT 的版本）
  - 2026-07：最新版本 v2.9.10
- **当前版本**: v2.9.10（2026-07-03），开发分支（master）正在准备 2.10.0
- **仓库地址**: https://github.com/LinuxCNC/linuxcnc

**历史里程碑**：

| 年份 | 事件 |
|------|------|
| 1990s | NIST 创建 EMC（Enhanced Machine Controller）作为运动控制标准测试平台 |
| 1990s | 通用汽车（GM）资助早期版本，使用 PMAC 智能控制板 + Windows NT 实时系统 |
| 1990s | Matt Shaver 发现 EMC 并联系 NIST 的 Fred Proctor，引入 Linux 实时扩展 |
| 2003 | EMC 用户社区首次公开会议，HAL 概念诞生，EMC2 重构启动 |
| 2003 | Paul Corner 的 BDI（Brain Dead Install）CD 使安装简化 |
| 2006 | 首次在 NAMES 展览上展示，社区快速增长 |
| 2011 | 项目正式更名为 LinuxCNC |
| 2014 | Machinekit 分支从 LinuxCNC 分离 |
| 2022 | LinuxCNC 2.9 发布，支持 PREEMPT_RT，Mesa 卡增强 |
| 2026 | v2.9.10 发布，持续维护中 |

### 1.2 产品定位与核心价值主张

LinuxCNC 定位为 **开源、实时、全功能的计算机数控（CNC）系统**，其核心价值主张是：

1. **将通用计算机变为高性能 CNC 控制器** — 无需昂贵的专用运动控制硬件
2. **完全开源透明** — 基于 GPL 许可，所有源代码公开
3. **硬件无关性** — 通过 HAL 抽象层支持多种硬件接口（并口、Mesa 卡、EtherCAT 等）
4. **极致的灵活性和可定制性** — 从简单的 3 轴铣床到 6 轴并联机械臂，均可配置

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| 机床改造商 | 旧 CNC 机床控制系统升级 | 替代老旧/停产的控制系统、成本效益 |
| DIY/创客 | 自制 CNC 雕刻机、3D 打印机 | 低成本、社区支持、灵活配置 |
| 小型制造企业 | 铣床、车床、等离子切割 | 高性能、无许可证费用 |
| 机器人研究者 | SCARA 机器人、六足机器人 | 可定制的运动学模块、开源 |
| 教育机构 | 数控技术教学、自动化课程 | 开源可学习、低成本 |
| 系统集成商 | 专用自动化设备（激光、水刀、磨床） | 灵活的可编程能力、广泛硬件支持 |

### 1.4 开源许可

- **许可证**: GNU General Public License v2（GPL-2.0），部分代码源自 NIST 的公共领域（Public Domain）作品
- **商业模型**: 完全开源，无商业版本
- **OEM 考虑**: 由于其 GPL 许可和硬件特定性，LinuxCNC 通常不用于大批量商业产品，但非常适用于定制化机床改造

---

## 2. 技术特性

### 2.1 核心架构

LinuxCNC 的软件架构由四个核心控制层组成：

```
+------------------------------------------------------------------+
|                          GUI 层                                    |
|  Axis (Tcl/Tk) | Gmoccapy (GTK) | QtVCP | Touchy | halui        |
+------------------------------------------------------------------+
|                        TASK 控制器                                 |
|  EMCTASK - 任务协调器、G代码解释器（RS274NGC）                     |
|  接收 NML 消息，协调 Motion 和 IO 控制器                           |
+------------------------------------------------------------------+
|  +---------------------------+  +-------------------------------+ |
|  |    Motion 控制器 (EMCMOT)  |  |  IO 控制器 (EMCIO)           | |
|  |    实时运动控制            |  |  离散 I/O 控制                | |
|  |    轨迹规划、PID、运动学   |  |  主轴、冷却液、辅助功能      | |
|  |    RT 线程（SCHED_FIFO）   |  |  用户空间（非实时）          | |
|  +-------------+-------------+  +---------------+--------------+ |
|                |                                |                |
+----------------+--------------------------------+----------------+
|                v                                v                 |
|  +----------------------------------------------------------------+
|  |               HAL 硬件抽象层                                    |
|  |  Pins + Signals + Components + Functions + Threads              |
|  |  共享内存通信，实时数据交换                                     |
|  +----------------------------------------------------------------+
|                |                                |
|  +-------------+-------------+  +---------------+--------------+ |
|  |   硬件驱动层              |  |  外部接口                    | |
|  |   parport | Mesa |        |  |   Modbus | EtherCAT |        | |
|  |   servotogo | Pico Sys   |  |   ClassicLadder |           | |
|  +---------------------------+  +-------------------------------+ |
+------------------------------------------------------------------+
```

#### 四大核心组件

| 组件 | 名称 | 实时性 | 职责 |
|------|------|--------|------|
| **EMCTASK** | Task Controller | 非实时 | G代码解析器（RS274NGC）、协调 Motion 和 IO |
| **EMCMOT** | Motion Controller | 实时 | 轨迹规划、PID 闭环、运动学计算 |
| **EMCIO** | I/O Controller | 非实时 | 主轴、冷却液、换刀、辅助 I/O 控制 |
| **GUI** | 用户界面 | 非实时 | 多种 GUI 可选（Axis、Gmoccapy、QtVCP 等） |

#### 通信机制

- **NML（Neutral Message Language）**: 非实时部分（GUI、TASK、IO）之间的消息传递，使用共享内存 IPC
- **HAL（Hardware Abstraction Layer）**: 实时部分（Motion）与硬件驱动之间的数据交换，通过共享内存完成
- **HAL 信号（Signal）**: 连接 HAL 组件的引脚（Pin），传递实时数据

### 2.2 HAL 内部架构详解

HAL 库的核心实现在 `src/hal/hal.h` 和 `src/hal/hal_lib.c` 中。其关键数据结构包括：

```
// HAL 引脚数据结构（伪代码）
typedef struct {
    hal_type_t type;          // 数据类型（BIT/FLOAT/S32/U32）
    hal_pin_dir_t dir;        // 方向（IN/OUT/IO）
    void *d_ptr;              // 指向信号数据的指针
    char name[HAL_NAME_LEN];
    struct hal_pin_t *next;   // 链表指针
} hal_pin_t;

// HAL 信号数据结构
typedef struct {
    hal_type_t type;
    void *data;               // 实际数据存储
    int readers;              // 读取者计数
    char name[HAL_NAME_LEN];
} hal_signal_t;
```

**RTAPI/ULAPI 双模式编译**:

HAL 库通过条件编译支持两种模式：

- **RTAPI 模式**（`#define RTAPI`）：编译为实时库，用于加载到实时内核空间或链接到实时进程
- **ULAPI 模式**（`#define ULAPI`）：编译为用户空间库，用于非实时程序（GUI、halcmd 等）

两种模式共享同一份 `hal_lib.c` 源代码，但使用不同的内存分配策略和互斥机制。所有变量列表和连接信息存储在一块共享内存中，用互斥量保护，使实时组件和非实时程序都能安全访问。

**共享内存布局**:

```
+---------------------------------------------------+
|  HAL 共享内存区 (SHM)                             |
|                                                   |
|  +-----------+  +----------+  +---------+         |
|  | Pin Table |  | Signal   |  | Function|         |
|  | (链表)    |  | Table    |  | Table   |         |
|  +-----------+  +----------+  +---------+         |
|                                                   |
|  +-----------+  +----------+  +---------+         |
|  | Component |  | Thread   |  | Param   |         |
|  | Table     |  | Table    |  | Table   |         |
|  +-----------+  +----------+  +---------+         |
|                                                   |
|  Mutex: 保护所有表的并发访问                      |
+---------------------------------------------------+
```

HAL 对象通过名称查询，支持以下操作：

- `hal_init()`: 初始化 HAL 库，分配共享内存
- `hal_pin_new()`: 创建新引脚
- `hal_signal_new()`: 创建新信号
- `hal_link()`: 将引脚连接到信号
- `hal_export_funct()`: 导出函数到线程
- `hal_ready()`: 标记组件初始化完成
- `hal_malloc()`: 在实时内存中分配空间

### 2.3 关键技术能力

#### 实时运动控制

LinuxCNC 的核心是实时运动控制，支持以下关键能力：

- **轨迹规划（Trajectory Planning）**: 带有前瞻（look-ahead）的实时运动规划系统
- **PID 闭环控制**: 软件 PID 伺服环，在计算机内完成反馈闭环
- **多轴联动**: 支持 3-9 轴同步运动
- **刀具半径/长度补偿**: 支持 cutter radius 和 length compensation
- **路径偏差限制**: 可指定公差范围内的路径偏差
- **车螺纹**: 同步主轴编码器的车螺纹功能
- **自适应进给率**: Adaptive Feedrate 和 operator feed override
- **恒速控制**: Constant Velocity 模式

#### G代码解释器

- **标准**: RS274NGC（基于 NIST 标准）
- 支持 G0-G99 的各功能码和 M0-M99 的辅助功能码
- 自定义 M 代码：通过 Python 或 HAL 脚本扩展
- **重映射（Remap）**: 高级功能，自定义 G/M 代码的行为

#### 运动学系统

LinuxCNC 独特的运动学架构支持多种机器拓扑：

| 拓扑类型 | 运动学模块 | 描述 |
|---------|-----------|------|
| 直角坐标 | trivkins | 简单 3 轴（XYZ），默认运动学 |
| CoreXY | corexykins | CoreXY 机构 |
| 六足并联 | genhexkins | Stewart Platform（六自由度并联平台） |
| 通用串联 | genserkins | 通用串联机器人运动学 |
| SCARA | scarakins | SCARA 型机器人 |
| PUMA | pumakins | PUMA 型工业机器人 |
| 五轴铣床 | xyzac-trt-kins, xyzbc-trt-kins | 工作台旋转/倾斜式五轴 |
| 五轴桥式 | 5axiskins | 五轴桥式铣床 |
| 三角并联 | lineardeltakins | 线性 Delta 并联机构 |
| 旋转 Delta | rotarydeltakins | 旋转 Delta 并联机构 |
| 五杆并联 | pentakins | Pentapod 并联机构 |
| 玫瑰引擎 | rosekins | 玫瑰纹车床 |
| 三角形 | tripodkins | 三脚并联机构 |
| 旋转 | rotatekins | 旋转轴运动学 |

**运动学模块接口**:

每个运动学模块必须实现以下函数：

```
int kinematicsInverse(const EmcPose *world, double *joints,
                      const KINEMATICS_INVERSE_FLAGS *iflags,
                      KINEMATICS_FORWARD_FLAGS *fflags);
int kinematicsForward(const double *joints, EmcPose *pose,
                      const KINEMATICS_FORWARD_FLAGS *fflags,
                      KINEMATICS_INVERSE_FLAGS *iflags);
KINEMATICS_TYPE kinematicsType(void);
```

- **逆运动学**（Inverse Kinematics）: 给定世界坐标（Cartesian），计算各关节值
- **正运动学**（Forward Kinematics）: 给定各关节值，计算世界坐标位置
- **可切换运动学**（Switchable Kinematics）: 通过 `switchkins` 模块，支持在运行时切换最多 3 种运动学模式

### 2.4 支持的硬件/平台

#### 实时平台

| 实时方案 | 状态 | 说明 |
|---------|------|------|
| PREEMPT_RT（内核抢占） | 主力（v2.9+） | 标准 Linux 主线内核的实时补丁 |
| RTAI（实时应用接口） | 传统支持 | 早期版本的主力实时方案 |
| Xenomai（双内核） | 有限支持 | 部分配置支持，非主要方向 |

#### 硬件接口

| 硬件类型 | 支持的驱动 | 说明 |
|---------|-----------|------|
| 并行口（LPT） | hal_parport | 最基础的接口，直连步进驱动 |
| Mesa 电子卡 | 多种（7i96, 7i97, 7i76, 5i20 等） | 当前最主流的硬件接口，FPGA 实现 |
| Servo-To-Go | hal_stg | 经典伺服接口卡 |
| Pico Systems | hal_ppmc | PPMC、USC、UPC 系列 |
| Axiom AX5241H | hal_ax5214h | 数字 I/O 板 |
| Vigilant Technologies | hal_vti | PCI ENCDAC-4 控制器 |
| MOTENC-100 | hal_motenc | Vital Systems 运动控制卡 |
| Modbus | Modbus HAL 组件 | 通过 Modbus RTU/TCP 连接外部 I/O |
| EtherCAT | 有限支持 | 通过第三方工具（如 SOEM 库）集成 |

#### 支持的操作系统

- **推荐**: Debian（Buster/Bullseye/Bookworm/Trixie）、Ubuntu（LTS 版本）
- **官方打包**: Debian 官方仓库中已包含 linuxcnc-uspace 包
- **架构**: x86（主要）、ARM（Raspberry Pi 等，社区支持）

### 2.5 编程语言与开发工具链

| 层次 | 语言 | 用途 |
|------|------|------|
| 控制逻辑 | G代码（RS274NGC） | 加工路径和操作指令 |
| HAL 配置 | HAL 语言（.hal 文件） | 组件连接、实时配置 |
| 系统配置 | INI 文件 | 系统参数、轴配置 |
| 核心代码 | C | 运动控制、HAL 库、驱动 |
| 自定义组件 | C, Python | HAL 组件开发 |
| 用户界面 | Tcl/Tk, Python/GTK, C++/Qt | 多种 GUI 支持 |
| 运动学 | C | 自定义运动学模块 |

**开发工具**:

- `halcompile`: 编译和安装 HAL 组件
- `halcmd`: 命令行 HAL 配置工具
- `halrmt`: 远程 HAL 访问
- `classicladder`: PLC 功能（基于 HAL）
- `halui`: 外部旋钮/按钮的 HAL 界面

---

## 3. 功能概览

### 3.1 主要功能模块

#### HAL 组件体系

HAL 是整个 LinuxCNC 的基石，其核心概念包括：

| 概念 | 描述 | 类比 |
|------|------|------|
| Component（组件） | 具有定义好的输入、输出和行为的软件模块 | 集成电路芯片 |
| Pin（引脚） | 组件的输入/输出端口，携带数据 | 芯片引脚 |
| Signal（信号） | 连接一个输出引脚到多个输入引脚的数据通路 | 导线 |
| Parameter（参数） | 运行时可调参数 | 电位器 |
| Function（函数） | 组件中可被线程调用的代码块 | 芯片功能 |
| Thread（线程） | 按特定间隔顺序执行一系列函数的实时任务 | 时钟信号 |

HAL 支持的数据类型：

| 类型 | C 类型 | 描述 |
|------|--------|------|
| HAL_BIT | bool | 布尔值（开/关） |
| HAL_FLOAT | double | 浮点数 |
| HAL_S32 | int32_t | 32 位有符号整数 |
| HAL_U32 | uint32_t | 32 位无符号整数 |
| hal_port | byte stream | 字节流端口（较新） |
| hal_stream | 共享内存 | 复杂数据结构（较少使用） |

#### 标准 HAL 组件

LinuxCNC 包含超过 150 个内置 HAL 组件，涵盖以下类别：

| 类别 | 示例组件 | 用途 |
|------|---------|------|
| 运动控制 | stepgen, pwmgen, encoder, pid | 步进/伺服控制 |
| 信号处理 | lowpass, limit2, deadzone, scale | 信号滤波和转换 |
| 逻辑运算 | and2, or2, not, xor, mux, flipflop | 数字逻辑 |
| 数学运算 | abs, sum, mult, integ, deriv | 数学计算 |
| 计数器 | counter, freqgen, timedelay | 计数和定时 |
| 硬件驱动 | hal_parport, mesa_*, hal_stg | 物理硬件接口 |
| 通信 | modbus, can | 工业总线 |
| PLC | classicladder_rt | 梯形图 PLC |
| 用户界面 | halui, pyvcp | 人机交互 |
| 工具 | halmeter, halscope, halshow | 测量和调试 |

#### 线程调度模型

LinuxCNC 的实时线程是其核心设计之一：

| 线程 | 典型周期 | 用途 | 优先级 |
|------|---------|------|--------|
| **base-thread** | 25-50us（典型） | 高频硬件操作：步进脉冲生成、编码器读取 | 最高 |
| **servo-thread** | 500-1000us（典型） | 伺服控制：PID 计算、轨迹规划、运动学 | 中 |
| 用户空间 | 非实时 | 用户界面、I/O 控制、文件操作 | 普通 |

**base-thread 和 servo-thread 的关系**：

```
base-thread (25-50us):
  - 步进电机脉冲生成（StepGen 的 function）
  - 并行口输出（parport 的 write 函数）
  - 编码器输入读取

servo-thread (500-1000us):
  - motion-command-handler（NML 命令处理）
  - 轨迹规划（TP 计算）
  - PID 伺服环
  - 运动学正/逆解算
  - IO 控制信号
```

### 3.2 关键工作流/使用场景

#### 工作流：机床配置与启动

1. 创建 INI 配置文件（定义轴数、速度、加速度、运动学）
2. 编写 HAL 配置文件（加载组件、连接信号、设置线程）
3. 启动 LinuxCNC（`linuxcnc <config.ini>`）
4. HAL 脚本执行，加载实时模块，创建线程
5. 启动 GUI，进入操作模式
6. 归零（Homing）—— 各轴回机械原点
7. 加载 G 代码文件，开始加工

#### 工作流：HAL 信号连接（示例）

```
# 加载步进电机驱动
loadrt stepgen step_type=0,0,0

# 创建线程
loadrt threads name1=base-thread period1=50000 name2=servo-thread period2=1000000

# 添加函数到线程
addf stepgen.0.make-pulses base-thread
addf stepgen.0.update-freq servo-thread

# 连接信号
net X-pos-cmd  motion.0.pos-cmd.0  => stepgen.0.position-cmd
net X-step      stepgen.0.step       => parport.0.pin-02-out
net X-dir       stepgen.0.dir        => parport.0.pin-03-out
```

#### 工作流：刀具更换（Tool Changer）

LinuxCNC 支持两种换刀模式：

- **非随机（Nonrandom）**: 每个刀具回到其"家庭口袋"（home pocket）
- **随机（Random）**: 刀具可以放在任意口袋

换刀流程通过 HAL 引脚控制：

```
Txxx 命令 -> tool-prep-pocket/pin 设置 -> tool-prepared 等待
M6 命令 -> tool-change 设置 -> tool-changed 等待 -> 加载完成
```

### 3.3 扩展机制

#### 1. 自定义 HAL 组件

通过 `halcompile` 工具，可以用 C 语言创建自定义 HAL 组件。

#### 2. 自定义运动学

通过 `userkins.comp` 模板或 `src/emc/kinematics/userkfuncs.c` 模板创建自定义运动学：

```
int kinematicsForward(const double *joints, EmcPose *pos,
                      const KINEMATICS_FORWARD_FLAGS *fflags,
                      KINEMATICS_INVERSE_FLAGS *iflags) {
    // 自定义正运动学计算
    return 0;
}
```

#### 3. G/M 代码重映射（Remap）

通过 Python 脚本或自定义 C 代码重映射标准 G/M 代码的行为。

#### 4. 自定义 GUI

LinuxCNC 支持多种 GUI 开发框架：Axis（Tcl/Tk）、Gmoccapy（GTK+Python）、QtVCP（Qt）、Touchy（触摸屏）、halui（外部硬件）。

### 3.4 HAL 工具与调试

LinuxCNC HAL 提供了一组强大的诊断和调试工具，在 CNC 控制领域独树一帜：

#### halcmd（命令行工具）

`halcmd` 是 HAL 的命令行配置和诊断工具，支持以下命令：

| 命令 | 用途 | 示例 |
|------|------|------|
| `show` | 显示 HAL 对象 | `halcmd show pin` 列出所有引脚 |
| `set` | 设置引脚或参数的值 | `halcmd set stepgen.0.position-cmd 10.0` |
| `get` | 读取值 | `halcmd get pid.0.output` |
| `link` | 连接引脚到信号 | `halcmd link X-pos-cmd signal` |
| `loadrt` | 加载实时模块 | `halcmd loadrt stepgen` |
| `loadusr` | 加载用户空间程序 | `halcmd loadusr halui` |
| `addf` | 添加函数到线程 | `halcmd addf stepgen.0.update-freq servo-thread` |
| `unload` | 卸载模块 | `halcmd unload hal_parport` |
| `source` | 执行 HAL 脚本 | `halcmd source stepper.hal` |

#### halmeter（万用表）

类似于电子万用表，实时显示任何 HAL 信号或引脚的值。支持 BIT、FLOAT、S32、U32 四种数据类型，可以同时打开多个实例。

#### halscope（示波器）

类似于数字存储示波器，用于观察信号随时间的变化：

- 最多可同时显示 16 个通道
- 可配置采样率（基于线程周期）
- 支持触发（上升沿、下降沿、电平）
- 支持缩放、测量光标
- 可将波形导出为数据文件
- 对于调试 PID 环路、机械振动等极其有用

#### halshow（浏览器）

树形浏览器，显示所有 HAL 对象（组件、引脚、信号、参数、线程）的完整层次结构。

### 3.5 G 代码语言支持详情

#### G 代码（准备功能）

| 代码 | 功能 | 代码 | 功能 |
|------|------|------|------|
| G0 | 快速定位 | G1 | 直线插补 |
| G2/G3 | 圆弧插补（顺/逆） | G4 | 暂停（Dwell） |
| G10 | 坐标系数据设置 | G17/G18/G19 | 平面选择（XY/ZX/YZ） |
| G20/G21 | 英制/公制切换 | G28 | 回参考点 |
| G30 | 回第二参考点 | G33 | 螺纹切削 |
| G40 | 取消刀具半径补偿 | G41/G42 | 刀具半径补偿（左/右） |
| G43/G49 | 刀具长度补偿/取消 | G50/G51 | 缩放比例 |
| G53 | 机床坐标系运动 | G54-G59.3 | 工件坐标系（1-9 个） |
| G61 | 精确路径模式 | G64 | 连续路径模式 |
| G73 | 啄式钻孔（高速深孔钻） | G80 | 取消固定循环 |
| G81-G89 | 钻孔固定循环 | G90/G91 | 绝对/增量坐标 |
| G92 | 坐标系偏移 | G98/G99 | 返回平面 |

#### M 代码（辅助功能）

| 代码 | 功能 | 代码 | 功能 |
|------|------|------|------|
| M0/M1 | 程序暂停/条件暂停 | M2/M30 | 程序结束 |
| M3/M4/M5 | 主轴正转/反转/停止 | M6 | 刀具更换 |
| M7/M8/M9 | 冷却液（雾状/液状/关） | M50 | 进给倍率切换 |
| M61 | 设置当前刀具号 | M62-M65 | 数字输出控制 |
| M66 | 等待输入 | M67 | 模拟输出 |
| M68 | 模拟输出（标准化） | M100-M199 | 用户定义 M 代码 |

#### 高级语言特性

- **参数化编程**：支持 #1-#5999 参数变量
- **数学运算**：三角函数、对数、平方根等
- **条件分支**：IF/ELSE/ENDIF
- **循环**：WHILE/DO/ENDWHILE
- **子程序**：O 代码子程序调用
- **宏调用**：通过自定义 M 代码或 remap 扩展

### 3.6 归零（Homing）序列

LinuxCNC 支持灵活的归零序列配置，是 CNC 控制器的关键功能：

| 归零参数 | 描述 |
|---------|------|
| HOME_SEQUENCE | 顺序归零（0=不参与，1=后排，2=后排） |
| HOME_IS_SHARED | 多轴共享限位开关 |
| HOME_USE_INDEX | 使用编码器索引脉冲精确定位 |
| HOME_IGNORE_LIMITS | 归零时忽略限位 |
| HOME_SEARCH_VEL | 搜索速度（朝限位运动） |
| HOME_LATCH_VEL | 锁存速度（离开限位找索引） |
| HOME_FINAL_VEL | 最终归零速度 |
| HOME_OFFSET | 归零后的坐标偏移 |

归零步骤：
1. 以 HOME_SEARCH_VEL 朝限位开关方向移动
2. 触发限位后停止
3. 以 HOME_LATCH_VEL 反方向移动
4. 检测编码器索引脉冲（如配置）
5. 移动到最终位置（HOME_OFFSET）
6. 设置坐标值

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| GitHub Stars | ~2,000 |
| 最新稳定版 | v2.9.10（2026-07-03） |
| 开发分支 | master（准备 2.10.0-pre0） |
| 主要开发语言 | C（核心）、Python、Tcl/Tk、C++（Qt） |
| 贡献者 | 数十名活跃开发者 |
| 发布频率 | 2-3 次/年（bugfix 版本） |
| 首批发布 | 2.9.0（2022-11），2.9.10（2026-07） |
| 已有版本 | 2.9.0 到 2.9.10 共 10 个版本 |
| 官方仓库 | https://github.com/LinuxCNC/linuxcnc |
| 官方文档 | http://linuxcnc.org/docs/ |

### 4.2 社区规模/用户基数

- **论坛**: http://forum.linuxcnc.org — 非常活跃的社区支持
- **邮件列表**: emc-users@lists.sourceforge.net — 开发者讨论
- **用户群**: 全球数万用户，从家庭作坊到专业机械加工车间
- **应用案例**: 铣床、车床、3D 打印机、激光切割机、等离子切割机、水刀、六足机器人、SCARA 机器人
- **文档**: 极其详尽的官方文档（HTML 格式，数百页），通过 Weblate 众包翻译

### 4.3 生态系统

#### Machinekit 分支

Machinekit 是 LinuxCNC 的重要分支，2014 年因开发理念分歧而分离：

| 维度 | LinuxCNC | Machinekit |
|------|---------|------------|
| 当前状态 | 活跃开发中 | 分支活跃度较低 |
| 架构 | 单一大仓库 | 分为 Machinekit-HAL + Machinekit-CNC |
| 多核支持 | 有限 | 较强（hal_create_xthread 支持 CPU 绑定） |
| 实时方案 | RTAI + PREEMPT_RT | Xenomai + PREEMPT_RT |
| 远程 HAL | 有限 | 原生支持远程 HAL 访问 |
| 硬件平台 | x86 为主 | 更广泛（BeagleBone Black 等） |
| 社区活跃度 | 高（论坛活跃、定期发布） | 低（原开发者离开，更新缓慢） |
| 文档 | 详细、持续更新 | 较少更新 |

#### 相关生态项目

| 项目 | 说明 |
|------|------|
| Machinekit-HAL | 从 LinuxCNC 分离的 HAL 层（~123 stars） |
| Machinekit-CNC | 从 LinuxCNC 分离的 CNC 层（~68 stars） |
| QtQuickVcp | Machinekit 的 QML 远程控制面板 |
| Mesa 7i96 等 | 主流 FPGA 步进/伺服控制卡 |
| Remora | Raspberry Pi 上的 LinuxCNC 实现 |
| PNCconf | 配置向导工具 |
| StepConf | 步进电机配置向导 |

### 4.4 版本 2.9 系列主要变更

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| 2.9.0 | 2022-11 | 首个 2.9 正式版，PREEMPT_RT 为主力实时方案 |
| 2.9.1 | 2023-10 | Mesa 7I97T、7I76EU 卡支持 |
| 2.9.2 | 2023-12 | PWMGen dither 选项，bugfix |
| 2.9.3 | 2024-03 | Gmoccapy 修复，GTK3 兼容 |
| 2.9.4 | 2025-03 | 多项 bugfix 和驱动更新 |
| 2.9.7 | 2025-10 | bugfix 和安全更新 |
| 2.9.8 | 2026-01 | bugfix |
| 2.9.9 | 2026-06 | bugfix |
| 2.9.10 | 2026-07 | 安全补丁 + bugfix |
| master(2.10) | 开发中 | 新功能分支开放 |

2.9 系列的几项关键改进：

1. **Joint/Axis 分离（JA 分支集成）**: 关节和轴的解耦，支持更灵活的运动学配置
2. **PREEMPT_RT 成为主力实时方案**: 不再依赖 RTAI 非主线内核
3. **Mesa 卡支持大幅扩展**: 7i96D、7I97T、7I76EU 等多种新板卡
4. **Wayland 支持**: GTK 和 Qt 后端的 OpenGL Wayland 变通方案
5. **IPv6 支持**: 初步的网络协议 IPv6 支持
6. **Debian 官方打包**: LinuxCNC 进入 Debian 官方仓库

### 4.5 主要贡献者

| 贡献者 | 主要贡献领域 |
|--------|-------------|
| Andy Pugh | 核心维护者、2.9 系列发布管理、Mesa 驱动 |
| CMorley | GUI 开发（Gmoccapy、QtVCP） |
| Steffen Moeller | Debian 打包、文档国际化 |
| Hans Unzner | QtVCP、文档 |
| Bertho Stultiens | HAL 组件 |
| Sebastian Kuzminsky | 核心开发者（历史） |
| Jeff Epler | 核心开发者、Axis GUI（历史） |
| Chris Radek | 核心维护者（历史） |

---

## 5. 市场定位

### 5.1 主要应用行业与场景

| 行业 | 典型应用 | 精度要求 |
|------|---------|---------|
| 金属加工 | CNC 铣床、车床改造 | 0.001-0.01mm |
| 木工 | CNC 雕刻机、切割机 | 0.1-1mm |
| 广告制作 | 大型 CNC 等离子切割机 | 0.5-2mm |
| 3D 打印 | FDM/SLA 打印机 | 0.05-0.2mm |
| 激光加工 | 激光切割、雕刻 | 0.1-1mm |
| 水刀切割 | 高压水刀切割系统 | 0.1-0.5mm |
| 机器人 | SCARA 机器人、六足平台 | 0.1-1mm |
| 教育 | 数控教学、机器人竞赛 | 教学级精度 |
| 科研 | 定制化实验设备 | 取决于应用 |
| 特种加工 | 磨床、玻璃加工、石材切割 | 取决于应用 |

### 5.2 竞争对手对比

| 维度 | LinuxCNC | Mach3/Mach4 | GRBL | 商用 CNC（Fanuc/Siemens/Heidenhain） |
|------|---------|-----------|------|-------------------------------------|
| 开源 | 完全开源（GPL-2.0） | 商业 | 开源（GPL-3.0） | 商业闭源 |
| 许可证费用 | 零 | $200-600 | 零 | $5,000-50,000+ |
| 实时性 | 硬实时（PREEMPT_RT） | 软实时（Windows） | 硬实时（MCU） | 硬实时（专用硬件） |
| 轴数 | 3-9 轴 | 3-6 轴 | 3-6 轴 | 3-12+ 轴 |
| 运动学 | 极丰富（15+ 模块，可自定义） | 有限 | 无 | 厂商特定 |
| 前瞻 | 有 | 有 | 有 | 有 |
| 5 轴联动 | 支持 | 支持 | 有限 | 支持 |
| 硬件接口 | 极广（并口/Mesa/STG 等） | 有限 | 极广（MCU GPIO） | 厂商专用 |
| 社区 | 活跃开源社区 | 商业支持 | 极活跃 Maker 社区 | 厂商技术支持 |
| 文档 | 极详细 | 中等 | 中等 | 专业培训 |
| 可靠性 | 取决于配置 | 中等 | 高 | 极高 |
| 典型成本 | $0-500（硬件+PC） | $200-2,000 | $50-500 | $10,000-200,000+ |

### 5.3 与商用 CNC 的深入对比

| 维度 | LinuxCNC（优势） | 商用 CNC（优势） |
|------|----------------|----------------|
| 成本 | 极低（零许可证+通用硬件） | 高（但含完整服务和支持） |
| 灵活性 | 极高（可定制每层） | 低（封闭系统） |
| 功能更新 | 社区驱动，速度中 | 厂商驱动，速度慢 |
| 调试工具 | 极强（halmeter/halscope） | 有限 |
| 非标准几何 | 极强（自定义运动学） | 弱（标准 3-5 轴） |
| 多轴 | 3-9 轴 | 3-12+ 轴 |
| 刀具管理 | 较弱（工具表功能有限） | 完整（tool life management 等） |
| 高速加工 | 较弱（轨迹规划器限制） | 强（NURBS、样条插补等） |
| 5 轴联动 | 可用，但精度取决于配置 | 强（点云RTCP 等） |
| 可靠性 | 取决于配置质量 | 高（企业级 QA） |
| 技术支持 | 社区论坛 | 电话/现场服务 |
| 安全认证 | 无 | CE/UL/SIL 认证 |
| 文档 | 极详细，但庞大 | 专业培训 |

### 5.4 典型用户画像

#### 机床改造者（40%+）

- 一台旧 CNC 机床（Fadal、Bridgeport、Matsuura）控制系统故障
- 原厂控制系统已停产或维修费极高
- 通过 LinuxCNC + Mesa 卡替换原控制系统
- 成本 1,000-3,000 美元，远低于更换新机床（>50,000 美元）

#### 自制机床制造者（25%+）

- 自行设计和制造专用机床
- 典型项目：激光切割机、等离子切割机、3D 打印机
- 利用 LinuxCNC 的灵活性实现商用控制器无法提供的功能

#### 机器人/特种机械开发者（15%）

- SCARA 机器人、六足机器人、Delta 并联机构
- 需要自定义运动学模块
- 典型场景：科研实验室、大学机器人课程

#### 教育/培训用户（10%）

- 职业学校的数控技术课程
- 大学机械工程实验
- 利用 LinuxCNC 的开源特性深入理解 CNC 原理

#### 小型生产企业（10%）

- 直接使用 LinuxCNC 进行生产
- 一般多台机床、批量生产
- 要求高可靠性（需要专业系统集成商部署）

---

## 6. 产品特色

### 6.1 HAL 硬件抽象层的设计哲学

LinuxCNC 的 HAL 设计哲学可概括为 **"硬件设计方法进入软件世界"**：

1. **电路类比**：将软件系统视为电子电路，组件 = 芯片，引脚 = 物理引脚，信号 = 导线
2. **可组合性**：超过 150 个标准组件可以像搭积木一样组合
3. **可替换性**：驱动组件可以互换而不影响上层逻辑
4. **可观测性**：通过 halmeter、halscope 等工具实时观测任何信号
5. **运行时可配置**：信号连接可以在机器运行时重新连接

HAL 的核心设计原则：

- **引脚（Pin）是指针，不是数据值** — 当引脚连接到信号时，指针指向信号的数据空间，实现零拷贝
- **未连接的引脚指向虚拟位置** — 组件无需处理 NULL 指针
- **函数（Function）是执行单元** — 组件代码以函数形式暴露，由线程调度
- **线程（Thread）是执行容器** — 周期执行的函数列表

### 6.2 实时性能特点

LinuxCNC 的实时性能是其核心优势：

- **base-thread 周期**: 25-50us（典型），可达到 10-20us（高性能硬件）
- **servo-thread 周期**: 500-1000us（典型）
- **延迟抖动**: +/- 5-15us（PREEMPT_RT，优化硬件）
- **位置精度**: 可达 0.001mm（取决于编码器和机械系统）
- **最大脉冲频率**: 超过 1MHz（通过硬件计数器或 FPGA）

实时性能的关键因素：

1. **实时内核选择**: PREEMPT_RT（2.9 主力）vs RTAI（传统）
2. **硬件选择**: Intel i5/i7 或 AMD 处理器，避免 GPU 和复杂电源管理
3. **BIOS 设置**: 禁用 C-States、SpeedStep、Turbo Boost
4. **隔离核心**: 使用 `isolcpus` 内核参数隔离一个核心给实时线程

### 6.3 成功的应用案例

- **机床改造**：最广泛的应用场景，用 LinuxCNC 替换老旧或损坏的 CNC 控制器
- **Fadal 改造**：社区中有大量 Fadal VMC 改造案例，恢复高性能
- **五轴铣床**：通过 xyzac-trt-kins 或 xyzbc-trt-kins 实现五轴联动
- **SCARA 机器人**：scarakins 模块使 LinuxCNC 可控制 SCARA 型机器人
- **Stewart 平台**：genhexkins 模块用于六自由度并联平台
- **3D 打印**：社区中已有将 LinuxCNC 用作 3D 打印机控制器的案例
- **激光切割**：通过 PWM 控制激光功率，LinuxCNC 的轨迹规划适合激光加工
- **等离子切割**：THC（Torch Height Control）通过 HAL 组件实现

### 6.4 社区文化与治理

LinuxCNC 的治理结构影响了其技术方向和稳定性：

**治理模式**:

- **BDFL 风格**: 核心维护者对代码合并有最终决定权
- **保守合并策略**: 新特性需要充分讨论和测试后才合并到 master
- **长稳定期**: 2.7 版本维护了 5+ 年，2.8 维护了 3+ 年，2.9 正处于活跃维护期
- **明确的发布流程**: 从 pre-release 到候选版到正式版的渐进发布

**社区沟通渠道**:

- emc-users 邮件列表（最活跃的技术讨论渠道）
- GitHub Issues（bug 跟踪和功能请求）
- 论坛（用户支持和配置讨论）
- Weblate（多语言文档众包翻译）
- IRC/Matrix（实时开发者讨论）

**与上游 Linux 生态的集成**:

- 2.9 系列开始使用 Debian 基础设施打包发布
- 文档使用 Weblate 进行众包翻译
- 从 RTAI 迁移到 PREEMPT_RT 使 LinuxCNC 与主线 Linux 内核保持一致

### 6.5 典型配置示例

#### 3 轴步进电机铣床（入门级）

```
硬件: PC + 并行口 + 3 个步进驱动器 + 限位开关
实时: PREEMPT_RT
运动学: trivkins（直角坐标）
线程: base-thread 50us + servo-thread 1ms
GUI: Axis 或 Gmoccapy
INI 配置: 3 轴（X, Y, Z），步进电机模式
```

#### 5 轴伺服铣床（高级）

```
硬件: PC + Mesa 7i96 + 5 个伺服驱动器 + 编码器
实时: PREEMPT_RT
运动学: xyzac-trt-kins（工作台旋转/倾斜）
线程: base-thread 25us + servo-thread 500us
GUI: QtVCP
INI 配置: 5 轴（X, Y, Z, A, C），PID 伺服闭环
```

#### 6 轴 Stewart 平台（科研）

```
硬件: PC + Mesa 5i20 + 6 个伺服驱动器
实时: PREEMPT_RT
运动学: genhexkins（六足并联）
线程: base-thread 50us + servo-thread 1ms
GUI: Axis + halui
INI 配置: 6 关节，Stewart 平台参数
```

#### SCARA 机器人（教育/轻工）

```
硬件: PC + Mesa 7i96 + 4 个伺服驱动器
实时: PREEMPT_RT
运动学: scarakins（SCARA 机器人）
线程: base-thread 50us + servo-thread 1ms
GUI: Axis（Vismach SCARA 界面）
INI 配置: 6 关节（SCARA 参数 D1-D6）
```

---

## 7. 对 AUDESYS 的参考价值

### 7.1 LinuxCNC HAL 与 AUDESYS HAL 的架构对比

| 维度 | LinuxCNC HAL | AUDESYS HAL（设计） |
|------|------------|-------------------|
| 设计目标 | 实时运动控制的硬件抽象 | 分布式实时通信中间件 |
| 通信模型 | 共享内存指针（Pin -> Signal） | 三原语（Signal/StreamChannel/RPC） |
| 数据流 | 单向信号传递（一个输出->多个输入） | 单向+双向+流式三种模式 |
| 类型系统 | 4 种基本类型 + 2 种扩展 | 14 种类型（11 标量 + String + Blob + Array<T>） |
| 线程模型 | base-thread（50us）+ servo-thread（1ms）两级 | 多类型（RT/I/O/事件驱动） |
| 组件模型 | 基于共享库的实时组件，通过 HAL 库 API 注册 | 基于 amw trait 的组件，传输/发现/QoS 可替换 |
| 配置方式 | .hal 文件脚本 + INI 配置 | Config Barrier + LockLevel |
| 发现机制 | 无（静态加载和连接） | 三种寻址模式（anycast/group/unicast） |
| 多语言 | C（核心）+ Python（扩展） | Rust（核心）+ C++ + 15 种语言（分层） |
| 序列化 | 直接内存访问（共享内存） | FlatBuffers（跨语言可互操作） |
| 可扩展性 | 用户可编写 HAL 组件和运动学模块 | amw 传输实现可替换 |

### 7.2 可借鉴的线程调度/实时控制模型

#### 两级线程模型

LinuxCNC 的 **base-thread + servo-thread 两级线程模型** 是经过 20 年工业验证的设计：

- **base-thread（高频短周期）**: 适合步进脉冲生成、编码器读取等对延迟极度敏感的操作
- **servo-thread（低频长周期）**: 适合 PID 计算、轨迹规划、运动学等需要较多计算时间的操作

**AUDESYS 参考**: AUDESYS 的三层延迟模型（< 1us / ~10us / ~100us）可以映射到类似的线程层次：

```
Layer 1 (< 1us): Rust 独占，无 GC/无 JIT，类似 base-thread
Layer 2 (~10us): Rust + C++ FlatBuffers over UDS，类似 servo-thread
Layer 3 (~100us): 15 种语言，FlatBuffers over Zenoh，类似用户空间
```

#### 函数驱动的线程调度

LinuxCNC 的线程调度模型中，**函数（Function）是调度的基本单元**：

```
# 将多个函数按顺序添加到同一个线程
addf stepgen.0.make-pulses base-thread
addf encoder.0.read base-thread
addf parport.0.write base-thread

# 在 servo-thread 中添加不同的函数
addf motion-command-handler servo-thread
addf motion-controller servo-thread
addf pid.0.do-pid-calcs servo-thread
```

这种设计允许系统集成商精确控制每个函数在哪个线程以什么频率执行。

**AUDESYS 参考**: 在 AUDESYS 的 Runtime 中，不同功能的执行也可以分组到不同的线程/任务中：

- 硬实时任务（类似 base-thread）：I/O 读取、状态更新
- 控制任务（类似 servo-thread）：控制算法、调度
- 非实时任务：日志、诊断、网络通信

### 7.3 组件化设计理念的参考

#### 1. "集成电路"设计范式

LinuxCNC 将软件系统设计类比为硬件电路设计，这一理念值得 AUDESYS 借鉴：

- **标准化接口**：所有 HAL 组件都通过相同的 Pin/Signal/Function 接口暴露
- **可组合性**：标准组件可以像搭积木一样组合成复杂系统
- **可测试性**：每个组件可以独立测试，信号可以实时观测

#### 2. 运行时配置与观测

- **halmeter**: 实时显示任何 HAL 信号的值（类似于数字万用表）
- **halscope**: 实时示波器，显示信号波形
- **halshow**: 浏览所有 HAL 对象

这些工具使得系统集成和调试变得直观，与硬件工程师的工具类比。

#### 3. 渐进式复杂度管理

- 简单系统：使用 StepConf 向导，几分钟即可配置完成
- 中等系统：手动编辑 HAL 和 INI 文件
- 复杂系统：编写自定义 HAL 组件、运动学模块、GUI

这种渐进式复杂度管理使 LinuxCNC 能同时服务初学者和专家。

### 7.4 对 AUDESYS 设计的具体建议

1. **HAL 信号命名规范**:
   LinuxCNC 使用 `component.instance.pin` 的命名规范（如 `motion.0.pos-cmd.0`），AUDESYS 的 `component.interface.name` 命名规范与之理念一致，可以借鉴其层级结构

2. **线程与函数的分离**:
   LinuxCNC 将"功能定义"（Function）和"执行调度"（Thread）分离，使系统集成商可以自由组合。AUDESYS 的 Runtime 调度器也可以采用类似设计

3. **观测工具的重要性**:
   LinuxCNC 的 halmeter/halscope 是其成功的关键因素之一。AUDESYS 的工业调试桥（Industrial Debug Bridge）应提供类似的实时观测能力

4. **配置与代码分离**:
   LinuxCNC 通过 INI + HAL 文件将配置与代码分离，允许用户修改系统行为而不需要编译代码。AUDESYS 的 Config Barrier 设计也体现了这一理念

5. **运动学可插拔性**:
   LinuxCNC 的运动学模块通过标准 C 函数接口实现可插拔。AUDESYS 的 Simulator 模块也可以采用类似的可插拔运动学架构

### 7.5 LinuxCNC 的发展教训

#### 教训 1：实时方案的选择影响整个生态

LinuxCNC 长期绑定 RTAI，这导致：

- 用户必须使用非主线 Linux 内核（RTAI 补丁）
- 安装配置极其复杂（BDI CD 成为必需）
- 限制了硬件平台（RTAI 只支持 x86）
- 导致 Machinekit 分支出现（因实时方案分歧）

到 2.9 系列才迁移到 PREEMPT_RT，这一过程耗时数年。

**AUDESYS 教训**: 实时方案应从一开始就选择主线支持的技术。PREEMPT_RT 已是主线内核的一部分，比 RTAI 更可持续。

#### 教训 2：社区分裂的风险

Machinekit 分支（2014）的出现说明：

- 技术路线分歧可能导致社区分裂
- 保守的合并策略可能迫使创新出走
- 分裂后两个项目都无法充分发挥潜力

**AUDESYS 教训**: 保持开放的治理结构，及时合并社区贡献。

#### 教训 3：文档即产品

LinuxCNC 成功的关键因素之一是极其详尽的文档：

- HAL 手册数百页，从入门到高级配置
- 每个 HAL 组件都有完整的 man page
- 文档通过 Weblate 众包翻译为多种语言
- 社区论坛积累了海量配置案例和故障排除经验

**AUDESYS 教训**: 在项目早期就投入文档建设，将文档视为产品的一部分而非附属品。

#### 教训 4：渐进式学习曲线

LinuxCNC 的设计有意将学习曲线分为多个层次：

1. **使用向导**（StepConf/PNCconf）：不需了解 HAL 即可完成基本配置
2. **修改配置**：编辑 INI 和 HAL 文件调整参数
3. **编写 HAL 组件**：创建自定义组件扩展系统
4. **编写运动学**：实现自定义机器拓扑
5. **修改内核**：深入 LinuxCNC 核心代码

**AUDESYS 教训**: Studio IDE 的设计也应遵循渐进式复杂度 — 通过 GUI 完成 80% 的常见任务，通过代码 API 支持剩余 20% 的深度定制。

---

> **本文档基于 2026 年 7 月的公开信息编写。部分数据（如特定硬件的最佳性能参数）可能因具体配置而异。标注"待确认"的信息表示当前公开资料不足以确定，建议从官方文档和社区论坛验证。**