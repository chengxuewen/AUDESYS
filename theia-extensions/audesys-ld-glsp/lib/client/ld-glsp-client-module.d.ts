/**
 * LD GLSP Client Module — registers LD diagram types with GLSP client.
 *
 * Enables interactive features: select, move, delete, resize, viewport.
 * In GLSP 2.x, configureModelElement is from 'sprotty'.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
/** Node type constants — must match server-side diagram configuration */
export declare const LD_NODE_TYPES: {
    readonly GRAPH: "graph";
    readonly CONTACT: "node:contact";
    readonly COIL: "node:coil";
    readonly POWERRAIL: "node:powerrail";
    readonly FB: "node:fb";
    readonly WIRE: "edge:wire";
    readonly POWER: "edge:power";
};
export declare function resetCounters(): void;
declare const _default: ContainerModule;
export default _default;
export declare function nextContactName(): string;
export declare function nextCoilName(): string;
//# sourceMappingURL=ld-glsp-client-module.d.ts.map