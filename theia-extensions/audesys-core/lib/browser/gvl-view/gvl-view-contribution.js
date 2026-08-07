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
exports.GvlViewContribution = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const gvl_view_widget_1 = require("./gvl-view-widget");
/**
 * Registers the GVL Variables panel in the left sidebar.
 *
 * Follows the same AbstractViewContribution + WidgetFactory pattern as the
 * POU tree / Signal Browser. Opens into the left panel just above the POU
 * tree and auto-opens on application start.
 */
let GvlViewContribution = class GvlViewContribution extends browser_1.AbstractViewContribution {
    constructor() {
        super({
            widgetId: gvl_view_widget_1.GvlViewWidget.ID,
            widgetName: gvl_view_widget_1.GvlViewWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 240,
            },
        });
        this.id = gvl_view_widget_1.GvlViewWidget.ID;
    }
    createWidget() {
        return new gvl_view_widget_1.GvlViewWidget();
    }
    async onStart(_app) {
        // ponytail: shell may not be ready during early init; catch prevents crash
        try {
            this.openView({ reveal: true });
        }
        catch {
            /* widget will open when user clicks GVL Variables in sidebar */
        }
    }
};
exports.GvlViewContribution = GvlViewContribution;
exports.GvlViewContribution = GvlViewContribution = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], GvlViewContribution);
//# sourceMappingURL=gvl-view-contribution.js.map