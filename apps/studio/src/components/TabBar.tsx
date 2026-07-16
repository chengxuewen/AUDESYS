export interface Tab {
  name: string;
  isActive: boolean;
}

export default function TabBar({
  tabs,
  onSelect,
  onClose,
}: {
  tabs: Tab[];
  onSelect: (name: string) => void;
  onClose: (name: string) => void;
}) {
  if (tabs.length === 0) return null;

  return (
    <div className="h-9 bg-gray-900 border-b border-gray-800 flex items-center overflow-x-auto flex-shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.name}
          className={`h-full flex items-center gap-1.5 px-3 text-xs cursor-pointer border-r border-gray-800 flex-shrink-0 select-none
            ${tab.isActive ? "bg-gray-800 text-gray-100" : "text-gray-500 hover:bg-gray-800/50"}`}
          onClick={() => onSelect(tab.name)}
        >
          <span className="truncate max-w-[120px]">{tab.name}</span>
          <button
            className="text-gray-600 hover:text-gray-300 leading-none text-sm"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.name);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
