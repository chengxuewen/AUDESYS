---
name: openspec-apply
description: >-
  Implement tasks from an AUDESYS change proposal. Use when the user wants to
  start implementing, continue implementation, or work through tasks in the
  Rust + HAL + amw_inproc (multi-language) codebase.
  Cross-references openspec/specs/ for API contracts, test-first execution
  when specified, and verifies each task through the 7-gate QA sequence.
license: MIT
compatibility: Designed for Claude Code, GitHub Copilot, and similar agents.
disable-model-invocation: false
metadata:
  author: openspec
  version: "2.0"
  category: workflow
  project: AUDESYS
---

# OpenSpec Apply — AUDESYS

Implement tasks from an AUDESYS change proposal. Work through design-specified tasks in the AUDESYS codebase (Rust + HAL + amw_inproc — multi-language, D10/D11/D19).

---

**Input**: Optionally specify a change name (kebab-case). If omitted, check if it can be inferred from conversation context. If vague or ambiguous, list available proposals under `.sisyphus/plans/`.

---

## Steps

### 1. Select the change

If a name is provided, use it. Otherwise:
- Infer from conversation context if the user mentioned a change
- Auto-select if only one active proposal exists
- If ambiguous, list `.sisyphus/plans/` directories and ask the user to select

Always announce: "Using change: `<name>`".

### 2. Read the proposal artifacts

Read these files in order to understand the full scope:

- `.sisyphus/plans/<change-name>/proposal.md` — What & why
- `.sisyphus/plans/<change-name>/design.md` — How
- `.sisyphus/plans/<change-name>/tasks.md` — Tasks

Also read relevant AUDESYS source files referenced in the design for context.

### 3. Show current progress

Display:
- Change name and description
- Progress: "N/M tasks complete"
- Remaining tasks overview

### 4. Implement tasks (loop until done or blocked)

For each unchecked task (in order):

#### a. Pre-flight: find relevant specs

Before writing code, scan `openspec/specs/` for matching specs:

```bash
grep -rl "module: <crate-name>" openspec/specs/
```

Read the matching spec(s). They define trait method signatures, behavior contracts, and boundary conditions. Use the spec as the API contract.

#### b. Test-first (if specified)

If the task says "test first", "TDD", or "write test before implementation":
1. Write the test in the appropriate `tests/` or `#[cfg(test)]` module
2. Run the test — it **must fail** (RED)
3. Proceed to implementation

#### c. Implement

Write the minimal implementation following:
- Rust conventions with ownership, borrowing, and traits
- `.agents/rules/rust/coding-style.md`
- `.agents/rules/common/coding-style.md` — immutability, KISS, DRY, YAGNI
- HAL trait implementations for Signal/StreamChannel (D10)
- `HAL Config Barrier (D17)` for configuration changes at RT cycle boundaries
- Multi-language interop via FlatBuffers (D19) for non-RT paths

Target the smallest diff that works. One logical change per task.

#### d. Verify: 7-gate sequence

Run gates in order. Stop on first failure:

```bash
# Gate 1: Compile check (fast fail)
cargo check -p <crate-name>

# Gate 2: Format check
cargo fmt --check

# Gate 3: Lint (must be warning-free)
cargo clippy -- -D warnings

# Gate 4: Unit/integration tests
cargo test -p <crate-name>

# Gate 5: FlatBuffers schema (only if .fbs files changed)
flatc --rust -o crates/<crate>/src/ crates/<crate>/schema/*.fbs

# Gate 6: Full QA gate
./scripts/qa/qa-fast.sh

# Gate 7: Coverage (Phase 1+ only)
cargo tarpaulin --workspace --fail-under 80
```

Gate 5 only runs if `.fbs` files were modified. Gate 7 only required in Phase 1+ — skip in Phase 0.

**On failure**: STOP. Diagnose and fix. Do NOT continue to next task.

**On pass**: Mark complete.

#### e. Mark complete

Update `tasks.md` — change `- [ ]` to `- [x]` for the completed task. Show a brief status line.

### 5. On completion or pause, show status

```
## Implementing: <change-name>

Working on task 3/7: <task description>
  [...] implementation happening ...
  [gate 1-6] passed
  Task complete

Working on task 4/7: <task description>
  [...] implementation happening ...
  Task complete
```

---

## Spec Cross-Referencing

During implementation, keep the matching spec(s) open. The spec defines the contract; the task tells you which part to implement.

- **Rust task** → implement the trait method per matching spec in `openspec/specs/`
- **FlatBuffers task** → implement per `.fbs` schema definition
- If the implementation must deviate from the spec, note the deviation and mark the spec `status: review`

## Rule Hierarchy

When guidance conflicts, follow this order:

1. Task description (most specific)
2. Spec file (`openspec/specs/`) — API contract
3. Design doc (`.sisyphus/plans/<name>/design.md`) — architecture
4. Language rules (`.agents/rules/rust/`)
5. Common rules (`.agents/rules/common/`)

## When to Write a New Spec

If a task adds a new cross-crate API and no spec exists in `openspec/specs/`:

1. Pause implementation
2. Note: "No spec found for <API name>. Writing spec before implementation."
3. Create spec in `openspec/specs/<module>/` following SDD patterns (ID, precondition, operation, expected, boundary)
4. Resume implementation

---

## AUDESYS Build & Verification Commands

For use during implementation:

```bash
# Build specific crate
cargo build --package audesys-hal-core

# Debug build
cargo build

# Run tests
cargo test --package audesys-hal-core

# Check formatting
cargo fmt --check

# Run clippy
cargo clippy -- -D warnings

# Full QA gate
./scripts/qa/qa-fast.sh
```

### Rust Implementation Reminders

- Follow Rust conventions with ownership, borrowing, and traits
- Use `Cargo.toml [dependencies]` for crate dependency declarations
- Add HAL trait implementations for Signal/StreamChannel (D10) conformance
- Use `HAL Config Barrier (D17)` for configuration changes at RT cycle boundaries
- Thread safety: use `tokio::spawn` for async tasks, `tokio::task::spawn_blocking` for CPU-bound work
- Multi-language interop via FlatBuffers (D19) for non-RT paths

---

## Guardrails

- **One task at a time**. Never batch-implement multiple unchecked tasks.
- **Stop on failure**. A failing gate blocks progress. Do not continue to next task.
- **Follow the spec**. The spec is the contract. Deviate only with an explicit note.
- **Test-first when specified**. If the task says TDD, write the failing test before implementation.
- **No guessing**. If a task is ambiguous, ask the user before implementing.
- **Minimal diffs**. One task = the smallest change that satisfies it. No speculative refactors.
- **Keep tasks.md updated**. Mark `[x]` immediately after verification passes.
- Keep code changes minimal and scoped to each task
- Pause on errors, blockers, or unclear requirements — don't guess
- After each task, verify with lsp_diagnostics + build
- Do NOT modify `version.txt` — versioning is user-managed
- Do NOT modify external dependencies — use their separate repos
- **Workspace awareness**. `cargo` commands run from workspace root (where `Cargo.toml` is).
