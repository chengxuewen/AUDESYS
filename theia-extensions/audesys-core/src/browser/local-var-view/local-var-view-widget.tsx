import * as React from '@theia/core/shared/react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { LOCAL_TYPES, LocalVariable, parseLocalVars, serializeLocalVars } from '../local-var-model';

/** File extensions that expose a local-variable table. */
const LOCAL_VAR_EXTS = ['.st', '.il'];

interface LocalVarWidgetState {
    /** URI of the .st/.il file currently shown (null when none active). */
    uri: string | null;
    fileName: string | null;
    /** Original file text — needed to serialize changes back in place. */
    originalText: string;
    /** Work-in-progress table rows. */
    vars: LocalVariable[];
    error: string | null;
    loading: boolean;
    dirty: boolean;
}

const EMPTY_STATE: LocalVarWidgetState = {
    uri: null,
    fileName: null,
    originalText: '',
    vars: [],
    error: null,
    loading: false,
    dirty: false,
};

/**
 * Local Variables panel — follows the active editor. When a `.st`/`.il` POU
 * file is open it shows the `VAR` block variables in a table with inline
 * editing (name / type dropdown / init / comment) and a Save button that
 * writes the serialized block back into the file, preserving all other code.
 */
@injectable()
export class LocalVarViewWidget extends ReactWidget {
    static readonly ID = 'audesys.local-var-view';
    static readonly LABEL = 'Local Variables';

    @inject(FileService) protected readonly fileService!: FileService;
    @inject(EditorManager) protected readonly editorManager!: EditorManager;

    private state: LocalVarWidgetState = { ...EMPTY_STATE };

    constructor() {
        super();
        this.id = LocalVarViewWidget.ID;
        this.title.label = LocalVarViewWidget.LABEL;
        this.title.caption = 'Local variable editor';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-table';
        this.addClass('audesys-local-var-view');
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
                    {fileName ?? 'Local Variables'}
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
                    title="Write changes back to the file"
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

    private renderBody(uri: string | null, vars: LocalVariable[]): React.ReactNode {
        if (!uri) {
            return (
                <div style={{
                    flex: 1, overflow: 'auto', padding: '12px 8px',
                    color: 'var(--theia-descriptionForeground)', fontSize: 12,
                }}>
                    Open a .st or .il program file to edit local variables.
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

    private renderRow(v: LocalVariable, index: number): React.ReactNode {
        // Keep the current type visible in the dropdown even if it is not in
        // the A2-3 subset (e.g. WORD from an existing file).
        const typeOptions = LOCAL_TYPES.includes(v.type) ? LOCAL_TYPES : [...LOCAL_TYPES, v.type];
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
        const isLocalVarFile = LOCAL_VAR_EXTS.some((ext) => uri.toLowerCase().endsWith(ext));
        if (!isLocalVarFile) {
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
            this.setState({ originalText: text, vars: parseLocalVars(text), loading: false, dirty: false });
        } catch (e) {
            this.setState({ vars: [], loading: false, error: `Failed to read file: ${String(e)}` });
        }
    }

    private async save(): Promise<void> {
        const { uri, originalText, vars } = this.state;
        if (!uri) {
            return;
        }
        // Drop rows with no name — they serialize to invalid declarations.
        const valid = vars.filter((v) => v.name.trim() !== '');
        try {
            const next = serializeLocalVars(originalText, valid);
            await this.fileService.writeFile(new URI(uri), BinaryBuffer.fromString(next));
            this.setState({ originalText: next, vars: valid, dirty: false, error: null });
        } catch (e) {
            this.setState({ error: `Failed to save: ${String(e)}` });
        }
    }

    private updateVar(index: number, patch: Partial<LocalVariable>): void {
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

    private setState(partial: Partial<LocalVarWidgetState>): void {
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