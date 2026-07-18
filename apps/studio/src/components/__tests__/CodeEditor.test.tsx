import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CodeEditor from "../CodeEditor";

describe("CodeEditor", () => {
  it("renders the editor container div", () => {
    const { container } = render(
      <CodeEditor value="" onChange={vi.fn()} />,
    );

    const editorDiv = container.querySelector(".code-editor");
    expect(editorDiv).toBeInTheDocument();
  });

  it("initializes CodeMirror editor within the container", () => {
    const { container } = render(
      <CodeEditor value="PROGRAM main END_PROGRAM" onChange={vi.fn()} />,
    );

    // CodeMirror creates .cm-editor inside the container
    const cmEditor = container.querySelector(".cm-editor");
    expect(cmEditor).toBeInTheDocument();
  });
});
