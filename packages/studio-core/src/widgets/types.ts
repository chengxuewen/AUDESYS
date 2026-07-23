/** Shared props for all HMI widgets. Pure presentational — no signal hook. */
export interface SharedWidgetProps {
  label: string;
  config: Record<string, unknown>;
  width: number;
  height: number;
  signalValue?: string | number | boolean | null;
  isSelected?: boolean;
  isPreview?: boolean;
  error?: string | null;
  onDismissError?: () => void;
}
