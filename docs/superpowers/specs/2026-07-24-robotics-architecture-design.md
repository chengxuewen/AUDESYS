# AUDESYS 机器人架构扩展设计

**日期**: 2026-07-24
**状态**: 完成。§1-§53 交互讨论 + 4轮文档审计 + M1详细计划。待进入实施。
**关联决策**: D77-D91 (已录入 .agents/memorys/decisions.md)

---

## 动机

AUDESYS 当前是固定站点工业控制系统（PLC/DCS 运行时）。用户期望扩展至多形态机器人领域——AGV、巡逻小车、扫地机器人、机械臂、机器狗、无人卡车、人形机器人等——并保持统一的 Studio 开发体验。

核心痛点：ROS2/dora-rs 对工业工程师门槛过高（需要精通 C++/Python + DDS + colcon + launch 系统），AUDESYS 的图形化编程（FBD/LD/ST）已验证低门槛可行性，应延伸至机器人领域。

## 设计原则

1. **图形化优先**：功能块编程（IEC 61499 风格）为默认体验，文本编程（Python/ST/Rust）为高级选项
2. **渐进替换**：不幻想一夜重写 ROS2 生态，桥接现有能力，逐步自研替代
3. **隔离优先**：RT 控制器生存优先于所有非确定性子系统，容器级崩溃隔离
4. **跨平台**：macOS 开发（完整 Studio + 仿真）+ Linux 生产（最小化运行时）
5. **零锁定**：功能块 HAL 接口稳定，底层实现可随时替换（ROS2→自研 Rust crate）

---

## §1 总体架构：三层 + 桥接 + Agent

```
Layer 3: Studio (Theia)
┌──────────────────────────────────────────────────────────┐
│  FBD 编辑器    拓扑视图    调试面板    Pod 管理视图        │
│  ┌────────────────── 机器人功能块库 ──────────────────┐  │
│  │ NavigateToGoal │ FollowPath │ LidarProcessor │ ... │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────┘
                         │ napi-rs bridge (单向: Studio→Agent)
Layer 2: Agent (新增)
┌────────────────────────┼─────────────────────────────────┐
│  audesys-supervisor     │  统一 IPC 端点                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ supervision tree                                   │  │
│  │ ├─ controller (process, RT)                        │  │
│  │ ├─ ros2-bridge (container, sidecar)                │  │
│  │ ├─ nav2-stack (container)                          │  │
│  │ ├─ slam-toolbox (container)                        │  │
│  │ ├─ panel-hmi (process)                             │  │
│  │ └─ [远程节点] (proxy via Zenoh)                     │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌────────────────────┐               │
│  │ Process Mgr  │  │ Container Mgr      │               │
│  │ (fork+exec)  │  │ (Podman REST API)  │               │
│  └──────────────┘  └────────────────────┘               │
└────────────────────────┬─────────────────────────────────┘
                         │ IPC/UDS
Layer 1: Runtime Components
┌────────────────────────┼─────────────────────────────────┐
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │ audesys-runtime│  │ hal-ros2-bridge  │              │
│  │ RT 控制循环       │  │ topic↔Signal     │              │
│  │ 电机PID + IO      │◄─┤ action↔RPC       │              │
│  │ 安全逻辑          │  │ service↔RPC      │              │
│  └──────────────────┘  └────────┬─────────┘              │
│                                  │ UDS (pod 内)           │
│  ┌───────────────────────────────▼─────────────────────┐  │
│  │ ROS2 容器群 (Podman Pod)                            │  │
│  │ nav2-stack │ slam-toolbox │ perception-pipeline     │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                         │ amw (Zenoh / UDS)
Layer 0: Transport
┌────────────────────────┼─────────────────────────────────┐
│  amw_inproc (单节点 <1μs)  │  amw_zenoh (跨节点 ~10-100μs) │
└───────────────────────────────────────────────────────────┘
```

---

## §2 桥接层：hal-ros2-bridge 协议

### 2.1 拓扑

```
AUDESYS Runtime (RT)              ros2-bridge (容器)            ROS2 Network
┌─────────────────────┐     UDS     ┌──────────────────────┐     DDS     ┌──────────┐
│ Signal "motor.vel"  │────────────►│ → /cmd_vel publish   │────────────►│  NAV2    │
│ RPC "nav.goal"      │────────────►│ → /navigate_to_pose  │────────────►│          │
│                     │             │   action              │             │          │
│ Signal "odom.pose"  │◄────────────│ ← /odom subscribe     │◄────────────│ SLAM     │
│ StreamChannel "scan"│◄────────────│ ← /scan subscribe     │◄────────────│          │
└─────────────────────┘             └──────────────────────┘             └──────────┘
```

### 2.2 映射表

| HAL 原语 | ROS2 概念 | 方向 |
|----------|----------|:----:|
| Signal Write | Topic Publish | AUD→R2 |
| Signal Subscribe | Topic Subscribe | R2→AUD |
| RPC Call | Service Call + Action Goal | AUD↔R2 |
| StreamChannel Write | Topic Publish (reliable) | AUD→R2 |
| StreamChannel Read | Topic Subscribe (reliable) | R2→AUD |

### 2.3 UDS 帧协议（复用现有 IPC 基础）

```
┌────────┬────────┬──────────┬──────────┬──────────────┐
│ Type   │Seq ID  │ Length   │ Payload  │ HMAC         │
│ 1 byte │ 4 bytes│ 4 bytes  │ N bytes  │ 32 bytes     │
└────────┴────────┴──────────┴──────────┴──────────────┘
```

帧类型：0x20 PUBLISH, 0x21 SUBSCRIBE_RESULT, 0x22 SERVICE_CALL, 0x23 SERVICE_RESULT, 0x24 ACTION_GOAL, 0x25 ACTION_FEEDBACK, 0x26 ACTION_RESULT

### 2.4 类型映射

AUDESYS 始终只看到 HAL 原生类型（Array<F64>、Blob），桥接层负责 ROS2 消息 ↔ HAL 类型转换。

```yaml
# bridge-config.yaml
mappings:
  - hal: "nav.goal_pose"
    type: Array<F64>
    ros2: "/navigate_to_pose"
    ros2_type: "geometry_msgs/msg/PoseStamped"
    direction: aud_to_ros2
    transform: pose_stamped_to_array
```

---

## §3 Pod 编排：audesys-supervisor

### 3.1 Agent 架构

Agent 是应用层通用分布式组件管理器（借鉴 PM2/Erlang OTP），管理对象包括：

- 原生进程（controller、panel-hmi）
- 容器（ros2-bridge、nav2-stack、slam-toolbox）
- 远程节点（通过 remote-supervisor 代理）

```
audesys-supervisor (master)
├── controller        进程    RT控制循环、IPC Server
├── ros2-bridge      容器    ROS2 ↔ HAL 桥接
├── nav2-stack       容器    ROS2 导航栈
├── slam-toolbox     容器    SLAM 建图
├── panel-hmi        进程    AUDEDeck (D65)
└── [AGV-02].*       代理    通过 remote-supervisor (Zenoh)
```

### 3.2 配置：supervisor.toml

```toml
[supervisor]
node_id = "AGV-01"
listen = "0.0.0.0:4000"

[[components]]
id = "runtime"
type = "process"
binary = "/opt/audesys/bin/audesys-runtime"
restart = { max_retries = 3, backoff_ms = [100, 500, 2000] }

[[components]]
id = "ros2-bridge"
type = "container"
image = "ghcr.io/audesys/ros2-bridge:humble"
restart = { max_retries = 3, backoff_ms = [1000, 2000] }

[[components]]
id = "nav2-stack"
type = "container"
image = "ghcr.io/audesys/nav2:latest"
restart = { max_retries = 3, backoff_ms = [2000, 4000] }
depends_on = ["ros2-bridge"]
```

### 3.3 启动序列

```
1. 解析 supervisor.toml
2. dependency resolution: controller → ros2-bridge → nav2-stack
3. fork+exec 进程 ｜ podman 启动容器
4. 健康检查循环开始
```

### 3.4 崩溃退避

```
第1次崩溃 → 100ms → 重启 → 又崩
第2次崩溃 → 500ms → 重启 → 又崩
第3次崩溃 → 2000ms → 重启 → 又崩
→ max_retries 达上限 → Dead → 通知 Hub → 人工介入
```

**级联保护**：依赖方重启后，被依赖方不触发级联重启，等待自动重连。

### 3.5 健康检查

- 进程：周期 RPC ping (500ms 超时)
- 容器：podman healthcheck run
- 远程：Zenoh queryable heartbeat

### 3.6 跨节点管理

通过 Zenoh 代理远程 Agent：
- `zenoh::query("AGV-02/status")` → 状态查询
- `zenoh::put("AGV-02/cmd", "restart/nav2-stack")` → 远程操作
- `zenoh::subscribe("AGV-02/events")` → 事件订阅

### 3.7 Agent vs systemd

| | systemd | audesys-supervisor |
|------|:---:|:---:|
| 跨平台 | ❌ Linux only | ✅ macOS/Linux |
| rootless | ⚠️ user-instance | ✅ |
| API | D-Bus (重) | 复用现有 IPC |
| 容器管理 | Quadlet → podman | Podman REST API |
| supervision tree | 无 | ✅ 依赖+退避 |
| 远程管理 | ❌ | ✅ Zenoh 代理 |

---

## §4 功能块库：多形态机器人 + 多语言编程

### 4.1 扩展 IEC 61499 功能块模型

```rust
struct FunctionBlock {
    meta: FbMeta,
    interface: FbInterface,
    algorithm: Algorithm,        // 多语言算法
    execution_control: Option<Ecc>, // 可选 ECC 状态机
}

enum Algorithm {
    Native(NativeFb),            // Rust crate
    St(StScript),                // IEC 61131-3 ST
    Python(PythonScript),        // Python 脚本
    TypeScript(TsScript),        // TypeScript 脚本
    Composite(Vec<FunctionBlock>), // 子功能块网络
}

enum RobotType {
    Common,         // 所有机器人共用
    MobileBase,     // AGV、巡逻车、扫地机、无人卡车
    Arm,            // 机械臂
    Legged,         // 机器狗
    Humanoid,       // 人形机器人
    Custom(String), // 自定义
}
```

### 4.2 编程模型层次

```
            Studio 编程模型
                  │
    ┌─────────────┼─────────────┐
    │             │             │
图形化编程      文本编程      混合编程
┌───┴──────┐  ┌──┴─────┐  ┌───┴──────────┐
│FBD 功能块│  │ST 文本 │  │FBD 骨架       │
│LD 梯形图 │  │Python  │  │+ script 块    │
│SFC 顺序图│  │Rust    │  │嵌入 Python/TS │
└──────────┘  │TypeScript│ └──────────────┘
             └─────────┘
```

### 4.3 功能块库分类

```
FB Library
├── Common (共通)
│   ├── PowerManager, SafetyMonitor, Diagnostics, MqttBridge
│
├── MobileBase (移动底盘)
│   ├── Odometry, VelocityController, PathFollower
│   ├── LocalPlanner, GlobalPlanner, SlamLauncher, Docking
│
├── Arm (机械臂)
│   ├── ForwardKinematics, InverseKinematics, JointTrajectory
│   ├── CartesianMotion, Gripper, CollisionCheck
│
├── Legged (腿足)
│   ├── GaitController, BalanceController
│   ├── StepPlanner, BodyController
│
├── Humanoid (人形)
│   ├── WholeBodyController, WalkingPlanner
│   ├── Manipulation, VisionServoing
│
└── Vehicle (载具)
    ├── LaneKeeping, AdaptiveCruise
    ├── TrajectoryPlanner, V2XBridge
```

### 4.4 多语言算法示例

同一功能块可选用不同语言实现，HAL 接口不变：

- **Python** — 快速原型、AI/ML 集成
- **Rust** — 实时控制、零拷贝、硬实时
- **ST** — 符合 IEC 61131-3 的工控程序员习惯

### 4.5 FBD 编辑器中的机器人编程

功能块拖拽连线 → 右键 "Edit Algorithm" → 选择 Python/ST/Rust → 部署到目标节点。

---

## §5 渐进替换策略

核心原则：**替换粒度 = 功能块级别**。每个功能块的 HAL 接口是稳定契约，替换底层实现时 FBD 程序零修改。

### 5.1 替换优先级矩阵

排序依据：简单度 × RT 关键度 × 生态依赖度

| 优先级 | 组件 | 简单度 | RT 必要 | 生态依赖 | 替换时机 |
|:---:|------|:---:|:---:|:---:|:---:|
| P0 | VelocityController | ★★★★★ | ★★★★★ | ☆ | Phase 1 |
| P0 | Odometry | ★★★★☆ | ★★★★★ | ☆ | Phase 1 |
| P0 | PathFollower | ★★★★☆ | ★★★★☆ | ☆ | Phase 1 |
| P1 | IoDriver (电机/编码器/IMU) | ★★★☆☆ | ★★★★★ | ☆ | Phase 1 |
| P2 | LocalPlanner (DWA/TEB) | ★★☆☆☆ | ★★★★☆ | ★☆☆ | Phase 2 |
| P3 | Costmap | ★★☆☆☆ | ★★★☆☆ | ★★☆ | Phase 2 |
| P4 | GlobalPlanner (A*/RRT*) | ★★★☆☆ | ★☆☆☆☆ | ★★☆ | Phase 2 |
| P5 | SLAM | ★☆☆☆☆ | ★☆☆☆☆ | ★★★★★ | Phase 3 |
| P6 | Perception (视觉/检测) | ★☆☆☆☆ | ★☆☆☆☆ | ★★★★★ | Phase 3+ |
| — | Simulation (Gazebo) | — | — | ★★★★★ | 永不替换 |

### 5.2 三阶段容器演进

```
Phase 1 (3 容器)               Phase 2 (4 容器)              Phase 3 (3 容器)
┌──── agv-01.pod ────┐        ┌──── agv-01.pod ────┐        ┌──── agv-01.pod ────┐
│ controller (进程)   │        │ controller (进程)   │        │ controller (进程)   │
│                     │        │  含: LocalPlan.     │        │  含: SLAM           │
│ ros2-bridge         │        │ ros2-bridge         │        │ ros2-bridge (瘦身)  │
│                     │        │                     │        │                     │
│ ros2-nav-slam       │        │ ros2-global-planner │        │ ros2-perception     │
│ nav2 + slam + percp │        │ ros2-slam           │        │ (视觉/ML, 永驻)     │
└─────────────────────┘        └─────────────────────┘        └─────────────────────┘
```

### 5.3 替换门禁

每个组件替换前必须通过：
1. 接口等价: HAL Signal/RPC 输入输出与 ROS2 版一致
2. 性能达标: 不低于 ROS2 版性能
3. 功能等价: 通过相同的回归测试套件
4. 仿真验证: SimulationHarness 下 100% 测试通过
5. 稳定性: 24h 连续运行无崩溃

不达标 → 回退到 ROS2 桥接版本（零 FBD 修改）。

### 5.4 永不替换的 ROS2 组件

| 组件 | 原因 |
|------|------|
| 视觉/ML 推理 | Python + PyTorch/TensorFlow 生态不可替代 |
| Gazebo 仿真 | 物理引擎、传感器模型投入巨大 |
| rviz2 可视化 | 不是 AUDESYS 的竞争领域 |
| ROS2 第三方驱动包 | 长尾效应，桥接即可 |
## §6 与 ROS2/dora-rs 对比

| 维度 | ROS2 | dora-rs | AUDESYS |
|------|:---:|:---:|:---:|
| 编程范式 | C++/Python 代码 | 数据流 operators | **图形化 FBD + 多语言脚本** |
| 目标用户 | 机器人研究员 | 性能敏感开发者 | **自动化工程师、PLC 程序员** |
| 学习门槛 | 高 | 中 | **低（CODESYS 体验）** |
| 实时性 | DDS 延迟不稳定 | 共享内存零拷贝 | **RT 线程 <1ms** |
| 崩溃隔离 | ❌ 同进程共享命运 | ⚠️ 算子同进程 | **✅ 容器级隔离** |
| 导航栈 | ✅ nav2 成熟 | ❌ 无 | **桥接→远期自研** |
| 安全认证 | ⚠️ SROS2 复杂 | ❌ | **HMAC + RBAC + IEC 62443** |
| IDE | VS Code + 插件 | VS Code | **Theia Studio 内置** |
| 调试 | topic echo | dora logs | **DAP 断点 + Scope + 拓扑** |

### AUDESYS 独特价值

| ROS2/dora-rs 痛点 | AUDESYS 解法 |
|------|------|
| 需精通 C++/Python + ROS2 API | FBD 图形编程 |
| launch 系统脆弱，依赖解析复杂 | Agent supervision tree |
| 调试靠 topic echo 和日志 | Scope View 波形 + DAP 断点 + 拓扑实时状态 |
| 无 PLC 集成，需额外网关 | 原生 IEC 61131-3，AGV+PLC 统一编程 |
| colcon build + 依赖地狱 | 容器化部署，依赖完全隔离 |
| DDS 延迟抖动不适合硬实时 | RT 线程 SCHED_FIFO，确定性 <1ms |

---

## §7 补充设计点

### 7.1 多机协同调度

**架构**：fleet-manager 作为 Agent 扩展模块，提供两层控制：
- 舰队层：TaskAllocator（任务分配）、TrafficCtrl（交通管制+死锁预防）、ZoneManager（区域互斥）、RoutePlanner（全局路径+充电调度）
- 单机层：每个 AGV 保留自己的 Agent + Runtime 做本地实时控制

**通信**：fleet-manager 通过 Zenoh 代理各 AGV Agent。AGV 之间不直接通信，所有协调经 fleet-manager。

**降级**：fleet-manager 离线 → 各 AGV 独立运行。

**编程**：舰队调度逻辑通过 FBD 功能块编程（TaskQueue → Allocator → TrafficMap → ZoneLock）。

### 7.2 仿真策略

四层仿真体系：
| Level | 名称 | 能力 | Phase |
|:---:|------|------|:---:|
| L1 | 单元测试 | SimulationHarness (已有) | ✅ |
| L2 | 控制在环 | + VirtualRobot + VirtualSensor + WorldState + 2D 可视化 | Phase 1 |
| L3 | 物理在环 | Gazebo 桥接（通过 ros2-bridge）+ 3D 物理 + 传感器模型 | Phase 2 |
| L4 | 硬件在环 | 真实硬件 + 仿真环境 | Phase 3 |

### 7.3 安全认证体系

**推荐架构**：AUTOSAR E-Gas 三级 + MiR 双层 + NVIDIA SFF 安全包络线

```
Level 3: 硬件安全看门狗 (外部 MCU / 安全继电器)
Level 2: Safety Zone (Safety Thread 5ms) — SFF 安全包络线 + 安全IO直连
Level 1: Standard Zone (RT Thread) — 导航/规划/控制
```

**关键约束**：Safety Zone 不接收任何来自 ROS2 桥接的执行指令。Standard Zone 永远不直接控制执行器——安全区是唯一输出通路。安全包络线 = {v_max, accel_limit, zone_boundary}。

**认证路径**：Phase 1-2 预认证设计（安全线程隔离、限定 FB 集、双通道预留）→ Phase 3+ TÜV/exida 正式认证（目标 SIL 2 / PL d）。

**行业参考**：AUTOSAR E-Gas（L1功能+L2监控+L3硬件 三级模型）、NVIDIA Safety Force Field（安全包络线概念）、MiR/KUKA AGV（安全PLC+导航PC双层模式）、Mobileye RSS（形式化安全模型）。

### 7.4 OPC UA 集成

**架构**：OPC UA Gateway 容器（open62541），通过 UDS IPC 与 Runtime 通信，HAL ↔ OPC UA 通过 YAML 配置映射。

**信息模型**：实现 OPC 40501 AGV 标准，暴露 Fleet/AGV-01/Status/Navigation/Load + Methods (TransportOrder/Pause/Resume/EmergencyStop)。

**安全**：TLS 1.2+ + X.509 证书 + RBAC + Audit Events。

### 7.5 实时以太网扩展

**EtherCAT**：Phase 1 SOEM（Rust FFI 封装，~50μs）→ Phase 2 IgH 内核模块（<10μs）。支持 Distributed Clocks 多轴同步 + FSoE 安全通信。

**CANopen**：SocketCAN + CANopen Master，用于 AGV 电机控制器（Roboteq 等）。PDO 周期数据 + SDO 参数配置。

**架构**：统一 IoDriver trait 抽象，对上层透明。支持 `cycle_sync()` 触发 DC 同步。

### 7.6 设备树：robot.toml

`robot.toml` 是统一硬件描述文件（YAML 格式），覆盖：
- 机器人类型 + 运动学参数（底盘尺寸、编码器分辨率、速度上限）
- 总线拓扑（CANopen/EtherCAT/USB 接口和参数）
- 设备清单（电机控制器、LiDAR、IMU、安全激光）+ 安装位姿
- 信号映射（设备寄存器 ↔ HAL Signal 名称和类型）
- 安全配置（安全区定义、safety 标记）

**代码生成**：robot.toml → IoImageTable + Signal Registry + supervisor.toml 补充 + bridge-config.yaml + opcua-bridge.yaml。

**文件边界**：robot.toml 描述硬件（硬件工程师维护一次），supervisor.toml 描述软件部署（Studio 拓扑视图生成），FBD 程序描述控制逻辑（自动化工程师编程）。

---

## §9 多语言开发工作流

### 9.1 语言领地

| 层级 | 语言 | 用途 | 运行位置 |
|------|------|------|----------|
| 实时层 | Rust | IoDriver, 安全逻辑, 硬实时算法 | Runtime 进程内 |
| 控制层 | ST (IEC 61131-3) | PLC 逻辑, 状态机, 顺序控制 | HAL IR VM |
| 感知层 | Python | AI/ML, 快速原型, 数据处理 | Python Runtime 容器 |
| 交互层 | TypeScript | HMI 逻辑, Panel 界面 | Panel 进程 |

### 9.2 编辑器：Monaco + LSP 统一

ST/Python/Rust/TS 共享 Monaco Editor，各自配 LSP。Python 特殊支持 Cell 模式（`# %%`），可交互式探索实时系统：读信号值、调参数、观察结果。

### 9.3 部署管道

ST: Monaco → ST Compiler → HalProgram → deploy (IPC 0x10) → VM 执行。Python: Monaco → .py → 部署到 Python Runtime 容器 → RPC 调用。Rust: Monaco → cargo build → native binary → Agent 部署。TS: Monaco → vite build → bundle → Panel 部署。

### 9.4 跨语言互操作

全部通过 HAL 原语通信（Signal/StreamChannel/RPC）。ST FB 调用 Python FB？RPC。Python FB 给 Rust FB 发标志？Signal。语言边界透明。

---

## §10 包管理与 FB 库分发

### 10.1 包结构

```
my-robot-fbs/
├── audesys.toml          # 包清单
├── fbs/                   # 功能块 (FBD + 算法)
├── drivers/               # IoDriver (Rust)
├── quadlets/              # 容器定义
├── templates/             # robot.toml 模板
└── examples/              # 示例项目
```

### 10.2 audesys.toml 清单

```toml
[package]
name = "audesys-agv-nav"
version = "0.2.1"
[dependencies]
audesys-std = "^1.2"
my-custom-drivers = { git = "...", tag = "v1.0" }
```

### 10.3 分发层级

Phase 1: GitHub Releases + Git tags（零成本）。Phase 2: audesys.io 定制 registry。audesys.lock 锁定依赖版本。

### 10.4 Studio Library Manager

Studio 内浏览已安装/可用包，一键安装，依赖自动解析。

---

## §11 开发者 SDK 与生态

### 11.1 CLI

```bash
audesys new fb <name> --lang python|rust|st
audesys new driver <name> --bus canopen|ethercat|modbus
audesys new robot <name> --type MobileBase|Arm|Legged
audesys test          # SimulationHarness 本地测试
audesys publish       # 发布到 registry
```

### 11.2 开发流程

脚手架模板 → Studio 编辑（FBD + 算法）→ audesys test → audesys publish → Library Manager 可发现。

### 11.3 安全等级标记

`safety_level = "none" | "SIL1" | "SIL2" | "SIL3"` — 影响 API 限制、静态分析强度、测试要求。

### 11.4 生态飞轮

硬件厂商发布 IoDriver → 系统集成商提供项目模板 → 社区开发者贡献功能块 → 用户在 Library Manager 搜索安装。

---

## §12 云端与远程管理

### 12.1 Edge Agent

每节点运行 `audesys-edge-agent`（Agent 管理）：遥测上报、告警评估、OTA 管理、远程终端、心跳检测。MQTT/TLS + X.509 证书认证。

### 12.2 Fleet Dashboard

工厂地图 + 实时状态 + 告警面板 + OTA 管理 + 远程终端。滚动升级（canary→10%→50%→100%）+ 自动回滚。

### 12.3 数据分级

1kHz 原始数据不直接上云。Edge 降采样、过滤、聚合。AI 推理在边缘完成，仅结果上云。

### 12.4 部署选项

纯本地（气隙）│ 自托管 Cloud │ AUDESYS Cloud (SaaS) │ 混合（推荐）。

---

## §13 行业架构对标分析

### 13.1 工业自动化平台

Beckhoff/Siemens: 边端一体，云纯监控。编程 IEC 61131-3 + C++。封闭生态。对齐度：边端一体 ✅，FBD ✅，开放度 AUDESYS 更优。

### 13.2 机器人运维平台

Formant: Agent 上报 + 远程操控 + 舰队管理。Balena: git push 部署 + Delta OTA。对齐度：Edge Agent ✅，OTA ✅，AUDESYS 独有实时控制+编程。

### 13.3 云基础设施

AWS Greengrass: 全 AWS 绑定。KubeEdge: Device Twin + 边缘持久化，70MB EdgeCore。EdgeX: 南北向分离 + 多微服务（过重）。对齐度：离线自治 ✅，AUDESYS 独有低门槛图形化。

### 13.4 AUDESYS 三角优势

「开放生态 + 实时控制 + 图形化编程」— 工业厂商、机器人平台、云厂商均无法同时提供三者。

---

## §14 边端一体架构

### 14.1 混合模式

每 AGV 边端一体（本地 Agent + Runtime），保底离线自治。fleet-manager 主从选举，主节点做全局调度。主离线时自动选举新主。

### 14.2 三层调度

Cloud (MES/WMS): 生产订单 → Edge (fleet-manager): 任务分解+AGV分配+交通管制+充电调度 → Device (Runtime): <1ms 运动执行。所有调度模块为 FBD 功能块，用户可定制调度策略。

### 14.3 fleet-manager 模块

TaskDecomposer │ MissionAssigner │ TrafficController │ DeadlockDetector │ ChargeScheduler │ ZoneManager — 全部可编程。

---

## §8 统一诊断层：录制、回放、可视化

### 8.1 设计理念

诊断层是形态无关的通用基础设施。无论录制的是 CNC 6 轴位置、AGV 激光雷达点云、还是人形机器人全身关节角度——数据通过 HAL 原语进入，以 MCAP 格式存储，在 Studio 中统一可视化。

**核心原则**：回放与实时的可视化管线完全一致。Replayer 注入信号到 SimulationHarness → Runtime 正常执行 → Studio 展现。零重复代码。

### 8.2 架构：诊断数据流

```
Runtime (RT) ──IPC──► Recorder ──MCAP──► 磁盘
       │                   (Agent 组件)       │
       │                                           │
       └──IPC──► Studio (Live 视图)               │
                   │                               │
                   │                     Replayer ◄─┘
                   │                   (Agent 组件)
                   │                        │
                   │                 sim_set_signal
                   │                        │
                   └──── SimulationHarness ◄┘
                              │
                         Studio (Replay 视图)
```

### 8.3 MCAP 录制格式

选择 MCAP（Foxglove 开发的模块化容器格式）：
- **原生 FlatBuffers 支持**：Channel encoding="flatbuffer"，Schema 嵌入 .bfbs 二进制
- **Rust 库成熟**：`mcap` crate v0.25.0，8.38M+ 下载量，MIT 许可
- **Foxglove 兼容**：录制文件可直接拖入 Foxglove 可视化
- **随机访问**：摘要+偏移表实现 O(1) 定位
- **块压缩**：zstd/lz4 压缩，不解压全文件即可读取指定消息

MCAP Channel 命名规范（形态无关）：
```
/audesys/signals/{component}.{name}     — 离散信号
  例: /audesys/signals/cnc.axis.0.pos
      /audesys/signals/agv.battery.level
      /audesys/signals/arm.joint.3.angle

/audesys/streams/{device}.{name}        — 连续流
  例: /audesys/streams/lidar.front.scan
      /audesys/streams/camera.rgb.frame

/audesys/events/{type}                  — 事件/告警
  例: /audesys/events/alarm
      /audesys/events/state_change
```

### 8.4 Recorder/Replayer 组件

两者都是 Agent 管理的组件：

**Recorder**：
- 配置 `recorder.toml`（录制范围、压缩参数、输出路径）
- 订阅 Runtime IPC，接收指定 Signal/StreamChannel/Event
- 写入 MCAP（zstd 压缩，4MB 块，增量写入）
- Studio 控制：Start/Stop/Pause 录制

**Replayer**：
- 读取 MCAP 文件
- 按时间序列调用 `sim_set_signal` 注入 Runtime
- 支持：Play/Pause/Seek（O(1) 随机访问）/Speed（0.1x-10x）/Loop/Step
- 支持：Marker 跳转（Alarm、StateChange、UserMark）

### 8.5 Studio 诊断面板

| 面板 | 技术 | 数据源 | 适用形态 | 状态 |
|------|------|--------|----------|:---:|
| **Signal Browser** | React DOM tree | SignalBridgeService | 全部 | ✅ 已有 |
| **Scope View** | Canvas 2D | TimeSeriesBuffer | 全部（数值信号） | ✅ 已有 |
| **Debug Panel** | BaseWidget | DebugBridge（待实现） | 全部（HalProgram） | ⚠️ Stub |
| **3D Scene** | Three.js + WebGL | pose + TF + pointcloud | 有姿态数据 | ❌ 新建 |
| **Camera Viewer** | WebSocket + Canvas | StreamChannel image | 有摄像头 | ❌ 新建 |
| **Timeline** | React | MCAP 索引 | 全部 | ❌ 新建 |
| **Log Console** | React virtual list | 结构化日志流 | 全部 | ❌ 新建 |
| **Event Timeline** | React + Timeline | 事件/告警流 | 全部 | ❌ 新建 |
| **Joint Monitor** | ECharts (已有) | 关节角度信号 | 机械臂/腿足 | ❌ 新建 |
| **Costmap Overlay** | Canvas 2D | occupancy grid | 移动底盘 | ❌ 新建 |

关键设计：
- 回放时所有面板与实时共用同一数据管线（SignalBridgeService）
- 形态感知由数据驱动——3D Scene 仅在订阅到 pose 信号时激活
- 面板布局使用 Theia 原生 Dock 系统，无需自研布局引擎

### 8.6 Timeline 面板（录制/回放中枢）

```
┌─ Timeline ───────────────────────────────────────────┐
│  [⏺ REC] [⏹ STOP]                                   │
│                                                       │
│  00:00 ────── 00:15 ────── 00:30 ────── 00:45       │
│  ═══════●══════════════════════════════════════════   │
│                                                       │
│  Signals: ███████████████████████████████████████████ │
│  Lidar:    ████   ████   ████   ████   ████   ████  │
│  Events:       ▲          ▲     ▲                    │
│                                                       │
│  [▶ ⏸ ⏮ ⏭]  速度: 1x  循环: □                     │
└──────────────────────────────────────────────────────┘
```

功能：
- 录制控制（Start/Stop/Pause）
- 时间轴拖拽（基于 MCAP 索引，O(1) seek）
- Channel activity bar（每通道消息密度热图）
- Event marker（Alarm ▲ / StateChange ● / UserMark ◆）
- 速度控制（0.1x-10x）、单步前进后退、循环播放
- 录制文件管理：列表、导出、Foxglove 分享

### 8.7 工作流

**实时调试**：Studio 连接 Runtime → 展开面板（Scope + 3D Scene）→ 复现问题 → 同时录制 MCAP → 停止录制

**离线分析**：加载 MCAP 文件 → Agent 启动 Replayer → 拖拽时间轴到故障点 → 查看：Scope 波形 + 3D 位姿快照 + Signal 值 + Log 上下文

**分享协作**：MCAP 文件通过 Foxglove Data Platform 或直接文件分享，团队成员可在 Foxglove 中打开分析

---

## §15 云边端用户、权限、认证

### 15.1 用户角色全景

| 层级 | 角色 | 职责 |
|------|------|------|
| Cloud | OrgAdmin | 组织+用户管理、账单+订阅、全局策略 |
| Cloud | FleetOperator | 舰队监控、告警确认、任务下发 |
| 贯穿三层 | AppEngineer | FBD 编程、仿真测试、部署发布 |
| Cloud/Edge | Viewer | 只读 Dashboard |
| Edge | SiteAdmin | Agent 配置、容器生命周期、网络+证书 |
| Edge | Maintenance | 诊断+日志、固件升级、故障恢复 |
| Device | SafetyEng | 安全参数、安全区域、力/速限制 |
| Device | Commission | 现场调试、参数标定、I/O 测试 |
| Device | Operator | Panel 运行、HMI 操作 |

### 15.2 认证层次

| 链路 | 协议 | 凭证 | 用途 |
|------|------|------|------|
| 用户 → Cloud | OAuth2/OIDC + JWT | 密码/SSO/MFA | 人类身份 |
| 用户 → Studio | OAuth2/OIDC | 刷新令牌 | 人类身份 |
| Studio → Edge | HMAC-SHA256 + JWT | 共享密钥 | 本地 IPC |
| Edge → Cloud | MQTT/TLS + X.509 | 设备证书 | 设备身份 |
| Field → Runtime | HMAC-SHA256 | 共享密钥 | 本地 IPC |

### 15.3 RBAC + Scope 权限模型

`权限 = 角色 (Role) × 范围 (Scope) × 操作 (Action)`

范围层级: Org → Project → Node → Component → Signal

| 角色 | 典型权限 |
|------|------|
| fleet_operator | read:*, fleet:monitor, fleet:task, alert:ack |
| commissioning_engineer | read:*, write:signal:*, deploy:program, controller:start/stop |
| safety_engineer | safety:configure, safety:zone:edit (禁 write:signal:* 和 deploy:*) |

### 15.4 纯端侧模式（无云边）

当仅有 Studio + 单台设备时：

- **认证**：HMAC 密钥 → 用户密码登录 → JWT 令牌（Agent 自签发）
- **用户库**：本地 SQLite（Argon2id 哈希），不依赖外部服务
- **首次启动**：设置向导（默认密钥 audesys-dev-secret）→ 创建管理员 → 生成新密钥
- **多设备**：主节点存储用户库，从节点通过 Zenoh 继承 JWT 权限
- **硬件旁路**：物理急停不经过任何软件认证

### 15.5 离线降级

- 在线时：OIDC 验证 + 从 Cloud 拉取 RBAC
- 离线时：本地缓存权限（24h 有效期）→ 超时降级为 Operator 只读权限
- 审计日志本地存储，上线后批量同步

### 15.6 设备证书

X.509 证书链：Root CA (离线 HSM) → Intermediate CA → 每设备独有证书。自动轮换（30 天有效期），吊销列表同步。

### 15.7 审计日志

格式：`{who, when, where, what, result}`。Edge 本地 SQLite(30天) → 批量上报 Cloud → 合规导出。

---

## §16 性能基准

### 16.1 实时控制层

| 指标 | CNC | 机械臂 | AGV | 人形 |
|------|:---:|:---:|:---:|:---:|
| 控制周期 | 100μs | 500μs-1ms | 1-5ms | 1ms |
| 周期抖动 | <1μs | <5μs | <10μs | <10μs |
| 伺服更新率 | 10kHz | 2kHz | 1kHz | 1kHz |
| EtherCAT DC同步 | <1μs | <1μs | — | <1μs |
| 安全线程 | 5ms | 2ms | 10ms | 2ms |
| 中断响应 | <10μs | <20μs | <50μs | <20μs |

### 16.2 通信层

| 链路 | 介质 | 延迟 | 抖动 |
|------|------|:---:|:---:|
| Runtime ↔ Agent | UDS | <10μs | <1μs |
| Runtime ↔ ROS2 Bridge | UDS(Pod内) | <50μs | <5μs |
| Node ↔ Node | Zenoh/UDS | <100μs | <20μs |
| CANopen PDO | CAN 1Mbps | <1ms | <100μs |
| EtherCAT PDO | 100Mbps | <100μs | <1μs |

### 16.3 感知与规划层

| 算法 | 帧率 | 单帧时间 | GPU |
|------|:---:|:---:|:---:|
| 2D LiDAR SLAM | 15Hz | <66ms | ❌ |
| 物体检测 | 30fps | <33ms | ✅ |
| 局部规划 (DWA) | 20Hz | <50ms | ❌ |
| 全局规划 (A*) | 按需 | <100ms | ❌ |

### 16.4 导航精度

| 指标 | 目标 |
|------|:---:|
| 重复定位 (磁/二维码) | ±10mm |
| SLAM定位 | ±30mm |
| 路径跟踪 | ±50mm |
| 对接精度 | ±5mm |

### 16.5 系统资源

| 配置 | RAM | 磁盘 | CPU |
|------|:---:|:---:|:---:|
| CNC (仅控制器) | <100MB | <100MB | 2 cores |
| AGV 完整栈 | <2GB | <8GB | 4 cores |
| MCAP 录制 | <50MB | ~50MB/h | <0.1 core |

### 16.6 启动与恢复

| 操作 | 时间 |
|------|:---:|
| Runtime 冷启动 | <3s |
| 完整系统启动 | <60s |
| 热重启 (hot-swap) | <100ms |
| 容器重启 | <10s |

### 16.7 确定性保证

PREEMPT_RT + SCHED_FIFO + CPU 隔离。RT 路径零堆分配。EtherCAT DC 同步。Rust 无 GC 暂停。Python/ROS2 不进入 RT 路径。

---

## §17 FBD 能力边界与多范式编程

### 17.1 FBD 的核心定位

FBD 是**编排层**，不是实现层。它定义「信号怎么连、谁调用谁」。复杂算法由 ST/Python/Rust 在块内部实现。

### 17.2 能力矩阵

**擅长**：信号路由、参数配置、控制流串联、安全联锁、状态选择、I/O 映射。本质是数据流图。

**不擅长**：路径规划(A*)—图搜索算法、SLAM—概率模型+矩阵运算、IK—牛顿迭代+雅可比、NN推理—张量运算、重试退避—时序逻辑不适合周期扫描、批量数据处理—排序/聚合。

### 17.3 复杂度天花板

超过 30 个块的 FBD 程序，可读性断崖下降。工业实践：拆分为子功能块，子块内部用 ST 实现。

### 17.4 工业对标

没有一家工业平台只用 FBD（CODESYS/Beckhoff/Siemens 全部采用「图形编排 + 文本实现」混合模式）。AUDESYS 选择 FBD/LD/SFC 编排 + ST/Python/Rust/TS 实现是业经验证的正确路径。

### 17.5 各形态编程配比

CNC: FBD 60%/ST 30%/G-code 10%。AGV: FBD 40%/Python 30%/Rust 20%/ST 10%。机械臂: FBD 30%/Rust 40%/ST 20%/Python 10%。腿足: FBD 20%/Rust 50%/ST 20%/Python 10%。人形: FBD 20%/Rust 40%/Python 30%/ST 10%。

---

## 设计决策记录

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | 采用分层渐进架构：桥接 ROS2 → 逐步自研 | ✅ 确认 |
| — | Agent 为应用层通用组件管理器，不依赖 systemd | ✅ 确认 |
| — | 桥接层通过 UDS 与 Runtime 通信，复用现有 IPC 帧协议 | ✅ 确认 |
| — | 容器化部署使用 Podman Pod，管理通过 audesys-podman-supervisor | ✅ 确认 |
| — | 功能块模型扩展 IEC 61499，支持 Rust/Python/TS 多语言算法 | ✅ 确认 |
| — | 类型映射在 YAML 配置中声明，AUDESYS 只看到 HAL 原生类型 | ✅ 确认 |
| — | 安全采用 E-Gas 三级 + MiR 双层 + SFF 安全包络线 | ✅ 确认 |
| — | 仿真四层体系: SimHarness → 虚拟传感器 → Gazebo → HIL | ✅ 确认 |
| — | OPC UA 桥接通过 OPC 40501 AGV 标准信息模型 | ✅ 确认 |
| — | 实时以太网扩展通过统一 IoDriver trait | ✅ 确认 |
| — | 硬件描述统一为 robot.toml，生成所有下层配置 | ✅ 确认 |
| — | 诊断层采用 MCAP 通用录包格式（原生 FlatBuffers 支持） | ✅ 确认 |
| — | Recorder/Replayer 作为 Agent 组件管理 | ✅ 确认 |
| — | 回放与实时共享同一可视化管线（SimulationHarness 注入） | ✅ 确认 |
| — | Studio 诊断面板形态无关：CNC/AGV/机械臂用同一套工具 | ✅ 确认 |
| — | 四种语言各有领地：RT(Rust) / 控制(ST) / 感知(Python) / 交互(TS) | ✅ 确认 |
| — | Python Cell 模式交互式探索实时系统 | ✅ 确认 |
| — | 包管理：audesys.toml + audesys.lock + GitHub/registry 分层 | ✅ 确认 |
| — | audesys CLI 脚手架 + Studio 一体化开发 + 安全等级标记 | ✅ 确认 |
| — | 云端可选：Edge Agent + MQTT + Fleet Dashboard + OTA | ✅ 确认 |
| — | 边端一体混合模式：每AGV自包含 + fleet-manager主从选举 | ✅ 确认 |
| — | 三层调度：Cloud订单 → Edge调度 → Device执行 | ✅ 确认 |
| — | 「开放生态 + 实时控制 + 图形化编程」三角优势定位 | ✅ 确认 |
| — | 认证：OIDC 统一身份(云端) + X.509 设备证书(边端) + HMAC+JWT(本地) | ✅ 确认 |
| — | RBAC + Scope 权限模型（Org→Project→Node→Signal 层级） | ✅ 确认 |
| — | 纯端侧模式：本地 SQLite 用户库 + Agent 自签发 JWT | ✅ 确认 |
| — | 离线降级：缓存权限(24h) → 超时降级 Operator 只读 | ✅ 确认 |
| — | 硬件急停旁路所有软件认证（工业安全底线） | ✅ 确认 |
| — | RT 线程 <10μs 延迟 + <1μs 抖动 (PREEMPT_RT + CPU 隔离) | ✅ 确认 |
| — | AGV 完整栈 <2GB RAM / CNC <100MB RAM | ✅ 确认 |
| — | 冷启动 <3s (Runtime) / <60s (完整系统) | ✅ 确认 |
| — | RT 路径零堆分配 + Rust 无 GC 暂停 | ✅ 确认 |
| — | FBD 定位为编排层，复杂算法由 ST/Python/Rust 块内实现 | ✅ 确认 |
| — | 超过 30 块的 FBD 应拆分为子功能块（工业最佳实践） | ✅ 确认 |
## §18 工程项目组织

### 18.1 项目 = 硬件 + 代码 + 配置

单设备项目结构：`audesys.toml` + `robot.toml` + `programs/` + `fbs/` + `deployments/`。所有配置文件文本格式（TOML/YAML），Git 友好。

### 18.2 三层继承: Template → Project → Deployment

Template (上游不可变) → Project (设备型号差异) → Deployment (每台设备独有参数：序列号、PID校准、零点偏移)。

### 18.3 工厂级工程

```
factory-cell-1/
├── fleet.toml                # 设备拓扑 + Agent/Field/Cloud 定义
├── shared/                   # 共享库 (fbs/, signals/, containers/)
├── devices/                  # 设备类型子项目
├── cells/                    # 生产单元协调程序
├── edge/                     # Field 配置 + 定制应用
└── cloud/                    # Cloud 配置
```

一个工程 = 系统全部源码。部署时根据 fleet.toml 自动分发到各目标。

---

## §19 升级、数据迁移 & 边缘定制

### 19.1 自动迁移

Template/Project/Deployment 每层带 schema_version。破坏性变更携带迁移脚本 (Python)。新增字段自动填充默认值，冲突人工裁决。迁移前自动备份。

### 19.2 分阶段上线

Canary (1台离线设备) → 验证 1h → 滚动上线。异常自动回滚。

### 19.3 边缘定制: 四层渐进

L1 模板 (80%)：选型号→填参数。L2 FBD (15%)：拖拽功能块→连信号→配置阈值。L3 Schema (10%)：定义数据模型→自动 CRUD+看板 (借鉴 NocoBase)。L4 代码 (5%)：Python/Rust/TS 定制。

### 19.4 Schema 引擎 (L3)

Field 上运行 schema-engine 容器。FBD 块发 Signal → Schema Engine 自动 CRUD。典型场景: 质检记录、设备台账、排班管理。

---

## §20 模块边界、命名、运行时组合

### 20.1 三端命名: Agent / Field / Cloud

| 盟识 | AUDESYS | 职责 |
|------|---------|------|
| VCS (车端) | Agent | 让一台车活着、跑对、安全 |
| FOS (场端) | Field | 让N台车不撞、有序、可观测 |
| CSS (云端) | Cloud | 让车队越跑越好、远程可控 |

注: §3 等早期章节中的 "Agent" 已精化为 Agent(车端)/Field(场端)。

### 20.2 模块归属

| Agent (每车) | Field (每场站) | Cloud |
|------|------|------|
| controller | fleet-manager | dashboard |
| safety-zone | opcua-gateway | data-lake |
| IoDrivers | schema-engine | analytics |
| HAL IR VM | edge-connector | ota-manager |
| recorder (车载) | recorder (集中) | registry |
| ros2-bridge (如需) | python-runtime | alerts |
| python-runtime (如需) | custom-apps | user-management |

### 20.3 场景 × 模块矩阵

| 模块 | CNC | 单AGV | 工厂单元 | 机器狗 | 无人卡车 |
|------|:---:|:---:|:---:|:---:|:---:|
| controller+safety | ● | ● | ● | ● | ● |
| Agent (车端) | ● | ● | ● | ● | ● |
| fleet-manager | ○ | ○ | ● | ○ | ●(编队) |
| Field (场端) | ○ | ○ | ● | ○ | ● |
| Cloud | ○ | ○ | ● | ○ | ● |

### 20.4 fleet.toml

```toml
[project]
name = "mining-site-3"

[[agents]]          # 车端
id = "truck-01"
type = "mining-truck"
modules = ["runtime", "safety-zone", "recorder"]

[[fields]]         # 场端
id = "station-a"
address = "10.0.1.100"
modules = ["fleet-manager", "opcua-gateway", "schema-engine", "edge-connector"]

[cloud]              # 云端
endpoint = "https://cloud.audesys.io"
modules = ["dashboard", "data-lake", "analytics", "ota"]
```

---

## 新增决策记录 (§18-§20)

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | 工程项目 = 硬件+代码+配置，Template→Project→Deployment 三层继承 | ✅ 确认 |
| — | 自动迁移：schema_version + 迁移脚本 + 冲突仲裁 + 备份 | ✅ 确认 |
| — | 边缘定制四层模型：模板(80%)→FBD(15%)→Schema(10%)→代码(5%) | ✅ 确认 |
| — | Schema 引擎提供低代码 CRUD，借鉴 NocoBase 理念 | ✅ 确认 |
| — | 三端命名：Agent(车端)/Field(场端)/Cloud(云端) | ✅ 确认 |
| — | Agent 精化为 Agent(车端生命周期) + Station(场端编排) | ✅ 确认 |
| — | 一个工程 = 系统全部源码，fleet.toml 定义拓扑+模块组合 | ✅ 确认 |
| — | 不同场景通过 fleet.toml 的 modules 裁剪 | ✅ 确认 |
## §21 项目范围与边界：三级工程模型

### 21.1 分层可组合

| | Device Project | Cell Project | Factory Project |
|------|:---:|:---:|:---:|
| **范围** | 一种设备型号 | 一组协作设备 + Station | 全厂 + Cloud |
| **包含** | robot.toml, programs/, fbs/ | fleet.toml(站端), 协调程序 | fleet.toml(全拓扑), cloud/ |
| **谁开发** | 设备工程师 | 单元集成工程师 | 工厂架构师 |
| **版本** | 独立 semver | 独立 semver | 独立 semver |
| **部署** | 单设备 | 一组设备 + Station | 全部 |
| **依赖** | 上游 FB 库 | Device Projects | Cell Projects |

### 21.2 工程间引用

```toml
# factory-line-1/workspace.toml
[workspace]
members = [
    "cells/cell-loading",
    "cells/cell-transport",
]
```

Device → 右键 "Wrap in Cell" → Cell → 右键 "Wrap in Factory"。每层可独立打开。

### 21.3 Studio 上下文感知

上下文 Bar: `[Factory: line-1 ▼] > [Cell: loading ▼] > [Device: agv-01 ▼]`

| 功能 | Factory | Cell | Device |
|------|:---:|:---:|:---:|
| Signal Browser | 全部 | 单元 | 设备 |
| Deploy 目标 | 全部+Cloud | 单元+Station | 单设备 |
| Build 范围 | 全部 | 单元 | 设备 |

### 21.4 工程创建

New Project Wizard: 选级别(Device/Cell/Factory) → 选模板(AGV/CNC/机械臂等) → 填信息 → 生成。

### 21.5 Git 策略

推荐 Monorepo：一个 Git 仓库包含全部设备/单元/云配置。设备子目录可独立作为 submodule 给外部团队。

---

## §22 工程锁定与扩展点

### 22.1 场景

厂商交付固化系统，客户只能改指定模块（如传送带逻辑、对接时序），其余全部锁定。

### 22.2 模板定义扩展点

```toml
# vendor-agv-template/audesys.toml
[project]
name = "vendor-agv-template"
vendor = "Acme Robotics"
readonly = true

[extensions]
allow_params = ["conveyor", "dock"]     # 可覆盖参数
allow_signals = ["conveyor.*"]          # 可读写信号
allow_fbs = true                         # 允许新增自定义FB
allow_programs = ["extensions/"]         # 自定义程序目录
allow_hmi = true                         # 允许定制HMI

[locked]
params = ["motor", "safety"]            # 关键参数不可触碰
programs = ["vendor/*"]                  # 厂商程序只读
signals = ["motor.*", "safety.*"]       # 核心信号只读
```

### 22.3 客户工程

```toml
# customer-agv/audesys.toml
[project]
name = "warehouse-agv"
[extends]
template = "acme-agv-template"
version = "^2.1"
[overrides]
docking_timeout = "30s"
conveyor_speed = 0.5
# motor.max_speed = 3.0  # ❌ 被厂商锁定
[extensions]
modules = ["conveyor_logic", "dock_sequence"]
```

### 22.4 Studio 体验

- **锁定区域**: 🔒 灰色 + 工具提示 "厂商模板 — 联系 Acme Robotics"
- **扩展点**: ✏️ 可编辑, 彩色边框, "Custom" 标记
- **参数覆盖**: 显示基值和覆盖值并排

### 22.5 合并部署

Template(只读) → merge ← Project(覆盖) → merge ← Deployment(标定) → 设备运行时

### 22.6 升级冲突

模板变更与客户覆盖冲突 → 通知客户选择: 接受升级(丢失自定义) / 保留当前 / 联系厂商。

---

## §23 黑盒交付与二次开发

### 23.1 保护模式

| 场景 | 保护方式 | 强度 |
|------|------|:---:|
| ST 算法 | 编译 HalProgram (字节码) | ★★☆ |
| Rust 算法 | 编译 native .so, strip 符号 | ★★★ |
| Python 算法 | PyArmor 混淆 / 容器内运行 | ★★☆ |
| ML 模型 | 加密 .onnx, 硬件密钥解密 | ★★★★ |
| 整体系统 | 容器镜像, 无 shell | ★★★★ |
| 最高保护 | HSM/TPM 硬件安全模块 | ★★★★★ |

### 23.2 厂商发布包

```toml
[distribution]
type = "binary"           # "source" | "binary" | "hybrid"
[artifacts]
halprograms = "halprograms/"     # 编译后 .hal (不可读)
natives = "lib/"                  # Rust .so (strip符号)
containers = "ghcr.io/acme/"     # 容器镜像 (无shell)
interfaces = "interfaces/"        # FBD 接口定义 (公开)
docs = "docs/"                    # API 文档 (公开)
```

### 23.3 客户侧体验

- ✅ 读写公开接口信号（输入/输出）
- ✅ 在 extensions/ 创建自定义程序
- ✅ 覆盖 params.toml 允许的参数
- ❌ 打开二进制模块查看内部算法
- ❌ 修改二进制模块接口
- ❌ 反编译受保护文件

### 23.4 FBD 黑盒

```
FBD 中二进制模块显示为 🔒 灰框+锁，仅展示输入/输出信号。
双击 → "此模块为二进制交付, 内部算法不可见"
右键 → 查看接口文档
```

### 23.5 运行时隔离

```toml
[[agents.modules]]
type = "vendor-package"
image = "ghcr.io/acme/agv-core:v2.1"
protection = "container"          # 无 shell, 不可 exec
```

厂商代码在独立容器中运行，仅通过 HAL 信号与客户代码通信。客户代码崩溃不影响核心控制。

---

## 新增决策记录 (§21-§23)

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | 三级工程模型: Device → Cell → Factory, 每层独立版本化+可组合 | ✅ 确认 |
| — | Monorepo 推荐: 单一 Git 仓库包含全栈, 设备可独立 submodule | ✅ 确认 |
| — | Studio 上下文 Bar 切换 Factory/Cell/Device 视图 | ✅ 确认 |
| — | 模板扩展点机制: extensions/locked 声明厂商开放与锁定的区域 | ✅ 确认 |
| — | 部署合并链: Template(只读) → Project(覆盖) → Deployment(标定) | ✅ 确认 |
| — | 升级冲突检测: 厂商变更 vs 客户覆盖冲突时交互式裁决 | ✅ 确认 |
| — | 黑盒交付三种模式: source / binary / hybrid | ✅ 确认 |
| — | 二进制保护: HalProgram 字节码 + native .so strip + PyArmor 混淆 + 容器隔离 | ✅ 确认 |
| — | 运行时隔离: 厂商容器与客户代码仅通过 HAL 信号通信 | ✅ 确认 |
## §24 项目文档体系

### 24.1 文档类型矩阵

| 文档类型 | 生成方式 | 目标读者 | 发布位置 |
|------|------|------|------|
| 信号参考 | 自动 (robot.toml) | 集成工程师 | Studio + Station |
| FB 接口参考 | 自动 (.fbd) | 自动化工程师 | Studio + SDK |
| 系统拓扑 | 自动 (fleet.toml) | 系统管理员 | Studio + Field + Cloud |
| OPC UA 接口 | 自动 (yaml) | IT/MES 工程师 | Studio + Cloud |
| 部署指南 | 自动 (fleet.toml) | 系统集成商 | Studio + Cloud |
| 操作手册 | 手写 (markdown) | 操作员 | Panel + Station |
| 标定指南 | 手写 (markdown) | 现场调试工程师 | Studio + Station |
| 告警参考 | 自动 (告警配置) | 操作员+运维 | Panel + Field + Cloud |
| SDK 参考 | 自动 (.fbs) | 第三方开发者 | audesys.io |

### 24.2 项目内文档结构

```
docs/
├── book.toml              # mdbook 配置 (title, language)
├── src/                   # 文档源文件
│   ├── SUMMARY.md         # 目录
│   ├── index.md           # 项目概述 (手写)
│   ├── user/              # 用户级 (手写)
│   ├── engineer/          # 工程级 (自动+手写)
│   ├── integration/       # 集成级 (自动)
│   └── sdk/               # SDK级 (自动)
└── images/                # 图片和图表
```

### 24.3 文档生成管道

`audesys build` → 程序编译 + `audesys-doc-gen` (robot/fleet/fbd/yaml/fbs → .json+.md) → mdbook build → 静态站点。

两套产物：`.json` (机器可读，Studio 内联文档) + `.md` (人类可读，mdbook 构建手册)。

### 24.4 机器可读文档格式

`docs/build/fb-index.json`: 每个 FB 的 name/version/vendor/inputs/outputs/params/protection。Signal Browser hover tooltip 从此读取。

### 24.5 Studio 内联文档

- FBD 编辑器: 右键 FB → "查看文档" → Docs Panel 渲染结构化卡片 + 完整手册链接
- Signal Browser: 悬停信号 → tooltip 显示类型/总线/说明
- 文档预览: iframe 加载 mdbook 静态站点，侧边栏 + 搜索

### 24.6 多渠道发布

`audesys publish --docs` → Registry (audesys.io/docs/) + Field (http://station:8080/docs/) + Cloud Dashboard + Panel (HMI 帮助菜单)

### 24.7 Theia 扩展

audesys-docs 扩展：DocsPanel (ReactWidget, 读 fb-index.json, iframe mdbook), FbdDocsProvider (右键菜单), SignalDocsProvider (hover tooltip), DocBuildService (调用 doc-gen CLI)。

### 24.8 文档版本校验

`audesys build` 时校验项目 version 与 docs/book.toml 版本一致，不一致则警告。

### 24.9 随黑盒交付

厂商 binary 包内含预构建 docs/book/html/，客户 Studio 加载黑盒包时自动索引文档，右键 "查看文档" 可用。

---

## 新增决策记录 (§24)

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | 文档随代码版本化: docs/ 目录，mdbook + 自动生成 | ✅ 确认 |
| — | 两套产物: .json (Studio 内联) + .md (mdbook 手册) | ✅ 确认 |
| — | 多渠道发布: Studio + Panel + Field + Cloud + audesys.io | ✅ 确认 |
| — | audesys-docs Theia 扩展: DocsPanel + FbdDocsProvider + SignalDocsProvider | ✅ 确认 |
| — | 黑盒包内含预构建文档，客户 Studio 自动索引 | ✅ 确认 |
## §25 配方管理 (Recipe Management)

### 25.1 配方即参数集

TOML 格式，版本化，审批流：draft → review → approved → active → archived。

```toml
# recipes/standard-batch.toml
[recipe]
name = "standard-batch"
version = "2.1"
status = "approved"
[params]
mixer.speed = 1200
heater.setpoint = 185.0
[signals]
"mixer.speed" = "mixer.velocity_setpoint"
[validation]
"mixer.speed" = { min = 500, max = 3000 }
```

### 25.2 FBD 集成

标准 `RecipeLoad` FB：选配方名 → trigger → 自动将参数写入 HAL 信号。支持 busy/done/error 状态输出。

### 25.3 Studio Recipe Manager

树形视图 + 版本对比 + 审批状态管理 + 下载/上传控制器。已激活配方不可直接编辑，必须创建新版本。所有变更记录到审计日志。

---

## §26 告警管理 (ISA-18.2)

### 26.1 告警生命周期

正常 → 激活(未确认) → 确认(已确认) → 恢复正常 → 清除。

### 26.2 告警属性

HI_HI / HI / LO / LO_LO / DEV 五种类型。属性：signal, limit, deadband, on_delay, off_delay, priority (CRITICAL/HIGH/MEDIUM/LOW), message, consequence, corrective_action, area, shelving, suppression。

### 26.3 优先级与速率限制

| 优先级 | 速率 | 颜色 | 响应 |
|--------|:---:|:---:|:---:|
| CRITICAL | <5/min | 🔴 | <1min |
| HIGH | <10/min | 🟠 | <5min |
| MEDIUM | <20/min | 🟡 | <15min |
| LOW | <50/min | 🔵 | <60min |

ISA-18.2 要求操作员每小时不超过 150 条告警。

### 26.4 标准告警 FB

`Alarm_HI_HI`, `Alarm_HI`, `Alarm_LO`, `Alarm_LO_LO`, `Alarm_DEV` — 可直接拖入 FBD。

### 26.5 告警面板

活动告警列表 + 详情面板 + 确认/搁置/抑制操作。支持告警洪水检测 (>10/min)。告警归档 + ISA-18.2 合规报告。

---

## §27 审计追踪 (21 CFR Part 11)

### 27.1 审计事件

所有操作均记录：配置变更、程序变更、操作动作、参数写入、用户管理、安全事件、系统事件。

格式：`{when, who, role, node, action, target, detail, result, signature}`。

### 27.2 防篡改

SHA256 链式哈希。Edge SQLite(90天) → 批量上报 Cloud (不可变存储)。哈希链验证检测篡改。

### 27.3 电子签名

部署生产、修改配方、安全参数、旁路互锁 → 需二次密码确认。

### 27.4 合规报告

审计摘要 (PDF) + 原始数据 (CSV) + 哈希链验证 + 21 CFR Part 11 合规声明。

---

## §28 控制器冗余

### 28.1 Hot Standby

每 RT 周期同步 HAL 信号快照 + VM 程序计数器 + 告警状态。心跳 1ms，超时 3ms 自动切换。输出无扰切换（PID 积分项保留）。

### 28.2 分裂脑防护

双通道检测：专用心跳网线 + 共享 I/O 总线仲裁。I/O 同一时刻只接受一个控制器的写入。

### 28.3 配置

```toml
[agents.redundancy]
mode = "hot-standby"
heartbeat = "1ms"
failover_timeout = "3ms"
sync = "every-cycle"
```

### 28.4 场景矩阵

CNC: Hot Standby 每 100μs。AGV: Hot Standby 每 1ms。过程控制: Warm Standby 每秒。小型 PLC: 无需冗余。

---

## §29 时间同步 (PTP / IEEE 1588)

### 29.1 精度要求

| 场景 | 精度 | 协议 |
|------|:---:|------|
| CNC 多轴 | <1μs | EtherCAT DC |
| AGV 多车 | <100μs | PTP |
| Field | <1ms | PTP/NTP |
| Cloud | <10ms | NTP |

### 29.2 拓扑

GPS Grandmaster → PTP Switch → Field (Boundary Clock) → Agent (Ordinary Clock) → 设备 (EtherCAT DC)。

### 29.3 降级

GPS 丢失 → 本地振荡器 (<1μs/s)。无 PTP HW → 软件 PTP (<100μs)。→ NTP (<10ms)。全离线 → 记录时钟偏差。

### 29.4 MCAP 时间戳

同步精度 <100μs → 事件关联可靠 → 回放时跨设备时序准确。

---

## §30 数字孪生

### 30.1 复用现有能力

数字孪生 = 同一份 robot.toml + programs + params → 跑在 SimulationHarness 上。不新建任何代码，只换 IoDrivers 为虚拟驱动。

### 30.2 三种模式

Mode 1: 实时影子 (物理→数字单向同步)。Mode 2: 虚拟调试 (纯数字，硬件到货前测试)。Mode 3: 假设推演 (修改参数→模拟→对比)。

### 30.3 Studio 操作

右键物理设备 → "Create Digital Twin" → 侧边对比视图。What-if: 修改参数 → 批量模拟 → 对比 → 批准变更 → 部署到物理。

### 30.4 实现

孪生在 Field 上作为容器运行，与物理设备共享同一份 HalProgram，但 IoDrivers 替换为虚拟实现。多个孪生可并行运行用于参数方案对比。

---

## 新增决策记录 (§25-§30)

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | 配方管理: TOML + 审批流 + RecipeLoad FB + Studio Recipe Manager | ✅ 确认 |
| — | 告警管理: ISA-18.2 标准, 5 种 Alarm FB, 优先级+速率限制 | ✅ 确认 |
| — | 审计追踪: SHA256 链式哈希, 电子签名, 21 CFR Part 11 合规 | ✅ 确认 |
| — | 控制器冗余: Hot Standby, 每周期间步, 3ms 切换, I/O 仲裁防分裂脑 | ✅ 确认 |
| — | 时间同步: PTP + GPS + EtherCAT DC 三级, 降级策略 | ✅ 确认 |
| — | 数字孪生: 复用 HalProgram, 虚拟 IoDrivers, 三种模式 | ✅ 确认 |
## §31 端侧硬件平台适配

### 31.1 五级平台

| 平台 | RAM | OS | 典型硬件 | 能跑什么 |
|------|:---:|------|------|------|
| P1: PC-GUI | 4GB+ | Linux/Win | Beckhoff IPC | Agent + Runtime + Panel + Studio |
| P2: PC-HDL | 1GB+ | Linux(RT) | Advantech 无屏 | Agent + Runtime |
| P3: SBC | 512MB+ | Linux | Raspberry Pi CM4 | Agent(轻量) + Runtime(软RT) |
| P4: MCU-H | 256KB+ | RTOS | STM32H7 | Micro-Runtime (无 Agent) |
| P5: MCU-L | <256KB | Bare metal | STM32F1, ESP32 | Nano-Runtime (预编译) |

### 31.2 架构矩阵

| | P1 | P2 | P3 | P4/P5 |
|------|:---:|:---:|:---:|:---:|
| Studio | ✅ | ❌(远程) | ❌ | ❌ |
| Panel | ✅ | ❌(远程) | ❌ | ❌ |
| Agent | ✅ 完整 | ✅ 完整 | ✅ 轻量 | ❌ |
| Runtime | ✅ 硬RT | ✅ 硬RT | ⚠️ 软RT | ✅ 裁剪 |
| Containers | ✅ Podman | ✅ Podman | ⚠️ | ❌ |
| Safety Zone | ✅ 独立线程 | ✅ 独立线程 | ⚠️ 软RT | ❌(外部) |

### 31.3 MCU 不作为独立节点

P4/P5 MCU 是现场设备，被 PC 上的 IoDriver 通过 EtherCAT/CANopen/Modbus 管理。不跑 Agent。

### 31.4 Runtime 分层编译

```rust
[features]
full = ["hal-vm", "safety", "hot-swap"]
pc-rt = ["full", "preempt-rt"]
sbc = ["hal-vm", "safety", "soft-rt"]
mcu-h = ["hal-vm-lite", "no-std"]
mcu-l = ["pre-compiled", "no-std", "fixed-io"]
```

---

## §32 Agent + Panel + Runtime 部署形态

### 32.1 五种模式

| 模式 | Studio | Agent | Runtime | Panel | 用途 | 对标 |
|------|:---:|:---:|:---:|:---:|------|------|
| A: 开发 | ✅ | ✅ | ✅ | ✅ | 工程师站 | LabVIEW Dev |
| B: 运行 | ❌ | ✅ | ✅ | ✅ | 操作站 | LabVIEW Runtime |
| C: 瘦端 | ❌ | ❌ | ❌ | ✅ | 移动平板 | Ignition Perspective |
| D: 调试 | ❌ | ✅ | ✅(Sim) | ✅ | 现场调试 | LabVIEW+DAQ |
| E: 部署 | ❌ | ✅ | ✅ | ❌ | 无头AGV | ROS2 headless |

### 32.2 模式 B: 操作站 / 上位机

Panel + Agent + Runtime 作为组态软件运行站。连接多台设备的 Agent，监控+操作，不运行自己的控制逻辑。

### 32.3 模式 C: 移动瘦端

Panel 作为 PWA 运行在手机/平板上。通过 WebSocket 连接 Field，只显示 HMI，无 Agent/Runtime。

### 32.4 模式 D: 调试工具

Agent + Runtime(SimHarness) + Panel(调试视图) 作为现场调试平板。离线仿真或在线监控+强制写入+MCAP 录包。

### 32.5 Panel 技术实现

Tauri (桌面, 全功能) + PWA (移动, 零安装) + Docker (Kiosk, 信息看板)。

---

## §33 Panel SCADA/HMI 全貌

### 33.1 SCADA 对标

| | Ignition | WinCC | InTouch | AUDESYS Panel |
|------|:---:|:---:|:---:|:---:|
| 技术基座 | Java+Web | Win32+Web | Win32+OMI | PWA+Tauri |
| 跨平台 | ✅ 浏览器 | ❌ | ❌ | ✅ 全平台 |
| 离线运行 | ❌ | ✅ | ✅ | ✅ Agent 本地 |
| 开发体验 | Designer | TIA Portal | WindowMaker | Studio FBD+拖拽 |
| 编程 | Python | C/VB | QuickScript | ST/Python/TS |
| 连接 | OPC UA,MQTT | Siemens 私有 | OPC | Zenoh+OPC UA+MQTT |
| 开放度 | ⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |

### 33.2 Widget 体系

现有 7 个：Gauge, Trend, Tank, Indicator, Button, Display, Text。

新增：AlarmViewer, RecipeSelector, SecurityLogin, AuditLogViewer, MultiScreenNav, SignalForcePanel, CameraView, ReportViewer, Scheduler。

### 33.3 多屏支持

同一台 PC 多屏 = 多个 Panel 进程（共享本地 Agent），同步刷新 <50ms。

### 33.4 Panel Designer (Studio 内)

拖拽 Widget → 绑定信号（从 Signal Browser 拖入）→ 配置属性 → 预览（响应式）→ 部署。

### 33.5 Panel 作为独立产品

- PWA: URL 访问，零安装，自动更新
- Tauri: Windows/macOS/Linux 安装包
- Docker: Kiosk 全屏模式
- 首次启动 → 输入 Field 地址 → 选择设备 → 自动加载 HMI 布局 → 运行

---

## 新增决策记录 (§31-§33)

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | 端侧五级平台: P1(PC+GUI) ~ P5(MCU-L), MCU 不作独立 Agent 节点 | ✅ 确认 |
| — | Runtime 分层编译: full/pc-rt/sbc/mcu-h/mcu-l 五级 feature | ✅ 确认 |
| — | Panel 五种部署模式: 开发/运行/瘦端/调试/部署 | ✅ 确认 |
| — | Panel 跨平台: Tauri(桌面) + PWA(移动) + Docker(Kiosk) | ✅ 确认 |
| — | Panel HMI Widget 体系: 7 现有 + 9 新增 | ✅ 确认 |
| — | Panel Designer: Studio 内拖拽设计, 信号拖拽绑定, 响应式预览 | ✅ 确认 |

## 最终命名体系确认

| 层 | 命名 | 曾用名 | 职责 |
|------|------|------|------|
| 车/设备端管理 | **Agent** | Agent | 进程管控、容器管理、Field 连接 |
| 车/设备端执行 | **Runtime** | Controller | RT 执行、IO 驱动、安全 |
| 场站端 | **Field** | Station | 多车调度、网关、低代码 |
| 云端 | **Cloud** | Cloud | 仪表板、数据湖、OTA |
> 注: §34-§37 已调整为 §42-§45 (测试策略/CI-CD/开源治理/商业模式)

## §38 Studio 对 Hub 的二开能力

### 38.1 Hub 可编程内容

Studio 对 Hub 提供与 Device 同等的开发体验：FBD 调度逻辑、Schema Designer（低代码 CRUD）、Python/TS 定制应用、HMI 看板。

### 38.2 Studio 内 Hub 开发

FBD Editor (fleet-manager 调度) + Schema Designer (数据模型) + Python/TS Editor (定制应用) + HMI Designer (场端看板)。统一部署到 Hub。

---

## §39 跨仓库 Hub 编排与二开

Factory 工程通过依赖声明引用 Hub 包。Studio 自动解析、下载、缓存。客户二开代码在本仓库，部署时 merge 到 Hub。

---

## §40 Studio 双形态

| | Desktop Studio | Web Studio (Hub 插件) |
|------|------|------|
| 对标 | CODESYS IDE | CODESYS Automation Server + Ignition Perspective |
| 离线 | ✅ | ❌ (需 Hub) |
| 独有 | 项目创建、硬件配置、Gazebo仿真、MCAP离线分析 | Dashboard、Fleet Manager、Schema Designer、OTA管理 |
| 共有 | FBD/LD/SFC/ST/Python 编辑、Signal Browser、Scope View、编译部署、断点调试 | 同 |
| 编译器 | napi-rs (Rust native) | WASM (同一套 Rust crate) |

Desktop 用于全量开发，Web 用于在线二开+监控+调试。

---

## §41 统一平台 AUDESYS Hub

### 41.1 设计理念

Hub 是插件化统一平台，通过 role 配置实现 Field/Cloud/Standalone 三种角色。对标群晖 NAS 的套件中心模式。

### 41.2 三种角色

| | Field 角色 | Cloud 角色 | Standalone |
|------|:---:|:---:|:---:|
| 部署位置 | 工厂现场 | 云端 | 单机 |
| 核心插件 | fleet-manager(local), opcua-gateway | fleet-manager(global), data-lake, analytics, ota-publisher | 两者合并 |
| 层级 | 向上聚合到 Cloud Hub | 向下聚合 Field Hub | 无层级 |

### 41.3 插件体系

Base Platform (Agent + Plugin Manager + Auth + API Gateway) + Plugin Marketplace (fleet-manager, dashboard, schema-engine, data-lake, analytics, opcua-gateway, edge-connector, ota-publisher, alerts, user-management)。

### 41.4 层级聚合

Global Hub(Cloud) → edge-connector → Regional Hub(Field) → Agent → Runtime。深度不限。

### 41.5 仓库

```
audesys/        ← Rust 核心 (Agent, Runtime, 编译器, Studio Desktop)
audesys-hub/    ← Hub 平台 (platform + plugins + profiles)
```

---

## §42 测试策略

L0 单元(已有) → L1 组件(VirtualIoDriver) → L2 集成(Agent+Runtime+Field) → L3 仿真(SimHarness+Gazebo) → L4 HIL(Phase 3)。CI: qa-fast(2min)/qa-full(10min)/qa-deep(release)。

## §43 CI/CD

audesys/ 多平台构建 (x86_64/aarch64/thumbv7em/apple-darwin)。audesys-hub/ 容器构建 + push ghcr.io。共享 audesys-types crate。

## §44 开源治理

Apache 2.0 核心 + MIT SDK。RFC → PR → Review → Merge。社区插件 → audesys.io marketplace。

## §45 商业模式

Open Core: 核心开源免费。Cloud SaaS (免费 5 设备/Pro 50/Enterprise 无限)。企业功能: 21 CFR 11 审计、Hot Standby、SIL 2 认证。Marketplace 交易抽成。

---

## 最终命名体系

| 层 | 命名 | 曾用名 |
|------|------|------|
| 车端管理 | Agent | Agent |
| 实时执行 | Runtime | Controller |
| 统一平台 | Hub | Field + Cloud |
| 桌面 IDE | Studio Desktop | Studio |
| Web IDE | Studio Web | — |
| HMI 界面 | Panel | Panel |

## 最终仓库结构

```
audesys/          ← Rust 核心 (Agent, Runtime, 编译器, Studio Desktop)
audesys-hub/       ← Hub 平台 (platform + plugins + profiles)
```

## 新增决策记录 (§38-§45)

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | Studio 双形态: Desktop (CODESYS IDE) + Web (Hub 插件) | ✅ 确认 |
| — | 编译器 WASM 共享: 同一套 Rust crate, Desktop 用 napi-rs, Web 用 WASM | ✅ 确认 |
| — | Hub 统一平台: 插件化 + 角色配置 + 层级聚合, 对标群晖套件中心 | ✅ 确认 |
| — | Hub 三种角色: Field / Cloud / Standalone | ✅ 确认 |
| — | 仓库: audesys/(Rust核心) + audesys-hub/(平台) | ✅ 确认 |
| — | 开源: Apache 2.0 Open Core + Cloud SaaS | ✅ 确认 |
| — | 测试五级: 单元/组件/集成/仿真/HIL | ✅ 确认 |
| — | CI/CD: 多架构构建 + 容器推送 | ✅ 确认 |
## §46 实施里程碑

### M1: 3D打印机控制器 (~8周)

以光固化打印机为第一个实战项目，验证 IEC 61131-3 + HMI + 硬件 IO 全链路。

| 子任务 | 内容 | 周 |
|------|------|:---:|
| M1.0 | Agent + Runtime 联调 (Agent→Agent改名, IPC验证, 硬件部署) | 1 |
| M1.1 | ST 端到端 (温度PID/电机控制, 编译, 部署, 仿真, 调试) | 1 |
| M1.2 | FBD 端到端 (安全联锁, FBD调试, ST+FBD混合联调) | 1 |
| M1.3 | SFC + G-code 端到端 (打印流程SFC, G-code解析, 仿真) | 1 |
| M1.4 | HMI 设计与联调 (打印面板, 信号绑定, CameraView, Panel发布) | 1 |
| M1.5 | 硬件 IO 联调 (485 Modbus, Camera, HDMI, 配方, 真机打印) | 1-2 |
| M1.6 | 收尾 (MCAP录制, 故障注入, E2E测试, 文档) | 1 |

### M2: Hub 平台 (~6周)

插件化统一平台，Dashboard + 单设备监控 + Agent↔Hub 通信。

### M3: 巡逻车 (~8-10周)

移动机器人验证：ROS2桥接、SLAM+导航、移动底盘运动学、避障、Hub远程监控。

### M4: 多机协同 (~8周)

fleet-manager多机调度、OPC UA Gateway、Schema Engine、多Agent管理。

### M5: 云端+企业 (~10周)

Cloud profile、Data Lake、Analytics、OTA、21 CFR 11审计、Hot Standby、层级聚合。

### M6: 生态 (持续)

Plugin Marketplace、SDK+CLI、文档站、第三方IoDriver、社区治理。

---

## 新增决策记录 (§46)

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | 以光固化打印机为 M1 驱动力，验证 IEC 61131-3 + HMI + 硬件 IO | ✅ 确认 |
| — | M1 细分为 7 个子任务: Agent→ST→FBD→SFC→HMI→IO→收尾 | ✅ 确认 |
| — | M2(巡逻车) 验证 ROS2 桥接 + SLAM + 导航 + 移动底盘 | ✅ 确认 |
| — | M2-M6 按 Hub → 巡逻车 → 多机 → 云端 → 生态 推进 | ✅ 确认 |

---

## §47 Studio 技术基座: Eclipse Theia

**来源**: `docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md` (D71)  
**状态**: 迁移完成 (2026-07-21)

### 47.1 决策背景

Studio 从 Tauri+React 自建架构迁移到 Eclipse Theia。关键理由：

| 因素 | 说明 |
|------|------|
| Neuron 验证 | logi.cals/Neuron Automation 基于 Theia+GLSP 构建 IEC 61131-3 IDE，生产环境运行 |
| VS Code 扩展兼容 | API 1.116.0 兼容，可使用 Open VSX 生态 |
| GLSP 图形编辑器 | 官方支持 LD/FBD 图形编辑器 |
| 13/16 通用 IDE 功能 | Dock/Tab/命令面板/快捷键/主题等无需自研 |
| 厂商中立 | Eclipse 基金会治理，TI/ST/Arm/Samsung 已基于 Theia 构建产品 |

放弃 Tauri 自建的原因：13/16 项通用 IDE 功能需从零实现，AI 生成 UI 质量不稳定，无 VS Code 扩展生态。

### 47.2 架构

```
┌─ AUDESYS Studio (Theia) ────────────────────────────────────┐
│                                                                │
│  ┌─ Theia Frontend (Electron Renderer / Browser) ──────────┐ │
│  │  Monaco Editor │ GLSP Editor │ React Widgets │ Widgets  │ │
│  │  (ST/IL/G-code)│ (LD/FBD)    │ (HMI/Scope)   │ (Tree)   │ │
│  └────────────────────┬─────────────────────────────────────┘ │
│                       │ JSON-RPC (WebSocket)                  │
│  ┌─ Theia Backend (Node.js) ────────────────────────────────┐ │
│  │  napi-rs Bridge ← Rust IPC │ Rust Compiler (6 语言+CNC)  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ Plugin Host (Node.js 子进程) ────────────────────────────┐ │
│  │  Open VSX Extensions: LSP servers, 调试器, 主题, Git 工具  │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 47.3 napi-rs Bridge

Rust 后端通过 napi-rs 编译为 `.node` 原生 addon，由 Theia Backend Service 加载。

**保留不变的 Rust 代码**：
- 所有编译器（ST/IL/LD/FBD/SFC/G-code）
- IPC Server（UDS 协议 0x01-0x17）
- Runtime Engine（5 步周期引擎）
- Agent（子进程编排，原 Supervisor）
- Modbus/HART 适配器
- SimulationHarness

**需适配**（~50% 代码修改）：
- 34 个 Tauri 命令 → 重写为 ~25 个 napi-rs 函数
- Cargo.toml napi-rs 构建配置
- Controller 生命周期适配

### 47.4 安全

- `contextIsolation: true` — 渲染进程无法直接访问 Node.js
- `nodeIntegration: false` — 禁止渲染进程 require()
- napi-rs 调用前：JSON Schema 参数校验 + RBAC 角色检查 + Rate limiting (编译:10/min, 信号:1000/min)
- Open VSX 扩展白名单（Phase 1: 0 第三方扩展），Plugin Host 无本地文件系统写权限

### 47.5 Studio 双形态

| | Desktop Studio | Web Studio |
|------|------|------|
| 技术 | Theia (Electron) + napi-rs | Hub 插件，Monaco + WASM 编译器 |
| 离线 | ✅ | ❌ |
| 用途 | 全量开发 + 仿真 | 在线二开 + 监控 |

### 参考

- 决策 D71: Studio 技术栈迁移 Tauri→Theia
- 实施历史: `docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md` (408 行, 已吸收)
- 迁移指南: `docs/guides/migration-tauri-to-theia.md`

## 新增决策记录

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | Theia 迁移文档已全文吸收到 §47，原文档标记为历史参考 | ✅ 完成 |

---

## §48 M1 实施细节

### 48.1 M1.0: Supervisor → Agent 改名
- 复制 `crates/audesys-supervisor/` → `crates/audesys-agent/`
- 仅改 `Cargo.toml` name 字段，更新根 workspace members
- `cargo build -p audesys-agent` + `cargo test -p audesys-agent` 验证
- 无外部依赖方，零风险

### 48.2 M1.1: ST 语言端到端
- 已有编译器: `audesys-hal-binding-gen` (ST compiler)
- 编写: 温度 PID 程序 + 伺服电机控制程序
- SimHarness 仿真 → Scope View 观测 → 真实 IO 联调

### 48.3 M1.2: FBD 语言端到端
- 已有编译器: `audesys-fbd-compiler`
- 编写: 安全联锁 (急停+门禁+过热)
- ST+FBD 混合部署验证

### 48.4 M1.3: SFC + G-code
- 已有编译器: `audesys-sfc-compiler`, `audesys-gcode-compiler`
- SFC: 预热→打印→后处理→冷却 流程
- G-code: M106, G1 等指令解析执行

### 48.5 M1.4: HMI
- 已有: HMI Designer (7 widget)
- 新增: CameraView widget (StreamChannel → MJPEG)
- 面板: Gauge(温度) + Trend(进度) + CameraView + Button(控制) + Recipe 选择

### 48.6 M1.5: 硬件 IO
- 已有: `audesys-modbus` (Modbus RTU)
- robot.toml: 485 设备配置 (光源PWM 地址0x01, 伺服电机 地址0x02)
- Camera StreamChannel + HDMI 光机控制 + 配方管理

### 48.7 M1.6: 收尾
- MCAP 录制全打印周期 → 回放
- 故障注入 (Modbus超时, Camera断开)
- E2E: 编译→deploy→完整打印周期
- qa-fast 门禁全绿

### 风险摘要
- 🔴 Agent 改名回归、485 不兼容、Camera 延迟
- 🟠 ST+FBD 混合编译、SFC+G-code 时序、Panel 轮询延迟
- 🟡 CameraView 新 widget、HDMI 输出
- 所有风险有缓解策略 (详见风险分析)


---

## §49 M1 详细实施计划

### 49.1 工作量总览

| 子任务 | 任务数 | 测试数 | 工时 |
|------|:---:|:---:|:---:|
| M1.0 Agent改名 | 17 | 3 现有 | ~2h |
| M1.1 ST端到端 | 11 | 11 新增 | ~12h |
| M1.2 FBD端到端 | 5 | 12 TDD | ~17h |
| M1.3 SFC+G-code | 7 | 18 TDD | ~24h |
| M1.4 HMI | 8 | Playwright | 11.5h |
| M1.5 硬件IO | 7 | 硬件测试 | 11.5h |
| M1.6 收尾 | 22 E2E | 10 故障 | ~10h |

### 49.2 M1.0 Agent改名 (17任务, ~2h)

Supervisor→Agent：目录重命名、Cargo.toml更新、workspace members、12文件 Super/Config 常量→AgentConfig、ipc_integration_test 二进制路径更新、Role::Supervisor不变(角色名)、全仓库 audit、qa-fast验证。

### 49.3 M1.1 ST端到端 (11任务, ~12h)

已有90%管道就绪(pipeline_test.rs)。补: TON功能块、全类型算术、控制流、信号自动绑定、IPC部署路径、编译错误6类、多函数、Hot-swap、bridge smoke、性能基准。

### 49.4 M1.2-M1.3 FBD+SFC (12 SDD, 30 TDD, ~41h)

- FBD: 安全联锁、SR/RS自锁、merge_programs()新API、信号隔离、debug_map
- SFC: 5步序列、ON TIMEOUT新语法、异常分支、ExecSub新opcode
- G-code: M106/M107 FanControl、G1边界

### 49.5 M1.4 HMI (8任务, 11.5h)

CameraView新widget(MJPEG 30fps 6状态)、Gauge/Trend/Button打印面板、信号绑定、Recipe选择、响应式2分辨率、Playwright E2E。

### 49.6 M1.5 硬件IO (7任务, 11.5h)

robot.toml Modbus RTU配置(光源0x01+伺服0x02)、Camera StreamChannel、HDMI输出、配方TOML、真机打印测试。

### 49.7 M1.6 收尾 (22 E2E + 10 故障, ~10h)

- E2E: 正常打印6场、故障注入7场、MCAP 5场、跨任务集成5场
- DoD: 每子任务5-12项可验证检查
- qa-fast 11门禁(新增E2E/故障/MCAP/SDD追溯/性能/MODACS)

### 49.8 新API/Opcode

| API | 用途 | 复杂度 |
|------|------|:---:|
| merge_programs() | ST+FBD程序合并 | Medium |
| ExecSub | SFC子VM调用G-code | High |
| ON TIMEOUT | SFC超时分支 | High |
| FanControl | G-code M106/M107 | Medium |

### 49.9 产出文件

| 文件 | 行数 |
|------|:---:|
| sdd-m1.2-m1.3.md | 514 |
| acceptance-m1.4-m1.5.md | 760 |
| e2e-qa-plan.md | 334 |
| qa-fast-m1-gate.sh | 109 |
| check-sdd-traceability.sh | 43 |


---

## §50 许可管理

M5 商业化需求。产品激活与 License 管理。

**License 类型**: Community(免费,5设备,7天数据) / Pro(按设备计费,90天) / Enterprise(无限,私有部署)

**实现**: License Key(JWT) → Hub验证 → 启用功能。离线30天宽限期，超期降级。硬件绑定(CPU ID+MAC)防复制。

---

## §51 安全启动

M3+ 硬件安全。设备启动链完整性验证：BootROM → Verified Bootloader → Agent → Runtime。

**实现**: TPM 2.0/HSM存储根密钥，dm-verity文件系统完整性，Measured Boot PCR启动度量。篡改→告警+拒绝启动。

---

## §52 合规认证路径

M5+ 产品认证。目标: CE(EMC+机械安全)/FCC(电磁兼容)/UL(电气安全)/ATEX(防爆,选配)。

**前置**: IEC 61508 SIL 2 + ISO 13849 PL d + 21 CFR Part 11 + ISO 10218 机器人安全。

---

## 新增决策记录

| ID | 决策 | 状态 |
|:---|------|:---:|
| — | 许可管理: JWT License Key + 硬件绑定 + 离线宽限 + 分层定价 | ✅ 确认 |
| — | 安全启动: TPM/HSM + dm-verity + Measured Boot 启动链 | ✅ 确认 |
| — | 合规认证: CE/FCC/UL/ATEX + IEC 61508 SIL 2 前置 | ✅ 确认 |

---

## §53 嵌入式参考吸收

### 53.1 Klipper → Agent↔Runtime 验证

Klipper 的 Host-MCU 架构（管理层与执行层分离 + 串行通信）验证了 AUDESYS Agent↔Runtime UDS IPC 范式的可行性。M1.0 Agent 改名即是此模型的现代化 Rust 实现。

### 53.2 SimpleFOC → FOC_Motor FB

标准 `FOC_Motor` 功能块（M3+）：Clarke→Park→PID→SVPWM 变换。M1 打印机用简单 PID，M3 机械臂/AGV 可无缝切换为 FOC_Motor FB。

### 53.3 FluidNC → robot.toml 嵌入式可行性

FluidNC 证明 YAML 配置可在 ESP32 低资源 MCU 上解析，验证了 AUDESYS robot.toml 在嵌入式平台的可行路径。4 种步进引擎可插拔模式对应 IoDriver trait。

### 53.4 参考验证统计

| 类别 | 吸收率 |
|------|:---:|
| 工业平台/SCADA/机器人 | 89% (87/98) |
| 嵌入式/3D打印 | 60% (6/10 直接吸收) |
| 合计 | ~85% |

