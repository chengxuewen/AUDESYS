"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useHmiLayout = useHmiLayout;
const react_1 = require("react");
const useHmiLayoutValidator_1 = require("./useHmiLayoutValidator");
const DEFAULT_CANVAS = { width: 1200, height: 800 };
function createEmptyLayout(name) {
    return { version: 1, name, canvasWidth: DEFAULT_CANVAS.width, canvasHeight: DEFAULT_CANVAS.height, widgets: [] };
}
function useHmiLayout(initialLayout) {
    const [layout, setLayout] = (0, react_1.useState)(initialLayout ?? createEmptyLayout("Untitled"));
    const clone = (0, react_1.useCallback)((l) => JSON.parse(JSON.stringify(l)), []);
    const [selectedWidgetId, setSelectedWidgetId] = (0, react_1.useState)(null);
    const selectedWidget = (0, react_1.useMemo)(() => {
        if (!selectedWidgetId)
            return null;
        return layout.widgets.find((w) => w.id === selectedWidgetId) ?? null;
    }, [layout.widgets, selectedWidgetId]);
    const selectWidget = (0, react_1.useCallback)((id) => { setSelectedWidgetId(id); }, []);
    const validateBeforeSave = (0, react_1.useCallback)(() => (0, useHmiLayoutValidator_1.validateLayout)(layout), [layout]);
    const exportYaml = (0, react_1.useCallback)(() => {
        const lines = [];
        lines.push(`version: ${layout.version}`);
        lines.push(`name: ${layout.name}`);
        lines.push(`canvas_width: ${layout.canvasWidth}`);
        lines.push(`canvas_height: ${layout.canvasHeight}`);
        lines.push('widgets:');
        for (const w of layout.widgets) {
            lines.push(`  - id: ${w.id}`);
            lines.push(`    type: ${w.type}`);
            lines.push(`    position_x: ${w.position.x}`);
            lines.push(`    position_y: ${w.position.y}`);
            lines.push(`    size_width: ${w.size.width}`);
            lines.push(`    size_height: ${w.size.height}`);
            lines.push(`    label: ${w.label}`);
            if (w.signal)
                lines.push(`    signal: ${w.signal}`);
        }
        return lines.join('\n');
    }, [layout]);
    const importYaml = (0, react_1.useCallback)((yamlStr) => {
        try {
            const parsed = JSON.parse(yamlStr);
            setLayout(clone(parsed));
        }
        catch { /* skip */ }
    }, [clone]);
    const addWidget = (0, react_1.useCallback)((type, position, size, label) => {
        const id = crypto.randomUUID();
        const widget = { id, type, position, size, label, config: {} };
        setLayout((prev) => { const next = clone(prev); next.widgets.push(widget); return next; });
        return id;
    }, [clone]);
    const updateWidget = (0, react_1.useCallback)((id, patch) => {
        setLayout((prev) => {
            const next = clone(prev);
            const idx = next.widgets.findIndex((w) => w.id === id);
            if (idx === -1)
                return prev;
            next.widgets[idx] = { ...next.widgets[idx], ...patch };
            return next;
        });
    }, [clone]);
    const removeWidget = (0, react_1.useCallback)((id) => {
        setLayout((prev) => { const next = clone(prev); next.widgets = next.widgets.filter((w) => w.id !== id); return next; });
    }, [clone]);
    return { layout, selectedWidgetId, selectedWidget, selectWidget, addWidget, updateWidget, removeWidget, validateBeforeSave, exportYaml, importYaml };
}
//# sourceMappingURL=useHmiLayout.js.map