---
name: openspec-verify
description: >-
  Verify that an AUDESYS change proposal was implemented correctly. Use after
  implementation tasks are complete to ensure code compiles, tests pass, and
  the change meets design requirements.
license: MIT
compatibility: Designed for Claude Code, GitHub Copilot, and similar agents.
disable-model-invocation: false
metadata:
  author: openspec
  version: "1.0"
  category: workflow
  project: AUDESYS
---

# OpenSpec Verify — AUDESYS

Verify that an AUDESYS change proposal was implemented correctly. This is the quality gate before archiving.

---

**Input**: Optionally specify a change name (kebab-case). If omitted, check if it can be inferred from conversation context.

---

## Steps

### 1. Select and prepare

If a name is provided, use it. Otherwise infer from context or list `.sisyphus/plans/` directories.

Read the proposal artifacts:
- `.sisyphus/plans/<change-name>/proposal.md` — original goals and success criteria
- `.sisyphus/plans/<change-name>/design.md` — design decisions to verify
- `.sisyphus/plans/<change-name>/tasks.md` — task completion status

### 2. Verify task completion

Check the tasks file: all tasks should be marked `[x]` (complete).

If incomplete tasks exist:
- Display warning listing incomplete tasks
- Ask the user if they want to proceed anyway or complete remaining tasks

### 3. LSP diagnostics check

Run LSP diagnostics on all changed files:

```bash
# Check all modified files via git
git diff --name-only HEAD
```

For each modified `.rs`, `.fbs`, `.toml` file, verify LSP diagnostics are clean (no errors, warnings are acceptable per project config).

### 4. Build verification

Build the affected crates:

```bash
cargo build --package <crate-name>
```

The build MUST pass without errors. Document any pre-existing warnings that are not related to the change.

### 5. Design validation

Compare the implementation against `design.md`:

| Criterion | Check |
|-----------|-------|
| Architecture matches design | All new traits/structs/functions exist as specified |
| Interfaces match spec | HAL Signal/StreamChannel (D10) match expected pin names |
| amw wiring correct | Transport/discovery traits implemented as designed |
| Build system changes correct | Cargo.toml [dependencies] updated |
| No scope creep | No unrelated modifications |

### 6. Spec consistency check

Verify changed code aligns with openspec/specs/:

**a. Identify affected specs**
For each changed Rust trait method or FlatBuffers schema, grep openspec/specs/*.md for matching spec IDs or type names. If no matching spec exists, flag as missing coverage.

**b. Cross-layer verification**
| Layer | Location | Check |
|-------|----------|-------|
| HAL traits | crates/audesys-hal-core/src/ | grep method name in spec |
| FlatBuffers | crates/hal-flatbuffers/ | schema fields match spec type definitions |
| amw | crates/amw_inproc/ | transport trait impls match spec |

**c. Run spec validation** (best-effort)
If a verify_specs.sh or similar script exists in scripts/, run it. Non-blocking if script absent or fails on missing artifacts — flag as WARN not FAIL.

### 7. Orphan test check

Verify all test files are discoverable:

- **Rust unit tests**: `#[cfg(test)] mod tests` in source files are auto-discovered
- **Rust integration tests**: All `.rs` files in `crates/*/tests/` should be auto-discovered by `cargo test --workspace`
- **FlatBuffers tests**: Any test file checking .fbs round-trip should be referenced in CI scripts

Report any test file that exists on disk but is NOT discoverable by `cargo test --workspace`.

### 8. Regression check

Ensure no existing functionality is broken:

- Check that existing tests still compile (if applicable)
- Verify that removed/modified code has proper migration
- Check for any accidental changes to unrelated files via `git diff`

### 9. Report results

```
## Verification: <change-name>

### Results

- Tasks: N/N complete
- LSP diagnostics: PASS (0 errors)
- Build: PASS (<crate-name>)
- Design match: PASS

### Spec Coverage
- [x] Spec consistency     — M/N APIs verified
- [ ] Missing spec for: <method name>

### Orphan Tests
- [x] No orphan tests found

### Summary

All verification criteria met. Ready for archiving.

OR

Issues found:
1. [Issue description]
2. [Issue description]

Action needed before archive.
```

---

## Additional Checks

### For Rust changes
- `lsp_diagnostics` on all `.rs` files
- Build succeeds with `cargo build`
- No new clippy warnings added (unless matching project baseline)
- Use `#[derive]` macros where applicable, avoid manual boilerplate
- Thread safety: no blocking operations in async context without `tokio::task::spawn_blocking`

### For Cargo changes
- `cargo` workspace conventions followed
- `Cargo.toml [dependencies]` declared
- No duplicate dependency declarations
- Feature flags properly gated

### For FlatBuffers changes (.fbs schemas)
- Schema syntax is valid
- Generated bindings compile for all target languages
- Field IDs are stable (no collisions)
- Version compatibility maintained

### For HAL changes
- HAL Signal/StreamChannel (D10) primitives used correctly
- amw_inproc (D11) trait implementations complete
- HAL Config Barrier (D17) respected for config mutations
- Type system (D12) conformance — IEC 61131-3 mapping correct

---

## Guardrails

- Do NOT skip build verification — build MUST pass
- Check ALL changed files, not just the ones you remember editing
- If a pre-existing issue is blocking verification, document it separately
- Do NOT force-pass if build fails — fix the issue or revert
- LSP diagnostics takes priority over subjective code review
- If tests exist, run them: `cargo test --package <crate-name>`
- Report clearly what passed and what failed