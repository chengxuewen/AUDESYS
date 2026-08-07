import * as React from '@theia/core/shared/react';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
/**
 * POU tree widget — lists IEC 61131-3 files grouped by directory convention
 * (Programs / FBs / Functions / GVL) in the left sidebar. Clicking a file opens
 * it via the OpenerService (routes .ld/.fbd to their editors, text to Monaco).
 */
export declare class PouTreeWidget extends ReactWidget {
    static readonly ID = "audesys.pou-tree";
    static readonly LABEL = "POU";
    protected readonly fileService: FileService;
    protected readonly workspaceService: WorkspaceService;
    protected readonly openerService: OpenerService;
    private expanded;
    private state;
    constructor();
    protected init(): void;
    protected onAfterAttach(msg: Message): void;
    protected render(): React.ReactNode;
    private renderToolbar;
    private renderError;
    private renderGroups;
    private renderGroup;
    private renderFile;
    private iconFor;
    private toggleGroup;
    private openFile;
    /** Debounced refresh — onDidFilesChange fires on every bulk file op. */
    private refreshScheduled;
    private scheduleRefresh;
    private refresh;
    /** Recursively walk the workspace root collecting plain files. */
    private collectFiles;
    private setState;
}
//# sourceMappingURL=pou-tree-widget.d.ts.map