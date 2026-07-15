# Ch06: Product Characteristics

## 6.1 PC-based Control Philosophy in Practice

Beckhoff's core innovation: **standard IT hardware for real-time industrial control**.

**Traditional PLC limitations**:

- Dedicated CPU (typically 2-3 generations behind PC CPUs)
- Closed OS / firmware
- Limited extensibility (memory, storage, I/O)
- Vendor lock-in (only original manufacturer can upgrade)

**PC-based Control advantages**:

- Latest Intel Core / AMD Ryzen CPUs
- Memory up to 64GB+ (far beyond traditional PLC)
- SSD storage (for data logging and analytics)
- Multi-core parallel: one core runs PLC, others run WinCC / HMI / third-party software
- Upgrade by replacing IPC alone (no software change): "Software defines function, hardware defines performance"

## 6.2 EtherCAT Performance Benchmark

| Metric | EtherCAT | PROFINET IRT | EtherNet/IP | POWERLINK |
|--------|----------|-------------|-------------|-----------|
| Minimum cycle | 50-100us | 250-500us | 1-10ms | 200us-1ms |
| Jitter | < 1us | < 1us (IRT) | 5-10us | < 1us |
| Topology flexibility | Line/star/ring/tree | Line/star/ring | Star/tree | Line/star |
| Max nodes/frame | 65,535 | ~256 (limited) | Unlimited | 240 |
| Standardization | IEC 61158 | IEC 61158 | IEC 61158 | IEC 61158 |

EtherCAT's "Processing on the Fly" is the fundamental reason for its performance advantage.

## 6.3 Multi-Runtime Integration

TwinCAT 3's **biggest differentiator**: multiple runtime types running on the same IPC, driven by the same real-time Task scheduler:

- **Data sync**: All runtimes share the same process image
- **Cycle sync**: Multiple runtimes can mount to the same Task for deterministic execution order
- **Unified debugging**: Debug PLC code and C++ modules simultaneously from Visual Studio
- **Version consistency**: All runtime versions managed by TwinCAT Package Manager

For example, one machine tool can simultaneously run:
- TwinCAT PLC: logic control (start/stop/interlock)
- TwinCAT NC I: 5-axis interpolation path
- TwinSAFE: emergency stop and safety door monitoring
- TwinCAT Vision: real-time quality inspection
- TwinCAT Analytics: spindle vibration data logging

**All on one IPC, one project file.**

## 6.4 Visual Studio Integration

TwinCAT 3's choice of Visual Studio as IDE Shell brings mature IT toolchain:

| Feature | TwinCAT 3 XAE | Traditional PLC IDE (TIA Portal) |
|---------|-------------|-------------------------------|
| Editor | VS editor + extensions | Self-built editor |
| Debugging | VS breakpoints/watch/call stack | Self-built debugger |
| Version control | Git / TFS / SVN native | Usually SVN / proprietary |
| Code analysis | Static analysis / ReSharper | Limited vendor tools |
| Multi-language | C++ + PLC mixed | IEC 61131-3 only |
| Extensions | VS extension market + TcCOM | Vendor-defined API (Openness) |
| Team collaboration | Standard VS workflow | Vendor-defined Multiuser |

TwinCAT/BSD engineering support: XAE (VS-based) programs TwinCAT/BSD targets via ADS protocol over network, identical debugging experience to Windows. Also supports SSH remote command-line, FTP file transfer, and System Manager hardware configuration.

## 6.5 TwinCAT/BSD - Strategic Independence from Windows

| Dimension | Windows + TwinCAT 3 | TwinCAT/BSD |
|-----------|---------------------|-------------|
| OS | Windows 10 Pro / 11 | FreeBSD 13.x custom |
| Real-time scheduling | Hypervisor + double-tick | Native kernel, no switching |
| License cost | Windows commercial + TwinCAT | TwinCAT only |
| Min cycle | ~250us | ~100us |
| Jitter | ~2us | ~500ns |
| Architecture | x86/x64 | x86/x64 + Arm |
| Security | Windows security model | Kernel-level isolation |
| Long-term support | ~5 years (Windows lifecycle) | ~10 years (FreeBSD LTS) |
| Third-party compatibility | Excellent | Limited (some Windows-only drivers) |

**Installation flow**:

1. Download TwinCAT/BSD ISO (~1GB)
2. Install on target hardware (similar to standard Linux install)
3. Configure EtherCAT master and I/O via System Manager
4. Download TwinCAT project via TcXaeShell
5. Runtime auto-starts (no Windows user login required)

## 6.6 Open Source Strategy and Ecosystem Openness

| Dimension | Strategy |
|-----------|----------|
| EtherCAT protocol | Fully open, maintained by ETG |
| TwinCAT runtime | Closed-source (core), partial open-source modules |
| TwinCAT/BSD | Based on FreeBSD (open), TwinCAT runtime closed |
| Beckhoff RT Linux | Based on Linux (open), TwinCAT runtime closed |
| Development tools | TwinCAT XAE free (basic), paid for advanced |
| Third-party integration | Via ADS protocol and TcCOM interface |
| Community projects | TcOpen provides extensive open-source libraries |
| GitHub open source | 50+ official Beckhoff open-source libraries |

**Core value**: Beckhoff's open strategy is key to its competitiveness. EtherCAT open enables any vendor to build EtherCAT devices. TwinCAT open interfaces (ADS, TcCOM) enable third-party integration. This "closed core + open interfaces" model is a proven paradigm in industrial software.

## 6.7 ADS vs AUDESYS HAL Communication Primitives

| Dimension | ADS (Beckhoff) | AUDESYS HAL |
|-----------|---------------|-------------|
| Core primitives | Message router + Read/Write/Notification | Signal / StreamChannel / RPC tripartite |
| Addressing | (AMS Port, IndexGroup, IndexOffset) triple | (component.interface.name) Signal naming |
| Transport reliability | Configurable (TCP/UDP/USB) | HalQoS (deadline / liveliness / security_domain) |
| Real-time | Low latency via Task shared memory | amw_inproc (Phase 1) -> amw_zenoh (Phase 2) |
| Discoverability | AMS Router routing table (static + dynamic) | HalDiscovery (amw built-in) |
| Security | Secure ADS (Build 4026+), ADS-over-MQTT | HalQoS Security Domain isolation |
| Protocol openness | Fully public (Beckhoff provides full spec PDF) | HAL in detailed design (docs/modules/hal/) |

**AUDESYS takeaways**:

1. ADS Index Group / Index Offset binary addressing shows performance advantage over string naming. AUDESYS Signal naming (component.interface.name) could compile to numeric pairs internally
2. ADS Notification (subscribe/push) provides server-push data pattern, similar to AUDESYS Signal latest-value-overwrite + subscription notification, but ADS supports periodic or edge-triggered notifications
3. ADS Message Router handles same-machine and cross-machine routing, consistent with AUDESYS amw abstraction layer positioning