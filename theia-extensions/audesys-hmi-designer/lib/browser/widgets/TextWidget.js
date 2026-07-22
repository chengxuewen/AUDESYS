"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TextWidget;
const react_1 = __importDefault(require("react"));
const useStudioHmiSignal_1 = require("../hooks/useStudioHmiSignal");
const WidgetErrorOverlay_1 = __importDefault(require("./WidgetErrorOverlay"));
function TextWidget({ label, signal, config, width, height, isPreview }) {
    const { value, error, clearError } = (0, useStudioHmiSignal_1.useStudioHmiSignal)(isPreview ? signal : undefined);
    const fontSize = config.fontSize ?? 14;
    const color = config.color ?? "#e8e8ed";
    const displayText = isPreview && value !== null ? value : label;
    return (react_1.default.createElement("div", { style: { width: "100%", height: "100%", position: "relative" } },
        react_1.default.createElement("svg", { width: "100%", height: "100%", viewBox: `0 0 ${width} ${height}` },
            react_1.default.createElement("text", { x: width / 2, y: height / 2 + 4, textAnchor: "middle", dominantBaseline: "middle", fontFamily: "Geist Sans, -apple-system, system-ui, sans-serif", fontSize: fontSize, fill: color, style: { userSelect: "none" } }, displayText)),
        isPreview && error && (react_1.default.createElement(WidgetErrorOverlay_1.default, { message: error, onDismiss: clearError }))));
}
//# sourceMappingURL=TextWidget.js.map