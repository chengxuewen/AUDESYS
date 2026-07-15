# ref-ignition: Ignition SCADA Platform Reference

> **Domain**: Industrial SCADA / HMI Platform  
> **Source**: `docs/reference/ignition.md` (801 lines)  
> **Target**: AUDESYS Studio HMI design, Runtime architecture, commercial strategy  
> **Depth**: Technical study — architecture, patterns, pitfalls, reference value

## Overview

Ignition SCADA (Inductive Automation) is a web-native industrial application platform known for its unlimited licensing model, Perspective web-first HMI, and deep MQTT Sparkplug integration. This skill extracts the technical architecture, design patterns, commercial strategy, and AUDESYS-relevant lessons from the 7-section reference document.

## When to Use

- Designing AUDESYS Studio HMI editor (Web IDE layout, component model, session management)
- Architecting AUDESYS Runtime's tag/data point system
- Planning AUDESYS commercial licensing model
- Designing protocol adapter architecture (HAL Driver Manager)
- Evaluating script/extension language strategy for AUDESYS
- Planning community ecosystem (training, certification, marketplace)

## Core Frameworks (4 Pillars)

### 1. Perspective Web-First HMI

Perspective is Ignition's next-gen HMI module (HTML5/React, browser-based designer, responsive layout).

| Aspect | Detail |
|--------|--------|
| **Tech Stack** | React/TypeScript frontend, WebSocket real-time comm, browser-based Designer |
| **Layout** | Flexbox/CSS Grid responsive — one design for phone/tablet/desktop |
| **Session Model** | Each browser tab = independent Session with lifecycle + properties |
| **Components** | 200+ built-in (charts, gauges, maps, alarm tables, QR scanners) |
| **Offline** | Local cache on disconnect, auto-sync on reconnect |
| **Data Binding** | Bidirectional, transforms, expression bindings |
| **Scripting** | Python (server-side) + JavaScript (client-side, limited) |

**Key AUDESYS Reference**: Browser-based industrial IDE is proven viable. Perspective Designer proved SCADA engineering can run in a browser.

### 2. Jython Scripting (and Its Lessons)

Ignition uses Jython (Python 2.7 on Java) as its primary scripting language.

| Aspect | Detail |
|--------|--------|
| **Scope** | Gateway scripts, client event scripts, tag event scripts, alarm pipeline scripts |
| **API** | `system` library (core API: tag read/write, DB, alarms) + Java interop |
| **Problem** | Python 2.7 EOL (2020), migration to GraalPy/Python 3 is slow and painful |
| **Lesson** | Script language lock-in is a 10-year technical debt. Prefer WASM plugins or Lua for lightweight embedding |

### 3. Module-Based Architecture

Ignition uses OSGi module framework for extensibility.

| Aspect | Detail |
|--------|--------|
| **Core** | Gateway (Java) with built-in web server, tag engine, scripting, alarm engine |
| **Modules** | Perspective, Vision, MQTT Engine, Reporting, Alarm Notification, SQL Bridge, etc. |
| **Packaging** | Solution Suites (5 suites in 8.3) bundle related modules |
| **Third-Party** | Sepasoft (MES/OEE), Cirrus Link (MQTT), EAM, Kymera |

### 4. Tag System (Data Point Architecture)

Ignition's Tag Provider pattern abstracts heterogeneous data sources.

| Provider | Protocol | Use Case |
|----------|----------|----------|
| OPC UA | OPC UA TCP | Connect any OPC UA server |
| MQTT Engine | MQTT Sparkplug | Auto-discover devices, auto-create tags |
| Modbus | Modbus TCP/RTU | Legacy device connectivity |
| Memory | None | Internal/computed tags |
| Expression | None | Calculated tags from other tags |
| SQL Bridge | JDBC | Bidirectional DB sync |
| Siemens S7 | S7 Protocol | Direct Siemens PLC |
| Allen-Bradley | EtherNet/IP | Direct Rockwell PLC |

## Chapter Structure

The full reference is organized into 7 chapters:

| Chapter | File | Topic |
|---------|------|-------|
| 1 | `chapters/ch01.md` | 产品画像 — Product Profile, licensing, target users |
| 2 | `chapters/ch02.md` | 技术特性 — Architecture, Gateway, Designer, Perspective, Vision, Tag Provider, MQTT, OPC UA, Security, Scalability |
| 3 | `chapters/ch03.md` | 功能概览 — Visualization, Alarms, Trending, Reporting, Recipes, Redundancy, i18n |
| 4 | `chapters/ch04.md` | 现状与生态 — Version history, community, platform support, competitive comparison |
| 5 | `chapters/ch05.md` | 市场定位 — Target industries, market position, pricing tiers, core competencies |
| 6 | `chapters/ch06.md` | 产品特色 — Unlimited licensing, Web-Launch, Perspective, MQTT-first, Gateway architecture, Inductive University |
| 7 | `chapters/ch07.md` | 对 AUDESYS 参考价值 — Web IDE, licensing, HAL mapping, protocol adapters, alarm management, script strategy, community |

## Supporting Files

| File | Description |
|------|-------------|
| `glossary.md` | Key Ignition terminology (EN/CN) |
| `patterns.md` | Design patterns extracted from Ignition architecture |
| `cheatsheet.md` | Quick reference: architecture, components, API, comparison |

## Key Pitfalls (from Ignition)

1. **Vision ↔ Perspective dual maintenance**: Two HMI product lines double maintenance. AUDESYS should pick ONE tech stack from day one.
2. **Jython (Python 2.7) lock-in**: Script language runtime becomes 10-year debt. Choose embedding strategy carefully.
3. **Java dependency**: Gateway on JVM is heavy for embedded/RT scenarios. AUDESYS Runtime should use C/Rust for real-time paths.
4. **MQTT vendor dependency**: MQTT modules depend on Cirrus Link. Core communication should be in-house or fully open-source.
5. **Binary format (no Git diff)**: Ignition project files are not easily diffable. AUDESYS should use text-based config formats (YAML).

## Reference Value for AUDESYS

| Area | Ignition Lesson | AUDESYS Application |
|------|----------------|---------------------|
| Web IDE | Perspective Designer proved browser-based SCADA engineering works | AUDESYS Studio HMI designer should be Web-first |
| Licensing | Unlimited server licensing eliminates cost anxiety | Consider platform-free + module-paid model |
| Protocol Adapters | Tag Provider pattern = unified driver interface | HAL Driver Manager trait design |
| Alarm Pipeline | ISA 18.2 alarm lifecycle management | AUDESYS Runtime alarm pipeline |
| Scripting | Jython lock-in is a 10-year trap | WASM plugins or Lua for embedding |
| Community | Inductive University + Integrator Program = ecosystem flywheel | AUDESYS Academy + Partner Program |
| OPC UA | Built-in OPC UA Server + Client is essential | AUDESYS Runtime should embed OPC UA server |
| Architecture | Gateway-centric (thin client) | AUDESYS Runtime-centric (HAL as core) |

## Related Skills

- `ref-codesys` — CODESYS IDE architecture and IEC 61131-3 compiler strategy
- `ref-labview` — LabVIEW graphical programming and binary format lessons
- `design-system` — AUDESYS industrial UI design system