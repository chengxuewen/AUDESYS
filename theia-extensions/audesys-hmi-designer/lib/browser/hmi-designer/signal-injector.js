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
exports.default = SignalInjector;
const react_1 = __importStar(require("react"));
function buildEntries(widgets) {
    const m = new Map();
    for (const w of widgets) {
        if (w.signal) {
            m.set(w.id, { widgetId: w.id, widgetLabel: w.label, signal: w.signal, value: "" });
        }
    }
    return m;
}
function SignalInjector({ widgets }) {
    const [collapsed, setCollapsed] = (0, react_1.useState)(false);
    const [entries, setEntries] = (0, react_1.useState)(() => buildEntries(widgets));
    const [feedback, setFeedback] = (0, react_1.useState)(new Map());
    (0, react_1.useEffect)(() => {
        setEntries(prev => {
            const next = buildEntries(widgets);
            for (const [id, existing] of prev) {
                const matched = next.get(id);
                if (matched && existing.value)
                    matched.value = existing.value;
            }
            return next;
        });
    }, [widgets]);
    const handleSetValue = (0, react_1.useCallback)((widgetId, value) => {
        const e = entries.get(widgetId);
        if (!e)
            return;
        setEntries(prev => { const next = new Map(prev); next.set(widgetId, { ...e, value }); return next; });
    }, [entries]);
    const handleApply = (0, react_1.useCallback)(async (widgetId) => {
        const e = entries.get(widgetId);
        if (!e || e.value.trim() === "")
            return;
        try {
            const sim = window.__audesysSim;
            if (sim?.setSignal) {
                const raw = e.value.trim();
                let valueStr;
                if (raw === "true" || raw === "false")
                    valueStr = `Bool(${raw})`;
                else if (!Number.isNaN(Number(raw)))
                    valueStr = `F64(${raw})`;
                else
                    valueStr = raw;
                await sim.setSignal(e.signal, valueStr);
            }
            setFeedback(prev => { const next = new Map(prev); next.set(widgetId, "ok"); return next; });
        }
        catch (err) {
            setFeedback(prev => { const next = new Map(prev); next.set(widgetId, String(err)); return next; });
        }
    }, [entries]);
    const boundWidgets = widgets.filter(w => w.signal);
    return (react_1.default.createElement("div", { style: { width: collapsed ? 32 : 260, backgroundColor: "#141416", borderLeft: "1px solid #2a2a30", display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 200ms ease-out", overflow: "hidden" } },
        react_1.default.createElement("div", { onClick: () => setCollapsed(c => !c), style: { display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: collapsed ? "8px 0" : "8px 12px", backgroundColor: "#1e1e22", borderBottom: "1px solid #2a2a30", cursor: "pointer", flexShrink: 0 } },
            !collapsed && (react_1.default.createElement(react_1.default.Fragment, null,
                react_1.default.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: "#e8e8ed", textTransform: "uppercase", letterSpacing: "0.5px" } }, "Signal Inject"),
                react_1.default.createElement("span", { style: { fontSize: 11, color: "#a0a0b0", fontFamily: "JetBrains Mono" } }, boundWidgets.length))),
            react_1.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", style: { transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 200ms ease-out" } },
                react_1.default.createElement("path", { d: "M4 6L7 9L10 6", stroke: "#a0a0b0", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }))),
        !collapsed && (react_1.default.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "8px 0" } },
            boundWidgets.length === 0 && (react_1.default.createElement("div", { style: { padding: "16px 12px", fontSize: 12, color: "#a0a0b0", textAlign: "center" } },
                "No signal-bound widgets.",
                react_1.default.createElement("br", null),
                "Bind signals in Edit mode.")),
            boundWidgets.map(w => {
                const entry = entries.get(w.id);
                const fb = feedback.get(w.id);
                return (react_1.default.createElement("div", { key: w.id, style: { padding: "8px 12px", borderBottom: "1px solid #2a2a30" } },
                    react_1.default.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#e8e8ed", marginBottom: 2 } }, w.label),
                    react_1.default.createElement("div", { style: { fontSize: 10, fontFamily: "JetBrains Mono", color: "#a0a0b0", marginBottom: 6 } }, w.signal),
                    react_1.default.createElement("div", { style: { display: "flex", gap: 4 } },
                        react_1.default.createElement("input", { type: "text", value: entry?.value ?? "", onChange: e => handleSetValue(w.id, e.target.value), onKeyDown: e => { if (e.key === "Enter")
                                handleApply(w.id); }, placeholder: "42", spellCheck: false, style: { flex: 1, padding: "4px 8px", backgroundColor: "#0a0a0b", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontFamily: "JetBrains Mono", fontSize: 12, outline: "none", minWidth: 0 } }),
                        react_1.default.createElement("button", { onClick: () => handleApply(w.id), style: { padding: "4px 10px", backgroundColor: "#FFB800", color: "#0a0a0b", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" } }, "Set")),
                    fb && react_1.default.createElement("div", { style: { fontSize: 10, color: fb === "ok" ? "#00D26A" : "#FF4444", marginTop: 4 } }, fb)));
            })))));
}
//# sourceMappingURL=signal-injector.js.map