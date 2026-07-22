"use strict";
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
class HmiDesignerCommandContribution {
    registerCommands(registry) {
        registry.registerCommand(exports.OPEN_HMI_DESIGNER, {
            execute: () => { },
        });
    }
}
//# sourceMappingURL=hmi-designer-frontend-module.js.map