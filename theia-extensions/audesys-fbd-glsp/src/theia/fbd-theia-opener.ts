/**
 * FBD Editor OpenHandler — opens .fbd files in the GLSP diagram editor.
 *
 * Plain class (no DI) — manually constructed and registered via
 * OpenerService.addHandler() to bypass the Symbol("OpenHandler")
 * duplication bug in the bundle.
 *
 * Priority 1000: above Monaco text editor (100).
 */
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { URI } from '@theia/core/lib/common/uri';
import { DiagramServiceProvider, GLSPDiagramWidgetOptions } from '@eclipse-glsp/theia-integration/lib/browser';
import { FbdDiagramLanguage } from './fbd-language';

export class FbdEditorOpenHandler implements OpenHandler {
    readonly id = 'audesys-fbd-opener';
    readonly label = 'FBD Function Block Diagram Editor';
    private widgetCount = 0;

    constructor(
        private readonly shell: ApplicationShell,
        private readonly diagramServiceProvider: DiagramServiceProvider,
    ) {
    }

    canHandle(uri: URI): number {
        return uri.path.ext === '.fbd' ? 1000 : 0;
    }

    async open(uri: URI): Promise<object | undefined> {
        try {
            const { diagramType, contributionId } = FbdDiagramLanguage;
            const options: GLSPDiagramWidgetOptions = {
                diagramType, kind: 'navigatable', uri: uri.toString(true),
                iconClass: 'codicon type-hierarchy-sub', label: uri.path.base, editMode: 'editable',
            };
            const config = this.diagramServiceProvider.getDiagramConfiguration(diagramType);
            const diContainer = config.createContainer({
                clientId: `${diagramType}_${this.widgetCount++}`,
                diagramType, sourceUri: options.uri, editMode: options.editMode,
                glspClientProvider: () => this.diagramServiceProvider.getGLSPClientContribution(contributionId).glspClient,
            });
            const factory = this.diagramServiceProvider.getDiagramWidgetFactory(diagramType);
            const widget = factory.create(options, diContainer);
            widget.listenToFocusState(this.shell);
            widget.title.label = uri.displayName;
            widget.title.caption = uri.path.toString();
            widget.title.closable = true;
            await this.shell.addWidget(widget, { area: 'main' });
            await widget.getSvgElement();
            await this.shell.activateWidget(widget.id);
            return widget;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[FBD Opener] Failed: ${msg}`, err);
            return undefined;
        }
    }
}
