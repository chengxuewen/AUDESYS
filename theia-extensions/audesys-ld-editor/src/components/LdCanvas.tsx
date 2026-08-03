/**
 * LdCanvas — React Flow canvas for the IEC 61131-3 Ladder Diagram editor.
 *
 * Architecture (D110): LdGraph is the single source of truth, held in
 * LdGModelState (undo/redo + dirty). React Flow is a pure view — every
 * user interaction routes through LdOperationHandler (frontend memory,
 * no Theia command round-trip), the resulting graph is mapped back to
 * React Flow nodes/edges via graphToFlow.
 *
 * Mapping rules:
 *  - each Rung        → custom node type 'rung'   (group container)
 *  - contact/coil     → child nodes with parentId + extent: 'parent'
 *  - power rails      → top-level full-height nodes
 *  - wire/power edges → custom edge type 'wire'
 */

import React from '@theia/core/shared/react';
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    useReactFlow,
    Node,
    Edge,
    NodeTypes,
    EdgeTypes,
} from '@xyflow/react';

import { LdGraph, Rung } from '../model/model';
import { ContactNode as ContactModelNode, ContactType, CoilNode as CoilModelNode, CoilType, PowerRailNode as RailModelNode, PowerRailSide, BaseNode } from '../model/nodes';
import { toJSON } from '../model/serialization';
import { LD_GRID, CONTACT_SIZE, RUNG_HEIGHT, RUNG_GROUP_HEIGHT, RUNG_GROUP_WIDTH, COIL_X_OFFSET, RAIL_WIDTH } from '../model/grid';
import { LdOperationHandler } from '../backend/ld-operation-handler';
import { LdGModelState } from '../state/ld-gmodel-state';
import { LdPropertyState, SelectedElement } from '../property-view/ld-property-state';

import { ContactNode } from './nodes/ContactNode';
import { CoilNode } from './nodes/CoilNode';
import { RungGroupNode } from './nodes/RungGroupNode';
import { PowerRailNode } from './nodes/PowerRailNode';
import { WireEdge } from './edges/WireEdge';

// ============================================================================
// React Flow element types
// ============================================================================

export interface LdNodeData extends Record<string, unknown> {
    variableName?: string;
    contactType?: string;
    coilType?: string;
    side?: 'Left' | 'Right';
    rungNumber?: number;
    comment?: string;
    height?: number;
}

export type LdRfNode = Node<LdNodeData>;
export type LdRfEdge = Edge<Record<string, unknown>>;

/** RF type strings double as CSS selectors: .react-flow__node-contact etc. */
export const RF_TYPE_RUNG = 'rung';
export const RF_TYPE_CONTACT = 'contact';
export const RF_TYPE_COIL = 'coil';
export const RF_TYPE_RAIL = 'powerrail';
export const RF_TYPE_WIRE = 'wire';

/**
 * Vertical placement of contact/coil symbols inside a rung.
 * 40 = one grid cell; keeps positions stable through the handler's
 * snapToGrid (round(40/40)*40 = 40).
 */
const ELEMENT_Y = LD_GRID.y;

const snap40 = (v: number): number => Math.round(v / LD_GRID.x) * LD_GRID.x;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, hi));

// ============================================================================
// LdGraph → React Flow mapping
// ============================================================================

export function graphToFlow(graph: LdGraph): { nodes: LdRfNode[]; edges: LdRfEdge[] } {
    const nodes: LdRfNode[] = [];
    const nodeIds = new Set<string>();

    const railHeight = Math.max(
        ...graph.nodes.filter((n) => n.type === 'node:powerrail').map((n) => n.size.height),
        graph.rungs.length * RUNG_HEIGHT + LD_GRID.y,
    );

    graph.rungs.forEach((rung: Rung, index: number) => {
        nodes.push({
            id: rung.id,
            type: RF_TYPE_RUNG,
            position: { x: 0, y: index * RUNG_HEIGHT },
            style: { width: RUNG_GROUP_WIDTH, height: RUNG_GROUP_HEIGHT },
            data: { rungNumber: rung.rungNumber, comment: rung.comment ?? '' },
            draggable: false,
            deletable: false,
        });
        nodeIds.add(rung.id);

        for (const elementId of rung.elementIds) {
            const modelNode = graph.nodes.find((n) => n.id === elementId);
            if (!modelNode) {
                continue;
            }
            // ponytail: fb/comparison nodes are not rendered in Phase 1;
            // they stay in the graph and round-trip through save untouched.
            if (modelNode.type === 'node:contact') {
                const contact = modelNode as ContactModelNode;
                nodes.push({
                    id: contact.id,
                    type: RF_TYPE_CONTACT,
                    parentId: rung.id,
                    extent: 'parent',
                    position: contact.position,
                    data: { contactType: contact.contactType, variableName: contact.variableName },
                });
                nodeIds.add(contact.id);
            } else if (modelNode.type === 'node:coil') {
                const coil = modelNode as CoilModelNode;
                nodes.push({
                    id: coil.id,
                    type: RF_TYPE_COIL,
                    parentId: rung.id,
                    extent: 'parent',
                    position: coil.position,
                    data: { coilType: coil.coilType, variableName: coil.variableName },
                });
                nodeIds.add(coil.id);
            }
        }
    });

    for (const modelNode of graph.nodes) {
        if (modelNode.type !== 'node:powerrail') {
            continue;
        }
        const rail = modelNode as RailModelNode;
        nodes.push({
            id: rail.id,
            type: RF_TYPE_RAIL,
            position: rail.position,
            style: { width: RAIL_WIDTH + 8, height: railHeight },
            data: { side: rail.side, height: railHeight },
            draggable: false,
            deletable: false,
        });
        nodeIds.add(rail.id);
    }

    const edges: LdRfEdge[] = graph.edges
        .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
        .map((e) => ({
            id: e.id,
            source: e.sourceId,
            target: e.targetId,
            type: RF_TYPE_WIRE,
            sourceHandle: 'out',
            targetHandle: 'in',
            zIndex: 1, // LD wires render above nodes (glsp-expert requirement)
            data: {},
        }));

    return { nodes, edges };
}

// ============================================================================
// Tool palette definition
// ============================================================================

export type LdTool =
    | 'contact-NO'
    | 'contact-NC'
    | 'coil-Normal'
    | 'coil-Negated'
    | 'coil-Set'
    | 'coil-Reset'
    | 'rail-Left';

const TOOLS: ReadonlyArray<{ id: LdTool; label: string }> = [
    { id: 'contact-NO', label: 'NO Contact' },
    { id: 'contact-NC', label: 'NC Contact' },
    { id: 'coil-Normal', label: 'Coil' },
    { id: 'coil-Negated', label: 'Coil /' },
    { id: 'coil-Set', label: 'Coil S' },
    { id: 'coil-Reset', label: 'Coil R' },
    { id: 'rail-Left', label: 'Power Rail' },
];

const COIL_TYPE_BY_TOOL: Record<string, CoilType> = {
    'coil-Normal': CoilType.Normal,
    'coil-Negated': CoilType.Negated,
    'coil-Set': CoilType.Set,
    'coil-Reset': CoilType.Reset,
};

// ============================================================================
// Controller (widget-facing imperative API)
// ============================================================================

export interface LdCanvasController {
    undo(): void;
    redo(): void;
    getGraphJson(): string;
    isDirty(): boolean;
    markClean(): void;
}

// ============================================================================
// Styles (injected once into document head)
// ============================================================================

const LD_CANVAS_STYLE_ID = 'ld-editor-canvas-styles';
const LD_CANVAS_CSS = `
.ld-editor-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--theia-editor-background, #1e1e1e);
}
.ld-editor-root .react-flow {
  flex: 1;
}
.ld-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--theia-panel-border, #444);
  user-select: none;
}
.ld-toolbar__sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--theia-panel-border, #444);
}
.ld-toolbar button {
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--theia-ui-font-family);
  color: var(--theia-button-foreground, #fff);
  background: var(--theia-button-background, #0e639c);
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
}
.ld-toolbar button:hover {
  background: var(--theia-button-hoverBackground, #1177bb);
}
.ld-toolbar button:disabled {
  opacity: 0.5;
  cursor: default;
}
.ld-toolbar button.ld-toolbar__tool--active {
  outline: 1px solid var(--theia-focusBorder, #007fd4);
  background: var(--theia-button-hoverBackground, #1177bb);
}
.ld-status {
  margin-left: auto;
  font-size: 11px;
  color: var(--theia-errorForeground, #f48771);
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ld-canvas--placing {
  cursor: crosshair;
}
.ld-rung-group {
  width: 100%;
  height: 100%;
  border: 1px dashed var(--theia-panel-border, #555);
  border-radius: 2px;
}
.ld-rung-group--selected {
  border-color: var(--ld-selection-color, #2196f3);
}
.ld-rung-group__label {
  position: absolute;
  top: 2px;
  left: 6px;
  font-size: 10px;
  color: var(--ld-rung-label-color, #888);
  pointer-events: none;
}
.ld-node-label {
  font-size: 10px;
  text-align: center;
  color: var(--ld-rung-label-color, #888);
  pointer-events: none;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ld-contact, .ld-coil, .ld-powerrail {
  line-height: 0;
}
`;

function injectCanvasStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(LD_CANVAS_STYLE_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = LD_CANVAS_STYLE_ID;
    style.textContent = LD_CANVAS_CSS;
    document.head.appendChild(style);
}

// ============================================================================
// Node / edge type registries (module scope: stable identity across renders)
// ============================================================================

const nodeTypes: NodeTypes = {
    [RF_TYPE_CONTACT]: ContactNode,
    [RF_TYPE_COIL]: CoilNode,
    [RF_TYPE_RUNG]: RungGroupNode,
    [RF_TYPE_RAIL]: PowerRailNode,
};

const edgeTypes: EdgeTypes = {
    [RF_TYPE_WIRE]: WireEdge,
};

// ============================================================================
// Canvas component
// ============================================================================

export interface LdCanvasProps {
    state: LdGModelState;
    handler: LdOperationHandler;
    propertyState?: LdPropertyState;
    controllerRef?: React.MutableRefObject<LdCanvasController | null>;
    onDirtyChange?: (dirty: boolean) => void;
}

const LdCanvasInner: React.FC<LdCanvasProps> = ({
    state, handler, propertyState, controllerRef, onDirtyChange,
}) => {
    const { setNodes, setEdges, screenToFlowPosition } = useReactFlow();
    const [graph, setGraph] = React.useState<LdGraph>(() => state.graph);
    const [pendingTool, setPendingTool] = React.useState<LdTool | null>(null);
    const [status, setStatus] = React.useState('');
    /** Horizontal-drag constraint: original y per dragged node. */
    const dragStartY = React.useRef<Map<string, number>>(new Map());

    React.useEffect(injectCanvasStyles, []);

    // Sync LdGraph changes into the React Flow store (uncontrolled mode:
    // defaultNodes on mount, imperative setNodes/setEdges afterwards).
    React.useEffect(() => {
        const flow = graphToFlow(graph);
        setNodes(flow.nodes);
        setEdges(flow.edges);
    }, [graph, setNodes, setEdges]);

    const notifyDirty = React.useCallback((): void => {
        onDirtyChange?.(state.dirty);
    }, [onDirtyChange, state]);

    /** Apply a mutation through LdGModelState (undo snapshot + dirty). */
    const tryApply = React.useCallback((mutate: (g: LdGraph) => LdGraph): void => {
        try {
            const next = state.applyOperation(mutate);
            setGraph(next);
            setStatus('');
            notifyDirty();
        } catch (err) {
            setStatus(err instanceof Error ? err.message : String(err));
        }
    }, [state, notifyDirty]);

    // ── Toolbar actions ───────────────────────────────────────

    const undo = React.useCallback((): void => {
        const previous = state.undo();
        if (previous) {
            setGraph(previous);
            notifyDirty();
        }
    }, [state, notifyDirty]);

    const redo = React.useCallback((): void => {
        const next = state.redo();
        if (next) {
            setGraph(next);
            notifyDirty();
        }
    }, [state, notifyDirty]);

    const addRung = React.useCallback((): void => {
        tryApply((g) => handler.addRung(g));
    }, [tryApply, handler]);

    // ── Controller exposed to the Theia widget (save/undo/redo) ──

    React.useEffect(() => {
        if (!controllerRef) {
            return;
        }
        controllerRef.current = {
            undo,
            redo,
            getGraphJson: () => toJSON(state.graph),
            isDirty: () => state.dirty,
            markClean: () => {
                state.markClean();
                notifyDirty();
            },
        };
        return () => {
            controllerRef.current = null;
        };
    });

    // ── Tool palette → canvas click creation ─────────────────

    const createWithTool = React.useCallback((tool: LdTool, flowPos: { x: number; y: number }): void => {
        tryApply((g) => {
            let next = g;
            if (next.rungs.length === 0) {
                next = handler.addRung(next);
            }
            if (tool === 'rail-Left') {
                return handler.addPowerRail(next, { side: PowerRailSide.Left });
            }
            const rungIndex = clamp(Math.floor(flowPos.y / RUNG_HEIGHT), 0, next.rungs.length - 1);
            const rungId = next.rungs[rungIndex].id;
            if (tool === 'contact-NO' || tool === 'contact-NC') {
                return handler.addContact(next, {
                    position: { x: flowPos.x, y: ELEMENT_Y },
                    type: tool === 'contact-NO' ? ContactType.NO : ContactType.NC,
                    rungId,
                });
            }
            // Coil: keep it in the coil zone so addCoil validation holds.
            return handler.addCoil(next, {
                position: { x: Math.max(snap40(flowPos.x), COIL_X_OFFSET), y: ELEMENT_Y },
                type: COIL_TYPE_BY_TOOL[tool],
                rungId,
            });
        });
    }, [tryApply, handler]);

    const onPaneClick = React.useCallback((event: React.MouseEvent): void => {
        if (!pendingTool) {
            return;
        }
        const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        createWithTool(pendingTool, flowPos);
        setPendingTool(null);
    }, [pendingTool, screenToFlowPosition, createWithTool]);

    // ── Node dragging: horizontal constraint + commit ────────

    const onNodeDragStart = React.useCallback((_: unknown, node: LdRfNode): void => {
        dragStartY.current.set(node.id, node.position.y);
    }, []);

    const onNodeDrag = React.useCallback((_: unknown, node: LdRfNode): void => {
        // LD contacts/coils only move horizontally within their rung.
        if (node.type !== RF_TYPE_CONTACT && node.type !== RF_TYPE_COIL) {
            return;
        }
        const lockedY = dragStartY.current.get(node.id);
        if (lockedY === undefined || node.position.y === lockedY) {
            return;
        }
        setNodes((current) => current.map((n) =>
            n.id === node.id ? { ...n, position: { x: n.position.x, y: lockedY } } : n,
        ));
    }, [setNodes]);

    const onNodeDragStop = React.useCallback((_: unknown, node: LdRfNode): void => {
        dragStartY.current.delete(node.id);
        if (node.type !== RF_TYPE_CONTACT && node.type !== RF_TYPE_COIL) {
            return;
        }
        tryApply((g) => handler.moveElement(g, {
            elementId: node.id,
            newPosition: { x: node.position.x, y: node.position.y },
        }));
    }, [tryApply, handler]);

    // ── Deletion (nodes cascade-remove their edges in the handler) ──

    const onDelete = React.useCallback((params: { nodes: LdRfNode[]; edges: LdRfEdge[] }): void => {
        tryApply((g) => {
            let next = g;
            for (const node of params.nodes) {
                next = handler.deleteElement(next, { elementId: node.id });
            }
            for (const edge of params.edges) {
                // deleteElement may have cascade-removed this edge already.
                if (next.edges.some((e) => e.id === edge.id)) {
                    next = handler.disconnectWire(next, { edgeId: edge.id });
                }
            }
            return next;
        });
    }, [tryApply, handler]);

    // ── Selection → property view ────────────────────────────

    const toSelectedElement = React.useCallback((element: LdRfNode | LdRfEdge): SelectedElement | null => {
        if ('source' in element) {
            return {
                id: element.id,
                elementType: 'wire',
                sourceId: element.source,
                targetId: element.target,
                position: null,
            };
        }
        const modelNode: BaseNode | undefined = graph.nodes.find((n) => n.id === element.id);
        switch (element.type) {
            case RF_TYPE_CONTACT:
                return {
                    id: element.id,
                    elementType: 'contact',
                    variableName: String(element.data.variableName ?? ''),
                    contactType: element.data.contactType === 'NC' ? 'NC' : 'NO',
                    position: modelNode?.position ?? element.position,
                };
            case RF_TYPE_COIL:
                return {
                    id: element.id,
                    elementType: 'coil',
                    variableName: String(element.data.variableName ?? ''),
                    coilType: (['Normal', 'Negated', 'Set', 'Reset'].includes(String(element.data.coilType))
                        ? String(element.data.coilType)
                        : 'Normal') as 'Normal' | 'Negated' | 'Set' | 'Reset',
                    position: modelNode?.position ?? element.position,
                };
            case RF_TYPE_RUNG: {
                const rung = graph.rungs.find((r) => r.id === element.id);
                if (!rung) {
                    return null;
                }
                return { id: rung.id, elementType: 'rung', rungNumber: rung.rungNumber, comment: rung.comment ?? '' };
            }
            case RF_TYPE_RAIL:
                return {
                    id: element.id,
                    elementType: 'powerrail',
                    side: element.data.side === 'Right' ? 'Right' : 'Left',
                    position: modelNode?.position ?? element.position,
                };
            default:
                return null;
        }
    }, [graph]);

    const onSelectionChange = React.useCallback((params: { nodes: LdRfNode[]; edges: LdRfEdge[] }): void => {
        if (!propertyState) {
            return;
        }
        const first = params.nodes[0] ?? params.edges[0];
        if (!first) {
            propertyState.clearSelection();
            return;
        }
        const selected = toSelectedElement(first);
        if (selected) {
            propertyState.selectElement(selected);
        } else {
            propertyState.clearSelection();
        }
    }, [propertyState, toSelectedElement]);

    // ── Property edits → graph mutations ─────────────────────

    React.useEffect(() => {
        if (!propertyState) {
            return undefined;
        }
        const subscription = propertyState.onDidChangeProperty(({ elementId, property, value }) => {
            if (typeof value !== 'string') {
                return;
            }
            if (property === 'contactType') {
                const newType = value === 'NC' ? ContactType.NC
                    : value === 'P' ? ContactType.P
                    : value === 'N' ? ContactType.N
                    : ContactType.NO;
                tryApply((g) => handler.changeContactType(g, { elementId, newType }));
                return;
            }
            if (property === 'comment') {
                tryApply((g) => {
                    const index = g.rungs.findIndex((r) => r.id === elementId);
                    if (index < 0) {
                        return g;
                    }
                    const next: LdGraph = JSON.parse(JSON.stringify(g));
                    next.rungs[index] = { ...next.rungs[index], comment: value };
                    return next;
                });
                return;
            }
            // variableName / coilType / fbType: plain node field update
            tryApply((g) => {
                const index = g.nodes.findIndex((n) => n.id === elementId);
                if (index < 0) {
                    return g;
                }
                const next: LdGraph = JSON.parse(JSON.stringify(g));
                next.nodes[index] = { ...next.nodes[index], [property]: value };
                return next;
            });
        });
        return () => subscription.dispose();
    }, [propertyState, tryApply, handler]);

    // ── Render ────────────────────────────────────────────────

    const initialFlow = React.useMemo(() => graphToFlow(graph), []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="ld-editor-root">
            <div className="ld-toolbar">
                <button onClick={undo} disabled={state.undoDepth === 0} title="Undo">Undo</button>
                <button onClick={redo} disabled={state.redoDepth === 0} title="Redo">Redo</button>
                <button onClick={addRung} title="Add a rung at the bottom">Add Rung</button>
                <div className="ld-toolbar__sep" />
                {TOOLS.map((tool) => (
                    <button
                        key={tool.id}
                        className={pendingTool === tool.id ? 'ld-toolbar__tool--active' : ''}
                        onClick={() => setPendingTool((t) => (t === tool.id ? null : tool.id))}
                        title={`${tool.label}: click, then click on the canvas`}
                    >
                        {tool.label}
                    </button>
                ))}
                <div className="ld-status">{status}</div>
            </div>
            <ReactFlow
                defaultNodes={initialFlow.nodes}
                defaultEdges={initialFlow.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                snapToGrid={true}
                snapGrid={[LD_GRID.x, LD_GRID.y]}
                defaultEdgeOptions={{ zIndex: 1 }}
                nodesConnectable={false}
                fitView
                onPaneClick={onPaneClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onDelete={onDelete}
                onSelectionChange={onSelectionChange}
                className={pendingTool ? 'ld-canvas--placing' : undefined}
            >
                <Background variant={BackgroundVariant.Dots} gap={LD_GRID.x} size={1} />
                <Controls />
                <MiniMap pannable zoomable />
            </ReactFlow>
        </div>
    );
};

export const LdCanvas: React.FC<LdCanvasProps> = (props) => (
    <ReactFlowProvider>
        <LdCanvasInner {...props} />
    </ReactFlowProvider>
);
