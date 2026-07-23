"use strict";
/**
 * FBD Editor Widget — SVG-based function block diagram renderer.
 *
 * Renders the FbdGraph model as an interactive SVG canvas. Supports:
 * - Logic gates (AND=half-circle, OR=pointed arc, NOT=triangle+circle,
 *   XOR=pointed arc "=1", MUX=trapezoid)
 * - Function block instances (rectangles with pin dots)
 * - Signal wires (orthogonal line segments with 90° bends)
 * - Click-to-select with visual feedback
 * - Tool-mode click to create new elements
 * - Right-click context menu (Delete, Change Gate Type, Compile)
 * - Grid snap (20px)
 *
 * Ponytail: plain SVG + React state. No canvas libs, no GLSP server.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FbdEditorWidget = void 0;
const react_1 = __importDefault(require("react"));
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const nodes_1 = require("../gmodel/nodes");
// ============================================================================
// Grid Constants (match fbd-operation-handler.ts)
// ============================================================================
const GRID_X = 20;
const GRID_Y = 20;
const GATE_SIZE = 50;
const FB_MIN_WIDTH = 100;
const FB_PIN_SPACING = 20;
const CANVAS_PADDING = 40;
const SNAP_THRESHOLD = GRID_X / 2;
const FbdEditor = ({ toolState, modelState, handler, onSelectionChange, onDirtyChange, onCompileResult, }) => {
    const [graph, setGraph] = react_1.default.useState(modelState.graph);
    const [selectedId, setSelectedId] = react_1.default.useState(null);
    const [hoveredId, setHoveredId] = react_1.default.useState(null);
    const [contextMenu, setContextMenu] = react_1.default.useState({
        visible: false, x: 0, y: 0, elementId: null, isGate: false,
    });
    const [toolType, setToolType] = react_1.default.useState(null);
    const [wireStart, setWireStart] = react_1.default.useState(null);
    // Sync tool selection
    react_1.default.useEffect(() => {
        const sub = toolState.onDidChangeTool((t) => {
            setToolType(t);
            if (t !== 'wire')
                setWireStart(null);
        });
        return () => sub.dispose();
    }, [toolState]);
    const refreshGraph = (g) => {
        setGraph(g);
        if (onDirtyChange)
            onDirtyChange(modelState.dirty);
    };
    // Selection notification
    react_1.default.useEffect(() => {
        if (!selectedId) {
            onSelectionChange?.(null);
            return;
        }
        const node = graph.nodes.find((n) => n.id === selectedId);
        if (node) {
            onSelectionChange?.({ elementId: selectedId, elementType: node.type });
        }
    }, [selectedId, graph]);
    // ── Canvas Click ───────────────────────────────────────────
    const handleCanvasClick = (e) => {
        if (e.button !== 0)
            return;
        // Close context menu on click elsewhere
        if (contextMenu.visible) {
            setContextMenu({ ...contextMenu, visible: false });
            return;
        }
        // Click on background → deselect
        if (e.target === e.currentTarget) {
            setSelectedId(null);
            // If wire tool, click background = cancel
            if (toolType === 'wire') {
                setWireStart(null);
                toolState.deselectTool();
            }
            return;
        }
        // If a tool is active, create element at click position
        if (toolType && toolType !== 'wire') {
            const svg = e.currentTarget;
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const ctm = svg.getScreenCTM();
            if (!ctm)
                return;
            const world = pt.matrixTransform(ctm.inverse());
            // ponytail: snap to grid
            const snapped = {
                x: Math.round((world.x - CANVAS_PADDING) / GRID_X) * GRID_X,
                y: Math.round((world.y - CANVAS_PADDING) / GRID_Y) * GRID_Y,
            };
            try {
                let next;
                switch (toolType) {
                    case 'and-gate':
                        next = handler.createGate(graph, { gateType: nodes_1.GateType.AND, position: snapped });
                        break;
                    case 'or-gate':
                        next = handler.createGate(graph, { gateType: nodes_1.GateType.OR, position: snapped });
                        break;
                    case 'xor-gate':
                        next = handler.createGate(graph, { gateType: nodes_1.GateType.XOR, position: snapped });
                        break;
                    case 'not-gate':
                        next = handler.createGate(graph, { gateType: nodes_1.GateType.NOT, position: snapped });
                        break;
                    case 'mux-gate':
                        next = handler.createGate(graph, { gateType: nodes_1.GateType.MUX, position: snapped });
                        break;
                    case 'eq-cmp':
                        next = handler.createFunctionBlock(graph, { fbType: 'EQ', position: snapped });
                        break;
                    case 'gt-cmp':
                        next = handler.createFunctionBlock(graph, { fbType: 'GT', position: snapped });
                        break;
                    case 'lt-cmp':
                        next = handler.createFunctionBlock(graph, { fbType: 'LT', position: snapped });
                        break;
                    case 'fb-instance':
                        next = handler.createFunctionBlock(graph, { fbType: 'TON', position: snapped });
                        break;
                    default:
                        return;
                }
                modelState.applyOperation(() => next);
                refreshGraph(next);
            }
            catch { /* ponytail: silently ignore validation errors */ }
            toolState.deselectTool();
            return;
        }
        setSelectedId(null);
    };
    // ── Element Click ──────────────────────────────────────────
    const handleElementClick = (elementId, e) => {
        e.stopPropagation();
        // Wire tool: clicking a node starts or completes a connection
        if (toolType === 'wire') {
            const node = graph.nodes.find((n) => n.id === elementId);
            if (!node)
                return;
            if (!wireStart) {
                // Start wire from first output pin
                const outPins = 'outputPorts' in node ? node.outputPorts : [];
                if (outPins.length > 0) {
                    setWireStart({ nodeId: elementId, portName: outPins[0].name });
                }
            }
            else {
                // Complete wire to this node's first input pin
                const inPins = 'inputPorts' in node ? node.inputPorts : [];
                if (inPins.length > 0 && wireStart.nodeId !== elementId) {
                    try {
                        const next = handler.connectPins(graph, {
                            sourceNodeId: wireStart.nodeId,
                            sourcePortName: wireStart.portName,
                            targetNodeId: elementId,
                            targetPortName: inPins[0].name,
                        });
                        modelState.applyOperation(() => next);
                        refreshGraph(next);
                    }
                    catch { /* ignore */ }
                }
                setWireStart(null);
                toolState.deselectTool();
            }
            return;
        }
        setSelectedId(elementId);
        if (toolType)
            toolState.deselectTool();
    };
    // ── Right-Click Context Menu ───────────────────────────────
    const handleContextMenu = (e) => {
        e.preventDefault();
        const target = e.target;
        const elementEl = target.closest('[data-element-id]');
        if (elementEl) {
            const elementId = elementEl.getAttribute('data-element-id');
            const node = graph.nodes.find((n) => n.id === elementId);
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                elementId,
                isGate: node?.type === 'node:gate',
            });
            setSelectedId(elementId);
        }
        else {
            setContextMenu({ ...contextMenu, visible: false });
        }
    };
    const handleDeleteElement = () => {
        if (!contextMenu.elementId)
            return;
        try {
            const next = handler.deleteElement(graph, { elementId: contextMenu.elementId });
            modelState.applyOperation(() => next);
            refreshGraph(next);
            setSelectedId(null);
        }
        catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };
    const handleChangeGateType = () => {
        if (!contextMenu.elementId)
            return;
        try {
            const node = graph.nodes.find((n) => n.id === contextMenu.elementId);
            if (!node)
                return;
            // Cycle: AND → OR → XOR → AND
            const cycle = [nodes_1.GateType.AND, nodes_1.GateType.OR, nodes_1.GateType.XOR];
            const idx = cycle.indexOf(node.gateType);
            const nextType = cycle[(idx + 1) % cycle.length];
            const next = handler.changeGateType(graph, { elementId: contextMenu.elementId, newGateType: nextType });
            modelState.applyOperation(() => next);
            refreshGraph(next);
        }
        catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };
    const handleCompile = () => {
        const result = handler.compile(graph);
        onCompileResult?.(result);
        setContextMenu({ ...contextMenu, visible: false });
    };
    // Close context menu on outside click
    const handleGlobalClick = () => {
        if (contextMenu.visible) {
            setContextMenu({ ...contextMenu, visible: false });
        }
    };
    react_1.default.useEffect(() => {
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [contextMenu.visible]);
    // ── Hover ──────────────────────────────────────────────────
    const handleElementHover = (elementId) => {
        setHoveredId(elementId);
    };
    const handleElementUnhover = () => {
        setHoveredId(null);
    };
    // ── Node Map ───────────────────────────────────────────────
    const nodeMap = new Map();
    for (const n of graph.nodes)
        nodeMap.set(n.id, n);
    // ── Canvas Bounds ──────────────────────────────────────────
    const nodeBounds = graph.nodes.reduce((acc, n) => ({
        maxX: Math.max(acc.maxX, n.position.x + n.size.width),
        maxY: Math.max(acc.maxY, n.position.y + n.size.height),
    }), { maxX: 0, maxY: 0 });
    const totalWidth = Math.max(nodeBounds.maxX + CANVAS_PADDING * 2, 800);
    const totalHeight = Math.max(nodeBounds.maxY + CANVAS_PADDING * 2, 600);
    // ── Gate Rendering ─────────────────────────────────────────
    const renderGate = (gate, cx, cy, isSelected, isHovered) => {
        const s = gate.size.width;
        const hs = s / 2;
        const x = cx + CANVAS_PADDING;
        const y = cy + CANVAS_PADDING;
        let shapePath;
        let label;
        switch (gate.gateType) {
            case nodes_1.GateType.AND:
                // Flat left + rounded right (D-shape)
                shapePath = `M ${x} ${y} L ${x + hs} ${y} Q ${x + s} ${y} ${x + s} ${y + hs} Q ${x + s} ${y + s} ${x + hs} ${y + s} L ${x} ${y + s} Z`;
                label = '&';
                break;
            case nodes_1.GateType.OR:
                // Pointed arc shape (curved both sides, pointed top/bottom)
                shapePath = `M ${x + 4} ${y} Q ${x + hs} ${y + 4} ${x + s} ${y + hs} Q ${x + hs} ${y + s - 4} ${x + 4} ${y + s}`;
                // ponytail: approximate OR shape with an ellipse
                shapePath = `M ${x + 8} ${y} Q ${x + hs} ${y - 4} ${x + s} ${y + hs} Q ${x + hs} ${y + s + 4} ${x + 8} ${y + s}`;
                label = '\u22651';
                break;
            case nodes_1.GateType.XOR:
                // Same shape as OR, different label
                shapePath = `M ${x + 8} ${y} Q ${x + hs} ${y - 4} ${x + s} ${y + hs} Q ${x + hs} ${y + s + 4} ${x + 8} ${y + s}`;
                label = '=1';
                break;
            case nodes_1.GateType.NOT:
                // Triangle pointing right + small circle at output
                shapePath = `M ${x} ${y} L ${x + s - 6} ${y + hs} L ${x} ${y + s} Z`;
                label = '1';
                break;
            case nodes_1.GateType.MUX:
                // Trapezoid
                shapePath = `M ${x + 4} ${y} L ${x + s - 4} ${y + 4} L ${x + s - 4} ${y + s - 4} L ${x + 4} ${y + s} Z`;
                label = 'MUX';
                break;
            default:
                // Fallback rectangle
                shapePath = `M ${x} ${y} h ${s} v ${s} h ${-s} Z`;
                label = '?';
        }
        const strokeColor = isSelected
            ? 'var(--fbd-selection-color)'
            : isHovered ? 'var(--fbd-hover-color)' : 'var(--fbd-gate-stroke)';
        const fillColor = isHovered ? 'var(--fbd-gate-fill-hover)' : 'var(--fbd-gate-fill)';
        return (react_1.default.createElement("g", { key: gate.id, "data-element-id": gate.id, onClick: (e) => handleElementClick(gate.id, e), onMouseEnter: () => handleElementHover(gate.id), onMouseLeave: handleElementUnhover, style: { cursor: toolType === 'wire' ? 'crosshair' : 'pointer' } },
            isSelected && (react_1.default.createElement("rect", { x: x - 4, y: y - 4, width: s + 8, height: s + 8, fill: "none", stroke: "var(--fbd-selection-color)", strokeWidth: 2, strokeDasharray: "4 2" })),
            react_1.default.createElement("path", { d: shapePath, fill: fillColor, stroke: strokeColor, strokeWidth: 2 }),
            react_1.default.createElement("text", { x: x + s / 2, y: y + s / 2 + 4, textAnchor: "middle", fontSize: 12, fill: "var(--fbd-gate-label-color)", fontWeight: "bold", style: { pointerEvents: 'none' } }, label),
            gate.gateType === nodes_1.GateType.NOT && (react_1.default.createElement("circle", { cx: x + s - 2, cy: y + hs, r: 4, fill: "var(--fbd-gate-fill)", stroke: strokeColor, strokeWidth: 2 })),
            gate.inputPorts.map((pin, i) => {
                const px = x;
                const py = y + 10 + i * FB_PIN_SPACING;
                return (react_1.default.createElement("g", { key: `pin-in-${pin.name}` },
                    react_1.default.createElement("circle", { cx: px, cy: py, r: 3, fill: strokeColor, stroke: "var(--fbd-pin-border)", strokeWidth: 1 }),
                    react_1.default.createElement("text", { x: px - 4, y: py + 4, textAnchor: "end", fontSize: 8, fill: "var(--fbd-pin-label-color)", style: { pointerEvents: 'none' } }, pin.name)));
            }),
            gate.outputPorts.map((pin, i) => {
                const px = x + s;
                const py = y + 10 + i * FB_PIN_SPACING;
                return (react_1.default.createElement("g", { key: `pin-out-${pin.name}` },
                    react_1.default.createElement("circle", { cx: px, cy: py, r: 3, fill: strokeColor, stroke: "var(--fbd-pin-border)", strokeWidth: 1 }),
                    react_1.default.createElement("text", { x: px + 4, y: py + 4, textAnchor: "start", fontSize: 8, fill: "var(--fbd-pin-label-color)", style: { pointerEvents: 'none' } }, pin.name)));
            })));
    };
    // ── Function Block Rendering ───────────────────────────────
    const renderFunctionBlock = (fb, cx, cy, isSelected, isHovered) => {
        const w = fb.size.width;
        const h = fb.size.height;
        const x = cx + CANVAS_PADDING;
        const y = cy + CANVAS_PADDING;
        const strokeColor = isSelected
            ? 'var(--fbd-selection-color)'
            : isHovered ? 'var(--fbd-hover-color)' : 'var(--fbd-fb-stroke)';
        return (react_1.default.createElement("g", { key: fb.id, "data-element-id": fb.id, onClick: (e) => handleElementClick(fb.id, e), onMouseEnter: () => handleElementHover(fb.id), onMouseLeave: handleElementUnhover, style: { cursor: toolType === 'wire' ? 'crosshair' : 'pointer' } },
            isSelected && (react_1.default.createElement("rect", { x: x - 4, y: y - 4, width: w + 8, height: h + 8, fill: "none", stroke: "var(--fbd-selection-color)", strokeWidth: 2, strokeDasharray: "4 2" })),
            react_1.default.createElement("rect", { x: x, y: y, width: w, height: h, fill: isHovered ? 'var(--fbd-fb-fill-hover)' : 'var(--fbd-fb-fill)', stroke: strokeColor, strokeWidth: 2, rx: 4 }),
            react_1.default.createElement("text", { x: x + w / 2, y: y + 14, textAnchor: "middle", fontSize: 11, fill: "var(--fbd-fb-stroke)", fontWeight: "bold", style: { pointerEvents: 'none' } }, fb.fbType),
            react_1.default.createElement("line", { x1: x, y1: y + 20, x2: x + w, y2: y + 20, stroke: strokeColor, strokeWidth: 0.5 }),
            fb.inputPorts.map((pin, i) => {
                const px = x;
                const py = y + 30 + i * FB_PIN_SPACING;
                return (react_1.default.createElement("g", { key: `fb-in-${pin.name}` },
                    react_1.default.createElement("circle", { cx: px, cy: py, r: 3, fill: strokeColor, stroke: "var(--fbd-pin-border)", strokeWidth: 1 }),
                    react_1.default.createElement("text", { x: px - 4, y: py + 4, textAnchor: "end", fontSize: 8, fill: "var(--fbd-pin-label-color)", style: { pointerEvents: 'none' } }, pin.name)));
            }),
            fb.outputPorts.map((pin, i) => {
                const px = x + w;
                const py = y + 30 + i * FB_PIN_SPACING;
                return (react_1.default.createElement("g", { key: `fb-out-${pin.name}` },
                    react_1.default.createElement("circle", { cx: px, cy: py, r: 3, fill: strokeColor, stroke: "var(--fbd-pin-border)", strokeWidth: 1 }),
                    react_1.default.createElement("text", { x: px + 4, y: py + 4, textAnchor: "start", fontSize: 8, fill: "var(--fbd-pin-label-color)", style: { pointerEvents: 'none' } }, pin.name)));
            })));
    };
    // ── Signal Edge Rendering ─────────────────────────────────
    const renderEdge = (edge) => {
        const source = nodeMap.get(edge.sourceId);
        const target = nodeMap.get(edge.targetId);
        if (!source || !target)
            return null;
        const sigEdge = edge;
        // Get pin positions
        const srcPin = getPinWorldPos(source, edge.sourcePortName, 'output');
        const tgtPin = getPinWorldPos(target, edge.targetPortName, 'input');
        let pathD;
        if (sigEdge.routingPoints && sigEdge.routingPoints.length > 0) {
            // Use manual routing points
            const pts = [srcPin, ...sigEdge.routingPoints.map((rp) => ({
                    x: rp.x + CANVAS_PADDING,
                    y: rp.y + CANVAS_PADDING,
                })), tgtPin];
            pathD = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
        }
        else {
            // ponytail: orthogonal auto-route (two 90° bends)
            const midX = (srcPin.x + tgtPin.x) / 2;
            pathD = `M ${srcPin.x} ${srcPin.y} L ${midX} ${srcPin.y} L ${midX} ${tgtPin.y} L ${tgtPin.x} ${tgtPin.y}`;
        }
        return (react_1.default.createElement("path", { key: edge.id, "data-element-id": edge.id, d: pathD, fill: "none", stroke: "var(--fbd-wire-color)", strokeWidth: 1.5, markerEnd: "url(#fbd-arrow)" }));
    };
    // ── Helper: get pin position in world (canvas) coordinates ─
    const getPinWorldPos = (node, portName, side) => {
        const pins = side === 'input'
            ? node.inputPorts
            : node.outputPorts;
        const pinIdx = pins?.findIndex((p) => p.name === portName) ?? 0;
        const spacing = FB_PIN_SPACING;
        if (node.type === 'node:gate') {
            const s = node.size.width;
            const pyBase = CANVAS_PADDING + node.position.y + 10;
            if (side === 'input') {
                return { x: CANVAS_PADDING + node.position.x, y: pyBase + pinIdx * spacing };
            }
            else {
                return { x: CANVAS_PADDING + node.position.x + s, y: pyBase + pinIdx * spacing };
            }
        }
        else if (node.type === 'node:fb') {
            const fb = node;
            const pyBase = CANVAS_PADDING + node.position.y + 30;
            if (side === 'input') {
                return { x: CANVAS_PADDING + node.position.x, y: pyBase + pinIdx * spacing };
            }
            else {
                return { x: CANVAS_PADDING + node.position.x + fb.size.width, y: pyBase + pinIdx * spacing };
            }
        }
        return { x: 0, y: 0 };
    };
    // ── Render ─────────────────────────────────────────────────
    const isToolActive = toolType !== null;
    return (react_1.default.createElement("div", { className: `fbd-editor${isToolActive ? ' fbd-editor--tool-active' : ''}` },
        react_1.default.createElement("svg", { width: totalWidth, height: totalHeight, onClick: handleCanvasClick, onContextMenu: handleContextMenu },
            react_1.default.createElement("defs", null,
                react_1.default.createElement("marker", { id: "fbd-arrow", viewBox: "0 0 8 8", refX: 8, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
                    react_1.default.createElement("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "var(--fbd-wire-color)" })),
                react_1.default.createElement("pattern", { id: "fbd-grid", width: GRID_X, height: GRID_Y, patternUnits: "userSpaceOnUse" },
                    react_1.default.createElement("path", { d: `M ${GRID_X} 0 L 0 0 0 ${GRID_Y}`, fill: "none", stroke: "var(--fbd-grid-color)", strokeWidth: 0.5 }))),
            react_1.default.createElement("rect", { width: "100%", height: "100%", fill: "url(#fbd-grid)" }),
            graph.edges.map(renderEdge),
            graph.nodes.map((node) => {
                const cx = node.position.x;
                const cy = node.position.y;
                const isSelected = node.id === selectedId;
                const isHovered = node.id === hoveredId;
                if (node.type === 'node:gate') {
                    return renderGate(node, cx, cy, isSelected, isHovered);
                }
                else if (node.type === 'node:fb') {
                    return renderFunctionBlock(node, cx, cy, isSelected, isHovered);
                }
                return null;
            }),
            wireStart && (react_1.default.createElement("line", { x1: getPinWorldPos(nodeMap.get(wireStart.nodeId), wireStart.portName, 'output').x, y1: getPinWorldPos(nodeMap.get(wireStart.nodeId), wireStart.portName, 'output').y, x2: 
                // ponytail: show wire following mouse is complex in SVG onClick;
                // instead, highlight the start node's output
                getPinWorldPos(nodeMap.get(wireStart.nodeId), wireStart.portName, 'output').x + 30, y2: getPinWorldPos(nodeMap.get(wireStart.nodeId), wireStart.portName, 'output').y, stroke: "var(--fbd-wire-color)", strokeWidth: 2, strokeDasharray: "6 3" }))),
        contextMenu.visible && (react_1.default.createElement("div", { className: "fbd-context-menu", style: { left: contextMenu.x, top: contextMenu.y } },
            contextMenu.isGate && (react_1.default.createElement("button", { className: "fbd-context-menu__item", onClick: handleChangeGateType }, "Change Gate Type")),
            react_1.default.createElement("button", { className: "fbd-context-menu__item", onClick: handleCompile }, "Compile (FBD\u2192IL\u2192HalProgram)"),
            react_1.default.createElement("div", { className: "fbd-context-menu__separator" }),
            contextMenu.elementId && (react_1.default.createElement("button", { className: "fbd-context-menu__item fbd-context-menu__item--danger", onClick: handleDeleteElement }, "Delete Element"))))));
};
// ============================================================================
// Widget
// ============================================================================
class FbdEditorWidget extends react_widget_1.ReactWidget {
    constructor(toolState, modelState, handler) {
        super();
        this._dirty = false;
        this._compileResult = null;
        this.toolState = toolState;
        this.modelState = modelState;
        this.handler = handler;
        this.id = FbdEditorWidget.ID;
        this.title.label = FbdEditorWidget.LABEL;
        this.title.caption = 'IEC 61131-3 Function Block Diagram Editor';
        this.title.closable = true;
    }
    get dirty() { return this._dirty; }
    get compileResult() { return this._compileResult; }
    setSelectionCallback(fn) {
        this.onSelectionChange = fn;
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        this.injectStyles();
    }
    render() {
        return react_1.default.createElement(FbdEditor, {
            toolState: this.toolState,
            modelState: this.modelState,
            handler: this.handler,
            onSelectionChange: this.onSelectionChange,
            onDirtyChange: (d) => { this._dirty = d; },
            onCompileResult: (r) => { this._compileResult = r; },
        });
    }
    injectStyles() {
        const styleId = 'fbd-editor-theme-css';
        if (document.getElementById(styleId))
            return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .fbd-editor { width:100%; height:100%; overflow:auto; background:var(--theia-editor-background,#1e1e1e); cursor:default; }
          .fbd-editor svg { display:block; min-width:100%; min-height:100%; }
          .fbd-editor--tool-active { cursor:crosshair; }
          .fbd-context-menu { position:fixed; z-index:10000; background:var(--theia-menu-background,#252526); border:1px solid var(--theia-menu-border,#454545); border-radius:4px; padding:4px 0; min-width:180px; box-shadow:0 2px 8px rgba(0,0,0,0.36); }
          .fbd-context-menu__item { display:block; width:100%; padding:4px 24px; border:none; background:transparent; color:var(--theia-menu-foreground,#ccc); font-size:12px; text-align:left; cursor:pointer; white-space:nowrap; }
          .fbd-context-menu__item:hover { background:var(--theia-menu-selectionBackground,#094771); }
          .fbd-context-menu__item--danger { color:var(--theia-inputValidation-errorBorder,#f44747); }
          .fbd-context-menu__separator { height:1px; margin:4px 0; background:var(--theia-menu-separatorBackground,#454545); }

          /* ponytail: CSS custom properties for FBD theming */
          :root {
            --fbd-gate-fill: #2a2a2a;
            --fbd-gate-fill-hover: #3a3a4a;
            --fbd-gate-stroke: #56a9ff;
            --fbd-gate-label-color: #e0e0e0;
            --fbd-fb-fill: #252528;
            --fbd-fb-fill-hover: #353545;
            --fbd-fb-stroke: #89d185;
            --fbd-wire-color: #a0a0a0;
            --fbd-grid-color: #3a3a3a;
            --fbd-selection-color: #007acc;
            --fbd-hover-color: #4fc1ff;
            --fbd-pin-border: #888;
            --fbd-pin-label-color: #999;
          }
        `;
        document.head.appendChild(style);
    }
}
exports.FbdEditorWidget = FbdEditorWidget;
FbdEditorWidget.ID = 'audesys-fbd-editor';
FbdEditorWidget.LABEL = 'Function Block Diagram';
//# sourceMappingURL=fbd-editor-widget.js.map