# ref-codesys

**CODESYS IDE Platform Reference for AUDESYS Studio Design**

> Study-depth reference skill extracted from `docs/reference/codesys.md`. Focuses on design decisions, architectural patterns, and UI patterns that AUDESYS Studio can learn from.

## Overview

CODESYS is the dominant hardware-independent IEC 61131-3 industrial control development platform. This skill captures its architecture, IDE design patterns, runtime model, and business strategies — distilled for AUDESYS Studio design decisions.

## When to Use

- Designing AUDESYS Studio's IDE architecture (plugin system, project tree, editor model)
- Deciding Runtime/IDE communication patterns
- Evaluating hardware abstraction and device description formats
- Designing visualization/HMI integration within the IDE
- Comparing AUDESYS's approach against the industry-standard reference
- Business model planning (IDE pricing, OEM SDK, app store)

## Chapters

| File | Section | Content |
|------|---------|---------|
| `chapters/ch01-product-portrait.md` | §1 产品画像 | Identity, positioning, user segments, licensing model |
| `chapters/ch02-technical-features.md` | §2 技术特性 | Core architecture (IDE/Runtime/Compiler), key capabilities, language support, compilers, RT, library system, scripting, fieldbus, hardware support, toolchain |
| `chapters/ch03-functional-overview.md` | §3 功能概览 | Control, Visualization, SoftMotion, Safety, Fieldbus, OPC UA, Redundancy, Automation Server, ProDev, workflows, extension mechanisms |
| `chapters/ch04-status-ecosystem.md` | §4 现状与生态 | Versions, user base, hardware/software ecosystem, training, recent trends (modularization, Web IDE, IIoT, virtualization, security) |
| `chapters/ch05-market-positioning.md` | §5 市场定位 | Industries, competitive analysis vs TIA/TwinCAT/Studio5000/EcoStruxure, competitive/complementary relationships |
| `chapters/ch06-product-characteristics.md` | §6 产品特色 | Hardware-independent SoftPLC, compiler standard status, visualization integration, motion+logic integration, modularity, safety certification |
| `chapters/ch07-reference-value.md` | §7 对AUDESYS的参考价值 | Compiler/RT architecture lessons, IDE design patterns, HAL abstraction patterns, visualization integration, OPC UA strategy, business model, risks to avoid |

## Companion Files

- `glossary.md` — Term definitions (Language Model, SoftPLC, DDF, Online Change, SIL, OSAL, etc.)
- `patterns.md` — Design patterns extracted from CODESYS, mapped to AUDESYS Studio applicability
- `cheatsheet.md` — Quick-reference: key decisions, numbers, relationships at a glance

## Core Design Decisions (Quick Reference)

1. **IDE free, Runtime licensed** — lowers learning barrier, monetizes deployment
2. **Language Model as central IR** — all editor inputs (LD/FBD/SFC) → ST → compiler
3. **Native code generation, not interpretation** — per-CPU optimized machine code
4. **Plugin-based IDE (DI framework)** — editors, compilers, fieldbus configgers are all plugins
5. **Device Description Files (DDF)** — XML device capabilities exposed to IDE
6. **Hardware-independent SoftPLC** — one IDE for 400+ OEM brands
7. **Visualization shares variable space** — HMI directly accesses PLC variables, no OPC config
8. **Safety runtime isolated from standard runtime** — TÜV pre-certified, separate execution context

## Risks to Avoid

- Compiler version fragmentation (SP17→SP18 taught this lesson)
- IDE/Runtime compatibility breaks across versions
- Plugin dependency management after modularization
- Web IDE migration (CODESYS go!) — long coexistence strategy unproven
