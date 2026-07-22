"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IecNavigatorDecorator = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
// Extension → resource-type label mapping
const LABEL_MAP = {
    '.st': { suffix: '[Program]', priority: 10 },
    '.il': { suffix: '[Program]', priority: 10 },
    '.ld': { suffix: '[Program]', priority: 10 },
    '.fbd': { suffix: '[Program]', priority: 10 },
    '.sfc': { suffix: '[Program]', priority: 10 },
    '.hmi': { suffix: '[HMI]', priority: 10 },
    '.gcode': { suffix: '[CNC]', priority: 10 },
    '.nc': { suffix: '[CNC]', priority: 10 },
    '.gco': { suffix: '[CNC]', priority: 10 },
};
/**
 * IEC Navigator Decorator.
 * Appends resource-type labels ([Program], [HMI], [CNC]) to file names
 * in Theia's File Explorer, tab headers, and breadcrumbs for instant
 * identification of IEC 61131-3 / CNC / HMI resource types.
 */
let IecNavigatorDecorator = class IecNavigatorDecorator {
    /**
     * Only handle URIs whose file extension maps to a known IEC resource type.
     * Non-IEC files pass through to the default label provider.
     */
    canHandle(uri) {
        const ext = this.resolveExt(uri);
        if (ext && LABEL_MAP[ext]) {
            return LABEL_MAP[ext].priority;
        }
        return 0;
    }
    /**
     * Append the resource-type suffix to the base file name.
     * Example: "main.st" → "main.st [Program]"
     */
    getName(uri) {
        const ext = this.resolveExt(uri);
        const entry = ext ? LABEL_MAP[ext] : undefined;
        if (entry && uri.displayName) {
            return `${uri.displayName} ${entry.suffix}`;
        }
        return uri.displayName;
    }
    /**
     * Return the icon class for IEC/CNC/HMI files based on extension.
     * The label provider fallback chain picks the highest canHandle priority,
     * so our decorator takes precedence over default for these file types.
     */
    getIcon(uri) {
        const ext = this.resolveExt(uri);
        // Map extensions to codicon icon names
        switch (ext) {
            case '.st': return 'symbol-structure';
            case '.il': return 'symbol-enum';
            case '.ld': return 'circuit-board';
            case '.fbd': return 'type-hierarchy';
            case '.sfc': return 'symbol-event';
            case '.gcode':
            case '.nc':
            case '.gco': return 'symbol-numeric';
            case '.hmi': return 'device-desktop';
            default: return '';
        }
    }
    resolveExt(uri) {
        const name = uri.displayName;
        if (!name)
            return undefined;
        const lower = name.toLowerCase();
        // Sort by longest extension first so .gcode matches before .code would
        for (const ext of Object.keys(LABEL_MAP).sort((a, b) => b.length - a.length)) {
            if (lower.endsWith(ext))
                return ext;
        }
        return undefined;
    }
};
exports.IecNavigatorDecorator = IecNavigatorDecorator;
exports.IecNavigatorDecorator = IecNavigatorDecorator = __decorate([
    (0, inversify_1.injectable)()
], IecNavigatorDecorator);
//# sourceMappingURL=iec-navigator-decorator.js.map