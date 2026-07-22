"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudioHmiSignal = void 0;
/**
 * Re-export: useTheiaHmiSignal as useStudioHmiSignal so existing widget
 * components can import with their original import path pattern.
 *
 * ponytail: single re-export file avoids changing 7 widget import lines.
 */
var useTheiaHmiSignal_1 = require("./useTheiaHmiSignal");
Object.defineProperty(exports, "useStudioHmiSignal", { enumerable: true, get: function () { return useTheiaHmiSignal_1.useTheiaHmiSignal; } });
//# sourceMappingURL=useStudioHmiSignal.js.map