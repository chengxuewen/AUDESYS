"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = IndicatorWidget;
const react_1 = __importDefault(require("react"));
const useStudioHmiSignal_1 = require("../hooks/useStudioHmiSignal");
const WidgetErrorOverlay_1 = __importDefault(require("./WidgetErrorOverlay"));
function IndicatorWidget({ signal, config, width, height, isPreview }) {
    const { value, error, clearError } = (0, useStudioHmiSignal_1.useStudioHmiSignal)(isPreview ? signal : undefined);
    const isOn = value !== null && value !== "0" && value !== "false";
    const onColor = config.onColor ?? "#00D26A";
    const offColor = config.offColor ?? "#FF4444";
    const color = isOn ? onColor : offColor;
    const cx = width / 2;
    const cy = height * 0.4;
    const r = Math.min(width, height) * 0.25;
    return (react_1.default.createElement("div", { style: { width: "100%", height: "100%", position: "relative" } },
        react_1.default.createElement("svg", { width: "100%", height: "100%", viewBox: `0 0 ${width} ${height}` },
            react_1.default.createElement("defs", null,
                react_1.default.createElement("filter", { id: `glow-${signal ?? "ind"}` },
                    react_1.default.createElement("feGaussianBlur", { stdDeviation: isOn ? 4 : 1, result: "blur" }),
                    react_1.default.createElement("feMerge", null,
                        react_1.default.createElement("feMergeNode", { in: "blur" }),
                        react_1.default.createElement("feMergeNode", { in: "SourceGraphic" })))),
            react_1.default.createElement("circle", { cx: cx, cy: cy, r: r, fill: color, filter: `url(#glow-${signal ?? "ind"})`, style: { transition: "fill 150ms ease-out" } }),
            react_1.default.createElement("text", { x: cx, y: cy + r + 16, textAnchor: "middle", fontFamily: "Geist Sans, sans-serif", fontSize: 11, fill: "#a0a0b0" }, config.label ?? "")),
        isPreview && error && (react_1.default.createElement(WidgetErrorOverlay_1.default, { message: error, onDismiss: clearError }))));
}
//# sourceMappingURL=IndicatorWidget.js.map