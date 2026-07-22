"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var HmiDesignerWidget_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HmiDesignerWidget = void 0;
/**
 * HmiDesignerWidget — Theia ReactWidget wrapping HmiDesignerTool.
 *
 * ponytail: thin wrapper around HmiDesignerTool to integrate with Theia dock panel.
 */
const React = __importStar(require("react"));
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const inversify_1 = require("@theia/core/shared/inversify");
const hmi_designer_tool_1 = __importDefault(require("./hmi-designer-tool"));
let HmiDesignerWidget = HmiDesignerWidget_1 = class HmiDesignerWidget extends react_widget_1.ReactWidget {
    constructor() {
        super();
        this.id = HmiDesignerWidget_1.ID;
        this.title.label = "HMI Designer";
        this.title.closable = true;
        this.addClass("hmiapp-widget");
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        // ponytail: inject critical CSS (C3 z-index fix, C4 containment)
        const styleId = "audesys-hmi-critical-css";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
        .hmiapp-canvas .react-resizable-handle { z-index: 2147483647 !important; }
        .hmiapp-canvas { contain: layout style; overscroll-behavior: contain; }
      `;
            document.head.appendChild(style);
        }
    }
    init() {
        this.update();
    }
    render() {
        return React.createElement(hmi_designer_tool_1.default, {
            onSaveYaml: (yaml) => this.handleSave(yaml),
            onLoadYaml: () => this.handleLoad(),
            onDeploy: (yaml) => this.handleDeploy(yaml),
        });
    }
    handleSave(_yaml) {
        // ponytail: save via file dialog or service — stub for now
        return Promise.resolve();
    }
    handleLoad() {
        // ponytail: load via file dialog — stub for now
        return Promise.resolve(null);
    }
    handleDeploy(_yaml) {
        // ponytail: deploy via IPC/napi-rs — stub for now
        return Promise.resolve();
    }
};
exports.HmiDesignerWidget = HmiDesignerWidget;
HmiDesignerWidget.ID = "hmi-designer";
__decorate([
    (0, inversify_1.postConstruct)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HmiDesignerWidget.prototype, "init", null);
exports.HmiDesignerWidget = HmiDesignerWidget = HmiDesignerWidget_1 = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], HmiDesignerWidget);
//# sourceMappingURL=hmi-designer-widget.js.map