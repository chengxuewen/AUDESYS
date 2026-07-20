import type { HmiLayout, HmiWidgetType } from "../types/hmi";

import GaugeWidget from "../widgets/GaugeWidget";
import ButtonWidget from "../widgets/ButtonWidget";
import TextWidget from "../widgets/TextWidget";
import IndicatorWidget from "../widgets/IndicatorWidget";
import TrendWidget from "../widgets/TrendWidget";
import TankWidget from "../widgets/TankWidget";
import DisplayWidget from "../widgets/DisplayWidget";

interface WidgetProps {
  id: string;
  label: string;
  signal?: string;
  config: Record<string, unknown>;
  width: number;
  height: number;
  isSelected: boolean;
  isPreview: boolean;
}

// ponytail: mirrors HmiCanvas WIDGET_COMPONENTS map
const WIDGET_COMPONENTS: Record<HmiWidgetType, React.FC<WidgetProps>> = {
  gauge: GaugeWidget,
  button: ButtonWidget,
  text: TextWidget,
  indicator: IndicatorWidget,
  trend: TrendWidget,
  tank: TankWidget,
  display: DisplayWidget,
};

interface PanelRendererProps {
  layout: HmiLayout;
}

export default function PanelRenderer({ layout }: PanelRendererProps) {
  return (
    <div
      style={{
        position: "relative",
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        background: "#010102",
        overflow: "hidden",
      }}
    >
      {layout.widgets.map((w) => {
        const Widget = WIDGET_COMPONENTS[w.type];
        if (!Widget) return null;
        return (
          <div
            key={w.id}
            style={{
              position: "absolute",
              left: w.position.x,
              top: w.position.y,
              width: w.size.width,
              height: w.size.height,
            }}
          >
            <Widget
              id={w.id}
              label={w.label}
              signal={w.signal}
              config={w.config}
              width={w.size.width}
              height={w.size.height}
              isSelected={false}
              isPreview={true}
            />
          </div>
        );
      })}
    </div>
  );
}
