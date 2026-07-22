/**
 * RBAC middleware for napi-rs calls.
 *
 * Matches STH-012: 6 roles with hierarchical permissions.
 * Engineer/Admin = all, Operator/HMI = read only, Viewer/Auditor = read only.
 *
 * Roles align with IPC server roles (D64: Role::HMI panel button writing
 * with restricted signals is a separate path not enforced here).
 */

export enum Role {
    Engineer = 'Engineer',
    Operator = 'Operator',
    HMI = 'HMI',
    Viewer = 'Viewer',
    Auditor = 'Auditor',
    Admin = 'Admin',
}

/** Operations that modify state (compile, deploy, debug mutations, simulation) */
const WRITE_METHODS = new Set([
    'compileFbd',
    'compileGcode',
    'compileIl',
    'compileLd',
    'compileSfc',
    'compileSt',
    'debugAddBreakpoint',
    'debugConnect',
    'debugDisconnect',
    'debugPause',
    'debugRemoveBreakpoint',
    'debugResume',
    'debugStep',
    'deployHmiLayout',
    'deployProgram',
    'loadHalConfig',
    'saveHmiLayout',
    'simCreate',
    'simDestroy',
    'simStep',
]);

/** Roles allowed to execute write operations */
const WRITE_ROLES = new Set<Role>([Role.Engineer, Role.Admin]);

/** Roles allowed to read signals and query state */
const READ_ROLES = new Set<Role>([Role.Engineer, Role.Admin, Role.Operator, Role.HMI, Role.Viewer, Role.Auditor]);

export class RbacError extends Error {
    constructor(role: Role, method: string) {
        super(`RBAC denied: role "${role}" is not authorized to call "${method}"`);
        this.name = 'RbacError';
    }
}

/**
 * Returns true if the role is authorized to call the method.
 * Throws RbacError if unauthorized.
 */
export function checkRbac(role: string, method: string): void {
    const resolvedRole = Object.values(Role).includes(role as Role) ? (role as Role) : Role.Viewer;

    if (WRITE_METHODS.has(method)) {
        if (!WRITE_ROLES.has(resolvedRole)) {
            throw new RbacError(resolvedRole, method);
        }
    } else {
        if (!READ_ROLES.has(resolvedRole)) {
            throw new RbacError(resolvedRole, method);
        }
    }
}
