"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IecContextMenuContribution = exports.IecContextMenuCommands = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const selection_service_1 = require("@theia/core/lib/common/selection-service");
const selection_1 = require("@theia/core/lib/common/selection");
const message_service_1 = require("@theia/core/lib/common/message-service");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const inversify_2 = require("@theia/core/shared/inversify");
var IecContextMenuCommands;
(function (IecContextMenuCommands) {
    IecContextMenuCommands.CATEGORY = 'AUDESYS';
    IecContextMenuCommands.COMPILE = {
        id: 'audesys.compile',
        label: 'Compile',
        category: IecContextMenuCommands.CATEGORY,
    };
    IecContextMenuCommands.DEPLOY = {
        id: 'audesys.deploy',
        label: 'Deploy to Controller',
        category: IecContextMenuCommands.CATEGORY,
    };
    IecContextMenuCommands.VALIDATE = {
        id: 'audesys.validate',
        label: 'Validate IEC Program',
        category: IecContextMenuCommands.CATEGORY,
    };
})(IecContextMenuCommands || (exports.IecContextMenuCommands = IecContextMenuCommands = {}));
const IEC_EXTS = new Set(['.st', '.il', '.ld', '.fbd', '.sfc', '.gcode', '.nc', '.gco', '.hmi']);
/**
 * IEC Context Menu Contribution.
 * Adds Compile, Deploy, and Validate actions to the right-click context menu
 * in Theia's File Explorer (navigator) for IEC 61131-3, CNC, and HMI files.
 * Compile is wired to the napi-rs bridge; Deploy/Validate are P1 stubs.
 */
let IecContextMenuContribution = class IecContextMenuContribution {
    registerCommands(registry) {
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
    registerMenus(menus) {
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
    isIecFileSelected() {
        const selection = this.selectionService.selection;
        const uri = selection_1.UriSelection.getUri(selection);
        if (!uri)
            return false;
        const name = uri.displayName.toLowerCase();
        return IEC_EXTS.has(this.resolveExt(name));
    }
    getSelectedUri() {
        const selection = this.selectionService.selection;
        return selection_1.UriSelection.getUri(selection);
    }
    resolveExt(name) {
        const lower = name.toLowerCase();
        for (const ext of IEC_EXTS) {
            if (lower.endsWith(ext))
                return ext;
        }
        return '';
    }
    // ── Compile ────────────────────────────────────────────────
    async onCompile() {
        const uri = this.getSelectedUri();
        if (!uri)
            return;
        const ext = this.resolveExt(uri.displayName.toLowerCase());
        if (!ext)
            return;
        // Read file content
        let source;
        try {
            const content = await this.fileService.read(uri);
            source = content.value;
            if (!source || source.trim().length === 0) {
                this.messageService.warn(`File is empty: ${uri.displayName}`);
                return;
            }
        }
        catch (err) {
            this.messageService.error(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
            return;
        }
        // Determine compile function from extension
        const compileFn = this.getCompileFn(ext);
        if (!compileFn) {
            this.messageService.warn(`Compile not supported for ${ext} files`);
            return;
        }
        // Compile via napi-rs bridge
        let raw;
        try {
            const bridge = require('@audesys/theia-bridge');
            raw = compileFn(bridge, source);
        }
        catch (err) {
            this.messageService.error(`Compile bridge error: ${err instanceof Error ? err.message : String(err)}`);
            return;
        }
        // Parse and report
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                // Error array
                const lines = parsed.map((d, i) => `[${d.severity || 'error'}] ${d.message || `Error ${i + 1}`}`).join('\n');
                this.messageService.error(`Compilation failed for ${uri.displayName}:\n\n${lines}`);
            }
            else if (typeof parsed === 'object' && parsed !== null && 'instructions' in parsed) {
                // Success — HalProgram with instruction count
                const instCount = Array.isArray(parsed.instructions) ? parsed.instructions.length : '?';
                this.messageService.info(`Compilation successful — ${uri.displayName}\n` +
                    `Instructions: ${instCount}`);
            }
            else {
                this.messageService.error(`Unexpected compile output for ${uri.displayName}`);
            }
        }
        catch {
            // Raw string fallback
            if (raw.length < 200) {
                this.messageService.error(`Compile error: ${raw}`);
            }
            else {
                this.messageService.info(`Compilation successful — ${uri.displayName}\n` +
                    `Output: ${raw.length} bytes`);
            }
        }
    }
    // ── Deploy ───────────────────────────────────────────────
    async onDeploy() {
        const uri = this.getSelectedUri();
        if (!uri)
            return;
        const ext = this.resolveExt(uri.displayName.toLowerCase());
        if (!ext)
            return;
        // Read file content
        let source;
        try {
            const content = await this.fileService.read(uri);
            source = content.value;
            if (!source || source.trim().length === 0) {
                this.messageService.warn(`File is empty: ${uri.displayName}`);
                return;
            }
        }
        catch (err) {
            this.messageService.error(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
            return;
        }
        // Compile
        const compileFn = this.getCompileFn(ext);
        if (!compileFn) {
            this.messageService.warn(`Deploy not supported for ${ext} files`);
            return;
        }
        let programJson;
        try {
            const bridge = require('@audesys/theia-bridge');
            programJson = compileFn(bridge, source);
            // Validate it parses as JSON (compile errors surface as JSON arrays)
            const parsed = JSON.parse(programJson);
            if (Array.isArray(parsed)) {
                const lines = parsed.map((d, i) => `[${d.severity || 'error'}] ${d.message || `Error ${i + 1}`}`).join('\n');
                this.messageService.error(`Compilation failed for ${uri.displayName}:\n\n${lines}`);
                return;
            }
        }
        catch (err) {
            this.messageService.error(`Compilation failed for ${uri.displayName}: ${err instanceof Error ? err.message : String(err)}`);
            return;
        }
        // Deploy to Controller
        const socketPath = this.getSocketPath();
        const secret = this.getSecret();
        try {
            const bridge = require('@audesys/theia-bridge');
            bridge.deployProgram(socketPath, secret, programJson);
            this.messageService.info(`Deployed ${uri.displayName} to Controller at ${socketPath}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('ECONNREFUSED') || msg.includes('ENOENT')) {
                this.messageService.error(`Deploy failed: No Controller running at ${socketPath}. Start the Controller first.`);
            }
            else {
                this.messageService.error(`Deploy failed: ${msg}`);
            }
        }
    }
    // ── Validate (P1 stub) ───────────────────────────────────
    onValidate() {
        this.messageService.info(`[P1] Validate: ${selection_1.UriSelection.getUri(this.selectionService.selection)?.displayName ?? 'unknown'} — validator TBD`);
    }
    // ── Helpers ───────────────────────────────────────────────
    /** Map extension to bridge compile function. Returns null for unsupported types. */
    getCompileFn(ext) {
        switch (ext) {
            case '.st': return (b, s) => b.compileSt(s);
            case '.il': return (b, s) => b.compileIl(s);
            case '.ld': return (b, s) => b.compileLd(s);
            case '.fbd': return (b, s) => b.compileFbd(s);
            case '.sfc': return (b, s) => b.compileSfc(s);
            case '.gcode':
            case '.nc':
            case '.gco': return (b, s) => b.compileGcode(s);
            // .hmi — no compiler, handled by HMI Designer
            default: return null;
        }
    }
    // ── Config helpers ───────────────────────────────────────
    getSocketPath() {
        // ponytail: env var or well-known default, add project-level config in P2
        return process.env.AUDESYS_SOCKET ?? '/tmp/audesys-controller.sock';
    }
    getSecret() {
        // ponytail: env var or local-dev default, add secure keychain in P2
        return process.env.AUDESYS_HMAC_SECRET ?? 'audesys-dev-secret';
    }
};
exports.IecContextMenuContribution = IecContextMenuContribution;
__decorate([
    (0, inversify_2.inject)(selection_service_1.SelectionService),
    __metadata("design:type", selection_service_1.SelectionService)
], IecContextMenuContribution.prototype, "selectionService", void 0);
__decorate([
    (0, inversify_2.inject)(message_service_1.MessageService),
    __metadata("design:type", message_service_1.MessageService)
], IecContextMenuContribution.prototype, "messageService", void 0);
__decorate([
    (0, inversify_2.inject)(file_service_1.FileService),
    __metadata("design:type", file_service_1.FileService)
], IecContextMenuContribution.prototype, "fileService", void 0);
exports.IecContextMenuContribution = IecContextMenuContribution = __decorate([
    (0, inversify_1.injectable)()
], IecContextMenuContribution);
//# sourceMappingURL=iec-context-menu.js.map