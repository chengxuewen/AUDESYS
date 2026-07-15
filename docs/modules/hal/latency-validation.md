> 拆分自 docs/hal-detailed-design.md（2026-07-15）

# 延迟验证方法

延迟声明基于典型硬件和软件条件。实际部署前需通过以下方法验证：

```yaml
验证方法:
  InProcess:
    tool: criterion bench
    metric: p50 / p95 / p99
    workload: 1M 次 typed API publish/subscribe 操作

  UDS:
    tool: linux-perf + Ftrace
    metric: p50 / p95 / p99 端到端延迟
    workload: 256-byte FlatBuffers 消息, 100K 次
    kernel: PREEMPT_RT

  Zenoh TCP:
    tool: tcpdump 时间戳差值 + zenoh ping benchmark
    metric: p50 / p95 / p99 RTT
    workload: 1KB–64KB 消息, 1Gbps 以太网

  Zenoh SHM:
    tool: criterion bench + rdtsc 差值
    metric: publish → subscriber callback 的 CPU 周期数
    workload: 4KB–64MB Blob, 同一物理主机
```

**原则**：延迟数字是设计目标，不是实现保证。验证结果写入审计报告。
