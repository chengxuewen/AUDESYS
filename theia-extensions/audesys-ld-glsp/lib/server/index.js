"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdGModelState = exports.LdOperationHandler = void 0;
/**
 * LD GLSP Server — barrel export.
 *
 * Exports the operation handler, GModel state manager, and shared types
 * for use by the diagram module and GLSP integration layer.
 */
var ld_operation_handler_1 = require("./ld-operation-handler");
Object.defineProperty(exports, "LdOperationHandler", { enumerable: true, get: function () { return ld_operation_handler_1.LdOperationHandler; } });
var ld_gmodel_state_1 = require("./ld-gmodel-state");
Object.defineProperty(exports, "LdGModelState", { enumerable: true, get: function () { return ld_gmodel_state_1.LdGModelState; } });
//# sourceMappingURL=index.js.map