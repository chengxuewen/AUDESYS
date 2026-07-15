# Beckhoff TwinCAT Cheatsheet

## Architecture (XAE + XAR)

```
Engineering (XAE)  <-- ADS Protocol -->  Runtime (XAR)
  VS Studio Shell                        Real-time Scheduler
  PLC Editor                             PLC / NC / CNC Runtime
  C++ Modules                            Safety / Vision / Analytics
  System Manager                         TcCOM Interface
  HMI Designer                           EtherCAT Master
                                          Windows / TwinCAT/BSD / RT Linux
```

## Key Numbers

| Metric | Value |
|--------|-------|
| EtherCAT minimum cycle | 50-100us |
| EtherCAT jitter | < 1us |
| TwinCAT/BSD min cycle | ~100us |
| TwinCAT/BSD jitter | ~500ns |
| Windows min cycle | ~250us |
| Windows jitter | ~2us |
| Max EtherCAT nodes/frame | 65,535 |
| ETG members | 7,000+ |
| Certified EtherCAT products | 5,000+ |
| Global TwinCAT installations | 1M+ |
| TwinCAT runtime modules | 100+ |
| Employees | ~5,500 |
| 2024 revenue | EUR 11.7B |
| Market share (PC-based) | ~14% (3rd) |
| 5-year CAGR | 9.1% |

## Protocol Comparison: ADS vs AUDESYS HAL

| Dimension | ADS (Beckhoff) | AUDESYS HAL |
|-----------|---------------|-------------|
| Core primitives | Read/Write/Notification | Signal / StreamChannel / RPC |
| Addressing | (AMS Port, IndexGroup, IndexOffset) | (component.interface.name) |
| Transport | TCP/UDP/USB | amw_inproc -> amw_zenoh |
| Real-time | Task shared memory | HalQoS (deadline/liveliness/security_domain) |
| Security | Secure ADS (Build 4026+) | Security Domain isolation |
| Discovery | AMS Router (static + dynamic) | HalDiscovery (built-in) |

## Real-Time Ethernet Comparison

| Metric | EtherCAT | PROFINET IRT | EtherNet/IP | POWERLINK |
|--------|----------|-------------|-------------|-----------|
| Min cycle | 50-100us | 250-500us | 1-10ms | 200us-1ms |
| Jitter | < 1us | < 1us (IRT) | 5-10us | < 1us |
| Max nodes/frame | 65,535 | ~256 | Unlimited | 240 |
| Owner | Beckhoff (open) | Siemens (open) | Rockwell (open) | B&R (open) |

## Platform Level Licensing

| Level | Hardware | Typical Use |
|-------|----------|-------------|
| 10-20 (Economy) | Arm / CX low-end | Small PLC |
| 30-40 (Performance) | x86 IPC mid-range | PLC + NC |
| 50-70 (High Perf) | Multi-core x86 | CNC, Vision, Analytics |
| 80-84 (Very High) | High-perf multi-core | Multi-runtime parallel |
| 90-94 (Other) | 1-64 core config | Large-scale systems |

## Key AMS Ports

| Port | Device |
|------|--------|
| 100 | TwinCAT Router |
| 350 | PLC Runtime |
| 500 | NC |
| 600 | CNC |
| 800 | User-defined |

## Competitive Positioning

| Company | Share | Core Strength | Weakness |
|---------|-------|---------------|----------|
| Siemens | ~45% | Full integration, installed base | Closed, slow innovation |
| Rockwell | ~19% | North America dominance, ecosystem | Regional limits, high price |
| Beckhoff | ~14% | Technology leadership, EtherCAT, open | Small scale, high price |
| B&R (ABB) | ~7% | Software flexibility | Post-acquisition independence |

## AUDESYS Reference Mapping

| AUDESYS Component | Beckhoff Reference |
|-------------------|--------------------|
| Studio IDE Shell | VS Shell (embed, don't self-build) |
| HAL Signal primitives | ADS (IndexGroup, IndexOffset) binary addressing |
| amw abstraction layer | ADS Message Router + TcCOM interface |
| Mixed thread scheduling (D13) | Multi-runtime single-Task scheduler |
| Runtime licensing | Platform Level by CPU core count |
| Package management | TwinCAT Package Manager (Build 4026+) |
| Safety module isolation | TwinSAFE independent runtime |
| Performance claims | Conditional latency with dependency specs |
| IEC 61131-3 compiler | ST only (Phase 1) -> multi-language (Phase 2+) |
| Extension ecosystem | TFxxxx function module taxonomy |

## Beckhoff Product Milestones

| Year | Milestone |
|------|-----------|
| 1980 | Founded, Hans Beckhoff |
| 1986 | PC-based Control concept |
| 1992 | Bus Terminal (EL series) |
| 1996 | TwinCAT 1.0 |
| 2003 | EtherCAT invented |
| 2007 | EtherCAT IEC 61158 standard |
| 2011 | TwinCAT 3 (VS-based) |
| 2017 | TwinSAFE in TwinCAT 3 |
| 2020 | TwinCAT/BSD released |
| 2023 | MX-System (cabinet-free) |
| 2024 | TwinCAT PLC++ / MC3 |

## TwinCAT/BSD vs Windows

| Metric | Windows | TwinCAT/BSD |
|--------|---------|-------------|
| Min cycle | ~250us | ~100us |
| Jitter | ~2us | ~500ns |
| License cost | Windows + TwinCAT | TwinCAT only |
| Arch support | x86/x64 | x86/x64 + Arm |
| LTS | ~5 years | ~10 years |