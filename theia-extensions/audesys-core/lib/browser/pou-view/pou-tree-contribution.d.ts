import { AbstractViewContribution } from '@theia/core/lib/browser';
import type { FrontendApplication } from '@theia/core/lib/browser';
import { PouTreeWidget } from './pou-tree-widget';
/**
 * Registers the POU tree panel in the left sidebar.
 *
 * Uses the same AbstractViewContribution + WidgetFactory pattern as the
 * Signal Browser. Opens into the left panel at rank 250 and auto-opens on
 * application start.
 */
export declare class PouTreeContribution extends AbstractViewContribution<PouTreeWidget> {
    readonly id = "audesys.pou-tree";
    constructor();
    createWidget(): PouTreeWidget;
    onStart(_app: FrontendApplication): Promise<void>;
}
//# sourceMappingURL=pou-tree-contribution.d.ts.map