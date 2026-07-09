# AUDESYS ROS2 Actions 映射设计

> 生成日期：2026-07-09
> 设计目标：用现有三原语（RPC + StreamChannel + Signal）组合实现 ROS2 Action 语义，不引入第 4 种原语

---

## 设计原则

ROS2 Action 不是一个新的**通信模式**，而是一个**编排模式**——它将 Goal（发起）、Feedback（周期进度）、Result（最终结果）、Cancel（取消）四个阶段组合在一起。

AUDESYS HAL 的三原语已经具备了 Action 所需的全部通信能力：
- **RPC**：Goal 发起、Cancel、Result 获取
- **StreamChannel**：周期 Feedback 流
- **Signal**：状态变更通知（running / done / cancelled / error）

新增第 4 种原语会增加 amw trait 5 个方法，但语义完全可由现有原语拼装。

---

## 1. Action 语义分解

```
                    ┌─────────────────────────┐
                    │      ROS2 Action         │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐    ┌─────────────────────┐    ┌──────────────┐
│     RPC       │    │    StreamChannel     │    │    Signal    │
│               │    │                     │    │              │
│ start_action  │    │ action.{id}.feedback │    │ action.{id}. │
│   → action_id │    │  周期进度更新         │    │   status     │
│               │    │                     │    │              │
│ cancel_action │    │ "homing 完成 60%"     │    │ running /    │
│               │    │ "当前轴: Y"           │    │ done /       │
│ get_result    │    │                     │    │ cancelled /  │
│   → result    │    │                     │    │ error        │
└───────────────┘    └─────────────────────┘    └──────────────┘
```

### 时序图

```
Client                          ActionServer                       HAL
  │                                  │                              │
  │── start_action(goal) ──────────►│                              │
  │                                  │── RPC: home_axis.start ────►│
  │                                  │◄── { action_id: "H001" } ───│
  │◄── { action_id: "H001" } ───────│                              │
  │                                  │                              │
  │                                  │── Signal: action.H001.status│
  │◄── Signal "running" ────────────│   = "running"               │
  │                                  │                              │
  │                                  │── Stream: action.H001.fb ──►│
  │◄── Stream { progress: 0.4 } ────│── Stream { progress: 0.4 } ─│
  │◄── Stream { progress: 0.8 } ────│── Stream { progress: 0.8 } ─│
  │◄── Stream { progress: 1.0 } ────│── Stream { progress: 1.0 } ─│
  │                                  │                              │
  │                                  │── Signal: action.H001.status│
  │◄── Signal "done" ───────────────│   = "done"                  │
  │                                  │                              │
  │── get_result(H001) ────────────►│                              │
  │                                  │── RPC: home_axis.get_result►│
  │                                  │◄── { success: true } ───────│
  │◄── { success: true } ───────────│                              │
```

### 取消时序

```
Client                          ActionServer                       HAL
  │                                  │                              │
  │── cancel_action(H001) ─────────►│                              │
  │                                  │── RPC: home_axis.cancel ───►│
  │                                  │◄── { accepted: true } ──────│
  │◄── { accepted: true } ──────────│                              │
  │                                  │                              │
  │                                  │── Signal: action.H001.status│
  │◄── Signal "cancelled" ──────────│   = "cancelled"             │
  │                                  │                              │
  │                                  │── Stream: action.H001.fb ──►│
  │◄── Stream { progress: 0.5 } ────│── Stream { progress: 0.5 } ─│
  │    (最后一个 feedback)            │                              │
```

---

## 2. 工业场景映射

| 工业场景 | Goal | Feedback | Result | Cancel | 典型时长 |
|----------|------|----------|--------|--------|----------|
| **回零** | "轴 X 回零" | 当前位置、阶段(fast/slow) | 成功 + 零位偏移 | 急停 | 5–30s |
| **换刀** | "刀号 3" | 刀库旋转角度 | 成功 + 刀偏值 | 停止旋转 | 2–10s |
| **校准** | "传感器校准" | 采样进度、残差 | 校准参数 | 保留旧参数 | 10–120s |
| **固件升级** | "hex 文件路径" | 写入进度、扇区号 | 校验和 + 版本 | 回滚 | 30–300s |
| **轨迹执行** | "G-code 文件路径" | 当前行号、轴位置 | 完成 + 执行行数 | 暂停 → 取消 | 可变 |
| **预热** | "目标温度 200°C" | 当前温度、功率 | 到达并稳定 | 停止加热 | 30–600s |

---

## 3. ActionBuilder（应用层便利 API）

ActionBuilder **不是 HAL 协议的一部分**——它是 `packages/hal-action/` 中的可选库，组合 RPC + StreamChannel + Signal 实现 Action 语义。

```rust
/// 应用层 Action 构建器，组合三种 HAL 原语
pub struct ActionBuilder {
    amw: Arc<dyn AmwMiddleware>,
}

/// Action 句柄 — 启动后返回
pub struct ActionHandle {
    pub action_id: String,
    feedback_rx: Box<dyn StreamReader>,      // StreamChannel 反馈
    status_sub: Subscription,                 // Signal 状态变更
    result_pending: oneshot::Receiver<Result<Vec<u8>>>,
}

impl ActionBuilder {
    /// 启动一个 Action
    ///
    /// 内部：
    /// 1. RPC: {method}_start → 获取 action_id
    /// 2. subscribe Signal: action.{action_id}.status
    /// 3. open StreamChannel: action.{action_id}.feedback
    pub async fn start(
        &self,
        action_name: &str,         // "home_axis"
        goal: &[u8],               // FlatBuffers 序列化的 Goal
        timeout_ms: u64,
    ) -> Result<ActionHandle> {
        // 1. 发起 Goal
        let rpc_method = format!("{}.start", action_name);
        let response = self.amw.call_rpc(&rpc_method, goal, timeout_ms)?;
        let action_id = parse_action_id(&response)?;

        // 2. 订阅状态 Signal
        let status_signal = format!("action.{}.status", action_id);
        let status_sub = self.amw.subscribe_signal(&status_signal, |val, _ts| {
            if let HalValue::S32(status) = val {
                match status {
                    0 => log::info!("Action started"),
                    1 => log::info!("Action completed"),
                    2 => log::warn!("Action cancelled"),
                    3 => log::error!("Action error"),
                    _ => {}
                }
            }
        })?;

        // 3. 打开反馈 StreamChannel
        let feedback_stream = format!("action.{}.feedback", action_id);
        let feedback_rx = self.amw.open_stream(&feedback_stream)?;

        // 4. 挂起 Result 等待（内部通过 Signal done → RPC get_result）
        let (tx, rx) = oneshot::channel();
        // ... background task listens for status=done, then calls get_result ...

        Ok(ActionHandle {
            action_id,
            feedback_rx,
            status_sub,
            result_pending: rx,
        })
    }

    /// 取消一个 Action
    pub async fn cancel(
        &self,
        action_name: &str,
        action_id: &str,
    ) -> Result<bool> {
        let rpc_method = format!("{}.cancel", action_name);
        let response = self.amw.call_rpc(
            &rpc_method,
            &serde_json::to_vec(&json!({"action_id": action_id}))?,
            5000,
        )?;
        let result: CancelResponse = serde_json::from_slice(&response)?;
        Ok(result.accepted)
    }

    /// 获取 Action 结果
    pub async fn get_result(
        &self,
        action_name: &str,
        action_id: &str,
        timeout_ms: u64,
    ) -> Result<Vec<u8>> {
        let rpc_method = format!("{}.get_result", action_name);
        self.amw.call_rpc(&rpc_method, &serde_json::to_vec(
            &json!({"action_id": action_id})
        )?, timeout_ms)
    }
}
```

### ActionServer 侧（Component trait 扩展）

```rust
/// 支持 Action 的 Component 实现额外的 RPC 方法
trait ActionComponent: HalComponent {
    /// 列出本组件的 Action 列表
    fn list_actions(&self) -> Vec<ActionDefinition> {
        vec![]
    }

    /// 处理 Action RPC
    fn handle_action_rpc(&self, method: &str, params: &[u8])
        -> Result<Vec<u8>>
    {
        Err(Error::NotSupported)
    }
}

struct ActionDefinition {
    name: String,           // "home_axis"
    goal_schema: String,    // FlatBuffers schema name
    result_schema: String,  // FlatBuffers schema name
    is_cancellable: bool,
}
```

### HomeAxis Action 实现示例

```rust
impl ActionComponent for HomeAxisComponent {
    fn list_actions(&self) -> Vec<ActionDefinition> {
        vec![ActionDefinition {
            name: "home_axis".into(),
            goal_schema: "HomeAxisGoal".into(),
            result_schema: "HomeAxisResult".into(),
            is_cancellable: true,
        }]
    }

    fn handle_action_rpc(&self, method: &str, params: &[u8])
        -> Result<Vec<u8>>
    {
        match method {
            "home_axis.start" => {
                let goal: HomeAxisGoal = flatbuffers::from_slice(params)?;
                let action_id = format!("home_axis_{}", uuid::Uuid::new_v4());

                // 启动后台 RT 回零任务
                self.start_homing(action_id.clone(), goal.axis, goal.speed);

                Ok(serde_json::to_vec(&json!({
                    "action_id": action_id,
                    "accepted": true
                }))?)
            }
            "home_axis.cancel" => {
                let req: CancelRequest = serde_json::from_slice(params)?;
                self.cancel_homing(&req.action_id);
                Ok(serde_json::to_vec(&json!({"accepted": true}))?)
            }
            "home_axis.get_result" => {
                let req: ResultRequest = serde_json::from_slice(params)?;
                let result = self.get_homing_result(&req.action_id)?;
                Ok(flatbuffers::to_vec(&result)?)
            }
            _ => Err(Error::MethodNotFound(method.into())),
        }
    }
}
```

---

## 4. 命名规范

```
action.{action_id}.status     # Signal: Action 状态
action.{action_id}.feedback   # StreamChannel: Action 进度
{component}.{action}.start    # RPC: Goal 发起
{component}.{action}.cancel   # RPC: 取消
{component}.{action}.get_result # RPC: 获取结果
```

**状态码**（Signal `S32`）：

```
0 = running     # Action 执行中
1 = done        # 成功完成
2 = cancelled   # 被取消
3 = error       # 执行失败
```

---

## 5. 与 ROS2 Action 的差异

| | ROS2 Action | AUDESYS Action (方案 B) |
|---|---|---|
| 抽象层 | 独立原语（rmw + rclcpp action client/server） | 组合原语（RPC + StreamChannel + Signal） |
| 服务发现 | 通过 DDS 自动发现 | 通过 amw HalDiscovery 注册 |
| 消息格式 | ROS2 `.action` IDL | FlatBuffers schema |
| Cancel 机制 | 内建 cancel service | 独立 RPC |
| 超时 | 依赖 DDS QoS | `call_rpc` 的 `timeout_ms` 参数 |
| 依赖 | 必须 ROS2 | 可选（`packages/hal-action/`） |

---

## 6. 设计决策记录

| 决策 | 理由 |
|------|------|
| 不引入第 4 种原语 | Action = RPC + StreamChannel + Signal 组合。新增原语会使 amw trait 膨胀 5 个方法 |
| ActionBuilder 在 packages/ 而非 HAL Core | Action 是应用层概念，不应在 HAL 协议层强制要求 |
| 状态用 Signal 而非 StreamChannel | 状态是单值（最新值覆盖），不是流。Signal 语义完全匹配 |
| 反馈用 StreamChannel 而非 Signal | 反馈需要完整时间序列（进度追踪），不能丢弃中间值 |
| ActionComponent trait 独立于 HalComponent | 不是所有 Component 都支持 Action。PLC scan 和 servo thread 不需要 Action |
| action_id 由 Server 生成（UUID v4） | 避免 Client 冲突，且支持幂等去重 |
