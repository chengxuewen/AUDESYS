# AUDESYS HAL 分阶段实施路线

> 拆分自 docs/hal-detailed-design.md（2026-07-15）

## 14. 分阶段实施路线

| 阶段 | 里程碑 | 验证方式 |
|------|--------|---------|
| **Phase 1** | 扩展类型系统到 14 种，FlatBuffers schema 更新 | 序列化/反序列化单元测试覆盖所有类型 |
| **Phase 2** | Signal 原语实现（InProcess + UDS transport） | 两个 Component 通过 Signal 交换 Pin 值，延迟 < 10μs |
| **Phase 3** | StreamChannel 原语实现 + 三种 QueuePolicy | 生产者 10MB/s → 消费者无丢帧 |
| **Phase 4** | RPC 原语实现（timeout, idempotency） | loadComponent → configureComponent → activateComponent 流程 |
| **Phase 5** | 移植 LinuxCNC motion planner 验证 Signal 模型 | 6 轴轨迹通过 Signal 发布，RT 周期内完成 |
| **Phase 6** | 移植 OpenPLC IEC runtime 验证 Array + Blob | 梯形图扫描周期 I/O 通过 Array\<S32\> 传输 |
| **Phase 7** | 移植 ROS2 节点验证三种原语协同 | topic + service 全部通过 AUDESYS HAL 通信 |
| **Phase 8** | 移植 dora-rs operator 验证 StreamChannel 高吞吐 | 2MB/frame 摄像头流零拷贝传输 |

---