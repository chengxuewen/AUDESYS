# S-CFG: Config Barrier 与 LockLevel 规范

> 来源: `docs/modules/hal/config-barrier-design.md`
> 生成日期: 2026-07-15
> 状态: 草稿
> 范围: HalCore 配置变更安全机制

---

## 1. LockLevel 状态机

### S-CFG-001: LockLevel 枚举定义

锁定级别为 6 级线性递增枚举，定义如下：

| 级别 | 值 | 语义 | 允许的操作 |
|------|-----|------|-----------|
| `None` | 0 | 无限制 | 所有操作。生产环境禁止。 |
| `Load` | 1 | 允许结构性变更 | `loadComponent`, `unloadComponent` |
| `Config` | 2 | 允许配置 | `configureComponent`, `linkPin`, `addFunction`, `removeFunction` |
| `Params` | 3 | 仅参数 | `configureComponent`（仅参数部分） |
| `Run` | 4 | 只读 | 拒绝所有 RPC 配置请求。正常运行态。 |
| `All` | 5 | 完全锁定 | 连参数修改也拒绝。特殊安全态。 |

实现约束：
- 枚举派生 `Clone`, `Copy`, `Debug`, `PartialEq`, `PartialOrd`
- `PartialOrd` 保证级别比较的正确语义 (`level >= LockLevel::Run`)
- 序列化支持（Supervisor RPC 传输）

### S-CFG-002: LockLevel 单向递增

LockLevel 默认单向递增：`None → Load → Config → Params → Run → All`。

- 每次 `setLockLevel(RPC)` 请求的目标级别必须 ≥ 当前级别
- 违反时返回 `Rejected { reason: "LockLevel cannot decrease without deactivation" }`
- 不经过 Config Barrier 队列，立即拒绝

### S-CFG-003: LockLevel 降级方法

降级（向低级别移动）仅在全部组件停用后允许：

```
deactivateComponent(all) → setLockLevel(None) → 修改 → setLockLevel(Run) → activateComponent(all)
```

- `deactivateComponent` 从 funct_list 中移除所有组件引用
- 降级请求返回 `Applied` 前，必须经过 Config Barrier 边界
- 组件重新激活时，LockLevel 从低到高重新锁定

### S-CFG-004: `All` 级别特殊行为

`All` 是唯一不可逆向退出的级别（重启后方可解除）：

- `setLockLevel(All)` 之后的降级请求一律拒绝
- 连 `deactivateComponent` 在 `All` 级别也被拒绝
- 退出 `All` 的唯一路径：HalCore 重启

---

## 2. Config Barrier 批处理

### S-CFG-010: 周期边界应用

所有配置变更在 RT 周期边界批量应用，不在 mid-cycle 执行：

```
[apply_pending_config] [read_barrier] [functions...] [write_barrier] [sleep]
                         ^
                         └── mid-cycle 禁止配置变更
```

执行顺序（Phase 0）：
1. `drain` pending_config 队列的全部命令
2. 按顺序应用每条命令到 `HalConfig` 副本
3. 原子替换 `self.config = Arc::new(new_config)`
4. 发布 `Signal "config.applied"` 通知 Supervisor

### S-CFG-011: Arc 只读保证

整个 RT 周期内 `funct_list` 通过 `Arc<HalConfig>` 只读访问：

- Phase 0 完成后，`self.config` 指向新 `Arc`
- Phase 1-4 的所有代码通过 `&self.config.funct_list` 遍历
- RT 线程永不持有可变引用
- 旧的 `Arc` 在所有读者释放后自动回收

### S-CFG-012: `apply_pending_config` 实现

```rust
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
        publish_signal("config.generation", HalValue::U64(self.config.generation));
    }
    // Phase 1–4: 正常 RT 周期
    self.read_barrier();
    // ...
    self.write_barrier();
}
```

- 无队列命令时跳过 Phase 0（零开销）
- `HalConfig::clone()` 是深拷贝，需在分配预算内完成

### S-CFG-013: `HalConfig` 结构

```rust
struct HalConfig {
    components: Vec<Arc<dyn HalComponent>>,
    funct_list: Vec<FunctEntry>,
    signals: HashMap<String, SignalDef>,
    threads: Vec<HalThread>,
    lock_level: LockLevel,
    generation: u64,
}
```

- 所有字段在 Phase 0 重建
- `generation` 每次重建递增

---

## 3. 队列 FIFO

### S-CFG-020: bounded channel

pending_config 使用有界 channel：

```rust
pending_config: crossbeam::channel::Receiver<ConfigCommand>,
config_tx: crossbeam::channel::Sender<ConfigCommand>,
```

- Channel 容量：默认 1024（可配置）
- 满队列时 `submit_config` 返回 `Error::ConfigQueueFull`
- Supervisor 收到 `ConfigQueueFull` 后自行重试

### S-CFG-021: FIFO 顺序保证

队列严格 FIFO：

- `try_iter()` 按入队顺序逐个返回
- 每条命令的副作用基于上一条命令执行后的 `HalConfig` 状态
- 无命令重排序、去重、合并

### S-CFG-022: 空队列零开销

- 无命令时 `try_iter()` 返回空迭代器
- Phase 0 跳过，不分配、不克隆
- RT 周期时间线不受空队列影响

---

## 4. Run 级别拒绝

### S-CFG-030: 立即拒绝

LockLevel ≥ `Run` 时，`submit_config` 在入队前即拒绝：

```
Supervisor RPC: configureComponent(...)
    │
    ▼
lock_level >= Run?  ──YES──→ 立即返回 Rejected
    │ NO
    ▼
enqueue to pending_config
```

- 拒绝响应包含原因 `"LockLevel is Run: no RPC config allowed"`
- 拒绝不经过 Config Barrier 队列
- 拒绝不产生 `Pending` 状态

### S-CFG-031: `Run` 级别拒绝范围

`Run` 级别拒绝的完整操作列表：

| 命令 | Run 行为 | All 行为 |
|------|---------|---------|
| `LoadComponent` | 拒绝 | 拒绝 |
| `UnloadComponent` | 拒绝 | 拒绝 |
| `ConfigureComponent`（全部） | 拒绝 | 拒绝 |
| `LinkPin` | 拒绝 | 拒绝 |
| `UnlinkPin` | 拒绝 | 拒绝 |
| `AddFunction` | 拒绝 | 拒绝 |
| `RemoveFunction` | 拒绝 | 拒绝 |
| `SetLockLevel` | 仅允许 ≥ 当前级别 | 仅 All → All（无变化）|

### S-CFG-032: `Params` 级别的有限允许

LockLevel = `Params` 时：
- `ConfigureComponent`（仅参数部分）→ 允许，入队
- `LoadComponent`, `UnloadComponent`, `LinkPin`, `AddFunction` → 拒绝
- 参数/非参数通过 `ConfigCommand` 的字段区分

---

## 5. Config Generation 与确认

### S-CFG-040: Generation 递增

每次 `apply_pending_config` 成功执行后，`HalConfig.generation` 递增 1：

- 初始值：0
- 每次 Phase 0 应用至少 1 条命令 → `generation += 1`
- 仅当 `new_config` 非 `None` 时递增

### S-CFG-041: Signal 确认

Config Barrier 应用完成后发布 Signal：

```
Signal: "config.generation" = U64(new_generation)
```

Signal 包含以下时序保证：
- 发布时机：`self.config = Arc::new(cfg)` 之后，`read_barrier()` 之前
- Supervisor 通过 Signal subscribe 接收确认
- 确认到达后 Supervisor 可通过 `getSnapshot` RPC 查验

### S-CFG-042: `submit_config` 返回

```rust
fn submit_config(&self, cmd: ConfigCommand) -> Result<ConfigStatus, Error>
```

返回值定义：

```rust
enum ConfigStatus {
    /// 已入队，等待下一周期应用
    Pending { current_generation: u64 },
    /// 已应用（通过 config.generation Signal 确认）
    Applied { generation: u64 },
    /// 拒绝（LockLevel / 硬件 / 权限 / CAPABILITY 不足）
    Rejected { reason: String },
}
```

- `Pending`：命令已入队，Supervisor 应订阅 Signal 等待确认
- `Applied`：仅在直接拒绝路径不使用（LockLevel 拒绝）
- `Rejected`：立即返回，不经过队列

---

## 6. 回滚

### S-CFG-050: 回滚触发条件

以下情况触发配置回滚：

| 条件 | 行为 |
|------|------|
| `apply_config_command` 抛出异常 | 丢弃当前 `new_config`，保留旧 `Arc`，记录错误 |
| 组件实例化失败 | 该命令跳过，后续命令继续处理（不阻塞队列） |
| Supervisor 长时间未收到 generation 增加 | Supervisor 调用 `getSnapshot` 确认或重试 |

### S-CFG-051: 回滚原子性

`apply_pending_config` 是"全部或不变"：

- 队列中的命令逐个应用到 `HalConfig` 副本
- 任何命令失败 → 该命令丢弃，**不**影响已应用的之前命令
- 失败的后续命令在下次周期重试
- `self.config` 仅在所有命令成功时原子替换

### S-CFG-052: Supervisor 确认超时

Supervisor 端确认协议：

1. `submit_config` 返回 `Pending { current_generation: G }`
2. Supervisor 订阅 `Signal "config.generation"`
3. 超时窗口：默认 3 个 RT 周期
4. 超时未收到 `generation > G` → Supervisor 调用 `getSnapshot` 对比
5. 若配置未生效 → 重新提交（幂等设计）

---

## 7. Supervisor Authority

### S-CFG-060: `submit_config` 接口

Supervisor 的唯一配置入口：

```rust
impl HalCore {
    pub fn submit_config(&self, cmd: ConfigCommand) -> Result<ConfigStatus, Error>;
}
```

- `&self`（不可变引用）—— channel 发送不需要可变访问
- 跨进程调用通过 RPC 代理
- 返回 `ConfigQueueFull` 时 Supervisor 应在退避后重试

### S-CFG-061: ConfigCommand 枚举

所有受支持的配置命令：

```rust
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
```

- 所有命令由 `apply_config_command` 统一处理
- 每类命令在 `apply_config_command` 内检查 LockLevel 约束

### S-CFG-062: deactivateComponent 强制降级

Supervisor 修改配置的标准流程：

1. `deactivateComponent(target)` → 从 funct_list 移除
2. `setLockLevel(None)` → 降低权限级别
3. 发送修改命令（load, configure, link 等）
4. `setLockLevel(Run)` → 恢复运行态
5. `activateComponent(target)` → 重新加入 funct_list

- deactivate 必须在降级前完成
- activate 必须在恢复 Run 后执行
- 违反此顺序 → Config Barrier 拒绝命令

### S-CFG-063: getSnapshot RPC

Supervisor 读取当前配置状态的接口：

```rust
fn get_snapshot(&self) -> HalSnapshot;
struct HalSnapshot {
    components: Vec<ComponentInfo>,
    funct_entries: Vec<FunctEntry>,
    lock_level: LockLevel,
    generation: u64,
    signal_count: usize,
    thread_count: usize,
}
```

- 读取 `Arc<HalConfig>` 的当前快照
- 非 RT 路径，无锁
- 用于确认配置生效和调试

---

## 附录 A: 规范项索引

| ID | 主题 | 优先级 | 对应设计文档章节 |
|----|------|--------|-----------------|
| S-CFG-001 | LockLevel 枚举 | P0 | §2 |
| S-CFG-002 | 单向递增 | P0 | §2 |
| S-CFG-003 | 降级方法 | P0 | §2 |
| S-CFG-004 | All 级别 | P0 | §2 |
| S-CFG-010 | 周期边界应用 | P0 | §1 |
| S-CFG-011 | Arc 只读保证 | P0 | §1 |
| S-CFG-012 | apply_pending_config 实现 | P0 | §1 |
| S-CFG-013 | HalConfig 结构 | P0 | §1 |
| S-CFG-020 | bounded channel | P0 | §1 |
| S-CFG-021 | FIFO 顺序 | P0 | §1 |
| S-CFG-022 | 空队列零开销 | P0 | §1 |
| S-CFG-030 | 立即拒绝 | P0 | §2 |
| S-CFG-031 | Run 拒绝范围 | P0 | §2 |
| S-CFG-032 | Params 有限允许 | P0 | §2 |
| S-CFG-040 | Generation 递增 | P0 | §3 |
| S-CFG-041 | Signal 确认 | P0 | §3 |
| S-CFG-042 | submit_config 返回 | P0 | §1/§3 |
| S-CFG-050 | 回滚触发条件 | P1 | §1 |
| S-CFG-051 | 回滚原子性 | P1 | §1 |
| S-CFG-052 | 确认超时 | P1 | §3 |
| S-CFG-060 | submit_config 接口 | P0 | §1 |
| S-CFG-061 | ConfigCommand 枚举 | P0 | §1 |
| S-CFG-062 | deactivateComponent 降级 | P0 | §2 |
| S-CFG-063 | getSnapshot RPC | P1 | §3 |