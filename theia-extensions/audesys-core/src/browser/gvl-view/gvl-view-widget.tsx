import * as React from '@theia/core/shared/react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { GVL_TYPES, GvlVariable, parseGvl, serializeGvl } from '../gvl-model';

interface GvlWidgetState {
    /** URI of the .gvl file currently shown (null when none active). */
    uri: string | null;
    fileName: string | null;
    /** Work-in-progress table rows. */
    vars: GvlVariable[];
    error: string | null;
    loading: boolean;
    dirty: boolean;
}

const EMPTY_STATE: GvlWidgetState = {
    uri: null,
    fileName: null,
    vars: [],
    error: null,
    loading: false,
    dirty: false,
};

/**
 * GVL Variables panel — follows the active editor. When a `.gvl` file is
 * open it shows its `VAR_GLOBAL` variables in a table with inline editing
 * (name / type dropdown / init / comment) and a Save button that writes the
 * serialized block back to the file.
 */
@injectable()
export class GvlViewWidget extends ReactWidget {
    static readonly ID = 'audesys.gvl-view';
    static readonly LABEL = 'GVL Variables';

    @inject(FileService) protected readonly fileService!: FileService;
    @inject(EditorManager) protected readonly editorManager!: EditorManager;

    private state: GvlWidgetState = { ...EMPTY_STATE };

    constructor() {
        super();
        this.id = GvlViewWidget.ID;
        this.title.label = GvlViewWidget.LABEL;
        this.title.caption = 'Global Variable List editor';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-table';
        this.addClass('audesys-gvl-view');
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.editorManager.onActiveEditorChanged((w) => this.handleActiveEditor(w)));
        this.handleActiveEditor(this.editorManager.activeEditor);
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.update();
    }

    protected override render(): React.ReactNode {
        const { uri, fileName, vars, error, loading, dirty } = this.state;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {this.renderToolbar(fileName, vars.length, dirty, loading)}
                {this.renderError(error)}
                {this.renderBody(uri, vars)}
            </div>
        );
    }

    private renderToolbar(fileName: string | null, count: number, dirty: boolean, loading: boolean): React.ReactNode {
        return (
            <div style={{
                padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
            }}>
                <span style={{ fontSize: 11, color: 'var(--theia-sideBarTitle-foreground)', fontWeight: 600 }}>
                    {fileName ?? 'Global Variables'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--theia-descriptionForeground)', marginLeft: 'auto' }}>
                    {loading ? 'Loading…' : `${count} vars`}
                </span>
                <button
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => this.addVar()}
                    disabled={!this.state.uri}
                    title="Add a variable row"
                >
                    + Add
                </button>
                <button
                    style={{ fontSize: 11, padding: '2px 8px', fontWeight: dirty ? 700 : undefined }}
                    onClick={() => this.save()}
                    disabled={!dirty}
                    title="Write changes back to the .gvl file"
                >
                    Save
                </button>
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

    private renderBody(uri: string | null, vars: GvlVariable[]): React.ReactNode {
        if (!uri) {
            return (
                <div style={{
                    flex: 1, overflow: 'auto', padding: '12px 8px',
                    color: 'var(--theia-descriptionForeground)', fontSize: 12,
                }}>
                    Open a .gvl file to edit global variables.
                </div>
            );
        }
        return (
            <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ color: 'var(--theia-descriptionForeground)', textAlign: 'left' }}>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Type</th>
                            <th style={thStyle}>Init</th>
                            <th style={thStyle}>Comment</th>
                            <th style={{ ...thStyle, width: 24 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {vars.map((v, i) => this.renderRow(v, i))}
                    </tbody>
                </table>
            </div>
        );
    }

    private renderRow(v: GvlVariable, index: number): React.ReactNode {
        // Keep the current type visible in the dropdown even if it is not in
        // the A2-3 subset (e.g. WORD from an existing file).
        const typeOptions = GVL_TYPES.includes(v.type) ? GVL_TYPES : [...GVL_TYPES, v.type];
        return (
            <tr key={index} style={{ verticalAlign: 'top' }}>
                <td style={tdStyle}>
                    <input
                        style={inputStyle}
                        value={v.name}
                        placeholder="name"
                        spellCheck={false}
                        onChange={(e) => this.updateVar(index, { name: e.target.value })}
                    />
                </td>
                <td style={tdStyle}>
                    <select
                        style={{ ...inputStyle, width: '100%' }}
                        value={v.type}
                        onChange={(e) => this.updateVar(index, { type: e.target.value })}
                    >
                        {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </td>
                <td style={tdStyle}>
                    <input
                        style={inputStyle}
                        value={v.init}
                        placeholder="0"
                        spellCheck={false}
                        onChange={(e) => this.updateVar(index, { init: e.target.value })}
                    />
                </td>
                <td style={tdStyle}>
                    <input
                        style={inputStyle}
                        value={v.comment}
                        placeholder="—"
                        spellCheck={false}
                        onChange={(e) => this.updateVar(index, { comment: e.target.value })}
                    />
                </td>
                <td style={tdStyle}>
                    <button
                        style={{ fontSize: 11, padding: '0 6px', cursor: 'pointer' }}
                        title="Remove this variable"
                        onClick={() => this.removeVar(index)}
                    >
                        ✕
                    </button>
                </td>
            </tr>
        );
    }

    private handleActiveEditor(widget: EditorWidget | undefined): void {
        const uri = widget?.editor.uri.toString() ?? '';
        if (!uri.toLowerCase().endsWith('.gvl')) {
            if (this.state.uri !== null) {
                this.setState({ ...EMPTY_STATE });
            }
            return;
        }
        if (uri === this.state.uri) {
            return;
        }
        this.setState({ uri, fileName: new URI(uri).path.base ?? null, loading: true, error: null });
        this.loadVars(uri);
    }

    private async loadVars(uri: string): Promise<void> {
        try {
            const stat = await this.fileService.readFile(new URI(uri));
            const text = stat.value.toString();
            this.setState({ vars: parseGvl(text), loading: false, dirty: false });
        } catch (e) {
            this.setState({ vars: [], loading: false, error: `Failed to read GVL: ${String(e)}` });
        }
    }

    private async save(): Promise<void> {
        const { uri, vars } = this.state;
        if (!uri) {
            return;
        }
        // Drop rows with no name — they serialize to invalid declarations.
        const valid = vars.filter((v) => v.name.trim() !== '');
        try {
            await this.fileService.writeFile(new URI(uri), BinaryBuffer.fromString(serializeGvl(valid)));
            this.setState({ vars: valid, dirty: false, error: null });
        } catch (e) {
            this.setState({ error: `Failed to save GVL: ${String(e)}` });
        }
    }

    private updateVar(index: number, patch: Partial<GvlVariable>): void {
        const vars = this.state.vars.map((v, i) => (i === index ? { ...v, ...patch } : v));
        this.setState({ vars, dirty: true });
    }

    private addVar(): void {
        this.setState({
            vars: [...this.state.vars, { name: '', type: 'BOOL', init: '', comment: '' }],
            dirty: true,
        });
    }

    private removeVar(index: number): void {
        const vars = this.state.vars.filter((_, i) => i !== index);
        this.setState({ vars, dirty: true });
    }

    private setState(partial: Partial<GvlWidgetState>): void {
        this.state = { ...this.state, ...partial };
        this.update();
    }
}

const thStyle: React.CSSProperties = {
    padding: '2px 4px',
    borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '2px 4px',
    borderBottom: '1px solid var(--theia-sideBar-background)',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 12,
    fontFamily: 'var(--theia-editor-font-family, monospace)',
    background: 'var(--theia-input-background)',
    color: 'var(--theia-input-foreground)',
    border: '1px solid var(--theia-input-border, #3f3f3f)',
    borderRadius: 2,
    padding: '1px 4px',
};