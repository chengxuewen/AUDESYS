/**
 * RBAC middleware for napi-rs calls.
 *
 * Matches STH-012: 6 roles with hierarchical permissions.
 * Engineer/Admin = all, Operator/HMI = read only, Viewer/Auditor = read only.
 *
 * Roles align with IPC server roles (D64: Role::HMI panel button writing
 * with restricted signals is a separate path not enforced here).
 */
export declare enum Role {
    Engineer = "Engineer",
    Operator = "Operator",
    HMI = "HMI",
    Viewer = "Viewer",
    Auditor = "Auditor",
    Admin = "Admin"
}
export declare class RbacError extends Error {
    constructor(role: Role, method: string);
}
/**
 * Returns true if the role is authorized to call the method.
 * Throws RbacError if unauthorized.
 */
export declare function checkRbac(role: string, method: string): void;
//# sourceMappingURL=rbac-middleware.d.ts.map