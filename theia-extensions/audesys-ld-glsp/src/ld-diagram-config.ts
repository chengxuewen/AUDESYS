/**
 * LD Sprotty Diagram Configuration — binds SModel types ↔ IView implementations.
 *
 * Uses sprotty's `configureModelElement` to register LD node types
 * and their corresponding views in the DI container.
 *
 * Ponytail: one ContainerModule, no separate diagram config interface.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import {
    configureModelElement,
    configureViewerOptions,
    SGraph,
    SGraphView,
    SNode,
    SEdge,
    PolylineEdgeView,
    defaultModule,
} from 'sprotty';
import {
    LdContactView,
    LdCoilView,
    LdPowerRailView,
    LdFbView,
} from './ld-views';

// ── Node type constants ──────────────────────────────────────────

export const LD_NODE_TYPES = {
    GRAPH: 'graph',
    CONTACT: 'node:contact',
    COIL: 'node:coil',
    POWERRAIL: 'node:powerrail',
    FB: 'node:fb',
    WIRE: 'edge:wire',
    POWER: 'edge:power',
} as const;

// ── Diagram container module ─────────────────────────────────────

export function createLdDiagramModule(): ContainerModule {
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        const context = { bind, isBound, rebind };

        // Viewer options — needsClientLayout for our local model
        configureViewerOptions(context, {
            needsClientLayout: true,
            needsServerLayout: false,
            baseDiv: 'sprotty-ld-diagram',
            hiddenDiv: 'sprotty-ld-hidden',
            popupDiv: 'sprotty-ld-popup',
        });

        // Node views
        configureModelElement(context, LD_NODE_TYPES.CONTACT, SNode, LdContactView);
        configureModelElement(context, LD_NODE_TYPES.COIL, SNode, LdCoilView);
        configureModelElement(context, LD_NODE_TYPES.POWERRAIL, SNode, LdPowerRailView);
        configureModelElement(context, LD_NODE_TYPES.FB, SNode, LdFbView);

        // Edge views — reuse sprotty polyline edge for wires
        configureModelElement(context, LD_NODE_TYPES.WIRE, SEdge, PolylineEdgeView);
        configureModelElement(context, LD_NODE_TYPES.POWER, SEdge, PolylineEdgeView);

        // Graph root
        configureModelElement(context, LD_NODE_TYPES.GRAPH, SGraph, SGraphView);
    });
}
