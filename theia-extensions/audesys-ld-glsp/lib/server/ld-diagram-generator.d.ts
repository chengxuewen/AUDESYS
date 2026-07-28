/**
 * LD Diagram Generator — converts LdGraph (source model) → Sprotty GModel.
 *
 * Implements GLSP's GModelFactory interface. Reads the source model from
 * ModelState, walks the nodes/edges/rungs, and builds a GGraph with
 * GNoders + GEdges + GLabels for the GLSP client to render.
 *
 * Ponytail: one class, one file. No per-element factory classes.
 */
import { ModelState, GModelFactory } from '@eclipse-glsp/server';
/** Key used to store LdGraph in ModelState. */
export declare const LD_SOURCE_KEY = "ld-source-model";
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
export declare class LdDiagramGenerator implements GModelFactory {
    protected modelState: ModelState;
    createModel(): void;
    /** Build the full GGraph from an LdGraph. */
    private buildGraph;
    /** Convert a single BaseNode → GNode. */
    private buildNode;
    private buildContact;
    private buildCoil;
    private buildPowerRail;
    /** ponytail: minimal FB placeholder — expand when FB editing is needed. */
    private buildFbPlaceholder;
    /**
     * Build a visual rung group (optional visual container).
     * Each rung gets a thin bounding-box GNode for visual grouping.
     */
    private buildRungGroup;
}
//# sourceMappingURL=ld-diagram-generator.d.ts.map