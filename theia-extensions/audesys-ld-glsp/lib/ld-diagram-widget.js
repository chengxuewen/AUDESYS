"use strict";
/**
 * LD Sprotty Diagram Widget — Theia ReactWidget hosting a Sprotty diagram renderer.
 *
 * Bridges LdGModelState → Sprotty's LocalModelSource for live rendering
 * of ladder diagrams within Theia.
 *
 * Ponytail: ReactWidget + Sprotty container + polling sync.
 * Replace poll with push when LdGModelState gains onDidChange event.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdSprottyDiagramWidget = void 0;
const react_1 = __importDefault(require("react"));
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const inversify_1 = require("@theia/core/shared/inversify");
const sprotty_1 = require("sprotty");
const nodes_1 = require("./gmodel/nodes");
const ld_diagram_config_1 = require("./ld-diagram-config");
let diagramCounter = 0;
/** ponytail: poll interval — replace with push when LdGModelState gains events */
const SYNC_POLL_MS = 250;
class LdSprottyDiagramWidget extends react_widget_1.ReactWidget {
    constructor(modelState) {
        super();
        this.container = null;
        this.modelSource = null;
        this.pollTimer = null;
        this.lastGraphJson = '';
        this.modelState = modelState;
        this.id = `${LdSprottyDiagramWidget.ID}-${++diagramCounter}`;
        this.title.label = 'LD Diagram (Sprotty)';
        this.title.closable = true;
        this.divId = `sprotty-ld-${diagramCounter}`;
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        this.createHiddenDivs();
        // ponytail: setTimeout ensures DOM div exists before sprotty queries it
        setTimeout(() => this.createSprottyContainer(), 0);
    }
    onBeforeDetach(msg) {
        this.disposeSprottyContainer();
        this.removeHiddenDivs();
        super.onBeforeDetach(msg);
    }
    render() {
        return react_1.default.createElement('div', {
            id: this.divId,
            className: 'ld-sprotty-diagram',
            style: { width: '100%', height: '100%', overflow: 'hidden', position: 'relative' },
        });
    }
    /** Force an immediate model sync. Call after applyOperation / undo / redo. */
    syncModel() {
        if (!this.modelSource)
            return;
        const graph = this.modelState.graph;
        const json = JSON.stringify(graph);
        if (json === this.lastGraphJson)
            return;
        this.lastGraphJson = json;
        this.modelSource.setModel(ldGraphToSModel(graph));
    }
    // ── private ───────────────────────────────────────────────────
    createHiddenDivs() {
        for (const [suffix, style] of [
            ['-hidden', 'position:absolute;width:0;height:0;overflow:hidden;'],
            ['-popup', 'position:absolute;top:0;left:0;pointer-events:none;'],
        ]) {
            const id = `${this.divId}${suffix}`;
            if (!document.getElementById(id)) {
                const d = document.createElement('div');
                d.id = id;
                d.style.cssText = style;
                document.body.appendChild(d);
            }
        }
    }
    removeHiddenDivs() {
        for (const suffix of ['-hidden', '-popup']) {
            document.getElementById(`${this.divId}${suffix}`)?.remove();
        }
    }
    createSprottyContainer() {
        if (this.container || !document.getElementById(this.divId))
            return;
        this.container = new inversify_1.Container();
        this.container.load(sprotty_1.defaultModule);
        this.container.load((0, ld_diagram_config_1.createLdDiagramModule)());
        this.container.bind(sprotty_1.LocalModelSource).toSelf().inSingletonScope();
        this.container.bind(sprotty_1.TYPES.ModelSource).toService(sprotty_1.LocalModelSource);
        this.container.rebind(sprotty_1.TYPES.ViewerOptions).toConstantValue({
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
        this.modelSource = this.container.get(sprotty_1.LocalModelSource);
        this.syncModel();
        this.pollTimer = setInterval(() => this.syncModel(), SYNC_POLL_MS);
    }
    disposeSprottyContainer() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.modelSource = null;
        this.container = null;
    }
}
exports.LdSprottyDiagramWidget = LdSprottyDiagramWidget;
LdSprottyDiagramWidget.ID = 'audesys-ld-sprotty-diagram';
// ============================================================================
// LdGraph → Sprotty SModel
// ============================================================================
function ldGraphToSModel(graph) {
    const height = computeCanvasHeight(graph);
    const children = [];
    // Power rails
    children.push(powerRailNode('powerrail-left', nodes_1.PowerRailSide.Left, 36, height), powerRailNode('powerrail-right', nodes_1.PowerRailSide.Right, 640, height));
    for (const node of graph.nodes) {
        const sn = nodeToSModel(node);
        if (sn)
            children.push(sn);
    }
    for (const edge of graph.edges) {
        const se = edgeToSModel(edge);
        if (se)
            children.push(se);
    }
    return { type: ld_diagram_config_1.LD_NODE_TYPES.GRAPH, id: graph.id, children };
}
function powerRailNode(id, side, x, height) {
    return { type: ld_diagram_config_1.LD_NODE_TYPES.POWERRAIL, id, position: { x, y: 40 }, size: { width: 4, height: height - 80 }, side };
}
function nodeToSModel(node) {
    const base = { id: node.id, position: { x: node.position.x, y: node.position.y }, size: { width: node.size.width, height: node.size.height } };
    switch (node.type) {
        case 'node:contact': {
            const c = node;
            return { ...base, type: ld_diagram_config_1.LD_NODE_TYPES.CONTACT, contactType: c.contactType, variableName: c.variableName };
        }
        case 'node:coil': {
            const c = node;
            return { ...base, type: ld_diagram_config_1.LD_NODE_TYPES.COIL, coilType: c.coilType, variableName: c.variableName };
        }
        case 'node:powerrail': {
            const r = node;
            return { ...base, type: ld_diagram_config_1.LD_NODE_TYPES.POWERRAIL, side: r.side };
        }
        case 'node:fb': {
            const fb = node;
            return { ...base, type: ld_diagram_config_1.LD_NODE_TYPES.FB, fbType: fb.fbType, pinCount: fb.inputPins.length + fb.outputPins.length };
        }
        default: return null;
    }
}
function edgeToSModel(edge) {
    const base = { id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId };
    switch (edge.type) {
        case 'edge:wire': {
            const w = edge;
            const r = { ...base, type: ld_diagram_config_1.LD_NODE_TYPES.WIRE };
            if (w.routingPoints?.length)
                r.routingPoints = w.routingPoints.map((p) => ({ x: p.x, y: p.y }));
            return r;
        }
        case 'edge:power': return { ...base, type: ld_diagram_config_1.LD_NODE_TYPES.POWER };
        default: return null;
    }
}
function computeCanvasHeight(graph) {
    return Math.max(graph.rungs.length * 80 + 120, 400);
}
//# sourceMappingURL=ld-diagram-widget.js.map