/**
 * FBD → IL Compiler — converts a Function Block Diagram graph to
 * IEC 61131-3 Instruction List (IL) text.
 *
 * The IL text is then compiled to HalProgram via napi-rs `compileFbd`.
 *
 * Ponytail: simple topological-sort → string builder. No AST pipeline.
 */
import { FbdGraph } from '../gmodel/model';
/** Result of IL text generation. */
export interface IlGenerationResult {
    /** Generated IL source text */
    ilText: string;
    /** Names of variables used (for declaration) */
    variables: string[];
}
/**
 * Convert an FBD graph to IL text.
 *
 * Strategy:
 * 1. Build adjacency map from edges
 * 2. Topological sort nodes
 * 3. Emit IL instructions per node
 *
 * @param graph - The FBD graph to convert
 * @returns IL generation result
 */
export declare function convertGraphToIl(graph: FbdGraph): IlGenerationResult;
//# sourceMappingURL=fbd-compile.d.ts.map