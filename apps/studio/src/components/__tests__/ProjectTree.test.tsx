import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ProjectTree from "../ProjectTree";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockedInvoke = vi.mocked(invoke);

describe("ProjectTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Project' header", () => {
    render(<ProjectTree onFileOpen={vi.fn()} activeFile={null} />);

    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it("shows Open and New buttons when no project loaded", () => {
    render(<ProjectTree onFileOpen={vi.fn()} activeFile={null} />);

    expect(
      screen.getByRole("button", { name: "Open" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New" }),
    ).toBeInTheDocument();
  });

  it("shows file list when project is loaded", async () => {
    const projectInfo = {
      name: "test-project",
      entry: "test-project/main.st",
      files: [
        { name: "main.st", path: "test-project/main.st" },
        { name: "io.st", path: "test-project/io.st" },
      ],
    };
    mockedInvoke.mockResolvedValue(projectInfo);

    render(<ProjectTree onFileOpen={vi.fn()} activeFile={null} />);

    const openBtn = screen.getByRole("button", { name: "Open" });
    await act(() => {
      fireEvent.click(openBtn);
    });

    expect(screen.getByText("test-project")).toBeInTheDocument();
    expect(screen.getByText("main.st")).toBeInTheDocument();
    expect(screen.getByText("io.st")).toBeInTheDocument();
  });
});
