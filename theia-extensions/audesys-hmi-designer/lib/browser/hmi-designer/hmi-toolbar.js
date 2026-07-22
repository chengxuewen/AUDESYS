"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = HmiToolbar;
const react_1 = __importDefault(require("react"));
function HmiToolbar({ editMode, onToggleMode, onSave, onLoad, onClear, onDeploy }) {
    return (react_1.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", backgroundColor: "#141416", borderBottom: "1px solid #2a2a30", flexShrink: 0 } },
        react_1.default.createElement("button", { style: { fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#e8e8ed", cursor: "pointer" }, onClick: onSave }, "Save"),
        react_1.default.createElement("button", { style: { fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#e8e8ed", cursor: "pointer" }, onClick: onLoad }, "Load"),
        react_1.default.createElement("div", { style: { width: 1, height: 20, backgroundColor: "#2a2a30" } }),
        react_1.default.createElement("button", { style: { fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#e8e8ed", cursor: "pointer" }, onClick: onToggleMode }, editMode ? "▶ Preview" : "✏ Edit"),
        editMode && (react_1.default.createElement("button", { style: { fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#FF4444", cursor: "pointer" }, onClick: onClear }, "Clear")),
        editMode && onDeploy && (react_1.default.createElement("button", { style: { fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#FFB800", cursor: "pointer" }, onClick: onDeploy }, "\u2B06 Deploy"))));
}
//# sourceMappingURL=hmi-toolbar.js.map