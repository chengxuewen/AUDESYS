/**
 * FbdEditorWidget — Theia ReactWidget hosting the React Flow FBD canvas.
 *
 * D110: FbdOperationHandler + FbdGModelState run in frontend memory —
 * the widget only touches Theia for file load/save (FileService) and
 * Saveable dirty tracking.
 *
 * Created directly via `new` by FbdEditorOpenHandler (D104 pattern),
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

import { FbdGraph, createFbdGraph } from '../model/model';
import { fromJSON, toJSON } from '../model/serialization';
import { FbdOperationHandler } from '../backend/fbd-operation-handler';
import { FbdGModelState } from '../backend/fbd-gmodel-state';
import { FbdCanvas, FbdCanvasController } from '../components/FbdCanvas';

/**
 * Parse the initial file content into an FbdGraph.
 * Empty or invalid content falls back to a fresh empty graph.
 */
function parseInitialGraph(content: string): { graph: FbdGraph; loadError: boolean } {
    if (content.trim().length > 0) {
        try {
            return { graph: fromJSON(content), loadError: false };
        } catch {
            // Fall through: opening a fresh graph keeps the editor usable;
            // the title is suffixed below so the user notices the fallback.
        }
    }
    return { graph: createFbdGraph(), loadError: content.trim().length > 0 };
}

export class FbdEditorWidget extends ReactWidget implements Saveable, NavigatableWidget {

    static createId(uri: URI): string {
        return `audesys-fbd-editor:${uri.toString()}`;
    }

    readonly uri: URI;

    private readonly state: FbdGModelState;
    private readonly handler: FbdOperationHandler;
    private readonly fileService: FileService;
    private readonly controllerRef: React.MutableRefObject<FbdCanvasController | null> = { current: null };
    private readonly onDirtyChangedEmitter = new Emitter<void>();

    readonly onDirtyChanged = this.onDirtyChangedEmitter.event;
    /** Saveable: content changes coincide with dirty changes here. */
    readonly onContentChanged = this.onDirtyChangedEmitter.event;

    constructor(
        uri: URI,
        initialContent: string,
        fileService: FileService,
    ) {
        super();
        this.uri = uri;
        this.fileService = fileService;
        this.handler = new FbdOperationHandler();

        const initial = parseInitialGraph(initialContent);
        this.state = new FbdGModelState(initial.graph);

        this.id = FbdEditorWidget.createId(uri);
        this.title.label = uri.path.base + (initial.loadError ? ' (load error)' : '');
        this.title.caption = uri.path.toString();
        this.title.closable = true;
        this.title.iconClass = 'codicon symbol-misc';
        this.addClass('audesys-fbd-editor-widget');
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

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        // ReactWidget created via `new` never fires @postConstruct —
        // trigger the initial React render explicitly (pitfalls.md pattern).
        this.update();
    }

    protected render(): React.ReactNode {
        return React.createElement(FbdCanvas, {
            state: this.state,
            handler: this.handler,
            controllerRef: this.controllerRef,
            onDirtyChange: (): void => {
                this.onDirtyChangedEmitter.fire();
                this.update();
            },
        });
    }
}
