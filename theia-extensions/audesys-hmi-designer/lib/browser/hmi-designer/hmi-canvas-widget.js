"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HmiCanvasWidget = void 0;
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
const widgets_1 = require("@lumino/widgets");
const client_1 = require("react-dom/client");
const React = __importStar(require("react"));
const HmiCanvas_1 = __importDefault(require("./components/HmiCanvas"));
// CSS class prefixes to isolate from Theia/Lumino globals
const CANVAS_CLASS = "hmiapp-canvas";
class HmiCanvasWidget extends widgets_1.Widget {
    constructor(props) {
        super();
        this.reactRoot = null;
        this._lastWidth = 0;
        this._lastHeight = 0;
        /**
         * C4: Block wheel scroll in Edit mode, allow in Preview.
         */
        this.handleWheel = (e) => {
            if (this.props.editMode) {
                e.preventDefault();
            }
            // Preview mode: let event pass through (trend widget pan/zoom)
        };
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
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        // Mount React component tree into canvasDiv
        this.reactRoot = (0, client_1.createRoot)(this.canvasDiv);
        this.reactRoot.render(React.createElement(HmiCanvas_1.default, this.props));
        // C2: native event listener at capture phase
        this.canvasDiv.addEventListener("mousedown", this.nativeMouseDownBound, { capture: true });
        // C4: block scroll propagation in Edit mode
        this.canvasDiv.addEventListener("wheel", this.wheelBound, {
            passive: false,
        });
        // C5: focus management
        this.canvasDiv.tabIndex = 0;
        this.canvasDiv.focus();
    }
    onBeforeDetach(msg) {
        this.canvasDiv.removeEventListener("mousedown", this.nativeMouseDownBound, { capture: true });
        this.canvasDiv.removeEventListener("wheel", this.wheelBound);
        if (this.reactRoot) {
            this.reactRoot.unmount();
            this.reactRoot = null;
        }
        super.onBeforeDetach(msg);
    }
    // C7: Debounced resize relay
    onResize(msg) {
        super.onResize(msg);
        // ponytail: 16ms debounce via rAF avoids ResizeObserver loops
        if (this._resizeRafId !== undefined) {
            cancelAnimationFrame(this._resizeRafId);
        }
        this._resizeRafId = requestAnimationFrame(() => {
            this._resizeRafId = undefined;
            const rect = this.canvasDiv.getBoundingClientRect();
            // ponytail: 1px threshold avoids floating-point oscillation
            if (Math.abs(rect.width - this._lastWidth) > 1 ||
                Math.abs(rect.height - this._lastHeight) > 1) {
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
    handleNativeMouseDown(e) {
        const target = e.target;
        const isRndChild = target.closest("[data-rnd-handle]") !== null ||
            target.closest(".react-draggable") !== null ||
            target.closest(".react-resizable-handle") !== null;
        if (isRndChild) {
            e.stopPropagation();
            // Do NOT preventDefault — let react-rnd's own handlers process the event
        }
    }
    // --- Public API ---
    updateProps(patch) {
        Object.assign(this.props, patch);
        if (this.reactRoot) {
            this.reactRoot.render(React.createElement(HmiCanvas_1.default, this.props));
        }
    }
    /** Get the canvas div for coordinate calculations. */
    getCanvasDiv() {
        return this.canvasDiv;
    }
}
exports.HmiCanvasWidget = HmiCanvasWidget;
//# sourceMappingURL=hmi-canvas-widget.js.map