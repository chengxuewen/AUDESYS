/**
 * LD Tool Palette Item Provider — custom palette for Ladder Diagram GLSP editor.
 *
 * Returns 7 palette items: NO Contact, NC Contact, Normal Coil, Negated Coil,
 * Set Coil, Reset Coil, Power Rail. Grouped into "Contacts", "Coils", "Rails".
 *
 * Custom provider is needed because LdCreateNodeHandler extends OperationHandler
 * directly (not CreateNodeOperationHandler), so GLSP auto-discovery won't work.
 */
import { injectable } from 'inversify';
import { PaletteItem, TriggerNodeCreationAction } from '@eclipse-glsp/protocol';
import { DefaultToolPaletteItemProvider } from '@eclipse-glsp/server';

function ldPaletteItem(
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
export class LdToolPaletteItemProvider extends DefaultToolPaletteItemProvider {
    override getItems(): PaletteItem[] {
        return [
            ldPaletteItem('ld-no-contact', 'node:contact', 'NO Contact', 'ld-contact-no', 'A', { contactType: 'NO' }),
            ldPaletteItem('ld-nc-contact', 'node:contact', 'NC Contact', 'ld-contact-nc', 'B', { contactType: 'NC' }),
            ldPaletteItem('ld-normal-coil', 'node:coil', 'Normal Coil', 'ld-coil-normal', 'C', { coilType: 'Normal' }),
            ldPaletteItem('ld-negated-coil', 'node:coil', 'Negated Coil', 'ld-coil-negated', 'D', { coilType: 'Negated' }),
            ldPaletteItem('ld-set-coil', 'node:coil', 'Set Coil', 'ld-coil-set', 'E', { coilType: 'Set' }),
            ldPaletteItem('ld-reset-coil', 'node:coil', 'Reset Coil', 'ld-coil-reset', 'F', { coilType: 'Reset' }),
            ldPaletteItem('ld-power-rail', 'node:powerrail', 'Power Rail', 'ld-powerrail', 'G'),
        ];
    }
}
