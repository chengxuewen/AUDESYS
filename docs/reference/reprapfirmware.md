# RepRapFirmware (RRF)

## 1. 产品画像

### 1.1 产品全称与开发商

- **产品全称**: RepRapFirmware（简称 RRF）
- **开发商/组织**: 最初由 **Adrian Bowyer** 在 RepRapPro Ltd 开发，后由 **Duet3D** 社区维护（核心开发者包括 dc42、Chrishamm、David Newell）。当前主仓库由 **Duet3D** 组织维护
- **首次发布年份**: 2013 年（Duet 0.6 电子板上首次部署），2014 年正式开源
- **当前版本**:
  - RRF 3.6.3（2026 年 3 月） — 最新稳定版
  - RRF 3.6.2（2026 年 2 月）
  - RRF 3.6.0（2025 年，重要功能更新）
  - RRF 3.5.x 系列 — 维护中
- **仓库地址**: https://github.com/Duet3D/RepRapFirmware（默认分支: 3.6-dev）
- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **社区/文档**: https://docs.duet3d.com/

### 1.2 产品定位与核心价值主张

RepRapFirmware 定位为 **面向现代 32 位处理器的综合运动控制固件**，主要应用于 3D 打印机，也支持激光雕刻/切割和 CNC。其核心价值主张是：

1. **32 位专用** — 只针对现代 ARM Cortex-M 处理器设计，充分利用 32 位计算能力
2. **无需编译配置** — 用户无需编译或安装开发工具，所有配置通过 SD 卡上的可读文件完成
3. **对象模型驱动** — RRF 3.x 引入完整的对象模型（Object Model），实现打印机状态的全局镜像和可编程访问
4. **宏系统 + 条件编程** — G-code 中支持条件语句、循环和参数，实现强大的自动化控制
5. **分布式控制** — Duet 3 平台通过 CAN 总线实现多板分布式控制
6. **创新引领者** — 在 3D 打印固件中率先引入多项先进技术（模型驱动加热器控制、输入整形、S-curve 加速等）

### 1.3 目标用户群体

| 用户类型 | 典型场景 | 需求特点 |
|---------|---------|---------|
| 3D 打印爱好者 | Duet 系列 3D 打印机日常使用 | 无需编译、Web 界面配置、宏自动化 |
| 专业 3D 打印用户 | 多色打印、IDEX 系统、工业级打印 | 高级运动学、多运动系统、输入整形 |
| CNC/激光切割用户 | 桌面 CNC、激光雕刻 | 32 位处理器、高精度步进控制 |
| 固件开发者 | Duet 3 平台固件开发 | 模块化架构、CoreNG HAL 层 |
| 自动化开发者 | 基于 RRF 的工业控制应用 | CAN 总线分布式、对象模型 API |
| 教育和研究 | 数控技术教学、运动控制实验 | 代码可读性、模块化设计 |

### 1.4 许可证模型

- **许可证**: GNU General Public License v3.0（GPL-3.0）
- **商业模型**: 开源免费，通过 Duet 硬件销售和 Duet Web Control 软件获得收入
- **封闭组件**: 无 — 完全开源
- **OEM 考虑**: GPL-3.0 要求衍生作品同样开源，商业嵌入式场景需注意许可证合规性。CoreNG HAL 层部分代码来自 Atmel Software Framework，有额外许可证限制

---

## 2. 技术特性

### 2.1 核心架构

RRF 采用 **对象化 C++ 架构**，通过模块化的 Spin() 循环驱动各子系统。RRF 1.x/2.x 使用裸机超级循环（Superloop），RRF 3.x 引入了基于 RTOS（ChibiOS）的多任务架构。

```
+----------------------------------------------------------+
|              RepRapFirmware Core                         |
|  RepRap::Spin() - 主循环，依次调用各模块的 Spin()         |
+----------------------------------------------------------+

  +------------------+  +-------------------+
  | Platform         |  | RepRap 核心       |
  | - 硬件抽象层     |  | - 对象模型        |
  | - 串口/USB/网络  |  | - 模块管理        |
  | - 硬件抽象 (HAL) |  | - 配置管理        |
  +------------------+  +-------------------+

  +------------------+  +-------------------+
  | 运动控制          |  | 加热控制          |
  | GCodes           |  | Heat             |
  | Move (Planner)   |  | TemperatureSensor|
  | StepTimer        |  | FilamentMonitor  |
  | Endstops/ZProbe  |  +-------------------+
  +------------------+

  +------------------+  +-------------------+
  | 网络与存储        |  | 工具与扩展         |
  | Network (HTTP)   |  | Tools/Tool       |
  | HTTP/DWControl   |  | FansManager      |
  | FTP/Telnet       |  | Spindles         |
  | FileWriteBuffer  |  | Scanner          |
  +------------------+  +-------------------+
```

#### RRF 1.x/2.x 架构（裸机 Superloop）

RRF 1.x 的架构基于 **裸机超级循环（Bare-metal Superloop）** 模式：

```
while (true) {
    Platform::Spin();    // 硬件层轮询（串口、USB、网络、SD 卡）
    GCodes::Spin();      // G-code 命令队列处理
    Move::Spin();        // 运动规划（Planner）
    Heat::Spin();        // 加热控制（PID 调节）
    // ... 其他模块
}
```

每个模块的 Spin() 方法是无阻塞的——执行快速检查，然后立即返回，不会长时间占用 CPU。

#### RRF 3.x 架构（RTOS + CAN 分布式）

RRF 3.x 引入了基于 **ChibiOS RTOS** 的多任务架构，并在 Duet 3 平台上实现了 **CAN 总线分布式控制**：

```
+-------------------------------------------------------+
|  ChibiOS RTOS                                         |
+-------------------------------------------------------+

  +------------------+  +-------------------+
  | Task: Spin       |  | Task: StepTimer   |
  | 主循环            |  | 步进定时器 (500kHz)|
  +------------------+  +-------------------+

  +------------------+  +-------------------+
  | Task: Network    |  | Task: Heat        |
  | HTTP/TCP/FTP     |  | 加热控制任务      |
  +------------------+  +-------------------+

  +------------------+  +-------------------+
  | Task: CAN        |  | Task: GCodes      |
  | CAN 总线通信      |  | G-code 解析任务   |
  +------------------+  +-------------------+

           CAN 总线上的扩展板
  +------------------+  +-------------------+
  | Duet 3 Expansion |  | Duet 3 Mini 2XD  |
  +------------------+  +-------------------+
```

**RRF 3.x 核心初始化流程**（来自 RepRap.cpp）：

```
void RepRap::Init() noexcept {
    OutputBuffer::Init();
    platform = new Platform();

    network = new Network(*platform);
    gCodes = new GCodes(*platform);
    move = new Move();
    heat = new Heat();
    printMonitor = new PrintMonitor(*platform, *gCodes);
    fansManager = new FansManager;

    platform->Init();
    network->Init();
    gCodes->Init();

    #if SUPPORT_CAN_EXPANSION
    CanInterface::Init();  // CAN 总线初始化
    #endif

    move->Init();
    heat->Init();
    fansManager->Init();
    printMonitor->Init();
    FilamentMonitor::InitStatic();
}
```

### 2.2 对象模型（Object Model）

RRF 3.x 的核心创新是 **对象模型（Object Model, OM）** —— 一个完整的打印机状态镜像，通过 JSON 格式暴露给 Web 界面、宏系统和外部应用程序。

```
/ (root)
├── boards[]              已连接的控制板列表
├── heat[]                加热系统（加热器 + 传感器）
├── move                  运动控制（运动学、轴、挤出机、队列）
├── job                   打印任务（文件、进度、状态）
├── sensors               传感器（限位开关、探针、耗材监控）
├── state                 系统状态（消息框、蜂鸣器）
├── tools[]               工具（挤出机配置）
├── inputs[]              输入通道状态
├── volumes[]             存储卷列表
├── network               网络配置（机器名、IP 等）
├── fans[]                风扇配置
├── spindles[]            主轴配置
├── ledStrips[]           LED 灯带
├── scanners[]            扫描仪
├── message[]             消息队列
├── global                 全局变量
├── limits                 系统限制
└── seqs                   各模块序列号（版本控制）
```

**对象模型查询方式**：

| 方式 | 命令/方法 | 说明 |
|------|---------|------|
| HTTP 请求 | rr_model | 通过网络查询整个对象模型 |
| M-code | M409 | 通过串口查询对象模型 |
| 宏系统 | $OM.<path> | 在 G-code 宏中直接访问 |
| Web 界面 | DWC 插件 | Duet Web Control 的对象模型浏览器 |

**对象模型在宏中的使用**：

```
; 在宏中使用对象模型字段判断条件
if $OM.heat.heaters[0].temp < 200
  M109 S200 ; 等待加热到 200
endif

; 读取运动学配置
echo Current kinematics: $OM.move.kinematics
```

**RRF 3.6.0+ 自定义对象模型键**：

```
; 在 G-code 文件中嵌入自定义对象模型键
;OM job.myCustomValue
; 打印开始后自动在对象模型中创建
```

### 2.3 G-code 宏系统与条件编程

RRF 3.01 引入了 G-code 的条件编程能力：

#### 条件语句

```
; 基本条件判断
if $param.P > 0
  M106 S255 ; 开启风扇
endif

; else 支持
if $OM.heat.heaters[0].temp > 250
  echo "Temperature warning"
else
  echo "Normal temperature"
endif
```

#### 循环结构

```
; for 循环
for i = 0 to 3
  G1 X{10 * i} F6000
next i

; while 循环
while $OM.move.axes[0].target != $OM.move.axes[0].current
  G1 X{+$OM.move.axes[0].target - $OM.move.axes[0].current} F1000
endwhile
```

#### 宏系统结构

```
/
├── config.g         主配置文件，开机时执行
├── homex.g          X 轴归位
├── homey.g          Y 轴归位
├── homez.g          Z 轴归位
├── homeall.g        全部归位
├── bed.g            自动校准（G32 触发）
├── pause.g          打印暂停
├── resume.g         打印恢复
├── /sys/            系统宏目录
│   ├── config.g     主配置
│   └── bed.g        床校准宏
└── /macros/         用户自定义宏
    ├── CalibrateBed.g
    └── HomeAndProbe.g
```

**宏调用**：

```
; 调用宏
M98 P"bed" ; 执行 bed.g

; 宏参数传递
M98 P"TestAxis" A1 B50
; 在宏中通过 $param.A 和 $param.B 访问
```

### 2.4 步进控制与实时性

RRF 的步进控制是核心实时路径：

- **StepTimer**: 基于硬件定时器，频率可达 500kHz（Duet 3）
- **Precise Timing**: 即使在加速过程中也能精确控制步进脉冲时序
- **Watchdog**: 内置 2-3 个内部看门狗，防止固件崩溃导致加热器失控
- **Step Events**: 步进中断中生成 step/direction 脉冲，全整数运算

```
步进控制数据流：
Planner（运动规划）
  -> Block 队列
    -> StepTimer（500kHz 定时器中断）
      -> Step Events（步进脉冲生成）
        -> 步进驱动器（TMC2209/TMC2660）
```

### 2.5 加热器控制与建模

RRF 的加热器控制是其标志性创新：

1. **模型驱动控制**（自 RRF 1.15）：为每个加热器建立一阶传递函数模型
2. **两阶段 PID**：一组用于最小化超调（预热），另一组用于快速响应负载变化
3. **加热器前馈**（自 RRF 3.4）：根据挤出速率变化预测所需功率
4. **电压补偿**：根据供电电压变化自动调整加热器功率
5. **故障检测**：基于模型预测与实测比较，检测危险故障

```
加热器控制环路：
目标温度
  -> PID 计算
    -> PWM 输出 -> 加热器 -> 热敏电阻（温度反馈）
      -> 模型校验 -> 故障检测 -> 反馈到 PID
```

### 2.6 网络与 Web 服务

RRF 的内置网络服务是其核心竞争力之一：

| 协议 | 端口 | 用途 |
|------|------|------|
| HTTP | 80 | Duet Web Control（DWC）主界面 |
| HTTPS | 443（可选） | 加密 HTTP |
| FTP | 21 | 文件传输（G-code 上传/下载） |
| Telnet | 23（默认禁用） | 远程串行控制 |
| WebSocket | 自动升级 | DWC 实时通信 |

**Duet Web Control (DWC)** 提供：
- 实时打印机状态监控（通过对象模型同步）
- 宏管理（创建、编辑、运行 G-code 宏）
- 打印任务管理（上传 G-code、查看进度）
- 文件管理（SD 卡文件浏览）
- 配置管理（在线编辑 config.g）
- 实时控制台（发送 G-code 命令）
- 插件系统（可扩展功能）

### 2.7 支持的运动学模型

| 运动学模型 | 说明 | 适用机器 |
|-----------|------|---------|
| Cartesian | 笛卡尔坐标系 | 标准 3 轴打印机/CNC |
| CoreXY | XY 通过同步带耦合 | CoreXY 打印机 |
| CoreXZ | CoreXY 变种 | CoreXZ 配置 |
| Linear Delta | 线性 Delta | Delta 打印机 |
| Rotary Delta | 旋转 Delta | Delta 打印机 |
| IDEX | 双挤出机独立驱动 | IDEX 多色打印 |
| Markforged | Markforged 专用 | Markforged |
| SCARA | 平面关节机器人 | SCARA 打印机 |
| Five-bar SCARA | 五杆并联 SCARA | 高精度 SCARA |
| Hangprinter | 悬挂式打印 | Hangprinter |
| Polar | 极坐标 | 极坐标打印机 |
| Custom Matrix | 自定义矩阵 | 任意线性组合运动学 |

### 2.8 支持的硬件平台

| 平台 | 主控芯片 | 架构 | 频率 | Flash | RAM | 网络 | 状态 |
|------|---------|------|------|-------|-----|------|------|
| Duet 0.6 | ATSAM3X8E | Cortex-M3 | 84MHz | 512KB | 96KB | USB | 历史 |
| Duet 0.8.5 | ATSAM3X8E | Cortex-M3 | 84MHz | 512KB | 96KB | USB | 历史 |
| Duet 2 WiFi | ATSAM4E8E | Cortex-M4 | 120MHz | 512KB | 128KB | WiFi+以太网 | 成熟 |
| Duet 2 Ethernet | ATSAM4E8E | Cortex-M4 | 120MHz | 512KB | 128KB | 以太网 | 成熟 |
| Duet 2 Maestro | ATSAM4S8C | Cortex-M4 | 120MHz | 512KB | 128KB | USB | 成熟 |
| Duet 3 MB6HC | SAME70Q20 | Cortex-M7 | 300MHz | 2MB | 384KB | 以太网+CAN | 当前主力 |
| Duet 3 Mini | SAME5x | Cortex-M4 | 120MHz | 1MB | 256KB | USB+CAN | 活跃 |
| Duet 3 Mini 2XD | SAME5x | Cortex-M4 | 120MHz | 1MB | 256KB | CAN | 扩展板 |

---

## 3. 功能概览

### 3.1 主要功能模块

#### 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| RepRap | src/Platform/RepRap.cpp | 核心调度器、对象模型管理 |
| Platform | src/Platform/Platform.cpp | 硬件抽象层（HAL） |
| GCodes | src/GCodes/GCodes.cpp | G-code 解析、条件编程、宏执行 |
| Move | src/Movement/Move.cpp | 运动规划（Planner） |
| Heat | src/Heating/Heat.cpp | 加热控制、模型驱动 PID |
| StepTimer | src/Movement/StepTimer.cpp | 高精度步进定时器 |
| Network | src/Networking/Network.cpp | HTTP/FTP/Telnet 服务 |
| PrintMonitor | src/PrintMonitor/ | 打印任务监控 |

#### 扩展模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Endstops | src/Endstops/ | 限位开关、归零 |
| ZProbe | src/Endstops/ZProbe.cpp | 自动调平探针 |
| FansManager | src/Fans/ | 风扇管理 |
| FilamentMonitor | src/FilamentMonitors/ | 耗材监控 |
| Tool | src/Tools/Tool.cpp | 工具（挤出机）管理 |
| Scanner | src/Scanner/Scanner.cpp | 3D 扫描支持 |
| Spindles | src/Tools/Spindles/ | CNC 主轴控制 |
| CanInterface | src/CAN/ | CAN 总线分布式通信 |

### 3.2 配置工作流

RRF 的配置完全通过 SD 卡上的 G-code 文件完成：

```
1. 下载 RRF 固件二进制文件（预编译）
2. 将 firmware.bin 和配置文件夹复制到 SD 卡
3. 编辑 /sys/config.g 配置文件
4. 将 SD 卡插入 Duet 电路板
5. 上电 -> 固件自动加载 -> 执行 config.g
6. 通过 Duet Web Control 连接（浏览器输入 IP 地址）
7. 在 Web 界面中实时调整参数（通过 G-code 命令）

无需：
  - 安装编译器、IDE 或交叉工具链
  - 修改源代码
  - 重新构建固件
```

### 3.3 config.g 配置文件示例

```
; 基本配置
M111 S0                            ; 调试级别
M550 P"My 3D Printer"              ; 机器名称

; 网络配置
M552 S1                            ; 启用网络（DHCP）
M586 P0 S1                         ; 启用 HTTP
M586 P1 S0                         ; 禁用 FTP

; 运动学配置
M569 P0 S0                         ; 驱动器 0 方向
M584 X0 Y1 Z2 E3                   ; 轴映射
M92 X80 Y80 Z2560 E140             ; 步数/mm
M566 X600 Y600 Z60 E300            ; 最大瞬时速度变化
M203 X30000 Y30000 Z2000 E7200     ; 最大速度 (mm/min)
M201 X3000 Y3000 Z200 E5000        ; 加速度 (mm/s^2)

; 温度传感器配置
M308 S0 P"e0temp" Y"thermistor" A"Bed"
M950 H0 C"e0heat" Q200 T0          ; 加热器 0
M307 H0 B0 R1.5 C100 D0.2 S1.0     ; PID 参数

; 工具配置
M563 P0 D0 H1                      ; 工具 0
G10 P0 X0 Y0 Z0                   ; 工具偏移
```

### 3.4 事件系统

RRF 3.x 引入了基于事件（Event）的响应系统：

| 事件 | 触发条件 | 处理方式 |
|------|---------|---------|
| config.g | 开机启动 | 执行系统宏 |
| homeall.g | G28 命令 | 归位所有轴 |
| bed.g | G32 命令 | 自动校准 |
| pause.g | M25/M1 暂停 | 暂停打印 |
| resume.g | M24 恢复 | 恢复打印 |
| start.g | 打印开始 | 预热等准备动作 |
| stop.g | 打印终止 | 冷却、关闭加热 |
| daemon | 定时触发 | 周期性任务 |

### 3.5 分布式控制（Duet 3 + CAN 总线）

Duet 3 平台通过 CAN 总线实现分布式控制：

```
+-----------------------------------------+
|  Duet 3 Main Board (主控板)             |
|  SAME70 @ 300MHz                        |
|  RRF 主实例运行                          |
|  CAN 总线主控                            |
+-----------------------------------------+

         | TMC CAN 总线
         v

扩展板列表：
  - EXP1XD: 2 轴扩展步进驱动
  - EXP3HC: 6 轴扩展步进驱动
  - TOOL1RR: 旋转工具板（Revo Roto）
  - SZP: 扫描 Z 探针
  - M23CL: 闭环电机驱动
  - Duet 3 Mini 2XD: 2 轴迷你扩展板
```

### 3.6 安全特性

| 特性 | 说明 |
|------|------|
| 双重看门狗 | 2-3 个独立看门狗定时器 |
| 加热器故障检测 | 基于模型的加热器脱钩检测 |
| 紧急停止 | EmergencyStop() 立即停止所有输出 |
| 温度限制 | 可配置的最大允许温度 |
| 电源故障恢复 | 检测电压骤降并安全停止 |
| 传感器故障检测 | 热敏电阻短路/开路检测 |
| 耗材耗尽检测 | 可选耗材监控传感器 |

---

## 4. 现状与生态

### 4.1 当前版本与活跃度

| 指标 | 数据 |
|------|------|
| GitHub Stars | ~1,043 |
| Forks | ~583 |
| Open Issues | ~267 |
| 主要开发语言 | C++（C++17） |
| 最新稳定版 | RRF 3.6.3（2026 年 3 月） |
| 默认开发分支 | 3.6-dev（活跃开发中） |
| 核心开发者 | dc42、Chrishamm、David Newell |
| 许可证 | GPL-3.0 |

### 4.2 社区规模/用户基数

- **GitHub**: 1,000+ stars, 580+ forks
- **文档网站**: https://docs.duet3d.com/ — 完善的维基风格文档
- **Duet 论坛**: https://forum.duet3d.com/ — 活跃的社区论坛
- **用户基数**: 数千名活跃用户（基于 Duet 硬件销售量和社区论坛活跃度估算）
- **硬件销售**: Duet 3D 通过全球分销商销售 Duet 电路板
- **应用领域**: 3D 打印（主力）、激光切割、CNC 铣削

### 4.3 生态系统

| 生态组件 | 说明 |
|---------|------|
| **Duet Web Control (DWC)** | 基于 Web 的打印机控制界面 |
| **Duet Software Framework (DSF)** | SBC 模式的后端框架（运行在 Raspberry Pi 上） |
| **PanelDue** | 基于 STM32 的彩色触摸屏面板 |
| **Duet 2** | WiFi/Ethernet/Maestro 三款控制器板 |
| **Duet 3** | MB6HC 主控板 + 多种扩展板 |
| **Duet 3 Mini** | 紧凑型 Duet 3 控制器 |
| **CoreNG** | 硬件抽象层（Atmel SAM MCU） |
| **第三方扩展** | 多种兼容扩展板 |

### 4.4 历史演进

RRF 的发展经历了三个主要阶段：

#### 阶段 1: RRF 1.x 诞生（2013-2015）

- Adrian Bowyer（RepRap 项目的创始人）开始编写 RRF
- 最初针对 Duet 0.6（ATSAM3X8E）设计
- 借鉴 Marlin 和 FiveD Firmware 的经验
- 引入多项创新：模型驱动加热器控制、Delta 自动校准、挤出机压力提前

#### 阶段 2: RRF 2.x 成熟（2016-2019）

- dc42 成为主要维护者，Duet 2 WiFi/Ethernet 硬件发布
- 运动控制算法大幅改进
- CoreNG HAL 层建立，支持多处理器平台
- 网络功能完善，Web 界面成熟

#### 阶段 3: RRF 3.x 重构（2020-至今）

- 基于 ChibiOS RTOS 重新设计
- 引入对象模型（Object Model）
- 引入 G-code 条件编程和循环
- Duet 3 平台发布（SAME70 + CAN 总线分布式架构）
- 引入输入整形（Input Shaping）、S-curve 加速
- 持续迭代：3.6.0（2025）+ 3.6.2/3.6.3（2026）

### 4.5 竞品对比

| 维度 | RepRapFirmware | Marlin | Klipper | Smoothieware |
|------|---------------|--------|---------|-------------|
| 处理器 | 32 位 ARM 专用 | 8/32 位通用 | 上位机 SBC + MCU | LPC1769/STM32H7 |
| 架构 | RTOS + Superloop | Superloop | 分布式 Linux + MCU | 事件驱动模块 |
| 配置方式 | G-code 宏文件 | 编译时宏 | Klipper 配置文件 | config.txt |
| 配置无需编译 | ✅ 是 | ❌ 需要编译 | ✅ 是 | ✅ 是 |
| 对象模型 | ✅ 完整 OM | ❌ 无 | ❌ 部分 | ❌ 无 |
| 条件 G-code | ✅ 完整编程 | ❌ 无 | ✅ 部分 | ❌ 无 |
| 输入整形 | ✅ 支持 | ❌ 不支持 | ✅ 支持 | ❌ 不支持 |
| Web 界面 | ✅ DWC 内置 | ⚠️ 需要 OctoPrint | ⚠️ Mainsail/Fluidd | ⚠️ Webif |
| 分布式控制 | ✅ CAN 总线 | ❌ 无 | ✅ 多 MCU | ❌ 无 |
| 加热器模型 | ✅ 一阶模型 PID | ❌ 标准 PID | ✅ PID | ❌ 标准 PID |
| 社区活跃度 | 中-高 | 高 | 非常高 | 低 |
| 商业化支持 | Duet3D 硬件 | 无 | 无 | SmoothieBoard |

---

## 5. 市场定位

### 5.1 主要应用行业与场景

| 行业 | 典型应用 | 优势 |
|------|---------|------|
| 3D 打印 | 高端 FDM 打印机、多色/IDEX 系统 | 运动学支持最全面 |
| 激光切割 | CO2/二极管激光雕刻 | 32 位高精度步进控制 |
| CNC 铣削 | 桌面 CNC 雕刻机 | 主轴控制 |
| 教育 | 数控技术教学、运动控制实验 | 完善文档、活跃社区 |
| 专业制造 | 小批量生产、原型验证 | 输入整形、S-curve 加速 |

### 5.2 与其他固件的架构对比

**RRF vs Marlin 的哲学差异**：

```
Marlin 哲学：
  "用户应当了解硬件细节以正确配置"
  - 所有参数通过编译时宏定义
  - 修改参数 = 重新编译 = 重新刷写
  - 用户可以完全控制

RRF 哲学：
  "用户应当专注于打印，而非编译"
  - 所有参数通过运行时 G-code 宏配置
  - 修改参数 = 编辑文本文件 = 重启
  - 无需开发环境
```

**RRF vs Klipper 的架构差异**：

```
Klipper:
  上位机 (RPi Linux) + 下位机 (MCU)
  - 复杂计算在 Linux 上运行
  - MCU 只执行实时步进
  - 依赖外部 Web 界面

RRF:
  单片 MCU + 可选 SBC 模式
  - 所有计算在 MCU 上
  - 内置 Web 服务器
  - 独立运行，不依赖 SBC
  - SBC 模式可选（通过 DSF）
```

### 5.3 市场地位评估

RepRapFirmware 在开源 3D 打印固件中占据独特地位：

1. **技术创新引领者**：率先引入模型驱动加热器控制、输入整形、条件 G-code、对象模型等
2. **专业用户首选**：Duet 硬件 + RRF 固件是高端 3D 打印用户的常见选择
3. **最完整的运动学支持**：12 种运动学，包括工业级的 IDEX 和多运动系统
4. **内置 Web 控制**：Duet Web Control 提供最完整的固件端 Web 界面
5. **硬件+软件一体化**：Duet3D 提供完整的硬件+软件解决方案

---

## 6. 产品特色

### 6.1 相较于同类产品的独特优势

1. **对象模型驱动的状态管理**：
   - 完整的状态镜像，通过 JSON API 暴露
   - 宏系统可直接读取和操作对象模型
   - Web 界面通过对象模型实现实时同步
   - 外部应用可通过 HTTP API 访问

2. **G-code 条件编程语言**：
   - if/else/endif 条件分支
   - for/next 和 while/endwhile 循环
   - 数学表达式和变量
   - 对象模型字段直接作为表达式操作数
   - 宏参数传递

3. **模型驱动加热器控制**：
   - 一阶传递函数建模
   - 两阶段 PID（预热 + 负载响应）
   - 加热器前馈（挤出速率/风扇变化补偿）
   - 供电电压补偿
   - 基于模型的故障检测

4. **无需编译的配置系统**：
   - 预编译的二进制固件
   - SD 卡上的 G-code 宏文件
   - Web 界面在线编辑

5. **内置 Web 控制（DWC）**：
   - 完全在固件端运行（不需要外部软件）
   - 实时状态更新（通过对象模型）
   - 宏管理、文件管理、任务管理
   - 控制台、配置编辑、插件系统

6. **CAN 总线分布式控制**：
   - Duet 3 主控 + 扩展板
   - 支持多种扩展板（步进驱动、工具、探针）
   - 热插拔（待确认）

7. **多运动系统和输入整形**：
   - 同一固件同时控制多个独立运动系统
   - 输入整形（类似于 Klipper 的算法）
   - S-curve 三级运动（3rd-order motion）

### 6.2 标志性功能或设计理念

- **"配置即 G-code"** — 所有配置通过 G-code 命令在文本文件中完成
- **"对象模型即 API"** — 固件通过对象模型暴露完整状态
- **"安全第一"** — 多级看门狗 + 模型驱动故障检测
- **"32 位专为 32 位"** — 只面向现代 ARM Cortex-M 处理器

### 6.3 创新设计哲学

#### "固件作为 Web 服务器"

RRF 是最早在固件端内置完整 Web 服务器的 3D 打印固件之一。在同类产品中，Marlin 需要 OctoPrint（外部软件），Klipper 需要 Mainsail/Fluidd（外部应用），而 RRF 在固件内直接运行 HTTP 服务：

```
RRF 独立模式：
  3D 打印机 <-HTTP-> 浏览器
  不需要中间机器

Klipper 模式：
  3D 打印机 <-串口-> RPi (运行 Klipper) <-HTTP-> 浏览器

Marlin 模式：
  3D 打印机 <-USB-> RPi (运行 OctoPrint) <-HTTP-> 浏览器
```

这种设计使得 RRF 成为对初学者最友好的固件之一——不需要额外的 Raspberry Pi 或计算机。

#### "对象模型的版本化设计"

对象模型中的 seqs 字段（序列号）使得：

```
- 每次状态更新时，改动的模块序列号递增
- Web 界面可以只查询改动的部分（增量更新）
- 外部应用可以高效地同步状态
- 支持的协议：
  M409 F"f"  -- 只返回非 live 字段
  rr_model    -- HTTP 查询完整的 OM
```

#### "从 RepRap 到 Duet 的商业化路径"

RRF 展示了开源社区项目向商业产品演进的典型案例：

- 2013：Adrian Bowyer 为 RepRap 项目开发固件
- 2014：Duet 0.6 硬件 + RRF 1.x
- 2016：dc42 分支接管维护
- 2018：Duet 2 WiFi/Ethernet + RRF 2.x
- 2020：Duet 3 SAME70 + RRF 3.x RTOS 重构
- 2023：Duet 3 Mini + CAN 分布式
- 2026：RRF 3.6.x，输入整形 + S-curve

---

## 7. 对 AUDESYS 的参考价值

### 7.1 可借鉴的架构设计/理念

#### 1. 内置 Web 服务器（Duet Web Control）

RRF 在 MCU 端直接运行 Web 服务器，提供完整的机器控制界面，无需外部中间件：

**AUDESYS 参考**：

AUDESYS Studio IDE 可借鉴 RRF 的 DWC 设计：

| RRF DWC 特性 | AUDESYS Studio 对应 | 参考价值 |
|-------------|-------------------|---------|
| 实时状态监控（对象模型） | Runtime 状态管理器 | 高 |
| 宏管理系统 | 脚本面板 | 高 |
| 在线 G-code 控制台 | Studio Console | 高 |
| 文件管理 | 项目文件浏览器 | 中 |
| 插件系统 | Studio 扩展机制 | 高 |
| WebSocket 实时更新 | 实时数据通道 | 高 |

**关键启示**：RRF 证明了在资源受限的 MCU 上运行 Web 服务器并实现复杂控制界面是可行的。AUDESYS 的 Studio（Tauri + React）在更强大的平台上运行，可以实现更丰富的功能。

#### 2. 对象模型（Object Model）

RRF 3.x 的对象模型是固件状态管理的优秀参考：

**AUDESYS 参考**：

AUDESYS Runtime 可考虑类似设计：
- Runtime 状态模型（类似 RRF OM）
- 通过 JSON-RPC 暴露状态
- 宏/脚本可以查询和修改状态
- Studio 通过对象模型实时同步

```
可能的设计：
+--------------------------+
|  AUDESYS Runtime         |
|  - 对象模型（上/下位机状态） |
|  - JSON-RPC 接口          |
|  - 事件通知               |
+--------------------------+
          | JSON-RPC
          v
+--------------------------+
|  AUDESYS Studio          |
|  - 通过对象模型同步        |
|  - 实时 UI 更新           |
|  - 配置编辑               |
+--------------------------+
```

#### 3. G-code 宏系统

RRF 的宏系统是工业控制自动化的优秀参考：

**AUDESYS 参考**：

AUDESYS 的脚本/宏策略（D26）可借鉴：
- Phase 1 YAML 配置 + ST 编程
- 宏文件驱动的自动化流程
- 条件执行和循环结构

#### 4. 硬件抽象层（CoreNG）

RRF 的 CoreNG 提供了跨平台硬件抽象：

**AUDESYS 参考**：

AUDESYS HAL 设计中的 HalTransport 抽象层可参考 CoreNG 的模式：
- 统一的硬件接口
- 可替换的实现（不同 MCU 平台）
- 编译时选择和优化

### 7.2 可移植/适配的技术模块

| 技术模块 | 描述 | 移植价值 |
|---------|------|---------|
| **对象模型** | 完整的固件状态镜像和 API | 高 — 可直接参考 AUDESYS Runtime 状态管理 |
| **G-code 宏系统** | G-code 文件驱动的配置自动化 | 高 — AUDESYS 脚本系统参考 |
| **模型驱动加热器控制** | 一阶传递函数加热器模型 | 中 — 标准工业控制算法 |
| **输入整形** | 抑制打印共振的滤波算法 | 中 — 如果需要运动控制 |
| **S-curve 加速** | 三级运动轨迹规划 | 中 — 高标准运动控制 |
| **CoreNG HAL 层** | MCU 硬件抽象层 | 中 — AUDESYS HAL 参考 |

### 7.3 与 AUDESYS 定位的差异与互补

| 维度 | RepRapFirmware | AUDESYS |
|------|---------------|---------|
| 核心定位 | 3D 打印机运动控制固件 | 工业控制系统模拟平台 |
| 目标用户 | 3D 打印爱好者、专业打印用户 | 控制工程师、系统集成商、开发者 |
| 运行环境 | ARM Cortex-M MCU（Duet 板） | 多平台（仿真 + 物理 Runtime） |
| 编程方式 | G-code 输入 + 宏自动化 | 多种语言 + 可视化开发（规划中） |
| 实时性 | 中断驱动 + RTOS | 硬实时+仿真双模（规划中） |
| Web 界面 | 固件端 DWC | Studio IDE 提供 |
| 分布式 | CAN 总线扩展板 | JSON-RPC/REST + HAL（规划中） |
| HAL 设计 | CoreNG（Atmel 特定） | 完整通信原语（Signal/StreamChannel/RPC） |

**互补关系**：
- RRF 的 **Web 控制 + 宏系统** 对 AUDESYS Studio IDE 的前端设计有直接参考价值
- RRF 的 **对象模型** 对 AUDESYS Runtime 状态管理有重要参考价值
- RRF 的 **模型驱动加热器控制** 可作为 AUDESYS 标准控制算法的参考实现
- AUDESYS 的 **HAL 设计**（3 原语 + amw）在抽象层次上远超 RRF 的 CoreNG

### 7.4 详细对比分析：配置与用户界面

| 维度 | RRF | AUDESYS（设计） |
|------|-----|----------------|
| 配置形式 | G-code 宏文件（config.g） | YAML（开发）+ FlatBuffers（运行时） |
| 用户界面 | DWC Web 界面（固件端运行） | Studio IDE 桌面应用（Tauri+React） |
| 状态查询 | 对象模型（JSON API） | JSON-RPC/REST API |
| 自动化 | 宏系统（条件/循环/参数） | 脚本扩展（WASM + Python，Phase 2） |
| 实时数据 | WebSocket 增量更新 | 待设计 |
| 插件系统 | DWC 插件 | Studio 扩展（Phase 2） |

### 7.5 长期维护与商业化的参考

RRF 展示了可持续的开源工业控制项目模式：

1. **开源核心 + 商业硬件**：RRF 固件完全开源，Duet3D 公司通过硬件销售获得收入
2. **社区维护者到企业支持的过渡**：从 Adrian Bowyer（学术/社区）到 dc42（社区），再到 Duet3D（企业化）
3. **版本管理**：3.x 大版本有清晰的路线图和 changelog
4. **文档完善**：docs.duet3d.com 提供专业级的技术文档
5. **向后兼容性**：RRF 2 -> 3 迁移提供了详细的迁移指南

**AUDESYS 启示**：AUDESYS 的长期治理模式可从 RRF 的经验中吸取教训——明确的开源策略、高质量的硬件/软件结合、完善的文档和迁移路径。

---

> **本文档基于 2026 年 7 月的公开信息编写。部分特性描述基于 RRF 3.6.x 版本，可能随版本迭代而变化。标注"待确认"的信息表示当前公开资料不足以确定，建议直接从官方仓库或 docs.duet3d.com 验证。**
