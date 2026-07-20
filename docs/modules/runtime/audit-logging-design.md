# AUDESYS Runtime 审计日志持久化设计

> 生成日期：2026-07-20
> 设计目标：在现有 InMemoryAuditLog 基础上建立持久化审计日志系统，满足 IEC 62443 防篡改要求
> 关联设计：[IPC 安全设计](./ipc-security-design.md) §6、D17 Config Barrier、D46 错误模型

---

## 设计原则

1. **不可篡改**：审计日志一旦写入，事后不可修改或删除——满足 IEC 62443-3-3 SR 2.8
2. **不可阻塞 RT 路径**：日志写入永不进入 RT 线程（SCHED_FIFO），异步完成
3. **渐进演进**：Phase 1 轻量 JSONL + 哈希链，Phase 2 升级 SQLite WAL，不改变 AuditLog trait
4. **与现有架构兼容**：`runtime-common::AuditLog` trait 保持稳定，持久化实现为可替换 backend

---

## 1. 现有基础设施

### 1.1 AuditLog trait（`crates/audesys-runtime-common/src/types.rs`）

```rust
/// Persistent audit log for security events.
pub trait AuditLog {
    /// Record a new audit event.
    fn log(&mut self, event: AuditEvent);

    /// Query audit events for a specific source, newest first, limited.
    fn query(&self, source: &SourceId, limit: usize) -> Vec<AuditEvent>;

    /// Query all audit events, newest first, limited.
    fn query_all(&self, limit: usize) -> Vec<AuditEvent>;
}
```

```rust
pub struct AuditEvent {
    pub timestamp: TimestampMs,
    pub actor: SourceId,
    pub action: String,       // e.g. "config.write", "token.revoke"
    pub target: String,       // e.g. "module.controller", "token.abc123"
    pub result: AuditResult,
}

pub enum AuditResult {
    Allowed,
    Denied(String),
    Failed(String),
}
```

### 1.2 InMemoryAuditLog — 当前现状

当前所有审计日志存储于 `InMemoryAuditLog`（`Vec<AuditEvent>`），**进程重启即丢失**。这意味着：

- Supervisor 崩溃 → 所有审计记录消失，无法追溯事故前的配置变更
- 攻击者可通过重启进程抹除入侵痕迹
- 违反 IEC 62443-3-3 SR 2.8（审计日志不可篡改、不可删除）

### 1.3 hal-core 中的 AuditLog（`crates/audesys-hal-core/src/middleware.rs`）

hal-core 中有另一套更精简的 AuditLog trait：

```rust
pub trait AuditLog: Send + Sync {
    fn log(&self, event: AuditEvent);             // &self（非 &mut self）
    fn query(&self, since: SystemTime) -> Vec<AuditEvent>;
}
```

两套 trait 共存但语义不同：hal-core 面向中间件层配置变更审计（`&self`，线程安全），runtime-common 面向 IPC 安全审计（`&mut self`，追加写入）。**本文档覆盖 runtime-common 的 AuditLog，扩展其持久化能力。hal-core AuditLog 的持久化策略相同，可用相同 backend。**

---

## 2. 存储后端

### 2.1 Phase 1：追加式 JSONL 文件

Phase 1 选择 JSONL（JSON Lines）作为持久化格式：

```
/var/log/audesys/
├── audit/
│   ├── audit-2026-07-20.jsonl        # 当前日志文件
│   ├── audit-2026-07-20.jsonl.hash   # 哈希链尾（上次写入后的最后一个 hash）
│   ├── audit-2026-07-19.jsonl.gz     # 已轮转、已压缩
│   └── audit-2026-07-19.jsonl.hash.gz
```

**选择 JSONL 的理由**：
- 追加写入，无随机 IO，对 SSD 友好
- 人类可读，可用 `jq`、`grep` 等标准工具直接查询
- Git-diffable——日志变更可被外部版本管理工具追踪（与 D24 的 YAML 策略一致）
- 零依赖——不引入数据库运行时，Phase 1 运维复杂度最低

**JSONL 的局限**（Phase 2 解决）：
- 全量查询 O(n)，无索引——大规模历史审计时性能差
- 无并发写入支持（但 AUDESYS 审计日志为单写者模式——仅 Supervisor 写入）

### 2.2 Phase 2：SQLite + WAL 模式

Phase 2 升级为 SQLite 作为后端，启用 WAL（Write-Ahead Logging）模式：

| 特性 | JSONL (Phase 1) | SQLite WAL (Phase 2) |
|------|:---:|:---:|
| 写入性能 | O(1) 追加 | O(1) WAL 追加 |
| 查询性能 | O(n) 全量扫描 | O(log n) 索引查询 |
| 时间范围查询 | 需全量反序列化 | B-tree 索引，毫秒级 |
| 按 actor 聚合 | 手动 grep/jq | SQL GROUP BY |
| 依赖 | 零 | `rusqlite`（crates.io，已有先例） |
| 文件大小 | 100MB 后轮转 | 可配置 page_size，无上限 |

WAL 模式保证：读不阻塞写，写不阻塞读——即使查询正在执行，审计事件追加也不受影响。

### 2.3 Backend 可替换设计

持久化后端通过 trait 抽象，AuditLog trait 的 `log`/`query`/`query_all` 接口不变：

```rust
/// Persistence backend for audit log storage.
trait AuditStorage: Send + Sync {
    fn append(&mut self, event: &AuditEvent) -> Result<()>;
    fn query(&self, source: Option<&SourceId>, limit: usize) -> Result<Vec<AuditEvent>>;
    fn rotate(&mut self) -> Result<()>;    // 触发日志轮转
    fn verify_chain(&self) -> Result<bool>; // 验证哈希链完整性
}

struct JsonlStorage { /* Phase 1 */ }
struct SqliteStorage { /* Phase 2 */ }
```

---

## 3. 日志轮转

### 3.1 轮转策略

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_file_size` | 100 MB | 触发轮转的单个日志文件上限 |
| `retention_days` | 90 天 | 压缩文件保留期限 |
| `compress` | gzip | 轮转后自动压缩为 `.gz` |
| `max_total_size` | 10 GB | 全部审计日志文件总大小上限（硬限制） |

### 3.2 轮转流程

```
1. audit-2026-07-20.jsonl 写入达到 100MB
2. 关闭当前文件，重命名为 audit-2026-07-20.jsonl
3. 异步 gzip 压缩 → audit-2026-07-20.jsonl.gz
4. 创建新文件 audit-2026-07-20-0001.jsonl（同一天第二次轮转）
5. 哈希链尾保存到 .hash 文件，新日志从此链尾继续
6. 后台清理超过 90 天的 .gz 文件
```

轮转时**不创建新哈希链**——哈希链从首条日志延续到最后一条，跨越文件边界。`.hash` 文件存储最后的哈希值，新文件加载 `.hash` 文件后继续延伸。

### 3.3 磁盘空间守护

当 `max_total_size` 达到上限时：
1. 删除最旧的压缩日志（即使未满 90 天）
2. 写入一条 `system.audit_log_overflow` 事件记录此次删除
3. 如果清理后仍超限 → 触发 `audit_log_full` 告警（Prometheus metrics），拒绝写入但**不阻塞 Runtime**

---

## 4. 防篡改机制

### 4.1 SHA-256 哈希链

沿用 IPC 安全设计 §6.5 提出的区块链式哈希链模型：

```
entry[0]: prev_hash = "0" * 64
    hash[0] = SHA-256("0"*64 || serialize(entry[0]))

entry[1]: prev_hash = hash[0]
    hash[1] = SHA-256(hash[0] || serialize(entry[1]))

entry[n]: prev_hash = hash[n-1]
    hash[n] = SHA-256(hash[n-1] || serialize(entry[n]))
```

**扩展字段**（Phase 1 新增，不修改现有 `AuditEvent` 结构体——通过包装类型扩展）：

```rust
/// Extended audit event with hash chain fields.
/// Ponytail: 包装而非修改 runtime-common::AuditEvent，保持 trait 稳定
struct PersistentAuditEntry {
    /// 基础审计事件（现有字段不变）
    inner: AuditEvent,
    /// 单调递增序号，从 1 开始
    sequence: u64,
    /// 前一条日志的 SHA-256（首条为 64 个 '0'）
    prev_hash: String,
    /// 本条目的 SHA-256（prev_hash + 本条全部字段序列化）
    hash: String,
}
```

### 4.2 完整性验证

验证流程（启动时 + 管理员手动触发）：

```rust
fn verify_log_chain(entries: &[PersistentAuditEntry]) -> Result<bool, Vec<usize>> {
    let mut prev = "0".repeat(64);
    let mut tampered: Vec<usize> = vec![];
    for (i, entry) in entries.iter().enumerate() {
        if entry.prev_hash != prev {
            tampered.push(i); // 链断裂
        }
        let computed = sha256(&prev, &serialize(&entry.inner));
        if entry.hash != computed {
            tampered.push(i); // 内容被篡改
        }
        if entry.sequence != (i + 1) as u64 {
            tampered.push(i); // 序列不连续（可能删除）
        }
        prev = entry.hash.clone();
    }
    if tampered.is_empty() { Ok(true) } else { Err(tampered) }
}
```

### 4.3 安全边界

| 威胁 | 缓解措施 |
|------|---------|
| 篡改现有日志条目 | 哈希链检测——修改任意一条会导致后续所有 hash 不匹配 |
| 删除中间条目 | 序列号不连续检测 |
| 截断日志尾部 | `.hash` 文件记录链尾，恢复时验证 |
| 替换整个日志文件 | 外部 syslog 导出 + 日志文件签名（Phase 2 HMAC） |
| 攻击者有 root 权限改写日志 | TLS 传输到远程 syslog 服务器（Phase 3） |

哈希链仅提供**检测**而非**阻止**——攻击者若有 root 权限可重写整个日志文件并重新计算哈希链。Phase 2 增加 HMAC 签名（签名密钥存放于 TPM/HSM），Phase 3 增加远程 syslog 实时推送。

---

## 5. Config Barrier 集成（D17）

### 5.1 配置变更审计时机

D17 要求所有配置变更在 RT 周期边界批量应用。审计日志记录应在此边界前后各记录一次：

```
周期边界 apply_pending_config():
  1. 审计日志：记录 "config.barrier.pre_apply" — 变更前快照
     - 列出所有 pending 命令
     - 记录当前 config.generation

  2. drain pending_config 队列，应用所有变更
     - 重建 Arc<HalConfig>
     - 更新 generation

  3. 审计日志：记录 "config.barrier.post_apply" — 变更后快照
     - 列出实际应用的命令
     - 记录新的 config.generation
     - 包含受影响 component/signal 列表
     - 变更前后值对比（nonce 级别的 diff）
```

### 5.2 审计事件示例

```jsonl
{
  "timestamp": 1721462400000,
  "actor": {"process_name": "supervisor", "pid": 1234},
  "action": "config.barrier.pre_apply",
  "target": "generation:42",
  "result": "Allowed",
  "sequence": 156,
  "prev_hash": "a1b2c3...",
  "hash": "d4e5f6...",
  "metadata": {
    "generation": "42",
    "pending_count": "3",
    "commands": "loadComponent:sensor-temp, configureComponent:controller-main, linkPin:sensor-temp.temp->controller-main.input1"
  }
}
```

### 5.3 LockLevel 审计

每次 LockLevel 变更（D17）均应审计：

| 变更 | 审计 action | 审计级别 |
|------|-----------|---------|
| Configure → Run | `lock_level.transition` | Critical |
| Run → Configure | `lock_level.transition` | Warning（操作者必须具有 Engineer 角色） |
| Run 级别收到 RPC | `lock_level.rpc_blocked` | Warning |

---

## 6. 日志条目 Schema（扩展）

### 6.1 完整字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `timestamp` | u64 (ms) | 是 | 事件发生时间，CLOCK_MONOTONIC 排序 |
| `actor.process_name` | String | 是 | 发起进程（supervisor/controller/hmi/debug） |
| `actor.pid` | u32 | 是 | 进程 PID |
| `actor.role` | String | 否 | 操作者角色（Operator/Engineer/Supervisor/Auditor/System） |
| `action` | String | 是 | 操作类型（见 §6.2） |
| `target` | String | 是 | 操作对象 |
| `result` | String | 是 | Allowed / Denied(reason) / Failed(error) |
| `sequence` | u64 | 是 | 单调递增序号 |
| `prev_hash` | String | 是 | 前一条日志 SHA-256 |
| `hash` | String | 是 | 本条日志 SHA-256 |
| `metadata` | BTreeMap\<String,String\> | 否 | 扩展上下文（变更前后值、失败原因等） |

### 6.2 审计事件分类

| 类别 | action 前缀 | 示例 | 记录条件 |
|------|-----------|------|---------|
| 认证 | `auth.` | `auth.success`, `auth.failure`, `auth.token_issued`, `auth.token_revoked` | 每次连接/认证操作 |
| 授权 | `authz.` | `authz.action_denied`, `authz.domain_mismatch` | 权限拒绝 |
| 配置 | `config.` | `config.component_loaded`, `config.barrier.pre_apply`, `config.barrier.post_apply`, `config.lock_level.transition` | 所有配置变更 |
| 信号 | `signal.` | `signal.write` | 仅 Role::Engineer 或 Role::HMI button 绑定信号的写入（D64） |
| 会话 | `session.` | `session.created`, `session.revoked`, `session.expired` | 会话生命周期 |
| 系统 | `system.` | `system.startup`, `system.shutdown`, `system.audit_log_overflow`, `system.log_chain_broken` | Runtime 生命周期事件 |
| 安全 | `security.` | `security.cert_expired`, `security.crl_updated`, `security.rate_limit_hit` | 安全基础设施事件 |

### 6.3 审计级别

| 级别 | 含义 | 默认动作 |
|------|------|---------|
| Critical | 安全关键事件：LockLevel 提升到 Run、审计日志篡改检测 | 写入 + 触发 Prometheus alert |
| Warning | 异常事件：认证失败、权限拒绝、会话吊销 | 写入 |
| Info | 正常事件：认证成功、配置变更 | 写入 |
| Debug | 开发调试：详细参数、RPC 请求/响应 | 仅开发模式写入 |

---

## 7. 性能设计

### 7.1 异步写入

审计日志写入必须异步，**永不阻塞 RT 周期**：

```
RT 线程                    审计写入线程
    │                          │
    ├─ apply_pending_config()  │
    │  ├─ 构造 AuditEvent      │
    │  ├─ ring_buffer.push() ──┼─► drain ring_buffer
    │  │                 O(1)   │  ├─ 计算哈希链
    │  └─ continue              │  ├─ JSONL 序列化
    │                          │  ├─ fsync 写入
    │  next cycle...            │  └─ 更新 .hash 文件
```

### 7.2 Ring Buffer

使用 `crossbeam::channel` 或 `ringbuf` crate 作为写入缓冲：

```rust
/// 审计日志异步写入器
struct AsyncAuditWriter {
    /// Ring buffer: RT 线程通过 tx 发送，写入线程通过 rx 接收
    tx: crossbeam::channel::Sender<AuditEvent>,
    rx: crossbeam::channel::Receiver<AuditEvent>,
    /// 持久化后端
    storage: Box<dyn AuditStorage>,
    /// 当前哈希链尾
    chain_tail: String,
    /// 序号计数器
    sequence: u64,
}
```

**容量规划**：
- Ring buffer 容量：1024 条事件
- 最坏情况下 10ms RT 周期 + 100 条/周期 = 使 buffer 在 100ms 内被填满
- Buffer 满时策略：丢弃最旧事件 + 写入 `system.audit_buffer_overflow` 告警 —— **丢失审计日志是不可接受的，应增大 buffer 容量**
- 推荐配置：buffer 容量 = max_event_rate × max_io_latency_ms × 2

### 7.3 写入线程 fsync 策略

| 策略 | 延迟 | 可靠性 | 适用场景 |
|------|------|--------|---------|
| 每条 fsync | ~1ms/条 | 最高 | 关键安全事件 |
| 批量 fsync（每 100ms） | ~0.01ms/条 | 高 | 一般配置变更 |
| 批量 fsync（每 1s） | ~0.001ms/条 | 中 | 高吞吐 Info 级别 |

Phase 1 默认使用**批量 fsync（每 100ms）**——平衡可靠性与性能。Critical 级别事件立即 fsync。

---

## 8. 保留与清理

### 8.1 保留策略

| 存储层 | 保留期 | 格式 | 说明 |
|--------|--------|------|------|
| 本地 JSONL | 90 天 | 压缩 .gz | 主存储 |
| 外部 syslog | 按组织策略（通常 1-7 年） | RFC 5424 | 长期归档 |
| 安全事件导出 | 永久 | JSONL → 外部审计系统 | Critical 事件 |

### 8.2 清理流程

清理由 Supervisor 内的定时任务触发（cron 风格，每小时执行）：

```
1. 扫描 /var/log/audesys/audit/*.gz
2. 解析文件名中的日期 → 计算文件年龄
3. 年龄 > retention_days → 删除
4. 记录 "system.audit_cleanup" 事件：删除了哪些文件
```

### 8.3 syslog 导出

Phase 2 支持通过 RFC 5424 syslog 协议将审计事件实时转发到外部 syslog 服务器：

- 格式：`{timestamp} {hostname} audesys-audit[{pid}]: {structured_data} {msg}`
- 结构化数据使用 `SD-ID` = `audesys@32473`（AUDESYS 私有企业编号）
- 敏感字段（如 token 哈希）在导出前脱敏

### 8.4 手动导出

管理员可通过 IPC 命令导出审计日志：

```
IPC method 0x18: EXPORT_AUDIT_LOG
  Request:  { since: TimestampMs, until: Option<TimestampMs>, format: "jsonl"|"csv" }
  Response: { path: String, entry_count: u64, verified: bool }
  Role:     Auditor
```

---

## 9. 与现有 IPC 安全框架的集成

### 9.1 认证事件审计

SO_PEERCRED 连接建立后（参见 `ipc-security-design.md` §2）：

```rust
// 在 Supervisor accept 后
let cred = peer_cred(&stream)?;
let hashed_token = sha256(&token_bytes);  // 审计日志不写明文 token

self.audit.log(AuditEvent {
    timestamp: TimestampMs::now(),
    actor: SourceId { process_name: "uds".to_string(), pid: cred.pid },
    action: "auth.success".to_string(),
    target: format!("uid:{}", cred.uid),
    result: AuditResult::Allowed,
});
```

### 9.2 授权拒绝审计

授权拒绝时记录完整的拒绝上下文（参见 `ipc-security-design.md` §5）：

```rust
self.audit.log(AuditEvent {
    action: "authz.action_denied".to_string(),
    target: resource.to_string(),
    result: AuditResult::Denied(format!(
        "role={:?} requires {:?}, resource scope check failed",
        role, action,
    )),
    ..
});
```

### 9.3 审计日志的审计

审计日志系统本身的操作也需审计（自审计）：

| 操作 | 审计 action |
|------|-----------|
| 审计日志轮转 | `system.audit_rotate` |
| 审计日志导出 | `system.audit_export` |
| 哈希链验证失败 | `system.audit_chain_broken` |
| Buffer 溢出 | `system.audit_buffer_overflow` |
| 磁盘空间不足 | `system.audit_disk_full` |

---

## 10. Phase 路线图

| 能力 | Phase 1 | Phase 2 | Phase 3 |
|------|:-------:|:-------:|:-------:|
| JSONL 持久化 | 是 | 是（切换时迁移） | 是 |
| SHA-256 哈希链 | 是 | 是 | 是 |
| 异步写入（ring buffer） | 是 | 是 | 是 |
| 日志轮转 + 压缩 | 是 | 是 | 是 |
| SQLite WAL 后端 | 否 | 是 | 是 |
| 按时间范围查询 | 否（全量扫描） | 是（索引） | 是 |
| HMAC 签名（TPM/HSM） | 否 | 是 | 是 |
| 外部 syslog 导出 | 否 | 是 | 是 |
| 远程 syslog 实时推送 | 否 | 否 | 是 |
| AuditLog trait 自审计 | 是 | 是 | 是 |
| IPC 导出命令 (0x18) | 否 | 是 | 是 |

---

## 11. 设计决策记录

| 决策 | 理由 |
|------|------|
| Phase 1 选 JSONL 而非 SQLite | 零依赖部署、人类可读、符合项目 Phase 1 最小化哲学。JSONL 追加写入性能不亚于 SQLite，仅在查询时退化为全量扫描 |
| 哈希链而非数据库内置完整性 | 哈希链在文件层面保证防篡改，与存储后端解耦。即使 SQLite 被替换文件，哈希链仍可检测 |
| 包装类型扩展而非修改 AuditEvent | 不修改 `runtime-common::AuditEvent` 保持 trait 稳定（"不改变现有 AuditLog trait"约束） |
| 异步写入 + ring buffer | 审计日志写入可能涉及磁盘 IO（ms 级延迟），不允许进入 RT 路径（SCHED_FIFO 线程不能 block） |
| 批量 fsync 而非逐条 fsync | 100ms 批量窗口在 99.9% 场景下足够——Supervisor 崩溃丢失 100ms 审计日志的风险可接受（Supervisor 本身就是被守护的进程） |
| Config Barrier 前后双审计 | 提供变更前后的完整快照，使审计记录既能回答"谁做了什么"，也能回答"生效前状态是什么" |
| 自审计（审计日志的审计） | 审计系统自身操作必须可追溯，否则攻击者可通过轮转/导出操作删除证据 |

---

## 12. 约束条件

1. **不修改现有 `AuditLog` trait 的 3 方法签名** — 持久化实现作为新 struct 实现相同 trait
2. **不引入新 crate 为 Phase 1 必需** — JSONL 使用 `std::fs::File` + `serde_json`（已有依赖）
3. **单写者模型** — 只有 Supervisor 进程写入审计日志（Controller/HMI 通过 RPC 间接触发审计事件）
4. **审计日志路径可配置** — 默认为 `/var/log/audesys/audit/`，通过环境变量 `AUDESYS_AUDIT_DIR` 覆盖
5. **审计日志不可删除** — 不提供 API 或 CLI 命令删除审计日志（仅自动轮转清理，保留 90 天）
