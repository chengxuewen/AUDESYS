# Decision Gates

> Generated: 2026-07-27 — After implementing LD GLSP client files with hardcoded colors, sizes, IDs, and names without user confirmation.

## When to STOP and ASK (even during active implementation)

Any of these triggers require `question()` BEFORE writing code:

| Trigger | Examples (from today's session) |
|---------|--------------------------------|
| **Naming conventions** | `diagramType: 'ld-diagram'`, `contributionId: 'audesys-ld'` |
| **Visual values** | Colors `#4caf50`, sizes `36px`, layout offsets `80` |
| **String patterns** | Auto-naming `IN{n}`/`OUT{n}`, file extensions `.ld` |
| **Architecture choices within a file** | "Should CSS be inline, in a theme file, or fetched from existing system?" |
| **New file creation** | Any `write` to a file path not explicitly requested |
| **Default fallback values** | `var(--ld-contact-no-fill, #4caf50)` — where do the defaults come from? |
| **Behavioral defaults** | "What happens if the user has 1,000 contacts?" |

## When NOT to ask (safe defaults)

| Safe to proceed | Because |
|-----------------|---------|
| Import paths from confirmed dependencies | Already validated by `npm install` |
| GLSP API usage from the template | Pattern is proven, no alternatives |
| File structure following the template | Directory layout is standard |
| TypeScript types following existing patterns | Matches existing codebase conventions |
| Test file creation following AAA | Standard testing pattern |

## Why this matters

Today's 4 hardcoded decisions cost 0 immediate tokens but create technical debt:
- Color changes require editing 2-3 files instead of 1
- Diagram type rename requires updating server AND client AND Theia config
- Auto-naming patterns can't be customized without code changes

Better to ask once (50 tokens) than refactor later (500+ tokens).
