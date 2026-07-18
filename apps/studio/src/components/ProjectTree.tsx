import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ProjectInfo {
    name: string;
    entry: string;
    files: { name: string; path: string }[];
}

interface FileContent {
    path: string;
    content: string;
}

export interface ProjectTreeHandle {
    openFile: (path: string, content: string) => void;
}

interface ProjectTreeProps {
    onFileOpen: (file: FileContent) => void;
    activeFile: string | null;
}

export default function ProjectTree({ onFileOpen, activeFile }: ProjectTreeProps) {
    const [projectPath, setProjectPath] = useState("");
    const [project, setProject] = useState<ProjectInfo | null>(null);
    const [status, setStatus] = useState("");

    const handleOpen = async () => {
        try {
            const info: ProjectInfo = await invoke("open_project", { projectPath });
            setProject(info);
            setStatus(`Opened: ${info.name}`);
            // Auto-open entry file
            const content: string = await invoke("read_project_file", { filePath: info.files[0]?.path ?? "" });
            if (content && info.files[0]) {
                onFileOpen({ path: info.files[0].path, content });
            }
        } catch (e) {
            setStatus(String(e));
        }
    };

    const handleCreate = async () => {
        const name = prompt("Project name:");
        if (!name) return;
        try {
            const dir = prompt("Directory:", "/tmp/audesys-projects") ?? "/tmp/audesys-projects";
            const path: string = await invoke("create_project", { name, dir });
            setProjectPath(path);
            setStatus(`Created: ${path}`);
            // Open the new project
            const info: ProjectInfo = await invoke("open_project", { projectPath: path });
            setProject(info);
            const entry = info.files[0];
            if (entry) {
                const content: string = await invoke("read_project_file", { filePath: entry.path });
                onFileOpen({ path: entry.path, content });
            }
        } catch (e) {
            setStatus(String(e));
        }
    };

    const handleFileClick = async (file: { name: string; path: string }) => {
        try {
            const content: string = await invoke("read_project_file", { filePath: file.path });
            onFileOpen({ path: file.path, content });
        } catch (e) {
            setStatus(String(e));
        }
    };

    const handleRefresh = async () => {
        if (!projectPath) return;
        try {
            const info: ProjectInfo = await invoke("open_project", { projectPath });
            setProject(info);
        } catch (e) {
            setStatus(String(e));
        }
    };

    return (
        <div className="debug-panel">
            <div className="app-panel__header">Project</div>
            <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {!project ? (
                    <>
                        <input
                            placeholder="Path to .audesys-project.yaml"
                            value={projectPath}
                            onChange={(e) => setProjectPath(e.target.value)}
                            style={{ fontSize: "11px", padding: "4px" }}
                        />
                        <div style={{ display: "flex", gap: "4px" }}>
                            <button onClick={handleOpen} className="app-btn" style={{ flex: 1, fontSize: "12px", padding: "4px" }}>Open</button>
                            <button onClick={handleCreate} className="app-btn" style={{ flex: 1, fontSize: "12px", padding: "4px" }}>New</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: "12px", fontWeight: "bold", padding: "4px 0" }}>{project.name}</div>
                        {project.files.map((f) => (
                            <div
                                key={f.path}
                                onClick={() => handleFileClick(f)}
                                style={{
                                    padding: "2px 8px",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    background: activeFile === f.path ? "#444" : "transparent",
                                    borderRadius: "3px",
                                    fontFamily: "monospace",
                                }}
                            >
                                {f.name}
                            </div>
                        ))}
                        <button onClick={handleRefresh} className="app-btn" style={{ fontSize: "11px", padding: "4px", marginTop: "4px" }}>Refresh</button>
                        <button onClick={() => setProject(null)} className="app-btn" style={{ fontSize: "11px", padding: "4px" }}>Close</button>
                    </>
                )}
            </div>
            {status && <div style={{ padding: "4px 8px", fontSize: "10px", color: "#888" }}>{status}</div>}
        </div>
    );
}
