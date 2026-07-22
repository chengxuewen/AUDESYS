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
exports.SignalBrowserContribution = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const signal_browser_widget_1 = require("./signal-browser-widget");
/**
 * Registers the Signal Browser panel in the left sidebar.
 *
 * Uses Theia's view contribution pattern — implements WidgetFactory
 * so the widget can be opened/restored. Opens into the left panel
 * at rank 300, and auto-opens on application start.
 */
let SignalBrowserContribution = class SignalBrowserContribution extends browser_1.AbstractViewContribution {
    constructor() {
        super({
            widgetId: signal_browser_widget_1.SignalBrowserWidget.ID,
            widgetName: signal_browser_widget_1.SignalBrowserWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 300,
            },
        });
        /** WidgetFactory.id — required by the WidgetFactory interface. */
        this.id = signal_browser_widget_1.SignalBrowserWidget.ID;
    }
    /**
     * Create a new widget instance. Called by Theia's widget manager
     * when the view is opened or restored from layout persistence.
     */
    createWidget() {
        return new signal_browser_widget_1.SignalBrowserWidget();
    }
    /**
     * Open the widget on application start so it's always visible.
     */
    async onStart(_app) {
        this.openView({ reveal: true });
    }
};
exports.SignalBrowserContribution = SignalBrowserContribution;
exports.SignalBrowserContribution = SignalBrowserContribution = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], SignalBrowserContribution);
//# sourceMappingURL=signal-browser-contribution.js.map