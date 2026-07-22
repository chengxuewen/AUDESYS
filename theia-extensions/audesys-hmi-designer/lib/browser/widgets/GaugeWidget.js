"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GaugeWidget;
const react_1 = __importDefault(require("react"));
const useStudioHmiSignal_1 = require("../hooks/useStudioHmiSignal");
const WidgetErrorOverlay_1 = __importDefault(require("./WidgetErrorOverlay"));
function GaugeWidget({ signal, config, width, height, isPreview }) {
    const { value: rawValue, error, clearError } = (0, useStudioHmiSignal_1.useStudioHmiSignal)(isPreview ? signal : undefined);
    const value = rawValue ? parseFloat(rawValue) : 0;
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const unit = config.unit ?? "";
    const thresholds = config.thresholds ?? [];
    const range = max - min;
    const ratio = Math.max(0, Math.min(1, (value - min) / range));
    const angle = 135 + ratio * 270; // 135° to 405° (270° sweep)
    const cx = width / 2;
    const cy = height * 0.65;
    const r = Math.min(cx, cy) * 0.75;
    // Arc path
    const startAngle = 135 * (Math.PI / 180);
    const endAngle = 405 * (Math.PI / 180);
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    let arcColor = "#00D26A"; // default operational green
    for (const t of thresholds) {
        if (value >= t.value)
            arcColor = t.color;
    }
    return (react_1.default.createElement("div", { style: { width: "100%", height: "100%", position: "relative" } },
        react_1.default.createElement("svg", { width: "100%", height: "100%", viewBox: `0 0 ${width} ${height}` },
            react_1.default.createElement("path", { d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, fill: "none", stroke: "#2a2a30", strokeWidth: r * 0.2, strokeLinecap: "round" }),
            react_1.default.createElement("path", { d: `M ${x1} ${y1} A ${r} ${r} 0 ${ratio > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(angle * Math.PI / 180)} ${cy + r * Math.sin(angle * Math.PI / 180)}`, fill: "none", stroke: arcColor, strokeWidth: r * 0.2, strokeLinecap: "round" }),
            react_1.default.createElement("line", { x1: cx, y1: cy, x2: cx + r * 0.7 * Math.cos(angle * Math.PI / 180), y2: cy + r * 0.7 * Math.sin(angle * Math.PI / 180), stroke: "#e8e8ed", strokeWidth: 2, strokeLinecap: "round" }),
            react_1.default.createElement("circle", { cx: cx, cy: cy, r: r * 0.08, fill: "#FFB800" }),
            react_1.default.createElement("text", { x: cx, y: cy + r * 0.25, textAnchor: "middle", fontFamily: "JetBrains Mono, monospace", fontSize: r * 0.3, fill: "#e8e8ed" },
                value.toFixed(1),
                unit),
            react_1.default.createElement("text", { x: cx, y: height - 4, textAnchor: "middle", fontFamily: "Geist Sans, sans-serif", fontSize: 12, fill: "#a0a0b0" }, config.label ?? "")),
        isPreview && error && (react_1.default.createElement(WidgetErrorOverlay_1.default, { message: error, onDismiss: clearError }))));
}
//# sourceMappingURL=GaugeWidget.js.map