# ref-beckhoff

**Beckhoff TwinCAT 3 Platform Reference for AUDESYS Studio Design**

> Study-depth reference skill extracted from `docs/reference/beckhoff.md`. Focuses on design decisions, architectural patterns, and reference value that AUDESYS Studio and Runtime can learn from.

## Overview

Beckhoff is the inventor of PC-based Control and the EtherCAT real-time Ethernet protocol. TwinCAT 3 transforms any industrial PC into a real-time PLC + NC + CNC + Safety controller. This skill captures its architecture, multi-runtime integration, ADS communication protocol, real-time scheduling model, and business strategy — distilled for AUDESYS design decisions.

## When to Use

- Designing AUDESYS Runtime's multi-runtime architecture (PLC/NC/CNC/Safety)
- Deciding HAL communication protocol design (Signal / StreamChannel / RPC vs ADS)
- Planning real-time scheduling strategy (dual-tick, core isolation, rate-monotonic)
- Evaluating Studio IDE Shell strategy (use VS Code / Theia vs self-build)
- Designing hardware abstraction layer and device description formats
- Benchmarking business model (IDE free, runtime licensed, platform-level pricing)
- Comparing AUDESYS's approach against the PC-based Control industry leader

## Chapters

| File | Section | Content |
|------|---------|---------|
| `chapters/ch01-product-portrait.md` | SS1 产品画像 | Identity, positioning, user segments, Platform Level licensing model, revenue history |
| `chapters/ch02-technical-features.md` | SS2 技术特性 | XAE+XAR architecture, EtherCAT on-the-fly processing, ADS protocol, real-time scheduling, multi-runtime, C++ Modules, hardware platforms |
| `chapters/ch03-functional-overview.md` | SS3 功能概览 | TFxxxx modules, 6 use-case scenarios, Package Manager, extension mechanisms |
| `chapters/ch04-status-ecosystem.md` | SS4 现状与生态 | Version history, user base, ETG ecosystem, third-party integrations, TwinCAT/BSD, TwinCAT PLC++, MX-System |
| `chapters/ch05-market-positioning.md` | SS5 市场定位 | Industries, competitive analysis (Siemens/Rockwell/B&R), regional market depth, competitive strategy |
| `chapters/ch06-product-characteristics.md` | SS6 产品特色 | PC-based Control philosophy, EtherCAT benchmark, multi-runtime integration, VS Shell strategy, open-source strategy, ADS vs HAL comparison |
| `chapters/ch07-reference-value.md` | SS7 对AUDESYS的参考价值 | Multi-runtime architecture, ADS protocol lessons, real-time scheduling, IDE design, licensing model, 10 specific reference points |

## Companion Files

- `glossary.md` — Term definitions (EtherCAT, ADS, XAE, XAR, TcCOM, FSoE, AMS, RMS, TwinCAT/BSD, etc.)
- `patterns.md` — Design patterns extracted from Beckhoff TwinCAT, mapped to AUDESYS applicability
- `cheatsheet.md` — Quick-reference: architecture diagram, key numbers, protocol comparison, AUDESYS mapping

## Core Design Decisions (Quick Reference)

1. **PC-based Control over custom hardware** — standard IPC replaces dedicated PLC hardware, leverages CPU generational upgrades
2. **VS Shell as IDE, not self-built** — embed Visual Studio, focus engineering on automation-specific editors
3. **EtherCAT as real-time Ethernet** — on-the-fly processing achieves 50us cycle, <1us jitter, dominates benchmark
4. **Multi-runtime in one Task scheduler** — PLC/NC/CNC/Safety/Vision/Analytics share same real-time scheduler
5. **ADS message router as unified protocol** — (AMS Port, IndexGroup, IndexOffset) binary addressing
6. **Platform Level licensing** — price by CPU core count, not feature count
7. **Open interface, closed core** — EtherCAT/ADS open, runtime closed, third-party ecosystem via TcCOM
8. **TwinCAT/BSD as Windows independence** — FreeBSD-based RTOS eliminates Windows dependency and licensing cost

## Risks to Avoid

- Performance claims without dependency conditions (EtherCAT 50us requires core isolation, <64 slaves, <70% bandwidth)
- Proprietary IDE shell lock-in (VS Shell dependency on Microsoft ecosystem)
- C++ Module complexity — C++ in RT tasks requires rigorous testing discipline
- TwinCAT/BSD limited third-party support — Vision and some features still Windows-only
- Platform Level pricing complexity — 10 levels with 100+ TFxxxx modules creates confusing SKU matrix