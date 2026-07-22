/**
 * HmiCanvasWidget — Lumino Widget wrapping the react-rnd HMI canvas.
 *
 * Implements C1-C8 conflict resolutions per the Lumino conflict spec:
 *   C1: position:relative inner div as stable coordinate origin
 *   C2: native mousedown capture-phase interception
 *   C3: CSS contain:layout+style + z-index override
 *   C4: overscroll-behavior:contain + wheel block in edit mode
 *   C7: debounced resize via requestAnimationFrame
 *
 * Reference: docs/plans/t3p5-lumino-conflict-resolution.md §2.2
 */
import { Widget } from "@lumino/widgets";
import { Message } from "@lumino/messaging";
import { createRoot, Root } from "react-dom/client";
import * as React from "react";

import type { HmiWidgetState, HmiWidgetType } from "../types/hmi";
import HmiCanvas from "./components/HmiCanvas";

// CSS class prefixes to isolate from Theia/Lumino globals
const CANVAS_CLASS = "hmiapp-canvas";

export interface HmiCanvasWidgetProps {
  widgets: HmiWidgetState[];
  selectedWidgetId: string | null;
  editMode: boolean;
  onSelectWidget: (id: string | null) => void;
  onUpdateWidget: (id: string, patch: Partial<HmiWidgetState>) => void;
  onRemoveWidget: (id: string) => void;
  onAddWidget: (type: HmiWidgetType, label: string) => void;
  onCanvasResize?: (size: { width: number; height: number }) => void;
}

export class HmiCanvasWidget extends Widget {
  private canvasDiv: HTMLDivElement;
  private reactRoot: Root | null = null;
  private props: HmiCanvasWidgetProps;
  private nativeMouseDownBound: (e: MouseEvent) => void;
  private wheelBound: (e: WheelEvent) => void;

  private _resizeRafId: number | undefined;
  private _lastWidth = 0;
  private _lastHeight = 0;

  constructor(props: HmiCanvasWidgetProps) {
    super();
    this.props = props;
    this.id = "hmi-canvas-widget";
    this.title.label = "HMI Designer";
    this.title.closable = true;
    this.addClass("hmiapp-widget");

    // C1: Stable coordinate origin — position:relative inner div
    this.canvasDiv = document.createElement("div");
    this.canvasDiv.className = CANVAS_CLASS;
    this.canvasDiv.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      contain: layout style;
      overscroll-behavior: contain;
      background-color: #0a0a0b;
    `;
    this.canvasDiv.setAttribute("data-hmi-canvas", "true");

    this.node.appendChild(this.canvasDiv);

    // C2: Drag event capture — intercept before Lumino
    this.nativeMouseDownBound = this.handleNativeMouseDown.bind(this);
    this.wheelBound = this.handleWheel.bind(this);
  }

  // --- Lifecycle ---

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);

    // Mount React component tree into canvasDiv
    this.reactRoot = createRoot(this.canvasDiv);
    this.reactRoot.render(React.createElement(HmiCanvas, this.props));

    // C2: native event listener at capture phase
    this.canvasDiv.addEventListener(
      "mousedown",
      this.nativeMouseDownBound,
      { capture: true },
    );

    // C4: block scroll propagation in Edit mode
    this.canvasDiv.addEventListener("wheel", this.wheelBound, {
      passive: false,
    });

    // C5: focus management
    this.canvasDiv.tabIndex = 0;
    this.canvasDiv.focus();
  }

  protected onBeforeDetach(msg: Message): void {
    this.canvasDiv.removeEventListener(
      "mousedown",
      this.nativeMouseDownBound,
      { capture: true },
    );
    this.canvasDiv.removeEventListener("wheel", this.wheelBound);
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
      const rect = this.canvasDiv.getBoundingClientRect();
      // ponytail: 1px threshold avoids floating-point oscillation
      if (
        Math.abs(rect.width - this._lastWidth) > 1 ||
        Math.abs(rect.height - this._lastHeight) > 1
      ) {
        this._lastWidth = rect.width;
        this._lastHeight = rect.height;
        this.props.onCanvasResize?.({ width: rect.width, height: rect.height });
      }
    });
  }

  // --- Event Handlers ---

  /**
   * C2: Intercept mousedown before Lumino's tab drag handler.
   * If target is an Rnd child, stop propagation so Lumino never sees it.
   */
  private handleNativeMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const isRndChild =
      target.closest("[data-rnd-handle]") !== null ||
      target.closest(".react-draggable") !== null ||
      target.closest(".react-resizable-handle") !== null;

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

  // --- Public API ---

  updateProps(patch: Partial<HmiCanvasWidgetProps>): void {
    Object.assign(this.props, patch);
    if (this.reactRoot) {
      this.reactRoot.render(React.createElement(HmiCanvas, this.props));
    }
  }

  /** Get the canvas div for coordinate calculations. */
  getCanvasDiv(): HTMLDivElement {
    return this.canvasDiv;
  }
}
