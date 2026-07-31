/**
 * FBD Diagram Generator — converts FbdGraph (source model) → Sprotty GModel.
 *
 * Implements GLSP's GModelFactory interface. Reads the source model from
 * ModelState, walks the nodes/edges, and builds a GGraph with
 * GNodes + GPorts + GEdges for the GLSP client to render.
 *
 * Key difference from LD: FBD uses GPort for pin-level connections.
 * Each Pin on a GateNode/FunctionBlockNode becomes a GPort child of the GNode.
 * Edges connect to port IDs (format: "nodeId::pinName"), not node IDs.
 *
 * Ponytail: one class, one file. No per-element factory classes.
 */

import { inject, injectable } from 'inversify';
import {
    GEdge,
    GGraph,
    GLabel,
    GNode,
    GPort,
    GModelRoot,
} from '@eclipse-glsp/server';
import {
    ModelState,
    GModelFactory,
} from '@eclipse-glsp/server';
import { DefaultTypes } from '@eclipse-glsp/protocol';
import { FbdGraph } from '../gmodel/model';
import {
    BaseNode,
    GateNode,
    FunctionBlockNode,
    Pin,
} from '../gmodel/nodes';
import { SignalEdge } from '../gmodel/edges';

/** Key used to store FbdGraph in ModelState. */
export const FBD_SOURCE_KEY = 'fbd-source-model';

/**
 * Builds a GGraph from an FbdGraph source model.
 *
 * Mapping:
 *  - FbdGraph → GGraph (type: "graph")
 *  - GateNode → GNode (type: "node:gate") + GPort children for each Pin
 *  - FunctionBlockNode → GNode (type: "node:fb") + GPort children for each Pin
 *  - SignalEdge → GEdge (type: "edge:signal") with port-to-port source/target
 *  - Gate label → GLabel (type: "label:name")
 */
@injectable()
export class FbdDiagramGenerator implements GModelFactory {
    @inject(ModelState)
    protected modelState!: ModelState;

    createModel(): void {
        const source = this.modelState.get<FbdGraph>(FBD_SOURCE_KEY);
        if (!source) {
            // No source model yet — create empty graph
            const emptyGraph = GGraph.builder()
                .type('graph')
                .id('fbd-root')
                .build();
            this.modelState.updateRoot(emptyGraph);
            return;
        }

        const root = this.buildGraph(source);
        this.modelState.updateRoot(root);
    }

    /** Build the full GGraph from an FbdGraph. */
    private buildGraph(fbd: FbdGraph): GModelRoot {
        const builder = GGraph.builder()
            .type('graph')
            .id('fbd-root');

        // Build nodes (with GPort children)
        for (const node of fbd.nodes) {
            const gnode = this.buildNode(node);
            if (gnode) {
                builder.add(gnode);
            }
        }

        // Build edges (port-to-port connections)
        for (const edge of fbd.edges) {
            const gedge = this.buildEdge(edge as SignalEdge);
            if (gedge) {
                builder.add(gedge);
            }
        }

        return builder.build();
    }

    /** Convert a single BaseNode → GNode with GPort children. */
    private buildNode(node: BaseNode): GNode | undefined {
        switch (node.type) {
            case 'node:gate':
                return this.buildGateNode(node as GateNode);
            case 'node:fb':
                return this.buildFbNode(node as FunctionBlockNode);
            default:
                return undefined;
        }
    }

    /** Build a GateNode with GPort children for each Pin. */
    private buildGateNode(gate: GateNode): GNode {
        const builder = GNode.builder()
            .type('node:gate')
            .id(gate.id)
            .position(gate.position.x, gate.position.y)
            .size(gate.size.width, gate.size.height)
            .addArg('gateType', gate.gateType);

        // Input ports as GPort children
        for (const pin of gate.inputPorts) {
            builder.add(this.buildPort(gate.id, pin));
        }

        // Output ports as GPort children
        for (const pin of gate.outputPorts) {
            builder.add(this.buildPort(gate.id, pin));
        }

        // Gate type label
        const label = GLabel.builder()
            .id(`${gate.id}-label`)
            .type('label:gateType')
            .text(gate.gateType)
            .position(gate.size.width / 2, gate.size.height / 2 + 4)
            .build();
        builder.add(label);

        return builder.build();
    }

    /** Build a FunctionBlockNode with GPort children for each Pin. */
    private buildFbNode(fb: FunctionBlockNode): GNode {
        const builder = GNode.builder()
            .type('node:fb')
            .id(fb.id)
            .position(fb.position.x, fb.position.y)
            .size(fb.size.width, fb.size.height)
            .addArg('fbType', fb.fbType);

        // Input ports as GPort children
        for (const pin of fb.inputPorts) {
            builder.add(this.buildPort(fb.id, pin));
        }

        // Output ports as GPort children
        for (const pin of fb.outputPorts) {
            builder.add(this.buildPort(fb.id, pin));
        }

        // FB type label
        const label = GLabel.builder()
            .id(`${fb.id}-label`)
            .type('label:fbType')
            .text(fb.fbType)
            .position(fb.size.width / 2, fb.size.height / 2 + 4)
            .build();
        builder.add(label);

        return builder.build();
    }

    /**
     * Build a GPort for a Pin.
     *
     * Port ID format: "nodeId::pinName" (uses '::' separator to avoid
     * ambiguity with node IDs that contain '-').
     *
     * GPort position is RELATIVE to parent node (confirmed by GLSP docs).
     * The Pin.position in gmodel/nodes.ts is already relative, so we use it directly.
     */
    private buildPort(nodeId: string, pin: Pin): GPort {
        return GPort.builder()
            .type(DefaultTypes.PORT)  // 'port'
            .id(`${nodeId}::${pin.name}`)
            .position(pin.position.x, pin.position.y)
            .size(10, 10)  // REQUIRED — without size, some layout engines skip rendering
            .addArg('pinDirection', pin.direction)
            .addArg('dataType', pin.dataType)
            .addArg('pinName', pin.name)
            .build();
    }

    /** Build a SignalEdge with port-to-port source/target. */
    private buildEdge(edge: SignalEdge): GEdge | undefined {
        // Port ID format: "nodeId::pinName"
        const sourcePortId = `${edge.sourceId}::${edge.sourcePortName}`;
        const targetPortId = `${edge.targetId}::${edge.targetPortName}`;

        const builder = GEdge.builder()
            .type('edge:signal')
            .id(edge.id)
            .sourceId(sourcePortId)
            .targetId(targetPortId);

        if (edge.routingPoints) {
            builder.addRoutingPoints(edge.routingPoints);
        }

        return builder.build();
    }
}
