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
 *  - contact/coil/fb  → child nodes with parentId + extent: 'parent'
 *  - parallel-branch members → contacts stacked below their anchor
 *  - power rails      → top-level full-height nodes
 *  - wire/power edges → custom edge type 'wire' (smooth-step routed)
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
import { ContactNode as ContactModelNode, ContactType, CoilNode as CoilModelNode, CoilType, PowerRailNode as RailModelNode, PowerRailSide, BaseNode, FbPlaceholderNode, Pin } from '../model/nodes';
import { toJSON } from '../model/serialization';
import { LD_GRID, CONTACT_SIZE, RUNG_HEIGHT, RUNG_GROUP_HEIGHT, RUNG_GROUP_WIDTH, COIL_X_OFFSET, RAIL_WIDTH, BRANCH_FIRST_Y } from '../model/grid';
import { FbType, fbPaletteEntries } from '../model/fb-catalog';
import { LdOperationHandler } from '../backend/ld-operation-handler';
import { LdGModelState } from '../state/ld-gmodel-state';
import { LdPropertyState, SelectedElement } from '../property-view/ld-property-state';
import { WireConnection } from '../model/edges';

import { ContactNode } from './nodes/ContactNode';
import { CoilNode } from './nodes/CoilNode';
import { FbNode } from './nodes/FbNode';
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
    fbType?: string;
    inputPins?: Pin[];
    outputPins?: Pin[];
    side?: 'Left' | 'Right';
    rungNumber?: number;
    comment?: string;
    height?: number;
    onRename?: (id: string, name: string) => void;
}

export type LdRfNode = Node<LdNodeData>;
export type LdRfEdge = Edge<Record<string, unknown>>;

/** RF type strings double as CSS selectors: .react-flow__node-contact etc. */
export const RF_TYPE_RUNG = 'rung';
export const RF_TYPE_CONTACT = 'contact';
export const RF_TYPE_COIL = 'coil';
export const RF_TYPE_FB = 'fb';
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

/**
 * Container height that fits the main row + the deepest branch member row.
 * Computed from the actual member positions (a member's node is 36px svg +
 * 12px label — extent:'parent' clamps members taller than the container).
 */
    function rungContainerHeight(rung: Rung, graph: LdGraph): number {
    let deepestY = 0;
    for (const branch of rung.branches ?? []) {
        for (const memberId of branch.elementIds) {
            const member = graph.nodes.find((n) => n.id === memberId);
            if (member) deepestY = Math.max(deepestY, member.position.y);
        }
    }
    if (deepestY === 0) {
        return RUNG_GROUP_HEIGHT;
    }
    return Math.max(
        RUNG_GROUP_HEIGHT,
        deepestY + CONTACT_SIZE + 8, // member row + node height + padding
    );
}
function contactFlowNode(
    contact: ContactModelNode,
    rungId: string,
    renameVar?: (id: string, name: string) => void,
): LdRfNode {
    return {
        id: contact.id,
        type: RF_TYPE_CONTACT,
        parentId: rungId,
        extent: 'parent',
        position: contact.position,
        data: {
            contactType: contact.contactType,
            variableName: contact.variableName,
            onRename: renameVar,
        },
    };
}

function coilFlowNode(
    coil: CoilModelNode,
    rungId: string,
    renameVar?: (id: string, name: string) => void,
): LdRfNode {
    return {
        id: coil.id,
        type: RF_TYPE_COIL,
        parentId: rungId,
        extent: 'parent',
        position: coil.position,
        data: {
            coilType: coil.coilType,
            variableName: coil.variableName,
            onRename: renameVar,
        },
    };
}

function fbFlowNode(fb: FbPlaceholderNode, rungId: string): LdRfNode {
    return {
        id: fb.id,
        type: RF_TYPE_FB,
        parentId: rungId,
        extent: 'parent',
        position: fb.position,
        style: { width: fb.size.width, height: fb.size.height },
        data: { fbType: fb.fbType, inputPins: fb.inputPins, outputPins: fb.outputPins },
    };
}

export function graphToFlow(
    graph: LdGraph,
    renameVar?: (id: string, name: string) => void,
): { nodes: LdRfNode[]; edges: LdRfEdge[] } {
    const nodes: LdRfNode[] = [];
    const nodeIds = new Set<string>();

    // Cumulative rung placement: non-branch rungs keep the old 80px pitch.
    const rungHeights = new Map<string, number>();
    let cursor = 0;
    for (const rung of graph.rungs) {
        rungHeights.set(rung.id, rungContainerHeight(rung, graph));
        cursor += rungContainerHeight(rung, graph) + 4;
    }

    const railHeight = Math.max(
        ...graph.nodes.filter((n) => n.type === 'node:powerrail').map((n) => n.size.height),
        cursor,
    );

    let rungTop = 0;
    graph.rungs.forEach((rung: Rung, index: number) => {
        nodes.push({
            id: rung.id,
            type: RF_TYPE_RUNG,
            position: { x: 0, y: rungTop },
            style: { width: RUNG_GROUP_WIDTH, height: rungHeights.get(rung.id) ?? RUNG_GROUP_HEIGHT },
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
            if (modelNode.type === 'node:contact') {
                nodes.push(contactFlowNode(modelNode as ContactModelNode, rung.id, renameVar));
                nodeIds.add(modelNode.id);
            } else if (modelNode.type === 'node:coil') {
                nodes.push(coilFlowNode(modelNode as CoilModelNode, rung.id, renameVar));
                nodeIds.add(modelNode.id);
            } else if (modelNode.type === 'node:fb') {
                nodes.push(fbFlowNode(modelNode as FbPlaceholderNode, rung.id));
                nodeIds.add(modelNode.id);
            }
        }

        // Parallel-branch members (stacked below their anchor, same column)
        for (const branch of rung.branches ?? []) {
            for (const memberId of branch.elementIds) {
                const modelNode = graph.nodes.find((n) => n.id === memberId);
                if (!modelNode || modelNode.type !== 'node:contact') {
                    continue;
                }
                nodes.push(contactFlowNode(modelNode as ContactModelNode, rung.id, renameVar));
                nodeIds.add(modelNode.id);
            }
        }

        rungTop += (rungHeights.get(rung.id) ?? RUNG_GROUP_HEIGHT) + 4;
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
        .map((e) => {
            const w = e as WireConnection;
            // Pin-anchored handles: FB pins use "out:<pin>/in:<pin>",
            // vertical branch bus wires use literal "bus-out"/"bus-in".
            const sourceHandle = !w.sourcePin
                ? 'out'
                : w.sourcePin.startsWith('bus-') ? w.sourcePin : `out:${w.sourcePin}`;
            const targetHandle = !w.targetPin
                ? 'in'
                : w.targetPin.startsWith('bus-') ? w.targetPin : `in:${w.targetPin}`;
            return {
                id: e.id,
                source: e.sourceId,
                target: e.targetId,
                type: RF_TYPE_WIRE,
                sourceHandle,
                targetHandle,
                zIndex: 1, // LD wires render above nodes (glsp-expert requirement)
                // Edge interaction is disabled in WireEdge (interactionWidth 0);
                // branch bus edges run through member columns and must not
                // swallow clicks on the members.
                data: {},
            };
        });

    return { nodes, edges };
}

// ============================================================================
// Tool palette definition
// ============================================================================

export type FbToolId = `fb-${FbType}`;

export type LdTool =
    | 'contact-NO'
    | 'contact-NC'
    | 'contact-P'
    | 'contact-N'
    | 'coil-Normal'
    | 'coil-Negated'
    | 'coil-Set'
    | 'coil-Reset'
    | 'rail-Left'
    | 'branch'
    | FbToolId;

const TOOLS: ReadonlyArray<{ id: LdTool; label: string }> = [
    { id: 'contact-NO', label: 'NO Contact' },
    { id: 'contact-NC', label: 'NC Contact' },
    { id: 'contact-P', label: 'P Contact' },
    { id: 'contact-N', label: 'N Contact' },
    { id: 'coil-Normal', label: 'Coil' },
    { id: 'coil-Negated', label: 'Coil /' },
    { id: 'coil-Set', label: 'Coil S' },
    { id: 'coil-Reset', label: 'Coil R' },
    { id: 'rail-Left', label: 'Power Rail' },
    { id: 'branch', label: 'Open Branch' },
];

/** FB palette — one button per IEC 61131-3 block type. */
const FB_TOOLS: ReadonlyArray<{ id: FbToolId; label: string }> =
    fbPaletteEntries().map((entry) => ({ id: `fb-${entry.type}`, label: entry.label }));

const COIL_TYPE_BY_TOOL: Record<string, CoilType> = {
    'coil-Normal': CoilType.Normal,
    'coil-Negated': CoilType.Negated,
    'coil-Set': CoilType.Set,
    'coil-Reset': CoilType.Reset,
};

const CONTACT_TYPE_BY_TOOL: Record<string, ContactType> = {
    'contact-NO': ContactType.NO,
    'contact-NC': ContactType.NC,
    'contact-P': ContactType.P,
    'contact-N': ContactType.N,
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
  position: absolute; /* keep the node box at 36px — a taller node gets clamped
                        inside the rung container (extent:'parent') */
  top: 38px;
  left: 0;
  width: 100%;
  font-size: 10px;
  line-height: 12px;
  text-align: center;
  color: var(--ld-rung-label-color, #888);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* NOTE: no pointer-events:none — the label must receive dblclick for rename */
}
.ld-node-rename {
  position: absolute;
  top: 38px;
  left: -12px;
  width: 64px;
  font-size: 10px;
  font-family: var(--theia-ui-font-family);
  color: var(--theia-input-foreground, #ccc);
  background: var(--theia-input-background, #252526);
  border: 1px solid var(--theia-focusBorder, #007fd4);
  border-radius: 2px;
  outline: none;
  padding: 0 2px;
  z-index: 5;
}
.ld-contact, .ld-coil, .ld-powerrail {
  position: relative; /* anchor for the absolute .ld-node-label */
  line-height: 0;
}
.ld-fb {
  position: relative;
  line-height: 0;
}
.ld-fb__body {
  display: block;
}
.ld-fb__pin-label {
  position: absolute;
  left: 6px;
  font-size: 9px;
  line-height: 12px;
  color: var(--ld-rung-label-color, #888);
  pointer-events: none;
}
.ld-fb__pin-label--out {
  left: auto;
  right: 6px;
  text-align: right;
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
    [RF_TYPE_FB]: FbNode,
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
    /** Active parallel branch being edited (open → add members → close). */
    const [branchMode, setBranchMode] = React.useState<{ branchId: string; rungId: string } | null>(null);
    /** Horizontal-drag constraint: original y per dragged node. */
    const dragStartY = React.useRef<Map<string, number>>(new Map());

    React.useEffect(injectCanvasStyles, []);

    const notifyDirty = React.useCallback((): void => {
        onDirtyChange?.(state.dirty);
    }, [onDirtyChange, state]);

    /** Apply a mutation through LdGModelState (undo snapshot + dirty). */
    const tryApply = React.useCallback((mutate: (g: LdGraph) => LdGraph): LdGraph | null => {
        try {
            const next = state.applyOperation(mutate);
            setGraph(next);
            setStatus('');
            notifyDirty();
            return next;
        } catch (err) {
            setStatus(err instanceof Error ? err.message : String(err));
            return null;
        }
    }, [state, notifyDirty]);

    const renameVar = React.useCallback((elementId: string, name: string): void => {
        tryApply((g) => handler.renameVariable(g, { elementId, variableName: name }));
    }, [tryApply, handler]);

    // Sync LdGraph changes into the React Flow store (uncontrolled mode:
    // defaultNodes on mount, imperative setNodes/setEdges afterwards).
    React.useEffect(() => {
        const flow = graphToFlow(graph, renameVar);
        setNodes(flow.nodes);
        setEdges(flow.edges);
    }, [graph, setNodes, setEdges, renameVar]);

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

    // ── Parallel branch flow ──────────────────────────────────

    const openBranchAt = React.useCallback((anchorNodeId: string, rungId: string): void => {
        const next = tryApply((g) => handler.openBranch(g, { rungId, anchorId: anchorNodeId }));
        if (!next) {
            return;
        }
        const rung = next.rungs.find((r) => r.id === rungId);
        const branch = rung?.branches?.find((b) => b.anchorId === anchorNodeId);
        if (branch) {
            setBranchMode({ branchId: branch.id, rungId });
            setPendingTool(null);
            setStatus('Branch open — click in the rung to add contacts, then Close Branch');
        }
    }, [tryApply, handler]);

    const addBranchMember = React.useCallback((position: { x: number; y: number }): void => {
        if (!branchMode) {
            return;
        }
        const rungIndex = clamp(Math.floor(position.y / RUNG_HEIGHT), 0, graph.rungs.length - 1);
        const rungId = graph.rungs[rungIndex].id;
        if (rungId !== branchMode.rungId) {
            setStatus('Branch members must be placed in the branch\'s rung');
            return;
        }
        const next = tryApply((g) => handler.addBranchContact(g, { branchId: branchMode.branchId, position }));
        if (next) {
            setStatus('Contact added to branch — add more or Close Branch');
        }
    }, [branchMode, graph.rungs, tryApply, handler]);

    const closeBranch = React.useCallback((): void => {
        if (!branchMode) {
            return;
        }
        const next = tryApply((g) => handler.closeBranch(g, { branchId: branchMode.branchId }));
        if (next) {
            setBranchMode(null);
            setStatus('Branch closed (OR logic)');
        }
    }, [branchMode, tryApply, handler]);

    const cancelBranch = React.useCallback((): void => {
        if (!branchMode) {
            return;
        }
        tryApply((g) => handler.deleteBranch(g, { branchId: branchMode.branchId }));
        setBranchMode(null);
        setStatus('Branch cancelled');
    }, [branchMode, tryApply, handler]);

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
            if (tool === 'branch') {
                return next; // branch opening happens on node click
            }
            const rungIndex = clamp(Math.floor(flowPos.y / RUNG_HEIGHT), 0, next.rungs.length - 1);
            const rungId = next.rungs[rungIndex].id;
            if (CONTACT_TYPE_BY_TOOL[tool]) {
                return handler.addContact(next, {
                    position: { x: flowPos.x, y: ELEMENT_Y },
                    type: CONTACT_TYPE_BY_TOOL[tool],
                    rungId,
                });
            }
            if (tool.startsWith('fb-')) {
                return handler.addFb(next, {
                    position: { x: snap40(flowPos.x), y: ELEMENT_Y },
                    fbType: tool.slice(3),
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
        if (branchMode) {
            const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            addBranchMember(flowPos);
            return;
        }
        if (!pendingTool) {
            return;
        }
        const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        createWithTool(pendingTool, flowPos);
        setPendingTool(null);
    }, [branchMode, pendingTool, screenToFlowPosition, createWithTool, addBranchMember]);

    const onNodeClick = React.useCallback((_: unknown, node: LdRfNode): void => {
        if (!pendingTool || pendingTool !== 'branch') {
            return;
        }
        if (node.type !== RF_TYPE_CONTACT || !node.parentId) {
            setStatus('Open Branch: click a contact on the rung');
            return;
        }
        openBranchAt(node.id, node.parentId);
    }, [pendingTool, openBranchAt]);

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
            case RF_TYPE_CONTACT: {
                const contactType = element.data.contactType === 'NC' ? 'NC'
                    : element.data.contactType === 'P' ? 'P'
                    : element.data.contactType === 'N' ? 'N'
                    : 'NO';
                return {
                    id: element.id,
                    elementType: 'contact',
                    variableName: String(element.data.variableName ?? ''),
                    contactType,
                    position: modelNode?.position ?? element.position,
                };
            }
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
            case RF_TYPE_FB:
                return {
                    id: element.id,
                    elementType: 'fb',
                    fbType: String(element.data.fbType ?? ''),
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
            if (property === 'variableName') {
                tryApply((g) => handler.renameVariable(g, { elementId, variableName: value }));
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
            // coilType / fbType: plain node field update
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

    const initialFlow = React.useMemo(() => graphToFlow(graph, renameVar), []); // eslint-disable-line react-hooks/exhaustive-deps

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
                {branchMode && (
                    <>
                        <div className="ld-toolbar__sep" />
                        <button onClick={closeBranch} title="Finalize the parallel branch (OR logic)">
                            Close Branch
                        </button>
                        <button onClick={cancelBranch} title="Remove the branch and its contacts">
                            Cancel Branch
                        </button>
                    </>
                )}
                <div className="ld-toolbar__sep" />
                <span className="ld-toolbar__group-label" style={{ fontSize: 10, opacity: 0.7 }}>FB:</span>
                {FB_TOOLS.map((tool) => (
                    <button
                        key={tool.id}
                        className={pendingTool === tool.id ? 'ld-toolbar__tool--active' : ''}
                        onClick={() => setPendingTool((t) => (t === tool.id ? null : tool.id))}
                        title={`Insert ${tool.label}: click, then click on the canvas`}
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
                // v12 default is only 'Backspace'; E2E and keyboard users press Delete
                deleteKeyCode={['Delete', 'Backspace']}
                fitView
                onPaneClick={onPaneClick}
                onNodeClick={onNodeClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onDelete={onDelete}
                onSelectionChange={onSelectionChange}
                className={pendingTool || branchMode ? 'ld-canvas--placing' : undefined}
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
