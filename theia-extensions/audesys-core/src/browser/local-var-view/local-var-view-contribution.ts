import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import type { FrontendApplication } from '@theia/core/lib/browser';
import { LocalVarViewWidget } from './local-var-view-widget';

/**
 * Registers the Local Variables panel in the left sidebar.
 *
 * Follows the same AbstractViewContribution + WidgetFactory pattern as the
 * GVL view / POU tree. Opens into the left panel just below the GVL view.
 */
@injectable()
export class LocalVarViewContribution extends AbstractViewContribution<LocalVarViewWidget> {
    readonly id = LocalVarViewWidget.ID;

    constructor() {
        super({
            widgetId: LocalVarViewWidget.ID,
            widgetName: LocalVarViewWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 230,
            },
        });
    }

    createWidget(): LocalVarViewWidget {
        return new LocalVarViewWidget();
    }

    async onStart(_app: FrontendApplication): Promise<void> {
        // ponytail: shell may not be ready during early init; catch prevents crash
        try {
            this.openView({ reveal: true });
        } catch {
            /* widget will open when user clicks Local Variables in sidebar */
        }
    }
}