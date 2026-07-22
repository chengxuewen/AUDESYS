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
exports.default = HmiCanvas;
/**
 * HmiCanvas — React component rendered inside the Lumino canvas widget.
 * Renders react-rnd draggable/resizable widgets on a position:relative canvas.
 *
 * ponytail: derived from apps/studio/src/components/HmiBuilder/HmiCanvas.tsx
 * but stripped of outer wrapper — WidgetPalette, toolbar, SignalInjector are
 * handled by HmiDesignerTool.
 */
const react_1 = __importStar(require("react"));
const react_rnd_1 = require("react-rnd");
const GaugeWidget_1 = __importDefault(require("../../widgets/GaugeWidget"));
const ButtonWidget_1 = __importDefault(require("../../widgets/ButtonWidget"));
const TextWidget_1 = __importDefault(require("../../widgets/TextWidget"));
const IndicatorWidget_1 = __importDefault(require("../../widgets/IndicatorWidget"));
const TrendWidget_1 = __importDefault(require("../../widgets/TrendWidget"));
const TankWidget_1 = __importDefault(require("../../widgets/TankWidget"));
const DisplayWidget_1 = __importDefault(require("../../widgets/DisplayWidget"));
const WIDGET_COMPONENTS = {
    gauge: GaugeWidget_1.default,
    button: ButtonWidget_1.default,
    text: TextWidget_1.default,
    indicator: IndicatorWidget_1.default,
    trend: TrendWidget_1.default,
    tank: TankWidget_1.default,
    display: DisplayWidget_1.default,
};
function HmiCanvas({ widgets, selectedWidgetId, editMode, onSelectWidget, onUpdateWidget, onRemoveWidget, }) {
    const isPreview = !editMode;
    const handleCanvasClick = (0, react_1.useCallback)((e) => {
        if (e.target === e.currentTarget) {
            onSelectWidget(null);
        }
    }, [onSelectWidget]);
    const handleKeyDown = (0, react_1.useCallback)((e) => {
        if ((e.key === "Delete" || e.key === "Backspace") && selectedWidgetId) {
            onRemoveWidget(selectedWidgetId);
        }
    }, [selectedWidgetId, onRemoveWidget]);
    return (react_1.default.createElement("div", { onClick: handleCanvasClick, onKeyDown: handleKeyDown, tabIndex: 0, "data-hmi-canvas-inner": "true", style: {
            width: "100%", height: "100%",
            position: "relative",
            overflow: "hidden",
            outline: "none",
        } },
        widgets.map((widget) => {
            const Widget = WIDGET_COMPONENTS[widget.type];
            const isSelected = selectedWidgetId === widget.id;
            return (react_1.default.createElement(react_rnd_1.Rnd, { key: widget.id, position: { x: widget.position.x, y: widget.position.y }, size: { width: widget.size.width, height: widget.size.height }, minWidth: 80, minHeight: 40, bounds: "parent", enableResizing: editMode, disableDragging: !editMode, onDragStop: (_e, d) => onUpdateWidget(widget.id, { position: { x: d.x, y: d.y } }), onResizeStop: (_e, _dir, ref, _delta, pos) => onUpdateWidget(widget.id, {
                    size: { width: Math.round(ref.offsetWidth), height: Math.round(ref.offsetHeight) },
                    position: { x: pos.x, y: pos.y },
                }), onClick: () => onSelectWidget(widget.id), style: {
                    border: isSelected ? "2px solid #FFB800" : "1px solid #2a2a30",
                    borderRadius: "4px",
                    overflow: "hidden",
                    background: "transparent",
                } }, Widget ? (react_1.default.createElement(Widget, { id: widget.id, label: widget.label, signal: widget.signal, config: widget.config, width: widget.size.width, height: widget.size.height, isSelected: isSelected, isPreview: isPreview })) : (react_1.default.createElement("div", { style: { padding: 8, fontSize: 12, color: "#a0a0b0" } },
                "Unknown: ",
                widget.type))));
        }),
        widgets.length === 0 && (react_1.default.createElement("div", { style: {
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "#a0a0b0", fontSize: 14,
            } }, "Add widgets from the palette to start designing your HMI panel."))));
}
//# sourceMappingURL=HmiCanvas.js.map