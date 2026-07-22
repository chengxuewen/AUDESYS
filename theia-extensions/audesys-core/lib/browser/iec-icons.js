"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IecFileIconTheme = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
/**
 * IEC 61131-3 File Icon Theme.
 * Registers a custom icon theme for IEC 61131-3 programming languages,
 * G-code CNC programs, and HMI layout files.
 *
 * The actual icon-to-extension mapping is handled by `IecNavigatorDecorator`
 * (LabelProviderContribution), which resolves codicons per IEC file type.
 * This theme registration makes the theme selectable in Theia's icon theme picker
 * and ensures the IEC-aware label provider is activated.
 */
let IecFileIconTheme = class IecFileIconTheme {
    constructor() {
        this.id = 'audesys-iec-icons';
        this.label = 'AUDESYS IEC 61131-3 Icons';
        this.description = 'Custom icons for IEC 61131-3 (.st/.il/.ld/.fbd/.sfc), CNC (.gcode/.nc/.gco), and HMI (.hmi) files';
        this.hasFileIcons = true;
        this.hasFolderIcons = false;
    }
    registerIconThemes(iconThemes) {
        iconThemes.register(this);
    }
    activate() {
        return { dispose: () => { } };
    }
};
exports.IecFileIconTheme = IecFileIconTheme;
exports.IecFileIconTheme = IecFileIconTheme = __decorate([
    (0, inversify_1.injectable)()
], IecFileIconTheme);
//# sourceMappingURL=iec-icons.js.map