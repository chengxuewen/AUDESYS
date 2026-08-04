/**
 * FbdCanvas — React Flow canvas for the IEC 61131-3 Function Block Diagram editor.
 *
 * Architecture (D110 pattern, mirrored from LdCanvas): FbdGraph is the single
 * source of truth, held in FbdGModelState (undo/redo + dirty). React Flow is a
 * pure view — every user interaction routes through FbdOperationHandler
 * (frontend memory, no Theia command round-trip), the resulting graph is mapped
 * back to React Flow nodes/edges via graphToFlow.
 *
 * Mapping rules:
 *  - GateNode       → custom node type 'fb-gate' (IEC gate SVG shapes)
 *  - FunctionBlock  → custom node type 'fb-block' (rect + FB name)
 *  - SignalEdge     → custom edge type 'fbd-wire' (bezier port-to-port)
 *  - Handles: target handle per input pin (left), source per output pin (right),
 *    handle id = pin name.
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
    Connection,
} from '@xyflow/react';

import { FbdGraph } from '../model/model';
import { Pin, GateType, isGateNode, isFunctionBlockNode } from '../model/nodes';
import { toJSON } from '../model/serialization';
import { FbdOperationHandler } from '../backend/fbd-operation-handler';
import { FbdGModelState } from '../backend/fbd-gmodel-state';

import { GateNode } from './nodes/GateNode';
import { FbNode } from './nodes/FbNode';
import { FbdWireEdge } from './edges/FbdWireEdge';

// ============================================================================
// React Flow element types
// ============================================================================

export interface FbdNodeData extends Record<string, unknown> {
    kind?: 'gate' | 'fb';
    gateType?: string;
    fbType?: string;
    inputPins?: Array<Pick<Pin, 'name' | 'dataType'>>;
    outputPins?: Array<Pick<Pin, 'name' | 'dataType'>>;
    width?: number;
    height?: number;
}

export type FbdRfNode = Node<FbdNodeData>;
export type FbdRfEdge = Edge<Record<string, unknown>>;

/** RF type strings double as CSS selectors: .react-flow__node-fb-gate etc. */
export const RF_TYPE_GATE = 'fb-gate';
export const RF_TYPE_FB = 'fb-block';
export const RF_TYPE_WIRE = 'fbd-wire';

// ============================================================================
// FbdGraph → React Flow mapping
// ============================================================================

export function graphToFlow(graph: FbdGraph): { nodes: FbdRfNode[]; edges: FbdRfEdge[] } {
    const nodes: FbdRfNode[] = graph.nodes.map((modelNode) => {
        const isGate = isGateNode(modelNode);
        const isFb = isFunctionBlockNode(modelNode);
        return {
            id: modelNode.id,
            type: isGate ? RF_TYPE_GATE : RF_TYPE_FB,
            position: modelNode.position,
            style: { width: modelNode.size.width, height: modelNode.size.height },
            data: {
                kind: isGate ? 'gate' : 'fb',
                gateType: isGate ? modelNode.gateType : undefined,
                fbType: isFb ? modelNode.fbType : undefined,
                inputPins: isGate || isFb ? modelNode.inputPorts : [],
                outputPins: isGate || isFb ? modelNode.outputPorts : [],
                width: modelNode.size.width,
                height: modelNode.size.height,
            },
        };
    });

    const edges: FbdRfEdge[] = graph.edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        sourceHandle: e.sourcePortName,
        target: e.targetId,
        targetHandle: e.targetPortName,
        type: RF_TYPE_WIRE,
        data: {},
    }));

    return { nodes, edges };
}

// ============================================================================
// Tool palette definition
// ============================================================================

export type FbdTool =
    | 'gate-AND' | 'gate-OR' | 'gate-XOR' | 'gate-NOT' | 'gate-MUX'
    | `fb-${string}`;

const GATE_TOOLS: ReadonlyArray<{ id: FbdTool; label: string }> = [
    { id: 'gate-AND', label: 'AND' },
    { id: 'gate-OR', label: 'OR' },
    { id: 'gate-XOR', label: 'XOR' },
    { id: 'gate-NOT', label: 'NOT' },
    { id: 'gate-MUX', label: 'MUX' },
];

/** FB types from the registry (fbd-fb-registry.ts) — one button each. */
const FB_TYPES: ReadonlyArray<string> = [
    'TON', 'TOF', 'TP', 'CTU', 'CTD', 'CTUD',
    'SR', 'RS', 'R_TRIG', 'F_TRIG',
    'ADD', 'SUB', 'MUL', 'DIV', 'MOVE',
    'EQ', 'GT', 'LT', 'GE', 'LE', 'SEL',
];

const FB_TOOLS: ReadonlyArray<{ id: FbdTool; label: string }> = FB_TYPES.map((t) => ({ id: `fb-${t}` as FbdTool, label: t }));

// ============================================================================
// Controller (widget-facing imperative API)
// ============================================================================

export interface FbdCanvasController {
    undo(): void;
    redo(): void;
    getGraphJson(): string;
    isDirty(): boolean;
    markClean(): void;
}

// ============================================================================
// Styles (injected once into document head)
// ============================================================================

const FBD_CANVAS_STYLE_ID = 'fbd-editor-canvas-styles';
const FBD_CANVAS_CSS = `
.fbd-editor-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--theia-editor-background, #1e1e1e);
}
.fbd-editor-root .react-flow {
  flex: 1;
}
.fbd-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--theia-panel-border, #444);
  user-select: none;
}
.fbd-toolbar__sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--theia-panel-border, #444);
}
.fbd-toolbar button {
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--theia-ui-font-family);
  color: var(--theia-button-foreground, #fff);
  background: var(--theia-button-background, #0e639c);
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
}
.fbd-toolbar button:hover {
  background: var(--theia-button-hoverBackground, #1177bb);
}
.fbd-toolbar button:disabled {
  opacity: 0.5;
  cursor: default;
}
.fbd-toolbar button.fbd-toolbar__tool--active {
  outline: 1px solid var(--theia-focusBorder, #007fd4);
  background: var(--theia-button-hoverBackground, #1177bb);
}
.fbd-status {
  margin-left: auto;
  font-size: 11px;
  color: var(--theia-errorForeground, #f48771);
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fbd-canvas--placing {
  cursor: crosshair;
}
`;

function injectCanvasStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(FBD_CANVAS_STYLE_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = FBD_CANVAS_STYLE_ID;
    style.textContent = FBD_CANVAS_CSS;
    document.head.appendChild(style);
}

// ============================================================================
// Node / edge type registries (module scope: stable identity across renders)
// ============================================================================

const nodeTypes: NodeTypes = {
    [RF_TYPE_GATE]: GateNode,
    [RF_TYPE_FB]: FbNode,
};

const edgeTypes: EdgeTypes = {
    [RF_TYPE_WIRE]: FbdWireEdge,
};

// ============================================================================
// Canvas component
// ============================================================================

export interface FbdCanvasProps {
    state: FbdGModelState;
    handler: FbdOperationHandler;
    controllerRef?: React.MutableRefObject<FbdCanvasController | null>;
    onDirtyChange?: (dirty: boolean) => void;
}

const FbdCanvasInner: React.FC<FbdCanvasProps> = ({
    state, handler, controllerRef, onDirtyChange,
}) => {
    const { setNodes, setEdges, screenToFlowPosition } = useReactFlow();
    const [graph, setGraph] = React.useState<FbdGraph>(() => state.graph);
    const [pendingTool, setPendingTool] = React.useState<FbdTool | null>(null);
    const [status, setStatus] = React.useState('');

    React.useEffect(injectCanvasStyles, []);

    // Sync FbdGraph changes into the React Flow store (uncontrolled mode:
    // defaultNodes on mount, imperative setNodes/setEdges afterwards).
    React.useEffect(() => {
        const flow = graphToFlow(graph);
        setNodes(flow.nodes);
        setEdges(flow.edges);
    }, [graph, setNodes, setEdges]);

    const notifyDirty = React.useCallback((): void => {
        onDirtyChange?.(state.dirty);
    }, [onDirtyChange, state]);

    /** Apply a mutation through FbdGModelState (undo snapshot + dirty). */
    const tryApply = React.useCallback((mutate: (g: FbdGraph) => FbdGraph): void => {
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

    const createWithTool = React.useCallback((tool: FbdTool, flowPos: { x: number; y: number }): void => {
        tryApply((g) => {
            if (tool.startsWith('gate-')) {
                const gateType = tool.slice('gate-'.length) as GateType;
                return handler.createGate(g, { gateType, position: flowPos });
            }
            const fbType = tool.slice('fb-'.length);
            return handler.createFunctionBlock(g, { fbType, position: flowPos });
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

    // ── Port-to-port connection ───────────────────────────────

    const onConnect = React.useCallback((connection: Connection): void => {
        const sourceHandle = connection.sourceHandle ?? '';
        const targetHandle = connection.targetHandle ?? '';
        if (!connection.source || !connection.target || !sourceHandle || !targetHandle) {
            return;
        }
        tryApply((g) => handler.connectPins(g, {
            sourceNodeId: connection.source!,
            sourcePortName: sourceHandle,
            targetNodeId: connection.target!,
            targetPortName: targetHandle,
        }));
    }, [tryApply, handler]);

    // ── Node dragging: free layout, snap to grid on commit ───

    const onNodeDragStop = React.useCallback((_: unknown, node: FbdRfNode): void => {
        tryApply((g) => handler.moveElement(g, {
            elementId: node.id,
            newPosition: { x: node.position.x, y: node.position.y },
        }));
    }, [tryApply, handler]);

    // ── Deletion (nodes cascade-remove their edges in the handler) ──

    const onDelete = React.useCallback((params: { nodes: FbdRfNode[]; edges: FbdRfEdge[] }): void => {
        tryApply((g) => {
            let next = g;
            for (const node of params.nodes) {
                next = handler.deleteElement(next, { elementId: node.id });
            }
            for (const edge of params.edges) {
                // deleteElement may have cascade-removed this edge already.
                if (next.edges.some((e) => e.id === edge.id)) {
                    next = handler.disconnectPin(next, { nodeId: edge.source, portName: edge.sourceHandle ?? '' });
                }
            }
            return next;
        });
    }, [tryApply, handler]);

    // ── Render ────────────────────────────────────────────────

    const initialFlow = React.useMemo(() => graphToFlow(graph), []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="fbd-editor-root">
            <div className="fbd-toolbar">
                <button onClick={undo} disabled={!state.canUndo} title="Undo">Undo</button>
                <button onClick={redo} disabled={!state.canRedo} title="Redo">Redo</button>
                <div className="fbd-toolbar__sep" />
                {GATE_TOOLS.map((tool) => (
                    <button
                        key={tool.id}
                        className={pendingTool === tool.id ? 'fbd-toolbar__tool--active' : ''}
                        onClick={() => setPendingTool((t) => (t === tool.id ? null : tool.id))}
                        title={`${tool.label} gate: click, then click on the canvas`}
                    >
                        {tool.label}
                    </button>
                ))}
                <div className="fbd-toolbar__sep" />
                {FB_TOOLS.map((tool) => (
                    <button
                        key={tool.id}
                        className={pendingTool === tool.id ? 'fbd-toolbar__tool--active' : ''}
                        onClick={() => setPendingTool((t) => (t === tool.id ? null : tool.id))}
                        title={`${tool.label} block: click, then click on the canvas`}
                    >
                        {tool.label}
                    </button>
                ))}
                <div className="fbd-status">{status}</div>
            </div>
            <ReactFlow
                defaultNodes={initialFlow.nodes}
                defaultEdges={initialFlow.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                snapToGrid={true}
                snapGrid={[20, 20]}
                defaultEdgeOptions={{ zIndex: 1 }}
                // v12 default is only 'Backspace'; keyboard users press Delete
                deleteKeyCode={['Delete', 'Backspace']}
                fitView
                onPaneClick={onPaneClick}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onDelete={onDelete}
                className={pendingTool ? 'fbd-canvas--placing' : undefined}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                <Controls />
                <MiniMap pannable zoomable />
            </ReactFlow>
        </div>
    );
};

export const FbdCanvas: React.FC<FbdCanvasProps> = (props) => (
    <ReactFlowProvider>
        <FbdCanvasInner {...props} />
    </ReactFlowProvider>
);
