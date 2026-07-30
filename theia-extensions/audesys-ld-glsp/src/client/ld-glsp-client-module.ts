/**
 * LD GLSP Client Module — registers LD diagram types with GLSP client.
 *
 * Enables interactive features: select, move, delete, resize, viewport.
 * In GLSP 2.x, configureModelElement is from 'sprotty'.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import {
    configureModelElement,
    SNodeImpl,
    SEdgeImpl,
    SGraphImpl,
    PolylineEdgeView,
    SGraphView,
} from '@eclipse-glsp/sprotty';
import {
    selectFeature,
    moveFeature,
    deletableFeature,
    boundsFeature,
    viewportFeature,
    fadeFeature,
    hoverFeedbackFeature,
    popupFeature,
} from 'sprotty';

// LD views
import { LdContactView, LdCoilView, LdPowerRailView, LdFbView } from './ld-gmodel-views';

/** Node type constants — must match server-side diagram configuration */
export const LD_NODE_TYPES = {
    GRAPH: 'graph',
    CONTACT: 'node:contact',
    COIL: 'node:coil',
    POWERRAIL: 'node:powerrail',
    FB: 'node:fb',
    WIRE: 'edge:wire',
    POWER: 'edge:power',
} as const;

let contactCounter = 1;
let coilCounter = 1;
export function resetCounters(): void { contactCounter = 1; coilCounter = 1; }

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    const context = { bind, unbind, isBound, rebind };

    // Default GLSP model elements (graph root, labels, etc.)

    // Graph root — viewport (zoom/pan/fit)
    configureModelElement(context, LD_NODE_TYPES.GRAPH, SGraphImpl, SGraphView, {
        enable: [viewportFeature],
    });

    // Contact — select, move, delete, bounds
    configureModelElement(context, LD_NODE_TYPES.CONTACT, SNodeImpl, LdContactView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // Coil — select, move, delete, bounds
    configureModelElement(context, LD_NODE_TYPES.COIL, SNodeImpl, LdCoilView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // Power Rail — select only (not movable/deletable)
    configureModelElement(context, LD_NODE_TYPES.POWERRAIL, SNodeImpl, LdPowerRailView, {
        enable: [selectFeature, fadeFeature],
    });

    // FB — select, move, delete, bounds
    configureModelElement(context, LD_NODE_TYPES.FB, SNodeImpl, LdFbView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // Edges — select, delete
    configureModelElement(context, LD_NODE_TYPES.WIRE, SEdgeImpl, PolylineEdgeView, {
        enable: [selectFeature, deletableFeature],
    });
    configureModelElement(context, LD_NODE_TYPES.POWER, SEdgeImpl, PolylineEdgeView, {
        enable: [selectFeature, deletableFeature],
    });
});

export function nextContactName(): string { return `IN${contactCounter++}`; }
export function nextCoilName(): string { return `OUT${coilCounter++}`; }
