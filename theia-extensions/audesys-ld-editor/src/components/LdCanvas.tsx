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
/** Mutation callbacks passed through to node components (stable identities). */
export interface LdFlowCallbacks {
    renameVar?: (id: string, name: string) => void;
    changeContactType?: (id: string, type: string) => void;
    changeCoilType?: (id: string, type: string) => void;
    setRungTitle?: (id: string, title: string) => void;
    setRungComment?: (id: string, comment: string) => void;
    setElementComment?: (id: string, comment: string) => void;
}

function contactFlowNode(
    contact: ContactModelNode,
    rungId: string,
    cb: LdFlowCallbacks,
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
            comment: contact.comment ?? '',
            onRename: cb.renameVar,
            onChangeType: cb.changeContactType,
        },
    };
}

function coilFlowNode(
    coil: CoilModelNode,
    rungId: string,
    cb: LdFlowCallbacks,
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
            comment: coil.comment ?? '',
            onRename: cb.renameVar,
            onChangeType: cb.changeCoilType,
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
    cb: LdFlowCallbacks = {},
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

        for (const elementId of rung.elementIds) {
            const modelNode = graph.nodes.find((n) => n.id === elementId);
            if (!modelNode) {
                continue;
            }
            if (modelNode.type === 'node:contact') {
                nodes.push(contactFlowNode(modelNode as ContactModelNode, rung.id, cb));
                nodeIds.add(modelNode.id);
            } else if (modelNode.type === 'node:coil') {
                nodes.push(coilFlowNode(modelNode as CoilModelNode, rung.id, cb));
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
                nodes.push(contactFlowNode(modelNode as ContactModelNode, rung.id, cb));
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
/* P2 real-time validation (SmartCoding-style): red markers + badges */
.react-flow__node.ld-node--error {
  outline: 2px solid var(--ld-error-color, #f44336);
  outline-offset: 2px;
  border-radius: 4px;
}
.ld-rung-group--error {
  border-color: var(--ld-error-color, #f44336) !important;
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
    // ── Find (Ctrl+F) + Cross Reference (Ctrl+Shift+X) ──────
    const [findOpen, setFindOpen] = React.useState(false);
    const [findQuery, setFindQuery] = React.useState('');
    const [findIndex, setFindIndex] = React.useState(0);
    const [xrefOpen, setXrefOpen] = React.useState(false);
    /** Cross-ref click highlight: every usage of the chosen variable. */
    const [xrefFocus, setXrefFocus] = React.useState<{ ids: string[]; currentId: string } | null>(null);
    const findInputRef = React.useRef<HTMLInputElement | null>(null);
    /** Horizontal-drag constraint: original y per dragged node. */
    const dragStartY = React.useRef<Map<string, number>>(new Map());
    // ── P2 real-time validation + monitoring ─────────────────
    /** SmartCoding-style markup: which rungs/nodes carry which errors. */
    const [validation, setValidation] = React.useState<ValidationMarkup>({
        total: 0, messages: [], rungNumbers: [], rungIds: [], rungErrors: new Map(), nodeIds: [], nodeErrors: new Map(),
    });
    /** Monitor mode: live value badges + active signal-path wires. */
    const [monitoring, setMonitoring] = React.useState(false);
    /** Skeleton signal source (future: Runtime IPC). id → live value. */
    const [monitorValues, setMonitorValues] = React.useState<Record<string, number>>({});

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
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            const mod = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();
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
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, []);

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

    // Stable identity for graphToFlow — the useCallback deps above are all stable.
    const flowCallbacks: LdFlowCallbacks = {
        renameVar,
        changeContactType,
        changeCoilType,
        setRungTitle,
        setRungComment,
        setElementComment,
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
            // Monitor mode: inject the live value into contact/coil data.
            if (monitoring && (n.type === RF_TYPE_CONTACT || n.type === RF_TYPE_COIL)) {
                data = { ...data, monitoring: true, value: monitorValues[n.id] ?? 0 };
            }
            if (data === n.data && className === undefined) {
                return n;
            }
            return { ...n, className, data };
        });
        setNodes(nodes);

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
    }, [graph, setNodes, setEdges, renameVar, highlightIds, currentMatchId, monitoring, monitorValues, validation]);


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
            snap: gridEnabled,
        }));
    }, [tryApply, handler, gridEnabled]);

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
                    className={validation.total > 0 ? 'ld-validation-badge ld-validation-badge--error' : 'ld-validation-badge'}
                    title={validation.messages.length > 0 ? validation.messages.join('\n') : undefined}
                >
                    {validation.total > 0 ? `⚠ ${validation.total} error${validation.total === 1 ? '' : 's'}` : '✓'}
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
                snapToGrid={gridEnabled}
                snapGrid={[LD_GRID.x, LD_GRID.y]}
                defaultEdgeOptions={{ zIndex: 1 }}
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
                onDelete={onDelete}
                onSelectionChange={onSelectionChange}
                className={pendingTool || branchMode ? 'ld-canvas--placing' : undefined}
            >
                <Background variant={gridEnabled ? BackgroundVariant.Dots : BackgroundVariant.Lines} gap={LD_GRID.x} size={1} />
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
