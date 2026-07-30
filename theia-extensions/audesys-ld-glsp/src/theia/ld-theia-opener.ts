/**
 * LD Editor OpenHandler — opens .ld files in the GLSP diagram editor.
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
import { LdDiagramLanguage } from './ld-language';

export class LdEditorOpenHandler implements OpenHandler {
    readonly id = 'audesys-ld-opener';
    readonly label = 'LD Ladder Diagram Editor';
    private widgetCount = 0;

    constructor(
        private readonly shell: ApplicationShell,
        private readonly diagramServiceProvider: DiagramServiceProvider,
    ) {
        console.log('[LD Opener] constructed');
    }

    canHandle(uri: URI): number {
        return uri.path.ext === '.ld' ? 1000 : 0;
    }

    async open(uri: URI): Promise<object | undefined> {
        try {
            const { diagramType, contributionId } = LdDiagramLanguage;
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
            console.error(`[LD Opener] Failed: ${msg}`, err);
            return undefined;
        }
    }
}
