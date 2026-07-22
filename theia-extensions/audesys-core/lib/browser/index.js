"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeCanvas = exports.TimeSeriesBuffer = exports.ScopeViewContribution = exports.ScopeViewWidget = exports.SignalTreeModel = exports.SignalBrowserContribution = exports.SignalBrowserWidget = void 0;
const audesys_core_frontend_module_1 = __importDefault(require("./audesys-core-frontend-module"));
exports.default = audesys_core_frontend_module_1.default;
var signal_browser_widget_1 = require("./signal-browser/signal-browser-widget");
Object.defineProperty(exports, "SignalBrowserWidget", { enumerable: true, get: function () { return signal_browser_widget_1.SignalBrowserWidget; } });
var signal_browser_contribution_1 = require("./signal-browser/signal-browser-contribution");
Object.defineProperty(exports, "SignalBrowserContribution", { enumerable: true, get: function () { return signal_browser_contribution_1.SignalBrowserContribution; } });
var signal_tree_model_1 = require("./signal-browser/signal-tree-model");
Object.defineProperty(exports, "SignalTreeModel", { enumerable: true, get: function () { return signal_tree_model_1.SignalTreeModel; } });
var scope_panel_widget_1 = require("./scope-view/scope-panel-widget");
Object.defineProperty(exports, "ScopeViewWidget", { enumerable: true, get: function () { return scope_panel_widget_1.ScopeViewWidget; } });
var scope_view_contribution_1 = require("./scope-view/scope-view-contribution");
Object.defineProperty(exports, "ScopeViewContribution", { enumerable: true, get: function () { return scope_view_contribution_1.ScopeViewContribution; } });
var time_series_buffer_1 = require("./scope-view/time-series-buffer");
Object.defineProperty(exports, "TimeSeriesBuffer", { enumerable: true, get: function () { return time_series_buffer_1.TimeSeriesBuffer; } });
var scope_canvas_1 = require("./scope-view/scope-canvas");
Object.defineProperty(exports, "ScopeCanvas", { enumerable: true, get: function () { return scope_canvas_1.ScopeCanvas; } });
//# sourceMappingURL=index.js.map