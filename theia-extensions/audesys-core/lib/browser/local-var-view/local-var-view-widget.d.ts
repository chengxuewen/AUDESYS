import * as React from '@theia/core/shared/react';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
/**
 * Local Variables panel — follows the active editor. When a `.st`/`.il` POU
 * file is open it shows the `VAR` block variables in a table with inline
 * editing (name / type dropdown / init / comment) and a Save button that
 * writes the serialized block back into the file, preserving all other code.
 */
export declare class LocalVarViewWidget extends ReactWidget {
    static readonly ID = "audesys.local-var-view";
    static readonly LABEL = "Local Variables";
    protected readonly fileService: FileService;
    protected readonly editorManager: EditorManager;
    private state;
    constructor();
    protected init(): void;
    protected onAfterAttach(msg: Message): void;
    protected render(): React.ReactNode;
    private renderToolbar;
    private renderError;
    private renderBody;
    /** Code-referenced-but-undeclared names (A2-4 hint). Non-blocking. */
    private renderUndeclaredRefs;
    private renderRow;
    private handleActiveEditor;
    private loadVars;
    private save;
    private updateVar;
    private addVar;
    private removeVar;
    private setState;
}
//# sourceMappingURL=local-var-view-widget.d.ts.map