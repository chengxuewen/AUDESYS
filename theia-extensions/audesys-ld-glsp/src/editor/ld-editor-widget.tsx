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

import React from 'react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { LdToolState, LdToolType } from '../tool-palette/ld-tool-state';
import { LdGModelState } from '../server/ld-gmodel-state';
import { LdOperationHandler, AddContactParams, AddCoilParams, DeleteElementParams, ChangeContactTypeParams } from '../server/ld-operation-handler';
import { LdGraph, Rung } from '../gmodel/model';
import { BaseNode, ContactNode, CoilNode, PowerRailNode, FbPlaceholderNode, Point, ContactType, CoilType, PowerRailSide } from '../gmodel/nodes';
import { BaseEdge, WireConnection, PowerConnection } from '../gmodel/edges';

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

// ============================================================================
// Selection State
// ============================================================================

export interface LdEditorSelection {
    elementId: string;
    elementType: string;
    rungId?: string;
}

// ============================================================================
// Context Menu Items
// ============================================================================

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    elementId: string | null;
    isContact: boolean;
}

// ============================================================================
// React Component
// ============================================================================

interface EditorProps {
    toolState: LdToolState;
    modelState: LdGModelState;
    handler: LdOperationHandler;
    onSelectionChange?: (sel: LdEditorSelection | null) => void;
    onDirtyChange?: (dirty: boolean) => void;
}

const LdEditor: React.FC<EditorProps> = ({ toolState, modelState, handler, onSelectionChange, onDirtyChange }) => {
    const [graph, setGraph] = React.useState<LdGraph>(modelState.graph);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [hoveredId, setHoveredId] = React.useState<string | null>(null);
    const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({
        visible: false, x: 0, y: 0, elementId: null, isContact: false,
    });
    const [toolType, setToolType] = React.useState<LdToolType | null>(null);

    // Sync tool selection
    React.useEffect(() => {
        const sub = toolState.onDidChangeTool((t: LdToolType | null) => {
            setToolType(t);
        });
        return () => sub.dispose();
    }, [toolState]);

    // Refresh graph + notify dirty on re-render
    const refreshGraph = (g: LdGraph): void => {
        setGraph(g);
        if (onDirtyChange) {
            onDirtyChange(modelState.dirty);
        }
    };

    // Selection notification
    React.useEffect(() => {
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

    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>): void => {
        // Right-click handled separately
        if (e.button !== 0) return;

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
            if (!ctm) return;
            const world = pt.matrixTransform(ctm.inverse());

            const targetRung = findRungByY(graph, world.y);
            if (!targetRung) return;

            try {
                let next: LdGraph;
                switch (toolType) {
                    case 'no-contact':
                        next = handler.addContact(graph, {
                            rungId: targetRung.id,
                            position: { x: world.x - CANVAS_PADDING, y: targetRung.rungNumber * RUNG_OFFSET },
                            type: ContactType.NO,
                        });
                        break;
                    case 'nc-contact':
                        next = handler.addContact(graph, {
                            rungId: targetRung.id,
                            position: { x: world.x - CANVAS_PADDING, y: targetRung.rungNumber * RUNG_OFFSET },
                            type: ContactType.NC,
                        });
                        break;
                    case 'coil':
                    case 'negated-coil':
                    case 'set-coil':
                    case 'reset-coil': {
                        const ct: Record<string, CoilType> = {
                            'coil': CoilType.Normal,
                            'negated-coil': CoilType.Negated,
                            'set-coil': CoilType.Set,
                            'reset-coil': CoilType.Reset,
                        };
                        next = handler.addCoil(graph, {
                            rungId: targetRung.id,
                            position: { x: world.x - CANVAS_PADDING, y: targetRung.rungNumber * RUNG_OFFSET },
                            type: ct[toolType],
                        });
                        break;
                    }
                    case 'rung':
                        next = handler.addRung(graph);
                        break;
                    default:
                        return; // Other tools not implemented in editor P1
                }
                modelState.applyOperation(() => next);
                refreshGraph(next);
            } catch (err) {
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

    const handleElementClick = (elementId: string, e: React.MouseEvent): void => {
        e.stopPropagation();
        setSelectedId(elementId);

        // If tool active and clicking an element, don't create — just select
        if (toolType) {
            toolState.deselectTool();
        }
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
                isContact: node?.type === 'node:contact',
            });
            setSelectedId(elementId);
        } else {
            setContextMenu({ ...contextMenu, visible: false });
        }
    };

    // ── Context Menu Actions ───────────────────────────────────

    const handleDeleteElement = (): void => {
        if (!contextMenu.elementId) return;
        try {
            const next = handler.deleteElement(graph, { elementId: contextMenu.elementId });
            modelState.applyOperation(() => next);
            refreshGraph(next);
        } catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };

    const handleChangeContactType = (): void => {
        if (!contextMenu.elementId) return;
        try {
            const node = graph.nodes.find((n) => n.id === contextMenu.elementId) as ContactNode | undefined;
            const newType = node?.contactType === ContactType.NO ? ContactType.NC : ContactType.NO;
            const next = handler.changeContactType(graph, {
                elementId: contextMenu.elementId,
                newType,
            });
            modelState.applyOperation(() => next);
            refreshGraph(next);
        } catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };

    const handleAddRung = (): void => {
        try {
            const next = handler.addRung(graph);
            modelState.applyOperation(() => next);
            refreshGraph(next);
        } catch { /* ignore */ }
        setContextMenu({ ...contextMenu, visible: false });
    };

    // Close context menu on any outside click
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

    // ── Render Helpers ─────────────────────────────────────────

    const nodeMap = new Map<string, BaseNode>();
    for (const n of graph.nodes) {
        nodeMap.set(n.id, n);
    }

    /** Calculate total canvas dimensions */
    const totalHeight = Math.max(
        graph.rungs.length * RUNG_OFFSET + CANVAS_PADDING * 2.5,
        400,
    );
    const totalWidth = COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH + CANVAS_PADDING * 2;

    const leftRailX = CANVAS_PADDING;
    const rightRailX = CANVAS_PADDING + COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH;

    // Find power rails
    const leftRail = graph.nodes.find(
        (n): n is PowerRailNode => {
            if (n.type !== 'node:powerrail') return false;
            return (n as PowerRailNode).side === PowerRailSide.Left;
        },
    );
    const rightRail = graph.nodes.find(
        (n): n is PowerRailNode => {
            if (n.type !== 'node:powerrail') return false;
            return (n as PowerRailNode).side === PowerRailSide.Right;
        },
    );


    // Build rung positions
    const rungYXs = graph.rungs.map((r, i) => ({
        rung: r,
        y: CANVAS_PADDING + i * RUNG_OFFSET,
        idx: i,
    }));

    // Render a specific node
    const renderNode = (node: BaseNode, onRung?: boolean): React.ReactNode => {
        const isSelected = node.id === selectedId;
        const isHovered = node.id === hoveredId;
        // Convert model position to canvas coordinates
        const cx = CANVAS_PADDING + (onRung ? node.position.x : node.position.x);
        // Find which rung this element belongs to
        let cy: number = node.position.y + CANVAS_PADDING;
        if (onRung) {
            const rung = graph.rungs.find((r) => r.elementIds.includes(node.id));
            if (rung) {
                const rungIdx = graph.rungs.indexOf(rung);
                cy = CANVAS_PADDING + rungIdx * RUNG_OFFSET + RUNG_OFFSET / 2;
            }
        }

        switch (node.type) {
            case 'node:powerrail':
                return renderPowerRail(node as PowerRailNode, isSelected, isHovered);
            case 'node:contact':
                return renderContact(node as ContactNode, cx, cy, isSelected, isHovered);
            case 'node:coil':
                return renderCoil(node as CoilNode, cx, cy, isSelected, isHovered);
            case 'node:fb':
                return renderFb(node as FbPlaceholderNode, cx, cy, isSelected, isHovered);
            default:
                return null;
        }
    };

    const renderPowerRail = (rail: PowerRailNode, isSelected: boolean, isHovered: boolean): React.ReactNode => {
        const x = rail.side === PowerRailSide.Left ? leftRailX : rightRailX;
        return (
            <line
                key={rail.id}
                data-element-id={rail.id}
                x1={x}
                y1={CANVAS_PADDING}
                x2={x}
                y2={totalHeight - CANVAS_PADDING}
                stroke={isSelected ? 'var(--ld-selection-color)' : 'var(--ld-power-rail-color)'}
                strokeWidth={isHovered ? RAIL_WIDTH + 2 : RAIL_WIDTH}
                strokeLinecap="round"
                onClick={(e) => handleElementClick(rail.id, e)}
                onMouseEnter={() => handleElementHover(rail.id)}
                onMouseLeave={handleElementUnhover}
                style={{ cursor: 'pointer' }}
            />
        );
    };

    const renderContact = (
        contact: ContactNode, cx: number, cy: number, isSelected: boolean, isHovered: boolean,
    ): React.ReactNode => {
        const half = CONTACT_SIZE / 2;
        const x = cx + CONTACT_SIZE / 2;
        const y = cy;

        return (
            <g
                key={contact.id}
                data-element-id={contact.id}
                onClick={(e) => handleElementClick(contact.id, e)}
                onMouseEnter={() => handleElementHover(contact.id)}
                onMouseLeave={handleElementUnhover}
                style={{ cursor: 'pointer' }}
            >
                {/* Selection highlight */}
                {isSelected && (
                    <rect
                        x={x - half - 4} y={y - half - 4}
                        width={CONTACT_SIZE + 8} height={CONTACT_SIZE + 8}
                        fill="none"
                        stroke="var(--ld-selection-color)"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                    />
                )}
                {/* Contact body */}
                <rect
                    x={x - half} y={y - half}
                    width={CONTACT_SIZE} height={CONTACT_SIZE}
                    fill={isHovered ? 'var(--ld-contact-no-fill)' : 'transparent'}
                    fillOpacity={isHovered ? 0.3 : 0}
                    stroke={isSelected ? 'var(--ld-selection-color)' : contact.contactType === ContactType.NO
                        ? 'var(--ld-contact-no-fill)' : 'var(--ld-contact-nc-fill)'}
                    strokeWidth={2}
                    rx={4}
                />
                {/* Contact symbol */}
                <line x1={x - half + 6} y1={y} x2={x + half - 6} y2={y}
                    stroke={contact.contactType === ContactType.NO
                        ? 'var(--ld-contact-no-fill)' : 'var(--ld-contact-nc-fill)'}
                    strokeWidth={2}
                />
                {contact.contactType === ContactType.NO && (
                    <line x1={x} y1={y - half + 6} x2={x} y2={y + half - 6}
                        stroke="var(--ld-contact-no-fill)" strokeWidth={2} />
                )}
                {contact.contactType === ContactType.NC && (
                    <line x1={x} y1={y - half + 6} x2={x + half - 6} y2={y + half - 6}
                        stroke="var(--ld-contact-nc-fill)" strokeWidth={2} />
                )}
                {/* Label */}
                <text x={x} y={y + half + 14} textAnchor="middle" fontSize={10}
                    fill="var(--ld-rung-label-color)">
                    {contact.variableName}
                </text>
            </g>
        );
    };

    const renderCoil = (
        coil: CoilNode, cx: number, cy: number, isSelected: boolean, isHovered: boolean,
    ): React.ReactNode => {
        const half = CONTACT_SIZE / 2;
        const x = cx + CONTACT_SIZE / 2;
        const y = cy;

        const coilColor =
            coil.coilType === CoilType.Normal ? 'var(--ld-coil-normal-fill)' :
            coil.coilType === CoilType.Set ? 'var(--ld-coil-set-fill)' :
            coil.coilType === CoilType.Reset ? 'var(--ld-coil-reset-fill)' :
            'var(--ld-coil-normal-fill)'; // Negated uses same as normal + slash

        return (
            <g
                key={coil.id}
                data-element-id={coil.id}
                onClick={(e) => handleElementClick(coil.id, e)}
                onMouseEnter={() => handleElementHover(coil.id)}
                onMouseLeave={handleElementUnhover}
                style={{ cursor: 'pointer' }}
            >
                {isSelected && (
                    <rect
                        x={x - half - 4} y={y - half - 4}
                        width={CONTACT_SIZE + 8} height={CONTACT_SIZE + 8}
                        fill="none"
                        stroke="var(--ld-selection-color)"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                    />
                )}
                {/* Coil body — arc shape */}
                <rect
                    x={x - half} y={y - half}
                    width={CONTACT_SIZE} height={CONTACT_SIZE}
                    fill={isHovered ? coilColor : 'transparent'}
                    fillOpacity={isHovered ? 0.3 : 0}
                    stroke={isSelected ? 'var(--ld-selection-color)' : coilColor}
                    strokeWidth={2}
                    rx={18}
                />
                {/* Coil symbol */}
                {coil.coilType === CoilType.Negated && (
                    <line x1={x - half + 6} y1={y + half - 6} x2={x + half - 6} y2={y - half + 6}
                        stroke={coilColor} strokeWidth={1.5} />
                )}
                {coil.coilType === CoilType.Set && (
                    <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight="bold"
                        fill={coilColor}>S</text>
                )}
                {coil.coilType === CoilType.Reset && (
                    <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight="bold"
                        fill={coilColor}>R</text>
                )}
                {/* Label */}
                <text x={x} y={y + half + 14} textAnchor="middle" fontSize={10}
                    fill="var(--ld-rung-label-color)">
                    {coil.variableName}
                </text>
            </g>
        );
    };

    const renderFb = (
        fb: FbPlaceholderNode, cx: number, cy: number, isSelected: boolean, isHovered: boolean,
    ): React.ReactNode => {
        const w = 120;
        const h = Math.max(40 + (fb.inputPins.length + fb.outputPins.length) * 16, 60);
        const x = cx;
        const y = cy - h / 2;

        return (
            <g
                key={fb.id}
                data-element-id={fb.id}
                onClick={(e) => handleElementClick(fb.id, e)}
                onMouseEnter={() => handleElementHover(fb.id)}
                onMouseLeave={handleElementUnhover}
                style={{ cursor: 'pointer' }}
            >
                {isSelected && (
                    <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8}
                        fill="none" stroke="var(--ld-selection-color)"
                        strokeWidth={2} strokeDasharray="4 2" />
                )}
                <rect x={x} y={y} width={w} height={h}
                    fill={isHovered ? 'var(--ld-fb-stroke)' : 'var(--ld-fb-fill)'}
                    fillOpacity={isHovered ? 0.1 : 1}
                    stroke="var(--ld-fb-stroke)" strokeWidth={2} rx={6} />
                <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={12}
                    fill="var(--ld-fb-stroke)" fontWeight="bold">
                    {fb.fbType}
                </text>
                {/* Pin labels */}
                {fb.inputPins.map((pin, i) => (
                    <text key={`in-${pin.name}`} x={x + 6} y={y + 16 + i * 16}
                        fontSize={9} fill="var(--ld-rung-label-color)">
                        {pin.name}
                    </text>
                ))}
                {fb.outputPins.map((pin, i) => (
                    <text key={`out-${pin.name}`} x={x + w - 6} y={y + 16 + i * 16}
                        fontSize={9} fill="var(--ld-rung-label-color)" textAnchor="end">
                        {pin.name}
                    </text>
                ))}
            </g>
        );
    };

    // ── Render Edges ───────────────────────────────────────────

    const renderEdges = (): React.ReactNode => {
        // Build wire connections per rung
        return graph.edges.map((edge) => {
            const source = nodeMap.get(edge.sourceId);
            const target = nodeMap.get(edge.targetId);
            if (!source || !target) return null;

            // ponytail: simple straight-line wires, T2a.4 layout engine replaces
            let x1: number, x2: number, y1: number, y2: number;

            if (source.type === 'node:powerrail') {
                const railX = (source as PowerRailNode).side === PowerRailSide.Left
                    ? leftRailX : rightRailX;
                x1 = railX;
                const trY = getElementY(target);
                y1 = trY;
                x2 = getElementX(target);
                y2 = trY;
            } else if (target.type === 'node:powerrail') {
                x1 = getElementX(source);
                const srcY = getElementY(source);
                y1 = srcY;
                const railX = (target as PowerRailNode).side === PowerRailSide.Left
                    ? leftRailX : rightRailX;
                x2 = railX;
                y2 = srcY;
            } else {
                x1 = getElementX(source) + CONTACT_SIZE;
                const srcY = getElementY(source);
                y1 = srcY;
                x2 = getElementX(target);
                y2 = getElementY(target);
            }

            return (
                <line
                    key={edge.id}
                    data-element-id={edge.id}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="var(--ld-wire-color)"
                    strokeWidth={1.5}
                />
            );
        });
    };

    const getElementY = (node: BaseNode): number => {
        const rung = graph.rungs.find((r) => r.elementIds.includes(node.id));
        if (rung) {
            const idx = graph.rungs.indexOf(rung);
            return CANVAS_PADDING + idx * RUNG_OFFSET + RUNG_OFFSET / 2;
        }
        return node.position.y + CANVAS_PADDING + CONTACT_SIZE / 2;
    };

    const getElementX = (node: BaseNode): number => {
        if (node.type === 'node:powerrail') {
            return (node as PowerRailNode).side === PowerRailSide.Left
                ? leftRailX : rightRailX;
        }
        return CANVAS_PADDING + node.position.x + CONTACT_SIZE / 2;
    };

    // ── Render ─────────────────────────────────────────────────

    const isToolActive = toolType !== null;

    return (
        <div className={`ld-editor${isToolActive ? ' ld-editor--tool-active' : ''}`}>
            <svg
                width={totalWidth}
                height={totalHeight}
                onClick={handleCanvasClick}
                onContextMenu={handleContextMenu}
            >
                {/* Grid background */}
                <defs>
                    <pattern id="ld-grid" width={GRID_X} height={GRID_Y} patternUnits="userSpaceOnUse">
                        <path d={`M ${GRID_X} 0 L 0 0 0 ${GRID_Y}`} fill="none"
                            stroke="var(--ld-grid-color)" strokeWidth={0.5} />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#ld-grid)" />

                {/* Power rails */}
                {leftRail && renderNode(leftRail)}
                {rightRail && renderNode(rightRail)}

                {/* Rung labels */}
                {rungYXs.map(({ rung, y }) => (
                    <text key={`label-${rung.id}`}
                        x={CANVAS_PADDING - 10} y={y + RUNG_OFFSET / 2 + 4}
                        textAnchor="end" fontSize={11} fontWeight="bold"
                        fill="var(--ld-rung-label-color)">
                        {String(rung.rungNumber).padStart(3, '0')}
                    </text>
                ))}

                {/* Rung separator lines */}
                {rungYXs.map(({ y }, i) => (
                    i < rungYXs.length - 1 ? (
                        <line key={`sep-${i}`}
                            x1={leftRailX + RAIL_WIDTH} x2={rightRailX - RAIL_WIDTH}
                            y1={y + RUNG_OFFSET} y2={y + RUNG_OFFSET}
                            stroke="var(--ld-grid-color)" strokeWidth={0.5} strokeDasharray="4 4" />
                    ) : null
                ))}

                {/* Wires (rendered before elements so they appear beneath) */}
                {renderEdges()}

                {/* Rung elements (contacts, coils, FBs) */}
                {graph.rungs.map((rung, rungIdx) => {
                    const rungY = CANVAS_PADDING + rungIdx * RUNG_OFFSET + RUNG_OFFSET / 2;
                    return rung.elementIds.map((elemId) => {
                        const node = nodeMap.get(elemId);
                        if (!node) return null;
                        const cx = CANVAS_PADDING + node.position.x;
                        return (
                            <React.Fragment key={elemId}>
                                {renderNode(node, true)}
                            </React.Fragment>
                        );
                    });
                })}
            </svg>

            {/* Context Menu */}
            {contextMenu.visible && (
                <div className="ld-context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}>
                    {contextMenu.isContact && (
                        <button className="ld-context-menu__item"
                            onClick={handleChangeContactType}>
                            Change Contact Type (NO↔NC)
                        </button>
                    )}
                    <button className="ld-context-menu__item"
                        onClick={handleAddRung}>
                        Add Rung
                    </button>
                    <div className="ld-context-menu__separator" />
                    {contextMenu.elementId && (
                        <button className="ld-context-menu__item ld-context-menu__item--danger"
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
// Helpers
// ============================================================================

function findRungByY(graph: LdGraph, y: number): Rung | undefined {
    const rungIdx = Math.floor((y - CANVAS_PADDING) / RUNG_OFFSET);
    if (rungIdx >= 0 && rungIdx < graph.rungs.length) {
        return graph.rungs[rungIdx];
    }
    return undefined;
}

// ============================================================================
// Widget
// ============================================================================

export class LdEditorWidget extends ReactWidget {
    static readonly ID = 'audesys-ld-editor';
    static readonly LABEL = 'Ladder Diagram';

    private readonly toolState: LdToolState;
    private readonly modelState: LdGModelState;
    private readonly handler: LdOperationHandler;
    private onSelectionChange?: (sel: LdEditorSelection | null) => void;
    private _dirty: boolean = false;

    constructor(
        toolState: LdToolState,
        modelState: LdGModelState,
        handler: LdOperationHandler,
    ) {
        super();
        this.toolState = toolState;
        this.modelState = modelState;
        this.handler = handler;
        this.id = LdEditorWidget.ID;
        this.title.label = LdEditorWidget.LABEL;
        this.title.caption = 'IEC 61131-3 Ladder Diagram Editor';
        this.title.closable = true;
    }

    get dirty(): boolean {
        return this._dirty;
    }

    setSelectionCallback(fn: (sel: LdEditorSelection | null) => void): void {
        this.onSelectionChange = fn;
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.injectStyles();
        this.update(); // trigger React render when manually created via new
    }

    protected render(): React.ReactNode {
        return React.createElement(LdEditor, {
            toolState: this.toolState,
            modelState: this.modelState,
            handler: this.handler,
            onSelectionChange: this.onSelectionChange,
            onDirtyChange: (d: boolean) => { this._dirty = d; },
        });
    }

    private injectStyles(): void {
        const styleId = 'ld-editor-theme';
        if (document.getElementById(styleId)) return;
        const link = document.createElement('link');
        link.id = styleId;
        link.rel = 'stylesheet';
        // ponytail: inline CSS import handled by theia build pipeline
        // The CSS is injected here as a link to the bundled asset
        this.injectCssContent();
    }

    private injectCssContent(): void {
        const styleId = 'ld-editor-theme-css';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        // The CSS content is bundled; for simplicity, inject known rules
        // In production, this should be a proper CSS import
        style.textContent = `
          .ld-editor { width:100%; height:100%; overflow:auto; background:var(--theia-editor-background,#1e1e1e); cursor:default; }
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
