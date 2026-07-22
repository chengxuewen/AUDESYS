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
exports.default = ButtonWidget;
const react_1 = __importStar(require("react"));
const useStudioHmiSignal_1 = require("../hooks/useStudioHmiSignal");
const WidgetErrorOverlay_1 = __importDefault(require("./WidgetErrorOverlay"));
function ButtonWidget({ label, signal, config, width, height, isSelected, isPreview }) {
    const { value: rawValue, error, clearError } = (0, useStudioHmiSignal_1.useStudioHmiSignal)(isPreview ? signal : undefined);
    const isOn = rawValue !== null && rawValue !== "0" && rawValue !== "false";
    const [pressed, setPressed] = (0, react_1.useState)(false);
    const onColor = config.onColor ?? "#00D26A";
    const offColor = config.offColor ?? "#2a2a30";
    const bgColor = (isPreview ? isOn : pressed) ? onColor : offColor;
    const r = Math.min(width, height) * 0.15;
    return (react_1.default.createElement("div", { style: { width: "100%", height: "100%", position: "relative" } },
        react_1.default.createElement("svg", { width: "100%", height: "100%", viewBox: `0 0 ${width} ${height}` },
            react_1.default.createElement("rect", { x: 2, y: 2, width: width - 4, height: height - 4, rx: r, ry: r, fill: bgColor, stroke: isSelected ? "#FFB800" : "#2a2a30", strokeWidth: 1, style: { cursor: isPreview ? "pointer" : "default", transition: "fill 150ms ease-out" }, onMouseDown: isPreview ? () => setPressed(true) : undefined, onMouseUp: isPreview ? () => setPressed(false) : undefined, onMouseLeave: isPreview ? () => setPressed(false) : undefined }),
            react_1.default.createElement("text", { x: width / 2, y: height / 2 + 5, textAnchor: "middle", dominantBaseline: "middle", fontFamily: "Geist Sans, sans-serif", fontSize: Math.min(height * 0.35, 16), fill: "#e8e8ed", style: { pointerEvents: "none", userSelect: "none" } }, label)),
        isPreview && error && (react_1.default.createElement(WidgetErrorOverlay_1.default, { message: error, onDismiss: clearError }))));
}
//# sourceMappingURL=ButtonWidget.js.map