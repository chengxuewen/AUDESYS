"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TankWidget;
const react_1 = __importDefault(require("react"));
const useStudioHmiSignal_1 = require("../hooks/useStudioHmiSignal");
const WidgetErrorOverlay_1 = __importDefault(require("./WidgetErrorOverlay"));
function TankWidget({ signal, config, width, height, isPreview }) {
    const { value: rawValue, error, clearError } = (0, useStudioHmiSignal_1.useStudioHmiSignal)(isPreview ? signal : undefined);
    const value = rawValue ? parseFloat(rawValue) : 0;
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const unit = config.unit ?? "%";
    const range = max - min;
    const ratio = Math.max(0, Math.min(1, (value - min) / range));
    const margin = 4;
    const tankW = width * 0.5;
    const tankH = height - margin * 2;
    const tankX = (width - tankW) / 2;
    const fillH = tankH * ratio;
    const fillY = margin + tankH - fillH;
    return (react_1.default.createElement("div", { style: { width: "100%", height: "100%", position: "relative" } },
        react_1.default.createElement("svg", { width: "100%", height: "100%", viewBox: `0 0 ${width} ${height}` },
            react_1.default.createElement("rect", { x: tankX, y: margin, width: tankW, height: tankH, fill: "#0a0a0b", stroke: "#2a2a30", strokeWidth: 1.5, rx: 4 }),
            react_1.default.createElement("rect", { x: tankX + 1.5, y: fillY, width: tankW - 3, height: fillH, fill: "#0099FF", rx: 3, style: { transition: "height 500ms ease-out" } }),
            react_1.default.createElement("text", { x: width / 2, y: margin + tankH - 8, textAnchor: "middle", fontFamily: "JetBrains Mono, monospace", fontSize: Math.min(tankW * 0.3, 16), fill: "#e8e8ed" },
                value.toFixed(1),
                unit),
            react_1.default.createElement("text", { x: width / 2, y: height - 2, textAnchor: "middle", fontFamily: "Geist Sans, sans-serif", fontSize: 11, fill: "#a0a0b0" }, config.label ?? "")),
        isPreview && error && (react_1.default.createElement(WidgetErrorOverlay_1.default, { message: error, onDismiss: clearError }))));
}
//# sourceMappingURL=TankWidget.js.map