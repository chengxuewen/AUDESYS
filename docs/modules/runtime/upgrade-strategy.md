# AUDESYS Runtime 升级策略

> 生成日期：2026-07-15
> 设计目标：在不中断生产运行的前提下，定义 Runtime 全链路升级机制——从 FlatBuffers schema 变更、YAML 配置迁移、Controller 热替换、Supervisor 降级模式、设备固件 OTA 到回滚策略。全链路统一 SemVer 合约。

---

## 设计原则

工业控制系统的升级与普通软件不同。一个正在控制反应釜温度的 Runtime 不能被 SIGTERM 后重启。升级必须以原地热操作为首选路径，以 brownout 模式作为兜底。

1. **向前兼容** — 新 Runtime 必须加载旧配置和旧 schema（读路径全兼容）
2. **原地升级** — Controller hot-swap 是默认路径，不重启进程
3. **原子切换** — hot-swap 在单次 Config Barrier 边界完成，无中间态
4. **回滚能力** — 每次升级自动保留前一个可恢复 checkpoint
5. **降级不宕机** — 升级失败时进入 brownout 模式，维持基础信号输出

参考：D24（YAML + FlatBuffers）、D17（Config Barrier）、D28（冗余预留）

---

## 1. SemVer 策略

Runtime 全组件统一语义化版本号：

```
MAJOR.MINOR.PATCH[-build_metadata]
  │      │     │
  │      │     └─── PATCH: bugfix, 100% 向前兼容，无需 hot-swap
  │      └───────── MINOR: 新增功能，读路径兼容，走 hot-swap
  └──────────────── MAJOR: 破坏性变更，需停机升级
```

| 合约 | MAJOR 触发条件 | MINOR 兼容范围 |
|------|---------------|---------------|
| FlatBuffers Schema | 删除 field / 改类型 / 重命名 | 新增 optional field（默认值填充） |
| YAML 配置 | 删除 key / 改嵌套结构 | 新增 key（旧版本忽略） |
| HAL RPC 接口 | 改签名 / 删方法 | 新增方法（不破坏现有调用） |
| Signal/StreamChannel topic | 改 topic / payload 类型 | 新增 topic（不影响现有订阅） |
| Controller ABI | 改 trait 方法签名 | 新增方法（默认实现兜底） |

PATCH 变更不触发 hot-swap，走标准 Config Barrier 路径。

---

## 2. FlatBuffers Schema 版本化

### file_identifier 注册

每个 `.fbs` 文件声明 4 字节 magic：

```
// hal_value.fbs —─→ file_identifier "HV01";
// signal.fbs    —─→ file_identifier "SG01";
```

`runtime/schema-registry.yaml` 记录全部历史版本：

```yaml
- file: hal_value.fbs, identifier: HV01, since: v0.1.0,
  compatible_until: v1.2.0, removed_in: v2.0.0
- file: signal.fbs, identifier: SG01, since: v0.1.0,
  compatible_until: null     # 无废弃计划
```

### 运行时版本检测

```
FlatBuffer 加载 → identifier 匹配 registry?
  ├── ✅ → 正常加载
  └── ❌ → 查兼容映射表 runtime/schema-migrations/
       ├── 有映射 → 运行时拷贝转换（MINOR 级变更自动处理）
       └── 无映射 → 拒绝加载 + 错误记录（MAJOR 级需停机）
```

兼容映射表注册迁移函数：

```rust
// hal_value_v1_to_v2.rs
// 新增 optional 字段: velocity (F32, 默认 0.0)
impl SchemaMigration for HalValueV1ToV2 {
    fn migrate(&self, src: &[u8]) -> Vec<u8> {
        // flatc builder + 旧数据 + 新字段默认值
    }
}
```

MAJOR 版本禁止运行时自动迁移。

参考：D39（FlatBuffers Schema 手写 .fbs + flatc 生成）

---

## 3. YAML 配置迁移

### 双阶段链式迁移

```
YAML 文件 → Phase 1: 提取 version 字段
                  → Phase 2: 迁移管线链式执行
                      v0.1 → v0.2 → v0.3 → ... → current
                  → JSON Schema 验证 → 加载到内存
```

每个 MINOR 版本在 `runtime/config-migrations/` 下注册迁移 YAML：

```yaml
# v0.2-to-v0.3.yaml
version: 0.3
migrations:
  - path: runtime.engine.scheduling
    action: rename_key
    from: scan_mode
    to: scheduling_mode
  - path: runtime.logging.level
    action: map_value
    mapping: {"0": "error", "1": "warn", "2": "info", "3": "debug"}
  - path: runtime.hal.signal_pool_size
    action: remove
```

迁移管线保证幂等性——同一版本不重复执行。迁移后的 YAML 必须通过当前版本 JSON Schema 验证，不合规则报错并提示人工介入。

---

## 4. Controller Hot-Swap

Controller 是 Runtime 的执行单元（funct_list + 配置上下文）。hot-swap 在不重启进程的前提下替换运行中的 Controller。

### 触发条件

Supervisor RPC `controller.hot_swap(id, new_wasm)`、Studio OTA 推送新 component、YAML 配置升级、回滚操作。

### 三步协议

```
prepare_swap(ctrl_id, binary, checksum)
  → 后台加载 new binary 到暂存区
  → 验证 checksum + ABI 签名
  → 回复 swap_ready

commit_swap(ctrl_id)
  → Config Barrier 排队
  → 下一周期边界执行：
      freeze() —— 停止旧 controller
      migrate_state() —— FlatBuffers 序列化 → 兼容映射 → 反序列化
      load() —— 挂载新 controller
      unfreeze() —— 继续执行
  → 回复 swap_result(OK/FAIL)
```

### 原子性保证

全部操作在单次 Config Barrier 内完成。如果 `load()` 失败，自动回滚：

```
freeze() → migrate_state() → load() ❌ → unfreeze(旧) + 记录错误
```

旧 controller 的数据结构在 `freeze()` 后驻留内存直到 `unfreeze()` 确认。

参考：D17（Config Barrier 设计）

---

## 5. Supervisor Brownout Mode

当升级失败或关键组件不可用时，Supervisor 不宕机，降级运行。

### 触发场景

Controller hot-swap 失败（load 返回 Err 且回滚也失败）、OTA 固件校验不通过、配置迁移验证失败、关键子进程崩溃、资源耗尽。

### 降级行为

- RT cycle 继续运行，已有 Signal/Stream 持续输出
- 新 RPC 拒绝（仅 `rollback` 命令接受）
- hot-swap 和 OTA 暂停
- 输出保持最后有效值
- 发布 Signal `runtime.brownout`
- 日志告警每 5s 重复
- Watchdog 30min 超时 → safe halt（输出安全态值）

### 退出条件

Supervisor 手动 `resume` 命令 → 从上一个 good checkpoint 重新加载。回滚成功 → 自动退出 brownout。

---

## 6. Device Firmware OTA

Runtime 通过 StreamChannel 为 HAL 设备推送固件更新，分块传输避免阻塞 RT 周期。

### 协议参数

| 参数 | 值 | 说明 |
|------|-----|------|
| Chunk size | 64 KB | 匹配典型 MCU Flash page |
| Checksum | SHA-256 | 每块独立 + 整体校验 |
| Signature | Ed25519 | Studio 签名，Runtime 验证 |
| Max concurrent | 4 | 同时升级设备上限 |
| Timeout | 30s per chunk | 超时自动中止 |
| Rollback | 设备保留前版本 | RPC 触发回退 |

### 流程

```
Studio → firmware_push(binary, dev_id) → Runtime 验证签名
  → 分块 (64KB) → stream: dev.ota.chunk[i] → 设备 ack
  → 全部 ack → stream: dev.ota.commit → 设备校验 + 切换
  → Runtime 回复 status(OK/FAIL)
```

### 设备约束

支持 A/B Flash 分区（至少 2× firmware size），升级期间 watchdog 不触发。HART 多通道设备通过 HAL IO Mapping 挂载为单 OTA 端点，每个通道独立升级。

---

## 7. Rollback 策略

每次成功升级（hot-swap / OTA / 配置迁移）后，Runtime 在 `runtime/checkpoints/` 下保存快照：

```
runtime/checkpoints/
├── v0.1.0/
│   ├── schema-registry.snapshot
│   ├── config.validated.yaml
│   ├── controllers.manifest
│   └── firmware-manifest
└── current -> v0.2.0
```

### 回滚流程

```
rollback(version=v0.1.0):
  1. 验证 checkpoint 存在 → 暂停新 RPC（进 brownout）
  2. 恢复 v0.1.0 配置 → 对每个 controller hot_swap(旧 binary)
  3. 对每个设备 dev.ota.rollback(前一个固件)
  4. 更新 current symlink → v0.1.0 → 退出 brownout
  5. 记录 RollbackEvent
```

### 限制

最多保留 3 个 checkpoint（磁盘空间控制）。跨 MAJOR 版本不回滚（schema 不兼容）。回滚是全量替换，不做 diff apply。

---

## 8. 升级事件审计

所有升级、回滚、brownout 事件写入 `runtime/audit/upgrade-events.log`：

```json
{"ts":"2026-07-15T10:00:00Z","event":"hot_swap","ctrl_id":"pid-loop-01","from":"v0.1.0","to":"v0.2.0","result":"ok"}
{"ts":"2026-07-15T10:05:00Z","event":"brownout_enter","reason":"config_migration_validation_failed"}
{"ts":"2026-07-15T10:06:00Z","event":"rollback","from":"v0.2.0","to":"v0.1.0","result":"ok"}
```

---

## 9. 各 Phase 支持矩阵

| 功能 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| FlatBuffers schema 版本检测 | ✅ identifier 校验 | ✅ 兼容映射表 | ✅ 自动降级读取 |
| YAML 配置迁移 | ✅ 链式 YAML 脚本 | ✅ JSON Schema 验证 | ✅ 交互式迁移预览 |
| Controller hot-swap | ✅ 单次 Config Barrier | ✅ state migration | ✅ A/B 双版本并行 |
| Supervisor brownout | ✅ 基础模式 | ✅ 可配置安全态 | ✅ 智能降级策略 |
| 设备固件 OTA | ❌ | ✅ HART 有限设备 | ✅ EtherCAT + 批量 |
| Rollback checkpoint | ✅ 3 个 checkpoint | ✅ 跨 MINOR 智能合并 | ✅ 分布式 checkpoint |
| 审计日志 | ✅ JSON 文件 | ✅ 结构化日志查询 | ✅ 集成 Studio |

---

## 参考

- D17: Config Barrier 与 LockLevel — `docs/modules/hal/config-barrier-design.md`
- D24: YAML + FlatBuffers 配置格式 — `docs/architecture.md` §二
- D28: StreamChannel 冗余预留 — `docs/modules/hal/hal-protocol-design.md`
- D39: FlatBuffers Schema 手写策略 — `.agents/memorys/decisions.md`