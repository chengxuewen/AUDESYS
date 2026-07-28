"use strict";
/**
 * LD Diagram Generator — converts LdGraph (source model) → Sprotty GModel.
 *
 * Implements GLSP's GModelFactory interface. Reads the source model from
 * ModelState, walks the nodes/edges/rungs, and builds a GGraph with
 * GNoders + GEdges + GLabels for the GLSP client to render.
 *
 * Ponytail: one class, one file. No per-element factory classes.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdDiagramGenerator = exports.LD_SOURCE_KEY = void 0;
const inversify_1 = require("inversify");
const server_1 = require("@eclipse-glsp/server");
const server_2 = require("@eclipse-glsp/server");
/** Key used to store LdGraph in ModelState. */
exports.LD_SOURCE_KEY = 'ld-source-model';
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
let LdDiagramGenerator = class LdDiagramGenerator {
    createModel() {
        const source = this.modelState.get(exports.LD_SOURCE_KEY);
        if (!source) {
            // No source model yet — create empty graph
            const emptyGraph = server_1.GGraph.builder()
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
    buildGraph(ld) {
        const builder = server_1.GGraph.builder()
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
            const gedge = server_1.GEdge.builder()
                .type(edge.type)
                .id(edge.id)
                .sourceId(edge.sourceId)
                .targetId(edge.targetId);
            // ponytail: routingPoints only on WireConnection, not BaseEdge
            if (edge.type === 'edge:wire') {
                const wire = edge;
                if (wire.routingPoints) {
                    gedge.addRoutingPoints(wire.routingPoints);
                }
            }
            builder.add(gedge.build());
        }
        return builder.build();
    }
    /** Convert a single BaseNode → GNode. */
    buildNode(node) {
        switch (node.type) {
            case 'node:contact':
                return this.buildContact(node);
            case 'node:coil':
                return this.buildCoil(node);
            case 'node:powerrail':
                return this.buildPowerRail(node);
            case 'node:fb':
                return this.buildFbPlaceholder(node);
            default:
                return undefined;
        }
    }
    buildContact(contact) {
        const labelId = `${contact.id}-label`;
        const label = server_1.GLabel.builder()
            .id(labelId)
            .type('label:name')
            .text(contact.variableName)
            .position(0, contact.size.height + 2)
            .size(contact.size.width, 14)
            .build();
        return server_1.GNode.builder()
            .type('node:contact')
            .id(contact.id)
            .position(contact.position.x, contact.position.y)
            .size(contact.size.width, contact.size.height)
            .addCssClass(contact.contactType === 'NC' ? 'contact-nc' : 'contact-no')
            .add(label)
            .build();
    }
    buildCoil(coil) {
        const labelId = `${coil.id}-label`;
        const label = server_1.GLabel.builder()
            .id(labelId)
            .type('label:name')
            .text(coil.variableName)
            .position(0, coil.size.height + 2)
            .size(coil.size.width, 14)
            .build();
        return server_1.GNode.builder()
            .type('node:coil')
            .id(coil.id)
            .position(coil.position.x, coil.position.y)
            .size(coil.size.width, coil.size.height)
            .addCssClass(`coil-${coil.coilType.toLowerCase()}`)
            .add(label)
            .build();
    }
    buildPowerRail(rail) {
        return server_1.GNode.builder()
            .type('node:powerrail')
            .id(rail.id)
            .position(rail.position.x, rail.position.y)
            .size(rail.size.width, rail.size.height)
            .addCssClass(`power-rail-${rail.side}`)
            .addArg('side', rail.side)
            .build();
    }
    /** ponytail: minimal FB placeholder — expand when FB editing is needed. */
    buildFbPlaceholder(node) {
        return server_1.GNode.builder()
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
    buildRungGroup(rung) {
        if (rung.elementIds.length === 0)
            return undefined;
        // ponytail: fixed rung height 80px, width from left rail to right rail
        const rungY = (rung.rungNumber - 1) * 80;
        return server_1.GNode.builder()
            .type('rung:group')
            .id(rung.id)
            .position(0, rungY)
            .size(800, 76) // ponytail: fixed width, T2a.4 layout engine replaces
            .addArg('rungNumber', rung.rungNumber)
            .addCssClass('rung-group')
            .build();
    }
};
exports.LdDiagramGenerator = LdDiagramGenerator;
__decorate([
    (0, inversify_1.inject)(server_2.ModelState),
    __metadata("design:type", Object)
], LdDiagramGenerator.prototype, "modelState", void 0);
exports.LdDiagramGenerator = LdDiagramGenerator = __decorate([
    (0, inversify_1.injectable)()
], LdDiagramGenerator);
//# sourceMappingURL=ld-diagram-generator.js.map