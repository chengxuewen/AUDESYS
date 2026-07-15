> 拆分自 docs/hal-detailed-design.md（2026-07-15）

## 11. 移植对接方案

每个被移植的系统功能根据自己的通信特征选择最合适的原语。下面描述"移植后的功能如何对接 AUDESYS HAL"——不是桥接外部协议。

### 11.1 移植 LinuxCNC 功能

LinuxCNC 的 HAL 和 AUDESYS HAL 高度同构（都是单写多读 Signal + 线程函数调度）。

```
LinuxCNC motion planner (移植为 AUDESYS Component)
  │
  │  pin: axis.0.position  (F64, OUT)  →  AUDESYS Signal "motion.axis.0.pos"
  │  pin: axis.0.enable    (Bool, IN)  →  AUDESYS Signal "motion.axis.0.enable"
  │  pin: axis.0.velocity  (F64, OUT)  →  AUDESYS Signal "motion.axis.0.vel"
  │
  │  function: servo-thread.update()   →  AUDESYS RT thread 调度表
  │    ┌─ read IN pins
  │    ├─ compute
  │    └─ write OUT pins
  │
  │  halcmd commands (load/unload/link/...)
  │    →  AUDESYS RPC: loadComponent / linkPin / addThread
```

- Signal 1:1 映射（LinuxCNC pin → AUDESYS Signal）
- LinuxCNC function list → AUDESYS RT 线程 `update()` 调度表
- LinuxCNC halcmd → AUDESYS RPC

| LinuxCNC halcmd | AUDESYS HAL | 说明 |
|---|---|---|
| `halcmd loadrt comp` | RPC `loadComponent(name, type, config)` | 加载实时组件 |
| `halcmd addf comp.func thread` | RPC `addFunction(component, func, thread)` | 函数加入 RT 线程 |
| `halcmd delf comp.func thread` | RPC `removeFunction(component, func, thread)` | 从线程移除函数 |
| `halcmd net sig pin1 pin2` | RPC `newSignal(name)` + `linkPin(pin, sig)` (×2) | 创建信号并连接 Pin |
| `halcmd setp pin value` | RPC `configureComponent(name, {pin: value})` | 设置 Pin 值 |
| `halcmd show thread` | RPC `getSnapshot` → `threads[].metrics` | 查看 RT 线程状态 |
| `halcmd show signal` | RPC `getSnapshot` → `signals[]` | 查看所有信号 |
| `halcmd start` / `halcmd stop` | RPC `activateComponent` / `deactivateComponent` | 启停组件 |
| `halcmd loadusr prog` | Supervisor 子进程启动 | 用户态辅助程序 |
| `halcmd unloadrt comp` | RPC `unloadComponent(name)` | 卸载组件 |

### 11.2 移植 OpenPLC 功能

OpenPLC 以扫描周期为单位运行，不适合逐 pin 映射。

```
OpenPLC IEC runtime (移植为 AUDESYS Component)
  │
  │  Task Main: 周期 10ms
  │
  │  扫描前:
  │    Signal<Array<S32>> "plc.rack0.input_image"   ← 从 I/O 驱动批量读入
  │                                    (1024 个 S32 = 4KB, 一次 Signal update)
  │
  │  执行:
  │    IEC 程序读写 %IW0..%IW1023, %QW0..%QW1023
  │    (内部通过直接内存访问 image table, 不穿越 HAL)
  │
  │  扫描后:
  │    Signal<Array<S32>> "plc.rack0.output_image"  → 写入 I/O 驱动
  │
  │  单点 I/O 监控 (选配):
  │    Signal<Bool> "plc.rack0.slot3.di5"           ← 单个数字输入
  │    (从 image table 提取, 供 HMI/SCADA 使用)
```

- 扫描周期的整表 I/O：`Array<S32>` 批量传输（2 条消息/周期，而非 8192 条）
- 单点监控（HMI 用）：从 image table 提取为独立 Signal（按需，非默认）
- IEC 程序内部：直接内存访问 image table，不穿越 HAL（最大性能）

### 11.3 移植 ROS2 功能

ROS2 有三种通信模式，分别映射到 AUDESYS 的三种原语：

```
ROS2 移植节点
  │
  ├── topic /scan (sensor_msgs/LaserScan, 40Hz, ~4KB/frame)
  │     →  StreamChannel<Array<F32>> "lidar.scan.ranges"
  │        理由: 高频、中大数据、多消费者可能
  │
  ├── topic /cmd_vel (geometry_msgs/Twist, 20Hz, 48 bytes)
  │     →  Signal "robot.cmd_vel"  (6 个 F64 的 struct)
  │        理由: 低频、小消息、单生产者、只需要最新值
  │
  ├── topic /joint_states (sensor_msgs/JointState, 100Hz)
  │     →  StreamChannel<Array<F64>> "robot.joint_states"
  │        理由: 高频、批量数组、需要完整时间序列
  │
  └── service /get_map (nav_msgs/GetMap, ~10s 一次, 响应 MB 级)
        →  RPC "get_map" → Blob (地图数据)
           理由: 请求/回复语义、低频、大载荷
```

- 控制类 topic（低速、值更新）：**Signal**
- 感知类 topic（高频、批量、大消息）：**StreamChannel**
- Service：**RPC**

### 11.4 移植 dora-rs 功能

dora-rs 的数据流模型直接映射：

```
dora 风格 operator (移植为 AUDESYS Component)
  │
  ├── 输入 stream: camera/image (Arrow IPC buffer, ~2MB/frame, 30Hz)
  │     →  StreamChannel<Blob> "camera.image"
  │        理由: 大载荷、零拷贝、需要缓冲
  │
  ├── 输出 stream: detection/bboxes (Array<F32>, ~1KB/frame)
  │     →  StreamChannel<Array<F32>> "detection.bboxes"
  │        理由: 批量输出、下游可能有多个消费者
  │
  └── 配置: runtime parameters (threshold, model_path)
        →  Signal<F32> "detector.confidence_threshold"
        →  Signal<Blob> "detector.model_path" (read-only, 启动时设置)
```

- Arrow buffer → `Blob`（零拷贝传递，HAL 不解析 Arrow 格式）
- 结构化输出 → `Array<F32>`
- 运行参数 → `Signal`（单值，最新值覆盖，支持变更通知）

### 11.5 多语言延迟预算

| 语言 | API 绑定 | Signal (延迟) | StreamChannel (延迟) | 适用场景 |
|------|---------|:---:|:---:|------|
| **Rust** | 原生 Typed API | < 1μs | 0 开销 | RT 控制 (Controller, Driver) |
| **C/C++** | FFI | 1–5μs | +5μs | RT 控制 / 遗留代码移植 |
| **Node.js** | napi-rs | 10–50μs | +50μs | 配置面 (Supervisor), HMI (Panel) |
| **Python** | PyO3 + numpy memoryview | 50–500μs | +100μs | SCADA 监控, 离线分析, 数据科学 |

**说明**：Python 延迟来自 GIL + PyO3 调用开销。StreamChannel 高吞吐（> 100 MB/s）场景建议 Rust/C++ 消费端，Python 仅用于低频监控。numpy memoryview 零拷贝路径可避免逐元素 Python 对象分配。

---