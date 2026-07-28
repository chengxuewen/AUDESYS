# Edit Safety

> Generated: 2026-07-27 — After 4 consecutive edit→fix→rebuild cycles wasted tokens on JSON brackets, duplicate imports, and variable shadowing.

## Mandatory Checks (before EVERY build attempt)

### 1. JSON edits → verify with JSON.parse
After ANY edit that modifies JSON structure:
```bash
node -e "JSON.parse(require('fs').readFileSync('path/to/file.json','utf8')); console.log('OK')"
```
Block: never run build on invalid JSON.

### 2. Variable rename → grep all references first
Before renaming a variable (including sed), grep the file for ALL occurrences of that token:
```bash
grep -n '\bOLD_NAME\b' file.ts
```
Then verify after rename that 0 references to the old name remain (excluding strings/comments).

### 3. Multi-line edit → verify structural boundaries
When editing code blocks:
- Opening/closing brackets `{}` must be matched pair edits (never replace only the interior)
- If removing a line that starts or ends a block, add the boundary back explicitly
- After edit, check that indentation of adjacent lines is consistent

### 4. Import removal → check all consumers
Before removing or commenting out an import/export:
```bash
grep -r "SymbolName" src/ --include="*.ts" --include="*.tsx"
```
Delete the import only when 0 references remain, or fix all references first.

### 5. File replace → fresh re-read if edit fails
If `edit` returns "hash mismatch", do NOT guess the new hash. Re-read the file first.
Same file → same round of edits MUST use hashes from the latest `read` output.

### 6. Structural edit → brace-count verify
After ANY edit that touches class/function/method boundaries:
```bash
grep -c '{' file.ts && grep -c '}' file.ts  # counts must match
```
If counts differ → the edit broke a boundary. Fix before building.

### 7. NEVER replace across a class/function closing brace
When inserting code before a section header (e.g. `// ==== New Section ====`),
use `append` after the line BEFORE the header, not `replace` that spans the header.
If `replace` is unavoidable, the replacement text MUST include the closing `}`
of the class/function being closed.

### 8. sed on code → verify structural integrity
After `sed` on TypeScript/JavaScript files:
1. `grep -c '{' file && grep -c '}' file` — counts must match
2. `npx tsc -b --noEmit 2>&1 | head -5` — no new errors
sed is for pure-text substitutions only, never for structural changes.

### 9. Complex file → full rewrite, not incremental edit
If a file has been modified by 2+ sources (team members, sed, prior edits)
AND the next change touches class/function boundaries:
→ Use `write` (full file rewrite) instead of `edit`.
→ Read the file first, compose the complete new content, write once.
Incremental `edit` on a drifting file is the #1 cause of structural errors.

## Anti-Patterns That Wasted Tokens Today

| What | Root Cause | Prevention |
|------|-----------|------------|
| Missing `}` in package.json | Replaced deps lines without preserving the `dependencies:` block structure | Rule 3: boundary-aware edits |
| Duplicate imports after dedup | Removed duplicate lines but also removed a needed line that appeared in both | Rule 4: check consumers before removing imports |
| `h` variable shadowing snabbdom `h()` | `sed` rename missed a pattern (`h ` vs `h + `) | Rule 2: grep all references, verify 0 remain |
| Stale hash after team edit | Team member modified file between my `read` and `edit` | Rule 5: re-read on hash mismatch |
| Missing class `}` ×3 in server/index.ts | Incremental `edit` on multi-agent-modified file, each fix introduced new boundary error | **Rule 9: full rewrite for complex files** |

### 10. Patching bundled/minified JS → exact string match only
NEVER use regex to patch bundled JS files (webpack/esbuild output).
Regex like `[^}]*` crosses method boundaries in nested code.
Use Python `str.replace()` with exact multi-line strings copied from the file.
Verify with `node -c file.js` after every patch.

### 11. npm dependency version conflicts → pin + override
When `@injectable decorator multiple times` or similar DI errors occur:
1. `npm ls @theia/core` — check for multiple versions
2. Pin ALL direct `@theia/*` deps to exact version (no `^` or `~`)
3. Add `overrides` for transitive deps only (npm rejects overrides on direct deps)
4. `rm -rf node_modules package-lock.json && npm install`
5. `npm dedupe` if nested copies remain
6. Verify: `find node_modules -name core -path '*/@theia/*' -type d | grep -v '^node_modules/@theia/core$'` → must be empty

### 12. Post-build → E2E smoke test mandatory
After ANY Theia build (`theia build`), ALWAYS run:
```bash
# 1. Apply post-build patches
python3 fix-tokens.py
# 2. Start server
node lib/backend/main.js --port=3100 --no-cluster &
sleep 12
# 3. Verify HTTP 200
curl -s -o /dev/null -w '%{http_code}' http://localhost:3100  # must be 200
# 4. Run E2E smoke test
THEIA_URL=http://127.0.0.1:3100 npx playwright test e2e/smoke/startup-browser.spec.ts
```
Unit tests passing ≠ app works. E2E smoke test is the ONLY proof the app renders.
