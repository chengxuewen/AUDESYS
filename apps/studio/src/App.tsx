import { useState, useCallback } from "react";
import FileTree from "./components/FileTree";
import TabBar from "./components/TabBar";
import Editor from "./components/Editor";
import StatusBar from "./components/StatusBar";

export default function App() {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});

  const handleFileSelect = useCallback((name: string, content: string) => {
    setOpenTabs((prev) => {
      if (!prev.includes(name)) {
        return [...prev, name];
      }
      return prev;
    });
    setActiveFile(name);
    setFileContents((prev) => {
      if (name in prev) return prev;
      return { ...prev, [name]: content };
    });
  }, []);

  const handleTabSelect = useCallback((name: string) => {
    setActiveFile(name);
  }, []);

  const handleTabClose = useCallback(
    (name: string) => {
      setOpenTabs((prev) => {
        const idx = prev.indexOf(name);
        const next = prev.filter((t) => t !== name);
        if (activeFile === name) {
          const newActive = next[idx] ?? next[next.length - 1] ?? null;
          setActiveFile(newActive);
        }
        return next;
      });
      setFileContents((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [activeFile],
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeFile && value !== undefined) {
        setFileContents((prev) => ({ ...prev, [activeFile]: value }));
      }
    },
    [activeFile],
  );

  const tabs = openTabs.map((name) => ({ name, isActive: name === activeFile }));

  return (
    <div className="h-screen w-screen bg-gray-950 text-gray-200 flex flex-col overflow-hidden">
      <TabBar tabs={tabs} onSelect={handleTabSelect} onClose={handleTabClose} />
      <div className="flex flex-1 overflow-hidden">
        <FileTree activeFile={activeFile} onSelect={handleFileSelect} />
        {activeFile && fileContents[activeFile] !== undefined ? (
          <Editor
            fileName={activeFile}
            content={fileContents[activeFile]}
            onChange={handleEditorChange}
          />
        ) : (
          <main className="flex-1 bg-gray-950 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-lg font-semibold text-gray-300 mb-2">
                AUDESYS Studio
              </h1>
              <p className="text-sm text-gray-600">Industrial Control IDE</p>
              <p className="text-xs text-gray-700 mt-4">
                Select a file from the explorer to begin
              </p>
            </div>
          </main>
        )}
      </div>
      <StatusBar activeFile={activeFile} />
    </div>
  );
}
