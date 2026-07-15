# ref-labview — LabVIEW Graphical Programming Reference for AUDESYS

**Name**: ref-labview
**Description**: LabVIEW graphical programming reference — G language dataflow, .vi binary format lessons, hardware integration patterns, rapid prototyping model. Use when designing AUDESYS Studio visual designer, HAL naming, or evaluating graphical vs textual tradeoffs.
**Study Depth**: Technical engineering analysis with AUDESYS design mapping.
**AI Mode**: Technical. Use exact terminology. No simplification for non-engineers.

## When to Use

- AUDESYS Studio IDE visual designer decisions
- HAL naming and channel architecture design
- Graphical vs textual programming tradeoff evaluation
- Dataflow programming pattern adoption (Signal/StreamChannel/RPC)
- Studio debugging UI design (probe, highlight execution)
- Project file format decisions (avoiding binary format pitfalls)

## Skill Structure

```
ref-labview/
├── SKILL.md              # This file — entry point, use guide, cross-references
├── chapters/
│   ├── ch01.md           # Product & Historical Context
│   ├── ch02.md           # Technical Architecture & G Language
│   ├── ch03.md           # Core Programming Patterns & Compiler
│   ├── ch04.md           # RT, FPGA & Advanced Modules
│   ├── ch05.md           # Hardware Abstraction (DAQmx/VISA)
│   ├── ch06.md           # Ecosystem, Market & Community
│   └── ch07.md           # AUDESYS Mapping & Design Implications
├── glossary.md           # LabVIEW terminology glossary
├── patterns.md           # Reusable architectural patterns
└── cheatsheet.md         # Quick reference card
```

## Study Approach

1. Read `ch01.md` for historical context and LabVIEW's product philosophy
2. Read `ch02.md` + `ch03.md` for G language and dataflow model (core differentiator)
3. Read `ch04.md` for RT/FPGA execution models relevant to AUDESYS Runtime
4. Read `ch05.md` for HAL design comparison (most directly applicable)
5. Read `ch07.md` for explicit AUDESYS design mapping (reference value section)
6. Use `patterns.md` for reusable architecture patterns
7. Use `cheatsheet.md` for quick recall
8. Use `glossary.md` for terminology lookup

## Key Takeaways for AUDESYS

1. **Dataflow validation**: LabVIEW 30+ years of dataflow programming validates AUDESYS D10 decision (Signal/StreamChannel/RPC three-primitive separation). Tag Channel (latest-value) = Signal, Stream Channel (buffered) = StreamChannel.
2. **Binary format lesson**: LabVIEW's .vi binary format is the single largest source of version-control pain. AUDESYS project files MUST be text-based from day 1.
3. **DAQmx channel architecture**: Physical channel -> virtual channel -> Task model directly maps to AUDESYS component.interface.name -> Signal naming pattern.
4. **NXG cautionary tale**: Second-system-effect (rewrite syndrome) killed LabVIEW NXG despite huge investment. AUDESYS must evolve incrementally.
5. **RT scheduling validation**: LabVIEW RT's timed loop + CPU core isolation + watchdog aligns with AUDESYS D13 four-system hybrid thread scheduling.
6. **Unified target model**: Same language -> Windows/RT/FPGA/Web. AUDESYS D19 multi-language strategy (Rust core + FFI + FlatBuffers) is a practical take on the same concept.
7. **Graphical limits**: LabVIEW proves graphical programming works for test/measurement but struggles with large-program maintainability. AUDESYS Studio should keep ST as primary, graphical as auxiliary.

## Critical Anti-Patterns to Avoid

| LabVIEW Anti-Pattern | AUDESYS Avoidance Strategy |
|---------------------|---------------------------|
| Binary .vi source files | Text-first: YAML/JSON/TOML for all project files |
| Hardware vendor lock-in (NI-only DAQ) | amw trait-based transport swapping |
| Monolithic IDE (NXG attempted rewrite) | Plugin-based architecture (VS Code model) |
| Graphical spaghetti in large projects | ST as primary language, graphical as debug overlay |
| GUI-dependent hardware config (MAX) | CLI + YAML-first config, GUI as optional |
| Error Cluster runtime-only checking | Rust Result<T,E> compile-time checking |

## Related Files

- `docs/reference/labview.md` — Full 1112-line source reference document
- `docs/modules/hal/hal-protocol-design.md` — HAL protocol three-primitive design
- `.agents/memorys/decisions.md` D10 — HAL communication primitives decision
- `.agents/memorys/decisions.md` D19 — Multi-language strategy decision
- `.agents/memorys/decisions.md` D13 — Thread scheduling design decision