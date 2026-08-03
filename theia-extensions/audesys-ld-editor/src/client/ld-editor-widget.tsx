/**
 * LdEditorWidget — Theia ReactWidget hosting the React Flow LD canvas.
 *
 * D110: LdOperationHandler + LdGModelState run in frontend memory —
 * the widget only touches Theia for file load/save (FileService) and
 * Saveable dirty tracking.
 *
 * Created directly via `new` by LdEditorOpenHandler (D104 pattern),
 * so rendering is kicked off in onAfterAttach (no @postConstruct).
 */

import React from '@theia/core/shared/react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Saveable } from '@theia/core/lib/browser/saveable';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable';
import { Emitter } from '@theia/core/lib/common/event';
import { URI } from '@theia/core/lib/common/uri';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { FileService } from '@theia/filesystem/lib/browser/file-service';

import { LdGraph, createLdGraph } from '../model/model';
import { fromJSON, toJSON } from '../model/serialization';
import { LdOperationHandler } from '../backend/ld-operation-handler';
import { LdGModelState } from '../state/ld-gmodel-state';
import { LdPropertyState } from '../property-view/ld-property-state';
import { LdCanvas, LdCanvasController } from '../components/LdCanvas';

/**
 * Parse the initial file content into an LdGraph.
 * Empty or invalid content falls back to a fresh graph with one rung
 * (the rung is auto-created on first tool click otherwise; having one
 * up front matches the GLSP editor behaviour).
 */
function parseInitialGraph(content: string): { graph: LdGraph; loadError: boolean } {
    if (content.trim().length > 0) {
        try {
            return { graph: fromJSON(content), loadError: false };
        } catch {
            // Fall through: opening a fresh graph keeps the editor usable;
            // the title is suffixed below so the user notices the fallback.
        }
    }
    const handler = new LdOperationHandler();
    return { graph: handler.addRung(createLdGraph()), loadError: content.trim().length > 0 };
}

export class LdEditorWidget extends ReactWidget implements Saveable, NavigatableWidget {

    static createId(uri: URI): string {
        return `audesys-ld-editor:${uri.toString()}`;
    }

    readonly uri: URI;

    private readonly state: LdGModelState;
    private readonly handler: LdOperationHandler;
    private readonly fileService: FileService;
    private readonly propertyState: LdPropertyState | undefined;
    private readonly controllerRef: React.MutableRefObject<LdCanvasController | null> = { current: null };
    private readonly onDirtyChangedEmitter = new Emitter<void>();

    readonly onDirtyChanged = this.onDirtyChangedEmitter.event;
    /** Saveable: content changes coincide with dirty changes here. */
    readonly onContentChanged = this.onDirtyChangedEmitter.event;

    constructor(
        uri: URI,
        initialContent: string,
        fileService: FileService,
        propertyState?: LdPropertyState,
    ) {
        super();
        this.uri = uri;
        this.fileService = fileService;
        this.propertyState = propertyState;
        this.handler = new LdOperationHandler();

        const initial = parseInitialGraph(initialContent);
        this.state = new LdGModelState(initial.graph);

        this.id = LdEditorWidget.createId(uri);
        this.title.label = uri.path.base + (initial.loadError ? ' (load error)' : '');
        this.title.caption = uri.path.toString();
        this.title.closable = true;
        this.title.iconClass = 'codicon type-hierarchy-sub';
        this.addClass('audesys-ld-editor-widget');
    }

    get dirty(): boolean {
        return this.state.dirty;
    }

    getResourceUri(): URI {
        return this.uri;
    }

    createMoveToUri(uri: URI): URI {
        return uri;
    }

    async save(): Promise<void> {
        const json = toJSON(this.state.graph);
        await this.fileService.writeFile(this.uri, BinaryBuffer.fromString(json));
        this.state.markClean();
        this.onDirtyChangedEmitter.fire();
        this.update();
    }

    /** Imperative undo/redo entry points (e.g. for future keybindings). */
    undo(): void {
        this.controllerRef.current?.undo();
        this.update();
    }

    redo(): void {
        this.controllerRef.current?.redo();
        this.update();
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        // ReactWidget created via `new` never fires @postConstruct —
        // trigger the initial React render explicitly (pitfalls.md pattern).
        this.update();
    }

    protected render(): React.ReactNode {
        return React.createElement(LdCanvas, {
            state: this.state,
            handler: this.handler,
            propertyState: this.propertyState,
            controllerRef: this.controllerRef,
            onDirtyChange: (): void => {
                this.onDirtyChangedEmitter.fire();
                this.update();
            },
        });
    }
}
