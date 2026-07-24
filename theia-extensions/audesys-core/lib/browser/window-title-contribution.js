"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowTitleContribution = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
/**
 * Forces the browser tab title to always show "AUDESYS Studio"
 * regardless of which workspace folder is open.
 */
let WindowTitleContribution = class WindowTitleContribution {
    async onStart(_app) {
        document.title = 'AUDESYS Studio';
        // Also watch for title changes from Theia and override them
        const observer = new MutationObserver(() => {
            if (document.title !== 'AUDESYS Studio') {
                document.title = 'AUDESYS Studio';
            }
        });
        observer.observe(document.querySelector('title'), {
            childList: true,
            characterData: true,
            subtree: true,
        });
    }
};
exports.WindowTitleContribution = WindowTitleContribution;
exports.WindowTitleContribution = WindowTitleContribution = __decorate([
    (0, inversify_1.injectable)()
], WindowTitleContribution);
//# sourceMappingURL=window-title-contribution.js.map