# P0-1: AUDESYS 统一里程碑路线图

**决策**: D31 — 统一里程碑表（2026-07-13）
**状态**: ✅ 已确认
**依赖**: 架构评审 D21-D30，实施规划 D32-D41

---

## 1. 概述

将 HAL 8 阶段、Runtime 分阶段、Studio 4 阶段统一编排为单一里程碑表。
标注每阶段的模块交互点与依赖关系，确保跨模块并行无冲突。

---

## 2. 统一里程碑表

| Milestone | HAL | Runtime | Studio | Simulator | 里程碑完成标准 |
|:---:|------|---------|--------|-----------|--------------|
| **M0** | — | — | — | — | Cargo workspace + CI/CD + 测试目录骨架 |
| **M1** | Phase 1: 14 类型系统 + FlatBuffers schema | — | Core 框架 + 项目 CRUD + Tauri 骨架 | — | FlatBuffers 序列化/反序列化单测 ≥ 80% 覆盖 |
| **M2** | Phase 2: Signal 原语 (InProc + UDS) | Controller RT 骨架 | 编辑器注册表 + Panel 骨架(静态信号展示) | — | 两个 Component 通过 Signal 交换 Pin，功能正确 |
| **M2.5** | — | Runtime I/O 线程 StreamChannel 消费端 | — | — | StreamChannel 消费者端验证通过 |
| **M3** | Phase 3: StreamChannel + 3 种 QueuePolicy | Runtime I/O 线程 StreamChannel 消费端 | Scene Designer 骨架（SVG 画布，无 Logic） | — | 10MB/s 生产者→消费者无丢帧 |
| **M4** | Phase 4: RPC 原语 + timeout/idempotency | Supervisor 进程管理 | Scene Designer MVP（可视化编辑，无运行时） | — | load→configure→activateComponent 完整 RPC 流程（含超时恢复） |
| **M4.5** | amw_zenoh 基础设施 | HalDiscovery over Zenoh keyexpr | — | — | 跨进程 Signal 通信通过 Zenoh 路由（latency 条件见 §M2 规范化声明） |
| **M5** | Phase 5: LinuxCNC motion planner 移植 | Runtime 4 模块初版 (Supervisor+Controller+Panel+Remote) | Logic Designer (RuSTy 集成) | — | 6 轴轨迹经 Signal 发布，RT 周期完成 |
| **M6** | Phase 6: OpenPLC IEC runtime 移植 | Modbus/HART 协议适配 | Flow Designer | Phase 3: AVD Manager | 梯形图扫描周期 I/O 经 Array\<S32\> 传输 |
| **M7** | Phase 7: ROS2 节点移植 | Gateway MES/ERP 对接 | Phase 3: 在线编辑 | Phase 3: 7 种虚拟设备 | topic + service 全经 AUDESYS HAL 通信 |
| **M8** | Phase 8: dora-rs operator 移植 | Edge 边缘采集 | Phase 4: 协同编辑 | Phase 4: 高级故障注入 | 2MB/frame 摄像头流零拷贝传输 |

---

## 3. 模块交互依赖矩阵

                    M0    M1    M2   M2.5   M3    M4   M4.5   M5    M6    M7    M8
HAL                ───── ●──── ●──── ●──── ●──── ●──── ●──── ●──── ●──── ●──── ●
Runtime            ───── ───── ●──── ●──── ●──── ●──── ●──── ●──── ●──── ●──── ●
Studio             ───── ●──── ●──── ───── ●──── ●──── ───── ●──── ●──── ●──── ●
Simulator          ───── ───── ───── ───── ───── ───── ───── ───── ●──── ●──── ●
```

**图例**: ● = 有工作 | ─ = 无/等待

---

## 4. Phase 0 (M0) 详细分解

### 4.1 基础设施搭建（优先级最高）

| 子任务 | 产出 | 估时 | 负责 |
|--------|------|:---:|------|
| 0.1 Cargo workspace 骨架 | `Cargo.toml` (虚拟 workspace) + `crates/` 目录 | 0.5 天 | — |
| 0.2 CI/CD 流水线（qa-fast） | `.github/workflows/qa.yml` + `scripts/qa/*.sh` | 1 天 | — |
| 0.3 直接 TDD 启动 | 测试目录 + 首批测试场景提取（从 hal-detailed-design.md） | 0.5 天 | — |
| 0.4 Test 框架骨架 | `tests/` 目录（仅骨架，不写业务测试） | 0.5 天 | — |
| 0.5 开发工具链配置 | `rust-toolchain.toml` + `clippy.toml` + `deny.toml` | 0.5 天 | — |

**总计估时**: 4-5 天

### 4.2 Phase 1 (M1) 启动

M0 完成后立即启动（D34: hal-core 驱动并行）：
- `audesys-hal-core` — 14 种类型 + Signal/StreamChannel/RPC trait 定义
- `audesys-hal-flatbuffers` — FlatBuffers schema 生成
- `audesys-amw-inproc` — Phase 1 同进程 transport
- `audesys-studio-core` — Studio Core 框架（与 HAL 并行启动，D38）

---

## 5. 跨模块接口点（需对齐）

| 接口 | 提供方 | 消费方 | 对齐时机 |
|------|--------|--------|:---:|
| HalType (14 种类型) | hal-core | 所有模块 | M1 |
| Signal/SignalReader trait | hal-core | Runtime Controller | M2 |
| StreamChannel trait | hal-core | Runtime, Simulator | M3 |
| RPC trait | hal-core | Runtime Supervisor | M4 |
| HalTransport + HalDiscovery + HalQoS (amw trait triplet) | hal-core | 所有通信模块 | M1 |
| FlatBuffers schema (.fbs) | hal-flatbuffers | Studio Panel, Gateway | M4 |
| Config Barrier + LockLevel | hal-core | Runtime Supervisor → Controller | M4 |
| Modbus IoDriver | audesys-modbus | Runtime Gateway | M6 |

---

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|:---:|:---:|------|
| M0 基础设施搭设时间超预期 | 中 | 高 | 采用 dora-rs workspace 预制骨架，预算 4-5 天含缓冲 |
| hal-core trait 定义反复修改 | 高 | 中 | M1 前冻结 trait 接口（设计冻结门禁），接口变更需团队审核 |
| 直接 TDD 从设计规范提取测试场景存在遗漏 | 中 | 中 | 按 hal-detailed-design.md 节次逐项提取，Peer Review 检查覆盖度 |
| Studio 与 HAL 对接接口不匹配 | 低 | 高 | M1 同时定义 FlatBuffers schema + M2 Panel 骨架验证 schema→TypeScript 绑定管线 |
| amw_zenoh 延迟集成导致 M5+ 阻塞 | 中 | 高 | M4.5 独立里程碑提前搭建 Zenoh 基础设施，与 RPC 实现并行 |

---

## 7. 验收标准

每阶段完成时需满足：
- [ ] 该阶段所有 crate 的 `cargo test` 通过
- [ ] CI/CD qa-fast 门禁全绿
- [ ] 里程碑完成标准（见 §2 表格）达标
- [ ] 跨模块接口点对齐（见 §5）
- [ ] `grep -ri modacs` 零残留（G4 防护规则）
