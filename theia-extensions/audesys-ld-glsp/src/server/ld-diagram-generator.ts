/**
 * LD Diagram Generator — converts LdGraph (source model) → Sprotty GModel.
 *
 * Implements GLSP's GModelFactory interface. Reads the source model from
 * ModelState, walks the nodes/edges/rungs, and builds a GGraph with
 * GNoders + GEdges + GLabels for the GLSP client to render.
 *
 * Ponytail: one class, one file. No per-element factory classes.
 */

import { inject, injectable } from 'inversify';
import {
    GEdge,
    GGraph,
    GLabel,
    GNode,
    GModelRoot,
} from '@eclipse-glsp/server';
import {
    ModelState,
    GModelFactory,
} from '@eclipse-glsp/server';
import { LdGraph, Rung } from '../gmodel/model';
import {
    BaseNode,
    ContactNode,
    CoilNode,
    PowerRailNode,
} from '../gmodel/nodes';
import { WireConnection } from '../gmodel/edges';

/** Key used to store LdGraph in ModelState. */
export const LD_SOURCE_KEY = 'ld-source-model';

/**
 * Builds a GGraph from an LdGraph source model.
 *
 * Mapping:
 *  - LdGraph → GGraph (type: "graph")
 *  - ContactNode → GNode (type: "node:contact") + GLabel for variable name
 *  - CoilNode → GNode (type: "node:coil") + GLabel for variable name
 *  - PowerRailNode → GNode (type: "node:powerrail")
 *  - WireConnection → GEdge (type: "edge:wire")
 *  - Rung → optional visual GNode container (type: "rung:group")
 */
@injectable()
export class LdDiagramGenerator implements GModelFactory {
    @inject(ModelState)
    protected modelState!: ModelState;

    createModel(): void {
        const source = this.modelState.get<LdGraph>(LD_SOURCE_KEY);
        if (!source) {
            // No source model yet — create empty graph
            const emptyGraph = GGraph.builder()
                .type('graph')
                .id('ld-root')
                .build();
            this.modelState.updateRoot(emptyGraph);
            return;
        }

        const root = this.buildGraph(source);
        this.modelState.updateRoot(root);
    }

    /** Build the full GGraph from an LdGraph. */
    private buildGraph(ld: LdGraph): GModelRoot {
        const builder = GGraph.builder()
            .type('graph')
            .id('ld-root');

        // Build nodes
        for (const node of ld.nodes) {
            const gnode = this.buildNode(node);
            if (gnode) {
                builder.add(gnode);
            }
        }

        // Build rung containers (visual grouping)
        for (const rung of ld.rungs) {
            const group = this.buildRungGroup(rung);
            if (group) {
                builder.add(group);
            }
        }

        // Build edges (wires)
        for (const edge of ld.edges) {
            const gedge = GEdge.builder()
                .type(edge.type)
                .id(edge.id)
                .sourceId(edge.sourceId)
                .targetId(edge.targetId);

            // ponytail: routingPoints only on WireConnection, not BaseEdge
            if (edge.type === 'edge:wire') {
                const wire = edge as WireConnection;
                if (wire.routingPoints) {
                    gedge.addRoutingPoints(wire.routingPoints);
                }
            }

            builder.add(gedge.build());
        }

        return builder.build();
    }

    /** Convert a single BaseNode → GNode. */
    private buildNode(node: BaseNode): GNode | undefined {
        switch (node.type) {
            case 'node:contact':
                return this.buildContact(node as ContactNode);
            case 'node:coil':
                return this.buildCoil(node as CoilNode);
            case 'node:powerrail':
                return this.buildPowerRail(node as PowerRailNode);
            case 'node:fb':
                return this.buildFbPlaceholder(node);
            default:
                return undefined;
        }
    }

    private buildContact(contact: ContactNode): GNode {
        const labelId = `${contact.id}-label`;
        const label = GLabel.builder()
            .id(labelId)
            .type('label:name')
            .text(contact.variableName)
            .position(0, contact.size.height + 2)
            .size(contact.size.width, 14)
            .build();

        return GNode.builder()
            .type('node:contact')
            .id(contact.id)
            .position(contact.position.x, contact.position.y)
            .size(contact.size.width, contact.size.height)
            .addCssClass(contact.contactType === 'NC' ? 'contact-nc' : 'contact-no')
            .add(label)
            .build();
    }

    private buildCoil(coil: CoilNode): GNode {
        const labelId = `${coil.id}-label`;
        const label = GLabel.builder()
            .id(labelId)
            .type('label:name')
            .text(coil.variableName)
            .position(0, coil.size.height + 2)
            .size(coil.size.width, 14)
            .build();

        return GNode.builder()
            .type('node:coil')
            .id(coil.id)
            .position(coil.position.x, coil.position.y)
            .size(coil.size.width, coil.size.height)
            .addCssClass(`coil-${coil.coilType.toLowerCase()}`)
            .add(label)
            .build();
    }

    private buildPowerRail(rail: PowerRailNode): GNode {
        return GNode.builder()
            .type('node:powerrail')
            .id(rail.id)
            .position(rail.position.x, rail.position.y)
            .size(rail.size.width, rail.size.height)
            .addCssClass(`power-rail-${rail.side}`)
            .addArg('side', rail.side)
            .build();
    }

    /** ponytail: minimal FB placeholder — expand when FB editing is needed. */
    private buildFbPlaceholder(node: BaseNode): GNode {
        return GNode.builder()
            .type(node.type)
            .id(node.id)
            .position(node.position.x, node.position.y)
            .size(node.size.width, node.size.height)
            .addCssClass('fb-placeholder')
            .build();
    }

    /**
     * Build a visual rung group (optional visual container).
     * Each rung gets a thin bounding-box GNode for visual grouping.
     */
    private buildRungGroup(rung: Rung): GNode | undefined {
        if (rung.elementIds.length === 0) return undefined;

        // ponytail: fixed rung height 80px, width from left rail to right rail
        const rungY = (rung.rungNumber - 1) * 80;
        return GNode.builder()
            .type('rung:group')
            .id(rung.id)
            .position(0, rungY)
            .size(800, 76) // ponytail: fixed width, T2a.4 layout engine replaces
            .addArg('rungNumber', rung.rungNumber)
            .addCssClass('rung-group')
            .build();
    }
}
