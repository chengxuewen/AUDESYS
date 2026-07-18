import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FileOperations from "../FileOperations";

describe("FileOperations", () => {
  it("renders New, Open, Save buttons", () => {
    render(<FileOperations currentFile={null} onNew={vi.fn()} onOpen={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("shows untitled when no file", () => {
    render(<FileOperations currentFile={null} onNew={vi.fn()} onOpen={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("untitled.st")).toBeTruthy();
  });

  it("shows filename basename", () => {
    render(<FileOperations currentFile="/home/user/project.st" onNew={vi.fn()} onOpen={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("project.st")).toBeTruthy();
  });

  it("calls onNew when New clicked", () => {
    const onNew = vi.fn();
    render(<FileOperations currentFile={null} onNew={onNew} onOpen={vi.fn()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByText("New"));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
