"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WidgetErrorOverlay;
const react_1 = __importDefault(require("react"));
function WidgetErrorOverlay({ message, onDismiss }) {
    return (react_1.default.createElement("div", { onClick: onDismiss, style: {
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255, 68, 68, 0.15)",
            border: "1px solid #FF4444",
            borderRadius: "4px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            cursor: "pointer",
            zIndex: 10,
        }, title: "Click to dismiss" },
        react_1.default.createElement("span", { style: { fontSize: "16px", lineHeight: 1 } }, "\u26A0"),
        react_1.default.createElement("span", { style: {
                fontSize: "10px",
                fontFamily: "JetBrains Mono, monospace",
                color: "#FF4444",
                maxWidth: "90%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            } }, message)));
}
//# sourceMappingURL=WidgetErrorOverlay.js.map