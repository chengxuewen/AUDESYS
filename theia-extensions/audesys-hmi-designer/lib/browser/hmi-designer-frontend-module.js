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
exports.OPEN_HMI_DESIGNER = void 0;
/**
 * Theia Frontend Module for the HMI Designer extension.
 *
 * Registers the HMI Designer as a Theia widget via ReactWidget.
 * ponytail: single command + widget factory for the tool.
 */
const inversify_1 = require("@theia/core/shared/inversify");
const core_1 = require("@theia/core");
const browser_1 = require("@theia/core/lib/browser");
const inversify_2 = require("@theia/core/shared/inversify");
const hmi_designer_widget_1 = require("./hmi-designer/hmi-designer-widget");
// ponytail: CSS injected via style tag in widget onAfterAttach (avoids esbuild .css resolution)
exports.OPEN_HMI_DESIGNER = {
    id: "audesys-hmi:open-designer",
    label: "HMI Designer",
};
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(core_1.CommandContribution).to(HmiDesignerCommandContribution);
    bind(browser_1.WidgetFactory).toDynamicValue(ctx => ({
        id: "hmi-designer",
        createWidget: () => ctx.container.get(hmi_designer_widget_1.HmiDesignerWidget),
    }));
    bind(hmi_designer_widget_1.HmiDesignerWidget).toSelf();
});
let HmiDesignerCommandContribution = class HmiDesignerCommandContribution {
    registerCommands(registry) {
        registry.registerCommand(exports.OPEN_HMI_DESIGNER, {
            execute: () => {
                if (!this.widget.isAttached) {
                    this.shell.addWidget(this.widget, { area: 'main' });
                }
                this.shell.activateWidget(this.widget.id);
            },
        });
    }
};
__decorate([
    (0, inversify_2.inject)(browser_1.ApplicationShell),
    __metadata("design:type", browser_1.ApplicationShell)
], HmiDesignerCommandContribution.prototype, "shell", void 0);
__decorate([
    (0, inversify_2.inject)(hmi_designer_widget_1.HmiDesignerWidget),
    __metadata("design:type", hmi_designer_widget_1.HmiDesignerWidget)
], HmiDesignerCommandContribution.prototype, "widget", void 0);
HmiDesignerCommandContribution = __decorate([
    (0, inversify_2.injectable)()
], HmiDesignerCommandContribution);
//# sourceMappingURL=hmi-designer-frontend-module.js.map