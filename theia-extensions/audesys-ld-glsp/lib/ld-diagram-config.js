"use strict";
/**
 * LD Sprotty Diagram Configuration — binds SModel types ↔ IView implementations.
 *
 * Uses sprotty's `configureModelElement` to register LD node types
 * and their corresponding views in the DI container.
 *
 * Ponytail: one ContainerModule, no separate diagram config interface.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LD_NODE_TYPES = void 0;
exports.createLdDiagramModule = createLdDiagramModule;
const inversify_1 = require("@theia/core/shared/inversify");
const sprotty_1 = require("sprotty");
const ld_views_1 = require("./ld-views");
// ── Node type constants ──────────────────────────────────────────
exports.LD_NODE_TYPES = {
    GRAPH: 'graph',
    CONTACT: 'node:contact',
    COIL: 'node:coil',
    POWERRAIL: 'node:powerrail',
    FB: 'node:fb',
    WIRE: 'edge:wire',
    POWER: 'edge:power',
};
// ── Diagram container module ─────────────────────────────────────
function createLdDiagramModule() {
    return new inversify_1.ContainerModule((bind, unbind, isBound, rebind) => {
        const context = { bind, isBound, rebind };
        // Viewer options — needsClientLayout for our local model
        (0, sprotty_1.configureViewerOptions)(context, {
            needsClientLayout: true,
            needsServerLayout: false,
            baseDiv: 'sprotty-ld-diagram',
            hiddenDiv: 'sprotty-ld-hidden',
            popupDiv: 'sprotty-ld-popup',
        });
        // Node views
        (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.CONTACT, sprotty_1.SNode, ld_views_1.LdContactView);
        (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.COIL, sprotty_1.SNode, ld_views_1.LdCoilView);
        (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.POWERRAIL, sprotty_1.SNode, ld_views_1.LdPowerRailView);
        (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.FB, sprotty_1.SNode, ld_views_1.LdFbView);
        // Edge views — reuse sprotty polyline edge for wires
        (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.WIRE, sprotty_1.SEdge, sprotty_1.PolylineEdgeView);
        (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.POWER, sprotty_1.SEdge, sprotty_1.PolylineEdgeView);
        // Graph root
        (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.GRAPH, sprotty_1.SGraph, sprotty_1.SGraphView);
    });
}
//# sourceMappingURL=ld-diagram-config.js.map