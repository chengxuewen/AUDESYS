# ref-intouch: AVEVA InTouch HMI/SCADA Reference

> **Domain**: Industrial HMI / SCADA Platform  
> **Source**: `docs/reference/intouch.md` (1532 lines)  
> **Target**: AUDESYS Studio HMI design, Runtime architecture, HAL device modeling, alarm management  
> **Depth**: Technical study — architecture, patterns, pitfalls, reference value

## Overview

AVEVA InTouch (formerly Wonderware InTouch) is the world's most widely deployed HMI/SCADA platform, with over 35 years of continuous development. It pioneered the Windows-based HMI paradigm, the Tag-based data model, and the ArchestrA object-oriented automation framework. This skill extracts the technical architecture, design patterns, migration lessons, and AUDESYS-relevant insights from the 7-section reference document.

## When to Use

- Designing AUDESYS Studio HMI editor (WindowMaker ↔ Studio IDE mapping)
- Architecting AUDESYS Runtime rendering engine (WindowViewer ↔ Runtime)
- Defining HAL Device Model (ArchestrA object template patterns)
- Designing alarm management system (InTouch distributed alarm architecture)
- Planning Studio configuration management (Galaxy repository patterns)
- Evaluating Tag-based vs Signal-based data model tradeoffs
- Understanding industrial HMI modernization challenges (Win32 → HTML5)

## Core Frameworks (5 Pillars)

### 1. ArchestrA Object-Oriented Automation

ArchestrA (2002) was the industry's first OOP framework for SCADA, solving the flat Tag model's three fundamental problems: Tag explosion, non-reusable engineering, and fragmented deployment.

| Concept | Description | OOP Analogy |
|---------|-------------|-------------|
| **Template** | Blueprint defining attributes, scripts, graphics for a device class | Class |
| **Derived Template** | Extension/customization of a parent template | Subclass |
| **Instance** | Runtime object bound to physical I/O addresses | Object Instance |
| **Containment** | Hierarchical object composition (pump → tank → area → plant) | Composition |
| **Deployment** | Assign object instance to specific AppEngine node | Deployment |
| **Galaxy** | Unified logical namespace for all templates/instances/graphics | Namespace |

**Key AUDESYS Reference**: HAL Device Model should follow the same template→instance pattern.

### 2. Galaxy Repository (Centralized Configuration Database)

Galaxy is the single source of truth for all System Platform configuration, built on Microsoft SQL Server.

| Feature | Detail |
|---------|--------|
| **Single Source of Truth** | All objects, templates, graphics, security in one DB |
| **Multi-User Development** | Check-out/check-in for concurrent engineering |
| **Centralized Deployment** | Deploy/Undeploy objects to AppEngine nodes |
| **Logical Namespace** | Galaxy-level names, no physical node paths |
| **Version Management** | Template changes propagate to all instances |

**Key AUDESYS Reference**: Studio should use Git-based configuration as code instead of Galaxy's heavy SQL Server dependency.

### 3. WindowMaker ↔ WindowViewer (IDE/Runtime Separation)

InTouch's most influential design decision: clear separation between development environment (WindowMaker) and runtime execution (WindowViewer).

| InTouch Component | AUDESYS Counterpart |
|-------------------|---------------------|
| WindowMaker (IDE) | Studio IDE |
| WindowViewer (Runtime) | Runtime Engine |
| Fast Switch (hot reload) | Studio Simulator preview |
| NAD (Network App Distribution) | Runtime remote deployment |
| Tagname Dictionary | Signal/StreamChannel Registry |

### 4. Distributed Alarm System

InTouch's alarm system is considered the industry's most mature, using a Provider-Consumer architecture.

| Feature | Detail |
|---------|--------|
| **Provider-Consumer** | Decoupled alarm generation and consumption |
| **Distributed Memory** | Multi-node alarms form a logical unified view |
| **Millisecond UTC Timestamps** | Cross-timezone SOE (Sequence of Events) |
| **Seamless Failover** | Backup provider auto-takes over on disconnect |
| **Alarm Types** | Value (HH/HI/LO/LOLO), Deviation, Rate-of-Change, Event |
| **Priority 1-999** | 4 configurable ranges with independent colors/ack strategies |

### 5. I/O Server Communication Model

InTouch's communication architecture evolved from DDE → SuiteLink → OPC UA, with a critical abstraction layer called Access Name.

| Protocol | Layer | Status |
|----------|-------|--------|
| SuiteLink | TCP/IP (VTQ: Value/Time/Quality) | Recommended |
| DDE/FastDDE | Windows Messages | Legacy, being phased out |
| OPC DA | COM/DCOM | Mature, widely used |
| OPC UA | TCP/HTTPS | Current mainstream |
| MQTT | TCP | New (2023+) |
| **Access Name** | **Abstraction Layer** | **Core design pattern** |

**Key AUDESYS Reference**: Access Name pattern = amw connection abstraction. Protocol details hidden from application layer.

## Chapter Structure

| Chapter | File | Topic |
|---------|------|-------|
| 1 | `chapters/ch01.md` | 产品画像 — Product history, company evolution, product line portfolio, licensing |
| 2 | `chapters/ch02.md` | 技术特性 — 5-layer architecture, ArchestrA, Galaxy, WindowMaker/Viewer, Tag model, QuickScript, I/O Server, OMI, Edge, distributed architecture, security |
| 3 | `chapters/ch03.md` | 功能概览 — Visualization, alarms, historian/trending, security, recipe management, SPC, redundancy, i18n |
| 4 | `chapters/ch04.md` | 现状与生态 — Version status, install base, industry coverage, partner ecosystem, support lifecycle |
| 5 | `chapters/ch05.md` | 市场定位 — Competitive landscape, Ignition comparison, TCO analysis, pricing evolution |
| 6 | `chapters/ch06.md` | 产品特色 — ArchestrA paradigm, Galaxy repository, 35-year legacy, AVEVA ecosystem, drive coverage, modernization story |
| 7 | `chapters/ch07.md` | 对 AUDESYS 参考价值 — HAL device model, Studio config management, design-time/runtime separation, Tag evolution lessons, OMI modernization, amw communication, alarm architecture, engineering efficiency, redundancy, pitfalls |

## Supporting Files

| File | Description |
|------|-------------|
| `glossary.md` | Key InTouch/Wonderware terminology (EN/CN) |
| `patterns.md` | Design patterns extracted from InTouch architecture |
| `cheatsheet.md` | Quick reference: architecture layers, Tag types, script types, communication protocols, comparison table |

## Key Pitfalls (from InTouch)

1. **Tag model technical debt**: Flat Tag model leads to engineering non-reusability and Tag explosion. AUDESYS D10 Signal/StreamChannel/RPC tripartite model is correct — do not introduce flat Tag compatibility layer.
2. **Dual product line maintenance burden**: InTouch OMI + WindowViewer, Classic + System Platform dual lines create long-term maintenance cost. AUDESYS Studio should pick ONE tech stack (Web frontend + Rust backend).
3. **Backward compatibility tax**: 30+ years of supporting DDE, NetDDE, Group Var Tags, legacy QuickScript syntax slows modernization. AUDESYS should minimize backward compatibility commitments.
4. **Windows lock-in**: COM/DCOM, ActiveX, SuiteLink Windows performance counters — platform binding limits deployment options. AUDESYS Rust/C implementation avoids this.
5. **Installation bloat**: "Even InTouch alone requires 4.5GB System Platform repository" — packaging friction. AUDESYS should maintain modular installation.
6. **Galaxy over-engineering**: Galaxy's centralized management overhead outweighs benefits for small projects. AUDESYS should adopt "progressive complexity" — simple config for small projects, full object model for large ones.
7. **Pricing opacity**: Non-public pricing through partner channels creates market distrust. AUDESYS should consider transparent pricing if commercialized.

## Reference Value for AUDESYS

| Area | InTouch Lesson | AUDESYS Application |
|------|---------------|---------------------|
| HAL Device Model | ArchestrA template → instance → containment | Device Model templates with Signal/StreamChannel/RPC interfaces |
| Studio/Runtime Separation | WindowMaker/WindowViewer as proven pattern | Studio IDE ↔ Runtime Engine with Fast Switch simulation |
| Configuration Management | Galaxy centralized DB (good concept, heavy impl) | Git-based configuration as code |
| Tag Evolution | Tag → SuperTag → ArchestrA object (15 years) | Start with Signal/StreamChannel/RPC, avoid flat model |
| HMI Modernization | Win32 WindowViewer → HTML5 OMI | Studio HMI designer should be Web-first from day one |
| Alarm Management | Provider-Consumer distributed alarm | AUDESYS Runtime alarm pipeline |
| Communication | Access Name abstraction layer | amw_transport trait design |
| Scripting | QuickScript → .NET/C# migration | WASM plugins or Lua for embedding |
| Licensing | Tag-tier → Unlimited (2024) | Platform-free + module-paid model |
| Redundancy | AppEngine Primary/Backup | Runtime ACTIVE/STANDBY (Phase 2) |

## Related Skills

- `ref-ignition` — Ignition SCADA platform (Perspective Web HMI, Jython lessons, unlimited licensing)
- `ref-codesys` — CODESYS IDE architecture and IEC 61131-3 compiler strategy
- `ref-fuxa` — FUXA Web-based SCADA/HMI (Node.js, SVG-based, lightweight)
- `design-system` — AUDESYS industrial UI design system