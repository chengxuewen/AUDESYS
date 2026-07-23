"use strict";
/**
 * FBD Editor — barrel export.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FBD_EDITOR_COMMANDS = exports.FbdEditorCommandContribution = exports.FbdEditorOpenHandler = exports.FbdEditorWidget = void 0;
var fbd_editor_widget_1 = require("./fbd-editor-widget");
Object.defineProperty(exports, "FbdEditorWidget", { enumerable: true, get: function () { return fbd_editor_widget_1.FbdEditorWidget; } });
var fbd_editor_contribution_1 = require("./fbd-editor-contribution");
Object.defineProperty(exports, "FbdEditorOpenHandler", { enumerable: true, get: function () { return fbd_editor_contribution_1.FbdEditorOpenHandler; } });
Object.defineProperty(exports, "FbdEditorCommandContribution", { enumerable: true, get: function () { return fbd_editor_contribution_1.FbdEditorCommandContribution; } });
Object.defineProperty(exports, "FBD_EDITOR_COMMANDS", { enumerable: true, get: function () { return fbd_editor_contribution_1.FBD_EDITOR_COMMANDS; } });
//# sourceMappingURL=index.js.map