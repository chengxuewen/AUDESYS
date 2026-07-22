# T2a.2 — GLSP LD Server 设计规范

> **任务**: Phase 2a, T2a.2
> **关联**: `docs/plans/p1-execution-refinement.md` §Phase 2a, `openspec/specs/studio-theia-spec.md` STH-GLSP (021-030)
> **参考**: Neuron Automation (logi.cals 基于 Theia+GLSP 的 IEC 61131-3 IDE)
> **状态**: Draft

---

## 1. 架构概览

```
┌──────────────────────┐
│  GLSP Client (Theia) │  Browser 渲染进程
│  ┌────────────────┐  │
│  │ LD Editor      │  │  sprotty SVG 渲染 + Tool Palette + Property View
│  │ (sprotty)      │  │
│  └───────┬────────┘  │
│          │ WebSocket JSON-RPC (ActionMessage)
│          ▼
│  ┌────────────────┐  │
│  │ GLSP Client    │  │  @eclipse-glsp/client
│  │ Provider       │  │
│  └────────────────┘  │
└──────────────────────┘
          │
          │ ActionMessage (JSON)
          ▼
┌──────────────────────────────────────────────┐
│  GLSP Server (Node.js, Theia Backend)         │
│  ┌────────────────────────────────────────┐  │
│  │ LDGLSPServer                           │  │
│  │ ├─ DiagramModule (dependency injection) │  │
│  │ ├─ LDDiagramGenerator  — GModel生成     │  │
│  │ ├─ LDOperationHandler  — 15 操作        │  │
│  │ ├─ LDValidStateManager — 状态机         │  │
│  │ └─ LDBridgeClient      — napi-rs 客户端 │  │
│  └───────────────┬────────────────────────┘  │
│                  │ postMessage (structured)   │
│  ┌───────────────▼────────────────────────┐  │
│  │ napi-rs worker_thread                  │  │
│  │ ┌──────────────────────────────────┐   │  │
│  │ │ WorkerPool (poolSize=4)          │   │  │
│  │ │ ├─ ld_compile()                  │   │  │
│  │ │ ├─ ld_layout_rungs()             │   │  │
│  │ │ ├─ ld_validate_connectivity()    │   │  │
│  │ │ └─ ld_roundtrip_verify()         │   │  │
│  │ └──────────────────────────────────┘   │  │
│  └───────────────┬────────────────────────┘  │
│                  │ FFI (napi-rs)              │
│  ┌───────────────▼────────────────────────┐  │
│  │ Rust Layout Engine                     │  │
│  │ crates/audesys-ld-layout/             │  │
│  │ ┌──────────────────────────────────┐   │  │
│  │ │ layout_rungs()  — 电源轨对齐      │   │  │
│  │ │ layout_contacts() — 触点水平分布   │   │  │
│  │ │ layout_coils()  — 线圈右对齐       │   │  │
│  │ │ route_wires()   — 连线直角路由     │   │  │
│  │ │ auto_number_rungs() — 梯级编号     │   │  │
│  │ │ validate_connectivity() — 连接检测 │   │  │
│  │ └──────────────────────────────────┘   │  │
│  └───────────────┬────────────────────────┘  │
│                  │ Cargo dependency           │
│  ┌───────────────▼────────────────────────┐  │
│  │ Rust LD Compiler                       │  │
│  │ crates/audesys-ld-compiler/            │  │
│  │ ┌──────────────────────────────────┐   │  │
│  │ │ ld_compile(source) → IL text      │   │  │
│  │ │   └→ il_compile(IL) → HalProgram │   │  │
│  │ └──────────────────────────────────┘   │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**数据流方向**:
- GLSP Client → ActionMessage (e.g. `CreateContactOperation`) → GLSP Server
- GLSP Server → GModel解析 → napi-rs worker → Rust Layout Engine → 返回布局坐标
- GLSP Server → GModel→LD源码文本 → napi-rs worker → Rust LD Compiler → HalProgram/Diagnostics
- GLSP Server → GModel Delta (e.g. `AddContactNodeAction`) → GLSP Client

---

## 2. GModel 类型定义

### 2.1 节点类型

```typescript
// ====== GModel Element Types ======

interface LDContactNode extends GNode {
  type: 'node:contact';
  args: {
    contactType: 'NO' | 'NC';      // 常开 / 常闭
    variableRef: string;            // 绑定变量名, e.g. "X1"
    negated: boolean;               // 取反标志 (IEC 61131-3)
  };
  layout?: 'hbox';
  children: [GCompartment];         // 内含 variable label
}

interface LDCoilNode extends GNode {
  type: 'node:coil';
  args: {
    coilType: 'OUT' | 'SET' | 'RESET';  // 线圈类型
    variableRef: string;                 // 绑定变量名, e.g. "Y1"
    negated: boolean;
  };
  children: [GCompartment];
}

interface LDPowerRail extends GNode {
  type: 'node:powerrail';
  args: {
    side: 'LEFT' | 'RIGHT';
  };
}

interface LDRung extends GNode {
  type: 'node:rung';
  args: {
    rungNumber: number;            // 梯级编号 001, 002, ...
    comment: string;               // 梯级注释
  };
  children: GNode[];               // 包含 contacts + coils + wires
}

// ====== Edge Types ======

interface LDWireConnection extends GEdge {
  type: 'edge:wire';
  sourceId: string;                // 源节点 ID
  targetId: string;                // 目标节点 ID
  routingPoints?: Point[];        // 手动路由拐点
}

// ====== GGraph Root ======

interface LDDiagramGraph extends GGraph {
  type: 'graph:ld';
  children: LDRung[];             // 顶层 children 是梯级列表
}
```

### 2.2 坐标约定

| 坐标系 | 说明 |
|--------|------|
| 原点 (0,0) | 左上角 |
| 左电源轨 x | 固定 x=0 |
| 右电源轨 x | 画布宽度 - PowerRail宽度 |
| 梯级 y 间距 | 80px（含元素高度 36px + 上下留白） |
| 触点 x 步进 | 120px（触点间水平间距） |
| 线圈 x | PowerRail间距 - 120px |
| 连线 | 直角正交路由，拐点自动计算 |

### 2.3 往返序列化

GModel 支持 JSON 序列化往返：`JSON.parse(JSON.stringify(gmodel)) === gmodel`

```typescript
// 序列化（发送到Client）
const delta: ActionMessage = {
  kind: 'updateModel',
  data: JSON.stringify(gmodelRoot)
};

// 反序列化（从Client接收）
const model: LDDiagramGraph = JSON.parse(receivedDelta);
```

---

## 3. 15 操作规范

| # | 操作名 | GLSP Action Type | 输入 GModel Delta | napi-rs 函数 | 输出 GModel Delta | 验证规则 |
|---|--------|-----------------|-------------------|-------------|-------------------|---------|
| 1 | **CreateContact** | `CreateNodeOperation` | `{elementTypeId: 'contact', contactType: 'NO'\|'NC', rungId: string, position: {x,y}}` | — | `AddContactNodeAction {node: LDContactNode}` 含自动赋默认变量名 `"??"` | ① 位置在梯级有效区域内 ② 不在线圈右侧 |
| 2 | **CreateCoil** | `CreateNodeOperation` | `{elementTypeId: 'coil', coilType: 'OUT'\|'SET'\|'RESET', rungId: string, position: {x,y}}` | — | `AddCoilNodeAction {node: LDCoilNode}` | ① 每梯级最多 1 个线圈 ② 位置在线圈区域(y对齐) ③ 触点已存在才可添加 |
| 3 | **CreatePowerRail** | `CreateNodeOperation` | `{elementTypeId: 'powerrail:left'\|'powerrail:right', position: {x,y}}` | — | `AddPowerRailAction {node: LDPowerRail}` | ① 每个梯级最多左右各 1 个 |
| 4 | **CreateRung** | `CreateNodeOperation` | `{elementTypeId: 'rung', position?: {x,y}}` | `ld_layout_rungs(allRungs)` | `AddRungAction {node: LDRung}` + 自动编号 | ① 新梯级插入在点击位置下方 |
| 5 | **DeleteElement** | `DeleteElementOperation` | `{elementIds: [string]}` | — | `RemoveNodesAction {elementIds}` | ① 删除触点同时删除关联连线 ② 线圈不可单独删除（清空梯级可删） |
| 6 | **DeleteRung** | `DeleteElementOperation` | `{elementIds: [rungId]}` | `ld_layout_rungs(allRungs)` | `RemoveNodesAction {elementIds}` + 重新编号后续梯级 | ① 删除后至少保留 1 个梯级 |
| 7 | **MoveElement** | `ChangeBoundsOperation` | `{elementId: string, newPosition: {x,y}, newSize?: {w,h}}` | `ld_layout_rungs(affectedRung)` | `ChangeBoundsAction {elementId, newPosition, newSize}` | ① 不越界 ② 不与其他元素重叠 ③ 触点 x 在线圈左侧 |
| 8 | **ReconnectWire** | `ReconnectEdgeOperation` | `{edgeElementId: string, sourceElementId: string, targetElementId: string}` | `ld_validate_connectivity(rungGModel)` | `ChangeRoutingPointsAction {edgeElementId, routingPoints}` | ① 不形成短路(电源轨直连) ② 不从输出回连输入 |
| 9 | **ChangeVariableRef** | `ApplyLabelEditOperation` | `{labelId: string, text: string}` | `ld_roundtrip_verify(text)` | `UpdateNodeLabelAction {labelId, text}` | ① 变量名符合 `[A-Za-z_][A-Za-z0-9_]*` ② 不重名（同梯级内） |
| 10 | **ToggleContactType** | `InvokeActionOperation` | `{actionId: 'toggleContactType', elementId: string}` | — | `UpdateNodeArgsAction {elementId, args: {contactType: flipped}}` | ① NO→NC 或 NC→NO |
| 11 | **ToggleCoilType** | `InvokeActionOperation` | `{actionId: 'toggleCoilType', elementId: string}` | — | `UpdateNodeArgsAction {elementId, args: {coilType: next}}` | ① OUT→SET→RESET→OUT 循环 |
| 12 | **ReorderRungs** | `ChangeBoundsOperation` | `{elementId: rungId, newPosition: {x,y}}` (y 坐标变更视为重排) | `ld_layout_rungs(allRungs)` | `ChangeBoundsAction[]` 所有受影响的梯级 | ① 根据新的 y 坐标重新编号 |
| 13 | **CompileRung** | `InvokeActionOperation` | `{actionId: 'compile', rungId: string}` | `ld_compile(rungAsLDText)` | `SetMarkersAction {diagnostics}` | ① LD→IL→HalProgram 管道全通 ② 编译错误返回 marker |
| 14 | **ValidateConnectivity** | `RequestBoundsAction` | `{rungId: string}` | `ld_validate_connectivity(rungGModel)` | `SetMarkersAction {diagnostics}` 或空 markers | ① 所有触点/线圈有连线 ② 左→右电源轨连通 ③ 无浮空线段 |
| 15 | **LayoutRungs** | `InvokeActionOperation` | `{actionId: 'layoutAll'}` | `ld_layout_rungs(allRungs)` | `ChangeBoundsAction[]` 所有元素新坐标 + `UpdateRoutingPointsAction[]` | ① 电源轨对齐 ② 梯级自动编号 ③ 连线自动路由 |

---

## 4. 操作处理器详细规格

### 4.1 CreateContact — 输入/输出形状

```typescript
// ====== 输入 (GLSP Client → Server) ======
interface CreateContactInput {
  kind: 'CreateNodeOperation';
  elementTypeId: 'contact';
  containerId: string;       // rung ID
  location: { x: number; y: number };
  args: {
    contactType: 'NO' | 'NC';
  };
}

// ====== 处理逻辑 ======
async function handleCreateContact(input: CreateContactInput): Promise<Action[]> {
  const rung = model.getNode(input.containerId);
  // 验证
  if (rung.hasCoil()) {
    const coil = rung.findCoil();
    if (input.location.x >= coil.position.x) {
      throw new ValidationError('Contact must be left of coil');
    }
  }
  // 创建节点
  const node: LDContactNode = {
    id: uuid(),
    type: 'node:contact',
    position: snapToGrid(input.location),
    size: { width: 36, height: 36 },
    args: {
      contactType: input.args.contactType,
      variableRef: '??',      // 默认占位变量
      negated: false,
    },
  };
  // 如果梯级已有触点且新触点在最后触点之后，自动连线前一个触点→新触点
  const prevContact = rung.lastContact();
  const wires: Action[] = [];
  if (prevContact) {
    // 前一个触点→新触点 自动连线
    const wire = createWire(prevContact.id, node.id);
    wires.push({ kind: 'AddEdgeAction', edge: wire });
  }
  // 如果是第一个触点，自动从左电源轨连线
  const powerRail = rung.powerRail('LEFT');
  if (powerRail && !prevContact) {
    wires.push({ kind: 'AddEdgeAction', edge: createWire(powerRail.id, node.id) });
  }
  return [
    { kind: 'AddNodeAction', node },
    ...wires,
  ];
}
```

### 4.2 DeleteElement — 级联删除

```typescript
async function handleDeleteElement(input: DeleteElementInput): Promise<Action[]> {
  const actions: Action[] = [];
  for (const elementId of input.elementIds) {
    const element = model.getElement(elementId);
    // 级联：删除所有关联连线
    const connectedEdges = model.getConnectedEdges(elementId);
    for (const edge of connectedEdges) {
      actions.push({ kind: 'RemoveEdgeAction', elementId: edge.id });
    }
    actions.push({ kind: 'RemoveNodeAction', elementId });
  }
  return actions;
}
```

### 4.3 ReconnectWire — 验证规则

```typescript
async function handleReconnectWire(input: ReconnectEdgeInput): Promise<Action[]> {
  const rung = model.rungOf(input.sourceElementId);

  // 验证1: 不形成短路
  if (sourceIsPowerRail(input.sourceElementId) && targetIsPowerRail(input.targetElementId)) {
    // Rust 端验证
    const result = await bridge.ld_validate_connectivity({
      rung: rung.toJSON(),
      proposedEdge: { from: input.sourceElementId, to: input.targetElementId },
    });
    if (result.hasShortCircuit) {
      throw new ValidationError('Short circuit: power rails cannot connect directly');
    }
  }

  // 验证2: 不从输出回连输入
  if (sourceIsCoil(input.sourceElementId)) {
    throw new ValidationError('Cannot connect from coil output');
  }

  // 计算最优路由点
  const routingPoints = calculateOrthogonalRoute(
    model.getElement(input.sourceElementId),
    model.getElement(input.targetElementId),
  );

  return [{
    kind: 'ChangeRoutingPointsAction',
    elementId: input.edgeElementId,
    routingPoints,
  }];
}
```

### 4.4 CompileRung — 编译管道

```typescript
async function handleCompileRung(input: CompileRungInput): Promise<Action[]> {
  const rung = model.getNode(input.rungId);

  // Step 1: GModel → LD 文本格式
  const ldSource = rungToLdText(rung);
  // 例: "NETWORK\n  NO X1\n  NO X2\n  OUT Y1"

  // Step 2: napi-rs 调用 Rust LD Compiler
  const result = await bridge.ld_compile(ldSource);

  if (result.success) {
    // 编译成功：存储 HalProgram 到 rung metadata
    rung.args.halProgramDigest = result.digest;
    return []; // 无 marker
  } else {
    // 编译失败：返回 markers
    return [{
      kind: 'SetMarkersAction',
      markers: result.errors.map(err => ({
        elementId: mapToElement(rung, err),
        label: err.message,
        severity: err.isWarning ? 'warning' : 'error',
      })),
    }];
  }
}

// GModel → LD 文本转换
function rungToLdText(rung: LDRung): string {
  const lines: string[] = ['NETWORK'];
  for (const child of rung.children) {
    if (child.type === 'node:contact') {
      lines.push(`  ${child.args.contactType} ${child.args.variableRef}`);
    } else if (child.type === 'node:coil') {
      lines.push(`  ${child.args.coilType} ${child.args.variableRef}`);
    }
  }
  return lines.join('\n');
}
```

### 4.5 LayoutRungs — 全局布局

```typescript
async function handleLayoutAll(): Promise<Action[]> {
  // 将所有梯级编码为 Rust Layout Engine 输入
  const input = model.rungs().map(rung => ({
    rungId: rung.id,
    contacts: rung.contacts().map(c => ({ id: c.id, x: c.position.x })),
    coil: rung.coil() ? { id: rung.coil().id } : null,
    wires: rung.edges().map(e => ({
      id: e.id,
      from: e.sourceId,
      to: e.targetId,
      routingPoints: e.routingPoints ?? [],
    })),
  }));

  // napi-rs 调用 Rust Layout Engine
  const layoutResult = await bridge.ld_layout_rungs(input);

  // 解析布局结果 → GModel Actions
  const actions: Action[] = [];
  for (const rungLayout of layoutResult.rungs) {
    actions.push({
      kind: 'UpdateNodeArgsAction',
      elementId: rungLayout.rungId,
      args: { rungNumber: rungLayout.rungNumber },
    });
    for (const pos of rungLayout.positions) {
      actions.push({
        kind: 'ChangeBoundsAction',
        elementId: pos.elementId,
        newPosition: { x: pos.x, y: pos.y },
      });
    }
    for (const route of rungLayout.routes) {
      actions.push({
        kind: 'ChangeRoutingPointsAction',
        elementId: route.edgeId,
        routingPoints: route.points,
      });
    }
  }
  return actions;
}
```

---

## 5. GModel 状态机

```
                        ┌─────────────┐
          edit started   │             │  validation triggered
     ┌──────────────────►│  Modified   │──────────────────────┐
     │                   │             │                      │
     │                   └──────┬──────┘                      │
     │                          │                             │
     │                          │ save/compile                │
     │                          ▼                             ▼
┌─────────────┐          ┌─────────────┐              ┌─────────────┐
│             │          │             │    pass      │             │
│ Unmodified  │◄─────────│ Validating  │─────────────►│   Valid     │
│             │  undo/   │             │              │             │
│             │  reset   │             │◄─────────────│             │
└─────────────┘          └──────┬──────┘    re-edit   └─────────────┘
     ▲                          │
     │                          │ fail (compile error)
     │                          ▼
     │                   ┌─────────────┐
     │                   │             │
     └───────────────────│   Invalid   │
           edit (auto)   │             │
                         └─────────────┘
```

### 5.1 状态定义

| 状态 | 含义 | GLSP 表现 |
|------|------|-----------|
| `Unmodified` | GModel 自上次编译未变 | 无视觉指示 |
| `Modified` | GModel 已编辑但未编译 | Status Bar: "LD · Modified" |
| `Validating` | napi-rs 编译进行中 | Status Bar: spinner + "Compiling..." |
| `Valid` | 编译通过，HalProgram 已缓存 | Status Bar: "LD · ✓ Valid" + 绿色勾 |
| `Invalid` | 编译失败，存在 diagnostics | Error markers on affected elements + Status Bar: "LD · ✗ Errors" |

### 5.2 状态转换

```typescript
class LDValidStateManager {
  private state: LdState = 'Unmodified';
  private lastValidModel: LDDiagramGraph | null = null;
  private lastHalProgram: HalProgram | null = null;

  // 任何 GLSP 编辑操作触发
  onOperationExecuted(operation: Operation): void {
    this.state = 'Modified';
  }

  // 用户触发编译 (Ctrl+S 或 toolbar compile)
  async compile(model: LDDiagramGraph): Promise<Action[]> {
    this.state = 'Validating';

    try {
      const ldSource = modelToLdText(model);
      const result = await bridge.ld_compile(ldSource);

      if (result.success) {
        // 编译通过 — 保存快照用于回滚+热交换
        this.lastValidModel = deepClone(model);
        this.lastHalProgram = result.program;
        this.state = 'Valid';
        return [];
      } else {
        // 编译失败
        this.state = 'Invalid';
        return [{ kind: 'SetMarkersAction', markers: resultToMarkers(result) }];
      }
    } catch (err) {
      this.state = 'Invalid';
      return [{ kind: 'SetMarkersAction', markers: [serverErrorMarker(err)] }];
    }
  }

  // 回滚到上次有效状态
  rollback(): Action[] {
    if (this.lastValidModel) {
      this.state = 'Valid';
      return [{ kind: 'updateModel', data: JSON.stringify(this.lastValidModel) }];
    }
    return [];
  }

  // 用户继续编辑
  onEdit(): void {
    if (this.state === 'Valid' || this.state === 'Invalid') {
      this.state = 'Modified';
    }
  }
}
```

---

## 6. napi-rs Bridge 契约

### 6.1 worker_thread 通信模型

```typescript
// ====== Bridge Client (GLSP Server 端) ======

import { Worker } from 'node:worker_threads';

interface BridgeMessage {
  id: string;                    // 请求ID (UUID v4)
  fn: string;                    // napi-rs 函数名
  payload: unknown;              // 函数参数
}

interface BridgeResponse {
  id: string;                    // 匹配请求ID
  ok: true;
  data: unknown;
} | {
  id: string;
  ok: false;
  error: BridgeError;
}

interface BridgeError {
  code: string;                  // 机器可读错误码
  message: string;               // 人类可读错误信息
  details?: unknown;             // 结构化详情 (diagnostics, line numbers, etc.)
}

// 超时配置
const DEFAULT_TIMEOUT_MS = 5_000;   // 编译类操作
const LAYOUT_TIMEOUT_MS = 1_000;    // 布局类操作
const VALIDATE_TIMEOUT_MS = 500;    // 验证类操作

class LDBridgeClient {
  private workers: Worker[] = [];
  private pending = new Map<string, { resolve, reject, timer }>();
  private nextWorker = 0;

  constructor(poolSize: number = 4) {
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(this.createWorker());
    }
  }

  async ld_compile(ldSource: string): Promise<CompileResult> {
    return this.call({
      fn: 'ld_compile',
      payload: { source: ldSource },
      timeout: DEFAULT_TIMEOUT_MS,
    });
  }

  async ld_layout_rungs(rungs: RungInput[]): Promise<LayoutResult> {
    return this.call({
      fn: 'ld_layout_rungs',
      payload: { rungs },
      timeout: LAYOUT_TIMEOUT_MS,
    });
  }

  async ld_validate_connectivity(rung: RungJSON): Promise<ValidationResult> {
    return this.call({
      fn: 'ld_validate_connectivity',
      payload: { rung },
      timeout: VALIDATE_TIMEOUT_MS,
    });
  }

  private call(opts: { fn: string; payload: unknown; timeout: number }): Promise<unknown> {
    const id = uuid();
    const worker = this.workers[this.nextWorker++ % this.workers.length];

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeError('TIMEOUT', `Function '${opts.fn}' timed out after ${opts.timeout}ms`));
      }, opts.timeout);

      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, fn: opts.fn, payload: opts.payload });
    });
  }
}
```

### 6.2 Rust 端 napi-rs 函数签名

```rust
// crates/audesys-theia-bridge/src/ld_bridge.rs

use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Compile LD source text to HalProgram JSON.
/// Wraps audesys_ld_compiler::ld_compile + audesys_il_compiler::il_compile.
#[napi]
pub fn ld_compile(source: String) -> Result<CompileResult> {
    let il = audesys_ld_compiler::ld_compile(&source)
        .map_err(|e| napi::Error::from_reason(format!("LD compile: {}", e)))?;
    let hal = audesys_il_compiler::il_compile(&il)
        .map_err(|e| napi::Error::from_reason(format!("IL compile: {}", e)))?;
    let json = serde_json::to_string(&hal)
        .map_err(|e| napi::Error::from_reason(format!("Serialize: {}", e)))?;
    Ok(CompileResult { success: true, program_json: json, errors: vec![] })
}

/// Layout all rungs — auto-align power rails, number rungs, route wires.
#[napi]
pub fn ld_layout_rungs(rungs_json: String) -> Result<LayoutResult> {
    let rungs: Vec<RungInput> = serde_json::from_str(&rungs_json)
        .map_err(|e| napi::Error::from_reason(format!("Parse input: {}", e)))?;
    let result = audesys_ld_layout::layout_rungs(&rungs);
    let json = serde_json::to_string(&result)
        .map_err(|e| napi::Error::from_reason(format!("Serialize: {}", e)))?;
    Ok(serde_json::from_str(&json)?)
}

/// Validate connectivity of a single rung — detect short circuits, floating wires.
#[napi]
pub fn ld_validate_connectivity(rung_json: String) -> Result<ValidationResult> {
    let rung: RungJSON = serde_json::from_str(&rung_json)
        .map_err(|e| napi::Error::from_reason(format!("Parse input: {}", e)))?;
    Ok(audesys_ld_layout::validate_connectivity(&rung))
}

/// Verify a variable name is syntactically valid for LD context.
#[napi]
pub fn ld_verify_variable(name: String) -> Result<VerifyResult> {
    let valid = audesys_ld_layout::is_valid_variable(&name);
    Ok(VerifyResult { valid, message: if valid { String::new() } else { format!("Invalid variable name: '{}'", name) } })
}
```

### 6.3 错误序列化格式

```typescript
// 统一错误格式 — 所有 Rust 错误经 napi-rs 序列化为:
interface UnifiedError {
  code: string;          // "COMPILE_ERROR" | "LAYOUT_ERROR" | "VALIDATION_ERROR" | "TIMEOUT" | "BRIDGE_ERROR"
  message: string;       // 人类可读描述
  diagnostics?: LdDiagnostic[];
}

interface LdDiagnostic {
  severity: 'error' | 'warning';
  elementId?: string;    // 可关联到 GModel 元素
  line?: number;         // 源码行号 (LD 文本格式)
  column?: number;
  message: string;
  code: string;          // 诊断码 e.g. "E001", "W002"
}
```

---

## 7. 错误处理与回滚

### 7.1 编译失败处理

```
User compiles → GLSP Server sends GModel to Rust
  ├─ SUCCESS → Save snapshot, goto Valid state
  └─ FAILURE →
       ├─ Keep GModel AS-IS (don't revert user's edits)
       ├─ Show error markers on affected elements
       ├─ Transition to Invalid state
       ├─ Status Bar: "LD · ✗ 3 Errors"
       └─ User fixes errors → retrigger compile → If passes → goto Valid
```

### 7.2 运行时连接验证失败

```
User reconnects wire → GLSP Server calls ld_validate_connectivity
  ├─ PASS → Apply ReconnectEdgeOperation, return routing points
  └─ FAIL (e.g. short circuit) →
       ├─ Reject the operation (no GModel change)
       ├─ Show notification: "Cannot connect: short circuit detected"
       └─ Wire snaps back to original connection
```

### 7.3 Bridge 超时处理

```
napi-rs worker 超时 (>5s for compile, >1s for layout)
  ├─ AbortController 发送取消信号
  ├─ 返回 TIMEOUT error
  ├─ Status Bar: "LD · ⚠ Compile timed out"
  ├─ 回滚到 Valid 状态（用 lastValidModel 快照）
  └─ 不破坏 GModel UI 状态
```

### 7.4 回滚机制

```typescript
// 每步编译成功后自动保存快照
class UndoStack {
  private snapshots: LDDiagramGraph[] = [];
  private pointer: number = -1;
  private readonly MAX_SNAPSHOTS = 50;

  push(gmodel: LDDiagramGraph): void {
    this.snapshots = this.snapshots.slice(0, this.pointer + 1);
    this.snapshots.push(deepClone(gmodel));
    if (this.snapshots.length > this.MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }
    this.pointer = this.snapshots.length - 1;
  }

  undo(): LDDiagramGraph | null {
    if (this.pointer > 0) {
      this.pointer--;
      return deepClone(this.snapshots[this.pointer]);
    }
    return null;
  }

  redo(): LDDiagramGraph | null {
    if (this.pointer < this.snapshots.length - 1) {
      this.pointer++;
      return deepClone(this.snapshots[this.pointer]);
    }
    return null;
  }
}
```

---

## 8. Neuron Automation 参考模式

Neuron Automation (logi.cals) 基于 Theia+GLSP 构建 IEC 61131-3 IDE，其 GLSP 使用模式值得参考：

| 模式 | Neuron 做法 | AUDESYS 适配 |
|------|------------|-------------|
| **GModel 分层** | 顶层 GGraph → 中间层 Network → 叶子层 GNode/GEdge | LD: GGraph → Rung → Contact/Coil/Wire |
| **操作处理** | 每种图形操作一个 `GModelOperationHandler<T>` | 我们 15 种操作各一个 handler，注册到 `DiagramModule` |
| **布局引擎** | Java 端实现，同步（Canvas 坐标计算） | Rust 端实现（napi-rs），异步 worker_thread |
| **编译验证** | Java 端 ANTLR 解析 ST → 异步编译 | Rust 端 LD→IL→HalProgram 管道，异步 worker |
| **Markers** | GLSP `SetMarkersAction` 绑定到具体 GModel 元素 | 相同方式，绑定 `elementId` 到报错节点 |
| **撤销/重做** | GLSP 内置 `UndoRedoActionHandler` | 使用 GLSP 内置 + 我们自建快照（用于 Rust 编译回滚） |
| **Inversify DI** | 每个 `OperationHandler` 注册为 `@injectable()` 并绑定到 `TYPES.IOperationHandler` | 相同模式，使用 Theia inversify 容器 |
| **Tool Palette** | 注册 `ToolPaletteItemProvider`，返回 `PaletteItem[]` | 相同模式，T2a.3 实现 |

---

## 9. Server 目录结构

```
theia-extensions/audesys-ld-glsp/src/server/
├── index.ts                    # LDGLSPServer 入口，导出 DiagramModule
├── ld-glsp-server.ts           # LDGLSPServer 主类（extends GLSPServer）
├── diagram/
│   ├── ld-diagram-generator.ts # GModel 工厂（从 LD 源或空白模板创建 GModel）
│   └── ld-diagram-module.ts    # inversify 容器绑定（注册所有 handler）
├── handler/
│   ├── create-contact-handler.ts
│   ├── create-coil-handler.ts
│   ├── create-rung-handler.ts
│   ├── delete-element-handler.ts
│   ├── delete-rung-handler.ts
│   ├── move-element-handler.ts
│   ├── reconnect-wire-handler.ts
│   ├── change-variable-ref-handler.ts
│   ├── toggle-contact-type-handler.ts
│   ├── toggle-coil-type-handler.ts
│   ├── reorder-rungs-handler.ts
│   ├── compile-rung-handler.ts
│   ├── validate-connectivity-handler.ts
│   └── layout-rungs-handler.ts
├── model/
│   ├── gmodel-types.ts         # LDContactNode, LDCoilNode, etc. TypeScript 类型
│   ├── gmodel-serializer.ts    # GModel ↔ LD 文本格式转换
│   └── gmodel-validator.ts     # GModel 完整性校验（往返测试用）
├── state/
│   ├── ld-valid-state.ts       # LDValidStateManager 状态机
│   └── ld-undo-stack.ts        # UndoStack 快照管理
├── bridge/
│   ├── ld-bridge-client.ts     # napi-rs worker_thread 客户端
│   └── ld-bridge-types.ts      # BridgeMessage, BridgeResponse, etc.
└── __tests__/
    ├── gmodel-serializer.test.ts
    ├── state-machine.test.ts
    ├── bridge-client.test.ts
    └── handler/
        ├── create-contact.test.ts
        ├── delete-element.test.ts
        ├── reconnect-wire.test.ts
        └── compile-rung.test.ts
```

---

## 10. 验收标准 (STH-GLSP-004~010)

| 规范ID | 标准 | 验证方式 |
|--------|------|---------|
| STH-GLSP-004 | 15 种操作各至少 1 个单元测试 | `vitest` 运行 `__tests__/handler/` |
| STH-GLSP-005 | CreateContact 创建节点 + 自动连线 | 测试: 添加触点 → 验证 GModel 包含新节点 + 2 条连线|
| STH-GLSP-006 | DeleteElement 级联删除连线 | 测试: 删除触点 → 验证关联连线同步移除 |
| STH-GLSP-007 | ReconnectWire 短路检测正确拒绝 | 测试: 左电源轨→右电源轨直连 → 验证拒绝 |
| STH-GLSP-008 | CompileRung 端到端 LD→HalProgram | 测试: NO X1 → OUT Y1 → 编译 → HalProgram 非空 + 无 marker |
| STH-GLSP-009 | 布局引擎 rung 编号递增正确 | 测试: 3 rungs → layout → rungNumber 为 1,2,3 |
| STH-GLSP-010 | 状态机 Unmodified→Modified→Validating→Valid 全路径 | 测试: 模拟编辑→编译→通过 三次状态转换 |

---

## 11. 依赖与接口

### 11.1 依赖 crate

| Crate | 用途 | 接口 |
|-------|------|------|
| `audesys-ld-compiler` | LD 源码→IL 文本 | `fn ld_compile(source: &str) -> Result<String, String>` |
| `audesys-il-compiler` | IL 文本→HalProgram | `fn il_compile(source: &str) -> Result<HalProgram, String>` |
| `audesys-hal-ir` | HalProgram 类型 + JSON 序列化 | `HalProgram { name, signals, channels, instructions, function_table }` |
| `audesys-ld-layout` | 布局引擎 (新建 T2a.4) | 7 个函数: `layout_rungs`, `layout_contacts`, `layout_coils`, `route_wires`, `auto_number_rungs`, `validate_connectivity`, `is_valid_variable` |
| `audesys-theia-bridge` | napi-rs 桥接层 | 4 个 LD 函数: `ld_compile`, `ld_layout_rungs`, `ld_validate_connectivity`, `ld_verify_variable` |

### 11.2 前置依赖

- T1.1: Theia 应用骨架 (GLSP Server 运行在 Theia Backend)
- T1.2: napi-rs 绑定层 (worker_thread 池)
- T2a.1: LD GModel 定义 (类型定义 `gmodel-types.ts`)
- T2a.4: LD Layout Engine (Rust crate `audesys-ld-layout`)

### 11.3 下游依赖

- T2a.3: LD Tool Palette (依赖操作处理器注册)
- T2a.5: LD Property View (依赖 ChangeVariableRef handler)
- T2a.7: Theia GLSP Integration (依赖 DiagramModule + inversify 绑定)
