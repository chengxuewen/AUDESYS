/**
 * LD Sprotty Diagram Widget — Theia ReactWidget hosting a Sprotty diagram renderer.
 *
 * Bridges LdGModelState → Sprotty's LocalModelSource for live rendering
 * of ladder diagrams within Theia.
 *
 * Ponytail: ReactWidget + Sprotty container + polling sync.
 * Replace poll with push when LdGModelState gains onDidChange event.
 */

import React from 'react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Container } from '@theia/core/shared/inversify';
import {
    defaultModule,
    TYPES,
    ViewerOptions,
    LocalModelSource,
    SModelRoot,
} from 'sprotty';
import { LdGModelState } from './server/ld-gmodel-state';
import { LdGraph } from './gmodel/model';
import { BaseNode, ContactNode, CoilNode, PowerRailNode, FbPlaceholderNode, PowerRailSide } from './gmodel/nodes';
import { BaseEdge, WireConnection } from './gmodel/edges';
import { createLdDiagramModule, LD_NODE_TYPES } from './ld-diagram-config';

let diagramCounter = 0;
/** ponytail: poll interval — replace with push when LdGModelState gains events */
const SYNC_POLL_MS = 250;

export class LdSprottyDiagramWidget extends ReactWidget {
    static readonly ID = 'audesys-ld-sprotty-diagram';

    private readonly modelState: LdGModelState;
    private readonly divId: string;
    private container: Container | null = null;
    private modelSource: LocalModelSource | null = null;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private lastGraphJson: string = '';

    constructor(modelState: LdGModelState) {
        super();
        this.modelState = modelState;
        this.id = `${LdSprottyDiagramWidget.ID}-${++diagramCounter}`;
        this.title.label = 'LD Diagram (Sprotty)';
        this.title.closable = true;
        this.divId = `sprotty-ld-${diagramCounter}`;
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.createHiddenDivs();
        // ponytail: setTimeout ensures DOM div exists before sprotty queries it
        setTimeout(() => this.createSprottyContainer(), 0);
    }

    protected override onBeforeDetach(msg: Message): void {
        this.disposeSprottyContainer();
        this.removeHiddenDivs();
        super.onBeforeDetach(msg);
    }

    protected render(): React.ReactNode {
        return React.createElement('div', {
            id: this.divId,
            className: 'ld-sprotty-diagram',
            style: { width: '100%', height: '100%', overflow: 'hidden', position: 'relative' },
        });
    }

    /** Force an immediate model sync. Call after applyOperation / undo / redo. */
    syncModel(): void {
        if (!this.modelSource) return;
        const graph = this.modelState.graph;
        const json = JSON.stringify(graph);
        if (json === this.lastGraphJson) return;
        this.lastGraphJson = json;
        this.modelSource.setModel(ldGraphToSModel(graph));
    }

    // ── private ───────────────────────────────────────────────────

    private createHiddenDivs(): void {
        for (const [suffix, style] of [
            ['-hidden', 'position:absolute;width:0;height:0;overflow:hidden;'],
            ['-popup', 'position:absolute;top:0;left:0;pointer-events:none;'],
        ] as const) {
            const id = `${this.divId}${suffix}`;
            if (!document.getElementById(id)) {
                const d = document.createElement('div');
                d.id = id;
                d.style.cssText = style;
                document.body.appendChild(d);
            }
        }
    }

    private removeHiddenDivs(): void {
        for (const suffix of ['-hidden', '-popup']) {
            document.getElementById(`${this.divId}${suffix}`)?.remove();
        }
    }

    private createSprottyContainer(): void {
        if (this.container || !document.getElementById(this.divId)) return;

        this.container = new Container();
        this.container.load(defaultModule);
        this.container.load(createLdDiagramModule());
        this.container.bind(LocalModelSource).toSelf().inSingletonScope();
        this.container.bind(TYPES.ModelSource).toService(LocalModelSource);

        this.container.rebind(TYPES.ViewerOptions).toConstantValue({
            baseDiv: this.divId,
            hiddenDiv: `${this.divId}-hidden`,
            popupDiv: `${this.divId}-popup`,
            baseClass: 'sprotty-ld-base',
            hiddenClass: 'sprotty-ld-hidden',
            popupClass: 'sprotty-ld-popup',
            popupClosedClass: 'sprotty-ld-popup-closed',
            needsClientLayout: true,
            needsServerLayout: false,
            popupOpenDelay: 1000,
            popupCloseDelay: 300,
            zoomLimits: { min: 0.1, max: 10 },
            horizontalScrollLimits: { min: -100000, max: 100000 },
            verticalScrollLimits: { min: -100000, max: 100000 },
        });

        this.modelSource = this.container.get<LocalModelSource>(LocalModelSource);
        this.syncModel();
        this.pollTimer = setInterval(() => this.syncModel(), SYNC_POLL_MS);
    }

    private disposeSprottyContainer(): void {
        if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
        this.modelSource = null;
        this.container = null;
    }
}

// ============================================================================
// LdGraph → Sprotty SModel
// ============================================================================

function ldGraphToSModel(graph: LdGraph): SModelRoot {
    const height = computeCanvasHeight(graph);
    const children: Record<string, unknown>[] = [];

    // Power rails
    children.push(
        powerRailNode('powerrail-left', PowerRailSide.Left, 36, height),
        powerRailNode('powerrail-right', PowerRailSide.Right, 640, height),
    );

    for (const node of graph.nodes) {
        const sn = nodeToSModel(node);
        if (sn) children.push(sn);
    }
    for (const edge of graph.edges) {
        const se = edgeToSModel(edge);
        if (se) children.push(se);
    }

    return { type: LD_NODE_TYPES.GRAPH, id: graph.id, children } as SModelRoot;
}

function powerRailNode(id: string, side: PowerRailSide, x: number, height: number): Record<string, unknown> {
    return { type: LD_NODE_TYPES.POWERRAIL, id, position: { x, y: 40 }, size: { width: 4, height: height - 80 }, side };
}

function nodeToSModel(node: BaseNode): Record<string, unknown> | null {
    const base = { id: node.id, position: { x: node.position.x, y: node.position.y }, size: { width: node.size.width, height: node.size.height } };
    switch (node.type) {
        case 'node:contact': { const c = node as ContactNode; return { ...base, type: LD_NODE_TYPES.CONTACT, contactType: c.contactType, variableName: c.variableName }; }
        case 'node:coil':    { const c = node as CoilNode;    return { ...base, type: LD_NODE_TYPES.COIL,    coilType: c.coilType,       variableName: c.variableName }; }
        case 'node:powerrail': { const r = node as PowerRailNode; return { ...base, type: LD_NODE_TYPES.POWERRAIL, side: r.side }; }
        case 'node:fb': { const fb = node as FbPlaceholderNode; return { ...base, type: LD_NODE_TYPES.FB, fbType: fb.fbType, pinCount: fb.inputPins.length + fb.outputPins.length }; }
        default: return null;
    }
}

function edgeToSModel(edge: BaseEdge): Record<string, unknown> | null {
    const base = { id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId };
    switch (edge.type) {
        case 'edge:wire': {
            const w = edge as WireConnection;
            const r: Record<string, unknown> = { ...base, type: LD_NODE_TYPES.WIRE };
            if (w.routingPoints?.length) r.routingPoints = w.routingPoints.map((p) => ({ x: p.x, y: p.y }));
            return r;
        }
        case 'edge:power': return { ...base, type: LD_NODE_TYPES.POWER };
        default: return null;
    }
}

function computeCanvasHeight(graph: LdGraph): number {
    return Math.max(graph.rungs.length * 80 + 120, 400);
}
