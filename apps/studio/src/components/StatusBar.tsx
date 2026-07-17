import "./StatusBar.css";

export type CompileStatus = "ready" | "compiling" | "error" | "success";

interface StatusBarProps {
  line: number;
  col: number;
  status: CompileStatus;
  fileName: string | null;
}

const STATUS_LABELS: Record<CompileStatus, string> = {
  ready: "Ready",
  compiling: "Compiling...",
  error: "Error",
  success: "Success",
};

export default function StatusBar({
  line,
  col,
  status,
  fileName,
}: StatusBarProps) {
  const displayName = fileName
    ? (fileName.split("/").pop() ?? fileName.split("\\").pop() ?? fileName)
    : "untitled.st";

  return (
    <div className="status-bar">
      <span className="status-bar__cursor">
        Ln {line}, Col {col}
      </span>
      <span className={`status-bar__status status-bar__status--${status}`}>
        <span className="status-bar__dot" />
        {STATUS_LABELS[status]}
      </span>
      <span className="status-bar__file">{displayName}</span>
    </div>
  );
}
