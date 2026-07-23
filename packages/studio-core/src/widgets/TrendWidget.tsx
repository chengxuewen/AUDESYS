import React, { useRef, useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useStudioHmiSignal as useHmiSignal } from "../hooks/useStudioHmiSignal";
import WidgetErrorOverlay from "./WidgetErrorOverlay";

interface TrendWidgetProps {
  id: string; label: string; signal?: string;
  config: Record<string, unknown>;
  width: number; height: number;
  isSelected: boolean; isPreview: boolean;
}

export default function TrendWidget({ label, signal, config, width, height, isPreview }: TrendWidgetProps) {
  const { value: rawValue, error, clearError } = useHmiSignal(isPreview ? signal : undefined);
  const history = (config.history as number) ?? 60;
  const chartColor = (config.color as string) ?? "#FFB800";

  const [data, setData] = useState<{ time: number; value: number }[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    if (!isPreview || rawValue === null) return;
    counterRef.current++;
    const v = parseFloat(rawValue);
    if (isNaN(v)) return;
    setData(prev => {
      const next = [...prev, { time: counterRef.current, value: v }];
      while (next.length > history) next.shift();
      return next;
    });
  }, [rawValue, history, isPreview]);

  const option = {
    backgroundColor: "transparent",
    grid: { top: 8, right: 8, bottom: 4, left: 8 },
    xAxis: {
      type: "category" as const,
      show: false,
      data: data.map(d => d.time),
    },
    yAxis: { type: "value" as const, show: false, min: "dataMin", max: "dataMax" },
    series: [{
      data: data.map(d => d.value),
      type: "line" as const,
      smooth: false,
      lineStyle: { color: chartColor, width: 1.5 },
      areaStyle: { color: `${chartColor}20` },
      symbol: "none",
      animation: false,
    }],
    title: { text: label, left: "center", top: 2,
      textStyle: { color: "#a0a0b0", fontSize: 11, fontFamily: "Geist Sans" },
    },
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactECharts option={option} style={{ width: "100%", height: "100%" }} notMerge />
      {isPreview && error && (
        <WidgetErrorOverlay message={error} onDismiss={clearError} />
      )}
    </div>
  );
}
