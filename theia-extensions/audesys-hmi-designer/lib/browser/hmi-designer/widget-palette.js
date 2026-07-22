"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WidgetPalette;
const react_1 = __importDefault(require("react"));
const WIDGET_PRESETS = [
    { type: "gauge", icon: "📊", label: "Gauge", desc: "Circular gauge with thresholds" },
    { type: "button", icon: "🔘", label: "Button", desc: "Toggle or momentary command" },
    { type: "text", icon: "📝", label: "Text", desc: "Static or dynamic text label" },
    { type: "indicator", icon: "💡", label: "Indicator", desc: "Boolean status indicator" },
    { type: "trend", icon: "📈", label: "Trend", desc: "Time-series line chart" },
    { type: "tank", icon: "🪣", label: "Tank", desc: "Liquid fill level display" },
    { type: "display", icon: "🔢", label: "Display", desc: "Numeric readout with units" },
];
function WidgetPalette({ onAddWidget }) {
    return (react_1.default.createElement("div", { style: { width: 220, backgroundColor: "#141416", borderRight: "1px solid #2a2a30", overflowY: "auto", flexShrink: 0 } },
        react_1.default.createElement("div", { style: { padding: "8px 12px", borderBottom: "1px solid #2a2a30", color: "#FFB800", fontSize: 13, fontWeight: 600 } }, "Widgets"),
        WIDGET_PRESETS.map((preset) => (react_1.default.createElement("div", { key: preset.type, onClick: () => onAddWidget(preset.type, preset.label), style: { padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #1e1e22", transition: "background 100ms ease-out" }, onMouseEnter: (e) => (e.currentTarget.style.background = "#1e1e22"), onMouseLeave: (e) => (e.currentTarget.style.background = "transparent") },
            react_1.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                react_1.default.createElement("span", { style: { fontSize: 18 } }, preset.icon),
                react_1.default.createElement("div", null,
                    react_1.default.createElement("div", { style: { fontSize: 13, color: "#e8e8ed", fontWeight: 500 } }, preset.label),
                    react_1.default.createElement("div", { style: { fontSize: 11, color: "#a0a0b0" } }, preset.desc))))))));
}
//# sourceMappingURL=widget-palette.js.map