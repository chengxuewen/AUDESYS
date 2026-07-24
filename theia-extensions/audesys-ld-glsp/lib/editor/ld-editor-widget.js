"use strict";
/**
 * LD Editor Widget — SVG-based ladder diagram renderer.
 *
 * Renders the LdGraph model as an interactive SVG canvas. Supports:
 * - Power rails (left/right vertical lines)
 * - Rungs with contacts, coils, and FB placeholders
 * - Wires between elements
 * - Click-to-select with visual feedback
 * - Tool-mode click to create new elements
 * - Right-click context menu
 *
 * Ponytail: plain SVG + React state. No GLSP rendering server, no canvas libs.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdEditorWidget = void 0;
const react_1 = __importDefault(require("react"));
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const nodes_1 = require("../gmodel/nodes");
// ============================================================================
// Grid Constants (match ld-operation-handler.ts)
// ============================================================================
const GRID_X = 120;
const GRID_Y = 80;
const CONTACT_SIZE = 36;
const RAIL_WIDTH = 4;
const COIL_X_OFFSET = 600;
const RUNG_OFFSET = 80;
const CANVAS_PADDING = 40;
const LdEditor = ({ toolState, modelState, handler, onSelectionChange, onDirtyChange }) => {
    const [graph, setGraph] = react_1.default.useState(modelState.graph);
    const [selectedId, setSelectedId] = react_1.default.useState(null);
    const [hoveredId, setHoveredId] = react_1.default.useState(null);
    const [contextMenu, setContextMenu] = react_1.default.useState({
        visible: false, x: 0, y: 0, elementId: null, isContact: false,
    });
    const [toolType, setToolType] = react_1.default.useState(null);
    // Sync tool selection
    react_1.default.useEffect(() => {
        const sub = toolState.onDidChangeTool((t) => {
            setToolType(t);
        });
        return () => sub.dispose();
    }, [toolState]);
    // Refresh graph + notify dirty on re-render
    const refreshGraph = (g) => {
        setGraph(g);
        if (onDirtyChange) {
            onDirtyChange(modelState.dirty);
        }
    };
    // Selection notification
    react_1.default.useEffect(() => {
        if (!selectedId) {
            onSelectionChange?.(null);
            return;
        }
        const node = graph.nodes.find((n) => n.id === selectedId);
        if (node) {
            const rung = graph.rungs.find((r) => r.elementIds.includes(selectedId));
            onSelectionChange?.({
                elementId: selectedId,
                elementType: node.type,
                rungId: rung?.id,
            });
        }
    }, [selectedId, graph]);
    // ── Canvas Click ───────────────────────────────────────────
    const handleCanvasClick = (e) => {
        // Right-click handled separately
        if (e.button !== 0)
            return;
        // If context menu open, close it
        if (contextMenu.visible) {
            setContextMenu({ ...contextMenu, visible: false });
            return;
        }
        // Click on background = deselect
        if (e.target === e.currentTarget) {
            setSelectedId(null);
            return;
        }
        // If a tool is active, create element
        if (toolType) {
            const svg = e.currentTarget;
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const ctm = svg.getScreenCTM();
            if (!ctm)
                return;
            const world = pt.matrixTransform(ctm.inverse());
            // Auto-create first rung if canvas is empty
            let currentGraph = graph;
            if (graph.rungs.length === 0
                && (toolType.startsWith('no-') || toolType.startsWith('nc-') || toolType === 'coil'
                    || toolType.startsWith('negated-') || toolType.startsWith('set-') || toolType.startsWith('reset-'))) {
                currentGraph = handler.addRung(graph, { position: { x: 0, y: 0 } });
                refreshGraph(currentGraph);
            }
            const targetRung = findRungByY(currentGraph, world.y);
            if (!targetRung)
                return;
            try {
                let next;
                switch (toolType) {
                    case 'no-contact':
                        next = handler.addContact(currentGraph, {
                            rungId: targetRung.id,
                            position: { x: world.x - CANVAS_PADDING, y: targetRung.rungNumber * RUNG_OFFSET },
                            type: nodes_1.ContactType.NO,
                        });
                        break;
                    case 'nc-contact':
                        next = handler.addContact(currentGraph, {
                            rungId: targetRung.id,
                            position: { x: world.x - CANVAS_PADDING, y: targetRung.rungNumber * RUNG_OFFSET },
                            type: nodes_1.ContactType.NC,
                        });
                        break;
                    case 'coil':
                    case 'negated-coil':
                    case 'set-coil':
                    case 'reset-coil': {
                        const ct = {
                            'coil': nodes_1.CoilType.Normal,
                            'negated-coil': nodes_1.CoilType.Negated,
                            'set-coil': nodes_1.CoilType.Set,
                            'reset-coil': nodes_1.CoilType.Reset,
                        };
                        next = handler.addCoil(currentGraph, {
                            rungId: targetRung.id,
                            position: { x: world.x - CANVAS_PADDING, y: targetRung.rungNumber * RUNG_OFFSET },
                            type: ct[toolType],
                        });
                        break;
                    }
                    case 'rung':
                        next = handler.addRung(currentGraph);
                        break;
                    default:
                        return;
                }
                modelState.applyOperation(() => next);
                refreshGraph(next);
            }
            catch (err) {
                // ponytail: silently ignore validation errors — user corrects visually
            }
            // ponytail: deselect tool after placement (single-use placement)
            toolState.deselectTool();
            return;
        }
        // Click on background → deselect
        setSelectedId(null);
    };
    // ── Element Click ──────────────────────────────────────────
    const handleElementClick = (elementId, e) => {
        e.stopPropagation();
        setSelectedId(elementId);
        // If tool active and clicking an element, don't create — just select
        if (toolType) {
            toolState.deselectTool();
        }
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
                isContact: node?.type === 'node:contact',
            });
            setSelectedId(elementId);
        }
        else {
            setContextMenu({ ...contextMenu, visible: false });
        }
    };
    // ── Context Menu Actions ───────────────────────────────────
    const handleDeleteElement = () => {
        if (!contextMenu.elementId)
            return;
        try {
            const next = handler.deleteElement(graph, { elementId: contextMenu.elementId });
            modelState.applyOperation(() => next);
            refreshGraph(next);
        }
        catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };
    const handleChangeContactType = () => {
        if (!contextMenu.elementId)
            return;
        try {
            const node = graph.nodes.find((n) => n.id === contextMenu.elementId);
            const newType = node?.contactType === nodes_1.ContactType.NO ? nodes_1.ContactType.NC : nodes_1.ContactType.NO;
            const next = handler.changeContactType(graph, {
                elementId: contextMenu.elementId,
                newType,
            });
            modelState.applyOperation(() => next);
            refreshGraph(next);
        }
        catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };
    const handleAddRung = () => {
        try {
            const next = handler.addRung(graph);
            modelState.applyOperation(() => next);
            refreshGraph(next);
        }
        catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };
    // Close context menu on any outside click
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
    // ── Render Helpers ─────────────────────────────────────────
    const nodeMap = new Map();
    for (const n of graph.nodes) {
        nodeMap.set(n.id, n);
    }
    /** Calculate total canvas dimensions */
    const totalHeight = Math.max(graph.rungs.length * RUNG_OFFSET + CANVAS_PADDING * 2.5, 400);
    const totalWidth = COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH + CANVAS_PADDING * 2;
    const leftRailX = CANVAS_PADDING;
    const rightRailX = CANVAS_PADDING + COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH;
    // Find power rails
    const leftRail = graph.nodes.find((n) => {
        if (n.type !== 'node:powerrail')
            return false;
        return n.side === nodes_1.PowerRailSide.Left;
    });
    const rightRail = graph.nodes.find((n) => {
        if (n.type !== 'node:powerrail')
            return false;
        return n.side === nodes_1.PowerRailSide.Right;
    });
    // Build rung positions
    const rungYXs = graph.rungs.map((r, i) => ({
        rung: r,
        y: CANVAS_PADDING + i * RUNG_OFFSET,
        idx: i,
    }));
    // Render a specific node
    const renderNode = (node, onRung) => {
        const isSelected = node.id === selectedId;
        const isHovered = node.id === hoveredId;
        // Convert model position to canvas coordinates
        const cx = CANVAS_PADDING + (onRung ? node.position.x : node.position.x);
        // Find which rung this element belongs to
        let cy = node.position.y + CANVAS_PADDING;
        if (onRung) {
            const rung = graph.rungs.find((r) => r.elementIds.includes(node.id));
            if (rung) {
                const rungIdx = graph.rungs.indexOf(rung);
                cy = CANVAS_PADDING + rungIdx * RUNG_OFFSET + RUNG_OFFSET / 2;
            }
        }
        switch (node.type) {
            case 'node:powerrail':
                return renderPowerRail(node, isSelected, isHovered);
            case 'node:contact':
                return renderContact(node, cx, cy, isSelected, isHovered);
            case 'node:coil':
                return renderCoil(node, cx, cy, isSelected, isHovered);
            case 'node:fb':
                return renderFb(node, cx, cy, isSelected, isHovered);
            default:
                return null;
        }
    };
    const renderPowerRail = (rail, isSelected, isHovered) => {
        const x = rail.side === nodes_1.PowerRailSide.Left ? leftRailX : rightRailX;
        return (react_1.default.createElement("line", { key: rail.id, "data-element-id": rail.id, x1: x, y1: CANVAS_PADDING, x2: x, y2: totalHeight - CANVAS_PADDING, stroke: isSelected ? 'var(--ld-selection-color)' : 'var(--ld-power-rail-color)', strokeWidth: isHovered ? RAIL_WIDTH + 2 : RAIL_WIDTH, strokeLinecap: "round", onClick: (e) => handleElementClick(rail.id, e), onMouseEnter: () => handleElementHover(rail.id), onMouseLeave: handleElementUnhover, style: { cursor: 'pointer' } }));
    };
    const renderContact = (contact, cx, cy, isSelected, isHovered) => {
        const half = CONTACT_SIZE / 2;
        const x = cx + CONTACT_SIZE / 2;
        const y = cy;
        return (react_1.default.createElement("g", { key: contact.id, "data-element-id": contact.id, onClick: (e) => handleElementClick(contact.id, e), onMouseEnter: () => handleElementHover(contact.id), onMouseLeave: handleElementUnhover, style: { cursor: 'pointer' } },
            isSelected && (react_1.default.createElement("rect", { x: x - half - 4, y: y - half - 4, width: CONTACT_SIZE + 8, height: CONTACT_SIZE + 8, fill: "none", stroke: "var(--ld-selection-color)", strokeWidth: 2, strokeDasharray: "4 2" })),
            react_1.default.createElement("rect", { x: x - half, y: y - half, width: CONTACT_SIZE, height: CONTACT_SIZE, fill: isHovered ? 'var(--ld-contact-no-fill)' : 'transparent', fillOpacity: isHovered ? 0.3 : 0, stroke: isSelected ? 'var(--ld-selection-color)' : contact.contactType === nodes_1.ContactType.NO
                    ? 'var(--ld-contact-no-fill)' : 'var(--ld-contact-nc-fill)', strokeWidth: 2, rx: 4 }),
            react_1.default.createElement("line", { x1: x - half + 6, y1: y, x2: x + half - 6, y2: y, stroke: contact.contactType === nodes_1.ContactType.NO
                    ? 'var(--ld-contact-no-fill)' : 'var(--ld-contact-nc-fill)', strokeWidth: 2 }),
            contact.contactType === nodes_1.ContactType.NO && (react_1.default.createElement("line", { x1: x, y1: y - half + 6, x2: x, y2: y + half - 6, stroke: "var(--ld-contact-no-fill)", strokeWidth: 2 })),
            contact.contactType === nodes_1.ContactType.NC && (react_1.default.createElement("line", { x1: x, y1: y - half + 6, x2: x + half - 6, y2: y + half - 6, stroke: "var(--ld-contact-nc-fill)", strokeWidth: 2 })),
            react_1.default.createElement("text", { x: x, y: y + half + 14, textAnchor: "middle", fontSize: 10, fill: "var(--ld-rung-label-color)" }, contact.variableName)));
    };
    const renderCoil = (coil, cx, cy, isSelected, isHovered) => {
        const half = CONTACT_SIZE / 2;
        const x = cx + CONTACT_SIZE / 2;
        const y = cy;
        const coilColor = coil.coilType === nodes_1.CoilType.Normal ? 'var(--ld-coil-normal-fill)' :
            coil.coilType === nodes_1.CoilType.Set ? 'var(--ld-coil-set-fill)' :
                coil.coilType === nodes_1.CoilType.Reset ? 'var(--ld-coil-reset-fill)' :
                    'var(--ld-coil-normal-fill)'; // Negated uses same as normal + slash
        return (react_1.default.createElement("g", { key: coil.id, "data-element-id": coil.id, onClick: (e) => handleElementClick(coil.id, e), onMouseEnter: () => handleElementHover(coil.id), onMouseLeave: handleElementUnhover, style: { cursor: 'pointer' } },
            isSelected && (react_1.default.createElement("rect", { x: x - half - 4, y: y - half - 4, width: CONTACT_SIZE + 8, height: CONTACT_SIZE + 8, fill: "none", stroke: "var(--ld-selection-color)", strokeWidth: 2, strokeDasharray: "4 2" })),
            react_1.default.createElement("rect", { x: x - half, y: y - half, width: CONTACT_SIZE, height: CONTACT_SIZE, fill: isHovered ? coilColor : 'transparent', fillOpacity: isHovered ? 0.3 : 0, stroke: isSelected ? 'var(--ld-selection-color)' : coilColor, strokeWidth: 2, rx: 18 }),
            coil.coilType === nodes_1.CoilType.Negated && (react_1.default.createElement("line", { x1: x - half + 6, y1: y + half - 6, x2: x + half - 6, y2: y - half + 6, stroke: coilColor, strokeWidth: 1.5 })),
            coil.coilType === nodes_1.CoilType.Set && (react_1.default.createElement("text", { x: x, y: y + 5, textAnchor: "middle", fontSize: 14, fontWeight: "bold", fill: coilColor }, "S")),
            coil.coilType === nodes_1.CoilType.Reset && (react_1.default.createElement("text", { x: x, y: y + 5, textAnchor: "middle", fontSize: 14, fontWeight: "bold", fill: coilColor }, "R")),
            react_1.default.createElement("text", { x: x, y: y + half + 14, textAnchor: "middle", fontSize: 10, fill: "var(--ld-rung-label-color)" }, coil.variableName)));
    };
    const renderFb = (fb, cx, cy, isSelected, isHovered) => {
        const w = 120;
        const h = Math.max(40 + (fb.inputPins.length + fb.outputPins.length) * 16, 60);
        const x = cx;
        const y = cy - h / 2;
        return (react_1.default.createElement("g", { key: fb.id, "data-element-id": fb.id, onClick: (e) => handleElementClick(fb.id, e), onMouseEnter: () => handleElementHover(fb.id), onMouseLeave: handleElementUnhover, style: { cursor: 'pointer' } },
            isSelected && (react_1.default.createElement("rect", { x: x - 4, y: y - 4, width: w + 8, height: h + 8, fill: "none", stroke: "var(--ld-selection-color)", strokeWidth: 2, strokeDasharray: "4 2" })),
            react_1.default.createElement("rect", { x: x, y: y, width: w, height: h, fill: isHovered ? 'var(--ld-fb-stroke)' : 'var(--ld-fb-fill)', fillOpacity: isHovered ? 0.1 : 1, stroke: "var(--ld-fb-stroke)", strokeWidth: 2, rx: 6 }),
            react_1.default.createElement("text", { x: x + w / 2, y: y + h / 2 + 4, textAnchor: "middle", fontSize: 12, fill: "var(--ld-fb-stroke)", fontWeight: "bold" }, fb.fbType),
            fb.inputPins.map((pin, i) => (react_1.default.createElement("text", { key: `in-${pin.name}`, x: x + 6, y: y + 16 + i * 16, fontSize: 9, fill: "var(--ld-rung-label-color)" }, pin.name))),
            fb.outputPins.map((pin, i) => (react_1.default.createElement("text", { key: `out-${pin.name}`, x: x + w - 6, y: y + 16 + i * 16, fontSize: 9, fill: "var(--ld-rung-label-color)", textAnchor: "end" }, pin.name)))));
    };
    // ── Render Edges ───────────────────────────────────────────
    const renderEdges = () => {
        // Build wire connections per rung
        return graph.edges.map((edge) => {
            const source = nodeMap.get(edge.sourceId);
            const target = nodeMap.get(edge.targetId);
            if (!source || !target)
                return null;
            // ponytail: simple straight-line wires, T2a.4 layout engine replaces
            let x1, x2, y1, y2;
            if (source.type === 'node:powerrail') {
                const railX = source.side === nodes_1.PowerRailSide.Left
                    ? leftRailX : rightRailX;
                x1 = railX;
                const trY = getElementY(target);
                y1 = trY;
                x2 = getElementX(target);
                y2 = trY;
            }
            else if (target.type === 'node:powerrail') {
                x1 = getElementX(source);
                const srcY = getElementY(source);
                y1 = srcY;
                const railX = target.side === nodes_1.PowerRailSide.Left
                    ? leftRailX : rightRailX;
                x2 = railX;
                y2 = srcY;
            }
            else {
                x1 = getElementX(source) + CONTACT_SIZE;
                const srcY = getElementY(source);
                y1 = srcY;
                x2 = getElementX(target);
                y2 = getElementY(target);
            }
            return (react_1.default.createElement("line", { key: edge.id, "data-element-id": edge.id, x1: x1, y1: y1, x2: x2, y2: y2, stroke: "var(--ld-wire-color)", strokeWidth: 1.5 }));
        });
    };
    const getElementY = (node) => {
        const rung = graph.rungs.find((r) => r.elementIds.includes(node.id));
        if (rung) {
            const idx = graph.rungs.indexOf(rung);
            return CANVAS_PADDING + idx * RUNG_OFFSET + RUNG_OFFSET / 2;
        }
        return node.position.y + CANVAS_PADDING + CONTACT_SIZE / 2;
    };
    const getElementX = (node) => {
        if (node.type === 'node:powerrail') {
            return node.side === nodes_1.PowerRailSide.Left
                ? leftRailX : rightRailX;
        }
        return CANVAS_PADDING + node.position.x + CONTACT_SIZE / 2;
    };
    // ── Render ─────────────────────────────────────────────────
    const isToolActive = toolType !== null;
    return (react_1.default.createElement("div", { className: `ld-editor${isToolActive ? ' ld-editor--tool-active' : ''}` },
        react_1.default.createElement("svg", { width: totalWidth, height: totalHeight, onClick: handleCanvasClick, onContextMenu: handleContextMenu },
            react_1.default.createElement("defs", null,
                react_1.default.createElement("pattern", { id: "ld-grid", width: GRID_X, height: GRID_Y, patternUnits: "userSpaceOnUse" },
                    react_1.default.createElement("path", { d: `M ${GRID_X} 0 L 0 0 0 ${GRID_Y}`, fill: "none", stroke: "var(--ld-grid-color)", strokeWidth: 0.5 }))),
            react_1.default.createElement("rect", { width: "100%", height: "100%", fill: "url(#ld-grid)" }),
            leftRail && renderNode(leftRail),
            rightRail && renderNode(rightRail),
            rungYXs.map(({ rung, y }) => (react_1.default.createElement("text", { key: `label-${rung.id}`, x: CANVAS_PADDING - 10, y: y + RUNG_OFFSET / 2 + 4, textAnchor: "end", fontSize: 11, fontWeight: "bold", fill: "var(--ld-rung-label-color)" }, String(rung.rungNumber).padStart(3, '0')))),
            rungYXs.map(({ y }, i) => (i < rungYXs.length - 1 ? (react_1.default.createElement("line", { key: `sep-${i}`, x1: leftRailX + RAIL_WIDTH, x2: rightRailX - RAIL_WIDTH, y1: y + RUNG_OFFSET, y2: y + RUNG_OFFSET, stroke: "var(--ld-grid-color)", strokeWidth: 0.5, strokeDasharray: "4 4" })) : null)),
            renderEdges(),
            graph.rungs.map((rung, rungIdx) => {
                const rungY = CANVAS_PADDING + rungIdx * RUNG_OFFSET + RUNG_OFFSET / 2;
                return rung.elementIds.map((elemId) => {
                    const node = nodeMap.get(elemId);
                    if (!node)
                        return null;
                    const cx = CANVAS_PADDING + node.position.x;
                    return (react_1.default.createElement(react_1.default.Fragment, { key: elemId }, renderNode(node, true)));
                });
            })),
        contextMenu.visible && (react_1.default.createElement("div", { className: "ld-context-menu", style: { left: contextMenu.x, top: contextMenu.y } },
            contextMenu.isContact && (react_1.default.createElement("button", { className: "ld-context-menu__item", onClick: handleChangeContactType }, "Change Contact Type (NO\u2194NC)")),
            react_1.default.createElement("button", { className: "ld-context-menu__item", onClick: handleAddRung }, "Add Rung"),
            react_1.default.createElement("div", { className: "ld-context-menu__separator" }),
            contextMenu.elementId && (react_1.default.createElement("button", { className: "ld-context-menu__item ld-context-menu__item--danger", onClick: handleDeleteElement }, "Delete Element"))))));
};
// ============================================================================
// Helpers
// ============================================================================
function findRungByY(graph, y) {
    const rungIdx = Math.floor((y - CANVAS_PADDING) / RUNG_OFFSET);
    if (rungIdx >= 0 && rungIdx < graph.rungs.length) {
        return graph.rungs[rungIdx];
    }
    return undefined;
}
// ============================================================================
// Widget
// ============================================================================
class LdEditorWidget extends react_widget_1.ReactWidget {
    constructor(toolState, modelState, handler) {
        super();
        this._dirty = false;
        this.toolState = toolState;
        this.modelState = modelState;
        this.handler = handler;
        this.id = LdEditorWidget.ID;
        this.title.label = LdEditorWidget.LABEL;
        this.title.caption = 'IEC 61131-3 Ladder Diagram Editor';
        this.title.closable = true;
    }
    get dirty() {
        return this._dirty;
    }
    setSelectionCallback(fn) {
        this.onSelectionChange = fn;
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        this.injectStyles();
        this.update(); // trigger React render when manually created via new
    }
    render() {
        return react_1.default.createElement(LdEditor, {
            toolState: this.toolState,
            modelState: this.modelState,
            handler: this.handler,
            onSelectionChange: this.onSelectionChange,
            onDirtyChange: (d) => { this._dirty = d; },
        });
    }
    injectStyles() {
        const styleId = 'ld-editor-theme';
        if (document.getElementById(styleId))
            return;
        const link = document.createElement('link');
        link.id = styleId;
        link.rel = 'stylesheet';
        // ponytail: inline CSS import handled by theia build pipeline
        // The CSS is injected here as a link to the bundled asset
        this.injectCssContent();
    }
    injectCssContent() {
        const styleId = 'ld-editor-theme-css';
        if (document.getElementById(styleId))
            return;
        const style = document.createElement('style');
        style.id = styleId;
        // The CSS content is bundled; for simplicity, inject known rules
        // In production, this should be a proper CSS import
        style.textContent = `
          /* LD Editor — CSS Variables (light theme defaults) */
          .ld-editor {
            --ld-power-rail-color: #2196f3;
            --ld-contact-no-fill: #4caf50;
            --ld-contact-nc-fill: #f44336;
            --ld-coil-normal-fill: #4caf50;
            --ld-coil-set-fill: #ff9800;
            --ld-coil-reset-fill: #f44336;
            --ld-rung-label-color: #888;
            --ld-selection-color: #2196f3;
            --ld-wire-color: #666;
            --ld-grid-color: #333;
            --ld-fb-fill: #37474f;
            --ld-fb-stroke: #4caf50;
            width:100%; height:100%; overflow:auto; background:var(--theia-editor-background,#1e1e1e); cursor:default;
          }
          /* Dark theme overrides */
          .theia-dark .ld-editor, .theia-dark.ld-editor {
            --ld-power-rail-color: #64b5f6;
            --ld-contact-no-fill: #81c784;
            --ld-wire-color: #888;
            --ld-grid-color: #555;
            --ld-rung-label-color: #aaa;
            --ld-fb-fill: #455a64;
          }
          .ld-editor svg { display:block; min-width:100%; min-height:100%; }
          .ld-editor--tool-active { cursor:crosshair; }
          .ld-context-menu { position:fixed; z-index:10000; background:var(--theia-menu-background,#252526); border:1px solid var(--theia-menu-border,#454545); border-radius:4px; padding:4px 0; min-width:160px; box-shadow:0 2px 8px rgba(0,0,0,0.36); }
          .ld-context-menu__item { display:block; width:100%; padding:4px 24px; border:none; background:transparent; color:var(--theia-menu-foreground,#ccc); font-size:12px; text-align:left; cursor:pointer; white-space:nowrap; }
          .ld-context-menu__item:hover { background:var(--theia-menu-selectionBackground,#094771); }
          .ld-context-menu__item--danger { color:var(--theia-inputValidation-errorBorder,#f44747); }
          .ld-context-menu__separator { height:1px; margin:4px 0; background:var(--theia-menu-separatorBackground,#454545); }
        `;
        document.head.appendChild(style);
    }
}
exports.LdEditorWidget = LdEditorWidget;
LdEditorWidget.ID = 'audesys-ld-editor';
LdEditorWidget.LABEL = 'Ladder Diagram';
//# sourceMappingURL=ld-editor-widget.js.map