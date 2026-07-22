"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DisplayWidget;
const react_1 = __importDefault(require("react"));
const useStudioHmiSignal_1 = require("../hooks/useStudioHmiSignal");
const WidgetErrorOverlay_1 = __importDefault(require("./WidgetErrorOverlay"));
function DisplayWidget({ signal, config, width, height, isPreview }) {
    const { value, error, clearError } = (0, useStudioHmiSignal_1.useStudioHmiSignal)(isPreview ? signal : undefined);
    const unit = config.unit ?? "";
    const displayValue = isPreview && value !== null ? `${value}${unit}` : "---";
    return (react_1.default.createElement("div", { style: { width: "100%", height: "100%", position: "relative" } },
        react_1.default.createElement("svg", { width: "100%", height: "100%", viewBox: `0 0 ${width} ${height}` },
            react_1.default.createElement("rect", { x: 1, y: 1, width: width - 2, height: height - 2, rx: 4, fill: "#0a0a0b", stroke: "#2a2a30", strokeWidth: 1 }),
            react_1.default.createElement("text", { x: width - 8, y: height / 2 + 5, textAnchor: "end", dominantBaseline: "middle", fontFamily: "JetBrains Mono, monospace", fontSize: Math.min(height * 0.45, 24), fill: "#00D26A" }, displayValue),
            react_1.default.createElement("text", { x: 8, y: height / 2 + 5, textAnchor: "start", dominantBaseline: "middle", fontFamily: "Geist Sans, sans-serif", fontSize: 12, fill: "#a0a0b0" }, config.label ?? "")),
        isPreview && error && (react_1.default.createElement(WidgetErrorOverlay_1.default, { message: error, onDismiss: clearError }))));
}
//# sourceMappingURL=DisplayWidget.js.map