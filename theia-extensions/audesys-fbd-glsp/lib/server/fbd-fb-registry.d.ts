/**
 * FB Pin Registry — default input/output pin definitions for known IEC 61131-3
 * standard function block types.
 *
 * ponytail: compact registry, not a class.
 */
import { PinDirection } from '../gmodel/nodes';
export interface FbPinDef {
    name: string;
    dataType: string;
    direction: PinDirection;
}
export interface FbDef {
    inputs: FbPinDef[];
    outputs: FbPinDef[];
}
/** Get expanded pin definition for a known FB type, or undefined. */
export declare function getFbDef(fbType: string): FbDef | undefined;
//# sourceMappingURL=fbd-fb-registry.d.ts.map