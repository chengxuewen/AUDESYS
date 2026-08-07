import { injectable } from '@theia/core/shared/inversify';
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
@injectable()
export class GvlViewContribution extends AbstractViewContribution<GvlViewWidget> {
    readonly id = GvlViewWidget.ID;

    constructor() {
        super({
            widgetId: GvlViewWidget.ID,
            widgetName: GvlViewWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 240,
            },
        });
    }

    createWidget(): GvlViewWidget {
        return new GvlViewWidget();
    }

    async onStart(_app: FrontendApplication): Promise<void> {
        // ponytail: shell may not be ready during early init; catch prevents crash
        try {
            this.openView({ reveal: true });
        } catch {
            /* widget will open when user clicks GVL Variables in sidebar */
        }
    }
}