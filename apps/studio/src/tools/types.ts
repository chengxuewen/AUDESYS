/**
 * AUDESYS Studio Tool System — shared types.
 * Re-exports the canonical ToolProps and ToolDescriptor from ToolRegistry.
 * Each tool file should import from here.
 */
export { ToolRegistry, DuplicateToolError } from "../core/ToolRegistry";
export type {
  ToolProps,
  ToolDescriptor,
  ShellMode,
  PanelDescriptor,
  ToolbarAction,
  KeyBinding,
} from "../core/ToolRegistry";
