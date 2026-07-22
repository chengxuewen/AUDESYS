# T3.5 Lumino Conflict Resolution — HMI Designer ReactWidget Migration

**Status:** Design Spec  
**Date:** 2026-07-21  
**Scope:** T3.5 HMI Designer (Week 1 of 2-4 weeks)  
**References:**
- `docs/plans/p1-execution-refinement.md` §T3.5
- `docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md` §4.3, §10.4
- `apps/studio/src/components/HmiBuilder/HmiCanvas.tsx` (current react-rnd implementation)
- `apps/studio/src/tools/HmiDesignerTool.tsx` (current tool wrapper)
- `apps/studio/src/types/hmi.ts` (HmiWidgetState, HmiLayout types)

---

## 1. Conflict Catalog

The root cause of all eight conflicts is the architectural mismatch between **react-rnd** (React component tree with `position: relative` canvas + `position: absolute` Rnd children, using HTML5 drag events) and **Lumino** (CSS-based widget toolkit with managed box model, `position: absolute` panels, DOM event interception, and Z-index stacking context ownership).

| # | Conflict Type | Root Cause | Lumino Behavior | react-rnd Expectation | Resolution Strategy | Validation Test |
|---|---------------|------------|-----------------|----------------------|---------------------|-----------------|
| **C1: Coordinate Origin** | Lumino's `Widget.node` is a `position: absolute` div inside `.lm-Widget`. Children's `(0,0)` is relative to the panel boundary, not the canvas origin. | Lumino panels use `top/left` for positioning within the dock area. The ReactWidget's content div inherits this offset. | `bounds="parent"` resolves coordinates relative to the nearest `position: relative` ancestor. If the canvas div is a child of a Lumino node with `position: absolute`, the origin is the Lumino node's offset, not the visual canvas origin. | **Custom HmiCanvasWidget**: Override `onAfterAttach()` to insert a `position: relative` canvas div as the sole child of the Lumino Widget node. The Lumino node gets `position: absolute; top:0; left:0; right:0; bottom:0` via CSS. The inner canvas div becomes the stable coordinate origin. All react-rnd children use `bounds="parent"` relative to this inner div. | **T3.5t-C1**: Add widget at (100,100). Measure `getBoundingClientRect()` of the widget vs. the canvas div. Assert `|widgetRect.left - canvasRect.left| - 100| < 2px`. |
| **C2: Drag Event Interception** | Lumino's document-level `mousedown` handler (for tab dragging, splitter resize, panel reorder) fires before react-rnd's `onMouseDown`. | Lumino calls `event.preventDefault()` and `event.stopImmediatePropagation()` on `mousedown` for its own drag operations. | react-rnd attaches `mousedown` via React's synthetic event system on the Rnd wrapper div. The event may never reach it if Lumino intercepts first. | **Event delegation bypass**: In `HmiCanvasWidget.onAfterAttach()`, attach a native `mousedown` listener on the canvas div with `{capture: true}`. Check if the target is an Rnd child (by CSS class or data attribute). If so, call `event.stopPropagation()` before Lumino sees it. Release on `onBeforeDetach()`. | **T3.5t-C2**: In Edit mode, drag widget from (100,100) to (300,200). Assert: (a) widget moved, (b) dock panel did NOT tear off, (c) no Lumino tab drag indicator appeared. |
| **C3: Resize Handle Z-order** | Lumino's `.lm-Widget` stacking context isolates the ReactWidget's Z-index. Rnd resize handles with `z-index: 9999` may render under sibling Lumino panels. | Lumino uses `z-index` on `.lm-DockPanel`, `.lm-TabBar`, `.lm-SplitPanel` in the range 1-10. All `.lm-Widget` content inherits this stacking context. | react-rnd's resize handles use inline `z-index: 10` (Rnd default) or custom CSS. If a widget is near a panel boundary, resize handles may be clipped by the Lumino panel's overflow or hidden under an adjacent panel. | **CSS isolation layer**: Add `contain: layout style` on the canvas container div. Override Rnd resize handle z-index to `2147483647` (max safe 32-bit) via `:global(.react-rnd .react-draggable-handle) { z-index: 2147483647 !important; }` in a Theia CSS module. This escapes the Lumino stacking context by hitting the render-layer boundary. | **T3.5t-C3**: Add widget at position (0,0), resize to canvas right edge at x=1150. Assert resize handle is visible (not clipped by right panel boundary). Use Playwright `isVisible()` on the SE resize handle. |
| **C4: Scroll/Wheel Event Conflict** | Lumino panels with `overflow: auto` (e.g., Signal Browser below HMI panel) consume wheel events for scrolling. If the HMI canvas is inside such a panel, mousewheel scrolls the panel, not the canvas. | Lumino sets `overflow` on `.lm-Widget` content areas. If a panel contains the HMI canvas, scroll events bubble up to the panel. | HMI canvas uses `overflow: hidden` and does not scroll by wheel. However, if the canvas is inside a scrollable Theia editor area, wheel events scroll the editor instead of being swallowed. | **CSS `overscroll-behavior: contain`** on the canvas div to prevent scroll chaining. Additionally, in Edit mode, attach a `wheel` event listener with `{passive: false}` and `preventDefault()` to block scroll propagation. In Preview mode, allow scroll events to pass through (for trend widget pan/zoom). | **T3.5t-C4**: With HMI Designer open above Signal Browser: (a) Edit mode: scroll wheel over canvas → canvas does not scroll, Signal Browser does not scroll. (b) Preview mode: scroll wheel over trend widget → widget pans time window. |
| **C5: Focus/Tab Order** | Lumino manages focus via its `FocusTracker`. The HMI canvas (with `tabIndex={0}` for keyboard Delete) may conflict with Theia's keyboard shortcut system. | Theia's `KeybindingRegistry` listens for global keyboard events. Lumino's FocusTracker switches focus between dock widgets. | HmiCanvas uses `onKeyDown` handler for Delete/Backspace to remove selected widget. This competes with Theia's Delete keybinding (delete file in Explorer). | **Scoped keybinding**: Register a Theia `Keybinding` with `when: 'focusedWidget == hmi-canvas'` context. When the canvas div has focus (`tabIndex={0}` + `:focus`), Delete/Backspace are handled by the HMI keybinding. When focus leaves the canvas, Theia default Delete behavior resumes. Use Lumino's `FocusTracker` to manage this context. | **T3.5t-C5**: (a) Focus canvas, select widget, press Delete → widget removed, no file deleted. (b) Focus Explorer tree, press Delete → Theia 'delete file' dialog appears. |
| **C6: CSS Class Collision** | Theia's CSS reset/theme (`.theia-*` classes) and Lumino's structural classes (`.lm-*`) apply global styles that may override react-rnd's inline styles or widget component styling. | Theia applies a CSS reset (`box-sizing: border-box`, `margin: 0`, etc.) globally. Lumino classes like `.lm-Widget`, `.lm-DockPanel` set `position`, `overflow`, `display`. | react-rnd uses inline styles for position and size, which have higher specificity than `.lm-*` classes. But widget children (SVG, Canvas) use CSS classes that may be overridden by Theia resets. | **CSS containment + scoped prefix**: Wrap all HMI widget CSS in `.hmiapp-` prefixed selectors. Apply `all: initial` on the canvas container's `:host`-like boundary, then re-establish only needed properties. Use a Theia `WebpackCssContribution` with `excludedPaths` for Theia's global reset. | **T3.5t-C6**: Render all 7 widget types in Edit mode. Screenshot-diff each widget against the Tauri Studio reference. Assert pixel match > 99% for SVG/canvas content. |
| **C7: Resize Observer Loop** | Both Lumino (for panel resize → child relayout) and react-rnd (for widget bounds recalculation on parent resize) use `ResizeObserver`. Mutual resize callbacks may cause an infinite loop (`ResizeObserver loop limit exceeded`). | Lumino attaches `ResizeObserver` on `.lm-Widget` to call `onResize(msg)` on size changes. Each call may trigger child widget re-layout, which may resize back. | react-rnd uses `ResizeObserver` internally (via `re-resizable`) to recalculate bounds when the parent container resizes. If the widget's resize triggers a canvas resize → Lumino resize → back to widget, the loop fires. | **Debounced resize relay**: The `HmiCanvasWidget.onResize()` handler uses `requestAnimationFrame` + 16ms debounce before updating react-rnd bounds. Store the last-known canvas size and skip re-render if `|newSize - lastSize| < 1px`. This is a ponytail: the `1px` threshold avoids floating-point oscillation. | **T3.5t-C7**: Open HMI Designer in a split panel. Drag the splitter rapidly to resize the canvas 20 times in 3 seconds. Assert no console warning about `ResizeObserver loop limit exceeded`. |
| **C8: Portal/Overlay Rendering** | Widget selection border (2px #FFB800) and drag preview (react-rnd's ghost) render as DOM children of the canvas div. Lumino's `overflow: hidden` on panels may clip them at panel boundaries. | Lumino sets `overflow: hidden` on dock panel content areas to prevent content bleed. This clips any child that extends beyond the panel's bounding box. | react-rnd's drag ghost is an absolutely-positioned clone of the Rnd element. If the widget is at the canvas edge and dragged outward, the ghost extends beyond the canvas boundary and gets clipped by Lumino's overflow. | **Drag ghost portal**: In `onDragStart`, clone the widget's DOM node and append it to `document.body` (not the canvas) with `position: fixed`. Track `mousemove` on `document` in capture phase to position the clone. On `onDragStop`, remove the clone and fire the position update. Selection border stays inside canvas (acceptable minor clip). | **T3.5t-C8**: Drag a widget from position (10,10) leftward beyond the canvas edge by 100px. Assert: (a) drag ghost remains fully visible (no clip), (b) final widget position is clamped to canvas bounds (x ≥ 0). |

---

## 2. HmiCanvasWidget Design

### 2.1 Class Hierarchy

```
Lumino Widget
  └── HmiCanvasWidget extends Widget
        ├── node: HTMLDivElement          // Lumino-managed: position:absolute, fill parent
        │     └── canvasDiv: HTMLDivElement  // Our managed: position:relative, coordinate origin
        │           ├── [Rnd wrapper]       // react-rnd per-widget Rnd components
        │           │     └── <WidgetComponent />
        │           ├── [Rnd wrapper]
        │           └── ...
        └── ReactWidget (inner, attached via ReactDOM.createRoot)
```

### 2.2 Pseudo-code

```typescript
// apps/studio-theia/src/browser/hmi-designer/HmiCanvasWidget.ts

import { Widget } from '@luplex/core';
import { Message } from '@luplex/core';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HmiCanvas, HmiCanvasProps } from './components/HmiCanvas';

// CSS class prefixes to isolate from Theia/Lumino globals
const CANVAS_CLASS = 'hmiapp-canvas';
const CANVAS_CONTAINER_CLASS = 'hmiapp-canvas-container';

export class HmiCanvasWidget extends Widget {
  private canvasDiv: HTMLDivElement;
  private reactRoot: Root | null = null;
  private props: HmiCanvasProps;
  private nativeMouseDownBound: (e: MouseEvent) => void;

  constructor(props: HmiCanvasProps) {
    super();
    this.props = props;
    this.id = 'hmi-canvas-widget';
    this.title.label = 'HMI Designer';
    this.title.closable = true;
    this.addClass('hmiapp-widget');

    // C1: Stable coordinate origin — position:relative inner div
    this.canvasDiv = document.createElement('div');
    this.canvasDiv.className = CANVAS_CLASS;
    this.canvasDiv.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      contain: layout style;          /* C3: CSS isolation */
      overscroll-behavior: contain;   /* C4: prevent scroll chaining */
      background-color: #0a0a0b;
    `;
    this.canvasDiv.setAttribute('data-hmi-canvas', 'true');

    this.node.appendChild(this.canvasDiv);

    // C2: Drag event capture — intercept before Lumino
    this.nativeMouseDownBound = this.handleNativeMouseDown.bind(this);
  }

  // --- Lifecycle ---

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);

    // Mount React component tree into canvasDiv
    this.reactRoot = createRoot(this.canvasDiv);
    this.reactRoot.render(React.createElement(HmiCanvas, this.props));

    // C2: native event listener at capture phase
    this.canvasDiv.addEventListener('mousedown', this.nativeMouseDownBound, { capture: true });

    // C4: block scroll propagation in Edit mode
    this.canvasDiv.addEventListener('wheel', this.handleWheel, { passive: false });

    // C5: focus management via Lumino FocusTracker
    this.canvasDiv.tabIndex = 0;
    this.canvasDiv.focus(); // initial focus for hotkeys
  }

  protected onBeforeDetach(msg: Message): void {
    this.canvasDiv.removeEventListener('mousedown', this.nativeMouseDownBound, { capture: true });
    this.canvasDiv.removeEventListener('wheel', this.handleWheel);
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
    super.onBeforeDetach(msg);
  }

  // C7: Debounced resize relay
  protected onResize(msg: Widget.ResizeMessage): void {
    super.onResize(msg);

    // ponytail: 16ms debounce via rAF avoids ResizeObserver loops
    if (this._resizeRafId !== undefined) {
      cancelAnimationFrame(this._resizeRafId);
    }
    this._resizeRafId = requestAnimationFrame(() => {
      this._resizeRafId = undefined;
      const { width, height } = this.canvasDiv.getBoundingClientRect();
      // ponytail: 1px threshold avoids floating-point oscillation
      if (
        Math.abs(width - this._lastWidth) > 1 ||
        Math.abs(height - this._lastHeight) > 1
      ) {
        this._lastWidth = width;
        this._lastHeight = height;
        this.props.onCanvasResize?.({ width, height });
      }
    });
  }

  private _resizeRafId: number | undefined;
  private _lastWidth = 0;
  private _lastHeight = 0;

  // --- Event Handlers ---

  /**
   * C2: Intercept mousedown before Lumino's tab drag handler.
   * If target is an Rnd child, stop propagation so Lumino never sees it.
   */
  private handleNativeMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    // Check if click originated within an Rnd widget (react-rnd adds .react-draggable to the handle)
    const isRndChild = target.closest('[data-rnd-handle]') !== null
                    || target.closest('.react-draggable') !== null
                    || target.closest('.react-resizable-handle') !== null;

    if (isRndChild) {
      e.stopPropagation();
      // Do NOT preventDefault — let react-rnd's own handlers process the event
    }
  }

  /**
   * C4: Block wheel scroll in Edit mode, allow in Preview.
   */
  private handleWheel = (e: WheelEvent): void => {
    if (this.props.editMode) {
      e.preventDefault();
    }
    // Preview mode: let event pass through (trend widget pan/zoom)
  };

  // --- Public API for prop updates (avoid full React re-render) ---

  updateProps(patch: Partial<HmiCanvasProps>): void {
    Object.assign(this.props, patch);
    if (this.reactRoot) {
      this.reactRoot.render(React.createElement(HmiCanvas, this.props));
    }
  }
}
```

### 2.3 Coordinate System Diagram

```
┌─────────────────────────────────────────────────────┐
│  Lumino DockPanel (.lm-DockPanel)                   │
│  z-index: 1                                         │
│  ┌───────────────────────────────────────────────┐  │
│  │  Lumino TabBar (.lm-TabBar)                   │  │
│  │  z-index: 2                                   │  │
│  ├───────────────────────────────────────────────┤  │
│  │  HmiCanvasWidget.node (.lm-Widget)            │  │
│  │  position: absolute; top:0; left:0;           │  │
│  │  right:0; bottom:0;                           │  │
│  │  z-index: auto (inherits)                     │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  canvasDiv (.hmiapp-canvas)              │  │  │
│  │  │  position: relative;  ← COORD ORIGIN    │  │  │
│  │  │  contain: layout style;                 │  │  │
│  │  │  ┌──────────────────┐                   │  │  │
│  │  │  │ Rnd (widget 1)   │ position:absolute │  │  │
│  │  │  │ top:100, left:100│ ← relative to     │  │  │
│  │  │  │                  │    canvasDiv       │  │  │
│  │  │  └──────────────────┘                   │  │  │
│  │  │  ┌──────────────────┐                   │  │  │
│  │  │  │ Rnd (widget 2)   │ position:absolute │  │  │
│  │  │  │ top:300, left:50 │                   │  │  │
│  │  │  └──────────────────┘                   │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

All react-rnd position coordinates are relative to `canvasDiv`'s top-left corner (the `position: relative` origin). The Lumino node above it is transparent to coordinate calculations because `position: absolute; top:0; left:0` means its own origin aligns with the dock panel's content area origin.

---

## 3. Drag Adapter: Lumino Drag → onDragStop Translation

### 3.1 Problem

react-rnd's internal drag mechanism uses:
1. `mousedown` on the handle → records `startX, startY` (client coordinates)
2. `mousemove` on `document` → computes `deltaX = clientX - startX`, `deltaY = clientY - startY`
3. Updates the Rnd element's `style.left` and `style.top` in CSS pixels
4. `mouseup` → fires `onDragStop(e, {x, y})` with the final `left, top` values

The key invariant is that `deltaX/deltaY` in **CSS pixels** maps directly to the `position: relative` parent's coordinate space — which holds as long as the canvas does not have a CSS transform or zoom applied.

### 3.2 Coordinate Offset Recalculation

When the canvas is inside a Lumino panel with potential offsets (tab bar height, splitter width, Theia toolbar), the `getBoundingClientRect()` of the canvas div provides the true origin:

```typescript
/**
 * Converts a mouse clientX/clientY to canvas-local coordinates.
 * Called by the drag ghost positioning logic (C8).
 */
function clientToCanvas(clientX: number, clientY: number, canvasDiv: HTMLElement): { x: number; y: number } {
  const rect = canvasDiv.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

/**
 * Inverse: converts canvas-local coordinates to client for ghost positioning.
 */
function canvasToClient(canvasX: number, canvasY: number, canvasDiv: HTMLElement): { x: number; y: number } {
  const rect = canvasDiv.getBoundingClientRect();
  return {
    x: canvasX + rect.left,
    y: canvasY + rect.top,
  };
}
```

### 3.3 Drag Ghost Portal (C8 Implementation)

```typescript
// Inside HmiCanvasWidget or a useDragGhost hook

interface DragGhostState {
  ghostEl: HTMLElement | null;
  startPos: { x: number; y: number } | null;
  widgetId: string | null;
}

function createDragGhost(widgetEl: HTMLElement, canvasDiv: HTMLElement): HTMLElement {
  const clone = widgetEl.cloneNode(true) as HTMLElement;
  const rect = widgetEl.getBoundingClientRect();
  clone.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    z-index: 2147483647;
    opacity: 0.7;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  clone.setAttribute('data-drag-ghost', 'true');
  document.body.appendChild(clone);
  return clone;
}

// Usage in react-rnd onDragStart callback:
// onDragStart={(_e, data) => {
//   const ghost = createDragGhost(data.node, canvasDiv);
//   setDragGhost({ ghostEl: ghost, startPos: data, widgetId: widget.id });
// }}

// During drag, onDrag:
// onDrag={(_e, data) => {
//   if (ghost.ghostEl) {
//     ghost.ghostEl.style.left = `${data.x + canvasRect.left}px`;
//     ghost.ghostEl.style.top = `${data.y + canvasRect.top}px`;
//   }
// }}

// onDragStop cleanup:
// onDragStop={(_e, data) => {
//   if (ghost.ghostEl) {
//     ghost.ghostEl.remove();
//   }
//   onUpdateWidget(widget.id, { position: { x: data.x, y: data.y } });
// }}
```

### 3.4 Drag Event Translation Summary

```
Lumino layer     │  React layer
─────────────────┼──────────────────
mousedown (capture)  →  check target: Rnd child?
  ├─ YES → stopPropagation  →  react-rnd handles drag
  └─ NO  → let Lumino handle (tab drag, panel resize, etc.)

mousemove (document)  →  react-rnd computes delta from mousedown origin
                         →  if ghost active: update ghost position (document.body coords)
                         →  update Rnd style.left/top (canvas-relative coords)

mouseup (document)    →  react-rnd fires onDragStop({x, y})
                         →  Position {x, y} is relative to canvasDiv origin (C1)
                         →  Client saves to HmiWidgetState.position
```

---

## 4. CSS Isolation Strategy

### 4.1 Layer Model

```
Layer 0: Theia global reset (box-sizing, margin, font-family)
Layer 1: Lumino structural (.lm-Widget, .lm-DockPanel, .lm-TabBar)
Layer 2: HMI canvas boundary (contain: layout style + all: initial reset)
Layer 3: HMI widget namespace (.hmiapp-* prefixed classes)
```

### 4.2 Canvas Boundary (Layer 2)

```css
/* apps/studio-theia/src/browser/hmi-designer/hmi-canvas.css */

.hmiapp-canvas {
  /* Reset Theia/Lumino inherited styles at the boundary */
  all: initial;

  /* Re-establish only needed properties */
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0a0a0b;

  /* CSS containment — prevents style leakage both ways */
  contain: layout style;

  /* Scroll isolation */
  overscroll-behavior: contain;

  /* Typography reset for widget text */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #e0e0e0;

  /* Inherit for children */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}
```

### 4.3 Widget Namespace (Layer 3)

```css
/* apps/studio-theia/src/browser/hmi-designer/hmi-widgets.css */

/* All widget CSS scoped under .hmiapp-canvas to avoid collision with .theia-* */

.hmiapp-canvas .hmiapp-widget-gauge { /* SVG arc styles */ }
.hmiapp-canvas .hmiapp-widget-trend { /* Canvas chart styles */ }
.hmiapp-canvas .hmiapp-widget-tank { /* SVG rect fill styles */ }
.hmiapp-canvas .hmiapp-widget-indicator { /* SVG circle styles */ }
.hmiapp-canvas .hmiapp-widget-button { /* SVG rect + text styles */ }
.hmiapp-canvas .hmiapp-widget-display { /* SVG text styles */ }
.hmiapp-canvas .hmiapp-widget-text { /* SVG text label styles */ }

/* Override react-rnd inline z-index for resize handles */
.hmiapp-canvas .react-resizable-handle {
  z-index: 2147483647 !important;
}

/* Selection highlight — stays inside canvas boundary (C8 acceptable clip) */
.hmiapp-canvas .hmiapp-widget-selected {
  outline: 2px solid #FFB800;
  outline-offset: 0;
  /* ponytail: outline over border to avoid layout shift */
}

/* Widget hover state in Edit mode */
.hmiapp-canvas .hmiapp-widget-hover:not(.hmiapp-widget-selected) {
  outline: 1px dashed rgba(255, 184, 0, 0.5);
}
```

### 4.4 Theia CSS Module Integration

```typescript
// In Theia FrontendModule:
import '../../src/browser/hmi-designer/hmi-canvas.css';
import '../../src/browser/hmi-designer/hmi-widgets.css';

// These are loaded AFTER Theia's global CSS, ensuring our specificity wins
// within the .hmiapp-canvas scope.
```

### 4.5 Z-index Hierarchy

```
z-index: auto                       → Theia shell containers
z-index: 1                          → Lumino .lm-DockPanel
z-index: 2                          → Lumino .lm-TabBar
z-index: 3                          → Lumino .lm-SplitPanel (splitter handles)
z-index: 4-10                       → Lumino floating widgets, menus
z-index: auto (inside .hmiapp-canvas) → React widgets (default stacking)
z-index: 2147483647 (!important)    → Rnd resize handles (C3 fix)
z-index: 2147483647                 → Drag ghost on document.body (C8 fix)
```

---

## 5. POC Validation Plan (1-Day Spike)

### Goal
Prove that the eight conflicts have working resolution strategies before committing to the full Week 1-4 implementation.

### Setup (Morning, 2h)

1. **Create Theia extension skeleton**: `theia-extensions/audesys-hmi-designer/` with minimal `package.json`, `tsconfig.json`, `src/browser/hmi-designer-frontend-module.ts`
2. **Install deps**: `@luplex/core`, `react`, `react-dom`, `react-rnd` (existing versions)
3. **Copy 1 widget**: Copy `GaugeWidget.tsx` to the Theia extension, rename CSS classes to `.hmiapp-*` prefix
4. **Stub HmiCanvasWidget**: Implement the class from §2.2, but with only GaugeWidget rendering
5. **Wire FrontendModule**: Register `HmiCanvasWidget` as a Theia `WidgetFactory` + bind to `OPEN_HMI_DESIGNER` command

### Spike Tests (Afternoon, 4h)

| Test | Conflict | Method | Pass Criteria |
|------|----------|--------|---------------|
| S1 | C1 Coordinate Origin | Open HMI Designer. Add gauge at (100,100). Use DevTools `document.querySelector('.hmiapp-canvas').getBoundingClientRect()` and compare with gauge element rect. | `|gaugeRect.left - canvasRect.left - 100| < 2` |
| S2 | C2 Drag Interception | In Edit mode, drag gauge from (100,100) to (300,200). | Gauge position updates. No tab tear-off. No Lumino drag indicator. |
| S3 | C3 Resize Z-order | Add gauge at (0,0). Resize handle to right edge. | Resize handle fully visible (not clipped by adjacent panel). |
| S4 | C4 Scroll Event | With Signal Browser below HMI panel, scroll wheel over canvas in Edit mode. | Canvas does not scroll. Signal Browser does not scroll. |
| S5 | C5 Focus/Delete | Focus canvas, select widget, press Delete. Then focus File Explorer, press Delete. | Widget removed in case 1. Theia delete dialog in case 2. |
| S6 | C6 CSS Isolation | Screenshot gauge widget. Compare pixel-by-pixel with Tauri Studio rendering. | Pixel match > 99% (SVG paths identical). |
| S7 | C7 Resize Loop | Rapidly resize Theia window 20 times (drag corner). Check console. | No `ResizeObserver loop limit exceeded` warning. |
| S8 | C8 Drag Ghost | Drag gauge from (10,10) leftward by 150px (off-canvas). | Ghost fully visible. Final position clamped to x=0. |

### Go/No-Go Decision

- **Go**: 8/8 spike tests pass OR 7/8 pass with the 8th having a clear 1-day fix path.
- **No-Go**: 3+ tests fail with unknown root causes → reassess ReactWidget approach. Fallback: embed HMI Designer as a standalone iframe with `postMessage` bridge (1-week alternative).

---

## 6. Week 1 Exit Criteria (Measurable Pass/Fail)

| # | Criterion | Measurement | Pass Threshold | Fail Consequence |
|---|-----------|-------------|----------------|------------------|
| **W1.1** | All 8 conflicts resolved | Run spike tests S1-S8 in CI (playwright) | 8/8 pass | Block Week 2 start. Escalate to fallback iframe approach. |
| **W1.2** | 7 widgets render identically | Screenshot-diff each widget (Gauge, Button, Text, Indicator, Trend, Tank, Display) in Edit mode vs. Tauri reference | SSIM > 0.99 for all 7 | Widget with < 0.99 must be fixed before Week 2. |
| **W1.3** | Drag coordinate accuracy | Add 10 widgets at random positions. Drag each to known target (50,50). Read `HmiWidgetState.position` after drag. | All 10 positions within ±1px of (50,50) | Revisit coordinate offset calculation (C1). |
| **W1.4** | WidgetPalette renders in Theia | Palette shows 7 widget types as draggable items. Drag-to-add onto canvas works. | All 7 types addable. Widget appears at drop position not (0,0). | Fallback to "click to add" mode. |
| **W1.5** | Edit/Preview mode toggle | Click toolbar toggle. Edit: Rnd handles visible, draggable. Preview: handles hidden, not draggable, signal injector active. | Mode switch < 100ms. No React re-mount (preserves DOM). | Block Week 2 HMI integration. |
| **W1.6** | YAML round-trip | Add 3 widgets (gauge, button, trend). Export YAML via napi-rs `export_hmi_yaml`. Import YAML. Compare `widgets[].position` before/after. | All positions match exactly (floating-point equality). | Block Week 2 persistence work. |
| **W1.7** | No console errors | Run HMI Designer in Theia Electron dev mode for 5 minutes. Perform 20+ drag/resize/add/delete operations. | 0 errors, 0 warnings (excluding known Theia harmless warnings). | Investigate and fix each error before Week 2. |
| **W1.8** | Memory: no leak on close/reopen | Open HMI Designer, add 50 widgets, close tab, reopen 5x. Monitor heap in Chrome DevTools. | Heap after 5th reopen ≤ 1.1× heap after 1st open. | Add `onBeforeDetach` cleanup for ResizeObserver, event listeners, React root unmount. |

### Exit Decision

- **All 8 criteria pass** → proceed to Week 2 (7 widget migration + PropertyPanel)
- **W1.1-W1.5 pass, W1.6-W1.8 partial** → proceed with caveats (fix W1.6-W1.8 in Week 2 as P0 bugs)
- **W1.1 fails** → fallback to iframe approach (cost: +1 week)

---

## Appendix A: File Manifest

```
apps/studio-theia/
└── src/browser/hmi-designer/
    ├── HmiCanvasWidget.ts           # §2.2 — Lumino Widget class (core)
    ├── HmiCanvasWidget.css          # §4.2 — Canvas boundary CSS
    ├── components/
    │   ├── HmiCanvas.tsx            # Migrated from apps/studio/src (replace Rnd imports)
    │   ├── HmiToolbar.tsx           # Migrated with Theia Toolbar integration
    │   ├── WidgetPalette.tsx        # Migrated with Theia SidebarPanel integration
    │   ├── PropertyPanel.tsx        # Migrated (unchanged logic)
    │   └── SignalInjector.tsx       # Migrated (unchanged logic)
    ├── widgets/
    │   ├── GaugeWidget.tsx          # §4.3 CSS classes renamed to .hmiapp-*
    │   ├── ButtonWidget.tsx
    │   ├── TextWidget.tsx
    │   ├── IndicatorWidget.tsx
    │   ├── TrendWidget.tsx
    │   ├── TankWidget.tsx
    │   └── DisplayWidget.tsx
    ├── hooks/
    │   ├── useHmiLayout.ts          # Migrated (unchanged)
    │   ├── useHmiSignal.ts          # Migrated (replace Tauri invoke → napi-rs bridge)
    │   └── useDragGhost.ts          # §3.3 — new: drag ghost portal hook
    ├── hmi-canvas.css               # §4.2 — Canvas boundary
    ├── hmi-widgets.css              # §4.3 — Widget namespace
    └── hmi-designer-frontend-module.ts  # Theia DI registration
```

## Appendix B: Napi-rs Bridge Functions (HMI-specific)

```rust
// crates/audesys-theia-bridge/src/hmi.rs

#[napi]
pub fn export_hmi_yaml(layout_json: String) -> Result<String> {
    // HmiLayout → YAML serialization (replaces Tauri save_hmi_layout)
}

#[napi]
pub fn import_hmi_yaml(yaml: String) -> Result<String> {
    // YAML → HmiLayout JSON (replaces Tauri load_hmi_layout)
}

#[napi]
pub fn validate_hmi_layout(layout_json: String) -> Result<String> {
    // HmiLayout validation → { errors: string[], warnings: string[] }
}

#[napi]
pub fn read_signal_for_hmi(signal_name: String) -> Result<Option<f64>> {
    // Reuses existing signal_snapshot path for HMI Preview mode
}
```

---

## Appendix C: Fallback — Iframe Approach

If Week 1 spike shows that Lumino conflict resolution is too fragile, the HMI Designer can be embedded as a **cross-origin isolated iframe** with a `postMessage` bridge:

```
Theia Shell
  └── Theia Custom Editor (ReactWidget wrapper)
        └── <iframe src="hmi-designer.html" sandbox="allow-scripts allow-same-origin">
              └── Standalone React app (react-rnd as-is, no Lumino conflicts)

postMessage API:
  Studio → iframe: { type: "layout-load", layout: HmiLayout }
  Studio → iframe: { type: "signal-update", signals: Record<string, number> }
  iframe → Studio: { type: "layout-save", layout: HmiLayout }
  iframe → Studio: { type: "widget-select", widgetId: string }
  iframe → Studio: { type: "deploy", yaml: string }
```

This approach has zero Lumino conflicts but adds ~20ms latency per message due to `postMessage` serialization. Acceptable for HMI editing (non-RT). Estimated effort: 1 week (instead of 2-4 weeks for native ReactWidget). Decision gate: after Week 1 spike results.
