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
exports.ScopeViewContribution = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const scope_panel_widget_1 = require("./scope-panel-widget");
/**
 * Registers the Scope View panel in the bottom panel area.
 *
 * Uses Theia's view contribution pattern. The widget opens in the
 * bottom panel at rank 500 and auto-opens on application start.
 */
let ScopeViewContribution = class ScopeViewContribution extends browser_1.AbstractViewContribution {
    constructor() {
        super({
            widgetId: scope_panel_widget_1.ScopeViewWidget.ID,
            widgetName: scope_panel_widget_1.ScopeViewWidget.LABEL,
            defaultWidgetOptions: {
                area: 'bottom',
                rank: 500,
            },
        });
        /** WidgetFactory.id — required by the WidgetFactory interface. */
        this.id = scope_panel_widget_1.ScopeViewWidget.ID;
    }
    /** Create a new widget instance. */
    createWidget() {
        return new scope_panel_widget_1.ScopeViewWidget();
    }
    /** Auto-open the widget on application start. */
    async onStart(_app) {
        this.openView({ reveal: true });
    }
};
exports.ScopeViewContribution = ScopeViewContribution;
exports.ScopeViewContribution = ScopeViewContribution = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], ScopeViewContribution);
//# sourceMappingURL=scope-view-contribution.js.map