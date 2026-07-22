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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PropertyPanel;
const react_1 = __importStar(require("react"));
const CONFIG_FIELDS = {
    gauge: [
        { label: "Min", type: "number", key: "min", defaultVal: 0 },
        { label: "Max", type: "number", key: "max", defaultVal: 100 },
        { label: "Unit", type: "text", key: "unit", defaultVal: "" },
    ],
    button: [
        { label: "On Color", type: "color", key: "onColor", defaultVal: "#00D26A" },
        { label: "Off Color", type: "color", key: "offColor", defaultVal: "#2a2a30" },
    ],
    text: [
        { label: "Font Size", type: "number", key: "fontSize", defaultVal: 14 },
        { label: "Color", type: "color", key: "color", defaultVal: "#e8e8ed" },
    ],
    indicator: [
        { label: "On Color", type: "color", key: "onColor", defaultVal: "#00D26A" },
        { label: "Off Color", type: "color", key: "offColor", defaultVal: "#FF4444" },
    ],
    trend: [
        { label: "History", type: "number", key: "history", defaultVal: 60 },
        { label: "Color", type: "color", key: "color", defaultVal: "#FFB800" },
    ],
    tank: [
        { label: "Min", type: "number", key: "min", defaultVal: 0 },
        { label: "Max", type: "number", key: "max", defaultVal: 100 },
        { label: "Unit", type: "text", key: "unit", defaultVal: "%" },
    ],
    display: [
        { label: "Unit", type: "text", key: "unit", defaultVal: "" },
    ],
};
function PropertyPanel({ widget, onUpdateWidget, onRemoveWidget }) {
    const [showSignalDialog, setShowSignalDialog] = (0, react_1.useState)(false);
    const [signalInput, setSignalInput] = (0, react_1.useState)("");
    const handleChange = (0, react_1.useCallback)((field, value) => {
        if (!widget)
            return;
        if (["x", "y"].includes(field)) {
            onUpdateWidget(widget.id, { position: { ...widget.position, [field]: Number(value) } });
        }
        else if (["width", "height"].includes(field)) {
            onUpdateWidget(widget.id, { size: { ...widget.size, [field]: Number(value) } });
        }
        else if (field === "label") {
            onUpdateWidget(widget.id, { label: String(value) });
        }
        else {
            onUpdateWidget(widget.id, { config: { ...widget.config, [field]: value } });
        }
    }, [widget, onUpdateWidget]);
    if (!widget) {
        return (react_1.default.createElement("div", { style: { width: 280, backgroundColor: "#141416", borderLeft: "1px solid #2a2a30", flexShrink: 0 } },
            react_1.default.createElement("div", { style: { padding: "8px 12px", borderBottom: "1px solid #2a2a30", color: "#FFB800", fontSize: 13, fontWeight: 600 } }, "Properties"),
            react_1.default.createElement("div", { style: { padding: 16, color: "#a0a0b0", fontSize: 12 } }, "Select a widget to edit properties")));
    }
    const fields = CONFIG_FIELDS[widget.type] ?? [];
    return (react_1.default.createElement("div", { style: { width: 280, backgroundColor: "#141416", borderLeft: "1px solid #2a2a30", flexShrink: 0, overflowY: "auto" } },
        react_1.default.createElement("div", { style: { padding: "8px 12px", borderBottom: "1px solid #2a2a30", color: "#FFB800", fontSize: 13, fontWeight: 600 } }, "Properties"),
        react_1.default.createElement("div", { style: { padding: "8px 12px" } },
            react_1.default.createElement(SectionHeader, { label: "Position & Size" }),
            react_1.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 } },
                react_1.default.createElement(NumInput, { label: "X", value: widget.position.x, onChange: v => handleChange("x", v) }),
                react_1.default.createElement(NumInput, { label: "Y", value: widget.position.y, onChange: v => handleChange("y", v) }),
                react_1.default.createElement(NumInput, { label: "W", value: widget.size.width, onChange: v => handleChange("width", v) }),
                react_1.default.createElement(NumInput, { label: "H", value: widget.size.height, onChange: v => handleChange("height", v) })),
            react_1.default.createElement(SectionHeader, { label: "Label" }),
            react_1.default.createElement("input", { type: "text", value: widget.label, onChange: e => handleChange("label", e.target.value), style: { width: "100%", padding: "4px 6px", backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontSize: 12 } }),
            react_1.default.createElement(SectionHeader, { label: "Signal" }),
            react_1.default.createElement("div", { style: { display: "flex", gap: 4, alignItems: "center" } },
                react_1.default.createElement("span", { style: { fontSize: 11, color: "#a0a0b0", flex: 1, fontFamily: "JetBrains Mono", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, widget.signal ?? "(none)"),
                showSignalDialog ? (react_1.default.createElement("div", { style: { display: "flex", gap: 4 } },
                    react_1.default.createElement("input", { type: "text", value: signalInput, onChange: e => setSignalInput(e.target.value), placeholder: "axis.0.pos", onKeyDown: e => { if (e.key === "Enter") {
                            onUpdateWidget(widget.id, { signal: signalInput });
                            setShowSignalDialog(false);
                            setSignalInput("");
                        } }, style: { width: 120, padding: "2px 6px", backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontSize: 11, fontFamily: "JetBrains Mono" } }),
                    react_1.default.createElement("button", { style: { fontSize: 11, padding: "2px 6px", border: "none", borderRadius: 4, backgroundColor: "#FFB800", color: "#0a0a0b", cursor: "pointer" }, onClick: () => { onUpdateWidget(widget.id, { signal: signalInput }); setShowSignalDialog(false); setSignalInput(""); } }, "OK"))) : (react_1.default.createElement("button", { style: { fontSize: 11, padding: "2px 8px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#e8e8ed", cursor: "pointer" }, onClick: () => setShowSignalDialog(true) }, "Bind")),
                widget.signal && (react_1.default.createElement("button", { style: { fontSize: 11, padding: "2px 8px", border: "none", borderRadius: 4, backgroundColor: "transparent", color: "#FF4444", cursor: "pointer" }, onClick: () => onUpdateWidget(widget.id, { signal: undefined }) }, "\u00D7"))),
            fields.length > 0 && react_1.default.createElement(SectionHeader, { label: "Config" }),
            fields.map(f => (react_1.default.createElement("div", { key: f.key, style: { marginBottom: 4 } },
                react_1.default.createElement("label", { style: { fontSize: 11, color: "#a0a0b0", display: "block", marginBottom: 2 } }, f.label),
                f.type === "color" ? (react_1.default.createElement("input", { type: "color", value: String(widget.config[f.key] ?? f.defaultVal), onChange: e => handleChange(f.key, e.target.value), style: { width: "100%", height: 24, backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, cursor: "pointer" } })) : (react_1.default.createElement("input", { type: f.type, value: String(widget.config[f.key] ?? f.defaultVal), onChange: e => handleChange(f.key, f.type === "number" ? Number(e.target.value) : e.target.value), style: { width: "100%", padding: "2px 6px", backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontSize: 12 } }))))),
            react_1.default.createElement("div", { style: { marginTop: 12, paddingTop: 8, borderTop: "1px solid #2a2a30" } },
                react_1.default.createElement("button", { style: { width: "100%", fontSize: 12, padding: "4px 10px", color: "#FF4444", backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, cursor: "pointer" }, onClick: () => { if (confirm("Remove this widget?"))
                        onRemoveWidget(widget.id); } }, "Remove Widget")))));
}
function SectionHeader({ label }) {
    return react_1.default.createElement("div", { style: { fontSize: 11, color: "#a0a0b0", marginTop: 8, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 } }, label);
}
function NumInput({ label, value, onChange }) {
    return (react_1.default.createElement("div", null,
        react_1.default.createElement("label", { style: { fontSize: 10, color: "#a0a0b0", display: "block" } }, label),
        react_1.default.createElement("input", { type: "number", value: Math.round(value), onChange: e => onChange(Number(e.target.value) || 0), style: { width: "100%", padding: "2px 4px", backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontSize: 11, fontFamily: "JetBrains Mono" } })));
}
//# sourceMappingURL=property-panel.js.map