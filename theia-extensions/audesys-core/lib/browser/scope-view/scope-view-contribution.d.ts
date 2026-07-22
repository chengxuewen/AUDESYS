import { AbstractViewContribution } from '@theia/core/lib/browser';
import type { FrontendApplication } from '@theia/core/lib/browser';
import { ScopeViewWidget } from './scope-panel-widget';
/**
 * Registers the Scope View panel in the bottom panel area.
 *
 * Uses Theia's view contribution pattern. The widget opens in the
 * bottom panel at rank 500 and auto-opens on application start.
 */
export declare class ScopeViewContribution extends AbstractViewContribution<ScopeViewWidget> {
    /** WidgetFactory.id — required by the WidgetFactory interface. */
    readonly id = "audesys.scope-view";
    constructor();
    /** Create a new widget instance. */
    createWidget(): ScopeViewWidget;
    /** Auto-open the widget on application start. */
    onStart(_app: FrontendApplication): Promise<void>;
}
//# sourceMappingURL=scope-view-contribution.d.ts.map