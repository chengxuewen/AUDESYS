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
exports.LocalVarViewContribution = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const local_var_view_widget_1 = require("./local-var-view-widget");
/**
 * Registers the Local Variables panel in the left sidebar.
 *
 * Follows the same AbstractViewContribution + WidgetFactory pattern as the
 * GVL view / POU tree. Opens into the left panel just below the GVL view.
 */
let LocalVarViewContribution = class LocalVarViewContribution extends browser_1.AbstractViewContribution {
    constructor() {
        super({
            widgetId: local_var_view_widget_1.LocalVarViewWidget.ID,
            widgetName: local_var_view_widget_1.LocalVarViewWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 230,
            },
        });
        this.id = local_var_view_widget_1.LocalVarViewWidget.ID;
    }
    createWidget() {
        return new local_var_view_widget_1.LocalVarViewWidget();
    }
    async onStart(_app) {
        // ponytail: shell may not be ready during early init; catch prevents crash
        try {
            this.openView({ reveal: true });
        }
        catch {
            /* widget will open when user clicks Local Variables in sidebar */
        }
    }
};
exports.LocalVarViewContribution = LocalVarViewContribution;
exports.LocalVarViewContribution = LocalVarViewContribution = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], LocalVarViewContribution);
//# sourceMappingURL=local-var-view-contribution.js.map