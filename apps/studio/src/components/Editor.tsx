import MonacoEditor from "@monaco-editor/react";

export default function Editor({
  fileName,
  content,
  onChange,
}: {
  fileName: string;
  language?: string;
  content: string;
  onChange: (value: string | undefined) => void;
}) {
  const lang = fileName.endsWith(".st")
    ? "pascal"
    : fileName.endsWith(".yaml")
      ? "yaml"
      : "plaintext";

  return (
    <div className="flex-1 overflow-hidden">
      <MonacoEditor
        height="100%"
        theme="vs-dark"
        language={lang}
        value={content}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          lineNumbers: "off",
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          padding: { top: 8 },
          overviewRulerLanes: 0,
          renderLineHighlight: "none",
          guides: { indentation: false },
        }}
      />
    </div>
  );
}
