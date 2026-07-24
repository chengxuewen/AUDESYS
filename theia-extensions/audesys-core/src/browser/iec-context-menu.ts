import { injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import URI from '@theia/core/lib/common/uri';
import { UriSelection } from '@theia/core/lib/common/selection';
import { MessageService } from '@theia/core/lib/common/message-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { inject } from '@theia/core/shared/inversify';

export namespace IecContextMenuCommands {
    export const CATEGORY = 'AUDESYS';

    export const COMPILE: Command = {
        id: 'audesys.compile',
        label: 'Compile',
        category: CATEGORY,
    };
    export const DEPLOY: Command = {
        id: 'audesys.deploy',
        label: 'Deploy to Controller',
        category: CATEGORY,
    };
    export const VALIDATE: Command = {
        id: 'audesys.validate',
        label: 'Validate IEC Program',
        category: CATEGORY,
    };
}

const IEC_EXTS = new Set(['.st', '.il', '.ld', '.fbd', '.sfc', '.gcode', '.nc', '.gco', '.hmi']);

/**
 * IEC Context Menu Contribution.
 * Adds Compile, Deploy, and Validate actions to the right-click context menu
 * in Theia's File Explorer (navigator) for IEC 61131-3, CNC, and HMI files.
 * Compile is wired to the napi-rs bridge; Deploy/Validate are P1 stubs.
 */
@injectable()
export class IecContextMenuContribution implements CommandContribution, MenuContribution {
    @inject(SelectionService) protected readonly selectionService!: SelectionService;
    @inject(MessageService) protected readonly messageService!: MessageService;
    @inject(FileService) protected readonly fileService!: FileService;
    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(IecContextMenuCommands.COMPILE, {
            execute: () => this.onCompile(),
            isVisible: () => this.isIecFileSelected(),
        });
        registry.registerCommand(IecContextMenuCommands.DEPLOY, {
            execute: () => this.onDeploy(),
            isVisible: () => this.isIecFileSelected(),
        });
        registry.registerCommand(IecContextMenuCommands.VALIDATE, {
            execute: () => this.onValidate(),
            isVisible: () => this.isIecFileSelected(),
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        // Register in the navigator context menu (File Explorer right-click)
        menus.registerMenuAction(['navigator-context-menu', 'audesys-group'], {
            commandId: IecContextMenuCommands.COMPILE.id,
            label: 'Compile',
            order: '1',
        });
        menus.registerMenuAction(['navigator-context-menu', 'audesys-group'], {
            commandId: IecContextMenuCommands.DEPLOY.id,
            label: 'Deploy to Controller',
            order: '2',
        });
        menus.registerMenuAction(['navigator-context-menu', 'audesys-group'], {
            commandId: IecContextMenuCommands.VALIDATE.id,
            label: 'Validate IEC Program',
            order: '0',
        });
    }

    private isIecFileSelected(): boolean {
        const selection = this.selectionService.selection;
        const uri = UriSelection.getUri(selection);
        if (!uri) return false;
        const name = uri.displayName.toLowerCase();
        return IEC_EXTS.has(this.resolveExt(name));
    }

    private getSelectedUri(): URI | undefined {
        const selection = this.selectionService.selection;
        return UriSelection.getUri(selection);
    }


    private resolveExt(name: string): string {
        const lower = name.toLowerCase();
        for (const ext of IEC_EXTS) {
            if (lower.endsWith(ext)) return ext;
        }
        return '';
    }

    // ── Compile ────────────────────────────────────────────────

    private async onCompile(): Promise<void> {
        const uri = this.getSelectedUri();
        if (!uri) return;

        const ext = this.resolveExt(uri.displayName.toLowerCase());
        if (!ext) return;

        // Read file content
        let source: string;
        try {
            const content = await this.fileService.read(uri);
            source = content.value;
            if (!source || source.trim().length === 0) {
                this.messageService.warn(`File is empty: ${uri.displayName}`);
                return;
            }
        } catch (err) {
            this.messageService.error(
                `Failed to read file: ${err instanceof Error ? err.message : String(err)}`
            );
            return;
        }

        // Determine compile function from extension
        const compileFn = this.getCompileFn(ext);
        if (!compileFn) {
            this.messageService.warn(`Compile not supported for ${ext} files`);
            return;
        }

        // Compile via napi-rs bridge
        let raw: string;
        try {
            const bridge = require('@audesys/theia-bridge');
            raw = compileFn(bridge, source);
        } catch (err) {
            this.messageService.error(
                `Compile bridge error: ${err instanceof Error ? err.message : String(err)}`
            );
            return;
        }

        // Parse and report
        try {
            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
                // Error array
                const lines = parsed.map(
                    (d: Record<string, unknown>, i: number) =>
                        `[${d.severity || 'error'}] ${d.message || `Error ${i + 1}`}`
                ).join('\n');
                this.messageService.error(
                    `Compilation failed for ${uri.displayName}:\n\n${lines}`
                );
            } else if (typeof parsed === 'object' && parsed !== null && 'instructions' in parsed) {
                // Success — HalProgram with instruction count
                const instCount = Array.isArray(parsed.instructions) ? parsed.instructions.length : '?';
                this.messageService.info(
                    `Compilation successful — ${uri.displayName}\n` +
                    `Instructions: ${instCount}`
                );
            } else {
                this.messageService.error(`Unexpected compile output for ${uri.displayName}`);
            }
        } catch {
            // Raw string fallback
            if (raw.length < 200) {
                this.messageService.error(`Compile error: ${raw}`);
            } else {
                this.messageService.info(
                    `Compilation successful — ${uri.displayName}\n` +
                    `Output: ${raw.length} bytes`
                );
            }
        }
    }

    // ── Deploy ───────────────────────────────────────────────

    private async onDeploy(): Promise<void> {
        const uri = this.getSelectedUri();
        if (!uri) return;

        const ext = this.resolveExt(uri.displayName.toLowerCase());
        if (!ext) return;

        // Read file content
        let source: string;
        try {
            const content = await this.fileService.read(uri);
            source = content.value;
            if (!source || source.trim().length === 0) {
                this.messageService.warn(`File is empty: ${uri.displayName}`);
                return;
            }
        } catch (err) {
            this.messageService.error(
                `Failed to read file: ${err instanceof Error ? err.message : String(err)}`
            );
            return;
        }

        // Compile
        const compileFn = this.getCompileFn(ext);
        if (!compileFn) {
            this.messageService.warn(`Deploy not supported for ${ext} files`);
            return;
        }

        let programJson: string;
        try {
            const bridge = require('@audesys/theia-bridge');
            programJson = compileFn(bridge, source);
            // Validate it parses as JSON (compile errors surface as JSON arrays)
            const parsed = JSON.parse(programJson);
            if (Array.isArray(parsed)) {
                const lines = parsed.map(
                    (d: Record<string, unknown>, i: number) =>
                        `[${d.severity || 'error'}] ${d.message || `Error ${i + 1}`}`
                ).join('\n');
                this.messageService.error(
                    `Compilation failed for ${uri.displayName}:\n\n${lines}`
                );
                return;
            }
        } catch (err) {
            this.messageService.error(
                `Compilation failed for ${uri.displayName}: ${err instanceof Error ? err.message : String(err)}`
            );
            return;
        }

        // Deploy to Controller
        const socketPath = this.getSocketPath();
        const secret = this.getSecret();
        try {
            const bridge = require('@audesys/theia-bridge');
            bridge.deployProgram(socketPath, secret, programJson);
            this.messageService.info(
                `Deployed ${uri.displayName} to Controller at ${socketPath}`
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('ECONNREFUSED') || msg.includes('ENOENT')) {
                this.messageService.error(
                    `Deploy failed: No Controller running at ${socketPath}. Start the Controller first.`
                );
            } else {
                this.messageService.error(`Deploy failed: ${msg}`);
            }
        }
    }
    // ── Validate (P1 stub) ───────────────────────────────────

    private onValidate(): void {
        this.messageService.info(`[P1] Validate: ${UriSelection.getUri(this.selectionService.selection)?.displayName ?? 'unknown'} — validator TBD`);
    }

    // ── Helpers ───────────────────────────────────────────────

    /** Map extension to bridge compile function. Returns null for unsupported types. */
    private getCompileFn(ext: string): ((bridge: Record<string, Function>, source: string) => string) | null {
        switch (ext) {
            case '.st':   return (b, s) => b.compileSt(s);
            case '.il':   return (b, s) => b.compileIl(s);
            case '.ld':   return (b, s) => b.compileLd(s);
            case '.fbd':  return (b, s) => b.compileFbd(s);
            case '.sfc':  return (b, s) => b.compileSfc(s);
            case '.gcode': case '.nc': case '.gco': return (b, s) => b.compileGcode(s);
            // .hmi — no compiler, handled by HMI Designer
            default:      return null;
        }
}

    // ── Config helpers ───────────────────────────────────────

    private getSocketPath(): string {
        // ponytail: env var or well-known default, add project-level config in P2
        return process.env.AUDESYS_SOCKET ?? '/tmp/audesys-controller.sock';
    }

    private getSecret(): string {
        // ponytail: env var or local-dev default, add secure keychain in P2
        return process.env.AUDESYS_HMAC_SECRET ?? 'audesys-dev-secret';
    }
}
