---
name: skill-creator
description: >-
  Generate AUDESYS project skills from HAL Rust traits (crates/audesys-hal-core/src/),
  SDD specs (openspec/specs/*.md), FlatBuffers schemas (*.fbs), or Cargo crate names.
  Use when the user wants to create a new AI-assisted workflow skill for testing,
  spec execution, schema verification, or build validation.
license: MIT
metadata:
  author: AUDESYS
  version: "1.0"
  project: AUDESYS
---

Create AUDESYS project-specific AI skills from project artifacts.

**Input**: One of four input sources:
- `crates/audesys-hal-core/src/**/*.rs` (Rust trait definition) → trait testing skill
- `openspec/specs/<module>.md` (SDD spec with spec IDs) → spec execution skill
- `*.fbs` (FlatBuffers schema file) → schema verification skill
- Cargo crate name matching `audesys-*` / `amw_*` / `hal-*` → build test skill

Also accepts a natural-language description: "generate a trait testing skill for HalTransport."

**Steps**

1. **Identify input type**

   Determine the input source:
   - `*.rs` file containing `pub trait` → **HAL trait mode**
   - `openspec/specs/*.md` file with `S-TYPE-*` / `S-QOS-*` / `S-CB-*` / `S-PROTO-*` IDs → **SDD spec mode**
   - `*.fbs` file with `table` / `union` / `struct` → **FlatBuffers schema mode**
   - Cargo crate name matching `audesys-*` / `amw_*` / `hal-*` → **Cargo crate mode**
   - Natural-language phrase → ask user which mode, default to **HAL trait mode** if ambiguous

   If no input provided: "What should the skill be based on? (HAL trait / SDD spec / FlatBuffers schema / Cargo crate)"

2. **Read the source**

   - **HAL trait mode**: Read the `.rs` file. Extract all `pub trait` definitions, method signatures, doc comments with `来源:` references, and existing `#[cfg(test)]` modules.
   - **SDD spec mode**: Read the spec `.md`. Parse all spec IDs (S-TYPE-*, S-QOS-*, S-CB-*, S-PROTO-*), their 前置条件/操作/期望结果/边界条件/测试映射 fields.
   - **FlatBuffers schema mode**: Inspect the `.fbs` file. Extract `table`, `union`, `struct`, `enum` definitions. Verify flatc compatibility.
   - **Cargo crate mode**: Read the crate's `Cargo.toml` and `src/`. List `[dependencies]`, feature gates, existing test targets.

3. **Derive skill name and purpose**

   - HAL trait → name: `<trait-name>-trait-test` (e.g., `haltransport-trait-test`), purpose: "Generate #[test] stubs with mockall for <trait>"
   - SDD spec → name: `<spec-tag>-exec` (e.g., `hal-type-system-exec` from `hal-type-system-spec.md`), purpose: "Implement and verify tests for <spec summary>"
   - FlatBuffers schema → name: `<schema>-fbs-verify` (e.g., `hal-value-fbs-verify`), purpose: "Verify FlatBuffers schema <file> with round-trip tests"
   - Cargo crate → name: `<crate>-build-test` (e.g., `audesys-hal-core-build-test`), purpose: "Verify cargo build and cargo test for <crate>"

4. **Generate skill content**

   Follow this structure (matching openspec-apply/SKILL.md template):

   ```yaml
   ---
   name: <derived-name>
   description: <one-line purpose>
   license: MIT
   metadata:
     author: AUDESYS
     version: "1.0"
     generatedFrom: <source file path>
     category: <workflow | testing | verification>
   ---
   ```

   Body sections:
   - One-line invocation description
   - `**Input**`: what this skill expects
   - `**Steps**`: numbered step-by-step instructions
   - `**Output**`: expected output format
   - `**Guardrails**`: constraints the AI must follow

   **Mode-specific content**:

   **HAL trait mode**:
   - Steps: (1) read the trait `.rs` file and its design doc (check `来源:` comments), (2) parse each trait method signature, (3) generate `#[test]` stubs per method: success path + error path + boundary, (4) generate mockall `mock!` block for the trait, (5) add test file to `crates/<crate>/tests/` or inline `#[cfg(test)]`, (6) run `cargo test -p <crate> -- <test_pattern>`
   - Guardrails: every `pub trait` method ≥1 test, AAA pattern mandatory, mockall `#[automock]` for non-RT traits, `来源:` doc references preserved in test comments, `#[cfg(test)]` only

   **SDD spec mode**:
   - Steps: (1) parse all spec IDs and their test mappings, (2) for each spec ID, generate one `#[test]` function: Arrange (per 前置条件) → Act (per 操作) → Assert (per 期望结果), (3) add boundary conditions as additional assertions or separate test cases, (4) write test file to `crates/<crate>/tests/<spec_name>_spec_tests.rs`, (5) add `// 来源: openspec/specs/<file>.md <spec-ID>` comment, (6) run `cargo test -p <crate>`
   - Guardrails: one `#[test]` per spec ID (linear mapping), AAA pattern enforced, boundary conditions tested separately from success path, test function name must match spec's 测试映射 field

   **FlatBuffers schema mode**:
   - Steps: (1) verify `.fbs` syntax with `flatc --cpp` (parse-only), (2) extract all tables/unions/structs, (3) generate round-trip test: serialize minimal instance → deserialize → assert equality, (4) generate boundary tests: min/max values for each scalar field, (5) write test to `crates/<crate>/tests/<schema>_fbs_tests.rs`, (6) run `cargo test -p <crate> -- <schema>_fbs`
   - Guardrails: flatc must be verifiable (report if not installed), every table has round-trip test, enums tested for out-of-range values, LE encoding per D12

   **Cargo crate mode**:
   - Steps: (1) read `Cargo.toml` for crate metadata + deps, (2) run `cargo check -p <crate>` to verify compilation, (3) run `cargo test -p <crate>` to verify all tests, (4) run `cargo clippy -p <crate> -- -D warnings` for lint gate, (5) run `cargo fmt --check -p <crate>` for style gate, (6) report pass/fail per gate
   - Guardrails: never modify Cargo.toml unless requested, run all four gates (check + test + clippy + fmt), report failures with exact error lines, respect qa-fast per D30

5. **Write the SKILL.md file**

   Write to `.agents/skills/<derived-name>/SKILL.md`. Directory name must match `name` field.
   If skill already exists, ask: overwrite or create variant.

**Output**

After generating:
- Skill name and path
- Source used (file + type)
- Count of traits / specs / tables / crates covered
- "Skill ready. Invoke with `skill(name=\"<derived-name>\")` or ask me to use it."

**Examples**

### Example 1: HAL trait → testing skill

```
User: "Create a trait testing skill from crates/audesys-hal-core/src/mock_transport.rs"
→ Reads mock_transport.rs, finds MockHalTransport struct + methods: write_signal, read_signal, signal_count
→ Extracts `来源:` references to hal-protocol-design.md Signal §
→ Creates .agents/skills/mockhaltransport-trait-test/SKILL.md
→ Skill generates #[test] stubs with AAA pattern for each method + mockall mock! block
```

### Example 2: SDD spec → execution skill

```
User: "Generate a skill to implement hal-type-system spec tests"
→ Reads openspec/specs/hal-type-system-spec.md
→ Extracts: 30 spec IDs (S-TYPE-001 through S-TYPE-030), each with 前置条件/操作/期望结果/测试映射
→ Creates .agents/skills/hal-type-system-exec/SKILL.md
→ Skill guides: generate 30 #[test] functions → run cargo test → verify all pass
```

### Example 3: FlatBuffers schema → verification skill

```
User: "Create a verification skill for hal_value.fbs"
→ Reads crates/hal-flatbuffers/schema/hal_value.fbs
→ Extracts: HALValue union, scalar tables, FlatBuffers layout
→ Creates .agents/skills/hal-value-fbs-verify/SKILL.md
→ Skill guides: verify flatc → generate round-trip tests per table → boundary checks
```

### Example 4: Cargo crate → build test skill

```
User: "Generate a build-test skill for audesys-hal-core"
→ Reads crates/audesys-hal-core/Cargo.toml + src/
→ Extracts: crate name, deps, test targets, feature gates
→ Creates .agents/skills/audesys-hal-core-build-test/SKILL.md
→ Skill runs: cargo check → cargo test → cargo clippy → cargo fmt (qa-fast 4 gates)
```

**Guardrails**
- NEVER generate a skill without first reading the source file
- NEVER contradict existing specs in openspec/specs/
- YAML frontmatter must include: `name`, `description`, `metadata.author`, `metadata.version`
- Skill directory name must match `name` field exactly
- If skill with same name exists, ask before overwriting
- Use AUDESYS conventions only: `audesys::` / `amw::` namespaces, AAA test pattern, mockall for traits
- Keep skills under 200 lines — short skills are easier to maintain
- No external CLI dependencies beyond what's in Cargo.toml — flatc is optional, cargo is required
- Respect Phase awareness: Phase 0 = trait stubs only, Phase 1 = concrete types + amw_inproc

// ponytail: manual module detection via file reads — no glob walker needed
