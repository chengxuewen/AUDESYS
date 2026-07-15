# ref-fuxa — FUXA Web SCADA Reference for AUDESYS Studio HMI Design

**Name**: ref-fuxa
**Description**: FUXA open-source Web SCADA/HMI reference — SVG drag-and-drop editor, plugin-based protocol adapter architecture, lightweight Node.js deployment, JSON-native project files. Use when designing AUDESYS Studio HMI Designer, HAL driver interfaces, or evaluating Web-native SCADA architecture.
**Source**: `docs/reference/fuxa.md`
**Study Depth**: Technical engineering analysis with AUDESYS design mapping.
**AI Mode**: Technical. Use exact terminology. No simplification for non-engineers.

## When to Use

- AUDESYS Studio HMI Designer interaction model decisions
- SVG editor component architecture (component library, data binding, conditional styling)
- HAL driver plugin architecture and protocol adapter interface design
- Web-native SCADA deployment patterns (Docker, Raspberry Pi, edge)
- JSON-native project file format decisions (vs binary formats)
- Lightweight SCADA architecture evaluation (Rust vs Node.js tradeoffs)
- Protocol adapter testing and integration patterns

## Skill Structure

```
ref-fuxa/
├── SKILL.md              # This file — entry point, use guide, cross-references
├── chapters/
│   ├── ch01.md           # Product Profile & Core Value
│   ├── ch02.md           # Technical Architecture (Node.js + Angular + Protocol Adapters)
│   ├── ch03.md           # Feature Overview (Visualization, Alarms, Trends, REST API)
│   ├── ch04.md           # Ecosystem & Community (Versions, Deployment, Stack)
│   ├── ch05.md           # Market Positioning & Competitive Analysis
│   ├── ch06.md           # Product Differentiators (SVG Editor, Lightweight, MIT, Docker)
│   └── ch07.md           # AUDESYS Reference Value & Design Mapping
├── glossary.md           # FUXA terminology glossary
├── patterns.md           # Reusable architectural patterns
└── cheatsheet.md         # Quick reference card
```

## Study Approach

1. Read `ch01.md` for product positioning and FUXA's core value proposition
2. Read `ch02.md` for architecture: Node.js backend, Angular frontend, plugin protocol adapters
3. Read `ch03.md` for feature set: SVG visualization, alarms, trends, REST API
4. Read `ch04.md` for ecosystem maturity, deployment options, and tech stack details
5. Read `ch06.md` for differentiators: SVG editor as "Web HMI Figma", Raspberry Pi deployment
6. Read `ch07.md` for explicit AUDESYS design mapping (most directly applicable)
7. Use `patterns.md` for reusable architecture patterns
8. Use `cheatsheet.md` for quick recall

## Key Takeaways for AUDESYS

1. **SVG editor validates Web-native HMI**: FUXA proves a browser-based drag-and-drop HMI designer is production-viable. AUDESYS Studio HMI Designer should adopt the same three-panel layout (toolbox + canvas + property panel) and data-binding model.
2. **Plugin protocol adapters map to HAL Driver trait**: FUXA's unified `connect/disconnect/read/write` interface across 8 protocols directly validates AUDESYS HAL Driver trait architecture. Each protocol = independent crate, same interface.
3. **JSON project files over binary formats**: FUXA stores entire SCADA projects as JSON files in `_appdata/` — Git-friendly, scriptable, human-readable. Confirms AUDESYS D24 (YAML + FlatBuffers) direction.
4. **Node.js GC is NOT hard real-time**: FUXA uses Node.js with GC pauses. AUDESYS Runtime's Rust choice provides inherent advantage: lower memory (10-50MB vs 200-500MB), faster startup (ms vs s), no GC stalls, SCHED_FIFO determinism.
5. **REST API enables middleware role**: FUXA's REST API allows it to act as a data middle layer between physical devices and MES/ERP/AI systems — validates AUDESYS Runtime's API gateway role.
6. **WebSocket real-time channel**: FUXA uses WebSocket (socket.io) for millisecond tag push. AUDESYS can use WebSocket or HAL StreamChannel Web bridge.
7. **Raspberry Pi deployment precedent**: $45 total cost for a SCADA server — validates AUDESYS edge deployment targets.

## Critical Anti-Patterns to Avoid

| FUXA Limitation | AUDESYS Avoidance Strategy |
|-----------------|---------------------------|
| Node.js GC pauses (non-deterministic timing) | Rust core, no GC, SCHED_FIFO real-time scheduling |
| Single-process architecture (no horizontal scaling) | Rust multi-threading + amw trait-based transport swapping |
| SQLite performance ceiling (>1000 tags) | Pluggable time-series storage backend (TDengine/InfluxDB) |
| Basic security (no LDAP/OAuth/2FA) | Enterprise RBAC + LDAP/OAuth from Day 1 |
| SVG rendering limit (~200 components/page) | Canvas/WebGL for high-density rendering |
| Basic JavaScript scripting | WASM multi-language plugin system (D26) |
| No redundancy support | HAL built-in redundancy (D28) |

## Related Files

- `docs/reference/fuxa.md` — Full 799-line source reference document
- `.agents/memorys/decisions.md` D21 — Studio IDE tech stack (Tauri + React + TypeScript)
- `.agents/memorys/decisions.md` D24 — Config format (YAML + FlatBuffers)
- `.agents/memorys/decisions.md` D25 — Studio programming mode (ST Only + HMI designer)
- `.agents/memorys/decisions.md` D38 — Studio integration timing (parallel + progressive)
- `docs/modules/hal/hal-protocol-design.md` — HAL protocol three-primitive design
