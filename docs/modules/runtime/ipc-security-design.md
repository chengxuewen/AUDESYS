# AUDESYS Runtime IPC 安全设计

> 生成日期：2026-07-15
> 设计目标：定义 Runtime 进程间通信的安全模型，覆盖 UDS 认证、Zenoh 传输加密、ConfigCommand 权限控制、审计追踪

---

## 设计原则

AUDESYS Runtime 是多进程架构：Supervisor（控制面）、Controller（RT 数据面）、HMI 面板、调试桥各自运行在不同进程甚至不同主机上。IPC 安全的核心原则：

1. **最小权限**：每个进程只拥有完成其功能所需的最小权限
2. **纵深防御**：传输层认证 + 消息层授权 + 操作审计，三层互不依赖
3. **零信任**：不假设任何 IPC 对端是可信的，包括同主机的进程
4. **RT 路径零开销**：安全检查不进入 RT 数据面（L1 路径无认证无授权）

---

## 1. IPC 拓扑

```
┌──────────────────────────────────────────────────┐
│                  同一主机                          │
│                                                    │
│  ┌────────────┐    UDS + SO_PEERCRED     ┌──────┐ │
│  │ Supervisor │ ◄──────────────────────► │Controller│
│  │  (控制面)  │                          │(RT面) │
│  └──────┬─────┘                          └──────┘ │
│         │                                           │
│         │          UDS + HMAC Token                 │
│         ├──────────────────────────────────── HMI   │
│         │                                           │
│         ├──────────────────────────────────── Debug │
│                                                    │
├──────────────────────────────────────────────────┤
│                  跨主机 (Phase 3+)                  │
│                                                    │
│  Supervisor ──── Zenoh mTLS ──── Zenoh Router ──── │
│  Controller ──── Zenoh mTLS ──── 远端 Supervisor    │
└──────────────────────────────────────────────────┘
```

同主机通信使用 Unix Domain Socket，跨主机通信使用 Zenoh over mTLS。两种路径使用不同的认证机制，但共享同一套授权模型和审计框架。

---

## 2. UDS 传输层认证：SO_PEERCRED

### 原理

Linux UDS 的 `SO_PEERCRED` 选项允许服务端在 accept 后获取对端进程的 PID、UID、GID。这是内核提供的不可伪造的身份凭证——比应用层 token 更可靠。

```rust
use std::os::unix::net::UnixStream;
use std::os::unix::io::AsRawFd;

/// 从 UDS 连接获取对端进程凭证
fn peer_cred(stream: &UnixStream) -> Result<(u32, u32, u32)> {
    // libc::getsockopt 返回 (pid, uid, gid)
    // 内核保证：非特权进程无法伪造
    let cred = unsafe {
        let mut cred: libc::ucred = std::mem::zeroed();
        let mut len = std::mem::size_of::<libc::ucred>() as u32;
        let ret = libc::getsockopt(
            stream.as_raw_fd(),
            libc::SOL_SOCKET,
            libc::SO_PEERCRED,
            &mut cred as *mut _ as *mut libc::c_void,
            &mut len,
        );
        if ret != 0 {
            return Err(io::Error::last_os_error());
        }
        cred
    };
    Ok((cred.pid, cred.uid, cred.gid))
}
```

### 权限映射表

Supervisor 维护一个静态的进程白名单，定义了哪些 UID 可以扮演哪些角色：

```yaml
# /etc/audesys/security.yaml
roles:
  controller:
    allowed_uids: [0]                 # 仅 root 可运行 RT Controller
    allowed_paths: ["/usr/lib/audesys/controller"]
  supervisor:
    allowed_uids: [0, 1000]           # root 或 audesys 用户
    allowed_paths: ["/usr/lib/audesys/supervisor"]
  hmi:
    allowed_uids: [1000, 1001]        # 操作员用户
    allow_unauthenticated: false      # 不允许匿名连接
  debug:
    allowed_uids: [1000]              # 仅开发用户
    max_connections: 3                # 限制调试连接数
```

### 连接验证流程

```
1. 对端连接 UDS
2. Supervisor accept() 后立即调用 SO_PEERCRED
3. 获取 (pid, uid, gid)
4. 通过 /proc/<pid>/exe 验证可执行文件路径是否匹配白名单
5. 检查 uid 是否在角色的 allowed_uids 中
6. 检查连接数是否超过上限（如 debug 最多 3 个）
7. 全部通过 → 分配 SessionToken（HMAC 签名，带过期时间）
8. 后续消息携带 SessionToken，避免每次重复 SO_PEERCRED
```

---

## 3. HMAC SessionToken

SO_PEERCRED 只在连接建立时可用。后续消息使用 HMAC-SHA256 签名的 SessionToken，既减少系统调用，也支持消息级别的重放防护。

```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;
use rand::Rng;

type HmacSha256 = Hmac<Sha256>;

struct SessionToken {
    pub token: Vec<u8>,       // HMAC 签名
    pub expires_at: u64,      // 过期时间戳 (ms)
    pub role: Role,
    pub session_id: u64,      // 随机生成的会话 ID，用于吊销
}

#[derive(Clone, Debug, PartialEq)]
enum Role { Controller, Supervisor, Hmi, Debug }

struct TokenManager {
    secret: Vec<u8>,          // 进程启动时从 /dev/urandom 生成
    issued: Mutex<HashMap<u64, SessionInfo>>,
}

impl TokenManager {
    fn issue(&self, role: Role, ttl_ms: u64) -> SessionToken {
        let session_id = rand::thread_rng().gen::<u64>();
        let expires_at = now_ms() + ttl_ms;
        let mut mac = HmacSha256::new_from_slice(&self.secret).unwrap();
        mac.update(&session_id.to_le_bytes());
        mac.update(&(role.clone() as u8).to_le_bytes());
        mac.update(&expires_at.to_le_bytes());
        let token = mac.finalize().into_bytes().to_vec();

        self.issued.lock().insert(session_id, SessionInfo {
            role: role.clone(),
            expires_at,
        });

        SessionToken { token, expires_at, role, session_id }
    }

    fn verify(&self, token: &SessionToken) -> Result<Role> {
        // 1. 检查过期
        if now_ms() > token.expires_at {
            return Err(AuthError::Expired);
        }
        // 2. 检查吊销
        let issued = self.issued.lock();
        if !issued.contains_key(&token.session_id) {
            return Err(AuthError::Revoked);
        }
        // 3. 验证 HMAC 签名
        let mut mac = HmacSha256::new_from_slice(&self.secret).unwrap();
        mac.update(&token.session_id.to_le_bytes());
        mac.update(&(token.role.clone() as u8).to_le_bytes());
        mac.update(&token.expires_at.to_le_bytes());
        mac.verify_slice(&token.token).map_err(|_| AuthError::InvalidSignature)?;
        // ponytail: HMAC 签名验证是 O(1) 的，不引入 RT 路径
        Ok(token.role.clone())
    }
}
```

### Token TTL

| 角色 | 默认 TTL | 说明 |
|------|---------|------|
| Controller | 无限期（进程生命周期） | RT 进程重启 = 新连接，无需过期 |
| Supervisor | 24h | 控制面进程，连接稳定 |
| HMI | 1h | 操作员会话，超时自动登出 |
| Debug | 15min | 调试会话，短生命周期 |

### 吊销机制

Supervisor 支持通过 RPC 吊销特定 session_id，用于安全事件响应：

```rust
fn revoke_session(&self, session_id: u64) -> Result<()> {
    self.issued.lock().remove(&session_id);
    // 记录审计事件
    self.audit.record(AuditEvent {
        action: "session_revoked",
        resource: format!("session:{:x}", session_id),
        result: AuditResult::Success,
        ..Default::default()
    });
    Ok(())
}
```

---

## 4. Zenoh mTLS（跨主机传输）

Phase 3 跨主机通信使用 Zenoh 的 mTLS 传输层。每个节点持有由 AUDESYS CA 签发的证书，证书中嵌入角色信息。

### 证书结构

```yaml
# Zenoh mTLS 证书扩展
subject:
  commonName: "controller-01.factory-a"
  organization: "AUDESYS"
  organizationalUnit: "Runtime"

x509_extensions:
  # 自定义 X.509 v3 扩展：角色声明
  audesys_role: "controller"    # supervisor | controller | hmi | debug
  audesys_node_id: "ctrl-01"
  # 约束：只允许连接特定域
  audesys_domain: "l1.control.reactor_a"
```

### Zenoh 配置

```yaml
# zenoh-mtls.yaml
mode: peer
transport:
  tls:
    # mTLS: 双向证书验证
    client_auth: required
    trusted_ca: /etc/audesys/ca.crt
    client_cert: /etc/audesys/node.crt
    client_key: /etc/audesys/node.key
    # 证书吊销列表
    crl: /etc/audesys/ca.crl
    # 密码套件限制
    ciphersuites: "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256"
    # 最小 TLS 版本
    min_tls_version: "1.3"
```

### 连接验证钩子

Zenoh 允许注册连接验证回调，在 TLS 握手完成后、数据交换开始前执行：

```rust
// 伪代码：Zenoh mTLS 连接验证钩子
fn verify_peer_cert(cert: &x509::Certificate) -> Result<()> {
    // 1. 标准 X.509 链验证（CA 签名 + 有效期 + CRL）
    cert.verify_chain(&trusted_ca)?;

    // 2. 提取 AUDESYS 自定义扩展
    let role = cert.extension("audesys_role")?;
    let domain = cert.extension("audesys_domain")?;

    // 3. 角色匹配检查
    //    Controller 只允许连接同域的 Supervisor
    //    HMI 只允许连接控制面（非 RT 路径）
    match (local_role, remote_role) {
        (Role::Controller, Role::Supervisor) if domain_matches(local_domain, remote_domain) => Ok(()),
        (Role::Supervisor, Role::Controller) if domain_matches(local_domain, remote_domain) => Ok(()),
        (Role::Supervisor, Role::Hmi) => Ok(()),
        _ => Err(AuthError::RoleMismatch),
    }
}
```

---

## 5. ConfigCommand 授权模型

所有通过 RPC 发送的配置命令（`loadComponent`、`configureComponent`、`linkPin` 等）必须经过授权检查。授权模型基于 RBAC（Role-Based Access Control），权限矩阵如下：

### 权限矩阵

| 操作 | Controller | Supervisor | HMI | Debug |
|------|:----------:|:----------:|:---:|:-----:|
| `loadComponent` | 否 | 是 | 否 | 否 |
| `unloadComponent` | 否 | 是 | 否 | 否 |
| `configureComponent` | 是（仅自身） | 是 | 否 | 是（仅调试组件） |
| `linkPin` | 否 | 是 | 否 | 否 |
| `activateComponent` | 是（仅自身） | 是 | 否 | 否 |
| `deactivateComponent` | 是（仅自身） | 是 | 否 | 是（仅调试组件） |
| `getSnapshot` | 是（仅自身） | 是 | 是（受限视图） | 是 |
| `readSignal` | 是 | 是 | 是（仅监控域） | 是 |
| `writeSignal` | 是（仅 OWN 型） | 是 | 否 | 是（仅调试 Signal） |
| `revokeSession` | 否 | 是 | 否 | 否 |

### 授权实现

```rust
struct Authorizer {
    role_map: HashMap<Role, HashSet<Action>>,
}

impl Authorizer {
    fn check(&self, role: &Role, action: &Action, resource: &str) -> Result<()> {
        // 1. 角色是否有该操作的基础权限
        if !self.role_map.get(role).map_or(false, |actions| actions.contains(action)) {
            return Err(AuthorizationError::ActionDenied {
                action: action.clone(),
                role: role.clone(),
            });
        }
        // 2. 资源范围检查
        match (role, action, resource) {
            // HMI 只能读取监控域的信号
            (Role::Hmi, Action::ReadSignal, res) if !res.starts_with("monitor.") => {
                return Err(AuthorizationError::ResourceDenied { resource: res.to_string() });
            }
            // Controller 只能配置自己的组件
            (Role::Controller, Action::ConfigureComponent, res) if !res.starts_with("self.") => {
                return Err(AuthorizationError::ResourceDenied { resource: res.to_string() });
            }
            _ => {}
        }
        Ok(())
    }
}
```

### 安全域限制

ConfigCommand 还需匹配当前节点的 Security Domain（参见 `hal/industrial-qos-design.md` §5）。跨域配置命令被静默拒绝：

```rust
fn check_domain(cmd: &ConfigCommand, node_domain: &str) -> Result<()> {
    let cmd_domain = cmd.metadata.get("domain").unwrap_or("default");
    if cmd_domain != node_domain && !node_domain.starts_with("admin.") {
        return Err(AuthorizationError::DomainMismatch {
            cmd_domain: cmd_domain.to_string(),
            node_domain: node_domain.to_string(),
        });
    }
    Ok(())
}
```

---

## 6. 审计事件模型

所有安全敏感操作（认证成功/失败、授权拒绝、配置变更、会话吊销）必须记录审计事件。审计日志不可修改，不可删除。

### 审计事件 Schema

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
struct AuditEvent {
    /// ISO 8601 时间戳，使用 CLOCK_MONOTONIC 排序
    pub timestamp: String,
    /// 事件序列号（单调递增，用于检测日志篡改）
    pub sequence: u64,
    /// 事件来源：进程 PID + 节点 ID
    pub source: SourceId,
    /// 操作主体
    pub actor: Actor,
    /// 操作类型
    pub action: ActionKind,
    /// 操作对象
    pub resource: String,
    /// 操作结果
    pub result: AuditResult,
    /// 扩展元数据（如失败原因、请求参数摘要）
    pub metadata: BTreeMap<String, String>,
    /// 前一个事件的 SHA-256（区块链式完整性链）
    pub prev_hash: String,
    /// 本条目的 SHA-256（prev_hash + 本条目全部字段）
    pub hash: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct SourceId {
    pub node_id: String,
    pub pid: u32,
    pub role: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
enum Actor {
    User { uid: u32, username: String },
    Process { pid: u32, role: String },
    System,  // Runtime 内部触发的操作
}

#[derive(Clone, Debug, Serialize, Deserialize)]
enum AuditResult {
    Success,
    Denied { reason: String },
    Failed { error: String },
}
```

### 完整性链

审计日志采用区块链式哈希链，防止事后篡改：

```rust
struct AuditLog {
    entries: Vec<AuditEvent>,
    last_hash: String,
}

impl AuditLog {
    fn append(&mut self, mut event: AuditEvent, prev_hash: &str) {
        event.sequence = self.entries.len() as u64 + 1;
        event.prev_hash = prev_hash.to_string();
        // 计算本条目的 SHA-256
        let serialized = serde_json::to_string(&event).unwrap();
        event.hash = {
            let mut hasher = Sha256::new();
            hasher.update(prev_hash.as_bytes());
            hasher.update(serialized.as_bytes());
            hex::encode(hasher.finalize())
        };
        self.last_hash = event.hash.clone();
        self.entries.push(event);
    }

    /// 验证整个日志的完整性
    fn verify(&self) -> bool {
        let mut prev = "0".repeat(64);
        for entry in &self.entries {
            if entry.prev_hash != prev { return false; }
            let serialized = serde_json::to_string(entry).unwrap();
            let mut hasher = Sha256::new();
            hasher.update(prev.as_bytes());
            hasher.update(serialized.as_bytes());
            if entry.hash != hex::encode(hasher.finalize()) { return false; }
            prev = entry.hash.clone();
        }
        true
    }
}
```

### 审计事件分类

| 类别 | 事件 | 记录级别 | 说明 |
|------|------|---------|------|
| 认证 | `auth_success` | Info | UDS 连接认证成功 |
| 认证 | `auth_failure` | Warning | UDS 认证失败（不匹配白名单） |
| 认证 | `token_issued` | Info | HMAC SessionToken 签发 |
| 认证 | `token_revoked` | Warning | 会话吊销（安全事件响应） |
| 授权 | `action_denied` | Warning | 权限不足拒绝操作 |
| 授权 | `domain_mismatch` | Warning | 跨安全域操作被拒绝 |
| 配置 | `component_loaded` | Info | 组件加载 |
| 配置 | `component_unloaded` | Info | 组件卸载 |
| 配置 | `config_changed` | Info | 参数变更 |
| 安全 | `cert_expired` | Error | mTLS 证书过期 |
| 安全 | `crl_updated` | Info | 证书吊销列表更新 |
| 安全 | `rate_limit_hit` | Warning | 连接速率限制触发 |

---

## 7. Phase 1 最小安全集

Phase 1 不实现所有安全机制，只实现最小可行子集：

| 机制 | Phase 1 | Phase 2 | Phase 3+ |
|------|:-------:|:-------:|:--------:|
| SO_PEERCRED 认证 | 是 | 是 | 是 |
| 进程白名单 | 是（硬编码） | 是（YAML 配置） | 是 |
| HMAC SessionToken | 否（仅 SO_PEERCRED） | 是 | 是 |
| 权限矩阵 | 是（简化版） | 是（完整版） | 是 |
| 审计日志（内存） | 是 | 是 | 是 |
| 审计日志（持久化） | 否 | 是（syslog） | 是（journald） |
| 审计完整性链 | 否 | 是 | 是 |
| Zenoh mTLS | 不适用 | 不适用 | 是 |
| 证书吊销 | 不适用 | 不适用 | 是 |
| 速率限制 | 否 | 是 | 是 |

---

## 8. 设计决策记录

| 决策 | 理由 |
|------|------|
| SO_PEERCRED 作为 UDS 认证基础 | 内核提供的不可伪造凭证，比应用层 token 更可靠。无额外网络开销 |
| HMAC SessionToken 补充 SO_PEERCRED | 避免每次消息都做系统调用（getsockopt），同时支持消息级别重放防护 |
| Zenoh mTLS 作为跨主机传输安全 | Zenoh 原生支持 mTLS，无需额外隧道。证书嵌入角色信息，一次握手完成认证 + 授权 |
| 权限矩阵基于 RBAC | 工业场景角色固定（Controller/Supervisor/HMI/Debug），RBAC 足够，无需 ABAC 的灵活性开销 |
| 审计日志用区块链式哈希链 | 工业合规要求审计日志不可篡改。SHA-256 哈希链开销极低（每条日志 O(1) 哈希计算），Phase 1 可选 |
| 安全检查不进入 RT 数据面 | RT 线程（SCHED_FIFO）不能有认证/授权开销。所有安全检查在控制面完成，RT 路径只做纯数据传递 |
| 证书吊销使用 CRL 而非 OCSP | OCSP 需要实时网络请求，在工业网络中断时导致认证失败。CRL 时效性足够（工业环境证书变更频率低） |