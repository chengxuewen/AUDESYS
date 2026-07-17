import "./FileOperations.css";

interface FileOperationsProps {
  currentFile: string | null;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
}

export default function FileOperations({
  currentFile,
  onNew,
  onOpen,
  onSave,
}: FileOperationsProps) {
  const fileName = currentFile
    ? (currentFile.split("/").pop() ?? currentFile.split("\\").pop() ?? currentFile)
    : "untitled.st";

  return (
    <div className="file-operations">
      <div className="file-operations__buttons">
        <button className="fo-btn" onClick={onNew} title="New file">
          New
        </button>
        <button className="fo-btn" onClick={onOpen} title="Open file">
          Open
        </button>
        <button className="fo-btn" onClick={onSave} title="Save file">
          Save
        </button>
      </div>
      <span className="file-operations__name" title={currentFile ?? undefined}>
        {fileName}
      </span>
    </div>
  );
}
