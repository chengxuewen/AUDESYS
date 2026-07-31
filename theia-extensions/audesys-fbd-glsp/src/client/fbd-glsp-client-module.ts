/**
 * FBD GLSP Client Module — registers FBD diagram types with GLSP client.
 *
 * Enables interactive features: select, move, delete, resize, viewport.
 * In GLSP 2.x, all Sprotty imports come from '@eclipse-glsp/client' (D99/D101).
 *
 * Key difference from LD: FBD uses GPort for pin-level connections.
 * PORT type registered with selectFeature only — GLSP handles port-to-port edges automatically.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import {
    configureDefaultModelElements,
    configureModelElement,
    GNode,
    GPort,
    SEdgeImpl,
    SGraphImpl,
    PolylineEdgeView,
    SGraphView,
    selectFeature,
    moveFeature,
    deletableFeature,
    boundsFeature,
    viewportFeature,
    fadeFeature,
    hoverFeedbackFeature,
    popupFeature,
} from '@eclipse-glsp/client';
import { DefaultTypes } from '@eclipse-glsp/protocol';

// FBD views
import { FbdGateView, FbdFbView, FbdPortView } from './fbd-gmodel-views';

/** Node type constants — must match server-side diagram configuration */
export const FBD_NODE_TYPES = {
    GRAPH: 'graph',
    GATE: 'node:gate',
    FB: 'node:fb',
    PORT: DefaultTypes.PORT,  // 'port'
    SIGNAL: 'edge:signal',
} as const;

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    const context = { bind, unbind, isBound, rebind };

    // Default GLSP model elements (graph root, labels, etc.)
    // Register ALL standard Sprotty views (SGraphView, PolylineEdgeView, etc.)
    // with correct GLSP DI Symbols. This is the ROOT CAUSE fix (D99).
    configureDefaultModelElements(context);

    // Graph root — viewport (zoom/pan/fit)
    configureModelElement(context, FBD_NODE_TYPES.GRAPH, SGraphImpl, SGraphView, {
        enable: [viewportFeature],
    });

    // Gate node — select, move, delete, bounds
    configureModelElement(context, FBD_NODE_TYPES.GATE, GNode, FbdGateView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // FB node — select, move, delete, bounds
    configureModelElement(context, FBD_NODE_TYPES.FB, GNode, FbdFbView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // PORT — select only (GLSP handles port-to-port edge connections automatically)
    // This OVERRIDES the default RectangularNodeView with custom FbdPortView
    configureModelElement(context, FBD_NODE_TYPES.PORT, GPort, FbdPortView, {
        enable: [selectFeature],
    });

    // Signal edge — select, delete
    configureModelElement(context, FBD_NODE_TYPES.SIGNAL, SEdgeImpl, PolylineEdgeView, {
        enable: [selectFeature, deletableFeature],
    });
});
