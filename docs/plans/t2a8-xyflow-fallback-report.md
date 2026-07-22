# T2a.8 @xyflow/react Fallback — Feasibility Spike Report

**Date:** 2026-07-21
**Context:** D71 Phase 2a GLSP risk mitigation. Task T2a.8 from Phase2a-Wave1 team.
**Finding:** @xyflow/react is NOT used in AUDESYS. Both editors are self-contained React components.

---

## 1. Critical Correction: No @xyflow/react in AUDESYS

The task description assumes `@xyflow/react` is used for the LD editor. **It is not.** 

A full audit of `apps/studio/src/` reveals:
- **Zero** `@xyflow/react` imports or references in any `.ts`, `.tsx`, or `.json` file
- **Zero** `xyflow` entries in `package.json` dependencies
- **No** graph/flow/canvas library used anywhere in the Studio frontend

The LD and FBD editors are **custom-built React components**:

| Editor | File | Lines | Implementation |
|--------|------|------:|----------------|
| LD | `LdEditor.tsx` | 291 | Pure CSS flexbox grid, click-to-place contacts/coils |
| LD | `LdEditor.css` | 340 | Industrial-themed styling, green power rails |
| LD | `LdCompilerTool.tsx` | 31 | Tool wrapper with event bus |
| FBD | `FbdEditor.tsx` | 809 | Manual drag-and-drop canvas + SVG wire overlay |
| FBD | `FbdEditor.css` | 269 | Category-colored blocks, pin styling |
| FBD | `FbdCompilerTool.tsx` | 32 | Tool wrapper with event bus |

The migration design doc (D71 §10.1) references `@xyflow/react` in a comparison table and as a potential ReactWidget fallback name, but it is **not** the actual technology used.

---

## 2. Feasibility: Can the Existing Editors Run Inside a Theia ReactWidget?

### 2.1 LD Editor (LdEditor.tsx — 291 lines)

**Architecture:** Pure React function component. Renders CSS grid rungs with clickable slots. Uses:
- `usePlatform().invoke("compile_ld", {source})` — single platform call
- `useState` — rung state
- `useCallback` — event handlers
- `useEffect` — sync LD text to parent via `onCompile` prop

**ReactWidget compatibility: ✅ TRIVIAL.**

Reasons:
1. **No canvas/coordinate system conflicts.** The LD editor is a DOM-based CSS flexbox grid. Unlike `react-rnd` (used by HMI Designer with absolute `position: absolute; left: N; top: N`), the LD editor uses standard flexbox layout that behaves identically in any DOM container.
2. **Single platform dependency.** Only one `invoke("compile_ld")` call needs to be adapted. This call passes through `PlatformAdapter` → `IPlatformAdapter.invoke()`. In a Theia context, this would route through a Theia Backend Service → napi-rs bridge. The LD editor component itself does NOT import from `@tauri-apps/*` — it uses the abstracted `usePlatform()` hook.
3. **No DOM assumptions beyond CSS classes.** All styling is scoped to `.ld-editor*` classes. No fixed viewport assumptions.
4. **Self-contained.** Takes an `onCompile` prop, emits compiled text. No upward dependencies on Shell, Mode, or other global state.

### 2.2 FBD Editor (FbdEditor.tsx — 809 lines)

**Architecture:** Manual canvas with SVG overlay. Uses:
- `useState` — blocks, connections, wiring state, drag state
- `useCallback` — mouse event handlers
- `useRef` — canvas DOM reference for coordinate calculations
- `onFbdChange(text)` — callback to parent (no platform-specific calls at all)

**ReactWidget compatibility: ✅ TRIVIAL (simpler than LD).**

Reasons:
1. **No platform calls at all.** The FBD editor doesn't call `invoke()` or any Tauri/PlatformAdapter function. It only emits `onFbdChange(text)` — pure React prop callback.
2. **Canvas coordinates are relative.** `canvasRef.current.getBoundingClientRect()` gets the canvas position, and all coordinates are relative to that. This pattern works identically inside Theia, Tauri, or a plain browser.
3. **SVG overlay uses absolute positioning within the canvas div.** The `<svg>` element is a child of the canvas div with explicit `width`/`height`. No Theia conflict.
4. **No drag-and-drop library.** Block placement uses native HTML5 Drag and Drop API (`onDragStart`, `onDrop`, `dataTransfer`). This is a browser-standard API supported everywhere.
5. **Zero external dependencies.** No `@xyflow/react`, no `react-dnd`, no `react-rnd`. Pure React + SVG.

### 2.3 Verdict

**Both editors can be wrapped in Theia ReactWidget with ZERO component code changes.** The only adaptation needed is in the tool wrapper layer:

- **LD:** Replace `PlatformAdapter.invoke("compile_ld")` → `AudesysBackendService.compileLd()`
- **FBD:** Already platform-agnostic — just wrap and register

---

## 3. Required Changes

### 3.1 Code Changes (What Needs to Be Written)

| Layer | Files to Create | Lines | Description |
|-------|-----------------|------:|-------------|
| **ReactWidget wrapper** | `ld-editor-widget.tsx` | ~60 | `ReactWidget` subclass wrapping `<LdEditor>` |
| | `fbd-editor-widget.tsx` | ~60 | `ReactWidget` subclass wrapping `<FbdEditor>` |
| **Theia registration** | `audesys-editors-contribution.ts` | ~120 | `OpenHandler` + `CommandContribution` for both editors |
| **Container module** | `audesys-editors-frontend-module.ts` | ~40 | DI bindings for widgets and contributions |
| **LD backend adapter** | `ld-compile-service.ts` (in backend module) | ~50 | Route `compile_ld` call through napi-rs bridge |
| **CSS migration** | (copy) | 0 | `LdEditor.css` + `FbdEditor.css` copied as-is |
| **Component migration** | (copy) | 0 | `LdEditor.tsx` + `FbdEditor.tsx` copied as-is |
| **Test migration** | (copy) | 0 | Existing vitest tests reused (renders in jsdom) |
| **Total new code** | | **~330** | |

### 3.2 Code to Adapt (Existing Files Modified)

| File | Lines Affected | Change |
|------|---------------:|--------|
| `LdCompilerTool.tsx` (32 lines) | ~10 | Replace `usePlatform()` → use Theia backend service |
| `FbdCompilerTool.tsx` (32 lines) | ~5 | Replace tool wrapper shell (eventBus → Theia callback) |
| `theia-extensions/audesys-core/package.json` | +5 | Add `react`, `react-dom` dependencies |
| **Total adapted** | **~20** | |

### 3.3 What Does NOT Change (Zero Modification)

- `LdEditor.tsx` (291 lines) — component preserved verbatim
- `FbdEditor.tsx` (809 lines) — component preserved verbatim
- `LdEditor.css` (340 lines) — copied as-is
- `FbdEditor.css` (269 lines) — copied as-is
- All 4 existing test files — preserved verbatim

### 3.4 PlatformAdapter Elimination

The LD editor currently uses `usePlatform().invoke("compile_ld", {source})`. In the Theia migration, this call chain changes:

```
BEFORE (Tauri):
  LdEditor → usePlatform().invoke("compile_ld") 
           → PcAdapter → window.__TAURI_INTERNALS__.invoke()
           → Tauri Rust backend → LD compiler crate

AFTER (Theia):
  LdEditor → ldCompileService.compile(source)
           → Theia Backend Service → AudesysBackendService
           → napi-rs bridge → LD compiler crate
```

The `usePlatform()` abstraction (D59) was designed exactly for this — the component doesn't know or care where `invoke` goes. In Theia, we simply don't use `PlatformAdapter` at all — we create a Theia-specific service that replaces it.

---

## 4. Integration Points

### 4.1 Theia Extension Points Required

| Extension Point | Theia API | Purpose |
|-----------------|-----------|---------|
| **OpenHandler** | `OpenHandler` interface | Open `.ld` and `.fbd` files from File Explorer |
| **Command** | `CommandContribution` | Register `LD: Open Editor` and `FBD: Open Editor` commands |
| **Menu** | `MenuContribution` | Add to File > Open With menu |
| **Editor Preview** | `NavigatorTreeModel` contribution | Preview icon for `.ld`/`.fbd` files |
| **Toolbar** | `ToolbarContribution` | Compile button in editor toolbar |
| **Keybinding** | `KeybindingContribution` | `Ctrl+Shift+L` → LD, `Ctrl+Shift+B` → FBD |

### 4.2 DI Registrations

```typescript
// audesys-editors-frontend-module.ts
export default new ContainerModule((bind) => {
    // Widget factory
    bind(LdEditorWidgetFactory).toFactory<LdEditorWidget>(...);
    bind(FbdEditorWidgetFactory).toFactory<FbdEditorWidget>(...);
    
    // Open handler
    bind(OpenHandler).to(AudesysEditorOpenHandler).inSingletonScope();
    
    // Contributions
    bind(CommandContribution).to(AudesysEditorContribution);
    bind(MenuContribution).to(AudesysEditorContribution);
});
```

### 4.3 File Type Registration

```typescript
// Associate .ld files with the LD editor widget
const ldFileType: FileType = {
    extension: '.ld',
    icon: 'audesys-ld-icon',
    editor: 'audesys-ld-editor'
};
```

---

## 5. Comparison: ReactWidget Fallback vs GLSP

### 5.1 Feature Matrix

| Dimension | Current LD (CSS Grid) | Current FBD (Canvas+SVG) | GLSP (Target) |
|-----------|:---:|:---:|:---:|
| **Node placement** | Click-to-place | Drag-and-drop from palette | ✅ Drag-and-drop + tool palette |
| **Connection drawing** | N/A (linear grid) | Click pin-to-pin (SVG wires) | ✅ Drag wire between ports |
| **Undo/Redo** | ❌ | ❌ | ✅ Built-in `OperationHistory` |
| **Copy/Paste** | ❌ | ❌ | ✅ Built-in |
| **Auto-layout** | ❌ (fixed grid) | ❌ (manual positioning) | ✅ ELK integration |
| **Zoom/Pan** | ❌ | ❌ (fixed canvas) | ✅ Built-in viewport |
| **Minimap** | ❌ | ❌ | ✅ Optional |
| **Validation markers** | ❌ (text output only) | ❌ (text output only) | ✅ `SetMarkersAction` on diagram |
| **Property inspector** | ❌ | ❌ | ✅ GModel properties → inspector |
| **Grid snapping** | N/A (grid-based) | ❌ | ✅ Configurable |
| **Export (SVG/PNG)** | ❌ | ❌ | ✅ |
| **Semantic model sync** | ✅ (rungToLdText) | ✅ (generateFbdText) | 🔶 Complex bidir sync needed |
| **Compilation** | ✅ via invoke() | ✅ via callback | ✅ via GModel → AST → compiler |
| **Custom node types** | N/A | 16 block types | ✅ Fully extensible |
| **Rung branching (OR)** | ❌ (linear only) | N/A | ✅ (GLSP supports) |
| **Block resizing** | N/A | Fixed size | ✅ |
| **Multi-select** | ❌ | ❌ (single block only) | ✅ |

### 5.2 Effort Comparison

| Metric | ReactWidget Fallback | GLSP |
|--------|:---:|:---:|
| **Initial implementation** | 3-5 days (LD+FBD together) | 10-16 weeks (LD 6-10 + FBD 4-6) |
| **New code (total)** | ~330 lines | 5,000-9,000 lines/editor |
| **Component reuse** | 100% (existing components) | 0% (complete rewrite) |
| **Undo/redo** | Must implement (~200 lines) | Built-in |
| **Learning curve** | ReactWidget ~1 day | GLSP ~2-3 weeks |
| **Maintenance burden** | Low (simple) | High (GLSP protocol, GModel sync) |
| **Extensibility** | Manual additions to component | GLSP framework handles |
| **Production quality** | Prototype (internal use) | Production-grade (Neuron validated) |

### 5.3 When to Use Each

**Use ReactWidget fallback if:**
- GLSP implementation exceeds 12 weeks (the stated rollback trigger in D71 §12.2)
- Primary need is "have an LD/FBD editor that works" (not "have a world-class LD/FBD editor")
- Team is productively busy on other Phase 2 deliverables
- The editors are used for internal testing/validation, not for production customer use

**Use GLSP if:**
- LD/FBD editing is a core product differentiator
- Customers expect undo/redo, zoom, validation on diagram
- Long-term maintenance of IEC 61131-3 editors is a priority
- Team has GLSP expertise (or can invest 2-3 weeks in learning)

---

## 6. Activation Timeline

### 6.1 If GLSP Is Abandoned at Week 6

**Timeline: 3-5 days to working LD+FBD editors in Theia.**

| Day | Task |
|-----|------|
| 1 | Set up React + ReactDOM in Theia extension. Create `ReactWidget` subclasses for both editors. |
| 2 | Register `OpenHandler` + `CommandContribution`. Wire up LD backend service for `compile_ld`. |
| 3 | Copy LdEditor.tsx + FbdEditor.tsx + CSS files. Verify rendering in Theia editor area. |
| 4 | Adapt tool wrappers. Handle edge cases (window resize, theme inheritance, focus management). |
| 5 | Test: open `.ld`/`.fbd` files, place elements, compile, verify output. |

**Total: 5 working days (1 week) for a functional fallback.**

### 6.2 If GLSP Is Abandoned at Week 12

**Same timeline: 3-5 days.** The editors are fully built and tested. The wrapping work doesn't change.

**Risk:** At week 12, the team may have already invested 6 weeks into GLSP LD (partial implementation). Abandoning partial GLSP work for the ReactWidget fallback would mean discarding that investment. But the fallback itself still takes only 3-5 days.

### 6.3 Recommendation: Dual-Track

The migration design doc (§10.1) suggests GLSP LD could take 6-10 weeks. A low-cost risk mitigation:

1. **Week 1-2 of Phase 2a:** Implement the ReactWidget fallback FIRST (~1 week). This gives an editor that works.
2. **Week 3-10:** Pursue GLSP LD in parallel. The ReactWidget editor serves as a working reference implementation.
3. **Decision gate at Week 10:** If GLSP LD is on track, promote it. If not, the ReactWidget editor is already deployed.

This costs 1 extra week but eliminates the "no LD editor" risk entirely.

---

## 7. Dependency Footprint

### 7.1 Current Studio Dependencies (apps/studio/package.json)

The LD and FBD editors have minimal dependency needs:

```
Direct deps of LdEditor:
  react (useState, useCallback, useRef, useEffect)
  usePlatform (internal hook → PlatformAdapter)

Direct deps of FbdEditor:
  react (useState, useCallback, useRef)
  (no other imports — zero external deps)
```

### 7.2 Theia Dependencies Needed

To add React support to the Theia extension:

```json
{
  "dependencies": {
    "@theia/core": "1.73.0",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

### 7.3 Build Configuration

The Theia extension uses CommonJS (`module: "commonjs"`). React components use ESM (`import`/`export`). The build must handle JSX:

```json
// tsconfig.json additions
{
  "compilerOptions": {
    "jsx": "react-jsx",  // React 19 automatic JSX transform
    "moduleResolution": "node",
    "esModuleInterop": true  // already set
  }
}
```

---

## 8. Risks and Mitigations

| Risk | Probability | Severity | Mitigation |
|------|:---:|:---:|------|
| **CSS conflicts with Theia theme** | Medium | Low | `.ld-editor` and `.fbd-editor` classes are already scoped. Theia's CSS variables use `--theia-*` prefix; AUDESYS uses `--color-*`. No conflict. |
| **React version mismatch** | Low | Medium | Theia 1.73 bundles its own React. Install matching version. |
| **Font loading** | Low | Low | LD/FBD use `var(--font-mono)` and `var(--font-body)`. Need to ensure these CSS variables are defined in Theia. |
| **FBD SVG coordinate drift** | Low | Medium | The FBD editor uses `getBoundingClientRect()` which depends on the canvas DOM position. If Theia modifies the DOM layout (extra wrapper divs), coordinates may shift. Test: render a block, verify pin positions match SVG wire endpoints. |
| **LD `invoke()` replacement** | Low | Medium | The compile function needs a napi-rs bridge working. If the bridge isn't ready, the LD editor can still render — just can't compile. Degrade gracefully. |
| **JSX transformation in CommonJS** | Low | Low | Theia uses CommonJS modules. React 19 JSX transform (`react-jsx`) works with CommonJS. Verified in workshop playground. |

---

## 9. Conclusion

### Bottom Line

**The @xyflow/react fallback is a misnomer — the editors don't use @xyflow/react.** But the underlying question ("can the existing editors be wrapped as a GLSP fallback?") has a clear answer: **Yes, trivially.** Both editors are pure React components with minimal platform coupling. Wrapping them in Theia ReactWidget takes ~330 lines of new code and 3-5 days.

### Recommendation

Implement the ReactWidget fallback in **Week 1 of Phase 2a** as a risk mitigation. It costs 1 week but guarantees an LD/FBD editor regardless of GLSP timeline. If GLSP delivers on schedule, the ReactWidget editors can serve as comparison/test harnesses. If GLSP is delayed, the ReactWidget editors are production-ready for internal use.

### What Was Skipped

- No undo/redo implementation (add ~200 lines when needed)
- No copy/paste (add ~150 lines when needed)
- No zoom/pan for FBD (add ~100 lines when needed)
- No validation markers on diagram (compile errors already surface in text output)
- LD editor has no branch/OR support (current editor never had this)

Add these features when customer demand requires them — the ReactWidget pattern doesn't prevent incremental enhancement.
