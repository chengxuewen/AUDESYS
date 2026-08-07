import * as React from '@theia/core/shared/react';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
/**
 * GVL Variables panel — follows the active editor. When a `.gvl` file is
 * open it shows its `VAR_GLOBAL` variables in a table with inline editing
 * (name / type dropdown / init / comment) and a Save button that writes the
 * serialized block back to the file.
 */
export declare class GvlViewWidget extends ReactWidget {
    static readonly ID = "audesys.gvl-view";
    static readonly LABEL = "GVL Variables";
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
    private renderRow;
    private handleActiveEditor;
    private loadVars;
    private save;
    private updateVar;
    private addVar;
    private removeVar;
    private setState;
}
//# sourceMappingURL=gvl-view-widget.d.ts.map