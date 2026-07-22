import React from "react";

interface WidgetErrorOverlayProps {
  message: string;
  onDismiss: () => void;
}

export default function WidgetErrorOverlay({ message, onDismiss }: WidgetErrorOverlayProps) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(255, 68, 68, 0.15)",
        border: "1px solid #FF4444",
        borderRadius: "4px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        cursor: "pointer",
        zIndex: 10,
      }}
      title="Click to dismiss"
    >
      <span style={{ fontSize: "16px", lineHeight: 1 }}>&#x26A0;</span>
      <span
        style={{
          fontSize: "10px",
          fontFamily: "JetBrains Mono, monospace",
          color: "#FF4444",
          maxWidth: "90%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {message}
      </span>
    </div>
  );
}
