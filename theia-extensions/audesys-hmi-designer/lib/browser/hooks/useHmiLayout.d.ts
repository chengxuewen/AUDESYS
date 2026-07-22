import type { HmiLayout, HmiWidgetState, HmiWidgetType, HmiWidgetPosition, HmiWidgetSize } from "../types/hmi";
import type { ValidationResult } from "./useHmiLayoutValidator";
export declare function useHmiLayout(initialLayout?: HmiLayout): {
    layout: HmiLayout;
    selectedWidgetId: string | null;
    selectedWidget: HmiWidgetState | null;
    selectWidget: (id: string | null) => void;
    addWidget: (type: HmiWidgetType, position: HmiWidgetPosition, size: HmiWidgetSize, label: string) => string;
    updateWidget: (id: string, patch: Partial<Omit<HmiWidgetState, "id">>) => void;
    removeWidget: (id: string) => void;
    validateBeforeSave: () => ValidationResult;
    exportYaml: () => string;
    importYaml: (yamlStr: string) => void;
};
//# sourceMappingURL=useHmiLayout.d.ts.map