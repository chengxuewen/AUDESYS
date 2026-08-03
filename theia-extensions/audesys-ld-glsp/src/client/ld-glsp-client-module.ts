/**
 * LD GLSP Client Module — registers LD diagram types with GLSP client.
 *
 * Enables interactive features: select, move, delete, resize, viewport.
 * In GLSP 2.x, all Sprotty imports come from '@eclipse-glsp/client' (D99/D101).
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import {
    configureDefaultModelElements,
    configureModelElement,
    GNode,
    SEdgeImpl,
    PolylineEdgeView,
    selectFeature,
    moveFeature,
    deletableFeature,
    boundsFeature,
    fadeFeature,
    hoverFeedbackFeature,
    popupFeature,
    TYPES,
    GridSnapper,
} from '@eclipse-glsp/client';

// LD views
import { LdContactView, LdCoilView, LdPowerRailView, LdFbView, LdRungGroupView, LdComparisonView } from './ld-gmodel-views';

/** Node type constants — must match server-side diagram configuration */
export const LD_NODE_TYPES = {
    GRAPH: 'graph',
    CONTACT: 'node:contact',
    COIL: 'node:coil',
    POWERRAIL: 'node:powerrail',
    FB: 'node:fb',
    COMPARISON: 'node:comparison',
    WIRE: 'edge:wire',
    POWER: 'edge:power',
    RUNG_GROUP: 'rung:group',
} as const;

let contactCounter = 1;
let coilCounter = 1;
export function resetCounters(): void { contactCounter = 1; coilCounter = 1; }

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    const context = { bind, unbind, isBound, rebind };
    // Default GLSP model elements (graph root, labels, etc.)
    // Register ALL standard Sprotty views (SGraphView, PolylineEdgeView, etc.)
    // with correct GLSP DI Symbols. This is the ROOT CAUSE fix.
    // NOTE: configureDefaultModelElements already registers 'graph' with GGraphView
    // (grid-enabled view). We must NOT re-register 'graph' — that would overwrite
    // the GGraphView with our own and trigger 'already registered' warnings.
    configureDefaultModelElements(context);

    // Contact — select, move, delete, bounds
    // Contact — select, move, delete, bounds
    configureModelElement(context, LD_NODE_TYPES.CONTACT, GNode, LdContactView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // Coil — select, move, delete, bounds
    configureModelElement(context, LD_NODE_TYPES.COIL, GNode, LdCoilView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // Power Rail — select only (not movable/deletable)
    configureModelElement(context, LD_NODE_TYPES.POWERRAIL, GNode, LdPowerRailView, {
        enable: [selectFeature, fadeFeature],
    });

    // FB — select, move, delete, bounds
    configureModelElement(context, LD_NODE_TYPES.FB, GNode, LdFbView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // Comparison box — select, move, delete
    configureModelElement(context, LD_NODE_TYPES.COMPARISON, GNode, LdComparisonView, {
        enable: [selectFeature, moveFeature, deletableFeature, boundsFeature, hoverFeedbackFeature, popupFeature],
    });

    // Edges — select, delete
    configureModelElement(context, LD_NODE_TYPES.WIRE, SEdgeImpl, PolylineEdgeView, {
        enable: [selectFeature, deletableFeature],
    });
    configureModelElement(context, LD_NODE_TYPES.POWER, SEdgeImpl, PolylineEdgeView, {
        enable: [selectFeature, deletableFeature],
    });

    // Rung Group — visual container for rung grouping
    configureModelElement(context, LD_NODE_TYPES.RUNG_GROUP, GNode, LdRungGroupView, {
        enable: [selectFeature],
    });

    // ── Grid snapping (40×40) ──
    // gridModule (loaded in diagram-configuration) already binds TYPES.Grid (10×10)
    // and TYPES.ISnapper (GridSnapper). We REBIND both to 40×40:
    // - GridSnapper constructor has no @inject(TYPES.Grid), must pass explicitly
    // - Using rebind prevents AmbiguousMatchError (2 ISnapper bindings)
    rebind(TYPES.Grid).toConstantValue({ x: 40, y: 40 });
    rebind(TYPES.ISnapper).toConstantValue(new GridSnapper({ x: 40, y: 40 }));
});

export function nextContactName(): string { return `IN${contactCounter++}`; }
export function nextCoilName(): string { return `OUT${coilCounter++}`; }
