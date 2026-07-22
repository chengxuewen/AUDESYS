"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLayout = exports.useHmiLayout = exports.PropertyPanel = exports.WidgetPalette = exports.HmiDesignerTool = exports.HmiCanvasWidget = void 0;
/**
 * hmi-designer/index.ts — Re-exports for the hmi-designer module.
 */
var hmi_canvas_widget_1 = require("./hmi-canvas-widget");
Object.defineProperty(exports, "HmiCanvasWidget", { enumerable: true, get: function () { return hmi_canvas_widget_1.HmiCanvasWidget; } });
var hmi_designer_tool_1 = require("./hmi-designer-tool");
Object.defineProperty(exports, "HmiDesignerTool", { enumerable: true, get: function () { return __importDefault(hmi_designer_tool_1).default; } });
var widget_palette_1 = require("./widget-palette");
Object.defineProperty(exports, "WidgetPalette", { enumerable: true, get: function () { return __importDefault(widget_palette_1).default; } });
var property_panel_1 = require("./property-panel");
Object.defineProperty(exports, "PropertyPanel", { enumerable: true, get: function () { return __importDefault(property_panel_1).default; } });
var useHmiLayout_1 = require("../hooks/useHmiLayout");
Object.defineProperty(exports, "useHmiLayout", { enumerable: true, get: function () { return useHmiLayout_1.useHmiLayout; } });
var useHmiLayoutValidator_1 = require("../hooks/useHmiLayoutValidator");
Object.defineProperty(exports, "validateLayout", { enumerable: true, get: function () { return useHmiLayoutValidator_1.validateLayout; } });
//# sourceMappingURL=index.js.map