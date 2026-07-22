// InspectorSlot — conditional right panel (280px) for HMI Designer widget selection
// SDD §1: listens to hmi:widget-selected, only render when HMI Designer is active
import { useEffect, useState } from "react";
import type { StudioEventBus } from "../core/StudioEventBus";
import "./InspectorSlot.css";

interface InspectorSlotProps {
  eventBus: StudioEventBus;
  visible: boolean;
}

interface WidgetSelectedPayload {
  toolId: string;
  widgetId: string;
  widgetType: string;
  signal?: string;
}

export default function InspectorSlot({ eventBus, visible }: InspectorSlotProps) {
  const [selection, setSelection] = useState<WidgetSelectedPayload | null>(null);

  useEffect(() => {
    const unsub = eventBus.on<WidgetSelectedPayload>("hmi:widget-selected", (payload) => {
      setSelection(payload);
    });
    return unsub;
  }, [eventBus]);

  // Reset selection when hidden
  useEffect(() => {
    if (!visible) setSelection(null);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="shell-inspector-slot">
      <div className="shell-inspector-slot__header">
        <span>Inspector</span>
      </div>
      <div className="shell-inspector-slot__content">
        {selection ? (
          <div className="shell-inspector-slot__detail">
            <div>
              <span className="shell-inspector-slot__detail-label">Widget</span>
              <div className="shell-inspector-slot__detail-value">{selection.widgetId}</div>
            </div>
            <div>
              <span className="shell-inspector-slot__detail-label">Type</span>
              <div>{selection.widgetType}</div>
            </div>
            {selection.signal && (
              <div>
                <span className="shell-inspector-slot__detail-label">Signal</span>
                <div className="shell-inspector-slot__detail-value shell-inspector-slot__detail-value--signal">
                  {selection.signal}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="shell-inspector-slot__empty">Select a widget on the canvas</div>
        )}
      </div>
    </div>
  );
}
