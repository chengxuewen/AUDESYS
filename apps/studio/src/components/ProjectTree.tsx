import { useState, useCallback } from "react";
import { usePlatform } from "../platform/provider";
import type { StudioEventBus } from "../core/StudioEventBus";

// ─── Types ───

interface FileEntry {
    name: string;
    path: string;
}

interface ProjectInfo {
    name: string;
    entry: string;
    files: FileEntry[];
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
    eventBus?: StudioEventBus;
}

// ─── Resource type configuration ───

type ResourceType = "programs" | "hmi" | "config" | "cnc" | "libraries";

const RESOURCE_TYPES: Array<{
    key: ResourceType;
    label: string;
    extensions: string[];
}> = [
    { key: "programs", label: "Programs", extensions: [".st", ".il", ".ld", ".fbd", ".sfc"] },
    { key: "hmi", label: "HMI Layouts", extensions: [".hmi"] },
    { key: "config", label: "Configurations", extensions: [".yaml", ".yml"] },
    { key: "cnc", label: "CNC", extensions: [".gcode", ".nc", ".gco"] },
    { key: "libraries", label: "Libraries", extensions: [".lib"] },
];

function classifyFile(name: string): ResourceType | null {
    const lower = name.toLowerCase();
    for (const { key, extensions } of RESOURCE_TYPES) {
        for (const ext of extensions) {
            if (lower.endsWith(ext)) return key;
        }
    }
    return null;
}

// ─── Component ───

export default function ProjectTree({
    onFileOpen,
    activeFile,
    eventBus,
}: ProjectTreeProps) {
    const { invoke } = usePlatform();
    const [projectPath, setProjectPath] = useState("");
    const [project, setProject] = useState<ProjectInfo | null>(null);
    const [status, setStatus] = useState("");
    // Track which resource type sections are expanded (all expanded by default)
    const [expandedSections, setExpandedSections] = useState<
        Record<ResourceType, boolean>
    >((): Record<ResourceType, boolean> => {
        const init: Record<ResourceType, boolean> = {} as Record<ResourceType, boolean>;
        for (const t of RESOURCE_TYPES) {
            init[t.key] = true;
        }
        return init;
    });

    const toggleSection = useCallback((key: ResourceType) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleFileClick = useCallback(
        async (file: FileEntry) => {
            try {
                const content: string = await invoke("read_project_file", { filePath: file.path });
                onFileOpen({ path: file.path, content });
                // Emit event via EventBus if available
                eventBus?.emit("project:file-opened", { path: file.path, name: file.name });
            } catch (e) {
                setStatus(String(e));
            }
        },
        [invoke, onFileOpen, eventBus],
    );

    const handleOpen = async () => {
        try {
            const info: ProjectInfo = await invoke("open_project", { projectPath });
            setProject(info);
            setStatus(`Opened: ${info.name}`);
            // Auto-open entry file
            const content: string = await invoke("read_project_file", {
                filePath: info.files[0]?.path ?? "",
            });
            if (content && info.files[0]) {
                onFileOpen({ path: info.files[0].path, content });
                eventBus?.emit("project:file-opened", {
                    path: info.files[0].path,
                    name: info.files[0].name,
                });
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
            const info: ProjectInfo = await invoke("open_project", { projectPath: path });
            setProject(info);
            const entry = info.files[0];
            if (entry) {
                const content: string = await invoke("read_project_file", { filePath: entry.path });
                onFileOpen({ path: entry.path, content });
                eventBus?.emit("project:file-opened", { path: entry.path, name: entry.name });
            }
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

    // Build resource groups from project files
    const grouped: Map<ResourceType, FileEntry[]> = new Map();
    if (project) {
        for (const t of RESOURCE_TYPES) {
            grouped.set(t.key, []);
        }
        for (const f of project.files) {
            const type = classifyFile(f.name);
            if (type) {
                grouped.get(type)!.push(f);
            }
        }
    }

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
                            <button
                                onClick={handleOpen}
                                className="app-btn"
                                style={{ flex: 1, fontSize: "12px", padding: "4px" }}
                            >
                                Open
                            </button>
                            <button
                                onClick={handleCreate}
                                className="app-btn"
                                style={{ flex: 1, fontSize: "12px", padding: "4px" }}
                            >
                                New
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: "12px", fontWeight: "bold", padding: "4px 0" }}>
                            {project.name}
                        </div>

                        {RESOURCE_TYPES.map(({ key, label }) => {
                            const files = grouped.get(key) ?? [];
                            if (files.length === 0) return null;
                            const isExpanded = expandedSections[key];
                            return (
                                <div key={key}>
                                    <div
                                        onClick={() => toggleSection(key)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            padding: "3px 4px",
                                            fontSize: "11px",
                                            fontWeight: "600",
                                            cursor: "pointer",
                                            color: "var(--color-text-secondary)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px",
                                            userSelect: "none",
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: "inline-block",
                                                width: "8px",
                                                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                                transition: "transform 100ms ease",
                                                fontSize: "9px",
                                            }}
                                        >
                                            ▸
                                        </span>
                                        <span>{label}</span>
                                    </div>
                                    {isExpanded && (
                                        <div>
                                            {files.map((f) => (
                                                <div
                                                    key={f.path}
                                                    onClick={() => handleFileClick(f)}
                                                    style={{
                                                        padding: "2px 8px",
                                                        paddingLeft: "24px",
                                                        fontSize: "12px",
                                                        cursor: "pointer",
                                                        background:
                                                            activeFile === f.path
                                                                ? "var(--color-surface-3)"
                                                                : "transparent",
                                                        borderRadius: "3px",
                                                        fontFamily: "monospace",
                                                    }}
                                                >
                                                    {f.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <button
                            onClick={handleRefresh}
                            className="app-btn"
                            style={{ fontSize: "11px", padding: "4px", marginTop: "4px" }}
                        >
                            Refresh
                        </button>
                        <button
                            onClick={() => setProject(null)}
                            className="app-btn"
                            style={{ fontSize: "11px", padding: "4px" }}
                        >
                            Close
                        </button>
                    </>
                )}
            </div>
            {status && (
                <div
                    style={{
                        padding: "4px 8px",
                        fontSize: "10px",
                        color: "var(--color-text-tertiary)",
                    }}
                >
                    {status}
                </div>
            )}
        </div>
    );
}
