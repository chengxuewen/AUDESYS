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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        backgroundColor: "#141416",
        borderBottom: "1px solid #2a2a30",
        flexShrink: 0,
      }}
    >
      <button className="app-btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={onSave}>
        Save
      </button>
      <button className="app-btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={onLoad}>
        Load
      </button>
      <div style={{ width: 1, height: 20, backgroundColor: "#2a2a30" }} />
      <button
        className="app-btn"
        style={{ fontSize: 12, padding: "4px 10px" }}
        onClick={onToggleMode}
      >
        {editMode ? "\u{25B6} Preview" : "\u{270F} Edit"}
      </button>
      {editMode && (
        <button
          className="app-btn"
          style={{ fontSize: 12, padding: "4px 10px", color: "#FF4444" }}
          onClick={onClear}
        >
          Clear
        </button>
      )}
      {editMode && onDeploy && (
        <button
          className="app-btn"
          style={{ fontSize: 12, padding: "4px 10px", color: "#FFB800" }}
          onClick={onDeploy}
        >
          ⬆ Deploy
        </button>
      )}
    </div>
  );
}
