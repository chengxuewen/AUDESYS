import { injectable } from '@theia/core/shared/inversify';
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
@injectable()
export class PouTreeContribution extends AbstractViewContribution<PouTreeWidget> {
    readonly id = PouTreeWidget.ID;

    constructor() {
        super({
            widgetId: PouTreeWidget.ID,
            widgetName: PouTreeWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 250,
            },
        });
    }

    createWidget(): PouTreeWidget {
        return new PouTreeWidget();
    }

    async onStart(_app: FrontendApplication): Promise<void> {
        // ponytail: shell may not be ready during early init; catch prevents crash
        try {
            this.openView({ reveal: true });
        } catch {
            /* widget will open when user clicks POU in sidebar */
        }
    }
}