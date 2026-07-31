/**
 * FBD Tool Palette Item Provider — custom palette for Function Block Diagram GLSP editor.
 *
 * Returns palette items for:
 * - 5 Gate types (AND, OR, XOR, NOT, MUX)
 * - Common FB types (TON, CTU, ADD, MOVE, etc.)
 *
 * Custom provider is needed because FbdCreateNodeHandler extends OperationHandler
 * directly (not CreateNodeOperationHandler), so GLSP auto-discovery won't work.
 */
import { injectable } from 'inversify';
import { PaletteItem, TriggerNodeCreationAction } from '@eclipse-glsp/protocol';
import { DefaultToolPaletteItemProvider } from '@eclipse-glsp/server';

function fbdPaletteItem(
    id: string,
    elementTypeId: string,
    label: string,
    icon: string,
    sortString: string,
    args?: Record<string, string>,
): PaletteItem {
    return {
        id,
        label,
        icon,
        sortString,
        actions: [TriggerNodeCreationAction.create(elementTypeId, args)],
    };
}

@injectable()
export class FbdToolPaletteItemProvider extends DefaultToolPaletteItemProvider {
    override getItems(): PaletteItem[] {
        return [
            // Gates
            fbdPaletteItem('fbd-and-gate', 'node:gate', 'AND Gate', 'fbd-gate-and', 'A', { gateType: 'AND' }),
            fbdPaletteItem('fbd-or-gate', 'node:gate', 'OR Gate', 'fbd-gate-or', 'B', { gateType: 'OR' }),
            fbdPaletteItem('fbd-xor-gate', 'node:gate', 'XOR Gate', 'fbd-gate-xor', 'C', { gateType: 'XOR' }),
            fbdPaletteItem('fbd-not-gate', 'node:gate', 'NOT Gate', 'fbd-gate-not', 'D', { gateType: 'NOT' }),
            fbdPaletteItem('fbd-mux-gate', 'node:gate', 'MUX Gate', 'fbd-gate-mux', 'E', { gateType: 'MUX' }),
            // Function Blocks
            fbdPaletteItem('fbd-ton', 'node:fb', 'TON (Timer)', 'fbd-fb-ton', 'F', { fbType: 'TON' }),
            fbdPaletteItem('fbd-ctu', 'node:fb', 'CTU (Counter)', 'fbd-fb-ctu', 'G', { fbType: 'CTU' }),
            fbdPaletteItem('fbd-add', 'node:fb', 'ADD (Add)', 'fbd-fb-add', 'H', { fbType: 'ADD' }),
            fbdPaletteItem('fbd-move', 'node:fb', 'MOVE (Move)', 'fbd-fb-move', 'I', { fbType: 'MOVE' }),
        ];
    }
}
