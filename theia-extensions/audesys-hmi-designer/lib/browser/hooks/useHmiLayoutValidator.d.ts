import type { HmiLayout } from "../types/hmi";
export interface ValidationResult {
    errors: string[];
    warnings: string[];
}
export interface ValidationOptions {
    canvasWidth?: number;
    canvasHeight?: number;
    signalNames?: string[];
    maxWidgets?: number;
}
export declare function validateLayout(layout: HmiLayout, options?: ValidationOptions): ValidationResult;
//# sourceMappingURL=useHmiLayoutValidator.d.ts.map