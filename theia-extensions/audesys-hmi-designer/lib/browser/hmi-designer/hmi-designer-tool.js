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
exports.default = HmiDesignerTool;
/**
 * HmiDesignerTool — Orchestrates canvas + palette + property panel + toolbar.
 *
 * ponytail: wraps useHmiLayout hook + sub-components in a flex layout,
 * matching the original HmiDesignerTool but without Tauri/platform deps.
 */
const react_1 = __importStar(require("react"));
const useHmiLayout_1 = require("../hooks/useHmiLayout");
const widget_palette_1 = __importDefault(require("./widget-palette"));
const property_panel_1 = __importDefault(require("./property-panel"));
const hmi_toolbar_1 = __importDefault(require("./hmi-toolbar"));
const signal_injector_1 = __importDefault(require("./signal-injector"));
/**
 * Renders the React content for the canvas area.
 * Imported from the separate component file to avoid re-creating on every render.
 */
const HmiCanvas_1 = __importDefault(require("./components/HmiCanvas"));
function HmiDesignerTool({ onSaveYaml, onLoadYaml, onDeploy }) {
    const hmi = (0, useHmiLayout_1.useHmiLayout)();
    const [editMode, setEditMode] = (0, react_1.useState)(true);
    const [errors, setErrors] = (0, react_1.useState)([]);
    const handleSave = (0, react_1.useCallback)(async () => {
        try {
            const yaml = hmi.exportYaml();
            onSaveYaml?.(yaml);
            setErrors([]);
        }
        catch (e) {
            setErrors([`Save failed: ${String(e)}`]);
        }
    }, [hmi, onSaveYaml]);
    const handleLoad = (0, react_1.useCallback)(async () => {
        try {
            if (onLoadYaml) {
                const yaml = await onLoadYaml();
                if (yaml)
                    hmi.importYaml(yaml);
            }
            setErrors([]);
        }
        catch (e) {
            setErrors([`Load failed: ${String(e)}`]);
        }
    }, [hmi, onLoadYaml]);
    const handleClear = (0, react_1.useCallback)(() => {
        hmi.layout.widgets.forEach(w => hmi.removeWidget(w.id));
    }, [hmi]);
    const handleDeploy = (0, react_1.useCallback)(async () => {
        try {
            const result = hmi.validateBeforeSave();
            if (result.errors.length > 0) {
                setErrors(result.errors);
                return;
            }
            const yaml = hmi.exportYaml();
            await onDeploy?.(yaml);
            setErrors(["✓ deployed"]);
        }
        catch (e) {
            setErrors([`Deploy failed: ${String(e)}`]);
        }
    }, [hmi, onDeploy]);
    const handleAddWidget = (0, react_1.useCallback)((type, label) => {
        hmi.addWidget(type, { x: 100 + hmi.layout.widgets.length * 20, y: 100 + hmi.layout.widgets.length * 20 }, { width: 200, height: 160 }, label);
    }, [hmi]);
    return (react_1.default.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#0a0a0b" } },
        errors.length > 0 && (react_1.default.createElement("div", { style: { background: "#141416", borderBottom: "1px solid #2a2a30", fontSize: 12, maxHeight: 80, overflow: "auto" } }, errors.map((e, i) => (react_1.default.createElement("div", { key: i, style: { padding: "2px 12px", color: "#e8e8ed" } },
            e,
            react_1.default.createElement("button", { style: { marginLeft: 8, background: "none", border: "none", color: "#a0a0b0", cursor: "pointer", fontSize: 12 }, onClick: () => setErrors([]) }, "Dismiss")))))),
        react_1.default.createElement(hmi_toolbar_1.default, { editMode: editMode, onToggleMode: () => setEditMode(m => !m), onSave: handleSave, onLoad: handleLoad, onClear: handleClear, onDeploy: onDeploy ? handleDeploy : undefined }),
        react_1.default.createElement("div", { style: { flex: 1, display: "flex", overflow: "hidden" } },
            react_1.default.createElement(widget_palette_1.default, { onAddWidget: handleAddWidget }),
            react_1.default.createElement("div", { className: "hmiapp-canvas", "data-hmi-canvas": "true", style: {
                    flex: 1,
                    position: "relative",
                    overflow: "hidden",
                    backgroundColor: "#0a0a0b",
                    contain: "layout style",
                    overscrollBehavior: editMode ? "contain" : "auto",
                }, tabIndex: 0 },
                react_1.default.createElement(HmiCanvas_1.default, { widgets: hmi.layout.widgets, selectedWidgetId: hmi.selectedWidgetId, editMode: editMode, onSelectWidget: hmi.selectWidget, onUpdateWidget: hmi.updateWidget, onRemoveWidget: hmi.removeWidget })),
            editMode ? (react_1.default.createElement(property_panel_1.default, { widget: hmi.selectedWidget, onUpdateWidget: hmi.updateWidget, onRemoveWidget: hmi.removeWidget })) : (react_1.default.createElement(signal_injector_1.default, { widgets: hmi.layout.widgets })))));
}
//# sourceMappingURL=hmi-designer-tool.js.map