export interface FileItem {
  name: string;
  content: string;
  children?: FileItem[];
}

const demoFiles: FileItem[] = [
  {
    name: "project",
    content: "",
    children: [
      {
        name: "main.st",
        content:
          'PROGRAM main\nVAR\n  counter : INT := 0;\nEND_VAR\n\ncounter := counter + 1;\nEND_PROGRAM',
      },
      {
        name: "hal.yaml",
        content:
          "# HAL Configuration\nversion: 1\nsignals:\n  - name: sensor.temp\n    type: F32",
      },
      {
        name: "config.yaml",
        content:
          "# Runtime Config\ncycle_interval_ms: 10\nhealth_port: 9100",
      },
    ],
  },
];

function TreeItem({
  item,
  depth,
  activeFile,
  onSelect,
}: {
  item: FileItem;
  depth: number;
  activeFile: string | null;
  onSelect: (name: string, content: string) => void;
}) {
  const isFolder = item.children !== undefined;
  const isActive = item.name === activeFile;

  if (isFolder) {
    return (
      <div>
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 text-sm text-gray-400 select-none"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <span className="text-xs">📁</span>
          <span>{item.name}</span>
        </div>
        {item.children?.map((child) => (
          <TreeItem
            key={child.name}
            item={child}
            depth={depth + 1}
            activeFile={activeFile}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer text-sm select-none
          ${isActive ? "bg-gray-700 text-gray-100" : "text-gray-300 hover:bg-gray-800"}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(item.name, item.content)}
      >
        <span className="text-xs">📄</span>
        <span>{item.name}</span>
      </div>
    </div>
  );
}

export default function FileTree({
  activeFile,
  onSelect,
}: {
  activeFile: string | null;
  onSelect: (name: string, content: string) => void;
}) {
  return (
    <aside className="w-60 h-full bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
      <div className="px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Explorer
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {demoFiles.map((item) => (
          <TreeItem
            key={item.name}
            item={item}
            depth={0}
            activeFile={activeFile}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}
