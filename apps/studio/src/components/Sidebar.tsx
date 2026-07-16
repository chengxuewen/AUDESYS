interface ProjectItem {
  name: string;
  icon: string;
  children?: ProjectItem[];
}

const projectTree: ProjectItem[] = [
  {
    name: "Project",
    icon: "📁",
    children: [
      { name: "main.st", icon: "📄" },
      { name: "hal.yaml", icon: "📄" },
    ],
  },
];

function TreeItem({ item, depth = 0 }: { item: ProjectItem; depth?: number }) {
  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-gray-800 rounded"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span className="text-xs">{item.icon}</span>
        <span className="text-sm text-gray-300">{item.name}</span>
      </div>
      {item.children?.map((child) => (
        <TreeItem key={child.name} item={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-60 h-full bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
      <div className="px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Explorer
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {projectTree.map((item) => (
          <TreeItem key={item.name} item={item} />
        ))}
      </div>
    </aside>
  );
}
