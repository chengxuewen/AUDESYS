# Rules

Rules are part of the `.agents/` directory, organized into a **common** layer plus **language-specific** files:

```text
.agents/rules/
├── common/          # Language-agnostic principles (always loaded)
│   ├── coding-style.md
│   ├── git-workflow.md
│   ├── testing.md
│   ├── performance.md
│   ├── patterns.md
│   ├── hooks.md
│   ├── agents.md
│   ├── security.md
│   ├── code-review.md
│   ├── development-workflow.md
│   ├── edit-safety.md
│   ├── decision-gates.md
│   └── lesson-memory.md
├── rust.md          # Rust-specific rules (consolidated)
└── typescript.md    # TypeScript/JavaScript-specific rules (consolidated)
```

- **common/** contains universal principles — no language-specific code examples.
- **rust.md** and **typescript.md** extend the common rules with language-specific patterns, tools, and code examples. Each references its common counterpart.

## Rule Priority

When language-specific rules and common rules conflict, **language-specific rules take precedence** (specific overrides general).

## Adding a New Language

To add support for a new language (e.g., consolidate a `go.md` file):

1. Create `.agents/rules/go.md` with frontmatter `paths:` for matching extensions
2. Add the file to `.opencode/opencode.json` instructions array
3. Content should start with a reference to the relevant common rule(s)

## Note on Deleted Files

The following were removed during consolidation (2026-07-28):
- 8 unused language directories (dart, golang, java, kotlin, csharp, perl, php, swift) — zero source files in project
- `zh/` — Chinese translations (AI reads English rules from `opencode.json`)
- `web/` — no frontmatter, never loaded by agent
- Old per-language multi-file structure replaced by consolidated single files per language
