# AUDESYS MVP 状态与架构分析

> 更新日期：2026-07-17
> 状态：MVP 核心功能已完成，正在规划 Studio ↔ Controller 集成

---

## 0. 概览

MVP 已从初始 P0 计划（仅 CI 基础设施）实质性演进为全栈原型：

| 模块 | 状态 | 关键能力 |
|------|:----:|----------|
| **ST 编译器** | ✅ | 词法→解析→类型检查→代码生成，25 IEC 类型（含 6 定时器/计数器），7 控制流，30 VM 操作码 |
| **HAL IR/VM** | ✅ | 寄存器 VM，定时器（TON/TOF/TP），计数器（CTU/CTD/CTUD），函数调用栈，数组 |
| **Runtime Engine** | ✅ | 5 步周期引擎（Config Barrier→Read→Compute→VM→Write），信号注册表，原子度量 |
| **Supervisor** | ✅ | 子进程编排，指数退避重启（3重试），进程状态通过 UDS 推送 |
| **IPC Server** | ✅ | 6 方法 UDS 协议，HMAC-SHA256 认证，5 角色 RBAC |
| **Studio IDE** | ✅ | CodeMirror 6 编辑器，文件操作，Tauri 桌面应用，编译→本地执行 |
| **部署** | 🟡 | Hot-swap/OTA/config 三条路径已设计，IPC 方法待实现 |
| **调试** | ❌ | 零代码实现 — architecture.md §5 有完整设计 |
| **可观测性** | 🟡 | TCP /healthz + IPC 信号快照 + 5 原子计数器 — 日志/告警待实现 |
| **仿真** | 🟡 | InprocMiddleware 已是 MVP 仿真层 — 虚拟设备管理器为 Phase 3+ |
| **Studio ↔ Controller 联调** | ❌ | Studio 无 IPC 客户端，Controller IPC 缺少 load_program 方法 |

---

## 1. 两层项目模型

### 当前架构缺失

architecture.md §7 定义了 5 种项目类型（hmi/plc/gateway/full/custom），但缺少"固件"类型。需要新增两级模型：

### Firmware Project（固件项目）

定义控制器的运行时配置——硬件接口、通信协议、周期参数。

```yaml
project:
  type: firmware                    # 新增项目类型
  name: reactor-controller
  version: "1.0.0"
  description: "Reactor A temperature controller"

runtime:
  cycle_interval_ms: 10
  startup_lock_level: "none"
  health_port: 9100

signals:                          # 所有 I/O 接口定义
  - name: sensor.temp.pt100
    type: F32
    direction: In
    default: 25.0
  - name: valve.output.position
    type: U8
    direction: Out
    default: 0

adapters:                         # 协议适配器（D23）
  modbus:
    - connection: { type: tcp, host: "192.168.1.100", port: 502 }
      poll_interval_ms: 100
      mappings:
        - signal_name: sensor.temp.pt100
          register_type: InputRegister
          address: 100
          direction: read

components:                       # HAL 组件（ConfigCommand::LoadComponent）
  - name: pid_controller
    type: pid_v1
    config: { kp: 2.0, ki: 0.5, kd: 0.1 }

threads:                          # 线程调度（D13）
  - name: fast_loop
    priority: 90
    period_us: 1000
    functions:
      - component: pid_controller
        slot: Update
```

### Engineering Project（工程项目）

ST 应用代码，引用已部署的固件控制器。

```yaml
project:
  type: engineering                 # 新增项目类型
  name: temperature-control
  version: "1.0.0"

target:                             # 部署目标
  firmware_project: reactor-controller
  firmware_version: ">=1.0.0"
  expects_signals:                  # 信号契约——编译时验证
    - name: sensor.temp.pt100
      type: F32
      direction: In
    - name: valve.output.position
      type: U8
      direction: Out

source:
  entry: src/main.st
  files: [src/main.st, src/pid_control.st]
```

### 项目关系

```
┌─ Firmware Project ────────┐     ┌─ Engineering Project ──┐
│ • HAL 信号定义               │     │ • ST 源代码               │
│ • 协议适配器（Modbus/HART）    │───▸│ • 信号契约（expects_signals）│
│ • 周期、Pin 映射、组件配置     │     │ • 编译→部署到控制器        │
└───────────────────────────┘     └─────────────────────────┘
              │                               │
              └───── 部署捆绑包 ───────────────┘
                   .afw + .air
                        │
                        ▼
               ┌──────────────────┐
               │  Controller (运行时)│
               └──────────────────┘
```

**核心规则**：固件项目定义硬件接口，工程项目只能消费固件暴露的信号——不能新增信号或适配器。

---

## 2. Studio ↔ Controller 联调

### 当前断裂点

```
┌─ Studio ────────────────────────┐     ┌─ Controller ─────────────┐
│ ✅ compile_st() → HalProgram     │     │ ✅ Engine 5-step cycle    │
│ ✅ run_program() → local VM      │     │ ✅ load_hal_program(bytes) │
│ ❌ 无 IPC 客户端                  │     │ ❌ 无 IPC handler for     │
│ ❌ 无 deploy/connect 命令         │     │   load_program/load_config│
└─────────────────────────────────┘     └──────────────────────────┘
```

### IPC 协议现状

| 属性 | 值 |
|------|-----|
| 传输 | 抽象 UDS，同步 I/O |
| 帧格式 | `[4B len][64B token][1B method][payload]` |
| 认证 | SO_PEERCRED + HMAC-SHA256 SessionToken |
| Token TTL | Supervisor=24h，其他=1h |
| 角色 | Operator(0), Engineer(1), Supervisor(2), Auditor(3), System(4) |
| 授权 | `can_read()`/`can_write()`/`can_config()` |

**当前 6 个 IPC 方法：**

| ID | 方法 | 认证 | 授权 |
|----|------|:---:|------|
| 0x01 | AUTH_REQUEST | 否 | UID 白名单 |
| 0x02 | CONFIG_COMMAND | 是 | Engineer/Supervisor/System |
| 0x03 | READ_SIGNAL | 是 | 任意已认证角色 |
| 0x04 | WRITE_SIGNAL | 是 | Engineer/Supervisor/System |
| 0x05 | HEALTH_QUERY | 是 | 任意已认证角色 |
| 0x06 | SIGNAL_SNAPSHOT | 是 | 任意已认证角色 |

### 联调所需新增

**需要新增的 IPC 方法：**

| ID | 方法 | 用途 |
|----|------|------|
| 0x07 | LOAD_PROGRAM | 部署 ST 编译后的 HalProgram（bincode） |
| 0x08 | LOAD_HAL_CONFIG | 部署固件 YAML 配置 |

**需要新增的 Studio 模块：**

- `ControllerClient` — UDS 连接 + HMAC 认证 + 帧协议 + 所有 8 个方法
- Tauri 命令：`deploy_program`, `deploy_hal_config`, `read_controller_signal`, `write_controller_signal`, `signal_snapshot`

### 部署流程

1. Studio 连接 `/tmp/audesys-controller.sock`
2. 发送 AUTH_REQUEST（pid + Role::Engineer）
3. 接收 64B SessionToken
4. 发送 LOAD_HAL_CONFIG（固件 YAML 内容）
5. 发送 LOAD_PROGRAM（ST 编译后的 HalProgram bincode）
6. Controller 通过 Config Barrier 在周期边界应用

---

## 3. 部署功能

### 三条部署路径

| 路径 | 目标 | 机制 | 状态 |
|------|------|------|:---:|
| **Hot-swap** | 更换控制器固件 | prepare_swap → commit_swap → 失败则回滚 | 已设计，待实现 |
| **OTA** | 更新设备固件 | firmware_push → 64KB 分块 → StreamChannel → 设备 | Phase 2 |
| **Config Change** | 更新运行时参数 | YAML mtime 轮询 → diff → ConfigCommand → 周期边界 | ✅ 已实现 |

### Hot-Swap 详细流程

```
prepare_swap(ctrl_id, binary, checksum)
  → 后台加载新固件
  → SHA-256 + ABI 签名验证
  → 回复 swap_ready

commit_swap(ctrl_id)
  → 排队到 Config Barrier（下一周期边界）
  → freeze() — 停止旧控制器
  → migrate_state() — FlatBuffers 序列化 → 兼容映射 → 反序列化
  → load() — 挂载新控制器
  → unfreeze() — 恢复执行
  → 失败：自动回滚（旧控制器保持驻留直到 unfreeze 确认）
```

### 部署安全机制

- **Config Barrier (D17)**：所有变更在周期边界批量应用，不在周期中间修改
- **LockLevel**：单调递增。Run 级别拒绝所有 RPC 配置
- **Brownout 模式**：30 分钟看门狗，仅接受 rollback 命令
- **回滚**：保留 3 个检查点，完整快照恢复

---

## 4. 调试功能

### 当前状态：零实现

所有调试能力仅存在于 architecture.md §5 的设计文档中：

| 设计文档 | 代码实现 |
|----------|:--------:|
| DAP 子集（stepInto/Over/Out, pause, stackTrace, variables） | ❌ 无 |
| 三种断点类型（normal, conditional, log point） | ❌ 无 |
| 工业扩展（信号观察点，周期断点） | ❌ 无 |
| HAL Client 控制器访问 | ❌ 无 |
| Debug Bridge 设计（120 行） | ❌ 无 |

### 可行调试基元（可直接实现）

Executor 已有最基础的调试基元：

```rust
// 已存在：
executor.step()        // 单步执行一条指令，返回 Continue 或 Halted
executor.run_to_halt() // 批量执行到 Halt
vm.read_register(i)    // 读取寄存器
vm.ip()                // 当前指令指针
vm.signal_names()      // 获取所有信号名称

// 需要新增（22 项见下方清单）：
vm.debug_mode          // 调试模式标记
vm.breakpoints         // 断点列表 Vec<usize>
executor.add_breakpoint()
executor.resume()
engine.pause()
engine.step_cycle()
```

### 调试功能实现清单

| 层 | 需新增 | 项数 |
|-----|--------|:---:|
| **VM** | debug_mode, breakpoints, watchpoints, trace_buffer, StepTrace | 5 |
| **Executor** | add/remove breakpoint, resume, debug_step, read_registers, read_trace | 6 |
| **Engine** | pause, resume, step_cycle, set/list breakpoint, debug_state | 6 |
| **IPC** | PAUSE, RESUME, STEP_CYCLE, SET/CLEAR/LIST_BREAKPOINT, READ_REGISTERS, DEBUG_STATE, SET/CLEAR_WATCHPOINT | 10 |

参考实现：truST 的 `trust-debug` crate（Rust DAP 适配器，含断点、step、变量检查、调用栈）

---

## 5. 可观测性

### 四层可观测性

| 层 | 组件 | 状态 | 暴露内容 |
|-----|------|:---:|------|
| **1. HTTP /healthz** | HealthServer（TCP） | ✅ | `{"status":"healthy","module":"audesys-controller"}` |
| **2. IPC 方法** | 0x05 HEALTH_QUERY + 0x06 SIGNAL_SNAPSHOT | ✅ | 健康状态文本 + 批量信号（名称,值,时间戳） |
| **3. RuntimeMetrics** | 5 原子计数器 | ✅ | cycles, signals_published, config_changes, child_restarts, health_failures |
| **4. AmwMetrics** | 7 个 u64 计数器 | ⚠️ 存根 | signals_pub/read, stream_msgs, rpc_calls/timeouts/rejected, uptime |

### Studio 当前可展示

**零后端改动即可展示：**

1. **实时信号监视器** — `SIGNAL_SNAPSHOT(0x06)` + glob `*`，每周期拉取最新值
2. **健康状态标签** — `HEALTH_QUERY(0x05)` 返回 5 级健康（Healthy/Degraded/Unhealthy/Starting/Stopping）
3. **信号命名空间浏览** — glob 模式过滤（`encoder.*`）

**需少量后端改动：**

4. **Prometheus 度量面板** — 在 RuntimeMetrics 上添加 HTTP 拉取端点（+~30 行）
5. **Jitter 图表** — 实现 `RingBuffer<u64, 1024>`（设计已存在于 observability-design.md 但未入代码）

---

## 6. 虚拟仿真

### InprocMiddleware = MVP 仿真层

`audesys-amw-inproc` 已经是一个完整的内存仿真 HAL：

| 组件 | 仿真方式 | 状态 |
|------|---------|:---:|
| **InprocTransport** | RwLock\<HashMap\> 信号存储 | ✅ |
| **InprocMiddleware** | 绑定 transport + discovery + QoS | ✅ |
| **StaticDiscovery** | 同一 HashMap，支持通配符 | ✅ |
| **InprocQoS** | AtomicU8 + Mutex，LockLevel 推进 | ✅ |
| **StreamChannel** | Mutex\<VecDeque\>，3 种队列策略 | ✅ |

### 仿真能力对比

| 层 | 仿真（Inproc） | 真实（未构建） |
|-----|----------------|-----------------|
| Transport | InprocTransport（RwLock\<HashMap\>） | amw_zenoh（UDS/网络） |
| Discovery | StaticDiscovery（同一 HashMap） | Zenoh discovery |
| QoS | InprocQoS（AtomicU8 + Mutex） | RT deadline 监控 |
| Stream | InprocStreamChannel（Mutex\<VecDeque\>） | 网络流 |
| Controller Engine | 使用 Arc\<Mutex\<Box\<dyn AmwMiddleware\>\>\> | 相同 API，不同后端 |

### 缺失内容

1. **无专用仿真 crate** — AVD Manager 仅在 `docs/architecture.md §15` 中设计（Phase 3+），零代码
2. **无虚拟设备类型** — VirtualSerialDevice、VirtualModbusTcpServer 等未实现
3. **无故障注入** — 设计中有 bed-overheat、serial-disconnect、modbus-timeout 场景，但无代码
4. **测试使用 MockMiddleware 而非 InprocMiddleware** — 引擎测试用自手写的 MockMiddleware（无 discovery/QoS 委托），不如完整 InprocMiddleware
5. **AVD Manager 是 Tauri 侧（TypeScript）** — 仿真进程在 `apps/studio/` 中作为 Node.js 子进程，不在 Rust crate 中

### 最快仿真路径

```rust
// 使用 InprocMiddleware 模拟完整 Controller 运行
let middleware = InprocMiddleware::new();
let engine = Engine::new(middleware, lifecycle);
engine.register_signal(SignalDef::new("sensor.temp", F32, 25.0, Own));
engine.start_with_cycle(10);  // 10ms 周期
// 通过 signal_registry() 注入模拟设备 I/O
```

---

## 7. 下一步：优先级排序

| 优先级 | 任务 | 说明 | 估计 |
|:---:|------|------|:---:|
| **P0** | ✅ 添加 LOAD_PROGRAM + LOAD_HAL_CONFIG IPC 方法 | 部署循环的最小可行 | `b002200` |
| **P0** | ✅ 创建 ControllerClient crate | Studio 连接运行中控制器的前提 | `43aafed` |
| **P0** | ✅ 添加 Tauri deploy 命令 | 完成部署原型 | `5dc6b02` |
| **P1** | ✅ 更新 architecture.md §7 项目类型 | 新增 firmware + engineering 两层模型 | `pending` |
| **P1** | ✅ 实现 VM debug 基元（breakpoints, debug_mode） | 调试功能的第一步 | `f6b573f` |
| **P1** | ✅ 实现 AmwMetrics RingBuffer | 启用 Studio jitter 面板 | `eb41df9` |
| **P0** | 创建 ControllerClient crate | Studio 连接运行中控制器的前提 | ~3 小时 |
| **P0** | 添加 Tauri deploy 命令 | 完成部署原型 | ~2 小时 |
| **P1** | 更新 architecture.md §7 项目类型 | 新增 firmware + engineering 两层模型 | ~1 小时 |
| **P1** | 实现 VM debug 基元（breakpoints, debug_mode） | 调试功能的第一步 | ~3 小时 |
| **P1** | 实现 AmwMetrics RingBuffer | 启用 Studio jitter 面板 | ~2 小时 |
| **P2** | Engine pause/resume/step_cycle | 交互式调试 | ~2 小时 |
| **P2** | 调试 IPC 方法 | Studio 远程调试器 | ~3 小时 |
| **P2** | 仿真驱动（InprocMiddleware + 信号注入） | 离线和自动化测试 | ~4 小时 |
| **P3** | 结构化的 JSON 日志 | 从 format!("{:?}") 迁移到结构化输出 | ~2 小时 |
| **P3** | AVD Manager (Phase 3+) | 7 种虚拟设备类型 | 数月 |

---

## 附录 A：测试状态

| 测试组 | 文件 | #[test] | 状态 |
|--------|:----:|:------:|:---:|
| hal-binding-gen 编译器 | 5 | 82 | ✅ 通过 |
| hal-ir VM + executor + instruction | 5 | 61 | ✅ 通过 |
| controller (engine + IPC + config + lifecycle) | 11 | 96 | ⚠️ 1 已知失败 |
| hal-core SDD stubs | 5 | 134 | ✅ 通过 |
| controller (engine + IPC + config + lifecycle) | 11 | 91 | ⚠️ 1 已知失败 |
| runtime-common | 1 | 16 | ✅ 通过 |
| amw-inproc | 4 | 28 | ✅ 通过 |
| hal-flatbuffers | 1 | 6 | ✅ 通过 |
| modbus + hart | 4 | 14 | ✅ 通过 |
| **总计** | **36** | **420+** | **⚠️ 1 已知失败** |

**已知失败**：`test_controller_graceful_shutdown`（`ipc_integration_test.rs:297`）— controller exit code 为 1，shutdown 时序竞态。

## 附录 B：提交历史（最近 10 个）

```
22fe9f3 fix: END_VAR semicolon optional + error panel text selectable
22e5c9c fix(studio): remove duplicate const host declaration
220bb76 feat(studio): CodeMirror editor + IDE layout + file operations
53756e6 feat: CTU/CTD/CTUD counter support
d704556 feat: Studio IDE skeleton — Tauri v2 + React + ST editor
b3066ae test: add demo pipeline test — TON + IF + counter E2E
c3efb8f feat: TOF and TP timer support + controller E2E test fix
8101174 fix(controller): add Store instruction to E2E test HalProgram
572ea6f feat: wire engine cycle_time + TON E2E test
bd2b0d4 feat: IEC 61131-3 TON timer support in ST compiler and VM
```

## 附录 C：关键设计决策引用

| 决策 | 内容 |
|------|------|
| D12 | 14 类型系统 + FlatBuffers |
| D17 | Config Barrier — 所有变更在周期边界应用 |
| D22 | ST 编译器策略 — Phase 1 RuSTy → Phase 2 HAL IR |
| D24 | YAML 开发 → FlatBuffers 运行时 |
| D25 | Phase 1 ST 编程语言 only |
| D29 | Docker + PREEMPT_RT 部署 |
| D30 | 三层 QA（qa-fast/qa-full/qa-deep） |
| D36 | 渐进式 CI 门禁 |
| D40 | v0.1.0 在 Phase 2 发布 |

## 附录 D：工具链与命令

```bash
# 编译
cargo build --workspace

# 运行全部测试
cargo test --workspace

# 仅运行编译器测试
cargo test -p audesys-hal-binding-gen

# 启动 Controller
cargo run -p audesys-controller

# 启动 Studio
cargo tauri dev -p audesys-studio  # 或 cd apps/studio && pnpm tauri dev

# CI 门禁（qa-fast）
cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace

# MODACS 残留检查
grep -ri modacs . --exclude-dir=.git --exclude-dir=.sisyphus
```
