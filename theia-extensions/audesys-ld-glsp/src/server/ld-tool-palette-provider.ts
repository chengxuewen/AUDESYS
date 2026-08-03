/**
 * LD Tool Palette Item Provider — custom palette for Ladder Diagram GLSP editor.
 *
 * Returns 7 palette items: NO Contact, NC Contact, Normal Coil, Negated Coil,
 * Set Coil, Reset Coil, Power Rail.
 *
 * Each item provides a ghostElement template so the insert indicator renders
 * as the REAL element shape (contact/coil) instead of the default cross symbol.
 *
 * Custom provider is needed because LdCreateNodeHandler extends OperationHandler
 * directly (not CreateNodeOperationHandler), so GLSP auto-discovery won't work.
 */
import { injectable } from 'inversify';
import { PaletteItem, TriggerNodeCreationAction } from '@eclipse-glsp/protocol';
import { DefaultToolPaletteItemProvider } from '@eclipse-glsp/server';

/**
 * Build a ghost element template for a contact/coil node.
 * The ghost renders as the actual element shape with reduced opacity,
 * providing clear placement feedback instead of the default cross.
 *
 * The template extends GModelElementSchema with size/args (allowed for
 * ghost previews — the server-side LdDiagramGenerator creates real nodes).
 */
function contactGhost(contactType: string): any {
    return {
        template: {
            id: `ghost-contact-${contactType}`,
            type: 'node:contact',
            size: { width: 36, height: 36 },
            args: { contactType },
        },
    };
}

function coilGhost(coilType: string): any {
    return {
        template: {
            id: `ghost-coil-${coilType}`,
            type: 'node:coil',
            size: { width: 36, height: 36 },
            args: { coilType },
        },
    };
}

function railGhost(): any {
    return {
        template: {
            id: 'ghost-powerrail',
            type: 'node:powerrail',
            size: { width: 4, height: 600 },
            args: { side: 'Left' },
        },
    };
}

function ldPaletteItem(
    id: string,
    elementTypeId: string,
    label: string,
    icon: string,
    sortString: string,
    args?: Record<string, string>,
    ghostElement?: any,
): PaletteItem {
    return {
        id,
        label,
        icon,
        sortString,
        actions: [TriggerNodeCreationAction.create(elementTypeId, { args, ghostElement })],
    };
}

@injectable()
export class LdToolPaletteItemProvider extends DefaultToolPaletteItemProvider {
    override getItems(): PaletteItem[] {
        return [
            ldPaletteItem('ld-no-contact', 'node:contact', 'NO Contact', 'ld-contact-no', 'A',
                { contactType: 'NO' }, contactGhost('NO')),
            ldPaletteItem('ld-nc-contact', 'node:contact', 'NC Contact', 'ld-contact-nc', 'B',
                { contactType: 'NC' }, contactGhost('NC')),
            ldPaletteItem('ld-normal-coil', 'node:coil', 'Normal Coil', 'ld-coil-normal', 'C',
                { coilType: 'Normal' }, coilGhost('Normal')),
            ldPaletteItem('ld-negated-coil', 'node:coil', 'Negated Coil', 'ld-coil-negated', 'D',
                { coilType: 'Negated' }, coilGhost('Negated')),
            ldPaletteItem('ld-set-coil', 'node:coil', 'Set Coil', 'ld-coil-set', 'E',
                { coilType: 'Set' }, coilGhost('Set')),
            ldPaletteItem('ld-reset-coil', 'node:coil', 'Reset Coil', 'ld-coil-reset', 'F',
                { coilType: 'Reset' }, coilGhost('Reset')),
            ldPaletteItem('ld-power-rail', 'node:powerrail', 'Power Rail', 'ld-powerrail', 'G',
                undefined, railGhost()),
        ];
    }
}
