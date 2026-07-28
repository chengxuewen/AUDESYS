"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LD_NODE_TYPES = void 0;
exports.resetCounters = resetCounters;
exports.nextContactName = nextContactName;
exports.nextCoilName = nextCoilName;
/**
 * LD GLSP Client Module — registers LD diagram types with GLSP client.
 *
 * Enables interactive features: select, move, delete, resize, viewport.
 * In GLSP 2.x, configureModelElement is from 'sprotty'.
 */
const inversify_1 = require("@theia/core/shared/inversify");
const sprotty_1 = require("sprotty");
// LD views
const ld_gmodel_views_1 = require("./ld-gmodel-views");
/** Node type constants — must match server-side diagram configuration */
exports.LD_NODE_TYPES = {
    GRAPH: 'graph',
    CONTACT: 'node:contact',
    COIL: 'node:coil',
    POWERRAIL: 'node:powerrail',
    FB: 'node:fb',
    WIRE: 'edge:wire',
    POWER: 'edge:power',
};
let contactCounter = 1;
let coilCounter = 1;
function resetCounters() { contactCounter = 1; coilCounter = 1; }
exports.default = new inversify_1.ContainerModule((bind, unbind, isBound, rebind) => {
    const context = { bind, unbind, isBound, rebind };
    // Default GLSP model elements (graph root, labels, etc.)
    // Graph root — viewport (zoom/pan/fit)
    (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.GRAPH, sprotty_1.SGraphImpl, sprotty_1.SGraphView, {
        enable: [sprotty_1.viewportFeature],
    });
    // Contact — select, move, delete, bounds
    (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.CONTACT, sprotty_1.SNodeImpl, ld_gmodel_views_1.LdContactView, {
        enable: [sprotty_1.selectFeature, sprotty_1.moveFeature, sprotty_1.deletableFeature, sprotty_1.boundsFeature, sprotty_1.hoverFeedbackFeature, sprotty_1.popupFeature],
    });
    // Coil — select, move, delete, bounds
    (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.COIL, sprotty_1.SNodeImpl, ld_gmodel_views_1.LdCoilView, {
        enable: [sprotty_1.selectFeature, sprotty_1.moveFeature, sprotty_1.deletableFeature, sprotty_1.boundsFeature, sprotty_1.hoverFeedbackFeature, sprotty_1.popupFeature],
    });
    // Power Rail — select only (not movable/deletable)
    (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.POWERRAIL, sprotty_1.SNodeImpl, ld_gmodel_views_1.LdPowerRailView, {
        enable: [sprotty_1.selectFeature, sprotty_1.fadeFeature],
    });
    // FB — select, move, delete, bounds
    (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.FB, sprotty_1.SNodeImpl, ld_gmodel_views_1.LdFbView, {
        enable: [sprotty_1.selectFeature, sprotty_1.moveFeature, sprotty_1.deletableFeature, sprotty_1.boundsFeature, sprotty_1.hoverFeedbackFeature, sprotty_1.popupFeature],
    });
    // Edges — select, delete
    (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.WIRE, sprotty_1.SEdgeImpl, sprotty_1.PolylineEdgeView, {
        enable: [sprotty_1.selectFeature, sprotty_1.deletableFeature],
    });
    (0, sprotty_1.configureModelElement)(context, exports.LD_NODE_TYPES.POWER, sprotty_1.SEdgeImpl, sprotty_1.PolylineEdgeView, {
        enable: [sprotty_1.selectFeature, sprotty_1.deletableFeature],
    });
});
function nextContactName() { return `IN${contactCounter++}`; }
function nextCoilName() { return `OUT${coilCounter++}`; }
//# sourceMappingURL=ld-glsp-client-module.js.map