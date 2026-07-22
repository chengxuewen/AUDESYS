import React from "react";
interface HmiToolbarProps {
  editMode: boolean;
  onToggleMode: () => void;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onDeploy?: () => void;
}

export default function HmiToolbar({ editMode, onToggleMode, onSave, onLoad, onClear, onDeploy }: HmiToolbarProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", backgroundColor: "#141416", borderBottom: "1px solid #2a2a30", flexShrink: 0 }}>
      <button style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#e8e8ed", cursor: "pointer" }} onClick={onSave}>
        Save
      </button>
      <button style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#e8e8ed", cursor: "pointer" }} onClick={onLoad}>
        Load
      </button>
      <div style={{ width: 1, height: 20, backgroundColor: "#2a2a30" }} />
      <button style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#e8e8ed", cursor: "pointer" }} onClick={onToggleMode}>
        {editMode ? "▶ Preview" : "✏ Edit"}
      </button>
      {editMode && (
        <button style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#FF4444", cursor: "pointer" }} onClick={onClear}>
          Clear
        </button>
      )}
      {editMode && onDeploy && (
        <button style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #2a2a30", borderRadius: 4, backgroundColor: "#1e1e22", color: "#FFB800", cursor: "pointer" }} onClick={onDeploy}>
          ⬆ Deploy
        </button>
      )}
    </div>
  );
}
