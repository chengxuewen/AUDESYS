import { AbstractViewContribution } from '@theia/core/lib/browser';
import type { FrontendApplication } from '@theia/core/lib/browser';
import { GvlViewWidget } from './gvl-view-widget';
/**
 * Registers the GVL Variables panel in the left sidebar.
 *
 * Follows the same AbstractViewContribution + WidgetFactory pattern as the
 * POU tree / Signal Browser. Opens into the left panel just above the POU
 * tree and auto-opens on application start.
 */
export declare class GvlViewContribution extends AbstractViewContribution<GvlViewWidget> {
    readonly id = "audesys.gvl-view";
    constructor();
    createWidget(): GvlViewWidget;
    onStart(_app: FrontendApplication): Promise<void>;
}
//# sourceMappingURL=gvl-view-contribution.d.ts.map