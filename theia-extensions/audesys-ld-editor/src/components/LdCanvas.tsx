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
import { layoutRung, layoutGraph } from '../model/layout';
import { ContactNode as ContactModelNode, ContactType, CoilNode as CoilModelNode, CoilType, PowerRailNode as RailModelNode, PowerRailSide, BaseNode, FbPlaceholderNode, Pin, Point } from '../model/nodes';
import { toJSON } from '../model/serialization';
import { LD_GRID, CONTACT_SIZE, RUNG_HEIGHT, RUNG_GROUP_HEIGHT, RUNG_GROUP_WIDTH, COIL_X_OFFSET, RAIL_WIDTH, BRANCH_FIRST_Y } from '../model/grid';
import { FbType, fbPaletteEntries } from '../model/fb-catalog';
import { LdOperationHandler, CompileResult } from '../backend/ld-operation-handler';
import { LdGModelState } from '../state/ld-gmodel-state';
import { LdPropertyState, SelectedElement } from '../property-view/ld-property-state';
import { WireConnection } from '../model/edges';
import { parseValidationErrors, ValidationMarkup } from '../model/validation-ui';
import { findVariable, listVariables } from '../model/variable-utils';

import { ContactNode } from './nodes/ContactNode';
import { CoilNode } from './nodes/CoilNode';
import { FbNode } from './nodes/FbNode';
import { RungGroupNode } from './nodes/RungGroupNode';
import { PowerRailNode } from './nodes/PowerRailNode';
import { InsertPointNode, InsertPointData } from './nodes/InsertPointNode';
import { WireEdge } from './edges/WireEdge';
import { LdContextMenu, CtxMenuState, LdContextMenuActions } from './LdContextMenu';

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
    title?: string;
    height?: number;
    onRename?: (id: string, name: string) => void;
    onChangeType?: (id: string, type: string) => void;
    onSetTitle?: (id: string, title: string) => void;
    onSetComment?: (id: string, comment: string) => void;
    /** P2 validation: error count + messages for the rung container. */
    errorCount?: number;
    errorTitle?: string;
    /** P2 monitoring: live value + mode flag for contact/coil badges. */
    monitoring?: boolean;
    value?: number;
    /** A3: external edit request (keyboard Tab/Enter navigation) —
     *  { field, seq } consumed by node components; seq bumps each request
     *  so repeated requests for the same field still re-trigger. */
    editRequest?: { field: string; seq: number };
}

export type LdRfNode = Node<LdNodeData>;

/**
 * A3: editable-field sequence for keyboard navigation (§7.1).
 * Order matters: Tab advances, Shift+Tab goes back, Enter opens the
 * current field's editor. Contact/coil rename their variable; a rung
 * edits its title then comment.
 */
export function editableFieldsFor(node: Pick<LdRfNode, 'type'>): string[] {
    switch (node.type) {
        case RF_TYPE_CONTACT:
        case RF_TYPE_COIL:
            return ['variableName'];
        case RF_TYPE_RUNG:
            return ['title', 'comment'];
        default:
            return [];
    }
}
export type LdRfEdge = Edge<Record<string, unknown>>;

/** RF type strings double as CSS selectors: .react-flow__node-contact etc. */
export const RF_TYPE_RUNG = 'rung';
export const RF_TYPE_CONTACT = 'contact';
export const RF_TYPE_COIL = 'coil';
export const RF_TYPE_FB = 'fb';
export const RF_TYPE_RAIL = 'powerrail';
export const RF_TYPE_WIRE = 'wire';
export const RF_TYPE_INSERT = 'insert-point';

/**
 * Vertical placement of contact/coil symbols inside a rung.
 * 40 = one grid cell; keeps positions stable through the handler's
 * snapToGrid (round(40/40)*40 = 40).
 */
const ELEMENT_Y = LD_GRID.y;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, hi));

/**
 * Map a click x (flow coords) to the nearest insertion slot in a rung.
 * Slots are the gaps between series elements (derived via layoutRung):
 * slot 0 = left of the first element, slot i = between element i-1 and i,
 * slot n = after the last element. Used by createWithTool (topology, D112).
 */
function findInsertIndex(graph: LdGraph, rung: Rung, clickX: number): number {
    const positions = layoutRung(rung, graph);
    const series = rung.elementIds.filter((id) => {
        const n = graph.nodes.find((nn) => nn.id === id);
        return n && n.type !== 'node:coil'; // coil is pinned, not a slot boundary
    });
    if (series.length === 0) return 0;
    const edges = series.map((id, i) => {
        const p = positions.get(id)!;
        const n = graph.nodes.find((nn) => nn.id === id)!;
        return { left: p.x, right: p.x + n.size.width, idx: i };
    });
    for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const boundary = i === 0 ? e.left - 20 : (edges[i - 1].right + e.left) / 2;
        if (clickX < boundary) return i;
    }
    return edges.length;
}

// ============================================================================
// LdGraph → React Flow mapping
// ============================================================================


/** Mutation callbacks passed through to node components (stable identities). */
export interface LdFlowCallbacks {
    renameVar?: (id: string, name: string) => void;
    changeContactType?: (id: string, type: string) => void;
    changeCoilType?: (id: string, type: string) => void;
    setRungTitle?: (id: string, title: string) => void;
    setRungComment?: (id: string, comment: string) => void;
    setElementComment?: (id: string, comment: string) => void;
    /** A1a: open a parallel branch at a series contact (▲▼ marker click). */
    openBranchFromContact?: (contactId: string, rungId: string) => void;
}

function contactFlowNode(
    contact: ContactModelNode,
    rungId: string,
    cb: LdFlowCallbacks,
    position: Point,
    hasBranch = false,
): LdRfNode {
    return {
        id: contact.id,
        type: RF_TYPE_CONTACT,
        parentId: rungId,
        extent: 'parent',
        position,
        draggable: true,
        data: {
            contactType: contact.contactType,
            variableName: contact.variableName,
            comment: contact.comment ?? '',
            onRename: cb.renameVar,
            onChangeType: cb.changeContactType,
            onOpenBranch: cb.openBranchFromContact
                ? (contactId: string) => cb.openBranchFromContact!(contactId, rungId)
                : undefined,
            hasBranch,
        },
    };
}

function coilFlowNode(
    coil: CoilModelNode,
    rungId: string,
    cb: LdFlowCallbacks,
    position: Point,
): LdRfNode {
    return {
        id: coil.id,
        type: RF_TYPE_COIL,
        parentId: rungId,
        extent: 'parent',
        position,
        draggable: true,
        data: {
            coilType: coil.coilType,
            variableName: coil.variableName,
            comment: coil.comment ?? '',
            onRename: cb.renameVar,
            onChangeType: cb.changeCoilType,
        },
    };
}

function fbFlowNode(fb: FbPlaceholderNode, rungId: string, position: Point): LdRfNode {
    return {
        id: fb.id,
        type: RF_TYPE_FB,
        parentId: rungId,
        extent: 'parent',
        position,
        draggable: true,
        style: { width: fb.size.width, height: fb.size.height },
        data: { fbType: fb.fbType, inputPins: fb.inputPins, outputPins: fb.outputPins },
    };
}

export function graphToFlow(
    graph: LdGraph,
    cb: LdFlowCallbacks = {},
): { nodes: LdRfNode[]; edges: LdRfEdge[] } {
    const nodes: LdRfNode[] = [];
    const nodeIds = new Set<string>();

    // Topology layout (D112): all positions derive from rung structure.
    const layout = layoutGraph(graph);

    // Element → rung map: which rung does each element (series or branch member)
    // belong to. Used to anchor rail handles to the correct per-rung row.
    const rungForElement = new Map<string, string>();
    for (const rung of graph.rungs) {
        for (const id of rung.elementIds) rungForElement.set(id, rung.id);
        for (const b of rung.branches ?? []) {
            for (const id of b.elementIds) rungForElement.set(id, rung.id);
        }
    }
    // Per-rung rail handle rows: absolute y of the main element row's handle
    // center inside the full-height rail (which sits at y=0).
    const railRows = graph.rungs.map((rung) => ({
        rungId: rung.id,
        y: (layout.rungTops.get(rung.id) ?? 0) + ELEMENT_Y + CONTACT_SIZE / 2,
    }));

    graph.rungs.forEach((rung: Rung) => {
        const rungTop = layout.rungTops.get(rung.id) ?? 0;
        const rungH = layout.rungHeights.get(rung.id) ?? RUNG_GROUP_HEIGHT;
        nodes.push({
            id: rung.id,
            type: RF_TYPE_RUNG,
            position: { x: 0, y: rungTop },
            style: { width: RUNG_GROUP_WIDTH, height: rungH },
            data: {
                rungNumber: rung.rungNumber,
                comment: rung.comment ?? '',
                title: rung.title ?? '',
                onSetTitle: cb.setRungTitle,
                onSetComment: cb.setRungComment,
            },
            draggable: false,
            deletable: false,
        });
        nodeIds.add(rung.id);

        // Children are positioned relative to their rung container.
        const toLocal = (id: string): Point => {
            const abs = layout.positions.get(id) ?? { x: 0, y: 40 };
            return { x: abs.x, y: abs.y - rungTop };
        };

        for (const elementId of rung.elementIds) {
            const modelNode = graph.nodes.find((n) => n.id === elementId);
            if (!modelNode) {
                continue;
            }
            if (modelNode.type === 'node:contact') {
                nodes.push(contactFlowNode(modelNode as ContactModelNode, rung.id, cb, toLocal(modelNode.id),
                    rung.branches?.some((b) => b.anchorId === modelNode.id) ?? false));
                nodeIds.add(modelNode.id);
            } else if (modelNode.type === 'node:coil') {
                nodes.push(coilFlowNode(modelNode as CoilModelNode, rung.id, cb, toLocal(modelNode.id)));
                nodeIds.add(modelNode.id);
            } else if (modelNode.type === 'node:fb') {
                nodes.push(fbFlowNode(modelNode as FbPlaceholderNode, rung.id, toLocal(modelNode.id)));
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
                nodes.push(contactFlowNode(modelNode as ContactModelNode, rung.id, cb, toLocal(modelNode.id), false));
                nodeIds.add(modelNode.id);
            }
        }
    });

    for (const modelNode of graph.nodes) {
        if (modelNode.type !== 'node:powerrail') {
            continue;
        }
        const rail = modelNode as RailModelNode;
        const railPos = rail.side === 'Left' ? layout.rails.left : layout.rails.right;
        nodes.push({
            id: rail.id,
            type: RF_TYPE_RAIL,
            position: railPos,
            style: { width: RAIL_WIDTH + 8, height: layout.rails.height },
            data: { side: rail.side, height: layout.rails.height, rows: railRows },
            draggable: false,
            deletable: false,
        });
        nodeIds.add(rail.id);
    }

    // Helpers: resolve the rail-side handle id for an edge whose source or
    // target is a power rail. The rail has one handle per rung row, so the
    // wire can anchor at the row's height instead of the rail's midpoint.
    const isRail = (id: string): boolean => nodeIds.has(id) &&
        graph.nodes.some((n) => n.id === id && n.type === 'node:powerrail');
    const railHandle = (elementId: string): string => {
        const rungId = rungForElement.get(elementId);
        return rungId ? `rail:${rungId}` : 'out';
    };

    const edges: LdRfEdge[] = graph.edges
        .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
        .map((e) => {
            const w = e as WireConnection;
            // Pin-anchored handles: FB pins use "out:<pin>/in:<pin>",
            // vertical branch bus wires use literal "bus-out"/"bus-in".
            // Power-rail wires use per-row handles "rail:<rungId>" so the
            // wire anchors at the rung's main-row height (not rail midpoint).
            const sourceRail = isRail(e.sourceId);
            const targetRail = isRail(e.targetId);
            const sourceHandle = sourceRail
                ? railHandle(e.targetId)
                : !w.sourcePin ? 'out'
                : w.sourcePin.startsWith('bus-') ? w.sourcePin : `out:${w.sourcePin}`;
            const targetHandle = targetRail
                ? railHandle(e.sourceId)
                : !w.targetPin ? 'in'
                : w.targetPin.startsWith('bus-') ? w.targetPin : `in:${w.targetPin}`;
            return {
                id: e.id,
                source: e.sourceId,
                target: e.targetId,
                type: RF_TYPE_WIRE,
                sourceHandle,
                targetHandle,
                // Edges keep the default z-index (nodes paint above edges in
                // React Flow's DOM order) so node bodies always win the
                // hit-test — wires are interactive only in the open space
                // between nodes (A2b edge context menu). Wires that pass under
                // a node are decoration and must not swallow clicks on it.
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

/* Annotated header (P1): title line 1, comment line 2 — when the rung
   has annotations or is selected, the text becomes editable (dblclick). */
.ld-rung-group--annotated .ld-rung-group__label {
  pointer-events: auto;
  cursor: text;
}
.ld-rung-group__comment {
  position: absolute;
  top: 16px;
  left: 6px;
  right: 6px;
  font-size: 10px;
  line-height: 12px;
  color: var(--ld-rung-label-color, #888);
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}
.ld-rung-group--annotated .ld-rung-group__comment {
  pointer-events: auto;
  cursor: text;
}
.ld-rung-group__comment--empty {
  font-style: italic;
  opacity: 0.5;
}
.ld-rung-group__title-input, .ld-rung-group__comment-input {
  position: absolute;
  left: 6px;
  right: 6px;
  font-size: 10px;
  font-family: var(--theia-ui-font-family);
  color: var(--theia-input-foreground, #ccc);
  background: var(--theia-input-background, #252526);
  border: 1px solid var(--theia-focusBorder, #007fd4);
  border-radius: 2px;
  outline: none;
  padding: 0 2px;
  z-index: 6;
}
.ld-rung-group__title-input {
  top: 1px;
}
.ld-rung-group__comment-input {
  top: 15px;
}
/* Element replacement toolbar (P1): contact/coil type switcher. */
.ld-type-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--theia-menu-background, #333);
  border: 1px solid var(--theia-panel-border, #555);
  border-radius: 3px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.ld-type-switch button {
  min-width: 22px;
  padding: 1px 5px;
  font-size: 10px;
  font-family: var(--theia-ui-font-family);
  color: var(--theia-menu-foreground, #ccc);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
}
.ld-type-switch button:hover {
  background: var(--theia-menu-selectionBackground, #0e639c);
}
.ld-type-switch button.ld-type-switch__active {
  outline: 1px solid var(--theia-focusBorder, #007fd4);
  font-weight: 600;
}
.ld-node-label {
  position: absolute; /* keep the node box at 36px — a taller node gets clamped
                        inside the rung container (extent:'parent') */
  top: 38px; /* just below the node box; the A1a ▲▼ markers now hug the
                node edges (tip pokes out 1px), so the label keeps its own
                hit area for dblclick rename (A3/T16) and branch
                insert-points (y+40) stay clickable above it (T14b). */
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
  /* A3 fix: label must stay clickable for dblclick rename (T16). The branch
     insert-point (y+40) renders as a later DOM sibling of the contact node,
     so it paints above the label — the label no longer needs to be inert.
     Regression from A2 (pointer-events:none) broke dblclick rename. */
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

/* Find (P1): input + match status + node highlight classes */
.ld-find-input {
  font-size: 11px;
  font-family: var(--theia-ui-font-family);
  color: var(--theia-input-foreground, #ccc);
  background: var(--theia-input-background, #252526);
  border: 1px solid var(--theia-focusBorder, #007fd4);
  border-radius: 2px;
  padding: 2px 4px;
  width: 150px;
  outline: none;
}
.ld-find-status {
  font-size: 11px;
  color: var(--theia-descriptionForeground, #bbb);
  min-width: 56px;
}
.ld-find-status--none {
  color: var(--theia-errorForeground, #f48771);
}
.react-flow__node.ld-node--found {
  outline: 2px solid var(--ld-find-color, #ffb74d);
  outline-offset: 2px;
  border-radius: 4px;
}
/* A4 drag-replace: green highlight on the drop target while hovered. */
.react-flow__node.ld-node--replace-target {
  outline: 2px solid var(--ld-replace-color, #4caf50);
  outline-offset: 2px;
  border-radius: 4px;
  box-shadow: 0 0 8px var(--ld-replace-glow, rgba(76, 175, 80, 0.6));
}
/* P2 real-time validation (SmartCoding-style): red markers + badges */
.react-flow__node.ld-node--error {
  outline: 2px solid var(--ld-error-color, #f44336);
  outline-offset: 2px;
  border-radius: 4px;
}
.react-flow__node.ld-node--warning {
  outline: 2px solid var(--ld-warning-color, #ffb74d);
  outline-offset: 2px;
  border-radius: 4px;
}
.ld-rung-group--error {
  border-color: var(--ld-error-color, #f44336) !important;
}
.ld-rung-group--warning {
  border-color: var(--ld-warning-color, #ffb74d) !important;
}
.ld-rung-group__error-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  line-height: 14px;
  color: #fff;
  background: var(--ld-error-color, #f44336);
  border-radius: 8px;
  padding: 0 5px;
  z-index: 5;
  pointer-events: none;
}
.ld-rung-group__warning-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  line-height: 14px;
  color: #333;
  background: var(--ld-warning-color, #ffb74d);
  border-radius: 8px;
  padding: 0 5px;
  z-index: 5;
  pointer-events: none;
}
.ld-validation-badge {
  font-size: 11px;
  line-height: 18px;
  color: var(--theia-successForeground, #89d185);
  white-space: nowrap;
}
.ld-validation-badge--error {
  color: var(--ld-error-color, #f44336);
  font-weight: 600;
}
.ld-validation-badge--warning {
  color: var(--ld-warning-color, #ffb74d);
  font-weight: 600;
}
/* P2 monitoring mode: live value badges + active signal-path wires */
.ld-value-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 18px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  color: var(--theia-editor-foreground, #ccc);
  background: var(--theia-input-background, #3c3c3c);
  border: 1px solid var(--theia-panel-border, #555);
  border-radius: 8px;
  z-index: 4;
  pointer-events: none;
}
.ld-value-badge--on {
  color: #1e1e1e;
  background: var(--ld-edge-active-color, #ffc107);
  border-color: var(--ld-edge-active-color, #ffc107);
  font-weight: 700;
}
/* Cross Reference panel (P1) */
.ld-xref-panel {
  border-bottom: 1px solid var(--theia-panel-border, #444);
  background: var(--theia-sideBar-background, #252526);
  max-height: 40%;
  overflow-y: auto;
  font-size: 11px;
  font-family: var(--theia-ui-font-family);
}
.ld-xref-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  border-bottom: 1px solid var(--theia-panel-border, #444);
  font-weight: 600;
}
.ld-xref-panel__header button {
  background: transparent;
  border: none;
  color: var(--theia-foreground, #ccc);
  cursor: pointer;
  font-size: 12px;
}
.ld-xref-panel__empty {
  padding: 4px 8px;
  font-style: italic;
  color: var(--theia-descriptionForeground, #bbb);
}
.ld-xref-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 2px 8px;
  cursor: pointer;
}
.ld-xref-row:hover {
  background: var(--theia-list-hoverBackground, #2a2d2e);
}
.ld-xref-row__name {
  font-weight: 600;
  min-width: 120px;
}
.ld-xref-row__count {
  color: var(--theia-descriptionForeground, #bbb);
}
.ld-xref-row__usages {
  color: var(--theia-descriptionForeground, #bbb);
}
/* A1a: ▲▼ parallel-branch markers on contacts */
.ld-branch-marker {
  position: absolute;
  left: 50%;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  padding: 0;
  background: none;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.15s, transform 0.15s;
  z-index: 3;
}
.ld-branch-marker:hover {
  opacity: 1;
  transform: scale(1.2);
}
.ld-branch-marker--active {
  opacity: 1;
}
.ld-branch-marker--up {
  top: -1px; /* triangle hugs the node's top edge; tip pokes out 1px. Kept
                clear of the .ld-node-label (top:38px) so dblclick rename
                keeps its own hit area (A3/T16). */
  transform: translateX(-50%);
  border-bottom: 8px solid var(--ld-branch-marker, #ff9800);
}
.ld-branch-marker--up:hover {
  transform: translateX(-50%) scale(1.2);
}
.ld-branch-marker--down {
  bottom: -1px; /* same inset rationale as --up; must not overlap the
                   variable label below the node (A3/T16). */
  transform: translateX(-50%);
  border-top: 8px solid var(--ld-branch-marker, #ff9800);
}
.ld-branch-marker--down:hover {
  transform: translateX(-50%) scale(1.2);
}
/* Right-click context menu (A2). */
.ld-ctx-menu {
  position: fixed;
  z-index: 1000;
}
.ld-ctx-menu__panel {
  min-width: 160px;
  padding: 4px 0;
  background: var(--theia-menu-background, #252526);
  border: 1px solid var(--theia-menu-border, #454545);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  font-family: var(--theia-ui-font-family);
  font-size: 12px;
  color: var(--theia-menu-foreground, #ccc);
}
.ld-ctx-menu__item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 18px 4px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.ld-ctx-menu__item:hover,
.ld-ctx-menu__item.is-open {
  background: var(--theia-list-hoverBackground, #2a2d2e);
}
.ld-ctx-menu__item.is-disabled {
  opacity: 0.5;
  cursor: default;
}
.ld-ctx-menu__item.is-disabled:hover {
  background: transparent;
}
.ld-ctx-menu__label {
  flex: 1;
}
.ld-ctx-menu__caret {
  margin-left: 12px;
}
.ld-ctx-menu__sep {
  height: 1px;
  margin: 4px 0;
  background: var(--theia-menu-separatorBackground, #454545);
}
/* A2b: wire interaction surface. The transparent .ld-edge-interaction path
   is always pointer-events:auto (set inline in WireEdge) and renders in the
   edges layer, which React Flow draws BELOW the nodes layer. So a wire is
   right-clickable in open space between nodes, but nodes always win the
   hit-test where a wire passes through them. */
  .ld-edge-interaction {
  cursor: context-menu;
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
// Drag-drop target detection (A1b branch-marker drop + A4 drag-replace).
// React Flow has no native drop-target hit-testing; the shared pattern is:
// during onNodeDrag, hit-test the dragged node's center via
// document.elementsFromPoint() against a target's DOM element, cache the
// hit in a ref, and dispatch on onNodeDragStop. A4 extends DragTarget with a
// replace target (a square marker on a contact).
// ============================================================================

/**
 * Resolve a branch-marker element to its owning contact + rung.
 * The ▲▼ marker lives inside a .react-flow__node-contact[data-id=...];
 * data-id is the contact id; the rung is found from the graph.
 */
function markerToTarget(el: Element, graph: LdGraph): { contactId: string; rungId: string } | null {
    const contactEl = el.closest('.react-flow__node-contact');
    const contactId = contactEl?.getAttribute('data-id');
    if (!contactId) return null;
    const rung = graph.rungs.find((r) => r.elementIds.includes(contactId)
        || r.branches?.some((b) => b.anchorId === contactId));
    if (!rung) return null;
    return { contactId, rungId: rung.id };
}

interface DragTarget {
    kind: 'branch-marker' | 'replace';
    /** branch-marker: contact id under the ▲▼ marker; replace: target id. */
    targetId?: string;
    contactId?: string;
    rungId?: string;
}

/* A4: drop within this many flow-px of the hovered target's rendered slot
 *  counts as a replace; beyond it the drop is a reorder to a different slot.
 *  ~ half a slot width (slots are 40px). */
const DRAG_REPLACE_SLOT_RANGE = 20;

/**
 * Hit-test a screen point for a drag target. Returns the branch-marker target
 * if the point is over a ▲▼ marker (A1b), else a replace target if the point
 * is over another element node (A4 drag-replace), else null.
 */
function findDragTarget(cx: number, cy: number, graph: LdGraph, ignoreId?: string): DragTarget | null {
    const under = document.elementsFromPoint(cx, cy);
    const marker = under.find((el) => el.classList?.contains('ld-branch-marker'));
    if (marker) {
        const target = markerToTarget(marker, graph);
        return target ? { kind: 'branch-marker', ...target } : null;
    }
    // A4: drag-replace target — the point is over another element node.
    // Skip the node being dragged: when it lands dead-center on the target,
    // the topmost element at the hit point is the dragged node itself, which
    // would resolve the replace target to the source and no-op the drop.
    const nodeEl = under.find((el) => {
        if (ignoreId && el.getAttribute?.('data-id') === ignoreId) return false;
        return el.classList?.contains('react-flow__node-contact') ||
            el.classList?.contains('react-flow__node-coil') ||
            el.classList?.contains('react-flow__node-fb');
    });
    if (!nodeEl) return null;
    const targetId = nodeEl.getAttribute('data-id');
    if (!targetId) return null;
    return { kind: 'replace', targetId };
}

// ============================================================================
// Node / edge type registries (module scope: stable identity across renders)
// ============================================================================

// ============================================================================
// Node / edge type registries (module scope: stable identity across renders)
// ============================================================================

const nodeTypes: NodeTypes = {
    [RF_TYPE_CONTACT]: ContactNode,
    [RF_TYPE_COIL]: CoilNode,
    [RF_TYPE_FB]: FbNode,
    [RF_TYPE_RUNG]: RungGroupNode,
    [RF_TYPE_RAIL]: PowerRailNode,
    [RF_TYPE_INSERT]: InsertPointNode,
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
    /**
     * Compile entry point (widget routes it to the backend JSON-RPC bridge;
     * the frontend bundle cannot load the native .node addon).
     * Defaults to handler.compile for standalone/local usage.
     */
    compile?: (graph: LdGraph) => Promise<CompileResult> | CompileResult;
}
const LdCanvasInner: React.FC<LdCanvasProps> = ({
    state, handler, propertyState, controllerRef, onDirtyChange, compile: compileFn,
}) => {
    const { setNodes, setEdges, screenToFlowPosition, getInternalNode, getZoom, setCenter } = useReactFlow();
    const [graph, setGraph] = React.useState<LdGraph>(() => state.graph);
    const [pendingTool, setPendingTool] = React.useState<LdTool | null>(null);
    const [status, setStatus] = React.useState('');
    const [gridEnabled, setGridEnabled] = React.useState(true);
    /** Last compile outcome — diagnostics feed the status tooltip. */
    const [compileResult, setCompileResult] = React.useState<CompileResult | null>(null);
    const [compileBusy, setCompileBusy] = React.useState(false);
    /** Active parallel branch being edited (open → add members → close). */
    const [branchMode, setBranchMode] = React.useState<{ branchId: string; rungId: string } | null>(null);
    /** A1b/A4 shared: drag-target hit during onNodeDrag (ref, not state —
     *  avoids re-render on every mousemove). Dispatched on onNodeDragStop. */
    const dragTargetRef = React.useRef<DragTarget | null>(null);
    /** Last non-null drag target hovered during the drag. The node snaps to
     *  slot positions on drop, so the final drag frame often misses the target
     *  even though the node landed on its slot. This keeps the last hovered
     *  target (replace OR branch-marker) so the drop still dispatches it. */
    const lastDragTargetRef = React.useRef<DragTarget | null>(null);
    // ── Find (Ctrl+F) + Cross Reference (Ctrl+Shift+X) ──────
    const [findOpen, setFindOpen] = React.useState(false);
    const [findQuery, setFindQuery] = React.useState('');
    const [findIndex, setFindIndex] = React.useState(0);
    const [xrefOpen, setXrefOpen] = React.useState(false);
    /** Cross-ref click highlight: every usage of the chosen variable. */
    const [xrefFocus, setXrefFocus] = React.useState<{ ids: string[]; currentId: string } | null>(null);
    const findInputRef = React.useRef<HTMLInputElement | null>(null);
    /** Horizontal-drag constraint: original y per dragged node. */
    // ── P2 real-time validation + monitoring ─────────────────
    /** SmartCoding-style markup: which rungs/nodes carry which errors. */
    const [validation, setValidation] = React.useState<ValidationMarkup>({
        total: 0, messages: [], rungNumbers: [], rungIds: [], rungErrors: new Map(), nodeIds: [], nodeErrors: new Map(),
        warningRungNumbers: [], rungWarnings: new Map(), warningTotal: 0,
    });
    /** Monitor mode: live value badges + active signal-path wires. */
    const [monitoring, setMonitoring] = React.useState(false);
    /** Skeleton signal source (future: Runtime IPC). id → live value. */
    const [monitorValues, setMonitorValues] = React.useState<Record<string, number>>({});
    /** Right-click context menu (A2): null when closed. */
    const [ctxMenu, setCtxMenu] = React.useState<CtxMenuState | null>(null);
    /** A3: keyboard edit navigation (Tab/Enter) — { nodeId, field } target
     *  with a bumping seq so the same field re-opens on repeat keys. */
    const [editReq, setEditReq] = React.useState<{ nodeId: string; field: string; seq: number } | null>(null);
    const editSeqRef = React.useRef(0);
    /** A3: currently selected element (single selection) for Tab/Enter nav. */
    const selectedNodeRef = React.useRef<LdRfNode | null>(null);
    /** A4 drag-replace: target node id while a dragged element hovers it
     *  (green highlight). Cleared on drop/drag-start. */
    const [replaceTargetId, setReplaceTargetId] = React.useState<string | null>(null);
    /** A4: clipboard — copied element ids (main-chain only; branch members
     *  degrade to series copies on paste). */
    const clipboardRef = React.useRef<string[]>([]);
    const [clipboardStatus, setClipboardStatus] = React.useState('');

    React.useEffect(injectCanvasStyles, []);

    // Debounced validation: run immediately on mount, then 500ms after
    // every graph change (CODESYS SmartCoding pattern).
    const firstValidation = React.useRef(true);
    React.useEffect(() => {
        if (firstValidation.current) {
            firstValidation.current = false;
            setValidation(parseValidationErrors(handler.validate(graph), graph));
            return;
        }
        const timer = window.setTimeout(() => {
            setValidation(parseValidationErrors(handler.validate(graph), graph));
        }, 500);
        return () => window.clearTimeout(timer);
    }, [graph, handler]);

    // Ctrl+G grid toggle, Ctrl+F find, Ctrl+Shift+X cross-ref, Esc closes
    // find (capture phase: wins over Theia's document-level keybindings
    // while the LD widget is open).
    // A3: + Ctrl+Z/Y undo/redo (input-guarded) + Tab/Shift+Tab/Enter
    // editable-field navigation (§7.1: Tab = next field, Shift+Tab = prev,
    // Enter = open the selected field's editor).
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            const mod = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();
            const target = e.target as HTMLElement | null;
            // A3 input guard: never hijack keys while an input/textarea has
            // focus (Ctrl+Z inside an editor undoes the typing, not the
            // diagram; Tab/Enter belong to the field being edited).
            const inField = !!target && !!target.closest('input,textarea');
            if (mod && key === 'g') {
                e.preventDefault();
                setGridEnabled((v) => !v);
            } else if (mod && e.shiftKey && key === 'x') {
                e.preventDefault();
                setXrefOpen((v) => !v);
            } else if (mod && !e.shiftKey && key === 'f') {
                e.preventDefault();
                setFindOpen(true);
            } else if (e.key === 'Escape') {
                setFindOpen(false);
                setEditReq(null);
            } else if (mod && !e.shiftKey && key === 'z' && !inField) {
                e.preventDefault();
                undo();
            } else if (mod && !e.shiftKey && key === 'y' && !inField) {
                e.preventDefault();
                redo();
            } else if (mod && !e.shiftKey && key === 'c' && !inField) {
                // A4: copy selected elements (main chain only).
                e.preventDefault();
                doCopy();
            } else if (mod && !e.shiftKey && key === 'v' && !inField) {
                // A4: paste into the selected rung (or first rung) at the
                // cursor slot of the copied element's rung.
                e.preventDefault();
                doPaste();
            } else if (mod && !e.shiftKey && key === 'x' && !inField) {
                // A4: cut = copy + delete.
                e.preventDefault();
                doCut();
            } else if (!inField && (e.key === 'Tab' || e.key === 'Enter')) {
                // A3: field navigation on the currently selected element
                const sel = selectedNodeRef.current;
                if (sel) {
                    const fields = editableFieldsFor(sel);
                    if (fields.length > 0) {
                        e.preventDefault();
                        const cur = editReq?.nodeId === sel.id ? fields.indexOf(editReq.field) : -1;
                        let next: number;
                        if (e.key === 'Enter') {
                            next = cur >= 0 ? cur : 0;
                        } else {
                            const delta = e.shiftKey ? -1 : 1;
                            next = (cur + delta + fields.length) % fields.length;
                        }
                        const field = fields[next];
                        editSeqRef.current += 1;
                        setEditReq({ nodeId: sel.id, field, seq: editSeqRef.current });
                    }
                }
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    });

    // ── Find + Cross Reference (P1) ──────────────────────────

    /** Matches of the current find query (empty when find is closed). */
    const findMatches = React.useMemo<string[]>(() => {
        if (!findOpen) {
            return [];
        }
        return findVariable(graph, findQuery).map((n) => n.id);
    }, [graph, findQuery, findOpen]);

    /** Reset navigation when the query (or panel) changes. */
    React.useEffect(() => {
        setFindIndex(0);
    }, [findQuery, findOpen]);

    /** Nodes currently highlighted (find wins over cross-ref click). */
    const highlightIds = findMatches.length > 0 ? findMatches : (xrefFocus?.ids ?? []);
    const currentMatchId = findMatches.length > 0
        ? findMatches[Math.min(findIndex, findMatches.length - 1)]
        : (xrefFocus?.currentId ?? undefined);

    /** Cross-reference variable rows (alphabetical). */
    const xrefVars = React.useMemo(() => listVariables(graph), [graph]);

    const rungNumberFor = React.useCallback((nodeId: string): number => {
        const rung = graph.rungs.find((r) =>
            r.elementIds.includes(nodeId) || (r.branches ?? []).some((b) => b.elementIds.includes(nodeId)),
        );
        return rung?.rungNumber ?? 0;
    }, [graph]);

    const usageLabels = React.useCallback((nodeIds: string[]): string =>
        nodeIds.map((id) => `R${rungNumberFor(id)}`).join(', '), [rungNumberFor]);

    /** Scroll the viewport to a node (keeps the current zoom). */
    const scrollToNode = React.useCallback((nodeId: string): void => {
        const internal = getInternalNode(nodeId);
        if (!internal) {
            return;
        }
        const zoom = getZoom();
        setCenter(internal.internals.positionAbsolute.x, internal.internals.positionAbsolute.y, { zoom, duration: 300 });
    }, [getInternalNode, getZoom, setCenter]);

    /** Enter in the find input: advance to the next match. */
    const goNextMatch = React.useCallback((): void => {
        if (findMatches.length === 0) {
            return;
        }
        const next = (findIndex + 1) % findMatches.length;
        setFindIndex(next);
        scrollToNode(findMatches[next]);
    }, [findMatches, findIndex, scrollToNode]);

    /** Cross-ref row click: highlight every usage and jump to the first. */
    const jumpToVariable = React.useCallback((name: string): void => {
        const ids = findVariable(graph, name).map((n) => n.id);
        if (ids.length === 0) {
            return;
        }
        setFindOpen(false);
        setXrefFocus({ ids, currentId: ids[0] });
        scrollToNode(ids[0]);
    }, [graph, scrollToNode]);

    /** Focus + select the find input whenever the panel opens. */
    React.useEffect(() => {
        if (findOpen) {
            findInputRef.current?.focus();
            findInputRef.current?.select();
        }
    }, [findOpen]);

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

    const changeContactType = React.useCallback((elementId: string, type: string): void => {
        const newType = type === 'NC' ? ContactType.NC
            : type === 'P' ? ContactType.P
            : type === 'N' ? ContactType.N
            : ContactType.NO;
        tryApply((g) => handler.changeContactType(g, { elementId, newType }));
    }, [tryApply, handler]);

    const changeCoilType = React.useCallback((elementId: string, type: string): void => {
        const newType = type === 'Negated' ? CoilType.Negated
            : type === 'Set' ? CoilType.Set
            : type === 'Reset' ? CoilType.Reset
            : CoilType.Normal;
        tryApply((g) => handler.changeCoilType(g, { elementId, newType }));
    }, [tryApply, handler]);

    const setRungTitle = React.useCallback((rungId: string, title: string): void => {
        tryApply((g) => handler.setRungTitle(g, { rungId, title }));
    }, [tryApply, handler]);

    const setRungComment = React.useCallback((rungId: string, comment: string): void => {
        tryApply((g) => handler.setRungComment(g, { rungId, comment }));
    }, [tryApply, handler]);

    const setElementComment = React.useCallback((elementId: string, comment: string): void => {
        tryApply((g) => handler.setElementComment(g, { elementId, comment }));
    }, [tryApply, handler]);

    // A1a/A1b shared: open a parallel branch at a contact and auto-add the
    // first member (selected tool type, else clone the anchor type).
    const openBranchFromMarker = React.useCallback((contactId: string, rungId: string): void => {
        const rung = graph.rungs.find((r) => r.id === rungId);
        const existing = rung?.branches?.find((b) => b.anchorId === contactId);
        if (existing) {
            setBranchMode({ branchId: existing.id, rungId });
            setPendingTool(null);
            setStatus('Branch reopened — click a green marker below a contact, then Close/Cancel');
            return;
        }
        const opened = tryApply((g) => handler.openBranch(g, { rungId, anchorId: contactId }));
        if (!opened) return;
        const branch = opened.rungs
            .find((r) => r.id === rungId)?.branches?.find((b) => b.anchorId === contactId);
        if (!branch) return;
        const anchor = opened.nodes.find((n) => n.id === contactId);
        const anchorType = anchor && 'contactType' in anchor ? String(anchor.contactType) : undefined;
        const toolType = pendingTool ? CONTACT_TYPE_BY_TOOL[pendingTool] : undefined;
        const contactType = toolType ?? (anchorType as ContactType | undefined);
        tryApply((g) => handler.addBranchContact(g, { branchId: branch.id, contactType }));
        setBranchMode({ branchId: branch.id, rungId });
        setPendingTool(null);
        setStatus('Branch open — click a green marker below a contact, then Close Branch');
    }, [graph.rungs, pendingTool, tryApply, handler]);

    // Stable identity for graphToFlow — the useCallback deps above are all stable.
    const flowCallbacks: LdFlowCallbacks = {
        renameVar,
        changeContactType,
        changeCoilType,
        setRungTitle,
        setRungComment,
        setElementComment,
        openBranchFromContact: openBranchFromMarker,
    };

    // Sync LdGraph changes into the React Flow store (uncontrolled mode:
    // defaultNodes on mount, imperative setNodes/setEdges afterwards).
    // P2: also folds in validation markers (ld-node--error, rung badges) and
    // monitoring data (value badges + active wire flags) in one pass.
    React.useEffect(() => {
        const flow = graphToFlow(graph, flowCallbacks);
        const found = new Set(highlightIds);
        const errorNodeIds = new Set(validation.nodeIds);
        const errorRungIds = new Set(validation.rungIds);
        const rungIdByNumber = new Map<number, string>();
        for (const r of graph.rungs) rungIdByNumber.set(r.rungNumber, r.id);
        const hasRuntimeValues = Object.keys(monitorValues).length > 0;

        const nodes = flow.nodes.map((n) => {
            let className: string | undefined;
            if (found.has(n.id)) {
                className = n.id === currentMatchId
                    ? 'ld-node--found ld-node--current-match'
                    : 'ld-node--found';
            }
            // A4 drag-replace: green highlight on the hovered drop target.
            if (replaceTargetId === n.id) {
                className = className ? `${className} ld-node--replace-target` : 'ld-node--replace-target';
            }
            let data = n.data;
            // Rung-level errors: rung id from markup, or rungNumber lookup.
            const rungNumber = typeof n.data.rungNumber === 'number' ? n.data.rungNumber : 0;
            const rungErrorIds = errorRungIds.has(n.id)
                ? [n.id]
                : (rungNumber > 0 && validation.rungNumbers.includes(rungNumber) ? [n.id] : []);
            if (rungErrorIds.length > 0) {
                const rungErrors = validation.rungErrors.get(rungNumber) ?? [];
                if (rungErrors.length > 0) {
                    className = className ? `${className} ld-node--error` : 'ld-node--error';
                    data = { ...data, errorCount: rungErrors.length, errorTitle: rungErrors.join('\n') };
                }
            }
            if (errorNodeIds.has(n.id)) {
                const nodeErrors = validation.nodeErrors.get(n.id) ?? [];
                className = className ? `${className} ld-node--error` : 'ld-node--error';
                data = { ...data, errorTitle: nodeErrors.join('\n') };
            }
            // Warnings (e.g. empty rung): inject data only — the visual
            // highlight (yellow border + badge) is rendered inside
            // RungGroupNode, which shows it only for the selected rung
            // (avoids every empty rung glowing at once).
            if (rungNumber > 0 && validation.warningRungNumbers.includes(rungNumber)) {
                const rungWarn = validation.rungWarnings.get(rungNumber) ?? [];
                if (rungWarn.length > 0) {
                    data = { ...data, warningCount: rungWarn.length, warningTitle: rungWarn.join('\n') };
                }
            }
            // Monitor mode: inject the live value into contact/coil data.
            if (monitoring && (n.type === RF_TYPE_CONTACT || n.type === RF_TYPE_COIL)) {
                data = { ...data, monitoring: true, value: monitorValues[n.id] ?? 0 };
            }
            // A3: keyboard edit navigation — inject the current request so
            // the node component can open its editor (seq-guarded).
            if (editReq && n.id === editReq.nodeId) {
                data = { ...data, editRequest: { field: editReq.field, seq: editReq.seq } };
            }
            if (data === n.data && className === undefined) {
                return n;
            }
            return { ...n, className, data };
        });
        // Insertion points (D112 T2.2): while a series tool is pending, show
        // a diamond on every legal series slot of every rung. Absolute flow
        // coords (not rung children) so extent:'parent' cannot clamp them.
        // Built from the SAME `nodes` array so a concurrent placement never
        // loses the just-created element (atomic setNodes below).
        const baseNodes = nodes;
        const finalNodes = baseNodes.filter((n) => n.type !== RF_TYPE_INSERT);
        if (pendingTool && pendingTool !== 'branch') {
            const slotNodes: LdRfNode[] = [];
            const lay = layoutGraph(graph);
            graph.rungs.forEach((rung, ri) => {
                const rungTop = lay.rungTops.get(rung.id) ?? 0;
                // Series slots: before each non-coil element, plus one tail.
                const series = rung.elementIds.filter((id) => {
                    const n = graph.nodes.find((nn) => nn.id === id);
                    return n && n.type !== 'node:coil';
                });
                const positions = lay.positions;
                const xs = series.map((id) => positions.get(id)?.x ?? 40);
                const rungH = rung ? (lay.rungHeights.get(rung.id) ?? 76) : 76;
                const slotY = rungTop + Math.min(40, rungH - 20);
                // slot 0..n: left of first element, between elements, tail
                for (let i = 0; i <= series.length; i++) {
                    const x = i === 0 ? (xs[0] ?? 40) - 30 : (xs[i] ?? (xs[xs.length - 1] ?? 40) + 80) - 30;
                    slotNodes.push({
                        id: `insert-${ri}-${i}`,
                        type: RF_TYPE_INSERT,
                        position: { x, y: slotY },
                        data: { rungId: rung.id, insertIndex: i } as InsertPointData,
                        draggable: false,
                        selectable: true,
                        // Above .ld-node-label (top:38px) — the label is
                        // clickable for dblclick rename (A3/T16) and must not
                        // swallow the insertion diamonds.
                        zIndex: 5,
                    });
                }
            });
            // Replace, not append: clear stale insert nodes first so the
            // marker set always matches the current graph/rungs.
            finalNodes.push(...slotNodes);
        } else if (branchMode) {
            // Branch mode (D112 T2.4): green markers under each series contact
            // of the branch's rung — clicking adds a branch member.
            const lay = layoutGraph(graph);
            const rung = graph.rungs.find((r) => r.id === branchMode.rungId);
            const rungTop = rung ? (lay.rungTops.get(rung.id) ?? 0) : 0;
            const contacts = (rung?.elementIds ?? []).filter((id) => {
                const n = graph.nodes.find((nn) => nn.id === id);
                return n?.type === 'node:contact';
            });
            contacts.forEach((cid, idx) => {
                const p = lay.positions.get(cid);
                if (!p) return;
                // Marker below the anchor at the branch-member row (rungHeight
                // reserves this row for an open branch, so it is visible).
                finalNodes.push({
                    id: `branch-insert-${idx}`,
                    type: RF_TYPE_INSERT,
                    position: { x: p.x - 7, y: p.y + 40 },
                    data: { rungId: branchMode.rungId, branchAnchorId: cid } as InsertPointData,
                    draggable: false,
                    selectable: true,
                    // Above .ld-node-label (top:38px) — dblclick rename
                    // (A3/T16) and branch placement must coexist.
                    zIndex: 5,
                });
            });
        }
        setNodes(finalNodes);

        // Flow highlighting: wire is active when its source carries a truthy
        // value; with no runtime values injected yet, alternate for the demo.
        const edges = flow.edges.map((e, i) => {
            if (!monitoring) return e;
            const active = hasRuntimeValues
                ? (monitorValues[e.source] ?? 0) !== 0
                : i % 2 === 0; // ponytail: demo pattern until Runtime injects values
            if (!active) return e;
            return { ...e, data: { ...e.data, active: true } };
        });
        setEdges(edges);
    }, [graph, setNodes, setEdges, renameVar, highlightIds, currentMatchId, monitoring, monitorValues, validation, pendingTool, branchMode, editReq, replaceTargetId]);


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

    // ── A4: Copy / Paste / Cut ───────────────────────────────

    /** Copy the selected elements (main chain only; branch members degrade
     *  to series copies on paste — v3). Records ids in the clipboard ref.
     */
    const doCopy = React.useCallback((): void => {
        const sel = selectedNodeRef.current;
        if (!sel || sel.type === RF_TYPE_RUNG || sel.type === RF_TYPE_RAIL) {
            setClipboardStatus('Copy: select a contact, coil or FB');
            return;
        }
        clipboardRef.current = [sel.id];
        setClipboardStatus('Copied');
    }, []);

    /** Paste the clipboard into the target rung at a topology slot.
     *  Target: selected rung, else the rung the copied element came from,
     *  else the first rung. Slot: after the selected element (or rung tail).
     */
    const doPaste = React.useCallback((): void => {
        const ids = clipboardRef.current;
        if (ids.length === 0) {
            setClipboardStatus('Paste: nothing copied');
            return;
        }
        // Target rung + slot from the current selection.
        const sel = selectedNodeRef.current;
        let rungId: string | undefined;
        let insertIndex = Number.MAX_SAFE_INTEGER;
        if (sel && sel.type === RF_TYPE_RUNG) {
            rungId = sel.id;
            insertIndex = graph.rungs.find((r) => r.id === sel.id)?.elementIds.length ?? 0;
        } else if (sel) {
            const rung = graph.rungs.find((r) => r.elementIds.includes(sel.id));
            if (rung) {
                rungId = rung.id;
                const idx = rung.elementIds.indexOf(sel.id);
                insertIndex = idx >= 0 ? idx + 1 : rung.elementIds.length;
            }
        }
        if (!rungId) {
            rungId = graph.rungs[0]?.id;
            insertIndex = 0;
        }
        tryApply((g) => handler.pasteElements(g, { elementIds: ids, rungId, insertIndex }));
        setClipboardStatus('Pasted');
    }, [tryApply, handler, graph]);

    /** Cut = copy + delete (single selection). */
    const doCut = React.useCallback((): void => {
        const sel = selectedNodeRef.current;
        if (!sel || sel.type === RF_TYPE_RUNG || sel.type === RF_TYPE_RAIL) {
            setClipboardStatus('Cut: select a contact, coil or FB');
            return;
        }
        clipboardRef.current = [sel.id];
        tryApply((g) => handler.deleteElement(g, { elementId: sel.id }));
        setClipboardStatus('Cut');
    }, [tryApply, handler]);

    const addRung = React.useCallback((): void => {
        tryApply((g) => handler.addRung(g));
    }, [tryApply, handler]);

    // ── Compile (T7/T7b) ──────────────────────────────────────

    const runCompile = React.useCallback(async (): Promise<void> => {
        setCompileBusy(true);
        try {
            const result = compileFn ? await compileFn(state.graph) : handler.compile(state.graph);
            setCompileResult(result);
            if (result.success) {
                setStatus('Compile OK');
            } else {
                const errors = result.diagnostics.filter((d) => d.severity === 'error').length;
                const warnings = result.diagnostics.filter((d) => d.severity === 'warning').length;
                setStatus(`Compile: ${errors} errors, ${warnings} warnings`);
            }
        } catch (err) {
            setCompileResult(null);
            setStatus(`Compile failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setCompileBusy(false);
        }
    }, [compileFn, handler, state]);

    // ── Parallel branch flow ──────────────────────────────────

    const openBranchAt = React.useCallback((anchorNodeId: string, rungId: string): void => {
        // RC1 (D112): allow re-opening an EXISTING branch. openBranchAt is the
        // only entry into branch mode, and handler.openBranch throws when the
        // anchor already has a branch — so a closed branch was permanently frozen
        // (no way to add members or delete the branch). Look up the existing
        // branch first and re-enter it directly instead of calling openBranch.
        const rung = graph.rungs.find((r) => r.id === rungId);
        const existing = rung?.branches?.find((b) => b.anchorId === anchorNodeId);
        if (existing) {
            // Re-enter the existing branch (skip handler.openBranch — it throws).
            setBranchMode({ branchId: existing.id, rungId });
            setPendingTool(null);
            setStatus('Branch reopened — click a green marker below a contact, then Close/Cancel');
            return;
        }
        const next = tryApply((g) => handler.openBranch(g, { rungId, anchorId: anchorNodeId }));
        if (!next) {
            return;
        }
        const updatedRung = next.rungs.find((r) => r.id === rungId);
        const branch = updatedRung?.branches?.find((b) => b.anchorId === anchorNodeId);
        if (branch) {
            setBranchMode({ branchId: branch.id, rungId });
            setPendingTool(null);
            setStatus('Branch open — click a green marker below a contact, then Close Branch');
        }
    }, [graph.rungs, tryApply, handler]);

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
            const targetRung = next.rungs[rungIndex];
            // Topology (D112): derive the insertion slot from the click x,
            // not a free position.
            const insertIndex = findInsertIndex(next, targetRung, flowPos.x);
            if (CONTACT_TYPE_BY_TOOL[tool]) {
                return handler.addContact(next, {
                    insertIndex,
                    type: CONTACT_TYPE_BY_TOOL[tool],
                    rungId,
                });
            }
            if (tool.startsWith('fb-')) {
                return handler.addFb(next, {
                    insertIndex,
                    fbType: tool.slice(3),
                    rungId,
                });
            }
            // Coil: pinned to the coil zone (append — addCoil enforces order).
            return handler.addCoil(next, {
                type: COIL_TYPE_BY_TOOL[tool],
                rungId,
            });
        });
    }, [tryApply, handler]);

    const onPaneClick = React.useCallback((): void => {
        if (branchMode) {
            setStatus('Branch members are added via the green markers below the anchor');
            return;
        }
        // Topology (D112): free-form pane placement is gone — elements are
        // placed ONLY by clicking the diamond insertion markers.
        if (pendingTool) {
            setPendingTool(null);
            setStatus('');
        }
    }, [branchMode, pendingTool]);

    const onNodeClick = React.useCallback((event: React.MouseEvent, node: LdRfNode): void => {
        // Insertion markers place regardless of pendingTool (branch markers
        // work in branchMode, which cleared pendingTool via openBranchAt).
        if (node.type === RF_TYPE_INSERT) {
            const d = node.data as unknown as InsertPointData;
            if (typeof d.branchAnchorId === 'string' && d.branchAnchorId) {
                if (branchMode && d.rungId === branchMode.rungId) {
                    const next = tryApply((g) => handler.addBranchContact(g, { branchId: branchMode.branchId }));
                    if (next) setStatus('Contact added to branch — add more or Close Branch');
                }
                return;
            }
            const rungId = typeof d.rungId === 'string' ? d.rungId : '';
            const insertIndex = typeof d.insertIndex === 'number' ? d.insertIndex : 0;
            if (pendingTool && rungId) {
                tryApply((g) => {
                    let next = g;
                    if (next.rungs.length === 0) next = handler.addRung(next);
                    if (CONTACT_TYPE_BY_TOOL[pendingTool]) {
                        return handler.addContact(next, { insertIndex, type: CONTACT_TYPE_BY_TOOL[pendingTool], rungId });
                    }
                    if (pendingTool.startsWith('fb-')) {
                        return handler.addFb(next, { insertIndex, fbType: pendingTool.slice(3), rungId });
                    }
                    return handler.addCoil(next, { type: COIL_TYPE_BY_TOOL[pendingTool], rungId });
                });
            }
            setPendingTool(null);
            return;
        }
        if (!pendingTool) {
            return;
        }
        if (pendingTool === 'branch') {
            if (node.type !== RF_TYPE_CONTACT || !node.parentId) {
                setStatus('Open Branch: click a contact on the rung');
                return;
            }
            // RC2: don't silently abandon an open branch by switching anchors.
            if (branchMode) {
                setStatus('A branch is already open — Close or Cancel it before opening another');
                return;
            }
            openBranchAt(node.id, node.parentId);
            return;
        }
        // Topology (D112): only diamond markers place elements. Clicking a
        // rung/contact body with a series tool pending is a no-op — the
        // diamond markers are the only insertion targets (CODESYS-style).
        setStatus('Click a diamond marker to place the element');
    }, [pendingTool, branchMode, openBranchAt, tryApply, handler]);

    // ── Right-click context menu (A2) ───────────────────────
    const onNodeContextMenu = React.useCallback((event: React.MouseEvent, node: LdRfNode): void => {
        event.preventDefault();
        const type = node.type;
        if (type === RF_TYPE_RUNG) {
            setCtxMenu({ x: event.clientX, y: event.clientY, kind: 'rung', rungId: node.id });
            return;
        }
        if (type !== RF_TYPE_CONTACT && type !== RF_TYPE_COIL) {
            return;
        }
        const parentId = typeof node.parentId === 'string' ? node.parentId : undefined;
        setCtxMenu({
            x: event.clientX,
            y: event.clientY,
            kind: 'node',
            nodeType: type,
            nodeId: node.id,
            rungId: parentId,
            variableName: String(node.data.variableName ?? ''),
            contactType: String(node.data.contactType ?? 'NO'),
            coilType: String(node.data.coilType ?? 'Normal'),
        });
    }, []);

    const onEdgeContextMenu = React.useCallback((event: React.MouseEvent, edge: LdRfEdge): void => {
        event.preventDefault();
        const src = graph.nodes.find((n) => n.id === edge.source);
        const variableName = src && 'variableName' in src ? String(src.variableName) : '';
        setCtxMenu({ x: event.clientX, y: event.clientY, kind: 'edge', edgeId: edge.id, variableName });
    }, [graph]);

    const onPaneContextMenu = React.useCallback((event: MouseEvent | React.MouseEvent<Element, MouseEvent>): void => {
        event.preventDefault();
        setCtxMenu({ x: event.clientX, y: event.clientY, kind: 'pane' });
    }, []);

    const ctxMenuActions: LdContextMenuActions = React.useMemo(() => ({
        rename: (id, currentName) => {
            const name = window.prompt('Variable name', currentName);
            if (name) {
                renameVar(id, name);
            }
        },
        changeContactType,
        changeCoilType,
        delete: (id) => {
            tryApply((g) => handler.deleteElement(g, { elementId: id }));
        },
        crossRef: (name) => {
            if (name) {
                jumpToVariable(name);
            }
        },
        openBranch: (rungId) => {
            const rung = graph.rungs.find((r) => r.id === rungId);
            if (!rung) {
                return;
            }
            const coilIds = new Set(graph.nodes.filter((n) => n.type === 'node:coil').map((n) => n.id));
            const anchorId = [...rung.elementIds].reverse().find((id) => !coilIds.has(id));
            if (!anchorId) {
                setStatus('Open Branch: the rung has no contact to anchor on');
                return;
            }
            openBranchFromMarker(anchorId, rungId);
        },
        closeBranch: (rungId) => {
            const rung = graph.rungs.find((r) => r.id === rungId);
            const branch = rung?.branches?.find((b) => b.elementIds.length > 0);
            if (!branch) {
                setStatus('Close Branch: no open branch on this rung');
                return;
            }
            tryApply((g) => handler.closeBranch(g, { branchId: branch.id }));
            setStatus('Branch closed (OR logic)');
        },
        insertNetwork: addRung,
        undo,
        redo,
        copy: (nodeId) => {
            clipboardRef.current = [nodeId];
            setClipboardStatus('Copied');
        },
        paste: doPaste,
        outcomment: (rungId) => setStatus('Outcommented — not yet in the model'),
        addParallelBranch: (edgeId) => {
            const edge = graph.edges.find((e) => e.id === edgeId);
            if (!edge) {
                return;
            }
            const rung = graph.rungs.find((r) => r.elementIds.includes(edge.sourceId));
            if (!rung) {
                setStatus('Add Parallel Branch: wire source is not on a rung');
                return;
            }
            openBranchFromMarker(edge.sourceId, rung.id);
        },
    }), [renameVar, changeContactType, changeCoilType, tryApply, handler, graph,
        openBranchFromMarker, addRung, undo, redo, jumpToVariable, setStatus, doCopy, doPaste]);

    // A1b/A4 shared drag infra: during onNodeDrag, hit-test the dragged
    // node's center against the target's DOM element (React Flow has no
    // native drop-target API). The hit is cached in dragTargetRef (a ref,
    // not state — avoids re-render per mousemove) and dispatched on stop.
    const onNodeDragStart = React.useCallback((_: unknown, node: LdRfNode): void => {
        dragTargetRef.current = null;
        lastDragTargetRef.current = null;
        setReplaceTargetId(null);
    }, []);

    const onNodeDrag = React.useCallback((_: unknown, node: LdRfNode): void => {
        if (node.type !== RF_TYPE_CONTACT && node.type !== RF_TYPE_FB && node.type !== RF_TYPE_COIL) {
            return;
        }
        const el = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const target = findDragTarget(cx, cy, graph, node.id);
        dragTargetRef.current = target;
        if (target) lastDragTargetRef.current = target;
        // A4: green highlight on the replace target while hovering.
        setReplaceTargetId(target?.kind === 'replace' ? (target.targetId ?? null) : null);
    }, [graph]);

    // Drag-migration (D112 T2.5): on drop, snap the element to the nearest
    // insertion slot of the rung it landed in (reorder, not free placement).
    // A1b: if the drop landed on a branch-marker target, open a branch there.
    // A4: if the node hovered another element during the drag, replace it.
    const onNodeDragStop = React.useCallback((_: unknown, node: LdRfNode): void => {
        setReplaceTargetId(null);
        // The per-move DOM hit test is unreliable for the final frame: the node
        // snaps to slot positions on drop (insert-only placement), so it settles
        // beside the target rather than overlapping it. Prefer the last hovered
        // target of the drag (replace or branch-marker) — but only when the
        // drop actually lands on that target's slot. A drag that merely
        // transits past a node to a further slot must reorder, not replace.
        let target: DragTarget | null = null;
        const last = lastDragTargetRef.current;
        if (last) {
            // Compare the drop against the target's RENDERED slot x (the graph
            // model keeps the fixture x, which differs from the layout x). The
            // node snaps to slot positions at drop, so landing within half a
            // slot of the hovered target means "on its slot".
            const anchorId = last.kind === 'branch-marker' ? last.contactId : last.targetId;
            const anchorEl = anchorId ? document.querySelector(`.react-flow__node[data-id="${anchorId}"]`) : null;
            const anchorX = anchorEl ? parseFloat((anchorEl as HTMLElement).style.transform?.match(/translate\((-?[\d.]+)px/)?.[1] ?? 'NaN') : NaN;
            if (!Number.isNaN(anchorX) && Math.abs(node.position.x - anchorX) <= DRAG_REPLACE_SLOT_RANGE) {
                target = last;
            }
        }
        // Fall back to a DOM hit test (covers drops that truly overlap a node
        // without any slot-snap race).
        if (!target) {
            const el = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
            if (el) {
                const rect = el.getBoundingClientRect();
                target = findDragTarget(rect.left + rect.width / 2, rect.top + rect.height / 2, graph, node.id);
            }
        }
        if (!target) target = dragTargetRef.current;
        dragTargetRef.current = null;
        lastDragTargetRef.current = null;
        if (target && target.kind === 'branch-marker') {
            openBranchFromMarker(target.contactId ?? '', target.rungId ?? '');
            return;
        }
        if (node.type !== RF_TYPE_CONTACT && node.type !== RF_TYPE_FB && node.type !== RF_TYPE_COIL) {
            return;
        }
        // A4 drag-replace: the dragged element A was dropped on element B.
        // B keeps its id + connections; its definition becomes A's. A is
        // consumed (deleted). Only same-type replacements are legal.
        if (target && target.kind === 'replace' && target.targetId && target.targetId !== node.id) {
            const src = graph.nodes.find((n) => n.id === node.id);
            if (!src) return;
            tryApply((g) => {
                const next = handler.replaceElement(g, { targetId: target.targetId ?? '', replacement: src });
                return handler.deleteElement(next, { elementId: node.id });
            });
            setStatus('Element replaced');
            return;
        }
        const parentId = typeof node.parentId === 'string' ? node.parentId : '';
        if (!parentId) return;
        // node.position is rung-relative (extent:'parent' child); the rung
        // container sits at x=0, so it is also the slot x for findInsertIndex.
        const slotX = node.position.x;
        tryApply((g) => {
            const rung = g.rungs.find((r) => r.id === parentId);
            if (!rung) return g;
            const slot = findInsertIndex(g, rung, slotX);
            return handler.reorderElement(g, { elementId: node.id, insertIndex: slot });
        });
    }, [tryApply, handler, openBranchFromMarker, graph, setStatus]);

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
                    comment: String(element.data.comment ?? ''),
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
                    comment: String(element.data.comment ?? ''),
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
                return { id: rung.id, elementType: 'rung', rungNumber: rung.rungNumber, comment: rung.comment ?? '', title: rung.title ?? '' };
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
        // A3: track single-selection for Tab/Enter field navigation.
        selectedNodeRef.current = params.nodes.length === 1 ? params.nodes[0] : null;
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
                // Rung id → rung comment; any other element id → element comment.
                tryApply((g) => {
                    if (g.rungs.some((r) => r.id === elementId)) {
                        return handler.setRungComment(g, { rungId: elementId, comment: value });
                    }
                    return handler.setElementComment(g, { elementId, comment: value });
                });
                return;
            }
            if (property === 'title') {
                tryApply((g) => handler.setRungTitle(g, { rungId: elementId, title: value }));
                return;
            }
            if (property === 'coilType') {
                const newType = value === 'Negated' ? CoilType.Negated
                    : value === 'Set' ? CoilType.Set
                    : value === 'Reset' ? CoilType.Reset
                    : CoilType.Normal;
                tryApply((g) => handler.changeCoilType(g, { elementId, newType }));
                return;
            }
            // fbType: plain node field update
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

    const initialFlow = React.useMemo(() => graphToFlow(graph, flowCallbacks), []); // eslint-disable-line react-hooks/exhaustive-deps

    const diagnosticsTitle = compileResult && !compileResult.success && compileResult.diagnostics.length > 0
        ? compileResult.diagnostics.map((d) => `[${d.code}] ${d.message}`).join('\n')
        : undefined;

    return (
        <div className={gridEnabled ? 'ld-editor-root' : 'ld-editor-root ld-grid--disabled'}>
            <div className="ld-toolbar">
                <button onClick={undo} disabled={state.undoDepth === 0} title="Undo">Undo</button>
                <button onClick={redo} disabled={state.redoDepth === 0} title="Redo">Redo</button>
                <button onClick={addRung} title="Add a rung at the bottom">Add Rung</button>
                <button
                    onClick={() => setGridEnabled((v) => !v)}
                    className={gridEnabled ? 'ld-toolbar__tool--active' : ''}
                    title="Toggle grid snapping (Ctrl+G)"
                >
                    Toggle Grid
                </button>
                <button onClick={runCompile} disabled={compileBusy} title="Compile the diagram (LD → HalProgram)">
                    Compile
                </button>
                <button
                    onClick={() => setFindOpen((v) => !v)}
                    className={findOpen ? 'ld-toolbar__tool--active' : ''}
                    title="Find variable (Ctrl+F)"
                >
                    Find
                </button>
                <button
                    onClick={() => setXrefOpen((v) => !v)}
                    className={xrefOpen ? 'ld-toolbar__tool--active' : ''}
                    title="Variable cross reference (Ctrl+Shift+X)"
                >
                    Cross Ref
                </button>
                <button
                    onClick={() => setMonitoring((v) => !v)}
                    className={monitoring ? 'ld-toolbar__tool--active' : ''}
                    title="Monitor mode — live value badges and active signal paths (values come from the Runtime in a future integration)"
                >
                    Monitor
                </button>
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
                {findOpen && (
                    <>
                        <input
                            ref={findInputRef}
                            className="ld-find-input"
                            value={findQuery}
                            placeholder="Find variable…"
                            onChange={(e) => setFindQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    goNextMatch();
                                }
                            }}
                        />
                        <span className={findQuery.trim().length > 0 && findMatches.length === 0 ? 'ld-find-status ld-find-status--none' : 'ld-find-status'}>
                            {findQuery.trim().length === 0 ? '' : findMatches.length === 0 ? 'No matches' : `${Math.min(findIndex, findMatches.length - 1) + 1}/${findMatches.length}`}
                        </span>
                    </>
                )}
                <span
                    className={validation.total > 0 ? 'ld-validation-badge ld-validation-badge--error' : (validation.warningTotal > 0 ? 'ld-validation-badge ld-validation-badge--warning' : 'ld-validation-badge')}
                    title={validation.messages.length > 0 ? validation.messages.join('\n') : [...validation.rungWarnings.values()].flat().join('\n') || undefined}
                >
                    {validation.total > 0 ? `⚠ ${validation.total} error${validation.total === 1 ? '' : 's'}` : validation.warningTotal > 0 ? `⚠ ${validation.warningTotal} warning${validation.warningTotal === 1 ? '' : 's'}` : '✓'}
                </span>
                <div className="ld-status" title={diagnosticsTitle}>{status}</div>
            </div>
            {xrefOpen && (
                <div className="ld-xref-panel">
                    <div className="ld-xref-panel__header">
                        <span>Cross Reference</span>
                        <button onClick={() => setXrefOpen(false)} title="Close (Ctrl+Shift+X)">×</button>
                    </div>
                    {xrefVars.length === 0 && (
                        <div className="ld-xref-panel__empty">No variables in diagram</div>
                    )}
                    {xrefVars.map((v) => (
                        <div key={v.name} className="ld-xref-row" onClick={() => jumpToVariable(v.name)}>
                            <span className="ld-xref-row__name">{v.name}</span>
                            <span className="ld-xref-row__count">{v.count}</span>
                            <span className="ld-xref-row__usages">{usageLabels(v.nodeIds)}</span>
                        </div>
                    ))}
                </div>
            )}
            <ReactFlow
                defaultNodes={initialFlow.nodes}
                defaultEdges={initialFlow.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{}}
                nodesConnectable={false}
                // v12 default is only 'Backspace'; E2E and keyboard users press Delete
                deleteKeyCode={['Delete', 'Backspace']}
                // dblclick means EDIT (rung title/comment, node rename), never zoom.
                // RF only adds `nopan` to DRAGGABLE nodes, so a non-draggable rung
                // lets d3-zoom's dblclick.zoom handler stopImmediatePropagation and
                // swallow the dblclick before React sees it (ld-editor P1 pitfall).
                zoomOnDoubleClick={false}
                fitView
                onPaneClick={onPaneClick}
                onNodeClick={onNodeClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onPaneContextMenu={onPaneContextMenu}
                onDelete={onDelete}
                onSelectionChange={onSelectionChange}
                className={pendingTool || branchMode ? 'ld-canvas--placing' : undefined}
            >
                <Background variant={gridEnabled ? BackgroundVariant.Dots : BackgroundVariant.Lines} gap={LD_GRID.x} size={1} />
                <Controls />
                <MiniMap pannable zoomable />
            </ReactFlow>
            {ctxMenu && (
                <LdContextMenu
                    menu={ctxMenu}
                    actions={ctxMenuActions}
                    onClose={() => setCtxMenu(null)}
                />
            )}
        </div>
    );
};

export const LdCanvas: React.FC<LdCanvasProps> = (props) => (
    <ReactFlowProvider>
        <LdCanvasInner {...props} />
    </ReactFlowProvider>
);
