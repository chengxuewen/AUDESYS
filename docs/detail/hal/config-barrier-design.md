# AUDESYS Config Barrier 与 LockLevel 设计

> 生成日期：2026-07-09
> 设计目标：在 RT 安全的前提下允许运行时配置变更，不依赖开发者自觉

---

## 设计原则

LinuxCNC 的 LockLevel 假设开发者不会在 RT 线程运行时发起结构性变更——这是信任式安全。AUDESYS 的 Supervisor 随时可能通过 RPC 发配置命令，不能依赖这种信任。

两个机制配合保证安全：

1. **Config Barrier**：所有配置变更排队，只在 RT 周期边界应用——物理上不可能 mid-cycle 注入
2. **LockLevel 强制**：`Run` 级别拒绝所有 RPC 配置请求，不需要等到 barrier

---

## 1. Config Barrier

### 问题场景

```
Supervisor via RPC: loadComponent("new-sensor")
                          │
  RT thread mid-cycle:    │
    read()  ──────────┐   │
    update() ───┐     │   │
    write() ───┐│     │   │   ← new-sensor 被注入到这里？
               ▼▼     ▼   ▼
              funct_list 被修改 → segfault / 读到半初始化数据
```

### 方案：配置队列 + 周期边界批量应用

```
   RT cycle boundary ──┐
                       ▼
┌──────────────────────────────────────────┐
│  apply_pending_config()                  │
│  ├─ drain pending_config 队列             │
│  ├─ 重建 Arc<FunctList>                  │
│  └─ publish Signal "config.applied"      │
├──────────────────────────────────────────┤
│  read_barrier()                          │
│  for func in funct_list { func.read() }  │
│  for func in funct_list { func.update() }│
│  for func in funct_list { func.write() } │
│  write_barrier()                         │
├──────────────────────────────────────────┤
│  sleep_until(next_period)                │
└──────────────────────────────────────────┘
```

**关键保证**：
- 配置变更只在 `apply_pending_config()` 中发生——在 `read_barrier()` **之前**
- 整个 RT 周期内 `funct_list` 是只读的（`Arc<T>`）
- Supervisor 在下一个周期开始时通过 Signal 确认变更生效

### 实现

```rust
struct HalCore {
    /// 当前生效的配置。RT 线程只读。
    config: Arc<HalConfig>,

    /// 待应用的配置命令队列。Supervisor RPC → tx，RT 线程 drain。
    pending_config: crossbeam::channel::Receiver<ConfigCommand>,
    config_tx: crossbeam::channel::Sender<ConfigCommand>,
}

/// 可安全克隆的配置快照
struct HalConfig {
    components: Vec<Arc<dyn HalComponent>>,
    funct_list: Vec<FunctEntry>,
    signals: HashMap<String, SignalDef>,
    threads: Vec<HalThread>,
    lock_level: LockLevel,
    generation: u64,  // 递增，用于 Supervisor 确认
}

enum ConfigCommand {
    LoadComponent { name: String, comp_type: String, config: Value },
    ConfigureComponent { name: String, params: Value },
    UnloadComponent { name: String },
    LinkPin { pin: String, signal: String },
    UnlinkPin { pin: String },
    AddFunction { component: String, function: FunctionSlot, thread: String, position: Option<String> },
    RemoveFunction { component: String, function: FunctionSlot, thread: String },
    SetLockLevel { level: LockLevel },
}

impl HalCore {
    fn rt_cycle(&mut self) {
        // Phase 0: 应用所有排队的配置变更
        let mut new_config = None;
        for cmd in self.pending_config.try_iter() {
            new_config = Some(self.apply_config_command(
                new_config.unwrap_or_else(|| (*self.config).clone()),
                cmd,
            ));
        }
        if let Some(cfg) = new_config {
            self.config = Arc::new(cfg);
            // 通知 Supervisor 配置已生效
            // publish_signal("config.generation", HalValue::U64(self.config.generation));
        }

        // Phase 1–4: 正常 RT 周期
        self.read_barrier();
        for entry in &self.config.funct_list {
            match entry.function {
                FunctionSlot::Read   => entry.component.read(),
                FunctionSlot::Update => entry.component.update(),
                FunctionSlot::Write  => entry.component.write(),
            }
        }
        self.write_barrier();
    }

    fn apply_config_command(
        &self,
        mut cfg: HalConfig,
        cmd: ConfigCommand,
    ) -> HalConfig {
        match cmd {
            ConfigCommand::SetLockLevel { level } => {
                cfg.lock_level = level;
            }
            ConfigCommand::LoadComponent { name, comp_type, config } => {
                // 检查 lock_level
                if cfg.lock_level >= LockLevel::Run {
                    log::error!("Cannot load component in Run mode");
                    return cfg;
                }
                let component = self.instantiate_component(&name, &comp_type, &config);
                cfg.components.push(component);
            }
            ConfigCommand::LinkPin { pin, signal } => {
                if cfg.lock_level >= LockLevel::Params {
                    log::error!("Cannot link pins in Params/Run mode");
                    return cfg;
                }
                // 重建 signal 映射...
            }
            // ...
        }
        cfg.generation += 1;
        cfg
    }

    /// Supervisor 调用此方法发起配置变更
    fn submit_config(&self, cmd: ConfigCommand) -> Result<ConfigStatus> {
        self.config_tx.send(cmd)
            .map(|_| ConfigStatus::Pending {
                current_generation: self.config.generation,
            })
            .map_err(|_| Error::ConfigQueueFull)
    }
}

#[derive(Serialize)]
enum ConfigStatus {
    /// 已入队，等待下一周期应用
    Pending { current_generation: u64 },
    /// 已应用（通过 config.generation Signal 确认）
    Applied { generation: u64 },
    /// 拒绝（硬件/权限/CAPABILITY 不足）
    Rejected { reason: String },
}
```

---

## 2. LockLevel：配置权限分级

保留 LinuxCNC 的 LockLevel 概念，但语义从"运行时锁"变更为"配置权限分级"。

```rust
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
enum LockLevel {
    None   = 0,   // 无限制。生产环境禁止。
    Load   = 1,   // 允许结构性变更：loadComponent、unloadComponent
    Config = 2,   // 允许配置：configureComponent、linkPin、addFunction
    Params = 3,   // 仅允许参数修改：configureComponent（仅参数部分）
    Run    = 4,   // 只读。拒绝所有 RPC 配置请求。
    All    = 5,   // 特殊：完全锁定。连 configureComponent 参数修改也拒绝。
}
```

### LockLevel 执行路径

```
Supervisor RPC: configureComponent("motion", { "max_vel": 1000 })
                          │
                          ▼
              ┌───────────────────────┐
              │ lock_level >= Run?    │
              │  YES → reject (immediate)  ← 不经过队列，不发 pending
              │  NO  → enqueue        │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Config Barrier        │
              │  下一周期边界应用       │
              └───────────────────────┘
```

**对比 LinuxCNC**：

| | LinuxCNC | AUDESYS |
|---|---|---|
| `Run` 级别 | 仅禁止结构性变更，允许参数修改 | 拒绝所有 RPC 配置（连参数修改也拒） |
| 执行时机 | 调用时立即（需开发者自觉） | Config Barrier 边界（强制保证） |
| 降级方法 | `hal_set_lock(LOCK_NONE)` → 修改 → `hal_set_lock(LOCK_RUN)` | `deactivateComponent` → `setLockLevel(None)` → 修改 → `setLockLevel(Run)` → `activateComponent` |
| 越权处理 | 返回错误码（信任式） | MarshaError（强制式） |

### LockLevel 状态机

```
                         setLockLevel(All)
                         ┌──────────────────┐
                         ▼                  │
  None ──► Load ──► Config ──► Params ──► Run ──► All
    ▲        ▲        ▲          ▲          ▲        │
    │        │        │          │          │        │
    └────────┴────────┴──────────┴──────────┴────────┘
                    setLockLevel(lower)
             （仅在 deactivateComponent 之后允许）
```

---

## 3. Config Generation 确认

Supervisor 如何确认配置已生效：

```
Supervisor                                     HalCore (RT)
    │                                              │
    │── RPC: loadComponent("new-sensor") ────────►│
    │◄── { status: "pending", generation: 42 } ────│
    │                                              │
    │── subscribe Signal "config.generation" ────►│
    │                                              │
    │                                              │── [RT cycle boundary]
    │                                              │── apply_pending_config()
    │                                              │── config.generation = 43
    │                                              │── publish Signal "config.generation" = 43
    │◄── Signal: config.generation = 43 ───────────│
    │                                              │
    │── RPC: getSnapshot ────────────────────────►│
    │◄── { components: [..., "new-sensor"] } ──────│
    │                                              │
    │   ✅ 确认: "new-sensor" 已生效                 │
```

---

## 4. 与扫描屏障的关系

Config Barrier 和扫描屏障是两个独立但协同的机制：

| | Config Barrier | Scan Barrier |
|---|---|---|
| **目的** | 安全应用配置变更 | I/O 映像一致性 |
| **执行时机** | RT 周期边界（read_barrier 之前） | RT 周期内（read → ... → write） |
| **保护对象** | funct_list, signals, threads | I/O image table, Signal values |
| **LockLevel 交互** | LockLevel ≥ Run → 拒绝入队 | 无关 |
| **来源** | LinuxCNC hal_set_lock + 并发安全 | OpenPLC bufferLock |

```
RT 周期时间线:

  [apply_config] [read_barrier] [functions...] [write_barrier] [sleep]
   ▲ ▲           ▲
   │ │           └── Scan Barrier 开始
   │ └── Config Barrier：安全边界。mid-cycle 禁入。
   └── 配置队列清空，Arc<HalConfig> 重建
```

---

## 5. 设计决策记录

| 决策 | 理由 |
|------|------|
| Config Barrier 而非实时应用 | mid-cycle 配置变更 = segfault 风险。队列 + 周期边界批量应用是最小化安全保证 |
| LockLevel 从运行时锁 → 权限分级 | LinuxCNC 的 LockLevel 依赖开发者自觉在正确时机调用；AUDESYS 作为多进程系统必须强制 |
| `Run` 级别拒绝所有 RPC（含参数修改） | LinuxCNC 允许 Run 时改参数（hal_set_pin），但那是单进程模型的安全默认。多进程 Supervisor 应显式降级为 `Params` 才允许 |
| Config Generation 递增 + Signal 确认 | 异步系统必须可观测——Supervisor 不能靠"大概生效了"。G 数递增 + Signal 提供确定性确认 |
| pending_config 用 bounded channel | 防止 Supervisor 无限堆积配置命令。队列满 → ConfigQueueFull error（Supervisor 自行重试） |
| 降级路径强制 deactivateComponent | 防止运行中降锁导致半初始化组件进入 RT 周期——先停所有组件，再改配置 |
