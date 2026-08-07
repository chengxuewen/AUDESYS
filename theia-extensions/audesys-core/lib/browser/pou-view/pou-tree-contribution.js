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
exports.PouTreeContribution = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const pou_tree_widget_1 = require("./pou-tree-widget");
/**
 * Registers the POU tree panel in the left sidebar.
 *
 * Uses the same AbstractViewContribution + WidgetFactory pattern as the
 * Signal Browser. Opens into the left panel at rank 250 and auto-opens on
 * application start.
 */
let PouTreeContribution = class PouTreeContribution extends browser_1.AbstractViewContribution {
    constructor() {
        super({
            widgetId: pou_tree_widget_1.PouTreeWidget.ID,
            widgetName: pou_tree_widget_1.PouTreeWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 250,
            },
        });
        this.id = pou_tree_widget_1.PouTreeWidget.ID;
    }
    createWidget() {
        return new pou_tree_widget_1.PouTreeWidget();
    }
    async onStart(_app) {
        // ponytail: shell may not be ready during early init; catch prevents crash
        try {
            this.openView({ reveal: true });
        }
        catch {
            /* widget will open when user clicks POU in sidebar */
        }
    }
};
exports.PouTreeContribution = PouTreeContribution;
exports.PouTreeContribution = PouTreeContribution = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], PouTreeContribution);
//# sourceMappingURL=pou-tree-contribution.js.map