/**
 * LD Editor OpenHandler — opens .ld files in the React Flow editor.
 *
 * Plain class (no DI) — manually constructed and registered via
 * OpenerService.addHandler() in the bootstrap contribution (D104
 * pattern, avoids the Symbol("OpenHandler") collection bug).
 *
 * Priority 1000: above Monaco text editor (100).
 */

import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';

import { LdPropertyState } from '../property-view/ld-property-state';
import { LdCompileServer } from '../common/ld-compile-protocol';
import { LdEditorWidget } from './ld-editor-widget';

export class LdEditorOpenHandler implements OpenHandler {

    readonly id = 'audesys-ld-editor-opener';
    readonly label = 'LD Ladder Diagram Editor (React Flow)';

    /** Open widgets keyed by URI string, for get-or-create semantics. */
    private readonly widgets = new Map<string, LdEditorWidget>();

    constructor(
        private readonly shell: ApplicationShell,
        private readonly fileService: FileService,
        private readonly propertyState: LdPropertyState,
        private readonly compileServer: LdCompileServer,
    ) { }

    canHandle(uri: URI): number {
        return uri.path.ext === '.ld' ? 1000 : 0;
    }

    async open(uri: URI): Promise<LdEditorWidget | undefined> {
        const key = uri.toString();
        const existing = this.widgets.get(key);
        if (existing && !existing.isDisposed) {
            await this.shell.activateWidget(existing.id);
            return existing;
        }

        let content = '';
        try {
            const stat = await this.fileService.readFile(uri);
            content = stat.value.toString();
        } catch {
            // Missing/unreadable file (e.g. brand-new .ld): open an empty
            // diagram; the widget falls back to a fresh one-rung graph.
        }

        const widget = new LdEditorWidget(uri, content, this.fileService, this.propertyState, this.compileServer);
        this.widgets.set(key, widget);
        widget.disposed.connect(() => this.widgets.delete(key));

        await this.shell.addWidget(widget, { area: 'main' });
        await this.shell.activateWidget(widget.id);
        return widget;
    }
}
