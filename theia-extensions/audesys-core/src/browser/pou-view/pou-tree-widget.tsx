import * as React from '@theia/core/shared/react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { classifyToGroups, extOf, PouFileEntry, PouGroupEntry } from '../pou-tree-model';

interface PouWidgetState {
    groups: PouGroupEntry[];
    error: string | null;
    loading: boolean;
}

/**
 * POU tree widget — lists IEC 61131-3 files grouped by directory convention
 * (Programs / FBs / Functions / GVL) in the left sidebar. Clicking a file opens
 * it via the OpenerService (routes .ld/.fbd to their editors, text to Monaco).
 */
@injectable()
export class PouTreeWidget extends ReactWidget {
    static readonly ID = 'audesys.pou-tree';
    static readonly LABEL = 'POU';

    @inject(FileService) protected readonly fileService!: FileService;
    @inject(WorkspaceService) protected readonly workspaceService!: WorkspaceService;
    @inject(OpenerService) protected readonly openerService!: OpenerService;

    private expanded = new Set<string>();
    private state: PouWidgetState = { groups: [], error: null, loading: false };

    constructor() {
        super();
        this.id = PouTreeWidget.ID;
        this.title.label = PouTreeWidget.LABEL;
        this.title.caption = 'IEC 61131-3 Program Organization';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-sitemap';
        this.addClass('audesys-pou-tree');
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.workspaceService.onWorkspaceChanged(() => this.scheduleRefresh()));
        this.toDispose.push(this.fileService.onDidFilesChange(() => this.scheduleRefresh()));
        this.refresh();
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.update();
    }

    protected override render(): React.ReactNode {
        const { groups, loading, error } = this.state;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {this.renderToolbar(loading)}
                {this.renderError(error)}
                {this.renderGroups(groups)}
            </div>
        );
    }

    private renderToolbar(loading: boolean): React.ReactNode {
        return (
            <div style={{
                padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
            }}>
                <span style={{ fontSize: 11, color: 'var(--theia-sideBarTitle-foreground)', fontWeight: 600 }}>Program Organization</span>
                <span style={{ fontSize: 10, color: 'var(--theia-descriptionForeground)', marginLeft: 'auto' }}>
                    {loading ? 'Scanning…' : `${this.state.groups.reduce((n, g) => n + g.files.length, 0)} files`}
                </span>
            </div>
        );
    }

    private renderError(error: string | null): React.ReactNode {
        if (!error) {
            return null;
        }
        return (
            <div style={{
                padding: '4px 8px', color: 'var(--theia-errorForeground)',
                fontSize: 11, background: 'var(--theia-inputValidation-errorBackground)',
            }}>
                {error}
            </div>
        );
    }

    private renderGroups(groups: PouGroupEntry[]): React.ReactNode {
        if (groups.length === 0) {
            return (
                <div style={{
                    flex: 1, overflow: 'auto', padding: '12px 8px',
                    color: 'var(--theia-descriptionForeground)', fontSize: 12,
                }}>
                    No IEC files yet. Open a workspace and create files via File &gt; New &gt; IEC 61131-3.
                </div>
            );
        }
        return (
            <div style={{ flex: 1, overflow: 'auto' }}>
                {groups.map((g) => this.renderGroup(g))}
            </div>
        );
    }

    private renderGroup(group: PouGroupEntry): React.ReactNode {
        const isOpen = this.expanded.has(group.id);
        return (
            <div key={group.id}>
                <div
                    role="treeitem"
                    aria-expanded={isOpen}
                    onClick={() => this.toggleGroup(group.id)}
                    style={{
                        padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        color: 'var(--theia-sideBarTitle-foreground)',
                        background: 'var(--theia-sideBar-sectionHeader-background)',
                        borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                        display: 'flex', alignItems: 'center', gap: 4,
                    }}
                >
                    <span style={{ fontSize: 10, width: 12 }}>{isOpen ? '\u25BC' : '\u25B6'}</span>
                    <span>{group.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--theia-descriptionForeground)', marginLeft: 'auto' }}>
                        {String(group.files.length)}
                    </span>
                </div>
                {isOpen && group.files.map((file) => this.renderFile(group.id, file))}
            </div>
        );
    }

    private renderFile(groupId: string, file: PouFileEntry): React.ReactNode {
        return (
            <div
                key={file.uri}
                role="treeitem"
                onClick={() => this.openFile(file)}
                title={file.uri}
                style={{
                    padding: '2px 8px 2px 28px', fontSize: 12, cursor: 'pointer',
                    fontFamily: 'var(--theia-editor-font-family, monospace)',
                    color: 'var(--theia-foreground)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderBottom: '1px solid var(--theia-sideBar-background)',
                }}
            >
                <span style={{ width: 12, fontSize: 10, color: 'var(--theia-descriptionForeground)' }}>
                    {this.iconFor(groupId)}
                </span>
                <span>{file.name}</span>
            </div>
        );
    }

    private iconFor(groupId: string): string {
        switch (groupId) {
            case 'GVL': return '\u25A3';
            case 'FBs': return '\u25A2';
            case 'Functions': return '\u0192';
            default: return '\u25A1';
        }
    }

    private toggleGroup(id: string): void {
        const next = new Set(this.expanded);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        this.expanded = next;
        this.update();
    }

    private async openFile(file: PouFileEntry): Promise<void> {
        try {
            const uri = new URI(file.uri);
            const opener = await this.openerService.getOpener(uri);
            await opener.open(uri);
        } catch (e) {
            this.setState({ error: `Failed to open ${file.name}: ${String(e)}` });
        }
    }

    /** Debounced refresh — onDidFilesChange fires on every bulk file op. */
    private refreshScheduled = false;

    private scheduleRefresh(): void {
        if (this.refreshScheduled) {
            return;
        }
        this.refreshScheduled = true;
        setTimeout(() => {
            this.refreshScheduled = false;
            this.refresh();
        }, 150);
    }

    private async refresh(): Promise<void> {
        const root = this.workspaceService.tryGetRoots()[0]?.resource;
        if (!root) {
            this.setState({ groups: [], error: null, loading: false });
            return;
        }
        this.setState({ loading: true });
        try {
            const files = await this.collectFiles(root);
            this.setState({ groups: classifyToGroups(files), error: null, loading: false });
        } catch (e) {
            this.setState({ groups: [], error: `Failed to scan workspace: ${String(e)}`, loading: false });
        }
    }

    /** Recursively walk the workspace root collecting plain files. */
    private async collectFiles(root: URI): Promise<PouFileEntry[]> {
        const out: PouFileEntry[] = [];
        const stack: URI[] = [root];
        while (stack.length > 0) {
            const uri = stack.pop() as URI;
            const stat = await this.fileService.resolve(uri);
            if (stat.isDirectory) {
                for (const child of stat.children ?? []) {
                    stack.push(child.resource);
                }
            } else if (stat.isFile) {
                out.push({ uri: stat.resource.toString(), name: stat.name, ext: extOf(stat.name) });
            }
        }
        return out;
    }

    private setState(partial: Partial<PouWidgetState>): void {
        this.state = { ...this.state, ...partial };
        this.update();
    }
}