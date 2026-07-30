/**
 * LD Editor OpenHandler — ensures .ld files open in the GLSP diagram editor.
 *
 * Priority 1000: above Monaco text editor (100), below GLSPDiagramManager (1001).
 * If the GLSP framework's toService() OpenHandler binding works, this handler is never
 * selected. If it doesn't (known inversify 6.2.2 issue), this handler directly creates
 * and opens a GLSPDiagramWidget instead of returning undefined.
 */
import { injectable, inject } from '@theia/core/shared/inversify';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { URI } from '@theia/core/lib/common/uri';
import { DiagramServiceProvider } from '@eclipse-glsp/theia-integration/lib/browser';
import { GLSPDiagramWidgetOptions } from '@eclipse-glsp/theia-integration/lib/browser';
import { LdDiagramLanguage } from './ld-language';

@injectable()
export class LdEditorOpenHandler implements OpenHandler {
    readonly id = 'audesys-ld-opener';
    readonly label = 'LD Ladder Diagram Editor';

    private widgetCount = 0;

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(DiagramServiceProvider)
    protected readonly diagramServiceProvider!: DiagramServiceProvider;

    canHandle(uri: URI): number {
        return uri.path.ext === '.ld' ? 1000 : 0;
    }

    async open(uri: URI): Promise<object | undefined> {
        try {
            const { diagramType, contributionId } = LdDiagramLanguage;

            const options: GLSPDiagramWidgetOptions = {
                diagramType,
                kind: 'navigatable',
                uri: uri.toString(true),
                iconClass: 'codicon type-hierarchy-sub',
                label: uri.path.base,
                editMode: 'editable',
            };

            const config = this.diagramServiceProvider.getDiagramConfiguration(diagramType);
            const diagramOptions = {
                clientId: `${diagramType}_${this.widgetCount++}`,
                diagramType,
                sourceUri: options.uri,
                editMode: options.editMode,
                glspClientProvider: () => this.diagramServiceProvider.getGLSPClientContribution(contributionId).glspClient,
            };

            const diContainer = config.createContainer(diagramOptions);

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
            console.error(`[LD Opener] Failed to open GLSP diagram: ${msg}`, err);
            return undefined;
        }
    }
}
