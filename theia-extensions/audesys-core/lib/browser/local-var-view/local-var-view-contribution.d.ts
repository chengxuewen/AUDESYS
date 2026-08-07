import { AbstractViewContribution } from '@theia/core/lib/browser';
import type { FrontendApplication } from '@theia/core/lib/browser';
import { LocalVarViewWidget } from './local-var-view-widget';
/**
 * Registers the Local Variables panel in the left sidebar.
 *
 * Follows the same AbstractViewContribution + WidgetFactory pattern as the
 * GVL view / POU tree. Opens into the left panel just below the GVL view.
 */
export declare class LocalVarViewContribution extends AbstractViewContribution<LocalVarViewWidget> {
    readonly id = "audesys.local-var-view";
    constructor();
    createWidget(): LocalVarViewWidget;
    onStart(_app: FrontendApplication): Promise<void>;
}
//# sourceMappingURL=local-var-view-contribution.d.ts.map