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

import React from 'react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { FbdToolState, FbdToolType } from '../tool-palette/fbd-tool-state';
import { FbdGModelState } from '../server/fbd-gmodel-state';
import { FbdOperationHandler, CompileResult } from '../server/fbd-operation-handler';
import { FbdGraph } from '../gmodel/model';
import { BaseNode, GateNode, FunctionBlockNode, Point, GateType } from '../gmodel/nodes';
import { BaseEdge, SignalEdge } from '../gmodel/edges';

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

// ============================================================================
// Selection State
// ============================================================================

export interface FbdEditorSelection {
    elementId: string;
    elementType: string;
}

// ============================================================================
// Context Menu State
// ============================================================================

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    elementId: string | null;
    isGate: boolean;
}

// ============================================================================
// React Component
// ============================================================================

interface EditorProps {
    toolState: FbdToolState;
    modelState: FbdGModelState;
    handler: FbdOperationHandler;
    onSelectionChange?: (sel: FbdEditorSelection | null) => void;
    onDirtyChange?: (dirty: boolean) => void;
    onCompileResult?: (result: CompileResult) => void;
}

const FbdEditor: React.FC<EditorProps> = ({
    toolState, modelState, handler, onSelectionChange, onDirtyChange, onCompileResult,
}) => {
    const [graph, setGraph] = React.useState<FbdGraph>(modelState.graph);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [hoveredId, setHoveredId] = React.useState<string | null>(null);
    const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({
        visible: false, x: 0, y: 0, elementId: null, isGate: false,
    });
    const [toolType, setToolType] = React.useState<FbdToolType | null>(null);
    const [wireStart, setWireStart] = React.useState<{ nodeId: string; portName: string } | null>(null);

    // Sync tool selection
    React.useEffect(() => {
        const sub = toolState.onDidChangeTool((t: FbdToolType | null) => {
            setToolType(t);
            if (t !== 'wire') setWireStart(null);
        });
        return () => sub.dispose();
    }, [toolState]);

    const refreshGraph = (g: FbdGraph): void => {
        setGraph(g);
        if (onDirtyChange) onDirtyChange(modelState.dirty);
    };

    // Selection notification
    React.useEffect(() => {
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
    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>): void => {
        if (e.button !== 0) return;

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
            if (!ctm) return;
            const world = pt.matrixTransform(ctm.inverse());

            // ponytail: snap to grid
            const snapped: Point = {
                x: Math.round((world.x - CANVAS_PADDING) / GRID_X) * GRID_X,
                y: Math.round((world.y - CANVAS_PADDING) / GRID_Y) * GRID_Y,
            };

            try {
                let next: FbdGraph;
                switch (toolType) {
                    case 'and-gate':
                        next = handler.createGate(graph, { gateType: GateType.AND, position: snapped });
                        break;
                    case 'or-gate':
                        next = handler.createGate(graph, { gateType: GateType.OR, position: snapped });
                        break;
                    case 'xor-gate':
                        next = handler.createGate(graph, { gateType: GateType.XOR, position: snapped });
                        break;
                    case 'not-gate':
                        next = handler.createGate(graph, { gateType: GateType.NOT, position: snapped });
                        break;
                    case 'mux-gate':
                        next = handler.createGate(graph, { gateType: GateType.MUX, position: snapped });
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
            } catch { /* ponytail: silently ignore validation errors */ }
            toolState.deselectTool();
            return;
        }

        setSelectedId(null);
    };

    // ── Element Click ──────────────────────────────────────────
    const handleElementClick = (elementId: string, e: React.MouseEvent): void => {
        e.stopPropagation();

        // Wire tool: clicking a node starts or completes a connection
        if (toolType === 'wire') {
            const node = graph.nodes.find((n) => n.id === elementId);
            if (!node) return;

            if (!wireStart) {
                // Start wire from first output pin
                const outPins = 'outputPorts' in node ? (node as GateNode | FunctionBlockNode).outputPorts : [];
                if (outPins.length > 0) {
                    setWireStart({ nodeId: elementId, portName: outPins[0].name });
                }
            } else {
                // Complete wire to this node's first input pin
                const inPins = 'inputPorts' in node ? (node as GateNode | FunctionBlockNode).inputPorts : [];
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
                    } catch { /* ignore */ }
                }
                setWireStart(null);
                toolState.deselectTool();
            }
            return;
        }

        setSelectedId(elementId);
        if (toolType) toolState.deselectTool();
    };

    // ── Right-Click Context Menu ───────────────────────────────
    const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>): void => {
        e.preventDefault();
        const target = e.target as SVGElement;
        const elementEl = target.closest('[data-element-id]') as SVGElement | null;

        if (elementEl) {
            const elementId = elementEl.getAttribute('data-element-id')!;
            const node = graph.nodes.find((n) => n.id === elementId);
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                elementId,
                isGate: node?.type === 'node:gate',
            });
            setSelectedId(elementId);
        } else {
            setContextMenu({ ...contextMenu, visible: false });
        }
    };

    const handleDeleteElement = (): void => {
        if (!contextMenu.elementId) return;
        try {
            const next = handler.deleteElement(graph, { elementId: contextMenu.elementId });
            modelState.applyOperation(() => next);
            refreshGraph(next);
            setSelectedId(null);
        } catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };

    const handleChangeGateType = (): void => {
        if (!contextMenu.elementId) return;
        try {
            const node = graph.nodes.find((n) => n.id === contextMenu.elementId) as GateNode | undefined;
            if (!node) return;
            // Cycle: AND → OR → XOR → AND
            const cycle: GateType[] = [GateType.AND, GateType.OR, GateType.XOR];
            const idx = cycle.indexOf(node.gateType);
            const nextType = cycle[(idx + 1) % cycle.length];
            const next = handler.changeGateType(graph, { elementId: contextMenu.elementId, newGateType: nextType });
            modelState.applyOperation(() => next);
            refreshGraph(next);
        } catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };

    const handleCompile = (): void => {
        const result = handler.compile(graph);
        onCompileResult?.(result);
        setContextMenu({ ...contextMenu, visible: false });
    };

    // Close context menu on outside click
    const handleGlobalClick = (): void => {
        if (contextMenu.visible) {
            setContextMenu({ ...contextMenu, visible: false });
        }
    };
    React.useEffect(() => {
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [contextMenu.visible]);

    // ── Hover ──────────────────────────────────────────────────
    const handleElementHover = (elementId: string): void => {
        setHoveredId(elementId);
    };
    const handleElementUnhover = (): void => {
        setHoveredId(null);
    };

    // ── Node Map ───────────────────────────────────────────────
    const nodeMap = new Map<string, BaseNode>();
    for (const n of graph.nodes) nodeMap.set(n.id, n);

    // ── Canvas Bounds ──────────────────────────────────────────
    const nodeBounds = graph.nodes.reduce(
        (acc, n) => ({
            maxX: Math.max(acc.maxX, n.position.x + n.size.width),
            maxY: Math.max(acc.maxY, n.position.y + n.size.height),
        }),
        { maxX: 0, maxY: 0 },
    );
    const totalWidth = Math.max(nodeBounds.maxX + CANVAS_PADDING * 2, 800);
    const totalHeight = Math.max(nodeBounds.maxY + CANVAS_PADDING * 2, 600);

    // ── Gate Rendering ─────────────────────────────────────────
    const renderGate = (
        gate: GateNode, cx: number, cy: number, isSelected: boolean, isHovered: boolean,
    ): React.ReactNode => {
        const s = gate.size.width;
        const hs = s / 2;
        const x = cx + CANVAS_PADDING;
        const y = cy + CANVAS_PADDING;

        let shapePath: string;
        let label: string;

        switch (gate.gateType) {
            case GateType.AND:
                // Flat left + rounded right (D-shape)
                shapePath = `M ${x} ${y} L ${x + hs} ${y} Q ${x + s} ${y} ${x + s} ${y + hs} Q ${x + s} ${y + s} ${x + hs} ${y + s} L ${x} ${y + s} Z`;
                label = '&';
                break;
            case GateType.OR:
                // Pointed arc shape (curved both sides, pointed top/bottom)
                shapePath = `M ${x + 4} ${y} Q ${x + hs} ${y + 4} ${x + s} ${y + hs} Q ${x + hs} ${y + s - 4} ${x + 4} ${y + s}`;
                // ponytail: approximate OR shape with an ellipse
                shapePath = `M ${x + 8} ${y} Q ${x + hs} ${y - 4} ${x + s} ${y + hs} Q ${x + hs} ${y + s + 4} ${x + 8} ${y + s}`;
                label = '\u22651';
                break;
            case GateType.XOR:
                // Same shape as OR, different label
                shapePath = `M ${x + 8} ${y} Q ${x + hs} ${y - 4} ${x + s} ${y + hs} Q ${x + hs} ${y + s + 4} ${x + 8} ${y + s}`;
                label = '=1';
                break;
            case GateType.NOT:
                // Triangle pointing right + small circle at output
                shapePath = `M ${x} ${y} L ${x + s - 6} ${y + hs} L ${x} ${y + s} Z`;
                label = '1';
                break;
            case GateType.MUX:
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

        return (
            <g
                key={gate.id}
                data-element-id={gate.id}
                onClick={(e) => handleElementClick(gate.id, e)}
                onMouseEnter={() => handleElementHover(gate.id)}
                onMouseLeave={handleElementUnhover}
                style={{ cursor: toolType === 'wire' ? 'crosshair' : 'pointer' }}
            >
                {/* Selection highlight */}
                {isSelected && (
                    <rect
                        x={x - 4} y={y - 4}
                        width={s + 8} height={s + 8}
                        fill="none"
                        stroke="var(--fbd-selection-color)"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                    />
                )}
                {/* Gate body */}
                <path d={shapePath} fill={fillColor} stroke={strokeColor} strokeWidth={2} />
                {/* Gate label */}
                <text x={x + s / 2} y={y + s / 2 + 4} textAnchor="middle" fontSize={12}
                    fill="var(--fbd-gate-label-color)" fontWeight="bold"
                    style={{ pointerEvents: 'none' }}>
                    {label}
                </text>
                {/* NOT gate: small circle at output */}
                {gate.gateType === GateType.NOT && (
                    <circle cx={x + s - 2} cy={y + hs} r={4} fill="var(--fbd-gate-fill)"
                        stroke={strokeColor} strokeWidth={2} />
                )}
                {/* Input pins (left edge) */}
                {gate.inputPorts.map((pin, i) => {
                    const px = x;
                    const py = y + 10 + i * FB_PIN_SPACING;
                    return (
                        <g key={`pin-in-${pin.name}`}>
                            <circle cx={px} cy={py} r={3} fill={strokeColor}
                                stroke="var(--fbd-pin-border)" strokeWidth={1} />
                            <text x={px - 4} y={py + 4} textAnchor="end" fontSize={8}
                                fill="var(--fbd-pin-label-color)" style={{ pointerEvents: 'none' }}>
                                {pin.name}
                            </text>
                        </g>
                    );
                })}
                {/* Output pin (right edge) */}
                {gate.outputPorts.map((pin, i) => {
                    const px = x + s;
                    const py = y + 10 + i * FB_PIN_SPACING;
                    return (
                        <g key={`pin-out-${pin.name}`}>
                            <circle cx={px} cy={py} r={3} fill={strokeColor}
                                stroke="var(--fbd-pin-border)" strokeWidth={1} />
                            <text x={px + 4} y={py + 4} textAnchor="start" fontSize={8}
                                fill="var(--fbd-pin-label-color)" style={{ pointerEvents: 'none' }}>
                                {pin.name}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    };

    // ── Function Block Rendering ───────────────────────────────
    const renderFunctionBlock = (
        fb: FunctionBlockNode, cx: number, cy: number, isSelected: boolean, isHovered: boolean,
    ): React.ReactNode => {
        const w = fb.size.width;
        const h = fb.size.height;
        const x = cx + CANVAS_PADDING;
        const y = cy + CANVAS_PADDING;

        const strokeColor = isSelected
            ? 'var(--fbd-selection-color)'
            : isHovered ? 'var(--fbd-hover-color)' : 'var(--fbd-fb-stroke)';

        return (
            <g
                key={fb.id}
                data-element-id={fb.id}
                onClick={(e) => handleElementClick(fb.id, e)}
                onMouseEnter={() => handleElementHover(fb.id)}
                onMouseLeave={handleElementUnhover}
                style={{ cursor: toolType === 'wire' ? 'crosshair' : 'pointer' }}
            >
                {isSelected && (
                    <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8}
                        fill="none" stroke="var(--fbd-selection-color)"
                        strokeWidth={2} strokeDasharray="4 2" />
                )}
                <rect x={x} y={y} width={w} height={h}
                    fill={isHovered ? 'var(--fbd-fb-fill-hover)' : 'var(--fbd-fb-fill)'}
                    stroke={strokeColor} strokeWidth={2} rx={4} />
                <text x={x + w / 2} y={y + 14} textAnchor="middle" fontSize={11}
                    fill="var(--fbd-fb-stroke)" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    {fb.fbType}
                </text>
                <line x1={x} y1={y + 20} x2={x + w} y2={y + 20}
                    stroke={strokeColor} strokeWidth={0.5} />
                {/* Input pins */}
                {fb.inputPorts.map((pin, i) => {
                    const px = x;
                    const py = y + 30 + i * FB_PIN_SPACING;
                    return (
                        <g key={`fb-in-${pin.name}`}>
                            <circle cx={px} cy={py} r={3} fill={strokeColor}
                                stroke="var(--fbd-pin-border)" strokeWidth={1} />
                            <text x={px - 4} y={py + 4} textAnchor="end" fontSize={8}
                                fill="var(--fbd-pin-label-color)" style={{ pointerEvents: 'none' }}>
                                {pin.name}
                            </text>
                        </g>
                    );
                })}
                {/* Output pins */}
                {fb.outputPorts.map((pin, i) => {
                    const px = x + w;
                    const py = y + 30 + i * FB_PIN_SPACING;
                    return (
                        <g key={`fb-out-${pin.name}`}>
                            <circle cx={px} cy={py} r={3} fill={strokeColor}
                                stroke="var(--fbd-pin-border)" strokeWidth={1} />
                            <text x={px + 4} y={py + 4} textAnchor="start" fontSize={8}
                                fill="var(--fbd-pin-label-color)" style={{ pointerEvents: 'none' }}>
                                {pin.name}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    };

    // ── Signal Edge Rendering ─────────────────────────────────
    const renderEdge = (edge: BaseEdge): React.ReactNode => {
        const source = nodeMap.get(edge.sourceId);
        const target = nodeMap.get(edge.targetId);
        if (!source || !target) return null;

        const sigEdge = edge as SignalEdge;

        // Get pin positions
        const srcPin = getPinWorldPos(source, edge.sourcePortName, 'output');
        const tgtPin = getPinWorldPos(target, edge.targetPortName, 'input');

        let pathD: string;

        if (sigEdge.routingPoints && sigEdge.routingPoints.length > 0) {
            // Use manual routing points
            const pts = [srcPin, ...sigEdge.routingPoints.map((rp) => ({
                x: rp.x + CANVAS_PADDING,
                y: rp.y + CANVAS_PADDING,
            })), tgtPin];
            pathD = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
        } else {
            // ponytail: orthogonal auto-route (two 90° bends)
            const midX = (srcPin.x + tgtPin.x) / 2;
            pathD = `M ${srcPin.x} ${srcPin.y} L ${midX} ${srcPin.y} L ${midX} ${tgtPin.y} L ${tgtPin.x} ${tgtPin.y}`;
        }

        return (
            <path
                key={edge.id}
                data-element-id={edge.id}
                d={pathD}
                fill="none"
                stroke="var(--fbd-wire-color)"
                strokeWidth={1.5}
                markerEnd="url(#fbd-arrow)"
            />
        );
    };

    // ── Helper: get pin position in world (canvas) coordinates ─
    const getPinWorldPos = (node: BaseNode, portName: string, side: 'input' | 'output'): Point => {
        const pins = side === 'input'
            ? (node as GateNode | FunctionBlockNode).inputPorts
            : (node as GateNode | FunctionBlockNode).outputPorts;
        const pinIdx = pins?.findIndex((p) => p.name === portName) ?? 0;
        const spacing = FB_PIN_SPACING;

        if (node.type === 'node:gate') {
            const s = node.size.width;
            const pyBase = CANVAS_PADDING + node.position.y + 10;
            if (side === 'input') {
                return { x: CANVAS_PADDING + node.position.x, y: pyBase + pinIdx * spacing };
            } else {
                return { x: CANVAS_PADDING + node.position.x + s, y: pyBase + pinIdx * spacing };
            }
        } else if (node.type === 'node:fb') {
            const fb = node as FunctionBlockNode;
            const pyBase = CANVAS_PADDING + node.position.y + 30;
            if (side === 'input') {
                return { x: CANVAS_PADDING + node.position.x, y: pyBase + pinIdx * spacing };
            } else {
                return { x: CANVAS_PADDING + node.position.x + fb.size.width, y: pyBase + pinIdx * spacing };
            }
        }
        return { x: 0, y: 0 };
    };

    // ── Render ─────────────────────────────────────────────────
    const isToolActive = toolType !== null;

    return (
        <div className={`fbd-editor${isToolActive ? ' fbd-editor--tool-active' : ''}`}>
            <svg
                width={totalWidth}
                height={totalHeight}
                onClick={handleCanvasClick}
                onContextMenu={handleContextMenu}
            >
                {/* Arrow marker for signal edges */}
                <defs>
                    <marker id="fbd-arrow" viewBox="0 0 8 8" refX={8} refY={4}
                        markerWidth={6} markerHeight={6} orient="auto-start-reverse">
                        <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--fbd-wire-color)" />
                    </marker>
                    <pattern id="fbd-grid" width={GRID_X} height={GRID_Y} patternUnits="userSpaceOnUse">
                        <path d={`M ${GRID_X} 0 L 0 0 0 ${GRID_Y}`} fill="none"
                            stroke="var(--fbd-grid-color)" strokeWidth={0.5} />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#fbd-grid)" />

                {/* Edges (rendered below nodes) */}
                {graph.edges.map(renderEdge)}

                {/* Nodes */}
                {graph.nodes.map((node) => {
                    const cx = node.position.x;
                    const cy = node.position.y;
                    const isSelected = node.id === selectedId;
                    const isHovered = node.id === hoveredId;

                    if (node.type === 'node:gate') {
                        return renderGate(node as GateNode, cx, cy, isSelected, isHovered);
                    } else if (node.type === 'node:fb') {
                        return renderFunctionBlock(node as FunctionBlockNode, cx, cy, isSelected, isHovered);
                    }
                    return null;
                })}

                {/* Wire preview while connecting */}
                {wireStart && (
                    <line
                        x1={getPinWorldPos(nodeMap.get(wireStart.nodeId)!, wireStart.portName, 'output').x}
                        y1={getPinWorldPos(nodeMap.get(wireStart.nodeId)!, wireStart.portName, 'output').y}
                        x2={
                            // ponytail: show wire following mouse is complex in SVG onClick;
                            // instead, highlight the start node's output
                            getPinWorldPos(nodeMap.get(wireStart.nodeId)!, wireStart.portName, 'output').x + 30
                        }
                        y2={getPinWorldPos(nodeMap.get(wireStart.nodeId)!, wireStart.portName, 'output').y}
                        stroke="var(--fbd-wire-color)" strokeWidth={2} strokeDasharray="6 3"
                    />
                )}
            </svg>

            {/* Context Menu */}
            {contextMenu.visible && (
                <div className="fbd-context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}>
                    {contextMenu.isGate && (
                        <button className="fbd-context-menu__item"
                            onClick={handleChangeGateType}>
                            Change Gate Type
                        </button>
                    )}
                    <button className="fbd-context-menu__item"
                        onClick={handleCompile}>
                        Compile (FBD→IL→HalProgram)
                    </button>
                    <div className="fbd-context-menu__separator" />
                    {contextMenu.elementId && (
                        <button className="fbd-context-menu__item fbd-context-menu__item--danger"
                            onClick={handleDeleteElement}>
                            Delete Element
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Widget
// ============================================================================

export class FbdEditorWidget extends ReactWidget {
    static readonly ID = 'audesys-fbd-editor';
    static readonly LABEL = 'Function Block Diagram';

    private readonly toolState: FbdToolState;
    private readonly modelState: FbdGModelState;
    private readonly handler: FbdOperationHandler;
    private onSelectionChange?: (sel: FbdEditorSelection | null) => void;
    private _dirty: boolean = false;
    private _compileResult: CompileResult | null = null;

    constructor(
        toolState: FbdToolState,
        modelState: FbdGModelState,
        handler: FbdOperationHandler,
    ) {
        super();
        this.toolState = toolState;
        this.modelState = modelState;
        this.handler = handler;
        this.id = FbdEditorWidget.ID;
        this.title.label = FbdEditorWidget.LABEL;
        this.title.caption = 'IEC 61131-3 Function Block Diagram Editor';
        this.title.closable = true;
    }

    get dirty(): boolean { return this._dirty; }
    get compileResult(): CompileResult | null { return this._compileResult; }

    setSelectionCallback(fn: (sel: FbdEditorSelection | null) => void): void {
        this.onSelectionChange = fn;
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.injectStyles();
        this.update(); // trigger React render when manually created via new
    }

    protected render(): React.ReactNode {
        return React.createElement(FbdEditor, {
            toolState: this.toolState,
            modelState: this.modelState,
            handler: this.handler,
            onSelectionChange: this.onSelectionChange,
            onDirtyChange: (d: boolean) => { this._dirty = d; },
            onCompileResult: (r: CompileResult) => { this._compileResult = r; },
        });
    }

    private injectStyles(): void {
        const styleId = 'fbd-editor-theme-css';
        if (document.getElementById(styleId)) return;
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
