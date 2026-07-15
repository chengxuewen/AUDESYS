# AUDESYS Runtime 硬件需求

> 生成日期：2026-07-15
> 设计目标：定义 Runtime 套件各模块的硬件需求规格——三级配置（最低/推荐/认证）、Linux 内核版本约束、PREEMPT_RT 启用清单、以及硬件选型指南

---

## 设计原则

工业控制系统的硬件需求不是一刀切的 "这个软件跑得动吗"。Controller 的 SCHED_FIFO 线程需要隔离核心和 RT 内核，Panel 的 Tauri 渲染需要 GPU，Edge 的 7x24 采集需要工业级磁盘。

1. **分层匹配** — 每模块的硬件需求独立定义，不捆绑整机规格
2. **可验证** — 每条需求附带检测命令或脚本，不依赖 "目测"
3. **分阶段** — 最低配置跑 Phase 1 开发，推荐配置跑 Phase 2 验证，认证配置跑生产部署
4. **RT 确定性优先** — Controller 的硬件决策（CPU isolate / 内存锁定 / 中断亲缘性）优先于其他所有模块

参考：D29（Docker + PREEMPT_RT 部署）、D37（SCHED_FIFO 测试策略）、`docs/architecture.md` §二 Runtime 套件

---

## 1. 硬件分级总览

| 等级 | 用途 | 适用模块 | 验证级别 |
|------|------|---------|---------|
| **最低** | 开发/原型验证 | Supervisor / Panel / Gateway / Remote / Edge | Phase 1 qa-fast |
| **推荐** | 预生产/集成测试 | 全套件（含 Controller 非 RT 模式） | Phase 2 qa-full |
| **认证** | 生产部署 | 全套件（含 Controller 硬 RT 模式） | Phase 3 qa-deep + RT 验证 |

```
         最低                    推荐                  认证
     ┌──────────┐         ┌──────────────┐      ┌──────────────┐
     │ 开发验证  │  ───→  │ 预生产测试    │ ───→ │  生产部署     │
     │          │         │              │      │              │
     │ x86_64   │         │ x86_64/ARM64 │      │ x86_64 + IPMI│
     │ 无 RT     │         │ PREEMPT_RT   │      │ PREEMPT_RT   │
     │ 无隔离    │         │ isolcpus     │      │ isolcpus     │
     │ 无冗余    │         │ 软件 RAID    │      │ 硬件 RAID    │
     └──────────┘         └──────────────┘      └──────────────┘
```

---

## 2. 最低配置（开发/原型验证）

### 2.1 整机规格

| 部件 | 规格 | 说明 |
|------|------|------|
| **CPU** | x86_64, 4 核, 2.0 GHz | 无需 AVX2，无需特定微架构 |
| **内存** | 8 GB RAM | 可同时运行 6 个模块 + 开发工具 |
| **磁盘** | 256 GB SSD | 操作系统 + 日志 + 缓存 |
| **网络** | 1 GbE | 模块间 UDS + 外部通信 |
| **GPU** | 集成显卡 | Panel 的 Tauri 需要基本 GPU 加速 |

### 2.2 操作系统

| 项目 | 版本 |
|------|------|
| **Linux 发行版** | Ubuntu 22.04 LTS / Debian 12 |
| **内核版本** | 6.1+ (generic) |
| **RT 内核** | 不需要 |
| **容器** | Docker CE 24+ |

### 2.3 软件依赖

```
# 最低配置检测脚本
# 验证通过后输出 "OK"，失败输出 "FAIL: <原因>"

echo "=== CPU ==="
nproc --all | awk '{print "CPU cores: " $1}'
grep -c "^processor" /proc/cpuinfo | awk '{if ($1 >= 4) print "OK"; else print "FAIL: <4 cores"}'

echo "=== Memory ==="
free -g | awk '/^Mem:/{if ($2 >= 8) print "OK ("$2"GB)"; else print "FAIL: <8GB RAM"}'

echo "=== Disk ==="
df -BG / | awk 'NR==2{if ($4+0 >= 256) print "OK ("$4"GB free)"; else print "FAIL: <256GB free"}'

echo "=== Docker ==="
docker --version && echo "OK" || echo "FAIL: Docker not installed"
```

### 2.4 适用场景

- 开发者在本地笔记本运行 Supervisor / Panel / Gateway 进行功能调试
- Controller 在 `SCHED_OTHER` 模式下运行（无 RT 保证，仅验证逻辑正确性）
- 单机单实例，无冗余

---

## 3. 推荐配置（预生产/集成测试）

### 3.1 整机规格

| 部件 | 规格 | 说明 |
|------|------|------|
| **CPU** | x86_64, 8 核, 2.5 GHz, 支持 AVX2 | 预留 2 核给 Controller 隔离 |
| **内存** | 32 GB RAM | Controller 独占 4 GB（mlockall） |
| **磁盘** | 512 GB NVMe SSD | 日志保留 30 天本地缓存 |
| **网络** | 2 x 1 GbE (bonding) | 对外通信冗余 |
| **GPU** | 独立 GPU (Intel Arc / NVIDIA T400) | Panel 的高分辨率 HMI 渲染 |

### 3.2 操作系统

| 项目 | 版本 |
|------|------|
| **Linux 发行版** | Ubuntu 24.04 LTS / Debian 12 |
| **内核版本** | 6.8+ (PREEMPT_RT) |
| **RT 内核** | 需要 (`linux-image-rt-*`) |
| **容器** | Docker CE 24+ 或 Podman 4+ |

### 3.3 内核配置要求

```
# 推荐配置内核检测脚本
# 验证 PREEMPT_RT 启用和 CPU 隔离

echo "=== PREEMPT_RT ==="
zcat /proc/config.gz 2>/dev/null || cat /boot/config-$(uname -r) | \
  grep -q "CONFIG_PREEMPT_RT=y" && echo "OK" || echo "FAIL: CONFIG_PREEMPT_RT not enabled"

echo "=== Kernel cmdline ==="
cat /proc/cmdline | grep -q "isolcpus" && echo "OK (isolcpus active)" || \
  echo "WARN: isolcpus not set, Controller RT thread may be interrupted"

echo "=== CPU isolation (reserved for Controller) ==="
# 验证至少有 2 个核心被隔离用于 Controller
cat /proc/cmdline | grep -oP "isolcpus=\K[0-9,-]+" | tr ',' '\n' | \
  tr '-' ' ' | awk '{count += $2-$1+1} END{print "Isolated cores: " count; if (count >= 2) print "OK"; else print "FAIL: <2 isolated cores"}'

echo "=== Memory locking limit ==="
ulimit -l | awk '{if ($1 >= 4194304) print "OK ("$1" KB)"; else print "FAIL: mlock limit < 4GB"}'

echo "=== Hugepages ==="
cat /proc/meminfo | grep -q "HugePages_Total:.*[1-9]" && echo "OK" || \
  echo "WARN: 2MB hugepages not configured, THP may cause latency spikes"
```

### 3.4 内核参数

```ini
# /etc/sysctl.d/99-audesys.conf — 推荐配置内核参数

# 减少中断合并延迟
net.core.rps_sock_flow_entries = 32768

# 禁用 NUMA balancing（避免跨 NUMA 节点迁移 RT 线程）
kernel.numa_balancing = 0

# 减少 RCU 唤醒频率
kernel.nmi_watchdog = 0

# 提高进程最大 mlock 限制
vm.max_map_count = 1048576

# 禁用 THP（透明大页 → 引入不可预测的延迟）
# 更极端的方案：echo never > /sys/kernel/mm/transparent_hugepage/enabled
# Phase 2 评估是否关闭
```

### 3.5 适用场景

- 集成测试环境，运行全部 6 个模块
- Controller 在 PREEMPT_RT 模式下运行，验证周期确定性
- 模拟 50+ Signal / 10+ StreamChannel / 5+ RPC 的负载场景
- 单机单实例，无冗余

---

## 4. 认证配置（生产部署）

### 4.1 整机规格

| 部件 | 规格 | 说明 |
|------|------|------|
| **CPU** | x86_64, 12 核+, 3.0 GHz, AVX-512 或 ARM64 Neoverse N2 | 4 核隔离给 Controller (SCHED_FIFO) |
| **内存** | 64 GB RAM (ECC, 可选) | Controller 独占 8 GB（mlockall + hugepages） |
| **磁盘** | 1 TB NVMe SSD (硬件 RAID1) | 日志保留 90 天 + 配置全量备份 |
| **网络** | 2 x 10 GbE (bonding active-backup) | 设备通信 + 对外通信分网段 |
| **GPU** | 半高专业 GPU (NVIDIA T1000 / Intel Arc A310) | Panel 多屏 HMI + 可选 GPU 计算 |
| **IPMI** | 独立管理网口 | 远程重启/SOL/kernel dump |

### 4.2 操作系统

| 项目 | 版本 |
|------|------|
| **Linux 发行版** | Ubuntu 24.04 LTS 或 Rocky Linux 9 |
| **内核版本** | 6.8+ (PREEMPT_RT, 官方维护的 RT 分支) |
| **RT 内核** | 需要，且通过 `cyclictest` 验证 |
| **容器** | Podman 4+（rootless, 避免 dockerd 引入的延迟） |

### 4.3 硬件清单参考

| 组件 | 推荐型号 | 理由 |
|------|---------|------|
| **工控机** | Advantech IPC-610 / Siemens IPC427E | 工业级宽温、抗振动、长期供货 |
| **CPU** | Intel Core i5-13500 / AMD Ryzen 5 PRO 7645 | 够用的单核性能 + 足够核心数 |
| **内存** | Samsung DDR5 4800 ECC | ECC 防止内存位翻转影响 RT 确定性 |
| **磁盘** | Samsung 990 PRO 1TB (RAID1) | NVMe 低延迟、RAID1 冗余 |
| **网卡** | Intel X710-DA2 (10GbE) | Linux 原生驱动，SR-IOV 支持 |

### 4.4 认证测试套件

生产部署前必须通过以下测试：

```
# 1. cyclictest — 确认 RT 延迟 ≤ 50μs (p99)
cyclictest --mlockall --smp --priority=99 --interval=1000 --distance=0 \
  --duration=24h --json=cyclictest-report.json

# 通过标准: p99 latency < 50μs, max latency < 150μs

# 2. stress-ng — 确认 CPU 隔离有效
# 在非隔离核心施加压力，观察隔离核心的 RT 线程不受影响
stress-ng --cpu 4 --io 2 --vm 2 --hdd 1 --timeout 300s &
cyclictest --mlockall --smp --priority=99 --interval=1000 --duration=300s \
  --json=stress-cyclictest.json

# 通过标准: 隔离核心的 jitter 增加 < 10μs

# 3. fio — 确认磁盘 IO 不会阻塞 RT 线程
fio --name=randwrite --ioengine=libaio --direct=1 --bs=4k --rw=randwrite \
  --size=1G --numjobs=4 --runtime=60s --group_reporting

# 通过标准: 测试期间控制器 Signal 无 deadline miss

# 4. netperf — 确认网络中断不会影响 RT 延迟
# 在非隔离核心发起 netperf TCP 流，观察 RT 延迟
netperf -H 10.0.0.2 -t TCP_STREAM -l 60 &
cyclictest --mlockall --smp --priority=99 --interval=1000 --duration=60s \
  --json=netperf-cyclictest.json

# 通过标准: 隔离核心的 jitter 增加 < 20μs
```

### 4.5 适用场景

- 7x24 生产运行，Controller 以 SCHED_FIFO 99 优先级运行
- 200+ Signal / 50+ StreamChannel / 20+ RPC 并发
- 支持 1:1 冗余（Supervisor 热备 + Controller 主备切换）
- 双网冗余 + 硬件 RAID

---

## 5. 各模块独立需求

### 5.1 Controller

| 项目 | 最低 | 推荐 | 认证 |
|------|------|------|------|
| **CPU 核心** | 1 (无隔离) | 2 (isolcpus) | 4 (isolcpus, 2 用于 RT, 2 用于非 RT 回调) |
| **内存** | 512 MB RSS | 2 GB (mlockall) | 8 GB (mlockall + hugepages) |
| **磁盘** | 1 GB | 10 GB | 50 GB (日志 + core dump) |
| **RT 内核** | 不需要 | PREEMPT_RT | PREEMPT_RT + 认证测试 |
| **mlockall** | 不需要 | 需要 | 需要 |
| **SCHED_FIFO** | 不需要 | 优先级 90 | 优先级 99 |

### 5.2 Supervisor

| 项目 | 最低 | 推荐 | 认证 |
|------|------|------|------|
| **CPU 核心** | 0.5 (共享) | 1 | 2 (主备各 1) |
| **内存** | 256 MB | 512 MB | 1 GB |
| **磁盘** | 512 MB | 5 GB | 20 GB |
| **冗余** | 无 | 无 | systemd watchdog + 热备 |

### 5.3 Panel

| 项目 | 最低 | 推荐 | 认证 |
|------|------|------|------|
| **CPU 核心** | 1 (共享) | 2 | 2 |
| **内存** | 1 GB | 4 GB | 8 GB |
| **GPU** | 集成显卡 | 独立 GPU | 专业 GPU |
| **显示** | 1920x1080 | 1920x1080 x2 | 3840x2160 x2 |
| **磁盘** | 1 GB | 5 GB | 10 GB |

### 5.4 Gateway

| 项目 | 最低 | 推荐 | 认证 |
|------|------|------|------|
| **CPU 核心** | 0.5 (共享) | 1 | 2 |
| **内存** | 256 MB | 1 GB | 4 GB |
| **网络** | 1 GbE | 1 GbE | 2 x 10 GbE (bonding) |
| **磁盘** | 512 MB | 2 GB | 10 GB (缓存队列) |

### 5.5 Remote

| 项目 | 最低 | 推荐 | 认证 |
|------|------|------|------|
| **CPU 核心** | 0.5 (共享) | 1 | 1 |
| **内存** | 256 MB | 512 MB | 1 GB |
| **GPU** | 集成 | 集成 | 独立 (编码卸载) |
| **网络** | 1 GbE | 1 GbE | 1 GbE |

### 5.6 Edge

| 项目 | 最低 | 推荐 | 认证 |
|------|------|------|------|
| **CPU 核心** | 0.5 (共享) | 1 | 1 |
| **内存** | 128 MB | 256 MB | 512 MB |
| **磁盘** | 1 GB | 10 GB | 50 GB (本地缓存) |
| **网络** | 1 GbE | 1 GbE | 1 GbE (独立网口) |

---

## 6. PREEMPT_RT 启用清单

### 6.1 安装

```bash
# Ubuntu 24.04 LTS — 安装 PREEMPT_RT 内核
sudo apt install linux-image-rt-$(uname -r | cut -d- -f1 | cut -d. -f1-2)-generic

# 验证安装成功
uname -a | grep -q "PREEMPT_RT" && echo "OK: PREEMPT_RT kernel running" \
  || echo "FAIL: Booted with non-RT kernel"

# 切换到 RT 内核
# 编辑 /etc/default/grub: GRUB_DEFAULT="Advanced options for Ubuntu>Ubuntu, with Linux 6.8.xx-rt"
sudo update-grub && sudo reboot
```

### 6.2 配置清单

```
[ ] PREEMPT_RT 内核已安装并运行
    → `uname -a` 输出包含 "PREEMPT_RT"

[ ] isolcpus 已配置
    → `cat /proc/cmdline` 包含 "isolcpus=2,3"（或类似值）
    → 隔离核心在系统启动后无用户态进程调度

[ ] RCU 回调已从隔离核心迁移
    → `cat /sys/devices/system/cpu/isolated` 显示隔离核心列表
    → `echo f > /sys/bus/workqueue/devices/writeback/cpumask`(为隔离核心 mask)

[ ] 中断亲缘性已配置
    → 将所有设备中断重定向到非隔离核心
    → `echo 3 > /proc/irq/<IRQ>/smp_affinity`（core 0-1, 非隔离）

[ ] mlockall 限制已提升
    → `ulimit -l` ≥ 4194304 (4 GB)
    → 或配置 `/etc/security/limits.conf`: `@rtgroup soft memlock unlimited`

[ ] 透明大页已禁用
    → `cat /sys/kernel/mm/transparent_hugepage/enabled` 输出 "[always] madvise never"
    → 或 `echo never > /sys/kernel/mm/transparent_hugepage/enabled`

[ ] NMI watchdog 已禁用
    → `cat /proc/sys/kernel/nmi_watchdog` 输出 "0"

[ ] cyclictest 通过 (24h, p99 < 50μs)
    → 见 §4.4 认证测试套件

[ ] CPU frequency governor 设为 performance
    → `cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor` 全部输出 "performance"
```

### 6.3 常见问题

| 问题 | 症状 | 方案 |
|------|------|------|
| **m等待时间尖峰** | cyclictest 偶尔跳到 200μs+ | 检查 ACPI 唤醒 (`cat /proc/acpi/wakeup`)、禁用不必要的 USB 唤醒 |
| **THP 延迟** | 周期性的延迟尖峰（每 60s 一次） | 确认透明大页已禁用，THP compact 后台线程是常见延迟来源 |
| **SMT 干扰** | 隔离核心被兄弟线程干扰 | 在 isolcpus 中同时隔离兄弟线程，或通过 `/sys/devices/system/cpu/cpuX/online` 关闭 SMT |
| **NVMe IRQ** | 高磁盘 IO 时 RT 延迟增加 | 将 NVMe IRQ 亲缘性设为非隔离核心 mask |
| **Docker 网桥** | 容器网络操作导致延迟 | 使用 `--network=host` 或 macvlan，避免 Docker 网桥的 iptables 规则 |

---

## 7. 内核版本兼容性

| Runtime 版本 | 最低内核 | 推荐内核 | 说明 |
|-------------|---------|---------|------|
| **Phase 1 (v0.1.0-dev)** | 6.1 (generic) | 6.8+ (generic) | 无 RT 要求，仅验证逻辑 |
| **Phase 2 (v0.1.0-alpha)** | 6.8 (PREEMPT_RT) | 6.8+ (PREEMPT_RT) | 引入 RT 测试，需要 cyclictest |
| **Phase 3 (v0.1.0-beta)** | 6.8 (PREEMPT_RT) | 6.12+ (PREEMPT_RT) | 生产部署，需 LTS RT 内核 |
| **v1.0.0** | 6.8 LTS (PREEMPT_RT) | 最新 LTS RT | 长期支持内核 |

### 内核功能依赖

| 内核功能 | 依赖模块 | 最低版本 | 引入原因 |
|---------|---------|---------|---------|
| `CONFIG_PREEMPT_RT` | Controller | 6.8 (RT) | SCHED_FIFO 确定性 |
| `CONFIG_CPUSETS` | Controller | 6.1 | `isolcpus` + `cpuset` 控制 |
| `CONFIG_HUGETLB_PAGE` | Controller | 6.1 | 2MB hugepages 减少 TLB miss |
| `CONFIG_NUMA_BALANCING` | 全模块 | 6.1 | 禁用（默认开启，影响 RT） |
| `CONFIG_IOMMU_DEFAULT_DMA_LAZY` | Controller | 6.8 | 减少 IOMMU 延迟 |
| `CONFIG_VDPA` | Gateway | 6.1 | 高性能 virtio 网络 |

---

## 8. 相关文档

- `docs/architecture.md` §二 Runtime 套件 — Runtime 模块全景与进程职责矩阵
- `docs/architecture.md` §12 多实例隔离 — 硬件隔离与 CPU 绑定策略
- `docs/modules/hal/thread-scheduling-design.md` — RT 线程调度模型
- `docs/modules/hal/latency-validation.md` — 延迟验证方法
- `docs/modules/hal/rt-memory-and-scheduling.md` — RT 内存管理
- `docs/modules/runtime/observability-design.md` — 通过指标监控硬件健康状况
- `docs/plans/p0-milestone-roadmap.md` — M2/M3 里程碑中的 RT 验证