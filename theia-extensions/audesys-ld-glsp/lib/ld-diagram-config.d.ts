/**
 * LD Sprotty Diagram Configuration — binds SModel types ↔ IView implementations.
 *
 * Uses sprotty's `configureModelElement` to register LD node types
 * and their corresponding views in the DI container.
 *
 * Ponytail: one ContainerModule, no separate diagram config interface.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
export declare const LD_NODE_TYPES: {
    readonly GRAPH: "graph";
    readonly CONTACT: "node:contact";
    readonly COIL: "node:coil";
    readonly POWERRAIL: "node:powerrail";
    readonly FB: "node:fb";
    readonly WIRE: "edge:wire";
    readonly POWER: "edge:power";
};
export declare function createLdDiagramModule(): ContainerModule;
//# sourceMappingURL=ld-diagram-config.d.ts.map